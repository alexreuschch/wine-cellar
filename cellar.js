'use strict';

/* Wine Cellar: Cellar screen and the shared filter for cellar, journal and top rated. Loaded after app.js, in the order of index.html. */

/* ------------------------------------------------------------ view: cellar */

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const grapeNames = w => String(w.grapes || '').split(/[,;\/+&]/)
  .map(s => cap(s.replace(/\d+([.,]\d+)?\s*%?/g, '').replace(/\s+/g, ' ').trim()))
  .filter(s => s.length > 1);
const foodNames = w => foodsOf(w).map(k => FOODS[k][0]);
const cellarPool = () => S.wines.filter(w => !isDisc(w) && (U.showFinished || w.count > 0));
const topPool = () => S.wines.filter(w => (isDisc(w) ? U.topDisc : U.topFinished || w.count > 0));
const finishedWines = () => S.wines.filter(w => w.count === 0 && !isDisc(w));
const discWines = () => S.wines.filter(isDisc);
const ENTRY_LABEL = { Gift: 'Gift given', Received: 'Gift received', Added: 'Added' };
const entryType = r => ENTRY_LABEL[r.type] || r.type || 'Other';
const entryWine = r => { const w = wineById(r.wineId); return w ? `${wineTitle(w)} ${w.vintage}`.trim() : (r.wineName || 'Deleted wine'); };
const switchHtml = (change, on, label) => `<label class="switch"><input type="checkbox" data-change="${change}"${on ? ' checked' : ''}>${label}</label>`;
const offChip = (act, label) => `<button class="chip on" data-act="${act}" aria-label="Turn off ${label}">${label}${ICON.x}</button>`;

/* ------------------------------------------------------------ shared filter (cellar, journal, top rated) */

const F_WINE = { label: 'Wine', plural: 'wine types', of: w => [w.type], order: TYPES };
const F_GRAPE = { label: 'Grape', plural: 'grapes', of: grapeNames };
/* country and region of a wine, from its region field "Côte de Nuits, Burgundy, France": the region is the part right before the country.
   Each shows the flag of the country. The choices follow each other: with France set, Region only offers French regions, and the other way round. */
const flagEmoji2 = code => String.fromCodePoint(...[...code].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65));
function regionOf(w) {
  const parts = str(w.region).split(',').map(x => x.trim()).filter(Boolean);
  const c = countryOf(w);
  const i = c ? parts.findIndex(x => COUNTRY_CODES[lc(x)] === c.code) : parts.length;
  return i > 0 ? parts[i - 1] : '';
}
const countryNameOf = w => { const c = countryOf(w); return c ? SHOP_COUNTRIES[c.code] || c.name : ''; };
const codeOfCountry = name => COUNTRY_CODES[lc(name)] || Object.keys(SHOP_COUNTRIES).find(k => lc(SHOP_COUNTRIES[k]) === lc(name)) || '';
const F_COUNTRY = { label: 'Country', plural: 'countries', of: w => { const n = countryNameOf(w); return n ? [n] : []; },
  lead: name => { const code = codeOfCountry(name); return code ? `<span class="flag">${flagEmoji2(code)}</span>` : ''; } };
const F_REGION = { label: 'Region', plural: 'regions', of: w => { const r = regionOf(w); return r ? [r] : []; },
  lead: name => { const w = S.wines.find(x => lc(regionOf(x)) === lc(name) && countryOf(x)); return w ? flagOf(w) : ''; } };
/* the phase in the drinking window, as on the Window screen */
const F_WINDOW = { label: 'Window', plural: 'phases', of: w => [statusOf(w)], order: STATUS_ORDER, dot: n => (STATUS[n] ? STATUS[n].c : '') };
const F_RATING = { label: 'Rating', kind: 'rating', of: () => [] };
/* journal month as 'Nov 2026', and back to '2026-11' for sorting */
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthOf = r => { const m = /^(\d{4})-(\d{2})/.exec(String(r.date || '')); return m ? `${MONTHS_EN[Number(m[2]) - 1]} ${m[1]}` : ''; };
const monthKey = name => { const [mo, y] = String(name).split(' '); return `${y}-${String(MONTHS_EN.indexOf(mo) + 1).padStart(2, '0')}`; };
const vintageOf = w => (w.vintage ? String(w.vintage) : 'NV');
const drinkByOf = w => { const p = windowParts(w); return p ? [String(Math.max(now.getFullYear(), p.u))] : []; };
const byYearDesc = (a, b) => (a.name === 'NV') - (b.name === 'NV') || Number(b.name) - Number(a.name);
const F_VINTAGE = { hidden: true, label: 'Vintage', plural: 'vintages', prefix: 'Vintage ', of: w => [vintageOf(w)], sort: byYearDesc, sortHint: 'Newest first. ' };
const F_DRINKBY = { hidden: true, label: 'Drink by', plural: 'years', prefix: 'Drink by ', sortHint: 'The year the drinking window ends, wines past it count for this year. ', of: drinkByOf, sort: (a, b) => Number(a.name) - Number(b.name) };
const F_PRICE = { label: 'Street', chip: 'Street', plural: 'street prices', kind: 'range', of: () => [], val: w => streetOf(w) };
const CTX = {
  cellar: {
    noun: 'wines',
    facets: {
      wine: F_WINE,
      grape: F_GRAPE,
      country: F_COUNTRY,
      region: F_REGION,
      window: F_WINDOW,
      location: { label: 'Location', plural: 'locations', of: w => w.stock.map(e => e.loc).filter(Boolean) },
      food: { label: 'Food', plural: 'kinds of food', of: foodNames },
      vintage: F_VINTAGE,
      drinkby: F_DRINKBY,
      // a sub-region, village or style tapped in a background: exactly the wines counted on its chip
      term: { hidden: true, label: 'Background', plural: 'terms', of: w => (U.termPool || []).filter(x => termMatch(w, x)).map(x => x.t) },
      price: F_PRICE,
      rating: F_RATING
    },
    items: () => cellarPool(),
    text: w => matches(w, U.search),
    extra: () => { const done = finishedWines().length; return done ? switchHtml('show-finished', U.showFinished, `Include finished wines (${done})`) : ''; },
    badges: () => ''
  },
  journal: {
    noun: 'entries',
    facets: {
      person: { label: 'Person', plural: 'people', of: r => namesOf(r.people) },
      type: { label: 'Type', plural: 'types', of: r => [entryType(r)], order: ['Dinner', 'Lunch', 'Celebration', 'Other', 'Discovery', 'Gift given', 'Sale', 'Purchase', 'Gift received', 'Added'] },
      retailer: { label: 'Retailer', plural: 'retailers', of: r => (r.retailer ? [r.retailer] : []) },
      month: { hidden: true, label: 'Month', plural: 'months', sortHint: 'Newest first. ', of: r => (monthOf(r) ? [monthOf(r)] : []), sort: (a, b) => monthKey(b.name).localeCompare(monthKey(a.name)) }
    },
    items: () => allEntries(),
    text: r => journalTextMatch(r),
    extra: () => (S.removals.some(r => namesOf(r.hearts).length) ? switchHtml('j-fav', U.jFav, `Only favorite wines<span class="heart-on">${HEART_SM}</span>`) : ''),
    badges: () => (U.jFav ? offChip('j-fav-off', 'Favorites only') : '')
  },
  top: {
    noun: 'wines',
    facets: {
      wine: F_WINE,
      grape: F_GRAPE,
      country: F_COUNTRY,
      region: F_REGION,
      window: F_WINDOW,
      price: F_PRICE
    },
    items: () => topPool(),
    text: () => true,
    extra: () => (finishedWines().length ? switchHtml('top-finished', U.topFinished, `Include finished wines (${finishedWines().length})`) : '') + (discWines().length ? switchHtml('top-disc', U.topDisc, `Include discoveries (${discWines().length})`) : ''),
    badges: () => (U.topFinished ? offChip('top-finished-off', 'Incl. finished') : '') + (U.topDisc ? offChip('top-disc-off', 'Incl. discoveries') : '')
  }
};

const fst = ctx => U.f[ctx];
const sel = (ctx, k) => { const s = U.f[ctx].sel; return s[k] || (s[k] = []); };
const isRange = def => def.kind === 'range';
const rng = (ctx, k) => { const st = U.f[ctx]; return (st.range || (st.range = {}))[k] || null; };
const isRating = def => def.kind === 'rating';
const rflt = ctx => U.f[ctx].rating || null;
const facetN = (ctx, k) => { const def = CTX[ctx].facets[k]; return isRange(def) ? (rng(ctx, k) ? 1 : 0) : isRating(def) ? (rflt(ctx) ? 1 : 0) : sel(ctx, k).length; };
const activeCount = ctx => Object.keys(CTX[ctx].facets).reduce((a, k) => a + facetN(ctx, k), 0);

/* rating filter: one system, at least a value on its own scale */
const rSysName = sys => (sys === 'mine' ? 'My rating' : sys);
const rScale = sys => { const max = sys === 'mine' ? 100 : sysInfo(sys).max; return { max, step: max === 5 ? 0.1 : max === 20 ? 0.5 : 1 }; };
const ratingOf = (w, sys) => { if (sys === 'mine') return w.myRating; const r = w.ratings.find(x => x.sys === sys); return r ? r.score : null; };
const rFmt = (sys, v) => (sys === 'mine' ? `${Math.round(v)}%` : `${fmtScore(sys, v)} /${rScale(sys).max}`);
function ratingSystems(ctx) {
  const items = CTX[ctx].items();
  const out = items.some(w => w.myRating !== null) ? ['mine'] : [];
  SYSTEMS.forEach(x => { if (items.some(w => w.ratings.some(r => r.sys === x.key))) out.push(x.key); });
  return out;
}
function passes(ctx, item, except) {
  const fs = CTX[ctx].facets;
  return Object.keys(fs).every(k => {
    if (k === except) return true;
    const def = fs[k];
    if (isRating(def)) {
      const r = rflt(ctx);
      if (!r) return true;
      const v = ratingOf(item, r.sys);
      return v !== null && v >= r.min - 1e-9;
    }
    if (isRange(def)) {
      const r = rng(ctx, k);
      if (!r) return true;
      const v = def.val(item);
      return v !== null && v >= r[0] && v <= r[1] + 0.005;
    }
    return !sel(ctx, k).length || def.of(item).some(v => sel(ctx, k).includes(lc(v)));
  });
}
function rangeMax(ctx, k) {
  const def = CTX[ctx].facets[k];
  const vals = CTX[ctx].items().map(def.val).filter(v => v !== null);
  return vals.length ? Math.ceil(Math.max(...vals)) : 0;
}

function facetValues(items, def) {
  const m = new Map();
  items.forEach(it => {
    const seen = new Set();
    def.of(it).forEach(v => {
      const k = lc(v);
      if (!k || seen.has(k)) return;
      seen.add(k);
      const e = m.get(k) || { key: k, name: v, n: 0 };
      e.n += 1;
      m.set(k, e);
    });
  });
  const list = [...m.values()];
  if (def.sort) return list.sort(def.sort);
  if (def.order) {
    const idx = n => { const i = def.order.indexOf(n); return i < 0 ? 99 : i; };
    return list.sort((a, b) => idx(a.name) - idx(b.name));
  }
  return list.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

function filterButton(ctx) {
  const n = activeCount(ctx), st = fst(ctx);
  return `<button class="filter-btn${st.open || n ? ' on' : ''}" data-act="f-toggle" data-ctx="${ctx}" aria-expanded="${st.open}" aria-label="Filter">${ICON.filter}${n ? `<span class="count">${n}</span>` : ''}</button>`;
}

function filterArea(ctx) {
  const c = CTX[ctx], st = fst(ctx);
  const base = c.items();
  const allVals = {};
  const active = [];
  Object.keys(c.facets).forEach(k => {
    const def = c.facets[k];
    if (isRating(def)) {
      const r = rflt(ctx);
      if (r) active.push({ k, rating: true, name: `${rSysName(r.sys)} at least ${rFmt(r.sys, r.min)}` });
      return;
    }
    if (isRange(def)) {
      const r = rng(ctx, k);
      if (r) active.push({ k, range: true, name: `${def.chip || def.label} ${money(r[0], 0)} to ${fmtNum(r[1], 0)}` });
      return;
    }
    allVals[k] = facetValues(base, def);
    st.sel[k] = sel(ctx, k).filter(v => allVals[k].some(x => x.key === v));
    st.sel[k].forEach(v => active.push({ k, v, name: (def.prefix || '') + allVals[k].find(x => x.key === v).name }));
  });
  const clear = active.length ? `<button class="chip" data-act="f-clear" data-ctx="${ctx}">Clear all filters</button>` : '';
  const activeChip = a => (a.rating
    ? `<button class="chip on" data-act="rating-clear" data-ctx="${ctx}" aria-label="Remove rating filter">${esc(a.name)}${ICON.x}</button>`
    : a.range
    ? `<button class="chip on" data-act="range-clear" data-ctx="${ctx}" data-k="${a.k}" aria-label="Remove price filter">${esc(a.name)}${ICON.x}</button>`
    : `<button class="chip on" data-act="f-chip" data-ctx="${ctx}" data-k="${a.k}" data-v="${esc(a.v)}" aria-label="Remove filter ${esc(a.name)}">${esc(a.name)}${ICON.x}</button>`);
  if (!st.open) {
    const badges = c.badges();
    return active.length || badges ? `<div class="chips">${active.map(activeChip).join('')}${badges}${clear}</div>` : '';
  }
  // hidden facets are only set from Insights: no tab, but a chip to remove them
  const tabs = Object.keys(c.facets).filter(k => !c.facets[k].hidden).filter(k => (isRange(c.facets[k]) ? rangeMax(ctx, k) > 0 : isRating(c.facets[k]) ? ratingSystems(ctx).length > 0 : allVals[k].length));
  const extra = c.extra();
  if (!tabs.length) return `<div class="card filter-panel"><p class="muted small" style="margin:0">Nothing to filter by yet.</p>${extra}</div>`;
  if (!tabs.includes(st.tab)) st.tab = tabs[0];
  const k = st.tab;
  const nSel = t => facetN(ctx, t);
  const cols = tabs.length <= 2 ? tabs.length : tabs.length === 4 ? 2 : 3;
  const tabBar = `<div class="ftabs" role="tablist" style="grid-template-columns:repeat(${cols}, minmax(0, 1fr))">${tabs.map(t => `<button role="tab" aria-selected="${t === k}" class="ftab${t === k ? ' on' : ''}" data-act="f-tab" data-ctx="${ctx}" data-v="${t}">${c.facets[t].label}${nSel(t) ? `<span class="count">${nSel(t)}</span>` : ''}</button>`).join('')}</div>`;
  const search = allVals[k] && allVals[k].length > 12
    ? `<label class="search compact">${ICON.search}<input type="search" data-input="facetq" data-ctx="${ctx}" aria-label="Search ${c.facets[k].plural}" placeholder="Search ${c.facets[k].plural}" value="${esc(st.q[k] || '')}"></label>` : '';
  return `<div class="card filter-panel">${tabBar}${search}<div id="facet-chips-${ctx}">${facetChipsHtml(ctx)}</div>${extra}${clear ? `<div>${clear}</div>` : ''}</div>`;
}

function facetChipsHtml(ctx) {
  const c = CTX[ctx], st = fst(ctx), k = st.tab, def = c.facets[k];
  if (!def) return '';
  if (isRange(def)) return rangeHtml(ctx, k);
  if (isRating(def)) return ratingHtml(ctx);
  const vals = facetValues(c.items().filter(it => c.text(it) && passes(ctx, it, k)), def);
  const all = facetValues(c.items(), def);
  const chosen = sel(ctx, k);
  const q = lc((st.q[k] || '').trim());
  const selected = chosen.map(v => vals.find(x => x.key === v) || all.find(x => x.key === v) || { key: v, name: v, n: 0 });
  let rest = vals.filter(x => !chosen.includes(x.key));
  let more = '', boxed = false;
  if (q) rest = byName(rest.filter(x => lc(x.name).includes(q)));
  else if (st.all[k] && rest.length > 12) { rest = def.order ? rest : byName(rest); boxed = true; }
  else if (rest.length > 12) { more = `<button class="chip" data-act="f-more" data-ctx="${ctx}" data-k="${k}">Show all ${rest.length}</button>`; rest = rest.slice(0, 12); }
  const dot = x => (def.dot && def.dot(x.name) ? `<span class="dot" style="--c:${def.dot(x.name)}"></span>` : '');
  const lead = x => (def.lead ? def.lead(x.name) : '');
  const chip = (x, on) => `<button class="chip${on ? ' on' : ''}" data-act="f-chip" data-ctx="${ctx}" data-k="${k}" data-v="${esc(x.key)}">${dot(x)}${lead(x)}${esc(x.name)}${on ? ICON.x : ` <span class="n">${x.n}</span>`}</button>`;
  const parts = [];
  if (selected.length) parts.push(`<div class="chips">${selected.map(x => chip(x, true)).join('')}</div>`);
  if (rest.length) parts.push(`<div class="chips${boxed ? ' scroll-box' : ''}">${rest.map(x => chip(x, false)).join('')}${more}</div>`);
  else if (q) parts.push('<p class="muted small" style="margin:0">No match.</p>');
  if (boxed) parts.push(`<div><button class="chip" data-act="f-less" data-ctx="${ctx}" data-k="${k}">Show fewer</button></div>`);
  const how = (def.order || def.sort) && !q ? (def.sortHint || '') : (q || boxed ? 'A to Z. ' : 'Most common first. ');
  parts.push(`<p class="muted tiny" style="margin:0">${how}Numbers count the ${c.noun} that match together with your other filters.</p>`);
  return `<div style="display:flex;flex-direction:column;gap:8px">${parts.join('')}</div>`;
}

/* street price range: a bar with two handles */
function rangeCountText(ctx, k) {
  const c = CTX[ctx];
  const n = c.items().filter(it => c.text(it) && passes(ctx, it)).length;
  const none = c.items().filter(it => c.facets[k].val(it) === null).length;
  const verb = none === 1 ? (rng(ctx, k) ? 'is hidden' : 'is not affected until you move a handle') : (rng(ctx, k) ? 'are hidden' : 'are not affected until you move a handle');
  return `${n} ${n === 1 ? 'wine matches' : 'wines match'}.${none ? ` ${none} ${none === 1 ? 'wine' : 'wines'} without a street price ${verb}.` : ''}`;
}
function rangeHtml(ctx, k) {
  const max = rangeMax(ctx, k);
  const r = rng(ctx, k) || [0, max];
  const lo = clamp(r[0], 0, max), hi = clamp(r[1], 0, max);
  const pct = v => (max ? v / max * 100 : 0).toFixed(1);
  const input = (end, v, label) => `<input type="range" min="0" max="${max}" step="1" value="${Math.round(v)}" data-input="rng" data-ctx="${ctx}" data-k="${k}" data-end="${end}" aria-label="${label}">`;
  return `<div class="dual-wrap">
    <div class="between"><span class="dual-val" id="rng-lo-${ctx}">${money(lo, 0)}</span><span class="dual-val" id="rng-hi-${ctx}">${money(hi, 0)}</span></div>
    <div class="dual" id="rng-${ctx}" style="--a:${pct(lo)}%;--b:${pct(hi)}%"><div class="dual-track"></div><div class="dual-fill"></div>${input('lo', lo, 'Lowest street price')}${input('hi', hi, 'Highest street price')}</div>
    <p class="muted tiny" style="margin:0" id="rng-n-${ctx}">${rangeCountText(ctx, k)}</p>
  </div>`;
}
function refreshFilterResults(ctx) {
  const fb = $(`[data-act="f-toggle"][data-ctx="${ctx}"]`);
  if (fb) fb.outerHTML = filterButton(ctx);
  if (ctx === 'cellar') {
    const l = $('#wine-list'), d = $('#drink-soon');
    if (l) l.innerHTML = cellarList();
    if (d) d.innerHTML = drinkSoonHtml();
  } else if (ctx === 'top') {
    const l = $('#top-list');
    if (l) l.innerHTML = topBody();
  }
}

function ratingCountText(ctx) {
  const c = CTX[ctx], r = rflt(ctx);
  const n = c.items().filter(it => c.text(it) && passes(ctx, it)).length;
  const none = r ? c.items().filter(it => ratingOf(it, r.sys) === null).length : 0;
  return `${n} ${n === 1 ? 'wine matches' : 'wines match'}.${none ? ` ${none} ${none === 1 ? 'wine' : 'wines'} without a ${rSysName(r.sys)} rating ${none === 1 ? 'is' : 'are'} hidden.` : ''}`;
}

function ratingHtml(ctx) {
  const r0 = rflt(ctx), systems = ratingSystems(ctx);
  // My rating is chosen from the start; the filter only starts working when the slider moves
  const pre = !r0 && systems.includes('mine');
  const r = r0 || (pre ? { sys: 'mine', min: 0 } : null);
  const chips = systems.map(sys => `<button class="chip${r && r.sys === sys ? ' on' : ''}" data-act="rt-sys" data-ctx="${ctx}" data-v="${esc(sys)}">${esc(rSysName(sys))}${r0 && r0.sys === sys ? ICON.x : ''}</button>`).join('');
  if (!r) return `<div style="display:flex;flex-direction:column;gap:8px"><div class="chips">${chips}</div><p class="muted tiny" style="margin:0">Choose one rating system, then set the lowest rating to show.</p></div>`;
  const sc = rScale(r.sys);
  return `<div style="display:flex;flex-direction:column;gap:8px"><div class="chips">${chips}</div>
    <div class="between"><span class="small muted">At least</span><span class="dual-val" id="rt-val-${ctx}">${rFmt(r.sys, r.min)}</span></div>
    <div class="single"><input type="range" min="0" max="${sc.max}" step="${sc.step}" value="${r.min}" data-input="rtmin" data-ctx="${ctx}" data-sys="${esc(r.sys)}" aria-label="Lowest ${esc(rSysName(r.sys))}" style="--p:${(r.min / sc.max * 100).toFixed(1)}%"></div>
    <p class="muted tiny" style="margin:0" id="rt-n-${ctx}">${pre ? 'Move the slider to show only wines with at least this rating.' : ratingCountText(ctx)}</p></div>`;
}

function onRatingMin(el) {
  const ctx = el.dataset.ctx;
  if (!rflt(ctx) && el.dataset.sys) U.f[ctx].rating = { sys: el.dataset.sys, min: 0 };
  const r = rflt(ctx);
  if (!r) return;
  r.min = Number(el.value);
  el.style.setProperty('--p', (r.min / rScale(r.sys).max * 100) + '%');
  $('#rt-val-' + ctx).textContent = rFmt(r.sys, r.min);
  $('#rt-n-' + ctx).textContent = ratingCountText(ctx);
  refreshFilterResults(ctx);
}

function onRange(el) {
  const ctx = el.dataset.ctx, k = el.dataset.k;
  const box = $('#rng-' + ctx);
  if (!box) return;
  const [a, b] = box.querySelectorAll('input');
  let lo = Number(a.value), hi = Number(b.value);
  if (lo > hi) { if (el.dataset.end === 'lo') { lo = hi; a.value = lo; } else { hi = lo; b.value = hi; } }
  const max = Number(a.max);
  const st = U.f[ctx];
  st.range = st.range || {};
  if (lo <= 0 && hi >= max) delete st.range[k]; else st.range[k] = [lo, hi];
  box.style.setProperty('--a', (max ? lo / max * 100 : 0) + '%');
  box.style.setProperty('--b', (max ? hi / max * 100 : 0) + '%');
  $('#rng-lo-' + ctx).textContent = money(lo, 0);
  $('#rng-hi-' + ctx).textContent = money(hi, 0);
  $('#rng-n-' + ctx).textContent = rangeCountText(ctx, k);
  refreshFilterResults(ctx);
}

/* ------------------------------------------------------------ view: cellar */

function drinkSoonHtml() {
  if (U.search.trim() || activeCount('cellar')) return '';
  const list = S.wines.filter(w => w.count > 0 && ['Past peak', 'Drink soon'].includes(statusOf(w))).sort(urgencyCmp);
  if (!list.length) return '';
  return `<section><h2>Drink soon <span class="muted small" style="font-weight:400">${list.length}</span></h2><div>${list.map(wineRow).join('')}</div></section>`;
}

function statsHtml() {
  const inStock = S.wines.filter(w => w.count > 0);
  const bottles = inStock.reduce((a, w) => a + w.count, 0);
  const t = totals();
  const cell = (label, value, unit = '', cls = '') => `<div><span class="st-label">${label}</span><b class="${cls}">${value}</b><span class="st-unit">${unit || '&nbsp;'}</span></div>`;
  return `<div class="stats">${cell('Wines', inStock.length)}${cell('Bottles', bottles)}${cell('Total Costs', t.costN ? fmtNum(t.cost, 0) : 'N/A', cur())}${cell('Total Street', t.streetN ? fmtNum(t.street, 0) : 'N/A', cur())}</div>`;
}

function viewCellar() {
  const head = `<header class="top"><div><h1 class="title">Wine Cellar</h1></div>
    <div class="top-actions"><a class="icon-btn magic-btn" href="#/sommelier" aria-label="AI Sommelier">${ICON.magic}</a><button class="icon-btn" data-act="refresh" aria-label="Refresh">${ICON.refresh}</button><a class="icon-btn" href="#/settings" aria-label="Settings">${ICON.gear}</a></div></header>`;
  const notice = S.version && S.version < 15 ? `<div class="card notice"><b>Script update needed</b><p class="small" style="margin:4px 0 0">This app version needs the new Code.gs. Replace the script code and create a new version under Manage deployments.</p></div>` : '';
  if (!S.wines.length) {
    return `<main class="screen has-nav">${head}${notice}<div class="empty"><h2>Your cellar is empty</h2><p>Photograph a label and the details are filled in for you.</p><a class="btn primary" href="#/add">Add your first wine</a></div></main>${nav('cellar')}`;
  }
  const filters = filterArea('cellar');
  const btn = filterButton('cellar');
  const cs = cellarSpace();
  const space = cs.cap ? `<a class="space-card" href="#/settings" aria-label="Cellar space, set in Settings">${fillBarHtml(cs, 'Cellar space')}</a>` : '';
  return `<main class="screen has-nav">${head}${notice}${statsHtml()}${space}
    <div style="display:flex;gap:8px"><label class="search" style="flex:1;min-width:0">${ICON.search}<input type="search" data-input="search" aria-label="Search" placeholder="Search wine, grape or food" value="${esc(U.search)}"></label>${btn}</div>
    ${filters}
    <div id="drink-soon">${drinkSoonHtml()}</div>
    <section><div class="sec-head"><h2>All wines</h2>${sortSelectHtml()}</div><div id="wine-list">${cellarList()}</div></section>
  </main><a class="fab" href="#/add" aria-label="Add a new wine">${ICON.plusBig}</a>${nav('cellar')}`;
}

/* accents do not matter: "Ay" finds "Aÿ" */
const searchNorm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function matches(w, q) {
  if (!q) return true;
  const ins = inEntries(w);
  const p = w.profile || {};
  const hay = searchNorm([w.producer, w.name, w.vintage, w.region, w.grapes, w.type, p.sub, p.style, p.classification, p.vineyard, w.stock.map(e => e.loc).join(' '), ins.map(e => e.retailer + ' ' + e.people).join(' '), w.pairings.join(' '), w.tasteTags.join(' ')].join(' '));
  return searchNorm(q).split(/\s+/).filter(Boolean).every(part => hay.startsWith(part) || hay.includes(' ' + part) || new RegExp(`[^a-z0-9]${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(hay));
}

function priceLine(w) {
  const a = avgPrice(w), s = streetOf(w);
  const cls = a === null || s === null || a === s ? '' : a < s ? 'up' : 'down';
  const part = (label, v, c = '') => `<span class="pp">${label} <b class="${c}">${v}</b></span>`;
  return `<span class="price-row">${part('Ø Cost', a !== null ? fmtNum(a) : 'N/A', cls)}${part('Street', s !== null ? fmtNum(s) : 'N/A')}${w.count > 0 ? pill(w) : ''}</span>`;
}

function wineRow(w) {
  return `<div class="wine-row${w.count === 0 ? ' finished' : ''}">
    <a class="row-link" href="#/wine/${encodeURIComponent(w.id)}">${thumbHtml(w)}<div class="row-text"><span class="row-title">${esc(wineTitle(w))}${isGift(w) ? GIFT_MARK : ''}${w.count === 0 ? FIN : ''}</span><span class="row-sub">${flagOf(w)}${esc(wineSub(w))}</span></div></a>
    <div class="stepper"><button data-act="minus" data-id="${esc(w.id)}" aria-label="Remove a bottle"${w.count ? '' : ' disabled'}>${ICON.minus}</button><span>${w.count}</span><button data-act="plus" data-id="${esc(w.id)}" aria-label="Add bottles">${ICON.plus}</button></div>
    <a class="row-foot" href="#/wine/${encodeURIComponent(w.id)}">${priceLine(w)}</a>
  </div>`;
}

/* sort order of the cellar list, remembered on this device */
const SORTS = { az: 'A-Z', value: 'Value' };
let SORT = (() => { const v = store.get('wc-sort', 'az'); return SORTS[v] ? v : 'az'; })();
function sortCmp(a, b) {
  const az = wineTitle(a).localeCompare(wineTitle(b)) || str(a.vintage).localeCompare(str(b.vintage));
  const desc = (x, y) => (x === null && y === null ? 0 : x === null ? 1 : y === null ? -1 : y - x);
  // value: street price of a single bottle, highest first, wines without one at the end
  if (SORT === 'value') return desc(streetOf(a), streetOf(b)) || az;
  return az;
}
const sortSelectHtml = () => `<label class="sort-sel"><span class="sr-only">Sort by</span>${ICON.sort}<select data-change="sort">${Object.keys(SORTS).map(k => `<option value="${k}"${k === SORT ? ' selected' : ''}>${SORTS[k]}</option>`).join('')}</select></label>`;

function cellarList() {
  const list = S.wines.filter(w => !isDisc(w) && matches(w, U.search) && passes('cellar', w)).sort(sortCmp);
  const stock = list.filter(w => w.count > 0), done = list.filter(w => w.count === 0);
  const filtered = U.search || activeCount('cellar');
  let html = stock.length ? stock.map(wineRow).join('') : `<p class="muted small">${filtered ? 'No wine in stock matches your search or filter.' : 'No bottles in stock.'}</p>`;
  if (done.length) {
    if (U.showFinished) html += done.map(wineRow).join('');
    html += `<button class="btn ghost" data-act="toggle-finished">${U.showFinished ? 'Hide' : 'Show'} finished wines (${done.length})</button>`;
  }
  return html;
}
