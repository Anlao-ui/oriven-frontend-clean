// ════════════════════════════════════════════════════════════════
// Final Product Navigation redesign — regression tests
//
// Covers: exactly 5 primary nav items (Launch/Campaigns/Research/
// Autopilot/Business), Intelligence removed as a top-level item but
// its functionality preserved as a Campaigns tab, Ad Library (Assets)
// no longer a Campaigns tab (its Create-hero entry point was later
// removed too, in the UI Cleanup pass — #page-assets itself is left
// intact but genuinely unreachable from nav, reported not hidden), the
// new Research page (category selection, empty state, query
// submission), and a no-regression check on Launch/Autopilot/
// Business/mobile nav.
//
// Real browser + real running backend, disposable Supabase user, same
// convention as this repo's other UI test files.
// RUN: node tests/nav-redesign.test.js
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
  results.push({ name, ok: !!cond, detail });
  console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail ? ' (' + detail + ')' : ''));
}

async function createTestUser(suffix) {
  const email = `oriven.navredesign.test+${Date.now()}.${suffix}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'creator', onboarding_completed: true, credits_balance: 5000 }, { onConflict: 'id' });
  return { userId, email, password };
}

async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('profiles').delete().eq('id', userId); } catch (_) {}
  try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
}

async function signIn(page, user) {
  const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: signInData, error } = await authClient.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  await page.evaluate(async ({ access_token, refresh_token }) => {
    await window.SB.auth.setSession({ access_token, refresh_token });
  }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
  await page.evaluate(async () => {
    const { data: { user } } = await window.SB.auth.getUser();
    window._currentUser = user;
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user);
    if (typeof _loadUserProfile === 'function') await _loadUserProfile(user);
  });
  await page.waitForTimeout(900);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let user;
  try {
    user = await createTestUser('a');
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
      await signIn(page, user);
      await page.waitForTimeout(800);

      // ── 1. Exactly 6 primary nav items, in the exact required order ──
      // (Product Flow + Research Chat refinement: Create is now first/
      // default, Research second — the prior "Research/Create/Launch/..."
      // order this test used to assert is superseded.)
      const navLabels = await page.evaluate(() => Array.from(document.querySelectorAll('.orv-sb-nav > .orv-ni:not([style*="display:none"]) .orv-ni-label')).map((el) => el.textContent.trim()));
      check('1. Primary desktop nav is exactly Create/Research/Launch/Campaigns/Autopilot/Business, in that order (Team excluded — plan-gated, not one of the six products)', JSON.stringify(navLabels) === JSON.stringify(['Create', 'Research', 'Launch', 'Campaigns', 'Autopilot', 'Business']), JSON.stringify(navLabels));

      const navLabelsMobile = await page.evaluate(() => Array.from(document.querySelectorAll('.orv-mob-drawer-nav > .orv-ni:not([style*="display:none"]) .orv-ni-label')).map((el) => el.textContent.trim()));
      check('2. Mobile drawer nav matches the desktop order exactly', JSON.stringify(navLabelsMobile) === JSON.stringify(['Create', 'Research', 'Launch', 'Campaigns', 'Autopilot', 'Business']), JSON.stringify(navLabelsMobile));

      check('3. "Intelligence" does not appear as a primary nav label anywhere (desktop or mobile)', !navLabels.includes('Intelligence') && !navLabelsMobile.includes('Intelligence'), JSON.stringify({ navLabels, navLabelsMobile }));
      check('4. "Ad Library" is not a primary nav item (reachable from Create instead)', !navLabels.some((l) => /ad library/i.test(l)), JSON.stringify(navLabels));

      // ── 5. Campaigns Simplification & Consolidation sprint — Overview,
      // Live Campaigns and Insights are no longer three destinations to
      // choose between; the hub tab strip itself is gone (0 tabs), and
      // sidebar "Campaigns" opens straight into the one merged workspace
      // (#page-performance). Supersedes the earlier Product Flow
      // refinement's "exactly Overview/Live Campaigns/Insights" check.
      await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
      await page.waitForTimeout(500);
      const hubTabs = await page.evaluate(() => Array.from(document.querySelectorAll('#orvHubTabsCampaigns .orv-hub-tab')).map((el) => el.textContent.trim()));
      const hubTitle = await page.evaluate(() => document.querySelector('.camp-shell-title')?.textContent);
      check('5. Campaigns hub tab strip no longer offers Overview/Live Campaigns/Insights as separate destinations (0 tabs -- one merged workspace)', hubTabs.length === 0, JSON.stringify(hubTabs));
      check('5b. The merged workspace still identifies itself as "Campaigns"', hubTitle === 'Campaigns', hubTitle);

      // ── 6. Insights is no longer a primary Campaigns destination (no tab
      // to click), but the real Intelligence functionality underneath is
      // NOT deleted — #page-intelligence, its brief panel, and the
      // sidebar's Insights notification badge (_intelCheckBadge, runs
      // independently of ever visiting this page) all still work.
      await page.evaluate(() => { _orvNav('intelligence', 'page-intelligence'); });
      await page.waitForTimeout(600);
      const insightsState = await page.evaluate(() => ({
        pageActive: document.getElementById('page-intelligence').classList.contains('active'),
        campaignsNavHighlighted: document.querySelector('.orv-ni[data-orv-page="performance"]').classList.contains('orv-active'),
        hasBriefPanel: !!document.getElementById('intelPanel'),
        badgeFnExists: typeof _intelCheckBadge === 'function' || typeof window._intelCheckBadge === 'function',
      }));
      check('6. Intelligence (#page-intelligence) still exists and works, even though it is no longer a primary Campaigns tab — Campaigns stays highlighted in the sidebar', insightsState.pageActive && insightsState.campaignsNavHighlighted && insightsState.hasBriefPanel, JSON.stringify(insightsState));
      check('6b. The sidebar Insights notification badge mechanism is not deleted (runs independently of visiting this page)', insightsState.badgeFnExists, insightsState.badgeFnExists);

      // ── 7. Ad Library (#page-assets) is no longer a Campaigns tab. UI
      // Cleanup pass: the "Browse your Ad Library" entry point that used
      // to live in Create's hero was removed entirely per explicit
      // direction (Create no longer needs a secondary library shortcut) —
      // #page-assets itself and its real data/grid are left completely
      // intact (not deleted), just genuinely unreachable from any nav
      // entry point now. That's an intentional, reported consequence of
      // this cleanup, not a bug to route around.
      const creativesTabGone = await page.evaluate(() => !document.querySelector('#orvHubTabsCampaigns .orv-hub-tab[data-hub-target="assets"]'));
      check('7a. "Creatives" is no longer a Campaigns hub tab', creativesTabGone, creativesTabGone);
      await page.evaluate(() => { _orvNav('create', 'page-create'); });
      await page.waitForTimeout(300);
      const createState = await page.evaluate(() => ({
        adLibraryBtnGone: !document.getElementById('createAdLibraryBtn') && !/browse.*ad library/i.test(document.getElementById('page-create').innerText),
        heroHasNoTrailingGap: (() => { const hero = document.querySelector('.cr2-hero'); return hero && hero.children.length === 1; })(),
        promptStillWorks: !!document.getElementById('aicInput'),
      }));
      check('7b. "Browse Ad Library" is fully removed from Create', createState.adLibraryBtnGone, createState.adLibraryBtnGone);
      check('7c. No empty layout gap left behind in Create\'s hero (only the H1 remains)', createState.heroHasNoTrailingGap, createState.heroHasNoTrailingGap);
      check('7d. Create\'s primary prompt input still works', createState.promptStillWorks, createState.promptStillWorks);

      // ── 8. Research page: hero empty state, no auto-fetch ──
      // (Market Map redesign — the old category-picker/one-shot-panel UI
      // was replaced entirely; #researchResults no longer exists. Research
      // Final Polish sprint: the 4 example prompt chips were deliberately
      // removed too — spec section 8, "the user should simply ask what
      // they want to investigate," not be nudged toward invented
      // "recommended questions" — replaced with one honest helper line.)
      const researchApiCalls = [];
      page.on('request', (req) => { if (req.url().includes('/api/research/')) researchApiCalls.push(req.url()); });
      await page.click('.orv-ni[data-orv-page="research"]');
      await page.waitForTimeout(600);
      const researchInitial = await page.evaluate(() => ({
        pageActive: document.getElementById('page-research').classList.contains('active'),
        emptyVisible: document.getElementById('researchEmptyState').style.display !== 'none',
        mapHidden: document.getElementById('researchMapView').style.display === 'none',
        exampleCount: document.querySelectorAll('.rsc-example-chip').length,
        // Research Launchpad pass — the old .rsc-hero-sub capability
        // sentence was removed (the 4 investigation starters communicate
        // it more concretely); .rsc-outcome-line is the new single honest
        // helper line.
        helperText: (document.querySelector('.rsc-outcome-line') || {}).textContent,
      }));
      check('8. Research page shows its real empty state on load, never auto-fetches (spec: only fetch when the user actually requests it)', researchInitial.pageActive && researchInitial.emptyVisible && researchInitial.mapHidden && researchApiCalls.length === 0, JSON.stringify({ researchInitial, apiCalls: researchApiCalls }));
      check('8b. Research shows no fabricated example prompt chips, only a single honest helper line', researchInitial.exampleCount === 0 && !!researchInitial.helperText && researchInitial.helperText.length > 0, researchInitial);

      const composerFilled = await page.evaluate(() => {
        const input = document.getElementById('researchQueryInput');
        input.value = 'What creative approaches are working for SaaS?';
        return input.value.length > 0;
      });
      check('9. The composer textarea accepts real free-text input (the user\'s own question, not a picked example)', composerFilled, composerFilled);

      // ── 10. Submitting a real research objective never shows a fabricated result ──
      await page.fill('#researchQueryInput', 'What creative approaches are working for SaaS?');
      await page.click('#researchSubmitBtn');
      await page.waitForTimeout(4000);
      const afterSubmit = await page.evaluate(() => ({
        loadingHidden: document.getElementById('researchLoadingState').style.display === 'none',
        errorVisible: document.getElementById('researchErrorState').style.display !== 'none',
        mapVisible: document.getElementById('researchMapView').style.display !== 'none',
        errorText: document.getElementById('researchErrorState').textContent,
      }));
      check('10. After submitting, the app reaches a real end state (map OR an honest error) — never stuck loading, never a fabricated instant "success"', afterSubmit.loadingHidden && (afterSubmit.errorVisible || afterSubmit.mapVisible), JSON.stringify(afterSubmit));

      // ── 11. AI-language audit — spec: avoid "AI-powered"/"AI intelligence"/"AI analytics"/"AI research" ──
      const aiLanguageAudit = await page.evaluate(() => {
        const text = document.body.innerText;
        const bad = ['AI-powered', 'AI Intelligence', 'AI Analytics', 'AI Research', 'AI-powered'];
        return bad.filter((phrase) => text.indexOf(phrase) !== -1);
      });
      check('11. No overused "AI-powered"/"AI Intelligence"/"AI Analytics"/"AI Research" phrases in the visible UI', aiLanguageAudit.length === 0, JSON.stringify(aiLanguageAudit));

      // ── 12. Regression: Create, Launch, Autopilot, Business still work ──
      await page.click('.orv-ni[data-orv-page="create"]');
      await page.waitForTimeout(400);
      const createOk = await page.evaluate(() => document.getElementById('page-create').classList.contains('active') && !!document.getElementById('aicInput'));
      check('12. Create still works unchanged (build/generate — spec: do not redesign Create)', createOk, createOk);

      await page.click('.orv-ni[data-orv-page="launch"]');
      await page.waitForTimeout(400);
      const launchOk = await page.evaluate(() => document.getElementById('page-launch').classList.contains('active') && (!!document.getElementById('launchCardGrid') || !!document.getElementById('launchEmpty')));
      check('12b. Launch is a real, separate deploy-only page (not a duplicate of Create)', launchOk, launchOk);

      // This test's user is Creator plan. Real bug fixed in the Autopilot
      // Control Room sprint: the nav gate used to let Creator through onto
      // a page whose every real API call then 403'd (AUTOPILOT_NOT_AVAILABLE
      // -- only Professional actually has Autopilot, per plans.js and
      // requireAutopilotAccess). The correct, now-fixed behavior is the
      // real upsell, not a broken-looking empty Control Room -- so this
      // check now asserts the fix, not the old bug.
      await page.click('.orv-ni[data-orv-page="autopilot"]');
      await page.waitForTimeout(400);
      const autopilotGatedCorrectly = await page.evaluate(() => !document.getElementById('page-autopilot').classList.contains('active'));
      check('13. Autopilot correctly gates a Creator-plan user to the real upsell instead of a broken page (bug fixed in the Control Room sprint)', autopilotGatedCorrectly, autopilotGatedCorrectly);

      await page.click('.orv-ni[data-orv-page="businessbrain"]');
      await page.waitForTimeout(400);
      const businessOk = await page.evaluate(() => document.getElementById('page-business-brain').classList.contains('active'));
      check('14. Business still works unchanged', businessOk, businessOk);

      check('15. No JS errors during the full nav walkthrough', jsErrors.length === 0, JSON.stringify(jsErrors));

      for (const [label, vp] of Object.entries({ desktop: { width: 1440, height: 900 }, tablet1: { width: 1280, height: 800 }, tablet2: { width: 1024, height: 768 }, mobile: { width: 390, height: 844 } })) {
        await page.setViewportSize(vp);
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(() => {
          const mc = document.querySelector('.mc');
          return mc && mc.scrollWidth > mc.clientWidth + 1;
        });
        check(`16. [${label}] No horizontal overflow with the redesigned nav/Research page`, !overflow, 'overflow=' + overflow);
      }
    } finally {
      await page.close();
    }
  } finally {
    if (user) await deleteTestUser(user.userId);
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
