# Sponsor claims API

A Cloudflare Worker with a D1 database. It turns the claim wall's simulated codes into real ones and connects them to each sponsor's PayMongo account:

- **Guests** get one claim code per ticket per offer (`KTC-7Q3FK-9M2XA`), shown as text or a QR.
- **At the counter**, staff scan the code in [`scanner.html`](../scanner.html), enter the bill, and the worker creates a PayMongo checkout on **that sponsor's own PayMongo account** with the discount applied. The guest pays from the QR; PayMongo's webhook marks the code used.
- **Online, Shopify stores** (e.g. Know The Culture): PayMongo is only a payment app inside Shopify's checkout there, so each claim gets a matching single-use **Shopify discount code**. The guest gets a link (`https://store/discount/CODE`) that puts it on their cart. Shopify's `orders/paid` webhook marks the claim used, and a claim used at the counter switches its Shopify code off.
- **Online, own website**: a partner's own server checks and uses up codes before and after its own PayMongo checkout. See [`PARTNER-INTEGRATION.md`](../PARTNER-INTEGRATION.md).
- **[`partner.html`](../partner.html)** is the settings page: one page per partner (`partner.html#partner=know-the-culture`) for the business profile, shop connection, PayMongo, offers, scanner accounts, a handoff message and recent claims. Every call is scoped to that partner on the server, so a partner's page only lists and revokes that partner's own scanner accounts.

```
guest ── POST /v1/claims ─────────────────────► code KTC-7Q3FK-9M2XA
staff scanner ── POST /v1/staff/scan ─────────► worker ── sponsor's sk_… ──► PayMongo checkout_url
PayMongo ── checkout_session.payment.paid ────► /v1/webhooks/paymongo/:sponsor ──► code redeemed
partner server ── /v1/partner/claims/verify ──► hold 30 min ─► their PayMongo checkout ─► /redeem
```

Each change of state is one conditional `UPDATE`, so two scans, two carts, or a scan and a cart can't both use the same code.

## Run it locally

Needs Node 22.5 or later. No install step.

```bash
npm test --prefix worker
```

```bash
node --no-warnings=ExperimentalWarning worker/dev/local-server.mjs
```

Open `http://localhost:8788/partner.html#partner=know-the-culture` (admin token `dev-admin-token`) or `http://localhost:8788/scanner.html`. The server prints a staff key and three test codes. Shopify is faked at `ktc-test.myshopify.com` (client ID `cid_1`, secret `shpss_secret`). PayMongo is faked; open `http://localhost:8788/dev/pay` to simulate the "paid" webhook for the latest link. To create real **test-mode** checkouts, start it with `PAYMONGO_TEST_SECRET_KEY=sk_test_…` (the paid webhook still can't reach localhost, so keep using `/dev/pay`).

## Deploy

```bash
cd worker
npx wrangler d1 create vibe-claims            # paste the database_id into wrangler.toml
npm run migrate:remote
npx wrangler secret put ADMIN_TOKEN           # a long random string
npx wrangler secret put DATA_KEY              # node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npx wrangler secret put TICKET_SIGNING_SECRET # shared with the ticketing site (see below)
npm run deploy
```

Then set `PUBLIC_BASE_URL` (the worker's https address) and `ALLOWED_ORIGINS` (where `partner.html`, `scanner.html` and the guest claim pages are served) in `wrangler.toml` and deploy again.

## Add a partner (settings page)

Open `partner.html`, connect with the server address and `ADMIN_TOKEN`, and click **New partner**. Each partner's page has its own address (`#partner=<id>`), so you can bookmark one per business. On it:

1. **Business**: name, id, and which online shop they have: none, Shopify, or their own website.
2. **Online shop**:
   - *Shopify*: paste the store's `myshopify.com` address and the client ID and secret of the custom app they created in their Shopify Dev Dashboard (scopes `write_discounts`, `read_discounts`, `read_orders`). Then click **Connect and test** and **Register order webhook**. Claims made before connecting get their Shopify discounts from **Create missing Shopify discounts**.
   - *Own website*: create an online key for their developer and send them `PARTNER-INTEGRATION.md`.
3. **In-store payments**: their PayMongo secret key, then **Register PayMongo webhook** (only needed for discounts paid at the counter).
4. **Offers**: code prefix, discount, where it can be used, dates, limit; for Shopify, optional collection ids.
5. **Scanner accounts**: one per phone. Each new account shows a setup link and QR once; opening it on the phone signs the scanner in to that business only.
6. **Handoff**: a checklist and a message to send the business, written for their shop type and what is still missing.

The curl calls below do the same things without the page.

## Add a sponsor

All admin calls use `Authorization: Bearer $ADMIN_TOKEN`. Amounts are centavos.

```bash
# 1. The offer (the id is the code prefix)
curl -X PUT $API/v1/admin/offers/KTC -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"sponsorId":"know-the-culture","title":"Know The Culture item","discountType":"percent","discountValue":10,
       "maxItems":1,"channels":["in_store","online"],"validFrom":"2026-11-19T00:00:00+08:00","validTo":"2026-12-19T23:59:59+08:00"}'

# 2. Their PayMongo secret key (stored encrypted). Start with sk_test_…
curl -X PUT $API/v1/admin/sponsors/know-the-culture/paymongo -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"secretKey":"sk_test_…"}'

# 3. Register our webhook on their PayMongo account (stores the signing secret it returns)
curl -X POST $API/v1/admin/sponsors/know-the-culture/paymongo/webhook -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Keys: "staff" for their scanner, "online" for their web store's server. Shown once.
curl -X POST $API/v1/admin/sponsors/know-the-culture/keys -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"scope":"staff","label":"Event stall"}'
curl -X POST $API/v1/admin/sponsors/know-the-culture/keys -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"scope":"online","label":"Web store"}'
```

A sponsor that only sells online through its own checkout needs only the offer and an `online` key; steps 2 and 3 are for in-store scans. Moving a sponsor to live mode: repeat steps 2 and 3 with their `sk_live_…` key.

Partner calls: `GET /v1/admin/sponsors`, `GET|PUT /v1/admin/sponsors/:id`, `PUT /v1/admin/sponsors/:id/shopify`, `POST /v1/admin/sponsors/:id/shopify/test|webhook|resync`.

Other admin calls: `GET /v1/admin/offers` (with claimed/redeemed counts), `GET /v1/admin/claims?offerId=KTC&state=redeemed`, `GET /v1/admin/sponsors/:id/keys`, `DELETE /v1/admin/sponsors/:id/keys/:keyId`.

## Guests and tickets

`POST /v1/claims { offerId, ticketId, ticketProof }`. `ticketProof` is the hex HMAC-SHA256 of `ticketId` with `TICKET_SIGNING_SECRET`, computed by the **ticketing site's server** for tickets it really issued, so nobody can mint codes for made-up tickets. Until that is wired, set `ALLOW_UNVERIFIED_TICKETS=true` only on a test deployment.

`GET /v1/claims/:code` returns `ready`, `in_use` or `redeemed`.

## Shopify: check on a real store first

Built from Shopify's docs for API version `2026-10` and tested against a fake store. Check these on a real store before launch:
- the client credentials token exchange works for the partner's Dev Dashboard app (it only works for apps in the same organization as the store, which is the case when the partner creates the app);
- `discountCodeBasicCreate` accepts `context: { all: ALL }` and, when collections are set, `items: { collections: { add: [...] } }`;
- an `orders/paid` payload lists the code under `discount_codes[].code` (the code reads `discount_applications[].code` as well);
- whether the checkout shows the discount field once codes exist (it didn't on knowtheculture.ph with none).

## Not done yet

- The claim wall pages (`offerwall.html`, `coupon-deck.html`, `cutouts.html`) still make simulated codes on the device. Switching their Claim button to `POST /v1/claims` belongs with the port to the live site in `HANDOFF-PLAN.md`, where the guest's ticket is known.
- No admin screen: sponsors are set up with the calls above.
- No rate limit on the guest endpoints beyond Cloudflare's defaults. Codes carry 50 random bits and partner endpoints need a key, so guessing isn't practical, but a per-IP limit on `POST /v1/claims` is worth adding before launch.
- PayMongo's docs don't state a minimum checkout amount; if an amount is too small, PayMongo's own error is shown to staff and the code is freed.
