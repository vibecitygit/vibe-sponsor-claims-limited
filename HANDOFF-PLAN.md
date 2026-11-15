# Sponsor wall → tickets.vibecity.art and the portal: port plan

Rewritten Nov 15, 2026. It replaces the earlier plan, which covered only the 3D card deck in an iframe (still in git history at `56fa00a`). The card deck is out of scope here.

- **Source:** `vibecitygit/vibe-sponsor-claims-limited`, branch `claude/coupon-claim-interface-cb9xst`, commit `609b7eb` or later. Files: `offerwall.html`, `vouchers.html`, `cutouts.html`, `editor.html`, `shared/deck-core.js`. Use the GitHub branch as the source of truth, not the Claude share link or the artifact page.
- **Target:** `vibecitygit/vibe-city-checkout-payments`, `main` surveyed at `3d44e42`. `main` moves often; before each phase run
  `git diff --stat 3d44e42..origin/main -- previews/page-shell offer-browser.js experience.js returning-guests.js worker/offers.js worker/portal-api.js worker/page-effects.js portal/app.js portal/runtime.js portal/admin.js scripts package.json AGENTS.md`
  and re-read anything that changed.

## What is being built

1. **Tickets site:** the Offers view shows one sponsor wall in place of today's offer browser. Which format it shows (Featured + Cascade, Cascade, Voucher wall, Cut-out wall, or the current offer browser) is a published backend setting.
2. **Portal:** a "Sponsor wall" screen with the prototype editor's controls (format, card colour, each sponsor's tier and size, cut-out spacing, live preview), open only to people who have been assigned access.
3. **1:1:** the wall on the site matches the prototype at the same data and width, proven by screenshot comparison, not by eye.

## Decisions needed from you before any code is written

| # | Decision | Why it blocks | My recommendation |
|---|---|---|---|
| 1 | **How many sponsors can be on the wall.** Today at most **3 offers** can be public per event (`portal_offers` has one offer per slot, slots 1–3). The prototype shows 8. | A 3-column wall with three pieces is not a wall. | Fill the wall from **sponsor placements** (partners ≤3, featured ≤5, minor ≤10), which already exist. A sponsor with a published offer gets a claimable piece; one without gets a logo piece that links to their site. No database change. Raising the 3-offer cap is a separate, later change. |
| 2 | **Where a sponsor's tier comes from.** No tier exists on offers. Placements have partners, featured ₱5,000 / ₱3,000, and minor. | Tier caps size and photos. | Default from placements: partners and ₱5,000 → Tier 1, ₱3,000 → Tier 2, minor → Tier 3. The wall editor can override per sponsor. |
| 3 | **Who gets "assigned access".** The portal has only owner, admin, business manager and partner claim staff. Nothing grants one person one feature. | Decides the access design. | Owner and admins always have it. The owner can also assign named portal members as wall editors. Business managers editing their own piece is an optional later phase. |
| 4 | **"N left" and limited claims.** The site has no stock count per offer; claims are one per ticket. | The prototype's "96 of 150 left" is simulated. | Leave counters and limited claims off at launch. |
| 5 | **Cut-out wall fonts.** It uses eight display fonts the site doesn't load. | Needed only if that format can be chosen. | Load them from Google Fonts only when the cut-out format is published. |

The plan below assumes the recommendations. Changing #1 or #3 changes Phase 1.

## Facts in the tickets repo that shape the port

| Fact | Consequence |
|---|---|
| The live Offers view is built by `previews/page-shell/page-shell.js` (despite the folder name). It creates `section#confirmedOffers` and wraps `VibeOfferBrowser.mount`. | The swap happens in that wrapper. Nothing else needs to move. |
| `offer-browser.js` and `offer-browser.css` are also used by the portal's offer preview, by `tests/offers.test.mjs` and `tests/packaged-templates.test.mjs`, and the CSS styles the nav, top bar and install prompt. | **Do not delete or stop loading them.** Replace by not mounting, not by removing. |
| Claiming: the offer browser's "Claim now" opens a modal whose button calls `window.VCRetrievePurchaseQR` (`returning-guests.js`). `#vcPurchaseSummary` sits in the Offers view outside the wall. | The wall's Claim button calls `VCRetrievePurchaseQR` directly. Keep `#vcPurchaseSummary`, `claim-qr.js`, and the `#offers` / `#offer/{id}` routes. Drop the prototype's fake claim codes. |
| `assets/tickets-v2.js` forces a 14px minimum font size on every element with text and re-applies it on every DOM change. Global CSS styles `.card`, `.offer-*`, `.modal` across seven stylesheets. Page effects blur `.offer-card` and `.offer-browser` on scroll. | Mounted straight into the page, the wall cannot be 1:1. It must be isolated (next section). |
| Page effects is the house pattern for a published setting: shared schema file, R2 JSON with draft/publish and history, admin API, public route, portal screen, tests, docs. | Copy that pattern file for file. No database migration. |
| New files are silently left out unless listed: `npm test` is a hand-written chain, `scripts/build.mjs` copies fixed lists (everything under `assets/` is copied), `scripts/build-portal.mjs` concatenates named Worker files into one scope. | Public files go under `assets/sponsor-wall/`. The Worker file and test file are added to their lists by name. Worker helpers use an `sw` prefix. |
| `/public-offers` also feeds order snapshots and sponsor coupons. | Do not change its shape. The wall gets its own route. |
| Offer photos already exist (`photos[]`, up to 20, with `enabled`). Images are capped at 2 MB. | Photos map directly; the tier limit (5 / 3 / 1) is applied when rendering. |
| No ScrollTrigger on the site; GSAP 3.12.5 core is loaded. | The cut-out wall's drop-on-scroll is rebuilt on `IntersectionObserver` in the kit. No new library. |
| The built `dist/index.html` runs scripts in a different order from source. | The wall registers itself and waits for data; it never assumes another script has run. |
| AGENTS.md: every change needs a dated owner-authorization entry, lands as a PR to `main`, and is not a deployment. Node ≥ 24. Gate: `npm run check && npm test && npm run build`. | Each phase is one PR with one AGENTS.md entry. |

## How the wall is isolated: a custom element with a shadow root

`<vibe-sponsor-wall>` renders inside a shadow root.

- The site's stylesheets, the 14px rule and the page-effects selectors do not reach inside it, and the wall's class names do not leak out. This is what makes 1:1 possible.
- Unlike an iframe, the detail dialog opens over the whole page, scrolling stays with the page (and Lenis), and the page background shows through, which is what you asked for.
- The host element carries `data-page-swipe-ignore` so dragging a carousel does not change views.
- Fonts are loaded by the page (shadow roots use the document's fonts).

## Data contract

**Settings** (one JSON per event, `site-content/sponsor-wall/<eventId>.json`, draft and published):

```
format     'legacy' | 'featured' | 'cascade' | 'vouchers' | 'cutouts'     default 'legacy'
cards      'dark' | 'white'
openSlots  true | false
cutGap     0–64     cutPad  0–200          (cut-out wall spacing)
items      { [sponsorId]: { tier: 't1'|'t2'|'t3', cols: 1–3, rows: 1–4, featured: bool, order: n } }
```

`format: 'legacy'` means "show today's offer browser". It is the default, so merging the code changes nothing visible, and it is the rollback switch.

Tier caps are enforced in the shared schema, in the Worker and in the editor: Tier 1 up to 3 × 4 and 5 photos; Tier 2 up to 2 × 3 and 3 photos; Tier 3 up to 1 × 2 and 1 photo.

**`GET /public-sponsor-wall?page=home`** returns `{ eventId, settings, items[] }`, where the Worker has already joined placements, published offers and settings into one list. Each item:

| Wall field | Source |
|---|---|
| `id`, `brand`, `logo`, `site` | placement `id`, `name`, `logo_url`, `website_url` |
| `tier`, `cols`, `rows`, `featured`, `order` | settings `items[id]`, else the default from the placement group |
| `offerId`, `short`, `long`, `type`, `terms[]`, `where`, `limit`, `from`, `to` | the sponsor's published offer, matched by `businessId === placement id`: `summary`, `description`, `type`, `terms` + `redemptionInstructions`, `address`, `rules.onePerPerson`, `startsAt`, `expiresAt` |
| `photos[]` | offer `photos` where `enabled`, cut to the tier limit |
| `role` | "Partner" / "Sponsor" / "Supporting sponsor" from the placement group |

All text is rendered as text, never HTML. A sponsor with no published offer has no `offerId` and renders as a logo piece.

## Phases

### Phase 0 — port kit (done here by Claude; no Codex usage)

Built in this repo under `port/sponsor-wall/`, ready to copy:

- `assets/sponsor-wall/sponsor-wall.js` and `.css`: the custom element with all four formats, the detail dialog (swipe, close-by-drag), carousels and entrance animations, lifted from the prototype pages. Prototype-only parts removed: page header, layout switcher, local storage, simulated claims, sample data.
- `assets/sponsor-wall-schema.js`: the one validator, in the same shape as `assets/page-effects-schema.js`.
- `worker/sponsor-wall.js`: admin API, public route, the join, the access check.
- `portal/sponsor-wall.js` and `.css`: the editor screen, using the same custom element for its live preview.
- `tests/sponsor-wall.test.mjs`, fixtures, `docs/SPONSOR-WALL.md`, the exact snippets for `page-shell.js`, and the Codex prompts.
- **Parity check:** a Playwright script renders the prototype page and the kit with the same fixture at 390, 768 and 1280px for every format and both card colours, and fails on any pixel difference above 0.5%. The kit is not handed over until this passes.

Codex then copies files and edits a handful of named lines. It does not write wall code.

### Phase 1 — backend and schema (PR 1, no visible change)

- Add `assets/sponsor-wall-schema.js`, `worker/sponsor-wall.js`; wire `GET/POST /ops-api/sponsor-wall`, `GET/POST /ops-api/sponsor-wall/access` and `GET /public-sponsor-wall` beside the page-effects routes in `worker/portal-api.js` and `worker/index.js`.
- Add the Worker file to `scripts/build-portal.mjs`, the route to `scripts/portal-local-server.mjs`, the test to `package.json`.
- Access: `swCanEdit(member)` is true for owner and admin, or when the member's id is in `site-content/sponsor-wall-access.json`. Only the owner can change that list. Every save is audited like page effects.
- **Gate:** the three commands pass; tests cover validation and tier caps, draft/publish and version conflict, the join (offer and no-offer sponsors), access allowed and refused, and that `/public-offers` output is unchanged.

### Phase 2 — the wall on the tickets site (PR 2, still no visible change)

- Copy `assets/sponsor-wall/**`. Add one script tag to `index.html`.
- In `previews/page-shell/page-shell.js`, inside the existing `VibeOfferBrowser.mount` wrapper: fetch `/public-sponsor-wall` once; if `format` is `legacy` or the fetch fails, call the original mount as today. Otherwise skip the original mount, do not add `vc-ad-v2-enabled`, and mount `<vibe-sponsor-wall>` into `#confirmedOffers`.
- `#offer/{id}` opens that offer's detail dialog. Claim calls `window.VCRetrievePurchaseQR`.
- **Gate:** the three commands pass; with no settings saved the Offers view is identical to before (screenshot test); with a fixture setting each format renders and the parity check passes inside the real page; checkout, buy bar and view swiping still work.

### Phase 3 — portal screen and access (PR 3)

- Copy `portal/sponsor-wall.js` and `.css`. Register the screen in the five places page effects is registered: `portal/runtime.js`, `portal/app.js` (nav and render), `portal/admin.js` (label and group), `portal/index.html`.
- The nav item shows for owner, admin and assigned members. The Worker refuses everyone else regardless of what the portal shows.
- Controls: format, card colour, open slots, cut-out spacing, and per sponsor the tier, columns, rows, Featured and order, with sizes above the tier cap disabled. Save draft, preview, publish.
- Owner-only panel: assign or remove wall editors.
- **Gate:** the three commands pass; tests cover portal wiring, an assigned member can save, an unassigned business manager gets 403.

### Phase 4 — go live (no code)

1. Deploy through the usual Sites publish.
2. In the portal, set sizes and tiers, publish a format.
3. Check the Offers view on a phone and a laptop, open an offer, retrieve a QR.
4. **Rollback:** publish `format: legacy`. No deploy needed.

### Later, each its own decision

Business managers editing their own piece within their tier; real "N left" counts; more than three published offers per event.

## What "without fail" rests on

No plan can guarantee zero defects. This one removes the usual causes:

| Risk | Covered by |
|---|---|
| The wall looks different on the real site | Shadow root isolation, plus the pixel parity check in Phase 0 and again in Phase 2. |
| Codex rewrites or "improves" wall code | It copies a finished kit; prompts name every file it may touch and forbid the rest. |
| A new file is silently missing from build or tests | Each list edit is spelled out, and the gate checks that `dist/assets/sponsor-wall/` exists and the new tests ran. |
| Launch breaks the Offers view or claiming | Default is `legacy`; any fetch failure falls back to the current offer browser; rollback is a setting. |
| Someone without access edits the wall | The Worker checks access on every write; hiding the nav item is not relied on. |
| Order snapshots or sponsor coupons break | `/public-offers` is not touched, and a test asserts that. |
| `main` moved under the plan | The diff command at the top, run before each phase. |
| Invented numbers reach the public | No counters at launch; sample offers do not ship. |

## Codex usage

One task per PR, three tasks in all, each a paste-ready prompt from the kit that names the files, the exact insert points and the gate commands. Start each from a fresh pull of `main`. The prompts are written at the end of Phase 0, once the kit's file names are final.
