const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3001';
const uniqueId = `${Date.now()}_${process.pid}`;

const SELLER = {
  username: `decision_seller_${uniqueId}`,
  email: `decision_seller_${uniqueId}@e2e.com`,
  password: 'SellerPass99',
};

const BUYER = {
  username: `decision_buyer_${uniqueId}`,
  email: `decision_buyer_${uniqueId}@e2e.com`,
  password: 'BuyerPass99',
};

let sellerToken;
let sellerId;
let buyerToken;
let acceptanceListingId;
let rejectionListingId;

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

async function createListing(request, title) {
  const response = await request.post(`${BASE}/api/listings`, {
    headers: {
      Authorization: `Bearer ${sellerToken}`,
    },
    data: {
      title,
      description: 'Listing used for owner reservation decision testing.',
      price: 700,
      category: 'Collectibles',
    },
  });

  expect(response.status()).toBe(201);

  return (await response.json()).listing.id;
}

async function createReservation(request, listingId, message) {
  const response = await request.post(`${BASE}/api/listings/${listingId}/reservations`, {
    headers: {
      Authorization: `Bearer ${buyerToken}`,
    },
    data: {
      message,
    },
  });

  expect(response.status()).toBe(201);
}

async function openListingAsSeller(page, listingId) {
  await page.goto(`${BASE}/html/listings.html`);

  await page.evaluate(
    ({ token, userId }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('loggedInUserId', String(userId));
    },
    {
      token: sellerToken,
      userId: sellerId,
    },
  );

  await page.goto(`${BASE}/html/listing.html?id=${listingId}`);

  await expect(page.locator('.product-name')).toBeVisible({
    timeout: 8000,
  });

  await expect(page.locator('#owner-reservation-panel')).toBeVisible({
    timeout: 8000,
  });
}

test.beforeAll(async ({ request }) => {
  const sellerData = await registerAndLogin(request, SELLER);
  sellerToken = sellerData.token;
  sellerId = sellerData.userId;

  const buyerData = await registerAndLogin(request, BUYER);
  buyerToken = buyerData.token;

  acceptanceListingId = await createListing(request, 'Owner Acceptance E2E Listing');

  rejectionListingId = await createListing(request, 'Owner Rejection E2E Listing');

  await createReservation(request, acceptanceListingId, 'Please accept this reservation request.');

  await createReservation(request, rejectionListingId, 'Please review this reservation request.');
});

test.describe('Owner reservation decision workflow', () => {
  test('owner can accept a pending reservation request', async ({ page }) => {
    await openListingAsSeller(page, acceptanceListingId);

    const card = page.locator('.owner-reservation-card').filter({ hasText: BUYER.username });

    await expect(card).toHaveCount(1);
    await expect(card.locator('.owner-reservation-status')).toHaveText('PENDING');

    const responsePromise = page.waitForResponse(
      (response) =>
        /\/api\/reservations\/\d+\/accept$/.test(response.url()) &&
        response.request().method() === 'PATCH',
    );

    await card.getByRole('button', { name: 'Accept', exact: true }).click();

    const response = await responsePromise;
    expect(response.status()).toBe(200);

    await expect(card.locator('.owner-reservation-status')).toHaveText('ACCEPTED', {
      timeout: 8000,
    });

    await expect(page.getByRole('button', { name: 'Release Reservation' })).toBeVisible({
      timeout: 8000,
    });

    await expect(card.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
  });

  test('owner can reject a pending reservation request', async ({ page }) => {
    await openListingAsSeller(page, rejectionListingId);

    const card = page.locator('.owner-reservation-card').filter({ hasText: BUYER.username });

    await expect(card).toHaveCount(1);
    await expect(card.locator('.owner-reservation-status')).toHaveText('PENDING');

    const responsePromise = page.waitForResponse(
      (response) =>
        /\/api\/reservations\/\d+\/reject$/.test(response.url()) &&
        response.request().method() === 'PATCH',
    );

    await card.getByRole('button', { name: 'Reject', exact: true }).click();

    const response = await responsePromise;
    expect(response.status()).toBe(200);

    await expect(card.locator('.owner-reservation-status')).toHaveText('REJECTED', {
      timeout: 8000,
    });

    await expect(page.getByRole('button', { name: 'Mark Reserved' })).toBeVisible();

    await expect(card.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0);
  });
});
