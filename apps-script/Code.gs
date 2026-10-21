/**
 * John Mize Real Estate: client intake backend (Google Apps Script)
 *
 * Receives a submission from intake.johnmizerealestate.com, then:
 *   1. Emails John the scan-friendly version (sections + tracker row)
 *   2. Emails the client a friendly copy of their answers
 *   3. Adds one row to the "Intake" tab of this Google Sheet
 *
 * Setup steps are in README.md.  Only the CONFIG block needs editing.
 */

var CONFIG = {
  NOTIFY_TO: 'john.mize@c21center.com',   // where John's copy goes
  REPLY_TO:  'john.mize@c21center.com',   // where client replies go
  FROM_NAME: 'John Mize Real Estate',
  SHEET_TAB: 'Intake',
  MAX_PER_HOUR: 20                    // spam brake: ignore submissions past this
};

function doPost(e) {
  try {
    var p = JSON.parse(e.postData.contents);

    // Honeypot: flag instead of drop, so a real client whose browser autofilled it isn't lost
    var spam = !!p.website;
    if (spam) console.warn('Honeypot filled: ' + p.website);

    // Rate limit
    var cache = CacheService.getScriptCache();
    var key = 'count_' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH');
    var n = Number(cache.get(key) || 0);
    if (n >= CONFIG.MAX_PER_HOUR) { console.warn('Rate limit hit'); return reply_(false, 'busy'); }
    cache.put(key, String(n + 1), 3600);

    // Basic shape check
    if (!p.name || !Array.isArray(p.sections) || !Array.isArray(p.columns) || !Array.isArray(p.values)) {
      return reply_(false, 'bad request');
    }

    // 1. Email to John
    var j = johnEmail(p);
    if (spam) j.subject = '[CHECK: possible spam] ' + j.subject;
    var opts = { htmlBody: j.html, name: 'Intake Form' };
    if (validEmail_(p.email)) opts.replyTo = p.email;
    MailApp.sendEmail(CONFIG.NOTIFY_TO, j.subject, stripHtml_(j.html), opts);

    // 2. Confirmation to client
    if (!spam && validEmail_(p.email)) {
      var c = clientEmail(p);
      MailApp.sendEmail(p.email, c.subject, stripHtml_(c.html), {
        htmlBody: c.html, name: CONFIG.FROM_NAME, replyTo: CONFIG.REPLY_TO
      });
    }

    // 3. Tracker row
    appendRow_(p);

    return reply_(true);
  } catch (err) {
    console.error(err);
    return reply_(false, 'error');
  }
}

function appendRow_(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_TAB) || ss.insertSheet(CONFIG.SHEET_TAB);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var lastCol = sh.getLastColumn();
    var header = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    // Add any new columns (lets you add questions later without breaking the sheet)
    p.columns.forEach(function (c) { if (header.indexOf(c) === -1) header.push(c); });
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sh.setFrozenRows(1);
    var map = {};
    p.columns.forEach(function (c, k) { map[c] = p.values[k]; });
    var row = header.map(function (h) {
      var v = map[h] == null ? '' : String(map[h]);
      return /^[=+\-@]/.test(v) ? "'" + v : v;   // block formula injection
    });
    sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}

function validEmail_(s) { return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function stripHtml_(h) { return h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|tr|table|div)>/gi, '\n').replace(/<\/t[dh]>/gi, '\t').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'); }
function reply_(ok, msg) {
  return ContentService.createTextOutput(JSON.stringify({ ok: ok, msg: msg || '' })).setMimeType(ContentService.MimeType.JSON);
}

/* Run once from the editor to approve permissions and send yourself a sample */
function testSend() {
  doPost({ postData: { contents: JSON.stringify({
    ts: '2026-10-21 07:00', plan: 'Buying', name: 'Test Client', coName: '', mobile: '206-555-0100', email: CONFIG.NOTIFY_TO,
    buyTL: '0-3 mo', listTL: '', website: '',
    sections: [{ code: 'CONTACT', title: 'About you', rows: [['Name', 'Name', 'Test Client'], ['Mobile', 'Mobile', '206-555-0100']] }],
    columns: ['Submitted', 'Name', 'Mobile'], values: ['2026-10-21 07:00', 'Test Client', '206-555-0100']
  }) } });
}

/* ===== SHARED EMAIL BUILDERS: keep identical to the copy in Code.gs ===== */
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function johnEmail(p){
  var tl = [p.listTL ? 'Sell ' + p.listTL : '', p.buyTL ? 'Buy ' + p.buyTL : ''].filter(Boolean).join(' / ');
  var subject = ['INTAKE', p.name + (p.coName ? ' + ' + p.coName : ''), p.plan, tl].filter(Boolean).join(' | ');
  var font = "font-family:Consolas,Menlo,'Courier New',monospace;font-size:13px;";
  var td = "padding:4px 10px;border:1px solid #d0d0d0;vertical-align:top;";
  var html = '<div style="' + font + 'color:#1b1b1b">';
  html += '<div style="margin-bottom:10px">' + [p.plan, p.name, p.mobile, p.email, p.ts].map(esc).join(' | ') + '</div>';
  p.sections.forEach(function(s){
    html += '<table style="border-collapse:collapse;margin:0 0 14px;' + font + '"><tr><th colspan="2" style="' + td + 'text-align:left;background:#16263f;color:#ffffff;letter-spacing:.05em">' + esc(s.code) + '</th></tr>';
    s.rows.forEach(function(r){ html += '<tr><td style="' + td + 'color:#555555;white-space:nowrap">' + esc(r[0]) + '</td><td style="' + td + 'white-space:pre-wrap">' + esc(r[2]) + '</td></tr>'; });
    html += '</table>';
  });
  html += '<div style="margin:6px 0 4px;color:#555555">TRACKER (one row, fixed columns)</div><table style="border-collapse:collapse;' + font + '"><tr>';
  html += p.columns.map(function(c){ return '<th style="' + td + 'background:#eef1ee;text-align:left;white-space:nowrap">' + esc(c) + '</th>'; }).join('');
  html += '</tr><tr>' + p.values.map(function(v){ return '<td style="' + td + 'white-space:nowrap">' + esc(String(v).replace(/\s*\n\s*/g, ' / ')) + '</td>'; }).join('') + '</tr></table></div>';
  return { subject: subject, html: html };
}
function clientEmail(p){
  var first = esc((p.name || '').trim().split(/\s+/)[0]);
  var font = "font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1b2330;";
  var td = "padding:6px 10px;border-bottom:1px solid #e3e6e2;vertical-align:top;font-size:14px;";
  var html = '<div style="' + font + 'max-width:620px">';
  html += '<p>Hi ' + first + ',</p><p>Thanks for taking the time.  Here\'s a copy of what you sent me.  I\'ll review it before we talk.  If anything changes, just reply to this email.</p>';
  p.sections.forEach(function(s){
    html += '<p style="margin:22px 0 6px;font-weight:bold;color:#16263f;border-bottom:2px solid #b8892b;padding-bottom:4px">' + esc(s.title) + '</p><table style="border-collapse:collapse;width:100%">';
    s.rows.forEach(function(r){ html += '<tr><td style="' + td + 'color:#5b6573;width:42%">' + esc(r[1]) + '</td><td style="' + td + 'white-space:pre-wrap">' + esc(r[2]) + '</td></tr>'; });
    html += '</table>';
  });
  html += '<p style="margin-top:26px">John Mize<br>Real Estate Broker<br>Century 21 Real Estate Center<br>206-465-4209</p></div>';
  return { subject: 'Copy of your answers | John Mize Real Estate', html: html };
}
/* ===== END SHARED ===== */
