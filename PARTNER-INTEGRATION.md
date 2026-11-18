# Accepting Vibe City claim codes in your online checkout

For partner developers whose own website creates PayMongo checkouts on its own server.

> **Shopify stores don't need this guide.** If the shop runs on Shopify (as knowtheculture.ph does), PayMongo is a payment app inside Shopify's checkout and there is no code of yours that creates the PayMongo checkout. Vibe City creates a single-use Shopify discount for each claim instead; the steps for the business are in the handoff message on its page in `partner.html`.

Guests with a Vibe City ticket get a claim code such as `KTC-7Q3FK-9M2XA`. You add two calls to your server: one before you create the PayMongo checkout (to check the code and get the discount), and one after the payment succeeds (to use the code up). Your PayMongo account, keys and checkout stay exactly as they are; Vibe City never sees your PayMongo keys.

## What you receive from Vibe City

| Item | Example | Keep it |
|---|---|---|
| API address | `https://claims.vibecity.example` | in config |
| Online key | `vck_online_…` | **server-side only**, as a secret. Never in browser code. |

The key only works for your own offers. If it leaks, ask Vibe City to revoke it and issue a new one.

All requests: `Authorization: Bearer <online key>`, `Content-Type: application/json`. Amounts are **centavos** (₱1,500.00 = `150000`), the same unit PayMongo uses.

## 1. Check the code before creating the checkout

```
POST /v1/partner/claims/verify
{ "code": "KTC-7Q3FK-9M2XA", "cartRef": "cart_8812" }
```

`cartRef` is your cart or session id. Send the same one again when the shopper refreshes the cart; a different cart can't use the code at the same time.

Valid:

```json
{
  "valid": true,
  "code": "KTC-7Q3FK-9M2XA",
  "holdId": "cart:cart_8812",
  "holdUntil": "2026-11-20T10:30:00.000Z",
  "offer": {
    "id": "KTC",
    "title": "Know The Culture item",
    "discount": { "type": "percent", "value": 10, "maxItems": 1, "label": "10% off 1 item" }
  }
}
```

The code is now **held for your cart for 30 minutes**: nobody can use it at the counter or in another cart meanwhile. Keep `holdId` with the order.

Not valid (still HTTP 200, so you can show the message):

```json
{ "valid": false, "reason": "already_redeemed", "message": "This code has already been used." }
```

| reason | meaning |
|---|---|
| `not_found` | No such code for your business (typo, or another sponsor's code) |
| `already_redeemed` | Used before |
| `in_use` | Held by another cart or an open payment link; try again later |
| `expired` / `not_started` | Outside the offer dates |
| `channel_not_allowed` | The offer is in-store only |
| `offer_inactive` | The offer was switched off |

## 2. Apply the discount and create the PayMongo checkout as usual

PayMongo has no coupon field: the price you send is the price charged. Lower the eligible item yourself, following your offer's terms (for example: one item at regular price, not sale items).

| discount.type | how to apply |
|---|---|
| `percent` | `amount = Math.round(amount * (100 - value) / 100)` on up to `maxItems` items |
| `amount` | subtract `value` centavos (not below 0) |
| `free` | the item's price becomes 0 (leave it off the PayMongo line items) |

Tag the session so step 3 can find the claim:

```js
const v = await vibeCity('/v1/partner/claims/verify', { code, cartRef: cart.id });
if (!v.valid) return showError(v.message);

const item = cart.items.find(i => !i.onSale && !i.collab);
if (item) item.amount = Math.round(item.amount * (100 - v.offer.discount.value) / 100);

await paymongo.post('/v1/checkout_sessions', { data: { attributes: {
  line_items: cart.items.map(i => ({ name: i.name, amount: i.amount, currency: 'PHP', quantity: i.qty })),
  payment_method_types: ['qrph', 'gcash', 'paymaya', 'card'],
  metadata: { vc_code: v.code, vc_hold_id: v.holdId },   // metadata values must be strings
  // …your other fields
} } });
```

## 3. Use the code up after payment

In your existing PayMongo webhook handler, for `checkout_session.payment.paid`:

```js
const md = event.data.attributes.data.attributes.metadata || {};
if (md.vc_code) {
  await vibeCity('/v1/partner/claims/redeem', {
    code: md.vc_code,
    holdId: md.vc_hold_id,
    orderRef: event.data.attributes.data.id,   // the cs_… id, or your own order number
    amountPaid: totalPaidInCentavos,            // optional, for reporting
  });
}
```

Answer: `{ "redeemed": true, "code": "KTC-7Q3FK-9M2XA" }`. Safe to repeat with the same `orderRef` (PayMongo retries webhooks), and the answer then includes `"repeated": true`.

If the payment came more than 30 minutes after the check **and** the guest used the code elsewhere in between, you get `409 { "error": "hold_lost" }`. The payment is already taken; the order is fine to fulfil. Tell Vibe City if this happens often.

## 4. Optional: release a code when a cart is abandoned

```
POST /v1/partner/claims/release
{ "code": "KTC-7Q3FK-9M2XA", "holdId": "cart:cart_8812" }
```

Frees the code at once instead of after 30 minutes. Call it when the shopper removes the code or the cart expires.

## Helper

```js
async function vibeCity(path, body) {
  const res = await fetch(process.env.VIBECITY_API + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.VIBECITY_ONLINE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (res.status >= 500) throw new Error('Vibe City claims unavailable');
  return data;
}
```

If Vibe City is unreachable during step 1, don't apply the discount: ask the shopper to try again in a moment.

## Testing

Vibe City can give you a test key and test codes on a test server. Use your PayMongo **test** keys (`sk_test_…`) at the same time; no real money moves.
