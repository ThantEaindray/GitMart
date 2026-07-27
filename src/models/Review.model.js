const pool = require('./db');

module.exports.createReview = (data, callback) => {
  const SQL = `
    INSERT INTO listing_reviews (listing_id, reviewer_id, rating, comment)
    VALUES ($1, $2, $3, $4)
    RETURNING id, listing_id, reviewer_id, rating, comment, created_on
  `;
  pool.query(SQL, [data.listingId, data.reviewerId, data.rating, data.comment], callback);
};

module.exports.getReviewsByListing = (data, callback) => {
  const SQL = `
    SELECT r.id, r.listing_id, r.reviewer_id, r.rating, r.comment, r.created_on,
           u.username AS reviewer_name
    FROM listing_reviews r
    JOIN users u ON u.id = r.reviewer_id
    WHERE r.listing_id = $1
    ORDER BY r.created_on DESC
  `;
  pool.query(SQL, [data.listingId], callback);
};

module.exports.deleteReview = (data, callback) => {
  const SQL = `
    DELETE FROM listing_reviews
    WHERE id = $1 AND reviewer_id = $2
    RETURNING id
  `;
  pool.query(SQL, [data.reviewId, data.reviewerId], callback);
};
