const pool = require('../../src/models/db');
const {
  createListing,
  getAllListings,
  getListingById,
  getListingByIdWithView,
  getListingsByOwner,
  getListingsByCategory,
  updateListing,
  getMostViewed,
  getRecentlyViewed,
  getSellerStats,
  getSellerCategoryBreakdown,
  getSellerViewBreakdown,
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

// ── updateListing ─────────────────────────────────────────────────────────
describe('Listing.model - updateListing', () => {
  afterEach(() => jest.clearAllMocks());

  const updatedListing = { ...fakeListing, title: 'Updated Watch', price: 150 };

  // Valid partition: owner updates their listing and gets updated row back
  test('should update listing and return the updated row', (done) => {
    mockQuery(null, [updatedListing]);

    const data = { id: 1, owner_id: 42, title: 'Updated Watch', description: 'desc', price: 150 };

    updateListing(data, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual(['Updated Watch', 'desc', 150, 1, 42]);
      expect(result.rows[0].title).toBe('Updated Watch');
      done();
    });
  });

  // Boundary: wrong owner returns empty rows (SQL WHERE enforces ownership)
  test('should return empty rows when caller is not the owner', (done) => {
    mockQuery(null, []);

    updateListing(
      { id: 1, owner_id: 99, title: 'X', description: 'Y', price: 10 },
      (err, result) => {
        expect(err).toBeNull();
        expect(result.rows).toEqual([]);
        done();
      },
    );
  });

  // Boundary: non-existent id returns empty rows
  test('should return empty rows when listing does not exist', (done) => {
    mockQuery(null, []);

    updateListing(
      { id: 999, owner_id: 42, title: 'X', description: 'Y', price: 10 },
      (err, result) => {
        expect(err).toBeNull();
        expect(result.rows).toEqual([]);
        done();
      },
    );
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('update failed');
    mockQuery(dbError, null);

    updateListing({ id: 1, owner_id: 42, title: 'X', description: 'Y', price: 10 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── getMostViewed ─────────────────────────────────────────────────────────
describe('Listing.model - getMostViewed', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: returns top listings ordered by view_count
  test('should return most-viewed listings via callback', (done) => {
    const topListings = [
      { ...fakeListing, view_count: 10 },
      { ...fakeListing, id: 2, view_count: 5 },
    ];
    mockQuery(null, topListings);

    getMostViewed((err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].view_count).toBe(10);
      done();
    });
  });

  // Boundary: no viewed listings returns empty array
  test('should return empty array when no listings have views', (done) => {
    mockQuery(null, []);

    getMostViewed((err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('query failed');
    mockQuery(dbError, null);

    getMostViewed((err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── getRecentlyViewed ─────────────────────────────────────────────────────
describe('Listing.model - getRecentlyViewed', () => {
  afterEach(() => jest.clearAllMocks());

  const recentItem = { ...fakeListing, viewed_at: '2026-07-20T10:00:00.000Z' };

  // Valid partition: returns listings the user has viewed
  test('should return recently viewed listings for the user', (done) => {
    mockQuery(null, [recentItem]);

    getRecentlyViewed({ userId: 42 }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([42]);
      expect(result.rows[0]).toEqual(recentItem);
      done();
    });
  });

  // Boundary: user with no view history returns empty array
  test('should return empty array when user has no view history', (done) => {
    mockQuery(null, []);

    getRecentlyViewed({ userId: 99 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('query failed');
    mockQuery(dbError, null);

    getRecentlyViewed({ userId: 42 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── getListingsByOwner ────────────────────────────────────────────────────
describe('Listing.model - getListingsByOwner', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: returns all listings for an owner
  test('should return listings for the given owner', (done) => {
    mockQuery(null, [fakeListing]);

    getListingsByOwner({ owner_id: 42 }, (err, result) => {
      expect(err).toBeNull();
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([42]);
      expect(result.rows[0].owner_id).toBe(42);
      done();
    });
  });

  // Boundary: owner with no listings returns empty array
  test('should return empty array when owner has no listings', (done) => {
    mockQuery(null, []);

    getListingsByOwner({ owner_id: 999 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('query failed');
    mockQuery(dbError, null);

    getListingsByOwner({ owner_id: 42 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── getListingsByCategory ─────────────────────────────────────────────────
describe('Listing.model - getListingsByCategory', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: returns listings matching the category
  test('should return listings for the given category', (done) => {
    mockQuery(null, [fakeListing]);

    getListingsByCategory({ category: 'Watches' }, (err, result) => {
      expect(err).toBeNull();
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual(['Watches']);
      expect(result.rows[0].category).toBe('Watches');
      done();
    });
  });

  // Boundary: category with no listings returns empty array
  test('should return empty array when category has no listings', (done) => {
    mockQuery(null, []);

    getListingsByCategory({ category: 'NonExistent' }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('query failed');
    mockQuery(dbError, null);

    getListingsByCategory({ category: 'Watches' }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── getListingByIdWithView ────────────────────────────────────────────────
describe('Listing.model - getListingByIdWithView', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: returns listing and passes correct id + userId values
  test('should call pool.query with listing id and userId', (done) => {
    mockQuery(null, [fakeListing]);

    getListingByIdWithView({ id: 1, userId: 42 }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([1, 42]);
      expect(result.rows[0]).toEqual(fakeListing);
      done();
    });
  });

  // Boundary: listing not found returns empty rows
  test('should return empty rows when listing does not exist', (done) => {
    mockQuery(null, []);

    getListingByIdWithView({ id: 999, userId: 42 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('query failed');
    mockQuery(dbError, null);

    getListingByIdWithView({ id: 1, userId: 42 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── getSellerStats ────────────────────────────────────────────────────────
describe('Listing.model - getSellerStats', () => {
  afterEach(() => jest.clearAllMocks());

  const fakeStats = {
    total: '3',
    active: '2',
    sold: '1',
    closed: '0',
    avg_price: '99.99',
    min_price: '50.00',
    max_price: '150.00',
    total_views: '10',
  };

  // Valid partition: returns stats for the given owner
  test('should return seller stats for the given owner', (done) => {
    mockQuery(null, [fakeStats]);

    getSellerStats({ owner_id: 42 }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([42]);
      expect(result.rows[0]).toEqual(fakeStats);
      done();
    });
  });

  // Boundary: owner with no listings returns zeroed stats row
  test('should return a stats row even when owner has no listings', (done) => {
    const emptyStats = {
      total: '0',
      active: '0',
      sold: '0',
      closed: '0',
      avg_price: null,
      min_price: null,
      max_price: null,
      total_views: '0',
    };
    mockQuery(null, [emptyStats]);

    getSellerStats({ owner_id: 999 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows[0].total).toBe('0');
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('query failed');
    mockQuery(dbError, null);

    getSellerStats({ owner_id: 42 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── getSellerCategoryBreakdown ────────────────────────────────────────────
describe('Listing.model - getSellerCategoryBreakdown', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: returns category counts for the owner
  test('should return category breakdown for the given owner', (done) => {
    const fakeBreakdown = [
      { category: 'Watches', count: '2' },
      { category: 'Others', count: '1' },
    ];
    mockQuery(null, fakeBreakdown);

    getSellerCategoryBreakdown({ owner_id: 42 }, (err, result) => {
      expect(err).toBeNull();
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([42]);
      expect(result.rows).toHaveLength(2);
      done();
    });
  });

  // Boundary: owner with no listings returns empty array
  test('should return empty array when owner has no listings', (done) => {
    mockQuery(null, []);

    getSellerCategoryBreakdown({ owner_id: 999 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('query failed');
    mockQuery(dbError, null);

    getSellerCategoryBreakdown({ owner_id: 42 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── getSellerViewBreakdown ────────────────────────────────────────────────
describe('Listing.model - getSellerViewBreakdown', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: returns top viewed listings for the owner
  test('should return view breakdown for the given owner', (done) => {
    const fakeViews = [
      { title: 'Top Watch', view_count: 10 },
      { title: 'Second Item', view_count: 5 },
    ];
    mockQuery(null, fakeViews);

    getSellerViewBreakdown({ owner_id: 42 }, (err, result) => {
      expect(err).toBeNull();
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([42]);
      expect(result.rows[0].view_count).toBe(10);
      done();
    });
  });

  // Boundary: owner with no viewed listings returns empty array
  test('should return empty array when no listings have views', (done) => {
    mockQuery(null, []);

    getSellerViewBreakdown({ owner_id: 999 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('query failed');
    mockQuery(dbError, null);

    getSellerViewBreakdown({ owner_id: 42 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
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

// ── getListingLifecycleById ───────────────────────────────────────────────────
describe('Listing.model - getListingLifecycleById', () => {
  const { getListingLifecycleById } = require('../../src/models/Listing.model');
  afterEach(() => jest.clearAllMocks());

  test('should return lifecycle fields when listing exists', (done) => {
    const fakeLifecycle = {
      id: 1,
      owner_id: 42,
      status: 'AVAILABLE',
      isSold: false,
      isClosed: false,
    };
    mockQuery(null, [fakeLifecycle]);

    getListingLifecycleById({ id: 1 }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([1]);
      expect(result.rows[0].status).toBe('AVAILABLE');
      done();
    });
  });

  test('should return empty rows when listing does not exist', (done) => {
    mockQuery(null, []);

    getListingLifecycleById({ id: 999 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('query failed');
    mockQuery(dbError, null);

    getListingLifecycleById({ id: 1 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── updateListingStatus (model) ───────────────────────────────────────────────
describe('Listing.model - updateListingStatus', () => {
  const { updateListingStatus } = require('../../src/models/Listing.model');
  afterEach(() => jest.clearAllMocks());

  const updateData = {
    status: 'RESERVED',
    isSold: false,
    isClosed: false,
    id: 1,
    owner_id: 42,
    current_status: 'AVAILABLE',
  };

  test('should update status and return the updated row', (done) => {
    const updatedRow = { id: 1, owner_id: 42, status: 'RESERVED', isSold: false, isClosed: false };
    mockQuery(null, [updatedRow]);

    updateListingStatus(updateData, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual(['RESERVED', false, false, 1, 42, 'AVAILABLE']);
      expect(result.rows[0].status).toBe('RESERVED');
      done();
    });
  });

  test('should return empty rows when owner_id does not match', (done) => {
    mockQuery(null, []);

    updateListingStatus({ ...updateData, owner_id: 99 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  test('should return empty rows when current_status does not match (concurrent update)', (done) => {
    mockQuery(null, []);

    updateListingStatus({ ...updateData, current_status: 'SOLD' }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('update failed');
    mockQuery(dbError, null);

    updateListingStatus(updateData, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── searchListings sort variations ────────────────────────────────────────────
describe('Listing.model - searchListings sort options', () => {
  afterEach(() => jest.clearAllMocks());

  const baseData = { search: '', minPrice: null, maxPrice: null, category: '', sort: '' };

  test('should use price ASC ordering for cheapest sort', (done) => {
    mockQuery(null, []);

    searchListings({ ...baseData, sort: 'cheapest' }, (err) => {
      expect(err).toBeNull();
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('price ASC');
      done();
    });
  });

  test('should use price DESC ordering for expensive sort', (done) => {
    mockQuery(null, []);

    searchListings({ ...baseData, sort: 'expensive' }, (err) => {
      expect(err).toBeNull();
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('price DESC');
      done();
    });
  });

  test('should fall back to newest sort for unknown sort value', (done) => {
    mockQuery(null, []);

    searchListings({ ...baseData, sort: 'unknown' }, (err) => {
      expect(err).toBeNull();
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('created_on DESC');
      done();
    });
  });

  test('should use view_count ordering for most_viewed sort', (done) => {
    mockQuery(null, []);

    searchListings({ ...baseData, sort: 'most_viewed' }, (err) => {
      expect(err).toBeNull();
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('view_count DESC');
      done();
    });
  });

  test('should place listings with no views last rather than first', (done) => {
    // view_count is nullable, and in Postgres DESC puts NULLs first by default,
    // which would show never-viewed listings at the top of "Most Viewed".
    mockQuery(null, []);

    searchListings({ ...baseData, sort: 'most_viewed' }, () => {
      const [sql] = pool.query.mock.calls[0];
      expect(sql).toContain('NULLS LAST');
      done();
    });
  });

  test('should never splice an unrecognised sort value into the SQL', (done) => {
    // The sort value is interpolated into ORDER BY, so the whitelist is the
    // only thing preventing injection through that parameter.
    mockQuery(null, []);

    searchListings({ ...baseData, sort: 'price; DROP TABLE listings;--' }, () => {
      const [sql] = pool.query.mock.calls[0];
      expect(sql).not.toContain('DROP TABLE');
      expect(sql).toContain('created_on DESC');
      done();
    });
  });
});
