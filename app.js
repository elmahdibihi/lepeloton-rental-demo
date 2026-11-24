import {
  BIKES,
  CATEGORIES,
  DURATION_PRESETS,
  FIXES,
  HEIGHT_OPTIONS,
  I18N,
  PEDAL_OPTIONS,
  STORE,
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
  pickupDate: parisDateOffset(1),
  pickupTime: '09:00',
  durationKey: '1d',
  customDays: 4,
  heightFilter: 'all',
  category: initCatObj ? initCatObj.id : 'all',
  cardSizes: {},
  bag: [],
  drawerMode: 'bag', // 'bag' | 'checkout' | 'confirmed'
  demoCustomer: null,
  modal: {
    bikeId: null,
    sizeCode: null,
    pedalId: null,
    extraIds: new Set(),
    childAgeNote: '',
    riderName: '',
  },
  lastTriggerEl: null,
  toastTimer: null,
};

const el = (id) => document.getElementById(id);

function t() {
  return I18N[state.lang];
}

function fmtEuro(val) {
  const num = Number(val);
  const rounded = Number.isInteger(num) ? String(num) : num.toFixed(2);
  return state.lang === 'fr' ? `${rounded.replace('.', ',')} €` : `€${rounded}`;
}

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
  const anyAvailable = bike.sizes.find((s) => getRemainingStock(bike, s) > 0);
  return anyAvailable || bike.sizes[0];
}

function getEffectiveDaysCount() {
  if (state.durationKey === '4h') return 0.5;
  const preset = DURATION_PRESETS.find((p) => p.key === state.durationKey);
  return preset ? preset.days : Math.max(1, Math.min(30, Number(state.customDays) || 4));
}

function formatDurationBadge(bike) {
  const txt = t();
  if (state.durationKey === '4h') return txt.halfDayUnit;
  const days = getEffectiveDaysCount();
  if (days === 1) return txt.perDayApprox;
  const price = computeBikePrice(bike, state.durationKey, state.customDays);
  const perDay = Math.round((price / days) * 10) / 10;
  return state.lang === 'fr'
    ? `${days} jours (${fmtEuro(perDay)}/j)`
    : `${days} days (${fmtEuro(perDay)}/day)`;
}

function syncStaticLabels() {
  const txt = t();
  document.documentElement.lang = state.lang;
  el('brandSub').textContent = txt.brandSub;
  el('bagBtnLabel').textContent = txt.cartBtn;
  el('heroTitle').textContent = txt.heroTitle;
  el('heroSub').textContent = txt.heroSub;
  el('lblPickupDate').textContent = txt.pickupDate;
  el('lblPickupTime').textContent = txt.pickupTime;
  el('lblDuration').textContent = txt.duration;
  el('lblDaysUnit').textContent = txt.daysUnit;
  el('lblRiderHeight').textContent = txt.riderHeight;
  el('lblReturnPreview').textContent = txt.returnPreview;
  el('footerHours').textContent = txt.footerHours;
  el('openCompareBtn').textContent = txt.compareBtn;
  el('compareTitle').textContent = txt.compareTitle;
  el('bagDrawerTitle').textContent = txt.bagTitle;
  el('toastViewBagBtn').textContent = txt.toastViewBag;

  for (const btn of document.querySelectorAll('.lang-btn')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === state.lang));
  }

  const activeCatObj = CATEGORIES.find((c) => c.id === state.category);
  el('footerBrmLink').href = buildBrmDeepLink(activeCatObj?.brmCategoryId, state.lang);
}

function syncScheduleControls() {
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

  const durSelect = el('durationSelect');
  durSelect.replaceChildren();
  for (const p of DURATION_PRESETS) {
    const opt = document.createElement('option');
    opt.value = p.key;
    opt.textContent = p.label[state.lang];
    opt.selected = state.durationKey === p.key;
    durSelect.appendChild(opt);
  }
  const customOpt = document.createElement('option');
  customOpt.value = 'custom';
  customOpt.textContent = txt.customDays;
  customOpt.selected = state.durationKey === 'custom';
  durSelect.appendChild(customOpt);

  el('customDaysWrap').hidden = state.durationKey !== 'custom';
  el('customDaysInput').value = String(state.customDays);

  const heightSel = el('heightFilter');
  heightSel.replaceChildren();
  for (const h of HEIGHT_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = h.id;
    opt.textContent = h.label[state.lang];
    opt.selected = state.heightFilter === h.id;
    heightSel.appendChild(opt);
  }

  const ret = computeReturnInfo(state.pickupDate, state.pickupTime, state.durationKey, state.customDays);
  el('returnValue').textContent = `${ret.dateStr} · ${ret.timeStr}`;
}

function renderCategoryBar(visibleCount) {
  const pillsWrap = el('categoryPills');
  pillsWrap.replaceChildren();
  for (const cat of CATEGORIES) {
    const count =
      cat.id === 'all' ? BIKES.length : BIKES.filter((b) => b.category === cat.id).length;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cat-pill';
    btn.textContent = `${cat.label[state.lang]} (${count})`;
    btn.setAttribute('aria-pressed', String(state.category === cat.id));
    btn.addEventListener('click', () => {
      state.category = cat.id;
      renderAll();
    });
    pillsWrap.appendChild(btn);
  }
  el('fleetCount').textContent = t().showingCount(visibleCount);
}

function renderBikeGrid() {
  const txt = t();
  const grid = el('bikeGrid');
  grid.replaceChildren();

  let list = state.category === 'all' ? [...BIKES] : BIKES.filter((b) => b.category === state.category);
  if (state.heightFilter !== 'all') {
    // Keep fitting bikes first without hiding non-fitting models completely (dim non-matching instead).
    list.sort((a, b) => {
      const aFit = getMatchingSizesForHeight(a, state.heightFilter).some((s) => getRemainingStock(a, s) > 0) ? 0 : 1;
      const bFit = getMatchingSizesForHeight(b, state.heightFilter).some((s) => getRemainingStock(b, s) > 0) ? 0 : 1;
      return aFit - bFit;
    });
  }

  renderCategoryBar(list.length);

  for (const bike of list) {
    const fittingSizes = getMatchingSizesForHeight(bike, state.heightFilter);
    const hasHeightMatch =
      state.heightFilter === 'all' || fittingSizes.some((s) => getRemainingStock(bike, s) > 0);
    const selectedSize = getPreferredCardSize(bike);
    const remaining = getRemainingStock(bike, selectedSize);
    const totalLeftAllSizes = bike.sizes.reduce((sum, s) => sum + getRemainingStock(bike, s), 0);
    const price = computeBikePrice(bike, state.durationKey, state.customDays);

    const card = document.createElement('article');
    card.className = `bike-card${hasHeightMatch ? '' : ' is-dimmed'}`;

    const photoWrap = document.createElement('div');
    photoWrap.className = 'bike-photo';

    const img = document.createElement('img');
    img.src = bike.image;
    img.alt = bike.name;
    img.loading = 'lazy';
    img.setAttribute('referrerpolicy', 'no-referrer');
    photoWrap.appendChild(img);

    if (!hasHeightMatch) {
      const warn = document.createElement('span');
      warn.className = 'card-badge card-badge-warn';
      warn.textContent = txt.filterNoSizeBadge;
      photoWrap.appendChild(warn);
    } else if (bike.badge) {
      const badge = document.createElement('span');
      badge.className = 'card-badge';
      badge.textContent = bike.badge[state.lang];
      photoWrap.appendChild(badge);
    }

    const body = document.createElement('div');
    body.className = 'bike-body';

    const top = document.createElement('div');
    top.className = 'bike-top';

    const titleCol = document.createElement('div');
    const h2 = document.createElement('h2');
    h2.className = 'bike-title';
    h2.textContent = bike.name;
    const tag = document.createElement('p');
    tag.className = 'bike-tagline';
    tag.textContent = bike.tagline[state.lang];
    titleCol.append(h2, tag);

    const priceBlock = document.createElement('div');
    priceBlock.className = 'price-block';
    const priceAmt = document.createElement('span');
    priceAmt.className = 'price-amount';
    priceAmt.textContent = fmtEuro(price);
    const priceUnit = document.createElement('span');
    priceUnit.className = 'price-unit';
    priceUnit.textContent = formatDurationBadge(bike);
    priceBlock.append(priceAmt, priceUnit);

    top.append(titleCol, priceBlock);

    const chips = document.createElement('div');
    chips.className = 'spec-chips';
    for (const c of bike.chips[state.lang]) {
      const sp = document.createElement('span');
      sp.className = 'spec-chip';
      sp.textContent = c;
      chips.appendChild(sp);
    }

    const sizeRow = document.createElement('div');
    sizeRow.className = 'size-row';

    const sizePills = document.createElement('div');
    sizePills.className = 'size-pills';

    for (const sz of bike.sizes) {
      const szLeft = getRemainingStock(bike, sz);
      const isFit = state.heightFilter !== 'all' && fittingSizes.some((f) => f.code === sz.code);
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `size-pill${sz.code === selectedSize.code ? ' is-selected' : ''}${isFit ? ' is-height-match' : ''}`;
      pill.textContent = sz.label;
      pill.disabled = szLeft === 0;
      pill.title = `${sz.heightLabel} · ${txt.inStock(szLeft)}`;
      pill.addEventListener('click', () => {
        state.cardSizes[bike.id] = sz.code;
        renderBikeGrid();
      });
      sizePills.appendChild(pill);
    }

    const stockLine = document.createElement('div');
    stockLine.className = `stock-line${remaining === 0 ? ' is-empty' : ''}`;
    stockLine.textContent =
      remaining > 0
        ? `${selectedSize.label} (${selectedSize.heightLabel}) · ${txt.inStock(remaining)}`
        : txt.noneLeft;

    sizeRow.append(sizePills, stockLine);

    const ctaWrap = document.createElement('div');
    ctaWrap.className = 'card-cta';
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'btn-primary';
    cta.disabled = totalLeftAllSizes === 0;
    cta.textContent = totalLeftAllSizes > 0 ? txt.configureBtn : txt.soldOutBtn;
    cta.addEventListener('click', (ev) => openBikeModal(bike.id, selectedSize.code, ev.currentTarget));
    ctaWrap.appendChild(cta);

    body.append(top, chips, sizeRow, ctaWrap);
    card.append(photoWrap, body);
    grid.appendChild(card);
  }
}

function updateHeaderBag() {
  const countEl = el('bagCount');
  const totalEl = el('bagHeaderTotal');
  countEl.textContent = String(state.bag.length);
  const grandTotal = state.bag.reduce((sum, item) => sum + getItemTotal(item), 0);
  totalEl.hidden = state.bag.length === 0;
  totalEl.textContent = fmtEuro(grandTotal);
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

/* ---------------- Bike Configurator Modal ---------------- */

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
  el('bikeModalBackdrop').hidden = false;
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
    const tile = document.createElement('label');
    tile.className = `choice-tile${sz.code === state.modal.sizeCode ? ' is-checked' : ''}${left === 0 ? ' is-disabled' : ''}`;

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

    const title = document.createElement('span');
    title.className = 'choice-title';
    title.textContent = `${sz.label} (${left})`;

    const sub = document.createElement('span');
    sub.className = 'choice-sub';
    sub.textContent = sz.heightLabel;

    tile.append(radio, title, sub);
    sizeGrid.appendChild(tile);
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
      const tile = document.createElement('label');
      tile.className = `choice-tile${p.id === state.modal.pedalId ? ' is-checked' : ''}`;

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'modalPedal';
      radio.value = p.id;
      radio.checked = p.id === state.modal.pedalId;
      radio.addEventListener('change', () => {
        state.modal.pedalId = p.id;
        renderBikeModal();
      });

      const title = document.createElement('span');
      title.className = 'choice-title';
      title.textContent = p.label[state.lang];

      const sub = document.createElement('span');
      sub.className = 'choice-sub';
      sub.textContent = p.detail[state.lang];

      tile.append(radio, title, sub);
      pedalGrid.appendChild(tile);
    }
  }

  const availExtras = getAvailableExtrasForBike(bike);
  const extrasSec = el('modalExtrasSection');
  const extrasList = el('modalExtrasList');
  extrasList.replaceChildren();
  extrasSec.hidden = availExtras.length === 0;
  el('modalExtrasLabel').textContent = txt.extrasLabel;

  for (const ex of availExtras) {
    const row = document.createElement('div');
    row.className = 'extra-row';

    const label = document.createElement('label');
    label.className = 'extra-check-label';

    const leftDiv = document.createElement('span');
    leftDiv.className = 'extra-left';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = state.modal.extraIds.has(ex.id);
    cb.addEventListener('change', () => {
      if (cb.checked) state.modal.extraIds.add(ex.id);
      else state.modal.extraIds.delete(ex.id);
      renderBikeModal();
    });

    const textWrap = document.createElement('span');
    const title = document.createElement('span');
    title.className = 'extra-title';
    title.textContent = ex.label[state.lang];
    const desc = document.createElement('span');
    desc.className = 'extra-desc';
    desc.textContent = ex.description[state.lang];
    textWrap.append(title, desc);
    leftDiv.append(cb, textWrap);

    const priceSpan = document.createElement('span');
    priceSpan.className = 'extra-price';
    priceSpan.textContent = `+${fmtEuro(ex.price)}`;

    label.append(leftDiv, priceSpan);
    row.appendChild(label);

    if (ex.needsNote && cb.checked) {
      const noteInput = document.createElement('input');
      noteInput.type = 'text';
      noteInput.className = 'extra-note-input';
      noteInput.maxLength = 40;
      noteInput.placeholder = txt.childAgePlaceholder;
      noteInput.value = state.modal.childAgeNote;
      noteInput.addEventListener('input', (e) => {
        state.modal.childAgeNote = e.target.value;
      });
      row.appendChild(noteInput);
    }

    extrasList.appendChild(row);
  }

  el('modalRiderLabel').textContent = txt.riderNameLabel;
  const riderInput = el('riderNameInput');
  riderInput.placeholder = txt.riderNamePlaceholder;
  riderInput.value = state.modal.riderName;

  el('modalTotalLabel').textContent = txt.modalTotal;
  const modalTotal = getItemTotal({
    bikeId: bike.id,
    sizeCode: state.modal.sizeCode,
    pedalId: state.modal.pedalId,
    extraIds: [...state.modal.extraIds],
  });
  el('modalLiveTotal').textContent = fmtEuro(modalTotal);

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

  closeModal('bikeModalBackdrop');
  renderAll();
  showToast(t().toastAdded(bike.name, szObj.label));
}

/* ---------------- Bag Drawer & Checkout Preview ---------------- */

function openBagDrawer(triggerEl) {
  el('toast').hidden = true;
  clearTimeout(state.toastTimer);
  state.lastTriggerEl = triggerEl || document.activeElement;
  if (state.drawerMode === 'confirmed' && state.bag.length === 0) {
    state.drawerMode = 'bag';
  }
  renderBagDrawer();
  el('bagBackdrop').hidden = false;
  el('closeBagDrawer').focus();
}

function renderBagDrawer() {
  const txt = t();
  const body = el('bagDrawerBody');
  body.replaceChildren();

  const ret = computeReturnInfo(state.pickupDate, state.pickupTime, state.durationKey, state.customDays);
  const sched = document.createElement('div');
  sched.className = 'bag-schedule-card';
  const r1 = document.createElement('div');
  r1.innerHTML = '';
  r1.textContent = `${txt.bagPickup}: ${state.pickupDate} · ${state.pickupTime}`;
  const r2 = document.createElement('div');
  r2.textContent = `${txt.bagReturn}: ${ret.dateStr} · ${ret.timeStr}`;
  sched.append(r1, r2);
  body.appendChild(sched);

  if (state.drawerMode === 'confirmed' && state.demoCustomer) {
    const gross = state.bag.reduce((sum, item) => sum + getItemTotal(item), 0);
    const card = document.createElement('div');
    card.className = 'demo-confirm-card';

    const badge = document.createElement('span');
    badge.className = 'demo-pill';
    badge.textContent = txt.demoConfirmBadge;

    const h3 = document.createElement('h3');
    h3.style.margin = '0';
    h3.textContent = txt.demoConfirmTitle;

    const who = document.createElement('div');
    who.style.fontSize = '13.5px';
    who.textContent = `${state.demoCustomer.firstName} ${state.demoCustomer.lastName} · ${state.demoCustomer.email} · ${state.bag.length} bike(s) · ${fmtEuro(gross)}`;

    const desc = document.createElement('p');
    desc.style.margin = '0';
    desc.style.fontSize = '13px';
    desc.textContent = txt.demoConfirmDesc;

    const firstBike = BIKES.find((b) => b.id === state.bag[0]?.bikeId);
    const liveA = document.createElement('a');
    liveA.className = 'btn-primary';
    liveA.style.textAlign = 'center';
    liveA.style.textDecoration = 'none';
    liveA.href = buildBrmDeepLink(firstBike?.brmCategoryId, state.lang);
    liveA.target = '_blank';
    liveA.rel = 'noopener noreferrer';
    liveA.textContent = txt.handoffBtn;

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn-secondary';
    resetBtn.textContent = txt.startOverBtn;
    resetBtn.addEventListener('click', () => {
      state.drawerMode = 'bag';
      renderBagDrawer();
    });

    card.append(badge, h3, who, desc, liveA, resetBtn);
    body.appendChild(card);
    return;
  }

  if (state.bag.length === 0) {
    const empty = document.createElement('p');
    empty.style.color = 'var(--ink-muted)';
    empty.textContent = txt.bagEmpty;
    body.appendChild(empty);
    return;
  }

  const itemsWrap = document.createElement('div');
  itemsWrap.className = 'bag-items';

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

    const card = document.createElement('div');
    card.className = 'bag-item';

    const head = document.createElement('div');
    head.className = 'bag-item-head';
    const title = document.createElement('span');
    title.className = 'bag-item-title';
    title.textContent = `${bike.name} · ${item.sizeCode}${item.riderName ? ` — ${item.riderName}` : ''}`;
    const priceEl = document.createElement('strong');
    priceEl.textContent = fmtEuro(itemPrice);
    head.append(title, priceEl);

    const meta = document.createElement('div');
    meta.className = 'bag-item-meta';
    const parts = [pedalObj ? pedalObj.label[state.lang] : null, ...extraNames].filter(Boolean);
    meta.textContent = parts.join(' · ');

    const actRow = document.createElement('div');
    actRow.className = 'bag-item-actions';
    const remBtn = document.createElement('button');
    remBtn.type = 'button';
    remBtn.className = 'remove-btn';
    remBtn.textContent = txt.bagRemove;
    remBtn.addEventListener('click', () => {
      state.bag = state.bag.filter((x) => x.uid !== item.uid);
      if (state.bag.length === 0) state.drawerMode = 'bag';
      renderAll();
      renderBagDrawer();
    });
    actRow.appendChild(remBtn);

    card.append(head, meta, actRow);
    itemsWrap.appendChild(card);
  }
  body.appendChild(itemsWrap);

  const vat = computeVatBreakdown(grossTotal);
  const sumBox = document.createElement('div');
  sumBox.className = 'bag-summary';
  const totalRow = document.createElement('div');
  totalRow.className = 'bag-total-row';
  const lbl = document.createElement('span');
  lbl.textContent = 'Total';
  const val = document.createElement('span');
  val.textContent = fmtEuro(vat.gross);
  totalRow.append(lbl, val);

  const vatLine = document.createElement('p');
  vatLine.className = 'bag-vat-line';
  vatLine.textContent = txt.bagVatLine(vat.vat, vat.net);

  const idNote = document.createElement('p');
  idNote.className = 'bag-id-note';
  idNote.textContent = txt.bagIdNote;

  sumBox.append(totalRow, vatLine, idNote);
  body.appendChild(sumBox);

  if (state.drawerMode === 'checkout') {
    const form = document.createElement('form');
    form.className = 'checkout-form';
    form.innerHTML = '';

    const mkField = (id, labelTxt, type, req) => {
      const w = document.createElement('div');
      w.className = 'checkout-field';
      const l = document.createElement('label');
      l.setAttribute('for', id);
      l.textContent = labelTxt;
      const inp = document.createElement('input');
      inp.id = id;
      inp.type = type;
      inp.required = req;
      w.append(l, inp);
      return w;
    };

    const fn = mkField('coFirst', txt.firstName, 'text', true);
    const ln = mkField('coLast', txt.lastName, 'text', true);
    const em = mkField('coEmail', txt.email, 'email', true);
    const ph = mkField('coPhone', txt.phone, 'tel', false);

    const termsWrap = document.createElement('label');
    termsWrap.className = 'terms-row';
    const termsCb = document.createElement('input');
    termsCb.type = 'checkbox';
    termsCb.required = true;
    const termsSpan = document.createElement('span');
    termsSpan.textContent = txt.terms;
    termsWrap.append(termsCb, termsSpan);

    const subBtn = document.createElement('button');
    subBtn.type = 'submit';
    subBtn.className = 'btn-primary';
    subBtn.textContent = txt.submitDemoBtn;

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn-secondary';
    backBtn.textContent = txt.backToBagBtn;
    backBtn.addEventListener('click', () => {
      state.drawerMode = 'bag';
      renderBagDrawer();
    });

    form.append(fn, ln, em, ph, termsWrap, subBtn, backBtn);
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

  const actions = document.createElement('div');
  actions.className = 'bag-actions';

  const firstBike = BIKES.find((b) => b.id === state.bag[0]?.bikeId);
  const handoffLink = document.createElement('a');
  handoffLink.className = 'btn-primary';
  handoffLink.style.textAlign = 'center';
  handoffLink.style.textDecoration = 'none';
  handoffLink.href = buildBrmDeepLink(firstBike?.brmCategoryId, state.lang);
  handoffLink.target = '_blank';
  handoffLink.rel = 'noopener noreferrer';
  handoffLink.textContent = txt.handoffBtn;

  const hint = document.createElement('p');
  hint.className = 'handoff-hint';
  hint.textContent = txt.handoffHint;

  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.className = 'btn-secondary';
  previewBtn.textContent = txt.previewCheckoutBtn;
  previewBtn.addEventListener('click', () => {
    state.drawerMode = 'checkout';
    renderBagDrawer();
  });

  actions.append(handoffLink, hint, previewBtn);
  body.appendChild(actions);
}

/* ---------------- Fixes Comparison Modal ---------------- */

function renderCompareModal() {
  const txt = t();
  const body = el('compareBody');
  body.replaceChildren();

  const list = document.createElement('div');
  list.className = 'compare-list';
  for (const fx of FIXES) {
    const card = document.createElement('article');
    card.className = 'compare-card';

    const h3 = document.createElement('h3');
    h3.textContent = fx.area[state.lang];

    const cols = document.createElement('div');
    cols.className = 'compare-cols';

    const bef = document.createElement('div');
    bef.className = 'compare-before';
    const bTag = document.createElement('span');
    bTag.className = 'compare-col-tag';
    bTag.textContent = txt.compareBefore;
    const bTxt = document.createElement('div');
    bTxt.textContent = fx.before[state.lang];
    bef.append(bTag, bTxt);

    const aft = document.createElement('div');
    aft.className = 'compare-after';
    const aTag = document.createElement('span');
    aTag.className = 'compare-col-tag';
    aTag.textContent = txt.compareAfter;
    const aTxt = document.createElement('div');
    aTxt.textContent = fx.after[state.lang];
    aft.append(aTag, aTxt);

    cols.append(bef, aft);
    card.append(h3, cols);
    list.appendChild(card);
  }
  body.appendChild(list);
}

function openCompareModal(triggerEl) {
  state.lastTriggerEl = triggerEl || document.activeElement;
  renderCompareModal();
  el('compareBackdrop').hidden = false;
  el('closeCompareModal').focus();
}

/* ---------------- Shared Helpers & Events ---------------- */

function closeModal(backdropId) {
  el(backdropId).hidden = true;
  if (state.lastTriggerEl && typeof state.lastTriggerEl.focus === 'function') {
    state.lastTriggerEl.focus();
  }
  state.lastTriggerEl = null;
}

function showToast(msg) {
  el('toastText').textContent = msg;
  el('toast').hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    el('toast').hidden = true;
  }, 4500);
}

function renderAll() {
  syncStaticLabels();
  syncScheduleControls();
  renderBikeGrid();
  updateHeaderBag();
}

function bindEvents() {
  for (const btn of document.querySelectorAll('.lang-btn')) {
    btn.addEventListener('click', () => {
      state.lang = btn.dataset.lang;
      el('toast').hidden = true;
      clearTimeout(state.toastTimer);
      renderAll();
      if (!el('bikeModalBackdrop').hidden) renderBikeModal();
      if (!el('bagBackdrop').hidden) renderBagDrawer();
      if (!el('compareBackdrop').hidden) renderCompareModal();
    });
  }

  el('riderNameInput').addEventListener('input', (e) => {
    state.modal.riderName = e.target.value;
  });

  el('pickupDate').addEventListener('change', (e) => {
    state.pickupDate = e.target.value || parisDateOffset(1);
    renderAll();
  });

  el('pickupTime').addEventListener('change', (e) => {
    state.pickupTime = e.target.value;
    syncScheduleControls();
  });

  el('durationSelect').addEventListener('change', (e) => {
    state.durationKey = e.target.value;
    renderAll();
  });

  el('customDaysInput').addEventListener('input', (e) => {
    const val = Math.max(1, Math.min(30, Number(e.target.value) || 1));
    state.customDays = val;
    renderAll();
  });

  el('heightFilter').addEventListener('change', (e) => {
    state.heightFilter = e.target.value;
    renderAll();
  });

  el('bagTrigger').addEventListener('click', (e) => openBagDrawer(e.currentTarget));
  el('toastViewBagBtn').addEventListener('click', (e) => {
    el('toast').hidden = true;
    openBagDrawer(e.currentTarget);
  });

  el('openCompareBtn').addEventListener('click', (e) => openCompareModal(e.currentTarget));
  el('modalAddBtn').addEventListener('click', addModalBikeToBag);

  el('closeBikeModal').addEventListener('click', () => closeModal('bikeModalBackdrop'));
  el('closeBagDrawer').addEventListener('click', () => closeModal('bagBackdrop'));
  el('closeCompareModal').addEventListener('click', () => closeModal('compareBackdrop'));

  for (const id of ['bikeModalBackdrop', 'bagBackdrop', 'compareBackdrop']) {
    el(id).addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal(id);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!el('bikeModalBackdrop').hidden) closeModal('bikeModalBackdrop');
    else if (!el('bagBackdrop').hidden) closeModal('bagBackdrop');
    else if (!el('compareBackdrop').hidden) closeModal('compareBackdrop');
  });
}

bindEvents();
renderAll();
