const pool = require('./db');

module.exports.selectAll = (callback) => {
  const SQLSTATEMENT = `
        SELECT id, name, category, description, price, rating,
               review_count AS "reviewCount", icon, image_url AS "imageUrl"
        FROM products
        ORDER BY id ASC
    `;
  const VALUES = [];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.selectById = (data, callback) => {
  const SQLSTATEMENT = `
        SELECT id, name, category, description, price, rating,
               review_count AS "reviewCount", icon, image_url AS "imageUrl"
        FROM products
        WHERE id = $1
    `;
  const VALUES = [data.id];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.searchByName = (data, callback) => {
  const SQLSTATEMENT = `
        SELECT id, name, category, description, price, rating,
               review_count AS "reviewCount", icon, image_url AS "imageUrl"
        FROM products
        WHERE name ILIKE $1 OR category ILIKE $1
        ORDER BY id ASC
    `;
  const VALUES = [`%${data.search}%`];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.selectByCategory = (data, callback) => {
  const SQLSTATEMENT = `
        SELECT id, name, category, description, price, rating,
               review_count AS "reviewCount", icon, image_url AS "imageUrl"
        FROM products
        WHERE category = $1 AND id != $2
        ORDER BY id ASC
        LIMIT 4
    `;
  const VALUES = [data.category, data.excludeId];
  pool.query(SQLSTATEMENT, VALUES, callback);
};
