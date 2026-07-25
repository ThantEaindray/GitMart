jest.mock('../../src/models/orderModel', () => ({
  getOrderById: jest.fn(),
  updateOrderStatus: jest.fn(),
}));

const model = require('../../src/models/orderModel');
const orderController = require('../../src/controllers/order.controller');

function createResponse(userId = 7) {
  return {
    locals: { userId },
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

function createRequest(status, id = '1') {
  return {
    params: { id },
    body: status ? { status } : {},
  };
}

describe('order.controller updateOrderStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 when status is missing', () => {
    const req = createRequest(null);
    const res = createResponse();
    const next = jest.fn();

    orderController.updateOrderStatus(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Order status is required.' });
    expect(model.getOrderById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 400 when status is not supported', () => {
    const req = createRequest('Refunded');
    const res = createResponse();
    const next = jest.fn();

    orderController.updateOrderStatus(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid order status.' });
    expect(model.getOrderById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 404 when order cannot be found for the logged-in user', async () => {
    model.getOrderById.mockResolvedValue(null);
    const req = createRequest('Processing', '99');
    const res = createResponse(7);
    const next = jest.fn();

    orderController.updateOrderStatus(req, res, next);
    await Promise.resolve();

    expect(model.getOrderById).toHaveBeenCalledWith('99', 7);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Order not found.' });
    expect(model.updateOrderStatus).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 400 when transition is not allowed', async () => {
    model.getOrderById.mockResolvedValue({ id: 1, userId: 7, status: 'Delivered' });
    const req = createRequest('Processing');
    const res = createResponse();
    const next = jest.fn();

    orderController.updateOrderStatus(req, res, next);
    await Promise.resolve();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Order status cannot change from Delivered to Processing.',
    });
    expect(model.updateOrderStatus).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('updates order status when transition is valid', async () => {
    const updatedOrder = { id: 1, userId: 7, status: 'Processing' };
    model.getOrderById.mockResolvedValue({ id: 1, userId: 7, status: 'Pending' });
    model.updateOrderStatus.mockResolvedValue(updatedOrder);
    const req = createRequest('Processing');
    const res = createResponse();
    const next = jest.fn();

    orderController.updateOrderStatus(req, res, next);
    await Promise.resolve();
    await Promise.resolve();

    expect(model.updateOrderStatus).toHaveBeenCalledWith('1', 'Processing', 7);
    expect(res.locals.statusCode).toBe(200);
    expect(res.locals.results).toBe(updatedOrder);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
