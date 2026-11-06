/* ════════════════════════════════════════════════════════════════
   Entry routing in production mode — js/auth.js (_loadUserProfile →
   _orvEntryState → _orvOpenPlanScreen), js/onboarding.js (gate),
   js/onboardingFlow.js (renewal, silent payment check).

   The app runs under a non-local hostname (app.orivenai.test → 127.0.0.1),
   so the production code path is used (on localhost the dev bypass always
   shows the app). Every animation frame records whether the application is
   visible while nothing covers it — a "dashboard flash".

   SAFETY: network fence (tests/_fence.js). The production API host and the
   Supabase project are answered INSIDE the browser by this test (page.route)
   and never reached; a fake, locally stored session is used. No real
   accounts, no Stripe, no payments.

   RUN: node tests/entry-routing.test.js
   ════════════════════════════════════════════════════════════════ */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BE = path.resolve(ROOT, '..', 'oriven-backend', 'server');
const express = require(require.resolve('express', { paths: [BE, ROOT] }));
const { chromium } = require('playwright');
const CHROME = process.env.CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const PORT = 8973, HOST = 'app.orivenai.test', BASE = 'http://' + HOST + ':' + PORT;
const API = 'https://oriven-backand-clean.onrender.com', SBURL = 'https://rsqfoqitooxmkyrkuyzi.supabase.co';
const SB_KEY = 'sb-rsqfoqitooxmkyrkuyzi-auth-token';
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 700))); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 864e5, iso = (ms) => new Date(ms).toISOString();

const app = express();
app.get('/app', (q, r) => r.sendFile(path.join(ROOT, 'app.html')));
app.use(express.static(ROOT));
const server = app.listen(PORT);

// ── Scenario state (the mock server's view of the account) ──
let SC = null, CALLS = [];
const UID = '11111111-2222-4333-8444-555555555555';
const PROFILES = {
  paid: { subscription_status: 'paid', access_plan: 'monthly', access_expires_at: iso(Date.now() + 20 * DAY), onboarding_completed: true, credits_balance: 900 },
  newUser: { subscription_status: 'free', access_plan: null, access_expires_at: null, onboarding_completed: false, credits_balance: 0 },
  expired: { subscription_status: 'free', access_plan: 'quarterly', access_expires_at: iso(Date.now() - 3 * DAY), onboarding_completed: true, credits_balance: 0 },
  legacyFree: { subscription_status: 'free', access_plan: null, access_expires_at: null, onboarding_completed: null, credits_balance: 230, created_at: '2025-03-01T10:00:00.000Z' },
};
// The server's decision (services/entitlement.js), as /api/onboarding/state returns it.
function decide() {
  const p = SC.profile;
  // services/pricing.js hasAccess: a future end date AND a paying status or one of the five plans in access_plan.
  const planId = /^(flex|monthly|quarterly|semiannual|annual)$/.test(String(p.access_plan || '').toLowerCase().replace(/[^a-z]/g, ''));
  const active = !!p.access_expires_at && new Date(p.access_expires_at).getTime() > Date.now() && (p.subscription_status !== 'free' || planId);
  const state = active ? 'active' : p.access_expires_at ? 'expired' : 'none';
  const route = active ? 'app' : state === 'expired' ? 'plans' : (SC.eligible ? 'onboarding' : 'app');
  return { active, state, route, planRequired: route !== 'app', plan: active ? p.access_plan : null, lastPlan: p.access_plan, expiresAt: p.access_expires_at };
}
function stateBody() {
  const access = decide();
  const flowOn = SC.flowOn !== false;
  const flow = access.route !== 'app' && flowOn ? { enabled: true, renewal: access.route === 'plans', session: SC.session || null } : { enabled: false };
  return { eligible: access.route === 'onboarding', reason: 'x', stage: access.route === 'app' ? 'done' : 'welcome', completed: access.route === 'app', flow, access };
}
async function apiRoute(route) {
  const req = route.request(); const u = new URL(req.url());
  const call = { m: req.method(), p: u.pathname, t: Date.now() };
  CALLS.push(call);
  const json = (s, b) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(b) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.pathname === '/api/onboarding/state') {
    if (SC.stateDelay) await sleep(SC.stateDelay);
    if (SC.stateFails) return json(500, { error: 'down' });
    return json(200, stateBody());
  }
  if (u.pathname === '/api/entitlement') return json(200, decide());
  if (u.pathname === '/api/billing/sync-checkout') {
    if (SC.paidAfterSync) { SC.profile = Object.assign({}, SC.profile, { subscription_status: 'paid', access_plan: 'annual', access_expires_at: iso(Date.now() + 365 * DAY), onboarding_completed: true }); }
    return json(200, { ok: true });
  }
  if (u.pathname === '/api/campaigns' && decide().planRequired) return json(403, { error: 'Your OrivenAI access has ended. Choose a plan to continue.', code: 'ONBOARDING_REQUIRED', reason: 'ACCESS_EXPIRED' });
  return json(200, {});
}
async function sbRoute(route) {
  const req = route.request(); const u = new URL(req.url());
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const wantsObject = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
  if (u.pathname === '/rest/v1/profiles') {
    const row = Object.assign({ id: UID, email: 'customer@example.invalid', created_at: iso(Date.now() - 3600e3), preferences: {} }, SC.profile);
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(wantsObject ? row : [row]) });
  }
  if (u.pathname === '/auth/v1/user') return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(USER) });
  if (u.pathname.startsWith('/rest/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: wantsObject ? 'null' : '[]' });
  return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: '{}' });
}
const USER = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'customer@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: iso(Date.now() - 3600e3) };
function fakeJwt() {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'HS256', typ: 'JWT' }) + '.' + b({ sub: UID, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }) + '.c2ln';
}

// Records, every frame: was the application visible while neither the
// sign-in screen nor the onboarding / plans covered it?
const RECORDER = () => {
  window.__fr = { appVisible: 0, flash: 0, onx: false, routing: false, frames: 0 };
  try { sessionStorage.setItem('__erLoads', String(+(sessionStorage.getItem('__erLoads') || 0) + 1)); } catch (_) {}
  (function loop() {
    try {
      const a = document.querySelector('.app'), onx = document.getElementById('onx'), ov = document.getElementById('authOverlay');
      if (a) {
        const vis = getComputedStyle(a).display !== 'none';
        const covered = !!onx || (ov && getComputedStyle(ov).display !== 'none');
        if (vis) window.__fr.appVisible++;
        if (vis && !covered) window.__fr.flash++;
      }
      if (onx) window.__fr.onx = true;
      if (document.documentElement.classList.contains('orv-routing')) window.__fr.routing = true;
      window.__fr.frames++;
    } catch (_) {}
    requestAnimationFrame(loop);
  })();
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--host-resolver-rules=MAP ' + HOST + ' 127.0.0.1'] });
  require('./_fence').fenceBrowser(browser, BASE);
  const errors = [];
  async function run(sc, url) {
    SC = Object.assign({ eligible: false }, sc); SC.profile = Object.assign({}, sc.profile); CALLS = [];
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    if (process.env.ER_DEBUG) page.on('console', (m) => { const t = m.text(); if (/\[(Auth|ACCESS|PW-CHAIN|API)\]/.test(t)) console.log('    [page] ' + t.slice(0, 220)); });
    await page.route(API + '/**', apiRoute);
    await page.route(SBURL + '/**', sbRoute);
    const session = { access_token: fakeJwt(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh-fake', user: USER };
    await page.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('orv_consent_v1', JSON.stringify({ v: 1, ads: false, stats: false, hc: false, at: new Date().toISOString() })); } catch (_) {} }, [SB_KEY, JSON.stringify(session)]);
    await page.addInitScript(RECORDER);
    await page.goto(BASE + (url || '/app'), { waitUntil: 'domcontentloaded' });
    return { page, ctx };
  }
  const appShown = (page, ms) => page.waitForFunction(() => { const a = document.querySelector('.app'), ov = document.getElementById('authOverlay'); return a && getComputedStyle(a).display !== 'none' && ov && getComputedStyle(ov).display === 'none'; }, null, { timeout: ms || 12000 }).then(() => true).catch(() => false);
  const onxAt = (page, step, ms) => page.waitForFunction((s) => { const o = document.getElementById('onx'); return o && (!s || o.getAttribute('data-step') === s); }, step, { timeout: ms || 12000 }).then(() => true).catch(() => false);
  const fr = (page) => page.evaluate(() => window.__fr);

  // 1. Paid → app, never the onboarding or plans
  {
    const { page, ctx } = await run({ profile: PROFILES.paid, stateDelay: 600 });
    const shown = await appShown(page); await sleep(800); const f = await fr(page);
    const st = CALLS.find((c) => c.p === '/api/onboarding/state');
    check('1. active paid customer signing in → straight into the app; onboarding / plans never appear', shown && !f.onx && !!st, { shown, f });
    await ctx.close();
  }
  // 2. New account without a plan → onboarding; the app is never visible
  {
    const { page, ctx } = await run({ profile: PROFILES.newUser, eligible: true, stateDelay: 900, session: null });
    const on = await onxAt(page); await sleep(700); const f = await fr(page);
    check('2. new account without a plan → the onboarding; the dashboard is never shown, not even for one frame (server answer delayed 0.9 s)', on && f.flash === 0 && f.frames > 20, f);
    check('2b. while the server decides, the sign-in screen shows a spinner instead of its form', f.routing === true, f);
    await ctx.close();
  }
  // 3. Direct navigation to /app (same account, path /app, and app.html)
  for (const u of ['/app', '/app.html']) {
    const { page, ctx } = await run({ profile: PROFILES.newUser, eligible: true, session: null }, u);
    const on = await onxAt(page); await sleep(400); const f = await fr(page);
    check('3. direct navigation to ' + u + ' without a plan → onboarding, no dashboard flash', on && f.flash === 0, f);
    await ctx.close();
  }
  // 4. Expired → the plans (renewal), the app never shown
  {
    const { page, ctx } = await run({ profile: PROFILES.expired, session: { step: 'done', answers: {}, assistant: 'vector', missing: [] } });
    const on = await onxAt(page, 'paywall'); await sleep(400); const f = await fr(page);
    const head = on ? await page.textContent('#onx .onx-pay__head') : '';
    check('4. expired paid access → straight to the plan selection ("Your access has ended"), no questions, no dashboard', on && /Your access has ended/.test(head) && f.flash === 0 && (await page.$$('#onx .onx-plan')).length === 5, { head, f });
    await ctx.close();
  }
  // 4b. Expired, an older customer without any onboarding answers: still the plans
  {
    const { page, ctx } = await run({ profile: PROFILES.expired, session: null });
    const on = await onxAt(page, 'paywall');
    check('4b. expired customer who never did the onboarding → the plans directly (no questionnaire)', on, await page.evaluate(() => document.getElementById('onx') && document.getElementById('onx').getAttribute('data-step')));
    await ctx.close();
  }
  // 5. Older free account → app with its existing limits
  {
    const { page, ctx } = await run({ profile: PROFILES.legacyFree, eligible: false });
    const shown = await appShown(page); await sleep(500); const f = await fr(page);
    check('5. older free account → the app (existing free limits), not the paid onboarding', shown && !f.onx, f);
    await ctx.close();
  }
  // 6. Back from Stripe, paid → confirmed with the server first, then straight into the app
  {
    const { page, ctx } = await run({ profile: PROFILES.newUser, eligible: true, paidAfterSync: true, session: { step: 'paywall', answers: {}, assistant: 'vector', missing: [] } }, '/app?success=true&session_id=cs_test_a1B2c3D4e5');
    const shown = await appShown(page); await sleep(1200); const f = await fr(page);
    const loads = await page.evaluate(() => +sessionStorage.getItem('__erLoads') - 1); // reloads after the first load
    const iSync = CALLS.findIndex((c) => c.p === '/api/billing/sync-checkout'), iState = CALLS.findIndex((c) => c.p === '/api/onboarding/state');
    const toast = await page.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
    const url = new URL(page.url());
    check('6. back from Stripe after paying: the checkout is confirmed with the server BEFORE routing, then straight into the app — no onboarding, no plans, no reload in between', shown && iSync >= 0 && iState > iSync && !f.onx && loads === 0, { iSync, iState, loads, f });
    check('6b. no "Payment received / activating / confirming" messages; the Stripe return URL is cleaned to /app', !/Payment received|activating|Confirming|Checking/.test(toast) && url.pathname === '/app' && !url.searchParams.has('success') && !url.searchParams.has('session_id'), { toast, url: page.url() });
    const inApp6 = await page.evaluate(() => ({ status: typeof _dbSubscriptionStatus !== 'undefined' ? _dbSubscriptionStatus : null, plansOpen: !!document.querySelector('#modal-paywall.open') }));
    check('6c. …and inside the app the account counts as paid (not as a free account; no plan offer)', inApp6.status && inApp6.status !== 'free' && !inApp6.plansOpen, inApp6);
    await ctx.close();
  }
  // 6m. A plan assigned by hand in Supabase (no purchase): straight into the app as a paying account
  for (const typed of ['annual', 'Semi-Annual', 'Flex']) {
    const manual = { subscription_status: 'free', access_plan: typed, access_expires_at: iso(Date.now() + 200 * DAY), onboarding_completed: false, credits_balance: 0 };
    const { page, ctx } = await run({ profile: manual, eligible: true, session: { step: 'business', answers: {}, assistant: null, missing: ['business.name'] } });
    const shown = await appShown(page); await sleep(1500); const f = await fr(page);
    const inApp = await page.evaluate(() => ({ status: typeof _dbSubscriptionStatus !== 'undefined' ? _dbSubscriptionStatus : null, access: window.orvAccess ? window.orvAccess() : null, plansOpen: !!document.querySelector('#modal-paywall.open') }));
    check('6m. plan assigned in Supabase (access_plan "' + typed + '", end date ahead, no Stripe purchase) → straight into the app as a paying account: no onboarding, no payment, no plan offer',
      shown && !f.onx && inApp.status === 'paid' && inApp.access && inApp.access.active && !inApp.plansOpen && !CALLS.some((c) => c.p === '/api/create-checkout-session'), { shown, f, inApp });
    await ctx.close();
  }
  {
    const manualOld = { subscription_status: 'free', access_plan: 'annual', access_expires_at: iso(Date.now() - DAY), onboarding_completed: true, credits_balance: 0 };
    const { page, ctx } = await run({ profile: manualOld, session: null });
    const on = await onxAt(page, 'paywall'); const f = await fr(page);
    check('6n. an assigned Annual whose end date has passed → the plan selection, never the app', on && f.flash === 0, f);
    await ctx.close();
  }
  // 7. Back from Stripe, not paid (canceled / not confirmed) → the plans again
  {
    const { page, ctx } = await run({ profile: PROFILES.newUser, eligible: true, session: { step: 'paywall', answers: {}, assistant: 'vector', missing: [] } }, '/app?canceled=true');
    const on = await onxAt(page, 'paywall'); await sleep(500); const f = await fr(page);
    const banner = await page.evaluate(() => /Confirming your payment|Checking for a recent payment/.test((document.getElementById('onx') || {}).textContent || ''));
    check('7. canceled checkout → back at the plans, no dashboard, no green banner', on && f.flash === 0 && !banner, f);
    await ctx.close();
  }
  // 8. Server unreachable for the routing call: a paid customer still gets the app (no hang)
  {
    const { page, ctx } = await run({ profile: PROFILES.paid, stateFails: true });
    const shown = await appShown(page, 15000);
    check('8. routing call fails (server error): a paid customer still opens the app (local time-based check), no hang', shown);
    await ctx.close();
  }
  // 9. Access ends while the tab is open → the plans appear by themselves
  {
    const soon = Object.assign({}, PROFILES.paid, { access_expires_at: iso(Date.now() + 4000) });
    const { page, ctx } = await run({ profile: soon });
    const shown = await appShown(page);
    const on = await onxAt(page, 'paywall', 12000);
    check('9. paid access ends while the app is open → the plan selection opens at that moment', shown && on, { shown, on });
    await ctx.close();
  }
  // 10. The server refuses a request (403 ONBOARDING_REQUIRED) → the plans
  {
    const { page, ctx } = await run({ profile: PROFILES.paid });
    await appShown(page);
    SC.profile.access_expires_at = iso(Date.now() - 1000); // e.g. a refund revoked the access
    const r = await page.evaluate(async () => { const x = await apiFetch('/api/campaigns'); return { status: x.status, code: x.data && x.data.code }; });
    const on = await onxAt(page, 'paywall', 8000);
    check('10. a request refused by the server (403 ONBOARDING_REQUIRED, access ended) → the plan selection opens', r.status === 403 && r.code === 'ONBOARDING_REQUIRED' && on, r);
    await ctx.close();
  }
  // 11. A browser can't route itself into the app
  {
    const { page, ctx } = await run({ profile: PROFILES.expired, session: null });
    await onxAt(page, 'paywall');
    await page.evaluate(() => { try { window.orvOnboardingFlow.close(); } catch (_) {} try { showApp(); } catch (_) {} });
    const r = await page.evaluate(async () => { const x = await apiFetch('/api/campaigns'); return { status: x.status, code: x.data && x.data.code }; });
    const back = await onxAt(page, 'paywall', 8000);
    check('11. closing the plans and showing the app with a script: the server still refuses (403) and the plans come back', r.status === 403 && back, r);
    await ctx.close();
  }

  console.log('\n(page errors seen: ' + errors.length + (errors.length ? ' — e.g. ' + errors.slice(0, 2).join(' | ').slice(0, 300) : '') + ')');
  await browser.close(); server.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
