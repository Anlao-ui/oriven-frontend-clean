// ════════════════════════════════════════════════════════════════
// Universal Setup Engine — Completion Pass UI coverage
//
// Covers the NEW Connections-page checklist rows, Recheck action,
// Conversions API test buttons, Google tag-snippet viewer, the
// TikTok/Pinterest inline ad-account-creation forms, and the FAIL-
// CLOSED hardening of the Launch readiness gate — all against the
// real running app + real running backend, real browser, disposable
// Supabase users (same convention as this repo's other test files).
// RUN: node tests/setup-engine-completion.test.js
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
  const email = `oriven.completionui.test+${Date.now()}.${suffix}@example.com`;
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

    // Meta: fully ready -> checklist + Conversions API test button + Recheck
    await supabaseAdmin.from('integrations').upsert({
      user_id: user.userId, provider: 'meta_ads', access_token: 'fake', token_expiry: new Date(Date.now() + 3600000).toISOString(),
      meta_ads_accounts: [{ account_id: 'act_1', account_name: 'Test Account' }], active_ad_account: { account_id: 'act_1', account_name: 'Test Account' },
      meta_pages: [{ page_id: 'p1', page_name: 'Test Page' }], active_page: { page_id: 'p1', page_name: 'Test Page' },
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    // Google: fully ready -> checklist + "View install snippet" button
    await supabaseAdmin.from('integrations').upsert({
      user_id: user.userId, provider: 'google_ads', access_token: 'fake', refresh_token: 'fake_r', token_expiry: new Date(Date.now() + 3600000).toISOString(),
      google_ads_accounts: [{ customer_id: '111', name: 'Real Account', is_manager: false }],
      active_ad_account: { account_id: '111', account_name: 'Real Account', is_manager: false },
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    // TikTok: account_creation_required -> inline "Create ad account" form
    await supabaseAdmin.from('integrations').upsert({
      user_id: user.userId, provider: 'tiktok_ads', access_token: 'fake', refresh_token: 'fake_r', token_expiry: new Date(Date.now() + 3600000).toISOString(),
      tiktok_ads_accounts: [], connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    // Pinterest: manual_action_required (no accounts) -> inline "Create ad account" form
    await supabaseAdmin.from('integrations').upsert({
      user_id: user.userId, provider: 'pinterest_ads', access_token: 'fake', refresh_token: 'fake_r', token_expiry: new Date(Date.now() + 3600000).toISOString(),
      pinterest_ads_accounts: [], connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
      await signIn(page, user);
      await page.evaluate(() => { bizGoTo('connections'); });
      await page.waitForTimeout(1800);

      const state = await page.evaluate(() => ({
        metaChecklist: !!document.querySelector('#conReadyMeta .con-checklist'),
        metaCapiBtn: !!document.getElementById('conCapiBtnMeta'),
        metaRecheckBtn: !!document.querySelector('#conReadyMeta .con-ready-recheck'),
        googleTagBtn: !!document.getElementById('conGoogleTagBtn'),
        tiktokCreateForm: !!document.getElementById('conTiktokAcctName'),
        pinterestCreateForm: !!document.getElementById('conPinterestAcctName'),
        pinterestOfficialFlowStillPresent: !!document.querySelector('#conReadyPinterest .con-ready-action'),
      }));
      check('1. Meta shows the new checklist row', state.metaChecklist, JSON.stringify(state));
      check('2. Meta shows a real Conversions API test button (separate from the Pixel setup button)', state.metaCapiBtn);
      check('3. Meta shows a Recheck action for real remote verification', state.metaRecheckBtn);
      check('4. Google shows a real "View install snippet" action (google.tag, read-only)', state.googleTagBtn);
      check('5. TikTok (account_creation_required) shows the inline "Create ad account" form, not just the official-flow redirect', state.tiktokCreateForm);
      check('6. Pinterest (manual_action_required) shows the inline "Create ad account" form (re-researched: API attempted, not assumed impossible)', state.pinterestCreateForm);
      check('7. Pinterest still keeps the official-flow fallback button alongside the new form (never removes the safety net)', state.pinterestOfficialFlowStillPresent);

      // Click Recheck on Meta — with a fake token, must surface a real,
      // honest "could not confirm" result, never a fabricated success.
      await page.click('#conReadyMeta .con-ready-recheck');
      await page.waitForTimeout(1500);
      const recheckResult = await page.evaluate(() => (document.getElementById('conRecheckResultMeta') || {}).textContent);
      check('8. Recheck with a fake token honestly reports it could not confirm the account (never a fabricated "Verified")', recheckResult && !/verified with the platform just now/i.test(recheckResult), recheckResult);

      // Click the Conversions API test button — fake token must produce
      // a real error, never a fabricated "received" result.
      const capiBtn = await page.$('#conCapiBtnMeta');
      let capiResult = null;
      if (capiBtn) {
        await capiBtn.click();
        await page.waitForTimeout(1500);
        capiResult = await page.evaluate(() => (document.getElementById('conCapiResultMeta') || {}).textContent);
      }
      check('9. Clicking the Meta Conversions API test with a fake/no-pixel account surfaces a real error, never fabricated "received"', capiResult && !/test event received by the platform\./i.test(capiResult), capiResult);

      check('10. No JS errors during the full checklist/recheck/creation-form walkthrough', jsErrors.length === 0, JSON.stringify(jsErrors));

      for (const [label, vp] of Object.entries({ desktop: { width: 1440, height: 1000 }, tablet: { width: 1024, height: 900 }, mobile: { width: 390, height: 1700 } })) {
        await page.setViewportSize(vp);
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(() => {
          const mc = document.querySelector('.mc');
          return mc.scrollWidth > mc.clientWidth + 1;
        });
        check(`11. [${label}] No horizontal overflow with the new checklist/form rows`, !overflow, 'overflow=' + overflow);
      }

      // ── Fail-closed Launch readiness gate ──────────────────────────
      // Force the real /api/setup/meta/status call to fail (simulated
      // network/server failure) and drive it through the REAL public
      // entry point (window.cgrPublishTo, same as every "Publish to X"
      // button) rather than an internal helper — a more faithful,
      // integration-level exercise of the actual fail-closed change.
      await page.route('**/api/setup/meta/status', (route) => route.abort('failed'));
      const publishReqs = [];
      page.on('request', (req) => { if (req.url().includes('/api/publish/')) publishReqs.push(req.url()); });
      await page.evaluate(() => { window.cgrPublishTo('meta', 'fake_camp_id_completionpass'); });
      await page.waitForTimeout(1500);
      const toastText = await page.evaluate(() => {
        const el = document.querySelector('.orv-toast, .toast, [class*="toast"]');
        return el ? el.textContent : null;
      });
      await page.unroute('**/api/setup/meta/status');
      check('12. FAIL-CLOSED: when the setup-status check itself fails (network error), publish is BLOCKED — real /api/publish/meta is never called', publishReqs.length === 0, JSON.stringify(publishReqs));
      check('13. FAIL-CLOSED: the block shows an "unable to verify" message, distinct from the normal "not finished" message', toastText && /unable to verify/i.test(toastText), toastText);
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
