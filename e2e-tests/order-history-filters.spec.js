const { test, expect } = require('@playwright/test');

const sampleOrders = [
  {
    id: 1,
    userId: 7,
    status: 'Pending',
    fullName: 'Melissa Reese Halida',
    address: '407B Senja Road',
    unitNumber: '#67-76',
    createdAt: '2026-07-28T13:45:00.000Z',
    totalAmount: 3497.99,
    items: [{ name: 'Luxury Tote Bag', quantity: 1, price: 3200 }],
    statusHistory: [
      {
        status: 'Pending',
        note: 'Order was created after checkout.',
        createdAt: '2026-07-28T13:45:00.000Z',
      },
    ],
  },
  {
    id: 2,
    userId: 7,
    status: 'Processing',
    fullName: 'Melissa Reese Halida',
    address: '407B Senja Road',
    unitNumber: '#67-76',
    createdAt: '2026-07-28T13:48:00.000Z',
    totalAmount: 523.2,
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
  },
  {
    id: 3,
    userId: 7,
    status: 'Delivered',
    fullName: 'Melissa Reese Halida',
    address: '407B Senja Road',
    unitNumber: '#67-76',
    createdAt: '2026-07-28T13:52:00.000Z',
    totalAmount: 316.1,
    items: [{ name: 'Designer Card Holder', quantity: 1, price: 290 }],
    statusHistory: [
      {
        status: 'Pending',
        note: 'Order was created after checkout.',
        createdAt: '2026-07-28T13:52:00.000Z',
      },
      {
        status: 'Delivered',
        note: 'Order status changed to Delivered.',
        createdAt: '2026-07-28T14:15:00.000Z',
      },
    ],
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'playwright-test-token');
  });

  await page.route('**/api/orders', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sampleOrders),
    });
  });

  await page.goto('http://127.0.0.1:3001/html/orders.html');
});

test.describe('Order history status filters', () => {
  test('shows status counts on the filter tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'All 3' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pending 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Processing 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delivered 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelled 0' })).toBeVisible();
  });

  test('filters pending orders and restores all orders', async ({ page }) => {
    await page.getByRole('button', { name: 'Pending 1' }).click();

    await expect(page.locator('.order-card')).toHaveCount(1);
    await expect(page.locator('.order-card')).toContainText('Order #1');
    await expect(page.locator('.order-card')).toContainText('pending');

    await page.getByRole('button', { name: 'All 3' }).click();

    await expect(page.locator('.order-card')).toHaveCount(3);
    await expect(page.locator('.order-card').nth(1)).toContainText('Order #2');
    await expect(page.locator('.order-card').nth(2)).toContainText('Order #3');
  });

  test('filters delivered orders only', async ({ page }) => {
    await page.getByRole('button', { name: 'Delivered 1' }).click();

    await expect(page.locator('.order-card')).toHaveCount(1);
    await expect(page.locator('.order-card')).toContainText('Order #3');
    await expect(page.locator('.order-card')).toContainText('delivered');
  });
});
