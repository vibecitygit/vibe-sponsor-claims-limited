/* Live wall data → the prototype renderers' deck. The renderers are exact ports of the prototype pages and read the
   prototype's coupon objects (see SAMPLE in deck-core.js), so live sponsors are turned into that shape here.
   This replaces DeckCore.sanitize for live data on purpose: sanitize keeps only shipped sample photos, trims text to the
   editor's limits and treats a missing stock count as sold out, none of which is right for live sponsors.
   Requires window.DeckCore (deck-core.js). */
(function (root) {
'use strict';
const TYPE = { discount: 'Discount', freebie: 'Freebie', option: 'Option' };
const TIER = { tier1: 't1', tier2: 't2', tier3: 't3' };
// A fixed, readable accent per sponsor for monogram logos, picked from the sponsor id so it never changes between loads.
const ACCENTS = ['#ff4937', '#037732', '#cc511d', '#5f7f5a', '#2f8a5e', '#de2b44', '#6b6b6b', '#3a6ea5'];

function initials(brand) {
  const words = String(brand || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  const out = (words.length > 1 ? words.slice(0, 3).map(w => w[0]) : [...(words[0] || '?')].slice(0, 2)).join('');
  return out.toUpperCase();
}

// 'MM/DD' and 'YYYY' in the offer's own time zone, as the prototype stores dates.
function parts(iso, timeZone) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat('en-US', { timeZone: timeZone || 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  return { md: p.month + '/' + p.day, year: p.year };
}

function itemToCoupon(item) {
  const D = root.DeckCore;
  const id = String(item.id || '');
  const start = parts(item.startsAt, item.timezone), end = parts(item.expiresAt, item.timezone);
  const terms = Array.isArray(item.terms) ? item.terms.map(String).filter(Boolean) : [];
  // Size capped by the prototype's tier, and the paper style from the shape, as DeckCore.sanitize does.
  const tier = TIER[item.tier] || 't3', cap = D.TIERS[tier];
  const size = (v, max) => (Number.isInteger(v) ? Math.min(Math.max(v, 1), max) : 1);
  const cols = size(item.cols, cap.cols), rows = size(item.rows, cap.rows);
  return {
    id,
    brand: String(item.brand || 'Sponsor'),
    role: String(item.role || ''),
    featured: item.featured === true && !!item.offerId, // owner rule: only a sponsor with a published offer is featured
    tier,
    cols, rows,
    style: D.styleFor(cols, rows),
    limited: false,
    site: typeof item.site === 'string' ? item.site : '',
    logoSrc: typeof item.logo === 'string' ? item.logo : null,
    logoImg: null,
    photos: (Array.isArray(item.photos) ? item.photos : []).map(p => (typeof p === 'string' ? p : p && p.src)).filter(s => typeof s === 'string' && /^(https:\/\/|\/(?!\/))/.test(s)),
    // Monogram, shape and colour: given values when valid (the testbed passes the prototype's own), else stable per sponsor.
    mark: typeof item.mark === 'string' && item.mark.trim() ? item.mark.trim().slice(0, 3) : initials(item.brand),
    shape: D.SHAPES.includes(item.shape) ? item.shape : D.SHAPES[D.hashStr(id || 'x') % D.SHAPES.length],
    color: /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : ACCENTS[D.hashStr(id || 'x') % ACCENTS.length],
    bpm: 90,
    type: TYPE[String(item.type || '').toLowerCase()] || 'Discount',
    short: String(item.short || ''),
    long: String(item.long || ''),
    from: start ? start.md : '',
    to: end ? end.md : '',          // '' = no end date: renderers show no expiry treatment
    year: end ? end.year : '',
    where: String(item.where || ''),
    limit: String(item.limit || ''),
    terms,
    remaining: undefined, total: undefined, // no stock data: renderers show the offer as available, with no counter
    offerId: item.offerId || null,
    noOffer: !item.offerId,          // a sponsor with no published offer: renderers show its role and a Visit site link
  };
}

// Wall settings (sponsor-wall-schema) → the prototype's wall settings (DeckCore.wallOf).
function settingsToWall(settings) {
  const D = root.DeckCore, s = settings || {};
  return D.wallOf({ v: 2, layout: s.format === 'cascade' ? 'cascade' : 'featured', theme: 'dark', cards: s.cards === 'white' ? 'white' : 'dark',
    openSlots: s.openSlots !== false, cutGap: s.cutGap, cutPad: s.cutPad });
}

function toDeck(data) {
  const items = Array.isArray(data && data.items) ? data.items : [];
  return { coupons: items.map(itemToCoupon), wall: settingsToWall(data && data.settings) };
}

root.VCWallAdapter = Object.freeze({ itemToCoupon, settingsToWall, toDeck, initials });
})(typeof globalThis !== 'undefined' ? globalThis : this);
