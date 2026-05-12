// Import Modules
require("dotenv").config();
const jwt = require("jsonwebtoken");

// Import Parameters from .env
const secretKey = process.env.JWT_SECRET_KEY;
const rememberDuration = process.env.JWT_REMEMBER_TTL;
const noRememberDuration = process.env.JWT_NO_REMEMBER_TTL;
const tokenAlgorithm = process.env.JWT_ALGORITHM;

// Generate Token 
// Use in Register & Login Routes, generates token with provided userId
module.exports.generateToken = (req, res, next) => {
  const payload = {
    userId: res.locals.userId,
    timestamp: new Date()
  };

  const options = {
    algorithm: tokenAlgorithm,
    expiresIn: res.locals.rememberMe ? rememberDuration : noRememberDuration,
  };

  const callback = (err, token) => {
    if (err) {
      console.error("Error jwt:", err);
      res.status(500).json(err);
    } else {
      res.locals.token = token;
      next();
    }
  };

  const token = jwt.sign(payload, secretKey, options, callback);
};

// Send Token
// Sends generated token to frontend to store for future use
module.exports.sendToken = (req, res) => {
  return res.status(200).json({
    message: res.locals.message || "Login successful.",
    token: res.locals.token,
  });
};


// Verify Token 
// Used at the start of most routes to get secure userId
module.exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const callback = (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Invalid token" });
    }

    res.locals.userId = decoded.user_id ?? decoded.userId ?? decoded.id ?? decoded.sub
    res.locals.tokenTimestamp = decoded.timestamp;

    next();
  };

  jwt.verify(token, secretKey, callback);
};