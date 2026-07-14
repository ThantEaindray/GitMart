const pool = require('../../src/models/db');
const {
  insertSingle,
  selectAll,
  updateById,
  deleteById,
} = require('../../src/models/Something.model');

// ── Mocking ──────────────────────────────────────────────
// Mock the db module so no real DB connection is needed.
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

// ── insertSingle ─────────────────────────────────────────
describe('Something.model - insertSingle', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: normal string input
  test('should insert a row and return the created something', (done) => {
    const fakeSomething = { id: 1, name: 'cheese' };
    pool.query.mockImplementation((sql, values, callback) => {
      callback(null, { rows: [fakeSomething] });
    });

    insertSingle({ name: 'cheese' }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO "Something" ("name") VALUES ($1) RETURNING *',
        ['cheese'],
        expect.any(Function),
      );
      expect(result.rows[0]).toEqual(fakeSomething);
      done();
    });
  });

  // Error handling: DB constraint violation propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('unique violation');
    pool.query.mockImplementation((sql, values, callback) => {
      callback(dbError, null);
    });

    insertSingle({ name: 'dup' }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });

  // Boundary: empty string is the shortest possible valid input
  test('should pass empty string to the query (boundary – shortest valid input)', (done) => {
    const fakeSomething = { id: 2, name: '' };
    pool.query.mockImplementation((sql, values, callback) => {
      callback(null, { rows: [fakeSomething] });
    });

    insertSingle({ name: '' }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO "Something" ("name") VALUES ($1) RETURNING *',
        [''],
        expect.any(Function),
      );
      expect(result.rows[0]).toEqual(fakeSomething);
      done();
    });
  });
});

// ── selectAll ────────────────────────────────────────────
describe('Something.model - selectAll', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: multiple rows returned from DB
  test('should return all somethings', (done) => {
    const fakeSomethings = [
      { id: 1, name: 'Seed 1' },
      { id: 2, name: 'Seed 2' },
    ];
    pool.query.mockImplementation((sql, values, callback) => {
      callback(null, { rows: fakeSomethings });
    });

    selectAll((err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM "Something"',
        [],
        expect.any(Function),
      );
      expect(result.rows).toEqual(fakeSomethings);
      done();
    });
  });

  // Boundary: zero rows – empty result set
  test('should return an empty array when no somethings exist', (done) => {
    pool.query.mockImplementation((sql, values, callback) => {
      callback(null, { rows: [] });
    });

    selectAll((err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB timeout propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('timeout');
    pool.query.mockImplementation((sql, values, callback) => {
      callback(dbError, null);
    });

    selectAll((err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── updateById ───────────────────────────────────────────
describe('Something.model - updateById', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: update with a valid id and name
  test('should update name and return the updated row', (done) => {
    const updated = { id: 1, name: 'milk' };
    pool.query.mockImplementation((sql, values, callback) => {
      callback(null, { rows: [updated] });
    });

    updateById({ id: 1, name: 'milk' }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE "Something" SET "name" = $1 WHERE "id" = $2 RETURNING *',
        ['milk', 1],
        expect.any(Function),
      );
      expect(result.rows[0]).toEqual(updated);
      done();
    });
  });

  // Boundary: non-existent id returns zero rows
  test('should return zero rows when id does not exist', (done) => {
    pool.query.mockImplementation((sql, values, callback) => {
      callback(null, { rows: [] });
    });

    updateById({ id: 999, name: 'ghost' }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB syntax error propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('syntax error');
    pool.query.mockImplementation((sql, values, callback) => {
      callback(dbError, null);
    });

    updateById({ id: 1, name: 'bad' }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });
});

// ── deleteById ───────────────────────────────────────────
describe('Something.model - deleteById', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: delete an existing row and return it
  test('should delete a row and return the deleted something', (done) => {
    const deleted = { id: 3, name: 'gone' };
    pool.query.mockImplementation((sql, values, callback) => {
      callback(null, { rows: [deleted] });
    });

    deleteById({ id: 3 }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM "Something" WHERE "id" = $1 RETURNING *',
        [3],
        expect.any(Function),
      );
      expect(result.rows[0]).toEqual(deleted);
      done();
    });
  });

  // Boundary: non-existent id returns zero rows
  test('should return zero rows when id does not exist', (done) => {
    pool.query.mockImplementation((sql, values, callback) => {
      callback(null, { rows: [] });
    });

    deleteById({ id: 999 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB connection loss propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('connection lost');
    pool.query.mockImplementation((sql, values, callback) => {
      callback(dbError, null);
    });

    deleteById({ id: 1 }, (err) => {
      expect(err).toBe(dbError);
      done();
    });
  });

  // Boundary: negative id – well below valid range
  test('should pass negative id to the query (boundary – below valid range)', (done) => {
    pool.query.mockImplementation((sql, values, callback) => {
      callback(null, { rows: [] });
    });

    deleteById({ id: -1 }, (err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM "Something" WHERE "id" = $1 RETURNING *',
        [-1],
        expect.any(Function),
      );
      expect(result.rows).toEqual([]);
      done();
    });
  });
});
