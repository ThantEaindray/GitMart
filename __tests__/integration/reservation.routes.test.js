process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../../src/app');
const pool = require('../../src/models/db');

const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

let owner;
let buyer;
let otherUser;

let ownerToken;
let buyerToken;
let otherUserToken;

function createAccessToken(userId) {
  return jwt.sign(
    {
      userId,
    },
    process.env.JWT_SECRET_KEY,
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: '1h',
    },
  );
}

async function insertUser(username, email) {
  const result = await pool.query(
    `
      INSERT INTO users (
        username,
        email,
        password
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        username,
        email
    `,
    [username, email, 'not-used-by-reservation-tests'],
  );

  return result.rows[0];
}

async function insertListing({
  ownerId,
  status = 'AVAILABLE',
  title = 'Reservation Test Listing',
}) {
  const compatibilityFlags = {
    AVAILABLE: {
      isSold: false,
      isClosed: false,
    },
    RESERVED: {
      isSold: false,
      isClosed: false,
    },
    SOLD: {
      isSold: true,
      isClosed: false,
    },
    ARCHIVED: {
      isSold: false,
      isClosed: true,
    },
  };

  const flags = compatibilityFlags[status];

  if (!flags) {
    throw new Error(`Unsupported test listing status: ${status}`);
  }

  const result = await pool.query(
    `
      INSERT INTO listings (
        owner_id,
        price,
        title,
        description,
        category,
        status,
        "isSold",
        "isClosed"
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      )
      RETURNING
        id,
        owner_id,
        title,
        status,
        "isSold",
        "isClosed"
    `,
    [
      ownerId,
      250,
      title,
      'A listing created for reservation testing.',
      'Electronics',
      status,
      flags.isSold,
      flags.isClosed,
    ],
  );

  return result.rows[0];
}

async function insertReservation({
  listingId,
  requesterId,
  status = 'PENDING',
  message = 'Please reserve this item for me.',
}) {
  const result = await pool.query(
    `
      INSERT INTO reservation_requests (
        listing_id,
        requester_id,
        status,
        message
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        listing_id,
        requester_id,
        status,
        message,
        created_on,
        updated_on
    `,
    [listingId, requesterId, status, message],
  );

  return result.rows[0];
}

beforeEach(async () => {
  /*
   * Truncating users with CASCADE also clears listings,
   * reservation requests, wishlist records, view history,
   * tokens, chats and other dependent test records.
   */
  await pool.query(`
    TRUNCATE TABLE users
    RESTART IDENTITY CASCADE
  `);

  owner = await insertUser('reservation_owner', 'reservation.owner@example.com');

  buyer = await insertUser('reservation_buyer', 'reservation.buyer@example.com');

  otherUser = await insertUser('reservation_other', 'reservation.other@example.com');

  ownerToken = createAccessToken(owner.id);
  buyerToken = createAccessToken(buyer.id);
  otherUserToken = createAccessToken(otherUser.id);
});

afterAll(async () => {
  await pool.end();
});

describe('Reservation request API', () => {
  describe('POST /api/listings/:listingId/reservations', () => {
    test('returns 401 when no access token is provided', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app).post(`/api/listings/${listing.id}/reservations`).send({
        message: 'Please reserve this.',
      });

      expect(response.status).toBe(401);

      expect(response.body).toEqual({
        error: 'No token provided',
      });
    });

    test('returns 400 when the listing ID is invalid', async () => {
      const response = await request(app)
        .post('/api/listings/not-a-number/reservations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({});

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        message: 'Listing ID must be a positive integer.',
      });
    });

    test('returns 400 when the message is not text', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          message: 123,
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        message: 'Reservation message must be text.',
      });
    });

    test('returns 400 when the message exceeds 500 characters', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          message: 'a'.repeat(501),
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        message: 'Reservation message cannot exceed 500 characters.',
      });
    });

    test('returns 404 when the listing does not exist', async () => {
      const response = await request(app)
        .post('/api/listings/999999/reservations')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({});

      expect(response.status).toBe(404);

      expect(response.body).toEqual({
        message: 'Listing not found.',
      });
    });

    test('rejects a reservation for an ownerless listing', async () => {
      const listing = await insertListing({
        ownerId: null,
      });

      const response = await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({});

      expect(response.status).toBe(409);

      expect(response.body).toEqual({
        message: 'This listing cannot receive reservation requests because it has no owner.',
      });
    });

    test('does not allow a user to reserve their own listing', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});

      expect(response.status).toBe(403);

      expect(response.body).toEqual({
        message: 'You cannot reserve your own listing.',
      });
    });

    test('rejects a reservation when the listing is not available', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
        status: 'RESERVED',
      });

      const response = await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({});

      expect(response.status).toBe(409);

      expect(response.body).toEqual({
        message: 'Only available listings can be reserved.',
      });
    });

    test('creates a pending reservation request', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const response = await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          message: '  Can you reserve this for me?  ',
        });

      expect(response.status).toBe(201);

      expect(response.body.message).toBe('Reservation request created successfully.');

      expect(response.body.reservation).toMatchObject({
        listing_id: listing.id,
        requester_id: buyer.id,
        status: 'PENDING',
        message: 'Can you reserve this for me?',
      });

      expect(response.body.reservation.created_on).toBeDefined();

      expect(response.body.reservation.updated_on).toBeDefined();

      const databaseResult = await pool.query(
        `
            SELECT
              listing_id,
              requester_id,
              status,
              message
            FROM reservation_requests
            WHERE id = $1
          `,
        [response.body.reservation.id],
      );

      expect(databaseResult.rows).toHaveLength(1);

      expect(databaseResult.rows[0]).toMatchObject({
        listing_id: listing.id,
        requester_id: buyer.id,
        status: 'PENDING',
        message: 'Can you reserve this for me?',
      });
    });

    test('rejects a duplicate pending reservation request', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const firstResponse = await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({});

      expect(firstResponse.status).toBe(201);

      const secondResponse = await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({});

      expect(secondResponse.status).toBe(409);

      expect(secondResponse.body).toEqual({
        message: 'You already have a pending reservation request for this listing.',
      });

      const databaseResult = await pool.query(
        `
            SELECT id
            FROM reservation_requests
            WHERE listing_id = $1
              AND requester_id = $2
              AND status = 'PENDING'
          `,
        [listing.id, buyer.id],
      );

      expect(databaseResult.rows).toHaveLength(1);
    });
  });

  describe('GET /api/reservations/sent', () => {
    test('returns only requests submitted by the logged-in user', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const buyerRequest = await insertReservation({
        listingId: listing.id,
        requesterId: buyer.id,
      });

      await insertReservation({
        listingId: listing.id,
        requesterId: otherUser.id,
      });

      const response = await request(app)
        .get('/api/reservations/sent')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);

      expect(response.body[0]).toMatchObject({
        id: buyerRequest.id,
        listing_id: listing.id,
        requester_id: buyer.id,
        status: 'PENDING',
        title: listing.title,
        owner_id: owner.id,
        owner_username: owner.username,
      });
    });
  });

  describe('GET /api/reservations/received', () => {
    test('returns only requests for listings owned by the logged-in user', async () => {
      const ownerListing = await insertListing({
        ownerId: owner.id,
        title: 'Owner Reservation Listing',
      });

      const otherListing = await insertListing({
        ownerId: otherUser.id,
        title: 'Other User Listing',
      });

      const ownerRequest = await insertReservation({
        listingId: ownerListing.id,
        requesterId: buyer.id,
      });

      await insertReservation({
        listingId: otherListing.id,
        requesterId: buyer.id,
      });

      const response = await request(app)
        .get('/api/reservations/received')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);

      expect(response.body[0]).toMatchObject({
        id: ownerRequest.id,
        listing_id: ownerListing.id,
        requester_id: buyer.id,
        status: 'PENDING',
        title: ownerListing.title,
        owner_id: owner.id,
        requester_username: buyer.username,
      });
    });
  });

  describe('PATCH /api/reservations/:id/cancel', () => {
    test('returns 400 when the reservation ID is invalid', async () => {
      const response = await request(app)
        .patch('/api/reservations/not-a-number/cancel')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        message: 'Reservation ID must be a positive integer.',
      });
    });

    test('returns 404 when the reservation does not exist', async () => {
      const response = await request(app)
        .patch('/api/reservations/999999/cancel')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(response.status).toBe(404);

      expect(response.body).toEqual({
        message: 'Reservation request not found.',
      });
    });

    test('does not allow another user to cancel the request', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const reservation = await insertReservation({
        listingId: listing.id,
        requesterId: buyer.id,
      });

      const response = await request(app)
        .patch(`/api/reservations/${reservation.id}/cancel`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);

      expect(response.body).toEqual({
        message: 'Only the requester can cancel this reservation request.',
      });

      const databaseResult = await pool.query(
        `
            SELECT status
            FROM reservation_requests
            WHERE id = $1
          `,
        [reservation.id],
      );

      expect(databaseResult.rows[0].status).toBe('PENDING');
    });

    test('rejects cancellation when the request is no longer pending', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const reservation = await insertReservation({
        listingId: listing.id,
        requesterId: buyer.id,
        status: 'REJECTED',
      });

      const response = await request(app)
        .patch(`/api/reservations/${reservation.id}/cancel`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(response.status).toBe(409);

      expect(response.body).toEqual({
        message: 'Only pending reservation requests can be cancelled.',
      });
    });

    test('allows the requester to cancel a pending request', async () => {
      const listing = await insertListing({
        ownerId: owner.id,
      });

      const reservation = await insertReservation({
        listingId: listing.id,
        requesterId: buyer.id,
      });

      const response = await request(app)
        .patch(`/api/reservations/${reservation.id}/cancel`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(response.status).toBe(200);

      expect(response.body.message).toBe('Reservation request cancelled successfully.');

      expect(response.body.reservation).toMatchObject({
        id: reservation.id,
        listing_id: listing.id,
        requester_id: buyer.id,
        status: 'CANCELLED',
      });

      const databaseResult = await pool.query(
        `
            SELECT status
            FROM reservation_requests
            WHERE id = $1
          `,
        [reservation.id],
      );

      expect(databaseResult.rows[0].status).toBe('CANCELLED');
    });
  });
});
