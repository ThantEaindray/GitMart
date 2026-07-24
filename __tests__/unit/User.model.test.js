const pool = require('../../src/models/db');
const {
  getUserByUsername, getUserByEmail, createUser, getUserById, getUserSettings, saveRefreshToken, getRefreshToken, deleteRefreshToken, deleteAllRefreshTokensForUser, updateProfileImage, updateDisplayName, updateNotifications, deleteUser, getUserPasswordById, updateUserPassword, updateUserSettings,
} = require('../../src/models/User.model');

jest.mock('../../src/models/db', () => ({ query: jest.fn(), end: jest.fn() }));

afterAll(() => jest.restoreAllMocks());

function mockQuery(err, rows) {
  pool.query.mockImplementation((...args) => {
    const callback = args[args.length - 1];
    callback(err, err ? null : { rows });
  });
}

// ── getUserByUsername ────────────────────────────────────────────────────────

describe('getUserByUsername', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    getUserByUsername({ username: 'alice' }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('passes result rows to callback', (done) => {
    mockQuery(null, [{ id: 1, username: 'alice' }]);
    getUserByUsername({ username: 'alice' }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toHaveLength(1);
      done();
    });
  });
});

// ── getUserByEmail ───────────────────────────────────────────────────────────

describe('getUserByEmail', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    getUserByEmail({ email: 'a@b.com' }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('passes result rows to callback', (done) => {
    mockQuery(null, [{ id: 1, email: 'a@b.com' }]);
    getUserByEmail({ email: 'a@b.com' }, (err, result) => {
      expect(result.rows[0].email).toBe('a@b.com');
      done();
    });
  });
});

// ── createUser ───────────────────────────────────────────────────────────────

describe('createUser', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    createUser({ username: 'alice', email: 'a@b.com', password: 'hash' }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('returns new user row on success', (done) => {
    mockQuery(null, [{ id: 7, username: 'alice' }]);
    createUser({ username: 'alice', email: 'a@b.com', password: 'hash' }, (err, result) => {
      expect(result.rows[0].id).toBe(7);
      done();
    });
  });
});

// ── getUserById ──────────────────────────────────────────────────────────────

describe('getUserById', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    getUserById({ id: 1 }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('passes user row to callback', (done) => {
    mockQuery(null, [{ id: 1, username: 'alice' }]);
    getUserById({ id: 1 }, (err, result) => {
      expect(result.rows[0].username).toBe('alice');
      done();
    });
  });
});

// ── getUserSettings ──────────────────────────────────────────────────────────

describe('getUserSettings', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    getUserSettings({ id: 1 }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('passes settings row to callback', (done) => {
    mockQuery(null, [{ theme: 'dark', currency: 'USD' }]);
    getUserSettings({ id: 1 }, (err, result) => {
      expect(result.rows[0].theme).toBe('dark');
      done();
    });
  });
});

// ── saveRefreshToken ─────────────────────────────────────────────────────────

describe('saveRefreshToken', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    saveRefreshToken({ userId: 1, token: 'tok', expiresAt: new Date() }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('calls callback without error on success', (done) => {
    mockQuery(null, []);
    saveRefreshToken({ userId: 1, token: 'tok', expiresAt: new Date() }, (err) => {
      expect(err).toBeNull();
      done();
    });
  });
});

// ── getRefreshToken ──────────────────────────────────────────────────────────

describe('getRefreshToken', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    getRefreshToken({ token: 'tok' }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('passes token row to callback', (done) => {
    mockQuery(null, [{ id: 1, user_id: 2 }]);
    getRefreshToken({ token: 'tok' }, (err, result) => {
      expect(result.rows[0].user_id).toBe(2);
      done();
    });
  });
});

// ── deleteRefreshToken ───────────────────────────────────────────────────────

describe('deleteRefreshToken', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    deleteRefreshToken({ token: 'tok' }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('calls callback without error on success', (done) => {
    mockQuery(null, []);
    deleteRefreshToken({ token: 'tok' }, (err) => {
      expect(err).toBeNull();
      done();
    });
  });
});

// ── deleteAllRefreshTokensForUser ────────────────────────────────────────────

describe('deleteAllRefreshTokensForUser', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    deleteAllRefreshTokensForUser({ userId: 1 }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('calls callback without error on success', (done) => {
    mockQuery(null, []);
    deleteAllRefreshTokensForUser({ userId: 1 }, (err) => {
      expect(err).toBeNull();
      done();
    });
  });
});

// ── updateProfileImage ───────────────────────────────────────────────────────

describe('updateProfileImage', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    updateProfileImage({ id: 1, imageBuffer: Buffer.from('img') }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('returns updated row on success', (done) => {
    mockQuery(null, [{ id: 1, profile_image: 'base64data' }]);
    updateProfileImage({ id: 1, imageBuffer: Buffer.from('img') }, (err, result) => {
      expect(result.rows[0].profile_image).toBe('base64data');
      done();
    });
  });
});

// ── updateDisplayName ────────────────────────────────────────────────────────

describe('updateDisplayName', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    updateDisplayName({ id: 1, displayName: 'Alice' }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('calls callback without error on success', (done) => {
    mockQuery(null, []);
    updateDisplayName({ id: 1, displayName: 'Alice' }, (err) => {
      expect(err).toBeNull();
      done();
    });
  });
});

// ── updateNotifications ──────────────────────────────────────────────────────

describe('updateNotifications', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    updateNotifications({ id: 1, notifyOrders: true, notifyPromotions: false }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('calls callback without error on success', (done) => {
    mockQuery(null, []);
    updateNotifications({ id: 1, notifyOrders: true, notifyPromotions: false }, (err) => {
      expect(err).toBeNull();
      done();
    });
  });
});

// ── deleteUser ───────────────────────────────────────────────────────────────

describe('deleteUser', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    deleteUser({ id: 1 }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('calls callback without error on success', (done) => {
    mockQuery(null, []);
    deleteUser({ id: 1 }, (err) => {
      expect(err).toBeNull();
      done();
    });
  });
});

// ── getUserPasswordById ──────────────────────────────────────────────────────

describe('getUserPasswordById', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    getUserPasswordById({ id: 1 }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('passes password row to callback', (done) => {
    mockQuery(null, [{ password: 'hashed' }]);
    getUserPasswordById({ id: 1 }, (err, result) => {
      expect(result.rows[0].password).toBe('hashed');
      done();
    });
  });
});

// ── updateUserPassword ───────────────────────────────────────────────────────

describe('updateUserPassword', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    updateUserPassword({ id: 1, password: 'newHash' }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('calls callback without error on success', (done) => {
    mockQuery(null, []);
    updateUserPassword({ id: 1, password: 'newHash' }, (err) => {
      expect(err).toBeNull();
      done();
    });
  });
});

// ── updateUserSettings ───────────────────────────────────────────────────────

describe('updateUserSettings', () => {
  it('propagates DB error to callback', (done) => {
    mockQuery(new Error('DB error'), null);
    updateUserSettings({ id: 1, theme: 'dark', currency: 'USD', fontSize: null }, (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });

  it('returns updated settings row on success', (done) => {
    mockQuery(null, [{ theme: 'dark', currency: 'USD', font_size: null }]);
    updateUserSettings({ id: 1, theme: 'dark', currency: 'USD', fontSize: null }, (err, result) => {
      expect(result.rows[0].theme).toBe('dark');
      done();
    });
  });
});

// ── SQL values verification tests ─────────────────────────────────────────────
// beforeEach clears mock.calls so mock.calls[0] reliably refers to the current test's call.

describe('SQL values verification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getUserByUsername passes username as the first query parameter', (done) => {
    mockQuery(null, []);
    getUserByUsername({ username: 'bob' }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe('bob');
      done();
    });
  });

  it('getUserByEmail passes email as the first query parameter', (done) => {
    mockQuery(null, []);
    getUserByEmail({ email: 'bob@example.com' }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe('bob@example.com');
      done();
    });
  });

  it('createUser passes username, email, and password in correct order', (done) => {
    mockQuery(null, []);
    createUser({ username: 'charlie', email: 'c@c.com', password: 'hashed' }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual(['charlie', 'c@c.com', 'hashed']);
      done();
    });
  });

  it('getUserById passes id as the first query parameter', (done) => {
    mockQuery(null, []);
    getUserById({ id: 99 }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe(99);
      done();
    });
  });

  it('getUserSettings passes id as the first query parameter', (done) => {
    mockQuery(null, []);
    getUserSettings({ id: 7 }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe(7);
      done();
    });
  });

  it('saveRefreshToken passes userId, token, and expiresAt in correct order', (done) => {
    const expiresAt = new Date('2030-01-01');
    mockQuery(null, []);
    saveRefreshToken({ userId: 3, token: 'mytoken', expiresAt }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual([3, 'mytoken', expiresAt]);
      done();
    });
  });

  it('getRefreshToken passes token as the first query parameter', (done) => {
    mockQuery(null, []);
    getRefreshToken({ token: 'refresh123' }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe('refresh123');
      done();
    });
  });

  it('deleteRefreshToken passes token as the first query parameter', (done) => {
    mockQuery(null, []);
    deleteRefreshToken({ token: 'oldtoken' }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe('oldtoken');
      done();
    });
  });

  it('deleteAllRefreshTokensForUser passes userId as the first query parameter', (done) => {
    mockQuery(null, []);
    deleteAllRefreshTokensForUser({ userId: 5 }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe(5);
      done();
    });
  });

  it('updateProfileImage passes id as first and imageBuffer as second parameter', (done) => {
    const buf = Buffer.from('imagedata');
    mockQuery(null, []);
    updateProfileImage({ id: 10, imageBuffer: buf }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe(10);
      expect(values[1]).toBe(buf);
      done();
    });
  });

  it('updateDisplayName passes id and displayName in correct order', (done) => {
    mockQuery(null, []);
    updateDisplayName({ id: 11, displayName: 'New Name' }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe(11);
      expect(values[1]).toBe('New Name');
      done();
    });
  });

  it('updateNotifications passes id, notifyOrders, and notifyPromotions in correct order', (done) => {
    mockQuery(null, []);
    updateNotifications({ id: 12, notifyOrders: true, notifyPromotions: false }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe(12);
      expect(values[1]).toBe(true);
      expect(values[2]).toBe(false);
      done();
    });
  });

  it('deleteUser passes id as the first query parameter', (done) => {
    mockQuery(null, []);
    deleteUser({ id: 13 }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe(13);
      done();
    });
  });

  it('getUserPasswordById passes id as the first query parameter', (done) => {
    mockQuery(null, []);
    getUserPasswordById({ id: 14 }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe(14);
      done();
    });
  });

  it('updateUserPassword passes id and new password in correct order', (done) => {
    mockQuery(null, []);
    updateUserPassword({ id: 15, password: 'newHash' }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBe(15);
      expect(values[1]).toBe('newHash');
      done();
    });
  });

  it('updateUserSettings passes theme, currency, fontSize, id in correct order', (done) => {
    mockQuery(null, []);
    updateUserSettings({ id: 16, theme: 'noir', currency: 'SGD', fontSize: 'lg' }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values).toEqual(['noir', 'SGD', 'lg', 16]);
      done();
    });
  });
});

// ── extra edge cases ──────────────────────────────────────────────────────────

describe('extra edge cases', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getUserByUsername returns empty rows when username does not exist', (done) => {
    mockQuery(null, []);
    getUserByUsername({ username: 'nonexistent' }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toHaveLength(0);
      done();
    });
  });

  it('getUserByEmail returns empty rows when email does not exist', (done) => {
    mockQuery(null, []);
    getUserByEmail({ email: 'noone@nowhere.com' }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toHaveLength(0);
      done();
    });
  });

  it('updateDisplayName passes null when displayName is empty string', (done) => {
    mockQuery(null, []);
    updateDisplayName({ id: 1, displayName: '' }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[1]).toBeNull();
      done();
    });
  });

  it('saveRefreshToken calls pool.query exactly once', (done) => {
    mockQuery(null, []);
    saveRefreshToken({ userId: 1, token: 'tok', expiresAt: new Date() }, () => {
      expect(pool.query).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('deleteAllRefreshTokensForUser calls pool.query exactly once', (done) => {
    mockQuery(null, []);
    deleteAllRefreshTokensForUser({ userId: 1 }, () => {
      expect(pool.query).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('updateNotifications correctly passes notifyOrders=false and notifyPromotions=true', (done) => {
    mockQuery(null, []);
    updateNotifications({ id: 1, notifyOrders: false, notifyPromotions: true }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[1]).toBe(false);
      expect(values[2]).toBe(true);
      done();
    });
  });

  it('getUserPasswordById returns empty rows when user does not exist', (done) => {
    mockQuery(null, []);
    getUserPasswordById({ id: 9999 }, (err, result) => {
      expect(err).toBeNull();
      expect(result.rows).toHaveLength(0);
      done();
    });
  });

  it('updateUserSettings passes null values for theme and fontSize when not provided', (done) => {
    mockQuery(null, []);
    updateUserSettings({ id: 1, theme: null, currency: 'USD', fontSize: null }, () => {
      const [, values] = pool.query.mock.calls[0];
      expect(values[0]).toBeNull();
      expect(values[2]).toBeNull();
      done();
    });
  });

  it('createUser calls pool.query exactly once', (done) => {
    mockQuery(null, [{ id: 1, username: 'test', isStaff: false }]);
    createUser({ username: 'test', email: 't@t.com', password: 'hash' }, () => {
      expect(pool.query).toHaveBeenCalledTimes(1);
      done();
    });
  });
});
