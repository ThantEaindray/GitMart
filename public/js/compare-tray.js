// compare-tray.js
// Adds a "Compare" button to every listing card and manages the fixed comparison tray.
// Uses localStorage so compare selections persist across page navigations.

// ── Constants ─────────────────────────────────────────────────────────────

const COMPARE_STORAGE_KEY = 'compareItems';
const COMPARE_MAX = 3;

// ── Storage helpers ───────────────────────────────────────────────────────

function getCompareItems() {
  try {
    return JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveCompareItems(items) {
  localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(items));
}

function isCompared(id) {
  return getCompareItems().some(function checkId(item) {
    return String(item.id) === String(id);
  });
}

// ── Card data extraction ──────────────────────────────────────────────────

function extractCardData(card) {
  const nameEl = card.querySelector('.card-name');
  const catEl = card.querySelector('.card-cat');
  const priceEl = card.querySelector('.card-price');
  return {
    id: card.dataset.id,
    title: nameEl ? nameEl.textContent.trim() : 'Listing',
    category: catEl ? catEl.textContent.trim() : '',
    price: priceEl ? priceEl.getAttribute('data-price') || priceEl.textContent.trim() : '0',
  };
}

// ── Compare button state ──────────────────────────────────────────────────

function syncCompareBtn(btn, id) {
  const selected = isCompared(id);
  btn.classList.toggle('selected', selected);
  btn.setAttribute('title', selected ? 'Remove from compare' : 'Add to compare');
  btn.innerHTML = selected ? '<i class="bi bi-check-lg"></i>' : '<i class="bi bi-sliders"></i>';
}

function syncAllCompareBtnsForId(id) {
  document
    .querySelectorAll('.card[data-id="' + id + '"] .btn-compare')
    .forEach(function resyncBtn(btn) {
      syncCompareBtn(btn, id);
    });
}

// ── Toast notification ────────────────────────────────────────────────────

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._toastTimer);
  el._toastTimer = setTimeout(function hideToast() {
    el.classList.remove('show');
  }, 2800);
}

// ── Toggle item in compare list ───────────────────────────────────────────

function toggleCompareItem(card) {
  const id = card.dataset.id;
  const items = getCompareItems();
  const idx = items.findIndex(function matchId(i) {
    return String(i.id) === String(id);
  });

  if (idx > -1) {
    items.splice(idx, 1);
  } else {
    if (items.length >= COMPARE_MAX) {
      showToast('You can compare up to ' + COMPARE_MAX + ' listings at once.');
      return;
    }
    items.push(extractCardData(card));
  }

  saveCompareItems(items);
  syncAllCompareBtnsForId(id);
  renderCompareTray();
}

// ── Attach compare button to a single card ────────────────────────────────

function attachCompareBtn(card) {
  if (card._compareAttached || !card.dataset.id) return;
  card._compareAttached = true;

  const btn = document.createElement('button');
  btn.className = 'btn-compare';
  btn.type = 'button';
  syncCompareBtn(btn, card.dataset.id);
  card.appendChild(btn);
}

// Compare button clicks are handled by event delegation (below),
// so no per-button listener is needed here.

// ── Tray rendering ────────────────────────────────────────────────────────

let compareTrayEl = null;

function buildCompareTray() {
  compareTrayEl = document.createElement('div');
  compareTrayEl.className = 'compare-tray';
  document.body.appendChild(compareTrayEl);
}

function buildChipHtml(item) {
  return (
    '<div class="compare-chip">' +
    '<span class="compare-chip-name">' +
    item.title +
    '</span>' +
    '<button class="compare-chip-remove" type="button" data-id="' +
    item.id +
    '" title="Remove">×</button>' +
    '</div>'
  );
}

function renderCompareTray() {
  if (!compareTrayEl) buildCompareTray();
  const items = getCompareItems();

  if (!items.length) {
    compareTrayEl.classList.remove('visible');
    compareTrayEl.innerHTML = '';
    return;
  }

  const chipsHtml = items.map(buildChipHtml).join('');
  compareTrayEl.innerHTML =
    '<div class="compare-tray-inner">' +
    '<span class="compare-tray-label">Compare</span>' +
    '<div class="compare-tray-chips">' +
    chipsHtml +
    '</div>' +
    '<div class="compare-tray-actions">' +
    '<span class="compare-tray-count">' +
    items.length +
    '/' +
    COMPARE_MAX +
    '</span>' +
    '<button class="compare-tray-clear" type="button">Clear</button>' +
    '<a class="btn-primary compare-tray-go" href="compare.html">Compare Now</a>' +
    '</div>' +
    '</div>';

  compareTrayEl.classList.add('visible');
}

// ── Tray interaction (event delegation) ──────────────────────────────────

function onChipRemoveClick(btn) {
  const id = btn.dataset.id;
  const items = getCompareItems();
  saveCompareItems(
    items.filter(function notThis(i) {
      return String(i.id) !== String(id);
    }),
  );
  syncAllCompareBtnsForId(id);
  renderCompareTray();
}

function onClearAllClick() {
  const currentItems = getCompareItems();
  saveCompareItems([]);
  currentItems.forEach(function resync(item) {
    syncAllCompareBtnsForId(item.id);
  });
  renderCompareTray();
}

// ── Global click delegation ───────────────────────────────────────────────

function onDocumentClick(e) {
  // Compare button on a card
  const compareBtn = e.target.closest('.btn-compare');
  if (compareBtn) {
    e.stopPropagation();
    e.preventDefault();
    const card = compareBtn.closest('.card[data-id]');
    if (card) toggleCompareItem(card);
    return;
  }

  // Remove chip in the tray
  const removeBtn = e.target.closest('.compare-chip-remove');
  if (removeBtn) {
    onChipRemoveClick(removeBtn);
    return;
  }

  // Clear all button in the tray
  if (e.target.closest('.compare-tray-clear')) {
    onClearAllClick();
  }
}

// ── MutationObserver: attach button to cards injected after page load ─────

function onNewNodes(mutations) {
  for (let i = 0; i < mutations.length; i++) {
    const added = mutations[i].addedNodes;
    for (let j = 0; j < added.length; j++) {
      const node = added[j];
      if (node.nodeType !== 1) continue;
      if (node.classList && node.classList.contains('card') && node.dataset.id) {
        attachCompareBtn(node);
      }
      if (node.querySelectorAll) {
        node.querySelectorAll('.card[data-id]').forEach(attachCompareBtn);
      }
    }
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────

// Attach to cards already in the DOM
document.querySelectorAll('.card[data-id]').forEach(attachCompareBtn);

// Watch for cards added later by page JS
const compareTrayObserver = new MutationObserver(onNewNodes);
compareTrayObserver.observe(document.body, { childList: true, subtree: true });

// Restore tray if items are already stored (e.g. after page navigation)
renderCompareTray();

// Single listener handles all compare-related clicks via delegation
document.addEventListener('click', onDocumentClick);
