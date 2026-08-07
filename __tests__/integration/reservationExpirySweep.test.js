process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'integration-test-access-secret';

// Unlike __tests__/unit/reservationExpirySweep.test.js, nothing here is
// mocked: Reservation.model and notifier both hit the real database, so
// this is what actually exercises reservationExpirySweep.js's own lines
// (sweepOnce's real call sequence) rather than the pure control-flow logic
// the unit test already covers against mocked collaborators.
//
// SWEEP_INTERVAL_MS is read once, at module load, from this env var — the
// unit test covers start()/stop()'s scheduling logic against fake timers
// and the real (15 minute) default, so this shortens the real interval
// instead, to prove start()/stop() also work with a genuine setInterval
// end to end without the suite waiting 15 real minutes to see it fire.
// Must be set before the require() below. Restored in afterAll so no later
// file that happens to load this module in the same --runInBand process
// inherits it.
const ORIGINAL_SWEEP_INTERVAL_MS = process.env.RESERVATION_SWEEP_INTERVAL_MS;
process.env.RESERVATION_SWEEP_INTERVAL_MS = '50';

const pool = require('../../src/models/db');
const sweep = require('../../src/utils/reservationExpirySweep');

const SUITE_USERNAMES = ['sweep_owner', 'sweep_requester'];

let owner;
let requester;
let consoleErrorSpy;
let createdListingIds = [];

function flush(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function insertUser(username, email) {
  const result = await pool.query(
    `
      INSERT INTO users (username, email, password)
      VALUES ($1, $2, $3)
      RETURNING id, username, email
    `,
    [username, email, 'not-used-by-these-tests'],
  );
  return result.rows[0];
}

// hoursOld controls how far status_updated_on is backdated, so a listing can
// be placed on either side of HOLD_HOURS (24h, the default with no env
// override) without depending on real wall-clock time passing.
async function insertReservedListing({
  ownerId = owner.id,
  hoursOld,
  title = 'Sweep Test Listing',
}) {
  const listingResult = await pool.query(
    `
      INSERT INTO listings (owner_id, title, description, price, category, status, "isSold", "isClosed")
      VALUES ($1, $2, 'A listing for reservation-expiry-sweep testing.', 100, 'Electronics', 'RESERVED', false, false)
      RETURNING id
    `,
    [ownerId, title],
  );
  const listingId = listingResult.rows[0].id;
  createdListingIds.push(listingId);

  await pool.query(
    `UPDATE listings SET status_updated_on = NOW() - make_interval(hours => $2::int) WHERE id = $1`,
    [listingId, hoursOld],
  );

  return listingId;
}

async function insertAcceptedReservation(listingId, requesterId = requester.id) {
  const result = await pool.query(
    `
      INSERT INTO reservation_requests (listing_id, requester_id, status)
      VALUES ($1, $2, 'ACCEPTED')
      RETURNING id, listing_id, requester_id, status
    `,
    [listingId, requesterId],
  );
  return result.rows[0];
}

async function cleanupSuiteData() {
  await pool.query(
    `
      DELETE FROM notifications
      WHERE user_id IN (SELECT id FROM users WHERE username = ANY($1::text[]))
    `,
    [SUITE_USERNAMES],
  );
  await pool.query(
    `
      DELETE FROM reservation_requests
      WHERE listing_id = ANY($1::integer[])
        OR requester_id IN (SELECT id FROM users WHERE username = ANY($2::text[]))
    `,
    [createdListingIds, SUITE_USERNAMES],
  );
  await pool.query(
    `
      DELETE FROM listings
      WHERE owner_id IN (SELECT id FROM users WHERE username = ANY($1::text[]))
        OR id = ANY($2::integer[])
    `,
    [SUITE_USERNAMES, createdListingIds],
  );
  await pool.query('DELETE FROM users WHERE username = ANY($1::text[])', [SUITE_USERNAMES]);
  createdListingIds = [];
}

beforeAll(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(async () => {
  await cleanupSuiteData();
  owner = await insertUser(SUITE_USERNAMES[0], 'sweep.owner@example.com');
  requester = await insertUser(SUITE_USERNAMES[1], 'sweep.requester@example.com');
  consoleErrorSpy.mockClear();
});

afterEach(() => {
  sweep.stop();
});

afterAll(async () => {
  await cleanupSuiteData();
  consoleErrorSpy.mockRestore();
  // Assigning undefined would leave the literal string "undefined" behind.
  if (ORIGINAL_SWEEP_INTERVAL_MS === undefined) {
    delete process.env.RESERVATION_SWEEP_INTERVAL_MS;
  } else {
    process.env.RESERVATION_SWEEP_INTERVAL_MS = ORIGINAL_SWEEP_INTERVAL_MS;
  }
  await pool.end();
});

describe('reservationExpirySweep.sweepOnce (real database, real notifier)', () => {
  test('releases an expired reservation and persists real notifications for both parties', async () => {
    const listingId = await insertReservedListing({ hoursOld: 25, title: 'Sweep Test Camera' });
    await insertAcceptedReservation(listingId);

    await sweep.sweepOnce();
    await flush();

    const listingRow = await pool.query('SELECT status FROM listings WHERE id = $1', [listingId]);
    expect(listingRow.rows[0].status).toBe('AVAILABLE');

    const requesterNotifs = await pool.query(
      'SELECT type, title, message FROM notifications WHERE user_id = $1',
      [requester.id],
    );
    expect(requesterNotifs.rows).toHaveLength(1);
    expect(requesterNotifs.rows[0]).toMatchObject({
      type: 'reservation_status',
      title: 'Reservation expired',
    });
    expect(requesterNotifs.rows[0].message).toContain('Sweep Test Camera');

    const ownerNotifs = await pool.query(
      'SELECT type, title, message FROM notifications WHERE user_id = $1',
      [owner.id],
    );
    expect(ownerNotifs.rows).toHaveLength(1);
    expect(ownerNotifs.rows[0]).toMatchObject({
      type: 'reservation_status',
      title: 'Reservation released',
    });
    expect(ownerNotifs.rows[0].message).toContain('Sweep Test Camera');
  });

  test('does not touch a reservation still within the hold window, and notifies no one', async () => {
    const listingId = await insertReservedListing({ hoursOld: 1, title: 'Fresh Reservation' });
    await insertAcceptedReservation(listingId);

    await sweep.sweepOnce();
    await flush();

    const listingRow = await pool.query('SELECT status FROM listings WHERE id = $1', [listingId]);
    expect(listingRow.rows[0].status).toBe('RESERVED');

    const notifs = await pool.query('SELECT id FROM notifications WHERE user_id IN ($1, $2)', [
      requester.id,
      owner.id,
    ]);
    expect(notifs.rows).toHaveLength(0);
  });

  test('releases and notifies for every expired reservation in the same sweep', async () => {
    const listingIdOne = await insertReservedListing({ hoursOld: 30, title: 'Old Lamp' });
    await insertAcceptedReservation(listingIdOne);
    const listingIdTwo = await insertReservedListing({ hoursOld: 48, title: 'Old Radio' });
    await insertAcceptedReservation(listingIdTwo);

    await sweep.sweepOnce();
    await flush();

    const listingRows = await pool.query(
      'SELECT id, status FROM listings WHERE id = ANY($1::integer[])',
      [[listingIdOne, listingIdTwo]],
    );
    listingRows.rows.forEach((row) => expect(row.status).toBe('AVAILABLE'));

    const ownerNotifs = await pool.query(
      'SELECT title, message FROM notifications WHERE user_id = $1 ORDER BY id',
      [owner.id],
    );
    expect(ownerNotifs.rows).toHaveLength(2);
  });

  test('resolves cleanly and logs nothing when there is nothing to expire', async () => {
    await expect(sweep.sweepOnce()).resolves.toBeUndefined();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

describe('reservationExpirySweep.start/stop (real setInterval, shortened via env)', () => {
  test('start() fires sweepOnce on its own once the real interval elapses', async () => {
    const listingId = await insertReservedListing({ hoursOld: 25, title: 'Timer Sweep Listing' });
    await insertAcceptedReservation(listingId);

    sweep.start();
    await flush(250); // several 50ms ticks

    const listingRow = await pool.query('SELECT status FROM listings WHERE id = $1', [listingId]);
    expect(listingRow.rows[0].status).toBe('AVAILABLE');
  });

  test('stop() prevents any further automatic sweep from running', async () => {
    sweep.start();
    sweep.stop();

    const listingId = await insertReservedListing({ hoursOld: 25, title: 'Should Not Sweep' });
    await insertAcceptedReservation(listingId);

    await flush(200);

    const listingRow = await pool.query('SELECT status FROM listings WHERE id = $1', [listingId]);
    expect(listingRow.rows[0].status).toBe('RESERVED');
  });
});
