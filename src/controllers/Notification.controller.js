// Notification.controller.js
const model = require('../models/Notification.model');
const sseManager = require('../utils/sseManager');
const { toClientShape } = require('../utils/notifier');

// COUNT(*) is a bigint, and node-postgres returns bigint as a STRING to avoid
// precision loss. Number() here stops '3' reaching the client where `count > 0`
// and arithmetic would misbehave.
function readCount(result) {
  return Number(result.rows[0].count);
}

// ── GET /api/notifications/stream ────────────────────────────────────────
// Holds the HTTP connection open and pushes named events via Server-Sent Events.

module.exports.stream = (req, res) => {
  const userId = res.locals.userId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering if present
  res.flushHeaders();

  sseManager.register(userId, res);

  // Keep-alive comment line every 20 s so proxies don't close the idle connection.
  const keepAlive = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch (_e) {
      clearInterval(keepAlive);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseManager.unregister(userId);
  });

  // Send the current unread count so the badge is correct on connect. This is
  // now a database read, so it resolves after the stream is already open.
  const callback = (error, result) => {
    if (error) {
      console.error(error);
      return;
    }
    try {
      res.write(
        'event: init\ndata: ' + JSON.stringify({ unreadCount: readCount(result) }) + '\n\n',
      );
    } catch (_e) {
      /* client disconnected before the count came back */
    }
  };

  model.getUnreadCount({ userId }, callback);
};

// ── GET /api/notifications ────────────────────────────────────────────────

module.exports.getAll = (req, res) => {
  const data = { userId: res.locals.userId };

  const callback = (error, result) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json(result.rows.map(toClientShape));
  };

  model.getByUser(data, callback);
};

// ── GET /api/notifications/unread-count ──────────────────────────────────

module.exports.getUnreadCount = (req, res) => {
  const data = { userId: res.locals.userId };

  const callback = (error, result) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json({ count: readCount(result) });
  };

  model.getUnreadCount(data, callback);
};

// ── PATCH /api/notifications/:id/read ────────────────────────────────────

module.exports.markRead = (req, res) => {
  const notificationId = Number(req.params.id);

  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({ message: 'Notification ID must be a positive integer.' });
  }

  const data = { id: notificationId, userId: res.locals.userId };

  const callback = (error, result) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    // Zero rows means it does not exist OR belongs to someone else. Both answer
    // 404 so this cannot be used to probe which notification ids exist.
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found.' });
    }
    return res.status(200).json(toClientShape(result.rows[0]));
  };

  model.markRead(data, callback);
};

// ── PATCH /api/notifications/read-all ────────────────────────────────────

module.exports.markAllRead = (req, res) => {
  const data = { userId: res.locals.userId };

  const callback = (error) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    // Push a badge update so any open SSE clients clear their count immediately.
    sseManager.send(res.locals.userId, 'badge', { unreadCount: 0 });
    return res.status(200).json({ message: 'All notifications marked as read.' });
  };

  model.markAllRead(data, callback);
};
