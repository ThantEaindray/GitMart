const controller = require('../../src/controllers/Review.controller');
const model = require('../../src/models/Review.model');

jest.mock('../../src/models/Review.model');

afterAll(() => jest.restoreAllMocks());

function makeRes(locals = {}) {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: { ...locals },
  };
}

function mockFn(fn, err, rows) {
  fn.mockImplementation((_data, callback) => {
    callback(err, err ? null : { rows: rows ?? [] });
  });
}

const fakeReview = {
  id: 1,
  listing_id: 10,
  reviewer_id: 5,
  rating: 4,
  comment: 'Great item',
  created_on: '2026-07-27T00:00:00.000Z',
  reviewer_name: 'testbuyer',
};

// ── getReviews ────────────────────────────────────────────────────────────────

describe('getReviews', () => {
  it('returns 500 on DB error', () => {
    const req = { params: { id: '10' } };
    const res = makeRes();
    mockFn(model.getReviewsByListing, new Error('DB error'));
    controller.getReviews(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 200 with review rows', () => {
    const req = { params: { id: '10' } };
    const res = makeRes();
    mockFn(model.getReviewsByListing, null, [fakeReview]);
    controller.getReviews(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([fakeReview]);
  });

  it('returns 200 with empty array when listing has no reviews', () => {
    const req = { params: { id: '10' } };
    const res = makeRes();
    mockFn(model.getReviewsByListing, null, []);
    controller.getReviews(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('passes listing id from req.params to model', () => {
    const req = { params: { id: '42' } };
    const res = makeRes();
    mockFn(model.getReviewsByListing, null, []);
    controller.getReviews(req, res);
    expect(model.getReviewsByListing).toHaveBeenCalledWith(
      expect.objectContaining({ listingId: '42' }),
      expect.any(Function),
    );
  });
});

// ── createReview ──────────────────────────────────────────────────────────────

describe('createReview', () => {
  it('returns 400 when rating is missing', () => {
    const req = { params: { id: '10' }, body: {} };
    const res = makeRes({ userId: 5 });
    controller.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when rating is 0', () => {
    const req = { params: { id: '10' }, body: { rating: 0 } };
    const res = makeRes({ userId: 5 });
    controller.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when rating is below 1', () => {
    const req = { params: { id: '10' }, body: { rating: -1 } };
    const res = makeRes({ userId: 5 });
    controller.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when rating is above 5', () => {
    const req = { params: { id: '10' }, body: { rating: 6 } };
    const res = makeRes({ userId: 5 });
    controller.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 with descriptive message for invalid rating', () => {
    const req = { params: { id: '10' }, body: { rating: 10 } };
    const res = makeRes({ userId: 5 });
    controller.createReview(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 409 when reviewer has already reviewed this listing (error code 23505)', () => {
    const req = { params: { id: '10' }, body: { rating: 4 } };
    const res = makeRes({ userId: 5 });
    const dupError = Object.assign(new Error('unique violation'), { code: '23505' });
    model.createReview.mockImplementation((_data, callback) => callback(dupError, null));
    controller.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 500 on generic DB error', () => {
    const req = { params: { id: '10' }, body: { rating: 4 } };
    const res = makeRes({ userId: 5 });
    mockFn(model.createReview, new Error('DB error'));
    controller.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 201 with created review on success', () => {
    const req = { params: { id: '10' }, body: { rating: 4, comment: 'Great item' } };
    const res = makeRes({ userId: 5 });
    mockFn(model.createReview, null, [fakeReview]);
    controller.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(fakeReview);
  });

  it('passes userId from res.locals as reviewerId', () => {
    const req = { params: { id: '10' }, body: { rating: 3 } };
    const res = makeRes({ userId: 99 });
    mockFn(model.createReview, null, [fakeReview]);
    controller.createReview(req, res);
    expect(model.createReview).toHaveBeenCalledWith(
      expect.objectContaining({ reviewerId: 99 }),
      expect.any(Function),
    );
  });

  it('passes null comment when comment is not provided', () => {
    const req = { params: { id: '10' }, body: { rating: 3 } };
    const res = makeRes({ userId: 5 });
    mockFn(model.createReview, null, [{ ...fakeReview, comment: null }]);
    controller.createReview(req, res);
    expect(model.createReview).toHaveBeenCalledWith(
      expect.objectContaining({ comment: null }),
      expect.any(Function),
    );
  });

  it('accepts valid boundary rating of 1', () => {
    const req = { params: { id: '10' }, body: { rating: 1 } };
    const res = makeRes({ userId: 5 });
    mockFn(model.createReview, null, [{ ...fakeReview, rating: 1 }]);
    controller.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('accepts valid boundary rating of 5', () => {
    const req = { params: { id: '10' }, body: { rating: 5 } };
    const res = makeRes({ userId: 5 });
    mockFn(model.createReview, null, [{ ...fakeReview, rating: 5 }]);
    controller.createReview(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

// ── deleteReview ──────────────────────────────────────────────────────────────

describe('deleteReview', () => {
  it('returns 500 on DB error', () => {
    const req = { params: { id: '10', reviewId: '1' } };
    const res = makeRes({ userId: 5 });
    mockFn(model.deleteReview, new Error('DB error'));
    controller.deleteReview(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 404 when review not found or reviewer does not match', () => {
    const req = { params: { id: '10', reviewId: '999' } };
    const res = makeRes({ userId: 5 });
    mockFn(model.deleteReview, null, []);
    controller.deleteReview(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 200 with message on successful deletion', () => {
    const req = { params: { id: '10', reviewId: '1' } };
    const res = makeRes({ userId: 5 });
    mockFn(model.deleteReview, null, [{ id: 1 }]);
    controller.deleteReview(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Review deleted.' });
  });

  it('passes reviewId from req.params to model', () => {
    const req = { params: { id: '10', reviewId: '7' } };
    const res = makeRes({ userId: 5 });
    mockFn(model.deleteReview, null, [{ id: 7 }]);
    controller.deleteReview(req, res);
    expect(model.deleteReview).toHaveBeenCalledWith(
      expect.objectContaining({ reviewId: '7' }),
      expect.any(Function),
    );
  });

  it('passes userId from res.locals as reviewerId to model', () => {
    const req = { params: { id: '10', reviewId: '1' } };
    const res = makeRes({ userId: 42 });
    mockFn(model.deleteReview, null, [{ id: 1 }]);
    controller.deleteReview(req, res);
    expect(model.deleteReview).toHaveBeenCalledWith(
      expect.objectContaining({ reviewerId: 42 }),
      expect.any(Function),
    );
  });
});
