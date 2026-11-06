/* ════════════════════════════════════════════════════════════════
   Stripe Checkout redirect — the plan confirmation and the hand-off to
   Stripe, in the real app.html (js/auth.js selectPlan/orvStartCheckout,
   js/planConfirm.js, js/onboardingFlow.js, css/plan-confirm.css).

   Entry points: the onboarding plans step (where the public pricing page's
   "Choose This Plan" → /app?plan=… lands) and the in-app plan picker /
   Settings (selectPlan directly, also the old selectPlan(id, button) form).
   All five plans. Errors, retry, double clicks, timeouts, a missing or
   non-Stripe URL, the layout while opening (desktop and mobile).

   SAFETY: a network fence (tests/_fence.js). The app's API base
   (http://localhost:5500 — a real backend may run there) is answered by
   this test inside the browser and never reached; Stripe's checkout host is
   answered inside the browser too; everything else is aborted. No real
   accounts, no Stripe, no payments.

   RUN: node tests/checkout-redirect.test.js
   ════════════════════════════════════════════════════════════════ */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BE = path.resolve(ROOT, '..', 'oriven-backend', 'server');
const express = require(require.resolve('express', { paths: [BE, ROOT] }));
const { chromium } = require('playwright');
const CHROME = process.env.CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const PORT = 8963, BASE = 'http://127.0.0.1:' + PORT, DEV_API = 'http://localhost:5500';
const PLANS = [['flex', 'Flex', '17'], ['monthly', 'Monthly', '29'], ['quarterly', 'Quarterly', '78'], ['semiannual', 'Semi-Annual', '143'], ['annual', 'Annual', '245']];
const stripeUrl = (plan) => 'https://checkout.stripe.com/c/pay/cs_test_' + plan + '#fid';
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 700))); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// What the mock API answers to create-checkout-session (one entry per call;
// the last one repeats).
const M = { calls: [], script: ['ok'], delay: 0 };
function script(list, delay) { M.script = list.slice(); M.delay = delay || 0; M.calls = []; }

const app = express();
app.get('/app', (q, r) => r.sendFile(path.join(ROOT, 'app.html')));
app.use(express.static(ROOT));
const server = app.listen(PORT);

async function routes(page) {
  // Cookie choice already made (all declined): the banner would otherwise
  // sit over the lower part of a phone screen.
  await page.addInitScript(() => { try { localStorage.setItem('orv_consent_v1', JSON.stringify({ v: 1, ads: false, stats: false, hc: false, at: new Date().toISOString() })); } catch (_) {} });
  await page.route(DEV_API + '/**', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    let body = null; try { body = req.postDataJSON(); } catch (_) {}
    M.calls.push({ p: u.pathname, m: req.method(), body, at: Date.now() });
    const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (u.pathname === '/api/create-checkout-session') {
      const mode = M.script.length > 1 ? M.script.shift() : M.script[0];
      if (M.delay) await sleep(M.delay);
      if (mode === 'abort') return route.abort('connectionrefused');
      if (mode === 'hang') { await sleep(4000); return json(200, { url: stripeUrl(body && body.plan) }); }
      if (mode === '503') return json(503, { error: 'Payments for this plan aren’t available right now. Nothing was charged — please try again later or contact contact@orivenai.com.', code: 'PRICE_NOT_CONFIGURED' });
      if (mode === '401') return json(401, { error: 'Sign in to choose a plan.', code: 'AUTH_REQUIRED' });
      if (mode === 'nourl') return json(200, {});
      if (mode === 'evil') return json(200, { url: 'https://checkout.stripe.com.evil.example/pay' });
      if (mode === 'http') return json(200, { url: 'http://checkout.stripe.com/c/pay/cs_test_x' });
      return json(200, { url: stripeUrl(body && body.plan) });
    }
    if (u.pathname === '/api/onboarding/session' && req.method() === 'PUT') return json(200, { session: Object.assign({}, SESSION, body || {}) });
    if (u.pathname === '/api/onboarding/plan') return json(200, { locked: true, status: 'none' });
    return json(200, {});
  });
  await page.route('https://checkout.stripe.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Stripe Checkout (test stub)</title><p>stub</p>' }));
}
let SESSION = null;
async function boot(page, viewport) {
  await routes(page);
  if (viewport) await page.setViewportSize(viewport);
  await page.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.orvOnboardingFlow && typeof window.selectPlan === 'function' && typeof window.orvConfirmPlan === 'function', null, { timeout: 15000 });
  await page.evaluate(() => { window._apiToken = 'mock-token'; window._getAccessToken = async () => 'mock-token'; if (window.orvTour) window.orvTour.open = function () {}; });
}
async function openPaywall(page) {
  const a = await page.evaluate(() => window.orvOnboardingFlow.ASSISTANTS[0].id);
  SESSION = { status: 'in_progress', step: 'paywall', answers: {}, assistant: a, missing: [], plan: { status: 'none' } };
  await page.evaluate((s) => { window.orvOnboardingFlow.open(s); }, SESSION);
  await page.waitForSelector('#onx [data-buy="annual"]', { timeout: 8000 });
}
const dialog = (page) => page.evaluate(() => {
  const d = document.getElementById('orvPlanConfirm'); if (!d) return null;
  const go = d.querySelector('[data-pcf="go"]'), card = d.querySelector('.pcf__card'), err = d.querySelector('.pcf__err');
  const gr = go.getBoundingClientRect(), cr = card.getBoundingClientRect(), sp = d.querySelector('.pcf__spin');
  return {
    name: d.querySelector('.pcf__name').textContent, price: d.querySelector('.pcf__price b').textContent,
    label: go.textContent.trim(), disabled: go.disabled, busy: go.classList.contains('is-busy'),
    backDisabled: d.querySelector('.pcf__back').disabled,
    spinner: getComputedStyle(sp).display !== 'none', spinnerInside: (() => { const s = sp.getBoundingClientRect(); return s.width > 0 && s.left >= gr.left && s.right <= gr.right && s.top >= gr.top && s.bottom <= gr.bottom; })(),
    goW: Math.round(gr.width), goH: Math.round(gr.height),
    inside: gr.left >= cr.left - 0.5 && gr.right <= cr.right + 0.5,
    overflow: go.scrollWidth > go.clientWidth + 1 || card.scrollWidth > card.clientWidth + 1,
    cardW: Math.round(cr.width), vw: innerWidth,
    error: err && !err.hidden ? err.textContent : null, z: getComputedStyle(d).zIndex,
  };
});
const ckCalls = () => M.calls.filter((c) => c.p === '/api/create-checkout-session');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  require('./_fence').fenceBrowser(browser, BASE);
  const errors = [];
  const newPage = async () => { const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); p.on('pageerror', (e) => errors.push(e.message)); return p; };

  // ── A. Onboarding plans step: every plan opens Stripe ────────────
  console.log('\nA. Onboarding plans step → Stripe (all five plans)');
  for (const [id, name, price] of PLANS) {
    const page = await newPage(); await boot(page); await openPaywall(page);
    script(['ok'], 600);
    await page.click('#onx [data-buy="' + id + '"]'); await page.waitForSelector('#orvPlanConfirm');
    // after the dialog's open animation (scale .99 → 1)
    await page.waitForFunction(() => { const c = document.querySelector('#orvPlanConfirm .pcf__card'); return c && c.getAnimations().every((a) => a.playState === 'finished'); }, null, { timeout: 3000 }).catch(() => {});
    const before = await dialog(page);
    const cardBtn = await page.evaluate((pid) => document.querySelector('#onx [data-buy="' + pid + '"]').textContent.trim(), id);
    const vatText = await page.evaluate(() => { const d = document.getElementById('orvPlanConfirm'); return { price: d.querySelector('.pcf__price').textContent, vat: (d.querySelector('[data-fact="vat"]') || {}).textContent || '' }; });
    const NL = { flex: '€17 + €3.57 = €20.57', monthly: '€29 + €6.09 = €35.09', quarterly: '€78 + €16.38 = €94.38', semiannual: '€143 + €30.03 = €173.03', annual: '€245 + €51.45 = €296.45' }[id];
    check('A.' + id + ' VAT shown on top of the plan price: "+ VAT", Dutch example ' + NL + ', no "incl. VAT"', /\+ VAT/.test(vatText.price) && vatText.vat.replace(/\s+/g, ' ').includes(NL) && !/incl\. VAT/.test(vatText.price + vatText.vat), vatText);
    const nav = page.waitForURL(/checkout\.stripe\.com\/c\/pay\/cs_test_/, { timeout: 8000 }).then(() => true).catch(() => false);
    await page.click('#orvPlanConfirm [data-pcf="go"]');
    await sleep(150);
    const during = await dialog(page);
    const reached = await nav;
    const ck = ckCalls(); const put = M.calls.find((c) => c.p === '/api/onboarding/session' && c.m === 'PUT');
    check('A.' + id + ' ' + name + ': dialog shows ' + name + ' €' + price + '; while the server answers the button keeps its size with the spinner inside; the plan card button is untouched',
      before && before.name === name && before.price.includes(price) && during && during.busy && during.disabled && during.backDisabled && during.spinner && during.spinnerInside && /Opening secure checkout/.test(during.label) && Math.abs(during.goW - before.goW) <= 1 && Math.abs(during.goH - before.goH) <= 1 && during.inside && !during.overflow && cardBtn === 'Choose ' + name,
      { before, during, cardBtn });
    check('A.' + id + ' one request {plan:"' + id + '", source:"onboarding"} after the answers were saved (step paywall) → the browser opens the URL Stripe returned',
      reached && ck.length === 1 && ck[0].body.plan === id && ck[0].body.source === 'onboarding' && Object.keys(ck[0].body).every((k) => ['plan', 'source'].includes(k)) && put && put.body.step === 'paywall' && put.at <= ck[0].at && page.url() === stripeUrl(id),
      { reached, url: page.url(), ck, put });
    await page.close();
  }

  // ── B. Failures: clear message, retry, no duplicate request ──────
  console.log('\nB. Failures, retry, duplicates (onboarding)');
  {
    const page = await newPage(); await boot(page); await openPaywall(page);
    script(['503', 'ok'], 300);
    await page.click('#onx [data-buy="annual"]'); await page.waitForSelector('#orvPlanConfirm');
    await page.evaluate(() => { const g = document.querySelector('#orvPlanConfirm [data-pcf="go"]'); g.click(); g.click(); g.click(); });
    await page.keyboard.press('Escape'); await sleep(100);
    const stillOpen = !!(await page.$('#orvPlanConfirm'));
    await sleep(500);
    const err = await dialog(page);
    check('B1. three fast clicks → one request; Escape while opening does not close it; the server\'s reason shows in the dialog, button "Try again", no redirect, no hang',
      stillOpen && ckCalls().length === 1 && err && /aren’t available right now/.test(err.error || '') && err.label === 'Try again' && !err.disabled && !err.busy && !err.backDisabled && !/stripe/.test(page.url()), { stillOpen, n: ckCalls().length, err });
    const nav = page.waitForURL(/cs_test_annual/, { timeout: 8000 }).then(() => true).catch(() => false);
    await page.click('#orvPlanConfirm [data-pcf="go"]');
    check('B2. "Try again" → a second request → Stripe opens', (await nav) && ckCalls().length === 2, { n: ckCalls().length, url: page.url() });
    await page.close();
  }
  for (const [mode, re, label] of [
    ['nourl', /couldn’t be opened/, 'no URL in the answer'],
    ['evil', /couldn’t be opened/, 'a URL that is not Stripe\'s (checkout.stripe.com.evil.example)'],
    ['http', /couldn’t be opened/, 'a non-https URL'],
    ['abort', /couldn’t reach OrivenAI/, 'the API cannot be reached'],
    ['401', /session has ended/, 'the session has expired (401)'],
  ]) {
    const page = await newPage(); await boot(page); await openPaywall(page);
    script([mode]);
    await page.click('#onx [data-buy="monthly"]'); await page.waitForSelector('#orvPlanConfirm');
    await page.click('#orvPlanConfirm [data-pcf="go"]'); await sleep(500);
    const d = await dialog(page);
    check('B.' + mode + ' ' + label + ' → a clear message, nothing opened, retry possible', d && re.test(d.error || '') && d.label === 'Try again' && !d.disabled && /127\.0\.0\.1/.test(page.url()), { d, url: page.url() });
    await page.close();
  }
  {
    const page = await newPage(); await boot(page); await openPaywall(page);
    await page.evaluate(() => { ORV_CHECKOUT_TIMEOUT_MS = 800; });
    script(['hang']);
    await page.click('#onx [data-buy="quarterly"]'); await page.waitForSelector('#orvPlanConfirm');
    await page.click('#orvPlanConfirm [data-pcf="go"]'); await sleep(1300);
    const d = await dialog(page);
    check('B.timeout a server that doesn\'t answer → "taking longer than usual", retry possible (no endless spinner)', d && /taking longer than usual/.test(d.error || '') && d.label === 'Try again' && !d.busy, d);
    await page.click('#orvPlanConfirm .pcf__back'); await sleep(150);
    check('B.cancel "Choose a different plan" after an error closes the dialog; the plans stay usable', !(await page.$('#orvPlanConfirm')) && await page.isEnabled('#onx [data-buy="annual"]'));
    await page.close();
  }

  // ── C. In-app plan picker / Settings: selectPlan directly ────────
  console.log('\nC. In-app plan picker and Settings (selectPlan)');
  for (const [id, name] of PLANS) {
    const page = await newPage(); await boot(page);
    script(['ok'], 200);
    await page.evaluate((pid) => { selectPlan(pid); }, id); await page.waitForSelector('#orvPlanConfirm');
    const d = await dialog(page);
    const nav = page.waitForURL(/checkout\.stripe\.com/, { timeout: 8000 }).then(() => true).catch(() => false);
    await page.click('#orvPlanConfirm [data-pcf="go"]');
    const ck = ckCalls();
    check('C.' + id + ' selectPlan("' + id + '") → ' + name + ' confirmed → one request (source app) → Stripe', d && d.name === name && (await nav) && ckCalls().length === 1 && ckCalls()[0].body.plan === id && ckCalls()[0].body.source === 'app' && page.url() === stripeUrl(id), { d, ck, url: page.url() });
    await page.close();
  }
  {
    const page = await newPage(); await boot(page);
    script(['ok'], 200);
    // the old picker form: selectPlan(id, this)
    await page.evaluate(() => { const b = document.createElement('button'); b.id = 'oldBtn'; b.textContent = 'Choose Annual'; document.body.appendChild(b); selectPlan('annual', b); });
    await page.waitForSelector('#orvPlanConfirm');
    const nav = page.waitForURL(/cs_test_annual/, { timeout: 8000 }).then(() => true).catch(() => false);
    await page.click('#orvPlanConfirm [data-pcf="go"]');
    check('C.legacy selectPlan("annual", button) still confirms and opens Stripe', await nav);
    await page.close();
  }
  {
    // Without the dialog script (fallback): the button carries the state, a failure shows a toast above the onboarding.
    const page = await newPage(); await boot(page); await openPaywall(page);
    await page.evaluate(() => { window.orvConfirmPlan = undefined; });
    script(['503'], 700);
    await page.click('#onx [data-buy="semiannual"]'); await sleep(150);
    const busy = await page.evaluate(() => { const b = document.querySelector('#onx [data-buy="semiannual"]'), c = b.closest('.onx-plan'); const br = b.getBoundingClientRect(), cr = c.getBoundingClientRect(); return { text: b.textContent.trim(), disabled: b.disabled, spin: !!b.querySelector('.orv-ck-spin'), inside: br.left >= cr.left - 0.5 && br.right <= cr.right + 0.5, overflow: b.scrollWidth > b.clientWidth + 1 }; });
    await sleep(900);
    const after = await page.evaluate(() => { const t = document.getElementById('toast'), b = document.querySelector('#onx [data-buy="semiannual"]'); return { toast: t.textContent, shown: t.classList.contains('show'), z: +getComputedStyle(t).zIndex, onx: +getComputedStyle(document.getElementById('onx')).zIndex, btn: b.textContent.trim(), disabled: b.disabled }; });
    check('C.fallback no dialog: the plan button shows the spinner inside its card while opening; on failure a toast ABOVE the onboarding and the button is restored',
      busy.disabled && busy.spin && /Opening secure checkout/.test(busy.text) && busy.inside && !busy.overflow && after.shown && /aren’t available/.test(after.toast) && after.z > after.onx && after.btn === 'Choose Semi-Annual' && !after.disabled, { busy, after });
    await page.close();
  }

  // ── D. Layout: mobile and narrow plan cards ──────────────────────
  console.log('\nD. Layout (desktop plan cards, mobile dialog)');
  for (const vp of [{ width: 1440, height: 1000 }, { width: 1100, height: 900 }, { width: 375, height: 740 }]) {
    const page = await newPage(); await boot(page, vp); await openPaywall(page);
    const cards = await page.evaluate(() => Array.from(document.querySelectorAll('#onx [data-buy]')).map((b) => { const c = b.closest('.onx-plan'); const br = b.getBoundingClientRect(), cr = c.getBoundingClientRect(); return { id: b.getAttribute('data-buy'), ok: br.left >= cr.left - 0.5 && br.right <= cr.right + 0.5 && b.scrollWidth <= b.clientWidth + 1 }; }));
    check('D.' + vp.width + ' every plan button stays inside its card', cards.every((c) => c.ok), cards);
    script(['ok'], 1500);
    await page.click('#onx [data-buy="semiannual"]'); await page.waitForSelector('#orvPlanConfirm');
    await page.click('#orvPlanConfirm [data-pcf="go"]'); await sleep(200);
    const d = await dialog(page);
    const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    check('D.' + vp.width + ' opening: the dialog fits the screen, the busy button stays inside it, no sideways scroll; the dialog sits above the onboarding',
      d && d.busy && d.inside && !d.overflow && d.cardW <= d.vw && noHScroll && +d.z > 10050, { d, noHScroll });
    if (vp.width === 375) await page.screenshot({ path: path.join(__dirname, '_shots', 'checkout-busy-375.png') }).catch(() => {});
    await page.close();
  }

  // ── E. Public pricing page → /app?plan=… (the onboarding entry) ──
  console.log('\nE. Public pricing page links');
  {
    const page = await newPage();
    await page.goto(BASE + '/pricing.html', { waitUntil: 'domcontentloaded' }); await sleep(600);
    const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('a[href*="/app?plan="]')).map((a) => a.getAttribute('href')));
    const ids = PLANS.map((p) => p[0]);
    check('E1. the pricing page links every plan to /app?plan=<id> (sign-in → onboarding plans step, tested in A) — never to Stripe directly',
      ids.every((id) => hrefs.some((h) => h === '/app?plan=' + id)) && !(await page.evaluate(() => !!document.querySelector('a[href*="stripe.com"]'))), hrefs);
    await page.close();
  }

  check('Z. no page errors', errors.length === 0, errors.slice(0, 5));
  await browser.close(); server.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
