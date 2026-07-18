const model = require('../models/Wishlist.model');

// POST /api/wishlist/:listingId
module.exports.addToWishlist = (req, res) => {
  const data = { userId: res.locals.userId, listingId: req.params.listingId };

  const callback = (error) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(201).json({ message: 'Added to wishlist.' });
  };

  model.addToWishlist(data, callback);
};

// DELETE /api/wishlist/:listingId
module.exports.removeFromWishlist = (req, res) => {
  const data = { userId: res.locals.userId, listingId: req.params.listingId };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Item not in wishlist.' });
    }
    return res.status(200).json({ message: 'Removed from wishlist.' });
  };

  model.removeFromWishlist(data, callback);
};

// GET /api/wishlist
module.exports.getWishlist = (req, res) => {
  const data = { userId: res.locals.userId };

  const callback = (error, result) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
    return res.status(200).json(result.rows);
  };

  model.getWishlistByUser(data, callback);
};
