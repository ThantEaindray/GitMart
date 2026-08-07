// order.controller.js
const { promisify } = require('util');
const model = require('../utils/orderStore');
const reservationModel = require('../models/Reservation.model');
const listingModel = require('../models/Listing.model');
const { notify } = require('../utils/notifier');

const markListingSold = promisify(listingModel.markListingSold);
const getListingsByIds = promisify(listingModel.getListingsByIds);

// Status values for order tracking. The timeline (order.statusHistory) is
// built from this same trusted list.
const ORDER_STATUSES = Object.freeze({
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
});

const allowedStatuses = Object.values(ORDER_STATUSES);

// Allowed fulfilment flow for luxury order tracking.
const STATUS_TRANSITIONS = Object.freeze({
  [ORDER_STATUSES.PENDING]: [ORDER_STATUSES.PROCESSING, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.PROCESSING]: [ORDER_STATUSES.DELIVERED, ORDER_STATUSES.CANCELLED],
  [ORDER_STATUSES.DELIVERED]: [],
  [ORDER_STATUSES.CANCELLED]: [],
});

function isAllowedOrderStatus(status) {
  return allowedStatuses.includes(status);
}

function canTransitionOrderStatus(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return true;
  return (STATUS_TRANSITIONS[currentStatus] || []).includes(nextStatus);
}

// Field-format rules that must match the frontend checkout form.
const CHECKOUT_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+65\s\d{4}\s\d{4}$/,
  postalCode: /^[0-9]{6}$/,
  unitNumber: /^#\d{2}-\d{2,4}$/,
};

// ── POST /api/orders — step 1: verify reservations on one-off listings ────
// One-off listings can only be bought by the user whose reservation the owner
// accepted. Plain catalogue products carry no listingId and are skipped.

module.exports.verifyListingReservations = (req, res, next) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];

  const listingIds = items
    .filter((item) => item && item.listingId !== undefined && item.listingId !== null)
    .map((item) => Number(item.listingId))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (listingIds.length === 0) return next();

  const data = { requester_id: Number(res.locals.userId), listing_ids: listingIds };

  const callback = (error, result) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal server error' });
    }

    const allowed = new Set(result.rows.map((row) => Number(row.listing_id)));
    const blocked = listingIds.filter((id) => !allowed.has(id));

    if (blocked.length > 0) {
      return res.status(403).json({
        message:
          'You can only buy a listing after its owner accepts your reservation request. ' +
          `Blocked listing IDs: ${blocked.join(', ')}.`,
      });
    }

    next();
  };

  reservationModel.getAcceptedListingIdsForUser(data, callback);
};

// Same item-shape parsing as purchaseState.js's getPurchasedIds — mirrored
// rather than imported since that one also collects catalogue productIds,
// which this doesn't need.
function extractOneOffListingIds(items) {
  const ids = new Set();
  // items = [] as a default param wouldn't cover this — items is sent as
  // explicit null (not omitted) when the cart is empty, same case
  // purchaseState.js's getPurchasedIds guards against.
  (items || []).forEach((item) => {
    const isOneOff = Boolean(item?.isOneOff || item?.listingId);
    const listingId = item?.listingId ?? (isOneOff ? item?.id : null);
    if (listingId != null) ids.add(Number(listingId));
  });
  return Array.from(ids);
}

// ── POST /api/orders — step 2: validate details and create ────────────────

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

    // verifyListingReservations (above) already guarantees every listingId
    // here belongs to a RESERVED listing this buyer holds the ACCEPTED
    // reservation for — this is the one path that can move a listing from
    // RESERVED to SOLD; the owner can't do it manually (listingLifecycle.js
    // leaves SOLD out of RESERVED's owner-transition table).
    const soldListingIds = extractOneOffListingIds(data.items);
    await Promise.all(soldListingIds.map((listingId) => markListingSold(listingId)));

    if (soldListingIds.length > 0) {
      const soldListings = await getListingsByIds({ ids: soldListingIds });
      const titlesByOwner = new Map();
      soldListings.rows.forEach((row) => {
        if (!titlesByOwner.has(row.owner_id)) titlesByOwner.set(row.owner_id, []);
        titlesByOwner.get(row.owner_id).push(row.title);
      });
      titlesByOwner.forEach((titles, ownerId) => {
        const summary =
          titles.length === 1 ? `"${titles[0]}"` : `${titles.length} of your listings`;
        notify(ownerId, 'order', 'You made a sale', `Order #${order.id} includes ${summary}.`);
      });
    }

    notify(
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

// ── GET /api/orders/sales ──────────────────────────────────────────────────
// Orders carry no seller/owner column - a "sale" is derived by checking
// every order's one-off items against which listings the caller owns.

function extractSaleItems(order, ownedListingIds) {
  return (order.items || [])
    .filter((item) => {
      const isOneOff = Boolean(item?.isOneOff || item?.listingId);
      const listingId = item?.listingId ?? (isOneOff ? item?.id : null);
      return listingId != null && ownedListingIds.has(Number(listingId));
    })
    .map((item) => ({
      listingId: Number(item.listingId ?? item.id),
      itemName: item.name || item.title || 'Item',
      quantity: Number(item.quantity || item.qty || 1),
      price: Number(item.price || item.unitPrice || 0),
    }));
}

module.exports.getSellerSales = async (req, res, next) => {
  try {
    const allOrders = await model.getAllOrdersRaw();

    const candidateListingIds = new Set();
    allOrders.forEach((order) => {
      extractOneOffListingIds(order.items).forEach((id) => candidateListingIds.add(id));
    });

    let ownedListingIds = new Set();
    if (candidateListingIds.size > 0) {
      const result = await getListingsByIds({ ids: Array.from(candidateListingIds) });
      ownedListingIds = new Set(
        result.rows
          .filter((row) => String(row.owner_id) === String(res.locals.userId))
          .map((row) => Number(row.id)),
      );
    }

    const sales = allOrders
      .map((order) => {
        const items = extractSaleItems(order, ownedListingIds);
        if (items.length === 0) return null;
        return {
          orderId: order.id,
          status: order.status,
          createdAt: order.createdAt,
          buyerName: order.fullName || 'Buyer',
          items,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.locals.statusCode = 200;
    res.locals.results = sales;
    next();
  } catch (error) {
    next(error);
  }
};

// GET /api/orders/:id
module.exports.getOrderById = async (req, res, next) => {
  try {
    const order = await model.getOrderById(req.params.id, res.locals.userId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    res.locals.statusCode = 200;
    res.locals.results = order;
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
  if (!isAllowedOrderStatus(status)) {
    return res.status(400).json({ message: 'Invalid order status.' });
  }

  try {
    const order = await model.getOrderById(req.params.id, res.locals.userId);
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    if (!canTransitionOrderStatus(order.status, status)) {
      return res.status(400).json({
        message: `Order status cannot change from ${order.status} to ${status}.`,
      });
    }

    let updatedOrder = order;
    if (order.status !== status) {
      updatedOrder = await model.updateOrderStatus(req.params.id, status, res.locals.userId);

      notify(
        res.locals.userId,
        'order_status',
        'Order ' + status.toLowerCase(),
        'Order #' + updatedOrder.id + ' status updated to ' + status + '.',
      );
    }

    res.locals.statusCode = 200;
    res.locals.results = updatedOrder;
    next();
  } catch (error) {
    next(error);
  }
};

// ── Send response (final middleware in order routes) ──────────────────────

module.exports.sendResponse = (req, res) => {
  return res.status(res.locals.statusCode).json(res.locals.results);
};

module.exports._test = {
  ORDER_STATUSES,
  canTransitionOrderStatus,
  isAllowedOrderStatus,
};
