'use strict';

/* Wine Cellar: Settings screen, AI usage and export. Loaded after app.js, in the order of index.html. */

/* ------------------------------------------------------------ settings */

function locationsHtml() {
  const used = {};
  S.wines.forEach(w => w.stock.forEach(e => { used[lc(e.loc)] = (used[lc(e.loc)] || 0) + e.n; }));
  const small = 'height:36px;padding:0 12px;font-size:13px';
  const rows = S.locations.map(l => {
    const n = used[lc(l)] || 0;
    const others = S.locations.filter(x => x !== l);
    if (isEditing('loc', l)) { const ex = locInfoEditHtml(l); return `<div class="loc-row">${editRowHtml(l, undefined, ex + (['case', 'short', 'wall'].includes(U.edit.ltype) ? '' : shelfEditHtml(l)))}</div>`; }
    const info = locInfoOf(l), sp = locSpace(l);
    const fill = info.kind === 'short' ? '' : info.capacity ? fillBarHtml(sp) : '<p class="muted tiny" style="margin:0">Add its capacity with the edit button to see how full it is.</p>';
    const ty = locTypeOf(l), zs = zonesOf(l);
    const zoneSum = zs.length ? `<p class="muted tiny loc-zones" style="margin:0">${ICON.temp}${zs.map(z => `${esc(zoneText(z))}, ${esc(shelfRange(l, z))}`).join('; ')}</p>` : '';
    const head = `<div class="between"><span class="set-name"><span class="loc-ic">${locIcon(l)}</span>${esc(l)}${ty && lc(LOC_TYPE_NAME[ty]) !== lc(l) ? `<span class="loc-kind">${esc(ty === 'case' && info.owc ? 'Original case' : LOC_TYPE_NAME[ty])}</span>` : ''} <span class="muted small">${n ? `${n} ${n === 1 ? 'bottle' : 'bottles'}` : 'empty'}</span></span><span style="display:flex;gap:6px;flex:none">${n
      ? `<button class="btn" style="${small}" data-act="loc-show" data-v="${esc(l)}">Show</button><button class="btn" style="${small}" data-act="loc-move-open" data-v="${esc(l)}">Move</button>`
      : `<button class="icon-btn" data-act="loc-del" data-v="${esc(l)}" aria-label="Delete ${esc(l)}">${ICON.trash}</button>`}${editBtn('loc', l)}</span></div>`;
    const move = U.locMove === l ? (others.length
      ? `<div class="move-box"><span class="tiny muted">Move all bottles from ${esc(l)} to</span><div style="display:flex;gap:8px"><label class="field" style="flex:1"><span class="sr-only">Target location</span><select id="move-to">${others.map(o => `<option>${esc(o)}</option>`).join('')}</select></label><button class="btn accent" data-act="loc-move" data-v="${esc(l)}">Move</button><button class="icon-btn" data-act="loc-move-cancel" aria-label="Cancel">${ICON.x}</button></div></div>`
      : `<div class="move-box"><span class="small muted">Add another location first, then move the bottles there.</span></div>`) : '';
    return `<div class="loc-row">${head}${fill}${zoneSum}${move}</div>`;
  }).join('');
  return `<section class="box"><span class="box-title">Locations</span>
    ${rows || '<p class="muted small" style="margin:0">No locations yet. Add where you keep your wine, for example Wine fridge, Basement or Kitchen.</p>'}
    <div style="display:flex;gap:8px;align-items:flex-end"><label class="field" style="flex:1"><span class="sr-only">New location</span><input id="new-loc" placeholder="New location" autocapitalize="words" enterkeyhint="done"></label><button class="btn accent" data-act="loc-add">Add</button></div>
    <p class="muted tiny" style="margin:0">A location can be deleted once no bottles in stock are stored there. Use Move to bring all its bottles to another location first.</p>
  </section>`;
}

function fxNote() {
  return 'All prices are shown in this currency. Prices in other currencies are converted with the current exchange rate, updated daily, so converted amounts change with the rate.';
}

/* settings lists: every entry can be edited, unused ones deleted */
const isEditing = (kind, name) => U.edit && U.edit.kind === kind && U.edit.name === name;
const editBtn = (kind, name) => `<button class="icon-btn" data-act="ed-open" data-k="${kind}" data-v="${esc(name)}" aria-label="Edit ${esc(name)}">${ICON.edit}</button>`;
function editRowHtml(name, website, extra = '') {
  return `<div class="move-box">
    <label class="field">Name<input id="ed-name" value="${esc(U.edit && U.edit.typed !== undefined ? U.edit.typed : name)}" autocapitalize="words" enterkeyhint="done"></label>
    ${website !== undefined ? `<label class="field">Website<input id="ed-site" inputmode="url" autocapitalize="off" placeholder="www.shop.ch" value="${esc(website)}"></label>` : ''}
    ${extra}
    <div class="grid2"><button class="btn" data-act="ed-cancel">Cancel</button><button class="btn accent" data-act="ed-save">Save</button></div>
    <p class="muted tiny" style="margin:0">Renaming also changes all entries in the journal${U.edit && U.edit.kind === 'loc' ? ' and all bottles stored there' : ''}.</p></div>`;
}

/* capacity and kind of a location, edited together with its name */
function locInfoEditHtml(loc) {
  const ed = U.edit;
  if (ed.ltype === undefined) {
    const i = locInfoOf(loc);
    Object.assign(ed, { cap: i.capacity ? String(i.capacity) : '', ltype: i.type || (i.kind === 'short' ? 'short' : ''), zones: (i.zones || []).map(z => Object.assign({}, z)), owc: !!i.owc, zeroBottom: !!i.zeroBottom });
    ed.zoneOn = ed.zones.length > 0;
  }
  const t = ed.ltype;
  const types = `<div class="field"><span>Type</span><div class="chips">${LOC_TYPES.map(([v, l]) => `<button class="chip${t === v ? ' on' : ''}" data-act="loc-type" data-v="${v}" aria-pressed="${t === v}">${LOC_ICON[v]}${l}</button>`).join('')}</div></div>`;
  if (t === 'short') return `${types}<p class="muted tiny" style="margin:0">For bottles that stay only a short time, for example in the kitchen. Not counted as cellar space.</p>`;
  const cap = t === 'case'
    ? `<div class="field"><span>Bottles it holds</span><div class="chips">${['6', '12'].map(n => `<button class="chip${ed.cap === n ? ' on' : ''}" data-act="loc-cap" data-v="${n}">${n}</button>`).join('')}<input id="ed-cap" class="chip-input" data-input="ed-cap" inputmode="numeric" placeholder="Other" aria-label="Other number of bottles" value="${['6', '12'].includes(ed.cap) ? '' : esc(ed.cap)}"></div></div>
      <label class="switch"><input type="checkbox" data-change="loc-owc"${ed.owc ? ' checked' : ''}>Original wooden case of the winery</label>
      <p class="muted tiny" style="margin:-6px 0 0">Wines kept in their original case show it on their page. Collectors pay more for them.</p>`
    : `<label class="field">Capacity, about how many 75 cl bottles<input id="ed-cap" data-input="ed-cap" inputmode="numeric" placeholder="For example 100" value="${esc(ed.cap)}"></label>
      <p class="muted tiny" style="margin:-4px 0 0">A rough estimate is enough. A magnum counts as 1.5 bottles, a half bottle as 0.6, sparkling wine a little more.</p>`;
  const order = t === 'case' || t === 'wall' ? '' : `<div class="field"><span>Shelf 0 is</span><div class="toggle">${[[false, 'The top shelf'], [true, 'The bottom shelf']].map(([v, l]) => `<button class="${!!ed.zeroBottom === v ? 'on' : ''}" data-act="loc-zero" data-v="${v ? 1 : 0}" aria-pressed="${!!ed.zeroBottom === v}">${l}</button>`).join('')}</div></div>
    <p class="muted tiny" style="margin:-4px 0 0">Places lists the shelves from top to bottom, the way you see them.</p>`;
  return `${types}${cap}${order}${t === 'case' || t === 'wall' ? '' : zoneEditHtml(loc)}`;
}

/* shelf names, edited together with the location */
function shelfEditHtml(loc) {
  const ed = U.edit;
  if (!ed.shelves) ed.shelves = Object.assign({}, S.shelfNames[lc(loc)] || {});
  let top = 3;
  S.wines.forEach(w => w.stock.forEach(e => { if (lc(e.loc) === lc(loc) && shelfVal(e.shelf) !== null) top = Math.max(top, shelfVal(e.shelf)); }));
  Object.keys(ed.shelves).forEach(k => { top = Math.max(top, Number(k)); });
  top = Math.max(top, ed.shelfTop || 0);
  ed.shelfTop = top;
  const rows = [];
  for (let n = 0; n <= top; n++) {
    rows.push(`<div class="shelf-row"><span class="muted small">Shelf ${n}</span><label class="field" style="flex:1"><span class="sr-only">Name of shelf ${n}</span><input data-input="ed-shelf" data-n="${n}" placeholder="${n}" value="${esc(ed.shelves[String(n)] || '')}" autocapitalize="sentences"></label></div>`);
  }
  return `<div class="field"><span>Shelves</span><div class="shelf-list">${rows.join('')}</div></div>
    <button class="btn dashed" style="height:40px" data-act="shelf-more">Add shelf</button>
    <p class="muted tiny" style="margin:0">Shelves are numbered from 0. Give them your own names, for example A, B, C or Top, Middle, Bottom. Leave a field empty to use the number.</p>`;
}

async function saveShelfName(loc, n, value) {
  const key = lc(loc);
  const prev = Object.assign({}, S.shelfNames[key] || {});
  const next = Object.assign({}, prev);
  if (value.trim()) next[String(n)] = value.trim(); else delete next[String(n)];
  if (Object.keys(next).length) S.shelfNames[key] = next; else delete S.shelfNames[key];
  persist();
  try {
    const saved = await api('setShelfNames', { name: loc, shelves: next });
    if (saved && Object.keys(saved).length) S.shelfNames[key] = saved; else delete S.shelfNames[key];
    persist();
    toast('Shelf name saved');
  } catch (e) {
    if (Object.keys(prev).length) S.shelfNames[key] = prev; else delete S.shelfNames[key];
    persist();
    refreshView();
    toast('Not saved: ' + e.message);
  }
}

function retailersHtml() {
  const used = {};
  S.removals.forEach(r => { if (r.retailer) used[lc(r.retailer)] = (used[lc(r.retailer)] || 0) + 1; });
  const rows = byName(S.retailers).map(r => {
    if (isEditing('ret', r.name)) return `<div class="loc-row">${editRowHtml(r.name, r.website)}</div>`;
    const n = used[lc(r.name)] || 0;
    const url = retailerSite(r.name);
    return `<div class="loc-row"><div class="between"><span class="set-name">${esc(r.name)} <span class="muted small">${n ? `${n} ${n === 1 ? 'purchase' : 'purchases'}` : 'no purchases'}</span>${url ? `<a class="ret-link small" href="${esc(url)}" target="_blank" rel="noopener">${esc(r.website.replace(/^https?:\/\//i, ''))}${ICON.link}</a>` : '<span class="muted tiny">No website</span>'}</span>
      <span style="display:flex;gap:6px;flex:none">${n ? '' : `<button class="icon-btn" data-act="ret-del" data-v="${esc(r.name)}" aria-label="Delete ${esc(r.name)}">${ICON.trash}</button>`}${editBtn('ret', r.name)}</span></div></div>`;
  }).join('');
  return `<section class="box"><span class="box-title">Retailers</span>
    ${rows || '<p class="muted small" style="margin:0">No retailers yet.</p>'}
    <div class="move-box"><label class="field"><span class="sr-only">New retailer</span><input id="new-ret" placeholder="New retailer, for example a shop or winery" autocapitalize="words"></label>
      <div style="display:flex;gap:8px;align-items:flex-end"><label class="field" style="flex:1"><span class="sr-only">Website</span><input id="new-ret-site" inputmode="url" autocapitalize="off" placeholder="Website (optional)" enterkeyhint="done"></label><button class="btn accent" data-act="ret-add">Add</button></div></div>
    <p class="muted tiny" style="margin:0">A retailer can be deleted once no purchase in the journal uses it.</p>
  </section>`;
}

function peopleHtml() {
  const used = {};
  S.removals.forEach(r => namesOf(r.people).forEach(n => { used[lc(n)] = (used[lc(n)] || 0) + 1; }));
  const rows = byName(knownPeople()).map(p => {
    if (isEditing('person', p.name)) return `<div class="loc-row">${editRowHtml(p.name)}</div>`;
    const n = used[lc(p.name)] || 0;
    return `<div class="loc-row"><div class="between"><span class="set-name">${esc(p.name)} <span class="muted small">${n ? `${n} ${n === 1 ? 'entry' : 'entries'}` : 'no entries'}</span></span>
      <span style="display:flex;gap:6px;flex:none">${n ? '' : `<button class="icon-btn" data-act="person-del" data-v="${esc(p.name)}" aria-label="Delete ${esc(p.name)}">${ICON.trash}</button>`}${editBtn('person', p.name)}</span></div></div>`;
  }).join('');
  return `<section class="box"><span class="box-title">People</span>
    ${rows ? `<div class="set-list">${rows}</div>` : '<p class="muted small" style="margin:0">No people yet.</p>'}
    <div style="display:flex;gap:8px;align-items:flex-end"><label class="field" style="flex:1"><span class="sr-only">New person</span><input id="new-person" placeholder="New person" autocapitalize="words" enterkeyhint="done"></label><button class="btn accent" data-act="person-add">Add</button></div>
    <p class="muted tiny" style="margin:0">A person can be deleted once no journal entry uses the name.</p>
  </section>`;
}

/* renaming, applied locally first and then in the sheet */
function renameLocal(kind, from, to) {
  const eq = v => lc(str(v).trim()) === lc(from);
  if (kind === 'loc') {
    S.locations = S.locations.map(l => (eq(l) ? to : l));
    if (S.shelfNames[lc(from)]) { S.shelfNames[lc(to)] = S.shelfNames[lc(from)]; if (lc(from) !== lc(to)) delete S.shelfNames[lc(from)]; }
    if (S.locInfo[lc(from)]) { S.locInfo[lc(to)] = S.locInfo[lc(from)]; if (lc(from) !== lc(to)) delete S.locInfo[lc(from)]; }
    S.wines.forEach(w => { w.stock.forEach(e => { if (eq(e.loc)) e.loc = to; }); if (eq(w.location)) w.location = to; });
    S.removals.forEach(r => { if (eq(r.loc)) r.loc = to; });
    if (eq(store.get('wc-lastloc', ''))) store.set('wc-lastloc', to);
  } else if (kind === 'ret') {
    S.removals.forEach(r => { if (eq(r.retailer)) r.retailer = to; });
  } else {
    const swap = v => { const out = []; namesOf(v).forEach(n => { const x = eq(n) ? to : n; if (!out.some(y => lc(y) === lc(x))) out.push(x); }); return out.join(', '); };
    S.removals.forEach(r => { r.people = swap(r.people); r.hearts = swap(r.hearts); });
    S.people = S.people.filter(n => !eq(n)).concat(S.people.some(n => lc(n) === lc(to)) ? [] : [to]);
    if (!S.peopleInfo.some(x => lc(x.name) === lc(to))) S.peopleInfo.forEach(x => { if (eq(x.name)) x.name = to; });
  }
}

async function saveEdit() {
  const ed = U.edit;
  if (!ed) return;
  const to = ($('#ed-name').value || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const site = $('#ed-site') ? $('#ed-site').value.trim() : undefined;
  if (!to) { toast('Enter a name.'); return; }
  if (ed.kind === 'loc' && lc(to) !== lc(ed.name) && S.locations.some(l => lc(l) === lc(to))) { toast('This location already exists. Use Move instead.'); return; }
  const sameName = to === ed.name;
  let shelves = null;
  if (ed.kind === 'loc' && ed.shelves) {
    const clean = {};
    Object.keys(ed.shelves).forEach(k => { const v = str(ed.shelves[k]).trim(); if (v) clean[k] = v; });
    if (JSON.stringify(clean) !== JSON.stringify(S.shelfNames[lc(ed.name)] || {})) shelves = clean;
  }
  let info = null;
  if (ed.kind === 'loc' && ed.ltype !== undefined) {
    const now = locInfoOf(ed.name), cap = Math.round(Number(String(ed.cap).replace(/[^\d.]/g, ''))) || null;
    const kind = ed.ltype === 'short' ? 'short' : 'cellar';
    const zones = ed.zoneOn && ed.ltype !== 'case' && ed.ltype !== 'wall' && ed.ltype !== 'short' ? zonesClean(ed.zones) : [];
    const next = { capacity: kind === 'cellar' ? cap : now.capacity, kind, type: ed.ltype, zones, owc: ed.ltype === 'case' && !!ed.owc, zeroBottom: !!ed.zeroBottom };
    if (next.capacity !== now.capacity || kind !== now.kind || next.type !== str(now.type) || JSON.stringify(zones) !== JSON.stringify(now.zones || []) || next.owc !== !!now.owc || next.zeroBottom !== !!now.zeroBottom) info = next;
  }
  if (sameName && !shelves && !info && (site === undefined || site === str((S.retailers.find(r => r.name === ed.name) || {}).website))) { U.edit = null; refreshView(); return; }
  U.edit = null;
  if (ed.kind === 'ret') {
    const r = S.retailers.find(x => x.name === ed.name);
    if (r) { r.name = to; if (site !== undefined) r.website = site; }
  }
  if (!sameName) renameLocal(ed.kind, ed.name, to);
  persist();
  refreshView();
  try {
    if (ed.kind === 'loc') {
      if (!sameName) S.locations = await api('renameLocation', { from: ed.name, to });
      if (info) {
        S.locInfo[lc(to)] = Object.assign({}, locInfoOf(to), info);
        persist();
        refreshView();
        const saved = await api('setLocationInfo', Object.assign({ name: to }, info));
        S.locInfo[lc(to)] = locInfoNorm(saved);
      }
      if (shelves) {
        if (Object.keys(shelves).length) S.shelfNames[lc(to)] = shelves; else delete S.shelfNames[lc(to)];
        persist();
        refreshView();
        const saved = await api('setShelfNames', { name: to, shelves });
        if (saved && Object.keys(saved).length) S.shelfNames[lc(to)] = saved; else delete S.shelfNames[lc(to)];
      }
    }
    else if (ed.kind === 'ret') S.retailers = (await api('renameRetailer', { from: ed.name, to, website: site })).map(x => ({ name: str(x.name), website: str(x.website) })).filter(x => x.name);
    else { S.people = await api('renamePerson', { from: ed.name, to }); sync(true); }
    persist();
    refreshView();
    toast('Saved');
  } catch (e) { toast('Not saved: ' + e.message); sync(true); }
}

/* AI usage of the last months, logged by the script with estimated list prices */
const USAGE_ORDER = ['Wine info', 'Background', 'Street prices', 'Best offer', 'Sommelier', 'Wine list', 'Consultant'];
// earlier names of the same features
const USAGE_OLD = { 'Label details': 'Wine info', 'Taste profiles': 'Wine info' };
function usageMonth(m) {
  const kinds = {};
  Object.keys(m.kinds || {}).forEach(k => {
    const n = USAGE_OLD[k] || k, e = m.kinds[k], t = kinds[n] || (kinds[n] = { calls: 0, searches: 0, usd: 0 });
    t.calls += Number(e.calls) || 0; t.searches += Number(e.searches) || 0; t.usd += Number(e.usd) || 0;
  });
  return { month: m.month, kinds };
}
function usageHtml() {
  if (!S.usage.length) return S.version && S.version < 13 ? '' : `<section class="box"><span class="box-title">AI usage</span><p class="small muted" style="margin:0">No AI requests counted yet.</p></section>`;
  const usd = v => `USD ${fmtNum(v, 2)}`;
  const monthName = m => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); };
  const cur0 = usageMonth(S.usage[0]);
  // every feature with requests, the known ones first, so the rows always add up to the total
  const kinds = USAGE_ORDER.filter(k => cur0.kinds[k]).concat(Object.keys(cur0.kinds).filter(k => !USAGE_ORDER.includes(k) && k !== 'Other').sort(), cur0.kinds.Other ? ['Other'] : []);
  const total = m => Object.values(m.kinds).reduce((a, e) => a + (Number(e.usd) || 0), 0);
  const calls = m => Object.values(m.kinds).reduce((a, e) => a + (Number(e.calls) || 0), 0);
  return `<section class="box"><span class="box-title">AI usage</span>
    <p class="small" style="margin:0"><b>${esc(monthName(cur0.month))}</b>: ${calls(cur0)} requests, about ${usd(total(cur0))}</p>
    ${kinds.length ? `<div class="usage-tab"><div class="usage-row head"><span>Feature</span><span>Requests</span><span>Searches</span><span>Cost</span></div>
      ${kinds.map(k => { const e = cur0.kinds[k]; return `<div class="usage-row"><span>${esc(k)}</span><span>${e.calls}</span><span>${e.searches || 0}</span><span>${usd(e.usd)}</span></div>`; }).join('')}</div>` : ''}
    ${S.usage.slice(1).map(usageMonth).filter(m => calls(m)).map(m => `<p class="small muted" style="margin:0">${esc(monthName(m.month))}: ${calls(m)} requests, about ${usd(total(m))}</p>`).join('')}
    <p class="muted tiny" style="margin:0">Estimated from list prices of the AI service. The Claude Console shows the exact amounts under Usage.</p></section>`;
}

/* everything in one Excel file, built in the app */
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
async function exportExcel() {
  if (U.exporting) return;
  U.exporting = true;
  refreshView();
  try {
    if (!window.XLSX) await loadScript(XLSX_URL, 20000);
    const c = cur();
    const money2 = v => (v === null || v === undefined ? '' : Math.round(v * 100) / 100);
    const wines = S.wines.map(w => {
      const a = avgPrice(w), st = streetOf(w), p = windowParts(w);
      return {
        Producer: w.producer, Wine: w.name, Vintage: w.vintage, Type: w.type, 'Bottle size cl': w.size, Region: w.region, Grapes: w.grapes, Bottles: w.count,
        Storage: w.stock.map(e => `${e.n} × ${placeLabel(e)}`).join('; '), Status: w.count ? statusOf(w) : 'Finished',
        'Drink from': w.drinkFrom ?? '', 'Peak from': w.peakFrom ?? '', 'Peak until': w.peakUntil ?? '', 'Drink until': w.drinkUntil ?? '',
        'My rating %': w.myRating ?? '', 'My favorite': w.myFav ? 'Yes' : '', 'External ratings': w.ratings.map(r => `${r.sys} ${r.score}`).join(', '),
        [`Ø Cost (${c})`]: money2(a), [`Street (${c})`]: money2(st), [`Total Street (${c})`]: st !== null ? money2(st * w.count) : '',
        'Best offer shop': w.offer ? w.offer.shop : '', 'Best offer price': w.offer ? `${w.offer.v} ${w.offer.cur}` : '', 'Best offer link': w.offer ? w.offer.url : '',
        Taste: w.taste, Style: w.tasteTags.join(', '), 'Pairs with': w.pairings.join(', '), 'Food': foodsOf(w).map(k => FOODS[k][0]).join(', '),
        'Main aromas': w.profile ? w.profile.aromas.map(x => `${AROMAS[x.g][0]}${x.n ? ` (${x.n})` : ''}`).join(', ') : '',
        'Body 1 to 5': w.profile && w.profile.body ? w.profile.body : '', 'Tannin 1 to 5': w.profile && w.profile.tannin ? w.profile.tannin : '',
        'Sweetness 1 to 5': w.profile && w.profile.sweet ? w.profile.sweet : '', 'Acidity 1 to 5': w.profile && w.profile.acid ? w.profile.acid : '',
        'Style name': w.profile ? w.profile.style : '', Classification: w.profile ? w.profile.classification : '', 'Alcohol %': w.profile && w.profile.alcohol ? w.profile.alcohol : '', Added: str(w.createdAt).slice(0, 10), 'Has window': p ? 'yes' : 'no'
      };
    });
    const journal = S.removals.slice().sort((a, b) => str(b.date).localeCompare(str(a.date))).map(r => {
      const w = wineById(r.wineId);
      return { Date: r.date, Direction: r.dir === 'in' ? 'In' : 'Out', Type: entryType(r), Wine: w ? fullName(w) : str(r.wineName), Bottles: Number(r.qty) || 1, Location: str(r.loc),
        Occasion: str(r.occasion), People: str(r.people), 'Favorite of': str(r.hearts), Food: str(r.food), Note: str(r.note), Retailer: str(r.retailer),
        Price: r.price === null || r.price === undefined ? '' : r.price, Currency: str(r.priceCur) };
    });
    const locations = S.locations.map(l => ({ Location: l, Bottles: S.wines.reduce((a, w) => a + w.stock.filter(e => lc(e.loc) === lc(l)).reduce((b, e) => b + e.n, 0), 0),
      Kind: locInfoOf(l).kind === 'short' ? 'Short term' : 'Cellar', 'Capacity about': locInfoOf(l).capacity || '',
      'Shelf names': Object.entries(S.shelfNames[lc(l)] || {}).map(([k, v]) => `${k}: ${v}`).join(', ') }));
    const retailers = S.retailers.map(r => ({ Retailer: r.name, Website: r.website }));
    const people = S.people.map(n => ({ Person: n, 'Also called': personInfo(n).aliases, Note: personInfo(n).note }));
    const wish = S.wishlist.map(x => ({ Wine: wishTitle(x), Type: x.type, Region: x.region, Label: x.label, 'Price estimate': x.price ?? '', Currency: x.priceCur, Bottles: x.qty ?? '', Why: x.why,
      'Offer shop': x.offer ? x.offer.shop : '', 'Offer price': x.offer ? x.offer.v : '', 'Offer link': x.offer ? x.offer.url : '' }));
    const wb = XLSX.utils.book_new();
    const add = (rows, name) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'No entries' }]), name);
    add(wines, 'Wines'); add(journal, 'Journal'); add(locations, 'Locations'); add(retailers, 'Retailers'); add(people, 'People'); add(wish, 'Wishlist');
    XLSX.writeFile(wb, `vintary-${todayISO()}.xlsx`);
    toast('Export ready');
  } catch (e) {
    toast('Export failed. Check your connection and try again.');
  }
  U.exporting = false;
  refreshView();
}

function viewSettings(first) {
  const c = CFG || { url: '', token: '' };
  const inStock = S.wines.filter(w => w.count > 0);
  const priced = inStock.filter(w => w.street).length;
  return `<main class="screen${first ? '' : ' has-nav'}" style="gap:16px">
    ${first ? `<div class="brand-hero"><img src="icon-192.png" alt="" width="88" height="88"><b>Vintary</b><span>Your Personal Wine Companion</span><em>Wine, made personal.</em></div>` : `<a class="back" href="#/cellar">${ICON.back}Cellar</a>`}
    <h1 class="title">${first ? 'Connect your cellar' : 'Settings'}</h1>
    ${first ? '' : `<section class="box"><span class="box-title">General</span>
      <div class="field">Currency<button class="pick-btn" data-act="pick-open" data-k="currency"><span class="ellipsis">${esc(cur())} · ${esc(GEO_CURRENCIES[cur()] || cur())}</span>${ICON.chevron}</button></div>
      <p class="muted tiny" style="margin:0">${fxNote()} Switch it, for example, to show your cellar to a friend from abroad.</p>
      <div class="field">Country for shopping<button class="pick-btn" data-act="pick-open" data-k="country"><span class="ellipsis">${flagOfCode(shopCountry())}${esc(shopCountryName())}</span>${ICON.chevron}</button></div>
      <p class="muted tiny" style="margin:0">Street prices, best offers and the AI consultant search shops for this country${GEO_EU.includes(shopCountry()) ? ', including shops in other EU countries that deliver there, with shipping costs' : ''}. Offers you already have stay until you tap Update best offer. On a trip, the sommelier has its own country for Will I like it? and Wine list.</p></section>
      <section class="box"><span class="box-title">Street prices</span>
      <p class="small" style="margin:0">${priced} of ${inStock.length} wines in stock have a street price.</p>
      <button class="btn block" data-act="street-all"${streetRun ? ' disabled' : ''}>${ICON.refresh}${streetRun ? 'Updating…' : 'Update all street prices'}</button>
      <p class="muted tiny" style="margin:0">AI looks up current shop prices on the web, one wine after the other. This costs about USD 0.02 per wine. New wines get their street price automatically.</p></section>`}
    ${first ? '' : locationsHtml()}
    ${first ? '' : retailersHtml()}
    ${first ? '' : peopleHtml()}
    ${first ? '' : wineInfoBoxHtml()}
    ${first ? '' : usageHtml()}
    ${first ? '' : ttSettingsHtml()}
    ${first ? '' : `<section class="box"><span class="box-title">Your data</span>
      <button class="btn block" data-act="export"${U.exporting ? ' disabled' : ''}>${ICON.download}${U.exporting ? 'Preparing file…' : 'Export all data to Excel'}</button>
      <p class="muted tiny" style="margin:0">Downloads one Excel file with your wines, journal, locations, retailers, people and wishlist. Keep it as a backup. The label photos stay in the Labels folder of your Google Drive.</p></section>`}
    ${first ? '' : '<h2 style="font-size:15px;font-weight:600;margin-top:8px">Connection</h2>'}
    <p class="muted" style="margin:0">Paste the web app URL and the token from your Google Apps Script. Both stay on this device.</p>
    <label class="field">Script URL<input id="cfg-url" type="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(c.url)}"></label>
    <label class="field">Token<input id="cfg-token" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(c.token)}"></label>
    <button class="btn primary big block" data-act="connect">${first ? 'Connect' : 'Save and reconnect'}</button>
    ${first ? '' : `<button class="btn block" data-act="reload">Reload data from Google Drive</button>
      <button class="btn danger block" data-act="disconnect">Disconnect this device</button>`}
    ${first ? `<p class="muted tiny center">Vintary ${APP_VERSION}</p>` : `<div class="brand-foot"><img src="icon-192.png" alt="" width="40" height="40"><span><b>Vintary</b> · Wine, made personal.</span><span class="muted tiny">Vintary ${APP_VERSION}${S.version ? ` · script ${S.version}` : ''}</span></div>`}
  </main>${first ? '' : nav(null)}`;
}

/* ------------------------------------------------------------ picker for countries and currencies, with search */

const PICK = { kind: null, q: '' };
const PICK_TITLE = { currency: 'Currency', country: 'Country for shopping', travel: 'Where are you?', share: 'Where is your friend?' };
function openPicker(kind) {
  PICK.kind = kind;
  PICK.q = '';
  renderPicker();
  const q = $('#pick-q');
  if (q) setTimeout(() => q.focus(), 60);
}
function closePicker() { PICK.kind = null; renderPicker(); }
const pickCurrent = () => (PICK.kind === 'currency' ? cur() : PICK.kind === 'travel' ? travelCountry() : PICK.kind === 'share' ? SHARE.cc : shopCountry());
function pickListHtml() {
  const q = lc(PICK.q.trim());
  const now = pickCurrent();
  let items = PICK.kind === 'currency'
    ? CURRENCIES.map(c => ({ v: c, label: `${c} · ${GEO_CURRENCIES[c] || c}`, icon: '' }))
    : Object.keys(GEO_COUNTRIES).map(k => ({ v: k, label: GEO_COUNTRIES[k][0], sub: GEO_COUNTRIES[k][1], icon: flagOfCode(k) }));
  if (PICK.kind === 'currency') items.sort((a, b) => a.v.localeCompare(b.v));
  if (q) items = items.filter(x => lc(x.label).includes(q) || lc(x.v) === q || lc(x.sub || '') === q);
  else items = items.filter(x => x.v === now).concat(items.filter(x => x.v !== now));
  if (!items.length) return '<p class="muted small" style="margin:8px 0">Nothing found.</p>';
  return items.map(x => `<button class="pick-row${x.v === now ? ' on' : ''}" data-act="pick" data-v="${esc(x.v)}">${x.icon}<span class="ellipsis">${esc(x.label)}</span>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}${x.v === now ? ICON.check : ''}</button>`).join('');
}
function renderPicker() {
  const root = $('#pick-root');
  if (!root) return;
  if (!PICK.kind) { root.innerHTML = ''; return; }
  const hint = PICK.kind === 'travel' ? '<p class="muted small" style="margin:0">Will I like it? and Wine list check prices in shops of this country, in its currency. It stays until you change it. A result for another country can then be updated with one tap.</p>' : '';
  root.innerHTML = `<div class="sheet-backdrop" data-act="pick-close"></div>
  <div class="sheet pick-sheet" role="dialog" aria-modal="true" aria-label="${esc(PICK_TITLE[PICK.kind])}">
    <div class="between"><h2 style="font-size:18px;font-weight:600">${esc(PICK_TITLE[PICK.kind])}</h2><button class="icon-btn" data-act="pick-close" aria-label="Close">${ICON.x}</button></div>
    ${hint}
    <label class="search compact">${ICON.search}<input id="pick-q" type="search" data-input="pick-q" placeholder="${PICK.kind === 'currency' ? 'Search currency' : 'Search country'}" autocomplete="off" aria-label="Search"></label>
    <div id="pick-list" class="pick-list">${pickListHtml()}</div>
  </div>`;
}
async function pickChoose(v) {
  const kind = PICK.kind;
  closePicker();
  if (kind === 'share') { SHARE.cc = v; shareRender(); return; }
  if (kind === 'travel') { setTravelCountry(v); sommCountryChanged(); toast(`Prices are now checked in ${SHOP_COUNTRIES[v]}, in ${countryCur(v)}.`); refreshView(); return; }
  if (kind === 'currency') {
    S.settings = Object.assign({}, S.settings, { currency: v });
    persist();
    refreshView();
    try { await api('setSettings', { settings: { currency: v } }); toast('Currency saved. All prices are shown in ' + v + '.'); sync(true); }
    catch (e) { toast('Saved on this device only: ' + e.message); }
    return;
  }
  S.settings = Object.assign({}, S.settings, { country: v });
  persist();
  refreshView();
  try { await api('setSettings', { settings: { country: v } }); toast(`Shops are now searched for ${SHOP_COUNTRIES[v]}.`); }
  catch (e) { toast('Saved on this device only: ' + e.message); }
}
