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
DROP TABLE IF EXISTS chatcontent     CASCADE;
DROP TABLE IF EXISTS offers          CASCADE;
DROP TABLE IF EXISTS chats           CASCADE;
DROP TABLE IF EXISTS listings        CASCADE;
DROP TABLE IF EXISTS products        CASCADE;
DROP TABLE IF EXISTS refresh_tokens  CASCADE;
DROP TABLE IF EXISTS users           CASCADE;
DROP TABLE IF EXISTS "Something"     CASCADE;
DROP TABLE IF EXISTS "Person"        CASCADE;

-- ── Something ─────────────────────────────────────────────
CREATE TABLE "Something" (
  "id"   SERIAL NOT NULL,
  "name" TEXT   NOT NULL,
  CONSTRAINT "Something_pkey" PRIMARY KEY ("id")
);

-- ── Person ────────────────────────────────────────────────
CREATE TABLE "Person" (
  "id"     SERIAL NOT NULL,
  "email"  TEXT   NOT NULL,
  "name"   TEXT   NOT NULL,
  "avatar" TEXT,
  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");

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
  notify_promotions  BOOLEAN NOT NULL DEFAULT false
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
  created_on   DATE           DEFAULT CURRENT_DATE
);

-- ── Listings (user-created marketplace listings) ───────────
CREATE TABLE listings (
  id          SERIAL         PRIMARY KEY,
  owner_id    INTEGER        REFERENCES users(id),
  price       NUMERIC(10,2)  NOT NULL CHECK (price > 0),
  created_on  DATE           NOT NULL DEFAULT CURRENT_DATE,
  title       TEXT           NOT NULL,
  description TEXT           NOT NULL,
  "isSold"    BOOLEAN        DEFAULT false,
  "isClosed"  BOOLEAN        DEFAULT false
);

-- ── Chats ─────────────────────────────────────────────────
CREATE TABLE chats (
  id         SERIAL  PRIMARY KEY,
  user_1     INTEGER REFERENCES users(id),
  user_2     INTEGER REFERENCES users(id),
  product    INTEGER REFERENCES listings(id),
  "isClosed" BOOLEAN DEFAULT false,
  CHECK (user_1 != user_2)
);

-- ── Chat Content ──────────────────────────────────────────
CREATE TABLE chatcontent (
  id           SERIAL  PRIMARY KEY,
  chat_id      INTEGER REFERENCES chats(id),
  sender_id    INTEGER REFERENCES users(id),
  textcontent  TEXT,
  imagecontent BYTEA
);
drop table if exists "chatcontent";
create table "chatcontent"(
    "id" serial not null,
    "chat_id" integer REFERENCES chats (id),
    "sender_id" integer REFERENCES users (id),
    "textcontent" text,
    "imagecontent" bytea,
    "isRead" boolean DEFAULT false,
    constraint "chatcontent_pkey" PRIMARY KEY ("id")
    );

-- ── Offers ────────────────────────────────────────────────
CREATE TABLE offers (
  id           SERIAL         PRIMARY KEY,
  product_id   INTEGER        REFERENCES listings(id),
  buyer_id     INTEGER        REFERENCES users(id),
  price        NUMERIC(10,2)  NOT NULL CHECK (price > 0),
  "isAccepted" BOOLEAN        DEFAULT false
);

-- ── Seed Data ─────────────────────────────────────────────
INSERT INTO products (name, category, description, price, rating, review_count, icon, image_url) VALUES
  ('Obsidian Chronograph',  'Timepieces',  'Japanese movement, sapphire crystal, 42mm case in matte black PVD.',   4800, 4.8, 124, 'watch',               'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80'),
  ('Calfskin Card Holder',  'Accessories', 'Six-card capacity, full-grain Italian calfskin, hand-stitched edges.',   285, 4.6,  89, 'credit-card-2-front', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80'),
  ('Silk Pocket Square',    'Accessories', 'Hand-rolled hem, pure silk twill, woven in Lyon.',                       195, 4.7,  57, 'droplet-half',        'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&q=80'),
  ('Baltic Amber Cufflinks','Jewellery',   'Certified Baltic amber set in sterling silver with brushed finish.',     620, 4.9,  32, 'gem',                 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600&q=80'),
  ('Slim Billfold Wallet',  'Accessories', 'Six-slot slim profile, vegetable-tanned Italian leather.',               380, 4.5,  76, 'wallet2',             'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&q=80'),
  ('Precision Titanium Pen','Writing',     'CNC machined titanium body, weighted for balance, Schmidt refill.',      240, 4.8,  45, 'pen',                 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&q=80'),
  ('Cedar Shoe Trees',      'Footwear',    'Aromatic cedarwood, adjustable split-toe, preserves shoe shape.',        110, 4.7,  98, 'tree',                'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80'),
  ('Merino Travel Scarf',   'Apparel',     'Extra-fine 18.5-micron merino, 200cm length, hand-finished fringe.',     320, 4.6,  63, 'wind',                'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=600&q=80');

INSERT INTO listings (owner_id, price, title, description, "isSold", "isClosed") VALUES
  (NULL, 3200.00, 'Vintage Rolex Submariner', 'Circa 1987, ref. 5513. Original dial, tritium plots, 40mm case. Minor patina consistent with age. No box or papers.', false, false),
  (NULL, 480.00,  'Hermès Silk Scarf — Brides de Gala', 'Classic equestrian print, 90cm × 90cm. Light wear to one corner, otherwise excellent. Original box included.', false, false),
  (NULL, 1150.00, 'Montblanc Meisterstück 149 Fountain Pen', '18k gold nib, piston filler. Professionally serviced 2024. Comes with original case and two ink bottles.', false, false),
  (NULL, 620.00,  'Berluti Alessandro Derby Shoes — UK 9', 'Venezia leather, burnished by hand. Light scuffs to toe, resoled once. Cedar shoe trees included.', true,  false),
  (NULL, 290.00,  'Omega Speedmaster Bracelet — 20mm', 'Stainless steel, brushed and polished, unused. Removed from new watch. Fits 20mm lug width.', false, false);
