const controller = require('../../src/controllers/Listing.controller');
const model = require('../../src/models/Listing.model');
const _purchaseState = require('../../src/models/purchaseState');

jest.mock('../../src/models/Listing.model');
jest.mock('../../src/models/purchaseState', () => ({
  isListingSold: jest.fn().mockReturnValue(false),
}));
jest.mock('@google/generative-ai');

const { GoogleGenerativeAI } = require('@google/generative-ai');

afterAll(() => jest.restoreAllMocks());

function makeRes(locals = {}) {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: { ...locals },
  };
}

function mockFn(fn, err, rows) {
  fn.mockImplementation((...args) => {
    const callback = args[args.length - 1];
    callback(err, err ? null : { rows: rows ?? [] });
  });
}

const fakeListing = {
  id: 1,
  owner_id: 42,
  price: 99.99,
  title: 'Test Watch',
  description: 'A test watch',
  category: 'Watches',
  isSold: false,
  isClosed: false,
};

// ── analyseImage ─────────────────────────────────────────────────────────────

describe('analyseImage', () => {
  it('returns 400 when imageBase64 or mimeType is missing', () => {
    const res = makeRes();
    controller.analyseImage({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 200 with parsed title and description on success', async () => {
    const mockGenerateContent = jest.fn().mockResolvedValue({
      response: { text: () => '{"title":"Watch","description":"Nice watch"}' },
    });
    GoogleGenerativeAI.mockImplementation(() => ({
      getGenerativeModel: () => ({ generateContent: mockGenerateContent }),
    }));
    const res = makeRes();
    controller.analyseImage({ body: { imageBase64: 'abc', mimeType: 'image/png' } }, res);
    await new Promise((r) => setTimeout(r, 0));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ title: 'Watch', description: 'Nice watch' });
  });

  it('returns 500 when Gemini call fails', async () => {
    const mockGenerateContent = jest.fn().mockRejectedValue(new Error('Gemini error'));
    GoogleGenerativeAI.mockImplementation(() => ({
      getGenerativeModel: () => ({ generateContent: mockGenerateContent }),
    }));
    const res = makeRes();
    controller.analyseImage({ body: { imageBase64: 'abc', mimeType: 'image/png' } }, res);
    await new Promise((r) => setTimeout(r, 0));
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── getRecentlyViewed ─────────────────────────────────────────────────────────

describe('getRecentlyViewed', () => {
  it('returns 500 on DB error', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getRecentlyViewed, new Error('DB error'));
    controller.getRecentlyViewed({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 200 with rows', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getRecentlyViewed, null, [fakeListing]);
    controller.getRecentlyViewed({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── getMostViewed ─────────────────────────────────────────────────────────────

describe('getMostViewed', () => {
  it('returns 500 on DB error', () => {
    const res = makeRes();
    model.getMostViewed.mockImplementation((callback) => callback(new Error('DB error'), null));
    controller.getMostViewed({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 200 with rows', () => {
    const res = makeRes();
    model.getMostViewed.mockImplementation((callback) => callback(null, { rows: [fakeListing] }));
    controller.getMostViewed({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── searchListings ────────────────────────────────────────────────────────────

describe('searchListings', () => {
  it('returns 500 on DB error', () => {
    const req = { query: {} };
    const res = makeRes();
    mockFn(model.searchListings, new Error('DB error'));
    controller.searchListings(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 200 with results', () => {
    const req = { query: { search: 'watch', sort: 'newest' } };
    const res = makeRes();
    mockFn(model.searchListings, null, [fakeListing]);
    controller.searchListings(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── Dashboard middlewares ─────────────────────────────────────────────────────

describe('loadSellerStats', () => {
  it('returns 500 on DB error', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getSellerStats, new Error('DB error'));
    controller.loadSellerStats({}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('sets res.locals.dashStats and calls next', () => {
    const res = makeRes({ userId: 1 });
    const next = jest.fn();
    mockFn(model.getSellerStats, null, [{ total: 5 }]);
    controller.loadSellerStats({}, res, next);
    expect(res.locals.dashStats).toEqual({ total: 5 });
    expect(next).toHaveBeenCalled();
  });
});

describe('loadSellerCategoryBreakdown', () => {
  it('returns 500 on DB error', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getSellerCategoryBreakdown, new Error('DB error'));
    controller.loadSellerCategoryBreakdown({}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('sets res.locals.dashCategories and calls next', () => {
    const res = makeRes({ userId: 1 });
    const next = jest.fn();
    mockFn(model.getSellerCategoryBreakdown, null, [{ category: 'Watches', count: 3 }]);
    controller.loadSellerCategoryBreakdown({}, res, next);
    expect(res.locals.dashCategories).toHaveLength(1);
    expect(next).toHaveBeenCalled();
  });
});

describe('loadSellerViewBreakdown', () => {
  it('returns 500 on DB error', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getSellerViewBreakdown, new Error('DB error'));
    controller.loadSellerViewBreakdown({}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('sets res.locals.dashViewBreakdown and calls next', () => {
    const res = makeRes({ userId: 1 });
    const next = jest.fn();
    mockFn(model.getSellerViewBreakdown, null, [{ listing_id: 1, views: 10 }]);
    controller.loadSellerViewBreakdown({}, res, next);
    expect(res.locals.dashViewBreakdown).toHaveLength(1);
    expect(next).toHaveBeenCalled();
  });
});

describe('sendDashboard', () => {
  it('returns 200 with stats, categories and viewBreakdown', () => {
    const res = makeRes({
      dashStats: { total: 3 },
      dashCategories: [],
      dashViewBreakdown: [],
    });
    controller.sendDashboard({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      stats: { total: 3 },
      categories: [],
      viewBreakdown: [],
    });
  });
});

// ── getListingsByCategory ─────────────────────────────────────────────────────

describe('getListingsByCategory', () => {
  it('returns 500 on DB error', () => {
    const req = { params: { category: 'Watches' } };
    const res = makeRes();
    mockFn(model.getListingsByCategory, new Error('DB error'));
    controller.getListingsByCategory(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 200 with listings', () => {
    const req = { params: { category: 'Watches' } };
    const res = makeRes();
    mockFn(model.getListingsByCategory, null, [fakeListing]);
    controller.getListingsByCategory(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── getAllListings ─────────────────────────────────────────────────────────────

describe('getAllListings', () => {
  it('returns 500 on DB error', () => {
    const res = makeRes();
    model.getAllListings.mockImplementation((callback) => callback(new Error('DB error'), null));
    controller.getAllListings({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 200 with all listings', () => {
    const res = makeRes();
    model.getAllListings.mockImplementation((callback) => callback(null, { rows: [fakeListing] }));
    controller.getAllListings({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── getListingById ────────────────────────────────────────────────────────────

describe('getListingById', () => {
  it('returns 500 on DB error', () => {
    const req = { params: { id: '1' } };
    const res = makeRes({ userId: null });
    mockFn(model.getListingById, new Error('DB error'));
    controller.getListingById(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 404 when listing not found', () => {
    const req = { params: { id: '999' } };
    const res = makeRes({ userId: null });
    mockFn(model.getListingById, null, []);
    controller.getListingById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('uses getListingById when no userId (unauthenticated)', () => {
    const req = { params: { id: '1' } };
    const res = makeRes({ userId: null });
    mockFn(model.getListingById, null, [fakeListing]);
    controller.getListingById(req, res);
    expect(model.getListingById).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('uses getListingByIdWithView when userId is set (authenticated)', () => {
    const req = { params: { id: '1' } };
    const res = makeRes({ userId: 5 });
    mockFn(model.getListingByIdWithView, null, [fakeListing]);
    controller.getListingById(req, res);
    expect(model.getListingByIdWithView).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── getListingsByOwner ────────────────────────────────────────────────────────

describe('getListingsByOwner', () => {
  it('returns 500 on DB error', () => {
    const req = { params: { owner_id: '1' } };
    const res = makeRes();
    mockFn(model.getListingsByOwner, new Error('DB error'));
    controller.getListingsByOwner(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 200 with owner listings', () => {
    const req = { params: { owner_id: '1' } };
    const res = makeRes();
    mockFn(model.getListingsByOwner, null, [fakeListing]);
    controller.getListingsByOwner(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── createListing ─────────────────────────────────────────────────────────────

describe('createListing', () => {
  it('returns 400 when required fields are missing', () => {
    const req = { body: { title: 'Watch' } };
    const res = makeRes({ userId: 1 });
    controller.createListing(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when price is 0 or negative', () => {
    const req = { body: { title: 'Watch', description: 'Nice', price: 0 } };
    const res = makeRes({ userId: 1 });
    controller.createListing(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on DB error', () => {
    const req = { body: { title: 'Watch', description: 'Nice', price: 99 } };
    const res = makeRes({ userId: 1 });
    mockFn(model.createListing, new Error('DB error'));
    controller.createListing(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 201 with created listing', () => {
    const req = { body: { title: 'Watch', description: 'Nice', price: 99 } };
    const res = makeRes({ userId: 1 });
    mockFn(model.createListing, null, [fakeListing]);
    controller.createListing(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

// ── updateListing ─────────────────────────────────────────────────────────────

describe('updateListing', () => {
  it('returns 400 when required fields are missing', () => {
    const req = { params: { id: '1' }, body: {} };
    const res = makeRes({ userId: 1 });
    controller.updateListing(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when price is 0 or negative', () => {
    const req = { params: { id: '1' }, body: { title: 'Watch', description: 'Nice', price: -5 } };
    const res = makeRes({ userId: 1 });
    controller.updateListing(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on DB error', () => {
    const req = { params: { id: '1' }, body: { title: 'Watch', description: 'Nice', price: 99 } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateListing, new Error('DB error'));
    controller.updateListing(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 404 when listing not found or not owner', () => {
    const req = { params: { id: '1' }, body: { title: 'Watch', description: 'Nice', price: 99 } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateListing, null, []);
    controller.updateListing(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 200 with updated listing', () => {
    const req = { params: { id: '1' }, body: { title: 'Watch', description: 'Nice', price: 99 } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateListing, null, [fakeListing]);
    controller.updateListing(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── deleteListing ─────────────────────────────────────────────────────────────

describe('deleteListing', () => {
  it('returns 500 on DB error', () => {
    const req = { params: { id: '1' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.deleteListing, new Error('DB error'));
    controller.deleteListing(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 404 when listing not found or not owner', () => {
    const req = { params: { id: '1' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.deleteListing, null, []);
    controller.deleteListing(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 200 on successful deletion', () => {
    const req = { params: { id: '1' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.deleteListing, null, [{ id: 1 }]);
    controller.deleteListing(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 200 with a message on successful deletion', () => {
    const req = { params: { id: '1' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.deleteListing, null, [{ id: 1 }]);
    controller.deleteListing(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});

// ── updateListingStatus ───────────────────────────────────────────────────────

describe('updateListingStatus', () => {
  const fakeLifecycleListing = {
    id: 1,
    owner_id: 42,
    status: 'AVAILABLE',
    isSold: false,
    isClosed: false,
  };

  it('returns 400 when listing id is not a valid integer', () => {
    const req = { params: { id: 'abc' }, body: { status: 'RESERVED' } };
    const res = makeRes({ userId: 42 });
    controller.updateListingStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when listing id is zero', () => {
    const req = { params: { id: '0' }, body: { status: 'RESERVED' } };
    const res = makeRes({ userId: 42 });
    controller.updateListingStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when listing id is negative', () => {
    const req = { params: { id: '-1' }, body: { status: 'RESERVED' } };
    const res = makeRes({ userId: 42 });
    controller.updateListingStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when status is missing from body', () => {
    const req = { params: { id: '1' }, body: {} };
    const res = makeRes({ userId: 42 });
    controller.updateListingStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when status is only whitespace', () => {
    const req = { params: { id: '1' }, body: { status: '   ' } };
    const res = makeRes({ userId: 42 });
    controller.updateListingStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when status is an unrecognised value', () => {
    const req = { params: { id: '1' }, body: { status: 'DELETED' } };
    const res = makeRes({ userId: 42 });
    controller.updateListingStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on DB lookup error', () => {
    const req = { params: { id: '1' }, body: { status: 'RESERVED' } };
    const res = makeRes({ userId: 42 });
    mockFn(model.getListingLifecycleById, new Error('DB error'));
    controller.updateListingStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 404 when listing not found', () => {
    const req = { params: { id: '999' }, body: { status: 'RESERVED' } };
    const res = makeRes({ userId: 42 });
    mockFn(model.getListingLifecycleById, null, []);
    controller.updateListingStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when caller is not the listing owner', () => {
    const req = { params: { id: '1' }, body: { status: 'RESERVED' } };
    const res = makeRes({ userId: 99 });
    mockFn(model.getListingLifecycleById, null, [fakeLifecycleListing]);
    controller.updateListingStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 409 when the requested transition is not allowed', () => {
    const req = { params: { id: '1' }, body: { status: 'AVAILABLE' } };
    const res = makeRes({ userId: 42 });
    mockFn(model.getListingLifecycleById, null, [
      { ...fakeLifecycleListing, status: 'SOLD', isSold: true },
    ]);
    controller.updateListingStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 500 on DB update error after successful lookup', () => {
    const req = { params: { id: '1' }, body: { status: 'RESERVED' } };
    const res = makeRes({ userId: 42 });
    model.getListingLifecycleById.mockImplementation((_d, cb) =>
      cb(null, { rows: [fakeLifecycleListing] }),
    );
    mockFn(model.updateListingStatus, new Error('DB error'));
    controller.updateListingStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 409 when update returns empty rows (concurrent status change)', () => {
    const req = { params: { id: '1' }, body: { status: 'RESERVED' } };
    const res = makeRes({ userId: 42 });
    model.getListingLifecycleById.mockImplementation((_d, cb) =>
      cb(null, { rows: [fakeLifecycleListing] }),
    );
    mockFn(model.updateListingStatus, null, []);
    controller.updateListingStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('returns 200 on a successful AVAILABLE → RESERVED transition', () => {
    const req = { params: { id: '1' }, body: { status: 'RESERVED' } };
    const res = makeRes({ userId: 42 });
    model.getListingLifecycleById.mockImplementation((_d, cb) =>
      cb(null, { rows: [fakeLifecycleListing] }),
    );
    mockFn(model.updateListingStatus, null, [
      { id: 1, status: 'RESERVED', isSold: false, isClosed: false },
    ]);
    controller.updateListingStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 200 on a successful AVAILABLE → SOLD transition', () => {
    const req = { params: { id: '1' }, body: { status: 'SOLD' } };
    const res = makeRes({ userId: 42 });
    model.getListingLifecycleById.mockImplementation((_d, cb) =>
      cb(null, { rows: [fakeLifecycleListing] }),
    );
    mockFn(model.updateListingStatus, null, [
      { id: 1, status: 'SOLD', isSold: true, isClosed: false },
    ]);
    controller.updateListingStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── additional edge cases for existing functions ───────────────────────────────

describe('createListing - extra edge cases', () => {
  it('returns 400 when price is negative', () => {
    const req = { body: { title: 'Watch', description: 'Nice', price: -10 } };
    const res = makeRes({ userId: 1 });
    controller.createListing(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when title is an empty string', () => {
    const req = { body: { title: '', description: 'Nice', price: 50 } };
    const res = makeRes({ userId: 1 });
    controller.createListing(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when description is an empty string', () => {
    const req = { body: { title: 'Watch', description: '', price: 50 } };
    const res = makeRes({ userId: 1 });
    controller.createListing(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 201 response with listing in json body', () => {
    const req = { body: { title: 'Watch', description: 'Nice', price: 99 } };
    const res = makeRes({ userId: 1 });
    mockFn(model.createListing, null, [fakeListing]);
    controller.createListing(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ listing: fakeListing }));
  });
});

describe('updateListing - extra edge cases', () => {
  it('returns 400 when price is negative', () => {
    const req = { params: { id: '1' }, body: { title: 'Watch', description: 'Nice', price: -1 } };
    const res = makeRes({ userId: 1 });
    controller.updateListing(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when title is an empty string', () => {
    const req = { params: { id: '1' }, body: { title: '', description: 'Nice', price: 50 } };
    const res = makeRes({ userId: 1 });
    controller.updateListing(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 200 response with listing in json body', () => {
    const req = { params: { id: '1' }, body: { title: 'Watch', description: 'Nice', price: 99 } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateListing, null, [fakeListing]);
    controller.updateListing(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ listing: fakeListing }));
  });
});

describe('getListingById - extra edge cases', () => {
  it('returns 500 on DB error in authenticated path', () => {
    const req = { params: { id: '1' } };
    const res = makeRes({ userId: 5 });
    mockFn(model.getListingByIdWithView, new Error('DB error'));
    controller.getListingById(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 404 on empty rows in authenticated path', () => {
    const req = { params: { id: '999' } };
    const res = makeRes({ userId: 5 });
    mockFn(model.getListingByIdWithView, null, []);
    controller.getListingById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('analyseImage - extra edge cases', () => {
  it('returns 400 when imageBase64 is an empty string', () => {
    const req = { body: { imageBase64: '', mimeType: 'image/png' } };
    const res = makeRes();
    controller.analyseImage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when mimeType is an empty string', () => {
    const req = { body: { imageBase64: 'abc', mimeType: '' } };
    const res = makeRes();
    controller.analyseImage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getListingsByOwner - extra edge cases', () => {
  it('returns 200 with empty array when owner has no listings', () => {
    const req = { params: { owner_id: '99' } };
    const res = makeRes();
    mockFn(model.getListingsByOwner, null, []);
    controller.getListingsByOwner(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });
});

describe('searchListings - extra edge cases', () => {
  it('returns 200 with empty array when no matches found', () => {
    const req = { query: { search: 'xyznotfound' } };
    const res = makeRes();
    mockFn(model.searchListings, null, []);
    controller.searchListings(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('passes all query filters to the model', () => {
    const req = {
      query: {
        search: 'rolex',
        minPrice: '100',
        maxPrice: '500',
        sort: 'cheapest',
        category: 'Watches',
      },
    };
    const res = makeRes();
    mockFn(model.searchListings, null, []);
    controller.searchListings(req, res);
    expect(model.searchListings).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'rolex',
        minPrice: '100',
        maxPrice: '500',
        sort: 'cheapest',
        category: 'Watches',
      }),
      expect.any(Function),
    );
  });
});
