// ── RENDERING ─────────────────────────────────────────────────────────────

function renderStars(rating) {
  const filled = Math.round(rating ?? 0);
  const full  = '<i class="bi bi-star-fill"></i>';
  const empty = '<i class="bi bi-star"></i>';
  return full.repeat(filled) + empty.repeat(5 - filled);
}

function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = product.id;

  card.innerHTML = `
    <div class="card-img"><i class="bi bi-${product.icon ?? 'box-seam'}"></i></div>
    <div class="card-body">
      <div class="card-cat">${product.category}</div>
      <div class="card-name">${product.name}</div>
      <div class="card-footer">
        <span class="card-price">$${Number(product.price).toLocaleString()}</span>
        <span class="card-rating">
          <span class="stars">${renderStars(product.rating)}</span>
          (${product.reviewCount ?? 0})
        </span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => handleProductClick(product.id));
  return card;
}

function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';

  if (products.length === 0) {
    grid.innerHTML = '<p class="status-text">No products found.</p>';
    return;
  }

  products.forEach((product) => grid.appendChild(createProductCard(product)));
}

// ── DATA LOADING ───────────────────────────────────────────────────────────

async function loadProducts() {
  const grid = document.getElementById('products-grid');

  try {
    const products = await getProducts();
    renderProducts(products);
  } catch (err) {
    console.error('Could not load products:', err);
    grid.innerHTML = '<p class="status-text">Failed to load products. Please try again later.</p>';
  }
}

// ── EVENT HANDLERS ─────────────────────────────────────────────────────────

function handleProductClick(productId) {
  // TODO: navigate to product detail page or open a modal
  console.log('Product clicked:', productId);
}

function handleCartClick() {
  // Redirect user to checkout page
  window.location.href = '/html/checkout.html';
}

function handleWishlistClick() {
  // TODO: open wishlist panel — call getWishlist() and render results
  console.log('Wishlist clicked');
}

function handleSearchClick() {
  // TODO: show search input, then call searchProducts(query) on submit
  console.log('Search clicked');
}

// ── INIT ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-cart').addEventListener('click', handleCartClick);
  document.getElementById('btn-wishlist').addEventListener('click', handleWishlistClick);
  document.getElementById('btn-search').addEventListener('click', handleSearchClick);

  loadProducts();
});
