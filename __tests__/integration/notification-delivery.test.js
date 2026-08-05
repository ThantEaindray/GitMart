process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

const pool = require('../../src/models/db');
const mailer = require('../../src/utils/mailer');
const sseManager = require('../../src/utils/sseManager');
const notifier = require('../../src/utils/notifier');

// Declared once and reused for setup and cleanup so the two cannot drift.
const SUITE_USERNAMES = ['delivery_optin', 'delivery_optout'];

let optIn;
let optOut;
let consoleErrorSpy;

const ORIGINAL_ENV = { ...process.env };

async function insertUser(username, email, notifyEmail) {
  const result = await pool.query(
    `
      INSERT INTO users (username, email, password, notify_email)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, notify_email
    `,
    [username, email, 'not-used-by-these-tests', notifyEmail],
  );
  return result.rows[0];
}

async function cleanupSuiteData() {
  await pool.query('DELETE FROM users WHERE username = ANY($1::text[])', [SUITE_USERNAMES]);
}

// Port 1 on loopback refuses immediately, so the real nodemailer transport is
// built and exercised without needing an SMTP server and without a slow
// timeout. The send always fails, which is precisely the path that matters:
// a mail failure must never surface to the caller.
function configureUnreachableSmtp() {
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = '1';
  process.env.SMTP_USER = 'integration@test.local';
  process.env.SMTP_PASS = 'not-a-real-password';
  process.env.SMTP_FROM = 'GitMart <no-reply@test.local>';
  process.env.APP_URL = 'http://localhost:3001';
  mailer._resetTransport();
}

function clearSmtp() {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  mailer._resetTransport();
}

// Lets the fire-and-forget promise inside sendNotificationEmail settle.
function flush(ms = 200) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeAll(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(async () => {
  await cleanupSuiteData();
  optIn = await insertUser(SUITE_USERNAMES[0], 'delivery.optin@example.com', true);
  optOut = await insertUser(SUITE_USERNAMES[1], 'delivery.optout@example.com', false);
  consoleErrorSpy.mockClear();
  process.env = { ...ORIGINAL_ENV };
  mailer._resetTransport();
});

afterAll(async () => {
  process.env = ORIGINAL_ENV;
  consoleErrorSpy.mockRestore();
  await cleanupSuiteData();
  await pool.end();
});

describe('mailer.isConfigured', () => {
  test('is false when SMTP settings are absent', () => {
    clearSmtp();
    expect(mailer.isConfigured()).toBe(false);
  });

  test('requires host, user and password together', () => {
    clearSmtp();
    process.env.SMTP_HOST = '127.0.0.1';
    expect(mailer.isConfigured()).toBe(false);

    process.env.SMTP_USER = 'someone@test.local';
    expect(mailer.isConfigured()).toBe(false);

    process.env.SMTP_PASS = 'secret';
    expect(mailer.isConfigured()).toBe(true);
  });
});

describe('mailer.sendNotificationEmail', () => {
  test('does nothing when SMTP is unconfigured', async () => {
    clearSmtp();

    mailer.sendNotificationEmail(optIn.id, 'Title', 'Message');
    await flush();

    // No lookup, no send, no error — it returns before touching anything.
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('does nothing without a recipient id', async () => {
    configureUnreachableSmtp();

    mailer.sendNotificationEmail(null, 'Title', 'Message');
    await flush();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('attempts a send for a user who opted in, and swallows the failure', async () => {
    configureUnreachableSmtp();

    // Must not throw even though the SMTP host refuses the connection.
    expect(() => mailer.sendNotificationEmail(optIn.id, 'Title', 'Message')).not.toThrow();
    await flush(500);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to send notification email:',
      expect.any(String),
    );
  });

  test('does not attempt a send for a user who opted out', async () => {
    configureUnreachableSmtp();

    mailer.sendNotificationEmail(optOut.id, 'Title', 'Message');
    await flush(500);

    // No connection attempted, so nothing to fail.
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('does nothing for a user id that no longer exists', async () => {
    configureUnreachableSmtp();

    mailer.sendNotificationEmail(999999, 'Title', 'Message');
    await flush(500);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('reuses one transport across sends', async () => {
    configureUnreachableSmtp();

    mailer.sendNotificationEmail(optIn.id, 'One', 'First');
    await flush(300);
    mailer.sendNotificationEmail(optIn.id, 'Two', 'Second');
    await flush(300);

    // Both attempts fail, proving the cached transport is still used rather
    // than the second call short-circuiting.
    expect(consoleErrorSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe('sseManager', () => {
  // A stand-in for an Express response holding an open SSE stream.
  function fakeStream() {
    return {
      written: [],
      ended: false,
      write(chunk) {
        this.written.push(chunk);
        return true;
      },
      end() {
        this.ended = true;
      },
    };
  }

  test('send returns false when the user has no open stream', () => {
    expect(sseManager.send('no-such-user', 'notification', { id: 1 })).toBe(false);
  });

  test('send writes a named event to a registered stream', () => {
    const stream = fakeStream();
    sseManager.register('sse-user-1', stream);

    const sent = sseManager.send('sse-user-1', 'notification', { id: 7 });

    expect(sent).toBe(true);
    expect(stream.written[0]).toBe('event: notification\ndata: {"id":7}\n\n');

    sseManager.unregister('sse-user-1');
  });

  test('registering again ends the previous stream, as on a page refresh', () => {
    const first = fakeStream();
    const second = fakeStream();

    sseManager.register('sse-user-2', first);
    sseManager.register('sse-user-2', second);

    expect(first.ended).toBe(true);
    // Only the newest stream receives events.
    sseManager.send('sse-user-2', 'badge', { unreadCount: 3 });
    expect(first.written).toHaveLength(0);
    expect(second.written).toHaveLength(1);

    sseManager.unregister('sse-user-2');
  });

  test('a stream that throws on write is dropped from the registry', () => {
    const broken = {
      write() {
        throw new Error('socket closed');
      },
      end() {},
    };

    sseManager.register('sse-user-3', broken);

    expect(sseManager.send('sse-user-3', 'notification', { id: 1 })).toBe(false);
    // Dropped, so a second attempt also reports no listener rather than
    // throwing again.
    expect(sseManager.send('sse-user-3', 'notification', { id: 2 })).toBe(false);
  });

  test('unregister stops further delivery', () => {
    const stream = fakeStream();
    sseManager.register('sse-user-4', stream);
    sseManager.unregister('sse-user-4');

    expect(sseManager.send('sse-user-4', 'notification', { id: 1 })).toBe(false);
  });

  test('user ids are matched regardless of string or number type', () => {
    // Tokens yield numeric ids while the registry keys are strings, so this
    // must not depend on which the caller happens to hold.
    const stream = fakeStream();
    sseManager.register(4242, stream);

    expect(sseManager.send('4242', 'notification', { id: 1 })).toBe(true);

    sseManager.unregister(4242);
  });
});

describe('notifier.notify', () => {
  test('persists the notification and pushes it to an open stream', async () => {
    const stream = fakeStreamFor();
    sseManager.register(optIn.id, stream);

    notifier.notify(optIn.id, 'system', 'Delivered', 'Body text');
    await flush(300);

    const stored = await pool.query('SELECT * FROM notifications WHERE user_id = $1', [optIn.id]);
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].title).toBe('Delivered');

    expect(stream.written[0]).toContain('event: notification');
    expect(stream.written[0]).toContain('Delivered');

    sseManager.unregister(optIn.id);
  });

  test('still persists when the recipient has no open stream', async () => {
    notifier.notify(optIn.id, 'system', 'Offline', 'Body text');
    await flush(300);

    const stored = await pool.query('SELECT * FROM notifications WHERE user_id = $1', [optIn.id]);
    expect(stored.rows).toHaveLength(1);
  });

  test('does nothing without a recipient', async () => {
    notifier.notify(null, 'system', 'Nobody', 'Body text');
    await flush(200);

    const stored = await pool.query('SELECT COUNT(*) AS count FROM notifications');
    expect(Number(stored.rows[0].count)).toBe(0);
  });

  test('logs and stops when the row cannot be written', async () => {
    // A type outside the CHECK constraint makes the insert fail, which is the
    // path where neither the SSE push nor the email should run.
    notifier.notify(optIn.id, 'not_a_valid_type', 'Bad', 'Body text');
    await flush(300);

    expect(consoleErrorSpy).toHaveBeenCalled();

    const stored = await pool.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1',
      [optIn.id],
    );
    expect(Number(stored.rows[0].count)).toBe(0);
  });

  // Local helper so the sseManager fake is available in this block too.
  function fakeStreamFor() {
    return {
      written: [],
      write(chunk) {
        this.written.push(chunk);
        return true;
      },
      end() {},
    };
  }
});
