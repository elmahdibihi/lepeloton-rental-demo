import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BIKES,
  CAFE_MENU,
  STORY_CHAPTERS,
  STUDIO_SPACE,
  TOURS,
  buildBrmDeepLink,
  computeBikePrice,
  computeReturnInfo,
  computeTourPrice,
  computeVatBreakdown,
  getAvailableExtrasForBike,
  getDefaultPedalForBike,
  getMatchingSizesForHeight,
  getPickupSlots,
} from './data.js';
import { getTodayParis } from './db.js';
import { verifyStripeWebhook } from './stripe.js';
import { createPelotonApp } from './server.js';

const byId = (id) => {
  const b = BIKES.find((x) => x.id === id);
  assert.ok(b, `Missing bike ${id}`);
  return b;
};

const expectedPrices = {
  '5474683819393024': { h4: 60, d1: 70, d2: 110, d3: 140, d4: 175, d5: 210, d6: 245, d7: 280 },
  '5225922316206080': { h4: 75, d1: 85, d2: 150, d3: 195, d4: 245, d5: 290, d6: 330, d7: 370 },
  '5659947097391104': { h4: 60, d1: 70, d2: 110, d3: 140, d5: 210, d7: 280 },
  '5515992322015232': { h4: 60, d1: 70, d2: 110, d3: 140, d5: 210, d7: 280 },
  '6274019981524992': { h4: 20, d1: 35, d2: 50, d3: 65, d5: 95, d7: 125 },
  '4706998982541312': { h4: 25, d1: 50, d2: 70, d3: 85, d5: 115, d7: 145 },
  '5936229393629184': { h4: 20, d1: 35, d2: 50, d3: 65, d5: 95, d7: 125 },
  '6733408932724736': { h4: 20, d1: 35, d2: 50, d3: 65, d5: 95, d7: 125 },
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

const fenix = byId('5474683819393024');
const merckx = byId('5225922316206080');
const canyon = byId('5659947097391104');
const kanzo = byId('5515992322015232');
const city = byId('6274019981524992');
const kids24 = byId('5936229393629184');
const longtail = byId('4706998982541312');

assert.deepEqual(getMatchingSizesForHeight(fenix, 175).map((s) => s.code), ['S']);
assert.deepEqual(getMatchingSizesForHeight(merckx, 175).map((s) => s.code), ['S']);
assert.deepEqual(getMatchingSizesForHeight(canyon, 175), []);
assert.deepEqual(getMatchingSizesForHeight(kanzo, 's'), []);
assert.deepEqual(getMatchingSizesForHeight(canyon, 193).map((s) => s.code), ['XL']);

assert.equal(getDefaultPedalForBike(fenix).id, 'flat');
assert.equal(getDefaultPedalForBike(city).id, 'flat');
assert.deepEqual(getAvailableExtrasForBike(fenix).map((e) => e.id).sort(), ['garmin_mount', 'phone_mount']);
assert.deepEqual(getAvailableExtrasForBike(city).map((e) => e.id).sort(), ['baby_seat', 'phone_mount']);
assert.deepEqual(getAvailableExtrasForBike(longtail).map((e) => e.id), ['phone_mount']);
assert.deepEqual(getAvailableExtrasForBike(kids24), []);

assert.deepEqual(computeVatBreakdown(70), { gross: 70, net: 58.33, vat: 11.67 });
assert.deepEqual(computeVatBreakdown(85), { gross: 85, net: 70.83, vat: 14.17 });

assert.equal(getPickupSlots('2026-11-25').length, 17);
assert.equal(getPickupSlots('2026-11-28').length, 20);
assert.deepEqual(computeReturnInfo('2026-11-25', '09:00', '4h'), { dateStr: '2026-11-25', timeStr: '13:00' });
assert.deepEqual(computeReturnInfo('2026-11-25', '09:00', '2d'), { dateStr: '2026-11-27', timeStr: '09:00' });

assert.equal(STORY_CHAPTERS.length, 4);
assert.equal(TOURS.length, 4);
assert.equal(computeTourPrice(TOURS.find((t) => t.id === 'hidden_paris'), 2, 1), 135);
assert.equal(computeTourPrice(TOURS.find((t) => t.id === 'versailles'), 2, 1), 329);
assert.equal(computeTourPrice(TOURS.find((t) => t.id === 'private_group'), 6, 0), 350);
assert.equal(computeTourPrice(TOURS.find((t) => t.id === 'private_group'), 10, 0), 440);
assert.ok(CAFE_MENU.drinks.length >= 10 && CAFE_MENU.food.length >= 6);
assert.equal(STUDIO_SPACE.area, '80 m²');
assert.equal(
  buildBrmDeepLink('1694542871923', 'fr'),
  'https://app.booking.bike.rent/book?store=lepelotoncafe&offering=rental&category=1694542871923&lang=fr'
);

const futureDate = (() => {
  const [y, m, d] = getTodayParis().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 4));
  return dt.toISOString().slice(0, 10);
})();

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'peloton-test-'));

async function withServer(opts, fn) {
  const app = createPelotonApp(opts);
  await new Promise((res) => app.server.listen(0, '127.0.0.1', res));
  const { port } = app.server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn({ baseUrl, app });
  } finally {
    await new Promise((res) => app.server.close(res));
    app.db.close();
  }
}

await withServer(
  {
    dbPath: path.join(tmpDir, 'direct.db'),
    organizerKey: 'test-org-secret-1234',
    leaderKey: 'test-leader-secret-5678',
    env: {},
  },
  async ({ baseUrl }) => {
    const bootRes = await fetch(`${baseUrl}/api/bootstrap?pickupDate=${futureDate}&tourDate=${futureDate}`);
    assert.equal(bootRes.status, 200);
    const boot = await bootRes.json();
    assert.equal(boot.mode, 'live');
    assert.equal(boot.stripeEnabled, false);
    assert.equal(boot.fleetStock['5659947097391104'].XL, 1);
    assert.equal(boot.club.leaders, undefined, 'Public bootstrap must not expose leader roster');
    assert.equal(boot.club.rides[0]?.leaders, undefined, 'Public rides must not expose leader names');

    const secCheck = await fetch(`${baseUrl}/server.js`);
    assert.equal(secCheck.status, 404);

    const adminRedirect = await fetch(`${baseUrl}/admin.html`, { redirect: 'manual' });
    assert.equal(adminRedirect.status, 302);
    assert.equal(adminRedirect.headers.get('location'), '/admin');

    const unauthAdmin = await fetch(`${baseUrl}/api/admin/overview`);
    assert.equal(unauthAdmin.status, 401);

    const coRes = await fetch(`${baseUrl}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com', phone: '+33600000000' },
        pickupDate: futureDate,
        pickupTime: '09:00',
        durationKey: '1d',
        bikes: [
          {
            bikeId: '5659947097391104',
            sizeCode: 'XL',
            pedalId: 'spd_sl',
            extraIds: ['garmin_mount'],
            riderName: 'Jean',
          },
        ],
        tours: [
          {
            tourId: 'hidden_paris',
            tourDate: futureDate,
            tourTime: '10:00',
            adults: 2,
            kids: 0,
          },
        ],
      }),
    });
    assert.equal(coRes.status, 201);
    const co = await coRes.json();
    assert.equal(co.mode, 'direct');
    assert.equal(co.booking.status, 'confirmed');
    assert.equal(co.booking.total_cents, (70 + 5 + 5 + 90) * 100);

    const overbookRes = await fetch(`${baseUrl}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { firstName: 'Marc', lastName: 'Martin', email: 'marc@example.com' },
        pickupDate: futureDate,
        pickupTime: '10:00',
        durationKey: '4h',
        bikes: [{ bikeId: '5659947097391104', sizeCode: 'XL', pedalId: 'flat', extraIds: [] }],
      }),
    });
    assert.equal(overbookRes.status, 409);

    const holdRes = await fetch(`${baseUrl}/api/admin/workshop-hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-organizer-key': 'test-org-secret-1234' },
      body: JSON.stringify({ bikeId: '5474683819393024', sizeCode: 'XXS', heldCount: 1, reason: 'Bleed brakes' }),
    });
    assert.equal(holdRes.status, 200);

    const availAfterHold = await (await fetch(`${baseUrl}/api/availability?pickupDate=${futureDate}`)).json();
    assert.equal(availAfterHold.fleetStock['5474683819393024'].XXS, 0);

    const unauthLeader = await fetch(`${baseUrl}/api/leaders/meta`);
    assert.equal(unauthLeader.status, 401);

    const randomLeaderReject = await fetch(`${baseUrl}/api/leaders/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-leader-key': 'test-leader-secret-5678' },
      body: JSON.stringify({ name: 'RandomTourist', date: futureDate, pace: 'Medium' }),
    });
    assert.equal(randomLeaderReject.status, 403);

    const clubSignup = await fetch(`${baseUrl}/api/leaders/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-leader-key': 'test-leader-secret-5678' },
      body: JSON.stringify({ name: 'Tess', date: futureDate, pace: 'Medium' }),
    });
    assert.equal(clubSignup.status, 200);
    const clubData = await clubSignup.json();
    assert.ok(clubData.rides.find((r) => r.pace === 'Medium').leaders.includes('Tess'));

    const myRidesRes = await (
      await fetch(`${baseUrl}/api/leaders/my-rides?name=Tess`, {
        headers: { 'x-leader-key': 'test-leader-secret-5678' },
      })
    ).json();
    assert.ok(myRidesRes.rides.some((r) => r.ride_date === futureDate && r.pace === 'Medium'));

    const clubWithdraw = await fetch(`${baseUrl}/api/leaders/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-leader-key': 'test-leader-secret-5678' },
      body: JSON.stringify({ name: 'Tess', date: futureDate, pace: 'Medium' }),
    });
    assert.equal(clubWithdraw.status, 200);

    const csvRes = await fetch(`${baseUrl}/api/admin/club/export.csv`, {
      headers: { 'x-organizer-key': 'test-org-secret-1234' },
    });
    assert.equal(csvRes.status, 200);
    assert.ok((await csvRes.text()).startsWith('Date,Pace,Title,Start Time,Status,Leaders'));

    const studioRes = await fetch(`${baseUrl}/api/studio/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Zwift Paris Pop-up',
        email: 'events@zwift.com',
        eventDate: futureDate,
        guests: 60,
        notes: 'Evening launch event',
      }),
    });
    assert.equal(studioRes.status, 201);

    const adminOv = await (
      await fetch(`${baseUrl}/api/admin/overview`, { headers: { 'x-organizer-key': 'test-org-secret-1234' } })
    ).json();
    assert.equal(adminOv.bookings.length, 1);
    assert.equal(adminOv.studioInquiries.length, 1);
    assert.equal(adminOv.finance.confirmedGrossCents, (70 + 5 + 5 + 90) * 100);
    assert.equal(adminOv.finance.rentalsGrossCents, 80 * 100);
    assert.equal(adminOv.finance.toursGrossCents, 90 * 100);
    assert.ok(adminOv.events.length >= 2);

    const fulfillRes = await (
      await fetch(`${baseUrl}/api/admin/bookings/${adminOv.bookings[0].id}/fulfillment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-organizer-key': 'test-org-secret-1234' },
        body: JSON.stringify({ fulfillment_status: 'picked_up' }),
      })
    ).json();
    assert.equal(fulfillRes.overview.finance.bikesOutNow, 1);

    const finCsv = await fetch(`${baseUrl}/api/admin/finance/export.csv`, {
      headers: { 'x-organizer-key': 'test-org-secret-1234' },
    });
    assert.equal(finCsv.status, 200);
    assert.ok((await finCsv.text()).startsWith('Ref,Created,Customer,Email,Status,Fulfillment'));

    const evCreate = await fetch(`${baseUrl}/api/admin/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-organizer-key': 'test-org-secret-1234' },
      body: JSON.stringify({
        event_date: futureDate,
        start_time: '18:30',
        title: 'Oatly Latte Art Throwdown',
        location: 'Studio l’Échappée',
        visibility: 'public',
        expected_guests: 70,
      }),
    });
    assert.equal(evCreate.status, 201);
  }
);

const webhookSecret = 'whsec_test_secret_999';
await withServer(
  {
    dbPath: path.join(tmpDir, 'stripe.db'),
    organizerKey: 'stripe-org-secret',
    env: {
      STRIPE_SECRET_KEY: 'sk_test_mocked_key',
      STRIPE_WEBHOOK_SECRET: webhookSecret,
      PUBLIC_URL: 'https://lepelotoncafe.cc',
    },
    fetchImpl: async (url) => {
      if (String(url).includes('/v1/checkout/sessions')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'cs_test_12345', url: 'https://checkout.stripe.com/c/pay/cs_test_12345' }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    },
  },
  async ({ baseUrl }) => {
    const coRes = await fetch(`${baseUrl}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { firstName: 'Sophie', lastName: 'Laurent', email: 'sophie@example.com' },
        pickupDate: futureDate,
        pickupTime: '09:30',
        durationKey: '4h',
        bikes: [{ bikeId: '5474683819393024', sizeCode: 'S', pedalId: 'flat', extraIds: [] }],
      }),
    });
    assert.equal(coRes.status, 201);
    const co = await coRes.json();
    assert.equal(co.mode, 'stripe');
    assert.equal(co.checkoutUrl, 'https://checkout.stripe.com/c/pay/cs_test_12345');

    const beforeWh = await (await fetch(`${baseUrl}/api/bookings/${co.refCode}`)).json();
    assert.equal(beforeWh.booking.status, 'pending_payment');

    const badWh = await fetch(`${baseUrl}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'stripe-signature': 't=123,v1=deadbeef' },
      body: '{}',
    });
    assert.equal(badWh.status, 400);

    const eventPayload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_12345',
          client_reference_id: co.refCode,
          metadata: { ref_code: co.refCode },
        },
      },
    });
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', webhookSecret).update(`${ts}.${eventPayload}`).digest('hex');
    const verifiedLocal = verifyStripeWebhook(Buffer.from(eventPayload), `t=${ts},v1=${sig}`, webhookSecret);
    assert.equal(verifiedLocal.type, 'checkout.session.completed');

    const goodWh = await fetch(`${baseUrl}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'stripe-signature': `t=${ts},v1=${sig}` },
      body: eventPayload,
    });
    assert.equal(goodWh.status, 200);

    const afterWh = await (await fetch(`${baseUrl}/api/bookings/${co.refCode}`)).json();
    assert.equal(afterWh.booking.status, 'confirmed');

    const cancelConfirmedAttempt = await (
      await fetch(`${baseUrl}/api/bookings/${co.refCode}/cancel-pending`, { method: 'POST' })
    ).json();
    assert.equal(cancelConfirmedAttempt.released, false);
  }
);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('All Le Peloton Café superapp unit + full-stack integration checks passed.');
