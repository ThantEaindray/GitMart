const pool = require('../../src/models/db');
const model = require('../../src/models/Notification.model');

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

// ── create ────────────────────────────────────────────────────────────────

describe('Notification.model - create', () => {
  afterEach(() => jest.clearAllMocks());

  test('binds user, type, title, message and link in order', (done) => {
    mockQuery(null, [{ id: 1 }]);

    model.create(
      { userId: 7, type: 'reservation', title: 'T', message: 'M', link: '/html/listing.html?id=5' },
      () => {
        expect(lastQuery().values).toEqual([7, 'reservation', 'T', 'M', '/html/listing.html?id=5']);
        done();
      },
    );
  });

  test('binds a null link when none is given', (done) => {
    mockQuery(null, [{ id: 1 }]);

    model.create({ userId: 7, type: 'system', title: 'T', message: 'M' }, () => {
      expect(lastQuery().values).toEqual([7, 'system', 'T', 'M', null]);
      done();
    });
  });

  test('returns the stored row so the caller can push it without re-reading', (done) => {
    mockQuery(null, [{ id: 1 }]);

    model.create({ userId: 7, type: 'system', title: 'T', message: 'M' }, () => {
      const sql = flat(lastQuery().sql);
      expect(sql).toContain('INSERT INTO notifications');
      expect(sql).toContain('RETURNING');
      expect(sql).toContain('is_read');
      expect(sql).toContain('created_on');
      done();
    });
  });

  test('does not set is_read, leaving the column default to apply', (done) => {
    mockQuery(null, [{ id: 1 }]);

    model.create({ userId: 7, type: 'system', title: 'T', message: 'M' }, () => {
      const columns = flat(lastQuery().sql).split('VALUES')[0];
      expect(columns).not.toContain('is_read');
      done();
    });
  });

  test('passes database errors through to the callback', (done) => {
    const boom = new Error('insert failed');
    mockQuery(boom);

    model.create({ userId: 7, type: 'system', title: 'T', message: 'M' }, (error) => {
      expect(error).toBe(boom);
      done();
    });
  });
});

// ── getByUser ─────────────────────────────────────────────────────────────

describe('Notification.model - getByUser', () => {
  afterEach(() => jest.clearAllMocks());

  test('scopes to the given user', (done) => {
    mockQuery(null, []);

    model.getByUser({ userId: 7 }, () => {
      expect(lastQuery().values).toEqual([7]);
      expect(flat(lastQuery().sql)).toContain('WHERE user_id = $1');
      done();
    });
  });

  test('orders newest first, tie-broken by id so paging is stable', (done) => {
    mockQuery(null, []);

    model.getByUser({ userId: 7 }, () => {
      expect(flat(lastQuery().sql)).toContain('ORDER BY created_on DESC, id DESC');
      done();
    });
  });
});

// ── getUnreadCount ────────────────────────────────────────────────────────

describe('Notification.model - getUnreadCount', () => {
  afterEach(() => jest.clearAllMocks());

  test('counts only unread rows for that user', (done) => {
    mockQuery(null, [{ count: '3' }]);

    model.getUnreadCount({ userId: 7 }, () => {
      const sql = flat(lastQuery().sql);
      expect(sql).toContain('COUNT(*)');
      expect(sql).toContain('user_id = $1');
      expect(sql).toContain('is_read = false');
      done();
    });
  });

  test('returns count as a string, which callers must convert', (done) => {
    // Documents the node-postgres behaviour the controller compensates for:
    // COUNT(*) is bigint and arrives as a string to avoid precision loss.
    mockQuery(null, [{ count: '3' }]);

    model.getUnreadCount({ userId: 7 }, (_error, result) => {
      expect(typeof result.rows[0].count).toBe('string');
      done();
    });
  });
});

// ── markRead ──────────────────────────────────────────────────────────────

describe('Notification.model - markRead', () => {
  afterEach(() => jest.clearAllMocks());

  test('requires the notification to belong to the user', (done) => {
    mockQuery(null, [{ id: 4 }]);

    model.markRead({ id: 4, userId: 7 }, () => {
      const sql = flat(lastQuery().sql);
      // Both predicates must be present, otherwise one user could mark
      // another user's notification read by guessing an id.
      expect(sql).toContain('WHERE id = $1 AND user_id = $2');
      expect(lastQuery().values).toEqual([4, 7]);
      done();
    });
  });

  test('returns no rows when the notification belongs to someone else', (done) => {
    mockQuery(null, []);

    model.markRead({ id: 4, userId: 999 }, (_error, result) => {
      expect(result.rows).toHaveLength(0);
      done();
    });
  });
});

// ── markAllRead ───────────────────────────────────────────────────────────

describe('Notification.model - markAllRead', () => {
  afterEach(() => jest.clearAllMocks());

  test('only touches rows that are still unread', (done) => {
    mockQuery(null, []);

    model.markAllRead({ userId: 7 }, () => {
      const sql = flat(lastQuery().sql);
      expect(sql).toContain('user_id = $1');
      expect(sql).toContain('is_read = false');
      expect(lastQuery().values).toEqual([7]);
      done();
    });
  });
});

// ── getEmailRecipient ─────────────────────────────────────────────────────

describe('Notification.model - getEmailRecipient', () => {
  afterEach(() => jest.clearAllMocks());

  test('selects the address, name and opt-out flag for one user', (done) => {
    mockQuery(null, [{ email: 'a@b.c', username: 'ann', notify_email: true }]);

    model.getEmailRecipient({ userId: 7 }, () => {
      const sql = flat(lastQuery().sql);
      expect(sql).toContain('email');
      expect(sql).toContain('username');
      expect(sql).toContain('notify_email');
      expect(sql).toContain('WHERE id = $1');
      expect(lastQuery().values).toEqual([7]);
      done();
    });
  });

  test('never selects the password column', (done) => {
    mockQuery(null, []);

    model.getEmailRecipient({ userId: 7 }, () => {
      expect(flat(lastQuery().sql)).not.toContain('password');
      done();
    });
  });
});
