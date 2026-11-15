/* <vibe-sponsor-wall>: the offer wall. A host for the exact ports of the prototype walls (wall-offerwall.js,
   wall-vouchers.js, wall-cutouts.js). It validates the settings, turns the live sponsor list into the prototype's deck
   (wall-adapter.js), loads only what the chosen format needs (its fonts, GSAP, ScrollTrigger), and mounts the renderer
   inside a shadow root so the site's styles and the wall's styles never touch.
   Usage: el.data = { event_id, settings, items }. Format 'legacy' draws nothing (the page keeps its offer browser).
   Claim: dispatches 'wall-claim' (bubbles, composed) with { couponId, offerId }.
   Requires: sponsor-wall-schema.js, deck-core.js, wall-adapter.js, and the renderer scripts. */
(function (root) {
'use strict';
const GSAP = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
const SCROLL_TRIGGER = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js';
const loading = new Map();

function loadScript(src) {
  if (!loading.has(src)) {
    loading.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = false; s.crossOrigin = 'anonymous';
      s.onload = resolve; s.onerror = () => { loading.delete(src); reject(new Error('Could not load ' + src)); };
      document.head.append(s);
    }));
  }
  return loading.get(src);
}
// Fonts are loaded by the page: a shadow root uses the document's fonts.
function loadFont(href) {
  if (document.querySelector('link[rel="stylesheet"][href="' + CSS.escape(href) + '"]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.append(l);
}
async function needs(renderer) {
  for (const href of renderer.fonts || []) loadFont(href);
  const want = renderer.needs || [];
  if (want.includes('gsap') && !root.gsap) await loadScript(GSAP);
  if (want.includes('ScrollTrigger')) {
    if (!root.ScrollTrigger) await loadScript(SCROLL_TRIGGER);
    if (root.gsap && root.ScrollTrigger) root.gsap.registerPlugin(root.ScrollTrigger);
  }
}

class VibeSponsorWall extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._settings = root.VCSponsorWallSchema.validate(undefined);
    this._data = null;
    this._handle = null;
    this._run = 0;
  }
  connectedCallback() { if (this._data) this.render(); }
  disconnectedCallback() { this.teardown(); }
  // Bad settings fall back to 'legacy', so a broken save never blanks the Offers view.
  set data(d) {
    let settings;
    try { settings = root.VCSponsorWallSchema.validate(d && d.settings); } catch (e) { settings = root.VCSponsorWallSchema.validate(undefined); }
    this._settings = settings;
    this._data = { event_id: d && typeof d.event_id === 'string' ? d.event_id : null, settings, items: Array.isArray(d && d.items) ? d.items : [] };
    this.setAttribute('data-format', settings.format);
    if (this.isConnected) this.render();
  }
  get format() { return this._settings.format; }

  teardown() {
    if (this._handle) { try { this._handle.destroy(); } catch (e) { /* already gone */ } }
    this._handle = null;
    this.shadowRoot.replaceChildren();
  }

  async render() {
    const run = ++this._run, format = this._settings.format;
    this.teardown();
    if (format === 'legacy') return;
    const renderer = (root.VCWallRenderers || {})[format];
    if (!renderer) { this.setAttribute('data-wall-error', 'missing renderer: ' + format); return; }
    try { await needs(renderer); } catch (e) { this.setAttribute('data-wall-error', e.message); return; }
    if (run !== this._run) return; // a newer render started while loading
    const deck = root.VCWallAdapter.toDeck(this._data);
    const style = document.createElement('style'); style.textContent = renderer.css || '';
    const container = document.createElement('div'); container.className = 'vc-wall-root';
    this.shadowRoot.append(style, container);
    const byId = new Map(deck.coupons.map(c => [c.id, c]));
    this._handle = renderer.mount(container, deck, {
      root: this.shadowRoot,
      onClaim: id => this.dispatchEvent(new CustomEvent('wall-claim', { bubbles: true, composed: true, detail: { couponId: id, offerId: (byId.get(id) || {}).offerId || null } })),
    }) || null;
    this.removeAttribute('data-wall-error');
    this.dispatchEvent(new CustomEvent('wall-rendered', { detail: { format } }));
  }
}

if (!root.customElements.get('vibe-sponsor-wall')) root.customElements.define('vibe-sponsor-wall', VibeSponsorWall);
root.VibeSponsorWall = VibeSponsorWall;
})(typeof globalThis !== 'undefined' ? globalThis : this);
