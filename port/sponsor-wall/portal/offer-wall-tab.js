/* Page designer → Offer wall tab: choose which offer wall the tickets site shows on the Offers view, plus the
   wall's display settings. The page designer (portal/page-effects.js) mounts this tab; it does not have its own
   nav item. Saving here saves the offer wall only. Publishing sends the draft to the site; the public site reads
   the published settings from /public-sponsor-wall. Each sponsor on the event gets a row: tier, size (which sets its
   template on the voucher wall), Featured and order.
   Access: the Worker decides who may save (owner and admin for now). The tab is only shown to people the portal already
   lets into the page designer; the Worker is the real check. */
window.VCOfferWallTab = (function () {
'use strict';
// Labels shown to editors. The keys are the schema's FORMATS; the order here is the order on screen.
const FORMAT_OPTIONS = [
  { key: 'legacy', label: 'Current offer browser', hint: 'Today’s Offers view, unchanged. The safe default, and the rollback choice.' },
  { key: 'featured', label: 'Featured + Cascade', hint: 'One featured sponsor panel above a cascading wall of offers.' },
  { key: 'cascade', label: 'Cascade', hint: 'A cascading wall of offers, with no featured panel.' },
  { key: 'vouchers', label: 'Voucher wall', hint: 'Offers printed as stubs, vouchers, tickets and magazine cut-outs on a 3-column grid.' },
  { key: 'cutouts', label: 'Cut-out wall', hint: 'Snip-off pieces that drop onto the wall as visitors scroll. Uses extra display fonts.' },
];
const label = key => (FORMAT_OPTIONS.find(o => o.key === key) || FORMAT_OPTIONS[0]).label;
// The tab's own styles, scoped to .sw-tab, so the portal stylesheets need no change.
const STYLE = `<style>
.sw-tab .sw-formats{display:grid;gap:6px;border:1px solid rgba(17,16,14,.14);border-radius:10px;padding:10px 12px;margin:12px 0}
.sw-tab .sw-format{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border:1px solid transparent;border-radius:8px;cursor:pointer}
.sw-tab .sw-format.is-selected{border-color:#ff4937;background:rgba(255,73,55,.06)}
.sw-tab .sw-format input{margin-top:3px}
.sw-tab .sw-format-text{display:grid;gap:2px}
.sw-tab .sw-format-text small{opacity:.75}
.sw-tab .sw-bool{display:inline-flex;gap:6px;align-items:center;margin:4px 18px 4px 0}
.sw-tab .sw-table-wrap{overflow-x:auto;margin:8px 0 12px}
.sw-tab .sw-sponsors{width:100%;min-width:760px;border-collapse:collapse}
.sw-tab .sw-sponsors th,.sw-tab .sw-sponsors td{padding:8px;text-align:left;vertical-align:middle;border-bottom:1px solid rgba(17,16,14,.1)}
.sw-tab .sw-sponsors thead th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.7}
.sw-tab .sw-sponsors th[scope=row]{min-width:180px;font-weight:700}
.sw-tab .sw-sponsors th[scope=row] small{display:block;margin-top:2px;font-weight:400;font-size:12px;opacity:.7}
.sw-tab .sw-sponsors select{width:auto;min-width:0}
.sw-tab .sw-sponsors input[type=number]{width:72px}
.sw-tab [data-sw-default]{white-space:nowrap}
.sw-tab .visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
</style>`;
// Tier names as the portal shows packages (tier1 = Package C, tier2 = Package B, tier3 = Package A).
const PACKAGE = { tier1: 'Package C', tier2: 'Package B', tier3: 'Package A' };
// The template a size gives on the voucher wall, as the prototype decides it from the shape.
const templateFor = (cols, rows) => (cols > 1 ? (rows > 1 ? 'Magazine cut-out' : 'Ticket') : rows > 1 ? 'Voucher' : 'Stub');
// A sponsor's settings in the draft, else what the Worker reported (saved or placement default).
const current = (st, sp) => st.draft.items[sp.id] || { tier: sp.tier, cols: sp.cols, rows: sp.rows, featured: sp.featured, order: sp.order };

// Load the saved offer wall settings: { draft, version }. The page designer calls this before it draws.
// Each event has its own wall. `events` is the portal's event list; the first event is used when none is chosen.
async function load(api, events, eventId) {
  const S = window.VCSponsorWallSchema;
  // Use the portal's event list; if it has not been loaded yet, fetch it, so the tab never wrongly says there are no events.
  let list = Array.isArray(events) && events.length ? events : [];
  if (!list.length) { try { list = (await api('/events')).rows || []; } catch (e) { list = []; } }
  const chosen = eventId || (list[0] && list[0].id) || null;
  if (!chosen) return { events: list, eventId: null, draft: S.validate(undefined), version: 0, status: 'Create an event first.' };
  const saved = await api('/sponsor-wall?event_id=' + encodeURIComponent(chosen));
  return { events: list, eventId: chosen, draft: S.validate(saved.draft), version: saved.version, sponsors: Array.isArray(saved.sponsors) ? saved.sponsors : [], status: '' };
}

// The tab's markup. Pure string output, so the page designer can place it anywhere in its panel.
function html(esc, st) {
  const d = st.draft;
  if (!st.eventId) return `<section class="sw-tab" aria-labelledby="swTabTitle"><h2 id="swTabTitle">Offer wall</h2><p class="notice">${esc(st.status || 'Create an event first.')}</p></section>`;
  return `<section class="sw-tab" aria-labelledby="swTabTitle">${STYLE}
   <h2 id="swTabTitle">Offer wall</h2>
   <label class="field" for="swEvent">Event<select id="swEvent">${(st.events || []).map(ev => `<option value="${esc(ev.id)}" ${ev.id === st.eventId ? 'selected' : ''}>${esc(ev.name || ev.id)}</option>`).join('')}</select></label>
   <p class="notice">Choose the offer wall the tickets site shows on the Offers view for this event. Saving a draft does not change the public site.</p>
   <fieldset class="sw-formats" id="swFormats"><legend>Offer wall format</legend>${FORMAT_OPTIONS.map(o => `<label class="sw-format ${d.format === o.key ? 'is-selected' : ''}"><input type="radio" name="swFormat" value="${esc(o.key)}" ${d.format === o.key ? 'checked' : ''}><span class="sw-format-text"><strong>${esc(o.label)}</strong><small>${esc(o.hint)}</small></span></label>`).join('')}</fieldset>
   <h2>Wall settings</h2>
   <label class="sw-bool"><input type="radio" name="swCards" value="dark" ${d.cards === 'dark' ? 'checked' : ''}> Dark cards</label>
   <label class="sw-bool"><input type="radio" name="swCards" value="white" ${d.cards === 'white' ? 'checked' : ''}> White cards</label>
   <label class="sw-bool"><input type="checkbox" id="swOpenSlots" ${d.openSlots ? 'checked' : ''}> Show open slots on the wall</label>
   <div class="sw-cut-only" ${d.format === 'cutouts' ? '' : 'hidden'}>
    <h2>Cut-out spacing</h2>
    <label class="field sw-range" for="swCutGap"><span>Space between pieces <output id="swCutGapOut">${d.cutGap}</output></span><input id="swCutGap" type="range" min="0" max="64" step="2" value="${d.cutGap}"></label>
    <label class="field sw-range" for="swCutPad"><span>Edge padding <output id="swCutPadOut">${d.cutPad}</output></span><input id="swCutPad" type="range" min="0" max="200" step="4" value="${d.cutPad}"></label>
   </div>
   <h2>Sponsors</h2>
   <p class="notice">Each sponsor's size on the 3-column grid sets its template on the voucher wall. Its tier caps the size and the number of photos. Only sponsors with a published offer can be featured.</p>
   ${sponsorRows(esc, st)}
   <p class="notice">Every format keeps the same three-column grid on phones and desktops.</p>
   <p class="sw-selected">Selected: <strong>${esc(label(d.format))}</strong></p>
   <p id="swStatus" role="status">${esc(st.status || '')}</p>
   <div class="dialog-actions"><button class="button secondary" id="swDefaults" type="button">Reset to defaults</button><button class="button secondary" id="swSave" type="button">Save draft</button><button class="button primary" id="swPublish" type="button">Publish to site ↗</button></div>
  </section>`;
}

function sponsorRows(esc, st) {
  const S = window.VCSponsorWallSchema, list = (st.sponsors || []).slice().sort((a, b) => current(st, a).order - current(st, b).order);
  if (!list.length) return '<p class="notice" id="swNoSponsors">No sponsors are placed on this event yet. Add them in Sponsor spots.</p>';
  const opt = (n, v) => Array.from({ length: n }, (_, k) => k + 1).map(k => `<option value="${k}" ${k === v ? 'selected' : ''}>${k}</option>`).join('');
  return `<div class="sw-table-wrap"><table class="sw-sponsors"><thead><tr><th scope="col">Sponsor</th><th scope="col">Tier</th><th scope="col">Columns</th><th scope="col">Rows</th><th scope="col">Template</th><th scope="col">Featured</th><th scope="col">Order</th><th scope="col"><span class="visually-hidden">Default</span></th></tr></thead><tbody>${list.map(sp => {
    const c = current(st, sp), cap = S.TIERS[c.tier], id = esc(sp.id), name = esc(sp.brand);
    return `<tr data-sw-row="${id}"><th scope="row">${name}<small>${esc(sp.role || '')}${sp.hasOffer ? '' : ' · no published offer'}</small></th>
     <td><select data-sw-id="${id}" data-sw-field="tier" aria-label="Tier for ${name}">${S.TIER_IDS.map(t => `<option value="${t}" ${t === c.tier ? 'selected' : ''}>${esc(S.TIERS[t].name + ' · ' + PACKAGE[t])} (${S.TIERS[t].cols}×${S.TIERS[t].rows}, ${S.TIERS[t].photos} photo${S.TIERS[t].photos > 1 ? 's' : ''})</option>`).join('')}</select></td>
     <td><select data-sw-id="${id}" data-sw-field="cols" aria-label="Columns for ${name}">${opt(cap.cols, c.cols)}</select></td>
     <td><select data-sw-id="${id}" data-sw-field="rows" aria-label="Rows for ${name}">${opt(cap.rows, c.rows)}</select></td>
     <td data-sw-template="${id}">${templateFor(c.cols, c.rows)}</td>
     <td><input type="checkbox" data-sw-id="${id}" data-sw-field="featured" aria-label="Featured: ${name}" ${c.featured ? 'checked' : ''} ${sp.hasOffer ? '' : 'disabled'}></td>
     <td><input type="number" min="0" max="99" step="1" data-sw-id="${id}" data-sw-field="order" aria-label="Order for ${name}" value="${c.order}"></td>
     <td>${st.draft.items[sp.id] ? `<button type="button" class="button secondary" data-sw-default="${id}">Default</button>` : ''}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

// Attach the tab's controls inside `root`. `redraw` re-renders the tab after a change; `api` is the portal API.
function bind(root, st, { api, redraw }) {
  const S = window.VCSponsorWallSchema;
  if (!st.eventId) return; // only the 'Create an event first' note is drawn; there is nothing to wire
  root.querySelector('#swEvent')?.addEventListener('change', async e => {
    const fresh = await load(api, st.events, e.target.value);
    Object.assign(st, fresh, { status: '' });
    redraw();
  });
  root.querySelectorAll('input[name="swFormat"]').forEach(input => input.addEventListener('change', () => {
    st.draft.format = input.value;
    root.querySelectorAll('.sw-format').forEach(l => l.classList.toggle('is-selected', l.querySelector('input').value === st.draft.format));
    root.querySelector('.sw-selected strong').textContent = label(st.draft.format);
    root.querySelector('.sw-cut-only').hidden = st.draft.format !== 'cutouts';
  }));
  root.querySelectorAll('input[name="swCards"]').forEach(input => input.addEventListener('change', () => { st.draft.cards = input.value; }));
  root.querySelector('#swOpenSlots').addEventListener('change', e => { st.draft.openSlots = e.target.checked; });
  const range = (id, key, outId) => root.querySelector('#' + id).addEventListener('input', e => {
    st.draft[key] = Number(e.target.value);
    root.querySelector('#' + outId).textContent = String(st.draft[key]);
  });
  range('swCutGap', 'cutGap', 'swCutGapOut');
  range('swCutPad', 'cutPad', 'swCutPadOut');
  // Sponsor rows: a change writes the sponsor's settings into the draft; a new tier shrinks the size to fit its cap.
  root.querySelectorAll('[data-sw-id]').forEach(el => el.addEventListener('change', () => {
    const sp = (st.sponsors || []).find(x => x.id === el.dataset.swId); if (!sp) return;
    const c = { ...current(st, sp) }, f = el.dataset.swField;
    if (f === 'featured') c.featured = el.checked;
    else if (f === 'tier') c.tier = el.value;
    else { const n = Math.round(Number(el.value)); if (!Number.isFinite(n)) return; c[f] = f === 'order' ? Math.min(99, Math.max(0, n)) : n; }
    const cap = S.TIERS[c.tier]; c.cols = Math.min(Math.max(c.cols, 1), cap.cols); c.rows = Math.min(Math.max(c.rows, 1), cap.rows);
    st.draft.items[sp.id] = c; st.status = 'Changed. Save draft to keep it, then preview it on /temp with draft.'; redraw();
  }));
  root.querySelectorAll('[data-sw-default]').forEach(b => b.addEventListener('click', () => { delete st.draft.items[b.dataset.swDefault]; st.status = 'Back to the placement default. Save draft to keep it.'; redraw(); }));
  root.querySelector('#swDefaults').onclick = () => { st.draft = S.validate(undefined); st.status = 'Defaults loaded. Save or publish to keep them.'; redraw(); };
  const saveWith = action => save(root, st, { api, redraw, action });
  root.querySelector('#swSave').onclick = () => saveWith('draft');
  root.querySelector('#swPublish').onclick = () => saveWith('publish');
}

async function save(root, st, { api, redraw, action }) {
  const S = window.VCSponsorWallSchema;
  let checked;
  try { checked = S.validate(st.draft); } catch (e) { st.status = e.message; redraw(); return; }
  root.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try {
    const next = await api('/sponsor-wall', 'POST', { event_id: st.eventId, version: st.version, action, draft: checked });
    st.version = next.version;
    st.draft = S.validate(next.draft);
    st.status = action === 'publish' ? 'Published. Reload the site to see the change.' : 'Draft saved. The public site is unchanged.';
  } catch (e) {
    st.status = e.message;
  }
  redraw();
}

return { load, html, bind, FORMAT_OPTIONS };
})();
