const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

jest.mock('../../src/models/Notification.model', () => ({
  getEmailRecipient: jest.fn(),
}));

const nodemailer = require('nodemailer');
const model = require('../../src/models/Notification.model');
const mailer = require('../../src/utils/mailer');

const ORIGINAL_ENV = process.env;
let consoleErrorSpy;

beforeAll(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
  mailer._resetTransport();
  process.env = { ...ORIGINAL_ENV };
  mockSendMail.mockResolvedValue({ messageId: 'stub' });
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
  consoleErrorSpy.mockRestore();
  jest.restoreAllMocks();
});

function configureSmtp() {
  process.env.SMTP_HOST = 'smtp.test.local';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user@test.local';
  process.env.SMTP_PASS = 'secret';
  process.env.SMTP_FROM = 'GitMart <no-reply@test.local>';
}

function clearSmtp() {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
}

function stubRecipient(row) {
  model.getEmailRecipient.mockImplementation((_data, callback) => callback(null, { rows: [row] }));
}

// ── isConfigured ──────────────────────────────────────────────────────────

describe('mailer.isConfigured', () => {
  test('is false when SMTP settings are absent', () => {
    clearSmtp();
    expect(mailer.isConfigured()).toBe(false);
  });

  test('is true only when host, user and password are all present', () => {
    clearSmtp();
    process.env.SMTP_HOST = 'smtp.test.local';
    expect(mailer.isConfigured()).toBe(false);

    process.env.SMTP_USER = 'user@test.local';
    expect(mailer.isConfigured()).toBe(false);

    process.env.SMTP_PASS = 'secret';
    expect(mailer.isConfigured()).toBe(true);
  });
});

// ── sendNotificationEmail ─────────────────────────────────────────────────

describe('mailer.sendNotificationEmail', () => {
  test('does not even query the database when SMTP is unconfigured', () => {
    // The config guard runs before the lookup so an unconfigured environment
    // (every test run, and any dev box without SMTP) costs zero queries.
    clearSmtp();

    mailer.sendNotificationEmail(7, 'T', 'M');

    expect(model.getEmailRecipient).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('does nothing when there is no recipient id', () => {
    configureSmtp();

    mailer.sendNotificationEmail(null, 'T', 'M');

    expect(model.getEmailRecipient).not.toHaveBeenCalled();
  });

  test('sends to the address on file when the user opted in', () => {
    configureSmtp();
    stubRecipient({ email: 'ann@test.local', username: 'ann', notify_email: true });

    mailer.sendNotificationEmail(7, 'New reservation request', 'bob wants your Watch.');

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const sent = mockSendMail.mock.calls[0][0];
    expect(sent.to).toBe('ann@test.local');
    expect(sent.subject).toBe('New reservation request');
    expect(sent.from).toBe('GitMart <no-reply@test.local>');
  });

  test('respects the per-user opt-out', () => {
    configureSmtp();
    stubRecipient({ email: 'ann@test.local', username: 'ann', notify_email: false });

    mailer.sendNotificationEmail(7, 'T', 'M');

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('skips users with no address on file', () => {
    configureSmtp();
    stubRecipient({ email: null, username: 'ann', notify_email: true });

    mailer.sendNotificationEmail(7, 'T', 'M');

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('does nothing when the user no longer exists', () => {
    configureSmtp();
    model.getEmailRecipient.mockImplementation((_data, callback) => callback(null, { rows: [] }));

    mailer.sendNotificationEmail(7, 'T', 'M');

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('sends both a plain-text and an HTML body', () => {
    configureSmtp();
    stubRecipient({ email: 'ann@test.local', username: 'ann', notify_email: true });

    mailer.sendNotificationEmail(7, 'Title here', 'Body here');

    const sent = mockSendMail.mock.calls[0][0];
    expect(sent.text).toContain('Title here');
    expect(sent.text).toContain('Body here');
    expect(sent.html).toContain('Title here');
    expect(sent.html).toContain('Body here');
  });

  test('escapes user-supplied text so it cannot inject markup into the email', () => {
    configureSmtp();
    stubRecipient({ email: 'ann@test.local', username: '<script>x</script>', notify_email: true });

    mailer.sendNotificationEmail(7, 'T', '<img src=x onerror=alert(1)>');

    const html = mockSendMail.mock.calls[0][0].html;
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  test('swallows a send failure rather than rejecting', async () => {
    configureSmtp();
    stubRecipient({ email: 'ann@test.local', username: 'ann', notify_email: true });
    mockSendMail.mockRejectedValue(new Error('SMTP unreachable'));

    expect(() => mailer.sendNotificationEmail(7, 'T', 'M')).not.toThrow();

    // Let the rejected promise settle so the .catch handler runs.
    await new Promise((resolve) => setImmediate(resolve));
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to send notification email:',
      'SMTP unreachable',
    );
  });

  test('logs and stops when the recipient lookup fails', () => {
    configureSmtp();
    const boom = new Error('db down');
    model.getEmailRecipient.mockImplementation((_data, callback) => callback(boom));

    mailer.sendNotificationEmail(7, 'T', 'M');

    expect(mockSendMail).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(boom);
  });

  test('uses implicit TLS on port 465 and STARTTLS otherwise', () => {
    configureSmtp();
    stubRecipient({ email: 'ann@test.local', username: 'ann', notify_email: true });

    process.env.SMTP_PORT = '465';
    mailer.sendNotificationEmail(7, 'T', 'M');
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );

    mailer._resetTransport();
    process.env.SMTP_PORT = '587';
    mailer.sendNotificationEmail(7, 'T', 'M');
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 587, secure: false }),
    );
  });

  test('builds the transport once and reuses it across sends', () => {
    configureSmtp();
    stubRecipient({ email: 'ann@test.local', username: 'ann', notify_email: true });

    mailer.sendNotificationEmail(7, 'T', 'M');
    mailer.sendNotificationEmail(7, 'T2', 'M2');

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });
});
