import assert from 'node:assert/strict';
import {
  BIKES,
  buildBrmDeepLink,
  computeBikePrice,
  computeReturnInfo,
  computeVatBreakdown,
  getAvailableExtrasForBike,
  getDefaultPedalForBike,
  getMatchingSizesForHeight,
  getPickupSlots,
} from './data.js';

const byId = (id) => {
  const b = BIKES.find((x) => x.id === id);
  assert.ok(b, `Missing bike ${id}`);
  return b;
};

// 1. Verify exact BRM multi-day prices across all 8 bikes
const expectedPrices = {
  '5474683819393024': { h4: 60, d1: 70, d2: 110, d3: 140, d4: 175, d5: 210, d6: 245, d7: 280 }, // Ridley Fenix SL Disc
  '5225922316206080': { h4: 75, d1: 85, d2: 150, d3: 195, d4: 245, d5: 290, d6: 330, d7: 370 }, // Eddy Merckx Mendrisio 105
  '5659947097391104': { h4: 60, d1: 70, d2: 110, d3: 140, d5: 210, d7: 280 },                 // Canyon Endurace 6
  '5515992322015232': { h4: 60, d1: 70, d2: 110, d3: 140, d5: 210, d7: 280 },                 // Ridley Kanzo Gravel
  '6274019981524992': { h4: 20, d1: 35, d2: 50, d3: 65, d5: 95, d7: 125 },                    // Parisian City Bike
  '4706998982541312': { h4: 25, d1: 50, d2: 70, d3: 85, d5: 115, d7: 145 },                   // Yuba Kombi Longtail
  '5936229393629184': { h4: 20, d1: 35, d2: 50, d3: 65, d5: 95, d7: 125 },                    // Children's 24"
  '6733408932724736': { h4: 20, d1: 35, d2: 50, d3: 65, d5: 95, d7: 125 },                    // Children's 20"
};

for (const [id, exp] of Object.entries(expectedPrices)) {
  const bike = byId(id);
  assert.equal(computeBikePrice(bike, '4h'), exp.h4, `${bike.name} 4h`);
  assert.equal(computeBikePrice(bike, '1d'), exp.d1, `${bike.name} 1d`);
  assert.equal(computeBikePrice(bike, '2d'), exp.d2, `${bike.name} 2d`);
  assert.equal(computeBikePrice(bike, '3d'), exp.d3, `${bike.name} 3d`);
  if (exp.d4 != null) assert.equal(computeBikePrice(bike, 'custom', 4), exp.d4, `${bike.name} 4d`);
  assert.equal(computeBikePrice(bike, '5d'), exp.d5, `${bike.name} 5d`);
  if (exp.d6 != null) assert.equal(computeBikePrice(bike, 'custom', 6), exp.d6, `${bike.name} 6d`);
  assert.equal(computeBikePrice(bike, '7d'), exp.d7, `${bike.name} 7d`);
}

// 2. Verify height-to-size matching (numeric cm & preset bucket)
const fenix = byId('5474683819393024');
const merckx = byId('5225922316206080');
const canyon = byId('5659947097391104');
const kanzo = byId('5515992322015232');

assert.deepEqual(getMatchingSizesForHeight(fenix, 175).map((s) => s.code), ['S']);
assert.deepEqual(getMatchingSizesForHeight(merckx, 175).map((s) => s.code), ['S']);
assert.deepEqual(getMatchingSizesForHeight(canyon, 175), []);
assert.deepEqual(getMatchingSizesForHeight(kanzo, 's'), []); // Gravel only stocks XS, M, L, XL
assert.deepEqual(getMatchingSizesForHeight(canyon, 193).map((s) => s.code), ['XL']);

// 3. Verify pedal defaults (no pre-checked €5 LOOK KEO!) & category-scoped extras
const city = byId('6274019981524992');
const kids24 = byId('5936229393629184');
const longtail = byId('4706998982541312');

assert.equal(getDefaultPedalForBike(fenix).id, 'flat');
assert.equal(getDefaultPedalForBike(fenix).price, 0);
assert.equal(getDefaultPedalForBike(city).id, 'flat');

assert.deepEqual(
  getAvailableExtrasForBike(fenix).map((e) => e.id).sort(),
  ['garmin_mount', 'phone_mount']
);
assert.deepEqual(
  getAvailableExtrasForBike(city).map((e) => e.id).sort(),
  ['baby_seat', 'phone_mount']
);
assert.deepEqual(
  getAvailableExtrasForBike(longtail).map((e) => e.id),
  ['phone_mount']
);
assert.deepEqual(getAvailableExtrasForBike(kids24), []);

// 4. Verify 20% inclusive VAT math
assert.deepEqual(computeVatBreakdown(70), { gross: 70, net: 58.33, vat: 11.67 });
assert.deepEqual(computeVatBreakdown(85), { gross: 85, net: 70.83, vat: 14.17 });

// 5. Verify Paris opening hours & return calculation
const wedSlots = getPickupSlots('2026-11-25'); // Wednesday
assert.equal(wedSlots[0], '08:00');
assert.equal(wedSlots[wedSlots.length - 1], '16:00');
assert.equal(wedSlots.length, 17);

const satSlots = getPickupSlots('2026-11-28'); // Saturday
assert.equal(satSlots[0], '08:00');
assert.equal(satSlots[satSlots.length - 1], '17:30');
assert.equal(satSlots.length, 20);

assert.deepEqual(computeReturnInfo('2026-11-25', '09:00', '4h'), { dateStr: '2026-11-25', timeStr: '13:00' });
assert.deepEqual(computeReturnInfo('2026-11-25', '09:00', '2d'), { dateStr: '2026-11-27', timeStr: '09:00' });

// 6. Verify BRM handoff URL
assert.equal(
  buildBrmDeepLink('1694542871923', 'fr'),
  'https://app.booking.bike.rent/book?store=lepelotoncafe&offering=rental&category=1694542871923&lang=fr'
);

console.log('All Le Peloton rental demo checks passed (8 bikes, pricing, VAT, fit, extras, hours, deep-links).');
