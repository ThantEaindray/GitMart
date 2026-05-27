function showToast(message) {
  var toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(function () { toast.classList.remove('show'); }, 3000);
}

function parseResponse(response) {
  return response.json().then(function (data) {
    return { status: response.status, data: data };
  });
}

// ── STAT CARDS ────────────────────────────────────────────────────────────

function renderStats(stats) {
  document.getElementById('stat-total').textContent  = stats.total  || 0;
  document.getElementById('stat-active').textContent = stats.active || 0;
  document.getElementById('stat-sold').textContent   = stats.sold   || 0;
  document.getElementById('stat-avg').textContent    = stats.avg_price
    ? formatPrice(Number(stats.avg_price))
    : '—';
  document.getElementById('stat-views').textContent  = stats.total_views || 0;
}

// ── CATEGORY BARS ─────────────────────────────────────────────────────────

function renderCategories(categories) {
  var container = document.getElementById('cat-breakdown');

  if (!categories || categories.length === 0) {
    container.innerHTML = '<p class="status-text">No listings yet.</p>';
    return;
  }

  var max = Math.max.apply(null, categories.map(function (c) { return Number(c.count); }));

  container.innerHTML = categories.map(function (c) {
    var pct = Math.round((Number(c.count) / max) * 100);
    return (
      '<div class="cat-row">' +
        '<span class="cat-name">' + c.category + '</span>' +
        '<div class="cat-bar-track">' +
          '<div class="cat-bar-fill" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<span class="cat-count">' + c.count + '</span>' +
      '</div>'
    );
  }).join('');
}

// ── DASHBOARD LOAD ────────────────────────────────────────────────────────

function renderViewBreakdown(rows) {
  var container = document.getElementById('view-breakdown');
  if (!rows || rows.length === 0) return;

  var max = Math.max.apply(null, rows.map(function (r) { return Number(r.view_count); }));
  container.innerHTML = rows.map(function (r) {
    var pct = Math.round((Number(r.view_count) / max) * 100);
    return (
      '<div class="cat-row">' +
        '<span class="cat-name" title="' + r.title + '">' + r.title.slice(0, 18) + (r.title.length > 18 ? '…' : '') + '</span>' +
        '<div class="cat-bar-track">' +
          '<div class="cat-bar-fill" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<span class="cat-count">' + r.view_count + '</span>' +
      '</div>'
    );
  }).join('');
}

function onDashboardLoaded(result) {
  if (result.status !== 200) {
    showToast('Failed to load dashboard stats.');
    return;
  }
  renderStats(result.data.stats);
  renderViewBreakdown(result.data.viewBreakdown);
  renderCategories(result.data.categories);
}

function onDashboardError() {
  showToast('Failed to load dashboard.');
}

// ── MY LISTINGS TABLE ─────────────────────────────────────────────────────

function renderMyListings(result) {
  var tbody = document.getElementById('listings-body');

  if (result.status !== 200 || !result.data || result.data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="status-text" style="padding:16px;">No listings yet.</td></tr>';
    return;
  }

  tbody.innerHTML = result.data.map(function (l) {
    var status = l.isSold ? 'sold' : l.isClosed ? 'closed' : 'active';
    var label  = l.isSold ? 'Sold' : l.isClosed ? 'Closed' : 'Active';
    var date   = new Date(l.created_on).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
    return (
      '<tr>' +
        '<td><a href="listing.html?id=' + l.id + '" style="color:var(--accent);">' + l.title + '</a></td>' +
        '<td>' + (l.category || '—') + '</td>' +
        '<td>' + formatPrice(Number(l.price)) + '</td>' +
        '<td style="color:var(--muted);">' + (l.view_count || 0) + '</td>' +
        '<td><span class="status-badge badge-' + status + '">' + label + '</span></td>' +
        '<td style="color:var(--muted);">' + date + '</td>' +
      '</tr>'
    );
  }).join('');
}

function onMyListingsError() {
  document.getElementById('listings-body').innerHTML =
    '<tr><td colspan="6" class="status-text" style="padding:16px;">Failed to load listings.</td></tr>';
}

// ── INIT ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  var token  = localStorage.getItem('token');
  var userId = localStorage.getItem('loggedInUserId');

  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  authFetch('/api/listings/dashboard')
    .then(parseResponse)
    .then(onDashboardLoaded)
    .catch(onDashboardError);

  fetch('/api/listings/owner/' + userId)
    .then(parseResponse)
    .then(renderMyListings)
    .catch(onMyListingsError);
});
