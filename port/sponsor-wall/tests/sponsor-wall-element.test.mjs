import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const harness = pathToFileURL(fileURLToPath(new URL('../test/harness.html', import.meta.url))).href;
let browser, page;
before(async () => { browser = await chromium.launch(); page = await browser.newPage(); await page.goto(harness); });
after(async () => { await browser?.close(); });

const items = [
  { id: 'a', brand: 'Partner One', tier: 'tier1', cols: 2, rows: 2, featured: true, order: 0, offerId: 'off-a' },
  { id: 'b', brand: '<img src=x onerror="window.__xss=1">Evil', tier: 'tier3', cols: 1, rows: 1, featured: false, order: 1 },
];
const set = (settings, list = items) => page.evaluate(([s, l]) => { const w = document.getElementById('wall'); w.data = { event_id: 'ev', settings: s, items: l }; return new Promise(r => setTimeout(r, 50)); }, [settings, list]);
const shadow = () => page.evaluate(() => { const r = document.getElementById('wall').shadowRoot; return { cards: [...r.querySelectorAll('.card')].map(b => b.textContent), children: r.childElementCount, err: document.getElementById('wall').getAttribute('data-wall-error') }; });

test('the renderer is mounted inside the shadow root with the deck in the prototype shape', async () => {
  await set({ format: 'cascade', cards: 'white' });
  const m = await page.evaluate(() => window.__mounts.at(-1));
  assert.equal(m.inShadow, true);
  assert.deepEqual(m.tiers, ['t1', 't3'], 'prototype tier keys');
  assert.deepEqual([m.layout, m.cards], ['cascade', 'white']);
  assert.deepEqual(m.remaining, [undefined, undefined], 'no stock data, so nothing is sold out');
  assert.deepEqual((await shadow()).cards, ['Partner One', '<img src=x onerror="window.__xss=1">Evil']);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
});

test('re-rendering destroys the previous renderer first', async () => {
  const before = await page.evaluate(() => window.__destroyed);
  await set({ format: 'cascade' });
  assert.equal(await page.evaluate(() => window.__destroyed), before + 1);
});

test('Claim dispatches wall-claim with the coupon and offer ids, out of the shadow root', async () => {
  await set({ format: 'cascade' });
  const detail = await page.evaluate(() => new Promise(res => {
    document.addEventListener('wall-claim', e => res(e.detail), { once: true });
    document.getElementById('wall').shadowRoot.querySelector('.card').click();
  }));
  assert.deepEqual(detail, { couponId: 'a', offerId: 'off-a' });
});

test('legacy draws nothing', async () => {
  await set({ format: 'legacy' });
  assert.equal((await shadow()).children, 0);
  assert.equal(await page.evaluate(() => document.getElementById('wall').getAttribute('data-format')), 'legacy');
});

test('bad settings fall back to legacy', async () => {
  await set({ format: 'ledger' });
  assert.equal(await page.evaluate(() => document.getElementById('wall').format), 'legacy');
  assert.equal((await shadow()).children, 0);
});

test('a format without a loaded renderer is reported, not drawn half-way', async () => {
  await set({ format: 'vouchers' });
  const s = await shadow();
  assert.equal(s.children, 0);
  assert.match(s.err, /missing renderer: vouchers/);
});
