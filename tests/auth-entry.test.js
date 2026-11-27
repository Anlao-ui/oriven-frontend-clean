// ════════════════════════════════════════════════════════════════
// Log in / Get started always ask for credentials: a session cached in this
// browser (possibly another account's) never carries anyone into /app from
// the public entry points. Fenced: Supabase and the backend are answered
// locally (tests/_fence.js); no real account is touched.
//
//   A. With a cached session: Log in, Get started (nav + hero), direct /login
//      and /signup all show the form, never /app, and the cached session is
//      gone from this browser afterwards
//   B. The sign-out request failing (offline) still removes it
//   C. Wrong credentials → error, stays on /login; right credentials → /app,
//      and the old session's sign-out finished before the new sign-in
//   D. /app itself keeps its own session handling (route unchanged)
//
// RUN: node tests/auth-entry.test.js
// ════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), PORT = 8897, BASE = 'http://127.0.0.1:' + PORT;
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
function check(name, cond, detail) { if (cond) { pass++; console.log('PASS — ' + name); } else { fail++; console.log('FAIL — ' + name + (detail !== undefined ? ' | ' + JSON.stringify(detail).slice(0, 400) : '')); } }

const rules = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/app') { s.writeHead(200, { 'content-type': 'text/html' }); return s.end('<!doctype html><title>app</title><p id="appStub">APP</p>'); }
  const r = rules.find((x) => x[0] === p && /^200/.test(x[2])); if (r) p = r[1];
  if (p === '/') p = '/home.html';
  let f = path.join(ROOT, p);
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (_) { if (fs.existsSync(f + '.html')) f += '.html'; }
  fs.readFile(f, (e, b) => { s.writeHead(e ? 404 : 200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); s.end(e ? 'not found' : b); });
});

const KEY = 'sb-rsqfoqitooxmkyrkuyzi-auth-token';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function session(uid, email) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const at = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: uid, exp, role: 'authenticated', email, aud: 'authenticated', session_id: 's-' + uid }) + '.sig';
  return { access_token: at, refresh_token: 'r-' + uid, expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id: uid, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } };
}
const OLD = session('00000000-0000-0000-0000-0000000000a1', 'old.account@example.invalid');
const NEW = session('00000000-0000-0000-0000-0000000000b2', 'right.account@example.invalid');

async function main() {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  require('./_fence').fenceBrowser(browser, BASE, { backend401: true });

  // opts.logout: 'ok' | 'fail'; opts.token: 'ok' | 'bad'
  async function open(opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(([k, s, seed]) => {
      try { localStorage.setItem('orv_consent_v1', JSON.stringify({ v: 1, ads: false, stats: false, at: '2026-11-01T00:00:00.000Z' })); } catch (_) {}
      if (seed && !sessionStorage.getItem('seeded')) { localStorage.setItem(k, JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); }
      if (!sessionStorage.getItem('hadAtStart')) sessionStorage.setItem('hadAtStart', localStorage.getItem(k) ? 'yes' : 'no');
    }, [KEY, OLD, opts.seed !== false]);
    const page = await ctx.newPage();
    const log = [];
    await page.route(/supabase\.co\/auth\/v1\/logout/, (route) => { log.push('logout'); return opts.logout === 'fail' ? route.abort('internetdisconnected') : route.fulfill({ status: 204, body: '' }); });
    await page.route(/supabase\.co\/auth\/v1\/token/, (route) => {
      log.push('token');
      if (opts.token === 'ok') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NEW) });
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }) });
    });
    await page.route(/supabase\.co\/auth\/v1\/user/, (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"msg":"invalid"}' }));
    const visited = [];
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) visited.push(new URL(f.url()).pathname); });
    return { ctx, page, log, visited };
  }
  const state = (page) => page.evaluate((k) => {
    const v = [...document.querySelectorAll('[id^="view-"]')].find((x) => !x.classList.contains('pub-view') && x.offsetParent !== null);
    const pw = v ? v.querySelector('input[type="password"]') : null;
    return { path: location.pathname, view: v ? v.id : null, form: !!(pw && pw.offsetParent), cached: !!localStorage.getItem(k) };
  }, KEY);

  // ── A. cached session at every public entry point
  const entries = [
    ['nav "Log in" on the homepage', '/', 'a.lp-nav-login', 'view-login'],
    ['nav "Get started" on the homepage', '/', 'a.lp-cta-btn', 'view-signup'],
    ['hero "Try 2 weeks for €1" on the homepage', '/', '[data-ik-cta="hero"]', 'view-signup'],
    ['"Log in" on a product page', '/product', 'a.lp-nav-login', 'view-login'],
    ['"Get started" on the pricing page', '/pricing', 'a.lp-cta-btn', 'view-signup'],
    ['direct /login', '/login', null, 'view-login'],
    ['direct /signup', '/signup', null, 'view-signup'],
  ];
  for (const [name, start, click, want] of entries) {
    const { ctx, page, visited } = await open();
    await page.goto(BASE + start, { waitUntil: 'load' }); await page.waitForTimeout(600);
    const before = await page.evaluate(() => sessionStorage.getItem('hadAtStart') === 'yes'); // a session was cached when the first page opened
    if (click) await page.click(click);
    await page.waitForTimeout(2500);
    const st = await state(page);
    check('A ' + name + ': the ' + (want === 'view-login' ? 'sign-in' : 'create-account') + ' form, not /app', before && st.view === want && st.form && !visited.includes('/app') && st.path !== '/app', { before, st, visited });
    check('A …and the cached session is no longer in this browser', !st.cached, st);
    await ctx.close();
  }

  // ── B. sign-out request fails (offline): still removed
  {
    const { ctx, page, log } = await open({ logout: 'fail' });
    await page.goto(BASE + '/login', { waitUntil: 'load' }); await page.waitForTimeout(2500);
    const st = await state(page);
    check('B sign-out request failing still removes the cached session; form shown', !st.cached && st.form && st.path === '/login', { st, log });
    await ctx.close();
  }

  // ── C. credentials
  {
    const { ctx, page, log, visited } = await open({ token: 'bad' });
    await page.goto(BASE + '/login', { waitUntil: 'load' }); await page.waitForTimeout(1500);
    await page.fill('#auEmailLogin', 'someone@example.invalid'); await page.fill('#auPassLogin', 'wrong-password-1');
    await page.click('#auSubmitLogin'); await page.waitForTimeout(2000);
    const err = await page.evaluate(() => (document.getElementById('auErrorLogin') || {}).textContent || '');
    check('C1 wrong credentials are rejected with a message; stays on /login, no /app', /incorrect|invalid/i.test(err) && !visited.includes('/app') && (await state(page)).path === '/login', { err, visited, log });
    await ctx.close();
  }
  {
    const { ctx, page, log } = await open({ token: 'ok' });
    await page.goto(BASE + '/login', { waitUntil: 'load' });
    // type and submit straight away: the old session's sign-out may still be running
    await page.fill('#auEmailLogin', 'right.account@example.invalid'); await page.fill('#auPassLogin', 'right-password-1');
    await page.click('#auSubmitLogin');
    await page.waitForURL(/\/app$/, { timeout: 8000 }).catch(() => {});
    const st = await page.evaluate((k) => ({ path: location.pathname, stub: !!document.getElementById('appStub'), sess: JSON.parse(localStorage.getItem(k) || 'null') }), KEY);
    check('C2 right credentials open /app', st.path === '/app' && st.stub, st.path);
    check('C3 …signed in as the account that just entered its credentials (not the cached one)', st.sess && st.sess.user && st.sess.user.id === NEW.user.id, st.sess && st.sess.user && st.sess.user.id);
    check('C4 …the old session was signed out before the new sign-in (no sign-out after it)', log.indexOf('token') > -1 && log.lastIndexOf('logout') < log.indexOf('token'), log);
    await ctx.close();
  }
  {
    const { ctx, page, visited } = await open({ seed: false });
    await page.goto(BASE + '/signup', { waitUntil: 'load' }); await page.waitForTimeout(1500);
    const st = await state(page);
    check('C5 no cached session: /signup shows account creation (with a way to log in)', st.view === 'view-signup' && st.form && !visited.includes('/app') && await page.$('#view-signup a[href="/login"], #view-signup [onclick*="login"]') !== null, st);
    await ctx.close();
  }

  // ── D. /app route unchanged
  const appRule = rules.find((x) => x[0] === '/app');
  check('D /app still serves the app shell (its own session handling in js/auth.js)', appRule && appRule[1] === '/app.html' && /^200/.test(appRule[2]), appRule);
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('D no public entry point sends a cached session to /app (no getSession → /app redirect left)', !/getSession\(\)[\s\S]{0,200}location\.href\s*=\s*['"]\/app['"]/.test(src));

  await browser.close(); server.close();
  console.log(`auth-entry: ${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.log('CRASH', e); process.exit(1); });
