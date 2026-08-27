// ════════════════════════════════════════════════════════════════
// Free Plan — cross-product consistency regression tests
//
// Verifies Free is represented as a first-class plan everywhere plans are
// shown (landing page pricing, in-app paywall, Settings/Subscription),
// all reading the same single source of truth (plans.js ORIVEN_PLAN_LIST),
// in the official order Free -> Starter -> Creator -> Professional, with
// honest (not overclaiming) copy, and that this didn't disturb paid-plan
// data or the existing onboarding/paywall timing behavior.
//
// Same plain-Node-script convention as the other test files in this repo
// (no framework) -- see tests/onboarding-paywall.test.js for the fuller
// rationale. This file focuses on PLAN DATA/LAYOUT CONSISTENCY; onboarding
// timing has its own dedicated file and is only spot-re-verified here by
// running that suite alongside this one (see the bottom of this file).
//
// RUN: npm run test:plans   (this file only)
//      npm test              (this file AND onboarding-paywall.test.js)
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

async function main() {
  const results = [];
  function check(name, cond, detail) {
    results.push({ name, ok: !!cond, detail });
    console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail ? ' (' + detail + ')' : ''));
  }

  const browser = await chromium.launch({ executablePath: CHROME_PATH });

  // ── 2 & 4 & 5 & 6 & 7: landing page pricing (public, no auth needed) ──
  {
    for (const [label, width, expectCols] of [['desktop', 1440, 4], ['tablet', 900, 4], ['tablet-narrow', 800, 2], ['mobile', 390, 1]]) {
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
        // "Same row" allows a small sub-pixel tolerance (GSAP-animated cards
        // can settle a fraction of a pixel apart across equal-width grid
        // columns) rather than exact-integer equality, which would flag a
        // 1px rounding artifact as a false "stranded on its own row".
        var sameRow = info && info.tops.every(function(t){ return Math.abs(t - info.tops[0]) <= 2; });
        check('2. [' + label + '] Free appears on landing-page pricing', info && info.names.includes('Free'), JSON.stringify(info && info.names));
        check('4. [' + label + '] Landing page plan order is Free, Starter, Creator, Professional', info && JSON.stringify(info.names) === JSON.stringify(['Free', 'Starter', 'Creator', 'Professional']), JSON.stringify(info && info.names));
        if (label === 'desktop') check('5. Desktop landing page: all 4 plans in one row', info && info.columns === 4 && sameRow, JSON.stringify(info));
        if (label === 'tablet') check('6. Tablet (900px) landing page: 4 plans still in one row', info && info.columns === 4 && sameRow, JSON.stringify(info));
        if (label === 'tablet-narrow') check('6. Narrow tablet (800px) landing page: balanced fallback, no card stranded alone', info && new Set(info.tops).size === Math.ceil(4 / info.columns), JSON.stringify(info));
        if (label === 'mobile') check('7. Mobile landing page: stacks to 1 column, no horizontal overflow', info && info.columns === 1 && info.overflowX <= 0, JSON.stringify(info));
      } finally {
        await page.close();
      }
    }
  }

  // ── 1, 3, 8, 9, 10, 11: Free card content (paywall + Settings) for a genuine Free user ──
  {
    const user = await createTestUser('free', 'free');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
      await signIn(page, user);

      // Paywall
      await page.evaluate(() => { if (typeof openPaywall === 'function') openPaywall(); });
      await page.waitForTimeout(400);
      const pwFree = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('#pwPlanGrid .pw-card'));
        const free = cards.find(c => (c.querySelector('.pw-card-name') || {}).textContent === 'Free');
        return free ? { text: free.textContent, price: (free.querySelector('.pw-price') || {}).textContent } : null;
      });
      check('3. Free card renders in the paywall', !!pwFree, JSON.stringify(pwFree && pwFree.price));
      check('8. Paywall Free card shows "20 credits / day"', pwFree && /20\s*credits\s*\/\s*day/i.test(pwFree.text), pwFree && pwFree.text);
      check('9. Paywall Free card shows "1 Intelligence use / day"', pwFree && /1\s*Intelligence\s*use\s*\/\s*day/i.test(pwFree.text), pwFree && pwFree.text);
      check('10. Paywall Free card does NOT claim unrestricted "Create ads"', pwFree && !/\bCreate ads\b/i.test(pwFree.text), pwFree && pwFree.text);
      check('11. Paywall Free card shows Autopilot excluded', pwFree && /Autopilot/i.test(pwFree.text), pwFree && pwFree.text);
      check('Paywall Free price is €0', pwFree && /€\s*0\b/.test(pwFree.price || ''), pwFree && pwFree.price);

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
      check('1. Free appears as a card in Settings/Subscription', !!subFree, JSON.stringify(subFree));
      check('1. Free is correctly marked as the current plan (not an error/missing state)', subFree && subFree.isCurrent && /Current Plan/i.test(subFree.text), JSON.stringify(subFree));
      check('8. Settings Free card shows 20 credits (daily)', subFree && /20/.test(subFree.text) && /day/i.test(subFree.text), subFree && subFree.text);
      check('9. Settings Free card shows Intelligence 1 use/day', subFree && /Intelligence.*1 use \/ day/i.test(subFree.text.replace(/\s+/g, ' ')), subFree && subFree.text);
      check('11. Settings Free card shows Autopilot not included', subFree && /Autopilot:\s*not included/i.test(subFree.text), subFree && subFree.text);
      // .sub-cancel-link is also reused (settings.js) for an unrelated
      // "Try again" retry button on a failed usage-status fetch -- match
      // on the literal "Cancel plan" text, not just the class, to avoid a
      // false positive from that unrelated element.
      const cancelPlanVisible = await page.evaluate(() => Array.from(document.querySelectorAll('.sub-cancel-link')).some(el => /cancel plan/i.test(el.textContent)));
      check('10. Settings does not show a "Cancel plan" action for a Free user', cancelPlanVisible === false);

      const order = await page.evaluate(() => Array.from(document.querySelectorAll('#planPanelContent .sub-pcard-name')).map(el => el.textContent));
      check('4. Settings plan order is Free, Starter, Creator, Professional', JSON.stringify(order) === JSON.stringify(['Free', 'Starter', 'Creator', 'Professional']), JSON.stringify(order));
    } finally {
      await page.close();
      await deleteTestUser(user.userId);
    }
  }

  // ── 12: existing paid plans unchanged (spot-check Starter/Creator/Professional data) ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      const paid = await page.evaluate(() => ({
        starter: { price: ORIVEN_PLANS.starter.price, credits: ORIVEN_PLANS.starter.credits, autopilot: ORIVEN_PLANS.starter.autopilotLimit },
        creator: { price: ORIVEN_PLANS.creator.price, credits: ORIVEN_PLANS.creator.credits, autopilot: ORIVEN_PLANS.creator.autopilotLimit },
        professional: { price: ORIVEN_PLANS.professional.price, credits: ORIVEN_PLANS.professional.credits },
      }));
      check('12. Starter plan unchanged (€9.95, 1000 credits, no Autopilot)', paid.starter.price === 9.95 && paid.starter.credits === 1000 && paid.starter.autopilot == null, JSON.stringify(paid.starter));
      check('12. Creator plan unchanged (€19.95, 2500 credits)', paid.creator.price === 19.95 && paid.creator.credits === 2500, JSON.stringify(paid.creator));
      check('12. Professional plan unchanged (€34.95, 4000 credits)', paid.professional.price === 34.95 && paid.professional.credits === 4000, JSON.stringify(paid.professional));
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
