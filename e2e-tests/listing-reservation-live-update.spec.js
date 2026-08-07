const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3001';
const uniqueId = `${Date.now()}_${process.pid}`;

const SELLER = {
  username: `live_update_seller_${uniqueId}`,
  email: `live_update_seller_${uniqueId}@e2e.com`,
  password: 'SellerPass99',
};

const BUYER = {
  username: `live_update_buyer_${uniqueId}`,
  email: `live_update_buyer_${uniqueId}@e2e.com`,
  password: 'BuyerPass99',
};

let sellerToken;
let sellerId;
let buyerToken;
let listingId;

async function registerAndLogin(request, user) {
  const registration = await request.post(`${BASE}/api/register`, {
    data: user,
  });

  expect(registration.status()).toBe(201);

  const login = await request.post(`${BASE}/api/login`, {
    data: {
      username: user.username,
      password: user.password,
    },
  });

  expect(login.status()).toBe(200);

  return login.json();
}

test.beforeAll(async ({ request }) => {
  const sellerData = await registerAndLogin(request, SELLER);
  sellerToken = sellerData.token;
  sellerId = sellerData.userId;

  const buyerData = await registerAndLogin(request, BUYER);
  buyerToken = buyerData.token;

  const listingResponse = await request.post(`${BASE}/api/listings`, {
    headers: {
      Authorization: `Bearer ${sellerToken}`,
    },
    data: {
      title: 'Live Update E2E Listing',
      description: 'Listing used for owner reservation-panel live-update testing.',
      price: 500,
      category: 'Collectibles',
    },
  });

  expect(listingResponse.status()).toBe(201);
  listingId = (await listingResponse.json()).listing.id;
});

test.describe('Owner reservation panel live update', () => {
  test('a new reservation request appears without a page reload', async ({ page, request }) => {
    await page.goto(`${BASE}/html/listings.html`);

    await page.evaluate(
      ({ token, userId }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('loggedInUserId', String(userId));
      },
      { token: sellerToken, userId: sellerId },
    );

    await page.goto(`${BASE}/html/listing.html?id=${listingId}`);

    await expect(page.locator('.product-name')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#owner-reservation-panel')).toBeVisible({ timeout: 8000 });

    // No requests yet — confirms the panel we're about to watch update is
    // genuinely starting empty, not already showing a stale/prior card.
    await expect(page.locator('#owner-reservation-list')).toContainText(
      'No reservation requests have been submitted',
      { timeout: 8000 },
    );

    // Give notif-badge.js's deliberately-delayed connectSSE() time to open
    // its stream before the request below fires the push it needs to catch.
    await page.waitForTimeout(700);

    const reservationResponse = await request.post(
      `${BASE}/api/listings/${listingId}/reservations`,
      {
        headers: { Authorization: `Bearer ${buyerToken}` },
        data: { message: 'Live-update test request.' },
      },
    );
    expect(reservationResponse.status()).toBe(201);

    const card = page.locator('.owner-reservation-card').filter({ hasText: BUYER.username });

    // No reload anywhere above this line — the card must be pushed in live.
    await expect(card).toHaveCount(1, { timeout: 8000 });
    await expect(card.locator('.owner-reservation-status')).toHaveText('PENDING');
  });
});
