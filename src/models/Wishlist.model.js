const pool = require('./db');

module.exports.addToWishlist = (data, callback) => {
  const SQLSTATEMENT = `
    INSERT INTO wishlist (user_id, listing_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, listing_id) DO NOTHING
    RETURNING user_id, listing_id
  `;
  pool.query(SQLSTATEMENT, [data.userId, data.listingId], callback);
};

module.exports.removeFromWishlist = (data, callback) => {
  const SQLSTATEMENT = `
    DELETE FROM wishlist
    WHERE user_id = $1 AND listing_id = $2
    RETURNING user_id, listing_id
  `;
  pool.query(SQLSTATEMENT, [data.userId, data.listingId], callback);
};

module.exports.getWishlistByUser = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT w.listing_id, w.added_on,
           l.owner_id, l.price, l.title, l.description,
           l.category, l.image_url, l.view_count,
           l."isSold", l."isClosed", l.created_on
    FROM wishlist w
    JOIN listings l ON l.id = w.listing_id
    WHERE w.user_id = $1
    ORDER BY w.added_on DESC
  `;
  pool.query(SQLSTATEMENT, [data.userId], callback);
};
