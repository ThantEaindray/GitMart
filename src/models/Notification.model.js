// Notification.model.js
// SQL only. Replaces the in-memory utils/notificationStore, which lost every
// notification whenever the server restarted.

const pool = require('./db');

module.exports.create = (data, callback) => {
  const SQLSTATEMENT = `
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      link
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      user_id,
      type,
      title,
      message,
      link,
      is_read,
      created_on
  `;

  const VALUES = [data.userId, data.type, data.title, data.message, data.link || null];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getByUser = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT
      id,
      user_id,
      type,
      title,
      message,
      link,
      is_read,
      created_on
    FROM notifications
    WHERE user_id = $1
    ORDER BY
      created_on DESC,
      id DESC
  `;

  const VALUES = [data.userId];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getUnreadCount = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT COUNT(*) AS count
    FROM notifications
    WHERE user_id = $1
      AND is_read = false
  `;

  const VALUES = [data.userId];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.markRead = (data, callback) => {
  // user_id is in the WHERE clause so one user cannot mark another's
  // notification as read by guessing an id.
  const SQLSTATEMENT = `
    UPDATE notifications
    SET is_read = true
    WHERE id = $1
      AND user_id = $2
    RETURNING
      id,
      user_id,
      type,
      title,
      message,
      link,
      is_read,
      created_on
  `;

  const VALUES = [data.id, data.userId];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.markAllRead = (data, callback) => {
  // Only touches rows that are actually unread, so the write stays small.
  const SQLSTATEMENT = `
    UPDATE notifications
    SET is_read = true
    WHERE user_id = $1
      AND is_read = false
  `;

  const VALUES = [data.userId];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getEmailRecipient = (data, callback) => {
  // Used by the mailer to decide whether to send, and where to.
  const SQLSTATEMENT = `
    SELECT
      email,
      username,
      notify_email
    FROM users
    WHERE id = $1
  `;

  const VALUES = [data.userId];

  pool.query(SQLSTATEMENT, VALUES, callback);
};
