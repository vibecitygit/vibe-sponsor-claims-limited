// Vibe City admin: offers, sponsor keys, and connecting each sponsor's PayMongo account.
import { HttpError } from './http.js';
import { randomBase32, sha256Hex, seal, unseal } from './crypto.js';
import { createWebhook } from './paymongo.js';

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;
const OFFER_ID = /^[A-Z0-9]{2,8}$/;
const now = env => (env.now ? env.now() : new Date()).toISOString();

function isoOrNull(v, field) {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, 'bad_request', `${field} must be a date, e.g. 2026-12-19T23:59:59+08:00.`);
  return d.toISOString();
}

export async function putOffer(env, id, b) {
  if (!OFFER_ID.test(id)) throw new HttpError(400, 'bad_request', 'Offer ids are 2–8 capital letters or digits, e.g. KTC. They start every claim code.');
  if (!ID.test(b.sponsorId || '')) throw new HttpError(400, 'bad_request', 'sponsorId is required (letters, digits, - and _).');
  if (!b.title || String(b.title).length > 120) throw new HttpError(400, 'bad_request', 'title is required (up to 120 characters).');
  const type = b.discountType;
  if (!['percent', 'amount', 'free'].includes(type)) throw new HttpError(400, 'bad_request', 'discountType is percent, amount or free.');
  const value = type === 'free' ? 0 : Number(b.discountValue);
  if (type === 'percent' && !(Number.isInteger(value) && value >= 1 && value <= 100)) throw new HttpError(400, 'bad_request', 'A percent discount is a whole number from 1 to 100.');
  if (type === 'amount' && !(Number.isInteger(value) && value > 0)) throw new HttpError(400, 'bad_request', 'An amount discount is whole centavos, e.g. 10000 for ₱100.');
  const channels = (Array.isArray(b.channels) && b.channels.length ? b.channels : ['in_store', 'online']);
  if (!channels.every(c => c === 'in_store' || c === 'online')) throw new HttpError(400, 'bad_request', 'channels can hold in_store and online.');
  const maxClaims = b.maxClaims === undefined || b.maxClaims === null ? null : Number(b.maxClaims);
  if (maxClaims !== null && !(Number.isInteger(maxClaims) && maxClaims > 0)) throw new HttpError(400, 'bad_request', 'maxClaims is a positive whole number or null.');
  const maxItems = b.maxItems === undefined ? 1 : Number(b.maxItems);
  const collections = Array.isArray(b.shopifyCollectionIds) ? b.shopifyCollectionIds.map(String).map(s => s.trim()).filter(Boolean) : [];
  if (!collections.every(c => /^gid:\/\/shopify\/Collection\/\d+$/.test(c))) throw new HttpError(400, 'bad_request', 'shopifyCollectionIds are ids like gid://shopify/Collection/123.');
  if (!(Number.isInteger(maxItems) && maxItems > 0)) throw new HttpError(400, 'bad_request', 'maxItems is a positive whole number.');

  await env.DB.prepare(
    `INSERT INTO offers (id, sponsor_id, title, discount_type, discount_value, max_items, channels, valid_from, valid_to, max_claims, active, shopify_collection_ids, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET sponsor_id = excluded.sponsor_id, title = excluded.title, discount_type = excluded.discount_type,
       discount_value = excluded.discount_value, max_items = excluded.max_items, channels = excluded.channels,
       valid_from = excluded.valid_from, valid_to = excluded.valid_to, max_claims = excluded.max_claims,
       active = excluded.active, shopify_collection_ids = excluded.shopify_collection_ids, updated_at = excluded.updated_at`
  ).bind(id, b.sponsorId, String(b.title), type, value, maxItems, [...new Set(channels)].join(','),
    isoOrNull(b.validFrom, 'validFrom'), isoOrNull(b.validTo, 'validTo'), maxClaims, b.active === false ? 0 : 1,
    collections.length ? collections.join(',') : null, now(env)).run();
  return env.DB.prepare('SELECT * FROM offers WHERE id = ?').bind(id).first();
}

export async function listOffers(env) {
  const { results } = await env.DB.prepare(
    `SELECT o.*, (SELECT COUNT(*) FROM claims c WHERE c.offer_id = o.id) AS claimed,
            (SELECT COUNT(*) FROM claims c WHERE c.offer_id = o.id AND c.state = 'redeemed') AS redeemed
     FROM offers o ORDER BY o.id`
  ).all();
  return { offers: results };
}

/** Creates a key. The key is shown once; only its hash is kept. */
export async function createKey(env, sponsorId, { scope, label }) {
  if (!ID.test(sponsorId)) throw new HttpError(400, 'bad_request', 'Bad sponsor id.');
  if (scope !== 'online' && scope !== 'staff') throw new HttpError(400, 'bad_request', 'scope is "online" (the partner\'s server) or "staff" (the scanner).');
  const key = `vck_${scope}_${randomBase32(32).toLowerCase()}`;
  const keyId = `key_${randomBase32(8).toLowerCase()}`;
  await env.DB.prepare('INSERT INTO api_keys (key_hash, key_id, sponsor_id, scope, label, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(await sha256Hex(key), keyId, sponsorId, scope, label ? String(label).slice(0, 80) : null, now(env)).run();
  return { keyId, key, sponsorId, scope, note: 'Store this key now. It cannot be shown again.' };
}

export async function listKeys(env, sponsorId) {
  const { results } = await env.DB.prepare('SELECT key_id, scope, label, created_at, revoked_at FROM api_keys WHERE sponsor_id = ? ORDER BY created_at')
    .bind(sponsorId).all();
  return { keys: results };
}

/** Revokes a key, but only if it belongs to this sponsor: one partner's page can never touch another's keys. */
export async function revokeKey(env, sponsorId, keyId) {
  const res = await env.DB.prepare('UPDATE api_keys SET revoked_at = ? WHERE key_id = ? AND sponsor_id = ? AND revoked_at IS NULL').bind(now(env), keyId, sponsorId).run();
  if (!res.meta.changes) throw new HttpError(404, 'not_found', 'No active key with that id.');
  return { revoked: true, keyId };
}

/** Stores a sponsor's PayMongo secret key (encrypted). webhookSecret is optional if you use registerWebhook. */
export async function putPaymongo(env, sponsorId, { secretKey, webhookSecret }) {
  if (!ID.test(sponsorId)) throw new HttpError(400, 'bad_request', 'Bad sponsor id.');
  if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(secretKey || '')) throw new HttpError(400, 'bad_request', 'secretKey must be a PayMongo secret key (sk_test_… or sk_live_…).');
  const livemode = secretKey.startsWith('sk_live_') ? 1 : 0;
  await env.DB.prepare(
    `INSERT INTO sponsor_paymongo (sponsor_id, secret_key_enc, webhook_secret_enc, livemode, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (sponsor_id) DO UPDATE SET secret_key_enc = excluded.secret_key_enc,
       webhook_secret_enc = COALESCE(excluded.webhook_secret_enc, sponsor_paymongo.webhook_secret_enc),
       livemode = excluded.livemode, updated_at = excluded.updated_at`
  ).bind(sponsorId, await seal(env, secretKey), webhookSecret ? await seal(env, webhookSecret) : null, livemode, now(env)).run();
  return { sponsorId, connected: true, livemode: !!livemode, webhookSecretStored: !!webhookSecret };
}

/** Registers this worker's webhook on the sponsor's PayMongo account and stores the signing secret it returns. */
export async function registerWebhook(env, sponsorId, fetchImpl = fetch) {
  if (!env.PUBLIC_BASE_URL) throw new HttpError(501, 'not_configured', 'Set PUBLIC_BASE_URL to this worker\'s https address first.');
  const pm = await env.DB.prepare('SELECT secret_key_enc FROM sponsor_paymongo WHERE sponsor_id = ?').bind(sponsorId).first();
  if (!pm) throw new HttpError(404, 'not_found', 'Store the sponsor\'s PayMongo secret key first.');
  const url = `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/v1/webhooks/paymongo/${encodeURIComponent(sponsorId)}`;
  const hook = await createWebhook(fetchImpl, await unseal(env, pm.secret_key_enc), url);
  if (!hook.secretKey) throw new HttpError(502, 'paymongo_error', 'PayMongo did not return a webhook secret.');
  await env.DB.prepare('UPDATE sponsor_paymongo SET webhook_secret_enc = ?, webhook_id = ?, updated_at = ? WHERE sponsor_id = ?')
    .bind(await seal(env, hook.secretKey), hook.id, now(env), sponsorId).run();
  return { sponsorId, webhookId: hook.id, url, livemode: hook.livemode };
}

export async function listClaims(env, { offerId, state, limit }) {
  const n = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const where = [], args = [];
  if (offerId) { where.push('offer_id = ?'); args.push(offerId); }
  if (state) { where.push('state = ?'); args.push(state); }
  const { results } = await env.DB.prepare(
    `SELECT display_code AS code, offer_id, sponsor_id, ticket_id, state, channel, order_ref, amount_paid, created_at, redeemed_at
     FROM claims ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ${n}`
  ).bind(...args).all();
  return { claims: results };
}
