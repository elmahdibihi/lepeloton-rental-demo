import { CLUB_PACES } from './data.js';

const el = (id) => document.getElementById(id);
const urlParams = new URLSearchParams(window.location.search);
const keyParam = urlParams.get('key') || '';

function todayParis() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const state = {
  demoMode: false,
  today: todayParis(),
  date: todayParis(),
  leaders: [],
  selectedLeader: (() => {
    try {
      return localStorage.getItem('peloton_vetted_leader') || '';
    } catch {
      return '';
    }
  })(),
  upcomingDates: [],
  rides: [],
  myRides: [],
  planningNotes: '',
  events: [],
  seedCache: null,
};

function apiHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (keyParam) h['x-leader-key'] = keyParam;
  return h;
}

function showFeedback(msg, isError = false) {
  const box = el('leaderFeedback');
  box.hidden = false;
  box.className = `club-feedback${isError ? ' is-error' : ''}`;
  box.textContent = msg;
}

function readStaticEdits() {
  try {
    return JSON.parse(localStorage.getItem('peloton_leaders_static_edits') || '{}');
  } catch {
    return {};
  }
}

function buildStaticRidesForDate(dateStr) {
  const seed = state.seedCache || { rides: [] };
  const edits = readStaticEdits();
  const existing = (seed.rides || []).filter((r) => r.ride_date === dateStr);
  const order = { Spicy: 1, Medium: 2, Mild: 3 };
  const base =
    existing.length > 0
      ? existing.map((r) => ({ ...r, leaders: [...(r.leaders || [])] }))
      : CLUB_PACES.map((cp) => ({
          ride_date: dateStr,
          pace: cp.pace,
          title: 'Club Ride',
          start_time: cp.defaultTime,
          status: 'open',
          leaders: [],
          route_name: '',
          notes: '',
        }));
  return base
    .map((r) => {
      const ov = edits[`${dateStr}::${r.pace}`];
      return { ...r, leaders: ov ? ov : r.leaders };
    })
    .sort((a, b) => (order[a.pace] || 9) - (order[b.pace] || 9));
}

function computeStaticMyRides() {
  if (!state.selectedLeader) return [];
  const lower = state.selectedLeader.toLowerCase();
  const seed = state.seedCache || { rides: [] };
  const edits = readStaticEdits();
  const seenKeys = new Set();
  const mine = [];

  const checkRide = (r) => {
    if (r.ride_date < state.today || r.status === 'cancelled') return;
    const key = `${r.ride_date}::${r.pace}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    const leaders = edits[key] ? edits[key] : r.leaders || [];
    const idx = leaders.findIndex((l) => l.toLowerCase() === lower);
    if (idx !== -1) {
      mine.push({
        ride_date: r.ride_date,
        pace: r.pace,
        title: r.title || 'Club Ride',
        start_time: r.start_time || '',
        co_leaders: leaders.filter((_, i) => i !== idx),
      });
    }
  };

  for (const r of seed.rides || []) checkRide(r);
  for (const r of state.rides) checkRide(r);
  return mine.sort((a, b) => a.ride_date.localeCompare(b.ride_date));
}

async function refreshMyRides() {
  if (!state.selectedLeader) {
    state.myRides = [];
    renderMyRides();
    return;
  }
  if (state.demoMode) {
    state.myRides = computeStaticMyRides();
    renderMyRides();
    return;
  }
  const resp = await fetch(`./api/leaders/my-rides?name=${encodeURIComponent(state.selectedLeader)}`, {
    headers: apiHeaders(),
  });
  if (resp.ok) {
    const data = await resp.json();
    state.myRides = data.rides || [];
    renderMyRides();
  }
}

async function loadDate(nextDate) {
  if (!nextDate || nextDate < state.today) return;
  state.date = nextDate;
  if (state.demoMode) {
    state.rides = buildStaticRidesForDate(nextDate);
    renderAll();
    return;
  }
  const resp = await fetch(`./api/leaders/rides?date=${encodeURIComponent(nextDate)}`, {
    headers: apiHeaders(),
  });
  if (resp.ok) {
    const data = await resp.json();
    state.rides = data.rides || [];
    renderAll();
  }
}

async function mutateLeader(dateStr, pace, action) {
  if (!state.selectedLeader) {
    el('leaderSelect').focus();
    showFeedback('Select your name from the ride leader roster first.', true);
    return;
  }

  if (state.demoMode) {
    const ridesForDate = dateStr === state.date ? state.rides : buildStaticRidesForDate(dateStr);
    const target = ridesForDate.find((r) => r.pace === pace);
    if (!target) return;
    const idx = target.leaders.findIndex((l) => l.toLowerCase() === state.selectedLeader.toLowerCase());
    if (action === 'withdraw' && idx !== -1) {
      target.leaders.splice(idx, 1);
    } else if (action === 'signup' && idx === -1 && target.leaders.length < 4) {
      target.leaders.push(state.selectedLeader);
    }
    const edits = readStaticEdits();
    edits[`${dateStr}::${pace}`] = target.leaders;
    try {
      localStorage.setItem('peloton_leaders_static_edits', JSON.stringify(edits));
    } catch {}
    showFeedback(
      action === 'withdraw'
        ? `${state.selectedLeader} removed from ${pace} on ${dateStr}.`
        : `${state.selectedLeader} signed up to lead ${pace} on ${dateStr}.`
    );
    state.rides = buildStaticRidesForDate(state.date);
    state.myRides = computeStaticMyRides();
    renderAll();
    return;
  }

  const endpoint = action === 'withdraw' ? './api/leaders/withdraw' : './api/leaders/signup';
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ name: state.selectedLeader, date: dateStr, pace }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    showFeedback(data.error || 'Unable to update schedule.', true);
    return;
  }
  if (dateStr === state.date && data.rides) {
    state.rides = data.rides;
  }
  showFeedback(
    action === 'withdraw'
      ? `${state.selectedLeader} removed from ${pace} on ${dateStr}.`
      : `${state.selectedLeader} signed up to lead ${pace} on ${dateStr}.`
  );
  await refreshMyRides();
  renderAll();
}

function renderMyRides() {
  const panel = el('myRidesPanel');
  const grid = el('myRidesGrid');
  grid.replaceChildren();

  if (!state.selectedLeader || state.myRides.length === 0) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  el('myRidesHeading').textContent = `${state.selectedLeader}’s upcoming rides`;
  el('myRidesCount').textContent = `${state.myRides.length} scheduled`;

  for (const r of state.myRides) {
    const pill = document.createElement('div');
    pill.className = 'my-ride-pill';
    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `${r.ride_date} · ${r.pace}${r.start_time ? ` (${r.start_time})` : ''}`;
    const sub = document.createElement('span');
    sub.className = 'admin-sub';
    sub.textContent = r.co_leaders?.length ? `With ${r.co_leaders.join(', ')}` : 'Solo leader so far';
    info.append(title, sub);

    const wBtn = document.createElement('button');
    wBtn.type = 'button';
    wBtn.className = 'size-btn';
    wBtn.textContent = 'Withdraw';
    wBtn.addEventListener('click', () => mutateLeader(r.ride_date, r.pace, 'withdraw'));

    pill.append(info, wBtn);
    grid.appendChild(pill);
  }
}

function renderCards() {
  const grid = el('leaderCardsGrid');
  grid.replaceChildren();

  for (const paceName of ['Spicy', 'Medium', 'Mild']) {
    const meta = CLUB_PACES.find((p) => p.pace === paceName);
    const ride = state.rides.find((r) => r.pace === paceName) || {
      pace: paceName,
      title: 'Club Ride',
      start_time: meta.defaultTime,
      leaders: [],
      notes: '',
    };

    const leaders = ride.leaders || [];
    const isLeading =
      Boolean(state.selectedLeader) &&
      leaders.some((l) => l.toLowerCase() === state.selectedLeader.toLowerCase());
    const isFull = leaders.length >= meta.maxLeaders;

    const card = document.createElement('article');
    card.className = 'club-card';

    const top = document.createElement('div');
    const badgeRow = document.createElement('div');
    badgeRow.className = 'club-pace-row';
    const pacePill = document.createElement('span');
    pacePill.className = `pace-pill is-${paceName.toLowerCase()}`;
    pacePill.textContent = `${paceName} · ${meta.speed}`;
    const timeTag = document.createElement('span');
    timeTag.className = 'club-time';
    timeTag.textContent = ride.start_time || meta.defaultTime;
    badgeRow.append(pacePill, timeTag);

    const h3 = document.createElement('h3');
    h3.className = 'bike-name';
    h3.textContent = ride.title || 'Club Ride';

    const desc = document.createElement('p');
    desc.className = 'bike-sub';
    desc.textContent = meta.detail.en;
    top.append(badgeRow, h3, desc);

    if (ride.route_name || ride.notes) {
      const noteLine = document.createElement('p');
      noteLine.className = 'admin-sub';
      noteLine.style.margin = '6px 0 0';
      if (ride.route_url) {
        const a = document.createElement('a');
        a.href = ride.route_url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = ride.route_name || 'View route ↗';
        noteLine.appendChild(a);
      } else {
        noteLine.textContent = [ride.route_name, ride.notes].filter(Boolean).join(' · ');
      }
      top.appendChild(noteLine);
    }

    const leaderBox = document.createElement('div');
    leaderBox.className = 'club-leaders-box';
    const statusLine = document.createElement('div');
    statusLine.className = 'club-leader-head';
    const countSpan = document.createElement('span');
    countSpan.textContent = `Ride Leaders (${leaders.length}/${meta.maxLeaders})`;
    const badgeSpan = document.createElement('span');
    badgeSpan.className = `stock-caption${leaders.length === 0 ? ' is-empty' : ''}`;
    badgeSpan.textContent = isLeading
      ? 'Leading'
      : leaders.length === 0
        ? 'Leader needed'
        : isFull
          ? '4/4 full'
          : `${leaders.length} assigned`;
    statusLine.append(countSpan, badgeSpan);

    const chips = document.createElement('div');
    chips.className = 'leader-chips';
    if (leaders.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'leader-empty';
      empty.textContent = 'No leader signed up yet';
      chips.appendChild(empty);
    } else {
      for (const l of leaders) {
        const chip = document.createElement('span');
        chip.className = 'leader-chip';
        chip.textContent = l;
        chips.appendChild(chip);
      }
    }
    leaderBox.append(statusLine, chips);

    const actions = document.createElement('div');
    actions.className = 'club-card-actions';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = isLeading ? 'btn-ghost' : 'btn-yellow';
    btn.disabled = !isLeading && isFull;
    btn.textContent = isLeading ? 'Withdraw from group' : isFull ? '4/4 leaders' : 'Lead this group';
    btn.addEventListener('click', () => mutateLeader(state.date, paceName, isLeading ? 'withdraw' : 'signup'));
    actions.appendChild(btn);

    card.append(top, leaderBox, actions);
    grid.appendChild(card);
  }
}

function renderAll() {
  const sel = el('leaderSelect');
  sel.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— Choose your name —';
  sel.appendChild(placeholder);
  for (const name of state.leaders) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    opt.selected = name.toLowerCase() === state.selectedLeader.toLowerCase();
    sel.appendChild(opt);
  }

  const dateInput = el('leaderDateInput');
  dateInput.min = state.today;
  dateInput.value = state.date;

  const pills = el('leaderDatePills');
  pills.replaceChildren();
  for (const d of state.upcomingDates.slice(0, 8)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `size-btn${d.ride_date === state.date ? ' is-selected' : ''}`;
    b.textContent = d.ride_date.slice(5);
    b.title = `${d.ride_date} · ${d.title}`;
    b.addEventListener('click', () => loadDate(d.ride_date));
    pills.appendChild(b);
  }

  renderMyRides();
  renderCards();
  renderBulletin();
}

function renderBulletin() {
  const sec = el('leaderBulletin');
  const body = el('leaderBulletinBody');
  body.replaceChildren();

  if (!state.planningNotes && state.events.length === 0) {
    sec.hidden = true;
    return;
  }
  sec.hidden = false;

  if (state.events.length > 0) {
    const evWrap = document.createElement('div');
    evWrap.className = 'admin-list';
    for (const ev of state.events) {
      const row = document.createElement('div');
      row.className = 'my-ride-pill';
      const info = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = `${ev.event_date}${ev.start_time ? ` · ${ev.start_time}` : ''} — ${ev.title}`;
      const sub = document.createElement('span');
      sub.className = 'admin-sub';
      sub.textContent = `${ev.location}${ev.notes ? ` · ${ev.notes}` : ''}`;
      info.append(strong, sub);
      row.appendChild(info);
      evWrap.appendChild(row);
    }
    body.appendChild(evWrap);
  }

  if (state.planningNotes) {
    const pre = document.createElement('div');
    pre.className = 'bulletin-notes';
    pre.textContent = state.planningNotes;
    body.appendChild(pre);
  }
}

async function boot() {
  if (!window.location.hostname.endsWith('.github.io')) {
    try {
      const resp = await fetch('./api/leaders/meta', { headers: apiHeaders() });
      if (resp.status === 401) {
        window.location.href = './leaders';
        return;
      }
      if (resp.ok) {
        const data = await resp.json();
        state.demoMode = false;
        state.today = data.today;
        state.leaders = data.leaders || [];
        state.upcomingDates = data.upcomingDates || [];
        state.date = data.date || data.today;
        state.rides = data.rides || [];
        state.planningNotes = data.planningNotes?.content || '';
        state.events = data.events || [];
        el('leaderModePill').textContent = 'Live SQLite';
        if (state.selectedLeader && !state.leaders.some((l) => l.toLowerCase() === state.selectedLeader.toLowerCase())) {
          state.selectedLeader = '';
        }
        await refreshMyRides();
        renderAll();
        return;
      }
    } catch {}
  }

  state.demoMode = true;
  el('leaderModePill').textContent = 'Static Preview Mode';
  try {
    const r = await fetch('./seed-club.json');
    if (r.ok) {
      const seed = await r.json();
      state.seedCache = seed;
      state.leaders = seed.leaders || [];
      const seen = new Set();
      const upcoming = [];
      for (const item of seed.rides || []) {
        if (item.ride_date >= state.today && item.status !== 'cancelled' && !seen.has(item.ride_date)) {
          seen.add(item.ride_date);
          upcoming.push({ ride_date: item.ride_date, title: item.title });
        }
      }
      state.upcomingDates = upcoming;
      state.date = upcoming[0]?.ride_date || state.today;
      state.rides = buildStaticRidesForDate(state.date);
      state.myRides = computeStaticMyRides();
      state.planningNotes = seed.planning_notes || '';
      state.events = [
        { event_date: '2026-12-15', start_time: '19:00', title: 'Le Peloton Christmas Party', location: 'Studio l’Échappée', notes: 'Annual club & café holiday gathering' },
        { event_date: '2026-12-24', start_time: '08:00', title: 'Café Closed (Christmas Eve & Day)', location: 'Café', notes: 'Closed Dec 24 & Dec 25' },
      ];
    }
  } catch {}
  renderAll();
}

el('leaderSelect').addEventListener('change', async (e) => {
  state.selectedLeader = e.target.value;
  try {
    localStorage.setItem('peloton_vetted_leader', state.selectedLeader);
  } catch {}
  await refreshMyRides();
  renderCards();
});

el('leaderDateInput').addEventListener('change', (e) => {
  loadDate(e.target.value);
});

boot();
