function loadOrderModel() {
  jest.resetModules();
  return require('../../src/models/orderModel');
}

function buildOrderData(overrides = {}) {
  return {
    userId: 7,
    fullName: 'Melissa Reese Halida',
    items: [{ id: 101, name: 'Vintage Luxury Bag', price: 480, quantity: 1 }],
    totalAmount: 533.19,
    ...overrides,
  };
}

describe('orderModel status history', () => {
  test('creates new checkout orders with Pending status and initial history', async () => {
    const orderModel = loadOrderModel();

    const order = await orderModel.createOrder(buildOrderData());

    expect(order.status).toBe('Pending');
    expect(order.statusHistory).toHaveLength(1);
    expect(order.statusHistory[0]).toEqual(
      expect.objectContaining({
        status: 'Pending',
        note: 'Order was created after checkout.',
      }),
    );
    expect(order.statusHistory[0].createdAt).toEqual(expect.any(String));
  });

  test('appends a timestamped history entry when status is updated', async () => {
    const orderModel = loadOrderModel();
    const order = await orderModel.createOrder(buildOrderData());

    const updatedOrder = await orderModel.updateOrderStatus(order.id, 'Processing', 7);

    expect(updatedOrder.status).toBe('Processing');
    expect(updatedOrder.statusHistory).toHaveLength(2);
    expect(updatedOrder.statusHistory[1]).toEqual(
      expect.objectContaining({
        status: 'Processing',
        note: 'Order status changed to Processing.',
      }),
    );
    expect(updatedOrder.statusHistory[1].createdAt).toEqual(expect.any(String));
  });

  test('returns only orders that belong to the logged-in user', async () => {
    const orderModel = loadOrderModel();
    await orderModel.createOrder(buildOrderData({ userId: 7 }));
    await orderModel.createOrder(buildOrderData({ userId: 8 }));

    const userOrders = await orderModel.getAllOrders(7);

    expect(userOrders).toHaveLength(1);
    expect(userOrders[0].userId).toBe(7);
  });

  test('does not update an order owned by another user', async () => {
    const orderModel = loadOrderModel();
    const order = await orderModel.createOrder(buildOrderData({ userId: 7 }));

    const updatedOrder = await orderModel.updateOrderStatus(order.id, 'Cancelled', 8);
    const originalOrder = await orderModel.getOrderById(order.id, 7);

    expect(updatedOrder).toBeNull();
    expect(originalOrder.status).toBe('Pending');
    expect(originalOrder.statusHistory).toHaveLength(1);
  });
});
