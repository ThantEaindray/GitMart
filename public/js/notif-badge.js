// notif-badge.js
// Injects a notification bell into .nav-right and keeps the unread badge live via SSE.
// Depends on authFetch() from api.js — load this script after api.js.

// ── Module state ──────────────────────────────────────────────────────────

let notifBadge    = null;   // <span> badge element
let notifBellLink = null;   // <a> bell element
let notifSSE      = null;   // active EventSource

// ── Bell injection ────────────────────────────────────────────────────────

function injectBell() {
  const navRight = document.querySelector('.nav-right');
  if (!navRight || navRight.querySelector('.notif-bell')) return; // already present

  notifBellLink       = document.createElement('a');
  notifBellLink.href  = 'notifications.html';
  notifBellLink.className = 'icon-btn notif-bell';
  notifBellLink.title = 'Notifications';
  notifBellLink.innerHTML = '<i class="bi bi-bell"></i>';

  notifBadge              = document.createElement('span');
  notifBadge.className    = 'notif-badge';
  notifBadge.style.display = 'none';
  notifBellLink.appendChild(notifBadge);

  navRight.insertBefore(notifBellLink, navRight.firstChild);
}

// ── Badge updates ─────────────────────────────────────────────────────────

function setBadgeCount(count) {
  if (!notifBadge) return;
  if (count > 0) {
    notifBadge.textContent = count > 99 ? '99+' : String(count);
    notifBadge.style.display = 'flex';
  } else {
    notifBadge.style.display = 'none';
  }
}

// ── Bell shake animation ──────────────────────────────────────────────────

function onBellShakeEnd() {
  notifBellLink.classList.remove('shaking');
}

function shakeBell() {
  if (!notifBellLink) return;
  notifBellLink.classList.remove('shaking');
  void notifBellLink.offsetWidth; // force reflow so the animation restarts
  notifBellLink.classList.add('shaking');
  notifBellLink.addEventListener('animationend', onBellShakeEnd, { once: true });
}

// ── Fetch unread count (used for polling fallback) ────────────────────────

function onCountResponse(r) {
  return r.ok ? r.json() : null;
}

function onCountData(d) {
  if (d) setBadgeCount(d.count);
}

function fetchUnreadCount() {
  if (typeof authFetch !== 'function') return;
  authFetch('/api/notifications/unread-count')
    .then(onCountResponse)
    .then(onCountData)
    .catch(function noop() {});
}

// ── Polling fallback (if SSE is unavailable or errors) ───────────────────

function pollFallback() {
  fetchUnreadCount();
  setTimeout(pollFallback, 60000); // re-poll every 60 s
}

// ── SSE event handlers ────────────────────────────────────────────────────

function onSSEInit(e) {
  setBadgeCount(JSON.parse(e.data).unreadCount);
}

function onSSENotification() {
  // A new notification arrived — shake the bell and refresh the badge count.
  shakeBell();
  fetchUnreadCount();
}

function onSSEBadge(e) {
  setBadgeCount(JSON.parse(e.data).unreadCount);
}

function onSSEError() {
  notifSSE.close();
  notifSSE = null;
  // Gracefully degrade to polling
  setTimeout(pollFallback, 60000);
}

// ── SSE connection ────────────────────────────────────────────────────────

function connectSSE() {
  if (notifSSE) return;
  const token = localStorage.getItem('token');
  if (!token) return; // not logged in — bell visible but no live badge

  // EventSource cannot send custom headers, so we pass the JWT as a query param.
  // The server's verifyToken middleware accepts ?token= as a fallback.
  notifSSE = new EventSource('/api/notifications/stream?token=' + encodeURIComponent(token));

  notifSSE.addEventListener('init',         onSSEInit);
  notifSSE.addEventListener('notification', onSSENotification);
  notifSSE.addEventListener('badge',        onSSEBadge);
  notifSSE.onerror = onSSEError;
}

// ── Boot ──────────────────────────────────────────────────────────────────

function initNotifBadge() {
  injectBell();
  if (!localStorage.getItem('token')) return; // not logged in — show bell, no badge

  if (typeof EventSource !== 'undefined') {
    setTimeout(connectSSE, 200); // slight delay so the page settles first
  } else {
    pollFallback(); // SSE not supported (rare) — use polling
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotifBadge);
} else {
  initNotifBadge();
}
