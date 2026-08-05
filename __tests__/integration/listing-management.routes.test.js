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

      expect(response.body).toEqual({
        message: 'Listing not found.',
      });
    });

    // Invalid partition: non-numeric id fails the integer cast in Postgres
    test('returns 500 for a non-numeric listing id', async () => {
      const response = await request(app).get('/api/listings/not-a-number');

      expect(response.status).toBe(500);
    });

    // optionalAuth treats a garbage/expired token as anonymous rather than
    // rejecting the request — this route is the one that actually uses it.
    test('still loads the listing when the token is invalid (treated as anonymous)', async () => {
      const listing = await insertListing({ ownerId: owner.id });
      const response = await request(app)
        .get(`/api/listings/${listing.id}`)
        .set('Authorization', 'Bearer garbage.token.here');

      expect(response.status).toBe(200);
    });

    // optionalAuth falls back through decoded.userId ?? decoded.user_id ??
    // decoded.id ?? decoded.sub — every other test on this route signs
    // { userId }, so these cover the rest of that same chain.
    test('records a view when the token claim is user_id instead of userId', async () => {
      const listing = await insertListing({ ownerId: owner.id });
      const token = jwt.sign({ user_id: otherUser.id }, process.env.JWT_SECRET_KEY, {
        algorithm: JWT_ALGORITHM,
        expiresIn: '1h',
      });

      await request(app).get(`/api/listings/${listing.id}`).set('Authorization', `Bearer ${token}`);

      const response = await request(app)
        .get('/api/listings/recently-viewed')
        .set('Authorization', `Bearer ${otherUserToken}`);
      expect(response.body.map((l) => l.id)).toContain(listing.id);
    });

    test('records a view when the token claim is id instead of userId', async () => {
      const listing = await insertListing({ ownerId: owner.id });
      const token = jwt.sign({ id: otherUser.id }, process.env.JWT_SECRET_KEY, {
        algorithm: JWT_ALGORITHM,
        expiresIn: '1h',
      });

      await request(app).get(`/api/listings/${listing.id}`).set('Authorization', `Bearer ${token}`);

      const response = await request(app)
        .get('/api/listings/recently-viewed')
        .set('Authorization', `Bearer ${otherUserToken}`);
      expect(response.body.map((l) => l.id)).toContain(listing.id);
    });

    test('records a view when the token claim is sub instead of userId', async () => {
      const listing = await insertListing({ ownerId: owner.id });
      const token = jwt.sign({ sub: otherUser.id }, process.env.JWT_SECRET_KEY, {
        algorithm: JWT_ALGORITHM,
        expiresIn: '1h',
      });

      await request(app).get(`/api/listings/${listing.id}`).set('Authorization', `Bearer ${token}`);

      const response = await request(app)
        .get('/api/listings/recently-viewed')
        .set('Authorization', `Bearer ${otherUserToken}`);
      expect(response.body.map((l) => l.id)).toContain(listing.id);
    });
  });

  describe('POST /api/listings', () => {
    const validListing = {
      title: 'Mechanical Keyboard',
      description: 'A lightly used mechanical keyboard.',
      price: 120,
      category: 'Electronics',
    };

    test('returns 401 when no access token is provided', async () => {
      const response = await request(app).post('/api/listings').send(validListing);

      expect(response.status).toBe(401);

      expect(response.body).toEqual({
        error: 'No token provided',
      });
    });

    // Boundary: category is optional at both the controller and model layer;
    // every other test provides one, so the 'Others' default is never exercised.
    test('defaults category to Others when omitted', async () => {
      const { category: _category, ...listingWithoutCategory } = validListing;
      const response = await request(app)
        .post('/api/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(listingWithoutCategory);

      expect(response.status).toBe(201);
      expect(response.body.listing.category).toBe('Others');
    });

    test('returns 400 when a required field is missing', async () => {
      const response = await request(app)
        .post('/api/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Incomplete Listing',
          price: 50,
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        message: 'Title, description and price are required.',
      });
    });

    test('returns 400 when the price is zero', async () => {
      const response = await request(app)
        .post('/api/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          ...validListing,
          price: 0,
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        message: 'Price must be more than 0.',
      });
    });

    test('allows an authenticated owner to create a listing', async () => {
      const response = await request(app)
        .post('/api/listings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(validListing);

      expect(response.status).toBe(201);

      expect(response.body.message).toBe('Listing created successfully.');

      expect(response.body.listing).toMatchObject({
        owner_id: owner.id,
        title: validListing.title,
        description: validListing.description,
        category: validListing.category,
        isSold: false,
        isClosed: false,
      });

      expect(Number(response.body.listing.price)).toBe(validListing.price);

      // Confirm that the API really persisted the listing.
      const databaseResult = await pool.query(
        `
          SELECT
  owner_id,
  title,
  description,
  price,
  category,
  status
FROM listings
WHERE id = $1
        `,
        [response.body.listing.id],
      );

      expect(databaseResult.rows).toHaveLength(1);
      expect(databaseResult.rows[0].owner_id).toBe(owner.id);
      expect(databaseResult.rows[0].title).toBe(validListing.title);
      expect(databaseResult.rows[0].status).toBe('AVAILABLE');
    });

    test('returns 500 when the token userId claim is not numeric', async () => {
      const badToken = createAccessToken('not-a-number');
      const response = await request(app)
        .post('/api/listings')
        .set('Authorization', `Bearer ${badToken}`)
        .send(validListing);

      expect(response.status).toBe(500);
    });

    // Invalid partition: no body at all (as opposed to an empty JSON object)
    // covers the `req.body || {}` fallback rather than destructuring `{}` itself.
    test('returns 400 when no body is sent at all', async () => {
      const response = await request(app)
        .post('/api/listings')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/listings/:id', () => {
    test('returns 400 when a required field is missing', async () => {
      const listing = await insertListing({ ownerId: owner.id });
      const response = await request(app)
        .patch(`/api/listings/${listing.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Incomplete', price: 50 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Title, description and price are required.',
      });
    });

    test('returns 400 when the price is not positive', async () => {
      const listing = await insertListing({ ownerId: owner.id });
      const response = await request(app)
        .patch(`/api/listings/${listing.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Free Camera', description: 'Should not be allowed', price: 0 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Price must be more than 0.',
      });
    });

    // Invalid partition: non-numeric id fails the integer cast in Postgres
    test('returns 500 for a non-numeric listing id', async () => {
      const response = await request(app)
        .patch('/api/listings/not-a-number')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Ghost', description: 'Ghost listing', price: 10 });

      expect(response.status).toBe(500);
    });

    // Invalid partition: no body at all (as opposed to an empty JSON object)
    // covers the `req.body || {}` fallback rather than destructuring `{}` itself.
    test('returns 400 when no body is sent at all', async () => {
      const listing = await insertListing({ ownerId: owner.id });
      const response = await request(app)
        .patch(`/api/listings/${listing.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
    });

    test('allows the owner to update their listing', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const update = {
        title: 'Updated Camera',
        description: 'The owner updated this listing.',
        price: 650,
      };

      const response = await request(app)
        .patch(`/api/listings/${listing.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(update);

      expect(response.status).toBe(200);

      expect(response.body.message).toBe('Listing updated successfully.');

      expect(response.body.listing).toMatchObject({
        id: listing.id,
        owner_id: owner.id,
        title: update.title,
        description: update.description,
      });

      expect(Number(response.body.listing.price)).toBe(update.price);
    });

    test('does not allow another user to update the listing', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .patch(`/api/listings/${listing.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          title: 'Unauthorised Update',
          description: 'This change should not be saved.',
          price: 1,
        });

      expect(response.status).toBe(404);

      expect(response.body).toEqual({
        message: 'Listing not found or you are not the owner.',
      });

      // Confirm that the unauthorised request did not alter the database.
      const databaseResult = await pool.query(
        `
          SELECT title, description, price
          FROM listings
          WHERE id = $1
        `,
        [listing.id],
      );

      expect(databaseResult.rows[0].title).toBe('Baseline Camera');

      expect(Number(databaseResult.rows[0].price)).toBe(500);
    });
  });

  describe('Listing lifecycle database foundation', () => {
    test('uses AVAILABLE as the default status for a new listing', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      expect(listing).toMatchObject({
        status: 'AVAILABLE',
        isSold: false,
        isClosed: false,
      });

      expect(listing.status_updated_on).toBeDefined();
    });

    test('rejects a status outside the supported lifecycle values', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      await expect(
        pool.query(
          `
          UPDATE listings
          SET status = $1
          WHERE id = $2
        `,
          ['DELETED', listing.id],
        ),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'listings_status_check',
      });
    });

    test('rejects a status and legacy flags that do not match', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      await expect(
        pool.query(
          `
          UPDATE listings
          SET
            status = $1,
            "isSold" = $2,
            "isClosed" = $3
          WHERE id = $4
        `,
          ['SOLD', false, false, listing.id],
        ),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'listings_status_flags_check',
      });
    });
  });

  describe('PATCH /api/listings/:id/status', () => {
    test('returns 401 when no access token is provided', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app).patch(`/api/listings/${listing.id}/status`).send({
        status: 'RESERVED',
      });

      expect(response.status).toBe(401);

      expect(response.body).toEqual({
        error: 'No token provided',
      });
    });

    test('returns 400 when the listing ID is invalid', async () => {
      const response = await request(app)
        .patch('/api/listings/not-a-number/status')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'RESERVED',
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        message: 'Listing ID must be a positive integer.',
      });
    });

    // Invalid partition: passes validateListingStatusInput's own
    // Number.isInteger check but overflows Postgres's integer column when
    // loadListingForStatusUpdate queries by id.
    test('returns 500 when the listing id overflows a Postgres integer', async () => {
      const response = await request(app)
        .patch('/api/listings/99999999999999/status')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'RESERVED' });

      expect(response.status).toBe(500);
    });

    test('returns 400 when status is missing', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .patch(`/api/listings/${listing.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        message: 'Status is required.',
      });
    });

    // Invalid partition: no body at all (as opposed to an empty JSON object)
    // covers the `req.body || {}` fallback rather than destructuring `{}` itself.
    test('returns 400 when no body is sent at all', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .patch(`/api/listings/${listing.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
    });

    test('returns 400 when status is unsupported', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .patch(`/api/listings/${listing.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'DELETED',
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        message: 'Status must be AVAILABLE, RESERVED, SOLD or ARCHIVED.',
      });
    });

    test('returns 404 when the listing does not exist', async () => {
      const response = await request(app)
        .patch('/api/listings/999999/status')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'RESERVED',
        });

      expect(response.status).toBe(404);

      expect(response.body).toEqual({
        message: 'Listing not found.',
      });
    });

    test('returns 403 when another user changes the status', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .patch(`/api/listings/${listing.id}/status`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          status: 'RESERVED',
        });

      expect(response.status).toBe(403);

      expect(response.body).toEqual({
        message: 'Only the listing owner can change its status.',
      });

      const databaseResult = await pool.query(
        `
        SELECT status
        FROM listings
        WHERE id = $1
      `,
        [listing.id],
      );

      expect(databaseResult.rows[0].status).toBe('AVAILABLE');
    });

    test('allows the owner to reserve an available listing', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .patch(`/api/listings/${listing.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: ' reserved ',
        });

      expect(response.status).toBe(200);

      expect(response.body.message).toBe('Listing status changed from AVAILABLE to RESERVED.');

      expect(response.body.listing).toMatchObject({
        id: listing.id,
        owner_id: owner.id,
        status: 'RESERVED',
        isSold: false,
        isClosed: false,
      });

      expect(response.body.listing.status_updated_on).toBeDefined();

      const databaseResult = await pool.query(
        `
        SELECT
          status,
          "isSold",
          "isClosed"
        FROM listings
        WHERE id = $1
      `,
        [listing.id],
      );

      expect(databaseResult.rows[0]).toMatchObject({
        status: 'RESERVED',
        isSold: false,
        isClosed: false,
      });
    });

    test('allows the owner to mark an available listing as sold', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .patch(`/api/listings/${listing.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'SOLD',
        });

      expect(response.status).toBe(200);

      expect(response.body.listing).toMatchObject({
        id: listing.id,
        status: 'SOLD',
        isSold: true,
        isClosed: false,
      });

      const databaseResult = await pool.query(
        `
        SELECT
          status,
          "isSold",
          "isClosed"
        FROM listings
        WHERE id = $1
      `,
        [listing.id],
      );

      expect(databaseResult.rows[0]).toMatchObject({
        status: 'SOLD',
        isSold: true,
        isClosed: false,
      });
    });

    test('allows the owner to archive an available listing', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .patch(`/api/listings/${listing.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'ARCHIVED',
        });

      expect(response.status).toBe(200);

      expect(response.body.listing).toMatchObject({
        id: listing.id,
        status: 'ARCHIVED',
        isSold: false,
        isClosed: true,
      });

      const databaseResult = await pool.query(
        `
        SELECT
          status,
          "isSold",
          "isClosed"
        FROM listings
        WHERE id = $1
      `,
        [listing.id],
      );

      expect(databaseResult.rows[0]).toMatchObject({
        status: 'ARCHIVED',
        isSold: false,
        isClosed: true,
      });
    });

    // Invalid partition: requesting the listing's current status as the next
    // status hits canTransitionListingStatus's `current === next` check,
    // distinct from the invalid-status-value and disallowed-transition checks
    // covered elsewhere.
    test("rejects a transition to the listing's current status", async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .patch(`/api/listings/${listing.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'AVAILABLE',
        });

      expect(response.status).toBe(409);

      expect(response.body).toEqual({
        message: 'Cannot change listing status from AVAILABLE to AVAILABLE.',
      });
    });

    test('rejects an invalid transition from SOLD to AVAILABLE', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      await pool.query(
        `
        UPDATE listings
        SET
          status = 'SOLD',
          "isSold" = true,
          "isClosed" = false
        WHERE id = $1
      `,
        [listing.id],
      );

      const response = await request(app)
        .patch(`/api/listings/${listing.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          status: 'AVAILABLE',
        });

      expect(response.status).toBe(409);

      expect(response.body).toEqual({
        message: 'Cannot change listing status from SOLD to AVAILABLE.',
      });

      const databaseResult = await pool.query(
        `
        SELECT
          status,
          "isSold",
          "isClosed"
        FROM listings
        WHERE id = $1
      `,
        [listing.id],
      );

      expect(databaseResult.rows[0]).toMatchObject({
        status: 'SOLD',
        isSold: true,
        isClosed: false,
      });
    });

    // Boundary: the update is optimistically locked on the status read during
    // loadListingForStatusUpdate (`WHERE id = $1 AND owner_id = $2 AND status
    // = $3`). Firing several valid AVAILABLE -> RESERVED requests concurrently
    // for the same listing means only the first UPDATE to reach Postgres still
    // matches that WHERE clause; the rest match zero rows and hit the 409 in
    // updateListingStatus itself (distinct from the transition-validity 409 in
    // loadListingForStatusUpdate covered above).
    test('returns 409 when concurrent status changes race for the same listing', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      // A cold pool.query connection takes tens of ms to establish, which
      // staggers requests enough that they stop actually overlapping. Warming
      // the pool first with some throwaway parallel queries means the real
      // requests below all already have a connection ready and genuinely race.
      await Promise.all(Array.from({ length: 10 }, () => pool.query('SELECT 1')));

      // `request(app)` spins up a brand new ephemeral server per call, so
      // back-to-back calls end up serialized by that setup cost rather than
      // truly racing. An agent binds one server up front and reuses it, so
      // requests fired through it actually overlap at the DB layer.
      const agent = request.agent(app);

      const responses = await Promise.all(
        Array.from({ length: 6 }, () =>
          agent
            .patch(`/api/listings/${listing.id}/status`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ status: 'RESERVED' }),
        ),
      );

      const statuses = responses.map((r) => r.status);
      expect(statuses).toContain(200);
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);

      const losers = responses.filter((r) => r.status !== 200);
      losers.forEach((loser) => {
        expect(loser.status).toBe(409);
        expect(loser.body).toEqual({
          message:
            'The listing status changed before this request was completed. Please try again.',
        });
      });
    });
  });

  describe('DELETE /api/listings/:id', () => {
    // Invalid partition: non-numeric id fails the integer cast in Postgres
    test('returns 500 for a non-numeric listing id', async () => {
      const response = await request(app)
        .delete('/api/listings/not-a-number')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(500);
    });

    test('does not allow another user to delete the listing', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .delete(`/api/listings/${listing.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(404);

      expect(response.body).toEqual({
        message: 'Listing not found or you are not the owner.',
      });

      // Confirm that the listing still exists.
      const databaseResult = await pool.query(
        `
          SELECT id
          FROM listings
          WHERE id = $1
        `,
        [listing.id],
      );

      expect(databaseResult.rows).toHaveLength(1);
    });

    test('allows the owner to delete their listing', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .delete(`/api/listings/${listing.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        message: 'Listing deleted successfully.',
      });

      // Confirm that the listing was removed from the database.
      const databaseResult = await pool.query(
        `
          SELECT id
          FROM listings
          WHERE id = $1
        `,
        [listing.id],
      );

      expect(databaseResult.rows).toHaveLength(0);
    });
  });
});
