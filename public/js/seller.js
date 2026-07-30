// ── SELLER PROFILE ────────────────────────────────────────────────────────────

var _sellerId = null;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderStars(rating) {
  var html = '';
  for (var i = 1; i <= 5; i++) {
    html += i <= rating ? '★' : '☆';
  }
  return '<span class="sp-rv-stars">' + html + '</span>';
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function onProfileLoaded(result) {
  var hero = document.getElementById('seller-hero');
  if (!hero) return;

  if (result.status !== 200) {
    hero.innerHTML = '<p class="status-text">Seller not found.</p>';
    return;
  }

  var p = result.data;
  var since = new Date(p.created_on).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });
  var count = Number(p.listing_count);

  document.title = 'GitMart — ' + p.username;

  var avatarHtml = p.profile_image
    ? '<img src="data:image/jpeg;base64,' +
      p.profile_image +
      '" alt="' +
      escapeHtml(p.username) +
      '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />'
    : '<i class="bi bi-person"></i>';

  hero.innerHTML =
    '<div class="seller-avatar">' +
    avatarHtml +
    '</div>' +
    '<div class="seller-meta">' +
    '<div class="seller-username" id="seller-username">' +
    escapeHtml(p.username) +
    '</div>' +
    '<div class="seller-since">Member since ' +
    since +
    '</div>' +
    '<div class="seller-stat">' +
    count +
    ' active listing' +
    (count !== 1 ? 's' : '') +
    '</div>' +
    '</div>';
}

function loadProfile() {
  fetch('/api/users/' + _sellerId + '/public')
    .then(function (r) {
      return r.json().then(function (d) {
        return { status: r.status, data: d };
      });
    })
    .then(onProfileLoaded)
    .catch(function () {
      var hero = document.getElementById('seller-hero');
      if (hero) hero.innerHTML = '<p class="status-text">Could not load seller profile.</p>';
    });
}

// ── Listings ──────────────────────────────────────────────────────────────────

function goToListing() {
  window.location.href = 'listing.html?id=' + this.dataset.listingId;
}

function renderListingCard(listing) {
  var img = listing.image_url
    ? '<img src="' +
      listing.image_url +
      '" alt="' +
      escapeHtml(listing.title) +
      '" loading="lazy" />'
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
    escapeHtml(listing.category) +
    '</div>' +
    '<div class="card-name">' +
    escapeHtml(listing.title) +
    '</div>' +
    '<div class="card-footer"><span class="card-price" data-price="' +
    listing.price +
    '">' +
    formatPrice(Number(listing.price)) +
    '</span>' +
    (Number(listing.review_count) > 0
      ? '<span class="card-rating" style="font-size:0.78rem;color:var(--accent,#c9a96e);">★ ' +
        listing.avg_rating +
        ' <span style="color:var(--muted)">(' +
        listing.review_count +
        ')</span></span>'
      : '') +
    '</div>' +
    '</div>';
  card.addEventListener('click', goToListing);
  return card;
}

function onListingsLoaded(result) {
  var grid = document.getElementById('seller-listings-grid');
  if (!grid) return;

  if (result.status !== 200) {
    grid.innerHTML = '<p class="status-text">Could not load listings.</p>';
    return;
  }

  var active = result.data.filter(function (l) {
    return !l.isSold && !l.isClosed;
  });

  if (active.length === 0) {
    grid.innerHTML = '<p class="status-text" style="color:var(--muted)">No active listings.</p>';
    return;
  }

  grid.innerHTML = '';
  active.forEach(function (l) {
    grid.appendChild(renderListingCard(l));
  });

  var link = document.getElementById('see-all-link');
  if (link) link.style.display = '';
}

function loadListings() {
  fetch('/api/listings/owner/' + _sellerId)
    .then(function (r) {
      return r.json().then(function (d) {
        return { status: r.status, data: d };
      });
    })
    .then(onListingsLoaded)
    .catch(function () {
      var grid = document.getElementById('seller-listings-grid');
      if (grid) grid.innerHTML = '<p class="status-text">Could not load listings.</p>';
    });
}

// ── Reviews ───────────────────────────────────────────────────────────────────

function renderSellerReview(review) {
  var date = formatDate(review.created_on);
  return (
    '<div class="sp-rv-card">' +
    '<div class="sp-rv-header">' +
    renderStars(review.rating) +
    '<span class="sp-rv-author">' +
    escapeHtml(review.reviewer_name) +
    '</span>' +
    '<a href="listing.html?id=' +
    review.listing_id +
    '" class="sp-rv-listing">' +
    escapeHtml(review.listing_title) +
    '</a>' +
    '<span class="sp-rv-date">' +
    date +
    '</span>' +
    '</div>' +
    (review.comment ? '<p class="sp-rv-comment">' + escapeHtml(review.comment) + '</p>' : '') +
    '</div>'
  );
}

function onSellerReviewsLoaded(result) {
  var list = document.getElementById('seller-reviews-list');
  if (!list) return;

  var rows = result.status === 200 && Array.isArray(result.data) ? result.data : [];

  if (rows.length === 0) {
    list.innerHTML =
      '<p class="status-text" style="color:var(--muted);font-style:italic">No reviews yet.</p>';
    return;
  }

  list.innerHTML = rows.map(renderSellerReview).join('');
}

function loadSellerReviews() {
  fetch('/api/users/' + _sellerId + '/reviews')
    .then(function (r) {
      return r.json().then(function (d) {
        return { status: r.status, data: d };
      });
    })
    .then(onSellerReviewsLoaded)
    .catch(function () {
      var list = document.getElementById('seller-reviews-list');
      if (list)
        list.innerHTML =
          '<p class="status-text" style="color:var(--muted);font-style:italic">No reviews yet.</p>';
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  var params = new URLSearchParams(window.location.search);
  _sellerId = params.get('id');

  if (!_sellerId) {
    window.location.href = 'listings.html';
    return;
  }

  loadProfile();
  loadListings();
  loadSellerReviews();

  var navHeart = document.getElementById('btn-wishlist');
  if (navHeart)
    navHeart.addEventListener('click', function () {
      window.location.href = 'wishlist.html';
    });
});
