function parseResponse(response) {
  return response.json().then(function (data) {
    return { status: response.status, data };
  });
}

function onListingClick() {
  window.location.href = 'listing.html?id=' + this.dataset.id;
}

function createFeaturedCard(listing) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = listing.id;

  card.innerHTML =
    '<div class="card-img"><i class="bi bi-tag" style="font-size:2rem;"></i></div>' +
    '<div class="card-body">' +
    '<div class="card-cat">' + (listing.category || 'Others') + '</div>' +
    '<div class="card-name">' + listing.title + '</div>' +
    '<div class="card-footer">' +
    '<span class="card-price" data-price="' + listing.price + '">' + formatPrice(Number(listing.price)) + '</span>' +
    '</div>' +
    '</div>';

  card.addEventListener('click', onListingClick);
  return card;
}

function renderFeatured(result) {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';

  if (result.status !== 200 || !Array.isArray(result.data) || result.data.length === 0) {
    grid.innerHTML = '<p class="status-text">No listings yet. <a href="listing-create.html" style="color:var(--accent);">Be the first to list!</a></p>';
    return;
  }

  result.data.slice(0, 4).forEach(function (listing) {
    grid.appendChild(createFeaturedCard(listing));
  });
}

function onFeaturedError() {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '<p class="status-text">Failed to load listings.</p>';
}

function loadFeatured() {
  fetch('/api/listings').then(parseResponse).then(renderFeatured).catch(onFeaturedError);
}

document.addEventListener('DOMContentLoaded', function () {
  loadFeatured();
});
