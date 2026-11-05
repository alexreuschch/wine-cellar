'use strict';

/* Wine Cellar: Insights, window, top rated, journal and wine detail screens. Loaded after app.js, in the order of index.html. */

/* ------------------------------------------------------------ insights */

/* colors for wine types, checked for color blindness on the dark surface; always shown with name and number */
const TYPE_CHART = { Red: '#C2414F', White: '#B39028', 'Rosé': '#D06A8C', Sparkling: '#2F94B8', Dessert: '#C9711F', Fortified: '#8F62C2' };
const COUNTRY_NAMES = { FR: 'France', IT: 'Italy', ES: 'Spain', PT: 'Portugal', DE: 'Germany', AT: 'Austria', CH: 'Switzerland', US: 'United States', AR: 'Argentina', CL: 'Chile', AU: 'Australia', NZ: 'New Zealand', ZA: 'South Africa', GR: 'Greece', HU: 'Hungary', LB: 'Lebanon', IL: 'Israel', CA: 'Canada', UY: 'Uruguay', SI: 'Slovenia', HR: 'Croatia', GE: 'Georgia', RO: 'Romania', MD: 'Moldova', BG: 'Bulgaria', GB: 'United Kingdom', MX: 'Mexico', BR: 'Brazil', CN: 'China', JP: 'Japan', LU: 'Luxembourg', CZ: 'Czechia', SK: 'Slovakia', TR: 'Türkiye', CY: 'Cyprus', RS: 'Serbia', MK: 'North Macedonia', AM: 'Armenia', MA: 'Morocco', BE: 'Belgium', NL: 'Netherlands', DK: 'Denmark', SE: 'Sweden', IN: 'India', PE: 'Peru', BO: 'Bolivia', ME: 'Montenegro', BA: 'Bosnia and Herzegovina', MT: 'Malta' };
const flagEmoji = code => String.fromCodePoint(...[...code].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65));
const pct = (n, total) => (total ? Math.round(n / total * 100) : 0);
const btl = n => `${n} ${n === 1 ? 'bottle' : 'bottles'}`;

function tally(list, keyOf, weightOf) {
  const m = new Map();
  list.forEach(x => (keyOf(x) || []).forEach(k => { if (k === null || k === undefined || k === '') return; const e = m.get(k) || { k, n: 0 }; e.n += weightOf(x); m.set(k, e); }));
  return [...m.values()].filter(e => e.n > 0);
}

/* one labelled horizontal bar per row; the row opens the matching list */
function barRows(rows, opts = {}) {
  const max = Math.max(1, ...rows.map(r => r.n));
  const total = opts.total || rows.reduce((a, r) => a + r.n, 0);
  return `<div class="ins-bars">${rows.map(r => {
    const tag = r.go ? 'button' : 'div';
    const attrs = r.go ? ` data-act="ins-go" data-k="${esc(r.go[0])}" data-v="${esc(r.go[1])}"` : '';
    return `<${tag} class="ins-row"${attrs}><span class="ins-label">${r.icon || ''}<span class="ellipsis">${esc(r.label)}</span></span>
      <span class="ins-track"><span class="ins-fill" style="width:${Math.max(2, r.n / max * 100).toFixed(1)}%;${r.c ? `background:${r.c}` : ''}"></span></span>
      <span class="ins-num">${opts.money ? esc(money(r.n, 0)) : r.n}${opts.share ? `<small>${pct(r.n, total)}%</small>` : ''}</span></${tag}>`;
  }).join('')}</div>`;
}

/* vertical columns with the value on top and the label below */
function columns(cols, color) {
  const max = Math.max(1, ...cols.map(c => c.n));
  return `<div class="ins-cols" style="grid-template-columns:repeat(${cols.length},minmax(0,1fr))">${cols.map(c => `<div class="ins-col" title="${esc(c.label)}: ${c.n}">
    <span class="ins-col-n">${c.n || ''}</span>
    <span class="ins-col-bar"><span style="height:${c.n ? Math.max(3, c.n / max * 100).toFixed(1) : 0}%;${color ? `background:${color}` : ''}"></span></span>
    <span class="ins-col-l">${esc(c.label)}</span></div>`).join('')}</div>`;
}

/* donut for the share of wine types, with a legend that names every slice */
/* ring chart with a legend that names every slice; rows: { k, label, n, c, go } */
function donut(rows, total, opts = {}) {
  const r = 42, C = 2 * Math.PI * r, gap = rows.length > 1 ? 2.4 : 0;
  let off = 0;
  const arcs = rows.map(x => {
    const len = x.n / total * C;
    const a = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${x.c}" stroke-width="16" stroke-dasharray="${Math.max(0.1, len - gap).toFixed(2)} ${(C - Math.max(0.1, len - gap)).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"/>`;
    off += len;
    return a;
  }).join('');
  const center = opts.center || [total, 'bottles'];
  const legend = rows.map(x => {
    const tag = x.go ? 'button' : 'div';
    const attrs = x.go ? ` data-act="ins-go" data-k="${esc(x.go[0])}" data-v="${esc(x.go[1])}"` : '';
    return `<${tag} class="ins-leg"${attrs}><span class="sw" style="background:${x.c}"></span><span class="ellipsis">${esc(x.label || x.k)}</span><b>${opts.pctOnly ? '' : Math.round(x.n)}</b><small>${pct(x.n, total)}%</small></${tag}>`;
  }).join('');
  return `<div class="ins-donut"><svg viewBox="0 0 120 120" width="132" height="132" role="img" aria-label="${esc(opts.label || 'Share')}">${arcs}<text x="60" y="58" text-anchor="middle" class="d-n">${esc(center[0])}</text><text x="60" y="74" text-anchor="middle" class="d-l">${esc(center[1])}</text></svg>
    <div class="ins-legend">${legend}</div></div>`;
}

/* grapes: red and white varieties get the color family of their wine */
const RED_GRAPES = ['pinot noir', 'nebbiolo', 'tempranillo', 'graciano', 'merlot', 'cabernet sauvignon', 'cabernet franc', 'syrah', 'shiraz', 'grenache', 'garnacha', 'cinsault', 'sangiovese', 'touriga nacional', 'touriga franca', 'malbec', 'zinfandel', 'primitivo', 'gamay', 'mourvèdre', 'monastrell', 'carmenère', 'petit verdot', 'barbera', 'dolcetto', 'corvina', 'aglianico', "nero d'avola", 'blaufränkisch', 'zweigelt', 'pinotage', 'tannat', 'montepulciano', 'cornalin', 'humagne rouge', 'gamaret', 'garanoir', 'carignan', 'negroamaro', 'petite sirah', 'mencía', 'lagrein', 'teroldego', 'sagrantino', 'xinomavro', 'saperavi', 'pinot meunier', 'meunier', 'st. laurent', 'merlot noir'];
const WHITE_GRAPES = ['chardonnay', 'riesling', 'chasselas', 'sauvignon blanc', 'sémillon', 'semillon', 'grüner veltliner', 'pinot gris', 'pinot grigio', 'pinot blanc', 'gewürztraminer', 'viognier', 'chenin blanc', 'muscat', 'moscato', 'albariño', 'verdejo', 'vermentino', 'garganega', 'glera', 'trebbiano', 'petite arvine', 'müller-thurgau', 'silvaner', 'marsanne', 'roussanne', 'furmint', 'assyrtiko', 'godello', 'fiano', 'greco', 'friulano', 'savagnin', 'heida', 'malvasia', 'palomino', 'pedro ximénez', 'macabeo', 'viura', 'xarel-lo', 'parellada', 'arneis', 'cortese', 'sauvignon gris', 'muscadelle'];
const RED_SHADES = ['#C2414F', '#E58E98', '#962D3C'];
const WHITE_SHADES = ['#B39028', '#E0C66E', '#8C6E1C'];
const OTHER_C = '#6F6468';
const REGION_C = ['#3987E5', '#D95926', '#199E70', '#C98500', '#D55181'];

/* bottles per grape, split by the shares in the grapes field, otherwise equally */
function grapeShares(w) {
  const parts = String(w.grapes || '').split(/[,;\/+&]/).map(x => x.trim()).filter(Boolean)
    .map(x => { const m = /(\d+(?:[.,]\d+)?)\s*%/.exec(x); return { name: cap(x.replace(/\d+([.,]\d+)?\s*%?/g, '').replace(/\s+/g, ' ').trim()), p: m ? Number(m[1].replace(',', '.')) : null }; })
    .filter(x => x.name.length > 1);
  if (!parts.length) return [];
  const sum = parts.every(x => x.p !== null) ? parts.reduce((a, x) => a + x.p, 0) : 0;
  return parts.map(x => ({ name: x.name, n: w.count * (sum > 0 ? x.p / sum : 1 / parts.length) }));
}
function grapeIsRed(name, wines) {
  const k = lc(name);
  if (RED_GRAPES.some(g => k === g || k.startsWith(g + ' '))) return true;
  if (WHITE_GRAPES.some(g => k === g || k.startsWith(g + ' '))) return false;
  let red = 0, white = 0;
  wines.forEach(w => { if (grapeNames(w).some(g => lc(g) === k)) { if (['Red', 'Rosé', 'Fortified'].includes(w.type)) red += w.count; else white += w.count; } });
  return red >= white;
}

const insSection = (title, sub, body) => `<section class="ins-sec"><div class="sec-head"><h2>${title}</h2>${sub ? `<span class="muted small">${sub}</span>` : ''}</div>${body}</section>`;

function viewInsights() {
  const head = `<header class="top"><h1 class="title">Insights</h1></header>`;
  const wines = S.wines.filter(w => w.count > 0);
  const total = wines.reduce((a, w) => a + w.count, 0);
  if (!total) return `<main class="screen has-nav">${head}<div class="empty"><h2>No bottles in stock</h2><p>Insights appear as soon as your cellar has wines.</p></div></main>${nav('insights')}`;
  const bottles = w => w.count;
  const year = now.getFullYear();
  const out = [];

  // wine types
  const types = tally(wines, w => [w.type || 'Other'], bottles).sort((a, b) => TYPES.indexOf(a.k) - TYPES.indexOf(b.k));
  types.forEach(t => { t.c = TYPE_CHART[t.k] || '#8F837C'; });
  out.push(insSection('Wine types', `${wines.length} wines`, donut(types.map(t => ({ k: t.k, n: t.n, c: t.c, go: ['type', t.k] })), total, { label: 'Bottles by wine type' })));

  // countries
  const cName = {};
  wines.forEach(w => { const c = countryOf(w); if (c && !cName[c.code]) cName[c.code] = c.name; });
  const byCountry = tally(wines, w => { const c = countryOf(w); return [c ? c.code : '?']; }, bottles).sort((a, b) => (a.k === '?') - (b.k === '?') || b.n - a.n);
  out.push(insSection('Countries', '', barRows(byCountry.map(e => e.k === '?'
    ? { label: 'No country', n: e.n }
    : { label: COUNTRY_NAMES[e.k] || e.k, icon: `<span class="flag">${flagEmoji(e.k)}</span>`, n: e.n, go: ['search', cName[e.k]] }), { share: true, total })));

  // vintages
  const vint = tally(wines, w => [w.vintage ? Number(w.vintage) : 'NV'], bottles);
  const years = vint.filter(e => e.k !== 'NV').sort((a, b) => a.k - b.k);
  let cols = years.map(e => ({ label: `’${String(e.k).slice(-2)}`, n: e.n, y: e.k }));
  if (cols.length > 12) {
    const keep = cols.slice(-11), older = cols.slice(0, -11);
    cols = [{ label: `≤’${String(older[older.length - 1].y).slice(-2)}`, n: older.reduce((a, c) => a + c.n, 0) }, ...keep];
  }
  const nv = vint.find(e => e.k === 'NV');
  if (nv) cols.push({ label: 'NV', n: nv.n });
  const oldest = years.length ? years[0].k : null, newest = years.length ? years[years.length - 1].k : null;
  out.push(insSection('Vintages', oldest ? (oldest === newest ? String(oldest) : `${oldest} to ${newest}`) : '', columns(cols)));

  // drinking window
  const byStatus = tally(wines, w => [statusOf(w)], bottles).sort((a, b) => STATUS_ORDER.indexOf(a.k) - STATUS_ORDER.indexOf(b.k));
  const due = [];
  for (let y = year; y < year + 8; y++) due.push({ label: y === year ? 'Now' : `’${String(y).slice(-2)}`, n: 0 });
  wines.forEach(w => { const p = windowParts(w); if (!p) return; const i = Math.max(0, p.u - year); if (i < due.length) due[i].n += w.count; });
  out.push(insSection('Drinking window', '', `${barRows(byStatus.map(e => ({ label: e.k, n: e.n, c: STATUS[e.k].c, go: ['window', e.k] })), { share: true, total })}
    <p class="small muted" style="margin:10px 0 0">Bottles to drink by the end of each year</p>${columns(due, 'var(--gold)')}`));

  // value
  let cost = 0, street = 0, withCost = 0, withStreet = 0;
  const valRows = TYPES.map(t => ({ t, c: 0, s: 0 }));
  wines.forEach(w => {
    const a = avgPrice(w), st = streetOf(w), v = valRows.find(x => x.t === w.type);
    if (a !== null) { cost += a * w.count; withCost += w.count; if (v) v.c += a * w.count; }
    if (st !== null) { street += st * w.count; withStreet += w.count; if (v) v.s += st * w.count; }
  });
  const bands = [[0, 20], [20, 40], [40, 60], [60, 100], [100, Infinity]];
  const bandRows = bands.map(([lo, hi]) => ({ label: hi === Infinity ? `${lo} and more` : `${lo} to ${hi}`, n: wines.filter(w => { const v = streetOf(w); return v !== null && v >= lo && v < hi; }).reduce((a, w) => a + w.count, 0) }));
  const noStreet = total - withStreet;
  const change = cost > 0 && withCost === withStreet ? Math.round((street - cost) / cost * 100) : null;
  out.push(insSection('Value', '', `<div class="ins-tiles"><div><span>Total Costs</span><b>${esc(money(cost, 0))}</b></div><div><span>Total Street Value</span><b>${esc(money(street, 0))}</b>${change !== null ? `<small>${change > 0 ? '+' : ''}${change}% vs. purchase</small>` : ''}</div></div>
    <p class="small muted" style="margin:12px 0 0">Total Street Value by wine type</p>
    ${barRows(valRows.filter(v => v.s > 0).sort((a, b) => b.s - a.s).map(v => ({ label: v.t, n: Math.round(v.s), c: TYPE_CHART[v.t], go: ['type', v.t] })), { money: true })}
    <p class="small muted" style="margin:12px 0 0">Bottles by street price per bottle (${esc(cur())})</p>
    ${barRows(bandRows.filter(b => b.n > 0).concat(noStreet ? [{ label: 'No street price', n: noStreet }] : []), { share: true, total })}`));

  // consumption over the last 12 months
  const opened = S.removals.filter(r => r.dir === 'out' && r.type !== 'Sale' && r.type !== 'Gift');
  const months = [];
  const d0 = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 11; i >= 0; i--) { const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1); months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-US', { month: 'narrow' }), n: 0 }); }
  opened.forEach(r => { const m = months.find(x => x.key === String(r.date).slice(0, 7)); if (m) m.n += Number(r.qty) || 1; });
  const yearN = months.reduce((a, m) => a + m.n, 0);
  const occ = tally(opened, r => [entryType(r)], r => Number(r.qty) || 1).sort((a, b) => b.n - a.n).slice(0, 5);
  const ppl = tally(opened, r => namesOf(r.people), r => Number(r.qty) || 1).sort((a, b) => b.n - a.n || a.k.localeCompare(b.k)).slice(0, 5);
  out.push(insSection('Bottles opened', `${btl(yearN)} in 12 months`, opened.length ? `${columns(months, 'var(--gold)')}
    ${occ.length ? `<p class="small muted" style="margin:12px 0 0">Occasions</p>${barRows(occ.map(e => ({ label: e.k, n: e.n, go: ['jtype', e.k] })))}` : ''}
    ${ppl.length ? `<p class="small muted" style="margin:12px 0 0">Shared most with</p>${barRows(ppl.map(e => ({ label: e.k, n: e.n, go: ['person', e.k] })))}` : ''}`
    : '<p class="muted small" style="margin:0">No bottles opened yet. Remove a bottle with minus to start your journal.</p>'));

  // grapes and regions as rings: top five and the rest
  const gm = new Map();
  wines.forEach(w => grapeShares(w).forEach(g => { const k = lc(g.name); const e = gm.get(k) || { k: g.name, n: 0 }; e.n += g.n; gm.set(k, e); }));
  const gAll = [...gm.values()].sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));
  if (gAll.length) {
    const gTotal = gAll.reduce((a, g) => a + g.n, 0);
    let ri = 0, wi = 0;
    const gRows = gAll.slice(0, 5).map(g => { const red = grapeIsRed(g.k, wines); return { k: g.k, n: g.n, c: red ? RED_SHADES[ri++ % RED_SHADES.length] : WHITE_SHADES[wi++ % WHITE_SHADES.length], go: ['grape', g.k] }; });
    const gRest = gTotal - gRows.reduce((a, g) => a + g.n, 0);
    if (gRest > 0.01) gRows.push({ k: 'Other grapes', n: gRest, c: OTHER_C });
    out.push(insSection('Top grapes', 'red and white varieties', donut(gRows, gTotal, { center: [gAll.length, gAll.length === 1 ? 'grape' : 'grapes'], pctOnly: true, label: 'Share of grapes' })));
  }
  const regions = tally(wines, w => { const r = str(w.region).split(',')[0].trim(); return [r]; }, bottles).sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));
  if (regions.length) {
    const rRows = regions.slice(0, 5).map((e, i) => ({ k: e.k, n: e.n, c: REGION_C[i], go: ['search', e.k] }));
    const rRest = regions.slice(5).reduce((a, e) => a + e.n, 0);
    if (rRest) rRows.push({ k: 'Other regions', n: rRest, c: OTHER_C });
    out.push(insSection('Top regions', '', donut(rRows, total, { center: [regions.length, regions.length === 1 ? 'region' : 'regions'], label: 'Bottles by region' })));
  }

  const hist = S.history.slice().sort((a, b) => a.month.localeCompare(b.month)).slice(-24);
  out.push(insSection('Value over time', '', `${hist.length ? valueChart(hist) : ''}
    <p class="small muted" style="margin:${hist.length ? '4px' : '0'} 0 0">${hist.length < 2 ? 'The app stores the value of your cellar once a month, so this curve grows month by month.' : 'Stored once a month, in your current currency.'}</p>
    <p class="small muted" style="margin:12px 0 0">Bottles in stock at the end of each month</p>${columns(bottlesByMonth(), 'var(--gold)')}`));
  out.push(`<section class="ins-sec discover-card"><div class="sec-head"><h2>Discover new wines</h2></div>
    <p class="small muted" style="margin:0">The AI consultant suggests wines to add to your cellar, based on your stock, finished wines, ratings, drinking habits and usual prices, with sensible quantities.</p>
    <a class="btn accent block" href="#/discover">${ICON.magic}Open the AI consultant</a>
    ${S.wishlist.length ? `<a class="small" href="#/discover" style="text-align:center">Wishlist: ${S.wishlist.length} ${S.wishlist.length === 1 ? 'wine' : 'wines'}</a>` : ''}</section>`);
  return `<main class="screen has-nav insights">${head}<p class="muted small" style="margin:-8px 0 0">${btl(total)} in stock. Tap a row to see the wines.</p>${out.join('')}</main>${nav('insights')}`;
}

/* opens the cellar or the journal with the filter that matches a row in Insights */
function insightsGo(k, v) {
  if (k === 'window') { go('#/window'); return; }
  if (k === 'person' || k === 'jtype') {
    U.f.journal = newF();
    U.f.journal.sel[k === 'person' ? 'person' : 'type'] = [lc(v)];
    go('#/journal');
    return;
  }
  U.f.cellar = newF();
  U.search = '';
  if (k === 'type') U.f.cellar.sel.wine = [lc(v)];
  else if (k === 'grape') U.f.cellar.sel.grape = [lc(v)];
  else U.search = v;
  go('#/cellar');
}

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
        ${g.items.map(w => `<a class="journal-row" href="#/wine/${encodeURIComponent(w.id)}" style="align-items:center">${thumbHtml(w, true)}<div class="row-text" style="gap:6px"><div class="between"><span class="row-title">${flagOf(w)}${esc(wineTitle(w))} ${esc(w.vintage)}</span><span class="muted small" style="flex:none">${w.count} btl</span></div>${timelineHtml(w)}<span class="muted tiny">${esc(windowText(w) || 'No drinking window yet')}</span></div></a>`).join('')}
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
    <div class="row-text" style="gap:5px"><div class="between"><span class="row-title">${flagOf(w)}${esc(wineTitle(w))} ${esc(w.vintage)}${w.count === 0 ? FIN : ''}</span>${w.count > 0 ? `<span class="muted small" style="flex:none">${w.count} btl</span>` : ''}</div>${visual}${subLine ? `<span class="muted tiny ellipsis">${esc(subLine)}</span>` : ''}</div>
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
    const w0 = wineById(id);
    upsertWine(normWine(await api('bestOffer', { id, fresh: !!(w0 && w0.offer) })));
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
  const meta = [w.name ? w.producer : '', w.region, w.vintage, w.type].filter(Boolean).join(' · ');
  return `<main class="screen detail">
    <div class="detail-top"><a class="back" href="#/cellar">${ICON.back}Cellar</a><a class="btn" style="height:40px" href="${editHref}">Edit</a></div>
    ${label}
    <div><h1 class="title" style="font-size:28px">${esc(wineTitle(w))}${isGift(w) ? GIFT_MARK : ''}${w.count === 0 ? FIN : ''}</h1><p class="meta">${flagOf(w)}${esc(meta)}</p></div>
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
