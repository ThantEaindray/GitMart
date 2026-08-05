process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const pool = require('../../src/models/db');

const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn: '1h',
  });
}

const validOrderBody = {
  fullName: 'Alice Tan',
  emailAddress: 'alice@example.com',
  phoneNumber: '+65 9123 4567',
  address: '123 Main Street',
  unitNumber: '#12-345',
  postalCode: '123456',
  deliveryMethod: 'Standard',
  paymentMethod: 'Card',
  items: [],
};

const USER_A = 1001;
const USER_B = 1002;

const tokenA = createToken(USER_A);
const tokenB = createToken(USER_B);

// These ids used to be pure fiction: orders live in an in-memory store, so no
// matching user row was ever needed. Notifications are now a real table with a
// foreign key to users, so placing an order requires the buyer to actually
// exist. Explicit ids are used so the signed tokens above stay valid.
beforeAll(async () => {
  await pool.query(
    `
      INSERT INTO users (id, username, email, password)
      VALUES
        ($1, 'order_test_user_a', 'order_test_a@example.com', 'not-used-by-these-tests'),
        ($2, 'order_test_user_b', 'order_test_b@example.com', 'not-used-by-these-tests')
      ON CONFLICT (id) DO NOTHING
    `,
    [USER_A, USER_B],
  );
});

// Only removes the two rows this suite created, so it cannot disturb other
// integration suites running against the same database.
afterAll(async () => {
  await pool.query('DELETE FROM users WHERE id = ANY($1::integer[])', [[USER_A, USER_B]]);
  await pool.end();
});

// ── POST /api/orders — authentication ─────────────────────────────────────────

describe('POST /api/orders - authentication', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).post('/api/orders').send(validOrderBody);
    expect(res.status).toBe(401);
  });

  test('returns 401 when an invalid token is provided', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer invalid.token.here')
      .send(validOrderBody);
    expect(res.status).toBe(401);
  });

  test('returns 401 when Authorization header is malformed', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'NotBearer token')
      .send(validOrderBody);
    expect(res.status).toBe(401);
  });
});

// ── POST /api/orders — field validation ───────────────────────────────────────

describe('POST /api/orders - field validation', () => {
  test('returns 400 when fullName is missing', async () => {
    const { fullName, ...body } = validOrderBody;
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  test('returns 400 when emailAddress is missing', async () => {
    const { emailAddress, ...body } = validOrderBody;
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(body);
    expect(res.status).toBe(400);
  });

  test('returns 400 when phoneNumber is missing', async () => {
    const { phoneNumber, ...body } = validOrderBody;
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(body);
    expect(res.status).toBe(400);
  });

  test('returns 400 when address is missing', async () => {
    const { address, ...body } = validOrderBody;
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(body);
    expect(res.status).toBe(400);
  });

  test('returns 400 when unitNumber is missing', async () => {
    const { unitNumber, ...body } = validOrderBody;
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(body);
    expect(res.status).toBe(400);
  });

  test('returns 400 when postalCode is missing', async () => {
    const { postalCode, ...body } = validOrderBody;
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(body);
    expect(res.status).toBe(400);
  });

  test('returns 400 when deliveryMethod is missing', async () => {
    const { deliveryMethod, ...body } = validOrderBody;
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(body);
    expect(res.status).toBe(400);
  });

  test('returns 400 when paymentMethod is missing', async () => {
    const { paymentMethod, ...body } = validOrderBody;
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(body);
    expect(res.status).toBe(400);
  });

  test('returns 400 message text when fields are missing', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Required checkout order details are missing.');
  });
});

// ── POST /api/orders — format validation ──────────────────────────────────────

describe('POST /api/orders - format validation', () => {
  test('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validOrderBody, emailAddress: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid email address format.');
  });

  test('returns 400 for invalid phone format', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validOrderBody, phoneNumber: '91234567' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('+65');
  });

  test('returns 400 for invalid postal code', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validOrderBody, postalCode: '12345' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('6 digits');
  });

  test('returns 400 for invalid unit number', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validOrderBody, unitNumber: '12-345' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('#');
  });

  test('returns 400 for phone without +65 prefix', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validOrderBody, phoneNumber: '+60 9123 4567' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for 7-digit postal code', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validOrderBody, postalCode: '1234567' });
    expect(res.status).toBe(400);
  });
});

// ── POST /api/orders — success ────────────────────────────────────────────────

describe('POST /api/orders - success', () => {
  test('returns 201 on valid order', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validOrderBody);
    expect(res.status).toBe(201);
  });

  test('response includes an id', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validOrderBody);
    expect(res.body).toHaveProperty('id');
  });

  test('response includes status "Pending"', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validOrderBody);
    expect(res.body.status).toBe('Pending');
  });

  test('response includes createdAt timestamp', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validOrderBody);
    expect(res.body).toHaveProperty('createdAt');
  });

  test('response echoes back fullName', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validOrderBody, fullName: 'Bob Lee' });
    expect(res.body.fullName).toBe('Bob Lee');
  });

  test('response echoes back emailAddress', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validOrderBody, emailAddress: 'bob@test.com' });
    expect(res.body.emailAddress).toBe('bob@test.com');
  });

  test('order is accessible via GET after creation', async () => {
    const uniqueEmail = `unique_${Date.now()}@example.com`;
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validOrderBody, emailAddress: uniqueEmail });

    const getRes = await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenA}`);
    expect(getRes.status).toBe(200);
    const found = getRes.body.find((o) => o.emailAddress === uniqueEmail);
    expect(found).toBeDefined();
  });

  test('works with /orders route (not just /api/orders)', async () => {
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validOrderBody);
    expect(res.status).toBe(201);
  });
});

// ── POST /api/orders — reservation lookup failure ─────────────────────────────

describe('POST /api/orders - reservation lookup failure', () => {
  // Invalid partition: passes the controller's Number.isInteger/>0 filter but
  // overflows Postgres's integer[] cast (max ~2.1 billion), so the lookup
  // itself fails rather than just finding no accepted reservation.
  test('returns 500 when a listingId overflows a Postgres integer', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validOrderBody, items: [{ listingId: 99999999999999 }] });
    expect(res.status).toBe(500);
  });
});

// ── POST /api/orders — purchase-state tracking (markPurchasedItemsSold) ──────

describe('POST /api/orders - purchase state tracking', () => {
  // Invalid partition: items omitted entirely (as opposed to items: []) means
  // markPurchasedItemsSold is invoked with no argument at all, exercising its
  // own `items = []` default parameter.
  test('returns 201 when items is omitted entirely from the body', async () => {
    const { items: _items, ...bodyWithoutItems } = validOrderBody;
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(bodyWithoutItems);
    expect(res.status).toBe(201);
  });

  // Invalid partition: items sent as null (rather than omitted) skips the
  // default parameter — since default values only apply to undefined — and
  // instead exercises the `items || []` fallback inside getPurchasedIds.
  test('returns 201 when items is explicitly null', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validOrderBody, items: null });
    expect(res.status).toBe(201);
  });

  // Valid partition: a product-style item identified only by legacy `id`
  // (no productId, isOneOff: false) exercises the `!isOneOff ? item.id : null`
  // branch that supplies productId from `id`.
  test('returns 201 for a product item identified only by id', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validOrderBody, items: [{ isOneOff: false, id: 4242 }] });
    expect(res.status).toBe(201);
  });

  // Valid partition: a one-off item identified only by legacy `id` (no
  // listingId, isOneOff: true) exercises the `isOneOff ? item.id : null`
  // branch that supplies listingId from `id`.
  test('returns 201 for a one-off item identified only by id', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validOrderBody, items: [{ isOneOff: true, id: 4343 }] });
    expect(res.status).toBe(201);
  });
});

// ── GET /api/orders ───────────────────────────────────────────────────────────

describe('GET /api/orders', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  test('returns 200 with array for authenticated user', async () => {
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('returns only orders belonging to the current user', async () => {
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validOrderBody, fullName: 'User A Order' });

    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ ...validOrderBody, fullName: 'User B Order' });

    const resA = await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenA}`);
    const resB = await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenB}`);

    const aNamesA = resA.body.map((o) => o.userId).every((uid) => String(uid) === String(USER_A));
    const bNamesB = resB.body.map((o) => o.userId).every((uid) => String(uid) === String(USER_B));

    expect(aNamesA).toBe(true);
    expect(bNamesB).toBe(true);
  });

  test('returned order has expected fields', async () => {
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validOrderBody);

    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenA}`);
    const order = res.body[0];
    expect(order).toHaveProperty('id');
    expect(order).toHaveProperty('status');
    expect(order).toHaveProperty('createdAt');
    expect(order).toHaveProperty('fullName');
  });

  test('works with /orders route alias', async () => {
    const res = await request(app).get('/orders').set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
  });
});

// ── PUT /api/orders/:id ───────────────────────────────────────────────────────

describe('PUT /api/orders/:id', () => {
  async function createOrder(token = tokenA, body = validOrderBody) {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    return res.body;
  }

  test('returns 401 when no token is provided', async () => {
    const order = await createOrder();
    const res = await request(app).put(`/api/orders/${order.id}`).send({ status: 'Processing' });
    expect(res.status).toBe(401);
  });

  test('returns 400 when status is missing', async () => {
    const order = await createOrder();
    const res = await request(app)
      .put(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Order status is required.');
  });

  test('returns 400 for invalid status value', async () => {
    const order = await createOrder();
    const res = await request(app)
      .put(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'Shipped' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid order status.');
  });

  test('returns 400 for lowercase status', async () => {
    const order = await createOrder();
    const res = await request(app)
      .put(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'processing' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for status "Refunded"', async () => {
    const order = await createOrder();
    const res = await request(app)
      .put(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'Refunded' });
    expect(res.status).toBe(400);
  });

  test('returns 200 when updating to "Processing"', async () => {
    const order = await createOrder();
    const res = await request(app)
      .put(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'Processing' });
    expect(res.status).toBe(200);
  });

  test('returns 200 when updating to "Delivered"', async () => {
    const order = await createOrder();
    const res = await request(app)
      .put(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'Delivered' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Delivered');
  });

  test('returns 200 when updating to "Cancelled"', async () => {
    const order = await createOrder();
    const res = await request(app)
      .put(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'Cancelled' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Cancelled');
  });

  test('returns 200 when updating to "Pending"', async () => {
    const order = await createOrder();
    const res = await request(app)
      .put(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'Pending' });
    expect(res.status).toBe(200);
  });

  test('returns 404 for order that does not belong to user', async () => {
    const orderA = await createOrder(tokenA);
    const res = await request(app)
      .put(`/api/orders/${orderA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'Processing' });
    expect(res.status).toBe(404);
  });

  test('returns 404 for non-existent order id', async () => {
    const res = await request(app)
      .put('/api/orders/9999999')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'Processing' });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Order not found.');
  });

  test('updated order response includes the new status', async () => {
    const order = await createOrder();
    const res = await request(app)
      .put(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'Delivered' });
    expect(res.body.status).toBe('Delivered');
  });

  test('updated order response includes the order id', async () => {
    const order = await createOrder();
    const res = await request(app)
      .put(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'Processing' });
    expect(res.body.id).toBe(order.id);
  });

  test('update is reflected in subsequent GET', async () => {
    const order = await createOrder(tokenA, { ...validOrderBody, fullName: 'GET Reflect Test' });
    await request(app)
      .put(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'Delivered' });

    const getRes = await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenA}`);
    const updated = getRes.body.find((o) => o.id === order.id);
    expect(updated).toBeDefined();
    expect(updated.status).toBe('Delivered');
  });
});
