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

const AXES = [
  ['body', 'Light', 'Bold'],
  ['tannin', 'Smooth', 'Tannic'],
  ['sweet', 'Dry', 'Sweet'],
  ['acid', 'Soft', 'Fresh']
];

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
    closure: t(p.closure), vineyard: t(p.vineyard), vintageNote: t(p.vintageNote), typical: p.typical === true
  };
}
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
  if (w.grapes) {
    const g = mainGrape(w);
    rows.push(abRow(AB_ICON.grape, w.grapes, p && p.typical ? 'Typical blend, not stated for this wine' : '', g ? likeHint('grape', w, x => lc(mainGrape(x))) : null, g ? ['grape', g] : null));
  }
  if (w.producer) rows.push(abRow(AB_ICON.producer, w.producer, p ? p.producerLine : '', likeHint('producer', w, x => lc(x.producer)), ['producer', w.producer, w.region]));
  if (!rows.length) return '';
  const more = p && (p.about || p.classification || p.alcohol || p.ageing || p.closure || p.vineyard || p.vintageNote);
  const open = U.aboutOpen === w.id;
  return `<section style="gap:12px"><h2>About this wine</h2>
    <div class="ab-list">${rows.join('')}
      ${more ? `<button class="ab-more" data-act="about-more" aria-expanded="${open}">${open ? 'Less about this wine' : 'More about this wine'}${ICON.chevron}</button>`
        : hasProfile(w) ? '' : `<button class="ab-more" data-act="profile-one" data-id="${esc(w.id)}"${PROF.busy ? ' disabled' : ''}>${PROF.one === w.id ? 'Adding taste profile and background…' : 'Add taste profile and background with AI'}${ICON.spark}</button>`}
    </div>${more && open ? moreHtml(w) : ''}</section>`;
}

function moreHtml(w) {
  const p = w.profile;
  const fact = (k, label, val, wide) => (val ? `<div class="ab-fact${wide ? ' wide' : ''}">${AB_ICON[k]}<div><span>${esc(label)}</span><b>${esc(val)}</b></div></div>` : '');
  const facts = [
    fact('classification', 'Classification', p.classification),
    fact('alcohol', 'Alcohol', p.alcohol ? `${fmtNum(p.alcohol, p.alcohol % 1 ? 1 : 0)}%` : ''),
    fact('ageing', 'Ageing', p.ageing),
    fact('closure', 'Closure', p.closure),
    fact('vineyard', 'Vineyard and soil', p.vineyard, true),
    fact('vintage', w.vintage ? `Vintage ${w.vintage}${w.region ? ` in ${str(w.region).split(',')[0]}` : ''}` : 'Vintage', p.vintageNote, true)
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
  const center = rows.length === 1 ? ['100%', 'grape'] : [String(rows.length), 'grapes'];
  return `<div class="tp-block"><p class="tp-lead">Grapes${w.profile && w.profile.typical ? ' · typical blend' : ''}</p>${donut(rows, 100, { label: 'Grapes', pctOnly: true, center, wrap: true })}</div>`;
}

function axesHtml(w) {
  const p = w.profile;
  if (!p) return '';
  const color = TYPE_CHART[w.type] || TYPE_CHART.Red;
  const rows = AXES.filter(([k]) => p[k]).map(([k, l, r]) => {
    const v = p[k], pos = (v - 1) / 4 * 100;
    return `<div class="tp-row" role="img" aria-label="${l} to ${r}: ${v} of 5"><span class="${v <= 2 ? 'on' : ''}">${l}</span><div class="tp-track">${[0, 1, 2, 3, 4].map(i => `<i class="tp-tick" style="left:${i * 25}%"></i>`).join('')}<i class="tp-fill" style="width:${pos}%"></i><i class="tp-dot" style="left:${pos}%"></i></div><span class="${v >= 4 ? 'on' : ''}">${r}</span></div>`;
  });
  return rows.length ? `<div class="tp-scales" style="--wc:${color}">${rows.join('')}</div>` : '';
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
      ${missing ? `<div class="tp-missing"><p class="small muted" style="margin:0">No taste profile yet: taste axes, main aromas and the background of the wine.</p><button class="btn ghost" data-act="profile-one" data-id="${esc(w.id)}"${PROF.busy ? ' disabled' : ''}>${ICON.spark}${PROF.one === w.id ? 'Adding…' : 'Add taste profile with AI'}</button></div>` : ''}
      ${!w.grapes && !w.taste && !w.pairings.length && !p ? `<p class="muted small" style="margin:0">No profile yet. <a href="${editHref}">Edit</a> to add grapes, taste and food pairings.</p>` : ''}
    </section>`;
}

/* ---------------------------------------------------------------- filling profiles with AI */

const PROF = { busy: false, one: null, done: 0, total: 0, failed: 0 };
const PROF_BATCH = 5;

function applyProfiles(rows) {
  (rows || []).forEach(r => {
    const i = S.wines.findIndex(x => x.id === r.id);
    if (i >= 0) S.wines[i] = normWine(Object.assign({}, serialWine(S.wines[i]), { grapes: r.grapes, profile: r.profile, updatedAt: r.updatedAt }));
  });
  persist();
}

async function profileOne(id) {
  if (PROF.busy) return;
  PROF.busy = true; PROF.one = id;
  refreshView();
  try {
    const d = await api('profiles', { ids: [id] });
    applyProfiles(d.wines);
    if (!d.wines || !d.wines.length) toast('No taste profile found for this wine. Try again later.');
  } catch (e) { toast(/Unknown action/i.test(e.message) ? 'Taste profiles need the new Code.gs.' : aiErr(e.message)); }
  PROF.busy = false; PROF.one = null;
  refreshView();
}

async function profileAll() {
  if (PROF.busy) return;
  const todo = S.wines.filter(w => !hasProfile(w)).sort((a, b) => (b.count > 0) - (a.count > 0)).map(w => w.id);
  if (!todo.length) { toast('All wines have a taste profile.'); return; }
  Object.assign(PROF, { busy: true, done: 0, total: todo.length, failed: 0 });
  refreshView();
  try {
    for (let i = 0; i < todo.length; i += PROF_BATCH) {
      const d = await api('profiles', { ids: todo.slice(i, i + PROF_BATCH) });
      applyProfiles(d.wines);
      PROF.done = Math.min(todo.length, i + PROF_BATCH);
      PROF.failed += (d.failed || []).length;
      const el = $('#prof-progress');
      if (el) el.textContent = `${PROF.done} of ${PROF.total} wines done…`;
    }
    toast(PROF.failed ? `Done. ${PROF.failed} ${PROF.failed === 1 ? 'wine' : 'wines'} could not be profiled, try again later.` : 'All taste profiles added.');
  } catch (e) { toast(/Unknown action/i.test(e.message) ? 'Taste profiles need the new Code.gs.' : aiErr(e.message)); }
  PROF.busy = false;
  refreshView();
}

function profilesBoxHtml() {
  const all = S.wines.length, missing = S.wines.filter(w => !hasProfile(w)).length;
  return `<section class="box"><span class="box-title">Taste profiles</span>
    <p class="small" style="margin:0">${all - missing} of ${all} wines have a taste profile with taste axes, main aromas, food categories and background.</p>
    ${PROF.busy && !PROF.one ? `<p class="small" id="prof-progress" style="margin:0">${PROF.done} of ${PROF.total} wines done…</p>` : ''}
    <button class="btn accent block" data-act="profile-all"${PROF.busy || !missing ? ' disabled' : ''}>${ICON.spark}${missing ? `Add taste profiles for ${missing} ${missing === 1 ? 'wine' : 'wines'}` : 'All wines have a taste profile'}</button>
    <p class="muted tiny" style="margin:0">Costs about 2 cents per wine. Keep the app open while it runs. New wines get their profile when the label is read.</p></section>`;
}

/* ---------------------------------------------------------------- edit */

function profileEditorHtml() {
  const p = D.profile;
  const axis = ([k, l, r]) => `<div class="tpe-row"><span>${l}</span><div class="tpe-dots">${[1, 2, 3, 4, 5].map(v => `<button class="${p[k] === v ? 'on' : ''}" data-act="tp-set" data-k="${k}" data-v="${v}" aria-label="${l} to ${r}: ${v} of 5"></button>`).join('')}</div><span>${r}</span></div>`;
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
const infoKey = (kind, name, context) => `${kind}|${lc(name)}${kind === 'producer' && context ? `|${lc(context)}` : ''}`;
function infoCache() { try { return JSON.parse(localStorage.getItem('wc-info') || '{}'); } catch (e) { return {}; } }
function infoRemember(key, data) { try { const c = infoCache(); c[key] = data; localStorage.setItem('wc-info', JSON.stringify(c)); } catch (e) { /* kept for this session */ } }

async function openInfo(kind, name, context) {
  Object.assign(INFO, { kind, name, context: context || '', data: null, busy: false, error: '' });
  const key = infoKey(kind, name, context);
  const hit = infoCache()[key];
  if (hit) { INFO.data = hit; renderInfo(); return; }
  INFO.busy = true;
  renderInfo();
  try {
    const d = await api('info', { kind, name, context: context || '' });
    if (INFO.kind !== kind || INFO.name !== name) return;
    INFO.data = d.info;
    if (d.info) infoRemember(key, d.info); else INFO.error = `No background found on ${name}.`;
  } catch (e) {
    INFO.error = /Unknown action/i.test(e.message) ? 'The background needs the new Code.gs.' : aiErr(e.message);
  }
  INFO.busy = false;
  renderInfo();
}
function closeInfo() { INFO.kind = null; renderInfo(); }

/* your own wines with it, to open the cellar filtered */
function infoMine() {
  const k = INFO.kind, n = lc(INFO.name);
  const match = k === 'region' ? (x => lc(x.region) === n || regionKey(x) === lc(str(INFO.name).split(',')[0]))
    : k === 'grape' ? (x => grapeShares(Object.assign({}, x, { count: 1 })).some(g => lc(g.name) === n))
    : k === 'producer' ? (x => lc(x.producer) === n)
    : (x => x.profile && lc(x.profile.style) === n);
  const all = S.wines.filter(match);
  const inStock = all.filter(x => x.count > 0);
  const go = k === 'grape' ? ['grape', INFO.name] : k === 'region' ? ['search', str(INFO.name).split(',')[0].trim()] : k === 'producer' ? ['search', INFO.name] : null;
  return { all, inStock, go };
}

function renderInfo() {
  let root = $('#info-root');
  if (!root) { root = document.createElement('div'); root.id = 'info-root'; document.body.appendChild(root); }
  if (!INFO.kind) { root.innerHTML = ''; return; }
  const d = INFO.data;
  const label = { region: 'Region', grape: 'Grape', style: 'Style', producer: 'Producer' }[INFO.kind];
  const flag = INFO.kind === 'region' ? (() => { const c = countryOf({ region: INFO.name }); return c ? flagEmoji(c.code) : ''; })() : '';
  const mine = infoMine();
  const body = INFO.busy
    ? `<div class="info-wait"><p class="somm-wait">Looking up ${esc(INFO.name)}<span>.</span><span>.</span><span>.</span></p><p class="tiny muted" style="margin:0">Written once by AI, then kept for all your wines.</p></div>`
    : INFO.error ? `<p class="small" style="margin:0;color:var(--red, #E06C6C)">${esc(INFO.error)}</p>`
    : d ? `${d.summary ? `<p class="info-summary">${esc(d.summary)}</p>` : ''}
        ${d.facts.length ? `<div class="ab-facts">${d.facts.map((f, i) => `<div class="ab-fact${d.facts.length % 2 && i === d.facts.length - 1 ? ' wide' : ''}"><div><span>${esc(f.label)}</span><b>${esc(f.value)}</b></div></div>`).join('')}</div>` : ''}
        ${d.sections.map(x => `<div class="info-sec"><h3>${esc(x.h)}</h3><p>${esc(x.t)}</p></div>`).join('')}
        <p class="tiny muted" style="margin:0">Written by AI from its knowledge, kept for all your wines.</p>` : '';
  const yours = mine.all.length && mine.go
    ? `<button class="btn ghost block" data-act="info-mine">${ICON.glass}Your wines: ${mine.all.length}${mine.inStock.length !== mine.all.length ? `, ${mine.inStock.length} in stock` : ''}</button>` : '';
  root.innerHTML = `<div class="sheet-backdrop" data-act="info-close"></div>
  <div class="sheet info-sheet" role="dialog" aria-modal="true" aria-label="${esc(INFO.name)}">
    <div class="between" style="align-items:flex-start;gap:12px">
      <div class="info-head"><span class="ab-ic">${flag ? `<span class="ab-flag">${flag}</span>` : INFO_ICON[INFO.kind]()}</span><div><span class="tiny muted" style="text-transform:uppercase;letter-spacing:.06em">${label}</span><h2>${esc(d && d.title ? d.title : INFO.name)}</h2></div></div>
      <button class="icon-btn" data-act="info-close" aria-label="Close">${ICON.x}</button>
    </div>
    <div class="info-body">${body}${yours}</div>
  </div>`;
}
