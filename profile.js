'use strict';

/* Wine Cellar: taste profile and background of a wine. Shown on the detail page, edited in Edit,
   filled by the AI when a label is read or with Add taste profiles in Settings. */

const pi = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

const AROMAS = {
  redfruit: ['Red fruit', '#C2414F', pi('<circle cx="7.5" cy="16.5" r="3.5"/><circle cx="16.5" cy="17" r="3.5"/><path d="M7.5 13C8.5 8.5 11 5.5 14 4M16.5 13.5C16 9.5 15 6.5 14 4"/><path d="M14 4c2.2-.3 4.2.6 5.3 2.2-2 .7-4.1.3-5.3-2.2z"/>')],
  darkfruit: ['Dark fruit', '#8F62C2', pi('<circle cx="10" cy="9.5" r="2"/><circle cx="14" cy="9.5" r="2"/><circle cx="8" cy="13.5" r="2"/><circle cx="12" cy="13.5" r="2"/><circle cx="16" cy="13.5" r="2"/><circle cx="10" cy="17.5" r="2"/><circle cx="14" cy="17.5" r="2"/><path d="M12 7.5V4M12 5.5c-1.4-1.6-3.4-2-5-1.4"/>')],
  citrus: ['Citrus', '#D9B23A', pi('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="6"/><path d="M12 6v12M6 12h12M7.8 7.8l8.4 8.4M16.2 7.8l-8.4 8.4"/>')],
  treefruit: ['Stone and tree fruit', '#E08A3C', pi('<path d="M12 7.5c-3-1.6-7.5-.4-7.5 4.8 0 4.3 3 8.2 5.6 8.2.9 0 1.4-.4 1.9-.4s1 .4 1.9.4c2.6 0 5.6-3.9 5.6-8.2 0-5.2-4.5-6.4-7.5-4.8z"/><path d="M12 7.5V4.2"/><path d="M12.2 5.4c.9-1.6 2.8-2.2 4.4-1.7-.6 1.6-2.5 2.4-4.4 1.7z"/>')],
  tropical: ['Tropical fruit', '#E0B23C', pi('<ellipse cx="12" cy="15" rx="5" ry="6"/><path d="M8.6 11.5l6.8 7M15.4 11.5l-6.8 7M7.2 15.2l4.3-4.4M16.8 15.2l-4.3-4.4"/><path d="M12 9V5M12 7.5L8.8 4.5M12 7.5l3.2-3"/>')],
  floral: ['Floral', '#D06A8C', pi('<circle cx="12" cy="12" r="2.2"/><path d="M12 9.8c-2-1.4-2.6-4.4 0-6 2.6 1.6 2 4.6 0 6zM14.1 11.3c.8-2.3 3.6-3.5 5.6-1.3-1.3 2.6-4.2 2.6-5.6 1.3zM13.3 14c2.4.1 4.4 2.4 3.1 5-2.8.2-3.9-2.6-3.1-5zM10.7 14c.8 2.4-.3 5.2-3.1 5-1.3-2.6.7-4.9 3.1-5zM9.9 11.3C8.5 12.6 5.6 12.6 4.3 10c2-2.2 4.8-1 5.6 1.3z"/>')],
  herbal: ['Herbal', '#6FA35B', pi('<path d="M5 19C5 11 10 5 19 5c0 9-5.5 14-14 14z"/><path d="M5 19l9-9M9.5 14.5h3.5M12 12V8.8"/>')],
  spice: ['Spice', '#C9711F', pi('<path d="M12 3l1.6 5.2L19 7l-3.8 4L19 15l-5.4-1.2L12 19l-1.6-5.2L5 15l3.8-4L5 7l5.4 1.2z"/><circle cx="12" cy="11" r="1.4"/>')],
  oak: ['Oak and vanilla', '#B08A5A', pi('<path d="M7 4h10c1.3 2.4 1.9 5 1.9 8s-.6 5.6-1.9 8H7c-1.3-2.4-1.9-5-1.9-8S5.7 6.4 7 4z"/><path d="M5.6 8.5h12.8M5.6 15.5h12.8"/>')],
  earth: ['Earth', '#8C7A62', pi('<path d="M3 9c3-3 6 3 9 0s6 3 9 0"/><path d="M3 14h18M3 19h18"/><circle cx="8" cy="16.5" r=".6"/><circle cx="15" cy="16.5" r=".6"/><circle cx="11.5" cy="11.6" r=".6"/>')],
  leather: ['Leather and tobacco', '#9A6A48', pi('<path d="M12 3c4 3 6 6.5 6 10.5S15.3 21 12 21s-6-3.5-6-7.5S8 6 12 3z"/><path d="M12 6v15M12 10.5l3-2M12 10.5l-3-2M12 14.5l3.4-2M12 14.5l-3.4-2"/>')],
  mineral: ['Mineral', '#7E9AAE', pi('<path d="M7.5 4h9L21 9.5 12 20.5 3 9.5z"/><path d="M3 9.5h18M9.5 4L12 9.5 14.5 4M12 9.5v11"/>')],
  honey: ['Honey and nuts', '#C99A2E', pi('<path d="M12 3l7.5 4.3v8.7L12 20.3 4.5 16V7.3z"/><path d="M12 8.2l3.8 2.2v4.3L12 16.9l-3.8-2.2v-4.3z"/>')]
};

const FOODS = {
  beef: ['Beef', pi('<path d="M4.5 10.5C4.5 6.6 8 4 12.5 4s7.5 2.6 7.5 6.5c0 5-4 9.5-9 9.5-2.8 0-3.6-1.7-4.4-3.4-.7-1.4-2.1-2.4-2.1-6.1z"/><circle cx="14.5" cy="9.5" r="2"/>')],
  lamb: ['Lamb', pi('<path d="M14 4.5c3.3 0 5.5 2.4 5.5 5.3 0 3.6-3 6.2-6.4 6.2-2.6 0-4.6-1.9-4.6-4.7C8.5 7.6 10.9 4.5 14 4.5z"/><path d="M9.6 13.6L4.5 19.5M3.5 18.2l2.3 2.3"/>')],
  pork: ['Pork', pi('<circle cx="12" cy="13" r="7"/><ellipse cx="12" cy="15.2" rx="3" ry="2"/><path d="M11 15.2h.01M13 15.2h.01M9.2 10.6h.01M14.8 10.6h.01"/><path d="M6.6 8.3L5.5 4.6l3.9 2M17.4 8.3l1.1-3.7-3.9 2"/>')],
  game: ['Game', pi('<path d="M8 20v-6.5C6 12 5 10 5 7.5M5 7.5L3.5 4M5 7.5L7.5 5M16 20v-6.5c2-1.5 3-3.5 3-6M19 7.5L20.5 4M19 7.5L16.5 5"/><path d="M8 13.5h8"/>')],
  poultry: ['Poultry', pi('<path d="M15.5 3.5c3 0 5 2.4 5 5 0 3.4-3.2 5.6-6.2 4.8l-4.1 4.1"/><path d="M15.5 3.5c-3 0-5.5 2.6-4.8 6.1l-4.4 4.4"/><path d="M6.3 14a1.9 1.9 0 1 0-1.2 3.4 1.9 1.9 0 1 0 3.3 1.3l1.8-1.8"/>')],
  fish: ['Fish', pi('<path d="M6 12c2.5-3.5 6-5 9.5-4.5 2.6.4 4.6 2.2 5.5 4.5-.9 2.3-2.9 4.1-5.5 4.5-3.5.5-7-1-9.5-4.5z"/><path d="M6 12L2.5 8.5v7z"/><circle cx="16.8" cy="11.2" r=".7"/>')],
  seafood: ['Seafood', pi('<path d="M12 20L4 9.5C6 6 9 4.5 12 4.5S18 6 20 9.5z"/><path d="M12 20V4.5M12 20L8.2 5.3M12 20l3.8-14.7M12 20L5.6 7.2M12 20l6.4-12.8"/>')],
  pasta: ['Pasta', pi('<path d="M3 12.5h18c0 3.9-4 7-9 7s-9-3.1-9-7z"/><path d="M7 12.5c0-3 2-3 2-6M11 12.5c0-3 2-3 2-6M15 12.5c0-3 2-3 2-6"/>')],
  pizza: ['Pizza', pi('<path d="M12 21L3.5 6.5C6 5 9 4 12 4s6 1 8.5 2.5z"/><path d="M4.8 8.7C7.2 7.4 9.6 6.8 12 6.8s4.8.6 7.2 1.9"/><circle cx="10" cy="11.5" r="1.2"/><circle cx="14" cy="11.8" r="1"/><circle cx="12" cy="15.5" r="1.1"/>')],
  vegetarian: ['Vegetarian', pi('<path d="M12 21v-8"/><path d="M12 13c0-4 3-7 8-7 0 4.5-3 7-8 7zM12 15.5c0-3.5-2.5-6-7-6 0 4 2.5 6 7 6z"/>')],
  mushrooms: ['Mushrooms', pi('<path d="M3.5 12a8.5 7 0 0 1 17 0z"/><path d="M9.5 12v6a2.5 2 0 0 0 5 0v-6"/><circle cx="9" cy="8.5" r=".8"/><circle cx="14.5" cy="7.8" r=".8"/>')],
  spicy: ['Spicy food', pi('<path d="M6.5 20.5c6 0 11.5-5 12.5-11 .2-1.3-.8-2.3-2-1.8-1 .4-1.4 1.3-1.6 2.3-.9 3.3-4.4 6.4-8.4 7.4-1.8.4-1.9 3.1-.5 3.1z"/><path d="M17.3 7.4c0-1.6.9-2.8 2.4-3.3"/>')],
  asian: ['Asian', pi('<path d="M3 13h18c0 4-4 7-9 7s-9-3-9-7z"/><path d="M10 10.5L19.5 3M13.5 11L21 5"/>')],
  hardcheese: ['Hard cheese', pi('<path d="M3 16L15.5 6.5l5.5 4.5v6H3z"/><path d="M3 16h18"/><circle cx="14.5" cy="12.6" r="1.1"/><circle cx="9" cy="13.4" r=".9"/><circle cx="17.5" cy="15.1" r=".01"/>')],
  softcheese: ['Soft cheese', pi('<path d="M11 5a8 8 0 1 0 8 8h-8z"/><path d="M14 2.5v7.5h7.5A7.5 7.5 0 0 0 14 2.5z"/>')],
  curedmeat: ['Cured meat', pi('<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="9.5" r="1"/><circle cx="14.5" cy="8.8" r=".8"/><circle cx="13.2" cy="14.6" r="1.1"/><circle cx="8.6" cy="14.2" r=".7"/><circle cx="16.4" cy="12.6" r=".7"/>')],
  dessert: ['Dessert', pi('<path d="M6 12.5h12l-1.6 7.5H7.6z"/><path d="M5 12.5a7 5.5 0 0 1 14 0"/><circle cx="12" cy="5.3" r="1.5"/><path d="M9.5 12.5L10.2 20M14.5 12.5L13.8 20"/>')],
  aperitif: ['Aperitif', pi('<path d="M4 5h16l-8 9z"/><path d="M12 14v6M8.5 20h7"/><circle cx="13.8" cy="7.6" r="1.4"/><path d="M15 6.4L18 3.5"/>')]
};

const AB_ICON = {
  style: pi('<path d="M10 3h4v4.5c1.8.9 3 2.6 3 4.7V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-7.8c0-2.1 1.2-3.8 3-4.7z"/><path d="M7 13.5h10"/>'),
  grape: pi('<circle cx="9.5" cy="10" r="2.3"/><circle cx="14.5" cy="10" r="2.3"/><circle cx="12" cy="14" r="2.3"/><circle cx="12" cy="18.3" r="2"/><circle cx="7.6" cy="14.4" r="2"/><circle cx="16.4" cy="14.4" r="2"/><path d="M12 7.7V4c1.6-.4 3 .2 4 1.4"/>'),
  producer: pi('<path d="M4 20V10l8-6 8 6v10"/><path d="M9.5 20v-5h5v5"/>'),
  classification: pi('<circle cx="12" cy="14.5" r="5"/><path d="M9 3l3 6 3-6M12 12.5v4"/>'),
  alcohol: pi('<path d="M10 3h4v4.5c1.8.9 3 2.6 3 4.7V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-7.8c0-2.1 1.2-3.8 3-4.7z"/><path d="M10 17l4-5"/><circle cx="10.3" cy="12.4" r=".5"/><circle cx="13.7" cy="16.6" r=".5"/>'),
  ageing: AROMAS.oak[2],
  closure: pi('<rect x="8" y="3" width="8" height="9" rx="1.5"/><path d="M9.5 12v2.5h5V12M12 14.5V21"/>'),
  vineyard: AROMAS.earth[2],
  vintage: pi('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
  heart: pi('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  fresh: pi('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>'),
  info: pi('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>')
};

/* the four taste axes, 1 to 5, with a word for every level */
const AXES = [
  ['body', 'Body', ['Light', 'Light to medium', 'Medium', 'Medium to full', 'Full']],
  ['acid', 'Acidity', ['Low', 'Mild', 'Medium', 'Fresh', 'Crisp']],
  ['tannin', 'Tannin', ['Very smooth', 'Smooth', 'Medium', 'Firm', 'Grippy']],
  ['sweet', 'Sweetness', ['Bone dry', 'Dry', 'Off-dry', 'Medium sweet', 'Sweet']]
];
/* white, sparkling and dessert wines have no tannin worth naming */
const NO_TANNIN = ['White', 'Sparkling', 'Dessert'];

/* ---------------------------------------------------------------- data */

function parseProfile(v) {
  let p = v;
  if (typeof v === 'string') { try { p = v ? JSON.parse(v) : null; } catch (e) { p = null; } }
  if (!p || typeof p !== 'object') return null;
  const sc = x => { const n = Math.round(Number(x)); return n >= 1 && n <= 5 ? n : null; };
  const t = x => str(x).trim();
  return {
    v: 1, body: sc(p.body), tannin: sc(p.tannin), sweet: sc(p.sweet), acid: sc(p.acid),
    aromas: (Array.isArray(p.aromas) ? p.aromas : []).filter(a => a && AROMAS[a.g]).slice(0, 3).map(a => ({ g: a.g, n: t(a.n) })),
    foods: (Array.isArray(p.foods) ? p.foods : []).filter(f => FOODS[f]).filter((f, i, a) => a.indexOf(f) === i).slice(0, 6),
    style: t(p.style), styleDesc: t(p.styleDesc), sub: t(p.sub), producerLine: t(p.producerLine), about: t(p.about),
    classification: t(p.classification), alcohol: Number(p.alcohol) > 0 ? Number(p.alcohol) : null, ageing: t(p.ageing),
    closure: t(p.closure), vineyard: t(p.vineyard), vintageNote: t(p.vintageNote), typical: p.typical === true,
    bottle: ['bordeaux', 'burgundy', 'tapered', 'roundshoulder', 'flute', 'champagne', 'provence', 'bocksbeutel', 'port', 'clavelin', 'tokaji', 'fiasco'].includes(p.bottle) ? p.bottle : '',
    glass: ['black', 'green', 'olive', 'light', 'amber', 'clear'].includes(p.glass) ? p.glass : '',
    label: p.label === 'oval' ? 'oval' : ''
  };
}
/* the alcohol of a wine as shown under its name, or '' */
const alcText = w => (w.profile && w.profile.alcohol ? `${fmtNum(w.profile.alcohol, w.profile.alcohol % 1 ? 1 : 0)}%` : '');
const emptyProfile = () => parseProfile({ aromas: [], foods: [] });
const hasProfile = w => !!(w.profile && (w.profile.body || w.profile.aromas.length || w.profile.foods.length || w.profile.style));

/* coarse food categories: from the profile, or guessed from the dishes of older wines */
const FOOD_WORDS = [
  ['beef', /beef|steak|veal|ribeye|entrec|brisket|burger|bolito|bœuf|boeuf|filet/], ['lamb', /lamb|mutton|agneau/],
  ['pork', /pork|ham\b|porchetta|suckling|sausage|pig/], ['game', /venison|game|deer|boar|duck|hare|rabbit|pheasant|quail|wild/],
  ['poultry', /chicken|poultry|turkey|guinea|capon|coq/], ['fish', /fish|salmon|trout|cod|sole|tuna|sea bass|halibut|perch|char/],
  ['seafood', /seafood|oyster|shrimp|prawn|lobster|crab|scallop|mussel|shellfish|langoust|squid|octopus|sushi/],
  ['pasta', /pasta|risotto|orecchiette|spaghetti|lasagn|ravioli|tagliatelle|gnocchi|ragù|ragu|noodle/], ['pizza', /pizza/],
  ['vegetarian', /vegetable|vegetarian|salad|aubergine|eggplant|ratatouille|asparagus|lentil|bean/],
  ['mushrooms', /mushroom|truffle|porcini|chanterelle/], ['spicy', /spicy|chili|curry|szechuan|jerk/],
  ['asian', /asian|thai|chinese|japanese|sushi|indian|vietnam|korean/],
  ['hardcheese', /pecorino|parmesan|parmigiano|gruy|comt|cheddar|manchego|hard cheese|aged cheese|sbrinz|appenzell/],
  ['softcheese', /brie|camembert|goat|soft cheese|mozzarella|burrata|vacherin|reblochon|blue cheese|roquefort|gorgonzola/],
  ['curedmeat', /salami|prosciutto|charcuterie|cured|bresaola|jam[oó]n|coppa|bündner/],
  ['dessert', /dessert|cake|chocolate|tart|pastry|fruit salad|crème|creme|pudding/],
  ['aperitif', /aperitif|apéritif|canap|nuts|olives|tapas|antipasti/]
];
function guessFoods(dishes) {
  const out = [];
  dishes.forEach(d => { const k = lc(d); FOOD_WORDS.forEach(([f, re]) => { if (re.test(k) && !out.includes(f)) out.push(f); }); });
  return out.slice(0, 6);
}
const foodsOf = w => (w.profile && w.profile.foods.length ? w.profile.foods : guessFoods(w.pairings));

/* ---------------------------------------------------------------- what you like: from your own ratings */

function ratedWith(key, w) {
  const rated = S.wines.filter(x => x.id !== w.id && x.myRating !== null && key(x));
  return { n: rated.length, avg: rated.length ? rated.reduce((a, x) => a + x.myRating, 0) / rated.length : null };
}
const regionKey = w => lc(str(w.region).split(',')[0]);
const mainGrape = w => { const s = grapeShares(Object.assign({}, w, { count: 1 })).sort((a, b) => b.n - a.n)[0]; return s ? s.name : ''; };
function bestGroup(keyOf) {
  const g = {};
  S.wines.forEach(x => { if (x.myRating === null) return; const k = keyOf(x); if (!k) return; (g[k] = g[k] || []).push(x.myRating); });
  let best = null;
  Object.keys(g).forEach(k => { if (g[k].length < 2) return; const a = g[k].reduce((s, v) => s + v, 0) / g[k].length; if (!best || a > best.a) best = { k, a }; });
  return best ? best.k : null;
}
function likeHint(kind, w, keyOf) {
  const own = keyOf(w);
  if (!own) return null;
  const all = S.wines.filter(x => x.id !== w.id && keyOf(x) === own);
  const r = ratedWith(x => keyOf(x) === own, w);
  if (!all.length) return w.myRating !== null || S.removals.some(r => r.wineId === w.id && r.dir === 'out') ? { cls: 'meh', icon: AB_ICON.info, text: `Your only wine ${{ region: 'from this region', style: 'in this style', grape: 'of this grape', producer: 'from this producer' }[kind]} so far` } : { cls: 'new', icon: AB_ICON.fresh, text: `New ${kind} for you` };
  if (!r.n) return { cls: 'meh', icon: AB_ICON.info, text: `${all.length} ${all.length === 1 ? 'other wine' : 'other wines'} in your cellar, not rated yet` };
  const mine = S.wines.filter(x => x.myRating !== null);
  const avgAll = mine.reduce((a, x) => a + x.myRating, 0) / mine.length;
  const avg = Math.round(r.avg);
  const rated = `${r.n} ${r.n === 1 ? 'wine' : 'wines'} rated ${avg}%${r.n > 1 ? ' on average' : ''}`;
  if (bestGroup(keyOf) === own) return { cls: 'good', icon: AB_ICON.heart, text: `Your favorite ${kind}, ${rated}` };
  if (r.avg >= avgAll + 2) return { cls: 'good', icon: AB_ICON.heart, text: `You like this ${kind}, ${rated}` };
  if (r.avg < avgAll - 4) return { cls: 'meh', icon: AB_ICON.info, text: `Below your average so far, ${rated}` };
  return { cls: 'meh', icon: AB_ICON.info, text: `You know this ${kind}, ${rated}` };
}

/* ---------------------------------------------------------------- detail page */

function abRow(icon, title, sub, hint, go) {
  const h = hint ? `<div class="ab-hint ${hint.cls}">${hint.icon}<span>${esc(hint.text)}</span></div>` : '';
  const inner = `<span class="ab-ic">${icon}</span><div class="ab-body"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}${h}</div>`;
  // go: [kind, name, context] opens the background on it
  return go ? `<button class="ab-row" data-act="info-open" data-k="${esc(go[0])}" data-v="${esc(go[1])}" data-c="${esc(go[2] || '')}">${inner}${ICON.chevron}</button>` : `<div class="ab-row">${inner}</div>`;
}

function aboutHtml(w) {
  const p = w.profile;
  const rows = [];
  if (w.region) {
    const c = countryOf(w);
    rows.push(abRow(c ? `<span class="ab-flag">${flagEmoji(c.code)}</span>` : AB_ICON.vineyard, w.region, p ? p.sub : '', likeHint('region', w, regionKey), ['region', w.region]));
  }
  if (p && p.style) rows.push(abRow(AB_ICON.style, p.style, p.styleDesc, likeHint('style', w, x => (x.profile && x.profile.style ? lc(x.profile.style) : '')), ['style', p.style, w.region]));
  if (w.producer) rows.push(abRow(AB_ICON.producer, w.producer, p ? p.producerLine : '', likeHint('producer', w, x => lc(x.producer)), ['producer', w.producer, w.region]));
  if (!rows.length) return '';
  const more = p && (p.about || p.classification || p.ageing || p.closure || p.vineyard || p.vintageNote || vintOf(w.region, w.vintage));
  const open = U.aboutOpen === w.id;
  return `<section style="gap:12px"><h2>About this wine</h2>
    <div class="ab-list">${rows.join('')}
      ${more ? `<button class="ab-more" data-act="about-more" aria-expanded="${open}">${open ? 'Less about this wine' : 'More about this wine'}${ICON.chevron}</button>`
        : ''}
    </div>${more && open ? moreHtml(w) : ''}</section>`;
}

function moreHtml(w) {
  const p = w.profile;
  const fact = (k, label, val, wide) => (val ? `<div class="ab-fact${wide ? ' wide' : ''}">${AB_ICON[k]}<div><span>${esc(label)}</span><b>${esc(val)}</b></div></div>` : '');
  const facts = [
    fact('classification', 'Classification', p.classification),
    fact('ageing', 'Ageing', p.ageing),
    fact('closure', 'Closure', p.closure),
    fact('vineyard', 'Vineyard and soil', p.vineyard, true),
    vintFactHtml(w, p)
  ].filter(Boolean);
  // two narrow facts side by side; a single narrow one at the end takes the full width
  const narrow = facts.filter(f => !f.includes('ab-fact wide'));
  if (narrow.length % 2) { const last = narrow[narrow.length - 1]; facts[facts.indexOf(last)] = last.replace('class="ab-fact"', 'class="ab-fact wide"'); }
  return `<div class="ab-more-body">
    ${p.about ? `<p class="ab-text"><b>${esc(w.producer || 'The producer')}</b> ${esc(p.about.startsWith(w.producer) ? p.about.slice(w.producer.length).trim() : p.about)}</p>` : ''}
    ${facts.length ? `<div class="ab-facts">${facts.join('')}</div>` : ''}
    <p class="tiny muted" style="margin:0">From AI knowledge and the label. Correct anything in Edit.</p></div>`;
}

/* grapes as a ring in the colors of the wine type, the same shade per grape as in Insights where it fits */
const ROSE_SHADES = ['#D06A8C', '#E9A3BB', '#A44A6A'];
function grapeRingHtml(w) {
  const shares = grapeShares(Object.assign({}, w, { count: 100 })).sort((a, b) => b.n - a.n);
  if (!shares.length) return w.grapes ? `<div class="kv"><span>Grapes</span><p>${esc(w.grapes)}</p></div>` : '';
  const shades = w.type === 'Rosé' ? ROSE_SHADES : ['White', 'Sparkling', 'Dessert'].includes(w.type) ? WHITE_SHADES : RED_SHADES;
  const red = shades === RED_SHADES;
  // the order of the grape among your red or white grapes in Insights decides its shade
  const rank = {};
  const fam = S.wines.filter(x => x.count > 0 && (['Red', 'Rosé', 'Fortified'].includes(x.type) === red || shades === ROSE_SHADES));
  const tot = {};
  fam.forEach(x => grapeShares(x).forEach(g => { tot[lc(g.name)] = (tot[lc(g.name)] || 0) + g.n; }));
  Object.keys(tot).sort((a, b) => tot[b] - tot[a]).forEach((k, i) => { rank[k] = i; });
  const used = new Set();
  const rows = shares.map((g, i) => {
    let c = shades[(rank[lc(g.name)] !== undefined ? rank[lc(g.name)] : i) % shades.length];
    if (used.has(c)) c = shades.find(s => !used.has(s)) || c;
    used.add(c);
    return { k: g.name, n: g.n, c, info: g.name };
  });
  const center = [String(rows.length), rows.length === 1 ? 'grape' : 'grapes'];
  return `<div class="tp-block"><p class="tp-lead">Grapes${w.profile && w.profile.typical ? ' · typical blend' : ''}</p>${donut(rows, 100, { label: 'Grapes', pctOnly: true, center, wrap: true })}</div>`;
}

/* where your favorites of this type lie on each axis: the average of your favorites (a heart, or your own top quarter), from three wines on.
   Until then the taste test fills in, with the wine you named there counting like a favorite; it drops out from 20 rated wines on. */
function favAxes(type) {
  const th = favThreshold();
  const fav = S.wines.filter(x => x.type === type && isFavWine(x, th) && x.profile);
  const tt = ttWeight() ? S.tasteTest : null;
  const anc = tt && tt.anchor && tt.anchor.profile && tt.anchor.wine && tt.anchor.wine.type === type ? tt.anchor.profile : null;
  const start = tt ? starterAxes(type, tt) : {};
  const avg = a => Math.round(a.reduce((x, v) => x + v, 0) / a.length);
  const out = {};
  let fromTest = false;
  AXES.forEach(([k]) => {
    const vals = fav.map(x => Number(x.profile[k]) || 0).filter(v => v >= 1 && v <= 5);
    if (vals.length >= 3) { out[k] = avg(vals); return; }
    if (!tt) return;
    const all = vals.concat(anc && Number(anc[k]) >= 1 ? [Number(anc[k])] : []);
    if (all.length >= 3) out[k] = avg(all);
    else if (start[k]) out[k] = avg(all.concat([start[k]]));
    else if (all.length > vals.length) out[k] = avg(all);
    else return;
    fromTest = true;
  });
  if (fromTest) Object.defineProperty(out, 'fromTest', { value: true });
  return out;
}

function axesHtml(w) {
  const p = w.profile;
  if (!p || !AXES.some(([k]) => p[k])) return '';
  const color = TYPE_CHART[w.type] || TYPE_CHART.Red;
  const fav = favAxes(w.type);
  const tiles = AXES.map(([k, name, words]) => {
    const v = Number(p[k]) || 0;
    const none = !v && k === 'tannin' && NO_TANNIN.includes(w.type);
    const word = v ? words[v - 1] : none ? 'None' : 'Not set';
    const heart = fav[k] ? `<div class="tt-fav">${[1, 2, 3, 4, 5].map(i => (i === fav[k] ? `<span>${ICON.heart}</span>` : '<span></span>')).join('')}</div>` : '';
    return `<div class="tt" role="img" aria-label="${name}: ${word}${fav[k] ? `, your favorites: ${words[fav[k] - 1]}` : ''}"><span class="tt-name">${name}</span><b class="tt-word${v ? '' : ' muted'}">${word}</b>
      <div class="tt-segs">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= v ? 'on' : ''}"></i>`).join('')}</div>${heart}</div>`;
  });
  const legend = Object.keys(fav).length ? `<p class="tt-legend">${ICON.heart}${fav.fromTest ? 'Your taste, partly from the taste test' : 'Your favorites of this type'}</p>` : '';
  return `<div class="tt-wrap" style="--wc:${color}"><div class="tt-grid">${tiles.join('')}</div>${legend}</div>`;
}

function aromasHtml(w) {
  const a = w.profile ? w.profile.aromas : [];
  if (!a.length) return '';
  return `<div class="tp-block"><p class="tp-lead">Main aromas</p><div class="tp-aromas">${a.map(x => { const [name, c, ic] = AROMAS[x.g]; return `<div class="tp-aroma" style="--ac:${c}"><span class="tp-ic">${ic}</span><b>${esc(name)}</b>${x.n ? `<small>${esc(cap(x.n))}</small>` : ''}</div>`; }).join('')}</div></div>`;
}

function foodTilesHtml(w) {
  const f = foodsOf(w);
  if (!f.length) return w.pairings.length ? `<div class="kv"><span>Pairs with</span><p style="line-height:1.5">${esc(listSentence(w.pairings))}</p></div>` : '';
  return `<div class="tp-block"><p class="tp-lead">Pairs with</p><div class="tp-foods">${f.map(k => `<button class="tp-food" data-act="ins-go" data-k="food" data-v="${esc(FOODS[k][0])}">${FOODS[k][1]}<span>${esc(FOODS[k][0])}</span></button>`).join('')}</div></div>`;
}

function profileHtml(w, editHref) {
  const p = w.profile;
  const missing = !hasProfile(w);
  return `<section style="gap:16px">
      <h2>Profile</h2>
      ${grapeRingHtml(w)}
      ${axesHtml(w)}
      ${aromasHtml(w)}
      ${w.taste ? `<div class="kv"><span>Taste</span><p style="line-height:1.5">${esc(w.taste)}</p></div>` : ''}
      ${w.tasteTags.length ? `<div class="kv"><span>Style</span><p class="style-line">${w.tasteTags.map(t => esc(cap(t))).join(' · ')}</p></div>` : ''}
      ${foodTilesHtml(w)}
      ${missing ? `<p class="small muted" style="margin:0">No taste profile yet with taste axes, main aromas and background. <a href="${editHref}">Edit</a> to add it with AI.</p>` : ''}
      ${!w.grapes && !w.taste && !w.pairings.length && !p ? `<p class="muted small" style="margin:0">No profile yet. <a href="${editHref}">Edit</a> to add grapes, taste and food pairings.</p>` : ''}
    </section>`;
}

/* ---------------------------------------------------------------- filling profiles with AI */

const PROF = { busy: false, one: null, done: 0, total: 0, failed: 0 };
const PROF_BATCH = 3;

function applyProfiles(rows) {
  (rows || []).forEach(r => {
    const i = S.wines.findIndex(x => x.id === r.id);
    if (i >= 0) S.wines[i] = normWine(Object.assign({}, serialWine(S.wines[i]), { grapes: r.grapes, profile: r.profile, updatedAt: r.updatedAt }));
  });
  persist();
}

/* what the AI has not filled in yet, per wine */
const PROFILE_FACTS = ['producerLine', 'about', 'classification', 'ageing', 'vineyard', 'vintageNote'];
const MISSING_PARTS = [
  ['profile', 'Taste profile (taste axes, aromas, food)', w => !hasProfile(w)],
  ['facts', 'Background facts (producer, classification, ageing, vintage)', w => !w.profile || !PROFILE_FACTS.some(k => str(w.profile[k]).trim())],
  ['window', 'Drinking window', w => w.drinkFrom === null && w.drinkUntil === null],
  ['taste', 'Taste notes, taste tags and dishes', w => !str(w.taste).trim() || !w.tasteTags.length || !w.pairings.length],
  ['basics', 'Region or grapes', w => !str(w.region).trim() || !str(w.grapes).trim()]
];
const missingParts = w => MISSING_PARTS.filter(m => m[2](w)).map(m => m[0]);
const incompleteWines = () => S.wines.filter(w => missingParts(w).length);

/* regions, grapes, styles and producers without a background, checked against the server once per session */
let INFO_KEYS = null;
async function loadInfoKeys() {
  if (INFO_KEYS || (S.version && S.version < 22)) return;
  try { INFO_KEYS = new Set((await api('infoKeys', {})).keys || []); if (location.hash.startsWith('#/settings')) refreshView(); } catch (e) { INFO_KEYS = null; }
}
function missingInfos() {
  const have = infoCache(), seen = new Set();
  S.wines.forEach(w => infoItems(w).forEach(x => { const k = infoKey(x.kind, x.name, x.context); if (!have[k] && !(INFO_KEYS && INFO_KEYS.has(k))) seen.add(k); }));
  return seen.size;
}

const COMPLETE_BATCH = 3;
async function completeAll() {
  if (PROF.busy) return;
  const todo = incompleteWines().sort((a, b) => (b.count > 0) - (a.count > 0)).map(w => w.id);
  Object.assign(PROF, { busy: true, done: 0, total: todo.length, failed: 0, lastError: '' });
  refreshView();
  const say = t => { const el = $('#prof-progress'); if (el) el.textContent = t; };
  try {
    for (let i = 0; i < todo.length; i += COMPLETE_BATCH) {
      const d = await api('complete', { ids: todo.slice(i, i + COMPLETE_BATCH) });
      (d.wines || []).forEach(r => upsertWine(normWine(r)));
      persist();
      PROF.done = Math.min(todo.length, i + COMPLETE_BATCH);
      PROF.failed += (d.failed || []).length;
      if ((d.failed || []).length) PROF.lastError = d.failed[0].error || '';
      say(`${PROF.done} of ${PROF.total} wines done…`);
    }
    await fillInfos(S.wines, (n, t) => say(`Background on regions, vintages, grapes, styles and producers: ${n} of ${t}…`));
    INFO_KEYS = null;
    loadInfoKeys();
    toast(PROF.failed ? `Done. ${PROF.failed} ${PROF.failed === 1 ? 'wine' : 'wines'} could not be completed: ${aiErr(PROF.lastError || 'no answer')} Tap the button again for the rest.` : 'Wine info completed.');
  } catch (e) { toast(/Unknown action/i.test(e.message) ? 'This needs the new Code.gs.' : aiErr(e.message)); }
  PROF.busy = false;
  refreshView();
}

function wineInfoBoxHtml() {
  loadInfoKeys();
  const all = S.wines.length, inc = incompleteWines(), bg = missingInfos();
  const rows = MISSING_PARTS.map(([k, label, test]) => [label, S.wines.filter(test).length]).filter(r => r[1]);
  const list = rows.length || bg ? `<div class="usage-tab wi-tab">${rows.map(([l, n]) => `<div class="wi-row"><span>${esc(l)}</span><b>${n}</b></div>`).join('')}${bg ? `<div class="wi-row"><span>Background on regions, vintages, grapes, styles and producers</span><b>${bg}</b></div>` : ''}</div>` : '';
  const todo = inc.length || bg;
  return `<section class="box"><span class="box-title">Wine info</span>
    <p class="small" style="margin:0">${inc.length ? `${inc.length} of ${all} wines are missing AI details:` : `All ${all} wines have their AI details${bg ? ', only some backgrounds are missing:' : '.'}`}</p>
    ${list}
    ${PROF.busy ? `<p class="small" id="prof-progress" style="margin:0">${PROF.done} of ${PROF.total} wines done…</p>` : ''}
    <button class="btn accent block" data-act="complete-all"${PROF.busy || !todo ? ' disabled' : ''}>${ICON.spark}${inc.length ? `Complete wine info for ${inc.length} ${inc.length === 1 ? 'wine' : 'wines'}` : bg ? 'Add the missing backgrounds' : 'Wine info is complete'}</button>
    <p class="muted tiny" style="margin:0">Only empty fields are filled, nothing you entered is changed. About 3 cents per wine and 1 cent per region, grape, style or producer, each only once. Street prices and best offers stay separate. Keep the app open while it runs.</p></section>`;
}

/* ---------------------------------------------------------------- edit */


function profileEditorHtml() {
  const p = D.profile;
  const axis = ([k, name, words]) => `<div class="tpe-row"><span>${name}</span><div class="tpe-dots">${[1, 2, 3, 4, 5].map(v => `<button class="${p[k] === v ? 'on' : ''}" data-act="tp-set" data-k="${k}" data-v="${v}" aria-label="${name}: ${words[v - 1]}"></button>`).join('')}</div><span class="tpe-word">${p[k] ? words[p[k] - 1] : k === 'tannin' && NO_TANNIN.includes(D.fields && D.fields.type) ? 'None' : 'Not set'}</span></div>`;
  const aromaChips = Object.keys(AROMAS).map(g => { const i = p.aromas.findIndex(a => a.g === g); return `<button class="tpe-chip${i >= 0 ? ' on' : ''}" data-act="tp-aroma" data-v="${g}" style="--ac:${AROMAS[g][1]}">${AROMAS[g][2]}${esc(AROMAS[g][0])}</button>`; }).join('');
  const notes = p.aromas.map((a, i) => `<label class="field">${esc(AROMAS[a.g][0])}<input data-input="tp-note" data-i="${i}" value="${esc(a.n)}" placeholder="For example cherry, raspberry"></label>`).join('');
  const foods = Object.keys(FOODS).map(f => `<button class="tp-food${p.foods.includes(f) ? ' on' : ''}" data-act="tp-food" data-v="${f}">${FOODS[f][1]}<span>${esc(FOODS[f][0])}</span></button>`).join('');
  return `<span class="box-title">Taste profile</span>
    <p class="muted tiny" style="margin:-4px 0 0">Tap a dot to set it, tap it again to clear.</p>
    <div class="tpe-axes">${AXES.map(axis).join('')}</div>
    <span class="box-title" style="margin-top:6px">Main aromas</span>
    <p class="muted tiny" style="margin:-4px 0 0">Choose up to three, the most important first.</p>
    <div class="tpe-chips">${aromaChips}</div>
    ${notes ? `<div class="tpe-notes">${notes}</div>` : ''}
    <span class="box-title" style="margin-top:6px">Pairs with</span>
    <div class="tp-foods">${foods}</div>`;
}

function aboutEditorHtml() {
  const p = D.profile;
  const f = (k, label, ph, opts = {}) => opts.area
    ? `<label class="field full">${label}<textarea class="autosize" rows="3" data-input="tp-field" data-k="${k}" placeholder="${esc(ph)}">${esc(p[k])}</textarea></label>`
    : `<label class="field${opts.half ? '' : ' full'}">${label}<input data-input="tp-field" data-k="${k}" value="${esc(p[k] === null ? '' : p[k])}" placeholder="${esc(ph)}"${opts.num ? ' inputmode="decimal"' : ''}></label>`;
  return `<span class="box-title">About this wine</span>
    <div class="form-grid">
      ${f('style', 'Style', 'Red Burgundy')}
      ${f('styleDesc', 'Style in one line', 'Elegant, light to medium bodied Pinot Noir')}
      ${f('sub', 'Sub-region or appellation', 'Côte de Nuits')}
      ${f('producerLine', 'Producer in one line', 'Family estate in Gevrey-Chambertin')}
      ${f('about', 'About the producer', 'Two or three sentences', { area: true })}
      ${f('classification', 'Classification', 'AOC, DOCG, Grand Cru', { half: true })}
      ${f('alcohol', 'Alcohol %', '13.5', { half: true, num: true })}
      ${f('ageing', 'Ageing', '14 months in French oak')}
      ${f('closure', 'Closure', 'Natural cork')}
      ${f('vineyard', 'Vineyard and soil', 'East facing slopes, limestone')}
      ${f('vintageNote', 'The vintage', 'How the year was in this region', { area: true })}
    </div>`;
}

function renderProfileEditor() {
  const b = $('#tp-editor');
  if (b) b.innerHTML = profileEditorHtml();
}

function profileFromDraft() {
  const p = Object.assign({}, D.profile);
  delete p.bottle; delete p.glass;   // shape and glass are kept in D.bottle and D.glass
  const a = Number(String(p.alcohol === null ? '' : p.alcohol).replace(',', '.'));
  p.alcohol = a > 0 && a < 25 ? a : null;
  p.aromas = p.aromas.filter(x => AROMAS[x.g]).map(x => ({ g: x.g, n: str(x.n).trim() }));
  const empty = !p.body && !p.tannin && !p.sweet && !p.acid && !p.aromas.length && !p.foods.length &&
    !['style', 'styleDesc', 'sub', 'producerLine', 'about', 'classification', 'ageing', 'closure', 'vineyard', 'vintageNote'].some(k => str(p[k]).trim()) && !p.alcohol;
  return empty ? null : p;
}

/* ---------------------------------------------------------------- background on a region, grape, style or producer */

const INFO = { kind: null, name: '', context: '', data: null, busy: false, error: '' };
const INFO_ICON = { region: () => AB_ICON.vineyard, grape: () => AB_ICON.grape, style: () => AB_ICON.style, producer: () => AB_ICON.producer };
const infoFirst = v => lc(str(v).split(',')[0].trim()).replace(/\s+/g, ' ');
const infoKey = (kind, name, context) => `${kind}|${kind === 'region' || kind === 'vintages' ? infoFirst(name) : lc(str(name).trim()).replace(/\s+/g, ' ')}${kind === 'producer' && context ? `|${infoFirst(context)}` : ''}`;
/* backgrounds are kept on the phone; what does not fit there any more is still kept for this session */
const INFO_MEM = {};
function infoStored() { try { return JSON.parse(localStorage.getItem('wc-info') || '{}'); } catch (e) { return {}; } }
function infoCache() { return Object.assign(infoStored(), INFO_MEM); }
const countryName = c => { if (COUNTRY_NAMES[c]) return COUNTRY_NAMES[c]; try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(c) || c; } catch (e) { return c; } };
/* a grape background from before the charts is written again once */
const INFO_NEW = { grape: [3, 24], region: [3, 26], producer: [3, 49] };
const infoOld = (kind, d) => (kind === 'vintages' ? !d || Number(d.made) < new Date().getFullYear() : !!INFO_NEW[kind] && ((d && d.v) || 0) < INFO_NEW[kind][0] && !(S.version && S.version < INFO_NEW[kind][1]));
function infoRemember(key, data) {
  INFO_MEM[key] = data;
  const c = infoStored(); c[key] = data;
  try { localStorage.setItem('wc-info', JSON.stringify(c)); return; } catch (e) { /* full: make room below */ }
  try {
    Object.keys(c).forEach(k => { if (k !== key && infoOld(k.split('|')[0], c[k])) delete c[k]; });   // outdated ones are written again anyway
    localStorage.setItem('wc-info', JSON.stringify(c));
  } catch (e) { /* kept for this session */ }
}

async function openInfo(kind, name, context) {
  Object.assign(INFO, { kind, name, context: context || '', data: null, busy: false, error: '', vAll: false, vFocus: null });
  const key = infoKey(kind, name, context);
  const hit = infoCache()[key];
  if (hit && !infoOld(kind, hit)) { INFO.data = hit; renderInfo(); return; }
  INFO.busy = true;
  renderInfo();
  try {
    const d = await api('info', { kind, name, context: context || '' });
    if (INFO.kind !== kind || INFO.name !== name) return;
    INFO.data = d.info || hit || null;                             // an older background is better than none
    if (d.info) infoRemember(key, d.info); else if (!hit) INFO.error = `No background found on ${name}. Try again later.`;
  } catch (e) {
    if (hit) INFO.data = hit;
    else INFO.error = /Unknown action/i.test(e.message) ? 'The background needs the new Code.gs.' : aiErr(e.message);
  }
  INFO.busy = false;
  renderInfo();
}
function closeInfo() { INFO.kind = null; renderInfo(); }
/* leaving a background for the filtered cellar: Back brings you to it again, open where you were */
function infoLeave() {
  const b = $('#info-root .info-body');
  U.infoBack = { hash: location.hash, kind: INFO.kind, name: INFO.name, context: INFO.context, vAll: INFO.vAll, top: b ? b.scrollTop : 0 };
  closeInfo();
}
function infoReturn() {
  const x = U.infoBack;
  if (!x) return;
  if (location.hash !== x.hash) { if (!['cellar', 'wine', 'edit', 'journal'].includes(route().p)) U.infoBack = null; return; }
  U.infoBack = null;
  openInfo(x.kind, x.name, x.context);
  INFO.vAll = x.vAll;
  renderInfo();
  const b = $('#info-root .info-body');
  if (b && x.top) b.scrollTop = x.top;
}

/* your own wines with it, to open the cellar filtered */
function infoMine() {
  const k = INFO.kind, n = lc(INFO.name);
  const match = k === 'region' ? (x => lc(x.region) === n || regionKey(x) === lc(str(INFO.name).split(',')[0]))
    : k === 'grape' ? (x => grapeShares(Object.assign({}, x, { count: 1 })).some(g => lc(g.name) === n))
    : k === 'producer' ? (x => lc(x.producer) === n)
    : (x => x.profile && lc(x.profile.style) === n);
  const all = S.wines.filter(x => !isDisc(x) && match(x));
  const inStock = all.filter(x => x.count > 0);
  const go = k === 'grape' ? ['grape', INFO.name] : k === 'region' ? ['search', str(INFO.name).split(',')[0].trim()] : k === 'producer' ? ['search', INFO.name] : null;
  return { all, inStock, go };
}

/* ---------------------------------------------------------------- the background sheet: tiles, boxes and charts */

const factOf = (d, re) => d.facts.find(f => re.test(f.label));
/* key facts as tiles, two per row; a last single tile takes the full width */
function tilesHtml(list) {
  return list.length ? `<div class="ab-facts">${list.map((f, i) => `<div class="ab-fact${list.length % 2 && i === list.length - 1 ? ' wide' : ''}"><div><span>${esc(f.label)}</span><b>${f.html || esc(f.value)}</b></div></div>`).join('')}</div>` : '';
}
const boxHtml = (label, inner, cls) => `<div class="gi-box${cls ? ' ' + cls : ''}"><div class="gi-box-h"><span>${esc(label)}</span></div>${inner}</div>`;

/* ageing as a timeline in years after the vintage: everyday wines and the best wines */
function ageHtml(age, text) {
  const rows = [['Everyday', age.everyday, 'e'], ['Best wines', age.best, 'b'], ['Typical', age.typical, 'b']].filter(r => r[1]);
  const top = Math.max(...rows.map(r => r[1][1]));
  const end = Math.min(40, Math.max(10, top > 20 ? Math.ceil(top / 10) * 10 : Math.ceil(top / 5) * 5));
  const pos = v => `${Math.min(100, v / end * 100)}%`;
  const yrs = x => `${x[0]} to ${x[1] > end ? end + '+' : x[1]} years`;
  const row = ([label, x, cls]) => `<div class="gi-age-row"><span>${label}</span><span class="gi-age-tr"><i class="${cls}" style="left:${pos(x[0])};width:calc(${pos(Math.min(x[1], end))} - ${pos(x[0])})"></i></span><b>${yrs(x)}</b></div>`;
  const ticks = []; for (let y = 0; y <= end; y += end > 20 ? 10 : 5) ticks.push(`<em style="left:${pos(y)}">${y === end && top > end ? y + '+' : y}</em>`);
  return `<div class="gi-box gi-age"><div class="gi-box-h"><span>Ageing potential</span>${text ? `<b>${esc(text)}</b>` : ''}</div>
    ${rows.map(row).join('')}
    <div class="gi-age-row axis"><span></span><span class="gi-age-ax">${ticks.join('')}</span><b>years</b></div></div>`;
}
/* ageing written as text before the timeline existed, for example "3 to 10 years" or "drink within 2 years" */
function ageFromText(t) {
  const n = (str(t).match(/\d+/g) || []).map(Number).filter(x => x <= 100);
  if (n.length >= 2 && n[1] > n[0]) return { typical: [n[0], n[1]] };
  if (n.length === 1 && n[0] > 0) return { typical: [0, n[0]] };
  return null;
}

/* serving temperature on a thermometer from 4 to 22 °C */
const TH_LO = 4, TH_HI = 22;
function serveFromText(t) {
  let n = (str(t).match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (/°\s*F|\bF\b|fahrenheit/i.test(str(t)) && !/°\s*C/i.test(str(t))) n = n.map(x => Math.round((x - 32) * 5 / 9));
  n = n.filter(x => x >= 0 && x <= 25);
  return n.length ? [Math.min(...n), Math.max(...n)] : null;
}
function thermoColor(c) {
  const stops = [[4, [74, 144, 194]], [10, [120, 176, 196]], [14, [217, 178, 58]], [22, [194, 65, 79]]];
  let k = 0; while (k < stops.length - 2 && c > stops[k + 1][0]) k++;
  const [a, ca] = stops[k], [b, cb] = stops[k + 1], f = Math.max(0, Math.min(1, (c - a) / (b - a)));
  return `rgb(${ca.map((v, i) => Math.round(v + (cb[i] - v) * f)).join(',')})`;
}
function serveHtml(range, text) {
  const pos = v => `${(Math.max(TH_LO, Math.min(TH_HI, v)) - TH_LO) / (TH_HI - TH_LO) * 100}%`;
  const [lo, hi] = range, mid = (lo + hi) / 2;
  const deg = lo === hi ? `${lo}°C` : `${lo} to ${hi}°C`;
  const ticks = [5, 10, 15, 20].map(t => `<em style="left:${pos(t)}">${t}</em>`).join('');
  return `<div class="gi-box gi-serve"><div class="gi-box-h"><span>Serving temperature</span>${text && str(text).replace(/\s/g, '') !== deg.replace(/\s/g, '') ? `<b>${esc(text)}</b>` : ''}</div>
    <div class="gi-age-row"><span>Serve at</span><span class="th-tr" style="--bulb:${thermoColor(mid)}"><i style="left:${pos(lo)};width:max(10px, calc(${pos(hi)} - ${pos(lo)}));background:${thermoColor(mid)}"></i></span><b>${deg}</b></div>
    <div class="gi-age-row axis"><span></span><span class="gi-age-ax th-ax">${ticks}</span><b>°C</b></div></div>`;
}

/* the color of a grape as a dot: red, white or pink skinned */
const grapeDot = v => `<i class="fact-dot" style="background:${/white|green|yellow|blanc|golden/i.test(v) ? TYPE_CHART.White : /pink|grey|gray|gris|ros[eé]|copper/i.test(v) ? TYPE_CHART['Rosé'] : TYPE_CHART.Red}"></i>`;

/* grape names as chips: tap one to see your wines with it */
function cellarGrapes() {
  const m = new Map();
  S.wines.forEach(w => grapeShares(Object.assign({}, w, { count: 1 })).forEach(g => { const k = lc(g.name); m.set(k, (m.get(k) || 0) + 1); }));
  return m;
}
/* grapes, sub regions, villages and styles named in the text become chips; the number shows your matching wines, counted when the sheet opens */
const termNorm = v => str(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/* the whole term is compared, accents and punctuation do not matter: "Cote des Blancs" is not "Blanc de Blancs" */
const phraseNorm = v => ` ${termNorm(v).replace(/[^a-z0-9]+/g, ' ').trim()} `;
const hasPhrase = (fields, t) => { const n = phraseNorm(t); return n.trim() !== '' && fields.some(f => phraseNorm(f).includes(n)); };
/* words that would match almost every wine get no chip */
const TERM_GENERIC = new Set(['rose', 'red', 'white', 'sparkling', 'still', 'vintage', 'non vintage', 'nv', 'brut', 'extra brut', 'sweet', 'dry', 'off dry', 'dessert', 'fortified', 'blend', 'blends', 'cuvee', 'cuvees', 'prestige cuvee', 'prestige cuvees',
  'red wine', 'red wines', 'white wine', 'white wines', 'rose wine', 'rose wines', 'sparkling wine', 'sparkling wines', 'still wine', 'still wines', 'sweet wine', 'sweet wines', 'dry wine', 'dry wines', 'wine', 'wines', 'village', 'villages', 'regional']);
const termGeneric = x => x.k !== 'grape' && TERM_GENERIC.has(phraseNorm(x.t).trim());
/* which of your wines a term fits: grapes by the grapes, places by region, sub-region and classification, styles by style and name within this region */
function termMatch(w, x) {
  if (x.k === 'grape') return grapeShares(Object.assign({}, w, { count: 1 })).some(g => termNorm(g.name) === termNorm(x.t));
  const p = w.profile || {};
  if (x.k === 'style') return hasPhrase([p.style, w.name, p.classification], x.t) && (!x.region || hasPhrase([w.region, p.sub], x.region));
  return hasPhrase([w.region, p.sub, p.classification], x.t);
}
const termCount = x => S.wines.filter(w => !isDisc(w) && termMatch(w, x)).length;   // what the cellar shows when you tap it
function termChip(text, x, grapes, inline) {
  const n = termCount(x);
  const cls = `gi-chip${inline ? ' inline' : ''}`;
  return n ? `<button class="${cls} link" data-act="info-term" data-k="${x.k}" data-t="${esc(x.t)}" data-r="${esc(x.region || '')}">${text}<em>${n}</em></button>` : `<span class="${cls}">${text}</span>`;
}
function termText(t, terms, grapes) {
  const list = terms.filter(x => x.t && !termGeneric(x)).sort((a, b) => b.t.length - a.t.length);
  const out = esc(t);
  if (!list.length) return out;
  const by = new Map(list.map(x => [termNorm(esc(x.t)), x]));
  const re = new RegExp(`(^|[^\\p{L}])(${list.map(x => esc(x.t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=[^\\p{L}]|$)`, 'giu');
  return out.replace(re, (m0, pre, hit) => { const x = by.get(termNorm(hit)); return x ? pre + termChip(hit, x, grapes, true) : m0; });
}

/* where the region lies: its country drawn from Natural Earth outlines, kept in the app (world.json), no map service */
let WORLD = null;
function loadWorld() {
  if (!WORLD) WORLD = fetch('world.json').then(r => r.json()).then(raw => {
    const out = [];
    Object.entries(raw).forEach(([c, rings]) => rings.forEach(enc => {
      const pts = []; let x = 0, y = 0, x0 = 999, x1 = -999, y0 = 999, y1 = -999;
      for (let i = 0; i < enc.length; i += 2) { x += enc[i]; y += enc[i + 1]; const lon = x / 100, lat = y / 100; pts.push([lon, lat]); x0 = Math.min(x0, lon); x1 = Math.max(x1, lon); y0 = Math.min(y0, lat); y1 = Math.max(y1, lat); }
      out.push({ c, pts, box: [x0, y0, x1, y1] });
    }));
    return out;
  }).catch(e => { WORLD = null; throw e; });
  return WORLD;
}
function inRing(lon, lat, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function mapSvg(world, m, label) {
  const W = 340, H = 190, rDeg = Math.max(0.15, m.km / 2 / 111);
  const home = world.find(r => m.lon >= r.box[0] && m.lon <= r.box[2] && m.lat >= r.box[1] && m.lat <= r.box[3] && inRing(m.lon, m.lat, r.pts));
  const near = home ? world.filter(r => r.c === home.c && r.box[0] < home.box[2] + 3 && r.box[2] > home.box[0] - 3 && r.box[1] < home.box[3] + 3 && r.box[3] > home.box[1] - 3) : [];
  let [x0, y0, x1, y1] = home ? [Math.min(...near.map(r => r.box[0])), Math.min(...near.map(r => r.box[1])), Math.max(...near.map(r => r.box[2])), Math.max(...near.map(r => r.box[3]))] : [m.lon - 6, m.lat - 4, m.lon + 6, m.lat + 4];
  x0 = Math.min(x0, m.lon - rDeg * 1.5); x1 = Math.max(x1, m.lon + rDeg * 1.5); y0 = Math.min(y0, m.lat - rDeg); y1 = Math.max(y1, m.lat + rDeg);
  const k = Math.cos((y0 + y1) / 2 * Math.PI / 180);
  let w = (x1 - x0) * k, h = y1 - y0;
  if (w > 40) { x0 = m.lon - 20 / k; x1 = m.lon + 20 / k; w = 40; }
  if (h > 30) { y0 = m.lat - 15; y1 = m.lat + 15; h = 30; }
  let cx = (x0 + x1) / 2 * k, cy = -(y0 + y1) / 2;
  w *= 1.16; h *= 1.16;
  if (w / h > W / H) h = w * H / W; else w = h * W / H;
  const s = W / w, px = lon => ((lon * k - cx) * s + W / 2), py = lat => ((-lat - cy) * s + H / 2);
  const vx0 = cx / k - w / 2 / k, vx1 = cx / k + w / 2 / k, vy0 = -cy - h / 2, vy1 = -cy + h / 2;
  const seen = world.filter(r => r.box[0] < vx1 && r.box[2] > vx0 && r.box[1] < vy1 && r.box[3] > vy0);
  const path = r => 'M' + r.pts.map(([lo, la]) => `${px(lo).toFixed(1)} ${py(la).toFixed(1)}`).join('L') + 'Z';
  const other = seen.filter(r => !home || r.c !== home.c).map(path).join('');
  const own = home ? seen.filter(r => r.c === home.c).map(path).join('') : '';
  const X = px(m.lon), Y = py(m.lat), R = Math.max(6, rDeg * s);
  const right = X < W * 0.62;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path d="${other}" class="m-land"/><path d="${own}" class="m-home"/>
    <circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="${R.toFixed(1)}" class="m-area"/><circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="3.6" class="m-dot"/>
    <text x="${(right ? X + R + 6 : X - R - 6).toFixed(1)}" y="${(Y + 4).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}" class="m-label">${esc(label)}</text></svg>`;
}
function mapHtml(m, label) {
  return `<div class="gi-map" data-lat="${m.lat}" data-lon="${m.lon}" data-km="${m.km}" data-label="${esc(label)}"></div>`;
}
function drawMaps() {
  const els = [...document.querySelectorAll('.gi-map:not(.done)')];
  if (!els.length) return;
  loadWorld().then(world => els.forEach(el => {
    el.innerHTML = mapSvg(world, { lat: Number(el.dataset.lat), lon: Number(el.dataset.lon), km: Number(el.dataset.km) }, el.dataset.label);
    el.classList.add('done');
  })).catch(() => els.forEach(el => el.remove()));
}

/* what the sheet shows between the summary and the text, for each kind */
function infoTopHtml(d) {
  const k = INFO.kind;
  if (k === 'grape') {
    const age = d.ageing, ageF = factOf(d, /ageing|aging/i);
    const facts = d.facts.filter(f => !(age && f === ageF)).map(f => /^origin$/i.test(f.label) && d.originCountry ? Object.assign({}, f, { html: `<i class="gi-fflag">${flagEmoji(d.originCountry)}</i> ${esc(f.value)}` })
      : /^colou?r$/i.test(f.label) ? Object.assign({}, f, { html: `${grapeDot(f.value)}${esc(f.value)}` }) : f);
    const aka = (d.aka || []).length ? `<div class="gi-box gi-aka"><div class="gi-box-h"><span>Also known as</span><b>${esc(d.aka.join(', '))}</b></div></div>` : '';
    return `${aka}${tilesHtml(facts)}${age ? ageHtml(age, ageF && ageF.value) : ''}`;
  }
  if (k === 'region') {
    const c = countryOf({ region: INFO.name });
    const gF = factOf(d, /main grapes|grapes/i);
    const grapes = (d.grapes && d.grapes.length ? d.grapes : str(gF && gF.value).split(/,|\band\b/).map(x => x.trim()).filter(Boolean)).slice(0, 8);
    const facts = d.facts.filter(f => f !== gF).map(f => /^country$/i.test(f.label) && c ? Object.assign({}, f, { html: `<i class="gi-fflag">${flagEmoji(c.code)}</i> ${esc(f.value)}` }) : f);
    const mine = cellarGrapes();
    return `${d.map ? mapHtml(d.map, str(d.title || INFO.name).split(',')[0]) : ''}${tilesHtml(facts)}${grapes.length ? boxHtml('Main grapes', `<div class="gi-chips">${grapes.map(g => termChip(esc(g), { t: g, k: 'grape' }, mine)).join('')}</div>`) : ''}${vintChartHtml(INFO.name)}`;
  }
  if (k === 'style') {
    const sF = factOf(d, /serv/i), aF = factOf(d, /ageing|aging|keep/i);
    const serve = d.serve || (sF && serveFromText(sF.value));
    const age = d.ageing || (aF && ageFromText(aF.value));
    const facts = d.facts.filter(f => !(serve && f === sF) && !(age && f === aF));
    return `${tilesHtml(facts)}${serve ? serveHtml(serve, sF && sF.value) : ''}${age ? ageHtml(age, aF && aF.value) : ''}`;
  }
  if (k === 'producer') {
    const facts = d.facts.filter(f => !/farming/i.test(f.label));
    if (d.website) facts.push({ label: 'Website', html: `<a class="gi-web" href="${esc(d.website)}" target="_blank" rel="noopener">${esc(d.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''))}${ICON.link}</a>` });
    return `${d.map ? mapHtml(d.map, str(d.title || INFO.name)) : ''}${tilesHtml(facts)}${d.visits ? `<p class="gi-visit">${AB_ICON.producer}<span><b>Visits</b> ${esc(d.visits)}</span></p>` : ''}`;
  }
  return tilesHtml(d.facts);
}
function infoTextHtml(d) {
  const k = INFO.kind;
  const secs = k === 'grape' ? d.sections.filter(x => !/where it grows/i.test(x.h)) : d.sections;
  const grapes = k === 'region' ? cellarGrapes() : null;
  const region = str(d.title || INFO.name).split(',')[0].trim();
  const terms = grapes ? [...(d.terms || []).map(x => Object.assign({ region }, x)), ...(d.grapes || []).map(t => ({ t, k: 'grape' }))].filter((x, i, a) => a.findIndex(y => termNorm(y.t) === termNorm(x.t)) === i) : [];
  return secs.map(x => `<div class="info-sec"><h3>${esc(x.h)}</h3><p>${grapes ? termText(x.t, terms, grapes) : esc(x.t)}</p></div>`).join('');
}
function grapeChartsHtml(d) {
  const bar = (lead, name, pct, color) => `<div class="gi-bar">${lead}<span class="gi-name">${esc(name)}</span><span class="tr"><i style="width:${Math.max(3, pct)}%;background:${color}"></i></span><b>${pct}%</b></div>`;
  const used = (d.usedFor || []).map(x => bar(`<span class="gi-dot" style="background:${TYPE_CHART[x.type] || 'var(--gold)'}"></span>`, x.type, x.pct, TYPE_CHART[x.type] || 'var(--gold)'));
  const planted = (d.planted || []).map(x => bar(`<span class="gi-flag">${flagEmoji(x.country)}</span>`, countryName(x.country), x.pct, 'var(--gold)'));
  return `${used.length ? boxHtml('Mostly used for', used.join(''), 'gi-chart') : ''}
    ${planted.length ? boxHtml('Mostly planted', `${planted.join('')}<p class="tiny muted" style="margin:0">Approximate share of the world's vineyards planted with this grape${d.area ? `, ${esc(d.area)} in total` : ''}.</p>`, 'gi-chart') : ''}`;
}
function grapeMineHtml(mine) {
  const rated = mine.all.filter(x => x.myRating !== null);
  const avg = rated.length ? Math.round(rated.reduce((a, x) => a + x.myRating, 0) / rated.length) : null;
  const btl = mine.inStock.reduce((a, x) => a + x.count, 0);
  return `${mine.all.length ? `<div class="gi-sec"><h3>In your cellar</h3><div class="gi-mine"><div><b>${mine.all.length} wine${mine.all.length === 1 ? '' : 's'}</b><span class="small muted">${btl} bottle${btl === 1 ? '' : 's'} in stock${avg !== null ? ` · your rating ${avg}%` : ''}</span></div>${mine.go ? `<button class="btn ghost" data-act="info-mine">Show</button>` : ''}</div></div>` : ''}`;
}

/* the producer and you, from your own cellar and journal only: always the same rows, a dash where nothing is known yet */
function producerMineHtml(mine) {
  const n = lc(INFO.name);
  const tasted = S.wines.filter(x => isDisc(x) && lc(x.producer) === n);
  if (!mine.all.length && !tasted.length) return '<p class="pm-none">You have no wines from this producer yet.</p>';
  const ids = new Set(mine.all.map(x => x.id));
  const btl = mine.inStock.reduce((a, x) => a + x.count, 0);
  const rated = mine.all.filter(x => x.myRating !== null);
  const avg = rated.length ? Math.round(rated.reduce((a, x) => a + x.myRating, 0) / rated.length) : null;
  const moves = S.removals.filter(r => ids.has(r.wineId));
  const opened = moves.filter(isOpened).map(r => r.date).sort().pop();
  const buys = moves.filter(r => r.dir === 'in' && r.type === 'Purchase');
  const shops = [...buys.reduce((m, r) => (r.retailer ? m.set(r.retailer, (m.get(r.retailer) || 0) + (r.qty || 1)) : m), new Map())].sort((a, b) => b[1] - a[1]).map(x => x[0]);
  const priced = buys.filter(r => r.price !== null);
  const avgPrice = priced.length ? priced.reduce((a, r) => a + (conv(r.price, r.priceCur) || 0) * (r.qty || 1), 0) / priced.reduce((a, r) => a + (r.qty || 1), 0) : null;
  const recs = [...new Set(buys.flatMap(r => namesOf(r.people)))];
  const dash = '<span class="muted">–</span>';
  // chips like the terms in a background: the number is what the journal shows when you tap it
  const hits = (k, v) => moves.filter(r => (k === 'retailer' ? lc(r.retailer) === lc(v) : namesOf(r.people).some(x => lc(x) === lc(v)))).length;
  const links = (k, list) => `<span class="gi-chips pm-chips">${list.map(v => `<button class="gi-chip link" data-act="info-j" data-k="${k}" data-v="${esc(v)}">${esc(v)}<em>${hits(k, v)}</em></button>`).join('')}</span>`;
  const row = (k, v) => `<div class="pm-row"><span>${k}</span><b>${v || dash}</b></div>`;
  const byRating = list => list.slice().sort((a, b) => (b.myRating === null ? -1 : b.myRating) - (a.myRating === null ? -1 : a.myRating) || str(b.vintage).localeCompare(str(a.vintage)));
  const bar = x => `<a class="pm-bar" href="#/wine/${encodeURIComponent(x.id)}" data-act="info-wine"><span class="ellipsis">${esc(x.name || x.producer)} ${esc(x.vintage || '')}</span>${x.myRating !== null ? `${segsHtml(x.myRating, 6)}<b>${x.myRating}%</b>` : '<small class="muted pm-nr">Not rated yet</small>'}</a>`;
  return `<div class="gi-sec pm"><h3>With this producer</h3>
    <div class="pm-rows">
      ${row('Wines', mine.all.length ? `${mine.all.length} ${mine.all.length === 1 ? 'product' : 'products'}, ${btl ? `${btl} ${btl === 1 ? 'bottle' : 'bottles'} in your cellar` : 'none in your cellar now'}` : 'None in your cellar')}
      ${row('Your rating', avg !== null ? `${avg}% on average` : '')}
      ${row('Last opened', opened ? esc(fmtDate(opened)) : '')}
      ${row('Bought at', shops.length ? `${links('retailer', shops)}${avgPrice !== null ? `<small class="pm-sub">${esc(money(avgPrice))} per bottle on average</small>` : ''}` : '')}
      ${row('Recommended by', recs.length ? links('person', recs) : '')}
    </div>
    ${mine.all.length ? `<div class="pm-bars"><span class="tiny muted">Your wines</span>${byRating(mine.all).map(bar).join('')}</div>` : ''}
    ${tasted.length ? `<div class="pm-bars"><span class="tiny muted">Tasted elsewhere</span>${byRating(tasted).map(bar).join('')}</div>` : ''}
    ${mine.all.length && mine.go ? `<button class="btn ghost block" data-act="info-mine">${ICON.glass}Show in the cellar</button>` : ''}</div>`;
}

function renderInfo() {
  let root = $('#info-root');
  if (!root) { root = document.createElement('div'); root.id = 'info-root'; document.body.appendChild(root); }
  if (!INFO.kind) { root.innerHTML = ''; root.dataset.k = ''; return; }
  // the same background drawn again, for example when its vintages arrive: keep the place you read
  const was = root.querySelector('.info-body'), same = root.dataset.k === `${INFO.kind}|${INFO.name}`, top = was && same ? was.scrollTop : 0;
  const d = INFO.data;
  const label = { region: 'Region', grape: 'Grape', style: 'Style', producer: 'Producer' }[INFO.kind];
  const flag = INFO.kind === 'region' ? (() => { const c = countryOf({ region: INFO.name }); return c ? flagEmoji(c.code) : ''; })() : '';
  const mine = infoMine();
  const body = INFO.busy
    ? `<div class="info-wait"><p class="somm-wait">Looking up ${esc(INFO.name)}<span>.</span><span>.</span><span>.</span></p><p class="tiny muted" style="margin:0">Written once by AI, then kept for all your wines.</p></div>`
    : INFO.error ? `<p class="small" style="margin:0;color:var(--red, #E06C6C)">${esc(INFO.error)}</p>`
    : d ? `${d.summary ? `<p class="info-summary">${esc(d.summary)}</p>` : ''}
        ${infoTopHtml(d)}
        ${infoTextHtml(d)}
        ${INFO.kind === 'grape' ? grapeChartsHtml(d) : ''}
        <p class="tiny muted" style="margin:0">Written by AI from its knowledge, kept for all your wines.</p>` : '';
  const yours = INFO.kind === 'grape' ? (d && !INFO.busy ? grapeMineHtml(mine) : '') : INFO.kind === 'producer' ? (INFO.busy ? '' : producerMineHtml(mine)) : mine.all.length && mine.go
    ? `<button class="btn ghost block" data-act="info-mine">${ICON.glass}Your wines: ${mine.all.length}${mine.inStock.length !== mine.all.length ? `, ${mine.inStock.length} in stock` : ''}</button>` : '';
  root.innerHTML = `<div class="sheet-backdrop" data-act="info-close"></div>
  <div class="sheet info-sheet" role="dialog" aria-modal="true" aria-label="${esc(INFO.name)}">
    <div class="between" style="align-items:flex-start;gap:12px">
      <div class="info-head"><span class="ab-ic">${flag ? `<span class="ab-flag">${flag}</span>` : INFO_ICON[INFO.kind]()}</span><div><span class="tiny muted" style="text-transform:uppercase;letter-spacing:.06em">${label}</span><h2>${esc(d && d.title ? d.title : INFO.name)}</h2></div></div>
      <button class="icon-btn" data-act="info-close" aria-label="Close">${ICON.x}</button>
    </div>
    <div class="info-body">${body}${yours}</div>
  </div>`;
  root.dataset.k = `${INFO.kind}|${INFO.name}`;
  if (top) { const b = root.querySelector('.info-body'); if (b) b.scrollTop = top; }
  const sh = root.querySelector('.info-sheet'); if (sh && same) sh.style.animation = 'none';
  drawMaps();
  vintScroll();
}

/* ---------------------------------------------------------------- background written ahead, so the rows open at once */

function infoItems(w) {
  const out = [];
  if (w.region) out.push({ kind: 'region', name: w.region });
  grapeShares(Object.assign({}, w, { count: 1 })).forEach(g => out.push({ kind: 'grape', name: g.name }));
  if (w.profile && w.profile.style) out.push({ kind: 'style', name: w.profile.style, context: w.region });
  if (w.producer) out.push({ kind: 'producer', name: w.producer, context: w.region });
  if (w.region && w.vintage && vintOk()) out.push({ kind: 'vintages', name: w.region, context: vintContext(w.region) });
  return out;
}
/* returns how many were written and how many could not be written now (those are written when opened) */
async function fillInfos(wines, progress) {
  const out = { todo: 0, done: 0, failed: 0 };
  if (S.version && S.version < 20) return out;
  const have = infoCache(), seen = new Set(), todo = [];
  wines.forEach(w => infoItems(w).forEach(x => { const k = infoKey(x.kind, x.name, x.context); if (seen.has(k) || (have[k] && !infoOld(x.kind, have[k]))) return; seen.add(k); todo.push(Object.assign({ key: k }, x)); }));
  out.todo = todo.length;
  for (let i = 0; i < todo.length; i += 8) {
    if (progress) progress(i, todo.length);
    const part = todo.slice(i, i + 8);
    let infos = {};
    try {
      const d = await api('infoFill', { items: part.map(({ kind, name, context }) => ({ kind, name, context })) });
      infos = d.infos || {};
      Object.keys(infos).forEach(k => infoRemember(k, infos[k]));
    } catch (e) { if (/Unknown action/i.test(e.message)) { out.failed += todo.length - i; return out; } }
    part.forEach(x => { const d = infos[x.key]; if (d && !infoOld(x.kind, d)) out.done++; else out.failed++; });
  }
  return out;
}

/* ---------------------------------------------------------------- vintage chart of a region and your vintages of a wine
   The AI rates the last 15 vintages of a region once a year, from 1 (poor) to 5 (outstanding), with a few words each. */

const VQ_WORDS = ['Poor', 'Fair', 'Good', 'Very good', 'Outstanding'];
const vqColor = q => SEG_COLORS[Math.min(19, q * 4 - 1)];
const vqBarHtml = (q, small) => `<span class="vq-bar${small ? ' sm' : ''}" role="img" aria-label="${VQ_WORDS[q - 1]}">${[1, 2, 3, 4, 5].map(i => `<i style="background:${i <= q ? vqColor(q) : '#45232F'}"></i>`).join('')}</span>`;
const vintOk = () => !(S.version && S.version < 47);
const VINT_BUSY = new Set(), VINT_FAIL = new Set();
const vintSameRegion = (w, region) => lc(w.region) === lc(region) || regionKey(w) === infoFirst(region);
/* older vintages in the cellar than the 15 years of the chart are rated as well */
function vintContext(region) {
  const old = new Date().getFullYear() - 15;
  return [...new Set(S.wines.filter(w => !isDisc(w) && vintSameRegion(w, region) && Number(w.vintage) && Number(w.vintage) < old).map(w => String(w.vintage)))].sort().join(', ');
}
function vintData(region) { return region ? infoCache()[infoKey('vintages', region)] || null : null; }
function vintOf(region, year) {
  const d = vintData(region);
  return d && year ? (d.vintages || []).find(v => String(v.y) === String(year)) || null : null;
}
async function vintLoad(region) {
  if (!region || !vintOk()) return;
  const key = infoKey('vintages', region), hit = vintData(region);
  if ((hit && !infoOld('vintages', hit)) || VINT_BUSY.has(key) || VINT_FAIL.has(key)) return;
  VINT_BUSY.add(key);
  try {
    const d = await api('info', { kind: 'vintages', name: region, context: vintContext(region) });
    if (d.info) infoRemember(key, d.info); else VINT_FAIL.add(key);
  } catch (e) { VINT_FAIL.add(key); }
  VINT_BUSY.delete(key);
  if (INFO.kind === 'region') renderInfo();
  if (route().p === 'wine') refreshView();
}
const vintLater = region => setTimeout(() => vintLoad(region));

/* in the region background, after the tiles: the last 8 vintages, the full list on a tap.
   Opened from a wine, its year is marked and shown. */
const VQ_SHOW = 8;
function vintChartHtml(region) {
  if (!vintOk() || !region) return '';
  const key = infoKey('vintages', region), d = vintData(region);
  if (!d || infoOld('vintages', d)) vintLater(region);
  const head = '<h3>Vintages</h3>';
  if (!d) return VINT_FAIL.has(key) ? '' : `<div class="info-sec vq-sec">${head}<p class="small muted">Rating the vintages of this region…</p></div>`;
  const all = d.vintages || [];
  const focus = INFO.vFocus;
  const full = INFO.vAll || (focus && all.findIndex(v => String(v.y) === focus) >= VQ_SHOW);
  const list = full ? all : all.slice(0, VQ_SHOW);
  const mine = {};
  S.wines.filter(w => !isDisc(w) && w.count > 0 && vintSameRegion(w, region) && w.vintage).forEach(w => { mine[w.vintage] = (mine[w.vintage] || 0) + 1; });
  const rows = list.map(v => `<div class="vq-row${String(v.y) === focus ? ' on' : ''}" id="vq-${v.y}"><b class="vq-y">${v.y}</b>${vqBarHtml(v.q, true)}<div class="vq-mid"><span class="vq-w">${VQ_WORDS[v.q - 1]}${mine[v.y] ? ` · <button class="vq-mine" data-act="vint-mine" data-y="${v.y}">${mine[v.y]} in your cellar</button>` : ''}</span>${v.t ? `<span class="tiny muted">${esc(v.t)}</span>` : ''}</div></div>`).join('');
  const toggle = all.length > VQ_SHOW ? `<button class="link-btn vq-all" data-act="vint-all">${full ? 'Show fewer' : `Show all ${all.length} vintages`}${ICON.chevron}</button>` : '';
  return `<div class="info-sec vq-sec">${head}${d.note ? `<p class="small muted">${esc(d.note)}</p>` : ''}<div class="vq-list">${rows}</div>${toggle}<p class="tiny muted" style="margin:6px 0 0">Rated by AI from vintage charts and critics, for the good wines of the region. Single wines can differ.</p></div>`;
}
/* from a wine: the region with its map, scrolled to the year */
function openVintage(region, year) {
  openInfo('region', region);
  INFO.vFocus = String(year);
  INFO.vScroll = true;
  renderInfo();
}
function vintScroll() {
  if (!INFO.vScroll) return;
  const el = $('#vq-' + INFO.vFocus);
  if (!el) return;
  INFO.vScroll = false;
  setTimeout(() => el.scrollIntoView({ block: 'center' }), 60);
}

/* More about this wine: how the year was in the region */
function vintFactHtml(w, p) {
  const vq = vintOf(w.region, w.vintage);
  if (w.region && w.vintage) vintLater(w.region);
  const text = p.vintageNote || (vq ? vq.t : '');
  if (!text && !vq) return '';
  const label = w.vintage ? `Vintage ${w.vintage}${w.region ? ` in ${str(w.region).split(',')[0]}` : ''}` : 'Vintage';
  const inner = `${AB_ICON.vintage}<div><span>${esc(label)}</span>${vq ? `<span class="vq-line">${vqBarHtml(vq.q, true)}<b>${VQ_WORDS[vq.q - 1]}</b></span>` : ''}<b>${esc(text)}</b></div>`;
  return w.region && vintOk() ? `<button class="ab-fact wide vq-fact" data-act="vint-open" data-r="${esc(w.region)}" data-y="${esc(w.vintage)}">${inner}${ICON.chevron}</button>` : `<div class="ab-fact wide">${inner}</div>`;
}

/* the same wine in several vintages: quality of the year, drinking phase, stock and your rating, and which to open first */
function vintCompareHtml(w) {
  if (isDisc(w) || !w.vintage) return '';
  const sibs = S.wines.filter(x => !isDisc(x) && x.vintage && lc(x.producer) === lc(w.producer) && lc(x.name) === lc(w.name))
    .sort((a, b) => Number(b.vintage) - Number(a.vintage));
  if (new Set(sibs.map(x => String(x.vintage))).size < 2) return '';
  const region = w.region || (sibs.find(x => x.region) || {}).region;
  if (region) vintLater(region);
  const open = sibs.filter(x => x.count > 0 && windowParts(x)).sort(urgencyCmp);
  const first = open.length > 1 ? open[0] : null;
  const line = first ? statusLine(first) : '';
  const rows = sibs.map(x => {
    const vq = vintOf(x.region || region, x.vintage), s = x.count > 0 ? statusOf(x) : '';
    return `<a class="vc-row${x.id === w.id ? ' cur' : ''}" href="#/wine/${encodeURIComponent(x.id)}"${x.id === w.id ? ' aria-current="page"' : ''}>
      <b class="vc-y">${esc(x.vintage)}</b>
      <span class="vc-q">${vq ? `${vqBarHtml(vq.q, true)}<small>${VQ_WORDS[vq.q - 1]}</small>` : '<small class="muted">Not rated</small>'}</span>
      <span class="vc-s">${s ? `<span class="dot" style="--c:${STATUS[s].c}"></span><small>${esc(s)}</small>` : '<small class="muted">Finished</small>'}</span>
      <span class="vc-n"><small>${x.count} btl</small>${x.myRating !== null ? `<small class="muted">${x.myRating}%</small>` : ''}</span></a>`;
  }).join('');
  return `<section><div class="sec-head"><h2>Your vintages of this wine</h2><span class="small muted">${sibs.length}</span></div>
    ${first ? `<p class="vc-rec">${ICON.glass}<span>Open <b>${esc(first.vintage)}</b> first: ${esc(line.charAt(0).toLowerCase() + line.slice(1))}.</span></p>` : ''}
    <div class="card vc-list">${rows}</div>
    ${region && vintOk() ? `<button class="link-btn vc-chart" data-act="vint-open" data-r="${esc(region)}" data-y="${esc(w.vintage)}">${AB_ICON.vintage}Vintages in ${esc(str(region).split(',')[0])}${ICON.chevron}</button>` : ''}
    <p class="muted tiny" style="margin:0">Quality of the year in the region, rated by AI. Tap a vintage to open the wine.</p></section>`;
}
