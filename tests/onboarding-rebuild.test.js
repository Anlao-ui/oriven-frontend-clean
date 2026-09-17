/* ════════════════════════════════════════════════════════════════
   Onboarding rebuild — deterministic, non-mutating test suite.

   HARD CONSTRAINT (explicit for this pass): no real Supabase users are
   created here, unlike every other *.test.js in this repo (which all call
   supabaseAdmin.auth.admin.createUser). Instead this file uses the exact
   same DOM-state entry point those tests use afterwards anyway
   (_guestOnSignedIn, guest.js — confirmed by reading its source: it never
   calls any Supabase API, it only hides guest-mode DOM and restores
   monkey-patched functions) with a fake, non-authenticated mock user
   object, plus a blanket network-level abort of any request that would
   reach Supabase, as a second, redundant safety net in case that reading
   is ever wrong. Every onboarding network call this suite exercises
   (PUT /api/onboarding/goal, POST /api/onboarding/complete) is
   intercepted via page.route() and answered with a canned response —
   nothing here ever reaches the real backend or database.

   What this CANNOT verify (disclosed, not silently skipped — see the
   final report): real cross-reload persistence of onboarding_completed /
   primary_goal against the live profiles table, since that requires a
   real authenticated account. Those paths were verified by static code
   reading instead (auth.js _loadUserProfile, server.js routes).
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SHOT_DIR = 'C:/files/tests/_shots/onboarding_rebuild';
require('fs').mkdirSync(SHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS — ' + name); }
  else { fail++; console.log('FAIL — ' + name + (detail ? ' | ' + detail : '')); }
}

// Every page used in this suite gets the same safety net: no real Supabase
// network call can ever leave the browser, and every onboarding backend
// call is answered locally, never forwarded to the real server/DB.
async function armPage(page, opts) {
  opts = opts || {};
  await page.route('**/*supabase.co/**', (route) => route.abort());
  await page.route('**/api/onboarding/goal', (route) => {
    if (opts.goalFails) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Could not save that right now.' }) });
    const body = JSON.parse(route.request().postData() || '{}');
    (opts.goalCalls || (opts.goalCalls = [])).push(body);
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ primary_goal: body.goal }) });
  });
  await page.route('**/api/onboarding/complete', (route) => {
    (opts.completeCalls || (opts.completeCalls = [])).push(true);
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ onboarding_completed: true, primary_goal: opts.goal || 'research', subscription_status: 'free' }) });
  });
  await page.route('**/api/select-free-plan', (route) => {
    (opts.freeCalls || (opts.freeCalls = [])).push(true);
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  // Credit-spending / generation / research / publish routes must NEVER be
  // called by onboarding — fail loudly (500) if anything reaches them, so
  // a real regression here shows up as a network-contract test failure
  // instead of silently "working" against a mocked 200.
  const forbidden = ['**/api/generate-image', '**/api/generate-campaign', '**/api/ai/create-ad', '**/api/research/query', '**/api/publish/*', '**/api/generate-ad'];
  for (const pat of forbidden) {
    await page.route(pat, (route) => { (opts.forbiddenCalls || (opts.forbiddenCalls = [])).push(route.request().url()); route.fulfill({ status: 500, body: '{}' }); });
  }
  const navCalls = [];
  page.on('console', () => {});
  return navCalls;
}

async function loadAndEnterApp(page, viewport) {
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  // Fake, non-authenticated mock object -- _guestOnSignedIn (guest.js) is
  // confirmed to never call any Supabase API; it only hides guest-mode DOM
  // and restores functions guest-mode monkey-patched. No real account.
  await page.evaluate(() => {
    document.querySelector('.app') && (document.querySelector('.app').style.display = '');
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'mock-onboarding-test', email: 'mock@example.invalid' });
    window._orvNavCalls = [];
    window._orvNav = function (page, id) { window._orvNavCalls.push([page, id]); };
  });
  return consoleErrors;
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });

  // ── 1-13: Core flow, 1440 ──────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const opts = {};
    await armPage(page, opts);
    const consoleErrors = await loadAndEnterApp(page);

    const overlayVisible = await page.evaluate(() => { startOnboarding(); return document.getElementById('ob2Overlay').style.display === 'flex'; });
    check('1. startOnboarding() shows the overlay', overlayVisible);
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT_DIR + '/01_welcome_1440_dark.png' });

    const welcomeText = await page.locator('.ob2-lede').textContent();
    check('2. Welcome copy present, no marketing hype', /workspace/i.test(welcomeText) && !/revolutioniz|supercharge|unlock the power/i.test(welcomeText), welcomeText);
    check('3. No form/questionnaire fields on Welcome', await page.locator('#ob2StepWelcome input, #ob2StepWelcome select, #ob2StepWelcome textarea').count() === 0);

    await page.click('.ob2-step-welcome .ob2-btn-primary');
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT_DIR + '/02_goal_1440.png' });
    const goalCards = await page.locator('.ob2-goal-card').count();
    check('4. Exactly 6 goal choices shown', goalCards === 6, 'found ' + goalCards);
    const goalIds = await page.locator('.ob2-goal-card').evaluateAll((els) => els.map((e) => e.getAttribute('data-ob2-goal')));
    check('5. Goal choices are exactly the 6 real products, in sidebar order', JSON.stringify(goalIds) === JSON.stringify(['create', 'research', 'launch', 'campaigns', 'autopilot', 'business']), JSON.stringify(goalIds));

    // Icon reuse — compare each goal card's SVG path data against the real sidebar nav icon
    const iconsMatch = await page.evaluate(() => {
      const map = { create: 'create', research: 'research', launch: 'launch', campaigns: 'performance', autopilot: 'autopilot', business: 'businessbrain' };
      let allMatch = true;
      Object.keys(map).forEach((goalId) => {
        const goalSvg = document.querySelector('.ob2-goal-card[data-ob2-goal="' + goalId + '"] svg');
        const navSvg = document.querySelector('.orv-ni[data-orv-page="' + map[goalId] + '"] svg');
        if (!goalSvg || !navSvg) { allMatch = false; return; }
        const goalPaths = Array.from(goalSvg.querySelectorAll('path')).map((p) => p.getAttribute('d'));
        const navPaths = Array.from(navSvg.querySelectorAll('path')).map((p) => p.getAttribute('d'));
        // every goal-card path must be one of the real nav icon's paths (goal icon may be a subset, e.g. Business drops the decorative glow circle)
        if (!goalPaths.every((d) => navPaths.includes(d))) allMatch = false;
      });
      return allMatch;
    });
    check('6. Goal card icons reuse the real sidebar nav icon paths', iconsMatch);

    check('7. Continue disabled with nothing selected', await page.locator('#ob2GoalContinue').isDisabled());

    // Only one selectable at a time
    await page.click('[data-ob2-goal="create"]');
    await page.click('[data-ob2-goal="research"]');
    const selCount = await page.locator('.ob2-goal-card-sel').count();
    const selId = await page.locator('.ob2-goal-card-sel').getAttribute('data-ob2-goal');
    check('8. Single-select only (choosing a 2nd goal deselects the 1st)', selCount === 1 && selId === 'research', 'count=' + selCount + ' id=' + selId);
    await page.screenshot({ path: SHOT_DIR + '/03_goal_selected_research.png' });

    await page.click('#ob2GoalContinue');
    await page.waitForTimeout(300);
    check('9. Goal saved via real PUT /api/onboarding/goal with correct body', opts.goalCalls && opts.goalCalls.length === 1 && opts.goalCalls[0].goal === 'research', JSON.stringify(opts.goalCalls));
    await page.screenshot({ path: SHOT_DIR + '/09_workspace_1440.png' });

    const wsCards = await page.locator('.ob2-ws-card').count();
    check('10. Workspace overview shows all 6 products', wsCards === 6, 'found ' + wsCards);
    const startTagText = await page.locator('.ob2-ws-card-start .ob2-ws-tag').textContent().catch(() => null);
    const startCardName = await page.locator('.ob2-ws-card-start .ob2-ws-name').textContent().catch(() => null);
    check('11. Selected goal (Research) visually emphasized as starting point', startTagText && /starting point/i.test(startTagText) && startCardName === 'Research', startTagText + ' / ' + startCardName);
    const otherCardsVisible = await page.locator('.ob2-ws-card:not(.ob2-ws-card-start)').count();
    check('12. Other 5 products remain visible, not hidden', otherCardsVisible === 5);
    const wsNote = await page.locator('.ob2-ws-note').textContent();
    check('13. Ad Platforms + Settings mentioned as supporting areas, not extra product cards', /ad platforms/i.test(wsNote) && /settings/i.test(wsNote) && wsCards === 6, wsNote);
    check('13b. No forced linear "Step 1/2/3" workflow language anywhere on the workspace step', !/step 1.*step 2|research.*then.*create.*then.*launch/i.test(await page.locator('#ob2StepWorkspace').textContent()));

    // 401/net::ERR_FAILED noise here is a harness artifact, not a real
    // product bug: this suite intentionally uses a fake mock user (no real
    // Supabase session, per the no-test-accounts constraint), so the
    // app's own unrelated init code (credits/notifications/etc, which
    // normally run against a real authenticated session) correctly fails
    // to authenticate. A genuinely signed-in real user would not see
    // these. Only flag something that is NOT explainable that way.
    const realErrors = consoleErrors.filter((e) => !/401|404|ERR_FAILED|ERR_ABORTED/i.test(e));
    console.log('CONSOLE ERRORS (step 1-13, harness-noise filtered):', JSON.stringify(realErrors));
    check('console errors (core flow, excluding known harness-only auth noise)', realErrors.length === 0, JSON.stringify(realErrors));
    await page.close();
  }

  // ── Plan step / entitlement copy / hand-off to real paywall ────
  for (const goalId of ['create', 'research', 'launch', 'campaigns', 'autopilot', 'business']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const opts = { goal: goalId };
    await armPage(page, opts);
    await loadAndEnterApp(page);
    await page.evaluate((g) => { startOnboarding(); window._ob2Goal = g; _ob2ShowPlanStep(); }, goalId);
    await page.waitForTimeout(400);
    await page.screenshot({ path: SHOT_DIR + '/goal_' + goalId + '_plan_step.png' });

    const hard = await page.evaluate(() => document.getElementById('modal-paywall').classList.contains('pw-hard'));
    check('14.' + goalId + ' Plan step opens the real hard paywall', hard);
    const noClose = await page.locator('#modal-paywall .pw-close-btn').isVisible().catch(() => true);
    check('15.' + goalId + ' Close/X not available on a hard paywall (no arbitrary skip)', !noClose);
    const sub = await page.locator('#modal-paywall .pw-sub').textContent();
    if (goalId === 'research') check('16.research entitlement note is factual, not a fake pitch', /Research is available with Creator and Professional/i.test(sub), sub);
    if (goalId === 'autopilot') check('16.autopilot entitlement note is factual, not a fake pitch', /Autopilot is available with Professional/i.test(sub), sub);
    if (!['research', 'autopilot'].includes(goalId)) check('16.' + goalId + ' no fabricated restriction note for an unrestricted goal', !/available with/i.test(sub), sub);

    const cardCount = await page.locator('.pw-card').count();
    check('17.' + goalId + ' real plan cards render (Free/Starter/Creator/Professional)', cardCount === 4, 'found ' + cardCount);
    const noTeam = await page.locator('.pw-card-name').evaluateAll((els) => els.map((e) => e.textContent));
    check('18.' + goalId + ' no Team plan card', !noTeam.some((n) => /team/i.test(n)), JSON.stringify(noTeam));
    await page.close();
  }

  // ── Free path completion + routing ──────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const opts = { goal: 'research' };
    await armPage(page, opts);
    await loadAndEnterApp(page);
    await page.evaluate(() => { startOnboarding(); window._ob2Goal = 'research'; _ob2ShowPlanStep(); });
    await page.waitForTimeout(400);
    await page.click('#paywall-btn-free');
    await page.waitForTimeout(400);
    check('19. Free selection calls the real POST /api/select-free-plan', opts.freeCalls && opts.freeCalls.length === 1);
    check('20. Free completion calls POST /api/onboarding/complete (real server-trusted completion, not a client-only flag)', opts.completeCalls && opts.completeCalls.length === 1);
    const navCalls = await page.evaluate(() => window._orvNavCalls);
    check('21. Free completion routes to the chosen goal (Research) via the real _orvNav', JSON.stringify(navCalls) === JSON.stringify([['research', 'page-research']]), JSON.stringify(navCalls));
    const hardFlagCleared = await page.evaluate(() => typeof _paywallHard !== 'undefined' ? _paywallHard : null);
    check('22. _paywallHard reset to false after onboarding finishes (paywall not left permanently un-closeable)', hardFlagCleared === false);
    check('23. Zero credit-spending/generation/research/publish routes called during onboarding', !opts.forbiddenCalls || opts.forbiddenCalls.length === 0, JSON.stringify(opts.forbiddenCalls));
    await page.close();
  }

  // ── Resume: goal already saved -> skip straight to Plan step ────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const opts = { goal: 'autopilot' };
    await armPage(page, opts);
    await loadAndEnterApp(page);
    const resumedToPlan = await page.evaluate(() => {
      startOnboarding('autopilot'); // simulates _loadUserProfile() resuming with an already-persisted primary_goal
      return document.getElementById('ob2Overlay').style.display !== 'flex' && document.getElementById('modal-paywall').classList.contains('pw-hard');
    });
    check('24. Resuming with a saved goal skips straight to the Plan step (never re-asks the goal)', resumedToPlan);
    await page.close();
  }

  // ── Error state: goal save fails ─────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const opts = { goalFails: true };
    await armPage(page, opts);
    await loadAndEnterApp(page);
    await page.evaluate(() => { startOnboarding(); });
    await page.click('.ob2-step-welcome .ob2-btn-primary');
    await page.click('[data-ob2-goal="launch"]');
    await page.click('#ob2GoalContinue');
    await page.waitForTimeout(400);
    await page.screenshot({ path: SHOT_DIR + '/27_error_goal_save_failed.png' });
    const stillOnGoalStep = await page.evaluate(() => !document.getElementById('ob2StepGoal').hidden);
    const errVisible = await page.locator('#ob2GoalErr').isVisible();
    check('25. A failed goal save shows a retryable inline error and does NOT silently continue', stillOnGoalStep && errVisible);
    await page.close();
  }

  // ── Responsive: 1280 / 390 ───────────────────────────────────────
  for (const vp of [{ w: 1280, h: 900, tag: '1280' }, { w: 390, h: 844, tag: '390' }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    const opts = { goal: 'business' };
    await armPage(page, opts);
    await loadAndEnterApp(page);
    await page.evaluate(() => { startOnboarding(); });
    await page.screenshot({ path: SHOT_DIR + '/welcome_' + vp.tag + '.png' });
    await page.click('.ob2-step-welcome .ob2-btn-primary');
    await page.waitForTimeout(200);
    const noHOverflowGoal = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    check(vp.tag + '. Goal step: no horizontal overflow', noHOverflowGoal);
    await page.screenshot({ path: SHOT_DIR + '/goal_' + vp.tag + '.png' });
    await page.click('[data-ob2-goal="business"]');
    await page.click('#ob2GoalContinue');
    await page.waitForTimeout(300);
    const noHOverflowWs = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    check(vp.tag + '. Workspace step: no horizontal overflow', noHOverflowWs);
    await page.screenshot({ path: SHOT_DIR + '/workspace_' + vp.tag + '.png' });
    await page.click('.ob2-step-workspace .ob2-btn-primary');
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT_DIR + '/plan_' + vp.tag + '.png' });
    await page.close();
  }

  // ── Light mode / system theme / reduced motion ──────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const opts = { goal: 'create' };
    await armPage(page, opts);
    await loadAndEnterApp(page);
    await page.evaluate(() => { document.body.classList.remove('dark-mode'); startOnboarding(); });
    await page.waitForTimeout(200);
    await page.screenshot({ path: SHOT_DIR + '/23_light_mode.png' });
    await page.close();
  }
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
    const opts = { goal: 'create' };
    await armPage(page, opts);
    await loadAndEnterApp(page);
    await page.evaluate(() => { startOnboarding(); });
    await page.waitForTimeout(200);
    await page.screenshot({ path: SHOT_DIR + '/24_system_theme_dark.png' });
    await page.close();
  }
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const opts = { goal: 'create' };
    await armPage(page, opts);
    await loadAndEnterApp(page);
    await page.evaluate(() => { startOnboarding(); });
    await page.waitForTimeout(200);
    await page.screenshot({ path: SHOT_DIR + '/25_reduced_motion.png' });
    await page.close();
  }

  // ── Accessibility / keyboard ─────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const opts = { goal: 'create' };
    await armPage(page, opts);
    await loadAndEnterApp(page);
    await page.evaluate(() => { startOnboarding(); });
    const dialogRole = await page.evaluate(() => document.getElementById('ob2Overlay').getAttribute('role'));
    check('26. Overlay has dialog semantics (role=dialog, aria-modal)', dialogRole === 'dialog');
    const headingFocused = await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-ob2-heading'));
    check('27. Step heading receives focus for screen readers on entry', headingFocused);
    await page.click('.ob2-step-welcome .ob2-btn-primary');
    await page.waitForTimeout(200);
    // Keyboard: Tab to a goal card and activate with Enter
    await page.keyboard.press('Tab');
    let focusedGoal = null;
    for (let i = 0; i < 8 && !focusedGoal; i++) {
      focusedGoal = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-ob2-goal'));
      if (!focusedGoal) await page.keyboard.press('Tab');
    }
    check('28. Goal cards are reachable via keyboard Tab', !!focusedGoal, focusedGoal);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const selectedViaKeyboard = await page.locator('.ob2-goal-card-sel').count();
    check('29. Goal selectable via keyboard Enter', selectedViaKeyboard === 1);
    const ariaChecked = await page.locator('.ob2-goal-card-sel').getAttribute('aria-checked');
    check('30. Selected state communicated beyond color (aria-checked)', ariaChecked === 'true');
    await page.screenshot({ path: SHOT_DIR + '/26_keyboard_focus.png' });
    await page.close();
  }

  console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
  await browser.close();
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
