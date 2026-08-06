const express = require('express');
const router = express.Router();

const orderController = require('../controllers/order.controller');
const jwtMiddleware = require('../middleware/jwtMiddleware');

// Order routes require a logged-in user.

// Create a new checkout order — reservations are verified before the order is written.
router.post(
  '/',
  jwtMiddleware.verifyToken,
  orderController.verifyListingReservations,
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

// Read one logged-in user's order with tracking details.
router.get(
  '/:id',
  jwtMiddleware.verifyToken,
  orderController.getOrderById,
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
