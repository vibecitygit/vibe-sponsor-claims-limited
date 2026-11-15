/* Sponsor wall settings: one definition shared by the public wall (assets/sponsor-wall/sponsor-wall.js),
   the portal editor (portal/sponsor-wall.js) and the Worker that validates and stores them (worker/sponsor-wall.js).
   Tier caps, the 3-column grid and the placement-based tier defaults live only here. */
(function (root) {
'use strict';

// format: 'legacy' keeps today's offer browser on the Offers view; it is the default and the rollback switch.
const FORMATS = ['legacy', 'featured', 'cascade', 'vouchers', 'cutouts'];
const CARD_STOCKS = ['dark', 'white'];
const GRID_COLUMNS = 3;
// Tier caps: the largest piece a sponsor may take (columns x rows of the 3-column grid) and photos shown.
const TIERS = Object.freeze({
  t1: Object.freeze({ id: 't1', name: 'Tier 1', cols: 3, rows: 4, photos: 5, defaultCols: 2, defaultRows: 2 }),
  t2: Object.freeze({ id: 't2', name: 'Tier 2', cols: 2, rows: 3, photos: 3, defaultCols: 2, defaultRows: 1 }),
  t3: Object.freeze({ id: 't3', name: 'Tier 3', cols: 1, rows: 2, photos: 1, defaultCols: 1, defaultRows: 1 }),
});
const TIER_IDS = Object.freeze(Object.keys(TIERS));
// Placement limits from the sponsor placements: partners ≤3, featured ≤5, minor ≤10.
const PLACEMENT_LIMITS = Object.freeze({ partner: 3, featured: 5, minor: 10 });
const MAX_ITEMS = PLACEMENT_LIMITS.partner + PLACEMENT_LIMITS.featured + PLACEMENT_LIMITS.minor;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const DEFAULTS = Object.freeze({ format: 'legacy', cards: 'dark', openSlots: true, cutGap: 28, cutPad: 72, items: Object.freeze({}) });

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = (msg) => { throw new Error(msg); };

function integer(v, min, max, label) {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) fail(`${label} must be a whole number from ${min} to ${max}.`);
  return v;
}

// Default tier for a sponsor from its placement group: partners and the ₱5,000 featured tier → Tier 1,
// the ₱3,000 featured tier → Tier 2, minor sponsors → Tier 3. Unknown groups fall to the smallest tier.
function defaultTierFor(group, price) {
  if (group === 'partner') return 't1';
  if (group === 'featured') return price === 5000 ? 't1' : price === 3000 ? 't2' : 't3';
  return 't3';
}

// The piece a sponsor gets before the editor changes it: the tier's default size, and a sensible order.
function defaultItem(group, price, order) {
  const tier = TIERS[defaultTierFor(group, price)];
  return { tier: tier.id, cols: tier.defaultCols, rows: tier.defaultRows, featured: group === 'partner' || (group === 'featured' && price === 5000), order };
}

function validateItem(id, raw) {
  if (!ID_PATTERN.test(id)) fail('Sponsor ids must be 1 to 64 letters, digits, dashes or underscores.');
  if (!isObj(raw)) fail(`Sponsor ${id} needs settings.`);
  if (!TIER_IDS.includes(raw.tier)) fail(`Sponsor ${id}: choose a tier (${TIER_IDS.join(', ')}).`);
  const tier = TIERS[raw.tier];
  const cols = integer(raw.cols, 1, tier.cols, `Sponsor ${id}: columns for ${tier.name}`);
  const rows = integer(raw.rows, 1, tier.rows, `Sponsor ${id}: rows for ${tier.name}`);
  if (typeof raw.featured !== 'boolean') fail(`Sponsor ${id}: featured must be on or off.`);
  const order = raw.order === undefined ? 0 : integer(raw.order, 0, 99, `Sponsor ${id}: order`);
  return { tier: tier.id, cols, rows, featured: raw.featured, order };
}

// Strict check. Missing top-level keys take defaults so older drafts stay valid; unknown keys are dropped.
function validate(input) {
  if (input === undefined || input === null) input = {};
  if (!isObj(input)) fail('Sponsor wall settings are missing.');
  const out = { format: DEFAULTS.format, cards: DEFAULTS.cards, openSlots: DEFAULTS.openSlots, cutGap: DEFAULTS.cutGap, cutPad: DEFAULTS.cutPad, items: {} };
  if (input.format !== undefined) { if (!FORMATS.includes(input.format)) fail(`Choose a wall format: ${FORMATS.join(', ')}.`); out.format = input.format; }
  if (input.cards !== undefined) { if (!CARD_STOCKS.includes(input.cards)) fail('Card stock must be dark or white.'); out.cards = input.cards; }
  if (input.openSlots !== undefined) { if (typeof input.openSlots !== 'boolean') fail('Open slots must be on or off.'); out.openSlots = input.openSlots; }
  if (input.cutGap !== undefined) out.cutGap = integer(input.cutGap, 0, 64, 'Space between pieces');
  if (input.cutPad !== undefined) out.cutPad = integer(input.cutPad, 0, 200, 'Edge padding');
  if (input.items !== undefined) {
    if (!isObj(input.items)) fail('Sponsor settings must be a list keyed by sponsor id.');
    const ids = Object.keys(input.items);
    if (ids.length > MAX_ITEMS) fail(`The wall can hold at most ${MAX_ITEMS} sponsors.`);
    for (const id of ids) out.items[id] = validateItem(id, input.items[id]);
  }
  return out;
}

// Pixel size of one grid cell for a given container width (the same 3-column rule on every screen width).
function cellWidth(containerWidth, gap) {
  return (containerWidth - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
}

root.VCSponsorWallSchema = Object.freeze({
  FORMATS, CARD_STOCKS, GRID_COLUMNS, TIERS, TIER_IDS, PLACEMENT_LIMITS, MAX_ITEMS, DEFAULTS,
  defaultTierFor, defaultItem, validate, cellWidth,
  version: 'sponsor-wall-1',
});
})(typeof globalThis !== 'undefined' ? globalThis : this);
