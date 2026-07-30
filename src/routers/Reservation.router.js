const express = require('express');
const router = express.Router();

const reservationController = require('../controllers/Reservation.controller');
const jwtMiddleware = require('../middleware/jwtMiddleware');

// Create a reservation request — validated and checked across three steps.
router.post(
  '/listings/:listingId/reservations',
  jwtMiddleware.verifyToken,
  reservationController.validateReservationInput,
  reservationController.loadListingForReservation,
  reservationController.checkNoPendingRequest,
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

// Cancel a pending reservation — validated then cancelled in two steps.
router.patch(
  '/reservations/:id/cancel',
  jwtMiddleware.verifyToken,
  reservationController.loadReservationForCancel,
  reservationController.cancelReservationRequest,
);

module.exports = router;
