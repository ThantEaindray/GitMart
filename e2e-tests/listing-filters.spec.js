const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3001';

const FILTER_SELLER = {
  username: 'filter_seller',
  email: 'filter_seller@e2e.com',
  password: 'FilterSeller99',
};

let sellerToken = null;

// Run serially so the seeded listings exist before any filtering assertions run.
test.describe.configure({ mode: 'serial' });

// Distinct prices and categories so each filter has something unambiguous to bite on.
const SEEDED = [
  { title: 'E2E Filter Cheap Book', price: 15, category: 'Books' },
  { title: 'E2E Filter Mid Fashion', price: 500, category: 'Fashion' },
  { title: 'E2E Filter Pricey Collectible', price: 5000, category: 'Collectibles' },
];

test.beforeAll(async ({ request }) => {
  await request.post(`${BASE}/api/register`, { data: FILTER_SELLER });
  const login = await request.post(`${BASE}/api/login`, {
    data: { username: FILTER_SELLER.username, password: FILTER_SELLER.password },
  });
  sellerToken = (await login.json()).token;

  for (const listing of SEEDED) {
    await request.post(`${BASE}/api/listings`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
      data: {
        title: listing.title,
        description: 'Seeded by the listing filters end-to-end tests.',
        price: listing.price,
        category: listing.category,
      },
    });
  }
});

// Filters are debounced by up to 400ms, so give the grid time to re-render.
// Deliberately not waitForResponse: on a fresh page load the fetch can complete
// before a listener is attached, and the assertions that follow already retry.
async function waitForGrid(page) {
  await page.waitForTimeout(700);
}

test.describe('Listings filters and sort', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/html/listings.html`);
    await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 });
  });

  test('category dropdown narrows the grid to that category', async ({ page }) => {
    await page.selectOption('#category-select', 'Books');
    await waitForGrid(page);

    await expect(page.locator('.card', { hasText: 'E2E Filter Cheap Book' })).toBeVisible();
    await expect(page.locator('.card', { hasText: 'E2E Filter Mid Fashion' })).toHaveCount(0);
    await expect(page.locator('.card', { hasText: 'E2E Filter Pricey Collectible' })).toHaveCount(
      0,
    );
  });

  test('min and max price inputs restrict results to the range', async ({ page }) => {
    await page.fill('#min-price', '100');
    await page.fill('#max-price', '1000');
    await waitForGrid(page);

    await expect(page.locator('.card', { hasText: 'E2E Filter Mid Fashion' })).toBeVisible();
    await expect(page.locator('.card', { hasText: 'E2E Filter Cheap Book' })).toHaveCount(0);
    await expect(page.locator('.card', { hasText: 'E2E Filter Pricey Collectible' })).toHaveCount(
      0,
    );
  });

  test('sort dropdown reorders results by price', async ({ page }) => {
    await page.fill('#search-input', 'E2E Filter');
    await waitForGrid(page);

    await page.selectOption('#sort-select', 'cheapest');
    await waitForGrid(page);
    const ascending = await page.locator('.card .card-name').allTextContents();
    expect(ascending[0]).toContain('Cheap Book');

    await page.selectOption('#sort-select', 'expensive');
    await waitForGrid(page);
    const descending = await page.locator('.card .card-name').allTextContents();
    expect(descending[0]).toContain('Pricey Collectible');
  });

  test('most viewed is an available sort option', async ({ page }) => {
    // Regression guard: the backend SORT_MAP whitelists this value, so a typo
    // in either half would silently fall back to newest. The listener is
    // attached before the action so the request cannot be missed.
    const requestPromise = page.waitForRequest((r) => r.url().includes('sort=most_viewed'));
    await page.selectOption('#sort-select', 'most_viewed');
    const request = await requestPromise;

    expect(request.url()).toContain('sort=most_viewed');
  });

  test('active filter count appears and clears', async ({ page }) => {
    const badge = page.locator('#filter-count');

    await expect(badge).toBeHidden();

    await page.fill('#min-price', '100');
    await waitForGrid(page);
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('1');

    await page.selectOption('#category-select', 'Fashion');
    await waitForGrid(page);
    await expect(badge).toHaveText('2');

    await page.click('#clear-filters');
    await waitForGrid(page);
    await expect(badge).toBeHidden();
  });

  test('clear filters resets every control', async ({ page }) => {
    await page.fill('#search-input', 'E2E Filter');
    await page.fill('#min-price', '100');
    await page.fill('#max-price', '1000');
    await page.selectOption('#category-select', 'Fashion');
    await page.selectOption('#sort-select', 'cheapest');
    await waitForGrid(page);

    await page.click('#clear-filters');
    await waitForGrid(page);

    await expect(page.locator('#search-input')).toHaveValue('');
    await expect(page.locator('#min-price')).toHaveValue('');
    await expect(page.locator('#max-price')).toHaveValue('');
    await expect(page.locator('#category-select')).toHaveValue('');
    await expect(page.locator('#sort-select')).toHaveValue('newest');
  });

  test('filters are reflected in the URL so the view can be shared', async ({ page }) => {
    await page.selectOption('#category-select', 'Books');
    await waitForGrid(page);

    expect(page.url()).toContain('category=Books');
  });

  test('opening a filtered URL restores the controls', async ({ page }) => {
    await page.goto(`${BASE}/html/listings.html?category=Fashion&minPrice=100&sort=cheapest`);
    await waitForGrid(page);

    await expect(page.locator('#category-select')).toHaveValue('Fashion');
    await expect(page.locator('#min-price')).toHaveValue('100');
    await expect(page.locator('#sort-select')).toHaveValue('cheapest');

    await expect(page.locator('.card', { hasText: 'E2E Filter Mid Fashion' })).toBeVisible();
  });
});
