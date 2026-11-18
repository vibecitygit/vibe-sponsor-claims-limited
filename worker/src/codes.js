// Claim codes: '<OFFER>-<5>-<5>', e.g. 'KTC-7Q3FK-9M2XA'. Ten Crockford base32 characters (50 bits)
// follow the offer prefix, so a code can't be guessed, and guessing would need a sponsor key anyway.
import { randomBase32 } from './crypto.js';

const RANDOM_LEN = 10;

export function newCode(offerId) {
  const r = randomBase32(RANDOM_LEN);
  const prefix = offerId.toUpperCase();
  return { compact: prefix + r, display: `${prefix}-${r.slice(0, 5)}-${r.slice(5)}` };
}

/**
 * Accepts what a person types or a scanner reads: any case, spaces, hyphens, or a URL ending in
 * the code. Read-alike letters in the random part become the digits they stand for (O→0, I/L→1).
 * Returns the compact form used as the database key, or null.
 */
export function normalizeCode(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  const tail = /[/#?=]([^/#?=]+)\/?$/.exec(s); // a QR may hold a link like https://…/c/KTC-7Q3FK-9M2XA
  if (/^https?:\/\//i.test(s) && tail) s = decodeURIComponent(tail[1]);
  s = s.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.length <= RANDOM_LEN || s.length > RANDOM_LEN + 12) return null;
  const prefix = s.slice(0, -RANDOM_LEN);
  const random = s.slice(-RANDOM_LEN).replace(/O/g, '0').replace(/[IL]/g, '1');
  return prefix + random;
}
