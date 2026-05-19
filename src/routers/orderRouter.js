const express = require('express');

const router = express.Router();
const { createOrder, getAllOrders } = require('../models/orderModel');

router.post('/', (req, res, next) => {
  const orderData = req.body;

  if (!orderData.fullName || !orderData.emailAddress || !orderData.phoneNumber) {
    return res.status(400).json({
      message: 'Full name, email address and phone number are required.',
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

module.exports = router;