const controller = require('../../src/controllers/User.controller');
const model = require('../../src/models/User.model');

jest.mock('../../src/models/User.model');

afterAll(() => jest.restoreAllMocks());

function makeRes(locals = {}) {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    clearCookie: jest.fn(),
    locals: { ...locals },
  };
  return res;
}

function mockFn(fn, err, rows) {
  fn.mockImplementation((_data, callback) => {
    callback(err, err ? null : { rows: rows ?? [] });
  });
}

// ── checkUsernameExists ──────────────────────────────────────────────────────

describe('checkUsernameExists', () => {
  it('returns 400 when fields are missing', () => {
    const req = { body: { username: 'alice' } };
    const res = makeRes();
    controller.checkUsernameExists(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when password is too short', () => {
    const req = { body: { username: 'alice', email: 'a@b.com', password: '123' } };
    const res = makeRes();
    controller.checkUsernameExists(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('6') }),
    );
  });

  it('returns 500 on DB error', () => {
    const req = { body: { username: 'alice', email: 'a@b.com', password: 'secret1' } };
    const res = makeRes();
    mockFn(model.getUserByUsername, new Error('DB error'));
    controller.checkUsernameExists(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 409 when username is taken', () => {
    const req = { body: { username: 'alice', email: 'a@b.com', password: 'secret1' } };
    const res = makeRes();
    mockFn(model.getUserByUsername, null, [{ id: 1 }]);
    controller.checkUsernameExists(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('calls next when username is free', () => {
    const req = { body: { username: 'alice', email: 'a@b.com', password: 'secret1' } };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.getUserByUsername, null, []);
    controller.checkUsernameExists(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ── checkEmailExists ─────────────────────────────────────────────────────────

describe('checkEmailExists', () => {
  it('returns 500 on DB error', () => {
    const req = { body: { email: 'a@b.com' } };
    const res = makeRes();
    mockFn(model.getUserByEmail, new Error('DB error'));
    controller.checkEmailExists(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 409 when email is taken', () => {
    const req = { body: { email: 'a@b.com' } };
    const res = makeRes();
    mockFn(model.getUserByEmail, null, [{ id: 1 }]);
    controller.checkEmailExists(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('calls next when email is free', () => {
    const req = { body: { email: 'a@b.com' } };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.getUserByEmail, null, []);
    controller.checkEmailExists(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ── register ─────────────────────────────────────────────────────────────────

describe('register', () => {
  it('returns 500 on DB error', () => {
    const req = { body: { username: 'alice', email: 'a@b.com' } };
    const res = makeRes({ hash: 'hashed' });
    mockFn(model.createUser, new Error('DB error'));
    controller.register(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('sets locals and calls next on success', () => {
    const req = { body: { username: 'alice', email: 'a@b.com' } };
    const res = makeRes({ hash: 'hashed' });
    const next = jest.fn();
    mockFn(model.createUser, null, [{ id: 7, username: 'alice', isStaff: false }]);
    controller.register(req, res, next);
    expect(res.locals.userId).toBe(7);
    expect(res.locals.username).toBe('alice');
    expect(next).toHaveBeenCalled();
  });
});

// ── login ────────────────────────────────────────────────────────────────────

describe('login', () => {
  it('returns 400 when username or password is missing', () => {
    const req = { body: { username: 'alice' } };
    const res = makeRes();
    controller.login(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on DB error', () => {
    const req = { body: { username: 'alice', password: 'pass' } };
    const res = makeRes();
    mockFn(model.getUserByUsername, new Error('DB error'));
    controller.login(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 404 when user is not found', () => {
    const req = { body: { username: 'alice', password: 'pass' } };
    const res = makeRes();
    mockFn(model.getUserByUsername, null, []);
    controller.login(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('sets locals and calls next on success', () => {
    const req = { body: { username: 'alice', password: 'pass', rememberMe: true } };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.getUserByUsername, null, [
      { id: 7, username: 'alice', password: 'hash', isStaff: false },
    ]);
    controller.login(req, res, next);
    expect(res.locals.userId).toBe(7);
    expect(res.locals.rememberMe).toBe(true);
    expect(next).toHaveBeenCalled();
  });

  it('defaults rememberMe to false when not provided', () => {
    const req = { body: { username: 'alice', password: 'pass' } };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.getUserByUsername, null, [
      { id: 7, username: 'alice', password: 'hash', isStaff: false },
    ]);
    controller.login(req, res, next);
    expect(res.locals.rememberMe).toBe(false);
  });
});

// ── getSettings ──────────────────────────────────────────────────────────────

describe('getSettings', () => {
  it('returns 500 on DB error', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getUserSettings, new Error('DB error'));
    controller.getSettings({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 404 when user not found', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getUserSettings, null, []);
    controller.getSettings({}, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 200 with user settings', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getUserSettings, null, [{ theme: 'dark', currency: 'USD' }]);
    controller.getSettings({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ theme: 'dark', currency: 'USD' });
  });
});

// ── updateSettings ───────────────────────────────────────────────────────────

describe('updateSettings', () => {
  it('returns 500 on DB error', () => {
    const req = { body: { currency: 'SGD' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateUserSettings, new Error('DB error'));
    controller.updateSettings(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 200 with updated settings', () => {
    const req = { body: { theme: 'noir', currency: 'SGD', fontSize: 'lg' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateUserSettings, null, [{ theme: 'noir', currency: 'SGD', font_size: 'lg' }]);
    controller.updateSettings(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('defaults currency to USD when not provided', () => {
    const req = { body: {} };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateUserSettings, null, [{ theme: null, currency: 'USD', font_size: null }]);
    controller.updateSettings(req, res);
    expect(model.updateUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
      expect.any(Function),
    );
  });
});

// ── updateDisplayName ────────────────────────────────────────────────────────

describe('updateDisplayName', () => {
  it('returns 500 on DB error', () => {
    const req = { body: { displayName: 'Alice' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateDisplayName, new Error('DB error'));
    controller.updateDisplayName(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 200 on success', () => {
    const req = { body: { displayName: 'Alice' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateDisplayName, null, []);
    controller.updateDisplayName(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── updateProfileImage ───────────────────────────────────────────────────────

describe('updateProfileImage', () => {
  it('returns 400 when imageBase64 is missing', () => {
    const req = { body: {} };
    const res = makeRes({ userId: 1 });
    controller.updateProfileImage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on DB error', () => {
    const req = { body: { imageBase64: 'data:image/png;base64,abc123' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateProfileImage, new Error('DB error'));
    controller.updateProfileImage(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 200 with profile_image on success', () => {
    const req = { body: { imageBase64: 'data:image/png;base64,abc123' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateProfileImage, null, [{ profile_image: 'abc123' }]);
    controller.updateProfileImage(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ profile_image: 'abc123' }));
  });
});

// ── updateNotifications ──────────────────────────────────────────────────────

describe('updateNotifications', () => {
  it('returns 500 on DB error', () => {
    const req = { body: {} };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateNotifications, new Error('DB error'));
    controller.updateNotifications(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 200 on success', () => {
    const req = { body: { notifyOrders: false, notifyPromotions: true } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateNotifications, null, []);
    controller.updateNotifications(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('defaults notifyOrders to true and notifyPromotions to false', () => {
    const req = { body: {} };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateNotifications, null, []);
    controller.updateNotifications(req, res);
    expect(model.updateNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ notifyOrders: true, notifyPromotions: false }),
      expect.any(Function),
    );
  });
});

// ── deleteAccount ────────────────────────────────────────────────────────────

describe('deleteAccount', () => {
  it('returns 500 on DB error', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.deleteUser, new Error('DB error'));
    controller.deleteAccount({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('clears cookie and returns 200 on success', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.deleteUser, null, []);
    controller.deleteAccount({}, res);
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── getPasswordHash ──────────────────────────────────────────────────────────

describe('getPasswordHash', () => {
  it('returns 400 when passwords are missing', () => {
    const req = { body: {} };
    const res = makeRes({ userId: 1 });
    controller.getPasswordHash(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when new password is too short', () => {
    const req = { body: { currentPassword: 'old', newPassword: '123' } };
    const res = makeRes({ userId: 1 });
    controller.getPasswordHash(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on DB error', () => {
    const req = { body: { currentPassword: 'old', newPassword: 'newpass1' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.getUserPasswordById, new Error('DB error'));
    controller.getPasswordHash(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 404 when user not found', () => {
    const req = { body: { currentPassword: 'old', newPassword: 'newpass1' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.getUserPasswordById, null, []);
    controller.getPasswordHash(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('sets res.locals.hash and calls next on success', () => {
    const req = { body: { currentPassword: 'old', newPassword: 'newpass1' } };
    const res = makeRes({ userId: 1 });
    const next = jest.fn();
    mockFn(model.getUserPasswordById, null, [{ password: 'hashed_old' }]);
    controller.getPasswordHash(req, res, next);
    expect(res.locals.hash).toBe('hashed_old');
    expect(next).toHaveBeenCalled();
  });
});

// ── updatePassword ───────────────────────────────────────────────────────────

describe('updatePassword', () => {
  it('returns 500 on DB error', () => {
    const res = makeRes({ userId: 1, hash: 'newHash' });
    mockFn(model.updateUserPassword, new Error('DB error'));
    controller.updatePassword({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 200 on success', () => {
    const res = makeRes({ userId: 1, hash: 'newHash' });
    mockFn(model.updateUserPassword, null, []);
    controller.updatePassword({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── sendRegistered ───────────────────────────────────────────────────────────

describe('sendRegistered', () => {
  it('returns 201', () => {
    const res = makeRes();
    controller.sendRegistered({}, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

// ── logout ───────────────────────────────────────────────────────────────────

describe('logout', () => {
  it('clears cookie and returns 200 when no refresh token', () => {
    const req = { cookies: {} };
    const res = makeRes();
    controller.logout(req, res);
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('deletes token and returns 200 on success', () => {
    const req = { cookies: { refreshToken: 'tok' } };
    const res = makeRes();
    model.deleteRefreshToken.mockImplementation((_data, cb) => cb(null));
    controller.logout(req, res);
    expect(model.deleteRefreshToken).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('still returns 200 on DB error during logout', () => {
    const req = { cookies: { refreshToken: 'tok' } };
    const res = makeRes();
    model.deleteRefreshToken.mockImplementation((_data, cb) => cb(new Error('DB error')));
    controller.logout(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── getCurrentUser ───────────────────────────────────────────────────────────

describe('getCurrentUser', () => {
  it('returns 500 on DB error', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getUserById, new Error('DB error'));
    controller.getCurrentUser({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 404 when user not found', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getUserById, null, []);
    controller.getCurrentUser({}, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 200 with user data', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.getUserById, null, [{ id: 1, username: 'alice' }]);
    controller.getCurrentUser({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ id: 1, username: 'alice' });
  });
});

// ── checkUsernameExists extra ────────────────────────────────────────────────

describe('checkUsernameExists - extra cases', () => {
  it('returns 400 when password is exactly 5 characters (boundary)', () => {
    const req = { body: { username: 'alice', email: 'a@b.com', password: '12345' } };
    const res = makeRes();
    controller.checkUsernameExists(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('calls the model when password is exactly 6 characters (boundary)', () => {
    const req = { body: { username: 'alice', email: 'a@b.com', password: '123456' } };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.getUserByUsername, null, []);
    controller.checkUsernameExists(req, res, next);
    expect(model.getUserByUsername).toHaveBeenCalled();
  });

  it('returns 400 when only email is missing', () => {
    const req = { body: { username: 'alice', password: 'secret1' } };
    const res = makeRes();
    controller.checkUsernameExists(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when only username is missing', () => {
    const req = { body: { email: 'a@b.com', password: 'secret1' } };
    const res = makeRes();
    controller.checkUsernameExists(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ── checkEmailExists extra ───────────────────────────────────────────────────

describe('checkEmailExists - extra cases', () => {
  it('passes email from req.body to the model', () => {
    const req = { body: { email: 'test@example.com' } };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.getUserByEmail, null, []);
    controller.checkEmailExists(req, res, next);
    expect(model.getUserByEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' }),
      expect.any(Function),
    );
  });
});

// ── register extra ───────────────────────────────────────────────────────────

describe('register - extra cases', () => {
  it('sets res.locals.isStaff from the DB result', () => {
    const req = { body: { username: 'alice', email: 'a@b.com' } };
    const res = makeRes({ hash: 'hashed' });
    const next = jest.fn();
    mockFn(model.createUser, null, [{ id: 7, username: 'alice', isStaff: true }]);
    controller.register(req, res, next);
    expect(res.locals.isStaff).toBe(true);
  });

  it('sets res.locals.message with success text', () => {
    const req = { body: { username: 'bob', email: 'b@b.com' } };
    const res = makeRes({ hash: 'hashed' });
    const next = jest.fn();
    mockFn(model.createUser, null, [{ id: 8, username: 'bob', isStaff: false }]);
    controller.register(req, res, next);
    expect(res.locals.message).toContain('bob');
  });

  it('passes hash from res.locals to the model as password', () => {
    const req = { body: { username: 'alice', email: 'a@b.com' } };
    const res = makeRes({ hash: 'hashedPassword' });
    const next = jest.fn();
    mockFn(model.createUser, null, [{ id: 7, username: 'alice', isStaff: false }]);
    controller.register(req, res, next);
    expect(model.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'hashedPassword' }),
      expect.any(Function),
    );
  });
});

// ── login extra ──────────────────────────────────────────────────────────────

describe('login - extra cases', () => {
  it('returns 400 when only password is missing', () => {
    const req = { body: { username: 'alice' } };
    const res = makeRes();
    controller.login(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('sets res.locals.hash from the DB result on success', () => {
    const req = { body: { username: 'alice', password: 'pass' } };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.getUserByUsername, null, [
      { id: 7, username: 'alice', password: 'hashed_pw', isStaff: false },
    ]);
    controller.login(req, res, next);
    expect(res.locals.hash).toBe('hashed_pw');
  });

  it('sets res.locals.isStaff from the DB result on success', () => {
    const req = { body: { username: 'alice', password: 'pass' } };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.getUserByUsername, null, [
      { id: 7, username: 'alice', password: 'hash', isStaff: true },
    ]);
    controller.login(req, res, next);
    expect(res.locals.isStaff).toBe(true);
  });

  it('calls the model with username from the request body', () => {
    const req = { body: { username: 'charlie', password: 'pass' } };
    const res = makeRes();
    mockFn(model.getUserByUsername, null, []);
    controller.login(req, res, jest.fn());
    expect(model.getUserByUsername).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'charlie' }),
      expect.any(Function),
    );
  });
});

// ── getSettings extra ────────────────────────────────────────────────────────

describe('getSettings - extra cases', () => {
  it('passes userId from res.locals to the model', () => {
    const res = makeRes({ userId: 42 });
    mockFn(model.getUserSettings, null, [{ theme: 'dark' }]);
    controller.getSettings({}, res);
    expect(model.getUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42 }),
      expect.any(Function),
    );
  });
});

// ── updateSettings extra ─────────────────────────────────────────────────────

describe('updateSettings - extra cases', () => {
  it('passes null theme to model when theme is not provided', () => {
    const req = { body: { currency: 'SGD' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateUserSettings, null, [{}]);
    controller.updateSettings(req, res);
    expect(model.updateUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({ theme: null }),
      expect.any(Function),
    );
  });

  it('passes explicit theme value to model', () => {
    const req = { body: { theme: 'noir', currency: 'USD' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateUserSettings, null, [{}]);
    controller.updateSettings(req, res);
    expect(model.updateUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'noir' }),
      expect.any(Function),
    );
  });

  it('passes fontSize to model', () => {
    const req = { body: { fontSize: 'lg' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateUserSettings, null, [{}]);
    controller.updateSettings(req, res);
    expect(model.updateUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 'lg' }),
      expect.any(Function),
    );
  });

  it('passes null fontSize when not provided', () => {
    const req = { body: {} };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateUserSettings, null, [{}]);
    controller.updateSettings(req, res);
    expect(model.updateUserSettings).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: null }),
      expect.any(Function),
    );
  });
});

// ── updateDisplayName extra ──────────────────────────────────────────────────

describe('updateDisplayName - extra cases', () => {
  it('passes displayName to the model', () => {
    const req = { body: { displayName: 'Alice Wonder' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateDisplayName, null, []);
    controller.updateDisplayName(req, res);
    expect(model.updateDisplayName).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Alice Wonder' }),
      expect.any(Function),
    );
  });

  it('returns json with message "Display name updated."', () => {
    const req = { body: { displayName: 'Alice' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateDisplayName, null, []);
    controller.updateDisplayName(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Display name updated.' });
  });

  it('passes null displayName when field is missing', () => {
    const req = { body: {} };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateDisplayName, null, []);
    controller.updateDisplayName(req, res);
    expect(model.updateDisplayName).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: null }),
      expect.any(Function),
    );
  });
});

// ── updateProfileImage extra ─────────────────────────────────────────────────

describe('updateProfileImage - extra cases', () => {
  it('returns 400 when imageBase64 is an empty string', () => {
    const req = { body: { imageBase64: '' } };
    const res = makeRes({ userId: 1 });
    controller.updateProfileImage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('strips the data URI prefix before creating imageBuffer', () => {
    const req = { body: { imageBase64: 'data:image/png;base64,abc123' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateProfileImage, null, [{ profile_image: 'abc123' }]);
    controller.updateProfileImage(req, res);
    const [data] = model.updateProfileImage.mock.calls[0];
    expect(data.imageBuffer).toEqual(Buffer.from('abc123', 'base64'));
  });

  it('returns json with message "Profile image updated successfully."', () => {
    const req = { body: { imageBase64: 'data:image/png;base64,abc123' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateProfileImage, null, [{ profile_image: 'abc123' }]);
    controller.updateProfileImage(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Profile image updated successfully.' }),
    );
  });
});

// ── updateNotifications extra ────────────────────────────────────────────────

describe('updateNotifications - extra cases', () => {
  it('passes notifyOrders=false when explicitly set to false', () => {
    const req = { body: { notifyOrders: false } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateNotifications, null, []);
    controller.updateNotifications(req, res);
    expect(model.updateNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ notifyOrders: false }),
      expect.any(Function),
    );
  });

  it('passes notifyPromotions=true when explicitly set to true', () => {
    const req = { body: { notifyPromotions: true } };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateNotifications, null, []);
    controller.updateNotifications(req, res);
    expect(model.updateNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ notifyPromotions: true }),
      expect.any(Function),
    );
  });

  it('returns json with message "Notification preferences updated."', () => {
    const req = { body: {} };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateNotifications, null, []);
    controller.updateNotifications(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Notification preferences updated.' });
  });

  it('notifyOrders is true when req.body.notifyOrders is undefined', () => {
    const req = { body: {} };
    const res = makeRes({ userId: 1 });
    mockFn(model.updateNotifications, null, []);
    controller.updateNotifications(req, res);
    expect(model.updateNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ notifyOrders: true }),
      expect.any(Function),
    );
  });
});

// ── deleteAccount extra ──────────────────────────────────────────────────────

describe('deleteAccount - extra cases', () => {
  it('returns json with message "Account deleted."', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.deleteUser, null, []);
    controller.deleteAccount({}, res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Account deleted.' });
  });

  it('clears the refreshToken cookie on success', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.deleteUser, null, []);
    controller.deleteAccount({}, res);
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
  });
});

// ── getPasswordHash extra ────────────────────────────────────────────────────

describe('getPasswordHash - extra cases', () => {
  it('returns 400 when newPassword is exactly 5 characters (boundary)', () => {
    const req = { body: { currentPassword: 'old', newPassword: '12345' } };
    const res = makeRes({ userId: 1 });
    controller.getPasswordHash(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('calls the model when newPassword is exactly 6 characters (boundary)', () => {
    const req = { body: { currentPassword: 'old', newPassword: '123456' } };
    const res = makeRes({ userId: 1 });
    const next = jest.fn();
    mockFn(model.getUserPasswordById, null, [{ password: 'hash' }]);
    controller.getPasswordHash(req, res, next);
    expect(model.getUserPasswordById).toHaveBeenCalled();
  });
});

// ── updatePassword extra ─────────────────────────────────────────────────────

describe('updatePassword - extra cases', () => {
  it('returns json with message "Password updated successfully."', () => {
    const res = makeRes({ userId: 1, hash: 'newHash' });
    mockFn(model.updateUserPassword, null, []);
    controller.updatePassword({}, res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Password updated successfully.' });
  });

  it('passes hash from res.locals to the model', () => {
    const res = makeRes({ userId: 1, hash: 'myNewHash' });
    mockFn(model.updateUserPassword, null, []);
    controller.updatePassword({}, res);
    expect(model.updateUserPassword).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'myNewHash' }),
      expect.any(Function),
    );
  });
});

// ── sendRegistered extra ─────────────────────────────────────────────────────

describe('sendRegistered - extra cases', () => {
  it('returns json with a message string', () => {
    const res = makeRes();
    controller.sendRegistered({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});

// ── logout extra ─────────────────────────────────────────────────────────────

describe('logout - extra cases', () => {
  it('clears the refreshToken cookie by name', () => {
    const req = { cookies: {} };
    const res = makeRes();
    controller.logout(req, res);
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
  });

  it('returns json with message "Logged out."', () => {
    const req = { cookies: {} };
    const res = makeRes();
    controller.logout(req, res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out.' });
  });

  it('clears the cookie even when deleteRefreshToken fails', () => {
    const req = { cookies: { refreshToken: 'tok' } };
    const res = makeRes();
    model.deleteRefreshToken.mockImplementation((_data, cb) => cb(new Error('DB error')));
    controller.logout(req, res);
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ── getPublicProfile ──────────────────────────────────────────────────────────

describe('getPublicProfile', () => {
  it('returns 500 on DB error', () => {
    const req = { params: { userId: '5' } };
    const res = makeRes();
    mockFn(model.getPublicProfile, new Error('DB error'));
    controller.getPublicProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 404 when user not found', () => {
    const req = { params: { userId: '999' } };
    const res = makeRes();
    mockFn(model.getPublicProfile, null, []);
    controller.getPublicProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 200 with the public profile on success', () => {
    const req = { params: { userId: '5' } };
    const res = makeRes();
    const profile = { id: 5, username: 'alice', listing_count: 3 };
    mockFn(model.getPublicProfile, null, [profile]);
    controller.getPublicProfile(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(profile);
  });

  it('passes userId from req.params to the model', () => {
    const req = { params: { userId: '42' } };
    const res = makeRes();
    mockFn(model.getPublicProfile, null, [{ id: 42 }]);
    controller.getPublicProfile(req, res);
    expect(model.getPublicProfile).toHaveBeenCalledWith(
      expect.objectContaining({ userId: '42' }),
      expect.any(Function),
    );
  });
});

// ── clearProfileImage ─────────────────────────────────────────────────────────

describe('clearProfileImage', () => {
  it('returns 500 on DB error', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.clearProfileImage, new Error('DB error'));
    controller.clearProfileImage({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 200 on success', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.clearProfileImage, null, []);
    controller.clearProfileImage({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns json with message "Profile image removed."', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.clearProfileImage, null, []);
    controller.clearProfileImage({}, res);
    expect(res.json).toHaveBeenCalledWith({ message: 'Profile image removed.' });
  });

  it('passes userId from res.locals to the model', () => {
    const res = makeRes({ userId: 42 });
    mockFn(model.clearProfileImage, null, []);
    controller.clearProfileImage({}, res);
    expect(model.clearProfileImage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42 }),
      expect.any(Function),
    );
  });

  it('model is called exactly once per request', () => {
    jest.clearAllMocks();
    const res = makeRes({ userId: 1 });
    mockFn(model.clearProfileImage, null, []);
    controller.clearProfileImage({}, res);
    expect(model.clearProfileImage).toHaveBeenCalledTimes(1);
  });

  it('500 json response contains a message string', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.clearProfileImage, new Error('DB error'));
    controller.clearProfileImage({}, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });
});

describe('clearProfileImage - extra cases', () => {
  it('does not call res.status(400) on success', () => {
    const res = makeRes({ userId: 1 });
    mockFn(model.clearProfileImage, null, []);
    controller.clearProfileImage({}, res);
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it('works for different user ids', () => {
    for (const uid of [1, 5, 99, 100]) {
      const res = makeRes({ userId: uid });
      mockFn(model.clearProfileImage, null, []);
      controller.clearProfileImage({}, res);
      expect(model.clearProfileImage).toHaveBeenCalledWith(
        expect.objectContaining({ id: uid }),
        expect.any(Function),
      );
      jest.clearAllMocks();
    }
  });

  it('does not need req.body (body is ignored)', () => {
    const req = { body: { someField: 'value' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.clearProfileImage, null, []);
    controller.clearProfileImage(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not need req.params (params are ignored)', () => {
    const req = { params: { userId: '99' } };
    const res = makeRes({ userId: 1 });
    mockFn(model.clearProfileImage, null, []);
    controller.clearProfileImage(req, res);
    expect(model.clearProfileImage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      expect.any(Function),
    );
  });
});

// ── getSellerReviews ──────────────────────────────────────────────────────────

describe('getSellerReviews', () => {
  it('returns 500 on DB error', () => {
    const req = { params: { userId: '5' } };
    const res = makeRes();
    mockFn(model.getSellerReviews, new Error('DB error'));
    controller.getSellerReviews(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 200 with reviews array on success', () => {
    const req = { params: { userId: '5' } };
    const res = makeRes();
    const reviews = [{ id: 1, rating: 4, comment: 'Great', listing_title: 'Watch' }];
    mockFn(model.getSellerReviews, null, reviews);
    controller.getSellerReviews(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(reviews);
  });

  it('returns 200 with empty array when seller has no reviews', () => {
    const req = { params: { userId: '5' } };
    const res = makeRes();
    mockFn(model.getSellerReviews, null, []);
    controller.getSellerReviews(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('passes userId from req.params to the model', () => {
    const req = { params: { userId: '99' } };
    const res = makeRes();
    mockFn(model.getSellerReviews, null, []);
    controller.getSellerReviews(req, res);
    expect(model.getSellerReviews).toHaveBeenCalledWith(
      expect.objectContaining({ userId: '99' }),
      expect.any(Function),
    );
  });

  it('returns the exact rows array from the model', () => {
    const req = { params: { userId: '5' } };
    const res = makeRes();
    const reviews = [{ id: 1 }, { id: 2 }];
    mockFn(model.getSellerReviews, null, reviews);
    controller.getSellerReviews(req, res);
    expect(res.json).toHaveBeenCalledWith(reviews);
  });
});
