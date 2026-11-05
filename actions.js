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
  'f-less': el => { U.f[el.dataset.ctx].all[el.dataset.k] = false; refreshView(); },
  'f-clear': el => { const st = U.f[el.dataset.ctx]; st.sel = {}; st.range = {}; st.rating = null; refreshView(); },
  'rating-clear': el => { U.f[el.dataset.ctx].rating = null; refreshView(); },
  'rt-sys': el => {
    const st = U.f[el.dataset.ctx], v = el.dataset.v;
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
  'cons-save': el => { const p = CONS.result && CONS.result.picks[Number(el.dataset.i)]; if (p) consSave(p); },
  'wish-offer': el => { const x = S.wishlist.find(w => w.id === el.dataset.id); if (x) consOffer(x, 'wish:' + x.id, x.id); },
  'wish-del': el => wishDelete(el.dataset.id),
  'wish-add': el => wishToCellar(el.dataset.id),
  'somm-send': () => { const ta = $('#somm-text'); sommAsk(ta ? ta.value : SOMM.draft); },
  'somm-example': el => sommAsk(el.dataset.v),
  'somm-mic': () => { if (SOMM.listening) { sommStopVoice(); sommRefresh(false); } else sommStartVoice(); },
  'somm-tips': () => { SOMM.tips = !SOMM.tips; render(); },
  'somm-clear': () => { if (SOMM.listening) sommStopVoice(); SOMM.threads[SOMM.mode] = []; SOMM.draft = ''; SOMM.voiced = false; SOMM.photo = null; render(); },
  'somm-mode': el => { if (SOMM.listening) sommStopVoice(); SOMM.mode = el.dataset.v === 'check' ? 'check' : 'cellar'; SOMM.tips = false; SOMM.photo = null; history.replaceState(null, '', '#/sommelier/' + SOMM.mode); render(); window.scrollTo(0, 0); },
  'dup-keep': () => { const w = findDuplicate(D.fields); if (w) D.dupIgnore = w.id; renderDup(); },
  'dup-add': el => { const id = el.dataset.id; D = null; go('#/wine/' + encodeURIComponent(id)); setTimeout(() => openAddSheet(id), 200); },
  'somm-retry': () => { const last = sommThread().pop(); if (last) sommAsk(last.q, last.img); },
  'somm-photo-rm': () => { SOMM.photo = null; const pb = $('#somm-photo-box'); if (pb) pb.innerHTML = ''; },
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
  'p-rm': el => {
    const P = PK();
    P.people.splice(Number(el.dataset.i), 1);
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
  },
  'rs-qty': el => { RS.qty = clamp(RS.qty + Number(el.dataset.d), 1, qtyMax()); $('#rs-qty').value = RS.qty; },
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
    const back = D && D.mode === 'edit' ? '#/wine/' + encodeURIComponent(D.id) : '#/cellar';
    D = null;
    go(back, true);
  },
  'skip-photo': () => { D.step = 'form'; render(); },
  'new-photo': () => { D.step = 'photo'; render(); },
  retake: () => { D.step = 'photo'; D.src = null; render(); },
  'do-crop': () => finishCrop(D.corners),
  'use-full': () => finishCrop(null),
  'st-n': el => {
    const e = D.stock[Number(el.dataset.i)];
    e.n = clamp(e.n + Number(el.dataset.d), 0, 999);
    $('#st-n-' + el.dataset.i).value = e.n;
    const t = $('#st-total');
    if (t) t.textContent = D.stock.reduce((a, x) => a + x.n, 0) + ' bottles';
  },
  'st-shelf': el => {
    const e = D.stock[Number(el.dataset.i)];
    e.shelf = shelfStep(shelfVal(e.shelf), Number(el.dataset.d));
    $('#st-shelf-' + el.dataset.i).textContent = shelfText(e.loc, e.shelf);
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
    const to = D.stock.findIndex((e, i) => i !== from);
    if (from < 0 || to < 0) return;
    D.move = { from, to, n: 1 };
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
    const src = D.stock[m.from], dst = D.stock[m.to];
    if (!src || !dst || m.from === m.to) return;
    const n = Math.min(m.n, src.n);
    src.n -= n;
    dst.n += n;
    D.move = null;
    renderStockBox();
    toast(`${n} ${n === 1 ? 'bottle' : 'bottles'} moved to ${placeLabel(dst)}. Save to keep it.`);
  },
  radd: () => {
    const used = D.ratings.map(r => r.sys);
    const next = SYSTEMS.find(x => !used.includes(x.key)) || SYSTEMS[0];
    D.ratings.push({ sys: next.key, score: '' });
    render();
  },
  rrm: el => { D.ratings.splice(Number(el.dataset.i), 1); render(); },
  'ers-open': el => openRatingSheet(Number(el.dataset.i)),
  'ers-close': () => { RT = null; renderRatingSheet(); },
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
    const l = $('#wine-list'), f = $('#facet-chips-cellar'), d = $('#drink-soon');
    if (l) l.innerHTML = cellarList();
    if (d) d.innerHTML = drinkSoonHtml();
    if (f) f.innerHTML = facetChipsHtml('cellar');
  },
  facetq: el => { const ctx = el.dataset.ctx, st = U.f[ctx]; st.q[st.tab] = el.value; const f = $('#facet-chips-' + ctx); if (f) f.innerHTML = facetChipsHtml(ctx); },
  rs: el => {
    if (!RS) return;
    RS[el.name] = el.value;
    const h = el.name === 'pos' && $('#rs-hint');
    if (h) h.textContent = placeHint();
  },
  rng: el => onRange(el),
  rtmin: el => onRatingMin(el),
  'ed-shelf': el => { if (U.edit && U.edit.shelves) { const v = el.value.trim(); if (v) U.edit.shelves[el.dataset.n] = el.value; else delete U.edit.shelves[el.dataset.n]; } },
  'ers-score': el => { if (!RT) return; RT.score = el.value; const p = $('#rt-preview'); if (p) p.innerHTML = rtPreview(); },
  'tg-in': el => { if (el.value.includes(',')) { const k = el.dataset.k; addTag(k, el.value); } },
  'qty-in': el => setQty(el, false),
  'somm-text': el => { SOMM.draft = el.value; autosize(el); },
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
    if (f) f.innerHTML = facetChipsHtml('journal');
  },
  field: el => { if (D) { D.fields[el.name] = el.value; D.touched.add(el.name); if (['producer', 'name', 'vintage'].includes(el.name)) renderDup(); } if (el.classList.contains('autosize')) autosize(el); },
  rscore: el => { if (D) D.ratings[Number(el.dataset.i)].score = el.value; }
};

const CHANGES = {
  field: el => { if (D) { D.fields[el.name] = el.value; D.touched.add(el.name); } },
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
  'j-fav': el => { U.jFav = el.checked; refreshView(); },
  'qty-in': el => setQty(el, true),
  'stock-loc': async el => {
    if (!D) return;
    const e = D.stock[Number(el.dataset.i)];
    if (el.value !== '__new') { e.loc = el.value; return; }
    const name = await newLocationPrompt();
    if (name) e.loc = name;
    renderStockBox();
  },
  'mv-from': el => {
    D.move.from = Number(el.value);
    if (D.move.to === D.move.from) D.move.to = D.stock.findIndex((x, i) => i !== D.move.from);
    const src = D.stock[D.move.from];
    D.move.n = clamp(D.move.n, 1, Math.max(1, src ? src.n : 1));
    renderStockBox();
  },
  'mv-to': el => { D.move.to = Number(el.value); },
  'somm-photo': async el => {
    const file = el.files && el.files[0];
    if (!file) return;
    try {
      const c = await loadPhoto(file);
      const full = toJpeg(c, 1280, 0.82), thumb = toJpeg(c, 240, 0.7);
      SOMM.photo = { b64: full.split(',')[1], thumb };
      const pb = $('#somm-photo-box');
      if (pb) pb.innerHTML = sommPhotoHtml();
      const ta = $('#somm-text');
      if (ta) { ta.placeholder = sommPlaceholder(); ta.focus(); }
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
      D.cornersTouched = false;
      D.detectStarted = false;
      D.step = 'crop';
      busy(false);
      render();
    } catch (e) { busy(false); toast(e.message); }
  }
};

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
function setQty(el, final) {
  const raw = el.value.replace(/[^0-9]/g, '');
  const k = el.dataset.k;
  let v = raw === '' ? null : Number(raw);
  if (k === 'rs' && RS) {
    v = clamp(v === null ? 1 : v, 1, qtyMax());
    RS.qty = v;
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
  if (final || String(v) !== raw && raw !== '') el.value = v;
}

function init() {
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
    if (e.target && e.target.id === 'new-loc' && e.key === 'Enter') { e.preventDefault(); ACTS['loc-add'](); }
    if (e.target && e.target.dataset && e.target.dataset.input === 'tg-in' && e.key === 'Enter') { e.preventDefault(); addTag(e.target.dataset.k, e.target.value); }
    if (e.target && e.target.id === 'rt-score' && e.key === 'Enter') { e.preventDefault(); saveRatingSheet(); }
    if (e.target && e.target.id === 'somm-text' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sommAsk(e.target.value); }
    if (e.target && e.target.id === 'new-person' && e.key === 'Enter') { e.preventDefault(); ACTS['person-add'](); }
    if (e.target && e.target.id === 'new-ret-site' && e.key === 'Enter') { e.preventDefault(); ACTS['ret-add'](); }
    if (e.target && (e.target.id === 'ed-name' || e.target.id === 'ed-site') && e.key === 'Enter') { e.preventDefault(); saveEdit(); }
  });
  window.addEventListener('hashchange', () => {
    if (SOMM.listening && route().p !== 'sommelier') sommStopVoice();
    if (RS) closeSheet();
    if (RT) { RT = null; renderRatingSheet(); }
    render();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && CFG && !isFormRoute()) sync(true); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
  loadCache();
  render();
  if (CFG) sync(true);
}

if (typeof document !== 'undefined') init();
if (typeof module !== 'undefined') module.exports = { normWine, serialWine, normRemoval, windowParts, statusOf, solveHomography, parseRatings, splitList, fmtScore, conv, avgPrice, S };
