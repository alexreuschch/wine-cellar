'use strict';

/* Wine Cellar, a private wine cellar app.
   Data lives in your Google Sheet, reached through your Google Apps Script web app. */

const APP_VERSION = '2.10.0';
const OPENCV_URL = 'https://docs.opencv.org/4.7.0/opencv.js';
const JSCANIFY_URL = 'https://cdn.jsdelivr.net/gh/ColonelParrot/jscanify@master/src/jscanify.min.js';

const SEG_COLORS = ['#9E0F0F', '#A8160F', '#B2210F', '#BC2D10', '#C53A12', '#CD4815', '#D55618', '#DD651C', '#E57620', '#EC8724', '#F09928', '#EFA82C', '#DFAE2E', '#CCAF30', '#B5AC31', '#9CA632', '#839E34', '#6A9636', '#528E38', '#3A863A'];
const STATUS = {
  'Past peak': { c: '#EC7A69', hint: 'Open these first' },
  'Drink soon': { c: '#EDAA45', hint: 'Past their peak, still drinking well' },
  'Peak': { c: '#5CC489', hint: 'Best time to open' },
  'Ready': { c: '#8FBF73', hint: 'Drinkable now, will still improve' },
  'Too young': { c: '#9AA8C2', hint: 'Keep resting' },
  'No window': { c: '#8F837C', hint: 'Add a drinking window to track these' }
};
const STATUS_ORDER = ['Past peak', 'Drink soon', 'Peak', 'Ready', 'Too young', 'No window'];
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
  book: svg('<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h10"/>', 22, 1.8),
  spark: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>', 18, 1.8),
  filter: svg('<path d="M4 5h16l-6 7v6l-4 2v-8z"/>', 20, 1.9),
  heart: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', 18, 1.9),
  bottle: svg('<path d="M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z"/>', 14, 1.8),
  chevron: svg('<path d="M9 6l6 6-6 6"/>', 14, 2),
  gift: svg('<path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7C10.5 4 7 4 7 6s3 1 5 1zM12 7c1.5-3 5-3 5-1s-3 1-5 1z"/>', 14, 1.8),
  cash: svg('<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>', 14, 1.8),
  cart: svg('<path d="M3 4h2l2.2 10.5a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>', 14, 1.8),
  move: svg('<path d="M4 9h13l-3-3M20 15H7l3 3"/>', 16, 1.9),
  tag: svg('<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.6"/>', 18, 1.8),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>', 16, 1.8),
  link: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', 13, 1.9),
  pin: svg('<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>', 14, 1.8)
};
const HEART_PATH = 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z';
const HEART_ON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${HEART_PATH}"/></svg>`;
const HEART_SM = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="margin-left:3px;vertical-align:-1px"><path d="${HEART_PATH}"/></svg>`;
const FIN = `<span class="fin" title="Finished" aria-label="Finished">${ICON.bottle}</span>`;
const GIFT_MARK = `<span class="gift-mark" title="Gift received" aria-label="Gift received">${ICON.gift}</span>`;
const STAR_PATH = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z';

/* ------------------------------------------------------------ helpers */

const $ = (s, el = document) => el.querySelector(s);
const esc = v => String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = v => (v === null || v === undefined ? '' : String(v));
const numOrNull = v => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
const splitList = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => String(s).trim()).filter(Boolean);
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
const S = { wines: [], removals: [], locations: [], shelfNames: {}, retailers: [], people: [], settings: { currency: 'CHF' }, fx: null, version: 0 };
const newF = () => ({ open: false, sel: {}, tab: null, q: {}, all: {} });
const U = {
  search: '', showFinished: false, f: { cellar: newF(), journal: newF(), top: newF() },
  winFilter: 'All', topMode: 'mine', topSys: null, topFinished: false, addRatingOpen: false,
  jSearch: '', jFav: false, locMove: null
};
let D = null;   // add or edit draft
let RS = null;  // bottom sheet state (bottles in or out, journal entries)
let lastRouteKey = '';

/* ------------------------------------------------------------ data model */

function parseRatings(v) {
  let a = v;
  if (!Array.isArray(a)) { try { a = JSON.parse(v || '[]'); } catch (e) { a = []; } }
  if (!Array.isArray(a)) return [];
  return a.filter(r => r && r.sys && r.score !== '' && r.score !== null && !isNaN(Number(r.score))).map(r => ({ sys: String(r.sys), score: Number(r.score) }));
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
    ? { shop: str(o.shop), v: Number(o.v), cur: str(o.cur) || 'CHF', url: str(o.url), vintage: str(o.vintage), area: str(o.area), date: str(o.date) } : null;
}

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
    ratings: parseRatings(w.ratings),
    labelFileId: str(w.labelFileId),
    thumb: str(w.thumb),
    createdAt: str(w.createdAt),
    updatedAt: str(w.updatedAt)
  };
}

/* money: every price keeps its own currency and is converted for display */
const CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'];
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
const placeLabel = e => [e.loc || 'No location', shelfLabel(e.loc, shelfVal(e.shelf)), str(e.pos).trim()].filter(Boolean).join(' · ');
const placeOf = e => ({ loc: str(e.loc), shelf: shelfVal(e.shelf), pos: str(e.pos).trim() });

const inEntries = w => S.removals.filter(r => r.wineId === w.id && r.dir === 'in');
const isGift = w => inEntries(w).some(r => r.type === 'Received');

/** Average purchase price per bottle over all purchases and gifts (gifts count as 0). Null when no price is known. */
function avgPrice(w) {
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
    const a = avgPrice(w), s = streetOf(w);
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
  ['drinkFrom', 'peakFrom', 'peakUntil', 'drinkUntil', 'myRating'].forEach(k => { if (o[k] === null) o[k] = ''; });
  return o;
}

function normRemoval(r) {
  return {
    id: str(r.id), wineId: str(r.wineId), date: str(r.date).slice(0, 10), type: str(r.type) || 'Other',
    occasion: str(r.occasion), people: str(r.people), hearts: str(r.hearts), food: str(r.food), note: str(r.note), wineName: str(r.wineName),
    dir: str(r.dir) === 'in' ? 'in' : 'out', qty: Math.max(1, Math.round(Number(r.qty) || 1)), loc: str(r.loc),
    price: numOrNull(r.price), priceCur: str(r.priceCur) || cur(), retailer: str(r.retailer)
  };
}

const lc = s => String(s).toLowerCase();
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
  if (Array.isArray(c.retailers)) S.retailers = c.retailers;
  if (Array.isArray(c.people)) S.people = c.people;
  if (c.settings) S.settings = Object.assign({ currency: 'CHF' }, c.settings);
  if (c.fx) S.fx = c.fx;
  if (c.version) S.version = c.version;
}
function persist() {
  store.set('wc-data', { wines: S.wines, removals: S.removals, locations: S.locations, shelfNames: S.shelfNames, retailers: S.retailers, people: S.people, settings: S.settings, fx: S.fx, version: S.version });
}
const wineById = id => S.wines.find(w => w.id === id);
function upsertWine(w) {
  const i = S.wines.findIndex(x => x.id === w.id);
  if (i >= 0) S.wines[i] = w; else S.wines.push(w);
}

const wineTitle = w => w.name || w.producer || 'Unnamed wine';
/* wine type color and country flag */
const TYPE_COLORS = { Red: '#8E1F2B', White: '#E6D98F', 'Rosé': '#E79AA6', Sparkling: '#F4E7B5', Dessert: '#D9A23A', Fortified: '#8A4B2A' };
const typeDot = w => `<span class="type-dot" style="--c:${TYPE_COLORS[w.type] || '#8F837C'}" title="${esc(w.type)}" aria-label="${esc(w.type)}"></span>`;
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

const wineSub = w => [w.name ? w.producer : '', w.vintage].filter(Boolean).join(' · ') || w.region || w.type;
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
  return 'Past peak';
}

function statusLine(w) {
  const p = windowParts(w);
  const s = statusOf(w);
  if (!p) return '';
  return {
    'Too young': `Ready from ${p.f}`,
    'Ready': `Peak from ${p.pf}`,
    'Peak': `Peak until ${p.pt}`,
    'Drink soon': `Drink by ${p.u}`,
    'Past peak': `Past peak since ${p.u + 1}`
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
    [e - (p.u + 1), STATUS['Past peak'].c]
  ].filter(x => x[0] > 0);
  const pos = clamp((TODAY - s) / (e - s) * 100, 0, 100);
  return `<div class="bar${big ? ' big' : ''}"><div class="bar-segs">${parts.map(x => `<div style="flex:${x[0]} 1 0;background:${x[1]}"></div>`).join('')}</div><div class="bar-marker" style="left:calc(${pos.toFixed(1)}% - 1px)"></div></div>`;
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
const thumbHtml = (w, sm) => (w.thumb
  ? `<img class="thumb${sm ? ' sm' : ''}" src="${esc(w.thumb)}" alt="">`
  : `<div class="thumb${sm ? ' sm' : ''} thumb-ph">${esc(initials(w))}</div>`);
const chip = (label, on, act, v, extra = '') => `<button class="chip${on ? ' on' : ''}" data-act="${act}" data-v="${esc(v)}">${extra}${esc(label)}</button>`;
const segsHtml = (v, h = 7, cls = '') => {
  const n = v === null ? 0 : Math.round(v / 5);
  return `<div class="segs ${cls}">${SEG_COLORS.map((c, i) => `<div style="height:${h}px;background:${i < n ? c : '#3A3034'}"></div>`).join('')}</div>`;
};
const starsHtml = v => `<div class="stars" aria-label="${esc(v)} of 5">${[0, 1, 2, 3, 4].map(i => {
  const wpx = (clamp(v - i, 0, 1) * 14).toFixed(1);
  return `<span class="star"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}" fill="#3A3034"/></svg><span class="fill" style="width:${wpx}px"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}" fill="#C9A15B"/></svg></span></span>`;
}).join('')}</div>`;
const typeBadge = t => (t === 'Gift' ? `<span class="badge gift">${ICON.gift}Gift given</span>`
  : t === 'Received' ? `<span class="badge received">${ICON.gift}Gift received</span>`
  : t === 'Sale' ? `<span class="badge sale">${ICON.cash}Sale</span>`
  : t === 'Purchase' ? `<span class="badge purchase">${ICON.cart}Purchase</span>`
  : t === 'Added' ? '<span class="badge">Added</span>'
  : `<span class="badge${t === 'Celebration' ? ' celebration' : ''}">${esc(t)}</span>`);

function nav(active) {
  const item = (href, key, icon, label) => `<a href="${href}" class="${active === key ? 'on' : ''}">${icon}${label}</a>`;
  return `<nav class="nav" aria-label="Main">${item('#/cellar', 'cellar', ICON.glass, 'Cellar')}${item('#/window', 'window', ICON.clock, 'Window')}${item('#/top', 'top', ICON.trophy, 'Top rated')}${item('#/journal', 'journal', ICON.book, 'Journal')}</nav>`;
}

function toast(msg, ms = 3400) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), ms);
}

function busy(on, label = 'Saving…') {
  const b = $('#busy');
  if (on) { b.querySelector('p').textContent = label; b.hidden = false; } else b.hidden = true;
}

/* ------------------------------------------------------------ API */

async function api(action, payload = {}, cfg = CFG) {
  if (!cfg) throw new Error('Not connected');
  let res;
  try {
    res = await fetch(cfg.url, { method: 'POST', body: JSON.stringify(Object.assign({ token: cfg.token, action }, payload)) });
  } catch (e) {
    throw new Error('Could not reach your script. Check your connection and the script URL.');
  }
  let out;
  try { out = await res.json(); } catch (e) {
    throw new Error('Could not reach your script. Check the script URL and that access is set to Anyone.');
  }
  if (!out.ok) throw new Error(out.error || 'Unknown error');
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
    S.retailers = Array.isArray(d.retailers) ? d.retailers.map(r => ({ name: str(r.name), website: str(r.website) })).filter(r => r.name) : [];
    S.people = Array.isArray(d.people) ? d.people.map(str).filter(Boolean) : [];
    if (d.settings) S.settings = Object.assign({ currency: 'CHF' }, d.settings);
    if (d.fx) S.fx = d.fx;
    persist();
    if (!isFormRoute()) render();
    if (!silent) toast('Up to date');
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

/* ------------------------------------------------------------ router */

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [p, id] = h.split('/');
  return { p: p || 'cellar', id: id ? decodeURIComponent(id) : null };
}
const isFormRoute = () => ['add', 'edit'].includes(route().p);
const go = (hash, replace) => (replace ? location.replace(hash) : (location.hash = hash));

function render() {
  const app = $('#app');
  const r = route();
  const key = r.p + '/' + (r.id || '');
  if (!CFG) {
    app.innerHTML = viewSettings(true);
    return;
  }
  if (r.p !== 'add' && r.p !== 'edit' && D) D = null;
  if (key !== lastRouteKey) U.addRatingOpen = false;
  let html;
  switch (r.p) {
    case 'window': html = viewWindow(); break;
    case 'top': html = viewTop(); break;
    case 'journal': html = viewJournal(); break;
    case 'wine': html = viewWine(r.id); break;
    case 'add': html = viewForm('add', null); break;
    case 'edit': html = viewForm('edit', r.id); break;
    case 'settings': html = viewSettings(false); break;
    default: html = viewCellar();
  }
  app.innerHTML = html;
  if (key !== lastRouteKey) window.scrollTo(0, 0);
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
  if ((r.p === 'add' || r.p === 'edit') && D && D.step === 'crop') setupCrop();
  if ((r.p === 'add' || r.p === 'edit') && D && D.step === 'form') { setupRating(); document.querySelectorAll('textarea.autosize').forEach(autosize); if (D.ai) updateBanner(); }
}

/* ------------------------------------------------------------ view: cellar */

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const grapeNames = w => String(w.grapes || '').split(/[,;\/+&]/)
  .map(s => cap(s.replace(/\d+([.,]\d+)?\s*%?/g, '').replace(/\s+/g, ' ').trim()))
  .filter(s => s.length > 1);
const foodNames = w => w.pairings.map(s => cap(s.trim())).filter(Boolean);
const cellarPool = () => S.wines.filter(w => U.showFinished || w.count > 0);
const topPool = () => S.wines.filter(w => U.topFinished || w.count > 0);
const ENTRY_LABEL = { Gift: 'Gift given', Received: 'Gift received', Added: 'Added' };
const entryType = r => ENTRY_LABEL[r.type] || r.type || 'Other';
const entryWine = r => { const w = wineById(r.wineId); return w ? `${wineTitle(w)} ${w.vintage}`.trim() : (r.wineName || 'Deleted wine'); };
const switchHtml = (change, on, label) => `<label class="switch"><input type="checkbox" data-change="${change}"${on ? ' checked' : ''}>${label}</label>`;
const offChip = (act, label) => `<button class="chip on" data-act="${act}" aria-label="Turn off ${label}">${label}${ICON.x}</button>`;

/* ------------------------------------------------------------ shared filter (cellar, journal, top rated) */

const F_WINE = { label: 'Wine', plural: 'wine types', of: w => [w.type], order: TYPES };
const F_GRAPE = { label: 'Grape', plural: 'grapes', of: grapeNames };
const F_RATING = { label: 'Rating', kind: 'rating', of: () => [] };
const F_PRICE = { label: 'Street', chip: 'Street', plural: 'street prices', kind: 'range', of: () => [], val: w => streetOf(w) };
const CTX = {
  cellar: {
    noun: 'wines',
    facets: {
      wine: F_WINE,
      grape: F_GRAPE,
      food: { label: 'Food', plural: 'dishes', of: foodNames },
      location: { label: 'Location', plural: 'locations', of: w => w.stock.map(e => e.loc).filter(Boolean) },
      price: F_PRICE,
      rating: F_RATING
    },
    items: () => cellarPool(),
    text: w => matches(w, U.search),
    extra: () => { const done = S.wines.filter(w => w.count === 0).length; return done ? switchHtml('show-finished', U.showFinished, `Include finished wines (${done})`) : ''; },
    badges: () => ''
  },
  journal: {
    noun: 'entries',
    facets: {
      person: { label: 'Person', plural: 'people', of: r => namesOf(r.people) },
      type: { label: 'Type', plural: 'types', of: r => [entryType(r)], order: ['Dinner', 'Lunch', 'Celebration', 'Other', 'Gift given', 'Sale', 'Purchase', 'Gift received', 'Added'] },
      retailer: { label: 'Retailer', plural: 'retailers', of: r => (r.retailer ? [r.retailer] : []) }
    },
    items: () => allEntries(),
    text: r => journalTextMatch(r),
    extra: () => (S.removals.some(r => namesOf(r.hearts).length) ? switchHtml('j-fav', U.jFav, `Only favorite wines<span class="heart-on">${HEART_SM}</span>`) : ''),
    badges: () => (U.jFav ? offChip('j-fav-off', 'Favorites only') : '')
  },
  top: {
    noun: 'wines',
    facets: {
      wine: F_WINE,
      grape: F_GRAPE,
      window: { label: 'Window', plural: 'drinking windows', of: w => [statusOf(w)], order: STATUS_ORDER, dot: v => (STATUS[v] || {}).c },
      price: F_PRICE
    },
    items: () => topPool(),
    text: () => true,
    extra: () => (S.wines.some(w => w.count === 0) ? switchHtml('top-finished', U.topFinished, 'Include finished wines') : ''),
    badges: () => (U.topFinished ? offChip('top-finished-off', 'Incl. finished') : '')
  }
};

const fst = ctx => U.f[ctx];
const sel = (ctx, k) => { const s = U.f[ctx].sel; return s[k] || (s[k] = []); };
const isRange = def => def.kind === 'range';
const rng = (ctx, k) => { const st = U.f[ctx]; return (st.range || (st.range = {}))[k] || null; };
const isRating = def => def.kind === 'rating';
const rflt = ctx => U.f[ctx].rating || null;
const facetN = (ctx, k) => { const def = CTX[ctx].facets[k]; return isRange(def) ? (rng(ctx, k) ? 1 : 0) : isRating(def) ? (rflt(ctx) ? 1 : 0) : sel(ctx, k).length; };
const activeCount = ctx => Object.keys(CTX[ctx].facets).reduce((a, k) => a + facetN(ctx, k), 0);

/* rating filter: one system, at least a value on its own scale */
const rSysName = sys => (sys === 'mine' ? 'My rating' : sys);
const rScale = sys => { const max = sys === 'mine' ? 100 : sysInfo(sys).max; return { max, step: max === 5 ? 0.1 : max === 20 ? 0.5 : 1 }; };
const ratingOf = (w, sys) => { if (sys === 'mine') return w.myRating; const r = w.ratings.find(x => x.sys === sys); return r ? r.score : null; };
const rFmt = (sys, v) => (sys === 'mine' ? `${Math.round(v)}%` : `${fmtScore(sys, v)} /${rScale(sys).max}`);
function ratingSystems(ctx) {
  const items = CTX[ctx].items();
  const out = items.some(w => w.myRating !== null) ? ['mine'] : [];
  SYSTEMS.forEach(x => { if (items.some(w => w.ratings.some(r => r.sys === x.key))) out.push(x.key); });
  return out;
}
function passes(ctx, item, except) {
  const fs = CTX[ctx].facets;
  return Object.keys(fs).every(k => {
    if (k === except) return true;
    const def = fs[k];
    if (isRating(def)) {
      const r = rflt(ctx);
      if (!r) return true;
      const v = ratingOf(item, r.sys);
      return v !== null && v >= r.min - 1e-9;
    }
    if (isRange(def)) {
      const r = rng(ctx, k);
      if (!r) return true;
      const v = def.val(item);
      return v !== null && v >= r[0] && v <= r[1] + 0.005;
    }
    return !sel(ctx, k).length || def.of(item).some(v => sel(ctx, k).includes(lc(v)));
  });
}
function rangeMax(ctx, k) {
  const def = CTX[ctx].facets[k];
  const vals = CTX[ctx].items().map(def.val).filter(v => v !== null);
  return vals.length ? Math.ceil(Math.max(...vals)) : 0;
}

function facetValues(items, def) {
  const m = new Map();
  items.forEach(it => {
    const seen = new Set();
    def.of(it).forEach(v => {
      const k = lc(v);
      if (!k || seen.has(k)) return;
      seen.add(k);
      const e = m.get(k) || { key: k, name: v, n: 0 };
      e.n += 1;
      m.set(k, e);
    });
  });
  const list = [...m.values()];
  if (def.order) {
    const idx = n => { const i = def.order.indexOf(n); return i < 0 ? 99 : i; };
    return list.sort((a, b) => idx(a.name) - idx(b.name));
  }
  return list.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

function filterButton(ctx) {
  const n = activeCount(ctx), st = fst(ctx);
  return `<button class="filter-btn${st.open || n ? ' on' : ''}" data-act="f-toggle" data-ctx="${ctx}" aria-expanded="${st.open}" aria-label="Filter">${ICON.filter}${n ? `<span class="count">${n}</span>` : ''}</button>`;
}

function filterArea(ctx) {
  const c = CTX[ctx], st = fst(ctx);
  const base = c.items();
  const allVals = {};
  const active = [];
  Object.keys(c.facets).forEach(k => {
    const def = c.facets[k];
    if (isRating(def)) {
      const r = rflt(ctx);
      if (r) active.push({ k, rating: true, name: `${rSysName(r.sys)} at least ${rFmt(r.sys, r.min)}` });
      return;
    }
    if (isRange(def)) {
      const r = rng(ctx, k);
      if (r) active.push({ k, range: true, name: `${def.chip || def.label} ${money(r[0], 0)} to ${fmtNum(r[1], 0)}` });
      return;
    }
    allVals[k] = facetValues(base, def);
    st.sel[k] = sel(ctx, k).filter(v => allVals[k].some(x => x.key === v));
    st.sel[k].forEach(v => active.push({ k, v, name: allVals[k].find(x => x.key === v).name }));
  });
  const clear = active.length ? `<button class="chip" data-act="f-clear" data-ctx="${ctx}">Clear all filters</button>` : '';
  const activeChip = a => (a.rating
    ? `<button class="chip on" data-act="rating-clear" data-ctx="${ctx}" aria-label="Remove rating filter">${esc(a.name)}${ICON.x}</button>`
    : a.range
    ? `<button class="chip on" data-act="range-clear" data-ctx="${ctx}" data-k="${a.k}" aria-label="Remove price filter">${esc(a.name)}${ICON.x}</button>`
    : `<button class="chip on" data-act="f-chip" data-ctx="${ctx}" data-k="${a.k}" data-v="${esc(a.v)}" aria-label="Remove filter ${esc(a.name)}">${esc(a.name)}${ICON.x}</button>`);
  if (!st.open) {
    const badges = c.badges();
    return active.length || badges ? `<div class="chips">${active.map(activeChip).join('')}${badges}${clear}</div>` : '';
  }
  const tabs = Object.keys(c.facets).filter(k => (isRange(c.facets[k]) ? rangeMax(ctx, k) > 0 : isRating(c.facets[k]) ? ratingSystems(ctx).length > 0 : allVals[k].length));
  const extra = c.extra();
  if (!tabs.length) return `<div class="card filter-panel"><p class="muted small" style="margin:0">Nothing to filter by yet.</p>${extra}</div>`;
  if (!tabs.includes(st.tab)) st.tab = tabs[0];
  const k = st.tab;
  const nSel = t => facetN(ctx, t);
  const cols = tabs.length <= 2 ? tabs.length : tabs.length === 4 ? 2 : 3;
  const tabBar = `<div class="ftabs" role="tablist" style="grid-template-columns:repeat(${cols}, minmax(0, 1fr))">${tabs.map(t => `<button role="tab" aria-selected="${t === k}" class="ftab${t === k ? ' on' : ''}" data-act="f-tab" data-ctx="${ctx}" data-v="${t}">${c.facets[t].label}${nSel(t) ? `<span class="count">${nSel(t)}</span>` : ''}</button>`).join('')}</div>`;
  const search = allVals[k] && allVals[k].length > 12
    ? `<label class="search compact">${ICON.search}<input type="search" data-input="facetq" data-ctx="${ctx}" aria-label="Search ${c.facets[k].plural}" placeholder="Search ${c.facets[k].plural}" value="${esc(st.q[k] || '')}"></label>` : '';
  return `<div class="card filter-panel">${tabBar}${search}<div id="facet-chips-${ctx}">${facetChipsHtml(ctx)}</div>${extra}${clear ? `<div>${clear}</div>` : ''}</div>`;
}

function facetChipsHtml(ctx) {
  const c = CTX[ctx], st = fst(ctx), k = st.tab, def = c.facets[k];
  if (!def) return '';
  if (isRange(def)) return rangeHtml(ctx, k);
  if (isRating(def)) return ratingHtml(ctx);
  const vals = facetValues(c.items().filter(it => c.text(it) && passes(ctx, it, k)), def);
  const all = facetValues(c.items(), def);
  const chosen = sel(ctx, k);
  const q = lc((st.q[k] || '').trim());
  const selected = chosen.map(v => vals.find(x => x.key === v) || all.find(x => x.key === v) || { key: v, name: v, n: 0 });
  let rest = vals.filter(x => !chosen.includes(x.key));
  let more = '', boxed = false;
  if (q) rest = byName(rest.filter(x => lc(x.name).includes(q)));
  else if (st.all[k] && rest.length > 12) { rest = def.order ? rest : byName(rest); boxed = true; }
  else if (rest.length > 12) { more = `<button class="chip" data-act="f-more" data-ctx="${ctx}" data-k="${k}">Show all ${rest.length}</button>`; rest = rest.slice(0, 12); }
  const dot = x => (def.dot && def.dot(x.name) ? `<span class="dot" style="--c:${def.dot(x.name)}"></span>` : '');
  const chip = (x, on) => `<button class="chip${on ? ' on' : ''}" data-act="f-chip" data-ctx="${ctx}" data-k="${k}" data-v="${esc(x.key)}">${dot(x)}${esc(x.name)}${on ? ICON.x : ` <span class="n">${x.n}</span>`}</button>`;
  const parts = [];
  if (selected.length) parts.push(`<div class="chips">${selected.map(x => chip(x, true)).join('')}</div>`);
  if (rest.length) parts.push(`<div class="chips${boxed ? ' scroll-box' : ''}">${rest.map(x => chip(x, false)).join('')}${more}</div>`);
  else if (q) parts.push('<p class="muted small" style="margin:0">No match.</p>');
  if (boxed) parts.push(`<div><button class="chip" data-act="f-less" data-ctx="${ctx}" data-k="${k}">Show fewer</button></div>`);
  const how = def.order && !q ? '' : (q || boxed ? 'A to Z. ' : 'Most common first. ');
  parts.push(`<p class="muted tiny" style="margin:0">${how}Numbers count the ${c.noun} that match together with your other filters.</p>`);
  return `<div style="display:flex;flex-direction:column;gap:8px">${parts.join('')}</div>`;
}

/* street price range: a bar with two handles */
function rangeCountText(ctx, k) {
  const c = CTX[ctx];
  const n = c.items().filter(it => c.text(it) && passes(ctx, it)).length;
  const none = c.items().filter(it => c.facets[k].val(it) === null).length;
  const verb = none === 1 ? (rng(ctx, k) ? 'is hidden' : 'is not affected until you move a handle') : (rng(ctx, k) ? 'are hidden' : 'are not affected until you move a handle');
  return `${n} ${n === 1 ? 'wine matches' : 'wines match'}.${none ? ` ${none} ${none === 1 ? 'wine' : 'wines'} without a street price ${verb}.` : ''}`;
}
function rangeHtml(ctx, k) {
  const max = rangeMax(ctx, k);
  const r = rng(ctx, k) || [0, max];
  const lo = clamp(r[0], 0, max), hi = clamp(r[1], 0, max);
  const pct = v => (max ? v / max * 100 : 0).toFixed(1);
  const input = (end, v, label) => `<input type="range" min="0" max="${max}" step="1" value="${Math.round(v)}" data-input="rng" data-ctx="${ctx}" data-k="${k}" data-end="${end}" aria-label="${label}">`;
  return `<div class="dual-wrap">
    <div class="between"><span class="dual-val" id="rng-lo-${ctx}">${money(lo, 0)}</span><span class="dual-val" id="rng-hi-${ctx}">${money(hi, 0)}</span></div>
    <div class="dual" id="rng-${ctx}" style="--a:${pct(lo)}%;--b:${pct(hi)}%"><div class="dual-track"></div><div class="dual-fill"></div>${input('lo', lo, 'Lowest street price')}${input('hi', hi, 'Highest street price')}</div>
    <p class="muted tiny" style="margin:0" id="rng-n-${ctx}">${rangeCountText(ctx, k)}</p>
  </div>`;
}
function refreshFilterResults(ctx) {
  const fb = $(`[data-act="f-toggle"][data-ctx="${ctx}"]`);
  if (fb) fb.outerHTML = filterButton(ctx);
  if (ctx === 'cellar') {
    const l = $('#wine-list'), d = $('#drink-soon');
    if (l) l.innerHTML = cellarList();
    if (d) d.innerHTML = drinkSoonHtml();
  } else if (ctx === 'top') {
    const l = $('#top-list');
    if (l) l.innerHTML = topBody();
  }
}

function ratingCountText(ctx) {
  const c = CTX[ctx], r = rflt(ctx);
  const n = c.items().filter(it => c.text(it) && passes(ctx, it)).length;
  const none = r ? c.items().filter(it => ratingOf(it, r.sys) === null).length : 0;
  return `${n} ${n === 1 ? 'wine matches' : 'wines match'}.${none ? ` ${none} ${none === 1 ? 'wine' : 'wines'} without a ${rSysName(r.sys)} rating ${none === 1 ? 'is' : 'are'} hidden.` : ''}`;
}

function ratingHtml(ctx) {
  const r = rflt(ctx);
  const chips = ratingSystems(ctx).map(sys => `<button class="chip${r && r.sys === sys ? ' on' : ''}" data-act="rt-sys" data-ctx="${ctx}" data-v="${esc(sys)}">${esc(rSysName(sys))}${r && r.sys === sys ? ICON.x : ''}</button>`).join('');
  if (!r) return `<div style="display:flex;flex-direction:column;gap:8px"><div class="chips">${chips}</div><p class="muted tiny" style="margin:0">Choose one rating system, then set the lowest rating to show.</p></div>`;
  const sc = rScale(r.sys);
  return `<div style="display:flex;flex-direction:column;gap:8px"><div class="chips">${chips}</div>
    <div class="between"><span class="small muted">At least</span><span class="dual-val" id="rt-val-${ctx}">${rFmt(r.sys, r.min)}</span></div>
    <div class="single"><input type="range" min="0" max="${sc.max}" step="${sc.step}" value="${r.min}" data-input="rtmin" data-ctx="${ctx}" aria-label="Lowest ${esc(rSysName(r.sys))}" style="--p:${(r.min / sc.max * 100).toFixed(1)}%"></div>
    <p class="muted tiny" style="margin:0" id="rt-n-${ctx}">${ratingCountText(ctx)}</p></div>`;
}

function onRatingMin(el) {
  const ctx = el.dataset.ctx, r = rflt(ctx);
  if (!r) return;
  r.min = Number(el.value);
  el.style.setProperty('--p', (r.min / rScale(r.sys).max * 100) + '%');
  $('#rt-val-' + ctx).textContent = rFmt(r.sys, r.min);
  $('#rt-n-' + ctx).textContent = ratingCountText(ctx);
  refreshFilterResults(ctx);
}

function onRange(el) {
  const ctx = el.dataset.ctx, k = el.dataset.k;
  const box = $('#rng-' + ctx);
  if (!box) return;
  const [a, b] = box.querySelectorAll('input');
  let lo = Number(a.value), hi = Number(b.value);
  if (lo > hi) { if (el.dataset.end === 'lo') { lo = hi; a.value = lo; } else { hi = lo; b.value = hi; } }
  const max = Number(a.max);
  const st = U.f[ctx];
  st.range = st.range || {};
  if (lo <= 0 && hi >= max) delete st.range[k]; else st.range[k] = [lo, hi];
  box.style.setProperty('--a', (max ? lo / max * 100 : 0) + '%');
  box.style.setProperty('--b', (max ? hi / max * 100 : 0) + '%');
  $('#rng-lo-' + ctx).textContent = money(lo, 0);
  $('#rng-hi-' + ctx).textContent = money(hi, 0);
  $('#rng-n-' + ctx).textContent = rangeCountText(ctx, k);
  refreshFilterResults(ctx);
}

/* ------------------------------------------------------------ view: cellar */

function drinkSoonHtml() {
  if (U.search.trim() || activeCount('cellar')) return '';
  const list = S.wines.filter(w => w.count > 0 && ['Past peak', 'Drink soon'].includes(statusOf(w))).sort(urgencyCmp);
  if (!list.length) return '';
  return `<section><h2>Drink soon <span class="muted small" style="font-weight:400">${list.length}</span></h2><div>${list.map(wineRow).join('')}</div></section>`;
}

function statsHtml() {
  const inStock = S.wines.filter(w => w.count > 0);
  const bottles = inStock.reduce((a, w) => a + w.count, 0);
  const t = totals();
  const cell = (label, value, unit = '', cls = '') => `<div><span class="st-label">${label}</span><b class="${cls}">${value}</b><span class="st-unit">${unit || '&nbsp;'}</span></div>`;
  return `<div class="stats">${cell('Wines', inStock.length)}${cell('Bottles', bottles)}${cell('Total Costs', t.costN ? fmtNum(t.cost, 0) : 'N/A', cur())}${cell('Total Street', t.streetN ? fmtNum(t.street, 0) : 'N/A', cur())}</div>`;
}

function viewCellar() {
  const head = `<header class="top"><div><h1 class="title">Wine Cellar</h1></div>
    <div class="top-actions"><button class="icon-btn" data-act="refresh" aria-label="Refresh">${ICON.refresh}</button><a class="icon-btn" href="#/settings" aria-label="Settings">${ICON.gear}</a></div></header>`;
  const notice = S.version && S.version < 10 ? `<div class="card notice"><b>Script update needed</b><p class="small" style="margin:4px 0 0">This app version needs the new Code.gs. Replace the script code and create a new version under Manage deployments.</p></div>` : '';
  if (!S.wines.length) {
    return `<main class="screen has-nav">${head}${notice}<div class="empty"><h2>Your cellar is empty</h2><p>Photograph a label and the details are filled in for you.</p><a class="btn primary" href="#/add">Add your first wine</a></div></main>${nav('cellar')}`;
  }
  const filters = filterArea('cellar');
  const btn = filterButton('cellar');
  return `<main class="screen has-nav">${head}${notice}${statsHtml()}
    <div style="display:flex;gap:8px"><label class="search" style="flex:1;min-width:0">${ICON.search}<input type="search" data-input="search" aria-label="Search" placeholder="Search wine, grape or food" value="${esc(U.search)}"></label>${btn}</div>
    ${filters}
    <div id="drink-soon">${drinkSoonHtml()}</div>
    <section><h2>All wines</h2><div id="wine-list">${cellarList()}</div></section>
  </main><a class="fab" href="#/add" aria-label="Add a new wine">${ICON.plusBig}</a>${nav('cellar')}`;
}

function matches(w, q) {
  if (!q) return true;
  const ins = inEntries(w);
  const hay = [w.producer, w.name, w.vintage, w.region, w.grapes, w.type, w.stock.map(e => e.loc).join(' '), ins.map(e => e.retailer + ' ' + e.people).join(' '), w.pairings.join(' '), w.tasteTags.join(' ')].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every(part => hay.includes(part));
}

function priceLine(w) {
  const a = avgPrice(w), s = streetOf(w);
  const cls = a === null || s === null || a === s ? '' : a < s ? 'up' : 'down';
  const part = (label, v, c = '') => `<span class="pp">${label} <b class="${c}">${v}</b></span>`;
  return `<span class="price-row">${part('Ø Cost', a !== null ? fmtNum(a) : 'N/A', cls)}${part('Street', s !== null ? fmtNum(s) : 'N/A')}${w.count > 0 ? part('Total', s !== null ? fmtNum(s * w.count) : 'N/A') : ''}${w.count > 0 ? pill(w) : ''}</span>`;
}

function wineRow(w) {
  return `<div class="wine-row${w.count === 0 ? ' finished' : ''}">
    <a class="row-link" href="#/wine/${encodeURIComponent(w.id)}">${thumbHtml(w)}<div class="row-text"><span class="row-title">${typeDot(w)}${esc(wineTitle(w))}${isGift(w) ? GIFT_MARK : ''}${w.count === 0 ? FIN : ''}</span><span class="row-sub">${flagOf(w)}${esc(wineSub(w))}</span></div></a>
    <div class="stepper"><button data-act="minus" data-id="${esc(w.id)}" aria-label="Remove a bottle"${w.count ? '' : ' disabled'}>${ICON.minus}</button><span>${w.count}</span><button data-act="plus" data-id="${esc(w.id)}" aria-label="Add bottles">${ICON.plus}</button></div>
    <a class="row-foot" href="#/wine/${encodeURIComponent(w.id)}">${priceLine(w)}</a>
  </div>`;
}

function cellarList() {
  const list = S.wines.filter(w => matches(w, U.search) && passes('cellar', w))
    .sort((a, b) => wineTitle(a).localeCompare(wineTitle(b)) || str(a.vintage).localeCompare(str(b.vintage)));
  const stock = list.filter(w => w.count > 0), done = list.filter(w => w.count === 0);
  const filtered = U.search || activeCount('cellar');
  let html = stock.length ? stock.map(wineRow).join('') : `<p class="muted small">${filtered ? 'No wine in stock matches your search or filter.' : 'No bottles in stock.'}</p>`;
  if (done.length) {
    if (U.showFinished) html += done.map(wineRow).join('');
    html += `<button class="btn ghost" data-act="toggle-finished">${U.showFinished ? 'Hide' : 'Show'} finished wines (${done.length})</button>`;
  }
  return html;
}

/* ------------------------------------------------------------ view: drinking window */

function viewWindow() {
  const items = S.wines.filter(w => w.count > 0).map(w => ({ w, s: statusOf(w) }));
  const bottles = items.reduce((a, x) => a + x.w.count, 0);
  const groups = STATUS_ORDER.map(s => ({ s, items: items.filter(x => x.s === s).map(x => x.w).sort(urgencyCmp) })).filter(g => g.items.length);
  if (U.winFilter !== 'All' && !groups.some(g => g.s === U.winFilter)) U.winFilter = 'All';
  const shown = U.winFilter === 'All' ? groups : groups.filter(g => g.s === U.winFilter);
  const overview = groups.map(g => `<div style="flex:${g.items.reduce((a, w) => a + w.count, 0)} 1 0;background:${STATUS[g.s].c}"></div>`).join('');
  const filters = [`<button class="chip${U.winFilter === 'All' ? ' on' : ''}" data-act="winf" data-v="All">All <span class="n">${items.length}</span></button>`]
    .concat(groups.map(g => `<button class="chip${U.winFilter === g.s ? ' on' : ''}" data-act="winf" data-v="${esc(g.s)}"><span class="dot" style="--c:${STATUS[g.s].c}"></span>${g.s} <span class="n">${g.items.length}</span></button>`)).join('');
  const body = !items.length
    ? `<div class="empty"><h2>No bottles in stock</h2><p>Wines you add appear here, sorted by when to drink them.</p></div>`
    : `<div class="overview">${overview}</div><div class="chips">${filters}</div>` + shown.map(g => `<section>
        <div style="display:flex;align-items:center;gap:8px"><span class="dot" style="--c:${STATUS[g.s].c};width:10px;height:10px"></span><h2>${g.s}</h2><span class="muted small">${g.items.length} ${g.items.length === 1 ? 'wine' : 'wines'}</span></div>
        <p class="muted tiny" style="margin:-6px 0 0 18px">${STATUS[g.s].hint}</p>
        ${g.items.map(w => `<a class="journal-row" href="#/wine/${encodeURIComponent(w.id)}" style="align-items:center">${thumbHtml(w, true)}<div class="row-text" style="gap:6px"><div class="between"><span class="row-title">${typeDot(w)}${flagOf(w)}${esc(wineTitle(w))} ${esc(w.vintage)}</span><span class="muted small" style="flex:none">${w.count} btl</span></div>${timelineHtml(w)}<span class="muted tiny">${esc(windowText(w) || 'No drinking window yet')}</span></div></a>`).join('')}
      </section>`).join('');
  return `<main class="screen has-nav"><header><h1 class="title">Drinking window</h1><p class="muted small" style="margin:2px 0 0">${bottles} bottles · ${items.length} wines · sorted by urgency</p></header>${body}</main>${nav('window')}`;
}

/* ------------------------------------------------------------ view: top rated */

function viewTop() {
  const filters = filterArea('top');
  const btn = filterButton('top');
  const lead = `<header class="top"><h1 class="title">Top rated</h1><div class="top-actions">${btn}</div></header>
    ${filters}
    <div class="toggle"><button class="${U.topMode === 'mine' ? 'on' : ''}" data-act="top-mode" data-v="mine">My rating</button><button class="${U.topMode === 'ext' ? 'on' : ''}" data-act="top-mode" data-v="ext">External</button></div>
    ${U.topFinished ? `<p class="muted tiny" style="margin:-6px 0 0;display:flex;align-items:center;gap:2px">${FIN}<span style="margin-left:4px">marks a finished wine with no bottles left</span></p>` : ''}`;
  return `<main class="screen has-nav">${lead}<div id="top-list">${topBody()}</div></main>${nav('top')}`;
}

function topBody() {
  const pool = topPool().filter(w => passes('top', w));
  const filtered = activeCount('top') > 0;
  if (U.topMode === 'mine') {
    const rated = pool.filter(w => w.myRating !== null).sort((a, b) => b.myRating - a.myRating);
    return rated.length ? rated.map((w, i) => topRow(w, i, segsHtml(w.myRating), `<b>${w.myRating}%</b>`, '')).join('')
      : `<div class="empty"><h2>${filtered ? 'No rated wine matches your filter' : 'No ratings yet'}</h2><p>${filtered ? 'Change or clear the filter.' : 'Open a wine, tap Edit and drag the rating bar to rate it.'}</p></div>`;
  }
  const counts = {};
  pool.forEach(w => w.ratings.forEach(r => { counts[r.sys] = (counts[r.sys] || 0) + 1; }));
  const avail = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  if (!avail.length) return `<div class="empty"><h2>No external ratings ${filtered ? 'in this selection' : 'yet'}</h2><p>Add Vivino, Parker, Falstaff and other scores when you add or edit a wine.</p></div>`;
  const sys = avail.includes(U.topSys) ? U.topSys : avail[0];
  const max = sysInfo(sys).max;
  const list = pool.map(w => ({ w, r: w.ratings.find(r => r.sys === sys) })).filter(x => x.r).sort((a, b) => b.r.score - a.r.score);
  return `<div class="chips">${avail.map(k => `<button class="chip sq${k === sys ? ' on' : ''}" data-act="top-sys" data-v="${esc(k)}">${esc(k)} <span class="n">${counts[k]}</span></button>`).join('')}</div>
    <p class="muted tiny" style="margin:8px 0 0">Only rating systems used in this selection are shown. ${list.length} of ${pool.length} wines rated by ${esc(sys)}.</p>
    <div>${list.map((x, i) => topRow(x.w, i, max === 5 ? starsHtml(x.r.score) : '', `<b>${fmtScore(sys, x.r.score)}</b><span> /${max}</span>`, x.w.myRating !== null ? `My rating ${x.w.myRating}%` : 'Not rated by you')).join('')}</div>`;
}

function topRow(w, i, visual, score, sub) {
  const s = streetOf(w);
  const subLine = [sub, s !== null ? `Street ${money(s)}` : ''].filter(Boolean).join(' · ');
  return `<a class="journal-row${w.count === 0 ? ' finished' : ''}" href="#/wine/${encodeURIComponent(w.id)}" style="align-items:center"><span class="rank">${i + 1}</span>${thumbHtml(w, true)}
    <div class="row-text" style="gap:5px"><div class="between"><span class="row-title">${typeDot(w)}${flagOf(w)}${esc(wineTitle(w))} ${esc(w.vintage)}${w.count === 0 ? FIN : ''}</span>${w.count > 0 ? `<span class="muted small" style="flex:none">${w.count} btl</span>` : ''}</div>${visual}${subLine ? `<span class="muted tiny ellipsis">${esc(subLine)}</span>` : ''}</div>
    <div class="score">${score}</div></a>`;
}

/* ------------------------------------------------------------ view: journal */

function peopleLine(r) {
  const names = namesOf(r.people);
  if (!names.length) return '';
  const hearts = namesOf(r.hearts).map(lc);
  const pre = { Gift: 'Given to ', Received: 'From ', Sale: 'Sold to ' }[r.type] || 'With ';
  return pre + names.map(n => esc(n) + (hearts.includes(lc(n)) ? `<span class="heart-on" aria-label="favorite wine">${HEART_SM}</span>` : '')).join(', ');
}

/** Quantity, location, retailer and price of an entry, for journal and detail rows. */
function entryMeta(r, withLoc = true) {
  const parts = [];
  if (r.qty > 1) parts.push(`${r.qty} bottles`);
  if (r.type === 'Purchase' && r.retailer) parts.push(esc(r.retailer));
  if ((r.type === 'Purchase' || r.type === 'Sale') && r.price !== null) {
    const p = `${priceText(r.price, r.priceCur)}${r.qty > 1 ? ' each' : ''}`;
    parts.push(r.type === 'Sale' ? `<span class="up">${p}</span>` : p);
  }
  if (withLoc && r.loc) parts.push(`${r.dir === 'in' ? 'to' : 'from'} ${esc(r.loc)}`);
  return parts.join(' · ');
}

const allEntries = () => S.removals;

function journalTextMatch(r) {
  const q = lc(U.jSearch.trim());
  if (!q) return true;
  const w = wineById(r.wineId);
  const hay = lc([r.people, r.retailer, entryType(r), w ? fullName(w) : r.wineName].join(' '));
  return q.split(/\s+/).every(p => hay.includes(p));
}

function journalEntries() {
  const ppl = sel('journal', 'person');
  return allEntries().slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).filter(r => {
    if (!journalTextMatch(r) || !passes('journal', r)) return false;
    if (U.jFav) {
      const hearts = namesOf(r.hearts).map(lc);
      if (ppl.length ? !ppl.some(p => hearts.includes(p)) : !hearts.length) return false;
    }
    return true;
  });
}

function entryBody(r) {
  const ppl = peopleLine(r), meta = entryMeta(r);
  return `${r.occasion ? `<span class="small">${esc(r.occasion)}</span>` : ''}${ppl ? `<span class="small muted">${ppl}</span>` : ''}${meta ? `<span class="small muted">${meta}</span>` : ''}${r.food ? `<span class="tiny" style="color:var(--food)">${esc(r.food)}</span>` : ''}${r.note ? `<span class="small muted ellipsis">${esc(r.note)}</span>` : ''}`;
}

function journalList() {
  const list = journalEntries();
  if (!list.length) return '<p class="muted small">No entries match.</p>';
  let html = '', month = '';
  list.forEach(r => {
    const d = parseISO(r.date);
    const m = d ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Undated';
    if (m !== month) { html += `<h2 class="month">${m}</h2>`; month = m; }
    const name = entryWine(r);
    html += `<button class="journal-row as-btn" data-act="edit-entry" data-id="${esc(r.id)}" aria-label="Edit entry ${esc(name)}"><span class="day"><b>${d ? d.getDate() : ''}</b><span>${d ? d.toLocaleDateString('en-US', { weekday: 'short' }) : ''}</span></span>
      <span class="row-text" style="gap:3px"><span class="between"><span class="row-title">${esc(name)}</span>${typeBadge(r.type)}</span>${entryBody(r)}</span></button>`;
  });
  return html;
}

function personSummary(p) {
  const all = allEntries().filter(r => namesOf(r.people).map(lc).includes(p));
  const person = knownPeople().find(x => lc(x.name) === p);
  const name = person ? person.name : p;
  const n = t => all.filter(r => r.type === t).reduce((a, r) => a + r.qty, 0);
  const given = n('Gift'), sold = n('Sale'), received = n('Received');
  const shared = all.filter(r => r.dir === 'out' && r.type !== 'Gift' && r.type !== 'Sale').reduce((a, r) => a + r.qty, 0);
  const pl = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  const stats = [shared ? pl(shared, 'bottle shared', 'bottles shared') : '', given ? pl(given, 'given as gift', 'given as gifts') : '', sold ? pl(sold, 'sold', 'sold') : '', received ? pl(received, 'received as gift', 'received as gifts') : ''].filter(Boolean).join(' · ');
  const sales = all.filter(r => r.type === 'Sale' && r.price !== null);
  const saleSum = sales.reduce((a, r) => a + (conv(r.price, r.priceCur) || 0) * r.qty, 0);
  const favIds = [...new Set(all.filter(r => namesOf(r.hearts).map(lc).includes(p)).map(r => r.wineId))];
  const favs = favIds.map(id => wineById(id)).filter(Boolean);
  const fromThem = [...new Set(all.filter(r => r.type === 'Received').map(r => r.wineId))].map(id => wineById(id)).filter(Boolean);
  return `<div class="card" style="display:flex;flex-direction:column;gap:8px">
    <div class="between"><h2 style="font-size:17px;font-weight:600">${esc(name)}</h2><button class="icon-btn" data-act="f-chip" data-ctx="journal" data-k="person" data-v="${esc(p)}" aria-label="Remove person filter">${ICON.x}</button></div>
    <p class="muted small" style="margin:-8px 0 0">${stats}${sales.length ? ` · <span class="up">${money(saleSum)} from sales</span>` : ''}</p>
    ${favs.length ? `<span class="tiny muted">Favorite wines</span><div class="tags">${favs.map(w => `<a class="tag fav" href="#/wine/${encodeURIComponent(w.id)}">${HEART_SM}${esc(wineTitle(w))} ${esc(w.vintage)}</a>`).join('')}</div>` : ''}
    ${fromThem.length ? `<span class="tiny muted">Gifts from ${esc(name)}</span><div class="tags">${fromThem.map(w => `<a class="tag gifted" href="#/wine/${encodeURIComponent(w.id)}">${ICON.gift}${esc(wineTitle(w))} ${esc(w.vintage)}</a>`).join('')}</div>` : ''}
  </div>`;
}

function viewJournal() {
  if (!allEntries().length) {
    return `<main class="screen has-nav"><h1 class="title">Journal</h1><div class="empty"><h2>No entries yet</h2><p>Bottles you add, take out, give away or sell show up here.</p></div></main>${nav('journal')}`;
  }
  const filters = filterArea('journal');
  const btn = filterButton('journal');
  const ppl = sel('journal', 'person');
  return `<main class="screen has-nav"><h1 class="title">Journal</h1>
    <div style="display:flex;gap:8px"><label class="search" style="flex:1;min-width:0">${ICON.search}<input type="search" data-input="jsearch" aria-label="Search the journal" placeholder="Person, wine, type or retailer" value="${esc(U.jSearch)}"></label>${btn}</div>
    ${filters}
    ${ppl.length === 1 ? personSummary(ppl[0]) : ''}
    <div id="journal-list">${journalList()}</div></main>${nav('journal')}`;
}

/* ------------------------------------------------------------ view: wine detail */

const whereText = e => [shelfLabel(e.loc, shelfVal(e.shelf)), e.pos].filter(Boolean).join(' · ');

function stockHtml(w) {
  const rows = w.stock.map((e, i) => `<div class="stock-row"><div style="min-width:0"><span class="stock-loc">${ICON.pin}${esc(e.loc || 'No location')}</span>${whereText(e) ? `<span class="stock-where">${esc(whereText(e))}</span>` : ''}</div>
    <div class="stepper"><button data-act="minus" data-id="${esc(w.id)}" data-i="${i}" aria-label="Take a bottle from ${esc(placeLabel(e))}">${ICON.minus}</button><span>${e.n}</span><button data-act="plus" data-id="${esc(w.id)}" data-i="${i}" aria-label="Add bottles to ${esc(placeLabel(e))}">${ICON.plus}</button></div></div>`).join('');
  return `<section><div class="sec-head"><h2>In stock</h2><span class="small muted">${w.count} ${w.count === 1 ? 'bottle' : 'bottles'}</span></div>
    <div class="card stock-card">${rows || `<div class="between"><span class="muted small">No bottles left</span><button class="btn" style="height:38px" data-act="plus" data-id="${esc(w.id)}">${ICON.plus}Add bottles</button></div>`}</div>
    ${w.stock.length > 1 ? '<p class="muted tiny" style="margin:-4px 0 0">Storage places and moving bottles are managed in Edit.</p>' : ''}</section>`;
}

function valueHtml(w) {
  const a = avgPrice(w), s = streetOf(w);
  const cls = a === null || s === null || a === s ? '' : a < s ? 'up' : 'down';
  const pct = a !== null && a > 0 && s !== null ? Math.round((s - a) / a * 100) : null;
  const rows = infoRow('Ø Cost', `<b class="${cls}">${a !== null ? money(a) : 'N/A'}</b>`)
    + infoRow('Street Price', `<b>${s !== null ? money(s) : 'N/A'}</b>`, pct !== null ? `${pct > 0 ? '+' : ''}${pct}% vs. purchase` : '')
    + (s !== null && w.count > 0 ? infoRow(`Total Street Value of ${w.count} ${w.count === 1 ? 'bottle' : 'bottles'}`, `<b>${money(s * w.count)}</b>`) : '');
  return `<section>${secHead(ICON.cash, 'Value')}<div class="info-list">${rows}</div>${w.street ? `<p class="muted tiny" style="margin:0">${esc(streetSource(w.street))}</p>` : ''}</section>`;
}

const OFFER_AREA = { CHF: 'Switzerland', EUR: 'Euro area', GBP: 'United Kingdom', USD: 'United States' };
const offerRun = new Set();

function offerHtml(w) {
  const o = w.offer, area = OFFER_AREA[cur()];
  const busyNow = offerRun.has(w.id);
  const btn = `<button class="link-btn" data-act="offer-one" data-id="${esc(w.id)}"${busyNow ? ' disabled' : ''}>${ICON.refresh}${busyNow ? 'Searching…' : o ? 'Update best offer' : 'Find best offer'}</button>`;
  let body;
  if (!o) {
    body = `<p class="muted small" style="margin:0">${busyNow ? 'Searching online shops…' : `The online shop in ${area} with the lowest price for this wine, to buy more bottles.`}</p>`;
  } else {
    const meta = [o.area, o.vintage && o.vintage !== str(w.vintage) ? `vintage ${o.vintage}` : '', o.date ? `checked ${fmtDate(o.date)}` : ''].filter(Boolean).join(' · ');
    body = `<div class="between" style="gap:12px"><div style="min-width:0"><p style="margin:0;font-weight:600" class="ellipsis">${esc(o.shop)}</p><p class="muted tiny" style="margin:2px 0 0">${esc(meta)}</p></div>
      <a class="btn accent offer-btn" href="${esc(o.url)}" target="_blank" rel="noopener">${esc(priceText(o.v, o.cur))}${ICON.link}</a></div>
      <p class="muted tiny" style="margin:0">Found by AI on the web. Check price and vintage in the shop before you buy.</p>
      ${o.area && o.area !== area ? `<p class="muted tiny" style="margin:0">Found for ${esc(o.area)}. Tap Update best offer to search in ${esc(area)}.</p>` : ''}`;
  }
  return `<section>${secHead(ICON.tag, 'Best offer', btn)}${body}</section>`;
}

async function updateOffer(id) {
  if (offerRun.has(id)) return;
  offerRun.add(id);
  refreshView();
  try {
    upsertWine(normWine(await api('bestOffer', { id })));
    persist();
  } catch (e) {
    toast(aiErr(e.message), 5000);
  }
  offerRun.delete(id);
  refreshView();
}

/* calm information rows: label left, value right */
const infoRow = (label, value, sub = '') => `<div class="info-row"><span class="info-label">${label}</span><span class="info-val">${value}${sub ? `<small>${sub}</small>` : ''}</span></div>`;
const secHead = (icon, title, right = '') => `<div class="sec-head"><h2 class="sec-title">${icon ? `<span class="sec-icon">${icon}</span>` : ''}${title}</h2>${right}</div>`;
const ratingVisual = r => { const max = sysInfo(r.sys).max; return `${max === 5 ? starsHtml(r.score) : ''}<b>${fmtScore(r.sys, r.score)}</b><span class="muted"> /${max}</span>`; };
const listSentence = a => { const x = a.map((t, i) => (i ? t : cap(t))); return x.length > 1 ? `${x.slice(0, -1).join(', ')} and ${x[x.length - 1]}` : (x[0] || ''); };
function streetSource(st) {
  if (!st) return '';
  const when = st.date ? fmtDate(st.date) : '';
  if (st.src === 'Manual') return `Street price entered by you${when ? ` on ${when}` : ''}.`;
  return `The street price is an estimate: the median of current shop offers found by AI${st.src ? ` at ${st.src}` : ''}${when ? `, checked ${when}` : ''}. Actual prices may differ.`;
}

function retailerLink(name) {
  const url = retailerSite(name);
  return url ? `<a class="ret-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(name)}${ICON.link}</a>` : esc(name);
}

function purchasesHtml(w, editable) {
  const list = inEntries(w).sort((a, b) => b.date.localeCompare(a.date));
  const row = r => {
    const who = r.type === 'Purchase' ? (r.retailer ? (editable ? esc(r.retailer) : retailerLink(r.retailer)) : 'Retailer not set')
      : r.type === 'Received' ? `${GIFT_MARK.replace('gift-mark', 'gift-mark inline')}Gift from ${esc(namesOf(r.people).join(', ') || 'someone')}` : 'Added';
    const meta = [esc(fmtDate(r.date)), r.qty > 1 ? `${r.qty} bottles` : '1 bottle', r.type === 'Received' ? `${money(0)}, gift` : (r.price !== null ? `${priceText(r.price, r.priceCur)}${r.qty > 1 ? ' each' : ''}` : 'Price not set')].join(' · ');
    const body = `<span class="rec-main">${who}</span><span class="small muted">${meta}</span>${r.note ? `<span class="small">${esc(r.note)}</span>` : ''}`;
    return editable
      ? `<button class="rec-btn" data-act="edit-entry" data-id="${esc(r.id)}" data-record="1" aria-label="Edit purchase from ${esc(fmtDate(r.date))}"><span class="rec-text">${body}</span>${ICON.chevron}</button>`
      : `<div class="hist">${body}</div>`;
  };
  return list.length ? `<div class="${editable ? 'rec-list' : ''}">${list.map(row).join('')}</div>` : `<p class="muted small" style="margin:0">${editable ? 'No purchases recorded yet.' : 'No purchases recorded yet. Add them in Edit.'}</p>`;
}

function viewWine(id) {
  const w = wineById(id);
  if (!w) return `<main class="screen"><a class="back" href="#/cellar">${ICON.back}Cellar</a><div class="empty"><h2>Wine not found</h2><p>It may have been deleted on another device.</p></div></main>`;
  const p = windowParts(w);
  const s = statusOf(w);
  const hist = S.removals.filter(r => r.wineId === w.id && r.dir === 'out').sort((a, b) => b.date.localeCompare(a.date));
  const editHref = '#/edit/' + encodeURIComponent(w.id);
  const label = w.thumb || w.labelFileId
    ? `<img id="label-img" class="label-photo"${w.thumb ? ` src="${esc(w.thumb)}"` : ''} alt="Label of ${esc(fullName(w))}">`
    : `<div class="label-ph">${esc(wineTitle(w))}<small>${esc(w.vintage || '')}</small></div>`;
  const meta = [w.name ? w.producer : '', w.region, w.vintage].filter(Boolean).join(' · ');
  return `<main class="screen detail">
    <div class="detail-top"><a class="back" href="#/cellar">${ICON.back}Cellar</a><a class="btn" style="height:40px" href="${editHref}">Edit</a></div>
    ${label}
    <div><h1 class="title" style="font-size:28px">${esc(wineTitle(w))}${isGift(w) ? GIFT_MARK : ''}${w.count === 0 ? FIN : ''}</h1><p class="meta">${typeDot(w)}<span class="meta-type">${esc(w.type)}</span>${flagOf(w)}${esc(meta)}</p></div>
    ${stockHtml(w)}
    <section>
      <div class="sec-head"><h2>Drinking window</h2>${p ? `<span class="small" style="color:${STATUS[s].c};font-weight:500">${statusLine(w)}</span>` : ''}</div>
      ${p ? `${timelineHtml(w, true)}<div class="scale" style="margin-top:4px"><span>${p.f}</span><span style="color:var(--text)">Today</span><span>${p.u}</span></div><p class="muted tiny" style="margin:0">${windowText(w)}</p>`
        : `<p class="muted small" style="margin:0">No drinking window set yet. <a href="${editHref}">Add one</a></p>`}
    </section>
    <section>
      <div class="rating-head"><h2>My rating</h2>${w.myRating === null ? `<a class="small" href="${editHref}">Rate in Edit</a>` : `<span class="rating-val">${w.myRating}%</span>`}</div>
      ${w.myRating === null ? '' : segsHtml(w.myRating, 22, 'lg')}
    </section>
    <section>
      <h2>External ratings</h2>
      ${w.ratings.length ? `<div class="info-list">${w.ratings.map(r => infoRow(esc(r.sys), `<span class="rate-val">${ratingVisual(r)}</span>`)).join('')}</div>`
        : `<p class="muted small" style="margin:0">No external ratings yet. <a href="${editHref}">Add them in Edit</a></p>`}
    </section>
    ${valueHtml(w)}
    ${offerHtml(w)}
    <section style="gap:4px">${secHead(ICON.cart, 'Purchases')}${purchasesHtml(w, false)}</section>
    <section style="gap:14px">
      <h2>Profile</h2>
      ${w.grapes ? `<div class="kv"><span>Grapes</span><p>${esc(w.grapes)}</p></div>` : ''}
      ${w.taste ? `<div class="kv"><span>Taste</span><p style="line-height:1.5">${esc(w.taste)}</p></div>` : ''}
      ${w.tasteTags.length ? `<div class="kv"><span>Style</span><p class="style-line">${w.tasteTags.map(t => esc(cap(t))).join(' · ')}</p></div>` : ''}
      ${w.pairings.length ? `<div class="kv"><span>Pairs with</span><p style="line-height:1.5">${esc(listSentence(w.pairings))}</p></div>` : ''}
      ${!w.grapes && !w.taste && !w.pairings.length ? `<p class="muted small" style="margin:0">No profile yet. <a href="${editHref}">Edit</a> to add grapes, taste and food pairings.</p>` : ''}
    </section>
    <section style="gap:0">
      <h2 style="margin-bottom:4px">Bottles removed</h2>
      ${hist.length ? hist.map(r => `<button class="hist as-btn" data-act="edit-entry" data-id="${esc(r.id)}" aria-label="Edit entry from ${esc(fmtDate(r.date))}"><span class="hist-head"><span class="tiny muted">${esc(fmtDate(r.date))}</span>${typeBadge(r.type)}</span>
        ${r.occasion ? `<span style="font-size:14px;font-weight:600">${esc(r.occasion)}</span>` : ''}${entryBody(Object.assign({}, r, { occasion: '' }))}</button>`).join('') + '<p class="muted tiny" style="margin:8px 0 0">Tap an entry to edit it.</p>'
        : '<p class="muted small" style="margin:0">No bottles removed yet.</p>'}
    </section>
  </main>`;
}

const fmtDate = s => { const d = parseISO(s); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : s; };

/* ------------------------------------------------------------ my rating (edit form only) */

function autosize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight + 2) + 'px';
}

function setupRating() {
  const bar = $('#rating-bar');
  if (!bar || !D) return;
  let start = null, drag = false;
  const setX = x => {
    const r = bar.getBoundingClientRect();
    setRating(Math.round(clamp((x - r.left) / r.width, 0, 1) * 100));
  };
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

function setRating(v) {
  if (!D) return;
  D.myRating = v;
  const val = $('#rating-val');
  if (val) { val.textContent = v === null ? 'Not rated' : v + '%'; val.classList.toggle('none', v === null); }
  const bar = $('#rating-bar');
  if (bar) bar.innerHTML = segsHtml(v, 30, 'lg');
}

/* ------------------------------------------------------------ bottom sheet: bottles in and out, journal entries */

const newPicker = (source, names, opts = {}) => ({
  people: namesOf(names).map(n => ({ name: n, heart: (opts.hearts || []).includes(lc(n)) })),
  typing: '', showAll: false, hearts: !!opts.withHearts, source, single: !!opts.single
});
const priceInput = (v, c) => { const x = conv(v, c); return x === null ? '' : x.toFixed(2); };

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
  const hearts = namesOf(r.hearts).map(lc);
  const site = r.retailer ? str((S.retailers.find(x => lc(x.name) === lc(r.retailer)) || {}).website) : '';
  RS = {
    kind: r.dir, mode: record ? 'record' : 'edit', id: r.id, wineId: r.wineId, loc: r.loc, qty: r.qty,
    type: r.type, occasion: r.occasion, food: r.food, note: r.note, date: r.date || todayISO(),
    price: priceInput(r.price, r.priceCur), priceInit: priceInput(r.price, r.priceCur), origPrice: r.price, origCur: r.priceCur,
    pp: newPicker('people', r.people, { withHearts: r.dir === 'out', hearts }),
    rp: newPicker('retailers', r.retailer, { single: true }), website: site, websiteInit: site
  };
  if (r.dir === 'out' && !REMOVAL_TYPES.includes(RS.type)) RS.type = 'Other';
  if (r.dir === 'in' && !ADD_TYPES.some(t => t[0] === RS.type)) RS.type = 'Added';
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
      <input id="people-input" data-input="people" aria-label="${label}" placeholder="${PK() && PK().source === 'retailers' ? 'Type the name of a shop or winery' : 'Type a name'}" autocomplete="off" autocapitalize="words" enterkeyhint="done" value="${esc(PK() ? PK().typing : '')}">
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
    const place = RS.mode === 'add' ? `<div class="store-row">
        <div class="field">Shelf (optional)<div class="stepper"><button data-act="rs-shelf" data-d="-1" aria-label="Shelf down">${ICON.minus}</button><span id="rs-shelf" class="shelf-val">${esc(shelfText(RS.loc, RS.shelf))}</span><button data-act="rs-shelf" data-d="1" aria-label="Shelf up">${ICON.plus}</button></div></div>
        <label class="field">Position<input name="pos" data-input="rs" placeholder="Back row, left" value="${esc(RS.pos)}"></label>
      </div><p class="muted tiny" style="margin:-6px 0 0" id="rs-hint">${placeHint()}</p>` : '';
    body = `${typeGrid}${locs}${place}${qty}${date}
      ${RS.type === 'Purchase' ? picker('Retailer') : RS.type === 'Received' ? picker('From') : ''}
      ${showSite ? `<label class="field">Website of ${esc(RS.rp.people[0].name)}<input name="website" data-input="rs" inputmode="url" autocapitalize="off" placeholder="www.shop.ch" value="${esc(RS.website)}"></label>` : ''}
      ${RS.type === 'Purchase' ? priceField('Purchase price per bottle') : RS.type === 'Received' ? `<div class="field">Purchase price<div class="static">${money(0)}, gift</div></div>` : ''}
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
  if (RS) {
    if (RS.kind === 'in') return RS.type === 'Purchase' ? RS.rp : RS.type === 'Received' ? RS.pp : null;
    return RS.pp;
  }
  if (D && D.acq) return D.acq.type === 'Purchase' ? D.acq.rp : D.acq.type === 'Received' ? D.acq.pp : null;
  return null;
};
const knownFor = P => (P.source === 'retailers' ? knownRetailers() : knownPeople());

function peopleChipsHtml() {
  const P = PK();
  if (!P || !P.people.length) return '';
  return P.people.map((p, i) => `<span class="person${P.hearts ? '' : ' plain'}">${P.hearts ? `<button class="heart${p.heart ? ' on' : ''}" data-act="p-heart" data-i="${i}" aria-pressed="${p.heart}" aria-label="Favorite wine of ${esc(p.name)}">${p.heart ? HEART_ON : ICON.heart}</button>` : ''}${esc(p.name)}<button class="x" data-act="p-rm" data-i="${i}" aria-label="Remove ${esc(p.name)}">${ICON.x}</button></span>`).join('')
    + (P.hearts ? '<p class="tiny muted" style="flex-basis:100%;margin:0">Tap the heart if it is their favorite wine.</p>' : '');
}

function peopleSuggHtml() {
  const P = PK();
  if (!P) return '';
  if (P.single && P.people.length && !P.typing.trim()) return '';
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
  if (i) i.value = P.typing;
}

function addPerson(raw) {
  const P = PK();
  if (!P) return;
  const clean = String(raw || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  P.typing = '';
  if (clean && !P.people.some(p => lc(p.name) === lc(clean))) {
    const known = knownFor(P).find(p => lc(p.name) === lc(clean));
    const item = { name: known ? known.name : clean, heart: false };
    if (P.single) P.people = [item]; else P.people.push(item);
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
    if (st.priceInit !== undefined && str(st.price).trim() === st.priceInit && st.origPrice !== null) { price = st.origPrice; priceCur = st.origCur; }
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
  if (!r || !w || RS.mode === 'record') { deleteEntryOnly(); return; }
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

/* ------------------------------------------------------------ add and edit */

function defaultLocation() {
  const last = store.get('wc-lastloc', '');
  if (S.locations.includes(last)) return last;
  return S.locations.length === 1 ? S.locations[0] : '';
}

function newDraft(mode, w) {
  const src = w || normWine({ id: '', type: 'Red' });
  const street = src.street ? priceInput(src.street.v, src.street.cur) : '';
  return {
    mode, id: w ? w.id : null,
    step: mode === 'add' ? 'photo' : 'form',
    fields: {
      producer: src.producer, name: src.name, vintage: src.vintage, type: src.type, region: src.region, grapes: src.grapes,
      taste: src.taste, tasteTags: src.tasteTags.join(', '), pairings: src.pairings.join(', '),
      drinkFrom: str(src.drinkFrom), drinkUntil: str(src.drinkUntil), peakFrom: str(src.peakFrom), peakUntil: str(src.peakUntil),
      street, price: '', date: todayISO()
    },
    streetInit: street,
    stock: mode === 'add' ? [{ loc: defaultLocation(), shelf: null, pos: '', n: 1 }] : src.stock.map(e => Object.assign({}, e)),
    addLoc: false, move: null,
    myRating: src.myRating,
    acq: mode === 'add' ? { type: 'Purchase', pp: newPicker('people', ''), rp: newPicker('retailers', '', { single: true }), website: '', websiteInit: '' } : null,
    ratings: src.ratings.map(r => ({ sys: r.sys, score: String(r.score) })),
    preview: w ? w.thumb : '', thumb: w ? w.thumb : '', imageB64: null,
    src: null, corners: null, cornersTouched: false,
    ai: null, aiMsg: '', touched: new Set()
  };
}

function viewForm(mode, id) {
  if (mode === 'edit') {
    const w = wineById(id);
    if (!w) return `<main class="screen"><a class="back" href="#/cellar">${ICON.back}Cellar</a><div class="empty"><h2>Wine not found</h2></div></main>`;
    if (!D || D.mode !== 'edit' || D.id !== id) D = newDraft('edit', w);
  } else if (!D || D.mode !== 'add') {
    D = newDraft('add', null);
  }
  const title = mode === 'add' ? 'Add wine' : 'Edit wine';
  const head = `<header class="form-top"><button data-act="cancel-form">Cancel</button><h1>${title}</h1><span></span></header>`;
  const stepIdx = { photo: 0, crop: 1, form: 2 }[D.step];
  const steps = mode === 'add' || D.step !== 'form'
    ? `<div class="steps">${['1 Photo', '2 Crop', '3 Review'].map((l, i) => `<span class="${i < stepIdx ? 'done' : i === stepIdx ? 'cur' : ''}">${l}</span>`).join('')}</div>` : '';
  if (D.step === 'photo') {
    return `<main class="screen">${head}${steps}<div class="photo-pick">
      <p>Photograph the front label. Fill the frame, keep it flat and well lit.</p>
      <label class="btn primary big">Take photo<input type="file" accept="image/*" capture="environment" data-change="photo" hidden></label>
      <label class="btn big">Choose from gallery<input type="file" accept="image/*" data-change="photo" hidden></label>
      <button class="btn ghost" data-act="skip-photo">${mode === 'add' ? 'Skip photo, enter manually' : 'Back to the form'}</button></div></main>`;
  }
  if (D.step === 'crop') {
    return `<main class="screen">${head}${steps}
      <div class="crop-wrap" id="crop-wrap"><canvas id="crop-canvas"></canvas><svg id="crop-svg"></svg></div>
      <p class="muted small center" id="crop-hint" style="margin:-6px 0 0">Detecting the label edges…</p>
      <div class="grid2"><button class="btn" data-act="retake">Retake</button><button class="btn accent" data-act="do-crop">Crop</button></div>
      <button class="btn ghost" data-act="use-full">Use the whole photo</button></main>`;
  }
  return `<main class="screen">${head}${steps}${formBody()}</main>`;
}

function stockEditorHtml() {
  const add = D.mode === 'add';
  const rows = D.stock.map((e, i) => {
    const locSel = add
      ? `<label class="field" style="flex:1;min-width:0">Location<select data-change="stock-loc" data-i="${i}">${e.loc ? '' : '<option value="" selected disabled>Choose a location</option>'}${S.locations.concat(e.loc && !S.locations.includes(e.loc) ? [e.loc] : []).map(l => `<option${l === e.loc ? ' selected' : ''}>${esc(l)}</option>`).join('')}<option value="__new">Add new location…</option></select></label>`
      : `<span class="stock-loc" style="flex:1;min-width:0">${ICON.pin}${esc(e.loc || 'No location')}</span>`;
    return `<div class="stock-edit${e.n === 0 ? ' zero' : ''}">
      <div style="display:flex;gap:10px;align-items:${add ? 'flex-end' : 'center'}">${locSel}<div class="stepper"><button data-act="st-n" data-i="${i}" data-d="-1" aria-label="Fewer bottles">${ICON.minus}</button><input class="step-num" type="text" inputmode="numeric" pattern="[0-9]*" id="st-n-${i}" data-input="qty-in" data-change="qty-in" data-k="st" data-i="${i}" aria-label="Number of bottles" value="${e.n}"><button data-act="st-n" data-i="${i}" data-d="1" aria-label="More bottles">${ICON.plus}</button></div></div>
      <div class="store-row">
        <div class="field">Shelf (optional)<div class="stepper"><button data-act="st-shelf" data-i="${i}" data-d="-1" aria-label="Shelf down">${ICON.minus}</button><span id="st-shelf-${i}" class="shelf-val">${esc(shelfText(e.loc, shelfVal(e.shelf)))}</span><button data-act="st-shelf" data-i="${i}" data-d="1" aria-label="Shelf up">${ICON.plus}</button></div></div>
        <label class="field">Position<input data-input="st-pos" data-i="${i}" placeholder="Back row, left" value="${esc(e.pos)}"></label>
      </div>
      ${!add && e.n === 0 ? '<p class="muted tiny" style="margin:0">Empty. Hidden after saving.</p>' : ''}
    </div>`;
  }).join('');
  if (add) return `<div class="box"><span class="box-title">Storage</span>${rows}</div>`;
  const addBox = D.addLoc
    ? `<div class="chips">${S.locations.map(l => `<button class="chip" data-act="st-add" data-v="${esc(l)}">${ICON.pin}${esc(l)}</button>`).join('')}<button class="chip" data-act="st-add-new">${ICON.plus}New location</button><button class="chip" data-act="st-add-close">Cancel</button></div>`
    : `<div class="chips"><button class="chip" data-act="st-add-open">${ICON.plus}Add storage place</button>${D.stock.filter(e => e.n > 0).length && D.stock.length > 1 ? `<button class="chip${D.move ? ' on' : ''}" data-act="st-move-open">${ICON.move}Move bottles</button>` : ''}</div>`;
  let move = '';
  if (D.move) {
    const src = D.stock[D.move.from];
    const opt = (i, on) => `<option value="${i}"${on ? ' selected' : ''}>${esc(placeLabel(D.stock[i]))}</option>`;
    const fromIdx = D.stock.map((e, i) => i).filter(i => D.stock[i].n > 0);
    const toIdx = D.stock.map((e, i) => i).filter(i => i !== D.move.from);
    move = `<div class="move-box"><span class="tiny muted">Move bottles between storage places</span>
      <label class="field">From<select data-change="mv-from">${fromIdx.map(i => opt(i, i === D.move.from)).join('')}</select></label>
      <label class="field">To<select data-change="mv-to">${toIdx.map(i => opt(i, i === D.move.to)).join('')}</select></label>
      <div class="between"><span class="small">Bottles</span><div class="stepper"><button data-act="mv-n" data-d="-1" aria-label="Fewer">${ICON.minus}</button><input class="step-num" type="text" inputmode="numeric" pattern="[0-9]*" id="mv-n" data-input="qty-in" data-change="qty-in" data-k="mv" aria-label="Number of bottles" value="${D.move.n}"><button data-act="mv-n" data-d="1" aria-label="More">${ICON.plus}</button></div></div>
      <div class="grid2"><button class="btn" data-act="st-move-close">Cancel</button><button class="btn accent" data-act="st-move"${src && src.n ? '' : ' disabled'}>Move</button></div></div>`;
  }
  return `<div class="box"><div class="between"><span class="box-title">Storage</span><span class="small muted" id="st-total">${D.stock.reduce((a, e) => a + e.n, 0)} bottles</span></div>${rows || '<p class="muted small" style="margin:0">No bottles in stock.</p>'}${addBox}${move}
    <p class="muted tiny" style="margin:0">Counts changed here are corrections. They adjust the purchases in the journal without a new entry. Use plus and minus on the wine to log new purchases and bottles taken.</p></div>`;
}

function acquisitionBox() {
  const a = D.acq, f = D.fields;
  const picker = label => `<div class="field"><span>${label}</span><div id="people-chips" class="chips">${peopleChipsHtml()}</div>
    <input id="people-input" data-input="people" aria-label="${label}" placeholder="${a.type === 'Purchase' ? 'Type the name of a shop or winery' : 'Type a name'}" autocomplete="off" autocapitalize="words" enterkeyhint="done" value="${esc(PK() ? PK().typing : '')}">
    <div id="people-sugg">${peopleSuggHtml()}</div></div>`;
  return `<div class="box"><span class="box-title">Acquired</span>
    <div class="grid3">${ADD_TYPES.map(([v, l]) => `<button class="btn${v === a.type ? ' primary' : ''}" style="height:42px;font-size:14px;padding:0 6px" data-act="acq" data-v="${v}">${l}</button>`).join('')}</div>
    ${a.type === 'Purchase' ? picker('Retailer') + `<div id="site-box">${siteBoxHtml()}</div>` : a.type === 'Received' ? picker('Gift from') : ''}
    <div class="form-grid">
      <label class="field${a.type === 'Purchase' ? '' : ' full'}">Date<input type="date" name="date" data-input="field" value="${esc(f.date)}"></label>
      ${a.type === 'Purchase' ? `<label class="field">Price per bottle${curLabel()}<input name="price" data-input="field" inputmode="decimal" placeholder="45.00" value="${esc(f.price)}"></label>` : ''}
    </div>
  </div>`;
}

function siteBoxHtml() {
  const a = D && D.acq;
  if (!a || a.type !== 'Purchase' || !a.rp.people.length) return '';
  return `<label class="field">Website of ${esc(a.rp.people[0].name)}<input data-input="acq-site" inputmode="url" autocapitalize="off" placeholder="www.shop.ch" value="${esc(a.website)}"></label>`;
}
function renderSiteBox() {
  const b = $('#site-box');
  if (b) b.innerHTML = siteBoxHtml();
}

function offerBoxHtml() {
  const w = D && D.id ? wineById(D.id) : null;
  if (!w) return '';
  const o = w.offer, busyNow = offerRun.has(w.id), area = OFFER_AREA[cur()];
  const info = o
    ? `<div class="between" style="gap:12px"><div style="min-width:0"><p style="margin:0;font-weight:600" class="ellipsis">${esc(o.shop)}</p><p class="muted tiny" style="margin:2px 0 0">${esc([o.area, o.date ? `checked ${fmtDate(o.date)}` : ''].filter(Boolean).join(' · '))}</p></div><b style="flex:none">${esc(priceText(o.v, o.cur))}</b></div>`
    : `<p class="muted small" style="margin:0">No best offer yet.</p>`;
  return `<span class="box-title">Best offer</span>${info}
    <button class="btn" data-act="offer-one" data-id="${esc(w.id)}"${busyNow ? ' disabled' : ''}>${ICON.refresh}${busyNow ? 'Searching…' : o ? 'Update best offer' : 'Find best offer'}</button>
    <p class="muted tiny" style="margin:0">Searches the online shop in ${esc(area)} with the lowest price for this wine. Only the best offer is updated.</p>`;
}

function streetBox() {
  const w = D.id ? wineById(D.id) : null;
  const src = w && w.street ? streetSource(w.street) : '';
  return `<div class="box"><span class="box-title">Street price</span>
    <label class="field">Street price per bottle${curLabel()}<input name="street" data-input="field" inputmode="decimal" placeholder="${D.mode === 'add' ? 'Looked up after saving' : '52.00'}" value="${esc(D.fields.street)}"></label>
    ${src ? `<p class="muted tiny" style="margin:-4px 0 0" id="street-src">${esc(src)}</p>` : ''}
    ${D.mode === 'edit' ? `<button class="btn" data-act="street-one" data-id="${esc(D.id)}">${ICON.refresh}Update street price now</button>` : ''}
    <p class="muted tiny" style="margin:0">${D.mode === 'add' ? 'Leave empty and the street price is looked up on the web after saving.' : 'Overwrite to set your own value. It is converted when you change the currency.'}</p>
  </div>`;
}

function formBody() {
  const f = D.fields;
  const field = (label, key, opts = {}) => `<label class="field${opts.full ? ' full' : ''}">${label}<input name="${key}" data-input="field" value="${esc(f[key])}"${opts.num ? ' inputmode="numeric"' : ''}${opts.ph ? ` placeholder="${esc(opts.ph)}"` : ''}></label>`;
  const banner = '<div id="ai-banner" hidden></div>';
  return `
    ${D.preview ? `<img class="preview" src="${esc(D.preview)}" alt="Label">` : ''}
    <button class="btn ghost" data-act="new-photo">${D.preview ? 'Replace label photo' : 'Add label photo'}</button>
    ${banner}
    <div class="form-grid">
      ${field('Producer', 'producer', { full: true })}
      ${field('Wine', 'name', { full: true })}
      ${field('Vintage', 'vintage', { num: true, ph: '2019' })}
      <label class="field">Type<select name="type" data-change="field">${TYPES.map(t => `<option${t === f.type ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      ${field('Region', 'region', { full: true, ph: 'Piedmont, Italy' })}
      ${field('Grapes', 'grapes', { full: true, ph: 'Nebbiolo 100%' })}
      <div class="field full">Pairs with<div id="tg-pairings">${tagEditorHtml('pairings')}</div></div>
      ${field('Drink from', 'drinkFrom', { num: true })}
      ${field('Drink until', 'drinkUntil', { num: true })}
      ${field('Peak from', 'peakFrom', { num: true })}
      ${field('Peak until', 'peakUntil', { num: true })}
      <label class="field full">Taste<textarea name="taste" class="autosize" data-input="field" rows="5">${esc(f.taste)}</textarea></label>
      <div class="field full">Taste tags<div id="tg-tasteTags">${tagEditorHtml('tasteTags')}</div></div>
    </div>
    <button class="btn accent block" data-act="ai-refresh">${ICON.spark}Update details with AI</button>
    <p class="muted tiny" style="margin:-10px 0 0">Uses what you entered, for example the vintage, and fills in the rest. Fields you changed here stay as they are.</p>
    <div class="box"><div class="rating-head"><span class="box-title">My rating</span><span class="rating-val${D.myRating === null ? ' none' : ''}" id="rating-val">${D.myRating === null ? 'Not rated' : D.myRating + '%'}</span></div>
      <div class="rating-bar" id="rating-bar">${segsHtml(D.myRating, 30, 'lg')}</div>
      <div class="scale"><span>0</span><span>50</span><span>100</span></div>
      <div class="rating-ctl"><button data-act="rate" data-d="-1" aria-label="Minus 1 percent">${ICON.minus}</button><span>Drag the bar, fine-tune with minus and plus</span><button data-act="rate" data-d="1" aria-label="Plus 1 percent">${ICON.plus}</button></div>
      <button class="btn ghost" style="height:36px;align-self:center;font-size:13px" data-act="rate-clear">Clear rating</button>
    </div>
    <div class="box"><span class="box-title">External ratings</span>
      ${D.ratings.length ? `<div class="rec-list">${D.ratings.map((r, i) => `<div class="rec-row"><button class="rec-btn" data-act="ers-open" data-i="${i}" aria-label="Edit ${esc(r.sys)} rating"><span class="rec-text"><span class="rec-main">${esc(r.sys)}</span></span><span class="rate-val">${str(r.score).trim() === '' ? '<span class="muted">No score</span>' : ratingVisual({ sys: r.sys, score: Number(String(r.score).replace(',', '.')) })}</span>${ICON.chevron}</button><button class="icon-btn" data-act="rrm" data-i="${i}" aria-label="Remove ${esc(r.sys)} rating">${ICON.x}</button></div>`).join('')}</div>` : '<p class="muted small" style="margin:0">No external ratings yet.</p>'}
      ${D.ratings.length < SYSTEMS.length ? '<button class="btn dashed" data-act="ers-open" data-i="-1">Add rating</button>' : ''}
    </div>
    <div id="stock-box">${stockEditorHtml()}</div>
    ${D.mode === 'add' ? acquisitionBox() : `<div class="box"><span class="box-title">Purchases</span><div id="purchases-box">${purchasesHtml(wineById(D.id) || { id: D.id }, true)}</div>
      <button class="btn dashed" data-act="record-add">Add purchase record</button>
      <p class="muted tiny" style="margin:0">Tap a purchase to edit it or to set the retailer's website.</p></div>`}
    ${streetBox()}
    ${D.mode === 'edit' ? `<div class="box" id="offer-box">${offerBoxHtml()}</div>` : ''}
    <button class="btn primary big block" data-act="save-wine">Save wine</button>
    ${D.mode === 'edit' ? `<button class="btn danger block" data-act="delete-wine">Delete wine</button>` : ''}`;
}

/* tag editor for taste tags and food pairings */
const tagList = key => splitList(D.fields[key]);
function tagEditorHtml(key) {
  const tags = tagList(key);
  const ph = key === 'pairings' ? 'Add a dish, for example braised beef' : 'Add a tag, for example elegant';
  return `${tags.length ? `<div class="chips" style="margin-bottom:8px">${tags.map((t, i) => `<span class="person plain">${esc(t)}<button class="x" data-act="tg-rm" data-k="${key}" data-i="${i}" aria-label="Remove ${esc(t)}">${ICON.x}</button></span>`).join('')}</div>` : ''}
    <input id="tg-in-${key}" data-input="tg-in" data-k="${key}" placeholder="${ph}" autocapitalize="sentences" enterkeyhint="done">`;
}
function renderTagBox(key, focus) {
  const b = $('#tg-' + key);
  if (!b) return;
  b.innerHTML = tagEditorHtml(key);
  if (focus) { const i = $('#tg-in-' + key); if (i) i.focus(); }
}
function addTag(key, raw) {
  const add = String(raw || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!add.length) return;
  const tags = tagList(key);
  add.forEach(t => { if (!tags.some(x => lc(x) === lc(t))) tags.push(t); });
  D.fields[key] = tags.join(', ');
  D.touched.add(key);
  renderTagBox(key, true);
}

/* sheet for adding or editing one external rating */
let RT = null;
function openRatingSheet(i) {
  const r = i >= 0 ? D.ratings[i] : null;
  RT = { i, sys: r ? r.sys : '', score: r ? str(r.score) : '' };
  renderRatingSheet();
}
function renderRatingSheet() {
  const root = $('#sheet-root');
  if (!RT) { root.innerHTML = ''; return; }
  const used = D.ratings.map((r, j) => (j === RT.i ? '' : r.sys));
  const free = SYSTEMS.filter(x => !used.includes(x.key));
  const info = RT.sys ? sysInfo(RT.sys) : null;
  const scale = info ? (info.max === 5 ? '1 to 5, for example 4.2' : `0 to ${info.max}, for example ${info.max === 20 ? '17.5' : '92'}`) : '';
  root.innerHTML = `<div class="sheet-backdrop" data-act="ers-close"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rt-title">
    <div class="grab"></div>
    <div class="between"><h2 id="rt-title" style="font-size:18px;font-weight:600">${RT.i >= 0 ? 'Edit rating' : 'Add external rating'}</h2><button class="icon-btn" data-act="ers-close" aria-label="Close">${ICON.x}</button></div>
    <div style="display:flex;flex-direction:column;gap:8px"><span class="small muted">Rating system</span>
      <div class="grid2" style="gap:8px">${free.map(x => `<button class="btn sys-btn${x.key === RT.sys ? ' primary' : ''}" data-act="ers-sys" data-v="${esc(x.key)}"><span>${esc(x.key)}</span><small>of ${x.max}</small></button>`).join('')}</div></div>
    ${info ? `<label class="field">Score (${scale})<input id="rt-score" data-input="ers-score" inputmode="decimal" placeholder="${info.max === 5 ? '4.2' : info.max === 20 ? '17.5' : '92'}" value="${esc(RT.score)}"></label>
      <div id="rt-preview" class="rate-val">${rtPreview()}</div>` : ''}
    <div class="grid2"><button class="btn" data-act="ers-close">Cancel</button><button class="btn primary" data-act="ers-save"${info ? '' : ' disabled'}>Save</button></div>
  </div>`;
  const inp = $('#rt-score');
  if (inp && !RT.score) inp.focus();
}
function rtPreview() {
  const v = Number(String(RT.score).replace(',', '.'));
  if (!RT.sys || String(RT.score).trim() === '' || isNaN(v)) return '';
  const max = sysInfo(RT.sys).max;
  return v < 0 || v > max ? `<span class="small" style="color:var(--danger)">${esc(RT.sys)} scores go from 0 to ${max}.</span>` : ratingVisual({ sys: RT.sys, score: v });
}
function saveRatingSheet() {
  const v = Number(String(RT.score).replace(',', '.'));
  const max = sysInfo(RT.sys).max;
  if (String(RT.score).trim() === '' || isNaN(v) || v < 0 || v > max) { toast(`${RT.sys} scores go from 0 to ${max}.`); return; }
  const r = { sys: RT.sys, score: String(v) };
  if (RT.i >= 0) D.ratings[RT.i] = r; else D.ratings.push(r);
  RT = null;
  renderRatingSheet();
  render();
}

function renderStockBox() {
  const b = $('#stock-box');
  if (b) b.innerHTML = stockEditorHtml();
}

async function newLocationPrompt() {
  const name = (prompt('Name of the new location, for example Kitchen or Basement') || '').replace(/\s+/g, ' ').trim();
  if (!name) return '';
  const known = S.locations.find(l => lc(l) === lc(name));
  if (known) return known;
  S.locations.push(name);
  persist();
  api('addLocation', { name }).then(list => { S.locations = list; persist(); }).catch(e => toast('Location saved on this device only: ' + e.message));
  return name;
}

/* photo loading, cropping, perspective correction */

async function loadPhoto(file) {
  let bmp;
  if (window.createImageBitmap) {
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = null; }
  }
  if (!bmp) {
    bmp = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Could not read this image'));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bmp.width, h = bmp.height;
  const k = Math.min(1, 2000 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

function defaultCorners(c) {
  const mx = c.width * 0.1, my = c.height * 0.1;
  return [{ x: mx, y: my }, { x: c.width - mx, y: my }, { x: c.width - mx, y: c.height - my }, { x: mx, y: c.height - my }];
}

function setupCrop() {
  const canvas = $('#crop-canvas'), svgEl = $('#crop-svg');
  if (!canvas || !D || !D.src) return;
  canvas.width = D.src.width;
  canvas.height = D.src.height;
  canvas.getContext('2d').drawImage(D.src, 0, 0);
  svgEl.setAttribute('viewBox', `0 0 ${D.src.width} ${D.src.height}`);
  svgEl.setAttribute('preserveAspectRatio', 'none');
  drawCropOverlay();
  let drag = -1;
  const toImg = e => {
    const r = svgEl.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width * D.src.width, 0, D.src.width), y: clamp((e.clientY - r.top) / r.height * D.src.height, 0, D.src.height) };
  };
  svgEl.addEventListener('pointerdown', e => {
    const p = toImg(e);
    let best = -1, bd = Infinity;
    D.corners.forEach((c, i) => { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = i; } });
    if (bd < Math.max(D.src.width, D.src.height) * 0.12) { drag = best; svgEl.setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  svgEl.addEventListener('pointermove', e => {
    if (drag < 0) return;
    D.corners[drag] = toImg(e);
    D.cornersTouched = true;
    drawCropOverlay();
  });
  const end = () => { drag = -1; };
  svgEl.addEventListener('pointerup', end);
  svgEl.addEventListener('pointercancel', end);
  if (!D.detectStarted) { D.detectStarted = true; detectCorners(); }
  else setHint('Drag the four corners onto the label edges.');
}

function drawCropOverlay() {
  const svgEl = $('#crop-svg');
  if (!svgEl || !D || !D.corners) return;
  const W = D.src.width, H = D.src.height, r = Math.max(W, H) * 0.022;
  const pts = D.corners.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  svgEl.innerHTML = `<path d="M0 0H${W}V${H}H0Z M${D.corners.map(c => `${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' L')}Z" fill="rgba(0,0,0,0.45)" fill-rule="evenodd"/>
    <polygon points="${pts}" fill="none" stroke="#C9A15B" stroke-width="${(r / 4).toFixed(1)}"/>
    ${D.corners.map(c => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r.toFixed(1)}" fill="#C9A15B" stroke="#1A1410" stroke-width="${(r / 5).toFixed(1)}"/>`).join('')}`;
}

const setHint = t => { const h = $('#crop-hint'); if (h) h.textContent = t; };

function loadScript(src, timeout) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    const t = setTimeout(() => rej(new Error('timeout')), timeout);
    s.onload = () => { clearTimeout(t); res(); };
    s.onerror = () => { clearTimeout(t); rej(new Error('load failed')); };
    document.head.appendChild(s);
  });
}

let cvLoading = null;
function ensureScanner() {
  if (!cvLoading) {
    cvLoading = (async () => {
      if (!(window.cv && window.cv.Mat)) {
        if (!window.cv) await loadScript(OPENCV_URL, 45000);
        if (window.cv && !window.cv.Mat && typeof window.cv.then === 'function') window.cv.then(m => { if (m && m.Mat) window.cv = m; });
        const t0 = Date.now();
        while (!(window.cv && window.cv.Mat)) {
          if (Date.now() - t0 > 30000) throw new Error('OpenCV timeout');
          await sleep(150);
        }
      }
      if (!window.jscanify) await loadScript(JSCANIFY_URL, 20000);
      return true;
    })().catch(e => { cvLoading = null; throw e; });
  }
  return cvLoading;
}

function quadArea(q) {
  let a = 0;
  for (let i = 0; i < 4; i++) { const p = q[i], n = q[(i + 1) % 4]; a += p.x * n.y - n.x * p.y; }
  return Math.abs(a) / 2;
}

async function detectCorners() {
  const draft = D;
  try {
    await ensureScanner();
    if (D !== draft || D.step !== 'crop') return;
    const src = D.src;
    const k = Math.min(1, 900 / Math.max(src.width, src.height));
    const small = document.createElement('canvas');
    small.width = Math.round(src.width * k);
    small.height = Math.round(src.height * k);
    small.getContext('2d').drawImage(src, 0, 0, small.width, small.height);
    const cv = window.cv;
    const mat = cv.imread(small);
    const scanner = new window.jscanify();
    let quad = null;
    try {
      const contour = scanner.findPaperContour(mat);
      if (contour) {
        const c = scanner.getCornerPoints(contour, mat);
        const pts = [c.topLeftCorner, c.topRightCorner, c.bottomRightCorner, c.bottomLeftCorner];
        if (pts.every(p => p && isFinite(p.x) && isFinite(p.y))) quad = pts.map(p => ({ x: p.x / k, y: p.y / k }));
      }
    } finally { mat.delete(); }
    if (D !== draft || D.step !== 'crop') return;
    if (quad && quadArea(quad) > 0.08 * src.width * src.height && !D.cornersTouched) {
      D.corners = quad;
      drawCropOverlay();
      setHint('Edges detected. Drag the corners to adjust.');
      return;
    }
    setHint('Drag the four corners onto the label edges.');
  } catch (e) {
    setHint('Drag the four corners onto the label edges.');
  }
}

function solveHomography(from, to) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const u = from[i].x, v = from[i].y, x = to[i].x, y = to[i].y;
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
  }
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    const d = A[c][c];
    if (Math.abs(d) < 1e-10) throw new Error('The corners are too close together');
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / d;
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function warpQuad(srcCanvas, quad, maxSide = 1400) {
  const [tl, tr, br, bl] = quad;
  let W = Math.max(dist(tl, tr), dist(bl, br)), H = Math.max(dist(tl, bl), dist(tr, br));
  const k = Math.min(1, maxSide / Math.max(W, H));
  W = Math.max(8, Math.round(W * k));
  H = Math.max(8, Math.round(H * k));
  const h = solveHomography([{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }], [tl, tr, br, bl]);
  const sw = srcCanvas.width, sh = srcCanvas.height;
  const sd = srcCanvas.getContext('2d').getImageData(0, 0, sw, sh).data;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d');
  const img = octx.createImageData(W, H);
  const od = img.data;
  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W; u++) {
      const uu = u + 0.5, vv = v + 0.5;
      const den = h[6] * uu + h[7] * vv + 1;
      const x = clamp((h[0] * uu + h[1] * vv + h[2]) / den - 0.5, 0, sw - 1);
      const y = clamp((h[3] * uu + h[4] * vv + h[5]) / den - 0.5, 0, sh - 1);
      const x0 = x | 0, y0 = y | 0, x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1), fx = x - x0, fy = y - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4, o = (v * W + u) * 4;
      for (let c = 0; c < 3; c++) {
        const t0 = sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx;
        const t1 = sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx;
        od[o + c] = t0 * (1 - fy) + t1 * fy;
      }
      od[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function toJpeg(canvas, maxSide, q) {
  const k = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  let c = canvas;
  if (k < 1) {
    c = document.createElement('canvas');
    c.width = Math.round(canvas.width * k);
    c.height = Math.round(canvas.height * k);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
  }
  return c.toDataURL('image/jpeg', q);
}

async function finishCrop(quad) {
  busy(true, 'Straightening the label…');
  await sleep(30);
  try {
    const out = quad ? warpQuad(D.src, quad) : D.src;
    const full = toJpeg(out, 1200, 0.85);
    D.imageB64 = full.split(',')[1];
    D.preview = full;
    D.thumb = toJpeg(out, 180, 0.72);
    D.src = null;
    D.step = 'form';
    busy(false);
    render();
    if (D.mode === 'add') runAnalysis();
  } catch (e) {
    busy(false);
    toast(e.message);
  }
}

const HINT_KEYS = ['producer', 'name', 'vintage', 'type', 'region', 'grapes'];

async function runAnalysis() {
  const draft = D;
  const hints = {};
  HINT_KEYS.forEach(k => {
    const v = str(draft.fields[k]).trim();
    if (v && (draft.touched.has(k) || draft.mode === 'edit')) hints[k] = v;
  });
  if (!draft.imageB64 && !hints.producer && !hints.name) { toast('Add a label photo or enter the producer or wine name first.'); return; }
  draft.ai = 'busy';
  updateBanner();
  try {
    const res = await api('analyze', { image: draft.imageB64 || null, hints });
    draft.ai = 'ok';
    draft.noVintage = !str(draft.fields.vintage).trim() && (res.vintage === null || res.vintage === undefined || res.vintage === '');
    applyAnalysis(draft, res || {});
  } catch (e) {
    draft.ai = 'error';
    draft.aiMsg = e.message.replace(/Claude API/g, 'AI service').replace(/Claude Console/g, 'API console').replace(/\.?$/, '.');
  }
  if (D === draft) updateBanner();
}

function applyAnalysis(draft, r) {
  const set = (key, val) => {
    if (val === null || val === undefined || val === '' || draft.touched.has(key)) return;
    const v = Array.isArray(val) ? val.join(', ') : String(val);
    draft.fields[key] = v;
    if (D === draft) {
      if (key === 'pairings' || key === 'tasteTags') renderTagBox(key);
      else { const el = document.querySelector(`[name="${key}"]`); if (el) { el.value = v; if (el.classList.contains('autosize')) autosize(el); } }
    }
  };
  ['producer', 'name', 'vintage', 'region', 'grapes', 'taste', 'tasteTags', 'pairings', 'drinkFrom', 'drinkUntil', 'peakFrom', 'peakUntil'].forEach(k => set(k, r[k]));
  if (r.type && !draft.touched.has('type')) {
    const t = TYPES.find(x => x.toLowerCase() === String(r.type).toLowerCase().replace('rose', 'rosé')) || null;
    if (t) { draft.fields.type = t; if (D === draft) { const el = document.querySelector('[name="type"]'); if (el) el.value = t; } }
  }
}

function updateBanner() {
  const b = $('#ai-banner');
  if (!b || !D) return;
  b.hidden = false;
  b.className = 'banner' + (D.ai === 'error' ? ' error' : '');
  b.innerHTML = D.ai === 'busy' ? '<span class="spinner"></span>Searching and completing details…'
    : D.ai === 'ok' ? ICON.spark + (D.noVintage ? 'No vintage found on the label. Enter it below, then tap Update details with AI to get the right drinking window.' : 'Details completed. Review and correct.')
    : `Details could not be completed: ${esc(D.aiMsg)} You can fill them in yourself.`;
}

/**
 * Stock corrections in Edit are carried into the journal without a new entry:
 * more bottles go to the newest purchase or gift, fewer are taken from the newest ones,
 * each keeping at least one bottle. Without any purchase an entry "Added" is created.
 */
function journalForCorrection(w, delta, stock, wineName) {
  if (!delta) return [];
  const ins = inEntries(w).slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const out = e => Object.assign({}, e, { price: e.price === null ? '' : e.price });
  if (delta > 0) {
    if (ins.length) return [out(Object.assign({}, ins[0], { qty: ins[0].qty + delta }))];
    return [{ id: newId('i'), wineId: w.id, dir: 'in', type: 'Added', qty: delta, loc: stock[0] ? stock[0].loc : '', date: todayISO(), price: '', priceCur: '', wineName }];
  }
  let rest = -delta;
  const changed = [];
  ins.forEach(e => {
    if (!rest) return;
    const take = Math.min(rest, Math.max(0, e.qty - 1));
    if (!take) return;
    rest -= take;
    changed.push(out(Object.assign({}, e, { qty: e.qty - take })));
  });
  return changed;
}

async function saveWineForm() {
  ['pairings', 'tasteTags'].forEach(k => { const i = $('#tg-in-' + k); if (i && i.value.trim()) addTag(k, i.value); });
  const f = D.fields;
  if (!f.name.trim() && !f.producer.trim()) { toast('Enter at least a producer or a wine name.'); return; }
  for (const r of D.ratings) {
    if (str(r.score).trim() === '') continue;
    const v = Number(String(r.score).replace(',', '.'));
    const max = sysInfo(r.sys).max;
    if (isNaN(v) || v < 0 || v > max) { toast(`${r.sys} scores go from 0 to ${max}.`); return; }
  }
  for (const k of ['drinkFrom', 'drinkUntil', 'peakFrom', 'peakUntil']) {
    const v = str(f[k]).trim();
    if (v && !/^\d{4}$/.test(v)) { toast('Drinking window years need four digits, for example 2027.'); return; }
  }
  const merged = [];
  D.stock.forEach(e => {
    const m = merged.find(x => samePlace(x, e));
    if (m) m.n += e.n; else merged.push(Object.assign(placeOf(e), { n: e.n }));
  });
  const stock = merged.filter(e => e.n > 0);
  if (stock.some(e => !str(e.loc).trim())) { toast('Choose a location. New ones can be added in the list.'); return; }
  const streetTxt = str(f.street).trim();
  if (streetTxt && parseMoney(streetTxt) === null) { toast('Prices need a number, for example 45.50.'); return; }
  const acq = D.acq;
  if (acq && acq.type === 'Purchase' && str(f.price).trim() && parseMoney(f.price) === null) { toast('Prices need a number, for example 45.50.'); return; }
  const P = PK();
  if (P && P.typing.trim()) addPerson(P.typing);
  const base = D.mode === 'edit' ? wineById(D.id) : null;
  let street = base ? base.street : null;
  if (streetTxt !== D.streetInit) street = streetTxt ? { v: parseMoney(streetTxt), cur: cur(), date: todayISO(), src: 'Manual', conf: '' } : null;
  const w = normWine(Object.assign({}, base || {}, {
    id: base ? base.id : newId('w'),
    producer: f.producer.trim(), name: f.name.trim(), vintage: str(f.vintage).trim(), type: f.type,
    region: f.region.trim(), grapes: f.grapes.trim(), taste: f.taste.trim(),
    tasteTags: splitList(f.tasteTags), pairings: splitList(f.pairings),
    drinkFrom: f.drinkFrom, drinkUntil: f.drinkUntil, peakFrom: f.peakFrom, peakUntil: f.peakUntil,
    stock, street,
    ratings: D.ratings.filter(r => str(r.score).trim() !== '').map(r => ({ sys: r.sys, score: Number(String(r.score).replace(',', '.')) })),
    thumb: D.thumb || (base ? base.thumb : ''),
    myRating: D.myRating
  }));
  const entries = [];
  if (acq && w.count > 0) {
    const price = acq.type === 'Purchase' ? parseMoney(f.price) : null;
    entries.push({
      id: newId('i'), dir: 'in', type: acq.type, qty: w.count, loc: stock[0].loc, date: f.date || todayISO(),
      price: price === null ? '' : price, priceCur: price === null ? '' : cur(),
      retailer: acq.type === 'Purchase' && acq.rp.people.length ? acq.rp.people[0].name : '',
      people: acq.type === 'Received' ? acq.pp.people.map(p => p.name).join(', ') : '',
      wineName: fullName(w)
    });
  }
  if (base) entries.push(...journalForCorrection(base, w.count - base.count, stock, fullName(w)));
  if (stock.length) store.set('wc-lastloc', stock[0].loc);
  const identity = x => lc([x.producer, x.name, x.vintage].join('|'));
  const refetch = !street || (base && streetTxt === D.streetInit && identity(base) !== identity(w));
  busy(true, 'Saving…');
  try {
    const d = await api('saveWine', { wine: serialWine(w), image: D.imageB64 || null, entries });
    const saved = normWine(d.wine || d);
    if (D.imageB64 && saved.labelFileId) cacheLabel(saved.labelFileId, D.imageB64);
    upsertWine(saved);
    (d.entries || []).map(normRemoval).forEach(r => {
      S.removals = S.removals.filter(x => x.id !== r.id).concat([r]);
      if (r.retailer && !S.retailers.some(x => lc(x.name) === lc(r.retailer))) S.retailers.push({ name: r.retailer, website: '' });
    });
    persist();
    D = null;
    busy(false);
    go('#/wine/' + encodeURIComponent(saved.id), true);
    const ret = acq && acq.type === 'Purchase' && acq.rp.people.length ? acq.rp.people[0].name : '';
    if (ret && str(acq.website).trim() !== str(acq.websiteInit).trim()) saveRetailerSite(ret, str(acq.website).trim());
    if (refetch && S.version >= 5) updateStreetPrices([saved.id], true);
  } catch (e) {
    busy(false);
    toast('Not saved: ' + e.message);
  }
}

/* ------------------------------------------------------------ settings */

function locationsHtml() {
  const used = {};
  S.wines.forEach(w => w.stock.forEach(e => { used[lc(e.loc)] = (used[lc(e.loc)] || 0) + e.n; }));
  const small = 'height:36px;padding:0 12px;font-size:13px';
  const rows = S.locations.map(l => {
    const n = used[lc(l)] || 0;
    const others = S.locations.filter(x => x !== l);
    if (isEditing('loc', l)) return `<div class="loc-row">${editRowHtml(l, undefined, shelfEditHtml(l))}</div>`;
    const head = `<div class="between"><span class="set-name">${esc(l)} <span class="muted small">${n ? `${n} ${n === 1 ? 'bottle' : 'bottles'}` : 'empty'}</span></span><span style="display:flex;gap:6px;flex:none">${n
      ? `<button class="btn" style="${small}" data-act="loc-show" data-v="${esc(l)}">Show</button><button class="btn" style="${small}" data-act="loc-move-open" data-v="${esc(l)}">Move</button>`
      : `<button class="icon-btn" data-act="loc-del" data-v="${esc(l)}" aria-label="Delete ${esc(l)}">${ICON.trash}</button>`}${editBtn('loc', l)}</span></div>`;
    const move = U.locMove === l ? (others.length
      ? `<div class="move-box"><span class="tiny muted">Move all bottles from ${esc(l)} to</span><div style="display:flex;gap:8px"><label class="field" style="flex:1"><span class="sr-only">Target location</span><select id="move-to">${others.map(o => `<option>${esc(o)}</option>`).join('')}</select></label><button class="btn accent" data-act="loc-move" data-v="${esc(l)}">Move</button><button class="icon-btn" data-act="loc-move-cancel" aria-label="Cancel">${ICON.x}</button></div></div>`
      : `<div class="move-box"><span class="small muted">Add another location first, then move the bottles there.</span></div>`) : '';
    return `<div class="loc-row">${head}${move}</div>`;
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
    S.wines.forEach(w => { w.stock.forEach(e => { if (eq(e.loc)) e.loc = to; }); if (eq(w.location)) w.location = to; });
    S.removals.forEach(r => { if (eq(r.loc)) r.loc = to; });
    if (eq(store.get('wc-lastloc', ''))) store.set('wc-lastloc', to);
  } else if (kind === 'ret') {
    S.removals.forEach(r => { if (eq(r.retailer)) r.retailer = to; });
  } else {
    const swap = v => { const out = []; namesOf(v).forEach(n => { const x = eq(n) ? to : n; if (!out.some(y => lc(y) === lc(x))) out.push(x); }); return out.join(', '); };
    S.removals.forEach(r => { r.people = swap(r.people); r.hearts = swap(r.hearts); });
    S.people = S.people.filter(n => !eq(n)).concat(S.people.some(n => lc(n) === lc(to)) ? [] : [to]);
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
  if (sameName && !shelves && (site === undefined || site === str((S.retailers.find(r => r.name === ed.name) || {}).website))) { U.edit = null; refreshView(); return; }
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
      if (shelves) {
        if (Object.keys(shelves).length) S.shelfNames[lc(to)] = shelves; else delete S.shelfNames[lc(to)];
        persist();
        refreshView();
        const saved = await api('setShelfNames', { name: to, shelves });
        if (saved && Object.keys(saved).length) S.shelfNames[lc(to)] = saved; else delete S.shelfNames[lc(to)];
      }
    }
    else if (ed.kind === 'ret') S.retailers = (await api('renameRetailer', { from: ed.name, to, website: site })).map(x => ({ name: str(x.name), website: str(x.website) })).filter(x => x.name);
    else S.people = await api('renamePerson', { from: ed.name, to });
    persist();
    refreshView();
    toast('Saved');
  } catch (e) { toast('Not saved: ' + e.message); sync(true); }
}

function viewSettings(first) {
  const c = CFG || { url: '', token: '' };
  const inStock = S.wines.filter(w => w.count > 0);
  const priced = inStock.filter(w => w.street).length;
  return `<main class="screen${first ? '' : ' has-nav'}" style="gap:16px">
    ${first ? '' : `<a class="back" href="#/cellar">${ICON.back}Cellar</a>`}
    <h1 class="title">${first ? 'Connect your cellar' : 'Settings'}</h1>
    ${first ? '' : `<section class="box"><span class="box-title">General</span>
      <label class="field">Currency<select data-change="currency">${CURRENCIES.map(v => `<option value="${v}"${v === cur() ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <p class="muted tiny" style="margin:0">${fxNote()}</p></section>
      <section class="box"><span class="box-title">Street prices</span>
      <p class="small" style="margin:0">${priced} of ${inStock.length} wines in stock have a street price.</p>
      <button class="btn block" data-act="street-all"${streetRun ? ' disabled' : ''}>${ICON.refresh}${streetRun ? 'Updating…' : 'Update all street prices'}</button>
      <p class="muted tiny" style="margin:0">AI looks up current shop prices on the web, one wine after the other. This costs about USD 0.02 per wine. New wines get their street price automatically.</p></section>`}
    ${first ? '' : locationsHtml()}
    ${first ? '' : retailersHtml()}
    ${first ? '' : peopleHtml()}
    ${first ? '' : '<h2 style="font-size:15px;font-weight:600;margin-top:8px">Connection</h2>'}
    <p class="muted" style="margin:0">Paste the web app URL and the token from your Google Apps Script. Both stay on this device.</p>
    <label class="field">Script URL<input id="cfg-url" type="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(c.url)}"></label>
    <label class="field">Token<input id="cfg-token" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(c.token)}"></label>
    <button class="btn primary big block" data-act="connect">${first ? 'Connect' : 'Save and reconnect'}</button>
    ${first ? '' : `<button class="btn block" data-act="reload">Reload data from Google Drive</button>
      <button class="btn danger block" data-act="disconnect">Disconnect this device</button>`}
    <p class="muted tiny center">Wine Cellar ${APP_VERSION}${S.version ? ` · script ${S.version}` : ''}</p>
  </main>${first ? '' : nav(null)}`;
}

/* ------------------------------------------------------------ actions */

const ACTS = {
  refresh: () => sync(false),
  'f-toggle': el => { const st = U.f[el.dataset.ctx]; st.open = !st.open; refreshView(); },
  'f-chip': el => {
    const a = sel(el.dataset.ctx, el.dataset.k);
    const i = a.indexOf(el.dataset.v);
    if (i >= 0) a.splice(i, 1); else a.push(el.dataset.v);
    refreshView();
  },
  'f-tab': el => { U.f[el.dataset.ctx].tab = el.dataset.v; refreshView(); },
  'f-more': el => { U.f[el.dataset.ctx].all[el.dataset.k] = true; refreshView(); },
  'f-less': el => { U.f[el.dataset.ctx].all[el.dataset.k] = false; refreshView(); },
  'f-clear': el => { const st = U.f[el.dataset.ctx]; st.sel = {}; st.range = {}; st.rating = null; refreshView(); },
  'rating-clear': el => { U.f[el.dataset.ctx].rating = null; refreshView(); },
  'rt-sys': el => {
    const st = U.f[el.dataset.ctx], v = el.dataset.v;
    st.rating = st.rating && st.rating.sys === v ? null : { sys: v, min: 0 };
    refreshView();
  },
  'range-clear': el => { const st = U.f[el.dataset.ctx]; if (st.range) delete st.range[el.dataset.k]; refreshView(); },
  'street-one': el => updateStreetPrices([el.dataset.id]),
  'offer-one': el => updateOffer(el.dataset.id),
  'street-all': () => {
    const ids = S.wines.filter(w => w.count > 0).map(w => w.id);
    if (!ids.length) { toast('No wines in stock.'); return; }
    if (!confirm(`Look up the street price of ${ids.length} ${ids.length === 1 ? 'wine' : 'wines'} on the web? This costs about USD ${(ids.length * 0.02).toFixed(2)}.`)) return;
    updateStreetPrices(ids);
  },
  'j-fav-off': () => { U.jFav = false; refreshView(); },
  'top-finished-off': () => { U.topFinished = false; refreshView(); },
  'loc-add': async () => {
    const i = $('#new-loc');
    const name = i.value.replace(/\s+/g, ' ').trim();
    if (!name) { toast('Enter a name for the location.'); return; }
    if (S.locations.some(l => lc(l) === lc(name))) { toast('This location already exists.'); return; }
    S.locations.push(name);
    persist();
    refreshView();
    try { S.locations = await api('addLocation', { name }); persist(); refreshView(); }
    catch (e) { S.locations = S.locations.filter(l => l !== name); persist(); refreshView(); toast('Not saved: ' + e.message); }
  },
  'loc-show': el => {
    U.f.cellar.sel = { location: [lc(el.dataset.v)] };
    U.f.cellar.open = false;
    U.search = '';
    go('#/cellar');
  },
  'ed-open': el => { U.edit = { kind: el.dataset.k, name: el.dataset.v }; U.locMove = null; refreshView(); const i = $('#ed-name'); if (i) i.focus(); },
  'ed-cancel': () => { U.edit = null; refreshView(); },
  'shelf-more': () => { if (U.edit) { const i = $('#ed-name'); if (i) U.edit.typed = i.value; U.edit.shelfTop = (U.edit.shelfTop || 0) + 1; refreshView(); } },
  'ed-save': () => saveEdit(),
  'ret-add': async () => {
    const name = ($('#new-ret').value || '').replace(/\s+/g, ' ').trim(), website = ($('#new-ret-site').value || '').trim();
    if (!name) { toast('Enter the name of the retailer.'); return; }
    if (S.retailers.some(r => lc(r.name) === lc(name))) { toast('This retailer already exists.'); return; }
    saveRetailerSite(name, website);
  },
  'person-add': async () => {
    const name = ($('#new-person').value || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name) { toast('Enter a name.'); return; }
    if (knownPeople().some(p => lc(p.name) === lc(name))) { toast('This person already exists.'); return; }
    S.people.push(name);
    persist();
    refreshView();
    try { S.people = await api('savePerson', { name }); persist(); refreshView(); }
    catch (e) { S.people = S.people.filter(n => n !== name); persist(); refreshView(); toast('Not saved: ' + e.message); }
  },
  'person-del': async el => {
    const name = el.dataset.v;
    if (!confirm(`Delete ${name}?`)) return;
    const prev = S.people.slice();
    S.people = S.people.filter(n => lc(n) !== lc(name));
    persist();
    refreshView();
    try { S.people = await api('deletePerson', { name }); persist(); refreshView(); }
    catch (e) { S.people = prev; persist(); refreshView(); toast('Not deleted: ' + e.message); }
  },
  'ret-del': async el => {
    const name = el.dataset.v;
    if (!confirm(`Delete the retailer ${name}?`)) return;
    const prev = S.retailers.slice();
    S.retailers = S.retailers.filter(r => r.name !== name);
    persist();
    refreshView();
    try { S.retailers = (await api('deleteRetailer', { name })).map(x => ({ name: str(x.name), website: str(x.website) })).filter(x => x.name); persist(); refreshView(); }
    catch (e) { S.retailers = prev; persist(); refreshView(); toast('Not deleted: ' + e.message); }
  },
  'loc-move-open': el => { U.locMove = el.dataset.v; refreshView(); },
  'loc-move-cancel': () => { U.locMove = null; refreshView(); },
  'loc-move': async el => {
    const from = el.dataset.v, to = $('#move-to').value;
    if (!to || !confirm(`Move all wines from ${from} to ${to}?`)) return;
    const moved = S.wines.filter(w => w.stock.some(e => lc(e.loc) === lc(from)));
    const prev = moved.map(w => JSON.parse(JSON.stringify(w.stock)));
    moved.forEach(w => {
      const src = w.stock.filter(e => lc(e.loc) === lc(from));
      w.stock = w.stock.filter(e => !src.includes(e));
      src.forEach(e => localStock(w, { loc: to, shelf: null, pos: '' }, e.n));
    });
    U.locMove = null;
    persist();
    refreshView();
    try { await api('moveLocation', { from, to }); toast(`${moved.length} ${moved.length === 1 ? 'wine' : 'wines'} moved to ${to}`); }
    catch (e) { moved.forEach((w, i) => { w.stock = prev[i]; w.count = prev[i].reduce((a, x) => a + x.n, 0); }); persist(); refreshView(); toast('Not moved: ' + e.message); }
  },
  'loc-del': async el => {
    const name = el.dataset.v;
    if (!confirm(`Delete the location ${name}?`)) return;
    const prev = S.locations.slice();
    S.locations = S.locations.filter(l => l !== name);
    persist();
    refreshView();
    try { S.locations = await api('deleteLocation', { name }); persist(); refreshView(); }
    catch (e) { S.locations = prev; persist(); refreshView(); toast('Not deleted: ' + e.message); }
  },
  'edit-entry': el => openEditEntry(el.dataset.id, !!el.dataset.record),
  'toggle-finished': () => { U.showFinished = !U.showFinished; refreshView(); },
  plus: el => openAddSheet(el.dataset.id, el.dataset.i === undefined ? undefined : Number(el.dataset.i)),
  minus: el => openRemoveSheet(el.dataset.id, el.dataset.i === undefined ? undefined : Number(el.dataset.i)),
  winf: el => { U.winFilter = el.dataset.v; render(); },
  'top-mode': el => { U.topMode = el.dataset.v; render(); },
  'top-sys': el => { U.topSys = el.dataset.v; render(); },

  rate: el => {
    if (!D) return;
    const base = D.myRating === null ? 50 : D.myRating;
    setRating(clamp(base + Number(el.dataset.d), 0, 100));
  },
  'rate-clear': () => setRating(null),
  'open-add-rating': () => { U.addRatingOpen = true; refreshView(); const s = $('#new-score'); if (s) s.focus(); },
  'close-add-rating': () => { U.addRatingOpen = false; refreshView(); },
  'save-rating': async () => {
    const w = wineById(route().id);
    const sys = $('#new-sys').value;
    const v = Number(String($('#new-score').value).replace(',', '.'));
    const max = sysInfo(sys).max;
    if (!$('#new-score').value.trim() || isNaN(v) || v < 0 || v > max) { toast(`${sys} scores go from 0 to ${max}.`); return; }
    const prev = w.ratings.slice();
    w.ratings = w.ratings.concat([{ sys, score: v }]);
    U.addRatingOpen = false;
    persist();
    refreshView();
    try { upsertWine(normWine(await api('update', { id: w.id, fields: { ratings: JSON.stringify(w.ratings) } }))); persist(); }
    catch (e) { w.ratings = prev; persist(); refreshView(); toast('Not saved: ' + e.message); }
  },
  'rm-rating': async el => {
    const w = wineById(route().id);
    const r = w.ratings[Number(el.dataset.i)];
    if (!r || !confirm(`Remove the ${r.sys} rating?`)) return;
    const prev = w.ratings.slice();
    w.ratings = w.ratings.filter((x, i) => i !== Number(el.dataset.i));
    persist();
    refreshView();
    try { upsertWine(normWine(await api('update', { id: w.id, fields: { ratings: JSON.stringify(w.ratings) } }))); persist(); }
    catch (e) { w.ratings = prev; persist(); refreshView(); toast('Not saved: ' + e.message); }
  },
  'p-heart': el => { const p = PK().people[Number(el.dataset.i)]; if (p) { p.heart = !p.heart; updatePeople(); } },
  'p-rm': el => {
    const P = PK();
    P.people.splice(Number(el.dataset.i), 1);
    if (RS && P === RS.rp) renderSheet(); else { updatePeople(); renderSiteBox(); }
  },
  'p-pick': el => addPerson(el.dataset.v),
  'p-add-typed': () => addPerson(PK().typing),
  'p-all': () => { PK().showAll = true; updatePeople(); },
  acq: el => { D.acq.type = el.dataset.v; render(); },

  'sheet-close': () => closeSheet(),
  'rs-type': el => { RS.type = el.dataset.v; renderSheet(); },
  'rs-loc': el => { RS.loc = el.dataset.v; placeFromStock(); renderSheet(); },
  'rs-place': el => { const w = wineById(RS.wineId); Object.assign(RS, placeOf(w.stock[Number(el.dataset.i)])); RS.qty = clamp(RS.qty, 1, qtyMax()); renderSheet(); },
  'rs-shelf': el => {
    RS.shelf = shelfStep(RS.shelf, Number(el.dataset.d));
    $('#rs-shelf').textContent = shelfText(RS.loc, RS.shelf);
    const h = $('#rs-hint');
    if (h) h.textContent = placeHint();
  },
  'rs-qty': el => { RS.qty = clamp(RS.qty + Number(el.dataset.d), 1, qtyMax()); $('#rs-qty').value = RS.qty; },
  'rs-skip': () => saveSheet(false),
  'rs-save': () => saveSheet(true),
  'rs-delete': () => startDelete(),
  'del-cancel': () => { RS.del = null; renderSheet(); },
  'del-only': () => deleteEntryOnly(),
  'del-confirm': () => confirmDelete(),
  'del-loc': el => {
    const w = wineById(RS.wineId);
    const e = w.stock.filter(x => lc(x.loc) === lc(el.dataset.v)).sort((x, y) => y.n - x.n)[0];
    Object.assign(RS.del, { loc: el.dataset.v, shelf: e ? shelfVal(e.shelf) : null, pos: e ? str(e.pos) : '' });
    renderSheet();
  },
  'del-shelf': el => {
    RS.del.shelf = shelfStep(RS.del.shelf, Number(el.dataset.d));
    $('#del-shelf').textContent = shelfText(RS.del.loc, RS.del.shelf);
    const h = $('#del-hint');
    if (h) h.textContent = delHint();
  },
  'del-place': el => { RS.del.i = Number(el.dataset.i); renderSheet(); },
  'record-add': () => { if (D && D.id) openAddSheet(D.id, null, 'record'); },

  'cancel-form': () => {
    const back = D && D.mode === 'edit' ? '#/wine/' + encodeURIComponent(D.id) : '#/cellar';
    D = null;
    go(back, true);
  },
  'skip-photo': () => { D.step = 'form'; render(); },
  'new-photo': () => { D.step = 'photo'; render(); },
  retake: () => { D.step = 'photo'; D.src = null; render(); },
  'do-crop': () => finishCrop(D.corners),
  'use-full': () => finishCrop(null),
  'st-n': el => {
    const e = D.stock[Number(el.dataset.i)];
    e.n = clamp(e.n + Number(el.dataset.d), 0, 999);
    $('#st-n-' + el.dataset.i).value = e.n;
    const t = $('#st-total');
    if (t) t.textContent = D.stock.reduce((a, x) => a + x.n, 0) + ' bottles';
  },
  'st-shelf': el => {
    const e = D.stock[Number(el.dataset.i)];
    e.shelf = shelfStep(shelfVal(e.shelf), Number(el.dataset.d));
    $('#st-shelf-' + el.dataset.i).textContent = shelfText(e.loc, e.shelf);
  },
  'st-add-open': () => { D.addLoc = true; D.move = null; renderStockBox(); },
  'st-add-close': () => { D.addLoc = false; renderStockBox(); },
  'st-add': el => { D.stock.push({ loc: el.dataset.v, shelf: null, pos: '', n: 0 }); D.addLoc = false; renderStockBox(); },
  'st-add-new': async () => {
    const name = await newLocationPrompt();
    if (name) D.stock.push({ loc: name, shelf: null, pos: '', n: 0 });
    D.addLoc = false;
    renderStockBox();
  },
  'st-move-open': () => {
    if (D.move) { D.move = null; renderStockBox(); return; }
    const from = D.stock.findIndex(e => e.n > 0);
    const to = D.stock.findIndex((e, i) => i !== from);
    if (from < 0 || to < 0) return;
    D.move = { from, to, n: 1 };
    D.addLoc = false;
    renderStockBox();
  },
  'st-move-close': () => { D.move = null; renderStockBox(); },
  'mv-n': el => {
    const src = D.stock[D.move.from];
    D.move.n = clamp(D.move.n + Number(el.dataset.d), 1, Math.max(1, src ? src.n : 1));
    $('#mv-n').value = D.move.n;
  },
  'st-move': () => {
    const m = D.move;
    const src = D.stock[m.from], dst = D.stock[m.to];
    if (!src || !dst || m.from === m.to) return;
    const n = Math.min(m.n, src.n);
    src.n -= n;
    dst.n += n;
    D.move = null;
    renderStockBox();
    toast(`${n} ${n === 1 ? 'bottle' : 'bottles'} moved to ${placeLabel(dst)}. Save to keep it.`);
  },
  radd: () => {
    const used = D.ratings.map(r => r.sys);
    const next = SYSTEMS.find(x => !used.includes(x.key)) || SYSTEMS[0];
    D.ratings.push({ sys: next.key, score: '' });
    render();
  },
  rrm: el => { D.ratings.splice(Number(el.dataset.i), 1); render(); },
  'ers-open': el => openRatingSheet(Number(el.dataset.i)),
  'ers-close': () => { RT = null; renderRatingSheet(); },
  'ers-sys': el => { RT.sys = el.dataset.v; renderRatingSheet(); },
  'ers-save': () => saveRatingSheet(),
  'tg-rm': el => { const k = el.dataset.k, t = tagList(k); t.splice(Number(el.dataset.i), 1); D.fields[k] = t.join(', '); D.touched.add(k); renderTagBox(k); },
  'save-wine': () => saveWineForm(),
  'ai-refresh': () => { if (D && D.ai !== 'busy') runAnalysis(); },
  'delete-wine': async () => {
    const w = wineById(D.id);
    if (!w || !confirm(`Delete ${fullName(w)}? Its journal entries stay.`)) return;
    busy(true, 'Deleting…');
    try {
      await api('deleteWine', { id: w.id });
      S.wines = S.wines.filter(x => x.id !== w.id);
      persist();
      D = null;
      busy(false);
      go('#/cellar', true);
    } catch (e) { busy(false); toast('Not deleted: ' + e.message); }
  },

  connect: async () => {
    const url = $('#cfg-url').value.trim(), token = $('#cfg-token').value.trim();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { toast('The script URL starts with https://script.google.com/'); return; }
    if (!token) { toast('Paste your token.'); return; }
    busy(true, 'Connecting…');
    try {
      await api('ping', {}, { url, token });
      CFG = { url, token };
      store.set('wc-config', CFG);
      busy(false);
      await sync(true);
      go('#/cellar', true);
      render();
      toast('Connected');
    } catch (e) { busy(false); toast(e.message); }
  },
  reload: () => sync(false),
  disconnect: () => {
    if (!confirm('Disconnect this device? Your data stays in Google Drive.')) return;
    CFG = null;
    store.del('wc-config');
    store.del('wc-data');
    S.wines = []; S.removals = [];
    go('#/cellar', true);
    render();
  }
};

const INPUTS = {
  search: el => {
    U.search = el.value;
    const l = $('#wine-list'), f = $('#facet-chips-cellar'), d = $('#drink-soon');
    if (l) l.innerHTML = cellarList();
    if (d) d.innerHTML = drinkSoonHtml();
    if (f) f.innerHTML = facetChipsHtml('cellar');
  },
  facetq: el => { const ctx = el.dataset.ctx, st = U.f[ctx]; st.q[st.tab] = el.value; const f = $('#facet-chips-' + ctx); if (f) f.innerHTML = facetChipsHtml(ctx); },
  rs: el => {
    if (!RS) return;
    RS[el.name] = el.value;
    const h = el.name === 'pos' && $('#rs-hint');
    if (h) h.textContent = placeHint();
  },
  rng: el => onRange(el),
  rtmin: el => onRatingMin(el),
  'ed-shelf': el => { if (U.edit && U.edit.shelves) { const v = el.value.trim(); if (v) U.edit.shelves[el.dataset.n] = el.value; else delete U.edit.shelves[el.dataset.n]; } },
  'ers-score': el => { if (!RT) return; RT.score = el.value; const p = $('#rt-preview'); if (p) p.innerHTML = rtPreview(); },
  'tg-in': el => { if (el.value.includes(',')) { const k = el.dataset.k; addTag(k, el.value); } },
  'qty-in': el => setQty(el, false),
  'acq-site': el => { if (D && D.acq) D.acq.website = el.value; },
  'del-pos': el => { if (!RS || !RS.del) return; RS.del.pos = el.value; const h = $('#del-hint'); if (h) h.textContent = delHint(); },
  'st-pos': el => { if (D) D.stock[Number(el.dataset.i)].pos = el.value; },
  people: el => {
    const P = PK();
    if (!P) return;
    const parts = el.value.split(',');
    if (parts.length > 1) { parts.slice(0, -1).forEach(addPerson); el.value = parts[parts.length - 1]; }
    P.typing = el.value;
    const s = $('#people-sugg');
    if (s) s.innerHTML = peopleSuggHtml();
  },
  jsearch: el => {
    U.jSearch = el.value;
    const l = $('#journal-list'), f = $('#facet-chips-journal');
    if (l) l.innerHTML = journalList();
    if (f) f.innerHTML = facetChipsHtml('journal');
  },
  field: el => { if (D) { D.fields[el.name] = el.value; D.touched.add(el.name); } if (el.classList.contains('autosize')) autosize(el); },
  rscore: el => { if (D) D.ratings[Number(el.dataset.i)].score = el.value; }
};

const CHANGES = {
  field: el => { if (D) { D.fields[el.name] = el.value; D.touched.add(el.name); } },
  rsys: el => { if (D) D.ratings[Number(el.dataset.i)].sys = el.value; },
  'ret-site': el => saveRetailerSite(el.dataset.v, el.value.trim()),

  currency: async el => {
    S.settings = Object.assign({}, S.settings, { currency: el.value });
    persist();
    refreshView();
    try { await api('setSettings', { settings: { currency: el.value } }); toast('Currency saved. All prices are shown in ' + el.value + '.'); }
    catch (e) { toast('Saved on this device only: ' + e.message); }
  },
  'show-finished': el => { U.showFinished = el.checked; refreshView(); },
  'top-finished': el => { U.topFinished = el.checked; refreshView(); },
  'j-fav': el => { U.jFav = el.checked; refreshView(); },
  'qty-in': el => setQty(el, true),
  'stock-loc': async el => {
    if (!D) return;
    const e = D.stock[Number(el.dataset.i)];
    if (el.value !== '__new') { e.loc = el.value; return; }
    const name = await newLocationPrompt();
    if (name) e.loc = name;
    renderStockBox();
  },
  'mv-from': el => {
    D.move.from = Number(el.value);
    if (D.move.to === D.move.from) D.move.to = D.stock.findIndex((x, i) => i !== D.move.from);
    const src = D.stock[D.move.from];
    D.move.n = clamp(D.move.n, 1, Math.max(1, src ? src.n : 1));
    renderStockBox();
  },
  'mv-to': el => { D.move.to = Number(el.value); },
  photo: async el => {
    const file = el.files && el.files[0];
    if (!file) return;
    busy(true, 'Loading photo…');
    try {
      D.src = await loadPhoto(file);
      D.corners = defaultCorners(D.src);
      D.cornersTouched = false;
      D.detectStarted = false;
      D.step = 'crop';
      busy(false);
      render();
    } catch (e) { busy(false); toast(e.message); }
  }
};

/* ------------------------------------------------------------ start */

/**
 * Opens shops and retailer websites outside the app, so the app stays open behind them.
 * iPhone home screen apps hand the link to Safari, all others open a new browser tab.
 */
function openExternal(url) {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  const v = /OS (\d+)_/.exec(ua);
  if (ios && standalone && v && Number(v[1]) >= 17) {
    window.location.href = 'x-safari-' + url;
    return;
  }
  const w = window.open(url, '_blank');
  if (w) { try { w.opener = null; } catch (e) { /* ignore */ } }
  else toast('The link could not be opened. Allow pop-ups for this app.');
}

/** Typed bottle counts. While typing only the state changes, on leaving the field the value is corrected. */
function setQty(el, final) {
  const raw = el.value.replace(/[^0-9]/g, '');
  const k = el.dataset.k;
  let v = raw === '' ? null : Number(raw);
  if (k === 'rs' && RS) {
    v = clamp(v === null ? 1 : v, 1, qtyMax());
    RS.qty = v;
  } else if (k === 'st' && D) {
    v = clamp(v === null ? 0 : v, 0, 9999);
    D.stock[Number(el.dataset.i)].n = v;
    const t = $('#st-total');
    if (t) t.textContent = D.stock.reduce((a, x) => a + x.n, 0) + ' bottles';
  } else if (k === 'mv' && D && D.move) {
    const src = D.stock[D.move.from];
    v = clamp(v === null ? 1 : v, 1, Math.max(1, src ? src.n : 1));
    D.move.n = v;
  } else return;
  if (final || String(v) !== raw && raw !== '') el.value = v;
}

function init() {
  document.addEventListener('click', e => {
    const ext = e.target.closest('a[target="_blank"]');
    if (ext && /^https?:/i.test(ext.href)) { e.preventDefault(); openExternal(ext.href); return; }
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = ACTS[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('input', e => {
    const el = e.target.closest('[data-input]');
    if (el && INPUTS[el.dataset.input]) INPUTS[el.dataset.input](el, e);
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-change]');
    if (el && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el, e);
  });
  document.addEventListener('keydown', e => {
    if (e.target && e.target.id === 'people-input' && e.key === 'Enter') { e.preventDefault(); addPerson(e.target.value); }
    if (e.target && e.target.id === 'new-loc' && e.key === 'Enter') { e.preventDefault(); ACTS['loc-add'](); }
    if (e.target && e.target.dataset && e.target.dataset.input === 'tg-in' && e.key === 'Enter') { e.preventDefault(); addTag(e.target.dataset.k, e.target.value); }
    if (e.target && e.target.id === 'rt-score' && e.key === 'Enter') { e.preventDefault(); saveRatingSheet(); }
    if (e.target && e.target.id === 'new-person' && e.key === 'Enter') { e.preventDefault(); ACTS['person-add'](); }
    if (e.target && e.target.id === 'new-ret-site' && e.key === 'Enter') { e.preventDefault(); ACTS['ret-add'](); }
    if (e.target && (e.target.id === 'ed-name' || e.target.id === 'ed-site') && e.key === 'Enter') { e.preventDefault(); saveEdit(); }
  });
  window.addEventListener('hashchange', () => { if (RS) closeSheet(); if (RT) { RT = null; renderRatingSheet(); } render(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && CFG && !isFormRoute()) sync(true); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
  loadCache();
  render();
  if (CFG) sync(true);
}

if (typeof document !== 'undefined') init();
if (typeof module !== 'undefined') module.exports = { normWine, serialWine, normRemoval, windowParts, statusOf, solveHomography, parseRatings, splitList, fmtScore, conv, avgPrice, S };
