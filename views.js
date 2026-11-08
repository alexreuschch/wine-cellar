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
  return `<div class="ins-cols" style="grid-template-columns:repeat(${cols.length},minmax(0,1fr))">${cols.map(c => {
    const tag = c.go && c.n ? 'button' : 'div';
    const attrs = tag === 'button' ? ` data-act="ins-go" data-k="${esc(c.go[0])}" data-v="${esc(c.go[1])}"` : '';
    return `<${tag} class="ins-col" title="${esc(c.label)}: ${c.n}"${attrs}>
    <span class="ins-col-n">${c.n || ''}</span>
    <span class="ins-col-bar"><span style="height:${c.n ? Math.max(3, c.n / max * 100).toFixed(1) : 0}%;${color ? `background:${color}` : ''}"></span></span>
    <span class="ins-col-l">${esc(c.label)}</span></${tag}>`;
  }).join('')}</div>`;
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
    const tag = x.go || x.info ? 'button' : 'div';
    const attrs = x.info ? ` data-act="info-open" data-k="grape" data-v="${esc(x.info)}"` : x.go ? ` data-act="ins-go" data-k="${esc(x.go[0])}" data-v="${esc(x.go[1])}"` : '';
    return `<${tag} class="ins-leg"${attrs}><span class="sw" style="background:${x.c}"></span><span class="ellipsis">${esc(x.label || x.k)}</span><b>${opts.pctOnly ? '' : Math.round(x.n)}</b><small>${pct(x.n, total)}%</small></${tag}>`;
  }).join('');
  return `<div class="ins-donut${opts.wrap ? ' wrap' : ''}"><svg viewBox="0 0 120 120" width="132" height="132" role="img" aria-label="${esc(opts.label || 'Share')}">${arcs}<text x="60" y="58" text-anchor="middle" class="d-n">${esc(center[0])}</text><text x="60" y="74" text-anchor="middle" class="d-l">${esc(center[1])}</text></svg>
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
  const nw = S.wishlist.length, no = S.orders.length, late = S.orders.some(orderOverdue);
  const head = `<header class="top"><h1 class="title">Insights</h1><div class="top-actions"><button class="icon-btn magic-btn rh-ic" data-act="go-orders" aria-label="Ordered${no ? `, ${no} orders` : ''}">${ICON.box}${no ? `<span class="rh-n${late ? ' late' : ''}">${no}</span>` : ''}</button><button class="icon-btn magic-btn rh-ic" data-act="go-wishlist" aria-label="Wishlist${nw ? `, ${nw} wines` : ''}">${ICON.bookmark}${nw ? `<span class="rh-n">${nw}</span>` : ''}</button><a class="icon-btn magic-btn" href="#/discover" aria-label="AI consultant">${ICON.magic}</a></div></header>`;
  const wines = S.wines.filter(w => w.count > 0);
  const total = wines.reduce((a, w) => a + w.count, 0);
  if (!total) return `<main class="screen has-nav">${head}<div class="empty"><h2>No bottles in stock</h2><p>Insights appear as soon as your cellar has wines.</p></div>${ordersSectionHtml()}${wishSectionHtml()}</main>${nav('insights')}`;
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
  let cols = years.map(e => ({ label: `’${String(e.k).slice(-2)}`, n: e.n, y: e.k, go: ['vintage', String(e.k)] }));
  if (cols.length > 12) {
    const keep = cols.slice(-11), older = cols.slice(0, -11);
    cols = [{ label: `≤’${String(older[older.length - 1].y).slice(-2)}`, n: older.reduce((a, c) => a + c.n, 0), go: ['vintage', older.map(c => c.y).join('|')] }, ...keep];
  }
  const nv = vint.find(e => e.k === 'NV');
  if (nv) cols.push({ label: 'NV', n: nv.n, go: ['vintage', 'NV'] });
  const oldest = years.length ? years[0].k : null, newest = years.length ? years[years.length - 1].k : null;
  out.push(insSection('Vintages', oldest ? (oldest === newest ? String(oldest) : `${oldest} to ${newest}`) : '', columns(cols)));

  // drinking window
  const byStatus = tally(wines, w => [statusOf(w)], bottles).sort((a, b) => STATUS_ORDER.indexOf(a.k) - STATUS_ORDER.indexOf(b.k));
  const due = [];
  for (let y = year; y < year + 8; y++) due.push({ label: y === year ? 'Now' : `’${String(y).slice(-2)}`, n: 0, go: ['drinkby', String(y)] });
  wines.forEach(w => { const p = windowParts(w); if (!p) return; const i = Math.max(0, p.u - year); if (i < due.length) due[i].n += w.count; });
  out.push(insSection('Drinking window', '', `${barRows(byStatus.map(e => ({ label: e.k, n: e.n, c: STATUS[e.k].c, go: ['window', e.k] })), { share: true, total })}
    <p class="small muted" style="margin:10px 0 0">Bottles to drink by the end of each year</p>${columns(due, 'var(--gold)')}`));

  // value
  let cost = 0, street = 0, withCost = 0, withStreet = 0, costB = 0, streetB = 0;
  const valRows = TYPES.map(t => ({ t, c: 0, s: 0 }));
  wines.forEach(w => {
    const a = avgPrice(w), st = streetOf(w), v = valRows.find(x => x.t === w.type);
    if (a !== null) { cost += a * w.count; withCost += w.count; if (v) v.c += a * w.count; }
    if (st !== null) { street += st * w.count; withStreet += w.count; if (v) v.s += st * w.count; }
    if (a !== null && st !== null) { costB += a * w.count; streetB += st * w.count; }
  });
  const bands = [[0, 20], [20, 40], [40, 60], [60, 100], [100, Infinity]];
  const bandRows = bands.map(([lo, hi]) => ({ label: hi === Infinity ? `${lo} and more` : `${lo} to ${hi}`, go: ['price', `${lo}|${hi === Infinity ? '' : hi}`], n: wines.filter(w => { const v = streetOf(w); return v !== null && v >= lo && v < hi; }).reduce((a, w) => a + w.count, 0) }));
  const noStreet = total - withStreet;
  // compare only bottles that have both a purchase price and a street price
  const change = costB > 0 ? Math.round((streetB - costB) / costB * 100) : null;
  out.push(insSection('Value', '', `<div class="ins-tiles"><div><span>Total Costs</span><b class="${change === null || streetB === costB ? '' : costB < streetB ? 'up' : 'down'}">${esc(money(cost, 0))}</b></div><div><span>Total Street Value</span><b>${esc(money(street, 0))}</b>${change !== null ? `<small>${change > 0 ? '+' : ''}${change}% vs. purchase</small>` : ''}</div></div>
    <p class="small muted" style="margin:12px 0 0">Total Street Value by wine type</p>
    ${barRows(valRows.filter(v => v.s > 0).sort((a, b) => b.s - a.s).map(v => ({ label: v.t, n: Math.round(v.s), c: TYPE_CHART[v.t], go: ['type', v.t] })), { money: true })}
    <p class="small muted" style="margin:12px 0 0">Bottles by street price per bottle (${esc(cur())})</p>
    ${barRows(bandRows.filter(b => b.n > 0).concat(noStreet ? [{ label: 'No street price', n: noStreet }] : []), { share: true, total })}`));

  // consumption over the last 12 months
  const opened = S.removals.filter(isOpened);
  const months = [];
  const d0 = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 11; i >= 0; i--) { const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; months.push({ key, label: d.toLocaleDateString('en-US', { month: 'narrow' }), n: 0, go: ['month', key] }); }
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
  out.push(`<section class="ins-sec discover-card"><div class="sec-head"><h2>New wines for your cellar</h2></div>
    <p class="small muted" style="margin:0">The AI consultant suggests wines to add to your cellar, based on your stock, finished wines, ratings, drinking habits and usual prices, with sensible quantities.</p>
    <a class="btn accent block" href="#/discover">${ICON.magic}Open the AI consultant</a></section>`);
  out.push(ordersSectionHtml(), wishSectionHtml());
  return `<main class="screen has-nav insights">${head}<p class="muted small" style="margin:-8px 0 0">${btl(total)} in stock. Tap a row or column to see the wines.</p>${out.join('')}</main>${nav('insights')}`;
}

/* opens the cellar or the journal with the filter that matches a row in Insights */
/* a filter opened from Insights or a background chip is only for this visit: leaving that screen brings back what was set before */
function jumpStart(p) {
  if (U.jump && U.jump.p === p) return;
  U.jump = { p, from: location.hash, f: p === 'window' ? null : U.f[p], search: U.search, jSearch: U.jSearch, winFilter: U.winFilter, termPool: U.termPool };
}
function jumpCheck() {
  const j = U.jump;
  if (!j) return;
  const p = route().p;
  // back where the jump started, for example the wine whose region you looked at: the filter is gone again
  if (location.hash !== j.from && (p === j.p || p === 'wine' || p === 'edit' || p === 'add')) return;
  if (j.p === 'window') U.winFilter = j.winFilter;
  else U.f[j.p] = j.f || newF();
  if (j.p === 'cellar') { U.search = j.search; U.termPool = j.termPool; }
  if (j.p === 'journal') U.jSearch = j.jSearch;
  U.jump = null;
}

function insightsGo(k, v) {
  if (k === 'window') { jumpStart('window'); U.winFilter = v; go('#/window'); return; }
  if (k === 'month') {
    // bottles opened in that month: the month and the occasions of opened bottles
    jumpStart('journal');
    U.f.journal = newF();
    U.jSearch = '';
    const name = monthOf({ date: v });
    U.f.journal.sel.month = [lc(name)];
    U.f.journal.sel.type = [...new Set(S.removals.filter(r => isOpened(r) && monthOf(r) === name).map(r => lc(entryType(r))))];
    go('#/journal');
    return;
  }
  if (k === 'pjournal') {
    // from the producer sheet: your entries of this producer with this retailer or this person
    jumpStart('journal');
    U.f.journal = newF();
    U.jSearch = '';
    U.f.journal.sel[v.k] = [lc(v.v)];
    U.f.journal.sel.producer = [lc(v.producer)];
    go('#/journal');
    return;
  }
  if (k === 'person' || k === 'jtype') {
    jumpStart('journal');
    U.f.journal = newF();
    U.f.journal.sel[k === 'person' ? 'person' : 'type'] = [lc(v)];
    go('#/journal');
    return;
  }
  jumpStart('cellar');
  U.f.cellar = newF();
  U.search = '';
  if (k === 'term') { U.termPool = [v]; U.f.cellar.sel.term = [lc(v.t)]; go('#/cellar'); return; }
  if (k === 'type') U.f.cellar.sel.wine = [lc(v)];
  else if (k === 'grape') U.f.cellar.sel.grape = [lc(v)];
  else if (k === 'food') U.f.cellar.sel.food = [lc(v)];
  else if (k === 'vintage') U.f.cellar.sel.vintage = v.split('|').map(lc);
  else if (k === 'regvint') { const [r, y] = v.split('|'); U.search = r; U.f.cellar.sel.vintage = [lc(y)]; }
  else if (k === 'drinkby') U.f.cellar.sel.drinkby = [v];
  else if (k === 'price') { const [lo, hi] = v.split('|'); U.f.cellar.range = { price: [Number(lo), hi ? Number(hi) - 0.01 : rangeMax('cellar', 'price')] }; }
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
  // in External, the gold AI symbol checks published scores of the wines in the current selection
  const magic = U.topMode === 'ext' ? rhIconHtml(topPool().filter(w => passes('top', w)).map(w => w.id)) : '';
  const lead = `<header class="top"><h1 class="title">Top rated</h1><div class="top-actions">${magic}${btn}</div></header>
    ${filters}
    <div class="toggle"><button class="${U.topMode === 'mine' ? 'on' : ''}" data-act="top-mode" data-v="mine">My rating</button><button class="${U.topMode === 'ext' ? 'on' : ''}" data-act="top-mode" data-v="ext">External</button></div>
    ${U.topFinished ? `<p class="muted tiny" style="margin:-6px 0 0;display:flex;align-items:center;gap:2px">${FIN}<span style="margin-left:4px">marks a finished wine with no bottles left</span></p>` : ''}
    ${U.topDisc ? `<p class="muted tiny" style="margin:-6px 0 0;display:flex;align-items:center;gap:6px">${DISC}<span>a wine you tasted out, never in your cellar</span></p>` : ''}`;
  return `<main class="screen has-nav">${lead}<div id="top-list">${topBody()}</div></main>${nav('top')}`;
}

/* like Show finished wines in the cellar: links below the list to add finished wines and discoveries */
function topMoreHtml() {
  const fin = finishedWines().length, disc = discWines().length;
  return `${fin ? `<button class="btn ghost" data-act="top-toggle-finished">${U.topFinished ? 'Hide' : 'Show'} finished wines (${fin})</button>` : ''}${disc ? `<button class="btn ghost" data-act="top-toggle-disc">${U.topDisc ? 'Hide' : 'Show'} discoveries (${disc})</button>` : ''}`;
}
function topBody() {
  // in External, the check for published scores of the wines in the current selection
  const bar = U.topMode === 'ext' ? rhBarHtml() : '';
  return bar + topList() + topMoreHtml();
}
function topList() {
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
  const disc = isDisc(w);
  return `<a class="journal-row${w.count === 0 && !disc ? ' finished' : ''}" href="#/wine/${encodeURIComponent(w.id)}" style="align-items:center"><span class="rank">${i + 1}</span>${thumbHtml(w, true)}
    <div class="row-text" style="gap:5px"><div class="between"><span class="row-title">${flagOf(w)}${esc(wineTitle(w))} ${esc(w.vintage)}${disc ? DISC : w.count === 0 ? FIN : ''}</span>${w.count > 0 ? `<span class="muted small" style="flex:none">${w.count} btl</span>` : ''}</div>${visual}${subLine ? `<span class="muted tiny ellipsis">${esc(subLine)}</span>` : ''}</div>
    <div class="score">${score}</div></a>`;
}

/* ------------------------------------------------------------ view: journal */

function peopleLine(r) {
  const names = namesOf(r.people);
  if (!names.length) return '';
  const hearts = namesOf(r.hearts).map(lc);
  const pre = { Gift: 'Given to ', Received: 'From ', Sale: 'Sold to ', Purchase: 'Recommended by ' }[r.type] || 'With ';
  return pre + names.map(n => esc(n) + (hearts.includes(lc(n)) ? `<span class="heart-on" aria-label="favorite wine">${HEART_SM}</span>` : '')).join(', ');
}

/** Quantity, location, retailer and price of an entry, for journal and detail rows. */
function entryMeta(r, withLoc = true) {
  const parts = [];
  if (r.qty > 1) parts.push(`${r.qty} bottles`);
  if (r.type === 'Discovery' && r.price !== null) {
    // what you paid, where, and against the shop price at the time
    const shop = r.shopRef ? convTo(r.shopRef.v, r.shopRef.cur, r.priceCur) : null, f = shop ? r.price / shop : null;
    parts.push(`paid ${priceText(r.price, r.priceCur)}${r.venue === 'restaurant' ? ' at a restaurant' : r.venue === 'shop' ? ' in a shop' : ''}${f ? r.venue === 'shop' ? `, ${f >= 1 ? `${Math.round((f - 1) * 100)}% above` : `${Math.round((1 - f) * 100)}% below`} the shop price` : `, ${fmtNum(f, 1)}× the shop price` : ''}`);
  }
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
  const alias = namesOf(r.people).map(n => personInfo(n).aliases).join(' ');
  const hay = lc([r.people, alias, r.retailer, entryType(r), w ? fullName(w) : r.wineName].join(' '));
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
  return `${r.occasion ? `<span class="small">${r.type === 'Discovery' ? 'At ' : ''}${esc(r.occasion)}</span>` : ''}${ppl ? `<span class="small muted">${ppl}</span>` : ''}${meta ? `<span class="small muted">${meta}</span>` : ''}${r.food ? `<span class="tiny" style="color:var(--food)">${esc(r.food)}</span>` : ''}${r.note ? `<span class="small muted ellipsis">${esc(r.note)}</span>` : ''}`;
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

/* other names and a note of a person, saved in the People tab */
async function savePersonInfo(name, aliases, note) {
  const prev = S.peopleInfo.slice();
  const x = { name, aliases: splitList(aliases).filter(a => lc(a) !== lc(name)).join(', '), note: str(note).trim() };
  S.peopleInfo = S.peopleInfo.filter(y => lc(y.name) !== lc(name)).concat(x.aliases || x.note ? [x] : []);
  U.personEdit = null;
  persist();
  refreshView();
  try {
    const d = await api('savePersonInfo', x);
    if (d && Array.isArray(d.peopleInfo)) { S.peopleInfo = d.peopleInfo.map(normPersonInfo).filter(y => y.name); S.people = Array.isArray(d.people) ? d.people : S.people; persist(); refreshView(); }
    toast('Saved');
  } catch (e) {
    S.peopleInfo = prev; persist(); refreshView();
    toast(/Unknown action/i.test(e.message) ? 'Other names and notes need the new Code.gs.' : 'Not saved: ' + e.message);
  }
}

function personSummary(p) {
  const all = allEntries().filter(r => namesOf(r.people).map(lc).includes(p));
  const person = knownPeople().find(x => lc(x.name) === p);
  const name = person ? person.name : p;
  const n = t => all.filter(r => r.type === t).reduce((a, r) => a + r.qty, 0);
  const given = n('Gift'), sold = n('Sale'), received = n('Received');
  const shared = all.filter(isOpened).reduce((a, r) => a + r.qty, 0);
  const pl = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  const stats = [shared ? pl(shared, 'bottle shared', 'bottles shared') : '', given ? pl(given, 'given as gift', 'given as gifts') : '', sold ? pl(sold, 'sold', 'sold') : '', received ? pl(received, 'received as gift', 'received as gifts') : ''].filter(Boolean).join(' · ');
  const sales = all.filter(r => r.type === 'Sale' && r.price !== null);
  const saleSum = sales.reduce((a, r) => a + (conv(r.price, r.priceCur) || 0) * r.qty, 0);
  const favIds = [...new Set(all.filter(r => namesOf(r.hearts).map(lc).includes(p)).map(r => r.wineId))];
  const favs = favIds.map(id => wineById(id)).filter(Boolean);
  const fromThem = [...new Set(all.filter(r => r.type === 'Received').map(r => r.wineId))].map(id => wineById(id)).filter(Boolean);
  const toThem = [...new Set(all.filter(r => r.type === 'Gift').map(r => r.wineId))].map(id => wineById(id)).filter(Boolean);
  const info = personInfo(name);
  const editing = U.personEdit === p;
  const details = editing
    ? `<div class="person-edit"><label class="field">Also called<input id="pe-aliases" placeholder="For example Tom, Tommy" value="${esc(info.aliases)}"></label>
        <label class="field">Note<textarea id="pe-note" rows="2" placeholder="For example loves Barolo, no oaky whites">${esc(info.note)}</textarea></label>
        <div class="grid2"><button class="btn" data-act="pe-cancel">Cancel</button><button class="btn primary" data-act="pe-save" data-v="${esc(name)}">Save</button></div></div>`
    : `${info.aliases ? `<p class="small" style="margin:0"><span class="muted">Also called</span> ${esc(info.aliases)}</p>` : ''}${info.note ? `<p class="small" style="margin:0">${esc(info.note)}</p>` : ''}
      <button class="link-btn" data-act="pe-edit" data-v="${esc(p)}">${ICON.edit || ''}${info.aliases || info.note ? 'Edit other names and note' : 'Add other names and a note'}</button>`;
  return `<div class="card" style="display:flex;flex-direction:column;gap:8px">
    <div class="between"><h2 style="font-size:17px;font-weight:600">${esc(name)}</h2><button class="icon-btn" data-act="f-chip" data-ctx="journal" data-k="person" data-v="${esc(p)}" aria-label="Remove person filter">${ICON.x}</button></div>
    <p class="muted small" style="margin:-8px 0 0">${stats}${sales.length ? ` · <span class="up">${money(saleSum)} from sales</span>` : ''}</p>
    ${details}
    ${favs.length ? `<span class="tiny muted">Favorite wines</span><div class="tags">${favs.map(w => `<a class="tag fav" href="#/wine/${encodeURIComponent(w.id)}">${HEART_SM}${esc(wineTitle(w))} ${esc(w.vintage)}</a>`).join('')}</div>` : ''}
    ${fromThem.length ? `<span class="tiny muted">Gifts from ${esc(name)}</span><div class="tags">${fromThem.map(w => `<a class="tag gifted" href="#/wine/${encodeURIComponent(w.id)}">${ICON.gift}${esc(wineTitle(w))} ${esc(w.vintage)}</a>`).join('')}</div>` : ''}
    ${toThem.length ? `<span class="tiny muted">Gifts to ${esc(name)}</span><div class="tags">${toThem.map(w => `<a class="tag gifted" href="#/wine/${encodeURIComponent(w.id)}">${ICON.gift}${esc(wineTitle(w))} ${esc(w.vintage)}</a>`).join('')}</div>` : ''}
  </div>`;
}

function viewJournal() {
  if (!allEntries().length) {
    return `<main class="screen has-nav"><h1 class="title">Journal</h1><div class="empty"><h2>No entries yet</h2><p>Bottles you add, take out, give away or sell show up here.</p></div></main>${nav('journal')}`;
  }
  const filters = filterArea('journal');
  const btn = filterButton('journal');
  const ppl = sel('journal', 'person');
  return `<main class="screen has-nav"><header class="top"><h1 class="title">Journal</h1><div class="top-actions"><a class="icon-btn magic-btn" href="#/journal-ai" aria-label="Journal Assistant">${ICON.magic}</a></div></header>
    <div style="display:flex;gap:8px"><label class="search" style="flex:1;min-width:0">${ICON.search}<input type="search" data-input="jsearch" aria-label="Search the journal" placeholder="Person, wine, type or retailer" value="${esc(U.jSearch)}"></label>${btn}</div>
    ${filters}
    ${ppl.length === 1 ? personSummary(ppl[0]) : ''}
    <div id="journal-list">${journalList()}</div></main>${nav('journal')}`;
}

/* ------------------------------------------------------------ view: wine detail */

/* a wine meant for ageing that stays in a place for a short stay, such as the kitchen, for more than a month */
function shortStayHtml(w, e) {
  if (!e.loc || locInfoOf(e.loc).kind !== 'short' || !(w.drinkUntil && w.drinkUntil >= new Date().getFullYear() + 2)) return '';
  const last = S.removals.filter(r => r.wineId === w.id && r.dir === 'in' && lc(r.loc) === lc(e.loc)).map(r => r.date).sort().pop();
  if (last && (Date.now() - (parseISO(last) || new Date()).getTime()) / 864e5 < 30) return '';
  return `<span class="space-note warn" style="margin-top:4px">${ICON.pin}<span>${esc(e.loc)} is for a short stay. For ageing, move it to a cellar location in Edit.</span></span>`;
}

const whereText = e => [shelfLabel(e.loc, shelfVal(e.shelf)), posShow(e.pos)].filter(Boolean).join(' · ');

function stockHtml(w) {
  const rows = w.stock.map((e, i) => `<div class="stock-row"><div style="min-width:0"><span class="stock-loc">${e.loc ? locIcon(e.loc) : ICON.pin}${esc(e.loc || 'No location')}</span>${whereText(e) ? `<span class="stock-where">${esc(whereText(e))}</span>` : ''}${zoneAt(e.loc, e.shelf) ? `<span class="stock-zone">${ICON.temp}${esc(zoneText(zoneAt(e.loc, e.shelf)))}</span>` : ''}${zoneWarn(w, e.loc, e.shelf) ? `<span class="zone-warn small">${esc(zoneWarn(w, e.loc, e.shelf))}</span>` : ''}${isOwc(e.loc) ? '<span class="stock-zone">In the original wooden case</span>' : ''}${shortStayHtml(w, e)}</div>
    <div class="stepper"><button data-act="minus" data-id="${esc(w.id)}" data-i="${i}" aria-label="Take a bottle from ${esc(placeLabel(e))}">${ICON.minus}</button><span>${e.n}</span><button data-act="plus" data-id="${esc(w.id)}" data-i="${i}" aria-label="Add bottles to ${esc(placeLabel(e))}">${ICON.plus}</button></div></div>`).join('');
  return `<section><div class="sec-head"><h2>In stock</h2><span class="small muted">${w.count} ${w.count === 1 ? 'bottle' : 'bottles'}</span></div>
    <div class="card stock-card">${rows || `<div class="between"><span class="muted small">No bottles left</span><button class="btn" style="height:38px" data-act="plus" data-id="${esc(w.id)}">${ICON.plus}Add bottles</button></div>`}</div>
    ${w.stock.length > 1 ? '<p class="muted tiny" style="margin:-4px 0 0">Storage places and moving bottles are managed in Edit.</p>' : ''}
    ${ordersFor(w.id).map(o => `<button class="ord-line" data-act="ord-edit" data-id="${esc(o.id)}">${ICON.box}<span><b>${o.qty} on order</b>${o.retailer ? ` from ${esc(o.retailer)}` : ''} · ${esc(orderWhen(o).text)}</span></button>`).join('')}</section>`;
}

/* where and when you tasted it out, with your rating going to the wine; for a discovery also how to bring it into the cellar */
function discoveryHtml(w) {
  const list = S.removals.filter(r => r.wineId === w.id && r.dir === 'taste').sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length && !isDisc(w)) return '';
  const busy = DISC_BUSY.has(w.id) ? `<div class="banner"><span class="spinner"></span>Filling in details, drinking window, taste profile and background…</div>` : '';
  const rows = list.map(r => `<button class="hist as-btn" data-act="edit-entry" data-id="${esc(r.id)}" aria-label="Edit discovery from ${esc(fmtDate(r.date))}"><span class="hist-head"><span class="tiny muted">${esc(fmtDate(r.date))}</span>${typeBadge(r.type)}</span>${entryBody(r)}</button>`).join('');
  return `<section style="gap:6px"><div class="sec-head"><h2>${isDisc(w) ? 'Discovered' : 'Discoveries'}</h2>${isDisc(w) ? `<button class="link-btn" data-act="plus" data-id="${esc(w.id)}">${ICON.plus}Add bottles</button>` : ''}</div>
    ${busy}${rows}
    ${isDisc(w) ? '<p class="muted tiny" style="margin:4px 0 0">A wine you tasted out, not in your cellar. Add bottles if you buy it, then it moves to the cellar.</p>' : ''}</section>`;
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

const offerRun = new Set();

function offerHtml(w) {
  const o = w.offer, area = shopCountryName();
  const busyNow = offerRun.has(w.id);
  const btn = `<button class="link-btn" data-act="offer-one" data-id="${esc(w.id)}"${busyNow ? ' disabled' : ''}>${ICON.refresh}${busyNow ? 'Searching…' : o ? 'Update best offer' : 'Find best offer'}</button>`;
  let body;
  if (!o) {
    body = `<p class="muted small" style="margin:0">${busyNow ? 'Searching online shops…' : `The online shop with the lowest price for this wine, for buying in ${area}, to buy more bottles.`}</p>`;
  } else {
    body = `<div class="between" style="gap:12px">${offerShopHtml(o, w)}
      <a class="btn accent offer-btn" href="${esc(o.url)}" target="_blank" rel="noopener" data-shop="${esc(o.shop)}" data-sref="wine:${esc(w.id)}">${esc(priceText(o.v, o.cur))}${ICON.link}</a></div>
      ${offerShipHtml(o, lastBuyQty(w))}${shopBackHtml('wine:' + w.id)}
      <p class="muted tiny" style="margin:0">Found by AI on the web. Check price and vintage in the shop before you buy.</p>
      ${offerOtherCountry(o) ? `<p class="muted tiny" style="margin:0">Found for ${esc(offerForName(o))}. Tap Update best offer to search for ${esc(area)}.</p>` : ''}`;
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

/* who recommended a wine: the people of its purchases */
const wineRecBy = w => [...new Set(inEntries(w).filter(r => r.type === 'Purchase').flatMap(r => namesOf(r.people)))].join(', ');
function purchasesHtml(w, editable) {
  const list = inEntries(w).sort((a, b) => b.date.localeCompare(a.date));
  const row = r => {
    const who = r.type === 'Purchase' ? (r.retailer ? (editable ? esc(r.retailer) : retailerLink(r.retailer)) : 'Retailer not set')
      : r.type === 'Received' ? `${GIFT_MARK.replace('gift-mark', 'gift-mark inline')}Gift from ${esc(namesOf(r.people).join(', ') || 'someone')}` : 'Added';
    const meta = [esc(fmtDate(r.date)), r.qty > 1 ? `${r.qty} bottles` : '1 bottle', r.type === 'Received' ? `${money(0)}, gift` : (r.price !== null ? `${priceText(r.price, r.priceCur)}${r.qty > 1 ? ' each' : ''}` : 'Price not set')].join(' · ');
    const rec = r.type === 'Purchase' && namesOf(r.people).length ? `<span class="small muted">Recommended by ${esc(namesOf(r.people).join(', '))}</span>` : '';
    const body = `<span class="rec-main">${who}</span><span class="small muted">${meta}</span>${rec}${r.note ? `<span class="small">${esc(r.note)}</span>` : ''}`;
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
  const label = wineTopHtml(w);
  const meta = [w.name ? w.producer : '', w.region, w.vintage, w.type, sizeText(w) || clText(w.size || 75), alcText(w)].filter(Boolean).join(' · ');
  return `<main class="screen detail">
    <div class="detail-top">${isDisc(w) ? backLinkHtml('#/top', 'Top rated') : backLinkHtml('#/cellar', 'Cellar')}<span style="display:flex;gap:6px;align-items:center"><button class="icon-btn" data-act="share-wine" data-id="${esc(w.id)}" aria-label="Share this wine">${ICON.share}</button><a class="btn" style="height:40px" href="${editHref}">Edit</a></span></div>
    ${label}
    <div><h1 class="title" style="font-size:28px">${esc(wineTitle(w))}${isGift(w) ? GIFT_MARK : ''}${isDisc(w) ? DISC : w.count === 0 ? FIN : ''}</h1><p class="meta">${flagOf(w)}${esc(meta)}</p>${recLineHtml(wineRecBy(w))}</div>
    ${isDisc(w) ? discoveryHtml(w) : stockHtml(w)}
    <section>
      <div class="sec-head"><h2>Drinking window</h2>${p ? `<span class="small" style="color:${STATUS[s].c};font-weight:500">${statusLine(w)}</span>` : ''}</div>
      ${p ? `${timelineHtml(w, true)}${timelineScaleHtml(w)}<p class="muted tiny" style="margin:0">${windowText(w)}</p>`
        : `<p class="muted small" style="margin:0">No drinking window set yet. <a href="${editHref}">Add one</a></p>`}
    </section>
    ${vintCompareHtml(w)}
    <section>
      <div class="rating-head"><h2>My rating</h2>${w.myRating === null ? `<a class="small" href="${editHref}">Rate in Edit</a>` : `<span class="rating-val">${w.myRating}%</span>`}</div>
      ${w.myRating === null ? '' : segsHtml(w.myRating, 22, 'lg')}
      ${w.myRating === null ? '' : `<p class="rate-word">${esc(rateWordText(w.myRating))}</p>`}
      <button class="rate-fav${w.myFav ? ' on' : ''}" data-act="wine-fav" data-id="${esc(w.id)}" aria-pressed="${w.myFav}">${ICON.heart}One of my favorites</button>
    </section>
    <section>
      <h2>External ratings</h2>
      ${w.ratings.length ? `<div class="info-list">${w.ratings.map(r => infoRow(esc(r.sys), `<span class="rate-val">${ratingVisual(r)}</span>`)).join('')}</div>`
        : `<p class="muted small" style="margin:0">No external ratings yet. <a href="${editHref}">Add them in Edit</a></p>`}
    </section>
    ${valueHtml(w)}
    ${offerHtml(w)}
    ${isDisc(w) && !inEntries(w).length ? '' : `<section style="gap:4px">${secHead(ICON.cart, 'Purchases')}${purchasesHtml(w, false)}</section>`}
    ${isDisc(w) ? '' : discoveryHtml(w)}
    ${aboutHtml(w)}
    ${profileHtml(w, editHref)}
    ${isDisc(w) && !hist.length ? '' : `<section style="gap:0">
      <h2 style="margin-bottom:4px">Bottles removed</h2>
      ${hist.length ? hist.map(r => `<button class="hist as-btn" data-act="edit-entry" data-id="${esc(r.id)}" aria-label="Edit entry from ${esc(fmtDate(r.date))}"><span class="hist-head"><span class="tiny muted">${esc(fmtDate(r.date))}</span>${typeBadge(r.type)}</span>
        ${r.occasion ? `<span style="font-size:14px;font-weight:600">${esc(r.occasion)}</span>` : ''}${entryBody(Object.assign({}, r, { occasion: '' }))}</button>`).join('') + '<p class="muted tiny" style="margin:8px 0 0">Tap an entry to edit it.</p>'
        : '<p class="muted small" style="margin:0">No bottles removed yet.</p>'}
    </section>`}
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
  rateRefresh('form');
}

/* the heart on the wine page: one of my favorites, saved right away */
async function toggleWineFav(id) {
  const w = wineById(id);
  if (!w) return;
  w.myFav = !w.myFav;
  persist(); refreshView();
  try { upsertWine(normWine(await api('update', { id, fields: { myFav: w.myFav ? true : '' } }))); persist(); }
  catch (e) { w.myFav = !w.myFav; persist(); refreshView(); toast('Not saved: ' + e.message); }
}


/* ------------------------------------------------------------ share a wine as a picture */
/* The card is drawn here on the phone and handed to the share menu of the phone, for WhatsApp, iMessage and others.
   It shows the wine and your own rating, never stock, prices, places or people, and nothing is stored anywhere. */
function shareLoadImg(src) {
  return new Promise(res => { if (!src) { res(null); return; } const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}
function shareWrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/), lines = [];
  let line = '';
  words.forEach(wd => { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t; });
  if (line) lines.push(line);
  return lines;
}
function shareRound(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
async function shareCard(w) {
  const W = 1080, H = 1350, P = 80;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  try { await document.fonts.ready; } catch (e) { /* draw with what is there */ }
  const serif = '"DM Serif Display", Georgia, serif', sans = 'Inter, system-ui, sans-serif';
  // background: dark aubergine with a soft light from the top
  const g = x.createRadialGradient(W / 2, 260, 60, W / 2, 260, 900); g.addColorStop(0, '#3A1622'); g.addColorStop(1, '#1A0C12');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // the Vintary band at the bottom, the wine above it, centered in the space that is left
  const bh = 330, by = H - bh;
  const shown = document.querySelector('#label-img');
  const img = (shown && shown.complete && shown.naturalWidth ? shown : null) || await shareLoadImg(w.thumb);
  x.font = `60px ${serif}`;
  const tl = shareWrap(x, wineTitle(w), W - 2 * P).slice(0, 2);
  const rw = w.myRating !== null ? rateWord(w.myRating) : null;
  const sub = [w.producer !== wineTitle(w) ? w.producer : '', w.vintage, w.size && w.size !== 75 ? sizeName(w.size) : ''].filter(Boolean).join(' · ');
  const draw = (y0, on) => {
    let y = y0;
    if (img) {
      const mh = 380 - (tl.length - 1) * 60, mw = 360, sc = Math.min(mw / img.naturalWidth, mh / img.naturalHeight);
      const iw = img.naturalWidth * sc, ih = img.naturalHeight * sc, ix = (W - iw) / 2;
      if (on) {
        x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 44; x.shadowOffsetY = 18; shareRound(x, ix, y, iw, ih, 16); x.fillStyle = '#000'; x.fill(); x.restore();
        x.save(); shareRound(x, ix, y, iw, ih, 16); x.clip(); x.drawImage(img, ix, y, iw, ih); x.restore();
      }
      y += ih + 66;
    } else y += 30;
    x.textAlign = 'center';
    if (on) { x.fillStyle = '#C2ACA8'; x.font = `500 28px ${sans}`; x.fillText([w.type, w.region].filter(Boolean).join(' · ').toUpperCase(), W / 2, y); }
    y += 74;
    if (on) { x.fillStyle = '#FFF8E9'; x.font = `60px ${serif}`; }
    tl.forEach(l => { if (on) x.fillText(l, W / 2, y); y += 66; });
    if (on) { x.fillStyle = '#F0E4D8'; x.font = `400 34px ${sans}`; x.fillText(sub, W / 2, y - 8); }
    if (w.myRating !== null) {
      y += 70;
      if (on) { x.fillStyle = '#C2ACA8'; x.font = `500 26px ${sans}`; x.fillText('MY RATING', W / 2, y); }
      y += 70;
      if (on) { x.fillStyle = '#E6CB98'; x.font = `72px ${serif}`; x.fillText(w.myRating + '%', W / 2, y); }
      y += 36;
      const n = Math.round(w.myRating / 5), bw = W - 2 * P - 120, gap = 6, sw = (bw - gap * 19) / 20, bx = (W - bw) / 2;
      if (on) SEG_COLORS.forEach((col, i) => { x.fillStyle = i < n ? col : '#45232F'; shareRound(x, bx + i * (sw + gap), y, sw, 18, 4); x.fill(); });
      y += 18;
      if (rw) { y += 50; if (on) { x.fillStyle = '#F0E4D8'; x.font = `500 32px ${sans}`; x.fillText(rw[1] + (rw[2] ? ' · ' + rw[2] : ''), W / 2, y); } }
      if (w.myFav) { y += 52; if (on) { x.fillStyle = '#EE7A8D'; x.font = `500 30px ${sans}`; x.fillText('♥ One of my favorites', W / 2, y); } }
    }
    return y;
  };
  // the drinking window only when there is room for it
  const room = by - 60;
  const end = draw(0, false);
  const p = windowParts(w), withWin = p && end + 110 < room - 40;
  const total = end + (withWin ? 110 : 0);
  const top = Math.max(50, Math.round((by - total) / 2 - 10));
  let y = draw(top, true);
  if (withWin) {
    const s = statusOf(w);
    y += 66; x.fillStyle = STATUS[s].c; x.font = `600 30px ${sans}`; x.fillText(s, W / 2, y);
    y += 44; x.fillStyle = '#C2ACA8'; x.font = `400 28px ${sans}`; x.fillText(windowText(w), W / 2, y);
  }
  // the band: logo and name as one centered mark, the claim below, Coming soon as a small badge
  x.fillStyle = '#620018'; x.fillRect(0, by, W, bh);
  x.fillStyle = 'rgba(230,203,152,.5)'; x.fillRect(0, by, W, 2);
  const logo = await shareLoadImg('icon-192.png');
  const ls = 112, gapL = 26;
  x.font = `84px ${serif}`;
  const nw = x.measureText('Vintary').width, mw0 = (logo ? ls + gapL : 0) + nw, mx = (W - mw0) / 2, my = by + 44;
  if (logo) { x.save(); shareRound(x, mx, my, ls, ls, 26); x.clip(); x.drawImage(logo, mx, my, ls, ls); x.restore(); }
  x.textAlign = 'left'; x.fillStyle = '#FFF8E9'; x.fillText('Vintary', mx + (logo ? ls + gapL : 0), my + 84);
  x.textAlign = 'center'; x.fillStyle = '#F4DFB4'; x.font = `400 34px ${sans}`;
  x.fillText('Your personal wine companion · Wine, made personal.', W / 2, by + 212);
  x.font = `600 24px ${sans}`;
  const cs = 'COMING SOON', cw = x.measureText(cs).width + 24 * 3 + 56, cx = (W - cw) / 2, cy = by + 248;
  x.strokeStyle = 'rgba(244,223,180,.75)'; x.lineWidth = 2; shareRound(x, cx, cy, cw, 50, 25); x.stroke();
  x.fillStyle = '#F4DFB4';
  if ('letterSpacing' in x) { x.letterSpacing = '3px'; x.fillText(cs, W / 2 + 1.5, cy + 34); x.letterSpacing = '0px'; } else x.fillText(cs, W / 2, cy + 34);
  return new Promise(res => c.toBlob(b => res(b), 'image/jpeg', 0.9));
}
/* Share: first the sheet that asks whether to add a shop link, and for which country */
const SHARE = { id: null, cc: '', phase: '', offer: null, note: '' };
const shareHomeOffer = w => {
  const o = w && w.offer;
  if (!o || !o.url || offerOtherCountry(o)) return null;
  return o.date && (Date.now() - new Date(o.date).getTime()) / 86400000 > 14 ? null : o;
};
function shareOpen(id) {
  Object.assign(SHARE, { id, cc: shopCountry(), phase: 'ask', offer: null, note: '' });
  shareRender();
}
function shareClose() { SHARE.phase = ''; shareRender(); }
function shareOfferHtml(o) {
  return `<div class="between" style="gap:12px">${offerShopHtml(o, wineById(SHARE.id))}<a class="btn accent offer-btn" href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.cur)} ${esc(fmtNum(o.v, 2))}${ICON.link}</a></div>`;
}
function shareRender() {
  const root = $('#sheet-root');
  if (!root) return;
  if (!SHARE.phase) { if (root.querySelector('.share-sheet')) root.innerHTML = ''; return; }
  const w = wineById(SHARE.id);
  if (!w) { SHARE.phase = ''; root.innerHTML = ''; return; }
  const name = SHOP_COUNTRIES[SHARE.cc] || SHARE.cc, home = SHARE.cc === shopCountry();
  const ready = home && shareHomeOffer(w), old = !home && S.version && S.version < 40;
  let body;
  if (SHARE.phase === 'ask') {
    body = `<p class="small" style="margin:0;line-height:1.5">Sends a picture with the label, your rating and the heart if it is a favorite. You can add a link to the best online offer, so your friend can buy it.</p>
      <div class="field">Where is your friend?<button class="pick-btn" data-act="pick-open" data-k="share"><span class="ellipsis">${flagOfCode(SHARE.cc)}${esc(name)}</span>${ICON.chevron || ''}</button></div>
      <p class="tiny muted" style="margin:0">${old ? 'A shop link for another country needs the new Code.gs.' : ready ? `Uses your best offer from ${esc(ready.shop)}.` : `Searches online shops in ${esc(name)}, about 2 to 5 cents. Offers of the last 14 days are reused.`}</p>
      <div class="grid2"><button class="btn" data-act="share-go" data-link="0">Picture only</button><button class="btn primary" data-act="share-go" data-link="1"${old ? ' disabled' : ''}>With shop link</button></div>`;
  } else if (SHARE.phase === 'busy') {
    body = `<p class="small muted" style="margin:0">${ICON.refresh}Looking for the best offer in ${esc(name)}…</p>`;
  } else {
    body = `${SHARE.offer ? `${shareOfferHtml(SHARE.offer)}<p class="muted tiny" style="margin:0">Found by AI on the web. The link goes with the picture; check it if you like.</p>`
        : `<p class="small" style="margin:0">${esc(SHARE.note || `No online shop in ${name} sells this wine right now.`)} The picture is shared without a link.</p>`}
      <button class="btn primary" data-act="share-send">${ICON.share}Share</button>`;
  }
  root.innerHTML = `<div class="sheet-backdrop" data-act="share-close"></div><div class="sheet share-sheet" role="dialog" aria-modal="true" aria-label="Share this wine"><div class="grab"></div>
    <div class="between"><h2 style="font-size:18px;font-weight:600">Share this wine</h2><button class="icon-btn" data-act="share-close" aria-label="Close">${ICON.x}</button></div>${body}</div>`;
}
async function shareGo(link) {
  const w = wineById(SHARE.id);
  if (!w) return;
  // picture only, or the best offer you already have: share right away
  const have = SHARE.cc === shopCountry() ? shareHomeOffer(w) : null;
  if (!link || have) { const o = link ? have : null; shareClose(); shareWine(w.id, o); return; }
  SHARE.phase = 'busy'; shareRender();
  try {
    if (SHARE.cc === shopCountry()) {
      upsertWine(normWine(await api('bestOffer', { id: w.id })));
      persist(); refreshView();
      SHARE.offer = shareHomeOffer(wineById(w.id)) || wineById(w.id).offer || null;
    } else {
      const size = Number(w.size) > 0 && Number(w.size) !== 75 ? ` (${w.size} cl)` : '';
      SHARE.offer = await api('offerFor', { wine: [w.producer, w.name, w.vintage].filter(x => str(x).trim()).join(' ') + size, region: w.region || '', country: SHARE.cc });
    }
    SHARE.note = '';
  } catch (e) {
    SHARE.offer = null;
    SHARE.note = /No online shop/.test(str(e.message)) ? '' : aiErr(e.message);
  }
  if (!SHARE.phase) return;
  // a new tap is needed to open the share menu, so the result is shown first
  SHARE.phase = 'ready'; shareRender();
}

async function shareWine(id, offer) {
  shareClose();
  const w = wineById(id);
  if (!w) return;
  busy(true, 'Preparing the picture…');
  let blob = null;
  try { blob = await shareCard(w); } catch (e) { blob = null; }
  busy(false);
  if (!blob) { toast('The picture could not be made.'); return; }
  const name = `vintary-${String(fullName(w)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'wine'}.jpg`;
  const file = new File([blob], name, { type: 'image/jpeg' });
  const text = `${fullName(w)}${w.myRating !== null ? ` · my rating ${w.myRating}%` : ''}${offer && offer.url ? `\n\nAvailable at ${offer.shop}: ${offer.url}` : ''}`;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); } catch (e) { if (e && e.name !== 'AbortError') toast('Sharing did not work.'); }
    return;
  }
  // no share menu with pictures here: save the picture instead
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  if (offer && offer.url && navigator.clipboard) { navigator.clipboard.writeText(text).catch(() => {}); toast('Picture saved, the text with the shop link is copied. Send both from your messenger.', 6000); }
  else toast('Picture saved. Send it from your photos or downloads.', 5000);
}
