const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

// ── Auth state (populated in beforeAll) ──────────────────
let authToken;
let testUserId;
let testListingId;

// ── DB Setup / Teardown ──────────────────────────────────
// Schema is already created by jest globalSetup (scripts/reset.js).
// We register + login one test user before all tests, then re-seed a fresh
// listing before each test so concurrent integration test workers cannot
// interfere via their own DELETE FROM listings beforeEach hooks.

beforeAll(async () => {
  // Clean any stale data from prior runs
  await pool.query("DELETE FROM users WHERE username = 'wishlisttest'");

  // Register test user
  await request(app).post('/api/register').send({
    username: 'wishlisttest',
    email: 'wishlisttest@test.com',
    password: 'test1234',
  });

  // Login to get token and userId
  const loginRes = await request(app).post('/api/login').send({
    username: 'wishlisttest',
    password: 'test1234',
  });

  authToken = loginRes.body.token;
  testUserId = loginRes.body.userId;
});

beforeEach(async () => {
  // Clear this user's wishlist, then re-seed a fresh listing each test
  await pool.query('DELETE FROM wishlist WHERE user_id = $1', [testUserId]);
  await pool.query('DELETE FROM listings WHERE owner_id = $1', [testUserId]);
  const listingRes = await pool.query(
    `INSERT INTO listings (owner_id, price, title, description, category)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [testUserId, 50, 'Wishlist Test Item', 'For wishlist testing', 'Others'],
  );
  testListingId = listingRes.rows[0].id;
});

afterAll(async () => {
  await pool.query('DELETE FROM wishlist WHERE user_id = $1', [testUserId]);
  await pool.query('DELETE FROM listings WHERE owner_id = $1', [testUserId]);
  await pool.query("DELETE FROM users WHERE username = 'wishlisttest'");
  await pool.end();
});

// ─────────────────────────────────────────────────────────
// GET /api/wishlist
// ─────────────────────────────────────────────────────────
describe('GET /api/wishlist', () => {
  // Invalid partition: no token → 401
  test('should return 401 when no auth token is provided', async () => {
    const res = await request(app).get('/api/wishlist');

    expect(res.status).toBe(401);
  });

  // Boundary: empty wishlist returns empty array
  test('should return 200 and empty array when wishlist is empty', async () => {
    const res = await request(app).get('/api/wishlist').set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Valid partition: added item appears in wishlist response
  test('should return 200 and array containing the added item', async () => {
    await pool.query('INSERT INTO wishlist (user_id, listing_id) VALUES ($1, $2)', [
      testUserId,
      testListingId,
    ]);

    const res = await request(app).get('/api/wishlist').set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((item) => item.listing_id === testListingId);
    expect(found).toBeDefined();
    expect(found).toHaveProperty('title');
    expect(found).toHaveProperty('price');
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/wishlist/:listingId
// ─────────────────────────────────────────────────────────
describe('POST /api/wishlist/:listingId', () => {
  // Invalid partition: no token → 401
  test('should return 401 when no auth token is provided', async () => {
    const res = await request(app).post(`/api/wishlist/${testListingId}`);

    expect(res.status).toBe(401);
  });

  // Valid partition: authenticated user adds a listing → 201
  test('should return 201 and success message when item is added', async () => {
    const res = await request(app)
      .post(`/api/wishlist/${testListingId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message');
  });

  // Boundary: duplicate add still returns 201 (ON CONFLICT DO NOTHING)
  test('should return 201 on duplicate add without error', async () => {
    await request(app)
      .post(`/api/wishlist/${testListingId}`)
      .set('Authorization', `Bearer ${authToken}`);

    const res = await request(app)
      .post(`/api/wishlist/${testListingId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(201);
  });

  // Valid partition: added listing appears in GET /api/wishlist
  test('added item should appear in GET /api/wishlist', async () => {
    await request(app)
      .post(`/api/wishlist/${testListingId}`)
      .set('Authorization', `Bearer ${authToken}`);

    const getRes = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${authToken}`);

    const found = getRes.body.find((item) => item.listing_id === testListingId);
    expect(found).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /api/wishlist/:listingId
// ─────────────────────────────────────────────────────────
describe('DELETE /api/wishlist/:listingId', () => {
  // Invalid partition: no token → 401
  test('should return 401 when no auth token is provided', async () => {
    const res = await request(app).delete(`/api/wishlist/${testListingId}`);

    expect(res.status).toBe(401);
  });

  // Boundary: item not in wishlist → 404
  test('should return 404 when item is not in wishlist', async () => {
    const res = await request(app)
      .delete(`/api/wishlist/${testListingId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  // Valid partition: item in wishlist is removed → 200
  test('should return 200 and success message when item is removed', async () => {
    await pool.query('INSERT INTO wishlist (user_id, listing_id) VALUES ($1, $2)', [
      testUserId,
      testListingId,
    ]);

    const res = await request(app)
      .delete(`/api/wishlist/${testListingId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Removed from wishlist.');
  });

  // Valid partition: removed item no longer appears in GET /api/wishlist
  test('removed item should not appear in GET /api/wishlist', async () => {
    await pool.query('INSERT INTO wishlist (user_id, listing_id) VALUES ($1, $2)', [
      testUserId,
      testListingId,
    ]);

    await request(app)
      .delete(`/api/wishlist/${testListingId}`)
      .set('Authorization', `Bearer ${authToken}`);

    const getRes = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${authToken}`);

    const found = getRes.body.find((item) => item.listing_id === testListingId);
    expect(found).toBeUndefined();
  });
});
