const CATEGORIES = [
  { name: 'Electronics',         slug: 'Electronics',  icon: 'bi-cpu-fill' },
  { name: 'Fashion & Accessories', slug: 'Fashion',    icon: 'bi-bag-heart-fill' },
  { name: 'Furniture & Home',    slug: 'Furniture',    icon: 'bi-house-fill' },
  { name: 'Collectibles & Toys', slug: 'Collectibles', icon: 'bi-stars' },
  { name: 'Sports & Outdoors',   slug: 'Sports',       icon: 'bi-bicycle' },
  { name: 'Books & Media',       slug: 'Books',        icon: 'bi-book-fill' },
  { name: 'Others',              slug: 'Others',       icon: 'bi-grid-fill' },
];

function createCategoryCard(category) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.slug = category.slug;

  card.innerHTML =
    '<div class="card-img"><i class="bi ' + category.icon + '" style="font-size:2.5rem;"></i></div>' +
    '<div class="card-body">' +
    '<div class="card-name">' + category.name + '</div>' +
    '<div class="card-footer"><span class="see-all">Browse listings →</span></div>' +
    '</div>';

  card.addEventListener('click', goToCategory);
  return card;
}

function goToCategory() {
  window.location.href = 'listings.html?category=' + this.dataset.slug;
}

function renderCategories() {
  const grid = document.getElementById('categories-grid');
  CATEGORIES.forEach(function (category) {
    grid.appendChild(createCategoryCard(category));
  });
}

document.addEventListener('DOMContentLoaded', renderCategories);
