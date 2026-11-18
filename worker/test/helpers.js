// Test helpers: an in-memory D1 stand-in on node:sqlite, a fake PayMongo, and a request helper.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { handle } from '../src/index.js';
import { hmacHex } from '../src/crypto.js';

const schema = ['0001_init.sql', '0002_partners_shopify.sql']
  .map(f => readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8')).join('\n');

class Stmt {
  constructor(db, sql, args = []) { this.db = db; this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.db, this.sql, args); }
  async first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.args) }; }
  async run() { const r = this.db.prepare(this.sql).run(...this.args); return { meta: { changes: Number(r.changes) } }; }
}

export function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  return { prepare: sql => new Stmt(db, sql) };
}

export function fakePaymongo() {
  const calls = [];
  let fail = null;
  const fn = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, auth: init.headers.Authorization, body });
    if (fail) return new Response(JSON.stringify({ errors: [{ detail: fail }] }), { status: 400 });
    if (url.endsWith('/checkout_sessions')) {
      const id = `cs_test${calls.length}`;
      return Response.json({ data: { id, type: 'checkout_session', attributes: { checkout_url: `https://checkout.paymongo.com/${id}`, ...body.data.attributes } } });
    }
    if (url.endsWith('/webhooks')) {
      return Response.json({ data: { id: 'hook_1', attributes: { secret_key: 'whsk_testsecret', livemode: false, url: body.data.attributes.url } } });
    }
    return new Response('{}', { status: 404 });
  };
  fn.calls = calls;
  fn.failWith = msg => { fail = msg; };
  return fn;
}

/** A fake Shopify store for one domain, layered over another fetch (e.g. fakePaymongo). */
export function withFakeShopify(inner, { domain = 'ktc-test.myshopify.com', clientId = 'cid_1', clientSecret = 'shpss_secret' } = {}) {
  const shop = { calls: [], discounts: [], deactivated: [], webhooks: [], tokensIssued: 0, failDiscounts: null };
  const fn = async (url, init = {}) => {
    if (!url.startsWith(`https://${domain}/`)) return inner(url, init);
    if (url.endsWith('/admin/oauth/access_token')) {
      const p = new URLSearchParams(init.body);
      shop.calls.push({ kind: 'token', grant: p.get('grant_type') });
      if (p.get('client_id') !== clientId || p.get('client_secret') !== clientSecret) return Response.json({ error: 'invalid_client' }, { status: 401 });
      shop.tokensIssued++;
      return Response.json({ access_token: `shpat_tok${shop.tokensIssued}`, scope: 'write_discounts,read_discounts,read_orders', expires_in: 86399 });
    }
    if (url.includes('/graphql.json')) {
      if (!/^shpat_tok\d+$/.test(init.headers['X-Shopify-Access-Token'] || '')) return Response.json({ errors: 'Invalid API key or access token' }, { status: 401 });
      const { query, variables } = JSON.parse(init.body);
      shop.calls.push({ kind: 'gql', query, variables, url });
      if (query.includes('shop {')) return Response.json({ data: { shop: { name: 'Know The Culture', myshopifyDomain: domain } } });
      if (query.includes('discountCodeBasicCreate')) {
        if (shop.failDiscounts) return Response.json({ data: { discountCodeBasicCreate: { codeDiscountNode: null, userErrors: [{ field: ['code'], message: shop.failDiscounts }] } } });
        const id = `gid://shopify/DiscountCodeNode/${1000 + shop.discounts.length}`;
        shop.discounts.push({ id, input: variables.basicCodeDiscount });
        return Response.json({ data: { discountCodeBasicCreate: { codeDiscountNode: { id }, userErrors: [] } } });
      }
      if (query.includes('discountCodeDeactivate')) {
        shop.deactivated.push(variables.id);
        return Response.json({ data: { discountCodeDeactivate: { codeDiscountNode: { id: variables.id }, userErrors: [] } } });
      }
      if (query.includes('webhookSubscriptionCreate')) {
        shop.webhooks.push(variables);
        return Response.json({ data: { webhookSubscriptionCreate: { webhookSubscription: { id: 'gid://shopify/WebhookSubscription/7' }, userErrors: [] } } });
      }
    }
    return new Response('{}', { status: 404 });
  };
  fn.calls = inner.calls;
  fn.failWith = inner.failWith;
  fn.shop = shop;
  return fn;
}

/** Signs a body the way Shopify does: base64 HMAC-SHA256 with the app's client secret. */
export async function shopifySignature(secret, raw) {
  const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Buffer.from(await webcrypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))).toString('base64');
}


export function makeEnv(overrides = {}) {
  const raw = webcrypto.getRandomValues(new Uint8Array(32));
  let t = new Date('2026-11-20T10:00:00Z');
  const env = {
    DB: makeDb(),
    ADMIN_TOKEN: 'admin-secret',
    DATA_KEY: Buffer.from(raw).toString('base64'),
    TICKET_SIGNING_SECRET: 'ticket-secret',
    ALLOWED_ORIGINS: 'https://tickets.example',
    PUBLIC_BASE_URL: 'https://claims.example',
    fetch: fakePaymongo(),
    now: () => t,
    advance: mins => { t = new Date(t.getTime() + mins * 60_000); },
    ...overrides,
  };
  return env;
}

export async function call(env, method, path, { body, token, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const res = await handle(new Request('https://claims.example' + path, {
    method, headers: h, body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  }), env);
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

export const ticketProof = (env, ticketId) => hmacHex(env.TICKET_SIGNING_SECRET, ticketId);

/** Sets up Know The Culture: a 10%-off offer, an online key, a staff key, and a connected PayMongo account. */
export async function setupKtc(env, offer = {}) {
  const A = { token: env.ADMIN_TOKEN };
  await call(env, 'PUT', '/v1/admin/offers/KTC', { ...A, body: { sponsorId: 'know-the-culture', title: 'Know The Culture item', discountType: 'percent', discountValue: 10, ...offer } });
  const online = (await call(env, 'POST', '/v1/admin/sponsors/know-the-culture/keys', { ...A, body: { scope: 'online', label: 'KTC web store' } })).body.key;
  const staff = (await call(env, 'POST', '/v1/admin/sponsors/know-the-culture/keys', { ...A, body: { scope: 'staff', label: 'Event stall' } })).body.key;
  await call(env, 'PUT', '/v1/admin/sponsors/know-the-culture/paymongo', { ...A, body: { secretKey: 'sk_test_abc123' } });
  await call(env, 'POST', '/v1/admin/sponsors/know-the-culture/paymongo/webhook', A);
  return { online, staff };
}

export async function claimFor(env, ticketId, offerId = 'KTC') {
  return call(env, 'POST', '/v1/claims', { body: { offerId, ticketId, ticketProof: await ticketProof(env, ticketId) } });
}

export async function signedWebhook(env, sponsorId, event, secret = 'whsk_testsecret') {
  const raw = JSON.stringify(event);
  const t = '1763632800';
  const sig = await hmacHex(secret, `${t}.${raw}`);
  const header = event.data.attributes.livemode ? `t=${t},te=,li=${sig}` : `t=${t},te=${sig},li=`;
  return call(env, 'POST', `/v1/webhooks/paymongo/${sponsorId}`, { raw, headers: { 'Paymongo-Signature': header, 'Content-Type': 'application/json' } });
}

export const paidEvent = (sessionId, metadata, amount) => ({
  data: {
    id: `evt_${sessionId}`, type: 'event',
    attributes: {
      type: 'checkout_session.payment.paid', livemode: false,
      data: { id: sessionId, type: 'checkout_session', attributes: { metadata, payments: [{ attributes: { status: 'paid', amount } }] } },
    },
  },
});
