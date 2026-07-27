const { test, expect } = require('@playwright/test');

// ── Helper ───────────────────────────────────────────────
const NEW_SOMETHINGS = ['cheese', 'milk', 'delete-me'];

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3001/html/something.html');
});

/**
 * Fill in the form and submit a new Something.
 * Waits until the table body contains the new name and the input is cleared.
 */
async function addSomething(page, name) {
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(page.locator('#somethingsTableBody')).toContainText(name);
  await expect(page.getByLabel('Name')).toHaveValue('');
}

// ── Page load ────────────────────────────────────────────
test.describe('Page load', () => {
  // Valid partition: page title is visible on load
  test('should display the page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'ST0526 CI/CD Project' })).toBeVisible();
  });

  // Valid partition: form elements are rendered and visible
  test('should display the form with a Name label and Enter button', async ({ page }) => {
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enter' })).toBeVisible();
  });

  // Valid partition: table headers match expected columns
  test('should display the table headers (Id, Name, Action)', async ({ page }) => {
    const headers = page.locator('thead th');
    await expect(headers.nth(0)).toHaveText('Id');
    await expect(headers.nth(1)).toHaveText('Name');
    await expect(headers.nth(2)).toHaveText('Action');
  });
});

// ── Load seeded data ─────────────────────────────────────
test.describe('Load Somethings', () => {
  // Valid partition: seeded data appears in the table on page load
  test('should show seeded rows in the table on page load', async ({ page }) => {
    const rows = page.locator('#somethingsTableBody').getByRole('row');
    await rows.first().waitFor();
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  // Valid partition: each row has the expected structure (Id, Name, Delete button)
  test('each row should have an Id, Name, and Delete button', async ({ page }) => {
    const firstRow = page.locator('#somethingsTableBody').getByRole('row').first();
    await firstRow.waitFor();
    await expect(firstRow.locator('.something-id')).not.toHaveText('');
    await expect(firstRow.locator('.something-name')).not.toHaveText('');
    await expect(firstRow.getByRole('button', { name: 'Delete' })).toBeVisible();
  });
});

// ── Create Something ─────────────────────────────────────
test.describe('New Something', () => {
  // Valid partition: add a single item via the form
  test('should allow me to add a something', async ({ page }) => {
    await addSomething(page, NEW_SOMETHINGS[0]);
  });

  // Valid partition: add multiple items – all appear in the table
  test('should allow me to add multiple somethings', async ({ page }) => {
    await addSomething(page, NEW_SOMETHINGS[0]);
    await addSomething(page, NEW_SOMETHINGS[1]);

    const tableBody = page.locator('#somethingsTableBody');
    await expect(tableBody).toContainText(NEW_SOMETHINGS[0]);
    await expect(tableBody).toContainText(NEW_SOMETHINGS[1]);
  });

  // Valid partition: input field resets after successful submission
  test('should clear the input field after adding', async ({ page }) => {
    await addSomething(page, NEW_SOMETHINGS[0]);
    await expect(page.getByLabel('Name')).toHaveValue('');
  });

  // Boundary: empty name – HTML5 required attribute prevents submission
  test('should not submit when name is empty (HTML5 required validation)', async ({ page }) => {
    const tableBody = page.locator('#somethingsTableBody');
    await tableBody.getByRole('row').first().waitFor();
    const rowsBefore = await tableBody.getByRole('row').count();

    // Attempt to submit the form without filling in the name
    await page.getByRole('button', { name: 'Enter' }).click();

    // No new row should appear
    const rowsAfter = await tableBody.getByRole('row').count();
    expect(rowsAfter).toBe(rowsBefore);
  });

  // Boundary: special characters – XSS payload displayed as escaped text
  test('should handle special characters in the name (XSS boundary)', async ({ page }) => {
    const specialName = '<b>bold</b> & "quotes"';
    await addSomething(page, specialName);

    // Verify it appears as escaped text, not rendered HTML
    const lastRow = page.locator('#somethingsTableBody').getByRole('row').last();
    await expect(lastRow.locator('.something-name')).toHaveText(specialName);
  });
});

// ── Delete Something ─────────────────────────────────────
test.describe('Delete Something', () => {
  // Valid partition: delete a specific item and verify it disappears
  test('should allow me to remove a something', async ({ page }) => {
    // Add one first so we know it exists
    await addSomething(page, NEW_SOMETHINGS[2]);

    // Find the row containing that name and click Delete
    const rows = page.locator('#somethingsTableBody').getByRole('row');
    const targetRow = rows.filter({
      has: page.getByRole('cell', { name: NEW_SOMETHINGS[2], exact: true }),
    });
    await targetRow.getByRole('button', { name: 'Delete' }).click();

    // Confirm it's gone
    await expect(page.locator('#somethingsTableBody')).not.toContainText(NEW_SOMETHINGS[2]);
  });

  // Valid partition: other rows remain unaffected after deleting one
  test('other rows should remain after deleting one', async ({ page }) => {
    // Add two items
    await addSomething(page, 'keep-me');
    await addSomething(page, 'remove-me');

    // Delete only the second one
    const rows = page.locator('#somethingsTableBody').getByRole('row');
    const targetRow = rows.filter({
      has: page.getByRole('cell', { name: 'remove-me', exact: true }),
    });
    await targetRow.getByRole('button', { name: 'Delete' }).click();

    // The first one should still be there
    await expect(page.locator('#somethingsTableBody')).toContainText('keep-me');
    await expect(page.locator('#somethingsTableBody')).not.toContainText('remove-me');
  });

  // Boundary: delete all items – table ends with zero rows
  test('table should be empty after deleting all items (boundary – zero rows)', async ({
    page,
  }) => {
    const tableBody = page.locator('#somethingsTableBody');
    await tableBody.getByRole('row').first().waitFor();

    // Delete every row one by one, waiting for the DOM to update each time
    while ((await tableBody.getByRole('row').count()) > 0) {
      const currentCount = await tableBody.getByRole('row').count();
      await tableBody.getByRole('button', { name: 'Delete' }).first().click();
      await expect(tableBody.getByRole('row')).toHaveCount(currentCount - 1);
    }

    // Table body should have zero rows
    await expect(tableBody.getByRole('row')).toHaveCount(0);
  });
});
