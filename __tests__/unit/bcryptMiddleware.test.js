// Set pepper before the middleware module loads so it reads the env var correctly
process.env.BCRYPT_PEPPER = 'test-pepper';

const bcrypt = require('bcrypt');
jest.mock('bcrypt');

const middleware = require('../../src/middleware/bcryptMiddleware');

afterEach(() => jest.clearAllMocks());
afterAll(() => jest.restoreAllMocks());

function makeRes(locals = {}) {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    locals: { ...locals },
  };
}

// ── comparePassword ───────────────────────────────────────────────────────────

describe('comparePassword', () => {
  it('returns 500 when res.locals.hash is missing', () => {
    const req = { body: { password: 'mypass' } };
    const res = makeRes();
    middleware.comparePassword(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 500 on bcrypt.compare error', () => {
    const req = { body: { password: 'mypass' } };
    const res = makeRes({ hash: 'storedHash' });
    bcrypt.compare.mockImplementation((_p, _h, cb) => cb(new Error('bcrypt error')));
    middleware.comparePassword(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 401 when passwords do not match', () => {
    const req = { body: { password: 'wrongpass' } };
    const res = makeRes({ hash: 'storedHash' });
    bcrypt.compare.mockImplementation((_p, _h, cb) => cb(null, false));
    middleware.comparePassword(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('calls next when passwords match', () => {
    const req = { body: { password: 'correctpass' } };
    const res = makeRes({ hash: 'storedHash' });
    const next = jest.fn();
    bcrypt.compare.mockImplementation((_p, _h, cb) => cb(null, true));
    middleware.comparePassword(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls bcrypt.compare with password + pepper and the stored hash', () => {
    const req = { body: { password: 'mypass' } };
    const res = makeRes({ hash: 'storedHash' });
    bcrypt.compare.mockImplementation((_p, _h, cb) => cb(null, true));
    middleware.comparePassword(req, res, jest.fn());
    expect(bcrypt.compare).toHaveBeenCalledWith(
      'mypass' + 'test-pepper',
      'storedHash',
      expect.any(Function),
    );
  });

  it('401 response includes a message field', () => {
    const req = { body: { password: 'wrong' } };
    const res = makeRes({ hash: 'storedHash' });
    bcrypt.compare.mockImplementation((_p, _h, cb) => cb(null, false));
    middleware.comparePassword(req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});

// ── compareCurrentPassword ────────────────────────────────────────────────────

describe('compareCurrentPassword', () => {
  it('returns 500 on bcrypt.compare error', () => {
    const req = { body: { currentPassword: 'oldpass' } };
    const res = makeRes({ hash: 'storedHash' });
    bcrypt.compare.mockImplementation((_p, _h, cb) => cb(new Error('bcrypt error')));
    middleware.compareCurrentPassword(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 401 when current password does not match', () => {
    const req = { body: { currentPassword: 'wrongpass' } };
    const res = makeRes({ hash: 'storedHash' });
    bcrypt.compare.mockImplementation((_p, _h, cb) => cb(null, false));
    middleware.compareCurrentPassword(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('calls next when current password matches', () => {
    const req = { body: { currentPassword: 'correctpass' } };
    const res = makeRes({ hash: 'storedHash' });
    const next = jest.fn();
    bcrypt.compare.mockImplementation((_p, _h, cb) => cb(null, true));
    middleware.compareCurrentPassword(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls bcrypt.compare with currentPassword + pepper', () => {
    const req = { body: { currentPassword: 'currpass' } };
    const res = makeRes({ hash: 'storedHash' });
    bcrypt.compare.mockImplementation((_p, _h, cb) => cb(null, true));
    middleware.compareCurrentPassword(req, res, jest.fn());
    expect(bcrypt.compare).toHaveBeenCalledWith(
      'currpass' + 'test-pepper',
      'storedHash',
      expect.any(Function),
    );
  });
});

// ── hashNewPassword ───────────────────────────────────────────────────────────

describe('hashNewPassword', () => {
  it('returns 500 on bcrypt.hash error', () => {
    const req = { body: { newPassword: 'newpass' } };
    const res = makeRes();
    bcrypt.hash.mockImplementation((_p, _r, cb) => cb(new Error('hash error')));
    middleware.hashNewPassword(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('sets res.locals.hash and calls next on success', () => {
    const req = { body: { newPassword: 'newpass' } };
    const res = makeRes();
    const next = jest.fn();
    bcrypt.hash.mockImplementation((_p, _r, cb) => cb(null, 'hashed_new'));
    middleware.hashNewPassword(req, res, next);
    expect(res.locals.hash).toBe('hashed_new');
    expect(next).toHaveBeenCalled();
  });

  it('calls bcrypt.hash with newPassword + pepper and 10 salt rounds', () => {
    const req = { body: { newPassword: 'newpass' } };
    const res = makeRes();
    bcrypt.hash.mockImplementation((_p, _r, cb) => cb(null, 'hashed'));
    middleware.hashNewPassword(req, res, jest.fn());
    expect(bcrypt.hash).toHaveBeenCalledWith('newpass' + 'test-pepper', 10, expect.any(Function));
  });

  it('does not call res.status on success', () => {
    const req = { body: { newPassword: 'newpass' } };
    const res = makeRes();
    bcrypt.hash.mockImplementation((_p, _r, cb) => cb(null, 'hashed'));
    middleware.hashNewPassword(req, res, jest.fn());
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ── hashPassword ──────────────────────────────────────────────────────────────

describe('hashPassword', () => {
  it('returns 500 on bcrypt.hash error', () => {
    const req = { body: { password: 'mypass' } };
    const res = makeRes();
    bcrypt.hash.mockImplementation((_p, _r, cb) => cb(new Error('hash error')));
    middleware.hashPassword(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('sets res.locals.hash and calls next on success', () => {
    const req = { body: { password: 'mypass' } };
    const res = makeRes();
    const next = jest.fn();
    bcrypt.hash.mockImplementation((_p, _r, cb) => cb(null, 'hashed_pw'));
    middleware.hashPassword(req, res, next);
    expect(res.locals.hash).toBe('hashed_pw');
    expect(next).toHaveBeenCalled();
  });

  it('calls bcrypt.hash with password + pepper and 10 salt rounds', () => {
    const req = { body: { password: 'mypass' } };
    const res = makeRes();
    bcrypt.hash.mockImplementation((_p, _r, cb) => cb(null, 'hashed'));
    middleware.hashPassword(req, res, jest.fn());
    expect(bcrypt.hash).toHaveBeenCalledWith('mypass' + 'test-pepper', 10, expect.any(Function));
  });

  it('does not call res.status on success', () => {
    const req = { body: { password: 'mypass' } };
    const res = makeRes();
    bcrypt.hash.mockImplementation((_p, _r, cb) => cb(null, 'hashed'));
    middleware.hashPassword(req, res, jest.fn());
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ── missing pepper edge cases ─────────────────────────────────────────────────

describe('comparePassword and hashPassword - missing pepper', () => {
  let mwNoPepper;

  beforeAll(() => {
    const savedPepper = process.env.BCRYPT_PEPPER;
    delete process.env.BCRYPT_PEPPER;
    jest.isolateModules(() => {
      mwNoPepper = require('../../src/middleware/bcryptMiddleware');
    });
    process.env.BCRYPT_PEPPER = savedPepper;
  });

  it('comparePassword returns 500 when BCRYPT_PEPPER is not set', () => {
    const req = { body: { password: 'x' } };
    const res = makeRes({ hash: 'h' });
    mwNoPepper.comparePassword(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('hashPassword returns 500 when BCRYPT_PEPPER is not set', () => {
    const req = { body: { password: 'x' } };
    const res = makeRes();
    mwNoPepper.hashPassword(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
