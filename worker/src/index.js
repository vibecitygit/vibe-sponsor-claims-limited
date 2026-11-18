// Vibe City sponsor claims API (Cloudflare Worker + D1).
//
//   Guests (browser)            POST /v1/claims                      get a claim code for a ticket
//                               GET  /v1/claims/:code                check a code's state
//   Partner servers ("online")  POST /v1/partner/claims/verify       before their PayMongo checkout; holds the code
//                               POST /v1/partner/claims/redeem       after payment
//                               POST /v1/partner/claims/release      cart abandoned
//   Staff scanner ("staff")     GET  /v1/staff/me
//                               POST /v1/staff/lookup                what a scanned code is for
//                               POST /v1/staff/scan                  create the discounted PayMongo link
//                               POST /v1/staff/cancel                cancel an open link
//   PayMongo                    POST /v1/webhooks/paymongo/:sponsorId
//   Shopify                     POST /v1/webhooks/shopify/:sponsorId     orders/paid
//   Vibe City admin             /v1/admin/...                        partners, offers, keys, PayMongo, Shopify, claims
//                                                                    (partner.html is the settings page for these)
import { HttpError, json, errorResponse, readJson, requireAdmin, requireSponsorKey, corsHeaders } from './http.js';
import * as claims from './claims.js';
import * as admin from './admin.js';
import * as partners from './partners.js';
import { connectShopify, testShopify, registerShopifyWebhook } from './shopify.js';

const routes = [];
const route = (method, pattern, handler, { cors = false } = {}) =>
  routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$'), handler, cors });

/* Guests */
route('POST', '/v1/claims', async (req, env) => {
  const r = await claims.issueClaim(env, await readJson(req));
  return json(r, r.created ? 201 : 200);
}, { cors: true });
route('GET', '/v1/claims/:code', async (req, env, p) => json(await claims.claimStatus(env, decodeURIComponent(p.code))), { cors: true });

/* Partner servers */
route('POST', '/v1/partner/claims/verify', async (req, env) => json(await claims.partnerVerify(env, await requireSponsorKey(req, env, 'online'), await readJson(req))));
route('POST', '/v1/partner/claims/redeem', async (req, env) => json(await claims.partnerRedeem(env, await requireSponsorKey(req, env, 'online'), await readJson(req))));
route('POST', '/v1/partner/claims/release', async (req, env) => json(await claims.partnerRelease(env, await requireSponsorKey(req, env, 'online'), await readJson(req))));

/* Staff scanner */
route('GET', '/v1/staff/me', async (req, env) => {
  const s = await requireSponsorKey(req, env, 'staff');
  const pm = await env.DB.prepare('SELECT livemode, webhook_secret_enc IS NOT NULL AS webhook FROM sponsor_paymongo WHERE sponsor_id = ?').bind(s.sponsorId).first();
  const p = await env.DB.prepare('SELECT name FROM sponsors WHERE id = ?').bind(s.sponsorId).first();
  return json({ sponsorId: s.sponsorId, name: p?.name || s.sponsorId, paymongoConnected: !!pm, livemode: !!pm?.livemode, webhookReady: !!pm?.webhook });
}, { cors: true });
route('POST', '/v1/staff/lookup', async (req, env) => json(await claims.staffLookup(env, await requireSponsorKey(req, env, 'staff'), await readJson(req))), { cors: true });
route('POST', '/v1/staff/scan', async (req, env) => json(await claims.staffScan(env, await requireSponsorKey(req, env, 'staff'), await readJson(req), env.fetch || fetch)), { cors: true });
route('POST', '/v1/staff/cancel', async (req, env) => json(await claims.staffCancel(env, await requireSponsorKey(req, env, 'staff'), await readJson(req))), { cors: true });

/* PayMongo */
route('POST', '/v1/webhooks/paymongo/:sponsorId', async (req, env, p) => json(await claims.paymongoWebhook(env, decodeURIComponent(p.sponsorId), req)));
route('POST', '/v1/webhooks/shopify/:sponsorId', async (req, env, p) => json(await claims.shopifyWebhook(env, decodeURIComponent(p.sponsorId), req)));

/* Admin */
// CORS is on so partner.html can call these from an allowed origin; every call still needs the admin token.
const adminRoute = (method, pattern, fn) => route(method, pattern, async (req, env, p) => { requireAdmin(req, env); return json(await fn(req, env, p)); }, { cors: true });
const f = env => env.fetch || fetch;
adminRoute('GET', '/v1/admin/sponsors', (req, env) => partners.listPartners(env));
adminRoute('GET', '/v1/admin/sponsors/:sid', (req, env, p) => partners.partnerOverview(env, p.sid));
adminRoute('PUT', '/v1/admin/sponsors/:sid', async (req, env, p) => partners.putPartner(env, p.sid, await readJson(req)));
adminRoute('PUT', '/v1/admin/sponsors/:sid/shopify', async (req, env, p) => connectShopify(env, p.sid, await readJson(req), f(env)));
adminRoute('POST', '/v1/admin/sponsors/:sid/shopify/test', (req, env, p) => testShopify(env, p.sid, f(env)));
adminRoute('POST', '/v1/admin/sponsors/:sid/shopify/webhook', (req, env, p) => registerShopifyWebhook(env, p.sid, f(env)));
adminRoute('POST', '/v1/admin/sponsors/:sid/shopify/resync', (req, env, p) => partners.resyncShopify(env, p.sid));
adminRoute('GET', '/v1/admin/offers', (req, env) => admin.listOffers(env));
adminRoute('PUT', '/v1/admin/offers/:id', async (req, env, p) => admin.putOffer(env, p.id, await readJson(req)));
adminRoute('GET', '/v1/admin/sponsors/:sid/keys', (req, env, p) => admin.listKeys(env, p.sid));
adminRoute('POST', '/v1/admin/sponsors/:sid/keys', async (req, env, p) => admin.createKey(env, p.sid, await readJson(req)));
adminRoute('DELETE', '/v1/admin/sponsors/:sid/keys/:keyId', (req, env, p) => admin.revokeKey(env, p.sid, p.keyId));
adminRoute('PUT', '/v1/admin/sponsors/:sid/paymongo', async (req, env, p) => admin.putPaymongo(env, p.sid, await readJson(req)));
adminRoute('POST', '/v1/admin/sponsors/:sid/paymongo/webhook', (req, env, p) => admin.registerWebhook(env, p.sid, env.fetch || fetch));
adminRoute('GET', '/v1/admin/claims', (req, env) => {
  const q = new URL(req.url).searchParams;
  return admin.listClaims(env, { offerId: q.get('offerId'), state: q.get('state'), limit: q.get('limit') });
});

export async function handle(req, env) {
  const url = new URL(req.url);
  const matches = routes.map(r => ({ r, m: r.re.exec(url.pathname) })).filter(x => x.m);
  const cors = matches.some(x => x.r.cors) ? corsHeaders(req, env) : {};

  if (req.method === 'OPTIONS') return new Response(null, { status: matches.length ? 204 : 404, headers: cors });

  const hit = matches.find(x => x.r.method === req.method);
  let res;
  try {
    if (!hit) throw matches.length ? new HttpError(405, 'method_not_allowed', 'Method not allowed.') : new HttpError(404, 'not_found', 'No such endpoint.');
    res = await hit.r.handler(req, env, hit.m.groups || {});
  } catch (err) {
    if (err instanceof HttpError) res = errorResponse(err);
    else {
      console.error(err);
      res = json({ error: 'server_error', message: 'Something went wrong.' }, 500);
    }
  }
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export default { fetch: handle };
