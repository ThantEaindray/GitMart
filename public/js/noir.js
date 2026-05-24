/* global getProducts, formatPrice */

function renderStars(rating) {
  const filled = Math.round(rating ?? 0);
  const full = '<i class="bi bi-star-fill"></i>';
  const empty = '<i class="bi bi-star"></i>';
  return full.repeat(filled) + empty.repeat(5 - filled);
}

function loadFeatured() {
  const grid = document.getElementById('products-grid');

  getProducts()
    .then((products) => {
      grid.innerHTML = '';
      if (products.length === 0) {
        grid.innerHTML = '<p class="status-text">No products found.</p>';
        return;
      }
      products.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
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
        `;
        card.addEventListener('click', () => handleProductClick(p.id));
        grid.appendChild(card);
      });
    })
    .catch((err) => {
      console.error('Could not load products:', err);
      grid.innerHTML =
        '<p class="status-text">Failed to load products. Please try again later.</p>';
    });
}

// EVENT HANDLERS

function handleProductClick(productId) {
  window.location.href = `product.html?id=${productId}`;
}

function handleCartClick() {
  window.location.href = 'checkout.html';
}

function handleWishlistClick() {
  console.log('Wishlist clicked');
}

function handleSearchClick() {
  console.log('Search clicked');
}

// INIT

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-cart')?.addEventListener('click', handleCartClick);
  document.getElementById('btn-wishlist')?.addEventListener('click', handleWishlistClick);
  document.getElementById('btn-search')?.addEventListener('click', handleSearchClick);
  loadFeatured();
});
