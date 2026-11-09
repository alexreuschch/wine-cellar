'use strict';

/* Vintary: the label and the bottle. A camera with a label frame, unrolling a label from a round bottle,
   a drawn bottle per wine and a drawn label for wines without a photo. Loaded after form.js. */

/* ---------------------------------------------------------------- drawn bottle
   Drawn from the measures of real bottles, all in one scale: the profile is [cm from the top, half width in cm].
   1 cm = 9.6 units in a box of 160 x 360, standing on the ground at 352. */

const BT_K = 9.6, BT_G = 352;
const BOTTLES = {
  bordeaux: { name: 'Bordeaux', wines: 'Bordeaux, Rioja, Cabernet, Merlot, most reds', h: 30, cap: 5.5, fill: 7.6,
    p: [[0, 1.5], [0.6, 1.5], [0.7, 1.35], [8.2, 1.4], [9.2, 1.75], [10.1, 2.9], [10.8, 3.55], [11.6, 3.75], [29.2, 3.75], [29.8, 3.5], [30, 3.1]], label: [16, 25.5] },
  burgundy: { name: 'Burgundy', wines: 'Burgundy, Pinot Noir, Chardonnay, Rhône, Loire, Barolo', h: 29.5, cap: 5.5, fill: 7.2,
    p: [[0, 1.55], [0.6, 1.55], [0.7, 1.4], [7, 1.45], [9, 1.9], [11, 2.75], [13, 3.5], [15, 3.95], [16.5, 4.1], [28.8, 4.1], [29.3, 3.8], [29.5, 3.3]], label: [17.5, 26.5] },
  flute: { name: 'Alsace flute', wines: 'Riesling, Alsace, Mosel, Austria', h: 35, cap: 7, fill: 9,
    p: [[0, 1.45], [0.6, 1.45], [0.7, 1.3], [8, 1.35], [12, 1.75], [16, 2.3], [20, 2.9], [23, 3.35], [24.5, 3.5], [34.4, 3.5], [34.8, 3.2], [35, 2.8]], label: [25.5, 32.5] },
  champagne: { name: 'Champagne', wines: 'Champagne and other sparkling wines', h: 30.5, cap: 11, foil: true, fill: 8,
    p: [[0, 1.6], [1, 1.6], [1.1, 1.45], [6, 1.55], [9, 2.2], [12, 3.1], [15, 3.9], [17, 4.3], [18, 4.4], [29.8, 4.4], [30.3, 4], [30.5, 3.4]], label: [19.5, 26.5] },
  provence: { name: 'Provence', wines: 'Rosé from Provence, curved like a skittle', h: 30, cap: 5, fill: 7.2,
    p: [[0, 1.5], [0.6, 1.5], [0.7, 1.35], [7, 1.4], [10, 1.95], [14, 2.95], [18, 3.6], [21, 3.85], [24, 3.55], [26.5, 3.15], [28.2, 3.2], [29.6, 3.45], [30, 3.05]], label: [16.5, 23.5] },
  bocksbeutel: { name: 'Bocksbeutel', wines: 'Franken, Silvaner, Mateus', h: 22.5, cap: 4.5, fill: 5.4, round: true,
    p: [[0, 1.5], [0.6, 1.5], [0.7, 1.35], [5.4, 1.4], [6.4, 1.85], [7.5, 3.2], [9, 5], [11, 6.5], [13.5, 7.35], [15.5, 7.5], [17.5, 7.15], [19.5, 6.3], [21.2, 5.1], [22.2, 4.3], [22.5, 4]], label: [11.8, 19.4] },
  port: { name: 'Port and Sherry', wines: 'Port, Madeira, Sherry, with a bulge on the neck', h: 30, cap: 4, fill: 7.8,
    p: [[0, 1.65], [0.6, 1.65], [0.7, 1.4], [3.4, 1.42], [4.6, 1.8], [5.8, 1.42], [8.4, 1.48], [9.4, 1.85], [10.4, 3], [11.2, 3.7], [12, 3.85], [29.3, 3.85], [29.8, 3.5], [30, 3.1]], label: [15.5, 25] },
  clavelin: { name: 'Clavelin', wines: 'Vin Jaune from the Jura, squat, 62 cl', h: 21, cap: 4, fill: 4.6,
    p: [[0, 1.5], [0.6, 1.5], [0.7, 1.35], [4.8, 1.4], [5.8, 1.95], [6.6, 3.3], [7.3, 3.8], [20.4, 3.8], [20.8, 3.5], [21, 3.1]], label: [10, 17.5] },
  tokaji: { name: 'Tokaji and dessert', wines: 'Tokaji, ice wine, sweet wines, slim and tall', h: 30, cap: 6, fill: 9.5,
    p: [[0, 1.3], [0.6, 1.3], [0.7, 1.15], [10, 1.2], [11.5, 1.7], [12.8, 2.65], [13.6, 3.05], [29.4, 3.05], [29.8, 2.8], [30, 2.4]], label: [18, 26] },
  fiasco: { name: 'Chianti fiasco', wines: 'Traditional Chianti in straw', h: 31, cap: 4.5, fill: 9.5, straw: 17,
    p: [[0, 1.4], [0.6, 1.4], [0.7, 1.25], [10.5, 1.4], [13, 2.3], [15, 3.7], [17, 5], [20, 6.2], [23, 6.5], [26, 6], [28, 4.9], [29.2, 3.8], [30, 3.4], [31, 3.4]], label: [12.4, 14.8] }
};
const BOTTLE_NAMES = Object.fromEntries(Object.keys(BOTTLES).map(k => [k, BOTTLES[k].name]));
/* the glass colours the glassworks really make; clear glass shows the wine */
const GLASSES = {
  black: { name: 'Black', c: ['#26271F', '#0C0D0A'] },
  green: { name: 'Dark green', c: ['#2E4A2B', '#132416'] },
  olive: { name: 'Olive green', c: ['#47431F', '#1F1D0A'] },
  light: { name: 'Light green', c: ['#86A262', '#506A38'] },
  amber: { name: 'Amber', c: ['#83501E', '#462809'] },
  clear: { name: 'Clear', c: ['#E7ECE4', '#AEB8B0'] }
};
const WINE_IN_GLASS = { Red: ['#6A1424', '#3A0812'], White: ['#EADB8E', '#C9B45C'], 'Rosé': ['#EE9C9E', '#C96A72'], Sparkling: ['#EADFA2', '#C7B66A'], Dessert: ['#DFA83E', '#A9721A'], Fortified: ['#7A3418', '#40160A'], Orange: ['#E09A48', '#A8641C'] };

/* the usual bottle for the type, region and grapes; a shape chosen in Edit wins */
function bottleAuto(w) {
  const t = `${w.type || ''} ${w.region || ''} ${w.grapes || ''} ${w.name || ''}`;
  if (/fiasco/i.test(t)) return 'fiasco';
  if (w.type === 'Sparkling' || /champagne|\bcava\b|franciacorta|cr[ée]mant|prosecco|\bsekt\b/i.test(t)) return 'champagne';
  if (w.type === 'Fortified' || /\bport\b|\bporto\b|madeira|sherry|jerez/i.test(t)) return 'port';
  if (/vin jaune|ch[âa]teau-chalon/i.test(t)) return 'clavelin';
  if (/tokaj|eiswein|ice ?wine/i.test(t)) return 'tokaji';
  if (w.type === 'Rosé' && /provence|bandol|c[ôo]tes de provence/i.test(t)) return 'provence';
  if (/franken|bocksbeutel|w[üu]rzburg|silvaner/i.test(t)) return 'bocksbeutel';
  if (/riesling|alsace|elsass|mosel|gew[üu]rz|rheingau|pfalz|nahe|wachau|kamptal|gr[üu]ner/i.test(t)) return 'flute';
  if (/burgund|bourgogne|pinot noir|chardonnay|rh[ôo]ne|syrah|chasselas|nebbiolo|barolo|barbaresco|beaujolais|loire|sancerre/i.test(t)) return 'burgundy';
  return 'bordeaux';
}
const bottleShapeOf = w => (w.profile && BOTTLES[w.profile.bottle] ? w.profile.bottle : bottleAuto(w));
function glassAuto(w, shape) {
  const k = shape || bottleShapeOf(w);
  if (w.type === 'Fortified' || k === 'port') return 'black';
  if (['Rosé', 'Dessert', 'Orange'].includes(w.type) || k === 'tokaji' || k === 'provence') return 'clear';
  if (w.type === 'Sparkling' || k === 'clavelin') return 'olive';
  if (w.type === 'White') return 'light';
  return k === 'burgundy' ? 'olive' : 'green';
}
const glassOf = (w, shape) => (w.profile && GLASSES[w.profile.glass] ? w.profile.glass : glassAuto(w, shape));

/* a smooth outline through the profile points, mirrored */
function btPath(b) {
  const top = BT_G - b.h * BT_K;
  const R = b.p.map(([y, r]) => [80 + r * BT_K, top + y * BT_K]);
  const L = R.map(([x, y]) => [160 - x, y]).reverse();
  const n = v => v.toFixed(1);
  const curve = pts => {
    let d = '';
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      d += `C${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)} ${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(p2[1] - (p3[1] - p1[1]) / 6)} ${n(p2[0])} ${n(p2[1])}`;
    }
    return d;
  };
  return `M${n(L[L.length - 1][0])} ${n(top)}L${n(R[0][0])} ${n(R[0][1])}${curve(R)}L${n(L[0][0])} ${n(L[0][1])}${curve(L)}Z`;
}
const btHalf = (b, y) => { const p = b.p; for (let i = 0; i < p.length - 1; i++) if (y >= p[i][0] && y <= p[i + 1][0]) { const f = (y - p[i][0]) / ((p[i + 1][0] - p[i][0]) || 1); return p[i][1] + (p[i + 1][1] - p[i][1]) * f; } return p[p.length - 1][1]; };
const BT_PATHS = {};
const btPathOf = k => BT_PATHS[k] || (BT_PATHS[k] = btPath(BOTTLES[k]));

/* the bottle of a wine: its shape and glass, filled up to the neck; in clear glass the wine shows through */
/* on the wine page a 30 cm bottle fills the frame, other shapes keep their real size to it */
const BT_FRAME = 254;
function bottleSvg(w, shape, glass, tight) {
  const k = shape || bottleShapeOf(w), b = BOTTLES[k], gk = glass || glassOf(w, k);
  const d = btPathOf(k), top = BT_G - b.h * BT_K;
  const id = 'bt' + Math.random().toString(36).slice(2, 8);
  const clear = gk === 'clear';
  const rose = w.type === 'Sparkling' && /ros[ée]/i.test(`${w.name} ${w.producer}`);
  const wine = clear ? (rose ? WINE_IN_GLASS['Rosé'] : WINE_IN_GLASS[w.type] || WINE_IN_GLASS.White) : GLASSES[gk].c;
  const empty = clear ? ['#F2F4F0', '#B8C2BA'] : GLASSES[gk].c;
  const cap = w.type === 'Sparkling' ? '#BFA884' : ['White', 'Rosé', 'Dessert', 'Orange'].includes(w.type) ? '#6F7783' : '#5E1E2A';
  const [l0, l1] = b.label, lc = (l0 + l1) / 2;
  const fy = top + b.fill * BT_K;
  let lab, lw;
  if (b.round) { const r = (l1 - l0) / 2 * BT_K; lw = r * 2; lab = `<ellipse cx="80" cy="${top + lc * BT_K}" rx="${r * 1.02}" ry="${r}" fill="#EFE6D6"/>`; }
  else { const hw = Math.min(btHalf(b, l0), btHalf(b, l1)) * 0.86 * BT_K; lw = hw * 2; lab = `<rect x="${(80 - hw).toFixed(1)}" y="${top + l0 * BT_K}" width="${(hw * 2).toFixed(1)}" height="${((l1 - l0) * BT_K).toFixed(1)}" rx="1.5" fill="#EFE6D6"/>`; }
  const ly = top + l0 * BT_K, lh = (l1 - l0) * BT_K;
  const lines = `<rect x="${(80 - lw * 0.28).toFixed(1)}" y="${(ly + lh * 0.42).toFixed(1)}" width="${(lw * 0.56).toFixed(1)}" height="${Math.max(1.6, lh * 0.045).toFixed(1)}" rx="1" fill="#7A2B37" opacity=".5"/><rect x="${(80 - lw * 0.2).toFixed(1)}" y="${(ly + lh * 0.56).toFixed(1)}" width="${(lw * 0.4).toFixed(1)}" height="${Math.max(1.2, lh * 0.035).toFixed(1)}" rx="1" fill="#5A4A40" opacity=".32"/>`;
  const straw = b.straw ? `<g clip-path="url(#${id}c)"><rect x="0" y="${top + b.straw * BT_K}" width="160" height="400" fill="#CDB98C"/>${[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map(i => `<path d="M${80 + i * 11} ${top + b.straw * BT_K}q${-i} ${(b.h - b.straw) * BT_K * 0.5} 0 ${(b.h - b.straw) * BT_K}" stroke="#9C8659" stroke-width=".8" fill="none" opacity=".75"/>`).join('')}<rect x="0" y="${top + (b.h - 2.2) * BT_K}" width="160" height="3" fill="#9C8659"/></g>` : '';
  const hx = 80 - btHalf(b, b.h * 0.7) * BT_K * 0.62;
  const mr = Math.max(...b.p.map(q => q[1])) * BT_K;
  const vb = tight ? `${(80 - mr - 2).toFixed(1)} ${(top - 2).toFixed(1)} ${(mr * 2 + 4).toFixed(1)} ${(b.h * BT_K + 4).toFixed(1)}` : '0 0 160 360';
  return `<svg class="bottle-svg" viewBox="${vb}"${tight ? ` style="height:${Math.min(BT_FRAME, b.h * BT_FRAME / 30).toFixed(0)}px"` : ''} role="img" aria-label="${esc(b.name)} bottle, ${esc(GLASSES[gk].name.toLowerCase())} glass">
    <defs>
      <linearGradient id="${id}w" x1="0" x2="1"><stop offset="0" stop-color="${wine[1]}"/><stop offset=".38" stop-color="${wine[0]}"/><stop offset="1" stop-color="${wine[1]}"/></linearGradient>
      <linearGradient id="${id}e" x1="0" x2="1"><stop offset="0" stop-color="${empty[1]}" stop-opacity="${clear ? 0.45 : 1}"/><stop offset=".38" stop-color="${empty[0]}" stop-opacity="${clear ? 0.35 : 1}"/><stop offset="1" stop-color="${empty[1]}" stop-opacity="${clear ? 0.45 : 1}"/></linearGradient>
      <linearGradient id="${id}h" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${clear ? 0.45 : 0.22}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
      <clipPath id="${id}c"><path d="${d}"/></clipPath>
    </defs>
    <g clip-path="url(#${id}c)">
      <rect x="0" y="0" width="160" height="360" fill="url(#${id}e)"/>
      ${clear ? '' : `<rect x="0" y="0" width="160" height="${fy.toFixed(1)}" fill="#fff" opacity=".12"/>`}
      <rect x="0" y="${fy.toFixed(1)}" width="160" height="${(360 - fy).toFixed(1)}" fill="url(#${id}w)"/>
      <rect x="0" y="0" width="160" height="360" fill="url(#${id}s)"/>
      <rect x="${hx.toFixed(1)}" y="0" width="7" height="360" fill="url(#${id}h)"/>
      <rect x="0" y="${top}" width="160" height="${b.cap * BT_K}" fill="${cap}"/>${b.foil ? '' : `<rect x="0" y="${(top + b.cap * BT_K - 1.2).toFixed(1)}" width="160" height="1.2" fill="#000" opacity=".25"/>`}
    </g>
    ${clear ? `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>` : ''}
    ${straw}${lab}${lines}
  </svg>`;
}

/* ---------------------------------------------------------------- choosing shape and glass in Edit */

function bottleFieldHtml() {
  const w = formBottleWine(), k = D.bottle || bottleAuto(w), g = D.glass || glassAuto(w, k);
  return `<button type="button" class="bt-field" data-act="bt-open"><span class="bt-mini">${b3Mini(w, k, g, 54)}</span><span><small class="muted">Bottle</small><b>${esc(BOTTLES[k].name)} · ${esc(GLASSES[g].name)}</b>${D.bottle || D.glass ? '' : '<small class="muted">Chosen automatically</small>'}</span>${ICON.chevron}</button>`;
}
/* the wine as the form has it now, for the automatic choice */
const formBottleWine = () => ({ type: D.fields.type, region: D.fields.region, grapes: D.fields.grapes, name: D.fields.name, producer: D.fields.producer });
function bottleSheetHtml() {
  const w = formBottleWine(), auto = bottleAuto(w), k = D.bottle || auto, gAuto = glassAuto(w, k), g = D.glass || gAuto;
  const card = s => `<button class="bp-card${D.bottle === s ? ' on' : ''}" data-act="bt-shape" data-v="${s}" aria-pressed="${D.bottle === s}">${b3Mini(w, s, D.glass || glassAuto(w, s), 118)}<b>${esc(BOTTLES[s].name)}</b><small>${esc(BOTTLES[s].wines)}</small>${!D.bottle && s === auto ? '<em>Auto</em>' : ''}</button>`;
  const swatch = x => `<button class="bp-glass${D.glass === x ? ' on' : ''}" data-act="bt-glass" data-v="${x}" aria-pressed="${D.glass === x}">${b3Mini(w, k, x, 74)}<small>${esc(GLASSES[x].name)}</small>${!D.glass && x === gAuto ? '<em>Auto</em>' : ''}</button>`;
  return `<div class="sheet-backdrop" data-act="bt-close"></div><div class="sheet bp-sheet" role="dialog" aria-modal="true" aria-label="Bottle"><div class="grab"></div>
    <div class="between"><h2 style="font-size:18px;font-weight:600">Bottle</h2><button class="icon-btn" data-act="bt-close" aria-label="Close">${ICON.x}</button></div>
    <span class="fsec-h">Shape</span>
    <button class="bp-auto${D.bottle ? '' : ' on'}" data-act="bt-shape" data-v=""><span>Automatic: <b>${esc(BOTTLES[auto].name)}</b></span><span class="small muted">from type, region and grapes</span></button>
    <div class="bp-grid">${Object.keys(BOTTLES).map(card).join('')}</div>
    <span class="fsec-h">Glass</span>
    <button class="bp-auto${D.glass ? '' : ' on'}" data-act="bt-glass" data-v=""><span>Automatic: <b>${esc(GLASSES[gAuto].name)}</b></span><span class="small muted">clear glass shows the wine</span></button>
    <div class="bp-glasses">${Object.keys(GLASSES).map(swatch).join('')}</div>
    <button class="btn primary block" data-act="bt-close">Done</button>
  </div>`;
}
function bottleSheetOpen() { RS = { kind: 'bottle' }; renderSheet(); }
function bottleSheetRefresh() {
  const sh = $('#sheet-root .bp-sheet'), top = sh ? sh.scrollTop : 0;
  renderSheet();
  const n = $('#sheet-root .bp-sheet');
  if (n) { n.scrollTop = top; n.style.animation = 'none'; }
  const f = $('#bottle-field'); if (f) f.innerHTML = bottleFieldHtml();
}
/* type, region, grapes or name changed in the form: the automatic bottle follows */
let btFieldT = 0;
function bottleFieldLater(name) {
  if (!['type', 'region', 'grapes', 'name'].includes(name)) return;
  clearTimeout(btFieldT);
  btFieldT = setTimeout(() => { const f = $('#bottle-field'); if (f && D) f.innerHTML = bottleFieldHtml(); }, 250);
}
const BT_ACTS = {
  'bt-open': () => bottleSheetOpen(),
  'bt-shape': el => { D.bottle = el.dataset.v; bottleSheetRefresh(); },
  'bt-glass': el => { D.glass = el.dataset.v; bottleSheetRefresh(); },
  'bt-close': () => { closeSheet(); const f = $('#bottle-field'); if (f) f.innerHTML = bottleFieldHtml(); }
};

/* ---------------------------------------------------------------- drawn label, for wines without a photo */

function labelCardHtml(w) {
  return `<div class="dl"><span class="dl-p">${esc(w.producer)}</span><i></i><b class="dl-n">${esc(w.name || w.producer || 'Wine')}</b>${w.region ? `<span class="dl-r">${esc(str(w.region).split(',')[0])}</span>` : ''}<span class="dl-v">${esc(w.vintage || 'NV')}</span></div>`;
}
/* in the lists: the vintage is the one thing that can still be read */
const labelMiniHtml = (w, sm) => `<div class="thumb${sm ? ' sm' : ''} dl-mini" aria-hidden="true"><span>${esc(w.vintage || 'NV')}</span><i></i></div>`;

/* the top of the wine page: the rendered bottle and the label side by side in a frame, both centred.
   The label photo, or a label set in type for a wine without one, is also wrapped around the bottle. */
const btHeight = k => Math.min(BT_FRAME, BOTTLES[k].h * BT_FRAME / 30);
function wineTopHtml(w) {
  const photo = w.thumb || w.labelFileId;
  const o = b3Opts(w);
  if (w.type === 'Sparkling' && w.vintage) o.neck = String(w.vintage);
  const bh = btHeight(o.shape), round = o.oval || BOTTLES[o.shape].round;
  const img = `<img id="label-img" class="label-photo${round ? ' oval' : ''}${photo ? '' : ' typo'}" data-bh="${bh.toFixed(0)}" style="max-height:${bh.toFixed(0)}px"${photo ? '' : ' data-typo="1"'}${w.thumb ? ` src="${esc(w.thumb)}"` : ''} alt="Label of ${esc(fullName(w))}">`;
  if (!photo) b3FontsReady().then(() => { const im = document.getElementById('label-img'); if (im && im.dataset.typo && !im.getAttribute('src')) im.src = b3TypoLabel(w, o.shape).toDataURL('image/png'); });
  return `<div class="wframe"><div class="wtop-b">${b3Html(w, o, bh, `data-wid="${esc(w.id)}" data-h="${bh.toFixed(1)}"`)}</div><button class="wtop-lab" data-act="label-zoom" aria-label="Show the label large">${img}</button></div>`;
}
/* small rendered bottles for the choice in Edit; shapes keep their real size to each other */
function b3Mini(w, shape, glass, boxPx) {
  const o = Object.assign(b3Opts(w, shape, glass), { plain: true });
  const h = boxPx * BOTTLES[shape].h / 36;
  return `<span class="b3-box" style="height:${boxPx}px">${b3Html(w, o, h)}</span>`;
}
/* the label as tall as the bottle, unless it is so wide that it would take the bottle's place */
function fitLabel(img) {
  const fr = img && img.closest('.wframe'), bt = fr && fr.querySelector('.wtop-b');
  if (!fr || !bt || !img.naturalWidth) return;
  const cs = getComputedStyle(fr), gap = parseFloat(cs.columnGap) || 28;
  const room = fr.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - bt.offsetWidth - gap;
  const h = Math.max(60, Math.min(Number(img.dataset.bh) || 196, room * img.naturalHeight / img.naturalWidth));
  Object.assign(img.style, { height: h.toFixed(0) + 'px', width: 'auto', maxHeight: 'none', maxWidth: 'none' });
}
/* the label is there: it gets its size, and the bottle wears it */
function labelLoaded(img) {
  const cv = document.querySelector('.wframe canvas.b3[data-wid]');
  const w = cv && wineById(cv.dataset.wid);
  if (cv && w) {
    const o = b3Opts(w);
    if (w.type === 'Sparkling' && w.vintage) o.neck = String(w.vintage);
    b3Paint(cv, w, o, Number(cv.dataset.h), img);
  }
  fitLabel(img);
}
document.addEventListener('load', e => { if (e.target && e.target.id === 'label-img') labelLoaded(e.target); }, true);
window.addEventListener('resize', () => { const im = document.getElementById('label-img'); if (im && im.complete) fitLabel(im); });

function labelZoom() {
  const img = $('#label-img');
  if (!img || !img.src) return;
  const z = document.createElement('div');
  z.className = 'zoom';
  z.innerHTML = `<img src="${esc(img.src)}" alt="${esc(img.alt)}"${img.classList.contains('oval') ? ' class="oval"' : ''}><button class="icon-btn" aria-label="Close">${ICON.x}</button>`;
  z.onclick = () => { z.remove(); window.removeEventListener('hashchange', off); };
  const off = () => z.remove();
  window.addEventListener('hashchange', off, { once: true });
  document.body.appendChild(z);
}

/* ---------------------------------------------------------------- camera with a label frame */

const CAM = { stream: null, torch: false, canTorch: false };
const camOk = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
function camStop() {
  if (CAM.stream) CAM.stream.getTracks().forEach(t => t.stop());
  Object.assign(CAM, { stream: null, torch: false, canTorch: false });
}
function camHtml() {
  return `<div class="cam" id="cam"><video id="cam-video" playsinline muted autoplay></video><div class="cam-frame" id="cam-frame"></div><p class="cam-hint">Fit the label into the frame</p></div>
    <div class="cam-bar"><button class="btn" data-act="cam-cancel">Cancel</button><button class="cam-shot" data-act="cam-shot" aria-label="Take the photo"></button>
      <button class="icon-btn cam-torch" id="cam-torch" data-act="cam-torch" aria-label="Light" aria-pressed="false" hidden><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M13 2L5 13h6l-1 9 8-11h-6z"/></svg></button></div>
    <label class="btn ghost">Choose from gallery<input type="file" accept="image/*" data-change="photo" hidden></label>`;
}
async function setupCamera() {
  const v = $('#cam-video');
  if (!v) return;
  if (!CAM.stream) {
    try {
      CAM.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } } });
    } catch (e) {
      camStop();
      if (D && D.step === 'camera') { D.step = 'photo'; D.camFail = true; render(); }
      return;
    }
    if (!D || D.step !== 'camera') { camStop(); return; }
  }
  const el = $('#cam-video');
  if (!el) return;
  el.srcObject = CAM.stream;
  try { await el.play(); } catch (e) { /* starts on its own */ }
  const track = CAM.stream.getVideoTracks()[0];
  const caps = track && track.getCapabilities ? track.getCapabilities() : {};
  CAM.canTorch = !!caps.torch;
  const t = $('#cam-torch');
  if (t) { t.hidden = !CAM.canTorch; t.setAttribute('aria-pressed', String(CAM.torch)); t.classList.toggle('on', CAM.torch); }
}
async function camTorch() {
  const track = CAM.stream && CAM.stream.getVideoTracks()[0];
  if (!track) return;
  try { await track.applyConstraints({ advanced: [{ torch: !CAM.torch }] }); CAM.torch = !CAM.torch; } catch (e) { toast('The light cannot be switched on here.'); }
  const t = $('#cam-torch');
  if (t) { t.setAttribute('aria-pressed', String(CAM.torch)); t.classList.toggle('on', CAM.torch); }
}
/* the photo: the frame and a margin around it, so the edges can still be found */
function camShot() {
  const v = $('#cam-video'), box = $('#cam'), fr = $('#cam-frame');
  if (!v || !v.videoWidth || !box || !fr) return;
  const vw = v.videoWidth, vh = v.videoHeight, b = box.getBoundingClientRect(), f = fr.getBoundingClientRect();
  const s = Math.max(b.width / vw, b.height / vh), ox = (b.width - vw * s) / 2, oy = (b.height - vh * s) / 2;
  const toV = (x, y) => ({ x: (x - b.left - ox) / s, y: (y - b.top - oy) / s });
  const a = toV(f.left, f.top), z = toV(f.right, f.bottom);
  const mx = (z.x - a.x) * 0.12, my = (z.y - a.y) * 0.12;
  const sx = clamp(a.x - mx, 0, vw), sy = clamp(a.y - my, 0, vh), ex = clamp(z.x + mx, 0, vw), ey = clamp(z.y + my, 0, vh);
  const k = Math.min(1, 2000 / Math.max(ex - sx, ey - sy));
  const c = document.createElement('canvas');
  c.width = Math.round((ex - sx) * k);
  c.height = Math.round((ey - sy) * k);
  c.getContext('2d').drawImage(v, sx, sy, ex - sx, ey - sy, 0, 0, c.width, c.height);
  camStop();
  const fx = (a.x - sx) * k, fy = (a.y - sy) * k, fw = (z.x - a.x) * k, fh = (z.y - a.y) * k;
  D.src = c;
  D.corners = [{ x: fx, y: fy }, { x: fx + fw, y: fy }, { x: fx + fw, y: fy + fh }, { x: fx, y: fy + fh }];
  D.mids = null;
  D.cornersTouched = false;
  D.detectStarted = false;
  D.step = 'crop';
  render();
}

/* ---------------------------------------------------------------- unrolling a label from a round bottle
   Six points: the four corners and the middle of the top and the bottom edge. The edges become straight,
   and the text squeezed at the sides of the bottle gets its width back. */

const midOf = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
/* the middle points as they are now: dragged, found, or simply between the corners */
function cropMids() {
  const [tl, tr, br, bl] = D.corners;
  const off = D.mids || [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  const t = midOf(tl, tr), b = midOf(bl, br);
  return [{ x: t.x + off[0].x, y: t.y + off[0].y }, { x: b.x + off[1].x, y: b.y + off[1].y }];
}
function setCropMid(i, p) {
  const [tl, tr, br, bl] = D.corners;
  const base = i === 0 ? midOf(tl, tr) : midOf(bl, br);
  D.mids = D.mids || [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  D.mids[i] = { x: p.x - base.x, y: p.y - base.y };
}
/* how strongly the edges bend, compared to the width */
function cropSag(quad, mids) {
  const [tl, tr, br, bl] = quad;
  const w = (dist(tl, tr) + dist(bl, br)) / 2 || 1;
  return Math.max(dist(mids[0], midOf(tl, tr)), dist(mids[1], midOf(bl, br))) / w;
}
const bezPt = (a, c, b, t) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
/* the control point of a curve that passes through m in its middle */
const bezCtrl = (a, m, b) => ({ x: 2 * m.x - (a.x + b.x) / 2, y: 2 * m.y - (a.y + b.y) / 2 });

function warpCurved(srcCanvas, quad, mids, maxSide = 1400) {
  const [tl, tr, br, bl] = quad;
  const ct = bezCtrl(tl, mids[0], tr), cb = bezCtrl(bl, mids[1], br);
  // a label around a bottle: the more the edges bend, the more of the bottle it covers
  const th = clamp(cropSag(quad, mids) * 9, 0, 1.1);
  const unroll = th > 0.05;
  const sOf = u => (unroll ? 0.5 + Math.sin((u - 0.5) * 2 * th) / (2 * Math.sin(th)) : u);
  let W = (dist(tl, tr) + dist(bl, br)) / 2 * (unroll ? th / Math.sin(th) : 1), H = (dist(tl, bl) + dist(tr, br)) / 2;
  const k = Math.min(1, maxSide / Math.max(W, H));
  W = Math.max(8, Math.round(W * k));
  H = Math.max(8, Math.round(H * k));
  const sw = srcCanvas.width, sh = srcCanvas.height;
  const sd = srcCanvas.getContext('2d').getImageData(0, 0, sw, sh).data;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d');
  const img = octx.createImageData(W, H);
  const od = img.data;
  for (let u = 0; u < W; u++) {
    const s = sOf((u + 0.5) / W);
    const T = bezPt(tl, ct, tr, s), B = bezPt(bl, cb, br, s);
    for (let v = 0; v < H; v++) {
      const f = (v + 0.5) / H;
      const x = clamp(T.x + (B.x - T.x) * f - 0.5, 0, sw - 1), y = clamp(T.y + (B.y - T.y) * f - 0.5, 0, sh - 1);
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
/* straight edges keep the exact perspective correction, bent ones are unrolled */
const warpLabel = (src, quad, mids, maxSide) => (cropSag(quad, mids) < 0.012 ? warpQuad(src, quad, maxSide) : warpCurved(src, quad, mids, maxSide));

/* ---------------------------------------------------------------- round and oval labels
   Four points on the edge: top, right, bottom, left. Seen at an angle a circle becomes an ellipse; the four
   points carry that perspective. "Flatten" gives a label that bends around the bottle its width back. */
const OVAL_UNIT = [{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }];
const homApply = (h, x, y) => { const d = h[6] * x + h[7] * y + 1; return { x: (h[0] * x + h[1] * y + h[2]) / d, y: (h[3] * x + h[4] * y + h[5]) / d }; };
/* points along the edge of the label */
function ovalPoints(pts, n) {
  let h;
  try { h = solveHomography(OVAL_UNIT, pts); } catch (e) { return pts; }
  return Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return homApply(h, 0.5 + 0.5 * Math.cos(a - Math.PI / 2), 0.5 + 0.5 * Math.sin(a - Math.PI / 2)); });
}
const ovalFromQuad = q => [midOf(q[0], q[1]), midOf(q[1], q[2]), midOf(q[2], q[3]), midOf(q[3], q[0])];
function warpOval(srcCanvas, pts, flat, maxSide = 1400) {
  const h = solveHomography(OVAL_UNIT, pts);
  const th = clamp(flat, 0, 1) * 1.1, unroll = th > 0.05;
  const sOf = u => (unroll ? 0.5 + Math.sin((u - 0.5) * 2 * th) / (2 * Math.sin(th)) : u);
  let W = dist(pts[1], pts[3]) * (unroll ? th / Math.sin(th) : 1), H = dist(pts[0], pts[2]);
  const k = Math.min(1, maxSide / Math.max(W, H));
  W = Math.max(8, Math.round(W * k)); H = Math.max(8, Math.round(H * k));
  const sw = srcCanvas.width, sh = srcCanvas.height, sd = srcCanvas.getContext('2d').getImageData(0, 0, sw, sh).data;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const octx = out.getContext('2d'), img = octx.createImageData(W, H), od = img.data;
  // the corners outside the oval get the colour of its edge, so a square thumbnail still looks calm
  let er = 0, eg = 0, eb = 0, en = 0;
  ovalPoints(pts, 64).forEach(p => { const x = clamp(Math.round(p.x), 0, sw - 1), y = clamp(Math.round(p.y), 0, sh - 1), i = (y * sw + x) * 4; er += sd[i]; eg += sd[i + 1]; eb += sd[i + 2]; en++; });
  er /= en; eg /= en; eb /= en;
  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W; u++) {
      const fu = (u + 0.5) / W, fv = (v + 0.5) / H, o = (v * W + u) * 4;
      const inside = (fu - 0.5) ** 2 + (fv - 0.5) ** 2 <= 0.25;
      if (!inside) { od[o] = er; od[o + 1] = eg; od[o + 2] = eb; od[o + 3] = 255; continue; }
      const p = homApply(h, sOf(fu), fv);
      const x = clamp(p.x - 0.5, 0, sw - 1), y = clamp(p.y - 0.5, 0, sh - 1);
      const x0 = x | 0, y0 = y | 0, x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1), fx = x - x0, fy = y - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;
      for (let c = 0; c < 3; c++) od[o + c] = (sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx) * (1 - fy) + (sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx) * fy;
      od[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}
/* what the crop step makes of the photo, for the preview and when saving */
const cropOut = maxSide => (D.cropShape === 'oval' ? warpOval(D.src, D.oval, D.flat || 0, maxSide) : warpLabel(D.src, D.corners, cropMids(), maxSide));

/* the bend of the edges from the outline found by the scanner: the outline point in the middle of each edge */
function midsFromContour(contour, quad, k) {
  try {
    const d = contour.data32S;
    if (!d || d.length < 8) return null;
    const pts = [];
    for (let i = 0; i < d.length; i += 2) pts.push({ x: d[i] / k, y: d[i + 1] / k });
    const [tl, tr, br, bl] = quad;
    const w = (dist(tl, tr) + dist(bl, br)) / 2, h = (dist(tl, bl) + dist(tr, br)) / 2;
    const near = (a, b, top) => {
      const m = midOf(a, b);
      const cand = pts.filter(p => Math.abs(p.x - m.x) < w * 0.05 && Math.abs(p.y - m.y) < h * 0.2 && (top ? p.y < (tl.y + bl.y) / 2 + h * 0.1 : p.y > (tl.y + bl.y) / 2 - h * 0.1));
      if (!cand.length) return { x: 0, y: 0 };
      cand.sort((p, q) => p.y - q.y);
      const p = cand[cand.length >> 1];
      return { x: 0, y: p.y - m.y };
    };
    const mids = [near(tl, tr, true), near(bl, br, false)];
    return mids.every(m => Math.abs(m.y) < h * 0.12) ? mids : null;
  } catch (e) { return null; }
}

/* the crop step: a small preview of what comes out */
let cropPrevT = 0;
function cropPreview() {
  clearTimeout(cropPrevT);
  cropPrevT = setTimeout(() => {
    const c = $('#crop-prev');
    if (!c || !D || !D.src || !D.corners) return;
    try {
      const out = cropOut(260);
      c.width = out.width;
      c.height = out.height;
      const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      if (D.cropShape === 'oval') { g.save(); g.beginPath(); g.ellipse(c.width / 2, c.height / 2, c.width / 2, c.height / 2, 0, 0, Math.PI * 2); g.clip(); }
      g.drawImage(out, 0, 0);
      if (D.cropShape === 'oval') g.restore();
    } catch (e) { /* corners too close together */ }
  }, 60);
}

/* ---------------------------------------------------------------- the loupe while dragging a crop point
   Three times larger than on the screen, with a cross on the point and the edges that meet there.
   It sits in an upper corner, on the side away from the point. */

function loupeShow(i, ev) {
  const wrap = $('#crop-wrap'), svgEl = $('#crop-svg');
  if (!wrap || !svgEl || !D || !D.src) return;
  let L = $('#loupe');
  if (!L) {
    L = document.createElement('div');
    L.id = 'loupe';
    L.className = 'loupe';
    L.innerHTML = '<canvas width="248" height="248"></canvas>';
    wrap.appendChild(L);
  }
  const r = svgEl.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
  const sc = r.width / D.src.width;
  const oval = D.cropShape === 'oval', mids = cropMids(), pts = oval ? D.oval : D.corners.concat(mids), c = pts[i];
  const px = c.x * sc + (r.left - wr.left), py = c.y * sc + (r.top - wr.top);
  const left = px > wr.width / 2;
  L.style.left = left ? '10px' : '';
  L.style.right = left ? '' : '10px';
  L.style.top = py < 150 && ((left && px < 150) || (!left && px > wr.width - 150)) ? '' : '10px';
  L.style.bottom = L.style.top ? '' : '10px';
  const cv = L.querySelector('canvas'), x = cv.getContext('2d');
  const half = 62 / (3 * sc), k = 248 / (half * 2);
  x.fillStyle = '#000';
  x.fillRect(0, 0, 248, 248);
  x.drawImage(D.src, c.x - half, c.y - half, half * 2, half * 2, 0, 0, 248, 248);
  const to = p => [(p.x - c.x + half) * k, (p.y - c.y + half) * k];
  const [tl, tr, br, bl] = D.corners;
  x.strokeStyle = 'rgba(230, 203, 152, .95)';
  x.lineWidth = 3;
  x.beginPath();
  if (oval) { ovalPoints(D.oval, 96).forEach((p, j) => (j ? x.lineTo(...to(p)) : x.moveTo(...to(p)))); x.closePath(); }
  else {
    const edge = (a, m, b) => { const q = bezCtrl(a, m, b); x.moveTo(...to(a)); x.quadraticCurveTo(...to(q), ...to(b)); };
    edge(tl, mids[0], tr); edge(bl, mids[1], br);
    x.moveTo(...to(tr)); x.lineTo(...to(br)); x.moveTo(...to(tl)); x.lineTo(...to(bl));
  }
  x.stroke();
  x.strokeStyle = '#fff';
  x.lineWidth = 2;
  x.beginPath(); x.moveTo(124, 98); x.lineTo(124, 150); x.moveTo(98, 124); x.lineTo(150, 124); x.stroke();
  L.hidden = false;
}
function loupeHide() { const L = $('#loupe'); if (L) L.hidden = true; }
