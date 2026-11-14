/* Deck core: the sample offers, validation, the shared deck store and the canvas art.
   Loaded by the deck (index) and the editor (editor.html); exposes window.DeckCore.
   The store stands in for a site connector: the editor writes, the deck reads and listens. */
(function () {
'use strict';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Sample offers (the deck's defaults) ---------- */
const SIM = 'Simulated example for this prototype. Not a real offer and cannot be redeemed.';
/* Sponsor names, roles, sites and logos are from tickets.vibecity.art (Vibe Check: After Hours).
   Every offer below is a simulated example written for this prototype. */
const SAMPLE = [
  { id: 'CVR', brand: 'Casa Verde Ramos', role: 'Venue partner', featured: true, site: 'https://www.casaverde.ph/', logoSrc: 'shared/sponsors/casa-verde.png',
    mark: 'CV', shape: 'circle', color: '#037732', bpm: 72, type: 'Freebie', short: 'A free dessert with any main course.', from: '11/19', to: '12/19', year: '2026',
    remaining: 96, total: 150, where: '69 Lim Tian Teng St., Cebu City', limit: '1 per ticket',
    long: 'Come back after the show. Order any main course at Casa Verde and a dessert from the regular menu is included.',
    terms: ['One dessert with one main course, dine-in only.', 'Show your ticket QR to your server before ordering.', 'Not valid with other promos.', SIM] },
  { id: 'FRI', brand: 'Freedom Island Light Rum', role: 'Event partner', featured: true, site: 'https://www.ginebrasanmiguel.com/', logoSrc: 'shared/sponsors/freedom-island.png',
    mark: 'FI', shape: 'pill', color: '#cc511d', bpm: 96, type: 'Freebie', short: 'One welcome cocktail at the event bar.', from: '11/19', to: '11/20', year: '2026',
    remaining: 127, total: 150, where: 'Event bar, Casa Verde Ramos', limit: '1 per ticket, 18+',
    long: 'Start the night with a Freedom Island Light Rum cocktail on the house. Pick it up at the event bar any time before midnight.',
    terms: ['One cocktail per ticket, on the night of the event only.', 'For guests 18 and over. Valid ID may be asked for.', 'Drink responsibly.', SIM] },
  { id: 'DWT', brand: 'Dawata Wellness Resort and Cafe', role: 'Featured sponsor', featured: true, site: 'https://www.dawatawellness.com/', logoSrc: 'shared/sponsors/dawata.png',
    mark: 'DW', shape: 'squircle', color: '#5f7f5a', bpm: 60, type: 'Discount', short: '15% off a day pass or your café bill.', from: '11/20', to: '12/19', year: '2026',
    remaining: 41, total: 60, where: 'Dawata Wellness Resort and Cafe', limit: '1 per ticket',
    long: 'Slow down the morning after. Take 15% off a wellness day pass or the bill at the café, whichever you choose on the day.',
    terms: ['Choose the day pass or the café bill; not both.', 'Book day passes at least one day ahead.', 'Show your ticket QR when you pay.', SIM] },
  { id: 'AIR', brand: 'Air Condo', role: 'Sponsor', site: 'https://irealtee.com/developers/cebu-rite-homes-development-and-realty-corp', logoSrc: 'shared/sponsors/air-condo.png',
    mark: 'AC', shape: 'hex', color: '#ff521a', bpm: 110, type: 'Freebie', short: 'Coffee for two when you book a viewing.', from: '11/20', to: '12/19', year: '2026',
    remaining: 18, total: 30, where: 'Air Condo showroom, Cebu City', limit: '1 per household',
    long: 'Curious about the building? Book a showroom viewing with your ticket and coffee for two is on Air Condo.',
    terms: ['Viewing by appointment.', 'One redemption per household.', 'No purchase needed.', SIM] },
  { id: 'KTC', brand: 'Know The Culture', role: 'Sponsor', site: 'https://knowtheculture.ph', logoSrc: 'shared/sponsors/know-the-culture.png',
    mark: 'KTC', shape: 'diamond', color: '#6b6b6b', bpm: 128, type: 'Discount', short: '10% off one item, in store or online.', from: '11/19', to: '12/19', year: '2026',
    remaining: 52, total: 100, where: 'knowtheculture.ph', limit: '1 per ticket',
    long: 'Take 10% off any single item from Know The Culture. Use it at the event stall, in store, or online with your claim code.',
    terms: ['One item per ticket at regular price.', 'Online: enter your claim code at checkout.', 'Excludes collaborations and sale items.', SIM] },
  { id: 'PET', brand: 'Pets Society Veterinary and Wellness', role: 'Sponsor', site: 'https://www.petssociety.ph/', logoSrc: 'shared/sponsors/pets-society.png',
    mark: 'PS', shape: 'shield', color: '#2f8a5e', bpm: 84, type: 'Freebie', short: 'A free wellness check for one pet.', from: '11/20', to: '12/19', year: '2026',
    remaining: 9, total: 25, where: 'Pets Society clinic, Cebu City', limit: '1 pet per ticket',
    long: 'Bring your dog or cat in for a basic wellness check with the Pets Society team. Vaccines, tests and treatment are quoted separately.',
    terms: ['By appointment, on weekdays.', 'Covers one basic wellness check for one pet.', 'Vaccines, tests and medicine are not included.', SIM] },
  { id: 'DSZ', brand: 'DESAINZ', role: 'Supporting sponsor', site: 'https://www.instagram.com/desainz_/', logoSrc: 'shared/sponsors/desainz.png',
    mark: 'DZ', shape: 'octagon', color: '#8a8a8a', bpm: 104, type: 'Discount', short: '10% off one custom design order.', from: '11/19', to: '12/19', year: '2026',
    remaining: 14, total: 20, where: 'Order by Instagram message', limit: '1 per ticket',
    long: 'Planning merch, a poster or a logo? Message DESAINZ with your claim code and take 10% off one custom design order.',
    terms: ['One order per ticket.', 'Send your claim code when you ask for a quote.', 'Printing costs are quoted separately.', SIM] },
  { id: 'NBC', brand: 'Northbound Barbershop Cebu', role: 'Supporting sponsor', site: 'https://www.instagram.com/northboundcebu', logoSrc: 'shared/sponsors/northbound.png',
    mark: 'NB', shape: 'ring', color: '#de2b44', bpm: 90, type: 'Option', short: '₱100 off a haircut, or a free beard trim with any cut.', from: '11/19', to: '12/19', year: '2026',
    remaining: 33, total: 50, where: 'Northbound Barbershop Cebu', limit: '1 per ticket',
    long: 'Fresh for the night or tidy after it. Choose ₱100 off any haircut, or add a beard trim to your cut at no charge.',
    terms: ['Choose one option when you pay.', 'Walk-ins welcome; booking recommended on weekends.', 'Show your ticket QR at the counter.', SIM] },
];


function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

const SHAPES = ['circle', 'pill', 'diamond', 'hex', 'squircle', 'star', 'shield', 'octagon', 'ring', 'tri'];
const TYPES = ['Option', 'Discount', 'Freebie'];

const EDIT_KEYS = ['brand', 'mark', 'shape', 'color', 'bpm', 'type', 'short', 'from', 'to', 'year', 'remaining', 'total', 'where', 'limit', 'long', 'terms', 'logoImg', 'featured'];
const LIMITS = { brand: 40, mark: 3, short: 64, from: 5, to: 5, year: 11, where: 40, limit: 30, long: 420 };
function sanitize(c) {
  for (const k of Object.keys(LIMITS)) c[k] = String(c[k] ?? '').slice(0, LIMITS[k]);
  c.featured = c.featured === true; // partners and top-tier sponsors carry a Featured badge
  if (!c.brand.trim()) c.brand = 'Untitled sponsor';
  if (!c.mark.trim()) c.mark = c.brand.slice(0, 2);
  c.total = clamp(Math.round(+c.total || 1), 1, 9999);
  c.remaining = clamp(Math.round(+c.remaining || 0), 0, c.total);
  c.bpm = clamp(Math.round(+c.bpm || 90), 40, 180);
  if (!SHAPES.includes(c.shape)) c.shape = 'circle';
  if (!/^#[0-9a-f]{6}$/i.test(c.color || '')) c.color = '#888888';
  if (!TYPES.includes(c.type)) c.type = 'Discount';
  if (!Array.isArray(c.terms)) c.terms = String(c.terms || '').split('\n');
  c.terms = c.terms.map(t => String(t).trim().slice(0, 160)).filter(Boolean).slice(0, 8);
  if (typeof c.logoImg !== 'string' || !c.logoImg.startsWith('data:image/')) c.logoImg = null;
  return c;
}
/* Card stock in the design kit's two themes: Paper (light) and Dark. */
const THEMES = {
  paper: { stock: '#f5f2e9', ink: '#0b0b0b', muted: '#48433d', brandInk: '#a54635', grain: '60,50,40', grainA: 1,
    perf: 'rgba(17,16,14,0.4)', notch: '#0b0b0b', edge: '#ebe7df', edgeB: '#d9d4ca', back: '#bdb5a8' },
  dark: { stock: '#1a1a1a', ink: '#f5f2e9', muted: '#c9c5be', brandInk: '#ff4937', grain: '255,255,255', grainA: 0.55,
    perf: 'rgba(255,255,255,0.32)', notch: '#0b0b0b', edge: '#2c2925', edgeB: '#3a3631', back: '#121110' },
};
const themeOf = t => (t === 'dark' ? 'dark' : 'paper');
/* How many card layers a stack shows: its share left, in 1 to 6 layers (sold out: 1). */
function stackSize(c) { return c.remaining <= 0 ? 1 : 1 + Math.ceil((c.remaining / c.total) * 5); }
function editable(c) { const o = {}; EDIT_KEYS.forEach(k => { o[k] = c[k]; }); return o; }
function serialOf(c) { return `No. ${c.id}-${String(c.total).padStart(4, '0')}`; }
/* Loads the card's logo: an uploaded image if there is one, else the sponsor's logo file.
   Also measures the logo's tone so light logos can sit on a dark plate (and dark ones on a light plate). */
function loadImg(c) {
  const src = c.logoImg || c.logoSrc || null;
  if (!src) { c._img = null; c._tone = 'mid'; return Promise.resolve(); }
  return new Promise(res => {
    const im = new Image();
    im.onload = () => { c._img = im; c._tone = toneOf(im); res(); };
    im.onerror = () => { if (c.logoImg) c.logoImg = null; c._img = null; c._tone = 'mid'; res(); };
    im.src = src;
  });
}
function toneOf(img) {
  try {
    const S = 48, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, S, S);
    const d = ctx.getImageData(0, 0, S, S).data; let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
    const lum = n ? sum / n : 128;
    return lum > 185 ? 'light' : lum < 60 ? 'dark' : 'mid';
  } catch (e) { return 'mid'; }
}
/* Which plate a logo needs on a ground ('light' or 'dark'): 'dark', 'light' or null. */
function plateFor(c, ground) { return !c._img ? null : c._tone === 'light' && ground === 'light' ? 'dark' : c._tone === 'dark' && ground === 'dark' ? 'light' : null; }
/* The logo as a canvas for a given ground, with a rounded plate baked in when it needs one. */
function logoCanvasFor(c, ground) {
  if (!c._img) return drawLogo(c);
  const logo = drawUploadedLogo(c._img), plate = plateFor(c, ground);
  if (!plate) return logo;
  const pad = Math.round(Math.max(logo.width, logo.height) * 0.12), cv = document.createElement('canvas');
  cv.width = logo.width + pad * 2; cv.height = logo.height + pad * 2;
  const ctx = cv.getContext('2d'); ctx.fillStyle = plate === 'dark' ? '#0b0b0b' : '#ffffff';
  ctx.beginPath(); ctx.roundRect(0, 0, cv.width, cv.height, pad * 0.8); ctx.fill();
  ctx.drawImage(logo, pad, pad); return cv;
}

/* ---------- Store: localStorage on the artifact's origin, plus a BroadcastChannel so open tabs update live ---------- */
const KEY = 'sponsor-drops-deck-v2';
let channel = null;
try { channel = new BroadcastChannel(KEY); } catch (e) { channel = null; }
const sample = () => JSON.parse(JSON.stringify(SAMPLE));
/* Offer wall display settings, shared by the wall page and the editor. */
const WALL_LAYOUTS = ['featured', 'cascade', 'ledger', 'spotlight', 'guide'];
function wallOf(w) {
  w = w && typeof w === 'object' ? w : {};
  return {
    v: 2, // settings saved before the Featured + Cascade layout existed move to it once
    layout: w.v === 2 && WALL_LAYOUTS.includes(w.layout) ? w.layout : 'featured',
    theme: w.theme === 'light' ? 'light' : 'dark',
    cards: w.cards === 'white' ? 'white' : 'theme',
    openSlots: w.openSlots !== false,
  };
}
function normalize(d) {
  const coupons = sample(); let count = coupons.length, theme = 'paper';
  if (d && typeof d === 'object') {
    theme = themeOf(d.theme);
    if (Array.isArray(d.coupons)) d.coupons.slice(0, coupons.length).forEach((o, i) => {
      if (o && typeof o === 'object') EDIT_KEYS.forEach(k => { if (k in o) coupons[i][k] = o[k]; });
    });
    if (d.count) count = clamp(Math.round(+d.count) || coupons.length, 1, coupons.length);
  }
  coupons.forEach(sanitize);
  return { count, theme, wall: wallOf(d && d.wall), coupons };
}
function load() {
  let d = null;
  try { const raw = localStorage.getItem(KEY); if (raw) d = JSON.parse(raw); } catch (e) { d = null; }
  return normalize(d);
}
/* Returns true when the deck was stored; false when this browser blocks storage. */
function save(deck) {
  const payload = { count: deck.count, theme: themeOf(deck.theme), wall: wallOf(deck.wall), coupons: deck.coupons.map(editable), savedAt: new Date().toISOString() };
  let stored = true;
  try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch (e) { stored = false; }
  try { if (channel) channel.postMessage(payload); } catch (e) { /* closed channel */ }
  return stored;
}
function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* blocked */ } const d = normalize(null); try { if (channel) channel.postMessage({ count: d.count, coupons: d.coupons.map(editable) }); } catch (e) {} return d; }
function subscribe(cb) {
  if (channel) channel.onmessage = e => cb(normalize(e.data));
  else addEventListener('storage', e => { if (e.key === KEY) cb(load()); });
}

/* ---------- Canvas art ---------- */
function shapePath(ctx, shape, cx, cy, R) {
  ctx.beginPath();
  const poly = (n, r, rot) => { for (let i = 0; i < n; i++) { const a = rot + i * Math.PI * 2 / n; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); };
  switch (shape) {
    case 'circle': case 'ring': ctx.arc(cx, cy, R, 0, Math.PI * 2); break;
    case 'pill': { const w = R * 2, h = R * 1.35, r = h / 2; ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r); break; }
    case 'diamond': poly(4, R * 1.08, -Math.PI / 2); break;
    case 'hex': poly(6, R * 1.02, 0); break;
    case 'octagon': poly(8, R * 1.0, Math.PI / 8); break;
    case 'squircle': ctx.roundRect(cx - R * 0.9, cy - R * 0.9, R * 1.8, R * 1.8, R * 0.55); break;
    case 'tri': poly(3, R * 1.12, -Math.PI / 2); break;
    case 'star': for (let i = 0; i < 24; i++) { const a = -Math.PI / 2 + i * Math.PI / 12; const r = i % 2 ? R * 0.82 : R * 1.02; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); break;
    case 'shield': ctx.moveTo(cx - R * 0.85, cy - R * 0.85); ctx.lineTo(cx + R * 0.85, cy - R * 0.85); ctx.lineTo(cx + R * 0.85, cy + R * 0.1); ctx.quadraticCurveTo(cx + R * 0.8, cy + R * 0.8, cx, cy + R * 1.05); ctx.quadraticCurveTo(cx - R * 0.8, cy + R * 0.8, cx - R * 0.85, cy + R * 0.1); ctx.closePath(); break;
  }
}
function drawLogo(c) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'); const cx = S / 2, cy = S / 2, R = 100;
  ctx.lineJoin = 'round';
  shapePath(ctx, c.shape, cx, cy, R);
  ctx.fillStyle = c.color; ctx.strokeStyle = c.color; ctx.lineWidth = 18; ctx.stroke(); ctx.fill();
  ctx.save(); ctx.translate(cx, cy); ctx.scale(0.8, 0.8); ctx.translate(-cx, -cy);
  shapePath(ctx, c.shape, cx, cy, R); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3.5; ctx.stroke(); ctx.restore();
  if (c.shape === 'ring') { ctx.beginPath(); ctx.arc(cx + R * 0.52, cy - R * 0.52, 11, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); }
  const fs = c.mark.length > 2 ? 64 : 84;
  ctx.fillStyle = '#fff'; ctx.font = `900 ${fs + 14}px "Barlow Condensed", Impact, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(c.mark.toUpperCase(), cx, cy + (c.shape === 'tri' ? 22 : 4));
  return cv;
}
function wrapLines(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean), lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width <= maxW || !line) line = t; else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines); let last = kept[maxLines - 1] + '…';
    while (ctx.measureText(last).width > maxW && last.length > 2) last = last.slice(0, -2) + '…';
    kept[maxLines - 1] = last; return kept;
  }
  return lines;
}
/* withPreview: the table version of the card, which also prints the promotion type, a short
   description of the offer and how many are left, sized to read at table distance. */
function drawFace(c, serial, withPreview, themeName) {
  const th = THEMES[themeOf(themeName)];
  const W = 600, H = 960, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = th.stock; ctx.fillRect(0, 0, W, H);
  // paper grain
  const rng = mulberry32(hashStr(c.id));
  for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(${th.grain},${(0.02 + rng() * 0.04) * th.grainA})`; ctx.fillRect(rng() * W, rng() * H, 1.4, 1.4); }
  // guilloche rosette (security-print watermark) centered at 40%
  const gx = W / 2, gy = H * 0.4;
  ctx.strokeStyle = c.color; ctx.lineWidth = 1.1;
  for (let k = 0; k < 14; k++) {
    ctx.globalAlpha = 0.09 + (k % 3) * 0.025; ctx.beginPath();
    for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.01) {
      const r = 150 + 34 * Math.sin(9 * t + k * 0.45) + 16 * Math.cos(17 * t - k * 0.3) + k * 3;
      const x = gx + Math.cos(t) * r, y = gy + Math.sin(t) * r; t ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // inset border
  ctx.strokeStyle = c.color; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.strokeRect(18, 18 + H * 0.075, W - 36, H - 36 - H * 0.075); ctx.globalAlpha = 1;
  // top band
  ctx.fillStyle = c.color; ctx.fillRect(0, 0, W, H * 0.075);
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = '700 22px "DM Sans", Arial, sans-serif'; ctx.textBaseline = 'middle';
  ctx.textAlign = 'left'; ctx.fillText(serial.toUpperCase(), 30, H * 0.0375);
  ctx.textAlign = 'right'; ctx.fillText('LIMITED RUN', W - 30, H * 0.0375);
  // microtext rule under band
  ctx.fillStyle = c.color; ctx.globalAlpha = 0.45; ctx.font = '700 11px "DM Sans", Arial, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText((c.brand.toUpperCase() + ' · ').repeat(12), 22, H * 0.075 + 26); ctx.globalAlpha = 1;
  // perforation + notches
  const py = H * 0.8;
  ctx.strokeStyle = th.perf; ctx.setLineDash([10, 9]); ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(34, py); ctx.lineTo(W - 34, py); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = th.notch;
  ctx.beginPath(); ctx.arc(0, py, 18, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W, py, 18, 0, Math.PI * 2); ctx.fill();
  if (withPreview) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    ctx.fillStyle = th.brandInk; ctx.font = '800 28px "DM Sans", Arial, sans-serif';
    ctx.fillText(`${c.type} offer`.toUpperCase(), W / 2, H * 0.455);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    // a narrow centred column, so the text stays clear where neighbouring cards overlap on phones
    ctx.fillStyle = th.ink; ctx.font = '800 62px "Barlow Condensed", Impact, sans-serif';
    const lines = wrapLines(ctx, c.short.toUpperCase(), W - 190, 4);
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, H * 0.455 + 68 + i * 58));
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    ctx.fillStyle = th.muted; ctx.font = '700 26px "DM Sans", Arial, sans-serif';
    ctx.fillText(`${c.remaining} OF ${c.total} LEFT`, W / 2, H * 0.765);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  return cv;
}
function drawUploadedLogo(img) {
  // keep the logo's own proportions so wide wordmarks can span the coupon
  const k = Math.min(720 / img.width, 360 / img.height);
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); return cv;
}
/* Read the dominant brand colour out of an uploaded logo: skip transparent, near-white,
   near-black and grey pixels, bucket the rest by hue, and take the most saturated-weighted bucket. */
function logoColor(cv) {
  const S = 64, t = document.createElement('canvas'); t.width = t.height = S;
  const ctx = t.getContext('2d'); ctx.drawImage(cv, 0, 0, S, S);
  let d; try { d = ctx.getImageData(0, 0, S, S).data; } catch (e) { return null; }
  const buckets = Array.from({ length: 24 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, ch = mx - mn;
    if (ch < 0.12 || l < 0.1 || l > 0.94) continue;
    let h = mx === r ? ((g - b) / ch) % 6 : mx === g ? (b - r) / ch + 2 : (r - g) / ch + 4; h = (h * 60 + 360) % 360;
    const k = buckets[Math.floor(h / 15)], w = ch;
    k.w += w; k.r += d[i] * w; k.g += d[i + 1] * w; k.b += d[i + 2] * w;
  }
  const best = buckets.reduce((a, b) => (b.w > a.w ? b : a));
  if (best.w < 2) return null;
  const hex = v => Math.round(v / best.w).toString(16).padStart(2, '0');
  return '#' + hex(best.r) + hex(best.g) + hex(best.b);
}

window.DeckCore = Object.freeze({
  SAMPLE, SHAPES, TYPES, EDIT_KEYS, WALL_LAYOUTS, wallOf, THEMES, themeOf, stackSize, clamp, sanitize, editable, serialOf, loadImg,
  load, save, clear, subscribe, plateFor, logoCanvasFor, toneOf, sample: () => normalize(null),
  mulberry32, hashStr, shapePath, drawLogo, drawFace, drawUploadedLogo, logoColor,
});
})();
