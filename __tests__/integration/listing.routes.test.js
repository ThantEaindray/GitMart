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
 * The existing Something and Person tests use different tables, so they
 * are not affected by this cleanup.
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
  });

  describe('PATCH /api/listings/:id', () => {
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

  describe('DELETE /api/listings/:id', () => {
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
