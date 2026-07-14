

function renderStars(rating) {
  const filled = Math.round(rating ?? 0);
  const full = '<i class="bi bi-star-fill"></i>';
  const empty = '<i class="bi bi-star"></i>';
  return full.repeat(filled) + empty.repeat(5 - filled);
}

function renderProduct(product) {
  const section = document.getElementById('product-detail');
  document.title = `GitMart — ${product.name}`;

  const isPurchased = product.isSold;
  const cartButton = isPurchased
    ? '<button class="btn-primary btn-unavailable" id="addToCartButton" disabled>Sold Out</button>'
    : '<button class="btn-primary" id="addToCartButton">Add to Cart</button>';

  section.innerHTML = `
    <div class="product-img">
      ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}" loading="lazy" />` : `<i class="bi bi-${product.icon ?? 'box-seam'}"></i>`}
    </div>
    <div class="product-info">
      <div class="card-cat">${product.category}</div>
      <h1 class="product-name">${product.name}</h1>
      <div class="product-price" data-price="${product.price}">${formatPrice(product.price)}</div>
      <div class="product-rating">
        <span class="stars">${renderStars(product.rating)}</span>
        <span class="rating-count">${product.reviewCount ?? 0} reviews</span>
      </div>
      <p class="product-description">${product.description || ''}</p>
      <div class="product-actions">
        ${cartButton}
        <button class="btn-outline"><i class="bi bi-heart"></i> Wishlist</button>
      </div>
    </div>
  `;

  if (!isPurchased) {
    document
      .getElementById('addToCartButton')
      .addEventListener('click', () => addProductToCart(product));
  }
}

function addProductToCart(product) {
  if (product.isSold) return;

  let cart;

  try {
    const storedCart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart = Array.isArray(storedCart) ? storedCart : storedCart.items || [];
  } catch {
    cart = [];
  }

  const existingItem = cart.find(
    (item) => String(item.id ?? item.productId) === String(product.id),
  );

  if (existingItem) {
    existingItem.quantity = Number(existingItem.quantity ?? 1) + 1;
  } else {
    cart.push({
      id: product.id,
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: 1,
    });
  }

  localStorage.setItem('cart', JSON.stringify(cart));
}

function renderRelated(products) {
  const section = document.getElementById('related-section');
  if (!section) return;

  if (products.length === 0) {
    section.style.display = 'none';
    return;
  }

  const cards = products
    .map(
      (p) => `
    <div class="card" onclick="window.location.href='product.html?id=${p.id}'">
      <div class="card-img">${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}" loading="lazy" />` : `<i class="bi bi-${p.icon ?? 'box-seam'}"></i>`}</div>
      <div class="card-body">
        <div class="card-cat">${p.category}</div>
        <div class="card-name">${p.name}</div>
        <div class="card-footer">
          <span class="card-price" data-price="${p.price}">${formatPrice(p.price)}</span>
          <span class="card-rating">
            <span class="stars">${renderStars(p.rating)}</span>
            (${p.reviewCount ?? 0})
          </span>
        </div>
      </div>
    </div>
  `,
    )
    .join('');

  section.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">You May Also Like</h2>
    </div>
    <div class="products">${cards}</div>
  `;
}

async function loadProduct() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    window.location.href = 'products.html';
    return;
  }

  const section = document.getElementById('product-detail');

  try {
    const product = await getProductById(id);
    renderProduct(product);
    loadRelated(product.category, product.id);
  } catch (err) {
    console.error('Could not load product:', err);
    section.innerHTML = `
      <div class="product-error">
        <p class="status-text">Product not found.</p>
        <a href="products.html" class="breadcrumb-back">
          <i class="bi bi-arrow-left"></i> Back to Store
        </a>
      </div>
    `;
  }
}

async function loadRelated(category, excludeId) {
  try {
    const products = await getProductsByCategory(category, excludeId);
    renderRelated(products);
  } catch (err) {
    console.error('Could not load related products:', err);
  }
}

document.addEventListener('DOMContentLoaded', loadProduct);
