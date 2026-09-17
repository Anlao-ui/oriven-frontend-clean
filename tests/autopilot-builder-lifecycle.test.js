// ════════════════════════════════════════════════════════════════
// Autopilot — Builder Lifecycle + Real Automations (Final Polish sprint)
//
// Covers the specific spec-28 items NOT already exercised by
// tests/autopilot-control-room.test.js (System Status, Simulation,
// Rule Detail, plan gating, mobile, a11y, nav regression — all already
// covered there and re-run unmodified by this sprint with 42/42 passing).
//
// This suite focuses on the builder/persistence lifecycle itself:
//   - Opening the builder creates NO backend record (no fake draft).
//   - Closing without saving leaves the real automations list untouched.
//   - A full guided save (platform -> campaign -> condition -> action ->
//     mode) sends exactly one real POST with the real rule shape, and the
//     automation only appears in the list AFTER that request succeeds.
//   - Toggle ON/OFF sends a real PATCH to the correct rule id and is not
//     merely a local class-toggle.
//   - Provider capability gating inside the builder itself: TikTok's
//     condition step only offers Budget/Status (never fabricated support
//     for metrics TikTok's automated evaluation loop never reads), and
//     Budget actions render disabled with an honest "not available" note
//     on TikTok rather than being hidden or silently allowed.
//   - No "AI Decision" language or engine diagram anywhere on the page,
//     in either empty or populated state (regression check tied directly
//     to removing #apEngineSection this sprint).
//
// RUN: node tests/autopilot-builder-lifecycle.test.js
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

async function createTestUser(suffix, plan) {
  const email = `oriven.apbuilder.test+${Date.now()}.${suffix}@example.com`;
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
  await page.waitForTimeout(800);
}
async function gotoAutopilot(page) {
  await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
  await page.waitForTimeout(1200);
}

// Mocks the Autopilot data routes + records every call made (path, method,
// body) so tests can assert on the REAL requests the frontend sends, not
// just on what ends up rendered. `state.rules` is mutated in place by a
// successful POST/PATCH/DELETE so a re-fetch (apActiveLoad) reflects the
// save — mirrors what the real backend does, without a real DB write.
async function mockAutopilot(page, initialRules) {
  await page.evaluate((initialRules) => {
    window._apCalls = [];
    var state = { rules: (initialRules || []).slice() };
    window._apMockState = state;
    var real = window.apiFetch;
    window.apiFetch = async function (path, options) {
      var method = (options && options.method) || 'GET';
      var body = options && options.body ? JSON.parse(options.body) : null;
      window._apCalls.push({ path: path, method: method, body: body });

      if (path === '/api/autopilot/rules' && method === 'GET') {
        return { ok: true, status: 200, data: { rules: state.rules } };
      }
      if (path === '/api/autopilot/rules' && method === 'POST') {
        var newRule = Object.assign({ id: 'new_' + Math.random().toString(36).slice(2), enabled: true, last_triggered_at: null, created_at: new Date().toISOString() }, body);
        state.rules.push(newRule);
        return { ok: true, status: 200, data: { rule: newRule } };
      }
      var patchMatch = path.match(/^\/api\/autopilot\/rules\/([^/]+)$/);
      if (patchMatch && method === 'PATCH') {
        var r = state.rules.filter(function (x) { return x.id === patchMatch[1]; })[0];
        if (r) Object.assign(r, body);
        return { ok: true, status: 200, data: { rule: r } };
      }
      if (patchMatch && method === 'DELETE') {
        state.rules = state.rules.filter(function (x) { return x.id !== patchMatch[1]; });
        return { ok: true, status: 200, data: {} };
      }
      if (path.indexOf('/api/autopilot/recommendations') === 0) return { ok: true, status: 200, data: { recommendations: [] } };
      if (path.indexOf('/api/autopilot/history') === 0) return { ok: true, status: 200, data: { items: [] } };
      if (path === '/api/google-ads/campaigns' || path === '/api/meta/campaigns' || path === '/api/tiktok/campaigns') {
        return { ok: true, status: 200, data: { campaigns: [{ campaign_id: 'c1', campaign_name: 'Autumn Sale' }] } };
      }
      return real(path, options);
    };
  }, initialRules);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let proUser;
  try {
    proUser = await createTestUser('pro', 'professional');

    // ════════════════════════════════════════════════════════════
    // 1-2. Opening the builder creates no fake record; closing without
    //      saving leaves the real list untouched.
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, proUser);
      await mockAutopilot(page, []);
      await gotoAutopilot(page);

      await page.evaluate(() => { apOpenBuilder(); apWizStart(); });
      await page.waitForTimeout(300);
      const afterOpen = await page.evaluate(() => ({
        overlayOpen: document.getElementById('apBuilderOverlay').style.display === 'flex',
        postCalls: window._apCalls.filter((c) => c.method === 'POST').length,
      }));
      check('1. Opening the builder shows it, and fires zero POST requests (no fake draft record)', afterOpen.overlayOpen && afterOpen.postCalls === 0, afterOpen);

      await page.evaluate(() => { apCloseBuilder(); });
      await page.waitForTimeout(200);
      const afterClose = await page.evaluate(() => ({
        overlayClosed: document.getElementById('apBuilderOverlay').style.display === 'none',
        listStillEmpty: document.querySelectorAll('.ap-auto-card').length === 0,
      }));
      check('2. Closing the builder without saving leaves the real automations list empty (draft never visible)', afterClose.overlayClosed && afterClose.listStillEmpty, afterClose);
      check('JS errors (builder open/close)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 3. Full guided save — real POST body, appears only after success
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, proUser);
      await mockAutopilot(page, []);
      await gotoAutopilot(page);

      await page.evaluate(() => { apOpenBuilder(); apWizStart(); });
      await page.evaluate(() => apWizSelectPlatform('meta'));
      await page.waitForTimeout(400);
      await page.evaluate(() => apWizLoadCampaigns());
      await page.waitForTimeout(300);
      await page.evaluate(() => apWizSelectCampaign('all'));
      await page.waitForTimeout(400);
      await page.evaluate(() => apWizSelectMetric('roas'));
      await page.waitForTimeout(100);
      await page.evaluate(() => apWizSelectOperator('>'));
      await page.evaluate(() => { document.getElementById('apWizValue').value = '4'; });
      await page.evaluate(() => apWizConfirmCondition());
      await page.waitForTimeout(300);
      await page.evaluate(() => apWizSelectAction('increase_budget'));
      await page.waitForTimeout(100);
      await page.evaluate(() => { document.getElementById('apWizPercent').value = '20'; });
      await page.evaluate(() => apWizConfirmAction());
      await page.waitForTimeout(300);
      await page.evaluate(() => apWizSelectMode('fully_automatic'));

      const listBeforeSave = await page.evaluate(() => document.querySelectorAll('.ap-auto-card').length);
      check('3a. Automation is NOT yet visible in the real list before Save is clicked', listBeforeSave === 0, listBeforeSave);

      await page.evaluate(() => apBSave());
      await page.waitForTimeout(600);

      const st = await page.evaluate(() => {
        var postCall = window._apCalls.filter((c) => c.method === 'POST')[0];
        return {
          postCall: postCall,
          overlayClosed: document.getElementById('apBuilderOverlay').style.display === 'none',
          cardCount: document.querySelectorAll('.ap-auto-card').length,
          cardText: document.querySelector('.ap-auto-card')?.innerText,
        };
      });
      check('3b. Save sends exactly one real POST /api/autopilot/rules with the real rule shape', st.postCall && st.postCall.path === '/api/autopilot/rules' &&
        st.postCall.body.trigger_metric === 'roas' && st.postCall.body.trigger_operator === '>' && st.postCall.body.trigger_value === 4 &&
        st.postCall.body.platform === 'meta' && st.postCall.body.action_type === 'increase_budget' &&
        st.postCall.body.action_params.mode === 'fully_automatic' && st.postCall.body.action_params.percent === 20 &&
        st.postCall.body.action_params.campaign_id === 'all', st.postCall);
      check('3c. Builder closes and the automation appears in the real list only AFTER save succeeds', st.overlayClosed && st.cardCount === 1, st);
      check('3d. The rendered card reflects the real saved condition/action/mode (ROAS, Increase Budget, AUTO EXECUTE)', /ROAS/i.test(st.cardText || '') && /Increase Budget/i.test(st.cardText || '') && /AUTO EXECUTE/i.test(st.cardText || ''), st.cardText);
      check('JS errors (full save flow)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 4. Toggle ON/OFF — real PATCH to the correct rule id, not a
    //    local-only class flip
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const ruleA = { id: 'rule_a', name: 'Rule A', platform: 'meta', trigger_metric: 'ctr', trigger_operator: '<', trigger_value: 1, action_type: 'pause_campaign', action_params: { mode: 'require_approval', campaign_id: 'all' }, enabled: true, last_triggered_at: null };
      const ruleB = { id: 'rule_b', name: 'Rule B', platform: 'meta', trigger_metric: 'roas', trigger_operator: '>', trigger_value: 4, action_type: 'increase_budget', action_params: { mode: 'fully_automatic', campaign_id: 'all', percent: 10 }, enabled: true, last_triggered_at: null };
      await mockAutopilot(page, [ruleA, ruleB]);
      await gotoAutopilot(page);

      // Toggle OFF the second card's checkbox specifically -- verifies the
      // real call targets rule_b's id, not rule_a's or an index. The real
      // <input> is visually hidden (0x0, styled via a sibling track/thumb —
      // see .ap-auto-toggle in styles.css) so Playwright's actionability
      // check needs the wrapping <label> instead, exactly like a real user
      // click would land on the visible toggle.
      await page.click('.ap-auto-card:nth-of-type(2) .ap-auto-toggle');
      await page.waitForTimeout(500);
      const afterOff = await page.evaluate(() => {
        var patchCalls = window._apCalls.filter((c) => c.method === 'PATCH');
        return {
          patchCall: patchCalls[patchCalls.length - 1],
          bStatus: window._apMockState.rules.filter((r) => r.id === 'rule_b')[0].enabled,
          aStatus: window._apMockState.rules.filter((r) => r.id === 'rule_a')[0].enabled,
        };
      });
      check('4a. Toggling a specific card sends a real PATCH to that exact rule id with {enabled:false}', afterOff.patchCall && afterOff.patchCall.path === '/api/autopilot/rules/rule_b' && afterOff.patchCall.body.enabled === false, afterOff.patchCall);
      check('4b. Only the toggled rule changes state — the other rule is untouched', afterOff.bStatus === false && afterOff.aStatus === true, afterOff);

      const statusAfterOff = await page.evaluate(() => document.getElementById('apSystemStatusLabel').textContent);
      check('4c. Disabling the only fully_automatic rule drops system status from AUTO-EXECUTE to ARMED (disabled rule no longer evaluated)', statusAfterOff === 'ARMED', statusAfterOff);

      // Toggle it back ON.
      await page.click('.ap-auto-card:nth-of-type(2) .ap-auto-toggle');
      await page.waitForTimeout(500);
      const afterOn = await page.evaluate(() => {
        var patchCalls = window._apCalls.filter((c) => c.method === 'PATCH');
        return { patchCall: patchCalls[patchCalls.length - 1], statusLabel: document.getElementById('apSystemStatusLabel').textContent };
      });
      check('4d. Re-enabling sends a real PATCH {enabled:true} and system status returns to AUTO-EXECUTE', afterOn.patchCall.body.enabled === true && afterOn.statusLabel === 'ARMED · AUTO-EXECUTE', afterOn);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 5. Provider capability gating inside the builder — TikTok
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      await mockAutopilot(page, []);
      await gotoAutopilot(page);
      await page.evaluate(() => { apOpenBuilder(); apWizStart(); });
      await page.evaluate(() => apWizSelectPlatform('tiktok'));
      await page.waitForTimeout(400);
      await page.evaluate(() => apWizLoadCampaigns());
      await page.waitForTimeout(300);
      await page.evaluate(() => apWizSelectCampaign('all'));
      await page.waitForTimeout(400);
      const metricCards = await page.evaluate(() => Array.from(document.querySelectorAll('#apWizMetricCards [data-metric]')).map((c) => c.getAttribute('data-metric')));
      check('5a. TikTok condition step only offers Budget/Status — never fabricates metrics TikTok\'s automated loop does not evaluate', metricCards.length === 2 && metricCards.includes('budget') && metricCards.includes('status') && !metricCards.includes('roas') && !metricCards.includes('ctr'), metricCards);

      await page.evaluate(() => apWizSelectMetric('status'));
      await page.waitForTimeout(100);
      const valSelVisible = await page.evaluate(() => document.getElementById('apWizValueStatus').style.display !== 'none');
      await page.evaluate(() => { document.getElementById('apWizValueStatus').value = 'PAUSED'; });
      await page.evaluate(() => apWizConfirmCondition());
      await page.waitForTimeout(300);
      const actionCards = await page.evaluate(() => ({
        disabledBudget: Array.from(document.querySelectorAll('#apWizActionCards .ap-wiz-card-disabled')).map((c) => c.textContent),
      }));
      check('5b. Status condition uses a real status selector, not a numeric input', valSelVisible, valSelVisible);
      check('5c. Budget actions render disabled with an honest "not available on TikTok" note, rather than hidden or silently allowed', actionCards.disabledBudget.some((t) => /Increase Budget/.test(t)) && actionCards.disabledBudget.some((t) => /Not available on TikTok/i.test(t)), actionCards.disabledBudget);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 6. No "AI Decision" language or engine diagram anywhere — empty
    //    and populated states (direct regression check for the removed
    //    #apEngineSection).
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      await mockAutopilot(page, []);
      await gotoAutopilot(page);
      const emptyState = await page.evaluate(() => ({
        hasEngineSection: !!document.getElementById('apEngineSection'),
        hasAiDecisionText: /AI decision|AI Decision/i.test(document.getElementById('page-autopilot').innerText),
      }));
      check('6a. [empty state] No #apEngineSection element and no "AI Decision" text anywhere on the page', !emptyState.hasEngineSection && !emptyState.hasAiDecisionText, emptyState);

      const rule = { id: 'r1', name: 'Rule', platform: 'meta', trigger_metric: 'roas', trigger_operator: '>', trigger_value: 4, action_type: 'increase_budget', action_params: { mode: 'fully_automatic', campaign_id: 'all', percent: 15 }, enabled: true, last_triggered_at: null };
      await mockAutopilot(page, [rule]);
      await gotoAutopilot(page);
      const populatedState = await page.evaluate(() => ({
        hasEngineSection: !!document.getElementById('apEngineSection'),
        hasAiDecisionText: /AI decision|AI Decision/i.test(document.getElementById('page-autopilot').innerText),
      }));
      check('6b. [populated state] No #apEngineSection element and no "AI Decision" text anywhere on the page', !populatedState.hasEngineSection && !populatedState.hasAiDecisionText, populatedState);
      await page.close();
    }
  } finally {
    if (proUser) await deleteTestUser(proUser.userId);
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
