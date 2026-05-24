// ── TOAST ─────────────────────────────────────────────────────────────────

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── HELPERS ───────────────────────────────────────────────────────────────

function parseResponse(response) {
  return response.json().then(function (data) {
    return { status: response.status, data };
  });
}

function errorView(message) {
  return (
    '<div class="product-error">' +
    '<p class="status-text">' + message + '</p>' +
    '<a href="listings.html" class="breadcrumb-back"><i class="bi bi-arrow-left"></i> Back to Listings</a>' +
    '</div>'
  );
}

// ── LISTING DETAIL ────────────────────────────────────────────────────────

function onContactClick() {
  if (!localStorage.getItem('token')) {
    showToast('You must be logged in to contact a seller.');
    return;
  }
  showToast('Chat coming soon.');
}

function renderListing(listing) {
  const section = document.getElementById('listing-detail');
  document.title = 'GitMart — ' + listing.title;

  const status = listing.isSold ? 'Sold' : listing.isClosed ? 'Closed' : 'Available';
  const statusColor = listing.isSold || listing.isClosed ? 'var(--muted)' : 'var(--accent)';

  const date = new Date(listing.created_on).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  section.innerHTML =
    '<div class="product-img"><i class="bi bi-tag"></i></div>' +
    '<div class="product-info">' +
    '<div class="card-cat" style="color:' + statusColor + ';">' + status + ' &nbsp;·&nbsp; Listed ' + date + '</div>' +
    '<h1 class="product-name">' + listing.title + '</h1>' +
    '<div class="product-price" data-price="' + listing.price + '">' + formatPrice(Number(listing.price)) + '</div>' +
    '<p class="product-description">' + listing.description + '</p>' +
    '<div class="product-actions"><button class="btn-primary" id="btn-contact">Contact Seller</button></div>' +
    '</div>';

  document.getElementById('btn-contact').addEventListener('click', onContactClick);
}

function onListingLoaded(result) {
  const section = document.getElementById('listing-detail');

  if (result.status !== 200) {
    section.innerHTML = errorView('Listing not found.');
    return;
  }

  renderListing(result.data);
}

function onListingError() {
  const section = document.getElementById('listing-detail');
  section.innerHTML = errorView('Failed to load listing.');
}

// ── INIT ──────────────────────────────────────────────────────────────────

function loadListing() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    window.location.href = 'listings.html';
    return;
  }

  fetch('/api/listings/' + id).then(parseResponse).then(onListingLoaded).catch(onListingError);
}

document.addEventListener('DOMContentLoaded', loadListing);
