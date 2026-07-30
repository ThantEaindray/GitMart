// order.controller.js
const model = require('../utils/orderStore');
const notifModel = require('../utils/notificationStore');
const sseManager = require('../utils/sseManager');

// Valid status values for order updates.
const ALLOWED_STATUSES = ['Pending', 'Processing', 'Delivered', 'Cancelled'];

// Field-format rules that must match the frontend checkout form.
const CHECKOUT_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+65\s\d{4}\s\d{4}$/,
  postalCode: /^[0-9]{6}$/,
  unitNumber: /^#\d{2}-\d{2,4}$/,
};

// ── Notification helper ───────────────────────────────────────────────────
// Called after order mutations to push a real-time badge update via SSE.
// notifModel callbacks are synchronous (in-memory), so no nesting is needed.

function pushOrderNotification(userId, type, title, message) {
  const n = notifModel.create({ userId, type, title, message });
  const count = notifModel.getUnreadCount({ userId });
  sseManager.send(userId, 'notification', n);
  sseManager.send(userId, 'badge', { unreadCount: count });
}

// ── POST /api/orders ──────────────────────────────────────────────────────

module.exports.createOrder = async (req, res, next) => {
  const data = { ...req.body, userId: res.locals.userId };

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

  if (!CHECKOUT_PATTERNS.email.test(data.emailAddress)) {
    return res.status(400).json({ message: 'Invalid email address format.' });
  }
  if (!CHECKOUT_PATTERNS.phone.test(data.phoneNumber)) {
    return res.status(400).json({ message: 'Use this phone format: +65 9086 2744.' });
  }
  if (!CHECKOUT_PATTERNS.postalCode.test(data.postalCode)) {
    return res.status(400).json({ message: 'Postal code must be exactly 6 digits.' });
  }
  if (!CHECKOUT_PATTERNS.unitNumber.test(data.unitNumber)) {
    return res.status(400).json({ message: 'Use this unit number format: #12-345.' });
  }

  try {
    const order = await model.createOrder(data);
    pushOrderNotification(
      data.userId,
      'order',
      'Order placed',
      'Your order #' + order.id + ' has been placed and is pending confirmation.',
    );
    res.locals.statusCode = 201;
    res.locals.results = order;
    next();
  } catch (error) {
    next(error);
  }
};

// ── GET /api/orders ───────────────────────────────────────────────────────

module.exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await model.getAllOrders(res.locals.userId);
    res.locals.statusCode = 200;
    res.locals.results = orders;
    next();
  } catch (error) {
    next(error);
  }
};

// ── PUT /api/orders/:id ───────────────────────────────────────────────────

module.exports.updateOrderStatus = async (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Order status is required.' });
  }
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Invalid order status.' });
  }

  try {
    const order = await model.updateOrderStatus(req.params.id, status, res.locals.userId);
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    pushOrderNotification(
      res.locals.userId,
      'order_status',
      'Order ' + status.toLowerCase(),
      'Order #' + order.id + ' status updated to ' + status + '.',
    );

    res.locals.statusCode = 200;
    res.locals.results = order;
    next();
  } catch (error) {
    next(error);
  }
};

// ── Send response (final middleware in order routes) ──────────────────────

module.exports.sendResponse = (req, res) => {
  return res.status(res.locals.statusCode).json(res.locals.results);
};
