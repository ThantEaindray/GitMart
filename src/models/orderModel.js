const { markPurchasedItemsSold } = require('./purchaseState');

// Demo in-memory order storage.
const orders = [];

function createStatusHistoryEntry(status) {
  return {
    status,
    note: `Order status changed to ${status}.`,
    createdAt: new Date().toISOString(),
  };
}

// Create an order and mark one-off listings as sold.
module.exports.createOrder = function createOrder(orderData) {
  const initialStatus = 'Pending';
  const newOrder = {
    id: orders.length + 1,
    ...orderData,
    status: initialStatus,
    statusHistory: [
      {
        ...createStatusHistoryEntry(initialStatus),
        note: 'Order was created after checkout.',
      },
    ],
    createdAt: new Date().toISOString(),
  };

  orders.push(newOrder);
  markPurchasedItemsSold(orderData.items);
  return Promise.resolve(newOrder);
};

// Return only orders for the logged-in user.
module.exports.getAllOrders = function getAllOrders(userId) {
  return Promise.resolve(orders.filter((order) => String(order.userId) === String(userId)));
};

// Return one order only when it belongs to the logged-in user.
module.exports.getOrderById = function getOrderById(id, userId) {
  const order = orders.find(
    (item) => item.id === Number(id) && String(item.userId) === String(userId),
  );

  return Promise.resolve(order || null);
};

// Update one order if it belongs to the logged-in user.
module.exports.updateOrderStatus = function updateOrderStatus(id, status, userId) {
  const order = orders.find(
    (item) => item.id === Number(id) && String(item.userId) === String(userId),
  );

  if (!order) {
    return Promise.resolve(null);
  }

  order.status = status;
  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push(createStatusHistoryEntry(status));
  return Promise.resolve(order);
};
