# Wiring the Offer wall tab into the page designer (target repo)

Applies to `vibecitygit/vibe-city-checkout-payments`, not yet pushed (waiting on the portal session).

1. Copy `portal/offer-wall-tab.js` to `portal/offer-wall-tab.js` in the target repo.
2. `portal/index.html`: add `<script src="/assets/sponsor-wall-schema.js" defer></script>` before
   `/portal/page-effects.js`, and `<script src="/portal/offer-wall-tab.js" defer></script>` after it.
3. `portal/page-effects.js`:
   - Add a tab button `Offer wall` (`data-pe-tab="wall"`) to the tab list, next to Shader layer, Scroll animation
     and Smooth scroll.
   - In the view setup, before the first draw: `let wall = await window.VCOfferWallTab.load(api);`
   - In `draw()`, when `tab==='wall'`, render `window.VCOfferWallTab.html(esc, wall)` in the fields panel
     (the preview panel shows the chosen format's name).
   - After the tab's markup is in place: `window.VCOfferWallTab.bind(main.querySelector('#peFields'), wall, { api, redraw: draw })`.
   - The tab keeps its own Save draft and Publish buttons. Page designer's buttons stay for the other tabs.
4. Do not add a nav item in `portal/app.js` or `portal/admin.js`: the Offer wall is a tab, not a page.
5. Worker: `GET /ops-api/sponsor-wall` and `POST /ops-api/sponsor-wall` (with `version`, `action`, `draft`), per
   the Phase 1 plan. Until then the tab shows an error on load.
