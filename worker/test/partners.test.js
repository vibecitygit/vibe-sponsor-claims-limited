import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, call, claimFor, fakePaymongo, withFakeShopify, shopifySignature, signedWebhook, paidEvent } from './helpers.js';

const A = env => ({ token: env.ADMIN_TOKEN });

/** Know The Culture on Shopify: profile, a 10%-off offer, a staff key, PayMongo for the stall, Shopify for the web store. */
async function setupShopifyPartner(env, offer = {}) {
  await call(env, 'PUT', '/v1/admin/sponsors/know-the-culture', { ...A(env), body: { name: 'Know The Culture', shopType: 'shopify', shopUrl: 'https://knowtheculture.ph' } });
  await call(env, 'PUT', '/v1/admin/offers/KTC', { ...A(env), body: { sponsorId: 'know-the-culture', title: 'Know The Culture item', discountType: 'percent', discountValue: 10, validTo: '2026-12-19T23:59:59+08:00', ...offer } });
  const staff = (await call(env, 'POST', '/v1/admin/sponsors/know-the-culture/keys', { ...A(env), body: { scope: 'staff', label: 'Event stall' } })).body.key;
  await call(env, 'PUT', '/v1/admin/sponsors/know-the-culture/paymongo', { ...A(env), body: { secretKey: 'sk_test_abc123', webhookSecret: 'whsk_testsecret' } });
  const conn = await call(env, 'PUT', '/v1/admin/sponsors/know-the-culture/shopify', { ...A(env), body: { shopDomain: 'https://KTC-test.myshopify.com/', clientId: 'cid_1', clientSecret: 'shpss_secret' } });
  return { staff, conn };
}

const shopEnv = () => makeEnv({ fetch: withFakeShopify(fakePaymongo()) });

async function shopifyOrder(env, order, { secret = 'shpss_secret', id = 'wh-1' } = {}) {
  const raw = JSON.stringify(order);
  return call(env, 'POST', '/v1/webhooks/shopify/know-the-culture', {
    raw, headers: { 'Content-Type': 'application/json', 'X-Shopify-Hmac-SHA256': await shopifySignature(secret, raw), 'X-Shopify-Webhook-Id': id },
  });
}

test('connecting Shopify exchanges the app credentials and reads the shop name', async () => {
  const env = shopEnv();
  const { conn } = await setupShopifyPartner(env);
  assert.equal(conn.status, 200);
  assert.deepEqual(conn.body, { connected: true, shopName: 'Know The Culture' });
  assert.equal(env.fetch.shop.calls[0].grant, 'client_credentials');

  const o = (await call(env, 'GET', '/v1/admin/sponsors/know-the-culture', A(env))).body;
  assert.equal(o.shopify.connected, true);
  assert.equal(o.shopify.shopDomain, 'ktc-test.myshopify.com', 'domain is normalised');
  assert.equal(JSON.stringify(o).includes('shpss_secret'), false, 'the client secret is never sent back');

  const bad = await call(env, 'PUT', '/v1/admin/sponsors/know-the-culture/shopify', { ...A(env), body: { shopDomain: 'ktc-test.myshopify.com', clientId: 'cid_1', clientSecret: 'wrong' } });
  assert.equal(bad.status, 502);
  assert.equal(bad.body.error, 'shopify_auth_failed');
  const after = (await call(env, 'GET', '/v1/admin/sponsors/know-the-culture', A(env))).body;
  assert.equal(after.shopify.connected, false);
  assert.match(after.shopify.lastError, /refused/);

  const notShopify = await call(env, 'PUT', '/v1/admin/sponsors/know-the-culture/shopify', { ...A(env), body: { shopDomain: 'knowtheculture.ph', clientId: 'x', clientSecret: 'y' } });
  assert.equal(notShopify.status, 400);
});

test('a claim creates a single-use Shopify discount and gives the guest a link that applies it', async () => {
  const env = shopEnv();
  await setupShopifyPartner(env);
  const r = await claimFor(env, 'T-1');
  assert.equal(r.status, 201);
  const code = r.body.claim.code;
  assert.equal(r.body.online.url, `https://knowtheculture.ph/discount/${code}`);

  const d = env.fetch.shop.discounts[0].input;
  assert.equal(d.code, code);
  assert.equal(d.usageLimit, 1);
  assert.equal(d.appliesOncePerCustomer, true);
  assert.deepEqual(d.context, { all: 'ALL' });
  assert.deepEqual(d.customerGets, { value: { percentage: 0.1 }, items: { all: true } });
  assert.equal(d.endsAt, '2026-12-19T15:59:59.000Z');
  assert.ok(env.fetch.shop.calls.find(c => c.kind === 'gql').url.includes('/admin/api/2026-10/graphql.json'));

  const again = await claimFor(env, 'T-1');
  assert.equal(again.body.online.url, r.body.online.url);
  assert.equal(env.fetch.shop.discounts.length, 1, 'asking again does not create a second discount');
});

test('the Admin API token is reused until it is close to expiry', async () => {
  const env = shopEnv();
  await setupShopifyPartner(env);
  await claimFor(env, 'T-1');
  await claimFor(env, 'T-2');
  assert.equal(env.fetch.shop.tokensIssued, 1);
  env.advance(24 * 60);
  await claimFor(env, 'T-3');
  assert.equal(env.fetch.shop.tokensIssued, 2);
});

test('offers can be limited to Shopify collections', async () => {
  const env = shopEnv();
  await setupShopifyPartner(env, { discountType: 'amount', discountValue: 10000, shopifyCollectionIds: ['gid://shopify/Collection/42'] });
  await claimFor(env, 'T-1');
  assert.deepEqual(env.fetch.shop.discounts[0].input.customerGets, {
    value: { discountAmount: { amount: '100.00', appliesOnEachItem: false } },
    items: { collections: { add: ['gid://shopify/Collection/42'] } },
  });
  const bad = await call(env, 'PUT', '/v1/admin/offers/KTC', { ...A(env), body: { sponsorId: 'know-the-culture', title: 'x', discountType: 'percent', discountValue: 10, shopifyCollectionIds: ['42'] } });
  assert.equal(bad.status, 400);
});

test('a Shopify error never blocks the claim, and resync fixes it later', async () => {
  const env = shopEnv();
  await setupShopifyPartner(env);
  env.fetch.shop.failDiscounts = 'Code must be unique.';
  const r = await claimFor(env, 'T-1');
  assert.equal(r.status, 201, 'the guest still gets a code for the counter');
  assert.equal(r.body.online, null);
  let o = (await call(env, 'GET', '/v1/admin/sponsors/know-the-culture', A(env))).body;
  assert.equal(o.claimsNeedingShopifySync, 1);
  assert.match(o.recentClaims[0].shopify_sync, /^error: Code must be unique/);

  env.fetch.shop.failDiscounts = null;
  const re = await call(env, 'POST', '/v1/admin/sponsors/know-the-culture/shopify/resync', A(env));
  assert.deepEqual(re.body, { tried: 1, synced: 1, failed: 0 });
  o = (await call(env, 'GET', '/v1/admin/sponsors/know-the-culture', A(env))).body;
  assert.equal(o.claimsNeedingShopifySync, 0);
});

test('Shopify orders/paid marks the claim used; bad signatures and repeats are handled', async () => {
  const env = shopEnv();
  await setupShopifyPartner(env);
  const hook = await call(env, 'POST', '/v1/admin/sponsors/know-the-culture/shopify/webhook', A(env));
  assert.equal(hook.body.uri, 'https://claims.example/v1/webhooks/shopify/know-the-culture');
  assert.equal(env.fetch.shop.webhooks[0].topic, 'ORDERS_PAID');

  const { code } = (await claimFor(env, 'T-1')).body.claim;
  const order = { id: 5551, total_price: '900.00', discount_codes: [{ code: code.toLowerCase(), amount: '100.00', type: 'percentage' }, { code: 'WELCOME5' }] };

  assert.equal((await shopifyOrder(env, order, { secret: 'wrong' })).status, 401);

  const ok = await shopifyOrder(env, order);
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.outcomes, [{ code, outcome: 'redeemed' }], 'the shop\'s own codes are ignored');
  assert.equal((await call(env, 'GET', `/v1/claims/${code}`)).body.state, 'redeemed');

  const repeat = await shopifyOrder(env, order);
  assert.equal(repeat.body.repeated, true);

  const staffKey = (await call(env, 'POST', '/v1/admin/sponsors/know-the-culture/keys', { ...A(env), body: { scope: 'staff' } })).body.key;
  const scan = await call(env, 'POST', '/v1/staff/scan', { token: staffKey, body: { code, itemAmount: 100000 } });
  assert.equal(scan.body.error, 'already_redeemed', 'a code used online is refused at the counter');

  const claims = (await call(env, 'GET', '/v1/admin/claims?offerId=KTC', A(env))).body.claims;
  assert.deepEqual([claims[0].channel, claims[0].order_ref, claims[0].amount_paid], ['online', 'shopify:5551', 90000]);
});

test('discount_applications codes are read too', async () => {
  const env = shopEnv();
  await setupShopifyPartner(env);
  const { code } = (await claimFor(env, 'T-1')).body.claim;
  const r = await shopifyOrder(env, { id: 9, total_price: '1.00', discount_applications: [{ type: 'discount_code', code }] }, { id: 'wh-9' });
  assert.equal(r.body.outcomes[0].outcome, 'redeemed');
});

test('using the code at the counter switches its Shopify discount off', async () => {
  const env = shopEnv();
  const { staff } = await setupShopifyPartner(env);
  const { code } = (await claimFor(env, 'T-1')).body.claim;
  const s = await call(env, 'POST', '/v1/staff/scan', { token: staff, body: { code, itemAmount: 150000 } });
  const md = env.fetch.calls.find(c => c.url.endsWith('/checkout_sessions')).body.data.attributes.metadata;
  await signedWebhook(env, 'know-the-culture', paidEvent(s.body.checkoutSessionId, md, 135000));
  assert.deepEqual(env.fetch.shop.deactivated, [env.fetch.shop.discounts[0].id]);
  const o = (await call(env, 'GET', '/v1/admin/sponsors/know-the-culture', A(env))).body;
  assert.equal(o.recentClaims[0].shopify_sync, 'ended');
});

test('a partner page only shows and changes that partner\'s own scanner accounts', async () => {
  const env = shopEnv();
  await setupShopifyPartner(env);
  await call(env, 'PUT', '/v1/admin/sponsors/dawata', { ...A(env), body: { name: 'Dawata Wellness', shopType: 'none' } });
  const dawataKey = (await call(env, 'POST', '/v1/admin/sponsors/dawata/keys', { ...A(env), body: { scope: 'staff', label: 'Cafe till' } })).body;

  const ktc = (await call(env, 'GET', '/v1/admin/sponsors/know-the-culture', A(env))).body;
  assert.deepEqual(ktc.scannerAccounts.map(k => k.label), ['Event stall']);
  assert.ok(!JSON.stringify(ktc).includes(dawataKey.keyId));

  const cross = await call(env, 'DELETE', `/v1/admin/sponsors/know-the-culture/keys/${dawataKey.keyId}`, A(env));
  assert.equal(cross.status, 404, 'a key cannot be revoked through another partner\'s page');
  const own = await call(env, 'DELETE', `/v1/admin/sponsors/dawata/keys/${dawataKey.keyId}`, A(env));
  assert.equal(own.body.revoked, true);

  const me = await call(env, 'GET', '/v1/staff/me', { token: (await call(env, 'POST', '/v1/admin/sponsors/know-the-culture/keys', { ...A(env), body: { scope: 'staff' } })).body.key });
  assert.equal(me.body.name, 'Know The Culture');

  const list = (await call(env, 'GET', '/v1/admin/sponsors', A(env))).body.partners;
  assert.deepEqual(list.map(p => p.id), ['dawata', 'know-the-culture']);
});

test('partners without a Shopify shop get no Shopify calls', async () => {
  const env = shopEnv();
  await call(env, 'PUT', '/v1/admin/sponsors/casa-verde', { ...A(env), body: { name: 'Casa Verde', shopType: 'none' } });
  await call(env, 'PUT', '/v1/admin/offers/CVR', { ...A(env), body: { sponsorId: 'casa-verde', title: 'Dessert', discountType: 'free' } });
  const r = await claimFor(env, 'T-1', 'CVR');
  assert.equal(r.body.online, null);
  assert.equal(env.fetch.shop.calls.length, 0);
});

test('admin routes answer CORS for allowed origins so the settings page can call them', async () => {
  const env = shopEnv();
  const pre = await call(env, 'OPTIONS', '/v1/admin/sponsors/know-the-culture', { headers: { Origin: 'https://tickets.example' } });
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), 'https://tickets.example');
  assert.match(pre.headers.get('Access-Control-Allow-Methods'), /PUT/);
  assert.equal((await call(env, 'GET', '/v1/admin/sponsors')).status, 401, 'still needs the admin token');
});
