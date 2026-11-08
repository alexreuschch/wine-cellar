'use strict';
/* Vintary: storage places. Location types, climate zones and the position chips.
   Loaded after settings.js, in the order of index.html. */

/* ---------------------------------------------------------------- location types */

const LOC_TYPES = [
  ['fridge', 'Wine fridge'], ['rack', 'Rack'], ['room', 'Cellar room'], ['cupboard', 'Shelf or cupboard'],
  ['wall', 'Wall rack'], ['case', 'Case'], ['short', 'Short term']
];
const LOC_TYPE_NAME = Object.fromEntries(LOC_TYPES);
const LOC_ICON = {
  fridge: svg('<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M5 9h14M8 5.5v1.5M8 12v3"/>'),
  rack: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 9.2h17M3.5 14.8h17"/><circle cx="8" cy="6.4" r="1.2"/><circle cx="12" cy="6.4" r="1.2"/><circle cx="16" cy="6.4" r="1.2"/><circle cx="8" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="8" cy="17.6" r="1.2"/>'),
  room: svg('<path d="M3 21V9l9-6 9 6v12"/><path d="M8 21v-7h8v7M8 17.5h8"/>'),
  cupboard: svg('<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 9h16M4 15h16"/>'),
  wall: svg('<path d="M12 3v18M12 7l-6-2M12 12l-6-2M12 17l-6-2M12 7l6-2M12 12l6-2M12 17l6-2"/>'),
  case: svg('<path d="M3 9h18v11.5H3zM3 9l2.5-5h13L21 9M9.5 13h5"/>'),
  short: svg('<path d="M5 20h14M7 20V10h10v10M9 10V6h6v4"/>')
};
const locTypeOf = loc => { const i = locInfoOf(loc); return i.type || (i.kind === 'short' ? 'short' : ''); };
const locIcon = loc => LOC_ICON[locTypeOf(loc)] || ICON.pin;
const isCase = loc => locTypeOf(loc) === 'case';
const isOwc = loc => isCase(loc) && !!locInfoOf(loc).owc;

/* ---------------------------------------------------------------- climate zones */

// named by what they are for; the temperatures are where each name usually sits
const ZONE_PRESETS = [['Cellar', 13], ['Red, ready to serve', 16], ['White & rosé', 10], ['Sparkling', 6]];
const zonesOf = loc => locInfoOf(loc).zones || [];
const zoneAt = (loc, shelf) => {
  const s = shelfVal(shelf);
  return s === null ? null : zonesOf(loc).find(z => s >= z.from && s <= z.to) || null;
};
const fmtTemp = t => (t === null || t === undefined || t === '' ? '' : `${Number(t)} °C`);
const zoneText = z => (z ? [z.name, fmtTemp(z.temp)].filter(Boolean).join(' ') : '');
const shelfRange = (loc, z) => (z.from === z.to ? shelfLabel(loc, z.from) : `${shelfLabel(loc, z.from)} to ${shelfText(loc, z.to)}`);

/* which zone suits a wine: by name first, else by temperature */
function zoneFits(z, w) {
  const n = lc(z.name), t = z.temp, ty = w.type;
  if (/cellar/.test(n)) return true;
  if (/sparkl|champ|cr[eé]mant|prosecco/.test(n)) return ty === 'Sparkling';
  if (/white|ros/.test(n)) return ['White', 'Rosé', 'Orange', 'Dessert'].includes(ty);
  if (/red/.test(n)) return ['Red', 'Fortified'].includes(ty);
  if (t === null || t === undefined) return false;
  if (ty === 'Sparkling') return t <= 9;
  if (['White', 'Rosé', 'Orange', 'Dessert'].includes(ty)) return t <= 13;
  return t >= 11;
}
/* the zone to suggest for a wine in a location: the one made for its type, else the general cellar zone */
function zoneSuggest(loc, w) {
  const zs = zonesOf(loc);
  if (!zs.length) return null;
  return zs.find(z => !/cellar/i.test(z.name) && zoneFits(z, w)) || zs.find(z => /cellar/i.test(z.name)) || null;
}
/* a warm zone is fine for a few weeks, not for years */
function zoneWarn(w, loc, shelf) {
  const z = zoneAt(loc, shelf);
  if (!z || z.temp === null || z.temp === undefined || z.temp < 15) return '';
  const p = windowParts(w);
  if (!p || p.u - new Date().getFullYear() < 2) return '';
  return `${z.temp} °C is warm for long storage. Its window runs until ${p.u}.`;
}
/* the line under a storage place in the forms: its zone, or the zone to choose */
function zoneLineHtml(loc, shelf, w, act, i) {
  if (!loc || !zonesOf(loc).length) return '';
  const z = zoneAt(loc, shelf);
  if (z) {
    const warn = zoneWarn(w, loc, shelf);
    return `<p class="zone-line">${ICON.temp}<span>${esc(zoneText(z))}${warn ? `<br><span class="zone-warn">${esc(warn)}</span>` : ''}</span></p>`;
  }
  const s = zoneSuggest(loc, w);
  if (!s) return '';
  return `<p class="zone-line">${ICON.temp}<span>Fits best: ${esc(zoneText(s))}, ${esc(shelfRange(loc, s))}.</span><button class="link-btn" data-act="${act}" data-i="${i === undefined ? '' : i}" data-v="${s.from}">Use it</button></p>`;
}

/* ---------------------------------------------------------------- position chips */

const POS_G = [['side', 'Side', ['Left', 'Center', 'Right']], ['depth', 'Depth', ['Front', 'Back']], ['level', 'Height', ['Upper', 'Middle', 'Lower']]];
const POS_WORDS = { left: 'Left', center: 'Center', centre: 'Center', right: 'Right', front: 'Front', back: 'Back', rear: 'Back', upper: 'Upper', top: 'Upper', middle: 'Middle', mid: 'Middle', lower: 'Lower', bottom: 'Lower' };
const POS_FILL = /^(side|row|level|and|the|of|on|in|at|shelf|part)$/i;

/* text to chips; text with other words stays as it is, under Other */
function posParse(t) {
  const o = { side: [], depth: [], level: [], other: '' };
  const text = str(t).trim();
  if (!text) return o;
  const parts = text.split(/\s*·\s*/);
  const known = [], rest = [];
  parts.forEach(p => {
    const words = p.split(/[\s,;/]+/).filter(Boolean);
    if (words.length && words.every(x => POS_WORDS[lc(x)] || POS_FILL.test(x))) known.push(...words); else rest.push(p);
  });
  known.forEach(x => {
    const k = POS_WORDS[lc(x)];
    if (!k) return;
    const g = POS_G.find(gr => gr[2].includes(k))[0];
    if (!o[g].includes(k)) o[g].push(k);
  });
  o.other = rest.join(' · ');
  return o;
}
/* a position as it is shown: the chip form when it can be read, else the text as it was entered */
const posShow = p => { const t = str(p).trim(); if (!t) return ''; return posFormat(posParse(t)) || t; };
/* chips to text: a full group says nothing, so it is left out */
function posFormat(o) {
  const parts = POS_G.map(([g, , vals]) => {
    const v = vals.filter(x => o[g].includes(x));
    if (!v.length || v.length === vals.length) return '';
    return v.length === 1 ? v[0] : `${v.slice(0, -1).join(', ')} and ${v[v.length - 1].toLowerCase()}`;
  }).filter(Boolean);
  if (str(o.other).trim()) parts.push(str(o.other).trim());
  return parts.join(' · ');
}

/* the chip panel opens under one storage place at a time; key 'st-2' for the form, 'rs' for the bottle sheet */
const POSUI = { k: null };
function posGet(k) {
  if (k === 'rs') return RS ? RS.pos : '';
  if (k === 'mv') return PMOVE.to.pos;
  const i = Number(str(k).slice(3));
  return D && D.stock[i] ? D.stock[i].pos : '';
}
function posSet(k, v) {
  if (k === 'rs') { if (RS) RS.pos = v; return; }
  if (k === 'mv') { PMOVE.to.pos = v; return; }
  const i = Number(str(k).slice(3));
  if (D && D.stock[i]) D.stock[i].pos = v;
}
function posRerender(k) { if (k === 'rs') renderSheet(); else if (k === 'mv') plRefresh(); else renderStockBox(); }

function posFieldHtml(k) {
  const v = posGet(k), open = POSUI.k === k;
  return `<div class="field">Position<button class="pos-btn${open ? ' on' : ''}" data-act="pos-open" data-k="${k}" aria-expanded="${open}"><span class="ellipsis${v ? '' : ' muted'}">${esc(v || 'Anywhere')}</span>${ICON.chevron}</button></div>`;
}
function posPanelHtml(k) {
  if (POSUI.k !== k) return '';
  const o = posParse(posGet(k));
  const groups = POS_G.map(([g, label, vals]) => {
    const none = !o[g].length;
    return `<div class="pos-g"><span class="pos-gl">${label}</span><div class="chips">
      <button class="chip${none ? ' on' : ''}" data-act="pos-chip" data-k="${k}" data-g="${g}" data-v="" aria-pressed="${none}">All</button>
      ${vals.map(v => `<button class="chip${o[g].includes(v) ? ' on' : ''}" data-act="pos-chip" data-k="${k}" data-g="${g}" data-v="${v}" aria-pressed="${o[g].includes(v)}">${v}</button>`).join('')}</div></div>`;
  }).join('');
  return `<div class="pos-panel">${groups}
    <label class="field">Other<input data-input="pos-other" data-k="${k}" placeholder="For example next to the door" value="${esc(o.other)}" autocapitalize="sentences" enterkeyhint="done"></label>
    <p class="muted tiny" style="margin:0">All means the whole width, depth or height. Two chips say it lies on both, for example lower and middle. Choosing every chip of a group turns it back to All.</p>
    <button class="btn" data-act="pos-done">Done</button></div>`;
}

const PL_ACTS = {
  'pos-open': el => { const k = el.dataset.k; POSUI.k = POSUI.k === k ? null : k; posRerender(k); },
  'pos-done': () => { const k = POSUI.k; POSUI.k = null; if (k) posRerender(k); },
  'pos-chip': el => {
    const k = el.dataset.k, g = el.dataset.g, v = el.dataset.v;
    const o = posParse(posGet(k));
    if (!v) o[g] = [];
    else {
      o[g] = o[g].includes(v) ? o[g].filter(x => x !== v) : o[g].concat(v);
      const all = POS_G.find(x => x[0] === g)[2];
      if (all.every(x => o[g].includes(x))) { o[g] = []; toast(`Every ${POS_G.find(x => x[0] === g)[1].toLowerCase()} chip is the same as All.`, 2500); }
    }
    posSet(k, posFormat(o));
    posRerender(k);
  },
  'st-zone': el => { const i = Number(el.dataset.i); if (D && D.stock[i]) { D.stock[i].shelf = Number(el.dataset.v); renderStockBox(); } },
  'rs-zone': el => { if (RS) { RS.shelf = Number(el.dataset.v); renderSheet(); } }
};
const PL_INPUTS = {
  'pos-other': el => {
    const k = el.dataset.k, o = posParse(posGet(k));
    o.other = el.value;
    posSet(k, posFormat(o));
    const b = document.querySelector(`.pos-btn[data-k="${k}"] .ellipsis`);
    if (b) { const v = posGet(k); b.textContent = v || 'Anywhere'; b.classList.toggle('muted', !v); }
  }
};

/* ---------------------------------------------------------------- zones in Settings, edited with the location */

const keepName = () => { const i = $('#ed-name'); if (i && U.edit) U.edit.typed = i.value; };
function zonesClean(zs) {
  return (zs || []).filter(z => str(z.name).trim()).slice(0, 3).map(z => {
    const from = Math.max(0, Number(z.from) || 0), to = Math.max(from, Number(z.to) || from), t = Number(String(z.temp).replace(',', '.'));
    return { name: str(z.name).trim(), temp: z.temp === '' || z.temp === null || z.temp === undefined || !isFinite(t) ? null : Math.round(t * 10) / 10, from, to };
  });
}
function zoneEditHtml(loc) {
  const ed = U.edit;
  const sw = `<label class="switch"><input type="checkbox" data-change="zone-on"${ed.zoneOn ? ' checked' : ''}>Climate zones</label>`;
  if (!ed.zoneOn) return `<div class="field" style="gap:0">${sw}<p class="muted tiny" style="margin:0">For a wine fridge or cellar with areas at different temperatures. Bottles then get the zone of their shelf.</p></div>`;
  const step = (act, i, v) => `<div class="stepper"><button data-act="${act}" data-i="${i}" data-d="-1" aria-label="Lower">${ICON.minus}</button><span class="shelf-val">${esc(shelfText(loc, v))}</span><button data-act="${act}" data-i="${i}" data-d="1" aria-label="Higher">${ICON.plus}</button></div>`;
  const rows = ed.zones.map((z, i) => {
    const preset = ZONE_PRESETS.some(p => p[0] === z.name);
    const own = !preset || z.own;
    return `<div class="zone-ed">
      <div class="chips">${ZONE_PRESETS.map(p => `<button class="chip${z.name === p[0] && !z.own ? ' on' : ''}" data-act="zone-name" data-i="${i}" data-v="${esc(p[0])}">${esc(p[0])}</button>`).join('')}<button class="chip${own ? ' on' : ''}" data-act="zone-own" data-i="${i}">Own name</button></div>
      ${own ? `<label class="field">Name<input data-input="zone-name" data-i="${i}" placeholder="For example Upper zone" value="${esc(preset && !z.own ? '' : z.name)}" autocapitalize="sentences"></label>` : ''}
      <div class="zone-grid">
        <label class="field">°C<input data-input="zone-temp" data-i="${i}" inputmode="decimal" placeholder="12" value="${esc(z.temp === null || z.temp === undefined ? '' : String(z.temp))}"></label>
        <div class="field">From shelf${step('zone-from', i, z.from)}</div>
        <div class="field">To shelf${step('zone-to', i, z.to)}</div>
      </div>
      <button class="link-btn" style="align-self:flex-start" data-act="zone-rm" data-i="${i}">${ICON.trash}Remove zone</button></div>`;
  }).join('');
  return `<div class="field" style="gap:8px">${sw}${rows}
    ${ed.zones.length < 3 ? `<button class="btn dashed" style="height:40px" data-act="zone-add">Add zone</button>` : ''}
    <p class="muted tiny" style="margin:0">Typical: Cellar 12 to 14 °C for keeping any wine long, Red ready to serve 15 to 18 °C, White & rosé 8 to 12 °C, Sparkling 5 to 8 °C.</p></div>`;
}
Object.assign(PL_ACTS, {
  'loc-type': el => { if (!U.edit) return; keepName(); U.edit.ltype = el.dataset.v; if (el.dataset.v === 'case' && !['6', '12'].includes(U.edit.cap) && !U.edit.cap) U.edit.cap = '6'; refreshView(); },
  'loc-zero': el => { if (!U.edit) return; keepName(); U.edit.zeroBottom = el.dataset.v === '1'; refreshView(); },
  'loc-cap': el => { if (!U.edit) return; keepName(); U.edit.cap = el.dataset.v; refreshView(); },
  'zone-add': () => {
    const ed = U.edit; if (!ed) return; keepName();
    const last = ed.zones[ed.zones.length - 1], from = last ? last.to + 1 : 0;
    const used = ed.zones.map(z => z.name), p = ZONE_PRESETS.find(x => !used.includes(x[0])) || ZONE_PRESETS[0];
    ed.zones.push({ name: p[0], temp: p[1], from, to: from });
    refreshView();
  },
  'zone-rm': el => { const ed = U.edit; if (!ed) return; keepName(); ed.zones.splice(Number(el.dataset.i), 1); if (!ed.zones.length) ed.zoneOn = false; refreshView(); },
  'zone-name': el => { const z = U.edit && U.edit.zones[Number(el.dataset.i)]; if (!z) return; keepName(); const p = ZONE_PRESETS.find(x => x[0] === el.dataset.v); z.name = p[0]; z.temp = p[1]; z.own = false; refreshView(); },
  'zone-own': el => { const z = U.edit && U.edit.zones[Number(el.dataset.i)]; if (!z) return; keepName(); if (!z.own && ZONE_PRESETS.some(p => p[0] === z.name)) z.name = ''; z.own = true; refreshView(); },
  'zone-from': el => { const z = U.edit && U.edit.zones[Number(el.dataset.i)]; if (!z) return; keepName(); z.from = clamp(z.from + Number(el.dataset.d), 0, 99); if (z.to < z.from) z.to = z.from; refreshView(); },
  'zone-to': el => { const z = U.edit && U.edit.zones[Number(el.dataset.i)]; if (!z) return; keepName(); z.to = clamp(z.to + Number(el.dataset.d), z.from, 99); refreshView(); }
});
Object.assign(PL_INPUTS, {
  'zone-name': el => { const z = U.edit && U.edit.zones[Number(el.dataset.i)]; if (z) { z.name = el.value; z.own = true; } },
  'zone-temp': el => { const z = U.edit && U.edit.zones[Number(el.dataset.i)]; if (z) z.temp = el.value; }
});
const PL_CHANGES = {
  'zone-on': el => {
    const ed = U.edit; if (!ed) return; keepName();
    ed.zoneOn = el.checked;
    if (ed.zoneOn && !ed.zones.length) ed.zones = [{ name: ZONE_PRESETS[3][0], temp: ZONE_PRESETS[3][1], from: 0, to: 1 }, { name: ZONE_PRESETS[2][0], temp: ZONE_PRESETS[2][1], from: 2, to: 4 }];
    refreshView();
  },
  'loc-owc': el => { if (U.edit) { keepName(); U.edit.owc = el.checked; } }
};

/* ---------------------------------------------------------------- cases: a wine kept in its box */

async function newCasePrompt() {
  const f = D ? D.fields : {};
  const def = [f.producer, f.name, f.vintage].filter(x => str(x).trim()).join(' ') || 'Case';
  const name = (prompt('Name of the case, for example the wine in it', def) || '').replace(/\s+/g, ' ').trim();
  if (!name) return '';
  if (S.locations.some(l => lc(l) === lc(name))) { toast('A location with this name exists already.'); return ''; }
  const owc = confirm('Is it the original wooden case of the winery? OK for yes, Cancel for no.');
  const n = D ? D.stock.reduce((a, e) => a + (Number(e.n) || 0), 0) : 0, cap = n > 6 ? 12 : 6;
  S.locations.push(name);
  S.locInfo[lc(name)] = { capacity: cap, kind: 'cellar', type: 'case', zones: [], owc, checked: '' };
  persist();
  api('addLocation', { name })
    .then(list => { S.locations = list; return api('setLocationInfo', { name, capacity: cap, kind: 'cellar', type: 'case', owc }); })
    .then(saved => { if (saved) S.locInfo[lc(name)] = locInfoNorm(saved); persist(); })
    .catch(e => toast('Case saved on this device only: ' + e.message));
  return name;
}
/* a case that runs empty is usually thrown away, so offer to tidy up */
function caseEmptyNote(loc) {
  if (!loc || !isCase(loc)) return;
  const left = S.wines.reduce((a, w) => a + w.stock.filter(e => lc(e.loc) === lc(loc)).reduce((b, e) => b + e.n, 0), 0);
  if (!left) setTimeout(() => toast(`The case ${loc} is empty now. You can delete it in Settings under Locations.`, 6000), 1200);
}
Object.assign(PL_ACTS, {
  'st-add-case': async () => {
    if (!D) return;
    const name = await newCasePrompt();
    if (name) D.stock.push({ loc: name, shelf: null, pos: '', n: D.mode === 'edit' ? 0 : 1 });
    D.addLoc = false;
    renderStockBox();
  }
});

/* ---------------------------------------------------------------- the places view in the cellar */

// the cellar always opens as the list; Places is chosen when needed
let CVIEW = 'list';
const stripeColor = w => typeTint(w);
/* a muted band per zone, cool for sparkling, warm for red */
function zoneColor(z) {
  const n = lc(z.name), t = z.temp;
  if (/sparkl|champ/.test(n) || (t !== null && t <= 8)) return '#9FB4CC';
  if (/white|ros/.test(n) || (t !== null && t <= 12)) return '#A9C3A3';
  if (/red/.test(n) || (t !== null && t >= 15)) return '#D08E8B';
  return '#BFA884';
}
const cviewToggleHtml = () => `<div class="cview" role="group" aria-label="View"><button class="${CVIEW === 'list' ? 'on' : ''}" data-act="cview" data-v="list" aria-pressed="${CVIEW === 'list'}" aria-label="List">${ICON.list}</button><button class="${CVIEW === 'places' ? 'on' : ''}" data-act="cview" data-v="places" aria-pressed="${CVIEW === 'places'}" aria-label="Places">${LOC_ICON.rack}</button></div>`;

/* folded locations, remembered on this phone; a search, the filter or a check opens them */
const FOLD = new Set((() => { const v = store.get('wc-pl-fold', []); return Array.isArray(v) ? v : []; })());
const isFolded = (loc, filtered, checking) => FOLD.has(lc(loc)) && !filtered && !U.onlyDue && !checking;

/* the check: place by place, every wine there with its count */
const PCHK = { loc: null, counts: {}, ok: {} };
/* moving many bottles at once: how many of each go, and where to */
const PMOVE = { loc: null, sel: {}, to: { loc: '', shelf: null, pos: '' } };
const plRefresh = () => { const l = $('#wine-list'); if (l) l.innerHTML = cellarList(); };
const mvVal = key => PMOVE.sel[key] || 0;
function mvList() {
  const out = [];
  S.wines.forEach(w => w.stock.forEach((e, i) => { const n = Math.min(mvVal(chkKey(w, i)), e.n); if (n > 0 && lc(e.loc) === lc(PMOVE.loc)) out.push({ w, e, i, n }); }));
  return out;
}
const mvCount = () => mvList().reduce((a, x) => a + x.n, 0);
const chkKey = (w, i) => `${w.id}|${i}`;
const chkVal = (w, i) => (PCHK.counts[chkKey(w, i)] !== undefined ? PCHK.counts[chkKey(w, i)] : w.stock[i].n);
function chkChanges() {
  let n = 0;
  S.wines.forEach(w => w.stock.forEach((e, i) => { if (lc(e.loc) === lc(PCHK.loc) && chkVal(w, i) !== e.n) n++; }));
  return n;
}

function placesHtml() {
  const filtered = U.search || activeCount('cellar');
  const list = S.wines.filter(w => !isDisc(w) && w.count > 0 && matches(w, U.search) && passes('cellar', w) && (!U.onlyDue || URGENT.includes(statusOf(w))));
  const by = {};
  list.forEach(w => w.stock.forEach((e, i) => { if (e.n > 0) (by[lc(e.loc)] = by[lc(e.loc)] || []).push({ w, e, i }); }));
  const locs = S.locations.filter(l => by[lc(l)]).concat(Object.keys(by).filter(k => !S.locations.some(l => lc(l) === k)).map(k => by[k][0].e.loc));
  const only = U.onlyDue ? `<button class="chip on pl-only" data-act="pl-due-off" aria-label="Show all bottles again">Only bottles to open${ICON.x}</button>` : '';
  if (!locs.length) return `${only ? `<div class="pl-tools">${only}</div>` : ''}<p class="muted small">${U.onlyDue ? 'No bottle needs to be opened soon.' : filtered ? 'No wine in stock matches your search or filter.' : 'No bottles in stock.'}</p>`;
  // the stripe shows the type, the chip under the count the drinking window, so no colour switch is needed
  return `${only ? `<div class="pl-tools">${only}</div>` : ''}
    ${locs.map(l => placeCardHtml(l, by[lc(l)], filtered)).join('')}`;
}

function placeCardHtml(loc, items, filtered) {
  const info = locInfoOf(loc), sp = locSpace(loc), ty = locTypeOf(loc);
  const checking = !!PCHK.loc && lc(PCHK.loc) === lc(loc);
  const moving = !checking && !!PMOVE.loc && lc(PMOVE.loc) === lc(loc);
  const sh = {};
  items.forEach(x => { const s = shelfVal(x.e.shelf); const k = s === null ? 'none' : String(s); (sh[k] = sh[k] || []).push(x); });
  const keys = Object.keys(sh).filter(k => k !== 'none').map(Number).sort((a, b) => (info.zeroBottom ? b - a : a - b)).map(String);
  if (sh.none) keys.push('none');
  const sub = [ty && lc(LOC_TYPE_NAME[ty]) !== lc(loc) ? (ty === 'case' && info.owc ? 'Original wooden case' : LOC_TYPE_NAME[ty]) : '', info.checked ? `Checked on ${fmtDate(info.checked)}` : ''].filter(Boolean).join(' · ');
  const fold = isFolded(loc, filtered, checking || moving);
  const head = `<button class="pl-head" data-act="pl-fold" data-v="${esc(loc)}" aria-expanded="${!fold}" aria-label="${fold ? 'Open' : 'Fold'} ${esc(loc)}"><span class="loc-ic">${locIcon(loc)}</span><span class="pl-name"><b>${esc(loc)}</b>${sub ? `<span class="tiny muted">${esc(sub)}</span>` : ''}</span><span class="pl-count"><b>${sp.cap ? `${sp.bottles}/${sp.cap}` : sp.bottles}</b><small>${sp.bottles === 1 && !sp.cap ? 'bottle' : 'bottles'}</small></span><span class="pl-chev${fold ? '' : ' open'}">${ICON.chevron}</span></button>`;
  const fill = sp.cap && info.kind !== 'short' ? `<div class="fill-bar ${fillCls(sp.pct)}"><i style="width:${Math.max(2, sp.pct)}%"></i></div>` : '';
  const dueLine = checking || moving ? '' : dueHtml(items, false);
  const body = keys.map(k => shelfBlockHtml(loc, k, sh[k], checking, keys.length === 1, moving)).join('');
  const n = checking ? chkChanges() : 0;
  const foot = checking
    ? `<p class="small" style="margin:0">Count what lies here. Tap ✓ when a number is right, or change it with minus and plus. Wines that are not here: set them to 0.</p>
      <div class="grid2"><button class="btn" data-act="chk-cancel">Cancel</button><button class="btn primary" data-act="chk-done">${n ? `Done, ${n} ${n === 1 ? 'change' : 'changes'}` : 'Done, all right'}</button></div>`
    : moving ? mvFootHtml()
    : filtered || U.onlyDue ? '' : `<div class="pl-acts"><button class="btn ghost pl-check" data-act="chk-start" data-v="${esc(loc)}">${ICON.check}Check this place</button><button class="btn ghost pl-check" data-act="bm-start" data-v="${esc(loc)}">${ICON.move}Move bottles</button></div>`;
  if (fold) return `<section class="pl-card folded" id="pl-${esc(lc(loc).replace(/[^a-z0-9]+/g, '-'))}">${head}${fill}${dueLine}</section>`;
  if (moving) return `<section class="pl-card checking moving" id="pl-${esc(lc(loc).replace(/[^a-z0-9]+/g, '-'))}">${head}<p class="small" style="margin:0">Choose how many bottles of each wine go. <b>All</b> takes a whole shelf. Then choose where they go.</p>${body}${foot}</section>`;
  return `<section class="pl-card${checking ? ' checking' : ''}" id="pl-${esc(lc(loc).replace(/[^a-z0-9]+/g, '-'))}">${head}${fill}${dueLine}${checking ? foot.split('<div class="grid2">')[0] : ''}${body}${checking ? '<div class="grid2">' + foot.split('<div class="grid2">')[1] : foot}</section>`;
}

/* the order of a shelf as far as the position tells it: left to right, front to back, top to bottom */
const POS_RANK = { Left: 0, Center: 1, Right: 2, Front: 0, Back: 1, Upper: 0, Middle: 1, Lower: 2 };
function posRank(p) {
  const o = posParse(p), r = g => (o[g].length ? Math.min(...o[g].map(v => POS_RANK[v])) : 9);
  return [r('side'), r('depth'), r('level'), o.other ? 1 : 0];
}
const URGENT = ['Past its window', 'Drink soon'];
/* what should be opened, said exactly and in the colour of its status; a tap shows only those bottles */
function dueHtml(items, short) {
  const n = st => items.reduce((a, x) => a + (statusOf(x.w) === st ? x.e.n : 0), 0);
  const past = n('Past its window'), soon = n('Drink soon');
  if (!past && !soon) return '';
  const parts = [];
  if (past) parts.push(`<span style="color:${STATUS['Past its window'].c}">${past} past ${short ? 'window' : past === 1 ? 'its window' : 'their window'}</span>`);
  if (soon) parts.push(`<span style="color:${STATUS['Drink soon'].c}">${soon} drink soon</span>`);
  const txt = parts.join('<span class="muted"> · </span>');
  return U.onlyDue ? `<span class="pl-due${short ? ' sm' : ''}">${txt}</span>` : `<button class="pl-due${short ? ' sm' : ''}" data-act="pl-due" aria-label="Show only the bottles to open">${txt}</button>`;
}
function shelfBlockHtml(loc, k, xs, checking, only, moving) {
  const s = k === 'none' ? null : Number(k), z = s === null ? null : zoneAt(loc, s);
  const title = s === null ? (isCase(loc) || only ? '' : 'No shelf') : shelfLabel(loc, s);
  xs = xs.slice().sort((a, b) => { const ra = posRank(a.e.pos), rb = posRank(b.e.pos); for (let j = 0; j < ra.length; j++) if (ra[j] !== rb[j]) return ra[j] - rb[j]; return wineTitle(a.w).localeCompare(wineTitle(b.w)) || str(a.w.vintage).localeCompare(str(b.w.vintage)); });
  const n = xs.reduce((a, x) => a + x.e.n, 0);
  const count = `${n} ${n === 1 ? 'bottle' : 'bottles'}`;
  const due = checking || moving ? '' : dueHtml(xs, true);
  const allOn = moving && xs.every(x => mvVal(chkKey(x.w, x.i)) >= x.e.n);
  const rows = xs.map(x => {
    const meta = [x.w.vintage, posShow(x.e.pos)].filter(Boolean).join(' · ');
    if (moving) {
      const key = chkKey(x.w, x.i), v = Math.min(mvVal(key), x.e.n);
      return `<div class="chk-row${v ? ' changed' : ''}" style="--tc:${stripeColor(x.w)}">${thumbHtml(x.w, true)}<span class="pl-wt"><span class="pl-wn">${esc(wineTitle(x.w))}</span><span class="tiny muted">${esc(meta)}${meta ? ' · ' : ''}${x.e.n} here</span></span>
        <div class="stepper sm"><button data-act="bm-n" data-k="${esc(key)}" data-d="-1" aria-label="Move fewer">${ICON.minus}</button><span>${v}</span><button data-act="bm-n" data-k="${esc(key)}" data-d="1" aria-label="Move more">${ICON.plus}</button></div></div>`;
    }
    if (checking) {
      const key = chkKey(x.w, x.i), v = chkVal(x.w, x.i), ok = PCHK.ok[key] && v === x.e.n;
      return `<div class="chk-row${ok ? ' ok' : ''}${v !== x.e.n ? ' changed' : ''}" style="--tc:${stripeColor(x.w)}">${thumbHtml(x.w, true)}<span class="pl-wt"><span class="pl-wn">${esc(wineTitle(x.w))}</span><span class="tiny muted">${esc(meta)}${v !== x.e.n ? ` · was ${x.e.n}` : ''}</span></span>
        <div class="stepper sm"><button data-act="chk-n" data-k="${esc(key)}" data-d="-1" aria-label="Fewer">${ICON.minus}</button><span>${v}</span><button data-act="chk-n" data-k="${esc(key)}" data-d="1" aria-label="More">${ICON.plus}</button></div>
        <button class="chk-ok${ok ? ' on' : ''}" data-act="chk-ok" data-k="${esc(key)}" aria-label="The number is right" aria-pressed="${!!ok}">${ICON.check}</button></div>`;
    }
    const id = esc(x.w.id), place = esc(placeLabel(x.e));
    return `<div class="pl-wine" style="--tc:${stripeColor(x.w)}"><a class="pl-link" href="#/wine/${encodeURIComponent(x.w.id)}">${thumbHtml(x.w, true)}<span class="pl-wt"><span class="pl-wn">${esc(wineTitle(x.w))}</span><span class="pl-meta">${esc(meta)}</span></span></a>
      <div class="pl-end"><div class="stepper sm"><button data-act="minus" data-id="${id}" data-i="${x.i}" aria-label="Take a bottle from ${place}">${ICON.minus}</button><span>${x.e.n}</span><button data-act="plus" data-id="${id}" data-i="${x.i}" aria-label="Add bottles to ${place}">${ICON.plus}</button></div><a class="pl-pill" href="#/wine/${encodeURIComponent(x.w.id)}" aria-label="Open ${esc(wineTitle(x.w))}">${pill(x.w)}</a></div></div>`;
  }).join('');
  const zc = z ? ` style="--zc:${zoneColor(z)}"` : '';
  const all = moving ? `<button class="chip bm-all${allOn ? ' on' : ''}" data-act="bm-all" data-keys="${esc(xs.map(x => chkKey(x.w, x.i)).join(','))}" aria-pressed="${allOn}">All</button>` : '';
  return `<div class="pl-shelf"${zc}><div class="pl-sh"><span>${title ? `${esc(title)} · ` : ''}<span class="pl-cnt">${count}</span>${due ? ` <span class="muted">·</span> ${due}` : ''}</span>${all || (z ? `<span class="pl-zone">${ICON.temp}${esc(zoneText(z))}</span>` : '')}</div>${rows}</div>`;
}

async function chkSave() {
  const loc = PCHK.loc;
  const changed = S.wines.filter(w => w.stock.some((e, i) => lc(e.loc) === lc(loc) && chkVal(w, i) !== e.n));
  const done = () => { PCHK.loc = null; PCHK.counts = {}; PCHK.ok = {}; };
  if (!changed.length) {
    done(); markChecked(loc); refreshView();
    toast(`${loc} checked, everything is right.`);
    return;
  }
  busy(true, 'Saving…');
  try {
    for (const w of changed) {
      const stock = w.stock.map((e, i) => Object.assign({}, e, { n: lc(e.loc) === lc(loc) ? chkVal(w, i) : e.n })).filter(e => e.n > 0);
      const count = stock.reduce((a, e) => a + e.n, 0);
      const next = Object.assign({}, w, { stock, count });
      const delta = count - w.count;
      // what the check found is its own journal entry; purchases stay as they were
      const entries = delta ? [{ id: newId(delta > 0 ? 'i' : 'r'), wineId: w.id, dir: delta > 0 ? 'in' : 'out', type: 'Correction', qty: Math.abs(delta), loc, date: todayISO(), price: '', priceCur: '', wineName: fullName(w), note: `${delta > 0 ? 'Found' : 'Missing'} in the check of ${loc}` }] : [];
      const d = await api('saveWine', { wine: serialWine(next), image: null, entries });
      upsertWine(normWine(d.wine || d));
      (d.entries || []).map(normRemoval).forEach(r => { S.removals = S.removals.filter(x => x.id !== r.id).concat([r]); });
    }
    persist();
    done(); markChecked(loc);
    busy(false);
    refreshView();
    toast(`${loc} checked, ${changed.length} ${changed.length === 1 ? 'wine' : 'wines'} corrected.`);
  } catch (e) {
    busy(false);
    toast('Not saved: ' + e.message);
  }
}
/* where the chosen bottles go: location, shelf and position, with a warning when it is too full */
function mvFootHtml() {
  const n = mvCount(), to = PMOVE.to, list = mvList();
  const locs = S.locations.slice();
  const chips = locs.map(l => `<button class="chip${lc(l) === lc(to.loc) ? ' on' : ''}" data-act="bm-loc" data-v="${esc(l)}">${locIcon(l)}${esc(l)}</button>`).join('');
  let room = '';
  if (to.loc && n && lc(to.loc) !== lc(PMOVE.loc)) {
    const sp = locSpace(to.loc), need = list.reduce((a, x) => a + x.n * spaceOf(x.w), 0);
    if (sp.cap && sp.kind !== 'short' && need > sp.free) room = `<p class="space-note warn">${ICON.info}<span>${esc(to.loc)} has about ${sp.free} ${sp.free === 1 ? 'place' : 'places'} free, you move ${n} ${n === 1 ? 'bottle' : 'bottles'}.</span></p>`;
  }
  const same = to.loc && list.length && list.every(x => samePlace(x.e, to));
  const where = to.loc ? placeLabel(to) : '';
  return `<div class="mv-to"><span class="small muted">Move to</span><div class="chips">${chips}</div>
    ${to.loc && !isCase(to.loc) ? `<div class="store-row"><div class="field">Shelf (optional)<div class="stepper"><button data-act="bm-shelf" data-d="-1" aria-label="Shelf down">${ICON.minus}</button><span class="shelf-val">${esc(shelfText(to.loc, to.shelf))}</span><button data-act="bm-shelf" data-d="1" aria-label="Shelf up">${ICON.plus}</button></div></div>${posFieldHtml('mv')}</div>${posPanelHtml('mv')}` : ''}
    ${room}${same ? '<p class="small muted" style="margin:0">That is where they are already.</p>' : ''}</div>
    <div class="grid2"><button class="btn" data-act="bm-cancel">Cancel</button><button class="btn primary" data-act="bm-done"${!n || !to.loc || same ? ' disabled' : ''}>${n ? `Move ${n} ${n === 1 ? 'bottle' : 'bottles'}` : 'Move'}</button></div>
    ${n && where ? `<p class="tiny muted" style="margin:0;text-align:center">${n} ${n === 1 ? 'bottle' : 'bottles'} to ${esc(where)}</p>` : ''}`;
}
async function mvSave() {
  const list = mvList(), to = { loc: PMOVE.to.loc, shelf: PMOVE.to.shelf, pos: PMOVE.to.pos };
  if (!list.length || !to.loc) return;
  const n = mvCount();
  const byWine = new Map();
  list.forEach(x => { if (!samePlace(x.e, to)) (byWine.get(x.w) || byWine.set(x.w, []).get(x.w)).push(x); });
  busy(true, 'Moving…');
  try {
    for (const [w, xs] of byWine) {
      // take them from where they are, put them to the new place, together with bottles already there
      const stock = w.stock.map((e, i) => { const x = xs.find(y => y.i === i); return Object.assign({}, e, { n: e.n - (x ? x.n : 0) }); });
      const moved = xs.reduce((a, x) => a + x.n, 0);
      const there = stock.find(e => samePlace(e, to));
      if (there) there.n += moved; else stock.push({ loc: to.loc, shelf: to.shelf, pos: to.pos, n: moved });
      const next = Object.assign({}, w, { stock: stock.filter(e => e.n > 0) });
      const d = await api('saveWine', { wine: serialWine(next), image: null, entries: [] });
      upsertWine(normWine(d.wine || d));
    }
    persist();
    Object.assign(PMOVE, { loc: null, sel: {}, to: { loc: '', shelf: null, pos: '' } });
    POSUI.k = null;
    busy(false);
    refreshView();
    toast(`${n} ${n === 1 ? 'bottle' : 'bottles'} moved to ${placeLabel(to)}.`);
  } catch (e) {
    busy(false);
    refreshView();
    toast('Not all moved: ' + e.message);
  }
}
function markChecked(loc) {
  const today = todayISO();
  const i = locInfoOf(loc);
  S.locInfo[lc(loc)] = Object.assign({}, i, { checked: today });
  persist();
  if (S.version && S.version < 43) return;
  api('setLocationInfo', { name: loc, capacity: i.capacity, kind: i.kind, checked: today }).then(saved => { if (saved) { S.locInfo[lc(loc)] = locInfoNorm(saved); persist(); } }).catch(() => {});
}

Object.assign(PL_ACTS, {
  cview: el => {
    const v = el.dataset.v === 'places' ? 'places' : 'list';
    // a second tap on Places folds all locations, the next one opens them all
    if (v === 'places' && CVIEW === 'places') {
      const all = S.locations.filter(l => locSpace(l).bottles > 0);
      const allFolded = all.length && all.every(l => FOLD.has(lc(l)));
      FOLD.clear();
      if (!allFolded) all.forEach(l => FOLD.add(lc(l)));
      store.set('wc-pl-fold', [...FOLD]);
      const l = $('#wine-list'); if (l) l.innerHTML = cellarList();
      return;
    }
    CVIEW = v; PCHK.loc = null; PMOVE.loc = null; render();
    if (v === 'places' && !store.get('wc-pl-hint', false)) { store.set('wc-pl-hint', true); setTimeout(() => toast('Tap a location to fold it. Tap Places again to fold or open all.', 6000), 400); }
  },
  'pl-fold': el => {
    const k = lc(el.dataset.v);
    if (FOLD.has(k)) FOLD.delete(k); else FOLD.add(k);
    store.set('wc-pl-fold', [...FOLD]);
    const l = $('#wine-list'); if (l) l.innerHTML = cellarList();
  },
  'chk-start': el => {
    if (PCHK.loc && chkChanges() && !confirm('Leave the check of ' + PCHK.loc + ' without saving?')) return;
    Object.assign(PCHK, { loc: el.dataset.v, counts: {}, ok: {} });
    PMOVE.loc = null;
    const l = $('#wine-list'); if (l) l.innerHTML = cellarList();
    const c = document.getElementById('pl-' + lc(el.dataset.v).replace(/[^a-z0-9]+/g, '-')); if (c) c.scrollIntoView({ block: 'start' });
  },
  'bm-start': el => {
    if (PCHK.loc && chkChanges() && !confirm('Leave the check of ' + PCHK.loc + ' without saving?')) return;
    PCHK.loc = null;
    Object.assign(PMOVE, { loc: el.dataset.v, sel: {}, to: { loc: '', shelf: null, pos: '' } });
    POSUI.k = null;
    plRefresh();
    const c = document.getElementById('pl-' + lc(el.dataset.v).replace(/[^a-z0-9]+/g, '-')); if (c) c.scrollIntoView({ block: 'start' });
  },
  'bm-n': el => {
    const [id, i] = el.dataset.k.split('|'), w = wineById(id);
    if (!w || !w.stock[Number(i)]) return;
    PMOVE.sel[el.dataset.k] = clamp(mvVal(el.dataset.k) + Number(el.dataset.d), 0, w.stock[Number(i)].n);
    plRefresh();
  },
  'bm-all': el => {
    const keys = el.dataset.keys.split(','), full = k => { const [id, i] = k.split('|'), w = wineById(id); return w && w.stock[Number(i)] ? w.stock[Number(i)].n : 0; };
    const on = keys.every(k => mvVal(k) >= full(k));
    keys.forEach(k => { PMOVE.sel[k] = on ? 0 : full(k); });
    plRefresh();
  },
  'bm-loc': el => { const t = PMOVE.to; if (lc(t.loc) !== lc(el.dataset.v)) Object.assign(t, { loc: el.dataset.v, shelf: null, pos: '' }); POSUI.k = null; plRefresh(); },
  'bm-shelf': el => { PMOVE.to.shelf = shelfStep(PMOVE.to.shelf, Number(el.dataset.d)); plRefresh(); },
  'bm-cancel': () => { Object.assign(PMOVE, { loc: null, sel: {}, to: { loc: '', shelf: null, pos: '' } }); POSUI.k = null; plRefresh(); },
  'bm-done': () => mvSave(),
  'chk-cancel': () => { PCHK.loc = null; PCHK.counts = {}; PCHK.ok = {}; const l = $('#wine-list'); if (l) l.innerHTML = cellarList(); },
  'chk-n': el => {
    const [id, i] = el.dataset.k.split('|'), w = wineById(id);
    if (!w) return;
    PCHK.counts[el.dataset.k] = clamp(chkVal(w, Number(i)) + Number(el.dataset.d), 0, 999);
    PCHK.ok[el.dataset.k] = false;
    const l = $('#wine-list'); if (l) l.innerHTML = cellarList();
  },
  'chk-ok': el => { PCHK.ok[el.dataset.k] = !PCHK.ok[el.dataset.k]; const l = $('#wine-list'); if (l) l.innerHTML = cellarList(); },
  'chk-done': () => chkSave(),
  'pl-due': () => { U.onlyDue = true; PCHK.loc = null; const l = $('#wine-list'); if (l) { l.innerHTML = cellarList(); const t = $('.pl-tools'); if (t) t.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); } },
  'pl-due-off': () => { U.onlyDue = false; const l = $('#wine-list'); if (l) l.innerHTML = cellarList(); }
});
