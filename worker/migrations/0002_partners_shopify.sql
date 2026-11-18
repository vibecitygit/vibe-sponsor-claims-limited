-- Partner profiles (one per business) and Shopify connections for partners with a Shopify store.

CREATE TABLE IF NOT EXISTS sponsors (
  id         TEXT PRIMARY KEY,                   -- e.g. 'know-the-culture'; matches offers.sponsor_id
  name       TEXT NOT NULL,
  shop_type  TEXT NOT NULL DEFAULT 'none' CHECK (shop_type IN ('none', 'shopify', 'own_server')),
  shop_url   TEXT,                               -- public store address, e.g. https://knowtheculture.ph
  contact    TEXT,                               -- who to talk to at the business
  notes      TEXT,
  updated_at TEXT NOT NULL
);

-- A custom app the partner creates in their own Shopify Dev Dashboard. We hold its client ID and
-- secret (encrypted) and exchange them for 24-hour Admin API tokens (client credentials grant).
CREATE TABLE IF NOT EXISTS sponsor_shopify (
  sponsor_id        TEXT PRIMARY KEY,
  shop_domain       TEXT NOT NULL,               -- the *.myshopify.com domain
  client_id         TEXT NOT NULL,
  client_secret_enc TEXT NOT NULL,               -- AES-GCM with DATA_KEY; also signs Shopify's webhooks
  access_token_enc  TEXT,
  token_expires_at  TEXT,
  shop_name         TEXT,
  webhook_id        TEXT,
  verified_at       TEXT,
  last_error        TEXT,
  updated_at        TEXT NOT NULL
);

-- Optional: limit an offer's Shopify discount to some collections (comma-separated gid://shopify/Collection/… ids).
ALTER TABLE offers ADD COLUMN shopify_collection_ids TEXT;

-- The Shopify discount made for each claim, and whether making it worked ('ok' or the error text).
ALTER TABLE claims ADD COLUMN shopify_discount_id TEXT;
ALTER TABLE claims ADD COLUMN shopify_sync TEXT;
