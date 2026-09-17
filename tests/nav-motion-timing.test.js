// ════════════════════════════════════════════════════════════════
// Navigation — Icon Motion Timing (Small Final Create Fix + Nav
// Motion Polish pass)
//
// Covers: the six real product nav icons (Create, Research, Launch,
// Campaigns, Autopilot, Business) now animate ~15-30% slower than
// their previous durations; Settings and the nine-dot/Add Platforms
// control are byte-for-byte unchanged; and — most importantly — no
// nav icon drifts horizontally before/during/after its animation,
// preserving the previously-fixed 0.0px center-X alignment bug.
//
// RUN: node tests/nav-motion-timing.test.js
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

async function createTestUser() {
  const email = `oriven.navtiming.test+${Date.now()}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'creator', onboarding_completed: true }, { onConflict: 'id' });
  return { userId, email, password };
}
async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('profiles').delete().eq('id', userId); } catch (_) {}
  try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
}

// Expected NEW durations (ms) — see styles.css "Nav Motion Timing pass"
// comments for the exact old -> new value and rationale per icon.
const EXPECTED = {
  create: 740,       // was 620
  research: 420,     // was 340
  launch: 740,       // was 620
  performance: 220,  // was 180 (Campaigns)
  autopilot: 380,    // was 300
  businessbrain: 980 // was 820 (Business)
};
const OLD = { create: 620, research: 340, launch: 620, performance: 180, autopilot: 300, businessbrain: 820 };

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let user;
  try {
    user = await createTestUser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('oriven_settings', JSON.stringify({ theme: 'dark' })));
    await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
    const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: signInData } = await authClient.auth.signInWithPassword({ email: user.email, password: user.password });
    await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); },
      { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
    await page.evaluate(async () => {
      const { data: { user } } = await window.SB.auth.getUser();
      window._currentUser = user;
      if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user);
      if (typeof _loadUserProfile === 'function') await _loadUserProfile(user);
    });
    await page.waitForTimeout(1200);

    async function measureCenterX(selector) {
      return page.evaluate((sel) => {
        const btn = document.querySelector(sel);
        const svg = btn.querySelector('svg') || btn.querySelector('.orv-launcher-dots');
        const r = svg.getBoundingClientRect();
        return r.left + r.width / 2;
      }, selector);
    }
    async function getAnimDurations(selector) {
      return page.evaluate((sel) => {
        const btn = document.querySelector(sel);
        let target = btn.querySelector('.orv-ni-ic svg') || btn.querySelector('svg') || btn.querySelector('.orv-launcher-dots i');
        if (!target) return [];
        return target.getAnimations({ subtree: true }).map((a) => a.effect.getTiming().duration);
      }, selector);
    }

    // 1-6: the six real product icons animate slower than before, and
    // center-X stays perfectly stable before/mid/after the animation.
    const productIcons = [
      { key: 'create', label: 'Create', selector: '.orv-sb .orv-ni[data-orv-page="create"]' },
      { key: 'research', label: 'Research', selector: '.orv-sb .orv-ni[data-orv-page="research"]' },
      { key: 'launch', label: 'Launch', selector: '.orv-sb .orv-ni[data-orv-page="launch"]' },
      { key: 'performance', label: 'Campaigns', selector: '.orv-sb .orv-ni[data-orv-page="performance"]' },
      { key: 'autopilot', label: 'Autopilot', selector: '.orv-sb .orv-ni[data-orv-page="autopilot"]' },
      { key: 'businessbrain', label: 'Business', selector: '.orv-sb .orv-ni[data-orv-page="businessbrain"]' },
    ];

    for (const icon of productIcons) {
      const beforeX = await measureCenterX(icon.selector);
      const btn = await page.$(icon.selector);
      await btn.hover();
      const midX = await measureCenterX(icon.selector);
      const durations = await getAnimDurations(icon.selector);
      const relevantDuration = durations.find((d) => d === EXPECTED[icon.key]);
      await page.waitForTimeout(Math.max(...durations, 200) + 150);
      const afterX = await measureCenterX(icon.selector);
      await page.mouse.move(700, 700);
      await page.waitForTimeout(120);

      check(
        `${icon.label} icon animation is slower than before (expected ${EXPECTED[icon.key]}ms, was ${OLD[icon.key]}ms)`,
        relevantDuration === EXPECTED[icon.key],
        { durations, expected: EXPECTED[icon.key] }
      );
      const drift = Math.max(Math.abs(midX - beforeX), Math.abs(afterX - beforeX));
      check(`${icon.label} icon center-X drift is 0.0px before/mid/after animation`, drift === 0, { beforeX, midX, afterX, drift });
    }

    // 7. Settings timing unchanged (still the shared 160ms base transition,
    // never touched by this pass).
    {
      const beforeX = await measureCenterX('#orvNavSettingsBtn');
      const btn = await page.$('#orvNavSettingsBtn');
      await btn.hover();
      const durations = await getAnimDurations('#orvNavSettingsBtn');
      await page.waitForTimeout(300);
      const afterX = await measureCenterX('#orvNavSettingsBtn');
      await page.mouse.move(700, 700);
      await page.waitForTimeout(120);
      check('Settings timing is unchanged (no 220/380/420/740/980ms duration introduced)', !durations.some((d) => Object.values(EXPECTED).includes(d)), durations);
      check('Settings icon center-X drift is 0.0px', afterX === beforeX, { beforeX, afterX });
    }

    // 8. Nine-dot / Add Platforms timing unchanged (still its own
    // independent 1600ms orv-launcher-converge animation).
    {
      const beforeX = await measureCenterX('#orvLauncherBtn');
      const btn = await page.$('#orvLauncherBtn');
      await btn.hover();
      const durations = await getAnimDurations('#orvLauncherBtn');
      await page.waitForTimeout(300);
      const afterX = await measureCenterX('#orvLauncherBtn');
      await page.mouse.move(700, 700);
      await page.waitForTimeout(120);
      check('Add Platforms (nine-dot) timing is unchanged (still 1600ms)', durations.includes(1600), durations);
      check('Add Platforms icon center-X drift is 0.0px', afterX === beforeX, { beforeX, afterX });
    }

    check('No JS errors during the full nav motion timing walkthrough', errors.length === 0, errors);

    const failed = results.filter((r) => !r.ok);
    console.log('\n' + results.length + ' checks run, ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed.');
    await page.close();
    process.exit(failed.length ? 1 : 0);
  } finally {
    if (user) await deleteTestUser(user.userId);
    await browser.close();
  }
}
main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
