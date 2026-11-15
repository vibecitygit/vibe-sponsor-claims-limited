// Parity proof for the cut-out wall renderer (format `cutouts`) against the prototype cutouts.html.
// Serves the repo root over http://localhost so both pages load fonts, GSAP and images the same way.
// Time: Playwright's page.clock is installed and paused before load in both pages (Date fixed to NOW, timers and
// requestAnimationFrame frozen). GSAP's global timeline is paused and seeked identically in both pages. The impact
// ring is a CSS animation, so after each seek both pages set it to the time GSAP says it has been running.
// Math.random is seeded identically in both pages (the slap's random start rotation).
// Comparison: pixelmatch-style YIQ colour distance with threshold 0.1 (no anti-alias exclusion), decoded in-page.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const PROTO = '/cutouts.html';
const HARNESS = '/port/sponsor-wall/test/cutouts-harness.html';
const NOW = new Date(2026, 10, 14, 12, 0, 0).getTime(); // local time: gives 7, 10, 14 and 30+ day expiries
const LIMIT = 0.5; // percent
const TIMES = [0.05, 0.15, 0.3, 0.6, 1.0, 2.0];
const VIEWPORTS = [[390, 844], [768, 1024], [1280, 900]];
const DIFF_DIR = process.env.DIFF_DIR || null;
const results = [];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
let server, base, browser, cmpPage;

before(async () => {
  server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (err, buf) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(buf);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`;
  browser = await chromium.launch();
  cmpPage = await browser.newPage();
  if (DIFF_DIR) fs.mkdirSync(DIFF_DIR, { recursive: true });
});
after(async () => {
  await browser?.close(); server?.close();
  if (results.length) {
    console.log('\nDiffering pixels (limit ' + LIMIT + '%, YIQ threshold 0.1) | any channel differs');
    for (const r of results) console.log(`${r.pct.toFixed(3).padStart(7)}% | ${r.strict.toFixed(3).padStart(7)}%  ${r.name}`);
  }
});

// In-page helpers, installed identically in both pages. `R()` is where the wall lives (document or the shadow root).
function initScript({ seed, stored }) {
  let s = seed >>> 0;
  Math.random = function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { if (stored) localStorage.setItem('sponsor-drops-deck-v2', stored); else localStorage.removeItem('sponsor-drops-deck-v2'); } catch (e) {}
  window.__P = {
    R: () => window.__root || document,
    board: () => window.__P.R().getElementById('board'),
    ready() {
      const b = window.__P.board(); if (!b || !b.querySelector('.piece')) return false;
      const imgs = [...b.querySelectorAll('img')]; return imgs.every(i => i.complete && i.naturalWidth > 0) && document.fonts.status === 'loaded';
    },
    // put each running impact ring (CSS animation) at the time GSAP says it started, then hold it there
    fixRings() {
      const gt = gsap.globalTimeline, now = gt.time();
      for (const a of window.__P.R().getAnimations()) {
        if (!a.animationName || !/^ringd?$/.test(a.animationName)) continue;
        const piece = a.effect.target.querySelector('.piece');
        const tw = gsap.getTweensOf(piece).find(t => t.parent && t.parent !== gt);
        const el = tw ? now - (tw.parent.startTime() + 0.26) : 10;
        a.pause(); a.currentTime = Math.max(0, el * 1000);
      }
    },
    seek(t) { gsap.globalTimeline.seek(t, false); window.__P.fixRings(); return gsap.globalTimeline.time(); },
  };
}

async function open(kind, [w, hgt], theme, top = 0, bottom = 0) {
  const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const stored = kind === 'proto' && theme === 'light' ? JSON.stringify({ wall: { theme: 'light', cards: 'white' } }) : null;
  await page.addInitScript(initScript, { seed: 12345, stored });
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(NOW + 1);
  const url = kind === 'proto' ? base + PROTO : `${base}${HARNESS}?now=${NOW + 1}&top=${top}&bottom=${bottom}&theme=${theme}${theme === 'light' ? '&cards=white' : ''}`;
  await page.goto(url);
  // poll from Node: the page's own timers are on the paused fake clock
  for (let k = 0; !(await page.evaluate(() => window.__P.ready())); k++) { if (k > 300) throw new Error(kind + ' did not render'); await new Promise(r => setTimeout(r, 100)); }
  await page.evaluate(() => { gsap.globalTimeline.pause(); });
  return { page, ctx };
}

const boardTop = page => page.evaluate(() => window.__P.board().getBoundingClientRect().top + scrollY);
async function pair(vp, theme) {
  const A = await open('proto', vp, theme);
  const top = await boardTop(A.page);
  // the page below the wall (the prototype's footer) is matched too, so both pages scroll the same distance
  const bottom = await A.page.evaluate(() => document.documentElement.scrollHeight - (window.__P.board().getBoundingClientRect().bottom + scrollY));
  const B = await open('harness', vp, theme, top, bottom);
  assert.equal(await boardTop(B.page), top, 'harness wall starts where the prototype board starts');
  const [hA, hB] = await Promise.all([A, B].map(x => x.page.evaluate(() => document.documentElement.scrollHeight)));
  assert.equal(hB, hA, 'same page height');
  return [A, B];
}
const both = (P, fn, arg) => Promise.all(P.map(x => x.page.evaluate(fn, arg)));
async function scrollBoth(P, y) {
  await both(P, y => scrollTo(0, y), y);
  for (const x of P) await x.page.clock.runFor(100); // let ScrollTrigger handle the scroll (rAF is on the fake clock)
}
// visible part of the board, in viewport coordinates
async function clipOf(page) {
  return page.evaluate(() => {
    const r = window.__P.board().getBoundingClientRect(), y0 = Math.max(0, r.top), y1 = Math.min(innerHeight, r.bottom);
    return { x: 0, y: Math.round(y0), width: innerWidth, height: Math.round(y1 - y0) };
  });
}

async function compare(name, bufA, bufB) {
  const res = await cmpPage.evaluate(async ([a, b, wantDiff]) => {
    const load = async s => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()); const c = new OffscreenCanvas(bm.width, bm.height), x = c.getContext('2d'); x.drawImage(bm, 0, 0); return { w: bm.width, h: bm.height, d: x.getImageData(0, 0, bm.width, bm.height).data }; };
    const A = await load(a), B = await load(b);
    if (A.w !== B.w || A.h !== B.h) return { pct: 100, note: `size ${A.w}x${A.h} vs ${B.w}x${B.h}` };
    const max = 35215 * 0.1 * 0.1; let n = 0, strict = 0; const out = wantDiff ? new Uint8ClampedArray(A.d.length) : null;
    const yiq = (r, g, b) => [r * 0.29889531 + g * 0.58662247 + b * 0.11448223, r * 0.59597799 - g * 0.27417610 - b * 0.32180189, r * 0.21147017 - g * 0.52261711 + b * 0.31114694];
    for (let i = 0; i < A.d.length; i += 4) {
      const blend = (d, k) => 255 + (d[i + k] - 255) * d[i + 3] / 255;
      const p = yiq(blend(A.d, 0), blend(A.d, 1), blend(A.d, 2)), q = yiq(blend(B.d, 0), blend(B.d, 1), blend(B.d, 2));
      const dy = p[0] - q[0], di = p[1] - q[1], dq = p[2] - q[2], delta = 0.5053 * dy * dy + 0.299 * di * di + 0.1957 * dq * dq;
      const bad = delta > max; if (bad) n++; if (A.d[i] !== B.d[i] || A.d[i + 1] !== B.d[i + 1] || A.d[i + 2] !== B.d[i + 2]) strict++;
      if (out) { const g = 255 - (A.d[i] + A.d[i + 1] + A.d[i + 2]) / 9; out[i] = bad ? 255 : g; out[i + 1] = bad ? 0 : g; out[i + 2] = bad ? 0 : g; out[i + 3] = 255; }
    }
    let diff = null;
    if (out) { const c = new OffscreenCanvas(A.w, A.h); c.getContext('2d').putImageData(new ImageData(out, A.w, A.h), 0, 0); const bl = await c.convertToBlob(); const u = new Uint8Array(await bl.arrayBuffer()); let s = ''; for (let k = 0; k < u.length; k += 32768) s += String.fromCharCode(...u.subarray(k, k + 32768)); diff = btoa(s); }
    return { pct: n / (A.w * A.h) * 100, strict: strict / (A.w * A.h) * 100, diff };
  }, [bufA.toString('base64'), bufB.toString('base64'), !!DIFF_DIR]);
  results.push({ name, pct: res.pct, strict: res.strict ?? 100 });
  if (DIFF_DIR) {
    const f = name.replace(/[^\w.-]+/g, '_');
    fs.writeFileSync(path.join(DIFF_DIR, f + '.proto.png'), bufA); fs.writeFileSync(path.join(DIFF_DIR, f + '.port.png'), bufB);
    if (res.diff) fs.writeFileSync(path.join(DIFF_DIR, f + '.diff.png'), Buffer.from(res.diff, 'base64'));
  }
  assert.ok(res.pct <= LIMIT, `${name}: ${res.pct.toFixed(3)}% differing pixels ${res.note || ''}`);
}
async function shotBoth(P, name, clip) {
  const [a, b] = await Promise.all(P.map(x => x.page.screenshot({ clip })));
  await compare(name, a, b);
}

// scroll through the whole board, let every piece land, and stop every ring
async function settleAll(P) {
  const h = await P[0].page.evaluate(() => document.documentElement.scrollHeight);
  const vh = P[0].page.viewportSize().height;
  for (let y = 0; y <= h; y += Math.round(vh / 2)) await scrollBoth(P, y);
  await settle(P);
}
// run every pending drop to the end. Twice: a batch's delayed call that fires during the first seek creates its
// slap timelines then, and only the second seek renders them.
async function settle(P) {
  for (let k = 0; k < 2; k++) await both(P, () => window.__P.seek(gsap.globalTimeline.time() + 30));
}

for (const vp of VIEWPORTS) {
  for (const theme of ['dark', 'light']) {
    const card = theme === 'light' ? 'white' : 'dark';
    test(`cutouts ${vp[0]}px, ${card} cards: entrance, scroll drops, settled wall, carousel beat, dialog`, async () => {
      const P = await pair(vp, theme);
      try {
        const vh = vp[1];
        // entrance at the top of the page: the pieces already in view drop in
        const t0 = (await both(P, () => gsap.globalTimeline.time()))[0];
        const clip0 = await clipOf(P[0].page);
        if (clip0.height > 0) for (const t of TIMES) { await both(P, t => window.__P.seek(t), t0 + t); await shotBoth(P, `${vp[0]} ${card} entrance t=${t}`, clip0); }
        await settle(P);
        // scroll-triggered drops at fixed scroll positions (board offset the same in both pages)
        const top = await boardTop(P[0].page);
        for (const d of [Math.round(vh * 0.6), Math.round(vh * 1.3)]) {
          await scrollBoth(P, top + d);
          const t1 = (await both(P, () => gsap.globalTimeline.time()))[0];
          const clip = await clipOf(P[0].page);
          if (clip.height <= 0) continue;
          for (const t of TIMES) { await both(P, t => window.__P.seek(t), t1 + t); await shotBoth(P, `${vp[0]} ${card} scroll+${d} t=${t}`, clip); }
          await settle(P);
        }
        // final settled state: the whole board
        await settleAll(P);
        await both(P, () => scrollTo(0, 0));
        const [a, b] = await Promise.all(P.map(x => x.page.locator('#board').screenshot()));
        await compare(`${vp[0]} ${card} settled (full board)`, a, b);
        // photo carousel: one beat of the shared 2.8 s timer, then the .8 s cross-fade
        await scrollBoth(P, top);
        for (const x of P) await x.page.clock.runFor(2800);
        await new Promise(r => setTimeout(r, 1100));
        await shotBoth(P, `${vp[0]} ${card} carousel beat`, await clipOf(P[0].page));
        // the offer dialog grows from the first piece whose top is in the upper half of the view
        const idx = await P[0].page.evaluate(() => [...window.__P.board().querySelectorAll('.piece:not(.slot)')].findIndex(p => { const r = p.getBoundingClientRect(); return r.top >= 0 && r.top <= innerHeight / 2; }));
        assert.ok(idx >= 0, 'a piece in view');
        await both(P, i => window.__P.board().querySelectorAll('.piece:not(.slot)')[i].click(), idx);
        const t2 = (await both(P, () => gsap.globalTimeline.time()))[0];
        const full = { x: 0, y: 0, width: vp[0], height: vh };
        for (const t of TIMES) { await both(P, t => window.__P.seek(t), t2 + t); await shotBoth(P, `${vp[0]} ${card} dialog t=${t}`, full); }
      } finally { for (const x of P) await x.ctx.close(); }
    });
  }
}

test('dialog interactions: close button, backdrop click, Claim calls onClaim', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}${HARNESS}?now=${NOW}`);
  await page.waitForFunction(() => window.__root && window.__root.querySelector('#board .piece'));
  const isOpen = () => page.evaluate(() => window.__root.getElementById('detail').open);
  await page.evaluate(() => window.__root.querySelector('#board .piece').click());
  assert.equal(await isOpen(), true);
  await page.evaluate(() => window.__root.getElementById('dClose').click());
  assert.equal(await isOpen(), false);
  await page.evaluate(() => window.__root.querySelector('#board .piece').click());
  assert.equal(await isOpen(), true);
  // a click whose target is the dialog itself (its backdrop area) closes it. Note: as in the prototype, GSAP's
  // first transform read on the fixed-position dialog briefly re-parents it, which drops its modal state, so the
  // opened dialog behaves as non-modal (no ::backdrop hit area, no Escape). Reproduced as-is for parity.
  await page.evaluate(() => window.__root.getElementById('detail').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.equal(await isOpen(), false);
  await page.evaluate(() => window.__root.querySelector('#board .piece').click());
  await page.evaluate(() => window.__root.querySelector('.cta').click());
  assert.equal((await page.evaluate(() => window.__claims)).length, 1);
  assert.equal(await page.evaluate(() => window.__root.querySelector('.claimbox')), null, 'no simulated claim code');
  await page.evaluate(() => window.__root.getElementById('dClose').click());
  assert.equal(await isOpen(), false);
  // destroy() kills only the wall's own ScrollTriggers and removes the wall
  const r = await page.evaluate(() => {
    const el = document.createElement('div'); el.style.height = '10px'; document.body.appendChild(el);
    const mine = ScrollTrigger.create({ trigger: el, start: 'top bottom' });
    const before = ScrollTrigger.getAll().length;
    window.__wall.destroy();
    return { before, after: ScrollTrigger.getAll().length, mineAlive: ScrollTrigger.getAll().includes(mine), wall: !!window.__root.querySelector('.cw') };
  });
  assert.ok(r.before > 1 && r.mineAlive && r.after === 1 && !r.wall, JSON.stringify(r));
  await ctx.close();
});

test('live coupon: no stock data means available with no counter; no end date means no expiry treatment', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}${HARNESS}?now=${NOW}&live=1`);
  await page.waitForFunction(() => window.__root && window.__root.querySelector('#board .piece'));
  const info = await page.evaluate(() => {
    const R = window.__root, pieces = [...R.querySelectorAll('#board .piece:not(.slot)')];
    const nb = pieces.find(p => p.getAttribute('aria-label').startsWith('Northbound'));
    const cv = pieces.find(p => p.getAttribute('aria-label').startsWith('Casa Verde'));
    const out = { nbLabel: nb.getAttribute('aria-label'), nbExp: !!nb.querySelector('.exp'), nbEdge: !!nb.querySelector('.edge'), cvText: cv.textContent, cvExp: !!cv.querySelector('.exp') };
    nb.click();
    out.dlgExp = !!R.querySelector('.drow .exp'); out.dEdge = R.getElementById('dEdge').className; out.cta = R.querySelector('.cta').textContent; out.ctaDisabled = R.querySelector('.cta').disabled;
    out.nbFacts = R.querySelector('.facts').textContent;
    R.getElementById('dClose').click(); cv.click();
    out.cvFacts = R.querySelector('.facts').textContent; out.cvCta = R.querySelector('.cta').disabled;
    return out;
  });
  assert.equal(info.nbLabel, 'Northbound Barbershop Cebu: ₱100 off a haircut, or a free beard trim with any cut.');
  assert.equal(info.nbExp, false); assert.equal(info.nbEdge, false); assert.equal(info.dlgExp, false); assert.equal(info.dEdge, 'dedge');
  assert.match(info.cta, /Claim offer/); assert.equal(info.ctaDisabled, false);
  assert.ok(!/of \d+ left|All claimed/.test(info.cvText), 'no counter on the piece: ' + info.cvText);
  assert.ok(info.cvText.includes('1 per ticket'));
  assert.ok(info.cvExp, 'a coupon with an end date keeps its sticker');
  assert.ok(!/Allocation|left/.test(info.cvFacts), 'no allocation counter in the dialog: ' + info.cvFacts);
  assert.equal(info.cvCta, false);
  assert.ok(!/Where/.test(info.nbFacts), 'the empty Where row is hidden: ' + info.nbFacts);
  // sponsors with no published offer
  const no = await page.evaluate(() => {
    const R = window.__root, pieces = [...R.querySelectorAll('#board .piece:not(.slot)')];
    const find = b => pieces.find(p => p.getAttribute('aria-label').startsWith(b));
    const dz = find('DESAINZ'), ps = find('Pets Society'), ac = find('Air Condo');
    const out = {
      dz: { tag: dz.tagName, href: dz.getAttribute('href'), target: dz.target, rel: dz.rel, text: dz.textContent, exp: !!dz.querySelector('.exp') },
      ps: { tag: ps.tagName, text: ps.textContent, arr: !!ps.querySelector('.arr') },
      ac: { tag: ac.tagName, text: ac.textContent },
    };
    R.getElementById('dClose').click(); out.closedBefore = !R.getElementById('detail').open;
    dz.addEventListener('click', e => e.preventDefault()); dz.click(); ps.click();
    out.dialogOpened = R.getElementById('detail').open;
    return out;
  });
  assert.equal(no.dz.tag, 'A'); assert.equal(no.dz.href, 'https://www.instagram.com/desainz_/'); assert.equal(no.dz.target, '_blank'); assert.equal(no.dz.rel, 'noopener noreferrer');
  assert.ok(no.dz.text.includes('Supporting sponsor') && no.dz.text.includes('↗') && !no.dz.exp, JSON.stringify(no.dz));
  assert.equal(no.ps.tag, 'DIV'); assert.ok(no.ps.text.includes('Sponsor') && !no.ps.arr && !/Visit site|claim/i.test(no.ps.text), JSON.stringify(no.ps));
  assert.equal(no.ac.tag, 'A'); assert.ok(no.ac.text.includes('Visit site') && !/claim|days/i.test(no.ac.text), JSON.stringify(no.ac));
  assert.ok(no.closedBefore); assert.equal(no.dialogOpened, false, 'no dialog for a sponsor without an offer');
  await ctx.close();
});
