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
  const card = document.createElement('div');
  card.className = 'card';

  const status = listing.isSold ? 'Sold' : listing.isClosed ? 'Closed' : 'Available';

  const date = new Date(listing.created_on).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

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
    </div>
  `;

  card.addEventListener('click', function () {
    window.location.href = 'listing.html?id=' + listing.id;
  });

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

// ── AI IMAGE ANALYSIS ─────────────────────────────────────────────────────

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

  const file = imageInput.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    const base64 = e.target.result.split(',')[1];
    const mimeType = file.type;

    analyseBtn.textContent = 'Analysing…';
    analyseBtn.disabled = true;

    authFetch('/api/listings/analyse-image', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: base64, mimeType }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { status: response.status, data };
        });
      })
      .then(function (result) {
        analyseBtn.textContent = 'Analyse Image';
        analyseBtn.disabled = false;

        if (result.status !== 200) {
          showToast(result.data.message || 'Failed to analyse image.');
          return;
        }

        const titleInput = document.getElementById('title');
        const descInput = document.getElementById('description');
        if (titleInput && result.data.title) titleInput.value = result.data.title;
        if (descInput && result.data.description) descInput.value = result.data.description;
        showToast('Form pre-filled from image!');
      })
      .catch(function () {
        analyseBtn.textContent = 'Analyse Image';
        analyseBtn.disabled = false;
        showToast('Something went wrong while analysing the image.');
      });
  };

  reader.readAsDataURL(file);
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

  const analyseBtn = document.getElementById('btn-analyse');
  if (analyseBtn) analyseBtn.addEventListener('click', handleAnalyseImage);

  const imageInput = document.getElementById('imageInput');
  if (imageInput) {
    imageInput.addEventListener('change', function () {
      const label = document.getElementById('upload-label');
      if (label) label.textContent = imageInput.files[0] ? imageInput.files[0].name : 'Choose a photo…';
    });
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  initListingsPage();
  initCreateListingPage();
});
