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
router.get('/listings/:id', listingController.getListingById);

// Protected listing routes
router.post('/listings', jwtMiddleware.verifyToken, listingController.createListing);
router.patch('/listings/:id', jwtMiddleware.verifyToken, listingController.updateListing);
router.delete('/listings/:id', jwtMiddleware.verifyToken, listingController.deleteListing);

module.exports = router;
