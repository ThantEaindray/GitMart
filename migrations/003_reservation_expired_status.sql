-- ─────────────────────────────────────────────────────────
--  003 — reservation_requests: add EXPIRED status
-- ─────────────────────────────────────────────────────────
--  An ACCEPTED reservation used to stay RESERVED forever if the buyer
--  never checked out — nothing released it back to other buyers. The
--  background sweep in src/utils/reservationExpirySweep.js now does
--  that automatically after RESERVATION_HOLD_HOURS, and needs a status
--  distinct from REJECTED (owner-initiated) and CANCELLED
--  (buyer-initiated) to record why the reservation ended.
--
--  Postgres has no ADD CONSTRAINT ... IF NOT EXISTS, so this drops and
--  recreates the check constraint under its original name — safe to run
--  on a database that already has EXPIRED (drops and recreates the
--  identical constraint, a no-op in effect) or one that doesn't yet.
-- ─────────────────────────────────────────────────────────

ALTER TABLE reservation_requests
  DROP CONSTRAINT IF EXISTS reservation_requests_status_check;

ALTER TABLE reservation_requests
  ADD CONSTRAINT reservation_requests_status_check
  CHECK (
    status IN (
      'PENDING',
      'ACCEPTED',
      'REJECTED',
      'CANCELLED',
      'EXPIRED'
    )
  );
