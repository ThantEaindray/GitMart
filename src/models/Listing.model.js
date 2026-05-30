const pool = require('./db');

module.exports.createListing = (data, callback) => {
  const SQLSTATEMENT = `
    INSERT INTO listings (owner_id, price, title, description, category, image_url)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, owner_id, price, created_on, title, description, category, image_url, "isSold", "isClosed"
  `;
  const VALUES = [data.owner_id, data.price, data.title, data.description, data.category || 'Others', data.image_url || null];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getAllListings = (callback) => {
  const SQLSTATEMENT = `
    SELECT id, owner_id, price, created_on, title, description, category, image_url, "isSold", "isClosed"
    FROM listings
    ORDER BY id DESC
  `;
  pool.query(SQLSTATEMENT, callback);
};

module.exports.getListingsByCategory = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT id, owner_id, price, created_on, title, description, category, image_url, "isSold", "isClosed"
    FROM listings
    WHERE category = $1
    ORDER BY id DESC
  `;
  const VALUES = [data.category];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getListingById = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT id, owner_id, price, created_on, title, description, category, image_url, view_count, "isSold", "isClosed"
    FROM listings
    WHERE id = $1
  `;
  const VALUES = [data.id];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getListingByIdWithView = (data, callback) => {
  const SQLSTATEMENT = `
    WITH maybe_view AS (
      INSERT INTO listing_views (listing_id, user_id)
      VALUES ($1::integer, $2::integer)
      ON CONFLICT (listing_id, user_id) DO NOTHING
      RETURNING listing_id
    )
    UPDATE listings
    SET view_count = view_count + (CASE WHEN EXISTS(SELECT 1 FROM maybe_view) THEN 1 ELSE 0 END)
    WHERE id = $1::integer
    RETURNING id, owner_id, price, created_on, title, description, category, image_url, view_count, "isSold", "isClosed"
  `;
  const VALUES = [data.id, data.userId];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getListingsByOwner = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT id, owner_id, price, created_on, title, description, category, image_url, view_count, "isSold", "isClosed"
    FROM listings
    WHERE owner_id = $1
    ORDER BY id DESC
  `;
  const VALUES = [data.owner_id];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.updateListing = (data, callback) => {
  const SQLSTATEMENT = `
    UPDATE listings
    SET title = $1,
        description = $2,
        price = $3
    WHERE id = $4 AND owner_id = $5
    RETURNING id, owner_id, price, created_on, title, description, category, image_url, "isSold", "isClosed"
  `;
  const VALUES = [data.title, data.description, data.price, data.id, data.owner_id];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getMostViewed = (callback) => {
  const SQLSTATEMENT = `
    SELECT id, owner_id, price, created_on, title, description, category, view_count, "isSold", "isClosed"
    FROM listings
    WHERE NOT "isSold" AND NOT "isClosed" AND view_count > 0
    ORDER BY view_count DESC
    LIMIT 4
  `;
  pool.query(SQLSTATEMENT, callback);
};

const SORT_MAP = {
  newest:    'created_on DESC, id DESC',
  cheapest:  'price ASC, id DESC',
  expensive: 'price DESC, id DESC',
};

module.exports.searchListings = (data, callback) => {
  const orderBy = SORT_MAP[data.sort] || SORT_MAP.newest;
  const SQLSTATEMENT = `
    SELECT id, owner_id, price, created_on, title, description, category, view_count, "isSold", "isClosed"
    FROM listings
    WHERE ($1 = '' OR title ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')
      AND ($2::numeric IS NULL OR price >= $2::numeric)
      AND ($3::numeric IS NULL OR price <= $3::numeric)
      AND ($4 = '' OR category = $4)
    ORDER BY ${orderBy}
  `;
  const VALUES = [
    data.search   || '',
    data.minPrice ? Number(data.minPrice) : null,
    data.maxPrice ? Number(data.maxPrice) : null,
    data.category || '',
  ];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getSellerViewBreakdown = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT title, view_count
    FROM listings
    WHERE owner_id = $1 AND view_count > 0
    ORDER BY view_count DESC
    LIMIT 5
  `;
  const VALUES = [data.owner_id];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getSellerStats = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE NOT "isSold" AND NOT "isClosed") AS active,
      COUNT(*) FILTER (WHERE "isSold") AS sold,
      COUNT(*) FILTER (WHERE "isClosed")  AS closed,
      ROUND(AVG(price)::numeric, 2)  AS avg_price,
      MIN(price) AS min_price,
      MAX(price) AS max_price,
      COALESCE(SUM(view_count), 0) AS total_views
    FROM listings
    WHERE owner_id = $1
  `;
  const VALUES = [data.owner_id];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getSellerCategoryBreakdown = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT category, COUNT(*) AS count
    FROM listings
    WHERE owner_id = $1
    GROUP BY category
    ORDER BY count DESC
  `;
  const VALUES = [data.owner_id];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.deleteListing = (data, callback) => {
  const SQLSTATEMENT = `
    DELETE FROM listings
    WHERE id = $1 AND owner_id = $2
    RETURNING id
  `;
  const VALUES = [data.id, data.owner_id];
  pool.query(SQLSTATEMENT, VALUES, callback);
};
