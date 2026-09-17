// ════════════════════════════════════════════════════════════════
// Autopilot — UX Redesign (rule-list workspace, not a dashboard)
//
// Covers the specific NEW/changed behaviors this sprint introduced that
// aren't already exercised by tests/autopilot-control-room.test.js
// (System Status, Simulation, Rule Detail basics, plan gating, mobile,
// a11y, nav regression — 43/43 passing, re-verified unmodified except one
// scenario updated to match the relocated Simulation block) or
// tests/autopilot-builder-lifecycle.test.js (builder open/save/cancel,
// toggle round-trip, TikTok capability gating, no Engine/AI-Decision —
// 17/17 passing, unmodified): the centered header, removed Monitoring
// Sources/Suggested-by-Oriven/Autopilot-Activity homepage sections, real
// "N active · M paused" count, MONITORING/PAUSED wording, the new
// per-automation execution summary (_apExecutionSummary) in all its real
// states, the relocated "Needs your approval" fallback, Rule Detail's new
// Edit/Turn off/Delete actions, and specific-campaign scope persistence.
//
// RUN: node tests/autopilot-ux-redesign.test.js
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

async function createTestUser(suffix) {
  const email = `oriven.apux.test+${Date.now()}.${suffix}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'professional', onboarding_completed: true }, { onConflict: 'id' });
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
async function mockAutopilot(page, { rules, recommendations, historyItems, campaigns }) {
  await page.evaluate(({ rules, recommendations, historyItems, campaigns }) => {
    window._apCalls = [];
    var state = { rules: (rules || []).slice() };
    window._apMockState = state;
    var real = window.apiFetch;
    window.apiFetch = async function (path, options) {
      var method = (options && options.method) || 'GET';
      var body = options && options.body ? JSON.parse(options.body) : null;
      window._apCalls.push({ path: path, method: method, body: body });
      if (path === '/api/autopilot/rules' && method === 'GET') return { ok: true, status: 200, data: { rules: state.rules } };
      if (path === '/api/autopilot/rules' && method === 'POST') {
        var nr = Object.assign({ id: 'new_' + Math.random().toString(36).slice(2), enabled: true, last_triggered_at: null, created_at: new Date().toISOString() }, body);
        state.rules.push(nr);
        return { ok: true, status: 200, data: { rule: nr } };
      }
      var m = path.match(/^\/api\/autopilot\/rules\/([^/]+)$/);
      if (m && method === 'PATCH') {
        var r = state.rules.filter((x) => x.id === m[1])[0];
        if (r) Object.assign(r, body, body.action_params ? { action_params: Object.assign({}, r.action_params, body.action_params) } : {});
        return { ok: true, status: 200, data: { rule: r } };
      }
      if (m && method === 'DELETE') { state.rules = state.rules.filter((x) => x.id !== m[1]); return { ok: true, status: 200, data: {} }; }
      if (path.indexOf('/api/autopilot/recommendations') === 0) return { ok: true, status: 200, data: { recommendations: recommendations || [] } };
      if (path.indexOf('/api/autopilot/history') === 0) return { ok: true, status: 200, data: { items: historyItems || [] } };
      if (path === '/api/google-ads/campaigns' || path === '/api/meta/campaigns' || path === '/api/tiktok/campaigns') {
        return { ok: true, status: 200, data: { campaigns: campaigns || [{ campaign_id: 'c1', campaign_name: 'Autumn Sale' }] } };
      }
      return real(path, options);
    };
  }, { rules, recommendations, historyItems, campaigns });
}
function makeRule(overrides) {
  return Object.assign({
    id: 'rule_' + Math.random().toString(36).slice(2),
    user_id: 'x', name: 'CTR Alert', platform: 'meta',
    trigger_metric: 'ctr', trigger_operator: '<', trigger_value: 1,
    action_type: 'pause_campaign', action_params: { mode: 'require_approval', campaign_id: 'all' },
    enabled: true, last_triggered_at: null, created_at: new Date().toISOString(),
  }, overrides);
}
function makeRecommendation(overrides) {
  return Object.assign({
    id: 'rec_' + Math.random().toString(36).slice(2),
    problem: 'Automation rule "CTR Alert" triggered: ctr < 1 for "Autumn Sale".',
    suggested_action: 'Pause the creative or campaign to stop wasted spend.',
    platform: 'meta', campaign_name: 'Autumn Sale', type: 'pause_campaign',
    evidence: { metric: 'ctr', operator: '<', value: 1, actual: 0.74 },
    tool_name: 'pause_campaign', tool_params: { campaignName: 'Autumn Sale', platform: 'meta' },
    status: 'suggested',
  }, overrides);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let proUser;
  try {
    proUser = await createTestUser('pro');

    // ════════════════════════════════════════════════════════════
    // 1. Centered header — title centered relative to the main content
    //    column, not the browser viewport (same pattern as Campaigns).
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, proUser);
      await mockAutopilot(page, { rules: [], recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => {
        const hdr = document.querySelector('.ap-shell-hdr');
        const title = document.querySelector('.ap-shell-hdr .camp-shell-title');
        // NOTE: unlike #page-performance, #page-autopilot is (a real,
        // PRE-EXISTING structural quirk, confirmed via el.parentElement --
        // not introduced by this sprint, and not touched by it) NOT nested
        // inside .mc -- it's a direct flex child of .app, sized by the
        // ".app > .page.active" rule instead. .mc is therefore the wrong
        // reference element for this specific page; #page-autopilot's own
        // rect is what a real user actually sees as "the main content
        // area" here, so that's what centering is measured against.
        const contentEl = document.getElementById('page-autopilot');
        const titleRect = title ? title.getBoundingClientRect() : null;
        const contentRect = contentEl ? contentEl.getBoundingClientRect() : null;
        return {
          title: title ? title.textContent : null,
          textAlign: hdr ? getComputedStyle(hdr).textAlign : null,
          titleCenter: titleRect ? (titleRect.left + titleRect.right) / 2 : null,
          contentCenter: contentRect ? (contentRect.left + contentRect.right) / 2 : null,
          ctaExists: !!document.querySelector('.ap-shell-hdr .camp-new-btn-lg'),
        };
      });
      const centerDiff = (st.titleCenter !== null && st.contentCenter !== null) ? Math.abs(st.titleCenter - st.contentCenter) : null;
      check('1. "Autopilot" title is centered relative to the main content column', st.title === 'Autopilot' && st.textAlign === 'center' && centerDiff !== null && centerDiff <= 4, { ...st, centerDiff });
      check('1b. "+ Create automation" CTA lives in the centered header', st.ctaExists, st.ctaExists);
      check('JS errors (header)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 2-4. Removed homepage sections — no Monitoring Sources dashboard,
    //    no Suggested by Oriven, no standalone Autopilot Activity.
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rules = [makeRule({ name: 'Pause inefficient campaigns' })];
      const historyItems = [
        { kind: 'event', id: 'h1', title: 'Automation "Old Pattern" executed automatically', status: 'detected', created_at: new Date().toISOString() },
        { kind: 'event', id: 'h2', title: 'Automation "Old Pattern" executed automatically', status: 'detected', created_at: new Date().toISOString() },
        { kind: 'event', id: 'h3', title: 'Automation "Old Pattern" executed automatically', status: 'detected', created_at: new Date().toISOString() },
      ];
      await mockAutopilot(page, { rules, recommendations: [], historyItems });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => {
        const text = document.getElementById('page-autopilot').innerText;
        return {
          hasSourcesSection: !!document.getElementById('apSourcesSection'),
          hasSuggestionsSection: !!document.getElementById('apSuggestionsSection'),
          hasHistorySection: !!document.getElementById('apHistorySection'),
          hasMonitoringSourcesText: /Monitoring Sources/i.test(text),
          hasSuggestedText: /Suggested by Oriven/i.test(text),
          hasActivityHeading: /Autopilot Activity/i.test(text),
          hasSearchBar: !!document.getElementById('apHistorySearch'),
          hasFilterPills: !!document.getElementById('apActivityFilters'),
        };
      });
      check('2. No large Monitoring Sources dashboard section/heading', !st.hasSourcesSection && !st.hasMonitoringSourcesText, st);
      check('3. No "Suggested by Oriven" homepage section', !st.hasSuggestionsSection && !st.hasSuggestedText, st);
      check('4. No standalone "Autopilot Activity" section/search/filter pills', !st.hasHistorySection && !st.hasActivityHeading && !st.hasSearchBar && !st.hasFilterPills, st);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 5-6. Real "N active · M paused" count, never fabricated
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rules = [makeRule({ enabled: true }), makeRule({ enabled: true }), makeRule({ enabled: false })];
      await mockAutopilot(page, { rules, recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      const countText = await page.evaluate(() => document.getElementById('apActiveCount').textContent);
      check('5. "Your Automations" count reflects the real mix (2 active · 1 paused)', /2 active/i.test(countText) && /1 paused/i.test(countText), countText);
      await page.close();
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      await mockAutopilot(page, { rules: [makeRule({ enabled: true })], recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      const countText = await page.evaluate(() => document.getElementById('apActiveCount').textContent);
      check('6. All-enabled count never fabricates a "paused" segment ("1 active" only)', /1 active/i.test(countText) && !/paused/i.test(countText), countText);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 7-8. MONITORING / PAUSED — real, exactly-two-state ON/OFF wording
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rules = [makeRule({ name: 'On Rule', enabled: true }), makeRule({ name: 'Off Rule', enabled: false })];
      await mockAutopilot(page, { rules, recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.ap-auto-card'));
        return cards.map((c) => ({ name: c.querySelector('.ap-auto-title').textContent, status: c.querySelector('.ap-auto-status').textContent.trim() }));
      });
      const on = st.filter((c) => c.name === 'On Rule')[0];
      const off = st.filter((c) => c.name === 'Off Rule')[0];
      check('7. Enabled rule reads "MONITORING" (not "ACTIVE"/"Running")', on && /MONITORING/i.test(on.status), on);
      check('8. Disabled rule reads "PAUSED"', off && /PAUSED/i.test(off.status), off);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 9-12. Execution summary — every real state, never fabricated
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const neverRule = makeRule({ name: 'Never Rule', last_triggered_at: null });
      const okRule = makeRule({ name: 'OK Rule', action_type: 'pause_campaign' });
      const failedRule = makeRule({ name: 'Failed Rule', action_type: 'increase_budget' });
      const waitingRule = makeRule({ name: 'Waiting Rule', action_params: { mode: 'require_approval', campaign_id: 'all' } });
      const rules = [neverRule, okRule, failedRule, waitingRule];
      const now = new Date().toISOString();
      const historyItems = [
        { kind: 'event', id: 'h1', title: 'Automation "OK Rule" executed automatically', status: 'detected', created_at: now },
        { kind: 'recommendation', id: 'h2', title: 'Automation rule "Failed Rule" triggered: budget > 0 for "Autumn Sale".', status: 'failed', created_at: now },
      ];
      const recommendations = [makeRecommendation({ problem: 'Automation rule "Waiting Rule" triggered: ctr < 1 for "Autumn Sale".' })];
      await mockAutopilot(page, { rules, recommendations, historyItems });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => {
        const out = {};
        document.querySelectorAll('.ap-auto-card').forEach((c) => {
          out[c.querySelector('.ap-auto-title').textContent] = c.querySelector('.ap-auto-exec').textContent.trim();
        });
        return out;
      });
      check('9. A rule with no real event/timestamp honestly says "Never triggered"', /never triggered/i.test(st['Never Rule'] || ''), st['Never Rule']);
      check('10. A rule with a real resolved event shows "Last triggered" + its real configured action', /last triggered/i.test(st['OK Rule'] || '') && /Campaign paused/i.test(st['OK Rule'] || ''), st['OK Rule']);
      check('11. A rule with a real failed event honestly says "Execution failed"', /execution failed/i.test(st['Failed Rule'] || ''), st['Failed Rule']);
      check('12. A rule with a real pending recommendation says "Waiting for approval"', /waiting for approval/i.test(st['Waiting Rule'] || ''), st['Waiting Rule']);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 13. "Needs your approval" — only for pending items that do NOT
    //     match any current rule; hidden when everything matches.
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rule = makeRule({ name: 'Matched Rule' });
      const matchedRec = makeRecommendation({ problem: 'Automation rule "Matched Rule" triggered: ctr < 1 for "Autumn Sale".' });
      const unmatchedRec = makeRecommendation({ id: 'rec_unmatched', problem: '"Weekend Sale" has spent without producing conversions.' });
      await mockAutopilot(page, { rules: [rule], recommendations: [matchedRec, unmatchedRec], historyItems: [] });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => ({
        visible: document.getElementById('apUnmatchedApprovalsSection').style.display !== 'none',
        cardCount: document.querySelectorAll('#apUnmatchedApprovalsList .ap-pending-card').length,
      }));
      check('13. "Needs your approval" shows exactly the one unmatched pending item, not the rule-matched one', st.visible && st.cardCount === 1, st);
      await page.close();
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rule = makeRule({ name: 'Matched Rule' });
      const matchedRec = makeRecommendation({ problem: 'Automation rule "Matched Rule" triggered: ctr < 1 for "Autumn Sale".' });
      await mockAutopilot(page, { rules: [rule], recommendations: [matchedRec], historyItems: [] });
      await gotoAutopilot(page);
      const visible = await page.evaluate(() => document.getElementById('apUnmatchedApprovalsSection').style.display !== 'none');
      check('13b. "Needs your approval" stays hidden when every pending item matches a current rule', !visible, visible);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 14-15. Rule Detail — STATUS/SCOPE/LAST EXECUTION + real actions
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rule = makeRule({ name: 'Detail Rule', enabled: true });
      await mockAutopilot(page, { rules: [rule], recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      await page.click('.ap-auto-card');
      await page.waitForTimeout(400);
      const before = await page.evaluate(() => document.getElementById('apRuleDetailBody').textContent);
      check('14. Rule Detail shows STATUS/SCOPE/LAST EXECUTION rows and Edit/Turn off/Delete actions', /STATUS/.test(before) && /MONITORING/i.test(before) && /SCOPE/.test(before) && /LAST EXECUTION/.test(before) && /Edit automation/i.test(before) && /Turn off/i.test(before) && /Delete/i.test(before), before);

      // "Turn off" sends a real PATCH and the detail + card both reflect it.
      await page.click('.ap-rd-actions button:nth-of-type(2)');
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => ({
        patchCall: window._apCalls.filter((c) => c.method === 'PATCH').slice(-1)[0],
        detailStatus: document.getElementById('apRuleDetailBody').textContent,
        cardStatus: document.querySelector('.ap-auto-card .ap-auto-status').textContent,
      }));
      check('15. Rule Detail\'s "Turn off" sends a real PATCH {enabled:false} and both the detail and the card update to PAUSED', after.patchCall && after.patchCall.body.enabled === false && /PAUSED/i.test(after.detailStatus) && /PAUSED/i.test(after.cardStatus), after);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 16. Edit persists correctly — a real PATCH with the updated value
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, proUser);
      const rule = makeRule({ name: 'Editable Rule', trigger_value: 1 });
      await mockAutopilot(page, { rules: [rule], recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      await page.evaluate((id) => { apActiveEdit(id); }, rule.id);
      await page.waitForTimeout(700);
      await page.evaluate(() => { document.getElementById('apWizValue').value = '2.5'; });
      await page.evaluate(() => apWizConfirmCondition());
      await page.waitForTimeout(300);
      await page.evaluate(() => apBSave());
      await page.waitForTimeout(500);
      const st = await page.evaluate(() => {
        var patchCalls = window._apCalls.filter((c) => c.method === 'PATCH');
        return { patchCall: patchCalls[patchCalls.length - 1], cardText: document.querySelector('.ap-auto-flow-trigger')?.textContent };
      });
      check('16. Editing an existing automation sends a real PATCH with the updated condition value', st.patchCall && st.patchCall.body.trigger_value === 2.5, st.patchCall);
      check('16b. The list reflects the real edited value after save', /2\.5/.test(st.cardText || ''), st.cardText);
      check('JS errors (edit flow)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 17. Specific-campaign scope persists correctly (not just "all")
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      await mockAutopilot(page, { rules: [], recommendations: [], historyItems: [], campaigns: [{ campaign_id: 'camp_77', campaign_name: 'Black Friday Push' }] });
      await gotoAutopilot(page);
      await page.evaluate(() => { apOpenBuilder(); apWizStart(); });
      await page.evaluate(() => apWizSelectPlatform('google'));
      await page.waitForTimeout(400);
      await page.evaluate(() => apWizLoadCampaigns());
      await page.waitForTimeout(300);
      await page.evaluate(() => apWizSelectCampaign('camp_77'));
      await page.waitForTimeout(400);
      await page.evaluate(() => apWizSelectMetric('conversions'));
      await page.evaluate(() => apWizSelectOperator('=='));
      await page.evaluate(() => { document.getElementById('apWizValue').value = '0'; });
      await page.evaluate(() => apWizConfirmCondition());
      await page.waitForTimeout(300);
      await page.evaluate(() => apWizSelectAction('pause_campaign'));
      await page.waitForTimeout(300);
      await page.evaluate(() => apBSave());
      await page.waitForTimeout(500);
      const st = await page.evaluate(() => ({
        postCall: window._apCalls.filter((c) => c.method === 'POST')[0],
        meta: document.querySelector('.ap-auto-meta')?.textContent,
      }));
      check('17. Selecting a SPECIFIC campaign (not "All Campaigns") persists its real id/name in action_params', st.postCall && st.postCall.body.action_params.campaign_id === 'camp_77' && st.postCall.body.action_params.campaign_name === 'Black Friday Push', st.postCall);
      check('17b. The card\'s meta line shows the real specific campaign name, not "All Campaigns"', /Black Friday Push/.test(st.meta || '') && !/All Campaigns/i.test(st.meta || ''), st.meta);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 18. Mobile — centered header + no overflow with a populated list
    //     and a visible "Needs your approval" block
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, proUser);
      const rules = [makeRule({ name: 'Mobile Rule' })];
      const unmatchedRec = makeRecommendation({ id: 'rec_m', problem: '"Weekend Sale" has spent without producing conversions.' });
      await mockAutopilot(page, { rules, recommendations: [unmatchedRec], historyItems: [] });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        textAlign: getComputedStyle(document.querySelector('.ap-shell-hdr')).textAlign,
        approvalsVisible: document.getElementById('apUnmatchedApprovalsSection').style.display !== 'none',
      }));
      check('18. [mobile 390px] Header stays centered, no overflow, "Needs your approval" renders without breaking layout', !st.overflow && st.textAlign === 'center' && st.approvalsVisible, st);
      check('JS errors (mobile)', jsErrors.length === 0, jsErrors);
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
