const controller = require('../../src/controllers/order.controller');
const model = require('../../src/utils/orderStore');
const reservationModel = require('../../src/models/Reservation.model');

jest.mock('../../src/utils/orderStore');

// Must be mocked: notifier reaches the database through Notification.model, so
// leaving it real would have these unit tests opening a Postgres connection.
jest.mock('../../src/utils/notifier', () => ({
  notify: jest.fn(),
}));
jest.mock('../../src/utils/purchaseState', () => ({
  markPurchasedItemsSold: jest.fn(),
}));
jest.mock('../../src/models/Reservation.model', () => ({
  getAcceptedListingIdsForUser: jest.fn(),
}));
jest.mock('../../src/models/Listing.model', () => ({
  markListingSold: jest.fn((id, callback) => callback(null, { id, status: 'SOLD' })),
  getListingsByIds: jest.fn((data, callback) => callback(null, { rows: [] })),
}));

const listingModel = require('../../src/models/Listing.model');
const { notify } = require('../../src/utils/notifier');

afterEach(() => jest.clearAllMocks());
afterAll(() => jest.restoreAllMocks());

// createOrder now awaits Promise.all() over promisify-wrapped
// markListingSold calls, then a further promisify-wrapped getListingsByIds
// call, before calling next() — each promisify-wrapped call needs more
// microtask ticks to settle than a plain mockResolvedValue await, and these
// two are sequential (not parallel), so the tick count here covers both.
async function flushAsync() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

function makeRes(locals = {}) {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: { ...locals },
  };
}

const validBody = {
  fullName: 'Alice Tan',
  emailAddress: 'alice@example.com',
  phoneNumber: '+65 9123 4567',
  address: '123 Main Street',
  unitNumber: '#12-345',
  postalCode: '123456',
  deliveryMethod: 'Standard',
  paymentMethod: 'Card',
  items: [{ id: 1 }],
};

const fakeOrder = {
  id: 1,
  ...validBody,
  userId: 7,
  status: 'Pending',
  createdAt: new Date().toISOString(),
};

// ── createOrder — missing required fields ─────────────────────────────────────

describe('createOrder - missing required fields', () => {
  it('returns 400 when fullName is missing', () => {
    const { fullName, ...body } = validBody;
    const req = { body };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('returns 400 when emailAddress is missing', () => {
    const { emailAddress, ...body } = validBody;
    const req = { body };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when phoneNumber is missing', () => {
    const { phoneNumber, ...body } = validBody;
    const req = { body };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when address is missing', () => {
    const { address, ...body } = validBody;
    const req = { body };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when unitNumber is missing', () => {
    const { unitNumber, ...body } = validBody;
    const req = { body };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when postalCode is missing', () => {
    const { postalCode, ...body } = validBody;
    const req = { body };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when deliveryMethod is missing', () => {
    const { deliveryMethod, ...body } = validBody;
    const req = { body };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when paymentMethod is missing', () => {
    const { paymentMethod, ...body } = validBody;
    const req = { body };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when body is empty', () => {
    const req = { body: {} };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 message about missing details', () => {
    const req = { body: {} };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Required checkout order details are missing.' }),
    );
  });
});

// ── createOrder — email validation ────────────────────────────────────────────

describe('createOrder - email validation', () => {
  it('returns 400 for email without @', () => {
    const req = { body: { ...validBody, emailAddress: 'invalidemail' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid email address format.' }),
    );
  });

  it('returns 400 for email without domain part', () => {
    const req = { body: { ...validBody, emailAddress: 'user@' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for email with spaces', () => {
    const req = { body: { ...validBody, emailAddress: 'user @example.com' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for email without TLD', () => {
    const req = { body: { ...validBody, emailAddress: 'user@domain' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('accepts a valid email address', async () => {
    const req = { body: { ...validBody, emailAddress: 'test@example.com' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await Promise.resolve();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it('accepts email with subdomain', async () => {
    const req = { body: { ...validBody, emailAddress: 'user@mail.example.com' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await Promise.resolve();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });
});

// ── createOrder — phone validation ────────────────────────────────────────────

describe('createOrder - phone validation', () => {
  it('returns 400 for phone without +65 prefix', () => {
    const req = { body: { ...validBody, phoneNumber: '9123 4567' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('+65') }),
    );
  });

  it('returns 400 for phone with wrong digit count', () => {
    const req = { body: { ...validBody, phoneNumber: '+65 123 456' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for phone without spaces', () => {
    const req = { body: { ...validBody, phoneNumber: '+6591234567' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for phone with dashes instead of spaces', () => {
    const req = { body: { ...validBody, phoneNumber: '+65-9123-4567' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('accepts valid +65 phone number', async () => {
    const req = { body: { ...validBody, phoneNumber: '+65 9086 2744' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await Promise.resolve();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it('accepts another valid phone number', async () => {
    const req = { body: { ...validBody, phoneNumber: '+65 6500 1234' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await Promise.resolve();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });
});

// ── createOrder — postal code validation ──────────────────────────────────────

describe('createOrder - postal code validation', () => {
  it('returns 400 for postal code with only 5 digits', () => {
    const req = { body: { ...validBody, postalCode: '12345' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('6 digits') }),
    );
  });

  it('returns 400 for postal code with 7 digits', () => {
    const req = { body: { ...validBody, postalCode: '1234567' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for postal code with letters', () => {
    const req = { body: { ...validBody, postalCode: '12A456' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for empty postal code', () => {
    const req = { body: { ...validBody, postalCode: '' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('accepts valid 6-digit postal code', async () => {
    const req = { body: { ...validBody, postalCode: '654321' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await Promise.resolve();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it('accepts postal code starting with 0', async () => {
    const req = { body: { ...validBody, postalCode: '012345' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await Promise.resolve();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });
});

// ── createOrder — unit number validation ──────────────────────────────────────

describe('createOrder - unit number validation', () => {
  it('returns 400 for unit number without # prefix', () => {
    const req = { body: { ...validBody, unitNumber: '12-345' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('#') }),
    );
  });

  it('returns 400 for unit number with wrong format', () => {
    const req = { body: { ...validBody, unitNumber: '#1-234' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for unit number missing dash', () => {
    const req = { body: { ...validBody, unitNumber: '#12345' } };
    const res = makeRes({ userId: 7 });
    controller.createOrder(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('accepts valid 3-digit unit number', async () => {
    const req = { body: { ...validBody, unitNumber: '#12-345' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await Promise.resolve();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it('accepts valid 4-digit unit number', async () => {
    const req = { body: { ...validBody, unitNumber: '#05-1234' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await Promise.resolve();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it('accepts valid 2-digit unit number', async () => {
    const req = { body: { ...validBody, unitNumber: '#01-23' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await Promise.resolve();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });
});

// ── createOrder — success ─────────────────────────────────────────────────────

describe('createOrder - success', () => {
  it('sets statusCode 201 and calls next on success', async () => {
    const req = { body: validBody };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await flushAsync();
    expect(res.locals.statusCode).toBe(201);
    expect(next).toHaveBeenCalled();
  });

  it('sets res.locals.results to the created order', async () => {
    const req = { body: validBody };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await flushAsync();
    expect(res.locals.results).toEqual(fakeOrder);
  });

  it('passes userId from res.locals into the order data', async () => {
    const req = { body: validBody };
    const res = makeRes({ userId: 42 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await Promise.resolve();
    expect(model.createOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: 42 }));
  });

  it('merges req.body fields into the order data', async () => {
    const req = { body: validBody };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await Promise.resolve();
    expect(model.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Alice Tan', paymentMethod: 'Card' }),
    );
  });

  it('calls next without error on success', async () => {
    const req = { body: validBody };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await flushAsync();
    expect(next).toHaveBeenCalledWith();
  });
});

// ── createOrder — marks one-off listings sold ─────────────────────────────────

describe('createOrder - marks one-off listings sold', () => {
  it('calls markListingSold for a one-off listing item', async () => {
    const req = { body: { ...validBody, items: [{ listingId: 21 }] } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await flushAsync();
    expect(listingModel.markListingSold).toHaveBeenCalledWith(21, expect.any(Function));
    expect(next).toHaveBeenCalledWith();
  });

  it('marks every one-off listing when the cart has more than one', async () => {
    const req = { body: { ...validBody, items: [{ listingId: 21 }, { listingId: 22 }] } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await flushAsync();
    expect(listingModel.markListingSold).toHaveBeenCalledWith(21, expect.any(Function));
    expect(listingModel.markListingSold).toHaveBeenCalledWith(22, expect.any(Function));
  });

  it('does not throw when items is explicitly null', async () => {
    const req = { body: { ...validBody, items: null } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await flushAsync();
    expect(listingModel.markListingSold).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('does not call markListingSold for a catalogue product item (no listingId)', async () => {
    const req = { body: { ...validBody, items: [{ id: 1 }] } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await flushAsync();
    expect(listingModel.markListingSold).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with the error when marking a listing sold fails', async () => {
    const req = { body: { ...validBody, items: [{ listingId: 21 }] } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    const err = new Error('update failed');
    listingModel.markListingSold.mockImplementationOnce((id, callback) => callback(err));
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await flushAsync();
    expect(next).toHaveBeenCalledWith(err);
    expect(res.locals.statusCode).toBeUndefined();
  });
});

// ── createOrder — notifies the seller of a sale ───────────────────────────────

describe('createOrder - notifies the seller of a sale', () => {
  it('notifies the listing owner once, naming the listing', async () => {
    const req = { body: { ...validBody, items: [{ listingId: 21 }] } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    listingModel.getListingsByIds.mockImplementationOnce((data, callback) =>
      callback(null, { rows: [{ id: 21, owner_id: 99, title: 'Vintage Camera' }] }),
    );
    controller.createOrder(req, res, next);
    await flushAsync();
    expect(notify).toHaveBeenCalledWith(
      99,
      'order',
      'You made a sale',
      `Order #${fakeOrder.id} includes "Vintage Camera".`,
    );
  });

  it('notifies each distinct owner once when a cart spans two sellers', async () => {
    const req = {
      body: { ...validBody, items: [{ listingId: 21 }, { listingId: 22 }] },
    };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    listingModel.getListingsByIds.mockImplementationOnce((data, callback) =>
      callback(null, {
        rows: [
          { id: 21, owner_id: 99, title: 'Vintage Camera' },
          { id: 22, owner_id: 100, title: 'Old Radio' },
        ],
      }),
    );
    controller.createOrder(req, res, next);
    await flushAsync();
    expect(notify).toHaveBeenCalledWith(
      99,
      'order',
      'You made a sale',
      `Order #${fakeOrder.id} includes "Vintage Camera".`,
    );
    expect(notify).toHaveBeenCalledWith(
      100,
      'order',
      'You made a sale',
      `Order #${fakeOrder.id} includes "Old Radio".`,
    );
  });

  it('mentions a count instead of listing every title when one owner sold several items', async () => {
    const req = {
      body: { ...validBody, items: [{ listingId: 21 }, { listingId: 22 }] },
    };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    listingModel.getListingsByIds.mockImplementationOnce((data, callback) =>
      callback(null, {
        rows: [
          { id: 21, owner_id: 99, title: 'Vintage Camera' },
          { id: 22, owner_id: 99, title: 'Old Radio' },
        ],
      }),
    );
    controller.createOrder(req, res, next);
    await flushAsync();
    expect(notify).toHaveBeenCalledWith(
      99,
      'order',
      'You made a sale',
      `Order #${fakeOrder.id} includes 2 of your listings.`,
    );
  });

  it('does not look up listings or notify anyone for a catalogue-only order', async () => {
    const req = { body: { ...validBody, items: [{ id: 1 }] } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockResolvedValue(fakeOrder);
    controller.createOrder(req, res, next);
    await flushAsync();
    expect(listingModel.getListingsByIds).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalledWith(
      expect.anything(),
      'order',
      'You made a sale',
      expect.anything(),
    );
  });
});

// ── createOrder — model error ─────────────────────────────────────────────────

describe('createOrder - model error', () => {
  it('calls next with error when model rejects', async () => {
    const req = { body: validBody };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    const err = new Error('DB failure');
    model.createOrder.mockRejectedValue(err);
    controller.createOrder(req, res, next);
    await Promise.resolve();
    await Promise.resolve();
    expect(next).toHaveBeenCalledWith(err);
  });

  it('does not set statusCode when model rejects', async () => {
    const req = { body: validBody };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.createOrder.mockRejectedValue(new Error('fail'));
    controller.createOrder(req, res, next);
    await Promise.resolve();
    await Promise.resolve();
    expect(res.locals.statusCode).toBeUndefined();
  });
});

// ── getAllOrders ──────────────────────────────────────────────────────────────

describe('getAllOrders', () => {
  it('sets statusCode 200 and calls next on success', async () => {
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.getAllOrders.mockResolvedValue([fakeOrder]);
    controller.getAllOrders({}, res, next);
    await Promise.resolve();
    expect(res.locals.statusCode).toBe(200);
    expect(next).toHaveBeenCalled();
  });

  it('sets res.locals.results to the orders array', async () => {
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    const orders = [fakeOrder, { ...fakeOrder, id: 2 }];
    model.getAllOrders.mockResolvedValue(orders);
    controller.getAllOrders({}, res, next);
    await Promise.resolve();
    expect(res.locals.results).toEqual(orders);
  });

  it('returns empty array when user has no orders', async () => {
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.getAllOrders.mockResolvedValue([]);
    controller.getAllOrders({}, res, next);
    await Promise.resolve();
    expect(res.locals.results).toEqual([]);
    expect(next).toHaveBeenCalled();
  });

  it('calls model with userId from res.locals', async () => {
    const res = makeRes({ userId: 42 });
    const next = jest.fn();
    model.getAllOrders.mockResolvedValue([]);
    controller.getAllOrders({}, res, next);
    await Promise.resolve();
    expect(model.getAllOrders).toHaveBeenCalledWith(42);
  });

  it('calls next with error when model rejects', async () => {
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    const err = new Error('DB failure');
    model.getAllOrders.mockRejectedValue(err);
    controller.getAllOrders({}, res, next);
    await Promise.resolve();
    await Promise.resolve();
    expect(next).toHaveBeenCalledWith(err);
  });

  it('model is called exactly once per request', async () => {
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.getAllOrders.mockResolvedValue([]);
    controller.getAllOrders({}, res, next);
    await Promise.resolve();
    expect(model.getAllOrders).toHaveBeenCalledTimes(1);
  });
});

// ── getSellerSales ─────────────────────────────────────────────────────────

describe('getSellerSales', () => {
  function orderWithItems(id, items, overrides = {}) {
    return { ...fakeOrder, id, items, fullName: 'Buyer Name', ...overrides };
  }

  it('sets statusCode 200 and calls next when the caller owns no listings', async () => {
    const res = makeRes({ userId: 99 });
    const next = jest.fn();
    model.getAllOrdersRaw.mockResolvedValue([]);
    controller.getSellerSales({}, res, next);
    await flushAsync();
    expect(res.locals.statusCode).toBe(200);
    expect(res.locals.results).toEqual([]);
    expect(next).toHaveBeenCalled();
  });

  it('does not query listings at all when no order has a one-off item', async () => {
    const res = makeRes({ userId: 99 });
    const next = jest.fn();
    model.getAllOrdersRaw.mockResolvedValue([orderWithItems(1, [{ id: 1 }])]);
    controller.getSellerSales({}, res, next);
    await flushAsync();
    expect(listingModel.getListingsByIds).not.toHaveBeenCalled();
    expect(res.locals.results).toEqual([]);
  });

  it('includes an order whose item belongs to the caller, with only that item', async () => {
    const res = makeRes({ userId: 99 });
    const next = jest.fn();
    model.getAllOrdersRaw.mockResolvedValue([
      orderWithItems(1, [{ listingId: 21, name: 'Vintage Camera', price: 180, quantity: 1 }]),
    ]);
    listingModel.getListingsByIds.mockImplementationOnce((data, callback) =>
      callback(null, { rows: [{ id: 21, owner_id: 99, title: 'Vintage Camera' }] }),
    );
    controller.getSellerSales({}, res, next);
    await flushAsync();
    expect(res.locals.results).toEqual([
      {
        orderId: 1,
        status: fakeOrder.status,
        createdAt: fakeOrder.createdAt,
        buyerName: 'Buyer Name',
        items: [{ listingId: 21, itemName: 'Vintage Camera', quantity: 1, price: 180 }],
      },
    ]);
  });

  it('excludes an order whose items belong to a different owner', async () => {
    const res = makeRes({ userId: 99 });
    const next = jest.fn();
    model.getAllOrdersRaw.mockResolvedValue([orderWithItems(1, [{ listingId: 21 }])]);
    listingModel.getListingsByIds.mockImplementationOnce((data, callback) =>
      callback(null, { rows: [{ id: 21, owner_id: 5, title: 'Not Mine' }] }),
    );
    controller.getSellerSales({}, res, next);
    await flushAsync();
    expect(res.locals.results).toEqual([]);
  });

  it('only includes the caller-owned items from a multi-seller order', async () => {
    const res = makeRes({ userId: 99 });
    const next = jest.fn();
    model.getAllOrdersRaw.mockResolvedValue([
      orderWithItems(1, [
        { listingId: 21, name: 'Mine', price: 10, quantity: 1 },
        { listingId: 22, name: 'Not Mine', price: 20, quantity: 1 },
      ]),
    ]);
    listingModel.getListingsByIds.mockImplementationOnce((data, callback) =>
      callback(null, {
        rows: [
          { id: 21, owner_id: 99, title: 'Mine' },
          { id: 22, owner_id: 5, title: 'Not Mine' },
        ],
      }),
    );
    controller.getSellerSales({}, res, next);
    await flushAsync();
    expect(res.locals.results).toEqual([
      {
        orderId: 1,
        status: fakeOrder.status,
        createdAt: fakeOrder.createdAt,
        buyerName: 'Buyer Name',
        items: [{ listingId: 21, itemName: 'Mine', quantity: 1, price: 10 }],
      },
    ]);
  });

  it('sorts sales newest first', async () => {
    const res = makeRes({ userId: 99 });
    const next = jest.fn();
    model.getAllOrdersRaw.mockResolvedValue([
      orderWithItems(1, [{ listingId: 21 }], { createdAt: '2024-01-01T00:00:00.000Z' }),
      orderWithItems(2, [{ listingId: 21 }], { createdAt: '2024-06-01T00:00:00.000Z' }),
    ]);
    listingModel.getListingsByIds.mockImplementationOnce((data, callback) =>
      callback(null, { rows: [{ id: 21, owner_id: 99, title: 'Mine' }] }),
    );
    controller.getSellerSales({}, res, next);
    await flushAsync();
    expect(res.locals.results.map((sale) => sale.orderId)).toEqual([2, 1]);
  });

  it('calls next with the error when the model rejects', async () => {
    const res = makeRes({ userId: 99 });
    const next = jest.fn();
    const err = new Error('DB failure');
    model.getAllOrdersRaw.mockRejectedValue(err);
    controller.getSellerSales({}, res, next);
    await flushAsync();
    expect(next).toHaveBeenCalledWith(err);
  });
});

// ── getOrderById ───────────────────────────────────────────────────────────

describe('getOrderById', () => {
  it('sets statusCode 200 and the order on success', async () => {
    const req = { params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.getOrderById.mockResolvedValue(fakeOrder);
    controller.getOrderById(req, res, next);
    await Promise.resolve();
    expect(res.locals.statusCode).toBe(200);
    expect(res.locals.results).toEqual(fakeOrder);
    expect(next).toHaveBeenCalled();
  });

  it('calls model with id and userId', async () => {
    const req = { params: { id: '5' } };
    const res = makeRes({ userId: 42 });
    const next = jest.fn();
    model.getOrderById.mockResolvedValue(fakeOrder);
    controller.getOrderById(req, res, next);
    await Promise.resolve();
    expect(model.getOrderById).toHaveBeenCalledWith('5', 42);
  });

  it('returns 404 when the order does not exist', async () => {
    const req = { params: { id: '999' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.getOrderById.mockResolvedValue(null);
    controller.getOrderById(req, res, next);
    await Promise.resolve();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Order not found.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next with error when model rejects', async () => {
    const req = { params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    const err = new Error('DB failure');
    model.getOrderById.mockRejectedValue(err);
    controller.getOrderById(req, res, next);
    await Promise.resolve();
    await Promise.resolve();
    expect(next).toHaveBeenCalledWith(err);
  });
});

// ── updateOrderStatus — validation ───────────────────────────────────────────

describe('updateOrderStatus - validation', () => {
  it('returns 400 when status is missing from body', () => {
    const req = { body: {}, params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    controller.updateOrderStatus(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Order status is required.' });
  });

  it('returns 400 for invalid status "Shipped"', () => {
    const req = { body: { status: 'Shipped' }, params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    controller.updateOrderStatus(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid order status.' });
  });

  it('returns 400 for invalid status "Refunded"', () => {
    const req = { body: { status: 'Refunded' }, params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    controller.updateOrderStatus(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for invalid status "completed" (wrong case)', () => {
    const req = { body: { status: 'completed' }, params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    controller.updateOrderStatus(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for invalid status empty string', () => {
    const req = { body: { status: '' }, params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    controller.updateOrderStatus(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('accepts status "Pending" (same-status no-op)', async () => {
    const req = { body: { status: 'Pending' }, params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.getOrderById.mockResolvedValue({ ...fakeOrder, status: 'Pending' });
    controller.updateOrderStatus(req, res, next);
    await Promise.resolve();
    await Promise.resolve();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it('accepts status "Processing"', async () => {
    const req = { body: { status: 'Processing' }, params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.getOrderById.mockResolvedValue({ ...fakeOrder, status: 'Pending' });
    model.updateOrderStatus.mockResolvedValue({ ...fakeOrder, status: 'Processing' });
    controller.updateOrderStatus(req, res, next);
    await Promise.resolve();
    await Promise.resolve();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it('accepts status "Delivered" (from Processing)', async () => {
    const req = { body: { status: 'Delivered' }, params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.getOrderById.mockResolvedValue({ ...fakeOrder, status: 'Processing' });
    model.updateOrderStatus.mockResolvedValue({ ...fakeOrder, status: 'Delivered' });
    controller.updateOrderStatus(req, res, next);
    await Promise.resolve();
    await Promise.resolve();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it('accepts status "Cancelled"', async () => {
    const req = { body: { status: 'Cancelled' }, params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.getOrderById.mockResolvedValue({ ...fakeOrder, status: 'Pending' });
    model.updateOrderStatus.mockResolvedValue({ ...fakeOrder, status: 'Cancelled' });
    controller.updateOrderStatus(req, res, next);
    await Promise.resolve();
    await Promise.resolve();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });
});

// ── updateOrderStatus — invalid transition ────────────────────────────────────

describe('updateOrderStatus - invalid transition', () => {
  it('returns 400 when the order cannot move from its current status', async () => {
    const req = { body: { status: 'Processing' }, params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.getOrderById.mockResolvedValue({ ...fakeOrder, status: 'Delivered' });
    controller.updateOrderStatus(req, res, next);
    await Promise.resolve();
    await Promise.resolve();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Order status cannot change from Delivered to Processing.',
    });
    expect(model.updateOrderStatus).not.toHaveBeenCalled();
  });
});

// ── updateOrderStatus — not found ─────────────────────────────────────────────

describe('updateOrderStatus - not found', () => {
  it('returns 404 when model returns null (order not found)', async () => {
    const req = { body: { status: 'Pending' }, params: { id: '999' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.getOrderById.mockResolvedValue(null);
    controller.updateOrderStatus(req, res, next);
    await Promise.resolve();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Order not found.' });
  });

  it('does not call next when order is not found', async () => {
    const req = { body: { status: 'Pending' }, params: { id: '999' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.getOrderById.mockResolvedValue(null);
    controller.updateOrderStatus(req, res, next);
    await Promise.resolve();
    expect(next).not.toHaveBeenCalled();
  });
});

// ── updateOrderStatus — success ───────────────────────────────────────────────

describe('updateOrderStatus - success', () => {
  it('sets statusCode 200 and calls next on success', async () => {
    const req = { body: { status: 'Delivered' }, params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.getOrderById.mockResolvedValue({ ...fakeOrder, status: 'Processing' });
    model.updateOrderStatus.mockResolvedValue({ ...fakeOrder, status: 'Delivered' });
    controller.updateOrderStatus(req, res, next);
    await Promise.resolve();
    await Promise.resolve();
    expect(res.locals.statusCode).toBe(200);
    expect(next).toHaveBeenCalled();
  });

  it('sets res.locals.results to the updated order', async () => {
    const req = { body: { status: 'Delivered' }, params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    const updated = { ...fakeOrder, status: 'Delivered' };
    model.getOrderById.mockResolvedValue({ ...fakeOrder, status: 'Processing' });
    model.updateOrderStatus.mockResolvedValue(updated);
    controller.updateOrderStatus(req, res, next);
    await Promise.resolve();
    await Promise.resolve();
    expect(res.locals.results).toEqual(updated);
  });

  it('passes id from req.params to the model', async () => {
    const req = { body: { status: 'Processing' }, params: { id: '5' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    model.getOrderById.mockResolvedValue({ ...fakeOrder, id: 5, status: 'Pending' });
    model.updateOrderStatus.mockResolvedValue({ ...fakeOrder, id: 5, status: 'Processing' });
    controller.updateOrderStatus(req, res, next);
    await Promise.resolve();
    await Promise.resolve();
    expect(model.getOrderById).toHaveBeenCalledWith('5', 7);
    expect(model.updateOrderStatus).toHaveBeenCalledWith('5', 'Processing', 7);
  });

  it('passes userId from res.locals to the model', async () => {
    const req = { body: { status: 'Processing' }, params: { id: '1' } };
    const res = makeRes({ userId: 99 });
    const next = jest.fn();
    model.getOrderById.mockResolvedValue({ ...fakeOrder, status: 'Pending' });
    model.updateOrderStatus.mockResolvedValue({ ...fakeOrder, status: 'Processing' });
    controller.updateOrderStatus(req, res, next);
    await Promise.resolve();
    await Promise.resolve();
    expect(model.updateOrderStatus).toHaveBeenCalledWith('1', 'Processing', 99);
  });
});

// ── updateOrderStatus — model error ───────────────────────────────────────────

describe('updateOrderStatus - model error', () => {
  it('calls next with error when model rejects', async () => {
    const req = { body: { status: 'Processing' }, params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    const err = new Error('DB failure');
    model.getOrderById.mockResolvedValue({ ...fakeOrder, status: 'Pending' });
    model.updateOrderStatus.mockRejectedValue(err);
    controller.updateOrderStatus(req, res, next);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(next).toHaveBeenCalledWith(err);
  });

  it('calls next with error when the initial lookup rejects', async () => {
    const req = { body: { status: 'Processing' }, params: { id: '1' } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();
    const err = new Error('DB failure');
    model.getOrderById.mockRejectedValue(err);
    controller.updateOrderStatus(req, res, next);
    await Promise.resolve();
    await Promise.resolve();
    expect(next).toHaveBeenCalledWith(err);
  });
});

// ── sendResponse ──────────────────────────────────────────────────────────────

describe('sendResponse', () => {
  it('sends statusCode 201 with results', () => {
    const res = makeRes({ statusCode: 201, results: fakeOrder });
    controller.sendResponse({}, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(fakeOrder);
  });

  it('sends statusCode 200 with array results', () => {
    const res = makeRes({ statusCode: 200, results: [fakeOrder] });
    controller.sendResponse({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([fakeOrder]);
  });

  it('sends exact results object from res.locals', () => {
    const results = { id: 99, status: 'Cancelled' };
    const res = makeRes({ statusCode: 200, results });
    controller.sendResponse({}, res);
    expect(res.json).toHaveBeenCalledWith(results);
  });

  it('sends 404 statusCode correctly', () => {
    const res = makeRes({ statusCode: 404, results: { message: 'Not found' } });
    controller.sendResponse({}, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('sends empty array results', () => {
    const res = makeRes({ statusCode: 200, results: [] });
    controller.sendResponse({}, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });
});

// ── verifyListingReservations ────────────────────────────────────────────────

describe('verifyListingReservations', () => {
  let consoleErrorSpy;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => consoleErrorSpy.mockRestore());

  // Resolves the guard with the listing ids the buyer is allowed to purchase.
  function allowListings(ids) {
    reservationModel.getAcceptedListingIdsForUser.mockImplementation((_data, callback) => {
      callback(null, { rows: ids.map((id) => ({ listing_id: id })) });
    });
  }

  it('skips the lookup entirely for a catalogue-only cart', () => {
    const req = { body: { items: [{ id: 1, productId: 1, listingId: null }] } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();

    controller.verifyListingReservations(req, res, next);

    expect(reservationModel.getAcceptedListingIdsForUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('skips the lookup when the cart has no items', () => {
    const res = makeRes({ userId: 7 });
    const next = jest.fn();

    controller.verifyListingReservations({ body: {} }, res, next);

    expect(reservationModel.getAcceptedListingIdsForUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('queries with the buyer id and the listing ids from the cart', () => {
    allowListings([4, 9]);
    const req = { body: { items: [{ listingId: 4 }, { listingId: '9' }] } };
    const next = jest.fn();

    controller.verifyListingReservations(req, makeRes({ userId: 7 }), next);

    expect(reservationModel.getAcceptedListingIdsForUser).toHaveBeenCalledWith(
      { requester_id: 7, listing_ids: [4, 9] },
      expect.any(Function),
    );
    expect(next).toHaveBeenCalled();
  });

  it('blocks checkout with 403 when a listing has no accepted reservation', () => {
    allowListings([4]);
    const req = { body: { items: [{ listingId: 4 }, { listingId: 5 }] } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();

    controller.verifyListingReservations(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: expect.stringContaining('Blocked listing IDs: 5.'),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks every unreserved listing, not just the first', () => {
    allowListings([]);
    const req = { body: { items: [{ listingId: 5 }, { listingId: 6 }] } };
    const res = makeRes({ userId: 7 });

    controller.verifyListingReservations(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({
      message: expect.stringContaining('Blocked listing IDs: 5, 6.'),
    });
  });

  it('lets a mixed cart through when every listing is reserved by the buyer', () => {
    allowListings([4]);
    const req = { body: { items: [{ productId: 2, listingId: null }, { listingId: 4 }] } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();

    controller.verifyListingReservations(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('ignores malformed listing ids rather than querying for them', () => {
    const req = { body: { items: [{ listingId: 'abc' }, { listingId: -1 }, { listingId: 0 }] } };
    const next = jest.fn();

    controller.verifyListingReservations(req, makeRes({ userId: 7 }), next);

    expect(reservationModel.getAcceptedListingIdsForUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('returns 500 and does not continue when the lookup fails', () => {
    reservationModel.getAcceptedListingIdsForUser.mockImplementation((_data, callback) => {
      callback(new Error('db down'));
    });

    const req = { body: { items: [{ listingId: 4 }] } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();

    controller.verifyListingReservations(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('compares ids numerically so string ids from the cart still match', () => {
    reservationModel.getAcceptedListingIdsForUser.mockImplementation((_data, callback) => {
      callback(null, { rows: [{ listing_id: '4' }] });
    });

    const req = { body: { items: [{ listingId: '4' }] } };
    const res = makeRes({ userId: 7 });
    const next = jest.fn();

    controller.verifyListingReservations(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
