// ── TOAST ─────────────────────────────────────────────────────────────────

var currentListing = null;

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

  const cartButton =
    status === 'AVAILABLE'
      ? `
        <button
          class="btn-outline"
          id="btn-cart"
          type="button"
          onclick="addToCart()"
        >
          <i class="bi bi-bag"></i>
          Add to Cart
        </button>
      `
      : `
        <button
          class="btn-outline btn-unavailable"
          id="btn-cart"
          type="button"
          disabled
        >
          ${formatListingStatus(status)}
        </button>
      `;

  return `
    <div class="product-actions">
      ${contactButton}
      ${cartButton}
    </div>
  `;
}

// ── LISTING DETAIL ────────────────────────────────────────────────────────

function addToCart() {
  if (!currentListing) return;
  if (getListingStatus(currentListing) !== 'AVAILABLE') {
    showToast('Only available listings can be added to cart.');
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

      <div
        class="product-price"
        data-price="${listing.price}"
      >
        ${formatPrice(Number(listing.price))}
      </div>

      <p class="product-description">
        ${listing.description}
      </p>

      ${actions}
    </div>
  `;
}

function onListingLoaded(result) {
  const section = document.getElementById('listing-detail');

  if (result.status !== 200) {
    section.innerHTML = errorView('Listing not found.');
    return;
  }

  renderListing(result.data);
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

document.addEventListener('DOMContentLoaded', loadListing);
