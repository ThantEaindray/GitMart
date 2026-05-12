// Import Modules
const bcrypt = require("bcrypt");
require('dotenv').config();
//import Parameters from .env
const pepper= process.env.BCRYPT_PEPPER;
// Set Salt Rounds (Encryption Layers)
const saltRounds = 10;

// Compare Password
// Used during Login to verify Password
// 1 Raw Password (from req.body) + 1 Hashed Password (from DB) should be used. 
module.exports.comparePassword = (req, res, next) => {
  const callback = (err, isMatch) => {
    if (err) {
      console.error("Error bcrypt:", err);
      res.status(500).json(err);
    } else {
      if (isMatch) {
        next();
      } else {
        res.status(401).json({
          message: "Wrong password",
        });
      }
    }
  };
  bcrypt.compare(req.body.password + pepper, res.locals.hash, callback);
};

// Hash (Encrypt) Password
// Used during Register to encrypt Password
// Make sure this encrypted password is stored in DB instead of raw.
module.exports.hashPassword = (req, res, next) => {
  const callback = (err, hash) => {
    if (err) {
      console.error("Error bcrypt:", err);
      res.status(500).json(err);
    } else {
      res.locals.hash = hash;
      next();
    }
  };

  bcrypt.hash(req.body.password + pepper, saltRounds, callback);
};