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
DROP TABLE IF EXISTS chatcontent CASCADE;
DROP TABLE IF EXISTS offers     CASCADE;
DROP TABLE IF EXISTS chats      CASCADE;
DROP TABLE IF EXISTS listings   CASCADE;
DROP TABLE IF EXISTS products   CASCADE;
DROP TABLE IF EXISTS users      CASCADE;
DROP TABLE IF EXISTS "Something" CASCADE;
DROP TABLE IF EXISTS "Person"   CASCADE;

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
  "isStaff"  BOOLEAN NOT NULL DEFAULT false
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
  created_on   DATE           DEFAULT CURRENT_DATE
);

-- ── Listings (user-created marketplace listings) ───────────
CREATE TABLE listings (
  id          SERIAL  PRIMARY KEY,
  owner_id    INTEGER REFERENCES users(id),
  price       INTEGER NOT NULL CHECK (price > 0),
  created_on  DATE    NOT NULL DEFAULT CURRENT_DATE,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL,
  image1      BYTEA   NOT NULL,
  image2      BYTEA,
  image3      BYTEA,
  "isSold"    BOOLEAN DEFAULT false,
  "isClosed"  BOOLEAN DEFAULT false
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
  textcontent  TEXT,
  imagecontent TEXT,
  sentOn       DATE    DEFAULT CURRENT_DATE
);

-- ── Offers ────────────────────────────────────────────────
CREATE TABLE offers (
  id           SERIAL  PRIMARY KEY,
  product_id   INTEGER REFERENCES listings(id),
  buyer_id     INTEGER REFERENCES users(id),
  price        INTEGER NOT NULL CHECK (price > 0),
  "isAccepted" BOOLEAN DEFAULT false
);

-- ── Seed Data ─────────────────────────────────────────────
INSERT INTO products (name, category, description, price, rating, review_count, icon) VALUES
  ('Obsidian Chronograph',  'Timepieces',  'Japanese movement, sapphire crystal, 42mm case in matte black PVD.',   4800, 4.8, 124, 'watch'),
  ('Calfskin Card Holder',  'Accessories', 'Six-card capacity, full-grain Italian calfskin, hand-stitched edges.',   285, 4.6,  89, 'credit-card-2-front'),
  ('Silk Pocket Square',    'Accessories', 'Hand-rolled hem, pure silk twill, woven in Lyon.',                       195, 4.7,  57, 'droplet-half'),
  ('Baltic Amber Cufflinks','Jewellery',   'Certified Baltic amber set in sterling silver with brushed finish.',     620, 4.9,  32, 'gem'),
  ('Slim Billfold Wallet',  'Accessories', 'Six-slot slim profile, vegetable-tanned Italian leather.',               380, 4.5,  76, 'wallet2'),
  ('Precision Titanium Pen','Writing',     'CNC machined titanium body, weighted for balance, Schmidt refill.',      240, 4.8,  45, 'pen'),
  ('Cedar Shoe Trees',      'Footwear',    'Aromatic cedarwood, adjustable split-toe, preserves shoe shape.',        110, 4.7,  98, 'tree'),
  ('Merino Travel Scarf',   'Apparel',     'Extra-fine 18.5-micron merino, 200cm length, hand-finished fringe.',     320, 4.6,  63, 'wind');
