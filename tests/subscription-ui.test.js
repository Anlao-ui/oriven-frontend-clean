/* ════════════════════════════════════════════════════════════════
   Settings → Subscription in the real app.html, against a mock API on
   127.0.0.1 (the app's dev API base http://localhost:5500 is rewritten to
   it); every other host is aborted. No Stripe, no real users, no payment.

   Checks: the plan the account has says "Current" (disabled, never starts a
   purchase) and is the only highlighted card; the others say what they do
   ("Extend with …" / "Choose …") and go through the existing confirm step;
   "Cancel plan" in Your access — for a one-time period plan an honest
   explanation (nothing renews, access until the end date, refund request),
   for a legacy monthly subscription the existing Stripe cancellation, shown
   as scheduled only when the server confirms it; Settings opens above the
   sidebar; no settings that do nothing.
   RUN: node tests/subscription-ui.test.js
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BE = path.resolve(ROOT, '..', 'oriven-backend', 'server');
const express = require(require.resolve('express', { paths: [BE, ROOT] }));
const { chromium } = require('playwright');
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const PORT = 8987, BASE = 'http://127.0.0.1:' + PORT, DEV_API = 'http://localhost:5500';
const SHOTS = path.join(__dirname, '_shots', 'subscription'); fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
function check(name, ok, info) { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 700))); }

const END = '2027-05-26T10:00:00.000Z';
const PERIOD_END = '2026-12-01T10:00:00.000Z';
const SUBS = {
  annual: { subscription_status: 'paid', has_access: true, access_expires_at: END, access_plan: 'annual', billing: 'purchase', purchases: [{ plan_id: 'annual', status: 'paid', amount_total_cents: 29645, access_start: '2026-05-26T10:00:00.000Z', access_end: END, credits_total: 15000 }], grants: [] },
  quarterly: { subscription_status: 'paid', has_access: true, access_expires_at: END, access_plan: 'quarterly', billing: 'purchase', purchases: [], grants: [] },
  none: { subscription_status: 'free', has_access: false, access_expires_at: null, access_plan: null, billing: 'none', purchases: [], grants: [] },
  legacy: { subscription_status: 'creator', has_access: true, access_expires_at: PERIOD_END, access_plan: null, billing: 'stripe', current_period_end: PERIOD_END, purchases: [], grants: [] },
};
const M = { sub: 'annual', schedule: 'ok', calls: [] };
const app = express();
app.use((q, r, n) => { r.set({ 'Access-Control-Allow-Origin': q.headers.origin || '*', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Idempotency-Key', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }); if (q.method === 'OPTIONS') return r.sendStatus(204); n(); });
app.use(express.json());
app.use((q, r, n) => { if (q.path.startsWith('/api/')) M.calls.push({ m: q.method, p: q.path, body: q.body }); n(); });
app.get('/api/onboarding/state', (q, r) => r.json({ eligible: false, reason: 'existing_account', completed: true, stage: 'done', flow: { enabled: false } }));
app.get('/api/credits/status', (q, r) => r.json({ balance: 6420, plan: 'paid', hasAccess: SUBS[M.sub].has_access, accessExpiresAt: SUBS[M.sub].access_expires_at, lifetimeUsed: 1580, featureCosts: require(path.join(BE, 'services', 'pricing')).FEATURE_COSTS }));
app.get('/api/get-subscription', (q, r) => r.json(Object.assign({}, SUBS[M.sub], M.sub === 'legacy' && M.cancelled ? { pending_plan: 'free', pending_plan_date: PERIOD_END } : {})));
app.get('/api/agent', (q, r) => r.json({ agent: { id: 'scout', name: 'Scout', role: 'Research & Insights', color: '#7CF0CC' }, assigned: true, agents: [] }));
app.post('/api/schedule-plan-change', (q, r) => {
  if (M.schedule === 'fail') return r.status(502).json({ error: 'Could not cancel your subscription with the payment provider. Nothing was changed — please try again.', code: 'STRIPE_CANCEL_FAILED' });
  M.cancelled = true; r.json({ ok: true, pending_plan: 'free', pending_plan_date: PERIOD_END });
});
app.post('/api/create-checkout-session', (q, r) => r.status(500).json({ error: 'checkout must not be reached in this test' }));
app.all(/^\/api\//, (q, r) => r.json({}));
app.use(express.static(ROOT));

const blocked = [];
async function fence(page) {
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith(BASE + '/')) return r.continue();
    if (u.startsWith(DEV_API + '/')) return r.continue({ url: BASE + u.slice(DEV_API.length) });
    if (/^(data|blob):/.test(u)) return r.continue();
    if (r.request().method() === 'GET' && /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u)) return r.continue();
    blocked.push(u.split('?')[0]); return r.abort('blockedbyclient');
  });
}
async function openSub(page, which) {
  M.sub = which;
  await page.evaluate((status) => {
    window._dbSubscriptionStatus = status;
    if (typeof closeModal === 'function') closeModal('modal-settings');
    openSettingsModal();
    const nav = Array.from(document.querySelectorAll('.smd-ni')).find((n) => /Subscription/.test(n.innerText));
    if (nav) nav.click();
  }, SUBS[which].subscription_status);
  await page.waitForTimeout(1000);
}
const panel = (page) => page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('#planPanelContent .sub-pcard')).map((c) => {
    const b = c.querySelector('.sub-pcard-btn');
    return { name: c.querySelector('.sub-pcard-name').textContent, cls: c.className, current: c.getAttribute('aria-current') === 'true', badge: (c.querySelector('.sub-pcard-badge') || {}).textContent || '', btn: b ? b.textContent.trim() : '', disabled: b ? b.disabled : null };
  });
  return { cards, access: (document.querySelector('#planPanelContent .sub-access-card') || {}).innerText || '', cancel: !!document.getElementById('planCancelBtn'), text: (document.getElementById('planPanelContent') || {}).innerText || '' };
});

const server = app.listen(PORT, async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage(); await fence(page);
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.orv-cc{display:none!important}'; document.head.appendChild(s); }); });
    await page.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.orvAppNav && typeof openSettingsModal === 'function', null, { timeout: 20000 });
    await page.evaluate(() => {
      window._getAccessToken = async () => 'mock-token'; window._apiToken = 'mock-token';
      if (window.orvTour) window.orvTour.open = function () {};
      window._currentUser = { id: 'user-sub-1', email: 'owner@example.invalid' };
      if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'user-sub-1', email: 'owner@example.invalid' });
      // The purchase path is the existing confirm dialog (selectPlan); recorded here, never reaching checkout.
      window.__picked = []; window.selectPlan = function (id) { window.__picked.push(id); };
      if (window.SB && SB.auth) SB.auth.getSession = async () => ({ data: { session: { access_token: 'mock-token' } } });
    });
    await page.waitForTimeout(800);

    console.log('\nA. Annual plan (a one-time period plan)');
    await openSub(page, 'annual');
    let p = await panel(page);
    const annual = p.cards.find((c) => c.name === 'Annual');
    check('A1 the plan you have says "Current", is disabled and marked as yours', annual && annual.btn === 'Current' && annual.disabled === true && annual.current && /Your plan/i.test(annual.badge), annual);
    check('A2 it is the only highlighted card (the "popular" badge no longer highlights another plan)', p.cards.filter((c) => /sub-pcard-active/.test(c.cls)).map((c) => c.name).join() === 'Annual', p.cards.map((c) => c.name + ':' + c.cls));
    check('A3 no "Add …" wording anywhere; the other plans say "Extend with …" and are enabled', !/\bAdd (Flex|Monthly|Quarterly|Semi-Annual|Annual)\b/.test(p.text) && p.cards.filter((c) => c.name !== 'Annual').every((c) => c.btn === 'Extend with ' + c.name && c.disabled === false), p.cards.map((c) => c.btn));
    check('A4 it says what extending does (time after the end date, current plan not replaced or charged again)', /adds its time after/.test(p.text) && /isn’t replaced or charged again/.test(p.text));
    await page.click('#planPanelContent .sub-pcard-current .sub-pcard-btn', { force: true }).catch(() => {});
    await page.waitForTimeout(200);
    check('A5 clicking "Current" starts nothing (no purchase, no checkout)', (await page.evaluate(() => window.__picked.length)) === 0 && !M.calls.some((c) => /checkout/.test(c.p)));
    await page.click('#planPanelContent .sub-pcard:not(.sub-pcard-current) .sub-pcard-btn >> nth=1');
    await page.waitForTimeout(200);
    check('A6 "Extend with Monthly" goes through the existing confirm step (selectPlan), not straight to checkout', JSON.stringify(await page.evaluate(() => window.__picked)) === '["monthly"]' && !M.calls.some((c) => /checkout/.test(c.p)));
    await page.screenshot({ path: path.join(SHOTS, 'annual.png') });

    check('A7 "Cancel plan" is visible in Your access', p.cancel && /Cancel plan/.test(p.access));
    await page.click('#planCancelBtn'); await page.waitForTimeout(300);
    const dlg = await page.evaluate(() => { const d = document.getElementById('planCancelConfirm'); if (!d) return null; const a = d.querySelector('#planRefundReq'); return { t: d.innerText, href: a ? a.getAttribute('href') : '', focus: document.activeElement && document.activeElement.id, policy: !!d.querySelector('a[href="/refund-policy"]') }; });
    check('A8 the dialog explains it honestly: one-time payment, no subscription to stop, not charged again, access until the end date', dlg && /one-time payment/.test(dlg.t) && /won’t be charged again/.test(dlg.t) && /no subscription to stop/.test(dlg.t) && /May 26, 2027|26 May 2027|26 mei 2027/.test(dlg.t), dlg && dlg.t);
    check('A9 …offers the refund request the refund policy describes (prefilled email) and links the policy; "Keep my plan" has focus', dlg && /^mailto:contact@orivenai\.com\?subject=Refund%20request/.test(dlg.href) && dlg.policy && dlg.focus === 'planCancelKeep', dlg);
    await page.screenshot({ path: path.join(SHOTS, 'annual-cancel.png') });
    check('A10 opening it changed nothing (no cancellation request)', !M.calls.some((c) => c.p === '/api/schedule-plan-change'));
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    check('A11 Escape closes it and returns focus to "Cancel plan"', !(await page.$('#planCancelConfirm')) && (await page.evaluate(() => document.activeElement && document.activeElement.id)) === 'planCancelBtn');

    console.log('\nB. Another period plan');
    await openSub(page, 'quarterly');
    p = await panel(page);
    check('B1 the "Current" logic follows the account’s plan (Quarterly), not a fixed one', p.cards.find((c) => c.name === 'Quarterly').btn === 'Current' && p.cards.find((c) => c.name === 'Annual').btn === 'Extend with Annual' && p.cards.filter((c) => c.btn === 'Current').length === 1, p.cards.map((c) => c.btn));

    console.log('\nC. No active plan');
    await openSub(page, 'none');
    p = await panel(page);
    check('C1 every plan says "Choose …", none is "Current", no "Cancel plan"', p.cards.every((c) => /^Choose /.test(c.btn) && !c.disabled) && !p.cancel, { btns: p.cards.map((c) => c.btn), cancel: p.cancel });

    console.log('\nD. Legacy monthly subscription (Stripe)');
    await openSub(page, 'legacy');
    p = await panel(page);
    check('D1 "Cancel plan" is shown for the running subscription', p.cancel);
    M.schedule = 'fail';
    await page.click('#planCancelBtn'); await page.waitForTimeout(200);
    const legacyText = await page.evaluate(() => document.getElementById('planCancelConfirm').innerText);
    check('D2 the dialog says access continues until the end of the paid period', /remain active until/.test(legacyText) && /not be charged again/.test(legacyText), legacyText);
    await page.click('#planCancelGo'); await page.waitForTimeout(600);
    const err = await page.evaluate(() => { const e = document.getElementById('planCancelErr'); return { shown: e && !e.hidden, t: e ? e.textContent : '' }; });
    check('D3 Stripe not confirming → the error is shown and nothing is marked cancelled', err.shown && /Nothing was changed/.test(err.t) && !M.cancelled, err);
    M.schedule = 'ok';
    await page.click('#planCancelGo'); await page.waitForTimeout(1200);
    p = await panel(page);
    check('D4 confirmed by the server → shown as scheduled with the end date and a "Keep plan" option', M.cancelled && /Cancellation scheduled/.test(p.access) && /Keep plan/.test(p.access) && M.calls.filter((c) => c.p === '/api/schedule-plan-change').every((c) => c.body.plan === 'free'), p.access);
    await page.screenshot({ path: path.join(SHOTS, 'legacy-scheduled.png') });

    console.log('\nE. Settings itself');
    const lay = await page.evaluate(() => {
      const card = document.querySelector('#modal-settings .modal, #modal-settings > div'); const r = card.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + 6, r.top + 40);
      return { inside: !!(hit && hit.closest('#modal-settings')), left: Math.round(r.left), z: getComputedStyle(document.getElementById('modal-settings')).zIndex };
    });
    check('E1 Settings opens above the sidebar (its left edge isn’t covered)', lay.inside && +lay.z > 9200, lay);
    await page.evaluate(() => { const nav = Array.from(document.querySelectorAll('.smd-ni')).find((n) => /General/.test(n.innerText)); if (nav) nav.click(); });
    await page.waitForTimeout(300);
    const gen = await page.evaluate(() => ({ text: document.getElementById('smdp-general').innerText, ws: (() => { const el = document.getElementById('wsNameInp'); return !!(el && el.offsetParent); })() }));
    check('E2 General has no setting that does nothing (no Workspace Name) and no old "ORIVEN" naming', !gen.ws && !/Workspace Name/.test(gen.text) && !/ORIVEN\b/.test(gen.text) && /OrivenAI/.test(gen.text), gen.text.slice(0, 300));
    // The panel is entitlement-gated (body.orv-no-notif from the plan's entitlements,
    // which this mock doesn't load); lifted here — this checks which switches it offers.
    await page.evaluate(() => { document.body.classList.remove('orv-no-notif'); const nav = document.querySelector('.smd-ni[data-smd="notifications"]'); if (nav) smdNav(nav); });
    await page.waitForTimeout(300);
    // Only what is really on screen (innerText of a hidden panel would include hidden rows).
    const nt = await page.evaluate(() => Array.from(document.querySelectorAll('#smdp-notifications .smd-tgl-row')).filter((r) => r.getClientRects().length && getComputedStyle(r).display !== 'none').map((r) => r.innerText).join(' | '));
    check('E3 Notifications shows only switches that do something (no "Credits & Billing", no weekly report that is never sent)', !/Credits & Billing/.test(nt) && !/Weekly AI Performance Report/.test(nt) && /Automation approvals/.test(nt), nt.replace(/s+/g, ' ').slice(0, 600));

    console.log('\nF. Settings are saved to the account, and never touch the assistant');
    const putsBefore = M.calls.filter((c) => c.m === 'PUT' && c.p === '/api/user/preferences').length;
    await page.evaluate(() => { const nav = document.querySelector('.smd-ni[data-smd="general"]'); if (nav) smdNav(nav); });
    await page.waitForTimeout(200);
    const wasOn = await page.evaluate(() => document.getElementById('tglWorkflowSteps').classList.contains('on'));
    await page.click('#tglWorkflowSteps'); await page.waitForTimeout(400);
    const notifTgl = await page.evaluate(() => { document.body.classList.remove('orv-no-notif'); const t = document.getElementById('tglNotifAutopilot'); t.click(); return t.classList.contains('on'); });
    await page.waitForTimeout(400);
    const puts = M.calls.filter((c) => c.m === 'PUT' && c.p === '/api/user/preferences').slice(putsBefore).map((c) => c.body);
    check('F1 each change is saved to the account (PUT /api/user/preferences) with only that setting', puts.some((b) => b.showWorkflowSteps === !wasOn && Object.keys(b).length === 1) && puts.some((b) => b.notifAutopilot === notifTgl && Object.keys(b).length === 1), puts);
    check('F2 no settings save ever carries the assistant', M.calls.filter((c) => c.p === '/api/user/preferences' && c.m !== 'GET').every((c) => !('assistant' in (c.body || {}))));
    const steps = await page.evaluate(() => { const n = document.querySelector('.orv-sb .onv-sec__n'), r = document.querySelector('.orv-sb .onv-route'); return { num: n ? getComputedStyle(n).display : null, route: r ? getComputedStyle(r).display : null }; });
    check('F3 "Show workflow steps" really changes the sidebar (numbers and route line)', wasOn ? steps.num === 'none' && steps.route === 'none' : steps.num !== 'none', steps);
    await page.goto(BASE + '/app.html', { waitUntil: 'domcontentloaded' }); // a refresh (the app's /app route is app.html)
    await page.waitForFunction(() => typeof loadSettings === 'function', null, { timeout: 20000 });
    const kept = await page.evaluate(() => { const c = loadSettings(); return { steps: c.showWorkflowSteps, notif: c.notifAutopilot }; });
    check('F4 …and the choices are still there after a refresh', kept.steps === !wasOn && kept.notif === notifTgl, kept);

    check('no page errors', !errors.length, errors.slice(0, 5));
    check('no checkout or Stripe request was ever made', !M.calls.some((c) => /checkout|stripe/i.test(c.p)) && !blocked.some((u) => /stripe\.com/.test(u)));
  } catch (e) { fail++; console.log('CRASH ' + (e && e.stack || e)); }
  await browser.close(); server.close();
  console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed. Screenshots: ' + SHOTS);
  process.exit(fail ? 1 : 0);
});
