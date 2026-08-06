const { test, expect } = require('@playwright/test');

const trackedOrder = {
  id: 12,
  userId: 7,
  status: 'Processing',
  fullName: 'Melissa Reese Halida',
  emailAddress: 'melissareesehalida@gmail.com',
  phoneNumber: '+65 9086 2744',
  address: '407B Senja Road',
  unitNumber: '#67-76',
  postalCode: '607407',
  deliveryMethod: 'Standard Delivery',
  paymentMethod: 'GrabPay',
  deliveryNotes: 'Handle with care.',
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
    {
      status: 'Processing',
      note: 'Order status changed to Processing.',
      createdAt: '2026-07-28T14:00:00.000Z',
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
      body: JSON.stringify([trackedOrder]),
    });
  });

  await page.goto('http://127.0.0.1:3001/html/orders.html');
});

test.describe('Order tracking timeline', () => {
  test('shows tracking history after expanding an order card', async ({ page }) => {
    const orderCard = page.locator('.order-card').first();

    await expect(orderCard).toContainText('Order #12');
    await expect(orderCard).toContainText('processing');

    await orderCard.locator('.order-card-header').click();

    await expect(orderCard.getByText('Tracking Timeline')).toBeVisible();
    await expect(orderCard.locator('.timeline-entry')).toHaveCount(2);
    await expect(orderCard.locator('.timeline-entry').nth(0)).toContainText('Pending');
    await expect(orderCard.locator('.timeline-entry').nth(0)).toContainText(
      'Order was created after checkout.',
    );
    await expect(orderCard.locator('.timeline-entry').nth(1)).toContainText('Processing');
    await expect(orderCard.locator('.timeline-entry').nth(1)).toContainText(
      'Order status changed to Processing.',
    );
  });

  test('shows order details together with the tracking timeline', async ({ page }) => {
    const orderCard = page.locator('.order-card').first();

    await orderCard.locator('.order-card-header').click();

    await expect(orderCard).toContainText('Vintage Bracelet');
    await expect(orderCard).toContainText('Shipping');
    await expect(orderCard).toContainText('Delivery & Payment');
    await expect(orderCard).toContainText('Handle with care.');
    await expect(orderCard).toContainText('Tracking Timeline');
  });
});
