// PayMongo calls, made with one sponsor's own secret key.
// Docs: https://docs.paymongo.com/reference/create-a-checkout
//       https://docs.paymongo.com/docs/developer-tools-webhook-setup-management (signatures)
import { hmacHex, safeEqual } from './crypto.js';
import { HttpError } from './http.js';

const API = 'https://api.paymongo.com/v1';

export const DEFAULT_METHODS = ['qrph', 'gcash', 'paymaya', 'card'];

const authHeader = secretKey => 'Basic ' + btoa(secretKey + ':');

async function call(fetchImpl, secretKey, path, attributes) {
  let res;
  try {
    res = await fetchImpl(API + path, {
      method: 'POST',
      headers: { Authorization: authHeader(secretKey), 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ data: { attributes } }),
    });
  } catch (e) {
    throw new HttpError(502, 'paymongo_unreachable', 'Could not reach PayMongo. Try again.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (body.errors || []).map(e => e.detail).filter(Boolean).join(' ');
    throw new HttpError(502, 'paymongo_error', detail || `PayMongo answered ${res.status}.`, { paymongoStatus: res.status });
  }
  return body.data;
}

/**
 * Creates a hosted checkout. lineItems amounts are centavos. Returns { id: 'cs_…', checkoutUrl }.
 * metadata values must be strings (PayMongo drops anything else).
 */
export async function createCheckoutSession(fetchImpl, secretKey, { lineItems, description, referenceNumber, metadata, methods, successUrl, cancelUrl }) {
  const attributes = {
    line_items: lineItems.map(i => ({ name: i.name.slice(0, 255), amount: i.amount, currency: 'PHP', quantity: i.quantity || 1 })),
    payment_method_types: methods && methods.length ? methods : DEFAULT_METHODS,
    description,
    reference_number: referenceNumber,
    metadata,
    send_email_receipt: false,
  };
  if (successUrl) attributes.success_url = successUrl;
  if (cancelUrl) attributes.cancel_url = cancelUrl;
  const data = await call(fetchImpl, secretKey, '/checkout_sessions', attributes);
  return { id: data.id, checkoutUrl: data.attributes.checkout_url };
}

/** Registers our webhook URL on the sponsor's PayMongo account. Returns { id: 'hook_…', secretKey, livemode }. */
export async function createWebhook(fetchImpl, secretKey, url) {
  const data = await call(fetchImpl, secretKey, '/webhooks', { url, events: ['checkout_session.payment.paid'] });
  return { id: data.id, secretKey: data.attributes.secret_key, livemode: !!data.attributes.livemode };
}

/**
 * Checks the Paymongo-Signature header ("t=…,te=…,li=…"): HMAC-SHA256 of `${t}.${rawBody}` with the
 * webhook's secret key, compared with te for test events and li for live events.
 */
export async function verifySignature(header, rawBody, webhookSecret, livemode) {
  if (!header || !webhookSecret) return false;
  const parts = Object.fromEntries(header.split(',').map(p => {
    const i = p.indexOf('=');
    return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
  }));
  if (!parts.t) return false;
  const expected = await hmacHex(webhookSecret, `${parts.t}.${rawBody}`);
  return safeEqual(expected, livemode ? parts.li || '' : parts.te || '');
}
