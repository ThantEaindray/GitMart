// ── TOAST ─────────────────────────────────────────────────────────────────

var currentListing = null;
var _isWishlisted = false;
var _currentListingId = null;
// The logged-in user's own reservation on this listing (null when none exists).
var currentUserReservation = null;

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
    '<p class="status-text">' +
    message +
    '</p>' +
    '<a href="listings.html" class="breadcrumb-back"><i class="bi bi-arrow-left"></i> Back to Listings</a>' +
    '</div>'
  );
}

function getCurrentUserId() {
  return Number(localStorage.getItem('loggedInUserId') || localStorage.getItem('userId'));
}

function isListingOwner(listing) {
  const currentUserId = getCurrentUserId();

  return currentUserId > 0 && Number(listing.owner_id) === currentUserId;
}

function getListingStatus(listing) {
  if (typeof listing.status === 'string' && listing.status.trim() !== '') {
    return listing.status.trim().toUpperCase();
  }

  if (listing.isSold) {
    return 'SOLD';
  }

  if (listing.isClosed) {
    return 'ARCHIVED';
  }

  return 'AVAILABLE';
}

function formatListingStatus(status) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function getOwnerLifecycleActions(status) {
  if (status === 'AVAILABLE') {
    return `
      <div class="owner-lifecycle-controls">
        <p class="status-text">Manage your listing status</p>

        <div class="product-actions">
          <button
            class="btn-primary"
            type="button"
            data-listing-status-action
            onclick="updateListingStatus('RESERVED')"
          >
            Mark Reserved
          </button>

          <button
            class="btn-outline"
            type="button"
            data-listing-status-action
            onclick="updateListingStatus('SOLD')"
          >
            Mark Sold
          </button>

          <button
            class="btn-outline"
            type="button"
            data-listing-status-action
            onclick="updateListingStatus('ARCHIVED')"
          >
            Archive
          </button>
        </div>
      </div>
    `;
  }

  if (status === 'RESERVED') {
    return `
      <div class="owner-lifecycle-controls">
        <p class="status-text">Manage your listing status</p>

        <div class="product-actions">
          <button
            class="btn-primary"
            type="button"
            data-listing-status-action
            onclick="updateListingStatus('AVAILABLE')"
          >
            Release Reservation
          </button>

          <button
            class="btn-outline"
            type="button"
            data-listing-status-action
            onclick="updateListingStatus('SOLD')"
          >
            Mark Sold
          </button>

          <button
            class="btn-outline"
            type="button"
            data-listing-status-action
            onclick="updateListingStatus('ARCHIVED')"
          >
            Archive
          </button>
        </div>
      </div>
    `;
  }

  if (status === 'ARCHIVED') {
    return `
      <div class="owner-lifecycle-controls">
        <p class="status-text">
          This listing is archived.
        </p>

        <div class="product-actions">
          <button
            class="btn-primary"
            type="button"
            data-listing-status-action
            onclick="updateListingStatus('AVAILABLE')"
          >
            Relist as Available
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="owner-lifecycle-controls">
      <p class="status-text">
        This listing is sold. Sold is a final status.
      </p>

      <button
        class="btn-outline btn-unavailable"
        type="button"
        disabled
      >
        Sold
      </button>
    </div>
  `;
}

// A listing is buyable only once its owner has accepted THIS user's reservation,
// which is also what moves the listing into RESERVED.
function canAddToCart(status) {
  return (
    status === 'RESERVED' &&
    currentUserReservation !== null &&
    currentUserReservation.status === 'ACCEPTED'
  );
}

function disabledButton(id, label) {
  return `
    <button
      class="btn-outline btn-unavailable"
      id="${id}"
      type="button"
      disabled
    >
      ${label}
    </button>
  `;
}

function getCartButton(status) {
  if (canAddToCart(status)) {
    return `
      <button
        class="btn-outline"
        id="btn-cart"
        type="button"
        onclick="addToCart()"
      >
        <i class="bi bi-bag"></i>
        Add to Cart
      </button>
    `;
  }

  // RESERVED but held by someone else — say so rather than showing a bare status.
  if (status === 'RESERVED') {
    return disabledButton('btn-cart', 'Reserved by another buyer');
  }
  if (status === 'AVAILABLE') {
    return disabledButton('btn-cart', 'Reserve first to buy');
  }

  return disabledButton('btn-cart', formatListingStatus(status));
}

function getReservationButton(listing, status) {
  // Seed/demo listings have no owner, so nobody can reserve them. Say why
  // instead of rendering nothing and leaving the buyer guessing.
  if (!listing.owner_id) {
    return disabledButton('btn-request-reservation', 'Reservations unavailable');
  }

  if (currentUserReservation && currentUserReservation.status === 'PENDING') {
    return disabledButton('btn-request-reservation', 'Request Sent');
  }
  if (currentUserReservation && currentUserReservation.status === 'ACCEPTED') {
    return disabledButton('btn-request-reservation', 'Reservation Accepted');
  }

  if (status !== 'AVAILABLE') return '';

  return `
    <button
      class="btn-outline"
      id="btn-request-reservation"
      type="button"
      onclick="requestReservation()"
    >
      <i class="bi bi-calendar-check"></i>
      Request Reservation
    </button>
  `;
}

function getBuyerActions(listing, status) {
  const contactButton = listing.owner_id
    ? `
      <button
        class="btn-primary"
        id="btn-contact"
        type="button"
        onclick="createChat(${listing.owner_id})"
      >
        Contact Seller
      </button>
    `
    : '';

  return `
    <div class="product-actions">
      ${contactButton}
      ${getCartButton(status)}
      ${getReservationButton(listing, status)}

      <button
        class="btn-wishlist-heart"
        id="btn-detail-heart"
        type="button"
        onclick="toggleDetailWishlist()"
        title="Add to wishlist"
        aria-label="Add to wishlist"
      >
        <i class="bi bi-heart"></i>
      </button>
    </div>
  `;
}

// ── LISTING DETAIL ────────────────────────────────────────────────────────

function addToCart() {
  if (!currentListing) return;

  const status = getListingStatus(currentListing);

  if (!canAddToCart(status)) {
    if (status === 'RESERVED') {
      showToast('This listing is reserved by another buyer.');
    } else if (status === 'AVAILABLE') {
      showToast('Request a reservation and wait for the seller to accept before buying.');
    } else {
      showToast(`This listing is ${formatListingStatus(status).toLowerCase()}.`);
    }
    return;
  }

  var raw = localStorage.getItem('cart');
  var cart = raw ? JSON.parse(raw) : [];
  var existing = cart.find(function (item) {
    return item.id === currentListing.id;
  });
  if (existing) {
    existing.quantity = 1;
    existing.isOneOff = true;
    existing.listingId = currentListing.id;
    localStorage.setItem('cart', JSON.stringify(cart));
    showToast('This one-off listing is already in cart.');
    return;
  }
  cart.push({
    id: currentListing.id,
    listingId: currentListing.id,
    title: currentListing.title,
    price: currentListing.price,
    category: currentListing.category,
    quantity: 1,
    isOneOff: true,
  });
  localStorage.setItem('cart', JSON.stringify(cart));
  showToast('Added to cart.');
}

function resetReservationButton() {
  const button = document.getElementById('btn-request-reservation');

  if (!button) return;

  button.disabled = false;
  button.innerHTML = `
    <i class="bi bi-calendar-check"></i>
    Request Reservation
  `;
}

function requestReservation() {
  if (!currentListing) return;

  if (!localStorage.getItem('token')) {
    window.location.href = 'login.html';
    return;
  }

  if (getListingStatus(currentListing) !== 'AVAILABLE') {
    showToast('Only available listings can be reserved.');
    return;
  }

  const button = document.getElementById('btn-request-reservation');

  if (button) {
    button.disabled = true;
    button.textContent = 'Sending Request...';
  }

  authFetch(`/api/listings/${currentListing.id}/reservations`, {
    method: 'POST',
  })
    .then(parseResponse)
    .then(function (result) {
      if (result.status !== 201) {
        showToast(result.data.message || 'Failed to submit reservation request.');

        resetReservationButton();
        return;
      }

      showToast(result.data.message || 'Reservation request submitted.');

      // Keep local state in sync so a re-render keeps showing "Request Sent".
      currentUserReservation = result.data.reservation || null;

      if (button) {
        button.disabled = true;
        button.textContent = 'Request Sent';
      }
    })
    .catch(function () {
      showToast('Something went wrong while submitting the reservation request.');

      resetReservationButton();
    });
}

function setLifecycleButtonsDisabled(disabled) {
  document.querySelectorAll('[data-listing-status-action]').forEach(function (button) {
    button.disabled = disabled;
  });
}

function updateListingStatus(nextStatus) {
  if (!currentListing) {
    return;
  }

  const token = localStorage.getItem('token');

  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  if (!isListingOwner(currentListing)) {
    showToast('Only the listing owner can change its status.');
    return;
  }

  setLifecycleButtonsDisabled(true);

  fetch(`/api/listings/${currentListing.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status: nextStatus,
    }),
  })
    .then(parseResponse)
    .then(function (result) {
      if (result.status !== 200) {
        setLifecycleButtonsDisabled(false);

        showToast(result.data.message || 'Failed to update listing status.');

        return;
      }

      currentListing = Object.assign({}, currentListing, result.data.listing);

      renderListing(currentListing);

      showToast(result.data.message || 'Listing status updated successfully.');
    })
    .catch(function () {
      setLifecycleButtonsDisabled(false);

      showToast('Failed to update listing status.');
    });
}

function renderListing(listing) {
  currentListing = listing;
  _currentListingId = listing.id;

  const section = document.getElementById('listing-detail');

  document.title = `GitMart — ${listing.title}`;

  const lifecycleStatus = getListingStatus(listing);

  const statusLabel = formatListingStatus(lifecycleStatus);

  const owner = isListingOwner(listing);

  const statusColor =
    lifecycleStatus === 'AVAILABLE'
      ? 'var(--accent)'
      : lifecycleStatus === 'RESERVED'
        ? 'var(--accent2)'
        : 'var(--muted)';

  const createdDate = new Date(listing.created_on).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const statusUpdatedDate = listing.status_updated_on
    ? new Date(listing.status_updated_on).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const listingImage = listing.image_url
    ? `
      <img
        src="${listing.image_url}"
        alt="${listing.title}"
        class="listing-detail-image"
      />
    `
    : '<i class="bi bi-tag"></i>';

  const actions = owner
    ? getOwnerLifecycleActions(lifecycleStatus)
    : getBuyerActions(listing, lifecycleStatus);

  section.innerHTML = `
    <div class="product-img">
      ${listingImage}
    </div>

    <div class="product-info">
      <div
        class="card-cat"
        style="color: ${statusColor};"
      >
        ${statusLabel}
        &nbsp;·&nbsp;
        Listed ${createdDate}

        ${statusUpdatedDate ? `&nbsp;·&nbsp; Status updated ${statusUpdatedDate}` : ''}

        ${
          listing.view_count > 0
            ? `&nbsp;·&nbsp; <i class="bi bi-eye"></i> ${listing.view_count} views`
            : ''
        }
      </div>

      <h1 class="product-name">
        ${listing.title}
      </h1>

      ${Number(listing.review_count) > 0 ? `<div class="product-rating">★ ${listing.avg_rating} <span class="rv-count">(${listing.review_count} review${listing.review_count == 1 ? '' : 's'})</span></div>` : ''}

      <div
        class="product-price"
        data-price="${listing.price}"
      >
        ${formatPrice(Number(listing.price))}
      </div>

      <p class="product-description">
        ${listing.description}
      </p>

      ${listing.owner_id ? `<div class="product-seller-bar">Sold by <a href="seller.html?id=${listing.owner_id}" id="seller-name-link" class="seller-name-link">…</a></div>` : ''}

      ${actions}
    </div>
  `;
}

// ── SELLER INFO ───────────────────────────────────────────────────────────

function loadSellerInfo(ownerId) {
  fetch('/api/users/' + ownerId + '/public')
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      var link = document.getElementById('seller-name-link');
      if (link && data.username) link.textContent = data.username;
    })
    .catch(function () {});
}

// ── RELATED LISTINGS ─────────────────────────────────────────────────────

function goToRelatedListing() {
  window.location.href = 'listing.html?id=' + this.dataset.listingId;
}

function renderRelatedCard(listing) {
  var img = listing.image_url
    ? '<img src="' + listing.image_url + '" alt="' + listing.title + '" loading="lazy" />'
    : '<i class="bi bi-tag"></i>';

  var card = document.createElement('div');
  card.className = 'card';
  card.dataset.listingId = listing.id;
  card.innerHTML =
    '<div class="card-img">' +
    img +
    '</div>' +
    '<div class="card-body">' +
    '<div class="card-cat">' +
    listing.category +
    '</div>' +
    '<div class="card-name">' +
    listing.title +
    '</div>' +
    '<div class="card-footer"><span class="card-price" data-price="' +
    listing.price +
    '">' +
    formatPrice(Number(listing.price)) +
    '</span></div>' +
    '</div>';
  card.addEventListener('click', goToRelatedListing);
  return card;
}

function onRelatedLoaded(result) {
  if (result.status !== 200) return;

  var others = result.data
    .filter(function (l) {
      return l.id !== Number(_currentListingId);
    })
    .slice(0, 4);

  if (others.length === 0) return;

  var grid = document.getElementById('related-grid');
  var section = document.getElementById('related-section');
  var seeAll = document.getElementById('related-see-all');
  if (!grid || !section) return;

  others.forEach(function (l) {
    grid.appendChild(renderRelatedCard(l));
  });

  if (seeAll && currentListing) {
    seeAll.href = 'listings.html?category=' + encodeURIComponent(currentListing.category);
  }

  section.style.display = '';
}

function onRelatedError() {
  // Related listings are non-critical — silently skip on failure
}

function loadRelatedListings(category) {
  fetch('/api/listings/category/' + encodeURIComponent(category))
    .then(parseResponse)
    .then(onRelatedLoaded)
    .catch(onRelatedError);
}

// ── WISHLIST ──────────────────────────────────────────────────────────────

function applyDetailHeartToggle(res) {
  if (res.status !== 200 && res.status !== 201) return;
  _isWishlisted = !_isWishlisted;
  var btn = document.getElementById('btn-detail-heart');
  if (!btn) return;
  if (_isWishlisted) {
    btn.classList.add('wishlisted');
    btn.querySelector('i').className = 'bi bi-heart-fill';
  } else {
    btn.classList.remove('wishlisted');
    btn.querySelector('i').className = 'bi bi-heart';
  }
}

function onDetailHeartError() {
  showToast('Could not update wishlist.');
}

function toggleDetailWishlist() {
  if (!localStorage.getItem('token')) {
    window.location.href = 'login.html';
    return;
  }
  var method = _isWishlisted ? 'DELETE' : 'POST';
  authFetch('/api/wishlist/' + _currentListingId, { method: method })
    .then(applyDetailHeartToggle)
    .catch(onDetailHeartError);
}

function applyDetailWishlistState(result) {
  if (result.status !== 200) return;
  _isWishlisted = result.data.some(function (item) {
    return item.listing_id === Number(_currentListingId);
  });
  var btn = document.getElementById('btn-detail-heart');
  if (!btn || !_isWishlisted) return;
  btn.classList.add('wishlisted');
  btn.querySelector('i').className = 'bi bi-heart-fill';
}

function loadDetailWishlistState() {
  if (!localStorage.getItem('token')) return;
  authFetch('/api/wishlist').then(parseResponse).then(applyDetailWishlistState);
}

// ── LOAD ──────────────────────────────────────────────────────────────────

function renderLoadedListing(listing) {
  renderListing(listing);
  loadDetailWishlistState();
  loadRelatedListings(listing.category);
  if (listing.owner_id) loadSellerInfo(listing.owner_id);
  if (typeof initReviews === 'function') initReviews(listing.id, listing.owner_id);
}

function applyMyReservation(result) {
  if (result.status === 200) currentUserReservation = result.data.reservation;
}

function onListingLoaded(result) {
  const section = document.getElementById('listing-detail');

  if (result.status !== 200) {
    section.innerHTML = errorView('Listing not found.');
    return;
  }

  const listing = result.data;
  currentUserReservation = null;

  // Owners and signed-out visitors never hold a reservation — render straight away.
  if (!localStorage.getItem('token') || isListingOwner(listing)) {
    renderLoadedListing(listing);
    return;
  }

  // Reservation state decides whether the cart button unlocks, so it must be
  // resolved before the first render. Failure here is non-fatal — the buttons
  // just stay in their locked state.
  authFetch('/api/listings/' + listing.id + '/reservations/mine')
    .then(parseResponse)
    .then(applyMyReservation)
    .catch(function () {})
    .finally(function () {
      renderLoadedListing(listing);
    });
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

  var token = localStorage.getItem('token');
  var options = token ? { headers: { Authorization: 'Bearer ' + token } } : {};
  fetch('/api/listings/' + id, options)
    .then(parseResponse)
    .then(onListingLoaded)
    .catch(onListingError);
}

function createChat(uId) {
  //ok so we wanna just make a fetchmethod call to the create chat endpoint easy sneesy
  const token = localStorage.getItem('token');
  //redirect to the login page if the user dosent have a token already
  if (!token) {
    window.location.href = 'login.html';

    return;
  }

  //format the data into an object for the req to work
  const data = {
    id: uId,
  };
  //now we can do the actual calling the chats part how fun we get to keep at it with our project always something new to do oh joy
  fetchMethod(
    `/api/chats/new`,
    (stat) => {
      if (stat == 500) {
        showToast('An Unknown error has occured');
        return;
      }
      //then if the token is invalid
      if (stat == 401) {
        return (window.location.href = 'login.html');
      }
      //and then we need to redirect to the chats page when the chat is actually made or if one already exists
      if (stat == 201 || stat == 409) {
        window.location.href = 'chats.html';
      }
    },
    'POST',
    data,
    token,
  );
}

window.addToCart = addToCart;
window.createChat = createChat;
window.updateListingStatus = updateListingStatus;
window.toggleDetailWishlist = toggleDetailWishlist;
window.requestReservation = requestReservation;

document.addEventListener('DOMContentLoaded', function () {
  loadListing();

  const navHeart = document.getElementById('btn-wishlist');

  if (navHeart) {
    navHeart.addEventListener('click', function () {
      window.location.href = 'wishlist.html';
    });
  }
});
