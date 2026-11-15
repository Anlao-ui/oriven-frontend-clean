// ════════════════════════════════════════════════════════════════
// Google Tag Manager (GTM-TG8CFRMZ) via js/consent.js: loaded once, only
// after "Visitor analytics" consent, only on the public website (not /app),
// Consent Mode analytics_storage follows the choice, the Google Ads tag
// (AW-18538836764) is unchanged, client-side navigation does not load GTM
// again, and every public page includes js/consent.js.
// Fenced: only this test's static server; gtm.js and gtag/js are stubbed.
// RUN: node tests/gtm-consent.test.js
// ════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
const { fenceBrowser } = require('./_fence');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8971, BASE = 'http://127.0.0.1:' + PORT;
const GTM = 'GTM-TG8CFRMZ', AW = 'AW-18538836764';
let pass = 0, fail = 0;
const check = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' :: ' + JSON.stringify(info).slice(0, 400))); };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };
const rules = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/));
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, BASE).pathname);
  const m = rules.find((x) => x[0] === p && /^200/.test(x[2] || '')); if (m) p = m[1];
  let f = path.join(ROOT, p);
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (_) { if (fs.existsSync(f + '.html')) f += '.html'; }
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});

const ALL = { v: 1, ads: true, stats: true, hc: true, at: '2026-11-15T00:00:00.000Z' };
const ADS_ONLY = { v: 1, ads: true, stats: true, hc: false, at: '2026-11-15T00:00:00.000Z' };

(async () => {
  await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
  const browser = await chromium.launch();
  fenceBrowser(browser, BASE);
  const errors = [];

  async function open(p, consent, ctxOpts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, ctxOpts || {}));
    const page = await ctx.newPage();
    const req = { gtm: [], gtag: [] };
    page.on('pageerror', (e) => errors.push(p + ': ' + e.message));
    // Stubs registered after the fence, so they win for these two URLs.
    await page.route('https://www.googletagmanager.com/gtm.js**', (rt) => { req.gtm.push(rt.request().url()); rt.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__gtmStub=(window.__gtmStub||0)+1;' }); });
    await page.route('https://www.googletagmanager.com/gtag/js**', (rt) => { req.gtag.push(rt.request().url()); rt.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__gtagStub=1;' }); });
    if (consent) await page.addInitScript((c) => { try { localStorage.setItem('orv_consent_v1', JSON.stringify(c)); } catch (_) {} }, consent);
    await page.goto(BASE + p, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    return { ctx, page, req };
  }
  const state = (page) => page.evaluate(() => {
    const dl = window.dataLayer || [];
    const cons = dl.filter((a) => a && a[0] === 'consent').map((a) => [a[1], a[2]]);
    return {
      gtmScripts: document.querySelectorAll('script[src*="googletagmanager.com/gtm.js"]').length,
      gtagScripts: document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').length,
      gtmStart: dl.filter((a) => a && a.event === 'gtm.js').length,
      cfg: dl.filter((a) => a && a[0] === 'config').map((a) => a[1]),
      analytics: cons.filter((c) => c[1] && c[1].analytics_storage).map((c) => c[0] + ':' + c[1].analytics_storage),
      noscriptIframe: !!document.querySelector('noscript iframe[src*="googletagmanager"]'),
      gtmLoaded: window.orvConsent && window.orvConsent.get().gtmLoaded,
    };
  });

  // A. First visit, no choice yet
  let { ctx, page, req } = await open('/', null);
  let s = await state(page);
  check('first visit: no GTM and no Google Ads tag before a choice; analytics_storage denied by default', s.gtmScripts === 0 && req.gtm.length === 0 && req.gtag.length === 0 && s.analytics.join() === 'default:denied', { s, req });
  check('no <noscript> GTM iframe (it would bypass consent)', !s.noscriptIframe);
  await page.click('.orv-cc [data-cc-act="accept"]'); await page.waitForTimeout(500);
  s = await state(page);
  check('Accept all: exactly one GTM load with ' + GTM + ' and one gtm.js start event', s.gtmScripts === 1 && req.gtm.length === 1 && new URL(req.gtm[0]).searchParams.get('id') === GTM && s.gtmStart === 1, { s, req });
  check('Accept all: Google Ads tag unchanged (one gtag.js ' + AW + ', config ' + AW + ' only)', s.gtagScripts === 1 && req.gtag.length === 1 && /id=AW-18538836764$/.test(req.gtag[0]) && s.cfg.join() === AW, { s, req });
  check('Accept all: Consent Mode analytics_storage updated to granted', s.analytics.includes('update:granted'), s);
  // Open settings and save again: no second load
  await page.evaluate(() => window.orvConsent.set({ ads: true, stats: true, analytics: true })); await page.waitForTimeout(300);
  s = await state(page);
  check('saving the same choice again does not load GTM a second time', s.gtmScripts === 1 && req.gtm.length === 1 && s.gtmStart === 1, { s, req });
  // Withdraw
  await page.evaluate(() => { document.cookie = '_ga=GA1.1.1.1; path=/'; document.cookie = '_ga_TEST=GS1; path=/'; window.orvConsent.set({ ads: true, stats: true, analytics: false }); }); await page.waitForTimeout(300);
  s = await state(page);
  const cookies = await page.evaluate(() => document.cookie);
  check('withdrawing visitor analytics: analytics_storage denied again, _ga cookies removed, no new load', s.analytics[s.analytics.length - 1] === 'update:denied' && !/_ga/.test(cookies) && req.gtm.length === 1, { s, cookies });
  await ctx.close();

  // B. Returning visitor with consent: loaded once at page load; client-side navigation does not reload it
  ({ ctx, page, req } = await open('/', ALL));
  s = await state(page);
  check('returning visitor (consent stored): GTM loaded once at page load', s.gtmScripts === 1 && req.gtm.length === 1 && s.gtmStart === 1 && s.gtmLoaded === true, { s, req });
  const link = await page.$('a[href="/pricing"]');
  if (link) { await page.evaluate(() => { const a = document.querySelector('a[href="/pricing"]'); a.click(); }); await page.waitForTimeout(800); }
  s = await state(page);
  check('after navigating to ' + page.url().replace(BASE, '') + ': the page has one GTM script and one gtm.js start (one load per page, never two)', s.gtmScripts === 1 && s.gtmStart === 1, { s, req, url: page.url() });
  await ctx.close();

  // C. Only advertising accepted: no GTM
  ({ ctx, page, req } = await open('/', ADS_ONLY));
  s = await state(page);
  check('advertising only (visitor analytics off): no GTM, Google Ads tag loads as before', s.gtmScripts === 0 && req.gtm.length === 0 && req.gtag.length === 1, { s, req });
  await ctx.close();

  // D. Privacy signal (Global Privacy Control) keeps GTM off even with stored consent
  ({ ctx, page, req } = await open('/', ALL));
  await ctx.close();
  {
    const c2 = await browser.newContext();
    const p2 = await c2.newPage(); const gtm = [];
    await p2.route('https://www.googletagmanager.com/**', (rt) => { if (/gtm\.js/.test(rt.request().url())) gtm.push(1); rt.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
    await p2.addInitScript((c) => { Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }); localStorage.setItem('orv_consent_v1', JSON.stringify(c)); }, ALL);
    await p2.goto(BASE + '/', { waitUntil: 'load' }); await p2.waitForTimeout(600);
    check('Global Privacy Control: no GTM', gtm.length === 0, gtm);
    await c2.close();
  }

  // E. The app: never GTM (the Google Ads URL rule counts /app page views as signups)
  ({ ctx, page, req } = await open('/app', ALL));
  s = await state(page);
  check('/app with full consent: no GTM and no Google Ads tag on page load', s.gtmScripts === 0 && req.gtm.length === 0 && req.gtag.length === 0, { s, req });
  await ctx.close();

  // F. Generated public pages: one GTM each after consent
  for (const p of ['/pricing', '/privacy', '/cookie-policy', '/product/snapchat-ads', '/learn/', '/learn/madgicx-alternatives/', '/blog', '/solutions/connected-workflow', '/cross-platform-ad-management/']) {
    ({ ctx, page, req } = await open(p, ALL));
    s = await state(page);
    check(p + ': one GTM (' + GTM + '), one Google Ads tag', s.gtmScripts === 1 && req.gtm.length === 1 && s.gtmStart === 1 && s.gtagScripts === 1, { s, req });
    await ctx.close();
  }

  // G. Policy texts name Google Analytics / Tag Manager
  ({ ctx, page } = await open('/cookie-policy', ALL));
  const cp = await page.evaluate(() => document.body.innerText);
  check('cookie policy names Google Tag Manager, Google Analytics and the _ga cookies', /Google Tag Manager/.test(cp) && /Google Analytics/.test(cp) && /_ga/.test(cp), cp.slice(0, 200));
  await ctx.close();
  ({ ctx, page } = await open('/privacy', ALL));
  const pp = await page.evaluate(() => document.body.innerText);
  check('privacy policy names Google Analytics as visitor analytics', /Visitor analytics \(Google Analytics\)/.test(pp), pp.slice(0, 200));
  await ctx.close();
  await browser.close(); srv.close();

  // H. Files: every public page includes js/consent.js; GTM ID only in consent.js; no hard-coded snippet
  const files = execSync('git ls-files "*.html"', { cwd: ROOT }).toString().trim().split(/\r?\n/).filter((f) => !/^(admin|tests|node_modules)\//.test(f));
  const missing = files.filter((f) => !/<script src="\/?js\/consent\.js"><\/script>/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  check('every public HTML page (' + files.length + ') loads js/consent.js', missing.length === 0, missing);
  const hard = files.filter((f) => /gtm\.js\?id=|GTM-TG8CFRMZ/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  check('no page hard-codes a GTM snippet (single loader in js/consent.js)', hard.length === 0, hard);
  const cjs = fs.readFileSync(path.join(ROOT, 'js', 'consent.js'), 'utf8');
  check('consent.js: GTM ID ' + GTM + ' once, Google Ads ID ' + AW + ' kept', (cjs.match(/GTM-TG8CFRMZ/g) || []).length >= 1 && /var AW_ID = 'AW-18538836764'/.test(cjs) && /AW_ID \+ '\/gI2OCMrExasdEJzmgIhF'/.test(cjs));
  check('no GA4 Measurement ID (G-…) hard-coded anywhere', !/['"]G-[A-Z0-9]{6,}['"]/.test(cjs) && files.every((f) => !/gtag\/js\?id=G-/.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))));
  check('no page errors', !errors.length, errors);
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
