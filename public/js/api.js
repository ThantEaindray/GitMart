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
