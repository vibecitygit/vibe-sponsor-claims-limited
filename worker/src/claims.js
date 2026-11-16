// The claim lifecycle: issued → held (a cart or a scan is using it) → redeemed.
// Every state change is one conditional UPDATE, so two scans or two carts can't both win.
import { HttpError } from './http.js';
import { newCode, normalizeCode } from './codes.js';
import { hmacHex, safeEqual, randomBase32, unseal } from './crypto.js';
import { createCheckoutSession, verifySignature } from './paymongo.js';

const iso = d => d.toISOString();
const clock = env => (env.now ? env.now() : new Date());
const minutes = (env, name, fallback) => {
  const n = Number(env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/* ---------- Offers ---------- */

export function describeDiscount(offer) {
  const items = offer.max_items > 1 ? `${offer.max_items} items` : '1 item';
  if (offer.discount_type === 'percent') return `${offer.discount_value}% off ${items}`;
  if (offer.discount_type === 'amount') return `₱${(offer.discount_value / 100).toFixed(2).replace(/\.00$/, '')} off`;
  return 'Free';
}

const publicOffer = o => ({
  id: o.id,
  title: o.title,
  discount: { type: o.discount_type, value: o.discount_value, maxItems: o.max_items, label: describeDiscount(o) },
  channels: o.channels.split(','),
  validFrom: o.valid_from,
  validTo: o.valid_to,
});

async function loadOffer(env, offerId) {
  return env.DB.prepare('SELECT * FROM offers WHERE id = ?').bind(offerId).first();
}

/** Returns a reason string if the offer can't be used right now on this channel, else null. */
function offerProblem(offer, now, channel) {
  if (!offer || !offer.active) return 'offer_inactive';
  if (offer.valid_from && iso(now) < offer.valid_from) return 'not_started';
  if (offer.valid_to && iso(now) > offer.valid_to) return 'expired';
  if (channel && !offer.channels.split(',').includes(channel)) return 'channel_not_allowed';
  return null;
}

const REASONS = {
  not_found: 'No claim with this code for your business.',
  offer_inactive: 'This offer is switched off.',
  not_started: 'This offer has not started yet.',
  expired: 'This offer has ended.',
  channel_not_allowed: 'This offer cannot be used here.',
  already_redeemed: 'This code has already been used.',
  in_use: 'This code is being used in another checkout right now. Try again in a few minutes.',
  hold_lost: 'The hold on this code ended and it was used elsewhere.',
  sold_out: 'All claims for this offer have been given out.',
};
const reject = (status, reason) => new HttpError(status, reason, REASONS[reason]);

/* ---------- Guests: get a code ---------- */

async function checkTicket(env, ticketId, ticketProof) {
  if (env.ALLOW_UNVERIFIED_TICKETS === 'true') return;
  if (!env.TICKET_SIGNING_SECRET) {
    throw new HttpError(501, 'ticket_check_not_configured', 'Set TICKET_SIGNING_SECRET (or ALLOW_UNVERIFIED_TICKETS=true for local testing).');
  }
  const expected = await hmacHex(env.TICKET_SIGNING_SECRET, ticketId);
  if (!safeEqual(expected, String(ticketProof || '').toLowerCase())) {
    throw new HttpError(403, 'bad_ticket', 'This ticket could not be confirmed.');
  }
}

export async function issueClaim(env, { offerId, ticketId, ticketProof }) {
  if (typeof offerId !== 'string' || typeof ticketId !== 'string' || !ticketId.trim() || ticketId.length > 120) {
    throw new HttpError(400, 'bad_request', 'Send offerId and ticketId.');
  }
  await checkTicket(env, ticketId, ticketProof);
  const now = clock(env);
  const offer = await loadOffer(env, offerId);
  const problem = offerProblem(offer, now, null);
  if (problem) throw reject(problem === 'offer_inactive' ? 404 : 409, problem);

  const existing = await env.DB.prepare('SELECT * FROM claims WHERE offer_id = ? AND ticket_id = ?').bind(offerId, ticketId).first();
  if (existing) return { claim: claimView(existing, now), offer: publicOffer(offer), created: false };

  const code = newCode(offer.id);
  // The cap check and the insert are one statement, so a limited offer can't be over-issued.
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO claims (code, display_code, offer_id, sponsor_id, ticket_id, state, created_at)
     SELECT ?, ?, ?, ?, ?, 'issued', ?
     WHERE (SELECT max_claims FROM offers WHERE id = ?) IS NULL
        OR (SELECT COUNT(*) FROM claims WHERE offer_id = ?) < (SELECT max_claims FROM offers WHERE id = ?)`
  ).bind(code.compact, code.display, offer.id, offer.sponsor_id, ticketId, iso(now), offer.id, offer.id, offer.id).run();

  if (!res.meta.changes) {
    const raced = await env.DB.prepare('SELECT * FROM claims WHERE offer_id = ? AND ticket_id = ?').bind(offerId, ticketId).first();
    if (raced) return { claim: claimView(raced, now), offer: publicOffer(offer), created: false };
    throw reject(409, 'sold_out');
  }
  const row = await env.DB.prepare('SELECT * FROM claims WHERE code = ?').bind(code.compact).first();
  return { claim: claimView(row, now), offer: publicOffer(offer), created: true };
}

function claimView(row, now) {
  const held = row.state === 'held' && row.hold_until > iso(now);
  return {
    code: row.display_code,
    offerId: row.offer_id,
    state: row.state === 'redeemed' ? 'redeemed' : held ? 'in_use' : 'ready',
    redeemedAt: row.redeemed_at || null,
  };
}

export async function claimStatus(env, rawCode) {
  const code = normalizeCode(rawCode);
  const row = code && await env.DB.prepare('SELECT * FROM claims WHERE code = ?').bind(code).first();
  if (!row) throw new HttpError(404, 'not_found', 'No claim with this code.');
  return claimView(row, clock(env));
}

/* ---------- Shared: hold, redeem, release ---------- */

async function findForSponsor(env, sponsorId, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const row = await env.DB.prepare('SELECT * FROM claims WHERE code = ?').bind(code).first();
  // Another sponsor's code looks exactly like a missing one, so codes can't be probed across businesses.
  return row && row.sponsor_id === sponsorId ? row : null;
}

function stateProblem(row, now, holdId) {
  if (row.state === 'redeemed') return 'already_redeemed';
  if (row.state === 'held' && row.hold_until > iso(now) && row.hold_ref !== holdId) return 'in_use';
  return null;
}

async function hold(env, row, { holdId, channel, holdMinutes, now }) {
  const until = new Date(now.getTime() + holdMinutes * 60_000);
  const res = await env.DB.prepare(
    `UPDATE claims SET state = 'held', channel = ?, hold_ref = ?, hold_until = ?
     WHERE code = ? AND sponsor_id = ?
       AND (state = 'issued' OR (state = 'held' AND (hold_until <= ? OR hold_ref = ?)))`
  ).bind(channel, holdId, iso(until), row.code, row.sponsor_id, iso(now), holdId).run();
  return res.meta.changes ? iso(until) : null;
}

async function markRedeemed(env, row, { holdId, channel, orderRef, amountPaid, now }) {
  const res = await env.DB.prepare(
    `UPDATE claims SET state = 'redeemed', channel = ?, order_ref = ?, amount_paid = ?, redeemed_at = ?, hold_until = NULL
     WHERE code = ? AND sponsor_id = ?
       AND (state = 'issued' OR (state = 'held' AND (hold_ref = ? OR hold_until <= ?)))`
  ).bind(channel, orderRef, amountPaid ?? null, iso(now), row.code, row.sponsor_id, holdId ?? '', iso(now)).run();
  return res.meta.changes > 0;
}

async function release(env, row, holdId) {
  const res = await env.DB.prepare(
    `UPDATE claims SET state = 'issued', channel = NULL, hold_ref = NULL, hold_until = NULL, checkout_session_id = NULL
     WHERE code = ? AND sponsor_id = ? AND state = 'held' AND hold_ref = ?`
  ).bind(row.code, row.sponsor_id, holdId).run();
  return res.meta.changes > 0;
}

/* ---------- Partners' online checkouts ---------- */

/**
 * Called by the partner's server before it creates its PayMongo checkout. Holds the claim for
 * HOLD_MINUTES so it can't be used in a second cart or at the counter meanwhile.
 * Business-rule failures come back as 200 { valid: false, reason } so the partner can show a message.
 */
export async function partnerVerify(env, sponsor, { code, cartRef }) {
  const now = clock(env);
  const row = await findForSponsor(env, sponsor.sponsorId, code);
  if (!row) return { valid: false, reason: 'not_found', message: REASONS.not_found };
  const offer = await loadOffer(env, row.offer_id);
  const holdId = cartRef ? `cart:${String(cartRef).slice(0, 100)}` : `hold_${randomBase32(16)}`;
  const problem = offerProblem(offer, now, 'online') || stateProblem(row, now, holdId);
  if (problem) return { valid: false, reason: problem, message: REASONS[problem] };

  const holdUntil = await hold(env, row, { holdId, channel: 'online', holdMinutes: minutes(env, 'HOLD_MINUTES', 30), now });
  if (!holdUntil) return { valid: false, reason: 'in_use', message: REASONS.in_use };
  return { valid: true, code: row.display_code, holdId, holdUntil, offer: publicOffer(offer) };
}

/** Called by the partner's server once the order is paid (e.g. from its PayMongo webhook). Safe to repeat. */
export async function partnerRedeem(env, sponsor, { code, holdId, orderRef, amountPaid }) {
  if (!orderRef) throw new HttpError(400, 'bad_request', 'Send orderRef: your order or PayMongo checkout id.');
  const now = clock(env);
  const row = await findForSponsor(env, sponsor.sponsorId, code);
  if (!row) throw reject(404, 'not_found');
  if (row.state === 'redeemed') {
    if (row.order_ref === String(orderRef)) return { redeemed: true, code: row.display_code, repeated: true };
    throw reject(409, 'already_redeemed');
  }
  const ok = await markRedeemed(env, row, { holdId, channel: 'online', orderRef: String(orderRef), amountPaid: toCentavos(amountPaid), now });
  if (!ok) throw reject(409, 'hold_lost');
  return { redeemed: true, code: row.display_code };
}

/** Called when a cart is abandoned or the code is removed, so the guest can use it elsewhere at once. */
export async function partnerRelease(env, sponsor, { code, holdId }) {
  const row = await findForSponsor(env, sponsor.sponsorId, code);
  if (!row) throw reject(404, 'not_found');
  return { released: await release(env, row, holdId) };
}

const toCentavos = v => (v === undefined || v === null || v === '' ? null : Number.isInteger(v) && v >= 0 ? v : (() => {
  throw new HttpError(400, 'bad_amount', 'Amounts are whole centavos, e.g. 150000 for ₱1,500.');
})());

/* ---------- Staff: scan at the counter ---------- */

export async function staffLookup(env, sponsor, { code }) {
  const now = clock(env);
  const row = await findForSponsor(env, sponsor.sponsorId, code);
  if (!row) throw reject(404, 'not_found');
  const offer = await loadOffer(env, row.offer_id);
  const problem = offerProblem(offer, now, 'in_store') || stateProblem(row, now, null);
  return { code: row.display_code, offer: publicOffer(offer), usable: !problem, reason: problem, message: problem ? REASONS[problem] : null };
}

/**
 * After a scan: works out the discounted price, holds the claim, and creates a PayMongo checkout on
 * the sponsor's own account. The claim is marked redeemed when PayMongo reports the payment.
 * itemAmount = the price of the item(s) the offer covers; otherAmount = the rest of the bill. Centavos.
 */
export async function staffScan(env, sponsor, { code, itemAmount, otherAmount }, fetchImpl = fetch) {
  const now = clock(env);
  const row = await findForSponsor(env, sponsor.sponsorId, code);
  if (!row) throw reject(404, 'not_found');
  const offer = await loadOffer(env, row.offer_id);
  const problem = offerProblem(offer, now, 'in_store') || stateProblem(row, now, null);
  if (problem) throw reject(409, problem);

  // Free items need no payment: redeem straight away.
  if (offer.discount_type === 'free') {
    if (!await markRedeemed(env, row, { channel: 'in_store', orderRef: `staff:${sponsor.keyId}`, amountPaid: 0, now })) throw reject(409, 'in_use');
    return { redeemed: true, code: row.display_code, offer: publicOffer(offer), message: 'Free offer: hand it over. No payment needed.' };
  }

  const item = toCentavos(itemAmount), other = toCentavos(otherAmount) ?? 0;
  if (!item) throw new HttpError(400, 'bad_amount', 'Enter the price of the item the offer covers.');
  const discounted = offer.discount_type === 'percent'
    ? Math.round(item * (100 - offer.discount_value) / 100)
    : Math.max(item - offer.discount_value, 0);
  const total = discounted + other;

  if (total === 0) {
    if (!await markRedeemed(env, row, { channel: 'in_store', orderRef: `staff:${sponsor.keyId}`, amountPaid: 0, now })) throw reject(409, 'in_use');
    return { redeemed: true, code: row.display_code, offer: publicOffer(offer), amounts: { item, discounted, other, total }, message: 'The discount covers the whole bill. Nothing to pay.' };
  }

  const pm = await env.DB.prepare('SELECT secret_key_enc FROM sponsor_paymongo WHERE sponsor_id = ?').bind(sponsor.sponsorId).first();
  if (!pm) throw new HttpError(409, 'paymongo_not_connected', 'This business has not connected its PayMongo account yet.');

  const holdId = `scan_${randomBase32(16)}`;
  const holdUntil = await hold(env, row, { holdId, channel: 'in_store', holdMinutes: minutes(env, 'SCAN_HOLD_MINUTES', 60), now });
  if (!holdUntil) throw reject(409, 'in_use');

  const lineItems = [];
  if (discounted > 0) lineItems.push({ name: `${offer.title} (${describeDiscount(offer)})`, amount: discounted });
  if (other > 0) lineItems.push({ name: 'Rest of the bill', amount: other });

  let session;
  try {
    session = await createCheckoutSession(fetchImpl, await unseal(env, pm.secret_key_enc), {
      lineItems,
      description: `Vibe City offer ${row.display_code}`,
      referenceNumber: row.display_code,
      metadata: { vc_claim_code: row.code, vc_hold_id: holdId, vc_offer_id: offer.id },
      successUrl: env.SCAN_SUCCESS_URL || undefined,
      cancelUrl: env.SCAN_CANCEL_URL || undefined,
    });
  } catch (err) {
    await release(env, row, holdId); // don't leave the guest's code stuck on a link that was never made
    throw err;
  }
  await env.DB.prepare('UPDATE claims SET checkout_session_id = ? WHERE code = ? AND hold_ref = ?').bind(session.id, row.code, holdId).run();

  return {
    redeemed: false,
    code: row.display_code,
    offer: publicOffer(offer),
    amounts: { item, discounted, other, total },
    checkoutUrl: session.checkoutUrl,
    checkoutSessionId: session.id,
    holdUntil,
  };
}

/** Staff cancel an open payment link (e.g. the guest paid cash instead). Frees the code. */
export async function staffCancel(env, sponsor, { code }) {
  const row = await findForSponsor(env, sponsor.sponsorId, code);
  if (!row) throw reject(404, 'not_found');
  if (row.state !== 'held' || row.channel !== 'in_store') return { released: false };
  return { released: await release(env, row, row.hold_ref) };
}

/* ---------- PayMongo webhook (one per sponsor account) ---------- */

export async function paymongoWebhook(env, sponsorId, req) {
  const raw = await req.text();
  let event;
  try { event = JSON.parse(raw); } catch { throw new HttpError(400, 'bad_json', 'Body is not JSON.'); }
  const attrs = event?.data?.attributes || {};

  const pm = await env.DB.prepare('SELECT webhook_secret_enc FROM sponsor_paymongo WHERE sponsor_id = ?').bind(sponsorId).first();
  const secret = pm?.webhook_secret_enc ? await unseal(env, pm.webhook_secret_enc) : null;
  if (!await verifySignature(req.headers.get('Paymongo-Signature'), raw, secret, !!attrs.livemode)) {
    throw new HttpError(401, 'bad_signature', 'Signature check failed.');
  }

  let outcome = 'ignored';
  if (attrs.type === 'checkout_session.payment.paid') {
    const session = attrs.data || {};
    const md = session.attributes?.metadata || {};
    const paid = (session.attributes?.payments || []).find(p => p?.attributes?.status === 'paid');
    if (md.vc_claim_code) {
      const now = clock(env);
      const row = await env.DB.prepare('SELECT * FROM claims WHERE code = ? AND sponsor_id = ?').bind(md.vc_claim_code, sponsorId).first();
      if (!row) outcome = 'unknown_claim';
      else if (row.state === 'redeemed') outcome = row.order_ref === session.id ? 'already_recorded' : 'conflict_already_redeemed';
      else outcome = await markRedeemed(env, row, {
        holdId: md.vc_hold_id, channel: 'in_store', orderRef: session.id,
        amountPaid: Number.isInteger(paid?.attributes?.amount) ? paid.attributes.amount : null, now,
      }) ? 'redeemed' : 'conflict_hold_lost';
      // A conflict means the guest paid but the code was used elsewhere first. The payment stands;
      // the outcome is logged so it can be followed up.
      if (outcome.startsWith('conflict')) console.warn('claim conflict', { sponsorId, code: md.vc_claim_code, session: session.id, outcome });
    }
  }

  if (event?.data?.id) {
    await env.DB.prepare('INSERT OR IGNORE INTO webhook_events (event_id, sponsor_id, type, received_at) VALUES (?, ?, ?, ?)')
      .bind(event.data.id, sponsorId, String(attrs.type || ''), iso(clock(env))).run();
  }
  return { received: true, outcome }; // always 2xx once verified, or PayMongo retries
}
