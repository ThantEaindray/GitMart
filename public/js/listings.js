// ── TOAST ─────────────────────────────────────────────────────────────────

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
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

// ── LISTING CARD ──────────────────────────────────────────────────────────

function createListingCard(listing) {
  const card = document.createElement('article');
  card.className = 'product-card';

  const status = listing.isSold
    ? 'Sold'
    : listing.isClosed
      ? 'Closed'
      : 'Available';

  const date = new Date(listing.created_on).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  card.innerHTML = `
    <div class="product-img">
      <span class="product-icon">🏷️</span>
    </div>
    <div class="product-info">
      <h3>${listing.title}</h3>
      <p>${listing.description}</p>
      <p class="price" data-price="${listing.price}">${formatPrice(Number(listing.price))}</p>
      <p class="status-text">Status: ${status} &nbsp;·&nbsp; Listed ${date}</p>
    </div>
  `;

  return card;
}

// ── BROWSE LISTINGS PAGE ──────────────────────────────────────────────────

function initListingsPage() {
  const listingsGrid = document.getElementById('listingsGrid');
  if (!listingsGrid) return;

  fetch('/api/listings')
    .then(function (response) {
      return response.json().then(function (data) {
        return { status: response.status, data };
      });
    })
    .then(function (result) {
      listingsGrid.innerHTML = '';

      if (result.status !== 200) {
        showWarning(result.data.message || 'Failed to load listings.');
        return;
      }

      if (!Array.isArray(result.data) || result.data.length === 0) {
        listingsGrid.innerHTML = '<p class="status-text">No listings available yet.</p>';
        return;
      }

      result.data.forEach(function (listing) {
        listingsGrid.appendChild(createListingCard(listing));
      });
    })
    .catch(function () {
      listingsGrid.innerHTML = '';
      showWarning('Something went wrong while loading listings.');
    });
}

// ── CREATE LISTING PAGE ───────────────────────────────────────────────────

function handleCreateListingSubmit(event) {
  event.preventDefault();
  hideWarning();

  const token = localStorage.getItem('token');
  if (!token) {
    showToast('You must be logged in to create a listing.');
    return;
  }

  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const price = document.getElementById('price').value;

  if (!title || !description || !price) {
    showWarning('Title, description and price are required.');
    return;
  }

  if (Number(price) <= 0) {
    showWarning('Price must be more than 0.');
    return;
  }

  const code = localStorage.getItem('currency') || 'USD';
  const { rate } = CURRENCIES[code] || CURRENCIES.USD;
  const priceUsd = Number(price) / rate;

  authFetch('/api/listings', {
    method: 'POST',
    body: JSON.stringify({ title, description, price: priceUsd }),
  })
    .then(function (response) {
      return response.json().then(function (data) {
        return { status: response.status, data };
      });
    })
    .then(function (result) {
      if (result.status === 201) {
        window.location.href = 'listings.html';
        return;
      }

      if (!localStorage.getItem('token')) {
        showToast('You must be logged in to create a listing.');
        return;
      }

      showWarning(result.data.message || 'Failed to create listing.');
    })
    .catch(function () {
      showWarning('Something went wrong while creating listing.');
    });
}

function initCreateListingPage() {
  const listingCreateForm = document.getElementById('listingCreateForm');
  if (!listingCreateForm) return;

  if (!localStorage.getItem('token')) {
    showWarning('You must be logged in to create a listing.');
  }

  const code = localStorage.getItem('currency') || 'USD';
  const { symbol } = CURRENCIES[code] || CURRENCIES.USD;
  const priceLabel = document.getElementById('price-label');
  if (priceLabel) priceLabel.textContent = `Price (${code} ${symbol})`;

  listingCreateForm.addEventListener('submit', handleCreateListingSubmit);
}

// ── INIT ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  initListingsPage();
  initCreateListingPage();
});
