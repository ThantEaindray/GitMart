const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const {
  getUserByUsername,
  getUserByEmail,
  createUser,
  getUserById
} = require('../models/User.model');

const JWT_SECRET = process.env.JWT_SECRET || 'marketplace_secret_key';
const SALT_ROUNDS = 10;

// ===============================
// Middleware: Verify JWT token
// ===============================
module.exports.verifyToken = function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Missing or invalid authorization token.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired token.'
    });
  }
};

// ===============================
// POST /api/register
// Register new marketplace user
// ===============================
module.exports.registerUser = function registerUser(req, res, next) {
  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({
      message: 'Username, email and password are required.'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: 'Password must be at least 6 characters long.'
    });
  }

  getUserByUsername(username)
    .then((existingUsername) => {
      if (existingUsername) {
        return res.status(409).json({
          message: 'Username already exists.'
        });
      }

      return getUserByEmail(email);
    })
    .then((existingEmail) => {
      if (res.headersSent) return null;

      if (existingEmail) {
        return res.status(409).json({
          message: 'Email already exists.'
        });
      }

      return bcrypt.hash(password, SALT_ROUNDS);
    })
    .then((hashedPassword) => {
      if (res.headersSent || !hashedPassword) return null;

      return createUser(username, email, hashedPassword);
    })
    .then((newUser) => {
      if (res.headersSent || !newUser) return;

      const token = jwt.sign(
        {
          userId: newUser.id,
          username: newUser.username,
          isStaff: newUser.isStaff
        },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      return res.status(200).json({
        message: 'User registered successfully.',
        token,
        userId: newUser.id,
        username: newUser.username,
        isStaff: newUser.isStaff
      });
    })
    .catch(next);
};

// ===============================
// POST /api/login
// Login existing marketplace user
// ===============================
module.exports.loginUser = function loginUser(req, res, next) {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      message: 'Username and password are required.'
    });
  }

  let foundUser;

  getUserByUsername(username)
    .then((user) => {
      if (!user) {
        return res.status(401).json({
          message: 'Invalid username or password.'
        });
      }

      foundUser = user;
      return bcrypt.compare(password, user.password);
    })
    .then((isMatch) => {
      if (res.headersSent) return;

      if (!isMatch) {
        return res.status(401).json({
          message: 'Invalid username or password.'
        });
      }

      const token = jwt.sign(
        {
          userId: foundUser.id,
          username: foundUser.username,
          isStaff: foundUser.isStaff
        },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      return res.status(200).json({
        message: 'Login successful.',
        token,
        userId: foundUser.id,
        username: foundUser.username,
        isStaff: foundUser.isStaff
      });
    })
    .catch(next);
};

// ===============================
// GET /api/me
// Get current logged-in user
// ===============================
module.exports.getCurrentUser = function getCurrentUser(req, res, next) {
  getUserById(req.user.userId)
    .then((user) => {
      if (!user) {
        return res.status(404).json({
          message: 'User not found.'
        });
      }

      return res.status(200).json(user);
    })
    .catch(next);
};