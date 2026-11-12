'use strict';

/* Wine Cellar: AI sommelier, value over time, AI consultant and wishlist. Loaded after app.js, in the order of index.html. */

/* ------------------------------------------------------------ view: drinking window */

/* ------------------------------------------------------------ AI sommelier */

const SOMM = { mode: 'cellar', threads: { cellar: [], check: [] }, draft: '', foods: [], foodsAt: 0, busy: false, rec: null, listening: false, voiced: false, tips: false, photo: null, where: null, whereAt: 0, price: '', redo: '',
  step: { cellar: 1, check: 1, list: 1 }, occ: '', people: 2, pplSet: false };
const sommThread = () => SOMM.threads[SOMM.mode] || [];
/* wine list in a restaurant: photos of the pages, price range and food, then three picks */
const WL = { pages: [], min: '', max: '', result: null, error: '', busy: false, edit: false };
const WL_KIND = { range: ['Best in your range', 'safe'], value: ['Best value', 'value'], gem: ['Hidden gem', 'disc'] };
/* the food for the sommelier, chosen as tiles in groups and kept for the evening */
const FOOD_GROUPS = [['Meat', ['beef', 'lamb', 'pork', 'game', 'poultry', 'curedmeat']], ['Fish and seafood', ['fish', 'seafood']], ['Pasta, pizza and vegetables', ['pasta', 'pizza', 'vegetarian', 'mushrooms']], ['Cheese', ['hardcheese', 'softcheese']], ['More', ['spicy', 'asian', 'aperitif', 'dessert']]];
const CHECK_FOODS = FOOD_GROUPS.flatMap(g => g[1]);
/* the occasion for a wine from the cellar */
const OCCASIONS = [['Dinner', 'dining'], ['Lunch', 'clock'], ['Aperitif', 'aperitif'], ['Celebration', 'spark'], ['As a gift', 'gift'], ['Just a glass', 'glass']];
const FOOD_HINT = { beef: 'steak with pepper sauce and fries', lamb: 'rack of lamb with rosemary', poultry: 'roast chicken with lemon', fish: 'grilled sea bass with butter sauce', seafood: 'mussels in white wine', pasta: 'pasta with tomato and basil', vegetarian: 'vegetable risotto', hardcheese: 'aged Gruyère', pork: 'pork roast with mustard', game: 'venison with red cabbage', pizza: 'pizza with salami', mushrooms: 'mushroom risotto', spicy: 'Thai red curry', asian: 'Peking duck', softcheese: 'Brie and Camembert', curedmeat: 'Parma ham and salami', dessert: 'chocolate cake', aperitif: 'nuts and olives' };
const sommFoods = () => (Date.now() - SOMM.foodsAt < 3 * 3600e3 ? SOMM.foods.filter(k => FOODS[k]) : []);
const sommFoodText = () => sommFoods().map(k => FOODS[k][0]).join(', ');

/* tips after an answer, shown with Tips */
function sommGuideHtml() {
  if (SOMM.mode === 'check') return checkGuideHtml();
  return `<div class="somm-guide">
    <ul>
      <li><b>Ask a follow-up</b> in the field below, for example “something lighter?” or “and for dessert?”.</li>
      <li><b>Tap a wine</b> to open it, or Take a bottle when you open it.</li>
      <li><b>New question</b> starts again with the occasion.</li>
    </ul>
    <p class="tiny muted">Answers come from AI and are suggestions. Each question costs a few cents.</p>
  </div>`;
}

/* tips after a wine check */
function checkGuideHtml() {
  return `<div class="somm-guide">
    <ul>
      <li><b>Ask a follow-up</b> in the field below, for example “is the 2019 better?”.</li>
      <li><b>Change the country</b> above and the prices are checked there again.</li>
      <li><b>New wine</b> starts again with the photo.</li>
    </ul>
    <p class="tiny muted">Answers come from AI. Each check costs about 5 cents, a little less when the wine was checked in the last 14 days.</p>
  </div>`;
}

/* compare with the shop price, or in a restaurant also with a fair price on the wine list;
   the restaurant is kept for some hours, then it is the shop price again */
const WHERE_TTL = 3 * 3600e3;
const sommWhere = () => (SOMM.where === 'restaurant' && Date.now() - SOMM.whereAt < WHERE_TTL ? 'restaurant' : 'shop');
const whereRowHtml = () => `<div id="where-row" class="wz-where">${countryBtnHtml('Prices for')}${redoHtml('check')}</div>`;
/* the country prices are checked in, shown where you start the analysis */
const countryBtnHtml = lead => { const c = travelCountry(); return `<button class="travel-row" data-act="pick-open" data-k="travel">${ICON.pin}<span>${lead} ${flagOfCode(c)}<b>${esc(SHOP_COUNTRIES[c])}</b> · ${esc(countryCur(c))}</span><small>Change</small></button>`; };
/* after the country was changed, offer to run the last analysis again for it */
const redoHtml = mode => {
  if (SOMM.redo !== mode) return '';
  const c = travelCountry();
  return `<div class="tz-hint redo" id="somm-redo"><p>Update the last ${mode === 'list' ? 'wine list' : 'wine check'} for ${flagOfCode(c)}<b>${esc(SHOP_COUNTRIES[c])}</b>, with prices in ${esc(countryCur(c))}?</p><div class="tz-acts"><button class="btn accent" data-act="somm-redo">Update</button><button class="btn ghost" data-act="somm-redo-no">Keep as it is</button></div></div>`;
};
const lastCheck = () => [...SOMM.threads.check].reverse().find(t => t.a && t.a.wine) || null;
/* the country was changed: remember to offer the update when the shown result is for another country */
function sommCountryChanged() {
  const c = travelCountry(), t = lastCheck();
  SOMM.redo = SOMM.mode === 'list' ? (WL.result && WL.result.country && WL.result.country !== c && !WL.busy ? 'list' : '')
    : SOMM.mode === 'check' ? (t && t.a.country && t.a.country !== c && !SOMM.busy ? 'check' : '') : '';
}
/* converts between any two currencies with the stored rates, or null */
function convTo(v, from, to) {
  if (v === null || v === undefined || !(Number(v) > 0)) return null;
  if (from === to) return Number(v);
  const r = rates();
  return r[from] && r[to] ? Number(v) / r[from] * r[to] : null;
}
/* a price shown in the currency of the trip, with your own currency behind it */
function tripPrice(v, from, tripCur) {
  const c = from !== tripCur ? convTo(v, from, tripCur) : null;
  return c !== null ? dualPrice(Math.round(c * 100) / 100, tripCur, c >= 1000 ? 0 : 2) : dualPrice(v, from);
}
/* shop with flag and country; for a shop abroad also its own price */
function shopLineHtml(o, tripCur, abroad) {
  const land = o.country ? (SHOP_COUNTRIES[o.country] || o.country) : '';
  const own = o.cur !== tripCur ? ` · ${o.cur} ${fmtNum(o.v, 2)}` : '';
  return `<div class="wl-shop">${flagOfCode(o.country)}<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.shop)}${abroad && land ? `, ${esc(land)}` : ''}${esc(own)}${o.vintage ? `, vintage ${esc(o.vintage)}` : ''}</a>${ICON.link}</div>`;
}
/* the price you saw next to the price in local shops, or a reference from abroad */
/* the food: how the wine goes with what you eat, or two dishes for it */
const PAIR = { great: ['Great with your food', 'up'], works: ['Works with your food', ''], 'not ideal': ['Not ideal with your food', 'down'] };
function foodHtml(a) {
  if (a.pairing && PAIR[a.pairing.verdict]) {
    const [label, cls] = PAIR[a.pairing.verdict];
    return `<div class="somm-food">${ICON.dining}<div><p class="verdict"><b class="${cls}">${label}</b></p>${a.food ? `<p class="tiny muted" style="margin:0">${esc(a.food)}</p>` : ''}${a.pairing.why ? `<p class="small" style="margin:0">${esc(a.pairing.why)}</p>` : ''}</div></div>`;
  }
  if (a.dishes && a.dishes.length) return `<div class="somm-food">${ICON.dining}<p class="small" style="margin:0"><b>${a.priceWhere === 'restaurant' ? 'Goes well with' : 'Cook with it'}</b><br>${a.dishes.map(esc).join(' · ')}</p></div>`;
  return '';
}
function priceCheckHtml(a) {
  if (!a.wine || !a.country) return '';
  const where = SHOP_COUNTRIES[a.country] || a.country, tripCur = countryCur(a.country);
  const o = a.offer || a.worldOffer, abroad = !a.offer && !!a.worldOffer;
  const rows = [];
  const resto = a.priceWhere === 'restaurant', typ = a.typical || [2, 3];
  const typText = `${fmtNum(typ[0], 1)} to ${fmtNum(typ[1], 1)}×`;
  rows.push(`<div class="row where"><span>${resto ? `${ICON.dining}Restaurant price` : `${ICON.cart}Shop price`}</span></div>`);
  const other = a.priceWhere === 'other';
  if (a.price && !other) rows.push(`<div class="row"><span>${resto ? 'Price on the menu' : 'Price on the shelf'}</span><b>${esc(dualPrice(a.price, a.priceCur))}</b></div>`);
  if (o) rows.push(`<div class="row"><span>${other ? `Costs about this in ${abroad ? 'shops abroad' : 'shops'}` : abroad ? 'Reference price abroad' : `Cheapest shop in ${esc(where)}`}</span><b>${esc(tripPrice(o.v, o.cur, tripCur))}</b></div>`);
  let verdict = '';
  const ref = abroad ? 'the reference price abroad' : 'the cheapest shop';
  if (o && a.price && !other) {
    const shop = convTo(o.v, o.cur, a.priceCur);
    if (shop) {
      const f = a.price / shop;
      if (resto) {
        const [label, cls] = f < typ[0] ? ['Good price', 'up'] : f <= typ[1] ? ['Fair price', ''] : ['Expensive', 'down'];
        verdict = `<p class="verdict"><b class="${cls}">${label}</b> for a restaurant</p><p class="small" style="margin:0">Markup <b>${fmtNum(f, 1)}×</b> over ${ref}. Usual in ${esc(where)} for wines at this price: ${typText}.</p>`;
      } else {
        verdict = `<p class="small" style="margin:0"><b class="${f <= 1.05 ? 'up' : f > 1.2 ? 'down' : ''}">${f >= 1 ? `${Math.round((f - 1) * 100)}% above` : `${Math.round((1 - f) * 100)}% below`}</b> ${ref}.</p>`;
      }
    }
  } else if (o && resto) {
    // no menu price given: what would be a fair price for it in a restaurant here
    const lo = convTo(o.v * typ[0], o.cur, tripCur), hi = convTo(o.v * typ[1], o.cur, tripCur);
    if (lo && hi) verdict = `<p class="small" style="margin:0">A fair restaurant price here: <b>${esc(tripCur)} ${fmtNum(Math.round(lo), 0)} to ${fmtNum(Math.round(hi), 0)}</b>, the usual ${typText} of the shop price for wines at this price.</p>`;
  }
  const none = `No online shop in ${esc(where)} sells this wine right now`;
  const note = abroad ? `<p class="tiny muted" style="margin:0">${none}. The reference comes from a shop abroad, converted to ${esc(tripCur)}.</p>`
    : !o ? `<p class="tiny muted" style="margin:0">${none}, and no shop abroad was found either.</p>` : '';
  return `<div class="price-check">${rows.join('')}${verdict}${o ? shopLineHtml(o, tripCur, abroad) : ''}${note}</div>`;
}

/* ------------------------------------------------ 4.5.1: one card for every wine the AI suggests or checks, one advice card on top */

/* the advice of the AI in words, the same card everywhere */
const adviceHtml = (text, extra = '') => (text || extra ? `<div class="adv"><h3>${ICON.magic}My advice</h3>${text ? `<p>${esc(text)}</p>` : ''}${extra}</div>` : '');

/* your match and the drinking window, always together and in this order */
function mwHtml(fit, win) {
  const w = win && (win.drinkFrom || win.drinkUntil) ? winWine(win) : null, ok = w && windowParts(w), s = ok ? statusOf(w) : '';
  const hasFit = fit !== null && fit !== undefined && fit !== '';
  if (!hasFit && !ok) return '';
  return `<div class="mw">${hasFit ? `<div><div class="mw-h"><span>Your match</span><b>${Number(fit)}%</b></div>${segsHtml(Number(fit), 10)}</div>` : ''}
    ${ok ? `<div><div class="mw-h"><span>Drinking window</span><b style="color:${STATUS[s].c}">${esc(s)}</b></div>${timelineHtml(w, true)}${timelineScaleHtml(w)}<p class="mw-t">${esc(windowText(w))}</p></div>` : ''}</div>`;
}
/* the window of a wine in the app, as the four years */
const winOf = w => (w ? { drinkFrom: w.drinkFrom, peakFrom: w.peakFrom, peakUntil: w.peakUntil, drinkUntil: w.drinkUntil } : null);

/* the food: a verdict for what you eat, a sentence, or two dishes */
function foodBlockHtml({ pairing, food, dishes, note, resto }) {
  if (pairing && PAIR[pairing.verdict]) {
    const [label] = PAIR[pairing.verdict];
    return `<div class="somm-food">${ICON.dining}<div><p class="verdict"><b>${label}</b></p>${food ? `<p class="tiny muted" style="margin:0">${esc(food)}</p>` : ''}${pairing.why ? `<p class="small" style="margin:0">${esc(pairing.why)}</p>` : ''}</div></div>`;
  }
  if (note) return `<div class="somm-food">${ICON.dining}<div><p class="verdict"><b>With your food</b></p><p class="small" style="margin:0">${esc(note)}</p></div></div>`;
  if (dishes && dishes.length) return `<div class="somm-food">${ICON.dining}<div><p class="verdict"><b>${resto ? 'Goes well with' : 'Cook with it'}</b></p><p class="small" style="margin:0">${dishes.map(esc).join(' · ')}</p></div></div>`;
  return '';
}

/* the prices: in shops, what is fair in a restaurant with the usual markup, and the price you saw
   shop: { v, cur } in shops; tripCur: the currency of the country; typical: [lo, hi]; seen: { v, cur, resto } the price on the list, the menu or the shelf */
function priceBlockHtml({ shop, abroad, tripCur, typical, seen, country, offer }) {
  const rows = [], where = SHOP_COUNTRIES[country] || country || 'this country';
  const typ = typical && typical[0] ? typical : null;
  if (shop) rows.push(`<div class="row"><span>${abroad ? 'Shop abroad' : 'Shop price'}</span><b>${esc(tripPrice(shop.v, shop.cur, tripCur))}</b></div>`);
  if (shop && typ) {
    const lo = convTo(shop.v * typ[0], shop.cur, tripCur), hi = convTo(shop.v * typ[1], shop.cur, tripCur);
    if (lo && hi) rows.push(`<div class="row"><span>Fair in a restaurant<small>usual markup ${fmtNum(typ[0], 1)} to ${fmtNum(typ[1], 1)}×</small></span><b>${esc(tripCur)} ${fmtNum(Math.round(lo), 0)} to ${fmtNum(Math.round(hi), 0)}</b></div>`);
  }
  if (seen && seen.v) {
    const base = shop ? convTo(shop.v, shop.cur, seen.cur) : null, f = base ? seen.v / base : null;
    let verdict = '';
    if (f && seen.resto) {
      const [label, cls] = !typ ? ['', ''] : f < typ[0] ? ['Good price', 'up'] : f <= typ[1] ? ['Fair price', ''] : ['Expensive', 'down'];
      verdict = `${fmtNum(f, 1)}×${label ? ` · <b class="${cls}">${label}</b>` : ''}`;
    } else if (f) verdict = `<b class="${f <= 1.05 ? 'up' : f > 1.2 ? 'down' : ''}">${f >= 1 ? `${Math.round((f - 1) * 100)}% above` : `${Math.round((1 - f) * 100)}% below`}</b> the shop`;
    rows.push(`<div class="row"><span>${seen.resto ? 'On the list' : 'Price on the shelf'}</span><b>${esc(seen.cur)} ${fmtNum(seen.v, seen.v % 1 ? 2 : 0)}</b></div>${verdict ? `<p class="pc-verdict">${verdict}</p>` : ''}`);
  }
  if (!rows.length) return `<div class="price-check"><p class="tiny muted" style="margin:0">No online shop in ${esc(where)} or abroad sells this wine right now.</p></div>`;
  return `<div class="price-check">${rows.join('')}${offer ? shopLineHtml(offer, tripCur, abroad) : ''}${abroad ? `<p class="tiny muted" style="margin:0">No online shop in ${esc(where)} sells this wine. The price comes from a shop abroad.</p>` : ''}</div>`;
}

/* one wine: badges, name, origin, then match and window, food, prices, why, and what you can do */
function aiCardHtml({ badges = '', corner = '', title, sub = '', thumb = '', href = '', fit, win, food = '', price = '', why = '', value = '', extra = '', actions = '' }) {
  const head = `<div class="ai-head">${thumb}<div class="ai-name"><p class="cons-title">${esc(title)}</p>${sub ? `<p class="small muted" style="margin:2px 0 0">${sub}</p>` : ''}</div>${href ? ICON.chevron : ''}</div>`;
  return `<div class="cons-card ai-card">
    ${badges || corner ? `<div class="between" style="gap:8px;align-items:flex-start"><span style="display:flex;gap:6px;flex-wrap:wrap">${badges}</span>${corner}</div>` : ''}
    ${href ? `<a class="ai-link" href="${href}">${head}</a>` : head}
    ${mwHtml(fit, win)}${food}${price}
    ${why ? `<p class="small" style="margin:0">${esc(why)}</p>` : ''}
    ${value ? `<p class="small cons-value" style="margin:0">${ICON.cash}<span>${esc(value)}</span></p>` : ''}
    ${extra}${actions}
  </div>`;
}

function sommAnswerHtml(t) {
  const check = t.mode === 'check';
  if (t.error) return `<div class="somm-a error"><p>${esc(t.error)}</p><button class="link-btn" data-act="somm-retry">${ICON.refresh}Try again</button></div>`;
  if (!t.a) return `<div class="somm-a"><p class="somm-wait">${check ? 'Looking at this wine' : 'Looking through your cellar'}<span>.</span><span>.</span><span>.</span></p></div>`;
  // not sure which wine: up to three to choose from, one tap checks it
  if (check && !t.a.wine && (t.a.candidates || []).length) return `<div class="somm-a"><p>Which wine do you mean?</p><div class="somm-cands">${t.a.candidates.map(c => `<button class="btn accent block somm-cand" data-act="somm-cand" data-v="${esc(c.wine)}"><b>${esc(c.wine)}</b>${c.region ? `<span class="tiny muted">${esc(c.region)}</span>` : ''}</button>`).join('')}</div><p class="tiny muted" style="margin:0">None of them? Ask again with the producer, or take a photo.</p></div>`;
  const i = sommThread().indexOf(t);
  // a wine from your cellar: the same card as every suggestion, with Take a bottle
  const cellarCard = (p, sim) => {
    const w = wineById(p.id);
    if (!w) return '';
    const where = w.stock.map(e => placeLabel(e)).join(' · ');
    return aiCardHtml({ title: `${wineTitle(w)} ${w.vintage}`.trim(), thumb: thumbHtml(w, true), href: `#/wine/${encodeURIComponent(w.id)}`,
      sub: `${flagOf(w)}${esc(w.producer)}${w.count ? ` · ${w.count} btl` : ''}${where && !sim ? `<br>${esc(where)}` : ''}`,
      fit: p.fit, win: winOf(w), why: p.why,
      actions: w.count && !sim ? `<button class="somm-take" data-act="minus" data-id="${esc(w.id)}">${ICON.minus}Take a bottle</button>` : '' });
  };
  if (!check) {
    const picks = (t.a.picks || []).map(p => cellarCard(p, false)).join('');
    return `<div class="somm-a ai-res">${adviceHtml(t.a.answer)}${picks}${t.a.buy ? `<div class="somm-buy">${ICON.cart}<span><b>To buy</b><br>${esc(t.a.buy)}</span></div>` : ''}</div>`;
  }
  // a wine you check: its card first, then what is similar in your cellar
  const a = t.a, x = a.info || {}, o = a.offer || a.worldOffer, abroad = !a.offer && !!a.worldOffer;
  const tripCur = a.country ? countryCur(a.country) : cur();
  const resto = a.priceWhere === 'restaurant';
  const win = a.window || (x.drinkFrom ? x : null);
  const card = a.wine ? aiCardHtml({
    title: a.wine, sub: `${x.region ? `${countryOf(x) ? flagOf(x) : ''}${esc([x.region, x.type, x.grapes].filter(Boolean).join(' · '))}` : ''}`,
    fit: a.fit, win,
    food: foodBlockHtml({ pairing: a.pairing, food: a.food, dishes: a.dishes, resto }),
    price: a.country ? priceBlockHtml({ shop: o ? { v: o.v, cur: o.cur } : null, abroad, tripCur, typical: a.typical || [2, 3], seen: a.price && a.priceWhere !== 'other' ? { v: a.price, cur: a.priceCur || tripCur, resto } : null, country: a.country, offer: o }) : '',
    extra: (win ? '' : vintageAskHtml(t, i)) + (a.drinkNote && win ? `<p class="small" style="margin:0">${esc(a.drinkNote)}</p>` : ''),
    actions: i >= 0 ? sgActionsHtml('check:' + i) : '' }) : '';
  const sims = (a.picks || []).map(p => cellarCard(p, true)).join('');
  return `<div class="somm-a ai-res">${adviceHtml(a.answer)}${card}${sims ? `<h3 class="ai-sub">Similar wines in your cellar</h3>${sims}` : ''}</div>`;
}

/* the drinking window of a wine you check, from the same AI answer: timeline, status and a word for today */
const winWine = x => normWine({ id: 'window', drinkFrom: x.drinkFrom, peakFrom: x.peakFrom, peakUntil: x.peakUntil, drinkUntil: x.drinkUntil, stock: '[]' });
function checkWindowHtml(a) {
  const x = a.window || (a.info && a.info.drinkFrom ? a.info : null);
  if (!x) return '';
  const w = winWine(x), p = windowParts(w);
  if (!p) return '';
  const s = statusOf(w);
  return `<div class="somm-win"><div class="between"><b>Drinking window</b><span class="small" style="color:${STATUS[s].c};font-weight:600">${esc(s)}</span></div>
    ${timelineHtml(w, true)}${timelineScaleHtml(w)}
    <p class="tiny muted" style="margin:0">${esc(windowText(w))}</p>${a.drinkNote ? `<p class="small" style="margin:2px 0 0;line-height:1.45">${esc(a.drinkNote)}</p>` : ''}</div>`;
}

/* no vintage on the label: ask for it, then the drinking window of that vintage */
function vintageAskHtml(t, i) {
  const a = t.a, x = a && a.info;
  if (!x || !(str(x.producer).trim() || str(x.name).trim()) || str(x.vintage).trim() || i < 0) return '';
  const v = t.vin || {};
  return `<div class="somm-win"><b>Drinking window</b>
    <p class="small" style="margin:0;line-height:1.45">The vintage is not visible on the photo. Which year is it? Then you see its drinking window.</p>
    <div class="vin-ask"><input id="somm-vin-${i}" data-input="somm-vin" data-i="${i}" inputmode="numeric" maxlength="4" placeholder="Vintage, e.g. 2018" value="${esc(v.draft || '')}"${v.busy ? ' disabled' : ''}>
    <button class="btn primary" data-act="somm-vintage" data-i="${i}"${v.busy ? ' disabled' : ''}>${v.busy ? 'Loading…' : 'Show'}</button></div>
    ${v.error ? `<p class="small" style="margin:0;color:var(--danger)">${esc(v.error)}</p>` : ''}</div>`;
}
async function sommVintage(i) {
  const t = sommThread()[i];
  if (!t || !t.a || !t.a.info) return;
  t.vin = t.vin || {};
  const el = $('#somm-vin-' + i), y = Number(str(el ? el.value : t.vin.draft).trim()), now = new Date().getFullYear();
  if (!(y >= 1900 && y <= now)) { t.vin.error = `Enter a year between 1900 and ${now}.`; render(); return; }
  Object.assign(t.vin, { draft: String(y), busy: true, error: '' }); render();
  const base = Object.assign({}, t.a.info, { vintage: String(y) });
  try {
    const d = (previewOf(base) ? { details: previewOf(base) } : await api('preview', { wine: { producer: base.producer, name: base.name, vintage: base.vintage, type: base.type, region: base.region, grapes: base.grapes } }));
    const x = d.details || {};
    prevRemember(base, x);
    const f = Number(x.drinkFrom), u = Number(x.drinkUntil);
    if (f && u && u >= f) {
      const pf = Number(x.peakFrom) >= f && Number(x.peakFrom) <= u ? Number(x.peakFrom) : f, pu = Number(x.peakUntil) >= pf && Number(x.peakUntil) <= u ? Number(x.peakUntil) : u;
      t.a.window = { drinkFrom: f, peakFrom: pf, peakUntil: pu, drinkUntil: u };
      Object.assign(t.a.info, t.a.window, { vintage: String(y) });
      t.a.wine = `${str(t.a.wine).replace(/\s*\([^)]*vintage[^)]*\)/i, '').trim()} ${y}`;
      t.vin = null;
    } else Object.assign(t.vin, { busy: false, error: `No drinking window is known for ${y}. Check the year on the back label or the capsule.` });
  } catch (e) {
    Object.assign(t.vin, { busy: false, error: aiErr(e.message) });
  }
  sommSave(); render();
}

/* ------------------------------------------------ the three steps before the first question: one decision per screen */
const wzOn = () => (SOMM.mode === 'list' ? WL.edit || (!WL.result && !WL.busy && !WL.error) : !sommThread().length);
const wzStep = () => SOMM.step[SOMM.mode] || 1;
const occIcon = k => (k === 'aperitif' ? FOODS.aperitif[1] : ICON[k]);

/* all kinds of food in groups, several at once or none */
function wzFoodHtml() {
  const on = sommFoods();
  return `<div class="wz-foods">${FOOD_GROUPS.map(([h, ks]) => `<h3 class="gd-h">${esc(h)}</h3><div class="tp-foods cf-foods">${ks.map(k => `<button class="tp-food${on.includes(k) ? ' on' : ''}" data-act="cf-food" data-v="${k}" aria-pressed="${on.includes(k)}">${FOODS[k][1]}<span>${esc(FOODS[k][0])}</span></button>`).join('')}</div>`).join('')}</div>`;
}
/* what was chosen in the steps before, as small chips above the last field */
function wzChipsHtml() {
  const c = [], chip = (ic, t) => `<span class="wz-chip">${ic}${esc(t)}</span>`;
  if (SOMM.mode === 'cellar') {
    const o = OCCASIONS.find(x => x[0] === SOMM.occ);
    const ppl = SOMM.pplSet ? `${SOMM.people} ${SOMM.people === 1 ? 'person' : 'people'}` : '';
    if (o || ppl) c.push(chip(o ? occIcon(o[1]) : ICON.heart, [o ? o[0] : '', ppl].filter(Boolean).join(' · ')));
  }
  if (SOMM.mode === 'check') c.push(SOMM.photo ? `<span class="wz-chip"><img src="${esc(SOMM.photo.thumb)}" alt="">${SOMM.photo.mark ? 'Marked wine' : 'Photo'}</span>` : chip(ICON.camera, 'No photo'));
  if (SOMM.mode === 'list') c.push(`<span class="wz-chip"><img src="${esc(WL.pages[0] ? WL.pages[0].thumb : '')}" alt="">${WL.pages.length} ${WL.pages.length === 1 ? 'page' : 'pages'}</span>`);
  const f = sommFoods();
  if (f.length) f.forEach(k => c.push(chip(FOODS[k][1], FOODS[k][0])));
  else if (SOMM.mode !== 'cellar') c.push(chip(ICON.dining, 'No food'));
  return c.length ? `<div class="wz-sum">${c.join('')}</div>` : '';
}
const wzAskHtml = () => `<div class="somm-input cf-input${SOMM.listening ? ' listening' : ''}">
      <textarea id="somm-text" data-input="somm-text" rows="4" placeholder="${esc(sommPlaceholder())}" aria-label="Your question">${esc(SOMM.draft)}</textarea>
      ${voiceLangHtml()}<button class="somm-mic${SOMM.listening ? ' on' : ''}" data-act="somm-mic" aria-label="${SOMM.listening ? 'Stop listening' : 'Speak'}">${ICON.mic}</button></div>
    <p id="somm-hint" class="tiny muted somm-hint" style="margin:0">${sommHint()}</p>`;
/* Will I like it? without a photo needs the name of the wine */
const wzCanGo = () => SOMM.mode !== 'check' || !!SOMM.photo || !!str(SOMM.draft).trim();
function wzGoRefresh() {
  const b = $('#wz-go'), n = $('#wz-cost');
  if (b) b.disabled = SOMM.busy || !wzCanGo();
  if (n && SOMM.mode === 'check') n.textContent = wzCanGo() ? 'About 5 cents. I look the wine up and tell you how it fits you.' : 'Enter the name of a wine first.';
}

/* the photo of a label or a wine list, with the wine marked by finger like with a highlighter */
function markPhotoHtml() {
  const ph = SOMM.photo, m = ph.mark;
  return `<div class="mk-photo" id="mk-photo"><img src="${esc(ph.src || ph.thumb)}" alt="Photo of the wine" draggable="false">
      ${m ? `<div class="mk-band" style="top:${(m.y0 * 100).toFixed(2)}%;height:${((m.y1 - m.y0) * 100).toFixed(2)}%"><span class="mk-tag">This one</span></div>` : ''}</div>
    <div class="between"><label class="link-btn">${ICON.camera}Retake<input type="file" accept="image/*" capture="environment" data-change="somm-photo" hidden></label>${m ? '<button class="link-btn" data-act="mk-clear">Clear the mark</button>' : ''}</div>`;
}

function wzBody() {
  const m = SOMM.mode, n = wzStep();
  const next = (dis) => `<button class="btn primary big block" data-act="wz-next"${dis ? ' disabled' : ''}>Next</button>`;
  if (n === 2) return ['What are you eating?', 'Tap all that apply, or just tap Next.', wzFoodHtml(), next()];
  if (m === 'cellar') {
    if (n === 1) return ['What is the occasion?', 'I pick from the wines in your cellar.',
      `<div class="tp-foods wz-occ">${OCCASIONS.map(([t, ic]) => `<button class="tp-food${SOMM.occ === t ? ' on' : ''}" data-act="wz-occ" data-v="${esc(t)}" aria-pressed="${SOMM.occ === t}">${occIcon(ic)}<span>${esc(t)}</span></button>`).join('')}</div>
      <div class="wz-ppl"><span><b>How many people?</b><small>For how many bottles to open</small></span><div class="stepper"><button data-act="wz-ppl" data-v="-1" aria-label="Fewer"${SOMM.people <= 1 ? ' disabled' : ''}>${ICON.minus}</button><span id="wz-ppl-n">${SOMM.people}</span><button data-act="wz-ppl" data-v="1" aria-label="More"${SOMM.people >= 30 ? ' disabled' : ''}>${ICON.plus}</button></div></div>`, next()];
    return ['Anything else?', 'Optional. Say it or type it.', wzChipsHtml() + wzAskHtml(),
      `<button class="btn primary big block" id="wz-go" data-act="wz-go"${SOMM.busy ? ' disabled' : ''}>${ICON.magic}Find my wine</button><p class="wz-cost">A few cents per question.</p>`];
  }
  if (m === 'check') {
    if (n === 1) return SOMM.photo
      ? ['Which wine?', 'Mark the wine with your finger. For a label just tap Next.', markPhotoHtml() + countryBtnHtml('Prices for'), next()]
      : ['Which wine?', 'A label in the shop or one wine on the wine list.',
        `<div class="wz-drop"><span class="ic">${ICON.camera}</span>Take a photo of the label, or of one wine on the wine list.</div>
        <div class="grid2"><label class="btn primary">${ICON.camera}Take a photo<input type="file" accept="image/*" capture="environment" data-change="somm-photo" hidden></label><label class="btn">Gallery<input type="file" accept="image/*" data-change="somm-photo" hidden></label></div>
        ${countryBtnHtml('Prices for')}`, next()];
    const ph = !!SOMM.photo;
    return [ph ? 'Anything else?' : 'Which wine?', ph ? 'Optional. Say it or type it.' : 'Say or type the name. Add anything else you want to know.', wzChipsHtml() + wzAskHtml(),
      `<button class="btn primary big block" id="wz-go" data-act="wz-go"${SOMM.busy || !wzCanGo() ? ' disabled' : ''}>${ICON.magic}Check the wine</button><p class="wz-cost" id="wz-cost">${wzCanGo() ? 'About 5 cents. I look the wine up and tell you how it fits you.' : 'Enter the name of a wine first.'}</p>`];
  }
  // wine list
  if (n === 1) {
    const pages = WL.pages.map((pg, i) => `<div class="wl-page"><img src="${esc(pg.thumb)}" alt="Page ${i + 1}"><span>${i + 1}</span><button class="icon-btn" data-act="wl-page-rm" data-i="${i}" aria-label="Remove page ${i + 1}">${ICON.x}</button></div>`).join('');
    const full = WL.pages.length >= 10;
    return ['Photograph the wine list', 'One photo per page, up to ten.',
      `<div class="wl-pages">${pages}${full ? '' : `<label class="wl-page add">${ICON.camera}<span>${WL.pages.length ? 'Add page' : 'First page'}</span><input type="file" accept="image/*" capture="environment" data-change="wl-photo" hidden></label>`}</div>
      ${full ? '' : '<label class="link-btn" style="align-self:flex-start">Choose from gallery<input type="file" accept="image/*" multiple data-change="wl-photo" hidden></label>'}
      ${countryBtnHtml('Restaurant in')}`, next(!WL.pages.length)];
  }
  const c = countryCur(travelCountry());
  return ['Your budget per bottle', `Optional. In ${esc(c)}, as on the list.`,
    `<div class="grid2"><label class="field">From (${esc(c)})<input inputmode="decimal" data-input="wl-min" placeholder="No minimum" value="${esc(WL.min)}"></label><label class="field">to (${esc(c)})<input inputmode="decimal" data-input="wl-max" placeholder="No limit" value="${esc(WL.max)}"></label></div>
    ${wzAskHtml()}${wzChipsHtml()}`,
    `<button class="btn primary big block" id="wz-go" data-act="wz-go"${WL.busy || !WL.pages.length ? ' disabled' : ''}>${ICON.magic}Find the best wines</button><p class="wz-cost">About 10 to 20 cents, takes up to a minute.</p>`];
}

function viewWizard() {
  const n = wzStep(), [title, lead, body, foot] = wzBody();
  const modeBtn = (m, ic, label) => `<button class="${SOMM.mode === m ? 'on' : ''}" data-act="somm-mode" data-v="${m}">${ic}${label}</button>`;
  const old = S.version && S.version < (SOMM.mode === 'cellar' ? 14 : 17);
  return `<main class="screen somm wz">
    <div class="detail-top tq-top">${n === 1 ? backLinkHtml('#/home', 'Home') : `<button class="back" data-act="wz-back">${ICON.back}Back</button>`}
      <div class="tq-dots" aria-label="Step ${n} of 3">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div></div>
    ${n === 1 ? `<div class="toggle somm-modes three">${modeBtn('cellar', ICON.glass, 'My cellar')}${modeBtn('check', ICON.camera, 'Will I like it?')}${modeBtn('list', ICON.dining, 'Wine list')}</div>` : ''}
    ${old ? '<div class="card notice"><b>Script update needed</b><p class="small" style="margin:4px 0 0">The sommelier needs the new Code.gs. Replace the script code and create a new version under Manage deployments.</p></div>' : ''}
    <p class="tq-step">Step ${n} of 3</p><h1 class="title tq-title">${title}</h1><p class="wz-lead">${lead}</p>
    ${body}
    <div class="wz-foot">${foot}</div>
  </main>`;
}

/* the question for a wine from the cellar, from the occasion, the people and the food */
function cellarQuestion() {
  const t = str(SOMM.draft).trim(), f = sommFoods().map(k => FOODS[k][0].toLowerCase());
  const head = [SOMM.occ ? SOMM.occ.replace('As a gift', 'A wine to give as a gift').replace('Just a glass', 'Just a glass of wine') : '', SOMM.pplSet ? `for ${SOMM.people} ${SOMM.people === 1 ? 'person' : 'people'}` : '', f.length ? `with ${f.join(', ')}` : ''].filter(Boolean).join(' ');
  return [head ? head.charAt(0).toUpperCase() + head.slice(1) + '.' : '', t].filter(Boolean).join(' ') || 'Which wine should I open?';
}
/* the photo with the marked wine burnt in, so the AI sees which line is meant */
async function markedPhoto(ph) {
  if (!ph.mark) return ph;
  const img = new Image();
  img.src = ph.src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d'), y = ph.mark.y0 * c.height, h = (ph.mark.y1 - ph.mark.y0) * c.height, lw = Math.max(3, c.width * 0.006);
  g.drawImage(img, 0, 0);
  g.fillStyle = 'rgba(255, 214, 0, 0.28)'; g.fillRect(0, y, c.width, h);
  g.strokeStyle = '#FFD400'; g.lineWidth = lw; g.strokeRect(lw / 2, y, c.width - lw, h);
  return { b64: c.toDataURL('image/jpeg', 0.82).split(',')[1], thumb: toJpeg(c, 240, 0.7), marked: true };
}
async function wzGo() {
  if (SOMM.listening) sommStopVoice();
  const ta = $('#somm-text');
  if (ta) SOMM.draft = ta.value;
  if (SOMM.mode === 'list') { listAnalyze(); return; }
  if (SOMM.mode === 'cellar') { const q = cellarQuestion(); SOMM.draft = ''; sommAsk(q); return; }
  if (!wzCanGo()) return;
  let img = null;
  try { img = SOMM.photo ? await markedPhoto(SOMM.photo) : null; } catch (e) { img = SOMM.photo; }
  sommAsk(SOMM.draft, img, '', img && img.marked ? '\n(On the photo the wine to check is marked with a yellow box. Check only that wine.)' : '');
}
/* the finger on the photo: drag over the line of the wine, or tap it */
const MK = { y: null };
function mkY(e) { const r = $('#mk-photo').getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)); }
function mkSet(a, b) {
  let y0 = Math.min(a, b), y1 = Math.max(a, b);
  if (y1 - y0 < 0.07) { const c = (y0 + y1) / 2; y0 = Math.max(0, c - 0.035); y1 = Math.min(1, c + 0.035); }
  SOMM.photo.mark = { y0, y1 };
  const box = $('#mk-photo');
  let band = box.querySelector('.mk-band');
  if (!band) { box.insertAdjacentHTML('beforeend', '<div class="mk-band"><span class="mk-tag">This one</span></div>'); band = box.querySelector('.mk-band'); }
  band.style.top = (y0 * 100).toFixed(2) + '%'; band.style.height = ((y1 - y0) * 100).toFixed(2) + '%';
}
document.addEventListener('pointerdown', e => { if (SOMM.photo && e.target.closest && e.target.closest('#mk-photo')) { MK.y = mkY(e); mkSet(MK.y, MK.y); e.preventDefault(); } });
document.addEventListener('pointermove', e => { if (MK.y !== null && $('#mk-photo')) mkSet(MK.y, mkY(e)); });
document.addEventListener('pointerup', () => { if (MK.y !== null) { MK.y = null; render(); } });

function sommThreadHtml() {
  if (SOMM.mode === 'list') return listHtml();
  const th = sommThread();
  return (SOMM.tips ? sommGuideHtml() : '') + th.map(t => `<div class="somm-q">${t.photo ? `<img class="somm-q-photo" src="${esc(t.photo)}" alt="Label photo">` : ''}${t.q ? esc(t.q) : ''}</div>${sommAnswerHtml(t)}`).join('');
}

const sommTopHtml = () => `${backLinkHtml('#/home', 'Home')}${SOMM.mode === 'list' ? (WL.pages.length || WL.result ? `<button class="btn ghost" style="height:40px" data-act="wl-clear">New wine list</button>` : '') : sommThread().length ? `<div style="display:flex;gap:6px"><button class="btn ghost" style="height:40px" data-act="somm-tips">${SOMM.tips ? 'Hide tips' : 'Tips'}</button><button class="btn ghost" style="height:40px" data-act="somm-clear">${SOMM.mode === 'check' ? 'New wine' : 'New question'}</button></div>` : ''}`;
function sommPlaceholder() {
  if (SOMM.listening) return 'Listening…';
  if (SOMM.mode === 'list') return 'Anything else? For example a red, not too heavy';
  if (SOMM.mode === 'cellar') return sommThread().length ? 'Ask a follow-up, for example something lighter?' : 'For example: something light, or not my best bottles';
  if (sommThread().length) return 'Ask a follow-up, for example is the 2019 better?';
  if (!SOMM.photo) return 'For example: Gantenbein Pinot Noir 2020';
  const f = sommFoods();
  return `For example: ${f.length ? FOOD_HINT[f[0]] || 'what exactly you eat' : 'is it ready to drink?'}`;
}

function viewSommelier() {
  const r = route();
  SOMM.mode = r.id === 'check' || r.id === 'list' ? r.id : 'cellar';
  if (wzOn()) return viewWizard();
  const check = SOMM.mode === 'check', list = SOMM.mode === 'list';
  const modeBtn = (m, ic, label) => `<button class="${SOMM.mode === m ? 'on' : ''}" data-act="somm-mode" data-v="${m}">${ic}${label}</button>`;
  return `<main class="screen somm">
    <div class="detail-top" id="somm-top">${sommTopHtml()}</div>
    <header><h1 class="title somm-title"><span class="magic-ic">${ICON.magic}</span>Sommelier</h1></header>
    <div class="toggle somm-modes three">${modeBtn('cellar', ICON.glass, 'My cellar')}${modeBtn('check', ICON.camera, 'Will I like it?')}${modeBtn('list', ICON.dining, 'Wine list')}</div>
    ${check ? whereRowHtml() : ''}
    <div id="somm-thread" class="somm-thread">${sommThreadHtml()}</div>
  </main>
  ${list ? '' : `<div class="somm-bar${check ? ' check' : ''}">
    <div class="somm-input${SOMM.listening ? ' listening' : ''}">
      <textarea id="somm-text" data-input="somm-text" rows="1" placeholder="${sommPlaceholder()}" aria-label="Your question">${esc(SOMM.draft)}</textarea>
      ${voiceLangHtml()}<button class="somm-mic${SOMM.listening ? ' on' : ''}" data-act="somm-mic" aria-label="${SOMM.listening ? 'Stop listening' : 'Speak'}">${ICON.mic}</button>
      <button class="somm-send" data-act="somm-send" aria-label="Send"${SOMM.busy ? ' disabled' : ''}>${ICON.send}</button>
    </div>
    <p id="somm-hint" class="tiny muted somm-hint">${sommHint()}</p>
  </div>`}`;
}

function sommRefresh(scroll) {
  // in the steps: the screens without a text field are drawn again, the field keeps its focus
  if (location.hash.startsWith('#/sommelier') && wzOn() && !$('#somm-text')) { render(); return; }
  wzGoRefresh();
  const th = $('#somm-thread');
  if (th) th.innerHTML = sommThreadHtml();
  const top = $('#somm-top');
  if (top) top.innerHTML = sommTopHtml();
  const ta = $('#somm-text');
  if (ta && ta.value !== SOMM.draft) { ta.value = SOMM.draft; autosize(ta); }
  const send = $('.somm-send');
  if (send) send.disabled = SOMM.busy || (SOMM.mode === 'list' && (WL.busy || !WL.pages.length));
  const hint = $('#somm-hint');
  if (hint) hint.textContent = sommHint();
  const box = $('.somm-input');
  if (box) box.classList.toggle('listening', SOMM.listening);
  const mic = $('.somm-mic');
  if (mic) { mic.classList.toggle('on', SOMM.listening); mic.setAttribute('aria-label', SOMM.listening ? 'Stop listening' : 'Speak'); }
  if (ta) ta.placeholder = sommPlaceholder();
  if (scroll) window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

const sommHint = () => (SOMM.listening ? 'Listening. Take your time, tap stop when you are done.' : SOMM.voiced ? (wzOn() ? 'Check the text and correct it if needed.' : 'Check the text and correct it if needed, then tap send.') : '');

/* is the whole list expensive for this country? its average markup against the usual one */
function listLevelHtml(res) {
  if (!res.avgMarkup) return '';
  const typ = res.typical, land = SHOP_COUNTRIES[res.country] || 'this country';
  if (!typ) return `<p class="small" style="margin:0">Average markup of this list about <b>${fmtNum(res.avgMarkup, 1)}×</b> the shop price.</p>`;
  const f = res.avgMarkup, [label, cls] = f < typ[0] ? ['Good prices', 'up'] : f <= typ[1] ? ['Fair prices', ''] : ['Expensive list', 'down'];
  return `<div class="price-check"><p class="verdict"><b class="${cls}">${label}</b> for ${esc(land)}</p><p class="small" style="margin:0">This list about <b>${fmtNum(f, 1)}×</b> the shop price, usual for restaurants in ${esc(land)} at these prices: ${fmtNum(typ[0], 1)} to ${fmtNum(typ[1], 1)}×. ${res.picks.some(p => p.typical) ? 'Each pick below shows what is usual for a wine at its price.' : 'The markup of each pick below is compared with this list.'}</p></div>`;
}
/* the drinking window of a pick as a small badge: Peak, Ready, Too young and so on */
function wlStatus(p) {
  if (!p.window) return '';
  const w = winWine(p.window);
  if (!windowParts(w)) return '';
  const s = statusOf(w);
  return `<span class="win-chip" style="--sc:${STATUS[s].c}" title="${esc(windowText(w))}">${esc(s)}</span>`;
}
function listPickHtml(p, i, cur0) {
  const [label, cls] = WL_KIND[p.kind] || ['Pick', 'disc'];
  const o = p.offer || p.worldOffer, abroad = !p.offer && !!p.worldOffer;
  // the shop price: a real offer, else the estimate of the AI in the currency of the list
  const shop = o ? { v: o.v, cur: o.cur } : p.shopPrice ? { v: p.shopPrice, cur: cur0 } : null;
  const typ = p.typical || WL.result.typical;
  return aiCardHtml({
    badges: `<span class="cons-label ${cls}">${esc(label)}</span>`, corner: p.page ? `<span class="small muted">page ${p.page}</span>` : '',
    title: wishTitle(p), sub: `${countryOf(p) ? flagOf(p) : ''}${esc([p.region, p.type, p.grapes].filter(Boolean).join(' · '))}`,
    fit: p.fit, win: p.window,
    food: foodBlockHtml({ note: p.food }),
    price: priceBlockHtml({ shop, abroad, tripCur: cur0, typical: typ, seen: p.listPrice ? { v: p.listPrice, cur: cur0, resto: true } : null, country: WL.result.country, offer: o })
      + (!o ? `<p class="tiny muted" style="margin:-4px 0 0">No online shop found. The shop price is an AI estimate.</p>` : ''),
    why: p.why, actions: sgActionsHtml('wl:' + i)
  });
}

function listHtml() {
  const res = WL.result;
  const cur0 = res && res.currency ? res.currency : cur();
  if (WL.busy) return `<div class="somm-a wl-wait" id="wl-wait"><p class="somm-wait">Reading ${WL.pages.length} ${WL.pages.length === 1 ? 'page' : 'pages'}, comparing the wines and checking shop prices<span>.</span><span>.</span><span>.</span></p><p class="tiny muted" style="margin:0">This takes up to a minute. Keep the app open.</p></div>`;
  const again = '<button class="btn outline-gold big block" data-act="wz-edit">Change and analyze again</button>';
  if (WL.error) return `<div class="somm-a error"><p>${esc(WL.error)}</p></div>${again}`;
  if (!res) return '';
  return `<div class="wl-country">${countryBtnHtml('Restaurant in')}${redoHtml('list')}</div>
    <div class="wl-result ai-res">
      ${adviceHtml(res.note, `${listLevelHtml(res)}<p class="tiny muted" style="margin:0">${res.restaurant ? `${esc(res.restaurant)} · ` : ''}${res.count ? `${res.count} wines read from ${res.pages} ${res.pages === 1 ? 'page' : 'pages'}` : `${res.pages} ${res.pages === 1 ? 'page' : 'pages'} read`}${res.food ? ` · ${esc(res.food)}` : ''}</p>`)}
      <div class="ai-head-row"><h2>The best ${res.picks.length} for you</h2></div>
      ${res.picks.map((p, i) => listPickHtml(p, i, cur0)).join('')}
      <p class="tiny muted" style="margin:0">Quality and the average markup are AI estimates.</p></div>
    ${again}`;
}

async function listAnalyze(foodAgain) {
  if (WL.busy || !WL.pages.length) { if (!WL.pages.length) toast('Take a photo of at least one page first.'); return; }
  // pages kept from an earlier session are only previews: a new analysis needs the photos again
  if (WL.pages.some(pg => !pg.b64)) { WL.pages = WL.pages.filter(pg => pg.b64); SOMM.step.list = 1; WL.edit = true; toast('Take the photos of the wine list again for a new analysis.'); render(); return; }
  if (SOMM.listening) sommStopVoice();
  const ta = $('#somm-text');
  // the food from the tiles and the wishes from the field
  const food = foodAgain !== undefined ? str(foodAgain).trim() : [sommFoodText(), str(ta ? ta.value : SOMM.draft).trim()].filter(Boolean).join('. ');
  SOMM.redo = '';
  WL.edit = false;
  WL.busy = true;
  WL.error = '';
  WL.result = null;
  SOMM.voiced = false;
  render();
  const w = $('#wl-wait');
  if (w) w.scrollIntoView({ behavior: 'smooth', block: 'center' });
  try {
    WL.result = await api('winelist', { country: travelCountry(), pages: WL.pages.map(pg => pg.b64), min: Number(String(WL.min).replace(',', '.')) || 0, max: Number(String(WL.max).replace(',', '.')) || 0, food });
  } catch (e) {
    WL.error = /Unknown action/i.test(e.message) ? 'The wine list needs the new Code.gs. Update the script, then try again.' : aiErr(e.message);
  }
  WL.busy = false;
  sommSave();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function listAddPhotos(files) {
  for (const file of files) {
    if (WL.pages.length >= 10) { toast('Up to 10 pages at a time.'); break; }
    try {
      const c = await loadPhoto(file);
      WL.pages.push({ b64: toJpeg(c, 1568, 0.82).split(',')[1], thumb: toJpeg(c, 240, 0.7) });
    } catch (e) { toast(e.message); }
  }
  sommRefresh(false);
}

async function listSave(p) {
  const res = WL.result;
  const why = [p.why, p.listPrice ? `On a wine list for ${res.currency || cur()} ${fmtNum(p.listPrice, p.listPrice % 1 ? 2 : 0)}.` : ''].filter(Boolean).join(' ');
  const x = normWish({ id: newId('x'), producer: p.producer, name: p.name, vintage: p.vintage, type: p.type, region: p.region, grapes: p.grapes,
    price: p.shopPrice, priceCur: res.currency || cur(), label: 'Wine list', why, createdAt: new Date().toISOString(), fit: p.fit, details: previewOf(p) });
  x.window = winParse(p.window, previewOf(p));
  S.wishlist.push(x);
  persist();
  sommRefresh(false);
  try {
    await api('saveWish', { wish: Object.assign({}, x, { offer: '', details: x.details ? JSON.stringify(x.details) : '' }) });
    wishSavedToast(x);
  } catch (e) {
    S.wishlist = S.wishlist.filter(w => w.id !== x.id);
    persist();
    sommRefresh(false);
    toast('Not saved: ' + e.message);
  }
}


async function sommAsk(text, photo, picked, note) {
  const q = str(text).trim();
  const img = photo || SOMM.photo;
  if (SOMM.busy) return;
  if (!q && !img) { if (SOMM.mode === 'check') toast('Photograph the wine, or say or type its name.'); return; }
  if (SOMM.listening) sommStopVoice();
  const mode = img ? 'check' : SOMM.mode;
  if (mode !== SOMM.mode) { SOMM.mode = mode; history.replaceState(null, '', '#/sommelier/' + mode); render(); }
  const th = SOMM.threads[mode];
  const history = th.filter(t => t.a).slice(-3).map(t => ({ q: t.q || (t.a.wine ? `Will I like this wine? (label photo of ${t.a.wine})` : 'Will I like this wine?'), a: JSON.stringify(t.a) }));
  const turn = { q, a: null, error: '', photo: img ? img.thumb : '', img, mode, picked: picked || '' };
  th.push(turn);
  SOMM.photo = null;
  SOMM.draft = '';
  SOMM.voiced = false;
  SOMM.busy = true;
  SOMM.tips = false;
  // the first wine of a check: the steps make room for the answer and the field for follow-ups
  if (th.length === 1) { render(); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); } else sommRefresh(true);
  try {
    // shop or restaurant: the sommelier sees it on the photo or in the question
    const where = '';
    const price = null;   // no price field: a price you mention in the question is read by the sommelier
    turn.where = where; turn.price = price;
    if (mode === 'check' && SOMM.redo) { SOMM.redo = ''; const row = $('#where-row'); if (row) row.outerHTML = whereRowHtml(); }
    turn.food = mode === 'check' ? sommFoodText() : '';
    turn.a = await api('sommelier', { question: q + (note || ''), history, image: img ? img.b64 : null, mode, country: mode === 'check' ? travelCountry() : '', where, price, priceCur: price ? countryCur(travelCountry()) : '', food: turn.food, picked: picked || '' });
  } catch (e) {
    turn.error = /Unknown action/i.test(e.message) ? 'The sommelier needs the new Code.gs. Update the script, then try again.' : e.message.replace(/Claude API/g, 'AI service');
  }
  SOMM.busy = false;
  sommSave();
  sommRefresh(true);
}

/* runs the last wine check again for the country now set; the price you entered was on the shelf or the menu there, so it is read in the new currency */
async function sommRedoCheck() {
  const t = lastCheck();
  SOMM.redo = '';
  const row = $('#where-row');
  if (row) row.outerHTML = whereRowHtml();
  if (!t || SOMM.busy) return;
  const c = travelCountry();
  const where = t.where || t.a.priceWhere || sommWhere() || 'other';
  const price = where === 'shop' || where === 'restaurant' ? (t.price || (where === 'shop' && !t.where ? t.a.price : null) || null) : null;
  const q = t.q || (t.img ? '' : `Will I like this wine? ${t.a.wine}`);
  const th = SOMM.threads.check;
  const history = th.slice(0, th.indexOf(t)).filter(x => x.a).slice(-3).map(x => ({ q: x.q || (x.a.wine ? `Will I like this wine? (label photo of ${x.a.wine})` : 'Will I like this wine?'), a: JSON.stringify(x.a) }));
  const old = t.a;
  t.a = null;
  t.error = '';
  SOMM.busy = true;
  sommRefresh(true);
  try {
    t.a = await api('sommelier', { question: q, history, image: t.img ? t.img.b64 : null, mode: 'check', country: c, where, price, priceCur: price ? countryCur(c) : '', food: t.food || (old && old.food) || '' });
    t.where = where; t.price = price;
  } catch (e) {
    t.a = old;
    toast('Not updated: ' + e.message.replace(/Claude API/g, 'AI service'), 5000);
  }
  SOMM.busy = false;
  sommSave();
  sommRefresh(true);
}

/* the conversations, the wine checks and the last wine list stay after closing the app, until you tap New question, New wine or New wine list.
   Photos are kept as small previews only; the full pages of a wine list are needed again only for a new analysis. */
function sommSave() {
  const turns = m => (SOMM.threads[m] || []).filter(t => t.a || t.error).slice(-20).map(t => ({ q: t.q, a: t.a, error: t.error, photo: t.photo || '', mode: t.mode, where: t.where || '', price: t.price || null, food: t.food || '' }));
  const data = { threads: { cellar: turns('cellar'), check: turns('check') }, mode: SOMM.mode, where: SOMM.where, whereAt: SOMM.whereAt, foods: SOMM.foods, foodsAt: SOMM.foodsAt,
    wl: { result: WL.result, min: WL.min, max: WL.max, pages: WL.result ? WL.pages.map(p => ({ thumb: p.thumb })) : [] } };
  try { localStorage.setItem('wc-somm', JSON.stringify(data)); }
  catch (e) {
    // full: keep the answers without the photo previews
    try { data.threads.check.forEach(t => { t.photo = ''; }); data.wl.pages = []; localStorage.setItem('wc-somm', JSON.stringify(data)); } catch (e2) { /* kept for this session */ }
  }
}
function sommLoad() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem('wc-somm') || 'null'); } catch (e) { d = null; }
  if (!d) return;
  ['cellar', 'check'].forEach(m => { if (d.threads && Array.isArray(d.threads[m])) SOMM.threads[m] = d.threads[m]; });
  if (d.where) { SOMM.where = d.where; SOMM.whereAt = Number(d.whereAt) || 0; }
  if (Array.isArray(d.foods)) { SOMM.foods = d.foods.filter(k => FOODS[k]); SOMM.foodsAt = Number(d.foodsAt) || 0; }
  if (d.wl) { WL.result = d.wl.result || null; WL.min = str(d.wl.min); WL.max = str(d.wl.max); WL.pages = Array.isArray(d.wl.pages) ? d.wl.pages : []; }
}

function sommStartVoice() {
  const ta = $('#somm-text');
  if (ta) SOMM.draft = ta.value;
  if (!voiceStart({
    get: () => SOMM.draft,
    set: t => { SOMM.draft = t; SOMM.voiced = true; sommRefresh(false); },
    ui: on => { SOMM.listening = on; sommRefresh(false); if (!on) { const t = $('#somm-text'); if (t && SOMM.draft) t.focus(); } }
  })) { if (ta) ta.focus(); }
}

/* the wishes for the consultant by voice: the text lands in the field, where you can check and correct it before sending */
function consVoiceUi() {
  const b = $('#cons-mic'), h = $('#cons-mic-hint');
  if (b) { b.classList.toggle('on', CONS.listening); b.setAttribute('aria-label', CONS.listening ? 'Stop listening' : 'Speak'); }
  if (h) h.textContent = CONS.listening ? 'Listening. Tap stop when you are done.' : '';
}
function consStopVoice() {
  if (CONS.listening) voiceCancel();
  CONS.listening = false;
  consVoiceUi();
}
function consStartVoice() {
  const ta0 = $('#cons-note');
  if (ta0) CONS.note = ta0.value;
  if (!voiceStart({
    get: () => CONS.note,
    set: t => { CONS.note = t; const ta = $('#cons-note'); if (ta) ta.value = t; },
    ui: on => { CONS.listening = on; consVoiceUi(); if (!on) { const ta = $('#cons-note'); if (ta && CONS.note) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } } }
  })) { if (ta0) ta0.focus(); }
}

function sommStopVoice() {
  if (SOMM.listening) voiceCancel();
  SOMM.listening = false;
}

/* ------------------------------------------------------------ value over time */

const normHistory = h => ({ month: str(h.month).slice(0, 7), bottles: Number(h.bottles) || 0, cost: Number(h.cost) || 0, street: Number(h.street) || 0, cur: str(h.cur) || 'CHF' });
let snapshotBusy = false;
/* once a month, and again when the value changed, the app stores the value of the cellar */
async function snapshotValue() {
  if (snapshotBusy || !S.version || S.version < 13) return;
  const month = todayISO().slice(0, 7);
  const t = totals();
  const bottles = S.wines.reduce((a, w) => a + w.count, 0);
  const snap = { month, bottles, cost: Math.round(t.cost), street: Math.round(t.street), cur: cur() };
  const old = S.history.find(h => h.month === month);
  if (old && old.bottles === snap.bottles && old.cur === snap.cur && Math.round(old.cost) === snap.cost && Math.round(old.street) === snap.street) return;
  snapshotBusy = true;
  try { S.history = (await api('snapshot', { snapshot: snap })).map(normHistory); persist(); } catch (e) { /* tried again at the next start */ }
  snapshotBusy = false;
}

/* bottles in stock at the end of each of the last 12 months, worked out backwards from the journal */
function bottlesByMonth() {
  let stock = S.wines.reduce((a, w) => a + w.count, 0);
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const after = S.removals.filter(r => str(r.date) >= end);
    const net = after.reduce((a, r) => a + (r.dir === 'in' ? 1 : -1) * (Number(r.qty) || 1), 0);
    months.unshift({ label: m.toLocaleDateString('en-US', { month: 'narrow' }), n: Math.max(0, stock - net) });
  }
  return months;
}

/* two lines on one money axis: costs and street value */
function valueChart(hist) {
  const pts = hist.map(h => ({ m: h.month, cost: conv(h.cost, h.cur) || 0, street: conv(h.street, h.cur) || 0 }));
  const W = 340, H = 150, L = 20, R = 20, T = 30, B = 22;
  const max = Math.max(1, ...pts.map(p => Math.max(p.cost, p.street))) * 1.1;
  const x = i => L + (pts.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (pts.length - 1));
  const y = v => T + (H - T - B) * (1 - v / max);
  const line = (k, c) => `${pts.length > 1 ? `<polyline fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" points="${pts.map((p, i) => `${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ')}"/>` : ''}${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p[k]).toFixed(1)}" r="4" fill="${c}" stroke="var(--bg)" stroke-width="2"><title>${esc(p.m)}: ${esc(money(p[k], 0))}</title></circle>`).join('')}`;
  const lab = (i, t) => `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="vc-l">${esc(t)}</text>`;
  const ml = m => { const [yy, mo] = m.split('-').map(Number); return new Date(yy, mo - 1, 1).toLocaleDateString('en-US', { month: 'short' }) + (mo === 1 || pts.length === 1 ? ` ${String(yy).slice(2)}` : ''); };
  const step = Math.max(1, Math.ceil(pts.length / 6));
  return `<svg class="vc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Value of your cellar over time">
    <line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)"/>
    ${line('cost', '#9AA8C2')}${line('street', 'var(--gold)')}
    <text x="${W - R}" y="${(y(pts[pts.length - 1].street) - 10).toFixed(1)}" text-anchor="end" class="vc-v">${esc(money(pts[pts.length - 1].street, 0))}</text>
    ${pts.map((p, i) => (i % step === 0 || i === pts.length - 1 ? lab(i, ml(p.m)) : '')).join('')}</svg>
    <div class="vc-legend"><span><i style="background:var(--gold)"></i>Total Street Value</span><span><i style="background:#9AA8C2"></i>Total Costs</span></div>`;
}

/* ------------------------------------------------------------ AI consultant and wishlist */

function normWish(x) {
  let offer = null;
  try { offer = x.offer ? (typeof x.offer === 'string' ? JSON.parse(x.offer) : x.offer) : null; } catch (e) { offer = null; }
  const o = {
    id: str(x.id), producer: str(x.producer), name: str(x.name), vintage: str(x.vintage), type: str(x.type), region: str(x.region), grapes: str(x.grapes),
    price: numOrNull(x.price), priceCur: str(x.priceCur) || cur(), label: str(x.label), why: str(x.why), value: str(x.value),
    qty: numOrNull(x.qty), replaces: str(x.replaces), offer: offer && offer.shop ? offer : null, createdAt: str(x.createdAt),
    fit: numOrNull(x.fit), details: (() => { try { return x.details ? (typeof x.details === 'string' ? JSON.parse(x.details) : x.details) : null; } catch (e) { return null; } })(),
    recBy: str(x.recBy), window: null
  };
  o.window = winParse(x.window, o.details);
  return o;
}
const wishTitle = x => [x.producer, x.name, x.vintage].filter(Boolean).join(' ');
const wishKey = x => lc([x.producer, x.name].join('|'));

const CONS = { focus: '', budget: null, note: '', listening: false, rec: null, busy: false, result: null, error: '', offers: {}, offerRun: new Set() };
(() => { const c = store.get('wc-consult', null); if (c && c.result) { CONS.result = c.result; CONS.offers = c.offers || {}; } })();
const saveConsult = () => store.set('wc-consult', { result: CONS.result, offers: CONS.offers });
const CONS_FOCUS = ['Like my favorites', 'Something new', 'Everyday wines', 'Special bottles', 'Top value'];
const LABEL_CLS = { 'Safe bet': 'safe', 'New to you': 'disc', Discovery: 'disc', 'Top value': 'value' };
/* the consultant called this label "Discovery" before discoveries were wines you taste out */
const consLabel = l => (l === 'Discovery' ? 'New to you' : l);

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/* the taste profile, calculated in the app from stock, finished wines, ratings, journal and purchase prices */
function tasteProfile() {
  const stock = S.wines.filter(w => w.count > 0);
  const since = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10);
  const opened = S.removals.filter(isOpened);
  const recent = opened.filter(r => str(r.date) >= since);
  const qty = r => Number(r.qty) || 1;
  // bottles ever owned per wine: purchases and gifts in, otherwise the stock plus what went out
  const owned = w => { const ins = inEntries(w).reduce((a, r) => a + qty(r), 0); return ins || w.count + S.removals.filter(r => r.wineId === w.id && r.dir === 'out').reduce((a, r) => a + qty(r), 0); };
  // a discovery counts as one bottle: you tasted it, even if you never owned it
  const all = S.wines.map(w => ({ w, n: owned(w) || (isDisc(w) ? 1 : 0) })).filter(x => x.n > 0);
  const totalOwned = all.reduce((a, x) => a + x.n, 0) || 1;
  const byType = TYPES.map(t => ({ t, n: all.filter(x => x.w.type === t).reduce((a, x) => a + x.n, 0) })).filter(x => x.n).sort((a, b) => b.n - a.n);
  const tallyTop = (keyOf, k) => { const m = new Map(); all.forEach(x => keyOf(x.w).forEach(v => { const key = lc(v); const e = m.get(key) || { v, n: 0 }; e.n += x.n; m.set(key, e); })); return [...m.values()].sort((a, b) => b.n - a.n).slice(0, k).map(e => e.v); };
  const grapes = tallyTop(grapeNames, 4);
  const regions = tallyTop(w => (w.region ? [str(w.region).split(',')[0].trim()] : []), 4);
  const prices = [];
  S.removals.filter(r => r.dir === 'in' && r.type === 'Purchase' && r.price !== null && r.price > 0).forEach(r => { const v = conv(r.price, r.priceCur || cur()); if (v) for (let i = 0; i < Math.min(qty(r), 24); i++) prices.push(v); });
  if (!prices.length) stock.forEach(w => { const v = streetOf(w); if (v) prices.push(v); });
  prices.sort((a, b) => a - b);
  const p25 = quantile(prices, 0.25), p50 = quantile(prices, 0.5), p75 = quantile(prices, 0.75);
  const rated = S.wines.filter(w => w.myRating !== null).sort((a, b) => b.myRating - a.myRating);
  const favTh = favThreshold(), lowTh = lowThreshold();
  const top = rated.filter(w => isFavWine(w, favTh)).slice(0, 4);
  const low = rated.filter(w => w.myRating < lowTh && !w.myFav).slice(-3);
  const tagM = new Map();
  rated.filter(w => isFavWine(w, favTh)).forEach(w => w.tasteTags.forEach(t => { const k = lc(t); tagM.set(k, (tagM.get(k) || 0) + 1); }));
  const tags = [...tagM.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
  const perMonth = recent.reduce((a, r) => a + qty(r), 0) / 12;
  const occ = tally(recent, r => [entryType(r)], qty).sort((a, b) => b.n - a.n).slice(0, 2).map(e => e.k);
  const cover = TYPES.map(t => {
    const st = stock.filter(w => w.type === t).reduce((a, w) => a + w.count, 0);
    const used = recent.filter(r => { const w = wineById(r.wineId); return w && w.type === t; }).reduce((a, r) => a + qty(r), 0);
    return { t, stock: st, used, months: used ? Math.round(st / (used / 12)) : null };
  }).filter(c => c.stock || c.used);
  const fmtP = v => fmtNum(Math.round(v), 0);
  const lines = [];
  if (byType.length) lines.push(['Wine types', byType.slice(0, 3).map(x => `${x.t} ${pct(x.n, totalOwned)}%`).join(', ')]);
  if (grapes.length) lines.push(['Grapes', grapes.join(', ')]);
  if (regions.length) lines.push(['Regions', regions.join(', ')]);
  if (p50 !== null) lines.push(['Usual price', `${cur()} ${fmtP(p25)} to ${fmtP(p75)} per bottle, median ${fmtP(p50)}`]);
  if (top.length) lines.push(['Rated highest', top.map(w => `${wineTitle(w)} ${w.vintage} ${w.myRating}%`).join(', ')]);
  if (tags.length) lines.push(['Style you like', tags.join(', ')]);
  const tw = ttWeight();
  if (tw) lines.push(['Taste test', `counts about ${Math.round(tw * 100)}% until you have rated more wines`]);
  lines.push(['Drinking', perMonth ? `about ${fmtNum(perMonth, 1)} bottles per month${occ.length ? `, mostly ${occ.join(' and ').toLowerCase()}` : ''}` : 'no bottles opened in the last 12 months']);
  const cs = cellarSpace();
  const totalStock = stock.reduce((x, w) => x + w.count, 0);
  if (cs.cap) {
    const lasts = perMonth ? Math.round(totalStock / perMonth) : null;
    lines.push(['Cellar space', `about ${cs.free} of ${cs.cap} places free${cs.pct >= 100 ? ', full' : cs.pct >= 85 ? ', nearly full' : ''}${lasts !== null ? `; the stock lasts about ${lasts > 99 ? '99+' : lasts} months at your pace` : ''}`]);
  }
  const text = [
    ...lines.map(l => `${l[0]}: ${l[1]}`),
    low.length ? `Rated lowest: ${low.map(w => `${fullName(w)} ${w.myRating}%`).join(', ')}` : '',
    cs.cap ? `Free space in the cellar: about ${cs.free} standard bottle places (${Math.round(cs.used)} of about ${cs.cap} used). A magnum takes 1.5 places.` : 'The cellar space is not set.',
    'Stock compared with drinking over the last 12 months:',
    ...cover.map(c => `${c.t}: ${btl(c.stock)} in stock, ${c.used} opened in 12 months${c.months !== null ? `, lasts about ${c.months} months` : ''}`)
  ].filter(Boolean).join('\n');
  const round5 = v => Math.max(5, Math.round(v / 5) * 5);
  // the same, as parts for the profile card
  const regionCode = {};
  all.forEach(x => { const r = lc(str(x.w.region).split(',')[0].trim()), c = countryOf(x.w); if (r && c && !regionCode[r]) regionCode[r] = c.code; });
  const card = { types: byType.map(x => ({ t: x.t, p: pct(x.n, totalOwned) })), grapes, regions: regions.map(r => ({ r, code: regionCode[lc(r)] || '' })), price: p50 !== null ? { lo: fmtP(p25), hi: fmtP(p75), mid: fmtP(p50) } : null,
    top, tags, perMonth, occ, tw, cs };
  return { lines, cover, text, card, budget: p50 !== null ? { min: round5(p25 * 0.8), max: round5(p75 * 1.2) } : { min: '', max: '' } };
}

function offerLineHtml(o, qty, ref) {
  return `<div class="cons-offer-box"><div class="cons-offer">${offerShopHtml(o, null)}
    <a class="btn accent offer-btn" href="${esc(o.url)}" target="_blank" rel="noopener"${ref ? ` data-shop="${esc(o.shop)}" data-sref="${esc(ref)}"` : ''}>${esc(priceText(o.v, o.cur))}${ICON.link}</a></div>${offerShipHtml(o, qty)}${ref ? shopBackHtml(ref) : ''}</div>`;
}

function pickCardHtml(p, i, saved) {
  const key = wishKey(p);
  const rw = p.replaces ? wineById(p.replaces) : null;
  const o = CONS.offers[key];
  const busyO = CONS.offerRun.has(key);
  return aiCardHtml({
    badges: `<span class="cons-label ${LABEL_CLS[p.label] || 'disc'}">${esc(consLabel(p.label))}</span>`, corner: p.price && !o ? `<span class="small muted">≈ ${esc(priceText(p.price, p.priceCur || cur()))}</span>` : '',
    title: wishTitle(p), sub: `${countryOf(p) ? flagOf(p) : ''}${esc([p.region, p.type, p.grapes].filter(Boolean).join(' · '))}`,
    fit: p.fit, win: p.window, why: p.why, value: p.value,
    extra: `<p class="small" style="margin:0"><b>Buy ${p.qty || 1} ${p.qty === 1 ? 'bottle' : 'bottles'}</b>${rw ? ` · replaces <a href="#/wine/${encodeURIComponent(rw.id)}">${esc(wineTitle(rw))} ${esc(rw.vintage)}</a> (${rw.count} left)` : ' · new addition'}</p>
      ${rw && p.replaceWhy ? `<p class="tiny muted" style="margin:-4px 0 0">${esc(p.replaceWhy)}</p>` : ''}${o ? offerLineHtml(o, p.qty, 'cons:' + i) : ''}`,
    actions: `<button class="link-btn" style="align-self:flex-start" data-act="cons-offer" data-i="${i}"${busyO ? ' disabled' : ''}>${ICON.refresh}${busyO ? 'Searching…' : o ? 'Update best offer' : 'Find best offer'}</button>${sgActionsHtml('cons:' + i)}`
  });
}

function wishCardHtml(x) {
  const busyO = CONS.offerRun.has('wish:' + x.id);
  return aiCardHtml({
    badges: `<span class="cons-label ${LABEL_CLS[x.label] || 'disc'}">${esc(consLabel(x.label) || 'Wishlist')}</span>`, corner: x.price ? `<span class="small muted">≈ ${esc(priceText(x.price, x.priceCur))}</span>` : '',
    title: wishTitle(x), sub: `${countryOf(x) ? flagOf(x) : ''}${esc([x.region, x.type].filter(Boolean).join(' · '))}${x.qty ? ` · buy ${x.qty}` : ''}`,
    fit: x.fit, win: x.window || winParse(null, previewOf(x)), why: x.why,
    extra: `${x.recBy ? `<button class="rec-by as-link" data-act="rec-wish" data-id="${esc(x.id)}">${REC_IC}<span>Recommended by ${esc(namesOf(x.recBy).join(', '))}</span></button>` : `<button class="link-btn rec-ask" data-act="rec-wish" data-id="${esc(x.id)}">${REC_IC}Who recommended it?</button>`}
      ${x.offer ? offerLineHtml(x.offer, x.qty || 6, 'wish:' + x.id) : ''}`,
    actions: `<button class="link-btn" style="align-self:flex-start" data-act="wish-offer" data-id="${esc(x.id)}"${busyO ? ' disabled' : ''}>${ICON.refresh}${busyO ? 'Searching…' : x.offer ? 'Update best offer' : 'Find best offer'}</button>${sgActionsHtml('wish:' + x.id)}`
  });
}

/* about a quarter of a bottle: 1, 1½, 2¼ */
function bottlesText(v) {
  const q = Math.round(v * 4) / 4, whole = Math.floor(q), part = ['', '¼', '½', '¾'][Math.round((q - whole) * 4)];
  if (q <= 0) return 'less than ¼';
  return `${whole || part ? (whole ? whole : '') + part : '0'}`;
}
/* your wine profile as one card: the types as a bar, two key figures, the rest as short text and bars */
function profileCardHtml(prof) {
  const c = prof.card, out = [];
  if (c.types.length) {
    const top = c.types.slice(0, 3), rest = 100 - top.reduce((a, x) => a + x.p, 0);
    out.push(`<div><p class="pf-lbl">What you drink</p><div class="pf-bar">${c.types.map(x => `<i style="flex:${Math.max(1, x.p)};background:${TYPE_CHART[x.t] || OTHER_C}"></i>`).join('')}</div>
      <div class="pf-leg">${top.map(x => `<span><i style="background:${TYPE_CHART[x.t] || OTHER_C}"></i>${esc(x.t)} ${x.p}%</span>`).join('')}${c.types.length > 3 && rest > 0 ? `<span>Other ${rest}%</span>` : ''}</div></div>`);
  }
  const n = c.perMonth, bt = n ? bottlesText(n) : '';
  const kpi = (label, big, small) => `<div class="pf-k"><span>${label}</span><b>${big}</b><span>${small}</span></div>`;
  out.push(`<div class="pf-kpi">${c.price ? kpi('Usual price', `${esc(cur())} ${c.price.lo} to ${c.price.hi}`, `median ${c.price.mid}`) : kpi('Usual price', 'N/A', 'add purchase prices')}${n ? kpi('You drink', `${bt} ${n > 1.125 ? 'bottles' : 'bottle'}`, 'per month') : kpi('You drink', 'None yet', 'in the last 12 months')}</div>`);
  if (c.tags.length) { const t = c.tags.join(' · '); out.push(`<div><p class="pf-lbl">Style you like</p><p class="pf-txt">${esc(t.charAt(0).toUpperCase() + t.slice(1))}</p></div>`); }
  if (c.grapes.length || c.regions.length) out.push(`<div><p class="pf-lbl">Grapes and regions</p>${c.grapes.length ? `<p class="pf-txt">${c.grapes.map(esc).join(' · ')}</p>` : ''}${c.regions.length ? `<p class="pf-txt">${c.regions.map(x => `${x.code ? flagOfCode(x.code) : ''}${esc(x.r)}`).join(' · ')}</p>` : ''}</div>`);
  if (c.top.length) out.push(`<div><p class="pf-lbl">Rated highest</p>${c.top.slice(0, 3).map(w => `<a class="pf-tr" href="#/wine/${encodeURIComponent(w.id)}"><span>${esc(wineTitle(w))} <small>${esc(w.vintage)}</small></span>${segsHtml(w.myRating, 6)}<b>${w.myRating}%</b></a>`).join('')}</div>`);
  const cov = prof.cover.filter(x => x.stock);
  if (cov.length) {
    const max = Math.max(24, ...cov.map(x => Math.min(99, x.months || 0)));
    out.push(`<div><p class="pf-lbl">Your stock lasts</p>${cov.map(x => `<div class="pf-last"><span>${esc(x.t)}</span><span class="t"><i style="width:${x.months === null ? 0 : Math.max(3, Math.min(100, Math.min(99, x.months) / max * 100))}%;background:${TYPE_CHART[x.t] || OTHER_C}"></i></span><span class="m">${x.months === null ? 'not opened' : x.months > 99 ? '99+ mo.' : `${x.months} mo.`}</span></div>`).join('')}
      ${c.cs.cap ? `<p class="tiny muted" style="margin:6px 0 0">About ${c.cs.free} of ${c.cs.cap} places free in your cellar.</p>` : ''}</div>`);
  }
  if (c.tw) out.push(`<p class="tiny muted" style="margin:0">Your taste test counts about ${Math.round(c.tw * 100)}% until you have rated more wines.</p>`);
  return `<section class="pf-card"><h2>Your wine profile</h2>${out.join('')}</section>`;
}
/* what you are looking for, as tiles with one short line */
const CONS_FOCUS_TILES = { 'Like my favorites': ['heart', 'More of what you rated high'], 'Something new': ['spark', 'Grapes and regions you do not have'], 'Everyday wines': ['glass', 'Good bottles for every day'], 'Special bottles': ['trophy', 'For celebrations and to keep'], 'Top value': ['cash', 'The most quality for the money'] };

function viewDiscover() {
  const prof = tasteProfile();
  if (!CONS.budget) CONS.budget = prof.budget;
  const old = S.version && S.version < 12;
  const savedKeys = new Set(S.wishlist.map(wishKey));
  const res = CONS.result;
  return `<main class="screen has-nav discover">
    <div class="detail-top"><a class="back" href="#/insights">${ICON.back}Insights</a></div>
    <header><h1 class="title somm-title"><span class="magic-ic">${ICON.magic}</span>Consultant</h1></header>
    ${ttOfferHtml()}
    ${old ? '<div class="card notice"><b>Script update needed</b><p class="small" style="margin:4px 0 0">The consultant needs the new Code.gs. Replace the script code and create a new version under Manage deployments.</p></div>' : ''}
    ${profileCardHtml(prof)}
    <section class="ins-sec"><div class="sec-head"><h2>What are you looking for?</h2></div>
      <div class="cf-tiles">${CONS_FOCUS.map((f, i) => { const [ic, d] = CONS_FOCUS_TILES[f]; const wide = i === CONS_FOCUS.length - 1 && CONS_FOCUS.length % 2; return `<button class="cf-tile${CONS.focus === f ? ' on' : ''}${wide ? ' wide' : ''}" data-act="cons-focus" data-v="${esc(f)}" aria-pressed="${CONS.focus === f}">${ICON[ic]}<span><b>${esc(f)}</b><small>${esc(d)}</small></span></button>`; }).join('')}</div>
      <div class="grid2"><label class="field">Budget from (${esc(cur())})<input inputmode="numeric" data-input="cons-min" value="${esc(CONS.budget.min)}"></label><label class="field">to (${esc(cur())})<input inputmode="numeric" data-input="cons-max" value="${esc(CONS.budget.max)}"></label></div>
      <div class="field"><label for="cons-note">Anything else? (optional)</label><div class="note-voice"><textarea id="cons-note" data-input="cons-note" rows="2" placeholder="Type or speak, for example more whites for summer, wines for guests">${esc(CONS.note)}</textarea><div class="voice-btns">${voiceLangHtml()}<button class="somm-mic${CONS.listening ? ' on' : ''}" id="cons-mic" data-act="cons-mic" aria-label="${CONS.listening ? 'Stop listening' : 'Speak'}">${ICON.mic}</button></div></div>
        <span class="tiny muted" id="cons-mic-hint">${CONS.listening ? 'Listening. Tap stop when you are done.' : ''}</span></div>
      <button class="btn primary big block" data-act="cons-run"${CONS.busy || old ? ' disabled' : ''}>${ICON.magic}${CONS.busy ? 'Choosing wines and checking shops…' : res ? 'Get new recommendations' : 'Get recommendations'}</button>
      <p class="wz-cost">${CONS.busy ? 'This takes about a minute.' : 'About 15 to 20 cents, takes about a minute.'}</p>
    </section>
    ${CONS.error ? `<p class="small" style="color:var(--danger);margin:0">${esc(CONS.error)}</p>` : ''}
    ${res ? `<section class="ai-res" id="cons-res">${adviceHtml(res.summary)}
      <div class="ai-head-row"><h2>${res.picks.length} ${res.picks.length === 1 ? 'wine' : 'wines'} for you</h2></div>
      <div class="cons-list">${res.picks.map((p, i) => pickCardHtml(p, i, savedKeys.has(wishKey(p)))).join('')}</div></section>` : ''}
  </main>${nav('insights')}`;
}
const infoRowWide = (label, value) => `<div class="info-row wide"><span class="info-label">${esc(label)}</span><span class="info-val">${esc(value)}</span></div>`;

async function consRun() {
  if (CONS.busy) return;
  if (CONS.listening) consStopVoice();
  const ta = $('#cons-note');
  if (ta) CONS.note = ta.value;
  const prof = tasteProfile();
  CONS.busy = true; CONS.error = '';
  render();
  const avoid = S.wishlist.map(wishTitle).concat(CONS.result ? CONS.result.picks.map(wishTitle) : []);
  try {
    const r = await api('consultant', { profile: prof.text, focus: CONS.focus, budget: { min: Number(CONS.budget.min) || 0, max: Number(CONS.budget.max) || 0 }, note: CONS.note, avoid });
    CONS.result = { summary: str(r.summary), picks: (r.picks || []).map(p => Object.assign({}, p, { vintage: str(p.vintage) })) };
    CONS.offers = {};
    CONS.result.picks.forEach(p => { if (p.offer && p.offer.shop) CONS.offers[wishKey(p)] = p.offer; });
    saveConsult();
  } catch (e) {
    CONS.error = /Unknown action/i.test(e.message) ? 'The consultant needs the new Code.gs. Update the script, then try again.' : aiErr(e.message);
  }
  CONS.busy = false;
  render();
  // straight to the advice, so it does not hide under the button
  const h = $('#cons-res');
  if (h) { h.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}

async function consOffer(p, key, wishId) {
  if (CONS.offerRun.has(key)) return;
  CONS.offerRun.add(key);
  refreshView();
  try {
    const had = wishId ? !!(S.wishlist.find(w => w.id === wishId) || {}).offer : !!CONS.offers[wishKey(p)];
    const o = await api('offerFor', { wine: wishTitle(p), region: p.region, wishId: wishId || '', fresh: had });
    if (wishId) { const x = S.wishlist.find(w => w.id === wishId); if (x) x.offer = o; persist(); }
    else { CONS.offers[wishKey(p)] = o; saveConsult(); }
  } catch (e) {
    toast(aiErr(e.message), 5000);
  }
  CONS.offerRun.delete(key);
  refreshView();
}

const wishSavedToast = x => toastAct('Saved to your wishlist in the Cellar.', [['Show', () => goSection('wishlist')], ['Who recommended it?', () => recWishOpen(x.id)]]);
async function consSave(p) {
  const x = normWish(Object.assign({}, p, { id: newId('x'), offer: CONS.offers[wishKey(p)] || null, createdAt: new Date().toISOString(), details: previewOf(p) }));
  x.window = winParse(p.window, previewOf(p));
  S.wishlist.push(x);
  persist();
  refreshView();
  try {
    await api('saveWish', { wish: Object.assign({}, x, { offer: x.offer ? JSON.stringify(x.offer) : '', details: x.details ? JSON.stringify(x.details) : '' }) });
    wishSavedToast(x);
  } catch (e) {
    S.wishlist = S.wishlist.filter(w => w.id !== x.id);
    persist();
    refreshView();
    toast('Not saved: ' + e.message);
  }
}

async function wishDelete(id) {
  const prev = S.wishlist;
  S.wishlist = S.wishlist.filter(w => w.id !== id);
  persist();
  refreshView();
  try { await api('deleteWish', { id }); } catch (e) { S.wishlist = prev; persist(); refreshView(); toast('Not deleted: ' + e.message); }
}

/* opens the add form with the details of a wishlist wine; the AI fills in the rest */
function wishToCellar(id) {
  const x = S.wishlist.find(w => w.id === id);
  if (!x) return;
  D = newDraft('add', null);
  D.step = 'form';
  D.fromWish = x.id;
  const set = (k, v) => { if (str(v)) { D.fields[k] = str(v); D.touched.add(k); } };
  set('producer', x.producer); set('name', x.name); set('vintage', x.vintage); set('region', x.region); set('grapes', x.grapes);
  if (TYPES.includes(x.type)) { D.fields.type = x.type; D.touched.add('type'); }
  if (x.offer) { D.fields.price = priceInput(x.offer.v, x.offer.cur); D.acq.website = ''; }
  if (x.qty) D.stock[0].n = x.qty;
  // what was loaded with More about this wine is taken over, so the AI is not asked twice
  const pv = previewOf(x);
  if (pv) {
    ['region', 'grapes', 'taste'].forEach(k => { if (!D.fields[k] && pv[k]) D.fields[k] = pv[k]; });
    if ((pv.tasteTags || []).length) D.fields.tasteTags = pv.tasteTags.join(', ');
    if ((pv.pairings || []).length) D.fields.pairings = pv.pairings.join(', ');
    ['drinkFrom', 'drinkUntil', 'peakFrom', 'peakUntil'].forEach(k => { if (pv[k]) D.fields[k] = String(pv[k]); });
    if (pv.profile) D.profile = parseProfile(JSON.stringify(pv.profile)) || D.profile;
  }
  go('#/add');
  if (!pv) setTimeout(() => { if (D && D.fromWish === x.id) runAnalysis(); }, 50);
}

/* the wine you are tasting, from Will I like it? or the wine list, kept as a discovery */
function sommTaste(i) {
  const t = sommThread()[i];
  if (!t || !t.a) return;
  const a = t.a, x = a.info && (a.info.producer || a.info.name) ? a.info : { producer: '', name: a.wine, vintage: (str(a.wine).match(/\b(19|20)\d{2}\b/) || [''])[0], type: '', region: a.region || '', grapes: '' };
  const o = a.offer || a.worldOffer;
  openDiscovery(x, { venue: a.priceWhere === 'restaurant' ? 'restaurant' : '', price: a.price || '', priceCur: a.price ? a.priceCur : countryCur(a.country || travelCountry()), shopRef: o ? { v: o.v, cur: o.cur } : null, offer: a.offer || null });
}
function listTaste(i) {
  const res = WL.result, p = res && res.picks[i];
  if (!p) return;
  openDiscovery(Object.assign({ producer: p.producer, name: p.name, vintage: p.vintage ? String(p.vintage) : '', type: p.type, region: p.region, grapes: p.grapes }, p.window || {}),
    { venue: 'restaurant', place: res.restaurant || '', price: p.listPrice || '', priceCur: res.currency || cur(), food: res.food || '', shopRef: p.shopPrice ? { v: p.shopPrice, cur: res.currency || cur() } : null, offer: p.offer || null });
}

/* ---------------------------------------------------------------- more about a suggested wine, loaded only when you tap it */

const PREV = { open: false, base: null, note: '', src: null, busy: false, error: '', details: null };
const prevKey = x => lc([x.producer, x.name, x.vintage].map(v => str(v).trim()).join('|'));
function prevCache() { try { return JSON.parse(localStorage.getItem('wc-preview') || '{}'); } catch (e) { return {}; } }
const PREV_MEM = {};
const previewOf = x => (x ? PREV_MEM[prevKey(x)] || prevCache()[prevKey(x)] || null : null);
function prevRemember(x, d) {
  PREV_MEM[prevKey(x)] = d;
  try { const c = prevCache(); c[prevKey(x)] = d; const keys = Object.keys(c); if (keys.length > 60) delete c[keys[0]]; localStorage.setItem('wc-preview', JSON.stringify(c)); } catch (e) { /* kept for this session */ }
}
/* the suggested wine as a wine of the app, with what was loaded about it */
function previewWine(base, d) {
  // the window you saw in the answer stays the same here
  const x = Object.assign({}, base, d || {}, base && base.drinkFrom ? { drinkFrom: base.drinkFrom, peakFrom: base.peakFrom, peakUntil: base.peakUntil, drinkUntil: base.drinkUntil } : {});
  return normWine({ id: 'preview', producer: x.producer, name: x.name, vintage: x.vintage, type: x.type, region: x.region, grapes: x.grapes, taste: x.taste,
    tasteTags: (x.tasteTags || []).join(', '), pairings: (x.pairings || []).join(', '), drinkFrom: x.drinkFrom, drinkUntil: x.drinkUntil, peakFrom: x.peakFrom, peakUntil: x.peakUntil,
    profile: x.profile ? JSON.stringify(x.profile) : '', stock: '[]' });
}

/** src: { kind: 'list' | 'check' | 'wish', i or id } tells which buttons the preview offers. */
async function openPreview(base, note, src) {
  if (!base || !(str(base.producer).trim() || str(base.name).trim())) { toast('The wine could not be identified.'); return; }
  Object.assign(PREV, { open: true, base, note: note || '', src, busy: false, error: '', details: previewOf(base) });
  U.aboutOpen = null;
  renderPreview();
  if (PREV.details) return;
  if (S.version && S.version < 30) { PREV.error = 'More about a suggested wine needs the new Code.gs.'; renderPreview(); return; }
  PREV.busy = true; renderPreview();
  const key = prevKey(base);
  try {
    const d = await api('preview', { wine: { producer: base.producer, name: base.name, vintage: base.vintage, type: base.type, region: base.region, grapes: base.grapes } });
    prevRemember(base, d.details);
    if (PREV.open && prevKey(PREV.base) === key) PREV.details = d.details;
  } catch (e) {
    if (PREV.open && prevKey(PREV.base) === key) PREV.error = /Unknown action/i.test(e.message) ? 'More about a suggested wine needs the new Code.gs.' : `Could not load more: ${aiErr(e.message)}`;
  }
  if (PREV.open && prevKey(PREV.base) === key) { PREV.busy = false; renderPreview(); }
}
function closePreview() { PREV.open = false; renderPreview(); }

function renderPreview() {
  let root = $('#prev-root');
  if (!root) { root = document.createElement('div'); root.id = 'prev-root'; const info = $('#info-root'); document.body.insertBefore(root, info || null); }
  if (!PREV.open) { root.innerHTML = ''; return; }
  const w = previewWine(PREV.base, PREV.details), d = PREV.details;
  const c = countryOf(w);
  const p = windowParts(w), s = statusOf(w);
  const section = (title, body) => `<section style="gap:12px"><h2>${title}</h2>${body}</section>`;
  // the window known from the answer shows at once, also while the rest is loading
  const winSec = p ? section('Drinking window', `<span class="small" style="color:${STATUS[s].c};font-weight:500;margin-top:-6px">${statusLine(w)}</span>${timelineHtml(w, true)}${timelineScaleHtml(w)}`) : '';
  const body = PREV.busy
    ? `${winSec}<div class="info-wait"><p class="somm-wait">Loading taste profile and drinking window<span>.</span><span>.</span><span>.</span></p><p class="tiny muted" style="margin:0">Only for the wines you open, about 1 to 2 cents. Kept on your phone.</p></div>`
    : PREV.error ? `${winSec}<p class="small" style="margin:0;color:var(--danger)">${esc(PREV.error)}</p>`
    : d ? `${winSec}
        <section style="gap:16px"><h2>Profile</h2>${grapeRingHtml(w)}${axesHtml(w)}${aromasHtml(w)}
          ${w.taste ? `<div class="kv"><span>Taste</span><p style="line-height:1.5">${esc(w.taste)}</p></div>` : ''}
          ${w.tasteTags.length ? `<div class="kv"><span>Style</span><p class="style-line">${w.tasteTags.map(t => esc(cap(t))).join(' · ')}</p></div>` : ''}
          ${foodTilesHtml(w)}</section>
        ${aboutHtml(w)}
        <p class="tiny muted" style="margin:0">Written by AI from its knowledge. Tap region, style or producer for the background.</p>` : winSec;
  const k = PREV.src && PREV.src.kind;
  const wished = S.wishlist.some(x => wishKey(x) === wishKey(PREV.base));
  const sref = !PREV.src ? '' : PREV.src.kind === 'list' ? 'wl:' + PREV.src.i : PREV.src.kind === 'wish' ? 'wish:' + PREV.src.id : PREV.src.kind + ':' + PREV.src.i;
  const buttons = sref ? sgActionsHtml(sref, { more: false }) : '';
  const inner = `<div class="between" style="align-items:flex-start;gap:12px">
      <div class="info-head"><span class="ab-ic">${c ? `<span class="ab-flag">${flagEmoji(c.code)}</span>` : ICON.glass}</span><div><span class="tiny muted" style="text-transform:uppercase;letter-spacing:.06em">${esc([w.type, w.vintage, alcText(w)].filter(Boolean).join(' · ') || 'Wine')}</span><h2>${esc(wineTitle(w))}</h2><p class="small muted" style="margin:2px 0 0">${esc([w.producer !== wineTitle(w) ? w.producer : '', w.region].filter(Boolean).join(' · '))}</p></div></div>
      <button class="icon-btn" data-act="prev-close" aria-label="Close">${ICON.x}</button>
    </div>
    ${PREV.note ? `<p class="small" style="margin:0">${PREV.note}</p>` : ''}
    <div class="info-body prev-body">${body}</div>
    ${buttons}`;
  const key = prevKey(PREV.base), open = root.querySelector('.prev-sheet');
  if (open && root.dataset.key === key) {
    const pb = open.querySelector('.prev-body'), top = open.scrollTop, btop = pb ? pb.scrollTop : 0;
    open.innerHTML = inner;
    open.scrollTop = top;
    const nb = open.querySelector('.prev-body');
    if (nb) nb.scrollTop = btop;
    return;
  }
  root.dataset.key = key;
  root.innerHTML = `<div class="sheet-backdrop" data-act="prev-close"></div>
  <div class="sheet prev-sheet" role="dialog" aria-modal="true" aria-label="${esc(wineTitle(w))}">${inner}</div>`;
}

/* where a preview comes from: a pick of the wine list, the wine of Will I like it?, or the wishlist */
function listPreview(i) {
  const res = WL.result, p = res && res.picks[i];
  if (!p) return;
  openPreview(Object.assign({ producer: p.producer, name: p.name, vintage: p.vintage ? String(p.vintage) : '', type: p.type, region: p.region, grapes: p.grapes }, p.window || {}), esc(p.why || ''), { kind: 'list', i });
}
function sommPreview(i) {
  const t = sommThread()[i];
  if (!t || !t.a) return;
  const a = t.a, x = a.info && (a.info.producer || a.info.name) ? a.info : { producer: '', name: a.wine, vintage: (str(a.wine).match(/\b(19|20)\d{2}\b/) || [''])[0], type: '', region: a.region || '', grapes: '' };
  openPreview(x, a.fit ? `Fits your taste: <b>${a.fit}%</b>` : '', { kind: 'check', i });
}
function consPreview(i) {
  const p = CONS.result && CONS.result.picks[i];
  if (!p) return;
  openPreview({ producer: p.producer, name: p.name, vintage: p.vintage ? String(p.vintage) : '', type: p.type, region: p.region, grapes: p.grapes }, esc(p.why || ''), { kind: 'cons', i });
}
function wishPreview(id) {
  const x = S.wishlist.find(w => w.id === id);
  if (!x) return;
  openPreview({ producer: x.producer, name: x.name, vintage: x.vintage, type: x.type, region: x.region, grapes: x.grapes }, esc(x.why || ''), { kind: 'wish', id });
}
function previewTaste() {
  const src = PREV.src || {}, base = PREV.base;
  closePreview();
  if (src.kind === 'list') listTaste(src.i);
  else if (src.kind === 'check') sommTaste(src.i);
  else openDiscovery(base, {});
}
async function previewWish() {
  const src = PREV.src || {};
  if (src.kind === 'list') { const p = WL.result && WL.result.picks[src.i]; if (p) await listSave(p); }
  else if (src.kind === 'check') await checkSave(src.i);
  else if (src.kind === 'cons') { const p = CONS.result && CONS.result.picks[src.i]; if (p) await consSave(p); }
  renderPreview();
}
/* Will I like it? to the wishlist, with the shop price found */
async function checkSave(i) {
  const t = sommThread()[i];
  if (!t || !t.a) return;
  const a = t.a, x0 = a.info && (a.info.producer || a.info.name) ? a.info : { producer: '', name: a.wine, vintage: '', type: '', region: a.region || '', grapes: '' };
  const o = a.offer || a.worldOffer;
  const x = normWish({ id: newId('x'), producer: x0.producer, name: x0.name, vintage: x0.vintage, type: x0.type, region: x0.region, grapes: x0.grapes,
    price: o ? o.v : '', priceCur: o ? o.cur : cur(), label: 'Will I like it?', why: str(a.answer), createdAt: new Date().toISOString(), fit: a.fit, details: previewOf(x0) });
  x.window = winParse(a.window, previewOf(x0));
  S.wishlist.push(x);
  persist();
  try { await api('saveWish', { wish: Object.assign({}, x, { offer: a.offer ? JSON.stringify(a.offer) : '', details: x.details ? JSON.stringify(x.details) : '' }) }); wishSavedToast(x); }
  catch (e) { S.wishlist = S.wishlist.filter(w => w.id !== x.id); persist(); toast('Not saved: ' + e.message); }
}

sommLoad();

/* ------------------------------------------------------------ journal assistant: questions about the journal, the people and the purchases */

const JA = { thread: [], draft: '', busy: false, listening: false, rec: null, voiced: false };
const jaExamples = () => {
  const top = knownPeople().filter(p => p.n > 0)[0];
  const who = top ? top.name : 'a friend';
  return ['Which wines did I drink last year, and with whom?', 'Which wines did I receive as gifts, and from whom?', 'Show me the five best wines I drank with friends',
    `What could I give ${who}, based on what we enjoyed together?`, 'Which wines did I buy last year, and where?', 'Which purchase was my best buy in hindsight?'];
};

/* the journal in short lines with references e1, w1 for the AI; the references point back to entries and wines */
function jaContext(q) {
  const refs = {}, wref = new Map();
  const wineRef = w => { if (!wref.has(w.id)) { const k = 'w' + (wref.size + 1); wref.set(w.id, k); refs[k] = { wine: w.id }; } return wref.get(w.id); };
  const c0 = cur();
  const amt = v => (v === null || v === undefined ? '' : `${c0} ${fmtNum(v, v >= 100 ? 0 : 2)}`);
  let list = allEntries().slice().sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).map((r, i) => ({ r, ref: 'e' + (i + 1) }));
  // a very large journal: the entries that match words of the question, plus the most recent ones
  if (list.length > 1200) {
    const words = lc(q).split(/[^\p{L}\p{N}]+/u).filter(x => x.length >= 4);
    const recent = new Set(list.slice(-400));
    const hit = x => {
      const w = wineById(x.r.wineId);
      const hay = lc([x.r.people, x.r.hearts, x.r.retailer, x.r.occasion, x.r.food, x.r.note, w ? `${fullName(w)} ${w.region} ${w.grapes}` : x.r.wineName, namesOf(x.r.people).map(n => personInfo(n).aliases).join(' ')].join(' '));
      return words.some(k => hay.includes(k));
    };
    list = list.filter(x => recent.has(x) || hit(x));
  }
  const lines = list.map(({ r, ref }) => {
    refs[ref] = { entry: r.id };
    const w = wineById(r.wineId);
    const wine = w ? `${wineRef(w)} ${fullName(w)}` : r.wineName || 'unknown wine';
    const ppl = namesOf(r.people).join(', ');
    const n = r.qty > 1 ? `${r.qty} btl` : '1 btl';
    const paid = r.price !== null ? conv(r.price, r.priceCur) : null;
    let what;
    if (r.dir === 'in') {
      if (r.type === 'Purchase') {
        const now = w ? streetOf(w) : null;
        what = `bought ${n}${r.retailer ? ` from ${r.retailer}` : ''}${paid ? `, paid ${amt(paid)} per btl` : ''}${paid && now ? `, shop price now ${amt(now)} (${now >= paid ? '+' : ''}${Math.round((now / paid - 1) * 100)}%)` : ''}`;
      } else if (r.type === 'Received') what = `gift received${ppl ? ` from ${ppl}` : ''}, ${n}`;
      else what = `added ${n}`;
    } else if (r.dir === 'taste') {
      what = `tasted out${r.venue ? ` (${r.venue})` : ''}${paid ? `, paid ${amt(paid)}` : ''}${ppl ? `, with ${ppl}` : ''}`;
    } else if (r.type === 'Gift') what = `gift given${ppl ? ` to ${ppl}` : ''}, ${n}`;
    else if (r.type === 'Sale') what = `sold ${n}${ppl ? ` to ${ppl}` : ''}${paid ? ` for ${amt(paid)} per btl` : ''}`;
    else what = `opened ${n} (${lc(entryType(r))})${ppl ? `, with ${ppl}` : ''}`;
    return [ref, r.date, what, wine, r.hearts ? `favorite of ${namesOf(r.hearts).join(', ')}` : '', r.occasion ? `occasion: ${r.occasion}` : '', r.food ? `food: ${r.food}` : '', r.note ? `note: ${r.note}` : ''].filter(Boolean).join(' | ');
  });
  // wines in stock are there for gift ideas, even without a journal entry in the list
  S.wines.filter(w => w.count > 0).forEach(wineRef);
  const wines = [...wref.entries()].map(([id, k]) => {
    const w = wineById(id);
    const now = streetOf(w);
    return [k, fullName(w), w.type, w.region, w.grapes, w.myRating !== null ? `my rating ${w.myRating}%` : 'not rated', now ? `shop price now ${amt(now)}` : '', w.count ? `in stock ${w.count} btl` : 'none left', isDisc(w) ? 'discovery, tasted out' : ''].filter(Boolean).join(' | ');
  });
  const people = S.people.map(n => { const i = personInfo(n); return [n, i.aliases ? `also called ${i.aliases}` : '', i.note ? `note: ${i.note}` : ''].filter(Boolean).join(' | '); });
  const text = `PEOPLE:\n${people.join('\n') || 'None yet.'}\n\nWINES:\n${wines.join('\n') || 'None.'}\n\nJOURNAL (oldest first${list.length < allEntries().length ? `, ${list.length} of ${allEntries().length} entries that match the question or are recent` : ''}):\n${lines.join('\n')}`;
  return { text, refs };
}

function jaCardsHtml(a) {
  const entries = (a.entries || []).map(id => S.removals.find(r => r.id === id)).filter(Boolean).map(r => {
    const w = wineById(r.wineId);
    const ppl = namesOf(r.people).join(', ');
    const hearts = namesOf(r.hearts);
    const sub = [fmtDate(r.date), entryType(r), ppl ? (r.type === 'Received' ? `from ${ppl}` : r.type === 'Gift' ? `to ${ppl}` : `with ${ppl}`) : '', r.dir === 'in' && r.retailer ? r.retailer : ''].filter(Boolean).join(' · ');
    const inner = `${w ? thumbHtml(w, true) : ''}<span class="somm-pick-text"><span class="row-title">${esc(w ? `${wineTitle(w)} ${w.vintage}` : r.wineName)}</span>
      <span class="row-sub">${w ? flagOf(w) : ''}${esc(sub)}</span>${hearts.length ? `<span class="tiny muted">${HEART_SM}${esc(hearts.join(', '))}</span>` : ''}${w && w.myRating !== null ? `<span class="tiny muted">Rated ${w.myRating}%</span>` : ''}</span>`;
    return `<div class="somm-pick">${w ? `<a class="somm-pick-link" href="#/wine/${encodeURIComponent(w.id)}">${inner}</a>` : `<div class="somm-pick-link">${inner}</div>`}</div>`;
  });
  const wines = (a.wines || []).map(id => wineById(id)).filter(Boolean).map(w => `<div class="somm-pick"><a class="somm-pick-link" href="#/wine/${encodeURIComponent(w.id)}">${thumbHtml(w, true)}<span class="somm-pick-text">
      <span class="row-title">${esc(wineTitle(w))} ${esc(w.vintage)}</span><span class="row-sub">${flagOf(w)}${esc(w.producer)}${w.count ? ` · ${w.count} btl` : ''}${w.myRating !== null ? ` · rated ${w.myRating}%` : ''}</span></span>${pill(w)}</a></div>`);
  const all = entries.concat(wines);
  return all.length ? `<div class="somm-picks">${all.join('')}</div>` : '';
}

function jaAnswerHtml(t, i) {
  if (t.error) return `<div class="somm-a error"><p>${esc(t.error)}</p><button class="link-btn" data-act="ja-retry" data-i="${i}">${ICON.refresh}Try again</button></div>`;
  if (!t.a) return `<div class="somm-a"><p class="somm-wait">Looking through your journal<span>.</span><span>.</span><span>.</span></p></div>`;
  return `<div class="somm-a">${t.a.answer ? `<p>${esc(t.a.answer)}</p>` : ''}${jaCardsHtml(t.a)}</div>`;
}

function jaThreadHtml() {
  if (!JA.thread.length) {
    return `<div class="somm-intro"><p class="muted">Ask about the wines you bought, opened, gave and received, and the people you shared them with. Tap an example to try it.</p>
      <div class="somm-examples">${jaExamples().map(x => `<button class="somm-ex" data-act="ja-example" data-v="${esc(x)}">${ICON.magic}<span>${esc(x)}</span></button>`).join('')}</div></div>`;
  }
  return JA.thread.map((t, i) => `<div class="somm-q">${esc(t.q)}</div>${jaAnswerHtml(t, i)}`).join('');
}

const jaTopHtml = () => `<a class="back" href="#/journal">${ICON.back}Journal</a>${JA.thread.length ? `<button class="btn ghost" style="height:40px" data-act="ja-clear">New question</button>` : ''}`;
const jaHint = () => (JA.listening ? 'Listening. Take your time, tap stop when you are done.' : JA.voiced ? 'Check the text and correct it if needed, then send.' : 'Type or tap the microphone to speak.');

function viewJournalAI() {
  const old = S.version && S.version < 31;
  return `<main class="screen somm">
    <div class="detail-top" id="ja-top">${jaTopHtml()}</div>
    <header><h1 class="title somm-title"><span class="magic-ic">${ICON.magic}</span>Journal Assistant</h1></header>
    <p class="small muted" style="margin:-4px 0 0">Your journal, people and purchases, answered by AI.</p>
    ${tipHtml('journal-ai')}
    ${old ? '<div class="card notice"><b>Script update needed</b><p class="small" style="margin:4px 0 0">The journal assistant needs the new Code.gs. Replace the script code and create a new version under Manage deployments.</p></div>' : ''}
    <div id="ja-thread" class="somm-thread">${jaThreadHtml()}</div>
  </main>
  <div class="somm-bar">
    <div class="somm-input${JA.listening ? ' listening' : ''}">
      <textarea id="ja-text" data-input="ja-text" rows="1" placeholder="${JA.listening ? 'Listening…' : 'Ask about your journal'}" aria-label="Your question">${esc(JA.draft)}</textarea>
      ${voiceLangHtml()}<button class="somm-mic${JA.listening ? ' on' : ''}" data-act="ja-mic" aria-label="${JA.listening ? 'Stop listening' : 'Speak'}">${ICON.mic}</button>
      <button class="somm-send" data-act="ja-send" aria-label="Send"${JA.busy ? ' disabled' : ''}>${ICON.send}</button>
    </div>
    <p id="ja-hint" class="tiny muted somm-hint">${jaHint()}</p>
  </div>`;
}

function jaRefresh(scroll) {
  const th = $('#ja-thread');
  if (th) th.innerHTML = jaThreadHtml();
  const top = $('#ja-top');
  if (top) top.innerHTML = jaTopHtml();
  const ta = $('#ja-text');
  if (ta && ta.value !== JA.draft) { ta.value = JA.draft; autosize(ta); }
  if (ta) ta.placeholder = JA.listening ? 'Listening…' : 'Ask about your journal';
  const send = $('[data-act="ja-send"]');
  if (send) send.disabled = JA.busy;
  const hint = $('#ja-hint');
  if (hint) hint.textContent = jaHint();
  const box = $('.somm-input');
  if (box) box.classList.toggle('listening', JA.listening);
  const mic = $('[data-act="ja-mic"]');
  if (mic) { mic.classList.toggle('on', JA.listening); mic.setAttribute('aria-label', JA.listening ? 'Stop listening' : 'Speak'); }
  if (scroll) window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

async function jaRun(turn) {
  const ctx = jaContext(turn.q);
  const before = JA.thread.slice(0, JA.thread.indexOf(turn)).filter(t => t.a && t.a.raw).slice(-3);
  const history = before.map(t => ({ q: t.q, a: JSON.stringify({ answer: t.a.answer, entries: t.a.raw.entries, wines: t.a.raw.wines }) }));
  turn.a = null;
  turn.error = '';
  JA.busy = true;
  jaRefresh(true);
  try {
    const a = await api('journalAsk', { question: turn.q, history, context: ctx.text });
    const ent = (a.entries || []).filter(k => ctx.refs[k] && ctx.refs[k].entry), win = (a.wines || []).filter(k => ctx.refs[k] && ctx.refs[k].wine);
    turn.a = { answer: str(a.answer), entries: ent.map(k => ctx.refs[k].entry), wines: win.map(k => ctx.refs[k].wine), raw: { entries: ent, wines: win } };
  } catch (e) {
    turn.error = /Unknown action/i.test(e.message) ? 'The journal assistant needs the new Code.gs. Update the script, then try again.' : aiErr(e.message);
  }
  JA.busy = false;
  jaSave();
  jaRefresh(true);
}

function jaAsk(text) {
  const q = str(text).trim();
  if (!q || JA.busy) return;
  if (JA.listening) jaStopVoice();
  const turn = { q, a: null, error: '' };
  JA.thread.push(turn);
  JA.draft = '';
  JA.voiced = false;
  jaRun(turn);
}

function jaSave() {
  try { localStorage.setItem('wc-journal-ai', JSON.stringify(JA.thread.filter(t => t.a || t.error).slice(-20))); } catch (e) { /* kept for this session */ }
}
function jaLoad() {
  try { const t = JSON.parse(localStorage.getItem('wc-journal-ai') || '[]'); if (Array.isArray(t)) JA.thread = t; } catch (e) { JA.thread = []; }
}
jaLoad();

function jaStartVoice() {
  const ta0 = $('#ja-text');
  if (ta0) JA.draft = ta0.value;
  if (!voiceStart({
    get: () => JA.draft,
    set: t => { JA.draft = t; JA.voiced = true; jaRefresh(false); },
    ui: on => { JA.listening = on; jaRefresh(false); if (!on) { const ta = $('#ja-text'); if (ta && JA.draft) ta.focus(); } }
  })) { if (ta0) ta0.focus(); }
}
function jaStopVoice() {
  if (JA.listening) voiceCancel();
  JA.listening = false;
}
