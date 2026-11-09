'use strict';

/* Vintary: QR labels for storage places. Scanning a label with the phone camera opens Vintary at that place.
   The labels are made on the phone as a PDF in the exact size of common label sheets, or as pictures for a label printer. */

/* sheets in millimetres: label size, columns and rows, margins and the step from one label to the next */
const LB_SHEETS = {
  L7160: { name: 'A4 · Avery L7160', sub: '21 labels, 63.5 × 38.1 mm', pw: 210, ph: 297, w: 63.5, h: 38.1, cols: 3, rows: 7, left: 7.21, top: 15.15, dx: 66.04, dy: 38.1 },
  US5160: { name: 'US Letter · Avery 5160', sub: '30 labels, 2⅝ × 1 inch', pw: 215.9, ph: 279.4, w: 66.675, h: 25.4, cols: 3, rows: 10, left: 4.7625, top: 12.7, dx: 69.85, dy: 25.4 }
};
const LB = { sel: null, sheet: null, start: 0, busy: false };

const lbSheet = () => LB_SHEETS[LB.sheet] || LB_SHEETS[store.get('wc-lb-sheet', '') || (['US', 'CA'].includes(shopCountry()) ? 'US5160' : 'L7160')] || LB_SHEETS.L7160;
const lbSheetKey = () => Object.keys(LB_SHEETS).find(k => LB_SHEETS[k] === lbSheet());
const lbUrl = loc => `${location.origin}${location.pathname}#/place/${encodeURIComponent(loc)}`;
const lbSub = loc => {
  const ty = locTypeOf(loc), info = locInfoOf(loc), n = Object.keys((S.shelfNames || {})[lc(loc)] || {}).length;
  return [ty && lc(LOC_TYPE_NAME[ty]) !== lc(loc) ? LOC_TYPE_NAME[ty] : '', info.capacity ? `${info.capacity} bottles` : n ? `${n} shelves` : ''].filter(Boolean).join(' · ');
};
const lbChosen = () => S.locations.filter(l => (LB.sel || new Set(S.locations.map(lc))).has(lc(l)));

/* opened from a label: the place in the cellar, open and in view */
function openPlace(name) {
  const loc = S.locations.find(l => lc(l) === lc(str(name))) || str(name);
  CVIEW = 'places';
  FOLD.delete(lc(loc));
  U.search = ''; U.onlyDue = false;
  U.jumpTo = 'pl-' + lc(loc).replace(/[^a-z0-9]+/g, '-');
  go('#/cellar', true);
}

function viewLabels() {
  if (!LB.sel) LB.sel = new Set(S.locations.map(lc));
  const sh = lbSheet(), key = lbSheetKey(), chosen = lbChosen(), per = sh.cols * sh.rows;
  if (LB.start >= per) LB.start = 0;
  const cells = Array.from({ length: per }, (_, i) => {
    const k = i - LB.start, on = k >= 0 && k < chosen.length;
    return `<button class="lb-cell${on ? ' on' : ''}${i < LB.start ? ' used' : ''}" data-act="lb-start" data-v="${i}" aria-label="Start at label ${i + 1}">${on ? esc(chosen[k].slice(0, 10)) : ''}</button>`;
  }).join('');
  const pages = Math.ceil((LB.start + chosen.length) / per);
  return `<main class="screen has-nav lb-screen">
    ${backLinkHtml('#/cellar', 'Cellar')}
    <h1 class="title" style="margin:0">QR labels</h1>
    <p class="gd-text">Stick a label on each place. Scanning it with the phone camera opens Vintary right at that place.</p>
    <h3 class="gd-h">Places</h3>
    ${S.locations.length ? `<div class="im-cols">${S.locations.map(l => `<button class="chip${LB.sel.has(lc(l)) ? ' on' : ''}" data-act="lb-loc" data-v="${esc(l)}">${esc(l)}</button>`).join('')}</div>` : '<p class="muted small" style="margin:0">No places yet. Add one in Settings first.</p>'}
    <h3 class="gd-h">Label sheet</h3>
    <div class="lb-sheets">${Object.entries(LB_SHEETS).map(([k, s]) => `<button class="gd-type${k === key ? ' on' : ''}" data-act="lb-sheet" data-v="${k}" aria-pressed="${k === key}"><span><b>${esc(s.name)}</b><small>${esc(s.sub)}</small></span></button>`).join('')}</div>
    <p class="muted tiny" style="margin:0">Labels of Herma, Zweckform and other brands name the matching Avery number on the pack.</p>
    <h3 class="gd-h">Start at</h3>
    <p class="muted tiny" style="margin:-4px 0 0">Using a sheet that is partly used? Tap the first free label.</p>
    <div class="lb-grid" style="--c:${sh.cols};--ar:${(sh.w / sh.h).toFixed(3)}">${cells}</div>
    ${pages > 1 ? `<p class="muted tiny" style="margin:0">${pages} sheets</p>` : ''}
    <div class="lb-hint"><b>Before you print</b>
      <p>In the print menu of your phone, set the size to <b>100 %</b> or <b>Actual size</b>, not Fit to page. Otherwise the labels do not match the sheet.</p>
      <p>In a cellar, film labels last longer than paper. They do not curl in damp air.</p></div>
    <button class="btn primary big block" data-act="lb-pdf"${chosen.length && !LB.busy ? '' : ' disabled'}>${ICON.qr}${LB.busy ? 'Preparing…' : `Print ${chosen.length} ${chosen.length === 1 ? 'label' : 'labels'}`}</button>
    <button class="btn block" data-act="lb-img"${chosen.length && !LB.busy ? '' : ' disabled'}>Pictures for a label printer</button>
  </main>${nav(null)}`;
}

/* ------------------------------------------------------------ QR code */

let qrLoading = null;
function qrLoad() {
  if (typeof qrcode === 'function') return Promise.resolve();
  if (!qrLoading) qrLoading = loadScript('qrcode.js', 15000).catch(e => { qrLoading = null; throw e; });
  return qrLoading;
}
/* the dark squares of a QR code, with the quiet zone of 4 modules around it */
function qrMatrix(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount(), m = [];
  for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(q.isDark(r, c)); m.push(row); }
  return { n, m, size: n + 8 };
}

/* ------------------------------------------------------------ PDF */

const MM = 72 / 25.4;
/* text for the built-in PDF fonts: Latin letters as they are, everything else as a question mark */
const pdfText = s => {
  let o = '';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    const b = c === 0x2026 ? 0x85 : c === 0x2019 ? 0x92 : c === 0x2013 ? 0x96 : c === 0x20ac ? 0x80 : c < 256 ? c : 63;
    o += b === 0x28 || b === 0x29 || b === 0x5c ? '\\' + String.fromCharCode(b) : String.fromCharCode(b);
  }
  return `(${o})`;
};
const pdfBytes = s => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
const n2 = v => (Math.round(v * 100) / 100).toString();

/* a text measured with the same kind of font, cut to fit, in up to two lines */
let lbCtx = null;
function lbFit(text, pt, bold, maxMm, lines) {
  if (!lbCtx) lbCtx = document.createElement('canvas').getContext('2d');
  lbCtx.font = `${bold ? 'bold ' : ''}${pt}px Helvetica, Arial, sans-serif`;
  const fits = t => lbCtx.measureText(t).width <= maxMm * MM;
  const words = String(text).split(/\s+/).filter(Boolean), out = [];
  let cur = '';
  while (words.length) {
    const w = words.shift(), t = cur ? cur + ' ' + w : w;
    if (fits(t)) { cur = t; continue; }
    if (cur) { out.push(cur); cur = ''; words.unshift(w); } else { let x = w; while (x.length > 1 && !fits(x + '…')) x = x.slice(0, -1); out.push(x + (x === w ? '' : '…')); }
    if (out.length === lines) { if (cur || words.length) { let x = out[lines - 1]; while (x.length > 1 && !fits(x + '…')) x = x.slice(0, -1); out[lines - 1] = x.replace(/…$/, '') + '…'; } return out; }
  }
  if (cur) out.push(cur);
  return out.slice(0, lines);
}

/* the drawing commands of one label, at x/y of its lower left corner in points */
function lbLabelOps(loc, x, y, sh, logo) {
  const pad = 2.6, h = sh.h, qrMm = Math.min(h - 2 * pad, 27), q = qrMatrix(lbUrl(loc)), mod = qrMm * MM / q.size;
  const ox = x + pad * MM, oy = y + (h * MM - qrMm * MM) / 2;
  let ops = '0 0 0 rg\n';
  q.m.forEach((row, r) => {
    let c = 0;
    while (c < q.n) {
      if (!row[c]) { c++; continue; }
      let e = c; while (e < q.n && row[e]) e++;
      ops += `${n2(ox + (c + 4) * mod)} ${n2(oy + qrMm * MM - (r + 5) * mod)} ${n2((e - c) * mod)} ${n2(mod)} re\n`;
      c = e;
    }
  });
  ops += 'f\n';
  const tx = x + (pad + qrMm + 1.6) * MM, tw = sh.w - pad - qrMm - 1.6 - pad - 0.8;
  const big = h > 30 ? 12 : 10.5, small = h > 30 ? 7.5 : 6.5;
  const name = lbFit(loc, big, true, tw, 2), sub = lbSub(loc);
  let ty = y + h * MM - (h > 30 ? 6.2 : 4.6) * MM;
  ops += 'BT\n0.1 0.05 0.07 rg\n';
  name.forEach(l => { ops += `/F2 ${big} Tf 1 0 0 1 ${n2(tx)} ${n2(ty)} Tm ${pdfText(l)} Tj\n`; ty -= big * 1.15; });
  if (sub) { const s = lbFit(sub, small, false, tw, 1)[0]; ops += `0.35 0.3 0.32 rg /F1 ${small} Tf 1 0 0 1 ${n2(tx)} ${n2(ty - 1)} Tm ${pdfText(s)} Tj\n`; }
  ops += 'ET\n';
  // the app icon and the name in the lower right corner
  const lg = (h > 30 ? 5.4 : 4.2) * MM, lx = tx, ly = y + pad * MM;
  if (logo) ops += `q ${n2(lg)} 0 0 ${n2(lg)} ${n2(lx)} ${n2(ly)} cm /Im1 Do Q\n`;
  ops += `BT 0.39 0 0.09 rg /F2 ${h > 30 ? 8 : 7} Tf ${n2(lx + lg + 1.2 * MM)} ${n2(ly + lg * 0.28)} Td ${pdfText('Vintary')} Tj ET\n`;
  return ops;
}

/* the app icon as a small JPEG for the PDF */
async function lbLogo() {
  try {
    const img = new Image();
    img.src = 'icon-192.png';
    await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 96, 96); g.drawImage(img, 0, 0, 96, 96);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    return new Uint8Array(await b.arrayBuffer());
  } catch (e) { return null; }
}

async function lbPdf(locs) {
  const sh = lbSheet(), per = sh.cols * sh.rows, logo = await lbLogo();
  const slots = [];
  locs.forEach((l, i) => slots.push({ l, k: LB.start + i }));
  const pages = Math.ceil((LB.start + locs.length) / per);
  const objs = [];  // each object: a string or an array of strings and byte arrays
  const add = o => { objs.push(o); return objs.length; };
  const catalog = add(null), pagesId = add(null), f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const im = logo ? add([`<< /Type /XObject /Subtype /Image /Width 96 /Height 96 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n`, logo, '\nendstream']) : 0;
  const kids = [];
  for (let p = 0; p < pages; p++) {
    let ops = '';
    slots.filter(s => Math.floor(s.k / per) === p).forEach(s => {
      const i = s.k % per, col = i % sh.cols, row = Math.floor(i / sh.cols);
      const x = (sh.left + col * sh.dx) * MM, y = (sh.ph - sh.top - row * sh.dy - sh.h) * MM;
      ops += lbLabelOps(s.l, x, y, sh, !!logo);
    });
    const content = add([`<< /Length ${ops.length} >>\nstream\n`, ops, '\nendstream']);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${n2(sh.pw * MM)} ${n2(sh.ph * MM)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${im ? ` /XObject << /Im1 ${im} 0 R >>` : ''} >> /Contents ${content} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R /ViewerPreferences << /PrintScaling /None >> >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const parts = [pdfBytes('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')];
  let len = parts[0].length;
  const offs = [];
  objs.forEach((o, i) => {
    offs.push(len);
    const chunks = [`${i + 1} 0 obj\n`].concat(Array.isArray(o) ? o : [o], ['\nendobj\n']);
    chunks.forEach(c => { const b = typeof c === 'string' ? pdfBytes(c) : c; parts.push(b); len += b.length; });
  });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${len}\n%%EOF\n`;
  parts.push(pdfBytes(xref));
  return new Blob(parts, { type: 'application/pdf' });
}

/* one picture per place for a label printer, in the proportions of the chosen label */
async function lbImages(locs) {
  const sh = lbSheet(), px = 12, W = Math.round(sh.w * px), H = Math.round(sh.h * px);
  let logo = null;
  try { logo = new Image(); logo.src = 'icon-192.png'; await logo.decode(); } catch (e) { logo = null; }
  const files = [];
  for (const loc of locs) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const pad = 2.6 * px, qrPx = Math.min(H - 2 * pad, 27 * px), q = qrMatrix(lbUrl(loc)), mod = qrPx / q.size, oy = (H - qrPx) / 2;
    g.fillStyle = '#000';
    q.m.forEach((row, r) => row.forEach((d, k) => { if (d) g.fillRect(Math.floor(pad + (k + 4) * mod), Math.floor(oy + (r + 4) * mod), Math.ceil(mod), Math.ceil(mod)); }));
    const tx = pad + qrPx + 1.6 * px, tw = W - tx - pad;
    const big = Math.round((sh.h > 30 ? 12 : 10.5) * px / MM), small = Math.round((sh.h > 30 ? 7.5 : 6.5) * px / MM);
    g.fillStyle = '#1A0C12'; g.font = `bold ${big}px Helvetica, Arial, sans-serif`; g.textBaseline = 'top';
    let ty = (sh.h > 30 ? 3.4 : 2.4) * px;
    lbFit(loc, sh.h > 30 ? 12 : 10.5, true, tw / px, 2).forEach(l => { g.fillText(l, tx, ty); ty += big * 1.15; });
    const sub = lbSub(loc);
    if (sub) { g.fillStyle = '#58494F'; g.font = `${small}px Helvetica, Arial, sans-serif`; g.fillText(lbFit(sub, sh.h > 30 ? 7.5 : 6.5, false, tw / px, 1)[0], tx, ty + 2); }
    const lg = (sh.h > 30 ? 5.4 : 4.2) * px, ly = H - pad - lg;
    if (logo) g.drawImage(logo, tx, ly, lg, lg);
    g.fillStyle = '#640018'; g.font = `bold ${Math.round(lg * 0.5)}px Helvetica, Arial, sans-serif`; g.textBaseline = 'middle'; g.fillText('Vintary', tx + lg + 1.2 * px, ly + lg / 2);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    files.push(new File([blob], `vintary-label-${lc(loc).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'place'}.png`, { type: 'image/png' }));
  }
  return files;
}

/* the share menu of the phone, or a download where there is none */
async function lbShare(files, title) {
  if (navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ files, title }); } catch (e) { if (e && e.name !== 'AbortError') toast('Sharing did not work.'); }
    return;
  }
  files.forEach((f, i) => setTimeout(() => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f); a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, i * 400));
  toast(files.length === 1 ? 'The file is saved in your downloads. Open it there to print.' : 'The pictures are saved in your downloads.', 5000);
}

async function lbMake(kind) {
  const locs = lbChosen();
  if (!locs.length || LB.busy) return;
  LB.busy = true; render();
  try {
    await qrLoad();
    if (kind === 'pdf') {
      const blob = await lbPdf(locs);
      await lbShare([new File([blob], `vintary-qr-labels-${lbSheetKey()}.pdf`, { type: 'application/pdf' })], 'Vintary QR labels');
    } else await lbShare(await lbImages(locs), 'Vintary QR labels');
  } catch (e) {
    toast(/load failed|timeout/.test(e.message) ? 'The QR code maker could not be loaded. Check your connection and try again.' : 'The labels could not be made.');
  }
  LB.busy = false;
  if (route().p === 'labels') render();
}

const LB_ACTS = {
  'lb-open': el => { const v = el.dataset.v; LB.sel = new Set(v ? [lc(v)] : S.locations.map(lc)); LB.start = 0; go('#/labels'); },
  'lb-loc': el => { const k = lc(el.dataset.v); if (LB.sel.has(k)) LB.sel.delete(k); else LB.sel.add(k); render(); },
  'lb-sheet': el => { LB.sheet = el.dataset.v; store.set('wc-lb-sheet', el.dataset.v); LB.start = 0; render(); },
  'lb-start': el => { LB.start = Number(el.dataset.v) || 0; render(); },
  'lb-pdf': () => lbMake('pdf'),
  'lb-img': () => lbMake('img')
};
