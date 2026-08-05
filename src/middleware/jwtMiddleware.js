require('dotenv').config();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const model = require('../models/User.model');

const accessSecret = process.env.JWT_SECRET_KEY;
const refreshSecret = process.env.JWT_REFRESH_SECRET;
const accessTTL = process.env.JWT_ACCESS_TTL || '15m';
const refreshRemember = process.env.JWT_REFRESH_REMEMBER_TTL || '7d';
const refreshNoRemember = process.env.JWT_REFRESH_NO_REMEMBER_TTL || '1d';
const algorithm = process.env.JWT_ALGORITHM || 'HS256';

// ── Access token ───────────────────────────────────────────────────────────

module.exports.generateToken = (req, res, next) => {
  const payload = { userId: res.locals.userId, timestamp: new Date() };
  const options = { algorithm, expiresIn: accessTTL };

  jwt.sign(payload, accessSecret, options, (err, token) => {
    if (err) return res.status(500).json(err);
    res.locals.token = token;
    next();
  });
};

module.exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  // EventSource cannot send custom headers, so accept token via query param as fallback
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.query.token || null;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, accessSecret, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    res.locals.userId = decoded.user_id ?? decoded.userId ?? decoded.id ?? decoded.sub;
    res.locals.tokenTimestamp = decoded.timestamp;
    next();
  });
};

module.exports.sendToken = (req, res) => {
  return res.status(200).json({
    message: res.locals.message || 'Login successful.',
    token: res.locals.token,
    userId: res.locals.userId,
    username: res.locals.username,
    isStaff: res.locals.isStaff,
  });
};

// ── Refresh token ──────────────────────────────────────────────────────────

module.exports.generateRefreshToken = (req, res, next) => {
  const rememberMe = res.locals.rememberMe || false;
  const ttlString = rememberMe ? refreshRemember : refreshNoRemember;
<<<<<<< HEAD
  const payload = { userId: res.locals.userId, rememberMe };
=======
  // jti makes every issued token unique. Without it the payload is just
  // { userId, rememberMe } plus iat/exp, and those have one-second resolution —
  // so two refreshes within the same second produced byte-identical tokens.
  // Rotation then replaced a token with itself, and the reuse detection in
  // verifyRefreshToken below could never fire because the "old" token still
  // matched the stored row.
  const payload = { userId: res.locals.userId, rememberMe, jti: crypto.randomUUID() };
>>>>>>> 436c33a987150538f166522fbe928301c9327498
  const options = { algorithm, expiresIn: ttlString };

  jwt.sign(payload, refreshSecret, options, (err, token) => {
    if (err) return res.status(500).json(err);

    // Work out expiry as a Date for storing in DB
    const msMap = { d: 86400000, h: 3600000, m: 60000 };
    const match = ttlString.match(/^(\d+)([dhm])$/);
    const expiresAt = match
      ? new Date(Date.now() + parseInt(match[1]) * msMap[match[2]])
      : new Date(Date.now() + 86400000);

    const data = { userId: res.locals.userId, token, expiresAt };

    model.saveRefreshToken(data, (error) => {
      if (error) return res.status(500).json({ message: 'Internal server error' });

      // rememberMe = true → persistent cookie (survives browser close)
      // rememberMe = false → session cookie (cleared when browser closes)
      const cookieOptions = { httpOnly: true, sameSite: 'Strict' };
      if (rememberMe) cookieOptions.maxAge = expiresAt.getTime() - Date.now();

      res.cookie('refreshToken', token, cookieOptions);
      next();
    });
  });
};

module.exports.verifyRefreshToken = (req, res, next) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  jwt.verify(token, refreshSecret, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid refresh token' });

    // Check token exists in DB (not yet revoked)
    model.getRefreshToken({ token }, (dbErr, result) => {
      if (dbErr) return res.status(500).json({ message: 'Internal server error' });
      if (result.rows.length === 0) {
        // Token was already rotated or revoked — possible theft. Nuke all
        // sessions for this user, and respond only once that has actually
        // happened, rather than firing it and responding immediately: the
        // previous fire-and-forget version returned 401 "Session invalidated"
        // before the deletion query had necessarily completed, so a request
        // racing right behind this one could still find a live row.
        return model.deleteAllRefreshTokensForUser({ userId: decoded.userId }, (deleteErr) => {
          if (deleteErr) return res.status(500).json({ message: 'Internal server error' });
          return res.status(401).json({ error: 'Session invalidated. Please log in again.' });
        });
      }

      const row = result.rows[0];
      if (new Date(row.expires_at) < new Date()) {
        return res.status(401).json({ error: 'Refresh token expired' });
      }

      res.locals.userId = decoded.userId;
      res.locals.rememberMe = decoded.rememberMe || false;
      res.locals.refreshToken = token;
      next();
    });
  });
};

// Optional auth — sets res.locals.userId if a valid token is present, null otherwise
module.exports.optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.locals.userId = null;
    return next();
  }
  const token = authHeader.substring(7);
  jwt.verify(token, accessSecret, (err, decoded) => {
    res.locals.userId = err
      ? null
      : (decoded.userId ?? decoded.user_id ?? decoded.id ?? decoded.sub);
    next();
  });
};

// Rotate: delete the old refresh token and issue a fresh one1
module.exports.rotateRefreshToken = (req, res, next) => {
  model.deleteRefreshToken({ token: res.locals.refreshToken }, (err) => {
    if (err) return res.status(500).json({ message: 'Internal server error' });
    next();
  });
};
