const orders = [];

module.exports.createOrder = function createOrder(orderData) {
  const newOrder = {
    id: orders.length + 1,
    ...orderData,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };

  orders.push(newOrder);
  return Promise.resolve(newOrder);
};

module.exports.getAllOrders = function getAllOrders() {
  return Promise.resolve(orders);
};