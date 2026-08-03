jest.mock('../../src/models/Notification.model', () => ({
  getByUser: jest.fn(),
  getUnreadCount: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
}));

jest.mock('../../src/utils/sseManager', () => ({
  register: jest.fn(),
  unregister: jest.fn(),
  send: jest.fn(),
}));

const model = require('../../src/models/Notification.model');
const sseManager = require('../../src/utils/sseManager');
const controller = require('../../src/controllers/Notification.controller');

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

function createResponse(userId = 7) {
  const res = {
    locals: { userId },
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

const ROW = {
  id: 12,
  user_id: 7,
  type: 'reservation',
  title: 'T',
  message: 'M',
  is_read: false,
  created_on: '2026-08-02T10:00:00.000Z',
};

// ── getAll ────────────────────────────────────────────────────────────────

describe('Notification.controller - getAll', () => {
  test('returns rows mapped into the frontend shape', () => {
    model.getByUser.mockImplementation((_data, callback) => callback(null, { rows: [ROW] }));

    const res = createResponse();
    controller.getAll({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({ id: 12, isRead: false, createdAt: '2026-08-02T10:00:00.000Z' }),
    ]);
  });

  test('scopes the query to the logged-in user', () => {
    model.getByUser.mockImplementation((_data, callback) => callback(null, { rows: [] }));

    controller.getAll({}, createResponse(42));

    expect(model.getByUser).toHaveBeenCalledWith({ userId: 42 }, expect.any(Function));
  });

  test('returns 500 when the lookup fails', () => {
    model.getByUser.mockImplementation((_data, callback) => callback(new Error('db down')));

    const res = createResponse();
    controller.getAll({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── getUnreadCount ────────────────────────────────────────────────────────

describe('Notification.controller - getUnreadCount', () => {
  test('converts the bigint string from COUNT(*) into a number', () => {
    // node-postgres returns bigint as a string; leaving it would make the
    // client do arithmetic on '3'.
    model.getUnreadCount.mockImplementation((_data, callback) =>
      callback(null, { rows: [{ count: '3' }] }),
    );

    const res = createResponse();
    controller.getUnreadCount({}, res);

    expect(res.json).toHaveBeenCalledWith({ count: 3 });
    expect(typeof res.json.mock.calls[0][0].count).toBe('number');
  });

  test('reports zero rather than a string when nothing is unread', () => {
    model.getUnreadCount.mockImplementation((_data, callback) =>
      callback(null, { rows: [{ count: '0' }] }),
    );

    const res = createResponse();
    controller.getUnreadCount({}, res);

    expect(res.json).toHaveBeenCalledWith({ count: 0 });
  });

  test('returns 500 when the count fails', () => {
    model.getUnreadCount.mockImplementation((_data, callback) => callback(new Error('db down')));

    const res = createResponse();
    controller.getUnreadCount({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── markRead ──────────────────────────────────────────────────────────────

describe('Notification.controller - markRead', () => {
  test('rejects a non-numeric id before touching the database', () => {
    const res = createResponse();
    controller.markRead({ params: { id: 'abc' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(model.markRead).not.toHaveBeenCalled();
  });

  test('marks the notification read and returns the mapped row', () => {
    model.markRead.mockImplementation((_data, callback) =>
      callback(null, { rows: [{ ...ROW, is_read: true }] }),
    );

    const res = createResponse();
    controller.markRead({ params: { id: '12' } }, res);

    expect(model.markRead).toHaveBeenCalledWith({ id: 12, userId: 7 }, expect.any(Function));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 12, isRead: true }));
  });

  test('returns 404 when the notification belongs to another user', () => {
    // The model scopes by user_id, so someone else's row simply matches
    // nothing. Answering 404 rather than 403 avoids confirming it exists.
    model.markRead.mockImplementation((_data, callback) => callback(null, { rows: [] }));

    const res = createResponse();
    controller.markRead({ params: { id: '12' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ── markAllRead ───────────────────────────────────────────────────────────

describe('Notification.controller - markAllRead', () => {
  test('clears the badge over SSE so open tabs update immediately', () => {
    model.markAllRead.mockImplementation((_data, callback) => callback(null));

    const res = createResponse();
    controller.markAllRead({}, res);

    expect(sseManager.send).toHaveBeenCalledWith(7, 'badge', { unreadCount: 0 });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('does not push a badge update when the write fails', () => {
    model.markAllRead.mockImplementation((_data, callback) => callback(new Error('db down')));

    const res = createResponse();
    controller.markAllRead({}, res);

    expect(sseManager.send).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── stream ────────────────────────────────────────────────────────────────

describe('Notification.controller - stream', () => {
  // stream() starts a 20s keep-alive interval that is only cleared when the
  // request emits 'close'. Every stream test must therefore fire 'close' or the
  // timer outlives the suite and Jest cannot exit cleanly.
  const openRequests = [];

  function createStreamRequest() {
    const handlers = {};
    const req = {
      on: jest.fn((event, handler) => {
        handlers[event] = handler;
      }),
      fire: (event) => handlers[event] && handlers[event](),
    };
    openRequests.push(req);
    return req;
  }

  afterEach(() => {
    openRequests.splice(0).forEach((req) => req.fire('close'));
  });

  test('sets the SSE headers and registers the client', () => {
    model.getUnreadCount.mockImplementation((_data, callback) =>
      callback(null, { rows: [{ count: '2' }] }),
    );

    const req = createStreamRequest();
    const res = createResponse();
    controller.stream(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(res.flushHeaders).toHaveBeenCalled();
    expect(sseManager.register).toHaveBeenCalledWith(7, res);
  });

  test('sends the unread count as a number in the init event', () => {
    model.getUnreadCount.mockImplementation((_data, callback) =>
      callback(null, { rows: [{ count: '2' }] }),
    );

    const res = createResponse();
    controller.stream(createStreamRequest(), res);

    expect(res.write).toHaveBeenCalledWith(
      'event: init\ndata: ' + JSON.stringify({ unreadCount: 2 }) + '\n\n',
    );
  });

  test('unregisters the client when the connection closes', () => {
    model.getUnreadCount.mockImplementation((_data, callback) =>
      callback(null, { rows: [{ count: '0' }] }),
    );

    const req = createStreamRequest();
    controller.stream(req, createResponse());

    req.fire('close');

    expect(sseManager.unregister).toHaveBeenCalledWith(7);
  });

  test('keeps the stream open when the initial count query fails', () => {
    // The connection is already established at this point, so a failed count
    // must not tear it down — the badge just starts empty.
    model.getUnreadCount.mockImplementation((_data, callback) => callback(new Error('db down')));

    const res = createResponse();
    controller.stream(createStreamRequest(), res);

    expect(sseManager.register).toHaveBeenCalled();
    expect(res.write).not.toHaveBeenCalledWith(expect.stringContaining('event: init'));
  });
});
