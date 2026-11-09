'use strict';

/* Vintary: recommend a wine by link. The link carries the wine and your name, nothing is stored anywhere else.
   Opened with Vintary, it offers to save the wine to the wishlist with who recommended it. */

/* your name for recommendations: kept with your settings, on an old Code.gs on this device */
const recMyName = () => str((S.settings && S.settings.name) || store.get('wc-myname', '')).trim();
async function recSetMyName(v) {
  const name = str(v).replace(/\s+/g, ' ').trim().slice(0, 40);
  if (name === recMyName()) return;
  S.settings = Object.assign({}, S.settings, { name });
  store.set('wc-myname', name);
  persist();
  if (S.version && S.version < 54) return;
  try { await api('setSettings', { settings: { name } }); } catch (e) { toast('Your name is kept on this device only: ' + e.message); }
}

const b64uEnc = s => { let bin = ''; new TextEncoder().encode(s).forEach(x => { bin += String.fromCharCode(x); }); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const b64uDec = s => { const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); };

/* the link: the address of the app with the wine in it */
function recLink(w) {
  const d = { v: 1, p: w.producer, n: w.name, y: w.vintage, t: w.type, r: w.region, g: w.grapes, s: Number(w.size) && Number(w.size) !== 75 ? Number(w.size) : '', f: recMyName(), m: w.myRating, h: w.myFav ? 1 : '' };
  Object.keys(d).forEach(k => { if (d[k] === '' || d[k] === null || d[k] === undefined) delete d[k]; });
  return `${location.origin}${location.pathname}#/rec/${b64uEnc(JSON.stringify(d))}`;
}
function recParse(code) {
  try {
    const d = JSON.parse(b64uDec(code));
    if (!d || (!d.n && !d.p)) return null;
    const t = (v, n = 120) => str(v).replace(/\s+/g, ' ').trim().slice(0, n);
    return { producer: t(d.p), name: t(d.n), vintage: t(d.y, 8), type: TYPES.includes(d.t) ? d.t : '', region: t(d.r), grapes: t(d.g), size: Number(d.s) > 0 ? Number(d.s) : 75,
      from: t(d.f, 40), rating: Number(d.m) >= 0 && Number(d.m) <= 100 && d.m !== undefined ? Math.round(Number(d.m)) : null, fav: !!d.h };
  } catch (e) { return null; }
}
const recSaidHtml = d => `<p class="rin-said">${d.fav ? `<span class="rin-heart">${ICON.heart}</span>` : ''}<span>${esc(d.from || 'Your friend')} rated it <b>${d.rating}%</b>${d.fav ? ', one of the favorites' : ''}</span></p>`;
const recWineName = d => [d.producer, d.name, d.vintage].filter(Boolean).join(' ');
const recKey = (p, n, v, s) => [lc(str(p + ' ' + n)).replace(/[^a-z0-9à-ÿ]+/g, ' ').trim(), str(v), Number(s) || 75].join('|');

/* the sender among your people: by name or a name they are also called, else by the first name if only one person has it */
function recPerson(from) {
  const f = lc(str(from).trim());
  if (!f) return '';
  const hit = S.people.find(n => personNames(n).includes(f));
  if (hit) return hit;
  const first = f.split(' ')[0], same = S.people.filter(n => lc(n).split(' ')[0] === first || personNames(n).includes(first));
  return same.length === 1 ? same[0] : from;
}

/* opened from a link: the sheet over Home */
function recOpen(code) {
  const d = recParse(code);
  go('#/home', true);
  if (!d) { setTimeout(() => toast('This link is not a recommendation Vintary can read.'), 300); return; }
  setTimeout(() => { RS = { kind: 'recin', d, rec: recNew(recPerson(d.from)) }; renderSheet(); }, 120);
}
function recInSheetHtml() {
  const d = RS.d, from = d.from || 'A friend';
  const mine = S.wines.find(w => recKey(w.producer, w.name, w.vintage, w.size) === recKey(d.producer, d.name, d.vintage, d.size));
  const wished = S.wishlist.find(x => wishKey(x) === wishKey(d) && str(x.vintage) === d.vintage);
  const info = [d.region, d.type, d.grapes].filter(Boolean).join(' · ');
  const said = d.rating !== null ? recSaidHtml(d) : '';
  const status = mine ? `<p class="small" style="margin:0">${mine.count ? `In your cellar: ${mine.count} ${mine.count === 1 ? 'bottle' : 'bottles'}.` : 'You had this wine before.'} <a href="#/wine/${encodeURIComponent(mine.id)}" data-act="sheet-close-go" data-href="#/wine/${encodeURIComponent(mine.id)}">Open the wine ›</a></p>`
    : wished ? '<p class="small" style="margin:0">It is on your wishlist already. Saving adds who recommended it.</p>' : '';
  return `<div class="sheet-backdrop" data-act="sheet-close"></div><div class="sheet rin-sheet" role="dialog" aria-modal="true" aria-label="Recommended wine"><div class="grab"></div>
    <div class="between"><h2 style="font-size:18px;font-weight:600">${esc(from)} recommends</h2><button class="icon-btn" data-act="sheet-close" aria-label="Close">${ICON.x}</button></div>
    <div class="rin-wine"><b>${esc([d.name || d.producer, d.vintage].filter(Boolean).join(' '))}</b><span>${esc([d.name ? d.producer : '', d.size !== 75 ? clText(d.size) : ''].filter(Boolean).join(' · '))}</span>${info ? `<span>${esc(info)}</span>` : ''}</div>
    ${said}${status}
    ${mine ? '' : `<div class="cons-actions rin-more"><button class="link-btn" data-act="rin-more">${ICON.magic}More about this wine</button></div>`}
    ${recFieldHtml(RS.rec)}
    <div class="grid2"><button class="btn" data-act="sheet-close">Not now</button><button class="btn primary" data-act="rin-save">Save to wishlist</button></div></div>`;
}
/* the recommended wine for More about this wine: the same view as for Will I like it?, loaded only when you tap it */
const recBase = d => ({ producer: d.producer, name: d.name, vintage: d.vintage, type: d.type, region: d.region, grapes: d.grapes });
async function recInSave() {
  const d = RS.d, names = recNames(RS);
  closeSheet();
  const old = S.wishlist.find(x => wishKey(x) === wishKey(d) && str(x.vintage) === d.vintage);
  if (old) {
    const prev = old.recBy, all = namesOf(prev);
    namesOf(names).forEach(n => { if (!all.some(a => lc(a) === lc(n))) all.push(n); });
    old.recBy = all.join(', ');
    persist();
    try { await api('saveWish', { wish: { id: old.id, recBy: old.recBy } }); toast('Already on your wishlist, now with who recommended it.'); goSection('wishlist'); }
    catch (e) { old.recBy = prev; persist(); toast('Not saved: ' + e.message); }
    return;
  }
  const why = d.rating !== null ? `${d.from || 'Your friend'} rated it ${d.rating}%${d.fav ? ', one of the favorites' : ''}.` : '';
  // what was loaded with More about this wine goes along, so the AI is not asked again
  const x = normWish({ id: newId('x'), producer: d.producer, name: d.name, vintage: d.vintage, type: d.type, region: d.region, grapes: d.grapes, label: 'Recommended', why, recBy: names, createdAt: new Date().toISOString(), details: previewOf(recBase(d)) });
  S.wishlist.push(x);
  persist();
  try {
    await api('saveWish', { wish: Object.assign({}, x, { offer: '', details: x.details ? JSON.stringify(x.details) : '' }) });
    toast('Saved to your wishlist.');
    goSection('wishlist');
  } catch (e) {
    S.wishlist = S.wishlist.filter(w => w.id !== x.id);
    persist();
    toast('Not saved: ' + e.message);
  }
}

/* on an iPhone a link opens Safari, not the app: copy it there and paste it here */
async function recPaste() {
  let t = '';
  try { t = await navigator.clipboard.readText(); } catch (e) { t = ''; }
  const m = /#\/rec\/([A-Za-z0-9_-]+)/.exec(t || '');
  if (m) recOpen(m[1]); else toast('Copy the link of a recommendation first, then tap here again.', 5000);
}

/* the link opened without a Vintary connection: the wine and "Coming soon", nothing about installing */
function viewRecPublic(code) {
  const d = recParse(code);
  const hero = '<div class="brand-hero"><img src="icon-192.png" alt="" width="72" height="72"><b>Vintary</b><em>Coming soon</em></div>';
  if (!d) return `<main class="screen rec-public">${hero}</main>`;
  const info = [d.region, d.type, d.grapes].filter(Boolean).join(' · ');
  return `<main class="screen rec-public">${hero}
    <section class="rin-card">
      <span class="gd-sub">${esc(d.from || 'A friend')} recommends</span>
      <h1 class="title" style="font-size:26px">${esc([d.name || d.producer, d.vintage].filter(Boolean).join(' '))}</h1>
      ${d.name && d.producer ? `<p style="margin:0">${esc(d.producer)}</p>` : ''}
      ${info ? `<p class="muted small" style="margin:0">${esc(info)}</p>` : ''}
      ${d.rating !== null ? `${recSaidHtml(d)}${segsHtml(d.rating)}` : ''}
    </section>
  </main>`;
}
/* on that page the browser does not offer to install the app */
window.addEventListener('beforeinstallprompt', e => { if (!CFG && route().p === 'rec') e.preventDefault(); });

const RECS_ACTS = {
  'rin-save': () => recInSave(),
  'rin-more': () => { if (RS && RS.kind === 'recin') openPreview(recBase(RS.d), '', null); },
  'rec-paste': () => recPaste(),
  'sheet-close-go': el => { closeSheet(); go(el.dataset.href); }
};
const RECS_INPUTS = { 'share-name': el => { SHARE.name = el.value; } };
const RECS_CHANGES = { 'my-name': el => { recSetMyName(el.value); toast(str(el.value).trim() ? 'Saved. Friends see this name on wines you share.' : 'Name removed.'); } };
