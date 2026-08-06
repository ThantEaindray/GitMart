const { test, expect } = require('@playwright/test');

const orderWithoutHistory = {
  id: 31,
  userId: 7,
  status: 'Pending',
  fullName: 'Melissa Reese Halida',
  address: '407B Senja Road',
  unitNumber: '#67-76',
  createdAt: '2026-08-03T15:04:00.000Z',
  totalAmount: 1253.5,
  items: [{ name: 'Montblanc Meisterstuck 149 Fountain Pen', quantity: 1, price: 1150 }],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'playwright-test-token');
  });

  await page.route('**/api/orders', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([orderWithoutHistory]),
    });
  });

  await page.goto('http://127.0.0.1:3001/html/orders.html');
});

test.describe('Order status history fallback', () => {
  test('shows current status when detailed status history is missing', async ({ page }) => {
    const orderCard = page.locator('.order-card').first();

    await expect(orderCard).toContainText('Order #31');
    await expect(orderCard.locator('.status-badge')).toHaveText('pending');

    await orderCard.locator('.order-card-header').click();

    await expect(orderCard.getByText('Tracking Timeline')).toBeVisible();
    await expect(orderCard.locator('.timeline-entry')).toHaveCount(1);
    await expect(orderCard.locator('.timeline-entry')).toContainText('Pending');
    await expect(orderCard.locator('.timeline-entry')).toContainText(
      'Tracking started from the current order status.',
    );
  });
});
