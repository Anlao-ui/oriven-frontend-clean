// ════════════════════════════════════════════════════════════════
// Onboarding / Paywall timing — regression tests
//
// No test framework exists in this repo (static HTML/JS, no build step,
// no package.json before this file) -- matches the plain-Node-script
// convention already established in the backend
// (oriven-backand-clean/server/tests/free-plan.test.js): built-in
// `assert`-free checks via a small `check()` helper, plus Playwright for
// real browser/DOM verification.
//
// WHAT THIS PROVES (see the bug report this fixes: the paywall was
// visible during onboarding, and again while campaign generation was in
// progress, because (a) Brand Identity setup unconditionally called
// maybeShowPaywall() regardless of onboarding/generation state, and
// (b) the onboarding tour's own guided walkthrough of the Autopilot page
// triggered the real "Autopilot requires a paid plan" upsell modal on
// top of itself):
//   1. Paywall is not visible on onboarding step 1.
//   2. Paywall is not visible on ANY onboarding step (steps through
//      every one of the tour's frames, including the Autopilot/Business
//      Brain walkthrough that was the actual root cause).
//   3. Paywall is not visible when the campaign screen first opens.
//   4/5. Paywall is not shown when generation starts or while running.
//   6. Paywall appears ONLY after the first campaign's copy AND its
//      creative/image have both actually settled (_cgrReveal, gated on
//      _cgrBuildCreativeSettled) -- not merely on text completing.
//   7. Free/Starter/Creator/Professional render in one horizontal row on
//      desktop and tablet-with-room, 2x2 at narrower tablet widths, and
//      stack to one column on mobile.
//   8. Free plan config/UI wiring is still intact (existing Free-plan
//      functionality unaffected by this fix) -- the backend counterpart
//      (credits, Intelligence, Autopilot rejection) is already covered
//      exhaustively by oriven-backand-clean/server/tests/free-plan.test.js;
//      this only re-checks the frontend wiring this change touched.
//
// SIDE EFFECTS / COST: creates one throwaway Supabase test user per run
// (deleted in a finally block) and drives a real browser against the
// local static server. No AI provider is ever called -- the "generation
// complete" scenario uses a synthetic, already-"cached" package object so
// the real image-generation endpoint is never hit.
//
// PREREQUISITES:
//   - Local static server serving this repo on :8899
//     (npx http-server "C:\files" -p 8899 -c-1)
//   - Local backend running on :5500 (node server.js from
//     oriven-backand-clean/server) -- only used for the handful of
//     API calls app.html makes on load; not required to be fully
//     functional for these specific checks.
//   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in ../.env (same .env the
//     backend already uses).
//   - Playwright + @supabase/supabase-js + dotenv (see package.json).
//
// RUN: npm test   (from this repo's root, C:\files)
// ════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const BASE_URL = process.env.TEST_FRONTEND_URL || 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH
  || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env — aborting.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

async function createTestUser(suffix) {
  const email = `oriven.onboarding.test+${Date.now()}.${suffix || 'a'}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({
    id: userId, email, subscription_status: 'free',
    onboarding_completed: false, free_campaign_used: false, free_campaign_used_at: null,
  }, { onConflict: 'id' });
  return { userId, email, password };
}

async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('profiles').delete().eq('id', userId); } catch (_) {}
  try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
}

// Establishes a real, server-verifiable session in the page AND runs the
// same guest-mode-exit + profile-load path a genuine login triggers.
// Bypassing _guestOnSignedIn (guest.js) here would leave openModal()
// permanently patched to no-op for 'modal-paywall' (guest mode blocks the
// paywall by design), producing false failures unrelated to this fix.
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
  await page.waitForTimeout(800);
}

function paywallOpen(page) {
  return page.evaluate(() => {
    const el = document.getElementById('modal-paywall');
    return el ? el.classList.contains('open') : null;
  });
}

async function main() {
  const results = [];
  function check(name, cond, detail) {
    results.push({ name, ok: !!cond, detail });
    console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail ? ' (' + detail + ')' : ''));
  }

  const browser = await chromium.launch({ executablePath: CHROME_PATH });

  // ── 1, 2, 3, 4, 5, 6: onboarding → campaign → completion timing ──────
  {
    const user = await createTestUser('flow');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
      await signIn(page, user);

      // 1. Not visible on onboarding step 1.
      let st = await page.evaluate(() => {
        const el = document.getElementById('modal-paywall');
        const cs = el ? getComputedStyle(el) : null;
        return { obActive: !!window._obActive, obStep: window._obStep, open: el ? el.classList.contains('open') : null, opacity: cs ? cs.opacity : null };
      });
      check('1. Onboarding is active and on step 1', st.obActive === true && st.obStep === 1, JSON.stringify(st));
      check('1. Paywall not visible on onboarding step 1', st.open === false && st.opacity === '0', JSON.stringify(st));

      // 2. Not visible on any onboarding frame, including the
      // Autopilot/Business-Brain walkthrough that was the real bug.
      const stepCount = await page.evaluate(() => (typeof _OB_FRAMES !== 'undefined' ? _OB_FRAMES.length : 0));
      let openedDuringOnboarding = [];
      for (let i = 1; i <= stepCount; i++) {
        await page.evaluate((n) => { if (typeof obGoTo === 'function') obGoTo(n); }, i);
        await page.waitForTimeout(120);
        if (await paywallOpen(page)) openedDuringOnboarding.push(i);
      }
      check('2. Paywall not visible on any of ' + stepCount + ' onboarding frames', openedDuringOnboarding.length === 0, 'opened at frames: ' + JSON.stringify(openedDuringOnboarding));

      // End the tour, land on the campaign creation screen.
      await page.evaluate(() => { if (typeof hideOnboarding === 'function') hideOnboarding(true); window._obActive = false; if (typeof navigate === 'function') navigate('create'); });
      await page.waitForTimeout(300);

      // 3. Not visible when the campaign screen first opens.
      st = await page.evaluate(() => ({
        open: document.getElementById('modal-paywall').classList.contains('open'),
        createActive: !!document.getElementById('page-create') && document.getElementById('page-create').classList.contains('active'),
      }));
      check('3. Paywall not visible when campaign screen opens', st.open === false, JSON.stringify(st));

      // 4/5. Not shown when generation starts / while the loading UI runs.
      await page.evaluate((prompt) => { if (typeof _showResultsPage === 'function') _showResultsPage(prompt, 'google', 'images', 'Sales'); }, 'A skincare brand for sensitive skin');
      await page.waitForTimeout(200);
      st = await page.evaluate(() => ({
        open: document.getElementById('modal-paywall').classList.contains('open'),
        loadingVisible: (function(){ var l = document.getElementById('cgrLoading'); return l ? getComputedStyle(l).display !== 'none' : null; })(),
      }));
      check('4/5. Paywall not shown while generation/loading UI is showing', st.open === false, JSON.stringify(st));

      // 6. Paywall appears ONLY after copy AND creative both settle.
      // Synthetic, already-"cached" package -- _startCreativesGeneration
      // treats a pre-set generatedImageUrl as already generated, so this
      // never calls the real image-generation endpoint.
      const fakePkg = {
        platform: 'google', campaignName: 'Test Campaign',
        strategy: { goal: 'Sales', targetAudience: 'Test audience' },
        visualConcepts: [{ conceptRef: 'Concept 1', imagePrompts: ['a clean product photo'], generatedImageUrl: 'https://via.placeholder.com/600x400.png' }],
        googleAds: { headlines: ['Test headline'], descriptions: ['Test description'], keywords: ['test'] },
      };
      await page.evaluate((pkg) => { if (typeof window._cgrRenderPackage === 'function') window._cgrRenderPackage(pkg, 'A skincare brand for sensitive skin'); }, fakePkg);
      await page.waitForTimeout(150);
      check('6a. Paywall not shown immediately after copy renders (before creative settles)', (await paywallOpen(page)) === false);

      await page.waitForTimeout(3000); // past the settle callback + the deferred paywall open
      check('6b. Paywall appears once copy AND creative are fully complete', (await paywallOpen(page)) === true);
    } finally {
      await page.close();
      await deleteTestUser(user.userId);
    }
  }

  // ── 7: responsive plan-card grid ──────────────────────────────────────
  {
    const user = await createTestUser('grid');
    for (const [label, width, expectCols] of [['desktop', 1440, 4], ['tablet-wide', 820, 4], ['tablet-narrow', 700, 2], ['mobile', 390, 1]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
        await signIn(page, user);
        await page.evaluate(() => { if (typeof openPaywall === 'function') openPaywall(); });
        await page.waitForTimeout(400);
        const grid = await page.evaluate(() => {
          const g = document.getElementById('pwPlanGrid');
          if (!g) return null;
          const cards = Array.from(g.querySelectorAll('.pw-card'));
          const tops = cards.map(c => Math.round(c.getBoundingClientRect().top));
          const cs = getComputedStyle(g);
          return { cardCount: cards.length, tops, columns: cs.gridTemplateColumns.split(' ').length };
        });
        check('7. [' + label + ' ' + width + 'px] 4 plan cards render', grid && grid.cardCount === 4, JSON.stringify(grid));
        check('7. [' + label + ' ' + width + 'px] grid has ' + expectCols + ' column(s)', grid && grid.columns === expectCols, JSON.stringify(grid));
        if (expectCols > 1) {
          const rows = new Set(grid.tops).size;
          const expectRows = Math.ceil(4 / expectCols);
          check('7. [' + label + ' ' + width + 'px] cards form ' + expectRows + ' even row(s), none stranded alone', rows === expectRows, JSON.stringify(grid));
        }
      } finally {
        await page.close();
      }
    }
    await deleteTestUser(user.userId);
  }

  // ── 8: existing Free-plan functionality remains intact ────────────────
  // Backend behavior (credits, Intelligence, Autopilot rejection, Stripe/
  // paid-plan isolation) is already covered exhaustively by
  // oriven-backand-clean/server/tests/free-plan.test.js -- this only
  // re-confirms the frontend wiring this fix touched is still correct.
  {
    const user = await createTestUser('freewiring');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
      await signIn(page, user);
      await page.evaluate(() => { if (typeof openPaywall === 'function') openPaywall(); });
      await page.waitForTimeout(400);
      const wiring = await page.evaluate(() => {
        const btn = document.getElementById('paywall-btn-free');
        return {
          continueOnFreePlanExists: typeof continueOnFreePlan === 'function',
          selectPlanExists: typeof selectPlan === 'function',
          freeCardBtnText: btn ? btn.textContent.trim() : null,
          freeCardBtnDisabled: btn ? btn.disabled : null,
          freePlanConfig: (typeof ORIVEN_PLANS !== 'undefined' && ORIVEN_PLANS.free) ? { price: ORIVEN_PLANS.free.price, credits: ORIVEN_PLANS.free.credits } : null,
        };
      });
      check('8. continueOnFreePlan()/selectPlan() still wired up', wiring.continueOnFreePlanExists && wiring.selectPlanExists, JSON.stringify(wiring));
      // This test user is genuinely on 'free', so the button correctly
      // reads "Current Plan" (disabled) -- confirms plan-state-aware
      // rendering still works, not a hardcoded label.
      check('8. Free card correctly reflects a Free user\'s current-plan state', wiring.freeCardBtnDisabled === true && /current plan/i.test(wiring.freeCardBtnText || ''), JSON.stringify(wiring));
      check('8. Free plan config intact (0 price, 20 credits)', wiring.freePlanConfig && wiring.freePlanConfig.price === 0 && wiring.freePlanConfig.credits === 20, JSON.stringify(wiring));
    } finally {
      await page.close();
      await deleteTestUser(user.userId);
    }
  }

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n' + results.length + ' checks run, ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed.');
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
