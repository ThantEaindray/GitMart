process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

// Declared once and reused for setup and cleanup so the two cannot drift.
// Scoped deletes rather than TRUNCATE, which deadlocks against other suites.
const SUITE_USERNAMES = ['discovery_seller', 'discovery_buyer'];

let seller;
let buyer;
let sellerToken;
let buyerToken;

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

async function insertListing({ ownerId, title, price = 100, category = 'Collectibles' }) {
  const result = await pool.query(
    `
      INSERT INTO listings (owner_id, title, description, price, category, status)
      VALUES ($1, $2, $3, $4, $5, 'AVAILABLE')
      RETURNING id, owner_id, title, price, category
    `,
    [ownerId, title, 'Seeded by the listing discovery tests.', price, category],
  );
  return result.rows[0];
}

// listing_views and reservation_requests cascade from listings; listings must go
// before users because listings.owner_id has no ON DELETE clause.
async function cleanupSuiteData() {
  const ids = 'SELECT id FROM users WHERE username = ANY($1::text[])';

  await pool.query(
    `DELETE FROM offers WHERE product_id IN (SELECT id FROM listings WHERE owner_id IN (${ids}))`,
    [SUITE_USERNAMES],
  );
  await pool.query(`DELETE FROM listings WHERE owner_id IN (${ids})`, [SUITE_USERNAMES]);
  await pool.query('DELETE FROM users WHERE username = ANY($1::text[])', [SUITE_USERNAMES]);
}

beforeEach(async () => {
  await cleanupSuiteData();

  seller = await insertUser(SUITE_USERNAMES[0], 'discovery.seller@example.com');
  buyer = await insertUser(SUITE_USERNAMES[1], 'discovery.buyer@example.com');

  sellerToken = createAccessToken(seller.id);
  buyerToken = createAccessToken(buyer.id);
});

afterAll(async () => {
  await cleanupSuiteData();
  await pool.end();
});

describe('Listing discovery routes', () => {
  // ── GET /api/listings/category/:category ────────────────────────────────
  describe('GET /api/listings/category/:category', () => {
    test('returns only listings in that category', async () => {
      await insertListing({ ownerId: seller.id, title: 'Discovery Book', category: 'Books' });
      await insertListing({ ownerId: seller.id, title: 'Discovery Coat', category: 'Fashion' });

      const response = await request(app).get('/api/listings/category/Books');

      expect(response.status).toBe(200);
      const titles = response.body.map((l) => l.title);
      expect(titles).toContain('Discovery Book');
      expect(titles).not.toContain('Discovery Coat');
    });

    test('is public, requiring no token', async () => {
      const response = await request(app).get('/api/listings/category/Books');
      expect(response.status).toBe(200);
    });

    test('returns an empty array for a category with no listings', async () => {
      const response = await request(app).get('/api/listings/category/NoSuchCategory');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  // ── GET /api/listings/owner/:owner_id ───────────────────────────────────
  describe('GET /api/listings/owner/:owner_id', () => {
    test('returns only that owner listings', async () => {
      await insertListing({ ownerId: seller.id, title: 'Seller Item' });
      await insertListing({ ownerId: buyer.id, title: 'Buyer Item' });

      const response = await request(app).get(`/api/listings/owner/${seller.id}`);

      expect(response.status).toBe(200);
      const titles = response.body.map((l) => l.title);
      expect(titles).toContain('Seller Item');
      expect(titles).not.toContain('Buyer Item');
    });

    test('returns an empty array for an owner with no listings', async () => {
      const response = await request(app).get(`/api/listings/owner/${buyer.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    // Invalid partition: non-numeric owner_id fails the integer cast in Postgres
    test('returns 500 for a non-numeric owner id', async () => {
      const response = await request(app).get('/api/listings/owner/not-a-number');

      expect(response.status).toBe(500);
    });
  });

  // ── GET /api/listings/search ────────────────────────────────────────────
  describe('GET /api/listings/search', () => {
    beforeEach(async () => {
      await insertListing({
        ownerId: seller.id,
        title: 'Discovery Cheap Book',
        price: 20,
        category: 'Books',
      });
      await insertListing({
        ownerId: seller.id,
        title: 'Discovery Mid Coat',
        price: 500,
        category: 'Fashion',
      });
      await insertListing({
        ownerId: seller.id,
        title: 'Discovery Pricey Watch',
        price: 5000,
        category: 'Collectibles',
      });
    });

    test('filters by search term', async () => {
      const response = await request(app).get('/api/listings/search?search=Pricey Watch');

      expect(response.status).toBe(200);
      expect(response.body.map((l) => l.title)).toContain('Discovery Pricey Watch');
    });

    test('filters by price range', async () => {
      const response = await request(app).get(
        '/api/listings/search?search=Discovery&minPrice=100&maxPrice=1000',
      );

      const titles = response.body.map((l) => l.title);
      expect(titles).toContain('Discovery Mid Coat');
      expect(titles).not.toContain('Discovery Cheap Book');
      expect(titles).not.toContain('Discovery Pricey Watch');
    });

    test('filters by category', async () => {
      const response = await request(app).get(
        '/api/listings/search?search=Discovery&category=Books',
      );

      const titles = response.body.map((l) => l.title);
      expect(titles).toEqual(['Discovery Cheap Book']);
    });

    test('sorts cheapest first', async () => {
      const response = await request(app).get(
        '/api/listings/search?search=Discovery&sort=cheapest',
      );

      const prices = response.body.map((l) => Number(l.price));
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    });

    test('sorts most expensive first', async () => {
      const response = await request(app).get(
        '/api/listings/search?search=Discovery&sort=expensive',
      );

      const prices = response.body.map((l) => Number(l.price));
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
    });

    test('accepts the most_viewed sort added for the filter UI', async () => {
      const response = await request(app).get(
        '/api/listings/search?search=Discovery&sort=most_viewed',
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
    });

    test('falls back to the default order for an unknown sort value', async () => {
      // The sort value is spliced into ORDER BY, so anything outside the
      // whitelist must not reach the SQL.
      const response = await request(app).get(
        '/api/listings/search?search=Discovery&sort=price; DROP TABLE listings;--',
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);

      // The table must obviously still exist.
      const stillThere = await request(app).get('/api/listings');
      expect(stillThere.status).toBe(200);
    });

    test('returns an empty array when nothing matches', async () => {
      const response = await request(app).get('/api/listings/search?search=zzz-no-such-listing');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    // Invalid partition: every other test above always supplies `search`, so
    // this covers the `req.query.search || ''` fallback when it is omitted.
    test('returns 200 when the search query param is omitted entirely', async () => {
      const response = await request(app).get('/api/listings/search?category=Books');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // ── GET /api/listings/recently-viewed ───────────────────────────────────
  describe('GET /api/listings/recently-viewed', () => {
    test('returns 401 without a token', async () => {
      const response = await request(app).get('/api/listings/recently-viewed');
      expect(response.status).toBe(401);
    });

    test('is empty for a user who has viewed nothing', async () => {
      const response = await request(app)
        .get('/api/listings/recently-viewed')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('includes a listing after the user views it', async () => {
      const listing = await insertListing({ ownerId: seller.id, title: 'Recently Viewed Item' });

      // Fetching the detail page while authenticated records the view.
      await request(app)
        .get(`/api/listings/${listing.id}`)
        .set('Authorization', `Bearer ${buyerToken}`);

      const response = await request(app)
        .get('/api/listings/recently-viewed')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.map((l) => l.title)).toContain('Recently Viewed Item');
    });

    test('does not record a view for an anonymous request', async () => {
      const listing = await insertListing({ ownerId: seller.id, title: 'Anon Viewed Item' });

      await request(app).get(`/api/listings/${listing.id}`);

      const response = await request(app)
        .get('/api/listings/recently-viewed')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(response.body.map((l) => l.title)).not.toContain('Anon Viewed Item');
    });

    // Invalid partition: jwtMiddleware trusts the userId claim's type as-is,
    // so a non-numeric claim fails the userId integer cast in Postgres.
    test('returns 500 when the token userId claim is not numeric', async () => {
      const badToken = createAccessToken('not-a-number');
      const response = await request(app)
        .get('/api/listings/recently-viewed')
        .set('Authorization', `Bearer ${badToken}`);

      expect(response.status).toBe(500);
    });
  });

  // ── GET /api/listings/most-viewed ───────────────────────────────────────
  describe('GET /api/listings/most-viewed', () => {
    test('is public and returns an array', async () => {
      const response = await request(app).get('/api/listings/most-viewed');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // ── GET /api/listings/dashboard ─────────────────────────────────────────
  describe('GET /api/listings/dashboard', () => {
    test('returns 401 without a token', async () => {
      const response = await request(app).get('/api/listings/dashboard');
      expect(response.status).toBe(401);
    });

    test('returns the three dashboard sections', async () => {
      // Exercises the full three-step middleware chain: stats, then category
      // breakdown, then view breakdown, then the response.
      const response = await request(app)
        .get('/api/listings/dashboard')
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('categories');
      expect(response.body).toHaveProperty('viewBreakdown');
    });

    test('reports the seller listing counts', async () => {
      await insertListing({ ownerId: seller.id, title: 'Dash One', category: 'Books' });
      await insertListing({ ownerId: seller.id, title: 'Dash Two', category: 'Books' });

      const response = await request(app)
        .get('/api/listings/dashboard')
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(response.status).toBe(200);
      // COUNT(*) columns arrive as strings from node-postgres.
      expect(Number(response.body.stats.total)).toBe(2);
      expect(Number(response.body.stats.active)).toBe(2);
    });

    test('scopes the dashboard to the requesting seller', async () => {
      await insertListing({ ownerId: seller.id, title: 'Seller Dash Item' });

      const response = await request(app)
        .get('/api/listings/dashboard')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(response.status).toBe(200);
      // The buyer owns nothing, so their breakdown must be empty.
      expect(response.body.viewBreakdown).toEqual([]);
    });

    // Invalid partition: jwtMiddleware trusts the userId claim's type as-is,
    // so a non-numeric claim fails the owner_id integer cast at the first
    // step of the chain (loadSellerStats).
    test('returns 500 when the token userId claim is not numeric', async () => {
      const badToken = createAccessToken('not-a-number');
      const response = await request(app)
        .get('/api/listings/dashboard')
        .set('Authorization', `Bearer ${badToken}`);

      expect(response.status).toBe(500);
    });
  });

  // ── POST /api/listings/analyse-image ────────────────────────────────────
  // Only the validation path is exercised; the success path calls Gemini and
  // would cost API credits on every test run.
  describe('POST /api/listings/analyse-image', () => {
    test('returns 401 without a token', async () => {
      const response = await request(app).post('/api/listings/analyse-image');
      expect(response.status).toBe(401);
    });

    test('returns 400 when the image payload is missing', async () => {
      const response = await request(app)
        .post('/api/listings/analyse-image')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'imageBase64 and mimeType are required.' });
    });

    test('returns 400 when only the mime type is supplied', async () => {
      const response = await request(app)
        .post('/api/listings/analyse-image')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ mimeType: 'image/png' });

      expect(response.status).toBe(400);
    });

    // Invalid partition: the mime type is missing while imageBase64 is present,
    // so the `!mimeType` half of the check (rather than `!imageBase64`) is the
    // one that decides the result.
    test('returns 400 when only the image is supplied', async () => {
      const response = await request(app)
        .post('/api/listings/analyse-image')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ imageBase64: 'abc123' });

      expect(response.status).toBe(400);
    });

    // Invalid partition: no body at all (as opposed to an empty JSON object)
    // covers the `req.body || {}` fallback rather than destructuring `{}` itself.
    test('returns 400 when no body is sent at all', async () => {
      const response = await request(app)
        .post('/api/listings/analyse-image')
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(response.status).toBe(400);
    });
  });
});
