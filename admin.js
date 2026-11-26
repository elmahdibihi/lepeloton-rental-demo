import { BIKES, PEDAL_OPTIONS, TOURS } from './data.js';

const el = (id) => document.getElementById(id);
const urlParams = new URLSearchParams(window.location.search);
const keyParam = urlParams.get('key') || '';

const state = {
  tab: 'prep',
  prepFilter: 'all',
  demoMode: false,
  overview: null,
};

function apiHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (keyParam) h['x-organizer-key'] = keyParam;
  return h;
}

function fmtEuroCents(cents) {
  const val = (Number(cents) || 0) / 100;
  return Number.isInteger(val) ? `€${val}` : `€${val.toFixed(2)}`;
}

let segButtons = new Map();
let segBase = null;
let segOverlay = null;

function renderTabSeg() {
  const container = el('adminTabSeg');
  const tabs = [
    { value: 'prep', label: 'Morning Prep' },
    { value: 'finance', label: 'Revenue & Finance' },
    { value: 'events', label: 'Events & Studio' },
    { value: 'workshop', label: 'Workshop Stock' },
    { value: 'club', label: 'Cycling Club' },
  ];

  if (!segBase) {
    container.replaceChildren();
    segBase = document.createElement('div');
    segBase.className = 'seg-base';
    segOverlay = document.createElement('div');
    segOverlay.className = 'seg-overlay';
    segOverlay.setAttribute('aria-hidden', 'true');
    segButtons = new Map();

    for (const t of tabs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        state.tab = t.value;
        syncActiveTab();
      });
      segBase.appendChild(btn);
      segButtons.set(t.value, btn);

      const span = document.createElement('span');
      span.textContent = t.label;
      segOverlay.appendChild(span);
    }
    container.append(segBase, segOverlay);
  }

  syncActiveTab();
}

function syncActiveTab() {
  let activeBtn = null;
  for (const [val, btn] of segButtons.entries()) {
    const isAct = val === state.tab;
    btn.setAttribute('aria-checked', String(isAct));
    if (isAct) activeBtn = btn;
  }
  if (activeBtn && segBase) {
    requestAnimationFrame(() => {
      const totalW = segBase.offsetWidth;
      if (!totalW) return;
      const left = activeBtn.offsetLeft;
      const right = Math.max(0, totalW - (left + activeBtn.offsetWidth));
      segOverlay.style.setProperty('--cl', `${left}px`);
      segOverlay.style.setProperty('--cr', `${right}px`);
    });
  }

  el('panelPrep').hidden = state.tab !== 'prep';
  el('panelFinance').hidden = state.tab !== 'finance';
  el('panelEvents').hidden = state.tab !== 'events';
  el('panelWorkshop').hidden = state.tab !== 'workshop';
  el('panelClub').hidden = state.tab !== 'club';
}

function computeDemoFinance(bookings, today) {
  let confirmedCount = 0;
  let confirmedGrossCents = 0;
  let confirmedVatCents = 0;
  let pendingGrossCents = 0;
  let rentalsGrossCents = 0;
  let rentalsCount = 0;
  let toursGrossCents = 0;
  let toursCount = 0;
  let bikesOutNow = 0;
  let pickupsToday = 0;
  const byItem = new Map();

  for (const b of bookings) {
    if (b.status === 'pending_payment') {
      pendingGrossCents += b.total_cents;
      continue;
    }
    if (b.status !== 'confirmed') continue;
    confirmedCount += 1;
    confirmedGrossCents += b.total_cents;
    confirmedVatCents += b.vat_cents || Math.round(b.total_cents - b.total_cents / 1.2);
    if (b.fulfillment_status === 'picked_up') bikesOutNow += (b.bikes || []).length;
    for (const bk of b.bikes || []) {
      rentalsCount += 1;
      const price = bk.price_cents || 7500;
      rentalsGrossCents += price;
      if (bk.pickup_date === today) pickupsToday += 1;
      const bikeObj = BIKES.find((x) => x.id === bk.bike_id);
      const key = `Bike: ${bikeObj?.name || bk.bike_id}`;
      const cur = byItem.get(key) || { name: key, count: 0, grossCents: 0 };
      cur.count += 1;
      cur.grossCents += price;
      byItem.set(key, cur);
    }
    for (const tr of b.tours || []) {
      toursCount += 1;
      const price = tr.price_cents || 9000;
      toursGrossCents += price;
      const tourObj = TOURS.find((x) => x.id === tr.tour_id);
      const key = `Tour: ${tourObj?.name.en || tr.tour_id}`;
      const cur = byItem.get(key) || { name: key, count: 0, grossCents: 0 };
      cur.count += tr.adults + (tr.kids || 0);
      cur.grossCents += price;
      byItem.set(key, cur);
    }
  }

  return {
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
    byItem: [...byItem.values()].sort((a, b) => b.grossCents - a.grossCents),
  };
}

async function buildStaticDemoOverview() {
  let seed = { leaders: [], rides: [], planning_notes: '' };
  try {
    const r = await fetch('./seed-club.json');
    if (r.ok) seed = await r.json();
  } catch {}
  const today = new Date().toISOString().slice(0, 10);
  const upcomingRides = (seed.rides || [])
    .filter((r) => r.ride_date >= today && r.status !== 'cancelled')
    .slice(0, 15)
    .map((r, i) => ({ ...r, id: i + 1, effective_status: r.status || 'open' }));

  const bookings = [
    {
      id: 1,
      ref_code: 'LPC-9F42A1',
      status: 'confirmed',
      fulfillment_status: 'scheduled',
      customer_name: 'Claire Moreau',
      customer_email: 'claire@example.com',
      customer_phone: '+33 6 12 34 56 78',
      total_cents: 17000,
      vat_cents: 2833,
      created_at: `${today}T08:15:00Z`,
      bikes: [
        {
          bike_id: '5474683819393024',
          size_code: 'M',
          pedal_id: 'spd_sl',
          extras: ['garmin_mount'],
          rider_name: 'Claire',
          pickup_date: today,
          pickup_time: '08:30',
          return_date: today,
          return_time: '18:00',
          price_cents: 8000,
        },
      ],
      tours: [
        {
          tour_id: 'hidden_paris',
          tour_date: today,
          tour_time: '14:30',
          adults: 2,
          kids: 0,
          price_cents: 9000,
        },
      ],
    },
  ];

  return {
    today,
    leaderPortalPath: './leaders.html?demo=1',
    bookings,
    finance: computeDemoFinance(bookings, today),
    events: [
      {
        id: 1,
        event_date: '2026-12-15',
        start_time: '19:00',
        title: 'Le Peloton Christmas Party',
        location: 'Studio l’Échappée',
        visibility: 'public',
        expected_guests: 80,
        notes: 'Annual club & café holiday gathering three doors down.',
        status: 'scheduled',
      },
      {
        id: 2,
        event_date: '2026-12-24',
        start_time: '08:00',
        title: 'Café Closed (Christmas Eve & Day)',
        location: 'Café',
        visibility: 'public',
        expected_guests: 0,
        notes: 'Closed Dec 24 & Dec 25.',
        status: 'scheduled',
      },
    ],
    fleet: BIKES.map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      sizes: b.sizes.map((s) => ({
        code: s.code,
        totalStock: s.stock,
        heldCount: 0,
        reason: '',
        availableNow: s.stock,
      })),
    })),
    club: {
      upcomingRides,
      needsLeaderCount: upcomingRides.filter((r) => (r.leaders || []).length === 0).length,
      leaders: seed.leaders || [],
      workload: (seed.leaders || []).slice(0, 10).map((name, i) => ({ name, upcoming: i % 3, past: 6 - (i % 5), total: 6 })),
      planningNotes: { content: seed.planning_notes || '', updated_at: today },
      recentActivity: [],
    },
    studioInquiries: [
      {
        id: 1,
        name: 'Le Col Paris Press Ride',
        email: 'events@lecol.cc',
        event_date: today,
        guests: 55,
        notes: 'Morning espresso bar + afternoon jersey showcase in l’Échappée.',
        status: 'new',
      },
    ],
  };
}

async function loadOverview() {
  if (!window.location.hostname.endsWith('.github.io')) {
    try {
      const resp = await fetch('./api/admin/overview', { headers: apiHeaders() });
      if (resp.status === 401) {
        window.location.href = './admin';
        return;
      }
      if (resp.ok) {
        state.demoMode = false;
        state.overview = await resp.json();
        el('adminStatusPill').textContent = 'Live SQLite';
        renderDashboard();
        return;
      }
    } catch {}
  }

  state.demoMode = true;
  el('adminStatusPill').textContent = 'Static Preview Mode';
  state.overview = await buildStaticDemoOverview();
  renderDashboard();
}

function renderKpis() {
  const ov = state.overview;
  if (state.demoMode) ov.finance = computeDemoFinance(ov.bookings, ov.today);
  const fin = ov.finance;
  const wrap = el('adminKpis');
  wrap.replaceChildren();

  const heldTotal = ov.fleet.reduce(
    (sum, b) => sum + b.sizes.reduce((s2, sz) => s2 + sz.heldCount, 0),
    0
  );
  const needsLeaderCount = ov.club.upcomingRides.filter((r) => (r.leaders || []).length === 0).length;
  const scheduledEvents = (ov.events || []).filter((e) => e.status === 'scheduled').length;
  const newInquiries = ov.studioInquiries.filter((i) => i.status === 'new').length;

  const items = [
    {
      label: 'Confirmed Revenue',
      value: fmtEuroCents(fin.confirmedGrossCents),
      sub: `${fmtEuroCents(fin.confirmedNetCents)} net · ${fmtEuroCents(fin.confirmedVatCents)} VAT`,
    },
    {
      label: 'Bikes Rented / Out',
      value: `${fin.rentalsCount} (${fin.bikesOutNow} out)`,
      sub: `${fin.pickupsToday} pickups today · ${heldTotal} in workshop`,
    },
    {
      label: 'Upcoming Events & Leads',
      value: `${scheduledEvents} / ${newInquiries}`,
      sub: `${scheduledEvents} scheduled · ${newInquiries} new studio leads`,
    },
    {
      label: 'Club Groups Needing Leader',
      value: String(needsLeaderCount),
      sub: `${ov.club.leaders.length} vetted leaders on roster`,
    },
  ];

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'admin-kpi-card';
    const sp = document.createElement('span');
    sp.textContent = item.label;
    const st = document.createElement('strong');
    st.textContent = item.value;
    const sub = document.createElement('small');
    sub.className = 'admin-sub';
    sub.textContent = item.sub;
    card.append(sp, st, sub);
    wrap.appendChild(card);
  }
}

function renderPrepPanel() {
  const panel = el('panelPrep');
  panel.replaceChildren();

  const filterBar = document.createElement('div');
  filterBar.className = 'size-pills';
  filterBar.style.marginBottom = '14px';
  for (const [val, label] of [
    ['all', 'All bookings'],
    ['scheduled', 'Awaiting pickup'],
    ['picked_up', 'Out on road'],
    ['returned', 'Returned'],
  ]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `size-btn${state.prepFilter === val ? ' is-selected' : ''}`;
    b.textContent = label;
    b.addEventListener('click', () => {
      state.prepFilter = val;
      renderPrepPanel();
    });
    filterBar.appendChild(b);
  }
  panel.appendChild(filterBar);

  const bookings = state.overview.bookings.filter((b) => {
    if (state.prepFilter === 'all') return true;
    return b.status !== 'cancelled' && (b.fulfillment_status || 'scheduled') === state.prepFilter;
  });

  if (bookings.length === 0) {
    const p = document.createElement('p');
    p.className = 'fleet-meta';
    p.textContent = 'No reservations match this filter.';
    panel.appendChild(p);
    return;
  }

  const stack = document.createElement('div');
  stack.className = 'admin-list';

  for (const b of bookings) {
    const card = document.createElement('article');
    card.className = `admin-row-card${b.status === 'cancelled' ? ' is-dimmed' : ''}`;

    const head = document.createElement('div');
    head.className = 'admin-row-head';
    const left = document.createElement('div');
    const code = document.createElement('strong');
    code.className = 'admin-ref';
    code.textContent = `${b.ref_code} · ${b.customer_name}`;
    const contact = document.createElement('span');
    contact.className = 'admin-sub';
    contact.textContent = `${b.customer_email}${b.customer_phone ? ` · ${b.customer_phone}` : ''}`;
    left.append(code, contact);

    const right = document.createElement('div');
    right.className = 'admin-head-right';
    const statusBadge = document.createElement('span');
    statusBadge.className = `status-pill is-${b.status}`;
    statusBadge.textContent = b.status.replace('_', ' ');

    const fulfill = b.fulfillment_status || 'scheduled';
    const fulfillBadge = document.createElement('span');
    fulfillBadge.className = `fulfill-pill is-${fulfill}`;
    fulfillBadge.textContent = fulfill === 'picked_up' ? 'Out now' : fulfill === 'returned' ? 'Returned' : 'Scheduled';

    const amt = document.createElement('strong');
    amt.textContent = fmtEuroCents(b.total_cents);

    if (b.status === 'confirmed') {
      const nextFulfill = fulfill === 'scheduled' ? 'picked_up' : fulfill === 'picked_up' ? 'returned' : 'scheduled';
      const fulfillBtn = document.createElement('button');
      fulfillBtn.type = 'button';
      fulfillBtn.className = 'size-btn is-selected';
      fulfillBtn.textContent =
        fulfill === 'scheduled' ? 'Check out' : fulfill === 'picked_up' ? 'Mark returned' : 'Reopen';
      fulfillBtn.addEventListener('click', async () => {
        if (state.demoMode) {
          b.fulfillment_status = nextFulfill;
          renderDashboard();
          return;
        }
        const resp = await fetch(`./api/admin/bookings/${b.id}/fulfillment`, {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ fulfillment_status: nextFulfill }),
        });
        if (resp.ok) {
          state.overview = (await resp.json()).overview;
          renderDashboard();
        }
      });
      right.append(statusBadge, fulfillBadge, amt, fulfillBtn);
    } else {
      right.append(statusBadge, amt);
    }

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'size-btn';
    toggleBtn.textContent = b.status === 'cancelled' ? 'Restore' : 'Cancel';
    toggleBtn.addEventListener('click', async () => {
      const next = b.status === 'cancelled' ? 'confirmed' : 'cancelled';
      if (state.demoMode) {
        b.status = next;
        renderDashboard();
        return;
      }
      const resp = await fetch(`./api/admin/bookings/${b.id}/status`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ status: next }),
      });
      if (resp.ok) {
        state.overview = (await resp.json()).overview;
        renderDashboard();
      }
    });

    right.appendChild(toggleBtn);
    head.append(left, right);

    const lines = document.createElement('ul');
    lines.className = 'admin-prep-items';
    for (const bk of b.bikes || []) {
      const bikeObj = BIKES.find((x) => x.id === bk.bike_id);
      const pedalObj = PEDAL_OPTIONS.find((p) => p.id === bk.pedal_id);
      const li = document.createElement('li');
      li.textContent = `🚲 ${bikeObj?.name || bk.bike_id} [${bk.size_code}] · Pedals: ${pedalObj?.label.en || bk.pedal_id}${
        bk.extras?.length ? ` · Extras: ${bk.extras.join(', ')}` : ''
      }${bk.rider_name ? ` · Rider: ${bk.rider_name}` : ''} (${bk.pickup_date} ${bk.pickup_time} → ${bk.return_date} ${bk.return_time})`;
      lines.appendChild(li);
    }
    for (const tr of b.tours || []) {
      const tourObj = TOURS.find((x) => x.id === tr.tour_id);
      const li = document.createElement('li');
      li.textContent = `🗺️ ${tourObj?.name.en || tr.tour_id} · ${tr.tour_date} at ${tr.tour_time} · ${tr.adults} adults${
        tr.kids ? `, ${tr.kids} youth` : ''
      }`;
      lines.appendChild(li);
    }

    card.append(head, lines);
    stack.appendChild(card);
  }
  panel.appendChild(stack);
}

function renderFinancePanel() {
  const panel = el('panelFinance');
  panel.replaceChildren();
  const fin = state.overview.finance;

  const topBar = document.createElement('div');
  topBar.className = 'admin-row-card admin-club-bar';
  const barHead = document.createElement('div');
  barHead.className = 'admin-row-head';
  const titleWrap = document.createElement('div');
  const h3 = document.createElement('h3');
  h3.className = 'bike-name';
  h3.textContent = 'Revenue, French VAT (20%) & Accounting Export';
  const sub = document.createElement('span');
  sub.className = 'admin-sub';
  sub.textContent = `Confirmed orders: ${fin.confirmedCount} · Average basket: ${fmtEuroCents(fin.avgOrderCents)} · Pending checkout: ${fmtEuroCents(fin.pendingGrossCents)}`;
  titleWrap.append(h3, sub);

  const expBtn = document.createElement('button');
  expBtn.type = 'button';
  expBtn.className = 'btn-yellow';
  expBtn.textContent = 'Export Accounting CSV';
  expBtn.addEventListener('click', async () => {
    if (!state.demoMode) {
      const resp = await fetch('./api/admin/finance/export.csv', { headers: apiHeaders() });
      if (!resp.ok) return;
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lepeloton-finance-ledger.csv';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const lines = [
      'Ref,Customer,Status,Net EUR,VAT 20% EUR,Gross EUR',
      ...state.overview.bookings.map(
        (b) =>
          `${b.ref_code},"${b.customer_name}",${b.status},${((b.total_cents - b.vat_cents) / 100).toFixed(2)},${(
            b.vat_cents / 100
          ).toFixed(2)},${(b.total_cents / 100).toFixed(2)}`
      ),
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lepeloton-finance-ledger.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  barHead.append(titleWrap, expBtn);
  topBar.appendChild(barHead);
  panel.appendChild(topBar);

  const grid = document.createElement('div');
  grid.className = 'cafe-studio-grid';

  const streamsCard = document.createElement('div');
  streamsCard.className = 'admin-row-card';
  const sTitle = document.createElement('h3');
  sTitle.className = 'bike-name';
  sTitle.textContent = 'Revenue Streams (EUR)';
  const sDl = document.createElement('dl');
  sDl.className = 'ledger-list';
  for (const [k, v] of [
    [`Bike Rentals (${fin.rentalsCount} bikes)`, fmtEuroCents(fin.rentalsGrossCents)],
    [`Guided Bike About Tours (${fin.toursCount} bookings)`, fmtEuroCents(fin.toursGrossCents)],
    ['Net Revenue (Excl. VAT)', fmtEuroCents(fin.confirmedNetCents)],
    ['French VAT Collected (20%)', fmtEuroCents(fin.confirmedVatCents)],
    ['Total Confirmed Gross', fmtEuroCents(fin.confirmedGrossCents)],
  ]) {
    const row = document.createElement('div');
    row.className = 'ledger-row';
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    row.append(dt, dd);
    sDl.appendChild(row);
  }
  streamsCard.append(sTitle, sDl);

  const itemsCard = document.createElement('div');
  itemsCard.className = 'admin-row-card';
  const iTitle = document.createElement('h3');
  iTitle.className = 'bike-name';
  iTitle.textContent = 'Top Performing Bikes & Tours';
  const iDl = document.createElement('dl');
  iDl.className = 'ledger-list';
  if (fin.byItem.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'admin-sub';
    empty.textContent = 'Confirmed bookings will break down by bike model and tour here.';
    itemsCard.append(iTitle, empty);
  } else {
    for (const rowData of fin.byItem) {
      const row = document.createElement('div');
      row.className = 'ledger-row';
      const dt = document.createElement('dt');
      dt.textContent = `${rowData.name} (${rowData.count})`;
      const dd = document.createElement('dd');
      dd.textContent = fmtEuroCents(rowData.grossCents);
      row.append(dt, dd);
      iDl.appendChild(row);
    }
    itemsCard.append(iTitle, iDl);
  }

  grid.append(streamsCard, itemsCard);
  panel.appendChild(grid);
}

function renderEventsPanel() {
  const panel = el('panelEvents');
  panel.replaceChildren();

  const layout = document.createElement('div');
  layout.className = 'cafe-studio-grid';

  const leftCol = document.createElement('div');
  leftCol.className = 'admin-list';

  const createCard = document.createElement('div');
  createCard.className = 'admin-row-card';
  const cTitle = document.createElement('h3');
  cTitle.className = 'bike-name';
  cTitle.textContent = 'Schedule Café / Studio Event';

  const evForm = document.createElement('form');
  evForm.className = 'guest-form';
  evForm.style.marginTop = '12px';

  const row1 = document.createElement('div');
  row1.className = 'field-pair';
  const dInp = document.createElement('input');
  dInp.type = 'date';
  dInp.className = 'text-input';
  dInp.required = true;
  dInp.value = state.overview.today;
  const tInp = document.createElement('input');
  tInp.type = 'text';
  tInp.className = 'text-input';
  tInp.placeholder = 'Start time (e.g. 18:30)';
  tInp.value = '18:30';
  row1.append(dInp, tInp);

  const titleInp = document.createElement('input');
  titleInp.type = 'text';
  titleInp.className = 'text-input';
  titleInp.required = true;
  titleInp.placeholder = 'Event title (e.g. Zwift Watch Party)';

  const row2 = document.createElement('div');
  row2.className = 'field-pair';
  const locSel = document.createElement('select');
  locSel.className = 'text-input';
  for (const loc of ['Studio l’Échappée', 'Café', 'Club Ride']) {
    const o = document.createElement('option');
    o.value = loc;
    o.textContent = loc;
    locSel.appendChild(o);
  }
  const visSel = document.createElement('select');
  visSel.className = 'text-input';
  for (const [val, txt] of [
    ['public', 'Public event'],
    ['internal', 'Internal / Staff & Leaders'],
  ]) {
    const o = document.createElement('option');
    o.value = val;
    o.textContent = txt;
    visSel.appendChild(o);
  }
  row2.append(locSel, visSel);

  const notesInp = document.createElement('input');
  notesInp.type = 'text';
  notesInp.className = 'text-input';
  notesInp.placeholder = 'Notes (catering, expected guests, brand partner)';

  const submitEv = document.createElement('button');
  submitEv.type = 'submit';
  submitEv.className = 'btn-yellow';
  submitEv.textContent = 'Add event to calendar';

  evForm.append(row1, titleInp, row2, notesInp, submitEv);
  evForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      event_date: dInp.value,
      start_time: tInp.value.trim(),
      title: titleInp.value.trim(),
      location: locSel.value,
      visibility: visSel.value,
      expected_guests: 40,
      notes: notesInp.value.trim(),
    };
    if (state.demoMode) {
      state.overview.events.push({ id: Date.now(), ...payload, status: 'scheduled' });
      renderDashboard();
      return;
    }
    const resp = await fetch('./api/admin/events', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      state.overview = (await resp.json()).overview;
      renderDashboard();
    }
  });
  createCard.append(cTitle, evForm);
  leftCol.appendChild(createCard);

  for (const ev of state.overview.events || []) {
    const card = document.createElement('div');
    card.className = `admin-row-card${ev.status === 'cancelled' ? ' is-dimmed' : ''}`;
    const head = document.createElement('div');
    head.className = 'admin-row-head';
    const info = document.createElement('div');
    const st = document.createElement('strong');
    st.textContent = `${ev.event_date}${ev.start_time ? ` · ${ev.start_time}` : ''} — ${ev.title}`;
    const sub = document.createElement('span');
    sub.className = 'admin-sub';
    sub.textContent = `${ev.location} · ${ev.visibility === 'internal' ? 'Internal' : 'Public'}${
      ev.expected_guests ? ` · ~${ev.expected_guests} guests` : ''
    }`;
    info.append(st, sub);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'size-btn';
    delBtn.textContent = 'Remove';
    delBtn.addEventListener('click', async () => {
      if (state.demoMode) {
        state.overview.events = state.overview.events.filter((x) => x.id !== ev.id);
        renderDashboard();
        return;
      }
      const resp = await fetch(`./api/admin/events/${ev.id}`, {
        method: 'DELETE',
        headers: apiHeaders(),
      });
      if (resp.ok) {
        state.overview = (await resp.json()).overview;
        renderDashboard();
      }
    });

    head.append(info, delBtn);
    const notes = document.createElement('p');
    notes.className = 'bike-spec-line';
    notes.style.marginTop = '8px';
    notes.textContent = ev.notes || '—';
    card.append(head, notes);
    leftCol.appendChild(card);
  }

  const rightCol = document.createElement('div');
  rightCol.className = 'admin-list';

  const inqHeader = document.createElement('h3');
  inqHeader.className = 'bike-name';
  inqHeader.textContent = 'Inbound Studio l’Échappée Inquiries';
  rightCol.appendChild(inqHeader);

  for (const inq of state.overview.studioInquiries) {
    const card = document.createElement('div');
    card.className = 'admin-row-card';
    const head = document.createElement('div');
    head.className = 'admin-row-head';
    const left = document.createElement('div');
    const st = document.createElement('strong');
    st.textContent = `${inq.name} · ${inq.guests} guests`;
    const sub = document.createElement('span');
    sub.className = 'admin-sub';
    sub.textContent = `${inq.email}${inq.event_date ? ` · Preferred: ${inq.event_date}` : ''}`;
    left.append(st, sub);

    const btns = document.createElement('div');
    btns.className = 'admin-head-right';

    const convertBtn = document.createElement('button');
    convertBtn.type = 'button';
    convertBtn.className = 'size-btn is-selected';
    convertBtn.textContent = 'Add to Events';
    convertBtn.addEventListener('click', async () => {
      const payload = {
        event_date: inq.event_date || state.overview.today,
        start_time: '18:00',
        title: inq.name,
        location: 'Studio l’Échappée',
        visibility: 'internal',
        expected_guests: inq.guests,
        notes: `${inq.email} — ${inq.notes || ''}`,
      };
      if (state.demoMode) {
        state.overview.events.push({ id: Date.now(), ...payload, status: 'scheduled' });
        inq.status = 'replied';
        renderDashboard();
        return;
      }
      await fetch('./api/admin/events', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify(payload),
      });
      const resp = await fetch(`./api/admin/studio-inquiries/${inq.id}`, {
        method: 'PATCH',
        headers: apiHeaders(),
        body: JSON.stringify({ status: 'replied' }),
      });
      if (resp.ok) {
        state.overview = (await resp.json()).overview;
        renderDashboard();
      }
    });

    const statusBtn = document.createElement('button');
    statusBtn.type = 'button';
    statusBtn.className = `size-btn${inq.status === 'replied' ? ' is-fit' : ''}`;
    statusBtn.textContent = inq.status === 'new' ? 'Mark replied' : 'Replied ✓';
    statusBtn.addEventListener('click', async () => {
      const next = inq.status === 'new' ? 'replied' : 'new';
      if (state.demoMode) {
        inq.status = next;
        renderDashboard();
        return;
      }
      const resp = await fetch(`./api/admin/studio-inquiries/${inq.id}`, {
        method: 'PATCH',
        headers: apiHeaders(),
        body: JSON.stringify({ status: next }),
      });
      if (resp.ok) {
        state.overview = (await resp.json()).overview;
        renderDashboard();
      }
    });

    btns.append(convertBtn, statusBtn);
    head.append(left, btns);
    const notes = document.createElement('p');
    notes.className = 'bike-spec-line';
    notes.style.marginTop = '8px';
    notes.textContent = inq.notes || '—';

    card.append(head, notes);
    rightCol.appendChild(card);
  }

  layout.append(leftCol, rightCol);
  panel.appendChild(layout);
}

function renderWorkshopPanel() {
  const panel = el('panelWorkshop');
  panel.replaceChildren();

  const grid = document.createElement('div');
  grid.className = 'fleet-grid';

  for (const bike of state.overview.fleet) {
    const card = document.createElement('article');
    card.className = 'admin-row-card';
    const h3 = document.createElement('h3');
    h3.className = 'bike-name';
    h3.textContent = bike.name;
    card.appendChild(h3);

    const szList = document.createElement('div');
    szList.className = 'workshop-size-list';

    for (const sz of bike.sizes) {
      const row = document.createElement('div');
      row.className = 'workshop-size-row';

      const info = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = `Size ${sz.code}`;
      const meta = document.createElement('span');
      meta.className = 'admin-sub';
      meta.textContent = `${sz.availableNow}/${sz.totalStock} bookable · ${sz.heldCount} in workshop`;
      info.append(strong, meta);

      const ctrls = document.createElement('div');
      ctrls.className = 'stepper-ctrls';

      const updateHold = async (nextHeld) => {
        if (state.demoMode) {
          sz.heldCount = nextHeld;
          sz.availableNow = Math.max(0, sz.totalStock - nextHeld);
          renderDashboard();
          return;
        }
        const resp = await fetch('./api/admin/workshop-hold', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ bikeId: bike.id, sizeCode: sz.code, heldCount: nextHeld, reason: 'Workshop service' }),
        });
        if (resp.ok) {
          state.overview = (await resp.json()).overview;
          renderDashboard();
        }
      };

      const minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.disabled = sz.heldCount <= 0;
      minus.title = 'Return bike from workshop to active stock';
      minus.addEventListener('click', () => updateHold(sz.heldCount - 1));

      const heldVal = document.createElement('strong');
      heldVal.textContent = `${sz.heldCount} held`;

      const plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.disabled = sz.heldCount >= sz.totalStock;
      plus.title = 'Hold 1 bike for workshop maintenance';
      plus.addEventListener('click', () => updateHold(sz.heldCount + 1));

      ctrls.append(minus, heldVal, plus);
      row.append(info, ctrls);
      szList.appendChild(row);
    }

    card.appendChild(szList);
    grid.appendChild(card);
  }
  panel.appendChild(grid);
}

function renderClubPanel() {
  const panel = el('panelClub');
  panel.replaceChildren();
  const club = state.overview.club;

  const toolsCard = document.createElement('div');
  toolsCard.className = 'admin-row-card admin-club-bar';

  const linkWrap = document.createElement('div');
  linkWrap.className = 'admin-club-links';
  const portalHref = state.overview.leaderPortalPath || './leaders.html?demo=1';
  const openPortal = document.createElement('a');
  openPortal.className = 'btn-yellow';
  openPortal.href = portalHref;
  openPortal.target = '_blank';
  openPortal.rel = 'noopener noreferrer';
  openPortal.textContent = 'Open Ride Leader Portal ↗';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn-ghost';
  copyBtn.textContent = 'Copy Leader Link';
  copyBtn.addEventListener('click', async () => {
    const abs = new URL(portalHref, window.location.href).href;
    try {
      await navigator.clipboard.writeText(abs);
      copyBtn.textContent = 'Copied ✓';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Leader Link';
      }, 1400);
    } catch {}
  });

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'btn-ghost';
  exportBtn.textContent = 'Export CSV (Sheets / Excel)';
  exportBtn.addEventListener('click', async () => {
    if (!state.demoMode) {
      const resp = await fetch('./api/admin/club/export.csv', { headers: apiHeaders() });
      if (!resp.ok) return;
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lepeloton-ride-leaders.csv';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const rows = [
      'Date,Pace,Title,Start Time,Leaders',
      ...club.upcomingRides.map(
        (r) => `${r.ride_date},${r.pace},"${r.title}",${r.start_time},"${(r.leaders || []).join(' / ')}"`
      ),
    ];
    const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lepeloton-ride-leaders.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  linkWrap.append(openPortal, copyBtn, exportBtn);

  const quickForms = document.createElement('div');
  quickForms.className = 'admin-club-forms';

  const addDateForm = document.createElement('form');
  addDateForm.className = 'admin-inline-edit';
  const dateInp = document.createElement('input');
  dateInp.type = 'date';
  dateInp.className = 'text-input';
  dateInp.required = true;
  dateInp.min = state.overview.today;
  const titleInp = document.createElement('input');
  titleInp.type = 'text';
  titleInp.className = 'text-input';
  titleInp.placeholder = 'New club ride title (e.g. Saturday Club Ride)';
  const addDateBtn = document.createElement('button');
  addDateBtn.type = 'submit';
  addDateBtn.className = 'size-btn is-selected';
  addDateBtn.textContent = 'Open date';
  addDateForm.append(dateInp, titleInp, addDateBtn);
  addDateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rideDate = dateInp.value;
    const title = titleInp.value.trim() || 'Club Ride';
    if (!rideDate) return;
    if (state.demoMode) {
      for (const [pace, st] of [
        ['Spicy', '08:30'],
        ['Medium', '09:00'],
        ['Mild', '09:30'],
      ]) {
        club.upcomingRides.unshift({ id: Date.now() + Math.random(), ride_date: rideDate, pace, title, start_time: st, leaders: [] });
      }
      renderDashboard();
      return;
    }
    const resp = await fetch('./api/admin/rides', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ ride_date: rideDate, title }),
    });
    if (resp.ok) {
      state.overview = (await resp.json()).overview;
      renderDashboard();
    }
  });

  const addLeaderForm = document.createElement('form');
  addLeaderForm.className = 'admin-inline-edit admin-roster-form';
  const rosterInp = document.createElement('input');
  rosterInp.type = 'text';
  rosterInp.className = 'text-input';
  rosterInp.required = true;
  rosterInp.placeholder = 'Add vetted ride leader to roster';
  const addLeaderBtn = document.createElement('button');
  addLeaderBtn.type = 'submit';
  addLeaderBtn.className = 'size-btn is-selected';
  addLeaderBtn.textContent = 'Add leader';
  addLeaderForm.append(rosterInp, addLeaderBtn);
  addLeaderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = rosterInp.value.trim();
    if (name.length < 2) return;
    if (state.demoMode) {
      if (!club.leaders.includes(name)) club.leaders.push(name);
      rosterInp.value = '';
      renderDashboard();
      return;
    }
    const resp = await fetch('./api/admin/leaders', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ name }),
    });
    if (resp.ok) {
      state.overview = (await resp.json()).overview;
      renderDashboard();
    }
  });

  quickForms.append(addDateForm, addLeaderForm);
  toolsCard.append(linkWrap, quickForms);
  panel.appendChild(toolsCard);

  const layout = document.createElement('div');
  layout.className = 'cafe-studio-grid';

  const leftCol = document.createElement('div');
  leftCol.className = 'admin-list';

  for (const r of club.upcomingRides) {
    const card = document.createElement('div');
    card.className = 'admin-row-card';

    const top = document.createElement('div');
    top.className = 'admin-row-head';
    const title = document.createElement('strong');
    title.textContent = `${r.ride_date} · ${r.pace} (${r.start_time || 'TBD'})`;
    const sub = document.createElement('span');
    sub.className = `stock-caption${r.leaders.length === 0 ? ' is-empty' : ''}`;
    sub.textContent = r.leaders.length ? `Leaders: ${r.leaders.join(', ')}` : 'Needs leader';
    top.append(title, sub);

    const editForm = document.createElement('form');
    editForm.className = 'admin-inline-edit';
    const timeInp = document.createElement('input');
    timeInp.type = 'text';
    timeInp.className = 'text-input';
    timeInp.value = r.start_time || '';
    timeInp.placeholder = '09:00';
    const leadersInp = document.createElement('input');
    leadersInp.type = 'text';
    leadersInp.className = 'text-input';
    leadersInp.value = r.leaders.join(', ');
    leadersInp.placeholder = 'Leaders (comma-separated)';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'size-btn is-selected';
    saveBtn.textContent = 'Save';

    editForm.append(timeInp, leadersInp, saveBtn);
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nextLeaders = leadersInp.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (state.demoMode) {
        r.start_time = timeInp.value.trim();
        r.leaders = nextLeaders;
        renderDashboard();
        return;
      }
      const resp = await fetch(`./api/admin/rides/${r.id}`, {
        method: 'PATCH',
        headers: apiHeaders(),
        body: JSON.stringify({ start_time: timeInp.value.trim(), leaders: nextLeaders }),
      });
      if (resp.ok) {
        state.overview = (await resp.json()).overview;
        renderDashboard();
      }
    });

    card.append(top, editForm);
    leftCol.appendChild(card);
  }

  const rightCol = document.createElement('div');
  rightCol.className = 'admin-list';

  const notesCard = document.createElement('div');
  notesCard.className = 'admin-row-card';
  const notesTitle = document.createElement('h3');
  notesTitle.className = 'bike-name';
  notesTitle.textContent = 'Club Planning Notes (visible on /leaders)';
  const ta = document.createElement('textarea');
  ta.className = 'text-area';
  ta.rows = 6;
  ta.value = club.planningNotes.content || '';
  const saveNotesBtn = document.createElement('button');
  saveNotesBtn.type = 'button';
  saveNotesBtn.className = 'btn-yellow';
  saveNotesBtn.style.marginTop = '10px';
  saveNotesBtn.textContent = 'Save notes';
  saveNotesBtn.addEventListener('click', async () => {
    if (state.demoMode) {
      club.planningNotes.content = ta.value;
      saveNotesBtn.textContent = 'Saved ✓';
      setTimeout(() => {
        saveNotesBtn.textContent = 'Save notes';
      }, 1400);
      return;
    }
    const resp = await fetch('./api/admin/planning-notes', {
      method: 'PUT',
      headers: apiHeaders(),
      body: JSON.stringify({ content: ta.value }),
    });
    if (resp.ok) {
      state.overview = (await resp.json()).overview;
      saveNotesBtn.textContent = 'Saved ✓';
      setTimeout(() => renderDashboard(), 900);
    }
  });
  notesCard.append(notesTitle, ta, saveNotesBtn);

  const wlCard = document.createElement('div');
  wlCard.className = 'admin-row-card';
  const wlTitle = document.createElement('h3');
  wlTitle.className = 'bike-name';
  wlTitle.textContent = 'Leader Workload';
  const dl = document.createElement('dl');
  dl.className = 'ledger-list';
  for (const w of club.workload.slice(0, 12)) {
    const row = document.createElement('div');
    row.className = 'ledger-row';
    const dt = document.createElement('dt');
    dt.textContent = w.name;
    const dd = document.createElement('dd');
    dd.textContent = `${w.upcoming} upcoming · ${w.total} total`;
    row.append(dt, dd);
    dl.appendChild(row);
  }
  wlCard.append(wlTitle, dl);

  const actCard = document.createElement('div');
  actCard.className = 'admin-row-card';
  const actTitle = document.createElement('h3');
  actTitle.className = 'bike-name';
  actTitle.textContent = 'Recent Leader Activity';
  const actList = document.createElement('ul');
  actList.className = 'admin-prep-items';
  for (const ev of (club.recentActivity || []).slice(0, 10)) {
    const li = document.createElement('li');
    li.textContent = `${ev.created_at.slice(0, 10)} · ${ev.actor}: ${ev.details}`;
    actList.appendChild(li);
  }
  if (!club.recentActivity?.length) {
    const li = document.createElement('li');
    li.textContent = 'Leader sign-ups & withdrawals appear here in real time.';
    actList.appendChild(li);
  }
  actCard.append(actTitle, actList);

  rightCol.append(notesCard, wlCard, actCard);
  layout.append(leftCol, rightCol);
  panel.appendChild(layout);
}

function renderDashboard() {
  if (!state.overview) return;
  renderKpis();
  renderTabSeg();
  renderPrepPanel();
  renderFinancePanel();
  renderEventsPanel();
  renderWorkshopPanel();
  renderClubPanel();
}

el('adminRefreshBtn').addEventListener('click', loadOverview);
window.addEventListener('resize', syncActiveTab);
document.fonts?.ready?.then(syncActiveTab);
loadOverview();
