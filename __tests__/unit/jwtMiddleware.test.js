// jwtMiddleware.js reads JWT_REFRESH_SECRET at module load time (via a bare
// require('dotenv').config(), which no-ops here since no plain .env file
// exists on disk), so this has to be set before requiring the module.
process.env.JWT_REFRESH_SECRET = 'unit-test-refresh-secret';

jest.mock('jsonwebtoken');
jest.mock('../../src/models/User.model');

const jwt = require('jsonwebtoken');
const model = require('../../src/models/User.model');
const jwtMiddleware = require('../../src/middleware/jwtMiddleware');

afterAll(() => jest.restoreAllMocks());

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: {},
  };
}

function makeReq(token) {
  return { cookies: token === undefined ? {} : { refreshToken: token } };
}

const DECODED = { userId: 42, rememberMe: false };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('verifyRefreshToken', () => {
  test('returns 401 with no cookie, never reaching jwt.verify', () => {
    const res = makeRes();

    jwtMiddleware.verifyRefreshToken(makeReq(undefined), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No refresh token' });
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  test('returns 401 for a token that fails verification', () => {
    jwt.verify.mockImplementation((_token, _secret, cb) => cb(new Error('bad signature')));
    const res = makeRes();

    jwtMiddleware.verifyRefreshToken(makeReq('some-token'), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid refresh token' });
  });

  test('returns 500 when the token lookup itself fails', () => {
    jwt.verify.mockImplementation((_token, _secret, cb) => cb(null, DECODED));
    model.getRefreshToken.mockImplementation((_data, cb) => cb(new Error('connection lost')));
    const res = makeRes();

    jwtMiddleware.verifyRefreshToken(makeReq('some-token'), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(model.deleteAllRefreshTokensForUser).not.toHaveBeenCalled();
  });

  // ── Reuse detection — the branch under review ──────────────────────────

  describe('when the token is not found (already rotated or revoked)', () => {
    beforeEach(() => {
      jwt.verify.mockImplementation((_token, _secret, cb) => cb(null, DECODED));
      model.getRefreshToken.mockImplementation((_data, cb) => cb(null, { rows: [] }));
    });

    test('does not respond until the revoking delete completes', () => {
      // The bug this replaces fired deleteAllRefreshTokensForUser with a
      // no-op callback and responded immediately regardless — so on that
      // version, res.status would already have been called at this point.
      // Never invoking the mock's callback here simulates a delete still in
      // flight, and is the direct proof the fix is now waiting on it.
      model.deleteAllRefreshTokensForUser.mockImplementation(() => {});
      const res = makeRes();

      jwtMiddleware.verifyRefreshToken(makeReq('stale-token'), res, jest.fn());

      expect(model.deleteAllRefreshTokensForUser).toHaveBeenCalledWith(
        { userId: DECODED.userId },
        expect.any(Function),
      );
      expect(res.status).not.toHaveBeenCalled();
    });

    test('responds 401 once the delete succeeds', () => {
      model.deleteAllRefreshTokensForUser.mockImplementation((_data, cb) => cb(null));
      const res = makeRes();

      jwtMiddleware.verifyRefreshToken(makeReq('stale-token'), res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Session invalidated. Please log in again.',
      });
    });

    test('responds 500 rather than a false-positive 401 when the delete itself fails', () => {
      // Silently reporting every session invalidated when the revocation may
      // not have actually happened would be worse than a generic 500.
      model.deleteAllRefreshTokensForUser.mockImplementation((_data, cb) =>
        cb(new Error('connection lost')),
      );
      const res = makeRes();

      jwtMiddleware.verifyRefreshToken(makeReq('stale-token'), res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    });
  });

  test('returns 401 for a token that has expired', () => {
    jwt.verify.mockImplementation((_token, _secret, cb) => cb(null, DECODED));
    model.getRefreshToken.mockImplementation((_data, cb) =>
      cb(null, { rows: [{ expires_at: new Date(Date.now() - 1000).toISOString() }] }),
    );
    const res = makeRes();

    jwtMiddleware.verifyRefreshToken(makeReq('expired-token'), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Refresh token expired' });
  });

  test('calls next() and sets res.locals for a valid, unexpired token', () => {
    jwt.verify.mockImplementation((_token, _secret, cb) => cb(null, DECODED));
    model.getRefreshToken.mockImplementation((_data, cb) =>
      cb(null, { rows: [{ expires_at: new Date(Date.now() + 1000000).toISOString() }] }),
    );
    const res = makeRes();
    const next = jest.fn();

    jwtMiddleware.verifyRefreshToken(makeReq('valid-token'), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.locals.userId).toBe(DECODED.userId);
    expect(res.locals.refreshToken).toBe('valid-token');
    expect(res.status).not.toHaveBeenCalled();
  });
});
