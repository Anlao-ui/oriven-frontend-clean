// Text from users, the server or AI is inserted as text, never as markup.
// Covers the sinks fixed in the 2026-11 audit: the campaign-review chat reply
// (app.html), the legacy studio chat's user bubble and the Brand Identity
// block (js/app.js). Runs app.js's real helper; static checks for app.html.
// No browser, no network. Run: node tests/xss-sinks.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
function check(name, ok, info) { if (ok) { passed++; console.log('  PASS', name); } else { failed++; console.log('  FAIL', name, info === undefined ? '' : String(info).slice(0, 300)); } }

const EVIL = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

console.log('\n1. js/app.js helper and call sites');
const app = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
const helperSrc = (app.match(/function _appEsc\(s\)\{[^\n]+\}/) || [''])[0];
check('_appEsc exists', !!helperSrc);
const ctx = {}; vm.createContext(ctx); vm.runInContext(helperSrc, ctx);
const out = ctx._appEsc(EVIL + ' & "q" \'s\'');
check('_appEsc leaves no tag or attribute quote', !/[<>"']/.test(out) && /&lt;img/.test(out) && /&amp;/.test(out), out);
check('_appEsc(null/undefined) → ""', ctx._appEsc(null) === '' && ctx._appEsc(undefined) === '');
check('user chat bubble escaped', /user-bubble">'\+_appEsc\(msg\.text\)\+/.test(app));
check('brand name, colour name and meta escaped', /si-bc-name">'\+_appEsc\(bc\.name\)\+/.test(app) && /title="'\+_appEsc\(col\.name\)\+'"/.test(app) && /si-bc-meta">'\+_appEsc\(meta\)\+/.test(app));
check('swatch colour limited to a hex value', /\/\^#\[0-9a-fA-F\]\{3,8\}\$\/\.test\(String\(col\.hex/.test(app));
check('no raw msg.text / bc.name concatenated into markup', !/'\+msg\.text\+/.test(app) && !/'\+bc\.name\+/.test(app));

console.log('\n2. app.html campaign-review chat');
const html = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
check('reply escaped before innerHTML', /el\.innerHTML=\(res\.ok&&res\.data&&res\.data\.reply\)\?_escHtml\(res\.data\.reply\)\.replace\(\/\\n\/g,'<br>'\):/.test(html));
check('no raw res.data.reply into innerHTML anywhere', !/innerHTML\s*=\s*\([^;]*\)\s*\?\s*res\.data\.reply\s*:/.test(html));
const escSrc = (html.match(/function _escHtml\(s\)\{[^\n]+\}/) || [''])[0];
const c2 = {}; vm.createContext(c2); vm.runInContext(escSrc, c2);
const rendered = c2._escHtml(EVIL + '\nline 2').replace(/\n/g, '<br>');
check('rendered reply has no live tags, keeps the line break', !/<img|<script/i.test(rendered) && /<br>line 2$/.test(rendered), rendered);

console.log(`\n${passed + failed} checks run: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
