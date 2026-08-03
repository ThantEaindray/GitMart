const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3001';

const NOTIF_USER = {
  username: 'notif_e2e_user',
  email: 'notif_e2e@e2e.com',
  password: 'NotifUser99',
};

let userToken = null;
let userId = null;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await request.post(`${BASE}/api/register`, { data: NOTIF_USER });
  const login = await request.post(`${BASE}/api/login`, {
    data: { username: NOTIF_USER.username, password: NOTIF_USER.password },
  });
  const data = await login.json();
  userToken = data.token;
  userId = data.userId;
});

// Notifications are created through the reservation flow in the app, but these
// tests are about the page rather than how rows arrive, so a second account
// requesting a reservation would be indirection for its own sake. Instead a
// listing is reserved to produce a genuine notification where one is needed.
async function seedNotificationViaReservation(request) {
  const seller = {
    username: `notif_seller_${Date.now()}`,
    email: `notif_seller_${Date.now()}@e2e.com`,
    password: 'NotifSeller99',
  };

  await request.post(`${BASE}/api/register`, { data: seller });
  const sellerLogin = await request.post(`${BASE}/api/login`, {
    data: { username: seller.username, password: seller.password },
  });
  const sellerToken = (await sellerLogin.json()).token;

  // The listing is owned by our test user, so THEY receive the notification.
  const listingRes = await request.post(`${BASE}/api/listings`, {
    headers: { Authorization: `Bearer ${userToken}` },
    data: {
      title: `E2E Notification Listing ${Date.now()}`,
      description: 'Seeded by the notifications end-to-end tests.',
      price: 400,
      category: 'Collectibles',
    },
  });
  const listingId = (await listingRes.json()).listing.id;

  await request.post(`${BASE}/api/listings/${listingId}/reservations`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
}

async function openNotificationsPage(page) {
  await page.goto(`${BASE}/html/listings.html`);
  await page.evaluate(
    ({ t, u }) => {
      localStorage.setItem('token', t);
      localStorage.setItem('loggedInUserId', String(u));
    },
    { t: userToken, u: userId },
  );
  await page.goto(`${BASE}/html/notifications.html`);
}

test.describe('Notifications page', () => {
  test('shows an empty state when there are no notifications', async ({ page, request }) => {
    // Clear anything an earlier test left behind.
    await request.patch(`${BASE}/api/notifications/read-all`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    await openNotificationsPage(page);

    const list = page.locator('#notif-list');
    await expect(list).toBeVisible({ timeout: 10000 });
    // Either the empty state, or previously-read items — never a loading spinner.
    await expect(list).not.toContainText('Loading', { timeout: 10000 });
  });

  test('renders a notification raised by a reservation request', async ({ page, request }) => {
    await seedNotificationViaReservation(request);

    await openNotificationsPage(page);

    const item = page.locator('.notif-item').first();
    await expect(item).toBeVisible({ timeout: 10000 });
    await expect(item).toContainText('New reservation request');
  });

  test('a new notification starts unread', async ({ page, request }) => {
    await seedNotificationViaReservation(request);

    await openNotificationsPage(page);

    await expect(page.locator('.notif-item.unread').first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking a notification marks it read', async ({ page, request }) => {
    await seedNotificationViaReservation(request);

    await openNotificationsPage(page);

    const unread = page.locator('.notif-item.unread').first();
    await expect(unread).toBeVisible({ timeout: 10000 });
    await unread.click();

    // The item gains the read class in place, without a reload.
    await expect(page.locator('.notif-item.read').first()).toBeVisible({ timeout: 10000 });
  });

  test('mark all read clears every unread item', async ({ page, request }) => {
    await seedNotificationViaReservation(request);
    await seedNotificationViaReservation(request);

    await openNotificationsPage(page);
    await expect(page.locator('.notif-item.unread').first()).toBeVisible({ timeout: 10000 });

    await page.click('#btn-mark-all');

    await expect(page.locator('.notif-item.unread')).toHaveCount(0, { timeout: 10000 });
  });

  test('notifications survive a page reload, proving they are persisted', async ({
    page,
    request,
  }) => {
    // The store used to be an in-memory array, so this is the regression guard
    // for the move to Postgres.
    await seedNotificationViaReservation(request);

    await openNotificationsPage(page);
    const before = await page.locator('.notif-item').count();
    expect(before).toBeGreaterThan(0);

    await page.reload();

    await expect(page.locator('.notif-item').first()).toBeVisible({ timeout: 10000 });
    expect(await page.locator('.notif-item').count()).toBe(before);
  });

  test('the nav bell badge reflects the unread count', async ({ page, request }) => {
    await request.patch(`${BASE}/api/notifications/read-all`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    await seedNotificationViaReservation(request);

    await page.goto(`${BASE}/html/listings.html`);
    await page.evaluate(
      ({ t, u }) => {
        localStorage.setItem('token', t);
        localStorage.setItem('loggedInUserId', String(u));
      },
      { t: userToken, u: userId },
    );
    await page.goto(`${BASE}/html/listings.html`);

    const badge = page.locator('.notif-badge');
    await expect(badge).toBeVisible({ timeout: 10000 });
    await expect(badge).not.toHaveText('0');
  });

  test('signed-out visitors are redirected away from the notifications page', async ({ page }) => {
    await page.goto(`${BASE}/html/listings.html`);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE}/html/notifications.html`);

    // authFetch redirects to login when the refresh also fails.
    await page.waitForURL(/login\.html/, { timeout: 10000 });
    expect(page.url()).toContain('login.html');
  });
});
