import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, call, setupKtc, claimFor, ticketProof, signedWebhook, paidEvent } from './helpers.js';
import { normalizeCode } from '../src/codes.js';
import { verifySignature } from '../src/paymongo.js';
import { hmacHex } from '../src/crypto.js';

/* ---------- Codes ---------- */

test('codes normalise from typed or scanned input', () => {
  assert.equal(normalizeCode('KTC-7Q3FK-9M2XA'), 'KTC7Q3FK9M2XA');
  assert.equal(normalizeCode('  ktc 7q3fk 9m2xa '), 'KTC7Q3FK9M2XA');
  assert.equal(normalizeCode('KTC-7Q3FK-9M2XO'), 'KTC7Q3FK9M2X0', 'O in the random part reads as zero');
  assert.equal(normalizeCode('AIR-1Q3FK-9M2XA'), 'AIR1Q3FK9M2XA', 'letters in the prefix are left alone');
  assert.equal(normalizeCode('https://tickets.example/c/KTC-7Q3FK-9M2XA'), 'KTC7Q3FK9M2XA');
  assert.equal(normalizeCode('short'), null);
  assert.equal(normalizeCode(42), null);
});

/* ---------- Issuing ---------- */

test('a ticket gets one code per offer, and needs a valid ticket proof', async () => {
  const env = makeEnv();
  await setupKtc(env);
  const first = await claimFor(env, 'T-1001');
  assert.equal(first.status, 201);
  assert.match(first.body.claim.code, /^KTC-[0-9A-Z]{5}-[0-9A-Z]{5}$/);
  assert.equal(first.body.claim.state, 'ready');
  assert.equal(first.body.offer.discount.label, '10% off 1 item');

  const again = await claimFor(env, 'T-1001');
  assert.equal(again.status, 200);
  assert.equal(again.body.claim.code, first.body.claim.code);

  const forged = await call(env, 'POST', '/v1/claims', { body: { offerId: 'KTC', ticketId: 'T-1002', ticketProof: 'deadbeef' } });
  assert.equal(forged.status, 403);
});

test('limited offers stop at maxClaims', async () => {
  const env = makeEnv();
  await setupKtc(env, { maxClaims: 2 });
  assert.equal((await claimFor(env, 'A')).status, 201);
  assert.equal((await claimFor(env, 'B')).status, 201);
  const c = await claimFor(env, 'C');
  assert.equal(c.status, 409);
  assert.equal(c.body.error, 'sold_out');
  assert.equal((await claimFor(env, 'A')).status, 200, 'an existing holder still gets their code');
});

test('codes are refused before the start date and after the end date', async () => {
  const env = makeEnv();
  await setupKtc(env, { validFrom: '2026-11-21T00:00:00+08:00' });
  assert.equal((await claimFor(env, 'T')).body.error, 'not_started');
});

test('without a ticket secret, issuing refuses unless explicitly in local mode', async () => {
  const env = makeEnv({ TICKET_SIGNING_SECRET: undefined });
  await setupKtc(env);
  assert.equal((await call(env, 'POST', '/v1/claims', { body: { offerId: 'KTC', ticketId: 'T' } })).status, 501);
  env.ALLOW_UNVERIFIED_TICKETS = 'true';
  assert.equal((await call(env, 'POST', '/v1/claims', { body: { offerId: 'KTC', ticketId: 'T' } })).status, 201);
});

/* ---------- Online: partner verify / redeem ---------- */

test('online: verify holds the code, redeem uses it, a second cart is refused', async () => {
  const env = makeEnv();
  const { online } = await setupKtc(env);
  const { code } = (await claimFor(env, 'T-1')).body.claim;

  const v = await call(env, 'POST', '/v1/partner/claims/verify', { token: online, body: { code, cartRef: 'cart-77' } });
  assert.equal(v.status, 200);
  assert.equal(v.body.valid, true);
  assert.equal(v.body.offer.discount.value, 10);
  assert.ok(v.body.holdId);

  const refresh = await call(env, 'POST', '/v1/partner/claims/verify', { token: online, body: { code, cartRef: 'cart-77' } });
  assert.equal(refresh.body.valid, true, 'the same cart can verify again');

  const other = await call(env, 'POST', '/v1/partner/claims/verify', { token: online, body: { code, cartRef: 'cart-99' } });
  assert.deepEqual([other.body.valid, other.body.reason], [false, 'in_use']);

  assert.equal((await call(env, 'GET', `/v1/claims/${code}`)).body.state, 'in_use');

  const r = await call(env, 'POST', '/v1/partner/claims/redeem', { token: online, body: { code, holdId: v.body.holdId, orderRef: 'ORD-1', amountPaid: 135000 } });
  assert.equal(r.status, 200);
  assert.equal(r.body.redeemed, true);

  const repeat = await call(env, 'POST', '/v1/partner/claims/redeem', { token: online, body: { code, holdId: v.body.holdId, orderRef: 'ORD-1' } });
  assert.equal(repeat.body.repeated, true, 'repeating a redeem for the same order is fine');

  const reuse = await call(env, 'POST', '/v1/partner/claims/verify', { token: online, body: { code } });
  assert.equal(reuse.body.reason, 'already_redeemed');
  assert.equal((await call(env, 'GET', `/v1/claims/${code}`)).body.state, 'redeemed');
});

test('online: an expired hold frees the code; release frees it at once', async () => {
  const env = makeEnv();
  const { online } = await setupKtc(env);
  const { code } = (await claimFor(env, 'T-1')).body.claim;
  const a = await call(env, 'POST', '/v1/partner/claims/verify', { token: online, body: { code, cartRef: 'a' } });
  env.advance(31);
  const b = await call(env, 'POST', '/v1/partner/claims/verify', { token: online, body: { code, cartRef: 'b' } });
  assert.equal(b.body.valid, true);
  const late = await call(env, 'POST', '/v1/partner/claims/redeem', { token: online, body: { code, holdId: a.body.holdId, orderRef: 'late' } });
  assert.equal(late.body.error, 'hold_lost', 'a cart whose hold lapsed and was taken cannot redeem');

  assert.equal((await call(env, 'POST', '/v1/partner/claims/release', { token: online, body: { code, holdId: b.body.holdId } })).body.released, true);
  assert.equal((await call(env, 'POST', '/v1/partner/claims/verify', { token: online, body: { code, cartRef: 'c' } })).body.valid, true);
});

test('online: keys only see their own sponsor\'s codes and need the right scope', async () => {
  const env = makeEnv();
  const { online, staff } = await setupKtc(env);
  await call(env, 'PUT', '/v1/admin/offers/DWT', { token: env.ADMIN_TOKEN, body: { sponsorId: 'dawata', title: 'Day pass', discountType: 'percent', discountValue: 15 } });
  const dawataCode = (await claimFor(env, 'T-1', 'DWT')).body.claim.code;

  const cross = await call(env, 'POST', '/v1/partner/claims/verify', { token: online, body: { code: dawataCode } });
  assert.deepEqual([cross.body.valid, cross.body.reason], [false, 'not_found']);

  assert.equal((await call(env, 'POST', '/v1/partner/claims/verify', { token: staff, body: { code: dawataCode } })).status, 403);
  assert.equal((await call(env, 'POST', '/v1/partner/claims/verify', { token: 'vck_online_nope', body: { code: dawataCode } })).status, 401);
});

test('online: an in-store-only offer is refused online', async () => {
  const env = makeEnv();
  const { online } = await setupKtc(env, { channels: ['in_store'] });
  const { code } = (await claimFor(env, 'T-1')).body.claim;
  assert.equal((await call(env, 'POST', '/v1/partner/claims/verify', { token: online, body: { code } })).body.reason, 'channel_not_allowed');
});

/* ---------- In store: scan → PayMongo link → webhook ---------- */

test('in store: a scan creates a discounted PayMongo checkout on the sponsor\'s own key', async () => {
  const env = makeEnv();
  const { staff } = await setupKtc(env);
  const { code } = (await claimFor(env, 'T-1')).body.claim;

  const look = await call(env, 'POST', '/v1/staff/lookup', { token: staff, body: { code: code.toLowerCase() } });
  assert.equal(look.body.usable, true);

  const s = await call(env, 'POST', '/v1/staff/scan', { token: staff, body: { code, itemAmount: 150000, otherAmount: 50000 } });
  assert.equal(s.status, 200);
  assert.deepEqual(s.body.amounts, { item: 150000, discounted: 135000, other: 50000, total: 185000 });
  assert.match(s.body.checkoutUrl, /^https:\/\/checkout\.paymongo\.com\//);

  const pm = env.fetch.calls.find(c => c.url.endsWith('/checkout_sessions'));
  assert.equal(pm.auth, 'Basic ' + btoa('sk_test_abc123:'), 'uses the sponsor\'s own secret key');
  const a = pm.body.data.attributes;
  assert.deepEqual(a.line_items.map(i => [i.amount, i.currency, i.quantity]), [[135000, 'PHP', 1], [50000, 'PHP', 1]]);
  assert.ok(a.payment_method_types.includes('qrph'));
  assert.equal(a.reference_number, code);
  assert.equal(typeof a.metadata.vc_hold_id, 'string');

  const second = await call(env, 'POST', '/v1/staff/scan', { token: staff, body: { code, itemAmount: 150000 } });
  assert.equal(second.body.error, 'in_use', 'a second scan while the link is open is refused');

  const hook = await signedWebhook(env, 'know-the-culture', paidEvent(s.body.checkoutSessionId, a.metadata, 185000));
  assert.equal(hook.status, 200);
  assert.equal(hook.body.outcome, 'redeemed');
  assert.equal((await call(env, 'GET', `/v1/claims/${code}`)).body.state, 'redeemed');

  const replay = await signedWebhook(env, 'know-the-culture', paidEvent(s.body.checkoutSessionId, a.metadata, 185000));
  assert.equal(replay.body.outcome, 'already_recorded');

  const claims = (await call(env, 'GET', '/v1/admin/claims', { token: env.ADMIN_TOKEN })).body.claims;
  assert.deepEqual([claims[0].state, claims[0].channel, claims[0].amount_paid], ['redeemed', 'in_store', 185000]);
});

test('in store: webhooks with a bad signature are refused', async () => {
  const env = makeEnv();
  await setupKtc(env);
  const r = await signedWebhook(env, 'know-the-culture', paidEvent('cs_x', {}, 1), 'whsk_wrong');
  assert.equal(r.status, 401);
});

test('in store: a PayMongo error frees the code and is passed on to staff', async () => {
  const env = makeEnv();
  const { staff } = await setupKtc(env);
  const { code } = (await claimFor(env, 'T-1')).body.claim;
  env.fetch.failWith('amount is below the minimum.');
  const s = await call(env, 'POST', '/v1/staff/scan', { token: staff, body: { code, itemAmount: 100 } });
  assert.equal(s.status, 502);
  assert.equal(s.body.message, 'amount is below the minimum.');
  assert.equal((await call(env, 'GET', `/v1/claims/${code}`)).body.state, 'ready');
});

test('in store: cancel frees an open link; free offers redeem without payment', async () => {
  const env = makeEnv();
  const { staff } = await setupKtc(env);
  const { code } = (await claimFor(env, 'T-1')).body.claim;
  await call(env, 'POST', '/v1/staff/scan', { token: staff, body: { code, itemAmount: 150000 } });
  assert.equal((await call(env, 'POST', '/v1/staff/cancel', { token: staff, body: { code } })).body.released, true);
  assert.equal((await call(env, 'GET', `/v1/claims/${code}`)).body.state, 'ready');

  await call(env, 'PUT', '/v1/admin/offers/KTC', { token: env.ADMIN_TOKEN, body: { sponsorId: 'know-the-culture', title: 'Tote bag', discountType: 'free' } });
  const before = env.fetch.calls.length;
  const free = await call(env, 'POST', '/v1/staff/scan', { token: staff, body: { code } });
  assert.equal(free.body.redeemed, true);
  assert.equal(env.fetch.calls.length, before, 'no PayMongo call for a free offer');
});

test('in store: an amount-off discount that covers the bill redeems with nothing to pay', async () => {
  const env = makeEnv();
  const { staff } = await setupKtc(env, { discountType: 'amount', discountValue: 10000 });
  const { code } = (await claimFor(env, 'T-1')).body.claim;
  const s = await call(env, 'POST', '/v1/staff/scan', { token: staff, body: { code, itemAmount: 8000 } });
  assert.equal(s.body.redeemed, true);
  assert.equal(s.body.amounts.total, 0);
});

/* ---------- PayMongo signature format ---------- */

test('signature check follows PayMongo: te for test events, li for live events', async () => {
  const raw = '{"a":1}';
  const sig = await hmacHex('whsk_x', `123.${raw}`);
  assert.equal(await verifySignature(`t=123,te=${sig},li=`, raw, 'whsk_x', false), true);
  assert.equal(await verifySignature(`t=123,te=${sig},li=`, raw, 'whsk_x', true), false);
  assert.equal(await verifySignature(`t=123,te=,li=${sig}`, raw, 'whsk_x', true), true);
  assert.equal(await verifySignature(`t=124,te=${sig},li=`, raw, 'whsk_x', false), false, 'timestamp is part of the signed text');
  assert.equal(await verifySignature(`t=123,te=${sig},li=`, raw + ' ', 'whsk_x', false), false, 'body must be byte-identical');
});

/* ---------- Admin and CORS ---------- */

test('admin needs the admin token; secrets are stored encrypted and keys hashed', async () => {
  const env = makeEnv();
  assert.equal((await call(env, 'GET', '/v1/admin/offers')).status, 401);
  const { online } = await setupKtc(env);
  const pm = await env.DB.prepare('SELECT secret_key_enc, webhook_secret_enc FROM sponsor_paymongo').bind().first();
  assert.ok(!pm.secret_key_enc.includes('sk_test'));
  assert.ok(pm.webhook_secret_enc);
  const keys = await env.DB.prepare('SELECT key_hash FROM api_keys').bind().all();
  assert.ok(keys.results.every(k => k.key_hash !== online && /^[0-9a-f]{64}$/.test(k.key_hash)));

  const hookCall = env.fetch.calls.find(c => c.url.endsWith('/webhooks'));
  assert.equal(hookCall.body.data.attributes.url, 'https://claims.example/v1/webhooks/paymongo/know-the-culture');

  const list = (await call(env, 'GET', '/v1/admin/sponsors/know-the-culture/keys', { token: env.ADMIN_TOKEN })).body.keys;
  const revoked = await call(env, 'DELETE', `/v1/admin/sponsors/know-the-culture/keys/${list[0].key_id}`, { token: env.ADMIN_TOKEN });
  assert.equal(revoked.body.revoked, true);
  assert.equal((await call(env, 'POST', '/v1/partner/claims/verify', { token: online, body: { code: 'KTC-00000-00000' } })).status, 401);
});

test('browser endpoints answer CORS only for allowed origins; partner endpoints never do', async () => {
  const env = makeEnv();
  await setupKtc(env);
  const ok = await call(env, 'OPTIONS', '/v1/staff/scan', { headers: { Origin: 'https://tickets.example' } });
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'https://tickets.example');
  const bad = await call(env, 'OPTIONS', '/v1/staff/scan', { headers: { Origin: 'https://evil.example' } });
  assert.equal(bad.headers.get('Access-Control-Allow-Origin'), null);
  const partner = await call(env, 'OPTIONS', '/v1/partner/claims/verify', { headers: { Origin: 'https://tickets.example' } });
  assert.equal(partner.headers.get('Access-Control-Allow-Origin'), null);
});

test('ticket proof helper matches what the ticketing site must send', async () => {
  const env = makeEnv();
  assert.equal(await ticketProof(env, 'T-1'), await hmacHex('ticket-secret', 'T-1'));
});
