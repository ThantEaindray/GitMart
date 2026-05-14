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

function renderProducts(products, title) {
  const grid = document.getElementById('products-grid');
  const sectionTitle = document.getElementById('section-title');

  if (title) sectionTitle.textContent = title;

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
    renderProducts(products, 'Featured Pieces');
  } catch (err) {
    console.error('Could not load products:', err);
    grid.innerHTML = '<p class="status-text">Failed to load products. Please try again later.</p>';
  }
}

async function handleSearch(query) {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '<p class="status-text">Searching…</p>';

  try {
    const products = query ? await searchProducts(query) : await getProducts();
    const title = query ? `Results for "${query}"` : 'Featured Pieces';
    renderProducts(products, title);
  } catch (err) {
    console.error('Search failed:', err);
    grid.innerHTML = '<p class="status-text">Search failed. Please try again.</p>';
  }

  document.getElementById('products-section').scrollIntoView({ behavior: 'smooth' });
}

// ── EVENT HANDLERS ─────────────────────────────────────────────────────────

function handleProductClick(productId) {
  window.location.href = `product.html?id=${productId}`;
}

function handleCartClick() {
  console.log('Cart clicked — coming soon');
}

function handleWishlistClick() {
  console.log('Wishlist clicked — coming soon');
}

function handleSearchClick() {
  const bar = document.getElementById('search-bar');
  const input = document.getElementById('search-input');

  bar.classList.toggle('open');

  if (bar.classList.contains('open')) {
    input.focus();
  } else {
    input.value = '';
    loadProducts();
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-cart').addEventListener('click', handleCartClick);
  document.getElementById('btn-wishlist').addEventListener('click', handleWishlistClick);
  document.getElementById('btn-search').addEventListener('click', handleSearchClick);
  document.getElementById('btn-search-clear').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    loadProducts();
  });
  document.getElementById('btn-shop').addEventListener('click', () => {
    document.getElementById('products-section').scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('btn-explore').addEventListener('click', () => {
    document.getElementById('products-section').scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch(e.target.value.trim());
  });

  loadProducts();
});
