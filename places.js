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
  const i = Number(str(k).slice(3));
  return D && D.stock[i] ? D.stock[i].pos : '';
}
function posSet(k, v) {
  if (k === 'rs') { if (RS) RS.pos = v; return; }
  const i = Number(str(k).slice(3));
  if (D && D.stock[i]) D.stock[i].pos = v;
}
function posRerender(k) { if (k === 'rs') renderSheet(); else renderStockBox(); }

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

let CVIEW = (() => { const v = store.get('wc-cview', 'list'); return v === 'places' ? 'places' : 'list'; })();
let DOTS = (() => { const v = store.get('wc-dots', 'type'); return v === 'window' ? 'window' : 'type'; })();
const TYPE_DOT = { Red: '#9B3A47', White: '#D6C68C', 'Rosé': '#D59AA3', Sparkling: '#E0D19E', Dessert: '#C8994C', Fortified: '#844232', Orange: '#C7844A' };
const stripeColor = w => (DOTS === 'window' ? (STATUS[statusOf(w)] || { c: '#888' }).c : typeTint(w));
const dotColor = w => (DOTS === 'window' ? (STATUS[statusOf(w)] || STATUS.Ready || { c: '#888' }).c : TYPE_DOT[w.type] || TYPE_DOT.Red);
/* a muted band per zone, cool for sparkling, warm for red */
function zoneColor(z) {
  const n = lc(z.name), t = z.temp;
  if (/sparkl|champ/.test(n) || (t !== null && t <= 8)) return '#7F95AE';
  if (/white|ros/.test(n) || (t !== null && t <= 12)) return '#8EA88A';
  if (/red/.test(n) || (t !== null && t >= 15)) return '#A0605F';
  return '#8C7A62';
}
const cviewToggleHtml = () => `<div class="cview" role="group" aria-label="View"><button class="${CVIEW === 'list' ? 'on' : ''}" data-act="cview" data-v="list" aria-pressed="${CVIEW === 'list'}" aria-label="List">${ICON.list}</button><button class="${CVIEW === 'places' ? 'on' : ''}" data-act="cview" data-v="places" aria-pressed="${CVIEW === 'places'}" aria-label="Places">${LOC_ICON.rack}</button></div>`;

/* the check: place by place, every wine there with its count */
const PCHK = { loc: null, counts: {}, ok: {} };
const chkKey = (w, i) => `${w.id}|${i}`;
const chkVal = (w, i) => (PCHK.counts[chkKey(w, i)] !== undefined ? PCHK.counts[chkKey(w, i)] : w.stock[i].n);
function chkChanges() {
  let n = 0;
  S.wines.forEach(w => w.stock.forEach((e, i) => { if (lc(e.loc) === lc(PCHK.loc) && chkVal(w, i) !== e.n) n++; }));
  return n;
}

function placesHtml() {
  const filtered = U.search || activeCount('cellar');
  const list = S.wines.filter(w => !isDisc(w) && w.count > 0 && matches(w, U.search) && passes('cellar', w));
  const by = {};
  list.forEach(w => w.stock.forEach((e, i) => { if (e.n > 0) (by[lc(e.loc)] = by[lc(e.loc)] || []).push({ w, e, i }); }));
  const locs = S.locations.filter(l => by[lc(l)]).concat(Object.keys(by).filter(k => !S.locations.some(l => lc(l) === k)).map(k => by[k][0].e.loc));
  if (!locs.length) return `<p class="muted small">${filtered ? 'No wine in stock matches your search or filter.' : 'No bottles in stock.'}</p>`;
  const legend = DOTS === 'window'
    ? `<div class="pl-legend">${STATUS_ORDER.filter(s => list.some(w => statusOf(w) === s)).map(s => `<span><i style="background:${STATUS[s].c}"></i>${esc(s)}</span>`).join('')}</div>` : '';
  return `<div class="pl-tools"><div class="chips"><button class="chip${DOTS === 'type' ? ' on' : ''}" data-act="dots" data-v="type">Type</button><button class="chip${DOTS === 'window' ? ' on' : ''}" data-act="dots" data-v="window">Drinking window</button></div></div>${legend}
    ${locs.map(l => placeCardHtml(l, by[lc(l)], filtered)).join('')}`;
}

function placeCardHtml(loc, items, filtered) {
  const info = locInfoOf(loc), sp = locSpace(loc), ty = locTypeOf(loc);
  const checking = !!PCHK.loc && lc(PCHK.loc) === lc(loc);
  const due = items.reduce((a, x) => a + (['Drink soon', 'Past its window'].includes(statusOf(x.w)) ? x.e.n : 0), 0);
  const sh = {};
  items.forEach(x => { const s = shelfVal(x.e.shelf); const k = s === null ? 'none' : String(s); (sh[k] = sh[k] || []).push(x); });
  const keys = Object.keys(sh).filter(k => k !== 'none').map(Number).sort((a, b) => a - b).map(String);
  if (sh.none) keys.push('none');
  const sub = [ty && lc(LOC_TYPE_NAME[ty]) !== lc(loc) ? (ty === 'case' && info.owc ? 'Original wooden case' : LOC_TYPE_NAME[ty]) : '', info.checked ? `Checked on ${fmtDate(info.checked)}` : ''].filter(Boolean).join(' · ');
  const head = `<div class="pl-head"><span class="loc-ic">${locIcon(loc)}</span><span class="pl-name"><b>${esc(loc)}</b>${sub ? `<span class="tiny muted">${esc(sub)}</span>` : ''}</span><span class="pl-count"><b>${sp.cap ? `${sp.bottles}/${sp.cap}` : sp.bottles}</b><small>${sp.bottles === 1 && !sp.cap ? 'bottle' : 'bottles'}</small></span></div>`;
  const fill = sp.cap && info.kind !== 'short' ? `<div class="fill-bar ${fillCls(sp.pct)}"><i style="width:${Math.max(2, sp.pct)}%"></i></div>` : '';
  const dueLine = due && !checking ? `<p class="pl-due">${due} ${due === 1 ? 'bottle' : 'bottles'} to open soon</p>` : '';
  const body = keys.map(k => shelfBlockHtml(loc, k, sh[k], checking, keys.length === 1)).join('');
  const n = checking ? chkChanges() : 0;
  const foot = checking
    ? `<p class="small" style="margin:0">Count what lies here. Tap ✓ when a number is right, or change it with minus and plus. Wines that are not here: set them to 0.</p>
      <div class="grid2"><button class="btn" data-act="chk-cancel">Cancel</button><button class="btn primary" data-act="chk-done">${n ? `Done, ${n} ${n === 1 ? 'change' : 'changes'}` : 'Done, all right'}</button></div>`
    : filtered ? '' : `<button class="btn ghost pl-check" data-act="chk-start" data-v="${esc(loc)}">${ICON.check}Check this place</button>`;
  return `<section class="pl-card${checking ? ' checking' : ''}" id="pl-${esc(lc(loc).replace(/[^a-z0-9]+/g, '-'))}">${head}${fill}${dueLine}${checking ? foot.split('<div class="grid2">')[0] : ''}${body}${checking ? '<div class="grid2">' + foot.split('<div class="grid2">')[1] : foot}</section>`;
}

/* the order of a shelf as far as the position tells it: left to right, front to back, top to bottom */
const POS_RANK = { Left: 0, Center: 1, Right: 2, Front: 0, Back: 1, Upper: 0, Middle: 1, Lower: 2 };
function posRank(p) {
  const o = posParse(p), r = g => (o[g].length ? Math.min(...o[g].map(v => POS_RANK[v])) : 9);
  return [r('side'), r('depth'), r('level'), o.other ? 1 : 0];
}
const URGENT = ['Past its window', 'Drink soon'];
function shelfBlockHtml(loc, k, xs, checking, only) {
  const s = k === 'none' ? null : Number(k), z = s === null ? null : zoneAt(loc, s);
  const title = s === null ? (isCase(loc) || only ? '' : 'No shelf') : shelfLabel(loc, s);
  xs = xs.slice().sort((a, b) => { const ra = posRank(a.e.pos), rb = posRank(b.e.pos); for (let j = 0; j < ra.length; j++) if (ra[j] !== rb[j]) return ra[j] - rb[j]; return wineTitle(a.w).localeCompare(wineTitle(b.w)) || str(a.w.vintage).localeCompare(str(b.w.vintage)); });
  const n = xs.reduce((a, x) => a + x.e.n, 0), due = xs.reduce((a, x) => a + (URGENT.includes(statusOf(x.w)) ? x.e.n : 0), 0);
  const count = `${n} ${n === 1 ? 'bottle' : 'bottles'}${due && DOTS === 'window' ? ` · <span class="pl-due-in">${due} to open</span>` : ''}`;
  const rows = xs.map(x => {
    const st = statusOf(x.w), urgent = URGENT.includes(st);
    const meta = [x.w.vintage, posShow(x.e.pos)].filter(Boolean).join(' · ');
    if (checking) {
      const key = chkKey(x.w, x.i), v = chkVal(x.w, x.i), ok = PCHK.ok[key] && v === x.e.n;
      return `<div class="chk-row${ok ? ' ok' : ''}${v !== x.e.n ? ' changed' : ''}" style="--tc:${stripeColor(x.w)}">${thumbHtml(x.w, true)}<span class="pl-wt"><span class="pl-wn">${esc(wineTitle(x.w))}</span><span class="tiny muted">${esc(meta)}${v !== x.e.n ? ` · was ${x.e.n}` : ''}</span></span>
        <div class="stepper sm"><button data-act="chk-n" data-k="${esc(key)}" data-d="-1" aria-label="Fewer">${ICON.minus}</button><span>${v}</span><button data-act="chk-n" data-k="${esc(key)}" data-d="1" aria-label="More">${ICON.plus}</button></div>
        <button class="chk-ok${ok ? ' on' : ''}" data-act="chk-ok" data-k="${esc(key)}" aria-label="The number is right" aria-pressed="${!!ok}">${ICON.check}</button></div>`;
    }
    return `<a class="pl-wine" href="#/wine/${encodeURIComponent(x.w.id)}" style="--tc:${stripeColor(x.w)}">${thumbHtml(x.w, true)}<span class="pl-wt"><span class="pl-wn">${esc(wineTitle(x.w))}</span><span class="pl-meta">${esc(meta)}${urgent ? `${meta ? ' · ' : ''}<b style="color:${STATUS[st].c}">${esc(st)}</b>` : ''}</span></span><span class="pl-n">${x.e.n}</span></a>`;
  }).join('');
  const zc = z ? ` style="--zc:${zoneColor(z)}"` : '';
  return `<div class="pl-shelf${z ? ' zoned' : ''}"${zc}><div class="pl-sh"><span>${title ? `${esc(title)} · ` : ''}<span class="pl-cnt">${count}</span></span>${z ? `<span class="pl-zone">${ICON.temp}${esc(zoneText(z))}</span>` : ''}</div>${rows}</div>`;
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
      const entries = journalForCorrection(w, count - w.count, stock, fullName(w));
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
function markChecked(loc) {
  const today = todayISO();
  const i = locInfoOf(loc);
  S.locInfo[lc(loc)] = Object.assign({}, i, { checked: today });
  persist();
  if (S.version && S.version < 43) return;
  api('setLocationInfo', { name: loc, capacity: i.capacity, kind: i.kind, checked: today }).then(saved => { if (saved) { S.locInfo[lc(loc)] = locInfoNorm(saved); persist(); } }).catch(() => {});
}

Object.assign(PL_ACTS, {
  cview: el => { CVIEW = el.dataset.v === 'places' ? 'places' : 'list'; store.set('wc-cview', CVIEW); PCHK.loc = null; render(); },
  dots: el => { DOTS = el.dataset.v === 'window' ? 'window' : 'type'; store.set('wc-dots', DOTS); const l = $('#wine-list'); if (l) l.innerHTML = cellarList(); },
  'chk-start': el => {
    if (PCHK.loc && chkChanges() && !confirm('Leave the check of ' + PCHK.loc + ' without saving?')) return;
    Object.assign(PCHK, { loc: el.dataset.v, counts: {}, ok: {} });
    const l = $('#wine-list'); if (l) l.innerHTML = cellarList();
    const c = document.getElementById('pl-' + lc(el.dataset.v).replace(/[^a-z0-9]+/g, '-')); if (c) c.scrollIntoView({ block: 'start' });
  },
  'chk-cancel': () => { PCHK.loc = null; PCHK.counts = {}; PCHK.ok = {}; const l = $('#wine-list'); if (l) l.innerHTML = cellarList(); },
  'chk-n': el => {
    const [id, i] = el.dataset.k.split('|'), w = wineById(id);
    if (!w) return;
    PCHK.counts[el.dataset.k] = clamp(chkVal(w, Number(i)) + Number(el.dataset.d), 0, 999);
    PCHK.ok[el.dataset.k] = false;
    const l = $('#wine-list'); if (l) l.innerHTML = cellarList();
  },
  'chk-ok': el => { PCHK.ok[el.dataset.k] = !PCHK.ok[el.dataset.k]; const l = $('#wine-list'); if (l) l.innerHTML = cellarList(); },
  'chk-done': () => chkSave()
});
