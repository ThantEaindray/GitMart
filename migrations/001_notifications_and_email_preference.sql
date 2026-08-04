-- ─────────────────────────────────────────────────────────
--  001 — Persistent notifications and the email preference
-- ─────────────────────────────────────────────────────────
--  Notifications used to live in a module-level array, so
--  every one of them was lost on restart. This adds the
--  table they now live in, plus the per-user email opt-out.
--
--  Written to be safe on a database that already has these
--  objects, so it is a no-op on anything built from the
--  current schema.sql and additive on an older deployment.
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL    PRIMARY KEY,

  user_id    INTEGER   NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,

  type       TEXT      NOT NULL,
  title      TEXT      NOT NULL,
  message    TEXT      NOT NULL,
  is_read    BOOLEAN   NOT NULL DEFAULT false,
  created_on TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Added separately so the migration still succeeds on a database where the
-- table exists from an earlier deployment but the constraint does not.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (
        type IN (
          'order',
          'order_status',
          'reservation',
          'reservation_status',
          'wishlist',
          'message',
          'system'
        )
      );
  END IF;
END $$;

-- Serves the notifications page: one user's rows, newest first.
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_on DESC, id DESC);

-- Partial index for the unread badge count. Only unread rows are indexed, so
-- it stays small even as read history grows.
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id)
  WHERE is_read = false;

-- Per-user email opt-out. Defaults on, so opting out is the deliberate action.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT true;
