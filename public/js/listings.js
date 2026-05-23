document.addEventListener('DOMContentLoaded', () => {
  // ── SHARED ELEMENTS ───────────────────────────────
  const warningCard = document.getElementById('warningCard');
  const warningText = document.getElementById('warningText');

  // Show validation or backend messages
  const showWarning = (message) => {
    if (warningCard && warningText) {
      warningText.textContent = message;
      warningCard.classList.remove('d-none');
    } else {
      alert(message);
    }
  };

  // Hide old warning messages
  const hideWarning = () => {
    if (warningCard && warningText) {
      warningText.textContent = '';
      warningCard.classList.add('d-none');
    }
  };

  // ── LISTING CARD HELPER ───────────────────────────
  const createListingCard = (listing) => {
    const card = document.createElement('article');
    card.className = 'product-card';

    const status = listing.isSold
      ? 'Sold'
      : listing.isClosed
        ? 'Closed'
        : 'Available';

    card.innerHTML = `
      <div class="product-img">
        <span>[ LISTING IMAGE ]</span>
      </div>

      <div class="product-info">
        <h3>${listing.title}</h3>
        <p>${listing.description}</p>
        <p class="price">$${listing.price}</p>
        <p class="status-text">Status: ${status}</p>
      </div>
    `;

    return card;
  };

  // ── BROWSE LISTINGS PAGE ──────────────────────────
  const initListingsPage = () => {
    const listingsGrid = document.getElementById('listingsGrid');

    // Stop if this page does not contain the listings grid
    if (!listingsGrid) {
      return;
    }

    fetch('/api/listings')
      .then((response) =>
        response.json().then((data) => ({
          status: response.status,
          data,
        }))
      )
      .then(({ status, data }) => {
        console.log('Listings response:', status, data);

        listingsGrid.innerHTML = '';

        if (status !== 200) {
          showWarning(data.message || data.error || 'Failed to load listings.');
          return;
        }

        if (!Array.isArray(data) || data.length === 0) {
          listingsGrid.innerHTML = '<p class="status-text">No listings available yet.</p>';
          return;
        }

        data.forEach((listing) => {
          listingsGrid.appendChild(createListingCard(listing));
        });
      })
      .catch((error) => {
        console.error('Listings error:', error);
        listingsGrid.innerHTML = '';
        showWarning('Something went wrong while loading listings.');
      });
  };

  // ── CREATE LISTING PAGE ───────────────────────────
  const initCreateListingPage = () => {
    const listingCreateForm = document.getElementById('listingCreateForm');

    // Stop if this page does not contain the create listing form
    if (!listingCreateForm) {
      return;
    }

    listingCreateForm.addEventListener('submit', (event) => {
      event.preventDefault();
      hideWarning();

      const token = localStorage.getItem('token');

      if (!token) {
        showWarning('Please log in before creating a listing.');
        return;
      }

      // Read listing form inputs
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

      // Current backend uses placeholder image data based on existing BYTEA schema
      fetch('/api/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          price: Number(price),
        }),
      })
        .then((response) =>
          response.json().then((data) => ({
            status: response.status,
            data,
          }))
        )
        .then(({ status, data }) => {
          console.log('Create listing response:', status, data);

          if (status === 201) {
            window.location.href = 'listings.html';
          } else {
            showWarning(data.message || data.error || 'Failed to create listing.');
          }
        })
        .catch((error) => {
          console.error('Create listing error:', error);
          showWarning('Something went wrong while creating listing.');
        });
    });
  };

  // ── INITIALISE PAGE LOGIC ─────────────────────────
  initListingsPage();
  initCreateListingPage();
});