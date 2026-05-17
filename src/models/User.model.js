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
