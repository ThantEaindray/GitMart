// orderStore.js
// In-memory order store. No SQL — lives in utils, not models.

const { markPurchasedItemsSold } = require('./purchaseState');

const orders = [];

module.exports.createOrder = async (data) => {
  const newOrder = {
    id: orders.length + 1,
    ...data,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };
  orders.push(newOrder);
  markPurchasedItemsSold(data.items);
  return newOrder;
};

module.exports.getAllOrders = async (userId) => {
  return orders.filter((order) => String(order.userId) === String(userId));
};

module.exports.updateOrderStatus = async (id, status, userId) => {
  const order = orders.find(
    (item) => item.id === Number(id) && String(item.userId) === String(userId),
  );
  if (!order) return null;
  order.status = status;
  return order;
};
