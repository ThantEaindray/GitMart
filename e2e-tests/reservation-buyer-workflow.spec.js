const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3001';
const uniqueId = Date.now();

const SELLER = {
  username: `reservation_seller_${uniqueId}`,
  email: `reservation_seller_${uniqueId}@e2e.com`,
  password: 'SellerPass99',
};

const BUYER = {
  username: `reservation_buyer_${uniqueId}`,
  email: `reservation_buyer_${uniqueId}@e2e.com`,
  password: 'BuyerPass99',
};

let sellerToken;
let buyerToken;
let buyerId;
let listingId;

test.describe.configure({ mode: 'serial' });

async function setAuth(page) {
  await page.goto(`${BASE}/html/listings.html`);

  await page.evaluate(
    ({ token, userId }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('loggedInUserId', String(userId));
    },
    {
      token: buyerToken,
      userId: buyerId,
    },
  );
}

async function openListingAsBuyer(page) {
  await setAuth(page);
  await page.goto(`${BASE}/html/listing.html?id=${listingId}`);
  await expect(page.locator('.product-name')).toBeVisible({
    timeout: 8000,
  });
}

test.beforeAll(async ({ request }) => {
  const sellerRegister = await request.post(`${BASE}/api/register`, {
    data: SELLER,
  });
  expect(sellerRegister.status()).toBe(201);

  const sellerLogin = await request.post(`${BASE}/api/login`, {
    data: {
      username: SELLER.username,
      password: SELLER.password,
    },
  });
  expect(sellerLogin.status()).toBe(200);
  sellerToken = (await sellerLogin.json()).token;

  const buyerRegister = await request.post(`${BASE}/api/register`, {
    data: BUYER,
  });
  expect(buyerRegister.status()).toBe(201);

  const buyerLogin = await request.post(`${BASE}/api/login`, {
    data: {
      username: BUYER.username,
      password: BUYER.password,
    },
  });
  expect(buyerLogin.status()).toBe(200);

  const buyerData = await buyerLogin.json();
  buyerToken = buyerData.token;
  buyerId = buyerData.userId;

  const listingResponse = await request.post(`${BASE}/api/listings`, {
    headers: {
      Authorization: `Bearer ${sellerToken}`,
    },
    data: {
      title: 'Reservation E2E Test Listing',
      description: 'Listing used for buyer reservation workflow testing.',
      price: 650,
      category: 'Collectibles',
    },
  });

  expect(listingResponse.status()).toBe(201);
  listingId = (await listingResponse.json()).listing.id;
});

test.describe('Buyer reservation workflow', () => {
  test('buyer can submit a reservation request', async ({ page }) => {
    await openListingAsBuyer(page);

    const button = page.locator('#btn-request-reservation');

    await expect(button).toContainText('Request Reservation', {
      timeout: 8000,
    });

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/listings/${listingId}/reservations`) &&
        response.request().method() === 'POST',
    );

    await button.click();
    const response = await responsePromise;

    expect(response.status()).toBe(201);

    await expect(button).toContainText('Cancel Reservation Request', {
      timeout: 8000,
    });
  });

  test('pending cancellation state survives page refresh', async ({ page }) => {
    await openListingAsBuyer(page);

    await expect(page.locator('#btn-request-reservation')).toContainText(
      'Cancel Reservation Request',
      { timeout: 8000 },
    );

    await page.reload();

    await expect(page.locator('#btn-request-reservation')).toContainText(
      'Cancel Reservation Request',
      { timeout: 8000 },
    );
  });

  test('buyer can cancel the pending reservation request', async ({ page }) => {
    await openListingAsBuyer(page);

    const button = page.locator('#btn-request-reservation');

    await expect(button).toContainText('Cancel Reservation Request', {
      timeout: 8000,
    });

    const responsePromise = page.waitForResponse(
      (response) =>
        /\/api\/reservations\/\d+\/cancel$/.test(response.url()) &&
        response.request().method() === 'PATCH',
    );

    await button.click();
    const response = await responsePromise;

    expect(response.status()).toBe(200);

    await expect(button).toContainText('Request Reservation', {
      timeout: 8000,
    });
  });
});
