// Small Web Crypto helpers. Work the same in Cloudflare Workers and Node 20+.

const enc = new TextEncoder();
const dec = new TextDecoder();

export const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const toB64 = bytes => btoa(String.fromCharCode(...bytes));
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** Constant-time comparison of two strings. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Crockford base32: no I, L, O, U, so codes are easy to read aloud and type.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function randomBase32(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map(b => B32[b & 31]).join('');
}

async function dataKey(env) {
  if (!env.DATA_KEY) throw new Error('DATA_KEY is not set');
  const raw = fromB64(env.DATA_KEY);
  if (raw.length !== 32) throw new Error('DATA_KEY must be 32 bytes, base64-encoded');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Encrypts a secret for storage: base64(iv || ciphertext). */
export async function seal(env, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await dataKey(env), enc.encode(plaintext)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv); out.set(ct, iv.length);
  return toB64(out);
}

export async function unseal(env, sealed) {
  const raw = fromB64(sealed);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, await dataKey(env), raw.slice(12));
  return dec.decode(pt);
}
