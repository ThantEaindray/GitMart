// ── RENDERING ─────────────────────────────────────────────────────────────

function renderStars(rating) {
  const filled = Math.round(rating ?? 0);
  const full  = '<i class="bi bi-star-fill"></i>';
  const empty = '<i class="bi bi-star"></i>';
  return full.repeat(filled) + empty.repeat(5 - filled);
}

function renderProduct(product) {
  const section = document.getElementById('product-detail');

  document.title = `AURUM — ${product.name}`;

  section.innerHTML = `
    <div class="product-img">
      <i class="bi bi-${product.icon ?? 'box-seam'}"></i>
    </div>
    <div class="product-info">
      <div class="card-cat">${product.category}</div>
      <h1 class="product-name">${product.name}</h1>
      <div class="product-price">$${Number(product.price).toLocaleString()}</div>
      <div class="product-rating">
        <span class="stars">${renderStars(product.rating)}</span>
        <span class="rating-count">${product.reviewCount ?? 0} reviews</span>
      </div>
      <p class="product-description">${product.description || ''}</p>
      <div class="product-actions">
        <button class="btn-primary">Add to Cart</button>
        <button class="btn-outline"><i class="bi bi-heart"></i> Wishlist</button>
      </div>
    </div>
  `;
}

// ── DATA LOADING ───────────────────────────────────────────────────────────

async function loadProduct() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    window.location.href = 'noir.html';
    return;
  }

  const section = document.getElementById('product-detail');

  try {
    const product = await getProductById(id);
    renderProduct(product);
  } catch (err) {
    console.error('Could not load product:', err);
    section.innerHTML = `
      <div class="product-error">
        <p class="status-text">Product not found.</p>
        <a href="noir.html" class="breadcrumb-back">
          <i class="bi bi-arrow-left"></i> Back to Store
        </a>
      </div>
    `;
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', loadProduct);
