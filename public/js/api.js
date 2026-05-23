// Change this if the backend is hosted at a different origin (e.g. 'http://localhost:3000')
const API_BASE = '';

// ── PRODUCTS ──────────────────────────────────────────────────────────────

/**
 * GET /products
 * TODO: confirm exact endpoint with backend team once routes are pushed
 * Expected response shape:
 *   [{ id, name, category, price, rating, reviewCount, icon }, ...]
 */
async function getProducts() {
  const res = await fetch(`${API_BASE}/products`);
  if (!res.ok) throw new Error(`Failed to fetch products (${res.status})`);
  return res.json();
}

/**
 * GET /products/:id
 * Expected response shape:
 *   { id, name, category, price, rating, reviewCount, icon, description }
 */
async function getProductById(id) {
  const res = await fetch(`${API_BASE}/products/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch product ${id} (${res.status})`);
  return res.json();
}

/**
 * GET /products?search=<query>
 * TODO: confirm query param name with backend team
 * Expected response shape: same as getProducts()
 */
async function searchProducts(query) {
  const params = new URLSearchParams({ search: query });
  const res = await fetch(`${API_BASE}/products?${params}`);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return res.json();
}

async function getProductsByCategory(category, excludeId) {
  const params = new URLSearchParams({ category, exclude: excludeId });
  const res = await fetch(`${API_BASE}/products?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch category (${res.status})`);
  return res.json();
}

// ── CART ──────────────────────────────────────────────────────────────────

/**
 * GET /cart
 * TODO: confirm auth strategy with backend team (session cookie, token header, etc.)
 * Expected response shape:
 *   { items: [{ id, productId, name, price, quantity }], total }
 */
async function getCart() {
  const res = await fetch(`${API_BASE}/cart`);
  if (!res.ok) throw new Error(`Failed to fetch cart (${res.status})`);
  return res.json();
}

/**
 * POST /cart/items
 * TODO: confirm endpoint and body shape with backend team
 * Body: { productId, quantity }
 */
async function addToCart(productId, quantity = 1) {
  const res = await fetch(`${API_BASE}/cart/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, quantity }),
  });
  if (!res.ok) throw new Error(`Failed to add to cart (${res.status})`);
  return res.json();
}

/**
 * DELETE /cart/items/:itemId
 * TODO: confirm whether this uses cart item ID or product ID
 */
async function removeFromCart(itemId) {
  const res = await fetch(`${API_BASE}/cart/items/${itemId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to remove from cart (${res.status})`);
  return res.json();
}

// ── WISHLIST ──────────────────────────────────────────────────────────────

/**
 * GET /wishlist
 * Expected response shape:
 *   [{ id, productId, name, price, icon }, ...]
 */
async function getWishlist() {
  const res = await fetch(`${API_BASE}/wishlist`);
  if (!res.ok) throw new Error(`Failed to fetch wishlist (${res.status})`);
  return res.json();
}

/**
 * POST /wishlist
 * Toggles a product on/off the wishlist.
 * TODO: confirm whether backend uses POST/DELETE or a toggle endpoint
 * Body: { productId }
 */
async function toggleWishlist(productId) {
  const res = await fetch(`${API_BASE}/wishlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId }),
  });
  if (!res.ok) throw new Error(`Failed to update wishlist (${res.status})`);
  return res.json();
}

// ── PREFERENCES ───────────────────────────────────────────────────────────

const CURRENCIES = {
  USD: { symbol: '$',  rate: 1    },
  SGD: { symbol: 'S$', rate: 1.35 },
  EUR: { symbol: '€',  rate: 0.92 },
  GBP: { symbol: '£',  rate: 0.79 },
};

function formatPrice(usdAmount) {
  const code = localStorage.getItem('currency') || 'USD';
  const { symbol, rate } = CURRENCIES[code] || CURRENCIES.USD;
  return `${symbol}${(usdAmount * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  document.querySelectorAll('[data-price]').forEach((el) => {
    el.textContent = formatPrice(Number(el.dataset.price));
  });
});

// ── AUTH FETCH ────────────────────────────────────────────────────────────
// Drop-in replacement for fetch() on authenticated endpoints.
// If the server returns 401 (expired access token), silently calls
// POST /api/refresh (the httpOnly refresh cookie is sent automatically),
// stores the new access token, then retries the original request once.
// If the refresh also fails, clears localStorage and redirects to login.

async function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const opts = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  let response = await fetch(url, opts);

  if (response.status !== 401) return response;

  // Access token expired — try to refresh
  const refreshRes = await fetch('/api/refresh', { method: 'POST' });

  if (!refreshRes.ok) {
    localStorage.removeItem('token');
    localStorage.removeItem('loggedInUserId');
    localStorage.removeItem('username');
    localStorage.removeItem('isStaff');
    window.location.href = '/html/login.html';
    return refreshRes;
  }

  const { token: newToken } = await refreshRes.json();
  localStorage.setItem('token', newToken);

  // Retry original request with the new token
  opts.headers.Authorization = `Bearer ${newToken}`;
  response = await fetch(url, opts);
  return response;
}

// ── SESSION TIMER ─────────────────────────────────────────────────────────
// Reads the access token expiry, sets a timer to refresh just before it
// expires. If the refresh fails (refresh token gone/expired), logs out.

function scheduleTokenRefresh() {
  const token = localStorage.getItem('token');
  if (!token) return;

  let payload;
  try {
    const base64url = token.split('.')[1];
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    payload = JSON.parse(atob(base64));
  } catch {
    return;
  }

  const msUntilExpiry = payload.exp * 1000 - Date.now() - 1000;

  if (msUntilExpiry <= 0) {
    handleTokenExpiry();
    return;
  }

  setTimeout(handleTokenExpiry, msUntilExpiry);
}

async function handleTokenExpiry() {
  const refreshRes = await fetch('/api/refresh', { method: 'POST' });

  if (!refreshRes.ok) {
    localStorage.removeItem('token');
    localStorage.removeItem('loggedInUserId');
    localStorage.removeItem('username');
    localStorage.removeItem('isStaff');
    window.location.href = '/html/login.html';
    return;
  }

  const { token: newToken } = await refreshRes.json();
  localStorage.setItem('token', newToken);
  scheduleTokenRefresh();
}

// ── NAV AUTH ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  scheduleTokenRefresh();

  const accountBtn = document.getElementById('btn-account');
  if (!accountBtn) return;

  if (localStorage.getItem('token')) {
    accountBtn.href = 'profile.html';
    accountBtn.title = 'Profile';
    accountBtn.querySelector('i').className = 'bi bi-person-circle';
  }
});
