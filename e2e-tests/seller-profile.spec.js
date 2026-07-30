const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3001';

const SP_SELLER = { username: 'sp_seller', email: 'sp_seller@e2e.com', password: 'SpSeller99' };
const SP_BUYER = { username: 'sp_buyer', email: 'sp_buyer@e2e.com', password: 'SpBuyer99' };

let sellerToken = null;
let sellerId = null;
let buyerToken = null;
let testListingId = null;

// Run all tests serially so shared state is reliable
test.describe.configure({ mode: 'serial' });

// ── Setup ──────────────────────────────────────────────────────────────────────
// Register seller + buyer, create a listing, and post a review so the profile
// has content to display.
test.beforeAll(async ({ request }) => {
  await request.post(`${BASE}/api/register`, { data: SP_SELLER });
  const sellerLogin = await request.post(`${BASE}/api/login`, {
    data: { username: SP_SELLER.username, password: SP_SELLER.password },
  });
  const sellerData = await sellerLogin.json();
  sellerToken = sellerData.token;
  sellerId = sellerData.userId;

  await request.post(`${BASE}/api/register`, { data: SP_BUYER });
  const buyerLogin = await request.post(`${BASE}/api/login`, {
    data: { username: SP_BUYER.username, password: SP_BUYER.password },
  });
  buyerToken = (await buyerLogin.json()).token;

  const listingRes = await request.post(`${BASE}/api/listings`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
    data: {
      title: 'SP Test Vintage Watch',
      description: 'A listing for seller profile E2E tests.',
      price: 1200,
      category: 'Collectibles',
    },
  });
  testListingId = (await listingRes.json()).listing.id;

  // Post a review so the reviews section has content
  await request.post(`${BASE}/api/listings/${testListingId}/reviews`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
    data: { rating: 5, comment: 'Excellent seller, highly recommended!' },
  });
});

// ── Feature: Seller Profile – Page load ───────────────────────────────────────
test.describe('Seller Profile – Page load', () => {
  // Valid partition: profile page renders the seller's username
  test('seller profile page shows the seller username', async ({ page }) => {
    await page.goto(`${BASE}/html/seller.html?id=${sellerId}`);
    await page.waitForSelector('#seller-username', { timeout: 8000 });
    await expect(page.locator('#seller-username')).toContainText(SP_SELLER.username);
  });

  // Valid partition: public API returns seller profile data
  test('public profile API returns username and listing count', async ({ request }) => {
    const res = await request.get(`${BASE}/api/users/${sellerId}/public`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.username).toBe(SP_SELLER.username);
    expect(Number(body.listing_count)).toBeGreaterThanOrEqual(1);
  });

  // Valid partition: clicking View Seller on a listing navigates to the profile page
  test('Sold by link on listing detail navigates to seller profile', async ({ page }) => {
    await page.goto(`${BASE}/html/listing.html?id=${testListingId}`);
    await page.waitForSelector('#seller-name-link', { timeout: 8000 });
    await page.locator('#seller-name-link').click();
    await expect(page).toHaveURL(new RegExp(`seller\\.html\\?id=${sellerId}`), { timeout: 5000 });
  });
});

// ── Feature: Seller Profile – Listings ────────────────────────────────────────
test.describe('Seller Profile – Listings', () => {
  // Valid partition: the seller's active listing appears in the profile grid
  test("seller's active listing is shown on their profile", async ({ page }) => {
    await page.goto(`${BASE}/html/seller.html?id=${sellerId}`);
    await page.waitForSelector('#seller-listings-grid .card', { timeout: 8000 });
    await expect(page.locator('#seller-listings-grid')).toContainText('SP Test Vintage Watch');
  });
});

// ── Feature: Seller Profile – Reviews ─────────────────────────────────────────
test.describe('Seller Profile – Reviews', () => {
  // Valid partition: reviews left on the seller's listings appear on their profile
  test("reviews received on seller's listings appear on the profile", async ({ page }) => {
    await page.goto(`${BASE}/html/seller.html?id=${sellerId}`);
    await page.waitForSelector('#seller-reviews-list .sp-rv-card', { timeout: 8000 });
    await expect(page.locator('#seller-reviews-list')).toContainText(
      'Excellent seller, highly recommended!',
    );
  });

  // Valid partition: seller reviews API returns aggregated reviews with listing title
  test('seller reviews API returns reviews joined with listing title', async ({ request }) => {
    const res = await request.get(`${BASE}/api/users/${sellerId}/reviews`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].listing_title).toBe('SP Test Vintage Watch');
    expect(body[0].reviewer_name).toBe(SP_BUYER.username);
  });
});
