const pool = require('../../src/models/db');
const {
  createReview,
  getReviewsByListing,
  deleteReview,
} = require('../../src/models/Review.model');

jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => jest.restoreAllMocks());

function mockQuery(err, rows) {
  pool.query.mockImplementation((...args) => {
    const callback = args[args.length - 1];
    callback(err, err ? null : { rows });
  });
}

const fakeReview = {
  id: 1,
  listing_id: 10,
  reviewer_id: 5,
  rating: 4,
  comment: 'Great item',
  created_on: '2026-07-27T00:00:00.000Z',
};

const fakeReviewWithUser = {
  ...fakeReview,
  reviewer_name: 'testbuyer',
};

// ── createReview ──────────────────────────────────────────────────────────────

describe('Review.model - createReview', () => {
  afterEach(() => jest.clearAllMocks());

  test('should insert review and return it via callback', (done) => {
    mockQuery(null, [fakeReview]);

    createReview({ listingId: 10, reviewerId: 5, rating: 4, comment: 'Great item' }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([10, 5, 4, 'Great item']);
      expect(result.rows[0]).toEqual(fakeReview);
      done();
    });
  });

  test('should pass null comment correctly to pool.query', (done) => {
    mockQuery(null, [{ ...fakeReview, comment: null }]);

    createReview({ listingId: 10, reviewerId: 5, rating: 3, comment: null }, (err) => {
      expect(err).toBeNull();
      const [, values] = pool.query.mock.calls[0];
      expect(values[3]).toBeNull();
      done();
    });
  });

  test('should use INSERT SQL statement', (done) => {
    mockQuery(null, [fakeReview]);

    createReview({ listingId: 10, reviewerId: 5, rating: 4, comment: null }, () => {
      const [sql] = pool.query.mock.calls[0];
      expect(sql.toUpperCase()).toContain('INSERT');
      done();
    });
  });

  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('insert failed');
    mockQuery(dbError, null);

    createReview({ listingId: 10, reviewerId: 5, rating: 4, comment: null }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });

  test('should propagate duplicate key error (code 23505) without wrapping', (done) => {
    const dupError = Object.assign(new Error('unique violation'), { code: '23505' });
    mockQuery(dupError, null);

    createReview({ listingId: 10, reviewerId: 5, rating: 4, comment: null }, (err) => {
      expect(err.code).toBe('23505');
      done();
    });
  });

  test('should call pool.query exactly once', (done) => {
    mockQuery(null, [fakeReview]);

    createReview({ listingId: 10, reviewerId: 5, rating: 5, comment: 'Excellent' }, () => {
      expect(pool.query).toHaveBeenCalledTimes(1);
      done();
    });
  });
});

// ── getReviewsByListing ────────────────────────────────────────────────────────

describe('Review.model - getReviewsByListing', () => {
  afterEach(() => jest.clearAllMocks());

  test('should return reviews for a listing via callback', (done) => {
    mockQuery(null, [fakeReviewWithUser]);

    getReviewsByListing({ listingId: 10 }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([10]);
      expect(result.rows[0]).toEqual(fakeReviewWithUser);
      done();
    });
  });

  test('should return empty array when listing has no reviews', (done) => {
    mockQuery(null, []);

    getReviewsByListing({ listingId: 99 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  test('should return all reviews when listing has multiple', (done) => {
    const second = { ...fakeReviewWithUser, id: 2, rating: 5, reviewer_id: 6, reviewer_name: 'user2' };
    mockQuery(null, [fakeReviewWithUser, second]);

    getReviewsByListing({ listingId: 10 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toHaveLength(2);
      done();
    });
  });

  test('should use SELECT SQL statement', (done) => {
    mockQuery(null, []);

    getReviewsByListing({ listingId: 10 }, () => {
      const [sql] = pool.query.mock.calls[0];
      expect(sql.toUpperCase()).toContain('SELECT');
      done();
    });
  });

  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('query failed');
    mockQuery(dbError, null);

    getReviewsByListing({ listingId: 10 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });

  test('should pass different listingId correctly to pool.query', (done) => {
    mockQuery(null, []);

    getReviewsByListing({ listingId: 42 }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe(42);
      done();
    });
  });
});

// ── deleteReview ──────────────────────────────────────────────────────────────

describe('Review.model - deleteReview', () => {
  afterEach(() => jest.clearAllMocks());

  test('should delete review and return it via callback', (done) => {
    mockQuery(null, [{ id: 1 }]);

    deleteReview({ reviewId: 1, reviewerId: 5 }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([1, 5]);
      expect(result.rows[0]).toEqual({ id: 1 });
      done();
    });
  });

  test('should return empty rows when review does not exist or reviewer does not match', (done) => {
    mockQuery(null, []);

    deleteReview({ reviewId: 999, reviewerId: 5 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  test('should use DELETE SQL statement', (done) => {
    mockQuery(null, [{ id: 1 }]);

    deleteReview({ reviewId: 1, reviewerId: 5 }, () => {
      const [sql] = pool.query.mock.calls[0];
      expect(sql.toUpperCase()).toContain('DELETE');
      done();
    });
  });

  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('delete failed');
    mockQuery(dbError, null);

    deleteReview({ reviewId: 1, reviewerId: 5 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });

  test('should pass different reviewId correctly to pool.query', (done) => {
    mockQuery(null, [{ id: 7 }]);

    deleteReview({ reviewId: 7, reviewerId: 5 }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe(7);
      done();
    });
  });

  test('should pass different reviewerId correctly to pool.query', (done) => {
    mockQuery(null, [{ id: 1 }]);

    deleteReview({ reviewId: 1, reviewerId: 88 }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[1]).toBe(88);
      done();
    });
  });

  test('should call pool.query exactly once', (done) => {
    mockQuery(null, [{ id: 1 }]);

    deleteReview({ reviewId: 1, reviewerId: 5 }, () => {
      expect(pool.query).toHaveBeenCalledTimes(1);
      done();
    });
  });
});
