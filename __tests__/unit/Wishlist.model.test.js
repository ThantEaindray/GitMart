const pool = require('../../src/models/db');
const {
  addToWishlist,
  removeFromWishlist,
  getWishlistByUser,
} = require('../../src/models/Wishlist.model');

// ── Mocking ──────────────────────────────────────────────
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

const fakeEntry = { user_id: 1, listing_id: 10 };

const fakeWishlistItem = {
  listing_id: 10,
  added_on: '2026-07-20T00:00:00.000Z',
  owner_id: 2,
  price: 99.99,
  title: 'Test Watch',
  description: 'A luxury test watch',
  category: 'Watches',
  image_url: null,
  view_count: 0,
  isSold: false,
  isClosed: false,
  created_on: '2026-07-15T00:00:00.000Z',
};

// Mocks pool.query regardless of whether it is called with 2 or 3 args.
function mockQuery(err, rows) {
  pool.query.mockImplementation((...args) => {
    const callback = args[args.length - 1];
    callback(err, err ? null : { rows });
  });
}

// ── addToWishlist ─────────────────────────────────────────────────────────
describe('Wishlist.model - addToWishlist', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: new entry inserted and returned
  test('should insert entry and return it via callback', (done) => {
    mockQuery(null, [fakeEntry]);

    addToWishlist({ userId: 1, listingId: 10 }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([1, 10]);
      expect(result.rows[0]).toEqual(fakeEntry);
      done();
    });
  });

  // Boundary: duplicate insert returns empty rows (ON CONFLICT DO NOTHING)
  test('should return empty rows on duplicate add', (done) => {
    mockQuery(null, []);

    addToWishlist({ userId: 1, listingId: 10 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('insert failed');
    mockQuery(dbError, null);

    addToWishlist({ userId: 1, listingId: 10 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── removeFromWishlist ────────────────────────────────────────────────────
describe('Wishlist.model - removeFromWishlist', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: entry deleted and returned
  test('should delete entry and return it via callback', (done) => {
    mockQuery(null, [fakeEntry]);

    removeFromWishlist({ userId: 1, listingId: 10 }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([1, 10]);
      expect(result.rows[0]).toEqual(fakeEntry);
      done();
    });
  });

  // Boundary: entry not in wishlist returns empty rows
  test('should return empty rows when entry does not exist', (done) => {
    mockQuery(null, []);

    removeFromWishlist({ userId: 1, listingId: 999 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('delete failed');
    mockQuery(dbError, null);

    removeFromWishlist({ userId: 1, listingId: 10 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── getWishlistByUser ─────────────────────────────────────────────────────
describe('Wishlist.model - getWishlistByUser', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: returns wishlist items for user
  test('should return wishlist items for the user via callback', (done) => {
    mockQuery(null, [fakeWishlistItem]);

    getWishlistByUser({ userId: 1 }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([1]);
      expect(result.rows[0]).toEqual(fakeWishlistItem);
      done();
    });
  });

  // Boundary: user with no items returns empty array
  test('should return empty array when wishlist is empty', (done) => {
    mockQuery(null, []);

    getWishlistByUser({ userId: 1 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Valid partition: multiple items are all returned
  test('should return all items when user has multiple wishlist entries', (done) => {
    const secondItem = { ...fakeWishlistItem, listing_id: 11, title: 'Second Item' };
    mockQuery(null, [fakeWishlistItem, secondItem]);

    getWishlistByUser({ userId: 1 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toHaveLength(2);
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('query failed');
    mockQuery(dbError, null);

    getWishlistByUser({ userId: 1 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── addToWishlist extra ───────────────────────────────────────────────────────
describe('Wishlist.model - addToWishlist extra', () => {
  beforeEach(() => jest.clearAllMocks());

  test('should pass different userId correctly to pool.query', (done) => {
    mockQuery(null, [{ user_id: 99, listing_id: 10 }]);

    addToWishlist({ userId: 99, listingId: 10 }, (err) => {
      expect(err).toBeNull();
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe(99);
      done();
    });
  });

  test('should pass different listingId correctly to pool.query', (done) => {
    mockQuery(null, [{ user_id: 1, listing_id: 55 }]);

    addToWishlist({ userId: 1, listingId: 55 }, (err) => {
      expect(err).toBeNull();
      const [, values] = pool.query.mock.calls[0];
      expect(values[1]).toBe(55);
      done();
    });
  });

  test('should call pool.query exactly once', (done) => {
    mockQuery(null, []);

    addToWishlist({ userId: 1, listingId: 10 }, () => {
      expect(pool.query).toHaveBeenCalledTimes(1);
      done();
    });
  });

  test('should use INSERT SQL statement', (done) => {
    mockQuery(null, []);

    addToWishlist({ userId: 1, listingId: 10 }, () => {
      const [sql] = pool.query.mock.calls[0];
      expect(sql.toUpperCase()).toContain('INSERT');
      done();
    });
  });

  test('ON CONFLICT DO NOTHING scenario returns empty rows without error', (done) => {
    mockQuery(null, []);

    addToWishlist({ userId: 1, listingId: 10 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });
});

// ── removeFromWishlist extra ──────────────────────────────────────────────────
describe('Wishlist.model - removeFromWishlist extra', () => {
  beforeEach(() => jest.clearAllMocks());

  test('should pass different userId correctly to pool.query', (done) => {
    mockQuery(null, [{ user_id: 88, listing_id: 10 }]);

    removeFromWishlist({ userId: 88, listingId: 10 }, (err) => {
      expect(err).toBeNull();
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe(88);
      done();
    });
  });

  test('should pass different listingId correctly to pool.query', (done) => {
    mockQuery(null, [{ user_id: 1, listing_id: 77 }]);

    removeFromWishlist({ userId: 1, listingId: 77 }, (err) => {
      expect(err).toBeNull();
      const [, values] = pool.query.mock.calls[0];
      expect(values[1]).toBe(77);
      done();
    });
  });

  test('should call pool.query exactly once', (done) => {
    mockQuery(null, [{ user_id: 1, listing_id: 10 }]);

    removeFromWishlist({ userId: 1, listingId: 10 }, () => {
      expect(pool.query).toHaveBeenCalledTimes(1);
      done();
    });
  });

  test('should use DELETE SQL statement', (done) => {
    mockQuery(null, [{ user_id: 1, listing_id: 10 }]);

    removeFromWishlist({ userId: 1, listingId: 10 }, () => {
      const [sql] = pool.query.mock.calls[0];
      expect(sql.toUpperCase()).toContain('DELETE');
      done();
    });
  });

  test('should return the deleted entry in result rows', (done) => {
    const deleted = { user_id: 1, listing_id: 10 };
    mockQuery(null, [deleted]);

    removeFromWishlist({ userId: 1, listingId: 10 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows[0]).toEqual(deleted);
      done();
    });
  });
});

// ── getWishlistByUser extra ───────────────────────────────────────────────────
describe('Wishlist.model - getWishlistByUser extra', () => {
  beforeEach(() => jest.clearAllMocks());

  test('should pass different userId correctly to pool.query', (done) => {
    mockQuery(null, []);

    getWishlistByUser({ userId: 55 }, (err) => {
      expect(err).toBeNull();
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe(55);
      done();
    });
  });

  test('should call pool.query exactly once', (done) => {
    mockQuery(null, []);

    getWishlistByUser({ userId: 1 }, () => {
      expect(pool.query).toHaveBeenCalledTimes(1);
      done();
    });
  });

  test('should return a wishlist item with expected fields', (done) => {
    mockQuery(null, [fakeWishlistItem]);

    getWishlistByUser({ userId: 1 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows[0]).toHaveProperty('listing_id');
      expect(result.rows[0]).toHaveProperty('title');
      done();
    });
  });

  test('should return three items when user has three wishlist entries', (done) => {
    const third = { ...fakeWishlistItem, listing_id: 12, title: 'Third Item' };
    mockQuery(null, [fakeWishlistItem, { ...fakeWishlistItem, listing_id: 11 }, third]);

    getWishlistByUser({ userId: 1 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toHaveLength(3);
      done();
    });
  });

  test('should use SELECT SQL statement', (done) => {
    mockQuery(null, []);

    getWishlistByUser({ userId: 1 }, () => {
      const [sql] = pool.query.mock.calls[0];
      expect(sql.toUpperCase()).toContain('SELECT');
      done();
    });
  });
});
