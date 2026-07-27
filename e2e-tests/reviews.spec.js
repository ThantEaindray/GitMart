const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3001';

const REV_SELLER = { username: 'rev_seller', email: 'rev_seller@e2e.com', password: 'RevSeller99' };
const REV_BUYER  = { username: 'rev_buyer',  email: 'rev_buyer@e2e.com',  password: 'RevBuyer99'  };

let sellerToken  = null;
let buyerToken   = null;
let buyerUserId  = null;
let testListingId = null;

// Run all tests serially so shared state (tokens, listing, review) is reliable
test.describe.configure({ mode: 'serial' });

// Sets token + loggedInUserId in localStorage so the page treats the user as authenticated
async function setAuth(page, token, userId) {
  await page.evaluate(
    ({ t, u }) => {
      localStorage.setItem('token', t);
      localStorage.setItem('loggedInUserId', String(u));
    },
    { t: token, u: userId },
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────────
// Register two users and create a listing owned by the seller.
test.beforeAll(async ({ request }) => {
  await request.post(`${BASE}/api/register`, { data: REV_SELLER });
  const sellerLogin = await request.post(`${BASE}/api/login`, {
    data: { username: REV_SELLER.username, password: REV_SELLER.password },
  });
  sellerToken = (await sellerLogin.json()).token;

  await request.post(`${BASE}/api/register`, { data: REV_BUYER });
  const buyerLogin = await request.post(`${BASE}/api/login`, {
    data: { username: REV_BUYER.username, password: REV_BUYER.password },
  });
  const buyerData = await buyerLogin.json();
  buyerToken  = buyerData.token;
  buyerUserId = buyerData.userId;

  const listingRes = await request.post(`${BASE}/api/listings`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
    data: {
      title: 'E2E Review Test Watch',
      description: 'A listing used to test the reviews feature end-to-end.',
      price: 999,
      category: 'Collectibles',
    },
  });
  testListingId = (await listingRes.json()).listing.id;
});

// ── Feature: Reviews – Page load ───────────────────────────────────────────────
test.describe('Reviews – Page load', () => {
  // Valid partition: reviews section is rendered as part of the listing detail page
  test('reviews section is visible on the listing detail page', async ({ page }) => {
    await page.goto(`${BASE}/html/listing.html?id=${testListingId}`);
    await page.waitForSelector('.product-name', { timeout: 8000 });
    await expect(page.locator('#reviews-section')).toBeVisible();
  });

  // Valid partition: GET reviews API returns an empty array for a brand-new listing
  test('API returns an empty reviews array for a new listing', async ({ request }) => {
    const res = await request.get(`${BASE}/api/listings/${testListingId}/reviews`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });
});

// ── Feature: Reviews – Create ──────────────────────────────────────────────────
test.describe('Reviews – Create', () => {
  // Valid partition: a logged-in buyer can select a star rating and submit a review
  test('logged-in buyer can submit a star rating and review', async ({ page }) => {
    await page.goto(`${BASE}/html/listings.html`);
    await setAuth(page, buyerToken, buyerUserId);

    await page.goto(`${BASE}/html/listing.html?id=${testListingId}`);
    await page.waitForSelector('.product-name', { timeout: 8000 });
    await page.waitForSelector('#review-form', { timeout: 5000 });

    // Select 4 stars
    await page.locator('.rv-star[data-value="4"]').click();
    // Fill in a comment
    await page.locator('#review-comment').fill('Great seller, fast shipping!');
    // Submit
    await page.locator('#review-form button[type="submit"]').click();

    // The review should appear in the reviews list
    await expect(page.locator('#reviews-list')).toContainText('Great seller, fast shipping!', {
      timeout: 5000,
    });
  });

  // Valid partition: submitted review persists and is returned by the API
  test('submitted review is returned by the reviews API', async ({ request }) => {
    const res = await request.get(`${BASE}/api/listings/${testListingId}/reviews`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].rating).toBe(4);
    expect(body[0].comment).toBe('Great seller, fast shipping!');
  });
});

// ── Feature: Reviews – Delete ──────────────────────────────────────────────────
test.describe('Reviews – Delete', () => {
  // Valid partition: reviewer can delete their own review and it disappears from the list
  test('reviewer can delete their own review', async ({ page }) => {
    await page.goto(`${BASE}/html/listings.html`);
    await setAuth(page, buyerToken, buyerUserId);

    await page.goto(`${BASE}/html/listing.html?id=${testListingId}`);
    await page.waitForSelector('.product-name', { timeout: 8000 });
    await page.waitForSelector('.rv-card', { timeout: 5000 });

    // Click the Delete button on the buyer's review
    await page.locator('.rv-delete').first().click();

    // The review comment should no longer be visible
    await expect(page.locator('#reviews-list')).not.toContainText('Great seller, fast shipping!', {
      timeout: 5000,
    });
  });
});
