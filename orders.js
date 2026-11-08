'use strict';
/* Vintary: wines ordered and not delivered yet. Entered from the wishlist, the consultant, Will I like it?
   or a wine page; when they arrive, only the storage place is left to choose. Loaded after places.js. */

function normOrder(x) {
  let details = null;
  try { details = x.details ? (typeof x.details === 'string' ? JSON.parse(x.details) : x.details) : null; } catch (e) { details = null; }
  const d = v => str(v).replace(/^'/, '').slice(0, 10);
  return {
    id: str(x.id), wineId: str(x.wineId), producer: str(x.producer), name: str(x.name), vintage: str(x.vintage), type: str(x.type),
    region: str(x.region), grapes: str(x.grapes), size: Number(x.size) || 75, qty: Math.max(1, Number(x.qty) || 1),
    price: x.price === '' || x.price === null || x.price === undefined || isNaN(Number(x.price)) ? null : Number(x.price), priceCur: str(x.priceCur) || cur(),
    retailer: str(x.retailer), ordered: d(x.ordered), expected: d(x.expected), sub: x.sub === true || str(x.sub).toLowerCase() === 'true',
    note: str(x.note), details, createdAt: str(x.createdAt)
  };
}
const orderTitle = o => { const w = o.wineId && wineById(o.wineId); return w ? fullName(w) : [o.producer, o.name, o.vintage].filter(Boolean).join(' '); };
const orderOverdue = o => !o.sub && o.expected && o.expected < todayISO();
const ordersFor = id => S.orders.filter(o => o.wineId === id);
function orderWhen(o) {
  if (o.sub) return { cls: 'sub', text: `Subscription · delivery ${o.expected ? o.expected.slice(0, 4) : 'later'}` };
  if (!o.expected) return { cls: '', text: 'No delivery date' };
  if (orderOverdue(o)) return { cls: 'late', text: `Overdue since ${fmtDate(o.expected)}` };
  return { cls: 'ok', text: `Expected ${fmtDate(o.expected)}` };
}
const orderSort = (a, b) => (orderOverdue(b) - orderOverdue(a)) || (a.sub - b.sub) || str(a.expected || '9999').localeCompare(str(b.expected || '9999')) || orderTitle(a).localeCompare(orderTitle(b));

/* ---------------------------------------------------------------- the sheet to enter or change an order */

function openOrderSheet(src, existing) {
  const o = existing || null;
  const base = o || src;
  RS = {
    kind: 'order', mode: o ? 'edit' : 'new', id: o ? o.id : newId('o'), src: Object.assign({}, base),
    qty: (o ? o.qty : src.qty) || 6, pmode: 'bottle',
    price: o ? (o.price === null ? '' : priceInput(o.price, o.priceCur)) : (src.price ? priceInput(src.price, src.priceCur || cur()) : ''),
    rp: newPicker('retailers', (o ? o.retailer : src.retailer) || '', { single: true }),
    ordered: o ? o.ordered || todayISO() : todayISO(),
    expected: o ? o.expected : '', sub: o ? o.sub : false, subYear: o && o.sub && o.expected ? o.expected.slice(0, 4) : String(new Date().getFullYear() + 1),
    note: o ? o.note : '', wishId: src && src.wishId || ''
  };
  renderSheet();
}

function orderSheetHtml() {
  const st = RS, s = st.src;
  const title = [s.producer, s.name, s.vintage].filter(Boolean).join(' ') || (s.wineId && wineById(s.wineId) ? fullName(wineById(s.wineId)) : 'Wine');
  const p = parseMoney(st.price);
  const per = p !== null && st.pmode === 'total' && st.qty ? p / st.qty : null;
  const tg = (act, v, on, label) => `<button class="${on ? 'on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${on}">${label}</button>`;
  return `<div class="sheet-backdrop" data-act="ord-close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="Ordered"><div class="grab"></div>
    <div class="between"><div style="min-width:0"><h2 style="font-size:18px;font-weight:600">${st.mode === 'edit' ? 'Edit order' : 'Ordered'}</h2><p class="small muted ellipsis" style="margin:2px 0 0">${esc(title)}</p></div><button class="icon-btn" data-act="ord-close" aria-label="Close">${ICON.x}</button></div>
    <div class="between"><span>Bottles</span><div class="stepper"><button data-act="ord-qty" data-d="-1" aria-label="Fewer">${ICON.minus}</button><input class="step-num" type="text" inputmode="numeric" pattern="[0-9]*" id="ord-qty" data-input="ord-qty" aria-label="Number of bottles" value="${st.qty}"><button data-act="ord-qty" data-d="1" aria-label="More">${ICON.plus}</button></div></div>
    <div class="field"><span>Price${curLabel()}</span><div class="toggle">${tg('ord-pmode', 'bottle', st.pmode === 'bottle', 'Per bottle')}${tg('ord-pmode', 'total', st.pmode === 'total', 'Total')}</div>
      <input name="price" data-input="ord" inputmode="decimal" placeholder="${st.pmode === 'total' ? 'For example 270.00' : 'For example 45.00'}" value="${esc(st.price)}">
      <span class="muted tiny" id="ord-per">${per !== null ? `That is ${esc(money(per))} per bottle.` : ''}</span></div>
    <div class="field"><span>Retailer</span><div id="people-chips" class="chips">${peopleChipsHtml()}</div>
      <input id="people-input" data-input="people" aria-label="Retailer" placeholder="Type the name of a shop or winery"${pickInputAttrs()} autocomplete="off" autocapitalize="words" enterkeyhint="done" value="${esc(PK() ? PK().typing : '')}">
      <div id="people-sugg">${peopleSuggHtml()}</div></div>
    <label class="field">Ordered on<input type="date" name="ordered" data-input="ord" value="${esc(st.ordered)}"></label>
    <div class="field"><span>Delivery</span><div class="toggle">${tg('ord-sub', '0', !st.sub, 'Expected on')}${tg('ord-sub', '1', st.sub, 'Subscription')}</div>
      ${st.sub ? `<input name="subYear" data-input="ord" inputmode="numeric" maxlength="4" placeholder="Year of delivery" aria-label="Year of delivery" value="${esc(st.subYear)}"><span class="muted tiny">En primeur and other subscriptions, delivered in a later year.</span>`
        : `<input type="date" name="expected" data-input="ord" aria-label="Expected delivery" value="${esc(st.expected)}"><span class="muted tiny">Leave it empty if you do not know yet.</span>`}</div>
    <label class="field">Note<textarea name="note" data-input="ord" rows="2" placeholder="Order number, case, anything to remember">${esc(st.note)}</textarea></label>
    <div class="grid2"><button class="btn" data-act="ord-close">Cancel</button><button class="btn primary" data-act="ord-save">Save</button></div>
    ${st.mode === 'edit' ? '<button class="btn danger block" data-act="ord-del">Delete order</button>' : ''}
  </div>`;
}

async function saveOrderSheet() {
  const st = RS;
  const qty = Math.max(1, Math.round(Number(st.qty) || 0));
  const p = parseMoney(st.price);
  if (str(st.price).trim() && p === null) { toast('Prices need a number, for example 45.50.'); return; }
  if (st.sub && !/^\d{4}$/.test(str(st.subYear))) { toast('Enter the year of delivery, for example 2027.'); return; }
  const P = st.rp;
  if (P.typing.trim() && !P.people.length) addPerson(P.typing);
  const s = st.src;
  const o = {
    id: st.id, wineId: str(s.wineId), producer: str(s.producer), name: str(s.name), vintage: str(s.vintage), type: str(s.type), region: str(s.region), grapes: str(s.grapes), size: Number(s.size) || 75,
    qty, price: p === null ? '' : Math.round((st.pmode === 'total' ? p / qty : p) * 100) / 100, priceCur: cur(),
    retailer: P.people.length ? P.people[0].name : '', ordered: st.ordered || todayISO(),
    expected: st.sub ? `${st.subYear}-12-31` : st.expected || '', sub: !!st.sub, note: str(st.note).trim(),
    details: s.details || null
  };
  const wishId = st.wishId;
  closeSheet();
  const prev = S.orders.slice();
  const local = normOrder(o);
  S.orders = S.orders.filter(x => x.id !== o.id).concat([local]);
  if (o.retailer && !S.retailers.some(r => lc(r.name) === lc(o.retailer))) S.retailers.push({ name: o.retailer, website: '' });
  persist();
  refreshView();
  toast(wishId ? 'Ordered. Moved from the wishlist to Ordered in Insights.' : 'Saved under Ordered in Insights.', 3500);
  try {
    const saved = normOrder(await api('saveOrder', { order: o }));
    S.orders = S.orders.filter(x => x.id !== saved.id).concat([saved]);
    persist();
    refreshView();
    if (wishId) wishDelete(wishId);
  } catch (e) { S.orders = prev; persist(); refreshView(); toast('Not saved: ' + e.message); }
}

async function deleteOrder(id, quiet) {
  const prev = S.orders.slice();
  S.orders = S.orders.filter(o => o.id !== id);
  persist();
  refreshView();
  try { await api('deleteOrder', { id }); } catch (e) { S.orders = prev; persist(); refreshView(); if (!quiet) toast('Not deleted: ' + e.message); }
}

/* ---------------------------------------------------------------- where an order comes from */

function orderFromWish(id) {
  const x = S.wishlist.find(w => w.id === id);
  if (!x) return;
  openOrderSheet({ producer: x.producer, name: x.name, vintage: x.vintage, type: x.type, region: x.region, grapes: x.grapes, qty: x.qty || 6,
    price: x.offer ? x.offer.v : x.price || null, priceCur: x.offer ? x.offer.cur : x.priceCur, retailer: x.offer ? x.offer.shop : '', details: previewOf(x), wishId: x.id });
}
function orderFromPick(i) {
  const p = CONS.result && CONS.result.picks && CONS.result.picks[i];
  if (!p) return;
  const o = CONS.offers[wishKey(p)];
  openOrderSheet({ producer: p.producer, name: p.name, vintage: p.vintage, type: p.type, region: p.region, grapes: p.grapes, qty: p.qty || 6,
    price: o ? o.v : p.price || null, priceCur: o ? o.cur : p.priceCur, retailer: o ? o.shop : '', details: previewOf(p) });
}
function orderFromSomm(i) {
  const t = sommThread()[i];
  const a = t && t.a, x = a && a.info;
  if (!x) return;
  const o = a.offer || null;
  openOrderSheet({ producer: x.producer, name: x.name, vintage: x.vintage, type: x.type, region: x.region, grapes: x.grapes, qty: 6,
    price: o ? o.v : null, priceCur: o ? o.cur : '', retailer: o ? o.shop : '', details: previewOf(x) });
}
/* more of a wine you have: the last purchase gives retailer, price and number */
function orderFromWine(id) {
  const w = wineById(id);
  if (!w) return;
  const last = inEntries(w).filter(e => e.type === 'Purchase').sort((a, b) => b.date.localeCompare(a.date))[0];
  openOrderSheet({ wineId: w.id, producer: w.producer, name: w.name, vintage: w.vintage, type: w.type, region: w.region, grapes: w.grapes, size: w.size,
    qty: last ? last.qty : 6, price: last && last.price !== null ? last.price : null, priceCur: cur(), retailer: last ? last.retailer : '' });
}

/* ---------------------------------------------------------------- arrival: only the storage place is left */

function orderArrive(id) {
  const o = S.orders.find(x => x.id === id);
  if (!o) return;
  const w = o.wineId && wineById(o.wineId);
  if (w) {
    openAddSheet(w.id);
    Object.assign(RS, { type: 'Purchase', qty: o.qty, price: o.price === null ? '' : priceInput(o.price, o.priceCur), note: o.note, rp: newPicker('retailers', o.retailer, { single: true }), orderId: o.id, date: todayISO() });
    renderSheet();
    return;
  }
  D = newDraft('add', null);
  D.step = 'form';
  D.fromOrder = o.id;
  const set = (k, v) => { if (str(v)) { D.fields[k] = str(v); D.touched.add(k); } };
  set('producer', o.producer); set('name', o.name); set('vintage', o.vintage); set('region', o.region); set('grapes', o.grapes);
  if (TYPES.includes(o.type)) { D.fields.type = o.type; D.touched.add('type'); }
  if (o.size && o.size !== 75) D.fields.size = String(o.size);
  D.stock[0].n = o.qty;
  D.acq.type = 'Purchase';
  D.acq.rp = newPicker('retailers', o.retailer, { single: true });
  if (o.price !== null) D.fields.price = priceInput(o.price, o.priceCur);
  D.fields.date = todayISO();
  const pv = o.details;
  if (pv) {
    ['region', 'grapes', 'taste'].forEach(k => { if (!D.fields[k] && pv[k]) D.fields[k] = pv[k]; });
    if ((pv.tasteTags || []).length) D.fields.tasteTags = pv.tasteTags.join(', ');
    if ((pv.pairings || []).length) D.fields.pairings = pv.pairings.join(', ');
    ['drinkFrom', 'drinkUntil', 'peakFrom', 'peakUntil'].forEach(k => { if (pv[k]) D.fields[k] = String(pv[k]); });
    if (pv.profile) D.profile = parseProfile(JSON.stringify(pv.profile)) || D.profile;
  }
  go('#/add');
  if (!pv) setTimeout(() => { if (D && D.fromOrder === o.id) runAnalysis(); }, 50);
  toast('Take a photo of the label if you like, choose where the bottles go, then save.', 5000);
}
/* after the bottles are stored: a partial delivery keeps the rest on the list */
async function orderArrived(id, n) {
  const o = S.orders.find(x => x.id === id);
  if (!o) return;
  if (n >= o.qty) { deleteOrder(id, true); return; }
  const next = Object.assign({}, o, { qty: o.qty - n });
  S.orders = S.orders.map(x => (x.id === id ? next : x));
  persist();
  toast(`${o.qty - n} ${o.qty - n === 1 ? 'bottle is' : 'bottles are'} still on order.`, 4000);
  try { await api('saveOrder', { order: Object.assign({}, next, { details: next.details || '' }) }); } catch (e) { toast('Order not updated: ' + e.message); }
}

/* ---------------------------------------------------------------- the list */

function orderCardHtml(o) {
  const w = o.wineId && wineById(o.wineId), when = orderWhen(o);
  const title = w ? `<a href="#/wine/${encodeURIComponent(w.id)}">${esc(orderTitle(o))}</a>` : esc(orderTitle(o));
  const price = o.price !== null ? `${o.qty} × ${esc(priceText(o.price, o.priceCur))}` : `${o.qty} ${o.qty === 1 ? 'bottle' : 'bottles'}`;
  const sub = [o.region, o.type].filter(Boolean).join(' · ');
  return `<div class="ord-card">
    <div class="between" style="gap:8px"><span class="ord-when ${when.cls}">${esc(when.text)}</span><span class="small">${price}</span></div>
    <div><p class="cons-title">${title}</p>${sub ? `<p class="small muted" style="margin:2px 0 0">${countryOf(o) ? flagOf(o) : ''}${esc(sub)}</p>` : ''}</div>
    <p class="small" style="margin:0">${o.retailer ? `From <b>${esc(o.retailer)}</b> · ` : ''}ordered ${esc(fmtDate(o.ordered || o.createdAt))}${w ? ` · ${w.count} in stock` : ' · new to your cellar'}</p>
    ${o.note ? `<p class="small muted" style="margin:0">${esc(o.note)}</p>` : ''}
    <div class="grid2"><button class="btn" data-act="ord-edit" data-id="${esc(o.id)}">Edit</button><button class="btn primary" data-act="ord-arrive" data-id="${esc(o.id)}">${ICON.check}Arrived</button></div>
  </div>`;
}

function viewOrders() {
  const list = S.orders.slice().sort(orderSort);
  const bottles = list.reduce((a, o) => a + o.qty, 0);
  const total = list.reduce((a, o) => a + (o.price !== null ? (conv(o.price, o.priceCur) || 0) * o.qty : 0), 0);
  const old = S.version && S.version < 45;
  return `<main class="screen has-nav">
    <div class="detail-top"><a class="back" href="#/insights">${ICON.back}Insights</a></div>
    <header><h1 class="title">Ordered</h1><p class="muted small" style="margin:4px 0 0">Not yet delivered${list.length ? ` · ${list.length} ${list.length === 1 ? 'order' : 'orders'}, ${bottles} ${bottles === 1 ? 'bottle' : 'bottles'}${total ? `, ${esc(money(total))}` : ''}` : ''}</p></header>
    ${old ? '<div class="card notice"><b>Script update needed</b><p class="small" style="margin:4px 0 0">Orders need the new Code.gs. Replace the script code and create a new version under Manage deployments.</p></div>' : ''}
    ${list.length ? list.map(orderCardHtml).join('') : `<div class="empty" style="padding:24px 0"><p class="muted">Nothing on order. Tap <b>Ordered</b> on a wishlist wine, a suggestion of the consultant, a Will I like it? answer, or <b>Order more</b> on a wine page.</p></div>`}
    ${list.length ? '<p class="muted tiny" style="margin:0">When bottles arrive, tap Arrived and choose where they go. Retailer, price and the details of the wine are filled in. If only part arrives, the rest stays here.</p>' : ''}
  </main>${nav('insights')}`;
}

const OR_ACTS = {
  'ord-wish': el => orderFromWish(el.dataset.id),
  'ord-pick': el => orderFromPick(Number(el.dataset.i)),
  'ord-somm': el => orderFromSomm(Number(el.dataset.i)),
  'ord-wine': el => orderFromWine(el.dataset.id),
  'ord-edit': el => { const o = S.orders.find(x => x.id === el.dataset.id); if (o) openOrderSheet(null, o); },
  'ord-arrive': el => orderArrive(el.dataset.id),
  'ord-close': () => closeSheet(),
  'ord-save': () => saveOrderSheet(),
  'ord-del': () => { const id = RS && RS.id; if (!id || !confirm('Delete this order?')) return; closeSheet(); deleteOrder(id); },
  'ord-qty': el => { RS.qty = clamp((Number(RS.qty) || 1) + Number(el.dataset.d), 1, 999); renderSheet(); },
  'ord-pmode': el => { RS.pmode = el.dataset.v === 'total' ? 'total' : 'bottle'; renderSheet(); },
  'ord-sub': el => { RS.sub = el.dataset.v === '1'; renderSheet(); },
  'go-orders': () => go('#/orders')
};
const OR_INPUTS = {
  ord: el => {
    if (!RS) return;
    RS[el.name] = el.value;
    if (el.name === 'price') { const p = parseMoney(RS.price), t = $('#ord-per'); if (t) t.textContent = p !== null && RS.pmode === 'total' && RS.qty ? `That is ${money(p / RS.qty)} per bottle.` : ''; }
  },
  'ord-qty': el => { if (RS) RS.qty = clamp(Math.round(Number(el.value.replace(/\D/g, '')) || 1), 1, 999); }
};
