// ════════════════════════════════════════════════════════════════
// Onboarding Business section — "Products" popup removal regression
//
// The Business section of the onboarding tour (majorStep 7) used to
// include a frame targeting '.prf-ptab[data-tab="products"]' -- a tab
// that had already been removed from the Business page's DOM (only
// overview/business/market/brand/connections/memory remain). Because
// its target selector matched nothing, _obRender() fell through to the
// full-screen #ob-backdrop centered popup with no highlighted element,
// which is exactly the obsolete "Products" popup the user reported.
//
// Fixed by deleting that one frame object from _OB_FRAMES (auth.js).
// This file proves it's gone and that the remaining Business sequence
// flows cleanly: Business -> Your Company -> Market -> Brand ->
// Connections -> Memory, with no other frame/step disturbed.
//
// Same plain-Node-script convention as this repo's other test files.
// RUN: npm run test:business-section
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
  const email = `oriven.bizsection.test+${Date.now()}.${suffix || 'a'}@example.com`;
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

async function main() {
  const results = [];
  function check(name, cond, detail) {
    results.push({ name, ok: !!cond, detail });
    console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail ? ' (' + detail + ')' : ''));
  }

  const user = await createTestUser('flow');
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
    await signIn(page, user);

    const frameInfo = await page.evaluate(() => {
      if (typeof _OB_FRAMES === 'undefined') return null;
      const business = _OB_FRAMES.filter(f => f.majorStep === 7);
      return {
        totalFrames: _OB_FRAMES.length,
        businessFrames: business.map(f => ({ selector: f.selector, titleKey: f.titleKey })),
        hasProductsFrame: _OB_FRAMES.some(f =>
          (f.selector && f.selector.indexOf('data-tab="products"') !== -1) ||
          f.titleKey === 'bizTabProducts'
        ),
        majorStepTotal: (typeof _OB_MAJOR_TOTAL !== 'undefined') ? _OB_MAJOR_TOTAL : null,
      };
    });

    // ── 1. The obsolete Products frame is completely gone from _OB_FRAMES ──
    check('1. No onboarding frame targets the removed Products tab', frameInfo && !frameInfo.hasProductsFrame, JSON.stringify(frameInfo && frameInfo.hasProductsFrame));

    // ── 2. The Business section's remaining sequence is exactly the 7
    // expected sub-frames in order, with Market immediately following
    // Business (no gap/backdrop frame left behind where Products was). ──
    const expectedTabOrder = ['obBusinessTitle', 'bizTabOverview', 'bizTabBusiness', 'bizTabMarket', 'bizTabBrand', 'bizTabConnections', 'bizTabMemory'];
    const actualTabOrder = frameInfo ? frameInfo.businessFrames.map(f => f.titleKey) : [];
    check('2. Business section flows Business → Your Company → Market → Brand → Connections → Memory, no gap',
      JSON.stringify(actualTabOrder) === JSON.stringify(expectedTabOrder),
      JSON.stringify(actualTabOrder));

    // ── 3. majorStep total (10, shown as "Step X of 10") is untouched —
    // removing one frame inside an existing majorStep must not renumber
    // the visible step count. ──────────────────────────────────────────
    check('3. Total onboarding step count (_OB_MAJOR_TOTAL) is unchanged at 10', frameInfo && frameInfo.majorStepTotal === 10, String(frameInfo && frameInfo.majorStepTotal));

    // ── 4. Live walkthrough: stepping through every Business-section frame
    // never shows the centered full-screen backdrop with no real target
    // (the actual symptom the user reported) — each frame's own selector
    // must resolve to a real, currently-visible element. ────────────────
    let anyOrphaned = false;
    const orphanedFrames = [];
    for (const f of frameInfo.businessFrames) {
      // First frame targets the sidebar nav item itself; the rest are
      // .prf-ptab sub-tabs, reachable only via the frame's own onEnter
      // navigation, which obGoTo triggers internally.
      const idx = await page.evaluate((sel) => _OB_FRAMES.findIndex(f => f.selector === sel) + 1, f.selector);
      await page.evaluate((n) => { if (typeof obGoTo === 'function') obGoTo(n); }, idx);
      await page.waitForTimeout(300);
      const resolved = await page.evaluate((sel) => !!document.querySelector(sel), f.selector);
      if (!resolved) { anyOrphaned = true; orphanedFrames.push(f.selector); }
    }
    check('4. Every Business-section frame selector resolves to a real, live DOM element (no orphaned/backdrop frames)', !anyOrphaned, JSON.stringify(orphanedFrames));

  } finally {
    await page.close();
    await browser.close();
    await deleteTestUser(user.userId);
  }

  const failed = results.filter(r => !r.ok);
  console.log('\n' + results.length + ' checks run, ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed.');
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
