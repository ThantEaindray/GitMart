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

beforeEach(async () => {
  await pool.query(`
    TRUNCATE TABLE
      chatcontent,
      offers,
      chats,
      listing_views,
      listings,
      refresh_tokens,
      users
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await pool.end();
});

// ── GET /api/users/:userId/public ─────────────────────────────────────────────

describe('GET /api/users/:userId/public', () => {
  test('returns 200 with public profile for existing user', async () => {
    const user = await insertUser('pub_alice', 'pub_alice@example.com');
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', user.id);
    expect(res.body).toHaveProperty('username', 'pub_alice');
  });

  test('returns 404 for non-existent user', async () => {
    const res = await request(app).get('/api/users/9999999/public');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  test('returned profile has listing_count field', async () => {
    const user = await insertUser('pub_bob', 'pub_bob@example.com');
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(res.body).toHaveProperty('listing_count');
  });

  test('returned profile has created_on field', async () => {
    const user = await insertUser('pub_carol', 'pub_carol@example.com');
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(res.body).toHaveProperty('created_on');
  });

  test('listing_count is 0 when user has no listings', async () => {
    const user = await insertUser('pub_dave', 'pub_dave@example.com');
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(Number(res.body.listing_count)).toBe(0);
  });

  test('profile_image is null when user has no icon', async () => {
    const user = await insertUser('pub_eve', 'pub_eve@example.com');
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(res.body.profile_image).toBeNull();
  });

  test('does not expose email or password in public profile', async () => {
    const user = await insertUser('pub_frank', 'pub_frank@example.com');
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(res.body).not.toHaveProperty('email');
    expect(res.body).not.toHaveProperty('password');
  });

  test('does not require Authorization header', async () => {
    const user = await insertUser('pub_grace', 'pub_grace@example.com');
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(res.status).toBe(200);
  });

  test('listing_count increases when user has AVAILABLE listing', async () => {
    const user = await insertUser('pub_henry', 'pub_henry@example.com');
    await pool.query(
      `INSERT INTO listings (owner_id, title, description, price, category, status)
       VALUES ($1, 'Test Listing', 'desc', 50, 'Electronics', 'AVAILABLE')`,
      [user.id],
    );
    const res = await request(app).get(`/api/users/${user.id}/public`);
    expect(Number(res.body.listing_count)).toBe(1);
  });

  test('listing_count excludes ARCHIVED listings', async () => {
    const user = await insertUser('pub_ivan', 'pub_ivan@example.com');
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
    const user = await insertUser('rev_alice', 'rev_alice@example.com');
    const res = await request(app).get(`/api/users/${user.id}/reviews`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('returns empty array when user has no reviews', async () => {
    const user = await insertUser('rev_bob', 'rev_bob@example.com');
    const res = await request(app).get(`/api/users/${user.id}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test('returns 200 even for non-existent user (empty array)', async () => {
    const res = await request(app).get('/api/users/9999999/reviews');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('does not require Authorization header', async () => {
    const user = await insertUser('rev_carol', 'rev_carol@example.com');
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
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer bad.token.here');
    expect(res.status).toBe(401);
  });

  test('returns 200 with user data for valid token', async () => {
    const user = await insertUser('me_alice', 'me_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', user.id);
    expect(res.body).toHaveProperty('username', 'me_alice');
  });

  test('returned user has email field', async () => {
    const user = await insertUser('me_bob', 'me_bob@example.com');
    const token = createToken(user.id);
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveProperty('email', 'me_bob@example.com');
  });

  test('returns 404 for deleted user (token valid but user gone)', async () => {
    const fakeToken = createToken(99999999);
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${fakeToken}`);
    expect(res.status).toBe(404);
  });

  test('does not expose password in response', async () => {
    const user = await insertUser('me_carol', 'me_carol@example.com');
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
    const user = await insertUser('set_alice', 'set_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app).get('/api/me/settings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('settings response includes currency field', async () => {
    const user = await insertUser('set_bob', 'set_bob@example.com');
    const token = createToken(user.id);
    const res = await request(app).get('/api/me/settings').set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveProperty('currency');
  });

  test('returns 404 for non-existent user token', async () => {
    const fakeToken = createToken(99999999);
    const res = await request(app).get('/api/me/settings').set('Authorization', `Bearer ${fakeToken}`);
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
    const user = await insertUser('uset_alice', 'uset_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'SGD', theme: 'dark' });
    expect(res.status).toBe(200);
  });

  test('updated settings are returned in response', async () => {
    const user = await insertUser('uset_bob', 'uset_bob@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ currency: 'EUR' });
    expect(res.body).toHaveProperty('currency', 'EUR');
  });

  test('returns 200 when sending empty body (defaults apply)', async () => {
    const user = await insertUser('uset_carol', 'uset_carol@example.com');
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
    const user = await insertUser('prof_alice', 'prof_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Alice Wonder' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Display name updated.');
  });

  test('returns 200 when displayName is null', async () => {
    const user = await insertUser('prof_bob', 'prof_bob@example.com');
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
    const user = await insertUser('img_alice', 'img_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .delete('/api/me/profile-image')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Profile image removed.');
  });

  test('returns 200 even when user had no profile image', async () => {
    const user = await insertUser('img_bob', 'img_bob@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .delete('/api/me/profile-image')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('profile image is null in /api/me after clearing', async () => {
    const user = await insertUser('img_carol', 'img_carol@example.com');
    const token = createToken(user.id);
    await request(app)
      .delete('/api/me/profile-image')
      .set('Authorization', `Bearer ${token}`);
    const meRes = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
  });
});

// ── PUT /api/me/notifications ─────────────────────────────────────────────────

describe('PUT /api/me/notifications', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).put('/api/me/notifications').send({});
    expect(res.status).toBe(401);
  });

  test('returns 200 when updating notification preferences', async () => {
    const user = await insertUser('notif_alice', 'notif_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({ notifyOrders: true, notifyPromotions: false });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Notification preferences updated.');
  });

  test('returns 200 with notifyPromotions true', async () => {
    const user = await insertUser('notif_bob', 'notif_bob@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({ notifyPromotions: true });
    expect(res.status).toBe(200);
  });

  test('returns 200 with empty body (defaults apply)', async () => {
    const user = await insertUser('notif_carol', 'notif_carol@example.com');
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
    const user = await insertUser('del_alice', 'del_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .delete('/api/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Account deleted.');
  });

  test('user no longer accessible via GET /api/me after deletion', async () => {
    const user = await insertUser('del_bob', 'del_bob@example.com');
    const token = createToken(user.id);
    await request(app).delete('/api/me').set('Authorization', `Bearer ${token}`);
    const meRes = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(404);
  });

  test('user no longer in public profile after deletion', async () => {
    const user = await insertUser('del_carol', 'del_carol@example.com');
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
      .send({ email: 'a@b.com', password: 'secret1' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'newuser', password: 'secret1' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'newuser', email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when password is too short (fewer than 6 chars)', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'newuser', email: 'a@b.com', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('6');
  });

  test('returns 201 on successful registration', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'reg_newuser', email: 'reg_new@example.com', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message');
  });

  test('returns 409 when username is already taken', async () => {
    await request(app)
      .post('/api/register')
      .send({ username: 'taken_user', email: 'first@example.com', password: 'secret123' });
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'taken_user', email: 'second@example.com', password: 'secret123' });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Username');
  });

  test('returns 409 when email is already taken', async () => {
    await request(app)
      .post('/api/register')
      .send({ username: 'firstuser', email: 'taken@example.com', password: 'secret123' });
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'seconduser', email: 'taken@example.com', password: 'secret123' });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Email');
  });

  test('password boundary: exactly 6 characters is accepted', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'boundary_user', email: 'boundary@example.com', password: '123456' });
    expect(res.status).toBe(201);
  });

  test('password boundary: exactly 5 characters is rejected', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ username: 'too_short', email: 'short@example.com', password: '12345' });
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
      .send({ username: 'no_such_user_xyz', password: 'pass' });
    expect(res.status).toBe(404);
  });

  test('returns 400 message when both fields are missing', async () => {
    const res = await request(app).post('/api/login').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  test('returns token on successful login after registration', async () => {
    await request(app)
      .post('/api/register')
      .send({ username: 'login_test_user', email: 'login_test@example.com', password: 'pass123' });

    const res = await request(app)
      .post('/api/login')
      .send({ username: 'login_test_user', password: 'pass123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('returns 401 for wrong password', async () => {
    await request(app)
      .post('/api/register')
      .send({ username: 'wrong_pass_user', email: 'wrongpass@example.com', password: 'correct123' });

    const res = await request(app)
      .post('/api/login')
      .send({ username: 'wrong_pass_user', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  test('token is a non-empty string', async () => {
    await request(app)
      .post('/api/register')
      .send({ username: 'token_user', email: 'token_user@example.com', password: 'pass123' });

    const res = await request(app)
      .post('/api/login')
      .send({ username: 'token_user', password: 'pass123' });

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

  test('clears the refreshToken cookie', async () => {
    const res = await request(app).post('/api/logout');
    expect(res.status).toBe(200);
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
    const user = await insertUser('pw_alice', 'pw_alice@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'newpass1' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when newPassword is missing', async () => {
    const user = await insertUser('pw_bob', 'pw_bob@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'old' });
    expect(res.status).toBe(400);
  });

  test('returns 400 when newPassword is too short', async () => {
    const user = await insertUser('pw_carol', 'pw_carol@example.com');
    const token = createToken(user.id);
    const res = await request(app)
      .put('/api/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'old', newPassword: '123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('6');
  });
});
