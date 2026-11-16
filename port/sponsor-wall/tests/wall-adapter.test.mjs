import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { console, Intl, Date, Math, JSON, Object, Array, String, Number, RegExp, Promise };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['../assets/sponsor-wall/deck-core.js', '../assets/sponsor-wall/wall-adapter.js']) vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx, { filename: f });
const A = ctx.VCWallAdapter, D = ctx.DeckCore;
const plain = v => JSON.parse(JSON.stringify(v));

const live = {
  id: 'biz-1', brand: 'Casa Verde Ramos — Garden Restaurant and Events Venue', role: 'Partner', tier: 'tier1', cols: 2, rows: 3, featured: true, order: 0,
  logo: 'https://cdn.example/cv.png', site: 'https://casaverde.example', offerId: 'off-1', type: 'freebie',
  short: 'A free dessert with any main course, every night after the show until the end of the year.', long: 'x'.repeat(600),
  terms: ['Dine-in only.', 'One per ticket.'], where: '69 Lim Tian Teng St., Cebu City', limit: '1 per person',
  startsAt: '2026-11-19T00:00:00+08:00', expiresAt: '2026-12-19T23:59:00+08:00', timezone: 'Asia/Manila',
  photos: [{ src: 'https://cdn.example/1.jpg', alt: 'a' }, { src: 'javascript:alert(1)' }, { src: '//evil.example/x.jpg' }, { src: '/media/2.jpg' }],
};

test('live sponsors become prototype coupons with the prototype tier keys and size', () => {
  const c = A.itemToCoupon(live);
  assert.deepEqual([c.tier, c.cols, c.rows, c.featured], ['t1', 2, 3, true]);
  assert.ok(D.TIERS[c.tier], 'tier key exists in the prototype');
});

test('live text is kept whole, not trimmed to the editor limits', () => {
  const c = A.itemToCoupon(live);
  assert.equal(c.brand, live.brand);
  assert.equal(c.short, live.short);
  assert.equal(c.long.length, 600);
});

test('live photos are kept as https or same-origin links; anything else is dropped', () => {
  assert.deepEqual(plain(A.itemToCoupon(live).photos), ['https://cdn.example/1.jpg', '/media/2.jpg']);
});

test('no stock data: remaining and total stay undefined, so nothing is shown as sold out', () => {
  const c = A.itemToCoupon(live);
  assert.equal(c.remaining, undefined);
  assert.equal(c.total, undefined);
});

test('dates are MM/DD in the offer time zone; no end date leaves "to" empty', () => {
  const c = A.itemToCoupon(live);
  assert.deepEqual([c.from, c.to, c.year], ['11/19', '12/19', '2026']);
  const none = A.itemToCoupon({ ...live, startsAt: null, expiresAt: null });
  assert.deepEqual([none.from, none.to, none.year], ['', '', '']);
});

test('offer types map to the prototype labels', () => {
  assert.equal(A.itemToCoupon({ ...live, type: 'discount' }).type, 'Discount');
  assert.equal(A.itemToCoupon({ ...live, type: 'option' }).type, 'Option');
  assert.equal(A.itemToCoupon({ ...live, type: null }).type, 'Discount');
});

test('monogram, shape and colour are stable per sponsor', () => {
  const a = A.itemToCoupon(live), b = A.itemToCoupon(live);
  assert.deepEqual([a.mark, a.shape, a.color], [b.mark, b.shape, b.color]);
  assert.ok(D.SHAPES.includes(a.shape));
  assert.match(a.color, /^#[0-9a-f]{6}$/);
  assert.equal(A.initials('Know The Culture'), 'KTC');
  assert.equal(A.initials('DESAINZ'), 'DE');
});

test('wall settings map to the prototype wall settings', () => {
  const w = A.settingsToWall({ format: 'cascade', cards: 'white', openSlots: false, cutGap: 40, cutPad: 100 });
  assert.deepEqual([w.layout, w.cards, w.openSlots, w.cutGap, w.cutPad], ['cascade', 'white', false, 40, 100]);
  assert.equal(A.settingsToWall({ format: 'featured' }).layout, 'featured');
});

test('size is capped by tier and the paper style follows the shape, as the prototype sanitiser does', () => {
  const c = A.itemToCoupon({ ...live, tier: 'tier3', cols: 3, rows: 4 });
  assert.deepEqual([c.cols, c.rows, c.style], [1, 2, 'voucher']);
  assert.equal(A.itemToCoupon({ ...live, tier: 'tier1', cols: 2, rows: 3 }).style, 'magazine');
  assert.equal(A.itemToCoupon({ ...live, tier: 'tier1', cols: 3, rows: 1 }).style, 'ticket');
  assert.equal(A.itemToCoupon({ ...live, tier: 'tier2', cols: 1, rows: 1 }).style, 'stub');
  for (const it of [{ tier: 'tier1', cols: 2, rows: 2 }, { tier: 'tier3', cols: 1, rows: 1 }]) {
    const x = A.itemToCoupon({ ...live, ...it });
    assert.equal(x.style, D.styleFor(x.cols, x.rows));
  }
});

test('every coupon field the renderers read is set by the adapter', () => {
  const c = A.itemToCoupon(live);
  for (const k of ['id', 'brand', 'role', 'featured', 'tier', 'cols', 'rows', 'style', 'limited', 'site', 'logoSrc', 'photos', 'mark', 'shape', 'color', 'type', 'short', 'long', 'from', 'to', 'year', 'where', 'limit', 'terms', 'offerId', 'noOffer']) assert.ok(k in c, k);
});

test('a sponsor without a published offer is never featured, whatever the portal flag says', () => {
  assert.equal(A.itemToCoupon({ ...live, featured: true, offerId: 'off-1' }).featured, true);
  assert.equal(A.itemToCoupon({ ...live, featured: true, offerId: null }).featured, false);
});
