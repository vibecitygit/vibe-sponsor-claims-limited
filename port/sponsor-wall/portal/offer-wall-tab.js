/* Page designer → Offer wall tab: choose which offer wall the tickets site shows on the Offers view, plus the
   wall's display settings. The page designer (portal/page-effects.js) mounts this tab; it does not have its own
   nav item. Saving here saves the offer wall only. Publishing sends the draft to the site; the public site reads
   the published settings from /public-sponsor-wall. Per-sponsor tier and size controls come later in this tab.
   Access: the Worker decides who may save (owner, admin, and members assigned as wall editors). The tab is only
   shown to people the portal already lets into the page designer; the Worker is the real check. */
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
  return { events: list, eventId: chosen, draft: S.validate(saved.draft), version: saved.version, status: '' };
}

// The tab's markup. Pure string output, so the page designer can place it anywhere in its panel.
function html(esc, st) {
  const d = st.draft;
  if (!st.eventId) return `<section class="sw-tab" aria-labelledby="swTabTitle"><h2 id="swTabTitle">Offer wall</h2><p class="notice">${esc(st.status || 'Create an event first.')}</p></section>`;
  return `<section class="sw-tab" aria-labelledby="swTabTitle">
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
   <p class="notice">Every format keeps the same three-column grid on phones and desktops. Sponsor sizes and tiers are set in the sponsor list.</p>
   <p class="sw-selected">Selected: <strong>${esc(label(d.format))}</strong></p>
   <p id="swStatus" role="status">${esc(st.status || '')}</p>
   <div class="dialog-actions"><button class="button secondary" id="swDefaults" type="button">Reset to defaults</button><button class="button secondary" id="swSave" type="button">Save draft</button><button class="button primary" id="swPublish" type="button">Publish to site ↗</button></div>
  </section>`;
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
