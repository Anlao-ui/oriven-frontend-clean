// ════════════════════════════════════════════════════════════════
// Campaigns — Performance Workspace (Composition pass)
//
// Verifies the real two-column workspace: the old Performance Summary
// strip, the giant metric-pill field, and the Campaigns-specific
// floating AI/sparkle button remain removed entirely (not hidden); the
// provider tabs + hierarchy/object/date controls share the SAME left
// boundary as the one primary graph below them (spec: "the provider tabs
// should begin at EXACTLY the same horizontal left boundary as the left
// performance column"); ONE primary graph surface exists on the left
// with its own compact header metric select, followed by a compact
// Metric Explorer sourced from the shared metrics.js registry and kept
// in sync with the graph's active metric (one shared state, not two
// independent selections); Campaign Replay lives in the right column;
// provider switching safely reconciles the active metric; fullscreen
// expand preserves the active metric with no duplicate chart ids; the
// global ORIVEN intelligence control is untouched.
//
// This file previously verified a TWO-graph composition
// (#prfChartsGridA/#prfChartsGridB, independently-selected metrics,
// per-graph fullscreen independence). That composition was replaced
// this session by ONE primary graph + a compact Metric Explorer (spec:
// "there is no strong product reason for Campaigns to dedicate that
// much visual space to exactly TWO metrics"). Every assertion below was
// rewritten against the current single-graph architecture; none of the
// old two-graph-specific assertions were kept as-is.
//
// RUN: node tests/campaigns-performance-workspace.test.js
// ════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const BASE_URL = process.env.TEST_FRONTEND_URL || 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH
  || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env — aborting.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond });
  console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail !== undefined ? ' (' + JSON.stringify(detail) + ')' : ''));
}

async function createTestUser(suffix) {
  const email = `oriven.campws.test+${Date.now()}.${suffix}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'creator', onboarding_completed: true }, { onConflict: 'id' });
  return { userId, email, password };
}
async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('profiles').delete().eq('id', userId); } catch (_) {}
  try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
}
async function signIn(page, user) {
  await page.addInitScript(() => localStorage.setItem('oriven_settings', JSON.stringify({ theme: 'dark' })));
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: signInData } = await authClient.auth.signInWithPassword({ email: user.email, password: user.password });
  await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); },
    { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
  await page.evaluate(async () => {
    const { data: { user } } = await window.SB.auth.getUser();
    window._currentUser = user;
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user);
    if (typeof _loadUserProfile === 'function') await _loadUserProfile(user);
  });
  await page.waitForTimeout(900);
}

const META_CAMPAIGNS = [{ campaign_id: 'm1', campaign_name: 'Meta Retargeting', status: 'ACTIVE', spend: 210.4, impressions: 30000, clicks: 640, ctr: 2.1, conversions: 21, conversionValue: 980, roas: 4.6, reach: 18000, frequency: 1.6, cpm: 7.0, linkClicks: 520, daily_budget: 2500 }];
const TIKTOK_CAMPAIGNS = [{ id: 't1', name: 'TikTok Launch', status: 'ENABLE', spend: 75.0, impressions: 12000, clicks: 300, ctr: 2.5, conversions: 6, reach: 9000, frequency: 1.3, cpm: 6.2, budget: 20 }];
const EVENTS = [
  { id: 'ev1', platform: 'meta', campaign_name: 'Meta Retargeting', title: 'Published Meta Retargeting', created_at: new Date(Date.now() - 2 * 86400000).toISOString(), type: 'campaign_action' },
  { id: 'ev2', platform: 'meta', campaign_name: 'Meta Retargeting', title: 'Budget changed to €25/day', created_at: new Date(Date.now() - 5 * 86400000).toISOString(), type: 'campaign_action' },
];

async function mockAll(page) {
  await page.route('**/api/*/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true, ready: true }) }));
  await page.route('**/api/ads/overview**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ overview: { spend: 1 }, campaigns: [] }) }));
  await page.route('**/api/meta/campaigns**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ campaigns: META_CAMPAIGNS }) }));
  await page.route('**/api/tiktok/overview**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ overview: { spend: 75 }, campaigns: TIKTOK_CAMPAIGNS }) }));
  await page.route('**/api/pinterest/overview**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ overview: { spend: 1 }, campaigns: [] }) }));
  await page.route('**/api/intelligence/events**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: EVENTS }) }));
  await page.route('**/api/intelligence/kpi-series**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ series: [] }) }));
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let user;
  try {
    user = await createTestUser('a');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
    await mockAll(page);
    await signIn(page, user);
    await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
    await page.waitForTimeout(900);
    await page.click('.prf-ptab-meta');
    await page.waitForTimeout(1000);

    // ── STRUCTURE ──────────────────────────────────────────────────────
    const structure = await page.evaluate(() => ({
      noSummaryStrip: !document.getElementById('prfSummaryStrip'),
      noSummaryItems: document.querySelectorAll('.prf-summary-item').length === 0,
      noPillField: !document.getElementById('prfMetricSelector'),
      noAiTrigger: !document.getElementById('prfAiTrigger'),
      noAiSection: !document.getElementById('prfAiSection'),
      noCreativeSection: !document.getElementById('prfCreativeSection'),
      noOldCampaignsSection: !document.getElementById('prfCampaignsSection'),
      oneGraphExists: document.querySelectorAll('.prf-chart-card').length === 1,
      noGraphBRemnants: !document.getElementById('prfChartsGridB') && !document.getElementById('prfGraphSelectB') && !document.getElementById('prfChartCardB'),
      noGraphHeaderSelect: !document.getElementById('prfGraphSelect'),
      hasMetricExplorer: !!document.getElementById('prfMetricExplorer'),
      globalOrivenBtnExists: !!document.getElementById('orvAiFab'),
    }));
    check('1/2. Performance Summary (Spend/CTR/CPC/Conversions/ROAS strip) no longer exists', structure.noSummaryStrip && structure.noSummaryItems, structure);
    check('3. Campaigns-specific sparkle/AI button (#prfAiTrigger) is gone', structure.noAiTrigger, structure);
    check('3b. The AI Analysis / Creative Intelligence cards it was the only entry point to are also gone (not left permanently unreachable)', structure.noAiSection && structure.noCreativeSection, structure);
    check('5. Old giant metric-pill field (#prfMetricSelector) is gone', structure.noPillField, structure);
    check('6. Exactly ONE primary graph surface exists (the two-graph system stays removed, not reintroduced)', structure.oneGraphExists && structure.noGraphBRemnants, structure);
    check('6b. The Metric Explorer exists, and is now the ONE visible metric-selection mechanism (the graph\'s own redundant header select is gone)', structure.hasMetricExplorer && structure.noGraphHeaderSelect, structure);
    check('setup: old #prfCampaignsSection wrapper is gone too (its only real content was the removed AI trigger + a relocated honest message)', structure.noOldCampaignsSection, structure);

    // 4. Global ORIVEN control remains untouched — verified elsewhere in the
    // app (it's a shared, page-independent element); here we only confirm
    // Campaigns removing its OWN AI button didn't also remove the global one.
    check('4. Global ORIVEN intelligence control still exists (Campaigns removing its own AI button did not touch it)', structure.globalOrivenBtnExists, structure);

    // 7/8. Campaign Replay is a right-column sibling of the performance
    // column, not a wide strip underneath everything.
    const replayLayout = await page.evaluate(() => {
      const row = document.getElementById('prfWorkspaceRow');
      const perf = document.getElementById('prfPerfCol');
      const replay = document.getElementById('prfReplayCol');
      const replaySection = document.getElementById('prfReplaySection');
      return {
        replayInsideWorkspaceRow: row.contains(replay),
        replayIsSiblingOfPerf: replay.parentElement === row && perf.parentElement === row,
        replayNotBelowEverything: replay.getBoundingClientRect().top < (perf.getBoundingClientRect().top + perf.getBoundingClientRect().height),
        replaySectionInsideReplayCol: replay.contains(replaySection),
      };
    });
    check('7. Campaign Replay sits in the right workspace column on desktop (sibling of the performance column, not a strip below it)', replayLayout.replayInsideWorkspaceRow && replayLayout.replayIsSiblingOfPerf && replayLayout.replayNotBelowEverything, replayLayout);
    check('8. The old full-width bottom Replay composition is gone (Replay lives inside .prf-replay-col now)', replayLayout.replaySectionInsideReplayCol, replayLayout);

    // 9. Top context row architecture remains, AND (final Composition
    // polish pass) is now a real two-column grid: left controls
    // (Campaigns/object/date, #prfScopeRow) share the exact left edge
    // with the primary graph directly below them; provider tabs
    // (#prfPlatTabs) moved to the right column and share the exact left
    // edge with Campaign Replay directly below THEM — and critically, the
    // graph's top edge and Replay's top edge land on the exact same line
    // (the row-1 heights on both columns were made to match).
    const topControls = await page.evaluate(() => {
      const scopeRow = document.getElementById('prfScopeRow');
      const platTabs = document.getElementById('prfPlatTabs');
      const graphCard = document.getElementById('prfChartCard');
      const replaySection = document.getElementById('prfReplaySection');
      const r = (el) => el ? el.getBoundingClientRect() : null;
      return {
        hasProviderTabs: document.querySelectorAll('#prfPlatTabsInner .prf-ptab').length === 4,
        hasHierarchySelect: !!document.getElementById('prfHierarchySelect'),
        hasObjectSelect: !!document.getElementById('prfCampSelect'),
        hasRangeSelect: !!document.getElementById('prfRangeSelect'),
        scopeRow: r(scopeRow), platTabs: r(platTabs), graph: r(graphCard), replay: r(replaySection),
        noHeroCenterWrapper: !document.getElementById('prfHeroCenter'),
      };
    });
    check('9. Top provider -> hierarchy -> object -> date-range architecture remains intact', topControls.hasProviderTabs && topControls.hasHierarchySelect && topControls.hasObjectSelect && topControls.hasRangeSelect, topControls);
    check('9b. Left controls (Campaigns/object/date) share the exact left edge with the primary graph below them', topControls.scopeRow && topControls.graph && Math.abs(topControls.scopeRow.left - topControls.graph.left) < 1.5, topControls);
    check('9c. Provider tabs share the exact left edge with Campaign Replay below them (moved to the right column, not the left)', topControls.platTabs && topControls.replay && Math.abs(topControls.platTabs.left - topControls.replay.left) < 1.5, topControls);
    check('9d. The primary graph and Campaign Replay share the exact same top edge (0-1px delta) — the critical alignment requirement', topControls.graph && topControls.replay && Math.abs(topControls.graph.top - topControls.replay.top) <= 1, { delta: topControls.graph && topControls.replay ? topControls.graph.top - topControls.replay.top : null });
    check('9e. The old separately centered #prfHeroCenter wrapper is gone', topControls.noHeroCenterWrapper, topControls);

    // ── PROVIDER SWITCH RECONCILIATION (forced invalid selection) ───────
    await page.evaluate(() => { prfSelectMetric('roas'); }); // valid for Meta
    await page.waitForTimeout(300);
    await page.click('.prf-ptab-tiktok'); // TikTok does not support ROAS
    await page.waitForTimeout(800);
    const reconciled = await page.evaluate(() => ({
      activeMetric: window._prfActiveMetric,
      roasOfferedInExplorer: Array.from(document.querySelectorAll('#prfExplorerGrid .prf-explorer-tile')).some((t) => t.getAttribute('data-metric') === 'roas'),
      activeExplorerTile: document.querySelector('#prfExplorerGrid .prf-explorer-tile-active') ? document.querySelector('#prfExplorerGrid .prf-explorer-tile-active').getAttribute('data-metric') : null,
    }));
    check('provider switch reconciliation: an active metric (ROAS) that becomes unsupported on the new platform (TikTok) resolves to a real valid alternative, never left stale/invalid', reconciled.activeMetric !== 'roas' && !reconciled.roasOfferedInExplorer, reconciled);
    check('provider switch reconciliation: the Metric Explorer\'s active tile follows the same resolved metric (one shared state, no leftover stale ROAS tile)', reconciled.activeExplorerTile === reconciled.activeMetric, reconciled);

    // ── FULLSCREEN: preserves active metric, no duplicate chart ids ─────
    await page.click('.prf-ptab-meta');
    await page.waitForTimeout(800);
    await page.click('#prfExplorerGrid .prf-explorer-tile[data-metric="reach"]');
    await page.waitForTimeout(400);
    await page.click('#prfChartsGrid .prf-chart-expand-btn');
    await page.waitForTimeout(400);
    const fs1 = await page.evaluate(() => ({
      overlayExists: !!document.getElementById('prfChartFsOverlay'),
      fsTitle: (document.getElementById('prfFsTitle') || {}).textContent,
      fsMetric: window._prfFsMetric,
      duplicateChartCardIds: document.querySelectorAll('[id="prfChartCard"]').length,
    }));
    check('fullscreen: expanding the graph shows its real active metric/platform, no duplicate #prfChartCard id in the DOM', fs1.overlayExists && /Reach Over Time/i.test(fs1.fsTitle) && fs1.fsMetric === 'reach' && fs1.duplicateChartCardIds === 1, fs1);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const afterFsClose = await page.evaluate(() => ({
      activeMetric: window._prfActiveMetric,
      graphTitle: (document.querySelector('.prf-chart-title') || {}).textContent,
      overlayGone: !document.getElementById('prfChartFsOverlay'),
    }));
    check('fullscreen: closing returns to the same metric on the small card, no stale state, overlay fully removed', afterFsClose.activeMetric === 'reach' && afterFsClose.graphTitle === 'Reach Over Time' && afterFsClose.overlayGone, afterFsClose);

    // Keyboard activation of the expand button still works (accessibility).
    await page.focus('#prfChartsGrid .prf-chart-expand-btn');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const fsViaKeyboard = await page.evaluate(() => !!document.getElementById('prfChartFsOverlay'));
    check('fullscreen: the expand button is keyboard-activatable (Enter) — accessibility preserved', fsViaKeyboard);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    check('JS errors during the full workspace walkthrough', jsErrors.length === 0, jsErrors);
    await page.close();

    // ── LIGHT MODE + REDUCED MOTION sanity ──────────────────────────────
    {
      const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce' });
      const jsErrors2 = []; page2.on('pageerror', (e) => jsErrors2.push(e.message));
      await mockAll(page2);
      await page2.addInitScript(() => localStorage.setItem('oriven_settings', JSON.stringify({ theme: 'light' })));
      const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: signInData } = await authClient.auth.signInWithPassword({ email: user.email, password: user.password });
      await page2.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
      await page2.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
      await page2.evaluate(async () => {
        const { data: { user } } = await window.SB.auth.getUser();
        window._currentUser = user;
        if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user);
        if (typeof _loadUserProfile === 'function') await _loadUserProfile(user);
      });
      await page2.waitForTimeout(900);
      await page2.evaluate(() => { _orvNav('performance', 'page-performance'); });
      await page2.waitForTimeout(900);
      await page2.click('.prf-ptab-meta');
      await page2.waitForTimeout(800);
      const lightState = await page2.evaluate(() => ({
        isDark: document.body.classList.contains('dark-mode'),
        graphRenders: !!document.querySelector('.prf-chart-title'),
        explorerRenders: document.querySelectorAll('#prfExplorerGrid .prf-explorer-tile').length > 0,
      }));
      check('light mode: workspace renders correctly (real graph title + Metric Explorer tiles) without dark-mode class', !lightState.isDark && lightState.graphRenders && lightState.explorerRenders, lightState);
      check('reduced motion + light mode: no JS errors', jsErrors2.length === 0, jsErrors2);
      await page2.close();
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
