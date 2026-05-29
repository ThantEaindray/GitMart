// ── TOAST ─────────────────────────────────────────────────────────────────

/* global authFetch, CURRENCIES, formatPrice */

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
  if (existing) existing.remove();

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
    return { status: response.status, data };
  });
}

let allListings = [];
let currentListingFilter = 'all';
let currentSearchTerm = '';
let currentSortMode = 'newest';
let selectedListingImageUrl = null;
let pendingCoverImageUrl = null;

function updateFilterButtonState() {
  const allButton = document.getElementById('btnAllListings');
  const myButton = document.getElementById('btnMyListings');

  if (!allButton || !myButton) return;

  allButton.classList.toggle('active', currentListingFilter === 'all');
  myButton.classList.toggle('active', currentListingFilter === 'mine');
}

function getCurrentUserId() {
  return Number(localStorage.getItem('loggedInUserId') || localStorage.getItem('userId'));
}

function isOwner(listing) {
  return Number(listing.owner_id) === getCurrentUserId();
}

function getVisibleListings() {
  let visibleListings = [...allListings];

  // Filter between all listings and logged-in user's listings
  if (currentListingFilter === 'mine') {
    visibleListings = visibleListings.filter(isOwner);
  }

  // Search by title, description or category
  if (currentSearchTerm) {
    visibleListings = visibleListings.filter(function (listing) {
      const title = String(listing.title || '').toLowerCase();
      const description = String(listing.description || '').toLowerCase();
      const category = String(listing.category || '').toLowerCase();

      return (
        title.includes(currentSearchTerm) ||
        description.includes(currentSearchTerm) ||
        category.includes(currentSearchTerm)
      );
    });
  }

  // Sort the visible listings
  if (currentSortMode === 'price-low') {
    visibleListings.sort(function (a, b) {
      return Number(a.price) - Number(b.price);
    });
  } else if (currentSortMode === 'price-high') {
    visibleListings.sort(function (a, b) {
      return Number(b.price) - Number(a.price);
    });
  } else {
    visibleListings.sort(function (a, b) {
      return new Date(b.created_on) - new Date(a.created_on);
    });
  }

  return visibleListings;
}
// ── LISTING FILTER BAR ────────────────────────────────────────────────────

function createListingFilterBar() {
  const listingsGrid = document.getElementById('listingsGrid');
  if (!listingsGrid) return;

  const existing = document.getElementById('listingFilterBar');
  if (existing) {
    updateFilterButtonState();
    return;
  }

  const filterBar = document.createElement('div');
  filterBar.id = 'listingFilterBar';
  filterBar.className = 'listing-filter-bar';

  filterBar.innerHTML = `
    <button class="btn-primary" id="btnAllListings" type="button">All Listings</button>
    <button class="btn-primary" id="btnMyListings" type="button">My Listings</button>
  `;

  listingsGrid.parentElement.insertBefore(filterBar, listingsGrid);

  const allListingsButton = document.getElementById('btnAllListings');
  const myListingsButton = document.getElementById('btnMyListings');

  if (allListingsButton) {
    allListingsButton.addEventListener('click', function () {
      currentListingFilter = 'all';
      updateFilterButtonState();
      renderListingCards(getVisibleListings());
    });
  }

  if (myListingsButton) {
    myListingsButton.addEventListener('click', function () {
      if (!localStorage.getItem('token')) {
        showToast('Please log in to view your listings.');
        return;
      }

      currentListingFilter = 'mine';
      updateFilterButtonState();
      renderListingCards(getVisibleListings());
    });
  }

  updateFilterButtonState();
}

function createListingSearchSortBar() {
  const listingsGrid = document.getElementById('listingsGrid');
  if (!listingsGrid) return;

  const existing = document.getElementById('listingSearchSortBar');
  if (existing) return;

  const toolbar = document.createElement('div');
  toolbar.id = 'listingSearchSortBar';
  toolbar.className = 'listing-search-sort-bar';

  toolbar.innerHTML = `
    <div class="listing-search-box">
      <i class="bi bi-search"></i>
      <input
        id="listingSearchInput"
        type="text"
        placeholder="Search by title, description or category..."
        autocomplete="off"
      />
    </div>

    <select id="listingSortSelect" class="listing-sort-select">
      <option value="newest">Newest First</option>
      <option value="price-low">Price: Low to High</option>
      <option value="price-high">Price: High to Low</option>
    </select>
  `;

  listingsGrid.parentElement.insertBefore(toolbar, listingsGrid);

  const searchInput = document.getElementById('listingSearchInput');
  const sortSelect = document.getElementById('listingSortSelect');

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      currentSearchTerm = searchInput.value.trim().toLowerCase();
      renderListingCards(getVisibleListings());
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      currentSortMode = sortSelect.value;
      renderListingCards(getVisibleListings());
    });
  }
}

// ── LISTING CARD ──────────────────────────────────────────────────────────

function goToListing() {
  window.location.href = 'listing.html?id=' + this.dataset.id;
}

function createListingCard(listing) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = listing.id;

  const status = listing.isSold ? 'Sold' : listing.isClosed ? 'Closed' : 'Available';

  const date = new Date(listing.created_on).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const ownerControls = isOwner(listing)
    ? `
      <div class="owner-actions">
        <button class="btn-primary btn-edit-listing" data-id="${listing.id}" type="button">Edit</button>
        <button class="btn-secondary btn-delete-listing" data-id="${listing.id}" type="button">Delete</button>
      </div>
    `
    : '';

  const listingImage = listing.image_url
    ? `<img src="${listing.image_url}" alt="${listing.title}" class="listing-card-image" />`
    : '<i class="bi bi-tag" style="font-size:2.5rem;"></i>';

  card.innerHTML = `
    <div class="card-img">
      ${listingImage}
    </div>

    <div class="card-body">
      <div class="card-cat">${status} &nbsp;·&nbsp; ${date}</div>
      <div class="card-name">${listing.title}</div>
      <p style="font-size:0.82em;color:var(--muted);margin:6px 0 10px;line-height:1.5;">${listing.description}</p>
      <div class="card-footer">
        <span class="card-price" data-price="${listing.price}">${formatPrice(Number(listing.price))}</span>
      </div>
      ${ownerControls}
    </div>
  `;

  card.addEventListener('click', goToListing);

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

// ── RENDER LISTINGS ───────────────────────────────────────────────────────

function renderListingCards(listings) {
  const listingsGrid = document.getElementById('listingsGrid');
  if (!listingsGrid) return;

  listingsGrid.innerHTML = '';

  let displayListings = listings;

  if (!Array.isArray(displayListings) || displayListings.length === 0) {
    listingsGrid.innerHTML =
      currentListingFilter === 'mine'
        ? `
          <div class="listing-empty-state">
            <i class="bi bi-shop"></i>
            <h3>No listings created yet</h3>
            <p>You have not created any listings yet. Create your first listing to start selling on GitMart.</p>
            <a href="listing-create.html" class="btn-primary">Create Listing</a>
          </div>
        `
        : `
          <div class="listing-empty-state">
            <i class="bi bi-tags"></i>
            <h3>No listings available</h3>
            <p>There are no marketplace listings available at the moment.</p>
          </div>
        `;
    return;
  }

  displayListings.forEach(function (listing) {
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

  allListings = result.data;
  createListingFilterBar();
  createListingSearchSortBar();
  renderListingCards(getVisibleListings());
}

function onListingsError() {
  const listingsGrid = document.getElementById('listingsGrid');

  if (listingsGrid) {
    listingsGrid.innerHTML = '';
  }

  showWarning('Something went wrong while loading listings.');
}

function loadAllListings() {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');

  if (category) {
    const title = document.querySelector('.section-title');

    if (title) {
      title.textContent = category + ' Listings';
    }

    fetch('/api/listings/category/' + encodeURIComponent(category))
      .then(parseResponse)
      .then(renderListings)
      .catch(onListingsError);
  } else {
    fetch('/api/listings')
      .then(parseResponse)
      .then(renderListings)
      .catch(onListingsError);
  }
}

function initListingsPage() {
  const listingsGrid = document.getElementById('listingsGrid');
  if (!listingsGrid) return;

  loadAllListings();
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
    modalMessage.textContent = 'Are you sure you want to delete "' + listing.title + '"? This action cannot be undone.';
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
  if (!selectedListing || !listingModalMode) return;

  if (listingModalMode === 'edit') {
    updateListingFromModal(selectedListing);
  }

  if (listingModalMode === 'delete') {
    deleteListingFromModal(selectedListing);
  }
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
    .then(function (result) {
      if (result.status !== 200) {
        showWarning(result.data.message || 'Failed to update listing.');
        return;
      }

      closeListingModal();
      showToast('Listing updated successfully.');
      loadAllListings();
    })
    .catch(function () {
      showWarning('Something went wrong while updating listing.');
    });
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
    .then(function (result) {
      if (result.status !== 200) {
        showWarning(result.data.message || 'Failed to delete listing.');
        return;
      }

      closeListingModal();
      showToast('Listing deleted successfully.');
      loadAllListings();
    })
    .catch(function () {
      showWarning('Something went wrong while deleting listing.');
    });
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

function onImageRead(e) {
  const imageInput = document.getElementById('imageInput');

  if (!imageInput || !imageInput.files || !imageInput.files[0]) {
    showToast('Please select an image first.');
    return;
  }

  const base64 = e.target.result.split(',')[1];
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
  pendingCoverImageUrl = null;

  if (coverImageStatus) {
    coverImageStatus.textContent = 'No cover image selected yet.';
  }

  if (!imageInput || !imageInput.files || !imageInput.files[0]) {
    if (label) label.textContent = 'Choose a photo…';
    return;
  }

  const file = imageInput.files[0];

  if (label) {
    label.textContent = file.name;
  }

  if (!file.type.startsWith('image/')) {
    showToast('Please choose a valid image file.');
    return;
  }

  const reader = new FileReader();

  reader.onload = function () {
    pendingCoverImageUrl = reader.result;
  };

  reader.readAsDataURL(file);
}

function openCoverImageModal() {
  const imageInput = document.getElementById('imageInput');
  const modal = document.getElementById('coverImageModal');

  if (!imageInput || !imageInput.files || !imageInput.files[0]) {
    showToast('Please choose a photo first.');
    return;
  }

  if (!pendingCoverImageUrl) {
    showToast('Please wait for the image to finish loading.');
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

function confirmCoverImage() {
  const coverImageStatus = document.getElementById('coverImageStatus');

  if (!pendingCoverImageUrl) {
    showToast('Please choose a photo first.');
    return;
  }

  selectedListingImageUrl = pendingCoverImageUrl;

  if (coverImageStatus) {
    coverImageStatus.textContent = 'This photo will be used as the listing cover image.';
  }

  closeCoverImageModal();
  showToast('Cover image selected.');
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
    const el = document.getElementById(id);

    if (el) {
      el.addEventListener('input', function () {
        el.classList.remove('input-error');

        const err = el.parentElement.querySelector('.field-error');

        if (err) {
          err.remove();
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