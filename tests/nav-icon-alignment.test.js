// ════════════════════════════════════════════════════════════════
// Navbar icon alignment — UX polish pass
//
// Root cause (confirmed by direct CSS inspection + live measurement):
// `body.dark-mode .orv-ni:hover svg { transform: translateX(1.5px); }`
// was a leftover hover-nudge rule from before the per-icon Icon Motion
// System existed. Each animated icon's own one-shot keyframe `animation`
// correctly outranks it WHILE playing, but none of the animations set
// `animation-fill-mode: forwards`, so the instant each animation finished
// (usually while the cursor was still over the ~15px icon), the element's
// `transform` fell back to that rule and snapped 1.5px right for the
// rest of the hover — read by the user as "the icon shifted right after
// the animation ran." The rule has been removed entirely (styles.css).
//
// This file verifies, with real getBoundingClientRect() measurements
// (not just CSS source reading), that every real navbar icon's visual
// center is stable before/after its own hover animation completes, for
// every one of ORIVEN's six primary nav items plus the two utility
// items (Add Platforms, Settings) the user reported as already stable.
//
// RUN: node tests/nav-icon-alignment.test.js
// ════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const BASE_URL = process.env.TEST_FRONTEND_URL || 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH
  || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond });
  console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail !== undefined ? ' (' + JSON.stringify(detail) + ')' : ''));
}

async function createTestUser() {
  const email = `oriven.navicon.test+${Date.now()}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await supabaseAdmin.from('profiles').upsert({ id: created.user.id, email, subscription_status: 'creator', onboarding_completed: true }, { onConflict: 'id' });
  return { userId: created.user.id, email, password };
}
async function deleteTestUser(userId) {
  try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
}
async function signIn(page, user) {
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: signInData, error } = await authClient.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
  await page.evaluate(async () => {
    const { data: { user } } = await window.SB.auth.getUser();
    window._currentUser = user;
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user);
    if (typeof _loadUserProfile === 'function') await _loadUserProfile(user);
  });
  await page.waitForTimeout(900);
}

// Items with a real one-shot keyframe `animation` on hover — wait
// comfortably past the longest (Business's 820ms bulb sequence) before
// measuring "after animation" position.
const NAV_ITEMS = [
  { label: 'Create',      selector: '.orv-ni[data-orv-page="create"]',       iconSelector: '.orv-ni-ic svg' },
  { label: 'Research',    selector: '.orv-ni[data-orv-page="research"]',     iconSelector: 'svg' },
  { label: 'Launch',      selector: '.orv-ni[data-orv-page="launch"]',       iconSelector: '.orv-ni-ic svg' },
  { label: 'Campaigns',   selector: '.orv-ni[data-orv-page="performance"]',  iconSelector: 'svg' },
  { label: 'Autopilot',   selector: '.orv-ni[data-orv-page="autopilot"]',    iconSelector: 'svg' },
  { label: 'Business',    selector: '.orv-ni[data-orv-page="businessbrain"]', iconSelector: 'svg' },
  { label: 'Add Platforms', selector: '#orvLauncherBtn',                    iconSelector: '.orv-launcher-dots' },
  { label: 'Settings',    selector: '#orvNavSettingsBtn',                   iconSelector: 'svg' },
];

async function measureCenter(page, selector, iconSelector) {
  return page.evaluate(({ selector, iconSelector }) => {
    const btn = document.querySelector(selector);
    const icon = btn && btn.querySelector(iconSelector);
    if (!btn || !icon) return null;
    const br = btn.getBoundingClientRect();
    const ir = icon.getBoundingClientRect();
    return {
      btnW: Math.round(br.width), btnH: Math.round(br.height),
      iconCx: ir.left + ir.width / 2, iconCy: ir.top + ir.height / 2,
    };
  }, { selector, iconSelector });
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let user;
  try {
    user = await createTestUser();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
    await signIn(page, user);
    await page.waitForTimeout(500);

    const navRect = await page.evaluate(() => {
      const nav = document.querySelector('.orv-sb, nav.orv-nav, .orv-sb-nav') || document.querySelector('.orv-ni').closest('nav') || document.body;
      return nav.getBoundingClientRect();
    });

    for (const item of NAV_ITEMS) {
      const exists = await page.$(item.selector);
      if (!exists) { check(`${item.label} nav item exists`, false); continue; }

      const before = await measureCenter(page, item.selector, item.iconSelector);
      check(`${item.label} icon found and measurable at rest`, !!before, before);
      if (!before) continue;

      await page.hover(item.selector);
      // 1. Mid-animation sample (feasible only for items with a real
      //    keyframe running) — position may legitimately differ here,
      //    just confirming no crash/measurement failure mid-flight.
      await page.waitForTimeout(150);
      const mid = await measureCenter(page, item.selector, item.iconSelector);
      check(`${item.label} icon still measurable mid-hover/animation`, !!mid, mid);

      // 2. After the animation has fully completed (>820ms, the longest
      //    one-shot sequence) while still hovering — this is exactly the
      //    moment the old bug manifested.
      await page.waitForTimeout(750);
      const afterAnim = await measureCenter(page, item.selector, item.iconSelector);
      const driftAfterAnim = afterAnim ? Math.abs(afterAnim.iconCx - before.iconCx) : Infinity;
      check(`${item.label} icon center-X stable after its hover animation completes (still hovering)`, driftAfterAnim < 0.6, { before: before.iconCx, afterAnim: afterAnim && afterAnim.iconCx, driftAfterAnim });

      // 3. After hover-out — must return exactly to rest position.
      await page.mouse.move(5, 5);
      await page.waitForTimeout(400);
      const after = await measureCenter(page, item.selector, item.iconSelector);
      const drift = after ? Math.abs(after.iconCx - before.iconCx) : Infinity;
      check(`${item.label} icon returns to its exact rest center-X after hover-out`, drift < 0.6, { before: before.iconCx, after: after && after.iconCx, drift });

      // 4. Wrapper/button box itself never resizes from hover.
      check(`${item.label} button box unchanged by hover (no width/height drift)`, before.btnW === after.btnW && before.btnH === after.btnH, { before: { w: before.btnW, h: before.btnH }, after: after && { w: after.btnW, h: after.btnH } });
    }

    // No overall navbar horizontal layout drift caused by any hover.
    const navRectAfter = await page.evaluate(() => {
      const nav = document.querySelector('.orv-sb, nav.orv-nav, .orv-sb-nav') || document.querySelector('.orv-ni').closest('nav') || document.body;
      return nav.getBoundingClientRect();
    });
    check('No navbar horizontal layout drift across the whole walkthrough', Math.abs(navRect.width - navRectAfter.width) < 0.6 && Math.abs(navRect.left - navRectAfter.left) < 0.6, { before: navRect, after: navRectAfter });

    check('No JS errors during the full navbar hover walkthrough', jsErrors.length === 0, jsErrors);
    await page.close();
  } finally {
    if (user) await deleteTestUser(user.userId);
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
