const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3001';

const OWNER = {
  username: 'delete_modal_owner',
  email: 'delete_modal_owner@e2e.com',
  password: 'DeleteOwner99',
};

const LISTING_TITLE = 'E2E Delete Modal Listing';

let ownerToken = null;
let ownerUserId = null;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await request.post(`${BASE}/api/register`, { data: OWNER });
  const login = await request.post(`${BASE}/api/login`, {
    data: { username: OWNER.username, password: OWNER.password },
  });
  const data = await login.json();
  ownerToken = data.token;
  ownerUserId = data.userId;

  await request.post(`${BASE}/api/listings`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
    data: {
      title: LISTING_TITLE,
      description: 'Seeded by the delete modal end-to-end tests.',
      price: 250,
      category: 'Collectibles',
    },
  });
});

// The owner controls only render for the logged-in owner, so auth has to be in
// localStorage before the grid renders.
async function openOwnListings(page) {
  await page.goto(`${BASE}/html/listings.html`);
  await page.evaluate(
    ({ t, u }) => {
      localStorage.setItem('token', t);
      localStorage.setItem('loggedInUserId', String(u));
    },
    { t: ownerToken, u: ownerUserId },
  );
  await page.goto(`${BASE}/html/listings.html?search=${encodeURIComponent(LISTING_TITLE)}`);
  await expect(page.locator('.card', { hasText: LISTING_TITLE })).toBeVisible({ timeout: 10000 });
}

test.describe('Delete listing confirmation modal', () => {
  test.beforeEach(async ({ page }) => {
    await openOwnListings(page);
  });

  test('shows only a confirmation, not the edit form', async ({ page }) => {
    // Regression guard for a CSS specificity bug: .listing-modal-fields set
    // display:flex in listings.css, which loads after the .d-none utility and
    // has equal specificity — so hiding the fields via classList had no visual
    // effect and the delete dialog rendered the whole edit form.
    await page.locator('.card', { hasText: LISTING_TITLE }).locator('.btn-delete-listing').click();

    await expect(page.locator('#listingModal')).toBeVisible();
    await expect(page.locator('#listingModalTitle')).toHaveText('Delete Listing');
    await expect(page.locator('#editListingFields')).toBeHidden();
    await expect(page.locator('#editTitle')).toBeHidden();
    await expect(page.locator('#editDescription')).toBeHidden();
    await expect(page.locator('#editPrice')).toBeHidden();
  });

  test('names the listing being deleted', async ({ page }) => {
    await page.locator('.card', { hasText: LISTING_TITLE }).locator('.btn-delete-listing').click();

    await expect(page.locator('#listingModalMessage')).toContainText(LISTING_TITLE);
    await expect(page.locator('#listingModalMessage')).toContainText('cannot be undone');
  });

  test('edit still shows the form, populated with the listing values', async ({ page }) => {
    // The fix must not hide the fields in edit mode.
    await page.locator('.card', { hasText: LISTING_TITLE }).locator('.btn-edit-listing').click();

    await expect(page.locator('#listingModalTitle')).toHaveText('Edit Listing');
    await expect(page.locator('#editListingFields')).toBeVisible();
    await expect(page.locator('#editTitle')).toHaveValue(LISTING_TITLE);
    // NUMERIC(10,2) comes back from Postgres as '250.00', not '250'.
    await expect(page.locator('#editPrice')).toHaveValue('250.00');
  });

  test('switching from edit to delete hides the form again', async ({ page }) => {
    // The original report surfaced this way round: the fields carried stale
    // values from a previous edit, making the delete dialog look like an edit.
    await page.locator('.card', { hasText: LISTING_TITLE }).locator('.btn-edit-listing').click();
    await expect(page.locator('#editListingFields')).toBeVisible();

    await page.click('#btnCancelListingModal');
    await page.locator('.card', { hasText: LISTING_TITLE }).locator('.btn-delete-listing').click();

    await expect(page.locator('#editListingFields')).toBeHidden();
  });

  test('cancel closes the modal without deleting', async ({ page }) => {
    await page.locator('.card', { hasText: LISTING_TITLE }).locator('.btn-delete-listing').click();
    await page.click('#btnCancelListingModal');

    await expect(page.locator('#listingModal')).toBeHidden();
    await expect(page.locator('.card', { hasText: LISTING_TITLE })).toBeVisible();
  });
});
