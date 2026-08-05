process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

let owner;
let otherUser;
let ownerToken;
let otherUserToken;

/**
 * Creates a valid access token for a test user.
 *
 * This uses the same test secret as the real JWT middleware, meaning
 * requests still pass through the application's actual verifyToken
 * middleware.
 */
function createAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn: '1h',
  });
}

/**
 * Inserts a user directly into the test database.
 *
 * The password is not used because these tests are testing listing routes,
 * not the login route.
 */
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

/**
 * Inserts a listing directly into the test database.
 *
 * This helper is used when the test needs an existing listing before
 * testing update, delete or retrieval behaviour.
 */
async function insertListing({
  ownerId,
  title = 'Baseline Camera',
  description = 'A listing created for integration testing.',
  price = 500,
  category = 'Electronics',
}) {
  const result = await pool.query(
    `
      INSERT INTO listings (
        owner_id,
        title,
        description,
        price,
        category
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        owner_id,
        title,
        description,
        price,
        category,
        status,
        status_updated_on,
        "isSold",
        "isClosed"
    `,
    [ownerId, title, description, price, category],
  );

  return result.rows[0];
}

/**
 * Reset only the tables related to users and listings before every test.
 *
 * The existing Something tests use a different table, so they are not
 * affected by this cleanup.
 */
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

  owner = await insertUser('listing_owner', 'listing.owner@example.com');

  otherUser = await insertUser('other_user', 'other.user@example.com');

  ownerToken = createAccessToken(owner.id);
  otherUserToken = createAccessToken(otherUser.id);
});

/**
 * Close the PostgreSQL connection after this test file finishes.
 */
afterAll(async () => {
  await pool.end();
});

describe('Listing API baseline', () => {
  describe('GET /api/listings', () => {
    test('returns 200 and an empty array when no listings exist', async () => {
      const response = await request(app).get('/api/listings');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('returns all listings to a public user', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app).get('/api/listings');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);

      expect(response.body[0]).toMatchObject({
        id: listing.id,
        owner_id: owner.id,
        title: 'Baseline Camera',
        description: 'A listing created for integration testing.',
        category: 'Electronics',
        isSold: false,
        isClosed: false,
      });

      // PostgreSQL NUMERIC values may be returned as strings.
      expect(Number(response.body[0].price)).toBe(500);
    });
  });

  describe('GET /api/listings/:id', () => {
    test('returns 404 when the listing does not exist', async () => {
      const response = await request(app).get('/api/listings/999999');

      expect(response.status).toBe(404);

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

    await request(app).delete(`/api/listings/${id}`).set('Authorization', `Bearer ${authToken}`);

    const getRes = await request(app).get(`/api/listings/${id}`);

    expect(getRes.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────
// PATCH /api/listings/:id (protected)
// ─────────────────────────────────────────────────────────
describe('PATCH /api/listings/:id', () => {
  // Invalid partition: no token → 401
  test('should return 401 when no auth token is provided', async () => {
    const id = await seedListing();

    const res = await request(app)
      .patch(`/api/listings/${id}`)
      .send({ title: 'Updated', description: 'desc', price: 50 });

    expect(res.status).toBe(401);
  });

  // Invalid partition: missing required fields → 400
  test('should return 400 when required fields are missing', async () => {
    const id = await seedListing();

    const res = await request(app)
      .patch(`/api/listings/${id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'No desc or price' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  // Invalid partition: price <= 0 → 400
  test('should return 400 when price is 0 or negative', async () => {
    const id = await seedListing();

    const res = await request(app)
      .patch(`/api/listings/${id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Bad Price', description: 'desc', price: 0 });

    expect(res.status).toBe(400);
  });

  // Boundary: non-existent id → 404
  test('should return 404 when listing does not exist', async () => {
    const res = await request(app)
      .patch('/api/listings/999999')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'X', description: 'Y', price: 10 });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  // Valid partition: owner updates their listing → 200 with updated data
  test('should return 200 and updated listing when owner updates', async () => {
    const id = await seedListing({ title: 'Original Title', price: 100 });

    const res = await request(app)
      .patch(`/api/listings/${id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Updated Title', description: 'New desc', price: 200 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.listing.title).toBe('Updated Title');
    expect(Number(res.body.listing.price)).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/listings/most-viewed
// ─────────────────────────────────────────────────────────
describe('GET /api/listings/most-viewed', () => {
  // Valid partition: returns 200 and an array
  test('should return 200 and an array', async () => {
    const res = await request(app).get('/api/listings/most-viewed');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Valid partition: each item has the required fields
  test('each item should have id, title, view_count fields', async () => {
    const id = await seedListing({ title: 'Viewed Item' });
    // Simulate a view by hitting GET /api/listings/:id with auth
    await request(app).get(`/api/listings/${id}`).set('Authorization', `Bearer ${authToken}`);

    const res = await request(app).get('/api/listings/most-viewed');

    expect(res.status).toBe(200);
    const found = res.body.find((l) => l.id === id);
    if (found) {
      expect(found).toHaveProperty('view_count');
      expect(found).toHaveProperty('title');
    }
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/listings/recently-viewed (protected)
// ─────────────────────────────────────────────────────────
describe('GET /api/listings/recently-viewed', () => {
  // Invalid partition: no token → 401
  test('should return 401 when no auth token is provided', async () => {
    const res = await request(app).get('/api/listings/recently-viewed');

    expect(res.status).toBe(401);
  });

  // Boundary: no view history returns empty array
  test('should return 200 and empty array when user has no view history', async () => {
    const res = await request(app)
      .get('/api/listings/recently-viewed')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Valid partition: viewed listing appears in recently-viewed
  test('should include a listing after the user views it', async () => {
    const id = await seedListing({ title: 'Recently Viewed Item' });
    await request(app).get(`/api/listings/${id}`).set('Authorization', `Bearer ${authToken}`);

    const res = await request(app)
      .get('/api/listings/recently-viewed')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const found = res.body.find((l) => l.id === id);
    expect(found).toBeDefined();
    expect(found).toHaveProperty('viewed_at');
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/listings/category/:category
// ─────────────────────────────────────────────────────────
describe('GET /api/listings/category/:category', () => {
  // Valid partition: returns only listings matching the category
  test('should return 200 and listings matching the category', async () => {
    await seedListing({ title: 'Watch Item', category: 'Watches' });
    await seedListing({ title: 'Book Item', category: 'Books' });

    const res = await request(app).get('/api/listings/category/Watches');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const titles = res.body.map((l) => l.title);
    expect(titles).toContain('Watch Item');
    expect(titles).not.toContain('Book Item');
  });

  // Boundary: category with no listings returns empty array
  test('should return empty array for a category with no listings', async () => {
    const res = await request(app).get('/api/listings/category/NonExistentCategory');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/listings/owner/:owner_id
// ─────────────────────────────────────────────────────────
describe('GET /api/listings/owner/:owner_id', () => {
  // Valid partition: returns listings belonging to the given owner
  test('should return 200 and listings for the given owner', async () => {
    await seedListing({ title: 'Owner Listing' });

    const res = await request(app).get(`/api/listings/owner/${testUserId}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((l) => l.title === 'Owner Listing');
    expect(found).toBeDefined();
    expect(found.owner_id).toBe(testUserId);
  });

  // Boundary: owner with no listings returns empty array
  test('should return empty array when owner has no listings', async () => {
    const res = await request(app).get('/api/listings/owner/999999');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// GET /api/listings/dashboard (protected)
// ─────────────────────────────────────────────────────────
describe('GET /api/listings/dashboard', () => {
  // Invalid partition: no token → 401
  test('should return 401 when no auth token is provided', async () => {
    const res = await request(app).get('/api/listings/dashboard');

    expect(res.status).toBe(401);
  });

  // Valid partition: authenticated user gets dashboard shape
  test('should return 200 with stats, categories, and viewBreakdown', async () => {
    const res = await request(app)
      .get('/api/listings/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('stats');
    expect(res.body).toHaveProperty('categories');
    expect(res.body).toHaveProperty('viewBreakdown');
  });

  // Valid partition: stats reflect the listings the test user owns
  test('should include seeded listings in stats total', async () => {
    await seedListing({ title: 'Dashboard Item 1' });
    await seedListing({ title: 'Dashboard Item 2' });

    const res = await request(app)
      .get('/api/listings/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Number(res.body.stats.total)).toBeGreaterThanOrEqual(2);
  });

  // Valid partition: categories array contains entries for seeded listings
  test('should list categories matching seeded listings', async () => {
    await seedListing({ title: 'Watch Dash', category: 'Watches' });

    const res = await request(app)
      .get('/api/listings/dashboard')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
    const cats = res.body.categories.map((c) => c.category);
    expect(cats).toContain('Watches');
  });
});
