process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn: '1h',
  });
}

async function insertUser(username, email) {
  const result = await pool.query(
    `INSERT INTO users (username, email, password)
     VALUES ($1, $2, $3)
     RETURNING id, username, email`,
    [username, email, 'not-used-in-tests'],
  );
  return result.rows[0];
}

beforeAll(async () => {
  await pool.query(`DELETE FROM users WHERE username LIKE 'it_%'`);
});

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM users WHERE username LIKE 'it_%'`);
  } catch (_) {
    // best-effort cleanup; pool may be in a teardown state
  }
  try {
    await pool.end();
  } catch (_) {
    // ignore
  }
});

// ── GET /api/users/:userId/public ─────────────────────────────────────────────

describe('GET /api/users/:userId/public', () => {
  test('returns 200 with public profile for existing user', async () => {
    const user = await insertUser('it_pub_alice', 'it_pub_alice@example.com');
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', user.id);
    expect(res.body).toHaveProperty('username', 'it_pub_alice');
  });

  test('returns 404 for non-existent user', async () => {
    const res = await request(app).get('/api/users/9999999/public');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  // Invalid partition: non-numeric id fails the u.id integer cast in Postgres
  test('returns 500 for a non-numeric user id', async () => {
    const res = await request(app).get('/api/users/not-a-number/public');
    expect(res.status).toBe(500);
  });

  test('returned profile has listing_count field', async () => {
    const user = await insertUser('it_pub_bob', 'it_pub_bob@example.com');
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(res.body).toHaveProperty('listing_count');
  });

  test('returned profile has created_on field', async () => {
    const user = await insertUser('it_pub_carol', 'it_pub_carol@example.com');
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(res.body).toHaveProperty('created_on');
  });

  test('listing_count is 0 when user has no listings', async () => {
    const user = await insertUser('it_pub_dave', 'it_pub_dave@example.com');
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(Number(res.body.listing_count)).toBe(0);
  });

  test('profile_image is null when user has no icon', async () => {
    const user = await insertUser('it_pub_eve', 'it_pub_eve@example.com');
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(res.body.profile_image).toBeNull();
  });

  test('does not expose email or password in public profile', async () => {
    const user = await insertUser('it_pub_frank', 'it_pub_frank@example.com');
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(res.body).not.toHaveProperty('email');
    expect(res.body).not.toHaveProperty('password');
  });

  test('does not require Authorization header', async () => {
    const user = await insertUser('it_pub_grace', 'it_pub_grace@example.com');
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(res.status).toBe(200);
  });

  test('listing_count increases when user has AVAILABLE listing', async () => {
    const user = await insertUser('it_pub_henry', 'it_pub_henry@example.com');
    await pool.query(
      `INSERT INTO listings (owner_id, title, description, price, category, status)
       VALUES ($1, 'Test Listing', 'desc', 50, 'Electronics', 'AVAILABLE')`,
      [user.id],
    );
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(Number(res.body.listing_count)).toBe(1);
  });

  test('listing_count excludes ARCHIVED listings', async () => {
    const user = await insertUser('it_pub_ivan', 'it_pub_ivan@example.com');
    await pool.query(
      `INSERT INTO listings (owner_id, title, description, price, category, status, "isSold", "isClosed")
       VALUES ($1, 'Archived Listing', 'desc', 50, 'Electronics', 'ARCHIVED', false, true)`,
      [user.id],
    );
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(Number(res.body.listing_count)).toBe(0);
  });
});

// ── GET /api/users/:userId/reviews ────────────────────────────────────────────

describe('GET /api/users/:userId/reviews', () => {
  test('returns 200 with array for existing user', async () => {
    const user = await insertUser('it_rev_alice', 'it_rev_alice@example.com');
    const res = await request(app).get(`/api/users/${user.id}/reviews`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('returns empty array when user has no reviews', async () => {
    const user = await insertUser('it_rev_bob', 'it_rev_bob@example.com');
    const res = await request(app).get(`/api/users/${user.id}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test('returns 200 even for non-existent user (empty array)', async () => {
    const res = await request(app).get('/api/users/9999999/reviews');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Invalid partition: non-numeric id fails the l.owner_id integer cast in Postgres
  test('returns 500 for a non-numeric user id', async () => {
    const res = await request(app).get('/api/users/not-a-number/reviews');
    expect(res.status).toBe(500);
  });

  test('does not require Authorization header', async () => {
    const user = await insertUser('it_rev_carol', 'it_rev_carol@example.com');
    const res = await request(app).get(`/api/users/${user.id}/reviews`);
    expect(res.status).toBe(200);
  });
});

// ── GET /api/me ───────────────────────────────────────────────────────────────

describe('GET /api/me', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });

  test('returns 401 for invalid token', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer bad.token.here');
    expect(res.status).toBe(401);
  });

  test('returns 200 with user data for valid token', async () => {
    const user = await insertUser('it_me_alice', 'it_me_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', user.id);
    expect(res.body).toHaveProperty('username', 'it_me_alice');
  });

  test('returned user has email field', async () => {
    const user = await insertUser('it_me_bob', 'it_me_bob@example.com');
    const token = createToken(user.id);
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveProperty('email', 'it_me_bob@example.com');
  });

  test('returns 404 for non-existent user with valid token', async () => {
    const fakeToken = createToken(99999999);
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${fakeToken}`);
    expect(res.status).toBe(404);
  });

  // Invalid partition: jwtMiddleware trusts the userId claim's type as-is, so a
  // token whose claim isn't numeric fails the id integer cast in Postgres
  // rather than jwtMiddleware itself rejecting it.
  test('returns 500 when the token userId claim is not numeric', async () => {
    const badToken = createToken('not-a-number');
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(500);
  });

  test('does not expose password in response', async () => {
    const user = await insertUser('it_me_carol', 'it_me_carol@example.com');
    const token = createToken(user.id);
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.body).not.toHaveProperty('password');
  });
});

// ── GET /api/me/settings ──────────────────────────────────────────────────────

describe('GET /api/me/settings', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/me/settings');
    expect(res.status).toBe(401);
  });

  test('returns 200 with settings for authenticated user', async () => {
    const user = await insertUser('it_set_alice', 'it_set_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app).get('/api/me/settings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('returns 500 when the token userId claim is not numeric', async () => {
    const badToken = createToken('not-a-number');
    const res = await request(app)
      .get('/api/me/settings')
      .set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(500);
  });

  test('settings response includes currency field', async () => {
    const user = await insertUser('it_set_bob', 'it_set_bob@example.com');
    const token = createToken(user.id);
    const res = await request(app).get('/api/me/settings').set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveProperty('currency');
  });

  test('returns 404 for non-existent user token', async () => {
    const fakeToken = createToken(99999999);
    const res = await request(app)
      .get('/api/me/settings')
      .set('Authorization', `Bearer ${fakeToken}`);
    expect(res.status).toBe(404);
  });
});

// ── PUT /api/me/settings ──────────────────────────────────────────────────────

describe('PUT /api/me/settings', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).put('/api/me/settings').send({ currency: 'SGD' });
    expect(res.status).toBe(401);
  });

  test('returns 200 when updating settings', async () => {
    const user = await insertUser('it_uset_alice', 'it_uset_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'SGD', theme: 'dark' });
    expect(res.status).toBe(200);
  });

  test('returns 500 when the token userId claim is not numeric', async () => {
    const badToken = createToken('not-a-number');
    const res = await request(app)
      .put('/api/me/settings')
      .set('Authorization', `Bearer ${badToken}`)
      .send({ currency: 'SGD' });
    expect(res.status).toBe(500);
  });

  test('updated settings are returned in response', async () => {
    const user = await insertUser('it_uset_bob', 'it_uset_bob@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'EUR' });
    expect(res.body).toHaveProperty('currency', 'EUR');
  });

  test('returns 200 when sending empty body (defaults apply)', async () => {
    const user = await insertUser('it_uset_carol', 'it_uset_carol@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
  });
});

// ── PUT /api/me/profile ───────────────────────────────────────────────────────

describe('PUT /api/me/profile', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).put('/api/me/profile').send({ displayName: 'Alice' });
    expect(res.status).toBe(401);
  });

  test('returns 200 when updating display name', async () => {
    const user = await insertUser('it_prof_alice', 'it_prof_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Alice Wonder' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Display name updated.');
  });

  test('returns 200 when displayName is omitted', async () => {
    const user = await insertUser('it_prof_bob', 'it_prof_bob@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
  });
});

// ── DELETE /api/me/profile-image ──────────────────────────────────────────────

describe('DELETE /api/me/profile-image', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).delete('/api/me/profile-image');
    expect(res.status).toBe(401);
  });

  test('returns 200 when clearing profile image', async () => {
    const user = await insertUser('it_img_alice', 'it_img_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .delete('/api/me/profile-image')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Profile image removed.');
  });

  test('returns 200 even when user had no profile image', async () => {
    const user = await insertUser('it_img_bob', 'it_img_bob@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .delete('/api/me/profile-image')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ── PUT /api/me/notifications ─────────────────────────────────────────────────

describe('PUT /api/me/notifications', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).put('/api/me/notifications').send({});
    expect(res.status).toBe(401);
  });

  test('returns 200 when updating notification preferences', async () => {
    const user = await insertUser('it_notif_alice', 'it_notif_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({ notifyOrders: true, notifyPromotions: false });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Notification preferences updated.');
  });

  test('returns 200 with empty body (defaults apply)', async () => {
    const user = await insertUser('it_notif_bob', 'it_notif_bob@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
  });
});

// ── DELETE /api/me ────────────────────────────────────────────────────────────

describe('DELETE /api/me', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).delete('/api/me');
    expect(res.status).toBe(401);
  });

  test('returns 200 when deleting own account', async () => {
    const user = await insertUser('it_del_alice', 'it_del_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app).delete('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Account deleted.');
  });

  test('user no longer accessible via GET /api/me after deletion', async () => {
    const user = await insertUser('it_del_bob', 'it_del_bob@example.com');
    const token = createToken(user.id);
    await request(app).delete('/api/me').set('Authorization', `Bearer ${token}`);
    const meRes = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(404);
  });

  test('user no longer in public profile after deletion', async () => {
    const user = await insertUser('it_del_carol', 'it_del_carol@example.com');
    const token = createToken(user.id);
    await request(app).delete('/api/me').set('Authorization', `Bearer ${token}`);
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(res.status).toBe(404);
  });
});

// ── POST /api/register ────────────────────────────────────────────────────────

describe('POST /api/register', () => {
  test('returns 400 when username is missing', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ email: 'reg_a@example.com', password: 'secret1' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'it_reg_nomail', password: 'secret1' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'it_reg_nopass', email: 'it_reg_nopass@example.com' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'it_reg_short', email: 'it_reg_short@example.com', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('6');
  });

  test('returns 201 on successful registration', async () => {
    const res = await request(app).post('/api/register').send({
      username: 'it_reg_new1',
      email: 'it_reg_new1@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message');
  });

  test('returns 409 when username is already taken', async () => {
    await request(app).post('/api/register').send({
      username: 'it_reg_taken',
      email: 'it_reg_taken1@example.com',
      password: 'secret123',
    });
    const res = await request(app).post('/api/register').send({
      username: 'it_reg_taken',
      email: 'it_reg_taken2@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Username');
  });

  test('returns 409 when email is already taken', async () => {
    await request(app).post('/api/register').send({
      username: 'it_reg_email1',
      email: 'it_reg_dupemail@example.com',
      password: 'secret123',
    });
    const res = await request(app).post('/api/register').send({
      username: 'it_reg_email2',
      email: 'it_reg_dupemail@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Email');
  });

  test('password boundary: exactly 6 characters is accepted', async () => {
    const res = await request(app).post('/api/register').send({
      username: 'it_reg_bound6',
      email: 'it_reg_bound6@example.com',
      password: '123456',
    });
    expect(res.status).toBe(201);
  });

  test('password boundary: exactly 5 characters is rejected', async () => {
    const res = await request(app).post('/api/register').send({
      username: 'it_reg_bound5',
      email: 'it_reg_bound5@example.com',
      password: '12345',
    });
    expect(res.status).toBe(400);
  });
});

// ── POST /api/login ───────────────────────────────────────────────────────────

describe('POST /api/login', () => {
  test('returns 400 when username is missing', async () => {
    const res = await request(app).post('/api/login').send({ password: 'pass' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when password is missing', async () => {
    const res = await request(app).post('/api/login').send({ username: 'alice' });
    expect(res.status).toBe(400);
  });

  test('returns 404 for non-existent username', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'it_no_such_user_xyz', password: 'pass' });
    expect(res.status).toBe(404);
  });

  test('returns token on successful login after registration', async () => {
    await request(app).post('/api/register').send({
      username: 'it_login_user1',
      email: 'it_login_user1@example.com',
      password: 'pass123',
    });
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'it_login_user1', password: 'pass123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('returns 401 for wrong password', async () => {
    await request(app).post('/api/register').send({
      username: 'it_login_wrong',
      email: 'it_login_wrong@example.com',
      password: 'correct123',
    });
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'it_login_wrong', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('token is a non-empty string', async () => {
    await request(app).post('/api/register').send({
      username: 'it_login_tok',
      email: 'it_login_tok@example.com',
      password: 'pass123',
    });
    const res = await request(app)
      .post('/api/login')
      .send({ username: 'it_login_tok', password: 'pass123' });
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
  });
});

// ── POST /api/logout ──────────────────────────────────────────────────────────

describe('POST /api/logout', () => {
  test('returns 200 even without a refresh token cookie', async () => {
    const res = await request(app).post('/api/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out.');
  });
});

// ── PUT /api/me/password ──────────────────────────────────────────────────────

describe('PUT /api/me/password', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .put('/api/me/password')
      .send({ currentPassword: 'old', newPassword: 'newpass1' });
    expect(res.status).toBe(401);
  });

  test('returns 400 when currentPassword is missing', async () => {
    const user = await insertUser('it_pw_alice', 'it_pw_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'newpass1' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when newPassword is missing', async () => {
    const user = await insertUser('it_pw_bob', 'it_pw_bob@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'old' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when newPassword is too short', async () => {
    const user = await insertUser('it_pw_carol', 'it_pw_carol@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'old', newPassword: '123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('6');
  });
});
