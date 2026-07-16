const model = require('../models/orderModel');

// Status values for the first version of order tracking.
// Later commits can build a timeline from the same trusted list.
const ORDER_STATUSES = Object.freeze({
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
});

const allowedStatuses = Object.values(ORDER_STATUSES);

function isAllowedOrderStatus(status) {
  return allowedStatuses.includes(status);
}

// Checkout field formats that must match the frontend validation.
const checkoutPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+65\s\d{4}\s\d{4}$/,
  postalCode: /^[0-9]{6}$/,
  unitNumber: /^#\d{2}-\d{2,4}$/,
};

// POST /api/orders
module.exports.createOrder = (req, res, next) => {
  const data = {
    ...req.body,
    userId: res.locals.userId,
  };

  if (
    !data.fullName ||
    !data.emailAddress ||
    !data.phoneNumber ||
    !data.address ||
    !data.unitNumber ||
    !data.postalCode ||
    !data.deliveryMethod ||
    !data.paymentMethod
  ) {
    return res.status(400).json({ message: 'Required checkout order details are missing.' });
  }

  if (!checkoutPatterns.email.test(data.emailAddress)) {
    return res.status(400).json({ message: 'Invalid email address format.' });
  }

  if (!checkoutPatterns.phone.test(data.phoneNumber)) {
    return res.status(400).json({ message: 'Use this phone format: +65 9086 2744.' });
  }

  if (!checkoutPatterns.postalCode.test(data.postalCode)) {
    return res.status(400).json({ message: 'Postal code must be exactly 6 digits.' });
  }

  if (!checkoutPatterns.unitNumber.test(data.unitNumber)) {
    return res.status(400).json({ message: 'Use this unit number format: #12-345.' });
  }

  model
    .createOrder(data)
    .then((order) => {
      res.locals.statusCode = 201;
      res.locals.results = order;
      next();
    })
    .catch(next);
};

// GET /api/orders
module.exports.getAllOrders = (req, res, next) => {
  model
    .getAllOrders(res.locals.userId)
    .then((orders) => {
      res.locals.statusCode = 200;
      res.locals.results = orders;
      next();
    })
    .catch(next);
};

// PUT /api/orders/:id
module.exports.updateOrderStatus = (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Order status is required.' });
  }

  if (!isAllowedOrderStatus(status)) {
    return res.status(400).json({ message: 'Invalid order status.' });
  }

  model
    .updateOrderStatus(req.params.id, status, res.locals.userId)
    .then((order) => {
      if (!order) {
        return res.status(404).json({ message: 'Order not found.' });
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
