const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3001';

const E2E_SELLER = { username: 'e2e_seller', email: 'seller@e2e.com', password: 'SellerPass99' };
const E2E_BUYER = { username: 'e2e_buyer', email: 'buyer@e2e.com', password: 'BuyerPass99' };

let sellerToken = null;
let buyerToken = null;
let testListingId = null;

// Run all tests serially so shared state (token, listingId) is reliable
test.describe.configure({ mode: 'serial' });

// ── Setup ─────────────────────────────────────────────────────────────────────
// Create two users and one listing before all tests run.
// Seller owns the listing; Buyer is used to test wishlist / non-owner flows.
test.beforeAll(async ({ request }) => {
  await request.post(`${BASE}/api/register`, { data: E2E_SELLER });
  const sellerLogin = await request.post(`${BASE}/api/login`, {
    data: { username: E2E_SELLER.username, password: E2E_SELLER.password },
  });
  sellerToken = (await sellerLogin.json()).token;

  await request.post(`${BASE}/api/register`, { data: E2E_BUYER });
  const buyerLogin = await request.post(`${BASE}/api/login`, {
    data: { username: E2E_BUYER.username, password: E2E_BUYER.password },
  });
  buyerToken = (await buyerLogin.json()).token;

  const listingRes = await request.post(`${BASE}/api/listings`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
    data: {
      title: 'E2E Rolex Submariner',
      description: 'A classic dive watch for E2E testing',
      price: 8500,
      category: 'Watches',
    },
  });
  testListingId = (await listingRes.json()).listing.id;
});

// Sets a JWT token in localStorage so the page treats the user as logged in.
async function setToken(page, token) {
  await page.evaluate((t) => localStorage.setItem('token', t), token);
}

// ── Feature 1: Listings Browse ────────────────────────────────────────────────
// Validates that users can discover and navigate listings.
test.describe('Listings Browse', () => {
  // Valid partition: page loads and the listing we created is rendered as a card
  test('listings page loads and displays listing cards', async ({ page }) => {
    await page.goto(`${BASE}/html/listings.html`);
    await page.waitForSelector('#listingsGrid .card', { timeout: 8000 });
    await expect(page.locator('#listingsGrid .card').first()).toBeVisible();
  });

  // Valid partition: search input is present and accepts text input
  test('search input is visible and accepts text', async ({ page }) => {
    await page.goto(`${BASE}/html/listings.html`);
    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Rolex');
    await expect(searchInput).toHaveValue('Rolex');
  });

  // Valid partition: clicking a card navigates to the listing detail page
  test('clicking a listing card navigates to the detail page', async ({ page }) => {
    await page.goto(`${BASE}/html/listings.html`);
    await page.waitForSelector('#listingsGrid .card', { timeout: 8000 });
    await page.locator('#listingsGrid .card').first().click();
    await expect(page).toHaveURL(/listing\.html\?id=/, { timeout: 5000 });
  });
});

// ── Feature 2: Listing Detail ─────────────────────────────────────────────────
// Validates that the detail page correctly renders listing information.
test.describe('Listing Detail', () => {
  // Valid partition: the title we created is shown on the detail page
  test('detail page loads and shows the listing title', async ({ page }) => {
    await page.goto(`${BASE}/html/listing.html?id=${testListingId}`);
    await page.waitForSelector('.product-name', { timeout: 8000 });
    await expect(page.locator('.product-name')).toContainText('E2E Rolex Submariner');
  });

  // Valid partition: price is rendered on the detail page
  test('detail page shows the listing price', async ({ page }) => {
    await page.goto(`${BASE}/html/listing.html?id=${testListingId}`);
    await page.waitForSelector('.product-price', { timeout: 8000 });
    await expect(page.locator('.product-price')).toBeVisible();
  });

  // Valid partition: breadcrumb back link returns to the listings page
  test('breadcrumb back link navigates to listings page', async ({ page }) => {
    await page.goto(`${BASE}/html/listing.html?id=${testListingId}`);
    await page.waitForSelector('.breadcrumb-back', { timeout: 8000 });
    await page.locator('.breadcrumb-back').click();
    await expect(page).toHaveURL(/listings\.html/);
  });
});

// ── Feature 3: Authentication ─────────────────────────────────────────────────
// Validates the login flow: form presence, error handling, and successful auth.
test.describe('Authentication', () => {
  // Valid partition: login form has all required fields
  test('login page shows username, password fields and submit button', async ({ page }) => {
    await page.goto(`${BASE}/html/login.html`);
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  // Error partition: unknown username returns 404 and shows a field-level error
  test('wrong credentials show an error message', async ({ page }) => {
    await page.goto(`${BASE}/html/login.html`);
    await page.locator('#username').fill('nobody');
    await page.locator('#password').fill('wrongpass');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('#username')).toHaveClass(/input-error/, { timeout: 5000 });
  });

  // Valid partition: correct credentials store the token in localStorage
  test('valid login stores token in localStorage', async ({ page }) => {
    await page.goto(`${BASE}/html/login.html`);
    await page.locator('#username').fill(E2E_BUYER.username);
    await page.locator('#password').fill(E2E_BUYER.password);
    await page.locator('button[type="submit"]').click();
    // Wait for redirect away from login
    await page.waitForURL((url) => !url.toString().includes('login.html'), { timeout: 5000 });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).not.toBeNull();
  });
});

// ── Feature 4: Wishlist ───────────────────────────────────────────────────────
// Validates wishlist access controls and the heart button UX on listing detail.
test.describe('Wishlist', () => {
  // Valid partition: wishlist nav button is present on every page
  test('wishlist nav button is visible in the navigation', async ({ page }) => {
    await page.goto(`${BASE}/html/listings.html`);
    await expect(page.locator('#btn-wishlist')).toBeVisible();
  });

  // Valid partition: wishlist page renders the "My Wishlist" section heading
  test('wishlist page renders the wishlist section', async ({ page }) => {
    await page.goto(`${BASE}/html/listings.html`);
    await setToken(page, buyerToken);
    await page.goto(`${BASE}/html/wishlist.html`);
    await expect(page.locator('.section-title')).toContainText('Wishlist');
  });

  // Valid partition: non-owner sees the heart button; owner does not
  test('heart button is visible for a non-owner on listing detail', async ({ page }) => {
    await page.goto(`${BASE}/html/listing.html?id=${testListingId}`);
    await setToken(page, buyerToken);
    await page.reload();
    await page.waitForSelector('.product-name', { timeout: 8000 });
    await expect(page.locator('#btn-detail-heart')).toBeVisible();
  });
});

// ── Feature 5: Recently Viewed ────────────────────────────────────────────────
// Validates that viewed listings are tracked and surfaced back to the user.
test.describe('Recently Viewed', () => {
  // Valid partition: recently-viewed section is hidden before any views
  test('recently-viewed section is hidden when user has no history', async ({ page }) => {
    await page.goto(`${BASE}/html/listings.html`);
    // No token set — section must stay hidden
    await page.waitForSelector('#listingsGrid', { timeout: 8000 });
    await expect(page.locator('#recently-viewed-section')).toBeHidden();
  });

  // Valid partition: API returns 200 when a logged-in user views a listing
  test('viewing a listing while logged in returns a successful response', async ({ request }) => {
    const res = await request.get(`${BASE}/api/listings/${testListingId}`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(testListingId);
  });

  // Valid partition: recently-viewed section appears on listings page after viewing
  test('recently-viewed section appears after viewing a listing while logged in', async ({
    page,
  }) => {
    // Set buyer token so views are attributed
    await page.goto(`${BASE}/html/listings.html`);
    await setToken(page, buyerToken);

    // Visit the listing detail — this triggers view recording
    await page.goto(`${BASE}/html/listing.html?id=${testListingId}`);
    await page.waitForSelector('.product-name', { timeout: 8000 });

    // Return to listings — recently-viewed section should now be visible
    await page.goto(`${BASE}/html/listings.html`);
    await page.waitForSelector('#recently-viewed-section', { timeout: 8000 });
    await expect(page.locator('#recently-viewed-section')).toBeVisible();
  });
});
