/* Offer wall renderers: formats `featured` (Featured + Cascade) and `cascade`.
   An exact port of offerwall.html (branch claude/coupon-claim-interface-cb9xst): its CSS and code, copied.
   Registers window.VCWallRenderers.featured and window.VCWallRenderers.cascade (see RENDERER-CONTRACT.md).

   Allowed changes made (contract list), and nothing else:
   1. Scope: document.getElementById → lookups inside opts.root (and this mount's own nodes). Every rule of the
      prototype's CSS is prefixed with :where(.wall) (zero specificity, so the cascade is unchanged) except the
      rules that already start at .wall. The body rule (font, font smoothing) and the html rule (text-size-adjust)
      move to the wall's own element; `*` box-sizing, [hidden], a, :focus-visible are scoped to the wall.
   2. Page chrome removed: header and tabs, intro, design options toolbar (layout / page background / cards / open
      slots), section heading with its offer count and filter chips (so the filter is always "all"), sort note,
      footer, skyline and its window tween, #preview/#embed classes, the View Transitions path that only those
      controls reached (and its ::view-transition rules). The wall is drawn as the prototype draws it in #embed
      mode (the wall alone on a transparent ground for a host page): .wall keeps its tokens and colour but not
      the page-shell min-height/flex/safe-area padding/background, and .stagewrap has no border or padding.
   3. No storage: no localStorage (featured turn, claims), no DeckCore.load/save/subscribe. update(deck) does
      what the prototype's subscribe callback did (prepare, then render without the entrance).
   4. No fake claims: the per-device claims store, simulated claim codes and the "Claimed"/"Show claim" states
      are gone; Claim offer calls opts.onClaim(id). Stock: a coupon is sold out only when remaining and total are
      both numbers and remaining <= 0; when they are not numbers there is no "N left" counter and no "Left" row,
      and the coupon counts as available (featured rotation, expiring glow, claim button).
      Live coupons with no end date (to === '') get no expiry stub, no glow, and never count as ended.
      Live coupons with empty fields: empty rows are left out (type tag, Valid, Where, limit mark, long text, terms,
      side-panel rows). A sponsor with no published offer (noOffer === true) shows its role in place of the offer
      text, no type tag, and a "Visit site ↗" link (new tab, noopener noreferrer) when it has a site, else no
      action; it opens no dialog and is skipped by the dialog's prev/next.
   5. Determinism: opts.now replaces Date.now() (expiry); opts.rotation replaces the stored featured turn
      (default when absent: the prototype's no-storage fallback, a random turn).
   6. GSAP global state: untouched (the prototype sets no global time scale).
   Robustness only (no effect on SAMPLE): a logo that cannot be read back from a canvas (cross-origin) uses its
   own URL; a coupon whose tier is unknown shows at most one photo. Listeners on document (keydown) and the
   carousel interval are removed in destroy(). */
(function () {
'use strict';

const FONTS = ['https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Sans:wght@400;500;700;800&family=JetBrains+Mono:wght@400;700&display=swap'];

/* The prototype's CSS for the wall (page chrome removed; see the note above). Scoped below. */
const RAW_CSS = `
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
.wall {
  --bg: #0b0b0b; --card: #1a1a1a; --warm: #24211f; --border: #444444; --line: rgba(255,255,255,.21);
  --ink: #f5f2e9; --soft: #f0ede7; --muted: #c9c5be; --brand: #ff4937; --brand-ink: #ff4937; --on-brand: #0b0b0b; --tag: #ff7255;
  --tile: #24211f; --tile-border: transparent; --sky-a: #141210; --sky-b: #1d1a16; --shadow: 0 24px 90px rgba(0,0,0,.5);
  --display: "Barlow Condensed", Impact, "Arial Narrow", sans-serif; --mono: "JetBrains Mono", ui-monospace, monospace;
  --ease: cubic-bezier(.23, 1, .32, 1); --gutter: clamp(20px, 5.4vw, 83px);
  color-scheme: dark;
  color: var(--ink);
  font: 400 14px/1.4 "DM Sans", Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%;
}
.wall[data-theme="light"] {
  --bg: #ffffff; --card: #ffffff; --warm: #f5f2e9; --border: rgba(17,16,14,.3); --line: rgba(17,16,14,.16);
  --ink: #0b0b0b; --soft: #11100e; --muted: #48433d; --brand-ink: #a54635; --tile: #f5f2e9; --sky-a: #f1eee7; --sky-b: #e8e4db;
  --shadow: 0 24px 70px rgba(17,16,14,.18); color-scheme: light;
}
.wall[data-cards="white"] .card, .wall[data-cards="white"] .row, .wall[data-cards="white"] .feature, .wall[data-cards="white"] .rail-item, .wall[data-cards="white"] dialog {
  --bg: #ffffff; --card: #ffffff; --warm: #f6f5f2; --border: rgba(17,16,14,.14); --line: rgba(17,16,14,.14);
  --ink: #0b0b0b; --soft: #11100e; --muted: #48433d; --brand-ink: #a54635; --tile: #ffffff; --tile-border: rgba(17,16,14,.14);
  color: var(--ink); color-scheme: light;
}
.wall[data-cards="dark"] .card, .wall[data-cards="dark"] .row, .wall[data-cards="dark"] .feature, .wall[data-cards="dark"] .rail-item, .wall[data-cards="dark"] dialog {
  --bg: #0b0b0b; --card: #1a1a1a; --warm: #24211f; --border: #444444; --line: rgba(255,255,255,.21);
  --ink: #f5f2e9; --soft: #f0ede7; --muted: #c9c5be; --brand-ink: #ff4937; --tile: #24211f; --tile-border: transparent;
  color: var(--ink); color-scheme: dark;
}
a { color: inherit; }
:focus-visible { outline: 2px solid var(--brand-ink); outline-offset: 2px; }
.label { font: 700 12px/1.25 "DM Sans", Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; }
.cap { font: 400 10px/1.4 "DM Sans", Arial, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.mono { font: 400 11px/1.4 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.disp { font-family: var(--display); font-weight: 900; text-transform: uppercase; line-height: 1; margin: 0; }

.stagewrap { position: relative; display: flex; flex-direction: column; gap: 24px; overflow: hidden; flex: 1; }
#stage { position: relative; }
.empty { border: 1px dashed var(--border); padding: 28px; color: var(--muted); }

.tile { position: relative; background: var(--tile); border: 1px solid var(--tile-border); border-radius: 8px; display: grid; place-items: center; padding: 14px; overflow: hidden; }
.tile.plate-dark { background: #0b0b0b; border-color: #0b0b0b; }
.tile.plate-light { background: #ffffff; border-color: rgba(17,16,14,.14); }
.sitelink { color: var(--ink); text-underline-offset: 3px; }
.tile img { position: absolute; top: 11%; left: 11%; width: 78%; height: 78%; object-fit: contain; display: block; transition: transform .3s var(--ease); }
.tag { align-self: flex-start; background: var(--tag); color: #0b0b0b; font: 700 10px/1.4 "DM Sans", Arial, sans-serif; letter-spacing: .1em; text-transform: uppercase; padding: 5px 9px; }
.stub { --notch: 5px; display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px 5px 10px; white-space: nowrap;
  font: 700 10px/1.4 "DM Sans", Arial, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: var(--muted);
  background: color-mix(in srgb, var(--ink) 9%, transparent);
  -webkit-mask: radial-gradient(circle var(--notch) at 0 50%, #0000 97%, #000) 0 0 / 51% 100% no-repeat, radial-gradient(circle var(--notch) at 100% 50%, #0000 97%, #000) 100% 0 / 51% 100% no-repeat;
          mask: radial-gradient(circle var(--notch) at 0 50%, #0000 97%, #000) 0 0 / 51% 100% no-repeat, radial-gradient(circle var(--notch) at 100% 50%, #0000 97%, #000) 100% 0 / 51% 100% no-repeat; }
.stub svg { width: 12px; height: 12px; flex: none; }
.stub.soon { background: var(--brand); color: var(--on-brand); }
.stub.ended { text-decoration: line-through; opacity: .7; }
.stubrow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.tag.claimed { background: transparent; color: var(--brand-ink); box-shadow: inset 0 0 0 1px var(--brand-ink); }
.between { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.between > .mono { white-space: nowrap; flex: none; }
.rule { border-top: 1px solid var(--line); }
.kv { display: flex; justify-content: space-between; gap: 12px; }
.kv span:last-child { color: var(--ink); text-align: right; }
.cta { appearance: none; cursor: pointer; border: 1px solid var(--brand); width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--brand); color: var(--on-brand); font: 800 14px/1 "DM Sans", Arial, sans-serif; letter-spacing: .09em; text-transform: uppercase; text-decoration: none; padding: 15px 20px; min-height: 46px; transition: box-shadow .25s var(--ease), transform .25s var(--ease); }
.cta:hover { box-shadow: 0 8px 24px rgba(190,55,36,.28); }
.cta .arr { transition: transform .25s var(--ease); }
.cta:hover .arr { transform: translate(2px, -2px); }
.cta.ghost { background: transparent; color: var(--ink); border-color: var(--border); }
.cta.ghost:hover { box-shadow: none; border-color: var(--ink); }
.cta[disabled] { background: transparent; color: var(--muted); border-color: var(--border); cursor: default; box-shadow: none; }
.textlink { appearance: none; background: none; border: 0; padding: 6px 0; cursor: pointer; color: var(--ink); text-decoration: underline; text-underline-offset: 4px; }

.card.offer, .rail-item, .feature { position: relative; isolation: isolate; }
.card.offer::after, .feature::after { content: ""; position: absolute; inset: 0; pointer-events: none; z-index: -1; opacity: 0; transition: opacity .2s var(--ease);
  background: radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), color-mix(in srgb, var(--brand) 14%, transparent), transparent 70%); }
.card.offer:hover::after, .feature:hover::after { opacity: 1; }
.cta:active, .rail-item:active, .rowhead:active { transform: scale(.98); }
.count { color: var(--muted); margin-left: 10px; font: 400 12px/1 var(--mono); letter-spacing: 0; vertical-align: middle; }

.cascade { column-count: 3; column-gap: 13px; }
.cascade > * { break-inside: avoid; margin: 0 0 13px; }
.card { background: var(--card); border: 1px solid var(--border); padding: 28px; display: flex; flex-direction: column; gap: 12px; color: var(--ink); transition: border-color .15s var(--ease), transform .2s var(--ease); }
.card.offer:hover { border-color: var(--ink); transform: translateY(-3px); }
.card.offer:hover .tile img { transform: scale(1.04); }
.card h3 { font-size: 30px; letter-spacing: .01em; }
.card p { margin: 0; }
.card .sum { font-weight: 500; color: var(--soft); }
.card .typ { color: var(--brand-ink); margin: 0; }
.card.open { min-height: 275px; }
.card.open .glyph { color: var(--brand-ink); font-size: 26px; line-height: 1; }
.card.partner { box-shadow: inset 4px 0 0 0 var(--brand); gap: 14px; }
.card.partner .cta { width: auto; align-self: flex-start; gap: 32px; letter-spacing: .14em; font-weight: 700; }
.star { color: var(--brand-ink); }

.side { background: var(--warm); padding: 18px; display: grid; gap: 12px; align-content: start; }
.side div { display: grid; gap: 3px; }
.side b { font-weight: 500; color: var(--soft); }
.terms { margin: 0; padding-left: 18px; display: grid; gap: 6px; color: var(--soft); }

.cascade.tiered { --ru: 300px; column-count: initial; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: minmax(var(--ru), auto); grid-auto-flow: dense; gap: 13px; align-items: stretch; }
.cascade.tiered > * { margin: 0; min-width: 0; }
.tiered .card.offer { grid-column: span var(--w, 1); grid-row: span var(--h, 1); padding: 20px; gap: 10px; }
.tiered .card.offer > .tile, .tiered .card.offer > .media { flex: 1 1 var(--th, 120px); min-height: var(--th, 120px); height: auto !important; }
.tiered .card.offer > .cta { margin-top: auto; }
.tiered .card.offer .long { color: var(--muted); }
.tiered .wide { display: grid; grid-template-columns: minmax(0, 44%) minmax(0, 1fr); grid-template-rows: repeat(12, auto) 1fr; column-gap: 24px; row-gap: 10px; padding: 24px; }
.tiered .wide.w3 { grid-template-columns: minmax(0, 36%) minmax(0, 1fr); }
.tiered .wide > .tile, .tiered .wide > .media { grid-column: 1; grid-row: 1 / span 13; min-height: 0; align-self: stretch; }
.tiered .wide > :not(.tile):not(.media) { grid-column: 2; }
.tiered .wide h3 { font-size: 38px; }
.tiered .wide > .cta { align-self: end; grid-row: 13; }
.tiered .wide.h1 .long, .tiered .wide.h1 .rule, .tiered .wide.h1 .kv { display: none; }
.tiered .w1 { --th: 150px; }
.tiered .w1 h3 { font-size: 26px; }
.tiered .w1 .sum { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.tiered .w1.h1 { --th: 64px; gap: 8px; }
.tiered .w1.h1 h3 { font-size: 22px; }
.tiered .w1.h1 .sum { -webkit-line-clamp: 2; }
.tiered .w1.h1 .rule, .tiered .w1.h1 .kv, .tiered .w1.h1 > p.cap, .tiered .w1.h2 .kv, .tiered .w1.h2 .rule { display: none; }
@media (max-width: 1100px) { .tiered .wide { column-gap: 16px; padding: 18px; } .tiered .wide h3 { font-size: 30px; } .tiered .card.offer { padding: 16px; } .tiered .card .between { flex-wrap: wrap; gap: 6px; } .tiered .w1 .between > .mono { display: none; } }
.combo > .feature { min-height: 380px; border-color: var(--brand); box-shadow: inset 0 4px 0 0 var(--brand); }
.tag.flag { background: var(--ink); color: var(--bg); }
@keyframes expGlow { 0%, 100% { box-shadow: 0 0 0 1px color-mix(in srgb, var(--brand) 55%, transparent), 0 0 14px 0 color-mix(in srgb, var(--brand) 16%, transparent); }
  50% { box-shadow: 0 0 0 1px var(--brand), 0 0 26px 3px color-mix(in srgb, var(--brand) 34%, transparent); } }
.expiring { border-color: var(--brand) !important; animation: expGlow 2.6s ease-in-out infinite; }
.combo > .feature.expiring { animation: expGlow 2.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .expiring, .combo > .feature.expiring { animation: none; box-shadow: 0 0 0 1px var(--brand), 0 0 18px 0 color-mix(in srgb, var(--brand) 24%, transparent); } }
.wall[data-cards="white"] .tag.flag { background: #0b0b0b; color: #ffffff; }
.feature { background: var(--card); border: 1px solid var(--border); color: var(--ink); display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); min-height: 440px; }
.feature .tile { border-radius: 0; border: 0; border-right: 1px solid var(--line); min-height: 240px; }
.feature .tile img { top: 19%; left: 19%; width: 62%; height: 62%; }
.feature .body { padding: 28px; display: flex; flex-direction: column; gap: 12px; }
.feature h3 { font-size: clamp(38px, 4vw, 57px); }
.feature p { margin: 0; color: var(--soft); }
.feature .cta { margin-top: auto; }

dialog { position: fixed; inset: 0; margin: auto; width: min(960px, calc(100vw - 24px)); height: fit-content; max-height: min(840px, calc(100vh - 24px)); padding: 0; border: 1px solid var(--border); border-radius: 3px; background: var(--card); color: var(--ink); box-shadow: var(--shadow); overflow: hidden; }
@keyframes backdropIn { from { opacity: 0; } }
dialog::backdrop { animation: backdropIn .3s ease-out; background: rgba(0,0,0,.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
dialog[open] { display: flex; flex-direction: column; }
.dhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 28px; border-bottom: 1px solid var(--line); }
.dhead p { margin: 0; font: 600 22px/1 var(--display); letter-spacing: .18em; text-transform: uppercase; }
.x { appearance: none; background: none; border: 0; cursor: pointer; color: var(--muted); font: 400 22px/1 "DM Sans", Arial, sans-serif; width: 44px; height: 44px; }
.x:hover { color: var(--ink); }
.dnav { display: flex; align-items: center; gap: 2px; flex: none; }
dialog { z-index: 1000; will-change: transform; touch-action: none; }
.dhead { touch-action: none; cursor: grab; }
.dbody { will-change: transform, opacity; }
.swipehint { margin: 0; text-align: center; padding: 0 0 12px; display: none; }
@media (pointer: coarse) { .swipehint { display: block; } }
.dbody { overflow: auto; min-height: 0; flex: 1; display: grid; align-items: start; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 24px; padding: 24px 28px 28px; }
.dmain { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.dmain h1 { font-size: 42px; letter-spacing: -.025em; }
.dmain p { margin: 0; color: var(--soft); }
.dlogo { height: 150px; }
.media { position: relative; overflow: hidden; border-radius: 8px; background: var(--tile); isolation: isolate; }
.media .ph { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; transform: scale(1.07); transition: opacity .8s ease, transform 5.2s cubic-bezier(.2, .6, .2, 1); }
.media .ph.on { opacity: 1; transform: scale(1); z-index: 1; }
.media .chip-logo { position: absolute; left: 10px; bottom: 10px; z-index: 3; width: 64px; height: 44px; border-radius: 6px; background: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,.35); }
.media .chip-logo.plate-dark { background: #0b0b0b; }
.media .chip-logo img { position: absolute; top: 12%; left: 10%; width: 80%; height: 76%; object-fit: contain; }
.media .dots { position: absolute; right: 10px; bottom: 12px; z-index: 3; display: flex; gap: 5px; }
.media .dots i { width: 14px; height: 3px; background: rgba(255,255,255,.45); transition: background-color .3s, width .3s var(--ease); }
.media .dots i.on { width: 22px; background: #ffffff; }
.media::after { content: ""; position: absolute; inset: auto 0 0 0; height: 46%; z-index: 2; pointer-events: none; background: linear-gradient(180deg, transparent, rgba(0,0,0,.42)); }
.media .nav { position: absolute; top: 50%; z-index: 4; width: 44px; height: 44px; margin-top: -22px; appearance: none; border: 0; cursor: pointer; background: rgba(11,11,11,.55); color: #fff; font: 400 18px/1 "DM Sans", Arial, sans-serif; }
.media .nav.prev { left: 0; } .media .nav.next { right: 0; }
.media .nav:hover { background: rgba(11,11,11,.8); }
.feature .media { border-radius: 0; min-height: 240px; border-right: 1px solid var(--line); }
.dphoto { height: 260px; }
@media (max-width: 720px) { .feature .media { border-right: 0; border-bottom: 1px solid var(--line); min-height: 200px; } .dphoto { height: 200px; } }
@media (prefers-reduced-motion: reduce) { .media .ph { transition: opacity .01s; transform: none; } }
.dfoot { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; padding-top: 6px; margin-top: auto; }
.dfoot .cta { width: auto; gap: 32px; }
.claimbox { border: 1px solid var(--border); padding: 16px; display: grid; gap: 6px; background: var(--warm); }
.claimbox strong { font: 900 30px/1 var(--display); text-transform: uppercase; }
.claimbox code { font: 700 14px/1.2 var(--mono); letter-spacing: .14em; color: var(--ink); }

@media (max-width: 1100px) { .cascade { column-count: 2; } }
@media (max-width: 720px) {
  .cascade { column-count: 1; }
  .card { padding: 20px; }
  .feature { grid-template-columns: minmax(0, 1fr); }
  .feature .tile { border-right: 0; border-bottom: 1px solid var(--line); min-height: 170px; }
  .dbody { grid-template-columns: minmax(0, 1fr); padding: 18px; }
  .dhead { padding: 10px 10px 10px 18px; } .dhead p { font-size: 17px; letter-spacing: .12em; }
}
@media (prefers-reduced-motion: reduce) { .card, .tile img, .cta, .cta .arr, .rail-item, .row .plus { transition: none; } }
@media (max-width: 720px) {
  .cascade.tiered { --ru: 196px; gap: 8px; }
  .tiered .card { padding: 8px; gap: 6px; }
  .tiered .card.offer { padding: 8px; gap: 6px; }
  .tiered .wide { display: flex; padding: 10px; gap: 7px; }
  .tiered .wide > .tile, .tiered .wide > .media { min-height: var(--th, 96px); }
  .tiered .wide.h1 { --th: 56px; }
  .tiered .w1 { --th: 72px; } .tiered .w1.h1 { --th: 46px; gap: 5px; }
  .tiered .card h3, .tiered .w1.h1 h3 { font-size: 16px; line-height: 1.02; overflow-wrap: anywhere; }
  .tiered .wide h3 { font-size: 24px; }
  .tiered .card .sum { font-size: 11.5px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .tiered .wide .sum { font-size: 13px; }
  .tiered .w1.h1 .sum { display: none; }
  .tiered .card .between { flex-wrap: wrap; gap: 4px; }
  .tiered .card .stubrow { gap: 3px; flex-wrap: wrap; }
  .tiered .card .between > .mono, .tiered .card > p.cap, .tiered .card .rule, .tiered .card .kv, .tiered .card .long, .tiered .w1 .typ, .tiered .wide.h1 .typ { display: none; }
  .tiered .wide:not(.h1) .long { display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; font-size: 12px; line-height: 1.35; }
  .tiered .card .typ { font-size: 9px; }
  .tiered .card .tag, .tiered .card .stub { font-size: 8px; padding: 3px 5px; letter-spacing: .04em; }
  .tiered .card .stub { padding-left: 7px; padding-right: 8px; }
  .tiered .card .cta { padding: 8px 9px; font-size: 10px; letter-spacing: .05em; min-height: 44px; margin-top: auto; gap: 4px; }
  .tiered .media .chip-logo { width: 34px; height: 24px; left: 5px; bottom: 5px; }
  .tiered .media .dots { right: 5px; bottom: 6px; gap: 3px; } .tiered .media .dots i { width: 7px; } .tiered .media .dots i.on { width: 11px; }
  .tiered .card.open { min-height: 0; } .tiered .card.open .sum { -webkit-line-clamp: 5; } .tiered .card.open .label { font-size: 9px; } .tiered .card.open .glyph { font-size: 18px; }
  .tiered .card.partner { grid-column: span 3; padding: 14px; }
}
`;

/* Prefix every selector with :where(.wall) (no specificity), except the ones that already start at .wall.
   @media blocks are walked into; @keyframes are left alone. */
function scopeCss(css) {
  let out = '', i = 0;
  const scopeSel = sel => sel.split(',').map(s => { s = s.trim(); return /^\.wall\b/.test(s) ? s : ':where(.wall) ' + s; }).join(', ');
  function block(end) {
    while (i < css.length) {
      const ch = css[i];
      if (/\s/.test(ch)) { out += ch; i++; continue; }
      if (ch === '}') { if (end) { out += '}'; i++; return; } i++; continue; }
      const open = css.indexOf('{', i), head = css.slice(i, open).trim();
      i = open + 1;
      if (/^@media/.test(head)) { out += head + ' {'; block(true); continue; }
      let depth = 1, j = i;
      while (depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
      const body = css.slice(i, j - 1); i = j;
      out += (/^@/.test(head) ? head : scopeSel(head)) + ' {' + body + '}';
    }
  }
  block(false);
  return out;
}
const CSS = scopeCss(RAW_CSS);

const OPEN = [
  { kind: 'open', glyph: '✳', tag: 'Bar / lounge', pitch: 'Give quieter weeknights a reason to go out with a music-led offer you control.' },
  { kind: 'partner', title: 'Become a sponsor', pitch: 'Shape a perk around your margins. Your offer sits on every ticket for Vibe Check: After Hours.' },
  { kind: 'open', glyph: '▶', tag: 'Café / day spot', pitch: 'Turn the morning after into a second visit with a daytime perk for ticket holders.' },
];

const DIALOG_HTML = `<div class="dhead"><p id="dTitle"></p>
      <div class="dnav"><button class="x" id="dPrev" aria-label="Previous offer">←</button><span class="mono" id="dPos" aria-live="polite"></span><button class="x" id="dNext" aria-label="Next offer">→</button><button class="x" id="dClose" aria-label="Close offer">×</button></div>
    </div>
    <div class="dbody" id="dBody"></div>
    <p class="cap swipehint">Swipe left or right for more offers · swipe up or down to close</p>`;

function mountWall(FORMAT, container, deckIn, opts) {
opts = opts || {};
const D = window.DeckCore;
const root = opts.root || container.getRootNode();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || typeof gsap === 'undefined';
let deck = deckIn, filter = 'all', destroyed = false;
const nowMs = () => (opts.now != null ? +opts.now : Date.now());

/* the wall's own element (the prototype's .wall, in #embed form), its stage and the dialog */
if (!root.querySelector || ![...root.querySelectorAll('style')].some(s => s.textContent === CSS)) {
  const st = document.createElement('style'); st.textContent = CSS; container.appendChild(st);
}
const wallEl = document.createElement('div');
wallEl.className = 'wall';
wallEl.innerHTML = '<section class="stagewrap"><div id="stage" aria-live="polite"></div></section><dialog id="detail" aria-labelledby="dTitle">' + DIALOG_HTML + '</dialog>';
container.appendChild(wallEl);
const $ = id => wallEl.querySelector('#' + id);
const stage = $('stage');

/* The featured offer advances one sponsor on every page load, so each sponsor takes a turn. */
let rotation = Number.isFinite(opts.rotation) ? opts.rotation : Math.floor(Math.random() * 1000);
let featured = null; // offer index; null until the first render picks this load's turn
const count = () => (deck.count != null ? deck.count : deck.coupons.length);
/* stock: sold out only when both numbers are known and nothing is left */
const hasStock = c => typeof c.remaining === 'number' && typeof c.total === 'number';
const soldOut = c => hasStock(c) && c.remaining <= 0;
// Port change (owner rule, as on the live site): only a sponsor with a published offer can take the featured panel.
// With none, there is no featured panel. Otherwise the prototype's choice is unchanged.
function turnPick(list) { const withOffer = list.filter(o => !o.c.noOffer); if (!withOffer.length) return null; const live = withOffer.filter(o => !soldOut(o.c)), feat = live.filter(o => o.c.featured); const pool = feat.length ? feat : live.length ? live : withOffer; return pool[rotation % pool.length].i; }

/* ---------- tiny DOM helper: text only, never HTML ---------- */
function h(tag, cls, text, attrs) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}
const add = (parent, ...kids) => { kids.forEach(k => k && parent.appendChild(k)); return parent; };
const typeLabel = t => (t === 'Option' ? 'Choice' : t);
const valid = c => `${c.from} – ${c.to} · ${c.year}`;
const slotNo = i => String(i + 1).padStart(2, '0');
const ground = () => (deck.wall.cards === 'white' ? 'light' : 'dark');
const isSim = c => c.terms.some(t => /^Simulated example/.test(t));
const tagText = c => (isSim(c) ? 'Example · ' : '') + typeLabel(c.type);
function logoTile(c, cls) {
  const plate = D.plateFor(c, ground());
  const t = h('div', 'tile' + (cls ? ' ' + cls : '') + (plate ? ' plate-' + plate : ''));
  add(t, h('img', null, null, { src: c._logo, alt: `${c.brand} logo` }));
  return t;
}
function offers() {
  return deck.coupons.slice(0, count()).map((c, i) => ({ c, i }))
    .filter(o => filter === 'all' ? true : filter === 'open' ? false : o.c.type === filter);
}
function ctaBtn(label, onClick, cls) {
  const b = h('button', 'cta' + (cls ? ' ' + cls : ''), null, { type: 'button' });
  add(b, h('span', null, label), h('span', 'arr', '↗', { 'aria-hidden': 'true' }));
  b.addEventListener('click', onClick); return b;
}
/* Expiry stub: a ticket-stub chip with a clock. It reads the real end date; within 7 days it turns
   into the highlighted "Expiring" state, and after the date it reads "Ended". No countdown timers. */
const hasEnd = c => !!c.to;
function endDate(c) {
  const y = parseInt(c.year, 10) || new Date(nowMs()).getFullYear(), fm = +c.from.slice(0, 2) || 1, tm = +c.to.slice(0, 2) || 12, td = +c.to.slice(3) || 28;
  return new Date(y + (tm < fm ? 1 : 0), tm - 1, td, 23, 59, 59);
}
function daysLeft(c) { return Math.ceil((endDate(c) - nowMs()) / 86400000); }
const isExpiring = c => { if (!hasEnd(c)) return false; const d = daysLeft(c); return d >= 0 && d <= 7 && !soldOut(c); };
function tagRow(c, label) {
  const row = h('span', 'stubrow');
  if (c.featured) add(row, h('span', 'tag flag', 'Featured'));
  const tt = noOffer(c) ? '' : label || tagText(c);
  return add(row, tt ? h('span', 'tag', tt) : null, expiryStub(c));
}
/* Live data: a sponsor with no published offer (noOffer) and offers with empty fields. Empty rows are left out;
   a no-offer sponsor shows its role in place of the offer text and links to its site instead of opening a dialog. */
const noOffer = c => c.noOffer === true;
const filled = v => v != null && String(v).trim() !== '';
const hasDates = c => filled(c.from) || filled(c.to);
const offerText = c => (noOffer(c) ? c.role : c.short);
function kvRow(k, v) { return add(h('div', 'kv cap'), h('span', null, k), h('span', null, v)); }
function siteLink(c) {
  if (!/^https?:\/\//.test(c.site || '')) return null;
  const a = h('a', 'cta', null, { href: c.site, target: '_blank', rel: 'noopener noreferrer' });
  return add(a, h('span', null, 'Visit site'), h('span', 'arr', '↗', { 'aria-hidden': 'true' }));
}
const photosOf = c => (D.TIERS[c.tier] ? D.photosFor(c) : (c.photos || []).slice(0, 1)); // Tier 1 shows up to 5 photos, Tier 2 up to 3, Tier 3 one
let carousels = [], dialogCar = null;
/* A photo carousel for an offer, or its logo tile when it has no photos. `withNav` adds arrows (dialog). */
function mediaTile(c, cls, withNav) {
  const ph = photosOf(c);
  if (!ph.length) return logoTile(c, cls === 'dphoto' ? 'dlogo' : null);
  const el = h('div', 'media' + (cls ? ' ' + cls : ''));
  ph.forEach((src, k) => add(el, h('img', 'ph' + (k === 0 ? ' on' : ''), null, { src, alt: k === 0 ? `${c.brand} photo` : '', loading: k === 0 ? 'eager' : 'lazy', draggable: 'false' })));
  const chip = h('span', 'chip-logo' + (D.plateFor(c, 'light') === 'dark' ? ' plate-dark' : '')); add(chip, h('img', null, null, { src: c._logo, alt: `${c.brand} logo` })); add(el, chip);
  const car = { el, n: ph.length, at: 0, hover: false };
  car.go = to => {
    car.at = (to + car.n) % car.n;
    el.querySelectorAll('.ph').forEach((im, k) => im.classList.toggle('on', k === car.at));
    el.querySelectorAll('.dots i').forEach((d, k) => d.classList.toggle('on', k === car.at));
  };
  if (ph.length > 1) {
    const dots = h('span', 'dots', null, { 'aria-hidden': 'true' }); ph.forEach((_, k) => add(dots, h('i', k === 0 ? 'on' : null))); add(el, dots);
    el.addEventListener('pointerenter', () => { car.hover = true; }); el.addEventListener('pointerleave', () => { car.hover = false; });
    if (withNav) {
      const prev = h('button', 'nav prev', '←', { type: 'button', 'aria-label': 'Previous photo' }), next = h('button', 'nav next', '→', { type: 'button', 'aria-label': 'Next photo' });
      prev.addEventListener('click', () => car.go(car.at - 1)); next.addEventListener('click', () => car.go(car.at + 1)); add(el, prev, next);
      dialogCar = car;
    } else carousels.push(car);
  }
  return el;
}
/* Timing: one wall carousel advances every beat, in turn, and the featured panel takes every other
   beat. So something is always changing, but only in one place at a time. Hovered, hidden and
   off-screen carousels wait. The open offer's own photos advance on a slower beat. */
let beat = 0, turn = 0;
function tick() {
  if (document.hidden || reduced) return;
  if (dlg.open) { if (dialogCar && !dialogCar.hover && beat % 2 === 0 && dialogCar.el.isConnected) dialogCar.go(dialogCar.at + 1); beat++; return; }
  const live = carousels.filter(c => c.el.isConnected && !c.hover && (r => r.bottom > 0 && r.top < innerHeight)(c.el.getBoundingClientRect()));
  if (!live.length) return;
  const feat = live.find(c => c.el.closest('.combo > .feature, .spot > .feature')), rest = live.filter(c => c !== feat);
  const pick = feat && (beat % 2 === 0 || !rest.length) ? feat : rest[turn++ % Math.max(1, rest.length)];
  beat++; if (pick) pick.go(pick.at + 1);
}
const timer = setInterval(tick, 1700);
const offerCls = (c, base) => base + (isExpiring(c) ? ' expiring' : '');
function expiryStub(c) {
  if (!hasEnd(c)) return null; // no published end date: no expiry treatment
  const d = daysLeft(c), soon = d >= 0 && d <= 7, ended = d < 0;
  const text = ended ? 'Ended ' + c.to : soon ? (d <= 1 ? 'Ends today' : `Expiring · ${d} days`) : 'Ends ' + c.to;
  const el = h('span', 'stub' + (soon ? ' soon' : '') + (ended ? ' ended' : ''), null, { title: `Valid until ${c.to}, ${endDate(c).getFullYear()}` });
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.6V8l2.3 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
  el.appendChild(svg); el.appendChild(h('span', null, text));
  return el;
}
/* "N left" only when the stock is known */
const leftText = c => (!hasStock(c) ? null : c.remaining > 0 ? `${c.remaining} left` : 'Sold out');
const leftSpan = c => (leftText(c) == null ? null : h('span', 'mono', leftText(c)));

/* ---------- A. Cascade ---------- */
function renderCascade(skip) {
  const wrap = h('div', 'cascade tiered'); // every card takes its sponsor's size on the 3-column grid
  const list = offers().filter(o => o.i !== skip);
  list.forEach(({ c, i }) => {
    const card = h('article', offerCls(c, `card offer w${c.cols} h${c.rows}${c.cols > 1 ? ' wide' : ''}`), null, { 'data-oid': c.id, style: `--w:${c.cols};--h:${c.rows}` });
    const tile = mediaTile(c);
    const r1 = add(h('div', 'between'), tagRow(c), leftSpan(c));
    const typ = noOffer(c) ? '' : c.role || c.where;
    const r2 = add(h('div', 'between'), filled(typ) ? h('p', 'label typ', typ) : null, h('span', 'mono', 'SLOT ' + slotNo(i)));
    const perk = filled(c.limit) ? h('p', 'cap') : null; if (perk) add(perk, h('span', 'star', '✳ ', { 'aria-hidden': 'true' }), document.createTextNode(c.limit));
    const kvs = [hasDates(c) ? kvRow('Valid', valid(c)) : null, filled(c.where) ? kvRow('Where', c.where) : null];
    add(card, tile, r1, r2, h('h3', 'disp', c.brand), filled(offerText(c)) ? h('p', 'sum', offerText(c)) : null, (c.cols > 1 || c.rows > 2) && filled(c.long) ? h('p', 'long', c.long) : null, perk, kvs.some(Boolean) ? h('div', 'rule') : null,
      ...kvs,
      noOffer(c) ? siteLink(c) : ctaBtn('View offer', () => openDetail(i, card)));
    add(wrap, card);
  });
  if (deck.wall.openSlots && (filter === 'all' || filter === 'open')) OPEN.forEach((o, k) => {
    const n = 'SLOT ' + slotNo(count() + k);
    if (o.kind === 'open') {
      const card = h('article', 'card open');
      const foot = add(h('div', 'between'), h('a', 'label', 'Explore the slot ↗', { href: 'https://sponsor.vibecity.art' }), h('span', 'mono', n));
      foot.style.marginTop = 'auto';
      add(wrap, add(card, h('span', 'glyph', o.glyph, { 'aria-hidden': 'true' }), h('p', 'label typ', o.tag), h('p', 'sum', o.pitch), foot));
    } else {
      const card = h('article', 'card partner');
      const a = h('a', 'cta ghost', null, { href: 'https://sponsor.vibecity.art' }); add(a, h('span', null, 'Sponsor us'), h('span', 'arr', '↗', { 'aria-hidden': 'true' }));
      add(wrap, add(card, add(h('div', 'between'), h('p', 'label typ', 'Open sponsor slot'), h('span', 'mono', n)), h('h3', 'disp', o.title), h('p', 'sum', o.pitch), a));
    }
  });
  return wrap.children.length ? wrap : null;
}

/* ---------- shared detail pieces ---------- */
function sidePanel(c) {
  const s = h('div', 'side');
  [['Where', c.where], ['Valid', hasDates(c) ? valid(c) : ''], ['Rules', c.limit]].concat(hasStock(c) ? [['Left', `${c.remaining} of ${c.total}`]] : [])
    .filter(([, v]) => filled(v)).forEach(([k, v]) => add(s, add(h('div'), h('span', 'cap', k), h('b', null, v))));
  if (/^https:\/\//.test(c.site || '')) add(s, add(h('div'), h('span', 'cap', c.role || 'Sponsor'), h('a', 'cap sitelink', 'Visit ' + c.brand + ' ↗', { href: c.site, target: '_blank', rel: 'noopener noreferrer' })));
  return s;
}
function termsList(c) { const ol = h('ol', 'terms'); c.terms.forEach(t => add(ol, h('li', null, t))); return ol; }
function claimArea(c) {
  const box = h('div');
  if (soldOut(c)) {
    const b = ctaBtn('All claimed', () => {}); b.disabled = true; add(box, b);
  } else {
    add(box, ctaBtn('Claim offer', () => { if (typeof opts.onClaim === 'function') opts.onClaim(c.id); }));
  }
  return box;
}

/* ---------- Spotlight panel (used by Featured + Cascade) ---------- */
function featurePanel(c, i, flagged) {
  const feat = h('article', offerCls(c, 'feature'), null, flagged ? { 'data-oid': c.id } : null), body = h('div', 'body');
  const tags = tagRow(c);
  const typ = noOffer(c) ? '' : c.role || c.where;
  const kvs = [filled(c.where) ? kvRow('Where', c.where) : null, hasDates(c) ? kvRow('Valid', valid(c)) : null];
  add(body, add(h('div', 'between'), tags, h('span', 'mono', 'SLOT ' + slotNo(i) + (leftText(c) != null ? ' · ' + leftText(c) : ''))),
    filled(typ) ? h('p', 'label typ', typ) : null, h('h3', 'disp', c.brand), filled(offerText(c)) ? h('p', null, offerText(c)) : null, filled(c.long) ? h('p', null, c.long) : null, kvs.some(Boolean) ? h('div', 'rule') : null,
    ...kvs,
    noOffer(c) ? siteLink(c) : ctaBtn('View offer', () => openDetail(i)));
  return add(feat, mediaTile(c), body);
}
/* ---------- Featured + Cascade: this load's featured sponsor on top, everyone else in the wall ---------- */
function renderFeatured() {
  const list = offers();
  if (!list.length || filter !== 'all') return renderCascade(); // filtered views drop the featured panel and show the plain 2–3 column wall
  if (!list.some(o => o.i === featured && !o.c.noOffer)) featured = turnPick(list);
  if (featured == null) return renderCascade(); // no sponsor has an offer: no featured panel
  const f = list.find(o => o.i === featured), wrap = h('div', 'combo');
  add(wrap, featurePanel(f.c, f.i, true));
  const rest = renderCascade(featured);
  if (rest) add(wrap, rest);
  return wrap;
}

/* ---------- Detail dialog: grows out of the card you opened; swipe or arrow through offers ---------- */
const dlg = $('detail');
let dList = [], dAt = 0, dFrom = null, dBusy = false;
function fillDetail(i) {
  const c = deck.coupons[i];
  $('dTitle').textContent = `Partner offer · ${c.brand}`;
  $('dPos').textContent = `${dAt + 1} / ${dList.length}`;
  $('dPrev').disabled = $('dNext').disabled = dList.length < 2;
  const body = $('dBody'); body.replaceChildren(); body.scrollTop = 0;
  requestAnimationFrame(() => { body.style.touchAction = body.scrollHeight > body.clientHeight + 1 ? 'pan-y' : 'none'; });
  const main = h('div', 'dmain');
  dialogCar = null;
  add(main, mediaTile(c, 'dphoto', true),
    add(h('div', 'between'), tagRow(c), leftSpan(c)),
    h('h1', 'disp', c.brand), filled(c.short) ? h('p', null, c.short) : null, filled(c.long) ? h('p', null, c.long) : null,
    ...(c.terms && c.terms.length ? [h('div', 'rule'), h('span', 'cap', 'How to claim'), termsList(c)] : []));
  add(main, add(h('div', 'dfoot'), claimArea(c)));
  add(body, main, sidePanel(c));
}
const cardFor = i => stage.querySelector(`[data-oid="${deck.coupons[i].id}"]`);
/* Port fix (owner decision): keep the offer dialog a real popup (dimmed backdrop, Escape and a click outside close it).
   GSAP measures an element with no transform and no offsetParent (an open dialog is position: fixed) by moving it to the
   page root for a moment, which silently drops a dialog's modal state; the prototype did this on every clearProps. So GSAP
   measures the dialog while it is closed (dlgReset), and the dialog's own inline transform is cleared by hand (dlgClear)
   instead of with clearProps. The animations are unchanged. */
function dlgClear(all) { if (all) { dlg.removeAttribute('style'); return; } for (const p of ['transform', 'translate', 'rotate', 'scale', 'transform-origin']) dlg.style.removeProperty(p); }
function dlgReset() { gsap.set(dlg, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, lazy: false }); gsap.getProperty(dlg, 'x'); dlgClear(false); }
function openDetail(i, fromEl) {
  if (noOffer(deck.coupons[i])) return; // nothing to open: no-offer sponsors link to their site
  dList = offers().filter(o => !noOffer(o.c)).map(o => o.i); if (!dList.includes(i)) dList = [i];
  dAt = dList.indexOf(i); dFrom = fromEl || cardFor(i);
  fillDetail(i);
  if (!dlg.open) { if (!reduced) dlgReset(); dlg.showModal(); }
  if (reduced) return;
  gsap.killTweensOf([dlg, $('dBody')]);
  dlgClear(false); dlg.style.removeProperty('opacity');
  // FLIP: start at the card's box, settle into the dialog's own box
  const to = dlg.getBoundingClientRect(), from = dFrom && dFrom.isConnected ? dFrom.getBoundingClientRect() : null;
  if (from && from.width > 0) {
    gsap.fromTo(dlg, { x: from.left - to.left, y: from.top - to.top, scaleX: from.width / to.width, scaleY: from.height / to.height, transformOrigin: '0 0', opacity: 1 },
      { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, duration: 0.5, ease: 'expo.out', onComplete: () => dlgClear(false) });
  } else gsap.fromTo(dlg, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out', onComplete: () => dlgClear(false) });
  gsap.fromTo([dlg.querySelector('.dhead'), $('dBody')], { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.14, ease: 'power1.out' });
}
function closeDetail() {
  if (!dlg.open || dBusy) return;
  const target = cardFor(dList[dAt]);
  if (reduced || !target) { dlg.close(); return; }
  dBusy = true;
  const from = dlg.getBoundingClientRect(), to = target.getBoundingClientRect();
  gsap.to([dlg.querySelector('.dhead'), $('dBody')], { opacity: 0, duration: 0.12 });
  gsap.to(dlg, { x: to.left - from.left, y: to.top - from.top, scaleX: to.width / from.width, scaleY: to.height / from.height, transformOrigin: '0 0', opacity: 0, duration: 0.3, ease: 'power3.inOut',
    onComplete: () => { dlg.close(); gsap.set([dlg.querySelector('.dhead'), $('dBody')], { clearProps: 'all' }); dlgClear(true); dBusy = false; } });
}
/* step to the next or previous offer; the content slides out one way and in from the other */
function stepDetail(dir) {
  if (dList.length < 2 || dBusy) return;
  dAt = (dAt + dir + dList.length) % dList.length;
  const body = $('dBody'), swap = () => fillDetail(dList[dAt]);
  if (reduced) { swap(); return; }
  dBusy = true;
  gsap.to(body, { x: -40 * dir, opacity: 0, duration: 0.14, ease: 'power2.in', onComplete: () => {
    swap(); gsap.fromTo(body, { x: 40 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.26, ease: 'power3.out', clearProps: 'transform', onComplete: () => { dBusy = false; } });
  } });
  dlgClear(false);
}
$('dClose').addEventListener('click', closeDetail);
$('dPrev').addEventListener('click', () => stepDetail(-1));
$('dNext').addEventListener('click', () => stepDetail(1));
dlg.addEventListener('cancel', e => { e.preventDefault(); closeDetail(); });
const onKey = e => {
  const t = (e.composedPath && e.composedPath()[0]) || e.target;
  if (!dlg.open || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  if (e.key === 'ArrowRight') stepDetail(1); else if (e.key === 'ArrowLeft') stepDetail(-1);
  else if (e.key === 'Escape') { e.preventDefault(); closeDetail(); }
};
document.addEventListener('keydown', onKey);
/* swipe: the sheet follows the finger; past the threshold it changes offer (sideways) or closes (down) */
let sw = null;
dlg.addEventListener('pointerdown', e => {
  if (dBusy || e.target.closest('button, a, input, select, textarea')) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const body = $('dBody');
  sw = { x: e.clientX, y: e.clientY, axis: null, id: e.pointerId, head: !!e.target.closest('.dhead'), scrolls: body.scrollHeight > body.clientHeight + 1, top: body.scrollTop <= 0, bottom: body.scrollTop + body.clientHeight >= body.scrollHeight - 1 };
});
dlg.addEventListener('pointermove', e => {
  if (!sw || e.pointerId !== sw.id) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (!sw.axis) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    // vertical drags move the sheet, unless the content itself still has room to scroll that way
    const canDragY = sw.head || !sw.scrolls || e.pointerType === 'mouse' || (dy > 0 ? sw.top : sw.bottom);
    sw.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : (canDragY ? 'y' : 'none');
    if (sw.axis !== 'none') { try { dlg.setPointerCapture(sw.id); } catch (err) { /* not capturable */ } }
  }
  if (sw.axis === 'x') { gsap.set(dlg, { x: dx * 0.9, rotation: dx * 0.01, opacity: 1 - Math.min(0.4, Math.abs(dx) / 600) }); e.preventDefault(); }
  else if (sw.axis === 'y') { gsap.set(dlg, { y: dy, opacity: 1 - Math.min(0.6, Math.abs(dy) / (dlg.offsetHeight * 0.4) * 0.5) }); e.preventDefault(); } // follows the finger 1:1, up or down
});
function endSwipe(e) {
  if (!sw || e.pointerId !== sw.id) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y, axis = sw.axis; sw = null;
  if (axis === 'x' && Math.abs(dx) > 70 && dList.length > 1) {
    const dir = dx < 0 ? 1 : -1;
    dBusy = true;
    gsap.to(dlg, { x: -dir * innerWidth * 0.5, opacity: 0, duration: 0.16, ease: 'power2.in', onComplete: () => {
      dAt = (dAt + dir + dList.length) % dList.length; fillDetail(dList[dAt]);
      gsap.fromTo(dlg, { x: dir * innerWidth * 0.35, rotation: 0, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'power3.out', onComplete: () => { dlgClear(false); dBusy = false; } });
    } });
  } else if (axis === 'y' && Math.abs(dy) > dlg.offsetHeight * 0.4) { // past 40% of the card's height, in either direction: close
    gsap.to(dlg, { y: Math.sign(dy) * innerHeight * 0.7, opacity: 0, duration: 0.22, ease: 'power2.in', onComplete: () => { dlg.close(); gsap.set([dlg.querySelector('.dhead'), $('dBody')], { clearProps: 'all' }); dlgClear(true); } });
  } else if (axis === 'x' || axis === 'y') gsap.to(dlg, { x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.3, ease: 'power3.out', onComplete: () => dlgClear(false) });
}
dlg.addEventListener('pointerup', endSwipe); dlg.addEventListener('pointercancel', endSwipe);
stage.addEventListener('pointermove', e => {
  const el = e.target.closest('.card.offer, .feature'); if (!el) return;
  const r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px');
}, { passive: true });
dlg.addEventListener('click', e => { if (e.target === dlg && !sw) closeDetail(); });

/* ---------- Render ---------- */
function render(animate = true) { paint(animate); }
function nameItems(view) {
  if (!view) return;
  view.querySelectorAll('[data-oid]').forEach(el => { el.style.viewTransitionName = 'o-' + el.dataset.oid; });
}
function paint(animate) {
  carousels = [];
  const w = deck.wall;
  wallEl.dataset.theme = w.theme; wallEl.dataset.cards = w.cards; wallEl.dataset.layout = FORMAT;
  const view = (FORMAT === 'featured' ? renderFeatured : renderCascade)();
  nameItems(view);
  stage.replaceChildren(view || h('p', 'empty', 'No offers match this filter yet. Choose All to see every offer.'));
  if (animate && !reduced && view) {
    const items = view.matches('.spot') ? [view.firstChild, ...view.lastChild.children] : view.matches('.combo') ? [view.firstChild, ...(view.children[1] ? view.children[1].children : [])] : [...view.children];
    // entrance: each card wipes up from its bottom edge and settles, one after another; its logo lands a beat later
    gsap.fromTo(items, { opacity: 0, y: 34, scale: 0.965, clipPath: 'inset(0% 0% 100% 0%)' },
      { opacity: 1, y: 0, scale: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, stagger: 0.06, ease: 'expo.out', clearProps: 'transform,opacity,clipPath' });
    const logos = items.map(el => el.querySelector && el.querySelector('.tile img')).filter(Boolean);
    gsap.fromTo(logos, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, delay: 0.18, stagger: 0.06, ease: 'back.out(1.6)', clearProps: 'transform,opacity' });
  }
}

function prepare() {
  return Promise.all(deck.coupons.map(D.loadImg)).then(() => deck.coupons.forEach(c => {
    const cv = c._img ? D.drawUploadedLogo(c._img) : D.drawLogo(c);
    try { c._logo = cv.toDataURL(); } catch (e) { c._logo = c.logoImg || c.logoSrc || D.drawLogo(c).toDataURL(); } // cross-origin logo: use its URL
  }));
}

(async function boot() {
  try { await Promise.race([document.fonts.load('900 60px "Barlow Condensed"'), new Promise(r => setTimeout(r, 2000))]); } catch (e) { /* fallback fonts */ }
  await prepare();
  if (destroyed) return;
  render();
})();

return {
  update(d) { deck = d; prepare().then(() => { if (!destroyed) render(false); }); },
  destroy() {
    destroyed = true;
    clearInterval(timer);
    document.removeEventListener('keydown', onKey);
    if (typeof gsap !== 'undefined') gsap.killTweensOf([dlg, dlg.querySelector('.dhead'), $('dBody'), ...stage.querySelectorAll('*')]);
    if (dlg.open) dlg.close();
    container.replaceChildren();
  },
};
}

window.VCWallRenderers = window.VCWallRenderers || {};
['featured', 'cascade'].forEach(format => {
  window.VCWallRenderers[format] = { css: CSS, fonts: FONTS.slice(), needs: ['gsap'], mount: (container, deck, opts) => mountWall(format, container, deck, opts) };
});
})();
