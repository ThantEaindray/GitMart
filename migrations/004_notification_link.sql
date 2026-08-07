-- ─────────────────────────────────────────────────────────
--  004 — notifications: add link column
-- ─────────────────────────────────────────────────────────
--  A notification had no way to point anywhere — clicking one only
--  marked it read. Every notify() call site now optionally passes a
--  relative link (e.g. "/html/listing.html?id=12"), stored here and
--  used by the notifications page to navigate there on click.
--
--  Nullable and additive: existing rows just get link = NULL, which
--  the frontend already treats as "no navigation, mark-as-read only".
-- ─────────────────────────────────────────────────────────

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS link TEXT;
