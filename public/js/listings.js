// ── TOAST ─────────────────────────────────────────────────────────────────

/* global authFetch, CURRENCIES, formatPrice */

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
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

function getCurrentUserId() {
  return Number(
    localStorage.getItem('loggedInUserId') ||
    localStorage.getItem('userId')
  );
}

function isOwner(listing) {
  return Number(listing.owner_id) === getCurrentUserId();
}

function createListingFilterBar() {
  const listingsGrid = document.getElementById('listingsGrid');
  if (!listingsGrid) return;

  const existing = document.getElementById('listingFilterBar');
  if (existing) return;

  const filterBar = document.createElement('div');
  filterBar.id = 'listingFilterBar';
  filterBar.className = 'listing-filter-bar';
  filterBar.innerHTML = `
    <button class="btn-primary" id="btnAllListings">All Listings</button>
    <button class="btn-primary" id="btnMyListings">My Listings</button>
  `;

  listingsGrid.parentElement.insertBefore(filterBar, listingsGrid);

  document.getElementById('btnAllListings').addEventListener('click', function () {
    currentListingFilter = 'all';
    renderListingCards(allListings);
  });

  document.getElementById('btnMyListings').addEventListener('click', function () {
    if (!localStorage.getItem('token')) {
      showToast('Please log in to view your listings.');
      return;
    }

    currentListingFilter = 'mine';
    renderListingCards(allListings);
  });
}

function renderListingCards(listings) {
  const listingsGrid = document.getElementById('listingsGrid');
  listingsGrid.innerHTML = '';

  let displayListings = listings;

  if (currentListingFilter === 'mine') {
    displayListings = listings.filter(isOwner);
  }

  if (!Array.isArray(displayListings) || displayListings.length === 0) {
    listingsGrid.innerHTML =
      currentListingFilter === 'mine'
        ? '<p class="status-text">You have not created any listings yet.</p>'
        : '<p class="status-text">No listings available yet.</p>';
    return;
  }

  displayListings.forEach(function (listing) {
    listingsGrid.appendChild(createListingCard(listing));
  });
}

function openEditListingPrompt(listing) {
  if (!localStorage.getItem('token')) {
    showToast('Please log in to edit your listing.');
    return;
  }

  const newTitle = prompt('Update title:', listing.title);
  if (newTitle === null) return;

  const newDescription = prompt('Update description:', listing.description);
  if (newDescription === null) return;

  const newPrice = prompt('Update price:', listing.price);
  if (newPrice === null) return;

  if (!newTitle.trim() || !newDescription.trim() || Number(newPrice) <= 0) {
    showWarning('Title, description and valid price are required.');
    return;
  }

  authFetch('/api/listings/' + listing.id, {
    method: 'PATCH',
    body: JSON.stringify({
      title: newTitle.trim(),
      description: newDescription.trim(),
      price: Number(newPrice),
    }),
  })
    .then(parseResponse)
    .then(function (result) {
      if (result.status !== 200) {
        showWarning(result.data.message || 'Failed to update listing.');
        return;
      }

      showToast('Listing updated successfully.');
      loadAllListings();
    })
    .catch(function () {
      showWarning('Something went wrong while updating listing.');
    });
}

function deleteListing(listing) {
  if (!localStorage.getItem('token')) {
    showToast('Please log in to delete your listing.');
    return;
  }

  const confirmed = confirm('Are you sure you want to delete this listing?');

  if (!confirmed) {
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

      showToast('Listing deleted successfully.');
      loadAllListings();
    })
    .catch(function () {
      showWarning('Something went wrong while deleting listing.');
    });
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
        <button class="btn-primary btn-edit-listing" data-id="${listing.id}">Edit</button>
        <button class="btn-secondary btn-delete-listing" data-id="${listing.id}">Delete</button>
      </div>
    `
    : '';

  card.innerHTML = `
    <div class="card-img">
      <i class="bi bi-tag" style="font-size:2.5rem;"></i>
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
      openEditListingPrompt(listing);
    });
  }

  const deleteBtn = card.querySelector('.btn-delete-listing');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      deleteListing(listing);
    });
  }

  return card;
}

// ── BROWSE LISTINGS PAGE ──────────────────────────────────────────────────

function renderListings(result) {
  const listingsGrid = document.getElementById('listingsGrid');
  listingsGrid.innerHTML = '';

  if (result.status !== 200) {
    showWarning(result.data.message || 'Failed to load listings.');
    return;
  }

  allListings = result.data;
  createListingFilterBar();
  renderListingCards(allListings);
}

function onListingsError() {
  const listingsGrid = document.getElementById('listingsGrid');
  listingsGrid.innerHTML = '';
  showWarning('Something went wrong while loading listings.');
}

function loadAllListings() {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');

  if (category) {
    const title = document.querySelector('.section-title');
    if (title) title.textContent = category + ' Listings';

    fetch('/api/listings/category/' + encodeURIComponent(category))
      .then(parseResponse)
      .then(renderListings)
      .catch(onListingsError);
  } else {
    fetch('/api/listings').then(parseResponse).then(renderListings).catch(onListingsError);
  }
} function loadAllListings() {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');

  if (category) {
    const title = document.querySelector('.section-title');
    if (title) title.textContent = category + ' Listings';

    fetch('/api/listings/category/' + encodeURIComponent(category))
      .then(parseResponse)
      .then(renderListings)
      .catch(onListingsError);
  } else {
    fetch('/api/listings').then(parseResponse).then(renderListings).catch(onListingsError);
  }
}

function initListingsPage() {
  const listingsGrid = document.getElementById('listingsGrid');
  if (!listingsGrid) return;

  loadAllListings();
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
    body: JSON.stringify({ title, description, category, price: priceUsd }),
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
  if (titleInput && result.data.title) titleInput.value = result.data.title;
  if (descInput && result.data.description) descInput.value = result.data.description;
  showToast('Form pre-filled from image!');
}

function onAnalyseError() {
  resetAnalyseButton();
  showToast('Something went wrong while analysing the image.');
}

function sendAnalyseRequest(base64, mimeType) {
  authFetch('/api/listings/analyse-image', {
    method: 'POST',
    body: JSON.stringify({ imageBase64: base64, mimeType }),
  })
    .then(parseResponse)
    .then(onAnalyseSuccess)
    .catch(onAnalyseError);
}

function onImageRead(e) {
  const imageInput = document.getElementById('imageInput');
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

  analyseBtn.textContent = 'Analysing…';
  analyseBtn.disabled = true;

  const reader = new FileReader();
  reader.onload = onImageRead;
  reader.readAsDataURL(imageInput.files[0]);
}

function onImagePicked() {
  const imageInput = document.getElementById('imageInput');
  const label = document.getElementById('upload-label');
  if (label) label.textContent = imageInput.files[0] ? imageInput.files[0].name : 'Choose a photo…';
}

// ── INIT ──────────────────────────────────────────────────────────────────

function initCreateListingPage() {
  const listingCreateForm = document.getElementById('listingCreateForm');
  if (!listingCreateForm) return;

  if (!localStorage.getItem('token')) {
    showWarning('You must be logged in to create a listing.');
  }

  const code = localStorage.getItem('currency') || 'USD';
  const { symbol } = CURRENCIES[code] || CURRENCIES.USD;
  const priceLabel = document.getElementById('price-label');
  if (priceLabel) priceLabel.textContent = 'Price (' + code + ' ' + symbol + ')';

  listingCreateForm.addEventListener('submit', handleCreateListingSubmit);

  ['title', 'description', 'category', 'price'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el)
      el.addEventListener('input', function () {
        el.classList.remove('input-error');
        const err = el.parentElement.querySelector('.field-error');
        if (err) err.remove();
      });
  });

  const analyseBtn = document.getElementById('btn-analyse');
  if (analyseBtn) analyseBtn.addEventListener('click', handleAnalyseImage);

  const imageInput = document.getElementById('imageInput');
  if (imageInput) imageInput.addEventListener('change', onImagePicked);
}

document.addEventListener('DOMContentLoaded', function () {
  initListingsPage();
  initCreateListingPage();
});
