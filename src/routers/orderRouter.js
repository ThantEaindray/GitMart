const express = require('express');

const router = express.Router();
const { createOrder, getAllOrders, updateOrderStatus } = require('../models/orderModel');

// Allowed order statuses for status updates
const allowedStatuses = ['Pending', 'Processing', 'Delivered', 'Cancelled'];

// Backend validation patterns
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+65\s\d{4}\s\d{4}$/;
const postalCodePattern = /^[0-9]{6}$/;
const unitNumberPattern = /^#\d{2}-\d{2,4}$/;

router.post('/', (req, res, next) => {
  const orderData = req.body;

  if (
    !orderData.fullName ||
    !orderData.emailAddress ||
    !orderData.phoneNumber ||
    !orderData.address ||
    !orderData.unitNumber ||
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
      message: 'Use this phone format: +65 9086 2744.',
    });
  }

  if (!postalCodePattern.test(orderData.postalCode)) {
    return res.status(400).json({
      message: 'Postal code must be exactly 6 digits.',
    });
  }

  if (!unitNumberPattern.test(orderData.unitNumber)) {
    return res.status(400).json({
      message: 'Use this unit number format: #12-345.',
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
