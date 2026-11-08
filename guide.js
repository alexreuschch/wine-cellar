/* ---------------------------------------------------------------- the guide: Home, the first setup and one-time tips */

/* ------------------------------------------------ one-time tips on the spot, kept on this phone */
const TIPS = {
  'som-cellar': ['Sommelier, My cellar', 'Say what you eat or what you feel like. The sommelier picks the best bottles from your cellar and tells you why.', 'Each question costs a few cents.'],
  'som-check': ['Will I like it?', 'For a wine that is <b>not in your cellar</b>: how well it fits your taste, how it goes with your food and what a fair price is. Follow the four steps from top to bottom.', 'One check costs about 5 cents.'],
  'som-list': ['Wine list', 'Photograph the pages of a restaurant wine list. You get the best wine in your price range, the best value and a hidden gem, each with the markup of the restaurant.', 'One analysis costs about 10 to 20 cents.'],
  consultant: ['Consultant', 'Suggests wines to add to your cellar, based on your stock, your ratings and what you drink, with sensible quantities and the best shop price.', 'One round costs about 15 to 20 cents.'],
  'top-ext': ['External ratings', 'Published scores of your wines from critics and guides. The gold symbol at the top looks them up for the wines you see.', 'About 3 to 4 cents per wine.'],
  'journal-ai': ['Journal Assistant', 'Ask about your journal in your own words, for example what you drank with Anna or which wines you bought at Gerstl.', 'Each question costs a few cents.'],
  wine: ['Your wine', 'Tap region, grape or producer for its background. Further down: the drinking window, prices in shops and the best offer.', ''],
  places: ['Places', 'Your bottles by location and shelf. <b>Check this place</b> compares the counts with what really lies there, <b>Move bottles</b> brings many bottles to another place at once.', ''],
  insights: ['Insights', 'Tap a row or a column to see its wines. At the bottom you find your orders and the wishlist, with who recommended a wine.', '']
};
const tipState = () => { const v = store.get('wc-tips', null); return v && typeof v === 'object' ? { off: !!v.off, seen: Array.isArray(v.seen) ? v.seen : [] } : { off: false, seen: [] }; };
function tipHtml(k) {
  const t = TIPS[k], st = tipState();
  if (!t || st.off || st.seen.includes(k)) return '';
  return `<div class="gd-tip" data-tip="${k}"><b class="gd-tip-h">${ICON.magic}${t[0]}</b><p>${t[1]}</p>${t[2] ? `<p class="tiny muted">${t[2]}</p>` : ''}
    <div class="between"><span class="tiny muted">Tips can be turned off in Settings.</span><button class="btn primary gd-ok" data-act="tip-ok" data-k="${k}">Got it</button></div></div>`;
}

/* ------------------------------------------------ Home: a short status and what you can do */
const gdStarted = () => [
  ['place', LOC_ICON.fridge, 'Set up your first storage place', 'Where your bottles lie and how many fit in.', S.locations.length > 0],
  ['taste', ICON.magic, 'Learn my taste', 'A short test of what you like. Sommelier and consultant then fit you much better.', !!S.tasteTest],
  ['wine', ICON.camera, 'Add a wine with a photo', 'Photograph the label, the app fills in the rest.', S.wines.some(w => !isDisc(w))]
];
const GD_DAILY = [
  ['#/sommelier/cellar', ICON.glass, 'Find a wine from my cellar for tonight', 'Say what you eat, the sommelier picks from your bottles.'],
  ['#/sommelier/check', ICON.camera, 'Will I like this wine, is the price fair?', 'In a shop or a restaurant, before you buy or order.'],
  ['#/sommelier/list', ICON.dining, 'Choose from a restaurant wine list', 'Photograph the list, get the best three for you.'],
  ['#/discover', ICON.cart, 'What should I buy next?', 'The consultant suggests wines with sensible quantities.'],
  ['ext', ICON.trophy, 'Update the external ratings', 'Published scores of your wines, looked up for you.'],
  ['#/journal-ai', ICON.book, 'Ask my journal', 'For example: what did we drink with Anna?']
];
const gdRow = (attrs, ic, t, s, done) => `<a class="gd-row${done ? ' done' : ''}" ${attrs}><span class="gd-ic">${done ? ICON.check : ic}</span><span class="t"><b>${t}</b><small>${s}</small></span>${ICON.chevron}</a>`;

function viewHome() {
  const own = S.wines.filter(w => !isDisc(w));
  const btl = own.reduce((a, w) => a + w.count, 0);
  const soon = own.filter(w => w.count > 0 && statusOf(w) === 'Drink soon').length;
  const past = own.filter(w => w.count > 0 && statusOf(w) === 'Past its window').length;
  const late = S.orders.filter(orderOverdue).length;
  // in the colours used everywhere: the status of the drinking window, red for an overdue delivery
  const chip = (attrs, n, label, c) => `<a ${attrs}${c ? ` class="tone" style="--c:${c}"` : ''}><b>${n}</b> ${label}</a>`;
  const stat = [chip('href="#/cellar"', btl, btl === 1 ? 'bottle' : 'bottles'),
    past ? chip('data-act="gd-window" data-v="Past its window"', past, 'past their window', STATUS['Past its window'].c) : '',
    soon ? chip('data-act="gd-window" data-v="Drink soon"', soon, 'to drink soon', STATUS['Drink soon'].c) : '',
    late ? chip('data-act="go-orders"', late, late === 1 ? 'delivery overdue' : 'deliveries overdue', '#E06C6C') : ''].join('');
  const st = gdStarted();
  const started = st.every(x => x[4]) ? '' : `<h3 class="gd-h">Get started</h3>${st.map(([k, ic, t, s, done]) => gdRow(`href="#/home" data-act="gd-start" data-k="${k}"`, ic, t, s, done)).join('')}`;
  const daily = GD_DAILY.map(([h, ic, t, s]) => gdRow(h === 'ext' ? 'href="#/top" data-act="gd-ext"' : `href="${h}"`, ic, t, s)).join('');
  return `<main class="screen has-nav home">
    <header class="top"><h1 class="title home-title"><img src="icon-192.png" alt="" width="34" height="34">Vintary</h1>
      <div class="top-actions"><button class="icon-btn" data-act="refresh" aria-label="Refresh">${ICON.refresh}</button><a class="icon-btn" href="#/settings" aria-label="Settings">${ICON.gear}</a></div></header>
    <div class="hm-stat">${stat}</div>
    <h2 class="home-q">What would you like to do?</h2>
    ${started}
    <h3 class="gd-h">Every day</h3>${daily}
  </main>${nav('home')}`;
}

/* ------------------------------------------------ the first setup: country, storage place, notifications, first wine */
const GS = { step: 1, only: false, type: 'fridge', name: '', cap: '' };
const gdSetupDone = () => store.get('wc-setup', '') === 'done';
function gdFinish() { store.set('wc-setup', 'done'); GS.step = 1; GS.only = false; go('#/home', true); }
function gdNext() {
  if (GS.only || GS.step >= 4) { if (GS.only) { GS.only = false; GS.step = 1; go('#/home', true); } else gdFinish(); return; }
  GS.step += 1;
  render(); window.scrollTo(0, 0);
}

function viewSetup() {
  const n = GS.step;
  const bar = GS.only ? '' : `<div class="between"><span class="gd-sub">Step ${n} of 4</span><button class="link-btn" data-act="gd-skip">Skip</button></div>
    <div class="gd-steps">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;
  let title, text, body, next = 'Next';
  if (n === 1) {
    title = 'Where are you based?';
    text = 'Prices, shops and restaurant markups are looked up for this country, and amounts are shown in its currency. You can change both any time in Settings.';
    body = `<div class="field">Country for shopping<button class="pick-btn" data-act="pick-open" data-k="country"><span class="ellipsis">${flagOfCode(shopCountry())}${esc(shopCountryName())}</span>${ICON.chevron}</button></div>
      <div class="field">Currency<button class="pick-btn" data-act="pick-open" data-k="currency"><span class="ellipsis">${esc(cur())} · ${esc(GEO_CURRENCIES[cur()] || '')}</span>${ICON.chevron}</button></div>
      <p class="gd-sub">Travelling? The sommelier asks for the country where you are.</p>`;
  } else if (n === 2) {
    title = 'Your first storage place';
    text = 'Where do your bottles lie? You can add more places later in Settings. The app shows where each bottle is and how much room is left.';
    body = `<div class="gd-types">${LOC_TYPES.filter(t => t[0] !== 'short').map(([k, l]) => `<button class="gd-type${GS.type === k ? ' on' : ''}" data-act="gd-type" data-v="${k}" aria-pressed="${GS.type === k}">${LOC_ICON[k] || ICON.pin}${esc(l)}</button>`).join('')}</div>
      <label class="field">Name<input data-input="gd-name" value="${esc(GS.name || LOC_TYPE_NAME[GS.type] || '')}" autocapitalize="words" enterkeyhint="next"></label>
      <label class="field">About how many bottles fit in?<input data-input="gd-cap" inputmode="numeric" pattern="[0-9]*" placeholder="For example 40" value="${esc(GS.cap)}"></label>
      ${S.locations.length ? `<p class="gd-sub">You already have: ${esc(S.locations.join(', '))}.</p>` : ''}`;
    next = GS.only ? 'Save' : 'Next';
  } else if (n === 3) {
    title = 'Stay up to date';
    text = 'A short email on the first of the month, only when there is something to report, and small badges in the menu.';
    body = notifyHtml();
  } else {
    title = 'Your first wine';
    text = 'Photograph the label. The app reads producer, wine and vintage and fills in the rest: grapes, drinking window, taste and prices.';
    body = `<a class="gd-big" href="#/add" data-act="gd-add">${ICON.camera}<b>Take a photo of the label</b><span class="gd-sub">or choose one from the gallery</span></a>`;
    next = 'Done';
  }
  return `<main class="screen setup">
    ${bar}
    <h1 class="title" style="margin:6px 0 0">${title}</h1>
    <p class="gd-text">${text}</p>
    ${body}
    <div class="grid2" style="margin-top:6px"><button class="btn" data-act="gd-back">${n === 1 || GS.only ? 'Later' : 'Back'}</button><button class="btn primary" data-act="gd-next">${next}</button></div>
  </main>`;
}

/* the storage place of step 2, saved when you go on */
async function gdSavePlace() {
  const name = str(GS.name || LOC_TYPE_NAME[GS.type] || '').replace(/\s+/g, ' ').trim();
  const cap = Math.round(Number(String(GS.cap).replace(/[^0-9]/g, ''))) || null;
  if (!name) return;
  const info = { capacity: cap, kind: 'cellar', type: GS.type, zones: [], owc: false };
  const isNew = !S.locations.some(l => lc(l) === lc(name));
  if (isNew) S.locations.push(name);
  S.locInfo[lc(name)] = Object.assign({}, locInfoOf(name), info);
  persist();
  try {
    if (isNew) S.locations = await api('addLocation', { name });
    const saved = await api('setLocationInfo', Object.assign({ name }, info));
    if (saved) S.locInfo[lc(name)] = locInfoNorm(Object.assign({}, info, saved));
    persist();
  } catch (e) { toast('The storage place was not saved: ' + e.message, 5000); }
}

/* ------------------------------------------------ Settings: the guide */
function guideSettingsHtml() {
  const st = tipState();
  return `<section class="box"><span class="box-title">Guide</span>
    <button class="btn block" data-act="gd-rerun">${ICON.refresh}Run the setup again</button>
    <label class="switch"><input type="checkbox" data-change="gd-tips"${st.off ? '' : ' checked'}><span>Tips for new users<small class="muted gd-sw-sub">A short note the first time you open a feature</small></span></label>
    <button class="link-btn" data-act="gd-tips-again" style="align-self:flex-start">Show all tips again</button>
  </section>`;
}

const GD_ACTS = {
  'tip-ok': el => { const st = tipState(); if (!st.seen.includes(el.dataset.k)) st.seen.push(el.dataset.k); store.set('wc-tips', st); const t = el.closest('.gd-tip'); if (t) t.remove(); },
  'gd-tips-again': () => { const st = tipState(); st.seen = []; st.off = false; store.set('wc-tips', st); toast('All tips show again, once each.'); refreshView(); },
  'gd-rerun': () => { GS.step = 1; GS.only = false; go('#/setup'); },
  'gd-window': (el, e) => { if (e) e.preventDefault(); insightsGo('window', el.dataset.v); },
  'gd-ext': (el, e) => { if (e) e.preventDefault(); U.topMode = 'ext'; go('#/top'); },
  'gd-start': (el, e) => {
    if (e) e.preventDefault();
    const k = el.dataset.k;
    if (k === 'place') { GS.step = 2; GS.only = true; GS.name = ''; GS.cap = ''; go('#/setup'); }
    else if (k === 'taste') go('#/taste');
    else go('#/add');
  },
  'gd-type': el => { const was = LOC_TYPE_NAME[GS.type]; GS.type = el.dataset.v; if (!GS.name || GS.name === was) GS.name = LOC_TYPE_NAME[GS.type]; render(); },
  'gd-skip': () => { GS.step >= 4 ? gdFinish() : (GS.step += 1, render(), window.scrollTo(0, 0)); },
  'gd-back': () => { if (GS.step === 1 || GS.only) { GS.only ? (GS.only = false, GS.step = 1, go('#/home', true)) : gdFinish(); return; } GS.step -= 1; render(); },
  'gd-next': async () => { if (GS.step === 2) await gdSavePlace(); gdNext(); },
  'gd-add': () => { store.set('wc-setup', 'done'); GS.step = 1; }
};
const GD_INPUTS = {
  'gd-name': el => { GS.name = el.value; },
  'gd-cap': el => { GS.cap = el.value.replace(/[^0-9]/g, ''); }
};
const GD_CHANGES = {
  'gd-tips': el => { const st = tipState(); st.off = !el.checked; store.set('wc-tips', st); }
};
