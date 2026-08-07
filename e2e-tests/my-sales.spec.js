const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3001';
const uniqueId = `${Date.now()}_${process.pid}`;

const SELLER = {
  username: `sales_page_seller_${uniqueId}`,
  email: `sales_page_seller_${uniqueId}@e2e.com`,
  password: 'SellerPass99',
};

const BUYER = {
  username: `sales_page_buyer_${uniqueId}`,
  email: `sales_page_buyer_${uniqueId}@e2e.com`,
  password: 'BuyerPass99',
};

let sellerId;
let sellerToken;
let buyerToken;
let listingId;

async function registerAndLogin(request, user) {
  const registration = await request.post(`${BASE}/api/register`, { data: user });
  expect(registration.status()).toBe(201);

  const login = await request.post(`${BASE}/api/login`, {
    data: { username: user.username, password: user.password },
  });
  expect(login.status()).toBe(200);

  return login.json();
}

async function loginAsSeller(page) {
  await page.goto(`${BASE}/html/listings.html`);
  await page.evaluate(
    ({ token, userId }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('loggedInUserId', String(userId));
    },
    { token: sellerToken, userId: sellerId },
  );
}

test.beforeAll(async ({ request }) => {
  const sellerData = await registerAndLogin(request, SELLER);
  sellerToken = sellerData.token;
  sellerId = sellerData.userId;

  const buyerData = await registerAndLogin(request, BUYER);
  buyerToken = buyerData.token;

  const listingResponse = await request.post(`${BASE}/api/listings`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
    data: {
      title: 'My Sales E2E Listing',
      description: 'Listing used for the My Sales page test.',
      price: 250,
      category: 'Electronics',
    },
  });
  expect(listingResponse.status()).toBe(201);
  listingId = (await listingResponse.json()).listing.id;

  const reservation = await request.post(`${BASE}/api/listings/${listingId}/reservations`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
    data: { message: 'Interested in this listing.' },
  });
  expect(reservation.status()).toBe(201);
  const reservationId = (await reservation.json()).reservation.id;

  const accept = await request.patch(`${BASE}/api/reservations/${reservationId}/accept`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  });
  expect(accept.status()).toBe(200);
});

test.describe('My Sales page', () => {
  test("shows an order that included the seller's listing, with the buyer and item", async ({
    page,
    request,
  }) => {
    const order = await request.post(`${BASE}/api/orders`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
      data: {
        fullName: 'Sales Page Buyer',
        emailAddress: 'sales.page.buyer@example.com',
        phoneNumber: '+65 9123 4567',
        address: '1 Test Street',
        unitNumber: '#01-01',
        postalCode: '123456',
        deliveryMethod: 'Standard',
        paymentMethod: 'Card',
        items: [
          { listingId, name: 'My Sales E2E Listing', price: 250, quantity: 1, isOneOff: true },
        ],
      },
    });
    expect(order.status()).toBe(201);

    await loginAsSeller(page);
    await page.goto(`${BASE}/html/my-sales.html`);

    const card = page.locator('.order-card').first();
    await expect(card).toBeVisible({ timeout: 8000 });
    await expect(card).toContainText('Sales Page Buyer');

    await card.locator('.order-card-header').click();
    await expect(card.locator('.order-item-name')).toHaveText('My Sales E2E Listing');
  });

  test('signed-out visitors are redirected away from the my sales page', async ({ page }) => {
    await page.goto(`${BASE}/html/listings.html`);
    await page.evaluate(() => localStorage.clear());

    await page.goto(`${BASE}/html/my-sales.html`);
    await expect(page).toHaveURL(/login\.html/, { timeout: 8000 });
  });
});
