let allProducts = [];
let activeCategory = '';

// ── RENDERING ──────────────────────────────────────────────────────────────

function renderStars(rating) {
  const filled = Math.round(rating ?? 0);
  const full = '<i class="bi bi-star-fill"></i>';
  const empty = '<i class="bi bi-star"></i>';
  return full.repeat(filled) + empty.repeat(5 - filled);
}

function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = product.id;

  card.innerHTML = `
    <div class="card-img">${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}" loading="lazy" />` : `<i class="bi bi-${product.icon ?? 'box-seam'}"></i>`}</div>
    <div class="card-body">
      <div class="card-cat">${product.category}</div>
      <div class="card-name">${product.name}</div>
      <div class="card-footer">
        <span class="card-price" data-price="${product.price}">${formatPrice(product.price)}</span>
        <span class="card-rating">
          <span class="stars">${renderStars(product.rating)}</span>
          (${product.reviewCount ?? 0})
        </span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => {
    window.location.href = `product.html?id=${product.id}`;
  });
  return card;
}

function renderGrid(products, title) {
  const grid = document.getElementById('products-grid');
  const sectionTitle = document.getElementById('section-title');

  if (title) sectionTitle.textContent = title;
  grid.innerHTML = '';

  if (products.length === 0) {
    grid.innerHTML = '<p class="status-text">No products found.</p>';
    return;
  }

  products.forEach((p) => grid.appendChild(createProductCard(p)));
}

// ── CATEGORY FILTER ────────────────────────────────────────────────────────

function filterByCategory(category) {
  activeCategory = category;

  document.querySelectorAll('.pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.category === category);
  });

  const filtered = category ? allProducts.filter((p) => p.category === category) : allProducts;
  const title = category || 'All Products';
  renderGrid(filtered, title);
}

// ── DATA LOADING ───────────────────────────────────────────────────────────

async function loadProducts() {
  const grid = document.getElementById('products-grid');

  try {
    allProducts = await getProducts();
    renderGrid(allProducts, 'All Products');
  } catch (err) {
    console.error('Could not load products:', err);
    grid.innerHTML = '<p class="status-text">Failed to load products. Please try again later.</p>';
  }
}

async function handleSearch(query) {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '<p class="status-text">Searching…</p>';

  document.querySelectorAll('.pill').forEach((pill) => pill.classList.remove('active'));
  document.querySelector('.pill[data-category=""]').classList.add('active');
  activeCategory = '';

  try {
    const products = query ? await searchProducts(query) : allProducts;
    const title = query ? `Results for "${query}"` : 'All Products';
    renderGrid(products, title);
  } catch (err) {
    console.error('Search failed:', err);
    grid.innerHTML = '<p class="status-text">Search failed. Please try again.</p>';
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-search').addEventListener('click', () => {
    const bar = document.getElementById('search-bar');
    const input = document.getElementById('search-input');
    bar.classList.toggle('open');
    if (bar.classList.contains('open')) input.focus();
    else {
      input.value = '';
      renderGrid(allProducts, activeCategory || 'All Products');
    }
  });

  document.getElementById('btn-search-clear').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    renderGrid(allProducts, activeCategory || 'All Products');
  });

  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch(e.target.value.trim());
  });

  document.getElementById('btn-cart').addEventListener('click', () => {
    window.location.href = 'checkout.html';
  });
  document.getElementById('btn-wishlist').addEventListener('click', () => console.log('Wishlist — coming soon'));

  document.getElementById('category-pills').addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (pill) filterByCategory(pill.dataset.category);
  });

  loadProducts();
});
