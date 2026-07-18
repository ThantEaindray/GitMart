const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

// ── Auth state (populated in beforeAll) ──────────────────
let authToken;
let testUserId;

// ── DB Setup / Teardown ──────────────────────────────────
// Schema is already created by jest globalSetup (scripts/reset.js).
// We register + login one test user before all tests.

beforeAll(async () => {
  // Clean any stale data from prior runs
  await pool.query('DELETE FROM listing_views');
  await pool.query('DELETE FROM listings WHERE owner_id IS NOT NULL');
  await pool.query("DELETE FROM users WHERE username = 'listingtest'");

  // Register test user
  await request(app).post('/api/register').send({
    username: 'listingtest',
    email: 'listingtest@test.com',
    password: 'test1234',
  });

  // Login to get token and userId
  const loginRes = await request(app).post('/api/login').send({
    username: 'listingtest',
    password: 'test1234',
  });

  authToken = loginRes.body.token;
  testUserId = loginRes.body.userId;
});

beforeEach(async () => {
  // Clear user-owned listings before each test; keep seed listings (owner_id IS NULL)
  await pool.query('DELETE FROM listing_views');
  await pool.query('DELETE FROM listings WHERE owner_id IS NOT NULL');
});

afterAll(async () => {
  await pool.query('DELETE FROM listing_views');
  await pool.query('DELETE FROM listings WHERE owner_id IS NOT NULL');
  await pool.query("DELETE FROM users WHERE username = 'listingtest'");
  await pool.end();
});

// ── Seed Helper ──────────────────────────────────────────
async function seedListing(overrides = {}) {
  const defaults = {
    owner_id: testUserId,
    price: 100,
    title: 'Seed Item',
    description: 'A seeded listing',
    category: 'Others',
  };
  const data = { ...defaults, ...overrides };
  const result = await pool.query(
    `INSERT INTO listings (owner_id, price, title, description, category)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [data.owner_id, data.price, data.title, data.description, data.category],
  );
  return result.rows[0].id;
}

// ─────────────────────────────────────────────────────────
// GET /api/listings
// ─────────────────────────────────────────────────────────
describe('GET /api/listings', () => {
  // Valid partition: returns an array (may contain seed listings from schema.sql)
  test('should return 200 and an array', async () => {
    const res = await request(app).get('/api/listings');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Valid partition: newly created listing appears in the response
  test('should include a newly seeded listing', async () => {
    const id = await seedListing({ title: 'Visible Watch' });

    const res = await request(app).get('/api/listings');

    expect(res.status).toBe(200);
    const found = res.body.find((l) => l.id === id);
    expect(found).toBeDefined();
    expect(found.title).toBe('Visible Watch');
  });

  // Valid partition: each listing object contains the expected fields
  test('each listing should have the required fields', async () => {
    await seedListing();

    const res = await request(app).get('/api/listings');

    expect(res.status).toBe(200);
    const listing = res.body.find((l) => l.owner_id === testUserId);
    expect(listing).toHaveProperty('id');
    expect(listing).toHaveProperty('title');
    expect(listing).toHaveProperty('price');
    expect(listing).toHaveProperty('category');
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/listings/search
// ─────────────────────────────────────────────────────────
describe('GET /api/listings/search', () => {
  // Valid partition: no query params returns all listings as an array
  test('should return 200 and array with no filters', async () => {
    const res = await request(app).get('/api/listings/search');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Valid partition: search by title keyword returns matching listing
  test('should return matching listing when searching by title keyword', async () => {
    await seedListing({ title: 'Unique Titanium Frame' });

    const res = await request(app).get('/api/listings/search?search=Unique+Titanium');

    expect(res.status).toBe(200);
    const found = res.body.find((l) => l.title === 'Unique Titanium Frame');
    expect(found).toBeDefined();
  });

  // Valid partition: filter by category returns only that category
  test('should filter listings by category', async () => {
    await seedListing({ title: 'Category Watch', category: 'Watches' });
    await seedListing({ title: 'Category Book', category: 'Books' });

    const res = await request(app).get('/api/listings/search?category=Watches');

    expect(res.status).toBe(200);
    const titles = res.body.map((l) => l.title);
    expect(titles).toContain('Category Watch');
    expect(titles).not.toContain('Category Book');
  });

  // Boundary: search with no match returns empty array
  test('should return empty array for a search term with no matches', async () => {
    const res = await request(app).get('/api/listings/search?search=xyznotfound12345');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/listings/:id
// ─────────────────────────────────────────────────────────
describe('GET /api/listings/:id', () => {
  // Valid partition: existing id returns the listing
  test('should return 200 and the listing for a valid id', async () => {
    const id = await seedListing({ title: 'Single Fetch Watch' });

    const res = await request(app).get(`/api/listings/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.title).toBe('Single Fetch Watch');
  });

  // Boundary: non-existent id returns 404
  test('should return 404 for a non-existent listing id', async () => {
    const res = await request(app).get('/api/listings/999999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });
});

// ─────────────────────────────────────────────────────────
// POST /api/listings (protected)
// ─────────────────────────────────────────────────────────
describe('POST /api/listings', () => {
  // Invalid partition: no token → 401
  test('should return 401 when no auth token is provided', async () => {
    const res = await request(app).post('/api/listings').send({
      title: 'Test',
      description: 'Test desc',
      price: 50,
    });

    expect(res.status).toBe(401);
  });

  // Invalid partition: missing title → 400
  test('should return 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ description: 'No title', price: 50 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  // Invalid partition: price <= 0 → 400
  test('should return 400 when price is 0 or negative', async () => {
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Zero Price', description: 'desc', price: 0 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  // Valid partition: all required fields → 201 with listing object
  test('should return 201 and the created listing with valid data', async () => {
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'New Listing',
        description: 'A fine item for sale.',
        price: 250,
        category: 'Fashion',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('listing');
    expect(res.body.listing.title).toBe('New Listing');
    expect(res.body.listing.owner_id).toBe(testUserId);
  });

  // Valid partition: created listing persists and is retrievable via GET
  test('created listing should appear in GET /api/listings', async () => {
    await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Persistent Item', description: 'should persist', price: 99 });

    const getRes = await request(app).get('/api/listings');
    const found = getRes.body.find((l) => l.title === 'Persistent Item');

    expect(found).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /api/listings/:id (protected)
// ─────────────────────────────────────────────────────────
describe('DELETE /api/listings/:id', () => {
  // Invalid partition: no token → 401
  test('should return 401 when no auth token is provided', async () => {
    const id = await seedListing();

    const res = await request(app).delete(`/api/listings/${id}`);

    expect(res.status).toBe(401);
  });

  // Boundary: non-existent id → 404
  test('should return 404 when listing does not exist', async () => {
    const res = await request(app)
      .delete('/api/listings/999999')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  // Valid partition: owner deletes their own listing → 200
  test('should return 200 and success message when owner deletes listing', async () => {
    const id = await seedListing({ title: 'To Be Deleted' });

    const res = await request(app)
      .delete(`/api/listings/${id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Listing deleted successfully.');
  });

  // Valid partition: deleted listing is no longer retrievable
  test('deleted listing should return 404 on subsequent GET', async () => {
    const id = await seedListing({ title: 'Gone Soon' });

    await request(app)
      .delete(`/api/listings/${id}`)
      .set('Authorization', `Bearer ${authToken}`);

    const getRes = await request(app).get(`/api/listings/${id}`);

    expect(getRes.status).toBe(404);
  });
});
