// Notification.controller.js
const model = require('../utils/notificationStore');
const sseManager = require('../utils/sseManager');

// ── GET /api/notifications/stream ────────────────────────────────────────
// Keeps the HTTP connection open and pushes named events via Server-Sent Events.

module.exports.stream = (req, res) => {
  const userId = res.locals.userId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering if present
  res.flushHeaders();

  sseManager.register(userId, res);

  // Send the current unread count immediately so the badge is correct on connect.
  // model.getUnreadCount is synchronous (in-memory), so the return value is used directly.
  const unreadCount = model.getUnreadCount({ userId });
  res.write('event: init\ndata: ' + JSON.stringify({ unreadCount }) + '\n\n');

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
};

// ── GET /api/notifications ────────────────────────────────────────────────

module.exports.getAll = (req, res) => {
  const data = { userId: res.locals.userId };

  const callback = (error, items) => {
    if (error) return res.status(500).json({ message: 'Internal server error' });
    res.json(items);
  };

  model.getByUser(data, callback);
};

// ── GET /api/notifications/unread-count ──────────────────────────────────

module.exports.getUnreadCount = (req, res) => {
  const data = { userId: res.locals.userId };

  const callback = (error, count) => {
    if (error) return res.status(500).json({ message: 'Internal server error' });
    res.json({ count });
  };

  model.getUnreadCount(data, callback);
};

// ── PATCH /api/notifications/:id/read ────────────────────────────────────

module.exports.markRead = (req, res) => {
  const data = { id: req.params.id, userId: res.locals.userId };

  const callback = (error, n) => {
    if (error) return res.status(500).json({ message: 'Internal server error' });
    if (!n) return res.status(404).json({ message: 'Notification not found.' });
    res.json(n);
  };

  model.markRead(data, callback);
};

// ── PATCH /api/notifications/read-all ────────────────────────────────────

module.exports.markAllRead = (req, res) => {
  const data = { userId: res.locals.userId };

  const callback = (error) => {
    if (error) return res.status(500).json({ message: 'Internal server error' });
    // Push a badge update so any open SSE clients clear their count immediately.
    sseManager.send(res.locals.userId, 'badge', { unreadCount: 0 });
    res.json({ message: 'All notifications marked as read.' });
  };

  model.markAllRead(data, callback);
};
