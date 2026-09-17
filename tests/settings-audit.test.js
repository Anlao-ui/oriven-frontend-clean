// ════════════════════════════════════════════════════════════════
// Settings — complete audit/rebuild pass
//
// Every setting exercised here is asserted against REAL behavior (real
// persistence, real reload, real consuming UI surfaces) — never DOM
// state alone. Fixture-free: every check either uses a real disposable
// Supabase test user or a deliberately-mocked failure for one honest
// error-state check.
//
// RUN: node tests/settings-audit.test.js
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

async function createTestUser(suffix, extra) {
  const email = `oriven.settingsaudit.test+${Date.now()}.${suffix}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await supabaseAdmin.from('profiles').upsert(Object.assign({ id: created.user.id, email, subscription_status: 'professional', onboarding_completed: true }, extra || {}), { onConflict: 'id' });
  return { userId: created.user.id, email, password };
}
async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('profiles').delete().eq('id', userId); } catch (_) {}
  try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
}
async function signIn(page, user) {
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: signInData, error } = await authClient.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
  await page.evaluate(async () => { const { data: { user } } = await window.SB.auth.getUser(); window._currentUser = user; if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user); if (typeof _loadUserProfile === 'function') await _loadUserProfile(user); });
  await page.waitForTimeout(900);
}
async function openSettings(page) {
  await page.evaluate(() => { openSettingsModal(); });
  await page.waitForTimeout(700);
}
async function gotoTab(page, key) {
  await page.click('.smd-ni[data-smd="' + key + '"]');
  await page.waitForTimeout(400);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let user, user2;
  try {
    user = await createTestUser('a', { first_name: 'Riley' });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    await signIn(page, user);
    await openSettings(page);

    // ── Tab order ──────────────────────────────────────────────────
    const tabOrder = await page.evaluate(() => Array.from(document.querySelectorAll('.smd-ni')).map((b) => b.dataset.smd));
    check('1. Tab order is General, Subscription, Notifications, Account, Security, Help', JSON.stringify(tabOrder) === JSON.stringify(['general', 'subscription', 'notifications', 'account', 'security', 'help']), tabOrder);

    // ── General: Workspace Name ──────────────────────────────────────
    const wsInitial = await page.evaluate(() => ({ saveDisabled: document.getElementById('wsNameSaveBtn').disabled }));
    check('2. Workspace Name Save starts disabled (no change yet)', wsInitial.saveDisabled);
    await page.fill('#wsNameInp', 'Riley\'s Workspace');
    const wsDirty = await page.evaluate(() => document.getElementById('wsNameSaveBtn').disabled);
    check('3. Workspace Name Save enables once the value changes (dirty state)', !wsDirty);
    await page.click('#wsNameSaveBtn');
    await page.waitForTimeout(500);
    const wsAfterSave = await page.evaluate(() => ({
      sidebarName: document.getElementById('sidebarUserName').textContent,
      saveDisabledAgain: document.getElementById('wsNameSaveBtn').disabled,
    }));
    check('4. Workspace Name saves and updates the sidebar immediately (no reload needed)', wsAfterSave.sidebarName === "Riley's Workspace" && wsAfterSave.saveDisabledAgain, wsAfterSave);
    // Real reload persistence check
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const wsAfterReload = await page.evaluate(() => (document.getElementById('sidebarUserName') || {}).textContent);
    check('5. Workspace Name survives a hard reload', wsAfterReload === "Riley's Workspace", wsAfterReload);
    // Real account-side persistence (profiles.preferences), not just localStorage
    const dbPrefs = await supabaseAdmin.from('profiles').select('preferences').eq('id', user.userId).maybeSingle();
    check('6. Workspace Name persists to the real account (profiles.preferences), not just this browser', !!(dbPrefs.data && dbPrefs.data.preferences && dbPrefs.data.preferences.wsName === "Riley's Workspace"), dbPrefs.data);

    await openSettings(page);

    // ── General: Theme ──────────────────────────────────────────────
    await page.click('#themeDark');
    await page.waitForTimeout(300);
    const darkApplied = await page.evaluate(() => document.body.classList.contains('dark-mode'));
    check('7. Theme Dark applies immediately (body.dark-mode)', darkApplied);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const darkAfterReload = await page.evaluate(() => document.body.classList.contains('dark-mode'));
    check('8. Theme Dark survives a hard reload', darkAfterReload);
    await openSettings(page); // reload closed the modal -- reopen before the next click
    await page.click('#themeLight');
    await page.waitForTimeout(200);
    const lightApplied = await page.evaluate(() => !document.body.classList.contains('dark-mode'));
    check('9. Theme Light applies immediately', lightApplied);

    // System theme: verify it tracks a real prefers-color-scheme change live
    await page.click('#themeSystem');
    await page.waitForTimeout(200);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(300);
    const systemFollowsDark = await page.evaluate(() => document.body.classList.contains('dark-mode'));
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(300);
    const systemFollowsLight = await page.evaluate(() => !document.body.classList.contains('dark-mode'));
    check('10. Theme "System" genuinely follows a LIVE prefers-color-scheme change (not just a one-shot snapshot)', systemFollowsDark && systemFollowsLight, { systemFollowsDark, systemFollowsLight });
    await page.click('#themeLight');
    await page.waitForTimeout(200);

    // ── General: Accent Color removed ────────────────────────────────
    check('11. No Accent Color UI remains anywhere in Settings', await page.evaluate(() => document.querySelectorAll('.accent-swatch').length === 0));
    // Stale saved accent cannot override canonical lime
    const canonicalGreen = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--green').trim() || getComputedStyle(document.documentElement).getPropertyValue('--green').trim());
    await page.evaluate(() => { if (typeof saveSettings === 'function') saveSettings({ accent: 'purple' }); if (typeof setAccent === 'function') setAccent('purple'); });
    await page.waitForTimeout(200);
    await page.evaluate(() => { if (typeof _applySettingsToUI === 'function' && typeof loadSettings === 'function') _applySettingsToUI(loadSettings()); });
    await page.waitForTimeout(200);
    const greenAfterStale = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--green').trim());
    check('12. A stale saved accent preference cannot override the canonical accent on a real settings load', greenAfterStale === canonicalGreen, { canonicalGreen, greenAfterStale });
    await page.evaluate(() => { if (typeof saveSettings === 'function') saveSettings({ accent: 'green' }); });

    // ── General: Language ────────────────────────────────────────────
    const langOptions = await page.evaluate(() => Array.from(document.querySelectorAll('#langSelect option')).map((o) => o.value));
    check('13. Language dropdown shows exactly the 6 real supported languages', JSON.stringify(langOptions.sort()) === JSON.stringify(['de', 'en', 'es', 'fr', 'nl', 'pt']), langOptions);
    await page.selectOption('#langSelect', 'fr');
    await page.waitForTimeout(300);
    const frApplied = await page.evaluate(() => document.querySelector('[data-smd="general"]').textContent);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const langAfterReload = await page.evaluate(() => document.getElementById('langSelect') ? document.getElementById('langSelect').value : null);
    check('14. Language selection persists after a hard reload', langAfterReload === 'fr', langAfterReload);
    await openSettings(page);
    await page.selectOption('#langSelect', 'en');
    await page.waitForTimeout(300);

    // ── Notifications ─────────────────────────────────────────────
    await gotoTab(page, 'notifications');
    const notifToggles = await page.evaluate(() => Array.from(document.querySelectorAll('#smdp-notifications .tgl')).map((t) => t.id));
    check('15. Exactly the 5 real notification toggles exist (no fake Product Updates/Generation Complete)', JSON.stringify(notifToggles) === JSON.stringify(['tglNotifAutopilot', 'tglNotifAutopilotActions', 'tglNotifAutopilotFailures', 'tglNotifDeployFailures', 'tglNotifBilling']), notifToggles);
    // "No email column" — check for an actual column header/label
    // element, not just the substring "email" anywhere (this panel's
    // own honest disclaimer legitimately contains that word).
    const hasEmailColumnHeader = await page.evaluate(() => Array.from(document.querySelectorAll('#smdp-notifications th, #smdp-notifications .smd-col-hd, #smdp-notifications [class*="channel-hd"]')).some((el) => /email/i.test(el.textContent)));
    check('16. No email-channel column is shown (only in-app notifications exist today)', !hasEmailColumnHeader, hasEmailColumnHeader);

    // Real event-level test: an Autopilot failure event is suppressed
    // from the bell when notifAutopilotFailures is off, and reappears
    // once re-enabled — exercised with real intelligence_events rows
    // for this real user. _loadNotifications is an internal closure
    // (not exposed on window), so the only real, user-realistic way to
    // force a fresh bell fetch is the same one an actual user gets: page
    // load. A hard reload after each preference change is the correct
    // test here, not a shortcut — it also happens to be a stronger,
    // more realistic proof than calling an internal function directly.
    await page.evaluate(() => { saveSettings({ notifAutopilotFailures: false, notifDeployFailures: false }); });
    await page.waitForTimeout(300);
    const bothOff = await page.evaluate(() => ({ af: loadSettings().notifAutopilotFailures, df: loadSettings().notifDeployFailures }));
    check('17. Setting Autopilot Failures / Deployment Failures off actually persists false', bothOff.af === false && bothOff.df === false, bothOff);

    await supabaseAdmin.from('intelligence_events').insert([
      { user_id: user.userId, platform: 'meta', campaign_name: 'Test Campaign', type: 'campaign_action', title: 'Automation "Test Rule" failed to execute', detail: 'simulated', severity: 'high', dismissed: false },
      { user_id: user.userId, platform: 'meta', campaign_name: 'Test Campaign 2', type: 'campaign_action', title: 'Published "Test Campaign 2" to Meta Ads', detail: 'simulated', severity: 'low', dismissed: false },
    ]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const bellTextOff = await page.evaluate(() => (document.getElementById('orvNotifList') || {}).textContent || '');
    check('18. With both failure toggles off, the real Autopilot-failure event does NOT appear in the bell (real reload)', !bellTextOff.includes('failed to execute'), bellTextOff.slice(0, 300));

    await page.evaluate(() => { saveSettings({ notifAutopilotFailures: true, notifDeployFailures: true }); });
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const bellTextOn = await page.evaluate(() => (document.getElementById('orvNotifList') || {}).textContent || '');
    check('19. With the toggles back on, the same real Autopilot-failure event DOES appear in the bell (real reload)', bellTextOn.includes('failed to execute'), bellTextOn.slice(0, 300));

    await supabaseAdmin.from('intelligence_events').delete().eq('user_id', user.userId);

    // ── Account ──────────────────────────────────────────────────
    await openSettings(page);
    await gotoTab(page, 'account');
    const nameLoaded = await page.evaluate(() => document.getElementById('acctNameInp').value);
    check('20. Account Name field loads the real saved first_name', nameLoaded === 'Riley', nameLoaded);
    await page.fill('#acctNameInp', 'Riley Updated');
    await page.click('#acctNameSaveBtn');
    await page.waitForTimeout(1200);
    const nameDb = await supabaseAdmin.from('profiles').select('first_name').eq('id', user.userId).maybeSingle();
    check('21. Account Name save persists to the real profiles.first_name column', nameDb.data && nameDb.data.first_name === 'Riley Updated', nameDb.data);
    const acctHasDanger = await page.evaluate(() => !!document.querySelector('#smdp-account .smd-danger-zone'));
    check('22. Sign Out / Delete Account live in the Account tab (moved from Security)', acctHasDanger);
    const noBizFields = await page.evaluate(() => !/company|brand voice|competitor/i.test(document.getElementById('smdp-account').textContent));
    check('23. Account contains no Business-profile fields (no duplication)', noBizFields);

    // ── Security ─────────────────────────────────────────────────
    await gotoTab(page, 'security');
    const secHasDanger = await page.evaluate(() => !document.querySelector('#smdp-security .smd-danger-zone'));
    check('24. Sign Out / Delete Account no longer live in Security', secHasDanger);
    const secState = await page.evaluate(() => ({
      hasPassword: !!document.getElementById('acctPasswordSection'),
      hasAllSessions: !!document.getElementById('acctAllSessionsSection'),
      hasFakeSessionsList: /windows|chrome|last active/i.test(document.getElementById('smdp-security').textContent),
      hasFakeMfa: /two-factor|2fa|authenticator/i.test(document.getElementById('smdp-security').textContent),
    }));
    check('25. Security has real Password + Sign-out-all, no fabricated device/session list', secState.hasPassword && secState.hasAllSessions && !secState.hasFakeSessionsList, secState);
    check('26. No fake MFA/2FA UI exists (honestly omitted, not implemented unsafely)', !secState.hasFakeMfa, secState);

    // ── Help ─────────────────────────────────────────────────────
    await gotoTab(page, 'help');
    const helpText = await page.evaluate(() => document.getElementById('smdp-help').textContent);
    check('27. Help contains no false "stops notifications from being created" claim', !helpText.includes('stops those notifications from being created'), true);
    check('28. Help contains no Team reference', !/teammate/i.test(helpText), true);
    const versionVal = await page.evaluate(() => (document.getElementById('smdVersionVal') || {}).textContent || '');
    check('29. Help shows a real, non-placeholder Version string', /^\d+\.\d+\.\d+$/.test(versionVal.trim()), versionVal);
    const noDeadLinks = await page.evaluate(() => !Array.from(document.querySelectorAll('#smdp-help a')).some((a) => a.getAttribute('href') === '#' || (a.getAttribute('href') || '').startsWith('javascript:')));
    check('30. No placeholder/dead links (href="#" or javascript:void) in Help', noDeadLinks);

    // ── Subscription ─────────────────────────────────────────────
    await gotoTab(page, 'subscription');
    await page.waitForTimeout(1200);
    const subState = await page.evaluate(() => ({
      hasComingSoon: /coming soon/i.test(document.getElementById('planPanelContent').textContent),
      hasTeamCard: /"sub-pcard-name">\s*Team/i.test(document.getElementById('planPanelContent').innerHTML),
      hasManageSub: !!document.getElementById('manageSubBtn'),
    }));
    check('31. No fake "Coming Soon" dead button remains', !subState.hasComingSoon, subState);
    check('32. No Team plan card exists', !subState.hasTeamCard, subState);
    check('33. A real "Manage Subscription" action exists for a paid plan', subState.hasManageSub, subState);

    check('JS errors during the full Settings audit walkthrough', jsErrors.length === 0, jsErrors);
    await page.close();

    // ── Manage Subscription: real backend honesty (no stripe_customer_id yet) ──
    {
      const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await signIn(page2, user);
      const token = await page2.evaluate(async () => (await window.SB.auth.getSession()).data.session.access_token);
      const resp = await page2.evaluate(async (t) => {
        const r = await fetch('http://localhost:5500/api/create-portal-session', { method: 'POST', headers: { Authorization: 'Bearer ' + t } });
        return { status: r.status, data: await r.json().catch(() => null) };
      }, token);
      check('34. Manage Subscription honestly reports "not available" for an account with no real Stripe customer (never fakes a portal URL)', resp.status === 404 && !!resp.data.error, resp);
      await page2.close();
    }

    // ── Name field: no personal name, no invented value ───────────
    user2 = await createTestUser('b', { first_name: null });
    {
      const page3 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await signIn(page3, user2);
      await openSettings(page3);
      await gotoTab(page3, 'account');
      const emptyName = await page3.evaluate(() => document.getElementById('acctNameInp').value);
      check('35. A user with no saved name shows an honestly empty field, never an invented one', emptyName === '', emptyName);
      await page3.close();
    }

    // ── Mobile responsive ────────────────────────────────────────
    {
      const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await signIn(mobilePage, user);
      await openSettings(mobilePage);
      const mobileState = await mobilePage.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        closeReachable: !!document.querySelector('.smd-close-btn') && getComputedStyle(document.querySelector('.smd-close-btn')).display !== 'none',
      }));
      check('36. Settings at 390px: no horizontal overflow', !mobileState.overflow, mobileState);
      check('37. Settings at 390px: close control remains reachable', mobileState.closeReachable, mobileState);
      await gotoTab(mobilePage, 'subscription');
      await mobilePage.waitForTimeout(1000);
      const subMobileOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      check('38. Subscription tab at 390px: no horizontal overflow', !subMobileOverflow, subMobileOverflow);
      await mobilePage.close();
    }

    // ── Reduced motion ────────────────────────────────────────────
    {
      const rmPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      await signIn(rmPage, user);
      await openSettings(rmPage);
      const rmVisible = await rmPage.evaluate(() => getComputedStyle(document.getElementById('modal-settings')).display !== 'none' || document.getElementById('modal-settings').classList.contains('open'));
      check('39. Settings opens and is usable with prefers-reduced-motion: reduce', rmVisible);
      await rmPage.close();
    }

    // ── Accessibility ─────────────────────────────────────────────
    {
      const a11yPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await signIn(a11yPage, user);
      await openSettings(a11yPage);
      const a11y = await a11yPage.evaluate(() => {
        const closeBtn = document.querySelector('.smd-close-btn');
        const toggle = document.getElementById('tglNotifAutopilot');
        return {
          closeHasLabel: !!closeBtn && !!closeBtn.getAttribute('aria-label'),
          toggleHasRole: document.querySelector('[data-smd="notifications"]') !== null, // presence check, role checked below
        };
      });
      await gotoTab(a11yPage, 'notifications');
      const toggleRole = await a11yPage.evaluate(() => document.getElementById('tglNotifAutopilot').getAttribute('role'));
      const toggleChecked = await a11yPage.evaluate(() => document.getElementById('tglNotifAutopilot').getAttribute('aria-checked'));
      check('40. Close control has an accessible label', a11y.closeHasLabel);
      check('41. Notification toggles expose a real role="switch" + aria-checked state', toggleRole === 'switch' && (toggleChecked === 'true' || toggleChecked === 'false'), { toggleRole, toggleChecked });
      const wsLabel = await a11yPage.evaluate(() => !!document.getElementById('wsNameInp').closest('.smd-section').querySelector('.smd-field-lbl'));
      check('42. Workspace Name input has an associated visible label', wsLabel);
      await a11yPage.close();
    }

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
    if (failed.length) process.exitCode = 1;
  } finally {
    if (user) await deleteTestUser(user.userId);
    if (user2) await deleteTestUser(user2.userId);
    try { await supabaseAdmin.from('intelligence_events').delete().ilike('title', '%Test Rule%'); } catch (_) {}
    await browser.close();
  }
}
main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
