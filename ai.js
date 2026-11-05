'use strict';

/* Wine Cellar: AI sommelier, value over time, AI consultant and wishlist. Loaded after app.js, in the order of index.html. */

/* ------------------------------------------------------------ view: drinking window */

/* ------------------------------------------------------------ AI sommelier */

const SOMM = { mode: 'cellar', threads: { cellar: [], check: [] }, draft: '', busy: false, rec: null, listening: false, voiced: false, tips: false, photo: null };
const sommThread = () => SOMM.threads[SOMM.mode];
const SOMM_EXAMPLES = ['I feel like a fresh white wine tonight', 'Steak with salad, which wine fits?', 'Cheese fondue for four people', 'Something special for a birthday dinner under CHF 80', 'Which bottles should I open this month?'];
const CHECK_EXAMPLES = ['Is a Barolo 2019 for CHF 60 a good deal for me?', 'Gantenbein Pinot Noir 2020, CHF 45 in the shop', 'Château Musar 2016 on the wine list for CHF 95'];

/* how to use the sommelier for the cellar, shown before the first question and again with Tips */
function sommGuideHtml() {
  if (SOMM.mode === 'check') return checkGuideHtml();
  return `<div class="somm-guide">
    <h3>How to ask</h3>
    <ul>
      <li><b>Say what you feel like</b>, for example light, fruity, bold or something sparkling.</li>
      <li><b>Name the food</b> and how it is cooked: grilled steak, creamy pasta, spicy curry.</li>
      <li><b>Add the occasion</b> and how many people join, so it can suggest how many bottles.</li>
      <li><b>Set a limit</b> if you like: “under CHF 50” or “not my best bottles”.</li>
      <li><b>Ask a follow-up</b>, for example “something lighter?” or “and for dessert?”.</li>
    </ul>
    <h3>Speak or type</h3>
    <p>Tap the microphone and speak. Your words appear in the field, so you can correct them before you tap send. Nothing is sent without you.</p>
    <h3>What it knows</h3>
    <p>Your wines in stock with their drinking window, ratings, storage place and food pairings, and your recent journal with people, food and favorites. It suggests up to three wines from your cellar. Tap a wine to open it. If nothing fits, it tells you what to buy.</p>
    <p class="tiny muted">Answers come from AI and are suggestions. Each question costs a few cents.</p>
  </div>`;
}

/* how to check a wine that is not in the cellar */
function checkGuideHtml() {
  return `<div class="somm-guide">
    <h3>How it works</h3>
    <ul>
      <li><b>Photograph the label</b> or type the name, producer and vintage.</li>
      <li><b>Add the price</b> you see, for example “CHF 39 in the shop” or “CHF 85 on the wine list”, and the price is judged too.</li>
      <li><b>Ask a follow-up</b>, for example “what would I eat with it?” or “is the 2019 better?”.</li>
    </ul>
    <h3>What you get</h3>
    <p>How well the wine fits your taste in percent, based on your ratings, favorites and journal. Its style, whether the price is good value, and which wines in your cellar are similar, so you see if you already have something like it.</p>
    <p class="tiny muted">Answers come from AI and are estimates. Each check costs a few cents.</p>
  </div>`;
}

function sommAnswerHtml(t) {
  const check = t.mode === 'check';
  if (t.error) return `<div class="somm-a error"><p>${esc(t.error)}</p><button class="link-btn" data-act="somm-retry">${ICON.refresh}Try again</button></div>`;
  if (!t.a) return `<div class="somm-a"><p class="somm-wait">${check ? 'Looking at this wine' : 'Looking through your cellar'}<span>.</span><span>.</span><span>.</span></p></div>`;
  const picks = (t.a.picks || []).map(p => {
    const w = wineById(p.id);
    if (!w) return '';
    const where = w.stock.map(e => placeLabel(e)).join(' · ');
    return `<div class="somm-pick"><a class="somm-pick-link" href="#/wine/${encodeURIComponent(w.id)}">${thumbHtml(w, true)}<span class="somm-pick-text">
      <span class="row-title">${esc(wineTitle(w))} ${esc(w.vintage)}</span>
      <span class="row-sub">${flagOf(w)}${esc(w.producer)}${w.count ? ` · ${w.count} btl` : ''}${check && w.myRating !== null ? ` · rated ${w.myRating}%` : ''}</span>
      ${where && !check ? `<span class="tiny muted ellipsis">${esc(where)}</span>` : ''}
      ${p.why ? `<span class="somm-why">${esc(p.why)}</span>` : ''}</span>${check ? '' : pill(w)}</a>
      ${w.count && !check ? `<button class="somm-take" data-act="minus" data-id="${esc(w.id)}">${ICON.minus}Take a bottle</button>` : ''}</div>`;
  }).join('');
  const hasFit = t.a.fit !== null && t.a.fit !== undefined;
  const fit = t.a.wine ? `<div class="somm-fit"><div class="between" style="gap:10px"><b>${esc(t.a.wine)}</b>${hasFit ? `<span class="rating-val" style="font-size:22px">${t.a.fit}%</span>` : ''}</div>
    ${hasFit ? `${segsHtml(t.a.fit, 12)}<span class="tiny muted">How well it fits your taste</span>` : ''}</div>` : '';
  return `<div class="somm-a">${fit}${t.a.answer ? `<p>${esc(t.a.answer)}</p>` : ''}${picks ? `${check ? '<p class="small muted" style="margin:0">Similar wines in your cellar</p>' : ''}<div class="somm-picks">${picks}</div>` : ''}
    ${t.a.buy ? `<div class="somm-buy">${ICON.cart}<span><b>To buy</b><br>${esc(t.a.buy)}</span></div>` : ''}</div>`;
}

function sommIntroHtml() {
  if (SOMM.mode === 'check') {
    return `<div class="somm-intro">
      <div class="check-hero">
        <p style="margin:0">For wines that are <b>not in your cellar</b>: in a shop, at a restaurant or at a friend's. Photograph the label or type the name, and see if it suits you.</p>
        <label class="btn primary big block">${ICON.camera}Take a photo of the label<input type="file" accept="image/*" capture="environment" data-change="somm-photo" hidden></label>
        <label class="btn block">Choose from gallery<input type="file" accept="image/*" data-change="somm-photo" hidden></label>
      </div>
      <p class="small muted" style="margin:0">Or type it, for example:</p>
      <div class="somm-examples">${CHECK_EXAMPLES.map(x => `<button class="somm-ex" data-act="somm-example" data-v="${esc(x)}">${ICON.magic}<span>${esc(x)}</span></button>`).join('')}</div>
      ${checkGuideHtml()}</div>`;
  }
  return `<div class="somm-intro"><p class="muted">Tell me what you feel like, what you are eating or what the occasion is. I suggest wines from your cellar. Tap an example to try it.</p>
    <div class="somm-examples">${SOMM_EXAMPLES.map(x => `<button class="somm-ex" data-act="somm-example" data-v="${esc(x)}">${ICON.magic}<span>${esc(x)}</span></button>`).join('')}</div>
    ${sommGuideHtml()}
    <button class="somm-switch" data-act="somm-mode" data-v="check">${ICON.camera}<span>Looking at a wine in a shop or restaurant? <b>Will I like it?</b></span></button></div>`;
}

function sommThreadHtml() {
  const th = sommThread();
  if (!th.length) return sommIntroHtml();
  return (SOMM.tips ? sommGuideHtml() : '') + th.map(t => `<div class="somm-q">${t.photo ? `<img class="somm-q-photo" src="${esc(t.photo)}" alt="Label photo">` : ''}${t.q ? esc(t.q) : ''}</div>${sommAnswerHtml(t)}`).join('');
}

const sommTopHtml = () => `<a class="back" href="#/cellar">${ICON.back}Cellar</a>${sommThread().length ? `<div style="display:flex;gap:6px"><button class="btn ghost" style="height:40px" data-act="somm-tips">${SOMM.tips ? 'Hide tips' : 'Tips'}</button><button class="btn ghost" style="height:40px" data-act="somm-clear">${SOMM.mode === 'check' ? 'New wine' : 'New question'}</button></div>` : ''}`;
const sommPlaceholder = () => (SOMM.listening ? 'Listening…' : SOMM.mode === 'check' ? (SOMM.photo ? 'Add the price or a question, or just send' : 'Wine name, vintage and price') : 'What do you feel like?');
const sommLead = () => (SOMM.mode === 'check' ? 'Check a wine you see in a shop or restaurant.' : 'Advice from the wines in your cellar.');

function viewSommelier() {
  const r = route();
  if (r.id === 'check' || r.id === 'cellar') SOMM.mode = r.id;
  const old = S.version && S.version < 14;
  const check = SOMM.mode === 'check';
  return `<main class="screen somm">
    <div class="detail-top" id="somm-top">${sommTopHtml()}</div>
    <header><h1 class="title somm-title"><span class="magic-ic">${ICON.magic}</span>Sommelier</h1></header>
    <div class="toggle somm-modes"><button class="${check ? '' : 'on'}" data-act="somm-mode" data-v="cellar">${ICON.glass}My cellar</button><button class="${check ? 'on' : ''}" data-act="somm-mode" data-v="check">${ICON.camera}Will I like it?</button></div>
    <p class="small muted" style="margin:-4px 0 0">${sommLead()}</p>
    ${old ? '<div class="card notice"><b>Script update needed</b><p class="small" style="margin:4px 0 0">The sommelier needs the new Code.gs. Replace the script code and create a new version under Manage deployments.</p></div>' : ''}
    <div id="somm-thread" class="somm-thread">${sommThreadHtml()}</div>
  </main>
  <div class="somm-bar${check ? ' check' : ''}">
    <div id="somm-photo-box">${sommPhotoHtml()}</div>
    <div class="somm-input${SOMM.listening ? ' listening' : ''}">
      ${check ? `<label class="somm-cam" aria-label="Photo of a wine label">${ICON.camera}<input type="file" accept="image/*" capture="environment" data-change="somm-photo" hidden></label>` : ''}
      <textarea id="somm-text" data-input="somm-text" rows="1" placeholder="${sommPlaceholder()}" aria-label="Your question">${esc(SOMM.draft)}</textarea>
      <button class="somm-mic${SOMM.listening ? ' on' : ''}" data-act="somm-mic" aria-label="${SOMM.listening ? 'Stop listening' : 'Speak'}">${ICON.mic}</button>
      <button class="somm-send" data-act="somm-send" aria-label="Send"${SOMM.busy ? ' disabled' : ''}>${ICON.send}</button>
    </div>
    <p id="somm-hint" class="tiny muted somm-hint">${SOMM.listening ? 'Speak now. Tap the microphone again to stop.' : SOMM.voiced ? 'Check the text and correct it if needed, then tap send.' : ''}</p>
  </div>`;
}

function sommRefresh(scroll) {
  const th = $('#somm-thread');
  if (th) th.innerHTML = sommThreadHtml();
  const top = $('#somm-top');
  if (top) top.innerHTML = sommTopHtml();
  const ta = $('#somm-text');
  if (ta && ta.value !== SOMM.draft) { ta.value = SOMM.draft; autosize(ta); }
  const send = $('.somm-send');
  if (send) send.disabled = SOMM.busy;
  const hint = $('#somm-hint');
  if (hint) hint.textContent = SOMM.listening ? 'Speak now. Tap the microphone again to stop.' : SOMM.voiced ? 'Check the text and correct it if needed, then tap send.' : '';
  const box = $('.somm-input');
  if (box) box.classList.toggle('listening', SOMM.listening);
  const mic = $('.somm-mic');
  if (mic) { mic.classList.toggle('on', SOMM.listening); mic.setAttribute('aria-label', SOMM.listening ? 'Stop listening' : 'Speak'); }
  if (ta) ta.placeholder = sommPlaceholder();
  if (scroll) window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

const sommPhotoHtml = () => (SOMM.photo ? `<div class="somm-photo"><img src="${esc(SOMM.photo.thumb)}" alt="Label photo"><span class="small">Label photo ready. Add the price or a question, or just send.</span><button class="icon-btn" data-act="somm-photo-rm" aria-label="Remove photo">${ICON.x}</button></div>` : '');

async function sommAsk(text, photo) {
  const q = str(text).trim();
  const img = photo || SOMM.photo;
  if ((!q && !img) || SOMM.busy) return;
  if (SOMM.listening) sommStopVoice();
  const mode = img ? 'check' : SOMM.mode;
  if (mode !== SOMM.mode) { SOMM.mode = mode; history.replaceState(null, '', '#/sommelier/' + mode); render(); }
  const th = SOMM.threads[mode];
  const history = th.filter(t => t.a).slice(-3).map(t => ({ q: t.q || (t.a.wine ? `Will I like this wine? (label photo of ${t.a.wine})` : 'Will I like this wine?'), a: JSON.stringify(t.a) }));
  const turn = { q, a: null, error: '', photo: img ? img.thumb : '', img, mode };
  th.push(turn);
  SOMM.photo = null;
  const pb = $('#somm-photo-box');
  if (pb) pb.innerHTML = '';
  SOMM.draft = '';
  SOMM.voiced = false;
  SOMM.busy = true;
  SOMM.tips = false;
  sommRefresh(true);
  try {
    turn.a = await api('sommelier', { question: q, history, image: img ? img.b64 : null, mode });
  } catch (e) {
    turn.error = /Unknown action/i.test(e.message) ? 'The sommelier needs the new Code.gs. Update the script, then try again.' : e.message.replace(/Claude API/g, 'AI service');
  }
  SOMM.busy = false;
  sommRefresh(true);
}

function sommStartVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Voice input is not available here. Use the microphone on your keyboard instead.', 5000); $('#somm-text').focus(); return; }
  const rec = new SR();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  const base = SOMM.draft ? SOMM.draft.trim() + ' ' : '';
  rec.onresult = e => {
    let txt = '';
    for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
    SOMM.draft = base + txt.trim();
    SOMM.voiced = true;
    sommRefresh(false);
  };
  rec.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Allow the microphone for this app to speak your question.', 5000);
    else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Voice input stopped. Try again or type your question.');
  };
  rec.onend = () => { SOMM.listening = false; SOMM.rec = null; sommRefresh(false); const ta = $('#somm-text'); if (ta && SOMM.draft) ta.focus(); };
  try { rec.start(); } catch (e) { toast('Voice input could not start.'); return; }
  SOMM.rec = rec;
  SOMM.listening = true;
  sommRefresh(false);
}

function sommStopVoice() {
  if (SOMM.rec) { try { SOMM.rec.stop(); } catch (e) { /* already stopped */ } }
  SOMM.listening = false;
}

/* ------------------------------------------------------------ value over time */

const normHistory = h => ({ month: str(h.month).slice(0, 7), bottles: Number(h.bottles) || 0, cost: Number(h.cost) || 0, street: Number(h.street) || 0, cur: str(h.cur) || 'CHF' });
let snapshotBusy = false;
/* once a month, and again when the value changed, the app stores the value of the cellar */
async function snapshotValue() {
  if (snapshotBusy || !S.version || S.version < 13) return;
  const month = todayISO().slice(0, 7);
  const t = totals();
  const bottles = S.wines.reduce((a, w) => a + w.count, 0);
  const snap = { month, bottles, cost: Math.round(t.cost), street: Math.round(t.street), cur: cur() };
  const old = S.history.find(h => h.month === month);
  if (old && old.bottles === snap.bottles && old.cur === snap.cur && Math.round(old.cost) === snap.cost && Math.round(old.street) === snap.street) return;
  snapshotBusy = true;
  try { S.history = (await api('snapshot', { snapshot: snap })).map(normHistory); persist(); } catch (e) { /* tried again at the next start */ }
  snapshotBusy = false;
}

/* bottles in stock at the end of each of the last 12 months, worked out backwards from the journal */
function bottlesByMonth() {
  let stock = S.wines.reduce((a, w) => a + w.count, 0);
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const after = S.removals.filter(r => str(r.date) >= end);
    const net = after.reduce((a, r) => a + (r.dir === 'in' ? 1 : -1) * (Number(r.qty) || 1), 0);
    months.unshift({ label: m.toLocaleDateString('en-US', { month: 'narrow' }), n: Math.max(0, stock - net) });
  }
  return months;
}

/* two lines on one money axis: costs and street value */
function valueChart(hist) {
  const pts = hist.map(h => ({ m: h.month, cost: conv(h.cost, h.cur) || 0, street: conv(h.street, h.cur) || 0 }));
  const W = 340, H = 150, L = 20, R = 20, T = 30, B = 22;
  const max = Math.max(1, ...pts.map(p => Math.max(p.cost, p.street))) * 1.1;
  const x = i => L + (pts.length === 1 ? (W - L - R) / 2 : i * (W - L - R) / (pts.length - 1));
  const y = v => T + (H - T - B) * (1 - v / max);
  const line = (k, c) => `${pts.length > 1 ? `<polyline fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" points="${pts.map((p, i) => `${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ')}"/>` : ''}${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p[k]).toFixed(1)}" r="4" fill="${c}" stroke="var(--bg)" stroke-width="2"><title>${esc(p.m)}: ${esc(money(p[k], 0))}</title></circle>`).join('')}`;
  const lab = (i, t) => `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="vc-l">${esc(t)}</text>`;
  const ml = m => { const [yy, mo] = m.split('-').map(Number); return new Date(yy, mo - 1, 1).toLocaleDateString('en-US', { month: 'short' }) + (mo === 1 || pts.length === 1 ? ` ${String(yy).slice(2)}` : ''); };
  const step = Math.max(1, Math.ceil(pts.length / 6));
  return `<svg class="vc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Value of your cellar over time">
    <line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)"/>
    ${line('cost', '#9AA8C2')}${line('street', 'var(--gold)')}
    <text x="${W - R}" y="${(y(pts[pts.length - 1].street) - 10).toFixed(1)}" text-anchor="end" class="vc-v">${esc(money(pts[pts.length - 1].street, 0))}</text>
    ${pts.map((p, i) => (i % step === 0 || i === pts.length - 1 ? lab(i, ml(p.m)) : '')).join('')}</svg>
    <div class="vc-legend"><span><i style="background:var(--gold)"></i>Total Street Value</span><span><i style="background:#9AA8C2"></i>Total Costs</span></div>`;
}

/* ------------------------------------------------------------ AI consultant and wishlist */

function normWish(x) {
  let offer = null;
  try { offer = x.offer ? (typeof x.offer === 'string' ? JSON.parse(x.offer) : x.offer) : null; } catch (e) { offer = null; }
  return {
    id: str(x.id), producer: str(x.producer), name: str(x.name), vintage: str(x.vintage), type: str(x.type), region: str(x.region), grapes: str(x.grapes),
    price: numOrNull(x.price), priceCur: str(x.priceCur) || cur(), label: str(x.label), why: str(x.why), value: str(x.value),
    qty: numOrNull(x.qty), replaces: str(x.replaces), offer: offer && offer.shop ? offer : null, createdAt: str(x.createdAt)
  };
}
const wishTitle = x => [x.producer, x.name, x.vintage].filter(Boolean).join(' ');
const wishKey = x => lc([x.producer, x.name].join('|'));

const CONS = { focus: '', budget: null, note: '', busy: false, result: null, error: '', offers: {}, offerRun: new Set() };
(() => { const c = store.get('wc-consult', null); if (c && c.result) { CONS.result = c.result; CONS.offers = c.offers || {}; } })();
const saveConsult = () => store.set('wc-consult', { result: CONS.result, offers: CONS.offers });
const CONS_FOCUS = ['Like my favorites', 'Discover something new', 'Everyday wines', 'Special bottles', 'Top value'];
const LABEL_CLS = { 'Safe bet': 'safe', Discovery: 'disc', 'Top value': 'value' };

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/* the taste profile, calculated in the app from stock, finished wines, ratings, journal and purchase prices */
function tasteProfile() {
  const stock = S.wines.filter(w => w.count > 0);
  const since = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10);
  const opened = S.removals.filter(r => r.dir === 'out' && r.type !== 'Sale' && r.type !== 'Gift');
  const recent = opened.filter(r => str(r.date) >= since);
  const qty = r => Number(r.qty) || 1;
  // bottles ever owned per wine: purchases and gifts in, otherwise the stock plus what went out
  const owned = w => { const ins = inEntries(w).reduce((a, r) => a + qty(r), 0); return ins || w.count + S.removals.filter(r => r.wineId === w.id && r.dir === 'out').reduce((a, r) => a + qty(r), 0); };
  const all = S.wines.map(w => ({ w, n: owned(w) })).filter(x => x.n > 0);
  const totalOwned = all.reduce((a, x) => a + x.n, 0) || 1;
  const byType = TYPES.map(t => ({ t, n: all.filter(x => x.w.type === t).reduce((a, x) => a + x.n, 0) })).filter(x => x.n).sort((a, b) => b.n - a.n);
  const tallyTop = (keyOf, k) => { const m = new Map(); all.forEach(x => keyOf(x.w).forEach(v => { const key = lc(v); const e = m.get(key) || { v, n: 0 }; e.n += x.n; m.set(key, e); })); return [...m.values()].sort((a, b) => b.n - a.n).slice(0, k).map(e => e.v); };
  const grapes = tallyTop(grapeNames, 4);
  const regions = tallyTop(w => (w.region ? [str(w.region).split(',')[0].trim()] : []), 4);
  const prices = [];
  S.removals.filter(r => r.dir === 'in' && r.type === 'Purchase' && r.price !== null && r.price > 0).forEach(r => { const v = conv(r.price, r.priceCur || cur()); if (v) for (let i = 0; i < Math.min(qty(r), 24); i++) prices.push(v); });
  if (!prices.length) stock.forEach(w => { const v = streetOf(w); if (v) prices.push(v); });
  prices.sort((a, b) => a - b);
  const p25 = quantile(prices, 0.25), p50 = quantile(prices, 0.5), p75 = quantile(prices, 0.75);
  const rated = S.wines.filter(w => w.myRating !== null).sort((a, b) => b.myRating - a.myRating);
  const top = rated.filter(w => w.myRating >= 85).slice(0, 4);
  const low = rated.filter(w => w.myRating < 75).slice(-3);
  const tagM = new Map();
  rated.filter(w => w.myRating >= 85).forEach(w => w.tasteTags.forEach(t => { const k = lc(t); tagM.set(k, (tagM.get(k) || 0) + 1); }));
  const tags = [...tagM.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
  const perMonth = recent.reduce((a, r) => a + qty(r), 0) / 12;
  const occ = tally(recent, r => [entryType(r)], qty).sort((a, b) => b.n - a.n).slice(0, 2).map(e => e.k);
  const cover = TYPES.map(t => {
    const st = stock.filter(w => w.type === t).reduce((a, w) => a + w.count, 0);
    const used = recent.filter(r => { const w = wineById(r.wineId); return w && w.type === t; }).reduce((a, r) => a + qty(r), 0);
    return { t, stock: st, used, months: used ? Math.round(st / (used / 12)) : null };
  }).filter(c => c.stock || c.used);
  const fmtP = v => fmtNum(Math.round(v), 0);
  const lines = [];
  if (byType.length) lines.push(['Wine types', byType.slice(0, 3).map(x => `${x.t} ${pct(x.n, totalOwned)}%`).join(', ')]);
  if (grapes.length) lines.push(['Grapes', grapes.join(', ')]);
  if (regions.length) lines.push(['Regions', regions.join(', ')]);
  if (p50 !== null) lines.push(['Usual price', `${cur()} ${fmtP(p25)} to ${fmtP(p75)} per bottle, median ${fmtP(p50)}`]);
  if (top.length) lines.push(['Rated highest', top.map(w => `${wineTitle(w)} ${w.vintage} ${w.myRating}%`).join(', ')]);
  if (tags.length) lines.push(['Style you like', tags.join(', ')]);
  lines.push(['Drinking', perMonth ? `about ${fmtNum(perMonth, 1)} bottles per month${occ.length ? `, mostly ${occ.join(' and ').toLowerCase()}` : ''}` : 'no bottles opened in the last 12 months']);
  const text = [
    ...lines.map(l => `${l[0]}: ${l[1]}`),
    low.length ? `Rated lowest: ${low.map(w => `${fullName(w)} ${w.myRating}%`).join(', ')}` : '',
    'Stock compared with drinking over the last 12 months:',
    ...cover.map(c => `${c.t}: ${btl(c.stock)} in stock, ${c.used} opened in 12 months${c.months !== null ? `, lasts about ${c.months} months` : ''}`)
  ].filter(Boolean).join('\n');
  const round5 = v => Math.max(5, Math.round(v / 5) * 5);
  return { lines, cover, text, budget: p50 !== null ? { min: round5(p25 * 0.8), max: round5(p75 * 1.2) } : { min: '', max: '' } };
}

function offerLineHtml(o) {
  return `<div class="cons-offer"><div style="min-width:0"><p class="ellipsis" style="margin:0;font-weight:600">${esc(o.shop)}</p><p class="tiny muted" style="margin:2px 0 0">${esc([o.area, o.vintage ? `vintage ${o.vintage}` : '', o.date ? `checked ${fmtDate(o.date)}` : ''].filter(Boolean).join(' · '))}</p></div>
    <a class="btn accent offer-btn" href="${esc(o.url)}" target="_blank" rel="noopener">${esc(priceText(o.v, o.cur))}${ICON.link}</a></div>`;
}

function pickCardHtml(p, i, saved) {
  const key = wishKey(p);
  const rw = p.replaces ? wineById(p.replaces) : null;
  const o = CONS.offers[key];
  const busyO = CONS.offerRun.has(key);
  const c = countryOf(p);
  return `<div class="cons-card">
    <div class="between" style="gap:8px;align-items:flex-start"><span class="cons-label ${LABEL_CLS[p.label] || 'disc'}">${esc(p.label)}</span>${p.price && !o ? `<span class="small muted">≈ ${esc(priceText(p.price, p.priceCur || cur()))}</span>` : ''}</div>
    <div><p class="cons-title">${esc(wishTitle(p))}</p><p class="small muted" style="margin:2px 0 0">${c ? flagOf(p) : ''}${esc([p.region, p.type, p.grapes].filter(Boolean).join(' · '))}</p></div>
    ${p.why ? `<p class="small" style="margin:0">${esc(p.why)}</p>` : ''}
    ${p.value ? `<p class="small cons-value" style="margin:0">${ICON.cash}<span>${esc(p.value)}</span></p>` : ''}
    <p class="small" style="margin:0"><b>Buy ${p.qty || 1} ${p.qty === 1 ? 'bottle' : 'bottles'}</b>${rw ? ` · replaces <a href="#/wine/${encodeURIComponent(rw.id)}">${esc(wineTitle(rw))} ${esc(rw.vintage)}</a> (${rw.count} left)` : ' · new addition'}</p>
    ${rw && p.replaceWhy ? `<p class="tiny muted" style="margin:-4px 0 0">${esc(p.replaceWhy)}</p>` : ''}
    ${o ? offerLineHtml(o) : ''}
    <div class="cons-actions"><button class="link-btn" data-act="cons-offer" data-i="${i}"${busyO ? ' disabled' : ''}>${ICON.refresh}${busyO ? 'Searching…' : o ? 'Update best offer' : 'Find best offer'}</button>
      <button class="link-btn" data-act="cons-save" data-i="${i}"${saved ? ' disabled' : ''}>${saved ? `${ICON.check}Saved` : `${ICON.plus}Save to wishlist`}</button></div>
  </div>`;
}

function wishCardHtml(x) {
  const busyO = CONS.offerRun.has('wish:' + x.id);
  return `<div class="cons-card">
    <div class="between" style="gap:8px;align-items:flex-start"><span class="cons-label ${LABEL_CLS[x.label] || 'disc'}">${esc(x.label || 'Wishlist')}</span>${x.price ? `<span class="small muted">≈ ${esc(priceText(x.price, x.priceCur))}</span>` : ''}</div>
    <div><p class="cons-title">${esc(wishTitle(x))}</p><p class="small muted" style="margin:2px 0 0">${countryOf(x) ? flagOf(x) : ''}${esc([x.region, x.type].filter(Boolean).join(' · '))}${x.qty ? ` · buy ${x.qty}` : ''}</p></div>
    ${x.why ? `<p class="small" style="margin:0">${esc(x.why)}</p>` : ''}
    ${x.offer ? offerLineHtml(x.offer) : ''}
    <div class="cons-actions"><button class="link-btn" data-act="wish-offer" data-id="${esc(x.id)}"${busyO ? ' disabled' : ''}>${ICON.refresh}${busyO ? 'Searching…' : x.offer ? 'Update best offer' : 'Find best offer'}</button>
      <button class="link-btn" data-act="wish-add" data-id="${esc(x.id)}">${ICON.plus}Add to cellar</button>
      <button class="icon-btn" data-act="wish-del" data-id="${esc(x.id)}" aria-label="Remove from wishlist">${ICON.trash}</button></div>
  </div>`;
}

function viewDiscover() {
  const prof = tasteProfile();
  if (!CONS.budget) CONS.budget = prof.budget;
  const old = S.version && S.version < 12;
  const savedKeys = new Set(S.wishlist.map(wishKey));
  const res = CONS.result;
  const cover = prof.cover.length ? `<div class="cons-cover"><div class="cons-cover-row head"><span>Type</span><span>In stock</span><span>Opened</span><span>Lasts</span></div>
    ${prof.cover.map(c => `<div class="cons-cover-row"><span><span class="sw" style="background:${TYPE_CHART[c.t] || OTHER_C}"></span>${esc(c.t)}</span><span>${c.stock}</span><span>${c.used}</span><span>${c.months === null ? 'n/a' : c.months > 99 ? '99+ mo.' : `${c.months} mo.`}</span></div>`).join('')}</div>` : '';
  return `<main class="screen has-nav discover">
    <div class="detail-top"><a class="back" href="#/insights">${ICON.back}Insights</a></div>
    <header><h1 class="title somm-title"><span class="magic-ic">${ICON.magic}</span>Discover</h1></header>
    ${old ? '<div class="card notice"><b>Script update needed</b><p class="small" style="margin:4px 0 0">The consultant needs the new Code.gs. Replace the script code and create a new version under Manage deployments.</p></div>' : ''}
    <section class="ins-sec" style="border-top:0;padding-top:0"><div class="sec-head"><h2>Your profile</h2></div>
      <p class="small muted" style="margin:0">Calculated in the app from your stock, finished wines, ratings, journal and purchase prices. The consultant bases its suggestions on it.</p>
      <div class="info-list">${prof.lines.map(l => infoRowWide(l[0], l[1])).join('')}</div>
      <p class="small muted" style="margin:6px 0 0">Stock compared with what you drank in the last 12 months</p>${cover}
    </section>
    <section class="ins-sec"><div class="sec-head"><h2>What are you looking for?</h2></div>
      <div class="chips">${CONS_FOCUS.map(f => `<button class="chip${CONS.focus === f ? ' on' : ''}" data-act="cons-focus" data-v="${esc(f)}">${esc(f)}</button>`).join('')}</div>
      <div class="grid2"><label class="field">Budget from (${esc(cur())})<input inputmode="numeric" data-input="cons-min" value="${esc(CONS.budget.min)}"></label><label class="field">to (${esc(cur())})<input inputmode="numeric" data-input="cons-max" value="${esc(CONS.budget.max)}"></label></div>
      <label class="field">Anything else? (optional)<input data-input="cons-note" placeholder="More whites for summer, wines for guests" value="${esc(CONS.note)}"></label>
      <button class="btn primary big block" data-act="cons-run"${CONS.busy || old ? ' disabled' : ''}>${ICON.magic}${CONS.busy ? 'Choosing wines and checking shops…' : res ? 'Get new recommendations' : 'Get recommendations'}</button>
      <p class="tiny muted" style="margin:0">${CONS.busy ? 'This takes about a minute. Every suggestion is checked in online shops in your country, so you only get wines you can buy.' : 'You only get wines that an online shop in your country sells right now, with price and link. One round takes about a minute and costs about 10 to 15 cents. Offers found in the last 7 days are reused.'}</p>
    </section>
    ${CONS.error ? `<p class="small" style="color:var(--danger);margin:0">${esc(CONS.error)}</p>` : ''}
    ${res ? `<section class="ins-sec"><div class="sec-head"><h2>Recommendations</h2></div>${res.summary ? `<p style="margin:0;line-height:1.5">${esc(res.summary)}</p>` : ''}
      <div class="cons-list">${res.picks.map((p, i) => pickCardHtml(p, i, savedKeys.has(wishKey(p)))).join('')}</div></section>` : ''}
    <section class="ins-sec"><div class="sec-head"><h2>Wishlist</h2>${S.wishlist.length ? `<span class="muted small">${S.wishlist.length}</span>` : ''}</div>
      ${S.wishlist.length ? `<div class="cons-list">${S.wishlist.map(wishCardHtml).join('')}</div>` : '<p class="small muted" style="margin:0">Save suggestions here. When you buy one, Add to cellar opens the form with its details.</p>'}
    </section>
  </main>${nav('insights')}`;
}
const infoRowWide = (label, value) => `<div class="info-row wide"><span class="info-label">${esc(label)}</span><span class="info-val">${esc(value)}</span></div>`;

async function consRun() {
  if (CONS.busy) return;
  const prof = tasteProfile();
  CONS.busy = true; CONS.error = '';
  render();
  const avoid = S.wishlist.map(wishTitle).concat(CONS.result ? CONS.result.picks.map(wishTitle) : []);
  try {
    const r = await api('consultant', { profile: prof.text, focus: CONS.focus, budget: { min: Number(CONS.budget.min) || 0, max: Number(CONS.budget.max) || 0 }, note: CONS.note, avoid });
    CONS.result = { summary: str(r.summary), picks: (r.picks || []).map(p => Object.assign({}, p, { vintage: str(p.vintage) })) };
    CONS.offers = {};
    CONS.result.picks.forEach(p => { if (p.offer && p.offer.shop) CONS.offers[wishKey(p)] = p.offer; });
    saveConsult();
  } catch (e) {
    CONS.error = /Unknown action/i.test(e.message) ? 'The consultant needs the new Code.gs. Update the script, then try again.' : aiErr(e.message);
  }
  CONS.busy = false;
  render();
  const h = [...document.querySelectorAll('.discover h2')].find(x => x.textContent === 'Recommendations');
  if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function consOffer(p, key, wishId) {
  if (CONS.offerRun.has(key)) return;
  CONS.offerRun.add(key);
  refreshView();
  try {
    const had = wishId ? !!(S.wishlist.find(w => w.id === wishId) || {}).offer : !!CONS.offers[wishKey(p)];
    const o = await api('offerFor', { wine: wishTitle(p), region: p.region, wishId: wishId || '', fresh: had });
    if (wishId) { const x = S.wishlist.find(w => w.id === wishId); if (x) x.offer = o; persist(); }
    else { CONS.offers[wishKey(p)] = o; saveConsult(); }
  } catch (e) {
    toast(aiErr(e.message), 5000);
  }
  CONS.offerRun.delete(key);
  refreshView();
}

async function consSave(p) {
  const x = normWish(Object.assign({}, p, { id: newId('x'), offer: CONS.offers[wishKey(p)] || null, createdAt: new Date().toISOString() }));
  S.wishlist.push(x);
  persist();
  refreshView();
  try {
    await api('saveWish', { wish: Object.assign({}, x, { offer: x.offer ? JSON.stringify(x.offer) : '' }) });
    toast('Saved to your wishlist');
  } catch (e) {
    S.wishlist = S.wishlist.filter(w => w.id !== x.id);
    persist();
    refreshView();
    toast('Not saved: ' + e.message);
  }
}

async function wishDelete(id) {
  const prev = S.wishlist;
  S.wishlist = S.wishlist.filter(w => w.id !== id);
  persist();
  refreshView();
  try { await api('deleteWish', { id }); } catch (e) { S.wishlist = prev; persist(); refreshView(); toast('Not deleted: ' + e.message); }
}

/* opens the add form with the details of a wishlist wine; the AI fills in the rest */
function wishToCellar(id) {
  const x = S.wishlist.find(w => w.id === id);
  if (!x) return;
  D = newDraft('add', null);
  D.step = 'form';
  D.fromWish = x.id;
  const set = (k, v) => { if (str(v)) { D.fields[k] = str(v); D.touched.add(k); } };
  set('producer', x.producer); set('name', x.name); set('vintage', x.vintage); set('region', x.region); set('grapes', x.grapes);
  if (TYPES.includes(x.type)) { D.fields.type = x.type; D.touched.add('type'); }
  if (x.offer) { D.fields.price = priceInput(x.offer.v, x.offer.cur); D.acq.website = ''; }
  if (x.qty) D.stock[0].n = x.qty;
  go('#/add');
  setTimeout(() => { if (D && D.fromWish === x.id) runAnalysis(); }, 50);
}
