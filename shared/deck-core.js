/* Deck core: the sample offers, validation, the shared deck store and the canvas art.
   Loaded by the deck (index) and the editor (editor.html); exposes window.DeckCore.
   The store stands in for a site connector: the editor writes, the deck reads and listens. */
(function () {
'use strict';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Sample offers (the deck's defaults) ---------- */
const SAMPLE = [
  { id: 'HAL', brand: 'Halcyon Coffee', mark: 'Hc', shape: 'circle', color: '#c8743a', bpm: 72, dub: true,
    type: 'Freebie', short: 'A free 12oz oat latte with any pastry.', from: '11/14', to: '12/31', year: '2026',
    remaining: 42, total: 120, where: 'All 6 Halcyon cafés', limit: '1 per person',
    long: 'Pick any pastry from the case and your oat latte is on us. Swap to any plant milk or make it iced at no charge. Works at the counter or through the Halcyon order-ahead line.',
    terms: ['Valid on one 12oz latte with purchase of any pastry.', 'Plant-milk and iced swaps included; extra shots are charged.', 'Not valid with other offers or loyalty rewards.', 'Show the QR code before paying.'] },
  { id: 'TDW', brand: 'Tidewater Surf', mark: 'Tw', shape: 'pill', color: '#2c8fa8', bpm: 96,
    type: 'Discount', short: '25% off any full wetsuit, in store only.', from: '11/11', to: '11/30', year: '2026',
    remaining: 8, total: 40, where: 'Tidewater Pier St.', limit: '1 per person',
    long: 'Take a quarter off any full-length wetsuit from the winter wall, 3/2 through 6/5. Fitting is free and staff will size you in the shop before you commit.',
    terms: ['25% off one full wetsuit at regular price.', 'Excludes springsuits, boots and hoods.', 'In-store purchase only.', 'Returns refund the discounted price.'] },
  { id: 'NBR', brand: 'Northbound Rail', mark: 'NR', shape: 'diamond', color: '#3e5ba9', bpm: 84,
    type: 'Option', short: 'Pick one: a seat upgrade or a lounge pass.', from: '11/18', to: '01/15', year: '2026 – 27',
    remaining: 17, total: 50, where: 'Any Northbound station', limit: '1 per booking',
    long: 'Choose how you travel: move up to First on any single journey under 4 hours, or spend your wait in the Platform Lounge with coffee and quiet desks. Decide at the ticket desk.',
    terms: ['Choose one option when you redeem; it cannot be split.', 'Upgrade subject to First Class availability.', 'Lounge pass valid for 3 hours on the day of travel.', 'Not exchangeable for cash or credit.'] },
  { id: 'PLM', brand: 'Plume Cycles', mark: 'Pl', shape: 'hex', color: '#d2483f', bpm: 120,
    type: 'Discount', short: '$40 off a full service tune-up.', from: '11/11', to: '12/20', year: '2026',
    remaining: 31, total: 60, where: 'Plume Workshop, Dock 4', limit: '1 per bike',
    long: 'Our full tune-up covers gears, brakes, wheel truing and a drivetrain clean. With this coupon the $95 service drops to $55. Book a slot and drop the bike off in the morning.',
    terms: ['Applies to the Full Service tune-up only.', 'Parts are charged separately at shelf price.', 'Booking required; walk-ins as space allows.', 'One coupon per bicycle.'] },
  { id: 'EMR', brand: 'Ember & Rye', mark: 'E&R', shape: 'squircle', color: '#b5552b', bpm: 60, dub: true,
    type: 'Freebie', short: 'A free sourdough loaf, Saturdays only.', from: '11/15', to: '12/27', year: '2026',
    remaining: 55, total: 80, where: 'Ember & Rye Bakery', limit: '1 per Saturday',
    long: 'Our 36-hour country sourdough, baked at dawn. Come in on any Saturday morning during the run and take a loaf home with no purchase needed while the batch lasts.',
    terms: ['Saturdays only, while the morning batch lasts.', 'Country sourdough only; specialty loaves excluded.', 'No purchase required.', 'One loaf per person per Saturday.'] },
  { id: 'LUM', brand: 'Lumen Cinema', mark: 'Lu', shape: 'star', color: '#d9a32e', bpm: 128,
    type: 'Option', short: '2-for-1 tickets or a free large popcorn.', from: '11/12', to: '12/18', year: '2026',
    remaining: 24, total: 100, where: 'Lumen, Screens 1–5', limit: '1 per visit',
    long: 'Bring a friend for free on any standard screening, or keep it solo and get a large popcorn on the house. Works for matinees and evening shows, Monday through Thursday.',
    terms: ['Monday to Thursday screenings only.', '2-for-1 applies to standard 2D seats.', 'Choose one option at the box office.', 'Excludes premieres and special events.'] },
  { id: 'FLD', brand: 'Fieldnote Books', mark: 'Fn', shape: 'shield', color: '#4e7d4a', bpm: 90,
    type: 'Discount', short: '15% off your whole basket, any genre.', from: '11/11', to: '12/24', year: '2026',
    remaining: 12, total: 30, where: 'Fieldnote, Market Row', limit: '1 per person',
    long: 'Fill a basket from any shelf (new releases, used stacks, stationery) and take 15% off the total. Staff can gift-wrap anything over $20 at no cost through December.',
    terms: ['15% off the full basket in one transaction.', 'Excludes gift cards and event tickets.', 'Cannot be combined with member pricing.', 'In-store only.'] },
  { id: 'KLN', brand: 'Kiln Studio', mark: 'Ki', shape: 'octagon', color: '#9c5a8e', bpm: 104,
    type: 'Freebie', short: 'A free intro wheel class for one.', from: '11/20', to: '01/31', year: '2026 – 27',
    remaining: 4, total: 20, where: 'Kiln Studio, Unit 9', limit: '1 per person',
    long: 'A two-hour beginner session on the wheel. Clay, glaze and one firing are included, and you collect your finished piece about two weeks later.',
    terms: ['Valid for one seat in an Intro to Wheel class.', 'Booking required at least 48 hours ahead.', 'Includes clay, glaze and one firing.', 'Cancellations under 24 hours forfeit the seat.'] },
  { id: 'ORB', brand: 'Orbit Arcade', mark: 'Ob', shape: 'ring', color: '#6b4fd0', bpm: 140,
    type: 'Option', short: '20 free tokens or one hour of free play.', from: '11/11', to: '12/31', year: '2026',
    remaining: 38, total: 75, where: 'Orbit Arcade, Level 2', limit: '1 per visit',
    long: 'Load 20 tokens onto a play card, or get a wristband for one hour of unlimited cabinet play. The rhythm machines and the racing pods are included.',
    terms: ['Choose tokens or timed play at the desk.', 'Wristband hour starts when issued.', 'Excludes prize-redemption games.', 'Under 12s with an adult.'] },
  { id: 'VRD', brand: 'Verdant Grocer', mark: 'Vg', shape: 'tri', color: '#2f8a5e', bpm: 110,
    type: 'Discount', short: '$10 off when you spend $50 or more.', from: '11/11', to: '11/29', year: '2026',
    remaining: 60, total: 150, where: 'Both Verdant stores', limit: '1 per household',
    long: 'Stock up on the weekly shop and take $10 off at the till once you hit $50. Works on produce, the deli counter and the bulk bins.',
    terms: ['Minimum spend $50 after other discounts.', 'Excludes alcohol, tobacco and gift cards.', 'One coupon per household per week.', 'In-store only.'] },
];


function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

const SHAPES = ['circle', 'pill', 'diamond', 'hex', 'squircle', 'star', 'shield', 'octagon', 'ring', 'tri'];
const TYPES = ['Option', 'Discount', 'Freebie'];

const EDIT_KEYS = ['brand', 'mark', 'shape', 'color', 'bpm', 'type', 'short', 'from', 'to', 'year', 'remaining', 'total', 'where', 'limit', 'long', 'terms', 'logoImg'];
const LIMITS = { brand: 24, mark: 3, short: 64, from: 5, to: 5, year: 11, where: 40, limit: 30, long: 420 };
function sanitize(c) {
  for (const k of Object.keys(LIMITS)) c[k] = String(c[k] ?? '').slice(0, LIMITS[k]);
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
function editable(c) { const o = {}; EDIT_KEYS.forEach(k => { o[k] = c[k]; }); return o; }
function serialOf(c) { return `No. ${c.id}-${String(c.total).padStart(4, '0')}`; }
function loadImg(c) {
  if (!c.logoImg) { c._img = null; return Promise.resolve(); }
  return new Promise(res => { const im = new Image(); im.onload = () => { c._img = im; res(); }; im.onerror = () => { c.logoImg = null; c._img = null; res(); }; im.src = c.logoImg; });
}

/* ---------- Store: localStorage on the artifact's origin, plus a BroadcastChannel so open tabs update live ---------- */
const KEY = 'sponsor-drops-deck-v1';
let channel = null;
try { channel = new BroadcastChannel(KEY); } catch (e) { channel = null; }
const sample = () => JSON.parse(JSON.stringify(SAMPLE));
function normalize(d) {
  const coupons = sample(); let count = coupons.length;
  if (d && typeof d === 'object') {
    if (Array.isArray(d.coupons)) d.coupons.slice(0, coupons.length).forEach((o, i) => {
      if (o && typeof o === 'object') EDIT_KEYS.forEach(k => { if (k in o) coupons[i][k] = o[k]; });
    });
    if (d.count) count = clamp(Math.round(+d.count) || coupons.length, 1, coupons.length);
  }
  coupons.forEach(sanitize);
  return { count, coupons };
}
function load() {
  let d = null;
  try { const raw = localStorage.getItem(KEY); if (raw) d = JSON.parse(raw); } catch (e) { d = null; }
  return normalize(d);
}
/* Returns true when the deck was stored; false when this browser blocks storage. */
function save(deck) {
  const payload = { count: deck.count, coupons: deck.coupons.map(editable), savedAt: new Date().toISOString() };
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
function drawFace(c, serial, withPreview) {
  const W = 600, H = 960, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f5f2e9'; ctx.fillRect(0, 0, W, H);
  // paper grain
  const rng = mulberry32(hashStr(c.id));
  for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(60,50,40,${0.02 + rng() * 0.04})`; ctx.fillRect(rng() * W, rng() * H, 1.4, 1.4); }
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
  ctx.strokeStyle = 'rgba(17,16,14,0.4)'; ctx.setLineDash([10, 9]); ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(34, py); ctx.lineTo(W - 34, py); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#0b0b0b';
  ctx.beginPath(); ctx.arc(0, py, 18, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W, py, 18, 0, Math.PI * 2); ctx.fill();
  if (withPreview) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    ctx.fillStyle = '#a54635'; ctx.font = '800 28px "DM Sans", Arial, sans-serif';
    ctx.fillText(`${c.type} offer`.toUpperCase(), W / 2, H * 0.455);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    // a narrow centred column, so the text stays clear where neighbouring cards overlap on phones
    ctx.fillStyle = '#0b0b0b'; ctx.font = '800 62px "Barlow Condensed", Impact, sans-serif';
    const lines = wrapLines(ctx, c.short.toUpperCase(), W - 190, 4);
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, H * 0.455 + 68 + i * 58));
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    ctx.fillStyle = '#48433d'; ctx.font = '700 26px "DM Sans", Arial, sans-serif';
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
  SAMPLE, SHAPES, TYPES, EDIT_KEYS, clamp, sanitize, editable, serialOf, loadImg,
  load, save, clear, subscribe, sample: () => normalize(null),
  mulberry32, hashStr, shapePath, drawLogo, drawFace, drawUploadedLogo, logoColor,
});
})();
