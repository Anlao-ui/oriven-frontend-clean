/* ════════════════════════════════════════════════════════════════
   Subscription plans — the public pricing, Settings → Subscription and the
   paywall show the SAME plan benefits (one source: js/plans.js), in all six
   app languages, and the app's gates follow the plan:
     Free     Limited advertising workflow
     Starter  Full advertising workflow
     Creator  + Oriven Chat + In-app notifications
     Pro      + Priority Support + Weekly AI Performance Report
   SAFE: fenced browser (tests/_fence.js, backend answers 401), the same
   fake signed-in technique as the other pricing suites; no real account,
   no network mutation. Needs the static server on :8899.
   RUN: node tests/subscription-plans.test.js
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const BASE_URL = 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS — ' + name); }
  else { fail++; console.log('FAIL — ' + name + (detail ? ' | ' + detail : '')); }
}
const EXPECT = {
  free:         ['✓Limited advertising workflow', '✕Oriven Chat', '✕In-app notifications', '✕Priority Support', '✕Weekly AI Performance Report'],
  starter:      ['✓Full advertising workflow', '✕Oriven Chat', '✕In-app notifications', '✕Priority Support', '✕Weekly AI Performance Report'],
  creator:      ['✓Full advertising workflow', '✓Oriven Chat', '✓In-app notifications', '✕Priority Support', '✕Weekly AI Performance Report'],
  professional: ['✓Full advertising workflow', '✓Oriven Chat', '✓In-app notifications', '✓Priority Support', '✓Weekly AI Performance Report'],
};
const PRICES = { free: '€0.00', starter: '€9.95', creator: '€19.95', professional: '€34.95' };
const CREDITS = { free: '10 credits / day', starter: '1.000 credits / month', creator: '2.500 credits / month', professional: '4.000 credits / month' };
const IDS = ['free', 'starter', 'creator', 'professional'];

function rowsOf({ sel, liSel, offCls, noteSel }) {
  return Array.from(document.querySelectorAll(sel)).map((card) => Array.from(card.querySelectorAll(liSel)).map((li) => {
    const c = li.cloneNode(true); c.querySelectorAll(noteSel + ', .ov-sr').forEach((x) => x.remove());
    return (li.classList.contains(offCls) ? '✕' : '✓') + c.textContent.trim();
  }));
}

async function enterApp(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.querySelector('.app') && (document.querySelector('.app').style.display = '');
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'mock-plans-test', email: 'mock@example.invalid' });
  });
  return errors;
}
async function asPlan(page, plan) {
  await page.evaluate((p) => {
    window._dbSubscriptionStatus = p; window._isGuestMode = false;
    if (typeof S !== 'undefined' && S) S.currentPlan = p;
    window._getCreditStatus = async function () { return { balance: 500, monthlyAllowance: p === 'free' ? 10 : 1000, usedThisMonth: 0, plan: p, resetDate: new Date(Date.now() + 864e6).toISOString(), featureCosts: { automation: 50 } }; };
  }, plan);
}
async function openSubscription(page) {
  await page.evaluate(() => { if (typeof openSettingsModal === 'function') openSettingsModal(); });
  await page.waitForTimeout(250);
  await page.evaluate(() => { var b = document.querySelector('.smd-ni[data-smd="subscription"]'); if (b) b.click(); });
  // renderPlanPanel is async: await one complete render of the current state
  // instead of guessing with a fixed delay.
  await page.evaluate(() => renderPlanPanel());
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  require('./_fence').fenceBrowser(browser, BASE_URL, { backend401: true });

  // ── A. Public pricing (/pricing, generated page) ──
  console.log('── A. Public pricing ──');
  let page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE_URL + '/pricing.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const pub = await page.evaluate(rowsOf, { sel: '#lpPricingGrid .ov-pc', liSel: '.ov-pc-list li', offCls: 'ov-pc-feat-excluded', noteSel: '.ov-pc-feat-cost' });
  IDS.forEach((id, i) => check('A.' + id + ' card rows', JSON.stringify(pub[i]) === JSON.stringify(EXPECT[id]), JSON.stringify(pub[i])));
  const prices = await page.$$eval('#lpPricingGrid .ov-pc-price-num', (e) => e.map((x) => x.textContent.trim()));
  check('A. prices unchanged (€0 / €9.95 / €19.95 / €34.95)', JSON.stringify(prices) === JSON.stringify(IDS.map((i) => PRICES[i])), JSON.stringify(prices));
  const credits = await page.$$eval('#lpPricingGrid .ov-pc-credits', (e) => e.map((x) => x.textContent.trim()));
  check('A. credits unchanged (10/day, 1.000, 2.500, 4.000 a month)', JSON.stringify(credits) === JSON.stringify(IDS.map((i) => CREDITS[i])), JSON.stringify(credits));
  const tableRows = await page.$$eval('#view-pricing .ov-price-table:not(.ov-price-costs) tbody th', (e) => e.map((x) => x.textContent.trim()));
  check('A. comparison table: one workflow row + the four benefits, no separate module rows, no AI Analysis', tableRows.includes('Advertising workflow') && ['Oriven Chat', 'In-app notifications', 'Priority Support', 'Weekly AI Performance Report'].every((r) => tableRows.some((t) => t === r || t.startsWith(r + ' ('))) && !tableRows.some((r) => /^(Research|Automations)$|AI Analy/i.test(r)), JSON.stringify(tableRows));
  const soon = await page.locator('#lpPricingGrid .ov-pc').nth(3).locator('.ov-pc-feat-cost').last().textContent();
  check('A. weekly report labelled "Coming soon" while delivery is not live (card + comparison table)', /^Coming soon/.test(soon) && tableRows.includes('Weekly AI Performance Report (coming soon)'), soon);
  const faq = await page.content();
  check('A. no stale "Professional adds notifications" copy', !/adds notifications and/i.test(faq));
  await page.close();

  // ── B. Settings → Subscription shows exactly the same lists ──
  console.log('── B. Settings = public pricing ──');
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = await enterApp(page);
  await asPlan(page, 'professional');
  await openSubscription(page);
  const set = await page.evaluate(rowsOf, { sel: '.sub-plans-grid .sub-pcard', liSel: '.sub-pcard-feats li:not(:first-child)', offCls: 'sub-pcard-feat-off', noteSel: '.sub-pcard-note' });
  check('B. Settings shows all four plans', set.length === 4, set.length);
  IDS.forEach((id, i) => check('B.' + id + ' Settings rows = public card rows', JSON.stringify(set[i]) === JSON.stringify(pub[i]), JSON.stringify(set[i])));
  const setPrices = await page.$$eval('.sub-pcard-price', (e) => e.map((x) => x.textContent.replace('/mo', '').trim()));
  check('B. Settings prices = public prices', JSON.stringify(setPrices) === JSON.stringify(['€0', '€9.95', '€19.95', '€34.95']), JSON.stringify(setPrices));
  check('B. current plan marked; upgrade/downgrade options present', await page.locator('.sub-pcard-active .sub-pcard-name').textContent() === 'Professional' && await page.locator('.sub-pcard-btn').count() === 4);
  check('B. Priority Support panel shown for Professional', await page.locator('#prioritySupportPanel').count() === 1);
  await asPlan(page, 'creator');
  await openSubscription(page);
  check('B. Priority Support panel NOT rendered for Creator', await page.locator('#prioritySupportPanel').count() === 0);

  // ── C. Six languages ──
  console.log('── C. Languages ──');
  const WANT = { nl: 'Volledige advertentieworkflow', de: 'Kompletter Werbe-Workflow', fr: 'Workflow publicitaire complet', es: 'Flujo publicitario completo', pt: 'Fluxo de publicidade completo' };
  for (const l of Object.keys(WANT)) {
    await page.evaluate((lang) => { setLanguage(lang); }, l); // the real path: saved + applied
    await openSubscription(page);
    const txt = await page.locator('.sub-plans-grid').textContent();
    const pw = await page.evaluate(() => { const d = document.createElement('div'); renderPWPricingCards(d, ORIVEN_PLAN_LIST); return d.textContent; });
    check('C.' + l + ' Settings + paywall plan rows translated', txt.includes(WANT[l]) && pw.includes(WANT[l]) && !/Full advertising workflow/.test(txt), txt.slice(0, 200));
  }
  await page.evaluate(() => { setLanguage('en'); });
  check('C. every translated key exists for all five non-English languages', await page.evaluate(() => Object.keys(ORIVEN_PLAN_I18N).every((k) => ['nl', 'de', 'fr', 'es', 'pt'].every((l) => ORIVEN_PLAN_I18N[k][l]))));
  const weeklyKeys = await page.evaluate(() => ['en', 'nl', 'de', 'fr', 'es', 'pt'].every((l) => LANG_STRINGS[l] && LANG_STRINGS[l].smdNotifWeeklyTitle && LANG_STRINGS[l].smdNotifWeeklySub));
  check('C. weekly report setting translated in all six languages', weeklyKeys);

  // ── D. App gates follow the plan ──
  console.log('── D. Gates ──');
  for (const [plan, bell, weekly, chat] of [['free', false, false, false], ['starter', false, false, false], ['creator', true, false, true], ['professional', true, true, true]]) {
    await asPlan(page, plan);
    const r = await page.evaluate(() => ({ notif: orvEntitled('notifications'), weekly: orvEntitled('weeklyReport'), chat: orvEntitled('orivenChat') }));
    check('D.' + plan + ' in-app notifications ' + (bell ? 'on' : 'off') + ', weekly report ' + (weekly ? 'on' : 'off') + ', Oriven Chat ' + (chat ? 'on' : 'off'), r.notif === bell && r.weekly === weekly && r.chat === chat, JSON.stringify(r));
  }
  // Bell: Starter never asks the server; Creator asks the gated feed.
  const reqs = [];
  page.on('request', (q) => { if (/\/api\/(notifications|intelligence\/events)/.test(q.url())) reqs.push(q.url()); });
  await asPlan(page, 'starter');
  await page.evaluate(() => { var p = document.getElementById('orvNotifPanel'); if (p) p.style.display = 'none'; orvToggleNotifications(); });
  await page.waitForTimeout(300);
  check('D. Starter: bell loads nothing', !reqs.some((u) => /\/api\/notifications/.test(u)), JSON.stringify(reqs));
  await asPlan(page, 'creator');
  await page.evaluate(() => { var p = document.getElementById('orvNotifPanel'); if (p) p.style.display = 'none'; orvToggleNotifications(); });
  await page.waitForTimeout(400);
  check('D. Creator: bell reads the gated /api/notifications feed', reqs.some((u) => /\/api\/notifications$/.test(u)) && !reqs.some((u) => /intelligence\/events\?severity=high/.test(u)), JSON.stringify(reqs));
  // Weekly report toggle: visible only on Professional.
  await page.evaluate(() => { if (typeof updatePrioritySupportVisibility === 'function') { invalidatePlanCache && invalidatePlanCache(); } });
  for (const [plan, show] of [['creator', false], ['professional', true]]) {
    await asPlan(page, plan);
    await page.evaluate((p) => { var wr = document.getElementById('smdWeeklyReportRow'); if (wr) wr.style.display = orvPlanHas(p, 'weeklyReport') ? '' : 'none'; _applySettingsToUI(loadSettings()); }, plan);
    const vis = await page.evaluate(() => document.getElementById('smdWeeklyReportRow').style.display !== 'none');
    check('D. weekly report toggle ' + (show ? 'shown' : 'hidden') + ' for ' + plan, vis === show);
  }
  await page.evaluate(() => { var t = document.getElementById('tglWeeklyReport'); toggleNotif(t, 'weeklyReportEmail'); });
  check('D. turning the weekly report off saves weeklyReportEmail=false (synced to the account)', await page.evaluate(() => loadSettings().weeklyReportEmail === false));
  // Legacy assistant page and the chat panel are Creator+.
  await asPlan(page, 'starter');
  await page.evaluate(() => { window.__lr = null; window.openLimitReached = function (k) { window.__lr = k; }; navigate('aichat'); });
  check('D. Starter opening the legacy Assistant page → upgrade prompt (chat)', await page.evaluate(() => window.__lr === 'chat'));
  await page.evaluate(() => { window.__lr = null; orvOpenAi(); });
  check('D. Starter opening Oriven Chat → upgrade prompt', await page.evaluate(() => window.__lr === 'chat'));
  check('D. no JavaScript errors', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await page.close();
  await browser.close();
  console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
