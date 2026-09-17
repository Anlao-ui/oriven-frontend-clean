// ════════════════════════════════════════════════════════════════
// Research Launchpad — READY-state visual/product pass
//
// Dedicated coverage for what's NEW in this pass specifically: the 4
// investigation starters, "+ Add website" relabeling, the outcome line,
// and the READY<->INVESTIGATING<->COMPLETE launchpad visibility
// transitions. Structural Market Map / Findings / Sources / URL-security
// coverage already lives in research-market-map.test.js and
// research-ux-redesign.test.js and is NOT duplicated here.
//
// RUN: node tests/research-launchpad.test.js
// ════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const BASE_URL = process.env.TEST_FRONTEND_URL || 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond });
  console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail !== undefined ? ' (' + JSON.stringify(detail) + ')' : ''));
}

async function createTestUser(suffix) {
  const email = `oriven.launchpad.test+${Date.now()}.${suffix}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await supabaseAdmin.from('profiles').upsert({ id: created.user.id, email, subscription_status: 'creator', onboarding_completed: true }, { onConflict: 'id' });
  return { userId: created.user.id, email, password };
}
async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('profiles').delete().eq('id', userId); } catch (_) {}
  try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
}
async function signIn(page, user) {
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: signInData, error } = await authClient.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
  await page.evaluate(async () => { const { data: { user } } = await window.SB.auth.getUser(); window._currentUser = user; if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user); if (typeof _loadUserProfile === 'function') await _loadUserProfile(user); });
  await page.waitForTimeout(900);
}

const FIXTURE = {
  question: '[FIXTURE] launchpad regression question',
  summary: '[FIXTURE] summary',
  market: { name: 'Fixture Market', characteristics: [] },
  competitors: [{ id: 'c1', name: '[FIXTURE] Co', positioning: 'x', products: [], priceRange: '', advertisingPatterns: [], sourceIds: [], evidenceIds: [] }],
  customerSignals: [], advertisingPatterns: [], trends: [], opportunities: [], evidence: [],
  confidence: 'moderate', sourceType: 'ai_synthesis', sourceDisclaimer: 'x',
  sources: [], webSources: [], urlSources: [], urlSourceErrors: [],
};

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let user;
  try {
    user = await createTestUser('a');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const jsErrors = [];
    const netErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    // Only the real research/credit-SPEND endpoints count here —
    // /api/credits/status is a harmless, unrelated balance-read poll
    // that fires on its own page-lifecycle timer regardless of starter
    // interaction, not a side effect of clicking one.
    page.on('request', (req) => { if (req.url().includes('/api/research/query') || req.url().includes('/api/credits/spend') || req.url().includes('/api/credits/reserve')) netErrors.push(req.url()); });
    await signIn(page, user);
    await page.evaluate(() => { _orvNav('research', 'page-research'); });
    await page.waitForTimeout(400);

    // ── Starters exist only in READY, exactly 4 ──────────────────────
    const readyState = await page.evaluate(() => {
      const starters = Array.from(document.querySelectorAll('.rsc-starter'));
      return {
        launchpadVisible: getComputedStyle(document.getElementById('researchLaunchpad')).display !== 'none',
        starterCount: starters.length,
        starterKeys: starters.map((s) => s.dataset.starter),
        allButtons: starters.every((s) => s.tagName === 'BUTTON'),
        allHaveAriaPressed: starters.every((s) => s.getAttribute('aria-pressed') === 'false'),
        addWebsiteLabel: document.getElementById('researchUrlAddBtn').textContent.trim(),
        outcomeLineText: document.querySelector('.rsc-outcome-line').textContent.trim(),
        noOldCapabilitySentence: !/Investigate competitors, advertising, audiences, trends, or opportunities/.test(document.getElementById('page-research').textContent),
      };
    });
    check('1. Launchpad visible in READY state', readyState.launchpadVisible, readyState);
    check('2. Exactly 4 investigation starters render, matching the 4 real categories', readyState.starterCount === 4 && JSON.stringify(readyState.starterKeys.sort()) === JSON.stringify(['audience', 'competitors', 'market', 'opportunities']), readyState);
    check('3. Starters are real semantic buttons, all unselected by default', readyState.allButtons && readyState.allHaveAriaPressed, readyState);
    check('4. "+ Add website" label confirmed (not "+ Add URL")', readyState.addWebsiteLabel === '+ Add website', readyState.addWebsiteLabel);
    check('5. A real, non-generic outcome line exists and mentions the Market Map', readyState.outcomeLineText.length > 0 && /market map/i.test(readyState.outcomeLineText) && !/powered by ai|ai-powered|unlock|supercharge/i.test(readyState.outcomeLineText), readyState.outcomeLineText);
    check('6. The old redundant capability sentence was removed', readyState.noOldCapabilitySentence, readyState.noOldCapabilitySentence);

    // ── Starter click selects the correct Focus, never launches research ──
    await page.click('.rsc-starter[data-starter="market"]');
    await page.waitForTimeout(150);
    const afterMarket = await page.evaluate(() => ({
      starterPressed: document.querySelector('.rsc-starter[data-starter="market"]').getAttribute('aria-pressed'),
      marketPillPressed: document.querySelector('.rsc-focus-pill[data-focus="market"]').getAttribute('aria-pressed'),
      focusLabel: document.getElementById('researchFocusToggleBtn').textContent,
      placeholderChanged: document.getElementById('researchQueryInput').placeholder !== 'Research how premium fitness brands advertise compression shirts in Europe…',
      textareaEmpty: document.getElementById('researchQueryInput').value === '',
      textareaFocused: document.activeElement.id === 'researchQueryInput',
      loadingVisible: document.getElementById('researchLoadingState').style.display !== 'none',
    }));
    check('7. Clicking "Explore a market" selects the real market Focus pill', afterMarket.starterPressed === 'true' && afterMarket.marketPillPressed === 'true', afterMarket);
    // Research READY-state polish pass — the toggle's visible label is
    // always exactly "Focus" now (count removed); the real selection is
    // verified via the pill's own aria-pressed above (check 7), not the
    // button's text.
    check('8. Focus toggle keeps the plain "Focus" label even with a real starter-driven selection active', afterMarket.focusLabel === 'Focus', afterMarket.focusLabel);
    check('9. Starter click updates composer guidance (placeholder), never the textarea value', afterMarket.placeholderChanged && afterMarket.textareaEmpty, afterMarket);
    check('10. Starter click focuses the textarea (prepares composer for typing)', afterMarket.textareaFocused, afterMarket.textareaFocused);
    check('11. Starter click does NOT start an investigation', !afterMarket.loadingVisible, afterMarket.loadingVisible);
    check('12. Starter click triggers zero network calls (no research run, no credit spend)', netErrors.length === 0, netErrors);

    // Switching starters replaces selection (mutually exclusive)
    await page.click('.rsc-starter[data-starter="opportunities"]');
    await page.waitForTimeout(150);
    const switched = await page.evaluate(() => ({
      marketPressed: document.querySelector('.rsc-starter[data-starter="market"]').getAttribute('aria-pressed'),
      oppPressed: document.querySelector('.rsc-starter[data-starter="opportunities"]').getAttribute('aria-pressed'),
      focusLabel: document.getElementById('researchFocusToggleBtn').textContent,
    }));
    check('13. Selecting a different starter deselects the previous one (mutually exclusive), Focus label stays plain "Focus"', switched.marketPressed === 'false' && switched.oppPressed === 'true' && switched.focusLabel === 'Focus', switched);

    // Re-clicking the active starter deselects it
    await page.click('.rsc-starter[data-starter="opportunities"]');
    await page.waitForTimeout(150);
    const deselected = await page.evaluate(() => ({
      oppPressed: document.querySelector('.rsc-starter[data-starter="opportunities"]').getAttribute('aria-pressed'),
      focusLabel: document.getElementById('researchFocusToggleBtn').textContent,
      placeholderRestored: document.getElementById('researchQueryInput').placeholder === 'Research how premium fitness brands advertise compression shirts in Europe…',
    }));
    check('14. Re-clicking the active starter deselects it and restores the default placeholder', deselected.oppPressed === 'false' && deselected.focusLabel === 'Focus' && deselected.placeholderRestored, deselected);

    // Keyboard activation — focuses the starter directly (a real button,
    // reachable by Tab in normal document order since it has no tabindex
    // override) and confirms Enter genuinely activates it, same as a
    // real keyboard user landing on it via Tab would experience.
    await page.locator('.rsc-starter[data-starter="market"]').focus();
    const kbFocused = await page.evaluate(() => document.activeElement.dataset ? document.activeElement.dataset.starter : null);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    const kbActivated = await page.evaluate(() => document.querySelector('.rsc-starter[data-starter="market"]').getAttribute('aria-pressed'));
    check('15. A starter is keyboard-focusable and Enter genuinely activates it', kbFocused === 'market' && kbActivated === 'true', { kbFocused, kbActivated });
    await page.evaluate(() => { document.querySelectorAll('.rsc-starter[aria-pressed="true"]').forEach((b) => b.click()); }); // reset

    // ── Starters absent once investigating / complete ────────────────
    await page.route('**/api/research/query', () => new Promise(() => {})); // hang, inspect investigating state
    await page.fill('#researchQueryInput', 'launchpad investigating-state check');
    await page.click('#researchSubmitBtn');
    await page.waitForTimeout(500);
    const investigating = await page.evaluate(() => getComputedStyle(document.getElementById('researchLaunchpad')).display === 'none');
    check('16. Launchpad (starters + outcome line) is hidden while investigating', investigating);
    await page.unroute('**/api/research/query');

    await page.evaluate((d) => {
      window._researchLastResult = d; window._researchChatHistory = [];
      _rmapRender(d); _researchSetState('researchMapView');
      document.getElementById('researchFollowupRow').style.display = '';
    }, FIXTURE);
    await page.waitForTimeout(300);
    const complete = await page.evaluate(() => ({
      launchpadHidden: getComputedStyle(document.getElementById('researchLaunchpad')).display === 'none',
      mapVisible: document.getElementById('researchMapView').style.display !== 'none',
    }));
    check('17. Launchpad/starters absent in the completed workspace', complete.launchpadHidden && complete.mapVisible, complete);

    // ── New Investigation restores the launchpad and resets everything ──
    await page.click('.rsc-map-btn:has-text("New Research")');
    await page.waitForTimeout(300);
    const afterNew = await page.evaluate(() => ({
      launchpadVisible: getComputedStyle(document.getElementById('researchLaunchpad')).display !== 'none',
      allStartersUnpressed: Array.from(document.querySelectorAll('.rsc-starter')).every((s) => s.getAttribute('aria-pressed') === 'false'),
      focusLabel: document.getElementById('researchFocusToggleBtn').textContent,
      lastResultCleared: window.__dummy || true, // checked below via evaluate on window
    }));
    const lastResultNull = await page.evaluate(() => window._researchLastResult === null || window._researchLastResult === undefined);
    check('18. New Investigation restores the launchpad', afterNew.launchpadVisible, afterNew);
    check('19. New Investigation resets all starter selection state', afterNew.allStartersUnpressed && afterNew.focusLabel === 'Focus', afterNew);
    check('19b. New Investigation clears the in-memory result (no stale research)', lastResultNull, lastResultNull);

    check('JS errors during the full launchpad walkthrough', jsErrors.length === 0, jsErrors);

    // ── Light mode ────────────────────────────────────────────────────
    const lightCheck = await page.evaluate(() => ({
      isDark: document.body.classList.contains('dark-mode'),
      starterBg: getComputedStyle(document.querySelector('.rsc-starter')).backgroundColor,
    }));
    check('20. READY state (default) is light mode with real starter styling applied', !lightCheck.isDark && lightCheck.starterBg !== 'rgba(0, 0, 0, 0)', lightCheck);

    // ── Reduced motion ────────────────────────────────────────────────
    const rmPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await signIn(rmPage, user);
    await rmPage.evaluate(() => { _orvNav('research', 'page-research'); });
    await rmPage.waitForTimeout(400);
    const rmState = await rmPage.evaluate(() => {
      const starter = document.querySelector('.rsc-starter');
      return { launchpadVisible: getComputedStyle(document.getElementById('researchLaunchpad')).display !== 'none', transition: getComputedStyle(starter).transitionDuration };
    });
    check('21. Reduced motion: launchpad renders fully and correctly', rmState.launchpadVisible, rmState);
    await rmPage.close();

    // ── Mobile ────────────────────────────────────────────────────────
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await signIn(mobilePage, user);
    await mobilePage.evaluate(() => { _orvNav('research', 'page-research'); });
    await mobilePage.waitForTimeout(400);
    const mobileReady = await mobilePage.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      starterCount: document.querySelectorAll('.rsc-starter').length,
      columns: getComputedStyle(document.getElementById('researchStarters')).gridTemplateColumns.split(' ').length,
    }));
    check('22. Mobile READY: no horizontal overflow', !mobileReady.overflow, mobileReady);
    check('22b. Mobile: starters stack to a single column', mobileReady.columns === 1, mobileReady);
    await mobilePage.click('.rsc-starter[data-starter="audience"]');
    await mobilePage.waitForTimeout(150);
    const mobileSelected = await mobilePage.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      pressed: document.querySelector('.rsc-starter[data-starter="audience"]').getAttribute('aria-pressed'),
    }));
    check('23. Mobile: selecting a starter works and causes no overflow', !mobileSelected.overflow && mobileSelected.pressed === 'true', mobileSelected);
    // Outcome line must not visually collide with the fixed ORIVEN assistant pill.
    const overlapCheck = await mobilePage.evaluate(() => {
      const outcome = document.querySelector('.rsc-outcome-line').getBoundingClientRect();
      const pillEl = Array.from(document.querySelectorAll('button,div')).find((el) => el.textContent.trim() === 'Oriven' && getComputedStyle(el).position === 'fixed');
      if (!pillEl) return { skipped: true };
      const pill = pillEl.getBoundingClientRect();
      const overlap = !(outcome.right < pill.left || outcome.left > pill.right || outcome.bottom < pill.top || outcome.top > pill.bottom);
      return { overlap };
    });
    check('24. Mobile: outcome line does not visually collide with the fixed ORIVEN assistant pill', overlapCheck.skipped || !overlapCheck.overlap, overlapCheck);
    await mobilePage.close();

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
    if (failed.length) process.exitCode = 1;
  } finally {
    if (user) await deleteTestUser(user.userId);
    await browser.close();
  }
}
main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
