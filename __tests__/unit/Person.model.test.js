const pool = require('../../src/models/db');
const { getAllPersons } = require('../../src/models/Person.model');

// ── Mocking ──────────────────────────────────────────────
// Mock the db module so no real DB connection is needed.
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────
describe('Person.model - getAllPersons', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple rows returned from DB
  test('should return all persons from the database', (done) => {
    const fakePersons = [
      { id: 1, email: 'alice@example.com', name: 'Alice', avatar: null },
      { id: 2, email: 'bob@example.com', name: 'Bob', avatar: null },
    ];
    pool.query.mockImplementation((sql, values, callback) => {
      callback(null, { rows: fakePersons });
    });

    getAllPersons((err, result) => {
      expect(err).toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "Person"', [], expect.any(Function));
      expect(result.rows).toEqual(fakePersons);
      done();
    });
  });

  // Boundary: zero rows – empty result set
  test('should return an empty array when no persons exist', (done) => {
    pool.query.mockImplementation((sql, values, callback) => {
      callback(null, { rows: [] });
    });

    getAllPersons((err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toEqual([]);
      done();
    });
  });

  // Error handling: DB connection failure propagates to callback
  test('should propagate database errors to callback', (done) => {
    const dbError = new Error('connection refused');
    pool.query.mockImplementation((sql, values, callback) => {
      callback(dbError, null);
    });

    getAllPersons((err, result) => {
      expect(err).toBe(dbError);
      expect(result).toBeNull();
      done();
    });
  });
});
