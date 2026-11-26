import { BIKES, PEDAL_OPTIONS, TOURS } from './data.js';

const el = (id) => document.getElementById(id);
const urlParams = new URLSearchParams(window.location.search);
const keyParam = urlParams.get('key') || '';

const state = {
  tab: 'prep',
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
    { value: 'workshop', label: 'Workshop Stock' },
    { value: 'club', label: 'Cycling Club' },
    { value: 'studio', label: 'Studio Inquiries' },
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
  el('panelWorkshop').hidden = state.tab !== 'workshop';
  el('panelClub').hidden = state.tab !== 'club';
  el('panelStudio').hidden = state.tab !== 'studio';
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

  return {
    today,
    leaderPortalPath: './leaders.html?demo=1',
    bookings: [
      {
        id: 1,
        ref_code: 'LPC-9F42A1',
        status: 'confirmed',
        customer_name: 'Claire Moreau',
        customer_email: 'claire@example.com',
        customer_phone: '+33 6 12 34 56 78',
        total_cents: 16500,
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
          },
        ],
        tours: [
          {
            tour_id: 'hidden_paris',
            tour_date: today,
            tour_time: '14:30',
            adults: 2,
            kids: 0,
          },
        ],
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
  if (!window.location.hostname.endsWith('.github.io')) try {
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

  state.demoMode = true;
  el('adminStatusPill').textContent = 'Static Preview Mode';
  state.overview = await buildStaticDemoOverview();
  renderDashboard();
}

function renderKpis() {
  const ov = state.overview;
  const wrap = el('adminKpis');
  wrap.replaceChildren();

  const activeBookings = ov.bookings.filter((b) => b.status !== 'cancelled');
  const heldTotal = ov.fleet.reduce(
    (sum, b) => sum + b.sizes.reduce((s2, sz) => s2 + sz.heldCount, 0),
    0
  );
  const needsLeaderCount = ov.club.upcomingRides.filter((r) => (r.leaders || []).length === 0).length;
  const newInquiries = ov.studioInquiries.filter((i) => i.status === 'new').length;

  const items = [
    { label: 'Active Bookings', value: String(activeBookings.length) },
    { label: 'Bikes on Workshop Hold', value: String(heldTotal) },
    { label: 'Club Groups Needing Leader', value: String(needsLeaderCount) },
    { label: 'Open Studio Leads', value: String(newInquiries) },
  ];

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'admin-kpi-card';
    const sp = document.createElement('span');
    sp.textContent = item.label;
    const st = document.createElement('strong');
    st.textContent = item.value;
    card.append(sp, st);
    wrap.appendChild(card);
  }
}

function renderPrepPanel() {
  const panel = el('panelPrep');
  panel.replaceChildren();
  const bookings = state.overview.bookings;

  if (bookings.length === 0) {
    const p = document.createElement('p');
    p.className = 'fleet-meta';
    p.textContent = 'No reservations yet. Bookings from the storefront appear here immediately.';
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
    const amt = document.createElement('strong');
    amt.textContent = fmtEuroCents(b.total_cents);

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

    right.append(statusBadge, amt, toggleBtn);
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
  notesTitle.textContent = 'Club Planning Notes';
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

function renderStudioPanel() {
  const panel = el('panelStudio');
  panel.replaceChildren();
  const list = state.overview.studioInquiries;

  if (list.length === 0) {
    const p = document.createElement('p');
    p.className = 'fleet-meta';
    p.textContent = 'No studio inquiries yet.';
    panel.appendChild(p);
    return;
  }

  const stack = document.createElement('div');
  stack.className = 'admin-list';

  for (const inq of list) {
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

    head.append(left, statusBtn);
    const notes = document.createElement('p');
    notes.className = 'bike-spec-line';
    notes.textContent = inq.notes || '—';

    card.append(head, notes);
    stack.appendChild(card);
  }
  panel.appendChild(stack);
}

function renderDashboard() {
  if (!state.overview) return;
  renderKpis();
  renderTabSeg();
  renderPrepPanel();
  renderWorkshopPanel();
  renderClubPanel();
  renderStudioPanel();
}

el('adminRefreshBtn').addEventListener('click', loadOverview);
window.addEventListener('resize', syncActiveTab);
document.fonts?.ready?.then(syncActiveTab);
loadOverview();
