// ════════════════════════════════════════════════════════════════
// Ad Simulator + Advertising Settings translations (js/workspaceI18n.js).
// Every English text the two pages send through T() must exist in nl, de,
// fr, es and pt, with the same {placeholders} and the same HTML tags; and
// the real-account verification flags must stay off until a real-account
// test has actually been done (see REAL_ACCOUNT_VERIFIED in adSettings.js).
// RUN: node tests/workspace-i18n.test.js   (no network, no browser)
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
process.chdir(path.join(__dirname, '..'));
let pass = 0, fail = 0;
const check = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + n + (ok || info === undefined ? '' : ' :: ' + JSON.stringify(info).slice(0, 600))); };

// 1. The texts on the pages (literal T('…') calls, ternaries inside T(), card titles, button and busy labels, copy tables)

const LIT = "'((?:[^'\\\\]|\\\\.)*)'";
const keys = new Set(['cost per click', 'cost per 1,000 impressions']);
const add = (k) => { if (k && /[A-Za-z]/.test(k)) keys.add(k.replace(/\\'/g, "'")); };
function all(re, s, g = 1) { for (const m of s.matchAll(re)) add(m[g]); }
for (const f of ['js/adSimulator.js', 'js/adSettings.js']) {
  const s = fs.readFileSync(f, 'utf8');
  all(new RegExp('\\bT\\(' + LIT, 'g'), s);                                   // T('…')
  all(new RegExp('\\bT\\([^()\']*\\? ' + LIT + ' : ' + LIT, 'g'), s, 1);      // T(x ? 'a' : 'b')
  all(new RegExp('\\bT\\([^()\']*\\? ' + LIT + ' : ' + LIT, 'g'), s, 2);
  all(new RegExp('\\bT\\([^()\']*\\? ' + LIT + ' : [^\'()]*\\? ' + LIT + ' : ' + LIT, 'g'), s, 1);
  all(new RegExp('\\bT\\([^()\']*\\? ' + LIT + ' : [^\'()]*\\? ' + LIT + ' : ' + LIT, 'g'), s, 2);
  all(new RegExp('\\bT\\([^()\']*\\? ' + LIT + ' : [^\'()]*\\? ' + LIT + ' : ' + LIT, 'g'), s, 3);
  all(new RegExp("card\\('[^']*', " + LIT, 'g'), s);                          // card titles
  all(new RegExp("busyBtn\\('[^']*', " + LIT, 'g'), s);                       // button labels
  all(new RegExp("run\\('?[^,]*'?, " + LIT, 'g'), s);                          // busy labels
  all(new RegExp("S\\.busy\\.\\w+ = " + LIT, 'g'), s);
  all(new RegExp("label: " + LIT, 'g'), s);                                    // LINKS labels
  // arrays/maps of copy
  for (const name of ['OBJ', 'WHERE']) { const m = s.match(new RegExp('var ' + name + ' = \\{([^}]*)\\}')); if (m) all(new RegExp(': ' + LIT, 'g'), m[1]); }
  const sure = s.match(/var SURE = \{([^\n]*)\};/); if (sure) all(new RegExp(LIT, 'g'), sure[1]);
  for (const name of ['WI', 'CMP']) { const m = s.match(new RegExp('var ' + name + ' = (\\[[^\\n]*\\]);')); if (m) all(new RegExp("\\['\\w+', " + LIT, 'g'), m[1]); }
  const mx = s.match(/var MATRIX = \{([\s\S]*?)\n  \};/); if (mx) all(new RegExp(LIT, 'g'), mx[1]);
  const dl = s.match(/var dl = \[([\s\S]*?)\]\];/); if (dl) all(new RegExp("\\['" + "([^']*)" + "', T", 'g'), dl[1]);
  const mm = s.match(/\(\{ revenue: [^)]*\}\)/); if (mm) all(new RegExp(LIT, 'g'), mm[0]);
}
['native', 'partial', 'guided', 'none'].forEach((k) => keys.delete(k));
for (const k of ['meta', 'google', 'tiktok', 'pinterest', 'snapchat', 'sales', 'leads', 'traffic', 'awareness']) keys.delete(k);

const KEYS = [...keys];
check('the pages send a realistic number of texts through T() (extraction works)', KEYS.length > 300, KEYS.length);

// 2. The dictionary
const window = {};
new Function('window', fs.readFileSync('js/workspaceI18n.js', 'utf8'))(window);
const D = window.ORV_WS_I18N;
const LANGS = ['nl', 'de', 'fr', 'es', 'pt'];
check('five languages', LANGS.every((l) => D[l] && typeof D[l] === 'object'), Object.keys(D));
const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
const tags = (s) => (String(s).match(/<\/?[a-z][^>]*>/g) || []).join('');
for (const l of LANGS) {
  const missing = KEYS.filter((k) => !(k in D[l]));
  check(l + ': every text on both pages is translated', missing.length === 0, missing.slice(0, 8));
  const badPh = KEYS.filter((k) => k in D[l] && ph(k) !== ph(D[l][k]));
  check(l + ': the same {placeholders} as the English', badPh.length === 0, badPh.slice(0, 5).map((k) => [k, D[l][k]]));
  const badTags = KEYS.filter((k) => k in D[l] && tags(k) !== tags(D[l][k]));
  check(l + ': the same HTML tags as the English', badTags.length === 0, badTags.slice(0, 5));
  const empty = Object.keys(D[l]).filter((k) => !String(D[l][k]).trim());
  check(l + ': no empty translations', empty.length === 0, empty);
  const extra = Object.keys(D[l]).filter((k) => KEYS.indexOf(k) < 0);
  check(l + ': no leftover entries for texts the pages no longer use', extra.length === 0, extra.slice(0, 8));
}

// 3. orvWsT: translates, fills placeholders, falls back to English
global.CURRENT_LANG = 'nl';
check('orvWsT translates and fills placeholders', window.orvWsT('Connect {p}', { p: 'Meta Ads' }) === 'Koppel Meta Ads');
global.CURRENT_LANG = 'xx';
check('orvWsT falls back to English for an unknown language', window.orvWsT('Prepare for {p}', { p: 'TikTok Ads' }) === 'Prepare for TikTok Ads');
global.CURRENT_LANG = 'en';
check('English is the source text', window.orvWsT('Scenario Lab') === 'Scenario Lab');

// 4. Real-account verification: never claimed before it has happened
const set = fs.readFileSync('js/adSettings.js', 'utf8');
const flags = set.match(/var REAL_ACCOUNT_VERIFIED = (\{[^}]*\});/);
check('Meta, Google, Pinterest and TikTok actions are marked as not yet verified with a real ad account', !!flags && /meta: false/.test(flags[1]) && /google: false/.test(flags[1]) && /pinterest: false/.test(flags[1]) && /tiktok: false/.test(flags[1]), flags && flags[1]);
check('every native action card carries the notice (unverified() in each Meta, Google, Pinterest and TikTok card)', ['meta', 'google', 'pinterest', 'tiktok'].every((p) => set.indexOf("unverified('" + p + "')") >= 0));

console.log(`
${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
process.exitCode = fail ? 1 : 0;
