// orderStore.js
// In-memory order store. No SQL — lives in utils, not models.

const { markPurchasedItemsSold } = require('./purchaseState');

const orders = [];

function createStatusHistoryEntry(status, note) {
  return { status, note, createdAt: new Date().toISOString() };
}

module.exports.createOrder = async (data) => {
  const initialStatus = 'Pending';
  const newOrder = {
    id: orders.length + 1,
    ...data,
    status: initialStatus,
    statusHistory: [createStatusHistoryEntry(initialStatus, 'Order was created after checkout.')],
    createdAt: new Date().toISOString(),
  };
  orders.push(newOrder);
  markPurchasedItemsSold(data.items);
  return newOrder;
};

module.exports.getAllOrders = async (userId) => {
  return orders.filter((order) => String(order.userId) === String(userId));
};

// Unfiltered by buyer, unlike every other read here — orders carry no
// seller/owner column at all, so finding "orders that include one of my
// listings" has to start from every order and filter by listing ownership
// (a Postgres concern) on the caller's side, not this store's.
module.exports.getAllOrdersRaw = async () => {
  return [...orders];
};

module.exports.getOrderById = async (id, userId) => {
  const order = orders.find(
    (item) => item.id === Number(id) && String(item.userId) === String(userId),
  );
  return order || null;
};

module.exports.updateOrderStatus = async (id, status, userId) => {
  const order = orders.find(
    (item) => item.id === Number(id) && String(item.userId) === String(userId),
  );
  if (!order) return null;
  order.status = status;
  order.statusHistory = order.statusHistory || [];
  order.statusHistory.push(createStatusHistoryEntry(status, `Order status changed to ${status}.`));
  return order;
};
