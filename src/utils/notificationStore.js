// notificationStore.js
// In-memory notification store. No SQL — lives in utils, not models.
// Callbacks fire synchronously (no I/O) but also return their result for
// callers that need the value directly (e.g. the SSE stream endpoint).

const notifications = [];
let nextId = 1;

const TYPE_ICONS = {
  order: 'bi-bag-check',
  order_status: 'bi-arrow-repeat',
  reservation: 'bi-calendar-check',
  reservation_status: 'bi-calendar2-check',
  wishlist: 'bi-heart',
  message: 'bi-chat-left-dots',
  system: 'bi-info-circle',
};

// ── Predicate helpers ─────────────────────────────────────────────────────

function belongsToUser(uid) {
  return function matchUser(n) {
    return n.userId === uid;
  };
}

function isUnread(n) {
  return !n.isRead;
}

function matchesId(id, uid) {
  return function matchNotif(n) {
    return n.id === Number(id) && n.userId === uid;
  };
}

function markAsRead(uid) {
  return function setRead(n) {
    if (n.userId === uid) n.isRead = true;
  };
}

// ── Exports ───────────────────────────────────────────────────────────────

module.exports.create = (data, callback) => {
  const n = {
    id: nextId++,
    userId: String(data.userId),
    type: data.type,
    icon: TYPE_ICONS[data.type] || 'bi-bell',
    title: data.title,
    message: data.message,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  notifications.push(n);
  if (callback) callback(null, n);
  return n;
};

module.exports.getByUser = (data, callback) => {
  const result = notifications
    .filter(belongsToUser(String(data.userId)))
    .slice()
    .reverse();
  if (callback) callback(null, result);
  return result;
};

module.exports.getUnreadCount = (data, callback) => {
  const count = notifications.filter(belongsToUser(String(data.userId))).filter(isUnread).length;
  if (callback) callback(null, count);
  return count;
};

module.exports.markRead = (data, callback) => {
  const n = notifications.find(matchesId(data.id, String(data.userId)));
  if (n) n.isRead = true;
  if (callback) callback(null, n || null);
  return n || null;
};

module.exports.markAllRead = (data, callback) => {
  notifications.forEach(markAsRead(String(data.userId)));
  if (callback) callback(null);
};
