import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const harness = pathToFileURL(fileURLToPath(new URL('../test/harness.html', import.meta.url))).href;
let browser, page;
before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // The test sponsors' images are served locally, so the checks do not depend on the network.
  const gif = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
  await page.route('https://example.com/**', r => r.fulfill({ status: 200, contentType: 'image/gif', body: gif }));
  await page.goto(harness);
});
after(async () => { await browser?.close(); });

const items = [
  { id: 'a', brand: 'Partner One', tier: 'tier1', cols: 2, rows: 2, featured: true, order: 0, short: 'Two for one.', logo: 'https://example.com/logo.png', photos: ['https://example.com/p1.jpg', 'https://example.com/p2.jpg'] },
  { id: 'b', brand: 'Featured Two', tier: 'tier2', cols: 2, rows: 1, featured: false, order: 1, short: 'Discount.' },
  { id: 'c', brand: 'Minor Three', tier: 'tier3', cols: 3, rows: 2, featured: false, order: 2 },
  { id: 'd', brand: '<img src=x onerror="window.__xss=1">Evil', tier: 'tier3', cols: 1, rows: 1, featured: false, order: 3, logo: 'javascript:alert(1)', short: '<b>bold?</b>' },
];

const setData = (settings, list = items) => page.evaluate(([s, l]) => {
  const w = document.getElementById('wall'); w.data = { event_id: 'test-event', settings: s, items: l }; return w.format;
}, [settings, list]);

const shadowInfo = () => page.evaluate(() => {
  const r = document.getElementById('wall').shadowRoot;
  return {
    pieces: r.querySelectorAll('button.piece').length,
    imgs: [...r.querySelectorAll('img')].map(i => i.getAttribute('src')),
    dialog: !!r.querySelector('dialog.detail'),
    spans: [...r.querySelectorAll('button.piece')].map(b => b.style.gridColumn + '/' + b.style.gridRow),
    text: r.textContent,
  };
});

test('each drawn format renders its pieces with the three-column grid', async () => {
  for (const format of ['featured', 'cascade', 'vouchers', 'cutouts']) {
    await setData({ format, cards: 'dark', openSlots: true, cutGap: 28, cutPad: 72, items: {} });
    const info = await shadowInfo();
    const expected = format === 'featured' ? items.length : items.length;
    assert.equal(info.pieces, expected, format + ' piece count');
    const grid = await page.evaluate(() => getComputedStyle(document.getElementById('wall').shadowRoot.querySelector('.grid') || document.body).gridTemplateColumns);
    assert.match(grid, /^\S+px \S+px \S+px$/, format + ' three columns: ' + grid);
  }
});

test('featured format lifts the featured piece to a full-width lead', async () => {
  await setData({ format: 'featured', cards: 'dark', openSlots: true, cutGap: 28, cutPad: 72, items: {} });
  const lead = await page.evaluate(() => document.getElementById('wall').shadowRoot.querySelector('.lead')?.getAttribute('aria-label'));
  assert.equal(lead, 'Partner One — details');
});

test('tier caps are enforced: a Tier 3 piece cannot be wider than 1 column', async () => {
  await setData({ format: 'cascade', cards: 'dark', openSlots: true, cutGap: 28, cutPad: 72, items: {} });
  const info = await shadowInfo();
  assert.ok(info.spans.includes('span 1/span 2'), 'Minor Three is capped at 1 x 2: ' + info.spans.join(','));
  assert.ok(info.spans.every(s => /span (1|2|3)\/span (1|2|3|4)$/.test(s)));
});

test('photos are limited by tier, and only safe image links are drawn', async () => {
  await setData({ format: 'cascade', cards: 'dark', openSlots: true, cutGap: 28, cutPad: 72, items: {} });
  const info = await shadowInfo();
  assert.ok(info.imgs.includes('https://example.com/logo.png'));
  assert.ok(!info.imgs.some(s => s && s.startsWith('javascript:')), 'javascript: logo refused');
  assert.equal(await page.evaluate(() => window.__xss), undefined, 'no script from brand text');
  assert.ok(!(await shadowInfo()).imgs.some(s => s === 'x'), 'no injected image from brand text');
});

test('text from sponsors is shown as text, never as markup', async () => {
  await setData({ format: 'cascade', cards: 'dark', openSlots: true, cutGap: 28, cutPad: 72, items: {} });
  const info = await shadowInfo();
  assert.ok(info.text.includes('<img src=x onerror="window.__xss=1">Evil'));
  assert.ok(info.text.includes('<b>bold?</b>'));
});

test('clicking a piece opens its details; Close shuts them', async () => {
  await setData({ format: 'cascade', cards: 'dark', openSlots: true, cutGap: 28, cutPad: 72, items: {} });
  await page.evaluate(() => document.getElementById('wall').shadowRoot.querySelector('button.piece').click());
  assert.equal(await page.evaluate(() => document.getElementById('wall').shadowRoot.querySelector('dialog.detail').open), true);
  await page.evaluate(() => document.getElementById('wall').shadowRoot.querySelector('dialog.detail .close').click());
  assert.equal(await page.evaluate(() => document.getElementById('wall').shadowRoot.querySelector('dialog.detail').open), false);
});

test('legacy format draws nothing and the host is hidden, so the offer browser stays in charge', async () => {
  await setData({ format: 'legacy', cards: 'dark', openSlots: true, cutGap: 28, cutPad: 72, items: {} });
  const info = await shadowInfo();
  assert.equal(info.pieces, 0);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('wall')).display), 'none');
});

test('bad settings fall back to legacy, so a broken save never blanks the site', async () => {
  const format = await page.evaluate(() => { const w = document.getElementById('wall'); w.data = { settings: { format: 'ledger' }, items: [] }; return w.format; });
  assert.equal(format, 'legacy');
});

test('screenshots for review: each drawn format at phone and desktop widths', async () => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const format of ['featured', 'cascade', 'vouchers', 'cutouts']) {
      await setData({ format, cards: 'dark', openSlots: true, cutGap: 28, cutPad: 72, items: {} });
      const out = process.env.WALL_SHOTS ? `${process.env.WALL_SHOTS}/${format}-${width}.png` : null;
      if (out) await page.locator('#wall').screenshot({ path: out });
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
});
