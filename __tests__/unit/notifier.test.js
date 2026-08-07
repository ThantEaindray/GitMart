jest.mock('../../src/models/Notification.model', () => ({
  create: jest.fn(),
}));

jest.mock('../../src/utils/sseManager', () => ({
  send: jest.fn(),
}));

jest.mock('../../src/utils/mailer', () => ({
  sendNotificationEmail: jest.fn(),
}));

const model = require('../../src/models/Notification.model');
const sseManager = require('../../src/utils/sseManager');
const mailer = require('../../src/utils/mailer');
const notifier = require('../../src/utils/notifier');

let consoleErrorSpy;

beforeAll(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  consoleErrorSpy.mockRestore();
  jest.restoreAllMocks();
});

const ROW = {
  id: 12,
  user_id: 7,
  type: 'reservation',
  title: 'New reservation request',
  message: 'bob requested to reserve "Watch".',
  link: '/html/listing.html?id=5',
  is_read: false,
  created_on: '2026-08-02T10:00:00.000Z',
};

function stubCreateSuccess(row = ROW) {
  model.create.mockImplementation((_data, callback) => callback(null, { rows: [row] }));
}

// ── toClientShape ─────────────────────────────────────────────────────────

describe('notifier.toClientShape', () => {
  test('maps snake_case columns to the camelCase shape the frontend expects', () => {
    expect(notifier.toClientShape(ROW)).toEqual({
      id: 12,
      userId: '7',
      type: 'reservation',
      icon: 'bi-calendar-check',
      title: 'New reservation request',
      message: 'bob requested to reserve "Watch".',
      link: '/html/listing.html?id=5',
      isRead: false,
      createdAt: '2026-08-02T10:00:00.000Z',
    });
  });

  test('maps a missing link to null rather than undefined', () => {
    const { link: _link, ...rowWithoutLink } = ROW;
    expect(notifier.toClientShape(rowWithoutLink).link).toBeNull();
  });

  test('derives the icon from the type rather than reading a stored column', () => {
    expect(notifier.toClientShape({ ...ROW, type: 'order' }).icon).toBe('bi-bag-check');
    expect(notifier.toClientShape({ ...ROW, type: 'wishlist' }).icon).toBe('bi-heart');
  });

  test('falls back to a default icon for an unmapped type', () => {
    expect(notifier.toClientShape({ ...ROW, type: 'something_new' }).icon).toBe('bi-bell');
  });

  test('normalises created_on to an ISO string', () => {
    const shaped = notifier.toClientShape({ ...ROW, created_on: new Date('2026-01-02T03:04:05Z') });
    expect(shaped.createdAt).toBe('2026-01-02T03:04:05.000Z');
  });
});

// ── notify ────────────────────────────────────────────────────────────────

describe('notifier.notify', () => {
  test('persists the notification with the given fields', () => {
    stubCreateSuccess();

    notifier.notify(7, 'reservation', 'New reservation request', 'bob wants your Watch.');

    expect(model.create).toHaveBeenCalledWith(
      {
        userId: 7,
        type: 'reservation',
        title: 'New reservation request',
        message: 'bob wants your Watch.',
        link: null,
      },
      expect.any(Function),
    );
  });

  test('passes a link through to the model when given one', () => {
    stubCreateSuccess();

    notifier.notify(7, 'reservation', 'T', 'M', '/html/listing.html?id=5');

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ link: '/html/listing.html?id=5' }),
      expect.any(Function),
    );
  });

  test('pushes the mapped notification over SSE after persisting', () => {
    stubCreateSuccess();

    notifier.notify(7, 'reservation', 'T', 'M');

    expect(sseManager.send).toHaveBeenCalledWith(
      7,
      'notification',
      expect.objectContaining({ id: 12, isRead: false, icon: 'bi-calendar-check' }),
    );
  });

  test('sends the email after persisting', () => {
    stubCreateSuccess();

    notifier.notify(7, 'reservation', 'T', 'M');

    expect(mailer.sendNotificationEmail).toHaveBeenCalledWith(7, 'T', 'M');
  });

  test('does nothing at all when there is no recipient', () => {
    notifier.notify(null, 'reservation', 'T', 'M');

    expect(model.create).not.toHaveBeenCalled();
    expect(sseManager.send).not.toHaveBeenCalled();
    expect(mailer.sendNotificationEmail).not.toHaveBeenCalled();
  });

  test('skips the push and the email when persisting fails', () => {
    // Persistence is the source of truth. If the row never landed there is
    // nothing to announce, so neither side channel should fire.
    const boom = new Error('insert failed');
    model.create.mockImplementation((_data, callback) => callback(boom));

    notifier.notify(7, 'reservation', 'T', 'M');

    expect(sseManager.send).not.toHaveBeenCalled();
    expect(mailer.sendNotificationEmail).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(boom);
  });

  test('swallows a persistence failure instead of throwing at the caller', () => {
    model.create.mockImplementation((_data, callback) => callback(new Error('insert failed')));

    // A failed notification must never break the action that triggered it.
    expect(() => notifier.notify(7, 'reservation', 'T', 'M')).not.toThrow();
  });

  test('still emails when the recipient has no open SSE stream', () => {
    // sseManager.send returns false for an offline user; that is not an error.
    stubCreateSuccess();
    sseManager.send.mockReturnValue(false);

    notifier.notify(7, 'reservation', 'T', 'M');

    expect(mailer.sendNotificationEmail).toHaveBeenCalledWith(7, 'T', 'M');
  });
});
