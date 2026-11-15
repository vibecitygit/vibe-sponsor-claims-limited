// Parity proof for the voucher wall renderer (format 'vouchers') against the prototype page vouchers.html.
// Serves the repo root over http://localhost, loads the prototype and test/vouchers-harness.html with the same deck
// (DeckCore SAMPLE through normalize), the same fixed clock, the same seeded Math.random (the entrance spin uses
// gsap.utils.random), the same fonts and viewport, and compares screenshots pixel by pixel.
// Run: node --test port/sponsor-wall/tests/parity-vouchers.test.mjs   (PARITY_OUT=<dir> saves the PNGs)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const REPO = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const OUT = process.env.PARITY_OUT || null;
const LIMIT = 0.5; // percent of differing pixels
const NOW = new Date(2026, 10, 20, 10, 0, 0).getTime(); // 20 Nov 2026 10:00 local: one offer ends today, one in 4 days
const WIDTHS = [[390, 844], [768, 1024], [1280, 800]];
const CARDS = ['dark', 'white'];
const ENTRANCE = [0.05, 0.15, 0.3, 0.6, 1.0, 2.0];
const DIALOG = [0.05, 0.15, 0.3, 0.6, 1.0];
const CAROUSEL = [0, 200, 400, 800, null]; // ms into the photo cross-fade; null = settled
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };

let server, base, browser, cmpPage;
const results = [];

before(async () => {
  server = http.createServer((req, res) => {
    const p = path.join(REPO, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(REPO) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  cmpPage = await browser.newPage();
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
});
after(async () => {
  await browser?.close();
  server?.close();
  if (results.length) {
    console.log('\nVoucher wall parity (differing pixels, limit ' + LIMIT + '%):');
    for (const r of results) console.log(`  ${r.name.padEnd(46)} ${r.pct.toFixed(4)}%`);
  }
});

// Runs in every page before its scripts: seeded Math.random, and GSAP's global timeline paused as soon as GSAP loads.
function initScript({ white }) {
  let a = 0x9e3779b9;
  Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let g;
  Object.defineProperty(window, 'gsap', { configurable: true, enumerable: true, get() { return g; }, set(v) { g = v; try { v.globalTimeline.pause(); } catch (e) { /* not gsap yet */ } } });
  // the prototype's White setting, as its own theme bar stores it
  if (white && location.pathname.endsWith('/vouchers.html')) {
    try { localStorage.setItem('sponsor-drops-deck-v2', JSON.stringify({ wall: { theme: 'light' } })); } catch (e) { /* blocked */ }
  }
}

// Google Fonts can answer the same css2 URL with different font files (static instances or the variable font) from one
// request to the next. Both pages must render with the same files, so every Google Fonts and cdnjs response is fetched
// once and replayed from memory to every page.
const netCache = new Map();
async function replay(route) {
  const url = route.request().url();
  if (!netCache.has(url)) netCache.set(url, (async () => { const r = await route.fetch(); return { status: r.status(), headers: r.headers(), body: await r.body() }; })());
  const r = await netCache.get(url);
  await route.fulfill({ status: r.status, headers: { ...r.headers, 'access-control-allow-origin': '*' }, body: r.body });
}

async function openPage(url, [w, hgt], white) {
  const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1 });
  await ctx.route(/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)\//, replay);
  const page = await ctx.newPage();
  await page.addInitScript(initScript, { white });
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(NOW);
  await page.goto(url);
  // poll from Node: the page's timers and requestAnimationFrame are paused by the fake clock
  const ready = () => page.evaluate(() => {
    const r = window.__root || document;
    const ps = r.querySelectorAll('.grid .piece'), imgs = r.querySelectorAll('.grid img');
    return ps.length === 8 && [...imgs].every(i => i.complete && i.naturalWidth > 0) && document.fonts.status === 'loaded';
  });
  for (let k = 0; !(await ready()); k++) { if (k > 300) throw new Error('page not ready: ' + url); await new Promise(r => setTimeout(r, 100)); }
  // Same font faces in both pages: load every face of the Google Fonts stylesheet (the prototype's header uses faces
  // the wall itself does not), then re-render the page once so all text is laid out and rasterized with the full set.
  await page.evaluate(async () => {
    await Promise.all([...document.fonts].map(f => f.load().catch(() => null)));
    document.body.style.display = 'none'; void document.body.offsetHeight; document.body.style.display = '';
  });
  return page;
}

const q = fn => `(() => { const R = window.__root || document; return (${fn})(R); })()`;
const gridRect = page => page.evaluate(q(R => { const r = R.querySelector('.grid').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height, doc: document.documentElement.scrollHeight }; }));
const baseTime = page => page.evaluate(() => gsap.globalTimeline.time());
const seek = (page, t) => page.evaluate(t => { gsap.globalTimeline.time(t); }, t);
// CSS animations/transitions run on the real document timeline, so pin them: the expiry glow at its start, and
// transitions at `ms` (null = finished).
const pinCss = (page, ms = null) => page.evaluate(ms => {
  // a ShadowRoot's animations are not in document.getAnimations()
  [...document.getAnimations(), ...(window.__root ? window.__root.getAnimations() : [])].forEach(a => {
    // a settled transition is cancelled, which shows its end value at once (and drops the compositor animation)
    if (a instanceof CSSTransition && ms == null) { a.cancel(); return; }
    a.pause();
    a.currentTime = a instanceof CSSTransition ? ms : 0;
  });
}, ms);

// Chromium can keep stale raster for a layer after the entrance tweens clear their transforms (seen in either page,
// independent of the code under test). Hiding the page for one frame and showing it again re-rasters everything
// without touching animations or layout.
async function repaint(page) {
  await page.evaluate(() => { document.documentElement.style.visibility = 'hidden'; });
  await page.screenshot();
  await page.evaluate(() => { document.documentElement.style.visibility = ''; });
}
// Chromium can hand back a frame with some tiles not yet re-rastered after a change; take shots until two in a row
// are identical (as Playwright's toHaveScreenshot does).
async function stable(take) {
  let prev = await take();
  for (let k = 0; k < 8; k++) { const next = await take(); if (next.equals(prev)) return next; prev = next; }
  return prev;
}

async function compare(name, bufA, bufB) {
  const [a, b] = [bufA.toString('base64'), bufB.toString('base64')];
  const r = await cmpPage.evaluate(async ([a, b]) => {
    const dec = async s => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()); const c = new OffscreenCanvas(bm.width, bm.height); const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return { w: bm.width, h: bm.height, d: x.getImageData(0, 0, bm.width, bm.height).data }; };
    const A = await dec(a), B = await dec(b);
    if (A.w !== B.w || A.h !== B.h) return { size: `${A.w}x${A.h} vs ${B.w}x${B.h}`, pct: 100 };
    let n = 0;
    for (let i = 0; i < A.d.length; i += 4) if (A.d[i] !== B.d[i] || A.d[i + 1] !== B.d[i + 1] || A.d[i + 2] !== B.d[i + 2] || A.d[i + 3] !== B.d[i + 3]) n++;
    return { pct: n / (A.w * A.h) * 100 };
  }, [a, b]);
  results.push({ name, pct: r.pct });
  if (OUT) { const f = name.replace(/[^\w.-]+/g, '_'); fs.writeFileSync(path.join(OUT, f + '.proto.png'), bufA); fs.writeFileSync(path.join(OUT, f + '.port.png'), bufB); }
  assert.ok(r.pct <= LIMIT, `${name}: ${r.size ? 'size ' + r.size : r.pct.toFixed(4) + '% differing pixels'}`);
}

for (const size of WIDTHS) for (const cards of CARDS) {
  test(`vouchers parity ${size[0]}px ${cards} cards`, async () => {
    const white = cards === 'white';
    const proto = await openPage(`${base}/vouchers.html`, size, white);
    const g = await gridRect(proto);
    const bottom = g.doc - (g.y + g.height);
    const port = await openPage(`${base}/port/sponsor-wall/test/vouchers-harness.html?cards=${cards}&top=${g.y}&bottom=${bottom}`, size, white);
    const g2 = await gridRect(port);
    assert.deepEqual({ x: g2.x, y: g2.y, w: g2.width, h: g2.height }, { x: g.x, y: g.y, w: g.width, h: g.height }, 'wall region matches');
    const clip = { x: g.x, y: g.y, width: g.width, height: g.height };
    const shot = async page => { await repaint(page); return stable(() => page.screenshot({ clip, fullPage: true })); };
    const tag = `${size[0]} ${cards}`;

    // entrance: both global timelines were paused before the entrance tween was created
    const [b1, b2] = [await baseTime(proto), await baseTime(port)];
    for (const t of ENTRANCE) {
      await seek(proto, b1 + t); await seek(port, b2 + t);
      await pinCss(proto); await pinCss(port);
      await compare(`${tag} entrance t=${t}`, await shot(proto), await shot(port));
    }
    // final state
    await seek(proto, b1 + 5); await seek(port, b2 + 5);
    await pinCss(proto); await pinCss(port);
    await compare(`${tag} final`, await shot(proto), await shot(port));

    // one carousel advance (the Casa Verde magazine photos): the shared 2.6 s beat, then the cross-fade
    await proto.clock.runFor(2600); await port.clock.runFor(2600);
    const on = p => p.evaluate(q(R => [...R.querySelectorAll('.photo .ph')].findIndex(i => i.classList.contains('on'))));
    assert.equal(await on(proto), 1, 'prototype advanced'); assert.equal(await on(port), 1, 'port advanced');
    for (const ms of CAROUSEL) {
      await pinCss(proto, ms); await pinCss(port, ms);
      await compare(`${tag} carousel ${ms == null ? 'settled' : ms + 'ms'}`, await shot(proto), await shot(port));
    }

    // open-offer dialog: same scroll, open from the first piece, then the grow + fade frames
    for (const p of [proto, port]) await p.evaluate(y => window.scrollTo(0, y), g.y);
    const [d1, d2] = [await baseTime(proto), await baseTime(port)];
    for (const p of [proto, port]) await p.evaluate(q(R => R.querySelector('.grid .piece').click()));
    for (const t of DIALOG) {
      await seek(proto, d1 + t); await seek(port, d2 + t);
      await pinCss(proto); await pinCss(port);
      const view = async page => { await repaint(page); return stable(() => page.screenshot()); };
      await compare(`${tag} dialog t=${t}`, await view(proto), await view(port));
    }
    await proto.context().close(); await port.context().close();
  });
}

test('live coupons: no stock, no end date, empty fields and no published offer', async () => {
  const page = await openPage(`${base}/port/sponsor-wall/test/vouchers-harness.html?live=1`, [1280, 800], false);
  await page.evaluate(() => { gsap.globalTimeline.time(gsap.globalTimeline.time() + 5); });
  const info = await page.evaluate(() => {
    const R = window.__root, pieces = [...R.querySelectorAll('.grid .piece')], dlg = R.getElementById('detail');
    const by = name => pieces.find(p => p.getAttribute('aria-label').startsWith(name));
    const air = by('Air Condo'), cvr = by('Casa Verde'), ktc = by('Know The Culture'), pet = by('Pets Society'), dsz = by('DESAINZ');
    const out = {
      airEnds: !!air.querySelector('.ends'), airExpiring: air.classList.contains('expiring'),
      cvrEnds: !!cvr.querySelector('.ends'), cvrMeter: !!cvr.querySelector('.meter'), cvrText: cvr.textContent,
      pet: { tag: pet.tagName, href: pet.getAttribute('href'), target: pet.getAttribute('target'), rel: pet.getAttribute('rel'), text: pet.textContent, h3: pet.querySelector('h3').textContent, ends: !!pet.querySelector('.ends'), type: !!pet.querySelector('.type') },
      dsz: { tag: dsz.tagName, go: !!dsz.querySelector('.go'), text: dsz.textContent },
    };
    pet.addEventListener('click', e => e.preventDefault()); // keep the test page here
    pet.click(); dsz.click(); out.dialogAfterNoOffer = dlg.open;
    ktc.click();
    const kb = R.getElementById('dBody');
    out.ktc = { text: kb.textContent, terms: !!kb.querySelector('.terms'), facts: [...kb.querySelectorAll('.facts dt')].map(d => d.textContent) };
    dlg.close();
    cvr.click();
    const body = R.getElementById('dBody'), cta = body.querySelector('.cta');
    out.dlg = { text: body.textContent, ends: !!body.querySelector('.ends'), disabled: cta.disabled, label: cta.textContent };
    cta.click();
    out.claims = window.__claims.slice();
    return out;
  });
  // no stock numbers: available, no counter; no end date: no expiry treatment
  assert.equal(info.airEnds, false); assert.equal(info.airExpiring, false);
  assert.equal(info.cvrEnds, false); assert.equal(info.cvrMeter, false);
  assert.doesNotMatch(info.cvrText, /left|claimed|undefined|Ended/i);
  assert.match(info.cvrText, /Open to every ticket · 1 per ticket/);
  assert.equal(info.dlg.ends, false); assert.equal(info.dlg.disabled, false);
  assert.match(info.dlg.label, /Claim offer/);
  assert.doesNotMatch(info.dlg.text, /left|Allocation|Valid|undefined|Ended/);
  assert.deepEqual(info.claims, ['CVR']);
  // an offer with empty fields: those rows are hidden
  assert.equal(info.ktc.terms, false); assert.doesNotMatch(info.ktc.text, /How to claim|undefined/);
  assert.deepEqual(info.ktc.facts, ['Valid']);
  // no published offer: role in place of the offer, link to the site, no dialog
  assert.equal(info.pet.tag, 'A'); assert.equal(info.pet.href, 'https://www.petssociety.ph/');
  assert.equal(info.pet.target, '_blank'); assert.equal(info.pet.rel, 'noopener noreferrer');
  assert.equal(info.pet.h3, 'Sponsor'); assert.match(info.pet.text, /Visit site/);
  assert.doesNotMatch(info.pet.text, /Claim|undefined|Ends/); assert.equal(info.pet.ends, false); assert.equal(info.pet.type, false);
  assert.equal(info.dsz.tag, 'DIV'); assert.equal(info.dsz.go, false); assert.doesNotMatch(info.dsz.text, /Claim|Visit|undefined/);
  assert.equal(info.dialogAfterNoOffer, false);
  await page.context().close();
});
