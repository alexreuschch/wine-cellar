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

var API_VERSION = 13;
var SHEETS = { wines: 'Wines', removals: 'Removals', locations: 'Locations', retailers: 'Retailers', people: 'People', wishlist: 'Wishlist', offers: 'Offers', history: 'History', fx: 'FX' };

var WINE_COLS = [
  'id', 'producer', 'name', 'vintage', 'type', 'region', 'grapes', 'taste', 'tasteTags', 'pairings',
  'drinkFrom', 'peakFrom', 'peakUntil', 'drinkUntil', 'location', 'shelf', 'position', 'count',
  'myRating', 'ratings', 'labelFileId', 'thumb', 'createdAt', 'updatedAt',
  'retailer', 'purchaseDate', 'purchasePrice', 'streetPrice', 'acquired', 'giftFrom',
  'stock', 'street', 'offer'
];
// The Removals tab is the journal: bottles going out (dir "out") and coming in (dir "in").
var REMOVAL_COLS = ['id', 'wineId', 'date', 'type', 'occasion', 'people', 'food', 'note', 'wineName', 'hearts',
  'dir', 'qty', 'loc', 'price', 'priceCur', 'retailer'];
var LOCATION_COLS = ['name', 'shelves'];
var RETAILER_COLS = ['name', 'website'];
var PEOPLE_COLS = ['name'];
var OFFER_COLS = ['key', 'offer', 'date'];
var HISTORY_COLS = ['month', 'bottles', 'cost', 'street', 'cur', 'date'];
var WISH_COLS = ['id', 'producer', 'name', 'vintage', 'type', 'region', 'grapes', 'price', 'priceCur', 'label', 'why', 'value', 'qty', 'replaces', 'offer', 'createdAt'];
var CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'];

// Raise this when columns are added. The script then upgrades the sheet by itself on the next request.
var SCHEMA_VERSION = '11';

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
  bestOffer: actionBestOffer_,
  sommelier: actionSommelier_,
  consultant: actionConsultant_,
  offerFor: actionOfferFor_,
  saveWish: actionSaveWish_,
  deleteWish: actionDeleteWish_,
  snapshot: actionSnapshot_,
  addLocation: actionAddLocation_,
  deleteLocation: actionDeleteLocation_,
  moveLocation: actionMoveLocation_,
  saveRetailer: actionSaveRetailer_,
  deleteRetailer: actionDeleteRetailer_,
  renameRetailer: actionRenameRetailer_,
  renameLocation: actionRenameLocation_,
  setShelfNames: actionSetShelfNames_,
  savePerson: actionSavePerson_,
  deletePerson: actionDeletePerson_,
  renamePerson: actionRenamePerson_,
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
    ensureSheet_(ss, SHEETS.people, PEOPLE_COLS);
    ensureSheet_(ss, SHEETS.wishlist, WISH_COLS);
    var oc = ensureSheet_(ss, SHEETS.offers, OFFER_COLS);
    if (!oc.isSheetHidden()) oc.hideSheet();
    var hc = ensureSheet_(ss, SHEETS.history, HISTORY_COLS);
    if (!hc.isSheetHidden()) hc.hideSheet();
    var prev = Number(p.getProperty('SCHEMA_VERSION') || 0);
    if (prev < 5) migrate5_();
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
  } finally {
    try { recordUsage_(req.action); } catch (e) { /* usage is only informative */ }
  }
}

// ---------------------------------------------------------------- AI usage and estimated costs

var USAGE_ = [];
var USAGE_KIND = { analyze: 'Label details', streetPrice: 'Street prices', bestOffer: 'Best offer', offerFor: 'Best offer', sommelier: 'Sommelier', consultant: 'Consultant' };
// estimated list prices in USD per million tokens, and per web search; the Claude Console shows the exact amounts
var USAGE_RATES = { haiku: { inp: 1, out: 5 }, sonnet: { inp: 3, out: 15 }, opus: { inp: 5, out: 25 } };
var SEARCH_USD = 0.01;

function noteUsage_(model, usage) {
  if (usage) USAGE_.push({ model: String(model || ''), u: usage });
}

/** Adds the AI usage of this request to the monthly totals in the script properties. */
function recordUsage_(action) {
  if (!USAGE_.length) return;
  var kind = USAGE_KIND[action] || 'Other';
  var month = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  var add = { calls: 1, inp: 0, out: 0, searches: 0, usd: 0 };
  USAGE_.forEach(function (x) {
    var r = /haiku/i.test(x.model) ? USAGE_RATES.haiku : /opus/i.test(x.model) ? USAGE_RATES.opus : USAGE_RATES.sonnet;
    var inp = (Number(x.u.input_tokens) || 0) + (Number(x.u.cache_creation_input_tokens) || 0) * 1.25 + (Number(x.u.cache_read_input_tokens) || 0) * 0.1;
    var out = Number(x.u.output_tokens) || 0;
    var se = x.u.server_tool_use ? Number(x.u.server_tool_use.web_search_requests) || 0 : 0;
    add.inp += inp; add.out += out; add.searches += se;
    add.usd += inp / 1e6 * r.inp + out / 1e6 * r.out + se * SEARCH_USD;
  });
  USAGE_ = [];
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var p = props_();
    var key = 'USAGE_' + month;
    var m = JSON.parse(p.getProperty(key) || '{}');
    var e = m[kind] || { calls: 0, inp: 0, out: 0, searches: 0, usd: 0 };
    Object.keys(add).forEach(function (k) { e[k] = (Number(e[k]) || 0) + add[k]; });
    e.usd = Math.round(e.usd * 10000) / 10000;
    e.inp = Math.round(e.inp);
    m[kind] = e;
    p.setProperty(key, JSON.stringify(m));
  } finally { lock.releaseLock(); }
}

/** Usage of the last three months, newest first. */
function usageSummary_() {
  var p = props_();
  var out = [];
  var d = new Date();
  for (var i = 0; i < 3; i++) {
    var dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    var month = Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM');
    var m = JSON.parse(p.getProperty('USAGE_' + month) || '{}');
    out.push({ month: month, kinds: m });
  }
  return out;
}

/** Stores the value of the cellar for the current month, as calculated by the app. */
function actionSnapshot_(req) {
  var s = req.snapshot || {};
  var month = String(s.month || '');
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Bad month');
  return withLock_(function () {
    var t = table_(SHEETS.history);
    var mc = t.headers.indexOf('month');
    var idx = -1;
    t.rows.forEach(function (r, i) { if (String(r[mc]) === month) idx = i; });
    writeRow_(t, idx, { month: "'" + month, bottles: Number(s.bottles) || 0, cost: Number(s.cost) || 0, street: Number(s.street) || 0, cur: String(s.cur || ''), date: new Date().toISOString() });
    return readAll_(SHEETS.history).filter(function (r) { return r.month; });
  });
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

/** A storage place is location + shelf + position. Bottles of one wine can lie in several places, also within one location. */
function placeKey_(e) {
  var shelf = e.shelf === '' || e.shelf === null || e.shelf === undefined ? '' : String(Number(e.shelf));
  return [String(e.loc || '').toLowerCase().trim(), shelf, String(e.pos || '').toLowerCase().trim()].join('|');
}

function setStock_(obj, stock) {
  var merged = [];
  parseStock_(stock).forEach(function (e) {
    var x = { loc: String(e.loc || '').trim(), shelf: e.shelf === '' || e.shelf === null || e.shelf === undefined ? null : Number(e.shelf), pos: String(e.pos || '').trim(), n: Math.max(0, Math.round(Number(e.n) || 0)) };
    var same = merged.filter(function (m) { return placeKey_(m) === placeKey_(x); })[0];
    if (same) same.n += x.n; else merged.push(x);
  });
  var clean = merged.filter(function (e) { return e.n > 0; });
  obj.stock = JSON.stringify(clean);
  obj.count = clean.reduce(function (a, e) { return a + e.n; }, 0);
  if (clean.length) {
    obj.location = clean[0].loc;
    obj.shelf = clean[0].shelf === null ? '' : clean[0].shelf;
    obj.position = clean[0].pos;
  }
  return obj;
}

/**
 * Adds or removes bottles at one place. place is { loc, shelf, pos }.
 * Without shelf and pos (older app versions) the first place at that location is used.
 */
function changeStock_(obj, place, delta) {
  var st = parseStock_(obj.stock);
  var p = typeof place === 'object' && place ? place : { loc: place };
  var exact = p.shelf !== undefined || p.pos !== undefined;
  var key = String(p.loc || '').toLowerCase().trim();
  var e = st.filter(function (x) { return key && (exact ? placeKey_(x) === placeKey_(p) : String(x.loc).toLowerCase().trim() === key); })[0];
  if (!e && delta < 0 && !exact) e = st.filter(function (x) { return Number(x.n) > 0; })[0];
  if (!e && delta > 0) {
    e = { loc: String(p.loc || obj.location || ''), shelf: p.shelf === '' || p.shelf === null || p.shelf === undefined ? null : Number(p.shelf), pos: String(p.pos || ''), n: 0 };
    st.push(e);
  }
  if (!e) throw new Error('No bottles at this place');
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
    locationInfo: readAll_(SHEETS.locations).filter(function (r) { return r.name; }).map(function (r) { return { name: String(r.name), shelves: parseShelves_(r.shelves) }; }),
    retailers: readAll_(SHEETS.retailers).filter(function (r) { return r.name; }),
    people: peopleList_(),
    wishlist: readAll_(SHEETS.wishlist).filter(function (r) { return r.id; }),
    history: readAll_(SHEETS.history).filter(function (r) { return r.month; }),
    usage: usageSummary_(),
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
    changeStock_(obj, placeOf_(req), Number(req.delta) || 0);
    obj.updatedAt = new Date().toISOString();
    writeRow_(t, idx, obj);
    return obj;
  });
}

function placeOf_(x) {
  var p = { loc: x.loc };
  if (x.shelf !== undefined) p.shelf = x.shelf;
  if (x.pos !== undefined) p.pos = x.pos;
  return p;
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
    r.loc = changeStock_(obj, placeOf_(r), -qty);
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
    e.loc = changeStock_(obj, placeOf_(e), qty);
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

// ---------------------------------------------------------------- renaming and people

var lower_ = function (v) { return String(v || '').toLowerCase().trim(); };
var names_ = function (v) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(String); };

/** Applies fn to every row object of a tab and writes back the rows fn reports as changed. */
function updateRows_(name, fn) {
  var t = table_(name);
  var n = 0;
  t.rows.forEach(function (row, i) {
    var o = toObj_(t.headers, row);
    if (fn(o)) { writeRow_(t, i, o); n++; }
  });
  return n;
}

function deleteRowsWhere_(name, col, value) {
  var sh = sheet_(name);
  var vals = sh.getDataRange().getValues();
  var c = vals[0].map(String).indexOf(col);
  for (var i = vals.length - 1; i >= 1; i--) {
    if (lower_(vals[i][c]) === lower_(value)) sh.deleteRow(i + 1);
  }
}

function parseShelves_(v) {
  try { var o = JSON.parse(v || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; }
}

/** Own names for the shelves of one location, for example {"0": "A", "1": "B"}. Empty names fall back to the number. */
function actionSetShelfNames_(req) {
  var name = String(req.name || '').trim();
  if (!name) throw new Error('Missing location name');
  var clean = {};
  Object.keys(req.shelves || {}).forEach(function (k) {
    var v = String(req.shelves[k] || '').trim();
    if (v && /^\d+$/.test(k)) clean[k] = v;
  });
  return withLock_(function () {
    var n = updateRows_(SHEETS.locations, function (o) { if (lower_(o.name) !== lower_(name)) return false; o.shelves = JSON.stringify(clean); return true; });
    if (!n) throw new Error('Location not found');
    return clean;
  });
}

function actionRenameLocation_(req) {
  var from = String(req.from || '').trim(), to = String(req.to || '').trim();
  if (!from || !to) throw new Error('Missing location name');
  return withLock_(function () {
    var list = readAll_(SHEETS.locations).map(function (r) { return String(r.name); });
    if (lower_(from) !== lower_(to) && list.some(function (l) { return lower_(l) === lower_(to); })) throw new Error('This location already exists');
    updateRows_(SHEETS.locations, function (o) { if (lower_(o.name) !== lower_(from)) return false; o.name = to; return true; });
    updateRows_(SHEETS.wines, function (o) {
      var st = parseStock_(o.stock), changed = false;
      st.forEach(function (e) { if (lower_(e.loc) === lower_(from)) { e.loc = to; changed = true; } });
      if (lower_(o.location) === lower_(from)) { o.location = to; changed = true; }
      if (changed) setStock_(o, st);
      return changed;
    });
    updateRows_(SHEETS.removals, function (o) { if (lower_(o.loc) !== lower_(from)) return false; o.loc = to; return true; });
    return readAll_(SHEETS.locations).map(function (r) { return String(r.name); }).filter(String);
  });
}

function actionRenameRetailer_(req) {
  var from = String(req.from || '').trim(), to = String(req.to || '').trim();
  if (!from || !to) throw new Error('Missing retailer name');
  return withLock_(function () {
    var list = readAll_(SHEETS.retailers);
    var old = list.filter(function (r) { return lower_(r.name) === lower_(from); })[0] || { website: '' };
    var target = list.filter(function (r) { return lower_(r.name) === lower_(to) && lower_(r.name) !== lower_(from); })[0];
    var website = req.website !== undefined ? String(req.website || '').trim() : String(old.website || '');
    if (target) {
      deleteRowsWhere_(SHEETS.retailers, 'name', from);
      updateRows_(SHEETS.retailers, function (o) { if (lower_(o.name) !== lower_(to)) return false; if (website) o.website = website; return true; });
    } else {
      updateRows_(SHEETS.retailers, function (o) { if (lower_(o.name) !== lower_(from)) return false; o.name = to; o.website = website; return true; });
    }
    updateRows_(SHEETS.removals, function (o) { if (lower_(o.retailer) !== lower_(from)) return false; o.retailer = to; return true; });
    return readAll_(SHEETS.retailers).filter(function (r) { return r.name; });
  });
}

/** People are kept in their own tab and also collected from the journal. */
function peopleList_() {
  var seen = {}, out = [];
  var add = function (n) { var k = lower_(n); if (k && !seen[k]) { seen[k] = true; out.push(String(n).trim()); } };
  readAll_(SHEETS.people).forEach(function (r) { add(r.name); });
  return out;
}

function actionSavePerson_(req) {
  var name = String(req.name || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) throw new Error('Missing name');
  return withLock_(function () {
    if (!peopleList_().some(function (n) { return lower_(n) === lower_(name); })) sheet_(SHEETS.people).appendRow([name]);
    return peopleList_();
  });
}

function actionDeletePerson_(req) {
  var name = String(req.name || '').trim();
  if (!name) throw new Error('Missing name');
  return withLock_(function () {
    var used = readAll_(SHEETS.removals).some(function (r) { return names_(r.people).some(function (n) { return lower_(n) === lower_(name); }); });
    if (used) throw new Error('This person is used in the journal');
    deleteRowsWhere_(SHEETS.people, 'name', name);
    return peopleList_();
  });
}

function actionRenamePerson_(req) {
  var from = String(req.from || '').trim(), to = String(req.to || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (!from || !to) throw new Error('Missing name');
  return withLock_(function () {
    var swap = function (v) {
      var out = [], changed = false;
      names_(v).forEach(function (n) {
        var x = lower_(n) === lower_(from) ? to : n;
        if (x !== n) changed = true;
        if (!out.some(function (y) { return lower_(y) === lower_(x); })) out.push(x); else changed = true;
      });
      return { v: out.join(', '), changed: changed };
    };
    updateRows_(SHEETS.removals, function (o) {
      var a = swap(o.people), b = swap(o.hearts);
      if (!a.changed && !b.changed) return false;
      o.people = a.v; o.hearts = b.v;
      return true;
    });
    deleteRowsWhere_(SHEETS.people, 'name', from);
    if (!peopleList_().some(function (n) { return lower_(n) === lower_(to); })) sheet_(SHEETS.people).appendRow([to]);
    return peopleList_();
  });
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
      src.forEach(function (e) { e.loc = to; e.shelf = null; e.pos = ''; });
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

/** Deletes a retailer from the list. Only allowed when no journal entry uses it. */
function actionDeleteRetailer_(req) {
  var name = String(req.name || '').trim();
  if (!name) throw new Error('Missing retailer name');
  return withLock_(function () {
    var used = readAll_(SHEETS.removals).some(function (r) { return String(r.retailer || '').toLowerCase().trim() === name.toLowerCase(); });
    if (used) throw new Error('This retailer is used in the journal');
    var sh = sheet_(SHEETS.retailers);
    var vals = sh.getDataRange().getValues();
    var col = vals[0].map(String).indexOf('name');
    for (var i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][col]).toLowerCase().trim() === name.toLowerCase()) sh.deleteRow(i + 1);
    }
    return readAll_(SHEETS.retailers).filter(function (r) { return r.name; });
  });
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
var OFFER_REGIONS = {
  CHF: { area: 'Switzerland', where: 'Switzerland' },
  EUR: { area: 'Euro area', where: 'a country of the euro area, for example Germany, Austria, France, Italy or the Netherlands' },
  GBP: { area: 'United Kingdom', where: 'the United Kingdom' },
  USD: { area: 'United States', where: 'the United States' }
};

/** Finds the online shop in the country of the chosen currency with the lowest price for this wine. */
function actionBestOffer_(req) {
  if (!req.id) throw new Error('Missing wine id');
  var t = table_(SHEETS.wines);
  var idx = findIndex_(t, req.id);
  if (idx < 0) throw new Error('Wine not found');
  var w = toObj_(t.headers, t.rows[idx]);
  var offer = findOffer_([w.producer, w.name, w.vintage].filter(String).join(' '), w.region, !!req.fresh);
  return withLock_(function () {
    var t2 = table_(SHEETS.wines);
    var i2 = findIndex_(t2, req.id);
    var obj = toObj_(t2.headers, t2.rows[i2]);
    obj.offer = JSON.stringify(offer);
    obj.updatedAt = new Date().toISOString();
    writeRow_(t2, i2, obj);
    return obj;
  });
}

/** Request for the cheapest shop offer of one wine in the country of the chosen currency. Another vintage of the same wine is fine if the asked one is not sold. */
function offerRequest_(wine, region, uses) {
  var cur = settings_().currency;
  var reg = OFFER_REGIONS[cur] || OFFER_REGIONS.CHF;
  var prompt = 'Find the online shop based in ' + reg.where + ' that currently sells this wine at the lowest price per 0.75 l bottle: ' + wine +
    (region ? ' (' + region + ')' : '') + '. Search the web for shop offers of this wine. Prefer the vintage given; if no shop sells it, take the closest vintage of the same wine that is available and report it. ' +
    'Only consider shops that sell to customers in ' + reg.where + ' with prices in ' + cur + '. Ignore auctions, marketplaces of private sellers and offers that are sold out. ' +
    'The link must be the product page of this wine at that shop, taken from your search results. Never use a home page, a category page or a search page. ' +
    'Return ONLY a JSON object, no other text: {"shop": "shop name", "price": number per bottle in ' + cur + ', "url": "direct link to the product page", "vintage": "vintage of the offer"}. ' +
    'If you find no offer, return {"shop": null}.';
  return {
    model: props_().getProperty('PRICE_MODEL') || PRICE_MODEL,
    max_tokens: 3000,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: uses || 5 }],
    messages: [{ role: 'user', content: prompt }]
  };
}

/** The offer from a reply, or null when there is no usable offer with a product link. */
function offerFrom_(res) {
  if (!res) return null;
  var d;
  try { d = parseJson_(textOf_(res), 'No offer'); } catch (e) { return null; }
  var url = String(d.url || '');
  if (!d.shop || !(Number(d.price) > 0) || !/^https?:\/\/[^\/]+\/.+/.test(url)) return null;
  var cur = settings_().currency;
  return {
    shop: String(d.shop), v: Math.round(Number(d.price) * 100) / 100, cur: cur, url: url, vintage: String(d.vintage || ''),
    area: (OFFER_REGIONS[cur] || OFFER_REGIONS.CHF).area, date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
  };
}

/** Searches the web for the cheapest shop offer of one wine in the country of the chosen currency.
 *  An offer found in the last 7 days is reused, unless fresh is set (Update best offer). */
function findOffer_(wine, region, fresh) {
  var key = offerKey_(wine);
  var mem = fresh ? null : offerMemory_([key], false)[key];
  var offer = mem ? mem.offer : offerFrom_(callClaude_(offerRequest_(wine, region)));
  if (!mem) rememberOffers_([[key, offer]]);
  if (!offer) throw new Error('No shop in ' + (OFFER_REGIONS[settings_().currency] || OFFER_REGIONS.CHF).area + ' currently sells this wine online');
  return offer;
}

// ---------------------------------------------------------------- offer memory (hidden tab Offers)

var OFFER_DAYS = 7;      // found offers are reused for a week
var NO_OFFER_DAYS = 3;   // wines without a shop are not searched again for the consultant for a few days

function offerKey_(wine) {
  return settings_().currency + '|' + String(wine).toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Remembered results by key. Without allowMissing, only real offers are returned. */
function offerMemory_(keys, allowMissing) {
  var out = {};
  var want = {};
  keys.forEach(function (k) { want[k] = true; });
  var now = Date.now();
  readAll_(SHEETS.offers).forEach(function (r) {
    var k = String(r.key);
    if (!want[k]) return;
    var age = (now - new Date(String(r.date)).getTime()) / 86400000;
    var offer = null;
    try { offer = r.offer ? JSON.parse(r.offer) : null; } catch (e) { offer = null; }
    if (offer && age <= OFFER_DAYS) out[k] = { offer: offer };
    else if (!offer && allowMissing && age <= NO_OFFER_DAYS) out[k] = { offer: null };
  });
  return out;
}

/** Stores results as [key, offer or null] pairs and drops entries older than 30 days. */
function rememberOffers_(pairs) {
  if (!pairs.length) return;
  withLock_(function () {
    var t = table_(SHEETS.offers);
    var kc = t.headers.indexOf('key');
    var now = new Date().toISOString();
    pairs.forEach(function (p) {
      var idx = -1;
      for (var i = 0; i < t.rows.length; i++) { if (String(t.rows[i][kc]) === p[0]) { idx = i; break; } }
      writeRow_(t, idx, { key: p[0], offer: p[1] ? JSON.stringify(p[1]) : '', date: now });
    });
    var dc = t.headers.indexOf('date');
    for (var j = t.rows.length - 1; j >= 0; j--) {
      if (Date.now() - new Date(String(t.rows[j][dc])).getTime() > 30 * 86400000) t.sh.deleteRow(j + 2);
    }
  });
}

// ---------------------------------------------------------------- AI sommelier

var SOMMELIER_RULES = [
  'You are a warm, knowledgeable sommelier who looks after the private wine cellar of the owner.',
  'The owner tells you what they feel like, what they eat or what the occasion is. Recommend wines from the cellar below.',
  'Rules:',
  '1. Pick up to 3 wines that fit best, only from the cellar list, referenced by their id. Fewer is fine.',
  '2. When wines fit equally well, prefer those at their peak or to drink soon, and those the owner rated highly or marked as a favorite.',
  '3. Use the journal to understand the taste of the owner and the people mentioned.',
  '4. If nothing in the cellar fits well, say so honestly and suggest in "buy" what style or wine to buy instead. Otherwise leave "buy" empty.',
  '5. Answer in the language of the question. Keep "answer" to two to four sentences and each "why" to one sentence. Do not use dashes as punctuation.',
  '6. Return ONLY a JSON object, no other text: {"answer": "text", "picks": [{"id": "wine id", "why": "one sentence"}], "buy": "text or empty", "wine": "", "fit": null}.',
  '7. If the owner sends a photo of a wine label, for example in a shop or restaurant: identify the wine and put producer, name and vintage in "wine". Judge how well it fits the taste of the owner, based on their ratings, favorites and journal, as "fit" from 0 to 100. In "answer" explain the fit, the style and whether the typical price is good value. As "picks", give up to 3 similar wines from the cellar for comparison, and say in "why" how each compares. Leave "buy" empty. Without a photo, keep "wine" empty and "fit" null.'
].join('\n');

/** One compact line per wine in stock, plus recent journal entries, as context for the sommelier. */
function cellarContext_() {
  var now = new Date();
  var t = now.getFullYear() + now.getMonth() / 12;
  var shelves = {};
  readAll_(SHEETS.locations).forEach(function (l) { if (l.name) shelves[String(l.name).toLowerCase()] = parseShelves_(l.shelves); });
  var shelfName = function (loc, n) { var m = shelves[String(loc).toLowerCase()] || {}; return m[String(n)] || ('shelf ' + n); };
  var all = readAll_(SHEETS.wines).filter(function (w) { return w.id; });
  var bottles = function (w) { var n = parseStock_(w.stock).reduce(function (a, e) { return a + (Number(e.n) || 0); }, 0); return n || Number(w.count) || 0; };
  var wines = all.filter(function (w) { return bottles(w) > 0; });
  var streetText = function (w) {
    try { var st = JSON.parse(w.street || ''); return st && Number(st.v) > 0 ? 'street price ' + Number(st.v).toFixed(2) + ' ' + st.cur + ' per bottle' : ''; } catch (e) { return ''; }
  };
  var lines = wines.map(function (w) {
    var ratings = [];
    try { (JSON.parse(w.ratings || '[]') || []).forEach(function (r) { ratings.push(r.sys + ' ' + r.score); }); } catch (e) { /* ignore */ }
    if (w.myRating !== '' && w.myRating !== null && w.myRating !== undefined) ratings.unshift('my rating ' + w.myRating + '%');
    var where = parseStock_(w.stock).map(function (e) { return e.n + ' in ' + [e.loc, e.shelf === null || e.shelf === '' ? '' : shelfName(e.loc, e.shelf), e.pos].filter(String).join(', '); }).join('; ');
    var win = [w.drinkFrom, w.drinkUntil].every(function (x) { return x !== '' && x !== null; }) ? ' (drink ' + w.drinkFrom + ' to ' + w.drinkUntil + (w.peakFrom !== '' && w.peakUntil !== '' ? ', peak ' + w.peakFrom + ' to ' + w.peakUntil : '') + ')' : '';
    return [
      w.id, [w.producer, w.name, w.vintage].filter(String).join(' '), w.type, w.region, w.grapes,
      w.tasteTags ? 'style: ' + w.tasteTags : '', w.pairings ? 'pairs with: ' + w.pairings : '',
      'status: ' + status_(w, t) + win, ratings.join(', '), streetText(w), where
    ].filter(String).join(' | ');
  });
  var names = {};
  all.forEach(function (w) { names[w.id] = [w.producer, w.name, w.vintage].filter(String).join(' '); });
  var journal = readAll_(SHEETS.removals).filter(function (r) { return r.dir === 'out'; })
    .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 40)
    .map(function (r) {
      return [r.date, r.wineName || names[r.wineId] || r.wineId, r.type, r.occasion, r.people ? 'with ' + r.people : '', r.food ? 'food: ' + r.food : '', r.note ? 'note: ' + r.note : '', r.hearts ? 'favorite of ' + r.hearts : ''].filter(String).join(' | ');
    });
  return { wines: wines, text: 'Today is ' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd') + '. The owner uses ' + settings_().currency + '.\n\nCELLAR (wines in stock):\n' + (lines.join('\n') || 'The cellar is empty.') +
    '\n\nJOURNAL (recent bottles opened, given or sold):\n' + (journal.join('\n') || 'No entries yet.') };
}

function actionSommelier_(req) {
  var q = String(req.question || '').trim();
  var image = req.image ? String(req.image) : '';
  if (image && image.length > 1500000) throw new Error('The photo is too large');
  if (!q && image) q = 'Will I like this wine?';
  if (!q) throw new Error('Ask a question first');
  var ctx = cellarContext_();
  var messages = [];
  (req.history || []).slice(-6).forEach(function (h) {
    if (!h || !h.q || !h.a) return;
    messages.push({ role: 'user', content: String(h.q).slice(0, 1000) });
    messages.push({ role: 'assistant', content: String(h.a).slice(0, 2000) });
  });
  messages.push({ role: 'user', content: image
    ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } }, { type: 'text', text: q.slice(0, 1000) }]
    : q.slice(0, 1000) });
  var res = callClaude_({
    model: props_().getProperty('CLAUDE_MODEL') || DEFAULT_MODEL,
    max_tokens: 1400,
    system: SOMMELIER_RULES + '\n\n' + ctx.text,
    messages: messages
  });
  var d = parseJson_(textOf_(res), 'The sommelier gave no answer. Please try again.');
  var ids = {};
  ctx.wines.forEach(function (w) { ids[String(w.id)] = true; });
  var picks = (Array.isArray(d.picks) ? d.picks : []).filter(function (p) { return p && ids[String(p.id)]; }).slice(0, 3)
    .map(function (p) { return { id: String(p.id), why: String(p.why || '') }; });
  var fit = d.fit === null || d.fit === undefined || d.fit === '' || isNaN(Number(d.fit)) ? null : Math.max(0, Math.min(100, Math.round(Number(d.fit))));
  return { answer: String(d.answer || ''), picks: picks, buy: String(d.buy || ''), wine: image ? String(d.wine || '') : '', fit: image ? fit : null };
}

// ---------------------------------------------------------------- AI consultant and wishlist

var CONSULTANT_RULES = [
  'You are an independent wine consultant who helps the owner of a private cellar decide which wines to buy next.',
  'You get the profile of the owner, the cellar with stock, ratings and prices, wines already finished and the journal of bottles opened.',
  'Recommend exactly 10 wines that are NOT in the cellar list, ranked best first. Only real wines that online shops in the country of the owner currently sell, preferably widely distributed ones. Avoid rarities and allocated wines.',
  'Rules:',
  '1. Fit the taste of the owner: styles, grapes and regions they rate highly and drink often. Avoid styles they rated low.',
  '2. Respect the budget per bottle. Prefer wines with an outstanding price to quality ratio, for example from lesser known producers or regions.',
  '3. Plan quantities sensibly. Compare the stock of each style with how fast the owner drinks it. Where the stock is large, only suggest small quantities of a clearly different style. Where stock is low compared to consumption, suggest more bottles.',
  '4. A suggestion may replace a wine in stock with few bottles left (1 to 3) when it has better ratings and a better price to quality ratio. Then give the id of that wine in "replaces" and the reason in "replaceWhy". Otherwise leave both empty.',
  '5. Mix the labels: "Safe bet" (close to their favorites), "Discovery" (new grape or region that fits their taste), "Top value" (outstanding price to quality).',
  '6. "price" is your estimate of the typical shop price per bottle in the currency of the owner. "vintage" is a recommended recent vintage as a number, or null.',
  '7. Follow the focus and wishes of the owner if given.',
  '8. Write in English. Keep "summary" to two to four sentences about what the cellar needs and how much to buy, "why" and "value" to one sentence each. Do not use dashes as punctuation.',
  '9. Return ONLY a JSON object, no other text: {"summary": "text", "picks": [{"producer": "", "name": "", "vintage": 2021, "type": "Red|White|Rosé|Sparkling|Dessert|Fortified", "region": "region, country", "grapes": "", "price": 0, "label": "Safe bet|Discovery|Top value", "why": "", "value": "", "qty": 3, "replaces": "", "replaceWhy": ""}]}.'
].join('\n');

/** Finished wines with rating and price, as taste history for the consultant. */
function finishedContext_() {
  var buys = {};
  readAll_(SHEETS.removals).forEach(function (r) {
    if (r.dir !== 'in' || r.price === '' || r.price === null || r.price === undefined) return;
    var b = buys[r.wineId] || (buys[r.wineId] = []);
    b.push(Number(r.price) + ' ' + (r.priceCur || ''));
  });
  return readAll_(SHEETS.wines).filter(function (w) {
    var n = parseStock_(w.stock).reduce(function (a, e) { return a + (Number(e.n) || 0); }, 0);
    return w.id && !n;
  }).map(function (w) {
    return [[w.producer, w.name, w.vintage].filter(String).join(' '), w.type, w.region, w.grapes,
      w.myRating !== '' && w.myRating !== null && w.myRating !== undefined ? 'my rating ' + w.myRating + '%' : '',
      buys[w.id] ? 'paid ' + buys[w.id].join(', ') : ''].filter(String).join(' | ');
  });
}

function actionConsultant_(req) {
  var cur = settings_().currency;
  var ctx = cellarContext_();
  var finished = finishedContext_();
  var wishes = [];
  if (req.focus) wishes.push('Focus: ' + String(req.focus).slice(0, 100));
  if (req.budget && (Number(req.budget.min) > 0 || Number(req.budget.max) > 0)) wishes.push('Budget per bottle: ' + (Number(req.budget.min) || 0) + ' to ' + (Number(req.budget.max) || 'any') + ' ' + cur);
  if (req.note) wishes.push('Wish: ' + String(req.note).slice(0, 500));
  var avoid = (req.avoid || []).slice(0, 30).map(function (x) { return String(x).slice(0, 120); });
  var text = 'PROFILE OF THE OWNER (calculated by the app):\n' + String(req.profile || '').slice(0, 5000) +
    '\n\nWISHES:\n' + (wishes.join('\n') || 'None, use the profile.') +
    (avoid.length ? '\n\nDo not suggest these again, they are already on the wishlist or were suggested before:\n' + avoid.join('\n') : '') +
    '\n\n' + ctx.text + '\n\nFINISHED WINES (no bottles left):\n' + (finished.join('\n') || 'None yet.');
  var area = (OFFER_REGIONS[cur] || OFFER_REGIONS.CHF).area;
  text += '\n\nThe owner buys in ' + area + ' and pays in ' + cur + '.';
  var res = callClaude_({
    model: props_().getProperty('CLAUDE_MODEL') || DEFAULT_MODEL,
    max_tokens: 5000,
    system: CONSULTANT_RULES,
    messages: [{ role: 'user', content: text }]
  });
  var d = parseJson_(textOf_(res), 'The consultant gave no answer. Please try again.');
  var stock = {};
  ctx.wines.forEach(function (w) { stock[String(w.id)] = w; });
  var labels = ['Safe bet', 'Discovery', 'Top value'];
  var picks = (Array.isArray(d.picks) ? d.picks : []).filter(function (p) { return p && (p.name || p.producer); }).slice(0, 10).map(function (p) {
    var rep = String(p.replaces || '');
    if (!stock[rep]) rep = '';
    return {
      producer: String(p.producer || ''), name: String(p.name || ''), vintage: Number(p.vintage) > 1900 ? Number(p.vintage) : '',
      type: String(p.type || ''), region: String(p.region || ''), grapes: String(p.grapes || ''),
      price: Number(p.price) > 0 ? Math.round(Number(p.price) * 100) / 100 : '', priceCur: cur,
      label: labels.indexOf(String(p.label)) >= 0 ? String(p.label) : 'Discovery',
      why: String(p.why || ''), value: String(p.value || ''), qty: Math.max(1, Math.min(24, Math.round(Number(p.qty) || 1))),
      replaces: rep, replaceWhy: rep ? String(p.replaceWhy || '') : ''
    };
  });
  // only wines that a shop really sells: check the best 6 first, then refill only the places without a shop
  var max = req.budget ? Number(req.budget.max) || 0 : 0;
  var queue = picks.slice();
  var verified = [], over = [];
  var label = function (p) { return [p.producer, p.name, p.vintage].filter(String).join(' '); };
  while (verified.length < 6 && queue.length) {
    var wave = queue.splice(0, 6 - verified.length);
    var mem = offerMemory_(wave.map(function (p) { return offerKey_(label(p)); }), true);
    var search = wave.filter(function (p) { return !mem[offerKey_(label(p))]; });
    var found = {};
    if (search.length) {
      var replies = callClaudeMany_(search.map(function (p) { return offerRequest_(label(p), p.region, 2); }));
      var pairs = search.map(function (p, i) { var o = offerFrom_(replies[i]); found[offerKey_(label(p))] = o; return [offerKey_(label(p)), o]; });
      rememberOffers_(pairs);
    }
    wave.forEach(function (p) {
      var k = offerKey_(label(p));
      var o = mem[k] ? mem[k].offer : found[k];
      if (!o) return;
      p.offer = o;
      p.price = o.v;
      (max && p.price > max * 1.25 ? over : verified).push(p);
    });
  }
  if (verified.length < 3) verified = verified.concat(over).slice(0, 6);
  if (!verified.length) throw new Error('None of the suggested wines is sold online in ' + area + ' right now. Please try again, maybe with another focus or budget.');
  return { summary: String(d.summary || ''), picks: verified.slice(0, 6) };
}

/** Best offer for a wine that is not in the cellar yet, for example a suggestion of the consultant. */
function actionOfferFor_(req) {
  var wine = String(req.wine || '').trim();
  if (!wine) throw new Error('Missing wine');
  var offer = findOffer_(wine.slice(0, 200), String(req.region || '').slice(0, 100), !!req.fresh);
  if (req.wishId) {
    withLock_(function () {
      var t = table_(SHEETS.wishlist);
      var idx = findIndex_(t, req.wishId);
      if (idx < 0) return;
      var obj = toObj_(t.headers, t.rows[idx]);
      obj.offer = JSON.stringify(offer);
      writeRow_(t, idx, obj);
    });
  }
  return offer;
}

function actionSaveWish_(req) {
  var w = req.wish || {};
  if (!w.id) throw new Error('Missing id');
  return withLock_(function () {
    var t = table_(SHEETS.wishlist);
    var idx = findIndex_(t, w.id);
    var obj = idx >= 0 ? toObj_(t.headers, t.rows[idx]) : {};
    WISH_COLS.forEach(function (c) { if (w[c] !== undefined) obj[c] = typeof w[c] === 'object' && w[c] !== null ? JSON.stringify(w[c]) : w[c]; });
    if (!obj.createdAt) obj.createdAt = new Date().toISOString();
    writeRow_(t, idx, obj);
    return obj;
  });
}

function actionDeleteWish_(req) {
  return withLock_(function () {
    var t = table_(SHEETS.wishlist);
    var idx = findIndex_(t, req.id);
    if (idx < 0) return { deleted: false };
    t.sh.deleteRow(idx + 2);
    return { deleted: true };
  });
}

function testClaude() {
  var answer = textOf_(callClaude_({ model: props_().getProperty('CLAUDE_MODEL') || DEFAULT_MODEL, max_tokens: 10, messages: [{ role: 'user', content: 'Reply with the single word OK.' }] }));
  Logger.log('Claude API works. Answer: ' + answer);
}

function claudeHeaders_() {
  var p = props_();
  var key = (p.getProperty('ANTHROPIC_API_KEY') || '').trim();
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set in the script properties');
  var headers = { 'Authorization': 'Bearer ' + key, 'anthropic-version': '2023-06-01' };
  var ws = (p.getProperty('ANTHROPIC_WORKSPACE_ID') || '').trim();
  if (ws) headers['anthropic-workspace-id'] = ws;
  return headers;
}

/** Several requests at the same time. Returns one result per body, or null where a request failed. */
function callClaudeMany_(bodies) {
  var headers = claudeHeaders_();
  var state = bodies.map(function (b) { return { body: b, messages: b.messages.slice(), out: null, done: false }; });
  for (var turn = 0; turn < 3; turn++) {
    var open = state.filter(function (x) { return !x.done; });
    if (!open.length) break;
    var replies = UrlFetchApp.fetchAll(open.map(function (x) {
      return { url: 'https://api.anthropic.com/v1/messages', method: 'post', contentType: 'application/json', headers: headers,
        payload: JSON.stringify(Object.assign({}, x.body, { messages: x.messages })), muteHttpExceptions: true };
    }));
    open.forEach(function (x, i) {
      var r = replies[i];
      if (r.getResponseCode() !== 200) { x.done = true; x.out = null; return; }
      x.out = JSON.parse(r.getContentText());
      noteUsage_(x.body.model, x.out.usage);
      if (x.out.stop_reason === 'pause_turn') x.messages.push({ role: 'assistant', content: x.out.content });
      else x.done = true;
    });
  }
  return state.map(function (x) { return x.done ? x.out : null; });
}

function callClaude_(body) {
  var headers = claudeHeaders_();
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
    noteUsage_(body.model, out.usage);
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
