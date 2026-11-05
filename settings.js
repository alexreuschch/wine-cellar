'use strict';

/* Wine Cellar: Settings screen, AI usage and export. Loaded after app.js, in the order of index.html. */

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

/* AI usage of the last months, logged by the script with estimated list prices */
const USAGE_ORDER = ['Label details', 'Street prices', 'Best offer', 'Sommelier', 'Consultant', 'Other'];
function usageHtml() {
  if (!S.usage.length) return S.version && S.version < 13 ? '' : `<section class="box"><span class="box-title">AI usage</span><p class="small muted" style="margin:0">No AI requests counted yet.</p></section>`;
  const usd = v => `USD ${fmtNum(v, 2)}`;
  const monthName = m => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); };
  const cur0 = S.usage[0];
  const kinds = USAGE_ORDER.filter(k => cur0.kinds[k]);
  const total = m => Object.values(m.kinds).reduce((a, e) => a + (Number(e.usd) || 0), 0);
  const calls = m => Object.values(m.kinds).reduce((a, e) => a + (Number(e.calls) || 0), 0);
  return `<section class="box"><span class="box-title">AI usage</span>
    <p class="small" style="margin:0"><b>${esc(monthName(cur0.month))}</b>: ${calls(cur0)} requests, about ${usd(total(cur0))}</p>
    ${kinds.length ? `<div class="usage-tab"><div class="usage-row head"><span>Feature</span><span>Requests</span><span>Searches</span><span>Cost</span></div>
      ${kinds.map(k => { const e = cur0.kinds[k]; return `<div class="usage-row"><span>${esc(k)}</span><span>${e.calls}</span><span>${e.searches || 0}</span><span>${usd(e.usd)}</span></div>`; }).join('')}</div>` : ''}
    ${S.usage.slice(1).filter(m => calls(m)).map(m => `<p class="small muted" style="margin:0">${esc(monthName(m.month))}: ${calls(m)} requests, about ${usd(total(m))}</p>`).join('')}
    <p class="muted tiny" style="margin:0">Estimated from list prices of the AI service. The Claude Console shows the exact amounts under Usage.</p></section>`;
}

/* everything in one Excel file, built in the app */
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
async function exportExcel() {
  if (U.exporting) return;
  U.exporting = true;
  refreshView();
  try {
    if (!window.XLSX) await loadScript(XLSX_URL, 20000);
    const c = cur();
    const money2 = v => (v === null || v === undefined ? '' : Math.round(v * 100) / 100);
    const wines = S.wines.map(w => {
      const a = avgPrice(w), st = streetOf(w), p = windowParts(w);
      return {
        Producer: w.producer, Wine: w.name, Vintage: w.vintage, Type: w.type, Region: w.region, Grapes: w.grapes, Bottles: w.count,
        Storage: w.stock.map(e => `${e.n} × ${placeLabel(e)}`).join('; '), Status: w.count ? statusOf(w) : 'Finished',
        'Drink from': w.drinkFrom ?? '', 'Peak from': w.peakFrom ?? '', 'Peak until': w.peakUntil ?? '', 'Drink until': w.drinkUntil ?? '',
        'My rating %': w.myRating ?? '', 'External ratings': w.ratings.map(r => `${r.sys} ${r.score}`).join(', '),
        [`Ø Cost (${c})`]: money2(a), [`Street (${c})`]: money2(st), [`Total Street (${c})`]: st !== null ? money2(st * w.count) : '',
        'Best offer shop': w.offer ? w.offer.shop : '', 'Best offer price': w.offer ? `${w.offer.v} ${w.offer.cur}` : '', 'Best offer link': w.offer ? w.offer.url : '',
        Taste: w.taste, Style: w.tasteTags.join(', '), 'Pairs with': w.pairings.join(', '), Added: str(w.createdAt).slice(0, 10), 'Has window': p ? 'yes' : 'no'
      };
    });
    const journal = S.removals.slice().sort((a, b) => str(b.date).localeCompare(str(a.date))).map(r => {
      const w = wineById(r.wineId);
      return { Date: r.date, Direction: r.dir === 'in' ? 'In' : 'Out', Type: entryType(r), Wine: w ? fullName(w) : str(r.wineName), Bottles: Number(r.qty) || 1, Location: str(r.loc),
        Occasion: str(r.occasion), People: str(r.people), 'Favorite of': str(r.hearts), Food: str(r.food), Note: str(r.note), Retailer: str(r.retailer),
        Price: r.price === null || r.price === undefined ? '' : r.price, Currency: str(r.priceCur) };
    });
    const locations = S.locations.map(l => ({ Location: l, Bottles: S.wines.reduce((a, w) => a + w.stock.filter(e => lc(e.loc) === lc(l)).reduce((b, e) => b + e.n, 0), 0),
      'Shelf names': Object.entries(S.shelfNames[lc(l)] || {}).map(([k, v]) => `${k}: ${v}`).join(', ') }));
    const retailers = S.retailers.map(r => ({ Retailer: r.name, Website: r.website }));
    const people = S.people.map(n => ({ Person: n }));
    const wish = S.wishlist.map(x => ({ Wine: wishTitle(x), Type: x.type, Region: x.region, Label: x.label, 'Price estimate': x.price ?? '', Currency: x.priceCur, Bottles: x.qty ?? '', Why: x.why,
      'Offer shop': x.offer ? x.offer.shop : '', 'Offer price': x.offer ? x.offer.v : '', 'Offer link': x.offer ? x.offer.url : '' }));
    const wb = XLSX.utils.book_new();
    const add = (rows, name) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'No entries' }]), name);
    add(wines, 'Wines'); add(journal, 'Journal'); add(locations, 'Locations'); add(retailers, 'Retailers'); add(people, 'People'); add(wish, 'Wishlist');
    XLSX.writeFile(wb, `wine-cellar-${todayISO()}.xlsx`);
    toast('Export ready');
  } catch (e) {
    toast('Export failed. Check your connection and try again.');
  }
  U.exporting = false;
  refreshView();
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
    ${first ? '' : usageHtml()}
    ${first ? '' : `<section class="box"><span class="box-title">Your data</span>
      <button class="btn block" data-act="export"${U.exporting ? ' disabled' : ''}>${ICON.download}${U.exporting ? 'Preparing file…' : 'Export all data to Excel'}</button>
      <p class="muted tiny" style="margin:0">Downloads one Excel file with your wines, journal, locations, retailers, people and wishlist. Keep it as a backup. The label photos stay in the Labels folder of your Google Drive.</p></section>`}
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
