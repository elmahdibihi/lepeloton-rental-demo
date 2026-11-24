import {
  BIKES,
  CATEGORIES,
  DURATION_PRESETS,
  HEIGHT_OPTIONS,
  I18N,
  PEDAL_OPTIONS,
  STORE,
  STORY_CHAPTERS,
  buildBrmDeepLink,
  computeBikePrice,
  computeReturnInfo,
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

const state = {
  lang: initLang,
  activeChapter: 0,
  pickupDate: parisDateOffset(1),
  pickupTime: '09:00',
  durationKey: '1d',
  customDays: 4,
  heightFilter: 'all',
  category: initCatObj ? initCatObj.id : 'all',
  cardSizes: {},
  bag: [],
  drawerMode: 'bag',
  demoCustomer: null,
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

function getStockUsedInBag(bikeId, sizeCode) {
  return state.bag.reduce(
    (sum, item) => (item.bikeId === bikeId && item.sizeCode === sizeCode ? sum + 1 : sum),
    0
  );
}

function getRemainingStock(bike, sizeObj) {
  return Math.max(0, sizeObj.stock - getStockUsedInBag(bike.id, sizeObj.code));
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

function getEffectiveDaysCount() {
  if (state.durationKey === '4h') return 0.5;
  const preset = DURATION_PRESETS.find((p) => p.key === state.durationKey);
  return preset ? preset.days : Math.max(1, Math.min(30, Number(state.customDays) || 4));
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
  const bike = BIKES.find((b) => b.id === item.bikeId);
  const base = computeBikePrice(bike, state.durationKey, state.customDays);
  const pedal = PEDAL_OPTIONS.find((p) => p.id === item.pedalId)?.price || 0;
  const extrasSum = item.extraIds.reduce((sum, eid) => {
    const found = getAvailableExtrasForBike(bike).find((ex) => ex.id === eid);
    return sum + (found ? found.price : 0);
  }, 0);
  return base + pedal + extrasSum;
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
  el('navClubhouseLink').textContent = txt.navClubhouse;
  el('navBagLabel').textContent = txt.bagLabel;

  el('heroKicker').textContent = txt.heroKicker;
  el('heroTitle').replaceChildren(...txt.heroTitle.split('\n').flatMap((line, i) => (i ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)])));
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

  el('clubhouseEyebrow').textContent = txt.clubhouseEyebrow;
  el('clubhouseHeading').textContent = txt.clubhouseTitle;
  el('clubhouseBody').textContent = txt.clubhouseBody;
  el('clubhouseAddressTitle').textContent = txt.clubhouseAddressTitle;
  el('clubhouseHoursTitle').textContent = txt.clubhouseHoursTitle;
  el('clubhouseHoursBody').textContent = txt.clubhouseHoursBody;
  el('clubhousePortalLink').textContent = txt.clubhousePortalLink;

  el('bagDrawerTitle').textContent = txt.bagTitle;

  const activeCatObj = CATEGORIES.find((c) => c.id === state.category);
  el('clubhousePortalLink').href = buildBrmDeepLink(activeCatObj?.brmCategoryId, state.lang);

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
      const activeCatObj = CATEGORIES.find((c) => c.id === val);
      el('clubhousePortalLink').href = buildBrmDeepLink(activeCatObj?.brmCategoryId, state.lang);
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
    bikeId: bike.id,
    sizeCode: state.modal.sizeCode,
    pedalId: state.modal.pedalId,
    extraIds: [...state.modal.extraIds],
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
  if (state.drawerMode === 'confirmed' && state.bag.length === 0) {
    state.drawerMode = 'bag';
  }
  renderBagDrawer();
  const backdrop = el('bagBackdrop');
  backdrop.classList.remove('is-closing');
  backdrop.hidden = false;
  syncBagIndicators();
  el('closeBagDrawer').focus();
}

function renderBagDrawer() {
  const txt = t();
  const body = el('bagDrawerBody');
  body.replaceChildren();

  const ret = computeReturnInfo(state.pickupDate, state.pickupTime, state.durationKey, state.customDays);
  const win = document.createElement('div');
  win.className = 'bag-window';
  const wLeft = document.createElement('div');
  wLeft.innerHTML = '';
  wLeft.textContent = `${txt.bagPickup}: ${state.pickupDate} · ${state.pickupTime}`;
  const wRight = document.createElement('div');
  wRight.textContent = `${txt.bagReturn}: ${ret.dateStr} · ${ret.timeStr}`;
  win.append(wLeft, wRight);
  body.appendChild(win);

  if (state.drawerMode === 'confirmed' && state.demoCustomer) {
    const gross = state.bag.reduce((sum, item) => sum + getItemTotal(item), 0);
    const box = document.createElement('div');
    box.className = 'confirmed-box';

    const tag = document.createElement('span');
    tag.className = 'confirmed-tag';
    tag.textContent = txt.confirmedBadge;

    const h3 = document.createElement('h3');
    h3.style.margin = '0';
    h3.textContent = txt.confirmedTitle;

    const meta = document.createElement('div');
    meta.style.fontSize = '13.5px';
    meta.textContent = `${state.demoCustomer.firstName} ${state.demoCustomer.lastName} · ${state.demoCustomer.email} · ${fmtEuro(gross)}`;

    const msg = document.createElement('p');
    msg.style.margin = '0';
    msg.style.fontSize = '13.5px';
    msg.textContent = txt.confirmedBody;

    const firstBike = BIKES.find((b) => b.id === state.bag[0]?.bikeId);
    const payLink = document.createElement('a');
    payLink.className = 'btn-yellow';
    payLink.href = buildBrmDeepLink(firstBike?.brmCategoryId, state.lang);
    payLink.target = '_blank';
    payLink.rel = 'noopener noreferrer';
    payLink.textContent = txt.handoffBtn;

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-ghost';
    editBtn.textContent = txt.editBagBtn;
    editBtn.addEventListener('click', () => {
      state.drawerMode = 'bag';
      renderBagDrawer();
    });

    box.append(tag, h3, meta, msg, payLink, editBtn);
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

  const list = document.createElement('div');
  list.className = 'bag-list';

  let grossTotal = 0;
  for (const item of state.bag) {
    const bike = BIKES.find((b) => b.id === item.bikeId);
    if (!bike) continue;
    const itemPrice = getItemTotal(item);
    grossTotal += itemPrice;

    const pedalObj = PEDAL_OPTIONS.find((p) => p.id === item.pedalId);
    const extraNames = item.extraIds
      .map((eid) => {
        const ex = getAvailableExtrasForBike(bike).find((x) => x.id === eid);
        if (!ex) return null;
        return ex.needsNote && item.childAgeNote
          ? `${ex.label[state.lang]} (${item.childAgeNote})`
          : ex.label[state.lang];
      })
      .filter(Boolean);

    const row = document.createElement('div');
    row.className = 'bag-line-item';

    const top = document.createElement('div');
    top.className = 'bag-line-top';
    const nameEl = document.createElement('span');
    nameEl.textContent = `${bike.name} · ${item.sizeCode}${item.riderName ? ` — ${item.riderName}` : ''}`;
    const priceEl = document.createElement('span');
    priceEl.textContent = fmtEuro(itemPrice);
    top.append(nameEl, priceEl);

    const meta = document.createElement('div');
    meta.className = 'bag-line-meta';
    meta.textContent = [pedalObj?.label[state.lang], ...extraNames].filter(Boolean).join(' · ');

    const remBtn = document.createElement('button');
    remBtn.type = 'button';
    remBtn.className = 'bag-remove';
    remBtn.textContent = txt.bagRemove;
    remBtn.addEventListener('click', () => {
      state.bag = state.bag.filter((x) => x.uid !== item.uid);
      if (state.bag.length === 0) state.drawerMode = 'bag';
      renderBikeGrid();
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
    subBtn.textContent = txt.confirmBtn;

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
      state.demoCustomer = {
        firstName: el('coFirst').value.trim(),
        lastName: el('coLast').value.trim(),
        email: el('coEmail').value.trim(),
        phone: el('coPhone').value.trim(),
      };
      state.drawerMode = 'confirmed';
      renderBagDrawer();
    });
    body.appendChild(form);
    return;
  }

  const stack = document.createElement('div');
  stack.className = 'bag-cta-stack';

  const firstBike = BIKES.find((b) => b.id === state.bag[0]?.bikeId);
  const payLink = document.createElement('a');
  payLink.className = 'btn-yellow';
  payLink.href = buildBrmDeepLink(firstBike?.brmCategoryId, state.lang);
  payLink.target = '_blank';
  payLink.rel = 'noopener noreferrer';
  payLink.textContent = txt.handoffBtn;

  const guestBtn = document.createElement('button');
  guestBtn.type = 'button';
  guestBtn.className = 'btn-ghost';
  guestBtn.textContent = txt.guestBtn;
  guestBtn.addEventListener('click', () => {
    state.drawerMode = 'checkout';
    renderBagDrawer();
  });

  stack.append(payLink, guestBtn);
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
  });

  el('pickupTime').addEventListener('change', (e) => {
    state.pickupTime = e.target.value;
    syncDeckControls();
  });

  el('customDaysInput').addEventListener('input', (e) => {
    state.customDays = Math.max(1, Math.min(30, Number(e.target.value) || 1));
    state.rollPrices = true;
    syncDeckControls();
    renderBikeGrid();
    syncBagIndicators();
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
