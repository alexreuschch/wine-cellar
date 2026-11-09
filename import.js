'use strict';

/* Vintary: import a cellar from another app. The file is read on the phone, the AI only sees the column names and the first rows
   and suggests how they fit. The owner checks the mapping, the places and a preview, then every row is converted here by fixed rules. */

/* ------------------------------------------------------------ reading files: CSV, TSV, TXT, XML, XLSX and ZIP */

const IM_EXT = /\.(csv|tsv|txt|xml|xlsx)$/i;

/* text in UTF-8, or in the older Windows encoding that many exports still use */
function imDecode(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b).replace(/^﻿/, ''); } catch (e) { return new TextDecoder('windows-1252').decode(b); }
}

/* a table separated by commas, semicolons, tabs or bars, with quotes as in RFC 4180 */
function imParseDelimited(text) {
  let t = String(text || '').replace(/^﻿/, '');
  let sep = null;
  const sepLine = /^sep=(.)\r?\n/i.exec(t);
  if (sepLine) { sep = sepLine[1]; t = t.slice(sepLine[0].length); }
  if (!sep) {
    const first = t.split(/\r?\n/).find(l => l.trim()) || '';
    let inQ = false; const n = { ',': 0, ';': 0, '\t': 0, '|': 0 };
    for (const ch of first) { if (ch === '"') inQ = !inQ; else if (!inQ && ch in n) n[ch]++; }
    sep = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    if (!n[sep]) sep = ',';
  }
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch;
    } else if (ch === '"' && f === '') q = true;
    else if (ch === sep) { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}

/* the files inside a ZIP, unpacked by the browser itself */
async function imUnzip(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let eo = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
  if (eo < 0) throw new Error('This ZIP file could not be opened.');
  const count = dv.getUint16(eo + 10, true);
  let p = dv.getUint32(eo + 16, true);
  const out = [];
  for (let k = 0; k < count && dv.getUint32(p, true) === 0x02014b50; k++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    out.push({
      name, size,
      data: async () => {
        const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
        const raw = u8.slice(start, start + csize);
        if (method === 0) return raw;
        if (method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('This ZIP file uses a packing this phone cannot open.');
        return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      }
    });
  }
  return out;
}

const imXml = text => {
  const d = new DOMParser().parseFromString(text, 'application/xml');
  if (d.getElementsByTagName('parsererror').length) throw new Error('This XML file could not be read.');
  return d;
};
const imTags = (node, tag) => Array.from(node.getElementsByTagName(tag));

/* the first sheet of an Excel file, dates as YYYY-MM-DD */
async function imReadXlsx(files) {
  const by = {};
  files.forEach(f => { by[f.name.replace(/^\/+/, '')] = f; });
  const text = async n => (by[n] ? imDecode(await by[n].data()) : '');
  let sheetPath = 'xl/worksheets/sheet1.xml';
  try {
    const wb = imXml(await text('xl/workbook.xml')), first = imTags(wb, 'sheet')[0];
    const rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    const rels = imXml(await text('xl/_rels/workbook.xml.rels'));
    const rel = imTags(rels, 'Relationship').find(r => r.getAttribute('Id') === rid);
    if (rel) { const tg = rel.getAttribute('Target').replace(/^\/+/, ''); sheetPath = tg.startsWith('xl/') ? tg : 'xl/' + tg; }
  } catch (e) { /* the first sheet by its usual name */ }
  if (!by[sheetPath]) throw new Error('No table found in this Excel file.');
  const shared = by['xl/sharedStrings.xml'] ? imTags(imXml(await text('xl/sharedStrings.xml')), 'si').map(si => imTags(si, 't').map(t => t.textContent).join('')) : [];
  // which cell styles are dates
  const dateStyle = [];
  if (by['xl/styles.xml']) {
    const st = imXml(await text('xl/styles.xml')), custom = {};
    imTags(st, 'numFmt').forEach(n => { custom[n.getAttribute('numFmtId')] = n.getAttribute('formatCode') || ''; });
    const xfs = imTags(st, 'cellXfs')[0];
    if (xfs) Array.from(xfs.children).forEach((xf, i) => {
      const id = Number(xf.getAttribute('numFmtId') || 0);
      const code = String(custom[id] || '').replace(/"[^"]*"|\[[^\]]*\]/g, '');
      dateStyle[i] = (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (!!custom[id] && /[dy]/i.test(code));
    });
  }
  const colIdx = ref => { const m = /^([A-Z]+)/.exec(ref || ''); let n = 0; if (!m) return -1; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const rows = [];
  imTags(imXml(await text(sheetPath)), 'row').forEach(r => {
    const row = [];
    Array.from(r.children).filter(c => c.tagName === 'c').forEach((c, k) => {
      const i = c.getAttribute('r') ? colIdx(c.getAttribute('r')) : k, t = c.getAttribute('t');
      const v = (imTags(c, 'v')[0] || {}).textContent;
      let val = '';
      if (t === 's') val = shared[Number(v)] || '';
      else if (t === 'inlineStr') val = imTags(c, 't').map(x => x.textContent).join('');
      else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
      else if (v !== undefined && v !== null) {
        val = String(v);
        if (t !== 'str' && t !== 'e' && dateStyle[Number(c.getAttribute('s') || 0)] && !isNaN(Number(v))) val = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(v) * 86400000)).toISOString().slice(0, 10);
        else if (/^-?\d+\.\d{9,}$/.test(val)) val = String(Number(Number(val).toPrecision(12)));
      }
      while (row.length < i) row.push('');
      row[i] = val;
    });
    rows.push(row);
  });
  return rows;
}

/* an XML export: the element that repeats most often is a row, its child elements are the columns */
function imReadXmlTable(text) {
  const d = imXml(text);
  let best = null;
  const walk = el => {
    const groups = {};
    Array.from(el.children).forEach(c => { if (c.children.length) (groups[c.tagName] = groups[c.tagName] || []).push(c); });
    Object.values(groups).forEach(g => { if (!best || g.length > best.length) best = g; });
    Array.from(el.children).forEach(walk);
  };
  walk(d.documentElement);
  if (!best || !best.length) throw new Error('No table found in this XML file.');
  const cols = [];
  best.forEach(r => Array.from(r.children).forEach(c => { if (!cols.includes(c.tagName)) cols.push(c.tagName); }));
  return [cols].concat(best.map(r => cols.map(c => { const x = Array.from(r.children).find(k => k.tagName === c); return x ? x.textContent.trim() : ''; })));
}

/* header and rows: empty rows are dropped, empty or repeated column names get a number */
function imTable(rows) {
  const clean = rows.map(r => r.map(v => str(v).trim())).filter(r => r.some(v => v !== ''));
  if (clean.length < 2) throw new Error('The file has no wines in it.');
  const head = clean[0];
  let width = Math.max(...clean.map(r => r.length));
  while (width > 0 && clean.every(r => !r[width - 1])) width--;
  const seen = {};
  const headers = Array.from({ length: width }, (_, i) => {
    let h = head[i] || `Column ${i + 1}`;
    if (seen[lc(h)]) h = `${h} ${++seen[lc(h)]}`; else seen[lc(h)] = 1;
    return h;
  });
  return { headers, rows: clean.slice(1).map(r => headers.map((_, i) => r[i] || '')) };
}

/* reads any supported file into { name, headers, rows } */
async function imReadFile(file) {
  let name = file.name || 'export';
  let buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  const isZip = u8[0] === 0x50 && u8[1] === 0x4b;
  let rows;
  if (isZip) {
    const files = await imUnzip(buf);
    if (files.some(f => /^xl\/workbook\.xml$/.test(f.name.replace(/^\/+/, '')))) rows = await imReadXlsx(files);
    else {
      const cands = files.filter(f => IM_EXT.test(f.name) && !/__MACOSX|\/\./.test(f.name) && f.size > 0);
      if (!cands.length) throw new Error('No table found in this ZIP file. Choose the CSV or Excel file of your export.');
      const pick = cands.find(f => /(^|\/)cellar[^/]*\.csv$/i.test(f.name)) || cands.slice().sort((a, b) => b.size - a.size)[0];
      name = pick.name.split('/').pop();
      if (/\.xlsx$/i.test(pick.name)) rows = await imReadXlsx(await imUnzip((await pick.data()).buffer));
      else { const tx = imDecode(await pick.data()); rows = /\.xml$/i.test(pick.name) ? imReadXmlTable(tx) : imParseDelimited(tx); }
    }
  } else {
    const tx = imDecode(buf);
    rows = /^\s*</.test(tx) ? imReadXmlTable(tx) : imParseDelimited(tx);
  }
  buf = null;
  return Object.assign({ name }, imTable(rows));
}

/* ------------------------------------------------------------ converting values */

const imNum = v => {
  let s = str(v).replace(/[^\d.,'’-]/g, '').replace(/['’]/g, '');
  if (!s || !/\d/.test(s)) return null;
  const c = s.lastIndexOf(','), d = s.lastIndexOf('.');
  if (c >= 0 && d >= 0) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (c >= 0) s = /,\d{3}$/.test(s) && !/^0,/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  const n = Number(s);
  return isNaN(n) ? null : n;
};
/* the average of a range like 92-94 */
const imScore = v => { const m = str(v).replace(/,/g, '.').match(/\d+(\.\d+)?/g); if (!m) return null; const a = m.slice(0, 2).map(Number); return a.reduce((x, y) => x + y, 0) / a.length; };
const imYear = v => { const m = /\b(1[89]\d\d|20\d\d)\b/.exec(str(v)); return m && m[1] !== '1001' ? m[1] : ''; };
function imSize(v) {
  const s = lc(str(v)).trim();
  if (!s) return null;
  if (/double magnum|jeroboam/.test(s)) return 300;
  if (/magnum/.test(s)) return 150;
  if (/imperial|methuselah/.test(s)) return 600;
  if (/half|demi|piccolo|split/.test(s)) return 37.5;
  const n = imNum(s);
  if (n === null || n <= 0) return null;
  let cl = /ml/.test(s) ? n / 10 : /cl/.test(s) ? n : /\bl\b|ltr|liter|litre|l$/.test(s) ? n * 100 : n >= 100 ? n / 10 : n <= 3 ? n * 100 : n;
  cl = Math.round(cl * 10) / 10;
  return cl >= 5 && cl <= 2000 ? cl : null;
}
function imDate(v, fmt) {
  const s = str(v).trim();
  if (!s) return '';
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  const ok = (y, mo, d) => { const dt = new Date(Date.UTC(y, mo - 1, d)); return dt.getUTCMonth() === mo - 1 && y > 1900 && y < 2100 ? dt.toISOString().slice(0, 10) : ''; };
  if (m) return ok(+m[1], +m[2], +m[3]);
  if (fmt === 'excel' || /^\d{5}(\.\d+)?$/.test(s)) { const n = Number(s); if (n > 20000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10); }
  m = /^(\d{1,4})[./\-\s](\d{1,2})[./\-\s](\d{1,4})/.exec(s);
  if (m) {
    let a = +m[1], b = +m[2], c = +m[3];
    const yy = y => (y < 100 ? 2000 + y : y);
    if (m[1].length === 4 || fmt === 'YMD') return ok(yy(a), b, c);
    if (fmt === 'MDY' || (!fmt && a <= 12 && b > 12)) return ok(yy(c), a, b);
    return ok(yy(c), b, a);
  }
  const t = Date.parse(s);
  return isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10);
}
const IM_TYPE_WORDS = [
  ['Sparkling', /sparkl|champagne|sekt|cava|prosecco|cr[eé]mant|mousseux|spumante|schaum|franciacorta|p[eé]tillant/],
  ['Fortified', /fortified|\bport\b|porto|sherry|madeira|marsala|vin doux|banyuls/],
  ['Dessert', /dessert|sweet|s[üu]ss|sauternes|ice ?wine|eiswein|tokaji|liquoreux|beerenauslese|passito/],
  ['Rosé', /ros[eé]|rosato|rosado|blush/],
  ['White', /white|blanc|wei[sß]|bianco|blanco|branco/],
  ['Red', /\bred\b|rouge|\brot\b|tinto|rosso|noir/]
];
/* sparkling, fortified and dessert wines win over their colour, then the values the AI saw, then keywords */
function imType(vals, values) {
  const l = lc(vals.join(' '));
  if (!l) return '';
  const special = IM_TYPE_WORDS.slice(0, 3).find(([, re]) => re.test(l));
  if (special) return special[0];
  const known = vals.map(v => values && values[v]).find(Boolean);
  if (known) return known;
  const hit = IM_TYPE_WORDS.find(([, re]) => re.test(l));
  return hit ? hit[0] : '';
}
const IM_SCALE_MAX = { 100: 100, 20: 20, 10: 10, 5: 5, pct: 100 };
const imPct = (v, scale) => { const n = imScore(v); if (n === null || n <= 0) return null; const max = IM_SCALE_MAX[scale] || 100; return Math.max(0, Math.min(100, Math.round(n / max * 100))); };
const imNorm = s => lc(str(s)).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/* ------------------------------------------------------------ state and the fields of the mapping */

const IMP = { step: 'file', how: '', open: '', file: null, map: null, places: {}, dup: {}, plan: null, run: null, result: null, error: '', fromSetup: false };
const IM_HOW = [
  ['CellarTracker', 'CSV from the desktop website', ['Open cellartracker.com in the browser of your phone and switch to the desktop site.', 'Open My Cellar, then Export, and choose CSV.', 'Choose the downloaded file here.']],
  ['InVintory', 'Export CSV on the website or iPhone', ['Open your collection in InVintory.', 'Tap Download CSV, or Export CSV on the website.', 'Choose the file here.']],
  ['Vivino', 'ZIP file from your account', ['Open vivino.com, tap your picture, then Settings.', 'Go to Account management and request your data.', 'Vivino sends a ZIP file, often after a while. Choose it here as it is.']],
  ['Oeni', 'Excel export of your cellar', ['Open your cellar in Oeni.', 'Export it as an Excel file.', 'Choose the file here.']],
  ['VinoCell', 'CSV or Excel export in the app', ['In VinoCell, open the export of your wines.', 'Choose CSV or Excel and save the file.', 'Choose the file here.']],
  ['Other app', 'Any table with your wines', ['Export your wines as CSV or Excel, or save your own list in one of these formats.', 'One row per wine with a column for the number of bottles, or one row per bottle.', 'Choose the file here. Vintary suggests how the columns fit.']]
];
/* key, label, the source fields it uses */
const IM_FIELDS = [
  ['producer', 'Producer'], ['name', 'Wine'], ['vintage', 'Vintage'], ['type', 'Type'], ['region', 'Region'], ['grapes', 'Grapes'],
  ['bottles', 'Bottles'], ['size', 'Bottle size'], ['place', 'Place and shelf'], ['retailer', 'Bought at'], ['date', 'Purchase date'],
  ['price', 'Purchase price'], ['myRating', 'My rating'], ['ratings', 'External ratings'], ['window', 'Drinking window'], ['note', 'Journal note']
];
const IM_MULTI = ['name', 'region', 'grapes', 'type'];
const IM_SUB = { place: [['location', 'Place'], ['shelf', 'Shelf or bin']], window: [['drinkFrom', 'From'], ['drinkUntil', 'Until']], price: [['price', 'Price'], ['currency', 'Currency']] };

const imCols = k => ((IMP.map && IMP.map.fields[k] && IMP.map.fields[k].cols) || []);
const imIdx = c => IMP.file.headers.indexOf(c);
const imVal = (row, k) => imCols(k).map(c => str(row[imIdx(c)]).trim()).filter(Boolean);
const imFirst = (row, k) => imVal(row, k)[0] || '';
const imSample = k => { for (const r of IMP.file.rows) { const v = imVal(r, k); if (v.length) return v.join(k === 'region' ? ', ' : ' '); } return ''; };

function imReset() {
  Object.assign(IMP, { step: 'file', how: '', open: '', file: null, map: null, places: {}, dup: {}, plan: null, run: null, result: null, error: '' });
}

/* ------------------------------------------------------------ steps */

async function imChoose(file) {
  if (!file) return;
  if (S.version && S.version < 53) { toast('The import needs the new Code.gs. Replace the script code and create a new version under Manage deployments.', 6000); return; }
  imReset();
  IMP.step = 'reading'; render();
  try {
    IMP.file = await imReadFile(file);
    IMP.step = 'thinking'; render();
    const sample = IMP.file.rows.slice(0, 5);
    IMP.map = await api('importMap', { file: IMP.file.name, headers: IMP.file.headers, rows: sample, total: IMP.file.rows.length, currency: cur() });
    IMP.map.fields = IMP.map.fields || {};
    IMP.map.ratings = IMP.map.ratings || [];
    IMP.map.ratings.forEach(r => { r.on = true; });
    IMP.step = 'map';
  } catch (e) {
    IMP.step = 'file'; IMP.error = e.message || String(e);
  }
  render();
}

/* the places in the file, with their bottles */
function imSourcePlaces() {
  const out = {};
  IMP.file.rows.forEach(r => {
    const k = imFirst(r, 'location');
    out[k] = (out[k] || 0) + imQty(r);
  });
  return out;
}
const imQty = r => {
  if (IMP.map.rowKind === 'bottle' && !imCols('bottles').length) return 1;
  if (!imCols('bottles').length) return 1;
  const n = imNum(imFirst(r, 'bottles'));
  return n === null ? 0 : Math.max(0, Math.round(n));
};
function imPlacesInit() {
  const src = imSourcePlaces();
  Object.keys(src).forEach(k => {
    if (IMP.places[k]) return;
    const same = S.locations.find(l => lc(l) === lc(k));
    IMP.places[k] = same ? 'old:' + same : k ? 'new:' + k : S.locations.length ? 'old:' + S.locations[0] : 'new:Cellar';
  });
}
const imTarget = k => { const v = IMP.places[k] || ''; return v.slice(4); };

/* every row converted into wines with their places and journal entries */
function imBuild() {
  const F = IMP.map.fields, wines = {}, order = [];
  let skipped = 0;
  const curOf = r => {
    const c = F.currency || {};
    if (c.cols && c.cols.length) { const v = str(imFirst(r, 'currency')).toUpperCase().replace(/[^A-Z]/g, ''); if (CURRENCIES.includes(v)) return v; }
    return c.fixed && CURRENCIES.includes(c.fixed) ? c.fixed : cur();
  };
  IMP.file.rows.forEach(r => {
    let producer = imVal(r, 'producer').join(' '), name = imVal(r, 'name').join(' ');
    if (producer && lc(name).startsWith(lc(producer) + ' ')) name = name.slice(producer.length + 1).trim();
    const qty = imQty(r);
    if ((!producer && !name) || !qty) { skipped++; return; }
    const vintage = imYear(imFirst(r, 'vintage')), size = imSize(imFirst(r, 'size')) || 75;
    const key = [imNorm(producer + ' ' + name), vintage, size].join('|');
    let g = wines[key];
    if (!g) {
      g = wines[key] = { key, w: { producer, name, vintage, type: '', region: '', grapes: '', size: size === 75 ? '' : size, myRating: null, ratings: [], drinkFrom: null, drinkUntil: null }, stock: [], entries: [], qty: 0 };
      order.push(key);
    }
    const w = g.w;
    if (!w.type) w.type = imType(imVal(r, 'type'), F.type && F.type.values);
    if (!w.region) w.region = [...new Map(imVal(r, 'region').map(v => [lc(v), v])).values()].join(', ');
    if (!w.grapes) w.grapes = imVal(r, 'grapes').join(', ');
    if (w.myRating === null && F.myRating) w.myRating = imPct(imFirst(r, 'myRating'), F.myRating.scale);
    IMP.map.ratings.filter(x => x.on).forEach(x => {
      if (w.ratings.some(y => y.sys === x.sys)) return;
      const n = imScore(r[imIdx(x.col)]), sys = SYSTEMS.find(s => s.key === x.sys);
      if (n === null || n <= 0 || !sys) return;
      const v = n / (IM_SCALE_MAX[x.scale] || 100) * sys.max;
      w.ratings.push({ sys: x.sys, score: sys.max >= 100 ? Math.round(v) : Math.round(v * 10) / 10 });
    });
    if (w.drinkFrom === null) w.drinkFrom = Number(imYear(imFirst(r, 'drinkFrom'))) || null;
    if (w.drinkUntil === null) w.drinkUntil = Number(imYear(imFirst(r, 'drinkUntil'))) || null;
    // the place
    const loc = imTarget(imFirst(r, 'location')), bin = imFirst(r, 'shelf');
    const sn = /^\d{1,2}$/.test(bin) ? Number(bin) : null;
    const place = { loc, shelf: sn, pos: sn === null ? bin : '' };
    const st = g.stock.find(e => samePlace(e, place));
    if (st) st.n += qty; else g.stock.push(Object.assign({ n: qty }, place));
    g.qty += qty;
    // the journal entry: a purchase when the date is known
    const date = F.date ? imDate(imFirst(r, 'date'), F.date.fmt) : '';
    const priceN = imNum(imFirst(r, 'price'));
    const e = { type: date ? 'Purchase' : 'Imported', date, price: priceN !== null && priceN > 0 ? priceN : '', priceCur: priceN !== null && priceN > 0 ? curOf(r) : '', retailer: imFirst(r, 'retailer'), loc, note: imVal(r, 'note').join(' · ') };
    const same = g.entries.find(x => ['type', 'date', 'price', 'priceCur', 'retailer', 'loc', 'note'].every(k => String(x[k]) === String(e[k])));
    if (same) same.qty += qty; else g.entries.push(Object.assign({ qty }, e));
  });
  // wines in Vintary already
  const mine = {};
  S.wines.forEach(w => { mine[[imNorm(w.producer + ' ' + w.name), str(w.vintage), w.size].join('|')] = w; });
  const list = order.map(k => wines[k]);
  list.forEach(g => {
    g.match = mine[g.key] || null;
    if (g.match && !(g.key in IMP.dup)) IMP.dup[g.key] = g.match.count > 0 ? 'skip' : 'add';
  });
  IMP.plan = { list, skipped, bottles: list.reduce((a, g) => a + g.qty, 0), entries: list.reduce((a, g) => a + g.entries.length, 0) };
  return IMP.plan;
}

/* what is written, after the choices for wines already in the cellar */
function imJobs() {
  const p = IMP.plan, newW = [], adds = [], ents = [];
  p.list.forEach(g => {
    const choice = g.match ? IMP.dup[g.key] : 'new';
    if (choice === 'skip') return;
    const id = g.match ? g.match.id : (g.id || (g.id = newId('w')));
    if (!g.match) {
      const w = g.w;
      newW.push({ id, producer: w.producer, name: w.name, vintage: w.vintage, type: w.type || 'Red', region: w.region, grapes: w.grapes, size: w.size,
        myRating: w.myRating === null ? '' : w.myRating, ratings: w.ratings.length ? JSON.stringify(w.ratings) : '',
        drinkFrom: w.drinkFrom || '', drinkUntil: w.drinkUntil || '', stock: g.stock.map(e => ({ loc: e.loc, shelf: e.shelf, pos: e.pos, n: e.n })) });
    } else adds.push({ wineId: id, stock: g.stock.map(e => ({ loc: e.loc, shelf: e.shelf, pos: e.pos, n: e.n })) });
    g.entries.forEach((e, i) => {
      e.id = e.id || newId('i') + i;
      ents.push({ id: e.id, wineId: id, dir: 'in', type: e.type, qty: e.qty, loc: e.loc, date: e.date, price: e.price, priceCur: e.priceCur, retailer: e.retailer, note: e.note, wineName: [g.w.producer, g.w.name, g.w.vintage].filter(Boolean).join(' ') });
    });
  });
  const places = [...new Set(Object.values(IMP.places).filter(v => v.startsWith('new:')).map(v => v.slice(4)))];
  return { newW, adds, ents, places };
}

const IM_PART = 80;
async function imRun() {
  const j = imJobs();
  const bottles = IMP.plan.list.filter(g => !g.match || IMP.dup[g.key] !== 'skip').reduce((a, g) => a + g.qty, 0);
  if (!IMP.run) IMP.run = { done: 0, part: 0, total: bottles };
  IMP.step = 'run'; IMP.error = ''; render();
  // parts of wines with their entries, then the bottles for wines already in the cellar
  const parts = [];
  for (let i = 0; i < j.newW.length; i += IM_PART) {
    const ws = j.newW.slice(i, i + IM_PART), ids = new Set(ws.map(w => w.id));
    parts.push({ wines: ws, entries: j.ents.filter(e => ids.has(e.wineId)), n: ws.reduce((a, w) => a + w.stock.reduce((b, e) => b + e.n, 0), 0) });
  }
  for (let i = 0; i < j.adds.length; i += IM_PART) {
    const as = j.adds.slice(i, i + IM_PART), ids = new Set(as.map(a => a.wineId));
    parts.push({ adds: as, entries: j.ents.filter(e => ids.has(e.wineId) && !j.newW.some(w => w.id === e.wineId)), n: as.reduce((a, x) => a + x.stock.reduce((b, e) => b + e.n, 0), 0) });
  }
  if (!parts.length) parts.push({ n: 0 });
  parts[0].places = j.places;
  try {
    for (let k = IMP.run.part; k < parts.length; k++) {
      const p = parts[k];
      await api('importWines', { places: p.places || [], wines: p.wines || [], adds: p.adds || [], entries: p.entries || [] });
      IMP.run.part = k + 1;
      IMP.run.done += p.n;
      if (route().p === 'import') render();
    }
  } catch (e) {
    IMP.error = e.message || String(e);
    render();
    return;
  }
  IMP.result = { wines: j.newW.length, bottles, entries: j.ents.length, places: j.places, skipped: IMP.plan.list.filter(g => g.match && IMP.dup[g.key] === 'skip').length, adds: j.adds.length };
  await sync(true);
  IMP.step = 'done'; IMP.run = null;
  if (route().p === 'import') render();
}

/* ------------------------------------------------------------ screens */

const imStep = (n, title, text, cancel = true) => `<div class="between"><span class="gd-sub">Step ${n} of 4</span>${cancel ? '<button class="link-btn" data-act="im-cancel">Cancel</button>' : '<span></span>'}</div>
  <div class="gd-steps">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>
  <h1 class="title" style="margin:6px 0 0">${title}</h1>${text ? `<p class="gd-text">${text}</p>` : ''}`;
const imNav = (back, next, nextLabel = 'Next', extra = '') => `<div class="grid2" style="margin-top:6px"><button class="btn" data-act="${back}">${extra || 'Back'}</button><button class="btn primary" data-act="${next}">${nextLabel}</button></div>`;

function viewImport() {
  const s = IMP.step;
  let body;
  if ((s !== 'file' && s !== 'reading' && s !== 'thinking' && s !== 'done') && !IMP.map) imReset();
  if (IMP.step === 'file' || s === 'reading' || s === 'thinking') body = imFileHtml();
  else if (s === 'map') body = imMapHtml();
  else if (s === 'places') body = imPlacesHtml();
  else if (s === 'preview') body = imPreviewHtml();
  else if (s === 'dups') body = imDupsHtml();
  else if (s === 'run') body = imRunHtml();
  else body = imDoneHtml();
  return `<main class="screen im-screen">${body}</main>`;
}

function imFileHtml() {
  const busy = IMP.step === 'reading' || IMP.step === 'thinking';
  const how = IM_HOW.map(([n, sub, steps]) => {
    const open = IMP.how === n;
    return `<div class="im-row${open ? ' open' : ''}"><button class="im-how" data-act="im-how" data-v="${esc(n)}" aria-expanded="${open}"><span class="t"><b>${esc(n)}</b><small>${esc(sub)}</small></span><span class="im-chev">${ICON.chevron}</span></button>
      ${open ? `<ol class="im-steps">${steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}</div>`;
  }).join('');
  return `${backLinkHtml('#/settings', 'Settings')}
    <h1 class="title" style="margin:0">Import from another app</h1>
    <p class="gd-text">Choose the export file of your old app. Vintary reads the first entries, suggests how they fit and shows you everything before it imports.</p>
    ${IMP.error ? `<div class="card notice"><b>That did not work</b><p class="small" style="margin:4px 0 0">${esc(IMP.error)}</p></div>` : ''}
    <label class="im-drop${busy ? ' busy' : ''}">${busy ? '<span class="spinner"></span>' : ICON.upload}<b>${IMP.step === 'reading' ? 'Reading the file…' : IMP.step === 'thinking' ? 'Checking the columns…' : 'Choose file'}</b>
      <small>${busy ? 'This takes a few seconds.' : 'CSV, Excel, TSV, XML or ZIP · the whole file, no need to cut it'}</small>
      <input type="file" hidden data-change="im-file" accept=".csv,.tsv,.txt,.xml,.xlsx,.zip,text/csv,text/tab-separated-values,text/plain,application/zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"${busy ? ' disabled' : ''}></label>
    <h3 class="gd-h">How to get your file</h3>
    <div class="im-list">${how}</div>`;
}

/* the text under a field: how its values are converted, or an example */
function imConv(k) {
  const F = IMP.map.fields;
  if (k === 'type') return 'Red, White, Rosé, Sparkling, Dessert, Fortified';
  if (k === 'bottles') return imCols('bottles').length ? (imSample('bottles') ? `For example ${imSample('bottles')}` : '') : IMP.map.rowKind === 'bottle' ? 'Each row is one bottle, rows are counted' : 'One bottle per row';
  if (k === 'size') { const x = imSample('size'), cl = imSize(x); return x && cl ? `${x} becomes ${clText(cl)}` : 'Standard bottle when empty'; }
  if (k === 'place') return imCols('location').length ? 'Set in the next step' : 'You choose the place in the next step';
  if (k === 'date') { const x = imSample('date'), d = F.date ? imDate(x, F.date.fmt) : ''; return x && d ? `${x} becomes ${fmtDate(d)}` : ''; }
  if (k === 'price') { const c = F.currency || {}; return c.cols && c.cols.length ? `Currency from the column ${c.cols[0]}` : `In ${c.fixed || cur()}`; }
  if (k === 'myRating') { const sc = (F.myRating || {}).scale; return sc === 'pct' ? 'Already in %' : sc === '5' ? '5 stars become %' : `${sc || 100} points become %`; }
  if (k === 'ratings') { const on = IMP.map.ratings.filter(r => r.on); return on.length ? `As ${on.map(r => r.sys).join(', ')}` : ''; }
  if (k === 'window') return 'Years from and until';
  if (k === 'note') return 'Goes to the journal entry of the wine';
  let x = imSample(k);
  const pr = k === 'name' ? imSample('producer') : '';
  if (pr && lc(x).startsWith(lc(pr) + ' ')) x = x.slice(pr.length + 1);
  return x ? `For example ${x.length > 34 ? x.slice(0, 33) + '…' : x}` : '';
}
function imChip(k) {
  if (k === 'place') { const c = imCols('location').concat(imCols('shelf')); return c.length ? c.join(', ') : 'Choose in the next step'; }
  if (k === 'window') { const c = imCols('drinkFrom').concat(imCols('drinkUntil')); return c.length ? c.join(', ') : "Don't import"; }
  if (k === 'ratings') { const on = IMP.map.ratings.filter(r => r.on); return on.length ? on.map(r => r.col).join(', ') : "Don't import"; }
  if (k === 'bottles' && !imCols('bottles').length) return IMP.map.rowKind === 'bottle' ? 'One per row' : 'One per row';
  const c = imCols(k);
  return c.length ? c.join(', ') : "Don't import";
}
const imIsOff = k => imChip(k) === "Don't import";

/* the choice of columns of an opened field */
function imPickHtml(k) {
  const H = IMP.file.headers;
  const group = (fk, label, extra = '') => {
    const cols = imCols(fk), multi = IM_MULTI.includes(fk);
    return `${label ? `<span class="im-pl">${esc(label)}</span>` : ''}<div class="im-cols">${extra}${H.map(h => `<button class="chip${cols.includes(h) ? ' on' : ''}" data-act="im-col" data-k="${fk}" data-v="${esc(h)}"${multi ? ' data-multi="1"' : ''}>${esc(h)}</button>`).join('')}
      <button class="chip fmore${cols.length ? '' : ' on'}" data-act="im-col" data-k="${fk}" data-v="">Don't import</button></div>`;
  };
  if (k === 'ratings') {
    if (!IMP.map.ratings.length) return '<p class="muted tiny" style="margin:0">No published scores found in the file.</p>';
    return `<div class="im-cols">${IMP.map.ratings.map((r, i) => `<button class="chip${r.on ? ' on' : ''}" data-act="im-rate" data-i="${i}">${esc(r.col)} · ${esc(r.sys)}</button>`).join('')}</div>`;
  }
  if (k === 'bottles') return group('bottles', '', `<button class="chip${imCols('bottles').length ? '' : ' on'}" data-act="im-col" data-k="bottles" data-v="">One per row</button>`).replace(/<button class="chip fmore[^>]*>Don't import<\/button>/, '');
  if (IM_SUB[k]) {
    return IM_SUB[k].map(([fk, label]) => {
      if (fk === 'currency') {
        const c = IMP.map.fields.currency || {}, fixed = !(c.cols && c.cols.length);
        return `<span class="im-pl">${label}</span><div class="im-cols"><button class="chip${fixed ? ' on' : ''}" data-act="im-cur">Always ${esc(c.fixed || cur())}</button>${H.map(h => `<button class="chip${!fixed && c.cols.includes(h) ? ' on' : ''}" data-act="im-col" data-k="currency" data-v="${esc(h)}">${esc(h)}</button>`).join('')}</div>`;
      }
      return group(fk, label);
    }).join('');
  }
  return group(k, '');
}

function imMapHtml() {
  const m = IMP.map, used = new Set();
  Object.values(m.fields).forEach(f => (f.cols || []).forEach(c => used.add(c)));
  m.ratings.filter(r => r.on).forEach(r => used.add(r.col));
  const left = IMP.file.headers.filter(h => !used.has(h));
  const why = {}; (m.ignored || []).forEach(x => { why[x.col] = x.why; });
  const rows = IM_FIELDS.map(([k, label]) => {
    const open = IMP.open === k, conv = imConv(k);
    return `<div class="im-row${open ? ' open' : ''}"><button class="im-field" data-act="im-open" data-v="${k}" aria-expanded="${open}"><span class="t"><b>${label}</b>${conv ? `<small>${esc(conv)}</small>` : ''}</span><span class="chip${imIsOff(k) ? ' off' : ''}"><span class="ellipsis">${esc(imChip(k))}</span>${ICON.chevron}</span></button>
      ${open ? `<div class="im-pick">${imPickHtml(k)}</div>` : ''}</div>`;
  }).join('');
  const n = IMP.file.rows.length;
  return `${imStep(1, 'Check the mapping', 'Tap a field to change where it comes from.')}
    <div class="im-ai"><span class="gd-ic">${ICON.magic}</span><span><b>${esc(m.source)} export</b><small>${esc(IMP.file.name)} · ${n} ${n === 1 ? 'row' : 'rows'}${m.rowKind === 'bottle' ? ', one per bottle' : ''}</small>${m.notes ? `<small class="im-note">${esc(m.notes)}</small>` : ''}</span></div>
    <div class="im-list">${rows}</div>
    ${left.length ? `<h3 class="gd-h">Not imported</h3><div class="im-skip">${left.map(h => `<span class="chip"${why[h] ? ` title="${esc(why[h])}"` : ''}>${esc(h)}</span>`).join('')}</div>` : ''}
    ${imNav('im-cancel', 'im-to-places', 'Next', 'Cancel')}`;
}

function imPlacesHtml() {
  const src = imSourcePlaces(), keys = Object.keys(src).sort((a, b) => src[b] - src[a]);
  const opt = (k, v, label) => `<option value="${esc(v)}"${IMP.places[k] === v ? ' selected' : ''}>${esc(label)}</option>`;
  const box = k => {
    const nw = k || 'Cellar';
    const cur0 = IMP.places[k] || '';
    const newName = cur0.startsWith('new:') ? cur0.slice(4) : nw;
    return `<div class="im-place"><div class="between"><b>${esc(k || (keys.length === 1 ? 'All bottles' : 'Without a place'))}</b><span class="muted tiny">${src[k]} ${src[k] === 1 ? 'bottle' : 'bottles'}</span></div>
      <label class="field">Vintary place<select data-change="im-place" data-k="${esc(k)}">${S.locations.map(l => opt(k, 'old:' + l, l)).join('')}${opt(k, 'new:' + newName, `New place "${newName}"`)}</select></label>
      ${cur0.startsWith('new:') ? '<p class="muted tiny" style="margin:0">A new place is created. You can set its type and size later under Places.</p>' : ''}</div>`;
  };
  const n = keys.length;
  const text = imCols('location').length ? `Your file uses ${n} ${n === 1 ? 'place' : 'places'}. Choose the Vintary place for each.${imCols('shelf').length ? ' The bin goes to the shelf.' : ''}` : 'Your file has no places. Choose where the bottles go.';
  return `${imStep(2, 'Where do they go?', text)}
    ${keys.map(box).join('')}
    ${imNav('im-back-map', 'im-to-preview')}`;
}

function imPreviewHtml() {
  const p = IMP.plan, dups = p.list.filter(g => g.match).length;
  const sample = p.list.filter(g => !g.match).slice(0, 3);
  // three wines drawn the way the cellar shows them, with their prices for a moment in the journal
  const tmp = [], cards = sample.map((g, i) => {
    const id = 'imp-' + i;
    g.entries.forEach(e => tmp.push(normRemoval(Object.assign({}, e, { id: id + 'e' + tmp.length, wineId: id, dir: 'in' }))));
    return normWine({ id, producer: g.w.producer, name: g.w.name, vintage: g.w.vintage, type: g.w.type || 'Red', region: g.w.region, grapes: g.w.grapes, size: g.w.size,
      drinkFrom: g.w.drinkFrom, drinkUntil: g.w.drinkUntil, myRating: g.w.myRating, ratings: g.w.ratings, stock: JSON.stringify(g.stock) });
  });
  S.removals.push(...tmp);
  let list;
  try { list = cards.map(wineRow).join(''); } finally { S.removals.splice(S.removals.length - tmp.length, tmp.length); }
  const chip = (n, t, warn) => `<a class="${warn ? 'warn' : ''}"><b>${n}</b> ${t}</a>`;
  return `${imStep(3, 'Preview', 'This is how your wines will look in Vintary.')}
    <div class="hm-stat im-stat">${chip(p.list.length, p.list.length === 1 ? 'wine' : 'wines')}${chip(p.bottles, p.bottles === 1 ? 'bottle' : 'bottles')}${chip(p.entries, p.entries === 1 ? 'journal entry' : 'journal entries')}${dups ? chip(dups, 'already in Vintary', true) : ''}</div>
    ${list ? `<div class="im-prev" inert>${list}</div>` : ''}
    ${p.skipped ? `<p class="muted tiny" style="margin:0">${p.skipped} ${p.skipped === 1 ? 'row has' : 'rows have'} no wine name or no bottles and ${p.skipped === 1 ? 'is' : 'are'} left out.</p>` : ''}
    <p class="muted tiny" style="margin:0">Something looks wrong? Go back and change the mapping.</p>
    ${imNav('im-back-map', dups ? 'im-to-dups' : 'im-start', dups ? 'Next' : `Import ${p.bottles} ${p.bottles === 1 ? 'bottle' : 'bottles'}`, 'Back to mapping')}`;
}

function imDupsHtml() {
  const list = IMP.plan.list.filter(g => g.match);
  const bottles = IMP.plan.list.filter(g => !g.match || IMP.dup[g.key] !== 'skip').reduce((a, g) => a + g.qty, 0);
  const row = g => {
    const add = IMP.dup[g.key] === 'add';
    return `<div class="im-dup"><b>${esc(fullName(g.match))}</b><small>File: ${g.qty} ${g.qty === 1 ? 'bottle' : 'bottles'} · In your cellar: ${g.match.count} ${g.match.count === 1 ? 'bottle' : 'bottles'}</small>
      <div class="grid2"><button class="chip${add ? '' : ' on'}" data-act="im-dup" data-k="${esc(g.key)}" data-v="skip">Skip</button><button class="chip${add ? ' on' : ''}" data-act="im-dup" data-k="${esc(g.key)}" data-v="add">Add bottles</button></div></div>`;
  };
  return `${imStep(3, 'Already in your cellar', `${list.length === 1 ? 'This wine is' : `These ${list.length} wines are`} in Vintary already. Skip ${list.length === 1 ? 'it' : 'them'}, or add the bottles from the file.`)}
    <div class="between"><span class="muted tiny">${list.length} ${list.length === 1 ? 'wine' : 'wines'}</span><span style="display:flex;gap:6px"><button class="chip" data-act="im-dup-all" data-v="skip">Skip all</button><button class="chip" data-act="im-dup-all" data-v="add">Add all</button></span></div>
    ${list.map(row).join('')}
    ${imNav('im-back-preview', 'im-start', `Import ${bottles} ${bottles === 1 ? 'bottle' : 'bottles'}`)}`;
}

function imRunHtml() {
  const r = IMP.run || { done: 0, total: 0 };
  const pct = r.total ? Math.round(r.done / r.total * 100) : 0;
  return `${imStep(4, 'Importing', 'Keep Vintary open until it is finished.', false)}
    <div class="im-bar"><i style="width:${Math.max(3, pct)}%"></i></div>
    <p class="muted" style="margin:0">${r.done} of ${r.total} ${r.total === 1 ? 'bottle' : 'bottles'}</p>
    ${IMP.error ? `<div class="card notice"><b>The import stopped</b><p class="small" style="margin:4px 0 0">${esc(IMP.error)} What is imported stays. Try again to go on from here.</p></div>
      ${imNav('im-cancel', 'im-start', 'Try again', 'Stop')}` : ''}`;
}

function imDoneHtml() {
  const r = IMP.result || { wines: 0, bottles: 0, entries: 0, places: [], skipped: 0, adds: 0 };
  const line = (l, v) => `<div class="im-row im-sum"><b>${l}</b><span>${esc(v)}</span></div>`;
  const inc = incompleteWines().length;
  return `<div class="im-ok">${ICON.check}</div>
    <h1 class="title" style="margin:6px 0 0;text-align:center">Your cellar is in</h1>
    <div class="im-list">${line('Wines added', r.wines)}${line('Bottles', r.bottles)}${line('Journal entries', r.entries)}${r.adds ? line('Bottles added to wines you had', `${r.adds} ${r.adds === 1 ? 'wine' : 'wines'}`) : ''}${r.places.length ? line(r.places.length === 1 ? 'New place' : 'New places', r.places.join(', ')) : ''}${r.skipped ? line('Skipped', `${r.skipped} ${r.skipped === 1 ? 'wine' : 'wines'}`) : ''}</div>
    ${inc ? `<section class="box"><span class="box-title">Wine info</span>
      <p class="small" style="margin:0">Drinking windows, taste profiles and pairings are not in your file. The AI can add them now.</p>
      ${PROF.busy ? `<p class="small" id="prof-progress" style="margin:0">${PROF.done} of ${PROF.total} wines done…</p>` : ''}
      <button class="btn accent block" data-act="complete-all"${PROF.busy ? ' disabled' : ''}>${ICON.spark}Complete wine info for ${inc} ${inc === 1 ? 'wine' : 'wines'}</button>
      <p class="muted tiny" style="margin:0">Only empty fields are filled. About 3 cents per wine. Keep the app open while it runs. You can also do it later in Settings.</p></section>` : ''}
    ${IMP.fromSetup ? '<button class="btn primary big block" data-act="im-setup">Continue setup</button>' : '<a class="btn primary big block" href="#/cellar" data-act="im-close">Open cellar</a>'}`;
}

/* ------------------------------------------------------------ actions */

const IM_ACTS = {
  'im-how': el => { IMP.how = IMP.how === el.dataset.v ? '' : el.dataset.v; render(); },
  'im-open': el => { IMP.open = IMP.open === el.dataset.v ? '' : el.dataset.v; render(); },
  'im-col': el => {
    const k = el.dataset.k, v = el.dataset.v, F = IMP.map.fields;
    if (k === 'currency') { F.currency = v ? { cols: [v] } : { fixed: (F.currency && F.currency.fixed) || cur() }; render(); return; }
    const f = F[k] || (F[k] = { cols: [] });
    if (!v) f.cols = [];
    else if (el.dataset.multi) f.cols = f.cols.includes(v) ? f.cols.filter(c => c !== v) : f.cols.concat(v);
    else f.cols = f.cols.length === 1 && f.cols[0] === v ? [] : [v];
    if (k === 'date' && !f.fmt) f.fmt = '';
    if (k === 'myRating' && !f.scale) f.scale = '100';
    if (k === 'location') IMP.places = {};
    render();
  },
  'im-cur': () => { const F = IMP.map.fields; F.currency = { fixed: (F.currency && F.currency.fixed) || cur() }; render(); },
  'im-rate': el => { const r = IMP.map.ratings[Number(el.dataset.i)]; r.on = !r.on; render(); },
  'im-cancel': () => { const s = IMP.fromSetup; imReset(); IMP.fromSetup = false; go(s ? '#/setup' : '#/settings'); },
  'im-to-places': () => {
    if (!imCols('name').length && !imCols('producer').length) { toast('Choose at least the column with the wine name.'); return; }
    imPlacesInit(); IMP.open = ''; IMP.step = 'places'; render(); window.scrollTo(0, 0);
  },
  'im-back-map': () => { IMP.step = 'map'; render(); window.scrollTo(0, 0); },
  'im-to-preview': () => { imBuild(); IMP.step = 'preview'; render(); window.scrollTo(0, 0); },
  'im-back-preview': () => { IMP.step = 'preview'; render(); window.scrollTo(0, 0); },
  'im-to-dups': () => { IMP.step = 'dups'; render(); window.scrollTo(0, 0); },
  'im-dup': el => { IMP.dup[el.dataset.k] = el.dataset.v; render(); },
  'im-dup-all': el => { IMP.plan.list.filter(g => g.match).forEach(g => { IMP.dup[g.key] = el.dataset.v; }); render(); },
  'im-start': () => imRun(),
  'im-setup': () => { imReset(); IMP.fromSetup = false; GS.step = 3; go('#/setup'); },
  'im-close': () => { imReset(); go('#/cellar'); },
  'im-from-setup': () => { imReset(); IMP.fromSetup = true; go('#/import'); },
  'im-open-settings': () => { if (IMP.step !== 'run') { imReset(); IMP.fromSetup = false; } go('#/import'); }
};
const IM_CHANGES = {
  'im-file': el => { const f = el.files && el.files[0]; el.value = ''; imChoose(f); },
  'im-place': el => { IMP.places[el.dataset.k] = el.value; render(); }
};
