process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'integration-test-refresh-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

// Declared once and reused for setup and cleanup so the two cannot drift.
// Scoped deletes rather than TRUNCATE, which deadlocks against other suites.
const SUITE_USERNAMES = ['refresh_user'];
const PASSWORD = 'RefreshUser99';

// Pulls the refreshToken cookie out of a Set-Cookie header list.
function readRefreshCookie(response) {
  const cookies = response.headers['set-cookie'] || [];
  const cookie = cookies.find((c) => c.startsWith('refreshToken='));
  return cookie ? cookie.split(';')[0] : null;
}

async function registerAndLogin({ rememberMe = false } = {}) {
  await request(app).post('/api/register').send({
    username: SUITE_USERNAMES[0],
    email: 'refresh.user@example.com',
    password: PASSWORD,
  });

  return request(app)
    .post('/api/login')
    .send({ username: SUITE_USERNAMES[0], password: PASSWORD, rememberMe });
}

async function cleanupSuiteData() {
  // refresh_tokens cascade from users.
  await pool.query('DELETE FROM users WHERE username = ANY($1::text[])', [SUITE_USERNAMES]);
}

beforeEach(async () => {
  await cleanupSuiteData();
});

afterAll(async () => {
  await cleanupSuiteData();
  await pool.end();
});

describe('POST /api/refresh', () => {
  test('returns 401 when no refresh cookie is sent', async () => {
    const response = await request(app).post('/api/refresh');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'No refresh token' });
  });

  test('returns 401 for a malformed refresh cookie', async () => {
    const response = await request(app)
      .post('/api/refresh')
      .set('Cookie', 'refreshToken=not-a-real-token');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid refresh token' });
  });

  test('returns 401 for a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ userId: 1 }, 'the-wrong-secret', { expiresIn: '1h' });

    const response = await request(app)
      .post('/api/refresh')
      .set('Cookie', `refreshToken=${forged}`);

    expect(response.status).toBe(401);
  });

  test('login issues an httpOnly refresh cookie', async () => {
    const login = await registerAndLogin();

    expect(login.status).toBe(200);
    const cookies = login.headers['set-cookie'] || [];
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));

    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('SameSite=Strict');
  });

  test('exchanges a valid refresh cookie for a new access token', async () => {
    const login = await registerAndLogin();
    const cookie = readRefreshCookie(login);

    const response = await request(app).post('/api/refresh').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe('string');
    // The new access token must actually verify against the access secret.
    const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET_KEY);
    expect(decoded.userId).toBe(login.body.userId);
  });

  test('rotates the refresh token, issuing a different one', async () => {
    const login = await registerAndLogin();
    const originalCookie = readRefreshCookie(login);

    const response = await request(app).post('/api/refresh').set('Cookie', originalCookie);
    const rotatedCookie = readRefreshCookie(response);

    expect(rotatedCookie).toBeDefined();
    expect(rotatedCookie).not.toBe(originalCookie);
  });

  test('rejects reuse of a refresh token that has already been rotated', async () => {
    const login = await registerAndLogin();
    const originalCookie = readRefreshCookie(login);

    await request(app).post('/api/refresh').set('Cookie', originalCookie);

    // Replaying the old cookie is treated as possible theft.
    const replay = await request(app).post('/api/refresh').set('Cookie', originalCookie);

    expect(replay.status).toBe(401);
    expect(replay.body.error).toContain('Session invalidated');
  });

  test('reusing a rotated token revokes every session for that user', async () => {
    const login = await registerAndLogin();
    const originalCookie = readRefreshCookie(login);

    const rotated = await request(app).post('/api/refresh').set('Cookie', originalCookie);
    const rotatedCookie = readRefreshCookie(rotated);

    // Replay the old one — this should nuke all sessions, including the good one.
    await request(app).post('/api/refresh').set('Cookie', originalCookie);

    const afterRevocation = await request(app).post('/api/refresh').set('Cookie', rotatedCookie);

    expect(afterRevocation.status).toBe(401);
  });

  test('every row is already gone by the time the revocation response returns', async () => {
    // Regression guard for a race: deleteAllRefreshTokensForUser used to be
    // fired with a no-op callback and the 401 sent immediately, so a request
    // landing right after this one could still find a live row. The handler
    // now waits on the delete's own callback before responding, so by the
    // time this request resolves, the deletion is guaranteed to have already
    // committed — checked here with no artificial delay.
    const login = await registerAndLogin();
    const originalCookie = readRefreshCookie(login);

    await request(app).post('/api/refresh').set('Cookie', originalCookie);
    const replay = await request(app).post('/api/refresh').set('Cookie', originalCookie);

    expect(replay.status).toBe(401);

    const stored = await pool.query(
      'SELECT COUNT(*) AS count FROM refresh_tokens WHERE user_id = $1',
      [login.body.userId],
    );
    expect(Number(stored.rows[0].count)).toBe(0);
  });

  test('rememberMe true produces a persistent cookie with an expiry', async () => {
    const login = await registerAndLogin({ rememberMe: true });
    const cookies = login.headers['set-cookie'] || [];
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));

    // A persistent cookie carries Max-Age or Expires; a session cookie does not.
    expect(refreshCookie).toMatch(/Max-Age|Expires/);
  });

  test('rememberMe false produces a session cookie with no expiry', async () => {
    const login = await registerAndLogin({ rememberMe: false });
    const cookies = login.headers['set-cookie'] || [];
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));

    expect(refreshCookie).not.toMatch(/Max-Age|Expires/);
  });

  test('returns 401 once the stored token has expired', async () => {
    const login = await registerAndLogin();
    const cookie = readRefreshCookie(login);

    // Backdate the stored expiry rather than waiting for it.
    await pool.query(
      `UPDATE refresh_tokens SET expires_at = NOW() - INTERVAL '1 day'
       WHERE user_id = $1`,
      [login.body.userId],
    );

    const response = await request(app).post('/api/refresh').set('Cookie', cookie);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Refresh token expired' });
  });
});

describe('POST /api/logout', () => {
  test('revokes the refresh token so it can no longer be exchanged', async () => {
    const login = await registerAndLogin();
    const cookie = readRefreshCookie(login);

    const logout = await request(app).post('/api/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);

    const afterLogout = await request(app).post('/api/refresh').set('Cookie', cookie);
    expect(afterLogout.status).toBe(401);
  });

  test('succeeds even with no refresh cookie present', async () => {
    const response = await request(app).post('/api/logout');
    expect(response.status).toBe(200);
  });
});
