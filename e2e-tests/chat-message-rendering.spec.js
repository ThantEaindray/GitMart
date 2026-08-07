const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3001';
const uniqueId = `${Date.now()}_${process.pid}`;

const SELLER = {
  username: `chat_render_seller_${uniqueId}`,
  email: `chat_render_seller_${uniqueId}@e2e.com`,
  password: 'SellerPass99',
};

const BUYER = {
  username: `chat_render_buyer_${uniqueId}`,
  email: `chat_render_buyer_${uniqueId}@e2e.com`,
  password: 'BuyerPass99',
};

let sellerId;
let sellerToken;
let buyerId;
let buyerToken;
let chatId;

async function registerAndLogin(request, user) {
  const registration = await request.post(`${BASE}/api/register`, {
    data: user,
  });

  expect(registration.status()).toBe(201);

  const login = await request.post(`${BASE}/api/login`, {
    data: {
      username: user.username,
      password: user.password,
    },
  });

  expect(login.status()).toBe(200);

  return login.json();
}

test.beforeAll(async ({ request }) => {
  const sellerData = await registerAndLogin(request, SELLER);
  sellerToken = sellerData.token;
  sellerId = sellerData.userId;

  const buyerData = await registerAndLogin(request, BUYER);
  buyerToken = buyerData.token;
  buyerId = buyerData.userId;

  const newChat = await request.post(`${BASE}/api/chats/new`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
    data: { id: sellerId },
  });
  expect(newChat.status()).toBe(201);

  const chats = await request.get(`${BASE}/api/chats`, {
    headers: { Authorization: `Bearer ${buyerToken}` },
  });
  expect(chats.status()).toBe(200);

  const chatList = await chats.json();
  chatId = chatList.find((c) => Number(c.toId) === Number(sellerId)).chat;
});

test.describe('Chat message rendering', () => {
  test('a message containing markup is shown as literal text, not rendered HTML', async ({
    page,
    request,
  }) => {
    const payload = '<b>bold</b> & "quotes"';

    const send = await request.post(`${BASE}/api/chats/send`, {
      data: {
        chat: chatId,
        from: buyerId,
        to: sellerId,
        cont_type: 'txt',
        cont: payload,
      },
    });
    expect(send.status()).toBe(201);

    await page.goto(`${BASE}/html/listings.html`);
    await page.evaluate(
      ({ token, userId }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('loggedInUserId', String(userId));
      },
      { token: sellerToken, userId: sellerId },
    );

    await page.goto(`${BASE}/html/chats.html`);
    await page.locator('.chat-item').first().click();

    const bubble = page.locator('.msg-bubble').last();
    await expect(bubble).toBeVisible({ timeout: 8000 });
    await expect(bubble).toHaveText(payload);

    // The unescaped markup must not have become real elements inside the bubble.
    await expect(bubble.locator('b')).toHaveCount(0);
  });
});
