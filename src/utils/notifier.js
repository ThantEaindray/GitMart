// notifier.js
// One place where a notification is raised. Order controllers, reservation
// controllers and anything added later all call notify() rather than each
// keeping their own copy of "insert a row, push over SSE, send an email".

const model = require('../models/Notification.model');
const sseManager = require('./sseManager');
const mailer = require('./mailer');

// Icons are presentation, so they are derived here rather than stored per row.
// Restyling never needs a data migration.
const TYPE_ICONS = {
  order: 'bi-bag-check',
  order_status: 'bi-arrow-repeat',
  reservation: 'bi-calendar-check',
  reservation_status: 'bi-calendar2-check',
  wishlist: 'bi-heart',
  message: 'bi-chat-left-dots',
  system: 'bi-info-circle',
};

// The frontend was written against the old in-memory store's shape (isRead,
// createdAt, icon). Postgres returns snake_case and no icon, so rows are mapped
// in this one place instead of changing every template.
function toClientShape(row) {
  return {
    id: row.id,
    userId: String(row.user_id),
    type: row.type,
    icon: TYPE_ICONS[row.type] || 'bi-bell',
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    createdAt: new Date(row.created_on).toISOString(),
  };
}

module.exports.TYPE_ICONS = TYPE_ICONS;
module.exports.toClientShape = toClientShape;

// Persist first, then push over SSE, then email. Persisting first means a
// notification is never lost just because the recipient has no tab open or the
// mail provider is unreachable — those two are enhancements on top of a row
// that is already safely stored.
module.exports.notify = (userId, type, title, message) => {
  if (!userId) return;

  const data = { userId, type, title, message };

  const callback = (error, result) => {
    if (error) {
      // A failed notification must never break the action that triggered it.
      console.error(error);
      return;
    }

    // Best-effort live push. Returns false when the user has no open stream,
    // which is fine — the row is saved and will show on their next page load.
    sseManager.send(userId, 'notification', toClientShape(result.rows[0]));

    // notif-badge.js refetches the unread count whenever a 'notification' event
    // arrives, so the badge stays correct without a second query here.
    mailer.sendNotificationEmail(userId, title, message);
  };

  model.create(data, callback);
};
