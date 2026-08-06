const pool = require('./db');

module.exports.getListingForReservation = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT
      id,
      owner_id,
      title,
      status
    FROM listings
    WHERE id = $1
  `;

  const VALUES = [data.listing_id];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getPendingRequest = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT
      id,
      listing_id,
      requester_id,
      status,
      message,
      created_on,
      updated_on
    FROM reservation_requests
    WHERE listing_id = $1
      AND requester_id = $2
      AND status = 'PENDING'
    LIMIT 1
  `;

  const VALUES = [data.listing_id, data.requester_id];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.createReservationRequest = (data, callback) => {
  // Returns the requester's username alongside the new row so the controller can
  // build a notification for the listing owner without a second round trip.
  const SQLSTATEMENT = `
    WITH inserted AS (
      INSERT INTO reservation_requests (
        listing_id,
        requester_id,
        message
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        listing_id,
        requester_id,
        status,
        message,
        created_on,
        updated_on
    )
    SELECT
      inserted.id,
      inserted.listing_id,
      inserted.requester_id,
      inserted.status,
      inserted.message,
      inserted.created_on,
      inserted.updated_on,
      users.username AS requester_username
    FROM inserted
    LEFT JOIN users
      ON users.id = inserted.requester_id
  `;

  const VALUES = [data.listing_id, data.requester_id, data.message];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getMyReservationForListing = (data, callback) => {
  // Most recent reservation this user holds on this listing, whatever its status.
  const SQLSTATEMENT = `
    SELECT
      id,
      listing_id,
      requester_id,
      status,
      message,
      created_on,
      updated_on
    FROM reservation_requests
    WHERE listing_id = $1
      AND requester_id = $2
    ORDER BY
      created_on DESC,
      id DESC
    LIMIT 1
  `;

  const VALUES = [data.listing_id, data.requester_id];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getAcceptedListingIdsForUser = (data, callback) => {
  // Of the given listing IDs, returns only those the user holds an ACCEPTED
  // reservation for and whose listing is still RESERVED (i.e. buyable by them).
  const SQLSTATEMENT = `
    SELECT reservation_requests.listing_id
    FROM reservation_requests
    INNER JOIN listings
      ON listings.id = reservation_requests.listing_id
    WHERE reservation_requests.requester_id = $1
      AND reservation_requests.status = 'ACCEPTED'
      AND listings.status = 'RESERVED'
      AND reservation_requests.listing_id = ANY($2::integer[])
  `;

  const VALUES = [data.requester_id, data.listing_ids];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getReservationById = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT
      reservation_requests.id,
      reservation_requests.listing_id,
      reservation_requests.requester_id,
      reservation_requests.status,
      reservation_requests.message,
      reservation_requests.created_on,
      reservation_requests.updated_on,
      listings.owner_id,
      listings.title,
      listings.status AS listing_status
    FROM reservation_requests
    INNER JOIN listings
      ON listings.id = reservation_requests.listing_id
    WHERE reservation_requests.id = $1
  `;

  const VALUES = [data.id];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getSentReservations = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT
      reservation_requests.id,
      reservation_requests.listing_id,
      reservation_requests.requester_id,
      reservation_requests.status,
      reservation_requests.message,
      reservation_requests.created_on,
      reservation_requests.updated_on,
      listings.title,
      listings.price,
      listings.image_url,
      listings.status AS listing_status,
      listings.owner_id,
      users.username AS owner_username
    FROM reservation_requests
    INNER JOIN listings
      ON listings.id = reservation_requests.listing_id
    LEFT JOIN users
      ON users.id = listings.owner_id
    WHERE reservation_requests.requester_id = $1
    ORDER BY
      reservation_requests.created_on DESC,
      reservation_requests.id DESC
  `;

  const VALUES = [data.requester_id];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.getReceivedReservations = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT
      reservation_requests.id,
      reservation_requests.listing_id,
      reservation_requests.requester_id,
      reservation_requests.status,
      reservation_requests.message,
      reservation_requests.created_on,
      reservation_requests.updated_on,
      listings.title,
      listings.price,
      listings.image_url,
      listings.status AS listing_status,
      listings.owner_id,
      users.username AS requester_username
    FROM reservation_requests
    INNER JOIN listings
      ON listings.id = reservation_requests.listing_id
    INNER JOIN users
      ON users.id = reservation_requests.requester_id
    WHERE listings.owner_id = $1
    ORDER BY
      reservation_requests.created_on DESC,
      reservation_requests.id DESC
  `;

  const VALUES = [data.owner_id];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.cancelPendingReservation = (data, callback) => {
  const SQLSTATEMENT = `
    UPDATE reservation_requests
    SET
      status = 'CANCELLED',
      updated_on = NOW()
    WHERE id = $1
      AND requester_id = $2
      AND status = 'PENDING'
    RETURNING
      id,
      listing_id,
      requester_id,
      status,
      message,
      created_on,
      updated_on
  `;

  const VALUES = [data.id, data.requester_id];

  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.acceptReservationRequest = async (data) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const lookupResult = await client.query(
      `
        SELECT
          reservation_requests.id,
          reservation_requests.listing_id,
          reservation_requests.status,
          listings.owner_id,
          listings.title,
          listings.status AS listing_status
        FROM reservation_requests
        INNER JOIN listings
          ON listings.id = reservation_requests.listing_id
        WHERE reservation_requests.id = $1
        FOR UPDATE OF reservation_requests
      `,
      [data.id],
    );

    if (lookupResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { notFound: true };
    }

    const reservation = lookupResult.rows[0];

    if (Number(reservation.owner_id) !== Number(data.owner_id)) {
      await client.query('ROLLBACK');
      return { forbidden: true };
    }

    if (reservation.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return { invalidState: true, currentStatus: reservation.status };
    }

    if (reservation.listing_status !== 'AVAILABLE') {
      await client.query('ROLLBACK');
      return { listingUnavailable: true, listingStatus: reservation.listing_status };
    }

    const acceptedResult = await client.query(
      `
        UPDATE reservation_requests
        SET status = 'ACCEPTED', updated_on = NOW()
        WHERE id = $1
        RETURNING id, listing_id, requester_id, status, message, created_on, updated_on
      `,
      [data.id],
    );

    await client.query(
      `
        UPDATE reservation_requests
        SET status = 'REJECTED', updated_on = NOW()
        WHERE listing_id = $1
          AND id != $2
          AND status = 'PENDING'
      `,
      [reservation.listing_id, data.id],
    );

    await client.query(
      `
        UPDATE listings
        SET status = 'RESERVED', status_updated_on = NOW()
        WHERE id = $1
      `,
      [reservation.listing_id],
    );

    await client.query('COMMIT');

    return {
      success: true,
      reservation: acceptedResult.rows[0],
      listingTitle: reservation.title,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports.rejectReservationRequest = (data, callback) => {
  const SQLSTATEMENT = `
    UPDATE reservation_requests
    SET
      status = 'REJECTED',
      updated_on = NOW()
    FROM listings
    WHERE reservation_requests.id = $1
      AND reservation_requests.listing_id = listings.id
      AND listings.owner_id = $2
      AND reservation_requests.status = 'PENDING'
    RETURNING
      reservation_requests.id,
      reservation_requests.listing_id,
      reservation_requests.requester_id,
      reservation_requests.status,
      reservation_requests.message,
      reservation_requests.created_on,
      reservation_requests.updated_on
  `;

  const VALUES = [data.id, data.owner_id];

  pool.query(SQLSTATEMENT, VALUES, callback);
};
