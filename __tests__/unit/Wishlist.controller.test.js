const controller = require('../../src/controllers/Wishlist.controller');
const model = require('../../src/models/Wishlist.model');

jest.mock('../../src/models/Wishlist.model');

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

// ── addToWishlist ────────────────────────────────────────────────────────────

describe('addToWishlist', () => {
  it('returns 500 on DB error', () => {
    const req = { params: { listingId: '5' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.addToWishlist, new Error('DB error'));
    controller.addToWishlist(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 201 on success', () => {
    const req = { params: { listingId: '5' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.addToWishlist, null, []);
    controller.addToWishlist(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Added to wishlist.' });
  });
});

// ── removeFromWishlist ───────────────────────────────────────────────────────

describe('removeFromWishlist', () => {
  it('returns 500 on DB error', () => {
    const req = { params: { listingId: '5' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.removeFromWishlist, new Error('DB error'));
    controller.removeFromWishlist(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 404 when item not in wishlist', () => {
    const req = { params: { listingId: '5' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.removeFromWishlist, null, []);
    controller.removeFromWishlist(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 200 on successful removal', () => {
    const req = { params: { listingId: '5' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.removeFromWishlist, null, [{ listing_id: 5 }]);
    controller.removeFromWishlist(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Removed from wishlist.' });
  });
});

// ── getWishlist ──────────────────────────────────────────────────────────────

describe('getWishlist', () => {
  it('returns 500 on DB error', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getWishlistByUser, new Error('DB error'));
    controller.getWishlist({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 200 with wishlist rows', () => {
    const res = makeRes({ userId: 1 });
    const items = [{ listing_id: 1 }, { listing_id: 2 }];
    mockFn(model.getWishlistByUser, null, items);
    controller.getWishlist({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(items);
  });

  it('returns 200 with empty array when wishlist is empty', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getWishlistByUser, null, []);
    controller.getWishlist({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });
});

// ── addToWishlist extra ───────────────────────────────────────────────────────

describe('addToWishlist - extra cases', () => {
  it('calls model.addToWishlist with userId from res.locals', () => {
    const req = { params: { listingId: '5' } };
    const res = makeRes({ userId: 7 });
    mockFn(model.addToWishlist, null, []);
    controller.addToWishlist(req, res);
    expect(model.addToWishlist).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7 }),
      expect.any(Function),
    );
  });

  it('calls model.addToWishlist with listingId from req.params', () => {
    const req = { params: { listingId: '42' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.addToWishlist, null, []);
    controller.addToWishlist(req, res);
    expect(model.addToWishlist).toHaveBeenCalledWith(
      expect.objectContaining({ listingId: '42' }),
      expect.any(Function),
    );
  });

  it('returns 201 even when model returns empty rows (duplicate add)', () => {
    const req = { params: { listingId: '5' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.addToWishlist, null, []);
    controller.addToWishlist(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('500 json response contains a message string', () => {
    const req = { params: { listingId: '5' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.addToWishlist, new Error('DB error'));
    controller.addToWishlist(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('201 json response is "Added to wishlist."', () => {
    const req = { params: { listingId: '5' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.addToWishlist, null, [{ user_id: 1, listing_id: 5 }]);
    controller.addToWishlist(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Added to wishlist.' });
  });
});

// ── removeFromWishlist extra ──────────────────────────────────────────────────

describe('removeFromWishlist - extra cases', () => {
  it('calls model.removeFromWishlist with userId from res.locals', () => {
    const req = { params: { listingId: '5' } };
    const res = makeRes({ userId: 9 });
    mockFn(model.removeFromWishlist, null, [{ listing_id: 5 }]);
    controller.removeFromWishlist(req, res);
    expect(model.removeFromWishlist).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 9 }),
      expect.any(Function),
    );
  });

  it('calls model.removeFromWishlist with listingId from req.params', () => {
    const req = { params: { listingId: '99' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.removeFromWishlist, null, [{ listing_id: 99 }]);
    controller.removeFromWishlist(req, res);
    expect(model.removeFromWishlist).toHaveBeenCalledWith(
      expect.objectContaining({ listingId: '99' }),
      expect.any(Function),
    );
  });

  it('500 json response contains a message string', () => {
    const req = { params: { listingId: '5' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.removeFromWishlist, new Error('DB error'));
    controller.removeFromWishlist(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('404 json response contains a message string', () => {
    const req = { params: { listingId: '5' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.removeFromWishlist, null, []);
    controller.removeFromWishlist(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('200 json response is "Removed from wishlist."', () => {
    const req = { params: { listingId: '5' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.removeFromWishlist, null, [{ listing_id: 5 }]);
    controller.removeFromWishlist(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Removed from wishlist.' });
  });
});

// ── getWishlist extra ─────────────────────────────────────────────────────────

describe('getWishlist - extra cases', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls model.getWishlistByUser with userId from res.locals', () => {
    const res = makeRes({ userId: 3 });
    mockFn(model.getWishlistByUser, null, []);
    controller.getWishlist({}, res);
    expect(model.getWishlistByUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 3 }),
      expect.any(Function),
    );
  });

  it('500 json response contains a message string', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getWishlistByUser, new Error('DB error'));
    controller.getWishlist({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns the exact rows array from the model', () => {
    const items = [{ listing_id: 1, title: 'Watch' }, { listing_id: 2, title: 'Bag' }];
    const res = makeRes({ userId: 1 });
    mockFn(model.getWishlistByUser, null, items);
    controller.getWishlist({}, res);
    expect(res.json).toHaveBeenCalledWith(items);
  });

  it('returns an array (not an object) on success', () => {
    const items = [{ listing_id: 5 }];
    const res = makeRes({ userId: 1 });
    mockFn(model.getWishlistByUser, null, items);
    controller.getWishlist({}, res);
    const [response] = res.json.mock.calls[0];
    expect(Array.isArray(response)).toBe(true);
  });

  it('model is called exactly once per request', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getWishlistByUser, null, []);
    controller.getWishlist({}, res);
    expect(model.getWishlistByUser).toHaveBeenCalledTimes(1);
  });
});
