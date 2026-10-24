-- Spero CMS schema (idempotent; applied automatically on start by scripts/lib/db.mjs)
CREATE TABLE IF NOT EXISTS cms_content (
  key        text PRIMARY KEY,                 -- site | nav | theme | team | clients | contact | portfolio | page:<name>
  draft      jsonb NOT NULL,
  published  jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cms_versions (
  id         text PRIMARY KEY,
  key        text NOT NULL,
  ts         timestamptz NOT NULL DEFAULT now(),
  username   text NOT NULL DEFAULT 'system',
  note       text NOT NULL DEFAULT '',
  data       jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS cms_versions_key_ts ON cms_versions (key, ts DESC);
CREATE TABLE IF NOT EXISTS cms_meta (
  key   text PRIMARY KEY,                      -- 'updates' -> {account, updatedAt}
  value jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS updates (
  key          text PRIMARY KEY,               -- ig-<shortcode> | manual-<id>
  slug         text NOT NULL,
  published_at date,
  published    boolean NOT NULL DEFAULT false,
  visible      boolean NOT NULL DEFAULT true,
  data         jsonb NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS updates_slug_uq ON updates (slug);
CREATE TABLE IF NOT EXISTS admin_users (
  id            text PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  role          text NOT NULL CHECK (role IN ('admin','editor')),
  disabled      boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  data          jsonb NOT NULL,                -- name, scrypt hash, session version, created_at
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS activity_log (
  id       bigserial PRIMARY KEY,
  ts       timestamptz NOT NULL DEFAULT now(),
  username text NOT NULL,
  action   text NOT NULL,
  target   text NOT NULL DEFAULT '',
  detail   text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS activity_log_ts ON activity_log (ts DESC);
