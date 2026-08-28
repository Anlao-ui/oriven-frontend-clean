// ════════════════════════════════════════════════════════════════
// Free Plan positioning — cross-product consistency regression tests
//
// Free is NOT a public pricing tier. It's an in-app exploration/trial
// state for a new user before they commit to a paid subscription:
//   - Public landing page pricing: Starter, Creator, Professional ONLY.
//   - Authenticated product (Settings/Subscription, paywall): Free is
//     shown ONLY as an authenticated user's own current-state card, when
//     their actual plan genuinely is 'free' -- never as a selectable
//     option offered to a Starter/Creator/Professional user.
// The internal plan system still recognizes free/starter/creator/
// professional as one single source of truth (plans.js ORIVEN_PLAN_LIST);
// only the PUBLIC-facing landing page and a PAID user's own plan-card grid
// filter it out (ORIVEN_PAID_PLANS), per the product decision.
//
// Also covers the new Free economics: 10 credits/day (was 20), 1
// Intelligence use/month (was 1/day) -- copy-level checks only; the actual
// server-enforced numbers are covered by oriven-backand-clean/server/tests/
// free-plan.test.js.
//
// Same plain-Node-script convention as the other test files in this repo
// (no framework) -- see tests/onboarding-paywall.test.js for the fuller
// rationale.
//
// RUN: npm run test:plans   (this file only)
//      npm test              (this file AND the other frontend suites)
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

async function createTestUser(status, suffix) {
  const email = `oriven.planconsistency.test+${Date.now()}.${suffix || 'a'}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  const profile = { id: userId, email, subscription_status: status, onboarding_completed: true };
  if (status !== 'free') {
    profile.credits_balance = 500;
    profile.credits_cycle_start = new Date().toISOString();
    profile.credits_cycle_end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    profile.credits_provisioned_plan = status;
  }
  await supabaseAdmin.from('profiles').upsert(profile, { onConflict: 'id' });
  return { userId, email, password };
}

async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('credit_transactions').delete().eq('user_id', userId); } catch (_) {}
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
  await page.waitForTimeout(700);
}

async function planCardNames(page, selector) {
  return page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map(el => el.textContent.trim()), selector);
}

async function main() {
  const results = [];
  function check(name, cond, detail) {
    results.push({ name, ok: !!cond, detail });
    console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail ? ' (' + detail + ')' : ''));
  }

  const browser = await chromium.launch({ executablePath: CHROME_PATH });

  // ── 1. Free remains a valid internal plan (public, no auth needed) ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      const info = await page.evaluate(() => ({
        hasFree: typeof ORIVEN_PLANS !== 'undefined' && !!ORIVEN_PLANS.free,
        inPlanList: typeof ORIVEN_PLAN_LIST !== 'undefined' && ORIVEN_PLAN_LIST.some(p => p.id === 'free'),
        notInPaidList: typeof ORIVEN_PAID_PLANS !== 'undefined' && !ORIVEN_PAID_PLANS.some(p => p.id === 'free'),
        credits: typeof ORIVEN_PLANS !== 'undefined' && ORIVEN_PLANS.free && ORIVEN_PLANS.free.credits,
        intelligence: typeof ORIVEN_PLANS !== 'undefined' && ORIVEN_PLANS.free && ORIVEN_PLANS.free.intelligence,
        autopilotLimit: typeof ORIVEN_PLANS !== 'undefined' && ORIVEN_PLANS.free ? ORIVEN_PLANS.free.autopilotLimit : 'missing',
      }));
      check('1. Free remains a valid internal plan (ORIVEN_PLANS.free exists, in ORIVEN_PLAN_LIST)', info.hasFree && info.inPlanList, JSON.stringify(info));
      check('1b. Free is deliberately excluded from ORIVEN_PAID_PLANS (the public/paid-user list)', info.notInPaidList, JSON.stringify(info));
      check('8. Free plan data: exactly 10 credits/day', info.credits === 10, String(info.credits));
      check('10. Free plan data: exactly "1 use / month" Intelligence', info.intelligence === '1 use / month', String(info.intelligence));
      check('13. Free plan data: Autopilot not included (autopilotLimit === null)', info.autopilotLimit === null, String(info.autopilotLimit));
    } finally {
      await page.close();
    }
  }

  // ── 2 & 3: landing page shows exactly Starter/Creator/Professional, no Free ──
  {
    for (const [label, width, expectCols] of [['desktop', 1440, 3], ['tablet', 900, 3], ['tablet-narrow', 800, 3], ['mobile', 390, 1]]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      try {
        await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(600);
        const info = await page.evaluate(() => {
          const grid = document.getElementById('lpPricingGrid');
          if (!grid) return null;
          const cards = Array.from(grid.querySelectorAll('.ov-pc'));
          const names = cards.map(c => (c.querySelector('.ov-pc-tier') || {}).textContent || '');
          const tops = cards.map(c => Math.round(c.getBoundingClientRect().top));
          const cs = getComputedStyle(grid);
          return { names, tops, columns: cs.gridTemplateColumns.split(' ').length, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        var sameRow = info && info.tops.every(function(t){ return Math.abs(t - info.tops[0]) <= 2; });
        check('2. [' + label + '] Free does NOT appear on landing-page pricing', info && !info.names.includes('Free'), JSON.stringify(info && info.names));
        check('3. [' + label + '] Landing page shows exactly Starter, Creator, Professional', info && JSON.stringify(info.names) === JSON.stringify(['Starter', 'Creator', 'Professional']), JSON.stringify(info && info.names));
        if (label === 'desktop') check('5. Desktop landing page: all 3 plans in one row, no empty 4th column', info && info.columns === 3 && sameRow, JSON.stringify(info));
        if (label === 'tablet') check('6. Tablet (900px) landing page: 3 plans still in one row', info && info.columns === 3 && sameRow, JSON.stringify(info));
        if (label === 'tablet-narrow') check('6. Narrow tablet (800px) landing page: still 3 in one row, no orphaned card', info && info.columns === 3 && sameRow, JSON.stringify(info));
        if (label === 'mobile') check('7. Mobile landing page: stacks to 1 column, no horizontal overflow', info && info.columns === 1 && info.overflowX <= 0, JSON.stringify(info));
      } finally {
        await page.close();
      }
    }
  }

  // ── 4, 9, 11, 12: Free card content (paywall + Settings) for a genuine Free user ──
  {
    const user = await createTestUser('free', 'free');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
      await signIn(page, user);

      // Paywall — Free must appear as the current-state card, alongside the
      // 3 real upgrade choices, never alone and never missing.
      await page.evaluate(() => { if (typeof openPaywall === 'function') openPaywall(); });
      await page.waitForTimeout(400);
      const pwNames = await planCardNames(page, '#pwPlanGrid .pw-card-name');
      const pwFree = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('#pwPlanGrid .pw-card'));
        const free = cards.find(c => (c.querySelector('.pw-card-name') || {}).textContent === 'Free');
        return free ? { text: free.textContent, price: (free.querySelector('.pw-price') || {}).textContent } : null;
      });
      check('4. [free user] Paywall shows Free as current state plus Starter/Creator/Professional as upgrade choices', JSON.stringify(pwNames) === JSON.stringify(['Free', 'Starter', 'Creator', 'Professional']), JSON.stringify(pwNames));
      check('9. Paywall Free card shows "10 credits / day"', pwFree && /10\s*credits\s*\/\s*day/i.test(pwFree.text), pwFree && pwFree.text);
      check('11. Paywall Free card shows "1 Intelligence use / month"', pwFree && /1\s*Intelligence\s*use\s*\/\s*month/i.test(pwFree.text), pwFree && pwFree.text);
      check('Paywall Free card does NOT claim unrestricted "Create ads"', pwFree && !/\bCreate ads\b/i.test(pwFree.text), pwFree && pwFree.text);
      check('13. Paywall Free card shows Autopilot excluded', pwFree && /Autopilot/i.test(pwFree.text), pwFree && pwFree.text);
      check('Paywall Free price is €0', pwFree && /€\s*0\b/.test(pwFree.price || ''), pwFree && pwFree.price);
      const pwFreeBtn = await page.evaluate(() => {
        const btn = document.getElementById('paywall-btn-free');
        return btn ? { text: btn.textContent, disabled: btn.disabled } : null;
      });
      check('4b. Free\'s paywall card reads as the current state (disabled "Current Plan"), not a selectable option', pwFreeBtn && pwFreeBtn.disabled && /current plan/i.test(pwFreeBtn.text), JSON.stringify(pwFreeBtn));

      // Settings / Subscription panel
      await page.evaluate(() => { if (typeof openSettingsModal === 'function') openSettingsModal(); });
      await page.waitForTimeout(300);
      await page.evaluate(async () => { if (typeof renderPlanPanel === 'function') await renderPlanPanel(); });
      await page.waitForTimeout(500);
      const subFree = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('#planPanelContent .sub-pcard'));
        const free = cards.find(c => (c.querySelector('.sub-pcard-name') || {}).textContent === 'Free');
        return free ? { text: free.textContent, isCurrent: free.classList.contains('sub-pcard-active') } : null;
      });
      check('4. [free user] Free appears as a card in Settings/Subscription', !!subFree, JSON.stringify(subFree));
      check('4c. Free is correctly marked as the current plan (not an error/missing state)', subFree && subFree.isCurrent && /Current Plan/i.test(subFree.text), JSON.stringify(subFree));
      check('9. Settings Free card shows 10 credits (daily)', subFree && /10/.test(subFree.text) && /day/i.test(subFree.text), subFree && subFree.text);
      check('11. Settings Free card shows Intelligence 1 use/month', subFree && /Intelligence.*1 use \/ month/i.test(subFree.text.replace(/\s+/g, ' ')), subFree && subFree.text);
      check('13. Settings Free card shows Autopilot not included', subFree && /Autopilot:\s*not included/i.test(subFree.text), subFree && subFree.text);
      const cancelPlanVisible = await page.evaluate(() => Array.from(document.querySelectorAll('.sub-cancel-link')).some(el => /cancel plan/i.test(el.textContent)));
      check('Settings does not show a "Cancel plan" action for a Free user', cancelPlanVisible === false);

      const order = await page.evaluate(() => Array.from(document.querySelectorAll('#planPanelContent .sub-pcard-name')).map(el => el.textContent));
      check('4d. [free user] Settings plan order is Free, Starter, Creator, Professional', JSON.stringify(order) === JSON.stringify(['Free', 'Starter', 'Creator', 'Professional']), JSON.stringify(order));
    } finally {
      await page.close();
      await deleteTestUser(user.userId);
    }
  }

  // ── 5, 6, 7: Free is NOT offered as an option to any paid-plan user,
  // in either Settings/Subscription or the paywall. ──────────────────────
  {
    for (const status of ['starter', 'creator', 'professional']) {
      const user = await createTestUser(status, status);
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      try {
        await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
        await signIn(page, user);

        await page.evaluate(() => { if (typeof openSettingsModal === 'function') openSettingsModal(); });
        await page.waitForTimeout(300);
        await page.evaluate(async () => { if (typeof renderPlanPanel === 'function') await renderPlanPanel(); });
        await page.waitForTimeout(500);
        const settingsNames = await planCardNames(page, '#planPanelContent .sub-pcard-name');
        check('5/6/7. [' + status + '] Settings does NOT show Free as an option', !settingsNames.includes('Free'), JSON.stringify(settingsNames));
        check('[' + status + '] Settings shows exactly the 3 paid plans, current one included', JSON.stringify(settingsNames) === JSON.stringify(['Starter', 'Creator', 'Professional']), JSON.stringify(settingsNames));

        await page.evaluate(() => { if (typeof openPaywall === 'function') openPaywall(); });
        await page.waitForTimeout(400);
        const pwNames = await planCardNames(page, '#pwPlanGrid .pw-card-name');
        check('5/6/7. [' + status + '] Paywall does NOT show Free as an option', !pwNames.includes('Free'), JSON.stringify(pwNames));
        check('[' + status + '] Paywall shows exactly the 3 paid plans', JSON.stringify(pwNames) === JSON.stringify(['Starter', 'Creator', 'Professional']), JSON.stringify(pwNames));
      } finally {
        await page.close();
        await deleteTestUser(user.userId);
      }
    }
  }

  // ── 19: existing paid plans completely unchanged (spot-check Starter/Creator/Professional data) ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      const paid = await page.evaluate(() => ({
        starter: { price: ORIVEN_PLANS.starter.price, credits: ORIVEN_PLANS.starter.credits, autopilot: ORIVEN_PLANS.starter.autopilotLimit },
        creator: { price: ORIVEN_PLANS.creator.price, credits: ORIVEN_PLANS.creator.credits, autopilot: ORIVEN_PLANS.creator.autopilotLimit },
        professional: { price: ORIVEN_PLANS.professional.price, credits: ORIVEN_PLANS.professional.credits },
      }));
      check('19. Starter plan unchanged (€9.95, 1000 credits, no Autopilot)', paid.starter.price === 9.95 && paid.starter.credits === 1000 && paid.starter.autopilot == null, JSON.stringify(paid.starter));
      check('19. Creator plan unchanged (€19.95, 2500 credits)', paid.creator.price === 19.95 && paid.creator.credits === 2500, JSON.stringify(paid.creator));
      check('19. Professional plan unchanged (€34.95, 4000 credits)', paid.professional.price === 34.95 && paid.professional.credits === 4000, JSON.stringify(paid.professional));
    } finally {
      await page.close();
    }
  }

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n' + results.length + ' checks run, ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed.');
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
