'use strict';

/* Wine Cellar: Actions for taps, inputs and changes, and the start of the app. Loaded after app.js, in the order of index.html. */

/* ------------------------------------------------------------ actions */

const ACTS = {
  refresh: () => sync(false),
  export: () => exportExcel(),
  'f-toggle': el => { const st = U.f[el.dataset.ctx]; st.open = !st.open; refreshView(); },
  'f-chip': el => {
    const a = sel(el.dataset.ctx, el.dataset.k);
    const i = a.indexOf(el.dataset.v);
    if (i >= 0) a.splice(i, 1); else a.push(el.dataset.v);
    refreshView();
  },
  'f-tab': el => { U.f[el.dataset.ctx].tab = el.dataset.v; refreshView(); },
  'f-more': el => { U.f[el.dataset.ctx].all[el.dataset.k] = true; refreshView(); },
  'f-less': el => { const st = U.f[el.dataset.ctx]; st.all[el.dataset.k] = false; st.q[el.dataset.k] = ''; refreshView(); },
  'f-clear': el => { const st = U.f[el.dataset.ctx]; st.sel = {}; st.range = {}; st.rating = null; st.fav = false; refreshView(); },
  'rt-fav': el => { const st = U.f[el.dataset.ctx]; st.fav = !st.fav; refreshView(); },
  'rating-clear': el => { U.f[el.dataset.ctx].rating = null; refreshView(); },
  'rt-sys': el => {
    const st = U.f[el.dataset.ctx], v = el.dataset.v;
    if (!st.rating && v === 'mine') return;   // already chosen as the default, the slider starts the filter
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
  'top-disc-off': () => { U.topDisc = false; refreshView(); },
  'top-fav-off': () => { U.f.top.fav = false; refreshView(); },
  'top-toggle-finished': () => { U.topFinished = !U.topFinished; refreshView(); },
  'top-toggle-disc': () => { U.topDisc = !U.topDisc; refreshView(); },
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
  'ins-go': el => insightsGo(el.dataset.k, el.dataset.v),
  'cons-focus': el => { CONS.focus = CONS.focus === el.dataset.v ? '' : el.dataset.v; refreshView(); },
  'cons-run': () => consRun(),
  'cons-offer': el => { const p = CONS.result && CONS.result.picks[Number(el.dataset.i)]; if (p) consOffer(p, wishKey(p)); },
  'pe-edit': el => { U.personEdit = el.dataset.v; refreshView(); const f = $('#pe-aliases'); if (f) f.focus(); },
  'pe-cancel': () => { U.personEdit = null; refreshView(); },
  'pe-save': el => savePersonInfo(el.dataset.v, ($('#pe-aliases') || {}).value || '', ($('#pe-note') || {}).value || ''),
  'ja-send': () => { const ta = $('#ja-text'); jaAsk(ta ? ta.value : JA.draft); },
  'ja-example': el => jaAsk(el.dataset.v),
  'ja-mic': () => { if (JA.listening) voiceStop(); else jaStartVoice(); },
  'ja-clear': () => { if (JA.listening) jaStopVoice(); JA.thread = []; JA.draft = ''; JA.voiced = false; jaSave(); render(); },
  'ja-retry': el => { const t = JA.thread[Number(el.dataset.i)]; if (t && !JA.busy) jaRun(t); },
  'cons-preview': el => consPreview(Number(el.dataset.i)),
  'cons-mic': () => { if (CONS.listening) voiceStop(); else consStartVoice(); },
  'cons-save': el => { const p = CONS.result && CONS.result.picks[Number(el.dataset.i)]; if (p) consSave(p); },
  'wish-offer': el => { const x = S.wishlist.find(w => w.id === el.dataset.id); if (x) consOffer(x, 'wish:' + x.id, x.id); },
  'wish-del': el => wishDelete(el.dataset.id),
  'wish-add': el => wishToCellar(el.dataset.id),
  'somm-where': el => { SOMM.where = el.dataset.v; SOMM.whereAt = Date.now(); sommSave(); render(); },
  'somm-send': () => { if (SOMM.mode === 'list') { listAnalyze(); return; } const ta = $('#somm-text'); sommAsk(ta ? ta.value : SOMM.draft); },
  'wl-go': () => listAnalyze(),
  'about-more': el => { if (el.closest('.prev-sheet')) { U.aboutOpen = U.aboutOpen === 'preview' ? null : 'preview'; renderPreview(); return; } const id = (location.hash.split('/')[2] || ''); U.aboutOpen = U.aboutOpen === decodeURIComponent(id) ? null : decodeURIComponent(id); refreshView(); },
  'vint-pick': el => vintageChosen(el.dataset.v),
  'vint-ok': () => { const i = $('#vint-in'); vintageChosen(i ? i.value.trim() : ''); },
  'vint-close': () => vintageClose(),
  'info-open': el => openInfo(el.dataset.k, el.dataset.v, el.dataset.c),
  'info-close': () => closeInfo(),
  'info-term': el => { const x = { k: el.dataset.k, t: el.dataset.t, region: el.dataset.r || '' }; infoLeave(); if (x.k === 'grape') insightsGo('grape', x.t); else insightsGo('term', x); },
  'info-j': el => { const x = { k: el.dataset.k, v: el.dataset.v, producer: INFO.name }; infoLeave(); insightsGo('pjournal', x); },
  'info-wine': (el, e) => { if (e) e.preventDefault(); const h = el.getAttribute('href'); infoLeave(); go(h); },
  'vint-open': el => openVintage(el.dataset.r, el.dataset.y),
  'vint-all': () => { INFO.vAll = !INFO.vAll; if (!INFO.vAll) INFO.vFocus = null; renderInfo(); },
  'vint-mine': el => { const r = str(INFO.name).split(',')[0].trim(), y = el.dataset.y; infoLeave(); insightsGo('regvint', `${r}|${y}`); },
  'info-mine': () => { const m = infoMine(); infoLeave(); if (m.go) insightsGo(m.go[0], m.go[1]); },
  'complete-all': () => completeAll(),
  'tp-set': el => { const k = el.dataset.k, v = Number(el.dataset.v); D.profile[k] = D.profile[k] === v ? null : v; D.touched.add('profile'); renderProfileEditor(); },
  'tp-aroma': el => {
    const g = el.dataset.v, a = D.profile.aromas, i = a.findIndex(x => x.g === g);
    if (i >= 0) a.splice(i, 1); else if (a.length >= 3) { toast('Up to three main aromas. Remove one first.'); return; } else a.push({ g, n: '' });
    D.touched.add('profile'); renderProfileEditor();
  },
  'tp-food': el => { const f = el.dataset.v, a = D.profile.foods, i = a.indexOf(f); if (i >= 0) a.splice(i, 1); else if (a.length >= 6) { toast('Up to six kinds of food.'); return; } else a.push(f); D.touched.add('profile'); renderProfileEditor(); },
  'pick-open': el => openPicker(el.dataset.k),
  'somm-redo': () => { if (SOMM.redo === 'list') { SOMM.redo = ''; listAnalyze(WL.result ? WL.result.food || '' : ''); } else sommRedoCheck(); },
  'somm-redo-no': () => { SOMM.redo = ''; refreshView(); },
  'pick-close': () => closePicker(),
  pick: el => pickChoose(el.dataset.v),
  'wl-page-rm': el => { WL.pages.splice(Number(el.dataset.i), 1); sommRefresh(false); },
  'wl-clear': () => { if (SOMM.listening) sommStopVoice(); SOMM.redo = ''; WL.pages = []; WL.result = null; WL.error = ''; SOMM.draft = ''; SOMM.voiced = false; sommSave(); render(); },
  'wl-taste': el => listTaste(Number(el.dataset.i)),
  'wl-preview': el => listPreview(Number(el.dataset.i)),
  'somm-preview': el => sommPreview(Number(el.dataset.i)),
  'somm-vintage': el => sommVintage(Number(el.dataset.i)),
  'wish-preview': el => wishPreview(el.dataset.id),
  'prev-close': () => closePreview(),
  'prev-taste': () => previewTaste(),
  'prev-wish': () => previewWish(),
  'prev-cellar': () => { const id = PREV.src && PREV.src.id; closePreview(); wishToCellar(id); },
  'somm-taste': el => sommTaste(Number(el.dataset.i)),
  'ds-venue': el => { if (RS && RS.kind === 'taste') { saveTasteInputs(); RS.venue = el.dataset.v; renderSheet(); } },
  'ds-rate': el => { if (RS && RS.kind === 'taste') setTasteRating((RS.rating === null ? 80 : RS.rating) + Number(el.dataset.d)); },
  'wl-save': el => { const p = WL.result && WL.result.picks[Number(el.dataset.i)]; if (p) listSave(p); },
  'somm-example': el => sommAsk(el.dataset.v),
  'somm-cand': el => sommAsk(el.dataset.v, null, el.dataset.v),
  'voice-lang': () => voiceLangNext(),
  'wl-budget-clear': () => { WL.min = ''; WL.max = ''; document.querySelectorAll('[data-input=wl-min], [data-input=wl-max]').forEach(i => { i.value = ''; }); wlBudgetRefresh(); sommSave(); },
  'somm-mic': () => { if (SOMM.listening) voiceStop(); else sommStartVoice(); },
  'somm-tips': () => { SOMM.tips = !SOMM.tips; render(); },
  'somm-clear': () => { if (SOMM.listening) sommStopVoice(); SOMM.redo = ''; SOMM.threads[SOMM.mode] = []; SOMM.draft = ''; SOMM.voiced = false; SOMM.photo = null; sommSave(); render(); },
  'somm-mode': el => { if (SOMM.listening) sommStopVoice(); SOMM.mode = ['check', 'list'].includes(el.dataset.v) ? el.dataset.v : 'cellar'; SOMM.tips = false; SOMM.photo = null; sommSave(); history.replaceState(null, '', '#/sommelier/' + SOMM.mode); render(); window.scrollTo(0, 0); },
  'dup-keep': () => { const w = findDuplicate(D.fields); if (w) D.dupIgnore = w.id; renderDup(); },
  'dup-add': el => { const id = el.dataset.id; D = null; go('#/wine/' + encodeURIComponent(id)); setTimeout(() => openAddSheet(id), 200); },
  'somm-retry': () => { const last = sommThread().pop(); if (last) sommAsk(last.q, last.img, last.picked); },
  'somm-photo-rm': () => { SOMM.photo = null; sommRefresh(false); },
  'cf-food': el => {
    const k = el.dataset.v, cur = sommFoods();
    SOMM.foods = cur.includes(k) ? cur.filter(x => x !== k) : cur.concat(k);
    SOMM.foodsAt = Date.now();
    sommSave(); sommRefresh(false);
  },
  'cf-food-all': () => { SOMM.foodsAll = !SOMM.foodsAll; sommRefresh(false); },
  'top-sys': el => { U.topSys = el.dataset.v; render(); },

  rate: el => {
    if (!D) return;
    const base = D.myRating === null ? 50 : D.myRating;
    setRating(clamp(base + Number(el.dataset.d), 0, 100));
  },
  'rate-clear': () => setRating(null),
  'wine-fav': el => toggleWineFav(el.dataset.id),
  'share-wine': el => shareOpen(el.dataset.id),
  'tt-fold': () => { U.ttOpen = !U.ttOpen; render(); },
  'share-go': el => shareGo(el.dataset.link === '1'),
  'share-send': () => shareWine(SHARE.id, SHARE.offer),
  'share-close': () => shareClose(),
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
  'p-change': () => {
    const P = PK();
    P.editing = true; P.typing = '';
    if (RS && P === RS.rp) renderSheet(); else updatePeople();
    const i = $('#people-input'); if (i) i.focus();
  },
  'p-rm': el => {
    const P = PK();
    P.people.splice(Number(el.dataset.i), 1);
    P.editing = false;
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
    const z = $('#rs-zone'); if (z) z.innerHTML = zoneLineHtml(RS.loc, RS.shelf, wineById(RS.wineId), 'rs-zone');
  },
  'rs-qty': el => { RS.qty = clamp(RS.qty + Number(el.dataset.d), 1, qtyMax()); $('#rs-qty').value = RS.qty; refreshSpaceNotes(); if (isBuyIn(RS)) totalSetQty(RS); },
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
    if (D && D.fromOrder) { D = null; U.jumpTo = 'orders'; go('#/insights', true); return; }
    const back = D && D.mode === 'edit' ? '#/wine/' + encodeURIComponent(D.id) : '#/cellar';
    D = null;
    if (navPrev() === back) history.back(); else go(back, true);
  },
  'nav-back': () => history.back(),
  'skip-photo': () => { D.step = 'form'; render(); },
  'new-photo': () => { D.step = 'photo'; render(); },
  retake: () => { D.step = camOk() && !D.camFail ? 'camera' : 'photo'; D.src = null; render(); },
  'cam-open': () => { D.step = 'camera'; render(); },
  'cam-cancel': () => { camStop(); D.step = 'photo'; render(); },
  'cam-shot': () => camShot(),
  'cam-torch': () => camTorch(),
  'label-zoom': () => labelZoom(),
  'do-crop': () => finishCrop(D.corners),
  'use-full': () => finishCrop(null),
  'st-n': el => {
    const e = D.stock[Number(el.dataset.i)];
    e.n = clamp(e.n + Number(el.dataset.d), 0, 999);
    $('#st-n-' + el.dataset.i).value = e.n;
    refreshSpaceNotes();
    const t = $('#st-total');
    if (t) t.textContent = D.stock.reduce((a, x) => a + x.n, 0) + ' bottles';
  },
  'st-shelf': el => {
    const e = D.stock[Number(el.dataset.i)];
    e.shelf = shelfStep(shelfVal(e.shelf), Number(el.dataset.d));
    $('#st-shelf-' + el.dataset.i).textContent = shelfText(e.loc, e.shelf);
    const z = $('#st-zone-' + el.dataset.i); if (z) z.innerHTML = zoneLineHtml(e.loc, e.shelf, formWineLike(), 'st-zone', Number(el.dataset.i));
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
    if (from < 0) return;
    D.move = { from, to: moveDefaultTo(from), n: 1 };
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
    const src = D.stock[m.from];
    let dst = null;
    if (str(m.to).startsWith('i:')) dst = D.stock[Number(m.to.slice(2))];
    else if (str(m.to).startsWith('loc:')) { dst = { loc: m.to.slice(4), shelf: null, pos: '', n: 0 }; D.stock.push(dst); }
    if (!src || !dst || src === dst) return;
    const n = Math.min(m.n, src.n);
    src.n -= n;
    dst.n += n;
    D.move = null;
    renderStockBox();
    toast(`${n} ${n === 1 ? 'bottle' : 'bottles'} moved to ${placeLabel(dst)}. ${dst.shelf === null && !dst.pos ? 'Set shelf and position if you like, then save.' : 'Save to keep it.'}`, 5000);
  },
  radd: () => {
    const used = D.ratings.map(r => r.sys);
    const next = SYSTEMS.find(x => !used.includes(x.key)) || SYSTEMS[0];
    D.ratings.push({ sys: next.key, score: '' });
    render();
  },
  rrm: el => { D.ratings.splice(Number(el.dataset.i), 1); render(); },
  'ers-open': el => openRatingSheet(Number(el.dataset.i)),
  'ers-close': () => { const back = RT && RT.back; RT = null; renderRatingSheet(); if (back && hintCount()) { RH.view = 'list'; rhRender(); } },
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
    const first = !CFG;
    try {
      await api('ping', {}, { url, token });
      CFG = { url, token };
      store.set('wc-config', CFG);
      busy(false);
      await sync(true);
      // a new cellar starts with the setup; the taste test is offered on Home
      go(first && !S.wines.some(w => !isDisc(w)) && !gdSetupDone() ? '#/setup' : '#/home', true);
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
    if (f) { f.innerHTML = tabSecsHtml('cellar'); clampChips(f); }
  },
  facetq: el => { const ctx = el.dataset.ctx, k = el.dataset.k, st = U.f[ctx]; st.q[k] = el.value; const f = $(`#facet-chips-${ctx}-${k}`); if (f) f.innerHTML = facetChipsHtml(ctx, k); },
  rs: el => {
    if (!RS) return;
    RS[el.name] = el.value;
    if (el.name === 'price' && isBuyIn(RS)) totalTyped(RS);
    const h = el.name === 'pos' && $('#rs-hint');
    if (h) h.textContent = placeHint();
  },
  rng: el => onRange(el),
  rtmin: el => onRatingMin(el),
  'ed-cap': el => { if (U.edit) U.edit.cap = el.value; },
  'ed-shelf': el => { if (U.edit && U.edit.shelves) { const v = el.value.trim(); if (v) U.edit.shelves[el.dataset.n] = el.value; else delete U.edit.shelves[el.dataset.n]; } },
  'ers-score': el => { if (!RT) return; RT.score = el.value; const p = $('#rt-preview'); if (p) p.innerHTML = rtPreview(); },
  'tg-in': el => { if (el.value.includes(',')) { const k = el.dataset.k; addTag(k, el.value); } },
  'qty-in': el => setQty(el, false),
  'somm-text': el => { SOMM.draft = el.value; autosize(el); },
  'somm-vin': el => { const t = sommThread()[Number(el.dataset.i)]; if (t) { t.vin = t.vin || {}; t.vin.draft = el.value.replace(/\D/g, '').slice(0, 4); } },
  'ja-text': el => { JA.draft = el.value; autosize(el); },
  'wl-min': el => { WL.min = el.value; wlBudgetRefresh(); },
  'tp-note': el => { const a = D.profile.aromas[Number(el.dataset.i)]; if (a) a.n = el.value; D.touched.add('profile'); },
  'tp-field': el => { D.profile[el.dataset.k] = el.value; D.touched.add('profile'); if (el.classList.contains('autosize')) autosize(el); },
  'pick-q': el => { PICK.q = el.value; const l = $('#pick-list'); if (l) l.innerHTML = pickListHtml(); },
  'wl-max': el => { WL.max = el.value; wlBudgetRefresh(); },
  'cons-min': el => { CONS.budget.min = el.value.replace(/[^0-9]/g, ''); },
  'cons-max': el => { CONS.budget.max = el.value.replace(/[^0-9]/g, ''); },
  'cons-note': el => { CONS.note = el.value; },
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
    if (f) { f.innerHTML = tabSecsHtml('journal'); clampChips(f); }
  },
  field: el => { if (D) { D.fields[el.name] = el.value; D.touched.add(el.name); if (['producer', 'name', 'vintage'].includes(el.name)) renderDup(); bottleFieldLater(el.name); } if (el.classList.contains('autosize')) autosize(el); },
  rscore: el => { if (D) D.ratings[Number(el.dataset.i)].score = el.value; }
};

const CHANGES = {
  field: el => { if (D) { D.fields[el.name] = el.value; D.touched.add(el.name); bottleFieldLater(el.name); } },
  sort: el => { SORT = SORTS[el.value] ? el.value : 'az'; store.set('wc-sort', SORT); const l = $('#wine-list'); if (l) l.innerHTML = cellarList(); },
  rsys: el => { if (D) D.ratings[Number(el.dataset.i)].sys = el.value; },
  'ret-site': el => saveRetailerSite(el.dataset.v, el.value.trim()),

  currency: async el => {
    S.settings = Object.assign({}, S.settings, { currency: el.value });
    persist();
    refreshView();
    try { await api('setSettings', { settings: { currency: el.value } }); toast('Currency saved. All prices are shown in ' + el.value + '.'); }
    catch (e) { toast('Saved on this device only: ' + e.message); }
  },
  country: async el => {
    S.settings = Object.assign({}, S.settings, { country: el.value });
    persist();
    refreshView();
    try { await api('setSettings', { settings: { country: el.value } }); toast(`Shops are now searched for ${SHOP_COUNTRIES[el.value]}.`); }
    catch (e) { toast('Saved on this device only: ' + e.message); }
  },
  'show-finished': el => { U.showFinished = el.checked; refreshView(); },
  'top-finished': el => { U.topFinished = el.checked; refreshView(); },
  'top-disc': el => { U.topDisc = el.checked; refreshView(); },
  'top-fav': el => { U.f.top.fav = el.checked; refreshView(); },
  'j-fav': el => { U.jFav = el.checked; refreshView(); },
  'qty-in': el => setQty(el, true),
  'size-sel': el => { if (!D) return; D.touched.add('size'); if (el.value === 'other') { D.sizeOther = true; D.fields.size = ''; } else { D.sizeOther = false; D.fields.size = el.value; } renderSizeBox(); refreshSpaceNotes(); if (D.sizeOther) { const i = $('[name="size"]'); if (i) i.focus(); } },
  'stock-loc': async el => {
    if (!D) return;
    const e = D.stock[Number(el.dataset.i)];
    if (el.value !== '__new' && el.value !== '__case') { e.loc = el.value; refreshSpaceNotes(); const z = $('#st-zone-' + el.dataset.i); if (z) z.innerHTML = zoneLineHtml(e.loc, e.shelf, formWineLike(), 'st-zone', Number(el.dataset.i)); return; }
    const name = el.value === '__case' ? await newCasePrompt() : await newLocationPrompt();
    if (name) e.loc = name;
    renderStockBox();
  },
  'mv-from': el => {
    D.move.from = Number(el.value);
    if (D.move.to === 'i:' + D.move.from) D.move.to = moveDefaultTo(D.move.from);
    const src = D.stock[D.move.from];
    D.move.n = clamp(D.move.n, 1, Math.max(1, src ? src.n : 1));
    renderStockBox();
  },
  'mv-to': async el => {
    if (el.value !== '__new') { D.move.to = el.value; renderStockBox(); return; }
    const name = await newLocationPrompt();
    if (name) D.move.to = 'loc:' + name;
    renderStockBox();
  },
  'wl-photo': async el => { const files = [...(el.files || [])]; el.value = ''; if (files.length) await listAddPhotos(files); },
  'somm-photo': async el => {
    const file = el.files && el.files[0];
    if (!file) return;
    try {
      const c = await loadPhoto(file);
      const full = toJpeg(c, 1280, 0.82), thumb = toJpeg(c, 240, 0.7);
      SOMM.photo = { b64: full.split(',')[1], thumb };
      // no keyboard: the question is optional, the steps below stay in view
      sommRefresh(false);
    } catch (e) { toast(e.message); }
    el.value = '';
  },
  photo: async el => {
    const file = el.files && el.files[0];
    if (!file) return;
    busy(true, 'Loading photo…');
    try {
      D.src = await loadPhoto(file);
      D.corners = defaultCorners(D.src);
      D.mids = null;
      D.cornersTouched = false;
      D.detectStarted = false;
      D.step = 'crop';
      busy(false);
      render();
    } catch (e) { busy(false); toast(e.message); }
  }
};

Object.assign(ACTS, TQ_ACTS, RH_ACTS, PL_ACTS, OR_ACTS, BT_ACTS, NT_ACTS, GD_ACTS, IM_ACTS, RECS_ACTS);
Object.assign(INPUTS, TQ_INPUTS, PL_INPUTS, OR_INPUTS, GD_INPUTS, RECS_INPUTS);
Object.assign(CHANGES, TQ_CHANGES, PL_CHANGES, OR_CHANGES, NT_CHANGES, GD_CHANGES, IM_CHANGES, RECS_CHANGES);

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
/* the hint on free space follows the number of bottles */
function refreshSpaceNotes() {
  const n = $('#space-note');
  if (n && RS) n.innerHTML = spaceNoteHtml(RS.loc, RS.qty, wineById(RS.wineId));
  if (D && D.mode === 'add') D.stock.forEach((e, i) => { const b = $('#st-space-' + i); if (b) b.innerHTML = spaceNoteHtml(e.loc, e.n, draftWineLike()); });
}

function setQty(el, final) {
  const raw = el.value.replace(/[^0-9]/g, '');
  const k = el.dataset.k;
  let v = raw === '' ? null : Number(raw);
  if (k === 'rs' && RS) {
    v = clamp(v === null ? 1 : v, 1, qtyMax());
    RS.qty = v;
    if (isBuyIn(RS)) totalSetQty(RS);
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
  if (k === 'rs' || k === 'st') refreshSpaceNotes();
  if (final || String(v) !== raw && raw !== '') el.value = v;
}

/* pull the screen down at the top to load your data from Google Drive again */
function setupPullRefresh() {
  const el = document.createElement('div');
  el.className = 'ptr'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = ICON.refresh;
  document.body.appendChild(el);
  let y0 = null, dy = 0;
  const blocked = () => !CFG || isFormRoute() || document.querySelector('.sheet, .sheet-backdrop, .pick-sheet') || syncing;
  document.addEventListener('touchstart', e => { y0 = window.scrollY <= 0 && e.touches.length === 1 && !blocked() ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (y0 === null) return;
    dy = Math.max(0, (e.touches[0].clientY - y0) * 0.5);
    if (window.scrollY > 0) { y0 = null; dy = 0; }
    el.classList.toggle('on', dy > 8);
    el.style.transform = `translateY(${Math.min(dy, 80) - 50}px) rotate(${dy * 4}deg)`;
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (y0 === null) return;
    y0 = null;
    if (dy >= 60) {
      el.classList.add('go'); el.style.transform = 'translateY(24px)';
      sync(false).finally(() => { el.classList.remove('go', 'on'); el.style.transform = ''; });
    } else { el.classList.remove('on'); el.style.transform = ''; }
    dy = 0;
  }, { passive: true });
}

function init() {
  setupPullRefresh();
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
    if (e.target && e.target.id === 'rec-input' && e.key === 'Enter') { e.preventDefault(); recAdd(e.target.value); }
    if (e.target && e.target.id === 'new-loc' && e.key === 'Enter') { e.preventDefault(); ACTS['loc-add'](); }
    if (e.target && e.target.dataset && e.target.dataset.input === 'tg-in' && e.key === 'Enter') { e.preventDefault(); addTag(e.target.dataset.k, e.target.value); }
    if (e.target && e.target.id === 'rt-score' && e.key === 'Enter') { e.preventDefault(); saveRatingSheet(); }
    if (e.target && e.target.id === 'ja-text' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); jaAsk(e.target.value); return; }
    if (e.target && e.target.dataset && e.target.dataset.input === 'somm-vin' && e.key === 'Enter') { e.preventDefault(); sommVintage(Number(e.target.dataset.i)); return; }
    if (e.target && e.target.id === 'somm-text' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (SOMM.mode === 'list') listAnalyze(); else sommAsk(e.target.value); }
    if (e.target && e.target.id === 'new-person' && e.key === 'Enter') { e.preventDefault(); ACTS['person-add'](); }
    if (e.target && e.target.id === 'new-ret-site' && e.key === 'Enter') { e.preventDefault(); ACTS['ret-add'](); }
    if (e.target && (e.target.id === 'ed-name' || e.target.id === 'ed-site') && e.key === 'Enter') { e.preventDefault(); saveEdit(); }
  });
  window.addEventListener('hashchange', () => {
    navTrack();
    jumpCheck();
    U.shopBack = null;
    if (VOICE.on) voiceCancel();
    if (SOMM.listening && route().p !== 'sommelier') sommStopVoice();
    if (TQ.listening && route().p !== 'taste') ttStopVoice();
    if (TQ.edit && route().p !== 'taste') tqStart();
    if (RS) closeSheet();
    if (RT) { RT = null; renderRatingSheet(); }
    if (RH.view) { RH.view = ''; rhRender(); }
    if (INFO.kind) closeInfo();
    render();
    infoReturn();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && CFG && !isFormRoute()) sync(true); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
  loadCache();
  render();
  hideSplash();
  if (CFG) sync(true);
}

/* the start picture fades out once the first screen is drawn */
function hideSplash() {
  const s = document.getElementById('splash');
  if (!s) return;
  requestAnimationFrame(() => requestAnimationFrame(() => { s.classList.add('out'); setTimeout(() => s.remove(), 600); }));
}

if (typeof document !== 'undefined') init();
if (typeof module !== 'undefined') module.exports = { normWine, serialWine, normRemoval, windowParts, statusOf, solveHomography, parseRatings, splitList, fmtScore, conv, avgPrice, S };
