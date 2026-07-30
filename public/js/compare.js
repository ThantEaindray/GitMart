// compare.js
// Runs only on compare.html — reads IDs from localStorage and renders the comparison table.
// compare-tray.js manages writing to localStorage; this file only reads it.

// ── Constants ─────────────────────────────────────────────────────────────

const COMPARE_KEY = 'compareItems';

// ── Storage helper ────────────────────────────────────────────────────────

function getStoredItems() {
  try {
    return JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function removeStoredItem(id) {
  const current = getStoredItems();
  localStorage.setItem(
    COMPARE_KEY,
    JSON.stringify(
      current.filter(function notId(i) {
        return String(i.id) !== String(id);
      }),
    ),
  );
}

// ── Formatting helpers ────────────────────────────────────────────────────

function formatPrice(val) {
  const n = parseFloat(val);
  return isNaN(n) ? val : '$' + n.toFixed(2);
}

function relativeDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return days + ' days ago';
  return new Date(iso).toLocaleDateString();
}

function statusLabel(listing) {
  if (listing.isSold) return { text: 'Sold', cls: 'compare-status-sold' };
  if (listing.isClosed) return { text: 'Closed', cls: 'compare-status-closed' };
  return { text: 'Available', cls: 'compare-status-available' };
}

// ── API ───────────────────────────────────────────────────────────────────

function parseListing(r) {
  if (!r.ok) throw new Error('Listing not found');
  return r.json();
}

function fetchListing(id) {
  return fetch('/api/listings/' + id).then(parseListing);
}

// ── Empty state ───────────────────────────────────────────────────────────

function renderEmpty() {
  const page = document.getElementById('compare-content');
  page.innerHTML =
    '<div class="compare-empty">' +
    '<h2>Nothing to compare</h2>' +
    '<p>Add listings from the browse page using the compare button on each card.</p>' +
    '<a class="btn-primary" href="listings.html" style="text-decoration:none">Browse Listings</a>' +
    '</div>';
}

// ── Table rendering ───────────────────────────────────────────────────────

// Returns the HTML for a single data cell based on the row field.
function buildDataCell(listing, key) {
  if (key === 'price') {
    return '<span class="compare-price">' + formatPrice(listing.price) + '</span>';
  }
  if (key === 'category') {
    return '<span class="compare-badge">' + (listing.category || 'Others') + '</span>';
  }
  if (key === 'status') {
    const s = statusLabel(listing);
    return '<span class="' + s.cls + '">' + s.text + '</span>';
  }
  if (key === 'rating') {
    return listing.avg_rating
      ? '<span class="compare-stars">★ ' + listing.avg_rating + '</span>'
      : '<span style="color:var(--muted)">No ratings</span>';
  }
  if (key === 'reviews') {
    return listing.review_count
      ? listing.review_count + ' review' + (listing.review_count !== '1' ? 's' : '')
      : '—';
  }
  if (key === 'created_on') {
    return listing.created_on ? relativeDate(listing.created_on) : '—';
  }
  if (key === 'description') {
    return listing.description
      ? '<p class="compare-desc">' + listing.description + '</p>'
      : '<span style="color:var(--muted)">No description</span>';
  }
  return '—';
}

// Returns one full <div class="compare-row"> of data cells.
function buildDataRow(listings, label, key, count) {
  let cells = '<div class="compare-cell label-cell">' + label + '</div>';
  for (let i = 0; i < listings.length; i++) {
    cells += '<div class="compare-cell">' + buildDataCell(listings[i], key) + '</div>';
  }
  // Placeholder column when fewer than 3 items are being compared
  if (count < 3) {
    cells += '<div class="compare-cell" style="background:var(--bg)"></div>';
  }
  return '<div class="compare-row">' + cells + '</div>';
}

// Returns the header row with listing titles and remove buttons.
function buildHeaderRow(listings, count) {
  let cells = '<div class="compare-cell label-cell header-cell"></div>';
  for (let i = 0; i < listings.length; i++) {
    cells +=
      '<div class="compare-cell header-cell">' +
      '<div class="compare-item-title">' +
      listings[i].title +
      '</div>' +
      '<button class="compare-item-remove" data-id="' +
      listings[i].id +
      '" type="button">Remove</button>' +
      '</div>';
  }
  if (count < 3) {
    cells +=
      '<a class="compare-cell compare-add-slot" href="listings.html">' +
      '<i class="bi bi-plus-lg" style="font-size:1.2rem"></i>' +
      '<span>Add a listing</span>' +
      '</a>';
  }
  return '<div class="compare-row">' + cells + '</div>';
}

const COMPARE_ROWS = [
  { label: 'Price', key: 'price' },
  { label: 'Category', key: 'category' },
  { label: 'Status', key: 'status' },
  { label: 'Rating', key: 'rating' },
  { label: 'Reviews', key: 'reviews' },
  { label: 'Listed', key: 'created_on' },
  { label: 'Description', key: 'description' },
];

function buildDataRowHtml(row) {
  // Closure over `listings` and `count` set before calling this
  return buildDataRow(buildDataRowHtml._listings, row.label, row.key, buildDataRowHtml._count);
}

function renderTable(listings) {
  const count = listings.length;
  const content = document.getElementById('compare-content');

  // Pass context via function properties (avoids anonymous closure)
  buildDataRowHtml._listings = listings;
  buildDataRowHtml._count = count;

  const rowsHtml = COMPARE_ROWS.map(buildDataRowHtml).join('');
  content.innerHTML =
    '<div class="compare-grid cols-' +
    count +
    '">' +
    buildHeaderRow(listings, count) +
    rowsHtml +
    '</div>';

  // Wire remove buttons via event delegation
  content.addEventListener('click', onRemoveClick);

  if (window.gsap) {
    gsap.from(content.querySelectorAll('.compare-cell'), {
      opacity: 0,
      y: 10,
      duration: 0.3,
      stagger: 0.02,
      ease: 'power2.out',
    });
  }
}

// ── Remove handler ────────────────────────────────────────────────────────

function onRemoveClick(e) {
  const btn = e.target.closest('.compare-item-remove');
  if (!btn) return;
  removeStoredItem(btn.dataset.id);
  initCompare(); // re-render with updated list
}

// ── Error state ───────────────────────────────────────────────────────────

function renderLoadError() {
  const content = document.getElementById('compare-content');
  content.innerHTML =
    '<p class="status-text" style="padding:40px 0">' +
    'Failed to load listings. <a href="listings.html" style="color:var(--accent)">Go back</a>' +
    '</p>';
}

// ── Boot ──────────────────────────────────────────────────────────────────

function onListingsLoaded(listings) {
  renderTable(listings);
}

function initCompare() {
  const ids = getStoredItems().map(function getId(i) {
    return i.id;
  });
  const content = document.getElementById('compare-content');

  if (!ids.length) {
    renderEmpty();
    return;
  }

  content.innerHTML = '<p class="status-text" style="padding:40px 0">Loading listings…</p>';

  // Fetch all listings in parallel, then render
  Promise.all(ids.map(fetchListing)).then(onListingsLoaded).catch(renderLoadError);
}

document.addEventListener('DOMContentLoaded', function onDOMReady() {
  const clearAllBtn = document.getElementById('compare-clear-all');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', function onClearAll() {
      localStorage.removeItem(COMPARE_KEY);
      renderEmpty();
    });
  }
  initCompare();
});
