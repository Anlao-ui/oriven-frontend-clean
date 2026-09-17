// ════════════════════════════════════════════════════════════════
// Autopilot nav icon — settle-after-click-animation bug fix
//
// Reported bug: the Autopilot lightning-bolt nav icon could remain
// visually enlarged after its hover/click "energize" animation
// (@keyframes orv-ni-bolt-pulse, styles.css) finished. It is the ONLY
// animated nav icon whose keyframes change SIZE (scale 1 -> 1.18 -> 1) —
// every other icon only rotates (Campaigns/Intelligence clock) or
// changes opacity (Business bulb), so an ambiguous animation-to-base
// handoff is invisible there but visible here.
//
// Root cause: the base `.orv-ni svg` rule only declares a `transition`
// on transform (no animation), and the Autopilot hover rule only set
// `animation` with the implicit default fill-mode (`none`) and no
// explicit resting `transform` on the non-hover selector for that
// transition to target. Clicking navigates away while the cursor is
// still over the icon (the exact real-world trigger — the mouse doesn't
// move during an in-app navigation), which can interrupt the animation
// mid-flight; with no unambiguous rest value declared, the handoff back
// to "not animating" was left to each browser's own implicit behavior.
//
// Fix (styles.css, `.orv-ni[data-orv-page="autopilot"]`): an explicit
// `transform: scale(1)` rest rule plus `animation-fill-mode: forwards`
// on the hover keyframe, so the end-of-animation value is always
// explicit and matches the declared rest value exactly, whether the
// animation completes naturally or is interrupted by navigation.
//
// This file measures the icon's real getBoundingClientRect() SIZE
// (nav-icon-alignment.test.js already covers horizontal center-drift
// for every icon, but not size) after real click-driven navigation
// across every scenario the bug report named.
//
// RUN: node tests/autopilot-nav-icon-settle.test.js
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

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const email = `oriven.apnavicon.test+${Date.now()}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'professional', onboarding_completed: true }, { onConflict: 'id' });

  const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: signInData } = await authClient.auth.signInWithPassword({ email, password });
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
  await page.evaluate(async () => { const { data: { user } } = await window.SB.auth.getUser(); window._currentUser = user; if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user); if (typeof _loadUserProfile === 'function') await _loadUserProfile(user); });
  await page.waitForTimeout(900);

  const SEL = '#orvSidebar .orv-ni[data-orv-page="autopilot"]';
  await page.waitForSelector(SEL);
  const restBox = await page.evaluate((sel) => {
    const svg = document.querySelector(sel + ' svg');
    const r = svg.getBoundingClientRect();
    return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 };
  }, SEL);
  check('Baseline icon size measured', restBox.w > 0 && restBox.h > 0, restBox);

  async function measureAfter(label) {
    // Past the 380ms animation plus its own 180ms transition settle.
    await page.waitForTimeout(700);
    const box = await page.evaluate((sel) => {
      const svg = document.querySelector(sel + ' svg');
      const r = svg.getBoundingClientRect();
      return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 };
    }, SEL);
    const driftW = Math.round(Math.abs(box.w - restBox.w) * 100) / 100;
    const driftH = Math.round(Math.abs(box.h - restBox.h) * 100) / 100;
    check(label, driftW < 0.5 && driftH < 0.5, { restBox, box, driftW, driftH });
  }

  // Scenario: Create -> hover+click Autopilot
  await page.evaluate(() => { _orvNav('create', 'page-create'); });
  await page.waitForTimeout(300);
  await page.hover(SEL);
  await page.click(SEL);
  await measureAfter('Create -> Autopilot: icon settles back to rest size');

  // Scenario: Research -> Autopilot
  await page.evaluate(() => { _orvNav('research', 'page-research'); });
  await page.waitForTimeout(300);
  await page.hover(SEL);
  await page.click(SEL);
  await measureAfter('Research -> Autopilot: icon settles back to rest size');

  // Scenario: Business -> Autopilot
  await page.evaluate(() => { _orvNav('businessbrain', 'page-business-brain'); });
  await page.waitForTimeout(300);
  await page.hover(SEL);
  await page.click(SEL);
  await measureAfter('Business -> Autopilot: icon settles back to rest size');

  // Scenario: Autopilot -> another page -> Autopilot (already on Autopilot from previous step)
  await page.hover('.orv-ni[data-orv-page="create"]');
  await page.click('#orvSidebar .orv-ni[data-orv-page="create"]');
  await page.waitForTimeout(300);
  await page.hover(SEL);
  await page.click(SEL);
  await measureAfter('Autopilot -> another page -> Autopilot: icon settles back to rest size');

  // Scenario: rapid repeated clicks (interrupts the animation mid-flight
  // on every click but the last -- the real-world "stuck" trigger).
  for (let i = 0; i < 6; i++) {
    await page.hover(SEL);
    await page.click(SEL);
    await page.waitForTimeout(70); // well inside the 380ms animation
  }
  await measureAfter('Rapid repeated clicks: icon settles back to rest size');

  const failed = results.filter(r => !r.ok).length;
  console.log('\n=== AUTOPILOT NAV ICON SETTLE: ' + (results.length - failed) + '/' + results.length + ' passed ===');
  if (failed) console.log('FAILURES: ' + results.filter(r => !r.ok).map(r => r.name).join('; '));

  await deleteTestUser();
  await browser.close();
  process.exitCode = failed ? 1 : 0;

  async function deleteTestUser() { try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {} }
}
main().catch(e => { console.error(e); process.exit(1); });
