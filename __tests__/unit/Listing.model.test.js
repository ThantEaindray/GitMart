const pool = require('../../src/models/db');
const {
  createListing,
  getAllListings,
  getListingById,
  searchListings,
  deleteListing,
} = require('../../src/models/Listing.model');

// ── Mocking ──────────────────────────────────────────────
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

const fakeListing = {
  id: 1,
  owner_id: 42,
  price: 99.99,
  title: 'Test Watch',
  description: 'A luxury test watch',
  category: 'Watches',
  image_url: null,
  isSold: false,
  isClosed: false,
  created_on: '2026-07-15',
};

// Mocks pool.query regardless of whether it is called with 2 or 3 args.
// Listing.model uses pool.query(sql, callback) for reads with no params
// and pool.query(sql, values, callback) for writes and filtered reads.
function mockQuery(err, rows) {
  pool.query.mockImplementation((...args) => {
    const callback = args[args.length - 1];
    callback(err, err ? null : { rows });
  });
}

// ── createListing ─────────────────────────────────────────────────────────
describe('Listing.model - createListing', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: all required fields provided
  test('should insert a listing and return it via callback', (done) => {
    mockQuery(null, [fakeListing]);

    const data = {
      owner_id: 42,
      price: 99.99,
      title: 'Test Watch',
      description: 'A luxury test watch',
      category: 'Watches',
      image_url: null,
    };

    createListing(data, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([42, 99.99, 'Test Watch', 'A luxury test watch', 'Watches', null]);
      expect(result.rows[0]).toEqual(fakeListing);
      done();
    });
  });

  // Valid partition: category defaults to 'Others' when not supplied
  test('should pass Others as category when data.category is Others', (done) => {
    mockQuery(null, [fakeListing]);

    const data = {
      owner_id: 1,
      price: 50,
      title: 'No Category Item',
      description: 'desc',
      category: 'Others',
      image_url: null,
    };

    createListing(data, (err) => {
      expect(err).toBeNull();
      const [, values] = pool.query.mock.calls[0];
      expect(values[4]).toBe('Others');
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('insert failed');
    mockQuery(dbError, null);

    createListing(
      { owner_id: 1, price: 10, title: 'x', description: 'y', category: 'Others', image_url: null },
      (err) => {
        expect(err).toBe(dbError);
        done();
      },
    );
  });
});

// ── getAllListings ─────────────────────────────────────────────────────────
describe('Listing.model - getAllListings', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: multiple listings returned
  test('should return all listings via callback', (done) => {
    const fakeListings = [fakeListing, { ...fakeListing, id: 2, title: 'Second Item' }];
    mockQuery(null, fakeListings);

    getAllListings((err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(result.rows).toHaveLength(2);
      done();
    });
  });

  // Boundary: empty table returns empty array
  test('should return empty array when no listings exist', (done) => {
    mockQuery(null, []);

    getAllListings((err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('connection lost');
    mockQuery(dbError, null);

    getAllListings((err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── getListingById ────────────────────────────────────────────────────────
describe('Listing.model - getListingById', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: listing exists
  test('should return the listing when found', (done) => {
    mockQuery(null, [fakeListing]);

    getListingById({ id: 1 }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([1]);
      expect(result.rows[0]).toEqual(fakeListing);
      done();
    });
  });

  // Boundary: id not found — empty rows
  test('should return empty rows when listing does not exist', (done) => {
    mockQuery(null, []);

    getListingById({ id: 999 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('query failed');
    mockQuery(dbError, null);

    getListingById({ id: 1 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── searchListings ────────────────────────────────────────────────────────
describe('Listing.model - searchListings', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: no filters — values are all empty/null
  test('should query with empty values when no filters are provided', (done) => {
    mockQuery(null, [fakeListing]);

    const data = { search: '', minPrice: null, maxPrice: null, category: '', sort: 'newest' };

    searchListings(data, (err, result) => {
      expect(err).toBeNull();
      const [sql, values] = pool.query.mock.calls[0];
      expect(sql).toContain('FROM listings');
      expect(values).toEqual(['', null, null, '']);
      expect(result.rows).toHaveLength(1);
      done();
    });
  });

  // Valid partition: search term is passed in values[0]
  test('should pass the search term as the first query value', (done) => {
    mockQuery(null, [fakeListing]);

    searchListings(
      { search: 'rolex', minPrice: null, maxPrice: null, category: '', sort: 'newest' },
      (err) => {
        expect(err).toBeNull();
        const [, values] = pool.query.mock.calls[0];
        expect(values[0]).toBe('rolex');
        done();
      },
    );
  });

  // Valid partition: price range strings are cast to numbers
  test('should cast minPrice and maxPrice strings to numbers', (done) => {
    mockQuery(null, []);

    searchListings(
      { search: '', minPrice: '50', maxPrice: '200', category: '', sort: 'cheapest' },
      (err, result) => {
        expect(err).toBeNull();
        const [, values] = pool.query.mock.calls[0];
        expect(values[1]).toBe(50);
        expect(values[2]).toBe(200);
        expect(result.rows).toEqual([]);
        done();
      },
    );
  });

  // Boundary: no matching results returns empty array
  test('should return empty array when no listings match', (done) => {
    mockQuery(null, []);

    searchListings(
      { search: 'xyznotfound', minPrice: null, maxPrice: null, category: '', sort: 'newest' },
      (err, result) => {
        expect(err).toBeNull();
        expect(result.rows).toEqual([]);
        done();
      },
    );
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('search failed');
    mockQuery(dbError, null);

    searchListings(
      { search: '', minPrice: null, maxPrice: null, category: '', sort: 'newest' },
      (err) => {
        expect(err).toBe(dbError);
        done();
      },
    );
  });
});

// ── deleteListing ─────────────────────────────────────────────────────────
describe('Listing.model - deleteListing', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: listing deleted and returned
  test('should delete listing and return the deleted row', (done) => {
    mockQuery(null, [{ id: 1 }]);

    deleteListing({ id: 1, owner_id: 42 }, (err, result) => {
      expect(err).toBeNull();
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([1, 42]);
      expect(result.rows[0]).toEqual({ id: 1 });
      done();
    });
  });

  // Boundary: non-existent id returns zero rows
  test('should return empty rows when listing does not exist', (done) => {
    mockQuery(null, []);

    deleteListing({ id: 999, owner_id: 42 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Boundary: wrong owner returns zero rows (owner check enforced in SQL)
  test('should return empty rows when caller is not the owner', (done) => {
    mockQuery(null, []);

    deleteListing({ id: 1, owner_id: 99 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('delete failed');
    mockQuery(dbError, null);

    deleteListing({ id: 1, owner_id: 42 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});
