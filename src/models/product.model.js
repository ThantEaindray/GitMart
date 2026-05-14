const pool = require('./db');


// Get all products
module.exports.selectAll = (callback) => {
    const SQLSTATEMENT = `
        SELECT id, name, category, description, price, rating,
               review_count AS "reviewCount", icon
        FROM products
        ORDER BY id ASC
    `;
    const VALUES = [];

    pool.query(SQLSTATEMENT, VALUES, (error, result) => {
        if (error) return callback(error, null);
        callback(null, result.rows);
    });
};

// Get product by id
module.exports.selectById = (data, callback) => {
    const SQLSTATEMENT = `
        SELECT id, name, category, description, price, rating,
               review_count AS "reviewCount", icon
        FROM products
        WHERE id = $1
    `;
    const VALUES = [data.id];

    pool.query(SQLSTATEMENT, VALUES, (error, result) => {
        if (error) return callback(error, null);
        callback(null, result.rows);
    });
};

// Search products by name or category
module.exports.searchByName = (data, callback) => {
    const SQLSTATEMENT = `
        SELECT id, name, category, description, price, rating,
               review_count AS "reviewCount", icon
        FROM products
        WHERE name ILIKE $1 OR category ILIKE $1
        ORDER BY id ASC
    `;
    const VALUES = [`%${data.search}%`];

    pool.query(SQLSTATEMENT, VALUES, (error, result) => {
        if (error) return callback(error, null);
        callback(null, result.rows);
    });
};
