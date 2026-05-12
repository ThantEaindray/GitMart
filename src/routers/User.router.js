
const express = require('express');
const router = express.Router();

const userController = require('../controllers/User.controller');
const jwtMiddleware = require('../middleware/jwtMiddleware');
const bcryptMiddleware = require('../middleware/bcryptMiddleware');

// ==============================
// USER AUTH ROUTES
// ==============================

// Register New User
router.post('/register',
    userController.checkUsernameOrEmailExist,
    bcryptMiddleware.hashPassword,
    userController.register,
    jwtMiddleware.generateToken,
    jwtMiddleware.sendToken
);

// Login Existing User
router.post('/login',
    userController.login,
    bcryptMiddleware.comparePassword,
    jwtMiddleware.generateToken,
    jwtMiddleware.sendToken
);

// Get Current Logged-In User
router.get('/me',
    jwtMiddleware.verifyToken,
    userController.getCurrentUser
);

module.exports = router;
