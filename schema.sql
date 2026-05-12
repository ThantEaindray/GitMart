-- ─────────────────────────────────────────────────────────
--  Database Schema
-- ─────────────────────────────────────────────────────────
--  Single source of truth for the database structure.
--  Update this file whenever you add, remove, or change
--  tables, columns, or indexes.
--
--  Used by: scripts/reset.js
-- ─────────────────────────────────────────────────────────

-- Drop existing tables
DROP TABLE IF EXISTS "Something" CASCADE;
DROP TABLE IF EXISTS "Person" CASCADE;

-- Create tables
CREATE TABLE "Something" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "Something_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Person" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "avatar" TEXT,
  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");


--CA2 Database configs
-- instead of dropping them all at the start ill do them one by one
DROP TABLE IF EXISTS "users";
create table "users"(
    "id" SERIAL NOT NULL,
    "username" text not null,
    "icon" bytea,
    "email" text not null,
    "password" text not null,
    "created_on" date not null,
    "isStaff" boolean DEFAULT false,
    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
    );

DROP TABLE IF EXISTS "listings";
create table "listings"(
    "id" SERIAL NOT NULL,
    "owner_id" integer REFERENCES users (id),
    "price" int not null,
    CHECK (price > 0),
    "created_on" date not null,
    "title" text not null,
    "description" text not null,
    "image1" bytea not null,
    "image2" bytea,
    "image3" bytea,
    "isSold" boolean DEFAULT false,
    "isClosed" boolean DEFAULT false,
    constraint "listing_pkey" PRIMARY KEY ("id")
    );

drop table if exists "chats";
create table "chats"(
    "id" serial not null,
    "user_1" integer REFERENCES users (id),
    "user_2" integer REFERENCES users (id),
    CHECK (user_1 != user_2),
    "product" integer REFERENCES listings (id),
    "isClosed" boolean DEFAULT false,
    constraint "chats_pkey" PRIMARY KEY ("id")
    );

drop table if exists "chatcontent";
create table "chatcontent"(
    "id" serial not null,
    "chat_id" integer REFERENCES chats (id),
    "sender_id" integer REFERENCES users (id),
    "textcontent" text,
    "imagecontent" bytea,
    constraint "chatcontent_pkey" PRIMARY KEY ("id")
    );

drop table if exists "offers";
create table "offers"(
    "id" serial not null,
    "product_id" int REFERENCES listings (id),
    "buyer_id" int REFERENCES users (id),
    "price" int not null,
    CHECK (price > 0),
    "isAccepted" boolean DEFAULT false,
    constraint "offers_pkey" PRIMARY KEY ("id")
    );