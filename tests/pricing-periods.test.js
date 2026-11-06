/* ════════════════════════════════════════════════════════════════
   Pricing periods — the five plans (Flex … Annual) in every place a
   customer sees them: the public /pricing page, the in-app plan modal, the
   onboarding plan step and Settings → Subscription, plus the checkout
   request and the no-access gate. Every number is compared with
   js/plans.js (itself checked against the backend by
   plan-model-consistency.test.js and the backend's pricing.test.js).

   SAFE: static server on :8899 only; the network fence (tests/_fence.js)
   aborts everything else, and the app's API calls are answered in-page by
   stubs. No real account, no Supabase, no Stripe.
   RUN: node tests/pricing-periods.test.js  (static server on :8899)
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS — ' + name); }
  else { fail++; console.log('FAIL — ' + name + (detail !== undefined ? ' | ' + JSON.stringify(detail).slice(0, 400) : '')); }
}

const sb = { window: {}, document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; } }, console };
sb.window = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'plans.js'), 'utf8') + '\n;this.__P = { ORIVEN_PERIOD_PLANS, CREDIT_COSTS };', sb);
const PLANS = sb.__P.ORIVEN_PERIOD_PLANS, C = sb.__P.CREDIT_COSTS;
const euro = (n) => '€' + (Number.isInteger(n) ? n : n.toFixed(2));
const DAY = 864e5;

async function enterApp(page) {
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    var app = document.querySelector('.app'); if (app) app.style.display = '';
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'mock-periods', email: 'mock@example.invalid' });
  });
  await page.waitForTimeout(300);
}
// Answers the app's API calls in the page (the fence blocks the real ones).
async function stubApi(page, sub, credits) {
  await page.evaluate(({ sub, credits }) => {
    window.__calls = [];
    window.apiFetch = async function (p, opts) {
      window.__calls.push({ path: p, body: opts && opts.body ? JSON.parse(opts.body) : null });
      if (p === '/api/get-subscription') return { ok: true, status: 200, data: sub };
      if (p === '/api/create-checkout-session') return { ok: true, status: 200, data: { url: 'https://checkout.stripe.com/c/pay/cs_test_stub?checkout-stub=1' } };
      return { ok: true, status: 200, data: {} };
    };
    window._getCreditStatus = async function () { return credits; };
    window._dbSubscriptionStatus = sub.has_access ? sub.subscription_status : 'free';
    if (typeof S !== 'undefined' && S) S.currentPlan = window._dbSubscriptionStatus;
  }, { sub, credits });
}
async function openPlanSettings(page) {
  await page.evaluate(() => { if (typeof closeModal === 'function') closeModal('modal-paywall'); if (typeof openSettingsModal === 'function') openSettingsModal(); });
  await page.waitForTimeout(250);
  await page.evaluate(() => { var b = document.querySelector('.smd-ni[data-smd="subscription"]'); if (b) b.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => typeof renderPlanPanel === 'function' && renderPlanPanel());
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    var c = document.getElementById('planPanelContent');
    return {
      text: c ? c.innerText : '',
      cards: Array.from(document.querySelectorAll('#planPanelContent .sub-plans-five .sub-pcard')).map((x) => ({ name: x.querySelector('.sub-pcard-name').textContent, price: x.querySelector('.sub-pcard-price').textContent, btn: x.querySelector('.sub-pcard-btn').textContent.trim(), disabled: x.querySelector('.sub-pcard-btn').disabled })),
    };
  });
}
const creditsMock = (bal, extra) => Object.assign({ balance: bal, monthlyAllowance: 0, usedThisMonth: 0, lifetimeUsed: 300, hasAccess: bal > 0,
  featureCosts: { ai_chat: C.chat, ai_chat_step: C.chatStep, research_report: C.research, campaign_generation: C.campaign, image_generation: C.imageAd, video_generation: C.videoAd, website_analysis: C.business, automation: C.automation } }, extra || {});

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  require('./_fence').fenceBrowser(browser, BASE_URL, { backend401: true });
  const errors = [];

  // ── A. Public /pricing ────────────────────────────────────────────
  console.log('\nA. Public pricing page');
  let page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE_URL + '/pricing.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const pub = await page.evaluate(() => ({
    cards: Array.from(document.querySelectorAll('#lpPricingGrid .ov-pc')).map((c) => ({ id: c.getAttribute('data-plan'), tier: c.querySelector('.ov-pc-tier').textContent, price: c.querySelector('.ov-pc-price').textContent + ' ' + c.querySelector('.ov-pc-duration').textContent, credits: c.querySelector('.ov-pc-credits').textContent, visible: getComputedStyle(c).opacity !== '0', btn: c.querySelector('.ov-pc-btn').textContent })),
    cols: getComputedStyle(document.getElementById('lpPricingGrid')).gridTemplateColumns.split(' ').length,
    pdCols: Array.from(document.querySelectorAll('.ov-price-detail .ov-pd-table thead th')).map((t) => t.textContent),
    detailText: document.querySelector('.ov-price-detail .ov-pd-part').innerText,
    cellsPerRow: Array.from(document.querySelectorAll('.ov-price-detail .ov-pd-table tbody tr')).map((r) => r.children.length),
    head: Array.from(document.querySelectorAll('.ov-price-detail .ov-pd-table tbody tr')).map((r) => ({ name: r.querySelector('th').textContent, access: r.querySelector('[data-label="Access"]').textContent, price: r.querySelector('[data-label="Price"]').textContent, credits: r.querySelector('[data-label="Credits"]').textContent })),
    costs: Array.from(document.querySelectorAll('.ov-price-detail .ov-pd-group dl > div')).map((r) => [r.querySelector('dt').firstChild.textContent, r.querySelector('dd').textContent]),
    text: document.body.innerText,
    ld: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent).join('\n'),
  }));
  check('A1. five cards, Flex … Annual in order', JSON.stringify(pub.cards.map((c) => c.id)) === JSON.stringify(PLANS.map((p) => p.id)), pub.cards.map((c) => c.id));
  check('A2. each card: name, VAT-inclusive price, period and credits from plans.js', PLANS.every((p, i) => pub.cards[i] && pub.cards[i].tier === p.name && pub.cards[i].price.includes(euro(p.price)) && pub.cards[i].price.includes(p.periodLabel) && pub.cards[i].credits.replace(/\./g, '').includes(String(p.credits))), pub.cards);
  check('A3. five columns on a wide screen, every card visible', pub.cols === 5 && pub.cards.every((c) => c.visible), pub.cols);
  check('A4. buttons say "Choose <plan>"', pub.cards.every((c, i) => c.btn === 'Choose ' + PLANS[i].name));
  check('A5b. comparison table has exactly Plan, Access, Price, Credits: no price per month, no credits-arrive column', JSON.stringify(pub.pdCols) === JSON.stringify(['Plan', 'Access', 'Price', 'Credits']) && pub.cellsPerRow.every((n) => n === 4) && !/per month|credits arrive|all at once|a month/i.test(pub.detailText), { cols: pub.pdCols, cells: pub.cellsPerRow });
  check('A5. comparison table: the five plans, one row each, with price, period and credits from plans.js', pub.head.length === 5 && PLANS.every((p, i) => pub.head[i].name === p.name && pub.head[i].price === euro(p.price) && pub.head[i].access === p.periodLabel && pub.head[i].credits.replace(/,/g, '') === String(p.credits)), pub.head);
  const cost = (label) => (pub.costs.find((r) => r[0].startsWith(label)) || [])[1];
  check('A6. cost table from plans.js: draft, image, 5 s and 10 s video, research, chat, automation', cost('Campaign draft') === C.campaign + ' credits' && cost('Image') === C.imageAd + ' credits' && cost('Video, 5') === C.videoAd + ' credits' && cost('Video, 10') === C.videoAd10s + ' credits' && cost('Research report') === C.research + ' credits' && cost('Oriven Chat message') === C.chat + ' credits' && cost('New automation') === C.automation + ' credits', pub.costs);
  check('A7. says VAT included, paid once, no automatic renewal, credits expire with access', /include VAT/i.test(pub.text) && !/21s?%/.test(pub.text) && /nothing renews automatically/i.test(pub.text) && /expire when your access ends/i.test(pub.text));
  check('A8. no free plan, no retired plan names or prices, no "/mo"', !/Free plan|Start free|Starter|Creator plan|Professional plan|€9\.95|€19\.95|€34\.95|\/mo\b|Cancel anytime/.test(pub.text));
  check('A9. structured data offers the five plans (no €0 offer)', /"offerCount": ?5/.test(pub.ld) && PLANS.every((p) => pub.ld.includes('OrivenAI ' + p.name)) && !/"price": ?"0(\.00)?"/.test(pub.ld));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const mob = await page.evaluate(() => ({ cols: getComputedStyle(document.getElementById('lpPricingGrid')).gridTemplateColumns.split(' ').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  check('A10. phone width: one column, no horizontal scroll', mob.cols === 1 && mob.overflow <= 1, mob);
  await page.close();

  // ── B. In the app ─────────────────────────────────────────────────
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await enterApp(page);

  console.log('\nB. Plan modal');
  await stubApi(page, { subscription_status: 'free', has_access: false, access_expires_at: null, billing: 'none', purchases: [], grants: [] }, creditsMock(0));
  await page.evaluate(() => openPaywall());
  await page.waitForTimeout(300);
  const pw = await page.evaluate(() => ({
    cards: Array.from(document.querySelectorAll('#pwPlanGrid .pw-card')).map((c) => ({ id: c.getAttribute('data-plan'), price: c.querySelector('.pw-price').textContent, period: c.querySelector('.pw-period').textContent, credits: c.querySelector('.pw-credits-inline').textContent, btn: c.querySelector('.pw-btn').textContent })),
    text: document.getElementById('modal-paywall').innerText,
    open: document.getElementById('modal-paywall').classList.contains('open'),
  }));
  check('B1. modal open with the five plans, prices and periods from plans.js', pw.open && pw.cards.length === 5 && PLANS.every((p, i) => pw.cards[i].id === p.id && pw.cards[i].price === euro(p.price) && pw.cards[i].period.includes(p.periodLabel) && pw.cards[i].credits.replace(/\./g, '').includes(String(p.credits))), pw.cards);
  check('B2. no Free card, no "Continue Free", no "Cancel anytime"', !/Continue Free|Stay on Free|Cancel anytime|Starter|Creator|Professional/.test(pw.text), pw.text.slice(0, 300));
  check('B3. footer: VAT included, no automatic renewal', /Prices include VAT/.test(pw.text) && /No automatic renewal/.test(pw.text));

  await page.evaluate(() => { closePaywall(); if (typeof openActionPaywall === 'function') openActionPaywall({ action: 'research', code: 'SUBSCRIPTION_REQUIRED' }); });
  await page.waitForTimeout(300);
  const act = await page.evaluate(() => ({ sub: document.querySelector('#modal-paywall .pw-sub').textContent, fits: Array.from(document.querySelectorAll('#pwPlanGrid .pw-fit')).map((f) => f.textContent) }));
  check('B4. blocked Research: "part of every plan", the cost, and how many investigations each plan covers', /part of every OrivenAI plan/.test(act.sub) && act.sub.includes(C.research + ' credits') && act.fits.length === 5 && PLANS.every((p, i) => act.fits[i].includes(Math.floor(p.credits / C.research).toLocaleString('nl-NL'))), act);

  console.log('\nC. Onboarding plan step');
  await page.evaluate(() => { closePaywall(); window.__obChosen = null; window.orvOnboardingPlanChosen = function (p) { window.__obChosen = p; return true; }; openOnboardingPlans('explore'); });
  await page.waitForTimeout(300);
  const ob = await page.evaluate(() => ({ explore: !!document.querySelector('#modal-paywall .pw-explore-btn'), title: document.querySelector('#modal-paywall .pw-title').textContent }));
  check('C1. onboarding offers "Explore first" instead of a free plan', ob.explore && /Choose how long/.test(ob.title), ob);
  await page.evaluate(() => document.querySelector('#modal-paywall .pw-explore-btn').click());
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ chosen: window.__obChosen, open: document.getElementById('modal-paywall').classList.contains('open'), calls: window.__calls.map((c) => c.path) }));
  check('C2. "Explore first" finishes onboarding without a plan, closes the modal, sends no request', after.chosen === 'free' && !after.open && !after.calls.some((p) => /select-free-plan|checkout/.test(p)), after);

  console.log('\nD. Checkout request');
  await page.evaluate(() => { window.__calls = []; selectPlan('quarterly'); });
  await page.waitForTimeout(300);
  const dlg = await page.evaluate(() => { const d = document.getElementById('orvPlanConfirm'); return d ? { name: d.querySelector('.pcf__name').textContent, price: d.querySelector('.pcf__price b').textContent, period: d.querySelector('[data-fact="period"]').textContent, credits: d.querySelector('[data-fact="credits"]').textContent, calls: window.__calls.length } : null; });
  check('D0. before Stripe, the chosen plan is confirmed: Quarterly, €78, 3 months, 4,800 credits with 1,600 a month — no request yet', dlg && dlg.name === 'Quarterly' && /78/.test(dlg.price) && /3 months/.test(dlg.period) && /4[.,]800/.test(dlg.credits) && /1[.,]600 added each month for 3 months/.test(dlg.credits) && dlg.calls === 0, dlg);
  await page.click('#orvPlanConfirm [data-pcf="cancel"].pcf__back'); await page.waitForTimeout(200);
  check('D0b. "Choose a different plan" closes it and sends nothing', !(await page.$('#orvPlanConfirm')) && !(await page.evaluate(() => window.__calls.some((c) => /checkout/.test(c.path)))));
  await page.evaluate(() => { window.__calls = []; selectPlan('quarterly'); });
  await page.waitForTimeout(300);
  // Stripe's own page, answered inside the fenced browser (never reached).
  await page.route('https://checkout.stripe.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stub checkout</title>' }));
  await page.click('#orvPlanConfirm [data-pcf="go"]');
  await page.waitForTimeout(600);
  const ck = await page.evaluate(() => (window.__calls || []).find((c) => c.path === '/api/create-checkout-session')).catch(() => null);
  const landed = page.url();
  check('D1. choosing Quarterly posts {plan: "quarterly"} and follows the returned Checkout URL', (ck && ck.body && ck.body.plan === 'quarterly') || /checkout-stub=1/.test(landed), { ck, landed });

  // Settings: fresh page after the checkout navigation.
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  await enterApp(page);

  console.log('\nE. Settings → Subscription');
  await stubApi(page, { subscription_status: 'free', has_access: false, access_expires_at: null, billing: 'none', purchases: [], grants: [] }, creditsMock(0));
  let st = await openPlanSettings(page);
  check('E1. no access: "No active plan", five plans with "Choose <plan>"', /No active plan/.test(st.text) && st.cards.length === 5 && st.cards.every((c, i) => c.btn === 'Choose ' + PLANS[i].name && !c.disabled), st.cards);
  check('E2. no access: no Priority Support panel, no cancel link', !/Priority Support\n/.test(st.text.split('Included in every plan')[0]) && !/Cancel subscription/.test(st.text));

  const until = new Date(Date.now() + 40 * DAY).toISOString(), next = new Date(Date.now() + 10 * DAY).toISOString();
  await stubApi(page, { subscription_status: 'paid', has_access: true, access_expires_at: until, access_plan: 'quarterly', billing: 'purchase',
    purchases: [{ id: 'p1', plan_id: 'quarterly', status: 'paid', price_incl_vat_cents: 7800, amount_total_cents: 7800, credits_total: 4800, access_start: new Date(Date.now() - 50 * DAY).toISOString(), access_end: until, created_at: new Date().toISOString() }],
    grants: [{ purchase_id: 'p1', instalment: 2, credits: 1600, grant_at: next, status: 'scheduled' }] }, creditsMock(2100, { nextGrant: { credits: 1600, at: next } }));
  await page.evaluate((u) => { window.orvAccess = function () { return { active: true, status: 'paid', expiresAt: u, plan: 'quarterly' }; }; }, until);
  st = await openPlanSettings(page);
  check('E3. period plan: name, "Active until", no automatic renewal', /Quarterly/.test(st.text) && /Active until/.test(st.text) && /doesn’t renew automatically/.test(st.text), st.text.slice(0, 400));
  check('E4. credits: balance, expiry and the next instalment', /2\.100 credits/.test(st.text) && /next 1\.600 on/.test(st.text), st.text.match(/Available now[\s\S]{0,160}/));
  check('E5. buying more: "Add <plan>" on all five', st.cards.length === 5 && st.cards.every((c, i) => c.btn === 'Add ' + PLANS[i].name));
  check('E6. purchase history row and Priority Support shown', /Purchases/i.test(st.text) && /Quarterly · €78/.test(st.text) && /Priority Support/i.test(st.text), st.text.match(/Purchases[sS]{0,160}/i));
  check('E7. cost list uses the live server costs (Research, chat)', st.text.includes('Research\n' + C.research + ' credits') && st.text.includes('Oriven Chat message\n' + C.chat + ' credits'), st.text.match(/What credits are used for[\s\S]{0,400}/));

  await stubApi(page, { subscription_status: 'creator', has_access: true, access_expires_at: until, access_plan: 'creator', billing: 'stripe', current_period_end: until, purchases: [], grants: [], pending_plan: null }, creditsMock(1800));
  st = await openPlanSettings(page);
  check('E8. legacy monthly subscription: named, renews, can be cancelled; new plans wait until it ends', /Creator/.test(st.text) && /monthly subscription/.test(st.text) && /Renews/.test(st.text) && /Cancel subscription/.test(st.text) && st.cards.every((c) => c.disabled), st.cards.map((c) => c.btn));

  console.log('\nF. Access rule and gates');
  const eff = await page.evaluate(() => [
    orvEffectiveStatus({ subscription_status: 'paid', access_expires_at: new Date(Date.now() + 864e5).toISOString() }),
    orvEffectiveStatus({ subscription_status: 'paid', access_expires_at: new Date(Date.now() - 1000).toISOString() }),
    orvEffectiveStatus({ subscription_status: 'free', access_expires_at: new Date(Date.now() + 864e5).toISOString() }),
  ]);
  check('F1. access is time-based in the browser (paid future = paid; paid past = free; free = free)', JSON.stringify(eff) === '["paid","free","free"]', eff);
  await page.evaluate(() => { closeModal && closeModal('modal-settings'); _dbSubscriptionStatus = 'free'; ORIVEN_DEV = false; /* localhost runs in dev mode, which bypasses the gate */ if (typeof invalidatePlanCache === 'function') invalidatePlanCache(); });
  const gate = await page.evaluate(async () => { var ok = await gateUsage(55); return { ok, open: document.getElementById('modal-paywall').classList.contains('open') }; });
  check('F2. no access: a generation is stopped before any request and the plans open', gate.ok === false && gate.open, gate);

  check('Z. no page errors', errors.length === 0, errors);
  await browser.close();
  console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
