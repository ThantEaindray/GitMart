const express = require('express');
const router = express.Router();

const userController = require('../controllers/User.controller');
const jwtMiddleware = require('../middleware/jwtMiddleware');
const bcryptMiddleware = require('../middleware/bcryptMiddleware');

// ==============================
// USER AUTH ROUTES
// ==============================

// Register New User — redirects to login, so no token is issued here
router.post(
  '/register',
  userController.checkUsernameExists,
  userController.checkEmailExists,
  bcryptMiddleware.hashPassword,
  userController.register,
  userController.sendRegistered,
);

// Login Existing User
router.post('/login',
  userController.login,
  bcryptMiddleware.comparePassword,
  jwtMiddleware.generateToken,
  jwtMiddleware.sendToken
);

// Get Current Logged-In User
router.get('/me', jwtMiddleware.verifyToken, userController.getCurrentUser);

// User Preferences
router.get('/me/settings', jwtMiddleware.verifyToken, userController.getSettings);
router.put('/me/settings', jwtMiddleware.verifyToken, userController.updateSettings);

// Refresh Token — issue a new access token using the httpOnly refresh cookie
router.post(
  '/refresh',
  jwtMiddleware.verifyRefreshToken,
  jwtMiddleware.rotateRefreshToken,
  jwtMiddleware.generateRefreshToken,
  jwtMiddleware.generateToken,
  jwtMiddleware.sendToken,
);

// Update Display Name
router.put('/me/profile', jwtMiddleware.verifyToken, userController.updateDisplayName);

// Update Notification Preferences
router.put('/me/notifications', jwtMiddleware.verifyToken, userController.updateNotifications);

// Delete Account
router.delete('/me', jwtMiddleware.verifyToken, userController.deleteAccount);

// Change Password
router.put(
  '/me/password',
  jwtMiddleware.verifyToken,
  userController.getPasswordHash,
  bcryptMiddleware.compareCurrentPassword,
  bcryptMiddleware.hashNewPassword,
  userController.updatePassword,
);

// Logout — revoke refresh token from DB and clear cookie
router.post('/logout', userController.logout);

module.exports = router;
