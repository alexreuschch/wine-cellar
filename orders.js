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
    note: str(x.note), details, createdAt: str(x.createdAt),
    fit: x.fit === '' || x.fit === null || x.fit === undefined || isNaN(Number(x.fit)) ? null : Math.round(Number(x.fit)), why: str(x.why)
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
    qty: (o ? o.qty : src.qty) || 6,
    unit: o ? (o.price === null ? null : unitOf(o.price, o.priceCur)) : src.unit !== undefined ? src.unit : (src.price ? unitOf(src.price, src.priceCur || cur()) : null),
    rp: newPicker('retailers', (o ? o.retailer : src.retailer) || '', { single: true }),
    ordered: o ? o.ordered || todayISO() : todayISO(),
    expected: o ? o.expected : '', sub: o ? o.sub : false, subYear: o && o.sub && o.expected ? o.expected.slice(0, 4) : String(new Date().getFullYear() + 1),
    note: o ? o.note : '', wishId: src && src.wishId || '', delivered: false,
    website: src && src.website ? src.website : ''
  };
  RS.price = totalOf(RS.unit, RS.qty);
  if (src && src.note) RS.note = src.note;
  renderSheet();
}

function orderSheetHtml() {
  const st = RS, s = st.src;
  const title = [s.producer, s.name, s.vintage].filter(Boolean).join(' ') || (s.wineId && wineById(s.wineId) ? fullName(wineById(s.wineId)) : 'Wine');
  const tg = (act, v, on, label) => `<button class="${on ? 'on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${on}">${label}</button>`;
  const head = st.mode === 'edit' ? 'Edit order' : st.delivered ? 'Bottles added' : 'Ordered';
  return `<div class="sheet-backdrop" data-act="ord-close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${head}"><div class="grab"></div>
    <div class="between"><div style="min-width:0"><h2 style="font-size:18px;font-weight:600">${head}</h2><p class="small muted ellipsis" style="margin:2px 0 0">${esc(title)}</p></div><button class="icon-btn" data-act="ord-close" aria-label="Close">${ICON.x}</button></div>
    ${st.mode === 'new' ? buyStatusHtml(!st.delivered) : ''}
    <div class="between"><span>Bottles</span><div class="stepper"><button data-act="ord-qty" data-d="-1" aria-label="Fewer">${ICON.minus}</button><input class="step-num" type="text" inputmode="numeric" pattern="[0-9]*" id="ord-qty" data-input="ord-qty" aria-label="Number of bottles" value="${st.qty}"><button data-act="ord-qty" data-d="1" aria-label="More">${ICON.plus}</button></div></div>
    ${totalFieldHtml(st, 'ord')}
    <div class="field"><span>Retailer</span><div id="people-chips" class="chips">${peopleChipsHtml()}</div>
      <input id="people-input" data-input="people" aria-label="Retailer" placeholder="Type the name of a shop or winery"${pickInputAttrs()} autocomplete="off" autocapitalize="words" enterkeyhint="done" value="${esc(PK() ? PK().typing : '')}">
      <div id="people-sugg">${peopleSuggHtml()}</div></div>
    ${ordNewRetailer() ? `<label class="field">Website of ${esc(ordNewRetailer())}<input name="website" data-input="ord" inputmode="url" autocapitalize="off" placeholder="www.shop.ch" value="${esc(st.website)}"></label>` : ''}
    ${st.delivered ? '' : `<label class="field">Ordered on<input type="date" name="ordered" data-input="ord" value="${esc(st.ordered)}"></label>
    <div class="field"><span>Delivery</span><div class="toggle">${tg('ord-sub', '0', !st.sub, 'Expected on')}${tg('ord-sub', '1', st.sub, 'Subscription')}</div>
      ${st.sub ? `<input name="subYear" data-input="ord" inputmode="numeric" maxlength="4" placeholder="Year of delivery" aria-label="Year of delivery" value="${esc(st.subYear)}"><span class="muted tiny">En primeur and other subscriptions, delivered in a later year.</span>`
        : `<input type="date" name="expected" data-input="ord" aria-label="Expected delivery" value="${esc(st.expected)}"><span class="muted tiny">Leave it empty if you do not know yet.</span>`}</div>`}
    <label class="field">Note<textarea name="note" data-input="ord" rows="2" placeholder="Order number, case, anything to remember">${esc(st.note)}</textarea></label>
    ${st.delivered ? '<p class="muted tiny" style="margin:-6px 0 0">Next you add the wine to your cellar and choose where the bottles go.</p>' : ''}
    <div class="grid2"><button class="btn" data-act="ord-close">Cancel</button><button class="btn primary" data-act="ord-save">${st.delivered ? 'Save and store' : 'Save'}</button></div>
    ${st.mode === 'edit' ? '<button class="btn danger block" data-act="ord-del">Delete order</button>' : ''}
  </div>`;
}

/* a retailer that is not in your list yet gets its website, from the link of the offer */
const ordNewRetailer = () => { const P = RS && RS.rp; const n = P && P.people.length ? P.people[0].name : ''; return n && !S.retailers.some(r => lc(r.name) === lc(n)) ? n : ''; };
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
    qty, price: p === null ? '' : Math.round(p / qty * 100) / 100, priceCur: cur(),
    retailer: P.people.length ? P.people[0].name : '', ordered: st.ordered || todayISO(),
    expected: st.sub ? `${st.subYear}-12-31` : st.expected || '', sub: !!st.sub, note: str(st.note).trim(),
    details: s.details || null, fit: s.fit === undefined || s.fit === null ? '' : s.fit, why: str(s.why).slice(0, 500)
  };
  const wishId = st.wishId, delivered = st.delivered, site = str(st.website).trim(), newRet = o.retailer && !S.retailers.some(r => lc(r.name) === lc(o.retailer));
  closeSheet();
  const prev = S.orders.slice();
  const local = normOrder(o);
  S.orders = S.orders.filter(x => x.id !== o.id).concat([local]);
  if (newRet) S.retailers.push({ name: o.retailer, website: site });
  persist();
  refreshView();
  if (!delivered) toast(wishId ? 'Moved from the wishlist to Ordered in Insights.' : 'Saved under Ordered in Insights.', 3500);
  try {
    const saved = normOrder(await api('saveOrder', { order: Object.assign({}, o, { details: o.details ? JSON.stringify(o.details) : '' }) }));
    S.orders = S.orders.filter(x => x.id !== saved.id).concat([saved]);
    persist();
    refreshView();
    if (newRet && site) saveRetailerSite(o.retailer, site);
    if (wishId) wishDelete(wishId);
    if (delivered) orderArrive(saved.id);
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
  openOrderSheet(Object.assign(wineSrc(w), { qty: last ? last.qty : 6, price: last && last.price !== null ? last.price : null, priceCur: last ? last.priceCur || cur() : cur(), retailer: last ? last.retailer : '' }));
}

/* ---------------------------------------------------------------- arrival: only the storage place is left */

function orderArrive(id) {
  const o = S.orders.find(x => x.id === id);
  if (!o) return;
  const w = o.wineId && wineById(o.wineId);
  if (w) {
    openAddSheet(w.id);
    const unit = o.price === null ? null : unitOf(o.price, o.priceCur);
    Object.assign(RS, { type: 'Purchase', qty: o.qty, unit, price: totalOf(unit, o.qty), note: orderNote(o), rp: newPicker('retailers', o.retailer, { single: true }), orderId: o.id, date: todayISO() });
    renderSheet();
    return;
  }
  D = newDraft('add', null);
  D.step = 'form';
  D.fromOrder = o.id;
  D.orderFrom = o.retailer;
  D.orderNote = orderNote(o);
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
}
/* one line in the journal: when it was ordered, the note of the order */
const orderNote = o => [o.ordered ? `Ordered ${fmtDate(o.ordered)}` : '', o.note].filter(Boolean).join(' · ');
/* the bar on top of the form when an order is stored */
function orderBannerHtml() {
  if (!D || !D.fromOrder) return '';
  return `<div class="ord-banner">${ICON.box}<span><b>Delivery of your order${D.orderFrom ? ` from ${esc(D.orderFrom)}` : ''}</b><br>Take a photo of the label if you like, choose where the bottles go, then save.</span><button class="btn" data-act="ord-notyet">Not delivered yet</button></div>`;
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
  return `<div class="cons-card ord-card">
    <div class="between" style="gap:8px"><span class="ord-when ${when.cls}">${esc(when.text)}</span><span class="small">${price}</span></div>
    <div><p class="cons-title">${title}</p>${sub ? `<p class="small muted" style="margin:2px 0 0">${countryOf(o) ? flagOf(o) : ''}${esc(sub)}</p>` : ''}</div>
    <p class="small" style="margin:0">${o.retailer ? `From <b>${esc(o.retailer)}</b> · ` : ''}ordered ${esc(fmtDate(o.ordered || o.createdAt))}${w ? ` · ${w.count} in stock` : ' · new to your cellar'}</p>
    ${o.note ? `<p class="small muted" style="margin:0">${esc(o.note)}</p>` : ''}
    ${w ? '' : fitBarHtml(o.fit)}
    <div class="cons-actions">${w ? '' : `<button class="link-btn" data-act="ord-more" data-id="${esc(o.id)}">${ICON.magic}More about this wine</button>`}<button class="link-btn" data-act="ord-edit" data-id="${esc(o.id)}">${ICON.edit}Edit</button></div>
    <button class="btn outline-gold block" data-act="ord-arrive" data-id="${esc(o.id)}">${ICON.box}Mark as delivered</button>
  </div>`;
}

/* in Insights, above the wishlist */
function ordersSectionHtml() {
  const list = S.orders.slice().sort(orderSort);
  const bottles = list.reduce((a, o) => a + o.qty, 0);
  const total = list.reduce((a, o) => a + (o.price !== null ? (conv(o.price, o.priceCur) || 0) * o.qty : 0), 0);
  const old = S.version && S.version < 45;
  return `<section class="ins-sec list-sec" id="orders"><div class="sec-head"><h2 class="list-sec-h">${ICON.box}Ordered, not yet delivered</h2>${list.length ? `<span class="muted small">${list.length}</span>` : ''}</div>
    ${old ? '<p class="small" style="margin:0;color:var(--danger)">Orders need the new Code.gs.</p>' : ''}
    ${list.length ? `<p class="small muted" style="margin:-4px 0 0">${bottles} ${bottles === 1 ? 'bottle' : 'bottles'}${total ? `, ${esc(money(total))}` : ''}</p><div class="cons-list">${list.map(orderCardHtml).join('')}</div>`
      : '<p class="small muted" style="margin:0">Nothing on its way. Tap <b>I ordered it</b> on a wine you bought online, at a winery or by phone.</p>'}
  </section>`;
}
function wishSectionHtml() {
  return `<section class="ins-sec list-sec" id="wishlist"><div class="sec-head"><h2 class="list-sec-h">${ICON.bookmark}Wishlist</h2>${S.wishlist.length ? `<span class="muted small">${S.wishlist.length}</span>` : ''}</div>
    ${S.wishlist.length ? `<div class="cons-list">${S.wishlist.map(wishCardHtml).join('')}</div>` : '<p class="small muted" style="margin:0">Save wines here from the consultant, a wine list or Will I like it?.</p>'}
  </section>`;
}
/* the header icons in Insights lead to these sections */
function goSection(id) {
  if (typeof PREV !== 'undefined' && PREV.open) closePreview();
  if (route().p === 'insights') { const el = $('#' + id); if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -10); } return; }
  U.jumpTo = id;
  go('#/insights');
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
  'ord-qty': el => { RS.qty = clamp((Number(RS.qty) || 1) + Number(el.dataset.d), 1, 999); $('#ord-qty').value = RS.qty; totalSetQty(RS); },
  'buy-status': el => buyStatus(el.dataset.v === 'ordered'),
  'ord-sub': el => { RS.sub = el.dataset.v === '1'; renderSheet(); },
  'go-orders': () => goSection('orders'),
  'ord-notyet': () => { D = null; U.jumpTo = 'orders'; go('#/insights', true); },
  'go-wishlist': () => goSection('wishlist'),
  'ord-more': el => { const o = S.orders.find(x => x.id === el.dataset.id); if (!o) return; const base = sgBase(o); if (o.details && !previewOf(base)) prevRemember(base, o.details); openPreview(base, o.why ? esc(o.why) : '', null); }
};
const OR_CHANGES = {};
const OR_INPUTS = {
  ord: el => {
    if (!RS) return;
    RS[el.name] = el.value;
    if (el.name === 'price') totalTyped(RS);
  },
  'ord-qty': el => { if (!RS) return; RS.qty = clamp(Math.round(Number(el.value.replace(/\D/g, '')) || 1), 1, 999); totalSetQty(RS); }
};

/* Delivered or Ordered. A wine you have switches between the + sheet and the order sheet,
   a new wine is stored through the add form after saving. */
function buyStatus(ordered) {
  const st = RS;
  if (!st) return;
  const P = st.rp;
  if (P && P.typing.trim() && !P.people.length && PK() === P) addPerson(P.typing);
  const ret = P && P.people.length ? P.people[0].name : '';
  const known = ret && S.retailers.find(r => lc(r.name) === lc(ret));
  if (st.kind === 'order') {
    if (st.delivered === !ordered) return;
    const w = st.src.wineId && wineById(st.src.wineId);
    if (!ordered && w) {
      const site = known ? str(known.website) : '';
      openAddSheet(w.id);
      Object.assign(RS, { type: 'Purchase', qty: st.qty, unit: st.unit, price: st.price, note: st.note, rp: newPicker('retailers', ret, { single: true }),
        website: known ? site : st.website, websiteInit: site });
      renderSheet();
      return;
    }
    st.delivered = !ordered;
    renderSheet();
    return;
  }
  if (st.kind === 'in' && ordered) {
    const w = wineById(st.wineId);
    if (!w) return;
    openOrderSheet(Object.assign(wineSrc(w), { qty: st.qty, unit: st.unit === undefined ? (parseMoney(st.price) === null ? null : parseMoney(st.price) / st.qty) : st.unit,
      retailer: ret, note: st.note, website: known ? '' : st.website }));
  }
}
const wineSrc = w => ({ wineId: w.id, producer: w.producer, name: w.name, vintage: w.vintage, type: w.type, region: w.region, grapes: w.grapes, size: w.size });

/* ---------------------------------------------------------------- a suggested wine, the same everywhere
   ref: cons:i (consultant), wl:i (wine list), check:i (Will I like it?), wish:id (wishlist) */

const sgBase = p => ({ producer: str(p.producer), name: str(p.name), vintage: p.vintage ? String(p.vintage) : '', type: str(p.type), region: str(p.region), grapes: str(p.grapes) });
const wishOf = base => S.wishlist.find(x => wishKey(x) === wishKey(base));
const hostOf = url => { try { return new URL(url).hostname; } catch (e) { return ''; } };
function sgGet(ref) {
  const [k, v] = str(ref).split(':');
  if (k === 'cons') {
    const p = CONS.result && CONS.result.picks[Number(v)];
    if (!p) return null;
    return { k, ref, base: sgBase(p), fit: p.fit, why: p.why, offer: CONS.offers[wishKey(p)] || null, price: p.price, priceCur: p.priceCur, qty: p.qty, save: () => consSave(p), preview: () => consPreview(Number(v)) };
  }
  if (k === 'wl') {
    const res = WL.result, p = res && res.picks[Number(v)];
    if (!p) return null;
    return { k, ref, base: Object.assign(sgBase(p), p.window || {}), fit: p.fit, why: p.why, offer: p.offer || null, price: p.shopPrice, priceCur: res.currency || cur(), qty: 6, save: () => listSave(p), preview: () => listPreview(Number(v)), taste: () => listTaste(Number(v)) };
  }
  if (k === 'check') {
    const t = sommThread()[Number(v)], a = t && t.a;
    if (!a) return null;
    const x = a.info && (a.info.producer || a.info.name) ? a.info : { producer: '', name: a.wine, vintage: '', type: '', region: a.region || '', grapes: '' };
    const o = a.offer || a.worldOffer || null;
    return { k, ref, base: sgBase(x), fit: a.fit, why: a.answer, offer: o, price: o ? o.v : null, priceCur: o ? o.cur : cur(), qty: 6, save: () => checkSave(Number(v)), preview: () => sommPreview(Number(v)), taste: () => sommTaste(Number(v)) };
  }
  if (k === 'wish') {
    const x = S.wishlist.find(w => w.id === v);
    if (!x) return null;
    return { k, ref, base: sgBase(x), fit: x.fit, why: x.why, offer: x.offer, price: x.price, priceCur: x.priceCur, qty: x.qty || 6, wishId: x.id, details: x.details, preview: () => wishPreview(x.id) };
  }
  return null;
}
/* the four things you can do with a suggested wine */
function sgActionsHtml(ref, opts = {}) {
  const g = sgGet(ref);
  if (!g) return '';
  const wished = !!wishOf(g.base);
  const b = (act, icon, label, on) => `<button class="link-btn${on ? ' on' : ''}" data-act="${act}" data-ref="${esc(ref)}"${on ? ' aria-pressed="true"' : ''}>${icon}${label}</button>`;
  return `<div class="cons-actions sg-actions">${opts.more === false ? '' : b('sg-more', ICON.magic, 'More about this wine')}${b('sg-taste', ICON.spark, "I'm tasting this")}${b('sg-wish', wished ? ICON.check : ICON.bookmark, wished ? 'Saved to wishlist' : 'Save to wishlist', wished)}${b('sg-order', ICON.cart, 'I ordered it')}</div>`;
}
const fitBarHtml = fit => (fit === null || fit === undefined || fit === '' ? '' : `<div class="wl-fit"><div class="between"><span class="tiny muted">How well it fits your taste</span><b>${Number(fit)}%</b></div>${segsHtml(Number(fit), 12)}</div>`);
function sgOrder(g) {
  const o = g.offer;
  openOrderSheet({ ...g.base, qty: g.qty || 6, price: o ? o.v : g.price || null, priceCur: o ? o.cur : g.priceCur, retailer: o ? o.shop : '', website: o ? hostOf(o.url) : '',
    details: previewOf(g.base) || g.details || null, fit: g.fit, why: g.why, wishId: g.wishId || (wishOf(g.base) || {}).id || '' });
}
function sgRefresh() { refreshView(); if (PREV.open) renderPreview(); if (route().p === 'sommelier') sommRefresh(false); }
const SG_ACTS = {
  'sg-more': el => { const g = sgGet(el.dataset.ref); if (g) g.preview(); },
  'sg-taste': el => {
    const g = sgGet(el.dataset.ref);
    if (!g) return;
    if (PREV.open) closePreview();
    if (g.taste) g.taste(); else openDiscovery(g.base, {});
  },
  'sg-wish': async el => {
    const g = sgGet(el.dataset.ref);
    if (!g) return;
    const x = wishOf(g.base);
    if (x) {
      if (!await ask({ title: 'Remove from your wishlist?', text: orderTitle(x), yes: 'Remove', no: 'Keep', danger: true })) return;
      if (PREV.open && g.k === 'wish') closePreview();
      await wishDelete(x.id);
      toast('Removed from your wishlist', 2500);
    } else await g.save();
    sgRefresh();
  },
  'sg-order': el => { const g = sgGet(el.dataset.ref); if (!g) return; if (PREV.open) closePreview(); sgOrder(g); }
};
Object.assign(OR_ACTS, SG_ACTS);

/* ---------------------------------------------------------------- back from a shop: maybe you ordered there
   Only after at least a minute in the shop, shown quietly under the offer until you leave the screen. */

const SHOPV = 'wc-shopvisit';
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[data-shop]');
  if (a) store.set(SHOPV, { ref: a.dataset.sref, shop: a.dataset.shop, t: Date.now(), hash: location.hash });
}, true);
function shopBackCheck() {
  const v = store.get(SHOPV, null);
  if (!v) return;
  store.del(SHOPV);
  const dt = Date.now() - v.t;
  if (dt < 60000 || dt > 3 * 3600000 || location.hash !== v.hash) return;
  U.shopBack = v;
  refreshView();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') shopBackCheck(); });
setTimeout(shopBackCheck, 1500);
/* already on its way? then there is nothing to ask */
function orderedAlready(ref) {
  const [k, id] = str(ref).split(':');
  if (k === 'wine') return S.orders.some(o => o.wineId === id);
  const g = sgGet(ref);
  return !!g && S.orders.some(o => wishKey(o) === wishKey(g.base));
}
function shopBackHtml(ref) {
  const v = U.shopBack;
  if (!v || v.ref !== ref || orderedAlready(ref)) return '';
  const wine = ref.startsWith('wine:');
  return `<div class="shop-back">${ICON.cart}<span>Ordered at ${esc(v.shop)}?</span><button class="btn" data-act="${wine ? 'ord-wine' : 'sg-order'}" ${wine ? `data-id="${esc(ref.slice(5))}"` : `data-ref="${esc(ref)}"`}>I ordered it</button></div>`;
}
