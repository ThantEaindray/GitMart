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

// View the logged-in user's own reservation for one listing (drives cart gating).
router.get(
  '/listings/:listingId/reservations/mine',
  jwtMiddleware.verifyToken,
  reservationController.getMyReservationForListing,
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

// Reject a pending reservation — validated then rejected in two steps.
router.patch(
  '/reservations/:id/reject',
  jwtMiddleware.verifyToken,
  reservationController.loadReservationForReject,
  reservationController.rejectReservationRequest,
);

// Accept a pending reservation (single step — runs an atomic SQL transaction).
router.patch(
  '/reservations/:id/accept',
  jwtMiddleware.verifyToken,
  reservationController.acceptReservationRequest,
);

module.exports = router;
