const pool = require('../../src/models/db');
const model = require('../../src/models/image.model');

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

// Collapses whitespace so assertions are not brittle about SQL indentation.
function flat(sql) {
  return sql.replace(/\s+/g, ' ').trim();
}

describe('image.model - writeDB', () => {
  afterEach(() => jest.clearAllMocks());

  test('inserts into chatcontent binding chat, from, cont_type and cont in order', () => {
    mockQuery(null, [{ id: 1 }]);

    const callback = jest.fn();
    model.writeDB({ chat: 5, from: 2, cont_type: 'img', cont: 'http://host/file.png' }, callback);

    expect(flat(lastQuery().sql)).toBe(
      'INSERT INTO chatcontent (chat_id, sender_id, cont_type, cont) VALUES ($1, $2, $3, $4)',
    );
    expect(lastQuery().values).toEqual([5, 2, 'img', 'http://host/file.png']);
  });

  test('passes the query result through to the callback on success', () => {
    mockQuery(null, [{ id: 42 }]);

    const callback = jest.fn();
    model.writeDB({ chat: 1, from: 1, cont_type: 'img', cont: 'x' }, callback);

    expect(callback).toHaveBeenCalledWith(null, { rows: [{ id: 42 }] });
  });

  test('passes a query error through to the callback rather than throwing', () => {
    const dbError = new Error('insert failed');
    mockQuery(dbError);

    const callback = jest.fn();
    model.writeDB({ chat: 1, from: 1, cont_type: 'img', cont: 'x' }, callback);

    expect(callback).toHaveBeenCalledWith(dbError, null);
  });
});
