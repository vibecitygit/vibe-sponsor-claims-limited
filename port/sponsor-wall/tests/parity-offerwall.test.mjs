// Parity proof for wall-offerwall.js (formats `featured` and `cascade`) against the prototype offerwall.html.
// Both pages are served from the repo root over http://localhost, get the same deck (DeckCore.SAMPLE through
// normalize), the same fixed and paused clock, the same featured rotation, viewport and fonts. The prototype is
// loaded in its #embed mode (the wall alone, as on a host page); its wall region is #stage, ours is the renderer's.
// Every comparison counts differing pixels (any channel off by more than TOL) and fails above 0.5%.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize as normPath } from 'node:path';
import { inflateSync } from 'node:zlib';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const MAX_PCT = 0.5;
const TOL = 0; // per-channel tolerance; 0 = exact pixels
const NOW = Date.UTC(2026, 10, 15, 4, 0, 0); // clock start; paused 1 s later
const PAUSED = NOW + 1000;
const ROTATION = 0; // prototype stores turn -1 → rotation 0
const WIDTHS = [390, 768, 1280];
const HEIGHT = 900;
const ENTRANCE_T = [0.05, 0.15, 0.3, 0.6, 1.0, 2.0];
const CAROUSEL_MS = [0, 200, 400, 800, 2000, 5200];
const DIALOG_T = [0.05, 0.15, 0.3, 0.6];
const results = [];

// ---------- static server for the repo root ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
let server, base, browser;
before(async () => {
  server = createServer(async (req, res) => {
    try {
      const p = normPath(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
      const file = join(REPO, p);
      if (!file.startsWith(REPO)) throw new Error('outside');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(body);
    } catch (e) { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close(); server?.close();
  console.log('\nDiffering pixels (TOL ' + TOL + ', limit ' + MAX_PCT + '%):');
  for (const r of results) console.log(`  ${r.pct.toFixed(4).padStart(8)}%  ${r.name}`);
});

// ---------- PNG decode (8-bit RGB/RGBA, non-interlaced: what Chromium writes) ----------
function decodePng(buf) {
  let o = 8, w, h, ct; const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12]) throw new Error('unsupported png'); }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    o += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : (() => { throw new Error('png colour type ' + ct); })();
  const raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * 4), prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; raw.copy(cur, 0, y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = cur[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
    for (let x = 0; x < w; x++) { out[(y * w + x) * 4] = cur[x * bpp]; out[(y * w + x) * 4 + 1] = cur[x * bpp + 1]; out[(y * w + x) * 4 + 2] = cur[x * bpp + 2]; out[(y * w + x) * 4 + 3] = bpp === 4 ? cur[x * bpp + 3] : 255; }
    cur.copy(prev);
  }
  return { w, h, data: out };
}
function diffPct(a, b) {
  const A = decodePng(a), B = decodePng(b);
  if (A.w !== B.w || A.h !== B.h) return { pct: 100, note: `size ${A.w}x${A.h} vs ${B.w}x${B.h}` };
  let n = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    if (Math.abs(A.data[i] - B.data[i]) > TOL || Math.abs(A.data[i + 1] - B.data[i + 1]) > TOL || Math.abs(A.data[i + 2] - B.data[i + 2]) > TOL || Math.abs(A.data[i + 3] - B.data[i + 3]) > TOL) n++;
  }
  return { pct: (n / (A.w * A.h)) * 100 };
}
function record(name, d) {
  results.push({ name, pct: d.pct });
  assert.ok(d.pct <= MAX_PCT, `${name}: ${d.pct.toFixed(3)}% differing pixels${d.note ? ' (' + d.note + ')' : ''}`);
}

// ---------- page set-up shared by both pages ----------
const INIT = () => {
  // pause the GSAP global timeline the moment GSAP arrives, before any entrance runs
  let g;
  Object.defineProperty(window, 'gsap', { configurable: true, enumerable: true, get: () => g, set: v => { g = v; try { v.globalTimeline.pause(); } catch (e) { /* not gsap */ } } });
  const shadow = () => document.getElementById('host') && document.getElementById('host').shadowRoot;
  window.__q = id => document.getElementById(id) || (shadow() && shadow().querySelector('#' + id));
  window.__tweenStart = pred => {
    const kids = gsap.globalTimeline.getChildren(true, true, false).filter(pred);
    return kids.length ? kids[kids.length - 1].startTime() : null;
  };
  // CSS animations and transitions run on wall time; set them all to the same point in both pages
  window.__freeze = transMs => {
    // document.getAnimations() leaves out shadow trees; the renderer's root lists its own
    [...document.getAnimations(), ...(shadow() ? shadow().getAnimations() : [])].forEach(a => {
      a.pause();
      if (a.animationName === 'expGlow') a.currentTime = 0;
      else if (a instanceof CSSTransition && transMs != null) a.currentTime = Math.min(transMs, a.effect.getComputedTiming().endTime);
      else a.finish();
    });
  };
};

// Google Fonts and cdnjs are fetched once per run and served byte-identical to every page, so both pages
// rasterise with the very same font files (the font CDN does not always answer with the same build).
const CDN = new Map();
async function sameBytes(route) {
  const url = route.request().url();
  if (!CDN.has(url)) CDN.set(url, (async () => { const r = await route.fetch(); return { status: r.status(), headers: r.headers(), body: await r.body() }; })());
  try { await route.fulfill(await CDN.get(url)); } catch (e) { CDN.delete(url); await route.continue(); }
}
async function newContext(width) {
  const ctx = await browser.newContext({ viewport: { width, height: HEIGHT }, deviceScaleFactor: 1 });
  await ctx.route(/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)\//, sameBytes);
  return ctx;
}
async function openPage(kind, format, cards, width, top) {
  const ctx = await newContext(width);
  const page = await ctx.newPage();
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(PAUSED);
  await page.addInitScript(INIT);
  let url;
  if (kind === 'proto') {
    await page.addInitScript(([layout, cards]) => {
      if (location.pathname.endsWith('offerwall.html')) {
        localStorage.setItem('sponsor-drops-deck-v2', JSON.stringify({ rev: 2, wall: { v: 2, layout, theme: 'dark', cards } }));
        localStorage.setItem('sponsor-drops-featured-turn', '-1');
        localStorage.removeItem('sponsor-drops-claims-v1');
      }
    }, [format, cards]);
    url = `${base}/offerwall.html#embed`;
  } else {
    url = `${base}/port/sponsor-wall/test/offerwall-harness.html?format=${format}&cards=${cards}&now=${PAUSED}&rotation=${ROTATION}&top=${top}`;
  }
  await page.goto(url);
  // ready: the wall is drawn, its entrance tween exists, fonts and the visible images are loaded
  await page.waitForFunction(() => {
    const s = window.__q('stage');
    if (!s || !s.firstElementChild || !window.gsap) return false;
    if (window.__tweenStart(t => t.vars && t.vars.clipPath === 'inset(0% 0% 0% 0%)') == null) return false;
    return document.fonts.status === 'loaded' && [...s.querySelectorAll('img')].every(i => i.loading === 'lazy' || (i.complete && i.naturalWidth > 0));
  }, null, { timeout: 30000, polling: 100 });
  await page.evaluate(() => Promise.all([...window.__q('stage').querySelectorAll('img')].filter(i => i.complete && i.naturalWidth).map(i => i.decode().catch(() => {}))));
  const t0 = await page.evaluate(() => window.__tweenStart(t => t.vars && t.vars.clipPath === 'inset(0% 0% 0% 0%)'));
  return { ctx, page, t0 };
}

async function seek(p, t) { await p.page.evaluate(t => { gsap.globalTimeline.seek(t, false); }, t); }
async function stageShot(p, transMs) {
  await p.page.evaluate(ms => window.__freeze(ms), transMs);
  const r = await p.page.evaluate(() => { const b = window.__q('stage').getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, width: b.width, height: b.height }; });
  return { buf: await p.page.screenshot({ fullPage: true, clip: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } }), r };
}
// Chromium may still be settling a layer's raster scale right after a seek (it treats script-driven transforms as
// animating), which shows as anti-aliasing noise on small text. A frame that differs is shot again (up to 3 times,
// 200 ms apart, the page's own clock and timelines stay paused) and the best match counts.
async function compareStage(name, A, B, transMs) {
  let a, b, d;
  for (let k = 0; k < 3; k++) {
    if (k) await new Promise(r => setTimeout(r, 200));
    a = await stageShot(A, transMs); b = await stageShot(B, transMs);
    const dk = diffPct(a.buf, b.buf);
    if (!d || dk.pct < d.pct) d = dk;
    if (!d.pct) break;
  }
  if (process.env.DUMP && d.pct > 0) { const { writeFileSync } = await import('node:fs'); const f = process.env.DUMP + '/' + name.replace(/[^\w.+-]+/g, '_'); writeFileSync(f + '-proto.png', a.buf); writeFileSync(f + '-port.png', b.buf); }
  if (a.r.height !== b.r.height || a.r.width !== b.r.width) d.note = `stage ${a.r.width}x${a.r.height} vs ${b.r.width}x${b.r.height}`;
  record(name, d);
}

async function pair(format, cards, width) {
  const A = await openPage('proto', format, cards, width);
  const top = await A.page.evaluate(() => window.__q('stage').getBoundingClientRect().top + scrollY);
  const B = await openPage('port', format, cards, width, top);
  return { A, B, close: async () => { await A.ctx.close(); await B.ctx.close(); } };
}

const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
for (const format of ['featured', 'cascade']) {
  for (const cards of ['dark', 'white']) {
    for (const width of WIDTHS) {
      const title = `${format} · ${cards} cards · ${width}px: entrance, final state, carousel advance, dialog open`;
      if (ONLY && !ONLY.test(title)) continue;
      test(title, async () => {
        const { A, B, close } = await pair(format, cards, width);
        try {
          const tag = `${format}/${cards}/${width}`;
          // entrance frames
          for (const t of ENTRANCE_T) {
            await seek(A, A.t0 + t); await seek(B, B.t0 + t);
            await compareStage(`${tag} entrance t=${t}s`, A, B);
          }
          // final state
          await seek(A, A.t0 + 10); await seek(B, B.t0 + 10);
          await compareStage(`${tag} final`, A, B);
          // one carousel advance: one beat of the shared interval, then the cross-fade and settle frames
          await A.page.clock.runFor(1700); await B.page.clock.runFor(1700);
          const adv = await Promise.all([A, B].map(p => p.page.evaluate(() => [...window.__q('stage').querySelectorAll('.media')].map(m => [...m.querySelectorAll('.ph')].findIndex(i => i.classList.contains('on'))))));
          assert.deepEqual(adv[1], adv[0], 'same carousel advanced');
          assert.ok(adv[0].some(k => k > 0), 'a carousel advanced');
          for (const ms of CAROUSEL_MS) {
            await A.page.evaluate(() => Promise.all([...window.__q('stage').querySelectorAll('.ph')].filter(i => i.complete && i.naturalWidth).map(i => i.decode().catch(() => {}))));
            await B.page.evaluate(() => Promise.all([...window.__q('stage').querySelectorAll('.ph')].filter(i => i.complete && i.naturalWidth).map(i => i.decode().catch(() => {}))));
            await compareStage(`${tag} carousel +${ms}ms`, A, B, ms);
          }
          // open the offer dialog from the first wall card (FLIP from the card), frames while it grows, then open
          for (const p of [A, B]) {
            await p.page.evaluate(() => { const s = window.__q('stage'); s.querySelector('.cascade .card.offer .cta').click(); });
            p.t1 = await p.page.evaluate(() => window.__tweenStart(t => t.targets()[0] === window.__q('detail') && t.vars.ease === 'expo.out'));
            assert.ok(p.t1 != null, 'dialog FLIP tween');
            await p.page.evaluate(() => Promise.all([...window.__q('detail').querySelectorAll('img')].map(i => i.decode().catch(() => {}))));
          }
          for (const t of [...DIALOG_T, 10]) {
            await seek(A, A.t1 + t); await seek(B, B.t1 + t);
            // clip: the prototype's dialog box, 4 px inside its edge. The dialog's 1px border is translucent (white cards:
            // rgba(17,16,14,.14)) and, scaled up during the FLIP, shows the blurred page behind it; behind the prototype's
            // wall is its own page heading (chrome, not part of the wall), so the border band is left out.
            let shots = [], dd = null;
            for (let k = 0; k < 3 && !(dd && dd.pct === 0); k++) {
              if (k) await new Promise(r => setTimeout(r, 200));
              const cur = [];
              for (const p of [A, B]) {
                await p.page.evaluate(() => window.__freeze());
                const r = await A.page.evaluate(() => { const b = window.__q('detail').getBoundingClientRect(); return { x: Math.max(0, Math.ceil(b.left) + 4), y: Math.max(0, Math.ceil(b.top) + 4), r: Math.min(innerWidth, Math.floor(b.right) - 4), b: Math.min(innerHeight, Math.floor(b.bottom) - 4) }; });
                cur.push(await p.page.screenshot({ clip: { x: r.x, y: r.y, width: r.r - r.x, height: r.b - r.y } }));
              }
              const dk = diffPct(cur[0], cur[1]);
              if (!dd || dk.pct < dd.pct) { dd = dk; shots = cur; }
            }
            const dname = `${tag} dialog ${t === 10 ? 'open' : 't=' + t + 's'}`;
            if (process.env.DUMP && dd.pct > 0) { const { writeFileSync } = await import('node:fs'); const f = process.env.DUMP + '/' + dname.replace(/[^\w.+-]+/g, '_'); writeFileSync(f + '-proto.png', shots[0]); writeFileSync(f + '-port.png', shots[1]); }
            record(dname, dd);
          }
        } finally { await close(); }
      });
    }
  }
}

// Live coupons (from the integrator's adapter): no stock data, no end date, empty fields, and sponsors with no offer.
test('live coupons: no stock / no end date / empty fields / no offer', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: HEIGHT } });
  const page = await ctx.newPage();
  await page.goto(`${base}/port/sponsor-wall/test/offerwall-harness.html?format=cascade&now=${PAUSED}&rotation=0`);
  const out = await page.evaluate(async () => {
    window.__wall.destroy();
    const deck = DeckCore.sample();
    deck.wall = DeckCore.wallOf({ v: 2, layout: 'featured', cards: 'dark', openSlots: false });
    deck.coupons = deck.coupons.map(c => ({ ...c, logoSrc: c.logoSrc.replace(/^shared\//, ''), photos: [] }));
    // CVR stays the featured panel (rotation 0); the live cases are wall cards
    const live = deck.coupons[3]; Object.assign(live, { id: 'LIVE', remaining: undefined, total: undefined, to: '', from: '', year: '' });
    const part = deck.coupons[5]; Object.assign(part, { id: 'PART', remaining: undefined, total: undefined, where: '', limit: '', long: '' });
    const none = deck.coupons[6]; Object.assign(none, { id: 'NONE', noOffer: true, role: 'Sponsor', short: '', long: '', where: '', limit: '', terms: [], from: '', to: '', year: '', type: '', remaining: undefined, total: undefined, site: 'https://example.com/desainz' });
    const bare = deck.coupons[7]; Object.assign(bare, { id: 'BARE', noOffer: true, role: 'Partner', short: '', long: '', where: '', limit: '', terms: [], from: '', to: '', year: '', type: '', remaining: undefined, total: undefined, site: '' });
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' }), container = document.createElement('div'); root.appendChild(container);
    const claims = [];
    const w = VCWallRenderers.featured.mount(container, deck, { root, now: Date.UTC(2026, 10, 25), rotation: 0, onClaim: id => claims.push(id) });
    const stage = () => root.querySelector('#stage');
    for (let k = 0; k < 100 && !(stage() && stage().querySelector('[data-oid="BARE"]')); k++) await new Promise(r => setTimeout(r, 50));
    const q = id => stage().querySelector(`[data-oid="${id}"]`);
    const kvs = el => [...el.querySelectorAll('.kv span:first-child')].map(s => s.textContent);
    const card = q('LIVE'), other = q('KTC'), partC = q('PART'), noneC = q('NONE'), bareC = q('BARE');
    const res = { text: card.textContent, stub: !!card.querySelector('.stub'), expiring: card.classList.contains('expiring'), monos: [...card.querySelectorAll('.mono')].map(m => m.textContent), otherLeft: other.textContent.includes('52 left'), otherStub: !!other.querySelector('.stub') };
    res.part = { kvs: kvs(partC), star: !!partC.querySelector('.star'), cap: !!partC.querySelector(':scope > p.cap'), cta: partC.querySelector('.cta').textContent };
    const noneLink = noneC.querySelector('a.cta');
    res.none = { text: noneC.textContent, sum: noneC.querySelector('.sum') && noneC.querySelector('.sum').textContent, tags: [...noneC.querySelectorAll('.tag')].map(t => t.textContent), kvs: kvs(noneC), rule: !!noneC.querySelector('.rule'), star: !!noneC.querySelector('.star'), typ: !!noneC.querySelector('.typ'), stub: !!noneC.querySelector('.stub'),
      link: noneLink && [noneLink.textContent, noneLink.getAttribute('href'), noneLink.getAttribute('target'), noneLink.getAttribute('rel')], buttons: noneC.querySelectorAll('button').length };
    res.bare = { ctas: bareC.querySelectorAll('.cta, button, a').length, sum: bareC.querySelector('.sum') && bareC.querySelector('.sum').textContent };
    const dlg = root.querySelector('#detail');
    noneLink.addEventListener('click', e => e.preventDefault()); noneLink.click();
    res.noneOpensDialog = dlg.open;
    card.querySelector('.cta').click();
    res.dialogOpen = dlg.open;
    const claim = [...dlg.querySelectorAll('.cta')].find(b => /Claim offer/.test(b.textContent));
    res.claimEnabled = !!claim && !claim.disabled;
    res.leftRow = [...dlg.querySelectorAll('.side .cap')].some(s => s.textContent === 'Left');
    res.dialogStub = !!dlg.querySelector('.stub');
    claim && claim.click();
    res.claims = claims;
    // prev/next walk every offer except the no-offer sponsors
    const seen = [];
    const pos = root.querySelector('#dPos').textContent;
    for (let k = 0; k < 10; k++) { seen.push(root.querySelector('#dTitle').textContent.replace('Partner offer · ', '')); root.querySelector('#dNext').click(); await new Promise(r => setTimeout(r, 600)); }
    res.pos = pos; res.seen = seen;
    // the dialog for an offer with empty fields hides those rows
    w.destroy();
    const w2 = VCWallRenderers.cascade.mount(container, deck, { root, now: Date.UTC(2026, 10, 25), rotation: 0 });
    for (let k = 0; k < 100 && !(stage() && stage().querySelector('[data-oid="PART"]')); k++) await new Promise(r => setTimeout(r, 50));
    q('PART').querySelector('.cta').click();
    const d2 = root.querySelector('#detail');
    res.partSide = [...d2.querySelectorAll('.side > div > .cap:first-child')].map(s => s.textContent);
    w2.destroy();
    return res;
  });
  await ctx.close();
  // no stock data, no end date
  assert.equal(out.stub, false, 'no expiry stub');
  assert.equal(out.expiring, false, 'no last-week glow');
  assert.ok(!/left|Sold out/.test(out.text), 'no stock counter: ' + out.text);
  assert.deepEqual(out.monos, ['SLOT 04']);
  assert.ok(out.otherLeft && out.otherStub, 'a coupon with stock and dates still shows both');
  assert.ok(out.dialogOpen && out.claimEnabled, 'available: Claim offer is enabled');
  assert.equal(out.leftRow, false, 'no Left row in the dialog');
  assert.equal(out.dialogStub, false, 'no expiry stub in the dialog');
  assert.deepEqual(out.claims, ['LIVE'], 'Claim calls opts.onClaim(id)');
  // an offer with empty fields: only the empty rows go
  assert.deepEqual(out.part.kvs, ['Valid'], 'Where row hidden, Valid kept');
  assert.equal(out.part.star, false, 'no limit mark');
  assert.match(out.part.cta, /View offer/);
  assert.deepEqual(out.partSide, ['Valid', 'Sponsor'], 'dialog side panel skips the empty Where and Rules rows (and Left: no stock data)');
  // no published offer
  assert.equal(out.none.sum, 'Sponsor', 'role in place of the offer text');
  assert.deepEqual(out.none.tags, [], 'no type tag');
  assert.deepEqual(out.none.kvs, []); assert.equal(out.none.rule, false); assert.equal(out.none.star, false); assert.equal(out.none.typ, false); assert.equal(out.none.stub, false);
  assert.ok(!/✳|View offer|Where|Valid/.test(out.none.text), 'no stray mark, rows or View offer: ' + out.none.text);
  assert.deepEqual(out.none.link, ['Visit site↗', 'https://example.com/desainz', '_blank', 'noopener noreferrer']);
  assert.equal(out.none.buttons, 0);
  assert.equal(out.noneOpensDialog, false, 'no dialog for a sponsor without an offer');
  assert.equal(out.bare.ctas, 0, 'no site: no action');
  assert.equal(out.bare.sum, 'Partner');
  // prev/next: 6 offers in the dialog list (8 sponsors minus the two without an offer)
  assert.match(out.pos, / \/ 6$/);
  assert.ok(!out.seen.includes('DESAINZ') && !out.seen.includes('Northbound Barbershop Cebu'), 'no-offer sponsors are skipped: ' + out.seen.join(', '));
});

test('featured panel: only a sponsor with an offer can take it; with none there is no featured panel', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: HEIGHT } });
  const page = await ctx.newPage();
  await page.goto(`${base}/port/sponsor-wall/test/offerwall-harness.html?format=cascade&now=${PAUSED}&rotation=0`);
  const out = await page.evaluate(async () => {
    window.__wall.destroy();
    const mk = mutate => { const deck = DeckCore.sample(); deck.wall = DeckCore.wallOf({ v: 2, layout: 'featured', cards: 'dark', openSlots: false }); deck.coupons = deck.coupons.map(c => ({ ...c, logoSrc: c.logoSrc.replace(/^shared\//, ''), photos: [] })); mutate(deck); return deck; };
    const run = async deck => {
      const host = document.createElement('div'); document.body.appendChild(host);
      const root = host.attachShadow({ mode: 'open' }), container = document.createElement('div'); root.appendChild(container);
      const w = VCWallRenderers.featured.mount(container, deck, { root, now: Date.UTC(2026, 10, 25), rotation: 0 });
      for (let k = 0; k < 100 && !root.querySelector('#stage [data-oid]'); k++) await new Promise(r => setTimeout(r, 50));
      const feat = root.querySelector('#stage article.feature[data-oid]');
      const r = { featured: feat ? feat.getAttribute('data-oid') : null, combo: !!root.querySelector('#stage .combo'), cards: root.querySelectorAll('#stage [data-oid]').length };
      w.destroy(); host.remove(); return r;
    };
    const noOffer = c => Object.assign(c, { noOffer: true, short: '', long: '', where: '', limit: '', terms: [], from: '', to: '', year: '' });
    return { normal: await run(mk(() => {})), firstOff: await run(mk(d => noOffer(d.coupons[0]))), allOff: await run(mk(d => d.coupons.forEach(noOffer))) };
  });
  await ctx.close();
  assert.equal(out.normal.featured, 'CVR', 'the prototype sample still features Casa Verde');
  assert.ok(out.firstOff.featured && out.firstOff.featured !== 'CVR', 'a sponsor without an offer is skipped: ' + out.firstOff.featured);
  assert.equal(out.allOff.featured, null, 'no sponsor has an offer: no featured panel');
  assert.equal(out.allOff.combo, false);
  assert.ok(out.allOff.cards > 0, 'the sponsors still show on the wall');
});
