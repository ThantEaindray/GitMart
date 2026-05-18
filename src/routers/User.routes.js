const express = require('express');

const router = express.Router();

const {
  registerUser,
  loginUser,
  getCurrentUser,
  verifyToken,
} = require('../controllers/User.controller');

// Register new marketplace user
// Full route: POST /api/register
router.post('/register', registerUser);

// Login existing marketplace user
// Full route: POST /api/login
router.post('/login', loginUser);

// Get current logged-in user
// Full route: GET /api/me
router.get('/me', verifyToken, getCurrentUser);

module.exports = router;
