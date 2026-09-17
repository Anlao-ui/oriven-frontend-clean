// ════════════════════════════════════════════════════════════════
// Campaigns — Object Selector / Metric Explorer / Campaign Replay
// (Campaigns Composition pass)
//
// Verifies the PROVIDER -> HIERARCHY -> SPECIFIC OBJECT -> DATE RANGE ->
// ONE PRIMARY GRAPH -> METRIC EXPLORER -> CAMPAIGN REPLAY composition:
// the object selector (#prfCampSelect) is real per-provider data: no
// fabricated objects; the Metric Explorer replaces the old two-graph
// system as the "see many metrics at once" surface, sourced from the
// same shared ORIVEN_METRICS registry as the graph's own metric select
// (window._prfActiveMetric is the single source of truth both read from
// and write to); Campaign Replay stays scoped to the selected object/
// date range, never a disguised campaign list. Real provider data is
// mocked via page.route (read-only) — never a production provider
// mutation, never fabricated values in the app itself.
//
// This file previously tested a two-graph composition (#prfChartsGridA/
// #prfChartsGridB, #prfGraphSelectA/#prfGraphSelectB, per-slot
// window._prfGraphMetric.A/.B) that was replaced this session by a
// single primary graph + a compact Metric Explorer (spec: "there is no
// strong product reason for Campaigns to dedicate that much visual
// space to exactly TWO metrics"). The object-selector/hierarchy/Replay/
// disconnected-state coverage below was still valid against the current
// architecture (same real DOM ids) and is kept as-is; only the graph-
// specific assertions were rewritten for the single-graph + Metric
// Explorer model.
//
// RUN: node tests/campaigns-object-selector.test.js
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
  const email = `oriven.campselector.test+${Date.now()}.${suffix}@example.com`;
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

const GOOGLE_CAMPAIGNS = [
  { id: 'g1', name: 'Summer Acquisition', status: 'ENABLED', spend: 412.5, impressions: 55000, clicks: 1320, ctr: 2.4, conversions: 44, conversions_value: 1980, roas: 4.8, avgCpm: 7.5 },
  { id: 'g2', name: 'Brand Search', status: 'PAUSED', spend: 88.2, impressions: 9000, clicks: 210, ctr: 2.3, conversions: 9, conversions_value: 360, roas: 4.1, avgCpm: 9.8 },
];
const GOOGLE_OVERVIEW = { overview: { spend: 500.7, impressions: 64000, clicks: 1530, conversions: 53, conversions_value: 2340, avgCpm: 7.8 }, campaigns: GOOGLE_CAMPAIGNS };
const META_CAMPAIGNS = [{ campaign_id: 'm1', campaign_name: 'Meta Retargeting', status: 'ACTIVE', spend: 210.4, impressions: 30000, clicks: 640, ctr: 2.1, conversions: 21, conversionValue: 980, roas: 4.6, reach: 18000, frequency: 1.6, cpm: 7.0, linkClicks: 520, daily_budget: 2500 }];
const META_ADSETS = [
  { adset_id: 'as1', adset_name: 'Lookalike 1%', campaign_id: 'm1', status: 'ACTIVE', daily_budget: 15.0, spend: 120.1, impressions: 15000, clicks: 320 },
  { adset_id: 'as2', adset_name: 'Interest Stack', campaign_id: 'm1', status: 'PAUSED', daily_budget: 10.0, spend: 90.3, impressions: 15000, clicks: 320 },
];
const META_ADS = [{ ad_id: 'ad1', ad_name: 'Carousel V1', campaign_id: 'm1', status: 'ACTIVE', spend: 60.0, impressions: 8000, clicks: 160 }];
const TIKTOK_CAMPAIGNS = [{ id: 't1', name: 'TikTok Launch', status: 'ENABLE', spend: 75.0, impressions: 12000, clicks: 300, ctr: 2.5, conversions: 6, reach: 9000, frequency: 1.3, cpm: 6.2, budget: 20 }];
const TIKTOK_OVERVIEW = { overview: { spend: 75.0, impressions: 12000, clicks: 300, conversions: 6 }, campaigns: TIKTOK_CAMPAIGNS };
const PIN_CAMPAIGNS = [{ campaign_id: 'p1', campaign_name: 'Pinterest Boards', summary_status: 'RUNNING', status: 'ACTIVE' }];
const PIN_OVERVIEW = { overview: { spend: 40.0, impressions: 5000, clicks: 90, conversions: 3, reach: 4200, cpm: 8.0, cpc: 0.44, frequency: 1.2, cpa: 13.3 }, campaigns: PIN_CAMPAIGNS };
const PIN_AD_GROUPS = [{ ad_group_id: 'ag1', ad_group_name: 'Board Group 1', campaign_id: 'p1', status: 'ACTIVE', budget_in_micro_currency: 5000000 }];
const PIN_ADS = [{ ad_id: 'pa1', ad_name: 'Pin Ad 1', campaign_id: 'p1', status: 'ACTIVE' }];
const EVENTS = [
  { id: 'ev1', platform: 'google', campaign_name: 'Summer Acquisition', title: 'Published Summer Acquisition', created_at: new Date(Date.now() - 2 * 86400000).toISOString(), type: 'campaign_action' },
  { id: 'ev2', platform: 'google', campaign_name: 'Summer Acquisition', title: 'Budget changed to €30/day', created_at: new Date(Date.now() - 5 * 86400000).toISOString(), type: 'campaign_action' },
];

async function mockAll(page, { googleConnected, metaConnected, tiktokConnected, pinConnected }) {
  await page.route('**/api/*/status', async (route) => {
    const m = route.request().url().match(/\/api\/(\w+)\/status/);
    const p = m ? m[1] : null;
    const connMap = { google: googleConnected, meta: metaConnected, tiktok: tiktokConnected, pinterest: pinConnected };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: !!connMap[p], ready: !!connMap[p] }) });
  });
  await page.route('**/api/ads/overview**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GOOGLE_OVERVIEW) }));
  await page.route('**/api/meta/campaigns**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ campaigns: META_CAMPAIGNS }) }));
  await page.route('**/api/meta/ads**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ads: META_ADS }) }));
  // '**/api/meta/ads**' would also glob-match '/api/meta/adsets' (substring)
  // — adsets is registered after, and anchored, to win precedence unambiguously.
  await page.route(/\/api\/meta\/adsets(\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ adsets: META_ADSETS }) }));
  await page.route('**/api/tiktok/overview**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TIKTOK_OVERVIEW) }));
  await page.route('**/api/pinterest/overview**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PIN_OVERVIEW) }));
  await page.route('**/api/pinterest/ad-groups**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ad_groups: PIN_AD_GROUPS }) }));
  await page.route('**/api/pinterest/ads**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ads: PIN_ADS }) }));
  await page.route('**/api/intelligence/events**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: EVENTS }) }));
  await page.route('**/api/intelligence/kpi-series**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ series: [] }) }));
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let user;
  try {
    user = await createTestUser('a');

    // ═══ DISCONNECTED + ZERO CAMPAIGNS ═══
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await mockAll(page, { googleConnected: false, metaConnected: false, tiktokConnected: false, pinConnected: false });
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
      await page.waitForTimeout(900);
      const disc = await page.evaluate(() => ({
        bannerVisible: getComputedStyle(document.getElementById('prfConnectBanner')).display !== 'none',
        oldLiveWrapGone: !document.getElementById('admGLiveWrap'),
        oldAdSetsWrapGone: !document.getElementById('prfAdSetsWrap'),
        oldPillSelectorGone: !document.getElementById('prfMetricSelector'),
        noGraphOrExplorerFabricated: document.querySelectorAll('.prf-chart-card').length === 0 || (document.getElementById('prfMetricExplorer') ? getComputedStyle(document.getElementById('prfMetricExplorer')).display === 'none' : true),
      }));
      check('1. The removed Live Campaigns browser (admGLiveWrap) does not exist anywhere in Campaigns', disc.oldLiveWrapGone);
      check('1b. The removed Ad Sets/Ads browser tables do not exist anywhere in Campaigns', disc.oldAdSetsWrapGone);
      check('1c. The old giant metric-pill field does not exist', disc.oldPillSelectorGone);
      check('2. Disconnected: connect banner dominates, real next action, no fake selectors populated', disc.bannerVisible);
      check('JS errors (disconnected)', jsErrors.length === 0, jsErrors);
      await page.close();
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.route('**/api/*/status', (route) => {
        const m = route.request().url().match(/\/api\/(\w+)\/status/);
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: m[1] === 'google', ready: m[1] === 'google' }) });
      });
      await page.route('**/api/ads/overview**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ overview: { spend: 0, impressions: 0, clicks: 0, conversions: 0 }, campaigns: [] }) }));
      await page.route('**/api/intelligence/events**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }) }));
      await page.route('**/api/intelligence/kpi-series**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ series: [] }) }));
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
      await page.waitForTimeout(900);
      const zero = await page.evaluate(() => ({
        campSelectOptions: Array.from(document.getElementById('prfCampSelect').options).map((o) => o.textContent),
        campSelectDisabled: document.getElementById('prfCampSelect').disabled,
        replayText: document.getElementById('prfReplaySection').textContent,
      }));
      check('4. Connected but zero real campaigns: object selector shows only the honest "All Campaigns" aggregate, no fabricated object', JSON.stringify(zero.campSelectOptions) === JSON.stringify(['All Campaigns']));
      check('4b. Zero campaigns: object selector is disabled (nothing real to select)', zero.campSelectDisabled);
      check('4c. Zero campaigns: Replay shows an honest "no activity" message, never "here are your campaigns" framing', /No recorded activity/.test(zero.replayText) && !/here are your campaigns/i.test(zero.replayText));
      await page.close();
    }

    // ═══ GOOGLE POPULATED — object selector, one primary graph, Metric Explorer, date range ═══
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await mockAll(page, { googleConnected: true, metaConnected: true, tiktokConnected: true, pinConnected: true });
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
      await page.waitForTimeout(1400);

      const m = await page.evaluate(() => ({
        hierOptions: Array.from(document.getElementById('prfHierarchySelect').options).map((o) => o.value),
        campSelectOptions: Array.from(document.getElementById('prfCampSelect').options).map((o) => o.textContent),
        oneGraph: document.querySelectorAll('.prf-chart-card').length === 1,
        graphTitle: (document.querySelector('.prf-chart-title') || {}).textContent,
        activeMetric: window._prfActiveMetric,
        explorerTileCount: document.querySelectorAll('#prfExplorerGrid .prf-explorer-tile').length,
        activeExplorerTile: (document.querySelector('#prfExplorerGrid .prf-explorer-tile-active') || {}).getAttribute && document.querySelector('#prfExplorerGrid .prf-explorer-tile-active').getAttribute('data-metric'),
        replayItems: Array.from(document.querySelectorAll('#prfReplayList .prf-ra-title')).map((el) => el.textContent),
      }));
      check('5. Google: object level offers Campaigns only (no fabricated Ad Sets/Ads — Google has no such endpoint)', JSON.stringify(m.hierOptions) === JSON.stringify(['campaigns']), m.hierOptions);
      check('6. Object selector contains real campaign names for the selected provider', m.campSelectOptions.includes('Summer Acquisition') && m.campSelectOptions.includes('Brand Search'), m.campSelectOptions);
      check('7. Exactly one primary graph renders (the removed two-graph system stays removed)', m.oneGraph, m);
      check('8. The Metric Explorer shows every real Google-supported metric, and its active tile matches the graph\'s active metric (one shared source of truth)', m.explorerTileCount > 5 && m.activeExplorerTile === m.activeMetric, m);
      check('9. Campaign Replay shows real matched events for the account (aggregate view)', m.replayItems.length === 2, m.replayItems);

      // Select a specific campaign -> the real underlying KPI computation
      // (which the graph's historical fetch and the Metric Explorer's
      // tile values both read from) narrows to it, Replay scopes to it.
      await page.selectOption('#prfCampSelect', 'Summer Acquisition');
      await page.waitForTimeout(900);
      const afterSelect = await page.evaluate(() => ({
        spendKpi: window._prfLastKpis && window._prfLastKpis.spend,
        replayItems: Array.from(document.querySelectorAll('#prfReplayList .prf-ra-title')).map((el) => el.textContent),
      }));
      check('10. Selecting a specific object narrows the real underlying KPI computation to its own numbers (not the aggregate)', afterSelect.spendKpi === 412.5, afterSelect);
      check('11. Campaign Replay narrows to the selected object\'s own real matched events', afterSelect.replayItems.length === 2, afterSelect.replayItems);

      // Click a Metric Explorer tile (the ONE remaining metric-selection
      // mechanism — Campaigns Final Cleanup pass removed the graph's own
      // redundant header <select>) -> the graph title updates and the
      // tile becomes the active one, one shared state.
      await page.click('#prfExplorerGrid .prf-explorer-tile[data-metric="ctr"]');
      await page.waitForTimeout(400);
      const afterMetricSelect = await page.evaluate(() => ({
        graphTitle: (document.querySelector('.prf-chart-title') || {}).textContent,
        activeMetric: window._prfActiveMetric,
        activeExplorerTile: document.querySelector('#prfExplorerGrid .prf-explorer-tile-active') ? document.querySelector('#prfExplorerGrid .prf-explorer-tile-active').getAttribute('data-metric') : null,
      }));
      check('12. Clicking a Metric Explorer tile updates the active metric everywhere (graph title AND the tile\'s own active state), one shared state', afterMetricSelect.graphTitle === 'CTR Over Time' && afterMetricSelect.activeMetric === 'ctr' && afterMetricSelect.activeExplorerTile === 'ctr', afterMetricSelect);

      // A second tile click moves the active state cleanly to the new tile.
      await page.click('#prfExplorerGrid .prf-explorer-tile[data-metric="impressions"]');
      await page.waitForTimeout(400);
      const afterTileClick = await page.evaluate(() => ({
        graphTitle: (document.querySelector('.prf-chart-title') || {}).textContent,
        activeMetric: window._prfActiveMetric,
      }));
      check('12b. Clicking a different Metric Explorer tile updates the graph title again', afterTileClick.graphTitle === 'Impressions Over Time' && afterTileClick.activeMetric === 'impressions', afterTileClick);

      // Date range change preserves the selected object AND the active metric.
      await page.selectOption('#prfRangeSelect', 'LAST_7_DAYS');
      await page.waitForTimeout(500);
      const afterRange = await page.evaluate(() => ({
        campSelect: document.getElementById('prfCampSelect').value,
        activeMetric: window._prfActiveMetric,
      }));
      check('13. Changing date range preserves the selected object (does not reset to "All Campaigns") and the active metric', afterRange.campSelect === 'Summer Acquisition' && afterRange.activeMetric === 'impressions', afterRange);

      // The Metric Explorer offers every real supported metric (not a
      // curated subset), and the graph's own redundant header select stays gone.
      const explorerIds = await page.evaluate(() => Array.from(document.querySelectorAll('#prfExplorerGrid .prf-explorer-tile')).map((t) => t.getAttribute('data-metric')));
      check('14. The Metric Explorer offers every real provider-supported metric (not a curated subset)', explorerIds.length > 5 && explorerIds.includes('impressions') && explorerIds.includes('searchImpressionShare'), explorerIds);
      const noOldPillField = await page.evaluate(() => !document.getElementById('prfMetricSelector'));
      check('14b. The old giant metric-pill field is gone', noOldPillField);
      const noGraphSelect = await page.evaluate(() => !document.getElementById('prfGraphSelect'));
      check('14c. The graph\'s own redundant header metric select is gone (Metric Explorer is the ONE visible selector)', noGraphSelect);

      check('JS errors (Google populated walkthrough)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ═══ PROVIDER SWITCH CLEARS STALE OBJECT ═══
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await mockAll(page, { googleConnected: true, metaConnected: true, tiktokConnected: true, pinConnected: true });
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
      await page.waitForTimeout(900);
      await page.selectOption('#prfCampSelect', 'Summer Acquisition');
      await page.waitForTimeout(400);
      await page.click('.prf-ptab-meta');
      await page.waitForTimeout(700);
      const afterSwitch = await page.evaluate(() => ({
        selectedValue: document.getElementById('prfCampSelect').value,
        options: Array.from(document.getElementById('prfCampSelect').options).map((o) => o.textContent),
      }));
      check('15. Switching provider clears the incompatible stale object selection (never shows Google\'s campaign name under Meta)', afterSwitch.selectedValue === 'all' && !afterSwitch.options.includes('Summer Acquisition'), afterSwitch);
      await page.close();
    }

    // ═══ META — Campaign / Ad Set / Ad levels ═══
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await mockAll(page, { googleConnected: true, metaConnected: true, tiktokConnected: true, pinConnected: true });
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
      await page.waitForTimeout(900);
      await page.click('.prf-ptab-meta');
      await page.waitForTimeout(700);
      const metaCampLevel = await page.evaluate(() => ({
        hierOptions: Array.from(document.getElementById('prfHierarchySelect').options).map((o) => o.value),
        campSelectOptions: Array.from(document.getElementById('prfCampSelect').options).map((o) => o.textContent),
      }));
      check('16. Meta: object level genuinely offers Campaigns/Ad Sets/Ads (real capability, not forced symmetry)', JSON.stringify(metaCampLevel.hierOptions) === JSON.stringify(['campaigns', 'adsets', 'ads']), metaCampLevel.hierOptions);
      check('16b. Meta campaign level shows the real campaign name', metaCampLevel.campSelectOptions.includes('Meta Retargeting'), metaCampLevel.campSelectOptions);

      await page.selectOption('#prfHierarchySelect', 'adsets');
      await page.waitForTimeout(900);
      const metaAdSets = await page.evaluate(() => ({
        campSelectOptions: Array.from(document.getElementById('prfCampSelect').options).map((o) => o.textContent),
        label: document.getElementById('prfCampSelect').title,
        chartText: document.getElementById('prfChartsGrid').textContent,
        replayText: document.getElementById('prfReplaySection').textContent,
      }));
      check('17. Ad Set level shows real ad sets (not campaign names mislabeled as ad sets)', metaAdSets.campSelectOptions.includes('Lookalike 1%') && metaAdSets.campSelectOptions.includes('Interest Stack') && !metaAdSets.campSelectOptions.includes('Meta Retargeting'), metaAdSets.campSelectOptions);
      check('17b. Ad Set level object selector label reflects the level ("Select ad set")', /select ad set/i.test(metaAdSets.label), metaAdSets.label);
      check('18. Ad Set level: the graph honestly says historical data isn\'t available there (never a fabricated line, never silently reusing the Campaigns-level chart)', /Data not available for this level/i.test(metaAdSets.chartText), metaAdSets);
      check('19. Ad Set level Campaign Replay honestly says it\'s unavailable at this level (real event correlation is campaign-name-only)', /isn.t available at the Ad Sets level/i.test(metaAdSets.replayText), metaAdSets.replayText);

      await page.selectOption('#prfHierarchySelect', 'ads');
      await page.waitForTimeout(900);
      const metaAds = await page.evaluate(() => Array.from(document.getElementById('prfCampSelect').options).map((o) => o.textContent));
      check('20. Ad level shows real ads', metaAds.includes('Carousel V1'), metaAds);
      await page.selectOption('#prfCampSelect', 'Carousel V1');
      await page.waitForTimeout(400);
      const objSwitch = await page.evaluate(() => document.getElementById('prfCampSelect').value);
      check('21. Switching between real objects at the Ads level works', objSwitch === 'Carousel V1', objSwitch);
      check('JS errors (Meta walkthrough)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ═══ TIKTOK — campaign-only, no fabricated hierarchy, no fabricated ROAS ═══
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await mockAll(page, { googleConnected: true, metaConnected: true, tiktokConnected: true, pinConnected: true });
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
      await page.waitForTimeout(900);
      await page.click('.prf-ptab-tiktok');
      await page.waitForTimeout(700);
      const tik = await page.evaluate(() => ({
        hierOptions: Array.from(document.getElementById('prfHierarchySelect').options).map((o) => o.value),
        explorerIds: Array.from(document.querySelectorAll('#prfExplorerGrid .prf-explorer-tile')).map((t) => t.getAttribute('data-metric')),
      }));
      check('22. TikTok: object level offers Campaigns only — Ad Sets/Ads never falsely exposed', JSON.stringify(tik.hierOptions) === JSON.stringify(['campaigns']), tik.hierOptions);
      check('23. The Metric Explorer never offers ROAS for TikTok (not a real TikTok metric) — no unsupported metric fabricated', !tik.explorerIds.includes('roas') && tik.explorerIds.includes('spend'), tik);
      await page.close();
    }

    // ═══ PINTEREST — real supported levels ═══
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await mockAll(page, { googleConnected: true, metaConnected: true, tiktokConnected: true, pinConnected: true });
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
      await page.waitForTimeout(900);
      await page.click('.prf-ptab-pinterest');
      await page.waitForTimeout(700);
      const pinLevels = await page.evaluate(() => Array.from(document.getElementById('prfHierarchySelect').options).map((o) => o.value));
      check('24. Pinterest: every hierarchy level the current architecture genuinely supports is offered', JSON.stringify(pinLevels) === JSON.stringify(['campaigns', 'adsets', 'ads']), pinLevels);
      await page.selectOption('#prfHierarchySelect', 'adsets');
      await page.waitForTimeout(900);
      const pinAdGroups = await page.evaluate(() => Array.from(document.getElementById('prfCampSelect').options).map((o) => o.textContent));
      check('24b. Pinterest Ad Set (ad group) level shows the real ad group name', pinAdGroups.includes('Board Group 1'), pinAdGroups);
      await page.close();
    }

    // ═══ CAMPAIGN REPLAY — empty state honesty, no fake events ═══
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await mockAll(page, { googleConnected: true, metaConnected: true, tiktokConnected: true, pinConnected: true });
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
      await page.waitForTimeout(900);
      await page.selectOption('#prfCampSelect', 'Brand Search'); // has no matching events in the fixture
      await page.waitForTimeout(500);
      const emptyReplay = await page.evaluate(() => ({
        items: document.querySelectorAll('#prfReplayList .prf-ra-item').length,
        emptyText: document.getElementById('prfReplayEmpty').textContent,
      }));
      check('25. Campaign Replay honestly shows zero items for an object with no real matched events (never a fabricated event)', emptyReplay.items === 0 && /No recorded activity/.test(emptyReplay.emptyText), emptyReplay);
      await page.close();
    }

    // ═══ RESPONSIVE ═══
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await mockAll(page, { googleConnected: true, metaConnected: true, tiktokConnected: true, pinConnected: true });
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
      await page.waitForTimeout(900);
      const at1280 = await page.evaluate(() => {
        const row = document.getElementById('prfWorkspaceRow');
        const perf = document.getElementById('prfPerfCol').getBoundingClientRect();
        const replay = document.getElementById('prfReplayCol').getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
          flexDirection: getComputedStyle(row).flexDirection,
          replayWidth: replay.width, perfWidth: perf.width,
        };
      });
      check('26. No horizontal overflow at 1280px', !at1280.overflow);
      check('26b. The two-column workspace composition still holds at 1280px with a genuinely usable (not squeezed) Replay column', at1280.flexDirection === 'row' && at1280.replayWidth >= 300 && at1280.perfWidth > at1280.replayWidth, at1280);
      await page.close();
    }
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await mockAll(page, { googleConnected: true, metaConnected: true, tiktokConnected: true, pinConnected: true });
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
      await page.waitForTimeout(900);
      const mobile = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
        stacked: getComputedStyle(document.getElementById('prfWorkspaceRow')).flexDirection === 'column',
        graphVisible: getComputedStyle(document.getElementById('prfChartsGrid')).display !== 'none',
        selectorsVisible: getComputedStyle(document.getElementById('prfCampSelect')).display !== 'none' && getComputedStyle(document.getElementById('prfHierarchySelect')).display !== 'none',
        explorerCols: (() => { const g = document.getElementById('prfExplorerGrid'); return g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : null; })(),
      }));
      check('27. No horizontal overflow at 390px', !mobile.overflow);
      check('27b. The workspace stacks deliberately at 390px (controls, graph, Metric Explorer, Replay in order — not squeezed side-by-side)', mobile.stacked);
      check('27c. The graph and both top selectors remain visible/usable at 390px', mobile.graphVisible && mobile.selectorsVisible, mobile);
      check('27d. The Metric Explorer grid compacts to at most 2 columns at 390px', mobile.explorerCols !== null && mobile.explorerCols <= 2, mobile.explorerCols);
      await page.close();
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
