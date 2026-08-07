// reservationExpirySweep.js
// A RESERVED listing with an ACCEPTED reservation used to stay that way
// forever if the buyer never checked out — nothing released it back to
// other buyers. This runs a recurring sweep (there is no job scheduler
// anywhere else in this app, so a plain setInterval is it) that releases
// any reservation that has sat unpurchased past RESERVATION_HOLD_HOURS.
//
// Only started from server.js's require.main === module guard, same as
// the WebSocket server below it — starting a real interval as a side
// effect of a test merely requiring app.js would leave a handle open that
// nothing ever closes.

const reservationModel = require('../models/Reservation.model');
const { notify } = require('./notifier');

const HOLD_HOURS = Number(process.env.RESERVATION_HOLD_HOURS) || 24;
const SWEEP_INTERVAL_MS = Number(process.env.RESERVATION_SWEEP_INTERVAL_MS) || 15 * 60 * 1000;

let intervalHandle;
let sweeping = false;

async function sweepOnce() {
  // A slow sweep (or a slow database) overlapping with the next tick would
  // race two transactions over the same rows — skip rather than queue up.
  if (sweeping) return;
  sweeping = true;

  try {
    const expired = await reservationModel.releaseExpiredReservations(HOLD_HOURS);

    expired.forEach((row) => {
      notify(
        row.requester_id,
        'reservation_status',
        'Reservation expired',
        `Your reservation on "${row.title}" expired after ${HOLD_HOURS}h without checkout — it's available to others again.`,
      );
      notify(
        row.owner_id,
        'reservation_status',
        'Reservation released',
        `The accepted reservation on "${row.title}" expired without checkout. It's back to AVAILABLE.`,
      );
    });
  } catch (error) {
    // A failed sweep must never kill the interval — it just tries again
    // next tick, same "log and move on" contract as notifier.js's own
    // failure handling.
    console.error('Reservation expiry sweep failed:', error);
  } finally {
    sweeping = false;
  }
}

module.exports.start = () => {
  if (intervalHandle) return;
  intervalHandle = setInterval(sweepOnce, SWEEP_INTERVAL_MS);
  // Doesn't keep the process alive on its own — a clean shutdown (or Jest's
  // open-handle detection, on the rare test that does start this) isn't
  // blocked by a timer whose only job is a periodic cleanup sweep.
  intervalHandle.unref?.();
};

module.exports.stop = () => {
  clearInterval(intervalHandle);
  intervalHandle = undefined;
};

// Exposed for tests and for triggering a sweep on demand — the interval
// above is just sweepOnce called on a timer, not special in any other way.
module.exports.sweepOnce = sweepOnce;
