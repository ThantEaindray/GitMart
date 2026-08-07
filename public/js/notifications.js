// notifications.js
// Runs only on notifications.html — loads and displays notifications,
// and connects an SSE stream so new ones appear in real time.
// Depends on authFetch() from api.js.

// ── Guard: only run on the notifications page ─────────────────────────────

const notifList = document.getElementById('notif-list');
const notifMarkAll = document.getElementById('btn-mark-all');
if (!notifList) throw new Error('notifications.js loaded on wrong page');

// ── Module state ──────────────────────────────────────────────────────────

let notifPageSSE = null;

// ── Time helpers ──────────────────────────────────────────────────────────

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return days + 'd ago';
  return new Date(iso).toLocaleDateString();
}

function groupLabel(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This week';
  return 'Older';
}

// ── Mark single notification read ─────────────────────────────────────────

function onMarkReadSuccess(n, itemEl) {
  n.isRead = true;
  itemEl.classList.replace('unread', 'read');
}

function makeMarkReadHandler(n, itemEl) {
  function onItemClick() {
    if (n.isRead) return;
    authFetch('/api/notifications/' + n.id + '/read', { method: 'PATCH' })
      .then(function handleMarkRead() {
        onMarkReadSuccess(n, itemEl);
      })
      .catch(function noop() {});
  }
  return onItemClick;
}

// "Go to this page, or just leave it marked as read" — two separate
// choices, not one click doing both. Clicking the row (or its own View
// link) only ever marks read; the View link additionally navigates, via
// its own handler below, rather than the row hijacking every click into a
// navigation the moment a notification happens to have a link.
function makeViewLinkHandler(n, itemEl) {
  function onViewClick(event) {
    // Let the anchor's href do the navigating; this only needs to also
    // mark the notification read on the way out, and stop the click from
    // separately bubbling to the row's own (redundant) mark-read handler.
    event.stopPropagation();
    if (!n.isRead) {
      authFetch('/api/notifications/' + n.id + '/read', { method: 'PATCH' })
        .then(function handleMarkRead() {
          onMarkReadSuccess(n, itemEl);
        })
        .catch(function noop() {});
    }
  }
  return onViewClick;
}

// ── Build one notification element ────────────────────────────────────────

// title/message are server-built strings that embed user-controlled text
// (usernames, listing titles) — e.g. "bob requested to reserve...". Building
// this via innerHTML string concatenation, as the rest of this function
// still does for its static (non-user-controlled) parts, would let a
// crafted username or listing title execute as HTML in every viewer's
// notification list. textContent assignment keeps it inert.
function buildNotifTextNode(className, text) {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return el;
}

function buildNotifItem(n) {
  const item = document.createElement('div');
  item.className = 'notif-item ' + (n.isRead ? 'read' : 'unread');
  item.dataset.id = n.id;
  item.innerHTML =
    '<div class="notif-icon"><i class="bi ' +
    n.icon +
    '"></i></div>' +
    '<div class="notif-body"></div>' +
    '<div class="notif-time">' +
    relativeTime(n.createdAt) +
    '</div>' +
    '<div class="notif-dot"></div>';

  const body = item.querySelector('.notif-body');
  body.appendChild(buildNotifTextNode('notif-title', n.title));
  body.appendChild(buildNotifTextNode('notif-message', n.message));

  if (n.link) {
    const viewLink = document.createElement('a');
    viewLink.className = 'notif-view-link';
    viewLink.href = n.link;
    viewLink.textContent = 'View';
    viewLink.addEventListener('click', makeViewLinkHandler(n, item));
    body.appendChild(viewLink);
  }

  item.addEventListener('click', makeMarkReadHandler(n, item));
  return item;
}

// ── Render full notification list ─────────────────────────────────────────

function buildGroupLabel(text) {
  const label = document.createElement('div');
  label.className = 'notif-group-label';
  label.textContent = text;
  return label;
}

function appendGroupedItem(n) {
  return function appendItem(lastGroup) {
    const g = groupLabel(n.createdAt);
    if (g !== lastGroup) notifList.appendChild(buildGroupLabel(g));
    notifList.appendChild(buildNotifItem(n));
    return g;
  };
}

function renderAll(notifications) {
  notifList.innerHTML = '';

  if (!notifications.length) {
    notifList.innerHTML =
      '<div class="notif-empty">' +
      '<div class="notif-empty-icon"><i class="bi bi-bell-slash"></i></div>' +
      '<h3>All caught up</h3>' +
      '<p>No notifications yet. Activity on your orders and listings will appear here.</p>' +
      '</div>';
    return;
  }

  // Build items grouped by date (Today / Yesterday / This week / Older)
  let lastGroup = null;
  for (let i = 0; i < notifications.length; i++) {
    const n = notifications[i];
    const g = groupLabel(n.createdAt);
    if (g !== lastGroup) {
      notifList.appendChild(buildGroupLabel(g));
      lastGroup = g;
    }
    notifList.appendChild(buildNotifItem(n));
  }

  if (window.gsap) {
    gsap.from(notifList.querySelectorAll('.notif-item'), {
      opacity: 0,
      y: 12,
      duration: 0.3,
      stagger: 0.05,
      ease: 'power2.out',
    });
  }
}

// ── Prepend a newly arrived notification (via SSE) ────────────────────────

function prependNotifItem(n) {
  // Clear the empty state if it's showing
  const empty = notifList.querySelector('.notif-empty');
  if (empty) notifList.innerHTML = '';

  // Ensure the "Today" group label is at the top
  const firstLabel = notifList.querySelector('.notif-group-label');
  if (!firstLabel || firstLabel.textContent !== 'Today') {
    notifList.insertBefore(buildGroupLabel('Today'), notifList.firstChild);
  }

  const item = buildNotifItem(n);
  notifList.insertBefore(item, notifList.children[1] || null);

  if (window.gsap) {
    gsap.from(item, { opacity: 0, y: -10, duration: 0.3, ease: 'power2.out' });
  }
}

// ── Load notifications from API ───────────────────────────────────────────

function onLoadError() {
  notifList.innerHTML =
    '<p class="status-text" style="padding:40px 0">Failed to load notifications.</p>';
}

function onLoadResponse(r) {
  if (r.status === 401) {
    window.location.href = 'login.html';
    return null;
  }
  return r.json();
}

function onLoadData(data) {
  if (data) renderAll(data);
}

function loadNotifications() {
  notifList.innerHTML = '<p class="status-text" style="padding:40px 0">Loading…</p>';
  authFetch('/api/notifications').then(onLoadResponse).then(onLoadData).catch(onLoadError);
}

// ── SSE connection ────────────────────────────────────────────────────────

function onPageSSENotification(e) {
  prependNotifItem(JSON.parse(e.data));
}

function onPageSSEError() {
  notifPageSSE.close();
  notifPageSSE = null;
}

function connectPageSSE() {
  const token = localStorage.getItem('token');
  if (!token) return;

  // EventSource cannot send Authorization headers — pass token as query param.
  notifPageSSE = new EventSource('/api/notifications/stream?token=' + encodeURIComponent(token));
  notifPageSSE.addEventListener('notification', onPageSSENotification);
  notifPageSSE.onerror = onPageSSEError;
}

// ── Mark all read ─────────────────────────────────────────────────────────

function markItemAsRead(el) {
  el.classList.replace('unread', 'read');
}

function onMarkAllSuccess() {
  notifList.querySelectorAll('.notif-item.unread').forEach(markItemAsRead);
}

function onMarkAllClick() {
  authFetch('/api/notifications/read-all', { method: 'PATCH' })
    .then(onMarkAllSuccess)
    .catch(function noop() {});
}

// ── Boot ──────────────────────────────────────────────────────────────────

if (notifMarkAll) {
  notifMarkAll.addEventListener('click', onMarkAllClick);
}

loadNotifications();

if (typeof EventSource !== 'undefined') {
  connectPageSSE();
}
