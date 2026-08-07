const pool = require('./db');

module.exports.createListing = (data, callback) => {
  const SQLSTATEMENT = `
    INSERT INTO listings (owner_id, price, title, description, category, image_url)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, owner_id, price, created_on, title, description, category, image_url, "isSold", "isClosed"
  `;
  const VALUES = [
    data.owner_id,
    data.price,
    data.title,
    data.description,
    data.category || 'Others',
    data.image_url || null,
  ];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getAllListings = (callback) => {
  const SQLSTATEMENT = `
    SELECT l.id, l.owner_id, l.price, l.created_on, l.title, l.description,
           l.category, l.image_url, l."isSold", l."isClosed",
           ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
           COUNT(r.id) AS review_count
    FROM listings l
    LEFT JOIN listing_reviews r ON r.listing_id = l.id
    GROUP BY l.id
    ORDER BY l.id DESC
  `;
  pool.query(SQLSTATEMENT, callback);
};

module.exports.getListingsByCategory = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT l.id, l.owner_id, l.price, l.created_on, l.title, l.description,
           l.category, l.image_url, l."isSold", l."isClosed",
           ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
           COUNT(r.id) AS review_count
    FROM listings l
    LEFT JOIN listing_reviews r ON r.listing_id = l.id
    WHERE l.category = $1
    GROUP BY l.id
    ORDER BY l.id DESC
  `;
  const VALUES = [data.category];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getListingById = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT l.id, l.owner_id, l.price, l.created_on, l.title, l.description,
           l.category, l.image_url, l.view_count, l.status, l.status_updated_on,
           l."isSold", l."isClosed",
           ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
           COUNT(r.id) AS review_count
    FROM listings l
    LEFT JOIN listing_reviews r ON r.listing_id = l.id
    WHERE l.id = $1
    GROUP BY l.id
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
    ),
    updated AS (
      UPDATE listings
      SET view_count = view_count + (CASE WHEN EXISTS(SELECT 1 FROM maybe_view) THEN 1 ELSE 0 END)
      WHERE id = $1::integer
      RETURNING id, owner_id, price, created_on, title, description, category, image_url, view_count, status, status_updated_on, "isSold", "isClosed"
    )
    SELECT u.*,
           ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
           COUNT(r.id) AS review_count
    FROM updated u
    LEFT JOIN listing_reviews r ON r.listing_id = u.id
    GROUP BY u.id, u.owner_id, u.price, u.created_on, u.title, u.description,
             u.category, u.image_url, u.view_count, u.status, u.status_updated_on,
             u."isSold", u."isClosed"
  `;
  const VALUES = [data.id, data.userId];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getListingsByOwner = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT l.id, l.owner_id, l.price, l.created_on, l.title, l.description,
           l.category, l.image_url, l.view_count, l."isSold", l."isClosed",
           ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
           COUNT(r.id) AS review_count
    FROM listings l
    LEFT JOIN listing_reviews r ON r.listing_id = l.id
    WHERE l.owner_id = $1
    GROUP BY l.id
    ORDER BY l.id DESC
  `;
  const VALUES = [data.owner_id];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getListingsByIds = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT id, owner_id, title
    FROM listings
    WHERE id = ANY($1::integer[])
  `;
  const VALUES = [data.ids];
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
    SELECT l.id, l.owner_id, l.price, l.created_on, l.title, l.description,
           l.category, l.image_url, l.view_count, l.status, l.status_updated_on,
           l."isSold", l."isClosed",
           ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
           COUNT(r.id) AS review_count
    FROM listings l
    LEFT JOIN listing_reviews r ON r.listing_id = l.id
    WHERE NOT l."isSold" AND NOT l."isClosed" AND l.view_count > 0
    GROUP BY l.id
    ORDER BY l.view_count DESC
    LIMIT 4
  `;
  pool.query(SQLSTATEMENT, callback);
};

module.exports.getListingLifecycleById = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT
      id,
      owner_id,
      status,
      status_updated_on,
      "isSold",
      "isClosed"
    FROM listings
    WHERE id = $1
  `;

  const VALUES = [data.id];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.updateListingStatus = (data, callback) => {
  const SQLSTATEMENT = `
    UPDATE listings
    SET
      status = $1,
      status_updated_on = NOW(),
      "isSold" = $2,
      "isClosed" = $3
    WHERE id = $4
      AND owner_id = $5
      AND status = $6
    RETURNING
      id,
      owner_id,
      status,
      status_updated_on,
      "isSold",
      "isClosed"
  `;

  const VALUES = [
    data.status,
    data.isSold,
    data.isClosed,
    data.id,
    data.owner_id,
    data.current_status,
  ];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

// Called from order.controller.js when a buyer completes checkout on a
// one-off listing — not from the owner-facing status route, so unlike
// updateListingStatus above this deliberately has no owner_id check: the
// actor here is the buyer, not the owner. WHERE status = 'RESERVED' is the
// only guard, matching listingLifecycle.js leaving SOLD out of RESERVED's
// owner-transition table — this is the one path left that can reach SOLD
// from RESERVED. A no-op (no rows affected) if the listing already isn't
// RESERVED, rather than an error — that's a race, not a bug in the caller.
module.exports.markListingSold = (id, callback) => {
  const SQLSTATEMENT = `
    UPDATE listings
    SET
      status = 'SOLD',
      status_updated_on = NOW(),
      "isSold" = true
    WHERE id = $1
      AND status = 'RESERVED'
    RETURNING
      id,
      owner_id,
      status,
      status_updated_on,
      "isSold",
      "isClosed"
  `;

  const VALUES = [id];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

// Whitelist, not string interpolation of user input — the chosen value is
// spliced straight into ORDER BY, so anything outside this map must fall back
// to the default rather than reach the query.
const SORT_MAP = {
  newest: 'created_on DESC, id DESC',
  cheapest: 'price ASC, id DESC',
  expensive: 'price DESC, id DESC',
  most_viewed: 'view_count DESC NULLS LAST, id DESC',
};

module.exports.searchListings = (data, callback) => {
  const orderBy = SORT_MAP[data.sort] || SORT_MAP.newest;
  const SQLSTATEMENT = `
    SELECT l.id, l.owner_id, l.price, l.created_on, l.title, l.description,
           l.category, l.image_url, l.view_count, l.status, l.status_updated_on,
           l."isSold", l."isClosed",
           ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
           COUNT(r.id) AS review_count
    FROM listings l
    LEFT JOIN listing_reviews r ON r.listing_id = l.id
    WHERE (l.title ILIKE '%' || $1 || '%' OR l.description ILIKE '%' || $1 || '%' OR $1 = '')
      AND ($2::numeric IS NULL OR l.price >= $2::numeric)
      AND ($3::numeric IS NULL OR l.price <= $3::numeric)
      AND ($4 = '' OR l.category = $4)
    GROUP BY l.id
    ORDER BY ${orderBy}
  `;
  const VALUES = [
    data.search || '',
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

module.exports.getRecentlyViewed = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT l.id, l.owner_id, l.price, l.title, l.description,
           l.category, l.image_url, l.view_count,
           l."isSold", l."isClosed", l.created_on,
           lv.viewed_at,
           ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
           COUNT(r.id) AS review_count
    FROM listing_views lv
    JOIN listings l ON l.id = lv.listing_id
    LEFT JOIN listing_reviews r ON r.listing_id = l.id
    WHERE lv.user_id = $1
    GROUP BY l.id, lv.viewed_at
    ORDER BY lv.viewed_at DESC
    LIMIT 8
  `;
  pool.query(SQLSTATEMENT, [data.userId], callback);
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
