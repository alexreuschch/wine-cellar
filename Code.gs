/**
 * Wine Cellar API, version 2
 * Google Apps Script bound to the "Wine Cellar" Google Sheet.
 *
 * One-time setup: select the function "setup" above and click Run.
 * Script properties used:
 *   APP_TOKEN              created by setup, paste it into the app
 *   ANTHROPIC_API_KEY      your Claude API key (sk-ant-...)
 *   ANTHROPIC_WORKSPACE_ID optional, only if Claude asks for a workspace id
 *   CLAUDE_MODEL           optional, model for label analysis (default claude-sonnet-5-5)
 *   PRICE_MODEL            optional, model for street prices (default claude-haiku-5-5)
 */

var API_VERSION = 5;
var SHEETS = { wines: 'Wines', removals: 'Removals', locations: 'Locations', retailers: 'Retailers', fx: 'FX' };

var WINE_COLS = [
  'id', 'producer', 'name', 'vintage', 'type', 'region', 'grapes', 'taste', 'tasteTags', 'pairings',
  'drinkFrom', 'peakFrom', 'peakUntil', 'drinkUntil', 'location', 'shelf', 'position', 'count',
  'myRating', 'ratings', 'labelFileId', 'thumb', 'createdAt', 'updatedAt',
  'retailer', 'purchaseDate', 'purchasePrice', 'streetPrice', 'acquired', 'giftFrom',
  'stock', 'street'
];
// The Removals tab is the journal: bottles going out (dir "out") and coming in (dir "in").
var REMOVAL_COLS = ['id', 'wineId', 'date', 'type', 'occasion', 'people', 'food', 'note', 'wineName', 'hearts',
  'dir', 'qty', 'loc', 'price', 'priceCur', 'retailer'];
var LOCATION_COLS = ['name'];
var RETAILER_COLS = ['name', 'website'];
var CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'];

// Raise this when columns are added. The script then upgrades the sheet by itself on the next request.
var SCHEMA_VERSION = '5';

var DEFAULT_MODEL = 'claude-sonnet-5-5';
var PRICE_MODEL = 'claude-haiku-5-5';

var ACTIONS = {
  ping: function () { return { pong: true, version: API_VERSION }; },
  load: actionLoad_,
  saveWine: actionSaveWine_,
  update: actionUpdate_,
  adjust: actionAdjust_,
  removeBottle: actionRemoveBottle_,
  addBottles: actionAddBottles_,
  saveEntry: actionSaveEntry_,
  updateRemoval: function (req) { return actionSaveEntry_({ entry: Object.assign({ id: req.id }, req.fields || {}) }); },
  deleteWine: actionDeleteWine_,
  deleteRemoval: actionDeleteRemoval_,
  image: actionImage_,
  analyze: actionAnalyze_,
  streetPrice: actionStreetPrice_,
  addLocation: actionAddLocation_,
  deleteLocation: actionDeleteLocation_,
  moveLocation: actionMoveLocation_,
  saveRetailer: actionSaveRetailer_,
  setSettings: actionSetSettings_
};

// ---------------------------------------------------------------- setup

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var p = props_();
  p.setProperty('SHEET_ID', ss.getId());

  p.deleteProperty('SCHEMA_VERSION');
  ensureSchema_();

  labelFolder_();

  var token = p.getProperty('APP_TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
    p.setProperty('APP_TOKEN', token);
  }

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'monthlyDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('monthlyDigest').timeBased().onMonthDay(1).atHour(8).create();

  Logger.log('Setup complete.');
  Logger.log('APP TOKEN: ' + token);
  if (!p.getProperty('ANTHROPIC_API_KEY')) Logger.log('Next: add the script property ANTHROPIC_API_KEY (see the guide, step 3).');
}

function ensureSheet_(ss, name, cols) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else {
    var head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
    cols.forEach(function (c) {
      if (head.indexOf(c) < 0) sh.getRange(1, sh.getLastColumn() + 1).setValue(c).setFontWeight('bold');
    });
  }
  return sh;
}

/** Adds missing tabs and columns and migrates older data. Never deletes data. Runs once per schema version. */
function ensureSchema_() {
  var p = props_();
  if (p.getProperty('SCHEMA_VERSION') === SCHEMA_VERSION) return;
  withLock_(function () {
    if (p.getProperty('SCHEMA_VERSION') === SCHEMA_VERSION) return;
    var ss = ss_();
    textColumn_(ensureSheet_(ss, SHEETS.wines, WINE_COLS), 'purchaseDate');
    textColumn_(ensureSheet_(ss, SHEETS.removals, REMOVAL_COLS), 'date');
    ensureSheet_(ss, SHEETS.locations, LOCATION_COLS);
    ensureSheet_(ss, SHEETS.retailers, RETAILER_COLS);
    migrate5_();
    p.setProperty('SCHEMA_VERSION', SCHEMA_VERSION);
  });
}

function textColumn_(sh, name) {
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var col = head.indexOf(name) + 1;
  if (col > 0) sh.getRange(1, col, sh.getMaxRows(), 1).setNumberFormat('@');
}

/**
 * Version 5 keeps stock per location and records purchases and gifts in the journal.
 * Older wines get their stock and a purchase or gift entry built from the existing columns.
 */
function migrate5_() {
  var cur = settings_().currency;
  var wt = table_(SHEETS.wines);
  var rt = table_(SHEETS.removals);
  var entries = rt.rows.map(function (r) { return toObj_(rt.headers, r); });
  var dirCol = rt.headers.indexOf('dir'), qtyCol = rt.headers.indexOf('qty');
  entries.forEach(function (e, i) {
    if (!e.dir) {
      rt.sh.getRange(i + 2, dirCol + 1).setValue('out');
      rt.sh.getRange(i + 2, qtyCol + 1).setValue(1);
      e.dir = 'out';
    }
  });
  var hasIn = {};
  entries.forEach(function (e) { if (e.dir === 'in') hasIn[e.wineId] = true; });
  var retailers = {};
  readAll_(SHEETS.retailers).forEach(function (r) { retailers[String(r.name).toLowerCase()] = true; });
  var newEntries = [], newRetailers = [];

  wt.rows.forEach(function (row, i) {
    var w = toObj_(wt.headers, row);
    if (!w.id) return;
    var changed = false;
    if (w.stock === '' || w.stock === undefined) {
      var n = Number(w.count) || 0;
      var stock = n > 0 ? [{ loc: String(w.location || ''), shelf: w.shelf === '' ? null : Number(w.shelf), pos: String(w.position || ''), n: n }] : [];
      w.stock = JSON.stringify(stock);
      changed = true;
    }
    if ((w.street === '' || w.street === undefined) && w.streetPrice !== '' && w.streetPrice !== undefined) {
      w.street = JSON.stringify({ v: Number(w.streetPrice), cur: cur, date: '' });
      changed = true;
    }
    var gift = w.acquired === 'Gift';
    if (!hasIn[w.id] && (gift || w.retailer || w.purchaseDate || (w.purchasePrice !== '' && w.purchasePrice !== undefined))) {
      var outs = entries.filter(function (e) { return e.wineId === w.id && e.dir === 'out'; }).length;
      newEntries.push({
        id: 'm' + w.id, wineId: w.id, date: String(w.purchaseDate || String(w.createdAt || '').slice(0, 10)), dir: 'in',
        type: gift ? 'Received' : 'Purchase', qty: Math.max(1, (Number(w.count) || 0) + outs),
        price: gift ? 0 : (w.purchasePrice === '' ? '' : Number(w.purchasePrice)), priceCur: cur,
        retailer: gift ? '' : String(w.retailer || ''), people: gift ? String(w.giftFrom || '') : '',
        wineName: [w.producer, w.name, w.vintage].filter(String).join(' '), occasion: '', food: '', note: '', hearts: '', loc: ''
      });
    }
    if (w.retailer && !retailers[String(w.retailer).toLowerCase()]) {
      retailers[String(w.retailer).toLowerCase()] = true;
      newRetailers.push([String(w.retailer), '']);
    }
    if (changed) writeRow_(wt, i, w);
  });
  newEntries.forEach(function (e) { writeRow_(rt, -1, e); });
  if (newRetailers.length) {
    var sh = sheet_(SHEETS.retailers);
    sh.getRange(sh.getLastRow() + 1, 1, newRetailers.length, 2).setValues(newRetailers);
  }
}

function labelFolder_() {
  var p = props_();
  var id = p.getProperty('LABEL_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* recreate below */ }
  }
  var parents = DriveApp.getFileById(ss_().getId()).getParents();
  var folder = parents.hasNext() ? parents.next().createFolder('Labels') : DriveApp.createFolder('Wine Cellar Labels');
  p.setProperty('LABEL_FOLDER_ID', folder.getId());
  return folder;
}

// ---------------------------------------------------------------- web entry points

function doGet() {
  return json_({ ok: true, service: 'wine-cellar', version: API_VERSION, hint: 'Use POST from the Wine Cellar app.' });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Bad request' });
  }
  var token = props_().getProperty('APP_TOKEN');
  if (!token || !req || req.token !== token) return json_({ ok: false, error: 'Invalid token' });
  var fn = ACTIONS[req.action];
  if (!fn) return json_({ ok: false, error: 'Unknown action: ' + req.action });
  try {
    ensureSchema_();
    return json_({ ok: true, data: fn(req) });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------- settings and exchange rates

function settings_() {
  var c = props_().getProperty('CURRENCY');
  return { currency: CURRENCIES.indexOf(c) >= 0 ? c : 'CHF' };
}

function actionSetSettings_(req) {
  var s = req.settings || {};
  if (s.currency !== undefined) {
    if (CURRENCIES.indexOf(String(s.currency)) < 0) throw new Error('Unsupported currency');
    props_().setProperty('CURRENCY', String(s.currency));
  }
  return settings_();
}

/** Exchange rates with CHF as base (1 CHF = rates[X] X). From Google Finance, cached for 12 hours. */
function fxRates_() {
  var p = props_();
  var cached = p.getProperty('FX_JSON');
  var c = cached ? JSON.parse(cached) : null;
  if (c && Date.now() - c.t < 12 * 3600 * 1000) return c;
  var rates = null, source = '';
  try { rates = fxFromSheet_(); source = 'Google Finance'; } catch (e) { rates = null; }
  if (!rates) {
    try { rates = fxFromWeb_(); source = 'European Central Bank'; } catch (e) { rates = null; }
  }
  if (rates) {
    var out = { base: 'CHF', rates: rates, t: Date.now(), source: source, date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') };
    p.setProperty('FX_JSON', JSON.stringify(out));
    return out;
  }
  return c || { base: 'CHF', rates: { CHF: 1 }, t: 0, source: '', date: '' };
}

function fxFromSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEETS.fx);
  if (!sh) { sh = ss.insertSheet(SHEETS.fx); sh.hideSheet(); }
  var others = CURRENCIES.filter(function (x) { return x !== 'CHF'; });
  sh.getRange(1, 1, others.length, 2).setValues(others.map(function (x) { return [x, '=GOOGLEFINANCE("CURRENCY:CHF' + x + '")']; }));
  SpreadsheetApp.flush();
  var vals = sh.getRange(1, 2, others.length, 1).getValues();
  var rates = { CHF: 1 };
  for (var i = 0; i < others.length; i++) {
    var v = Number(vals[i][0]);
    if (!(v > 0)) return null;
    rates[others[i]] = v;
  }
  return rates;
}

function fxFromWeb_() {
  var others = CURRENCIES.filter(function (x) { return x !== 'CHF'; });
  var r = UrlFetchApp.fetch('https://api.frankfurter.app/latest?from=CHF&to=' + others.join(','), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  var d = JSON.parse(r.getContentText());
  var rates = { CHF: 1 };
  others.forEach(function (x) { rates[x] = Number(d.rates[x]); });
  return rates;
}

// ---------------------------------------------------------------- stock helpers

function parseStock_(s) {
  if (Array.isArray(s)) return s;
  try { var a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}

function setStock_(obj, stock) {
  var clean = parseStock_(stock).map(function (e) {
    return { loc: String(e.loc || ''), shelf: e.shelf === '' || e.shelf === null || e.shelf === undefined ? null : Number(e.shelf), pos: String(e.pos || ''), n: Math.max(0, Math.round(Number(e.n) || 0)) };
  }).filter(function (e) { return e.n > 0; });
  obj.stock = JSON.stringify(clean);
  obj.count = clean.reduce(function (a, e) { return a + e.n; }, 0);
  if (clean.length) {
    obj.location = clean[0].loc;
    obj.shelf = clean[0].shelf === null ? '' : clean[0].shelf;
    obj.position = clean[0].pos;
  }
  return obj;
}

/** Changes the stock at one location. Returns the location actually used. */
function changeStock_(obj, loc, delta) {
  var st = parseStock_(obj.stock);
  var key = String(loc || '').toLowerCase();
  var e = st.filter(function (x) { return String(x.loc).toLowerCase() === key && key; })[0];
  if (!e && delta < 0) e = st.filter(function (x) { return Number(x.n) > 0; })[0];
  if (!e && delta > 0) { e = { loc: String(loc || obj.location || ''), shelf: null, pos: '', n: 0 }; st.push(e); }
  if (!e) throw new Error('No bottles in stock');
  if (delta < 0 && Number(e.n) < -delta) throw new Error('Not enough bottles at ' + e.loc);
  e.n = Number(e.n) + delta;
  setStock_(obj, st);
  return e.loc;
}

// ---------------------------------------------------------------- actions

function actionLoad_() {
  return {
    version: API_VERSION,
    wines: readAll_(SHEETS.wines),
    removals: readAll_(SHEETS.removals),
    locations: readAll_(SHEETS.locations).map(function (r) { return String(r.name); }).filter(String),
    retailers: readAll_(SHEETS.retailers).filter(function (r) { return r.name; }),
    settings: settings_(),
    fx: fxRates_()
  };
}

function actionSaveWine_(req) {
  var wine = req.wine || {};
  if (!wine.id) throw new Error('Missing wine id');
  return withLock_(function () {
    var t = table_(SHEETS.wines);
    var idx = findIndex_(t, wine.id);
    var existing = idx >= 0 ? toObj_(t.headers, t.rows[idx]) : null;
    var now = new Date().toISOString();

    if (req.image) {
      var folder = labelFolder_();
      var blob = Utilities.newBlob(Utilities.base64Decode(req.image), 'image/jpeg', 'label-' + wine.id + '.jpg');
      var file = folder.createFile(blob);
      if (existing && existing.labelFileId) {
        try { DriveApp.getFileById(existing.labelFileId).setTrashed(true); } catch (e) { /* ignore */ }
      }
      wine.labelFileId = file.getId();
    } else if (existing && !wine.labelFileId) {
      wine.labelFileId = existing.labelFileId;
    }
    if (wine.thumb && String(wine.thumb).length > 49000) wine.thumb = existing ? existing.thumb : '';

    var merged = {};
    WINE_COLS.forEach(function (c) { merged[c] = existing ? existing[c] : ''; });
    Object.keys(wine).forEach(function (k) { if (k !== 'stock' && k !== 'street') merged[k] = wine[k]; });
    if (wine.stock !== undefined) setStock_(merged, wine.stock);
    if (wine.street !== undefined) merged.street = typeof wine.street === 'string' ? wine.street : JSON.stringify(wine.street || '');
    merged.createdAt = existing && existing.createdAt ? existing.createdAt : now;
    merged.updatedAt = now;
    if (merged.count === '' || merged.count === null || merged.count === undefined) merged.count = 0;
    writeRow_(t, idx, merged);

    var saved = [];
    (req.entries || []).forEach(function (e) { saved.push(saveEntryRow_(Object.assign({}, e, { wineId: merged.id }))); });
    return { wine: merged, entries: saved };
  });
}

function actionUpdate_(req) {
  if (!req.id) throw new Error('Missing wine id');
  return withLock_(function () {
    var t = table_(SHEETS.wines);
    var idx = findIndex_(t, req.id);
    if (idx < 0) throw new Error('Wine not found');
    var obj = toObj_(t.headers, t.rows[idx]);
    var fields = req.fields || {};
    Object.keys(fields).forEach(function (k) {
      if (k === 'stock') setStock_(obj, fields.stock);
      else if (k === 'street') obj.street = typeof fields.street === 'string' ? fields.street : JSON.stringify(fields.street || '');
      else if (k !== 'id' && k !== 'createdAt') obj[k] = fields[k];
    });
    obj.updatedAt = new Date().toISOString();
    writeRow_(t, idx, obj);
    return obj;
  });
}

function actionAdjust_(req) {
  if (!req.id) throw new Error('Missing wine id');
  return withLock_(function () {
    var t = table_(SHEETS.wines);
    var idx = findIndex_(t, req.id);
    if (idx < 0) throw new Error('Wine not found');
    var obj = toObj_(t.headers, t.rows[idx]);
    changeStock_(obj, req.loc, Number(req.delta) || 0);
    obj.updatedAt = new Date().toISOString();
    writeRow_(t, idx, obj);
    return obj;
  });
}

function actionRemoveBottle_(req) {
  var r = req.removal || {};
  if (!r.wineId) throw new Error('Missing wine id');
  return withLock_(function () {
    var t = table_(SHEETS.wines);
    var idx = findIndex_(t, r.wineId);
    if (idx < 0) throw new Error('Wine not found');
    var obj = toObj_(t.headers, t.rows[idx]);
    var qty = Math.max(1, Number(r.qty) || 1);
    r.loc = changeStock_(obj, r.loc, -qty);
    obj.updatedAt = new Date().toISOString();
    writeRow_(t, idx, obj);
    var removal = saveEntryRow_(Object.assign({}, r, { dir: 'out', qty: qty }));
    return { wine: obj, removal: removal };
  });
}

function actionAddBottles_(req) {
  var e = req.entry || {};
  if (!e.wineId) throw new Error('Missing wine id');
  return withLock_(function () {
    var t = table_(SHEETS.wines);
    var idx = findIndex_(t, e.wineId);
    if (idx < 0) throw new Error('Wine not found');
    var obj = toObj_(t.headers, t.rows[idx]);
    var qty = Math.max(1, Number(e.qty) || 1);
    e.loc = changeStock_(obj, e.loc, qty);
    obj.updatedAt = new Date().toISOString();
    writeRow_(t, idx, obj);
    var entry = saveEntryRow_(Object.assign({}, e, { dir: 'in', qty: qty }));
    return { wine: obj, entry: entry };
  });
}

/** Creates or updates a journal entry without changing the stock. */
function actionSaveEntry_(req) {
  return withLock_(function () { return saveEntryRow_(req.entry || {}); });
}

function saveEntryRow_(e) {
  var t = table_(SHEETS.removals);
  var idx = e.id ? findIndex_(t, e.id) : -1;
  var obj = {};
  REMOVAL_COLS.forEach(function (c) { obj[c] = ''; });
  if (idx >= 0) obj = toObj_(t.headers, t.rows[idx]);
  Object.keys(e).forEach(function (k) {
    if (REMOVAL_COLS.indexOf(k) >= 0 && e[k] !== undefined && e[k] !== null) obj[k] = e[k];
  });
  if (!obj.id) obj.id = (obj.dir === 'in' ? 'i' : 'r') + new Date().getTime().toString(36) + Math.floor(Math.random() * 1000);
  if (!obj.date) obj.date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (!obj.dir) obj.dir = 'out';
  if (!obj.qty) obj.qty = 1;
  if (obj.retailer) ensureRetailer_(obj.retailer);
  writeRow_(t, idx, obj);
  return obj;
}

function actionDeleteWine_(req) {
  return withLock_(function () {
    var t = table_(SHEETS.wines);
    var idx = findIndex_(t, req.id);
    if (idx < 0) return { deleted: false };
    var obj = toObj_(t.headers, t.rows[idx]);
    if (obj.labelFileId) {
      try { DriveApp.getFileById(obj.labelFileId).setTrashed(true); } catch (e) { /* ignore */ }
    }
    t.sh.deleteRow(idx + 2);
    return { deleted: true };
  });
}

function actionDeleteRemoval_(req) {
  return withLock_(function () {
    var t = table_(SHEETS.removals);
    var idx = findIndex_(t, req.id);
    if (idx < 0) return { deleted: false };
    t.sh.deleteRow(idx + 2);
    return { deleted: true };
  });
}

function actionImage_(req) {
  if (!req.fileId) throw new Error('Missing file id');
  var blob = DriveApp.getFileById(req.fileId).getBlob();
  return { mime: blob.getContentType() || 'image/jpeg', data: Utilities.base64Encode(blob.getBytes()) };
}

// ---------------------------------------------------------------- locations and retailers

function actionAddLocation_(req) {
  var name = String(req.name || '').trim();
  if (!name) throw new Error('Missing location name');
  return withLock_(function () {
    var list = readAll_(SHEETS.locations).map(function (r) { return String(r.name); });
    if (list.indexOf(name) < 0) {
      sheet_(SHEETS.locations).appendRow([name]);
      list.push(name);
    }
    return list.filter(String);
  });
}

function bottlesAt_(name) {
  var key = name.toLowerCase();
  return readAll_(SHEETS.wines).reduce(function (a, w) {
    return a + parseStock_(w.stock).filter(function (e) { return String(e.loc).toLowerCase() === key; })
      .reduce(function (b, e) { return b + (Number(e.n) || 0); }, 0);
  }, 0);
}

function actionDeleteLocation_(req) {
  var name = String(req.name || '').trim();
  if (!name) throw new Error('Missing location name');
  return withLock_(function () {
    if (bottlesAt_(name) > 0) throw new Error('This location still has bottles in stock');
    var sh = sheet_(SHEETS.locations);
    var vals = sh.getDataRange().getValues();
    for (var i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][0]) === name) sh.deleteRow(i + 1);
    }
    return readAll_(SHEETS.locations).map(function (r) { return String(r.name); }).filter(String);
  });
}

function actionMoveLocation_(req) {
  var from = String(req.from || '').trim(), to = String(req.to || '').trim();
  if (!from || !to) throw new Error('Missing location');
  return withLock_(function () {
    var t = table_(SHEETS.wines);
    var moved = 0;
    t.rows.forEach(function (row, i) {
      var w = toObj_(t.headers, row);
      var st = parseStock_(w.stock);
      var src = st.filter(function (e) { return String(e.loc).toLowerCase() === from.toLowerCase(); });
      var legacy = String(w.location).toLowerCase() === from.toLowerCase();
      if (!src.length && !legacy) return;
      src.forEach(function (e) {
        var dst = st.filter(function (x) { return String(x.loc).toLowerCase() === to.toLowerCase(); })[0];
        if (dst) { dst.n = Number(dst.n) + Number(e.n); e.n = 0; } else { e.loc = to; e.shelf = null; e.pos = ''; }
      });
      setStock_(w, st);
      if (String(w.location).toLowerCase() === from.toLowerCase()) w.location = to;
      writeRow_(t, i, w);
      moved++;
    });
    return { moved: moved };
  });
}

function ensureRetailer_(name) {
  var n = String(name || '').trim();
  if (!n) return;
  var exists = readAll_(SHEETS.retailers).some(function (r) { return String(r.name).toLowerCase() === n.toLowerCase(); });
  if (!exists) sheet_(SHEETS.retailers).appendRow([n, '']);
}

function actionSaveRetailer_(req) {
  var name = String(req.name || '').trim();
  if (!name) throw new Error('Missing retailer name');
  return withLock_(function () {
    var t = table_(SHEETS.retailers);
    var col = t.headers.indexOf('name');
    var idx = -1;
    t.rows.forEach(function (r, i) { if (String(r[col]).toLowerCase() === name.toLowerCase()) idx = i; });
    writeRow_(t, idx, { name: name, website: String(req.website || '').trim() });
    return readAll_(SHEETS.retailers).filter(function (r) { return r.name; });
  });
}

// ---------------------------------------------------------------- Claude: label analysis and street prices

var ANALYZE_PROMPT = [
  'You are an experienced sommelier. Read the wine label in this photo and return ONLY a JSON object, no other text, with these keys:',
  '"producer": the winery or producer,',
  '"name": the wine or cuvee name without producer and vintage (use the appellation if there is no separate name),',
  '"vintage": the year as a number, or null for non-vintage,',
  '"type": exactly one of "Red", "White", "Rosé", "Sparkling", "Dessert", "Fortified",',
  '"region": region and country, for example "Piedmont, Italy",',
  '"grapes": grape varieties with shares if known, for example "Nebbiolo 100%" or "Merlot 70%, Cabernet Franc 30%" (use your knowledge if the label does not say),',
  '"taste": two or three sentences in English on style and aromas, including whether it is delicate, elegant, full-bodied or highly structured,',
  '"tasteTags": an array of exactly three short style tags, for example ["elegant", "medium body", "fresh acidity"],',
  '"pairings": an array of four to six dishes it pairs well with,',
  '"drinkFrom", "peakFrom", "peakUntil", "drinkUntil": years as numbers, your best estimate of the drinking window and peak for this wine and vintage.',
  'Use null for anything you cannot determine. Do not include ratings, scores or prices.'
].join('\n');

function actionAnalyze_(req) {
  var hints = req.hints || {};
  var known = Object.keys(hints).filter(function (k) { return hints[k] !== '' && hints[k] !== null && hints[k] !== undefined; });
  if (!req.image && !known.length) throw new Error('Add a label photo or enter at least the producer or wine name');
  var prompt = ANALYZE_PROMPT;
  if (!req.image) prompt = prompt.replace('Read the wine label in this photo and return', 'There is no photo. Based on the details below, return');
  if (known.length) {
    prompt += '\n\nThe owner confirmed these details. Treat them as correct, keep them unchanged in your answer, and base everything else on them, especially the drinking window for this exact vintage:\n' +
      known.map(function (k) { return k + ': ' + hints[k]; }).join('\n');
  }
  var content = [];
  if (req.image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: req.image } });
  content.push({ type: 'text', text: prompt });
  var text = textOf_(callClaude_({ model: props_().getProperty('CLAUDE_MODEL') || DEFAULT_MODEL, max_tokens: 1500, messages: [{ role: 'user', content: content }] }));
  return parseJson_(text, 'The AI returned no wine data');
}

function actionStreetPrice_(req) {
  if (!req.id) throw new Error('Missing wine id');
  var t = table_(SHEETS.wines);
  var idx = findIndex_(t, req.id);
  if (idx < 0) throw new Error('Wine not found');
  var w = toObj_(t.headers, t.rows[idx]);
  var cur = settings_().currency;
  var wine = [w.producer, w.name, w.vintage].filter(String).join(' ');
  var prompt = 'Find the current typical retail price for one 0.75 l bottle of this wine: ' + wine +
    (w.region ? ' (' + w.region + ')' : '') + '. Search the web for current shop offers, preferably from shops in Switzerland or elsewhere in Europe. ' +
    'Use the median of the offers you find for exactly this vintage. If there is no offer for this vintage, use the closest vintage and set confidence to "low". ' +
    'Prefer prices in ' + cur + '. Return ONLY a JSON object, no other text: {"price": number per bottle, "currency": one of "CHF", "EUR", "USD", "GBP", "source": "shop or website name", "confidence": "high" or "medium" or "low"}. ' +
    'If you find no price at all, return {"price": null}.';
  var res = callClaude_({
    model: props_().getProperty('PRICE_MODEL') || PRICE_MODEL,
    max_tokens: 2000,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    messages: [{ role: 'user', content: prompt }]
  });
  var d = parseJson_(textOf_(res), 'No street price found');
  if (d.price === null || d.price === undefined || !(Number(d.price) > 0)) throw new Error('No street price found for this wine');
  var c = CURRENCIES.indexOf(String(d.currency)) >= 0 ? String(d.currency) : cur;
  var street = { v: Math.round(Number(d.price) * 100) / 100, cur: c, date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'), src: String(d.source || ''), conf: String(d.confidence || '') };
  return withLock_(function () {
    var t2 = table_(SHEETS.wines);
    var i2 = findIndex_(t2, req.id);
    var obj = toObj_(t2.headers, t2.rows[i2]);
    obj.street = JSON.stringify(street);
    obj.updatedAt = new Date().toISOString();
    writeRow_(t2, i2, obj);
    return obj;
  });
}

/**
 * Run this once from the editor after adding ANTHROPIC_API_KEY.
 * The execution log then shows either "Claude API works" or the exact problem.
 */
function testClaude() {
  var answer = textOf_(callClaude_({ model: props_().getProperty('CLAUDE_MODEL') || DEFAULT_MODEL, max_tokens: 10, messages: [{ role: 'user', content: 'Reply with the single word OK.' }] }));
  Logger.log('Claude API works. Answer: ' + answer);
}

function callClaude_(body) {
  var p = props_();
  var key = (p.getProperty('ANTHROPIC_API_KEY') || '').trim();
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set in the script properties');
  var headers = { 'Authorization': 'Bearer ' + key, 'anthropic-version': '2023-06-01' };
  var ws = (p.getProperty('ANTHROPIC_WORKSPACE_ID') || '').trim();
  if (ws) headers['anthropic-workspace-id'] = ws;
  var messages = body.messages.slice();
  var out = null;
  for (var turn = 0; turn < 3; turn++) {
    var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify(Object.assign({}, body, { messages: messages })),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    var txt = res.getContentText();
    if (code !== 200) {
      var msg = txt;
      try { msg = JSON.parse(txt).error.message; } catch (e) { /* keep raw */ }
      if (/workspace/i.test(msg)) msg += ' Create a new key with Workspace set to Default (guide, step 3).';
      else if (code === 401) msg += ' The key is wrong, expired or deleted. Create a new one in the Claude Console.';
      else if (/credit|balance|billing/i.test(msg)) msg += ' Add credit in the Claude Console under Billing.';
      throw new Error('Claude API ' + code + ': ' + msg);
    }
    out = JSON.parse(txt);
    if (out.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: out.content });
  }
  return out;
}

function textOf_(res) {
  return ((res && res.content) || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
}

function parseJson_(text, failMsg) {
  var s = text.lastIndexOf('{"') >= 0 ? text.indexOf('{') : -1;
  var en = text.lastIndexOf('}');
  if (s < 0 || en <= s) throw new Error(failMsg);
  try { return JSON.parse(text.slice(s, en + 1)); } catch (e) {
    var s2 = text.lastIndexOf('{', en);
    while (s2 >= 0) {
      try { return JSON.parse(text.slice(s2, en + 1)); } catch (e2) { s2 = text.lastIndexOf('{', s2 - 1); }
    }
    throw new Error(failMsg);
  }
}

// ---------------------------------------------------------------- monthly digest

function monthlyDigest() {
  var now = new Date();
  var t = now.getFullYear() + now.getMonth() / 12;
  var year = now.getFullYear();
  var wines = readAll_(SHEETS.wines).filter(function (w) { return Number(w.count) > 0; });
  var past = [], soon = [], peakNew = [];
  wines.forEach(function (w) {
    var s = status_(w, t);
    if (s === 'Past peak') past.push(w);
    else if (s === 'Drink soon') soon.push(w);
    else if (s === 'Peak' && Number(w.peakFrom) === year) peakNew.push(w);
  });
  if (!past.length && !soon.length && !peakNew.length) return;

  var line = function (w) {
    var title = [w.producer, w.name, w.vintage].filter(function (x) { return x !== '' && x !== null; }).join(' ');
    var where = parseStock_(w.stock).map(function (e) {
      return e.n + ' at ' + [e.loc, e.shelf ? 'shelf ' + e.shelf : '', e.pos].filter(String).join(', ');
    }).join('; ');
    return '<li><b>' + esc_(title) + '</b>, ' + w.count + ' btl' + (where ? ' (' + esc_(where) + ')' : '') + '</li>';
  };
  var block = function (title, list, note) {
    if (!list.length) return '';
    return '<h3 style="margin:16px 0 4px">' + title + '</h3><p style="margin:0 0 6px;color:#666">' + note + '</p><ul>' + list.map(line).join('') + '</ul>';
  };
  var html = '<div style="font-family:Arial,sans-serif;font-size:14px">' +
    '<p>Here is your monthly drinking window update.</p>' +
    block('Past peak', past, 'Open these first.') +
    block('Drink soon', soon, 'Past their peak, still drinking well.') +
    block('Now at peak', peakNew, 'They entered their peak this year.') +
    '</div>';
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: 'Wine Cellar: ' + (past.length + soon.length) + ' wines to drink soon',
    htmlBody: html
  });
}

function status_(w, t) {
  var num = function (v) { return v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v); };
  var df = num(w.drinkFrom), pf = num(w.peakFrom), pt = num(w.peakUntil), du = num(w.drinkUntil);
  var f = df !== null ? df : (pf !== null ? pf : null);
  var u = du !== null ? du : (pt !== null ? pt : null);
  if (f === null && u === null) return 'No window';
  if (f === null) f = u - 3;
  if (u === null) u = f + 5;
  pf = pf !== null ? Math.min(Math.max(pf, f), u) : f;
  pt = pt !== null ? Math.min(Math.max(pt, pf), u) : u;
  if (t < f) return 'Too young';
  if (t < pf) return 'Ready';
  if (t < pt + 1) return 'Peak';
  if (t < u + 1) return 'Drink soon';
  return 'Past peak';
}

// ---------------------------------------------------------------- sheet helpers

function props_() { return PropertiesService.getScriptProperties(); }

function ss_() {
  var id = props_().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" is missing. Run setup in the script editor.');
  return sh;
}

function table_(name) {
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  var headers = (values[0] || []).map(String);
  return { sh: sh, headers: headers, rows: values.slice(1) };
}

function readAll_(name) {
  var t = table_(name);
  return t.rows
    .filter(function (r) { return r.some(function (v) { return v !== ''; }); })
    .map(function (r) { return toObj_(t.headers, r); });
}

function toObj_(headers, row) {
  var o = {};
  headers.forEach(function (h, i) {
    if (!h) return;
    var v = row[i];
    if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    o[h] = v;
  });
  return o;
}

function findIndex_(t, id) {
  var col = t.headers.indexOf('id');
  if (col < 0 || !id) return -1;
  for (var i = 0; i < t.rows.length; i++) {
    if (String(t.rows[i][col]) === String(id)) return i;
  }
  return -1;
}

function writeRow_(t, idx, obj) {
  var row = t.headers.map(function (h) {
    var v = obj[h];
    if (v === undefined || v === null) return '';
    if (typeof v === 'string' && /^[=+@]/.test(v)) return "'" + v;
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  });
  if (idx >= 0) {
    t.sh.getRange(idx + 2, 1, 1, row.length).setValues([row]);
    t.rows[idx] = row;
  } else {
    t.sh.appendRow(row);
    t.rows.push(row);
  }
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function esc_(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}
