'use strict';

/* Wine Cellar, a private wine cellar app.
   Data lives in your Google Sheet, reached through your Google Apps Script web app. */

const APP_VERSION = '1.4.1';
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
const REMOVAL_TYPES = ['Dinner', 'Celebration', 'Gift', 'Other'];
const OCCASION_HINTS = { Dinner: 'Sunday dinner at home', Celebration: 'Birthday, anniversary', Gift: 'Housewarming, thank you', Other: 'Tasting, cooking' };

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
  gift: svg('<path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7C10.5 4 7 4 7 6s3 1 5 1zM12 7c1.5-3 5-3 5-1s-3 1-5 1z"/>', 14, 1.8)
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
const S = { wines: [], removals: [], locations: [] };
const U = {
  search: '', showFinished: false, filterOpen: false, filters: { wine: [], grape: [], food: [], location: [] }, filterAll: {}, filterTab: 'wine', facetQ: {},
  winFilter: 'All', topType: 'All', topMode: 'mine', topSys: null, topFinished: false, addRatingOpen: false,
  jSearch: '', jPerson: null, jFav: false, jAllPeople: false
};
let D = null;   // add or edit draft
let RS = null;  // removal sheet state
let lastRouteKey = '';

/* ------------------------------------------------------------ data model */

function parseRatings(v) {
  let a = v;
  if (!Array.isArray(a)) { try { a = JSON.parse(v || '[]'); } catch (e) { a = []; } }
  if (!Array.isArray(a)) return [];
  return a.filter(r => r && r.sys && r.score !== '' && r.score !== null && !isNaN(Number(r.score))).map(r => ({ sys: String(r.sys), score: Number(r.score) }));
}

function normWine(w) {
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
    location: str(w.location),
    shelf: numOrNull(w.shelf),
    position: str(w.position),
    count: Math.max(0, Number(w.count) || 0),
    myRating: numOrNull(w.myRating),
    ratings: parseRatings(w.ratings),
    labelFileId: str(w.labelFileId),
    thumb: str(w.thumb),
    createdAt: str(w.createdAt),
    updatedAt: str(w.updatedAt),
    retailer: str(w.retailer),
    purchaseDate: str(w.purchaseDate).slice(0, 10),
    purchasePrice: numOrNull(w.purchasePrice),
    streetPrice: numOrNull(w.streetPrice),
    acquired: str(w.acquired) === 'Gift' ? 'Gift' : 'Purchased',
    giftFrom: str(w.giftFrom)
  };
}

const CURRENCY = 'CHF';
const money = v => `${CURRENCY} ${Number(v).toFixed(2)}`;
const parseMoney = v => { const s = str(v).trim().replace(/[^\d.,-]/g, '').replace(',', '.'); return s === '' || isNaN(Number(s)) ? null : Number(s); };

function serialWine(w) {
  const o = Object.assign({}, w);
  o.tasteTags = w.tasteTags.join(', ');
  o.pairings = w.pairings.join(', ');
  o.ratings = JSON.stringify(w.ratings);
  ['drinkFrom', 'peakFrom', 'peakUntil', 'drinkUntil', 'shelf', 'myRating', 'purchasePrice', 'streetPrice'].forEach(k => { if (o[k] === null) o[k] = ''; });
  return o;
}

function normRemoval(r) {
  return { id: str(r.id), wineId: str(r.wineId), date: str(r.date).slice(0, 10), type: str(r.type) || 'Other', occasion: str(r.occasion), people: str(r.people), hearts: str(r.hearts), food: str(r.food), note: str(r.note), wineName: str(r.wineName) };
}

const lc = s => String(s).toLowerCase();
const namesOf = s => splitList(s).map(n => n.replace(/\s+/g, ' '));
function knownPeople() {
  const m = new Map();
  const nowMs = Date.now();
  const add = (n, date) => {
    const k = lc(n);
    const e = m.get(k) || { name: n, n: 0, score: 0, last: '' };
    const d = parseISO(date);
    const days = d ? Math.max(0, (nowMs - d.getTime()) / 864e5) : 365;
    e.n += 1;
    e.score += 1 + 3 * Math.exp(-days / 90);
    if (!e.last || str(date) >= e.last) { e.last = str(date); e.name = n; }
    m.set(k, e);
  };
  S.removals.forEach(r => namesOf(r.people).forEach(n => add(n, r.date)));
  S.wines.filter(w => w.acquired === 'Gift').forEach(w => namesOf(w.giftFrom).forEach(n => add(n, str(w.purchaseDate || w.createdAt).slice(0, 10))));
  return [...m.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
const byName = list => list.slice().sort((a, b) => a.name.localeCompare(b.name));

function loadCache() {
  const c = store.get('wc-data', null);
  if (!c) return;
  S.wines = (c.wines || []).map(normWine);
  S.removals = (c.removals || []).map(normRemoval);
  if (Array.isArray(c.locations)) S.locations = c.locations;
}
function persist() { store.set('wc-data', { wines: S.wines, removals: S.removals, locations: S.locations }); }
const wineById = id => S.wines.find(w => w.id === id);
function upsertWine(w) {
  const i = S.wines.findIndex(x => x.id === w.id);
  if (i >= 0) S.wines[i] = w; else S.wines.push(w);
}

const wineTitle = w => w.name || w.producer || 'Unnamed wine';
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
    S.wines = (d.wines || []).map(normWine).filter(w => w.id);
    S.removals = (d.removals || []).map(normRemoval).filter(r => r.id);
    S.locations = Array.isArray(d.locations) ? d.locations : [];
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
  if ((r.p === 'add' || r.p === 'edit') && D && D.step === 'form') { setupRating(); if (D.ai) updateBanner(); }
}

/* ------------------------------------------------------------ view: cellar */

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const grapeNames = w => String(w.grapes || '').split(/[,;\/+&]/)
  .map(s => cap(s.replace(/\d+([.,]\d+)?\s*%?/g, '').replace(/\s+/g, ' ').trim()))
  .filter(s => s.length > 1);
const foodNames = w => w.pairings.map(s => cap(s.trim())).filter(Boolean);
const FACETS = {
  wine: { label: 'Wine', plural: 'wine types', of: w => [w.type] },
  grape: { label: 'Grape', plural: 'grapes', of: grapeNames },
  food: { label: 'Food', plural: 'dishes', of: foodNames },
  location: { label: 'Location', plural: 'locations', of: w => (w.location ? [w.location] : []) }
};
const typeIndex = n => { const i = TYPES.indexOf(n); return i < 0 ? 99 : i; };

function facetValues(pool, key) {
  const m = new Map();
  pool.forEach(w => {
    const seen = new Set();
    FACETS[key].of(w).forEach(v => {
      const k = lc(v);
      if (seen.has(k)) return;
      seen.add(k);
      const e = m.get(k) || { key: k, name: v, n: 0 };
      e.n += 1;
      m.set(k, e);
    });
  });
  const list = [...m.values()];
  return key === 'wine'
    ? list.sort((a, b) => typeIndex(a.name) - typeIndex(b.name))
    : list.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

const activeFilterCount = () => Object.values(U.filters).reduce((a, x) => a + x.length, 0);
const passesFilters = w => Object.keys(FACETS).every(k => !U.filters[k].length || FACETS[k].of(w).some(v => U.filters[k].includes(lc(v))));
const cellarPool = () => S.wines.filter(w => U.showFinished || w.count > 0);

function viewCellar() {
  const inStock = S.wines.filter(w => w.count > 0);
  const bottles = inStock.reduce((a, w) => a + w.count, 0);
  const urgent = inStock.filter(w => ['Past peak', 'Drink soon'].includes(statusOf(w))).sort(urgencyCmp).slice(0, 4);
  const head = `<header class="top"><div><h1 class="title">Wine Cellar</h1><p class="muted">${bottles} bottles · ${inStock.length} wines</p></div>
    <div class="top-actions"><button class="icon-btn" data-act="refresh" aria-label="Refresh">${ICON.refresh}</button><a class="icon-btn" href="#/settings" aria-label="Settings">${ICON.gear}</a></div></header>`;
  if (!S.wines.length) {
    return `<main class="screen has-nav">${head}<div class="empty"><h2>Your cellar is empty</h2><p>Photograph a label and the details are filled in for you.</p><a class="btn primary" href="#/add">Add your first wine</a></div></main>${nav('cellar')}`;
  }
  const filters = filterArea();
  const n = activeFilterCount();
  return `<main class="screen has-nav">${head}
    <div style="display:flex;gap:8px"><label class="search" style="flex:1;min-width:0">${ICON.search}<input type="search" data-input="search" aria-label="Search" placeholder="Search wine, grape or food" value="${esc(U.search)}"></label>
      <button class="filter-btn${U.filterOpen || n ? ' on' : ''}" data-act="filter-toggle" aria-expanded="${U.filterOpen}" aria-label="Filter">${ICON.filter}${n ? `<span class="count">${n}</span>` : ''}</button></div>
    ${filters}
    ${urgent.length ? `<section><div class="sec-head"><h2>Drink now</h2><a href="#/window" class="small">See all</a></div>
      <div class="grid2">${urgent.map(w => `<a class="card card-link" href="#/wine/${encodeURIComponent(w.id)}">${thumbHtml(w, true)}<div class="row-text"><span class="row-title" style="font-size:13px">${esc(wineTitle(w))}</span><span class="row-sub">${esc(w.vintage || '')}${w.vintage ? ' · ' : ''}${w.count} btl</span>${pill(w)}</div></a>`).join('')}</div></section>` : ''}
    <section><h2>All wines</h2><div id="wine-list">${cellarList()}</div></section>
  </main><a class="fab" href="#/add" aria-label="Add a new wine">${ICON.plusBig}</a>${nav('cellar')}`;
}

function facetCountsFor(key) {
  const pool = cellarPool().filter(w => matches(w, U.search) && Object.keys(FACETS).every(k => k === key || !U.filters[k].length || FACETS[k].of(w).some(v => U.filters[k].includes(lc(v)))));
  return facetValues(pool, key);
}

function filterArea() {
  const base = cellarPool();
  const allVals = {};
  Object.keys(FACETS).forEach(k => {
    allVals[k] = facetValues(base, k);
    U.filters[k] = U.filters[k].filter(v => allVals[k].some(x => x.key === v));
  });
  const active = [];
  Object.keys(FACETS).forEach(k => U.filters[k].forEach(v => active.push({ k, v, name: allVals[k].find(x => x.key === v).name })));
  const clear = active.length ? `<button class="chip" data-act="filter-clear">Clear all filters</button>` : '';
  if (!U.filterOpen) {
    return active.length
      ? `<div class="chips">${active.map(a => `<button class="chip on" data-act="filter-chip" data-k="${a.k}" data-v="${esc(a.v)}" aria-label="Remove filter ${esc(a.name)}">${esc(a.name)}${ICON.x}</button>`).join('')}${clear}</div>`
      : '';
  }
  const tabs = Object.keys(FACETS).filter(k => allVals[k].length);
  const done = S.wines.filter(w => w.count === 0).length;
  const finished = done ? `<label class="switch"><input type="checkbox" data-change="show-finished"${U.showFinished ? ' checked' : ''}>Include finished wines (${done})</label>` : '';
  if (!tabs.length) return `<div class="card filter-panel"><p class="muted small" style="margin:0">Add grapes, food pairings and locations to your wines to filter by them.</p>${finished}</div>`;
  if (!tabs.includes(U.filterTab)) U.filterTab = tabs[0];
  const k = U.filterTab;
  const tabBar = `<div class="ftabs" role="tablist">${tabs.map(t => `<button role="tab" aria-selected="${t === k}" class="ftab${t === k ? ' on' : ''}" data-act="filter-tab" data-v="${t}">${FACETS[t].label}${U.filters[t].length ? `<span class="count">${U.filters[t].length}</span>` : ''}</button>`).join('')}</div>`;
  const search = allVals[k].length > 12
    ? `<label class="search compact">${ICON.search}<input type="search" data-input="facetq" aria-label="Search ${FACETS[k].plural}" placeholder="Search ${FACETS[k].plural}" value="${esc(U.facetQ[k] || '')}"></label>` : '';
  return `<div class="card filter-panel">${tabBar}${search}<div id="facet-chips">${facetChipsHtml()}</div>${finished}${clear ? `<div>${clear}</div>` : ''}</div>`;
}

function facetChipsHtml() {
  const k = U.filterTab;
  const vals = facetCountsFor(k);
  const all = facetValues(cellarPool(), k);
  const sel = U.filters[k];
  const q = lc((U.facetQ[k] || '').trim());
  const selected = sel.map(v => vals.find(x => x.key === v) || all.find(x => x.key === v) || { key: v, name: v, n: 0 });
  let rest = vals.filter(x => !sel.includes(x.key) && x.n > 0);
  let more = '', boxed = false;
  if (q) rest = byName(rest.filter(x => lc(x.name).includes(q)));
  else if (U.filterAll[k] && rest.length > 12) { rest = byName(rest); boxed = true; }
  else if (rest.length > 12) { more = `<button class="chip" data-act="filter-more" data-k="${k}">Show all ${rest.length}</button>`; rest = rest.slice(0, 12); }
  const chip = (x, on) => `<button class="chip${on ? ' on' : ''}" data-act="filter-chip" data-k="${k}" data-v="${esc(x.key)}">${esc(x.name)}${on ? ICON.x : ` <span class="n">${x.n}</span>`}</button>`;
  const parts = [];
  if (selected.length) parts.push(`<div class="chips">${selected.map(x => chip(x, true)).join('')}</div>`);
  if (rest.length) parts.push(`<div class="chips${boxed ? ' scroll-box' : ''}">${rest.map(x => chip(x, false)).join('')}${more}</div>`);
  else if (q) parts.push('<p class="muted small" style="margin:0">No match.</p>');
  if (boxed) parts.push(`<div><button class="chip" data-act="filter-less" data-k="${k}">Show fewer</button></div>`);
  parts.push(`<p class="muted tiny" style="margin:0">${q || boxed ? 'A to Z.' : 'Most common first.'} Numbers count the wines that match together with your other filters.</p>`);
  return `<div style="display:flex;flex-direction:column;gap:8px">${parts.join('')}</div>`;
}

function matches(w, q) {
  if (!q) return true;
  const hay = [w.producer, w.name, w.vintage, w.region, w.grapes, w.type, w.location, w.retailer, w.giftFrom, w.pairings.join(' '), w.tasteTags.join(' ')].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every(part => hay.includes(part));
}

function wineRow(w) {
  return `<div class="wine-row${w.count === 0 ? ' finished' : ''}">
    <a class="row-link" href="#/wine/${encodeURIComponent(w.id)}">${thumbHtml(w)}<div class="row-text"><span class="row-title">${esc(wineTitle(w))}${w.acquired === 'Gift' ? GIFT_MARK : ''}${w.count === 0 ? FIN : ''}</span><span class="row-sub">${esc(wineSub(w))}</span>${w.count > 0 ? pill(w) : ''}</div></a>
    <div class="stepper"><button data-act="minus" data-id="${esc(w.id)}" aria-label="Remove one bottle">${ICON.minus}</button><span>${w.count}</span><button data-act="plus" data-id="${esc(w.id)}" aria-label="Add one bottle">${ICON.plus}</button></div>
  </div>`;
}

function cellarList() {
  const list = S.wines.filter(w => matches(w, U.search) && passesFilters(w))
    .sort((a, b) => wineTitle(a).localeCompare(wineTitle(b)) || str(a.vintage).localeCompare(str(b.vintage)));
  const stock = list.filter(w => w.count > 0), done = list.filter(w => w.count === 0);
  const filtered = U.search || activeFilterCount();
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
        ${g.items.map(w => `<a class="journal-row" href="#/wine/${encodeURIComponent(w.id)}" style="align-items:center">${thumbHtml(w, true)}<div class="row-text" style="gap:6px"><div class="between"><span class="row-title">${esc(wineTitle(w))} ${esc(w.vintage)}</span><span class="muted small" style="flex:none">${w.count} btl</span></div>${timelineHtml(w)}<span class="muted tiny">${esc(windowText(w) || 'No drinking window yet')}</span></div></a>`).join('')}
      </section>`).join('');
  return `<main class="screen has-nav"><header><h1 class="title">Drinking window</h1><p class="muted small" style="margin:2px 0 0">${bottles} bottles · ${items.length} wines · sorted by urgency</p></header>${body}</main>${nav('window')}`;
}

/* ------------------------------------------------------------ view: top rated */

function viewTop() {
  const types = TYPES.filter(t => S.wines.some(w => w.type === t));
  if (U.topType !== 'All' && !types.includes(U.topType)) U.topType = 'All';
  const anyDone = S.wines.some(w => w.count === 0);
  const pool = S.wines.filter(w => (U.topType === 'All' || w.type === U.topType) && (U.topFinished || w.count > 0));
  const typeWord = U.topType === 'All' ? 'wines' : U.topType.toLowerCase() + ' wines';
  const lead = `<h1 class="title">Top rated</h1>
    <div class="chips">${['All', ...types].map(t => chip(t, U.topType === t, 'top-type', t)).join('')}</div>
    <div class="toggle"><button class="${U.topMode === 'mine' ? 'on' : ''}" data-act="top-mode" data-v="mine">My rating</button><button class="${U.topMode === 'ext' ? 'on' : ''}" data-act="top-mode" data-v="ext">External</button></div>
    ${anyDone ? `<label class="switch"><input type="checkbox" data-change="top-finished"${U.topFinished ? ' checked' : ''}>Include finished wines</label>
      ${U.topFinished ? `<p class="muted tiny" style="margin:-14px 0 0;display:flex;align-items:center;gap:2px">${FIN}<span style="margin-left:4px">marks a finished wine with no bottles left</span></p>` : ''}` : ''}`;
  let body = '';
  if (U.topMode === 'mine') {
    const rated = pool.filter(w => w.myRating !== null).sort((a, b) => b.myRating - a.myRating);
    body = rated.length ? rated.map((w, i) => topRow(w, i, segsHtml(w.myRating), `<b>${w.myRating}%</b>`, w.ratings.map(r => `${r.sys} ${fmtScore(r.sys, r.score)}`).join(' · '))).join('')
      : `<div class="empty"><h2>No ratings yet</h2><p>Open a wine, tap Edit and drag the rating bar to rate it.</p></div>`;
  } else {
    const counts = {};
    pool.forEach(w => w.ratings.forEach(r => { counts[r.sys] = (counts[r.sys] || 0) + 1; }));
    const avail = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
    if (!avail.length) {
      body = `<div class="empty"><h2>No external ratings yet</h2><p>Add Vivino, Parker, Falstaff and other scores when you add or edit a wine.</p></div>`;
    } else {
      const sys = avail.includes(U.topSys) ? U.topSys : avail[0];
      const max = sysInfo(sys).max;
      const list = pool.map(w => ({ w, r: w.ratings.find(r => r.sys === sys) })).filter(x => x.r).sort((a, b) => b.r.score - a.r.score);
      body = `<div class="chips">${avail.map(k => `<button class="chip sq${k === sys ? ' on' : ''}" data-act="top-sys" data-v="${esc(k)}">${esc(k)} <span class="n">${counts[k]}</span></button>`).join('')}</div>
        <p class="muted tiny" style="margin:-6px 0 0">Only rating systems used in your ${typeWord} are shown. ${list.length} of ${pool.length} rated by ${esc(sys)}.</p>
        <div>${list.map((x, i) => topRow(x.w, i, max === 5 ? starsHtml(x.r.score) : '', `<b>${fmtScore(sys, x.r.score)}</b><span> /${max}</span>`, x.w.myRating !== null ? `My rating ${x.w.myRating}%` : 'Not rated by you')).join('')}</div>`;
    }
  }
  return `<main class="screen has-nav">${lead}<div>${body}</div></main>${nav('top')}`;
}

function topRow(w, i, visual, score, sub) {
  return `<a class="journal-row${w.count === 0 ? ' finished' : ''}" href="#/wine/${encodeURIComponent(w.id)}" style="align-items:center"><span class="rank">${i + 1}</span>${thumbHtml(w, true)}
    <div class="row-text" style="gap:5px"><span class="row-title">${esc(wineTitle(w))} ${esc(w.vintage)}${w.count === 0 ? FIN : ''}</span>${visual}${sub ? `<span class="muted tiny ellipsis">${esc(sub)}</span>` : ''}</div>
    <div class="score">${score}</div></a>`;
}

/* ------------------------------------------------------------ view: journal */

function peopleLine(r) {
  const names = namesOf(r.people);
  if (!names.length) return '';
  const hearts = namesOf(r.hearts).map(lc);
  return (r.type === 'Gift' ? 'Given to ' : r.type === 'Received' ? 'From ' : 'With ') + names.map(n => esc(n) + (hearts.includes(lc(n)) ? `<span class="heart-on" aria-label="favorite wine">${HEART_SM}</span>` : '')).join(', ');
}

function receivedEntries() {
  return S.wines.filter(w => w.acquired === 'Gift').map(w => ({
    id: 'g-' + w.id, wineId: w.id, date: str(w.purchaseDate || w.createdAt).slice(0, 10), type: 'Received',
    people: w.giftFrom, hearts: '', occasion: '', food: '', note: '', received: true
  }));
}

function journalEntries() {
  const q = lc(U.jSearch.trim());
  return S.removals.concat(receivedEntries()).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).filter(r => {
    const ppl = namesOf(r.people).map(lc), hearts = namesOf(r.hearts).map(lc);
    if (U.jPerson && !ppl.includes(U.jPerson)) return false;
    if (U.jFav && !(U.jPerson ? hearts.includes(U.jPerson) : hearts.length)) return false;
    if (!q) return true;
    const w = wineById(r.wineId);
    const hay = lc([r.people, r.occasion, r.food, r.note, r.type, r.type === 'Gift' || r.type === 'Received' ? 'gift' : '', w ? fullName(w) : r.wineName].join(' '));
    return q.split(/\s+/).every(p => hay.includes(p));
  });
}

function journalList() {
  const list = journalEntries();
  if (!list.length) return '<p class="muted small">No entries match.</p>';
  let html = '', month = '';
  list.forEach(r => {
    const d = parseISO(r.date);
    const m = d ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Undated';
    if (m !== month) { html += `<h2 class="month">${m}</h2>`; month = m; }
    const w = wineById(r.wineId);
    const name = w ? `${wineTitle(w)} ${w.vintage}` : (r.wineName || 'Deleted wine');
    const ppl = peopleLine(r);
    const inner = `<span class="day"><b>${d ? d.getDate() : ''}</b><span>${d ? d.toLocaleDateString('en-US', { weekday: 'short' }) : ''}</span></span>
      <span class="row-text" style="gap:3px"><span class="between"><span class="row-title">${esc(name)}</span>${typeBadge(r.type)}</span>
      ${r.occasion ? `<span class="small">${esc(r.occasion)}</span>` : ''}${ppl ? `<span class="small muted">${ppl}</span>` : ''}${r.food ? `<span class="tiny" style="color:var(--food)">${esc(r.food)}</span>` : ''}${r.note ? `<span class="small muted ellipsis">${esc(r.note)}</span>` : ''}</span>`;
    html += r.received
      ? `<a class="journal-row as-btn" href="#/wine/${encodeURIComponent(r.wineId)}">${inner}</a>`
      : `<button class="journal-row as-btn" data-act="edit-removal" data-id="${esc(r.id)}" aria-label="Edit entry ${esc(name)}">${inner}</button>`;
  });
  return html;
}

function personSummary(p) {
  const all = S.removals.concat(receivedEntries()).filter(r => namesOf(r.people).map(lc).includes(p));
  const person = knownPeople().find(x => lc(x.name) === p);
  const name = person ? person.name : p;
  const given = all.filter(r => r.type === 'Gift').length;
  const received = all.filter(r => r.type === 'Received').length;
  const shared = all.length - given - received;
  const stats = [shared ? `${shared} shared` : '', given ? `${given} given as ${given === 1 ? 'gift' : 'gifts'}` : '', received ? `${received} received as ${received === 1 ? 'gift' : 'gifts'}` : ''].filter(Boolean).join(' · ');
  const favIds = [...new Set(all.filter(r => namesOf(r.hearts).map(lc).includes(p)).map(r => r.wineId))];
  const favs = favIds.map(id => wineById(id)).filter(Boolean);
  const fromThem = S.wines.filter(w => w.acquired === 'Gift' && namesOf(w.giftFrom).map(lc).includes(p));
  return `<div class="card" style="display:flex;flex-direction:column;gap:8px">
    <div class="between"><h2 style="font-size:17px;font-weight:600">${esc(name)}</h2><button class="icon-btn" data-act="j-person" data-v="${esc(p)}" aria-label="Show everyone">${ICON.x}</button></div>
    <p class="muted small" style="margin:-8px 0 0">${stats}</p>
    ${favs.length ? `<span class="tiny muted">Favorite wines</span><div class="tags">${favs.map(w => `<a class="tag fav" href="#/wine/${encodeURIComponent(w.id)}">${HEART_SM}${esc(wineTitle(w))} ${esc(w.vintage)}</a>`).join('')}</div>` : ''}
    ${fromThem.length ? `<span class="tiny muted">Gifts from ${esc(name)}</span><div class="tags">${fromThem.map(w => `<a class="tag gifted" href="#/wine/${encodeURIComponent(w.id)}">${ICON.gift}${esc(wineTitle(w))} ${esc(w.vintage)}</a>`).join('')}</div>` : ''}
  </div>`;
}

function jPeopleHtml() {
  const people = knownPeople();
  if (!people.length) return '';
  const q = lc(U.jSearch.trim());
  let list, title, more = '';
  if (q) { list = byName(people.filter(p => lc(p.name).includes(q))); title = 'Matching people'; }
  else if (U.jAllPeople) { list = byName(people); title = `All people, A to Z (${people.length})`; }
  else {
    list = people.slice(0, 8);
    title = 'Frequent and recent';
    if (people.length > 8) more = `<button class="chip" data-act="j-more">All people (${people.length})</button>`;
  }
  if (U.jPerson && !list.some(p => lc(p.name) === U.jPerson)) {
    const sel = people.find(p => lc(p.name) === U.jPerson);
    if (sel) list = [sel].concat(list);
  }
  if (!list.length) return '';
  const chips = list.map(p => `<button class="chip${U.jPerson === lc(p.name) ? ' on' : ''}" data-act="j-person" data-v="${esc(lc(p.name))}">${esc(p.name)} <span class="n">${p.n}</span></button>`).join('');
  const box = U.jAllPeople && !q
    ? `<div class="chips scroll-box">${chips}</div><div><button class="chip" data-act="j-less">Show fewer</button></div>`
    : `<div class="chips">${chips}${more}</div>`;
  return `<div class="facet"><span class="facet-title">People · ${title}</span>${box}</div>`;
}

function viewJournal() {
  if (!S.removals.length && !receivedEntries().length) {
    return `<main class="screen has-nav"><h1 class="title">Journal</h1><div class="empty"><h2>No entries yet</h2><p>Bottles you take out and wines you receive as gifts show up here.</p></div></main>${nav('journal')}`;
  }
  if (U.jPerson && !knownPeople().some(p => lc(p.name) === U.jPerson)) U.jPerson = null;
  const anyHeart = S.removals.some(r => namesOf(r.hearts).length);
  return `<main class="screen has-nav"><h1 class="title">Journal</h1>
    <label class="search">${ICON.search}<input type="search" data-input="jsearch" aria-label="Search the journal" placeholder="Person, wine, occasion or food" value="${esc(U.jSearch)}"></label>
    <div id="j-people">${jPeopleHtml()}</div>
    ${anyHeart ? `<label class="switch"><input type="checkbox" data-change="j-fav"${U.jFav ? ' checked' : ''}>Only favorite wines<span class="heart-on">${HEART_SM}</span></label>` : ''}
    ${U.jPerson ? personSummary(U.jPerson) : ''}
    <div id="journal-list">${journalList()}</div></main>${nav('journal')}`;
}

/* ------------------------------------------------------------ view: wine detail */

function viewWine(id) {
  const w = wineById(id);
  if (!w) return `<main class="screen"><a class="back" href="#/cellar">${ICON.back}Cellar</a><div class="empty"><h2>Wine not found</h2><p>It may have been deleted on another device.</p></div></main>`;
  const p = windowParts(w);
  const s = statusOf(w);
  const hist = S.removals.filter(r => r.wineId === w.id).sort((a, b) => b.date.localeCompare(a.date));
  const usedSys = w.ratings.map(r => r.sys);
  const freeSys = SYSTEMS.filter(x => !usedSys.includes(x.key));
  const editHref = '#/edit/' + encodeURIComponent(w.id);
  const label = w.thumb || w.labelFileId
    ? `<img id="label-img" class="label-photo"${w.thumb ? ` src="${esc(w.thumb)}"` : ''} alt="Label of ${esc(fullName(w))}">`
    : `<div class="label-ph">${esc(wineTitle(w))}<small>${esc(w.vintage || '')}</small></div>`;
  const where = [w.shelf !== null ? `Shelf ${w.shelf}` : '', w.position].filter(Boolean).join(' · ');
  const meta = [w.name ? w.producer : '', w.region, w.vintage, w.type].filter(Boolean).join(' · ');
  return `<main class="screen">
    <div class="detail-top"><a class="back" href="#/cellar">${ICON.back}Cellar</a><a class="btn" style="height:40px" href="${editHref}">Edit</a></div>
    ${label}
    <div><h1 class="title" style="font-size:28px">${esc(wineTitle(w))}${w.acquired === 'Gift' ? GIFT_MARK : ''}${w.count === 0 ? FIN : ''}</h1><p class="meta">${esc(meta)}</p></div>
    <div class="grid2">
      <div class="card"><span class="tiny muted">In stock</span><div class="between" style="margin-top:6px">
        <button class="btn" style="width:42px;padding:0" data-act="minus" data-id="${esc(w.id)}" aria-label="Remove one bottle">${ICON.minus}</button>
        <span style="font-size:26px;font-weight:600">${w.count}</span>
        <button class="btn" style="width:42px;padding:0" data-act="plus" data-id="${esc(w.id)}" aria-label="Add one bottle">${ICON.plus}</button></div></div>
      <div class="card"><span class="tiny muted">Location</span><p style="margin:8px 0 0;font-size:17px;font-weight:600">${esc(w.location || 'Not set')}</p>${where ? `<p class="muted small" style="margin:2px 0 0">${esc(where)}</p>` : ''}</div>
    </div>
    <section>
      <div class="rating-head"><h2>My rating</h2>${w.myRating === null ? `<a class="small" href="${editHref}">Rate in Edit</a>` : `<span class="rating-val">${w.myRating}%</span>`}</div>
      ${w.myRating === null ? '' : segsHtml(w.myRating, 22, 'lg')}
    </section>
    <section>
      <div class="sec-head"><h2>Drinking window</h2>${p ? `<span class="small" style="color:${STATUS[s].c};font-weight:500">${statusLine(w)}</span>` : ''}</div>
      ${p ? `${timelineHtml(w, true)}<div class="scale" style="margin-top:4px"><span>${p.f}</span><span style="color:var(--text)">Today</span><span>${p.u}</span></div><p class="muted tiny" style="margin:0">${windowText(w)}</p>`
        : `<p class="muted small" style="margin:0">No drinking window set yet. <a href="${editHref}">Add one</a></p>`}
    </section>
    <section>
      <h2>External ratings</h2>
      <div class="tags">${w.ratings.map((r, i) => `<span class="ext">${esc(r.sys)} <b>${fmtScore(r.sys, r.score)}</b><button data-act="rm-rating" data-i="${i}" aria-label="Remove ${esc(r.sys)} rating">${ICON.x}</button></span>`).join('')}
        ${freeSys.length && !U.addRatingOpen ? `<button class="btn dashed" style="height:34px;font-size:13px" data-act="open-add-rating">Add rating</button>` : ''}</div>
      ${U.addRatingOpen ? `<div class="rating-row"><label class="field"><span class="sr-only">Rating system</span><select id="new-sys">${freeSys.map(x => `<option value="${esc(x.key)}">${esc(x.key)} (of ${x.max})</option>`).join('')}</select></label>
        <label class="field"><span class="sr-only">Score</span><input id="new-score" inputmode="decimal" placeholder="Score"></label><button class="rm" data-act="close-add-rating" aria-label="Cancel">${ICON.x}</button></div>
        <button class="btn accent" data-act="save-rating">Save rating</button>` : ''}
    </section>
    ${purchaseHtml(w)}
    <section style="gap:14px">
      <h2>Profile</h2>
      ${w.grapes ? `<div class="kv"><span>Grapes</span><p>${esc(w.grapes)}</p></div>` : ''}
      ${w.taste ? `<div class="kv"><span>Taste</span><p style="line-height:1.5">${esc(w.taste)}</p></div>` : ''}
      ${w.tasteTags.length ? `<div class="tags">${w.tasteTags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      ${w.pairings.length ? `<div class="kv"><span>Pairs with</span><div class="tags" style="margin-top:6px">${w.pairings.map(t => `<span class="food">${esc(t)}</span>`).join('')}</div></div>` : ''}
      ${!w.grapes && !w.taste && !w.pairings.length ? `<p class="muted small" style="margin:0">No profile yet. <a href="${editHref}">Edit</a> to add grapes, taste and food pairings.</p>` : ''}
    </section>
    <section style="gap:0">
      <h2 style="margin-bottom:4px">Bottles removed</h2>
      ${hist.length ? hist.map(r => {
        const ppl = peopleLine(r);
        return `<button class="hist as-btn" data-act="edit-removal" data-id="${esc(r.id)}" aria-label="Edit entry from ${esc(fmtDate(r.date))}"><span class="hist-head"><span class="tiny muted">${esc(fmtDate(r.date))}</span>${typeBadge(r.type)}</span>
        ${r.occasion ? `<span style="font-size:14px;font-weight:600">${esc(r.occasion)}</span>` : ''}${ppl ? `<span class="small muted">${ppl}</span>` : ''}${r.food ? `<span class="small" style="color:var(--food)">${esc(r.food)}</span>` : ''}${r.note ? `<span class="small">${esc(r.note)}</span>` : ''}</button>`;
      }).join('') + '<p class="muted tiny" style="margin:8px 0 0">Tap an entry to edit it.</p>'
        : '<p class="muted small" style="margin:0">No bottles removed yet.</p>'}
    </section>
  </main>`;
}

function purchaseHtml(w) {
  const gift = w.acquired === 'Gift';
  const editLink = `<a href="#/edit/${encodeURIComponent(w.id)}">Add them</a>`;
  if (!gift && !w.retailer && !w.purchaseDate && w.purchasePrice === null && w.streetPrice === null) {
    return `<section><h2>Purchase</h2><p class="muted small" style="margin:0">No purchase details yet. ${editLink}</p></section>`;
  }
  let diff = '';
  if (!gift && w.purchasePrice !== null && w.streetPrice !== null && w.purchasePrice > 0) {
    const pct = Math.round((w.streetPrice - w.purchasePrice) / w.purchasePrice * 100);
    diff = `<span class="small" style="color:${pct >= 0 ? '#5CC489' : '#EC7A69'}">${pct >= 0 ? '+' : ''}${pct}% vs. purchase</span>`;
  }
  const cell = (label, value) => `<div class="kv"><span>${label}</span><p style="font-weight:600">${value}</p></div>`;
  const date = w.purchaseDate ? esc(fmtDate(w.purchaseDate)) : 'Not set';
  return `<section><h2 style="display:flex;align-items:center;gap:6px">${gift ? `<span class="gift-mark" style="margin:0">${ICON.gift}</span>Gift received` : 'Purchase'}</h2><div class="card form-grid" style="gap:14px">
    ${gift ? cell('From', esc(namesOf(w.giftFrom).join(', ') || 'Not set')) : cell('Retailer', esc(w.retailer || 'Not set'))}
    ${cell(gift ? 'Received on' : 'Purchase date', date)}
    ${cell('Purchase price', gift ? `${money(0)} <span class="muted small" style="font-weight:400">gift</span>` : (w.purchasePrice !== null ? money(w.purchasePrice) : 'Not set'))}
    <div class="kv"><span>Street price</span><p style="font-weight:600">${w.streetPrice !== null ? money(w.streetPrice) : 'Not set'}</p>${diff}</div>
    ${w.streetPrice !== null && w.count > 0 ? `<p class="muted tiny full" style="margin:0">Value in stock at street price: ${money(w.streetPrice * w.count)}</p>` : ''}
  </div></section>`;
}

function acquisitionBox() {
  const f = D.fields, gift = D.acquired === 'Gift';
  const retailers = [...new Set(S.wines.map(w => w.retailer).filter(Boolean))].sort();
  return `<div class="box"><span class="box-title">Acquired</span>
    <div class="toggle"><button class="${gift ? '' : 'on'}" data-act="acq" data-v="Purchased">Purchased</button><button class="${gift ? 'on' : ''}" data-act="acq" data-v="Gift">${ICON.gift}Gift received</button></div>
    ${gift
      ? `<div class="field"><span>Gift from</span><div id="people-chips" class="chips">${peopleChipsHtml()}</div>
        <input id="people-input" data-input="people" aria-label="Gift from" placeholder="Type a name" autocomplete="off" autocapitalize="words" enterkeyhint="done" value="${esc(D.gift.typing)}">
        <div id="people-sugg">${peopleSuggHtml()}</div></div>`
      : `<label class="field">Retailer<input name="retailer" data-input="field" list="retailers" placeholder="Wine shop, winery or online store" value="${esc(f.retailer)}"></label>
        <datalist id="retailers">${retailers.map(r => `<option value="${esc(r)}"></option>`).join('')}</datalist>`}
    <div class="form-grid">
      <label class="field full">${gift ? 'Received on' : 'Purchase date'}<input type="date" name="purchaseDate" data-input="field" value="${esc(f.purchaseDate)}"></label>
      ${gift
        ? `<div class="field">Purchase price<div class="static">${money(0)}, gift</div></div>`
        : `<label class="field">Purchase price (${CURRENCY})<input name="purchasePrice" data-input="field" inputmode="decimal" placeholder="45.00" value="${esc(f.purchasePrice)}"></label>`}
      <label class="field">Street price (${CURRENCY})<input name="streetPrice" data-input="field" inputmode="decimal" placeholder="52.00" value="${esc(f.streetPrice)}"></label>
    </div>
  </div>`;
}

const fmtDate = s => { const d = parseISO(s); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : s; };

/* ------------------------------------------------------------ my rating (edit form only) */

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

/* ------------------------------------------------------------ removal sheet and journal entries */

function openRemoveSheet(id) {
  const w = wineById(id);
  if (!w || w.count < 1) return;
  RS = { mode: 'add', wineId: id, type: 'Dinner', occasion: '', people: [], food: '', note: '', date: todayISO(), typing: '', showAll: false, hearts: true };
  renderSheet();
}

function openEditRemoval(id) {
  const r = S.removals.find(x => x.id === id);
  if (!r) return;
  const hearts = namesOf(r.hearts).map(lc);
  RS = {
    mode: 'edit', id: r.id, wineId: r.wineId, type: REMOVAL_TYPES.includes(r.type) ? r.type : 'Other',
    occasion: r.occasion, people: namesOf(r.people).map(n => ({ name: n, heart: hearts.includes(lc(n)) })),
    food: r.food, note: r.note, date: r.date || todayISO(), typing: '', showAll: false, hearts: true
  };
  renderSheet();
}

function renderSheet() {
  const root = $('#sheet-root');
  if (!RS) { root.innerHTML = ''; return; }
  const w = wineById(RS.wineId);
  const r = RS.mode === 'edit' ? S.removals.find(x => x.id === RS.id) : null;
  const gift = RS.type === 'Gift';
  const name = w ? `${wineTitle(w)} ${w.vintage}`.trim() : ((r && r.wineName) || 'Deleted wine');
  const cur = route();
  const link = RS.mode === 'edit' && w && !(cur.p === 'wine' && cur.id === w.id) ? ` · <a href="#/wine/${encodeURIComponent(w.id)}">View wine</a>` : '';
  const sub = RS.mode === 'edit' ? esc(name) + link : `${esc(name)} · ${w.count - 1} left`;
  root.innerHTML = `<div class="sheet-backdrop" data-act="sheet-close"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="grab"></div>
    <div style="display:flex;gap:12px;align-items:center">${w ? thumbHtml(w) : ''}<div style="flex:1;min-width:0"><h2 id="sheet-title" style="font-size:18px;font-weight:600">${RS.mode === 'edit' ? 'Edit entry' : 'Bottle removed'}</h2><p class="muted small ellipsis" style="margin:2px 0 0">${sub}</p></div><button class="icon-btn" data-act="sheet-close" aria-label="Close">${ICON.x}</button></div>
    ${RS.mode === 'edit' ? `<label class="field">Date<input type="date" name="date" data-input="rs" value="${esc(RS.date)}"></label>` : ''}
    <div style="display:flex;flex-direction:column;gap:8px"><span class="small muted">Type</span><div class="grid2" style="gap:8px">${REMOVAL_TYPES.map(t => `<button class="btn${t === RS.type ? ' primary' : ''}" style="height:44px;font-size:14px" data-act="rs-type" data-v="${t}">${t}</button>`).join('')}</div></div>
    <label class="field">Occasion<input name="occasion" data-input="rs" placeholder="${esc(OCCASION_HINTS[RS.type])}" value="${esc(RS.occasion)}"></label>
    <div class="field"><span>${gift ? 'Given to' : 'Shared with'}</span>
      <div id="people-chips" class="chips">${peopleChipsHtml()}</div>
      <input id="people-input" data-input="people" aria-label="${gift ? 'Given to' : 'Shared with'}" placeholder="Type a name" autocomplete="off" autocapitalize="words" enterkeyhint="done" value="${esc(RS.typing)}">
      <div id="people-sugg">${peopleSuggHtml()}</div>
    </div>
    ${gift ? '' : `<label class="field">Food<input name="food" data-input="rs" placeholder="Duck breast with cherry sauce" value="${esc(RS.food)}"></label>`}
    <label class="field">Note<textarea name="note" data-input="rs" rows="3" placeholder="Decanted, how it showed, anything to remember">${esc(RS.note)}</textarea></label>
    ${RS.mode === 'edit'
      ? `<div class="grid2"><button class="btn danger" data-act="rs-delete">Delete entry</button><button class="btn primary" data-act="rs-save">Save</button></div>`
      : `<div class="grid2"><button class="btn" data-act="rs-skip">Skip</button><button class="btn primary" data-act="rs-save">Save</button></div>`}
  </div>`;
}

const PK = () => RS || (D && D.gift) || null;

function peopleChipsHtml() {
  const P = PK();
  if (!P || !P.people.length) return '';
  return P.people.map((p, i) => `<span class="person${P.hearts ? '' : ' plain'}">${P.hearts ? `<button class="heart${p.heart ? ' on' : ''}" data-act="p-heart" data-i="${i}" aria-pressed="${p.heart}" aria-label="Favorite wine of ${esc(p.name)}">${p.heart ? HEART_ON : ICON.heart}</button>` : ''}${esc(p.name)}<button class="x" data-act="p-rm" data-i="${i}" aria-label="Remove ${esc(p.name)}">${ICON.x}</button></span>`).join('')
    + (P.hearts ? '<p class="tiny muted" style="flex-basis:100%;margin:0">Tap the heart if it is their favorite wine.</p>' : '');
}

function peopleSuggHtml() {
  const P = PK();
  if (!P) return '';
  const t = lc(P.typing.trim());
  const chosen = P.people.map(p => lc(p.name));
  const known = knownPeople().filter(p => !chosen.includes(lc(p.name)));
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
  const more = !t && !P.showAll && known.length > 6 ? `<button class="chip" data-act="p-all">All people (${known.length})</button>` : '';
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
    const known = knownPeople().find(p => lc(p.name) === lc(clean));
    P.people.push({ name: known ? known.name : clean, heart: false });
  }
  updatePeople();
}

function closeSheet() { RS = null; renderSheet(); }

const removalFields = st => ({
  type: st.type,
  occasion: st.occasion.trim(),
  people: st.people.map(p => p.name).join(', '),
  hearts: st.people.filter(p => p.heart).map(p => p.name).join(', '),
  food: st.type === 'Gift' ? '' : st.food.trim(),
  note: st.note.trim()
});

async function saveRemoval(withDetails) {
  if (RS.typing.trim()) addPerson(RS.typing);
  const st = RS;
  const w = wineById(st.wineId);
  closeSheet();
  if (!w || w.count < 1) return;
  if (!withDetails) { adjustCount(w.id, -1); return; }
  const removal = Object.assign({ id: newId('r'), wineId: w.id, date: todayISO(), wineName: fullName(w) }, removalFields(st));
  w.count -= 1;
  S.removals.push(removal);
  persist();
  refreshView();
  try {
    const d = await api('removeBottle', { removal });
    upsertWine(normWine(d.wine));
    persist();
    refreshView();
  } catch (e) {
    w.count += 1;
    S.removals = S.removals.filter(r => r.id !== removal.id);
    persist();
    refreshView();
    toast('Not saved: ' + e.message);
  }
}

async function saveRemovalEdit() {
  if (RS.typing.trim()) addPerson(RS.typing);
  const st = RS;
  const r = S.removals.find(x => x.id === st.id);
  closeSheet();
  if (!r) return;
  const fields = Object.assign({ date: st.date || r.date }, removalFields(st));
  const prev = Object.assign({}, r);
  Object.assign(r, fields);
  persist();
  refreshView();
  try {
    Object.assign(r, normRemoval(await api('updateRemoval', { id: r.id, fields })));
    persist();
    refreshView();
  } catch (e) {
    Object.assign(r, prev);
    persist();
    refreshView();
    toast('Not saved: ' + e.message);
  }
}

async function deleteRemoval() {
  const id = RS.id;
  if (!confirm('Delete this entry? The bottle count stays the same.')) return;
  closeSheet();
  const prev = S.removals.slice();
  S.removals = S.removals.filter(r => r.id !== id);
  persist();
  refreshView();
  try { await api('deleteRemoval', { id }); }
  catch (e) { S.removals = prev; persist(); refreshView(); toast('Not deleted: ' + e.message); }
}

async function adjustCount(id, delta) {
  const w = wineById(id);
  if (!w) return;
  const prev = w.count;
  w.count = Math.max(0, w.count + delta);
  persist();
  refreshView();
  try { upsertWine(normWine(await api('adjust', { id, delta }))); persist(); }
  catch (e) { w.count = prev; persist(); refreshView(); toast('Not saved: ' + e.message); }
}

function refreshView() {
  if (isFormRoute()) return;
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
  const src = w || normWine({ id: '', type: 'Red', count: 1 });
  return {
    mode, id: w ? w.id : null,
    step: mode === 'add' ? 'photo' : 'form',
    fields: {
      producer: src.producer, name: src.name, vintage: src.vintage, type: src.type, region: src.region, grapes: src.grapes,
      taste: src.taste, tasteTags: src.tasteTags.join(', '), pairings: src.pairings.join(', '),
      drinkFrom: str(src.drinkFrom), drinkUntil: str(src.drinkUntil), peakFrom: str(src.peakFrom), peakUntil: str(src.peakUntil),
      location: src.location || (mode === 'add' ? defaultLocation() : ''), shelf: src.shelf !== null ? src.shelf : '', position: src.position,
      retailer: src.retailer, purchaseDate: src.purchaseDate || (mode === 'add' ? todayISO() : ''),
      purchasePrice: src.purchasePrice !== null ? src.purchasePrice.toFixed(2) : '', streetPrice: src.streetPrice !== null ? src.streetPrice.toFixed(2) : ''
    },
    count: mode === 'add' ? 1 : src.count,
    myRating: src.myRating,
    acquired: src.acquired,
    gift: { people: namesOf(src.giftFrom).map(n => ({ name: n, heart: false })), typing: '', showAll: false, hearts: false },
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

function formBody() {
  const f = D.fields;
  const field = (label, key, opts = {}) => `<label class="field${opts.full ? ' full' : ''}">${label}<input name="${key}" data-input="field" value="${esc(f[key])}"${opts.num ? ' inputmode="numeric"' : ''}${opts.ph ? ` placeholder="${esc(opts.ph)}"` : ''}></label>`;
  const banner = '<div id="ai-banner" hidden></div>';
  const locs = S.locations.slice();
  if (f.location && !locs.includes(f.location)) locs.push(f.location);
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
      ${field('Pairs with', 'pairings', { full: true, ph: 'Braised beef, game, aged Parmesan' })}
      ${field('Drink from', 'drinkFrom', { num: true })}
      ${field('Drink until', 'drinkUntil', { num: true })}
      ${field('Peak from', 'peakFrom', { num: true })}
      ${field('Peak until', 'peakUntil', { num: true })}
      <label class="field full">Taste<textarea name="taste" data-input="field" rows="3">${esc(f.taste)}</textarea></label>
      ${field('Taste tags', 'tasteTags', { full: true, ph: 'elegant, medium body, fresh acidity' })}
    </div>
    <button class="btn accent block" data-act="ai-refresh">${ICON.spark}Update details with AI</button>
    <p class="muted tiny" style="margin:-10px 0 0">Uses what you entered, for example the vintage, and fills in the rest. Fields you changed here stay as they are.</p>
    <div class="box"><span class="box-title">Storage</span>
      <label class="field">Location<select name="location" data-change="location">${f.location ? '' : '<option value="" selected disabled>Choose a location</option>'}${locs.map(l => `<option${l === f.location ? ' selected' : ''}>${esc(l)}</option>`).join('')}<option value="__new">Add new location…</option></select></label>
      <div class="store-row">
        <div class="field">Shelf (optional)<div class="stepper"><button data-act="shelf" data-d="-1" aria-label="Shelf down">${ICON.minus}</button><span id="shelf-val" style="min-width:48px">${esc(str(f.shelf) === '' ? 'None' : f.shelf)}</span><button data-act="shelf" data-d="1" aria-label="Shelf up">${ICON.plus}</button></div></div>
        ${field('Position', 'position', { ph: 'Back row, left' })}
      </div>
    </div>
    <div class="box"><div class="rating-head"><span class="box-title">My rating</span><span class="rating-val${D.myRating === null ? ' none' : ''}" id="rating-val">${D.myRating === null ? 'Not rated' : D.myRating + '%'}</span></div>
      <div class="rating-bar" id="rating-bar">${segsHtml(D.myRating, 30, 'lg')}</div>
      <div class="scale"><span>0</span><span>50</span><span>100</span></div>
      <div class="rating-ctl"><button data-act="rate" data-d="-1" aria-label="Minus 1 percent">${ICON.minus}</button><span>Drag the bar, fine-tune with minus and plus</span><button data-act="rate" data-d="1" aria-label="Plus 1 percent">${ICON.plus}</button></div>
      <button class="btn ghost" style="height:36px;align-self:center;font-size:13px" data-act="rate-clear">Clear rating</button>
    </div>
    ${acquisitionBox()}
    <div class="box"><span class="box-title">External ratings</span>
      ${D.ratings.map((r, i) => `<div class="rating-row"><label class="field"><span class="sr-only">Rating system</span><select data-change="rsys" data-i="${i}">${SYSTEMS.map(x => `<option value="${esc(x.key)}"${x.key === r.sys ? ' selected' : ''}>${esc(x.key)} (of ${x.max})</option>`).join('')}</select></label>
        <label class="field"><span class="sr-only">Score</span><input data-input="rscore" data-i="${i}" inputmode="decimal" placeholder="Score" value="${esc(r.score)}"></label>
        <button class="rm" data-act="rrm" data-i="${i}" aria-label="Remove rating">${ICON.x}</button></div>`).join('')}
      <button class="btn dashed" data-act="radd">Add rating</button>
    </div>
    <div class="between"><span>Bottles in stock</span><div class="stepper"><button data-act="bottles" data-d="-1" aria-label="Fewer">${ICON.minus}</button><span id="bottles-val">${D.count}</span><button data-act="bottles" data-d="1" aria-label="More">${ICON.plus}</button></div></div>
    <button class="btn primary big block" data-act="save-wine">Save wine</button>
    ${D.mode === 'edit' ? `<button class="btn danger block" data-act="delete-wine">Delete wine</button>` : ''}`;
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
    if (D === draft) { const el = document.querySelector(`[name="${key}"]`); if (el) el.value = v; }
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

async function saveWineForm() {
  const f = D.fields;
  if (!f.name.trim() && !f.producer.trim()) { toast('Enter at least a producer or a wine name.'); return; }
  if (!str(f.location).trim()) { toast('Choose a location. New ones can be added in the list.'); const l = $('[name=location]'); if (l) l.focus(); return; }
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
  for (const k of ['purchasePrice', 'streetPrice']) {
    if (!(k === 'purchasePrice' && D.acquired === 'Gift') && str(f[k]).trim() && parseMoney(f[k]) === null) { toast('Prices need a number, for example 45.50.'); return; }
  }
  if (D.acquired === 'Gift' && D.gift.typing.trim()) addPerson(D.gift.typing);
  const base = D.mode === 'edit' ? wineById(D.id) : null;
  const w = normWine(Object.assign({}, base || {}, {
    id: base ? base.id : newId('w'),
    producer: f.producer.trim(), name: f.name.trim(), vintage: str(f.vintage).trim(), type: f.type,
    region: f.region.trim(), grapes: f.grapes.trim(), taste: f.taste.trim(),
    tasteTags: splitList(f.tasteTags), pairings: splitList(f.pairings),
    drinkFrom: f.drinkFrom, drinkUntil: f.drinkUntil, peakFrom: f.peakFrom, peakUntil: f.peakUntil,
    location: f.location, shelf: f.shelf, position: f.position.trim(),
    acquired: D.acquired, giftFrom: D.acquired === 'Gift' ? D.gift.people.map(p => p.name).join(', ') : '',
    retailer: D.acquired === 'Gift' ? '' : str(f.retailer).trim(), purchaseDate: f.purchaseDate,
    purchasePrice: D.acquired === 'Gift' ? 0 : parseMoney(f.purchasePrice), streetPrice: parseMoney(f.streetPrice),
    count: D.count,
    ratings: D.ratings.filter(r => str(r.score).trim() !== '').map(r => ({ sys: r.sys, score: Number(String(r.score).replace(',', '.')) })),
    thumb: D.thumb || (base ? base.thumb : ''),
    myRating: D.myRating
  }));
  if (f.location) store.set('wc-lastloc', f.location);
  busy(true, 'Saving…');
  try {
    const saved = normWine(await api('saveWine', { wine: serialWine(w), image: D.imageB64 || null }));
    if (D.imageB64 && saved.labelFileId) cacheLabel(saved.labelFileId, D.imageB64);
    upsertWine(saved);
    persist();
    D = null;
    busy(false);
    go('#/wine/' + encodeURIComponent(saved.id), true);
  } catch (e) {
    busy(false);
    toast('Not saved: ' + e.message);
  }
}

/* ------------------------------------------------------------ settings */

function locationsHtml() {
  const used = {};
  S.wines.forEach(w => { if (w.location && w.count > 0) used[lc(w.location)] = (used[lc(w.location)] || 0) + w.count; });
  const small = 'height:36px;padding:0 12px;font-size:13px';
  const rows = S.locations.map(l => {
    const n = used[lc(l)] || 0;
    const others = S.locations.filter(x => x !== l);
    const head = `<div class="between"><span>${esc(l)} <span class="muted small">${n ? `${n} ${n === 1 ? 'bottle' : 'bottles'}` : 'empty'}</span></span>${n
      ? `<span style="display:flex;gap:6px"><button class="btn" style="${small}" data-act="loc-show" data-v="${esc(l)}">Show</button><button class="btn" style="${small}" data-act="loc-move-open" data-v="${esc(l)}">Move</button></span>`
      : `<button class="icon-btn" data-act="loc-del" data-v="${esc(l)}" aria-label="Delete ${esc(l)}">${ICON.trash}</button>`}</div>`;
    const move = U.locMove === l ? (others.length
      ? `<div class="move-box"><span class="tiny muted">Move all wines from ${esc(l)} to</span><div style="display:flex;gap:8px"><label class="field" style="flex:1"><span class="sr-only">Target location</span><select id="move-to">${others.map(o => `<option>${esc(o)}</option>`).join('')}</select></label><button class="btn accent" data-act="loc-move" data-v="${esc(l)}">Move</button><button class="icon-btn" data-act="loc-move-cancel" aria-label="Cancel">${ICON.x}</button></div></div>`
      : `<div class="move-box"><span class="small muted">Add another location first, then move the wines there.</span></div>`) : '';
    return `<div class="loc-row">${head}${move}</div>`;
  }).join('');
  return `<section class="box"><span class="box-title">Locations</span>
    ${rows || '<p class="muted small" style="margin:0">No locations yet. Add where you keep your wine, for example Wine fridge, Basement or Kitchen.</p>'}
    <div style="display:flex;gap:8px;align-items:flex-end"><label class="field" style="flex:1"><span class="sr-only">New location</span><input id="new-loc" placeholder="New location" autocapitalize="words" enterkeyhint="done"></label><button class="btn accent" data-act="loc-add">Add</button></div>
    <p class="muted tiny" style="margin:0">A location can be deleted once no bottles in stock are stored there. Use Move to bring its wines to another location first.</p>
  </section>`;
}

function viewSettings(first) {
  const c = CFG || { url: '', token: '' };
  return `<main class="screen${first ? '' : ' has-nav'}" style="gap:16px">
    ${first ? '' : `<a class="back" href="#/cellar">${ICON.back}Cellar</a>`}
    <h1 class="title">${first ? 'Connect your cellar' : 'Settings'}</h1>
    ${first ? '' : locationsHtml()}
    ${first ? '' : '<h2 style="font-size:15px;font-weight:600;margin-top:8px">Connection</h2>'}
    <p class="muted" style="margin:0">Paste the web app URL and the token from your Google Apps Script. Both stay on this device.</p>
    <label class="field">Script URL<input id="cfg-url" type="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(c.url)}"></label>
    <label class="field">Token<input id="cfg-token" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(c.token)}"></label>
    <button class="btn primary big block" data-act="connect">${first ? 'Connect' : 'Save and reconnect'}</button>
    ${first ? '' : `<button class="btn block" data-act="reload">Reload data from Google Drive</button>
      <button class="btn danger block" data-act="disconnect">Disconnect this device</button>`}
    <p class="muted tiny center">Wine Cellar ${APP_VERSION}</p>
  </main>${first ? '' : nav(null)}`;
}

/* ------------------------------------------------------------ actions */

const ACTS = {
  refresh: () => sync(false),
  'filter-toggle': () => { U.filterOpen = !U.filterOpen; refreshView(); },
  'filter-chip': el => {
    const a = U.filters[el.dataset.k];
    const i = a.indexOf(el.dataset.v);
    if (i >= 0) a.splice(i, 1); else a.push(el.dataset.v);
    refreshView();
  },
  'filter-more': el => { U.filterAll[el.dataset.k] = true; refreshView(); },
  'filter-clear': () => { U.filters = { wine: [], grape: [], food: [], location: [] }; refreshView(); },
  'filter-tab': el => { U.filterTab = el.dataset.v; refreshView(); },
  'filter-less': el => { U.filterAll[el.dataset.k] = false; refreshView(); },
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
    U.filters = { wine: [], grape: [], food: [], location: [lc(el.dataset.v)] };
    U.filterOpen = false;
    U.search = '';
    go('#/cellar');
  },
  'loc-move-open': el => { U.locMove = el.dataset.v; refreshView(); },
  'loc-move-cancel': () => { U.locMove = null; refreshView(); },
  'loc-move': async el => {
    const from = el.dataset.v, to = $('#move-to').value;
    if (!to || !confirm(`Move all wines from ${from} to ${to}?`)) return;
    const moved = S.wines.filter(w => lc(w.location) === lc(from));
    moved.forEach(w => { w.location = to; });
    U.locMove = null;
    persist();
    refreshView();
    try { await api('moveLocation', { from, to }); toast(`${moved.length} ${moved.length === 1 ? 'wine' : 'wines'} moved to ${to}`); }
    catch (e) { moved.forEach(w => { w.location = from; }); persist(); refreshView(); toast('Not moved: ' + e.message); }
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
  'j-person': el => { U.jPerson = U.jPerson === el.dataset.v ? null : el.dataset.v; refreshView(); },
  'j-more': () => { U.jAllPeople = true; refreshView(); },
  'edit-removal': el => openEditRemoval(el.dataset.id),
  'toggle-finished': () => { U.showFinished = !U.showFinished; refreshView(); },
  plus: el => adjustCount(el.dataset.id, 1),
  minus: el => openRemoveSheet(el.dataset.id),
  winf: el => { U.winFilter = el.dataset.v; render(); },
  'top-type': el => { U.topType = el.dataset.v; render(); },
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
  'p-rm': el => { PK().people.splice(Number(el.dataset.i), 1); updatePeople(); },
  'p-pick': el => addPerson(el.dataset.v),
  'p-add-typed': () => addPerson(PK().typing),
  'p-all': () => { PK().showAll = true; updatePeople(); },
  acq: el => { D.acquired = el.dataset.v; render(); },
  'j-less': () => { U.jAllPeople = false; refreshView(); },

  'sheet-close': () => closeSheet(),
  'rs-type': el => { RS.type = el.dataset.v; renderSheet(); },
  'rs-skip': () => saveRemoval(false),
  'rs-save': () => (RS.mode === 'edit' ? saveRemovalEdit() : saveRemoval(true)),
  'rs-delete': () => deleteRemoval(),

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
  shelf: el => {
    const v = clamp((Number(D.fields.shelf) || 0) + Number(el.dataset.d), 0, 99);
    D.fields.shelf = v === 0 ? '' : v;
    $('#shelf-val').textContent = v === 0 ? 'None' : v;
  },
  bottles: el => {
    D.count = clamp(D.count + Number(el.dataset.d), 0, 999);
    $('#bottles-val').textContent = D.count;
  },
  radd: () => {
    const used = D.ratings.map(r => r.sys);
    const next = SYSTEMS.find(x => !used.includes(x.key)) || SYSTEMS[0];
    D.ratings.push({ sys: next.key, score: '' });
    render();
  },
  rrm: el => { D.ratings.splice(Number(el.dataset.i), 1); render(); },
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
    const l = $('#wine-list'), f = $('#facet-chips');
    if (l) l.innerHTML = cellarList();
    if (f) f.innerHTML = facetChipsHtml();
  },
  facetq: el => { U.facetQ[U.filterTab] = el.value; const f = $('#facet-chips'); if (f) f.innerHTML = facetChipsHtml(); },
  rs: el => { if (RS) RS[el.name] = el.value; },
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
    const l = $('#journal-list'), p = $('#j-people');
    if (l) l.innerHTML = journalList();
    if (p) p.innerHTML = jPeopleHtml();
  },
  field: el => { if (D) { D.fields[el.name] = el.value; D.touched.add(el.name); } },
  rscore: el => { if (D) D.ratings[Number(el.dataset.i)].score = el.value; }
};

const CHANGES = {
  field: el => { if (D) { D.fields[el.name] = el.value; D.touched.add(el.name); } },
  rsys: el => { if (D) D.ratings[Number(el.dataset.i)].sys = el.value; },
  'show-finished': el => { U.showFinished = el.checked; refreshView(); },
  'top-finished': el => { U.topFinished = el.checked; refreshView(); },
  'j-fav': el => { U.jFav = el.checked; refreshView(); },
  location: async el => {
    if (!D) return;
    if (el.value !== '__new') { D.fields.location = el.value; return; }
    const name = (prompt('Name of the new location, for example Kitchen or Basement') || '').trim();
    if (!name) { el.value = D.fields.location; return; }
    if (!S.locations.includes(name)) S.locations.push(name);
    D.fields.location = name;
    persist();
    render();
    try { S.locations = await api('addLocation', { name }); persist(); } catch (e) { toast('Location saved on this device only: ' + e.message); }
  },
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

function init() {
  document.addEventListener('click', e => {
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
  });
  window.addEventListener('hashchange', () => { if (RS) closeSheet(); render(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && CFG && !isFormRoute()) sync(true); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
  loadCache();
  render();
  if (CFG) sync(true);
}

if (typeof document !== 'undefined') init();
if (typeof module !== 'undefined') module.exports = { normWine, serialWine, windowParts, statusOf, solveHomography, parseRatings, splitList, fmtScore };
