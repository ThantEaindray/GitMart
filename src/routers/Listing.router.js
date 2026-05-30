const express = require('express');
const router = express.Router();

const listingController = require('../controllers/Listing.controller');
const jwtMiddleware = require('../middleware/jwtMiddleware');

// AI image analysis (protected — costs API credits)
router.post('/listings/analyse-image', jwtMiddleware.verifyToken, listingController.analyseImage);

// Public listing routes
router.get('/listings', listingController.getAllListings);
router.get('/listings/category/:category', listingController.getListingsByCategory);
router.get('/listings/owner/:owner_id', listingController.getListingsByOwner);

// Seller dashboard — must be before /:id to avoid being caught by the param route
router.get('/listings/dashboard',    jwtMiddleware.verifyToken, listingController.loadSellerStats, listingController.loadSellerCategoryBreakdown, listingController.loadSellerViewBreakdown, listingController.sendDashboard);
router.get('/listings/most-viewed',  listingController.getMostViewed);
router.get('/listings/search',       listingController.searchListings);

router.get('/listings/:id', jwtMiddleware.optionalAuth, listingController.getListingById);

// Protected listing routes
router.post('/listings', jwtMiddleware.verifyToken, listingController.createListing);
router.patch('/listings/:id', jwtMiddleware.verifyToken, listingController.updateListing);
router.delete('/listings/:id', jwtMiddleware.verifyToken, listingController.deleteListing);

module.exports = router;
