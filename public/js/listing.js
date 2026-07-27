// ── TOAST ─────────────────────────────────────────────────────────────────



var currentListing = null;
var _isWishlisted = false;
var _currentListingId = null;

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

// ── LISTING DETAIL ────────────────────────────────────────────────────────

function addToCart() {
  if (!currentListing) return;
  if (currentListing.isSold || currentListing.isClosed) {
    showToast('This listing has already been sold.');
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

function renderListing(listing) {
  currentListing = listing;
  _currentListingId = listing.id;
  const section = document.getElementById('listing-detail');
  document.title = 'GitMart — ' + listing.title;

  const isAvailable = !listing.isSold && !listing.isClosed;
  const status = listing.isSold ? 'Sold' : listing.isClosed ? 'Closed' : 'Available';
  const statusColor = isAvailable ? 'var(--accent)' : 'var(--muted)';

  const date = new Date(listing.created_on).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const listingImage = listing.image_url
    ? '<img src="' +
      listing.image_url +
      '" alt="' +
      listing.title +
      '" class="listing-detail-image" />'
    : '<i class="bi bi-tag"></i>';

  var cartBtn = isAvailable
    ? '<button class="btn-outline" id="btn-cart" onclick="addToCart()"><i class="bi bi-bag"></i> Add to Cart</button>'
    : '<button class="btn-outline btn-unavailable" id="btn-cart" disabled>Unavailable</button>';

  var loggedInId = localStorage.getItem('loggedInUserId');
  var isOwner = loggedInId && Number(loggedInId) === listing.owner_id;
  var heartBtn = isOwner
    ? ''
    : '<button class="btn-wishlist-heart" id="btn-detail-heart" onclick="toggleDetailWishlist()" title="Add to wishlist"><i class="bi bi-heart"></i></button>';

  section.innerHTML =
    '<div class="product-img">' +
    listingImage +
    '</div>' +
    '<div class="product-info">' +
    '<div class="card-cat" style="color:' +
    statusColor +
    ';">' +
    status +
    ' &nbsp;·&nbsp; Listed ' +
    date +
    (listing.view_count > 0
      ? ' &nbsp;·&nbsp; <i class="bi bi-eye"></i> ' + listing.view_count + ' views'
      : '') +
    '</div>' +
    '<h1 class="product-name">' +
    listing.title +
    '</h1>' +
    (Number(listing.review_count) > 0
      ? '<div class="product-rating">★ ' + listing.avg_rating + ' <span class="rv-count">(' + listing.review_count + ' review' + (listing.review_count == 1 ? '' : 's') + ')</span></div>'
      : '') +
    '<div class="product-price" data-price="' +
    listing.price +
    '">' +
    formatPrice(Number(listing.price)) +
    '</div>' +
    '<p class="product-description">' +
    listing.description +
    '</p>' +
    (listing.owner_id
      ? '<div class="product-seller-bar">Sold by <a href="seller.html?id=' + listing.owner_id + '" id="seller-name-link" class="seller-name-link">…</a></div>'
      : '') +
    '<div class="product-actions">' +
    '<button class="btn-primary" id="btn-contact" onclick="createChat(' +
    listing.owner_id +
    ')">Contact Seller</button>' +
    cartBtn +
    heartBtn +
    '</div>' +
    '</div>';
}

// ── SELLER INFO ───────────────────────────────────────────────────────────

function loadSellerInfo(ownerId) {
  fetch('/api/users/' + ownerId + '/public')
    .then(function (r) { return r.json(); })
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
    '<div class="card-img">' + img + '</div>' +
    '<div class="card-body">' +
    '<div class="card-cat">' + listing.category + '</div>' +
    '<div class="card-name">' + listing.title + '</div>' +
    '<div class="card-footer"><span class="card-price" data-price="' +
    listing.price + '">' + formatPrice(Number(listing.price)) + '</span></div>' +
    '</div>';
  card.addEventListener('click', goToRelatedListing);
  return card;
}

function onRelatedLoaded(result) {
  if (result.status !== 200) return;

  var others = result.data
    .filter(function (l) { return l.id !== Number(_currentListingId); })
    .slice(0, 4);

  if (others.length === 0) return;

  var grid = document.getElementById('related-grid');
  var section = document.getElementById('related-section');
  var seeAll = document.getElementById('related-see-all');
  if (!grid || !section) return;

  others.forEach(function (l) { grid.appendChild(renderRelatedCard(l)); });

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

function onListingLoaded(result) {
  const section = document.getElementById('listing-detail');

  if (result.status !== 200) {
    section.innerHTML = errorView('Listing not found.');
    return;
  }

  renderListing(result.data);
  loadDetailWishlistState();
  loadRelatedListings(result.data.category);
  if (result.data.owner_id) loadSellerInfo(result.data.owner_id);
  if (typeof initReviews === 'function') initReviews(result.data.id, result.data.owner_id);
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
window.toggleDetailWishlist = toggleDetailWishlist;

document.addEventListener('DOMContentLoaded', function () {
  loadListing();
  var navHeart = document.getElementById('btn-wishlist');
  if (navHeart) navHeart.addEventListener('click', function () {
    window.location.href = 'wishlist.html';
  });
});
