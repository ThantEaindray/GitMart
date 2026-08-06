const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3001';

const RATE_SELLER = {
  username: 'rate_seller',
  email: 'rate_seller@e2e.com',
  password: 'RateSeller99',
};
const RATE_BUYER_A = {
  username: 'rate_buyer_a',
  email: 'rate_buyer_a@e2e.com',
  password: 'RateBuyerA99',
};
const RATE_BUYER_B = {
  username: 'rate_buyer_b',
  email: 'rate_buyer_b@e2e.com',
  password: 'RateBuyerB99',
};

let ratedListingId = null;
let unratedListingId = null;

// Run serially so the reviews exist before any rating assertions run.
test.describe.configure({ mode: 'serial' });

async function registerAndLogin(request, user) {
  await request.post(`${BASE}/api/register`, { data: user });
  const login = await request.post(`${BASE}/api/login`, {
    data: { username: user.username, password: user.password },
  });
  return (await login.json()).token;
}

async function createListing(request, token, title) {
  const res = await request.post(`${BASE}/api/listings`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      description: 'Seeded by the listing ratings end-to-end tests.',
      price: 750,
      category: 'Collectibles',
    },
  });
  return (await res.json()).listing.id;
}

// Two reviews of 4 and 5 average to 4.5, which is distinctive enough that the
// assertion cannot pass by coincidence.
test.beforeAll(async ({ request }) => {
  const sellerToken = await registerAndLogin(request, RATE_SELLER);
  const buyerAToken = await registerAndLogin(request, RATE_BUYER_A);
  const buyerBToken = await registerAndLogin(request, RATE_BUYER_B);

  ratedListingId = await createListing(request, sellerToken, 'E2E Rated Listing');
  unratedListingId = await createListing(request, sellerToken, 'E2E Unrated Listing');

  await request.post(`${BASE}/api/listings/${ratedListingId}/reviews`, {
    headers: { Authorization: `Bearer ${buyerAToken}` },
    data: { rating: 4, comment: 'Good, arrived as described.' },
  });

  await request.post(`${BASE}/api/listings/${ratedListingId}/reviews`, {
    headers: { Authorization: `Bearer ${buyerBToken}` },
    data: { rating: 5, comment: 'Excellent condition.' },
  });
});

test.describe('Listing ratings', () => {
  test('detail page shows the average rating and review count', async ({ page }) => {
    await page.goto(`${BASE}/html/listing.html?id=${ratedListingId}`);

    const rating = page.locator('.product-rating');
    await expect(rating).toBeVisible({ timeout: 5000 });
    await expect(rating).toContainText('4.5');
    await expect(rating).toContainText('2 reviews');
  });

  test('detail page shows no rating block when there are no reviews', async ({ page }) => {
    await page.goto(`${BASE}/html/listing.html?id=${unratedListingId}`);

    await expect(page.locator('.product-name')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.product-rating')).toHaveCount(0);
  });

  test('listing cards show a star summary when reviews exist', async ({ page }) => {
    await page.goto(`${BASE}/html/listings.html?search=E2E Rated Listing`);

    // Asserting on the card directly rather than waiting for the search
    // response: the fetch can complete before a waitForResponse listener is
    // attached, and Playwright already retries this assertion until it holds.
    const card = page.locator('.card', { hasText: 'E2E Rated Listing' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card.locator('.card-rating')).toContainText('4.5');
  });

  test('listing cards omit the star summary when there are no reviews', async ({ page }) => {
    await page.goto(`${BASE}/html/listings.html?search=E2E Unrated Listing`);

    const card = page.locator('.card', { hasText: 'E2E Unrated Listing' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card.locator('.card-rating')).toHaveCount(0);
  });

  test('the average updates after another review is added', async ({ page, request }) => {
    // A third review of 3 moves the average from 4.5 to 4.0, proving the figure
    // is computed rather than cached at creation time.
    const sellerToken = await registerAndLogin(request, {
      username: 'rate_buyer_c',
      email: 'rate_buyer_c@e2e.com',
      password: 'RateBuyerC99',
    });

    await request.post(`${BASE}/api/listings/${ratedListingId}/reviews`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
      data: { rating: 3, comment: 'Fine but slow to post.' },
    });

    await page.goto(`${BASE}/html/listing.html?id=${ratedListingId}`);

    const rating = page.locator('.product-rating');
    await expect(rating).toBeVisible({ timeout: 5000 });
    await expect(rating).toContainText('4.0');
    await expect(rating).toContainText('3 reviews');
  });
});
