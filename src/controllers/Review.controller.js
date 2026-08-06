const model = require('../models/Review.model');

// GET /api/listings/:id/reviews
module.exports.getReviews = (req, res) => {
  const data = { listingId: req.params.id };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json(result.rows);
  };

  model.getReviewsByListing(data, callback);
};

// POST /api/listings/:id/reviews
module.exports.createReview = (req, res) => {
  const { rating, comment } = req.body || {};

  if (!rating || Number(rating) < 1 || Number(rating) > 5) {
    return res.status(400).json({ message: 'Rating must be an integer between 1 and 5.' });
  }

  const data = {
    listingId: req.params.id,
    reviewerId: res.locals.userId,
    rating: Number(rating),
    comment: comment || null,
  };

  const callback = (error, result) => {
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'You have already reviewed this listing.' });
      }
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(201).json(result.rows[0]);
  };

  model.createReview(data, callback);
};

// DELETE /api/listings/:id/reviews/:reviewId
module.exports.deleteReview = (req, res) => {
  const data = {
    reviewId: req.params.reviewId,
    reviewerId: res.locals.userId,
  };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Review not found.' });
    }
    return res.status(200).json({ message: 'Review deleted.' });
  };

  model.deleteReview(data, callback);
};
