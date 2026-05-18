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
        <span class="card-price">$${Number(product.price).toLocaleString()}</span>
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

async function loadFeatured() {
  const grid = document.getElementById('products-grid');

  try {
    const products = await getProducts();
    const featured = products.slice(0, 4);
    grid.innerHTML = '';
    featured.forEach((p) => grid.appendChild(createProductCard(p)));
  } catch (err) {
    console.error('Could not load products:', err);
    grid.innerHTML = '<p class="status-text">Failed to load products. Please try again later.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-cart').addEventListener('click', () => console.log('Cart — coming soon'));
  document.getElementById('btn-wishlist').addEventListener('click', () => console.log('Wishlist — coming soon'));
  loadFeatured();
});
