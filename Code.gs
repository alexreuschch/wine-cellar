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

var API_VERSION = 22;
var SHEETS = { wines: 'Wines', removals: 'Removals', locations: 'Locations', retailers: 'Retailers', people: 'People', wishlist: 'Wishlist', offers: 'Offers', history: 'History', fx: 'FX', info: 'Info' };

var WINE_COLS = [
  'id', 'producer', 'name', 'vintage', 'type', 'region', 'grapes', 'taste', 'tasteTags', 'pairings',
  'drinkFrom', 'peakFrom', 'peakUntil', 'drinkUntil', 'location', 'shelf', 'position', 'count',
  'myRating', 'ratings', 'labelFileId', 'thumb', 'createdAt', 'updatedAt',
  'retailer', 'purchaseDate', 'purchasePrice', 'streetPrice', 'acquired', 'giftFrom',
  'stock', 'street', 'offer', 'profile'
];
// The Removals tab is the journal: bottles going out (dir "out") and coming in (dir "in").
var REMOVAL_COLS = ['id', 'wineId', 'date', 'type', 'occasion', 'people', 'food', 'note', 'wineName', 'hearts',
  'dir', 'qty', 'loc', 'price', 'priceCur', 'retailer'];
var LOCATION_COLS = ['name', 'shelves'];
var RETAILER_COLS = ['name', 'website'];
var PEOPLE_COLS = ['name'];
var OFFER_COLS = ['key', 'offer', 'date'];
var INFO_COLS = ['key', 'kind', 'name', 'data', 'date'];
var HISTORY_COLS = ['month', 'bottles', 'cost', 'street', 'cur', 'date'];
var WISH_COLS = ['id', 'producer', 'name', 'vintage', 'type', 'region', 'grapes', 'price', 'priceCur', 'label', 'why', 'value', 'qty', 'replaces', 'offer', 'createdAt'];
// all countries with their currency [name, currency], and the EU members
var GEO_COUNTRIES = {"AD":["Andorra","EUR"],"AE":["United Arab Emirates","AED"],"AF":["Afghanistan","AFN"],"AG":["Antigua & Barbuda","XCD"],"AI":["Anguilla","XCD"],"AL":["Albania","ALL"],"AM":["Armenia","AMD"],"AO":["Angola","AOA"],"AR":["Argentina","ARS"],"AS":["American Samoa","USD"],"AT":["Austria","EUR"],"AU":["Australia","AUD"],"AW":["Aruba","AWG"],"AX":["Åland Islands","EUR"],"AZ":["Azerbaijan","AZN"],"BA":["Bosnia and Herzegovina","BAM"],"BB":["Barbados","BBD"],"BD":["Bangladesh","BDT"],"BE":["Belgium","EUR"],"BF":["Burkina Faso","XOF"],"BG":["Bulgaria","BGN"],"BH":["Bahrain","BHD"],"BI":["Burundi","BIF"],"BJ":["Benin","XOF"],"BL":["St. Barthélemy","EUR"],"BM":["Bermuda","BMD"],"BN":["Brunei","BND"],"BO":["Bolivia","BOB"],"BQ":["Caribbean Netherlands","USD"],"BR":["Brazil","BRL"],"BS":["Bahamas","BSD"],"BT":["Bhutan","INR"],"BW":["Botswana","BWP"],"BY":["Belarus","BYN"],"BZ":["Belize","BZD"],"CA":["Canada","CAD"],"CC":["Cocos (Keeling) Islands","AUD"],"CD":["DR Congo","CDF"],"CF":["Central African Republic","XAF"],"CG":["Congo","XAF"],"CH":["Switzerland","CHF"],"CI":["Côte d'Ivoire","XOF"],"CK":["Cook Islands","NZD"],"CL":["Chile","CLP"],"CM":["Cameroon","XAF"],"CN":["China","CNY"],"CO":["Colombia","COP"],"CR":["Costa Rica","CRC"],"CU":["Cuba","CUP"],"CV":["Cape Verde","CVE"],"CW":["Curaçao","XCG"],"CX":["Christmas Island","AUD"],"CY":["Cyprus","EUR"],"CZ":["Czechia","CZK"],"DE":["Germany","EUR"],"DJ":["Djibouti","DJF"],"DK":["Denmark","DKK"],"DM":["Dominica","XCD"],"DO":["Dominican Republic","DOP"],"DZ":["Algeria","DZD"],"EC":["Ecuador","USD"],"EE":["Estonia","EUR"],"EG":["Egypt","EGP"],"EH":["Western Sahara","MAD"],"ER":["Eritrea","ERN"],"ES":["Spain","EUR"],"ET":["Ethiopia","ETB"],"FI":["Finland","EUR"],"FJ":["Fiji","FJD"],"FK":["Falkland Islands","FKP"],"FM":["Micronesia","USD"],"FO":["Faroe Islands","DKK"],"FR":["France","EUR"],"GA":["Gabon","XAF"],"GB":["United Kingdom","GBP"],"GD":["Grenada","XCD"],"GE":["Georgia","GEL"],"GF":["French Guiana","EUR"],"GG":["Guernsey","GBP"],"GH":["Ghana","GHS"],"GI":["Gibraltar","GIP"],"GL":["Greenland","DKK"],"GM":["Gambia","GMD"],"GN":["Guinea","GNF"],"GP":["Guadeloupe","EUR"],"GQ":["Equatorial Guinea","XAF"],"GR":["Greece","EUR"],"GT":["Guatemala","GTQ"],"GU":["Guam","USD"],"GW":["Guinea-Bissau","XOF"],"GY":["Guyana","GYD"],"HK":["Hong Kong","HKD"],"HN":["Honduras","HNL"],"HR":["Croatia","EUR"],"HT":["Haiti","HTG"],"HU":["Hungary","HUF"],"ID":["Indonesia","IDR"],"IE":["Ireland","EUR"],"IL":["Israel","ILS"],"IM":["Isle of Man","GBP"],"IN":["India","INR"],"IQ":["Iraq","IQD"],"IR":["Iran","IRR"],"IS":["Iceland","ISK"],"IT":["Italy","EUR"],"JE":["Jersey","GBP"],"JM":["Jamaica","JMD"],"JO":["Jordan","JOD"],"JP":["Japan","JPY"],"KE":["Kenya","KES"],"KG":["Kyrgyzstan","KGS"],"KH":["Cambodia","KHR"],"KI":["Kiribati","AUD"],"KM":["Comoros","KMF"],"KN":["St. Kitts & Nevis","XCD"],"KP":["North Korea","KPW"],"KR":["South Korea","KRW"],"KW":["Kuwait","KWD"],"KY":["Cayman Islands","KYD"],"KZ":["Kazakhstan","KZT"],"LA":["Laos","LAK"],"LB":["Lebanon","LBP"],"LC":["St. Lucia","XCD"],"LI":["Liechtenstein","CHF"],"LK":["Sri Lanka","LKR"],"LR":["Liberia","LRD"],"LS":["Lesotho","ZAR"],"LT":["Lithuania","EUR"],"LU":["Luxembourg","EUR"],"LV":["Latvia","EUR"],"LY":["Libya","LYD"],"MA":["Morocco","MAD"],"MC":["Monaco","EUR"],"MD":["Moldova","MDL"],"ME":["Montenegro","EUR"],"MF":["St. Martin","EUR"],"MG":["Madagascar","MGA"],"MH":["Marshall Islands","USD"],"MK":["North Macedonia","MKD"],"ML":["Mali","XOF"],"MM":["Myanmar","MMK"],"MN":["Mongolia","MNT"],"MO":["Macao","MOP"],"MP":["Northern Mariana Islands","USD"],"MQ":["Martinique","EUR"],"MR":["Mauritania","MRU"],"MS":["Montserrat","XCD"],"MT":["Malta","EUR"],"MU":["Mauritius","MUR"],"MV":["Maldives","MVR"],"MW":["Malawi","MWK"],"MX":["Mexico","MXN"],"MY":["Malaysia","MYR"],"MZ":["Mozambique","MZN"],"NA":["Namibia","ZAR"],"NC":["New Caledonia","XPF"],"NE":["Niger","XOF"],"NF":["Norfolk Island","AUD"],"NG":["Nigeria","NGN"],"NI":["Nicaragua","NIO"],"NL":["Netherlands","EUR"],"NO":["Norway","NOK"],"NP":["Nepal","NPR"],"NR":["Nauru","AUD"],"NU":["Niue","NZD"],"NZ":["New Zealand","NZD"],"OM":["Oman","OMR"],"PA":["Panama","PAB"],"PE":["Peru","PEN"],"PF":["French Polynesia","XPF"],"PG":["Papua New Guinea","PGK"],"PH":["Philippines","PHP"],"PK":["Pakistan","PKR"],"PL":["Poland","PLN"],"PM":["St. Pierre & Miquelon","EUR"],"PN":["Pitcairn Islands","NZD"],"PR":["Puerto Rico","USD"],"PS":["Palestine","ILS"],"PT":["Portugal","EUR"],"PW":["Palau","USD"],"PY":["Paraguay","PYG"],"QA":["Qatar","QAR"],"RE":["Réunion","EUR"],"RO":["Romania","RON"],"RS":["Serbia","RSD"],"RU":["Russia","RUB"],"RW":["Rwanda","RWF"],"SA":["Saudi Arabia","SAR"],"SB":["Solomon Islands","SBD"],"SC":["Seychelles","SCR"],"SD":["Sudan","SDG"],"SE":["Sweden","SEK"],"SG":["Singapore","SGD"],"SH":["St. Helena","SHP"],"SI":["Slovenia","EUR"],"SJ":["Svalbard & Jan Mayen","NOK"],"SK":["Slovakia","EUR"],"SL":["Sierra Leone","SLE"],"SM":["San Marino","EUR"],"SN":["Senegal","XOF"],"SO":["Somalia","SOS"],"SR":["Suriname","SRD"],"SS":["South Sudan","SSP"],"ST":["São Tomé & Príncipe","STN"],"SV":["El Salvador","USD"],"SX":["Sint Maarten","XCG"],"SY":["Syria","SYP"],"SZ":["Eswatini","SZL"],"TC":["Turks & Caicos Islands","USD"],"TD":["Chad","XAF"],"TG":["Togo","XOF"],"TH":["Thailand","THB"],"TJ":["Tajikistan","TJS"],"TK":["Tokelau","NZD"],"TL":["Timor-Leste","USD"],"TM":["Turkmenistan","TMT"],"TN":["Tunisia","TND"],"TO":["Tonga","TOP"],"TR":["Türkiye","TRY"],"TT":["Trinidad & Tobago","TTD"],"TV":["Tuvalu","AUD"],"TW":["Taiwan","TWD"],"TZ":["Tanzania","TZS"],"UA":["Ukraine","UAH"],"UG":["Uganda","UGX"],"US":["United States","USD"],"UY":["Uruguay","UYU"],"UZ":["Uzbekistan","UZS"],"VA":["Vatican City","EUR"],"VC":["St. Vincent & Grenadines","XCD"],"VE":["Venezuela","VES"],"VG":["British Virgin Islands","USD"],"VI":["U.S. Virgin Islands","USD"],"VN":["Vietnam","VND"],"VU":["Vanuatu","VUV"],"WF":["Wallis & Futuna","XPF"],"WS":["Samoa","WST"],"XK":["Kosovo","EUR"],"YE":["Yemen","YER"],"YT":["Mayotte","EUR"],"ZA":["South Africa","ZAR"],"ZM":["Zambia","ZMW"],"ZW":["Zimbabwe","USD"]};
var GEO_EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
var CURRENCIES = (function () {
  var seen = { CHF: true, EUR: true, USD: true, GBP: true }, out = ['CHF', 'EUR', 'USD', 'GBP'];
  Object.keys(GEO_COUNTRIES).forEach(function (k) { var c = GEO_COUNTRIES[k][1]; if (!seen[c]) { seen[c] = true; out.push(c); } });
  return out;
})();

// Raise this when columns are added. The script then upgrades the sheet by itself on the next request.
var SCHEMA_VERSION = '13';

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
  winelist: actionWineList_,
  profiles: actionProfiles_,
  info: actionInfo_,
  infoFill: actionInfoFill_,
  complete: actionComplete_,
  infoKeys: actionInfoKeys_,
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
    var ic = ensureSheet_(ss, SHEETS.info, INFO_COLS);
    if (!ic.isSheetHidden()) ic.hideSheet();
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

var T0_ = Date.now();
// Google stops a web app call after 6 minutes; AI work stops starting new requests well before that
var TIME_SOFT = 150000, TIME_HARD = 230000;
function elapsed_() { return Date.now() - T0_; }

function doPost(e) {
  T0_ = Date.now();
  SCOPE_ = '';
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
var USAGE_KIND = { analyze: 'Wine info', complete: 'Wine info', infoKeys: 'Background', streetPrice: 'Street prices', bestOffer: 'Best offer', offerFor: 'Best offer', sommelier: 'Sommelier', consultant: 'Consultant', winelist: 'Wine list', profiles: 'Wine info', info: 'Background', infoFill: 'Background' };
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

// countries where shops are searched; the currency setting only changes how prices are shown
var COUNTRIES = (function () {
  var out = {};
  Object.keys(GEO_COUNTRIES).forEach(function (k) { out[k] = { name: GEO_COUNTRIES[k][0], cur: GEO_COUNTRIES[k][1], eu: GEO_EU.indexOf(k) >= 0 }; });
  return out;
})();
var CUR_COUNTRY = { CHF: 'CH', EUR: 'DE', GBP: 'GB', USD: 'US' };
function countryOfCur_(c) {
  if (CUR_COUNTRY[c]) return CUR_COUNTRY[c];
  var k = Object.keys(COUNTRIES).filter(function (x) { return COUNTRIES[x].cur === c; })[0];
  return k || 'CH';
}
// a country for this one request, for example the travel country of the sommelier
var SCOPE_ = '';
function scopeFrom_(code) { SCOPE_ = COUNTRIES[String(code || '')] ? String(code) : ''; }

function settings_() {
  var p = props_();
  var c = p.getProperty('CURRENCY');
  var currency = CURRENCIES.indexOf(c) >= 0 ? c : 'CHF';
  var k = p.getProperty('COUNTRY');
  return { currency: currency, country: COUNTRIES[k] ? k : countryOfCur_(currency) };
}

function actionSetSettings_(req) {
  var s = req.settings || {};
  if (s.currency !== undefined) {
    if (CURRENCIES.indexOf(String(s.currency)) < 0) throw new Error('Unsupported currency');
    props_().setProperty('CURRENCY', String(s.currency));
  }
  if (s.country !== undefined) {
    if (!COUNTRIES[String(s.country)]) throw new Error('Unsupported country');
    props_().setProperty('COUNTRY', String(s.country));
  }
  return settings_();
}

/** Exchange rates with CHF as base (1 CHF = rates[X] X). From Google Finance, cached for 12 hours. */
function fxRates_() {
  var p = props_();
  var cached = p.getProperty('FX_JSON');
  var c = cached ? JSON.parse(cached) : null;
  // older caches hold only four currencies and are replaced right away
  if (c && Date.now() - c.t < 12 * 3600 * 1000 && Object.keys(c.rates || {}).length > 10) return c;
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
  if (sh.getLastRow() !== others.length || String(sh.getRange(others.length, 1).getValue()) !== others[others.length - 1]) {
    sh.clear();
    sh.getRange(1, 1, others.length, 2).setValues(others.map(function (x) { return [x, '=IFERROR(GOOGLEFINANCE("CURRENCY:CHF' + x + '"),"")']; }));
  }
  SpreadsheetApp.flush();
  var vals = sh.getRange(1, 2, others.length, 1).getValues();
  var rates = { CHF: 1 };
  for (var i = 0; i < others.length; i++) {
    var v = Number(vals[i][0]);
    if (v > 0) rates[others[i]] = v;
  }
  // the main currencies must be there, rare ones may be missing
  return rates.EUR && rates.USD && rates.GBP ? rates : null;
}

function fxFromWeb_() {
  var r = UrlFetchApp.fetch('https://api.frankfurter.app/latest?from=CHF', { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  var d = JSON.parse(r.getContentText());
  var rates = { CHF: 1 };
  Object.keys(d.rates || {}).forEach(function (x) { if (Number(d.rates[x]) > 0) rates[x] = Number(d.rates[x]); });
  return rates.EUR ? rates : null;
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

// taste profile and background of a wine, stored as JSON in the column "profile"
var AROMA_KEYS = ['redfruit', 'darkfruit', 'citrus', 'treefruit', 'tropical', 'floral', 'herbal', 'spice', 'oak', 'earth', 'leather', 'mineral', 'honey'];
var FOOD_KEYS = ['beef', 'lamb', 'pork', 'game', 'poultry', 'fish', 'seafood', 'pasta', 'pizza', 'vegetarian', 'mushrooms', 'spicy', 'asian', 'hardcheese', 'softcheese', 'curedmeat', 'dessert', 'aperitif'];
var PROFILE_SPEC = [
  '"profile": an object with these keys:',
  '  "body", "sweet", "acid": numbers from 1 to 5 (body 1 light to 5 bold, sweet 1 dry to 5 sweet, acid 1 soft to 5 fresh),',
  '  "tannin": number from 1 smooth to 5 tannic, or null for wines without noticeable tannin such as most white, rosé and sparkling wines,',
  '  "aromas": the three main aroma groups, most important first, each {"g": one of ' + AROMA_KEYS.join(', ') + ', "n": "two or three notes, for example cherry, raspberry"},',
  '  "foods": three to six food categories that suit the wine, best first, only from this list: ' + FOOD_KEYS.join(', ') + ',',
  '  "style": a short style name, for example "Red Burgundy", "Southern Italy Red" or "Champagne Brut",',
  '  "styleDesc": one short line on the style, for example "Elegant, light to medium bodied Pinot Noir",',
  '  "sub": the sub-region or appellation if it is more specific than the region, otherwise "",',
  '  "producerLine": one short line about the producer, for example "Family estate in Gevrey-Chambertin",',
  '  "about": two or three sentences portraying the producer,',
  '  "classification": for example "DOCG", "Grand Cru" or "AOC Bourgogne Côte de Nuits", or "",',
  '  "alcohol": percent as a number, read from the label if it is visible,',
  '  "ageing": for example "14 months in French oak, 25% new", or "",',
  '  "closure": "Natural cork", "Screw cap", "Glass stopper" or "Synthetic cork", or "",',
  '  "vineyard": vineyards, exposure and soil in one line, or "",',
  '  "vintageNote": one or two sentences on this vintage in this region, or "" for a non-vintage wine,',
  '  "typical": true if the grape shares in "grapes" are typical shares from your knowledge and not stated for this wine.',
  '  Always fill "body", "sweet", "acid", "tannin" (except for wines without tannin), "aromas", "foods" and "style": if you do not know this exact wine, derive them from the grapes, region, vintage, taste notes and style given and from what is typical for such a wine. Never leave the profile empty.',
  '  The facts "about", "classification", "alcohol", "ageing", "closure", "vineyard" and "vintageNote" only when you know them with reasonable confidence, otherwise "" or null. Do not use dashes as punctuation.'
].join('\n');

/** Cleans the profile from the AI: numbers in range, known keys only. */
function normProfile_(p) {
  if (!p || typeof p !== 'object') return null;
  var sc = function (v) { var n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : null; };
  var txt = function (v, max) { return String(v === null || v === undefined ? '' : v).trim().slice(0, max || 300); };
  var aromas = (Array.isArray(p.aromas) ? p.aromas : []).filter(function (a) { return a && AROMA_KEYS.indexOf(String(a.g)) >= 0; })
    .slice(0, 3).map(function (a) { return { g: String(a.g), n: txt(a.n, 80) }; });
  var foods = (Array.isArray(p.foods) ? p.foods : []).map(String).filter(function (f, i, arr) { return FOOD_KEYS.indexOf(f) >= 0 && arr.indexOf(f) === i; }).slice(0, 6);
  var alc = Number(p.alcohol);
  return {
    v: 1, body: sc(p.body), tannin: sc(p.tannin), sweet: sc(p.sweet), acid: sc(p.acid), aromas: aromas, foods: foods,
    style: txt(p.style, 60), styleDesc: txt(p.styleDesc, 120), sub: txt(p.sub, 80), producerLine: txt(p.producerLine, 120), about: txt(p.about, 700),
    classification: txt(p.classification, 80), alcohol: alc > 3 && alc < 25 ? Math.round(alc * 10) / 10 : null, ageing: txt(p.ageing, 120),
    closure: txt(p.closure, 40), vineyard: txt(p.vineyard, 160), vintageNote: txt(p.vintageNote, 400), typical: p.typical === true
  };
}

var ANALYZE_PROMPT = [
  'You are an experienced sommelier. Read the wine label in this photo and return ONLY a JSON object, no other text, with these keys:',
  '"producer": the winery or producer,',
  '"name": the wine or cuvee name without producer and vintage (use the appellation if there is no separate name),',
  '"vintage": the year as a number, or null for non-vintage,',
  '"type": exactly one of "Red", "White", "Rosé", "Sparkling", "Dessert", "Fortified",',
  '"region": region and country, for example "Piedmont, Italy",',
  '"grapes": grape varieties with shares, for example "Nebbiolo 100%" or "Merlot 70%, Cabernet Franc 30%" (if the label does not say, use typical shares from your knowledge and set "typical" in the profile to true),',
  '"taste": two or three sentences in English on style and aromas, including whether it is delicate, elegant, full-bodied or highly structured,',
  '"tasteTags": an array of exactly three short style tags, for example ["elegant", "medium body", "fresh acidity"],',
  '"pairings": an array of four to six dishes it pairs well with,',
  '"drinkFrom", "peakFrom", "peakUntil", "drinkUntil": years as numbers, your best estimate of the drinking window and peak for this wine and vintage,',
  PROFILE_SPEC,
  'Use null for anything you cannot determine. Do not include ratings, scores or prices.'
].join('\n');

function analyzeRequest_(image, hints) {
  var known = Object.keys(hints).filter(function (k) { return hints[k] !== '' && hints[k] !== null && hints[k] !== undefined; });
  var prompt = ANALYZE_PROMPT;
  if (!image) prompt = prompt.replace('Read the wine label in this photo and return', 'There is no photo. Based on the details below, return');
  if (known.length) {
    prompt += '\n\nThe owner confirmed these details. Treat them as correct, keep them unchanged in your answer, and base everything else on them, especially the drinking window for this exact vintage:\n' +
      known.map(function (k) { return k + ': ' + (Array.isArray(hints[k]) ? hints[k].join(', ') : hints[k]); }).join('\n');
  }
  var content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
  content.push({ type: 'text', text: prompt });
  return { model: props_().getProperty('CLAUDE_MODEL') || DEFAULT_MODEL, max_tokens: 3000, messages: [{ role: 'user', content: content }] };
}

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
  var res = callClaude_({ model: props_().getProperty('CLAUDE_MODEL') || DEFAULT_MODEL, max_tokens: 3000, messages: [{ role: 'user', content: content }] });
  var d = parseJson_(textOf_(res), 'The AI returned no wine data');
  var prof = profileFrom_(res);
  if (!prof) {
    // no usable taste profile in the answer: ask for it once more with everything known now
    var w = {};
    ['producer', 'name', 'vintage', 'type', 'region', 'grapes', 'taste', 'tasteTags', 'pairings'].forEach(function (k) { w[k] = hints[k] !== undefined && hints[k] !== '' ? hints[k] : d[k]; });
    var again = profilesFor_([w]);
    prof = again.res[0];
  }
  d.profile = prof ? prof.profile : null;
  if (prof && prof.grapes && !d.grapes) d.grapes = prof.grapes;
  return d;
}

/** The request for the taste profile of one wine, with everything already known about it. */
function profileRequest_(w) {
  var list = function (v) { if (Array.isArray(v)) return v.join(', '); try { var a = JSON.parse(v); return Array.isArray(a) ? a.join(', ') : String(v || ''); } catch (e) { return String(v || ''); } };
  var known = [['producer', w.producer], ['wine', w.name], ['vintage', w.vintage], ['type', w.type], ['region', w.region], ['grapes', w.grapes],
    ['taste notes', w.taste], ['style tags', list(w.tasteTags)], ['dishes it pairs with', list(w.pairings)]]
    .filter(function (k) { return String(k[1] || '').trim(); }).map(function (k) { return k[0] + ': ' + k[1]; }).join('\n');
  var prompt = 'You are an experienced sommelier. Here is a wine from a private cellar with what the owner already knows about it:\n' + known + '\n\n' +
    'Return ONLY a JSON object, no other text, with these keys:\n' +
    '"grapes": grape varieties with shares, for example "Merlot 70%, Cabernet Franc 30%"; keep the shares given above, otherwise use typical shares and set "typical" in the profile to true,\n' +
    PROFILE_SPEC;
  return { model: props_().getProperty('CLAUDE_MODEL') || DEFAULT_MODEL, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] };
}

/** Reads the answer; accepts the profile nested or at the top level. Null when it holds no profile. */
function profileFrom_(res) {
  var d;
  try { d = parseJson_(textOf_(res), 'No profile'); } catch (e) { return null; }
  var raw = d.profile && typeof d.profile === 'object' ? d.profile : d;
  var p = normProfile_(raw);
  if (!p || !(p.body || p.aromas.length || p.foods.length)) return null;
  return { grapes: String(d.grapes || raw.grapes || ''), profile: p };
}

/** Asks for several profiles at the same time and tries the failed ones a second time. */
function profilesFor_(wines) {
  var res = wines.map(function () { return null; }), err = wines.map(function () { return ''; });
  for (var round = 0; round < 2; round++) {
    var todo = wines.map(function (w, i) { return i; }).filter(function (i) { return !res[i]; });
    if (!todo.length || (round > 0 && elapsed_() > TIME_SOFT)) break;
    var replies = callClaudeMany_(todo.map(function (i) { return profileRequest_(wines[i]); }));
    todo.forEach(function (i, j) {
      res[i] = profileFrom_(replies[j]);
      err[i] = res[i] ? '' : (replies.errors[j] || 'The AI returned no usable profile');
    });
  }
  return { res: res, err: err };
}

/** Taste profile for wines that have none yet, written to the sheet. With "wine" instead of "ids": only returns the profile for the form in Edit. */
function actionProfiles_(req) {
  if (req.wine) {
    var one = profilesFor_([req.wine]);
    if (!one.res[0]) throw new Error(one.err[0]);
    return { grapes: one.res[0].grapes, profile: one.res[0].profile };
  }
  var ids = (Array.isArray(req.ids) ? req.ids : []).map(String).slice(0, 6);
  if (!ids.length) return { wines: [] };
  var t = table_(SHEETS.wines);
  var rows = ids.map(function (id) { var i = findIndex_(t, id); return i < 0 ? null : toObj_(t.headers, t.rows[i]); }).filter(Boolean);
  var got = profilesFor_(rows);
  return withLock_(function () {
    var t2 = table_(SHEETS.wines), out = [], failed = [];
    rows.forEach(function (w, i) {
      var r = got.res[i];
      if (!r) { failed.push({ id: w.id, error: got.err[i] }); return; }
      var idx = findIndex_(t2, w.id);
      if (idx < 0) return;
      var obj = toObj_(t2.headers, t2.rows[idx]);
      var hasShares = /\d\s*%/.test(String(obj.grapes || ''));
      if (r.grapes && !hasShares) obj.grapes = String(r.grapes).slice(0, 200);
      else r.profile.typical = false;
      obj.profile = JSON.stringify(r.profile);
      obj.updatedAt = new Date().toISOString();
      writeRow_(t2, idx, obj);
      out.push(obj);
    });
    return { wines: out, failed: failed };
  });
}

/** Completes the AI details of a few wines at the same time: only empty fields are filled, nothing the owner entered is changed. */
function actionComplete_(req) {
  var ids = (Array.isArray(req.ids) ? req.ids : []).map(String).slice(0, 4);
  if (!ids.length) return { wines: [], failed: [] };
  var t = table_(SHEETS.wines);
  var rows = ids.map(function (id) { var i = findIndex_(t, id); return i < 0 ? null : toObj_(t.headers, t.rows[i]); }).filter(Boolean);
  var list = function (v) { if (Array.isArray(v)) return v; try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(String); } };
  var hintsOf = function (w) {
    var h = {};
    ['producer', 'name', 'vintage', 'type', 'region', 'grapes', 'taste'].forEach(function (k) { if (String(w[k] || '').trim()) h[k] = String(w[k]); });
    if (list(w.tasteTags).length) h.tasteTags = list(w.tasteTags);
    if (list(w.pairings).length) h.pairings = list(w.pairings);
    return h;
  };
  var res = rows.map(function () { return null; }), err = rows.map(function () { return ''; });
  for (var round = 0; round < 2; round++) {
    var todo = rows.map(function (w, i) { return i; }).filter(function (i) { return !res[i]; });
    if (!todo.length || (round > 0 && elapsed_() > TIME_SOFT)) break;
    var replies = callClaudeMany_(todo.map(function (i) { return analyzeRequest_(null, hintsOf(rows[i])); }));
    todo.forEach(function (i, j) {
      try {
        var d = parseJson_(textOf_(replies[j]), 'No answer');
        var prof = profileFrom_(replies[j]);
        d.profile = prof ? prof.profile : null;
        res[i] = d;
      } catch (e) { err[i] = replies.errors[j] || 'The AI returned no usable details'; }
    });
  }
  return withLock_(function () {
    var t2 = table_(SHEETS.wines), out = [], failed = [];
    rows.forEach(function (w, i) {
      var d = res[i];
      if (!d) { failed.push({ id: w.id, error: err[i] }); return; }
      var idx = findIndex_(t2, w.id);
      if (idx < 0) return;
      var obj = toObj_(t2.headers, t2.rows[idx]);
      var empty = function (k) { return !String(obj[k] === null || obj[k] === undefined ? '' : obj[k]).trim() || String(obj[k]) === '[]'; };
      ['region', 'grapes', 'taste'].forEach(function (k) { if (empty(k) && d[k]) obj[k] = String(d[k]).slice(0, k === 'taste' ? 1200 : 200); });
      if (empty('type') && d.type) obj.type = String(d.type);
      ['tasteTags', 'pairings'].forEach(function (k) { if (!list(obj[k]).length && Array.isArray(d[k]) && d[k].length) obj[k] = d[k].map(String).slice(0, 12).join(', '); });
      if (empty('drinkFrom') && empty('drinkUntil') && Number(d.drinkFrom) && Number(d.drinkUntil)) {
        ['drinkFrom', 'peakFrom', 'peakUntil', 'drinkUntil'].forEach(function (k) { if (Number(d[k])) obj[k] = Number(d[k]); });
      }
      // the profile: added when missing, otherwise only its empty parts are filled
      var cur = null;
      try { cur = obj.profile ? JSON.parse(obj.profile) : null; } catch (e) { cur = null; }
      if (d.profile) {
        if (!cur || !(cur.body || (cur.aromas || []).length || (cur.foods || []).length)) cur = d.profile;
        else Object.keys(d.profile).forEach(function (k) {
          var v = cur[k];
          if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) cur[k] = d.profile[k];
        });
        if (/\d\s*%/.test(String(w.grapes || ''))) cur.typical = false;
        obj.profile = JSON.stringify(cur);
      }
      obj.updatedAt = new Date().toISOString();
      writeRow_(t2, idx, obj);
      out.push(obj);
    });
    return { wines: out, failed: failed };
  });
}

/** The regions, grapes, styles and producers that already have a background. */
function actionInfoKeys_() {
  return { keys: readAll_(SHEETS.info).map(function (r) { return String(r.key); }) };
}

function actionStreetPrice_(req) {
  if (!req.id) throw new Error('Missing wine id');
  var t = table_(SHEETS.wines);
  var idx = findIndex_(t, req.id);
  if (idx < 0) throw new Error('Wine not found');
  var w = toObj_(t.headers, t.rows[idx]);
  var sc = shopScope_();
  var cur = sc.cur;
  var wine = [w.producer, w.name, w.vintage].filter(String).join(' ');
  var prompt = 'Find the current typical retail price for one 0.75 l bottle of this wine for a buyer in ' + sc.name + ': ' + wine +
    (w.region ? ' (' + w.region + ')' : '') + '. Search the web for current offers from ' + sc.where + '. ' +
    'Use the median of the offers you find for exactly this vintage. If there is no offer for this vintage, use the closest vintage and set confidence to "low". ' +
    'Give the price in ' + cur + '. Return ONLY a JSON object, no other text: {"price": number per bottle, "currency": "three letter ISO code", "source": "shop or website name", "confidence": "high" or "medium" or "low"}. ' +
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
/** Where to search for shops, from the country setting. Inside the EU, shops of other EU countries that deliver count too. */
function shopScope_() {
  var code = SCOPE_ || settings_().country;
  var c = COUNTRIES[code];
  var the = ['US', 'GB', 'NL', 'AE', 'PH', 'CZ', 'DO', 'BS', 'MV', 'CF', 'GM'].indexOf(code) >= 0 ? 'the ' : '';
  var where = code === 'CH' ? 'online shops based in Switzerland (shops in Liechtenstein count too)'
    : code === 'LI' ? 'online shops based in Liechtenstein or Switzerland'
    : c.eu ? 'online shops based in ' + c.name + ', or in another EU country if they deliver to ' + c.name + ' (there is no customs duty within the EU)'
    : 'online shops and wine stores based in ' + the + c.name;
  return { code: code, name: c.name, cur: c.cur, eu: !!c.eu, where: where };
}

/** Converts between the four currencies with the current exchange rates. */
function convert_(v, from, to) {
  if (from === to) return v;
  var r = fxRates_().rates || {};
  if (!r[from] || !r[to]) return v;
  return v / r[from] * r[to];
}

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
  var sc = shopScope_();
  var prompt = 'Find the online shop that currently sells this wine at the lowest price per 0.75 l bottle, for a buyer in ' + sc.name + ': ' + wine +
    (region ? ' (' + region + ')' : '') + '. Search the web for offers of this wine from ' + sc.where + '. Prefer the vintage given; if no shop sells it, take the closest vintage of the same wine that is available and report it. ' +
    'Compare the shops by price including the shipping cost to ' + sc.name + ', for an order of about 6 bottles, where the shop states it. ' +
    'Prices are usually in ' + sc.cur + '. Ignore auctions, marketplaces of private sellers and offers that are sold out. ' +
    'The link must be the product page of this wine at that shop, taken from your search results. Never use a home page, a category page or a search page. ' +
    'Return ONLY a JSON object, no other text: {"shop": "shop name", "country": "two letter ISO code of the country where the shop is based", "price": number per bottle, "currency": "three letter ISO code", "shipping": number for shipping one order to ' + sc.name + ' in the same currency or null if unknown, "freeFrom": order value from which shipping is free, in the same currency, or null, "url": "direct link to the product page", "vintage": "vintage of the offer"}. ' +
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
  var sc = shopScope_();
  var cur = CURRENCIES.indexOf(String(d.currency)) >= 0 ? String(d.currency) : sc.cur;
  var cc = /^[A-Za-z]{2}$/.test(String(d.country || '')) ? String(d.country).toUpperCase() : '';
  return {
    shop: String(d.shop), country: cc, v: Math.round(Number(d.price) * 100) / 100, cur: cur,
    shipping: d.shipping === 0 || d.shipping === '0' ? 0 : Number(d.shipping) > 0 ? Math.round(Number(d.shipping) * 100) / 100 : null,
    freeFrom: Number(d.freeFrom) > 0 ? Math.round(Number(d.freeFrom) * 100) / 100 : null,
    url: url, vintage: String(d.vintage || ''), for: sc.code, area: sc.name,
    date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
  };
}

/** Searches the web for the cheapest shop offer of one wine in the country of the chosen currency.
 *  An offer found in the last 14 days is reused, unless fresh is set (Update best offer). */
function findOffer_(wine, region, fresh) {
  var key = offerKey_(wine);
  var mem = fresh ? null : offerMemory_([key], false)[key];
  var offer = mem ? mem.offer : offerFrom_(callClaude_(offerRequest_(wine, region)));
  if (!mem) rememberOffers_([[key, offer]]);
  if (!offer) throw new Error('No online shop for ' + shopScope_().name + ' currently sells this wine');
  return offer;
}

/** When no shop in the country sells a wine: one shop anywhere in the world as a price reference. */
function worldOfferRequest_(wine, region) {
  var prompt = 'Find an online shop anywhere in the world that currently sells this wine, as a price reference per 0.75 l bottle: ' + wine + (region ? ' (' + region + ')' : '') + '. ' +
    'Prefer shops in the country where the wine is made or in large wine markets, and the vintage given; if no shop sells it, take the closest vintage of the same wine and report it. ' +
    'Ignore auctions, marketplaces of private sellers and offers that are sold out. The link must be the product page of this wine at that shop, taken from your search results. ' +
    'Return ONLY a JSON object, no other text: {"shop": "shop name", "country": "two letter ISO code of the country where the shop is based", "price": number per bottle, "currency": "three letter ISO code", "url": "direct link to the product page", "vintage": "vintage of the offer"}. ' +
    'If you find no offer, return {"shop": null}.';
  return { model: props_().getProperty('PRICE_MODEL') || PRICE_MODEL, max_tokens: 3000, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }], messages: [{ role: 'user', content: prompt }] };
}
function worldOfferFrom_(res) {
  var o = offerFrom_(res);
  if (!o) return null;
  o.for = 'WW'; o.area = 'Worldwide'; o.shipping = null; o.freeFrom = null;
  if (!o.country) o.country = '';
  return o;
}
function worldKey_(wine) { return 'WW|' + String(wine).toLowerCase().replace(/\s+/g, ' ').trim(); }

// ---------------------------------------------------------------- offer memory (hidden tab Offers)

var OFFER_DAYS = 14;     // found offers are reused for two weeks
var NO_OFFER_DAYS = 7;   // wines without a shop are not searched again for the consultant for a week

function offerKey_(wine) {
  return (SCOPE_ || settings_().country) + '|' + String(wine).toLowerCase().replace(/\s+/g, ' ').trim();
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

// ---------------------------------------------------------------- background on a region, grape, style or producer

var INFO_ASK = {
  region: 'the wine region "%s". Sections: "The region" (location, size, history), "Climate and soils", "Wines and grapes" (main grapes and styles), "Where the best wines come from" (sub-regions, appellations, classification). Facts: Country, Climate, Vineyard area, Main grapes, Best known for.',
  grape: 'the grape variety "%s". Sections: "Character" (aromas, structure, how it tastes), "Where it grows" (home and other important regions), "Styles" (how it is made and blended), "With food". Facts: Color, Origin, Typical aromas, Body, Ageing potential.',
  style: 'the wine style "%s". Sections: "What it is", "Typical character", "How to serve it" (temperature, glass, decanting), "How long to keep it". Facts: Serving temperature, Glass, Decanting, Ageing potential.',
  producer: 'the wine producer "%s". Sections: "History" (founding, family or owners), "Vineyards and philosophy" (size, location, farming, winemaking), "Best known wines". Facts: Based in, Founded, Owner, Vineyard area, Farming.'
};

/** One key per region, grape, style or producer: "Ribera del Duero, Spain" and "Ribera del Duero" are the same region. */
function infoKey_(kind, name, context) {
  var first = function (v) { return String(v || '').split(',')[0].trim().toLowerCase().replace(/\s+/g, ' '); };
  var n = kind === 'region' ? first(name) : String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return kind + '|' + n + (kind === 'producer' && context ? '|' + first(context) : '');
}
function infoRequest_(kind, name, context) {
  var prompt = 'You are an experienced sommelier and wine writer. Write a short, factual guide in English about ' + INFO_ASK[kind].replace('%s', name) +
    (context ? ' Context: ' + context + '.' : '') +
    ' Each section is two to four sentences. Facts are short values of a few words. Only write what you know with reasonable confidence; leave out a fact you do not know. Do not use dashes as punctuation.' +
    ' Return ONLY a JSON object, no other text: {"title": "name as it is usually written", "summary": "one or two sentences", "facts": [{"label": "", "value": ""}], "sections": [{"h": "heading", "t": "text"}]}.' +
    ' If you do not know it at all, return {"title": null}.';
  return { model: props_().getProperty('CLAUDE_MODEL') || DEFAULT_MODEL, max_tokens: 1800, messages: [{ role: 'user', content: prompt }] };
}
function infoFrom_(kind, res) {
  var d;
  try { d = parseJson_(textOf_(res), 'No background found'); } catch (e) { return null; }
  if (!d.title) return null;
  var txt = function (v, n) { return String(v || '').trim().slice(0, n); };
  var info = {
    kind: kind, title: txt(d.title, 120), summary: txt(d.summary, 500),
    facts: (Array.isArray(d.facts) ? d.facts : []).filter(function (f) { return f && f.label && f.value; }).slice(0, 6).map(function (f) { return { label: txt(f.label, 40), value: txt(f.value, 120) }; }),
    sections: (Array.isArray(d.sections) ? d.sections : []).filter(function (x) { return x && x.h && x.t; }).slice(0, 5).map(function (x) { return { h: txt(x.h, 60), t: txt(x.t, 900) }; })
  };
  return info;
}
function storeInfos_(entries) {
  if (!entries.length) return;
  withLock_(function () {
    var t = table_(SHEETS.info);
    var kc = t.headers.indexOf('key');
    entries.forEach(function (e) {
      var idx = -1;
      for (var i = 0; i < t.rows.length; i++) { if (String(t.rows[i][kc]) === e.key) { idx = i; break; } }
      writeRow_(t, idx, { key: e.key, kind: e.kind, name: e.name, data: JSON.stringify(e.info), date: new Date().toISOString() });
    });
  });
}
function knownInfos_() {
  var out = {};
  readAll_(SHEETS.info).forEach(function (r) { try { out[String(r.key)] = JSON.parse(r.data); } catch (e) { /* written again when asked */ } });
  return out;
}

/** Background on a region, grape, style or producer, written once by the AI and kept in the hidden tab Info for everyone. */
function actionInfo_(req) {
  var kind = String(req.kind || ''), name = String(req.name || '').trim().slice(0, 120);
  if (!INFO_ASK[kind] || !name) throw new Error('Nothing to look up');
  var context = String(req.context || '').trim().slice(0, 200);
  var key = infoKey_(kind, name, context);
  var hit = knownInfos_()[key];
  if (hit) return { info: hit, cached: true };
  var info = infoFrom_(kind, callClaude_(infoRequest_(kind, name, context)));
  if (!info) return { info: null };
  storeInfos_([{ key: key, kind: kind, name: name, info: info }]);
  return { info: info, cached: false };
}

/** Writes the background for several regions, grapes, styles and producers at the same time; known ones are only returned. */
function actionInfoFill_(req) {
  var items = (Array.isArray(req.items) ? req.items : []).filter(function (x) { return x && INFO_ASK[x.kind] && String(x.name || '').trim(); }).slice(0, 10);
  var known = knownInfos_(), out = {}, seen = {}, todo = [];
  items.forEach(function (x) {
    var key = infoKey_(x.kind, x.name, x.context);
    if (seen[key]) return;
    seen[key] = true;
    if (known[key]) out[key] = known[key];
    else todo.push({ key: key, kind: x.kind, name: String(x.name).trim().slice(0, 120), context: String(x.context || '').trim().slice(0, 200) });
  });
  if (todo.length) {
    var replies = callClaudeMany_(todo.map(function (x) { return infoRequest_(x.kind, x.name, x.context); }));
    var made = [];
    todo.forEach(function (x, i) { var info = infoFrom_(x.kind, replies[i]); if (info) { x.info = info; made.push(x); out[x.key] = info; } });
    storeInfos_(made);
  }
  return { infos: out, written: todo.length };
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
  '6. Return ONLY a JSON object, no other text: {"answer": "text", "picks": [{"id": "wine id", "why": "one sentence"}], "buy": "text or empty"}.'
].join('\n');

var CHECK_RULES = [
  'You are a warm, knowledgeable sommelier. The owner of a private cellar looks at a wine that is NOT in their cellar, for example in a shop, at a restaurant or at a friend, and wants to know if they will like it.',
  'You get a photo of the label or a description, maybe with a price, plus the cellar, the finished wines with ratings and the journal of the owner.',
  'Rules:',
  '1. Identify the wine: producer, name and vintage. Put them in "wine". If you are unsure, say what you think it is.',
  '2. Judge how well it fits the taste of the owner, based on the wines they rated highly or low, their favorites and what they drink often. Give "fit" from 0 to 100.',
  '3. In "answer" explain the style and why it fits or not. Do not discuss shop prices: the app checks them in local shops and shows them next to your answer. If the owner mentions a price, put it in "price" with its currency in "priceCur" (three letter ISO code) and say in "priceWhere" whether it is a "shop" or a "restaurant" price.',
  '4. Say whether the cellar already holds similar wines in enough bottles.',
  '5. As "picks", give up to 3 similar wines from the cellar list for comparison, referenced by their id, and say in "why" how each compares. Fewer is fine.',
  '6. Answer in the language of the question; if there is no question, in English. Keep "answer" to three to five sentences and each "why" to one sentence. Do not use dashes as punctuation.',
  '7. Return ONLY a JSON object, no other text: {"wine": "producer name vintage", "region": "region, country", "fit": 80, "answer": "text", "picks": [{"id": "wine id", "why": "one sentence"}], "price": null, "priceCur": "", "priceWhere": ""}.'
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
  var check = req.mode === 'check' || !!image;
  if (check) scopeFrom_(req.country);
  var ctx = cellarContext_();
  var system = check
    ? CHECK_RULES + '\n\nThe owner is in ' + shopScope_().name + ', where prices are usually in ' + shopScope_().cur + '. The owner shows prices in ' + settings_().currency + '.\n\n' + ctx.text + '\n\nFINISHED WINES (no bottles left):\n' + (finishedContext_().join('\n') || 'None yet.')
    : SOMMELIER_RULES + '\n\n' + ctx.text;
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
    system: system,
    messages: messages
  });
  var d = parseJson_(textOf_(res), 'The sommelier gave no answer. Please try again.');
  var ids = {};
  ctx.wines.forEach(function (w) { ids[String(w.id)] = true; });
  var picks = (Array.isArray(d.picks) ? d.picks : []).filter(function (p) { return p && ids[String(p.id)]; }).slice(0, 3)
    .map(function (p) { return { id: String(p.id), why: String(p.why || '') }; });
  var fit = d.fit === null || d.fit === undefined || d.fit === '' || isNaN(Number(d.fit)) ? null : Math.max(0, Math.min(100, Math.round(Number(d.fit))));
  var out = { answer: String(d.answer || ''), picks: picks, buy: check ? '' : String(d.buy || ''), wine: check ? String(d.wine || '') : '', fit: check ? fit : null };
  if (check && out.wine) {
    // the price in local shops of the country the owner is in, reused for 14 days
    var sc = shopScope_();
    out.country = sc.code;
    out.price = Number(d.price) > 0 ? Math.round(Number(d.price) * 100) / 100 : null;
    out.priceCur = CURRENCIES.indexOf(String(d.priceCur)) >= 0 ? String(d.priceCur) : sc.cur;
    out.priceWhere = String(d.priceWhere) === 'restaurant' ? 'restaurant' : out.price ? 'shop' : '';
    var key = offerKey_(out.wine);
    var mem = offerMemory_([key], true)[key];
    if (mem) out.offer = mem.offer;
    else {
      try { out.offer = offerFrom_(callClaude_(offerRequest_(out.wine, String(d.region || ''), 2))); } catch (e) { out.offer = null; }
      rememberOffers_([[key, out.offer]]);
    }
    out.offer = out.offer || null;
    if (!out.offer) {
      var wk = worldKey_(out.wine);
      var wm = offerMemory_([wk], true)[wk];
      if (wm) out.worldOffer = wm.offer;
      else {
        try { out.worldOffer = worldOfferFrom_(callClaude_(worldOfferRequest_(out.wine, String(d.region || '')))); } catch (e) { out.worldOffer = null; }
        rememberOffers_([[wk, out.worldOffer]]);
      }
      out.worldOffer = out.worldOffer || null;
    }
  }
  return out;
}

// ---------------------------------------------------------------- wine list in a restaurant

var WINELIST_RULES = [
  'You are an independent, experienced sommelier. The owner of a private cellar sits in a restaurant and sends photos of the pages of its wine list.',
  'Read every wine on all pages with producer, name, vintage and the price per bottle. Use bottle prices (0.75 l). Ignore prices by the glass, and mention half bottles or magnums only if nothing else fits.',
  'For each wine estimate its quality from your knowledge (critic consensus, reputation of producer and vintage) and its typical shop price in the currency of the list. The markup is the list price divided by that shop price.',
  'Choose exactly three different wines if the list allows it:',
  '1. "range": the best wine within the price range of the owner, judged by quality and by how well it suits the food. If no range is given, the best wine on the list overall that is still sensible to order.',
  '2. "value": the best ratio of quality to list price on the whole list.',
  '3. "gem": the wine that is priced too low compared with the rest of the list, so its markup is clearly below the average markup of this list, while its quality is good.',
  'If the owner says what they eat, all three must go well with it. Use the cellar, the finished wines and the ratings of the owner to judge how well each wine fits their taste, as "fit" from 0 to 100, and prefer wines that fit.',
  '"page" is the number of the photo where the wine appears, starting at 1. Prices are numbers in the currency of the list. Estimates are fine, but never invent a wine that is not on the list.',
  'Write in English. "why" is one or two sentences, "food" is one short sentence about the pairing or empty, "note" is two to three sentences about the list as a whole. Do not use dashes as punctuation.',
  'Return ONLY a JSON object, no other text: {"count": 47, "currency": "CHF", "avgMarkup": 2.8, "note": "text", "picks": [{"kind": "range|value|gem", "producer": "", "name": "", "vintage": 2019, "type": "Red|White|Rosé|Sparkling|Dessert|Fortified", "region": "region, country", "grapes": "", "listPrice": 78, "page": 2, "shopPrice": 45, "markup": 1.7, "fit": 80, "why": "", "food": ""}]}.'
].join('\n');

/** Photos of a restaurant wine list: the best wine in a price range, the best value and the hidden gem. */
function actionWineList_(req) {
  var pages = (Array.isArray(req.pages) ? req.pages : []).map(String).filter(Boolean);
  if (!pages.length) throw new Error('Take a photo of at least one page of the wine list');
  if (pages.length > 10) throw new Error('Up to 10 pages at a time');
  pages.forEach(function (b) { if (b.length > 1500000) throw new Error('A photo is too large'); });
  var min = Number(req.min) > 0 ? Number(req.min) : 0, max = Number(req.max) > 0 ? Number(req.max) : 0;
  var food = String(req.food || '').trim().slice(0, 500);
  scopeFrom_(req.country);
  var sc = shopScope_();
  var ctx = cellarContext_();
  var system = 'The restaurant is in ' + sc.name + ', so the list is probably in ' + sc.cur + '.\n' + WINELIST_RULES + '\n\n' + ctx.text + '\n\nFINISHED WINES (no bottles left):\n' + (finishedContext_().join('\n') || 'None yet.');
  var ask = 'These are ' + pages.length + ' ' + (pages.length === 1 ? 'page' : 'pages') + ' of the wine list. ' +
    (min || max ? 'My price range per bottle, in the currency of the list: ' + (min || 0) + ' to ' + (max || 'any') + '. ' : 'I have not set a price range. ') +
    (food ? 'We eat: ' + food : 'I have not said what we eat.');
  var content = pages.map(function (b) { return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b } }; });
  content.push({ type: 'text', text: ask });
  var res = callClaude_({ model: props_().getProperty('CLAUDE_MODEL') || DEFAULT_MODEL, max_tokens: 3000, system: system, messages: [{ role: 'user', content: content }] });
  var d = parseJson_(textOf_(res), 'The wine list could not be read. Take sharper photos and try again.');
  var num = function (v) { var n = Number(v); return n > 0 ? Math.round(n * 100) / 100 : null; };
  var kinds = ['range', 'value', 'gem'];
  var picks = (Array.isArray(d.picks) ? d.picks : []).filter(function (p) { return p && (p.name || p.producer) && kinds.indexOf(String(p.kind)) >= 0; })
    .map(function (p) {
      var fit = Number(p.fit);
      return {
        kind: String(p.kind), producer: String(p.producer || ''), name: String(p.name || ''), vintage: Number(p.vintage) > 1900 ? Number(p.vintage) : '',
        type: String(p.type || ''), region: String(p.region || ''), grapes: String(p.grapes || ''),
        listPrice: num(p.listPrice), page: Number(p.page) >= 1 ? Math.round(Number(p.page)) : null, shopPrice: num(p.shopPrice),
        markup: num(p.markup) || (num(p.listPrice) && num(p.shopPrice) ? Math.round(num(p.listPrice) / num(p.shopPrice) * 10) / 10 : null),
        fit: isNaN(fit) || p.fit === null || p.fit === '' ? null : Math.max(0, Math.min(100, Math.round(fit))),
        why: String(p.why || ''), food: String(p.food || '')
      };
    })
    .sort(function (a, b) { return kinds.indexOf(a.kind) - kinds.indexOf(b.kind); });
  if (!picks.length) throw new Error('No wines found on these photos. Take sharper photos of the pages and try again.');
  picks = picks.slice(0, 3);
  var listCur = CURRENCIES.indexOf(String(d.currency)) >= 0 ? String(d.currency) : sc.cur;
  // the real price in local shops for the three picks, all at the same time, reused for 14 days
  var label = function (p) { return [p.producer, p.name, p.vintage].filter(String).join(' '); };
  var mem = offerMemory_(picks.map(function (p) { return offerKey_(label(p)); }), true);
  var search = picks.filter(function (p) { return !mem[offerKey_(label(p))]; });
  var found = {};
  if (search.length && elapsed_() < TIME_HARD) {
    var replies = callClaudeMany_(search.map(function (p) { return offerRequest_(label(p), p.region, 2); }));
    rememberOffers_(search.map(function (p, i) { var o = offerFrom_(replies[i]); found[offerKey_(label(p))] = o; return [offerKey_(label(p)), o]; }));
  }
  picks.forEach(function (p) { var k = offerKey_(label(p)); p.offer = (mem[k] ? mem[k].offer : found[k]) || null; });
  var missing = picks.filter(function (p) { return !p.offer; });
  if (missing.length) {
    var wmem = offerMemory_(missing.map(function (p) { return worldKey_(label(p)); }), true);
    var wsearch = missing.filter(function (p) { return !wmem[worldKey_(label(p))]; });
    var wfound = {};
    if (wsearch.length && elapsed_() < TIME_HARD) {
      var wreplies = callClaudeMany_(wsearch.map(function (p) { return worldOfferRequest_(label(p), p.region); }));
      rememberOffers_(wsearch.map(function (p, i) { var o = worldOfferFrom_(wreplies[i]); wfound[worldKey_(label(p))] = o; return [worldKey_(label(p)), o]; }));
    }
    missing.forEach(function (p) { var k = worldKey_(label(p)); p.worldOffer = (wmem[k] ? wmem[k].offer : wfound[k]) || null; });
  }
  picks.forEach(function (p) {
    var o = p.offer || p.worldOffer;
    p.estPrice = p.shopPrice;
    var fx = fxRates_().rates || {};
    if (o && p.listPrice && (o.cur === listCur || (fx[o.cur] && fx[listCur]))) {
      var inList = convert_(o.v, o.cur, listCur);
      p.shopPrice = Math.round(inList * 100) / 100;
      p.markup = Math.round(p.listPrice / inList * 10) / 10;
    }
  });
  return { country: sc.code, count: Number(d.count) > 0 ? Math.round(Number(d.count)) : null, pages: pages.length,
    avgMarkup: num(d.avgMarkup), note: String(d.note || ''), food: food, min: min, max: max, picks: picks, currency: listCur };
}

// ---------------------------------------------------------------- AI consultant and wishlist

var CONSULTANT_RULES = [
  'You are an independent wine consultant who helps the owner of a private cellar decide which wines to buy next.',
  'You get the profile of the owner, the cellar with stock, ratings and prices, wines already finished and the journal of bottles opened.',
  'Recommend exactly 8 wines that are NOT in the cellar list, ranked best first. Only real wines that online shops where the owner buys currently sell, preferably widely distributed ones. Avoid rarities and allocated wines.',
  'Rules:',
  '1. Fit the taste of the owner: styles, grapes and regions they rate highly and drink often. Avoid styles they rated low.',
  '2. Respect the budget per bottle. Prefer wines with an outstanding price to quality ratio, for example from lesser known producers or regions.',
  '3. Plan quantities sensibly. Compare the stock of each style with how fast the owner drinks it. Where the stock is large, only suggest small quantities of a clearly different style. Where stock is low compared to consumption, suggest more bottles.',
  '4. A suggestion may replace a wine in stock with few bottles left (1 to 3) when it has better ratings and a better price to quality ratio. Then give the id of that wine in "replaces" and the reason in "replaceWhy". Otherwise leave both empty.',
  '5. Mix the labels: "Safe bet" (close to their favorites), "Discovery" (new grape or region that fits their taste), "Top value" (outstanding price to quality).',
  '6. "price" is your estimate of the typical shop price per bottle in the currency of the budget. "vintage" is a recommended recent vintage as a number, or null.',
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
  var sc = shopScope_();
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
  var area = sc.name;
  text += '\n\nThe owner buys from ' + sc.where + '. Budget and prices in the profile are in ' + cur + '.';
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
  var picks = (Array.isArray(d.picks) ? d.picks : []).filter(function (p) { return p && (p.name || p.producer); }).slice(0, 8).map(function (p) {
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
  // only wines that a shop really sells: check the best 5 with one search each, refill only while fewer than 3 have a shop
  var max = req.budget ? Number(req.budget.max) || 0 : 0;
  var queue = picks.slice();
  var verified = [], over = [];
  var label = function (p) { return [p.producer, p.name, p.vintage].filter(String).join(' '); };
  var first = true;
  while (queue.length && (first || verified.length < 3)) {
    if (elapsed_() > TIME_HARD || (verified.length >= 3 && elapsed_() > TIME_SOFT)) break;
    var wave = queue.splice(0, first ? 5 : 3 - verified.length);
    first = false;
    var mem = offerMemory_(wave.map(function (p) { return offerKey_(label(p)); }), true);
    var search = wave.filter(function (p) { return !mem[offerKey_(label(p))]; });
    var found = {};
    if (search.length) {
      var replies = callClaudeMany_(search.map(function (p) { return offerRequest_(label(p), p.region, 1); }));
      var pairs = search.map(function (p, i) { var o = offerFrom_(replies[i]); found[offerKey_(label(p))] = o; return [offerKey_(label(p)), o]; });
      rememberOffers_(pairs);
    }
    wave.forEach(function (p) {
      var k = offerKey_(label(p));
      var o = mem[k] ? mem[k].offer : found[k];
      if (!o) return;
      p.offer = o;
      p.price = o.v;
      p.priceCur = o.cur;
      var q = Math.max(1, p.qty);
      var ship = o.freeFrom && o.v * q >= o.freeFrom ? 0 : (o.shipping || 0);
      var total = convert_(o.v + ship / q, o.cur, cur);
      (max && total > max * 1.25 ? over : verified).push(p);
    });
  }
  if (verified.length < 3) verified = verified.concat(over).slice(0, 5);
  if (!verified.length) throw new Error('None of the suggested wines is sold online in ' + area + ' right now. Please try again, maybe with another focus or budget.');
  return { summary: String(d.summary || ''), picks: verified.slice(0, 5) };
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
// busy or rate limited answers are tried again after a short wait
var RETRY_CODES = [429, 500, 502, 503, 504, 529];
function retryWait_(res, attempt) {
  var h = {};
  try { h = res.getHeaders() || {}; } catch (e) { h = {}; }
  var after = Number(h['retry-after'] || h['Retry-After'] || 0);
  return Math.min(15000, after > 0 ? after * 1000 : 3000 * (attempt + 1));
}
function apiError_(code, txt) {
  var msg = txt;
  try { msg = JSON.parse(txt).error.message; } catch (e) { /* keep raw */ }
  if (/workspace/i.test(msg)) msg += ' Create a new key with Workspace set to Default (guide, step 3).';
  else if (code === 401) msg += ' The key is wrong, expired or deleted. Create a new one in the Claude Console.';
  else if (/credit|balance|billing/i.test(msg)) msg += ' Add credit in the Claude Console under Billing.';
  else if (code === 429) msg = 'Too many AI requests at the same time. Wait a minute and try again.';
  else if (code === 529 || code >= 500) msg = 'The AI service is busy right now. Try again in a few minutes.';
  return 'Claude API ' + code + ': ' + msg;
}

function callClaudeMany_(bodies) {
  var headers = claudeHeaders_();
  var state = bodies.map(function (b) { return { body: b, messages: b.messages.slice(), out: null, done: false, err: '', tries: 0 }; });
  for (var turn = 0; turn < 6; turn++) {
    var open = state.filter(function (x) { return !x.done; });
    if (!open.length || (turn > 0 && elapsed_() > TIME_HARD)) break;
    var replies = UrlFetchApp.fetchAll(open.map(function (x) {
      return { url: 'https://api.anthropic.com/v1/messages', method: 'post', contentType: 'application/json', headers: headers,
        payload: JSON.stringify(Object.assign({}, x.body, { messages: x.messages })), muteHttpExceptions: true };
    }));
    var wait = 0;
    open.forEach(function (x, i) {
      var r = replies[i], code = r.getResponseCode();
      if (code !== 200) {
        x.err = apiError_(code, r.getContentText());
        if (RETRY_CODES.indexOf(code) >= 0 && x.tries < 2) { x.tries++; wait = Math.max(wait, retryWait_(r, x.tries)); return; }
        x.done = true; x.out = null; return;
      }
      x.err = '';
      x.out = JSON.parse(r.getContentText());
      noteUsage_(x.body.model, x.out.usage);
      if (x.out.stop_reason === 'pause_turn') x.messages.push({ role: 'assistant', content: x.out.content });
      else x.done = true;
    });
    if (wait && elapsed_() + wait < TIME_HARD) Utilities.sleep(wait);
  }
  var out = state.map(function (x) { return x.done ? x.out : null; });
  out.errors = state.map(function (x) { return x.out && x.done ? '' : (x.err || 'No answer from the AI in time'); });
  return out;
}

function callClaude_(body) {
  var headers = claudeHeaders_();
  var messages = body.messages.slice();
  var out = null, tries = 0;
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
      if (RETRY_CODES.indexOf(code) >= 0 && tries < 2 && elapsed_() < TIME_HARD) { tries++; Utilities.sleep(retryWait_(res, tries)); turn--; continue; }
      throw new Error(apiError_(code, txt));
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
