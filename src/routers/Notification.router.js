const express = require('express');
const router = express.Router();
const controller = require('../controllers/Notification.controller');
const jwtMiddleware = require('../middleware/jwtMiddleware');

// SSE stream (must be before /:id routes)
router.get('/stream', jwtMiddleware.verifyToken, controller.stream);

// Unread count (for badge polling fallback)
router.get('/unread-count', jwtMiddleware.verifyToken, controller.getUnreadCount);

// All notifications for the logged-in user
router.get('/', jwtMiddleware.verifyToken, controller.getAll);

// Mark all read
router.patch('/read-all', jwtMiddleware.verifyToken, controller.markAllRead);

// Mark single notification read
router.patch('/:id/read', jwtMiddleware.verifyToken, controller.markRead);

module.exports = router;
