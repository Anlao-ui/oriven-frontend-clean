/* ════════════════════════════════════════════════════════════════
   Google Ads "Signup" conversion (js/consent.js trackSignupConversion,
   send_to AW-18538836764/gI2OCMrExasdEJzmgIhF) on the public signup form
   (index.html auSignup) and the app signup (js/auth.js handleSignUp).
   Checks: fires once after the account is created; never on page load,
   form submit alone, failed signups, reloads or repeated calls; never
   without advertising consent; never to the old account AW-18112493101;
   one gtag.js / one config; visiting /app loads no Google tag at all (Google's
   URL rule would turn every /app page view into a conversion) and sends nothing.
   Fenced browser (tests/_fence.js); /api/signup, Supabase sign-in and
   gtag.js are answered in the browser, so nothing reaches Google, Supabase
   or the backend. Needs the static server on :8899.
   RUN: node tests/signup-conversion.test.js
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const BASE_URL = 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const AW_ID = 'AW-18538836764';
const SEND_TO = AW_ID + '/gI2OCMrExasdEJzmgIhF';
const OLD_AW = 'AW-18112493101';
let pass = 0, fail = 0;
function check(name, cond, detail) { if (cond) { pass++; console.log('PASS — ' + name); } else { fail++; console.log('FAIL — ' + name + (detail ? ' | ' + detail : '')); } }
const UID = (n) => '00000000-0000-4000-8000-00000000c0' + String(n).padStart(2, '0');

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  require('./_fence').fenceBrowser(browser, BASE_URL, { backend401: true });

  // One page per scenario. consent: 'accept' | 'reject' | null (no choice).
  async function setup(consent, signupReplies) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    const events = [], signupCalls = [], gtagLoads = [];
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.exposeFunction('__dl', (j) => events.push(JSON.parse(j)));
    await page.route('https://www.googletagmanager.com/gtag/js**', (r) => gtagLoads.push(r.request().url()) && r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__gtagStub=1;' }));
    await page.route('**/api/signup', async (r) => {
      const reply = signupReplies.shift() || { status: 500, body: { error: 'x' } };
      signupCalls.push({ at: Date.now(), status: reply.status });
      await new Promise((x) => setTimeout(x, reply.delay || 50));
      r.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) });
    });
    if (consent) await page.addInitScript((ads) => { try { localStorage.setItem('orv_consent_v1', JSON.stringify({ v: 1, ads, stats: true, at: '2026-10-20T00:00:00.000Z' })); } catch (_) {} }, consent === 'accept');
    // Record every dataLayer entry (survives the redirect: exposeFunction is per page).
    await page.addInitScript(() => {
      var hook = function () { if (!window.dataLayer || window.dataLayer.__hooked) return; var orig = window.dataLayer.push.bind(window.dataLayer); window.dataLayer.push = function (a) { try { var arr = Array.from(a).map(function (x) { return x && typeof x === 'object' ? Object.assign({}, x, { event_callback: x.event_callback ? 'fn' : undefined }) : x; }); window.__dl(JSON.stringify(arr)); } catch (_) {} return orig(a); }; window.dataLayer.__hooked = true; };
      var iv = setInterval(hook, 5); setTimeout(function () { clearInterval(iv); }, 15000);
    });
    return { ctx, page, events, signupCalls, errors, gtagLoads };
  }
  const conv = (events) => events.filter((e) => e[0] === 'event' && e[1] === 'conversion');
  async function openSignup(page) {
    await page.goto(BASE_URL + '/index.html', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(400);
    // Supabase sign-in after account creation: answered in the page (no network).
    await page.evaluate(() => { window.__signin = 0; SB.auth.signInWithPassword = async () => { window.__signin++; return { data: { user: { id: 'x' }, session: {} }, error: null }; }; });
    await page.evaluate(() => { document.querySelectorAll('.orv-cc').forEach((e) => e.remove()); });
  }
  async function fill(page, email) {
    await page.evaluate((em) => {
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      set('auFirstNameSignup', 'Sam'); set('auLastNameSignup', 'Test'); set('auEmailSignup', em); set('auPassSignup', 'secret123'); set('auPassConfirmSignup', 'secret123');
    }, email);
  }
  const ok = (n) => ({ status: 200, body: { ok: true, userId: UID(n) } });

  // ── A. Successful signup with advertising consent ──
  console.log('── A. Success, consent granted ──');
  let s = await setup('accept', [ok(1)]);
  await openSignup(s.page);
  check('opening the signup page sends no conversion', conv(s.events).length === 0);
  await fill(s.page, 'a@example.invalid');
  const navP = s.page.waitForURL(/\/app$/, { timeout: 8000 }).then(() => true).catch(() => false);
  await s.page.evaluate(() => { auSignup(); });
  const navigated = await navP;
  let c = conv(s.events);
  check('account created → exactly one Signup conversion', c.length === 1, JSON.stringify(c));
  check('…send_to AW-18538836764/gI2OCMrExasdEJzmgIhF, transaction_id signup-<account id>', c[0] && c[0][2].send_to === SEND_TO && c[0][2].transaction_id === 'signup-' + UID(1), JSON.stringify(c[0]));
  check('…sent only after /api/signup answered (1 call, success)', s.signupCalls.length === 1 && s.signupCalls[0].status === 200);
  check('…then the redirect to /app still happens', navigated);
  check('…no purchase / page-view conversions or other ad events', !s.events.some((e) => e[0] === 'event' && e[1] !== 'conversion') && conv(s.events).every((e) => e[2].send_to === SEND_TO));
  check('…nothing addressed to the old account ' + OLD_AW, !JSON.stringify(s.events).includes(OLD_AW.slice(3)));
  check('…one Google tag: gtag.js requested once, config ' + AW_ID + ' once per page', s.gtagLoads.every((u) => u.endsWith('id=' + AW_ID)) && s.events.filter((e) => e[0] === 'config').every((e) => e[1] === AW_ID) && s.events.filter((e) => e[0] === 'config').length <= s.gtagLoads.length && s.gtagLoads.length >= 1, JSON.stringify(s.gtagLoads));
  await s.ctx.close();

  // ── B. Failed signup, then success ──
  console.log('── B. Failure ──');
  s = await setup('accept', [{ status: 409, body: { error: 'An account with this email already exists. Please sign in.' } }, ok(2)]);
  await openSignup(s.page); await fill(s.page, 'b@example.invalid');
  await s.page.evaluate(() => auSignup()); await s.page.waitForTimeout(600);
  check('failed signup (409) → no conversion, error shown', conv(s.events).length === 0 && /already exists/.test(await s.page.locator('#auErrorSignup').textContent()));
  const nav2 = s.page.waitForURL(/\/app$/, { timeout: 8000 }).then(() => true).catch(() => false);
  await s.page.evaluate(() => auSignup()); await nav2;
  c = conv(s.events);
  check('retry that succeeds → exactly one conversion', c.length === 1 && c[0][2].transaction_id === 'signup-' + UID(2));
  await s.ctx.close();

  s = await setup('accept', [{ status: 500, body: { error: 'Could not create your account right now. Please try again.' } }]);
  await openSignup(s.page); await fill(s.page, 'c@example.invalid');
  await s.page.evaluate(() => auSignup()); await s.page.waitForTimeout(600);
  check('server error → no conversion', conv(s.events).length === 0);
  await s.ctx.close();

  // ── C. Duplicates ──
  console.log('── C. Duplicates ──');
  s = await setup('accept', [Object.assign(ok(3), { delay: 400 }), ok(3)]);
  await openSignup(s.page); await fill(s.page, 'd@example.invalid');
  const nav3 = s.page.waitForURL(/\/app$/, { timeout: 8000 }).then(() => true).catch(() => false);
  await s.page.evaluate(() => { auSignup(); auSignup(); auSignup(); }); // rapid repeated submits
  await nav3;
  check('rapid repeated submits → one conversion', conv(s.events).length === 1, 'signup calls: ' + s.signupCalls.length);
  await s.ctx.close();
  s = await setup('accept', []);
  await openSignup(s.page);
  const r = await s.page.evaluate(async (id) => [await orvConsent.trackSignupConversion(id), await orvConsent.trackSignupConversion(id), await Promise.all([orvConsent.trackSignupConversion('00000000-0000-4000-8000-00000000c0aa'), orvConsent.trackSignupConversion('00000000-0000-4000-8000-00000000c0aa')])], UID(4));
  check('same account tracked twice (retry) → one conversion; concurrent calls → one', JSON.stringify(r) === JSON.stringify([true, false, [true, false]]) && conv(s.events).length === 2, JSON.stringify(r));
  await s.page.reload({ waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(400);
  const before = conv(s.events).length;
  const again = await s.page.evaluate(async (id) => orvConsent.trackSignupConversion(id), UID(4));
  check('after a page reload: reload sends nothing, and the same account never converts again', again === false && conv(s.events).length === before);
  check('invalid or missing account id → nothing sent', (await s.page.evaluate(async () => [await orvConsent.trackSignupConversion(''), await orvConsent.trackSignupConversion('not-an-id'), await orvConsent.trackSignupConversion(undefined)])).every((x) => x === false) && conv(s.events).length === before);
  await s.ctx.close();

  // ── D. No advertising consent ──
  console.log('── D. Consent denied / not given ──');
  for (const consent of ['reject', null]) {
    s = await setup(consent, [ok(5)]);
    await openSignup(s.page); await fill(s.page, 'e@example.invalid');
    const nav = s.page.waitForURL(/\/app$/, { timeout: 8000 }).then(() => true).catch(() => false);
    await s.page.evaluate(() => auSignup());
    const went = await nav;
    check('consent ' + (consent || 'not given') + ': account created and redirected, but NO conversion sent and gtag.js not loaded', went && conv(s.events).length === 0 && !s.events.some((e) => e[0] === 'config'));
    check('…nothing queued for later (no conversion marker stored)', await s.page.evaluate((k) => !localStorage.getItem(k), 'orv_signup_conv_' + UID(5)));
    await s.ctx.close();
  }

  // ── E. App signup (js/auth.js) ──
  console.log('── E. App signup ──');
  s = await setup('accept', [ok(6)]);
  await s.page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(500);
  await s.page.evaluate(() => {
    SB.auth.signInWithPassword = async () => ({ data: { user: { id: '00000000-0000-4000-8000-00000000c006', email: 'f@example.invalid' }, session: {} }, error: null });
    window.onUserSignedIn = async () => {}; window.trackEvent = function () {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('suFirst', 'Sam'); set('suLast', 'Test'); set('suEmail', 'f@example.invalid'); set('suPass', 'secret123'); set('suPassConfirm', 'secret123');
  });
  await s.page.evaluate(() => handleSignUp()); await s.page.waitForTimeout(800);
  c = conv(s.events);
  check('app signup → one conversion for the new account', c.length === 1 && c[0][2].transaction_id === 'signup-' + UID(6) && c[0][2].send_to === SEND_TO, JSON.stringify(c) + ' calls:' + s.signupCalls.length);
  check('…the app loads the Google tag once, only to send it', s.gtagLoads.length === 1 && (await s.page.locator('script[src*="googletagmanager.com/gtag/js"]').count()) === 1);
  await s.ctx.close();
  s = await setup('accept', [{ status: 409, body: { error: 'exists' } }]);
  await s.page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(500);
  await s.page.evaluate(() => { const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; }; set('suFirst', 'Sam'); set('suLast', 'Test'); set('suEmail', 'g@example.invalid'); set('suPass', 'secret123'); set('suPassConfirm', 'secret123'); });
  await s.page.evaluate(() => handleSignUp()); await s.page.waitForTimeout(600);
  check('app signup failure → no conversion', conv(s.events).length === 0);
  await s.ctx.close();

  // Guest signup in the app (js/guest.js _ggDoSignup).
  for (const [consent, reply, n] of [['accept', ok(7), 1], ['accept', { status: 409, body: { error: 'exists' } }, 0], ['reject', ok(8), 0]]) {
    s = await setup(consent, [reply]);
    await s.page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(500);
    await s.page.evaluate(() => {
      SB.auth.signInWithPassword = async () => ({ data: { user: { id: 'guest-x', email: 'h@example.invalid' }, session: {} }, error: null });
      window._guestOnSignedIn = function () {}; window.trackEvent = function () {};
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      set('ggFirst', 'Sam'); set('ggLast', 'Test'); set('ggEmail', 'h@example.invalid'); set('ggPass', 'secret123');
    });
    await s.page.evaluate(() => _ggDoSignup()); await s.page.waitForTimeout(800);
    c = conv(s.events);
    const what = reply.status !== 200 ? 'failed (409)' : consent === 'reject' ? 'without advertising consent' : 'succeeded';
    check('guest signup ' + what + ' → ' + n + ' conversion' + (n === 1 ? ' (tag loaded once, only to send it)' : ', tag not loaded'), c.length === n && (n === 0 || (c[0][2].send_to === SEND_TO && c[0][2].transaction_id === 'signup-' + UID(7))) && s.gtagLoads.length === n && s.signupCalls.length === 1, JSON.stringify(c) + ' loads:' + s.gtagLoads.length);
    await s.ctx.close();
  }

  // ── F. Visiting the app is not a signup ──
  console.log('── F. /app visits ──');
  s = await setup('accept', []);
  await s.page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' }); await s.page.waitForTimeout(500);
  await s.page.evaluate(() => { _setAppRoute('/app'); _setAppRoute('/app'); });
  await s.page.waitForTimeout(300);
  check('returning visitor on /app (route set twice): no conversion and no manual page_view', conv(s.events).length === 0 && !s.events.some((e) => e[0] === 'event' && e[1] === 'page_view'), JSON.stringify(s.events.filter((e) => e[0] === 'event')));
  check('…the Google tag is not loaded on an app visit (no gtag.js, no config), even with advertising consent', s.gtagLoads.length === 0 && (await s.page.evaluate(() => window.dataLayer.filter((a) => a[0] === 'config').length)) === 0 && (await s.page.locator('script[src*="googletagmanager.com/gtag/js"]').count()) === 0);
  await s.ctx.close();

  // ── G. Source: no active tracking code uses the old account ──
  console.log('── G. Source ──');
  const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
  const consentSrc = fs.readFileSync(path.join(root, 'js/consent.js'), 'utf8');
  check('js/consent.js: AW_ID is ' + AW_ID + ' and the signup destination is ' + SEND_TO, consentSrc.includes("var AW_ID = '" + AW_ID + "'") && consentSrc.includes("AW_ID + '/gI2OCMrExasdEJzmgIhF'"));
  const jsFiles = fs.readdirSync(path.join(root, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
  const htmlFiles = fs.readdirSync(root).filter((f) => f.endsWith('.html')).concat(fs.readdirSync(path.join(root, 'product')).filter((f) => f.endsWith('.html')).map((f) => 'product/' + f));
  const oldHits = jsFiles.concat(htmlFiles, ['tools/seo/build.js']).filter((f) => fs.readFileSync(path.join(root, f), 'utf8').includes(OLD_AW.slice(3)));
  check('no site/app source file references ' + OLD_AW, oldHits.length === 0, oldHits.join(', '));
  const gtagLoaders = jsFiles.concat(htmlFiles).filter((f) => /googletagmanager\.com\/gtag\/js/.test(fs.readFileSync(path.join(root, f), 'utf8')));
  check('gtag.js is loaded from one place only (js/consent.js)', gtagLoaders.length === 1 && gtagLoaders[0] === 'js/consent.js', gtagLoaders.join(', '));

  await browser.close();
  console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
