// One settings page per partner: profile, shop connection, offers, scanner accounts, claim totals.
// Every query here is filtered by the partner's id, so a partner's page only ever shows (and can only
// change) that partner's own offers, keys and claims.
import { HttpError } from './http.js';
import { syncClaimToShopify } from './claims.js';
import { describeDiscount } from './claims.js';

const ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const SHOP_TYPES = ['none', 'shopify', 'own_server'];
const now = env => (env.now ? env.now() : new Date()).toISOString();

export async function listPartners(env) {
  // Partners with a profile, plus any sponsor id that already has offers or keys but no profile yet.
  const { results } = await env.DB.prepare(
    `SELECT id, name, shop_type FROM sponsors
     UNION
     SELECT DISTINCT sponsor_id, sponsor_id, 'none' FROM offers WHERE sponsor_id NOT IN (SELECT id FROM sponsors)
     UNION
     SELECT DISTINCT sponsor_id, sponsor_id, 'none' FROM api_keys WHERE sponsor_id NOT IN (SELECT id FROM sponsors)
     ORDER BY 2`
  ).all();
  return { partners: results.map(r => ({ id: r.id, name: r.name, shopType: r.shop_type })) };
}

export async function putPartner(env, sponsorId, b) {
  if (!ID.test(sponsorId)) throw new HttpError(400, 'bad_request', 'Partner ids are lowercase letters, digits and dashes, e.g. know-the-culture.');
  const name = String(b.name || '').trim();
  if (!name || name.length > 80) throw new HttpError(400, 'bad_request', 'Enter the business name (up to 80 characters).');
  const shopType = b.shopType || 'none';
  if (!SHOP_TYPES.includes(shopType)) throw new HttpError(400, 'bad_request', 'shopType is none, shopify or own_server.');
  let shopUrl = String(b.shopUrl || '').trim().replace(/\/+$/, '');
  if (shopUrl && !/^https:\/\/[^\s/]+$/.test(shopUrl)) throw new HttpError(400, 'bad_request', 'The shop address is the https address of the store\'s home page, e.g. https://knowtheculture.ph.');
  await env.DB.prepare(
    `INSERT INTO sponsors (id, name, shop_type, shop_url, contact, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, shop_type = excluded.shop_type, shop_url = excluded.shop_url,
       contact = excluded.contact, notes = excluded.notes, updated_at = excluded.updated_at`
  ).bind(sponsorId, name, shopType, shopUrl || null, String(b.contact || '').slice(0, 200) || null, String(b.notes || '').slice(0, 2000) || null, now(env)).run();
  return partnerOverview(env, sponsorId);
}

export async function partnerOverview(env, sponsorId) {
  const db = env.DB;
  const profile = await db.prepare('SELECT * FROM sponsors WHERE id = ?').bind(sponsorId).first();
  const { results: offers } = await db.prepare(
    `SELECT o.*, (SELECT COUNT(*) FROM claims c WHERE c.offer_id = o.id) AS claimed,
            (SELECT COUNT(*) FROM claims c WHERE c.offer_id = o.id AND c.state = 'redeemed') AS redeemed
     FROM offers o WHERE o.sponsor_id = ? ORDER BY o.id`
  ).bind(sponsorId).all();
  const { results: keys } = await db.prepare(
    'SELECT key_id, scope, label, created_at, revoked_at FROM api_keys WHERE sponsor_id = ? ORDER BY created_at'
  ).bind(sponsorId).all();
  const pm = await db.prepare('SELECT livemode, webhook_id, webhook_secret_enc IS NOT NULL AS has_webhook_secret, updated_at FROM sponsor_paymongo WHERE sponsor_id = ?').bind(sponsorId).first();
  const sh = await db.prepare('SELECT shop_domain, client_id, shop_name, webhook_id, verified_at, last_error, updated_at FROM sponsor_shopify WHERE sponsor_id = ?').bind(sponsorId).first();
  const { results: recent } = await db.prepare(
    `SELECT display_code AS code, offer_id, state, channel, order_ref, amount_paid, created_at, redeemed_at, shopify_sync
     FROM claims WHERE sponsor_id = ? ORDER BY created_at DESC LIMIT 25`
  ).bind(sponsorId).all();
  const sync = await db.prepare(
    `SELECT COUNT(*) AS n FROM claims WHERE sponsor_id = ? AND state != 'redeemed' AND (shopify_sync IS NULL OR shopify_sync LIKE 'error:%')`
  ).bind(sponsorId).first();

  if (!profile && !offers.length && !keys.length) throw new HttpError(404, 'not_found', 'No partner with that id.');
  return {
    id: sponsorId,
    profile: profile
      ? { name: profile.name, shopType: profile.shop_type, shopUrl: profile.shop_url, contact: profile.contact, notes: profile.notes }
      : { name: sponsorId, shopType: 'none', shopUrl: null, contact: null, notes: null },
    offers: offers.map(o => ({
      id: o.id, title: o.title, discountType: o.discount_type, discountValue: o.discount_value, label: describeDiscount(o),
      maxItems: o.max_items, channels: o.channels.split(','), validFrom: o.valid_from, validTo: o.valid_to,
      maxClaims: o.max_claims, active: !!o.active, shopifyCollectionIds: o.shopify_collection_ids ? o.shopify_collection_ids.split(',') : [],
      claimed: o.claimed, redeemed: o.redeemed,
    })),
    scannerAccounts: keys.filter(k => k.scope === 'staff').map(keyView),
    onlineKeys: keys.filter(k => k.scope === 'online').map(keyView),
    paymongo: pm ? { connected: true, livemode: !!pm.livemode, webhookReady: !!pm.has_webhook_secret, updatedAt: pm.updated_at } : { connected: false },
    shopify: sh
      ? { connected: !!sh.verified_at, shopDomain: sh.shop_domain, clientId: sh.client_id, shopName: sh.shop_name, webhookReady: !!sh.webhook_id, verifiedAt: sh.verified_at, lastError: sh.last_error }
      : { connected: false },
    claimsNeedingShopifySync: profile?.shop_type === 'shopify' ? sync.n : 0,
    recentClaims: recent,
  };
}

const keyView = k => ({ keyId: k.key_id, label: k.label, createdAt: k.created_at, revoked: !!k.revoked_at });

/** Retries Shopify discounts for this partner's open claims that don't have one yet (e.g. made before Shopify was connected). */
export async function resyncShopify(env, sponsorId) {
  const { results } = await env.DB.prepare(
    `SELECT c.* FROM claims c WHERE c.sponsor_id = ? AND c.state != 'redeemed' AND (c.shopify_sync IS NULL OR c.shopify_sync LIKE 'error:%') LIMIT 100`
  ).bind(sponsorId).all();
  let ok = 0, failed = 0;
  for (const row of results) {
    const offer = await env.DB.prepare('SELECT * FROM offers WHERE id = ?').bind(row.offer_id).first();
    const r = await syncClaimToShopify(env, row, offer);
    if (r.synced) ok++; else if (r.shop) failed++;
  }
  return { tried: results.length, synced: ok, failed };
}
