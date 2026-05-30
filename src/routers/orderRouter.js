const express = require('express');
const router = express.Router();

const orderController = require('../controllers/order.controller');
const jwtMiddleware = require('../middleware/jwtMiddleware');

// ==============================
// ORDER ROUTES
// ==============================

// Create Order
router.post('/', jwtMiddleware.verifyToken, orderController.createOrder, orderController.sendResponse);

// Read All Orders
router.get('/', jwtMiddleware.verifyToken, orderController.getAllOrders, orderController.sendResponse);

// Update Order Status
router.put('/:id', jwtMiddleware.verifyToken, orderController.updateOrderStatus, orderController.sendResponse);

module.exports = router;
