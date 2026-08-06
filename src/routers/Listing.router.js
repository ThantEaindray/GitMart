const express = require('express');
const router = express.Router();
const path = require('node:path');
const multer = require('multer');

const listingController = require('../controllers/Listing.controller');
const listingImageController = require('../controllers/listingImage.controller');
const jwtMiddleware = require('../middleware/jwtMiddleware');

// Own multer instance rather than sharing image.router.js's — that file's
// config carries a "DO NOT MOVE" warning about a past bug, so this stays
// independent instead of risking whatever fragility that referred to.
const upload = multer({
  storage: multer.diskStorage({
    destination: './src/tmp',
    filename: function (req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    },
  }),
});

// AI image analysis (protected — costs API credits)
router.post('/listings/analyse-image', jwtMiddleware.verifyToken, listingController.analyseImage);

// Cover image upload — uploads to the same image host chat images use, and
// returns the resulting URL for the create/edit listing form to submit as
// image_url. Deliberately separate from POST /listings itself: the form
// picks/previews a photo before the listing exists, same two-step shape as
// the AI analysis above.
router.post(
  '/listings/upload-image',
  jwtMiddleware.verifyToken,
  upload.single('cont'),
  listingImageController.uploadCoverImage,
  listingImageController.respondWithUrl,
);

// Public listing routes
router.get('/listings', listingController.getAllListings);
router.get('/listings/category/:category', listingController.getListingsByCategory);
router.get('/listings/owner/:owner_id', listingController.getListingsByOwner);

// Seller dashboard — must be before /:id to avoid being caught by the param route
router.get(
  '/listings/dashboard',
  jwtMiddleware.verifyToken,
  listingController.loadSellerStats,
  listingController.loadSellerCategoryBreakdown,
  listingController.loadSellerViewBreakdown,
  listingController.sendDashboard,
);
router.get('/listings/most-viewed', listingController.getMostViewed);
router.get(
  '/listings/recently-viewed',
  jwtMiddleware.verifyToken,
  listingController.getRecentlyViewed,
);
router.get('/listings/search', listingController.searchListings);

router.get('/listings/:id', jwtMiddleware.optionalAuth, listingController.getListingById);

// Protected listing routes
router.post('/listings', jwtMiddleware.verifyToken, listingController.createListing);
router.patch(
  '/listings/:id/status',
  jwtMiddleware.verifyToken,
  listingController.validateListingStatusInput,
  listingController.loadListingForStatusUpdate,
  listingController.updateListingStatus,
);
router.patch('/listings/:id', jwtMiddleware.verifyToken, listingController.updateListing);
router.delete('/listings/:id', jwtMiddleware.verifyToken, listingController.deleteListing);

module.exports = router;
