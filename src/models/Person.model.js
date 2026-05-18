const pool = require('./db');

module.exports.getAllPersons = (callback) => {
  const SQLSTATEMENT = `SELECT * FROM "Person"`;
  const VALUES = [];
  pool.query(SQLSTATEMENT, VALUES, callback);
};
