const express = require('express');
const router = express.Router();

const wishlistController = require('../controllers/Wishlist.controller');
const jwtMiddleware = require('../middleware/jwtMiddleware');

router.get('/wishlist', jwtMiddleware.verifyToken, wishlistController.getWishlist);
router.post('/wishlist/:listingId', jwtMiddleware.verifyToken, wishlistController.addToWishlist);
router.delete(
  '/wishlist/:listingId',
  jwtMiddleware.verifyToken,
  wishlistController.removeFromWishlist,
);

module.exports = router;
