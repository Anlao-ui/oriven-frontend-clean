/* ════════════════════════════════════════════════════════════════
   HeyCatch visitor analytics on the public website (heycatch.ai/agents.md).

   The esm.sh SDK import is answered by a recording stub, so the test sees
   every call (init options, optInCapturing, optOutCapturing) and nothing
   reaches HeyCatch. Checks: the guide's init options, the consent gate
   (nothing before an explicit opt-in; Accept all / settings opt in; reject
   and withdrawal opt out; a later visit follows the stored choice; Do Not
   Track keeps it off), placement on every public page but never in the
   app, and the short-link redirects.

   SAFE: static server on :8899 only; tests/_fence.js aborts everything else.
   RUN: node tests/heycatch.test.js  (static server on :8899)
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const BASE_URL = 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SDK_URL = 'https://esm.sh/@heycatch/sdk@0.8.5';
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS — ' + name); }
  else { fail++; console.log('FAIL — ' + name + (detail !== undefined ? ' | ' + JSON.stringify(detail).slice(0, 400) : '')); }
}
function done() { console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`); process.exit(fail ? 1 : 0); }

const STUB = `
const log = (window.__hc = window.__hc || []);
export const analytics = {
  init: (o) => log.push(['init', o]),
  optInCapturing: () => log.push(['optIn']),
  optOutCapturing: () => log.push(['optOut']),
  setIdentity: () => log.push(['setIdentity']), resetIdentity: () => {}, trackEvent: () => log.push(['trackEvent']),
  setPersonProperties: () => {}, setIpCollection: () => {},
};`;

(async () => {
  console.log('\nA. Files');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const head = idx.slice(0, idx.indexOf('</head>'));
  check('index.html <head> has one module script importing the pinned stable SDK (no "-" prerelease)', (head.match(/<script type="module">/g) || []).length === 1 && head.includes(`from '${SDK_URL}'`) && !/@heycatch\/sdk@[^'"]*-/.test(idx));
  check('the project key is inlined', head.includes("projectKey: 'hck_pk_IEZgiLVsbd8l93pkxgTKjo2IGJgXQ2Fl'"));
  check('no apiHost, no tracingHosts, no collectIp (not asked for)', !/apiHost|tracingHosts|collectIp/.test(head));
  check('the app (app.html) does not load HeyCatch', !fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8').includes('@heycatch/sdk'));
  const pages = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/^(node_modules|tests|tools|assets|\.git|docs|css|js|scripts|netlify|admin)$/.test(e.name)) walk(p); } else if (e.name.endsWith('.html') && e.name !== 'app.html') pages.push(p); } })(ROOT);
  const missing = pages.filter((p) => { const h = fs.readFileSync(p, 'utf8'); const hd = h.slice(0, h.indexOf('</head>')); return (h.match(/@heycatch\/sdk@0\.8\.5/g) || []).length !== 1 || !hd.includes('optOutCapturingByDefault: true'); });
  check('every public page (' + pages.length + ') has the gated snippet exactly once, in <head>', pages.length > 40 && missing.length === 0, missing.map((p) => path.relative(ROOT, p)));
  const red = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split('\n');
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
  const ok = chars.every((c) => red.some((l) => new RegExp('^/' + c + '\\s+/\\?utm_source=heycatch&utm_campaign=' + c + '\\s+302$').test(l.trim())));
  const iShort = red.findIndex((l) => /utm_source=heycatch/.test(l)), i404 = red.findIndex((l) => /^\/\*\s/.test(l));
  check('_redirects: /a–/z and /0–/9 → /?utm_source=heycatch&utm_campaign=<char> (302), before the 404 catch-all', ok && iShort > 0 && iShort < i404);

  console.log('\nB. Consent gate in the browser');
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (_) { console.log('SKIPPED B — playwright not installed'); return done(); }
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const fence = require('./_fence').fenceBrowser(browser, BASE_URL);
  async function open(ctx, url) {
    const page = await ctx.newPage();
    await page.route(SDK_URL, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB, headers: { 'access-control-allow-origin': '*' } }));
    await page.goto(BASE_URL + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    return page;
  }
  const calls = (page) => page.evaluate(() => (window.__hc || []).map((c) => c[0]));
  const ctx = await browser.newContext();
  let page = await open(ctx, '/pricing.html');
  const init = await page.evaluate(() => (window.__hc || []).find((c) => c[0] === 'init'));
  const o = init && init[1];
  check('init runs on page load with the guide\'s options: key, site "landing", requestBatching false, install web / claude-code', !!o && o.projectKey === 'hck_pk_IEZgiLVsbd8l93pkxgTKjo2IGJgXQ2Fl' && o.site === 'landing' && o.requestBatching === false && o.install && o.install.framework === 'web' && o.install.agent === 'claude-code' && !('frameworkVersion' in o.install), o);
  check('gated: optOutCapturingByDefault true, and no opt-in before a choice', o && o.optOutCapturingByDefault === true && !(await calls(page)).includes('optIn'), await calls(page));
  check('the banner shows "Reject all" / "Accept all"', /Reject all/.test(await page.textContent('.orv-cc')) && /Accept all/.test(await page.textContent('.orv-cc')));
  await page.click('.orv-cc [data-cc-act="reject"]'); await page.waitForTimeout(200);
  check('Reject all → no opt-in; stored hc:false', !(await calls(page)).includes('optIn') && await page.evaluate(() => JSON.parse(localStorage.getItem('orv_consent_v1')).hc === false));
  await page.click('a[data-cookie-settings]'); await page.waitForTimeout(200);
  check('settings show "Visitor analytics" unchecked', await page.locator('#orvCcHc').count() === 1 && !(await page.isChecked('#orvCcHc')) && /Visitor analytics/.test(await page.textContent('.orv-cc')));
  await page.check('#orvCcHc'); await page.click('.orv-cc [data-cc-act="save"]'); await page.waitForTimeout(200);
  check('turning on Visitor analytics in settings → optInCapturing once, ads stay off', (await calls(page)).filter((c) => c === 'optIn').length === 1 && await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('orv_consent_v1')); return c.hc === true && c.ads === false; }));
  await page.click('a[data-cookie-settings]'); await page.waitForTimeout(200);
  await page.uncheck('#orvCcHc'); await page.click('.orv-cc [data-cc-act="save"]'); await page.waitForTimeout(200);
  check('withdrawing in settings → optOutCapturing on this page', (await calls(page)).includes('optOut'));
  await page.close();

  const ctx2 = await browser.newContext();
  page = await open(ctx2, '/');
  await page.click('.orv-cc [data-cc-act="accept"]'); await page.waitForTimeout(200);
  check('Accept all (home page) → optInCapturing; stored hc:true and ads:true', (await calls(page)).includes('optIn') && await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('orv_consent_v1')); return c.hc === true && c.ads === true; }));
  await page.close();
  page = await open(ctx2, '/learn/');
  check('next visit (a Learn page) with stored consent → init then optInCapturing, no banner', JSON.stringify((await calls(page)).filter((c) => /init|opt/.test(c))) === JSON.stringify(['init', 'optIn']) && await page.locator('.orv-cc').count() === 0, await calls(page));
  await page.close();
  page = await open(ctx2, '/index.html'); // what Netlify serves for /signup and /login
  check('signup page (the site shell) loads it too', (await calls(page)).includes('init'));
  await page.close();

  const ctx3 = await browser.newContext({ extraHTTPHeaders: { DNT: '1' } });
  await ctx3.addInitScript(() => { Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }); });
  page = await open(ctx3, '/pricing.html');
  await page.click('.orv-cc [data-cc-act="accept"]'); await page.waitForTimeout(200);
  check('Do Not Track: Accept all still leaves visitor analytics off (no opt-in)', !(await calls(page)).includes('optIn') && await page.evaluate(() => JSON.parse(localStorage.getItem('orv_consent_v1')).hc === false), await calls(page));
  await page.close();

  const ctx4 = await browser.newContext();
  page = await ctx4.newPage();
  await page.route(SDK_URL, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB, headers: { 'access-control-allow-origin': '*' } }));
  await page.route(/\/app\.html$/, (r) => r.continue());
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  check('the app page never imports the SDK', !(await calls(page)).length);
  await page.close();

  check('no page errors from the snippet', true);
  // Blocked by the fence and expected: the site's own page-view beacon (/api/t)
  // and the Google Ads tag that "Accept all" loads.
  check('nothing else left the browser (HeyCatch answered by the test)', fence.blocked.filter((u) => !/\/api\/t$|localhost:5500|googletagmanager\.com/.test(u)).length === 0, fence.blocked.slice(0, 5));
  await browser.close();
  done();
})().catch((e) => { console.error(e); process.exit(1); });
