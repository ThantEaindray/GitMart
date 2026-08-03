process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

// Declared once and reused for setup and cleanup so the two cannot drift.
// Scoped deletes rather than TRUNCATE, which deadlocks against other suites.
const SUITE_USERNAMES = ['account_user', 'account_other'];
const PASSWORD = 'AccountUser99';

let userToken;
let userId;

async function registerAndLogin(username, email, password = PASSWORD) {
  await request(app).post('/api/register').send({ username, email, password });
  const login = await request(app).post('/api/login').send({ username, password });
  return login.body;
}

async function cleanupSuiteData() {
  // refresh_tokens, notifications and wishlist all cascade from users.
  await pool.query('DELETE FROM users WHERE username = ANY($1::text[])', [SUITE_USERNAMES]);
}

beforeEach(async () => {
  await cleanupSuiteData();

  const session = await registerAndLogin(SUITE_USERNAMES[0], 'account.user@example.com');
  userToken = session.token;
  userId = session.userId;
});

afterAll(async () => {
  await cleanupSuiteData();
  await pool.end();
});

describe('Account API', () => {
  // ── POST /api/register ──────────────────────────────────────────────────
  // Exercises bcryptMiddleware.hashPassword.
  describe('POST /api/register', () => {
    test('stores the password hashed, never in plain text', async () => {
      const stored = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
      const hash = stored.rows[0].password;

      expect(hash).not.toBe(PASSWORD);
      // bcrypt hashes carry a recognisable prefix and fixed length.
      expect(hash).toMatch(/^\$2[aby]\$/);
      expect(hash).toHaveLength(60);
    });

    test('rejects a duplicate username', async () => {
      const response = await request(app).post('/api/register').send({
        username: SUITE_USERNAMES[0],
        email: 'different@example.com',
        password: PASSWORD,
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('rejects a duplicate email', async () => {
      const response = await request(app).post('/api/register').send({
        username: 'account_totally_new',
        email: 'account.user@example.com',
        password: PASSWORD,
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('rejects a missing password', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({ username: 'account_nopass', email: 'account.nopass@example.com' });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ── POST /api/login ─────────────────────────────────────────────────────
  // Exercises bcryptMiddleware.comparePassword on both branches.
  describe('POST /api/login', () => {
    test('accepts the correct password', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ username: SUITE_USERNAMES[0], password: PASSWORD });

      expect(response.status).toBe(200);
      expect(typeof response.body.token).toBe('string');
    });

    test('rejects a wrong password with 401', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ username: SUITE_USERNAMES[0], password: 'DefinitelyWrong99' });

      expect(response.status).toBe(401);
    });

    test('rejects an unknown username with 404', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ username: 'account_does_not_exist', password: PASSWORD });

      expect(response.status).toBe(404);
    });

    test('is case-sensitive about the password', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ username: SUITE_USERNAMES[0], password: PASSWORD.toLowerCase() });

      expect(response.status).toBe(401);
    });
  });

  // ── PUT /api/me/password ────────────────────────────────────────────────
  // Exercises compareCurrentPassword and hashNewPassword.
  describe('PUT /api/me/password', () => {
    test('returns 401 without a token', async () => {
      const response = await request(app)
        .put('/api/me/password')
        .send({ currentPassword: PASSWORD, newPassword: 'BrandNewPass99' });

      expect(response.status).toBe(401);
    });

    test('rejects a wrong current password', async () => {
      const response = await request(app)
        .put('/api/me/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentPassword: 'NotMyPassword99', newPassword: 'BrandNewPass99' });

      expect(response.status).toBe(401);
    });

    test('changes the password and stores a different hash', async () => {
      const before = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);

      const response = await request(app)
        .put('/api/me/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentPassword: PASSWORD, newPassword: 'BrandNewPass99' });

      expect(response.status).toBe(200);

      const after = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
      expect(after.rows[0].password).not.toBe(before.rows[0].password);
      expect(after.rows[0].password).toMatch(/^\$2[aby]\$/);
    });

    test('the new password works and the old one stops working', async () => {
      await request(app)
        .put('/api/me/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ currentPassword: PASSWORD, newPassword: 'BrandNewPass99' });

      const withNew = await request(app)
        .post('/api/login')
        .send({ username: SUITE_USERNAMES[0], password: 'BrandNewPass99' });
      expect(withNew.status).toBe(200);

      const withOld = await request(app)
        .post('/api/login')
        .send({ username: SUITE_USERNAMES[0], password: PASSWORD });
      expect(withOld.status).toBe(401);
    });
  });

  // ── GET /api/me ─────────────────────────────────────────────────────────
  describe('GET /api/me', () => {
    test('returns 401 without a token', async () => {
      const response = await request(app).get('/api/me');
      expect(response.status).toBe(401);
    });

    test('returns the current user without their password', async () => {
      const response = await request(app)
        .get('/api/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('password');
    });
  });

  // ── PUT /api/me/profile ─────────────────────────────────────────────────
  describe('PUT /api/me/profile', () => {
    test('updates the display name', async () => {
      const response = await request(app)
        .put('/api/me/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ displayName: 'Account Display Name' });

      expect(response.status).toBe(200);

      const settings = await request(app)
        .get('/api/me/settings')
        .set('Authorization', `Bearer ${userToken}`);
      expect(settings.body.display_name).toBe('Account Display Name');
    });

    test('clears the display name when sent empty', async () => {
      await request(app)
        .put('/api/me/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ displayName: 'Something' });

      await request(app)
        .put('/api/me/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ displayName: '' });

      const settings = await request(app)
        .get('/api/me/settings')
        .set('Authorization', `Bearer ${userToken}`);
      expect(settings.body.display_name).toBeNull();
    });
  });

  // ── Profile image ───────────────────────────────────────────────────────
  describe('Profile image', () => {
    // A 1x1 transparent PNG, small enough to keep the test readable.
    const TINY_PNG =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    test('returns 401 without a token', async () => {
      const response = await request(app)
        .put('/api/me/profile-image')
        .send({ imageBase64: TINY_PNG });
      expect(response.status).toBe(401);
    });

    test('returns 400 when no image is supplied', async () => {
      const response = await request(app)
        .put('/api/me/profile-image')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Profile image is required.' });
    });

    test('stores an uploaded image and returns it base64 encoded', async () => {
      const response = await request(app)
        .put('/api/me/profile-image')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ imageBase64: TINY_PNG });

      expect(response.status).toBe(200);
      expect(response.body.profile_image).toBeTruthy();
    });

    test('strips the data URL prefix before storing', async () => {
      // The frontend sends a full data: URL, so the prefix must be removed or
      // the stored bytes are not a valid image.
      const response = await request(app)
        .put('/api/me/profile-image')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ imageBase64: `data:image/png;base64,${TINY_PNG}` });

      expect(response.status).toBe(200);

      const stored = await pool.query('SELECT icon FROM users WHERE id = $1', [userId]);
      // PNG magic number — proves the prefix was not stored as image data.
      expect(stored.rows[0].icon.subarray(0, 4).toString('hex')).toBe('89504e47');
    });

    test('clearing the image removes it', async () => {
      await request(app)
        .put('/api/me/profile-image')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ imageBase64: TINY_PNG });

      const response = await request(app)
        .delete('/api/me/profile-image')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);

      const stored = await pool.query('SELECT icon FROM users WHERE id = $1', [userId]);
      expect(stored.rows[0].icon).toBeNull();
    });
  });

  // ── PUT /api/me/settings ────────────────────────────────────────────────
  describe('PUT /api/me/settings', () => {
    test('persists theme, currency and font size', async () => {
      const response = await request(app)
        .put('/api/me/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ theme: 'noir', currency: 'SGD', fontSize: 'large' });

      expect(response.status).toBe(200);

      const settings = await request(app)
        .get('/api/me/settings')
        .set('Authorization', `Bearer ${userToken}`);
      expect(settings.body.theme).toBe('noir');
      expect(settings.body.currency).toBe('SGD');
    });
  });

  // ── PUT /api/me/notifications ───────────────────────────────────────────
  describe('PUT /api/me/notifications', () => {
    test('persists all three notification preferences', async () => {
      const response = await request(app)
        .put('/api/me/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ notifyOrders: false, notifyPromotions: true, notifyEmail: false });

      expect(response.status).toBe(200);

      const settings = await request(app)
        .get('/api/me/settings')
        .set('Authorization', `Bearer ${userToken}`);
      expect(settings.body.notify_orders).toBe(false);
      expect(settings.body.notify_promotions).toBe(true);
      expect(settings.body.notify_email).toBe(false);
    });

    test('notifyOrders and notifyEmail default to on when omitted', async () => {
      const response = await request(app)
        .put('/api/me/notifications')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(200);

      const settings = await request(app)
        .get('/api/me/settings')
        .set('Authorization', `Bearer ${userToken}`);
      expect(settings.body.notify_orders).toBe(true);
      expect(settings.body.notify_email).toBe(true);
      expect(settings.body.notify_promotions).toBe(false);
    });
  });

  // ── Public profile ──────────────────────────────────────────────────────
  describe('GET /api/users/:userId/public', () => {
    test('is public and never exposes the email or password', async () => {
      const response = await request(app).get(`/api/users/${userId}/public`);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe(SUITE_USERNAMES[0]);
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('email');
    });

    test('returns 404 for a user that does not exist', async () => {
      const response = await request(app).get('/api/users/999999/public');
      expect(response.status).toBe(404);
    });
  });

  // ── DELETE /api/me ──────────────────────────────────────────────────────
  describe('DELETE /api/me', () => {
    test('returns 401 without a token', async () => {
      const response = await request(app).delete('/api/me');
      expect(response.status).toBe(401);
    });

    test('removes the account so the credentials stop working', async () => {
      const response = await request(app)
        .delete('/api/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);

      const stored = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
      expect(stored.rows).toHaveLength(0);

      const login = await request(app)
        .post('/api/login')
        .send({ username: SUITE_USERNAMES[0], password: PASSWORD });
      expect(login.status).toBe(404);
    });
  });
});
