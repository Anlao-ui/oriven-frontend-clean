// ════════════════════════════════════════════════════════════════
// Autopilot Builder — persistence UX + safety (Autopilot Persistence
// Fix pass)
//
// MOCKED test — /api/autopilot/* is stubbed via page.route throughout
// this file. This proves the FRONTEND code paths (error classification/
// display, Start Over reset, X-close safety, button alignment, safe Test
// gating) are correct; it does NOT prove real database persistence. For
// that, see tests/autopilot-real-db-lifecycle.test.js, which hits the
// real /api/autopilot/rules routes and a real Supabase table with no
// mocking at all. Never conflate the two — this file's PASS does not mean
// "Create Automation saves for real."
//
// RUN: node tests/autopilot-builder-persistence.test.js
// ════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const BASE_URL = process.env.TEST_FRONTEND_URL || 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env — aborting.'); process.exit(1); }
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

const results = [];
function check(name, cond, detail) { results.push({ name, ok: !!cond }); console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail !== undefined ? ' (' + JSON.stringify(detail) + ')' : '')); }

async function createTestUser(suffix, plan) {
  const email = `oriven.ap.persist.test+${Date.now()}.${suffix}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: plan || 'professional', onboarding_completed: true }, { onConflict: 'id' });
  return { userId, email, password };
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
  await page.evaluate(async () => {
    const { data: { user } } = await window.SB.auth.getUser();
    window._currentUser = user;
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user);
    if (typeof _loadUserProfile === 'function') await _loadUserProfile(user);
  });
  await page.waitForTimeout(900);
}
async function mockBase(page, opts) {
  opts = opts || {};
  await page.route('**/api/*/status', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true, ready: true }) }));
  await page.route('**/api/*/campaigns**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ campaigns: [{ id: 'c1', name: 'Spring Sale Campaign', status: 'ACTIVE' }] }) }));
  await page.route('**/api/autopilot/history**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }));
  await page.route('**/api/autopilot/recommendations**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: [] }) }));
  await page.route('**/api/autopilot/tasks**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: [] }) }));
  await page.route('**/api/credits/status', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ featureCosts: { autopilot: 25 }, autopilotUsage: { used: 0, limit: null } }) }));
  await page.route('**/api/autopilot/rules', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rules: opts.rules || [] }) });
    route.continue();
  });
}
async function driveBuilderToReview(page) {
  await page.click('button[onclick="apOpenBuilder()"]');
  await page.waitForTimeout(400);
  await page.evaluate(() => apWizSelectPlatform('meta'));
  await page.waitForTimeout(500);
  await page.evaluate(() => apWizSelectCampaign('all'));
  await page.waitForTimeout(500);
  await page.evaluate(() => apWizSelectMetric('roas'));
  await page.waitForTimeout(300);
  await page.evaluate(() => apWizSelectOperator('<'));
  await page.fill('#apWizValue', '2');
  await page.click('button[onclick="apWizConfirmCondition()"]');
  await page.waitForTimeout(400);
  await page.evaluate(() => apWizSelectAction('pause_campaign'));
  await page.waitForTimeout(500);
  await page.evaluate(() => apWizSelectMode('require_approval'));
  await page.waitForTimeout(300);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let user;
  try {
    user = await createTestUser('main', 'professional');

    // ════════════════════════════════════════════════════════════
    // 1. Database-error handling — classified, never leaks a raw
    // Postgres/PostgREST message, never fakes success.
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await mockBase(page, { rules: [] });
      await page.route('**/api/autopilot/rules', (route) => {
        if (route.request().method() === 'POST') {
          return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Could not save this automation. Please try again.', code: 'DB_UNAVAILABLE' }) });
        }
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rules: [] }) });
      });
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
      await page.waitForTimeout(1000);
      await driveBuilderToReview(page);
      await page.fill('#apBName', 'DB error test');
      await page.click('#apBSaveBtn');
      await page.waitForTimeout(800);
      const st = await page.evaluate(() => ({
        errorVisible: getComputedStyle(document.getElementById('apBError')).display !== 'none',
        errorText: document.getElementById('apBError').textContent,
        builderStillOpen: getComputedStyle(document.getElementById('apBuilderOverlay')).display !== 'none',
      }));
      check('1a. A real DB_UNAVAILABLE error shows a short, honest, non-raw message', st.errorVisible && st.errorText === 'Could not save this automation. Please try again.', st);
      check('1b. Builder stays open on failure (never fakes success)', st.builderStillOpen, st);
      check('JS errors (db error handling)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 2. Start Over — complete reset, no stale state
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await mockBase(page, { rules: [] });
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
      await page.waitForTimeout(1000);
      await driveBuilderToReview(page);
      await page.fill('#apBName', 'About to be discarded');
      await page.click('#apBCancelBtn');
      await page.waitForTimeout(400);
      const st = await page.evaluate(() => ({
        step1Visible: getComputedStyle(document.getElementById('apWizStep1')).display !== 'none',
        step5Visible: getComputedStyle(document.getElementById('apWizStep5')).display !== 'none',
        recap1Visible: getComputedStyle(document.getElementById('apWizRecap1')).display !== 'none',
        recap2Visible: getComputedStyle(document.getElementById('apWizRecap2')).display !== 'none',
        recap3Visible: getComputedStyle(document.getElementById('apWizRecap3')).display !== 'none',
        recap4Visible: getComputedStyle(document.getElementById('apWizRecap4')).display !== 'none',
        nameValue: document.getElementById('apBName').value,
        saveBtnText: document.getElementById('apBSaveBtn').textContent,
      }));
      console.log('AFTER START OVER:', JSON.stringify(st));
      check('2a. Start Over returns to step 1, hides step 5', st.step1Visible && !st.step5Visible, st);
      check('2b. Start Over clears every recap chip (platform/campaign/condition/action)', !st.recap1Visible && !st.recap2Visible && !st.recap3Visible && !st.recap4Visible, st);
      check('2c. Start Over clears the name field', st.nameValue === '', st.nameValue);
      check('2d. Start Over resets the Save button back to "Create Automation" wording', st.saveBtnText === 'Create Automation', st.saveBtnText);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 3. Close (X) — leaves without saving, no DB write, no partial
    // rule, and reopening starts fresh (not a resumed stale draft)
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const writeCalls = [];
      await mockBase(page, { rules: [] });
      await page.route('**/api/autopilot/rules', (route) => {
        if (route.request().method() !== 'GET') writeCalls.push(route.request().method());
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rules: [] }) });
      });
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
      await page.waitForTimeout(1000);
      await driveBuilderToReview(page);
      await page.click('#apBuilderOverlay .intel-mon-close-btn');
      await page.waitForTimeout(400);
      check('3a. X fires zero database writes', writeCalls.length === 0, writeCalls);
      const closed = await page.evaluate(() => getComputedStyle(document.getElementById('apBuilderOverlay')).display === 'none');
      check('3b. X closes the overlay', closed);
      await page.click('button[onclick="apOpenBuilder()"]');
      await page.waitForTimeout(400);
      const reopened = await page.evaluate(() => ({
        step1Visible: getComputedStyle(document.getElementById('apWizStep1')).display !== 'none',
        recap3Visible: getComputedStyle(document.getElementById('apWizRecap3')).display !== 'none',
      }));
      check('3c. Re-opening after X starts a fresh flow, not the abandoned draft', reopened.step1Visible && !reopened.recap3Visible, reopened);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 4. Safe Test behavior — gated before save; read-only against
    // real campaign data once a rule exists; never touches approval/
    // execution endpoints
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const mutationCalls = [];
      const rule = { id: 'r1', name: 'Test-safety rule', enabled: true, trigger_metric: 'roas', trigger_operator: '<', trigger_value: 2, platform: 'meta', action_type: 'pause_campaign', action_params: { campaign_id: 'all', mode: 'require_approval' }, last_triggered_at: null, created_at: new Date().toISOString() };
      await mockBase(page, { rules: [rule] });
      await page.route('**/api/autopilot/rules/*/test', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ wouldTrigger: false, matchingCampaigns: [], checkedCampaigns: 1 }) }));
      await page.route('**/api/*/campaign/*/pause', (route) => { mutationCalls.push('pause'); route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
      await page.route('**/api/*/campaign/*/resume', (route) => { mutationCalls.push('resume'); route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
      await page.waitForTimeout(1000);

      // Before any rule is being edited (fresh builder), Test genuinely
      // cannot run yet (it requires a persisted rule id). Builder-polish
      // pass: rather than letting the user click an apparently-live
      // button only to be told afterward it did nothing, the button is
      // disabled up front with a small honest explanation in its place --
      // drive to the review step first, since #apBTestBtn only exists on
      // step 5.
      await driveBuilderToReview(page);
      const gatedState = await page.evaluate(() => ({
        disabled: document.getElementById('apBTestBtn').disabled,
        hintVisible: getComputedStyle(document.getElementById('apBTestHint')).display !== 'none',
        hintText: document.getElementById('apBTestHint').textContent,
      }));
      check('4a. Test on a not-yet-saved rule is disabled up front, not clickable-then-erroring', gatedState.disabled, gatedState);
      check('4a2. A visible, honest explanation replaces the dead click ("Save the automation first...")', gatedState.hintVisible && /save the automation first/i.test(gatedState.hintText), gatedState);
      await page.click('#apBuilderOverlay .intel-mon-close-btn');
      await page.waitForTimeout(300);

      // Editing a real, already-saved rule makes Test usable and read-only.
      await page.click('.ap-auto-card');
      await page.waitForTimeout(500);
      await page.click('#apRuleDetailOverlay button[onclick*="apActiveEdit"]');
      await page.waitForTimeout(700);
      await page.click('#apBTestBtn');
      await page.waitForTimeout(800);
      const testResult = await page.evaluate(() => document.getElementById('apBTestResult').textContent);
      check('4b. Test on a saved rule returns a real match/no-match result', /none currently meet|would trigger/i.test(testResult || ''), testResult);
      check('4c. Test never calls a real pause/resume provider mutation endpoint', mutationCalls.length === 0, mutationCalls);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 5. Final action-area — one deliberate group, real button
    // hierarchy, consistent across viewports
    // ════════════════════════════════════════════════════════════
    for (const vp of [{ w: 1440, h: 900, label: '1440' }, { w: 1280, h: 900, label: '1280' }, { w: 390, h: 844, label: '390' }]) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      await mockBase(page, { rules: [] });
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
      await page.waitForTimeout(1000);
      await driveBuilderToReview(page);
      const layout = await page.evaluate(() => {
        const test = document.getElementById('apBTestBtn');
        const save = document.getElementById('apBSaveBtn');
        const cancel = document.getElementById('apBCancelBtn');
        const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
        return {
          allRealButtons: test.tagName === 'BUTTON' && save.tagName === 'BUTTON' && cancel.tagName === 'BUTTON',
          cancelIsGhostButton: cancel.classList.contains('oi-card-btn') && cancel.classList.contains('oi-card-btn-ghost'),
          saveIsPrimary: save.classList.contains('oi-card-btn-primary'),
          overflow,
        };
      });
      check(vp.label + ': Test/Create/Start Over are all real <button> elements', layout.allRealButtons, layout);
      check(vp.label + ': Start Over is a real tertiary/ghost button, not loose text', layout.cancelIsGhostButton, layout);
      check(vp.label + ': Create Automation is the visually primary action', layout.saveIsPrimary, layout);
      check(vp.label + ': no horizontal overflow', !layout.overflow, layout);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 6. Professional gating still correct (not "Creator or higher")
    // ════════════════════════════════════════════════════════════
    {
      const creatorUser = await createTestUser('creator', 'creator');
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.route('**/api/autopilot/**', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Autopilot requires the Professional plan.', code: 'AUTOPILOT_NOT_AVAILABLE' }) }));
        await signIn(page, creatorUser);
        await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
        await page.waitForTimeout(1200);
        const paywallText = await page.evaluate(() => document.body.innerText);
        check('6a. Creator-plan gating message says "Professional", never "Creator or higher"', /requires the professional plan/i.test(paywallText) && !/creator or higher/i.test(paywallText), /requires the professional plan/i.test(paywallText));
        await page.close();
      } finally {
        await deleteTestUser(creatorUser.userId);
      }
    }
  } finally {
    await browser.close();
    if (user) await deleteTestUser(user.userId);
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + results.length + ' checks run, ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed.');
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
