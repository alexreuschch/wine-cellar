'use strict';

/* Vintary: the taste test and the rating coach. Six quick questions give a first taste profile, so the AI knows your taste
   before you have rated many wines. The test counts as much as two rated wines, so it fades with every wine you rate,
   discoveries included, but never below 5%. Loaded after settings.js and before actions.js, in the order of index.html. */

const TT_Q = 6;   // questions, the intro and the summary come on top
const TQ_COFFEE = ['Sweet, with milk', 'With milk, no sugar', 'Black', 'Strong espresso'];
const TQ_CHOC = ['Milk chocolate', 'Dark, around 60%', 'Dark, 70 to 75%', 'Very dark, 85% and more'];
const TQ_FRUIT = [['green', 'Green apple and lemon'], ['stone', 'Ripe peach and apricot'], ['red', 'Red berries and cherries'], ['dark', 'Dark plums and blackberries']];
const TQ_TYPES = ['Red', 'White', 'Rosé', 'Sparkling', 'Dessert'];

/* step 0 intro, 1 to 6 the questions, 7 the result */
const TQ = { step: 0, a: null, mode: '', draft: '', busy: false, found: null, msg: '', listening: false, rec: null, saving: false, edit: false };

const ratedCount = () => S.wines.filter(w => w.myRating !== null).length;
/* how much the test counts next to your own ratings: like two rated wines, so all of it without any, half at 2, 9% at 20, never below 5% */
const ttWeight = () => (S.tasteTest ? Math.max(0.05, 2 / (2 + ratedCount())) : 0);
const ttLater = () => { try { return localStorage.getItem('wc-tt-later') === '1'; } catch (e) { return false; } };
/* offered once to everyone who has not taken it: as the last step of the setup, or as a card after an update */
const ttOffer = () => S.version >= 34 && !S.tasteTest && !ttLater();

/* a first guess of the four axes for one wine type, from coffee, chocolate, fruit and oak */
function starterAxes(type, t) {
  if (!t || type === 'Dessert' || type === 'Fortified') return {};
  const bits = [t.coffee, t.choc].filter(Boolean);
  const b = bits.length ? bits.reduce((a, v) => a + v, 0) / bits.length : null;   // 1 mild and sweet to 4 strong and bitter
  const f = t.fruit;
  const c5 = v => Math.max(1, Math.min(5, Math.round(v)));
  const out = {};
  if (type === 'Red') {
    if (b !== null) out.tannin = c5(1 + b);
    if (b !== null || f) out.body = c5((b !== null ? 1.5 + b * 0.75 : 3) + (f === 'dark' ? 1 : f === 'red' || f === 'green' ? -1 : 0));
  } else if (f || t.oak !== null) out.body = c5(2 + (f === 'stone' || f === 'dark' ? 1 : 0) + (t.oak === true ? 1 : 0));
  if (f) out.acid = c5({ green: 5, red: 4, stone: 3, dark: 3 }[f] - (type === 'Red' && f === 'green' ? 1 : 0));
  if (t.coffee || t.choc) out.sweet = t.coffee === 1 || t.choc === 1 ? 2 : 1;
  return out;
}

const tqBlank = () => ({ types: [], coffee: null, choc: null, fruit: null, oak: null, anchor: null });
function tqStart() {
  ttStopVoice();
  Object.assign(TQ, { step: 0, a: tqBlank(), mode: '', draft: '', busy: false, found: null, msg: '', saving: false, edit: false });
}
tqStart();

const anchorName = w => [w.producer, w.name, w.vintage].filter(Boolean).join(' ') || w.region || 'this wine';

/* ---------------------------------------------------------------- view */

function tqOpts(k, opts) {
  return `<div class="tq-opts">${opts.map(([v, label]) => `<button class="tq-opt${TQ.a[k] === v ? ' on' : ''}" data-act="tq-pick" data-k="${k}" data-v="${esc(String(v))}">${esc(label)}</button>`).join('')}</div>`;
}
function tqSkip(label) { return TQ.edit ? '<button class="btn ghost block" data-act="tq-clear">Clear this answer</button>' : `<button class="btn ghost block" data-act="tq-next">${esc(label || 'Not sure, skip')}</button>`; }

function tqAnchorHtml() {
  const a = TQ.a.anchor;
  if (a) {
    const w = a.wine;
    return `<div class="card tq-found"><span class="tq-found-ic">${ICON.check}</span><div><b>${esc(anchorName(w))}</b><p class="small muted" style="margin:2px 0 0">${esc([w.type, w.region, w.grapes].filter(Boolean).join(' · '))}</p></div></div>
      ${TQ.edit ? '' : '<button class="btn primary big block" data-act="tq-next">Next</button>'}
      <button class="btn ghost block" data-act="tq-anchor-clear">Choose another wine</button>
      ${TQ.edit ? '<button class="btn ghost block" data-act="tq-clear">Remove this wine</button>' : ''}`;
  }
  if (TQ.found) {
    const w = TQ.found.wine;
    return `<div class="card tq-found"><span class="tq-found-ic">${ICON.magic}</span><div><p class="small muted" style="margin:0">${TQ.found.sure ? 'We found' : 'Did you mean'}</p><b>${esc(anchorName(w))}${TQ.found.sure ? '' : '?'}</b>
      <p class="small muted" style="margin:2px 0 0">${esc([w.type, w.region, w.grapes].filter(Boolean).join(' · '))}</p></div></div>
      <div class="grid2"><button class="btn primary" data-act="tq-yes">Yes, that's it</button><button class="btn" data-act="tq-no">No</button></div>`;
  }
  const talk = TQ.mode === 'talk' ? `<div class="field" id="tq-talk"><div class="note-voice"><textarea id="tq-text" data-input="tq-text" rows="3" placeholder="${TQ.listening ? 'Listening…' : 'For example: a Rioja, I think Reserva, with gold letters, last summer at friends'}">${esc(TQ.draft)}</textarea><button class="somm-mic${TQ.listening ? ' on' : ''}" data-act="tq-mic" aria-label="${TQ.listening ? 'Stop listening' : 'Speak'}">${ICON.mic}</button></div>
      <span class="tiny muted">${TQ.listening ? 'Listening. Take your time, tap stop when you are done. The name does not have to be exact.' : 'Type or tap the microphone and just talk. The name does not have to be exact.'}</span>
      <button class="btn primary block" data-act="tq-find"${TQ.busy ? ' disabled' : ''}>${ICON.magic}${TQ.busy ? 'Looking for the wine…' : 'Find this wine'}</button></div>` : '';
  return `${TQ.msg ? `<p class="small" style="margin:0;color:var(--gold)">${esc(TQ.msg)}</p>` : ''}
    <label class="btn block big${TQ.busy ? ' disabled' : ''}">${ICON.camera}${TQ.busy && TQ.mode === 'photo' ? 'Reading the label…' : 'Take a photo'}<input type="file" accept="image/*" capture="environment" data-change="tq-photo" hidden${TQ.busy ? ' disabled' : ''}></label>
    ${TQ.mode === 'talk' ? talk : `<button class="btn block big" data-act="tq-talk">${ICON.mic}Tell us about it</button>`}
    ${tqSkip('Skip, none comes to mind')}`;
}

function tqSummaryHtml() {
  const t = TQ.a;
  const types = (t.types.length ? t.types : ['Red', 'White']).filter(x => x === 'Red' || x === 'White' || x === 'Rosé' || x === 'Sparkling').slice(0, 3);
  const blocks = types.map(type => {
    const ax = starterAxes(type, t);
    const anc = t.anchor && t.anchor.profile && t.anchor.wine.type === type ? t.anchor.profile : null;
    const tiles = AXES.map(([k, name, words]) => {
      const none = k === 'tannin' && type !== 'Red';
      const vals = none ? [] : [ax[k], anc ? Number(anc[k]) || null : null].filter(Boolean);
      const v = vals.length ? Math.round(vals.reduce((a, x) => a + x, 0) / vals.length) : 0;
      return `<div class="tt"><span class="tt-name">${name}</span><b class="tt-word${v ? '' : ' muted'}">${v ? words[v - 1] : none ? 'None' : 'Open'}</b><div class="tt-segs">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= v ? 'on' : ''}"></i>`).join('')}</div></div>`;
    });
    return `<div class="tq-type"><p class="tp-lead">${esc(type)}</p><div class="tt-wrap" style="--wc:${TYPE_CHART[type]}"><div class="tt-grid">${tiles.join('')}</div></div></div>`;
  });
  const anyAnswer = t.types.length || t.coffee || t.choc || t.fruit || t.oak !== null || t.anchor;
  return `${anyAnswer ? blocks.join('') : '<div class="card"><p class="small" style="margin:0">You skipped all questions. That is fine: Vintary learns your taste from the first wines you rate.</p></div>'}
    ${t.anchor ? `<div class="card tq-found"><span class="tq-found-ic">${ICON.heart}</span><div><p class="small muted" style="margin:0">A wine you enjoyed</p><b>${esc(anchorName(t.anchor.wine))}</b></div></div>` : ''}
    <p class="small muted" style="margin:0">A first guess from your answers. It counts as much as two rated wines, so with every wine you rate your own taste takes over. You can change every answer later in Settings.</p>
    <button class="btn primary big block" data-act="tq-save"${TQ.saving || !anyAnswer ? ' disabled' : ''}>${TQ.saving ? 'Saving…' : 'Save my taste profile'}</button>
    <button class="btn ghost block" data-act="tq-restart">Start again</button>`;
}

function viewTaste() {
  const old = S.version && S.version < 34;
  const s = TQ.step;
  const top = `<div class="detail-top tq-top">${TQ.edit ? `<a class="back" href="#/settings">${ICON.back}Settings</a>` : s > 0 ? `<button class="back" data-act="tq-back">${ICON.back}Back</button>` : backLinkHtml('#/cellar', 'Cellar')}
    ${s > 0 && s <= TT_Q && !TQ.edit ? `<div class="tq-dots" aria-label="Question ${s} of ${TT_Q}">${Array.from({ length: TT_Q }, (_, i) => `<i class="${i < s ? 'on' : ''}"></i>`).join('')}</div>` : ''}</div>`;
  const q = (n, title, sub, body) => `<p class="tq-step">${TQ.edit ? 'Change your answer' : `Question ${n} of ${TT_Q}`}</p><h1 class="title tq-title">${title}</h1>${sub ? `<p class="muted" style="margin:0;line-height:1.5">${sub}</p>` : ''}${body}`;
  let body;
  if (old) body = '<div class="card notice"><b>Script update needed</b><p class="small" style="margin:4px 0 0">The taste test needs the new Code.gs. Replace the script code and create a new version under Manage deployments.</p></div>';
  else if (s === 0) body = `<div class="tq-hero"><span class="magic-ic">${ICON.magic}</span></div>
    <h1 class="title tq-title">Your taste in 60 seconds</h1>
    <p class="muted" style="margin:0;line-height:1.5">Six quick questions help Vintary understand what you like, even before you rate your first wine.</p>
    <div class="card tq-note"><b>There are no wrong answers.</b><p class="small" style="margin:4px 0 0">Skip anything you are not sure about. The test counts as much as two rated wines, so your own ratings soon count much more.</p></div>
    <button class="btn primary big block" data-act="tq-go">Start</button>
    ${S.tasteTest ? '' : '<button class="btn ghost block" data-act="tq-later">Not now</button>'}`;
  else if (s === 1) body = q(1, 'What do you like to drink?', 'Pick all that apply.',
    `<div class="tq-opts">${TQ_TYPES.map(t => `<button class="tq-opt${TQ.a.types.includes(t) ? ' on' : ''}" data-act="tq-type" data-v="${esc(t)}">${esc(t === 'Dessert' ? 'Sweet and dessert wines' : t)}</button>`).join('')}
      <button class="tq-opt${TQ.a.types.length >= 4 ? ' on' : ''}" data-act="tq-type" data-v="all">A bit of everything</button></div>
      <button class="btn primary big block" data-act="${TQ.edit ? 'tq-save-edit' : 'tq-next'}">${TQ.edit ? 'Save' : TQ.a.types.length ? 'Next' : 'Skip'}</button>`);
  else if (s === 2) body = q(2, 'A wine you really enjoyed?', 'If one comes to mind, show us the label or tell us about it. It helps us understand your taste faster.',
    `<div class="card tq-note"><b>No wine in mind? No problem at all.</b><p class="small" style="margin:4px 0 0">Your profile works just as well without it and gets better with every wine you rate.</p></div>${tqAnchorHtml()}`);
  else if (s === 3) body = q(3, 'How do you take your coffee?', '', tqOpts('coffee', TQ_COFFEE.map((l, i) => [i + 1, l])) + tqSkip("I don't drink coffee"));
  else if (s === 4) body = q(4, 'Which fruit do you enjoy most?', '', tqOpts('fruit', TQ_FRUIT) + tqSkip());
  else if (s === 5) body = q(5, 'Which chocolate do you prefer?', '', tqOpts('choc', TQ_CHOC.map((l, i) => [i + 1, l])) + tqSkip("I don't eat chocolate"));
  else if (s === 6) body = q(6, 'Vanilla, toast and butter in a wine?', 'Typical for wines aged in oak barrels.', tqOpts('oak', [['yes', 'I like that'], ['no', 'Rather not']]) + tqSkip());
  else body = `<h1 class="title tq-title">Your starting profile</h1>${tqSummaryHtml()}`;
  return `<main class="screen tq">${top}${body}</main>`;
}

/* ---------------------------------------------------------------- actions */

function tqGo(step) {
  ttStopVoice();
  TQ.step = Math.max(0, Math.min(TT_Q + 1, step));
  TQ.msg = '';
  render();
  window.scrollTo(0, 0);
}

async function tqFind(image) {
  if (TQ.busy) return;
  const text = image ? '' : String(TQ.draft || '').trim();
  if (!image && !text) { toast('Tell us a few words about the wine first.'); return; }
  ttStopVoice();
  TQ.busy = true; TQ.msg = ''; TQ.found = null;
  render();
  try {
    const d = await api('tasteAnchor', image ? { image } : { text });
    if (d && d.found) TQ.found = d;
    else TQ.msg = (d && d.message) || 'We could not recognize this wine. Try again, or simply skip.';
  } catch (e) { TQ.msg = e.message; }
  TQ.busy = false;
  if (route().p === 'taste') render();
}

async function tqSave() {
  if (TQ.saving) return;
  TQ.saving = true; render();
  try {
    const d = await api('setTasteTest', { test: TQ.a });
    S.tasteTest = d.tasteTest || null;
    persist();
    toast('Your taste profile is saved');
    tqStart();
    go(navPrev() && hashRoute(navPrev()).p !== 'taste' ? navPrev() : '#/cellar');
  } catch (e) { TQ.saving = false; toast(e.message); render(); }
}

async function tqSaveEdit() {
  if (TQ.saving) return;
  TQ.saving = true;
  try {
    const d = await api('setTasteTest', { test: TQ.a });
    S.tasteTest = d.tasteTest || null;
    persist();
    toast('Saved');
    tqStart();
    go('#/settings', true);
  } catch (e) { TQ.saving = false; toast(e.message); render(); }
}

async function ttDelete() {
  if (!confirm('Delete your taste test? Your ratings stay as they are.')) return;
  try {
    await api('setTasteTest', { test: null });
    S.tasteTest = null; persist(); toast('Taste test deleted'); render();
  } catch (e) { toast(e.message); }
}

function ttStartVoice() {
  const ta0 = $('#tq-text');
  if (ta0) TQ.draft = ta0.value;
  if (!voiceStart({
    get: () => TQ.draft,
    set: t => { TQ.draft = t; const ta = $('#tq-text'); if (ta) ta.value = t; },
    ui: on => { TQ.listening = on; if (route().p === 'taste') render(); }
  })) { if (ta0) ta0.focus(); }
}
function ttStopVoice() {
  if (TQ.listening) voiceCancel();
  TQ.listening = false;
}

const TQ_ACTS = {
  'tq-go': () => { TQ.a = tqBlank(); tqGo(1); },
  'tq-later': () => { try { localStorage.setItem('wc-tt-later', '1'); } catch (e) { /* only this session */ } go('#/cellar'); },
  'tq-dismiss': () => { try { localStorage.setItem('wc-tt-later', '1'); } catch (e) { /* only this session */ } render(); },
  'tq-back': () => (TQ.edit ? go('#/settings') : tqGo(TQ.step - 1)),
  'tq-next': () => tqGo(TQ.step + 1),
  'tq-restart': () => { tqStart(); tqGo(1); },
  'tq-type': el => {
    const v = el.dataset.v, a = TQ.a.types;
    if (v === 'all') TQ.a.types = a.length >= 4 ? [] : ['Red', 'White', 'Rosé', 'Sparkling'];
    else { const i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else a.push(v); }
    render();
  },
  'tq-pick': el => {
    const k = el.dataset.k, v = el.dataset.v;
    TQ.a[k] = k === 'oak' ? v === 'yes' : k === 'fruit' ? v : Number(v);
    render();
    if (TQ.edit) { tqSaveEdit(); return; }
    setTimeout(() => { if (route().p === 'taste' && TQ.step <= TT_Q) tqGo(TQ.step + 1); }, 220);
  },
  'tq-talk': () => { TQ.mode = 'talk'; TQ.msg = ''; render(); const ta = $('#tq-text'); if (ta) ta.focus(); },
  'tq-mic': () => { if (TQ.listening) voiceStop(); else ttStartVoice(); },
  'tq-find': () => { const ta = $('#tq-text'); if (ta) TQ.draft = ta.value; tqFind(null); },
  'tq-yes': () => { const f = TQ.found; TQ.a.anchor = { wine: f.wine, profile: f.profile, tags: f.tags || '' }; TQ.found = null; if (TQ.edit) tqSaveEdit(); else tqGo(3); },
  'tq-save-edit': () => tqSaveEdit(),
  'tq-clear': () => { const k = { 1: 'types', 2: 'anchor', 3: 'coffee', 4: 'fruit', 5: 'choc', 6: 'oak' }[TQ.step]; TQ.a[k] = k === 'types' ? [] : null; tqSaveEdit(); },
  'tt-edit': el => { ttStopVoice(); Object.assign(TQ, { a: Object.assign(tqBlank(), JSON.parse(JSON.stringify(S.tasteTest || {}))), step: Number(el.dataset.step), edit: true, mode: '', draft: '', found: null, msg: '', busy: false, saving: false }); go('#/taste'); },
  'tq-no': () => { TQ.found = null; TQ.msg = 'No problem. Add a few more details or a photo, or simply skip.'; TQ.mode = 'talk'; render(); },
  'tq-anchor-clear': () => { TQ.a.anchor = null; TQ.found = null; TQ.mode = ''; render(); },
  'tq-save': () => tqSave(),
  'tt-delete': () => ttDelete()
};
const TQ_INPUTS = { 'tq-text': el => { TQ.draft = el.value; } };
const TQ_CHANGES = {
  'tq-photo': async el => {
    const file = el.files && el.files[0];
    el.value = '';
    if (!file) return;
    try {
      const c = await loadPhoto(file);
      TQ.mode = 'photo';
      await tqFind(toJpeg(c, 1280, 0.82).split(',')[1]);
    } catch (e) { toast(e.message); }
  }
};

/* ---------------------------------------------------------------- the offer on other screens and the box in Settings */

function ttOfferHtml() {
  if (!ttOffer()) return '';
  return `<div class="card tq-offer"><span class="magic-ic">${ICON.magic}</span><div style="flex:1;min-width:0"><b>Your taste in 60 seconds</b>
    <p class="small muted" style="margin:2px 0 8px">Six quick questions, so the sommelier and the consultant know what you like from day one.</p>
    <div style="display:flex;gap:8px"><a class="btn primary" style="height:38px" href="#/taste">Start</a><button class="btn ghost" style="height:38px" data-act="tq-dismiss">Not now</button></div></div></div>`;
}

function ttSettingsHtml() {
  if (S.version && S.version < 34) return '';
  const t = S.tasteTest;
  if (!t) return `<section class="box"><span class="box-title">Taste test</span>
    <p class="small" style="margin:0">Six quick questions for a first taste profile, so the AI knows what you like from the start.</p>
    <a class="btn block" href="#/taste">${ICON.magic}Take the taste test</a></section>`;
  const n = ratedCount(), w = ttWeight();
  const fruit = (TQ_FRUIT.find(f => f[0] === t.fruit) || [])[1];
  const rows = [
    [1, 'Likes to drink', t.types && t.types.length ? t.types.join(', ') : ''],
    [2, 'A wine you enjoyed', t.anchor ? anchorName(t.anchor.wine) : ''],
    [3, 'Coffee', t.coffee ? TQ_COFFEE[t.coffee - 1] : ''],
    [4, 'Fruit', fruit || ''],
    [5, 'Chocolate', t.choc ? TQ_CHOC[t.choc - 1] : ''],
    [6, 'Oak, vanilla and toast', t.oak === true ? 'I like that' : t.oak === false ? 'Rather not' : '']
  ];
  return `<section class="box"><span class="box-title">Taste test</span>
    <p class="small" style="margin:0">${esc(`${t.date ? `Taken on ${fmtDate(t.date)}. ` : ''}It counts about ${Math.round(w * 100)}% next to your ${n} rated wine${n === 1 ? '' : 's'}, like two rated wines.`)}</p>
    <div class="rec-list">${rows.map(([st, label, val]) => `<button class="rec-btn tq-row" data-act="tt-edit" data-step="${st}"><span class="rec-text"><span class="rec-main">${esc(label)}</span><span class="small ${val ? '' : 'muted'}">${esc(val || 'Not answered')}</span></span>${ICON.chevron}</button>`).join('')}</div>
    <div class="grid2"><a class="btn" href="#/taste">Retake</a><button class="btn danger" data-act="tt-delete">Delete</button></div></section>`;
}

/* ---------------------------------------------------------------- my rating: words, favorites and the coach */

/* the words of the scale, spread over the whole range so that "good" has room in the sixties */
const RATE_WORDS = [[90, 'Unforgettable', 'One of the best wines I have had'], [80, 'Excellent', "I'd gladly buy it again"], [70, 'Very good', 'Really enjoyable'],
  [60, 'Good', 'Nice, nothing special'], [50, 'OK', 'Drinkable'], [0, 'Not for me', '']];
const rateWord = v => (v === null || v === undefined ? null : RATE_WORDS.find(x => v >= x[0]));
const rateWordText = v => { const r = rateWord(v); return r ? r[1] + (r[2] ? ` · ${r[2]}` : '') : ''; };

/* favorites follow your own scale: a heart, or your top quarter; with fewer than 8 ratings 80% and more */
const myRatings = () => S.wines.map(w => w.myRating).filter(v => v !== null).sort((a, b) => a - b);
function favThreshold() { const r = myRatings(); return r.length < 8 ? 80 : Math.round(quantile(r, 0.75)); }
function lowThreshold() { const r = myRatings(); return r.length < 8 ? 60 : Math.round(quantile(r, 0.25)); }
const isFavWine = (w, th) => !!w && (w.myFav || (w.myRating !== null && w.myRating >= th));

/* what the rating box is about: the edit form or the discovery sheet */
function rateCtx(kind) {
  if (kind === 'ds') {
    const w = RS ? wineById(RS.wineId) : null, x = (RS && RS.info) || {};
    return { v: RS ? RS.rating : null, type: (w && w.type) || x.type || '', id: w ? w.id : null, ext: w ? w.ratings : [], fav: !!(RS && RS.fav) };
  }
  return { v: D ? D.myRating : null, type: D ? D.fields.type : '', id: D && D.mode === 'edit' ? D.id : null, ext: D ? D.ratings.filter(r => str(r.score).trim() !== '') : [], fav: !!(D && D.myFav) };
}
const rateSet = (kind, v) => (kind === 'ds' ? setTasteRating(v) : setRating(v));
const ratedOthers = id => S.wines.filter(w => w.myRating !== null && w.id !== id);
const shortTitle = w => `${wineTitle(w)}${w.vintage ? ' ' + w.vintage : ''}`;

/* two of your own wines rated close to this value, the same type first */
function rateNearHtml(c) {
  if (c.v === null) return '';
  const near = ratedOthers(c.id).sort((a, b) => (a.type === c.type ? 0 : 1) - (b.type === c.type ? 0 : 1) || Math.abs(a.myRating - c.v) - Math.abs(b.myRating - c.v))
    .filter(w => Math.abs(w.myRating - c.v) <= 12).slice(0, 2);
  if (!near.length) return '';
  return `<p class="rate-near">Close to your ${near.map(w => `<b>${esc(shortTitle(w))}</b> ${w.myRating}%`).join(' and ')}</p>`;
}

function rateExtrasHtml(kind) {
  const c = rateCtx(kind);
  const ext = c.ext.length ? `<p class="rate-ext">${c.ext.map(r => `${esc(r.sys)} ${esc(String(r.score))}`).join(' · ')}<span> · only context, your taste counts</span></p>` : '';
  return `<p class="rate-word" id="${kind}-word">${esc(rateWordText(c.v))}</p>
    <div id="${kind}-near">${rateNearHtml(c)}</div>
    ${ext}
    <div id="${kind}-coach">${coachHtml(kind)}</div>
    <button class="rate-fav${c.fav ? ' on' : ''}" id="${kind}-fav" data-act="rate-fav" data-k="${kind}" aria-pressed="${c.fav}">${ICON.heart}One of my favorites</button>`;
}
/* after every change of the bar */
function rateRefresh(kind) {
  const c = rateCtx(kind);
  const wd = $('#' + kind + '-word'); if (wd) wd.textContent = rateWordText(c.v);
  const nr = $('#' + kind + '-near'); if (nr) nr.innerHTML = rateNearHtml(c);
}

/* the coach: three questions, then a tip you can still fine-tune */
const RC = { key: '', open: false, enjoy: 0, again: 0, cmp: null, res: null };
const COACH_ENJOY = ['Not really', 'It was fine', 'I enjoyed it', 'I loved it'];
const COACH_BAND = [null, [30, 49], [50, 69], [70, 84], [85, 100]];
const COACH_AGAIN = ['No', 'Maybe', 'Yes, gladly', 'Any time'];
const coachBase = () => { const b = COACH_BAND[RC.enjoy]; return Math.round(b[0] + (b[1] - b[0]) * [0.15, 0.4, 0.65, 0.9][RC.again - 1]); };
function coachReset(kind) {
  const c = rateCtx(kind);
  const key = kind + '|' + (c.id || (kind === 'ds' && RS && RS.info ? sameWineKey(RS.info) : 'new'));
  if (RC.key !== key) Object.assign(RC, { key, open: false, enjoy: 0, again: 0, cmp: null, res: null });
}

/* what to compare with: an own wine near the tip, the same type first; else the wine you loved in the taste test; else the wow question */
function coachComparator(kind, base, band) {
  const c = rateCtx(kind);
  const pool = ratedOthers(c.id).filter(w => w.myRating >= band[0] - 3 && w.myRating <= band[1] + 3);
  const by = list => list.slice().sort((a, b) => Math.abs(a.myRating - base) - Math.abs(b.myRating - base))[0];
  const w = by(pool.filter(x => x.type === c.type)) || by(pool);
  if (w) return { kind: 'wine', title: shortTitle(w), r: w.myRating };
  const a = S.tasteTest && S.tasteTest.anchor;
  if (a && RC.enjoy >= 3) return { kind: 'anchor', title: anchorName(a.wine), r: 90 };
  return RC.enjoy >= 3 ? { kind: 'wow' } : null;
}

function coachHtml(kind) {
  coachReset(kind);
  if (!RC.open) return `<button class="btn ghost rate-help" data-act="coach-open" data-k="${kind}">${ICON.magic}Help me rate</button>`;
  const chips = (act, labels, cur) => `<div class="coach-chips">${labels.map((l, i) => `<button class="chip${cur === i + 1 ? ' on' : ''}" data-act="${act}" data-k="${kind}" data-v="${i + 1}">${esc(l)}</button>`).join('')}</div>`;
  let body = '';
  if (RC.res) {
    body = `<p class="coach-tip"><b>My tip: ${esc(rateWord(RC.res.v)[1])}, about ${RC.res.v}%.</b>${RC.res.why ? ' ' + esc(RC.res.why) : ''} Feel free to fine-tune it with the bar, it is your rating.</p>
      <button class="btn ghost" style="height:34px;font-size:13px;align-self:flex-start" data-act="coach-restart" data-k="${kind}">Start again</button>`;
  } else if (!RC.enjoy) body = `<p class="coach-q">How much did you enjoy it?</p>${chips('coach-enjoy', COACH_ENJOY, RC.enjoy)}`;
  else if (!RC.again) body = `<p class="coach-q">If price didn't matter, would you drink it again?</p>${chips('coach-again', COACH_AGAIN, RC.again)}`;
  else if (RC.cmp && RC.cmp.kind === 'wow') body = `<p class="coach-q">Was there a wow moment?</p>${chips('coach-cmp', ['No', 'A small one', 'Yes, a real wow'], 0)}`;
  else if (RC.cmp) body = `<p class="coach-q">Compared with ${RC.cmp.kind === 'anchor' ? 'the' : 'your'} <b>${esc(RC.cmp.title)}</b>${RC.cmp.kind === 'anchor' ? ', the wine you loved' : ` (${RC.cmp.r}%)`}?</p>${chips('coach-cmp', ['Not as good', 'About the same', 'Better'], 0)}`;
  return `<div class="coach"><div class="coach-head"><span class="magic-ic">${ICON.magic}</span><b>Rating coach</b><button class="icon-btn" data-act="coach-close" data-k="${kind}" aria-label="Close the coach">${ICON.x}</button></div>
    ${RC.res ? '' : '<p class="coach-hint">Rate the wine, not the evening.</p>'}${body}</div>`;
}
function coachRedraw(kind) { const el = $('#' + kind + '-coach'); if (el) el.innerHTML = coachHtml(kind); }

function coachFinish(kind, pick) {
  const band = COACH_BAND[RC.enjoy];
  const base = coachBase();
  const fit = v => clamp(Math.round(v), band[0], band[1]);
  let v = base, why = '';
  const cm = RC.cmp;
  if (cm && cm.kind === 'wow') v = fit(pick === 1 ? base - 3 : pick === 3 ? (RC.enjoy === 4 ? Math.max(base, 93) : base + 5) : base);
  else if (cm && pick) {
    v = fit(cm.r + [-4, 0, 4][pick - 1]);
    why = `${['A bit below', 'On a par with', 'A bit above'][pick - 1]} ${cm.kind === 'anchor' ? 'the' : 'your'} ${cm.title}.`;
  }
  RC.res = { v, why };
  rateSet(kind, v);
  coachRedraw(kind);
}

const COACH_ACTS = {
  'coach-open': el => { coachReset(el.dataset.k); RC.open = true; coachRedraw(el.dataset.k); },
  'coach-close': el => { RC.open = false; coachRedraw(el.dataset.k); },
  'coach-restart': el => { Object.assign(RC, { enjoy: 0, again: 0, cmp: null, res: null, open: true }); coachRedraw(el.dataset.k); },
  'coach-enjoy': el => { RC.enjoy = Number(el.dataset.v); coachRedraw(el.dataset.k); },
  'coach-again': el => {
    const k = el.dataset.k;
    RC.again = Number(el.dataset.v);
    RC.cmp = coachComparator(k, coachBase(), COACH_BAND[RC.enjoy]);
    if (!RC.cmp) coachFinish(k, 0); else coachRedraw(k);
  },
  'coach-cmp': el => coachFinish(el.dataset.k, Number(el.dataset.v)),
  'rate-fav': el => {
    const k = el.dataset.k;
    if (k === 'ds') { if (RS) RS.fav = !RS.fav; } else if (D) D.myFav = !D.myFav;
    const on = rateCtx(k).fav;
    el.classList.toggle('on', on); el.setAttribute('aria-pressed', String(on));
  }
};
Object.assign(TQ_ACTS, COACH_ACTS);
