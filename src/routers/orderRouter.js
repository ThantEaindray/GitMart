const express = require('express');
const router = express.Router();

const orderController = require('../controllers/order.controller');
const jwtMiddleware = require('../middleware/jwtMiddleware');

// Order routes require a logged-in user.

// Create a new checkout order.
router.post(
  '/',
  jwtMiddleware.verifyToken,
  orderController.createOrder,
  orderController.sendResponse,
);

// Read the logged-in user's orders.
router.get(
  '/',
  jwtMiddleware.verifyToken,
  orderController.getAllOrders,
  orderController.sendResponse,
);

// Update one order's status.
router.put(
  '/:id',
  jwtMiddleware.verifyToken,
  orderController.updateOrderStatus,
  orderController.sendResponse,
);

module.exports = router;