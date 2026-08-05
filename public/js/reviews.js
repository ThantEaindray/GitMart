// ── REVIEWS ──────────────────────────────────────────────────────────────────

var _reviewListingId = null;
var _reviewOwnerId = null;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderStarDisplay(rating) {
  var html = '';
  for (var i = 1; i <= 5; i++) {
    html += i <= rating ? '★' : '☆';
  }
  return '<span class="rv-stars--display">' + html + '</span>';
}

function renderReviewCard(review, myUserId) {
  var isOwn = myUserId && Number(myUserId) === Number(review.reviewer_id);
  var deleteBtn = isOwn
    ? '<button class="rv-delete" onclick="deleteReview(' + review.id + ')">Delete</button>'
    : '';
  var date = new Date(review.created_on).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return (
    '<div class="rv-card" id="rv-' +
    review.id +
    '">' +
    '<div class="rv-header">' +
    renderStarDisplay(review.rating) +
    '<span class="rv-author">' +
    escapeHtml(review.reviewer_name) +
    '</span>' +
    '<span class="rv-date">' +
    date +
    '</span>' +
    deleteBtn +
    '</div>' +
    (review.comment ? '<p class="rv-comment">' + escapeHtml(review.comment) + '</p>' : '') +
    '</div>'
  );
}

function onReviewsLoaded(result) {
  var list = document.getElementById('reviews-list');
  if (!list) return;

  if (result.status !== 200) {
    list.innerHTML = '<p class="status-text">Could not load reviews.</p>';
    return;
  }

  var myUserId = localStorage.getItem('loggedInUserId');

  // If the logged-in user already has a review, hide the submit form
  if (myUserId && result.data.length > 0) {
    var alreadyReviewed = result.data.some(function (r) {
      return Number(r.reviewer_id) === Number(myUserId);
    });
    if (alreadyReviewed) {
      var container = document.getElementById('review-form-container');
      if (container && container.querySelector('#review-form')) {
        container.innerHTML = '<p class="status-text">You have already reviewed this listing.</p>';
      }
    }
  }

  if (result.data.length === 0) {
    list.innerHTML = '<p class="status-text rv-empty">No reviews yet. Be the first!</p>';
    return;
  }

  list.innerHTML = result.data
    .map(function (r) {
      return renderReviewCard(r, myUserId);
    })
    .join('');
}

function loadReviews() {
  var list = document.getElementById('reviews-list');
  if (!list) return;
  list.innerHTML = '<p class="status-text">Loading reviews…</p>';
  fetch('/api/listings/' + _reviewListingId + '/reviews')
    .then(function (r) {
      return r.json().then(function (d) {
        return { status: r.status, data: d };
      });
    })
    .then(onReviewsLoaded)
    .catch(function () {
      var el = document.getElementById('reviews-list');
      if (el) el.innerHTML = '<p class="status-text">Could not load reviews.</p>';
    });
}

function deleteReview(reviewId) {
  authFetch('/api/listings/' + _reviewListingId + '/reviews/' + reviewId, {
    method: 'DELETE',
  }).then(function (r) {
    if (r.ok) {
      loadReviews();
      renderReviewForm();
    }
  });
}

window.deleteReview = deleteReview;

function renderReviewForm() {
  var container = document.getElementById('review-form-container');
  if (!container) return;

  var token = localStorage.getItem('token');
  var myUserId = localStorage.getItem('loggedInUserId');
  var isOwner = token && myUserId && Number(myUserId) === Number(_reviewOwnerId);

  if (!token) {
    container.innerHTML =
      '<p class="status-text"><a href="login.html">Log in</a> to leave a review.</p>';
    return;
  }

  if (isOwner) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML =
    '<form id="review-form" class="rv-form">' +
    '<div class="rv-star-picker" id="star-picker">' +
    '<span class="rv-picker-label">Your rating:</span>' +
    '<span class="rv-star" data-value="1">☆</span>' +
    '<span class="rv-star" data-value="2">☆</span>' +
    '<span class="rv-star" data-value="3">☆</span>' +
    '<span class="rv-star" data-value="4">☆</span>' +
    '<span class="rv-star" data-value="5">☆</span>' +
    '</div>' +
    '<textarea id="review-comment" class="rv-textarea" placeholder="Share your thoughts (optional)" rows="3"></textarea>' +
    '<button type="submit" class="btn-primary rv-submit">Submit Review</button>' +
    '</form>';

  var selectedRating = 0;
  var stars = container.querySelectorAll('.rv-star');

  function updateStars(count) {
    stars.forEach(function (s, i) {
      s.textContent = i < count ? '★' : '☆';
    });
  }

  stars.forEach(function (star) {
    star.addEventListener('mouseenter', function () {
      updateStars(Number(star.dataset.value));
    });
    star.addEventListener('mouseleave', function () {
      updateStars(selectedRating);
    });
    star.addEventListener('click', function () {
      selectedRating = Number(star.dataset.value);
      updateStars(selectedRating);
    });
  });

  container.querySelector('#review-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (selectedRating === 0) {
      showToast('Please select a star rating.');
      return;
    }
    var comment = container.querySelector('#review-comment').value.trim();
    authFetch('/api/listings/' + _reviewListingId + '/reviews', {
      method: 'POST',
      body: JSON.stringify({ rating: selectedRating, comment: comment || null }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { status: r.status, data: d };
        });
      })
      .then(function (result) {
        if (result.status === 201) {
          container.innerHTML = '<p class="status-text">Thanks for your review!</p>';
          loadReviews();
        } else if (result.status === 409) {
          showToast('You have already reviewed this listing.');
        } else {
          showToast('Could not submit review. Please try again.');
        }
      });
  });
}

function initReviews(listingId, ownerId) {
  _reviewListingId = listingId;
  _reviewOwnerId = ownerId;
  renderReviewForm();
  loadReviews();
}
