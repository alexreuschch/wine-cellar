'use strict';

/* Wine Cellar: Bottom sheets for bottles in and out and journal entries. Loaded after app.js, in the order of index.html. */

/* ------------------------------------------------------------ bottom sheet: bottles in and out, journal entries */

const newPicker = (source, names, opts = {}) => ({
  people: namesOf(names).map(n => ({ name: n, heart: (opts.hearts || []).includes(lc(n)) })),
  typing: '', showAll: false, hearts: !!opts.withHearts, source, single: !!opts.single
});
const priceInput = (v, c) => { const x = conv(v, c); return x === null ? '' : x.toFixed(2); };

/* Purchase price as one Total field. It starts as bottles times the price per bottle and can be overwritten,
   for a discount or shipping. More or fewer bottles keep the price per bottle that the total gives. */
const unitOf = (v, c) => { const x = parseMoney(priceInput(v, c)); return x === null ? null : x; };
const totalOf = (unit, qty) => (unit === null || unit === undefined ? '' : (Math.round(unit * qty * 100) / 100).toFixed(2));
function totalSetQty(st) {
  if (st.unit === null || st.unit === undefined) return;
  st.price = totalOf(st.unit, st.qty);
  const i = $('.sheet input[name=price]'); if (i) i.value = st.price;
  totalPerRefresh(st);
}
function totalTyped(st) {
  const p = parseMoney(st.price);
  st.unit = p === null || !st.qty ? null : p / st.qty;
  totalPerRefresh(st);
}
const totalPerText = st => { const p = parseMoney(st.price); return p !== null && st.qty > 1 ? `That is ${money(p / st.qty)} per bottle.` : ''; };
function totalPerRefresh(st) { const t = $('#total-per'); if (t) t.textContent = totalPerText(st); }
const totalFieldHtml = (st, k) => `<div class="field"><label for="total-in">Total${curLabel()}</label><input id="total-in" name="price" data-input="${k}" inputmode="decimal" placeholder="For example 270.00" value="${esc(st.price)}"><span class="muted tiny" id="total-per">${totalPerText(st)}</span></div>`;
const unitPrice = st => (st.unit === null || st.unit === undefined ? '' : Math.round(st.unit * 100) / 100);
/* Delivered or Ordered: the + sheet and the order sheet switch into each other */
const buyStatusHtml = ordered => `<div class="field buy-status"><span>Status</span><div class="toggle"><button class="${ordered ? '' : 'on'}" data-act="buy-status" data-v="delivered" aria-pressed="${!ordered}">Delivered</button><button class="${ordered ? 'on' : ''}" data-act="buy-status" data-v="ordered" aria-pressed="${ordered}">Ordered</button></div></div>`;
const isBuyIn = st => st && st.kind === 'in' && st.type === 'Purchase';

/** Bottles out of the cellar. With several locations the location has to be chosen first. */
function openRemoveSheet(id, i) {
  const w = wineById(id);
  if (!w || w.count < 1) return;
  const at = i !== undefined && w.stock[i] ? w.stock[i] : (w.stock.length === 1 ? w.stock[0] : null);
  RS = Object.assign({
    kind: 'out', mode: 'add', wineId: id, qty: 1, type: 'Dinner', occasion: '', food: '', note: '', date: todayISO(),
    price: '', pp: newPicker('people', '', { withHearts: true }), rp: null
  }, at ? placeOf(at) : { loc: '', shelf: null, pos: '' });
  renderSheet();
}

/** Bottles into the cellar. mode 'record' only writes the journal (used in Edit, where the stock is edited directly). */
function openAddSheet(id, i, mode = 'add') {
  const w = wineById(id);
  if (!w) return;
  RS = {
    kind: 'in', mode, wineId: id, loc: '', shelf: null, pos: '', qty: 1, type: 'Purchase', occasion: '', food: '', note: '', date: todayISO(),
    price: '', pp: newPicker('people', ''), rp: newPicker('retailers', '', { single: true }), website: '', websiteInit: ''
  };
  if (i !== undefined && i !== null && w.stock[i]) Object.assign(RS, placeOf(w.stock[i]));
  else { RS.loc = w.stock.length ? w.stock.slice().sort((a, b) => b.n - a.n)[0].loc : defaultLocation(); placeFromStock(); }
  renderSheet();
}

/** Shelf and position of the chosen location, taken from the bottles already stored there. */
function placeFromStock() {
  const w = wineById(RS.wineId);
  const e = w && w.stock.filter(x => lc(x.loc) === lc(RS.loc)).sort((a, b) => b.n - a.n)[0];
  RS.shelf = e ? shelfVal(e.shelf) : null;
  RS.pos = e ? str(e.pos) : '';
}

function placeHint() {
  const w = wineById(RS.wineId);
  const e = w && w.stock.find(x => samePlace(x, RS));
  return e ? `Adds to the ${e.n} ${e.n === 1 ? 'bottle' : 'bottles'} already stored there.` : (w && w.stock.length ? 'New storage place for this wine.' : '');
}

function openEditEntry(id, record) {
  const r = S.removals.find(x => x.id === id);
  if (!r) return;
  if (r.dir === 'taste') { openDiscoveryEdit(r); return; }
  const hearts = namesOf(r.hearts).map(lc);
  const site = r.retailer ? str((S.retailers.find(x => lc(x.name) === lc(r.retailer)) || {}).website) : '';
  RS = {
    kind: r.dir, mode: record ? 'record' : 'edit', id: r.id, wineId: r.wineId, loc: r.loc, qty: r.qty,
    type: r.type, occasion: r.occasion, food: r.food, note: r.note, date: r.date || todayISO(),
    price: priceInput(r.price, r.priceCur), priceInit: priceInput(r.price, r.priceCur), origPrice: r.price, origCur: r.priceCur, qtyInit: r.qty,
    pp: newPicker('people', r.people, { withHearts: r.dir === 'out', hearts }),
    rp: newPicker('retailers', r.retailer, { single: true }), website: site, websiteInit: site
  };
  if (r.dir === 'out' && !REMOVAL_TYPES.includes(RS.type)) RS.type = 'Other';
  if (r.dir === 'in' && !ADD_TYPES.some(t => t[0] === RS.type)) RS.type = 'Added';
  if (isBuyIn(RS)) { RS.unit = r.price === null || r.price === '' ? null : unitOf(r.price, r.priceCur); RS.price = totalOf(RS.unit, RS.qty); RS.priceInit = RS.price; }
  renderSheet();
}

const qtyMax = () => {
  if (!RS || RS.kind !== 'out' || RS.mode !== 'add') return 999;
  const w = wineById(RS.wineId);
  const e = w && w.stock.find(x => samePlace(x, RS));
  return e ? e.n : (w ? w.count : 1);
};

function renderSheet() {
  const root = $('#sheet-root');
  if (!RS) { root.innerHTML = ''; return; }
  if (RS.kind === 'taste') { root.innerHTML = tasteSheetHtml(); setupTasteRating(); return; }
  if (RS.kind === 'order') { root.innerHTML = orderSheetHtml(); return; }
  const w = wineById(RS.wineId);
  const r = RS.id ? S.removals.find(x => x.id === RS.id) : null;
  const name = w ? `${wineTitle(w)} ${w.vintage}`.trim() : ((r && r.wineName) || 'Deleted wine');
  const here = route();
  const link = RS.mode === 'edit' && w && !(here.p === 'wine' && here.id === w.id) && !isFormRoute() ? ` · <a href="#/wine/${encodeURIComponent(w.id)}">View wine</a>` : '';
  const out = RS.kind === 'out';
  const title = RS.mode === 'add' ? (out ? 'Bottle removed' : 'Bottles added') : RS.mode === 'record' && !RS.id ? 'Add purchase record' : 'Edit entry';
  const sub = esc(name) + (RS.mode === 'add' && w ? ` · ${w.count} in stock` : '') + link;
  const types = out ? REMOVAL_TYPES.map(t => [t, t]) : ADD_TYPES;
  const typeGrid = `<div style="display:flex;flex-direction:column;gap:8px"><span class="small muted">${out ? 'Type' : 'Reason'}</span><div class="grid3">${types.map(([v, l]) => `<button class="btn${v === RS.type ? ' primary' : ''}" style="height:44px;font-size:14px;padding:0 6px" data-act="rs-type" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  let locs = '';
  if (RS.mode === 'add' && out) {
    if (w.stock.length > 1 || !RS.loc) {
      locs = `<div style="display:flex;flex-direction:column;gap:8px"><span class="small muted">Taken from</span><div class="chips">${w.stock.map((e, i) => `<button class="chip${samePlace(e, RS) ? ' on' : ''}" data-act="rs-place" data-i="${i}">${ICON.pin}${esc(placeLabel(e))} <span class="n">${e.n}</span></button>`).join('')}</div></div>`;
    } else {
      locs = `<p class="small muted" style="margin:0">From <b style="color:var(--text)">${esc(placeLabel(RS))}</b></p>`;
    }
  } else if (RS.mode === 'add') {
    const opts = S.locations.slice();
    if (RS.loc && !opts.some(l => lc(l) === lc(RS.loc))) opts.unshift(RS.loc);
    locs = `<div style="display:flex;flex-direction:column;gap:8px"><span class="small muted">Stored in</span><div class="chips">${opts.map(l => `<button class="chip${lc(l) === lc(RS.loc) ? ' on' : ''}" data-act="rs-loc" data-v="${esc(l)}">${ICON.pin}${esc(l)}</button>`).join('')}</div>${!opts.length ? '<p class="muted small" style="margin:0">Add a location in Settings first.</p>' : ''}</div>`;
  }
  const qty = `<div class="between"><span>${RS.mode === 'edit' || (RS.mode === 'record' && RS.id) ? 'Bottles' : out ? 'Bottles taken' : 'Bottles'}</span><div class="stepper"><button data-act="rs-qty" data-d="-1" aria-label="Fewer">${ICON.minus}</button><input class="step-num" type="text" inputmode="numeric" pattern="[0-9]*" id="rs-qty" data-input="qty-in" data-change="qty-in" data-k="rs" aria-label="Number of bottles" value="${RS.qty}"><button data-act="rs-qty" data-d="1" aria-label="More">${ICON.plus}</button></div></div>`;
  const picker = (label) => `<div class="field"><span>${label}</span>
      <div id="people-chips" class="chips">${peopleChipsHtml()}</div>
      <input id="people-input" data-input="people" aria-label="${label}" placeholder="${PK() && PK().source === 'retailers' ? 'Type the name of a shop or winery' : 'Type a name'}"${pickInputAttrs()} autocomplete="off" autocapitalize="words" enterkeyhint="done" value="${esc(PK() ? PK().typing : '')}">
      <div id="people-sugg">${peopleSuggHtml()}</div></div>`;
  const priceField = label => `<label class="field">${label}${curLabel()}<input name="price" data-input="rs" inputmode="decimal" placeholder="45.00" value="${esc(RS.price)}"></label>`;
  const date = `<label class="field">Date<input type="date" name="date" data-input="rs" value="${esc(RS.date)}"></label>`;
  const note = `<label class="field">Note<textarea name="note" data-input="rs" rows="2" placeholder="${out ? 'Decanted, how it showed, anything to remember' : 'Lot, case, anything to remember'}">${esc(RS.note)}</textarea></label>`;
  let body;
  if (out) {
    const lbl = RS.type === 'Gift' ? 'Given to' : RS.type === 'Sale' ? 'Sold to' : 'Shared with';
    body = `${locs}${RS.mode === 'add' ? qty : ''}${RS.mode !== 'add' ? date : ''}${typeGrid}
      <label class="field">Occasion<input name="occasion" data-input="rs" placeholder="${esc(OCCASION_HINTS[RS.type])}" value="${esc(RS.occasion)}"></label>
      ${picker(lbl)}
      ${RS.type === 'Sale' ? priceField('Sale price per bottle') : ''}
      ${RS.type === 'Gift' || RS.type === 'Sale' ? '' : `<label class="field">Food<input name="food" data-input="rs" placeholder="Duck breast with cherry sauce" value="${esc(RS.food)}"></label>`}
      ${note}`;
  } else {
    const showSite = RS.type === 'Purchase' && RS.rp.people.length;
    const place = RS.mode === 'add' && !isCase(RS.loc) ? `<div class="store-row">
        <div class="field">Shelf (optional)<div class="stepper"><button data-act="rs-shelf" data-d="-1" aria-label="Shelf down">${ICON.minus}</button><span id="rs-shelf" class="shelf-val">${esc(shelfText(RS.loc, RS.shelf))}</span><button data-act="rs-shelf" data-d="1" aria-label="Shelf up">${ICON.plus}</button></div></div>
        ${posFieldHtml('rs')}
      </div>${posPanelHtml('rs')}<div id="rs-zone">${zoneLineHtml(RS.loc, RS.shelf, w, 'rs-zone')}</div><p class="muted tiny" style="margin:-6px 0 0" id="rs-hint">${placeHint()}</p>` : '';
    const status = RS.mode === 'add' && RS.type === 'Purchase' && !RS.orderId ? buyStatusHtml(false) : '';
    body = `${typeGrid}${status}${locs}${place}${qty}${RS.mode === 'add' ? `<div id="space-note">${spaceNoteHtml(RS.loc, RS.qty, w)}</div>` : ''}${date}
      ${RS.type === 'Purchase' ? picker('Retailer') : RS.type === 'Received' ? picker('From') : ''}
      ${showSite ? `<label class="field">Website of ${esc(RS.rp.people[0].name)}<input name="website" data-input="rs" inputmode="url" autocapitalize="off" placeholder="www.shop.ch" value="${esc(RS.website)}"></label>` : ''}
      ${RS.type === 'Purchase' ? totalFieldHtml(RS, 'rs') : RS.type === 'Received' ? `<div class="field">Purchase price<div class="static">${money(0)}, gift</div></div>` : ''}
      ${note}
      ${RS.mode === 'record' && !RS.id ? '<p class="muted tiny" style="margin:0">Only adds the purchase to the journal. Change the number of bottles in Storage.</p>' : ''}`;
  }
  if (RS.del) { body = deletePanelHtml(w, r); }
  const buttons = RS.del
    ? `<div class="grid2"><button class="btn" data-act="del-cancel">Cancel</button><button class="btn danger" data-act="del-confirm"${RS.del.blocked ? ' disabled' : ''}>${RS.del.kind === 'back' ? 'Delete and put back' : 'Delete and take out'}</button></div>
      <button class="btn ghost" style="height:36px;font-size:13px" data-act="del-only">Only delete the entry, keep the stock</button>`
    : RS.id
    ? `<div class="grid2"><button class="btn danger" data-act="rs-delete">Delete entry</button><button class="btn primary" data-act="rs-save">Save</button></div>`
    : RS.mode === 'add' && out
      ? `<div class="grid2"><button class="btn" data-act="rs-skip">Skip details</button><button class="btn primary" data-act="rs-save">Save</button></div>`
      : `<div class="grid2"><button class="btn" data-act="sheet-close">Cancel</button><button class="btn primary" data-act="rs-save">Save</button></div>`;
  root.innerHTML = `<div class="sheet-backdrop" data-act="sheet-close"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="grab"></div>
    <div style="display:flex;gap:12px;align-items:center">${w ? thumbHtml(w) : ''}<div style="flex:1;min-width:0"><h2 id="sheet-title" style="font-size:18px;font-weight:600">${RS.del ? 'Delete entry' : title}</h2><p class="muted small ellipsis" style="margin:2px 0 0">${sub}</p></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${ICON.x}</button></div>
    ${body}
    ${buttons}
  </div>`;
}

/* people and retailer picker, shared by the sheet and the add form */

const PK = () => {
  if (RS && RS.kind === 'order') return RS.rp;
  if (RS) {
    if (RS.kind === 'in') return RS.type === 'Purchase' ? RS.rp : RS.type === 'Received' ? RS.pp : null;
    return RS.pp;
  }
  if (D && D.acq) return D.acq.type === 'Purchase' ? D.acq.rp : D.acq.type === 'Received' ? D.acq.pp : null;
  return null;
};
const knownFor = P => (P.source === 'retailers' ? knownRetailers() : knownPeople());

/* a retailer is one name: once chosen it fills the field itself, a tap on it lets you choose another */
const pickOne = P => !!(P && P.single && P.people.length && !P.editing);
const pickInputAttrs = () => { const P = PK(); return pickOne(P) ? ' hidden' : P && P.single && P.editing && P.people.length ? ` placeholder="${esc(P.people[0].name)}"` : ''; };
function peopleChipsHtml() {
  const P = PK();
  if (!P || !P.people.length) return '';
  if (P.single) return pickOne(P) ? `<div class="one-pick"><button class="one-pick-name" data-act="p-change" aria-label="Change ${esc(P.people[0].name)}">${esc(P.people[0].name)}</button><button class="x" data-act="p-rm" data-i="0" aria-label="Clear ${esc(P.people[0].name)}">${ICON.x}</button></div>` : '';
  return P.people.map((p, i) => `<span class="person${P.hearts ? '' : ' plain'}">${P.hearts ? `<button class="heart${p.heart ? ' on' : ''}" data-act="p-heart" data-i="${i}" aria-pressed="${p.heart}" aria-label="Favorite wine of ${esc(p.name)}">${p.heart ? HEART_ON : ICON.heart}</button>` : ''}${esc(p.name)}<button class="x" data-act="p-rm" data-i="${i}" aria-label="Remove ${esc(p.name)}">${ICON.x}</button></span>`).join('')
    + (P.hearts ? '<p class="tiny muted" style="flex-basis:100%;margin:0">Tap the heart if it is their favorite wine.</p>' : '');
}

function peopleSuggHtml() {
  const P = PK();
  if (!P) return '';
  if (pickOne(P)) return '';
  const t = lc(P.typing.trim());
  const chosen = P.people.map(p => lc(p.name));
  const known = knownFor(P).filter(p => !chosen.includes(lc(p.name)));
  let list;
  if (t) {
    list = known.filter(p => lc(p.name).includes(t))
      .sort((a, b) => (lc(b.name).startsWith(t) ? 1 : 0) - (lc(a.name).startsWith(t) ? 1 : 0) || b.score - a.score)
      .slice(0, 8);
  } else {
    list = P.showAll ? byName(known) : known.slice(0, 6);
  }
  const typed = P.typing.trim();
  const add = t && !known.some(p => lc(p.name) === t) && !chosen.includes(t) ? `<button class="chip" data-act="p-add-typed">${ICON.plus}Add “${esc(typed)}”</button>` : '';
  const more = !t && !P.showAll && known.length > 6 ? `<button class="chip" data-act="p-all">${P.source === 'retailers' ? 'All retailers' : 'All people'} (${known.length})</button>` : '';
  if (!list.length && !add && !more) return '';
  return `<div class="chips${P.showAll && !t ? ' scroll-box' : ''}">${list.map(p => `<button class="chip" data-act="p-pick" data-v="${esc(p.name)}">${esc(p.name)}</button>`).join('')}${add}${more}</div>`;
}

function updatePeople() {
  const P = PK();
  if (!P) return;
  const c = $('#people-chips'), s = $('#people-sugg'), i = $('#people-input');
  if (c) c.innerHTML = peopleChipsHtml();
  if (s) s.innerHTML = peopleSuggHtml();
  if (i) { i.value = P.typing; i.hidden = pickOne(P); if (P.single && P.editing && P.people.length) i.placeholder = P.people[0].name; }
}

function addPerson(raw) {
  const P = PK();
  if (!P) return;
  const clean = String(raw || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  P.typing = '';
  if (clean && !P.people.some(p => lc(p.name) === lc(clean))) {
    const known = knownFor(P).find(p => lc(p.name) === lc(clean));
    const item = { name: known ? known.name : clean, heart: false };
    if (P.single) { P.people = [item]; P.editing = false; } else P.people.push(item);
    if (RS && P === RS.rp) {
      RS.website = str((S.retailers.find(x => lc(x.name) === lc(item.name)) || {}).website);
      RS.websiteInit = RS.website;
      renderSheet();
      return;
    }
    if (!RS && D && D.acq && P === D.acq.rp) {
      D.acq.website = D.acq.websiteInit = str((S.retailers.find(x => lc(x.name) === lc(item.name)) || {}).website);
      updatePeople();
      renderSiteBox();
      return;
    }
  }
  updatePeople();
}

function closeSheet() { RS = null; renderSheet(); }

/** Journal fields from the sheet. Prices keep their original currency unless the amount was changed. */
function entryFields(st) {
  if (st.pp.typing.trim() && PK() === st.pp) addPerson(st.pp.typing);
  if (st.rp && st.rp.typing.trim() && PK() === st.rp) addPerson(st.rp.typing);
  const out = st.kind === 'out';
  const withPrice = st.type === 'Sale' || st.type === 'Purchase';
  let price = '', priceCur = '';
  if (withPrice && str(st.price).trim()) {
    const same = st.priceInit !== undefined && str(st.price).trim() === st.priceInit && st.origPrice !== null && (!isBuyIn(st) || st.qty === st.qtyInit);
    if (same) { price = st.origPrice; priceCur = st.origCur; }
    else if (isBuyIn(st)) { const p = parseMoney(st.price); price = p === null ? null : Math.round(p / Math.max(1, st.qty) * 100) / 100; priceCur = cur(); }
    else { price = parseMoney(st.price); priceCur = cur(); }
  }
  const people = out || st.type === 'Received' ? st.pp : null;
  return {
    type: st.type, dir: st.kind, qty: st.qty, date: st.date || todayISO(),
    occasion: str(st.occasion).trim(),
    people: people ? people.people.map(p => p.name).join(', ') : '',
    hearts: out ? st.pp.people.filter(p => p.heart).map(p => p.name).join(', ') : '',
    food: out && st.type !== 'Gift' && st.type !== 'Sale' ? str(st.food).trim() : '',
    note: str(st.note).trim(),
    price: price === null ? '' : price, priceCur: price === '' ? '' : priceCur,
    retailer: !out && st.type === 'Purchase' && st.rp.people.length ? st.rp.people[0].name : ''
  };
}

function localStock(w, place, delta) {
  const p = typeof place === 'string' ? w.stock.find(x => lc(x.loc) === lc(place)) || { loc: place, shelf: null, pos: '' } : place;
  const e = w.stock.find(x => samePlace(x, p));
  if (e) e.n += delta; else if (delta > 0) w.stock.push(Object.assign(placeOf(p), { n: delta }));
  w.stock = w.stock.filter(x => x.n > 0);
  w.count = w.stock.reduce((a, x) => a + x.n, 0);
  if (w.stock.length) w.location = w.stock[0].loc;
}

async function saveSheet(withDetails) {
  if (RS && RS.kind === 'taste') { saveDiscovery(); return; }
  const st = RS;
  const w = wineById(st.wineId);
  if (st.mode === 'add' && !st.loc) { toast(st.kind === 'out' ? 'Choose where the bottle comes from.' : 'Choose where the bottles are stored.'); return; }
  if ((st.type === 'Sale' || st.type === 'Purchase') && str(st.price).trim() && parseMoney(st.price) === null) { toast('Prices need a number, for example 45.50.'); return; }
  const fields = entryFields(st);
  const siteChanged = st.kind === 'in' && fields.retailer && str(st.website).trim() !== str(st.websiteInit).trim();
  closeSheet();
  if (siteChanged) saveRetailerSite(fields.retailer, str(st.website).trim());
  if (st.mode === 'add') {
    if (!w) return;
    if (st.kind === 'out' && !withDetails) { adjustCount(w.id, -st.qty, placeOf(st)); return; }
    const place = placeOf(st);
    const entry = Object.assign({ id: newId(st.kind === 'out' ? 'r' : 'i'), wineId: w.id, wineName: fullName(w) }, fields, place);
    const prevStock = JSON.parse(JSON.stringify(w.stock));
    localStock(w, place, st.kind === 'out' ? -st.qty : st.qty);
    if (st.kind === 'out') caseEmptyNote(place.loc);
    S.removals.push(normRemoval(entry));
    if (st.kind === 'in') store.set('wc-lastloc', st.loc);
    persist();
    refreshView();
    try {
      const d = st.kind === 'out' ? await api('removeBottle', { removal: entry }) : await api('addBottles', { entry });
      upsertWine(normWine(d.wine));
      const saved = normRemoval(d.removal || d.entry);
      S.removals = S.removals.filter(r => r.id !== entry.id && r.id !== saved.id).concat([saved]);
      persist();
      refreshView();
      if (st.orderId) orderArrived(st.orderId, st.qty);
    } catch (e) {
      w.stock = prevStock;
      w.count = prevStock.reduce((a, x) => a + x.n, 0);
      S.removals = S.removals.filter(r => r.id !== entry.id);
      persist();
      refreshView();
      toast('Not saved: ' + e.message);
    }
    return;
  }
  /* edit an entry or add a purchase record: the stock stays as it is */
  const existing = st.id ? S.removals.find(x => x.id === st.id) : null;
  const entry = Object.assign({ id: st.id || newId('i'), wineId: st.wineId, wineName: w ? fullName(w) : (existing ? existing.wineName : ''), loc: st.loc || (w && w.stock[0] ? w.stock[0].loc : '') }, fields);
  const prev = existing ? Object.assign({}, existing) : null;
  if (existing) Object.assign(existing, normRemoval(Object.assign({}, existing, entry)));
  else S.removals.push(normRemoval(entry));
  persist();
  refreshView();
  try {
    const saved = normRemoval(await api('saveEntry', { entry }));
    S.removals = S.removals.filter(r => r.id !== entry.id).concat([saved]);
    persist();
    refreshView();
  } catch (e) {
    S.removals = S.removals.filter(r => r.id !== entry.id).concat(prev ? [prev] : []);
    persist();
    refreshView();
    toast('Not saved: ' + e.message);
  }
}

async function saveRetailerSite(name, website) {
  const r = S.retailers.find(x => lc(x.name) === lc(name));
  const prev = r ? r.website : null;
  if (r) r.website = website; else S.retailers.push({ name, website });
  persist();
  refreshView();
  try {
    const list = await api('saveRetailer', { name, website });
    S.retailers = (list || []).map(x => ({ name: str(x.name), website: str(x.website) })).filter(x => x.name);
    persist();
    refreshView();
  } catch (e) {
    if (r) r.website = prev; else S.retailers = S.retailers.filter(x => lc(x.name) !== lc(name));
    persist();
    toast('Website not saved: ' + e.message);
  }
}

/* Deleting a journal entry undoes its stock change. The place is asked again, it may have changed or been deleted. */
function startDelete() {
  const r = S.removals.find(x => x.id === RS.id);
  const w = r && wineById(r.wineId);
  if (!r || !w || RS.mode === 'record' || r.dir === 'taste') { deleteEntryOnly(); return; }
  if (r.dir === 'out') {
    const loc = S.locations.find(l => lc(l) === lc(r.loc)) || '';
    const e = loc ? w.stock.filter(x => lc(x.loc) === lc(loc)).sort((x, y) => y.n - x.n)[0] : null;
    RS.del = { kind: 'back', qty: r.qty, loc, shelf: e ? shelfVal(e.shelf) : null, pos: e ? str(e.pos) : '' };
  } else {
    const i = w.stock.findIndex(x => lc(x.loc) === lc(r.loc) && x.n >= r.qty);
    RS.del = { kind: 'take', qty: r.qty, i: i >= 0 ? i : (w.stock.length === 1 && w.stock[0].n >= r.qty ? 0 : -1), blocked: !w.stock.some(x => x.n >= r.qty) };
  }
  renderSheet();
}

function delHint() {
  const d = RS.del, w = wineById(RS.wineId);
  if (!d.loc) return '';
  const e = w && w.stock.find(x => samePlace(x, d));
  return e ? `Goes back to the ${e.n} ${e.n === 1 ? 'bottle' : 'bottles'} stored there.` : 'New storage place for this wine.';
}

function deletePanelHtml(w, r) {
  const d = RS.del, n = d.qty, btl = n === 1 ? 'bottle' : 'bottles';
  if (d.kind === 'back') {
    return `<p style="margin:0">Deleting this entry puts <b>${n} ${btl}</b> back into stock. Where should ${n === 1 ? 'it' : 'they'} go?</p>
      ${r.loc && !d.loc ? `<p class="muted small" style="margin:0">${esc(r.loc)} no longer exists.</p>` : ''}
      <div class="chips">${S.locations.map(l => `<button class="chip${lc(l) === lc(d.loc) ? ' on' : ''}" data-act="del-loc" data-v="${esc(l)}">${ICON.pin}${esc(l)}</button>`).join('')}</div>
      ${d.loc ? `<div class="store-row">
        <div class="field">Shelf (optional)<div class="stepper"><button data-act="del-shelf" data-d="-1" aria-label="Shelf down">${ICON.minus}</button><span id="del-shelf" class="shelf-val">${esc(shelfText(d.loc, d.shelf))}</span><button data-act="del-shelf" data-d="1" aria-label="Shelf up">${ICON.plus}</button></div></div>
        <label class="field">Position<input data-input="del-pos" placeholder="Back row, left" value="${esc(d.pos)}"></label>
      </div><p class="muted tiny" style="margin:-6px 0 0" id="del-hint">${delHint()}</p>` : ''}`;
  }
  return `<p style="margin:0">Deleting this entry takes <b>${n} ${btl}</b> out of stock again. From where?</p>
    ${d.blocked ? `<p class="small" style="margin:0;color:var(--danger)">No storage place has ${n} ${btl} left, so the stock cannot be corrected. You can only delete the entry.</p>` : ''}
    <div class="chips">${w.stock.map((e, i) => `<button class="chip${i === d.i ? ' on' : ''}" data-act="del-place" data-i="${i}"${e.n < n ? ' disabled' : ''}>${ICON.pin}${esc(placeLabel(e))} <span class="n">${e.n}</span></button>`).join('')}</div>`;
}

async function confirmDelete() {
  const st = RS, d = st.del;
  const r = S.removals.find(x => x.id === st.id), w = wineById(st.wineId);
  if (!r || !w) { deleteEntryOnly(); return; }
  let place, delta;
  if (d.kind === 'back') {
    if (!d.loc) { toast('Choose where the bottles go.'); return; }
    place = { loc: d.loc, shelf: d.shelf, pos: str(d.pos).trim() };
    delta = d.qty;
  } else {
    const e = w.stock[d.i];
    if (!e) { toast('Choose where the bottles come from.'); return; }
    place = placeOf(e);
    delta = -d.qty;
  }
  closeSheet();
  const prevStock = JSON.parse(JSON.stringify(w.stock)), prevRemovals = S.removals.slice();
  localStock(w, place, delta);
  S.removals = S.removals.filter(x => x.id !== r.id);
  persist();
  refreshView();
  let adjusted = false;
  try {
    upsertWine(normWine(await api('adjust', Object.assign({ id: w.id, delta }, place))));
    adjusted = true;
    await api('deleteRemoval', { id: r.id });
    persist();
    refreshView();
    toast(delta > 0 ? `Entry deleted, ${d.qty} ${d.qty === 1 ? 'bottle' : 'bottles'} back in ${placeLabel(place)}` : `Entry deleted, ${d.qty} ${d.qty === 1 ? 'bottle' : 'bottles'} taken out`);
  } catch (e) {
    if (adjusted) { toast('Stock corrected, but the entry could not be deleted: ' + e.message, 6000); sync(true); return; }
    w.stock = prevStock;
    w.count = prevStock.reduce((a, x) => a + x.n, 0);
    S.removals = prevRemovals;
    persist();
    refreshView();
    toast('Not deleted: ' + e.message);
  }
}

async function deleteEntryOnly() {
  const id = RS.id;
  if (!confirm('Delete only this entry? The bottle count stays the same.')) return;
  closeSheet();
  const prev = S.removals.slice();
  S.removals = S.removals.filter(r => r.id !== id);
  persist();
  refreshView();
  try { await api('deleteRemoval', { id }); }
  catch (e) { S.removals = prev; persist(); refreshView(); toast('Not deleted: ' + e.message); }
}

async function adjustCount(id, delta, place) {
  const w = wineById(id);
  if (!w) return;
  const p = place || (w.stock[0] ? placeOf(w.stock[0]) : { loc: defaultLocation(), shelf: null, pos: '' });
  const prevStock = JSON.parse(JSON.stringify(w.stock));
  localStock(w, p, delta);
  if (delta < 0) caseEmptyNote(p.loc);
  persist();
  refreshView();
  try { upsertWine(normWine(await api('adjust', Object.assign({ id, delta }, p)))); persist(); refreshView(); }
  catch (e) { w.stock = prevStock; w.count = prevStock.reduce((a, x) => a + x.n, 0); persist(); refreshView(); toast('Not saved: ' + e.message); }
}

function refreshView() {
  if (isFormRoute()) {
    const box = $('#purchases-box');
    if (box && D && D.id) box.innerHTML = purchasesHtml(wineById(D.id) || { id: D.id }, true);
    const ob = $('#offer-box');
    if (ob && D && D.id) ob.innerHTML = offerBoxHtml();
    const eb = $('#ext-box');
    if (eb && D) eb.innerHTML = extRatingsHtml();
    return;
  }
  const y = window.scrollY;
  const r = route();
  if (r.p === 'cellar') {
    const list = $('#wine-list');
    const active = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.input === 'search';
    if (active && list) { list.innerHTML = cellarList(); return; }
  }
  if (r.p === 'journal') {
    const list = $('#journal-list');
    const active = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.input === 'jsearch';
    if (active && list) { list.innerHTML = journalList(); return; }
  }
  if (r.p === 'top' && document.activeElement && document.activeElement.dataset && document.activeElement.dataset.input === 'rng') return;
  render();
  window.scrollTo(0, y);
}

/* ------------------------------------------------------------ discoveries: a wine tasted out, rated and kept with its background */

const DISC_BUSY = new Set();
/* the same wine already in the cellar, the journal or the discoveries: same producer, name and vintage */
const sameWineKey = x => `${normName(`${str(x.producer)} ${str(x.name)}`)}|${str(x.vintage).trim()}`;
const findSameWine = x => S.wines.find(w => sameWineKey(w) === sameWineKey(x)) || null;

/** From Will I like it? or the wine list: rate the wine you are tasting and keep it as a discovery. */
function openDiscovery(info, ctx = {}) {
  if (!info || !(str(info.producer).trim() || str(info.name).trim())) { toast('The wine could not be identified. Add it with the plus button in the cellar.'); return; }
  const same = findSameWine(info);
  RS = {
    kind: 'taste', mode: 'add', wineId: same ? same.id : null, info, rating: same ? same.myRating : null, ratingInit: same ? same.myRating : null, fav: !!(same && same.myFav), favInit: !!(same && same.myFav),
    date: todayISO(), occasion: str(ctx.place), food: str(ctx.food), note: '', price: ctx.price ? String(ctx.price) : '', priceCur: ctx.priceCur || cur(),
    venue: str(ctx.venue), shopRef: ctx.shopRef || null, offer: ctx.offer || null,
    pp: newPicker('people', '')
  };
  renderSheet();
}
function openDiscoveryEdit(r) {
  const w = wineById(r.wineId);
  RS = {
    kind: 'taste', mode: 'edit', id: r.id, wineId: r.wineId, info: null, rating: w ? w.myRating : null, ratingInit: w ? w.myRating : null, fav: !!(w && w.myFav), favInit: !!(w && w.myFav),
    date: r.date || todayISO(), occasion: r.occasion, food: r.food, note: r.note, price: r.price === null ? '' : String(r.price), priceCur: r.priceCur || cur(),
    venue: r.venue, shopRef: r.shopRef, offer: null,
    pp: newPicker('people', r.people)
  };
  renderSheet();
}

function tasteSheetHtml() {
  const w = wineById(RS.wineId), x = RS.info || {};
  const name = w ? `${wineTitle(w)} ${w.vintage}`.trim() : [x.producer, x.name, x.vintage].filter(Boolean).join(' ');
  const sub = w ? (isDisc(w) ? 'Already one of your discoveries' : w.count > 0 ? `In your cellar · ${w.count} btl` : 'Already in your journal') : [x.region, x.type].filter(Boolean).join(' · ');
  const picker = `<div class="field"><span>With</span>
      <div id="people-chips" class="chips">${peopleChipsHtml()}</div>
      <input id="people-input" data-input="people" aria-label="With" placeholder="Type a name" autocomplete="off" autocapitalize="words" enterkeyhint="done" value="${esc(RS.pp.typing)}">
      <div id="people-sugg">${peopleSuggHtml()}</div></div>`;
  const buttons = RS.mode === 'edit'
    ? `<div class="grid2"><button class="btn danger" data-act="rs-delete">Delete entry</button><button class="btn primary" data-act="rs-save">Save</button></div>`
    : `<div class="grid2"><button class="btn" data-act="sheet-close">Cancel</button><button class="btn primary" data-act="rs-save">Save discovery</button></div>`;
  return `<div class="sheet-backdrop" data-act="sheet-close"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="grab"></div>
    <div style="display:flex;gap:12px;align-items:center">${w ? thumbHtml(w) : `<div class="thumb thumb-ph">${ICON.spark}</div>`}<div style="flex:1;min-width:0"><h2 id="sheet-title" style="font-size:18px;font-weight:600">${RS.mode === 'edit' ? 'Edit discovery' : 'Your discovery'}</h2><p class="muted small ellipsis" style="margin:2px 0 0">${esc(name)}${sub ? ` · ${esc(sub)}` : ''}</p></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${ICON.x}</button></div>
    <div class="box"><div class="rating-head"><span class="box-title">My rating</span><span class="rating-val${RS.rating === null ? ' none' : ''}" id="ds-val">${RS.rating === null ? 'Not rated' : RS.rating + '%'}</span></div>
      <div class="rating-bar" id="ds-bar">${segsHtml(RS.rating, 30, 'lg')}</div>
      <div class="scale"><span>0</span><span>50</span><span>100</span></div>
      <div class="rating-ctl"><button data-act="ds-rate" data-d="-1" aria-label="Minus 1 percent">${ICON.minus}</button><span>Drag the bar, fine-tune with minus and plus</span><button data-act="ds-rate" data-d="1" aria-label="Plus 1 percent">${ICON.plus}</button></div>
      ${rateExtrasHtml('ds')}</div>
    <div class="field"><span>Where were you?</span><div class="toggle three">${['restaurant', 'shop', 'other'].map(v => `<button class="${RS.venue === v ? 'on' : ''}" data-act="ds-venue" data-v="${v}">${{ restaurant: 'Restaurant', shop: 'Shop', other: 'Elsewhere' }[v]}</button>`).join('')}</div></div>
    <div class="grid2"><label class="field">Date<input type="date" name="date" data-input="rs" value="${esc(RS.date)}"></label>
      <label class="field">Price paid ${esc(RS.priceCur)}<input name="price" data-input="rs" inputmode="decimal" placeholder="Optional" value="${esc(RS.price)}"></label></div>
    <label class="field">Place<input name="occasion" data-input="rs" placeholder="${RS.venue === 'shop' ? 'Name of the shop' : RS.venue === 'restaurant' ? 'Name of the restaurant' : 'Winery, tasting or at friends'}" value="${esc(RS.occasion)}"></label>
    ${picker}
    <label class="field">Food<input name="food" data-input="rs" placeholder="Duck breast with cherry sauce" value="${esc(RS.food)}"></label>
    <label class="field">Note<textarea name="note" data-input="rs" rows="2" placeholder="How it tasted, anything to remember">${esc(RS.note)}</textarea></label>
    ${RS.mode === 'add' ? `<p class="muted tiny" style="margin:0">${w ? 'Your rating goes to this wine and the tasting to your journal.' : 'Kept as a discovery, not in your cellar. Details, drinking window, taste profile and background are filled in with AI, about 3 cents.'}</p>` : ''}
    ${buttons}
  </div>`;
}
function setTasteRating(v) {
  if (!RS || RS.kind !== 'taste') return;
  RS.rating = v === null ? null : clamp(Math.round(v), 0, 100);
  const val = $('#ds-val'), bar = $('#ds-bar');
  if (val) { val.textContent = RS.rating === null ? 'Not rated' : RS.rating + '%'; val.classList.toggle('none', RS.rating === null); }
  if (bar) bar.innerHTML = segsHtml(RS.rating, 30, 'lg');
  rateRefresh('ds');
}
function setupTasteRating() {
  const bar = $('#ds-bar');
  if (!bar) return;
  let start = null, drag = false;
  const setX = x => { const r = bar.getBoundingClientRect(); setTasteRating(clamp((x - r.left) / r.width, 0, 1) * 100); };
  bar.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; drag = false; });
  bar.addEventListener('pointermove', e => {
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x), dy = Math.abs(e.clientY - start.y);
    if (!drag && dx > 6 && dx > dy) { drag = true; try { bar.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
    if (drag) setX(e.clientX);
  });
  bar.addEventListener('pointerup', e => { if (start && !drag) setX(e.clientX); start = null; drag = false; });
  bar.addEventListener('pointercancel', () => { start = null; drag = false; });
}

async function saveDiscovery() {
  const st = RS;
  if (st.pp.typing.trim()) addPerson(st.pp.typing);
  if (!st.venue) { toast('Choose Restaurant, Shop or Elsewhere.'); return; }
  if (str(st.price).trim() && parseMoney(st.price) === null) { toast('Prices need a number, for example 85.50.'); return; }
  const price = str(st.price).trim() ? parseMoney(st.price) : '';
  const fields = {
    type: 'Discovery', dir: 'taste', qty: 0, date: st.date || todayISO(), occasion: str(st.occasion).trim(), people: st.pp.people.map(p => p.name).join(', '), hearts: '',
    food: str(st.food).trim(), note: str(st.note).trim(), price, priceCur: price === '' ? '' : st.priceCur, loc: '', retailer: '',
    venue: st.venue || '', shopRef: st.shopRef ? JSON.stringify(st.shopRef) : ''
  };
  closeSheet();
  let w = wineById(st.wineId);
  const isNew = !w;
  if (isNew) {
    const x = st.info;
    // the shop price found while checking it becomes its street price, without another lookup
    const street = st.shopRef ? JSON.stringify({ v: st.shopRef.v, cur: st.shopRef.cur, date: todayISO(), src: st.offer ? st.offer.shop : 'Sommelier', conf: st.offer ? 'high' : 'medium' }) : '';
    // what was loaded with More about this wine is kept, so the AI is not asked twice
    const pv = previewOf(x) || {};
    w = normWine({ id: newId('w'), producer: x.producer, name: x.name, vintage: x.vintage, type: x.type || pv.type, region: x.region || pv.region, grapes: x.grapes || pv.grapes, origin: 'discovery', stock: '[]', myRating: st.rating, myFav: !!st.fav, street, offer: st.offer ? JSON.stringify(st.offer) : '',
      taste: pv.taste || '', tasteTags: (pv.tasteTags || []).join(', '), pairings: (pv.pairings || []).join(', '), drinkFrom: x.drinkFrom || pv.drinkFrom, drinkUntil: x.drinkUntil || pv.drinkUntil, peakFrom: x.peakFrom || pv.peakFrom, peakUntil: x.peakUntil || pv.peakUntil,
      profile: pv.profile ? JSON.stringify(pv.profile) : '' });
  }
  const entry = Object.assign({ id: st.id || newId('t'), wineId: w.id, wineName: fullName(w) }, fields);
  const rated = st.rating !== st.ratingInit;
  const favCh = !!st.fav !== !!st.favInit;
  const prev = { rating: w.myRating, fav: w.myFav, entries: S.removals.slice() };
  if (isNew) S.wines.push(w);
  if (rated) w.myRating = st.rating;
  if (favCh) w.myFav = !!st.fav;
  S.removals = S.removals.filter(r => r.id !== entry.id).concat([normRemoval(entry)]);
  persist();
  if (st.mode === 'add') go('#/wine/' + encodeURIComponent(w.id)); else refreshView();
  try {
    if (isNew) {
      const d = await api('saveWine', { wine: serialWine(w), entries: [entry] });
      upsertWine(normWine(d.wine));
      (d.entries || []).forEach(e => { S.removals = S.removals.filter(r => r.id !== e.id).concat([normRemoval(e)]); });
    } else {
      const upd = {};
      if (rated) upd.myRating = st.rating === null ? '' : st.rating;
      if (favCh) upd.myFav = st.fav ? true : '';
      if (rated || favCh) upsertWine(normWine(await api('update', { id: w.id, fields: upd })));
      const saved = normRemoval(await api('saveEntry', { entry }));
      S.removals = S.removals.filter(r => r.id !== saved.id).concat([saved]);
    }
    persist();
    refreshView();
  } catch (e) {
    if (isNew) S.wines = S.wines.filter(x => x.id !== w.id); else { w.myRating = prev.rating; w.myFav = prev.fav; }
    S.removals = prev.entries;
    persist();
    if (isNew && location.hash.includes(w.id)) history.back(); else refreshView();
    toast('Not saved: ' + e.message);
    return;
  }
  if (st.mode === 'add' && (isNew || missingParts(wineById(w.id)).length)) {
    const nw = wineById(w.id);
    if (nw && hasProfile(nw) && !missingParts(nw).length) fillInfos([nw]);       // loaded before: only the background is missing
    else completeDiscovery(w.id);
  }
}

/** Details, drinking window, taste profile and background, as Update wine info with AI does in Edit. */
async function completeDiscovery(id) {
  DISC_BUSY.add(id);
  refreshView();
  let msg = '';
  try {
    const d = await api('complete', { ids: [id] });
    (d.wines || []).forEach(r => upsertWine(normWine(r)));
    persist();
    if ((d.failed || []).length) msg = `Details could not be completed: ${aiErr(d.failed[0].error || 'no answer')} Use Update wine info with AI in Edit.`;
    const w = wineById(id);
    if (w) await fillInfos([w]);
  } catch (e) { msg = /Unknown action/i.test(e.message) ? 'This needs the new Code.gs.' : `Details could not be completed: ${aiErr(e.message)}`; }
  DISC_BUSY.delete(id);
  refreshView();
  toast(msg || 'Discovery complete: details, taste profile and background are filled in.');
}

/* keep what was typed before the sheet is drawn again */
function saveTasteInputs() {
  document.querySelectorAll('.sheet [data-input=rs]').forEach(el => { RS[el.name] = el.value; });
  const p = $('#people-input'); if (p) RS.pp.typing = p.value;
}
