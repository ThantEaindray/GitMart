const pool = require('./db');

// Create a new listing
module.exports.createListing = (data, callback) => {
  const SQLSTATEMENT = `
    INSERT INTO listings (owner_id, price, title, description, category)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, owner_id, price, created_on, title, description, category, "isSold", "isClosed"
  `;

  const VALUES = [
    data.owner_id,
    data.price,
    data.title,
    data.description,
    data.category || 'Others'
  ];

  pool.query(SQLSTATEMENT, VALUES, (error, result) => {
    if (error) return callback(error, null);
    callback(null, result.rows);
  });
};

// Get all listings
module.exports.getAllListings = (callback) => {
  const SQLSTATEMENT = `
    SELECT id, owner_id, price, created_on, title, description, category, "isSold", "isClosed"
    FROM listings
    ORDER BY id DESC
  `;

  pool.query(SQLSTATEMENT, (error, result) => {
    if (error) return callback(error, null);
    callback(null, result.rows);
  });
};

// Get listings by category
module.exports.getListingsByCategory = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT id, owner_id, price, created_on, title, description, category, "isSold", "isClosed"
    FROM listings
    WHERE category = $1
    ORDER BY id DESC
  `;

  pool.query(SQLSTATEMENT, [data.category], (error, result) => {
    if (error) return callback(error, null);
    callback(null, result.rows);
  });
};

// Get one listing by id
module.exports.getListingById = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT id, owner_id, price, created_on, title, description, "isSold", "isClosed"
    FROM listings
    WHERE id = $1
  `;

  const VALUES = [data.id];

  pool.query(SQLSTATEMENT, VALUES, (error, result) => {
    if (error) return callback(error, null);
    callback(null, result.rows);
  });
};

// Get listings created by one owner
module.exports.getListingsByOwner = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT id, owner_id, price, created_on, title, description, "isSold", "isClosed"
    FROM listings
    WHERE owner_id = $1
    ORDER BY id DESC
  `;

  const VALUES = [data.owner_id];

  pool.query(SQLSTATEMENT, VALUES, (error, result) => {
    if (error) return callback(error, null);
    callback(null, result.rows);
  });
};

// Update listing owned by logged-in user
module.exports.updateListing = (data, callback) => {
  const SQLSTATEMENT = `
    UPDATE listings
    SET title = $1,
        description = $2,
        price = $3
    WHERE id = $4 AND owner_id = $5
    RETURNING id, owner_id, price, created_on, title, description, "isSold", "isClosed"
  `;

  const VALUES = [
    data.title,
    data.description,
    data.price,
    data.id,
    data.owner_id
  ];

  pool.query(SQLSTATEMENT, VALUES, (error, result) => {
    if (error) return callback(error, null);
    callback(null, result.rows);
  });
};

// Delete listing owned by logged-in user
module.exports.deleteListing = (data, callback) => {
  const SQLSTATEMENT = `
    DELETE FROM listings
    WHERE id = $1 AND owner_id = $2
    RETURNING id
  `;

  const VALUES = [data.id, data.owner_id];

  pool.query(SQLSTATEMENT, VALUES, (error, result) => {
    if (error) return callback(error, null);
    callback(null, result.rows);
  });
};