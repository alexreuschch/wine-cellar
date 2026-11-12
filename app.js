'use strict';

/* Wine Cellar, a private wine cellar app.
   Data lives in your Google Sheet, reached through your Google Apps Script web app. */

const APP_VERSION = '4.5.3';
const OPENCV_URL = 'https://docs.opencv.org/4.7.0/opencv.js';
const JSCANIFY_URL = 'https://cdn.jsdelivr.net/gh/ColonelParrot/jscanify@master/src/jscanify.min.js';

const SEG_COLORS = ['#9E0F0F', '#A8160F', '#B2210F', '#BC2D10', '#C53A12', '#CD4815', '#D55618', '#DD651C', '#E57620', '#EC8724', '#F09928', '#EFA82C', '#DFAE2E', '#CCAF30', '#B5AC31', '#9CA632', '#839E34', '#6A9636', '#528E38', '#3A863A'];
const STATUS = {
  'Past its window': { c: '#EC7A69', hint: 'Open these first' },
  'Drink soon': { c: '#EDAA45', hint: 'Past their peak, still drinking well' },
  'Peak': { c: '#5CC489', hint: 'Best time to open' },
  'Ready': { c: '#8FBF73', hint: 'Drinkable now, will still improve' },
  'Too young': { c: '#9AA8C2', hint: 'Keep resting' },
  'No window': { c: '#8F837C', hint: 'Add a drinking window to track these' }
};
const STATUS_ORDER = ['Past its window', 'Drink soon', 'Peak', 'Ready', 'Too young', 'No window'];
const TYPES = ['Red', 'White', 'Rosé', 'Sparkling', 'Dessert', 'Fortified'];
const SYSTEMS = [
  { key: 'Vivino', max: 5 },
  { key: 'Robert Parker', max: 100 },
  { key: 'Falstaff', max: 100 },
  { key: 'James Suckling', max: 100 },
  { key: 'Wine Spectator', max: 100 },
  { key: 'Decanter', max: 100 },
  { key: 'Jancis Robinson', max: 20 },
  { key: 'Vinum', max: 20 }
];
const REMOVAL_TYPES = ['Dinner', 'Lunch', 'Celebration', 'Gift', 'Sale', 'Other'];
const ADD_TYPES = [['Purchase', 'Purchase'], ['Received', 'Gift received'], ['Added', 'Other']];
const OCCASION_HINTS = { Dinner: 'Sunday dinner at home', Lunch: 'Business lunch', Celebration: 'Birthday, anniversary', Gift: 'Housewarming, thank you', Sale: 'Sold from the cellar', Other: 'Tasting, cooking' };
const ADD_HINTS = { Purchase: 'En primeur, wine fair', Received: 'Birthday present', Added: 'Found in the basement' };

const now = new Date();
const TODAY = now.getFullYear() + now.getMonth() / 12 + (now.getDate() - 1) / 365;

/* ------------------------------------------------------------ icons */

const svg = (d, size = 20, sw = 1.9) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  plus: svg('<path d="M5 12h14M12 5v14"/>', 18, 2.2),
  bookmark: svg('<path d="M7 4h10v16l-5-3.5L7 20z"/>', 20, 1.8),
  share: svg('<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.7l7.4-4.4M8.3 13.3l7.4 4.4"/>', 20, 1.8),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', 16, 2),
  sort: svg('<path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"/>', 16, 1.8),
  list: svg('<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>', 16, 2),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 22, 1.8),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 18, 2),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18, 2.2),
  minus: svg('<path d="M5 12h14"/>', 18, 2.2),
  plusBig: svg('<path d="M5 12h14M12 5v14"/>', 26, 2.4),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>', 18, 2),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 20, 1.7),
  refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>', 20, 1.9),
  back: svg('<path d="M15 5l-7 7 7 7"/>', 18, 2),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>', 16, 2),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 16, 1.8),
  glass: svg('<path d="M8 3h8l-.5 5a3.5 3.5 0 0 1-7 0L8 3zM12 12v8M8 20h8"/>', 22, 1.8),
  clock: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', 22, 1.8),
  trophy: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM12 13v4M9 20h6M8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3"/>', 22, 1.8),
  chart: svg('<path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/>', 22, 1.8),
  dining: svg('<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="3.4"/><path d="M2 3v4a1.5 1.5 0 0 0 3 0V3M3.5 8.5V21M22 21V3c-1.7 1.3-2.4 3.8-2.4 7.6H22"/>', 22, 1.6),
  book: svg('<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h10"/>', 22, 1.8),
  magic: svg('<path d="M10 4l1.9 5.1L17 11l-5.1 1.9L10 18l-1.9-5.1L3 11l5.1-1.9z"/><path d="M18.5 2.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>', 22, 1.7),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', 22, 1.8),
  send: svg('<path d="M12 19V5M6 11l6-6 6 6"/>', 22, 2.2),
  spark: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>', 18, 1.8),
  filter: svg('<path d="M4 5h16l-6 7v6l-4 2v-8z"/>', 20, 1.9),
  heart: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', 18, 1.9),
  bottle: svg('<path d="M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z"/>', 14, 1.8),
  home: svg('<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V19h12V9.5"/><path d="M10 19v-5h4v5"/>', 22, 1.8),
  chevron: svg('<path d="M9 6l6 6-6 6"/>', 14, 2),
  gift: svg('<path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7C10.5 4 7 4 7 6s3 1 5 1zM12 7c1.5-3 5-3 5-1s-3 1-5 1z"/>', 14, 1.8),
  cash: svg('<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>', 14, 1.8),
  box: svg('<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>'),
  cart: svg('<path d="M3 4h2l2.2 10.5a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>', 14, 1.8),
  move: svg('<path d="M4 9h13l-3-3M20 15H7l3 3"/>', 16, 1.9),
  tag: svg('<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.6"/>', 18, 1.8),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>', 16, 1.8),
  link: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', 13, 1.9),
  pin: svg('<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>', 14, 1.8),
  temp: svg('<path d="M10 14.5V4.5a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0z"/><path d="M12 11v6"/>', 16, 1.8),
  upload: svg('<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>', 20, 1.8)
};
const HEART_PATH = 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z';
const HEART_ON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${HEART_PATH}"/></svg>`;
const HEART_SM = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="margin-left:3px;vertical-align:-1px"><path d="${HEART_PATH}"/></svg>`;
const FIN = `<span class="fin" title="Finished" aria-label="Finished">${ICON.bottle}</span>`;
const DISC = '<span class="disc-tag">Discovery</span>';
const GIFT_MARK = `<span class="gift-mark" title="Gift received" aria-label="Gift received">${ICON.gift}</span>`;
const STAR_PATH = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z';

/* ------------------------------------------------------------ helpers */

const $ = (s, el = document) => el.querySelector(s);
const esc = v => String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => (v === null || v === undefined ? '' : String(v));
const numOrNull = v => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
const splitList = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => String(s).trim()).filter(Boolean);
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* a discovery: a wine tasted out, for example in a restaurant, never in the cellar */
const isDisc = w => !!w && w.origin === 'discovery';
const newId = (p = 'w') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sysInfo = k => SYSTEMS.find(s => s.key === k) || { key: k, max: 100 };
const fmtScore = (sys, v) => (sysInfo(sys).max === 5 ? Number(v).toFixed(1) : (Number.isInteger(Number(v)) ? String(Number(v)) : Number(v).toFixed(1)));

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(s));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
};

let CFG = store.get('wc-config', null);
const S = { wines: [], removals: [], locations: [], shelfNames: {}, locInfo: {}, retailers: [], people: [], peopleInfo: [], wishlist: [], orders: [], history: [], usage: [], settings: { currency: 'CHF' }, tasteTest: null, fx: null, version: 0 };
const newF = () => ({ open: false, sel: {}, tab: null, q: {}, all: {} });
const U = {
  search: '', showFinished: false, f: { cellar: newF(), journal: newF(), top: newF() },
  winFilter: 'All', topMode: 'mine', topSys: null, topFinished: false, topDisc: false, addRatingOpen: false,
  jSearch: '', jFav: false, locMove: null, personEdit: null
};
let D = null;   // add or edit draft
let RS = null;  // bottom sheet state (bottles in or out, journal entries)
let lastRouteKey = '';

/* ------------------------------------------------------------ data model */

function parseRatings(v) {
  let a = v;
  if (!Array.isArray(a)) { try { a = JSON.parse(v || '[]'); } catch (e) { a = []; } }
  if (!Array.isArray(a)) return [];
  // date: when you entered or changed it yourself, so a check for rating hints can skip it for a while
  return a.filter(r => r && r.sys && r.score !== '' && r.score !== null && !isNaN(Number(r.score))).map(r => Object.assign({ sys: String(r.sys), score: Number(r.score) }, /^\d{4}-\d{2}-\d{2}$/.test(String(r.date || '')) ? { date: String(r.date) } : {}));
}

function parseJSON(v, d) {
  if (v && typeof v === 'object') return v;
  try { const x = JSON.parse(v || ''); return x === null || x === undefined ? d : x; } catch (e) { return d; }
}

function parseStock(w) {
  let a = parseJSON(w.stock, null);
  if (!Array.isArray(a)) {
    const n = Math.max(0, Number(w.count) || 0);
    a = n > 0 ? [{ loc: str(w.location), shelf: numOrNull(w.shelf), pos: str(w.position), n }] : [];
  }
  return a.map(e => ({ loc: str(e.loc), shelf: numOrNull(e.shelf), pos: str(e.pos), n: Math.max(0, Math.round(Number(e.n) || 0)) })).filter(e => e.n > 0);
}

function parseStreet(w) {
  const s = parseJSON(w.street, null);
  if (s && Number(s.v) > 0) return { v: Number(s.v), cur: str(s.cur) || 'CHF', date: str(s.date), src: str(s.src), conf: str(s.conf) };
  return null;
}

function parseOffer(w) {
  const o = parseJSON(w.offer, null);
  return o && o.shop && Number(o.v) > 0 && /^https?:\/\//i.test(str(o.url))
    ? { shop: str(o.shop), country: str(o.country), v: Number(o.v), cur: str(o.cur) || 'CHF', shipping: o.shipping === 0 ? 0 : Number(o.shipping) > 0 ? Number(o.shipping) : null, freeFrom: Number(o.freeFrom) > 0 ? Number(o.freeFrom) : null, url: str(o.url), vintage: str(o.vintage), for: str(o.for), area: str(o.area), date: str(o.date) } : null;
}

/* countries where shops are searched; the currency only changes how prices are shown */
const SHOP_COUNTRIES = Object.fromEntries(Object.entries(GEO_COUNTRIES).map(([k, v]) => [k, v[0]]));
const countryCur = code => (GEO_COUNTRIES[code] || [])[1] || 'CHF';
const CUR_COUNTRY = { CHF: 'CH', EUR: 'DE', GBP: 'GB', USD: 'US' };
const countryOfCur = c => CUR_COUNTRY[c] || Object.keys(GEO_COUNTRIES).find(k => GEO_COUNTRIES[k][1] === c) || 'CH';
const shopCountry = () => (S.settings && SHOP_COUNTRIES[S.settings.country] ? S.settings.country : countryOfCur(cur()));
/* the country where the sommelier checks prices on a trip; stays until it is changed by hand */
const travelCountry = () => { let c = ''; try { c = localStorage.getItem('wc-travel') || ''; } catch (e) { c = ''; } return SHOP_COUNTRIES[c] ? c : shopCountry(); };
const setTravelCountry = c => { try { localStorage.setItem('wc-travel', c); } catch (e) { /* kept for this session only */ } };
const shopCountryName = () => SHOP_COUNTRIES[shopCountry()];
const flagOfCode = code => (/^[A-Z]{2}$/.test(str(code)) ? `<span class="flag" title="${esc(SHOP_COUNTRIES[code] || code)}">${String.fromCodePoint(...[...code].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65))}</span>` : '');
/* shop name with the flag of the country where the shop is based, and one line of details */
function offerShopHtml(o, w) {
  const home = o.country ? (SHOP_COUNTRIES[o.country] || (typeof COUNTRY_NAMES !== 'undefined' && COUNTRY_NAMES[o.country]) || o.country) : o.area;
  const meta = [home, o.vintage && (!w || o.vintage !== str(w.vintage)) ? `vintage ${o.vintage}` : '', o.date ? `checked ${fmtDate(o.date)}` : ''].filter(Boolean).join(' · ');
  return `<div style="min-width:0"><p style="margin:0;font-weight:600" class="ellipsis">${flagOfCode(o.country)}${esc(o.shop)}</p><p class="muted tiny" style="margin:2px 0 0">${esc(meta)}</p></div>`;
}
/* the price per bottle with shipping shared over the bottles you would buy */
function offerShipHtml(o, qty) {
  const q = Math.max(1, Math.round(Number(qty) || 6));
  const free = o.freeFrom && o.v * q >= o.freeFrom;
  if (o.shipping === null || o.shipping === undefined) {
    if (!free) return `<p class="muted tiny" style="margin:0">Shipping not stated by the shop${o.freeFrom ? `, free from ${esc(priceText(o.freeFrom, o.cur, 0))}` : ''}.</p>`;
  }
  const ship = free ? 0 : (o.shipping || 0);
  const per = (o.v * q + ship) / q;
  const note = free ? `Free shipping from ${priceText(o.freeFrom, o.cur, 0)}, reached with ${q} bottles`
    : ship ? `Shipping ${priceText(ship, o.cur)} per order${o.freeFrom ? `, free from ${priceText(o.freeFrom, o.cur, 0)}` : ''}` : 'Free shipping';
  return `<p class="small offer-ship" style="margin:0"><b>${esc(priceText(per, o.cur))}</b> per bottle, inclusive shipping for ${q} ${q === 1 ? 'bottle' : 'bottles'}</p><p class="muted tiny" style="margin:-4px 0 0">${esc(note)}</p>`;
}
/* how many bottles you would buy: your last purchase of this wine, otherwise a carton of 6 */
const lastBuyQty = w => { const b = inEntries(w).filter(r => r.type === 'Purchase').sort((a, c) => str(c.date).localeCompare(str(a.date)))[0]; return b ? Number(b.qty) || 6 : 6; };
/* an offer searched for another country than the one set now */
const offerOtherCountry = o => {
  const now = shopCountry();
  if (o.for) return o.for !== now;
  if (o.area === 'Euro area') return ['CH', 'LI', 'GB', 'US'].includes(now);
  return !!o.area && o.area !== SHOP_COUNTRIES[now];
};
const offerForName = o => (o.for ? SHOP_COUNTRIES[o.for] || o.for : o.area);

function normWine(w) {
  const stock = parseStock(w);
  return {
    id: str(w.id),
    producer: str(w.producer),
    name: str(w.name),
    vintage: str(w.vintage),
    type: TYPES.includes(str(w.type)) ? str(w.type) : (str(w.type) || 'Red'),
    region: str(w.region),
    grapes: str(w.grapes),
    taste: str(w.taste),
    tasteTags: splitList(w.tasteTags),
    pairings: splitList(w.pairings),
    drinkFrom: numOrNull(w.drinkFrom),
    peakFrom: numOrNull(w.peakFrom),
    peakUntil: numOrNull(w.peakUntil),
    drinkUntil: numOrNull(w.drinkUntil),
    stock,
    location: stock.length ? stock[0].loc : str(w.location),
    count: stock.reduce((a, e) => a + e.n, 0),
    street: parseStreet(w),
    offer: parseOffer(w),
    myRating: numOrNull(w.myRating),
    myFav: w.myFav === true || String(w.myFav).toUpperCase() === 'TRUE',
    ratingChecks: (() => { let o = w.ratingChecks; if (typeof o === 'string') { try { o = JSON.parse(o || '{}'); } catch (e) { o = {}; } } return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; })(),
    ratings: parseRatings(w.ratings),
    labelFileId: str(w.labelFileId),
    thumb: str(w.thumb),
    profile: typeof parseProfile === 'function' ? parseProfile(w.profile) : null,
    origin: str(w.origin) === 'discovery' ? 'discovery' : '',
    size: Number(String(w.size || '').replace(',', '.')) > 0 ? Number(String(w.size).replace(',', '.')) : 75,
    createdAt: str(w.createdAt),
    updatedAt: str(w.updatedAt)
  };
}

/* money: every price keeps its own currency and is converted for display */
const CURRENCIES = [...new Set(['CHF', 'EUR', 'USD', 'GBP', ...Object.keys(GEO_CURRENCIES)])];
const cur = () => (S.settings && CURRENCIES.includes(S.settings.currency) ? S.settings.currency : 'CHF');
const rates = () => (S.fx && S.fx.rates) || { CHF: 1 };
function conv(v, from) {
  if (v === null || v === undefined || v === '' || isNaN(Number(v))) return null;
  const f = CURRENCIES.includes(from) ? from : cur();
  if (f === cur()) return Number(v);
  const r = rates();
  return r[f] && r[cur()] ? Number(v) / r[f] * r[cur()] : null;
}
const fmtNum = (v, d = 2) => Number(v).toLocaleString('de-CH', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (v, d = 2) => `${cur()} ${fmtNum(v, d)}`;
/* a price in its own currency, with the amount in your currency behind it */
function dualPrice(v, from, d) {
  if (v === null || v === undefined || v === '') return '';
  const dd = d === undefined ? (Number(v) % 1 ? 2 : 0) : d;
  const own = `${from} ${fmtNum(v, dd)}`;
  if (!from || from === cur()) return own;
  const c = conv(v, from);
  return c === null ? own : `${own} ≈ ${money(c, 0)}`;
}
function priceText(v, from, d = 2) {
  if (v === null || v === undefined || v === '') return 'N/A';
  const c = conv(v, from);
  return c !== null ? money(c, d) : `${from} ${fmtNum(v, d)}`;
}
const curLabel = () => ` (${cur()})`;
const parseMoney = v => { const s = str(v).trim().replace(/[^\d.,-]/g, '').replace(',', '.'); return s === '' || isNaN(Number(s)) ? null : Number(s); };

/* a storage place is location + shelf + position */
const shelfVal = v => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
const placeKey = e => [lc(str(e.loc).trim()), shelfVal(e.shelf) === null ? '' : String(shelfVal(e.shelf)), lc(str(e.pos).trim())].join('|');
const samePlace = (a, b) => placeKey(a) === placeKey(b);
/* shelves are numbered from 0; each location can give them own names in Settings */
const shelfName = (loc, n) => { const m = S.shelfNames[lc(str(loc))]; return m && m[String(n)] ? str(m[String(n)]) : ''; };
const shelfLabel = (loc, n) => (n === null || n === undefined || n === '' ? '' : shelfName(loc, n) || `Shelf ${n}`);
const shelfText = (loc, n) => (n === null || n === undefined || n === '' ? 'None' : shelfName(loc, n) || String(n));
const shelfStep = (v, d) => { if (v === null || v === undefined || v === '') return d > 0 ? 0 : null; const x = Number(v) + d; return x < 0 ? null : Math.min(x, 99); };
const placeLabel = e => [e.loc || 'No location', shelfLabel(e.loc, shelfVal(e.shelf)), typeof posShow === 'function' ? posShow(e.pos) : str(e.pos).trim()].filter(Boolean).join(' · ');
const placeOf = e => ({ loc: str(e.loc), shelf: shelfVal(e.shelf), pos: str(e.pos).trim() });

const inEntries = w => S.removals.filter(r => r.wineId === w.id && r.dir === 'in');
/* a bottle that was really opened: not sold, given away or a correction after a check */
const isOpened = r => r.dir === 'out' && r.type !== 'Sale' && r.type !== 'Gift' && r.type !== 'Correction';
const isGift = w => inEntries(w).some(r => r.type === 'Received');

/** Average price per bottle of the bottles you bought. Gifts do not lower it; a wine you only got as a gift shows 0.
 *  Null when no price is known. */
function avgPrice(w) {
  let q = 0, sum = 0, gift = false;
  inEntries(w).forEach(e => {
    if (e.type === 'Received') { gift = true; return; }
    const p = conv(e.price, e.priceCur);
    if (p === null) return;
    q += e.qty;
    sum += p * e.qty;
  });
  return q ? sum / q : gift ? 0 : null;
}
/** What a bottle cost you on average, gifts counted as 0: for the totals of the cellar, the money you really spent. */
function costPerBottle(w) {
  let q = 0, sum = 0;
  inEntries(w).forEach(e => {
    const p = e.type === 'Received' ? 0 : conv(e.price, e.priceCur);
    if (p === null) return;
    q += e.qty;
    sum += p * e.qty;
  });
  return q ? sum / q : null;
}
const streetOf = w => (w.street ? conv(w.street.v, w.street.cur) : null);

function totals() {
  let cost = 0, street = 0, costN = 0, streetN = 0;
  S.wines.filter(w => w.count > 0).forEach(w => {
    const a = costPerBottle(w), s = streetOf(w);
    if (a !== null) { cost += a * w.count; costN++; }
    if (s !== null) { street += s * w.count; streetN++; }
  });
  return { cost, street, costN, streetN };
}

function serialWine(w) {
  const o = Object.assign({}, w);
  o.tasteTags = w.tasteTags.join(', ');
  o.pairings = w.pairings.join(', ');
  o.ratings = JSON.stringify(w.ratings);
  o.stock = JSON.stringify(w.stock);
  o.street = w.street ? JSON.stringify(w.street) : '';
  o.offer = w.offer ? JSON.stringify(w.offer) : '';
  o.profile = w.profile ? JSON.stringify(w.profile) : '';
  ['drinkFrom', 'peakFrom', 'peakUntil', 'drinkUntil', 'myRating'].forEach(k => { if (o[k] === null) o[k] = ''; });
  o.myFav = w.myFav ? true : '';
  o.ratingChecks = w.ratingChecks && Object.keys(w.ratingChecks).length ? JSON.stringify(w.ratingChecks) : '';
  return o;
}

function normRemoval(r) {
  return {
    id: str(r.id), wineId: str(r.wineId), date: str(r.date).slice(0, 10), type: str(r.type) || 'Other',
    occasion: str(r.occasion), people: str(r.people), hearts: str(r.hearts), food: str(r.food), note: str(r.note), wineName: str(r.wineName),
    dir: ['in', 'taste'].includes(str(r.dir)) ? str(r.dir) : 'out', qty: str(r.dir) === 'taste' ? 0 : Math.max(1, Math.round(Number(r.qty) || 1)), loc: str(r.loc),
    price: numOrNull(r.price), priceCur: str(r.priceCur) || cur(), retailer: str(r.retailer),
    venue: ['restaurant', 'shop', 'other'].includes(str(r.venue)) ? str(r.venue) : '',
    shopRef: (() => { const x = parseJSON(r.shopRef, null); return x && Number(x.v) > 0 ? { v: Number(x.v), cur: str(x.cur) || cur() } : null; })()
  };
}

const lc = s => String(s).toLowerCase();
const normPersonInfo = x => ({ name: str(x && x.name).trim(), aliases: str(x && x.aliases).trim(), note: str(x && x.note).trim() });
/* the other names and the note of a person, if any */
const personInfo = name => S.peopleInfo.find(x => lc(x.name) === lc(name)) || { name, aliases: '', note: '' };
/* every name a person goes by, in lower case */
const personNames = name => [lc(name)].concat(splitList(personInfo(name).aliases).map(lc));
const namesOf = s => splitList(s).map(n => n.replace(/\s+/g, ' '));
function rankAdd(m, name, date, extra) {
  const k = lc(name);
  const e = m.get(k) || Object.assign({ name, n: 0, score: 0, last: '' }, extra || {});
  const d = parseISO(date);
  const days = d ? Math.max(0, (Date.now() - d.getTime()) / 864e5) : 365;
  e.n += 1;
  e.score += 1 + 3 * Math.exp(-days / 90);
  if (!e.last || str(date) >= e.last) { e.last = str(date); e.name = name; }
  m.set(k, e);
}

function knownPeople() {
  const m = new Map();
  S.people.forEach(n => { if (n) m.set(lc(n), { name: n, n: 0, score: 0, last: '' }); });
  S.removals.forEach(r => namesOf(r.people).forEach(n => rankAdd(m, n, r.date)));
  return [...m.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function knownRetailers() {
  const m = new Map();
  S.retailers.forEach(r => m.set(lc(r.name), { name: r.name, n: 0, score: 0, last: '' }));
  S.removals.filter(r => r.retailer).forEach(r => rankAdd(m, r.retailer, r.date));
  return [...m.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function retailerSite(name) {
  const r = S.retailers.find(x => lc(x.name) === lc(name));
  if (!r || !r.website) return '';
  return /^https?:\/\//i.test(r.website) ? r.website : 'https://' + r.website;
}
const byName = list => list.slice().sort((a, b) => a.name.localeCompare(b.name));

function loadCache() {
  const c = store.get('wc-data', null);
  if (!c) return;
  S.wines = (c.wines || []).map(normWine);
  S.removals = (c.removals || []).map(normRemoval);
  if (Array.isArray(c.locations)) S.locations = c.locations;
  if (c.shelfNames) S.shelfNames = c.shelfNames;
  if (c.locInfo) S.locInfo = c.locInfo;
  if (Array.isArray(c.retailers)) S.retailers = c.retailers;
  if (Array.isArray(c.people)) S.people = c.people;
  if (Array.isArray(c.peopleInfo)) S.peopleInfo = c.peopleInfo;
  if (Array.isArray(c.wishlist)) S.wishlist = c.wishlist;
  if (Array.isArray(c.orders)) S.orders = c.orders;
  if (Array.isArray(c.history)) S.history = c.history;
  if (Array.isArray(c.usage)) S.usage = c.usage;
  if (c.settings) S.settings = Object.assign({ currency: 'CHF' }, c.settings);
  if (c.tasteTest !== undefined) S.tasteTest = c.tasteTest;
  if (c.fx) S.fx = c.fx;
  if (c.version) S.version = c.version;
}
function persist() {
  store.set('wc-data', { wines: S.wines, removals: S.removals, locations: S.locations, shelfNames: S.shelfNames, locInfo: S.locInfo, retailers: S.retailers, people: S.people, peopleInfo: S.peopleInfo, wishlist: S.wishlist, orders: S.orders, history: S.history, usage: S.usage, settings: S.settings, tasteTest: S.tasteTest, fx: S.fx, version: S.version });
}
const wineById = id => S.wines.find(w => w.id === id);
function upsertWine(w) {
  const i = S.wines.findIndex(x => x.id === w.id);
  if (i >= 0) S.wines[i] = w; else S.wines.push(w);
}

const wineTitle = w => w.name || w.producer || 'Unnamed wine';
/* country flag, taken from the region */
const COUNTRY_CODES = {
  france: 'FR', frankreich: 'FR', italy: 'IT', italien: 'IT', italia: 'IT', spain: 'ES', spanien: 'ES', 'españa': 'ES', portugal: 'PT',
  germany: 'DE', deutschland: 'DE', austria: 'AT', 'österreich': 'AT', switzerland: 'CH', schweiz: 'CH', suisse: 'CH', svizzera: 'CH',
  usa: 'US', 'united states': 'US', 'united states of america': 'US', 'u.s.a.': 'US', us: 'US', california: 'US',
  argentina: 'AR', chile: 'CL', australia: 'AU', 'new zealand': 'NZ', 'south africa': 'ZA', greece: 'GR', hungary: 'HU',
  lebanon: 'LB', israel: 'IL', canada: 'CA', uruguay: 'UY', slovenia: 'SI', croatia: 'HR', georgia: 'GE', romania: 'RO',
  moldova: 'MD', bulgaria: 'BG', england: 'GB', 'united kingdom': 'GB', uk: 'GB', mexico: 'MX', brazil: 'BR', china: 'CN',
  japan: 'JP', luxembourg: 'LU', 'czech republic': 'CZ', czechia: 'CZ', slovakia: 'SK', turkey: 'TR', 'türkiye': 'TR',
  cyprus: 'CY', serbia: 'RS', 'north macedonia': 'MK', armenia: 'AM', morocco: 'MA', belgium: 'BE', netherlands: 'NL',
  denmark: 'DK', sweden: 'SE', india: 'IN', peru: 'PE', bolivia: 'BO', montenegro: 'ME', 'bosnia and herzegovina': 'BA', malta: 'MT'
};
function countryOf(w) {
  const parts = str(w.region).split(',').map(x => x.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) { const c = COUNTRY_CODES[lc(parts[i])]; if (c) return { code: c, name: parts[i] }; }
  return null;
}
const flagOf = w => { const c = countryOf(w); return c ? `<span class="flag" title="${esc(c.name)}" aria-label="${esc(c.name)}">${String.fromCodePoint(...[...c.code].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65))}</span>` : ''; };

const wineSub = w => [w.name ? w.producer : '', w.vintage, w.size !== 75 ? sizeName(w.size) : ''].filter(Boolean).join(' · ') || w.region || w.type;

/* ------------------------------------------------------------ bottle sizes and space in the cellar */

const SIZES = [[37.5, 'Half bottle'], [50, 'Medium'], [75, 'Standard'], [150, 'Magnum'], [300, 'Double magnum']];
const clText = cl => `${fmtNum(cl, cl % 1 ? 1 : 0)} cl`;
const sizeName = cl => { const s = SIZES.find(x => x[0] === Number(cl)); return s && s[0] !== 75 ? s[1] : clText(cl); };
/* the size under the name of a wine, only when it is not a standard bottle */
const sizeText = w => (w.size && w.size !== 75 ? (SIZES.some(x => x[0] === w.size) ? `${sizeName(w.size)} · ${clText(w.size)}` : clText(w.size)) : '');
/* how much space one bottle takes, in standard bottles: small ones 0.6, a magnum 1.5, sparkling wine a little more */
function spaceOf(w) {
  const cl = w && w.size ? w.size : 75;
  const f = cl < 75 ? 0.6 : cl === 75 ? 1 : cl / 100;
  return w && w.type === 'Sparkling' ? f * 1.2 : f;
}
const locInfoOf = loc => S.locInfo[lc(str(loc))] || { capacity: null, kind: 'cellar', type: '', zones: [], owc: false, checked: '' };
/* what the script sends about a location, made safe to use */
const locInfoNorm = l => ({ capacity: Number(l.capacity) > 0 ? Math.round(Number(l.capacity)) : null, kind: l.kind === 'short' || l.type === 'short' ? 'short' : 'cellar', type: str(l.type), zones: Array.isArray(l.zones) ? l.zones : [], owc: !!l.owc, checked: str(l.checked), zeroBottom: !!l.zeroBottom });
/* the space a location has and uses, in standard bottles */
function locSpace(loc) {
  let used = 0, bottles = 0;
  S.wines.forEach(w => w.stock.forEach(e => { if (lc(e.loc) === lc(loc)) { used += e.n * spaceOf(w); bottles += e.n; } }));
  const info = locInfoOf(loc), cap = info.capacity;
  return { loc, bottles, used, cap, kind: info.kind, free: cap ? Math.max(0, Math.round(cap - used)) : null, pct: cap ? Math.min(100, Math.round(used / cap * 100)) : null };
}
/* all storage locations together; locations for a short stay and without a capacity do not count */
function cellarSpace() {
  const list = S.locations.map(locSpace).filter(x => x.kind === 'cellar' && x.cap);
  const cap = list.reduce((a, x) => a + x.cap, 0), used = list.reduce((a, x) => a + x.used, 0);
  return { list, cap, used, free: cap ? Math.max(0, Math.round(cap - used)) : null, pct: cap ? Math.min(100, Math.round(used / cap * 100)) : null,
    missing: S.locations.filter(l => locInfoOf(l).kind === 'cellar' && !locInfoOf(l).capacity) };
}
/* when bottles come in: is there room in this location, and where else if not */
function spaceNoteHtml(loc, n, w) {
  if (!loc || !(n > 0)) return '';
  const sp = locSpace(loc);
  if (sp.kind === 'short') return `<p class="space-note">${ICON.info}<span>${esc(loc)} is for a short stay, not counted as cellar space.</span></p>`;
  if (!sp.cap) return '';
  const need = n * spaceOf(w);
  if (need <= sp.free) return `<p class="space-note">${ICON.info}<span>${esc(loc)}: about ${sp.free} ${sp.free === 1 ? 'place' : 'places'} free.</span></p>`;
  const alt = S.locations.filter(l => lc(l) !== lc(loc)).map(locSpace).filter(x => x.kind === 'cellar' && x.cap && x.free > 0).sort((a, b) => b.free - a.free)[0];
  return `<p class="space-note warn">${ICON.info}<span>${sp.free ? `Only about ${sp.free} ${sp.free === 1 ? 'place' : 'places'} left in ${esc(loc)}.` : `${esc(loc)} is full.`}${alt ? ` ${esc(alt.loc)} has about ${alt.free} free.` : ' No other location has room.'}</span></p>`;
}
/* green below 85%, yellow from 85%, orange from 95%, red when full */
const fillCls = pct => (pct >= 100 ? 'full' : pct >= 95 ? 'orange' : pct >= 85 ? 'high' : '');
/* the fill level as a bar with the numbers, for a location or the whole cellar */
function fillBarHtml(x, label) {
  if (!x.cap) return '';
  const used = Math.round(x.used);
  return `<div class="fill"><div class="between"><span class="small">${label ? `${esc(label)}: ` : ''}<b>${used}</b> of about ${x.cap}</span><span class="small ${x.free === 0 ? 'down' : 'muted'}">${x.free === 0 ? 'Full' : `about ${x.free} free`}</span></div>
    <div class="fill-bar ${fillCls(x.pct)}"><i style="width:${Math.max(2, x.pct)}%"></i></div></div>`;
}
const fullName = w => [w.producer, w.name, w.vintage].filter(Boolean).join(' ');
function initials(w) {
  const src = (w.producer || w.name || '?').replace(/[^A-Za-zÀ-ÿ ]/g, ' ').trim().split(/\s+/);
  return ((src[0] || '?')[0] + (src[1] ? src[1][0] : '')).toUpperCase();
}

/* ------------------------------------------------------------ drinking window */

function windowParts(w) {
  let f = w.drinkFrom !== null ? w.drinkFrom : w.peakFrom;
  let u = w.drinkUntil !== null ? w.drinkUntil : w.peakUntil;
  if (f === null && u === null) return null;
  if (f === null) f = u - 3;
  if (u === null) u = f + 5;
  if (u < f) u = f;
  const pf = w.peakFrom !== null ? clamp(w.peakFrom, f, u) : f;
  const pt = w.peakUntil !== null ? clamp(w.peakUntil, pf, u) : u;
  return { f, pf, pt, u };
}

function statusOf(w, t = TODAY) {
  const p = windowParts(w);
  if (!p) return 'No window';
  if (t < p.f) return 'Too young';
  if (t < p.pf) return 'Ready';
  if (t < p.pt + 1) return 'Peak';
  if (t < p.u + 1) return 'Drink soon';
  return 'Past its window';
}

function statusLine(w) {
  const p = windowParts(w);
  const s = statusOf(w);
  if (!p) return '';
  return {
    'Too young': `Ready from ${p.f}`,
    'Ready': `Peak from ${p.pf}`,
    'Peak': `Peak until ${p.pt}`,
    'Drink soon': `Past peak since ${p.pt + 1}, drink by ${p.u}`,
    'Past its window': `Past its window since ${p.u + 1}`
  }[s];
}

function urgencyCmp(a, b) {
  const sa = STATUS_ORDER.indexOf(statusOf(a)), sb = STATUS_ORDER.indexOf(statusOf(b));
  if (sa !== sb) return sa - sb;
  const pa = windowParts(a), pb = windowParts(b);
  return (pa ? pa.u : 9999) - (pb ? pb.u : 9999);
}

function timelineHtml(w, big = false) {
  const p = windowParts(w);
  if (!p) return '';
  const s = p.f - 2, e = p.u + 3;
  const parts = [
    [p.f - s, STATUS['Too young'].c],
    [p.pf - p.f, STATUS['Ready'].c],
    [p.pt + 1 - p.pf, STATUS['Peak'].c],
    [p.u - p.pt, STATUS['Drink soon'].c],
    [e - (p.u + 1), STATUS['Past its window'].c]
  ].filter(x => x[0] > 0);
  const pos = clamp((TODAY - s) / (e - s) * 100, 0, 100);
  return `<div class="bar${big ? ' big' : ''}"><div class="bar-segs">${parts.map(x => `<div style="flex:${x[0]} 1 0;background:${x[1]}"></div>`).join('')}</div><div class="bar-marker" style="left:calc(${pos.toFixed(1)}% - 1px)"></div></div>`;
}

/* the years under the timeline, each right below its place: start and end of the window, and today */
function timelineScaleHtml(w) {
  const p = windowParts(w);
  if (!p) return '';
  const s = p.f - 2, e = p.u + 3, at = y => clamp((y - s) / (e - s) * 100, 0, 100);
  const t = at(TODAY), f = at(p.f), u = at(p.u + 1);
  const lab = (x, txt, cls) => `<span class="${cls || ''}${x < 7 ? ' l' : x > 93 ? ' r' : ''}" style="left:${x.toFixed(1)}%">${txt}</span>`;
  return `<div class="tl-scale">${Math.abs(f - t) >= 13 ? lab(f, p.f) : ''}${Math.abs(u - t) >= 13 ? lab(u, p.u) : ''}${lab(t, 'Today', 'now')}</div>`;
}

/* a drinking window kept with a wine that is not in the cellar: its own, or from what was loaded about it */
function winParse(v, details) {
  let w = v;
  try { w = typeof v === 'string' && v ? JSON.parse(v) : v; } catch (e) { w = null; }
  if (w && Number(w.drinkFrom) && Number(w.drinkUntil)) return { drinkFrom: Number(w.drinkFrom), peakFrom: Number(w.peakFrom) || Number(w.drinkFrom), peakUntil: Number(w.peakUntil) || Number(w.drinkUntil), drinkUntil: Number(w.drinkUntil) };
  return details && details !== v ? winParse(details) : null;
}
const windowText = w => {
  const p = windowParts(w);
  return p ? `Drink ${p.f} to ${p.u} · peak ${p.pf} to ${p.pt}` : '';
};

/* ------------------------------------------------------------ small UI pieces */

const pill = w => {
  const s = statusOf(w);
  return s === 'No window' ? '' : `<span class="pill" style="--c:${STATUS[s].c}">${s}</span>`;
};
/* the label as a small card: the photo, or a drawn label with the vintage */
const thumbHtml = (w, sm) => (w.thumb
  ? `<img class="thumb lab${sm ? ' sm' : ''}" src="${esc(w.thumb)}" alt="">`
  : labelMiniHtml(w, sm));
const chip = (label, on, act, v, extra = '') => `<button class="chip${on ? ' on' : ''}" data-act="${act}" data-v="${esc(v)}">${extra}${esc(label)}</button>`;
const segsHtml = (v, h = 7, cls = '') => {
  const n = v === null ? 0 : Math.round(v / 5);
  return `<div class="segs ${cls}">${SEG_COLORS.map((c, i) => `<div style="height:${h}px;background:${i < n ? c : '#45232F'}"></div>`).join('')}</div>`;
};
const starsHtml = v => `<div class="stars" aria-label="${esc(v)} of 5">${[0, 1, 2, 3, 4].map(i => {
  const wpx = (clamp(v - i, 0, 1) * 14).toFixed(1);
  return `<span class="star"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}" fill="#45232F"/></svg><span class="fill" style="width:${wpx}px"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}" fill="#E6CB98"/></svg></span></span>`;
}).join('')}</div>`;
const typeBadge = t => (t === 'Gift' ? `<span class="badge gift">${ICON.gift}Gift given</span>`
  : t === 'Received' ? `<span class="badge received">${ICON.gift}Gift received</span>`
  : t === 'Sale' ? `<span class="badge sale">${ICON.cash}Sale</span>`
  : t === 'Purchase' ? `<span class="badge purchase">${ICON.cart}Purchase</span>`
  : t === 'Added' ? '<span class="badge">Added</span>'
  : t === 'Correction' ? `<span class="badge correction">${ICON.check}Stock correction</span>`
  : t === 'Imported' ? `<span class="badge">${ICON.upload.replace('width="20" height="20"', 'width="12" height="12"')}Imported</span>`
  : t === 'Discovery' ? `<span class="badge discovery">${ICON.spark}Discovery</span>`
  : `<span class="badge${t === 'Celebration' ? ' celebration' : ''}">${esc(t)}</span>`);

function nav(active) {
  // badges, if wanted in Settings: wines past their window on Window, a dot on Cellar for an overdue delivery
  const on = notifyOf().badges;
  const past = on ? S.wines.filter(w => w.count > 0 && statusOf(w) === 'Past its window').length : 0;
  const late = on && S.orders.some(orderOverdue);
  const badge = (n, label) => (n ? `<span class="nav-n" aria-label="${n} ${label}">${n > 99 ? '99+' : n}</span>` : '');
  const item = (href, key, icon, label, extra = '') => `<a href="${href}" class="${active === key ? 'on' : ''}"><span class="nav-ic">${icon}${extra}</span>${label}</a>`;
  return `<nav class="nav" aria-label="Main">${item('#/home', 'home', ICON.home, 'Home')}${item('#/cellar', 'cellar', ICON.glass, 'Cellar', late ? '<span class="nav-dot" aria-label="A delivery is overdue"></span>' : '')}${item('#/window', 'window', ICON.clock, 'Window', badge(past, past === 1 ? 'wine past its window' : 'wines past their window'))}${item('#/insights', active === 'top' ? 'top' : 'insights', ICON.chart, 'Insights')}${item('#/journal', 'journal', ICON.book, 'Journal')}</nav>`;
}
/* the monthly email and the badges, as chosen in Settings */
const notifyOf = () => Object.assign({ mail: true, to: '', window: true, orders: true, month: true, badges: true }, (S.settings && S.settings.notify) || {});

function toast(msg, ms = 3400) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('act', 'multi');
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), ms);
}
/* a toast with one button, for example Show after saving to the wishlist */
function toastAct(msg, label, fn, ms = 5000) {
  const t = $('#toast');
  // one button, or several as [[label, fn], ...]
  const btns = Array.isArray(label) ? label : [[label, fn]];
  if (Array.isArray(label) && typeof fn === 'number') ms = fn;
  if (btns.length > 1) ms = Math.max(ms, 7000);
  t.innerHTML = `<span>${esc(msg)}</span><span class="toast-btns">${btns.map(b => `<button type="button">${esc(b[0])}</button>`).join('')}</span>`;
  t.querySelectorAll('button').forEach((b, i) => { b.onclick = () => { t.classList.remove('show', 'act', 'multi'); btns[i][1](); }; });
  t.classList.toggle('multi', btns.length > 1);
  t.classList.add('show', 'act');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show', 'act'), ms);
}

/* a short question before something that is easy to do by mistake: resolves true for yes */
function ask(o) {
  let root = $('#ask-root');
  if (!root) { root = document.createElement('div'); root.id = 'ask-root'; document.body.appendChild(root); }
  return new Promise(done => {
    const end = v => { root.innerHTML = ''; done(v); };
    root.innerHTML = `<div class="sheet-backdrop ask-bd"></div><div class="sheet ask-sheet" role="alertdialog" aria-modal="true" aria-labelledby="ask-title">
      <h2 id="ask-title" style="font-size:18px;font-weight:600">${esc(o.title)}</h2>${o.text ? `<p class="small muted" style="margin:0">${esc(o.text)}</p>` : ''}
      <div class="grid2"><button class="btn" data-ask="0">${esc(o.no || 'Cancel')}</button><button class="btn ${o.danger ? 'danger' : 'primary'}" data-ask="1">${esc(o.yes || 'OK')}</button></div></div>`;
    root.querySelector('.ask-bd').onclick = () => end(false);
    root.querySelectorAll('[data-ask]').forEach(b => { b.onclick = e => { e.stopPropagation(); end(b.dataset.ask === '1'); }; });
  });
}

function busy(on, label = 'Saving…') {
  const b = $('#busy');
  if (on) { b.querySelector('p').textContent = label; b.hidden = false; } else b.hidden = true;
}

/* ------------------------------------------------------------ API */

async function api(action, payload = {}, cfg = CFG, tries = 0) {
  if (!cfg) throw new Error('Not connected');
  let res;
  const t0 = Date.now();
  try {
    res = await fetch(cfg.url, { method: 'POST', body: JSON.stringify(Object.assign({ token: cfg.token, action }, payload)) });
  } catch (e) {
    if (Date.now() - t0 > 40000) throw new Error('The answer took too long or the app was closed in the meantime. Keep the app open while the AI works and try again.');
    throw new Error('Could not reach your script. Check your connection and the script URL.');
  }
  let out;
  try { out = await res.json(); } catch (e) {
    throw new Error('Could not reach your script. Check the script URL and that access is set to Anyone.');
  }
  if (!out.ok) {
    const err = str(out.error) || 'Unknown error';
    // the sheet was busy with another write: nothing was written, so the same call is sent again
    if (/lock timeout|holding the lock/i.test(err)) {
      if (tries < 3) { await new Promise(r => setTimeout(r, 2000 + tries * 3000)); return api(action, payload, cfg, tries + 1); }
      throw new Error('Your Google Sheet is very busy right now. Nothing was saved, please try again in a minute.');
    }
    throw new Error(err);
  }
  return out.data;
}

let syncing = false;
async function sync(silent) {
  if (!CFG || syncing) return;
  syncing = true;
  const btn = $('[data-act="refresh"]');
  if (btn) btn.classList.add('spin');
  try {
    const d = await api('load');
    S.version = Number(d.version) || 1;
    S.wines = (d.wines || []).map(normWine).filter(w => w.id);
    S.removals = (d.removals || []).map(normRemoval).filter(r => r.id);
    S.locations = Array.isArray(d.locations) ? d.locations : [];
    S.shelfNames = {};
    (d.locationInfo || []).forEach(l => { if (l && l.name && l.shelves && Object.keys(l.shelves).length) S.shelfNames[lc(l.name)] = l.shelves; });
    S.locInfo = {};
    (d.locationInfo || []).forEach(l => { if (l && l.name) S.locInfo[lc(l.name)] = locInfoNorm(l); });
    S.retailers = Array.isArray(d.retailers) ? d.retailers.map(r => ({ name: str(r.name), website: str(r.website) })).filter(r => r.name) : [];
    S.people = Array.isArray(d.people) ? d.people.map(str).filter(Boolean) : [];
    S.peopleInfo = Array.isArray(d.peopleInfo) ? d.peopleInfo.map(normPersonInfo).filter(x => x.name) : [];
    S.wishlist = Array.isArray(d.wishlist) ? d.wishlist.map(normWish) : [];
    if (Array.isArray(d.orders)) S.orders = d.orders.map(normOrder);
    S.history = Array.isArray(d.history) ? d.history.map(normHistory).filter(h => h.month) : [];
    S.usage = Array.isArray(d.usage) ? d.usage : [];
    if (d.settings) S.settings = Object.assign({ currency: 'CHF' }, d.settings);
    S.tasteTest = d.tasteTest && typeof d.tasteTest === 'object' ? d.tasteTest : null;
    if (d.fx) S.fx = d.fx;
    persist();
    if (!isFormRoute()) render();
    if (!silent) toast('Up to date');
    snapshotValue();
  } catch (e) {
    toast(silent ? 'Offline. Showing your saved data.' : e.message);
  } finally {
    syncing = false;
    const b = $('[data-act="refresh"]');
    if (b) b.classList.remove('spin');
  }
}

/* street prices: one request per wine, looked up by AI with web search */
const aiErr = m => str(m).replace(/Claude API/g, 'AI service').replace(/Claude Console/g, 'API console');
let streetRun = null;
function showProgress() {
  const el = $('#progress');
  if (!el) return;
  if (!streetRun) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span class="spinner"></span>Updating street prices ${streetRun.done} of ${streetRun.total}`;
}
async function updateStreetPrices(ids, quiet) {
  if (streetRun) { if (!quiet) toast('Street prices are already updating.'); return; }
  if (!ids.length) { toast('No wines in stock.'); return; }
  streetRun = { done: 0, total: ids.length, failed: 0, err: '', ids: ids.slice() };
  showProgress();
  refreshView();
  for (const id of ids) {
    try {
      const w = normWine(await api('streetPrice', { id }));
      upsertWine(w);
      persist();
      if (D && D.id === id && !D.touched.has('street') && w.street) {
        D.fields.street = D.streetInit = priceInput(w.street.v, w.street.cur);
        const i = $('[name="street"]');
        if (i) i.value = D.fields.street;
      }
    } catch (e) { streetRun.failed++; streetRun.err = aiErr(e.message); }
    streetRun.done++;
    showProgress();
    refreshView();
  }
  const r = streetRun;
  streetRun = null;
  showProgress();
  refreshView();
  if (r.failed === r.total) toast((r.total === 1 ? 'Street price' : 'Street prices') + ' not updated: ' + r.err, 6000);
  else if (r.failed) toast(`Street prices updated. ${r.failed} not found.`);
  else if (!quiet) toast(r.total === 1 ? 'Street price updated' : 'Street prices updated');
}

/* ------------------------------------------------------------ images */

async function imageUrl(fileId) {
  const key = new Request(location.origin + '/__label/' + encodeURIComponent(fileId));
  let cache = null;
  try { cache = await caches.open('wc-images'); } catch (e) { cache = null; }
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return URL.createObjectURL(await hit.blob());
  }
  const d = await api('image', { fileId });
  const bytes = Uint8Array.from(atob(d.data), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: d.mime || 'image/jpeg' });
  if (cache) { try { await cache.put(key, new Response(blob, { headers: { 'Content-Type': blob.type } })); } catch (e) { /* ignore */ } }
  return URL.createObjectURL(blob);
}

async function cacheLabel(fileId, b64) {
  try {
    const cache = await caches.open('wc-images');
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    await cache.put(new Request(location.origin + '/__label/' + encodeURIComponent(fileId)), new Response(new Blob([bytes], { type: 'image/jpeg' })));
  } catch (e) { /* ignore */ }
}

/* ------------------------------------------------------------ voice input for every AI field */
/* Tap the microphone to start, tap stop to end: pauses do not end it. The speech recognition of the phone stops by
   itself after a short pause, so it is started again at once and the text so far is kept. After 30 seconds without
   speech or 3 minutes in all it stops by itself, so the microphone never stays open unnoticed. */
const VOICE = { on: false, rec: null, o: null, base: '', done: '', sess: '', t0: 0, last: 0, timer: null, fails: 0 };
const voiceJoin = (...a) => a.map(x => String(x || '').trim()).filter(Boolean).join(' ');
/* the phone hears one language at a time: EN or DE, switched with the small chip next to every microphone */
const VOICE_LANGS = [['en-US', 'EN', 'English'], ['de-CH', 'DE', 'German']];
function voiceLang() {
  let v = VOICE.lang || null;
  if (!v) try { v = localStorage.getItem('wc-voice-lang'); } catch (e) { /* no storage: the default */ }
  return VOICE_LANGS.find(x => x[0] === v) || (/^de/i.test(navigator.language || '') ? VOICE_LANGS[1] : VOICE_LANGS[0]);
}
const voiceOther = l => VOICE_LANGS.find(x => x !== l);
function voiceLangHtml() {
  const l = voiceLang();
  return `<button type="button" class="voice-lang" data-act="voice-lang" aria-label="Speaking ${l[2]}, tap for ${voiceOther(l)[2]}">${l[1]}</button>`;
}
function voiceLangNext() {
  const l = voiceOther(voiceLang());
  try { localStorage.setItem('wc-voice-lang', l[0]); } catch (e) { /* kept for this visit only */ }
  VOICE.lang = l[0];
  document.querySelectorAll('.voice-lang').forEach(b => { b.textContent = l[1]; b.setAttribute('aria-label', `Speaking ${l[2]}, tap for ${voiceOther(l)[2]}`); });
  // while listening: the recognition starts again in the new language, the text so far stays
  if (VOICE.on && VOICE.rec) { try { VOICE.rec.stop(); } catch (e) { /* it restarts by itself */ } }
}
function voiceStart(o) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Voice input is not available here. Use the microphone on your keyboard instead.', 5000); return false; }
  if (VOICE.on) voiceStop();
  Object.assign(VOICE, { on: true, o, base: String(o.get() || '').trim(), done: '', sess: '', t0: Date.now(), last: Date.now(), fails: 0 });
  clearInterval(VOICE.timer);
  VOICE.timer = setInterval(() => { const n = Date.now(); if (VOICE.on && (n - VOICE.last > 30000 || n - VOICE.t0 > 180000)) voiceStop(); }, 1000);
  o.ui(true);
  voiceListen();
  return true;
}
function voiceListen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = VOICE.lang || voiceLang()[0];
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = e => {
    let t = '';
    for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
    VOICE.sess = t;
    VOICE.last = Date.now();
    VOICE.fails = 0;
    if (VOICE.o) VOICE.o.set(voiceJoin(VOICE.base, VOICE.done, t));
  };
  rec.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { toast('Allow the microphone for this app to speak.', 5000); VOICE.on = false; }
    else if (e.error !== 'no-speech' && e.error !== 'aborted') VOICE.fails++;
  };
  rec.onend = () => {
    VOICE.done = voiceJoin(VOICE.done, VOICE.sess);
    VOICE.sess = '';
    VOICE.rec = null;
    // a pause ends the recognition of the phone: listen again until you tap stop
    if (VOICE.on && VOICE.fails < 3) { setTimeout(() => { if (VOICE.on && !VOICE.rec) { try { voiceListen(); } catch (err) { voiceEnd(); } } }, 120); return; }
    voiceEnd();
  };
  try { rec.start(); VOICE.rec = rec; } catch (e) { toast('Voice input could not start.'); voiceEnd(); }
}
function voiceEnd() {
  const o = VOICE.o;
  VOICE.on = false;
  clearInterval(VOICE.timer);
  VOICE.o = null;
  if (o) { o.set(voiceJoin(VOICE.base, VOICE.done)); o.ui(false); }
}
/* stop: the text stays in the field */
function voiceStop() {
  VOICE.on = false;
  if (VOICE.rec) { try { VOICE.rec.stop(); } catch (e) { voiceEnd(); } } else voiceEnd();
}
/* when the question is sent or the screen changes: stop without writing the text back */
function voiceCancel() {
  const o = VOICE.o;
  VOICE.o = null;
  VOICE.on = false;
  clearInterval(VOICE.timer);
  if (VOICE.rec) { try { VOICE.rec.abort(); } catch (e) { /* already stopped */ } }
  if (o) o.ui(false);
}

/* ------------------------------------------------------------ router */

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [p, id] = h.split('/');
  return { p: p || 'home', id: id ? decodeURIComponent(id) : null };
}
const isFormRoute = () => ['add', 'edit'].includes(route().p);
const go = (hash, replace) => { if (replace) { NAV.replacing = true; location.replace(hash); } else location.hash = hash; };

/* where you came from: the screens of this session in order, and how far down each was scrolled */
const NAV = { stack: [location.hash || '#/cellar'], scroll: {}, replacing: false, restore: null };
const NAV_LABEL = { home: 'Home', cellar: 'Cellar', window: 'Window', top: 'Top rated', insights: 'Insights', journal: 'Journal', sommelier: 'Sommelier', discover: 'Consultant', orders: 'Ordered', wishlist: 'Wishlist', 'journal-ai': 'Journal Assistant', taste: 'Taste test', settings: 'Settings', wine: 'Back', import: 'Import' };
const hashRoute = h => { const [p, id] = String(h || '').replace(/^#\/?/, '').split('/'); return { p: p || 'cellar', id: id ? decodeURIComponent(id) : null }; };
/* called on every change of the screen, before it is drawn */
function navTrack() {
  const h = location.hash || '#/cellar', st = NAV.stack;
  NAV.scroll[st[st.length - 1]] = window.scrollY;
  NAV.restore = null;
  if (NAV.replacing) { NAV.replacing = false; st[st.length - 1] = h; return; }
  if (st.length > 1 && st[st.length - 2] === h) { st.pop(); NAV.restore = NAV.scroll[h] || 0; return; }
  if (st[st.length - 1] !== h) st.push(h);
  if (st.length > 60) st.splice(0, st.length - 60);
}
/* the screen before this one, if you came from inside the app */
const navPrev = () => (NAV.stack.length > 1 ? NAV.stack[NAV.stack.length - 2] : null);
/* the back link of a detail page: to where you came from, else to a fixed screen */
function backLinkHtml(fallbackHash, fallbackLabel) {
  const prev = navPrev();
  const label = prev ? NAV_LABEL[hashRoute(prev).p] || 'Back' : fallbackLabel;
  return `<a class="back" href="${esc(prev || fallbackHash)}"${prev ? ' data-act="nav-back"' : ''}>${ICON.back}${esc(label)}</a>`;
}

function render() {
  const app = $('#app');
  const r = route();
  const key = r.p + '/' + (r.id || '');
  if (!CFG && r.p === 'rec') { app.innerHTML = viewRecPublic(r.id); return; }
  if (!CFG) {
    app.innerHTML = viewSettings(true);
    return;
  }
  if (r.p !== 'add' && r.p !== 'edit' && D) D = null;
  if (key !== lastRouteKey) U.addRatingOpen = false;
  let html;
  switch (r.p) {
    case 'home': html = viewHome(); break;
    case 'setup': html = viewSetup(); break;
    case 'window': html = viewWindow(); break;
    case 'top': html = viewTop(); break;
    case 'insights': html = viewInsights(); break;
    case 'sommelier': html = viewSommelier(); break;
    case 'discover': html = viewDiscover(); break;
    case 'orders': html = viewOrders(); break;
    case 'wishlist': html = viewWishlist(); break;
    case 'journal': html = viewJournal(); break;
    case 'journal-ai': html = viewJournalAI(); break;
    case 'taste': html = viewTaste(); break;
    case 'wine': html = viewWine(r.id); break;
    case 'add': html = viewForm('add', null); break;
    case 'edit': html = viewForm('edit', r.id); break;
    case 'settings': html = viewSettings(false); break;
    case 'import': html = viewImport(); break;
    case 'rec': setTimeout(() => recOpen(r.id)); html = viewHome(); break;
    default: html = viewCellar();
  }
  app.innerHTML = html;
  if (key !== lastRouteKey) window.scrollTo(0, NAV.restore || 0);
  NAV.restore = null;
  lastRouteKey = key;
  afterRender(r);
}

function afterRender(r) {
  if (r.p === 'wine') {
    const w = wineById(r.id);
    if (!w) return;
    const img = $('#label-img');
    if (img && w.labelFileId) imageUrl(w.labelFileId).then(u => { img.src = u; }).catch(() => { /* keep thumbnail */ });
  }
  if (r.p === 'sommelier') { const ta = $('#somm-text'); if (ta) autosize(ta); }
  clampChips();
  // a jump to a section, for example the wishlist from Insights
  if (U.jumpTo) { const el = $('#' + U.jumpTo); U.jumpTo = null; if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -10); } }
  if (r.p === 'journal-ai') { const ta = $('#ja-text'); if (ta) autosize(ta); }
  if ((r.p === 'add' || r.p === 'edit') && D && D.step === 'crop') setupCrop();
  if ((r.p === 'add' || r.p === 'edit') && D && D.step === 'camera') setupCamera(); else if (CAM.stream) camStop();
  if ((r.p === 'add' || r.p === 'edit') && D && D.step === 'form') { setupRating(); document.querySelectorAll('textarea.autosize').forEach(autosize); if (D.ai) updateBanner(); }
}
