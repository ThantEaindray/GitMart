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
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('6') }));
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
    mockFn(model.getUserByUsername, null, [{ id: 7, username: 'alice', password: 'hash', isStaff: false }]);
    controller.login(req, res, next);
    expect(res.locals.userId).toBe(7);
    expect(res.locals.rememberMe).toBe(true);
    expect(next).toHaveBeenCalled();
  });

  it('defaults rememberMe to false when not provided', () => {
    const req = { body: { username: 'alice', password: 'pass' } };
    const res = makeRes();
    const next = jest.fn();
    mockFn(model.getUserByUsername, null, [{ id: 7, username: 'alice', password: 'hash', isStaff: false }]);
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
