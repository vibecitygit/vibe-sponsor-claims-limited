-- Sponsor claims: offers, claims, partner keys, each sponsor's PayMongo account, webhook log.
-- Amounts are in centavos (PHP x 100), the unit PayMongo uses.

CREATE TABLE IF NOT EXISTS offers (
  id             TEXT PRIMARY KEY,               -- e.g. 'KTC'; also the claim code prefix
  sponsor_id     TEXT NOT NULL,                  -- e.g. 'know-the-culture'
  title          TEXT NOT NULL,                  -- shown on the PayMongo line item
  discount_type  TEXT NOT NULL CHECK (discount_type IN ('percent', 'amount', 'free')),
  discount_value INTEGER NOT NULL DEFAULT 0,     -- percent (1-100) or centavos off; 0 for 'free'
  max_items      INTEGER NOT NULL DEFAULT 1,     -- how many items the discount covers
  channels       TEXT NOT NULL DEFAULT 'in_store,online',
  valid_from     TEXT,                           -- ISO 8601; NULL = no start limit
  valid_to       TEXT,                           -- ISO 8601; NULL = no end limit
  max_claims     INTEGER,                        -- NULL = unlimited; otherwise a hard cap on codes issued
  active         INTEGER NOT NULL DEFAULT 1,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
  code                TEXT PRIMARY KEY,          -- compact form, e.g. 'KTC7Q3FK9M2XA'
  display_code        TEXT NOT NULL,             -- e.g. 'KTC-7Q3FK-9M2XA'
  offer_id            TEXT NOT NULL REFERENCES offers(id),
  sponsor_id          TEXT NOT NULL,
  ticket_id           TEXT NOT NULL,
  state               TEXT NOT NULL DEFAULT 'issued' CHECK (state IN ('issued', 'held', 'redeemed')),
  channel             TEXT,                      -- 'online' or 'in_store' once held or redeemed
  hold_ref            TEXT,                      -- the cart / scan that holds the claim
  hold_until          TEXT,                      -- ISO 8601; an expired hold counts as free
  checkout_session_id TEXT,                      -- PayMongo cs_... for in-store scans
  order_ref           TEXT,                      -- partner's order id or PayMongo session id
  amount_paid         INTEGER,                   -- centavos, when known
  created_at          TEXT NOT NULL,
  redeemed_at         TEXT,
  UNIQUE (offer_id, ticket_id)                   -- one claim per ticket per offer
);
CREATE INDEX IF NOT EXISTS claims_offer ON claims (offer_id);

CREATE TABLE IF NOT EXISTS api_keys (
  key_hash   TEXT PRIMARY KEY,                   -- SHA-256 of the key; the key itself is never stored
  key_id     TEXT NOT NULL UNIQUE,               -- short public id, for listing and revoking
  sponsor_id TEXT NOT NULL,
  scope      TEXT NOT NULL CHECK (scope IN ('online', 'staff')),
  label      TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS sponsor_paymongo (
  sponsor_id         TEXT PRIMARY KEY,
  secret_key_enc     TEXT NOT NULL,              -- AES-GCM with DATA_KEY
  webhook_secret_enc TEXT,                       -- AES-GCM with DATA_KEY
  webhook_id         TEXT,
  livemode           INTEGER NOT NULL DEFAULT 0,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id    TEXT PRIMARY KEY,
  sponsor_id  TEXT NOT NULL,
  type        TEXT NOT NULL,
  received_at TEXT NOT NULL
);
