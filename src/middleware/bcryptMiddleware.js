// Import Modules
const bcrypt = require('bcrypt');

// Get pepper from .env.dev loaded by npm script
const pepper = process.env.BCRYPT_PEPPER;
// Set Salt Rounds (Encryption Layers)
const saltRounds = 10;

// Compare Password
// Used during Login to verify Password
// 1 Raw Password (from req.body) + 1 Hashed Password (from DB) should be used.
module.exports.comparePassword = (req, res, next) => {
  if (!pepper) {
    console.error('BCRYPT_PEPPER is missing.');
    return res.status(500).json({
      message: 'Server configuration error.'
    });
  }

  if (!res.locals.hash) {
    console.error('Password hash is missing before bcrypt compare.');
    return res.status(500).json({
      message: 'Password hash missing during login.'
    });
  }

  const callback = (err, isMatch) => {
    if (err) {
      console.error('Error bcrypt:', err);
      return res.status(500).json({
        message: 'Password comparison failed.'
      });
    }

    if (!isMatch) {
      return res.status(401).json({
        message: 'Wrong password',
      });
    }

    next();
  };

  bcrypt.compare(req.body.password + pepper, res.locals.hash, callback);
};

// Hash (Encrypt) Password
// Used during Register to encrypt Password
// Make sure this encrypted password is stored in DB instead of raw.
module.exports.hashPassword = (req, res, next) => {
  if (!pepper) {
    console.error('BCRYPT_PEPPER is missing.');
    return res.status(500).json({
      message: 'Server configuration error.'
    });
  }

  const callback = (err, hash) => {
    if (err) {
      console.error('Error bcrypt:', err);
      return res.status(500).json({
        message: 'Password hashing failed.'
      });
    }

    res.locals.hash = hash;
    next();
  };

  bcrypt.hash(req.body.password + pepper, saltRounds, callback);
};
