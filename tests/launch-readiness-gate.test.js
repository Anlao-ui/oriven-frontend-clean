// ════════════════════════════════════════════════════════════════
// Universal Setup Engine — Launch-readiness gate coverage
//
// Covers the Phase 8 "INTEGRATION WITH LAUNCH" requirement:
// window.cgrPublishTo must consult real setup-readiness state
// (via _orvCheckSetupReadyBeforePublish, GET /api/setup/:platform/status)
// BEFORE ever calling the real POST /api/publish/:platform route.
//
//   - Not-ready platform (no integration row at all -> not_started,
//     a genuinely blocking state): the real publish request must
//     NEVER be sent, and the user must see a real, specific message
//     naming the platform and pointing at Connections — never a
//     cryptic API error from a doomed publish attempt.
//   - Ready platform (auth + account + platform-specific asset all
//     present -> ready/ready_limited_verification): the gate must
//     NOT block — _cgrPublishToConfirmed must run and the real
//     POST /api/publish/:platform request must fire exactly as
//     before this change (fails downstream for unrelated reasons —
//     a fake token/campaign id — which is out of scope here; this
//     test only proves the readiness gate itself does not block it).
//
// Same disposable-Supabase-user + Playwright convention as this
// repo's other test files.
// RUN: node tests/launch-readiness-gate.test.js
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
  const email = `oriven.launchgate.test+${Date.now()}.${suffix}@example.com`;
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

async function signInAndOpen(browser, user) {
  const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: signInData, error } = await authClient.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
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
  return page;
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let notReadyUser, readyUser;
  try {
    // --- Scenario 1: Meta not connected at all -> not_started, must block ---
    notReadyUser = await createTestUser('notready');
    const page1 = await signInAndOpen(browser, notReadyUser);
    const publishReqs1 = [];
    page1.on('request', req => { if (req.url().includes('/api/publish/')) publishReqs1.push(req.url()); });
    await page1.evaluate(() => { window.cgrPublishTo('meta', 'fake_camp_id_123'); });
    await page1.waitForTimeout(1500);
    check('1. Not-ready platform: real /api/publish/meta is never called', publishReqs1.length === 0, JSON.stringify(publishReqs1));
    const toastText = await page1.evaluate(() => {
      const el = document.querySelector('.orv-toast, .toast, [class*="toast"]');
      return el ? el.textContent : null;
    });
    check('2. Not-ready platform: a specific, platform-named message is shown (not a cryptic API error)', /meta ads/i.test(toastText || '') && /connections/i.test(toastText || ''), toastText);
    await page1.close();

    // --- Scenario 2: Meta fully ready -> gate must not block the real publish call ---
    readyUser = await createTestUser('ready');
    await supabaseAdmin.from('integrations').upsert({
      user_id: readyUser.userId, provider: 'meta_ads', access_token: 'fake', token_expiry: new Date(Date.now() + 3600000).toISOString(),
      meta_ads_accounts: [{ account_id: 'act_1', account_name: 'Test Account' }],
      active_ad_account: { account_id: 'act_1', account_name: 'Test Account' },
      meta_pages: [{ page_id: 'p1', page_name: 'Test Page' }],
      active_page: { page_id: 'p1', page_name: 'Test Page' },
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });
    const page2 = await signInAndOpen(browser, readyUser);
    const publishReqs2 = [];
    page2.on('request', req => { if (req.url().includes('/api/publish/')) publishReqs2.push(req.url()); });
    await page2.evaluate(() => { window.cgrPublishTo('meta', 'fake_camp_id_123'); });
    await page2.waitForTimeout(1500);
    check('3. Ready platform: readiness gate does not block — real /api/publish/meta is called', publishReqs2.some(u => u.endsWith('/api/publish/meta')), JSON.stringify(publishReqs2));
    await page2.close();
  } finally {
    if (notReadyUser) await deleteTestUser(notReadyUser.userId);
    if (readyUser) await deleteTestUser(readyUser.userId);
    await browser.close();
  }

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch(e => { console.error('CRASH:', e); process.exit(1); });
