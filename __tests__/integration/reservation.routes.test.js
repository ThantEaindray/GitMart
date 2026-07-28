process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

let owner;
let requester;
let otherUser;
let ownerToken;
let requesterToken;
let otherUserToken;

/**
 * Creates a valid access token for a test user.
 *
 * Uses the same test secret as the real JWT middleware, so requests still
 * pass through the application's actual verifyToken middleware.
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
 * The password is not used because these tests exercise reservation
 * routes, not the login route.
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
 */
async function insertListing({
  ownerId = owner.id,
  title = 'Reservation Test Listing',
  status = 'AVAILABLE',
} = {}) {
  const flagsByStatus = {
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

  const flags = flagsByStatus[status];

  if (!flags) {
    throw new Error(`Unsupported test listing status: ${status}`);
  }

  const result = await pool.query(
    `
      INSERT INTO listings (
        owner_id,
        title,
        description,
        price,
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
      title,
      'A listing created for reservation testing.',
      250,
      'Electronics',
      status,
      flags.isSold,
      flags.isClosed,
    ],
  );

  return result.rows[0];
}

/**
 * Inserts a reservation request directly into the test database.
 */
async function insertReservationRequest({
  listingId,
  requesterId = requester.id,
  status = 'PENDING',
  message = null,
}) {
  const result = await pool.query(
    `
      INSERT INTO reservation_requests (listing_id, requester_id, status, message)
      VALUES ($1, $2, $3, $4)
      RETURNING id, listing_id, requester_id, status, message, created_on, updated_on
    `,
    [listingId, requesterId, status, message],
  );

  return result.rows[0];
}

/**
 * Reset only the tables this suite touches before every test.
 */
beforeEach(async () => {
  await pool.query(`
    TRUNCATE TABLE
      reservation_requests,
      chatcontent,
      offers,
      chats,
      listing_views,
      listings,
      refresh_tokens,
      users
    RESTART IDENTITY CASCADE
  `);

  owner = await insertUser('reservation_owner', 'reservation.owner@example.com');
  requester = await insertUser('reservation_requester', 'reservation.requester@example.com');
  otherUser = await insertUser('reservation_other', 'reservation.other@example.com');

  ownerToken = createAccessToken(owner.id);
  requesterToken = createAccessToken(requester.id);
  otherUserToken = createAccessToken(otherUser.id);
});

afterAll(async () => {
  await pool.end();
});

describe('Reservation API', () => {
  // ───────────────────────────────────────────────────────
  // POST /api/listings/:listingId/reservations
  // ───────────────────────────────────────────────────────
  describe('POST /api/listings/:listingId/reservations', () => {
    test('returns 401 when no access token is provided', async () => {
      const listing = await insertListing();

      const response = await request(app).post(`/api/listings/${listing.id}/reservations`);

      expect(response.status).toBe(401);
    });

    test('returns 400 when the listing ID is not a positive integer', async () => {
      const response = await request(app)
        .post('/api/listings/not-a-number/reservations')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Listing ID must be a positive integer.',
      });
    });

    test('returns 404 when the listing does not exist', async () => {
      const response = await request(app)
        .post('/api/listings/999999/reservations')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        message: 'Listing not found.',
      });
    });

    test('returns 409 when the listing has no owner', async () => {
      const ownerlessListing = await insertListing({ ownerId: null });

      const response = await request(app)
        .post(`/api/listings/${ownerlessListing.id}/reservations`)
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        message: 'This listing cannot receive reservation requests because it has no owner.',
      });
    });

    test('returns 403 when the owner tries to reserve their own listing', async () => {
      const listing = await insertListing();

      const response = await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: 'You cannot reserve your own listing.',
      });
    });

    test('returns 409 when the listing is not AVAILABLE', async () => {
      const listing = await insertListing({ status: 'RESERVED' });

      const response = await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        message: 'Only available listings can be reserved.',
      });
    });

    test('returns 400 when the message exceeds 500 characters', async () => {
      const listing = await insertListing();
      const longMessage = 'a'.repeat(501);

      const response = await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ message: longMessage });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Reservation message cannot exceed 500 characters.',
      });
    });

    test('returns 400 when the message is not a string', async () => {
      const listing = await insertListing();

      const response = await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ message: 12345 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Reservation message must be text.',
      });
    });

    test('allows an authenticated user to create a reservation request', async () => {
      const listing = await insertListing();

      const response = await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ message: 'Is this still available?' });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Reservation request created successfully.');
      expect(response.body.reservation).toMatchObject({
        listing_id: listing.id,
        requester_id: requester.id,
        status: 'PENDING',
        message: 'Is this still available?',
      });

      const databaseResult = await pool.query(
        `SELECT listing_id, requester_id, status FROM reservation_requests WHERE id = $1`,
        [response.body.reservation.id],
      );

      expect(databaseResult.rows[0]).toMatchObject({
        listing_id: listing.id,
        requester_id: requester.id,
        status: 'PENDING',
      });
    });

    test('returns 409 when the requester already has a pending request for the listing', async () => {
      const listing = await insertListing();

      await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${requesterToken}`);

      const response = await request(app)
        .post(`/api/listings/${listing.id}/reservations`)
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        message: 'You already have a pending reservation request for this listing.',
      });
    });
  });

  // ───────────────────────────────────────────────────────
  // GET /api/reservations/sent
  // ───────────────────────────────────────────────────────
  describe('GET /api/reservations/sent', () => {
    test('returns 401 when no access token is provided', async () => {
      const response = await request(app).get('/api/reservations/sent');

      expect(response.status).toBe(401);
    });

    test('returns 200 and an empty array when the user has sent no requests', async () => {
      const response = await request(app)
        .get('/api/reservations/sent')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('returns only the requests sent by the logged-in user', async () => {
      const listing = await insertListing();
      const sentReservation = await insertReservationRequest({ listingId: listing.id });

      const otherListing = await insertListing({ title: 'Other Listing' });
      await insertReservationRequest({ listingId: otherListing.id, requesterId: otherUser.id });

      const response = await request(app)
        .get('/api/reservations/sent')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: sentReservation.id,
        listing_id: listing.id,
        requester_id: requester.id,
      });
    });
  });

  // ───────────────────────────────────────────────────────
  // GET /api/reservations/received
  // ───────────────────────────────────────────────────────
  describe('GET /api/reservations/received', () => {
    test('returns 401 when no access token is provided', async () => {
      const response = await request(app).get('/api/reservations/received');

      expect(response.status).toBe(401);
    });

    test('returns 200 and an empty array when the owner has received no requests', async () => {
      const response = await request(app)
        .get('/api/reservations/received')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test("returns only requests received on the logged-in owner's listings", async () => {
      const listing = await insertListing();
      const receivedReservation = await insertReservationRequest({ listingId: listing.id });

      const otherOwnerListing = await insertListing({
        ownerId: otherUser.id,
        title: "Someone Else's Listing",
      });
      await insertReservationRequest({ listingId: otherOwnerListing.id, requesterId: owner.id });

      const response = await request(app)
        .get('/api/reservations/received')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: receivedReservation.id,
        listing_id: listing.id,
        requester_id: requester.id,
        requester_username: requester.username,
      });
    });
  });

  // ───────────────────────────────────────────────────────
  // PATCH /api/reservations/:id/cancel
  // ───────────────────────────────────────────────────────
  describe('PATCH /api/reservations/:id/cancel', () => {
    test('returns 401 when no access token is provided', async () => {
      const listing = await insertListing();
      const reservation = await insertReservationRequest({ listingId: listing.id });

      const response = await request(app).patch(`/api/reservations/${reservation.id}/cancel`);

      expect(response.status).toBe(401);
    });

    test('returns 400 when the reservation ID is not a positive integer', async () => {
      const response = await request(app)
        .patch('/api/reservations/not-a-number/cancel')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Reservation ID must be a positive integer.',
      });
    });

    test('returns 404 when the reservation does not exist', async () => {
      const response = await request(app)
        .patch('/api/reservations/999999/cancel')
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        message: 'Reservation request not found.',
      });
    });

    test('returns 403 when someone other than the requester tries to cancel', async () => {
      const listing = await insertListing();
      const reservation = await insertReservationRequest({ listingId: listing.id });

      const response = await request(app)
        .patch(`/api/reservations/${reservation.id}/cancel`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: 'Only the requester can cancel this reservation request.',
      });
    });

    test('returns 409 when the reservation is no longer pending', async () => {
      const listing = await insertListing();
      const reservation = await insertReservationRequest({
        listingId: listing.id,
        status: 'REJECTED',
      });

      const response = await request(app)
        .patch(`/api/reservations/${reservation.id}/cancel`)
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        message: 'Only pending reservation requests can be cancelled.',
      });
    });

    test('allows the requester to cancel their pending reservation', async () => {
      const listing = await insertListing();
      const reservation = await insertReservationRequest({ listingId: listing.id });

      const response = await request(app)
        .patch(`/api/reservations/${reservation.id}/cancel`)
        .set('Authorization', `Bearer ${requesterToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Reservation request cancelled successfully.');
      expect(response.body.reservation.status).toBe('CANCELLED');

      const databaseResult = await pool.query(
        `SELECT status FROM reservation_requests WHERE id = $1`,
        [reservation.id],
      );

      expect(databaseResult.rows[0].status).toBe('CANCELLED');
    });
  });

  // ───────────────────────────────────────────────────────
  // PATCH /api/reservations/:id/accept
  // ───────────────────────────────────────────────────────
  describe('PATCH /api/reservations/:id/accept', () => {
    test('returns 401 when no access token is provided', async () => {
      const listing = await insertListing();
      const reservation = await insertReservationRequest({ listingId: listing.id });

      const response = await request(app).patch(`/api/reservations/${reservation.id}/accept`);

      expect(response.status).toBe(401);
    });

    test('returns 400 when the reservation ID is not a positive integer', async () => {
      const response = await request(app)
        .patch('/api/reservations/not-a-number/accept')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Reservation ID must be a positive integer.',
      });
    });

    test('returns 404 when the reservation does not exist', async () => {
      const response = await request(app)
        .patch('/api/reservations/999999/accept')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        message: 'Reservation request not found.',
      });
    });

    test('returns 403 when someone other than the listing owner tries to accept', async () => {
      const listing = await insertListing();
      const reservation = await insertReservationRequest({ listingId: listing.id });

      const response = await request(app)
        .patch(`/api/reservations/${reservation.id}/accept`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: 'Only the listing owner can accept reservation requests.',
      });

      const databaseResult = await pool.query(
        `SELECT status FROM reservation_requests WHERE id = $1`,
        [reservation.id],
      );

      expect(databaseResult.rows[0].status).toBe('PENDING');
    });

    test('returns 409 when the reservation is no longer pending', async () => {
      const listing = await insertListing();
      const reservation = await insertReservationRequest({
        listingId: listing.id,
        status: 'CANCELLED',
      });

      const response = await request(app)
        .patch(`/api/reservations/${reservation.id}/accept`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('Only pending reservation requests can be accepted');
    });

    test('returns 409 when the listing is no longer AVAILABLE', async () => {
      const listing = await insertListing({ status: 'ARCHIVED' });
      const reservation = await insertReservationRequest({ listingId: listing.id });

      const response = await request(app)
        .patch(`/api/reservations/${reservation.id}/accept`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(409);
      expect(response.body.message).toContain(
        'Only listings with AVAILABLE status can be reserved',
      );
    });

    test('allows the owner to accept a pending reservation, reserves the listing, and rejects competing pending requests', async () => {
      const listing = await insertListing();
      const acceptedTarget = await insertReservationRequest({
        listingId: listing.id,
        requesterId: requester.id,
      });
      const competingRequest = await insertReservationRequest({
        listingId: listing.id,
        requesterId: otherUser.id,
      });

      const response = await request(app)
        .patch(`/api/reservations/${acceptedTarget.id}/accept`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Reservation request accepted successfully.');
      expect(response.body.reservation.status).toBe('ACCEPTED');

      const acceptedRow = await pool.query(
        `SELECT status FROM reservation_requests WHERE id = $1`,
        [acceptedTarget.id],
      );
      expect(acceptedRow.rows[0].status).toBe('ACCEPTED');

      const competingRow = await pool.query(
        `SELECT status FROM reservation_requests WHERE id = $1`,
        [competingRequest.id],
      );
      expect(competingRow.rows[0].status).toBe('REJECTED');

      const listingRow = await pool.query(`SELECT status FROM listings WHERE id = $1`, [
        listing.id,
      ]);
      expect(listingRow.rows[0].status).toBe('RESERVED');
    });
  });

  // ───────────────────────────────────────────────────────
  // PATCH /api/reservations/:id/reject
  // ───────────────────────────────────────────────────────
  describe('PATCH /api/reservations/:id/reject', () => {
    test('returns 401 when no access token is provided', async () => {
      const listing = await insertListing();
      const reservation = await insertReservationRequest({ listingId: listing.id });

      const response = await request(app).patch(`/api/reservations/${reservation.id}/reject`);

      expect(response.status).toBe(401);
    });

    test('returns 400 when the reservation ID is not a positive integer', async () => {
      const response = await request(app)
        .patch('/api/reservations/not-a-number/reject')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'Reservation ID must be a positive integer.',
      });
    });

    test('returns 404 when the reservation does not exist', async () => {
      const response = await request(app)
        .patch('/api/reservations/999999/reject')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        message: 'Reservation request not found.',
      });
    });

    test('returns 403 when someone other than the listing owner tries to reject', async () => {
      const listing = await insertListing();
      const reservation = await insertReservationRequest({ listingId: listing.id });

      const response = await request(app)
        .patch(`/api/reservations/${reservation.id}/reject`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        message: 'Only the listing owner can reject reservation requests.',
      });
    });

    test('returns 409 when the reservation is no longer pending', async () => {
      const listing = await insertListing();
      const reservation = await insertReservationRequest({
        listingId: listing.id,
        status: 'ACCEPTED',
      });

      const response = await request(app)
        .patch(`/api/reservations/${reservation.id}/reject`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        message: 'Only pending reservation requests can be rejected.',
      });
    });

    test('allows the owner to reject a pending reservation without affecting the listing status', async () => {
      const listing = await insertListing();
      const reservation = await insertReservationRequest({ listingId: listing.id });

      const response = await request(app)
        .patch(`/api/reservations/${reservation.id}/reject`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Reservation request rejected successfully.');
      expect(response.body.reservation.status).toBe('REJECTED');

      const reservationRow = await pool.query(
        `SELECT status FROM reservation_requests WHERE id = $1`,
        [reservation.id],
      );
      expect(reservationRow.rows[0].status).toBe('REJECTED');

      const listingRow = await pool.query(`SELECT status FROM listings WHERE id = $1`, [
        listing.id,
      ]);
      expect(listingRow.rows[0].status).toBe('AVAILABLE');
    });
  });
});
