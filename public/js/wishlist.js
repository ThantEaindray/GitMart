// ── TOAST ─────────────────────────────────────────────────────────────────

function showToast(message) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(function () {
    toast.classList.remove('show');
  }, 3000);
}

// ── HELPERS ───────────────────────────────────────────────────────────────

function parseResponse(response) {
  return response.json().then(function (data) {
    return { status: response.status, data: data };
  });
}

function showWishlistError(message) {
  var grid = document.getElementById('wishlistGrid');
  if (grid) grid.innerHTML = '<p class="status-text">' + message + '</p>';
}

// ── REMOVE FROM WISHLIST ──────────────────────────────────────────────────

var _pendingRemoveCard = null;

function onItemRemoved(result) {
  if (result.status !== 200) {
    showToast(result.data.message || 'Failed to remove item.');
    return;
  }
  _pendingRemoveCard.remove();
  showToast('Removed from wishlist.');
  var grid = document.getElementById('wishlistGrid');
  if (grid && grid.querySelectorAll('.card').length === 0) {
    renderEmpty();
  }
}

function onRemoveError() {
  showToast('Something went wrong.');
}

function removeFromWishlist(listingId, cardEl) {
  _pendingRemoveCard = cardEl;
  authFetch('/api/wishlist/' + listingId, { method: 'DELETE' })
    .then(parseResponse)
    .then(onItemRemoved)
    .catch(onRemoveError);
}

// ── RENDER ────────────────────────────────────────────────────────────────

function renderEmpty() {
  var grid = document.getElementById('wishlistGrid');
  if (!grid) return;
  grid.innerHTML =
    '<div class="listing-empty-state">' +
    '<i class="bi bi-heart"></i>' +
    '<h3>Your wishlist is empty</h3>' +
    '<p>Save listings you love by clicking the heart on any listing card.</p>' +
    '<a href="listings.html" class="btn-primary">Browse Listings</a>' +
    '</div>';
}

function onRemoveBtnClick() {
  var listingId = Number(this.dataset.listingId);
  var card = this.closest('.card');
  removeFromWishlist(listingId, card);
}

function createWishlistCard(item) {
  var card = document.createElement('div');
  card.className = 'card';

  var status = item.isSold ? 'Sold' : item.isClosed ? 'Closed' : 'Available';
  var statusColor = !item.isSold && !item.isClosed ? 'var(--accent)' : 'var(--muted)';

  var date = new Date(item.created_on).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  var listingImage = item.image_url
    ? '<img src="' + item.image_url + '" alt="' + item.title + '" class="listing-card-image" />'
    : '<i class="bi bi-tag" style="font-size:2.5rem;"></i>';

  card.innerHTML =
    '<div class="card-img">' +
    listingImage +
    '</div>' +
    '<div class="card-body">' +
    '<div class="card-cat" style="color:' + statusColor + ';">' + status + ' &nbsp;·&nbsp; ' + date + '</div>' +
    '<div class="card-name">' + item.title + '</div>' +
    '<p style="font-size:0.82em;color:var(--muted);margin:6px 0 10px;line-height:1.5;">' + item.description + '</p>' +
    '<div class="card-footer">' +
    '<span class="card-price" data-price="' + item.price + '">' + formatPrice(Number(item.price)) + '</span>' +
    (item.view_count > 0 ? '<span style="font-size:0.78rem;color:var(--muted);"><i class="bi bi-eye"></i> ' + item.view_count + '</span>' : '') +
    '</div>' +
    '<div class="wishlist-card-actions">' +
    '<button class="btn-secondary btn-remove" data-listing-id="' + item.listing_id + '" type="button">Remove</button>' +
    '<a href="listing.html?id=' + item.listing_id + '" class="btn-primary">View</a>' +
    '</div>' +
    '</div>';

  var removeBtn = card.querySelector('.btn-remove');
  if (removeBtn) removeBtn.addEventListener('click', onRemoveBtnClick);

  return card;
}

function renderWishlist(items) {
  var grid = document.getElementById('wishlistGrid');
  if (!grid) return;

  grid.innerHTML = '';

  if (!items || items.length === 0) {
    renderEmpty();
    return;
  }

  items.forEach(function (item) {
    grid.appendChild(createWishlistCard(item));
  });
}

// ── INIT ──────────────────────────────────────────────────────────────────

function onWishlistLoaded(result) {
  if (result.status !== 200) {
    showWishlistError('Failed to load wishlist.');
    return;
  }
  renderWishlist(result.data);
}

function onWishlistLoadError() {
  showWishlistError('Something went wrong.');
}

function loadWishlist() {
  if (!localStorage.getItem('token')) {
    window.location.href = 'login.html';
    return;
  }
  authFetch('/api/wishlist')
    .then(parseResponse)
    .then(onWishlistLoaded)
    .catch(onWishlistLoadError);
}

document.addEventListener('DOMContentLoaded', loadWishlist);
