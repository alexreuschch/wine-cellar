'use strict';

/* Wine Cellar: Adding and editing wines: photo, crop, AI details and the form. Loaded after app.js, in the order of index.html. */

/* ------------------------------------------------------------ add and edit */

function defaultLocation() {
  const last = store.get('wc-lastloc', '');
  if (S.locations.includes(last)) return last;
  return S.locations.length === 1 ? S.locations[0] : '';
}

function newDraft(mode, w) {
  const src = w || normWine({ id: '', type: 'Red' });
  const street = src.street ? priceInput(src.street.v, src.street.cur) : '';
  return {
    mode, id: w ? w.id : null,
    step: mode === 'add' ? 'photo' : 'form',
    fields: {
      producer: src.producer, name: src.name, vintage: src.vintage, type: src.type, region: src.region, grapes: src.grapes,
      taste: src.taste, tasteTags: src.tasteTags.join(', '), pairings: src.pairings.join(', '),
      drinkFrom: str(src.drinkFrom), drinkUntil: str(src.drinkUntil), peakFrom: str(src.peakFrom), peakUntil: str(src.peakUntil),
      street, price: '', date: todayISO()
    },
    streetInit: street,
    stock: mode === 'add' ? [{ loc: defaultLocation(), shelf: null, pos: '', n: 1 }] : src.stock.map(e => Object.assign({}, e)),
    addLoc: false, move: null,
    myRating: src.myRating,
    acq: mode === 'add' ? { type: 'Purchase', pp: newPicker('people', ''), rp: newPicker('retailers', '', { single: true }), website: '', websiteInit: '' } : null,
    ratings: src.ratings.map(r => ({ sys: r.sys, score: String(r.score) })),
    preview: w ? w.thumb : '', thumb: w ? w.thumb : '', imageB64: null,
    src: null, corners: null, cornersTouched: false,
    profile: src.profile ? JSON.parse(JSON.stringify(src.profile)) : emptyProfile(),
    ai: null, aiMsg: '', touched: new Set()
  };
}

function viewForm(mode, id) {
  if (mode === 'edit') {
    const w = wineById(id);
    if (!w) return `<main class="screen"><a class="back" href="#/cellar">${ICON.back}Cellar</a><div class="empty"><h2>Wine not found</h2></div></main>`;
    if (!D || D.mode !== 'edit' || D.id !== id) D = newDraft('edit', w);
  } else if (!D || D.mode !== 'add') {
    D = newDraft('add', null);
  }
  const title = mode === 'add' ? 'Add wine' : 'Edit wine';
  const head = `<header class="form-top"><button data-act="cancel-form">Cancel</button><h1>${title}</h1><span></span></header>`;
  const stepIdx = { photo: 0, crop: 1, form: 2 }[D.step];
  const steps = mode === 'add' || D.step !== 'form'
    ? `<div class="steps">${['1 Photo', '2 Crop', '3 Review'].map((l, i) => `<span class="${i < stepIdx ? 'done' : i === stepIdx ? 'cur' : ''}">${l}</span>`).join('')}</div>` : '';
  if (D.step === 'photo') {
    return `<main class="screen">${head}${steps}<div class="photo-pick">
      <p>Photograph the front label. Fill the frame, keep it flat and well lit.</p>
      <label class="btn primary big">Take photo<input type="file" accept="image/*" capture="environment" data-change="photo" hidden></label>
      <label class="btn big">Choose from gallery<input type="file" accept="image/*" data-change="photo" hidden></label>
      <button class="btn ghost" data-act="skip-photo">${mode === 'add' ? 'Skip photo, enter manually' : 'Back to the form'}</button></div></main>`;
  }
  if (D.step === 'crop') {
    return `<main class="screen">${head}${steps}
      <div class="crop-wrap" id="crop-wrap"><canvas id="crop-canvas"></canvas><svg id="crop-svg"></svg></div>
      <p class="muted small center" id="crop-hint" style="margin:-6px 0 0">Detecting the label edges…</p>
      <div class="grid2"><button class="btn" data-act="retake">Retake</button><button class="btn accent" data-act="do-crop">Crop</button></div>
      <button class="btn ghost" data-act="use-full">Use the whole photo</button></main>`;
  }
  return `<main class="screen">${head}${steps}${formBody()}</main>`;
}

function stockEditorHtml() {
  const add = D.mode === 'add';
  const rows = D.stock.map((e, i) => {
    const locSel = add
      ? `<label class="field" style="flex:1;min-width:0">Location<select data-change="stock-loc" data-i="${i}">${e.loc ? '' : '<option value="" selected disabled>Choose a location</option>'}${S.locations.concat(e.loc && !S.locations.includes(e.loc) ? [e.loc] : []).map(l => `<option${l === e.loc ? ' selected' : ''}>${esc(l)}</option>`).join('')}<option value="__new">Add new location…</option></select></label>`
      : `<span class="stock-loc" style="flex:1;min-width:0">${ICON.pin}${esc(e.loc || 'No location')}</span>`;
    return `<div class="stock-edit${e.n === 0 ? ' zero' : ''}">
      <div style="display:flex;gap:10px;align-items:${add ? 'flex-end' : 'center'}">${locSel}<div class="stepper"><button data-act="st-n" data-i="${i}" data-d="-1" aria-label="Fewer bottles">${ICON.minus}</button><input class="step-num" type="text" inputmode="numeric" pattern="[0-9]*" id="st-n-${i}" data-input="qty-in" data-change="qty-in" data-k="st" data-i="${i}" aria-label="Number of bottles" value="${e.n}"><button data-act="st-n" data-i="${i}" data-d="1" aria-label="More bottles">${ICON.plus}</button></div></div>
      <div class="store-row">
        <div class="field">Shelf (optional)<div class="stepper"><button data-act="st-shelf" data-i="${i}" data-d="-1" aria-label="Shelf down">${ICON.minus}</button><span id="st-shelf-${i}" class="shelf-val">${esc(shelfText(e.loc, shelfVal(e.shelf)))}</span><button data-act="st-shelf" data-i="${i}" data-d="1" aria-label="Shelf up">${ICON.plus}</button></div></div>
        <label class="field">Position<input data-input="st-pos" data-i="${i}" placeholder="Back row, left" value="${esc(e.pos)}"></label>
      </div>
      ${!add && e.n === 0 ? '<p class="muted tiny" style="margin:0">Empty. Hidden after saving.</p>' : ''}
    </div>`;
  }).join('');
  if (add) return `<div class="box"><span class="box-title">Storage</span>${rows}</div>`;
  const addBox = D.addLoc
    ? `<div class="chips">${S.locations.map(l => `<button class="chip" data-act="st-add" data-v="${esc(l)}">${ICON.pin}${esc(l)}</button>`).join('')}<button class="chip" data-act="st-add-new">${ICON.plus}New location</button><button class="chip" data-act="st-add-close">Cancel</button></div>`
    : `<div class="chips"><button class="chip" data-act="st-add-open">${ICON.plus}Add storage place</button>${D.stock.filter(e => e.n > 0).length && D.stock.length > 1 ? `<button class="chip${D.move ? ' on' : ''}" data-act="st-move-open">${ICON.move}Move bottles</button>` : ''}</div>`;
  let move = '';
  if (D.move) {
    const src = D.stock[D.move.from];
    const opt = (i, on) => `<option value="${i}"${on ? ' selected' : ''}>${esc(placeLabel(D.stock[i]))}</option>`;
    const fromIdx = D.stock.map((e, i) => i).filter(i => D.stock[i].n > 0);
    const toIdx = D.stock.map((e, i) => i).filter(i => i !== D.move.from);
    move = `<div class="move-box"><span class="tiny muted">Move bottles between storage places</span>
      <label class="field">From<select data-change="mv-from">${fromIdx.map(i => opt(i, i === D.move.from)).join('')}</select></label>
      <label class="field">To<select data-change="mv-to">${toIdx.map(i => opt(i, i === D.move.to)).join('')}</select></label>
      <div class="between"><span class="small">Bottles</span><div class="stepper"><button data-act="mv-n" data-d="-1" aria-label="Fewer">${ICON.minus}</button><input class="step-num" type="text" inputmode="numeric" pattern="[0-9]*" id="mv-n" data-input="qty-in" data-change="qty-in" data-k="mv" aria-label="Number of bottles" value="${D.move.n}"><button data-act="mv-n" data-d="1" aria-label="More">${ICON.plus}</button></div></div>
      <div class="grid2"><button class="btn" data-act="st-move-close">Cancel</button><button class="btn accent" data-act="st-move"${src && src.n ? '' : ' disabled'}>Move</button></div></div>`;
  }
  return `<div class="box"><div class="between"><span class="box-title">Storage</span><span class="small muted" id="st-total">${D.stock.reduce((a, e) => a + e.n, 0)} bottles</span></div>${rows || '<p class="muted small" style="margin:0">No bottles in stock.</p>'}${addBox}${move}
    <p class="muted tiny" style="margin:0">Counts changed here are corrections. They adjust the purchases in the journal without a new entry. Use plus and minus on the wine to log new purchases and bottles taken.</p></div>`;
}

function acquisitionBox() {
  const a = D.acq, f = D.fields;
  const picker = label => `<div class="field"><span>${label}</span><div id="people-chips" class="chips">${peopleChipsHtml()}</div>
    <input id="people-input" data-input="people" aria-label="${label}" placeholder="${a.type === 'Purchase' ? 'Type the name of a shop or winery' : 'Type a name'}" autocomplete="off" autocapitalize="words" enterkeyhint="done" value="${esc(PK() ? PK().typing : '')}">
    <div id="people-sugg">${peopleSuggHtml()}</div></div>`;
  return `<div class="box"><span class="box-title">Acquired</span>
    <div class="grid3">${ADD_TYPES.map(([v, l]) => `<button class="btn${v === a.type ? ' primary' : ''}" style="height:42px;font-size:14px;padding:0 6px" data-act="acq" data-v="${v}">${l}</button>`).join('')}</div>
    ${a.type === 'Purchase' ? picker('Retailer') + `<div id="site-box">${siteBoxHtml()}</div>` : a.type === 'Received' ? picker('Gift from') : ''}
    <div class="form-grid">
      <label class="field${a.type === 'Purchase' ? '' : ' full'}">Date<input type="date" name="date" data-input="field" value="${esc(f.date)}"></label>
      ${a.type === 'Purchase' ? `<label class="field">Price per bottle${curLabel()}<input name="price" data-input="field" inputmode="decimal" placeholder="45.00" value="${esc(f.price)}"></label>` : ''}
    </div>
  </div>`;
}

function siteBoxHtml() {
  const a = D && D.acq;
  if (!a || a.type !== 'Purchase' || !a.rp.people.length) return '';
  return `<label class="field">Website of ${esc(a.rp.people[0].name)}<input data-input="acq-site" inputmode="url" autocapitalize="off" placeholder="www.shop.ch" value="${esc(a.website)}"></label>`;
}
function renderSiteBox() {
  const b = $('#site-box');
  if (b) b.innerHTML = siteBoxHtml();
}

function offerBoxHtml() {
  const w = D && D.id ? wineById(D.id) : null;
  if (!w) return '';
  const o = w.offer, busyNow = offerRun.has(w.id), area = shopCountryName();
  const info = o
    ? `<div class="between" style="gap:12px">${offerShopHtml(o, w)}<b style="flex:none">${esc(priceText(o.v, o.cur))}</b></div>${offerShipHtml(o, lastBuyQty(w))}`
    : `<p class="muted small" style="margin:0">No best offer yet.</p>`;
  return `<span class="box-title">Best offer</span>${info}
    <button class="btn" data-act="offer-one" data-id="${esc(w.id)}"${busyNow ? ' disabled' : ''}>${ICON.refresh}${busyNow ? 'Searching…' : o ? 'Update best offer' : 'Find best offer'}</button>
    <p class="muted tiny" style="margin:0">Searches the online shop with the lowest price for this wine, for buying in ${esc(area)}. Only the best offer is updated.</p>`;
}

function streetBox() {
  const w = D.id ? wineById(D.id) : null;
  const src = w && w.street ? streetSource(w.street) : '';
  return `<div class="box"><span class="box-title">Street price</span>
    <label class="field">Street price per bottle${curLabel()}<input name="street" data-input="field" inputmode="decimal" placeholder="${D.mode === 'add' ? 'Looked up after saving' : '52.00'}" value="${esc(D.fields.street)}"></label>
    ${src ? `<p class="muted tiny" style="margin:-4px 0 0" id="street-src">${esc(src)}</p>` : ''}
    ${D.mode === 'edit' ? `<button class="btn" data-act="street-one" data-id="${esc(D.id)}">${ICON.refresh}Update street price now</button>` : ''}
    <p class="muted tiny" style="margin:0">${D.mode === 'add' ? 'Leave empty and the street price is looked up on the web after saving.' : 'Overwrite to set your own value. It is converted when you change the currency.'}</p>
  </div>`;
}

function formBody() {
  const f = D.fields;
  const field = (label, key, opts = {}) => `<label class="field${opts.full ? ' full' : ''}">${label}<input name="${key}" data-input="field" value="${esc(f[key])}"${opts.num ? ' inputmode="numeric"' : ''}${opts.ph ? ` placeholder="${esc(opts.ph)}"` : ''}></label>`;
  const banner = '<div id="ai-banner" hidden></div><div id="dup-box">' + dupHtml() + '</div>';
  return `
    ${D.preview ? `<img class="preview" src="${esc(D.preview)}" alt="Label">` : ''}
    <button class="btn ghost" data-act="new-photo">${D.preview ? 'Replace label photo' : 'Add label photo'}</button>
    ${banner}
    <div class="form-grid">
      ${field('Producer', 'producer', { full: true })}
      ${field('Wine', 'name', { full: true })}
      ${field('Vintage', 'vintage', { num: true, ph: '2019' })}
      <label class="field">Type<select name="type" data-change="field">${TYPES.map(t => `<option${t === f.type ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      ${field('Region', 'region', { full: true, ph: 'Piedmont, Italy' })}
      ${field('Grapes', 'grapes', { full: true, ph: 'Nebbiolo 100%' })}

      ${field('Drink from', 'drinkFrom', { num: true })}
      ${field('Drink until', 'drinkUntil', { num: true })}
      ${field('Peak from', 'peakFrom', { num: true })}
      ${field('Peak until', 'peakUntil', { num: true })}
      <label class="field full">Taste<textarea name="taste" class="autosize" data-input="field" rows="5">${esc(f.taste)}</textarea></label>
      <div class="field full">Taste tags<div id="tg-tasteTags">${tagEditorHtml('tasteTags')}</div></div>
      <div class="field full">Dishes<div id="tg-pairings">${tagEditorHtml('pairings')}</div><span class="muted tiny">Exact dishes help the sommelier. The detail page shows the food categories below.</span></div>
    </div>
    <div class="box" id="tp-editor">${profileEditorHtml()}</div>
    <div class="box" id="ab-editor">${aboutEditorHtml()}</div>
    <button class="btn accent block" data-act="ai-refresh">${ICON.spark}Update wine info with AI</button>
    <p class="muted tiny" style="margin:-10px 0 0">Fills in details, drinking window, taste profile and background from what you entered, for example the vintage. Fields you changed here stay as they are. About 3 cents.</p>
    <div class="box"><div class="rating-head"><span class="box-title">My rating</span><span class="rating-val${D.myRating === null ? ' none' : ''}" id="rating-val">${D.myRating === null ? 'Not rated' : D.myRating + '%'}</span></div>
      <div class="rating-bar" id="rating-bar">${segsHtml(D.myRating, 30, 'lg')}</div>
      <div class="scale"><span>0</span><span>50</span><span>100</span></div>
      <div class="rating-ctl"><button data-act="rate" data-d="-1" aria-label="Minus 1 percent">${ICON.minus}</button><span>Drag the bar, fine-tune with minus and plus</span><button data-act="rate" data-d="1" aria-label="Plus 1 percent">${ICON.plus}</button></div>
      <button class="btn ghost" style="height:36px;align-self:center;font-size:13px" data-act="rate-clear">Clear rating</button>
    </div>
    <div class="box"><span class="box-title">External ratings</span>
      ${D.ratings.length ? `<div class="rec-list">${D.ratings.map((r, i) => `<div class="rec-row"><button class="rec-btn" data-act="ers-open" data-i="${i}" aria-label="Edit ${esc(r.sys)} rating"><span class="rec-text"><span class="rec-main">${esc(r.sys)}</span></span><span class="rate-val">${str(r.score).trim() === '' ? '<span class="muted">No score</span>' : ratingVisual({ sys: r.sys, score: Number(String(r.score).replace(',', '.')) })}</span>${ICON.chevron}</button><button class="icon-btn" data-act="rrm" data-i="${i}" aria-label="Remove ${esc(r.sys)} rating">${ICON.x}</button></div>`).join('')}</div>` : '<p class="muted small" style="margin:0">No external ratings yet.</p>'}
      ${D.ratings.length < SYSTEMS.length ? '<button class="btn dashed" data-act="ers-open" data-i="-1">Add rating</button>' : ''}
    </div>
    <div id="stock-box">${stockEditorHtml()}</div>
    ${D.mode === 'add' ? acquisitionBox() : `<div class="box"><span class="box-title">Purchases</span><div id="purchases-box">${purchasesHtml(wineById(D.id) || { id: D.id }, true)}</div>
      <button class="btn dashed" data-act="record-add">Add purchase record</button>
      <p class="muted tiny" style="margin:0">Tap a purchase to edit it or to set the retailer's website.</p></div>`}
    ${streetBox()}
    ${D.mode === 'edit' ? `<div class="box" id="offer-box">${offerBoxHtml()}</div>` : ''}
    <button class="btn primary big block" data-act="save-wine">Save wine</button>
    ${D.mode === 'edit' ? `<button class="btn danger block" data-act="delete-wine">Delete wine</button>` : ''}`;
}

/* tag editor for taste tags and food pairings */
const tagList = key => splitList(D.fields[key]);
function tagEditorHtml(key) {
  const tags = tagList(key);
  const ph = key === 'pairings' ? 'Add a dish, for example braised beef' : 'Add a tag, for example elegant';
  return `${tags.length ? `<div class="chips" style="margin-bottom:8px">${tags.map((t, i) => `<span class="person plain">${esc(t)}<button class="x" data-act="tg-rm" data-k="${key}" data-i="${i}" aria-label="Remove ${esc(t)}">${ICON.x}</button></span>`).join('')}</div>` : ''}
    <input id="tg-in-${key}" data-input="tg-in" data-k="${key}" placeholder="${ph}" autocapitalize="sentences" enterkeyhint="done">`;
}
function renderTagBox(key, focus) {
  const b = $('#tg-' + key);
  if (!b) return;
  b.innerHTML = tagEditorHtml(key);
  if (focus) { const i = $('#tg-in-' + key); if (i) i.focus(); }
}
function addTag(key, raw) {
  const add = String(raw || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!add.length) return;
  const tags = tagList(key);
  add.forEach(t => { if (!tags.some(x => lc(x) === lc(t))) tags.push(t); });
  D.fields[key] = tags.join(', ');
  D.touched.add(key);
  renderTagBox(key, true);
}

/* sheet for adding or editing one external rating */
let RT = null;
function openRatingSheet(i) {
  const r = i >= 0 ? D.ratings[i] : null;
  RT = { i, sys: r ? r.sys : '', score: r ? str(r.score) : '' };
  renderRatingSheet();
}
function renderRatingSheet() {
  const root = $('#sheet-root');
  if (!RT) { root.innerHTML = ''; return; }
  const used = D.ratings.map((r, j) => (j === RT.i ? '' : r.sys));
  const free = SYSTEMS.filter(x => !used.includes(x.key));
  const info = RT.sys ? sysInfo(RT.sys) : null;
  const scale = info ? (info.max === 5 ? '1 to 5, for example 4.2' : `0 to ${info.max}, for example ${info.max === 20 ? '17.5' : '92'}`) : '';
  root.innerHTML = `<div class="sheet-backdrop" data-act="ers-close"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rt-title">
    <div class="grab"></div>
    <div class="between"><h2 id="rt-title" style="font-size:18px;font-weight:600">${RT.i >= 0 ? 'Edit rating' : 'Add external rating'}</h2><button class="icon-btn" data-act="ers-close" aria-label="Close">${ICON.x}</button></div>
    <div style="display:flex;flex-direction:column;gap:8px"><span class="small muted">Rating system</span>
      <div class="grid2" style="gap:8px">${free.map(x => `<button class="btn sys-btn${x.key === RT.sys ? ' primary' : ''}" data-act="ers-sys" data-v="${esc(x.key)}"><span>${esc(x.key)}</span><small>of ${x.max}</small></button>`).join('')}</div></div>
    ${info ? `<label class="field">Score (${scale})<input id="rt-score" data-input="ers-score" inputmode="decimal" placeholder="${info.max === 5 ? '4.2' : info.max === 20 ? '17.5' : '92'}" value="${esc(RT.score)}"></label>
      <div id="rt-preview" class="rate-val">${rtPreview()}</div>` : ''}
    <div class="grid2"><button class="btn" data-act="ers-close">Cancel</button><button class="btn primary" data-act="ers-save"${info ? '' : ' disabled'}>Save</button></div>
  </div>`;
  const inp = $('#rt-score');
  if (inp && !RT.score) inp.focus();
}
function rtPreview() {
  const v = Number(String(RT.score).replace(',', '.'));
  if (!RT.sys || String(RT.score).trim() === '' || isNaN(v)) return '';
  const max = sysInfo(RT.sys).max;
  return v < 0 || v > max ? `<span class="small" style="color:var(--danger)">${esc(RT.sys)} scores go from 0 to ${max}.</span>` : ratingVisual({ sys: RT.sys, score: v });
}
function saveRatingSheet() {
  const v = Number(String(RT.score).replace(',', '.'));
  const max = sysInfo(RT.sys).max;
  if (String(RT.score).trim() === '' || isNaN(v) || v < 0 || v > max) { toast(`${RT.sys} scores go from 0 to ${max}.`); return; }
  const r = { sys: RT.sys, score: String(v) };
  if (RT.i >= 0) D.ratings[RT.i] = r; else D.ratings.push(r);
  RT = null;
  renderRatingSheet();
  render();
}

function renderStockBox() {
  const b = $('#stock-box');
  if (b) b.innerHTML = stockEditorHtml();
}

async function newLocationPrompt() {
  const name = (prompt('Name of the new location, for example Kitchen or Basement') || '').replace(/\s+/g, ' ').trim();
  if (!name) return '';
  const known = S.locations.find(l => lc(l) === lc(name));
  if (known) return known;
  S.locations.push(name);
  persist();
  api('addLocation', { name }).then(list => { S.locations = list; persist(); }).catch(e => toast('Location saved on this device only: ' + e.message));
  return name;
}

/* photo loading, cropping, perspective correction */

async function loadPhoto(file) {
  let bmp;
  if (window.createImageBitmap) {
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = null; }
  }
  if (!bmp) {
    bmp = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Could not read this image'));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bmp.width, h = bmp.height;
  const k = Math.min(1, 2000 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

function defaultCorners(c) {
  const mx = c.width * 0.1, my = c.height * 0.1;
  return [{ x: mx, y: my }, { x: c.width - mx, y: my }, { x: c.width - mx, y: c.height - my }, { x: mx, y: c.height - my }];
}

function setupCrop() {
  const canvas = $('#crop-canvas'), svgEl = $('#crop-svg');
  if (!canvas || !D || !D.src) return;
  canvas.width = D.src.width;
  canvas.height = D.src.height;
  canvas.getContext('2d').drawImage(D.src, 0, 0);
  svgEl.setAttribute('viewBox', `0 0 ${D.src.width} ${D.src.height}`);
  svgEl.setAttribute('preserveAspectRatio', 'none');
  drawCropOverlay();
  let drag = -1;
  const toImg = e => {
    const r = svgEl.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width * D.src.width, 0, D.src.width), y: clamp((e.clientY - r.top) / r.height * D.src.height, 0, D.src.height) };
  };
  svgEl.addEventListener('pointerdown', e => {
    const p = toImg(e);
    let best = -1, bd = Infinity;
    D.corners.forEach((c, i) => { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = i; } });
    if (bd < Math.max(D.src.width, D.src.height) * 0.12) { drag = best; svgEl.setPointerCapture(e.pointerId); e.preventDefault(); }
  });
  svgEl.addEventListener('pointermove', e => {
    if (drag < 0) return;
    D.corners[drag] = toImg(e);
    D.cornersTouched = true;
    drawCropOverlay();
  });
  const end = () => { drag = -1; };
  svgEl.addEventListener('pointerup', end);
  svgEl.addEventListener('pointercancel', end);
  if (!D.detectStarted) { D.detectStarted = true; detectCorners(); }
  else setHint('Drag the four corners onto the label edges.');
}

function drawCropOverlay() {
  const svgEl = $('#crop-svg');
  if (!svgEl || !D || !D.corners) return;
  const W = D.src.width, H = D.src.height, r = Math.max(W, H) * 0.022;
  const pts = D.corners.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  svgEl.innerHTML = `<path d="M0 0H${W}V${H}H0Z M${D.corners.map(c => `${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' L')}Z" fill="rgba(0,0,0,0.45)" fill-rule="evenodd"/>
    <polygon points="${pts}" fill="none" stroke="#C9A15B" stroke-width="${(r / 4).toFixed(1)}"/>
    ${D.corners.map(c => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${r.toFixed(1)}" fill="#C9A15B" stroke="#1A1410" stroke-width="${(r / 5).toFixed(1)}"/>`).join('')}`;
}

const setHint = t => { const h = $('#crop-hint'); if (h) h.textContent = t; };

function loadScript(src, timeout) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    const t = setTimeout(() => rej(new Error('timeout')), timeout);
    s.onload = () => { clearTimeout(t); res(); };
    s.onerror = () => { clearTimeout(t); rej(new Error('load failed')); };
    document.head.appendChild(s);
  });
}

let cvLoading = null;
function ensureScanner() {
  if (!cvLoading) {
    cvLoading = (async () => {
      if (!(window.cv && window.cv.Mat)) {
        if (!window.cv) await loadScript(OPENCV_URL, 45000);
        if (window.cv && !window.cv.Mat && typeof window.cv.then === 'function') window.cv.then(m => { if (m && m.Mat) window.cv = m; });
        const t0 = Date.now();
        while (!(window.cv && window.cv.Mat)) {
          if (Date.now() - t0 > 30000) throw new Error('OpenCV timeout');
          await sleep(150);
        }
      }
      if (!window.jscanify) await loadScript(JSCANIFY_URL, 20000);
      return true;
    })().catch(e => { cvLoading = null; throw e; });
  }
  return cvLoading;
}

function quadArea(q) {
  let a = 0;
  for (let i = 0; i < 4; i++) { const p = q[i], n = q[(i + 1) % 4]; a += p.x * n.y - n.x * p.y; }
  return Math.abs(a) / 2;
}

async function detectCorners() {
  const draft = D;
  try {
    await ensureScanner();
    if (D !== draft || D.step !== 'crop') return;
    const src = D.src;
    const k = Math.min(1, 900 / Math.max(src.width, src.height));
    const small = document.createElement('canvas');
    small.width = Math.round(src.width * k);
    small.height = Math.round(src.height * k);
    small.getContext('2d').drawImage(src, 0, 0, small.width, small.height);
    const cv = window.cv;
    const mat = cv.imread(small);
    const scanner = new window.jscanify();
    let quad = null;
    try {
      const contour = scanner.findPaperContour(mat);
      if (contour) {
        const c = scanner.getCornerPoints(contour, mat);
        const pts = [c.topLeftCorner, c.topRightCorner, c.bottomRightCorner, c.bottomLeftCorner];
        if (pts.every(p => p && isFinite(p.x) && isFinite(p.y))) quad = pts.map(p => ({ x: p.x / k, y: p.y / k }));
      }
    } finally { mat.delete(); }
    if (D !== draft || D.step !== 'crop') return;
    if (quad && quadArea(quad) > 0.08 * src.width * src.height && !D.cornersTouched) {
      D.corners = quad;
      drawCropOverlay();
      setHint('Edges detected. Drag the corners to adjust.');
      return;
    }
    setHint('Drag the four corners onto the label edges.');
  } catch (e) {
    setHint('Drag the four corners onto the label edges.');
  }
}

function solveHomography(from, to) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const u = from[i].x, v = from[i].y, x = to[i].x, y = to[i].y;
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
  }
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    const d = A[c][c];
    if (Math.abs(d) < 1e-10) throw new Error('The corners are too close together');
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / d;
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function warpQuad(srcCanvas, quad, maxSide = 1400) {
  const [tl, tr, br, bl] = quad;
  let W = Math.max(dist(tl, tr), dist(bl, br)), H = Math.max(dist(tl, bl), dist(tr, br));
  const k = Math.min(1, maxSide / Math.max(W, H));
  W = Math.max(8, Math.round(W * k));
  H = Math.max(8, Math.round(H * k));
  const h = solveHomography([{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }], [tl, tr, br, bl]);
  const sw = srcCanvas.width, sh = srcCanvas.height;
  const sd = srcCanvas.getContext('2d').getImageData(0, 0, sw, sh).data;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d');
  const img = octx.createImageData(W, H);
  const od = img.data;
  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W; u++) {
      const uu = u + 0.5, vv = v + 0.5;
      const den = h[6] * uu + h[7] * vv + 1;
      const x = clamp((h[0] * uu + h[1] * vv + h[2]) / den - 0.5, 0, sw - 1);
      const y = clamp((h[3] * uu + h[4] * vv + h[5]) / den - 0.5, 0, sh - 1);
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

function toJpeg(canvas, maxSide, q) {
  const k = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  let c = canvas;
  if (k < 1) {
    c = document.createElement('canvas');
    c.width = Math.round(canvas.width * k);
    c.height = Math.round(canvas.height * k);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
  }
  return c.toDataURL('image/jpeg', q);
}

async function finishCrop(quad) {
  busy(true, 'Straightening the label…');
  await sleep(30);
  try {
    const out = quad ? warpQuad(D.src, quad) : D.src;
    const full = toJpeg(out, 1200, 0.85);
    D.imageB64 = full.split(',')[1];
    D.preview = full;
    D.thumb = toJpeg(out, 180, 0.72);
    D.src = null;
    D.step = 'form';
    busy(false);
    render();
    if (D.mode === 'add') runAnalysis();
  } catch (e) {
    busy(false);
    toast(e.message);
  }
}

const HINT_KEYS = ['producer', 'name', 'vintage', 'type', 'region', 'grapes', 'taste', 'tasteTags', 'pairings'];

async function runAnalysis() {
  const draft = D;
  const hints = {};
  HINT_KEYS.forEach(k => {
    const v = str(draft.fields[k]).trim();
    if (v && (draft.touched.has(k) || draft.mode === 'edit')) hints[k] = v;
  });
  if (!draft.imageB64 && !hints.producer && !hints.name) { toast('Add a label photo or enter the producer or wine name first.'); return; }
  draft.ai = 'busy';
  updateBanner();
  try {
    const res = await api('analyze', { image: draft.imageB64 || null, hints });
    draft.ai = 'ok';
    draft.noVintage = !str(draft.fields.vintage).trim() && (res.vintage === null || res.vintage === undefined || res.vintage === '');
    applyAnalysis(draft, res || {});
    // no vintage on the label: ask for it, then fill in again for that vintage
    if (draft.noVintage && !draft.vintageAsked && D === draft) { draft.vintageAsked = true; vintageAsk(); }
    // the background on region, grapes, style and producer is brought up to date as well
    if (draft.mode === 'edit' && D === draft) fillInfos([{ region: draft.fields.region, grapes: draft.fields.grapes, producer: draft.fields.producer, profile: draft.profile, count: 1 }]).then(n => { if (n) toast(`Background updated for ${n} ${n === 1 ? 'entry' : 'entries'}: region, grapes, style or producer.`); });
  } catch (e) {
    draft.ai = 'error';
    draft.aiMsg = e.message.replace(/Claude API/g, 'AI service').replace(/Claude Console/g, 'API console').replace(/\.?$/, '.');
  }
  if (D === draft) updateBanner();
}

/* a wine you already have: same producer, wine and vintage */
const normName = v => str(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function findDuplicate(f) {
  const p = normName(f.producer), n = normName(f.name), v = normName(f.vintage);
  if (!p && !n) return null;
  return S.wines.find(w => (!D || w.id !== D.id) && normName(w.producer) === p && normName(w.name) === n && normName(w.vintage) === v) || null;
}
function dupHtml() {
  if (!D || D.mode !== 'add') return '';
  const w = findDuplicate(D.fields);
  if (!w || D.dupIgnore === w.id) return '';
  const where = w.stock.map(e => `${e.n} in ${placeLabel(e)}`).join(', ');
  return `<div class="dup-box"><p style="margin:0"><b>You already have this wine.</b> ${esc(wineTitle(w))} ${esc(w.vintage)}${w.count ? `: ${btl(w.count)}${where ? ` (${esc(where)})` : ''}` : ', finished'}. Add the new bottles to it instead, so its purchases and journal stay together.</p>
    <div class="grid2"><button class="btn" data-act="dup-keep">Keep as new wine</button><button class="btn accent" data-act="dup-add" data-id="${esc(w.id)}">Add bottles to it</button></div></div>`;
}
function renderDup() { const b = $('#dup-box'); if (b) b.innerHTML = dupHtml(); }

function applyAnalysis(draft, r) {
  const set = (key, val) => {
    if (val === null || val === undefined || val === '' || draft.touched.has(key)) return;
    const v = Array.isArray(val) ? val.join(', ') : String(val);
    draft.fields[key] = v;
    if (D === draft) {
      if (key === 'pairings' || key === 'tasteTags') renderTagBox(key);
      else { const el = document.querySelector(`[name="${key}"]`); if (el) { el.value = v; if (el.classList.contains('autosize')) autosize(el); } }
    }
  };
  ['producer', 'name', 'vintage', 'region', 'grapes', 'taste', 'tasteTags', 'pairings', 'drinkFrom', 'drinkUntil', 'peakFrom', 'peakUntil'].forEach(k => set(k, r[k]));
  if (r.type && !draft.touched.has('type')) {
    const t = TYPES.find(x => x.toLowerCase() === String(r.type).toLowerCase().replace('rose', 'rosé')) || null;
    if (t) { draft.fields.type = t; if (D === draft) { const el = document.querySelector('[name="type"]'); if (el) el.value = t; } }
  }
  if (r.profile && !draft.touched.has('profile')) {
    draft.profile = parseProfile(r.profile) || draft.profile;
    if (D === draft) { renderProfileEditor(); const ab = $('#ab-editor'); if (ab) { ab.innerHTML = aboutEditorHtml(); ab.querySelectorAll('.autosize').forEach(autosize); } }
  }
  if (D === draft) renderDup();
}

function updateBanner() {
  const b = $('#ai-banner');
  if (!b || !D) return;
  b.hidden = false;
  b.className = 'banner' + (D.ai === 'error' ? ' error' : '');
  b.innerHTML = D.ai === 'busy' ? '<span class="spinner"></span>Searching and completing details…'
    : D.ai === 'ok' ? ICON.spark + (D.noVintage ? 'No vintage on the label. Enter it, then tap Update wine info with AI for the right drinking window.' : 'Wine info completed. Review and correct.')
    : `Details could not be completed: ${esc(D.aiMsg)} You can fill them in yourself.`;
}

/**
 * Stock corrections in Edit are carried into the journal without a new entry:
 * more bottles go to the newest purchase or gift, fewer are taken from the newest ones,
 * each keeping at least one bottle. Without any purchase an entry "Added" is created.
 */
function journalForCorrection(w, delta, stock, wineName) {
  if (!delta) return [];
  const ins = inEntries(w).slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const out = e => Object.assign({}, e, { price: e.price === null ? '' : e.price });
  if (delta > 0) {
    if (ins.length) return [out(Object.assign({}, ins[0], { qty: ins[0].qty + delta }))];
    return [{ id: newId('i'), wineId: w.id, dir: 'in', type: 'Added', qty: delta, loc: stock[0] ? stock[0].loc : '', date: todayISO(), price: '', priceCur: '', wineName }];
  }
  let rest = -delta;
  const changed = [];
  ins.forEach(e => {
    if (!rest) return;
    const take = Math.min(rest, Math.max(0, e.qty - 1));
    if (!take) return;
    rest -= take;
    changed.push(out(Object.assign({}, e, { qty: e.qty - take })));
  });
  return changed;
}

async function saveWineForm() {
  ['pairings', 'tasteTags'].forEach(k => { const i = $('#tg-in-' + k); if (i && i.value.trim()) addTag(k, i.value); });
  const f = D.fields;
  if (!f.name.trim() && !f.producer.trim()) { toast('Enter at least a producer or a wine name.'); return; }
  const dup = D.mode === 'add' ? findDuplicate(f) : null;
  if (dup && D.dupIgnore !== dup.id) { renderDup(); const b = $('#dup-box'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'center' }); toast('You already have this wine. Choose below.'); return; }
  for (const r of D.ratings) {
    if (str(r.score).trim() === '') continue;
    const v = Number(String(r.score).replace(',', '.'));
    const max = sysInfo(r.sys).max;
    if (isNaN(v) || v < 0 || v > max) { toast(`${r.sys} scores go from 0 to ${max}.`); return; }
  }
  for (const k of ['drinkFrom', 'drinkUntil', 'peakFrom', 'peakUntil']) {
    const v = str(f[k]).trim();
    if (v && !/^\d{4}$/.test(v)) { toast('Drinking window years need four digits, for example 2027.'); return; }
  }
  const merged = [];
  D.stock.forEach(e => {
    const m = merged.find(x => samePlace(x, e));
    if (m) m.n += e.n; else merged.push(Object.assign(placeOf(e), { n: e.n }));
  });
  const stock = merged.filter(e => e.n > 0);
  if (stock.some(e => !str(e.loc).trim())) { toast('Choose a location. New ones can be added in the list.'); return; }
  const streetTxt = str(f.street).trim();
  if (streetTxt && parseMoney(streetTxt) === null) { toast('Prices need a number, for example 45.50.'); return; }
  const acq = D.acq;
  if (acq && acq.type === 'Purchase' && str(f.price).trim() && parseMoney(f.price) === null) { toast('Prices need a number, for example 45.50.'); return; }
  const P = PK();
  if (P && P.typing.trim()) addPerson(P.typing);
  const base = D.mode === 'edit' ? wineById(D.id) : null;
  let street = base ? base.street : null;
  if (streetTxt !== D.streetInit) street = streetTxt ? { v: parseMoney(streetTxt), cur: cur(), date: todayISO(), src: 'Manual', conf: '' } : null;
  const w = normWine(Object.assign({}, base || {}, {
    id: base ? base.id : newId('w'),
    producer: f.producer.trim(), name: f.name.trim(), vintage: str(f.vintage).trim(), type: f.type,
    region: f.region.trim(), grapes: f.grapes.trim(), taste: f.taste.trim(),
    tasteTags: splitList(f.tasteTags), pairings: splitList(f.pairings),
    drinkFrom: f.drinkFrom, drinkUntil: f.drinkUntil, peakFrom: f.peakFrom, peakUntil: f.peakUntil,
    stock, street,
    ratings: D.ratings.filter(r => str(r.score).trim() !== '').map(r => ({ sys: r.sys, score: Number(String(r.score).replace(',', '.')) })),
    thumb: D.thumb || (base ? base.thumb : ''),
    myRating: D.myRating,
    profile: (() => { const p = profileFromDraft(); if (p && D.touched.has('grapes')) p.typical = false; return p; })()
  }));
  const entries = [];
  if (acq && w.count > 0) {
    const price = acq.type === 'Purchase' ? parseMoney(f.price) : null;
    entries.push({
      id: newId('i'), dir: 'in', type: acq.type, qty: w.count, loc: stock[0].loc, date: f.date || todayISO(),
      price: price === null ? '' : price, priceCur: price === null ? '' : cur(),
      retailer: acq.type === 'Purchase' && acq.rp.people.length ? acq.rp.people[0].name : '',
      people: acq.type === 'Received' ? acq.pp.people.map(p => p.name).join(', ') : '',
      wineName: fullName(w)
    });
  }
  if (base) entries.push(...journalForCorrection(base, w.count - base.count, stock, fullName(w)));
  if (stock.length) store.set('wc-lastloc', stock[0].loc);
  const identity = x => lc([x.producer, x.name, x.vintage].join('|'));
  const refetch = !street || (base && streetTxt === D.streetInit && identity(base) !== identity(w));
  busy(true, 'Saving…');
  try {
    const d = await api('saveWine', { wine: serialWine(w), image: D.imageB64 || null, entries });
    const saved = normWine(d.wine || d);
    if (D.imageB64 && saved.labelFileId) cacheLabel(saved.labelFileId, D.imageB64);
    upsertWine(saved);
    (d.entries || []).map(normRemoval).forEach(r => {
      S.removals = S.removals.filter(x => x.id !== r.id).concat([r]);
      if (r.retailer && !S.retailers.some(x => lc(x.name) === lc(r.retailer))) S.retailers.push({ name: r.retailer, website: '' });
    });
    persist();
    const fromWish = D.fromWish;
    D = null;
    busy(false);
    if (fromWish) wishDelete(fromWish);
    go('#/wine/' + encodeURIComponent(saved.id), true);
    const ret = acq && acq.type === 'Purchase' && acq.rp.people.length ? acq.rp.people[0].name : '';
    if (ret && str(acq.website).trim() !== str(acq.websiteInit).trim()) saveRetailerSite(ret, str(acq.website).trim());
    if (refetch && S.version >= 5) updateStreetPrices([saved.id], true);
    fillInfos([saved]);
  } catch (e) {
    busy(false);
    toast('Not saved: ' + e.message);
  }
}

/* ---------------------------------------------------------------- no vintage on the label: ask for it */

function vintageAsk() {
  let root = $('#vint-root');
  if (!root) { root = document.createElement('div'); root.id = 'vint-root'; document.body.appendChild(root); }
  const y = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, i) => y - 1 - i);
  root.innerHTML = `<div class="sheet-backdrop" data-act="vint-close"></div>
  <div class="sheet vint-sheet" role="dialog" aria-modal="true" aria-label="Which vintage is it?">
    <div class="between"><h2 style="font-size:19px;font-weight:600">Which vintage is it?</h2><button class="icon-btn" data-act="vint-close" aria-label="Close">${ICON.x}</button></div>
    <p class="small muted" style="margin:0">The vintage is not readable on the label. It decides the drinking window, the taste profile and the prices.</p>
    <div class="vint-row"><input id="vint-in" inputmode="numeric" maxlength="4" placeholder="${y - 3}" aria-label="Vintage"><button class="btn accent" data-act="vint-ok">Fill in</button></div>
    <div class="vint-years">${years.map(v => `<button class="chip" data-act="vint-pick" data-v="${v}">${v}</button>`).join('')}</div>
    <button class="btn ghost block" data-act="vint-pick" data-v="NV">Non-vintage (NV)</button>
  </div>`;
  const i = $('#vint-in');
  if (i) { setTimeout(() => i.focus(), 80); i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); vintageChosen(i.value.trim()); } }); }
}
function vintageClose() { const r = $('#vint-root'); if (r) r.innerHTML = ''; }
function vintageChosen(v) {
  if (!D) { vintageClose(); return; }
  if (v === 'NV') { vintageClose(); D.noVintage = false; updateBanner(); toast('Kept as a non-vintage wine.'); return; }
  if (!/^\d{4}$/.test(v) || Number(v) < 1900 || Number(v) > new Date().getFullYear()) { toast('Enter the vintage with four digits, for example 2019.'); return; }
  vintageClose();
  D.fields.vintage = v;
  D.touched.add('vintage');
  const el = $('[name="vintage"]');
  if (el) el.value = v;
  runAnalysis();
}
