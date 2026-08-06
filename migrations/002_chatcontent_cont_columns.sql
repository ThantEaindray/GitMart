-- ─────────────────────────────────────────────────────────
--  002 — chatcontent: generic cont/cont_type columns
-- ─────────────────────────────────────────────────────────
--  chatcontent used two single-purpose columns, textcontent and
--  imagecontent, one of which was always null depending on the message
--  type. Replaced with a single cont column (the text, or the image URL)
--  plus cont_type to say which one it is — this is what lets a chat
--  message be either kind without the model/controller needing two
--  separate insert paths.
--
--  Old columns are intentionally left in place rather than dropped —
--  migrations here are additive only, and dropping them would be
--  destructive on a database with existing chat history. They just go
--  unused going forward; loadMessages does SELECT *, so their presence
--  is harmless on a migrated database.
--
--  Written to be safe in all three states a database can be in here:
--  already migrated (no-op), on the old textcontent/imagecontent schema
--  (adds the new columns and backfills from the old ones), or built fresh
--  from the current schema.sql, which never had textcontent/imagecontent
--  at all — the backfill below would fail with "column does not exist"
--  on that last one without the guard, since a plain UPDATE referencing a
--  nonexistent column is a hard error, not a no-op.
-- ─────────────────────────────────────────────────────────

ALTER TABLE chatcontent
  ADD COLUMN IF NOT EXISTS cont_type TEXT,
  ADD COLUMN IF NOT EXISTS cont TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatcontent' AND column_name = 'textcontent'
  ) THEN
    UPDATE chatcontent
    SET cont_type = 'txt', cont = textcontent
    WHERE textcontent IS NOT NULL AND cont IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chatcontent' AND column_name = 'imagecontent'
  ) THEN
    UPDATE chatcontent
    SET cont_type = 'img', cont = imagecontent
    WHERE imagecontent IS NOT NULL AND cont IS NULL;
  END IF;
END $$;
