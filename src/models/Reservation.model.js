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
  const SQLSTATEMENT = `
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
  `;

  const VALUES = [data.listing_id, data.requester_id, data.message];

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
