// Local demo: the claims API (SQLite in memory) plus the static pages, on one port.
// PayMongo is faked unless PAYMONGO_TEST_SECRET_KEY=sk_test_… is set, in which case real test-mode
// checkouts are created on that account (webhooks can't reach localhost; use /dev/pay to simulate).
//
//   node --no-warnings=ExperimentalWarning worker/dev/local-server.mjs
//   open http://localhost:8788/partner.html  (settings, one page per partner)
//   open http://localhost:8788/scanner.html  (staff scanner)
// Shopify is faked too: a store at ktc-test.myshopify.com with client ID cid_1 and secret shpss_secret.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../src/index.js';
import { makeDb, fakePaymongo, withFakeShopify, signedWebhook, paidEvent } from '../test/helpers.js';

const PORT = Number(process.env.PORT || 8788);
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ORIGIN = `http://localhost:${PORT}`;
const fake = withFakeShopify(fakePaymongo());
const realKey = process.env.PAYMONGO_TEST_SECRET_KEY;

const env = {
  DB: makeDb(),
  ADMIN_TOKEN: 'dev-admin-token',
  DATA_KEY: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),
  ALLOW_UNVERIFIED_TICKETS: 'true',
  ALLOWED_ORIGINS: ORIGIN,
  PUBLIC_BASE_URL: 'https://claims.example',
  fetch: realKey ? fetch : fake,
};

const req = (method, path, body, token = env.ADMIN_TOKEN) => handle(new Request(ORIGIN + path, {
  method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
}), env).then(r => r.json());

// Seed: partners, the KTC and Casa Verde offers from the prototype, keys, and a PayMongo account.
await req('PUT', '/v1/admin/sponsors/know-the-culture', { name: 'Know The Culture', shopType: 'shopify', shopUrl: 'https://knowtheculture.ph', contact: 'Store owner' });
await req('PUT', '/v1/admin/sponsors/casa-verde', { name: 'Casa Verde Ramos', shopType: 'none' });
await req('PUT', '/v1/admin/sponsors/dawata', { name: 'Dawata Wellness Resort and Cafe', shopType: 'own_server', shopUrl: 'https://www.dawatawellness.com' });
await req('PUT', '/v1/admin/offers/KTC', { sponsorId: 'know-the-culture', title: 'Know The Culture item', discountType: 'percent', discountValue: 10, channels: ['in_store', 'online'] });
await req('PUT', '/v1/admin/offers/CVR', { sponsorId: 'casa-verde', title: 'Free dessert with a main', discountType: 'free', channels: ['in_store'] });
const staff = (await req('POST', '/v1/admin/sponsors/know-the-culture/keys', { scope: 'staff', label: 'Event stall phone' })).key;
await req('POST', '/v1/admin/sponsors/casa-verde/keys', { scope: 'staff', label: 'Front counter' });
const online = (await req('POST', '/v1/admin/sponsors/know-the-culture/keys', { scope: 'online', label: 'dev' })).key;
await req('PUT', '/v1/admin/sponsors/know-the-culture/paymongo', { secretKey: realKey || 'sk_test_devfake', webhookSecret: 'whsk_testsecret' });
const codes = [];
for (const t of ['T-1001', 'T-1002', 'T-1003']) codes.push((await req('POST', '/v1/claims', { offerId: 'KTC', ticketId: t })).claim.code);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };

createServer(async (inc, out) => {
  const url = new URL(inc.url, ORIGIN);
  const chunks = []; for await (const c of inc) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  // Simulate PayMongo's "paid" webhook for the latest checkout: GET /dev/pay
  if (url.pathname === '/dev/pay') {
    const last = [...fake.calls].reverse().find(c => c.url.endsWith('/checkout_sessions'));
    if (!last) { out.writeHead(404).end('no checkout yet'); return; }
    const amount = last.body.data.attributes.line_items.reduce((s, i) => s + i.amount * i.quantity, 0);
    const r = await signedWebhook(env, 'know-the-culture', paidEvent(`cs_test${fake.calls.indexOf(last) + 1}`, last.body.data.attributes.metadata, amount));
    out.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(r.body));
    return;
  }

  if (url.pathname.startsWith('/v1/')) {
    const res = await handle(new Request(url, { method: inc.method, headers: inc.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(inc.method) ? undefined : body }), env);
    out.writeHead(res.status, Object.fromEntries(res.headers)).end(Buffer.from(await res.arrayBuffer()));
    return;
  }

  const path = normalize(join(ROOT, decodeURIComponent(url.pathname === '/' ? '/scanner.html' : url.pathname)));
  if (!path.startsWith(ROOT) || path.includes('/worker/') || path.includes('/.git/')) { out.writeHead(404).end(); return; }
  try { out.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' }).end(await readFile(path)); }
  catch { out.writeHead(404).end('not found'); }
}).listen(PORT, () => {
  console.log(`Claims demo  (PayMongo: ${realKey ? 'real test mode' : 'faked'}, Shopify: faked)`);
  console.log(`  settings:       ${ORIGIN}/partner.html#partner=know-the-culture`);
  console.log(`  scanner:        ${ORIGIN}/scanner.html`);
  console.log(`  server address: ${ORIGIN}`);
  console.log(`  staff key:      ${staff}`);
  console.log(`  online key:     ${online}`);
  console.log(`  admin token:    ${env.ADMIN_TOKEN}`);
  console.log(`  KTC codes:      ${codes.join('  ')}`);
  console.log(`  mark paid:      ${ORIGIN}/dev/pay`);
});
