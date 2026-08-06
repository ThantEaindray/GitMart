// ── TOAST ─────────────────────────────────────────────────────────────────

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(function () {
    toast.classList.remove('show');
  }, 3000);
}

// ── FIELD VALIDATION ──────────────────────────────────────────────────────

function showFieldError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.add('input-error');

  const existing = el.parentElement.querySelector('.field-error');

  if (existing) {
    existing.remove();
  }

  const err = document.createElement('span');

  err.className = 'field-error';
  err.textContent = message;

  el.parentElement.appendChild(err);
}

function clearFieldErrors() {
  document.querySelectorAll('.input-error').forEach(function (el) {
    el.classList.remove('input-error');
  });

  document.querySelectorAll('.field-error').forEach(function (el) {
    el.remove();
  });
}

// ── WARNING CARD ──────────────────────────────────────────────────────────

function showWarning(message) {
  const warningCard = document.getElementById('warningCard');

  const warningText = document.getElementById('warningText');

  if (warningCard && warningText) {
    warningText.textContent = message;
    warningCard.classList.remove('d-none');
  }
}

function hideWarning() {
  const warningCard = document.getElementById('warningCard');

  const warningText = document.getElementById('warningText');

  if (warningCard && warningText) {
    warningText.textContent = '';
    warningCard.classList.add('d-none');
  }
}

// ── HELPERS ───────────────────────────────────────────────────────────────

function parseResponse(response) {
  return response.json().then(function (data) {
    return {
      status: response.status,
      data,
    };
  });
}

let selectedListingImageUrl = null;
// The SCP upload takes several seconds — without this, submitting the form
// while it's still in flight creates the listing with imageUrl: null before
// selectedListingImageUrl is ever set.
let isUploadingCoverImage = false;
let wishlistedIds = new Set();

function getCurrentUserId() {
  return Number(localStorage.getItem('loggedInUserId') || localStorage.getItem('userId'));
}

function isOwner(listing) {
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

// ── LISTING CARD ──────────────────────────────────────────────────────────

function goToListing() {
  window.location.href = 'listing.html?id=' + this.dataset.id;
}

function createListingCard(listing) {
  const lifecycleStatus = getListingStatus(listing);

  const statusLabel = formatListingStatus(lifecycleStatus);

  const statusClass = lifecycleStatus.toLowerCase();

  const card = document.createElement('div');

  card.className = 'card';
  card.dataset.id = listing.id;
  card.dataset.status = lifecycleStatus;

  const date = new Date(listing.created_on).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const ownerControls = isOwner(listing)
    ? `
      <div class="owner-actions">
        <button
          class="btn-primary btn-edit-listing"
          data-id="${listing.id}"
          type="button"
        >
          Edit
        </button>

        <button
          class="btn-secondary btn-delete-listing"
          data-id="${listing.id}"
          type="button"
        >
          Delete
        </button>
      </div>
    `
    : '';

  const listingImage = listing.image_url
    ? `
      <img
        src="${listing.image_url}"
        alt="${listing.title}"
        class="listing-card-image"
      />
    `
    : `
      <i
        class="bi bi-tag"
        style="font-size: 2.5rem;"
      ></i>
    `;

  const viewCountHtml =
    listing.view_count > 0
      ? `
        <span
          style="
            font-size: 0.78rem;
            color: var(--muted);
          "
        >
          <i class="bi bi-eye"></i>
          ${listing.view_count}
        </span>
      `
      : '';

  const wishlistButtonHtml = !isOwner(listing)
    ? `
        <button
          class="btn-wishlist-heart"
          data-listing-id="${listing.id}"
          type="button"
          aria-label="Add to wishlist"
          title="Add to wishlist"
        >
          <i class="bi bi-heart"></i>
        </button>
      `
    : '';

  card.innerHTML = `
    <div class="card-img">
      ${listingImage}
    </div>

    <div class="card-body">
      <div class="card-cat">
        <span
          class="listing-status-badge listing-status-${statusClass}"
        >
          ${statusLabel}
        </span>

        <span>
          &nbsp;·&nbsp; ${date}
        </span>
      </div>

      <div class="card-name">
        ${listing.title}
      </div>

      <p
        style="
          font-size: 0.82em;
          color: var(--muted);
          margin: 6px 0 10px;
          line-height: 1.5;
        "
      >
        ${listing.description}
      </p>

      <div class="card-footer">
        <span
          class="card-price"
          data-price="${listing.price}"
        >
          ${formatPrice(Number(listing.price))}
        </span>

        ${Number(listing.review_count) > 0 ? `<span class="card-rating" style="font-size:0.78rem;color:var(--accent,#c9a96e);">★ ${listing.avg_rating} <span style="color:var(--muted)">(${listing.review_count})</span></span>` : ''}

        ${viewCountHtml}
        ${wishlistButtonHtml}
      </div>

      ${ownerControls}
    </div>
  `;

  card.addEventListener('click', goToListing);

  const heartBtn = card.querySelector('.btn-wishlist-heart');

  if (heartBtn) {
    if (wishlistedIds.has(listing.id)) {
      heartBtn.classList.add('wishlisted');

      heartBtn.querySelector('i').className = 'bi bi-heart-fill';
    }

    heartBtn.addEventListener('click', function (event) {
      event.stopPropagation();

      toggleWishlistHeart(heartBtn, listing.id);
    });
  }

  const editBtn = card.querySelector('.btn-edit-listing');

  if (editBtn) {
    editBtn.addEventListener('click', function (event) {
      event.stopPropagation();

      openListingModal('edit', listing);
    });
  }

  const deleteBtn = card.querySelector('.btn-delete-listing');

  if (deleteBtn) {
    deleteBtn.addEventListener('click', function (event) {
      event.stopPropagation();

      openListingModal('delete', listing);
    });
  }

  return card;
}

// ── SEARCH + FILTER ───────────────────────────────────────────────────────

function debounce(fn, delay) {
  let timer;

  return function () {
    clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
}

function readFilterValue(id) {
  const element = document.getElementById(id);
  return element ? element.value : '';
}

// Single source of truth for the active filters, read straight off the controls.
function readFilters() {
  return {
    search: readFilterValue('search-input').trim(),
    minPrice: readFilterValue('min-price'),
    maxPrice: readFilterValue('max-price'),
    category: readFilterValue('category-select'),
    sort: readFilterValue('sort-select') || 'newest',
  };
}

// Sort is excluded: it always has a value, so counting it would mean the badge
// could never read zero.
function countActiveFilters(filters) {
  return [filters.search, filters.minPrice, filters.maxPrice, filters.category].filter(Boolean)
    .length;
}

function toQueryParams(filters) {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', filters.search);
  if (filters.minPrice) params.set('minPrice', filters.minPrice);
  if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
  if (filters.category) params.set('category', filters.category);
  params.set('sort', filters.sort);

  return params;
}

function updateFilterCount(filters) {
  const badge = document.getElementById('filter-count');
  if (!badge) return;

  const count = countActiveFilters(filters);
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

// Mirrors the filters into the address bar so a filtered view can be shared or
// bookmarked. replaceState rather than pushState, so filtering does not bury
// the previous page under a stack of history entries.
function syncUrl(filters) {
  const params = toQueryParams(filters);
  if (filters.sort === 'newest') params.delete('sort');

  const query = params.toString();
  window.history.replaceState(null, '', query ? '?' + query : window.location.pathname);
}

function fetchListings() {
  const filters = readFilters();

  updateFilterCount(filters);
  syncUrl(filters);

  fetch('/api/listings/search?' + toQueryParams(filters).toString())
    .then(parseResponse)
    .then(renderListings)
    .catch(onListingsError);
}

// Restores the controls from the URL so a shared link opens in the same state.
function applyFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const assign = (id, value) => {
    const element = document.getElementById(id);
    if (element && value) element.value = value;
  };

  assign('search-input', params.get('search'));
  assign('min-price', params.get('minPrice'));
  assign('max-price', params.get('maxPrice'));
  assign('category-select', params.get('category'));
  assign('sort-select', params.get('sort'));
}

function clearFilters() {
  ['search-input', 'min-price', 'max-price', 'category-select'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = 'newest';

  fetchListings();
}

// ── MOST VIEWED ───────────────────────────────────────────────────────────

function renderMostViewed(result) {
  const section = document.getElementById('most-viewed-section');

  const grid = document.getElementById('mostViewedGrid');

  if (!grid) return;

  if (result.status !== 200 || !result.data || result.data.length === 0) {
    if (section) {
      section.style.display = 'none';
    }

    return;
  }

  result.data.forEach(function (listing) {
    grid.appendChild(createListingCard(listing));
  });
}

// ── RENDER LISTINGS ───────────────────────────────────────────────────────

function renderListingCards(listings) {
  const listingsGrid = document.getElementById('listingsGrid');

  if (!listingsGrid) return;

  listingsGrid.innerHTML = '';

  if (!Array.isArray(listings) || listings.length === 0) {
    listingsGrid.innerHTML = '<p class="status-text">No listings found.</p>';

    return;
  }

  listings.forEach(function (listing) {
    listingsGrid.appendChild(createListingCard(listing));
  });
}

function renderListings(result) {
  const listingsGrid = document.getElementById('listingsGrid');

  if (!listingsGrid) return;

  listingsGrid.innerHTML = '';

  if (result.status !== 200) {
    showWarning(result.data.message || 'Failed to load listings.');

    return;
  }

  renderListingCards(result.data);
}

function onListingsError() {
  const listingsGrid = document.getElementById('listingsGrid');

  if (listingsGrid) {
    listingsGrid.innerHTML = '';
  }

  showWarning('Something went wrong while loading listings.');
}

// ── RECENTLY VIEWED ───────────────────────────────────────────────────────

function renderRecentlyViewed(result) {
  const section = document.getElementById('recently-viewed-section');

  const grid = document.getElementById('recentlyViewedGrid');

  if (!section || !grid) return;

  if (result.status !== 200 || !result.data || result.data.length === 0) {
    return;
  }

  section.style.display = 'block';

  result.data.forEach(function (listing) {
    grid.appendChild(createListingCard(listing));
  });
}

function loadRecentlyViewed() {
  if (!localStorage.getItem('token')) {
    return;
  }

  authFetch('/api/listings/recently-viewed').then(parseResponse).then(renderRecentlyViewed);
}

// ── WISHLIST ──────────────────────────────────────────────────────────────

let heartButton = null;
let heartListingId = null;
let heartWasWishlisted = false;

function applyHeartToggle(response) {
  if (response.status !== 200 && response.status !== 201) {
    return;
  }

  if (!heartButton) return;

  if (heartWasWishlisted) {
    wishlistedIds.delete(heartListingId);

    heartButton.classList.remove('wishlisted');

    heartButton.querySelector('i').className = 'bi bi-heart';
  } else {
    wishlistedIds.add(heartListingId);

    heartButton.classList.add('wishlisted');

    heartButton.querySelector('i').className = 'bi bi-heart-fill';
  }
}

function toggleWishlistHeart(button, listingId) {
  if (!localStorage.getItem('token')) {
    window.location.href = 'login.html';
    return;
  }

  heartButton = button;
  heartListingId = listingId;

  heartWasWishlisted = wishlistedIds.has(listingId);

  const method = heartWasWishlisted ? 'DELETE' : 'POST';

  authFetch('/api/wishlist/' + listingId, {
    method,
  }).then(applyHeartToggle);
}

function applyLoadedHearts(result) {
  if (result.status !== 200) {
    return;
  }

  wishlistedIds = new Set(
    result.data.map(function (item) {
      return item.listing_id;
    }),
  );

  document.querySelectorAll('.btn-wishlist-heart').forEach(function (button) {
    const listingId = Number(button.dataset.listingId);

    if (wishlistedIds.has(listingId)) {
      button.classList.add('wishlisted');

      button.querySelector('i').className = 'bi bi-heart-fill';
    }
  });
}

function loadWishlistState() {
  if (!localStorage.getItem('token')) {
    return;
  }

  authFetch('/api/wishlist').then(parseResponse).then(applyLoadedHearts);
}

function onMostViewedError() {
  const section = document.getElementById('most-viewed-section');

  if (section) {
    section.style.display = 'none';
  }
}

function initListingsPage() {
  const listingsGrid = document.getElementById('listingsGrid');

  if (!listingsGrid) return;

  const category = new URLSearchParams(window.location.search).get('category');

  if (category) {
    const title = document.querySelector('.section-title');

    if (title) {
      title.textContent = category + ' Listings';
    }
  }

  // Populate the controls from the URL before the first fetch, so arriving via
  // a shared link or a category tile shows the matching filter state.
  applyFiltersFromUrl();

  const searchInput = document.getElementById('search-input');

  const minPrice = document.getElementById('min-price');

  const maxPrice = document.getElementById('max-price');

  const categorySelect = document.getElementById('category-select');

  const sortSelect = document.getElementById('sort-select');

  const clearButton = document.getElementById('clear-filters');

  if (searchInput) {
    searchInput.addEventListener('input', debounce(fetchListings, 300));
  }

  if (minPrice) {
    minPrice.addEventListener('input', debounce(fetchListings, 400));
  }

  if (maxPrice) {
    maxPrice.addEventListener('input', debounce(fetchListings, 400));
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', fetchListings);
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', fetchListings);
  }

  if (clearButton) {
    clearButton.addEventListener('click', clearFilters);
  }

  fetchListings();
  loadWishlistState();
  loadRecentlyViewed();

  const wishlistNavBtn = document.getElementById('btn-wishlist');

  if (wishlistNavBtn) {
    wishlistNavBtn.addEventListener('click', function () {
      window.location.href = 'wishlist.html';
    });
  }

  fetch('/api/listings/most-viewed')
    .then(parseResponse)
    .then(renderMostViewed)
    .catch(onMostViewedError);
}

// ── LISTING MODAL HELPERS ─────────────────────────────────────────────────

let selectedListing = null;
let listingModalMode = null;

function openListingModal(mode, listing) {
  selectedListing = listing;
  listingModalMode = mode;

  const modal = document.getElementById('listingModal');

  const modalTitle = document.getElementById('listingModalTitle');

  const modalMessage = document.getElementById('listingModalMessage');

  const editFields = document.getElementById('editListingFields');

  const confirmButton = document.getElementById('btnConfirmListingModal');

  if (!modal || !modalTitle || !modalMessage || !editFields || !confirmButton) {
    showWarning('Modal elements are missing.');

    return;
  }

  if (mode === 'edit') {
    modalTitle.textContent = 'Edit Listing';

    modalMessage.textContent = 'Update your listing details below.';

    confirmButton.textContent = 'Save Changes';

    editFields.classList.remove('d-none');

    document.getElementById('editTitle').value = listing.title;

    document.getElementById('editDescription').value = listing.description;

    document.getElementById('editPrice').value = listing.price;
  }

  if (mode === 'delete') {
    modalTitle.textContent = 'Delete Listing';

    modalMessage.textContent =
      'Are you sure you want to delete "' + listing.title + '"? This action cannot be undone.';

    confirmButton.textContent = 'Delete';

    editFields.classList.add('d-none');
  }

  modal.classList.remove('d-none');
}

function closeListingModal() {
  const modal = document.getElementById('listingModal');

  if (modal) {
    modal.classList.add('d-none');
  }

  selectedListing = null;
  listingModalMode = null;
}

function handleListingModalConfirm() {
  if (!selectedListing || !listingModalMode) {
    return;
  }

  if (listingModalMode === 'edit') {
    updateListingFromModal(selectedListing);
  }

  if (listingModalMode === 'delete') {
    deleteListingFromModal(selectedListing);
  }
}

function onListingUpdated(result) {
  if (result.status !== 200) {
    showWarning(result.data.message || 'Failed to update listing.');

    return;
  }

  closeListingModal();

  showToast('Listing updated successfully.');

  fetchListings();
}

function onUpdateListingError() {
  showWarning('Something went wrong while updating listing.');
}

function updateListingFromModal(listing) {
  if (!localStorage.getItem('token')) {
    showToast('Please log in to edit your listing.');

    return;
  }

  const newTitle = document.getElementById('editTitle').value.trim();

  const newDescription = document.getElementById('editDescription').value.trim();

  const newPrice = document.getElementById('editPrice').value;

  if (!newTitle || !newDescription || Number(newPrice) <= 0) {
    showWarning('Title, description and valid price are required.');

    return;
  }

  authFetch('/api/listings/' + listing.id, {
    method: 'PATCH',
    body: JSON.stringify({
      title: newTitle,
      description: newDescription,
      price: Number(newPrice),
    }),
  })
    .then(parseResponse)
    .then(onListingUpdated)
    .catch(onUpdateListingError);
}

function onListingDeleted(result) {
  if (result.status !== 200) {
    showWarning(result.data.message || 'Failed to delete listing.');

    return;
  }

  closeListingModal();

  showToast('Listing deleted successfully.');

  fetchListings();
}

function onDeleteListingError() {
  showWarning('Something went wrong while deleting listing.');
}

function deleteListingFromModal(listing) {
  if (!localStorage.getItem('token')) {
    showToast('Please log in to delete your listing.');

    return;
  }

  authFetch('/api/listings/' + listing.id, {
    method: 'DELETE',
  })
    .then(parseResponse)
    .then(onListingDeleted)
    .catch(onDeleteListingError);
}

// ── CREATE LISTING PAGE ───────────────────────────────────────────────────

function onCreateListingSuccess(result) {
  if (result.status === 201) {
    window.location.href = 'listings.html';

    return;
  }

  if (!localStorage.getItem('token')) {
    showToast('You must be logged in to create a listing.');

    return;
  }

  showWarning(result.data.message || 'Failed to create listing.');
}

function onCreateListingError() {
  if (!localStorage.getItem('token')) {
    showToast('You must be logged in to create a listing.');

    return;
  }

  showWarning('Something went wrong while creating listing.');
}

function submitListing(title, description, category, priceUsd) {
  authFetch('/api/listings', {
    method: 'POST',
    body: JSON.stringify({
      title,
      description,
      category,
      price: priceUsd,
      imageUrl: selectedListingImageUrl,
    }),
  })
    .then(parseResponse)
    .then(onCreateListingSuccess)
    .catch(onCreateListingError);
}

function handleCreateListingSubmit(event) {
  event.preventDefault();

  hideWarning();
  clearFieldErrors();

  if (!localStorage.getItem('token')) {
    showToast('You must be logged in to create a listing.');

    return;
  }

  if (isUploadingCoverImage) {
    showToast('Please wait for the photo to finish uploading.');

    return;
  }

  const title = document.getElementById('title').value.trim();

  const description = document.getElementById('description').value.trim();

  const category = document.getElementById('category').value;

  const price = document.getElementById('price').value;

  let hasError = false;

  if (!title) {
    showFieldError('title', 'Title is required.');

    hasError = true;
  }

  if (!description) {
    showFieldError('description', 'Description is required.');

    hasError = true;
  }

  if (!category) {
    showFieldError('category', 'Please select a category.');

    hasError = true;
  }

  if (!price || Number(price) <= 0) {
    showFieldError('price', 'Enter a valid price greater than 0.');

    hasError = true;
  }

  if (hasError) return;

  const code = localStorage.getItem('currency') || 'USD';

  const { rate } = CURRENCIES[code] || CURRENCIES.USD;

  submitListing(title, description, category, Number(price) / rate);
}

// ── AI IMAGE ANALYSIS ─────────────────────────────────────────────────────

function resetAnalyseButton() {
  const analyseBtn = document.getElementById('btn-analyse');

  if (!analyseBtn) return;

  analyseBtn.textContent = 'Analyse Image';

  analyseBtn.disabled = false;
}

function onAnalyseSuccess(result) {
  resetAnalyseButton();

  if (result.status !== 200) {
    showToast(result.data.message || 'Failed to analyse image.');

    return;
  }

  const titleInput = document.getElementById('title');

  const descInput = document.getElementById('description');

  if (titleInput && result.data.title) {
    titleInput.value = result.data.title;
  }

  if (descInput && result.data.description) {
    descInput.value = result.data.description;
  }

  showToast('Form pre-filled from image!');
}

function onAnalyseError() {
  resetAnalyseButton();

  showToast('Something went wrong while analysing the image.');
}

function sendAnalyseRequest(base64, mimeType) {
  authFetch('/api/listings/analyse-image', {
    method: 'POST',
    body: JSON.stringify({
      imageBase64: base64,
      mimeType,
    }),
  })
    .then(parseResponse)
    .then(onAnalyseSuccess)
    .catch(onAnalyseError);
}

function onImageRead(event) {
  const imageInput = document.getElementById('imageInput');

  if (!imageInput || !imageInput.files || !imageInput.files[0]) {
    showToast('Please select an image first.');

    return;
  }

  const base64 = event.target.result.split(',')[1];

  sendAnalyseRequest(base64, imageInput.files[0].type);
}

function handleAnalyseImage() {
  const imageInput = document.getElementById('imageInput');

  const analyseBtn = document.getElementById('btn-analyse');

  if (!imageInput || !imageInput.files || !imageInput.files[0]) {
    showToast('Please select an image first.');

    return;
  }

  if (!localStorage.getItem('token')) {
    showToast('You must be logged in to use AI analysis.');

    return;
  }

  if (analyseBtn) {
    analyseBtn.textContent = 'Analysing…';

    analyseBtn.disabled = true;
  }

  const reader = new FileReader();

  reader.onload = onImageRead;

  reader.readAsDataURL(imageInput.files[0]);
}

function onImagePicked() {
  const imageInput = document.getElementById('imageInput');

  const label = document.getElementById('upload-label');

  const coverImageStatus = document.getElementById('coverImageStatus');

  selectedListingImageUrl = null;

  if (coverImageStatus) {
    coverImageStatus.textContent = 'No cover image selected yet.';
  }

  if (!imageInput || !imageInput.files || !imageInput.files[0]) {
    if (label) {
      label.textContent = 'Choose a photo…';
    }

    return;
  }

  const file = imageInput.files[0];

  if (label) {
    label.textContent = file.name;
  }

  if (!file.type.startsWith('image/')) {
    showToast('Please choose a valid image file.');
  }
}

function openCoverImageModal() {
  const imageInput = document.getElementById('imageInput');

  const modal = document.getElementById('coverImageModal');

  if (!imageInput || !imageInput.files || !imageInput.files[0]) {
    showToast('Please choose a photo first.');

    return;
  }

  if (!imageInput.files[0].type.startsWith('image/')) {
    showToast('Please choose a valid image file.');

    return;
  }

  if (modal) {
    modal.classList.remove('d-none');
  }
}

function closeCoverImageModal() {
  const modal = document.getElementById('coverImageModal');

  if (modal) {
    modal.classList.add('d-none');
  }
}

// Uploads the chosen file to the same image host chat images use (multer ->
// node-scp, see listingImage.controller.js) and uses the returned URL as
// the listing's image_url — replaces the old approach of embedding the
// photo as a base64 data URL directly in the database.
function confirmCoverImage() {
  const imageInput = document.getElementById('imageInput');
  const coverImageStatus = document.getElementById('coverImageStatus');
  const confirmBtn = document.getElementById('btnConfirmCoverImage');

  if (!imageInput || !imageInput.files || !imageInput.files[0]) {
    showToast('Please choose a photo first.');

    return;
  }

  const token = localStorage.getItem('token');

  if (!token) {
    showToast('You must be logged in to upload a photo.');
    closeCoverImageModal();

    return;
  }

  const form = new FormData();
  form.append('cont', imageInput.files[0]);

  isUploadingCoverImage = true;

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Uploading…';
  }

  fetch('/api/listings/upload-image', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: form,
  })
    .then(function (response) {
      return response.json().then(function (data) {
        return { status: response.status, data };
      });
    })
    .then(function (result) {
      if (result.status !== 201 || !result.data.url) {
        throw new Error('upload failed');
      }

      selectedListingImageUrl = result.data.url;

      if (coverImageStatus) {
        coverImageStatus.textContent = 'This photo will be used as the listing cover image.';
      }

      closeCoverImageModal();
      showToast('Cover image uploaded.');
    })
    .catch(function () {
      showToast('Could not upload the photo, please try again.');
    })
    .finally(function () {
      isUploadingCoverImage = false;

      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Yes, Use Image';
      }
    });
}

// ── INIT CREATE LISTING PAGE ──────────────────────────────────────────────

function initCreateListingPage() {
  const listingCreateForm = document.getElementById('listingCreateForm');

  if (!listingCreateForm) return;

  if (!localStorage.getItem('token')) {
    showWarning('You must be logged in to create a listing.');
  }

  const code = localStorage.getItem('currency') || 'USD';

  const { symbol } = CURRENCIES[code] || CURRENCIES.USD;

  const priceLabel = document.getElementById('price-label');

  if (priceLabel) {
    priceLabel.textContent = 'Price (' + code + ' ' + symbol + ')';
  }

  listingCreateForm.addEventListener('submit', handleCreateListingSubmit);

  ['title', 'description', 'category', 'price'].forEach(function (id) {
    const element = document.getElementById(id);

    if (element) {
      element.addEventListener('input', function () {
        element.classList.remove('input-error');

        const error = element.parentElement.querySelector('.field-error');

        if (error) {
          error.remove();
        }
      });
    }
  });

  const analyseBtn = document.getElementById('btn-analyse');

  if (analyseBtn) {
    analyseBtn.addEventListener('click', handleAnalyseImage);
  }

  const imageInput = document.getElementById('imageInput');

  if (imageInput) {
    imageInput.addEventListener('change', onImagePicked);
  }

  const useCoverImageBtn = document.getElementById('btnUseCoverImage');

  const cancelCoverImageBtn = document.getElementById('btnCancelCoverImage');

  const confirmCoverImageBtn = document.getElementById('btnConfirmCoverImage');

  if (useCoverImageBtn) {
    useCoverImageBtn.addEventListener('click', openCoverImageModal);
  }

  if (cancelCoverImageBtn) {
    cancelCoverImageBtn.addEventListener('click', closeCoverImageModal);
  }

  if (confirmCoverImageBtn) {
    confirmCoverImageBtn.addEventListener('click', confirmCoverImage);
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  initListingsPage();
  initCreateListingPage();

  const cancelModalButton = document.getElementById('btnCancelListingModal');

  const confirmModalButton = document.getElementById('btnConfirmListingModal');

  if (cancelModalButton) {
    cancelModalButton.addEventListener('click', closeListingModal);
  }

  if (confirmModalButton) {
    confirmModalButton.addEventListener('click', handleListingModalConfirm);
  }
});
