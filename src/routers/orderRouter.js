const express = require('express');

const router = express.Router();
const { createOrder, getAllOrders, updateOrderStatus } = require('../models/orderModel');

// Allowed order statuses for status updates
const allowedStatuses = ['Pending', 'Processing', 'Delivered', 'Cancelled'];

// Backend validation patterns
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9]+$/;

router.post('/', (req, res, next) => {
  const orderData = req.body;

  if (
    !orderData.fullName ||
    !orderData.emailAddress ||
    !orderData.phoneNumber ||
    !orderData.address ||
    !orderData.postalCode ||
    !orderData.deliveryMethod ||
    !orderData.paymentMethod
  ) {
    return res.status(400).json({
      message: 'Required checkout order details are missing.',
    });
  }

  if (!emailPattern.test(orderData.emailAddress)) {
    return res.status(400).json({
      message: 'Invalid email address format.',
    });
  }

  if (!phonePattern.test(orderData.phoneNumber)) {
    return res.status(400).json({
      message: 'Phone number must contain numbers only.',
    });
  }

  createOrder(orderData)
    .then((order) => res.status(201).json(order))
    .catch(next);
});

router.get('/', (req, res, next) => {
  getAllOrders()
    .then((orders) => res.status(200).json(orders))
    .catch(next);
});

router.put('/:id', (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      message: 'Order status is required.',
    });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      message: 'Invalid order status.',
    });
  }

  updateOrderStatus(req.params.id, status)
    .then((order) => {
      if (!order) {
        return res.status(404).json({
          message: 'Order not found.',
        });
      }

      return res.status(200).json(order);
    })
    .catch(next);
});

module.exports = router;