// Shopify calls for partners whose online shop runs on Shopify (PayMongo is a payment app inside
// Shopify's checkout there, so the discount has to exist in Shopify itself).
//
// The partner creates a custom app in their own Shopify Dev Dashboard (scopes: write_discounts,
// read_discounts, read_orders), installs it on their store, and gives us its client ID and secret.
// Docs: https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant
//       https://shopify.dev/docs/api/admin-graphql/latest/mutations/discountCodeBasicCreate
//       https://shopify.dev/docs/apps/build/webhooks/verify-deliveries
import { HttpError } from './http.js';
import { seal, unseal, safeEqual } from './crypto.js';

export const API_VERSION = '2026-10';
const enc = new TextEncoder();
const nowIso = env => (env.now ? env.now() : new Date()).toISOString();

export function normalizeShopDomain(input) {
  const s = String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) ? s : null;
}

async function loadConn(env, sponsorId) {
  const row = await env.DB.prepare('SELECT * FROM sponsor_shopify WHERE sponsor_id = ?').bind(sponsorId).first();
  if (!row) throw new HttpError(409, 'shopify_not_connected', 'This partner has not connected Shopify yet.');
  return row;
}

/** Returns a valid Admin API token, exchanging the client credentials when the cached one is near expiry. */
async function accessToken(env, conn, fetchImpl) {
  const now = env.now ? env.now() : new Date();
  if (conn.access_token_enc && conn.token_expires_at && conn.token_expires_at > new Date(now.getTime() + 5 * 60_000).toISOString()) {
    return unseal(env, conn.access_token_enc);
  }
  let res;
  try {
    res = await fetchImpl(`https://${conn.shop_domain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: conn.client_id, client_secret: await unseal(env, conn.client_secret_enc) }).toString(),
    });
  } catch {
    throw new HttpError(502, 'shopify_unreachable', 'Could not reach Shopify.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    const why = body.error_description || body.error || body.errors || `Shopify answered ${res.status}`;
    throw new HttpError(502, 'shopify_auth_failed', `Shopify refused the app credentials: ${typeof why === 'string' ? why : JSON.stringify(why)}.`);
  }
  const expires = new Date(now.getTime() + (Number(body.expires_in) || 86399) * 1000).toISOString();
  await env.DB.prepare('UPDATE sponsor_shopify SET access_token_enc = ?, token_expires_at = ? WHERE sponsor_id = ?')
    .bind(await seal(env, body.access_token), expires, conn.sponsor_id).run();
  return body.access_token;
}

async function gql(env, sponsorId, query, variables, fetchImpl) {
  const conn = await loadConn(env, sponsorId);
  const token = await accessToken(env, conn, fetchImpl);
  let res;
  try {
    res = await fetchImpl(`https://${conn.shop_domain}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new HttpError(502, 'shopify_unreachable', 'Could not reach Shopify.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) {
    const msg = Array.isArray(body.errors) ? body.errors.map(e => e.message).join(' ') : (body.errors || `Shopify answered ${res.status}`);
    throw new HttpError(502, 'shopify_error', String(msg));
  }
  return body.data;
}

const userErrors = errs => (errs && errs.length ? errs.map(e => e.message).join(' ') : null);

/** Saves the app credentials, then proves they work by reading the shop's name. */
export async function connectShopify(env, sponsorId, { shopDomain, clientId, clientSecret }, fetchImpl) {
  const domain = normalizeShopDomain(shopDomain);
  if (!domain) throw new HttpError(400, 'bad_request', 'Enter the store\'s myshopify.com address, e.g. know-the-culture.myshopify.com.');
  if (!clientId || !clientSecret) throw new HttpError(400, 'bad_request', 'Enter the app\'s client ID and client secret.');
  await env.DB.prepare(
    `INSERT INTO sponsor_shopify (sponsor_id, shop_domain, client_id, client_secret_enc, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (sponsor_id) DO UPDATE SET shop_domain = excluded.shop_domain, client_id = excluded.client_id,
       client_secret_enc = excluded.client_secret_enc, access_token_enc = NULL, token_expires_at = NULL,
       verified_at = NULL, last_error = NULL, updated_at = excluded.updated_at`
  ).bind(sponsorId, domain, String(clientId).trim(), await seal(env, String(clientSecret).trim()), nowIso(env)).run();
  return testShopify(env, sponsorId, fetchImpl);
}

export async function testShopify(env, sponsorId, fetchImpl) {
  try {
    const data = await gql(env, sponsorId, '{ shop { name myshopifyDomain } }', {}, fetchImpl);
    await env.DB.prepare('UPDATE sponsor_shopify SET shop_name = ?, verified_at = ?, last_error = NULL WHERE sponsor_id = ?')
      .bind(data.shop.name, nowIso(env), sponsorId).run();
    return { connected: true, shopName: data.shop.name };
  } catch (err) {
    await env.DB.prepare('UPDATE sponsor_shopify SET verified_at = NULL, last_error = ? WHERE sponsor_id = ?').bind(err.message, sponsorId).run();
    throw err;
  }
}

/** Subscribes this worker to the store's orders/paid events (needs read_orders). */
export async function registerShopifyWebhook(env, sponsorId, fetchImpl) {
  if (!env.PUBLIC_BASE_URL) throw new HttpError(501, 'not_configured', 'Set PUBLIC_BASE_URL to this worker\'s https address first.');
  const uri = `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/v1/webhooks/shopify/${encodeURIComponent(sponsorId)}`;
  const data = await gql(env, sponsorId,
    `mutation($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
       webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) { webhookSubscription { id } userErrors { field message } }
     }`,
    { topic: 'ORDERS_PAID', webhookSubscription: { uri, format: 'JSON' } }, fetchImpl);
  const r = data.webhookSubscriptionCreate;
  const err = userErrors(r.userErrors);
  if (err) throw new HttpError(502, 'shopify_error', err);
  await env.DB.prepare('UPDATE sponsor_shopify SET webhook_id = ? WHERE sponsor_id = ?').bind(r.webhookSubscription.id, sponsorId).run();
  return { webhookId: r.webhookSubscription.id, uri };
}

/** Creates the single-use Shopify discount that mirrors one claim. Returns the DiscountCodeNode id. */
export async function createClaimDiscount(env, sponsorId, { code, offer, startsAt }, fetchImpl) {
  const value = offer.discount_type === 'percent'
    ? { percentage: offer.discount_value / 100 }
    : offer.discount_type === 'amount'
      ? { discountAmount: { amount: (offer.discount_value / 100).toFixed(2), appliesOnEachItem: false } }
      : { percentage: 1 };
  const collections = (offer.shopify_collection_ids || '').split(',').map(s => s.trim()).filter(Boolean);
  const data = await gql(env, sponsorId,
    `mutation($basicCodeDiscount: DiscountCodeBasicInput!) {
       discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) { codeDiscountNode { id } userErrors { field message } }
     }`,
    {
      basicCodeDiscount: {
        title: `Vibe City ${code}`,
        code,
        startsAt,
        endsAt: offer.valid_to || null,
        usageLimit: 1,
        appliesOncePerCustomer: true,
        context: { all: 'ALL' },
        customerGets: { value, items: collections.length ? { collections: { add: collections } } : { all: true } },
      },
    }, fetchImpl);
  const r = data.discountCodeBasicCreate;
  const err = userErrors(r.userErrors);
  if (err) throw new HttpError(502, 'shopify_error', err);
  return r.codeDiscountNode.id;
}

/** Ends a claim's Shopify discount (used once the claim is redeemed elsewhere). */
export async function deactivateDiscount(env, sponsorId, discountId, fetchImpl) {
  const data = await gql(env, sponsorId,
    `mutation($id: ID!) { discountCodeDeactivate(id: $id) { codeDiscountNode { id } userErrors { field message } } }`,
    { id: discountId }, fetchImpl);
  const err = userErrors(data.discountCodeDeactivate.userErrors);
  if (err) throw new HttpError(502, 'shopify_error', err);
}

/** X-Shopify-Hmac-SHA256: base64 HMAC-SHA256 of the raw body, keyed with the app's client secret. */
export async function verifyShopifyWebhook(env, sponsorId, rawBody, header) {
  if (!header) return false;
  const row = await env.DB.prepare('SELECT client_secret_enc FROM sponsor_shopify WHERE sponsor_id = ?').bind(sponsorId).first();
  if (!row) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(await unseal(env, row.client_secret_enc)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(rawBody)));
  return safeEqual(btoa(String.fromCharCode(...sig)), header.trim());
}

/** The discount codes an order used. Reads discount_codes[].code and code-type discount_applications. */
export function orderDiscountCodes(order) {
  const codes = new Set();
  for (const d of order?.discount_codes || []) if (d && typeof d.code === 'string') codes.add(d.code);
  for (const a of order?.discount_applications || []) if (a && a.type === 'discount_code' && typeof a.code === 'string') codes.add(a.code);
  return [...codes];
}
