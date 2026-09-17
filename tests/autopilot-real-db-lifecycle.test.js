// ════════════════════════════════════════════════════════════════
// Autopilot — REAL database lifecycle proof (Autopilot Persistence Fix
// pass)
//
// THIS IS NOT A MOCKED TEST. /api/autopilot/rules and /api/autopilot/
// rules/:id/test are hit for real, against the real backend and the
// real automation_rules Supabase table — no page.route stub for any of
// them. Only provider-setup endpoints (status/campaigns) are mocked, so
// this doesn't depend on a live connected ad account. Every assertion
// that matters is double-checked directly against Supabase
// (supabaseAdmin.from('automation_rules')...), not just the DOM, so a
// frontend-only bug can't produce a false pass here.
//
// This requires the automation_rules table to actually exist and be
// exposed by PostgREST (see server/docs/migrations/
// 2026-09-automation-rules-schema-cache.sql). If it isn't reachable yet,
// this reports an honest SKIP rather than a false pass or a confusing
// crash — same convention tests/setup-completion-routes.test.js already
// uses for the missing autopilot_recommendations table.
//
// For a fast, deterministic, mocked-only check of the builder's UX/
// error-handling/safety behavior (which does not require this table),
// see tests/autopilot-builder-persistence.test.js instead — do not treat
// that file's PASS as proof of real persistence.
//
// RUN: node tests/autopilot-real-db-lifecycle.test.js
// ════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = process.env.TEST_FRONTEND_URL || 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env — aborting.'); process.exit(1); }
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
const SHOT_DIR = require('path').resolve(__dirname, '_shots');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

async function main() {
  // ── Pre-flight: is automation_rules even reachable? ──────────────────
  const preflight = await supabaseAdmin.from('automation_rules').select('id').limit(1);
  if (preflight.error) {
    console.log('SKIP — automation_rules is not reachable yet (' + preflight.error.code + ': ' + preflight.error.message + ').');
    console.log('Run server/docs/migrations/2026-09-automation-rules-schema-cache.sql via the Supabase Dashboard SQL editor, then re-run this file.');
    console.log('\n0 checks run, 0 passed, 0 failed (SKIPPED — schema not ready).');
    return; // graceful return, not process.exit() -- lets Node drain any open handles (Supabase's keep-alive socket) on its own instead of a forced-exit libuv warning
  }

  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  const email = `oriven.ap.reallife+${Date.now()}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'professional', onboarding_completed: true }, { onConflict: 'id' });
  const results = [];
  const check = (name, cond, detail) => { results.push({ name, pass: !!cond }); console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name + (detail ? ' :: ' + JSON.stringify(detail) : '')); };
  let ruleId = null;

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    // Only mock provider connection/campaign endpoints -- NOT /api/autopilot/*.
    await page.route('**/api/*/status', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true, ready: true }) }));
    await page.route('**/api/*/campaigns**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ campaigns: [{ id: 'c1', name: 'Spring Sale Campaign', status: 'ACTIVE' }] }) }));

    await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
    const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: signInData } = await authClient.auth.signInWithPassword({ email, password });
    await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
    await page.evaluate(async () => { const { data: { user } } = await window.SB.auth.getUser(); window._currentUser = user; if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user); if (typeof _loadUserProfile === 'function') await _loadUserProfile(user); });
    await page.waitForTimeout(900);
    await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
    await page.waitForSelector('.ap-auto-card, .ap-auto-empty', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);

    // ── CREATE via the real UI ──────────────────────────────────────────
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
    await page.fill('#apBName', 'REAL LIFECYCLE TEST RULE');
    await page.click('#apBSaveBtn');
    await page.waitForTimeout(1500);

    const afterCreate = await page.evaluate(() => ({
      errorVisible: getComputedStyle(document.getElementById('apBError')).display !== 'none',
      errorText: document.getElementById('apBError').textContent,
      builderClosed: getComputedStyle(document.getElementById('apBuilderOverlay')).display === 'none',
      cardCount: document.querySelectorAll('.ap-auto-card').length,
      cardText: (document.querySelector('.ap-auto-card') || {}).innerText,
    }));
    console.log('AFTER REAL CREATE:', JSON.stringify(afterCreate));
    check('CREATE: no error shown', !afterCreate.errorVisible, afterCreate);
    check('CREATE: builder closes on success', afterCreate.builderClosed, afterCreate);
    check('CREATE: exactly one real rule card renders', afterCreate.cardCount === 1, afterCreate);
    check('CREATE: card shows real IF/THEN content', /ROAS/i.test(afterCreate.cardText || '') && /Pause/i.test(afterCreate.cardText || ''), afterCreate.cardText);
    await page.screenshot({ path: SHOT_DIR + '/real_create_success.png', fullPage: false });

    // Confirm via direct Supabase query (source of truth, not the DOM).
    const { data: dbRows } = await supabaseAdmin.from('automation_rules').select('*').eq('user_id', userId);
    check('CREATE: real row exists in automation_rules (verified via direct Supabase query, not the DOM)', dbRows && dbRows.length === 1 && dbRows[0].name === 'REAL LIFECYCLE TEST RULE', dbRows);
    ruleId = dbRows && dbRows[0] && dbRows[0].id;

    // ── HARD RELOAD -> persistence proof ────────────────────────────────
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
    await page.evaluate(async () => { const { data: { user } } = await window.SB.auth.getUser(); window._currentUser = user; if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user); if (typeof _loadUserProfile === 'function') await _loadUserProfile(user); });
    await page.waitForTimeout(900);
    await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
    await page.waitForSelector('.ap-auto-card, .ap-auto-empty', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    const afterReload = await page.evaluate(() => ({
      cardCount: document.querySelectorAll('.ap-auto-card').length,
      cardText: (document.querySelector('.ap-auto-card') || {}).innerText,
    }));
    console.log('AFTER HARD RELOAD:', JSON.stringify(afterReload));
    check('RELOAD: rule still exists after a full page reload (real DB persistence, not memory/localStorage)', afterReload.cardCount === 1 && /ROAS/i.test(afterReload.cardText || ''), afterReload);
    await page.screenshot({ path: SHOT_DIR + '/real_after_reload.png', fullPage: false });

    // ── EDIT via the real UI ────────────────────────────────────────────
    await page.click('.ap-auto-card');
    await page.waitForTimeout(500);
    await page.click('#apRuleDetailOverlay button[onclick*="apActiveEdit"]');
    await page.waitForTimeout(600);
    // change threshold 2 -> 3: apWizEdit(3) shows the condition step's
    // metric cards; re-selecting ROAS (matching a real user re-picking the
    // same metric to edit its value) is what actually reveals
    // #apWizConditionDetail/#apWizValue (apWizSelectMetric's own job).
    await page.evaluate(() => { apWizEdit(3); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { apWizSelectMetric('roas'); });
    await page.waitForTimeout(300);
    // apWizSelectMetric resets the operator to its own default (first in
    // AP_OPERATORS) -- explicitly re-select '<' so this is a genuine
    // "less than 3" edit, not whatever the default happens to be.
    await page.evaluate(() => { apWizSelectOperator('<'); });
    await page.waitForTimeout(200);
    await page.fill('#apWizValue', '3');
    await page.click('button[onclick="apWizConfirmCondition()"]');
    await page.waitForTimeout(400);
    // Confirming a condition advances forward to step 4 (action), same as
    // the normal forward flow — re-confirm the same action/mode to reach
    // step 5 again (real wizard behavior, not a workaround).
    await page.evaluate(() => { apWizSelectAction('pause_campaign'); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { apWizSelectMode('require_approval'); });
    await page.waitForTimeout(300);
    await page.click('#apBSaveBtn');
    await page.waitForTimeout(1200);
    const afterEdit = await page.evaluate(() => (document.querySelector('.ap-auto-card') || {}).innerText);
    console.log('AFTER REAL EDIT:', JSON.stringify(afterEdit));
    check('EDIT: card reflects the new threshold (3, not 2)', /ROAS is less than 3/i.test(afterEdit || ''), afterEdit);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
    await page.evaluate(async () => { const { data: { user } } = await window.SB.auth.getUser(); window._currentUser = user; if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user); if (typeof _loadUserProfile === 'function') await _loadUserProfile(user); });
    await page.waitForTimeout(900);
    await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
    await page.waitForSelector('.ap-auto-card, .ap-auto-empty', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    const afterEditReload = await page.evaluate(() => (document.querySelector('.ap-auto-card') || {}).innerText);
    console.log('AFTER EDIT + RELOAD:', JSON.stringify(afterEditReload));
    check('EDIT+RELOAD: edited threshold (3) survives a hard reload', /ROAS is less than 3/i.test(afterEditReload || ''), afterEditReload);
    await page.screenshot({ path: SHOT_DIR + '/real_after_edit.png', fullPage: false });

    // ── TOGGLE OFF ───────────────────────────────────────────────────────
    await page.click('.ap-auto-toggle');
    await page.waitForTimeout(1500);
    const afterToggleOff = await page.evaluate(() => (document.querySelector('.ap-auto-status') || {}).textContent);
    check('TOGGLE OFF: card shows PAUSED', /PAUSED/i.test(afterToggleOff || ''), afterToggleOff);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
    await page.evaluate(async () => { const { data: { user } } = await window.SB.auth.getUser(); window._currentUser = user; if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user); if (typeof _loadUserProfile === 'function') await _loadUserProfile(user); });
    await page.waitForTimeout(900);
    await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
    await page.waitForSelector('.ap-auto-card, .ap-auto-empty', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    const toggleOffReload = await page.evaluate(() => (document.querySelector('.ap-auto-status') || {}).textContent);
    check('TOGGLE OFF + RELOAD: still PAUSED after hard reload', /PAUSED/i.test(toggleOffReload || ''), toggleOffReload);

    // ── TOGGLE ON ────────────────────────────────────────────────────────
    await page.click('.ap-auto-toggle');
    await page.waitForTimeout(1500);
    const afterToggleOn = await page.evaluate(() => (document.querySelector('.ap-auto-status') || {}).textContent);
    check('TOGGLE ON: card shows MONITORING', /MONITORING/i.test(afterToggleOn || ''), afterToggleOn);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
    await page.evaluate(async () => { const { data: { user } } = await window.SB.auth.getUser(); window._currentUser = user; if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user); if (typeof _loadUserProfile === 'function') await _loadUserProfile(user); });
    await page.waitForTimeout(900);
    await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
    await page.waitForSelector('.ap-auto-card, .ap-auto-empty', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    const toggleOnReload = await page.evaluate(() => (document.querySelector('.ap-auto-status') || {}).textContent);
    check('TOGGLE ON + RELOAD: still MONITORING after hard reload', /MONITORING/i.test(toggleOnReload || ''), toggleOnReload);
    await page.screenshot({ path: SHOT_DIR + '/real_toggle_state.png', fullPage: false });

    // ── SAFE TEST (read-only, must not mutate) ──────────────────────────
    await page.click('.ap-auto-card');
    await page.waitForTimeout(500);
    const beforeTestDb = await supabaseAdmin.from('automation_rules').select('last_triggered_at').eq('id', ruleId).maybeSingle();
    // Trigger apBTest via the rule detail's Edit->Test path (opens builder with editingRuleId set).
    await page.click('#apRuleDetailOverlay button[onclick*="apActiveEdit"]');
    await page.waitForTimeout(700);
    await page.click('#apBTestBtn');
    await page.waitForTimeout(1500);
    const testResult = await page.evaluate(() => (document.getElementById('apBTestResult') || {}).innerText);
    console.log('TEST RESULT:', JSON.stringify(testResult));
    // A disposable test user has no real ad-platform connection, so the honest, correct
    // response is "not connected" — NOT a fabricated match/no-match. Both are valid,
    // non-fake outcomes; only a raw error/exception text would be a real failure here.
    check('TEST: shows a real, honest result (match/no-match, or honestly "not connected") — never a fake state', /trigger|checked|none currently|not connected/i.test(testResult || ''), testResult);
    const afterTestDb = await supabaseAdmin.from('automation_rules').select('last_triggered_at, enabled').eq('id', ruleId).maybeSingle();
    check('TEST: does NOT mutate last_triggered_at (read-only, confirmed via direct DB query)', beforeTestDb.data && afterTestDb.data && beforeTestDb.data.last_triggered_at === afterTestDb.data.last_triggered_at, { before: beforeTestDb.data, after: afterTestDb.data });
    await page.screenshot({ path: SHOT_DIR + '/real_test_result.png', fullPage: false });
    await page.click('#apBuilderOverlay .intel-mon-close-btn');
    await page.waitForTimeout(400);

    // ── DELETE ───────────────────────────────────────────────────────────
    page.on('dialog', d => d.accept());
    await page.click('.ap-auto-card .oi-why-toggle:has-text("Delete")');
    await page.waitForTimeout(1000);
    const afterDelete = await page.evaluate(() => document.querySelectorAll('.ap-auto-card').length);
    check('DELETE: no real rule card remains', afterDelete === 0, afterDelete);
    const { data: dbAfterDelete } = await supabaseAdmin.from('automation_rules').select('*').eq('id', ruleId);
    check('DELETE: real row is gone from automation_rules (verified via direct Supabase query)', dbAfterDelete && dbAfterDelete.length === 0, dbAfterDelete);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
    await page.evaluate(async () => { const { data: { user } } = await window.SB.auth.getUser(); window._currentUser = user; if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user); if (typeof _loadUserProfile === 'function') await _loadUserProfile(user); });
    await page.waitForTimeout(900);
    await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
    await page.waitForSelector('.ap-auto-card, .ap-auto-empty', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    const afterDeleteReload = await page.evaluate(() => ({
      cardCount: document.querySelectorAll('.ap-auto-card').length,
      hasTeachingTemplate: !!document.querySelector('.ap-auto-empty'),
    }));
    console.log('AFTER DELETE + RELOAD:', JSON.stringify(afterDeleteReload));
    check('DELETE+RELOAD: rule stays deleted after hard reload (zero-state teaching template shown again)', afterDeleteReload.cardCount === 0 && afterDeleteReload.hasTeachingTemplate, afterDeleteReload);
    await page.screenshot({ path: SHOT_DIR + '/real_after_delete.png', fullPage: false });
    ruleId = null; // already deleted, nothing to clean up

    await page.close();
  } finally {
    await browser.close();
    if (ruleId) { try { await supabaseAdmin.from('automation_rules').delete().eq('id', ruleId); } catch (_) {} }
    try { await supabaseAdmin.from('profiles').delete().eq('id', userId); } catch (_) {}
    try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
  }
  const failed = results.filter(r => !r.pass);
  console.log('\n=== REAL DATABASE LIFECYCLE SUMMARY: ' + (results.length - failed.length) + '/' + results.length + ' passed ===');
  if (failed.length) { console.log('FAILURES:', failed.map(f => f.name).join(' | ')); process.exitCode = 1; }
}
main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
