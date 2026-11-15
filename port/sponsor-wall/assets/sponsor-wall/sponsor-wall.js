/* <vibe-sponsor-wall>: the offer wall for the tickets site. It draws one of the wall formats from the settings and the
   sponsor list it is given. Rendering happens in a shadow root, so the site's stylesheets cannot reach it.
   Usage:  el.data = { settings, items }   (settings: sponsor-wall-schema shape; items: see normalizeItem)
   Every piece of text is set with textContent. Photos and logos are accepted only from https: or same-origin paths. */
(function (root) {
'use strict';
const S = root.VCSponsorWallSchema;
const FORMATS_DRAWN = ['featured', 'cascade', 'vouchers', 'cutouts'];

// Only https links and same-origin paths may be used as images.
function safeImage(url) {
  if (typeof url !== 'string' || url.length > 2048) return null;
  if (/^https:\/\//i.test(url)) return url;
  if (/^\/(?!\/)/.test(url)) return url;
  return null;
}

// A sponsor's piece, with the tier caps applied (size and photo count), and text kept as plain strings.
function normalizeItem(raw, index) {
  const tier = S.TIERS[raw && raw.tier] || S.TIERS.tier3;
  const clamp = (v, lo, hi, dflt) => (Number.isInteger(v) && v >= lo && v <= hi ? v : dflt);
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  return {
    id: str(raw && raw.id, 64) || 'item-' + index,
    brand: str(raw && raw.brand, 120) || 'Sponsor',
    short: str(raw && raw.short, 280),
    long: str(raw && raw.long, 2000),
    terms: Array.isArray(raw && raw.terms) ? raw.terms.filter(t => typeof t === 'string').slice(0, 20).map(t => t.slice(0, 300)) : [],
    where: str(raw && raw.where, 300),
    type: str(raw && raw.type, 40),
    logo: safeImage(raw && raw.logo),
    photos: (Array.isArray(raw && raw.photos) ? raw.photos : []).map(safeImage).filter(Boolean).slice(0, tier.photos),
    tier: tier.id,
    cols: clamp(raw && raw.cols, 1, tier.cols, tier.defaultCols),
    rows: clamp(raw && raw.rows, 1, tier.rows, tier.defaultRows),
    featured: !!(raw && raw.featured),
    order: clamp(raw && raw.order, 0, 99, index),
    offerId: str(raw && raw.offerId, 64) || null,
  };
}

// The piece's paper style comes from its shape, as on the voucher wall.
const styleFor = (cols, rows) => (cols > 1 ? (rows > 1 ? 'magazine' : 'ticket') : rows > 1 ? 'voucher' : 'stub');
// A stable tilt for the cut-out wall, from the piece's id, so it does not change on each render.
const tiltFor = id => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return ((h % 7) - 3) * 0.6; };

// A picture that fails to load is removed, so the piece shows its text instead of a broken icon.
function drop(img) { img.addEventListener('error', () => img.remove()); return img; }

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function pieceFace(item) {
  const face = el('div', 'face');
  const top = el('div', 'top');
  if (item.logo) {
    const img = drop(el('img', 'logo'));
    img.src = item.logo;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    top.append(img);
  } else {
    top.append(el('span', 'monogram', item.brand.trim().charAt(0).toUpperCase() || '•'));
  }
  top.append(el('span', 'tier', S.TIERS[item.tier].name));
  face.append(top);
  face.append(el('strong', 'brand', item.brand));
  if (item.short) face.append(el('p', 'short', item.short));
  if (item.photos.length) {
    const img = drop(el('img', 'photo'));
    img.src = item.photos[0];
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    face.prepend(img);
  }
  return face;
}

class VibeSponsorWall extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._settings = S.validate(undefined);
    this._items = [];
    this._eventId = null;
  }
  connectedCallback() { this.render(); }
  // Set the data: { event_id, settings, items }. Bad settings fall back to the legacy format, so nothing breaks.
  set data(d) {
    let settings;
    try { settings = S.validate(d && d.settings); } catch (e) { settings = S.validate(undefined); }
    this._settings = settings;
    this._eventId = d && typeof d.event_id === 'string' ? d.event_id : null;
    this._items = (Array.isArray(d && d.items) ? d.items : []).map(normalizeItem).sort((a, b) => a.order - b.order || a.brand.localeCompare(b.brand));
    this.render();
  }
  get format() { return this._settings.format; }
  get items() { return this._items.slice(); }

  render() {
    const root = this.shadowRoot;
    root.textContent = '';
    const style = document.createElement('style');
    style.textContent = STYLE;
    root.append(style);
    const s = this._settings;
    this.setAttribute('data-format', s.format);
    if (!FORMATS_DRAWN.includes(s.format)) return; // 'legacy': the page keeps the offer browser; this draws nothing.

    const wrap = el('div', 'wall ' + (s.cards === 'white' ? 'white' : 'dark') + ' f-' + s.format);
    if (s.format === 'cutouts') {
      wrap.style.setProperty('--gap', s.cutGap + 'px');
      wrap.style.setProperty('--pad', s.cutPad + 'px');
    }
    let rest = this._items;
    if (s.format === 'featured') {
      const lead = rest.find(i => i.featured) || rest[0];
      if (lead) {
        rest = rest.filter(i => i !== lead);
        const top = this.piece(lead, 'lead', 3, 2);
        top.classList.add('lead');
        wrap.append(top);
      }
    }
    const grid = el('div', 'grid');
    for (const item of rest) grid.append(this.piece(item, s.format));
    wrap.append(grid);
    if (!this._items.length) wrap.append(el('p', 'empty', 'No sponsors on the wall yet.'));
    root.append(wrap);
    root.append(this.dialog());
  }

  piece(item, format, forceCols, forceRows) {
    const cols = forceCols || item.cols;
    const rows = forceRows || item.rows;
    const shape = format === 'vouchers' ? styleFor(cols, rows) : 'piece';
    const b = el('button', 'piece ' + shape + ' t-' + item.tier + (format === 'cutouts' ? ' cut' : ''));
    b.type = 'button';
    b.style.gridColumn = 'span ' + cols;
    b.style.gridRow = 'span ' + rows;
    b.setAttribute('aria-label', item.brand + ' — details');
    if (format === 'cutouts') b.style.setProperty('--tilt', tiltFor(item.id) + 'deg');
    b.append(pieceFace(item));
    b.addEventListener('click', () => this.open(item, b));
    return b;
  }

  dialog() {
    const d = el('dialog', 'detail');
    d.setAttribute('aria-labelledby', 'dtitle');
    const close = el('button', 'close', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => d.close());
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    const body = el('div', 'dbody');
    body.append(close);
    d.append(body);
    this._dialog = d;
    this._dialogBody = body;
    return d;
  }

  open(item, from) {
    const d = this._dialog;
    const body = this._dialogBody;
    body.textContent = '';
    const close = el('button', 'close', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => d.close());
    body.append(close);
    const h = el('h2', null, item.brand);
    h.id = 'dtitle';
    body.append(h);
    if (item.photos.length) {
      const img = drop(el('img', 'dphoto'));
      img.src = item.photos[0];
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      body.append(img);
    }
    if (item.long || item.short) body.append(el('p', null, item.long || item.short));
    if (item.where) body.append(el('p', 'where', item.where));
    if (item.terms.length) {
      const ol = el('ol', 'terms');
      for (const t of item.terms) ol.append(el('li', null, t));
      body.append(ol);
    }
    body.append(el('p', 'tierline', S.TIERS[item.tier].name + (item.featured ? ' · Featured' : '')));
    d.showModal ? d.showModal() : d.setAttribute('open', '');
    close.focus();
    this._returnFocus = from;
  }
}

const STYLE = `
:host { display: block; box-sizing: border-box; font: 14px/1.4 "DM Sans", Arial, sans-serif; color: #f5f2e9; }
:host([data-format="legacy"]) { display: none; }
*, *::before, *::after { box-sizing: border-box; }
.wall { padding: var(--pad, 24px) 16px; }
.wall.white { color: #0b0b0b; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: 9.5rem; grid-auto-flow: dense; gap: var(--gap, 14px); }
.lead { display: block; width: 100%; margin-bottom: 14px; }
.lead .face { min-height: 14rem; }
.f-featured .lead { grid-column: 1 / -1; }
.piece { position: relative; appearance: none; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.04); color: inherit; font: inherit; text-align: left; cursor: pointer; padding: 0; overflow: hidden; border-radius: 0; min-width: 0; }
.white .piece { border-color: rgba(0,0,0,.18); background: #fbf8f1; }
.piece:focus-visible { outline: 2px solid #ff4937; outline-offset: 2px; }
.face { height: 100%; padding: 10px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.logo { height: 28px; max-width: 60%; object-fit: contain; }
.monogram { width: 28px; height: 28px; display: grid; place-items: center; background: #ff4937; color: #0b0b0b; font: 800 14px/1 "Barlow Condensed", Arial, sans-serif; }
.tier { font: 700 10px/1 "DM Sans", Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; opacity: .75; white-space: nowrap; }
.brand { font: 800 15px/1.1 "Barlow Condensed", Arial, sans-serif; text-transform: uppercase; letter-spacing: .02em; overflow-wrap: anywhere; }
.short { margin: 0; font-size: 12px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .35; z-index: 0; pointer-events: none; }
.face { position: relative; z-index: 1; }
.cut { transform: rotate(var(--tilt, 0deg)); box-shadow: 0 6px 14px rgba(0,0,0,.35); }
.voucher { border-style: dashed; }
.ticket .face { flex-direction: row; }
.magazine { border-width: 2px; }
.empty { opacity: .8; }
dialog.detail { width: min(560px, calc(100vw - 32px)); max-height: 86vh; border: 0; padding: 0; background: #14110f; color: #f5f2e9; }
dialog.detail::backdrop { background: rgba(0,0,0,.6); }
.dbody { padding: 18px; display: grid; gap: 10px; overflow: auto; }
.dbody h2 { margin: 0; font: 800 24px/1.1 "Barlow Condensed", Arial, sans-serif; text-transform: uppercase; }
.dphoto { width: 100%; max-height: 240px; object-fit: cover; }
.close { justify-self: end; appearance: none; border: 1px solid currentColor; background: transparent; color: inherit; padding: 6px 12px; cursor: pointer; font: 700 12px/1 "DM Sans", Arial, sans-serif; text-transform: uppercase; letter-spacing: .08em; }
.where, .tierline { opacity: .8; margin: 0; }
.terms { margin: 0; padding-left: 20px; }
@media (max-width: 420px) { .grid { gap: 8px; } .brand { font-size: 13px; } }
@media (prefers-reduced-motion: reduce) { .cut { transform: none; } }
`;

root.customElements.define('vibe-sponsor-wall', VibeSponsorWall);
root.VibeSponsorWall = VibeSponsorWall;
})(typeof globalThis !== 'undefined' ? globalThis : this);
