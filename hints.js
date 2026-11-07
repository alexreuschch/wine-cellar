'use strict';

/* Vintary: rating hints. Published scores of other rating systems, found on the web by AI, as a help for the owner.
   Hints stay only on this phone, for 30 days at most, and are never saved in the sheet. A rating is only saved when
   you enter it yourself: Add opens the rating sheet with the hint filled in, and your Save stores it, wine by wine.
   Loaded after taste.js and before actions.js, in the order of index.html. */

const RH_KEY = 'wc-rating-hints', RH_DAYS = 30;
const RH = { busy: false, done: 0, total: 0, failed: 0, stop: false, ids: [], pick: [], view: '' };
function rhRead(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v === null ? d : v; } catch (e) { return d; } }
function rhWrite(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* kept for this session */ } }
let RHS = rhRead(RH_KEY, {});
if (!RHS || typeof RHS !== 'object') RHS = {};
(function rhPurge() {
  const lim = Date.now() - RH_DAYS * 864e5;
  Object.keys(RHS).forEach(id => { const e = RHS[id]; if (!e || !Array.isArray(e.hints) || !(Date.parse(e.date) > lim)) delete RHS[id]; });
  rhWrite(RH_KEY, RHS);
})();
const rhLast = () => rhRead('wc-rh-last', '');

/* the systems to search: what you chose last time, else the systems you already use plus Vivino */
function rhSystems() {
  const saved = rhRead('wc-rh-sys', null);
  if (Array.isArray(saved) && saved.length) return saved.filter(x => SYSTEMS.some(y => y.key === x));
  const used = SYSTEMS.filter(x => S.wines.some(w => w.ratings.some(r => r.sys === x.key))).map(x => x.key);
  return used.includes('Vivino') ? used : ['Vivino'].concat(used);
}

/* the hints of a wine still open: not entered yet, or a score different from yours */
function hintsOf(w) {
  const e = w && RHS[w.id];
  if (!e) return [];
  return e.hints.map(h => { const mine = w.ratings.find(r => r.sys === h.sys); return Object.assign({}, h, { mine: mine ? Number(mine.score) : null }); })
    .filter(h => h.mine === null || Math.abs(h.mine - Number(h.score)) > 1e-9);
}
const hintWines = () => S.wines.filter(w => hintsOf(w).length);
const hintCount = () => S.wines.reduce((a, w) => a + hintsOf(w).length, 0);
function rhDismiss(id, sys) {
  const e = RHS[id];
  if (!e) return;
  e.hints = e.hints.filter(h => h.sys !== sys);
  if (!e.hints.length) delete RHS[id];
  rhWrite(RH_KEY, RHS);
}

/* ---------------------------------------------------------------- the search */

async function rhRun() {
  if (RH.busy) return;
  const ids = RH.ids.slice(), systems = RH.pick.slice();
  if (!ids.length || !systems.length) return;
  rhWrite('wc-rh-sys', systems);
  Object.assign(RH, { busy: true, done: 0, total: ids.length, failed: 0, stop: false, view: '' });
  rhRender();
  refreshView();
  for (const id of ids) {
    if (RH.stop) break;
    try {
      const d = await api('ratingHints', { id, systems });
      const found = (d.hints || []).filter(h => h && SYSTEMS.some(x => x.key === h.sys));
      // a new search replaces the hints of the searched systems and keeps the others
      const keep = RHS[id] ? RHS[id].hints.filter(h => !systems.includes(h.sys)) : [];
      const all = keep.concat(found.map(h => ({ sys: h.sys, score: Number(h.score), vintage: str(h.vintage), url: str(h.url), source: str(h.source), wv: str(d.vintage) })));
      if (all.length) RHS[id] = { date: new Date().toISOString(), hints: all }; else delete RHS[id];
      rhWrite(RH_KEY, RHS);
    } catch (e) {
      RH.failed++;
      if (/Unknown action/i.test(e.message)) { RH.stop = true; toast('Rating hints need the new Code.gs.'); }
    }
    RH.done++;
    refreshView();
  }
  rhWrite('wc-rh-last', todayISO());
  RH.busy = false;
  refreshView();
  const n = hintCount();
  if (RH.stop && RH.done < RH.total) return;
  toast(n ? `${n} rating hint${n === 1 ? '' : 's'} to look at${RH.failed ? `. ${RH.failed} wine${RH.failed === 1 ? '' : 's'} could not be checked` : ''}.` : `No new ratings found${RH.failed ? `, ${RH.failed} wine${RH.failed === 1 ? '' : 's'} could not be checked` : ''}.`, 5000);
  if (n && ids.length > 1) { RH.view = 'list'; rhRender(); }
}

/* ---------------------------------------------------------------- sheets: which ratings, and the list of hints */

function rhOpenChoose(ids) {
  RH.ids = ids;
  RH.pick = rhSystems();
  RH.view = 'choose';
  rhRender();
}

function hintRowHtml(w, h) {
  const info = sysInfo(h.sys);
  const other = h.vintage && w.vintage && h.vintage !== String(w.vintage);
  return `<div class="rh-row"><div class="rh-main"><span class="rh-badge">Hint</span><b>${esc(h.sys)} ${esc(fmtScore(h.sys, h.score))}</b><span class="muted small"> /${info.max}</span>
      ${h.mine !== null ? `<span class="small muted"> · you have ${esc(fmtScore(h.sys, h.mine))}</span>` : ''}
      <p class="tiny muted" style="margin:2px 0 0">${other ? `<span style="color:var(--gold)">for vintage ${esc(h.vintage)}, not ${esc(w.vintage)}</span> · ` : h.vintage ? `vintage ${esc(h.vintage)} · ` : ''}<a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.source || 'Source')}${ICON.link}</a></p></div>
    <button class="btn accent rh-add" data-act="rh-add" data-id="${esc(w.id)}" data-sys="${esc(h.sys)}">${h.mine !== null ? 'Update' : 'Add'}</button>
    <button class="icon-btn" data-act="rh-x" data-id="${esc(w.id)}" data-sys="${esc(h.sys)}" aria-label="Dismiss this hint">${ICON.x}</button></div>`;
}

function rhRender() {
  const root = $('#sheet-root');
  if (!root) return;
  if (!RH.view) { if (root.querySelector('.rh-sheet')) root.innerHTML = ''; return; }
  let body;
  if (RH.view === 'choose') {
    const n = RH.ids.length, last = rhLast();
    body = `<div class="between"><h2 style="font-size:18px;font-weight:600">Check ratings</h2><button class="icon-btn" data-act="rh-close" aria-label="Close">${ICON.x}</button></div>
      <p class="small" style="margin:0;line-height:1.5">Looks on the web for published scores of ${n === 1 ? 'this wine' : `the ${n} wines in your current selection`}. You get hints with their source. Nothing is saved until you enter a rating yourself.</p>
      <span class="small muted">Which ratings?</span>
      <div class="chips">${SYSTEMS.map(x => `<button class="chip${RH.pick.includes(x.key) ? ' on' : ''}" data-act="rh-sys" data-v="${esc(x.key)}">${esc(x.key)}</button>`).join('')}</div>
      <p class="tiny muted" style="margin:0">About 1 to 2 cents per wine. Hints stay only on this phone, for 30 days at most.${last ? ` Last checked ${esc(fmtDate(last))}.` : ''}</p>
      <div class="grid2"><button class="btn" data-act="rh-close">Cancel</button><button class="btn primary" data-act="rh-go"${RH.pick.length ? '' : ' disabled'}>${n === 1 ? 'Check this wine' : `Check ${n} wines`}</button></div>`;
  } else {
    const ws = hintWines();
    body = `<div class="between"><h2 style="font-size:18px;font-weight:600">Rating hints</h2><button class="icon-btn" data-act="rh-close" aria-label="Close">${ICON.x}</button></div>
      <p class="small muted" style="margin:0">Found on the web. Check each score at its source, then add it with Save. Hints you do not add disappear after 30 days.</p>
      <div class="rh-list">${ws.length ? ws.map(w => `<div class="rh-wine"><a class="rh-wine-head" href="#/wine/${encodeURIComponent(w.id)}">${thumbHtml(w, true)}<span class="row-title ellipsis">${flagOf(w)}${esc(wineTitle(w))} ${esc(w.vintage)}</span></a>
        ${hintsOf(w).map(h => hintRowHtml(w, h)).join('')}</div>`).join('') : '<p class="small muted" style="margin:0">No open hints.</p>'}</div>`;
  }
  root.innerHTML = `<div class="sheet-backdrop" data-act="rh-close"></div><div class="sheet rh-sheet" role="dialog" aria-modal="true"><div class="grab"></div>${body}</div>`;
}

/* the bar above Top rated and the box on the wine page */
function rhBarHtml(ids) {
  const n = hintCount(), last = rhLast();
  if (RH.busy) return `<div class="rh-bar"><span class="small">${ICON.refresh}Checking ${Math.min(RH.done + 1, RH.total)} of ${RH.total}…</span><button class="btn ghost" style="height:34px" data-act="rh-stop">Stop</button></div>`;
  return `<div class="rh-bar"><div style="flex:1;min-width:0"><button class="btn ghost rh-check" data-act="rh-open" data-ids="${esc(ids.join(','))}"${ids.length ? '' : ' disabled'}>${ICON.magic}Check ratings</button>
    <p class="tiny muted" style="margin:0">${last ? `Last checked ${esc(fmtDate(last))}` : 'Find published scores as hints'}</p></div>
    ${n ? `<button class="btn accent" style="height:38px" data-act="rh-list">Rating hints (${n})</button>` : ''}</div>`;
}
function rhDetailHtml(w) {
  const hs = hintsOf(w);
  return `${hs.length ? `<div class="rh-wine">${hs.map(h => hintRowHtml(w, h)).join('')}</div>` : ''}
    ${RH.busy && RH.ids.length === 1 && RH.ids[0] === w.id ? `<p class="small muted" style="margin:0">${ICON.refresh}Looking for published scores…</p>` : `<button class="btn ghost" style="height:36px;align-self:flex-start;font-size:13px" data-act="rh-open" data-ids="${esc(w.id)}"${RH.busy ? ' disabled' : ''}>${ICON.magic}Find rating hints</button>`}`;
}

/* Add: the rating sheet with the hint filled in; your Save stores it */
function rhAdd(id, sys) {
  const w = wineById(id), h = hintsOf(w).find(x => x.sys === sys);
  if (!w || !h) return;
  const back = RH.view === 'list';
  RH.view = '';
  RT = { i: w.ratings.findIndex(r => r.sys === sys), sys, score: String(h.score), wineId: id, hint: h, back };
  renderRatingSheet();
}

async function saveWineRating(id, r, back) {
  const w = wineById(id);
  if (!w) return;
  const prev = w.ratings.slice();
  const i = w.ratings.findIndex(x => x.sys === r.sys);
  const nr = { sys: r.sys, score: Number(r.score) };
  if (i >= 0) w.ratings[i] = nr; else w.ratings.push(nr);
  rhDismiss(id, r.sys);
  persist();
  refreshView();
  if (back && hintCount()) { RH.view = 'list'; rhRender(); }
  try {
    upsertWine(normWine(await api('update', { id, fields: { ratings: JSON.stringify(w.ratings) } })));
    persist();
    refreshView();
    if (RH.view) rhRender();
  } catch (e) { w.ratings = prev; persist(); refreshView(); toast('Not saved: ' + e.message); }
}

const RH_ACTS = {
  'rh-open': el => { if (S.version && S.version < 35) { toast('Rating hints need the new Code.gs. Replace the script code and create a new version under Manage deployments.', 6000); return; } rhOpenChoose(String(el.dataset.ids || '').split(',').filter(Boolean)); },
  'rh-sys': el => { const v = el.dataset.v, i = RH.pick.indexOf(v); if (i >= 0) RH.pick.splice(i, 1); else RH.pick.push(v); rhRender(); },
  'rh-go': () => rhRun(),
  'rh-stop': () => { RH.stop = true; },
  'rh-close': () => { RH.view = ''; rhRender(); },
  'rh-list': () => { RH.view = 'list'; rhRender(); },
  'rh-add': el => rhAdd(el.dataset.id, el.dataset.sys),
  'rh-x': el => { rhDismiss(el.dataset.id, el.dataset.sys); if (RH.view) rhRender(); refreshView(); }
};
