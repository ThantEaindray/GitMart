function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function renderListing(listing) {
  const section = document.getElementById('listing-detail');
  document.title = 'GitMart — ' + listing.title;

  const status = listing.isSold ? 'Sold' : listing.isClosed ? 'Closed' : 'Available';
  const statusColor = listing.isSold || listing.isClosed ? 'var(--muted)' : 'var(--accent)';

  const date = new Date(listing.created_on).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  section.innerHTML = `
    <div class="product-img">
      <i class="bi bi-tag"></i>
    </div>
    <div class="product-info">
      <div class="card-cat" style="color:${statusColor};">${status} &nbsp;·&nbsp; Listed ${date}</div>
      <h1 class="product-name">${listing.title}</h1>
      <div class="product-price" data-price="${listing.price}">${formatPrice(Number(listing.price))}</div>
      <p class="product-description">${listing.description}</p>
      <div class="product-actions">
        <button class="btn-primary" id="btn-contact">Contact Seller</button>
      </div>
    </div>
  `;

  document.getElementById('btn-contact').addEventListener('click', function () {
    if (!localStorage.getItem('token')) {
      showToast('You must be logged in to contact a seller.');
      return;
    }
    showToast('Chat coming soon.');
  });
}

function loadListing() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    window.location.href = 'listings.html';
    return;
  }

  const section = document.getElementById('listing-detail');

  fetch('/api/listings/' + id)
    .then(function (response) {
      return response.json().then(function (data) {
        return { status: response.status, data };
      });
    })
    .then(function (result) {
      if (result.status !== 200) {
        section.innerHTML = `
          <div class="product-error">
            <p class="status-text">Listing not found.</p>
            <a href="listings.html" class="breadcrumb-back"><i class="bi bi-arrow-left"></i> Back to Listings</a>
          </div>
        `;
        return;
      }
      renderListing(result.data);
    })
    .catch(function () {
      section.innerHTML = `
        <div class="product-error">
          <p class="status-text">Failed to load listing.</p>
          <a href="listings.html" class="breadcrumb-back"><i class="bi bi-arrow-left"></i> Back to Listings</a>
        </div>
      `;
    });
}

document.addEventListener('DOMContentLoaded', loadListing);
