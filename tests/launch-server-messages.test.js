/* ════════════════════════════════════════════════════════════════
   Launch — server messages in six languages (js/serverI18n.js).

   Offline: no browser, no network, no Supabase. The frontend translation
   files run in a sandbox; the backend's real services/campaignSpec.js,
   setupStateEngine.js, publishRoutes.js and campaignActivation.js are read
   (and campaignSpec is executed) to check that:
     A. every code / variant the backend can send has a translation in
        en, nl, de, fr, es and pt;
     B. every placeholder a translation uses is a param the backend sends,
        and all six languages use the same placeholders;
     C. real validate() / checklist() / applyChanges() output renders in
        every language: English = the server's text, others translated,
        values filled in (countries / goals localised), nothing left raw;
     D. fallbacks: unknown code, no code, missing params (older server);
     E. setup reasons and coded publish / activation errors.
   The visible re-render on a language switch is covered in a real browser
   by tests/launch-readiness.test.js.
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), vm = require('vm');
const FE = path.resolve(__dirname, '..');
const BE = process.env.ORIVEN_BACKEND_DIR || path.resolve(FE, '..', 'oriven-backend', 'server');
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS — ' + name); }
  else { fail++; console.log('FAIL — ' + name + (detail !== undefined ? ' | ' + JSON.stringify(detail).slice(0, 600) : '')); }
}
if (!fs.existsSync(path.join(BE, 'services', 'campaignSpec.js'))) { console.log('SKIP — backend not found at ' + BE); process.exit(0); }
const LANGS = ['en', 'nl', 'de', 'fr', 'es', 'pt'];

// ── Frontend sandbox: settings.js-style t() + the Launch translation files ──
const sb = { console, Intl, LANG_STRINGS: {}, CURRENT_LANG: 'en' };
LANGS.forEach((l) => { sb.LANG_STRINGS[l] = {}; });
sb.window = sb;
sb.document = { readyState: 'complete', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; } };
vm.createContext(sb);
vm.runInContext('function t(key){ var l = LANG_STRINGS[CURRENT_LANG] || LANG_STRINGS.en; return l[key] || LANG_STRINGS.en[key] || key; }', sb);
['js/launchI18n.js', 'js/specI18n.js', 'js/serverI18n.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(FE, f), 'utf8'), sb, { filename: f }));
// Create's compatibility reasons (js/createFlow.js STR), for compat_* / tiktok_goal.
let createSTR = null;
try {
  const cs = { console, Intl, window: {}, document: sb.document, CURRENT_LANG: 'en', setTimeout() {}, clearTimeout() {} };
  cs.window = cs; cs.OrivenCreateCompat = require(path.join(BE, 'services', 'createCompat.js')); cs.window.OrivenCreateCompat = cs.OrivenCreateCompat;
  vm.createContext(cs);
  vm.runInContext(fs.readFileSync(path.join(FE, 'js', 'createFlow.js'), 'utf8'), cs, { filename: 'createFlow.js' });
  createSTR = cs.orvCreate && cs.orvCreate._STR;
} catch (e) { createSTR = null; }
check('js/createFlow.js translations load (compat reasons)', !!createSTR, 'createFlow did not expose _STR');
if (createSTR) sb.orvCreate = { _STR: createSTR };
const setLang = (l) => { sb.CURRENT_LANG = l; };
const T = sb.orvTx;
const has = (l, k) => Object.prototype.hasOwnProperty.call(sb.LANG_STRINGS[l], k);
const holes = (s) => (String(s).match(/\{[a-zA-Z]+\}/g) || []).sort();

// ── Backend source: every add()/no() call, string-aware ──
function calls(src, fname) {
  const out = []; let i = 0;
  const re = new RegExp('\\b' + fname + '\\(', 'g'); let m;
  while ((m = re.exec(src))) {
    let j = m.index + m[0].length, depth = 1, q = null;
    const args = []; let cur = '';
    for (; j < src.length && depth > 0; j++) {
      const ch = src[j];
      if (q) { cur += ch; if (ch === '\\') { cur += src[++j]; continue; } if (ch === q) q = null; continue; }
      if (ch === "'" || ch === '"' || ch === '`') { q = ch; cur += ch; continue; }
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      if (ch === ')' || ch === '}' || ch === ']') { depth--; if (depth === 0) break; }
      if (ch === ',' && depth === 1) { args.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    args.push(cur.trim());
    out.push(args);
  }
  return out;
}
const lit = (a) => { const m = /^'([^']*)'$/.exec(a || ''); return m ? m[1] : null; };
const specSrc = fs.readFileSync(path.join(BE, 'services', 'campaignSpec.js'), 'utf8');
const vStart = specSrc.indexOf('function validate('), vEnd = specSrc.indexOf('const hasErrors');
const addCalls = calls(specSrc.slice(vStart, vEnd), 'add').filter((a) => a.length >= 4 && lit(a[0]));
const paramKeys = (x) => { const m = /params:\s*\{([^}]*)\}/.exec(x || ''); return m ? m[1].split(',').map((p) => p.trim().split(':')[0].trim()).filter(Boolean) : []; };
const variants = (x) => { const v = []; const re = /variant:\s*(?:[^,{}]*?\?\s*)?'(\w+)'/g; let m; while ((m = re.exec(x || ''))) v.push(m[1]); return v; };

// A. Issue codes → keys in all six languages; B. placeholders ⊆ params.
const issueKeys = new Map(); // key -> params the backend sends
let shown = 0;
for (const a of addCalls) {
  const level = lit(a[0]), code = lit(a[2]), extra = a[4] || '';
  if (!code) { check('add() with a computed code is a known compat issue', /'compat_' \+ iss\.code/.test(a[2]), a[2]); continue; }
  if (code === 'live_unverified') continue; // developer note, never shown (info)
  if (code === 'tiktok_goal') continue;     // Create's own reason text (createFlow r_tiktok_goal_*)
  const vs = variants(extra), params = paramKeys(extra);
  const keys = vs.map((v) => 'sv_' + code + '__' + v);
  if (!vs.length || /\?/.test(extra)) keys.push('sv_' + code);
  keys.forEach((k) => issueKeys.set(k, (issueKeys.get(k) || []).concat(params)));
  if (level !== 'info') shown++;
}
check('A0. found the validate() issues (' + addCalls.length + ' add() calls)', addCalls.length > 60, addCalls.length);
const missingIssue = [];
issueKeys.forEach((params, k) => LANGS.forEach((l) => { if (!has(l, k)) missingIssue.push(l + ':' + k); }));
check('A1. every validation code / variant (' + issueKeys.size + ' keys) is translated in all 6 languages', missingIssue.length === 0, missingIssue);
const badHoles = [];
issueKeys.forEach((params, k) => { if (!has('en', k)) return; holes(sb.LANG_STRINGS.en[k]).forEach((h) => { if (params.indexOf(h.slice(1, -1)) === -1) badHoles.push(k + ' ' + h + ' not in params ' + JSON.stringify(params)); }); });
check('B1. every placeholder in a validation message is a param the backend sends', badHoles.length === 0, badHoles);

// Rejections (applyChanges no()).
const aStart = specSrc.indexOf('function applyChanges('), aEnd = specSrc.indexOf('\nfunction ', aStart + 30);
const noCalls = calls(specSrc.slice(aStart, aEnd > 0 ? aEnd : undefined), 'no').filter((a) => a.length >= 2 && /^'[a-zA-Z.\[\]]+'$|^`/.test(a[0]));
const rejCodes = new Map();
noCalls.forEach((a) => { const c = a[2] || ''; const ls = (c.match(/'(\w+)'/g) || []).map((x) => x.slice(1, -1)); ls.forEach((code) => { if (!rejCodes.has(code)) rejCodes.set(code, []); rejCodes.set(code, rejCodes.get(code).concat(paramKeys('params: ' + (a[3] || '')).concat(((a[3] || '').match(/(\w+):/g) || []).map((x) => x.slice(0, -1))))); }); });
const noWithoutCode = noCalls.filter((a) => !a[2]);
check('A2. every applyChanges() rejection carries a code (' + noCalls.length + ' calls)', noCalls.length >= 25 && noWithoutCode.length === 0, noWithoutCode.map((a) => a[1].slice(0, 60)));
const missingRej = [];
rejCodes.forEach((p, code) => { if (code === 'tiktok_goal') return; LANGS.forEach((l) => { if (!has(l, 'svr_' + code)) missingRej.push(l + ':svr_' + code); }); });
check('A3. every rejection code (' + rejCodes.size + ') is translated in all 6 languages', missingRej.length === 0, missingRej);
const badRejHoles = [];
rejCodes.forEach((params, code) => { const k = 'svr_' + code; if (!has('en', k)) return; holes(sb.LANG_STRINGS.en[k]).forEach((h) => { if (params.indexOf(h.slice(1, -1)) === -1) badRejHoles.push(k + ' ' + h); }); });
check('B2. every placeholder in a rejection is a param the backend sends', badRejHoles.length === 0, badRejHoles);

// Setup reason codes.
const setupSrc = fs.readFileSync(path.join(BE, 'services', 'setupStateEngine.js'), 'utf8');
const reasonCodes = Array.from(new Set((setupSrc.match(/reasonCode:[^,]*/g) || []).reduce((acc, s) => acc.concat((s.match(/'(\w+)'/g) || []).map((x) => x.slice(1, -1))), [])));
const reasonsTotal = (setupSrc.match(/\breason:/g) || []).length;
check('A4. every platform setup reason has a reasonCode (' + reasonCodes.length + ' codes, ' + reasonsTotal + ' reasons)', reasonsTotal === (setupSrc.match(/reasonCode:/g) || []).length, { reasonsTotal });
const missingSetup = []; reasonCodes.forEach((c) => LANGS.forEach((l) => { if (!has(l, 'svp_' + c)) missingSetup.push(l + ':svp_' + c); }));
check('A5. every setup reason code is translated in all 6 languages', missingSetup.length === 0, missingSetup);

// Coded API errors (publish + activation) that the app would otherwise show in English.
const errCodes = ['ALREADY_PUBLISHED', 'PUBLISH_IN_PROGRESS', 'RESULT_UNCONFIRMED', 'PUBLISH_LEDGER_UNAVAILABLE', 'NOT_CONNECTED', 'NOT_CONNECTED__action', 'RECONNECT_REQUIRED', 'CAMPAIGN_NOT_FOUND', 'PROVIDER_PERMISSION', 'PROVIDER_PERMISSION__provider', 'PROVIDER_ERROR', 'PROVIDER_ERROR__provider'];
const missingErr = []; errCodes.forEach((c) => LANGS.forEach((l) => { if (!has(l, 'sve_' + c)) missingErr.push(l + ':sve_' + c); }));
check('A6. publish / activation error codes translated in all 6 languages', missingErr.length === 0, missingErr);
const actSrc = fs.readFileSync(path.join(BE, 'services', 'campaignActivation.js'), 'utf8');
const pubSrc = fs.readFileSync(path.join(BE, 'routes', 'publishRoutes.js'), 'utf8');
check('A7. activation and publish errors send params (platform) next to the message', (actSrc.match(/params: \{ platform: platformLabel/g) || []).length >= 6 && /params: \{ platform: platformLabel\(platform\) \}, publish:/.test(pubSrc) && /code: 'NOT_CONNECTED', params:/.test(pubSrc));

// B3. Same placeholders in all six languages, for every server-message key.
const allKeys = Object.keys(sb.LANG_STRINGS.en).filter((k) => /^sv[sepr]?_/.test(k));
const holeMismatch = [];
allKeys.forEach((k) => { const ref = JSON.stringify(holes(sb.LANG_STRINGS.en[k])); LANGS.slice(1).forEach((l) => { if (JSON.stringify(holes(sb.LANG_STRINGS[l][k] || '')) !== ref) holeMismatch.push(l + ':' + k); }); });
check('B3. all six languages use the same placeholders (' + allKeys.length + ' keys)', holeMismatch.length === 0, holeMismatch);
// Words that are genuinely the same in that language.
const SAME = { 'fr:svs_t_IMAGE': 1, 'nl:svs_t_VIDEO': 1, 'de:svs_t_VIDEO': 1 };
const untranslated = [];
allKeys.forEach((k) => { const en = sb.LANG_STRINGS.en[k]; if (holes(en).length === 0 && /[a-z]{4,}/.test(en.replace(/Performance Max|Demand Gen|\{url\}/g, ''))) LANGS.slice(1).forEach((l) => { if (sb.LANG_STRINGS[l][k] === en && !SAME[l + ':' + k]) untranslated.push(l + ':' + k); }); });
check('B4. no message left in English in another language', untranslated.length === 0, untranslated);

// ── C. Real backend output, rendered in every language ──
const S = require(path.join(BE, 'services', 'campaignSpec.js'));
const basePkg = (platform, extra) => Object.assign({
  campaignName: 'Summer Linen Drop', platform,
  strategy: { goal: 'Sales', targetAudience: 'Women 25–45', budgetRecommendation: '€20–30 per day' },
  visualConcepts: [{ conceptRef: 'a', generatedImageUrl: 'https://cdn.example.invalid/a.png' }],
  concepts: [{ angle: 'a', adCopy: { headline: 'Linen that breathes', primaryText: 'Stay cool all summer.', description: 'Free returns' }, cta: 'Shop now' }],
}, extra || {});
const profile = { company_name: 'Linnen & Co', website: 'linnenco.nl', country: 'Nederland', logo_url: 'https://cdn.example.invalid/logo.png' };
const runs = [];
for (const p of ['meta', 'google', 'tiktok', 'pinterest']) {
  const spec = S.buildSpec(basePkg(p), p, { profile });
  runs.push({ p, spec, issues: S.validate(spec, { options: {} }) });
  // A broken variant of the same campaign: no country, bad URL, no budget.
  const bad = S.buildSpec(basePkg(p, { strategy: { goal: 'Sales' } }), p, { profile: Object.assign({}, profile, { country: null }) });
  bad.tracking.destinationUrl = 'not a url'; bad.budget.amount = 0;
  runs.push({ p, spec: bad, issues: S.validate(bad, { options: { pixels: [], conversionTags: [] } }) });
}
const emitted = runs.reduce((a, r) => a.concat(r.issues.filter((i) => i.level !== 'info')), []);
check('C0. backend produced real issues for all 4 platforms (' + emitted.length + ')', emitted.length > 20 && ['meta', 'google', 'tiktok', 'pinterest'].every((p) => runs.some((r) => r.p === p && r.issues.length)));
const cBad = [];
for (const l of LANGS) {
  setLang(l);
  for (const i of emitted) {
    const out = T.issue(i);
    if (l === 'en' && out !== i.message) cBad.push('en differs: ' + i.code);
    if (!out || /\{[a-zA-Z]+\}/.test(out)) cBad.push(l + ' empty/raw: ' + i.code + ' → ' + out);
    if (l !== 'en' && out === i.message && !/^compat_|^tiktok_goal$/.test(i.code)) cBad.push(l + ' still English: ' + i.code);
  }
}
check('C1. every real issue: English = server text; nl/de/fr/es/pt translated and fully filled', cBad.length === 0, cBad.slice(0, 12));
// Params localised.
const urlIssue = emitted.find((i) => i.code === 'url_invalid');
setLang('de');
check('C2. params are filled in (url_invalid keeps the user’s address)', urlIssue && T.issue(urlIssue).includes('not a url') && /keine gültige Webadresse/.test(T.issue(urlIssue)), urlIssue && T.issue(urlIssue));
const countryIssue = { code: 'tiktok_location', message: 'OrivenAI can’t target Germany, Austria on TikTok yet. Choose a different country.', params: { countries: ['DE', 'AT'] } };
check('C3. countries are named in the user’s language (de: Deutschland, Österreich)', /Deutschland, Österreich/.test(T.issue(countryIssue)), T.issue(countryIssue));
setLang('fr');
check('C3b. … and in French (Allemagne, Autriche)', /Allemagne, Autriche/.test(T.issue(countryIssue)), T.issue(countryIssue));
const pixelIssue = { code: 'pixel_none', message: 'This Sales campaign …', params: { goal: 'Sales' } };
setLang('nl');
check('C4. goals use the app’s own goal names (nl: Verkoop)', /Deze Verkoop-campagne/.test(T.issue(pixelIssue)), T.issue(pixelIssue));
// Checklist summaries.
const sBad = []; let sCount = 0;
for (const r of runs) {
  for (const sec of S.checklist(r.spec, r.issues)) {
    if (!sec.summary) continue;
    sCount++;
    if (!sec.summaryCode) { sBad.push('no summaryCode: ' + r.p + '/' + sec.key); continue; }
    for (const l of LANGS) {
      setLang(l);
      const out = T.summary(sec);
      if (l === 'en' && out !== sec.summary) sBad.push('en differs ' + r.p + '/' + sec.key);
      if (!out || /\{[a-zA-Z]+\}/.test(out)) sBad.push(l + ' raw ' + r.p + '/' + sec.key + ': ' + out);
    }
  }
}
check('C5. every section summary (' + sCount + ') has a code and renders in all 6 languages', sCount > 20 && sBad.length === 0, sBad.slice(0, 10));
const metaPass = S.checklist(runs[0].spec, runs[0].issues).find((s) => s.key === 'targeting');
setLang('de');
check('C6. targeting summary localised: country, ages, placement (de)', metaPass && /Niederlande/.test(T.summary(metaPass)) && /Alter 18–65/.test(T.summary(metaPass)), metaPass && T.summary(metaPass));
// Section errors keep params through checklist().
const blockedSec = S.checklist(runs[1].spec, runs[1].issues).find((s) => s.errors.some((e) => e.code === 'url_invalid'));
check('C7. checklist() passes params / variant through to section errors', blockedSec && blockedSec.errors.find((e) => e.code === 'url_invalid').params && blockedSec.errors.find((e) => e.code === 'url_invalid').params.url === 'not a url', blockedSec && blockedSec.errors);
// applyChanges rejections.
const ac = S.applyChanges(basePkg('tiktok'), 'tiktok', { countries: 'Atlantis', budget: -3, goal: 'Fame', placement: 'mars', callouts: ['x'] });
const rej = (ac && ac.rejected) || [];
const rBad = [];
for (const l of LANGS) { setLang(l); rej.forEach((x) => { const o = T.rejection(x); if (l === 'en' && o !== x.reason) rBad.push('en ' + x.code); if (l !== 'en' && (o === x.reason || /\{[a-zA-Z]+\}/.test(o))) rBad.push(l + ' ' + x.code + ': ' + o); }); }
check('C8. real applyChanges() rejections (' + rej.length + ') carry codes and render in all 6 languages', rej.length >= 3 && rej.every((x) => x.code) && rBad.length === 0, { rej, rBad: rBad.slice(0, 8) });
// Create compat reasons (compat_*, tiktok_goal) reuse Create's translations.
const tg = S.validate(S.buildSpec(basePkg('tiktok', { strategy: { goal: 'Leads' } }), 'tiktok', { profile }), { options: {} }).find((i) => i.code === 'tiktok_goal' || /^compat_/.test(i.code));
setLang('es');
check('C9. compat / TikTok-goal reasons use Create’s translations (es)', !!tg && T.issue(tg) !== tg.message && /TikTok/.test(T.issue(tg)), tg && { code: tg.code, params: tg.params, es: T.issue(tg) });

// ── D. Fallbacks and compatibility ──
const unknown = { code: 'brand_new_rule', message: 'A brand-new server rule.', params: { x: 1 } };
const noCode = { message: 'Plain server text.' };
const oldServer = { code: 'url_invalid', message: 'The destination “x” isn’t a valid web address (start with https://).' }; // no params
const dBad = [];
for (const l of LANGS) {
  setLang(l);
  if (T.issue(unknown) !== unknown.message) dBad.push(l + ' unknown');
  if (T.issue(noCode) !== noCode.message) dBad.push(l + ' no code');
  if (T.issue('just a string') !== 'just a string') dBad.push(l + ' string');
  if (T.issue(oldServer) !== oldServer.message) dBad.push(l + ' old server (no params) → ' + T.issue(oldServer));
  if (T.summary({ summary: 'Old summary.' }) !== 'Old summary.') dBad.push(l + ' old summary');
  if (T.rejection({ reason: 'Old reason.' }) !== 'Old reason.') dBad.push(l + ' old rejection');
  if (T.setupReason({ reason: 'Old setup reason.' }) !== 'Old setup reason.') dBad.push(l + ' old setup');
}
check('D1. unknown code, no code, plain string, older server without params → the server’s English, never blank or half-filled', dBad.length === 0, dBad);

// ── E. Setup reasons and coded errors ──
setLang('pt');
check('E1. setup reason by code (pt)', T.setupReason({ reasonCode: 'meta_select_page', reason: 'Select a Facebook Page to advertise from.' }) === sb.LANG_STRINGS.pt.svp_meta_select_page);
setLang('en');
check('E2. setup reason in English = server text', T.setupReason({ reasonCode: 'meta_select_page', reason: 'Select a Facebook Page to advertise from.' }) === 'Select a Facebook Page to advertise from.');
const safe = (t) => String(t || '').replace(/\(#\d+\)\s*/g, '').trim();
const already = { code: 'ALREADY_PUBLISHED', error: 'This campaign was already published to Meta Ads. Publishing it again would create a second campaign — duplicate it in Create if you want another.', params: { platform: 'Meta Ads' } };
const prov = { code: 'PROVIDER_ERROR', variant: 'provider', error: '(#100) Invalid parameter', params: { platform: 'TikTok Ads', detail: '(#100) Invalid parameter' } };
const recon = { code: 'NOT_CONNECTED', error: 'Error validating access token: Session has expired', params: { platform: 'Meta Ads', reason: 'RECONNECT_REQUIRED' } };
const eBad = [];
for (const l of LANGS) {
  setLang(l);
  const a = T.serverError(already, safe), b = T.serverError(prov, safe), c = T.serverError(recon, safe), u = T.serverError({ code: 'SOMETHING_NEW', error: 'New server text.' }, safe);
  if (l === 'en') { if (a !== already.error || b !== 'Invalid parameter' || u !== 'New server text.') eBad.push('en'); continue; }
  if (!a.includes('Meta Ads') || a === already.error) eBad.push(l + ' already: ' + a);
  if (!b.includes('TikTok Ads') || !b.includes('Invalid parameter') || b.includes('(#100)')) eBad.push(l + ' provider: ' + b);
  if (!c.includes('Meta Ads') || /Session has expired/.test(c)) eBad.push(l + ' reconnect: ' + c);
  if (u !== '') eBad.push(l + ' unknown code should defer to the app’s own translated fallback: ' + u);
}
check('E3. coded errors: English = server text; others translated with the platform, provider detail quoted (cleaned), unknown codes defer to the app’s translated fallback', eBad.length === 0, eBad);

console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
if (fail > 0) process.exit(1);
