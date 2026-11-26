import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  BIKES,
  CLUB_PACES,
  PEDAL_OPTIONS,
  STORE,
  TOURS,
  computeBikePrice,
  computeTourPrice,
  computeVatBreakdown,
  computeWindowMs,
  getAvailableExtrasForBike,
  getPickupSlots,
} from './data.js';
import {
  PACE_ORDER_SQL,
  PACES,
  ensureDraftDate,
  expireStalePendingBookings,
  getBookingByRef,
  getFleetStockSnapshot,
  getTodayParis,
  getTourAvailabilitySnapshot,
  getWorkshopHoldsMap,
  hydrateRide,
  nowIso,
  openDb,
  seedClubIfEmpty,
  withImmediateTx,
} from './db.js';
import {
  createStripeCheckoutSession,
  fetchStripeSession,
  isStripeConfigured,
  verifyStripeWebhook,
} from './stripe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch {}
}

const PUBLIC_FILES = new Map([
  ['/', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/index.html', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/styles.css', { file: 'styles.css', type: 'text/css; charset=utf-8' }],
  ['/data.js', { file: 'data.js', type: 'text/javascript; charset=utf-8' }],
  ['/app.js', { file: 'app.js', type: 'text/javascript; charset=utf-8' }],
  ['/admin.js', { file: 'admin.js', type: 'text/javascript; charset=utf-8' }],
  ['/leaders.js', { file: 'leaders.js', type: 'text/javascript; charset=utf-8' }],
  ['/seed-club.json', { file: 'seed-club.json', type: 'application/json; charset=utf-8' }],
]);

const IMG_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function isValidDateStr(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

function normalizeName(s, maxLen = 80) {
  return String(s || '').trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

function findLeaderIdx(leaders, name) {
  const lower = name.toLowerCase();
  return leaders.findIndex((l) => l.toLowerCase() === lower);
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return out;
}

function readRawBody(req, maxBytes = 262_144) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const buf = await readRawBody(req);
  if (buf.length === 0) return {};
  try {
    return JSON.parse(buf.toString('utf-8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON payload'), { statusCode: 400 });
  }
}

function sendJson(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function sendHtml(res, status, html, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    ...extraHeaders,
  });
  res.end(html);
}

function resolveOrCreateKeys(dataDir, envOrganizerKey, envLeaderKey) {
  fs.mkdirSync(dataDir, { recursive: true });
  const cfgPath = path.join(dataDir, 'config.json');
  let parsed = {};
  if (fs.existsSync(cfgPath)) {
    try {
      parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    } catch {}
  }
  const organizerKey = String(envOrganizerKey || parsed.organizerKey || crypto.randomBytes(16).toString('hex'));
  const leaderKey = String(envLeaderKey || parsed.leaderKey || crypto.randomBytes(12).toString('hex'));
  if (parsed.organizerKey !== organizerKey || parsed.leaderKey !== leaderKey) {
    fs.writeFileSync(cfgPath, JSON.stringify({ organizerKey, leaderKey }, null, 2), { mode: 0o600 });
  }
  return { organizerKey, leaderKey };
}

function sanitizePublicRide(r) {
  return {
    ride_date: r.ride_date,
    pace: r.pace,
    title: r.title,
    start_time: r.start_time,
    status: r.status,
    effective_status: r.effective_status,
    route_name: r.route_name,
    route_url: r.route_url,
  };
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildAdminOverview(db, leaderKey) {
  expireStalePendingBookings(db);
  const today = getTodayParis();

  const bookings = db
    .prepare('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 80')
    .all()
    .map((b) => ({
      ...b,
      bikes: db
        .prepare('SELECT * FROM booking_bikes WHERE booking_id = ? ORDER BY id ASC')
        .all(b.id)
        .map((x) => ({ ...x, extras: JSON.parse(x.extras_json || '[]') })),
      tours: db.prepare('SELECT * FROM booking_tours WHERE booking_id = ? ORDER BY id ASC').all(b.id),
    }));

  const holdsMap = getWorkshopHoldsMap(db);
  const nowMs = Date.now();
  const liveStock = getFleetStockSnapshot(db, nowMs, nowMs + 4 * 3600_000);

  const fleet = BIKES.map((bike) => ({
    id: bike.id,
    name: bike.name,
    category: bike.category,
    sizes: bike.sizes.map((sz) => {
      const hold = holdsMap.get(`${bike.id}::${sz.code}`);
      return {
        code: sz.code,
        totalStock: sz.stock,
        heldCount: hold?.held_count || 0,
        reason: hold?.reason || '',
        availableNow: liveStock[bike.id][sz.code],
      };
    }),
  }));

  const rides = db.prepare(`SELECT * FROM rides ORDER BY ride_date ASC, ${PACE_ORDER_SQL}`).all().map(hydrateRide);
  const leaders = db
    .prepare('SELECT name FROM leaders WHERE active = 1 ORDER BY name COLLATE NOCASE ASC')
    .all()
    .map((r) => r.name);
  const planningNotes = db.prepare('SELECT content, updated_at FROM planning_notes WHERE id = 1').get() || {
    content: '',
    updated_at: '',
  };

  const upcomingRides = rides.filter((r) => r.ride_date >= today && r.effective_status !== 'cancelled');
  const workloadMap = new Map(leaders.map((l) => [l, { name: l, upcoming: 0, past: 0, total: 0 }]));
  for (const r of rides) {
    if (r.effective_status === 'cancelled') continue;
    for (const l of r.leaders) {
      if (!workloadMap.has(l)) workloadMap.set(l, { name: l, upcoming: 0, past: 0, total: 0 });
      const entry = workloadMap.get(l);
      entry.total += 1;
      if (r.ride_date >= today) entry.upcoming += 1;
      else entry.past += 1;
    }
  }

  const studioInquiries = db.prepare('SELECT * FROM studio_inquiries ORDER BY id DESC LIMIT 40').all();
  const recentActivity = db.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT 15').all();
  const events = db.prepare('SELECT * FROM events ORDER BY event_date ASC, start_time ASC').all();

  let confirmedGrossCents = 0;
  let confirmedVatCents = 0;
  let pendingGrossCents = 0;
  let rentalsGrossCents = 0;
  let rentalsCount = 0;
  let toursGrossCents = 0;
  let toursCount = 0;
  let confirmedCount = 0;
  let bikesOutNow = 0;
  let pickupsToday = 0;
  const revenueByItem = new Map();

  for (const b of bookings) {
    if (b.status === 'pending_payment') {
      pendingGrossCents += b.total_cents;
      continue;
    }
    if (b.status !== 'confirmed') continue;
    confirmedCount += 1;
    confirmedGrossCents += b.total_cents;
    confirmedVatCents += b.vat_cents;
    if (b.fulfillment_status === 'picked_up') {
      bikesOutNow += b.bikes.length;
    }
    for (const bk of b.bikes) {
      rentalsCount += 1;
      rentalsGrossCents += bk.price_cents;
      if (bk.pickup_date === today) pickupsToday += 1;
      const bikeObj = BIKES.find((x) => x.id === bk.bike_id);
      const key = `Bike: ${bikeObj?.name || bk.bike_id}`;
      const cur = revenueByItem.get(key) || { name: key, count: 0, grossCents: 0 };
      cur.count += 1;
      cur.grossCents += bk.price_cents;
      revenueByItem.set(key, cur);
    }
    for (const tr of b.tours) {
      toursCount += 1;
      toursGrossCents += tr.price_cents;
      const tourObj = TOURS.find((x) => x.id === tr.tour_id);
      const key = `Tour: ${tourObj?.name.en || tr.tour_id}`;
      const cur = revenueByItem.get(key) || { name: key, count: 0, grossCents: 0 };
      cur.count += tr.adults + tr.kids;
      cur.grossCents += tr.price_cents;
      revenueByItem.set(key, cur);
    }
  }

  return {
    today,
    leaderPortalPath: `/leaders?key=${encodeURIComponent(leaderKey)}`,
    bookings,
    fleet,
    finance: {
      confirmedCount,
      confirmedGrossCents,
      confirmedNetCents: confirmedGrossCents - confirmedVatCents,
      confirmedVatCents,
      pendingGrossCents,
      rentalsGrossCents,
      rentalsCount,
      toursGrossCents,
      toursCount,
      avgOrderCents: confirmedCount ? Math.round(confirmedGrossCents / confirmedCount) : 0,
      bikesOutNow,
      pickupsToday,
      byItem: [...revenueByItem.values()].sort((a, b) => b.grossCents - a.grossCents),
    },
    events,
    club: {
      upcomingRides: upcomingRides.slice(0, 24),
      needsLeaderCount: upcomingRides.filter((r) => r.leaders.length === 0).length,
      leaders,
      workload: [...workloadMap.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
      planningNotes,
      recentActivity,
    },
    studioInquiries,
  };
}

function renderKeyGateHtml({ title, subtitle, action, label, buttonText }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Le Peloton Café — ${title}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="admin-gate-body">
  <main class="admin-gate-card">
    <p class="clubhouse-eyebrow">17 Rue du Pont Louis-Philippe</p>
    <h1>${title}</h1>
    <p class="admin-gate-sub">${subtitle}</p>
    <form method="GET" action="${action}" class="guest-form">
      <div class="guest-field">
        <label for="keyInput">${label}</label>
        <input id="keyInput" type="password" name="key" class="text-input" required autofocus placeholder="••••••••••••">
      </div>
      <button type="submit" class="btn-yellow">${buttonText}</button>
      <a href="/" class="btn-ghost" style="text-align:center">Back to storefront</a>
    </form>
  </main>
</body>
</html>`;
}

// shortcut: single-process node:sqlite WAL lock, move to Postgres when scaling beyond one VPS
export function createPelotonApp(options = {}) {
  const env = options.env || process.env;
  const dbPath = options.dbPath || path.join(__dirname, 'data', 'peloton.db');
  const dataDir = path.dirname(dbPath);
  // shortcut: shared keys for café staff and vetted ride leaders, upgrade to per-user SSO when team > 30
  const { organizerKey, leaderKey } = resolveOrCreateKeys(
    dataDir,
    options.organizerKey ?? env.ORGANIZER_KEY,
    options.leaderKey ?? env.LEADER_KEY
  );
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  const db = openDb(dbPath);
  seedClubIfEmpty(db, options.seedPath);

  function resolveSafeBaseUrl(req) {
    if (env.PUBLIC_URL) return String(env.PUBLIC_URL).replace(/\/$/, '');
    const rawHost = String(req.headers.host || '');
    const safeHost = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(rawHost) ? rawHost : 'localhost:3000';
    return `http://${safeHost}`;
  }

  function safeKeyEq(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  function isAuthorized(req, urlObj) {
    const candidate =
      urlObj.searchParams.get('key') || req.headers['x-organizer-key'] || parseCookies(req).peloton_org_key || '';
    return safeKeyEq(candidate, organizerKey);
  }

  function isLeaderAuthorized(req, urlObj) {
    if (isAuthorized(req, urlObj)) return true;
    const candidate =
      urlObj.searchParams.get('key') || req.headers['x-leader-key'] || parseCookies(req).peloton_leader_key || '';
    return safeKeyEq(candidate, leaderKey);
  }

  function fireSheetsWebhook(payload) {
    const hookUrl = String(env.GOOGLE_SHEETS_WEBHOOK_URL || '').trim();
    if (!hookUrl || !/^https?:\/\//.test(hookUrl)) return;
    fetchImpl(hookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;

    try {
      if (req.method === 'GET' && pathname === '/api/health') {
        return sendJson(res, 200, {
          ok: true,
          today: getTodayParis(),
          stripeEnabled: isStripeConfigured(env),
        });
      }

      if (req.method === 'GET' && pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET' && PUBLIC_FILES.has(pathname)) {
        const entry = PUBLIC_FILES.get(pathname);
        const abs = path.join(__dirname, entry.file);
        const content = fs.readFileSync(abs);
        res.writeHead(200, {
          'Content-Type': entry.type,
          'Cache-Control': pathname.endsWith('.json') ? 'public, max-age=60' : 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(content);
        return;
      }

      if (req.method === 'GET' && pathname.startsWith('/assets/img/')) {
        const base = path.basename(pathname);
        const ext = path.extname(base).toLowerCase();
        const abs = path.join(__dirname, 'assets', 'img', base);
        if (!IMG_TYPES[ext] || !fs.existsSync(abs)) {
          return sendJson(res, 404, { error: 'Asset not found' });
        }
        res.writeHead(200, {
          'Content-Type': IMG_TYPES[ext],
          'Cache-Control': 'public, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
        });
        fs.createReadStream(abs).pipe(res);
        return;
      }

      if (req.method === 'GET' && pathname === '/admin.html') {
        res.writeHead(302, { Location: `/admin${urlObj.search || ''}` });
        res.end();
        return;
      }

      if (req.method === 'GET' && pathname === '/leaders.html') {
        res.writeHead(302, { Location: `/leaders${urlObj.search || ''}` });
        res.end();
        return;
      }

      if (req.method === 'GET' && pathname === '/admin') {
        if (!isAuthorized(req, urlObj)) {
          return sendHtml(
            res,
            401,
            renderKeyGateHtml({
              title: 'Staff & Workshop Ops',
              subtitle:
                'Enter the organizer key to access morning bike prep, workshop stock holds, Cycling Club piloting, and l’Échappée inquiries.',
              action: '/admin',
              label: 'Organizer key',
              buttonText: 'Unlock operations board',
            })
          );
        }
        const html = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf-8');
        const hasQueryKey = Boolean(urlObj.searchParams.get('key'));
        const secureAttr = String(env.PUBLIC_URL || '').startsWith('https://') ? '; Secure' : '';
        const extra = hasQueryKey
          ? {
              'Set-Cookie': `peloton_org_key=${encodeURIComponent(organizerKey)}; Path=/; HttpOnly; SameSite=Lax${secureAttr}`,
            }
          : {};
        return sendHtml(res, 200, html, extra);
      }

      if (req.method === 'GET' && pathname === '/leaders') {
        if (!isLeaderAuthorized(req, urlObj)) {
          return sendHtml(
            res,
            401,
            renderKeyGateHtml({
              title: 'Ride Leaders Portal',
              subtitle:
                'Private sign-up board for selected Le Peloton Cycling Club ride leaders. Open your private WhatsApp link or enter the leader key.',
              action: '/leaders',
              label: 'Ride leader key',
              buttonText: 'Open leader schedule',
            })
          );
        }
        const html = fs.readFileSync(path.join(__dirname, 'leaders.html'), 'utf-8');
        const hasQueryKey = Boolean(urlObj.searchParams.get('key'));
        const secureAttr = String(env.PUBLIC_URL || '').startsWith('https://') ? '; Secure' : '';
        const extra = hasQueryKey
          ? {
              'Set-Cookie': `peloton_leader_key=${encodeURIComponent(leaderKey)}; Path=/; HttpOnly; SameSite=Lax${secureAttr}`,
            }
          : {};
        return sendHtml(res, 200, html, extra);
      }

      if (req.method === 'GET' && pathname === '/api/bootstrap') {
        const today = getTodayParis();
        const pickupDate = isValidDateStr(urlObj.searchParams.get('pickupDate'))
          ? urlObj.searchParams.get('pickupDate')
          : today;
        const pickupTime = urlObj.searchParams.get('pickupTime') || '09:00';
        const durationKey = urlObj.searchParams.get('durationKey') || '1d';
        const customDays = Number(urlObj.searchParams.get('customDays') || 4);
        const tourDate = isValidDateStr(urlObj.searchParams.get('tourDate'))
          ? urlObj.searchParams.get('tourDate')
          : pickupDate;

        const { startMs, endMs } = computeWindowMs(pickupDate, pickupTime, durationKey, customDays);
        const fleetStock = getFleetStockSnapshot(db, startMs, endMs);
        const tourSpots = getTourAvailabilitySnapshot(db, tourDate);

        const upcomingDates = db
          .prepare(
            `SELECT DISTINCT ride_date, title FROM rides WHERE ride_date >= ? AND status != 'cancelled' ORDER BY ride_date ASC LIMIT 12`
          )
          .all(today);
        const defaultClubDate =
          isValidDateStr(urlObj.searchParams.get('clubDate')) && urlObj.searchParams.get('clubDate') >= today
            ? urlObj.searchParams.get('clubDate')
            : upcomingDates[0]?.ride_date || today;

        const clubRides = ensureDraftDate(db, defaultClubDate, 'storefront').map(sanitizePublicRide);

        return sendJson(res, 200, {
          mode: 'live',
          today,
          stripeEnabled: isStripeConfigured(env),
          fleetStock,
          tourSpots,
          club: {
            date: defaultClubDate,
            upcomingDates,
            rides: clubRides,
          },
        });
      }

      if (req.method === 'GET' && pathname === '/api/availability') {
        const pickupDate = urlObj.searchParams.get('pickupDate') || getTodayParis();
        const pickupTime = urlObj.searchParams.get('pickupTime') || '09:00';
        const durationKey = urlObj.searchParams.get('durationKey') || '1d';
        const customDays = Number(urlObj.searchParams.get('customDays') || 4);
        const tourDate = urlObj.searchParams.get('tourDate') || pickupDate;
        const { startMs, endMs } = computeWindowMs(pickupDate, pickupTime, durationKey, customDays);
        return sendJson(res, 200, {
          fleetStock: getFleetStockSnapshot(db, startMs, endMs),
          tourSpots: getTourAvailabilitySnapshot(db, tourDate),
        });
      }

      if (req.method === 'POST' && pathname === '/api/checkout') {
        const body = await readJsonBody(req);
        const firstName = normalizeName(body.customer?.firstName, 50);
        const lastName = normalizeName(body.customer?.lastName, 50);
        const customerName = normalizeName(`${firstName} ${lastName}`, 90);
        const customerEmail = String(body.customer?.email || '').trim().toLowerCase();
        const customerPhone = normalizeName(body.customer?.phone, 40);

        if (!firstName || !lastName || !isValidEmail(customerEmail)) {
          return sendJson(res, 400, { error: 'Valid name and email are required.' });
        }

        const rawBikes = Array.isArray(body.bikes) ? body.bikes : [];
        const rawTours = Array.isArray(body.tours) ? body.tours : [];
        if (rawBikes.length === 0 && rawTours.length === 0) {
          return sendJson(res, 400, { error: 'Bag cannot be empty.' });
        }
        if (rawBikes.length + rawTours.length > 20) {
          return sendJson(res, 400, { error: 'Maximum 20 items per booking.' });
        }

        const today = getTodayParis();
        const preparedBikes = [];
        const preparedTours = [];
        const stripeLines = [];
        let totalEuros = 0;

        for (const item of rawBikes) {
          const bike = BIKES.find((b) => b.id === item.bikeId);
          if (!bike) return sendJson(res, 400, { error: 'Unknown bike model.' });
          const sz = bike.sizes.find((s) => s.code === item.sizeCode);
          if (!sz) return sendJson(res, 400, { error: `Invalid size for ${bike.name}.` });

          const pickupDate = String(item.pickupDate || body.pickupDate || '');
          const pickupTime = String(item.pickupTime || body.pickupTime || '');
          const durationKey = String(item.durationKey || body.durationKey || '1d');
          const customDays = Math.max(1, Math.min(30, Math.round(Number(item.customDays ?? body.customDays ?? 1))));

          if (!isValidDateStr(pickupDate) || pickupDate < today) {
            return sendJson(res, 400, { error: 'Pickup date must be today or in the future.' });
          }
          if (!getPickupSlots(pickupDate).includes(pickupTime)) {
            return sendJson(res, 400, { error: `Invalid pickup slot ${pickupTime} for ${pickupDate}.` });
          }

          const pedalObj =
            bike.category === 'city'
              ? PEDAL_OPTIONS.find((p) => p.id === 'flat')
              : PEDAL_OPTIONS.find((p) => p.id === item.pedalId) || PEDAL_OPTIONS[0];

          const availExtras = getAvailableExtrasForBike(bike);
          const validExtras = Array.isArray(item.extraIds)
            ? [...new Set(item.extraIds)].filter((eid) => availExtras.some((x) => x.id === eid))
            : [];

          const extrasSum = validExtras.reduce((sum, eid) => {
            const ex = availExtras.find((x) => x.id === eid);
            return sum + (ex ? ex.price : 0);
          }, 0);

          const unitEuros = computeBikePrice(bike, durationKey, customDays) + pedalObj.price + extrasSum;
          const priceCents = Math.round(unitEuros * 100);
          totalEuros += unitEuros;

          const win = computeWindowMs(pickupDate, pickupTime, durationKey, customDays);
          preparedBikes.push({
            bike,
            sizeCode: sz.code,
            pedalId: pedalObj.id,
            extras: validExtras,
            childAgeNote: normalizeName(item.childAgeNote, 40),
            riderName: normalizeName(item.riderName, 40),
            pickupDate,
            pickupTime,
            returnDate: win.dateStr,
            returnTime: win.timeStr,
            durationKey,
            customDays,
            startMs: win.startMs,
            endMs: win.endMs,
            priceCents,
          });

          stripeLines.push({
            name: `${bike.name} (${sz.code})`,
            description: `Pickup ${pickupDate} ${pickupTime} -> ${win.dateStr} ${win.timeStr} · ${pedalObj.label.en}`,
            amountCents: priceCents,
          });
        }

        for (const tItem of rawTours) {
          const tour = TOURS.find((x) => x.id === tItem.tourId);
          if (!tour) return sendJson(res, 400, { error: 'Unknown guided tour.' });
          const tourDate = String(tItem.tourDate || '');
          const tourTime = String(tItem.tourTime || '');
          if (!isValidDateStr(tourDate) || tourDate < today || !tour.slots.includes(tourTime)) {
            return sendJson(res, 400, { error: `Invalid date or departure time for ${tour.name.en}.` });
          }

          const adults = Math.max(0, Math.min(16, Math.round(Number(tItem.adults) || 0)));
          const kids = Math.max(0, Math.min(16, Math.round(Number(tItem.kids) || 0)));
          if (adults + kids <= 0 || adults + kids > tour.capacity) {
            return sendJson(res, 400, { error: `Invalid guest count for ${tour.name.en}.` });
          }

          const tourEuros = computeTourPrice(tour, adults, kids);
          const priceCents = Math.round(tourEuros * 100);
          totalEuros += tourEuros;

          preparedTours.push({
            tour,
            tourDate,
            tourTime,
            adults,
            kids,
            priceCents,
          });

          stripeLines.push({
            name: tour.name.en,
            description: `${tourDate} at ${tourTime} · ${adults + kids} rider(s)`,
            amountCents: priceCents,
          });
        }

        const vatBreakdown = computeVatBreakdown(totalEuros, STORE.vatRate);
        const totalCents = Math.round(vatBreakdown.gross * 100);
        const vatCents = Math.round(vatBreakdown.vat * 100);
        const useStripe = isStripeConfigured(env);
        const initialStatus = useStripe ? 'pending_payment' : 'confirmed';
        const refCode = `LPC-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const ts = nowIso();

        let bookingId;
        try {
          bookingId = withImmediateTx(db, () => {
            expireStalePendingBookings(db);
            const holds = getWorkshopHoldsMap(db);

            for (const pb of preparedBikes) {
              const szObj = pb.bike.sizes.find((s) => s.code === pb.sizeCode);
              const held = holds.get(`${pb.bike.id}::${pb.sizeCode}`)?.held_count || 0;
              const overlapBooked = db
                .prepare(`
                  SELECT COUNT(*) AS c
                  FROM booking_bikes bb
                  JOIN bookings b ON b.id = bb.booking_id
                  WHERE b.status IN ('confirmed', 'pending_payment')
                    AND bb.bike_id = ?
                    AND bb.size_code = ?
                    AND bb.start_ms < ?
                    AND bb.end_ms > ?
                `)
                .get(pb.bike.id, pb.sizeCode, pb.endMs, pb.startMs).c;

              const sameReqCount = preparedBikes.filter(
                (x) =>
                  x.bike.id === pb.bike.id &&
                  x.sizeCode === pb.sizeCode &&
                  x.startMs < pb.endMs &&
                  x.endMs > pb.startMs
              ).length;

              if (overlapBooked + held + sameReqCount > szObj.stock) {
                throw Object.assign(
                  new Error(`${pb.bike.name} (${pb.sizeCode}) is no longer available for that pickup window.`),
                  { statusCode: 409 }
                );
              }
            }

            for (const pt of preparedTours) {
              const existing = db
                .prepare(`
                  SELECT COUNT(*) AS cnt, COALESCE(SUM(bt.adults + bt.kids), 0) AS riders
                  FROM booking_tours bt
                  JOIN bookings b ON b.id = bt.booking_id
                  WHERE b.status IN ('confirmed', 'pending_payment')
                    AND bt.tour_id = ?
                    AND bt.tour_date = ?
                    AND bt.tour_time = ?
                `)
                .get(pt.tour.id, pt.tourDate, pt.tourTime);

              const sameSlotTours = preparedTours.filter(
                (x) => x.tour.id === pt.tour.id && x.tourDate === pt.tourDate && x.tourTime === pt.tourTime
              );
              const reqRiders = sameSlotTours.reduce((s, x) => s + x.adults + x.kids, 0);

              if (pt.tour.pricingType === 'private_group') {
                if (existing.cnt > 0 || sameSlotTours.length > 1) {
                  throw Object.assign(
                    new Error(`${pt.tour.name.en} on ${pt.tourDate} at ${pt.tourTime} is already booked.`),
                    { statusCode: 409 }
                  );
                }
              } else if (Number(existing.riders) + reqRiders > pt.tour.capacity) {
                throw Object.assign(
                  new Error(`Not enough spots left on ${pt.tour.name.en} (${pt.tourDate} ${pt.tourTime}).`),
                  { statusCode: 409 }
                );
              }
            }

            const insBooking = db
              .prepare(`
                INSERT INTO bookings (
                  ref_code, status, customer_name, customer_email, customer_phone,
                  total_cents, vat_cents, stripe_session_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?)
              `)
              .run(refCode, initialStatus, customerName, customerEmail, customerPhone, totalCents, vatCents, ts, ts);

            const newId = Number(insBooking.lastInsertRowid);

            const insBike = db.prepare(`
              INSERT INTO booking_bikes (
                booking_id, bike_id, size_code, pedal_id, extras_json, child_age_note, rider_name,
                pickup_date, pickup_time, return_date, return_time, duration_key, custom_days,
                start_ms, end_ms, price_cents
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const pb of preparedBikes) {
              insBike.run(
                newId,
                pb.bike.id,
                pb.sizeCode,
                pb.pedalId,
                JSON.stringify(pb.extras),
                pb.childAgeNote,
                pb.riderName,
                pb.pickupDate,
                pb.pickupTime,
                pb.returnDate,
                pb.returnTime,
                pb.durationKey,
                pb.customDays,
                pb.startMs,
                pb.endMs,
                pb.priceCents
              );
            }

            const insTour = db.prepare(`
              INSERT INTO booking_tours (booking_id, tour_id, tour_date, tour_time, adults, kids, price_cents)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            for (const pt of preparedTours) {
              insTour.run(newId, pt.tour.id, pt.tourDate, pt.tourTime, pt.adults, pt.kids, pt.priceCents);
            }

            return newId;
          });
        } catch (err) {
          if (err.statusCode === 409) {
            return sendJson(res, 409, { error: err.message });
          }
          throw err;
        }

        if (useStripe) {
          const baseUrl = resolveSafeBaseUrl(req);
          try {
            const session = await createStripeCheckoutSession({
              secretKey: env.STRIPE_SECRET_KEY,
              refCode,
              bookingId,
              customerEmail,
              lineItems: stripeLines,
              successUrl: `${baseUrl}/?booking_ref=${encodeURIComponent(refCode)}&session_id={CHECKOUT_SESSION_ID}`,
              cancelUrl: `${baseUrl}/?booking_cancelled=${encodeURIComponent(refCode)}`,
              fetchImpl,
            });
            db.prepare('UPDATE bookings SET stripe_session_id = ?, updated_at = ? WHERE id = ?').run(
              session.id,
              nowIso(),
              bookingId
            );
            return sendJson(res, 201, {
              mode: 'stripe',
              refCode,
              checkoutUrl: session.url,
            });
          } catch (stripeErr) {
            db.prepare("UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ?").run(nowIso(), bookingId);
            return sendJson(res, 502, { error: stripeErr.message || 'Unable to start Stripe Checkout.' });
          }
        }

        return sendJson(res, 201, {
          mode: 'direct',
          booking: getBookingByRef(db, refCode),
        });
      }

      const bookingRefMatch = pathname.match(/^\/api\/bookings\/([A-Z0-9-]+)$/);
      if (req.method === 'GET' && bookingRefMatch) {
        const refCode = bookingRefMatch[1];
        let booking = getBookingByRef(db, refCode);
        if (!booking) return sendJson(res, 404, { error: 'Booking not found.' });

        const sessionId = urlObj.searchParams.get('session_id') || booking.stripe_session_id;
        if (booking.status === 'pending_payment' && sessionId && isStripeConfigured(env)) {
          const session = await fetchStripeSession(env.STRIPE_SECRET_KEY, sessionId, fetchImpl);
          if (session && session.payment_status === 'paid') {
            db.prepare("UPDATE bookings SET status = 'confirmed', updated_at = ? WHERE id = ?").run(
              nowIso(),
              booking.id
            );
            booking = getBookingByRef(db, refCode);
          }
        }
        return sendJson(res, 200, { booking });
      }

      const cancelPendingMatch = pathname.match(/^\/api\/bookings\/([A-Z0-9-]+)\/cancel-pending$/);
      if (req.method === 'POST' && cancelPendingMatch) {
        const refCode = cancelPendingMatch[1];
        const info = db
          .prepare("UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE ref_code = ? AND status = 'pending_payment'")
          .run(nowIso(), refCode);
        return sendJson(res, 200, { ok: true, released: info.changes > 0 });
      }

      if (req.method === 'POST' && pathname === '/api/stripe/webhook') {
        const rawBody = await readRawBody(req);
        const sig = req.headers['stripe-signature'];
        let event;
        try {
          event = verifyStripeWebhook(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
          return sendJson(res, 400, { error: err.message });
        }

        const obj = event?.data?.object || {};
        const refCode = obj.metadata?.ref_code || obj.client_reference_id || '';
        if (refCode) {
          if (event.type === 'checkout.session.completed') {
            db.prepare(
              "UPDATE bookings SET status = 'confirmed', stripe_session_id = COALESCE(NULLIF(?, ''), stripe_session_id), updated_at = ? WHERE ref_code = ? AND status != 'cancelled'"
            ).run(String(obj.id || ''), nowIso(), refCode);
          } else if (event.type === 'checkout.session.expired') {
            db.prepare(
              "UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE ref_code = ? AND status = 'pending_payment'"
            ).run(nowIso(), refCode);
          }
        }
        return sendJson(res, 200, { received: true });
      }

      if (req.method === 'GET' && pathname === '/api/club/rides') {
        const date = urlObj.searchParams.get('date') || '';
        const today = getTodayParis();
        if (!isValidDateStr(date) || date < today) {
          return sendJson(res, 400, { error: 'Choose today or a future date (YYYY-MM-DD).' });
        }
        return sendJson(res, 200, {
          date,
          today,
          rides: ensureDraftDate(db, date, 'club-view').map(sanitizePublicRide),
        });
      }

      if (pathname.startsWith('/api/leaders/')) {
        if (!isLeaderAuthorized(req, urlObj)) {
          return sendJson(res, 401, { error: 'Unauthorized ride leader key.' });
        }

        if (req.method === 'GET' && pathname === '/api/leaders/meta') {
          const today = getTodayParis();
          const leaders = db
            .prepare('SELECT name FROM leaders WHERE active = 1 ORDER BY name COLLATE NOCASE ASC')
            .all()
            .map((r) => r.name);
          const upcomingDates = db
            .prepare(
              `SELECT DISTINCT ride_date, title FROM rides WHERE ride_date >= ? AND status != 'cancelled' ORDER BY ride_date ASC LIMIT 12`
            )
            .all(today);
          const defaultDate = upcomingDates[0]?.ride_date || today;
          const planningNotes = db.prepare('SELECT content, updated_at FROM planning_notes WHERE id = 1').get() || {
            content: '',
            updated_at: '',
          };
          const events = db
            .prepare("SELECT * FROM events WHERE event_date >= ? AND status != 'cancelled' ORDER BY event_date ASC LIMIT 8")
            .all(today);
          return sendJson(res, 200, {
            today,
            leaders,
            upcomingDates,
            date: defaultDate,
            rides: ensureDraftDate(db, defaultDate, 'leader-portal'),
            planningNotes,
            events,
          });
        }

        if (req.method === 'GET' && pathname === '/api/leaders/rides') {
          const date = urlObj.searchParams.get('date') || '';
          const today = getTodayParis();
          if (!isValidDateStr(date) || date < today) {
            return sendJson(res, 400, { error: 'Choose today or a future date (YYYY-MM-DD).' });
          }
          return sendJson(res, 200, { date, today, rides: ensureDraftDate(db, date, 'leader-portal') });
        }

        if (req.method === 'GET' && pathname === '/api/leaders/my-rides') {
          const name = normalizeName(urlObj.searchParams.get('name') || '', 48);
          if (!name) return sendJson(res, 200, { name: '', rides: [] });
          const today = getTodayParis();
          const rows = db
            .prepare(
              `SELECT * FROM rides WHERE ride_date >= ? AND status NOT IN ('cancelled', 'completed') ORDER BY ride_date ASC, ${PACE_ORDER_SQL}`
            )
            .all(today);
          const mine = [];
          for (const row of rows) {
            const r = hydrateRide(row);
            const idx = findLeaderIdx(r.leaders, name);
            if (idx !== -1) {
              mine.push({
                id: r.id,
                ride_date: r.ride_date,
                pace: r.pace,
                title: r.title,
                start_time: r.start_time,
                co_leaders: r.leaders.filter((_, i) => i !== idx),
              });
            }
          }
          return sendJson(res, 200, { name, rides: mine });
        }

        if (req.method === 'POST' && pathname === '/api/leaders/signup') {
          const body = await readJsonBody(req);
          const rawName = normalizeName(body.name, 48);
          const date = String(body.date || '').trim();
          const pace = String(body.pace || '').trim();
          const today = getTodayParis();

          if (!isValidDateStr(date) || date < today) return sendJson(res, 400, { error: 'Choose today or a future date.' });
          if (!PACES.includes(pace)) return sendJson(res, 400, { error: 'Pace must be Mild, Medium, or Spicy.' });

          const rosterRow = db
            .prepare('SELECT name FROM leaders WHERE active = 1 AND lower(name) = lower(?)')
            .get(rawName);
          if (!rosterRow) {
            return sendJson(res, 403, { error: 'Only selected ride leaders can sign up here. Ask Tess to add your name.' });
          }
          const name = rosterRow.name;
          const maxLeaders = CLUB_PACES.find((p) => p.pace === pace)?.maxLeaders || 4;
          let result;
          try {
            result = withImmediateTx(db, () => {
              ensureDraftDate(db, date, name);
              const row = db.prepare('SELECT * FROM rides WHERE ride_date = ? AND pace = ?').get(date, pace);
              const ride = hydrateRide(row);
              if (!ride || ride.effective_status === 'cancelled' || ride.effective_status === 'completed') {
                throw Object.assign(new Error('This ride group is closed.'), { statusCode: 403 });
              }
              const leaders = [...ride.leaders];
              if (findLeaderIdx(leaders, name) === -1) {
                if (leaders.length >= maxLeaders) {
                  throw Object.assign(new Error(`${pace} already has ${maxLeaders} ride leaders.`), { statusCode: 409 });
                }
                leaders.push(name);
                const ts = nowIso();
                db.prepare('UPDATE rides SET leaders = ?, updated_at = ? WHERE id = ?').run(
                  JSON.stringify(leaders),
                  ts,
                  ride.id
                );
                db.prepare(
                  'INSERT INTO activity_log (created_at, actor, action, ride_date, pace, details) VALUES (?, ?, ?, ?, ?, ?)'
                ).run(ts, name, 'signup', date, pace, `Signed up to lead ${pace} on ${date}`);
              }
              return {
                leaders,
                rides: db.prepare(`SELECT * FROM rides WHERE ride_date = ? ORDER BY ${PACE_ORDER_SQL}`).all(date).map(hydrateRide),
              };
            });
          } catch (err) {
            if (err.statusCode) return sendJson(res, err.statusCode, { error: err.message });
            throw err;
          }
          fireSheetsWebhook({ action: 'signup', name, date, pace, leaders: result.leaders, timestamp: nowIso() });
          return sendJson(res, 200, { ok: true, rides: result.rides });
        }

        if (req.method === 'POST' && pathname === '/api/leaders/withdraw') {
          const body = await readJsonBody(req);
          const name = normalizeName(body.name, 48);
          const date = String(body.date || '').trim();
          const pace = String(body.pace || '').trim();
          const today = getTodayParis();

          if (!name || !isValidDateStr(date) || date < today || !PACES.includes(pace)) {
            return sendJson(res, 400, { error: 'Valid name, future date, and pace required.' });
          }

          let nextLeaders;
          let rides;
          try {
            const out = withImmediateTx(db, () => {
              const row = db.prepare('SELECT * FROM rides WHERE ride_date = ? AND pace = ?').get(date, pace);
              const ride = hydrateRide(row);
              if (!ride) throw Object.assign(new Error('Ride not found.'), { statusCode: 404 });
              const idx = findLeaderIdx(ride.leaders, name);
              if (idx === -1) throw Object.assign(new Error(`${name} is not listed on ${pace}.`), { statusCode: 404 });
              const removedName = ride.leaders[idx];
              const updated = ride.leaders.filter((_, i) => i !== idx);
              const ts = nowIso();
              db.prepare('UPDATE rides SET leaders = ?, updated_at = ? WHERE id = ?').run(
                JSON.stringify(updated),
                ts,
                ride.id
              );
              db.prepare(
                'INSERT INTO activity_log (created_at, actor, action, ride_date, pace, details) VALUES (?, ?, ?, ?, ?, ?)'
              ).run(ts, removedName, 'withdraw', date, pace, `Withdrew from ${pace} on ${date}`);
              return {
                removedName,
                nextLeaders: updated,
                rides: db.prepare(`SELECT * FROM rides WHERE ride_date = ? ORDER BY ${PACE_ORDER_SQL}`).all(date).map(hydrateRide),
              };
            });
            nextLeaders = out.nextLeaders;
            rides = out.rides;
            fireSheetsWebhook({ action: 'withdraw', name: out.removedName, date, pace, leaders: nextLeaders, timestamp: nowIso() });
          } catch (err) {
            if (err.statusCode) return sendJson(res, err.statusCode, { error: err.message });
            throw err;
          }
          return sendJson(res, 200, { ok: true, rides });
        }
      }

      if (req.method === 'POST' && pathname === '/api/studio/inquiries') {
        const body = await readJsonBody(req);
        const name = normalizeName(body.name, 80);
        const email = String(body.email || '').trim().toLowerCase();
        const eventDate = isValidDateStr(body.eventDate) ? body.eventDate : '';
        const guests = Math.max(1, Math.min(200, Math.round(Number(body.guests) || 25)));
        const notes = normalizeName(body.notes, 600);

        if (name.length < 2 || !isValidEmail(email)) {
          return sendJson(res, 400, { error: 'Valid contact name and email required.' });
        }

        const ts = nowIso();
        const resIns = db
          .prepare(
            'INSERT INTO studio_inquiries (name, email, event_date, guests, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          .run(name, email, eventDate, guests, notes, 'new', ts);

        return sendJson(res, 201, { ok: true, id: Number(resIns.lastInsertRowid) });
      }

      if (pathname.startsWith('/api/admin/')) {
        if (!isAuthorized(req, urlObj)) {
          return sendJson(res, 401, { error: 'Unauthorized organizer key.' });
        }

        if (req.method === 'GET' && pathname === '/api/admin/overview') {
          return sendJson(res, 200, buildAdminOverview(db, leaderKey));
        }

        if (req.method === 'GET' && pathname === '/api/admin/club/export.csv') {
          const rows = db.prepare(`SELECT * FROM rides ORDER BY ride_date ASC, ${PACE_ORDER_SQL}`).all().map(hydrateRide);
          const header = ['Date', 'Pace', 'Title', 'Start Time', 'Status', 'Leaders', 'Route', 'Notes'];
          const lines = [
            header.join(','),
            ...rows.map((r) =>
              [
                r.ride_date,
                r.pace,
                r.title,
                r.start_time,
                r.effective_status,
                r.leaders.join(' / '),
                r.route_name,
                r.notes,
              ]
                .map(csvCell)
                .join(',')
            ),
          ];
          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="lepeloton-ride-leaders.csv"',
            'Cache-Control': 'no-store',
          });
          res.end(lines.join('\r\n'));
          return;
        }

        if (req.method === 'POST' && pathname === '/api/admin/leaders') {
          const body = await readJsonBody(req);
          const name = normalizeName(body.name, 48);
          if (name.length < 2) return sendJson(res, 400, { error: 'Leader name required.' });
          db.prepare('INSERT OR IGNORE INTO leaders (name, active) VALUES (?, 1)').run(name);
          db.prepare('UPDATE leaders SET active = 1 WHERE lower(name) = lower(?)').run(name);
          return sendJson(res, 201, { ok: true, overview: buildAdminOverview(db, leaderKey) });
        }

        if (req.method === 'POST' && pathname === '/api/admin/rides') {
          const body = await readJsonBody(req);
          const rideDate = String(body.ride_date || '').trim();
          const title = normalizeName(body.title || 'Club Ride', 80);
          if (!isValidDateStr(rideDate)) return sendJson(res, 400, { error: 'Valid YYYY-MM-DD date required.' });
          ensureDraftDate(db, rideDate, 'organizer');
          if (title && title !== 'Club Ride') {
            db.prepare('UPDATE rides SET title = ?, updated_at = ? WHERE ride_date = ?').run(title, nowIso(), rideDate);
          }
          return sendJson(res, 201, { ok: true, overview: buildAdminOverview(db, leaderKey) });
        }

        if (req.method === 'POST' && pathname === '/api/admin/workshop-hold') {
          const body = await readJsonBody(req);
          const bike = BIKES.find((b) => b.id === body.bikeId);
          const sz = bike?.sizes.find((s) => s.code === body.sizeCode);
          if (!bike || !sz) return sendJson(res, 400, { error: 'Invalid bike or frame size.' });

          const heldCount = Math.max(0, Math.min(sz.stock, Math.round(Number(body.heldCount) || 0)));
          const reason = normalizeName(body.reason, 100);
          db.prepare(`
            INSERT INTO workshop_holds (bike_id, size_code, held_count, reason, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(bike_id, size_code)
            DO UPDATE SET held_count = excluded.held_count, reason = excluded.reason, updated_at = excluded.updated_at
          `).run(bike.id, sz.code, heldCount, reason, nowIso());

          return sendJson(res, 200, { ok: true, overview: buildAdminOverview(db, leaderKey) });
        }

        const bookingStatusMatch = pathname.match(/^\/api\/admin\/bookings\/(\d+)\/status$/);
        if (req.method === 'POST' && bookingStatusMatch) {
          const id = Number(bookingStatusMatch[1]);
          const body = await readJsonBody(req);
          const status = String(body.status || '');
          if (!['confirmed', 'cancelled'].includes(status)) {
            return sendJson(res, 400, { error: 'Invalid status.' });
          }
          db.prepare('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?').run(status, nowIso(), id);
          return sendJson(res, 200, { ok: true, overview: buildAdminOverview(db, leaderKey) });
        }

        const bookingFulfillMatch = pathname.match(/^\/api\/admin\/bookings\/(\d+)\/fulfillment$/);
        if (req.method === 'POST' && bookingFulfillMatch) {
          const id = Number(bookingFulfillMatch[1]);
          const body = await readJsonBody(req);
          const fulfillment = String(body.fulfillment_status || '');
          if (!['scheduled', 'picked_up', 'returned'].includes(fulfillment)) {
            return sendJson(res, 400, { error: 'Invalid fulfillment status.' });
          }
          db.prepare('UPDATE bookings SET fulfillment_status = ?, updated_at = ? WHERE id = ?').run(
            fulfillment,
            nowIso(),
            id
          );
          return sendJson(res, 200, { ok: true, overview: buildAdminOverview(db, leaderKey) });
        }

        if (req.method === 'GET' && pathname === '/api/admin/finance/export.csv') {
          const ov = buildAdminOverview(db, leaderKey);
          const header = [
            'Ref',
            'Created',
            'Customer',
            'Email',
            'Status',
            'Fulfillment',
            'Bikes',
            'Tours',
            'Net EUR',
            'VAT 20% EUR',
            'Gross EUR',
          ];
          const lines = [
            header.join(','),
            ...ov.bookings.map((b) =>
              [
                b.ref_code,
                b.created_at.slice(0, 10),
                b.customer_name,
                b.customer_email,
                b.status,
                b.fulfillment_status || 'scheduled',
                b.bikes.length,
                b.tours.length,
                ((b.total_cents - b.vat_cents) / 100).toFixed(2),
                (b.vat_cents / 100).toFixed(2),
                (b.total_cents / 100).toFixed(2),
              ]
                .map(csvCell)
                .join(',')
            ),
          ];
          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="lepeloton-finance-ledger.csv"',
            'Cache-Control': 'no-store',
          });
          res.end(lines.join('\r\n'));
          return;
        }

        if (req.method === 'POST' && pathname === '/api/admin/events') {
          const body = await readJsonBody(req);
          const eventDate = String(body.event_date || '').trim();
          const title = normalizeName(body.title, 100);
          if (!isValidDateStr(eventDate) || title.length < 2) {
            return sendJson(res, 400, { error: 'Valid event date and title required.' });
          }
          const ts = nowIso();
          db.prepare(`
            INSERT INTO events (event_date, start_time, title, location, visibility, expected_guests, notes, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)
          `).run(
            eventDate,
            normalizeName(body.start_time, 16),
            title,
            normalizeName(body.location || 'Studio l’Échappée', 60),
            body.visibility === 'internal' ? 'internal' : 'public',
            Math.max(0, Math.min(500, Math.round(Number(body.expected_guests) || 0))),
            normalizeName(body.notes, 400),
            ts,
            ts
          );
          return sendJson(res, 201, { ok: true, overview: buildAdminOverview(db, leaderKey) });
        }

        const eventMatch = pathname.match(/^\/api\/admin\/events\/(\d+)$/);
        if (eventMatch && req.method === 'PATCH') {
          const id = Number(eventMatch[1]);
          const body = await readJsonBody(req);
          const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
          if (!existing) return sendJson(res, 404, { error: 'Event not found.' });
          db.prepare(
            'UPDATE events SET status = ?, visibility = ?, updated_at = ? WHERE id = ?'
          ).run(
            ['scheduled', 'cancelled'].includes(body.status) ? body.status : existing.status,
            ['public', 'internal'].includes(body.visibility) ? body.visibility : existing.visibility,
            nowIso(),
            id
          );
          return sendJson(res, 200, { ok: true, overview: buildAdminOverview(db, leaderKey) });
        }

        if (eventMatch && req.method === 'DELETE') {
          db.prepare('DELETE FROM events WHERE id = ?').run(Number(eventMatch[1]));
          return sendJson(res, 200, { ok: true, overview: buildAdminOverview(db, leaderKey) });
        }

        const rideEditMatch = pathname.match(/^\/api\/admin\/rides\/(\d+)$/);
        if (req.method === 'PATCH' && rideEditMatch) {
          const id = Number(rideEditMatch[1]);
          const existing = db.prepare('SELECT * FROM rides WHERE id = ?').get(id);
          if (!existing) return sendJson(res, 404, { error: 'Ride not found.' });
          const body = await readJsonBody(req);
          const leaders =
            body.leaders !== undefined
              ? (Array.isArray(body.leaders) ? body.leaders : String(body.leaders).split(','))
                  .map((s) => normalizeName(s, 48))
                  .filter(Boolean)
              : JSON.parse(existing.leaders || '[]');

          for (const l of leaders) {
            db.prepare('INSERT OR IGNORE INTO leaders (name, active) VALUES (?, 1)').run(l);
          }

          db.prepare(`
            UPDATE rides SET
              title = ?, start_time = ?, status = ?, leaders = ?, route_name = ?, route_url = ?, notes = ?, updated_at = ?
            WHERE id = ?
          `).run(
            body.title !== undefined ? normalizeName(body.title, 80) : existing.title,
            body.start_time !== undefined ? normalizeName(body.start_time, 16) : existing.start_time,
            body.status !== undefined && ['open', 'draft', 'completed', 'cancelled'].includes(body.status)
              ? body.status
              : existing.status,
            JSON.stringify(leaders),
            body.route_name !== undefined ? normalizeName(body.route_name, 100) : existing.route_name,
            body.route_url !== undefined ? String(body.route_url).trim().slice(0, 250) : existing.route_url,
            body.notes !== undefined ? normalizeName(body.notes, 240) : existing.notes,
            nowIso(),
            id
          );
          return sendJson(res, 200, { ok: true, overview: buildAdminOverview(db, leaderKey) });
        }

        if (req.method === 'PUT' && pathname === '/api/admin/planning-notes') {
          const body = await readJsonBody(req);
          const content = String(body.content ?? '').slice(0, 4000);
          db.prepare(`
            INSERT INTO planning_notes (id, content, updated_at) VALUES (1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
          `).run(content, nowIso());
          return sendJson(res, 200, { ok: true, overview: buildAdminOverview(db, leaderKey) });
        }

        const inqMatch = pathname.match(/^\/api\/admin\/studio-inquiries\/(\d+)$/);
        if (req.method === 'PATCH' && inqMatch) {
          const id = Number(inqMatch[1]);
          const body = await readJsonBody(req);
          if (!['new', 'replied', 'archived'].includes(body.status)) {
            return sendJson(res, 400, { error: 'Invalid status.' });
          }
          db.prepare('UPDATE studio_inquiries SET status = ? WHERE id = ?').run(body.status, id);
          return sendJson(res, 200, { ok: true, overview: buildAdminOverview(db, leaderKey) });
        }
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      const code = err.statusCode || 500;
      if (code >= 500) console.error(err);
      sendJson(res, code, { error: err.message || 'Internal server error' });
    }
  });

  return { server, db, organizerKey, leaderKey };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const port = Number(process.env.PORT || 3000);
  const { server, organizerKey, leaderKey } = createPelotonApp();
  server.listen(port, '0.0.0.0', () => {
    console.log(`Le Peloton Café Superapp running on http://localhost:${port}`);
    console.log(`  Storefront:    http://localhost:${port}/`);
    console.log(`  Ride Leaders:  http://localhost:${port}/leaders?key=${leaderKey}`);
    console.log(`  Staff Ops:     http://localhost:${port}/admin?key=${organizerKey}`);
    console.log(`  Stripe mode:   ${isStripeConfigured() ? 'LIVE / TEST API ACTIVE' : 'INSTANT RESERVATION (set STRIPE_SECRET_KEY to enable Stripe Checkout)'}`);
  });
}
