// ════════════════════════════════════════════════════════════════
// Autopilot — AI Control Room (Autopilot Control Room sprint)
//
// Covers: real System Status computation (OFF/ARMED/ARMED·AUTO-EXECUTE),
// honest empty states, Mode badges, Pending Approvals with real Simulation
// (state-preview only for tool-backed recommendations, honest fallback
// otherwise), Rule Detail, no fabricated data, plan-gate fix, mobile,
// accessibility, and nav/Campaigns/Launch/Create regression.
//
// ENVIRONMENT NOTE: `automation_rules`/`autopilot_recommendations` do not
// exist in this dev Supabase project's schema cache (confirmed directly —
// GET /api/autopilot/rules and /recommendations both 500 with "Could not
// find the table ... in the schema cache"). This is a pre-existing
// environmental gap, not something this sprint introduced or can fix (no
// migration tooling exists in this codebase — see docs/DATABASE.md). Real
// HTTP is used for auth/plan-gating (the `profiles` table is real); the
// Autopilot-specific data routes are mocked via window.apiFetch so the
// real frontend logic (System Status, Mode badges, Simulation, Rule
// Detail) can still be exercised end-to-end against realistic response
// shapes. This mirrors the exact mocking convention already established
// for Meta performance data in the Campaign Replay sprint's tests.
//
// RUN: node tests/autopilot-control-room.test.js
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
  const email = `oriven.autopilot.test+${Date.now()}.${suffix}@example.com`;
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
  await page.waitForTimeout(1500);
}
// Mocks ONLY the Autopilot-specific routes (real tables missing in this
// dev environment, see header) -- everything else passes through to the
// real apiFetch, so auth/plan-gating/credits stay real.
async function mockAutopilotData(page, { rules, recommendations, historyItems }) {
  await page.evaluate(({ rules, recommendations, historyItems }) => {
    const real = window.apiFetch;
    window.apiFetch = async function (path, options) {
      if (path.indexOf('/api/autopilot/rules') === 0 && (!options || options.method === undefined)) {
        return { ok: true, status: 200, data: { rules: rules || [] } };
      }
      if (path.indexOf('/api/autopilot/recommendations') === 0 && (!options || options.method === undefined)) {
        return { ok: true, status: 200, data: { recommendations: recommendations || [] } };
      }
      if (path.indexOf('/api/autopilot/history') === 0) {
        return { ok: true, status: 200, data: { items: historyItems || [] } };
      }
      return real(path, options);
    };
  }, { rules, recommendations, historyItems });
}

function makeRule(overrides) {
  return Object.assign({
    id: 'rule_' + Math.random().toString(36).slice(2),
    user_id: 'x', name: 'CTR Alert', platform: 'meta',
    trigger_metric: 'ctr', trigger_operator: '<', trigger_value: 1,
    action_type: 'pause_campaign', action_params: { mode: 'require_approval', campaign_name: 'Autumn Sale' },
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
  let proUser, creatorUser, starterUser;
  try {
    proUser = await createTestUser('pro', 'professional');
    creatorUser = await createTestUser('creator', 'creator');
    starterUser = await createTestUser('starter', 'starter');

    // ════════════════════════════════════════════════════════════
    // 1. Empty state — no rules -> honest OFF, real empty copy
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, proUser);
      await mockAutopilotData(page, { rules: [], recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => ({
        active: document.getElementById('page-autopilot').classList.contains('active'),
        statusLabel: document.getElementById('apSystemStatusLabel').textContent,
        statusSub: document.getElementById('apSystemStatusSub').textContent,
        // Living Product pass: "Your Automations" now stays visible at zero
        // automations too, showing a structural IF/THEN teaching template
        // (spec: the page must not become a giant empty void) instead of
        // being hidden entirely. It is NOT a real rule (no status dot, mode
        // badge, toggle, or metadata a genuine automation would have; every
        // value is a bracketed placeholder) and its own CTA is deliberately
        // a quieter secondary button (.oi-card-btn), not a second
        // .camp-new-btn-lg competing with the header's real primary CTA --
        // so the PRIMARY-CTA count correctly stays 1 even though the
        // section itself is visible.
        activeSectionVisible: document.getElementById('apActiveSection')?.style.display !== 'none',
        hasTeachingTemplate: !!document.querySelector('#page-autopilot .ap-auto-empty'),
        hasRealRuleCard: !!document.querySelector('#page-autopilot .ap-auto-card'),
        primaryCtaCount: document.querySelectorAll('#page-autopilot .camp-new-btn, #page-autopilot .camp-new-btn-lg').length,
      }));
      check('1. Autopilot page loads for a Professional-plan user', st.active, st.active);
      check('2. System OFF state shown honestly when no rules exist', st.statusLabel === 'OFF' && /nothing is being evaluated/i.test(st.statusSub), st);
      check('3. Zero automations: "Your Automations" stays visible with a structural teaching template (not a real rule card), and the primary Create Automation CTA stays singular', st.activeSectionVisible && st.hasTeachingTemplate && !st.hasRealRuleCard && st.primaryCtaCount === 1, st);
      check('JS errors (empty state)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 4. Configured/ARMED state — real enabled rules, no auto-execute
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rules = [makeRule({ name: 'CTR Alert' }), makeRule({ name: 'Budget Watch', action_type: 'notify', action_params: { mode: 'require_approval' } })];
      await mockAutopilotData(page, { rules, recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => ({
        statusLabel: document.getElementById('apSystemStatusLabel').textContent,
        statusSub: document.getElementById('apSystemStatusSub').textContent,
        cardCount: document.querySelectorAll('.ap-auto-card').length,
        modeBadges: Array.from(document.querySelectorAll('.ap-modebadge')).map((b) => b.textContent),
      }));
      check('4. ARMED state shown for enabled, non-auto rules', st.statusLabel === 'ARMED' && /notify you or request approval/i.test(st.statusSub), st);
      check('5. Real rule cards render for each real rule', st.cardCount === 2, st.cardCount);
      check('6. Mode badges reflect real config: APPROVAL REQUIRED + ALERT ONLY (notify)', st.modeBadges.includes('APPROVAL REQUIRED') && st.modeBadges.includes('ALERT ONLY'), st.modeBadges);
      check('6b. Cadence is honestly described as every 4 hours, never "real-time"/"continuous"', /every 4 hours/i.test(st.statusSub) && !/real.?time|continuous/i.test(st.statusSub), st.statusSub);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 7. AUTO-EXECUTE state — at least one fully_automatic rule
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rules = [makeRule({ action_params: { mode: 'fully_automatic', campaign_name: 'Autumn Sale' } })];
      await mockAutopilotData(page, { rules, recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => ({
        statusLabel: document.getElementById('apSystemStatusLabel').textContent,
        statusSub: document.getElementById('apSystemStatusSub').textContent,
        modeBadge: document.querySelector('.ap-modebadge')?.textContent,
      }));
      check('7. ARMED · AUTO-EXECUTE shown only when a real fully_automatic rule exists', st.statusLabel === 'ARMED · AUTO-EXECUTE' && /may execute an action automatically/i.test(st.statusSub), st);
      check('7b. Rule card shows AUTO EXECUTE badge', st.modeBadge === 'AUTO EXECUTE', st.modeBadge);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 8. Disabled-only rules -> OFF, not ARMED (real, not just "any rule exists")
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rules = [makeRule({ enabled: false })];
      await mockAutopilotData(page, { rules, recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      const statusLabel = await page.evaluate(() => document.getElementById('apSystemStatusLabel').textContent);
      check('8. All-disabled rules correctly reads OFF, not ARMED (state reflects enabled rules only)', statusLabel === 'OFF', statusLabel);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 9. Pending Approval + Simulation — tool-backed recommendation
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, proUser);
      const rec = makeRecommendation({});
      await mockAutopilotData(page, { rules: [], recommendations: [rec], historyItems: [] });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => ({
        pendingFact: document.getElementById('apHeroPendingFact')?.textContent,
        evidenceText: document.querySelector('.ap-pending-evidence')?.textContent,
        simLabel: document.querySelector('.ap-sim-label')?.textContent,
        simRow: document.querySelector('.ap-sim-row')?.textContent,
        hasApprove: !!document.querySelector('.oi-card-btn-primary'),
      }));
      check('9. Hero shows a real "N pending your approval" fact', /1 pending your approval/i.test(st.pendingFact || ''), st.pendingFact);
      check('10. Real evidence is shown (metric/operator/value/observed), not invented', /ctr/i.test(st.evidenceText || '') && /0\.74/.test(st.evidenceText || ''), st.evidenceText);
      check('11. Simulation is clearly labeled SIMULATION — NOT EXECUTED', /SIMULATION.*NOT EXECUTED/i.test(st.simLabel || ''), st.simLabel);
      check('12. Simulation shows the real deterministic state change for a tool-backed action (Autumn Sale -> PAUSED)', /Autumn Sale/.test(st.simRow || '') && /PAUSED/.test(st.simRow || ''), st.simRow);
      check('13. Approve action is available', st.hasApprove, st.hasApprove);
      check('JS errors (pending approval)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 14. Pending Approval — NON-tool-backed recommendation must NOT
    //     show a fabricated state-change simulation
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rec = makeRecommendation({ type: 'increase_budget', tool_name: null, tool_params: null, evidence: { metric: 'roas', operator: '>', value: 4, actual: 5.2 } });
      await mockAutopilotData(page, { rules: [], recommendations: [rec], historyItems: [] });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => ({
        hasRow: !!document.querySelector('.ap-sim-row'),
        noteText: document.querySelector('.ap-sim-note')?.textContent,
      }));
      check('14. No fabricated state-change preview for a recommendation with no real attached tool (budget-change today has none)', !st.hasRow, st.hasRow);
      check('15. Honest fallback message explains no automatic action is attached', /no automatic action is attached/i.test(st.noteText || ''), st.noteText);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 16. Rule Detail — real fields only, no fabricated "last trigger"
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rule = makeRule({ name: 'Never Fired Rule', last_triggered_at: null });
      await mockAutopilotData(page, { rules: [rule], recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      await page.click('.ap-auto-card');
      await page.waitForTimeout(400);
      const st = await page.evaluate(() => ({
        visible: document.getElementById('apRuleDetailOverlay').style.display !== 'none',
        title: document.getElementById('apRuleDetailTitle').textContent,
        bodyText: document.getElementById('apRuleDetailBody').textContent,
      }));
      check('16. Clicking a rule card opens Rule Detail with the real rule name', st.visible && st.title === 'Never Fired Rule', st);
      check('17. WHEN/THEN/MODE/SCOPE/LIMITS all show real derived values', /CTR/i.test(st.bodyText) && /Pause Campaign/i.test(st.bodyText) && /APPROVAL REQUIRED/i.test(st.bodyText) && /Professional plan only/i.test(st.bodyText), st.bodyText);
      check('18. A rule that never triggered honestly says "Never triggered", not a fabricated timestamp', /Never triggered/i.test(st.bodyText), st.bodyText);
      await page.click('#apRuleDetailOverlay .intel-mon-close-btn');
      await page.waitForTimeout(300);
      const closed = await page.evaluate(() => document.getElementById('apRuleDetailOverlay').style.display === 'none');
      check('19. Rule Detail closes correctly', closed, closed);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 20. Real "last triggered" IS shown when it genuinely exists
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const ts = new Date(Date.now() - 3 * 3600000).toISOString();
      const rule = makeRule({ name: 'Fired Rule', last_triggered_at: ts });
      await mockAutopilotData(page, { rules: [rule], recommendations: [], historyItems: [] });
      await gotoAutopilot(page);
      await page.click('.ap-auto-card');
      await page.waitForTimeout(400);
      const bodyText = await page.evaluate(() => document.getElementById('apRuleDetailBody').textContent);
      check('20. A rule with a real last_triggered_at shows that real timestamp', !/Never triggered/i.test(bodyText) && new RegExp(new Date(ts).getFullYear()).test(bodyText), bodyText);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 21. Plan gating — the real bug fix: Creator no longer reaches
    //     a broken page; Starter still correctly gated
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, creatorUser);
      await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
      await page.waitForTimeout(1000);
      const st = await page.evaluate(() => ({
        autopilotActive: document.getElementById('page-autopilot')?.classList.contains('active'),
        paywallVisible: !!document.querySelector('.modal-paywall, #modal-paywall, [id*="limitReached"], [id*="LimitReached"]') || document.body.innerText.includes('Professional'),
      }));
      check('21. Creator-plan user is now correctly gated away from Autopilot (real bug fix) instead of reaching a broken empty page', !st.autopilotActive, st);
      await page.close();
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, starterUser);
      await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
      await page.waitForTimeout(1000);
      const autopilotActive = await page.evaluate(() => document.getElementById('page-autopilot')?.classList.contains('active'));
      check('22. Starter-plan user is still correctly gated away from Autopilot (regression)', !autopilotActive, autopilotActive);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 23. Backend authorization — real HTTP, real 403 for Creator/Starter
    // ════════════════════════════════════════════════════════════
    {
      const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: creatorSignIn } = await authClient.auth.signInWithPassword({ email: creatorUser.email, password: creatorUser.password });
      const r = await fetch('http://localhost:5500/api/autopilot/rules', { headers: { Authorization: 'Bearer ' + creatorSignIn.session.access_token } });
      const body = await r.json().catch(() => ({}));
      check('23. Backend requireAutopilotAccess correctly rejects Creator plan (403 AUTOPILOT_NOT_AVAILABLE)', r.status === 403 && body.code === 'AUTOPILOT_NOT_AVAILABLE', { status: r.status, body });
      check('23b. Error message correctly says "Professional plan" (stale "Creator or Professional" copy fixed)', /professional plan/i.test(body.error || '') && !/creator or professional/i.test(body.error || ''), body.error);
      const rNoAuth = await fetch('http://localhost:5500/api/autopilot/rules');
      check('24. No-auth request rejected 401', rNoAuth.status === 401, rNoAuth.status);
    }

    // ════════════════════════════════════════════════════════════
    // 25. No fabricated data anywhere in the rendered Control Room
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rules = [makeRule({})];
      const rec = makeRecommendation({});
      await mockAutopilotData(page, { rules, recommendations: [rec], historyItems: [{ id: 1, title: 'Published "Autumn Sale" to Meta Ads', created_at: new Date().toISOString(), status: 'executed' }] });
      await gotoAutopilot(page);
      const noFake = await page.evaluate(() => {
        const text = document.getElementById('page-autopilot').innerText;
        return !/estimated ROI|estimated improvement|\$[\d,]+ in additional revenue|VERIFIED\b/i.test(text);
      });
      check('25. No AI-estimated ROI/improvement figures or fabricated "VERIFIED" claims anywhere on the page', noFake, noFake);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 26. Mobile — no overflow, Control Room usable
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, proUser);
      // rec (default name "CTR Alert") matches the first rule (also
      // default-named "CTR Alert") -- UX Redesign sprint: a rule-matched
      // pending approval now shows compactly on its own card ("Waiting
      // for approval") and only its full evidence/Simulation inside that
      // rule's Detail view, not directly on the homepage.
      const rules = [makeRule({}), makeRule({ action_params: { mode: 'fully_automatic', campaign_name: 'X' } })];
      const rec = makeRecommendation({});
      await mockAutopilotData(page, { rules, recommendations: [rec], historyItems: [] });
      await gotoAutopilot(page);
      const st = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        statusVisible: !!document.getElementById('apSystemStatusPill').offsetParent,
        execWaitingVisible: Array.from(document.querySelectorAll('.ap-auto-exec')).some((el) => /Waiting for approval/i.test(el.textContent)),
      }));
      check('26. [mobile 390px] No horizontal overflow on Autopilot Control Room', !st.overflow, st.overflow);
      check('26b. [mobile] System Status visible and the matched rule\'s card honestly shows "Waiting for approval"', st.statusVisible && st.execWaitingVisible, st);
      await page.click('.ap-auto-card >> nth=0');
      await page.waitForTimeout(400);
      const detail = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        simVisible: !!document.querySelector('.ap-sim-block'),
      }));
      check('26c. [mobile] Opening that rule\'s Detail reveals the full Simulation block (relocated from the old Activity section)', detail.simVisible, detail);
      check('27. [mobile] Rule Detail modal does not cause overflow', !detail.overflow, detail.overflow);
      check('JS errors (mobile)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 28. Accessibility basics
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, proUser);
      const rec = makeRecommendation({});
      await mockAutopilotData(page, { rules: [makeRule({})], recommendations: [rec], historyItems: [] });
      await gotoAutopilot(page);
      const a11y = await page.evaluate(() => ({
        approveIsButton: document.querySelector('.oi-card-btn-primary')?.tagName === 'BUTTON',
        toggleIsCheckbox: document.querySelector('.ap-auto-toggle input')?.type === 'checkbox',
        closeIsButton: document.getElementById('apRuleDetailOverlay')?.querySelector('.intel-mon-close-btn')?.tagName === 'BUTTON',
      }));
      check('28. Approve/Reject are real <button> elements, not styled divs', a11y.approveIsButton, a11y.approveIsButton);
      check('29. Rule enable/disable is a real checkbox input', a11y.toggleIsCheckbox, a11y.toggleIsCheckbox);
      check('30. Modal close controls are real buttons', a11y.closeIsButton, a11y.closeIsButton);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 31. Regression — nav, Campaigns, Launch, Create untouched
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, proUser);
      await page.evaluate(() => { _orvNav('create', 'page-create'); });
      await page.waitForTimeout(500);
      const createOk = await page.evaluate(() => document.getElementById('page-create').classList.contains('active') && !!document.getElementById('aicInput'));
      check('32. Create still works unchanged', createOk, createOk);

      await page.evaluate(() => { _orvNav('launch', 'page-launch'); });
      await page.waitForTimeout(500);
      const launchOk = await page.evaluate(() => document.getElementById('page-launch')?.classList.contains('active'));
      check('33. Launch still works unchanged', launchOk, launchOk);

      await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
      await page.waitForTimeout(500);
      const campOk = await page.evaluate(() => document.getElementById('page-performance')?.classList.contains('active'));
      check('34. Campaigns still works unchanged', campOk, campOk);

      await page.evaluate(() => { _orvNav('autopilot', 'page-autopilot'); });
      await page.waitForTimeout(500);
      // A Professional-plan test user also has the real "Team" nav item
      // visible (_orvUpdateTeamNavVisibility, app.html) -- that's genuine,
      // correct, plan-gated behavior, not part of what this sprint touches,
      // so it's checked separately from the 6 canonical product items.
      const navOrder = await page.evaluate(() => Array.from(document.querySelectorAll('.orv-sb .orv-ni[data-orv-page]')).filter((b) => b.style.display !== 'none').map((b) => b.getAttribute('data-tip')));
      const canonical = navOrder.filter((n) => n !== 'Team');
      check('35. Global nav order unchanged (Create, Research, Launch, Campaigns, Autopilot, Business)', JSON.stringify(canonical) === JSON.stringify(['Create', 'Research', 'Launch', 'Campaigns', 'Autopilot', 'Business']), navOrder);
      check('JS errors (regression)', jsErrors.length === 0, jsErrors);
      await page.close();
    }
  } finally {
    if (proUser) await deleteTestUser(proUser.userId);
    if (creatorUser) await deleteTestUser(creatorUser.userId);
    if (starterUser) await deleteTestUser(starterUser.userId);
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
