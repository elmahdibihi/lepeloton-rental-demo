import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIKES, CLUB_PACES, TOURS } from './data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.join(__dirname, 'data', 'peloton.db');
const SEED_CLUB_PATH = path.join(__dirname, 'seed-club.json');

export const PACES = CLUB_PACES.map((p) => p.pace);
export const PACE_ORDER_SQL = `CASE pace WHEN 'Spicy' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Mild' THEN 3 ELSE 4 END`;

export function getTodayParis() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function nowIso() {
  return new Date().toISOString();
}

export function openDb(dbPath = DEFAULT_DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK (status IN ('pending_payment', 'confirmed', 'cancelled')),
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL DEFAULT '',
      total_cents INTEGER NOT NULL,
      vat_cents INTEGER NOT NULL,
      stripe_session_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS booking_bikes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      bike_id TEXT NOT NULL,
      size_code TEXT NOT NULL,
      pedal_id TEXT NOT NULL,
      extras_json TEXT NOT NULL DEFAULT '[]',
      child_age_note TEXT NOT NULL DEFAULT '',
      rider_name TEXT NOT NULL DEFAULT '',
      pickup_date TEXT NOT NULL,
      pickup_time TEXT NOT NULL,
      return_date TEXT NOT NULL,
      return_time TEXT NOT NULL,
      duration_key TEXT NOT NULL,
      custom_days INTEGER NOT NULL DEFAULT 1,
      start_ms INTEGER NOT NULL,
      end_ms INTEGER NOT NULL,
      price_cents INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_booking_bikes_window
      ON booking_bikes(bike_id, size_code, start_ms, end_ms);

    CREATE TABLE IF NOT EXISTS booking_tours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      tour_id TEXT NOT NULL,
      tour_date TEXT NOT NULL,
      tour_time TEXT NOT NULL,
      adults INTEGER NOT NULL,
      kids INTEGER NOT NULL DEFAULT 0,
      price_cents INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_booking_tours_slot
      ON booking_tours(tour_id, tour_date, tour_time);

    CREATE TABLE IF NOT EXISTS workshop_holds (
      bike_id TEXT NOT NULL,
      size_code TEXT NOT NULL,
      held_count INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (bike_id, size_code)
    );

    CREATE TABLE IF NOT EXISTS rides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ride_date TEXT NOT NULL,
      pace TEXT NOT NULL CHECK (pace IN ('Mild', 'Medium', 'Spicy')),
      title TEXT NOT NULL DEFAULT 'Club Ride',
      start_time TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'draft', 'completed', 'cancelled')),
      leaders TEXT NOT NULL DEFAULT '[]',
      unavailable TEXT NOT NULL DEFAULT '[]',
      route_name TEXT NOT NULL DEFAULT '',
      route_url TEXT NOT NULL DEFAULT '',
      meeting_point TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      needs_review INTEGER NOT NULL DEFAULT 0,
      review_reason TEXT NOT NULL DEFAULT '',
      source_sheet TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(ride_date, pace)
    );

    CREATE TABLE IF NOT EXISTS leaders (
      name TEXT PRIMARY KEY,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS planning_notes (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      ride_date TEXT DEFAULT '',
      pace TEXT DEFAULT '',
      details TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS studio_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      event_date TEXT NOT NULL DEFAULT '',
      guests INTEGER NOT NULL DEFAULT 20,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied', 'archived')),
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

export function withImmediateTx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {}
    throw err;
  }
}

export function seedClubIfEmpty(db, seedPath = SEED_CLUB_PATH) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM rides').get().c;
  if (count > 0 || !fs.existsSync(seedPath)) return false;

  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  const ts = nowIso();

  withImmediateTx(db, () => {
    const insertLeader = db.prepare('INSERT OR IGNORE INTO leaders (name, active) VALUES (?, 1)');
    for (const name of seed.leaders || []) {
      insertLeader.run(name);
    }

    const insertRide = db.prepare(`
      INSERT OR IGNORE INTO rides (
        ride_date, pace, title, start_time, status, leaders, unavailable,
        route_name, route_url, meeting_point, notes, needs_review, review_reason,
        source_sheet, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of seed.rides || []) {
      insertRide.run(
        r.ride_date,
        r.pace,
        r.title || 'Club Ride',
        r.start_time || '',
        r.status || 'open',
        JSON.stringify(r.leaders || []),
        JSON.stringify(r.unavailable || []),
        r.route_name || '',
        r.route_url || '',
        r.meeting_point || '',
        r.notes || '',
        r.needs_review ? 1 : 0,
        r.review_reason || '',
        r.source_sheet || '',
        ts,
        ts
      );
    }

    db.prepare(`
      INSERT INTO planning_notes (id, content, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
    `).run(seed.planning_notes || '', ts);
  });

  return true;
}

export function expireStalePendingBookings(db, maxAgeMinutes = 30) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString();
  db.prepare(`
    UPDATE bookings
    SET status = 'cancelled', updated_at = ?
    WHERE status = 'pending_payment' AND created_at < ?
  `).run(nowIso(), cutoff);
}

export function getWorkshopHoldsMap(db) {
  const rows = db.prepare('SELECT bike_id, size_code, held_count, reason, updated_at FROM workshop_holds').all();
  const map = new Map();
  for (const r of rows) {
    map.set(`${r.bike_id}::${r.size_code}`, r);
  }
  return map;
}

export function getFleetStockSnapshot(db, startMs, endMs) {
  expireStalePendingBookings(db);
  const holds = getWorkshopHoldsMap(db);

  const overlappingRows =
    startMs > 0 && endMs > startMs
      ? db
          .prepare(`
            SELECT bb.bike_id, bb.size_code, COUNT(*) AS booked_count
            FROM booking_bikes bb
            JOIN bookings b ON b.id = bb.booking_id
            WHERE b.status IN ('confirmed', 'pending_payment')
              AND bb.start_ms < ?
              AND bb.end_ms > ?
            GROUP BY bb.bike_id, bb.size_code
          `)
          .all(endMs, startMs)
      : [];

  const bookedMap = new Map();
  for (const r of overlappingRows) {
    bookedMap.set(`${r.bike_id}::${r.size_code}`, Number(r.booked_count));
  }

  const stock = {};
  for (const bike of BIKES) {
    stock[bike.id] = {};
    for (const sz of bike.sizes) {
      const key = `${bike.id}::${sz.code}`;
      const held = holds.get(key)?.held_count || 0;
      const booked = bookedMap.get(key) || 0;
      stock[bike.id][sz.code] = Math.max(0, sz.stock - held - booked);
    }
  }
  return stock;
}

export function getTourAvailabilitySnapshot(db, tourDate) {
  expireStalePendingBookings(db);
  const rows = tourDate
    ? db
        .prepare(`
          SELECT bt.tour_id, bt.tour_time,
                 COUNT(*) AS bookings_count,
                 COALESCE(SUM(bt.adults + bt.kids), 0) AS riders_sum
          FROM booking_tours bt
          JOIN bookings b ON b.id = bt.booking_id
          WHERE b.status IN ('confirmed', 'pending_payment')
            AND bt.tour_date = ?
          GROUP BY bt.tour_id, bt.tour_time
        `)
        .all(tourDate)
    : [];

  const map = new Map();
  for (const r of rows) {
    map.set(`${r.tour_id}::${r.tour_time}`, r);
  }

  const out = {};
  for (const tour of TOURS) {
    out[tour.id] = {};
    for (const slot of tour.slots) {
      const usage = map.get(`${tour.id}::${slot}`);
      if (tour.pricingType === 'private_group') {
        out[tour.id][slot] = usage && usage.bookings_count > 0 ? 0 : tour.capacity;
      } else {
        out[tour.id][slot] = Math.max(0, tour.capacity - Number(usage?.riders_sum || 0));
      }
    }
  }
  return out;
}

export function hydrateRide(row) {
  if (!row) return null;
  const today = getTodayParis();
  const effectiveStatus =
    row.status === 'cancelled' ? 'cancelled' : row.ride_date < today ? 'completed' : row.status;
  return {
    id: row.id,
    ride_date: row.ride_date,
    pace: row.pace,
    title: row.title,
    start_time: row.start_time,
    status: row.status,
    effective_status: effectiveStatus,
    leaders: JSON.parse(row.leaders || '[]'),
    unavailable: JSON.parse(row.unavailable || '[]'),
    route_name: row.route_name,
    route_url: row.route_url,
    meeting_point: row.meeting_point,
    notes: row.notes,
    needs_review: Boolean(row.needs_review),
    review_reason: row.review_reason,
    source_sheet: row.source_sheet,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function ensureDraftDate(db, rideDate, actor = 'system') {
  const existing = db.prepare(`SELECT * FROM rides WHERE ride_date = ? ORDER BY ${PACE_ORDER_SQL}`).all(rideDate);
  if (existing.length > 0) return existing.map(hydrateRide);

  const ts = nowIso();
  const defaults = { Spicy: '08:30', Medium: '09:00', Mild: '09:30' };
  const insert = db.prepare(`
    INSERT OR IGNORE INTO rides (
      ride_date, pace, title, start_time, status, leaders, unavailable,
      route_name, route_url, meeting_point, notes, needs_review, review_reason,
      source_sheet, created_at, updated_at
    ) VALUES (?, ?, 'Club Ride', ?, 'open', '[]', '[]', '', '', '17 Rue du Pont Louis-Philippe', '', 0, '', 'web', ?, ?)
  `);

  for (const pace of ['Spicy', 'Medium', 'Mild']) {
    insert.run(rideDate, pace, defaults[pace], ts, ts);
  }

  db.prepare(`
    INSERT INTO activity_log (created_at, actor, action, ride_date, pace, details)
    VALUES (?, ?, 'draft_created', ?, '', 'Opened Spicy, Medium & Mild groups')
  `).run(ts, actor, rideDate);

  return db.prepare(`SELECT * FROM rides WHERE ride_date = ? ORDER BY ${PACE_ORDER_SQL}`).all(rideDate).map(hydrateRide);
}

export function getBookingByRef(db, refCode) {
  const booking = db.prepare('SELECT * FROM bookings WHERE ref_code = ?').get(refCode);
  if (!booking) return null;
  const bikes = db
    .prepare('SELECT * FROM booking_bikes WHERE booking_id = ? ORDER BY id ASC')
    .all(booking.id)
    .map((r) => ({ ...r, extras: JSON.parse(r.extras_json || '[]') }));
  const tours = db.prepare('SELECT * FROM booking_tours WHERE booking_id = ? ORDER BY id ASC').all(booking.id);
  return { ...booking, bikes, tours };
}
