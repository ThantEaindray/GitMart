const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3001';

const SETTINGS_USER = {
  username: 'settings_e2e_user',
  email: 'settings_e2e@e2e.com',
  password: 'SettingsUser99',
};

let userToken = null;
let userId = null;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await request.post(`${BASE}/api/register`, { data: SETTINGS_USER });
  const login = await request.post(`${BASE}/api/login`, {
    data: { username: SETTINGS_USER.username, password: SETTINGS_USER.password },
  });
  const data = await login.json();
  userToken = data.token;
  userId = data.userId;
});

async function openSettings(page) {
  await page.goto(`${BASE}/html/listings.html`);
  await page.evaluate(
    ({ t, u }) => {
      localStorage.setItem('token', t);
      localStorage.setItem('loggedInUserId', String(u));
    },
    { t: userToken, u: userId },
  );
  await page.goto(`${BASE}/html/settings.html`);

  // The notification toggles live in the Preferences tab, which is not the one
  // shown on load — without this the controls are in the DOM but not visible,
  // so any click on them times out.
  await page.click('.tab-btn[data-tab="preferences"]');
  await expect(page.locator('#tab-preferences')).toHaveClass(/active/, { timeout: 10000 });
  await expect(page.locator('label.toggle:has(#toggle-notify-email)')).toBeVisible({
    timeout: 10000,
  });
}

// Reads the flag straight from the API rather than the DOM, so the assertion
// proves the change was actually persisted.
async function readStoredPreference(request) {
  const response = await request.get(`${BASE}/api/me/settings`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  return (await response.json()).notify_email;
}

// The checkbox itself is display:none — the visible control is the sibling
// slider span — so check()/uncheck() cannot act on it. Clicking the wrapping
// label is both what a real user does and what fires the change listener.
async function setToggle(page, inputId, desired) {
  const input = page.locator(`#${inputId}`);
  if ((await input.isChecked()) === desired) return;
  await page.locator(`label.toggle:has(#${inputId})`).click();
  await expect(input).toBeChecked({ checked: desired });
}

test.describe('Settings — email notifications toggle', () => {
  test('the toggle is present and defaults to on', async ({ page }) => {
    await openSettings(page);

    // notify_email defaults to true in the schema, so a new account arrives
    // opted in.
    await expect(page.locator('#toggle-notify-email')).toBeChecked();
  });

  test('turning it off persists to the account', async ({ page, request }) => {
    await openSettings(page);

    await setToggle(page, 'toggle-notify-email', false);

    await expect.poll(() => readStoredPreference(request), { timeout: 10000 }).toBe(false);
  });

  test('the off state is restored on reload', async ({ page }) => {
    await openSettings(page);

    await expect(page.locator('#toggle-notify-email')).not.toBeChecked();
  });

  test('turning it back on persists too', async ({ page, request }) => {
    await openSettings(page);

    await setToggle(page, 'toggle-notify-email', true);

    await expect.poll(() => readStoredPreference(request), { timeout: 10000 }).toBe(true);
  });

  test('the email toggle does not disturb the other notification preferences', async ({
    page,
    request,
  }) => {
    await openSettings(page);

    // Put the other two into a known, non-default state first.
    await setToggle(page, 'toggle-notify-orders', false);
    await setToggle(page, 'toggle-notify-promotions', true);
    await page.waitForTimeout(500);

    await setToggle(page, 'toggle-notify-email', false);
    await page.waitForTimeout(500);

    const response = await request.get(`${BASE}/api/me/settings`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const settings = await response.json();

    expect(settings.notify_email).toBe(false);
    expect(settings.notify_orders).toBe(false);
    expect(settings.notify_promotions).toBe(true);
  });
});
