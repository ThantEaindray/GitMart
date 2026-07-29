// orderStore.js
// In-memory order store. No SQL — lives in utils, not models.

const { markPurchasedItemsSold } = require('./purchaseState');

const orders = [];

module.exports.createOrder = (data, callback) => {
  const newOrder = {
    id: orders.length + 1,
    ...data,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };
  orders.push(newOrder);
  markPurchasedItemsSold({ items: data.items });
  callback(null, newOrder);
};

module.exports.getAllOrders = (data, callback) => {
  const userOrders = orders.filter((order) => String(order.userId) === String(data.userId));
  callback(null, userOrders);
};

module.exports.updateOrderStatus = (data, callback) => {
  const order = orders.find(
    (item) => item.id === Number(data.id) && String(item.userId) === String(data.userId),
  );
  if (!order) return callback(null, null);
  order.status = data.status;
  callback(null, order);
};
