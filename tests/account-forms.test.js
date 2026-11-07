/* ════════════════════════════════════════════════════════════════
   Signup forms (js/accountForms.js) — the public /signup page, the app's
   auth screen and the in-app guest sign-up.

   A. The shared rules in Node: one specific message per field, the same
      messages as the server (oriven-backend services/accounts.js, when
      checked out next to this repository), email normalisation, autofill,
      and how server errors are shown (duplicate address, never "missing
      fields" for something else).
   B. The three forms in a fenced browser against a scripted /api/signup:
      the request payload, field-specific messages, the duplicate message,
      a whitespace-only first name, an invalid address.

   SAFETY: a static server on this test's own port; the app's dev API
   (http://localhost:5500) is answered by the test; every other host is
   aborted. No real accounts.
   RUN: node tests/account-forms.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BE = path.resolve(ROOT, '..', 'oriven-backend', 'server');
const express = require(require.resolve('express', { paths: [BE, ROOT] }));
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 500))); }
const GENERIC = /first name, email and password are required/i;

const F = require('../js/accountForms.js');

console.log('\nA. Shared rules');
const v = (f, o) => F.validate(f, o);
check('all filled → ok, email normalised (trimmed, lower-case), names trimmed', (() => { const r = v({ firstName: ' Jane ', lastName: ' Doe ', email: '  Jane.Doe@Example.COM ', password: 'secret123' }); return r.ok && r.value.email === 'jane.doe@example.com' && r.value.firstName === 'Jane' && r.value.lastName === 'Doe'; })());
const cases = [
  [{ email: 'a@b.co', password: 'secret123' }, 'firstName', 'Enter your first name.'],
  [{ firstName: '   ', email: 'a@b.co', password: 'secret123' }, 'firstName', 'Enter your first name.'],
  [{ firstName: 'A', password: 'secret123' }, 'email', 'Enter your email address.'],
  [{ firstName: 'A', email: 'nope', password: 'secret123' }, 'email', 'Enter a valid email address.'],
  [{ firstName: 'A', email: 'a@b.co' }, 'password', 'Choose a password.'],
  [{ firstName: 'A', email: 'a@b.co', password: '123' }, 'password', 'Your password needs at least 6 characters.'],
];
for (const [f, field, msg] of cases) { const r = v(f); check(`${JSON.stringify(f).slice(0, 50)} → ${field}: "${msg}"`, !r.ok && r.field === field && r.message === msg, r); }
check('last name and confirmation only where the form asks for them', v({ firstName: 'A', email: 'a@b.co', password: 'secret123' }).ok && v({ firstName: 'A', email: 'a@b.co', password: 'secret123' }, { requireLastName: true }).field === 'lastName' && v({ firstName: 'A', lastName: 'B', email: 'a@b.co', password: 'secret123', passwordConfirm: 'x' }, { confirm: true }).field === 'passwordConfirm');
check('a field the browser filled but hasn’t passed on → "click into the field", not "required"', /Click into the field once/.test(v({ firstName: 'A', email: 'a@b.co', password: '' }, { hidden: { password: true } }).message));
check('no message anywhere says "First name, email and password are required"', !Object.values(F.MESSAGES).some((m) => GENERIC.test(m)));
check('server duplicate (409 EMAIL_EXISTS) → "already exists. Please sign in or reset your password."', F.signupError({ ok: false, status: 409, data: { error: 'x', code: 'EMAIL_EXISTS', field: 'email' } }).message === 'An account with this email address already exists. Please sign in or reset your password.');
check('…also from a raw provider text ("User already registered")', F.signupError(new Error('User already registered')).field === 'email');
check('a server field error is shown as sent, with its field', (() => { const e = F.signupError({ ok: false, data: { error: 'Enter a valid email address.', field: 'email', code: 'FIELD_INVALID' } }); return e.message === 'Enter a valid email address.' && e.field === 'email'; })());
check('an unexpected error is never turned into "missing fields"', !GENERIC.test(F.signupError({ ok: false, data: { error: 'We couldn’t create your account right now. Please try again in a moment.', code: 'SIGNUP_FAILED' } }).message));
const acc = path.join(BE, 'services', 'accounts.js');
if (fs.existsSync(acc)) {
  const S = require(acc);
  const same = cases.every(([f]) => { const a = v(f), b = S.validateSignup(f); return b.error === a.message && b.field === a.field; });
  check('browser and server give the same field and message for every invalid case', same);
  check('…and normalise email the same way', S.normalizeEmail('  A@B.Co ') === F.normalizeEmail('  A@B.Co '));
  check('…duplicate message identical', S.signupAuthError({ code: 'email_exists' }).body.error === F.MESSAGES.exists);
} else console.log('SKIP — backend not checked out next to this repository');

// ── B ─────────────────────────────────────────────────────────────
const PORT = 8987, BASE = 'http://127.0.0.1:' + PORT, DEV_API = 'http://localhost:5500';
const M = { bodies: [], next: [] };
const app = express();
app.use((q, r, n) => { r.set({ 'Access-Control-Allow-Origin': q.headers.origin || '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }); if (q.method === 'OPTIONS') return r.sendStatus(204); n(); });
app.use(express.json());
app.post('/api/signup', (q, r) => { M.bodies.push(q.body); const x = M.next.shift() || { status: 409, body: { error: 'An account with this email address already exists. Please sign in or reset your password.', code: 'EMAIL_EXISTS', field: 'email' } }; r.status(x.status).json(x.body); });
app.get('/api/onboarding/state', (q, r) => r.json({ eligible: false, completed: true, flow: { enabled: false } }));
app.all(/^\/api\//, (q, r) => r.json({}));
app.use(express.static(ROOT, { extensions: ['html'] }));
const blocked = [];
const server = app.listen(PORT, async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const errors = [];
  const page = async () => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await p.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(BASE)) return r.continue(); if (u.startsWith(DEV_API)) return r.continue({ url: BASE + u.slice(DEV_API.length) }); if (/^(data|blob):/.test(u) || (r.request().method() === 'GET' && /cdn\.jsdelivr|cdnjs\.cloudflare\.com|fonts\.g/.test(u))) return r.continue(); blocked.push(u.split('?')[0]); return r.abort(); });
    p.on('pageerror', (e) => errors.push(e.message));
    await p.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.orv-cc{display:none!important}'; document.head.appendChild(s); }));
    return p;
  };
  try {
    console.log('\nB1. Public /signup');
    let p = await page();
    await p.goto(BASE + '/index.html', { waitUntil: 'load' }); await p.evaluate(() => lpNavigate('/signup')); await p.waitForTimeout(500);
    const fillPub = async (o) => { for (const [id, val] of Object.entries(o)) await p.fill('#' + id, val); await p.click('#auSubmitSignup'); await p.waitForTimeout(600); return { msg: await p.textContent('#auErrorSignup'), marked: await p.evaluate(() => [...document.querySelectorAll('.au-err')].map((e) => e.id)) }; };
    let r = await fillPub({ auFirstNameSignup: 'Jane', auLastNameSignup: 'Doe', auEmailSignup: '  Jane.Doe@Example.COM ', auPassSignup: 'secret123', auPassConfirmSignup: 'secret123' });
    check('filled form → request with firstName/lastName/email/password, email normalised', M.bodies.length === 1 && M.bodies[0].firstName === 'Jane' && M.bodies[0].lastName === 'Doe' && M.bodies[0].email === 'jane.doe@example.com' && M.bodies[0].password === 'secret123', M.bodies[0]);
    check('duplicate → "already exists. Please sign in or reset your password.", email field marked', /already exists\. Please sign in or reset your password\./.test(r.msg) && r.marked.includes('auEmailSignup') && !GENERIC.test(r.msg), r);
    r = await fillPub({ auFirstNameSignup: '   ', auEmailSignup: 'jane@example.com' });
    check('whitespace-only first name → "Enter your first name.", no request', r.msg === 'Enter your first name.' && r.marked.includes('auFirstNameSignup') && M.bodies.length === 1, r);
    r = await fillPub({ auFirstNameSignup: 'Jane', auEmailSignup: 'jane@nowhere' });
    check('malformed email → "Enter a valid email address.", no request', r.msg === 'Enter a valid email address.' && r.marked.includes('auEmailSignup') && M.bodies.length === 1, r);
    M.next.push({ status: 500, body: { error: 'We couldn’t create your account right now. Please try again in a moment.', code: 'SIGNUP_FAILED' } });
    r = await fillPub({ auEmailSignup: 'jane2@example.com' });
    check('server failure → its own message, never "missing fields"', /couldn’t create your account/.test(r.msg) && !GENERIC.test(r.msg), r);
    await p.close();

    console.log('\nB2. App: auth screen and guest sign-up');
    p = await page();
    await p.goto(BASE + '/app.html', { waitUntil: 'load' }); await p.waitForTimeout(2000);
    await p.evaluate(() => { showAuthPage(); switchAuthTab('signup'); }); await p.waitForTimeout(300);
    await p.fill('#suFirst', 'Ann'); await p.fill('#suEmail', 'ANN@Example.com'); await p.fill('#suPass', 'secret123');
    await p.evaluate(() => handleSignUp()); await p.waitForTimeout(600);
    let msg = await p.textContent('#authErrorSu');
    check('auth screen: payload normalised, duplicate message shown', M.bodies[M.bodies.length - 1].email === 'ann@example.com' && /already exists\. Please sign in or reset your password\./.test(msg), { body: M.bodies[M.bodies.length - 1], msg });
    await p.fill('#suFirst', ''); await p.fill('#suPass', 'secret123');
    const n0 = M.bodies.length;
    await p.evaluate(() => handleSignUp()); await p.waitForTimeout(300);
    msg = await p.textContent('#authErrorSu');
    check('auth screen: empty first name → "Enter your first name." (not the old generic message), no request', msg === 'Enter your first name.' && M.bodies.length === n0, msg);
    await p.evaluate(() => { document.getElementById('authOverlay').style.display = 'none'; _showGuestGate('signup'); }); await p.waitForTimeout(400);
    check('guest sign-up no longer says "free account"', !/free account/i.test(await p.textContent('#ggSignup')));
    await p.fill('#ggFirst', 'Max'); await p.fill('#ggEmail', 'max@example.com'); await p.fill('#ggPass', '123');
    await p.evaluate(() => _ggDoSignup()); await p.waitForTimeout(300);
    check('guest sign-up: short password → its own message', (await p.textContent('#ggErr')) === 'Your password needs at least 6 characters.');
    await p.fill('#ggPass', 'secret123');
    await p.evaluate(() => _ggDoSignup()); await p.waitForTimeout(600);
    msg = await p.textContent('#ggErr');
    check('guest sign-up: duplicate message, email marked', /already exists\. Please sign in or reset your password\./.test(msg) && await p.evaluate(() => document.getElementById('ggEmail').classList.contains('gg-input-err')), msg);
    await p.close();
    check('no page errors', errors.length === 0, errors.slice(0, 3));
    check('nothing left the browser (the app’s own Supabase calls were aborted)', blocked.filter((u) => !/supabase\.co|googletagmanager|esm\.sh/.test(u)).length === 0, blocked.slice(0, 5));
  } catch (e) { console.log('CRASH', e && e.stack || e); fail++; }
  await browser.close(); server.close();
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
});
