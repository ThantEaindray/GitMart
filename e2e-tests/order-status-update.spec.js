const { test, expect } = require('@playwright/test');

const pendingOrder = {
  id: 21,
  userId: 7,
  status: 'Pending',
  fullName: 'Melissa Reese Halida',
  emailAddress: 'melissareesehalida@gmail.com',
  phoneNumber: '+65 9086 2744',
  address: '407B Senja Road',
  unitNumber: '#67-76',
  postalCode: '607407',
  deliveryMethod: 'Standard Delivery',
  paymentMethod: 'GrabPay',
  deliveryNotes: 'Signature required.',
  createdAt: '2026-07-28T13:48:00.000Z',
  subtotal: 480,
  deliveryFee: 9.99,
  gst: 43.2,
  totalAmount: 533.19,
  items: [{ name: 'Vintage Bracelet', quantity: 1, price: 480 }],
  statusHistory: [
    {
      status: 'Pending',
      note: 'Order was created after checkout.',
      createdAt: '2026-07-28T13:48:00.000Z',
    },
  ],
};

const processingOrder = {
  ...pendingOrder,
  status: 'Processing',
  statusHistory: [
    ...pendingOrder.statusHistory,
    {
      status: 'Processing',
      note: 'Order status changed to Processing.',
      createdAt: '2026-07-28T14:05:00.000Z',
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'playwright-test-token');
  });

  await page.route('**/api/orders', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([pendingOrder]),
    });
  });

  await page.route('**/api/orders/21', async (route) => {
    expect(route.request().method()).toBe('PUT');
    const body = JSON.parse(route.request().postData() || '{}');
    expect(body).toEqual({ status: 'Processing' });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(processingOrder),
    });
  });

  await page.goto('http://127.0.0.1:3001/html/orders.html');
});

test.describe('Order status update workflow', () => {
  test('updates a pending order to processing and refreshes the timeline', async ({ page }) => {
    const orderCard = page.locator('.order-card').first();

    await expect(orderCard).toContainText('Order #21');
    await expect(orderCard.locator('.status-badge')).toHaveText('pending');

    await orderCard.locator('.order-card-header').click();
    await expect(orderCard.locator('.timeline-entry')).toHaveCount(1);

    await orderCard.locator('.status-dropdown').selectOption('Processing');

    await expect(orderCard.locator('.status-badge')).toHaveText('processing');
    await expect(orderCard.locator('.timeline-entry')).toHaveCount(2);
    await expect(orderCard.locator('.timeline-entry').nth(1)).toContainText('Processing');
    await expect(orderCard.locator('.timeline-entry').nth(1)).toContainText(
      'Order status changed to Processing.',
    );
    await expect(orderCard.locator('.status-dropdown')).toHaveValue('Processing');
  });
});
