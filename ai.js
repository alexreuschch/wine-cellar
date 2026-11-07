'use strict';

/* Wine Cellar: AI sommelier, value over time, AI consultant and wishlist. Loaded after app.js, in the order of index.html. */

/* ------------------------------------------------------------ view: drinking window */

/* ------------------------------------------------------------ AI sommelier */

const SOMM = { mode: 'cellar', threads: { cellar: [], check: [] }, draft: '', busy: false, rec: null, listening: false, voiced: false, tips: false, photo: null, where: null, whereAt: 0, price: '', redo: '' };
const sommThread = () => SOMM.threads[SOMM.mode] || [];
/* wine list in a restaurant: photos of the pages, price range and food, then three picks */
const WL = { pages: [], min: '', max: '', result: null, error: '', busy: false };
const WL_KIND = { range: ['Best in your range', 'safe'], value: ['Best value', 'value'], gem: ['Hidden gem', 'disc'] };
const SOMM_EXAMPLES = ['I feel like a fresh white wine tonight', 'Steak with salad, which wine fits?', 'Cheese fondue for four people', 'Something special for a birthday dinner under CHF 80', 'Which bottles should I open this month?'];
const CHECK_EXAMPLES = ['Is a Barolo 2019 a good choice for me?', 'Gantenbein Pinot Noir 2020', 'Château Musar 2016, does it go with lamb?'];

/* how to use the sommelier for the cellar, shown before the first question and again with Tips */
function sommGuideHtml() {
  if (SOMM.mode === 'check') return checkGuideHtml();
  if (SOMM.mode === 'list') return listGuideHtml();
  return `<div class="somm-guide">
    <h3>How to ask</h3>
    <ul>
      <li><b>Say what you feel like</b>, for example light, fruity, bold or something sparkling.</li>
      <li><b>Name the food</b> and how it is cooked: grilled steak, creamy pasta, spicy curry.</li>
      <li><b>Add the occasion</b> and how many people join, so it can suggest how many bottles.</li>
      <li><b>Set a limit</b> if you like: “under CHF 50” or “not my best bottles”.</li>
      <li><b>Ask a follow-up</b>, for example “something lighter?” or “and for dessert?”.</li>
    </ul>
    <h3>Speak or type</h3>
    <p>Tap the microphone and speak. Your words appear in the field, so you can correct them before you tap send. Nothing is sent without you.</p>
    <h3>What it knows</h3>
    <p>Your wines in stock with their drinking window, ratings, storage place and food pairings, and your recent journal with people, food and favorites. It suggests up to three wines from your cellar. Tap a wine to open it. If nothing fits, it tells you what to buy.</p>
    <p class="tiny muted">Answers come from AI and are suggestions. Each question costs a few cents.</p>
  </div>`;
}

/* how to check a wine that is not in the cellar */
function checkGuideHtml() {
  return `<div class="somm-guide">
    <h3>How it works</h3>
    <ul>
      <li><b>Photograph the label</b> or type the name, producer and vintage.</li>
      <li><b>Add the price</b> you see, for example “39 in the shop” or “85 on the wine list”. It is compared with the cheapest online shop in the country set above, in its currency and in yours.</li>
      <li><b>Ask a follow-up</b>, for example “what would I eat with it?” or “is the 2019 better?”.</li>
    </ul>
    <h3>What you get</h3>
    <p>How well the wine fits your taste in percent, based on your ratings, favorites and journal. The price in local shops next to your price, its style, and which wines in your cellar are similar, so you see if you already have something like it.</p>
    <p class="tiny muted">Answers come from AI. Each check costs about 5 cents, a little less when the wine was checked in the last 14 days.</p>
  </div>`;
}

/* shop or restaurant: a must for Will I like it?, asked again after some hours so it is not forgotten */
const WHERE_TTL = 3 * 3600e3;
const sommWhere = () => (SOMM.where && Date.now() - SOMM.whereAt < WHERE_TTL ? SOMM.where : null);
const whereRowHtml = () => { const w = sommWhere(); const b = (v, ic, label) => `<button class="${w === v ? 'on' : ''}" data-act="somm-where" data-v="${v}" aria-pressed="${w === v}">${ic}${label}</button>`;
  // in a shop the shelf price is a must, in a restaurant the menu price is optional, elsewhere there is none
  const c = countryCur(travelCountry());
  const price = w === 'shop' || w === 'restaurant' ? `<label class="where-price${w === 'shop' && !sommPrice() ? ' need' : ''}"><span>${w === 'shop' ? 'Price on the shelf' : 'Price on the menu <small>optional</small>'}</span><input id="somm-price" data-input="somm-price" inputmode="decimal" placeholder="${w === 'shop' ? 'Required' : 'If you know it'}" value="${esc(SOMM.price)}"><em>${esc(c)}</em></label>` : '';
  return `<div class="where-row${w ? '' : ' need'}" id="where-row"><span>${w ? 'You are' : 'Where are you? Choose first'}</span><div class="toggle three">${b('shop', ICON.cart, 'Shop')}${b('restaurant', ICON.dining, 'Restaurant')}${b('other', ICON.pin, 'Elsewhere')}</div>${countryBtnHtml('in')}${tzHintHtml()}${price}${redoHtml('check')}</div>`; };
const sommPrice = () => { const v = parseMoney(SOMM.price); return v && v > 0 ? v : null; };
/* the country prices are checked in, shown where you start the analysis */
const countryBtnHtml = lead => { const c = travelCountry(); return `<button class="travel-row" data-act="pick-open" data-k="travel">${ICON.pin}<span>${lead} ${flagOfCode(c)}<b>${esc(SHOP_COUNTRIES[c])}</b> · ${esc(countryCur(c))}</span><small>Change</small></button>`; };
/* the phone's time zone points to another country: offer it with one tap */
const tzHintHtml = () => {
  const c = tzMismatch();
  if (!c) return '';
  const t = travelCountry();
  return `<div class="tz-hint"><p>Your phone's time zone is in ${flagOfCode(c)}<b>${esc(SHOP_COUNTRIES[c])}</b>. Check prices there?</p><div class="tz-acts"><button class="btn accent" data-act="tz-use" data-v="${esc(c)}">Use ${esc(SHOP_COUNTRIES[c])}</button><button class="btn ghost" data-act="tz-keep" data-v="${esc(c)}">Keep ${esc(SHOP_COUNTRIES[t])}</button></div></div>`;
};
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
function priceCheckHtml(a) {
  if (!a.wine || !a.country) return '';
  const where = SHOP_COUNTRIES[a.country] || a.country, tripCur = countryCur(a.country);
  const o = a.offer || a.worldOffer, abroad = !a.offer && !!a.worldOffer;
  const rows = [];
  const resto = a.priceWhere === 'restaurant', typ = a.typical || [2, 3];
  const typText = `${fmtNum(typ[0], 1)} to ${fmtNum(typ[1], 1)}×`;
  rows.push(`<div class="row where"><span>${resto ? `${ICON.dining}At a restaurant` : a.priceWhere === 'other' ? `${ICON.pin}Elsewhere` : `${ICON.cart}In a shop`}</span></div>`);
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
        verdict = `<p class="verdict"><b class="${cls}">${label}</b> for a restaurant</p><p class="small" style="margin:0">Markup <b>${fmtNum(f, 1)}×</b> over ${ref}. Usual in ${esc(where)}: ${typText}.</p>`;
      } else {
        verdict = `<p class="small" style="margin:0"><b class="${f <= 1.05 ? 'up' : f > 1.2 ? 'down' : ''}">${f >= 1 ? `${Math.round((f - 1) * 100)}% above` : `${Math.round((1 - f) * 100)}% below`}</b> ${ref}.</p>`;
      }
    }
  } else if (o && resto) {
    // no menu price given: what would be a fair price for it in a restaurant here
    const lo = convTo(o.v * typ[0], o.cur, tripCur), hi = convTo(o.v * typ[1], o.cur, tripCur);
    if (lo && hi) verdict = `<p class="small" style="margin:0">A fair restaurant price here: <b>${esc(tripCur)} ${fmtNum(Math.round(lo), 0)} to ${fmtNum(Math.round(hi), 0)}</b>, the usual ${typText} of the shop price. Add the price on the menu for a verdict.</p>`;
  }
  const none = `No online shop in ${esc(where)} sells this wine right now`;
  const note = abroad ? `<p class="tiny muted" style="margin:0">${none}. The reference comes from a shop abroad, converted to ${esc(tripCur)}.</p>`
    : !o ? `<p class="tiny muted" style="margin:0">${none}, and no shop abroad was found either.</p>` : '';
  return `<div class="price-check">${rows.join('')}${verdict}${o ? shopLineHtml(o, tripCur, abroad) : ''}${note}</div>`;
}

function sommAnswerHtml(t) {
  const check = t.mode === 'check';
  if (t.error) return `<div class="somm-a error"><p>${esc(t.error)}</p><button class="link-btn" data-act="somm-retry">${ICON.refresh}Try again</button></div>`;
  if (!t.a) return `<div class="somm-a"><p class="somm-wait">${check ? 'Looking at this wine' : 'Looking through your cellar'}<span>.</span><span>.</span><span>.</span></p></div>`;
  const picks = (t.a.picks || []).map(p => {
    const w = wineById(p.id);
    if (!w) return '';
    const where = w.stock.map(e => placeLabel(e)).join(' · ');
    return `<div class="somm-pick"><a class="somm-pick-link" href="#/wine/${encodeURIComponent(w.id)}">${thumbHtml(w, true)}<span class="somm-pick-text">
      <span class="row-title">${esc(wineTitle(w))} ${esc(w.vintage)}</span>
      <span class="row-sub">${flagOf(w)}${esc(w.producer)}${w.count ? ` · ${w.count} btl` : ''}${check && w.myRating !== null ? ` · rated ${w.myRating}%` : ''}</span>
      ${where && !check ? `<span class="tiny muted ellipsis">${esc(where)}</span>` : ''}
      ${p.why ? `<span class="somm-why">${esc(p.why)}</span>` : ''}</span>${check ? '' : pill(w)}</a>
      ${w.count && !check ? `<button class="somm-take" data-act="minus" data-id="${esc(w.id)}">${ICON.minus}Take a bottle</button>` : ''}</div>`;
  }).join('');
  const hasFit = t.a.fit !== null && t.a.fit !== undefined;
  const fit = t.a.wine ? `<div class="somm-fit"><div class="between" style="gap:10px"><b>${esc(t.a.wine)}</b>${hasFit ? `<span class="rating-val" style="font-size:22px">${t.a.fit}%</span>` : ''}</div>
    ${hasFit ? `${segsHtml(t.a.fit, 12)}<span class="tiny muted">How well it fits your taste</span>` : ''}</div>` : '';
  const i = sommThread().indexOf(t);
  const taste = check && t.a.wine && i >= 0 ? `<div class="grid2"><button class="btn ghost" data-act="somm-preview" data-i="${i}">${ICON.magic}More about it</button><button class="btn ghost" data-act="somm-taste" data-i="${i}">${ICON.spark}I'm tasting this</button></div>` : '';
  return `<div class="somm-a">${fit}${check ? priceCheckHtml(t.a) : ''}${t.a.answer ? `<p>${esc(t.a.answer)}</p>` : ''}${taste}${picks ? `${check ? '<p class="small muted" style="margin:0">Similar wines in your cellar</p>' : ''}<div class="somm-picks">${picks}</div>` : ''}
    ${t.a.buy ? `<div class="somm-buy">${ICON.cart}<span><b>To buy</b><br>${esc(t.a.buy)}</span></div>` : ''}</div>`;
}

function sommIntroHtml() {
  if (SOMM.mode === 'check') {
    return `<div class="somm-intro">
      <div class="check-hero">
        <p style="margin:0">For wines that are <b>not in your cellar</b>: in a shop, at a restaurant or at a friend's. Photograph the label or type the name, and see if it suits you.</p>
        <label class="btn primary big block">${ICON.camera}Take a photo of the label<input type="file" accept="image/*" capture="environment" data-change="somm-photo" hidden></label>
        <label class="btn block">Choose from gallery<input type="file" accept="image/*" data-change="somm-photo" hidden></label>
      </div>
      <p class="small muted" style="margin:0">Or type it, for example:</p>
      <div class="somm-examples">${CHECK_EXAMPLES.map(x => `<button class="somm-ex" data-act="somm-example" data-v="${esc(x)}">${ICON.magic}<span>${esc(x)}</span></button>`).join('')}</div>
      ${checkGuideHtml()}</div>`;
  }
  return `<div class="somm-intro"><p class="muted">Tell me what you feel like, what you are eating or what the occasion is. I suggest wines from your cellar. Tap an example to try it.</p>
    <div class="somm-examples">${SOMM_EXAMPLES.map(x => `<button class="somm-ex" data-act="somm-example" data-v="${esc(x)}">${ICON.magic}<span>${esc(x)}</span></button>`).join('')}</div>
    ${sommGuideHtml()}
    <button class="somm-switch" data-act="somm-mode" data-v="check">${ICON.camera}<span>Looking at a wine in a shop or restaurant? <b>Will I like it?</b></span></button></div>`;
}

function sommThreadHtml() {
  if (SOMM.mode === 'list') return listHtml();
  const th = sommThread();
  if (!th.length) return sommIntroHtml();
  return (SOMM.tips ? sommGuideHtml() : '') + th.map(t => `<div class="somm-q">${t.photo ? `<img class="somm-q-photo" src="${esc(t.photo)}" alt="Label photo">` : ''}${t.q ? esc(t.q) : ''}</div>${sommAnswerHtml(t)}`).join('');
}

const sommTopHtml = () => `<a class="back" href="#/cellar">${ICON.back}Cellar</a>${SOMM.mode === 'list' ? (WL.pages.length || WL.result ? `<button class="btn ghost" style="height:40px" data-act="wl-clear">New wine list</button>` : '') : sommThread().length ? `<div style="display:flex;gap:6px"><button class="btn ghost" style="height:40px" data-act="somm-tips">${SOMM.tips ? 'Hide tips' : 'Tips'}</button><button class="btn ghost" style="height:40px" data-act="somm-clear">${SOMM.mode === 'check' ? 'New wine' : 'New question'}</button></div>` : ''}`;
const sommPlaceholder = () => (SOMM.listening ? 'Listening…' : SOMM.mode === 'list' ? 'What are you eating? (optional)' : SOMM.mode === 'check' ? (SOMM.photo ? 'Add a question, or just send' : 'Wine name and vintage') : 'What do you feel like?');
const sommLead = () => (SOMM.mode === 'check' ? 'Check a wine you see in a shop or restaurant.' : SOMM.mode === 'list' ? 'Find the best wines on a restaurant wine list.' : 'Advice from the wines in your cellar.');

function viewSommelier() {
  const r = route();
  if (r.id === 'check' || r.id === 'cellar' || r.id === 'list') SOMM.mode = r.id;
  const old = S.version && S.version < (SOMM.mode === 'cellar' ? 14 : 17);
  const check = SOMM.mode === 'check', list = SOMM.mode === 'list';
  const modeBtn = (m, ic, label) => `<button class="${SOMM.mode === m ? 'on' : ''}" data-act="somm-mode" data-v="${m}">${ic}${label}</button>`;
  return `<main class="screen somm">
    <div class="detail-top" id="somm-top">${sommTopHtml()}</div>
    <header><h1 class="title somm-title"><span class="magic-ic">${ICON.magic}</span>Sommelier</h1></header>
    <div class="toggle somm-modes three">${modeBtn('cellar', ICON.glass, 'My cellar')}${modeBtn('check', ICON.camera, 'Will I like it?')}${modeBtn('list', ICON.dining, 'Wine list')}</div>
    <p class="small muted" style="margin:-4px 0 0">${sommLead()}</p>
    ${check ? whereRowHtml() : ''}
    ${old ? '<div class="card notice"><b>Script update needed</b><p class="small" style="margin:4px 0 0">The sommelier needs the new Code.gs. Replace the script code and create a new version under Manage deployments.</p></div>' : ''}
    <div id="somm-thread" class="somm-thread">${sommThreadHtml()}</div>
  </main>
  <div class="somm-bar${check ? ' check' : ''}${list ? ' list' : ''}">
    <div id="somm-photo-box">${sommPhotoHtml()}</div>
    <div class="somm-input${SOMM.listening ? ' listening' : ''}">
      ${check ? `<label class="somm-cam" aria-label="Photo of a wine label">${ICON.camera}<input type="file" accept="image/*" capture="environment" data-change="somm-photo" hidden></label>` : ''}
      <textarea id="somm-text" data-input="somm-text" rows="1" placeholder="${sommPlaceholder()}" aria-label="Your question">${esc(SOMM.draft)}</textarea>
      <button class="somm-mic${SOMM.listening ? ' on' : ''}" data-act="somm-mic" aria-label="${SOMM.listening ? 'Stop listening' : 'Speak'}">${ICON.mic}</button>
      <button class="somm-send" data-act="somm-send" aria-label="${list ? 'Find the best wines' : 'Send'}"${SOMM.busy || (list && (WL.busy || !WL.pages.length)) ? ' disabled' : ''}>${ICON.send}</button>
    </div>
    <p id="somm-hint" class="tiny muted somm-hint">${sommHint()}</p>
  </div>`;
}

function sommRefresh(scroll) {
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

const sommHint = () => (SOMM.listening ? 'Speak now. Tap the microphone again to stop.' : SOMM.voiced ? (SOMM.mode === 'list' ? 'Check the text and correct it if needed, then tap Find the best wines.' : 'Check the text and correct it if needed, then tap send.') : '');

function listGuideHtml() {
  return `<div class="somm-guide">
    <h3>How it works</h3>
    <ul>
      <li><b>Photograph the pages</b> of the wine list you want to compare, one after the other, up to 10. Hold the phone straight and make sure the prices are sharp.</li>
      <li><b>Set your budget per bottle</b>, what you want to spend on one bottle, in the currency of the list. You can leave it empty.</li>
      <li><b>Say what you eat</b> in the field at the bottom, by typing or with the microphone. Check the text before you start.</li>
    </ul>
    <h3>What you get</h3>
    <p>Three wines from the list: the best one in your price range, the best value for money, and the hidden gem that is priced too low compared with the rest of the list. Each with the price on the list, the price in local shops, the markup of the restaurant and how well it fits your taste. Prices are shown in the currency of the list and in yours.</p>
    <p class="tiny muted">The shop prices of the three picks are checked in online shops of the country set above. One analysis costs about 10 to 20 cents. The photos are not stored.</p>
  </div>`;
}

/* is the whole list expensive for this country? its average markup against the usual one */
function listLevelHtml(res) {
  if (!res.avgMarkup) return '';
  const typ = res.typical, land = SHOP_COUNTRIES[res.country] || 'this country';
  if (!typ) return `<p class="small" style="margin:0">Average markup of this list about <b>${fmtNum(res.avgMarkup, 1)}×</b> the shop price.</p>`;
  const f = res.avgMarkup, [label, cls] = f < typ[0] ? ['Good prices', 'up'] : f <= typ[1] ? ['Fair prices', ''] : ['Expensive list', 'down'];
  return `<div class="price-check"><p class="verdict"><b class="${cls}">${label}</b> for ${esc(land)}</p><p class="small" style="margin:0">This list about <b>${fmtNum(f, 1)}×</b> the shop price, usual for restaurants in ${esc(land)}: ${fmtNum(typ[0], 1)} to ${fmtNum(typ[1], 1)}×. The markup of each pick below is compared with this list.</p></div>`;
}
function listPickHtml(p, i, cur0) {
  const [label, cls] = WL_KIND[p.kind] || ['Pick', 'disc'];
  const saved = S.wishlist.some(x => wishKey(x) === wishKey(p));
  const avg = WL.result.avgMarkup;
  // prices in the currency of the wine list, with your currency below
  const price = v => (v ? `${cur0} ${fmtNum(v, v % 1 ? 2 : 0)}` : '');
  const mine = v => { const c = v && cur0 !== cur() ? convTo(v, cur0, cur()) : null; return c ? `<small>≈ ${esc(money(c, 0))}</small>` : ''; };
  const o = p.offer || p.worldOffer, abroad = !p.offer && !!p.worldOffer;
  return `<div class="cons-card wl-card">
    <div class="between" style="gap:8px;align-items:flex-start"><span class="cons-label ${cls}">${esc(label)}</span>${p.page ? `<span class="small muted">page ${p.page}</span>` : ''}</div>
    <button class="prev-open" data-act="wl-preview" data-i="${i}"><span><span class="cons-title">${esc(wishTitle(p))}</span><span class="small muted">${countryOf(p) ? flagOf(p) : ''}${esc([p.region, p.type, p.grapes].filter(Boolean).join(' · '))}</span></span>${ICON.chevron}</button>
    <div class="wl-prices">
      <div><span>On the list</span><b>${esc(price(p.listPrice) || 'N/A')}</b>${mine(p.listPrice)}</div>
      <div><span>${abroad ? 'Shop abroad' : o ? 'In shops' : 'Shop, estimate'}</span><b>${esc(price(p.shopPrice) || 'N/A')}</b>${mine(p.shopPrice)}</div>
      <div><span>Markup</span><b class="${p.markup && avg ? (p.markup < avg ? 'up' : p.markup > avg * 1.1 ? 'down' : '') : ''}">${p.markup ? `${fmtNum(p.markup, 1)}×` : 'N/A'}</b>${avg ? `<small>list ${fmtNum(avg, 1)}×</small>` : ''}</div>
    </div>
    ${o ? shopLineHtml(o, cur0, abroad) : ''}
    ${abroad ? `<p class="tiny muted" style="margin:0">No online shop in ${esc(SHOP_COUNTRIES[WL.result.country] || 'this country')} sells this wine. Reference price from abroad, converted to ${esc(cur0)}.</p>` : !o ? `<p class="tiny muted" style="margin:0">No online shop found, in ${esc(SHOP_COUNTRIES[WL.result.country] || 'this country')} or abroad. The shop price is an AI estimate.</p>` : ''}
    ${p.why ? `<p class="small" style="margin:0">${esc(p.why)}</p>` : ''}
    ${p.food ? `<p class="small cons-value" style="margin:0">${ICON.glass}<span>${esc(p.food)}</span></p>` : ''}
    ${p.fit !== null && p.fit !== undefined ? `<div class="wl-fit"><div class="between"><span class="tiny muted">How well it fits your taste</span><b>${p.fit}%</b></div>${segsHtml(p.fit, 12)}</div>` : ''}
    <div class="cons-actions"><button class="link-btn" data-act="wl-preview" data-i="${i}">${ICON.magic}More about this wine</button><button class="link-btn" data-act="wl-taste" data-i="${i}">${ICON.spark}I'm tasting this</button><button class="link-btn" data-act="wl-save" data-i="${i}"${saved ? ' disabled' : ''}>${saved ? `${ICON.check}Saved` : `${ICON.plus}Save to wishlist`}</button></div>
  </div>`;
}

function listHtml() {
  const res = WL.result;
  const cur0 = res && res.currency ? res.currency : cur();
  const pages = WL.pages.map((pg, i) => `<div class="wl-page"><img src="${esc(pg.thumb)}" alt="Page ${i + 1}"><span>${i + 1}</span><button class="icon-btn" data-act="wl-page-rm" data-i="${i}" aria-label="Remove page ${i + 1}"${WL.busy ? ' disabled' : ''}>${ICON.x}</button></div>`).join('');
  const full = WL.pages.length >= 10;
  const wait = WL.busy
    ? `<div class="somm-a wl-wait" id="wl-wait"><p class="somm-wait">Reading ${WL.pages.length} ${WL.pages.length === 1 ? 'page' : 'pages'}, comparing the wines and checking shop prices<span>.</span><span>.</span><span>.</span></p><p class="tiny muted" style="margin:0">This takes up to a minute. Keep the app open.</p></div>` : '';
  const result = WL.busy ? ''
    : WL.error ? `<div class="somm-a error"><p>${esc(WL.error)}</p></div>`
    : res ? `<div class="wl-result">
        <p class="small muted" style="margin:0">${res.restaurant ? `${esc(res.restaurant)} · ` : ''}${res.count ? `${res.count} wines read from ${res.pages} ${res.pages === 1 ? 'page' : 'pages'}` : `${res.pages} ${res.pages === 1 ? 'page' : 'pages'} read`}${res.food ? ` · food: ${esc(res.food)}` : ''}</p>
        ${listLevelHtml(res)}
        ${res.picks.map((p, i) => listPickHtml(p, i, cur0)).join('')}
        ${res.note ? `<p class="small" style="margin:0">${esc(res.note)}</p>` : ''}
        <p class="tiny muted" style="margin:0">Quality and the average markup are AI estimates. Change the range or the food below and analyze again, or start a new wine list.</p></div>` : '';
  const setup = `<section class="wl-setup">
      <div class="sec-head"><h2>Pages</h2><span class="small muted">${WL.pages.length} of 10</span></div>
      ${WL.pages.length ? `<div class="wl-pages">${pages}</div>` : '<p class="small muted" style="margin:0">Photograph the pages of the wine list you want to compare, one after the other.</p>'}
      ${full ? '' : `<label class="btn ${WL.pages.length ? '' : 'primary big '}block">${ICON.camera}${WL.pages.length ? 'Add page' : 'Take a photo of the first page'}<input type="file" accept="image/*" capture="environment" data-change="wl-photo" hidden></label>
      <label class="btn ghost block">Choose from gallery<input type="file" accept="image/*" multiple data-change="wl-photo" hidden></label>`}
      <div class="sec-head" style="margin-top:6px"><h2>Your budget per bottle</h2><span class="small muted">optional</span></div>
      <p class="small muted" style="margin:-4px 0 0">How much you want to spend on one bottle, in ${esc(countryCur(travelCountry()))} as on the list. The best wine within it becomes your first pick, <b>Best in your range</b>. Leave it empty for no limit.</p>
      <div class="wl-range"><label class="field">From<input inputmode="decimal" data-input="wl-min" placeholder="No minimum" value="${esc(WL.min)}"></label><label class="field">To<input inputmode="decimal" data-input="wl-max" placeholder="No limit" value="${esc(WL.max)}"></label></div>
      <p class="small muted" style="margin:0">Say what you eat in the field below, then tap the button.</p>
      <div class="wl-country">${countryBtnHtml('Restaurant in')}${tzHintHtml()}${redoHtml('list')}</div>
      ${wait}
      <button class="btn accent big block" data-act="wl-go"${WL.busy || !WL.pages.length ? ' disabled' : ''}>${ICON.magic}${res ? 'Analyze again' : 'Find the best wines'}</button>
    </section>`;
  return `${result}${setup}${res || WL.busy ? '' : listGuideHtml()}`;
}

async function listAnalyze(foodAgain) {
  if (WL.busy || !WL.pages.length) { if (!WL.pages.length) toast('Take a photo of at least one page first.'); return; }
  // pages kept from an earlier session are only previews: a new analysis needs the photos again
  if (WL.pages.some(pg => !pg.b64)) { WL.pages = WL.pages.filter(pg => pg.b64); toast('Take the photos of the wine list again for a new analysis.'); sommRefresh(false); return; }
  if (SOMM.listening) sommStopVoice();
  const ta = $('#somm-text');
  const food = foodAgain !== undefined ? str(foodAgain).trim() : str(ta ? ta.value : SOMM.draft).trim();
  SOMM.redo = '';
  WL.busy = true;
  WL.error = '';
  WL.result = null;
  SOMM.voiced = false;
  sommRefresh(false);
  const w = $('#wl-wait');
  if (w) w.scrollIntoView({ behavior: 'smooth', block: 'center' });
  try {
    WL.result = await api('winelist', { country: travelCountry(), pages: WL.pages.map(pg => pg.b64), min: Number(String(WL.min).replace(',', '.')) || 0, max: Number(String(WL.max).replace(',', '.')) || 0, food });
  } catch (e) {
    WL.error = /Unknown action/i.test(e.message) ? 'The wine list needs the new Code.gs. Update the script, then try again.' : aiErr(e.message);
  }
  WL.busy = false;
  sommSave();
  sommRefresh(false);
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
    price: p.shopPrice, priceCur: res.currency || cur(), label: 'Wine list', why, createdAt: new Date().toISOString() });
  S.wishlist.push(x);
  persist();
  sommRefresh(false);
  try {
    await api('saveWish', { wish: Object.assign({}, x, { offer: '' }) });
    toast('Saved to your wishlist');
  } catch (e) {
    S.wishlist = S.wishlist.filter(w => w.id !== x.id);
    persist();
    sommRefresh(false);
    toast('Not saved: ' + e.message);
  }
}

const sommPhotoHtml = () => (SOMM.photo ? `<div class="somm-photo"><img src="${esc(SOMM.photo.thumb)}" alt="Label photo"><span class="small">Label photo ready. Add a question, or just send.</span><button class="icon-btn" data-act="somm-photo-rm" aria-label="Remove photo">${ICON.x}</button></div>` : '');

async function sommAsk(text, photo) {
  const q = str(text).trim();
  const img = photo || SOMM.photo;
  if ((!q && !img) || SOMM.busy) return;
  if (SOMM.listening) sommStopVoice();
  const mode = img ? 'check' : SOMM.mode;
  if (mode === 'check' && !sommWhere()) {
    if (SOMM.mode !== 'check') { SOMM.mode = 'check'; history.replaceState(null, '', '#/sommelier/check'); render(); }
    const row = $('#where-row');
    if (row) { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
    toast('Choose Shop, Restaurant or Elsewhere first. Prices are judged differently.');
    return;
  }
  if (mode === 'check' && sommWhere() === 'shop' && !sommPrice()) {
    const inp = $('#somm-price');
    if (inp) { inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); inp.focus(); }
    toast(str(SOMM.price).trim() ? 'The shelf price needs a number, for example 45.90.' : 'Enter the shelf price to compare.');
    return;
  }
  if (mode !== SOMM.mode) { SOMM.mode = mode; history.replaceState(null, '', '#/sommelier/' + mode); render(); }
  const th = SOMM.threads[mode];
  const history = th.filter(t => t.a).slice(-3).map(t => ({ q: t.q || (t.a.wine ? `Will I like this wine? (label photo of ${t.a.wine})` : 'Will I like this wine?'), a: JSON.stringify(t.a) }));
  const turn = { q, a: null, error: '', photo: img ? img.thumb : '', img, mode };
  th.push(turn);
  SOMM.photo = null;
  const pb = $('#somm-photo-box');
  if (pb) pb.innerHTML = '';
  SOMM.draft = '';
  SOMM.voiced = false;
  SOMM.busy = true;
  SOMM.tips = false;
  sommRefresh(true);
  try {
    const where = mode === 'check' ? sommWhere() : '';
    const price = where === 'shop' || where === 'restaurant' ? sommPrice() : null;
    turn.where = where; turn.price = price;
    if (mode === 'check' && SOMM.redo) { SOMM.redo = ''; const row = $('#where-row'); if (row) row.outerHTML = whereRowHtml(); }
    turn.a = await api('sommelier', { question: q, history, image: img ? img.b64 : null, mode, country: mode === 'check' ? travelCountry() : '', where, price, priceCur: price ? countryCur(travelCountry()) : '' });
    if (mode === 'check') { SOMM.price = ''; const row = $('#where-row'); if (row) row.outerHTML = whereRowHtml(); }   // the next wine has its own price
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
    t.a = await api('sommelier', { question: q, history, image: t.img ? t.img.b64 : null, mode: 'check', country: c, where, price, priceCur: price ? countryCur(c) : '' });
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
  const turns = m => (SOMM.threads[m] || []).filter(t => t.a || t.error).slice(-20).map(t => ({ q: t.q, a: t.a, error: t.error, photo: t.photo || '', mode: t.mode, where: t.where || '', price: t.price || null }));
  const data = { threads: { cellar: turns('cellar'), check: turns('check') }, mode: SOMM.mode, where: SOMM.where, whereAt: SOMM.whereAt,
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
  if (['cellar', 'check', 'list'].includes(d.mode)) SOMM.mode = d.mode;
  if (d.where) { SOMM.where = d.where; SOMM.whereAt = Number(d.whereAt) || 0; }
  if (d.wl) { WL.result = d.wl.result || null; WL.min = str(d.wl.min); WL.max = str(d.wl.max); WL.pages = Array.isArray(d.wl.pages) ? d.wl.pages : []; }
}

function sommStartVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Voice input is not available here. Use the microphone on your keyboard instead.', 5000); $('#somm-text').focus(); return; }
  const rec = new SR();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  const base = SOMM.draft ? SOMM.draft.trim() + ' ' : '';
  rec.onresult = e => {
    let txt = '';
    for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
    SOMM.draft = base + txt.trim();
    SOMM.voiced = true;
    sommRefresh(false);
  };
  rec.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Allow the microphone for this app to speak your question.', 5000);
    else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Voice input stopped. Try again or type your question.');
  };
  rec.onend = () => { SOMM.listening = false; SOMM.rec = null; sommRefresh(false); const ta = $('#somm-text'); if (ta && SOMM.draft) ta.focus(); };
  try { rec.start(); } catch (e) { toast('Voice input could not start.'); return; }
  SOMM.rec = rec;
  SOMM.listening = true;
  sommRefresh(false);
}

/* the wishes for the consultant by voice: the text lands in the field, where you can check and correct it before sending */
function consVoiceUi() {
  const b = $('#cons-mic'), h = $('#cons-mic-hint');
  if (b) { b.classList.toggle('on', CONS.listening); b.setAttribute('aria-label', CONS.listening ? 'Stop listening' : 'Speak'); }
  if (h) h.textContent = CONS.listening ? 'Listening. Speak your wishes, then check the text before you tap the button.' : 'Tap the microphone to speak. You can correct the text before you send it.';
}
function consStopVoice() {
  if (CONS.rec) { try { CONS.rec.stop(); } catch (e) { /* already stopped */ } }
  CONS.listening = false;
  consVoiceUi();
}
function consStartVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Voice input is not available here. Use the microphone on your keyboard instead.', 5000); const ta = $('#cons-note'); if (ta) ta.focus(); return; }
  const rec = new SR();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  const ta0 = $('#cons-note');
  if (ta0) CONS.note = ta0.value;
  const base = CONS.note.trim() ? CONS.note.trim() + ' ' : '';
  rec.onresult = e => {
    let txt = '';
    for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
    CONS.note = base + txt.trim();
    const ta = $('#cons-note');
    if (ta) ta.value = CONS.note;
  };
  rec.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Allow the microphone for this app to speak your wishes.', 5000);
    else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Voice input stopped. Try again or type your wishes.');
  };
  rec.onend = () => { CONS.listening = false; CONS.rec = null; consVoiceUi(); const ta = $('#cons-note'); if (ta && CONS.note) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } };
  try { rec.start(); } catch (e) { toast('Voice input could not start.'); return; }
  CONS.rec = rec;
  CONS.listening = true;
  consVoiceUi();
}

function sommStopVoice() {
  if (SOMM.rec) { try { SOMM.rec.stop(); } catch (e) { /* already stopped */ } }
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
  return {
    id: str(x.id), producer: str(x.producer), name: str(x.name), vintage: str(x.vintage), type: str(x.type), region: str(x.region), grapes: str(x.grapes),
    price: numOrNull(x.price), priceCur: str(x.priceCur) || cur(), label: str(x.label), why: str(x.why), value: str(x.value),
    qty: numOrNull(x.qty), replaces: str(x.replaces), offer: offer && offer.shop ? offer : null, createdAt: str(x.createdAt)
  };
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
  const opened = S.removals.filter(r => r.dir === 'out' && r.type !== 'Sale' && r.type !== 'Gift');
  const recent = opened.filter(r => str(r.date) >= since);
  const qty = r => Number(r.qty) || 1;
  // bottles ever owned per wine: purchases and gifts in, otherwise the stock plus what went out
  const owned = w => { const ins = inEntries(w).reduce((a, r) => a + qty(r), 0); return ins || w.count + S.removals.filter(r => r.wineId === w.id && r.dir === 'out').reduce((a, r) => a + qty(r), 0); };
  const all = S.wines.map(w => ({ w, n: owned(w) })).filter(x => x.n > 0);
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
  const top = rated.filter(w => w.myRating >= 85).slice(0, 4);
  const low = rated.filter(w => w.myRating < 75).slice(-3);
  const tagM = new Map();
  rated.filter(w => w.myRating >= 85).forEach(w => w.tasteTags.forEach(t => { const k = lc(t); tagM.set(k, (tagM.get(k) || 0) + 1); }));
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
  lines.push(['Drinking', perMonth ? `about ${fmtNum(perMonth, 1)} bottles per month${occ.length ? `, mostly ${occ.join(' and ').toLowerCase()}` : ''}` : 'no bottles opened in the last 12 months']);
  const text = [
    ...lines.map(l => `${l[0]}: ${l[1]}`),
    low.length ? `Rated lowest: ${low.map(w => `${fullName(w)} ${w.myRating}%`).join(', ')}` : '',
    'Stock compared with drinking over the last 12 months:',
    ...cover.map(c => `${c.t}: ${btl(c.stock)} in stock, ${c.used} opened in 12 months${c.months !== null ? `, lasts about ${c.months} months` : ''}`)
  ].filter(Boolean).join('\n');
  const round5 = v => Math.max(5, Math.round(v / 5) * 5);
  return { lines, cover, text, budget: p50 !== null ? { min: round5(p25 * 0.8), max: round5(p75 * 1.2) } : { min: '', max: '' } };
}

function offerLineHtml(o, qty) {
  return `<div class="cons-offer-box"><div class="cons-offer">${offerShopHtml(o, null)}
    <a class="btn accent offer-btn" href="${esc(o.url)}" target="_blank" rel="noopener">${esc(priceText(o.v, o.cur))}${ICON.link}</a></div>${offerShipHtml(o, qty)}</div>`;
}

function pickCardHtml(p, i, saved) {
  const key = wishKey(p);
  const rw = p.replaces ? wineById(p.replaces) : null;
  const o = CONS.offers[key];
  const busyO = CONS.offerRun.has(key);
  const c = countryOf(p);
  return `<div class="cons-card">
    <div class="between" style="gap:8px;align-items:flex-start"><span class="cons-label ${LABEL_CLS[p.label] || 'disc'}">${esc(consLabel(p.label))}</span>${p.price && !o ? `<span class="small muted">≈ ${esc(priceText(p.price, p.priceCur || cur()))}</span>` : ''}</div>
    <div><p class="cons-title">${esc(wishTitle(p))}</p><p class="small muted" style="margin:2px 0 0">${c ? flagOf(p) : ''}${esc([p.region, p.type, p.grapes].filter(Boolean).join(' · '))}</p></div>
    ${p.why ? `<p class="small" style="margin:0">${esc(p.why)}</p>` : ''}
    ${p.value ? `<p class="small cons-value" style="margin:0">${ICON.cash}<span>${esc(p.value)}</span></p>` : ''}
    <p class="small" style="margin:0"><b>Buy ${p.qty || 1} ${p.qty === 1 ? 'bottle' : 'bottles'}</b>${rw ? ` · replaces <a href="#/wine/${encodeURIComponent(rw.id)}">${esc(wineTitle(rw))} ${esc(rw.vintage)}</a> (${rw.count} left)` : ' · new addition'}</p>
    ${rw && p.replaceWhy ? `<p class="tiny muted" style="margin:-4px 0 0">${esc(p.replaceWhy)}</p>` : ''}
    ${o ? offerLineHtml(o, p.qty) : ''}
    <div class="cons-actions"><button class="link-btn" data-act="cons-preview" data-i="${i}">${ICON.magic}More about this wine</button><button class="link-btn" data-act="cons-offer" data-i="${i}"${busyO ? ' disabled' : ''}>${ICON.refresh}${busyO ? 'Searching…' : o ? 'Update best offer' : 'Find best offer'}</button>
      <button class="link-btn" data-act="cons-save" data-i="${i}"${saved ? ' disabled' : ''}>${saved ? `${ICON.check}Saved` : `${ICON.plus}Save to wishlist`}</button></div>
  </div>`;
}

function wishCardHtml(x) {
  const busyO = CONS.offerRun.has('wish:' + x.id);
  return `<div class="cons-card">
    <div class="between" style="gap:8px;align-items:flex-start"><span class="cons-label ${LABEL_CLS[x.label] || 'disc'}">${esc(consLabel(x.label) || 'Wishlist')}</span>${x.price ? `<span class="small muted">≈ ${esc(priceText(x.price, x.priceCur))}</span>` : ''}</div>
    <div><p class="cons-title">${esc(wishTitle(x))}</p><p class="small muted" style="margin:2px 0 0">${countryOf(x) ? flagOf(x) : ''}${esc([x.region, x.type].filter(Boolean).join(' · '))}${x.qty ? ` · buy ${x.qty}` : ''}</p></div>
    ${x.why ? `<p class="small" style="margin:0">${esc(x.why)}</p>` : ''}
    ${x.offer ? offerLineHtml(x.offer, x.qty || 6) : ''}
    <div class="cons-actions"><button class="link-btn" data-act="wish-preview" data-id="${esc(x.id)}">${ICON.magic}More about this wine</button><button class="link-btn" data-act="wish-offer" data-id="${esc(x.id)}"${busyO ? ' disabled' : ''}>${ICON.refresh}${busyO ? 'Searching…' : x.offer ? 'Update best offer' : 'Find best offer'}</button>
      <button class="link-btn" data-act="wish-add" data-id="${esc(x.id)}">${ICON.plus}Add to cellar</button>
      <button class="icon-btn" data-act="wish-del" data-id="${esc(x.id)}" aria-label="Remove from wishlist">${ICON.trash}</button></div>
  </div>`;
}

function viewDiscover() {
  const prof = tasteProfile();
  if (!CONS.budget) CONS.budget = prof.budget;
  const old = S.version && S.version < 12;
  const savedKeys = new Set(S.wishlist.map(wishKey));
  const res = CONS.result;
  const cover = prof.cover.length ? `<div class="cons-cover"><div class="cons-cover-row head"><span>Type</span><span>In stock</span><span>Opened</span><span>Lasts</span></div>
    ${prof.cover.map(c => `<div class="cons-cover-row"><span><span class="sw" style="background:${TYPE_CHART[c.t] || OTHER_C}"></span>${esc(c.t)}</span><span>${c.stock}</span><span>${c.used}</span><span>${c.months === null ? 'n/a' : c.months > 99 ? '99+ mo.' : `${c.months} mo.`}</span></div>`).join('')}</div>` : '';
  return `<main class="screen has-nav discover">
    <div class="detail-top"><a class="back" href="#/insights">${ICON.back}Insights</a></div>
    <header><h1 class="title somm-title"><span class="magic-ic">${ICON.magic}</span>Consultant</h1></header>
    ${old ? '<div class="card notice"><b>Script update needed</b><p class="small" style="margin:4px 0 0">The consultant needs the new Code.gs. Replace the script code and create a new version under Manage deployments.</p></div>' : ''}
    <section class="ins-sec" style="border-top:0;padding-top:0"><div class="sec-head"><h2>Your profile</h2></div>
      <p class="small muted" style="margin:0">Calculated in the app from your stock, finished wines, ratings, journal and purchase prices. The consultant bases its suggestions on it.</p>
      <div class="info-list">${prof.lines.map(l => infoRowWide(l[0], l[1])).join('')}</div>
      <p class="small muted" style="margin:6px 0 0">Stock compared with what you drank in the last 12 months</p>${cover}
    </section>
    <section class="ins-sec"><div class="sec-head"><h2>What are you looking for?</h2></div>
      <div class="chips">${CONS_FOCUS.map(f => `<button class="chip${CONS.focus === f ? ' on' : ''}" data-act="cons-focus" data-v="${esc(f)}">${esc(f)}</button>`).join('')}</div>
      <div class="grid2"><label class="field">Budget from (${esc(cur())})<input inputmode="numeric" data-input="cons-min" value="${esc(CONS.budget.min)}"></label><label class="field">to (${esc(cur())})<input inputmode="numeric" data-input="cons-max" value="${esc(CONS.budget.max)}"></label></div>
      <div class="field"><label for="cons-note">Anything else? (optional)</label><div class="note-voice"><textarea id="cons-note" data-input="cons-note" rows="2" placeholder="Type or speak, for example more whites for summer, wines for guests">${esc(CONS.note)}</textarea><button class="somm-mic${CONS.listening ? ' on' : ''}" id="cons-mic" data-act="cons-mic" aria-label="${CONS.listening ? 'Stop listening' : 'Speak'}">${ICON.mic}</button></div>
        <span class="tiny muted" id="cons-mic-hint">${CONS.listening ? 'Listening. Speak your wishes, then check the text before you tap the button.' : 'Tap the microphone to speak. You can correct the text before you send it.'}</span></div>
      <button class="btn primary big block" data-act="cons-run"${CONS.busy || old ? ' disabled' : ''}>${ICON.magic}${CONS.busy ? 'Choosing wines and checking shops…' : res ? 'Get new recommendations' : 'Get recommendations'}</button>
      <p class="tiny muted" style="margin:0">${CONS.busy ? 'This takes about a minute. Every suggestion is checked in online shops for ' + esc(shopCountryName()) + ', so you only get wines you can buy.' : 'You only get wines that an online shop for ' + esc(shopCountryName()) + ' sells right now, with price and link. One round takes about a minute and costs about 15 to 20 cents, less when offers from the last 14 days can be reused.'}</p>
    </section>
    ${CONS.error ? `<p class="small" style="color:var(--danger);margin:0">${esc(CONS.error)}</p>` : ''}
    ${res ? `<section class="ins-sec"><div class="sec-head"><h2>Recommendations</h2></div>${res.summary ? `<p style="margin:0;line-height:1.5">${esc(res.summary)}</p>` : ''}
      <div class="cons-list">${res.picks.map((p, i) => pickCardHtml(p, i, savedKeys.has(wishKey(p)))).join('')}</div></section>` : ''}
    <section class="ins-sec"><div class="sec-head"><h2>Wishlist</h2>${S.wishlist.length ? `<span class="muted small">${S.wishlist.length}</span>` : ''}</div>
      ${S.wishlist.length ? `<div class="cons-list">${S.wishlist.map(wishCardHtml).join('')}</div>` : '<p class="small muted" style="margin:0">Save suggestions here. When you buy one, Add to cellar opens the form with its details.</p>'}
    </section>
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
  const h = [...document.querySelectorAll('.discover h2')].find(x => x.textContent === 'Recommendations');
  if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

async function consSave(p) {
  const x = normWish(Object.assign({}, p, { id: newId('x'), offer: CONS.offers[wishKey(p)] || null, createdAt: new Date().toISOString() }));
  S.wishlist.push(x);
  persist();
  refreshView();
  try {
    await api('saveWish', { wish: Object.assign({}, x, { offer: x.offer ? JSON.stringify(x.offer) : '' }) });
    toast('Saved to your wishlist');
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
  openDiscovery(x, { venue: a.priceWhere || sommWhere() || '', price: a.price || '', priceCur: a.price ? a.priceCur : countryCur(a.country || travelCountry()), shopRef: o ? { v: o.v, cur: o.cur } : null, offer: a.offer || null });
}
function listTaste(i) {
  const res = WL.result, p = res && res.picks[i];
  if (!p) return;
  openDiscovery({ producer: p.producer, name: p.name, vintage: p.vintage ? String(p.vintage) : '', type: p.type, region: p.region, grapes: p.grapes },
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
  const x = Object.assign({}, base, d || {});
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
  const body = PREV.busy
    ? `<div class="info-wait"><p class="somm-wait">Loading taste profile and drinking window<span>.</span><span>.</span><span>.</span></p><p class="tiny muted" style="margin:0">Only for the wines you open, about 1 to 2 cents. Kept on your phone.</p></div>`
    : PREV.error ? `<p class="small" style="margin:0;color:var(--danger)">${esc(PREV.error)}</p>`
    : d ? `${p ? section('Drinking window', `<span class="small" style="color:${STATUS[s].c};font-weight:500;margin-top:-6px">${statusLine(w)}</span>${timelineHtml(w, true)}<div class="scale" style="margin-top:4px"><span>${p.f}</span><span style="color:var(--text)">Today</span><span>${p.u}</span></div>`) : ''}
        <section style="gap:16px"><h2>Profile</h2>${grapeRingHtml(w)}${axesHtml(w)}${aromasHtml(w)}
          ${w.taste ? `<div class="kv"><span>Taste</span><p style="line-height:1.5">${esc(w.taste)}</p></div>` : ''}
          ${w.tasteTags.length ? `<div class="kv"><span>Style</span><p class="style-line">${w.tasteTags.map(t => esc(cap(t))).join(' · ')}</p></div>` : ''}
          ${foodTilesHtml(w)}</section>
        ${aboutHtml(w)}
        <p class="tiny muted" style="margin:0">Written by AI from its knowledge. Tap region, style or producer for the background.</p>` : '';
  const k = PREV.src && PREV.src.kind;
  const wished = S.wishlist.some(x => wishKey(x) === wishKey(PREV.base));
  const buttons = `<div class="grid2">${k === 'wish' ? `<button class="btn" data-act="prev-cellar">${ICON.plus}Add to cellar</button>` : `<button class="btn" data-act="prev-wish"${wished ? ' disabled' : ''}>${wished ? `${ICON.check}On your wishlist` : `${ICON.plus}Save to wishlist`}</button>`}<button class="btn primary" data-act="prev-taste">${ICON.spark}I'm tasting this</button></div>`;
  const inner = `<div class="between" style="align-items:flex-start;gap:12px">
      <div class="info-head"><span class="ab-ic">${c ? `<span class="ab-flag">${flagEmoji(c.code)}</span>` : ICON.glass}</span><div><span class="tiny muted" style="text-transform:uppercase;letter-spacing:.06em">${esc([w.type, w.vintage].filter(Boolean).join(' · ') || 'Wine')}</span><h2>${esc(wineTitle(w))}</h2><p class="small muted" style="margin:2px 0 0">${esc([w.producer !== wineTitle(w) ? w.producer : '', w.region].filter(Boolean).join(' · '))}</p></div></div>
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
  openPreview({ producer: p.producer, name: p.name, vintage: p.vintage ? String(p.vintage) : '', type: p.type, region: p.region, grapes: p.grapes }, esc(p.why || ''), { kind: 'list', i });
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
    price: o ? o.v : '', priceCur: o ? o.cur : cur(), label: 'Will I like it?', why: a.fit ? `Fits your taste ${a.fit}%. ${a.answer || ''}`.trim() : str(a.answer), createdAt: new Date().toISOString() });
  S.wishlist.push(x);
  persist();
  try { await api('saveWish', { wish: Object.assign({}, x, { offer: a.offer ? JSON.stringify(a.offer) : '' }) }); toast('Saved to your wishlist'); }
  catch (e) { S.wishlist = S.wishlist.filter(w => w.id !== x.id); persist(); toast('Not saved: ' + e.message); }
}

sommLoad();
