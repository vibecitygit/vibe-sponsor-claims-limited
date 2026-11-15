/* Cut-out wall renderer (format key `cutouts`). Exact port of cutouts.html (branch claude/coupon-claim-interface-cb9xst):
   the prototype's own CSS and code, copied. Registers window.VCWallRenderers.cutouts per RENDERER-CONTRACT.md.

   Allowed changes made (contract list):
   1. Scope: document.getElementById(...) -> lookups inside the mounted wall (opts.root / container). The prototype's
      `html`/`body` rules (text-size-adjust, font, font smoothing, overflow-x) move to the wall's `.cw` wrapper inside the
      container; `overflow-x: hidden` becomes `overflow-x: clip` there so the wrapper does not turn into a scroll box
      (same clipping of the 1.9x drop as the prototype's body). The JS that painted document.body's background is
      removed (`.cw` paints the same colour). The `.cw` page-wrapper sizing (min-height: 100vh, safe-area padding)
      is dropped with the page. `#board` in the slap's board-shake tween is the board element itself.
      ScrollTrigger: the prototype killed every trigger on the page (ScrollTrigger.getAll()); this kills only the
      triggers it created (on re-render and in destroy()).
   2. Page chrome removed: header, nav tabs, intro, colour key, theme switcher, Replay button, spacing sliders and
      their outputs, footer note (and their CSS). Their behaviour stays: spacing comes from deck.wall.cutGap/cutPad,
      eased on narrow screens exactly as applySpace() did; card colour Dark/White comes from deck.wall (the
      prototype's Dark/White switch set wall.theme 'dark'/'light'; wall.cards 'white' also selects White).
   3. No storage: no DeckCore.load/save/subscribe, no localStorage claims. Data only comes from `deck`; update(deck)
      replaces the prototype's subscribe() path (prepare() then render()).
   4. No fake claims: no simulated claim code / claimbox; the Claim button calls opts.onClaim(id). Counters
      ("N of M left", meter) only when `remaining` and `total` are both numbers; otherwise the coupon is available
      and the piece shows what the prototype shows for an unlimited offer. Sold out only when both are numbers and
      remaining <= 0. Empty fields (where, dates, limit, terms, type, description) are hidden. A sponsor with no
      published offer (noOffer === true) shows its role in place of the offer text, links to its site in a new tab
      ('Visit site ↗') or has no action when there is no site, and never opens the dialog. A coupon with no end date (`to` empty) gets no expiry sticker, no expiry edge strip and is
      never counted as ended.
   5. Determinism: opts.now replaces Date.now() (and new Date() for the year fallback).
   6. No global GSAP settings are touched (the prototype sets none).
*/
(function () {
'use strict';

const CSS = `
/* Layout: a pinboard of magazine snip-offs. Always 3 columns (4 on wide screens) so pieces can vary
   in size: stub 1×1, voucher 1×2, ticket 2×1, magazine 2×2. Every piece sizes its type from its
   own width (container units), so the same grid works on a phone. Pieces slap down as they scroll
   into view. Paper keeps its own colours on both page themes. */
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
.cw {
  --bg: #0b0b0b; --grid: rgba(255,255,255,.045); --fg: #f5f2e9; --muted: #c9c5be; --line: rgba(255,255,255,.21); --border: #444; --panel: #1a1a1a;
  --brand: #ff4937; --brand-ink: #ff4937;
  /* expiry colour code: differs in lightness as well as hue, and always carries its words */
  --x-ok: #0f7440; --x-ok-ink: #ffffff; --x-soon: #f2b233; --x-soon-ink: #0b0b0b; --x-last: #ff4937; --x-last-ink: #0b0b0b; --x-done: #6b6660; --x-done-ink: #ffffff;
  --gutter: clamp(12px, 4.4vw, 72px); --ease: cubic-bezier(.23, 1, .32, 1);
  color-scheme: dark; display: flex; flex-direction: column; color: var(--fg);
  background: var(--bg) linear-gradient(var(--grid) 1px, transparent 1px) 0 0 / 100% 28px, linear-gradient(90deg, var(--grid) 1px, transparent 1px) 0 0 / 28px 100%;
  background-color: var(--bg);
  /* from the prototype's html/body rules */
  -webkit-text-size-adjust: 100%; margin: 0; font: 400 14px/1.4 "DM Sans", Arial, sans-serif; -webkit-font-smoothing: antialiased; overflow-x: clip;
}
.cw[data-theme="light"] { --bg: #f3f1ec; --grid: rgba(17,16,14,.05); --fg: #0b0b0b; --muted: #48433d; --line: rgba(17,16,14,.18); --border: rgba(17,16,14,.3); --panel: #ffffff; --brand-ink: #a54635; color-scheme: light; }
a { color: inherit; }
:focus-visible { outline: 3px solid var(--brand-ink); outline-offset: 3px; }
.label { font: 700 12px/1.25 "DM Sans", Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
.cap { font: 400 10px/1.4 "DM Sans", Arial, sans-serif; letter-spacing: .1em; text-transform: uppercase; }
.x-ok { background: var(--x-ok); color: var(--x-ok-ink); } .x-soon { background: var(--x-soon); color: var(--x-soon-ink); }
.x-last { background: var(--x-last); color: var(--x-last-ink); } .x-done { background: var(--x-done); color: var(--x-done-ink); }

/* ---------- The board: 3 columns at every width ---------- */
.board { row-gap: calc(var(--gap) + 8px); --cols: 3; --gap: 28px; --edge: 72px; --row: 140px; display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); grid-auto-rows: var(--row); grid-auto-flow: dense; gap: var(--gap); padding: max(16px, var(--edge) * .7) var(--edge) 90px; flex: 1; align-content: start; }
.cell { position: relative; min-width: 0; container-type: size; }
.cell { grid-column: span var(--w, 1); grid-row: span var(--h, 1); } /* each sponsor's size: columns x rows, capped by tier */
.piece { position: absolute; inset: 0; appearance: none; border: 0; padding: 0; margin: 0; font: inherit; text-align: left; cursor: pointer; display: block; color: inherit; text-decoration: none; background: none; will-change: transform; filter: drop-shadow(0 6px 12px rgba(0,0,0,.42)); }
.cw[data-theme="light"] .piece { filter: drop-shadow(0 5px 10px rgba(17,16,14,.22)); }
.paper { position: absolute; inset: 0; background: var(--p, #f5f2e9); color: var(--i, #0b0b0b); display: flex; flex-direction: column; overflow: hidden; transition: transform .22s var(--ease); }
.piece:hover .paper, .piece:focus-visible .paper { transform: translateY(-3%) scale(1.03); }
.piece:active .paper { transform: scale(.97); }
/* impact ring when a piece lands */
.cell::after { content: ""; position: absolute; inset: 6%; border-radius: 50%; pointer-events: none; opacity: 0; box-shadow: 0 0 0 0 rgba(255,255,255,.5); }
.cell.hit::after { animation: ring .5s ease-out; }
@keyframes ring { 0% { opacity: .7; box-shadow: 0 0 0 0 rgba(255,255,255,.55); } 100% { opacity: 0; box-shadow: 0 0 0 26px rgba(255,255,255,0); } }
.cw[data-theme="light"] .cell.hit::after { animation-name: ringd; }
@keyframes ringd { 0% { opacity: .5; box-shadow: 0 0 0 0 rgba(17,16,14,.35); } 100% { opacity: 0; box-shadow: 0 0 0 26px rgba(17,16,14,0); } }

/* paper stocks */
.k-news { --p: #efe9dc; --i: #14110d; background-image: radial-gradient(rgba(20,17,13,.13) 1px, transparent 1.3px); background-size: 6px 6px; }
.k-gloss { --p: #ffffff; --i: #0b0b0b; }
.k-kraft { --p: #c9a876; --i: #2a1a0c; }
.k-legal { --p: #ffe36e; --i: #1a1a2e; background-image: repeating-linear-gradient(0deg, transparent 0 17px, rgba(40,70,160,.28) 17px 18px); }
.k-pink { --p: #ff9db8; --i: #1c0810; }
.k-mint { --p: #bfe6d0; --i: #0c2318; }
.k-xerox { --p: #161616; --i: #f5f2e9; background-image: repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 2px, transparent 2px 5px); }
.k-brand { --p: var(--sponsor); --i: var(--sponsor-ink); }
/* cut shapes */
.c-torn { clip-path: polygon(0 3%, 6% 0.8%, 13% 3%, 21% 0.5%, 30% 2.6%, 40% 0.4%, 50% 2.4%, 61% 0.5%, 71% 2.7%, 81% 0.6%, 90% 2.5%, 100% 1%, 99% 20%, 100% 42%, 98.8% 63%, 100% 84%, 99.2% 100%, 88% 97.6%, 76% 99.6%, 63% 97.4%, 50% 99.5%, 37% 97.5%, 24% 99.6%, 12% 97.6%, 0.8% 99.4%, 0 80%, 1.2% 60%, 0 40%, 1% 20%); }
.c-angle { clip-path: polygon(2% 4%, 100% 0, 97% 97%, 0 100%); }
.c-notch { clip-path: polygon(0 0, 100% 0, 100% 42%, 95% 50%, 100% 58%, 100% 100%, 0 100%, 0 58%, 5% 50%, 0 42%); }
.c-zig { clip-path: polygon(0 0, 100% 0, 100% 96%, 95% 100%, 90% 96%, 85% 100%, 80% 96%, 75% 100%, 70% 96%, 65% 100%, 60% 96%, 55% 100%, 50% 96%, 45% 100%, 40% 96%, 35% 100%, 30% 96%, 25% 100%, 20% 96%, 15% 100%, 10% 96%, 5% 100%, 0 96%); }
.c-corner { clip-path: polygon(0 0, 86% 0, 100% 14%, 100% 100%, 0 100%); }
/* headline faces */
.f-anton { font-family: "Anton", Impact, sans-serif; text-transform: uppercase; letter-spacing: .01em; }
.f-abril { font-family: "Abril Fatface", Georgia, serif; --k: .9; }
.f-marker { font-family: "Permanent Marker", "Comic Sans MS", cursive; --k: .82; }
.f-type { font-family: "Special Elite", "Courier New", monospace; --k: .86; }
.f-rubik { font-family: "Rubik Mono One", Impact, sans-serif; text-transform: uppercase; --k: .7; }
.f-serif { font-family: "DM Serif Display", Georgia, serif; font-style: italic; }
.f-bang { font-family: "Bangers", Impact, sans-serif; letter-spacing: .03em; text-transform: uppercase; }
.f-barlow { font-family: "Barlow Condensed", Impact, sans-serif; font-weight: 900; text-transform: uppercase; }

/* shared bits. All sizes in container units so a piece reads the same at 110px or 400px wide. */
.logo { position: relative; flex: none; overflow: hidden; background: #fff; }
.logo.plate-dark { background: #0b0b0b; }
.logo img { position: absolute; top: 10%; left: 9%; width: 82%; height: 80%; object-fit: contain; }
.exp { position: absolute; z-index: 6; top: 0; right: 4%; transform: translateY(-38%) rotate(2.5deg); box-shadow: 0 2px 5px rgba(0,0,0,.35); display: inline-flex; align-items: center; gap: .35em; padding: .42em .7em .36em; font: 800 clamp(8px, 6.4cqi, 12px)/1 "DM Sans", Arial, sans-serif; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
.exp svg { width: 1.1em; height: 1.1em; flex: none; }
.edge { position: absolute; left: 0; right: 0; top: 0; height: clamp(4px, 2.6cqi, 8px); z-index: 3; }
.hl { margin: 0; line-height: 1.02; font-weight: 400; overflow: hidden; }
.arr { font: 700 clamp(10px, 8cqi, 16px)/1 "DM Sans", Arial, sans-serif; }
.feat { display: inline-block; background: var(--i); color: var(--p); font: 800 clamp(7px, 3.4cqi, 10px)/1 "DM Sans", Arial, sans-serif; letter-spacing: .1em; text-transform: uppercase; padding: .4em .6em; align-self: flex-start; }
.small { font: 700 clamp(7px, 3.2cqi, 11px)/1.2 "DM Sans", Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; opacity: .78; }
.tape { position: absolute; z-index: 5; width: 26%; height: 9%; background: rgba(255, 233, 150, .8); box-shadow: 0 1px 3px rgba(0,0,0,.25); }

/* --- stub 1×1 --- */
.stub .paper { padding: 11cqi 8cqi 7cqi; gap: 4cqi; }
.stub .logo { width: 46cqi; height: 26cqh; }
.stub .hl { font-size: calc(clamp(11px, 13cqi, 30px) * var(--k, 1)); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; }
.stub .arr { position: absolute; right: 7cqi; bottom: 6cqi; }
/* --- voucher 1×2 --- */
.voucher .paper { padding: 5cqi; }
.voucher .cut { flex: 1; min-height: 0; border: clamp(1px, .9cqi, 2px) dashed currentColor; padding: 12cqi 6cqi 6cqi; display: flex; flex-direction: column; gap: 5cqi; }
.voucher .logo { width: 100%; height: 22cqh; }
.voucher .hl { font-size: calc(clamp(13px, 17cqi, 40px) * var(--k, 1)); display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; }
.voucher .bars { margin-top: auto; height: 8cqh; background: repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 5px, currentColor 5px 6px, transparent 6px 10px, currentColor 10px 13px, transparent 13px 15px); opacity: .85; flex: none; }
.voucher .row { display: flex; align-items: center; justify-content: space-between; gap: 2cqi; }
/* --- ticket 2×1 --- */
.ticket .paper { flex-direction: row; }
.ticket .logo { width: 27cqi; align-self: stretch; }
.ticket .main { flex: 1; min-width: 0; padding: 9cqh 3.4cqi 6cqh; display: flex; flex-direction: column; gap: 3cqh; }
.ticket .hl { font-size: calc(clamp(12px, min(6.8cqi, 17cqh), 40px) * var(--k, 1)); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.ticket .main > :last-child, .ticket .main > .small { margin-top: auto; } .ticket .main > .small + .meter { margin-top: 0; }
.ticket .tear { width: 19cqi; flex: none; border-left: clamp(1px, .5cqi, 2px) dashed currentColor; padding: 10cqh 2cqi 6cqh; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; }
.ticket .tear strong { font: 900 clamp(18px, 11cqi, 64px)/.9 "Barlow Condensed", Impact, sans-serif; }
.ticket .meter { height: clamp(2px, 1cqi, 4px); background: color-mix(in srgb, currentColor 25%, transparent); }
.ticket .meter i { display: block; height: 100%; background: var(--brand); }
/* --- magazine 2×2 --- */
.magazine .paper { padding: 6cqi 4.5cqi 4cqi; gap: 2.4cqi; }
.magazine .mast { display: flex; align-items: baseline; justify-content: space-between; gap: 2cqi; border-bottom: clamp(2px, .7cqi, 4px) solid currentColor; padding: 0 0 .8cqi 0; }
.magazine .mast strong { font: 900 clamp(11px, 5.4cqi, 30px)/1 "Barlow Condensed", Impact, sans-serif; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.magazine .photo { position: relative; flex: 1.25; min-height: 0; border: clamp(3px, 1.4cqi, 7px) solid #fff; box-shadow: 0 3px 10px rgba(0,0,0,.3); transform: rotate(1.4deg); overflow: hidden; background: #fff; margin: 1cqi 2cqi 0; }
.magazine .photo img.ph { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .8s ease; }
.magazine .photo img.ph.on { opacity: 1; }
.magazine .photo .logo { position: absolute; inset: 0; }
.magazine .chip { position: absolute; left: 3%; bottom: 5%; width: 24%; height: 26%; z-index: 2; box-shadow: 0 1px 6px rgba(0,0,0,.35); }
.magazine .hl { font-size: 0; display: flex; flex-wrap: wrap; gap: 1.2cqi 1cqi; align-items: center; flex: none; overflow: visible; }
.magazine .hl span { font-size: calc(clamp(13px, 7.4cqi, 44px) * var(--k, 1)); line-height: 1; padding: .12em .26em .06em; background: var(--i); color: var(--p); display: inline-block; }
.magazine .hl span:nth-child(3n+2) { background: var(--brand); color: #0b0b0b; transform: rotate(-2deg); }
.magazine .hl span:nth-child(3n) { background: #fff; color: #0b0b0b; transform: rotate(1.6deg); box-shadow: 0 1px 4px rgba(0,0,0,.25); }
.magazine .hl span:nth-child(4n+1) { transform: rotate(1deg); }
.magazine .foot { display: flex; align-items: center; justify-content: space-between; gap: 2cqi; flex: none; }
.magazine .desc { margin: 0; font-size: clamp(11px, 3.1cqi, 15px); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
@container (max-width: 300px) { .magazine .desc { display: none; } }
.magazine .t1 { top: 13%; left: 3%; transform: rotate(-30deg); } .magazine .t2 { top: 12%; right: 20%; transform: rotate(22deg); }
/* --- open slot snip --- */
.slot .paper { --p: transparent; --i: var(--fg); border: clamp(1px, 1cqi, 2px) dashed var(--muted); padding: 9cqi 8cqi; justify-content: space-between; }
.slot .hl { font-size: clamp(11px, 13cqi, 28px); }
.piece.slot { filter: none; }

/* ---------- Detail ---------- */
dialog { position: fixed; inset: 0; margin: auto; width: min(680px, calc(100vw - 24px)); height: fit-content; max-height: calc(100vh - 24px); padding: 0; border: 0; background: #f5f2e9; color: #0b0b0b; box-shadow: 0 24px 90px rgba(0,0,0,.5); overflow: hidden; z-index: 1000; }
dialog::backdrop { background: rgba(0,0,0,.62); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
dialog[open] { display: flex; flex-direction: column; }
.dedge { height: 10px; flex: none; }
.dhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 10px 10px 22px; border-bottom: 2px dashed rgba(17,16,14,.28); }
.dhead p { margin: 0; font: 800 20px/1 "Barlow Condensed", Impact, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
.x { appearance: none; background: none; border: 0; cursor: pointer; color: #48433d; font: 400 22px/1 "DM Sans", Arial, sans-serif; width: 44px; height: 44px; }
.dbody { overflow: auto; min-height: 0; padding: 20px 22px 24px; display: grid; gap: 14px; }
.dbody h2 { margin: 0; font-size: clamp(30px, 6vw, 46px); line-height: 1.02; font-weight: 400; }
.dbody p { margin: 0; color: #2a2622; }
.drow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.drow .exp { position: static; font-size: 11px; transform: none; box-shadow: none; }
.facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; }
.facts div { background: #ebe7df; padding: 10px 12px; min-width: 0; } .facts dt { color: #48433d; } .facts dd { margin: 3px 0 0; font-weight: 600; }
.terms { margin: 0; padding-left: 18px; display: grid; gap: 6px; color: #2a2622; }
.cta { appearance: none; cursor: pointer; border: 0; background: #ff4937; color: #0b0b0b; font: 800 14px/1 "DM Sans", Arial, sans-serif; letter-spacing: .09em; text-transform: uppercase; padding: 15px 20px; display: inline-flex; gap: 28px; align-items: center; justify-content: space-between; min-height: 46px; justify-self: start; }
.cta[disabled] { background: #ebe7df; color: #48433d; cursor: default; }

@media (max-width: 560px) { .facts { grid-template-columns: minmax(0, 1fr); } .label { font-size: 11px; } }
/* a photo (or a carousel of them) where the logo would sit, with the logo kept as a chip in the corner */
.piece .logo.shot { background: #fff; }
.piece .logo.shot img.ph { position: absolute; inset: 0; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .8s ease; }
.piece .logo.shot img.ph.on { opacity: 1; }
.piece .shot .logo.chip { position: absolute; inset: auto auto 0 0; width: 40%; height: 40%; max-width: 84px; max-height: 60px; z-index: 2; background: #fff; }
.piece .shot .logo.chip.plate-dark { background: #0b0b0b; }
@media (prefers-reduced-motion: reduce) { .piece .logo.shot img.ph { transition: none; } }
@media (prefers-reduced-motion: reduce) { .paper { transition: none; } .cell.hit::after { animation: none; } .magazine .photo img.ph { transition: none; } }
`;

const FONTS = ['https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Anton&family=Bangers&family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@400;500;700;800&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;700&family=Permanent+Marker&family=Rubik+Mono+One&family=Special+Elite&display=swap'];

function mount(container, deckIn, opts) {
  opts = opts || {};
  const D = window.DeckCore;
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || !hasGsap;
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  const nowMs = () => (typeof opts.now === 'number' ? opts.now : Date.now());
  let deck = deckIn, dead = false, myTriggers = [];

  function h(tag, cls, text, attrs) { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]); return el; }
  const add = (p, ...kids) => { kids.forEach(k => k && p.appendChild(k)); return p; };

  // the wall's own markup (the prototype's .cw wrapper, board and dialog; page chrome removed)
  const cw = h('div', 'cw', null, { id: 'cw', 'data-theme': 'dark' });
  const board = h('main', 'board', null, { id: 'board' });
  const dlg = h('dialog', null, null, { id: 'detail', 'aria-labelledby': 'dTitle' });
  const dEdge = h('div', 'dedge', null, { id: 'dEdge' }), dTitle = h('p', null, null, { id: 'dTitle' }), dClose = h('button', 'x', '×', { id: 'dClose', 'aria-label': 'Close offer' }), dBody = h('div', 'dbody', null, { id: 'dBody' });
  add(dlg, dEdge, add(h('div', 'dhead'), dTitle, dClose), dBody);
  add(cw, board, dlg);
  container.appendChild(cw);

  // a sponsor without a published offer (noOffer) shows its role where the offer text would be
  const headline = c => (c.noOffer === true ? String(c.role || '') : c.short.replace(/\.$/, ''));
  const linkOnly = c => c.noOffer === true;
  const siteOf = c => (typeof c.site === 'string' && /^https?:\/\//i.test(c.site) ? c.site : '');
  // the piece's ↗ arrow: kept for offers and for sponsors with a site to visit
  const arrow = c => (!linkOnly(c) || siteOf(c) ? h('span', 'arr', '↗', { 'aria-hidden': 'true' }) : null);
  const small = v => (v ? h('span', 'small', v) : null); // empty values are hidden
  const num = i => String(i + 1).padStart(2, '0');
  const hasEnd = c => typeof c.to === 'string' && c.to !== '';
  const counted = c => typeof c.remaining === 'number' && typeof c.total === 'number';
  const soldOut = c => counted(c) && c.remaining <= 0;
  function endDate(c) { const y = parseInt(c.year, 10) || new Date(nowMs()).getFullYear(), fm = +c.from.slice(0, 2) || 1, tm = +c.to.slice(0, 2) || 12, td = +c.to.slice(3) || 28; return new Date(y + (tm < fm ? 1 : 0), tm - 1, td, 23, 59, 59); }
  const daysLeft = c => Math.ceil((endDate(c) - nowMs()) / 86400000);
  /* expiry colour code (null: no end date, no expiry treatment) */
  function expState(c) { if (!hasEnd(c)) return null; const d = daysLeft(c); return d < 0 ? ['x-done', 'Ended'] : d <= 1 ? ['x-last', 'Ends today'] : d <= 7 ? ['x-last', `${d} days left`] : d <= 14 ? ['x-soon', `${d} days left`] : ['x-ok', `${d} days`]; }
  function expTag(c) {
    const st = expState(c); if (!st) return null;
    const [cls, text] = st, el = h('span', 'exp ' + cls);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 4.6V8l2.3 1.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>';
    return add(el, svg, h('span', null, text));
  }
  function logo(c, cls) { const plate = D.plateFor(c, 'light'); return add(h('span', 'logo' + (cls ? ' ' + cls : '') + (plate ? ' plate-' + plate : '')), h('img', null, null, { src: c._logo, alt: '' })); }
  const photos = D.photosFor;
  function inkFor(hex) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 150 ? '#0b0b0b' : '#ffffff'; }

  /* each sponsor always gets the same paper, cut and typeface, picked from its id */
  const STOCKS = ['k-news', 'k-legal', 'k-gloss', 'k-kraft', 'k-pink', 'k-xerox', 'k-mint', 'k-brand'];
  const CUTS = { stub: ['c-notch', 'c-angle', 'c-corner', 'c-torn'], voucher: ['c-zig', 'c-corner'], ticket: ['c-notch', 'c-angle'], magazine: ['c-torn'] };
  const FACES = ['f-anton', 'f-abril', 'f-marker', 'f-type', 'f-rubik', 'f-serif', 'f-bang', 'f-barlow'];
  const look = (c, i) => { const hsh = D.hashStr(c.id); return { stock: STOCKS[(i * 3 + hsh) % STOCKS.length], cut: CUTS[c.style][hsh % CUTS[c.style].length], face: FACES[(i * 5 + hsh) % FACES.length], tilt: ((hsh % 9) - 4) * (c.style === 'magazine' ? 0.25 : 0.6) }; };

  let cars = [];
  /* the sponsor's photos in the logo's place (a carousel when the tier allows more than one), or the logo when there are none */
  function shot(c, chip) {
    const ph = photos(c); if (!ph.length) return logo(c);
    const el = h('span', 'logo shot');
    ph.forEach((src, k) => add(el, h('img', 'ph' + (k === 0 ? ' on' : ''), null, { src, alt: '' })));
    if (chip !== false) { const l = logo(c); l.classList.add('chip'); add(el, l); }
    if (ph.length > 1) cars.push({ el, n: ph.length, at: 0 });
    return el;
  }
  const BUILD = {
    stub(c, i, L) { return add(h('span', `paper ${L.stock} ${L.cut}`), shot(c), h('h3', 'hl ' + L.face, headline(c)), arrow(c)); },
    voucher(c, i, L) {
      const cut = h('span', 'cut');
      add(cut, shot(c), c.featured && D.TIERS[c.tier].badge ? h('span', 'feat', 'Featured') : null, h('h3', 'hl ' + L.face, headline(c)), h('span', 'bars', null, { 'aria-hidden': 'true' }),
        add(h('span', 'row'), small(linkOnly(c) ? (siteOf(c) ? 'Visit site' : '') : 'Cut & claim'), arrow(c)));
      return add(h('span', `paper ${L.stock} ${L.cut}`), cut);
    },
    ticket(c, i, L) {
      const main = h('span', 'main');
      add(main, c.featured && D.TIERS[c.tier].badge ? h('span', 'feat', 'Featured') : null, h('h3', 'hl ' + L.face, headline(c)));
      if (c.limited && counted(c)) { const m = h('span', 'meter'), bar = h('i'); bar.style.width = Math.max(3, c.remaining / c.total * 100) + '%'; add(main, h('span', 'small', c.remaining > 0 ? `${c.remaining} of ${c.total} left` : 'All claimed'), add(m, bar)); }
      else add(main, h('span', 'small', c.brand));
      return add(h('span', `paper ${L.stock} ${L.cut}`), shot(c), main, add(h('span', 'tear'), h('span', 'small', 'Admit'), h('strong', null, num(i)), arrow(c)));
    },
    magazine(c, i, L) {
      const paper = h('span', `paper ${L.stock} ${L.cut}`), photo = h('span', 'photo'), ph = photos(c);
      if (ph.length) { ph.forEach((src, k) => add(photo, h('img', 'ph' + (k === 0 ? ' on' : ''), null, { src, alt: '' }))); add(photo, logo(c, 'chip')); if (ph.length > 1) cars.push({ el: photo, n: ph.length, at: 0 }); }
      else add(photo, logo(c));
      const hl = h('h3', 'hl'); headline(c).split(' ').forEach((w, k) => add(hl, h('span', FACES[(k * 3 + i) % FACES.length], w)));
      const foot = h('span', 'foot');
      add(foot, small(c.limited && counted(c) ? (c.remaining > 0 ? `${c.remaining} of ${c.total} left` : 'All claimed') : c.limit), small(linkOnly(c) ? (siteOf(c) ? 'Visit site ↗' : '') : 'Claim ↗'));
      return add(paper, add(h('span', 'mast'), h('strong', null, c.brand), c.featured ? h('span', 'small', 'Featured') : null),
        h('span', 'tape t1', null, { 'aria-hidden': 'true' }), h('span', 'tape t2', null, { 'aria-hidden': 'true' }), photo, hl, c.long ? h('p', 'desc', c.long) : null, foot);
    },
  };
  const area = c => c.cols * c.rows;
  const SLOTS = ['Your logo here', 'This snip could be yours', 'Sponsor this spot', 'Open slot'];

  function colsNow() { return 3; }
  const themeOf = w => (w.theme === 'light' || w.cards === 'white' ? 'light' : 'dark');
  function killMine() { myTriggers.forEach(t => t.kill()); myTriggers = []; }
  function render() {
    if (dead) return;
    if (hasGsap) { killMine(); gsap.killTweensOf(board.querySelectorAll('.piece')); }
    board.replaceChildren(); cars = [];
    cw.dataset.theme = themeOf(deck.wall);
    const list = deck.coupons.slice(0, deck.count).map((c, i) => ({ c, i })).sort((a, b) => area(b.c) - area(a.c) || b.c.cols - a.c.cols || a.i - b.i); // bigger pieces first, so the board packs
    list.forEach(({ c, i }) => {
      const L = look(c, i), cell = h('div', 'cell s-' + c.style, null, { style: `--w:${c.cols};--h:${c.rows}` }), st = expState(c);
      const label = `${c.brand}: ${headline(c)}.` + (st ? ` ${st[1]}.` : '');
      // no published offer: the piece links to the sponsor's site (new tab) or is not interactive; no dialog
      const piece = !linkOnly(c) ? h('button', 'piece ' + c.style, null, { type: 'button', 'aria-label': label })
        : siteOf(c) ? h('a', 'piece ' + c.style, null, { href: siteOf(c), target: '_blank', rel: 'noopener noreferrer', 'aria-label': label + ' Visit site.' })
        : h('div', 'piece ' + c.style, null, { role: 'group', 'aria-label': label, style: 'cursor:default' });
      piece.dataset.tilt = L.tilt; piece.style.setProperty('--sponsor', c.color); piece.style.setProperty('--sponsor-ink', inkFor(c.color));
      const paper = BUILD[c.style](c, i, L);
      if (st) add(paper, h('span', 'edge ' + st[0], null, { 'aria-hidden': 'true' }));
      if (!linkOnly(c)) piece.addEventListener('click', () => openDetail(i, piece));
      add(board, add(cell, add(piece, paper, expTag(c)))); // the expiry sticker sits on top of the piece, outside its cut edge
    });
    // fill the last row with open-slot snips so the board ends square
    if (deck.wall.openSlots) {
      const cols = colsNow(), units = list.reduce((n, o) => n + area(o.c), 0), fill = (cols - units % cols) % cols;
      for (let k = 0; k < fill; k++) {
        const cell = h('div', 'cell s-stub'), a = h('a', 'piece slot', null, { href: 'https://sponsor.vibecity.art', target: '_blank', rel: 'noopener noreferrer' }); a.dataset.tilt = (k % 2 ? 1.2 : -1.2);
        add(board, add(cell, add(a, add(h('span', 'paper'), h('h3', 'hl ' + FACES[(k * 2 + 2) % FACES.length], SLOTS[k % SLOTS.length]), h('span', 'small', 'Sponsor us ↗')))));
      }
    }
    sizeRows(); arm();
  }
  /* spacing is set in desktop pixels and eases down on narrow screens so three columns always fit */
  function applySpace() {
    const b = board, k = Math.min(1, Math.max(0.4, innerWidth / 1000)), gap = Math.round(deck.wall.cutGap * k), pad = Math.round(deck.wall.cutPad * k);
    b.style.setProperty('--gap', gap + 'px'); b.style.setProperty('--edge', pad + 'px');
  }
  function sizeRows() { applySpace(); const b = board, cs = getComputedStyle(b), cols = colsNow(), gap = parseFloat(cs.columnGap) || 0, w = b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); b.style.setProperty('--row', Math.round((w - gap * (cols - 1)) / cols * 1.16) + 'px'); }

  /* ---------- The slap: each piece drops from above the page, hits, squashes and settles ---------- */
  function slap(piece, delay) {
    if (dead || !piece.isConnected) return;
    const tilt = +piece.dataset.tilt || 0, cell = piece.parentElement;
    gsap.timeline({ delay })
      .fromTo(piece, { autoAlpha: 0, scale: 1.9, y: -90, rotation: tilt + gsap.utils.random(-16, 16), transformOrigin: '50% 50%' },
        { autoAlpha: 1, scale: 1, y: 0, rotation: tilt, duration: 0.26, ease: 'power4.in' })
      .add(() => { cell.classList.remove('hit'); void cell.offsetWidth; cell.classList.add('hit'); gsap.fromTo(board, { y: 3 }, { y: 0, duration: 0.2, ease: 'power2.out', overwrite: true }); })
      .to(piece, { scaleX: 1.05, scaleY: 0.95, duration: 0.05, ease: 'power1.out' })
      .to(piece, { scaleX: 1, scaleY: 1, duration: 0.42, ease: 'elastic.out(1, 0.38)' });
  }
  function arm() {
    const pieces = [...board.querySelectorAll('.piece')];
    if (reduced) { pieces.forEach(p => { p.style.transform = `rotate(${p.dataset.tilt || 0}deg)`; }); return; }
    gsap.set(pieces, { autoAlpha: 0 });
    myTriggers = ScrollTrigger.batch(pieces, { start: 'top 92%', once: true, interval: 0.08, onEnter: batch => batch.forEach((p, k) => slap(p, k * 0.09)) });
    ScrollTrigger.refresh();
  }

  /* magazine photos change on a slow shared beat */
  let beat = 0;
  const beatTimer = setInterval(() => { if (document.hidden || reduced || !cars.length || dlg.open) return; const car = cars[beat++ % cars.length]; if (!car.el.isConnected) return; car.at = (car.at + 1) % car.n; car.el.querySelectorAll('.ph').forEach((im, k) => im.classList.toggle('on', k === car.at)); }, 2800);

  /* ---------- Detail ---------- */
  function openDetail(i, from) {
    const c = deck.coupons[i], L = look(c, i), st = expState(c);
    dTitle.textContent = `${D.STYLES[c.style]} · ${c.brand}`;
    dEdge.className = 'dedge' + (st ? ' ' + st[0] : '');
    const fill = () => {
      const body = dBody; body.replaceChildren();
      const lim = c.limited && counted(c);
      // rows whose value is empty are hidden
      const rows = [['Where', c.where], ['Valid', c.from || c.to || c.year ? `${c.from} – ${c.to} · ${c.year}` : ''], [lim ? 'Allocation' : 'Limit', lim ? `${c.remaining} of ${c.total} left` : c.limit]].filter(([, v]) => v);
      const facts = rows.length ? h('dl', 'facts') : null; rows.forEach(([k, v]) => add(facts, add(h('div'), h('dt', 'cap', k), h('dd', null, v))));
      const tl = (c.terms || []).filter(Boolean), terms = tl.length ? h('ol', 'terms') : null; tl.forEach(t => add(terms, h('li', null, t)));
      const gone = (c.limited && soldOut(c)) || (hasEnd(c) && daysLeft(c) < 0), action = h('button', 'cta', null, { type: 'button' });
      add(action, h('span', null, gone ? 'No longer available' : 'Claim offer'), h('span', null, '↗', { 'aria-hidden': 'true' })); action.disabled = gone;
      action.addEventListener('click', () => { if (typeof opts.onClaim === 'function') opts.onClaim(c.id); });
      add(body, add(h('div', 'drow'), expTag(c), c.type ? h('span', 'label', c.type === 'Option' ? 'Choice' : c.type) : null, h('span', 'cap', D.TIERS[c.tier].name)), h('h2', L.face, headline(c)), c.long ? h('p', null, c.long) : null, facts, terms ? h('span', 'cap', 'How to claim') : null, terms, action);
    };
    fill();
    if (!dlg.open) dlg.showModal();
    if (reduced) return;
    const to = dlg.getBoundingClientRect(), fr = from.getBoundingClientRect();
    gsap.fromTo(dlg, { x: fr.left - to.left, y: fr.top - to.top, scaleX: fr.width / to.width, scaleY: fr.height / to.height, transformOrigin: '0 0' }, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.42, ease: 'expo.out', clearProps: 'transform' });
    gsap.fromTo([dlg.querySelector('.dhead'), dBody], { opacity: 0 }, { opacity: 1, duration: 0.26, delay: 0.12 });
  }
  dClose.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  function prepare() { return Promise.all(deck.coupons.map(D.loadImg)).then(() => deck.coupons.forEach(c => { c._logo = (c._img ? D.drawUploadedLogo(c._img) : D.drawLogo(c)).toDataURL(); })); }
  let lastCols = colsNow(), rt;
  const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { if (dead) return; if (colsNow() !== lastCols) { lastCols = colsNow(); render(); } else { sizeRows(); if (hasGsap) ScrollTrigger.refresh(); } }, 120); };
  addEventListener('resize', onResize);
  const ready = (async () => {
    try { await Promise.race([Promise.all(['400 30px "Anton"', '400 30px "Abril Fatface"', '400 30px "Permanent Marker"', '400 30px "Rubik Mono One"'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* fallback fonts */ }
    await prepare(); render();
  })();

  return {
    ready,
    update(d) { deck = d; return prepare().then(render); },
    destroy() {
      dead = true; clearInterval(beatTimer); clearTimeout(rt); removeEventListener('resize', onResize);
      if (hasGsap) { killMine(); gsap.killTweensOf([...board.querySelectorAll('.piece'), board, dlg, dlg.querySelector('.dhead'), dBody]); }
      if (dlg.open) dlg.close();
      cw.remove();
    },
  };
}

window.VCWallRenderers = window.VCWallRenderers || {};
window.VCWallRenderers.cutouts = { css: CSS, fonts: FONTS, needs: ['gsap', 'ScrollTrigger'], mount };
})();
