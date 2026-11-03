/**
 * Wine Cellar API
 * Google Apps Script bound to the "Wine Cellar" Google Sheet.
 *
 * One-time setup: select the function "setup" above and click Run.
 * Script properties used:
 *   APP_TOKEN              created by setup, paste it into the app
 *   ANTHROPIC_API_KEY      your Claude API key (sk-ant-...)
 *   ANTHROPIC_WORKSPACE_ID optional, only if Claude asks for a workspace id
 *   CLAUDE_MODEL           optional, defaults to claude-sonnet-5-5
 */

var SHEETS = { wines: 'Wines', removals: 'Removals', locations: 'Locations' };

var WINE_COLS = [
  'id', 'producer', 'name', 'vintage', 'type', 'region', 'grapes', 'taste', 'tasteTags', 'pairings',
  'drinkFrom', 'peakFrom', 'peakUntil', 'drinkUntil', 'location', 'shelf', 'position', 'count',
  'myRating', 'ratings', 'labelFileId', 'thumb', 'createdAt', 'updatedAt',
  'retailer', 'purchaseDate', 'purchasePrice', 'streetPrice', 'acquired', 'giftFrom'
];
var REMOVAL_COLS = ['id', 'wineId', 'date', 'type', 'occasion', 'people', 'food', 'note', 'wineName', 'hearts'];

// Raise this when columns are added. The script then adds missing columns by itself on the next request.
var SCHEMA_VERSION = '4';
var LOCATION_COLS = ['name'];

var DEFAULT_MODEL = 'claude-sonnet-5-5';

var ACTIONS = {
  ping: function () { return { pong: true, version: 1 }; },
  load: actionLoad_,
  saveWine: actionSaveWine_,
  update: actionUpdate_,
  adjust: actionAdjust_,
  removeBottle: actionRemoveBottle_,
  deleteWine: actionDeleteWine_,
  deleteRemoval: actionDeleteRemoval_,
  updateRemoval: actionUpdateRemoval_,
  image: actionImage_,
  analyze: actionAnalyze_,
  addLocation: actionAddLocation_,
  deleteLocation: actionDeleteLocation_
};

// ---------------------------------------------------------------- setup

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var p = props_();
  p.setProperty('SHEET_ID', ss.getId());

  p.deleteProperty('SCHEMA_VERSION');
  ensureSchema_();

  ss.getSheets().forEach(function (sh) {
    var n = sh.getName();
    var ours = n === SHEETS.wines || n === SHEETS.removals || n === SHEETS.locations;
    if (!ours && sh.getLastRow() === 0 && sh.getLastColumn() === 0 && ss.getSheets().length > 3) ss.deleteSheet(sh);
  });

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
      if (head.indexOf(c) < 0) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(c).setFontWeight('bold');
      }
    });
  }
  return sh;
}

/** Adds missing tabs and columns without touching existing data. Runs once per schema version. */
function ensureSchema_() {
  var p = props_();
  if (p.getProperty('SCHEMA_VERSION') === SCHEMA_VERSION) return;
  withLock_(function () {
    if (p.getProperty('SCHEMA_VERSION') === SCHEMA_VERSION) return;
    var ss = ss_();
    textColumn_(ensureSheet_(ss, SHEETS.wines, WINE_COLS), 'purchaseDate');
    textColumn_(ensureSheet_(ss, SHEETS.removals, REMOVAL_COLS), 'date');
    ensureSheet_(ss, SHEETS.locations, LOCATION_COLS);
    p.setProperty('SCHEMA_VERSION', SCHEMA_VERSION);
  });
}

function textColumn_(sh, name) {
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var col = head.indexOf(name) + 1;
  if (col > 0) sh.getRange(1, col, sh.getMaxRows(), 1).setNumberFormat('@');
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
  return json_({ ok: true, service: 'wine-cellar', hint: 'Use POST from the Wine Cellar app.' });
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

// ---------------------------------------------------------------- actions

function actionLoad_() {
  return {
    wines: readAll_(SHEETS.wines),
    removals: readAll_(SHEETS.removals),
    locations: readAll_(SHEETS.locations).map(function (r) { return String(r.name); }).filter(String)
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
    Object.keys(wine).forEach(function (k) { merged[k] = wine[k]; });
    merged.createdAt = existing && existing.createdAt ? existing.createdAt : now;
    merged.updatedAt = now;
    if (merged.count === '' || merged.count === null || merged.count === undefined) merged.count = 0;

    writeRow_(t, idx, merged);
    return merged;
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
      if (k !== 'id' && k !== 'createdAt') obj[k] = fields[k];
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
    obj.count = Math.max(0, (Number(obj.count) || 0) + (Number(req.delta) || 0));
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
    obj.count = Math.max(0, (Number(obj.count) || 0) - 1);
    obj.updatedAt = new Date().toISOString();
    writeRow_(t, idx, obj);

    var removal = {};
    REMOVAL_COLS.forEach(function (c) { removal[c] = r[c] === undefined || r[c] === null ? '' : r[c]; });
    if (!removal.id) removal.id = 'r' + new Date().getTime().toString(36);
    if (!removal.date) removal.date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var rt = table_(SHEETS.removals);
    writeRow_(rt, -1, removal);
    return { wine: obj, removal: removal };
  });
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

function actionUpdateRemoval_(req) {
  if (!req.id) throw new Error('Missing entry id');
  return withLock_(function () {
    var t = table_(SHEETS.removals);
    var idx = findIndex_(t, req.id);
    if (idx < 0) throw new Error('Journal entry not found');
    var obj = toObj_(t.headers, t.rows[idx]);
    var f = req.fields || {};
    ['date', 'type', 'occasion', 'people', 'hearts', 'food', 'note'].forEach(function (k) {
      if (f[k] !== undefined && f[k] !== null) obj[k] = f[k];
    });
    writeRow_(t, idx, obj);
    return obj;
  });
}

function actionImage_(req) {
  if (!req.fileId) throw new Error('Missing file id');
  var blob = DriveApp.getFileById(req.fileId).getBlob();
  return { mime: blob.getContentType() || 'image/jpeg', data: Utilities.base64Encode(blob.getBytes()) };
}

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

function actionDeleteLocation_(req) {
  var name = String(req.name || '').trim();
  if (!name) throw new Error('Missing location name');
  return withLock_(function () {
    var inUse = readAll_(SHEETS.wines).some(function (w) {
      return String(w.location).toLowerCase() === name.toLowerCase() && Number(w.count) > 0;
    });
    if (inUse) throw new Error('This location still has bottles in stock');
    var sh = sheet_(SHEETS.locations);
    var vals = sh.getDataRange().getValues();
    for (var i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][0]) === name) sh.deleteRow(i + 1);
    }
    return readAll_(SHEETS.locations).map(function (r) { return String(r.name); }).filter(String);
  });
}

// ---------------------------------------------------------------- Claude label analysis

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
  'Use null for anything you cannot determine. Do not include ratings or scores.'
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
  var text = callClaude_(content, 1500);
  var s = text.indexOf('{');
  var en = text.lastIndexOf('}');
  if (s < 0 || en <= s) throw new Error('The AI returned no wine data');
  return JSON.parse(text.slice(s, en + 1));
}

/**
 * Run this once from the editor after adding ANTHROPIC_API_KEY.
 * The execution log then shows either "Claude API works" or the exact problem.
 */
function testClaude() {
  var answer = callClaude_([{ type: 'text', text: 'Reply with the single word OK.' }], 10);
  Logger.log('Claude API works. Answer: ' + answer);
}

function callClaude_(content, maxTokens) {
  var p = props_();
  var key = (p.getProperty('ANTHROPIC_API_KEY') || '').trim();
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set in the script properties');
  var headers = { 'Authorization': 'Bearer ' + key, 'anthropic-version': '2023-06-01' };
  var ws = (p.getProperty('ANTHROPIC_WORKSPACE_ID') || '').trim();
  if (ws) headers['anthropic-workspace-id'] = ws;
  var body = {
    model: p.getProperty('CLAUDE_MODEL') || DEFAULT_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: content }]
  };
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(body),
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
  var out = JSON.parse(txt);
  return (out.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
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
    var where = [w.location, w.shelf ? 'shelf ' + w.shelf : '', w.position].filter(String).join(', ');
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
  if (idx >= 0) t.sh.getRange(idx + 2, 1, 1, row.length).setValues([row]);
  else t.sh.appendRow(row);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function esc_(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}
