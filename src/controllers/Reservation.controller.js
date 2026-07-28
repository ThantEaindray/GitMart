const model = require('../models/Reservation.model');

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function sendInternalServerError(error, res) {
  console.error(error);

  return res.status(500).json({
    message: 'Internal server error.',
  });
}

// POST /api/listings/:listingId/reservations
module.exports.createReservationRequest = (req, res) => {
  const listingId = Number(req.params.listingId);
  const requesterId = Number(res.locals.userId);
  const { message: rawMessage } = req.body || {};

  if (!isPositiveInteger(listingId)) {
    return res.status(400).json({
      message: 'Listing ID must be a positive integer.',
    });
  }

  if (rawMessage !== undefined && rawMessage !== null && typeof rawMessage !== 'string') {
    return res.status(400).json({
      message: 'Reservation message must be text.',
    });
  }

  const message = typeof rawMessage === 'string' ? rawMessage.trim() || null : null;

  if (message && message.length > 500) {
    return res.status(400).json({
      message: 'Reservation message cannot exceed 500 characters.',
    });
  }

  const listingData = {
    listing_id: listingId,
  };

  const listingCallback = (listingError, listingResult) => {
    if (listingError) {
      return sendInternalServerError(listingError, res);
    }

    if (listingResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Listing not found.',
      });
    }

    const listing = listingResult.rows[0];

    if (!listing.owner_id) {
      return res.status(409).json({
        message: 'This listing cannot receive reservation requests because it has no owner.',
      });
    }

    if (Number(listing.owner_id) === requesterId) {
      return res.status(403).json({
        message: 'You cannot reserve your own listing.',
      });
    }

    if (listing.status !== 'AVAILABLE') {
      return res.status(409).json({
        message: 'Only available listings can be reserved.',
      });
    }

    const requestData = {
      listing_id: listingId,
      requester_id: requesterId,
    };

    const pendingCallback = (pendingError, pendingResult) => {
      if (pendingError) {
        return sendInternalServerError(pendingError, res);
      }

      if (pendingResult.rows.length > 0) {
        return res.status(409).json({
          message: 'You already have a pending reservation request for this listing.',
        });
      }

      const createData = {
        listing_id: listingId,
        requester_id: requesterId,
        message,
      };

      const createCallback = (createError, createResult) => {
        if (createError) {
          if (createError.code === '23505') {
            return res.status(409).json({
              message: 'You already have a pending reservation request for this listing.',
            });
          }

          if (createError.code === '23514') {
            return res.status(400).json({
              message: 'The reservation request contains invalid data.',
            });
          }

          return sendInternalServerError(createError, res);
        }

        return res.status(201).json({
          message: 'Reservation request created successfully.',
          reservation: createResult.rows[0],
        });
      };

      return model.createReservationRequest(createData, createCallback);
    };

    return model.getPendingRequest(requestData, pendingCallback);
  };

  return model.getListingForReservation(listingData, listingCallback);
};

// GET /api/reservations/sent
module.exports.getSentReservations = (req, res) => {
  const data = {
    requester_id: Number(res.locals.userId),
  };

  const callback = (error, result) => {
    if (error) {
      return sendInternalServerError(error, res);
    }

    return res.status(200).json(result.rows);
  };

  return model.getSentReservations(data, callback);
};

// GET /api/reservations/received
module.exports.getReceivedReservations = (req, res) => {
  const data = {
    owner_id: Number(res.locals.userId),
  };

  const callback = (error, result) => {
    if (error) {
      return sendInternalServerError(error, res);
    }

    return res.status(200).json(result.rows);
  };

  return model.getReceivedReservations(data, callback);
};

// PATCH /api/reservations/:id/cancel
module.exports.cancelReservationRequest = (req, res) => {
  const reservationId = Number(req.params.id);
  const requesterId = Number(res.locals.userId);

  if (!isPositiveInteger(reservationId)) {
    return res.status(400).json({
      message: 'Reservation ID must be a positive integer.',
    });
  }

  const lookupData = {
    id: reservationId,
  };

  const lookupCallback = (lookupError, lookupResult) => {
    if (lookupError) {
      return sendInternalServerError(lookupError, res);
    }

    if (lookupResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Reservation request not found.',
      });
    }

    const reservation = lookupResult.rows[0];

    if (Number(reservation.requester_id) !== requesterId) {
      return res.status(403).json({
        message: 'Only the requester can cancel this reservation request.',
      });
    }

    if (reservation.status !== 'PENDING') {
      return res.status(409).json({
        message: 'Only pending reservation requests can be cancelled.',
      });
    }

    const cancelData = {
      id: reservationId,
      requester_id: requesterId,
    };

    const cancelCallback = (cancelError, cancelResult) => {
      if (cancelError) {
        return sendInternalServerError(cancelError, res);
      }

      if (cancelResult.rows.length === 0) {
        return res.status(409).json({
          message: 'The reservation request is no longer pending.',
        });
      }

      return res.status(200).json({
        message: 'Reservation request cancelled successfully.',
        reservation: cancelResult.rows[0],
      });
    };

    return model.cancelPendingReservation(cancelData, cancelCallback);
  };

  return model.getReservationById(lookupData, lookupCallback);
};

// PATCH /api/reservations/:id/accept
module.exports.acceptReservationRequest = async (req, res) => {
  const reservationId = Number(req.params.id);
  const ownerId = Number(res.locals.userId);

  if (!isPositiveInteger(reservationId)) {
    return res.status(400).json({
      message: 'Reservation ID must be a positive integer.',
    });
  }

  try {
    const result = await model.acceptReservationRequest({ id: reservationId, owner_id: ownerId });

    if (result.notFound) {
      return res.status(404).json({
        message: 'Reservation request not found.',
      });
    }

    if (result.forbidden) {
      return res.status(403).json({
        message: 'Only the listing owner can accept reservation requests.',
      });
    }

    if (result.invalidState) {
      return res.status(409).json({
        message: `Only pending reservation requests can be accepted. Current status: ${result.currentStatus}.`,
      });
    }

    if (result.listingUnavailable) {
      return res.status(409).json({
        message: `Only listings with AVAILABLE status can be reserved. Current status: ${result.listingStatus}.`,
      });
    }

    return res.status(200).json({
      message: 'Reservation request accepted successfully.',
      reservation: result.reservation,
    });
  } catch (error) {
    return sendInternalServerError(error, res);
  }
};

// PATCH /api/reservations/:id/reject
module.exports.rejectReservationRequest = (req, res) => {
  const reservationId = Number(req.params.id);
  const ownerId = Number(res.locals.userId);

  if (!isPositiveInteger(reservationId)) {
    return res.status(400).json({
      message: 'Reservation ID must be a positive integer.',
    });
  }

  const lookupCallback = (lookupError, lookupResult) => {
    if (lookupError) {
      return sendInternalServerError(lookupError, res);
    }

    if (lookupResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Reservation request not found.',
      });
    }

    const reservation = lookupResult.rows[0];

    if (Number(reservation.owner_id) !== ownerId) {
      return res.status(403).json({
        message: 'Only the listing owner can reject reservation requests.',
      });
    }

    if (reservation.status !== 'PENDING') {
      return res.status(409).json({
        message: 'Only pending reservation requests can be rejected.',
      });
    }

    const rejectCallback = (rejectError, rejectResult) => {
      if (rejectError) {
        return sendInternalServerError(rejectError, res);
      }

      if (rejectResult.rows.length === 0) {
        return res.status(409).json({
          message: 'The reservation request is no longer pending.',
        });
      }

      return res.status(200).json({
        message: 'Reservation request rejected successfully.',
        reservation: rejectResult.rows[0],
      });
    };

    return model.rejectReservationRequest({ id: reservationId, owner_id: ownerId }, rejectCallback);
  };

  return model.getReservationById({ id: reservationId }, lookupCallback);
};