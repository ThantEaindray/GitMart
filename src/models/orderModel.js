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

module.exports.updateOrderStatus = function updateOrderStatus(id, status) {
  const order = orders.find((item) => item.id === Number(id));

  if (!order) {
    return Promise.resolve(null);
  }

  order.status = status;
  return Promise.resolve(order);
};