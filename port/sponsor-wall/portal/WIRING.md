# Wiring the Offer wall into the Page designer (target repo)

Target: `vibecitygit/vibe-city-checkout-payments`. Done locally on `claude/busy-thompson-c1lfge` as commit `fedd8c5`
(not pushed; waiting on the portal session). Gate passed locally: `npm run check`, `npm run build`, `npm test` (50/50).

The Page designer menu item has three tabs: Page content, Page effects and Offer wall. Page effects no longer
appears as its own menu item.

Files changed in the target:
- `assets/sponsor-wall-schema.js` (new): the settings schema, shared by the portal tab and the Worker.
- `portal/offer-wall-tab.js` (new): the Offer wall tab: format selector, card stock, open slots, cut-out spacing,
  Save draft and Publish. It reads and saves through `/sponsor-wall`.
- `portal/app.js`: `pageDesigner()` draws the three tabs; `contentView(host)` renders into the designer body;
  `state.pdTab` remembers the tab; `page-effects` removed from the menu and from the view loader.
- `portal/admin.js`, `portal/runtime.js`: `page-effects` removed from the menu definitions and the view list.
- `portal/index.html`: schema and tab scripts added after `/portal/page-effects.js`.
- `tests/page-effects.test.mjs`: asserts the designer wiring and that Page effects is not its own menu item.
- `AGENTS.md`: owner-authorization entry for the change.

Known gaps:
- The Page content tab keeps its own heading, so the designer's heading appears above it as well.
- The Worker endpoints `GET/POST /ops-api/sponsor-wall` and `GET /public-sponsor-wall` are not built yet, so the
  Offer wall tab shows an error on load until they are.
- Per-sponsor tier and size controls are still to be added to the Offer wall tab.
