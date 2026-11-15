import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const file = new URL('../assets/sponsor-wall-schema.js', import.meta.url);
const sandbox = {};
vm.runInNewContext(readFileSync(file, 'utf8'), sandbox, { filename: 'sponsor-wall-schema.js' });
const S = sandbox.VCSponsorWallSchema;
// Objects made inside the vm context have another realm's prototypes, so compare plain JSON copies.
const plain = (v) => JSON.parse(JSON.stringify(v));

test('tier caps match the approved sizes and photo limits', () => {
  assert.deepEqual([S.TIERS.tier1.cols, S.TIERS.tier1.rows, S.TIERS.tier1.photos], [3, 4, 5]);
  assert.deepEqual([S.TIERS.tier2.cols, S.TIERS.tier2.rows, S.TIERS.tier2.photos], [2, 3, 3]);
  assert.deepEqual([S.TIERS.tier3.cols, S.TIERS.tier3.rows, S.TIERS.tier3.photos], [1, 2, 1]);
});

test('placement limits give a 18-sponsor maximum', () => {
  assert.equal(S.PLACEMENT_LIMITS.partner, 3);
  assert.equal(S.PLACEMENT_LIMITS.featured, 5);
  assert.equal(S.PLACEMENT_LIMITS.minor, 10);
  assert.equal(S.MAX_ITEMS, 18);
});

test('default tier follows the placement group and price', () => {
  assert.equal(S.defaultTierFor('partner'), 'tier1');
  assert.equal(S.defaultTierFor('featured', 5000), 'tier1');
  assert.equal(S.defaultTierFor('featured', 3000), 'tier2');
  assert.equal(S.defaultTierFor('minor'), 'tier3');
  assert.equal(S.defaultTierFor('unknown'), 'tier3');
});

test('defaults are the legacy format, dark cards, open slots, and the prototype spacing', () => {
  const d = S.validate(undefined);
  assert.equal(d.format, 'legacy');
  assert.equal(d.cards, 'dark');
  assert.equal(d.openSlots, true);
  assert.equal(d.cutGap, 28);
  assert.equal(d.cutPad, 72);
  assert.deepEqual(plain(d.items), {});
});

test('a default item is inside its tier', () => {
  const it = S.defaultItem('partner', undefined, 0);
  assert.equal(it.tier, 'tier1');
  assert.ok(it.cols <= S.TIERS.tier1.cols && it.rows <= S.TIERS.tier1.rows);
  assert.equal(it.featured, true);
  const minor = S.defaultItem('minor', undefined, 4);
  assert.deepEqual([minor.tier, minor.cols, minor.rows, minor.featured, minor.order], ['tier3', 1, 1, false, 4]);
});

test('an accepted set of settings round-trips unchanged', () => {
  const input = {
    format: 'cutouts', cards: 'white', openSlots: false, cutGap: 64, cutPad: 200,
    items: { 'sp-1': { tier: 'tier1', cols: 3, rows: 4, featured: true, order: 0 }, 'sp-2': { tier: 'tier3', cols: 1, rows: 2, featured: false, order: 9 } },
  };
  assert.deepEqual(plain(S.validate(input)), input);
});

test('rejects a format that is not offered', () => {
  assert.throws(() => S.validate({ format: 'ledger' }), /Choose a wall format/);
});

test('rejects a size above the tier cap', () => {
  assert.throws(() => S.validate({ items: { a: { tier: 'tier3', cols: 2, rows: 1, featured: false } } }), /columns for Tier 3/);
  assert.throws(() => S.validate({ items: { a: { tier: 'tier2', cols: 2, rows: 4, featured: false } } }), /rows for Tier 2/);
});

test('rejects an unknown tier and a non-boolean featured flag', () => {
  assert.throws(() => S.validate({ items: { a: { tier: 'partner', cols: 1, rows: 1, featured: false } } }), /choose a tier/);
  assert.throws(() => S.validate({ items: { a: { tier: 'tier1', cols: 1, rows: 1, featured: 'yes' } } }), /featured must be on or off/);
});

test('rejects out-of-range spacing and non-integers', () => {
  assert.throws(() => S.validate({ cutGap: 65 }), /Space between pieces/);
  assert.throws(() => S.validate({ cutPad: -1 }), /Edge padding/);
  assert.throws(() => S.validate({ cutGap: 2.5 }), /whole number/);
  assert.throws(() => S.validate({ cutGap: '28' }), /whole number/);
});

test('rejects more sponsors than the placement limits allow', () => {
  const items = {};
  for (let i = 0; i < 19; i++) items['s' + i] = { tier: 'tier3', cols: 1, rows: 1, featured: false };
  assert.throws(() => S.validate({ items }), /at most 18/);
});

test('rejects unsafe sponsor ids', () => {
  assert.throws(() => S.validate({ items: { '<script>': { tier: 'tier3', cols: 1, rows: 1, featured: false } } }), /Sponsor ids/);
  assert.throws(() => S.validate({ items: { ['x'.repeat(65)]: { tier: 'tier3', cols: 1, rows: 1, featured: false } } }), /Sponsor ids/);
});

test('unknown keys are dropped rather than stored', () => {
  const out = S.validate({ format: 'featured', evil: '<b>', items: {} });
  assert.equal('evil' in out, false);
});

test('grid has three columns at any width', () => {
  assert.equal(S.GRID_COLUMNS, 3);
  assert.equal(S.cellWidth(300, 0), 100);
  assert.equal(S.cellWidth(300, 10), (300 - 20) / 3);
});
