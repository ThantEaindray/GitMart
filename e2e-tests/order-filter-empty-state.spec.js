const { test, expect } = require('@playwright/test');

const pendingOrder = {
  id: 41,
  userId: 7,
  status: 'Pending',
  fullName: 'Melissa Reese Halida',
  address: '407B Senja Road',
  unitNumber: '#67-76',
  createdAt: '2026-08-05T09:15:00.000Z',
  totalAmount: 1253.5,
  items: [{ name: 'Montblanc Meisterstuck 149 Fountain Pen', quantity: 1, price: 1150 }],
  statusHistory: [
    {
      status: 'Pending',
      note: 'Order was created after checkout.',
      createdAt: '2026-08-05T09:15:00.000Z',
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

  await page.goto('http://127.0.0.1:3001/html/orders.html');
});

test.describe('Order filter empty states', () => {
  test('shows a contextual message when a selected status has no orders', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Cancelled 0' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancelled 0' }).click();

    await expect(page.locator('.order-card')).toHaveCount(0);
    await expect(page.getByText('No cancelled orders right now.')).toBeVisible();
  });

  test('restores matching orders after leaving an empty filter', async ({ page }) => {
    await page.getByRole('button', { name: 'Delivered 0' }).click();

    await expect(page.locator('.order-card')).toHaveCount(0);
    await expect(page.getByText('No delivered orders yet.')).toBeVisible();

    await page.getByRole('button', { name: 'Pending 1' }).click();

    await expect(page.locator('.order-card')).toHaveCount(1);
    await expect(page.locator('.order-card')).toContainText('Order #41');
  });
});
