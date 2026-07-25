const express = require('express');
const router = express.Router();

const reviewController = require('../controllers/Review.controller');
const jwtMiddleware = require('../middleware/jwtMiddleware');

router.get('/listings/:id/reviews', reviewController.getReviews);
router.post('/listings/:id/reviews', jwtMiddleware.verifyToken, reviewController.createReview);
router.delete('/listings/:id/reviews/:reviewId', jwtMiddleware.verifyToken, reviewController.deleteReview);

module.exports = router;
