# Sponsor Drops → tickets.vibecity.art: handoff plan

Target repo: `vibecitygit/vibe-city-checkout-payments`, `main` at `a69172b` (Nov 12, 2026, the latest Sites publish).
Source: this repo, `claude/coupon-claim-interface-cb9xst`.

## Summary

Port the deck as a **self-contained block in an iframe** that reads the **same offer data the existing offer browser already gets**. Drop the prototype's editor, storage, fake QR and wallet, and send "Claim" to the site's existing claim flow.

Most of the work happens here, before Codex starts: refactor the deck into a production **port kit**. That leaves Codex one small task. It copies one folder, adds about 30 lines to `page-shell.js`, adds a test, a doc and an AGENTS.md entry, and runs the repo checks. No new database tables, Worker routes or environment settings.

## What the checkout repo already has (and what it changes)

| Fact in the repo | Consequence for the port |
|---|---|
| Plain JS, no bundler. `scripts/build.mjs` copies `assets/` to `dist/` recursively. | Put everything under `assets/sponsor-drops/`, so no build-script change is needed. |
| GSAP 3.12.5 is already loaded from cdnjs (same version as the deck). Three.js is **not** used anywhere (the offer browser uses its own small WebGL shader). | Vendor Three.js under `assets/vendor/three/` with its MIT licence, like `assets/vendor/paper-shaders/`. |
| Partner offers are published in the portal and served by `GET /public-offers` (`worker/offers.js`). The page passes them to `VibeOfferBrowser.mount(section, data)`. `previews/page-shell/page-shell.js` **already wraps that mount** to place `#confirmedOffers` in the Offers view. | Hook the same wrapper and hand the deck the **identical `data` object**. Mock mode, live mode, "coming soon" and example offers then behave exactly like the offer browser, with no new fetch. |
| Offer fields: `id`, `type` (`discount` / `freebie` / `option`), `title`, `description`, `summary`, `partnerName`, `logoUrl`, `terms`, `redemptionInstructions`, `address`, `startsAt`, `expiresAt`, `timezone`, `rules`… All are rendered as text, never HTML. | Map these to the deck's fields (table below). The deck's three promotion types are already the same set. |
| Claims are **per ticket**: `GET /orders/{orderId}/offers/{offerId}/allocation` returns `{total, remaining}` for the visitor's own order. There is **no event-wide "N of M left" inventory** (`rules` has only `onePerPerson`, `eligibleTicketTypes`, `repeatIntervalMinutes`, `staffRoles` and `attendanceRequired`). | The deck's "42 of 120 left" counter and its stack heights have no data source yet. Phase 1 hides the counter and uses a uniform stack. A public inventory count is a separate decision for the owner (Phase 3). |
| `sponsor_coupons` (migration 0018) are **sponsor admissions** (free tickets emailed to a sponsor), not consumer offers. | Do not connect the deck to `sponsor_coupons`. It shows partner **offers**. |
| Claim, QR, voucher binding and account already exist (`offer-browser.js`, `claim-qr.js`, `/coupon-bindings`, `/account/`). | Don't port the deck's demo QR, "Link account" or wallet. **Claim** goes to the existing offer page (`#offer/{id}`), where *Claim now* already lives. |
| Page effects (Nov 11) shows the house pattern for a configurable feature: a shared schema file, BUCKET JSON with draft/publish, a portal screen, a `/public-…` route and a test file. | Optional Phase 2 copies that pattern for the deck's display settings. |
| AGENTS.md is a change-control log. Each change needs an owner-authorization entry and lands as a **PR to `main`, not a deployment** (publishing is a separate OpenAI Sites step). | Codex adds one AGENTS.md entry and opens a PR. Nothing is deployed. |
| Node ≥ 24 is required. `npm run check && npm test && npm run build` is the gate. | Put these commands in the Codex prompt as the acceptance check. |

## Why an iframe (it causes the fewest errors)

The prototype is a full-screen app. Mounting it straight into the page would collide with the live site in five places, and each would need careful edits in shared files:

1. **`gsap.globalTimeline.timeScale(2)`**: the deck halves *all* GSAP durations. On the live page that would also speed up checkout, ticket-stack and payment animations.
2. **Full-screen overlays** at z-index 50/60, plus a page-wide Escape handler, would fight the site's `<dialog>`s, the buy bar and Lenis.
3. **Viewport maths:** picking, the hover label and the counters assume the canvas fills the window.
4. **Page effects** would apply its scroll blur-out to the block, and page-shell's swipe handling would steal drags.
5. **CSS name clashes** (`.card`, `.btn`, `.face`, `.zone`, `.hint`, `.toast`…) with the site's global stylesheets.

A same-origin iframe isolates all five. Its CSS, JS and GSAP clock are its own. The deck's embed mode already exists (`index.html#embed` in the prototype): it fits the block's width, sends its height to the parent page, and takes spacing from the parent through `postMessage`.

Known costs, with mitigations:
- **Lenis does not see wheel events over the iframe.** The page falls back to native scrolling while the pointer is over the block. Mitigation: the deck forwards `wheel` deltas to the parent (`{type:'deck-wheel', dy}`), and the parent calls its Lenis `scrollTo`. This is about 5 lines; it is optional.
- **An opened coupon is limited to the iframe's box.** Mitigation: the deck sends `deck-open` / `deck-close`, and the parent sets the iframe to `position:fixed; inset:0; z-index` above the header while it is open. Then the coupon presents full screen like the prototype.

## Phases (one PR each)

### Phase 0: port kit (here, by Claude, no Codex usage)
Build `port/sponsor-drops/` in this repo, ready to drop in:
- `index.html`, `deck.js`, `deck.css`: embed mode only. No header, wallet or editor link. Only the `mount` data source, no localStorage store.
- `adapter.js`: a **pure** `offersToCoupons(data)` that mirrors the offer browser's entry filtering (published `active` partner offers, topped up with examples to 3), then maps fields as in the table below. Testable in Node.
- Remove the global GSAP time scale; speed is set per timeline inside the deck.
- **Claim** posts `{type:'deck-claim', offerId}` to the parent. **Terms** shows `terms` / `redemptionInstructions` on the card's back face.
- Logos are loaded with `crossOrigin='anonymous'`. If loading or canvas reads fail (a cross-origin image without CORS), it falls back to the monogram. This matters because a tainted image breaks both the WebGL texture and `logoColor`.
- Counter and stack height are **off by default** (no inventory source). They can be enabled by passing `allocation: {[offerId]: {total, remaining}}`.
- `assets/vendor/three/three.min.js` (r128) + LICENSE.
- `parent-snippet.js`: the exact code Codex pastes into `page-shell.js`.
- `sponsor-drops.test.mjs`: adapter mapping, message contract, and "no `globalTimeline` mutation".
- Verified here in a headless browser against the **mock data shape copied from `experience-config.js`**.

### Phase 1: drop-in (one Codex task, Sonnet-sized)
Files Codex touches (nothing else):
- `assets/sponsor-drops/**`: copied from the kit.
- `assets/vendor/three/**`: copied from the kit.
- `previews/page-shell/page-shell.js`: about 30 lines from `parent-snippet.js`:
  - inside the existing `VibeOfferBrowser.mount` wrapper: create or update `<section id="sponsorDrops" class="sponsor-drops" data-page-swipe-ignore data-lenis-prevent>` holding the iframe, directly **after** `#confirmedOffers` in `slots[2]`, then post `data` to it;
  - `placeOffers()` keeps `#sponsorDrops` right after `#confirmedOffers`;
  - handle `deck-height`, `deck-claim` (→ `location.hash = '#offer/'+id`, then `window.VCOpenOffers()`), and `deck-open` / `deck-close` (full-screen toggle).
- `previews/page-shell/page-shell.css`: block frame styles. These reuse the offers panel look already in the stylesheet (1px border, translucent fill, square corners).
- `tests/sponsor-drops.test.mjs`: copied from the kit, then added to the `npm test` script.
- `docs/SPONSOR-DROPS.md` and an AGENTS.md "Authorized Sponsor Drops block — <date>" entry.

Acceptance: `npm run check && npm test && npm run build` pass on Node 24, and `dist/assets/sponsor-drops/` exists. In mock mode, the Offers view shows the deck under the offer browser on 375px and 1280px screens. Claim opens the matching offer. The checkout flow and timings are unchanged.

### Phase 2 (optional): portal settings (one Codex task)
Copy the Page effects pattern exactly:
- `assets/sponsor-drops-schema.js`: `enabled`, `cardStyle` (`paper` / `dark`), `columns` (auto, or 1–5), `cardWidth` (desktop and phone), `gapMode` (`max` / `manual`), `gapCap`, `gap`, `maxContentWidth`.
- `worker/sponsor-drops.js` with `GET/POST /ops-api/sponsor-drops` (admin) and `GET /public-sponsor-drops`, using BUCKET `site-content/sponsor-drops.json` with history.
- `portal/sponsor-drops.js`, under *Content & design*. Its sliders and live preview reuse the prototype's `preview.html` controls and maths (content width = device − 2×gutter − 2×padding, then the maximised gap).
- Tests that mirror `tests/page-effects.test.mjs`.

### Phase 3 (needs the owner's decision): "N left" counters
Pick one:
- (a) **Per visitor:** when a booking is bound, pass the existing allocation (`remaining/total` per offer) to the deck. No backend change. It only shows for visitors with a linked ticket.
- (b) **Event-wide:** add a cached, read-only aggregate (claims vs. eligible tickets per offer) to `/public-offers`. This needs a Worker change and tests, and it publishes claim volume.

## Field mapping (offer → deck coupon)

| Deck | Offer source | Notes |
|---|---|---|
| `id` | `id` | |
| `brand` | `partnerName` → business name → `title` | |
| logo | `logoUrl` | Falls back to a monogram drawn from `brand`. The colour comes from the logo, else a neutral one. |
| `short` (front, table card) | `summary` → first sentence of `description` | Text only. |
| `long` (back) | `description` + `businessDescription` | |
| `type` | `type` | Labels match the portal: Discount / Freebie / **Choice** (for `option`). |
| `terms[]` | `terms` split by line, plus `redemptionInstructions` | |
| `where` | `address` | |
| `limit` | `rules.onePerPerson ? '1 per person' : ''` | |
| `from` / `to` / `year` | `startsAt` / `expiresAt` in `timezone` (default Asia/Manila) | Formatted with `Intl`, MM/DD. Coming soon: "Details to come". |
| `remaining` / `total` | not available (see Phase 3) | Counter hidden. |

## Codex usage: keeping it to one short task

- Use **one task per phase**, with the full prompt below pasted as-is. The prompt names every file and the acceptance commands, and forbids other edits.
- Codex copies prepared files rather than writing the deck. The 3D and animation code, which is where most mistakes would happen, is already built and tested in the kit.
- Codex should start from `main` at a fresh pull, not from any `claude/*` branch.

### Phase 1 prompt (ready once the Phase 0 kit is merged here)

> Owner-authorized change: add the Sponsor Drops block below the partner offers in the Offers view. PR to `main` only, no deployment. Read AGENTS.md first and add an "Authorized Sponsor Drops block" entry.
> 1. Copy `port/sponsor-drops/assets/**` from `vibecitygit/vibe-sponsor-claims-limited` (branch `claude/coupon-claim-interface-cb9xst`) to `assets/` unchanged.
> 2. In `previews/page-shell/page-shell.js`, paste `port/sponsor-drops/parent-snippet.js` where its header comment says (inside the existing `VibeOfferBrowser.mount` wrapper and `placeOffers`). Add `port/sponsor-drops/page-shell.css` to the end of `previews/page-shell/page-shell.css`.
> 3. Copy `port/sponsor-drops/sponsor-drops.test.mjs` to `tests/`, and append `tests/sponsor-drops.test.mjs` to the last `node --test` group in `package.json` → `scripts.test`.
> 4. Add `docs/SPONSOR-DROPS.md` from the kit's README.
> Do not edit any other file. Do not change GSAP, Lenis, page effects, checkout, payment, worker or schema code.
> Done when `npm run check && npm test && npm run build` pass on Node 24, and `dist/assets/sponsor-drops/index.html` exists.

## Risks and how the plan covers them

| Risk | Covered by |
|---|---|
| The deck changes site-wide animation timing | Iframe isolation, plus a test asserting no `gsap.globalTimeline` mutation. |
| Cross-origin logos break WebGL or colour extraction | `crossOrigin` loading with a monogram fallback. |
| The offers block moves or exceeds its 1600px cap test | The deck is a separate section after `#confirmedOffers`; `qa.js` checks only `#confirmedOffers`. |
| Swipe gestures or page effects act on the block | `data-page-swipe-ignore` (already honoured by page-shell) and `data-lenis-prevent`. If the owner wants no blur on the block, page effects needs an exclusion selector. That's a one-line change, decided in Phase 1 review. |
| Showing an invented "N left" | Counter off until Phase 3 provides a real source. |
| Repo instructions not followed | The AGENTS.md entry, PR-only scope and named files are all in the prompt. |
| WebGL unavailable | The kit shows a plain card grid using the same coupon faces (DOM only). |
