import {
  BIKES,
  CAFE_MENU,
  CATEGORIES,
  CLUB_PACES,
  DURATION_PRESETS,
  HEIGHT_OPTIONS,
  I18N,
  PEDAL_OPTIONS,
  STORE,
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

function parisDateOffset(daysOffset = 0) {
  const d = new Date(Date.now() + daysOffset * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

const initParams = new URLSearchParams(window.location.search);
const initLang = initParams.get('lang') === 'fr' ? 'fr' : 'en';
const initCatRaw = initParams.get('category');
const initCatObj = CATEGORIES.find((c) => c.id === initCatRaw || c.brmCategoryId === initCatRaw);

const savedLeader = (() => {
  try {
    return localStorage.getItem('peloton_leader_name') || '';
  } catch {
    return '';
  }
})();

const state = {
  lang: initLang,
  backendMode: 'static',
  stripeEnabled: false,
  liveFleetStock: null,
  liveTourSpots: null,
  activeChapter: 0,
  pickupDate: parisDateOffset(1),
  pickupTime: '09:00',
  durationKey: '1d',
  customDays: 4,
  heightFilter: 'all',
  category: initCatObj ? initCatObj.id : 'all',
  cardSizes: {},
  tourDate: parisDateOffset(2),
  tourSelections: Object.fromEntries(
    TOURS.map((tour) => [tour.id, { slot: tour.slots[0], adults: tour.pricingType === 'private_group' ? 4 : 2, kids: 0 }])
  ),
  clubDate: parisDateOffset(3),
  clubUpcomingDates: [],
  clubRides: [],
  clubLeaders: [],
  clubSeedCache: null,
  leaderName: savedLeader,
  bag: [],
  drawerMode: 'bag',
  confirmedBooking: null,
  checkoutError: '',
  checkoutBusy: false,
  rollPrices: false,
  modal: {
    bikeId: null,
    sizeCode: null,
    pedalId: null,
    extraIds: new Set(),
    childAgeNote: '',
    riderName: '',
  },
  lastTriggerEl: null,
};

const el = (id) => document.getElementById(id);
const segRegistry = new Map();

function t() {
  return I18N[state.lang];
}

function fmtEuro(val) {
  const num = Number(val);
  const rounded = Number.isInteger(num) ? String(num) : num.toFixed(2);
  return state.lang === 'fr' ? `${rounded.replace('.', ',')} €` : `€${rounded}`;
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function syncGlidingSegThumb(container, activeVal) {
  const meta = segRegistry.get(container);
  if (!meta) return;
  const { base, overlay, buttons } = meta;
  let activeBtn = null;
  for (const [val, btn] of buttons.entries()) {
    const isActive = val === activeVal;
    btn.setAttribute('aria-checked', String(isActive));
    if (isActive) activeBtn = btn;
  }
  if (!activeBtn) return;
  meta.activeVal = activeVal;

  const measure = () => {
    const totalW = base.offsetWidth;
    if (!totalW) return;
    const left = activeBtn.offsetLeft;
    const right = Math.max(0, totalW - (left + activeBtn.offsetWidth));
    overlay.style.setProperty('--cl', `${left}px`);
    overlay.style.setProperty('--cr', `${right}px`);
  };
  requestAnimationFrame(measure);
}

function renderGlidingSeg(container, options, activeVal, onSelect) {
  const signature = options.map((o) => `${o.value}:${o.label}`).join('|');
  const existing = segRegistry.get(container);
  if (existing && existing.signature === signature) {
    existing.onSelect = onSelect;
    syncGlidingSegThumb(container, activeVal);
    return;
  }

  container.replaceChildren();
  const base = document.createElement('div');
  base.className = 'seg-base';
  const overlay = document.createElement('div');
  overlay.className = 'seg-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const buttons = new Map();
  const meta = { signature, base, overlay, buttons, activeVal, onSelect };
  segRegistry.set(container, meta);

  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(opt.value === activeVal));
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      meta.onSelect(opt.value);
      btn.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
    });
    base.appendChild(btn);
    buttons.set(opt.value, btn);

    const mirror = document.createElement('span');
    mirror.textContent = opt.label;
    overlay.appendChild(mirror);
  }

  container.append(base, overlay);
  syncGlidingSegThumb(container, activeVal);
}

const segResizeObserver = new ResizeObserver(() => {
  for (const [container, meta] of segRegistry.entries()) {
    syncGlidingSegThumb(container, meta.activeVal);
  }
});

function getBaseAvailableStock(bike, sizeObj) {
  if (state.liveFleetStock && state.liveFleetStock[bike.id]?.[sizeObj.code] != null) {
    return state.liveFleetStock[bike.id][sizeObj.code];
  }
  return sizeObj.stock;
}

function getStockUsedInBag(bikeId, sizeCode) {
  return state.bag.reduce(
    (sum, item) => (item.kind === 'bike' && item.bikeId === bikeId && item.sizeCode === sizeCode ? sum + 1 : sum),
    0
  );
}

function getRemainingStock(bike, sizeObj) {
  return Math.max(0, getBaseAvailableStock(bike, sizeObj) - getStockUsedInBag(bike.id, sizeObj.code));
}

function getTourSpotsRemaining(tour, slot) {
  const base =
    state.liveTourSpots && state.liveTourSpots[tour.id]?.[slot] != null
      ? state.liveTourSpots[tour.id][slot]
      : tour.capacity;

  const inBag = state.bag.reduce((sum, item) => {
    if (item.kind !== 'tour' || item.tourId !== tour.id || item.tourDate !== state.tourDate || item.tourTime !== slot) {
      return sum;
    }
    return sum + (tour.pricingType === 'private_group' ? tour.capacity : item.adults + item.kids);
  }, 0);

  return Math.max(0, base - inBag);
}

function getPreferredCardSize(bike) {
  const explicit = state.cardSizes[bike.id];
  if (explicit) {
    const found = bike.sizes.find((s) => s.code === explicit);
    if (found) return found;
  }
  const heightMatches = getMatchingSizesForHeight(bike, state.heightFilter);
  const availableMatch = heightMatches.find((s) => getRemainingStock(bike, s) > 0);
  if (availableMatch) return availableMatch;
  return bike.sizes.find((s) => getRemainingStock(bike, s) > 0) || bike.sizes[0];
}

function getEffectiveDaysCount(durationKey = state.durationKey, customDays = state.customDays) {
  if (durationKey === '4h') return 0.5;
  const preset = DURATION_PRESETS.find((p) => p.key === durationKey);
  return preset ? preset.days : Math.max(1, Math.min(30, Number(customDays) || 4));
}

function formatDurationPeriod(bike) {
  const txt = t();
  if (state.durationKey === '4h') return txt.halfDayUnit;
  const days = getEffectiveDaysCount();
  if (days === 1) return txt.perDayUnit;
  const price = computeBikePrice(bike, state.durationKey, state.customDays);
  const perDay = Math.round((price / days) * 10) / 10;
  return state.lang === 'fr'
    ? `${days} j (${fmtEuro(perDay)}/j)`
    : `${days} days (${fmtEuro(perDay)}/day)`;
}

function getItemTotal(item) {
  if (item.kind === 'tour') {
    const tour = TOURS.find((x) => x.id === item.tourId);
    return computeTourPrice(tour, item.adults, item.kids);
  }
  const bike = BIKES.find((b) => b.id === item.bikeId);
  const base = computeBikePrice(bike, state.durationKey, state.customDays);
  const pedal = PEDAL_OPTIONS.find((p) => p.id === item.pedalId)?.price || 0;
  const extrasSum = (item.extraIds || []).reduce((sum, eid) => {
    const found = getAvailableExtrasForBike(bike).find((ex) => ex.id === eid);
    return sum + (found ? found.price : 0);
  }, 0);
  return base + pedal + extrasSum;
}

async function refreshLiveAvailability() {
  if (state.backendMode !== 'live') return;
  try {
    const qs = new URLSearchParams({
      pickupDate: state.pickupDate,
      pickupTime: state.pickupTime,
      durationKey: state.durationKey,
      customDays: String(state.customDays),
      tourDate: state.tourDate,
    });
    const resp = await fetch(`./api/availability?${qs.toString()}`);
    if (!resp.ok) return;
    const data = await resp.json();
    state.liveFleetStock = data.fleetStock;
    state.liveTourSpots = data.tourSpots;
    renderBikeGrid();
    renderToursSection();
    syncBagIndicators();
  } catch {}
}

function buildStaticRidesForDate(seed, dateStr) {
  const existing = (seed.rides || []).filter((r) => r.ride_date === dateStr);
  const order = { Spicy: 1, Medium: 2, Mild: 3 };
  let localEdits = {};
  try {
    localEdits = JSON.parse(localStorage.getItem('peloton_static_club_edits') || '{}');
  } catch {}

  const baseList =
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

  return baseList
    .map((r) => {
      const override = localEdits[`${dateStr}::${r.pace}`];
      return {
        ...r,
        effective_status: r.status === 'cancelled' ? 'cancelled' : 'open',
        leaders: override ? override : r.leaders,
      };
    })
    .sort((a, b) => (order[a.pace] || 9) - (order[b.pace] || 9));
}

async function loadInitialBackendOrStatic() {
  const today = parisDateOffset(0);
  const isStaticPagesHost = window.location.hostname.endsWith('.github.io');
  if (!isStaticPagesHost) try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2200);
    const qs = new URLSearchParams({
      pickupDate: state.pickupDate,
      pickupTime: state.pickupTime,
      durationKey: state.durationKey,
      customDays: String(state.customDays),
      tourDate: state.tourDate,
    });
    const resp = await fetch(`./api/bootstrap?${qs.toString()}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (resp.ok) {
      const data = await resp.json();
      state.backendMode = 'live';
      state.stripeEnabled = Boolean(data.stripeEnabled);
      state.liveFleetStock = data.fleetStock;
      state.liveTourSpots = data.tourSpots;
      state.clubDate = data.club.date;
      state.clubUpcomingDates = data.club.upcomingDates || [];
      state.clubRides = data.club.rides || [];
      state.clubLeaders = data.club.leaders || [];

      const cancelledRef = initParams.get('booking_cancelled');
      if (cancelledRef) {
        await fetch(`./api/bookings/${encodeURIComponent(cancelledRef)}/cancel-pending`, { method: 'POST' });
        await refreshLiveAvailability();
      }

      const refFromUrl = initParams.get('booking_ref');
      if (refFromUrl) {
        const sessionParam = initParams.get('session_id') ? `?session_id=${encodeURIComponent(initParams.get('session_id'))}` : '';
        const bResp = await fetch(`./api/bookings/${encodeURIComponent(refFromUrl)}${sessionParam}`);
        if (bResp.ok) {
          const bData = await bResp.json();
          state.confirmedBooking = bData.booking;
          state.drawerMode = 'confirmed';
          openBagDrawer();
        }
      }
      renderAll();
      return;
    }
  } catch {}

  state.backendMode = 'static';
  const staffLink = el('staffOpsLink');
  if (staffLink) staffLink.href = './admin.html?demo=1';

  try {
    const seedResp = await fetch('./seed-club.json');
    if (seedResp.ok) {
      const seed = await seedResp.json();
      state.clubSeedCache = seed;
      state.clubLeaders = seed.leaders || [];
      const seen = new Set();
      const upcoming = [];
      for (const r of seed.rides || []) {
        if (r.ride_date >= today && r.status !== 'cancelled' && !seen.has(r.ride_date)) {
          seen.add(r.ride_date);
          upcoming.push({ ride_date: r.ride_date, title: r.title });
          if (upcoming.length >= 10) break;
        }
      }
      state.clubUpcomingDates = upcoming;
      state.clubDate = upcoming[0]?.ride_date || state.clubDate;
      state.clubRides = buildStaticRidesForDate(seed, state.clubDate);
    }
  } catch {}

  renderAll();
}

function setActiveStoryChapter(index) {
  state.activeChapter = index;
  const chapters = el('storyChapters').querySelectorAll('.story-chapter');
  const photos = el('storyFrame').querySelectorAll('.story-photo');
  chapters.forEach((node, idx) => node.classList.toggle('is-active', idx === index));
  photos.forEach((img, idx) => img.classList.toggle('is-active', idx === index));
  el('storyRailFill').style.setProperty('--rail-progress', String((index + 1) / STORY_CHAPTERS.length));
}

function renderStorySection() {
  const chaptersWrap = el('storyChapters');
  const frameWrap = el('storyFrame');
  chaptersWrap.replaceChildren();
  frameWrap.replaceChildren();

  STORY_CHAPTERS.forEach((ch, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `story-chapter${idx === state.activeChapter ? ' is-active' : ''}`;
    btn.dataset.index = String(idx);

    const time = document.createElement('span');
    time.className = 'chapter-time';
    time.textContent = ch.time[state.lang];

    const h3 = document.createElement('h3');
    h3.className = 'chapter-title';
    h3.textContent = ch.title[state.lang];

    const p = document.createElement('p');
    p.className = 'chapter-body';
    p.textContent = ch.body[state.lang];

    btn.append(time, h3, p);
    btn.addEventListener('click', () => setActiveStoryChapter(idx));
    chaptersWrap.appendChild(btn);

    const img = document.createElement('img');
    img.className = `story-photo${idx === state.activeChapter ? ' is-active' : ''}`;
    img.src = ch.image;
    img.alt = ch.alt[state.lang];
    img.loading = idx === 0 ? 'eager' : 'lazy';
    frameWrap.appendChild(img);
  });

  setActiveStoryChapter(state.activeChapter);
  observeStoryChapters();
}

let storyObserver = null;
function observeStoryChapters() {
  if (storyObserver) storyObserver.disconnect();
  storyObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveStoryChapter(Number(entry.target.dataset.index));
        }
      }
    },
    { rootMargin: '-32% 0px -36% 0px', threshold: 0.2 }
  );
  for (const ch of el('storyChapters').querySelectorAll('.story-chapter')) {
    storyObserver.observe(ch);
  }
}

function syncStaticLabels() {
  const txt = t();
  document.documentElement.lang = state.lang;
  el('navStoryLink').textContent = txt.navStory;
  el('navFleetLink').textContent = txt.navFleet;
  el('navToursLink').textContent = txt.navTours;
  el('navClubLink').textContent = txt.navClub;
  el('navCafeLink').textContent = txt.navCafe;
  el('navBagLabel').textContent = txt.bagLabel;

  el('heroKicker').textContent = txt.heroKicker;
  el('heroTitle').replaceChildren(
    ...txt.heroTitle
      .split('\n')
      .flatMap((line, i) => (i ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]))
  );
  el('heroSub').textContent = txt.heroSub;
  el('heroCtaPrimary').textContent = txt.heroCtaPrimary;
  el('heroCtaSecondary').textContent = txt.heroCtaSecondary;

  el('fleetHeading').textContent = txt.fleetTitle;
  el('fleetMeta').textContent = txt.fleetMeta;
  el('lblPickupDate').textContent = txt.pickupDate;
  el('lblPickupTime').textContent = txt.pickupTime;
  el('lblDuration').textContent = txt.duration;
  el('lblDaysUnit').textContent = txt.daysUnit;
  el('lblReturnPreview').textContent = txt.returnLabel;
  el('lblHeight').textContent = txt.heightLabel;

  el('toursEyebrow').textContent = txt.toursEyebrow;
  el('toursHeading').textContent = txt.toursTitle;
  el('toursMeta').textContent = txt.toursMeta;
  el('lblTourDate').textContent = txt.tourDateLabel;

  el('clubEyebrow').textContent = txt.clubEyebrow;
  el('clubHeading').textContent = txt.clubTitle;
  el('clubMeta').textContent = txt.clubMeta;
  el('lblClubDate').textContent = txt.clubDateLabel;
  el('lblClubUpcoming').textContent = txt.clubUpcomingLabel;
  el('lblClubLeader').textContent = txt.clubLeaderInputLabel;
  el('clubLeaderInput').placeholder = txt.clubLeaderPlaceholder;

  el('cafeEyebrow').textContent = txt.cafeEyebrow;
  el('cafeHeading').textContent = txt.cafeTitle;
  el('cafeMenuHeading').textContent = txt.cafeMenuHeading;
  el('cafeDrinksHeading').textContent = txt.cafeDrinksHeading;
  el('cafeFoodHeading').textContent = txt.cafeFoodHeading;
  el('studioHeading').textContent = txt.studioHeading;
  el('studioFormTitle').textContent = txt.studioFormTitle;
  el('lblStudioName').textContent = txt.studioName;
  el('lblStudioEmail').textContent = txt.studioEmail;
  el('lblStudioDate').textContent = txt.studioDate;
  el('lblStudioGuests').textContent = txt.studioGuests;
  el('lblStudioNotes').textContent = txt.studioNotes;
  el('studioSubmitBtn').textContent = txt.studioSubmit;

  el('clubhouseEyebrow').textContent = txt.clubhouseEyebrow;
  el('clubhouseHeading').textContent = txt.clubhouseTitle;
  el('clubhouseBody').textContent = txt.clubhouseBody;
  el('clubhouseAddressTitle').textContent = txt.clubhouseAddressTitle;
  el('clubhouseHoursTitle').textContent = txt.clubhouseHoursTitle;
  el('clubhouseHoursBody').textContent = txt.clubhouseHoursBody;
  el('staffOpsLink').textContent = txt.staffLink;

  el('bagDrawerTitle').textContent = txt.bagTitle;

  renderGlidingSeg(
    el('langSeg'),
    [
      { value: 'en', label: 'EN' },
      { value: 'fr', label: 'FR' },
    ],
    state.lang,
    (val) => {
      if (state.lang === val) return;
      state.lang = val;
      renderAll();
      if (!el('bikeBackdrop').hidden) renderBikeModal();
      if (!el('bagBackdrop').hidden) renderBagDrawer();
    }
  );
}

function syncDeckControls() {
  const txt = t();
  const dateInput = el('pickupDate');
  const today = parisDateOffset(0);
  dateInput.min = today;
  if (state.pickupDate < today) state.pickupDate = today;
  dateInput.value = state.pickupDate;

  const slots = getPickupSlots(state.pickupDate);
  const timeSelect = el('pickupTime');
  if (!slots.includes(state.pickupTime)) {
    state.pickupTime = slots[0] || '09:00';
  }
  timeSelect.replaceChildren();
  for (const slot of slots) {
    const opt = document.createElement('option');
    opt.value = slot;
    opt.textContent = slot;
    opt.selected = slot === state.pickupTime;
    timeSelect.appendChild(opt);
  }

  renderGlidingSeg(
    el('durationSeg'),
    [
      ...DURATION_PRESETS.map((p) => ({ value: p.key, label: p.label[state.lang] })),
      { value: 'custom', label: txt.customDays },
    ],
    state.durationKey,
    (val) => {
      state.durationKey = val;
      state.rollPrices = true;
      syncDeckControls();
      renderBikeGrid();
      syncBagIndicators();
      refreshLiveAvailability();
    }
  );

  el('customDaysWrap').hidden = state.durationKey !== 'custom';
  el('customDaysInput').value = String(state.customDays);

  const ret = computeReturnInfo(state.pickupDate, state.pickupTime, state.durationKey, state.customDays);
  el('returnValue').textContent = `${ret.dateStr} · ${ret.timeStr}`;

  renderGlidingSeg(
    el('categorySeg'),
    CATEGORIES.map((c) => {
      const count = c.id === 'all' ? BIKES.length : BIKES.filter((b) => b.category === c.id).length;
      return { value: c.id, label: `${c.label[state.lang]} (${count})` };
    }),
    state.category,
    (val) => {
      state.category = val;
      renderBikeGrid();
    }
  );

  renderGlidingSeg(
    el('heightSeg'),
    HEIGHT_OPTIONS.map((h) => ({ value: h.id, label: h.short[state.lang] })),
    state.heightFilter,
    (val) => {
      state.heightFilter = val;
      renderBikeGrid();
    }
  );
}

function renderBikeGrid() {
  const txt = t();
  const grid = el('bikeGrid');
  grid.replaceChildren();

  const shouldRoll = state.rollPrices;
  state.rollPrices = false;

  const list = state.category === 'all' ? [...BIKES] : BIKES.filter((b) => b.category === state.category);
  if (state.heightFilter !== 'all') {
    list.sort((a, b) => {
      const aFit = getMatchingSizesForHeight(a, state.heightFilter).some((s) => getRemainingStock(a, s) > 0) ? 0 : 1;
      const bFit = getMatchingSizesForHeight(b, state.heightFilter).some((s) => getRemainingStock(b, s) > 0) ? 0 : 1;
      return aFit - bFit;
    });
  }

  for (const bike of list) {
    const fittingSizes = getMatchingSizesForHeight(bike, state.heightFilter);
    const hasHeightMatch =
      state.heightFilter === 'all' || fittingSizes.some((s) => getRemainingStock(bike, s) > 0);
    const selectedSize = getPreferredCardSize(bike);
    const remaining = getRemainingStock(bike, selectedSize);
    const totalLeft = bike.sizes.reduce((sum, s) => sum + getRemainingStock(bike, s), 0);
    const price = computeBikePrice(bike, state.durationKey, state.customDays);

    const card = document.createElement('article');
    card.className = `bike-card${hasHeightMatch ? '' : ' is-dimmed'}`;

    const stage = document.createElement('div');
    stage.className = 'bike-stage';

    const img = document.createElement('img');
    img.src = bike.image;
    img.alt = bike.name;
    img.loading = 'lazy';
    img.setAttribute('referrerpolicy', 'no-referrer');

    const shadow = document.createElement('div');
    shadow.className = 'wheel-shadow';

    stage.append(img, shadow);

    if (!hasHeightMatch) {
      const warn = document.createElement('span');
      warn.className = 'stage-badge is-warn';
      warn.textContent = txt.filterNoSize;
      stage.appendChild(warn);
    } else if (bike.badge) {
      const badge = document.createElement('span');
      badge.className = 'stage-badge';
      badge.textContent = bike.badge[state.lang];
      stage.appendChild(badge);
    }

    const content = document.createElement('div');
    content.className = 'bike-content';

    const headRow = document.createElement('div');
    headRow.className = 'bike-header-row';

    const titleCol = document.createElement('div');
    const h3 = document.createElement('h3');
    h3.className = 'bike-name';
    h3.textContent = bike.name;
    const sub = document.createElement('p');
    sub.className = 'bike-sub';
    sub.textContent = bike.tagline[state.lang];
    titleCol.append(h3, sub);

    const priceCol = document.createElement('div');
    priceCol.className = 'price-col';
    const fig = document.createElement('span');
    fig.className = `price-figure${shouldRoll ? ' is-rolling' : ''}`;
    fig.textContent = fmtEuro(price);
    const per = document.createElement('span');
    per.className = 'price-period';
    per.textContent = formatDurationPeriod(bike);
    priceCol.append(fig, per);

    headRow.append(titleCol, priceCol);

    const specLine = document.createElement('p');
    specLine.className = 'bike-spec-line';
    specLine.textContent = bike.summaryLine[state.lang];

    const fitRow = document.createElement('div');
    fitRow.className = 'bike-fit-row';

    const pills = document.createElement('div');
    pills.className = 'size-pills';
    for (const sz of bike.sizes) {
      const szLeft = getRemainingStock(bike, sz);
      const isFit = state.heightFilter !== 'all' && fittingSizes.some((f) => f.code === sz.code);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `size-btn${sz.code === selectedSize.code ? ' is-selected' : ''}${isFit ? ' is-fit' : ''}`;
      btn.textContent = sz.label;
      btn.disabled = szLeft === 0;
      btn.title = `${sz.heightLabel} · ${txt.inStock(szLeft)}`;
      btn.addEventListener('click', () => {
        state.cardSizes[bike.id] = sz.code;
        renderBikeGrid();
      });
      pills.appendChild(btn);
    }

    const stockCap = document.createElement('span');
    stockCap.className = `stock-caption${remaining === 0 ? ' is-empty' : ''}`;
    stockCap.textContent =
      remaining > 0
        ? `${selectedSize.label} (${selectedSize.heightLabel}) · ${txt.inStock(remaining)}`
        : txt.noneLeft;

    fitRow.append(pills, stockCap);

    const foot = document.createElement('div');
    foot.className = 'bike-foot';
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'btn-yellow';
    cta.disabled = totalLeft === 0;
    cta.textContent = totalLeft > 0 ? txt.configureBtn : txt.soldOutBtn;
    cta.addEventListener('click', (ev) => openBikeModal(bike.id, selectedSize.code, ev.currentTarget));
    foot.appendChild(cta);

    content.append(headRow, specLine, fitRow, foot);
    card.append(stage, content);
    grid.appendChild(card);
  }
}

function renderToursSection() {
  const txt = t();
  const today = parisDateOffset(0);
  const dateInput = el('tourDateInput');
  dateInput.min = today;
  if (state.tourDate < today) state.tourDate = today;
  dateInput.value = state.tourDate;

  const grid = el('toursGrid');
  grid.replaceChildren();

  for (const tour of TOURS) {
    const sel = state.tourSelections[tour.id];
    const spotsLeft = getTourSpotsRemaining(tour, sel.slot);
    const totalRiders = sel.adults + sel.kids;
    const price = computeTourPrice(tour, sel.adults, sel.kids);
    const canBook =
      totalRiders > 0 &&
      (tour.pricingType === 'private_group' ? spotsLeft > 0 && totalRiders <= tour.capacity : totalRiders <= spotsLeft);

    const card = document.createElement('article');
    card.className = 'tour-card';

    const media = document.createElement('div');
    media.className = 'tour-media';
    const img = document.createElement('img');
    img.src = tour.image;
    img.alt = tour.name[state.lang];
    img.loading = 'lazy';
    const durBadge = document.createElement('span');
    durBadge.className = 'tour-dur-badge';
    durBadge.textContent = tour.duration[state.lang];
    media.append(img, durBadge);

    const body = document.createElement('div');
    body.className = 'tour-body';

    const top = document.createElement('div');
    top.className = 'bike-header-row';
    const titleWrap = document.createElement('div');
    const h3 = document.createElement('h3');
    h3.className = 'tour-title';
    h3.textContent = tour.name[state.lang];
    const inc = document.createElement('p');
    inc.className = 'tour-inc';
    inc.textContent = tour.includes[state.lang];
    titleWrap.append(h3, inc);

    const priceWrap = document.createElement('div');
    priceWrap.className = 'price-col';
    const fig = document.createElement('span');
    fig.className = 'price-figure';
    fig.textContent = fmtEuro(price);
    const per = document.createElement('span');
    per.className = 'price-period tour-period';
    per.textContent =
      tour.pricingType === 'private_group'
        ? `${totalRiders} ${state.lang === 'fr' ? 'cyclistes' : 'riders'}`
        : `${fmtEuro(tour.adultPrice)}/${state.lang === 'fr' ? 'adulte' : 'adult'}`;
    priceWrap.append(fig, per);
    top.append(titleWrap, priceWrap);

    const desc = document.createElement('p');
    desc.className = 'tour-desc';
    desc.textContent = tour.summary[state.lang];

    const controls = document.createElement('div');
    controls.className = 'tour-controls';

    const slotGroup = document.createElement('div');
    slotGroup.className = 'tour-slot-row';
    const slotPills = document.createElement('div');
    slotPills.className = 'size-pills';
    for (const s of tour.slots) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `size-btn tour-slot-btn${sel.slot === s ? ' is-selected' : ''}`;
      b.textContent = s;
      b.addEventListener('click', () => {
        sel.slot = s;
        renderToursSection();
      });
      slotPills.appendChild(b);
    }

    const capTag = document.createElement('span');
    capTag.className = `stock-caption${spotsLeft === 0 ? ' is-empty' : ''}`;
    capTag.textContent =
      spotsLeft === 0
        ? txt.tourSoldOut
        : tour.pricingType === 'private_group'
          ? txt.tourPrivateOpen
          : txt.tourSpotsLeft(spotsLeft);

    slotGroup.append(slotPills, capTag);

    const stepperRow = document.createElement('div');
    stepperRow.className = 'tour-steppers';

    const mkStepper = (labelTxt, val, minVal, maxVal, onChange) => {
      const box = document.createElement('div');
      box.className = 'stepper-box';
      const lbl = document.createElement('span');
      lbl.className = 'stepper-lbl';
      lbl.textContent = labelTxt;
      const ctrls = document.createElement('div');
      ctrls.className = 'stepper-ctrls';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.disabled = val <= minVal;
      minus.addEventListener('click', () => onChange(val - 1));
      const num = document.createElement('strong');
      num.textContent = String(val);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.disabled = val >= maxVal;
      plus.addEventListener('click', () => onChange(val + 1));
      ctrls.append(minus, num, plus);
      box.append(lbl, ctrls);
      return box;
    };

    if (tour.pricingType === 'private_group') {
      stepperRow.appendChild(
        mkStepper(txt.tourRidersLabel, sel.adults, 1, tour.capacity, (next) => {
          sel.adults = next;
          sel.kids = 0;
          renderToursSection();
        })
      );
    } else {
      stepperRow.append(
        mkStepper(txt.tourAdultsLabel, sel.adults, 1, Math.max(1, spotsLeft - sel.kids), (next) => {
          sel.adults = next;
          renderToursSection();
        }),
        mkStepper(txt.tourKidsLabel, sel.kids, 0, Math.max(0, spotsLeft - sel.adults), (next) => {
          sel.kids = next;
          renderToursSection();
        })
      );
    }

    controls.append(slotGroup, stepperRow);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-yellow tour-add-btn';
    addBtn.disabled = !canBook;
    addBtn.textContent = canBook ? txt.tourAddBtn : txt.tourSoldOut;
    addBtn.addEventListener('click', () => {
      state.bag.push({
        uid: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: 'tour',
        tourId: tour.id,
        tourDate: state.tourDate,
        tourTime: sel.slot,
        adults: sel.adults,
        kids: sel.kids,
      });
      renderToursSection();
      syncBagIndicators();
    });

    body.append(top, desc, controls, addBtn);
    card.append(media, body);
    grid.appendChild(card);
  }
}

async function selectClubDate(nextDate) {
  const today = parisDateOffset(0);
  if (!nextDate || nextDate < today) return;
  state.clubDate = nextDate;
  if (state.backendMode === 'live') {
    const resp = await fetch(`./api/club/rides?date=${encodeURIComponent(nextDate)}`);
    if (resp.ok) {
      const data = await resp.json();
      state.clubRides = data.rides || [];
    }
  } else if (state.clubSeedCache) {
    state.clubRides = buildStaticRidesForDate(state.clubSeedCache, nextDate);
  }
  renderClubSection();
}

function showClubFeedback(msg, isError = false) {
  const fb = el('clubFeedback');
  fb.hidden = false;
  fb.className = `club-feedback${isError ? ' is-error' : ''}`;
  fb.textContent = msg;
}

async function handleClubLeaderAction(pace, action) {
  const name = el('clubLeaderInput').value.trim().replace(/\s+/g, ' ');
  if (name.length < 2) {
    el('clubLeaderInput').focus();
    showClubFeedback(
      state.lang === 'fr' ? 'Entrez votre prénom de Ride Leader ci-dessus.' : 'Enter your ride leader name above first.',
      true
    );
    return;
  }
  state.leaderName = name;
  try {
    localStorage.setItem('peloton_leader_name', name);
  } catch {}

  if (state.backendMode === 'live') {
    const endpoint = action === 'withdraw' ? './api/club/withdraw' : './api/club/signup';
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, date: state.clubDate, pace }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      showClubFeedback(data.error || 'Unable to update leader list.', true);
      return;
    }
    state.clubRides = data.rides || state.clubRides;
    if (data.leaders) state.clubLeaders = data.leaders;
    showClubFeedback(
      action === 'withdraw'
        ? `${name} removed from ${pace} (${state.clubDate}).`
        : `${name} signed up to lead ${pace} (${state.clubDate}).`
    );
    renderClubSection();
    return;
  }

  const target = state.clubRides.find((r) => r.pace === pace);
  if (!target) return;
  const idx = target.leaders.findIndex((l) => l.toLowerCase() === name.toLowerCase());
  if (action === 'withdraw' && idx !== -1) {
    target.leaders.splice(idx, 1);
  } else if (action === 'signup' && idx === -1 && target.leaders.length < 4) {
    target.leaders.push(name);
  }
  try {
    const edits = JSON.parse(localStorage.getItem('peloton_static_club_edits') || '{}');
    edits[`${state.clubDate}::${pace}`] = target.leaders;
    localStorage.setItem('peloton_static_club_edits', JSON.stringify(edits));
  } catch {}
  showClubFeedback(
    action === 'withdraw'
      ? `${name} removed from ${pace} (${state.clubDate}).`
      : `${name} signed up to lead ${pace} (${state.clubDate}).`
  );
  renderClubSection();
}

function renderClubSection() {
  const txt = t();
  const today = parisDateOffset(0);
  const dateInput = el('clubDateInput');
  dateInput.min = today;
  if (state.clubDate < today) state.clubDate = today;
  dateInput.value = state.clubDate;

  el('clubLeaderInput').value = state.leaderName;
  const dl = el('clubLeaderDatalist');
  dl.replaceChildren();
  for (const name of state.clubLeaders) {
    const opt = document.createElement('option');
    opt.value = name;
    dl.appendChild(opt);
  }

  const pillsWrap = el('clubDatePills');
  pillsWrap.replaceChildren();
  for (const item of state.clubUpcomingDates.slice(0, 7)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `size-btn${item.ride_date === state.clubDate ? ' is-selected' : ''}`;
    b.textContent = item.ride_date.slice(5);
    b.title = `${item.ride_date} · ${item.title}`;
    b.addEventListener('click', () => selectClubDate(item.ride_date));
    pillsWrap.appendChild(b);
  }

  const grid = el('clubGrid');
  grid.replaceChildren();

  const paceOrder = ['Spicy', 'Medium', 'Mild'];
  for (const paceName of paceOrder) {
    const meta = CLUB_PACES.find((p) => p.pace === paceName);
    const ride = state.clubRides.find((r) => r.pace === paceName) || {
      pace: paceName,
      title: 'Club Ride',
      start_time: meta.defaultTime,
      leaders: [],
      effective_status: 'open',
      notes: '',
    };

    const leaders = ride.leaders || [];
    const currentName = state.leaderName.trim().toLowerCase();
    const isLeading = Boolean(currentName) && leaders.some((l) => l.toLowerCase() === currentName);
    const isFull = leaders.length >= meta.maxLeaders;

    const card = document.createElement('article');
    card.className = 'club-card';

    const top = document.createElement('div');
    top.className = 'club-card-head';

    const badgeRow = document.createElement('div');
    badgeRow.className = 'club-pace-row';
    const pacePill = document.createElement('span');
    pacePill.className = `pace-pill is-${paceName.toLowerCase()}`;
    pacePill.textContent = `${paceName} · ${meta.speed}`;
    const timeTag = document.createElement('span');
    timeTag.className = 'club-time';
    timeTag.textContent = ride.start_time || meta.defaultTime;
    badgeRow.append(pacePill, timeTag);

    const titleEl = document.createElement('h3');
    titleEl.className = 'bike-name';
    titleEl.textContent = ride.title || 'Club Ride';

    const detailEl = document.createElement('p');
    detailEl.className = 'bike-sub';
    detailEl.textContent = meta.detail[state.lang];

    top.append(badgeRow, titleEl, detailEl);

    const leaderBox = document.createElement('div');
    leaderBox.className = 'club-leaders-box';
    const statusLine = document.createElement('div');
    statusLine.className = 'club-leader-head';
    const countSpan = document.createElement('span');
    countSpan.textContent = `Ride Leaders (${leaders.length}/${meta.maxLeaders})`;
    const badgeSpan = document.createElement('span');
    badgeSpan.className = `stock-caption${leaders.length === 0 ? ' is-empty' : ''}`;
    badgeSpan.textContent = isLeading
      ? txt.clubSignedBadge
      : leaders.length === 0
        ? txt.clubNeedLeader
        : isFull
          ? txt.clubFullLeaders
          : `${leaders.length} ready`;
    statusLine.append(countSpan, badgeSpan);

    const chips = document.createElement('div');
    chips.className = 'leader-chips';
    if (leaders.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'leader-empty';
      empty.textContent = txt.clubNoLeadersYet;
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

    const leadBtn = document.createElement('button');
    leadBtn.type = 'button';
    leadBtn.className = isLeading ? 'btn-ghost' : 'btn-yellow';
    leadBtn.disabled = !isLeading && isFull;
    leadBtn.textContent = isLeading ? txt.clubWithdrawBtn : isFull ? txt.clubFullLeaders : txt.clubSignUpBtn;
    leadBtn.addEventListener('click', () => handleClubLeaderAction(paceName, isLeading ? 'withdraw' : 'signup'));

    const rentLink = document.createElement('button');
    rentLink.type = 'button';
    rentLink.className = 'club-rent-link';
    rentLink.textContent = `${txt.clubRentForRide} →`;
    rentLink.addEventListener('click', () => {
      state.pickupDate = state.clubDate;
      const slots = getPickupSlots(state.pickupDate);
      state.pickupTime = slots.includes('08:00') ? '08:00' : slots[0] || '08:30';
      state.durationKey = '1d';
      state.category = 'road';
      syncDeckControls();
      renderBikeGrid();
      refreshLiveAvailability();
      el('fleet').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });

    actions.append(leadBtn, rentLink);
    card.append(top, leaderBox, actions);
    grid.appendChild(card);
  }
}

function renderCafeAndStudio() {
  el('cafeRoasters').textContent = CAFE_MENU.roasters;
  el('cafeModifiers').textContent = CAFE_MENU.modifiers[state.lang];

  const fillLedger = (dlEl, items) => {
    dlEl.replaceChildren();
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'ledger-row';
      const dt = document.createElement('dt');
      dt.textContent = item.name[state.lang];
      const dd = document.createElement('dd');
      dd.textContent = item.price;
      row.append(dt, dd);
      dlEl.appendChild(row);
    }
  };

  fillLedger(el('cafeDrinksList'), CAFE_MENU.drinks);
  fillLedger(el('cafeFoodList'), CAFE_MENU.food);

  el('studioAreaBadge').textContent = STUDIO_SPACE.area;
  el('studioCapBadge').textContent = STUDIO_SPACE.capacity[state.lang];
  el('studioLocation').textContent = STUDIO_SPACE.location[state.lang];

  const ul = el('studioFeaturesList');
  ul.replaceChildren();
  for (const feat of STUDIO_SPACE.features[state.lang]) {
    const li = document.createElement('li');
    li.textContent = feat;
    ul.appendChild(li);
  }

  el('studioDateInput').min = parisDateOffset(0);
}

function syncBagIndicators() {
  const txt = t();
  const count = state.bag.length;
  const total = state.bag.reduce((sum, item) => sum + getItemTotal(item), 0);

  el('navBagCount').textContent = String(count);

  const dock = el('bagDock');
  const anyOverlayOpen = !el('bikeBackdrop').hidden || !el('bagBackdrop').hidden;
  dock.hidden = count === 0 || anyOverlayOpen;
  if (!dock.hidden) {
    el('dockCountLabel').textContent = txt.dockCount(count);
    el('dockTotalLabel').textContent = fmtEuro(total);
    el('dockCtaLabel').textContent = txt.dockAction;
  }
}

function openBikeModal(bikeId, preselectedSize, triggerEl) {
  const bike = BIKES.find((b) => b.id === bikeId);
  if (!bike) return;

  state.lastTriggerEl = triggerEl || document.activeElement;
  const chosenSize =
    bike.sizes.find((s) => s.code === preselectedSize && getRemainingStock(bike, s) > 0) ||
    bike.sizes.find((s) => getRemainingStock(bike, s) > 0) ||
    bike.sizes[0];

  state.modal = {
    bikeId: bike.id,
    sizeCode: chosenSize.code,
    pedalId: getDefaultPedalForBike(bike).id,
    extraIds: new Set(),
    childAgeNote: '',
    riderName: '',
  };

  renderBikeModal();
  const backdrop = el('bikeBackdrop');
  backdrop.classList.remove('is-closing');
  backdrop.hidden = false;
  syncBagIndicators();
  el('closeBikeModal').focus();
}

function renderBikeModal() {
  const txt = t();
  const bike = BIKES.find((b) => b.id === state.modal.bikeId);
  if (!bike) return;

  el('modalBikeTitle').textContent = bike.name;
  el('modalBikeTagline').textContent = bike.tagline[state.lang];
  el('modalBikeImg').src = bike.image;
  el('modalBikeImg').alt = bike.name;
  el('modalBikeDesc').textContent = bike.description[state.lang];
  el('modalSpecsTitle').textContent = txt.specsTitle;

  const specUl = el('modalSpecList');
  specUl.replaceChildren();
  for (const s of bike.specs[state.lang]) {
    const li = document.createElement('li');
    li.textContent = s;
    specUl.appendChild(li);
  }

  el('modalSizeLabel').textContent = txt.sizeLabel;
  const selectedSizeObj = bike.sizes.find((s) => s.code === state.modal.sizeCode) || bike.sizes[0];
  el('modalSizeHint').textContent = `${selectedSizeObj.heightLabel} · ${txt.inStock(getRemainingStock(bike, selectedSizeObj))}`;

  const sizeGrid = el('modalSizeOptions');
  sizeGrid.replaceChildren();
  for (const sz of bike.sizes) {
    const left = getRemainingStock(bike, sz);
    const card = document.createElement('label');
    card.className = `choice-card${sz.code === state.modal.sizeCode ? ' is-checked' : ''}${left === 0 ? ' is-disabled' : ''}`;

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'modalSize';
    radio.value = sz.code;
    radio.checked = sz.code === state.modal.sizeCode;
    radio.disabled = left === 0;
    radio.addEventListener('change', () => {
      state.modal.sizeCode = sz.code;
      renderBikeModal();
    });

    const main = document.createElement('span');
    main.className = 'choice-main';
    main.textContent = `${sz.label} (${left})`;

    const sub = document.createElement('span');
    sub.className = 'choice-sub';
    sub.textContent = sz.heightLabel;

    card.append(radio, main, sub);
    sizeGrid.appendChild(card);
  }

  el('modalPedalsLabel').textContent = txt.pedalsLabel;
  const pedalGrid = el('modalPedalOptions');
  const cityNote = el('modalCityPedalNote');
  pedalGrid.replaceChildren();

  if (bike.category === 'city') {
    pedalGrid.hidden = true;
    cityNote.hidden = false;
    cityNote.textContent = txt.pedalsCityNote;
  } else {
    pedalGrid.hidden = false;
    cityNote.hidden = true;
    for (const p of PEDAL_OPTIONS) {
      const card = document.createElement('label');
      card.className = `choice-card${p.id === state.modal.pedalId ? ' is-checked' : ''}`;

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'modalPedal';
      radio.value = p.id;
      radio.checked = p.id === state.modal.pedalId;
      radio.addEventListener('change', () => {
        state.modal.pedalId = p.id;
        renderBikeModal();
      });

      const main = document.createElement('span');
      main.className = 'choice-main';
      main.textContent = p.label[state.lang];

      const sub = document.createElement('span');
      sub.className = 'choice-sub';
      sub.textContent = p.detail[state.lang];

      card.append(radio, main, sub);
      pedalGrid.appendChild(card);
    }
  }

  const availExtras = getAvailableExtrasForBike(bike);
  const extrasSec = el('modalExtrasSection');
  const extrasList = el('modalExtrasList');
  extrasList.replaceChildren();
  extrasSec.hidden = availExtras.length === 0;
  el('modalExtrasLabel').textContent = txt.extrasLabel;

  for (const ex of availExtras) {
    const itemWrap = document.createElement('div');
    itemWrap.className = 'extra-item';

    const row = document.createElement('label');
    row.className = 'extra-row-head';

    const left = document.createElement('span');
    left.className = 'extra-left';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = state.modal.extraIds.has(ex.id);
    cb.addEventListener('change', () => {
      if (cb.checked) state.modal.extraIds.add(ex.id);
      else state.modal.extraIds.delete(ex.id);
      renderBikeModal();
    });

    const textCol = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'extra-name';
    name.textContent = ex.label[state.lang];
    const desc = document.createElement('span');
    desc.className = 'extra-desc';
    desc.textContent = ex.description[state.lang];
    textCol.append(name, desc);
    left.append(cb, textCol);

    const cost = document.createElement('span');
    cost.className = 'extra-cost';
    cost.textContent = `+${fmtEuro(ex.price)}`;

    row.append(left, cost);
    itemWrap.appendChild(row);

    if (ex.needsNote && cb.checked) {
      const note = document.createElement('input');
      note.type = 'text';
      note.className = 'text-input';
      note.maxLength = 40;
      note.placeholder = txt.childAgePlaceholder;
      note.value = state.modal.childAgeNote;
      note.addEventListener('input', (e) => {
        state.modal.childAgeNote = e.target.value;
      });
      itemWrap.appendChild(note);
    }

    extrasList.appendChild(itemWrap);
  }

  el('modalRiderLabel').textContent = txt.riderNameLabel;
  const riderInput = el('riderNameInput');
  riderInput.placeholder = txt.riderNamePlaceholder;
  riderInput.value = state.modal.riderName;

  el('modalTotalLabel').textContent = txt.modalTotal;
  const total = getItemTotal({
    kind: 'bike',
    bikeId: bike.id,
    sizeCode: state.modal.sizeCode,
    pedalId: state.modal.pedalId,
    extraIds: [...state.modal.extraIds],
    durationKey: state.durationKey,
    customDays: state.customDays,
  });
  el('modalLiveTotal').textContent = fmtEuro(total);

  const addBtn = el('modalAddBtn');
  addBtn.textContent = txt.modalAdd;
  addBtn.disabled = getRemainingStock(bike, selectedSizeObj) === 0;
}

function addModalBikeToBag() {
  const bike = BIKES.find((b) => b.id === state.modal.bikeId);
  if (!bike) return;
  const szObj = bike.sizes.find((s) => s.code === state.modal.sizeCode);
  if (!szObj || getRemainingStock(bike, szObj) <= 0) return;

  state.bag.push({
    uid: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: 'bike',
    bikeId: bike.id,
    sizeCode: szObj.code,
    pedalId: bike.category === 'city' ? 'flat' : state.modal.pedalId,
    extraIds: [...state.modal.extraIds],
    childAgeNote: state.modal.childAgeNote.trim(),
    riderName: el('riderNameInput').value.trim(),
  });

  closeOverlay('bikeBackdrop', () => {
    renderBikeGrid();
    syncBagIndicators();
  });
}

function openBagDrawer(triggerEl) {
  state.lastTriggerEl = triggerEl || document.activeElement;
  state.checkoutError = '';
  if (state.drawerMode === 'confirmed' && !state.confirmedBooking) {
    state.drawerMode = 'bag';
  }
  renderBagDrawer();
  const backdrop = el('bagBackdrop');
  backdrop.classList.remove('is-closing');
  backdrop.hidden = false;
  syncBagIndicators();
  el('closeBagDrawer').focus();
}

async function submitUnifiedCheckout(customer) {
  state.checkoutError = '';
  state.checkoutBusy = true;
  renderBagDrawer();

  const bikesPayload = state.bag.filter((x) => x.kind === 'bike');
  const toursPayload = state.bag.filter((x) => x.kind === 'tour');

  if (state.backendMode === 'live') {
    try {
      const resp = await fetch('./api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer,
          pickupDate: state.pickupDate,
          pickupTime: state.pickupTime,
          durationKey: state.durationKey,
          customDays: state.customDays,
          bikes: bikesPayload,
          tours: toursPayload,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        state.checkoutBusy = false;
        state.checkoutError = data.error || 'Unable to complete booking.';
        await refreshLiveAvailability();
        renderBagDrawer();
        return;
      }
      if (data.mode === 'stripe' && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      state.confirmedBooking = data.booking;
      state.bag = [];
      state.checkoutBusy = false;
      state.drawerMode = 'confirmed';
      await refreshLiveAvailability();
      renderBagDrawer();
      return;
    } catch (err) {
      state.checkoutBusy = false;
      state.checkoutError = err.message || 'Network error.';
      renderBagDrawer();
      return;
    }
  }

  const gross = state.bag.reduce((sum, item) => sum + getItemTotal(item), 0);
  state.confirmedBooking = {
    ref_code: `LPC-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    customer_name: `${customer.firstName} ${customer.lastName}`,
    customer_email: customer.email,
    total_cents: Math.round(gross * 100),
    status: 'confirmed',
  };
  state.bag = [];
  state.checkoutBusy = false;
  state.drawerMode = 'confirmed';
  renderBikeGrid();
  renderToursSection();
  syncBagIndicators();
  renderBagDrawer();
}

function renderBagDrawer() {
  const txt = t();
  const body = el('bagDrawerBody');
  body.replaceChildren();

  if (state.drawerMode === 'confirmed' && state.confirmedBooking) {
    const b = state.confirmedBooking;
    const box = document.createElement('div');
    box.className = 'confirmed-box';

    const tag = document.createElement('span');
    tag.className = 'confirmed-tag';
    tag.textContent = `${txt.confirmedBadge} · ${b.ref_code}`;

    const h3 = document.createElement('h3');
    h3.style.margin = '0';
    h3.textContent = txt.confirmedTitle;

    const meta = document.createElement('div');
    meta.style.fontSize = '13.5px';
    meta.style.fontWeight = '600';
    meta.textContent = `${b.customer_name} · ${b.customer_email} · ${fmtEuro((b.total_cents || 0) / 100)}`;

    const msg = document.createElement('p');
    msg.style.margin = '0';
    msg.style.fontSize = '13.5px';
    msg.textContent = txt.confirmedBody;

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn-yellow';
    resetBtn.textContent = txt.newBookingBtn;
    resetBtn.addEventListener('click', () => {
      state.confirmedBooking = null;
      state.drawerMode = 'bag';
      closeOverlay('bagBackdrop');
    });

    box.append(tag, h3, meta, msg, resetBtn);
    body.appendChild(box);
    return;
  }

  if (state.bag.length === 0) {
    const empty = document.createElement('p');
    empty.style.color = 'var(--muted)';
    empty.textContent = txt.bagEmpty;
    body.appendChild(empty);
    return;
  }

  const hasBikes = state.bag.some((x) => x.kind === 'bike');
  if (hasBikes) {
    const ret = computeReturnInfo(state.pickupDate, state.pickupTime, state.durationKey, state.customDays);
    const win = document.createElement('div');
    win.className = 'bag-window';
    const wLeft = document.createElement('div');
    wLeft.textContent = `${txt.bagPickup}: ${state.pickupDate} · ${state.pickupTime}`;
    const wRight = document.createElement('div');
    wRight.textContent = `${txt.bagReturn}: ${ret.dateStr} · ${ret.timeStr}`;
    win.append(wLeft, wRight);
    body.appendChild(win);
  }

  const list = document.createElement('div');
  list.className = 'bag-list';

  let grossTotal = 0;
  for (const item of state.bag) {
    const itemPrice = getItemTotal(item);
    grossTotal += itemPrice;

    const row = document.createElement('div');
    row.className = 'bag-line-item';

    const top = document.createElement('div');
    top.className = 'bag-line-top';
    const nameEl = document.createElement('span');
    const priceEl = document.createElement('span');
    priceEl.textContent = fmtEuro(itemPrice);

    const meta = document.createElement('div');
    meta.className = 'bag-line-meta';

    if (item.kind === 'tour') {
      const tour = TOURS.find((x) => x.id === item.tourId);
      nameEl.textContent = tour.name[state.lang];
      meta.textContent = `${item.tourDate} · ${item.tourTime} · ${item.adults + item.kids} ${
        state.lang === 'fr' ? 'participants' : 'riders'
      }`;
    } else {
      const bike = BIKES.find((b) => b.id === item.bikeId);
      nameEl.textContent = `${bike.name} · ${item.sizeCode}${item.riderName ? ` — ${item.riderName}` : ''}`;
      const pedalObj = PEDAL_OPTIONS.find((p) => p.id === item.pedalId);
      const extraNames = (item.extraIds || [])
        .map((eid) => {
          const ex = getAvailableExtrasForBike(bike).find((x) => x.id === eid);
          if (!ex) return null;
          return ex.needsNote && item.childAgeNote
            ? `${ex.label[state.lang]} (${item.childAgeNote})`
            : ex.label[state.lang];
        })
        .filter(Boolean);
      meta.textContent = [pedalObj?.label[state.lang], ...extraNames].filter(Boolean).join(' · ');
    }

    top.append(nameEl, priceEl);

    const remBtn = document.createElement('button');
    remBtn.type = 'button';
    remBtn.className = 'bag-remove';
    remBtn.textContent = txt.bagRemove;
    remBtn.addEventListener('click', () => {
      state.bag = state.bag.filter((x) => x.uid !== item.uid);
      if (state.bag.length === 0) state.drawerMode = 'bag';
      renderBikeGrid();
      renderToursSection();
      syncBagIndicators();
      renderBagDrawer();
    });

    row.append(top, meta, remBtn);
    list.appendChild(row);
  }
  body.appendChild(list);

  const vat = computeVatBreakdown(grossTotal);
  const totals = document.createElement('div');
  totals.className = 'bag-totals';
  const grandRow = document.createElement('div');
  grandRow.className = 'bag-grand';
  const gl = document.createElement('span');
  gl.textContent = 'Total';
  const gv = document.createElement('span');
  gv.textContent = fmtEuro(vat.gross);
  grandRow.append(gl, gv);

  const vatP = document.createElement('p');
  vatP.className = 'bag-note';
  vatP.textContent = txt.bagVat(vat.vat, vat.net);

  const idP = document.createElement('p');
  idP.className = 'bag-note';
  idP.textContent = txt.bagIdNote;

  totals.append(grandRow, vatP, idP);
  body.appendChild(totals);

  if (state.checkoutError) {
    const errEl = document.createElement('p');
    errEl.className = 'checkout-error';
    errEl.textContent = state.checkoutError;
    body.appendChild(errEl);
  }

  if (state.drawerMode === 'checkout') {
    const form = document.createElement('form');
    form.className = 'guest-form';

    const mkInput = (id, labelTxt, type, req) => {
      const wrap = document.createElement('div');
      wrap.className = 'guest-field';
      const l = document.createElement('label');
      l.setAttribute('for', id);
      l.textContent = labelTxt;
      const inp = document.createElement('input');
      inp.id = id;
      inp.type = type;
      inp.className = 'text-input';
      inp.required = req;
      wrap.append(l, inp);
      return wrap;
    };

    const pair = document.createElement('div');
    pair.className = 'field-pair';
    pair.append(mkInput('coFirst', txt.firstName, 'text', true), mkInput('coLast', txt.lastName, 'text', true));

    const em = mkInput('coEmail', txt.email, 'email', true);
    const ph = mkInput('coPhone', txt.phone, 'tel', false);

    const termsWrap = document.createElement('label');
    termsWrap.className = 'terms-check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.required = true;
    const span = document.createElement('span');
    span.textContent = txt.terms;
    termsWrap.append(cb, span);

    const subBtn = document.createElement('button');
    subBtn.type = 'submit';
    subBtn.className = 'btn-yellow';
    subBtn.disabled = state.checkoutBusy;
    subBtn.textContent = state.stripeEnabled ? txt.confirmStripeBtn : txt.confirmDirectBtn;

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn-ghost';
    backBtn.textContent = txt.backToBagBtn;
    backBtn.addEventListener('click', () => {
      state.drawerMode = 'bag';
      renderBagDrawer();
    });

    form.append(pair, em, ph, termsWrap, subBtn, backBtn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitUnifiedCheckout({
        firstName: el('coFirst').value.trim(),
        lastName: el('coLast').value.trim(),
        email: el('coEmail').value.trim(),
        phone: el('coPhone').value.trim(),
      });
    });
    body.appendChild(form);
    return;
  }

  const stack = document.createElement('div');
  stack.className = 'bag-cta-stack';

  const proceedBtn = document.createElement('button');
  proceedBtn.type = 'button';
  proceedBtn.className = 'btn-yellow';
  proceedBtn.textContent = state.stripeEnabled ? txt.checkoutProceedStripe : txt.checkoutProceedDirect;
  proceedBtn.addEventListener('click', () => {
    state.drawerMode = 'checkout';
    renderBagDrawer();
  });
  stack.appendChild(proceedBtn);

  if (state.backendMode === 'static' && hasBikes) {
    const firstBike = BIKES.find((b) => b.id === state.bag.find((x) => x.kind === 'bike')?.bikeId);
    const payLink = document.createElement('a');
    payLink.className = 'btn-ghost';
    payLink.href = buildBrmDeepLink(firstBike?.brmCategoryId, state.lang);
    payLink.target = '_blank';
    payLink.rel = 'noopener noreferrer';
    payLink.textContent = txt.handoffBtn;
    stack.appendChild(payLink);
  }

  body.appendChild(stack);
}

function closeOverlay(backdropId, afterClose) {
  const backdrop = el(backdropId);
  if (backdrop.hidden) return;

  const finish = () => {
    backdrop.classList.remove('is-closing');
    backdrop.hidden = true;
    syncBagIndicators();
    if (state.lastTriggerEl && typeof state.lastTriggerEl.focus === 'function') {
      state.lastTriggerEl.focus();
    }
    state.lastTriggerEl = null;
    if (afterClose) afterClose();
  };

  if (prefersReducedMotion()) {
    finish();
    return;
  }
  backdrop.classList.add('is-closing');
  setTimeout(finish, 185);
}

function setupScrollChrome() {
  const hero = el('hero');
  const nav = el('siteNav');
  const heroObserver = new IntersectionObserver(
    (entries) => {
      const heroVisible = entries[0]?.isIntersecting ?? true;
      nav.classList.toggle('is-scrolled', !heroVisible);
      syncGlidingSegThumb(el('langSeg'), state.lang);
    },
    { threshold: 0.14 }
  );
  heroObserver.observe(hero);
}

function renderAll() {
  syncStaticLabels();
  renderStorySection();
  syncDeckControls();
  renderBikeGrid();
  renderToursSection();
  renderClubSection();
  renderCafeAndStudio();
  syncBagIndicators();
}

function bindEvents() {
  segResizeObserver.observe(el('langSeg'));
  segResizeObserver.observe(el('durationSeg'));
  segResizeObserver.observe(el('categorySeg'));
  segResizeObserver.observe(el('heightSeg'));

  el('pickupDate').addEventListener('change', (e) => {
    state.pickupDate = e.target.value || parisDateOffset(1);
    syncDeckControls();
    syncBagIndicators();
    refreshLiveAvailability();
  });

  el('pickupTime').addEventListener('change', (e) => {
    state.pickupTime = e.target.value;
    syncDeckControls();
    refreshLiveAvailability();
  });

  el('customDaysInput').addEventListener('input', (e) => {
    state.customDays = Math.max(1, Math.min(30, Number(e.target.value) || 1));
    state.rollPrices = true;
    syncDeckControls();
    renderBikeGrid();
    syncBagIndicators();
    refreshLiveAvailability();
  });

  el('tourDateInput').addEventListener('change', (e) => {
    state.tourDate = e.target.value || parisDateOffset(1);
    renderToursSection();
    refreshLiveAvailability();
  });

  el('clubDateInput').addEventListener('change', (e) => {
    selectClubDate(e.target.value);
  });

  el('clubLeaderInput').addEventListener('input', (e) => {
    state.leaderName = e.target.value;
  });

  el('studioForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: el('studioNameInput').value.trim(),
      email: el('studioEmailInput').value.trim(),
      eventDate: el('studioDateInput').value,
      guests: Number(el('studioGuestsInput').value) || 35,
      notes: el('studioNotesInput').value.trim(),
    };
    const msg = el('studioSentMsg');
    if (state.backendMode === 'live') {
      const resp = await fetch('./api/studio/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) return;
    }
    e.target.reset();
    msg.hidden = false;
    msg.textContent = t().studioSent;
  });

  el('riderNameInput').addEventListener('input', (e) => {
    state.modal.riderName = e.target.value;
  });

  el('navBagBtn').addEventListener('click', (e) => openBagDrawer(e.currentTarget));
  el('bagDock').addEventListener('click', (e) => openBagDrawer(e.currentTarget));
  el('modalAddBtn').addEventListener('click', addModalBikeToBag);
  el('closeBikeModal').addEventListener('click', () => closeOverlay('bikeBackdrop'));
  el('closeBagDrawer').addEventListener('click', () => closeOverlay('bagBackdrop'));

  for (const id of ['bikeBackdrop', 'bagBackdrop']) {
    el(id).addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeOverlay(id);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!el('bikeBackdrop').hidden) closeOverlay('bikeBackdrop');
    else if (!el('bagBackdrop').hidden) closeOverlay('bagBackdrop');
  });
}

setupScrollChrome();
bindEvents();
renderAll();
loadInitialBackendOrStatic();
