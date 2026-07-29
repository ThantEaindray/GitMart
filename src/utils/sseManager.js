// In-memory registry of SSE response objects keyed by userId.
// Works for single-process Node.js deployments.
const clients = {};

module.exports.register = function registerClient(userId, res) {
  const key      = String(userId);
  const existing = clients[key];
  // Close any existing connection for this user (e.g. page refresh)
  if (existing) {
    try { existing.end(); } catch (e) { /* already closed */ }
  }
  clients[key] = res;
};

module.exports.unregister = function unregisterClient(userId) {
  delete clients[String(userId)];
};

module.exports.send = function sendEvent(userId, eventType, data) {
  const res = clients[String(userId)];
  if (!res) return false;
  try {
    res.write('event: ' + eventType + '\ndata: ' + JSON.stringify(data) + '\n\n');
    return true;
  } catch (e) {
    delete clients[String(userId)];
    return false;
  }
};
