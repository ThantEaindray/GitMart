const express = require('express');

const reservationController = require('../controllers/Reservation.controller');

const jwtMiddleware = require('../middleware/jwtMiddleware');

const router = express.Router();

// Create a reservation request for an available listing.
router.post(
  '/listings/:listingId/reservations',
  jwtMiddleware.verifyToken,
  reservationController.createReservationRequest,
);

// View reservation requests submitted by the logged-in user.
router.get(
  '/reservations/sent',
  jwtMiddleware.verifyToken,
  reservationController.getSentReservations,
);

// View reservation requests received for the logged-in user's listings.
router.get(
  '/reservations/received',
  jwtMiddleware.verifyToken,
  reservationController.getReceivedReservations,
);

// Cancel a pending reservation request.
router.patch(
  '/reservations/:id/cancel',
  jwtMiddleware.verifyToken,
  reservationController.cancelReservationRequest,
);

router.patch('/reservations/:id/accept', jwtMiddleware.verifyToken, reservationController.acceptReservationRequest);
router.patch('/reservations/:id/reject', jwtMiddleware.verifyToken, reservationController.rejectReservationRequest);

module.exports = router;
