# Wall renderer contract (exact port of the prototype walls)

Goal: each wall format renders and animates EXACTLY as its prototype page on branch
`claude/coupon-claim-interface-cb9xst` (`offerwall.html`, `vouchers.html`, `cutouts.html`). Exact means the prototype's
own code and CSS, copied, not re-created. Only the changes listed under "Allowed changes" may differ.

## Files (one owner per file)
- `assets/sponsor-wall/deck-core.js` — verbatim copy of `shared/deck-core.js`. Shared. Do not edit.
- `assets/sponsor-wall/wall-offerwall.js` — formats `featured` (Featured + Cascade) and `cascade`. Source: `offerwall.html`.
- `assets/sponsor-wall/wall-vouchers.js` — format `vouchers`. Source: `vouchers.html`.
- `assets/sponsor-wall/wall-cutouts.js` — format `cutouts`. Source: `cutouts.html`.
- `test/<name>-harness.html`, `tests/parity-<name>.test.mjs` — each renderer's own harness and parity test.
- `assets/sponsor-wall/sponsor-wall.js` (the custom element) — owned by the integrator. Do not edit.

## Interface
```js
window.VCWallRenderers = window.VCWallRenderers || {};
window.VCWallRenderers['<format>'] = {
  css: '...',          // the prototype's CSS for the wall, its cards, carousels, dialog and animations; page chrome removed
  fonts: ['https://fonts.googleapis.com/css2?...'],  // exactly the font URLs the prototype loads for the wall
  needs: ['gsap'],     // or ['gsap', 'ScrollTrigger'] — the libraries the prototype uses (GSAP 3.12.5 from cdnjs)
  mount(container, deck, opts) { ...; return { update(deck) {}, destroy() {} }; }
};
```
- `container`: an element inside a ShadowRoot. Render inside it only. Look up your nodes inside `opts.root`
  (the ShadowRoot), never `document`, except for the window/document-level listeners the prototype itself uses
  (scroll, resize, keydown, visibility), which must be removed in `destroy()`.
- `deck`: `{ coupons, wall }`, the same shape the prototype gets from `DeckCore.load()`:
  `coupons` are prototype coupon objects (see `SAMPLE` in deck-core.js), `wall` is `DeckCore.wallOf(...)`.
  Do the prototype's own `prepare()` step (loadImg, drawLogo, `_logo`) inside `mount`.
- `opts`: `{ root: ShadowRoot, now?: number /* ms, for expiry; default Date.now() */, rotation?: number /* featured
  rotation index; default as the prototype computes */, onClaim?(couponId) }`.

## Allowed changes (list every one you make in a comment at the top of your file and in your report)
1. Scope: `document.getElementById/querySelector` → lookups inside `opts.root`; CSS `:root`/`body`/`html` rules that
   style the wall move to the wall's container; nothing outside the container is styled.
2. Remove page chrome: page header, nav, layout switcher, filter bars, theme toggles, editor links, the "Replay"
   button and similar demo controls. Keep everything that is part of the wall: cards, carousels, featured panel,
   expiry stubs/stickers, badges, glow, the open-offer dialog and its swipe/drag/arrows/keys, entrance and scroll animations.
3. No storage: no localStorage/BroadcastChannel/DeckCore.load/save/subscribe. Data only comes from `deck`.
4. No fake claims: no simulated claim codes, fake QR or "N of M left" counters. If `remaining`/`total` are missing
   (undefined), do not show counters or stack heights. The Claim button calls `opts.onClaim(id)`.
5. Determinism hooks: `opts.now` and `opts.rotation` replace `Date.now()` and the per-browser stored rotation.
6. Global GSAP state: never call `gsap.globalTimeline.timeScale(...)` or other global GSAP settings; if the prototype
   sets a global time scale, apply the same factor to your own timelines instead, so timing is unchanged.
Anything else that differs from the prototype is a defect.

## Proof (required before you report done)
`tests/parity-<name>.test.mjs` (node:test + Playwright Chromium, `createRequire(import.meta.url)('playwright')`):
- Load the prototype page and your harness with the SAME deck (DeckCore.SAMPLE through the same normalize path),
  the same fixed time (Playwright `page.clock`), same rotation, same viewport, same fonts loaded.
- Final state: screenshot the wall region in both at 390, 768 and 1280 px wide, for each format you own and both card
  colours (dark, white). Fail on > 0.5% differing pixels (use pixelmatch-free comparison: decode PNGs with
  Playwright's page and compare via canvas getImageData, or write raw RGBA via `page.evaluate`).
- Animation: pause the GSAP global timeline before the entrance runs, then for t in [0.05, 0.15, 0.3, 0.6, 1.0, 2.0] s
  seek both to t and compare frames (same threshold). Do the same for one carousel advance and for opening the offer
  dialog. For cut-outs, scroll-triggered drops at fixed scroll positions.
- Report the measured differing-pixel percentage for every comparison.
