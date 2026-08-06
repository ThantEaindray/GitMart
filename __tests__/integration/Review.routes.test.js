process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

let reviewer;
let listingId;
let reviewerToken;

function createAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn: '1h',
  });
}

async function insertUser(username, email) {
  const result = await pool.query(
    `INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email`,
    [username, email, 'not-used-by-these-tests'],
  );
  return result.rows[0];
}

async function insertListing(ownerId) {
  const result = await pool.query(
    `INSERT INTO listings (owner_id, price, title, description, category)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [ownerId, 150, 'Review Test Listing', 'A listing for review testing', 'Others'],
  );
  return result.rows[0].id;
}

beforeEach(async () => {
  await pool.query(`
    TRUNCATE TABLE
      listing_reviews,
      chatcontent,
      offers,
      chats,
      listing_views,
      listings,
      refresh_tokens,
      users
    RESTART IDENTITY CASCADE
  `);

  reviewer = await insertUser('review_user', 'review.user@example.com');
  reviewerToken = createAccessToken(reviewer.id);
  listingId = await insertListing(reviewer.id);
});

afterAll(async () => {
  await pool.end();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/listings/:id/reviews
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/listings/:id/reviews', () => {
  // Valid partition: public route returns 200 without auth
  test('should return 200 and empty array when listing has no reviews', async () => {
    const res = await request(app).get(`/api/listings/${listingId}/reviews`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  // Valid partition: returns review after one is created
  test('should return 200 and include created review', async () => {
    await pool.query(
      `INSERT INTO listing_reviews (listing_id, reviewer_id, rating, comment)
       VALUES ($1, $2, $3, $4)`,
      [listingId, reviewer.id, 4, 'Looks good'],
    );

    const res = await request(app).get(`/api/listings/${listingId}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ rating: 4, comment: 'Looks good' });
  });

  // Valid partition: response includes reviewer_name from JOIN
  test('should include reviewer_name in response', async () => {
    await pool.query(
      `INSERT INTO listing_reviews (listing_id, reviewer_id, rating, comment)
       VALUES ($1, $2, $3, $4)`,
      [listingId, reviewer.id, 5, null],
    );

    const res = await request(app).get(`/api/listings/${listingId}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('reviewer_name', reviewer.username);
  });

  // Boundary: non-existent listing returns 200 with empty array
  test('should return 200 and empty array for a listing with no reviews', async () => {
    const res = await request(app).get('/api/listings/999999/reviews');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Invalid partition: non-numeric id fails the listing_id integer cast in Postgres
  test('should return 500 for a non-numeric listing id', async () => {
    const res = await request(app).get('/api/listings/not-a-number/reviews');

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/listings/:id/reviews
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/listings/:id/reviews', () => {
  // Invalid partition: no token → 401
  test('should return 401 when no auth token is provided', async () => {
    const res = await request(app).post(`/api/listings/${listingId}/reviews`).send({ rating: 4 });

    expect(res.status).toBe(401);
  });

  // Invalid partition: missing rating → 400
  test('should return 400 when rating is missing', async () => {
    const res = await request(app)
      .post(`/api/listings/${listingId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  // Invalid partition: no body at all (as opposed to an empty JSON object)
  // covers the `req.body || {}` fallback rather than destructuring `{}` itself.
  test('should return 400 when no body is sent at all', async () => {
    const res = await request(app)
      .post(`/api/listings/${listingId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(400);
  });

  // Invalid partition: rating below 1 → 400
  test('should return 400 when rating is below 1', async () => {
    const res = await request(app)
      .post(`/api/listings/${listingId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ rating: 0 });

    expect(res.status).toBe(400);
  });

  // Invalid partition: a negative rating is truthy (unlike 0), so this only
  // fails the `Number(rating) < 1` check rather than the `!rating` check above.
  test('should return 400 for a negative rating', async () => {
    const res = await request(app)
      .post(`/api/listings/${listingId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ rating: -1 });

    expect(res.status).toBe(400);
  });

  // Invalid partition: rating above 5 → 400
  test('should return 400 when rating is above 5', async () => {
    const res = await request(app)
      .post(`/api/listings/${listingId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ rating: 6 });

    expect(res.status).toBe(400);
  });

  // Valid partition: authenticated user posts a review → 201
  test('should return 201 and created review on success', async () => {
    const res = await request(app)
      .post(`/api/listings/${listingId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ rating: 4, comment: 'Solid listing' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      listing_id: listingId,
      reviewer_id: reviewer.id,
      rating: 4,
      comment: 'Solid listing',
    });
    expect(res.body).toHaveProperty('id');
  });

  // Valid partition: comment is optional
  test('should return 201 when comment is omitted', async () => {
    const res = await request(app)
      .post(`/api/listings/${listingId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ rating: 5 });

    expect(res.status).toBe(201);
    expect(res.body.comment).toBeNull();
  });

  // Boundary: valid rating of 1 → 201
  test('should return 201 for boundary rating of 1', async () => {
    const res = await request(app)
      .post(`/api/listings/${listingId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ rating: 1 });

    expect(res.status).toBe(201);
  });

  // Boundary: valid rating of 5 → 201
  test('should return 201 for boundary rating of 5', async () => {
    const res = await request(app)
      .post(`/api/listings/${listingId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ rating: 5 });

    expect(res.status).toBe(201);
  });

  // Invalid partition: listing_id has a FOREIGN KEY constraint, so a review
  // against a listing that does not exist is rejected by Postgres itself
  // (23503) rather than by the duplicate-review check (23505) above.
  test('should return 500 when the listing does not exist', async () => {
    const res = await request(app)
      .post('/api/listings/999999/reviews')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ rating: 4 });

    expect(res.status).toBe(500);
  });

  // Boundary: duplicate review → 409
  test('should return 409 when user submits a second review for the same listing', async () => {
    await request(app)
      .post(`/api/listings/${listingId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ rating: 3 });

    const res = await request(app)
      .post(`/api/listings/${listingId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ rating: 5 });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('message');
  });

  // Valid partition: created review appears in GET
  test('posted review should appear in GET /api/listings/:id/reviews', async () => {
    await request(app)
      .post(`/api/listings/${listingId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ rating: 4, comment: 'Check list' });

    const getRes = await request(app).get(`/api/listings/${listingId}/reviews`);

    expect(getRes.status).toBe(200);
    const found = getRes.body.find((r) => r.reviewer_id === reviewer.id);
    expect(found).toBeDefined();
    expect(found.rating).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/listings/:id/reviews/:reviewId
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/listings/:id/reviews/:reviewId', () => {
  let reviewId;

  beforeEach(async () => {
    const result = await pool.query(
      `INSERT INTO listing_reviews (listing_id, reviewer_id, rating, comment)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [listingId, reviewer.id, 3, 'Test review'],
    );
    reviewId = result.rows[0].id;
  });

  // Invalid partition: no token → 401
  test('should return 401 when no auth token is provided', async () => {
    const res = await request(app).delete(`/api/listings/${listingId}/reviews/${reviewId}`);

    expect(res.status).toBe(401);
  });

  // Boundary: review does not exist → 404
  test('should return 404 when review does not exist', async () => {
    const res = await request(app)
      .delete(`/api/listings/${listingId}/reviews/999999`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message');
  });

  // Invalid partition: non-numeric id fails the reviewId integer cast in Postgres
  test('should return 500 for a non-numeric review id', async () => {
    const res = await request(app)
      .delete(`/api/listings/${listingId}/reviews/not-a-number`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(500);
  });

  // Invalid partition: different reviewer cannot delete → 404
  test('should return 404 when reviewer does not own the review', async () => {
    const otherUser = await insertUser('other_reviewer', 'other@example.com');
    const otherToken = createAccessToken(otherUser.id);

    const res = await request(app)
      .delete(`/api/listings/${listingId}/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  // Valid partition: reviewer deletes their own review → 200
  test('should return 200 and success message on deletion', async () => {
    const res = await request(app)
      .delete(`/api/listings/${listingId}/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Review deleted.');
  });

  // Valid partition: deleted review no longer appears in GET
  test('deleted review should not appear in GET /api/listings/:id/reviews', async () => {
    await request(app)
      .delete(`/api/listings/${listingId}/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    const getRes = await request(app).get(`/api/listings/${listingId}/reviews`);

    expect(getRes.status).toBe(200);
    const found = getRes.body.find((r) => r.id === reviewId);
    expect(found).toBeUndefined();
  });
});
