'use strict';

/* Vintary: rating hints. Published scores of other rating systems, found on the web by AI, as a help for the owner.
   Hints stay only on this phone, for 30 days at most, and are never saved in the sheet. A rating is only saved when
   you enter it yourself: Add opens the rating sheet with the hint filled in, and your Save stores it, wine by wine.
   Loaded after taste.js and before actions.js, in the order of index.html. */

const RH_KEY = 'wc-rating-hints', RH_DAYS = 30;
const RH = { busy: false, done: 0, total: 0, failed: 0, stop: false, ids: [], pick: [], view: '', force: false, deep: false, found: 0 };
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

/* a rating counts as fresh when it was searched or entered by you not long ago: 6 months for the last three vintages,
   whose reviews still come in, 12 months for older ones, whose scores hardly change */
function rhMonths(w) { const v = Number(w.vintage); return v > 1900 && new Date().getFullYear() - v <= 3 ? 6 : 12; }
function rhFresh(w, sys) {
  const r = w.ratings.find(x => x.sys === sys);
  const last = [w.ratingChecks && w.ratingChecks[sys], r && r.date].filter(Boolean).sort().pop();
  if (!last) return false;
  const lim = new Date(); lim.setMonth(lim.getMonth() - rhMonths(w));
  return last >= lim.toISOString().slice(0, 10);
}
/* what a check would search: per wine only the systems that are not fresh; a single wine on its page always all */
function rhPlan(ids, systems, force) {
  return ids.map(id => { const w = wineById(id); return { id, systems: w ? systems.filter(x => force || !rhFresh(w, x)) : [] }; }).filter(x => x.systems.length);
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
  const systems0 = RH.pick.slice();
  const plan = rhPlan(RH.ids, systems0, RH.force);
  if (!systems0.length) return;
  rhWrite('wc-rh-sys', systems0);
  if (!plan.length) { RH.view = ''; rhRender(); toast('All these wines were checked or rated recently. Nothing to search.'); return; }
  const ids = plan.map(x => x.id);
  Object.assign(RH, { busy: true, done: 0, total: plan.length, failed: 0, stop: false, view: '', found: 0 });
  rhRender();
  refreshView();
  for (const { id, systems } of plan) {
    if (RH.stop) break;
    try {
      const d = await api('ratingHints', RH.deep ? { id, systems, deep: true } : { id, systems });
      if ((d.hints || []).length) RH.found++;
      const wd = wineById(id);
      if (wd && d.checks && typeof d.checks === 'object') { wd.ratingChecks = d.checks; persist(); }
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
  const tot = RH.total, nf = tot - RH.found - RH.failed;
  toast(`${RH.found ? `Found ratings for ${RH.found} of ${tot} wine${tot === 1 ? '' : 's'}` : `No ratings found for ${tot === 1 ? 'this wine' : `these ${tot} wines`}`}${RH.found && nf > 0 ? `, nothing for ${nf}` : ''}${RH.failed ? `, ${RH.failed} could not be checked` : ''}.${n ? ` ${n} hint${n === 1 ? '' : 's'} to look at.` : ''}`, 6000);
  if (n && ids.length > 1) { RH.view = 'list'; rhRender(); }
}

/* ---------------------------------------------------------------- sheets: which ratings, and the list of hints */

function rhOpenChoose(ids, force, deep) {
  RH.ids = ids;
  RH.force = !!force;
  RH.deep = !!deep;
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
    const todo = rhPlan(RH.ids, RH.pick, RH.force).length, skip = n - todo;
    body = `<div class="between"><h2 style="font-size:18px;font-weight:600">Check ratings</h2><button class="icon-btn" data-act="rh-close" aria-label="Close">${ICON.x}</button></div>
      <p class="small" style="margin:0;line-height:1.5">Looks on the web for published scores of ${n === 1 ? 'this wine' : `the ${n} wines in your current selection`}. You get hints with their source. Nothing is saved until you enter a rating yourself.</p>
      ${skip && !RH.force ? `<p class="small" style="margin:0;color:var(--gold)">${todo ? `Checks ${todo} of ${n} wines.` : 'Nothing to check right now.'} ${skip} ${skip === 1 ? 'was' : 'were'} checked or rated recently: within 6 months for the last three vintages, 12 months for older ones.</p>` : ''}
      <span class="small muted">Which ratings?</span>
      <div class="chips">${SYSTEMS.map(x => `<button class="chip${RH.pick.includes(x.key) ? ' on' : ''}" data-act="rh-sys" data-v="${esc(x.key)}">${esc(x.key)}</button>`).join('')}</div>
      <p class="tiny muted" style="margin:0">${RH.deep ? 'Deeper search with a stronger AI model and more searches, about 10 cents.' : 'About 3 to 4 cents per wine.'} Hints stay only on this phone, for 30 days at most.${last ? ` Last checked ${esc(fmtDate(last))}.` : ''}</p>
      ${hintCount() && n > 1 ? `<button class="btn accent" data-act="rh-list">Rating hints (${hintCount()})</button>` : ''}
      <div class="grid2"><button class="btn" data-act="rh-close">Cancel</button><button class="btn primary" data-act="rh-go"${RH.pick.length && todo ? '' : ' disabled'}>${n === 1 ? (RH.deep ? 'Search deeper' : 'Check this wine') : `Check ${todo} wine${todo === 1 ? '' : 's'}`}</button></div>`;
  } else {
    const ws = hintWines();
    body = `<div class="between"><h2 style="font-size:18px;font-weight:600">Rating hints</h2><button class="icon-btn" data-act="rh-close" aria-label="Close">${ICON.x}</button></div>
      <p class="small muted" style="margin:0">Found on the web. Check each score at its source, then add it with Save. Hints you do not add disappear after 30 days.</p>
      <div class="rh-list">${ws.length ? ws.map(w => `<div class="rh-wine"><a class="rh-wine-head" href="#/wine/${encodeURIComponent(w.id)}">${thumbHtml(w, true)}<span class="row-title ellipsis">${flagOf(w)}${esc(wineTitle(w))} ${esc(w.vintage)}</span></a>
        ${hintsOf(w).map(h => hintRowHtml(w, h)).join('')}</div>`).join('') : '<p class="small muted" style="margin:0">No open hints.</p>'}</div>`;
  }
  root.innerHTML = `<div class="sheet-backdrop" data-act="rh-close"></div><div class="sheet rh-sheet" role="dialog" aria-modal="true"><div class="grab"></div>${body}</div>`;
}

/* the gold AI symbol in the header of Top rated, External: a number for open hints, turning while it checks */
function rhIconHtml(ids) {
  const n = hintCount();
  return `<button class="icon-btn magic-btn rh-ic${RH.busy ? ' busy' : ''}" data-act="rh-open" data-ids="${esc(ids.join(','))}" aria-label="Check ratings${n ? `, ${n} hints to look at` : ''}"${ids.length ? '' : ' disabled'}>${ICON.magic}${n ? `<span class="rh-n">${n}</span>` : ''}</button>`;
}
/* while it checks: one slim line below the switch */
function rhBarHtml() {
  if (!RH.busy || RH.total < 2) return '';
  return `<div class="rh-line"><span class="small muted">Checking ${Math.min(RH.done + 1, RH.total)} of ${RH.total}…</span><button class="link-btn" data-act="rh-stop">Stop</button></div>`;
}
/* in Edit: the open hints of this wine against the ratings in the form, and the two searches */
const rhFormWine = () => ({ id: D.id, vintage: D.fields.vintage, ratings: D.ratings.filter(r => str(r.score).trim() !== '').map(r => ({ sys: r.sys, score: Number(String(r.score).replace(',', '.')) })) });
function rhFormHtml() {
  const w = rhFormWine(), hs = hintsOf(w);
  return `${hs.length ? `<div class="rh-wine">${hs.map(h => hintRowHtml(w, h)).join('')}</div>` : ''}
    ${RH.busy && RH.ids.length === 1 && RH.ids[0] === w.id ? `<p class="small muted" style="margin:0">${ICON.refresh}Looking for published scores…</p>` : `<div class="rh-actions"><button class="btn ghost" style="height:36px;font-size:13px" data-act="rh-open" data-ids="${esc(w.id)}" data-force="1"${RH.busy ? ' disabled' : ''}>${ICON.magic}Find rating hints</button><button class="link-btn small" data-act="rh-open" data-ids="${esc(w.id)}" data-force="1" data-deep="1"${RH.busy ? ' disabled' : ''}>Search deeper</button></div>`}`;
}

/* Add: the rating sheet with the hint filled in; your Save stores it */
function rhAdd(id, sys) {
  // in Edit the hint goes into the form, and Save wine stores it
  if (isFormRoute() && D && D.id === id) {
    const fh = hintsOf(rhFormWine()).find(x => x.sys === sys);
    if (!fh) return;
    RH.view = '';
    RT = { i: D.ratings.findIndex(r => r.sys === sys), sys, score: String(fh.score), hint: fh };
    renderRatingSheet();
    return;
  }
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
  const nr = { sys: r.sys, score: Number(r.score), date: todayISO() };
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
  'rh-open': el => { if (S.version && S.version < 35) { toast('Rating hints need the new Code.gs. Replace the script code and create a new version under Manage deployments.', 6000); return; } rhOpenChoose(String(el.dataset.ids || '').split(',').filter(Boolean), el.dataset.force === '1', el.dataset.deep === '1'); },
  'rh-sys': el => { const v = el.dataset.v, i = RH.pick.indexOf(v); if (i >= 0) RH.pick.splice(i, 1); else RH.pick.push(v); rhRender(); },
  'rh-go': () => rhRun(),
  'rh-stop': () => { RH.stop = true; },
  'rh-close': () => { RH.view = ''; rhRender(); },
  'rh-list': () => { RH.view = 'list'; rhRender(); },
  'rh-add': el => rhAdd(el.dataset.id, el.dataset.sys),
  'rh-x': el => { rhDismiss(el.dataset.id, el.dataset.sys); if (RH.view) rhRender(); refreshView(); }
};
