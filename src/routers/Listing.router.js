const express = require('express');
const router = express.Router();

const listingController = require('../controllers/Listing.controller');
const jwtMiddleware = require('../middleware/jwtMiddleware');

// Public listing routes
router.get('/listings', listingController.getAllListings);
router.get('/listings/owner/:owner_id', listingController.getListingsByOwner);
router.get('/listings/:id', listingController.getListingById);

// Protected listing routes
router.post('/listings', jwtMiddleware.verifyToken, listingController.createListing);
router.patch('/listings/:id', jwtMiddleware.verifyToken, listingController.updateListing);
router.delete('/listings/:id', jwtMiddleware.verifyToken, listingController.deleteListing);

module.exports = router;