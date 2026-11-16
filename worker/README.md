# Sponsor claims API

A Cloudflare Worker with a D1 database. It turns the claim wall's simulated codes into real ones and connects them to each sponsor's PayMongo account:

- **Guests** get one claim code per ticket per offer (`KTC-7Q3FK-9M2XA`), shown as text or a QR.
- **At the counter**, staff scan the code in [`scanner.html`](../scanner.html), enter the bill, and the worker creates a PayMongo checkout on **that sponsor's own PayMongo account** with the discount applied. The guest pays from the QR; PayMongo's webhook marks the code used.
- **Online**, a partner's own server checks and uses up codes before and after its own PayMongo checkout. See [`PARTNER-INTEGRATION.md`](../PARTNER-INTEGRATION.md).

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

Open `http://localhost:8788/scanner.html`. The server prints a staff key and three test codes. PayMongo is faked; open `http://localhost:8788/dev/pay` to simulate the "paid" webhook for the latest link. To create real **test-mode** checkouts, start it with `PAYMONGO_TEST_SECRET_KEY=sk_test_…` (the paid webhook still can't reach localhost, so keep using `/dev/pay`).

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

Then set `PUBLIC_BASE_URL` (the worker's https address) and `ALLOWED_ORIGINS` (where `scanner.html` and the guest claim pages are served) in `wrangler.toml` and deploy again.

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

Other admin calls: `GET /v1/admin/offers` (with claimed/redeemed counts), `GET /v1/admin/claims?offerId=KTC&state=redeemed`, `GET /v1/admin/sponsors/:id/keys`, `DELETE /v1/admin/keys/:keyId`.

## Guests and tickets

`POST /v1/claims { offerId, ticketId, ticketProof }`. `ticketProof` is the hex HMAC-SHA256 of `ticketId` with `TICKET_SIGNING_SECRET`, computed by the **ticketing site's server** for tickets it really issued, so nobody can mint codes for made-up tickets. Until that is wired, set `ALLOW_UNVERIFIED_TICKETS=true` only on a test deployment.

`GET /v1/claims/:code` returns `ready`, `in_use` or `redeemed`.

## Not done yet

- The claim wall pages (`offerwall.html`, `coupon-deck.html`, `cutouts.html`) still make simulated codes on the device. Switching their Claim button to `POST /v1/claims` belongs with the port to the live site in `HANDOFF-PLAN.md`, where the guest's ticket is known.
- No admin screen: sponsors are set up with the calls above.
- No rate limit on the guest endpoints beyond Cloudflare's defaults. Codes carry 50 random bits and partner endpoints need a key, so guessing isn't practical, but a per-IP limit on `POST /v1/claims` is worth adding before launch.
- PayMongo's docs don't state a minimum checkout amount; if an amount is too small, PayMongo's own error is shown to staff and the code is freed.
