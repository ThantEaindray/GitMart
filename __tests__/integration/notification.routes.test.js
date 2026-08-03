process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

const http = require('http');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

// Declared once and reused for setup and cleanup so the two cannot drift.
// Scoped deletes rather than TRUNCATE: TRUNCATE takes ACCESS EXCLUSIVE locks on
// every table listed and deadlocks against the other integration suites.
const SUITE_USERNAMES = ['notif_owner', 'notif_other'];

let owner;
let otherUser;
let ownerToken;
let otherUserToken;

function createAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn: '1h',
  });
}

async function insertUser(username, email) {
  const result = await pool.query(
    `
      INSERT INTO users (username, email, password)
      VALUES ($1, $2, $3)
      RETURNING id, username, email
    `,
    [username, email, 'not-used-by-these-tests'],
  );
  return result.rows[0];
}

async function insertNotification({ userId, type = 'system', title = 'T', message = 'M' }) {
  const result = await pool.query(
    `
      INSERT INTO notifications (user_id, type, title, message)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, type, title, message, is_read, created_on
    `,
    [userId, type, title, message],
  );
  return result.rows[0];
}

// notifications cascade from users, so removing the users is enough.
async function cleanupSuiteData() {
  await pool.query('DELETE FROM users WHERE username = ANY($1::text[])', [SUITE_USERNAMES]);
}

beforeEach(async () => {
  await cleanupSuiteData();

  owner = await insertUser(SUITE_USERNAMES[0], 'notif.owner@example.com');
  otherUser = await insertUser(SUITE_USERNAMES[1], 'notif.other@example.com');

  ownerToken = createAccessToken(owner.id);
  otherUserToken = createAccessToken(otherUser.id);
});

afterAll(async () => {
  await cleanupSuiteData();
  await pool.end();
});

describe('Notification API', () => {
  // ── GET /api/notifications ──────────────────────────────────────────────
  describe('GET /api/notifications', () => {
    test('returns 401 without a token', async () => {
      const response = await request(app).get('/api/notifications');
      expect(response.status).toBe(401);
    });

    test('returns an empty array when the user has none', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('returns the user notifications in the frontend shape', async () => {
      await insertNotification({
        userId: owner.id,
        type: 'reservation',
        title: 'New reservation request',
        message: 'bob wants your Watch.',
      });

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toEqual(
        expect.objectContaining({
          type: 'reservation',
          title: 'New reservation request',
          message: 'bob wants your Watch.',
          isRead: false,
          icon: 'bi-calendar-check',
        }),
      );
      expect(typeof response.body[0].createdAt).toBe('string');
    });

    test('never returns another user notifications', async () => {
      await insertNotification({ userId: otherUser.id, title: 'Not yours' });

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('returns newest first', async () => {
      await insertNotification({ userId: owner.id, title: 'Older' });
      await insertNotification({ userId: owner.id, title: 'Newer' });

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.body.map((n) => n.title)).toEqual(['Newer', 'Older']);
    });

    test('falls back to a default icon for a type with no mapping', async () => {
      await insertNotification({ userId: owner.id, type: 'wishlist' });

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.body[0].icon).toBe('bi-heart');
    });
  });

  // ── GET /api/notifications/unread-count ────────────────────────────────
  describe('GET /api/notifications/unread-count', () => {
    test('returns 401 without a token', async () => {
      const response = await request(app).get('/api/notifications/unread-count');
      expect(response.status).toBe(401);
    });

    test('returns zero as a number, not a string', async () => {
      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      // COUNT(*) is a bigint and node-postgres returns bigint as a string, so
      // this asserts the controller converts it before responding.
      expect(response.body).toEqual({ count: 0 });
      expect(typeof response.body.count).toBe('number');
    });

    test('counts only unread notifications belonging to that user', async () => {
      await insertNotification({ userId: owner.id });
      const read = await insertNotification({ userId: owner.id });
      await insertNotification({ userId: otherUser.id });

      await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [read.id]);

      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.body).toEqual({ count: 1 });
    });
  });

  // ── PATCH /api/notifications/:id/read ──────────────────────────────────
  describe('PATCH /api/notifications/:id/read', () => {
    test('returns 401 without a token', async () => {
      const response = await request(app).patch('/api/notifications/1/read');
      expect(response.status).toBe(401);
    });

    test('returns 400 for a non-numeric id', async () => {
      const response = await request(app)
        .patch('/api/notifications/not-a-number/read')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Notification ID must be a positive integer.',
      });
    });

    test('marks the notification read and returns it', async () => {
      const notification = await insertNotification({ userId: owner.id });

      const response = await request(app)
        .patch(`/api/notifications/${notification.id}/read`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.isRead).toBe(true);

      const stored = await pool.query('SELECT is_read FROM notifications WHERE id = $1', [
        notification.id,
      ]);
      expect(stored.rows[0].is_read).toBe(true);
    });

    test('returns 404 when the notification belongs to someone else', async () => {
      const notification = await insertNotification({ userId: otherUser.id });

      const response = await request(app)
        .patch(`/api/notifications/${notification.id}/read`)
        .set('Authorization', `Bearer ${ownerToken}`);

      // 404 rather than 403 so this cannot be used to probe which ids exist.
      expect(response.status).toBe(404);

      const stored = await pool.query('SELECT is_read FROM notifications WHERE id = $1', [
        notification.id,
      ]);
      expect(stored.rows[0].is_read).toBe(false);
    });

    test('returns 404 for an id that does not exist', async () => {
      const response = await request(app)
        .patch('/api/notifications/999999/read')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ── PATCH /api/notifications/read-all ──────────────────────────────────
  describe('PATCH /api/notifications/read-all', () => {
    test('returns 401 without a token', async () => {
      const response = await request(app).patch('/api/notifications/read-all');
      expect(response.status).toBe(401);
    });

    test('marks every notification for that user read', async () => {
      await insertNotification({ userId: owner.id });
      await insertNotification({ userId: owner.id });

      const response = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);

      const stored = await pool.query(
        'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false',
        [owner.id],
      );
      expect(Number(stored.rows[0].count)).toBe(0);
    });

    test('leaves other users notifications untouched', async () => {
      await insertNotification({ userId: otherUser.id });

      await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${ownerToken}`);

      const stored = await pool.query(
        'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false',
        [otherUser.id],
      );
      expect(Number(stored.rows[0].count)).toBe(1);
    });

    test('succeeds when there is nothing to mark', async () => {
      const response = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
    });
  });

  // ── GET /api/notifications/stream ──────────────────────────────────────
  // Supertest cannot drive this: the response never ends by design. A real
  // server is started, the first event read off the socket, then torn down.
  describe('GET /api/notifications/stream', () => {
    let server;
    let baseUrl;

    beforeEach(async () => {
      await new Promise((resolve) => {
        server = app.listen(0, resolve);
      });
      baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    afterEach(async () => {
      // server.close() only stops new connections; it waits on existing ones.
      // The SSE handler holds its socket open indefinitely and runs a 20s
      // keep-alive interval, so the sockets are dropped explicitly or Jest
      // never exits.
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      // Give the server's 'close' handler a tick to clear the keep-alive timer.
      await new Promise((resolve) => setImmediate(resolve));
    });

    function openStream(url) {
      return new Promise((resolve, reject) => {
        // The guard timer must be cleared on every exit path, or it stays
        // pending for 5s and Jest reports it as an open handle.
        let guard;

        const settle = (fn, value) => {
          clearTimeout(guard);
          fn(value);
        };

        const req = http.get(url, (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk.toString();
            // The init event arrives immediately; stop as soon as it is seen.
            if (body.includes('\n\n')) {
              req.destroy();
              settle(resolve, { status: res.statusCode, headers: res.headers, body });
            }
          });
          res.on('error', () => {
            /* socket destroyed by us */
          });
        });

        req.on('error', (error) => {
          if (error.code !== 'ECONNRESET') settle(reject, error);
        });

        guard = setTimeout(() => {
          req.destroy();
          reject(new Error('stream did not send an event in time'));
        }, 5000);
      });
    }

    test('rejects a request with no token', async () => {
      const response = await request(app).get('/api/notifications/stream');
      expect(response.status).toBe(401);
    });

    test('accepts the token as a query param because EventSource cannot set headers', async () => {
      const result = await openStream(
        `${baseUrl}/api/notifications/stream?token=${encodeURIComponent(ownerToken)}`,
      );

      expect(result.status).toBe(200);
      expect(result.headers['content-type']).toContain('text/event-stream');
      expect(result.headers['cache-control']).toContain('no-cache');
    });

    test('sends the current unread count in the init event', async () => {
      await insertNotification({ userId: owner.id });
      await insertNotification({ userId: owner.id });

      const result = await openStream(
        `${baseUrl}/api/notifications/stream?token=${encodeURIComponent(ownerToken)}`,
      );

      expect(result.body).toContain('event: init');
      expect(result.body).toContain('"unreadCount":2');
    });

    test('rejects an invalid token passed as a query param', async () => {
      const response = await request(app).get('/api/notifications/stream?token=not-a-real-token');
      expect(response.status).toBe(401);
    });
  });
});
