/* Portal → Offer wall: choose which offer wall the tickets site shows on the Offers view, plus the wall's
   global display settings. Save a private draft, then publish; the public site reads the published settings from
   /public-sponsor-wall. Per-sponsor tier and size controls are added in a later part of this screen.
   Access: the Worker decides who may save (owner, admin, and members assigned as wall editors). This screen only
   shows the nav item to people the portal already lets in; the Worker is the real check. */
window.VCSponsorWallPortal = { async view({ api, esc, main }) {
const S = window.VCSponsorWallSchema;
// Labels shown to editors. The keys are the schema's FORMATS; the order here is the order on screen.
const FORMAT_OPTIONS = [
  { key: 'legacy', label: 'Current offer browser', hint: 'Today’s Offers view, unchanged. The safe default, and the rollback choice.' },
  { key: 'featured', label: 'Featured + Cascade', hint: 'One featured sponsor panel above a cascading wall of offers.' },
  { key: 'cascade', label: 'Cascade', hint: 'A cascading wall of offers, with no featured panel.' },
  { key: 'vouchers', label: 'Voucher wall', hint: 'Offers printed as stubs, vouchers, tickets and magazine cut-outs on a 3-column grid.' },
  { key: 'cutouts', label: 'Cut-out wall', hint: 'Snip-off pieces that drop onto the wall as visitors scroll. Uses extra display fonts.' },
];
const saved = await api('/sponsor-wall');
let draft = S.validate(saved.draft);
let version = saved.version;
let status = '';

const pretty = v => String(v);
function formatCard(opt) {
  const checked = draft.format === opt.key ? 'checked' : '';
  return `<label class="sw-format ${checked ? 'is-selected' : ''}"><input type="radio" name="swFormat" value="${esc(opt.key)}" ${checked}><span class="sw-format-text"><strong>${esc(opt.label)}</strong><small>${esc(opt.hint)}</small></span></label>`;
}

function draw() {
  main.innerHTML = `<div class="page-heading"><div><span class="eyebrow">CONTENT & DESIGN</span><h1>Offer wall</h1><p>Choose the offer wall the tickets site shows on the Offers view. Save a private draft, then publish when ready.</p></div></div>
 <div class="sw-layout">
  <section class="panel"><div class="panel-body">
   <fieldset class="sw-formats" id="swFormats"><legend>Offer wall format</legend>${FORMAT_OPTIONS.map(formatCard).join('')}</fieldset>
   <h2>Wall settings</h2>
   <label class="sw-bool"><input type="radio" name="swCards" value="dark" ${draft.cards === 'dark' ? 'checked' : ''}> Dark cards</label>
   <label class="sw-bool"><input type="radio" name="swCards" value="white" ${draft.cards === 'white' ? 'checked' : ''}> White cards</label>
   <label class="sw-bool"><input type="checkbox" id="swOpenSlots" ${draft.openSlots ? 'checked' : ''}> Show open slots on the wall</label>
   <div class="sw-cut-only" ${draft.format === 'cutouts' ? '' : 'hidden'}>
    <h2>Cut-out spacing</h2>
    <label class="field sw-range" for="swCutGap"><span>Space between pieces <output id="swCutGapOut">${pretty(draft.cutGap)}</output></span><input id="swCutGap" type="range" min="0" max="64" step="2" value="${draft.cutGap}"></label>
    <label class="field sw-range" for="swCutPad"><span>Edge padding <output id="swCutPadOut">${pretty(draft.cutPad)}</output></span><input id="swCutPad" type="range" min="0" max="200" step="4" value="${draft.cutPad}"></label>
   </div>
   <p class="notice">Every format keeps the same three-column grid on phones and desktops. Sponsor sizes and tiers are set in the sponsor list.</p>
  </div></section>
  <aside class="panel sw-preview-panel" aria-label="Preview"><div class="panel-body">
   <h2>Selected</h2>
   <p id="swSelected"><strong>${esc((FORMAT_OPTIONS.find(o => o.key === draft.format) || FORMAT_OPTIONS[0]).label)}</strong></p>
   <p class="pe-hint">The preview of each format is shown in the tickets site preview. Saving a draft does not change the public site.</p>
  </div></aside>
 </div>
 <p id="swStatus" role="status">${esc(status)}</p>
 <div class="dialog-actions"><button class="button secondary" id="swDefaults" type="button">Reset to defaults</button><button class="button secondary" id="swSave" type="button">Save draft</button><button class="button primary" id="swPublish" type="button">Publish to site ↗</button></div>`;

  main.querySelectorAll('input[name="swFormat"]').forEach(input => input.addEventListener('change', () => {
    draft.format = input.value;
    main.querySelector('#swSelected').innerHTML = `<strong>${esc((FORMAT_OPTIONS.find(o => o.key === draft.format) || FORMAT_OPTIONS[0]).label)}</strong>`;
    main.querySelectorAll('.sw-format').forEach(l => l.classList.toggle('is-selected', l.querySelector('input').value === draft.format));
    main.querySelector('.sw-cut-only').hidden = draft.format !== 'cutouts';
  }));
  main.querySelectorAll('input[name="swCards"]').forEach(input => input.addEventListener('change', () => { draft.cards = input.value; }));
  main.querySelector('#swOpenSlots').addEventListener('change', e => { draft.openSlots = e.target.checked; });
  const bindRange = (id, key, outId) => main.querySelector('#' + id)?.addEventListener('input', e => {
    draft[key] = Number(e.target.value);
    main.querySelector('#' + outId).textContent = pretty(draft[key]);
  });
  bindRange('swCutGap', 'cutGap', 'swCutGapOut');
  bindRange('swCutPad', 'cutPad', 'swCutPadOut');
  main.querySelector('#swDefaults').onclick = () => { draft = S.validate(undefined); status = 'Defaults loaded. Save or publish to keep them.'; draw(); };
  main.querySelector('#swSave').onclick = () => save('draft');
  main.querySelector('#swPublish').onclick = () => save('publish');
}

async function save(action) {
  const out = main.querySelector('#swStatus');
  let checked;
  try { checked = S.validate(draft); } catch (e) { out.textContent = e.message; return; }
  main.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try {
    const next = await api('/sponsor-wall', 'POST', { version, action, draft: checked });
    version = next.version;
    draft = S.validate(next.draft);
    status = action === 'publish' ? 'Published. Reload the site to see the change.' : 'Draft saved. The public site is unchanged.';
    draw();
  } catch (e) {
    main.querySelectorAll('button').forEach(b => { b.disabled = false; });
    out.textContent = e.message;
  }
}

draw();
} };
