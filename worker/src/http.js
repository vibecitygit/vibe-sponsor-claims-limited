// Response helpers, errors and request authentication.
import { sha256Hex, safeEqual } from './crypto.js';

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

export const errorResponse = err =>
  json({ error: err.code, message: err.message, ...err.extra }, err.status);

export async function readJson(req) {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(400, 'bad_json', 'Send a JSON object as the request body.');
  }
}

const bearer = req => {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get('Authorization') || '');
  return m ? m[1] : null;
};

export function requireAdmin(req, env) {
  const token = bearer(req);
  if (!env.ADMIN_TOKEN || !token || !safeEqual(token, env.ADMIN_TOKEN)) {
    throw new HttpError(401, 'unauthorized', 'Admin token missing or wrong.');
  }
}

/** Looks up a sponsor key and checks its scope. Returns { sponsorId, scope, keyId }. */
export async function requireSponsorKey(req, env, scope) {
  const token = bearer(req);
  if (!token) throw new HttpError(401, 'unauthorized', 'Send your Vibe City key as "Authorization: Bearer <key>".');
  const row = await env.DB.prepare(
    'SELECT sponsor_id, scope, key_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL'
  ).bind(await sha256Hex(token)).first();
  if (!row) throw new HttpError(401, 'unauthorized', 'Unknown or revoked key.');
  if (row.scope !== scope) throw new HttpError(403, 'wrong_scope', `This endpoint needs a "${scope}" key; this one is "${row.scope}".`);
  return { sponsorId: row.sponsor_id, scope: row.scope, keyId: row.key_id };
}

/** CORS for the endpoints browsers call (guest claim pages and the staff scanner). */
export function corsHeaders(req, env) {
  const origin = req.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
