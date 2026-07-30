// Reservation.controller.js
// Each multi-step flow is broken into individual flat middleware functions
// so no single function ever nests one model call inside another's callback.

const model = require('../models/Reservation.model');

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function sendError(res, status, message) {
  return res.status(status).json({ message });
}

// ── Create reservation — step 1: validate input ───────────────────────────

module.exports.validateReservationInput = (req, res, next) => {
  const listingId = Number(req.params.listingId);
  const { message: rawMessage } = req.body || {};

  if (!isPositiveInteger(listingId)) {
    return sendError(res, 400, 'Listing ID must be a positive integer.');
  }

  if (rawMessage !== undefined && rawMessage !== null && typeof rawMessage !== 'string') {
    return sendError(res, 400, 'Reservation message must be text.');
  }

  const message = typeof rawMessage === 'string' ? rawMessage.trim() || null : null;

  if (message && message.length > 500) {
    return sendError(res, 400, 'Reservation message cannot exceed 500 characters.');
  }

  res.locals.reservationInput = { listingId, message };
  next();
};

// ── Create reservation — step 2: fetch listing and validate it ────────────

module.exports.loadListingForReservation = (req, res, next) => {
  const { listingId } = res.locals.reservationInput;
  const requesterId = Number(res.locals.userId);
  const data = { listing_id: listingId };

  const callback = (error, result) => {
    if (error) {
      console.error(error);
      return sendError(res, 500, 'Internal server error.');
    }
    if (result.rows.length === 0) {
      return sendError(res, 404, 'Listing not found.');
    }

    const listing = result.rows[0];

    if (!listing.owner_id) {
      return sendError(
        res,
        409,
        'This listing cannot receive reservation requests because it has no owner.',
      );
    }
    if (Number(listing.owner_id) === requesterId) {
      return sendError(res, 403, 'You cannot reserve your own listing.');
    }
    if (listing.status !== 'AVAILABLE') {
      return sendError(res, 409, 'Only available listings can be reserved.');
    }

    res.locals.reservationListing = listing;
    next();
  };

  model.getListingForReservation(data, callback);
};

// ── Create reservation — step 3: ensure no duplicate pending request ──────

module.exports.checkNoPendingRequest = (req, res, next) => {
  const { listingId } = res.locals.reservationInput;
  const requesterId = Number(res.locals.userId);
  const data = { listing_id: listingId, requester_id: requesterId };

  const callback = (error, result) => {
    if (error) {
      console.error(error);
      return sendError(res, 500, 'Internal server error.');
    }
    if (result.rows.length > 0) {
      return sendError(
        res,
        409,
        'You already have a pending reservation request for this listing.',
      );
    }
    next();
  };

  model.getPendingRequest(data, callback);
};

// ── Create reservation — step 4: insert and respond ──────────────────────

// POST /api/listings/:listingId/reservations
module.exports.createReservationRequest = (req, res) => {
  const { listingId, message } = res.locals.reservationInput;
  const requesterId = Number(res.locals.userId);
  const data = { listing_id: listingId, requester_id: requesterId, message };

  const callback = (error, result) => {
    if (error) {
      if (error.code === '23505') {
        return sendError(
          res,
          409,
          'You already have a pending reservation request for this listing.',
        );
      }
      if (error.code === '23514') {
        return sendError(res, 400, 'The reservation request contains invalid data.');
      }
      console.error(error);
      return sendError(res, 500, 'Internal server error.');
    }
    return res.status(201).json({
      message: 'Reservation request created successfully.',
      reservation: result.rows[0],
    });
  };

  model.createReservationRequest(data, callback);
};

// ── Read sent reservations ────────────────────────────────────────────────

// GET /api/reservations/sent
module.exports.getSentReservations = (req, res) => {
  const data = { requester_id: Number(res.locals.userId) };

  const callback = (error, result) => {
    if (error) {
      console.error(error);
      return sendError(res, 500, 'Internal server error.');
    }
    return res.status(200).json(result.rows);
  };

  model.getSentReservations(data, callback);
};

// ── Read received reservations ────────────────────────────────────────────

// GET /api/reservations/received
module.exports.getReceivedReservations = (req, res) => {
  const data = { owner_id: Number(res.locals.userId) };

  const callback = (error, result) => {
    if (error) {
      console.error(error);
      return sendError(res, 500, 'Internal server error.');
    }
    return res.status(200).json(result.rows);
  };

  model.getReceivedReservations(data, callback);
};

// ── Cancel reservation — step 1: fetch and validate ownership/status ──────

module.exports.loadReservationForCancel = (req, res, next) => {
  const reservationId = Number(req.params.id);
  const requesterId = Number(res.locals.userId);

  if (!isPositiveInteger(reservationId)) {
    return sendError(res, 400, 'Reservation ID must be a positive integer.');
  }

  const data = { id: reservationId };

  const callback = (error, result) => {
    if (error) {
      console.error(error);
      return sendError(res, 500, 'Internal server error.');
    }
    if (result.rows.length === 0) {
      return sendError(res, 404, 'Reservation request not found.');
    }

    const reservation = result.rows[0];

    if (Number(reservation.requester_id) !== requesterId) {
      return sendError(res, 403, 'Only the requester can cancel this reservation request.');
    }
    if (reservation.status !== 'PENDING') {
      return sendError(res, 409, 'Only pending reservation requests can be cancelled.');
    }

    res.locals.reservationToCancel = reservation;
    next();
  };

  model.getReservationById(data, callback);
};

// ── Cancel reservation — step 2: apply cancel and respond ─────────────────

// PATCH /api/reservations/:id/cancel
module.exports.cancelReservationRequest = (req, res) => {
  const reservation = res.locals.reservationToCancel;
  const data = { id: reservation.id, requester_id: Number(res.locals.userId) };

  const callback = (error, result) => {
    if (error) {
      console.error(error);
      return sendError(res, 500, 'Internal server error.');
    }
    if (result.rows.length === 0) {
      return sendError(res, 409, 'The reservation request is no longer pending.');
    }
    return res.status(200).json({
      message: 'Reservation request cancelled successfully.',
      reservation: result.rows[0],
    });
  };

  model.cancelPendingReservation(data, callback);
};

// ── Reject reservation — step 1: fetch and validate ownership/status ──────

module.exports.loadReservationForReject = (req, res, next) => {
  const reservationId = Number(req.params.id);
  const ownerId = Number(res.locals.userId);

  if (!isPositiveInteger(reservationId)) {
    return sendError(res, 400, 'Reservation ID must be a positive integer.');
  }

  const data = { id: reservationId };

  const callback = (error, result) => {
    if (error) {
      console.error(error);
      return sendError(res, 500, 'Internal server error.');
    }
    if (result.rows.length === 0) {
      return sendError(res, 404, 'Reservation request not found.');
    }

    const reservation = result.rows[0];

    if (Number(reservation.owner_id) !== ownerId) {
      return sendError(res, 403, 'Only the listing owner can reject reservation requests.');
    }
    if (reservation.status !== 'PENDING') {
      return sendError(res, 409, 'Only pending reservation requests can be rejected.');
    }

    res.locals.reservationToReject = reservation;
    next();
  };

  model.getReservationById(data, callback);
};

// ── Reject reservation — step 2: apply rejection and respond ──────────────

// PATCH /api/reservations/:id/reject
module.exports.rejectReservationRequest = (req, res) => {
  const reservation = res.locals.reservationToReject;
  const data = { id: reservation.id, owner_id: Number(res.locals.userId) };

  const callback = (error, result) => {
    if (error) {
      console.error(error);
      return sendError(res, 500, 'Internal server error.');
    }
    if (result.rows.length === 0) {
      return sendError(res, 409, 'The reservation request is no longer pending.');
    }
    return res.status(200).json({
      message: 'Reservation request rejected successfully.',
      reservation: result.rows[0],
    });
  };

  model.rejectReservationRequest(data, callback);
};

// ── Accept reservation ────────────────────────────────────────────────────
// Uses the async model (transaction) — kept as a single flat async handler.

// PATCH /api/reservations/:id/accept
module.exports.acceptReservationRequest = async (req, res) => {
  const reservationId = Number(req.params.id);

  if (!isPositiveInteger(reservationId)) {
    return sendError(res, 400, 'Reservation ID must be a positive integer.');
  }

  const data = { id: reservationId, owner_id: Number(res.locals.userId) };

  let result;
  try {
    result = await model.acceptReservationRequest(data);
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Internal server error.');
  }

  if (result.notFound) return sendError(res, 404, 'Reservation request not found.');
  if (result.forbidden)
    return sendError(res, 403, 'Only the listing owner can accept reservation requests.');
  if (result.invalidState) {
    return sendError(
      res,
      409,
      `Only pending reservation requests can be accepted. Current status: ${result.currentStatus}.`,
    );
  }
  if (result.listingUnavailable) {
    return sendError(
      res,
      409,
      `Only listings with AVAILABLE status can be reserved. Current status: ${result.listingStatus}.`,
    );
  }

  return res.status(200).json({
    message: 'Reservation request accepted successfully.',
    reservation: result.reservation,
  });
};
