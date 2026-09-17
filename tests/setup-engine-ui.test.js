// ════════════════════════════════════════════════════════════════
// Universal Setup Engine — Connections UI readiness coverage
//
// Covers the NEW readiness row added to each Connections card
// (Phase 7): real per-platform state fetched from /api/setup/status,
// plain-language status copy, the correct action per state (official-
// flow "Continue to X" vs. an ORIVEN-can-do-this tracking-setup
// button vs. TikTok's test-event sender), and that clicking a
// tracking-setup action makes a REAL request and surfaces a REAL
// result — never a fabricated success — exactly like the backend
// route tests in oriven-backand-clean/server/tests/setup-tracking-
// routes.test.js, just exercised through the actual UI this time.
//
// Only tests ORIVEN's own behavior around external flows (spec:
// "Only test ORIVEN's own behavior around the external flow") — the
// officialFlow "Continue to X" buttons are checked for correct
// href/target/label, never for what happens after the click opens a
// real platform's site.
//
// Same disposable-Supabase-user + Playwright convention as this
// repo's other test files.
// RUN: node tests/setup-engine-ui.test.js
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
  const email = `oriven.setupui.test+${Date.now()}.${suffix}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'creator', onboarding_completed: true }, { onConflict: 'id' });
  return { userId, email, password };
}

async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('integrations').delete().eq('user_id', userId); } catch (_) {}
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

    // Meta: fully ready -> "Ready to advertise" + "Set up Meta Pixel"
    await supabaseAdmin.from('integrations').upsert({
      user_id: user.userId, provider: 'meta_ads', access_token: 'fake', token_expiry: new Date(Date.now() + 3600000).toISOString(),
      meta_ads_accounts: [{ account_id: 'act_1', account_name: 'Test Account' }],
      active_ad_account: { account_id: 'act_1', account_name: 'Test Account' },
      meta_pages: [{ page_id: 'p1', page_name: 'Test Page' }], active_page: { page_id: 'p1', page_name: 'Test Page' },
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    // Google: manager-only -> "Ad account setup needed" + "Continue to Google Ads"
    await supabaseAdmin.from('integrations').upsert({
      user_id: user.userId, provider: 'google_ads', access_token: 'fake', refresh_token: 'fake_r', token_expiry: new Date(Date.now() + 3600000).toISOString(),
      google_ads_accounts: [{ customer_id: '111', name: 'My MCC', is_manager: true }],
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    // Pinterest: no accounts -> "Setup required on the platform" + "Continue to Pinterest"
    await supabaseAdmin.from('integrations').upsert({
      user_id: user.userId, provider: 'pinterest_ads', access_token: 'fake', refresh_token: 'fake_r', token_expiry: new Date(Date.now() + 3600000).toISOString(),
      pinterest_ads_accounts: [], connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    // TikTok: fully ready -> pixel code input + "Send test event"
    await supabaseAdmin.from('integrations').upsert({
      user_id: user.userId, provider: 'tiktok_ads', access_token: 'fake', refresh_token: 'fake_r', token_expiry: new Date(Date.now() + 3600000).toISOString(),
      tiktok_ads_accounts: [{ account_id: 'adv_1', account_name: 'Test' }],
      active_ad_account: { account_id: 'adv_1', account_name: 'Test' },
      active_identity: { identity_id: 'id_1', display_name: 'Test Identity' },
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
      await signIn(page, user);
      await page.evaluate(() => { bizGoTo('connections'); });
      await page.waitForTimeout(1800);

      const state = await page.evaluate(() => ({
        metaStatus: (document.querySelector('#conReadyMeta .con-ready-status') || {}).textContent,
        metaHasTrackBtn: !!document.getElementById('conTrackBtnMeta'),
        googleStatus: (document.querySelector('#conReadyGoogle .con-ready-status') || {}).textContent,
        googleHasOfficialFlowBtn: !!document.querySelector('#conReadyGoogle .con-ready-action'),
        pinterestStatus: (document.querySelector('#conReadyPinterest .con-ready-status') || {}).textContent,
        tiktokStatus: (document.querySelector('#conReadyTiktok .con-ready-status') || {}).textContent,
        tiktokHasInput: !!document.getElementById('conTiktokPixelCode'),
      }));
      check('1. Meta shows "Ready to advertise" for a fully set up connection', /ready to advertise/i.test(state.metaStatus || ''), state.metaStatus);
      check('2. Meta shows a real "Set up Meta Pixel" action (not a bare "Create" claim)', state.metaHasTrackBtn, JSON.stringify(state.metaHasTrackBtn));
      // UX + Reliability Overhaul: state-copy wording was deliberately
      // updated to match the new primary-status hierarchy (spec:
      // "Setup incomplete" / "Action required" as the standard secondary
      // statuses) — these two checks were updated to match, not relaxed.
      check('3. Google (manager-only) shows "Setup incomplete"', /setup incomplete/i.test(state.googleStatus || ''), state.googleStatus);
      check('4. Google shows a "Continue to X" official-flow action, not a fake "Create" button', state.googleHasOfficialFlowBtn, JSON.stringify(state.googleHasOfficialFlowBtn));
      check('5. Pinterest (no accounts) shows "Action required" — never claims API-first account creation', /action required/i.test(state.pinterestStatus || ''), state.pinterestStatus);
      check('6. TikTok shows "Ready to advertise" and a real pixel-code input (not a fake auto-discovered pixel)', /ready to advertise/i.test(state.tiktokStatus || '') && state.tiktokHasInput, JSON.stringify(state));

      // Verify the Google/Pinterest "Continue to X" buttons carry the
      // real official flow URL from the registry (server-supplied),
      // not a hardcoded or invented one.
      const flowUrls = await page.evaluate(() => {
        const btn = document.querySelector('#conReadyGoogle .con-ready-action');
        return btn ? btn.getAttribute('onclick') : null;
      });
      check('7. Google\'s "Continue to Google Ads" action targets a real ads.google.com URL', flowUrls && /ads\.google\.com/.test(flowUrls), flowUrls);

      // Click Meta's real "Set up Meta Pixel" action — with a fake
      // token, Meta must honestly reject it; the UI must surface that
      // real rejection, never claim success.
      const metaBtn = await page.$('#conTrackBtnMeta');
      let metaClickResult = null;
      if (metaBtn) {
        await metaBtn.click();
        await page.waitForTimeout(1500);
        metaClickResult = await page.evaluate(() => (document.getElementById('conTrackResultMeta') || {}).textContent);
      }
      check('8. Clicking "Set up Meta Pixel" with an invalid token surfaces a real error, never a fabricated success', metaClickResult && !/created|already set up/i.test(metaClickResult), metaClickResult);

      check('9. No JS errors during the full Connections readiness walkthrough', jsErrors.length === 0, JSON.stringify(jsErrors));

      // Responsive — no horizontal overflow with the new readiness rows added
      for (const [label, vp] of Object.entries({ desktop: { width: 1440, height: 1000 }, tablet: { width: 1024, height: 900 }, mobile: { width: 390, height: 1600 } })) {
        await page.setViewportSize(vp);
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(() => {
          const mc = document.querySelector('.mc');
          return mc.scrollWidth > mc.clientWidth + 1;
        });
        check(`10. [${label}] No horizontal overflow with the new readiness rows`, !overflow, 'overflow=' + overflow);
      }
    } finally {
      await page.close();
    }
  } finally {
    if (user) await deleteTestUser(user.userId);
    await browser.close();
  }

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch(e => { console.error('CRASH:', e); process.exit(1); });
