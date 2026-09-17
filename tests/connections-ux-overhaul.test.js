// ════════════════════════════════════════════════════════════════
// Connections UX + Reliability Overhaul — UI regression tests
//
// Covers the new primary-status hierarchy (Ready / Needs attention /
// setup-incomplete states), progressive disclosure (collapsed detail
// panel + "Why?" popover), the Pinterest OAuth-return-handler fix,
// and a final jargon-leak audit across the whole Connections page.
//
// Real browser + real running backend + disposable Supabase users,
// same convention as this repo's other setup-engine UI tests.
// RUN: node tests/connections-ux-overhaul.test.js
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
  const email = `oriven.connectionsux.test+${Date.now()}.${suffix}@example.com`;
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

    // Meta: ready, no known problems -> primary "Ready to advertise", details collapsed
    await supabaseAdmin.from('integrations').upsert({
      user_id: user.userId, provider: 'meta_ads', access_token: 'fake', token_expiry: new Date(Date.now() + 3600000).toISOString(),
      meta_ads_accounts: [{ account_id: 'act_1', account_name: 'Test Account' }], active_ad_account: { account_id: 'act_1', account_name: 'Test Account' },
      meta_pages: [{ page_id: 'p1', page_name: 'Test Page' }], active_page: { page_id: 'p1', page_name: 'Test Page' },
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    // Google: manager-only -> still mid-setup, details open by default, specific action button
    await supabaseAdmin.from('integrations').upsert({
      user_id: user.userId, provider: 'google_ads', access_token: 'fake', refresh_token: 'fake_r', token_expiry: new Date(Date.now() + 3600000).toISOString(),
      google_ads_accounts: [{ customer_id: '111', name: 'My MCC', is_manager: true }], connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    // TikTok: not connected at all -> simplest possible card
    // (no integrations row seeded — genuinely disconnected)

    // Pinterest: no accounts -> manual/creation flow, details open
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
        metaPrimary: (document.querySelector('#conReadyMeta .con-ready-status') || {}).textContent,
        metaDetailsHidden: (document.getElementById('conDetailsMeta') || {}).hidden,
        metaToggleLabel: (document.getElementById('conManageToggleMeta') || {}).textContent,
        googlePrimary: (document.querySelector('#conReadyGoogle .con-ready-status') || {}).textContent,
        googleDetailsHidden: (document.getElementById('conDetailsGoogle') || {}).hidden,
        googleToggleLabel: (document.getElementById('conManageToggleGoogle') || {}).textContent,
        pinterestDetailsHidden: (document.getElementById('conDetailsPinterest') || {}).hidden,
        tiktokNotConnectedHidden: (document.getElementById('conReadyTiktok') || {}).style.display,
      }));
      check('1. Meta (fully ready, no known problems): primary status is "Ready to advertise" — the strongest positive state', /ready to advertise/i.test(state.metaPrimary || ''), state.metaPrimary);
      check('2. Meta: detail panel is COLLAPSED by default (progressive disclosure — do not dump the full checklist on a healthy platform)', state.metaDetailsHidden === true, JSON.stringify(state));
      check('3. Meta: the toggle button reads "Manage", not a generic "Continue"/"Fix"/"Action"', state.metaToggleLabel === 'Manage', state.metaToggleLabel);
      check('4. Google (manager-only, mid-setup): primary status is a real setup-incomplete label, never "Ready"', !/ready to advertise/i.test(state.googlePrimary || '') && !!state.googlePrimary, state.googlePrimary);
      check('5. Google: detail panel is OPEN by default while setup is genuinely incomplete (the actions ARE the next step, not optional detail)', state.googleDetailsHidden === false, JSON.stringify(state));
      check('6. Google: the toggle/action button uses a specific verb ("Complete setup"), never generic "Continue"/"Action"/"Fix"', /complete setup/i.test(state.googleToggleLabel || ''), state.googleToggleLabel);
      check('7. Pinterest (manual_action_required): detail panel is open by default too (same rule as Google)', state.pinterestDetailsHidden === false, JSON.stringify(state));
      check('8. TikTok (not connected at all): the readiness row stays hidden — the existing "Not connected" dot alone is enough, no redundant/noisy second panel', state.tiktokNotConnectedHidden === 'none', state.tiktokNotConnectedHidden);

      // Expand Meta's collapsed details and confirm the checklist + Recheck appear.
      await page.click('#conManageToggleMeta');
      await page.waitForTimeout(300);
      const expanded = await page.evaluate(() => ({
        hidden: (document.getElementById('conDetailsMeta') || {}).hidden,
        hasChecklist: !!document.querySelector('#conDetailsMeta .con-checklist'),
        hasRecheck: !!document.querySelector('#conDetailsMeta .con-ready-recheck'),
      }));
      check('9. Clicking "Manage" expands the detail panel, revealing the real checklist and Recheck action', expanded.hidden === false && expanded.hasChecklist && expanded.hasRecheck, JSON.stringify(expanded));

      check('10. No JS errors during the full state-hierarchy walkthrough', jsErrors.length === 0, JSON.stringify(jsErrors));

      // ── Final jargon-leak audit across the live-rendered Connections page ──
      const jargonAudit = await page.evaluate(() => {
        const text = document.getElementById('page-business-brain') ? document.getElementById('page-business-brain').innerText : document.body.innerText;
        const leaks = [];
        ['API_GATED', 'HYBRID', 'ready_limited_verification', 'AUTH_REQUIRED', 'TOKEN_REFRESH_FAILED', 'PERMISSION_REQUIRED', 'ACCOUNT_REQUIRED', 'implemented:'].forEach((term) => {
          if (text.indexOf(term) !== -1) leaks.push(term);
        });
        return leaks;
      });
      check('11. No internal capability/state jargon leaks into the live-rendered Connections page text', jargonAudit.length === 0, JSON.stringify(jargonAudit));

      for (const [label, vp] of Object.entries({ desktop: { width: 1440, height: 1000 }, tablet1: { width: 1280, height: 900 }, tablet2: { width: 1024, height: 900 }, mobile: { width: 390, height: 1700 } })) {
        await page.setViewportSize(vp);
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(() => {
          const mc = document.querySelector('.mc');
          return mc.scrollWidth > mc.clientWidth + 1;
        });
        check(`12. [${label}] No horizontal overflow with the redesigned status hierarchy`, !overflow, 'overflow=' + overflow);
      }
    } finally {
      await page.close();
    }

    // ── OAuth-return toast: THREE real, distinct bugs found + fixed this
    // pass, all in the real production flow (a user who is ALREADY
    // signed into ORIVEN returning from a platform's OAuth redirect —
    // simulated here by pre-seeding the real Supabase session into
    // localStorage BEFORE navigation, exactly like a real browser that
    // was signed in before clicking "Connect X"):
    //   1. auth.js's onUserSignedIn() called _setAppRoute("/app") — which
    //      unconditionally strips the ENTIRE query string — BEFORE the
    //      OAuth-return detection code got a chance to read it. Fixed by
    //      reordering (_detectPendingOAuthReturn() now runs first).
    //   2. Pinterest had no detection block at all (Google/TikTok/Meta
    //      did) — a Pinterest return was silently dropped.
    //   3. showApp() — which runs earliest in the real sign-in flow, so
    //      it always won the race against the other two "show this
    //      toast" copies — had a hardcoded, Google-only message map
    //      pre-dating TikTok/Meta/Pinterest. A real live check caught
    //      it: a Pinterest access_denied return showed "Google sign-in
    //      was cancelled." Fixed by making showApp() provider-aware.
    const projectRef = SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];
    const storageKey = 'sb-' + projectRef + '-auth-token';
    const authClient2 = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: signInData2 } = await authClient2.auth.signInWithPassword({ email: user.email, password: user.password });

    for (const [provider, errorParam] of [['pinterest', 'pinterest_error'], ['google', 'google_error'], ['meta', 'meta_error'], ['tiktok', 'tiktok_error']]) {
      const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      try {
        await page2.addInitScript(({ key, session }) => { localStorage.setItem(key, JSON.stringify(session)); }, { key: storageKey, session: signInData2.session });
        await page2.goto(BASE_URL + '/app.html?' + errorParam + '=access_denied', { waitUntil: 'networkidle' });
        await page2.waitForTimeout(1200);
        const oauthReturn = await page2.evaluate(() => ({
          url: window.location.href,
          toastText: Array.from(document.querySelectorAll('.orv-toast, .toast, [class*="toast"]')).map((e) => e.textContent).filter(Boolean)[0] || null,
        }));
        check(`13-${provider}. OAuth-return error for ${provider} is detected: the query param is cleaned from the URL (was left in place for ALL platforms before the _setAppRoute reordering fix)`, oauthReturn.url.indexOf(errorParam) === -1, oauthReturn.url);
        const providerNamePattern = new RegExp(provider, 'i');
        check(`14-${provider}. OAuth-return error for ${provider} shows the CORRECT platform-specific toast (was always "Google ..." for every platform before the showApp() fix; Pinterest was silent before that too)`, oauthReturn.toastText && providerNamePattern.test(oauthReturn.toastText), oauthReturn.toastText);
      } finally {
        await page2.close();
      }
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
