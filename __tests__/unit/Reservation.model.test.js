const pool = require('../../src/models/db');
const model = require('../../src/models/Reservation.model');

jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => jest.restoreAllMocks());

function mockQuery(err, rows) {
  pool.query.mockImplementation((...args) => {
    const callback = args[args.length - 1];
    callback(err, err ? null : { rows });
  });
}

// Returns the SQL text and bound values of the most recent pool.query call.
function lastQuery() {
  const [sql, values] = pool.query.mock.calls[pool.query.mock.calls.length - 1];
  return { sql, values };
}

// ── createReservationRequest ──────────────────────────────────────────────

describe('Reservation.model - createReservationRequest', () => {
  afterEach(() => jest.clearAllMocks());

  test('binds listing, requester and message in order', (done) => {
    mockQuery(null, [{ id: 1 }]);

    model.createReservationRequest(
      { listing_id: 5, requester_id: 20, message: 'Please hold this.' },
      (err) => {
        expect(err).toBeNull();
        expect(lastQuery().values).toEqual([5, 20, 'Please hold this.']);
        done();
      },
    );
  });

  test('joins users so the requester username comes back with the new row', (done) => {
    const created = {
      id: 101,
      listing_id: 5,
      requester_id: 20,
      status: 'PENDING',
      message: null,
      requester_username: 'buyer_bob',
    };

    mockQuery(null, [created]);

    model.createReservationRequest(
      { listing_id: 5, requester_id: 20, message: null },
      (err, result) => {
        const { sql } = lastQuery();

        // The username must arrive from the same statement as the INSERT,
        // otherwise the controller would need a second nested query.
        expect(sql).toMatch(/INSERT INTO reservation_requests/);
        expect(sql).toMatch(/requester_username/);
        expect(pool.query).toHaveBeenCalledTimes(1);

        expect(result.rows[0]).toEqual(created);
        done();
      },
    );
  });

  test('propagates database errors to the callback', (done) => {
    const failure = new Error('duplicate key');
    mockQuery(failure);

    model.createReservationRequest({ listing_id: 5, requester_id: 20, message: null }, (err) => {
      expect(err).toBe(failure);
      done();
    });
  });
});

// ── getMyReservationForListing ────────────────────────────────────────────

describe('Reservation.model - getMyReservationForListing', () => {
  afterEach(() => jest.clearAllMocks());

  test('binds listing and requester', (done) => {
    mockQuery(null, []);

    model.getMyReservationForListing({ listing_id: 7, requester_id: 3 }, (err) => {
      expect(err).toBeNull();
      expect(lastQuery().values).toEqual([7, 3]);
      done();
    });
  });

  test('returns only the most recent reservation', (done) => {
    mockQuery(null, [{ id: 9, listing_id: 7, requester_id: 3, status: 'ACCEPTED' }]);

    model.getMyReservationForListing({ listing_id: 7, requester_id: 3 }, (err, result) => {
      const { sql } = lastQuery();

      expect(sql).toMatch(/ORDER BY/);
      expect(sql).toMatch(/LIMIT 1/);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].status).toBe('ACCEPTED');
      done();
    });
  });

  test('does not filter by status, so cancelled and rejected rows are visible', () => {
    mockQuery(null, []);

    model.getMyReservationForListing({ listing_id: 7, requester_id: 3 }, () => {});

    expect(lastQuery().sql).not.toMatch(/status\s*=\s*'PENDING'/);
  });

  test('returns an empty row set when the user holds no reservation', (done) => {
    mockQuery(null, []);

    model.getMyReservationForListing({ listing_id: 7, requester_id: 3 }, (err, result) => {
      expect(result.rows).toEqual([]);
      done();
    });
  });
});

// ── getAcceptedListingIdsForUser ──────────────────────────────────────────

describe('Reservation.model - getAcceptedListingIdsForUser', () => {
  afterEach(() => jest.clearAllMocks());

  test('binds the requester and the listing id array', (done) => {
    mockQuery(null, []);

    model.getAcceptedListingIdsForUser({ requester_id: 4, listing_ids: [1, 2, 3] }, () => {
      expect(lastQuery().values).toEqual([4, [1, 2, 3]]);
      done();
    });
  });

  test('requires the reservation to be ACCEPTED and the listing still RESERVED', () => {
    mockQuery(null, []);

    model.getAcceptedListingIdsForUser({ requester_id: 4, listing_ids: [1] }, () => {});

    const { sql } = lastQuery();

    // Both halves matter: an accepted reservation on a SOLD listing must not
    // let the buyer check out a second time.
    expect(sql).toMatch(/reservation_requests\.status\s*=\s*'ACCEPTED'/);
    expect(sql).toMatch(/listings\.status\s*=\s*'RESERVED'/);
  });

  test('returns only the listing ids the user may buy', (done) => {
    mockQuery(null, [{ listing_id: 1 }, { listing_id: 3 }]);

    model.getAcceptedListingIdsForUser(
      { requester_id: 4, listing_ids: [1, 2, 3] },
      (err, result) => {
        expect(result.rows.map((row) => row.listing_id)).toEqual([1, 3]);
        done();
      },
    );
  });

  test('propagates database errors to the callback', (done) => {
    const failure = new Error('connection lost');
    mockQuery(failure);

    model.getAcceptedListingIdsForUser({ requester_id: 4, listing_ids: [1] }, (err) => {
      expect(err).toBe(failure);
      done();
    });
  });
});

// ── acceptReservationRequest (transaction) ────────────────────────────────

describe('Reservation.model - acceptReservationRequest', () => {
  afterEach(() => jest.clearAllMocks());

  // Builds a fake pg client whose query() replies based on the SQL it receives.
  function mockClient(lookupRows, { failOn = null } = {}) {
    const client = {
      query: jest.fn((sql) => {
        if (failOn && sql.includes(failOn)) {
          return Promise.reject(new Error('write failed'));
        }
        if (sql.includes('FOR UPDATE OF reservation_requests')) {
          return Promise.resolve({ rows: lookupRows });
        }
        if (sql.includes("SET status = 'ACCEPTED'")) {
          return Promise.resolve({ rows: [{ id: 1, listing_id: 5, requester_id: 20 }] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn(),
    };

    pool.connect.mockResolvedValue(client);
    return client;
  }

  const pendingLookup = [
    {
      id: 1,
      listing_id: 5,
      status: 'PENDING',
      owner_id: 10,
      title: 'Vintage Watch',
      listing_status: 'AVAILABLE',
    },
  ];

  test('commits and returns the listing title alongside the reservation', async () => {
    const client = mockClient(pendingLookup);

    const result = await model.acceptReservationRequest({ id: 1, owner_id: 10 });

    expect(result.success).toBe(true);
    expect(result.listingTitle).toBe('Vintage Watch');
    expect(result.reservation).toEqual({ id: 1, listing_id: 5, requester_id: 20 });

    const executed = client.query.mock.calls.map(([sql]) => sql).join('\n');
    expect(executed).toMatch(/BEGIN/);
    expect(executed).toMatch(/COMMIT/);
    expect(client.release).toHaveBeenCalled();
  });

  test('rejects the other pending requests and marks the listing RESERVED', async () => {
    const client = mockClient(pendingLookup);

    await model.acceptReservationRequest({ id: 1, owner_id: 10 });

    const executed = client.query.mock.calls.map(([sql]) => sql).join('\n');

    expect(executed).toMatch(/SET status = 'REJECTED'/);
    expect(executed).toMatch(/SET status = 'RESERVED'/);
  });

  test('rolls back and reports notFound when the reservation is missing', async () => {
    const client = mockClient([]);

    const result = await model.acceptReservationRequest({ id: 99, owner_id: 10 });

    expect(result).toEqual({ notFound: true });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('rolls back and reports forbidden when the caller is not the owner', async () => {
    const client = mockClient(pendingLookup);

    const result = await model.acceptReservationRequest({ id: 1, owner_id: 999 });

    expect(result).toEqual({ forbidden: true });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  test('rolls back and reports invalidState when the request is not pending', async () => {
    mockClient([{ ...pendingLookup[0], status: 'REJECTED' }]);

    const result = await model.acceptReservationRequest({ id: 1, owner_id: 10 });

    expect(result).toEqual({ invalidState: true, currentStatus: 'REJECTED' });
  });

  test('rolls back and reports listingUnavailable when the listing is not AVAILABLE', async () => {
    mockClient([{ ...pendingLookup[0], listing_status: 'SOLD' }]);

    const result = await model.acceptReservationRequest({ id: 1, owner_id: 10 });

    expect(result).toEqual({ listingUnavailable: true, listingStatus: 'SOLD' });
  });

  test('rolls back and releases the client when a write throws', async () => {
    const client = mockClient(pendingLookup, { failOn: "SET status = 'ACCEPTED'" });

    await expect(model.acceptReservationRequest({ id: 1, owner_id: 10 })).rejects.toThrow(
      'write failed',
    );

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

// ── releaseExpiredReservations ────────────────────────────────────────────

describe('Reservation.model - releaseExpiredReservations', () => {
  afterEach(() => jest.clearAllMocks());

  function mockClient(expiredRows, { failOn = null } = {}) {
    const client = {
      query: jest.fn((sql) => {
        if (failOn && sql.includes(failOn)) {
          return Promise.reject(new Error('write failed'));
        }
        if (sql.includes('FOR UPDATE OF listings, reservation_requests')) {
          return Promise.resolve({ rows: expiredRows });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn(),
    };

    pool.connect.mockResolvedValue(client);
    return client;
  }

  const expiredRow = {
    reservation_id: 1,
    requester_id: 20,
    listing_id: 5,
    owner_id: 10,
    title: 'Vintage Watch',
  };

  test('returns an empty array and commits when nothing has expired', async () => {
    const client = mockClient([]);

    const result = await model.releaseExpiredReservations(24);

    expect(result).toEqual([]);
    const executed = client.query.mock.calls.map(([sql]) => sql).join('\n');
    expect(executed).toMatch(/BEGIN/);
    expect(executed).toMatch(/COMMIT/);
    // Nothing to update, so neither write statement should have run.
    expect(executed).not.toMatch(/SET status = 'AVAILABLE'/);
    expect(executed).not.toMatch(/SET status = 'EXPIRED'/);
  });

  test('binds holdHours into the interval lookup', async () => {
    const client = mockClient([]);

    await model.releaseExpiredReservations(24);

    const [, values] = client.query.mock.calls.find(([sql]) =>
      sql.includes('FOR UPDATE OF listings, reservation_requests'),
    );
    expect(values).toEqual([24]);
  });

  test('releases the listing and marks the reservation EXPIRED', async () => {
    const client = mockClient([expiredRow]);

    const result = await model.releaseExpiredReservations(24);

    expect(result).toEqual([expiredRow]);

    const listingsUpdate = client.query.mock.calls.find(([sql]) =>
      sql.includes("SET status = 'AVAILABLE'"),
    );
    expect(listingsUpdate[1]).toEqual([[5]]);

    const reservationsUpdate = client.query.mock.calls.find(([sql]) =>
      sql.includes("SET status = 'EXPIRED'"),
    );
    expect(reservationsUpdate[1]).toEqual([[1]]);

    const executed = client.query.mock.calls.map(([sql]) => sql).join('\n');
    expect(executed).toMatch(/COMMIT/);
    expect(client.release).toHaveBeenCalled();
  });

  test('releases every expired listing in one sweep', async () => {
    const secondRow = { ...expiredRow, reservation_id: 2, listing_id: 6 };
    const client = mockClient([expiredRow, secondRow]);

    const result = await model.releaseExpiredReservations(24);

    expect(result).toHaveLength(2);

    const listingsUpdate = client.query.mock.calls.find(([sql]) =>
      sql.includes("SET status = 'AVAILABLE'"),
    );
    expect(listingsUpdate[1]).toEqual([[5, 6]]);
  });

  test('rolls back and releases the client when a write throws', async () => {
    const client = mockClient([expiredRow], { failOn: "SET status = 'AVAILABLE'" });

    await expect(model.releaseExpiredReservations(24)).rejects.toThrow('write failed');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
