/* ════════════════════════════════════════════════════════════════
   Network fence for ANY browser test, loaded before the test file:

     node -r ./tests/_fence-preload.js tests/<name>.test.js

   Wraps Playwright so every browser context it creates can reach ONLY local
   test servers (localhost / 127.0.0.1 on any port EXCEPT 5500, where the
   real backend — connected to production — often runs) and static library
   GETs from public CDNs. Everything else (Supabase, Stripe, ad platforms,
   analytics, the real backend) is aborted. Older suites that don't fence
   themselves become safe to run without changing them; suites that do
   fence themselves are unaffected (their own route handlers run first).

   Blocked requests are counted on process exit (FENCE_REPORT=1 prints them).
   ════════════════════════════════════════════════════════════════ */
'use strict';
const Module = require('module');
const blocked = [];
const ALLOW_CDN = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
function allowed(url, method) {
  if (/^(data|blob|about):/.test(url)) return true;
  const m = /^https?:\/\/(localhost|127\.0\.0\.1)(?::(\d+))?\//.exec(url);
  if (m) return (m[2] || '80') !== '5500';
  return method === 'GET' && ALLOW_CDN.test(url);
}
async function fenceContext(ctx) {
  if (!ctx || ctx.__orvFenced) return ctx;
  ctx.__orvFenced = true;
  await ctx.route('**/*', (route) => {
    const req = route.request(), url = req.url();
    if (allowed(url, req.method())) return route.fallback ? route.fallback() : route.continue();
    blocked.push(req.method() + ' ' + url.split('?')[0]);
    return route.abort('blockedbyclient');
  });
  return ctx;
}
function wrapBrowser(browser) {
  if (!browser || browser.__orvFenced) return browser;
  browser.__orvFenced = true;
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...a) => fenceContext(await newContext(...a));
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (...a) => { const p = await newPage(...a); await fenceContext(p.context()); return p; };
  return browser;
}
function wrapType(type) {
  if (!type || type.__orvFenced) return type;
  type.__orvFenced = true;
  const launch = type.launch.bind(type);
  type.launch = async (...a) => wrapBrowser(await launch(...a));
  if (type.launchPersistentContext) {
    const lpc = type.launchPersistentContext.bind(type);
    type.launchPersistentContext = async (...a) => fenceContext(await lpc(...a));
  }
  return type;
}
const _load = Module._load;
Module._load = function (request) {
  const mod = _load.apply(this, arguments);
  if (request === 'playwright' || request === 'playwright-core' || request === '@playwright/test') {
    ['chromium', 'firefox', 'webkit'].forEach((k) => { if (mod && mod[k]) wrapType(mod[k]); });
  }
  return mod;
};
process.on('exit', () => {
  if (process.env.FENCE_REPORT) {
    const uniq = Array.from(new Set(blocked));
    console.log('\n[fence] blocked ' + blocked.length + ' outside requests' + (uniq.length ? ':\n  ' + uniq.slice(0, 30).join('\n  ') : ''));
  }
});
