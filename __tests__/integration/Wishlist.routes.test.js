process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

jest.setTimeout(20000);
jest.retryTimes(2);

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

const JWT_ALG = process.env.JWT_ALGORITHM || 'HS256';

let authToken;
let testUserId;
let testListingId;

function makeToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET_KEY, {
    algorithm: JWT_ALG,
    expiresIn: '1h',
  });
}

// ── DB Setup / Teardown ──────────────────────────────────────────────────────
// listing.routes.test.js runs TRUNCATE TABLE listings, users RESTART IDENTITY
// CASCADE in its own beforeEach, which cascades to wishlist. This wipes our
// user and listing between tests and can deadlock with our INSERT INTO listings.
// Fix: re-insert user (ON CONFLICT DO NOTHING) and re-read the current id in
// every beforeEach so stale ids / tokens are never used. jest.retryTimes(2)
// handles transient deadlocks by replaying the whole test including beforeEach.

beforeAll(async () => {
  await pool.query(
    `DELETE FROM wishlist WHERE user_id IN (SELECT id FROM users WHERE username = 'wl_wishlist')`,
  );
  await pool.query(
    `DELETE FROM listings WHERE owner_id IN (SELECT id FROM users WHERE username = 'wl_wishlist')`,
  );
  await pool.query(`DELETE FROM users WHERE username = 'wl_wishlist'`);
});

beforeEach(async () => {
  // Re-insert user in case another suite's TRUNCATE wiped it
  await pool.query(
    `INSERT INTO users (username, email, password)
     VALUES ('wl_wishlist', 'wl_wishlist@test.com', 'placeholder')
     ON CONFLICT (username) DO NOTHING`,
  );
  // Always read the current id — RESTART IDENTITY can change it after a TRUNCATE
  const userRow = await pool.query(`SELECT id FROM users WHERE username = 'wl_wishlist'`);
  testUserId = userRow.rows[0].id;
  authToken = makeToken(testUserId);

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
  try {
    await pool.query(
      `DELETE FROM wishlist WHERE user_id IN (SELECT id FROM users WHERE username = 'wl_wishlist')`,
    );
    await pool.query(
      `DELETE FROM listings WHERE owner_id IN (SELECT id FROM users WHERE username = 'wl_wishlist')`,
    );
    await pool.query(`DELETE FROM users WHERE username = 'wl_wishlist'`);
  } catch (_) {
    // best-effort cleanup
  }
  try {
    await pool.end();
  } catch (_) {
    // ignore
  }
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

  // Invalid partition: jwtMiddleware trusts the userId claim's type as-is, so a
  // token whose claim isn't numeric fails the user_id integer cast in Postgres
  // rather than jwtMiddleware itself rejecting it.
  test('should return 500 when the token userId claim is not numeric', async () => {
    const res = await request(app)
      .get('/api/wishlist')
      .set('Authorization', `Bearer ${makeToken('not-a-number')}`);

    expect(res.status).toBe(500);
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

  // Invalid partition: listing_id has a FOREIGN KEY constraint, so adding a
  // listing that does not exist is rejected by Postgres itself (23503).
  test('should return 500 when the listing does not exist', async () => {
    const res = await request(app)
      .post('/api/wishlist/999999')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(500);
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

  // Invalid partition: non-numeric id fails the listing_id integer cast in Postgres
  test('should return 500 for a non-numeric listing id', async () => {
    const res = await request(app)
      .delete('/api/wishlist/not-a-number')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(500);
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
