/* Voucher wall renderer (format 'vouchers'). An exact port of vouchers.html (branch claude/coupon-claim-interface-cb9xst):
   the prototype's own CSS and code, copied. Registers window.VCWallRenderers.vouchers per RENDERER-CONTRACT.md.
   Needs window.DeckCore (deck-core.js) and GSAP 3.12.5. The host injects `css` into the ShadowRoot and loads `fonts`.

   Allowed changes made (contract list):
   1. Scope: getElementById -> lookups inside the mounted wall (opts.root/container). The page `body` rule (font, smoothing)
      and `html` text-size-adjust moved onto the wall's container `.vw`; the prototype's inline `body.style.background`
      write is dropped (the `.vw` container already paints the same background). fit() picks the layout width from the
      viewport exactly as the prototype (so it agrees with the viewport media queries) and scales to the wall's own width
      (equal to the viewport when the wall spans the page, as in the prototype). The window `resize` listener is removed
      in destroy(); the carousel interval is cleared in destroy().
   2. Page chrome removed: header/tabs, intro, tier legend, tier filter and theme bar (buildChrome/syncBars and their CSS,
      the tier filter is fixed at 'all' = the prototype's default view), footer note, `html.preview` rules,
      `.seg button:active` (kept `.piece:active`). Card colour comes from deck.wall.cards ('white' -> the prototype's
      White theme, else Dark) instead of the theme toggle.
   3. No storage: no DeckCore.load/save/subscribe, no localStorage claims; update(deck) replaces the subscribe callback.
   4. No fake claims: claim codes, the "Claimed · show code" label, the Claimed stamp and the claim box are removed; the
      Claim button calls opts.onClaim(id). Coupons whose remaining/total are not both numbers are treated as available and
      show no counter/meter (the allocation reads as the open-limit line); a coupon is sold out only when both are numbers
      and remaining <= 0. A coupon with no end date (to === '') shows no expiry label, glow or "Ended", and the detail
      omits its Valid fact. The ticket stub serial omits the total when it is missing. Missing `limit` text is not printed.
   5. Determinism: opts.now replaces Date.now() (expiry). opts.rotation is not used (this wall has no rotation).
   6. No global GSAP settings are touched (the prototype sets none).
   Live data (integrator additions; SAMPLE renders exactly as before): empty fields are hidden (type label, offer text,
   where/valid/limit facts, terms with their "How to claim" caption). A coupon with noOffer === true shows its `role` in
   place of the offer headline, no allocation and no claim; the piece is a link to `site` (new tab, rel noopener
   noreferrer) labelled "Visit site ↗", or a plain piece with no action when there is no site; it never opens the dialog
   (this wall's dialog has no prev/next). CSS added for that: `a.piece` loses the link underline; `.piece.static` has
   the default cursor. DeckCore.sanitize is never called here.
*/
(function () {
'use strict';
const CSS = `
*, *::before, *::after { box-sizing: border-box; }
.vw { margin: 0; font: 400 14px/1.4 "DM Sans", Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; }
[hidden] { display: none !important; }
.vw {
  --bg: #0b0b0b; --panel: #1a1a1a; --border: #444444; --line: rgba(255,255,255,.21); --fg: #f5f2e9; --muted: #c9c5be;
  --brand: #ff4937; --brand-ink: #ff4937; --on-brand: #0b0b0b;
  --paper: #f5f2e9; --paper-2: #ebe7df; --ink: #0b0b0b; --ink-soft: #2a2622; --ink-muted: #48433d; --rule: rgba(17,16,14,.28); --paper-brand: #a54635;
  --shadow: 0 10px 30px rgba(0,0,0,.45);
  --display: "Barlow Condensed", Impact, "Arial Narrow", sans-serif; --mono: "JetBrains Mono", ui-monospace, monospace;
  --ease: cubic-bezier(.23, 1, .32, 1); --gutter: clamp(20px, 5.4vw, 83px);
  /* Port change: drawn as a wall on a host page (as the offer wall port does with the prototype's #embed mode): no page
     background, full-screen height or safe-area padding, so the site's own background shows through. */
  color-scheme: dark; display: flex; flex-direction: column; color: var(--fg);
}
.vw[data-theme="light"] { --bg: #ffffff; --panel: #f5f2e9; --border: rgba(17,16,14,.3); --line: rgba(17,16,14,.16); --fg: #0b0b0b; --muted: #48433d; --brand-ink: #a54635;
  --paper: #fbfaf6; --shadow: 0 10px 28px rgba(17,16,14,.16); color-scheme: light; }
a { color: inherit; }
:focus-visible { outline: 2px solid var(--brand-ink); outline-offset: 3px; }
.label { font: 700 12px/1.25 "DM Sans", Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
.cap { font: 400 10px/1.4 "DM Sans", Arial, sans-serif; letter-spacing: .1em; text-transform: uppercase; }
.mono { font: 400 11px/1.4 var(--mono); font-variant-numeric: tabular-nums; }
.disp { font-family: var(--display); font-weight: 900; text-transform: uppercase; line-height: .98; margin: 0; }

.piece:active { transform: scale(.985); }
a.piece { text-decoration: none; } .piece.static { cursor: default; } /* live sponsors without an offer (not in the prototype) */

/* ---------- The grid ---------- */
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: 210px; grid-auto-flow: dense; gap: 22px; padding: 26px var(--gutter) 72px; flex: 1; align-content: start; }
.cell { min-width: 0; display: flex; }
.cell { grid-column: span var(--w, 1); grid-row: span var(--h, 1); } /* each sponsor's size: columns x rows, capped by tier */
.piece { appearance: none; border: 0; padding: 0; margin: 0; font: inherit; text-align: left; cursor: pointer; color: var(--ink); width: 100%; position: relative; display: flex;
  filter: drop-shadow(0 8px 18px rgba(0,0,0,.38)); transition: transform .28s var(--ease), filter .28s var(--ease); }
.vw[data-theme="light"] .piece { filter: drop-shadow(0 6px 14px rgba(17,16,14,.18)); }
.piece:hover { transform: translateY(-4px) rotate(var(--tilt, 0deg)); filter: drop-shadow(0 16px 26px rgba(0,0,0,.5)); }
.vw[data-theme="light"] .piece:hover { filter: drop-shadow(0 14px 22px rgba(17,16,14,.26)); }
.paper { background: var(--paper); color: var(--ink); width: 100%; position: relative; display: flex; min-width: 0; }
.logo { display: grid; place-items: center; overflow: hidden; flex: none; position: relative; }
.logo img { position: absolute; top: 12%; left: 12%; width: 76%; height: 76%; object-fit: contain; }
.logo.plate-dark { background: #0b0b0b; }
.tierchip { font: 700 9px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-muted); }
.badge { align-self: flex-start; background: var(--ink); color: var(--paper); font: 700 10px/1.4 "DM Sans", Arial, sans-serif; letter-spacing: .1em; text-transform: uppercase; padding: 4px 8px; }
.type { color: var(--paper-brand); }
.ends { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; color: var(--ink-muted); }
.ends svg { width: 11px; height: 11px; flex: none; }
.ends.soon { background: var(--brand); color: var(--on-brand); padding: 3px 7px; font-weight: 700; }
.claimed-mark { color: var(--paper-brand); font-weight: 700; }
.alloc { display: grid; gap: 4px; }
.alloc .meter { height: 4px; background: var(--rule); }
.alloc .meter i { display: block; height: 100%; background: var(--brand); }
.go { display: inline-flex; align-items: center; gap: 8px; font: 800 12px/1 "DM Sans", Arial, sans-serif; letter-spacing: .09em; text-transform: uppercase; }
.go .arr { transition: transform .25s var(--ease); }
.piece:hover .go .arr { transform: translate(2px, -2px); }
@keyframes expGlow { 0%, 100% { filter: drop-shadow(0 0 6px rgba(255,73,55,.35)) drop-shadow(0 8px 18px rgba(0,0,0,.38)); } 50% { filter: drop-shadow(0 0 16px rgba(255,73,55,.7)) drop-shadow(0 8px 18px rgba(0,0,0,.38)); } }
.piece.expiring { animation: expGlow 2.6s ease-in-out infinite; }

/* --- Stub: a small tear-off with a perforated end --- */
.stub .paper { padding: 0; --n: 9px;
  -webkit-mask: radial-gradient(circle var(--n) at 0 50%, #0000 97%, #000) 0 0 / 51% 100% no-repeat, radial-gradient(circle var(--n) at 100% 50%, #0000 97%, #000) 100% 0 / 51% 100% no-repeat;
          mask: radial-gradient(circle var(--n) at 0 50%, #0000 97%, #000) 0 0 / 51% 100% no-repeat, radial-gradient(circle var(--n) at 100% 50%, #0000 97%, #000) 100% 0 / 51% 100% no-repeat; }
.stub .tear { width: 54px; flex: none; border-right: 2px dashed var(--rule); display: grid; place-items: center; background: var(--paper-2); }
.stub .tear span { writing-mode: vertical-rl; transform: rotate(180deg); font: 700 10px/1 var(--mono); letter-spacing: .14em; color: var(--ink-muted); }
.stub .body { flex: 1; min-width: 0; padding: 14px 18px 14px 16px; display: flex; flex-direction: column; gap: 6px; }
.stub .head { display: flex; align-items: center; gap: 10px; min-width: 0; }
.stub .logo { width: 46px; height: 34px; }
.stub .brand { font: 700 11px/1.2 "DM Sans", Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stub h3 { font-size: 25px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.stub .foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; }

/* --- Voucher: a tall cut-out coupon with a dashed cut line and a code strip --- */
.voucher .paper { flex-direction: column; padding: 12px; }
.voucher .cut { flex: 1; border: 2px dashed var(--rule); padding: 16px 16px 14px; display: flex; flex-direction: column; gap: 10px; min-height: 0; position: relative; }
.voucher .cutlabel { position: absolute; top: -8px; left: 14px; background: var(--paper); padding: 0 6px; color: var(--ink-muted); }
.voucher .logo { height: 96px; width: 100%; }
.voucher h3 { font-size: 34px; text-wrap: balance; }
.voucher p { margin: 0; color: var(--ink-soft); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.voucher .bars { height: 30px; margin-top: auto; background: repeating-linear-gradient(90deg, var(--ink) 0 2px, transparent 2px 5px, var(--ink) 5px 6px, transparent 6px 10px, var(--ink) 10px 13px, transparent 13px 15px); opacity: .85; }
.voucher .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

/* --- Ticket: wide, with a tear-off stub on the right and notches at the perforation --- */
.ticket .paper { --n: 11px; --stubw: 132px;
  -webkit-mask: radial-gradient(circle var(--n) at calc(100% - var(--stubw)) 0, #0000 97%, #000) 0 0 / 100% 51% no-repeat, radial-gradient(circle var(--n) at calc(100% - var(--stubw)) 100%, #0000 97%, #000) 0 100% / 100% 51% no-repeat;
          mask: radial-gradient(circle var(--n) at calc(100% - var(--stubw)) 0, #0000 97%, #000) 0 0 / 100% 51% no-repeat, radial-gradient(circle var(--n) at calc(100% - var(--stubw)) 100%, #0000 97%, #000) 0 100% / 100% 51% no-repeat; }
.ticket .band { width: 10px; flex: none; background: var(--brand); }
.ticket .art { width: 30%; flex: none; position: relative; overflow: hidden; background: var(--paper-2); }
.ticket .art .logo { position: absolute; inset: 0; }
.ticket .main { flex: 1; min-width: 0; padding: 16px 20px; display: flex; flex-direction: column; gap: 7px; }
.ticket .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ticket h3 { font-size: 34px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ticket .brand { font: 700 12px/1.2 "DM Sans", Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-muted); }
.ticket .foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ticket .tear { width: var(--stubw); flex: none; border-left: 2px dashed var(--rule); padding: 14px 14px; display: flex; flex-direction: column; gap: 8px; justify-content: space-between; background: var(--paper-2); }
.ticket .tear strong { font: 900 40px/0.9 var(--display); }
.ticket .tear .code { font: 700 10px/1.3 var(--mono); letter-spacing: .12em; color: var(--ink-muted); word-break: break-all; }

/* --- Magazine cut-out: a torn page with a taped photo and a ransom-note headline --- */
.magazine { --tilt: -0.6deg; }
.magazine .paper { flex-direction: column; padding: 22px 24px 20px; gap: 12px; transform: rotate(-1.1deg);
  clip-path: polygon(0 2.2%, 4% 0.6%, 9% 2%, 15% 0.4%, 22% 1.8%, 30% 0.3%, 38% 1.6%, 47% 0.2%, 56% 1.5%, 65% 0.3%, 74% 1.7%, 83% 0.4%, 91% 1.6%, 100% 0.5%, 99.3% 12%, 100% 26%, 99.2% 41%, 100% 57%, 99.4% 72%, 100% 88%, 99.5% 100%, 90% 98.6%, 80% 99.8%, 69% 98.5%, 58% 99.7%, 47% 98.4%, 36% 99.6%, 25% 98.5%, 14% 99.7%, 5% 98.6%, 0.6% 99.6%, 0 86%, 0.8% 70%, 0 54%, 0.7% 38%, 0 22%, 0.6% 10%);
  transition: transform .35s var(--ease); background-image: repeating-linear-gradient(0deg, rgba(17,16,14,.035) 0 1px, transparent 1px 26px); }
.magazine:hover .paper { transform: rotate(0deg); }
.magazine .mast { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 3px solid var(--ink); padding-bottom: 8px; }
.magazine .mast strong { font: 900 20px/1 var(--display); letter-spacing: .02em; text-transform: uppercase; }
.magazine .spread { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 20px; }
.magazine .photo { position: relative; background: var(--paper-2); transform: rotate(1.6deg); box-shadow: 0 6px 16px rgba(17,16,14,.3); border: 6px solid #fff; min-height: 0; overflow: hidden; }
.magazine .photo .ph { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transform: scale(1.07); transition: opacity .8s ease, transform 5.2s cubic-bezier(.2, .6, .2, 1); }
.magazine .photo .ph.on { opacity: 1; transform: scale(1); }
.magazine .photo .logo { position: absolute; inset: 0; }
.magazine .tape { position: absolute; width: 74px; height: 22px; background: rgba(255, 233, 150, .78); box-shadow: 0 1px 3px rgba(17,16,14,.2); z-index: 3; }
.magazine .tape.t1 { top: 58px; left: 12px; transform: rotate(-32deg); }
.magazine .tape.t2 { top: 54px; left: calc(50% - 40px); transform: rotate(24deg); }
.magazine .copy { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.magazine h3 { font-size: 0; display: flex; flex-wrap: wrap; gap: 6px 5px; align-items: center; }
.magazine h3 span { font: 900 clamp(26px, 2.6vw, 40px)/1 var(--display); text-transform: uppercase; padding: 3px 8px 2px; background: var(--ink); color: var(--paper); display: inline-block; }
.magazine h3 span:nth-child(3n+2) { background: var(--brand); color: var(--on-brand); transform: rotate(-2deg); }
.magazine h3 span:nth-child(3n) { background: #fff; color: var(--ink); box-shadow: 0 1px 4px rgba(17,16,14,.25); transform: rotate(1.5deg); font-family: Georgia, "Times New Roman", serif; font-weight: 700; text-transform: none; }
.magazine h3 span:nth-child(4n+1) { transform: rotate(1deg); }
.magazine .brandline { display: flex; align-items: center; gap: 10px; }
.magazine .brandline .logo { width: 62px; height: 42px; }
.magazine p { margin: 0; color: var(--ink-soft); font-size: 15px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.magazine .foot { margin-top: auto; display: flex; align-items: end; justify-content: space-between; gap: 14px; }
.magazine .foot .alloc { min-width: 150px; }
.magazine .stamp { border: 2px solid var(--paper-brand); color: var(--paper-brand); padding: 5px 10px; transform: rotate(-6deg); font: 900 18px/1 var(--display); letter-spacing: .06em; text-transform: uppercase; }

/* ---------- Detail dialog ---------- */
dialog { position: fixed; inset: 0; margin: auto; width: min(720px, calc(100vw - 24px)); height: fit-content; max-height: calc(100vh - 24px); padding: 0; border: 0; background: var(--paper); color: var(--ink); box-shadow: 0 24px 90px rgba(0,0,0,.5); overflow: hidden; z-index: 1000; }
dialog::backdrop { background: rgba(0,0,0,.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
dialog[open] { display: flex; flex-direction: column; }
.dhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 12px 12px 24px; border-bottom: 2px dashed var(--rule); }
.dhead p { margin: 0; font: 800 20px/1 var(--display); letter-spacing: .1em; text-transform: uppercase; }
.x { appearance: none; background: none; border: 0; cursor: pointer; color: var(--ink-muted); font: 400 22px/1 "DM Sans", Arial, sans-serif; width: 44px; height: 44px; }
.dbody { overflow: auto; min-height: 0; padding: 22px 24px 24px; display: grid; gap: 14px; }
.dbody h2 { font-size: 40px; }
.dbody p { margin: 0; color: var(--ink-soft); }
.facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; }
.facts div { background: var(--paper-2); padding: 10px 12px; min-width: 0; }
.facts dt { color: var(--ink-muted); } .facts dd { margin: 3px 0 0; font-weight: 600; }
.terms { margin: 0; padding-left: 18px; display: grid; gap: 6px; color: var(--ink-soft); }
.cta { appearance: none; cursor: pointer; border: 1px solid var(--brand); background: var(--brand); color: var(--on-brand); font: 800 14px/1 "DM Sans", Arial, sans-serif; letter-spacing: .09em; text-transform: uppercase; padding: 15px 20px; display: inline-flex; gap: 28px; align-items: center; justify-content: space-between; min-height: 46px; }
.cta[disabled] { background: transparent; color: var(--ink-muted); border-color: var(--rule); cursor: default; }
.claimbox { border: 2px dashed var(--rule); padding: 14px 16px; display: grid; gap: 5px; }
.claimbox strong { font: 900 30px/1 var(--display); text-transform: uppercase; }
.claimbox code { font: 700 14px/1.2 var(--mono); letter-spacing: .14em; }
/* Phones: still three columns. The grid is laid out 560px wide with these compact styles, then scaled to fit (see fit()). */
@media (max-width: 700px) {
  .grid { grid-auto-rows: 190px; gap: 12px; }
  /* ticket */
  .ticket .paper { --stubw: 74px; --n: 8px; }
  .ticket .art { width: 24%; } .ticket .band { width: 6px; }
  .ticket .main { padding: 10px 12px; gap: 4px; }
  .ticket h3 { font-size: 20px; -webkit-line-clamp: 3; } .ticket .brand { font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ticket .row { gap: 6px; } .ticket .row .type { display: none; }
  .ticket .tear { padding: 10px 8px; gap: 4px; } .ticket .tear strong { font-size: 28px; } .ticket .tear .cap { font-size: 8px; } .ticket .tear .code { font-size: 8px; }
  .ticket .foot .alloc .meter, .ticket .foot > .cap { display: none; }
  /* voucher */
  .voucher .paper { padding: 7px; } .voucher .cut { padding: 12px 10px 10px; gap: 7px; }
  .voucher .logo { height: 58px; } .voucher h3 { font-size: 21px; } .voucher p, .voucher .tierchip { display: none; }
  .voucher .bars { height: 20px; } .voucher .foot { flex-wrap: wrap; gap: 4px 8px; }
  /* stub */
  .stub .tear { display: none; } .stub .paper { --n: 6px; }
  .stub .body { padding: 10px 14px; gap: 5px; } .stub .logo { width: 36px; height: 26px; } .stub .brand { font-size: 9px; }
  .stub h3 { font-size: 17px; -webkit-line-clamp: 3; } .stub .foot .ends { display: none; }
  .go { font-size: 10px; gap: 5px; } .ends { font-size: 9px; } .badge { font-size: 9px; padding: 3px 6px; }
  /* magazine */
  .magazine .paper { padding: 16px 16px 14px; gap: 10px; }
  .magazine .spread { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; gap: 12px; }
  .magazine .photo { min-height: 110px; } .magazine h3 span { font-size: 24px; padding: 2px 6px 1px; } .magazine p { font-size: 13px; -webkit-line-clamp: 2; }
  .magazine .tape.t1 { top: 48px; } .magazine .tape.t2 { top: 44px; }
  .facts { grid-template-columns: minmax(0, 1fr); }
}
/* a photo (or a carousel of them) where the logo would sit, with the logo kept as a chip in the corner */
.piece .logo.shot { background: #fff; }
.piece .logo.shot img.ph { position: absolute; inset: 0; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .8s ease; }
.piece .logo.shot img.ph.on { opacity: 1; }
.piece .shot .logo.chip { position: absolute; inset: auto auto 0 0; width: 40%; height: 40%; max-width: 84px; max-height: 60px; z-index: 2; background: #fff; }
.piece .shot .logo.chip.plate-dark { background: #0b0b0b; }
@media (prefers-reduced-motion: reduce) { .piece .logo.shot img.ph { transition: none; } }
.stub .head .logo.shot { width: 46px; height: 34px; }
@media (prefers-reduced-motion: reduce) { .piece, .magazine .paper, .go .arr { transition: none; } .piece.expiring { animation: none; filter: drop-shadow(0 0 12px rgba(255,73,55,.6)); } .magazine .photo .ph { transition: opacity .01s; transform: none; } }
`;
const FONTS = ['https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Sans:wght@400;500;700;800&family=JetBrains+Mono:wght@400;700&display=swap'];

function mount(container, initialDeck, opts) {
  opts = opts || {};
  const D = window.DeckCore;
  const now = () => (Number.isFinite(opts.now) ? opts.now : Date.now());
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || typeof gsap === 'undefined';
  let deck = initialDeck, tierFilter = 'all', destroyed = false;

  function h(tag, cls, text, attrs) { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]); return el; }
  const add = (p, ...kids) => { kids.forEach(k => k && p.appendChild(k)); return p; };

  // the wall's own nodes (the prototype's #vw, #grid and #detail), built inside the container
  const vwEl = h('div', 'vw', null, { id: 'vw', 'data-theme': 'dark' });
  const gridEl = h('main', 'grid', null, { id: 'grid', 'aria-live': 'polite' });
  const dlgEl = h('dialog', null, null, { id: 'detail', 'aria-labelledby': 'dTitle' });
  add(dlgEl, add(h('div', 'dhead'), h('p', null, null, { id: 'dTitle' }), h('button', 'x', '×', { id: 'dClose', 'aria-label': 'Close offer' })), h('div', 'dbody', null, { id: 'dBody' }));
  add(container, add(vwEl, gridEl, dlgEl));
  const $ = id => (vwEl.id === id ? vwEl : vwEl.querySelector('#' + id));

  const typeLabel = t => (t === 'Option' ? 'Choice' : t);
  const headline = c => (c.noOffer === true ? String(c.role || '') : String(c.short || '').replace(/\.$/, ''));
  const typeEl = c => (c.type ? h('span', 'label type', typeLabel(c.type)) : null);
  const longEl = c => (c.long ? h('p', null, c.long) : null);
  const counted = c => typeof c.remaining === 'number' && typeof c.total === 'number';
  const soldOut = c => counted(c) && c.remaining <= 0;
  const hasEnd = c => typeof c.to === 'string' && c.to !== '';
  function endDate(c) { const y = parseInt(c.year, 10) || new Date(now()).getFullYear(), fm = +c.from.slice(0, 2) || 1, tm = +c.to.slice(0, 2) || 12, td = +c.to.slice(3) || 28; return new Date(y + (tm < fm ? 1 : 0), tm - 1, td, 23, 59, 59); }
  const daysLeft = c => Math.ceil((endDate(c) - now()) / 86400000);
  const expiring = c => { if (!hasEnd(c)) return false; const d = daysLeft(c); return d >= 0 && d <= 7; };
  function ends(c) {
    if (!hasEnd(c)) return null;
    const d = daysLeft(c), soon = expiring(c), el = h('span', 'ends cap' + (soon ? ' soon' : ''));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.6V8l2.3 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
    return add(el, svg, h('span', null, d < 0 ? 'Ended ' + c.to : soon ? (d <= 1 ? 'Ends today' : `Expiring · ${d} days`) : 'Ends ' + c.to));
  }
  function logo(c) { const plate = D.plateFor(c, 'light'); const el = h('span', 'logo' + (plate ? ' plate-' + plate : '')); return add(el, h('img', null, null, { src: c._logo, alt: `${c.brand} logo` })); }
  const badge = c => (c.featured && D.TIERS[c.tier].badge ? h('span', 'badge', 'Featured') : null);
  const tierChip = c => h('span', 'tierchip', D.TIERS[c.tier].name);
  // a sponsor without a published offer links to its site instead of offering a claim (no action when it has no site)
  const go = c => (c.noOffer === true ? (c.site ? add(h('span', 'go'), h('span', null, 'Visit site'), h('span', 'arr', '↗', { 'aria-hidden': 'true' })) : null)
    : add(h('span', 'go'), h('span', null, 'Claim'), h('span', 'arr', '↗', { 'aria-hidden': 'true' })));
  const openLine = c => 'Open to every ticket' + (c.limit ? ' · ' + c.limit : '');
  /* Partners can allocate a limited number of claims; everyone else is open to every ticket. */
  function alloc(c) {
    if (c.noOffer === true) return null;
    if (!c.limited || !counted(c)) return h('span', 'cap', openLine(c));
    const el = h('span', 'alloc'), m = h('span', 'meter'), i = h('i'); i.style.width = Math.max(2, c.remaining / c.total * 100) + '%';
    return add(el, h('span', 'mono', c.remaining > 0 ? `${c.remaining} of ${c.total} left` : 'All claimed'), add(m, i));
  }
  const photos = D.photosFor;

  /* the sponsor's photos in the logo's place (a carousel when the tier allows more than one), or the logo when there are none */
  function shot(c, chip) {
    const ph = photos(c); if (!ph.length) return logo(c);
    const el = h('span', 'logo shot');
    ph.forEach((src, k) => add(el, h('img', 'ph' + (k === 0 ? ' on' : ''), null, { src, alt: '' })));
    if (chip !== false) { const l = logo(c); l.classList.add('chip'); add(el, l); }
    if (ph.length > 1) cars.push({ el, n: ph.length, at: 0 });
    return el;
  }
  /* ---------- The four styles ---------- */
  const STYLES = {
    stub(c, i) {
      const body = h('span', 'body');
      add(body, add(h('span', 'head'), logo(c), photos(c).length ? shot(c, false) : null, h('span', 'brand', c.brand)), h('h3', 'disp', headline(c)), add(h('span', 'foot'), ends(c), go(c)));
      return add(h('span', 'paper'), add(h('span', 'tear'), h('span', null, `${c.id} · ${String(i + 1).padStart(2, '0')}`)), body);
    },
    voucher(c) {
      const cut = h('span', 'cut');
      add(cut, h('span', 'cutlabel cap', 'Cut here'), shot(c), add(h('span', 'foot'), typeEl(c), badge(c) || tierChip(c)),
        h('h3', 'disp', headline(c)), longEl(c), h('span', 'bars', null, { 'aria-hidden': 'true' }), add(h('span', 'foot'), ends(c), go(c)));
      return add(h('span', 'paper'), cut);
    },
    ticket(c, i) {
      const art = add(h('span', 'art'), shot(c));
      const main = h('span', 'main');
      add(main, add(h('span', 'row'), badge(c), typeEl(c), ends(c)), h('span', 'brand', c.brand), h('h3', 'disp', headline(c)),
        add(h('span', 'foot'), alloc(c), go(c)));
      const tear = h('span', 'tear');
      add(tear, h('span', 'cap', 'Admit offer'), h('strong', null, String(i + 1).padStart(2, '0')), h('span', 'code', typeof c.total === 'number' ? `${c.id}-${String(c.total).padStart(4, '0')}` : c.id), tierChip(c));
      return add(h('span', 'paper'), h('span', 'band'), art, main, tear);
    },
    magazine(c, i) {
      const paper = h('span', 'paper'), spread = h('span', 'spread'), photo = h('span', 'photo'), ph = photos(c);
      if (ph.length) { ph.forEach((src, k) => add(photo, h('img', 'ph' + (k === 0 ? ' on' : ''), null, { src, alt: k === 0 ? `${c.brand} photo` : '' }))); if (ph.length > 1) cars.push({ el: photo, n: ph.length, at: 0 }); }
      else add(photo, logo(c));
      const h3 = h('h3', null, null, { 'aria-label': headline(c) }); headline(c).split(' ').forEach(w => add(h3, h('span', null, w, { 'aria-hidden': 'true' })));
      const copy = h('span', 'copy');
      add(copy, add(h('span', 'brandline'), logo(c), badge(c), typeEl(c)), h3, longEl(c),
        add(h('span', 'foot'), alloc(c), go(c)));
      add(paper, add(h('span', 'mast'), h('strong', null, c.brand), add(h('span', null, null, { style: 'display:flex;gap:10px;align-items:center' }), ends(c), h('span', 'mono', `No. ${String(i + 1).padStart(2, '0')}`))),
        h('span', 'tape t1', null, { 'aria-hidden': 'true' }), h('span', 'tape t2', null, { 'aria-hidden': 'true' }), add(spread, photo, copy));
      return paper;
    },
  };
  let cars = [];
  function render(animate) {
    if (destroyed) return;
    const grid = $('grid'); grid.replaceChildren(); cars = [];
    $('vw').dataset.theme = deck.wall && deck.wall.cards === 'white' ? 'light' : 'dark';
    // bigger pieces first, so the grid packs without holes
    const list = deck.coupons.slice(0, deck.count).map((c, i) => ({ c, i })).filter(o => tierFilter === 'all' || o.c.tier === tierFilter)
      .sort((a, b) => b.c.cols * b.c.rows - a.c.cols * a.c.rows || b.c.cols - a.c.cols || a.i - b.i);
    list.forEach(({ c, i }) => {
      const cell = h('div', 'cell s-' + c.style, null, { style: `--w:${c.cols};--h:${c.rows}` });
      const cls = `piece ${c.style}${expiring(c) && !soldOut(c) ? ' expiring' : ''}`, label = `${c.brand}: ${headline(c)}. ${D.TIERS[c.tier].name}, ${c.cols} by ${c.rows}.`;
      // no published offer: a link to the sponsor's site (new tab), or a plain piece without one; never the dialog
      const piece = c.noOffer !== true ? h('button', cls, null, { type: 'button', 'aria-label': label })
        : c.site ? h('a', cls, null, { href: c.site, target: '_blank', rel: 'noopener noreferrer', 'aria-label': label + ' Visit site.' })
        : h('div', cls + ' static', null, { role: 'group', 'aria-label': label });
      piece.style.setProperty('--tilt', (c.style === 'stub' ? (i % 2 ? 0.8 : -0.8) : c.style === 'voucher' ? 0.5 : c.style === 'ticket' ? -0.4 : -0.6) + 'deg');
      add(piece, STYLES[c.style](c, i));
      if (c.noOffer !== true) piece.addEventListener('click', () => openDetail(i, piece));
      add(grid, add(cell, piece));
    });
    if (!list.length) add(grid, h('p', 'cap', 'No sponsors in this tier yet.'));
    fit();
    if (animate && !reduced) {
      // each piece drops onto the wall like paper being pinned up: a small fall, a slight spin, then it settles
      gsap.fromTo(grid.querySelectorAll('.piece'), { opacity: 0, y: -26, rotation: () => gsap.utils.random(-5, 5), scale: 1.05 },
        { opacity: 1, y: 0, rotation: 0, scale: 1, duration: 0.6, stagger: 0.07, ease: 'back.out(1.5)', clearProps: 'transform,opacity' });
    }
  }
  /* Three columns at every width: below 1060px the grid keeps a fixed layout width and is scaled down to fit. */
  function fit() {
    const g = $('grid'), vw = document.documentElement.clientWidth, base = vw <= 700 ? 560 : vw < 1060 ? 1060 : 0;
    const w = vwEl.clientWidth || vw;
    g.style.width = base ? base + 'px' : ''; g.style.zoom = base ? w / base : '';
  }
  addEventListener('resize', fit);
  /* magazine photos change on a shared beat, one piece at a time */
  let beat = 0;
  const timer = setInterval(() => { if (document.hidden || reduced || !cars.length || $('detail').open) return; const car = cars[beat++ % cars.length]; if (!car.el.isConnected) return; car.at = (car.at + 1) % car.n; car.el.querySelectorAll('.ph').forEach((im, k) => im.classList.toggle('on', k === car.at)); }, 2600);

  /* ---------- Detail ---------- */
  const dlg = $('detail');
  function openDetail(i, from) {
    const c = deck.coupons[i];
    if (!c || c.noOffer === true) return;
    $('dTitle').textContent = `${D.STYLES[c.style]} · ${c.brand}`;
    const fill = () => {
      const body = $('dBody'); body.replaceChildren();
      // rows with no value are left out (live offers can have empty fields)
      const rows = [['Where', c.where]];
      if (hasEnd(c)) rows.push(['Valid', `${c.from} – ${c.to} · ${c.year}`]);
      rows.push(c.limited && counted(c) ? ['Allocation', `${c.remaining} of ${c.total} left`] : ['Limit', c.limit]);
      const shown = rows.filter(([, v]) => v != null && v !== '');
      const facts = shown.length ? h('dl', 'facts') : null; shown.forEach(([k, v]) => add(facts, add(h('div'), h('dt', 'cap', k), h('dd', null, v))));
      const list = (c.terms || []).filter(Boolean);
      const terms = list.length ? h('ol', 'terms') : null; list.forEach(t => add(terms, h('li', null, t)));
      const action = h('button', 'cta', null, { type: 'button' }); add(action, h('span', null, c.limited && soldOut(c) ? 'All claimed' : 'Claim offer'), h('span', null, '↗', { 'aria-hidden': 'true' }));
      if (c.limited && soldOut(c)) action.disabled = true;
      action.addEventListener('click', () => { if (typeof opts.onClaim === 'function') opts.onClaim(c.id); });
      add(body, add(h('div', null, null, { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' }), badge(c), typeEl(c), ends(c), tierChip(c)),
        h('h2', 'disp', headline(c)), longEl(c), facts, terms ? h('span', 'cap', 'How to claim') : null, terms, action);
    };
    fill();
    if (!dlg.open) {
      // Port fix (owner decision): keep the dialog a real popup (dimmed backdrop, Escape and a click outside close it).
      // GSAP measures an element with no transform and no offsetParent (an open dialog is position: fixed) by moving it to
      // the page root for a moment, which drops a dialog's modal state. So GSAP measures it here, while it is closed
      // (getProperty forces that now; gsap.set can be lazy), and the opening animation clears its transform by hand.
      if (!reduced) { gsap.set(dlg, { x: 0, y: 0, scaleX: 1, scaleY: 1, transformOrigin: '0 0', lazy: false }); gsap.getProperty(dlg, 'x'); }
      dlg.showModal();
    }
    if (reduced) return;
    const to = dlg.getBoundingClientRect(), fr = from && from.isConnected ? from.getBoundingClientRect() : null;
    if (fr) gsap.fromTo(dlg, { x: fr.left - to.left, y: fr.top - to.top, scaleX: fr.width / to.width, scaleY: fr.height / to.height, transformOrigin: '0 0' }, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.45, ease: 'expo.out', onComplete: () => { for (const p of ['transform', 'translate', 'rotate', 'scale', 'transform-origin']) dlg.style.removeProperty(p); } });
    gsap.fromTo([dlg.querySelector('.dhead'), $('dBody')], { opacity: 0 }, { opacity: 1, duration: 0.28, delay: 0.12 });
  }
  $('dClose').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  function prepare() { return Promise.all(deck.coupons.map(D.loadImg)).then(() => deck.coupons.forEach(c => { c._logo = (c._img ? D.drawUploadedLogo(c._img) : D.drawLogo(c)).toDataURL(); })); }
  (async () => {
    try { await Promise.race([document.fonts.load('900 60px "Barlow Condensed"'), new Promise(r => setTimeout(r, 2000))]); } catch (e) { /* fallback fonts */ }
    await prepare(); render(true);
  })();

  return {
    update(d) { deck = d; prepare().then(() => render(false)); },
    destroy() {
      destroyed = true;
      clearInterval(timer);
      removeEventListener('resize', fit);
      if (typeof gsap !== 'undefined') gsap.killTweensOf([dlg, dlg.querySelector('.dhead'), $('dBody'), ...gridEl.querySelectorAll('.piece')]);
      if (dlg.open) dlg.close();
      vwEl.remove();
    },
  };
}

window.VCWallRenderers = window.VCWallRenderers || {};
window.VCWallRenderers.vouchers = { css: CSS, fonts: FONTS, needs: ['gsap'], mount };
})();
