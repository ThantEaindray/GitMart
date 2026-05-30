const orderModel = require('../models/orderModel');

const allowedStatuses = ['Pending', 'Processing', 'Delivered', 'Cancelled'];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+65\s\d{4}\s\d{4}$/;
const postalCodePattern = /^[0-9]{6}$/;
const unitNumberPattern = /^#\d{2}-\d{2,4}$/;

module.exports.createOrder = (req, res, next) => {
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

  orderModel
    .createOrder({
      ...orderData,
      userId: res.locals.userId,
    })
    .then((order) => {
      res.locals.statusCode = 201;
      res.locals.results = order;
      next();
    })
    .catch(next);
};

module.exports.getAllOrders = (req, res, next) => {
  orderModel
    .getAllOrders(res.locals.userId)
    .then((orders) => {
      res.locals.statusCode = 200;
      res.locals.results = orders;
      next();
    })
    .catch(next);
};

module.exports.updateOrderStatus = (req, res, next) => {
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

  orderModel
    .updateOrderStatus(req.params.id, status, res.locals.userId)
    .then((order) => {
      if (!order) {
        return res.status(404).json({
          message: 'Order not found.',
        });
      }

      res.locals.statusCode = 200;
      res.locals.results = order;
      return next();
    })
    .catch(next);
};

module.exports.sendResponse = (req, res) => {
  return res.status(res.locals.statusCode).json(res.locals.results);
};
