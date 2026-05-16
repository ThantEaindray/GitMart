const pool = require('./db');

module.exports.getUserByUsername = (data, callback) => {
  const SQLSTATEMENT = `
        SELECT id, username, email, password, "isStaff" AS "isStaff", created_on
        FROM users
        WHERE username = $1
    `;
  const VALUES = [data.username];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getUserByEmail = (data, callback) => {
  const SQLSTATEMENT = `
        SELECT id, username, email, "isStaff" AS "isStaff", created_on
        FROM users
        WHERE email = $1
    `;
  const VALUES = [data.email];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.createUser = (data, callback) => {
  const SQLSTATEMENT = `
        INSERT INTO users (username, email, password, "isStaff", created_on)
        VALUES ($1, $2, $3, false, CURRENT_DATE)
        RETURNING id, username, email, "isStaff" AS "isStaff", created_on
    `;
  const VALUES = [data.username, data.email, data.password];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getUserById = (data, callback) => {
  const SQLSTATEMENT = `
        SELECT id, username, email, "isStaff" AS "isStaff", created_on
        FROM users
        WHERE id = $1
    `;
  const VALUES = [data.id];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getUserSettings = (data, callback) => {
  const SQLSTATEMENT = `
        SELECT theme, currency, font_size, display_name, notify_orders, notify_promotions
        FROM users
        WHERE id = $1
    `;
  const VALUES = [data.id];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.saveRefreshToken = (data, callback) => {
  const SQLSTATEMENT = `
        INSERT INTO refresh_tokens (user_id, token, expires_at)
        VALUES ($1, $2, $3)
    `;
  pool.query(SQLSTATEMENT, [data.userId, data.token, data.expiresAt], callback);
};

module.exports.getRefreshToken = (data, callback) => {
  const SQLSTATEMENT = `
        SELECT id, user_id, expires_at
        FROM refresh_tokens
        WHERE token = $1
    `;
  pool.query(SQLSTATEMENT, [data.token], callback);
};

module.exports.deleteRefreshToken = (data, callback) => {
  const SQLSTATEMENT = `DELETE FROM refresh_tokens WHERE token = $1`;
  pool.query(SQLSTATEMENT, [data.token], callback);
};

module.exports.deleteAllRefreshTokensForUser = (data, callback) => {
  const SQLSTATEMENT = `DELETE FROM refresh_tokens WHERE user_id = $1`;
  pool.query(SQLSTATEMENT, [data.userId], callback);
};

module.exports.updateDisplayName = (data, callback) => {
  const SQLSTATEMENT = `UPDATE users SET display_name = $2 WHERE id = $1`;
  pool.query(SQLSTATEMENT, [data.id, data.displayName || null], callback);
};

module.exports.updateNotifications = (data, callback) => {
  const SQLSTATEMENT = `
        UPDATE users SET notify_orders = $2, notify_promotions = $3
        WHERE id = $1
    `;
  pool.query(SQLSTATEMENT, [data.id, data.notifyOrders, data.notifyPromotions], callback);
};

module.exports.deleteUser = (data, callback) => {
  const SQLSTATEMENT = `DELETE FROM users WHERE id = $1`;
  pool.query(SQLSTATEMENT, [data.id], callback);
};

module.exports.getUserPasswordById = (data, callback) => {
  const SQLSTATEMENT = `SELECT password FROM users WHERE id = $1`;
  pool.query(SQLSTATEMENT, [data.id], callback);
};

module.exports.updateUserPassword = (data, callback) => {
  const SQLSTATEMENT = `UPDATE users SET password = $2 WHERE id = $1`;
  pool.query(SQLSTATEMENT, [data.id, data.password], callback);
};

module.exports.updateUserSettings = (data, callback) => {
  const SQLSTATEMENT = `
        UPDATE users
        SET theme = $1, currency = $2, font_size = $3
        WHERE id = $4
        RETURNING theme, currency, font_size
    `;
  const VALUES = [data.theme, data.currency, data.fontSize, data.id];
  pool.query(SQLSTATEMENT, VALUES, callback);
};


module.exports.namesPictures = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT username, icon FROM users
    WHERE id = `
}