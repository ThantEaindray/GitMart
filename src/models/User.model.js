const pool = require('./db');

// Find user by username for login
module.exports.getUserByUsername = function getUserByUsername(username) {
  const sql = `
    SELECT 
      id, 
      username, 
      email, 
      password, 
      "isStaff" AS "isStaff", 
      created_on
    FROM users
    WHERE username = $1
  `;

  return pool.query(sql, [username])
    .then((result) => result.rows[0]);
};

// Find user by email to prevent duplicate registration
module.exports.getUserByEmail = function getUserByEmail(email) {
  const sql = `
    SELECT 
      id, 
      username, 
      email, 
      "isStaff" AS "isStaff", 
      created_on
    FROM users
    WHERE email = $1
  `;

  return pool.query(sql, [email])
    .then((result) => result.rows[0]);
};

// Create new user
module.exports.createUser = function createUser(username, email, hashedPassword) {
  const sql = `
    INSERT INTO users (username, email, password, "isStaff", created_on)
    VALUES ($1, $2, $3, false, CURRENT_DATE)
    RETURNING id, username, email, "isStaff" AS "isStaff", created_on
  `;

  return pool.query(sql, [username, email, hashedPassword])
    .then((result) => result.rows[0]);
};

// Get current logged-in user by id
module.exports.getUserById = function getUserById(id) {
  const sql = `
    SELECT 
      id, 
      username, 
      email, 
      "isStaff" AS "isStaff", 
      created_on
    FROM users
    WHERE id = $1
  `;

  return pool.query(sql, [id])
    .then((result) => result.rows[0]);
};