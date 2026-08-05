-- ─────────────────────────────────────────────────────────
--  Database Schema
-- ─────────────────────────────────────────────────────────
--  Single source of truth for the database structure.
--  Update this file whenever you add, remove, or change
--  tables, columns, or indexes.
--
--  Used by: scripts/reset.js
-- ─────────────────────────────────────────────────────────

-- Drop existing tables (children before parents to avoid FK errors)
DROP TABLE IF EXISTS notifications   CASCADE;
DROP TABLE IF EXISTS chatcontent     CASCADE;
DROP TABLE IF EXISTS reservation_requests CASCADE;
DROP TABLE IF EXISTS offers          CASCADE;
DROP TABLE IF EXISTS chats           CASCADE;
DROP TABLE IF EXISTS wishlist        CASCADE;
DROP TABLE IF EXISTS listing_reviews CASCADE;
DROP TABLE IF EXISTS listing_views   CASCADE;
DROP TABLE IF EXISTS listings        CASCADE;
DROP TABLE IF EXISTS products        CASCADE;
DROP TABLE IF EXISTS refresh_tokens  CASCADE;
DROP TABLE IF EXISTS users           CASCADE;
DROP TABLE IF EXISTS "Something"     CASCADE;

-- ── Something ─────────────────────────────────────────────
CREATE TABLE "Something" (
  "id"   SERIAL NOT NULL,
  "name" TEXT   NOT NULL,
  CONSTRAINT "Something_pkey" PRIMARY KEY ("id")
);

-- ── Users ─────────────────────────────────────────────────
CREATE TABLE users (
  id         SERIAL  PRIMARY KEY,
  username   TEXT    UNIQUE NOT NULL,
  icon       BYTEA,
  email      TEXT    UNIQUE NOT NULL,
  password   TEXT    NOT NULL,
  created_on DATE    NOT NULL DEFAULT CURRENT_DATE,
  "isStaff"  BOOLEAN NOT NULL DEFAULT false,
  theme              TEXT    DEFAULT NULL,
  currency           TEXT    NOT NULL DEFAULT 'USD',
  font_size          TEXT    DEFAULT NULL,
  display_name       TEXT    DEFAULT NULL,
  notify_orders      BOOLEAN NOT NULL DEFAULT true,
  notify_promotions  BOOLEAN NOT NULL DEFAULT false,
  notify_email       BOOLEAN NOT NULL DEFAULT true
);

-- ── Refresh Tokens ────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id         SERIAL    PRIMARY KEY,
  user_id    INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT      NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_on TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Products (public product catalogue — no auth required) ─
CREATE TABLE products (
  id           SERIAL         PRIMARY KEY,
  name         TEXT           NOT NULL,
  category     TEXT           NOT NULL,
  description  TEXT           DEFAULT '',
  price        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  rating       NUMERIC(3, 2)  DEFAULT 0,
  review_count INTEGER        DEFAULT 0,
  icon         TEXT           DEFAULT 'box-seam',
  image_url    TEXT,
  is_sold      BOOLEAN        DEFAULT false,
  created_on   DATE           DEFAULT CURRENT_DATE
);

-- ── Listings (user-created marketplace listings) ───────────
CREATE TABLE listings (
  id                SERIAL         PRIMARY KEY,
  owner_id          INTEGER        REFERENCES users(id),
  price             NUMERIC(10,2)  NOT NULL CHECK (price > 0),
  created_on        DATE           NOT NULL DEFAULT CURRENT_DATE,
  title             TEXT           NOT NULL,
  description       TEXT           NOT NULL,
  category          TEXT           NOT NULL DEFAULT 'Others',
  image_url         TEXT,

  status            TEXT           NOT NULL DEFAULT 'AVAILABLE',
  status_updated_on TIMESTAMP      NOT NULL DEFAULT NOW(),

  "isSold"          BOOLEAN        NOT NULL DEFAULT false,
  "isClosed"        BOOLEAN        NOT NULL DEFAULT false,
  view_count        INTEGER        DEFAULT 0,

  CONSTRAINT listings_status_check
    CHECK (
      status IN (
        'AVAILABLE',
        'RESERVED',
        'SOLD',
        'ARCHIVED'
      )
    ),

  CONSTRAINT listings_status_flags_check
    CHECK (
      (
        status = 'SOLD'
        AND "isSold" = true
        AND "isClosed" = false
      )
      OR
      (
        status = 'ARCHIVED'
        AND "isSold" = false
        AND "isClosed" = true
      )
      OR
      (
        status IN ('AVAILABLE', 'RESERVED')
        AND "isSold" = false
        AND "isClosed" = false
      )
    )
);

-- ── Listing Reviews ──────────────────────────────────────
CREATE TABLE listing_reviews (
  id           SERIAL    PRIMARY KEY,
  listing_id   INTEGER   NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reviewer_id  INTEGER   NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  rating       INTEGER   NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  created_on   TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, reviewer_id)
);

-- ── Wishlist (saved listings per user) ───────────────────
CREATE TABLE wishlist (
  user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  added_on   TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);

-- ── Reservation Requests ──────────────────────────────────
CREATE TABLE reservation_requests (
  id           SERIAL    PRIMARY KEY,

  listing_id   INTEGER   NOT NULL
    REFERENCES listings(id) ON DELETE CASCADE,

  requester_id INTEGER   NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,

  status       TEXT      NOT NULL DEFAULT 'PENDING',
  message      TEXT,

  created_on   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_on   TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT reservation_requests_status_check
    CHECK (
      status IN (
        'PENDING',
        'ACCEPTED',
        'REJECTED',
        'CANCELLED'
      )
    ),

  CONSTRAINT reservation_requests_message_length_check
    CHECK (
      message IS NULL
      OR CHAR_LENGTH(message) <= 500
    )
);

CREATE UNIQUE INDEX reservation_requests_unique_pending
  ON reservation_requests (listing_id, requester_id)
  WHERE status = 'PENDING';

CREATE UNIQUE INDEX reservation_requests_one_accepted_per_listing
  ON reservation_requests (listing_id)
  WHERE status = 'ACCEPTED';

CREATE INDEX reservation_requests_requester_status_idx
  ON reservation_requests (requester_id, status);

CREATE INDEX reservation_requests_listing_status_idx
  ON reservation_requests (listing_id, status);

-- ── Listing Views (unique per user per listing) ───────────
CREATE TABLE listing_views (
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  viewed_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (listing_id, user_id)
);

-- ── Chats ─────────────────────────────────────────────────
CREATE TABLE chats (
  id         SERIAL  PRIMARY KEY,
  user_1     INTEGER REFERENCES users(id),
  user_2     INTEGER REFERENCES users(id),
  "isClosed" BOOLEAN DEFAULT false,
  CHECK (user_1 != user_2)
);

-- ── Chat Content ──────────────────────────────────────────
CREATE TABLE chatcontent (
  id           SERIAL  PRIMARY KEY,
  chat_id      INTEGER REFERENCES chats(id),
  sender_id    INTEGER REFERENCES users(id),
  cont_type    TEXT,
  cont         TEXT,
  sentOn       DATE    DEFAULT CURRENT_DATE
);

-- ── Offers ────────────────────────────────────────────────
CREATE TABLE offers (
  id           SERIAL         PRIMARY KEY,
  product_id   INTEGER        REFERENCES listings(id),
  buyer_id     INTEGER        REFERENCES users(id),
  price        NUMERIC(10,2)  NOT NULL CHECK (price > 0),
  "isAccepted" BOOLEAN        DEFAULT false
);

-- ── Notifications ─────────────────────────────────────────
--  Replaces the previous in-memory store, which lost every
--  notification on server restart. The icon is NOT stored:
--  it is presentation, derived from `type` in the controller,
--  so restyling never needs a data migration.
CREATE TABLE notifications (
  id         SERIAL    PRIMARY KEY,

  user_id    INTEGER   NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,

  type       TEXT      NOT NULL,
  title      TEXT      NOT NULL,
  message    TEXT      NOT NULL,
  is_read    BOOLEAN   NOT NULL DEFAULT false,
  created_on TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT notifications_type_check
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
    )
);

-- Serves the notifications page: one user's rows, newest first.
CREATE INDEX notifications_user_created_idx
  ON notifications (user_id, created_on DESC, id DESC);

-- Partial index for the unread badge count. Only unread rows are
-- indexed, so it stays small even as read history grows.
CREATE INDEX notifications_user_unread_idx
  ON notifications (user_id)
  WHERE is_read = false;

-- ── Seed Data ─────────────────────────────────────────────
INSERT INTO products (name, category, description, price, rating, review_count, icon, image_url) VALUES
  ('Obsidian Chronograph',  'Collectibles', 'Japanese movement, sapphire crystal, 42mm case in matte black PVD.',   4800, 4.8, 124, 'watch',               'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80'),
  ('Calfskin Card Holder',  'Fashion',      'Six-card capacity, full-grain Italian calfskin, hand-stitched edges.',   285, 4.6,  89, 'credit-card-2-front', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80'),
  ('Silk Pocket Square',    'Fashion',      'Hand-rolled hem, pure silk twill, woven in Lyon.',                       195, 4.7,  57, 'droplet-half',        'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&q=80'),
  ('Baltic Amber Cufflinks','Fashion',      'Certified Baltic amber set in sterling silver with brushed finish.',     620, 4.9,  32, 'gem',                 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600&q=80'),
  ('Slim Billfold Wallet',  'Fashion',      'Six-slot slim profile, vegetable-tanned Italian leather.',               380, 4.5,  76, 'wallet2',             'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&q=80'),
  ('Precision Titanium Pen','Books',        'CNC machined titanium body, weighted for balance, Schmidt refill.',      240, 4.8,  45, 'pen',                 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&q=80'),
  ('Cedar Shoe Trees',      'Fashion',      'Aromatic cedarwood, adjustable split-toe, preserves shoe shape.',        110, 4.7,  98, 'tree',                'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80'),
  ('Merino Travel Scarf',   'Fashion',      'Extra-fine 18.5-micron merino, 200cm length, hand-finished fringe.',     320, 4.6,  63, 'wind',                'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=600&q=80');

INSERT INTO listings (owner_id, price, title, description, category, "isSold", "isClosed") VALUES
  (NULL, 3200.00, 'Vintage Rolex Submariner',              'Circa 1987, ref. 5513. Original dial, tritium plots, 40mm case. Minor patina consistent with age. No box or papers.',        'Collectibles', false, false),
  (NULL, 480.00,  'Hermès Silk Scarf — Brides de Gala',   'Classic equestrian print, 90cm × 90cm. Light wear to one corner, otherwise excellent. Original box included.',                'Fashion',      false, false),
  (NULL, 1150.00, 'Montblanc Meisterstück 149 Fountain Pen','18k gold nib, piston filler. Professionally serviced 2024. Comes with original case and two ink bottles.',                  'Books',        false, false),
  (NULL, 620.00,  'Berluti Alessandro Derby Shoes — UK 9', 'Venezia leather, burnished by hand. Light scuffs to toe, resoled once. Cedar shoe trees included.',                           'Fashion',      false, false),
  (NULL, 290.00,  'Omega Speedmaster Bracelet — 20mm',     'Stainless steel, brushed and polished, unused. Removed from new watch. Fits 20mm lug width.',                                'Collectibles', false, false);
