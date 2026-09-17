/* ════════════════════════════════════════════════════════════════
   Final Pricing Presentation Cleanup — deterministic test suite.

   SAFE TESTING ONLY: no real Supabase users, no Stripe, no credits
   consumed. Same established fake mock-user + network-abort technique as
   the prior two pricing/onboarding passes.
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SHOT_DIR = 'C:/files/tests/_shots/pricing_cleanup_final';
require('fs').mkdirSync(SHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS — ' + name); }
  else { fail++; console.log('FAIL — ' + name + (detail ? ' | ' + detail : '')); }
}

async function loadAndEnterApp(page) {
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));
  await page.route('**/*supabase.co/**', (route) => route.abort());
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.querySelector('.app') && (document.querySelector('.app').style.display = '');
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'mock-pricing-final', email: 'mock@example.invalid' });
  });
  return consoleErrors;
}

function mockCreditStatus(plan, balance, monthlyAllowance) {
  return {
    balance, monthlyAllowance, usedThisMonth: Math.max(0, monthlyAllowance - balance),
    plan, resetDate: new Date(Date.now() + 20 * 86400000).toISOString(), lifetimeUsed: 500,
    campaignsGenerated: 3, savedAssets: 7,
    featureCosts: { ai_chat: 5, ai_analysis: 25, campaign_improvement: 10, competitor_analysis: 15, brand_voice: 20, campaign_generation: 25, website_analysis: 30, image_generation: 75, video_generation: 200, autopilot: 25 },
    autopilotUsage: { used: 0, limit: plan === 'professional' ? null : 0 },
  };
}

async function openSettingsAsPlan(page, plan) {
  await page.evaluate((p) => {
    window._dbSubscriptionStatus = p;
    if (typeof S !== 'undefined' && S) S.currentPlan = p;
    window._getCreditStatus = async function () { return window.__mockCreditStatus; };
  }, plan);
  await page.evaluate((mock) => { window.__mockCreditStatus = mock; }, mockCreditStatus(plan, plan === 'free' ? 7 : 1200, plan === 'free' ? 10 : 1000));
  await page.evaluate(() => { if (typeof openSettingsModal === 'function') openSettingsModal(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { var btn = document.querySelector('.smd-ni[data-smd="subscription"]'); if (btn) btn.click(); });
  await page.waitForTimeout(600);
}

async function gotoPricingView(page) {
  await page.route('**/*supabase.co/**', (route) => route.abort());
  await page.goto(BASE_URL + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    var cur = document.getElementById('view-' + (window._pubView || 'landing'));
    if (cur) cur.classList.add('pub-view');
    var next = document.getElementById('view-pricing');
    if (next) next.classList.remove('pub-view');
    window._pubView = 'pricing';
    // Same known, pre-existing (documented in the prior pricing pass)
    // on-load-reliability issue with this test harness's static server --
    // manually re-invoke the real render function to verify actual
    // content, exactly as the immediately-prior pass established.
    if (typeof renderLPPricingCards === 'function') renderLPPricingCards(document.getElementById('lpPricingGrid'));
    document.querySelectorAll('.ov-pc-price-num[data-count-target]').forEach(function (el) {
      var prefix = el.getAttribute('data-count-prefix') || '';
      var val = parseFloat(el.getAttribute('data-count-target'));
      el.textContent = prefix + val.toFixed(2);
    });
  });
  await page.waitForTimeout(300);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });

  // ── Landing pricing: cadence, credits-near-price, no redundant footer, Chat row, cost sub-labels ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = await loadAndEnterApp(page);
    await gotoPricingView(page);
    await page.screenshot({ path: SHOT_DIR + '/01_landing_1440.png' });

    const periods = await page.locator('#lpPricingGrid .ov-pc-price-block > .ov-pc-price > span:last-child').evaluateAll((els) => els.map((e) => e.textContent));
    check('1. All 4 price suffixes read "/mo" (Free included, not "/day")', periods.every((p) => p === '/mo'), JSON.stringify(periods));

    const creditLines = await page.locator('#lpPricingGrid .ov-pc-credits').evaluateAll((els) => els.map((e) => e.textContent));
    check('2. Free credit line still says "10 credits / day" (allowance unchanged)', creditLines[0] === '10 credits / day', creditLines[0]);
    check('3. Starter/Creator/Professional credit lines use "/ month"', creditLines.slice(1).every((c) => /\/ month$/.test(c)), JSON.stringify(creditLines));
    check('4. Credit allowance shown exactly once per card (no bottom "Includes X credits" duplicate)', await page.locator('#lpPricingGrid .ov-pc-credits-block').count() === 0);
    check('4b. No leftover "Includes" text anywhere in the pricing grid', !/Includes\s+[\d.,]+\s+credits/i.test(await page.locator('#lpPricingGrid').textContent()));

    const gridText = await page.locator('#lpPricingGrid').textContent();
    check('5. No generic "Intelligence" plan-marketing copy anywhere in the pricing grid', !/\bIntelligence\b/i.test(gridText), 'found Intelligence in: ' + (gridText.match(/.{20}Intelligence.{20}/i) || [''])[0]);
    check('5b. No "1 Intelligence use" anywhere in the pricing grid', !/intelligence use/i.test(gridText));

    const rowLabels = await page.locator('.ov-pc:not(.ov-pc-pro) .ov-pc-list li').first().locator('xpath=../..').count(); // sanity no-op
    const starterLabels = await page.locator('#lpPricingGrid .ov-pc').nth(1).locator('.ov-pc-list li').evaluateAll((els) => els.map((e) => e.childNodes[0].textContent.trim()));
    check('6. ORIVEN Chat row present in the feature comparison', starterLabels.includes('ORIVEN Chat'), JSON.stringify(starterLabels));
    check('7. Row labels use real product names Launch/Campaigns (not "Campaign management"/"insights")', starterLabels.includes('Launch') && starterLabels.includes('Campaigns'), JSON.stringify(starterLabels));
    check('7b. Row labels use "Create Image Ads"/"Create Video Ads"', starterLabels.includes('Create Image Ads') && starterLabels.includes('Create Video Ads'), JSON.stringify(starterLabels));

    // Cost sub-labels, read dynamically per card (never hand-typed in the test beyond the expected canonical numbers)
    const costTexts = await page.locator('#lpPricingGrid .ov-pc').nth(1).locator('.ov-pc-feat-cost').evaluateAll((els) => els.map((e) => e.textContent));
    check('8. Image Ad cost sub-label reads "100 credits / ad"', costTexts.includes('100 credits / ad'), JSON.stringify(costTexts));
    check('9. Video Ad cost sub-label reads "225 credits / ad"', costTexts.includes('225 credits / ad'), JSON.stringify(costTexts));
    check('10. ORIVEN Chat cost sub-label reads "5 credits / message"', costTexts.includes('5 credits / message'), JSON.stringify(costTexts));
    check('11. Research cost sub-label reads "25 credits / investigation"', costTexts.includes('25 credits / investigation'), JSON.stringify(costTexts));
    check('12. Autopilot cost sub-label reads "25 credits / execution"', costTexts.includes('25 credits / execution'), JSON.stringify(costTexts));

    // Free card: exclusions
    const freeExcluded = await page.locator('#lpPricingGrid .ov-pc').nth(0).locator('.ov-pc-feat-excluded').evaluateAll((els) => els.map((e) => e.textContent.trim()));
    check('13. Free excludes Create Ads', freeExcluded.some((t) => /create ads/i.test(t)), JSON.stringify(freeExcluded));
    check('14. Free excludes Research', freeExcluded.some((t) => /research/i.test(t)), JSON.stringify(freeExcluded));
    check('15. Free excludes Autopilot', freeExcluded.some((t) => /autopilot/i.test(t)), JSON.stringify(freeExcluded));
    check('16. Free excludes ORIVEN Chat', freeExcluded.some((t) => /oriven chat/i.test(t)), JSON.stringify(freeExcluded));
    const freeIncluded = await page.locator('#lpPricingGrid .ov-pc').nth(0).locator('.ov-pc-list li:not(.ov-pc-feat-excluded)').evaluateAll((els) => els.map((e) => e.textContent.trim()));
    check('17. Free includes Launch/Campaigns/Business (truthful, ungated routes)', ['Launch', 'Campaigns', 'Business'].every((f) => freeIncluded.includes(f)), JSON.stringify(freeIncluded));

    check('18. No horizontal overflow at 1440', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
    check('19. Console errors clean (1440)', consoleErrors.filter((e) => !/401|404|ERR_FAILED|ERR_ABORTED/i.test(e)).length === 0, JSON.stringify(consoleErrors));
    await page.close();
  }

  // ── Responsive: 1280 / 390 ──
  for (const vp of [{ w: 1280, h: 900, tag: '1280' }, { w: 390, h: 844, tag: '390' }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    await loadAndEnterApp(page);
    await gotoPricingView(page);
    await page.screenshot({ path: SHOT_DIR + '/landing_' + vp.tag + '.png', fullPage: vp.w === 390 });
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
    check(vp.tag + '. No horizontal overflow', noOverflow);
    // Cost sub-labels must not visually collide/overlap the checkmark column — spot check via bounding boxes on the Starter card at this width
    const overlapCheck = await page.evaluate(() => {
      var card = document.querySelectorAll('#lpPricingGrid .ov-pc')[1];
      if (!card) return 'no card';
      var li = Array.from(card.querySelectorAll('.ov-pc-list li')).find(function (l) { return l.querySelector('.ov-pc-feat-cost'); });
      if (!li) return 'no costed row found';
      var costEl = li.querySelector('.ov-pc-feat-cost');
      var liRect = li.getBoundingClientRect();
      var costRect = costEl.getBoundingClientRect();
      return { liBottom: liRect.bottom, costBottom: costRect.bottom, withinParent: costRect.bottom <= liRect.bottom + 2 };
    });
    check(vp.tag + '. Cost sub-label stays within its row (no overlap/collision)', overlapCheck !== 'no card' && overlapCheck !== 'no costed row found' && overlapCheck.withinParent, JSON.stringify(overlapCheck));
    await page.close();
  }

  // ── Settings -> Subscription per plan ──
  const shotNames = { free: '02_settings_free.png', starter: '03_settings_starter.png', creator: '04_settings_creator.png', professional: '05_settings_professional.png' };
  for (const plan of ['free', 'starter', 'creator', 'professional']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = await loadAndEnterApp(page);
    await openSettingsAsPlan(page, plan);
    await page.screenshot({ path: SHOT_DIR + '/' + shotNames[plan] });

    const priceEl = await page.locator('.sub-pcard-active .sub-pcard-per').textContent().catch(() => null);
    check('S.' + plan + '.1 Settings price suffix reads "/mo" (incl. Free)', priceEl === '/mo', priceEl);

    const featTexts = await page.locator('.sub-pcard-active .sub-pcard-feats li').evaluateAll((els) => els.map((e) => e.textContent));
    check('S.' + plan + '.2 No "Intelligence: N/month" row in Settings', !featTexts.some((t) => /^Intelligence:/.test(t)), JSON.stringify(featTexts));
    check('S.' + plan + '.3 Explicit "ORIVEN Chat: Included/Not included" row present', featTexts.some((t) => /^ORIVEN Chat:/.test(t)), JSON.stringify(featTexts));
    const chatRow = featTexts.find((t) => /^ORIVEN Chat:/.test(t));
    const expectChatIncluded = plan !== 'free';
    check('S.' + plan + '.4 ORIVEN Chat entitlement correct (' + (expectChatIncluded ? 'Included' : 'Not included') + ')', chatRow === ('ORIVEN Chat: ' + (expectChatIncluded ? 'Included' : 'Not included')), chatRow);

    console.log('  console errors (' + plan + '):', JSON.stringify(consoleErrors.filter((e) => !/401|404|ERR_FAILED|ERR_ABORTED/i.test(e))));
    await page.close();
  }

  // ── Onboarding/paywall consistency (reuses the real, unmodified paywall) ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loadAndEnterApp(page);
    await page.evaluate(() => { window._dbSubscriptionStatus = 'free'; window._getCreditStatus = async () => window.__mockCreditStatus; });
    await page.evaluate((mock) => { window.__mockCreditStatus = mock; }, mockCreditStatus('free', 7, 10));
    await page.evaluate(() => { if (typeof openPaywall === 'function') openPaywall(); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: SHOT_DIR + '/06_paywall.png' });
    const pwPeriods = await page.locator('#pwPlanGrid .pw-period').evaluateAll((els) => els.map((e) => e.textContent));
    check('P1. Paywall price suffixes all "/mo"', pwPeriods.every((p) => p === '/mo'), JSON.stringify(pwPeriods));
    const pwCredits = await page.locator('#pwPlanGrid .pw-credits-inline').evaluateAll((els) => els.map((e) => e.textContent));
    check('P2. Paywall Free credits line still "10 credits / day"', pwCredits[0] === '10 credits / day', pwCredits[0]);
    const pwFreeExcluded = await page.locator('#pwPlanGrid .pw-card-free .pw-feat-excluded').evaluateAll((els) => els.map((e) => e.textContent));
    check('P3. Paywall Free card excludes ORIVEN Chat', pwFreeExcluded.some((t) => /oriven chat/i.test(t)), JSON.stringify(pwFreeExcluded));
    const pwGridText = await page.locator('#pwPlanGrid').textContent();
    check('P4. No "Intelligence" marketing copy in the paywall', !/\bIntelligence\b/i.test(pwGridText));
    await page.close();
  }

  // ── Light / dark mode ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loadAndEnterApp(page);
    await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('light'); });
    await openSettingsAsPlan(page, 'creator');
    await page.screenshot({ path: SHOT_DIR + '/07_light_mode.png' });
    await page.close();
  }
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loadAndEnterApp(page);
    await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('dark'); });
    await openSettingsAsPlan(page, 'creator');
    await page.screenshot({ path: SHOT_DIR + '/08_dark_mode.png' });
    await page.close();
  }

  console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
  await browser.close();
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
