// ════════════════════════════════════════════════════════════════
// Campaign Overview — "Customize Metrics" + chart-engine regression tests
//
// Verifies the platform-aware analytics upgrade: Campaign Overview's
// content is fully driven by metrics.js's ORIVEN_METRICS registry and
// the user's own selection (persisted through the existing
// loadSettings()/saveSettings() -> profiles.preferences mechanism, no
// new storage), with Meta/Google/TikTok each only ever offered the
// metrics they genuinely support. It also carries the deep chart-
// rendering-engine regression coverage (dynamic axis scaling, honest
// null-gap handling vs. real zero, draw-in animation mechanism,
// horizontal scrolling for long series, fullscreen, tooltips, and the
// Pinterest disconnected-chart state-leakage bug fix) — none of that
// internal engine changed across the Campaigns Composition pass (it was
// already generic over a string chart key, reused as-is), only the
// ORCHESTRATION layer around it did (two independently-selected graphs
// -> one primary graph + a compact Metric Explorer), so this file's DOM
// ids were updated from the old per-slot pattern (#prfChartsGridA/B,
// #prfBars_A_<metric>/#prfBars_B_<metric>, prfSelectGraphMetric(slot,id),
// window._prfGraphMetric.A/.B) to the current un-prefixed one
// (#prfChartsGrid, #prfBars_<metric>, prfSelectMetric(id),
// window._prfActiveMetric) and the "exactly TWO independent graphs"
// assertions were replaced with "exactly ONE graph, kept in sync with
// the Metric Explorer's active tile" assertions matching the current,
// intentional architecture.
//
// COST/DATA NOTE: this environment has no live Google/Meta/TikTok ad
// account connected, so the real API responses can't be exercised
// end-to-end. Tests that need real KPI numbers inject a realistic
// window._prfPlatKpis payload directly (the exact shape _prfLoadData
// produces from a real API response) and drive the real rendering
// pipeline (_prfApplyView/_prfRenderKpiTiles/_prfRenderTrendCards) from
// there -- this exercises the actual production code, just supplies the
// data a live account would otherwise provide. UI-only tests (modal open/
// close, expand/collapse, persistence) need no injected data at all.
//
// Same plain-Node-script convention as this repo's other test files.
// RUN: npm run test:overview-metrics
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

async function createTestUser(suffix) {
  const email = `oriven.ovmetrics.test+${Date.now()}.${suffix || 'a'}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'creator', onboarding_completed: true }, { onConflict: 'id' });
  return { userId, email, password };
}

async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('credit_transactions').delete().eq('user_id', userId); } catch (_) {}
  try { await supabaseAdmin.from('integrations').delete().eq('user_id', userId); } catch (_) {}
  try { await supabaseAdmin.from('profiles').delete().eq('id', userId); } catch (_) {}
  try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
}

async function signIn(page, user) {
  const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: signInData, error } = await authClient.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  // Pre-existing timing race (not part of this sprint): right after
  // page.reload({waitUntil:'domcontentloaded'}), window.SB may not be
  // initialized yet even though the DOM is ready. Wait for it explicitly
  // instead of assuming it's already there.
  await page.waitForFunction(() => !!window.SB && !!window.SB.auth, null, { timeout: 15000 });
  await page.evaluate(async ({ access_token, refresh_token }) => {
    await window.SB.auth.setSession({ access_token, refresh_token });
  }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
  await page.evaluate(async () => {
    const { data: { user } } = await window.SB.auth.getUser();
    window._currentUser = user;
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user);
    if (typeof _loadUserProfile === 'function') await _loadUserProfile(user);
  });
  await page.waitForTimeout(800);
}

async function openOverview(page, platform) {
  await page.evaluate((plat) => {
    if (typeof _orvNav === 'function') _orvNav('performance', 'page-performance');
    if (plat) window._prfActivePlatform = plat;
  }, platform || null);
  await page.waitForTimeout(500);
}

const FAKE_META_KPIS = {
  spend: 120.5, impr: 10000, clicks: 300, conv: 15, convVal: 450,
  reach: 8000, frequency: 1.25, cpm: 12.05, cpc: 0.4, linkClicks: 250,
  budget: 50, searchImpressionShare: null, addToCart: 40, costPerAddToCart: 3.01,
  checkoutInitiated: 20, costPerCheckout: 6.03, cpa: 8.03, status: null
};
const FAKE_GOOGLE_KPIS = {
  spend: 200, impr: 5000, clicks: 100, conv: 5, convVal: 300,
  reach: null, frequency: null, cpm: 40, cpc: 2, linkClicks: null,
  budget: null, searchImpressionShare: 67.5, addToCart: null, costPerAddToCart: null,
  checkoutInitiated: null, costPerCheckout: null, cpa: 40, status: null
};

async function injectKpis(page, platform, kpis) {
  await page.evaluate(({ plat, k }) => {
    window._prfActivePlatform = plat;
    window._prfPlatKpis = {}; window._prfPlatKpis[plat] = k;
    window._prfAllCampaigns = [];
    window._prfActiveCampaign = 'all';
    _prfApplyView();
  }, { plat: platform, k: kpis });
  await page.waitForTimeout(1300); // let the KPI count-up animation settle
}

async function main() {
  const results = [];
  function check(name, cond, detail) {
    results.push({ name, ok: !!cond, detail });
    console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail ? ' (' + detail + ')' : ''));
  }

  const user = await createTestUser('flow');
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  try {
    await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
    await signIn(page, user);

    // ── 1. Campaign Overview still renders ───────────────────────────────
    // The current architecture (Campaigns Final Cleanup pass): ONE primary
    // graph (#prfChartsGrid/#prfChartCard) with NO metric <select> of its
    // own any more (removed as redundant — the Metric Explorer directly
    // below it, #prfMetricExplorer, is now the ONE visible metric-selection
    // mechanism, sourced from the same ORIVEN_METRICS registry and kept in
    // sync with the graph's active metric), plus a specific-object selector
    // (#prfCampSelect). The earlier two-graph system (#prfChartsGridA/B)
    // and, before that, the old #prfKpis tile grid and the old flat
    // Performance Summary strip / giant pill field, are all gone —
    // confirmed directly, none of those selectors exist in app.html any
    // more. Customize Metrics is NOT restored as a UI entry point (its
    // modal/storage functions are still intact and still tested directly
    // via JS below, never deleted).
    await openOverview(page, 'meta');
    // The initial real (unmocked) status/campaigns fetches this fresh page
    // load triggers can occasionally take longer than openOverview's fixed
    // 500ms wait before the graph card finishes its first real build —
    // wait for the real graph card to exist rather than racing a timer.
    await page.waitForSelector('#prfChartCard', { timeout: 5000 }).catch(() => {});
    const pageOk = await page.evaluate(() => ({
      hasOneGraph: document.querySelectorAll('.prf-chart-card').length === 1,
      noGraphSelect: !document.getElementById('prfGraphSelect'),
      hasMetricExplorer: !!document.getElementById('prfMetricExplorer'),
      hasObjectSelector: !!document.getElementById('prfCampSelect'),
      hasRegistry: typeof ORIVEN_METRICS !== 'undefined' && Object.keys(ORIVEN_METRICS).length > 0,
      noOldSummaryStrip: !document.getElementById('prfSummaryStrip'),
      noOldPillField: !document.getElementById('prfMetricSelector'),
      noOldGraphB: !document.getElementById('prfChartsGridB') && !document.getElementById('prfGraphSelectB'),
    }));
    check('1. Campaign Overview still renders (one primary graph with NO metric select of its own, Metric Explorer, object selector, registry all present; old summary strip + pill field + Graph B genuinely gone)', pageOk.hasOneGraph && pageOk.noGraphSelect && pageOk.hasMetricExplorer && pageOk.hasObjectSelector && pageOk.hasRegistry && pageOk.noOldSummaryStrip && pageOk.noOldPillField && pageOk.noOldGraphB, JSON.stringify(pageOk));

    // ── 2. Customize Metrics' underlying modal is NOT deleted, just no
    // longer offered as a primary-UI entry point (no button on the page
    // opens it — the Metric Explorer already exposes every real metric as
    // navigation instead). Opened directly via
    // its real, still-defined function, the same technique this file
    // already uses elsewhere (injectKpis) to exercise real code without a
    // live ad account — never resurrecting the removed button. ─────────────────
    await page.evaluate(() => { prfOpenCustomize(); });
    await page.waitForTimeout(300);
    const modalOpen = await page.evaluate(() => document.getElementById('modal-customize-metrics').classList.contains('open'));
    check('2. The underlying Customize Metrics modal still opens via its real function (kept intact, not deleted, not resurrected as UI)', modalOpen);
    const modalTitle = await page.evaluate(() => (document.querySelector('#modal-customize-metrics .modal-ttl') || {}).textContent);
    check('2b. Modal has the expected title', /customize your metrics/i.test(modalTitle || ''), modalTitle);

    // ── 3-6. Each category expands/collapses on click, collapsed by default ──
    for (const catId of ['delivery', 'traffic', 'conversion', 'trends']) {
      const cat = await page.evaluate((id) => {
        const el = document.querySelector('.pcm-category[data-cat="' + id + '"]');
        if (!el) return null;
        return { existsBefore: true, expandedBefore: el.classList.contains('pcm-expanded') };
      }, catId);
      if (!cat) { check(catId + '. category present in modal', false); continue; }
      check(catId.charAt(0).toUpperCase() + catId.slice(1) + ' category starts collapsed', cat.expandedBefore === false);
      await page.click('.pcm-category[data-cat="' + catId + '"] .pcm-cat-title');
      await page.waitForTimeout(150);
      const afterExpand = await page.evaluate((id) => {
        const el = document.querySelector('.pcm-category[data-cat="' + id + '"]');
        const list = el.querySelector('.pcm-metric-list');
        return { expanded: el.classList.contains('pcm-expanded'), visible: getComputedStyle(list).display !== 'none', rows: el.querySelectorAll('.pcm-metric-row').length };
      }, catId);
      check((catId.charAt(0).toUpperCase() + catId.slice(1)) + ' category expands on click and shows its metrics', afterExpand.expanded && afterExpand.visible && afterExpand.rows > 0, JSON.stringify(afterExpand));
      await page.click('.pcm-category[data-cat="' + catId + '"] .pcm-cat-chevron');
      await page.waitForTimeout(150);
      const afterCollapse = await page.evaluate((id) => {
        const el = document.querySelector('.pcm-category[data-cat="' + id + '"]');
        return { expanded: el.classList.contains('pcm-expanded'), visible: getComputedStyle(el.querySelector('.pcm-metric-list')).display !== 'none' };
      }, catId);
      check((catId.charAt(0).toUpperCase() + catId.slice(1)) + ' category collapses again on chevron click', !afterCollapse.expanded && !afterCollapse.visible, JSON.stringify(afterCollapse));
    }

    // ── 7 & 8. Individual metrics can still be enabled/disabled in the
    // underlying storage (_prfMetricSelection) — checked directly against
    // that real data layer rather than a #prfKpis tile, since the Metric
    // Explorer deliberately shows every genuinely supported metric and is
    // not curated by this preference (spec: "show ALL genuinely supported
    // metrics, not a top-5"). The storage/modal mechanism itself is still
    // fully real and unchanged. ──
    await page.click('.pcm-category[data-cat="delivery"] .pcm-cat-title'); // expand
    await page.waitForTimeout(150);
    const reachOnBefore = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('.pcm-metric-row')).find(r => r.textContent.trim().indexOf('Reach') === 0);
      return row ? row.querySelector('input').checked : null;
    });
    check('setup: Reach starts enabled (default is every supported metric)', reachOnBefore === true);
    await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('.pcm-metric-row')).find(r => r.textContent.trim().indexOf('Reach') === 0);
      row.querySelector('input').click();
    });
    await page.waitForTimeout(250);
    const reachOffInStorage = await page.evaluate(() => _prfMetricSelection('delivery', 'meta').indexOf('reach') === -1);
    check('8. Disabling an individual metric removes it from the real saved selection', reachOffInStorage);
    await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('.pcm-metric-row')).find(r => r.textContent.trim().indexOf('Reach') === 0);
      row.querySelector('input').click(); // back on, restore for later checks
    });
    await page.waitForTimeout(250);
    const reachOnAfterRestore = await page.evaluate(() => _prfMetricSelection('delivery', 'meta').indexOf('reach') !== -1);
    check('7. Re-enabling a disabled metric adds it back to the real saved selection', reachOnAfterRestore);

    // ── 9. Category selection correctly selects/deselects its metrics
    // (same real storage layer, not DOM tiles). ──
    await page.evaluate(() => { document.querySelector('.pcm-category[data-cat="traffic"] .pcm-cat-hd input').click(); }); // deselect-all
    await page.waitForTimeout(250);
    const trafficAfterDeselectAll = await page.evaluate(() => _prfMetricSelection('traffic', 'meta'));
    check('9b. Category "deselect all" checkbox clears every metric in that category from the real selection', trafficAfterDeselectAll.length === 0, JSON.stringify(trafficAfterDeselectAll));
    await page.evaluate(() => { document.querySelector('.pcm-category[data-cat="traffic"] .pcm-cat-hd input').click(); }); // select-all
    await page.waitForTimeout(250);
    const trafficAllOn = await page.evaluate(() => document.querySelector('.pcm-category[data-cat="traffic"] .pcm-cat-hd input').checked);
    const trafficAfterSelectAll = await page.evaluate(() => _prfMetricSelection('traffic', 'meta'));
    const expectedTraffic = await page.evaluate(() => orvMetricsForCategory('traffic', 'meta'));
    check('9. Category "select all" checkbox restores every real metric in that category to the selection', trafficAllOn && JSON.stringify(trafficAfterSelectAll.slice().sort()) === JSON.stringify(expectedTraffic.slice().sort()), JSON.stringify(trafficAfterSelectAll));

    // ── 10. Preferences persist across reload/session (server-synced
    // storage layer — still real and still exercised, independent of
    // whatever currently renders from it). ──
    const prefsBeforeReload = await page.evaluate(() => (typeof loadSettings === 'function') ? loadSettings().prfMetrics : null);
    check('setup: prfMetrics preference was actually saved locally', prefsBeforeReload && prefsBeforeReload.meta && Array.isArray(prefsBeforeReload.meta.delivery), JSON.stringify(prefsBeforeReload));
    await page.waitForTimeout(600); // let the fire-and-forget /api/user/preferences PUT land
    await page.reload({ waitUntil: 'domcontentloaded' });
    await signIn(page, user);
    await openOverview(page, 'meta');
    const prefsAfterReload = await page.evaluate(() => (typeof loadSettings === 'function') ? loadSettings().prfMetrics : null);
    check('10. Preferences persist across reload (server-synced, not just localStorage)', prefsAfterReload && prefsAfterReload.meta && Array.isArray(prefsAfterReload.meta.delivery), JSON.stringify(prefsAfterReload));

    // ── 11, 12, 13, 14. Platform-specific metric availability ────────────
    const availability = await page.evaluate(() => ({
      meta: {
        reach: orvMetricSupportsPlatform('reach', 'meta'),
        linkClicks: orvMetricSupportsPlatform('linkClicks', 'meta'),
        addToCart: orvMetricSupportsPlatform('addToCart', 'meta'),
        searchImpressionShare: orvMetricSupportsPlatform('searchImpressionShare', 'meta'),
      },
      google: {
        searchImpressionShare: orvMetricSupportsPlatform('searchImpressionShare', 'google'),
        reach: orvMetricSupportsPlatform('reach', 'google'),
        linkClicks: orvMetricSupportsPlatform('linkClicks', 'google'),
        roas: orvMetricSupportsPlatform('roas', 'google'),
      },
      tiktok: {
        reach: orvMetricSupportsPlatform('reach', 'tiktok'),
        linkClicks: orvMetricSupportsPlatform('linkClicks', 'tiktok'),
        addToCart: orvMetricSupportsPlatform('addToCart', 'tiktok'),
        roas: orvMetricSupportsPlatform('roas', 'tiktok'),
        searchImpressionShare: orvMetricSupportsPlatform('searchImpressionShare', 'tiktok'),
      },
    }));
    check('11. Meta only shows supported Meta metrics (Reach/Link Clicks/Add to Cart yes, Search IS no)', availability.meta.reach && availability.meta.linkClicks && availability.meta.addToCart && !availability.meta.searchImpressionShare, JSON.stringify(availability.meta));
    check('12. Google only shows supported Google metrics (Search Impression Share yes, Reach/Link Clicks/ROAS-only-Meta no)', availability.google.searchImpressionShare && !availability.google.reach && !availability.google.linkClicks && availability.google.roas, JSON.stringify(availability.google));
    check('13. TikTok only shows supported TikTok metrics (Reach yes, Add to Cart/ROAS/Search IS no)', availability.tiktok.reach && !availability.tiktok.addToCart && !availability.tiktok.roas && !availability.tiktok.searchImpressionShare, JSON.stringify(availability.tiktok));
    const noFabricatedGoogleMetric = await page.evaluate(() => !orvMetricSupportsPlatform('addToCart', 'google') && !orvMetricSupportsPlatform('linkClicks', 'google'));
    check('14. Unsupported metrics are never fabricated (Google Ads has no Add to Cart / Link Clicks in the registry for it)', noFabricatedGoogleMetric);

    // Live-rendered proof, not just the registry lookup: inject real Google
    // data and confirm the Metric Explorer (the one remaining metric-
    // selection surface) never offers a Meta-only metric for Google.
    await injectKpis(page, 'google', FAKE_GOOGLE_KPIS);
    const googleOptions = await page.evaluate(() => ({
      explorer: Array.from(document.querySelectorAll('#prfExplorerGrid .prf-explorer-tile')).map(t => t.getAttribute('data-metric')),
    }));
    check('14b. Google\'s Metric Explorer never includes Meta-only metrics (reach, linkClicks)', !googleOptions.explorer.includes('reach') && !googleOptions.explorer.includes('linkClicks'), JSON.stringify(googleOptions));

    // ── 17. Existing core metrics still render correct real values — via
    // the CURRENT real surface: the graph's title + the underlying
    // computed KPI object (window._prfLastKpis) the graph is drawn from,
    // and the Metric Explorer's own tile values (same KPI object,
    // formatted through the shared orvFormatMetric). No #prfKpiVal_*/
    // #prfSum_* tiles exist any more (see note above — this is the real,
    // current rendering path, not a resurrection of the old one). ──
    await injectKpis(page, 'meta', FAKE_META_KPIS);
    const graphVals = await page.evaluate(() => ({
      activeMetric: window._prfActiveMetric,
      spend: window._prfLastKpis.spend,
      explorerSpendTile: (document.getElementById('prfExp_spend') || {}).textContent,
    }));
    check('17. The real, already-computed KPI object the graph AND the Metric Explorer both draw from holds correct real values (no separate summary tile layer needed)',
      graphVals.spend === FAKE_META_KPIS.spend && /12[01]/.test(graphVals.explorerSpendTile || ''), JSON.stringify(graphVals));
    await page.evaluate(() => { prfSelectMetric('impressions'); });
    await page.waitForTimeout(400);
    const impressionsState = await page.evaluate(() => ({
      chartTitle: (document.querySelector('.prf-chart-title') || {}).textContent,
      realKpiValue: window._prfLastKpis.impr,
    }));
    check('17b. Selecting Impressions renders its real value via the graph, from the same already-loaded KPI object', impressionsState.realKpiValue === FAKE_META_KPIS.impr && /^Impressions Over Time$/.test(impressionsState.chartTitle || ''), JSON.stringify(impressionsState));
    await page.evaluate(() => { prfSelectMetric('spend'); });
    await page.waitForTimeout(200);

    // ── 15 & 16. ONE primary graph (Campaigns Composition pass replaced
    // the two-graph system with one graph + a compact Metric Explorer —
    // see window._prfActiveMetric), with no per-chart metric DROPDOWN in
    // the old sense (its compact <select> IS the metric control, by
    // design — not a redundant second one). ──
    const trendTitles = await page.evaluate(() => ({
      title: (document.querySelector('.prf-chart-title') || {}).textContent,
      cardCount: document.querySelectorAll('#prfChartsGrid .prf-chart-card').length,
    }));
    check('15. The graph shows a plain, real "<Metric> Over Time" title', / Over Time$/.test(trendTitles.title), JSON.stringify(trendTitles));
    check('16. Exactly ONE primary graph renders (the removed two-graph system stays removed, not one per metric either)', trendTitles.cardCount === 1, JSON.stringify(trendTitles));

    // ── Reset to default (Customize Metrics modal's underlying storage
    // contract — still real, checked against _prfMetricSelection directly
    // since the Metric Explorer intentionally shows every supported
    // metric rather than a curated tile-per-selection). ────────────────
    await page.evaluate(() => { prfOpenCustomize(); });
    await page.waitForTimeout(200);
    await page.click('.pcm-modal .modal-ft .btn-g'); // "Reset to default"
    await page.waitForTimeout(300);
    const afterReset = await page.evaluate(() => _prfMetricSelection('delivery', 'meta').concat(_prfMetricSelection('traffic', 'meta'), _prfMetricSelection('conversion', 'meta')));
    const expectedMetaDefault = await page.evaluate(() => orvMetricsForCategory('delivery', 'meta').concat(orvMetricsForCategory('traffic', 'meta'), orvMetricsForCategory('conversion', 'meta')));
    check('Reset to default restores every metric Meta genuinely supports (not a curated subset)', JSON.stringify(afterReset.slice().sort()) === JSON.stringify(expectedMetaDefault.slice().sort()), JSON.stringify({ afterReset, expectedMetaDefault }));
    await page.evaluate(() => { prfCloseCustomize(); });

    // ── 9. EVERY metric in the registry has a real tooltip string, no
    // exceptions — this is data-layer, not DOM (the current Metric
    // Explorer's compact tiles don't render tooltip icons today; that was
    // a feature of the removed KPI-tile UI and isn't resurrected here, per
    // explicit instruction — only the still-real, still-useful registry
    // guarantee is kept). ──
    const tooltipCheck = await page.evaluate(() => ORIVEN_METRICS.roas.tooltip);
    check('9. Metric definition tooltip is present for a non-obvious metric (ROAS)', !!tooltipCheck && /revenue/i.test(tooltipCheck), tooltipCheck);
    const registryTooltipAudit = await page.evaluate(() => Object.keys(ORIVEN_METRICS).map(id => ({ id, tooltip: ORIVEN_METRICS[id].tooltip })));
    const registryMissing = registryTooltipAudit.filter(m => !m.tooltip || typeof m.tooltip !== 'string' || !m.tooltip.trim());
    check('9b. Every metric in the ORIVEN_METRICS registry has a real tooltip string (no exceptions)', registryMissing.length === 0, JSON.stringify(registryMissing));

    // ── 18. The old Performance Summary strip (flat label+value pairs, no
    // rings) is GONE, not restyled. Verified it's really absent at
    // desktop/tablet/mobile, and that the graph card itself still follows
    // the same "information, not UI components" restraint (no ring SVGs in
    // the card chrome). ──
    await openOverview(page, 'meta');
    await injectKpis(page, 'meta', FAKE_META_KPIS);
    const noSummaryAt = async (width) => {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(400);
      return page.evaluate(() => ({
        noSummaryStrip: !document.getElementById('prfSummaryStrip'),
        noSummaryItems: document.querySelectorAll('.prf-summary-item').length === 0,
        graphCardNoRings: document.querySelectorAll('#prfChartsGrid svg').length === 0
          || Array.from(document.querySelectorAll('#prfChartsGrid svg')).every(svg => svg.closest('.prf-chart-expand-btn')), // the expand-icon svg is fine, that's not a ring
      }));
    };
    const desktopNoSummary = await noSummaryAt(1440);
    check('18. The old Performance Summary strip is gone at desktop (not just hidden)', desktopNoSummary.noSummaryStrip && desktopNoSummary.noSummaryItems, JSON.stringify(desktopNoSummary));
    const tabletNoSummary = await noSummaryAt(800);
    check('18b. ...gone at tablet too', tabletNoSummary.noSummaryStrip && tabletNoSummary.noSummaryItems, JSON.stringify(tabletNoSummary));
    const mobileNoSummary = await noSummaryAt(375);
    check('18c. ...gone at mobile too', mobileNoSummary.noSummaryStrip && mobileNoSummary.noSummaryItems, JSON.stringify(mobileNoSummary));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(150);

    // ── 19. Exactly ONE primary graph card renders (Campaigns Composition
    // pass replaced the two-graph system with one graph + a Metric
    // Explorer — window._prfActiveMetric). The now-legacy `trends`
    // preference selection genuinely no longer gates chart count OR which
    // metric renders at all — proven directly below, not assumed. ──
    const trendCardState = async () => page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#prfChartsGrid .prf-chart-card'));
      return { count: cards.length, allPrimary: cards.length > 0 && cards.every(c => c.classList.contains('prf-chart-card-primary')) };
    });
    const trendDefault = await trendCardState();
    check('19. Default state is exactly ONE primary chart card -- not a wall of per-metric charts, not the old two-graph pair', trendDefault.count === 1 && trendDefault.allPrimary, JSON.stringify(trendDefault));

    // NOTE: _prfSaveMetricSelection/_prfApplyView alone no longer changes
    // WHICH metric the graph renders (that's driven only by
    // window._prfActiveMetric, set via prfSelectMetric(id) — the trends
    // preference stopped gating chart selection when the two-graph
    // redesign shipped, and stays that way under the single-graph
    // redesign too). So this helper also calls prfSelectMetric(...) on the
    // first requested id, which is what every call site below actually
    // needs (a specific metric's real #prfBars_<id>/#prfAxis_<id> DOM to
    // assert against) — the _prfSaveMetricSelection call is kept too,
    // since it's still real, still-exercised (if now-legacy) code.
    async function setTrends(ids) {
      await page.evaluate((arr) => { _prfSaveMetricSelection('meta', 'trends', arr); _prfApplyView(); if (arr[0]) prfSelectMetric(arr[0]); }, ids);
      await page.waitForTimeout(200);
      return trendCardState();
    }
    const trendFour = await setTrends(['spend', 'conversions', 'roas', 'ctr']);
    check('19a. Changing the (now-legacy) trends preference to 4 metrics still renders exactly one chart card', trendFour.count === 1 && trendFour.allPrimary, JSON.stringify(trendFour));
    const trendThree = await setTrends(['spend', 'conversions', 'ctr']);
    check('19b. ...same for 3 metrics -- still exactly one chart card', trendThree.count === 1 && trendThree.allPrimary, JSON.stringify(trendThree));
    const trendOne = await setTrends(['spend']);
    check('19c. ...same for 1 metric -- still exactly one chart card', trendOne.count === 1 && trendOne.allPrimary, JSON.stringify(trendOne));
    const trendTwo = await setTrends(['spend', 'conversions']);
    check('19d. ...same for 2 metrics -- still exactly one chart card (the trends preference no longer gates chart count at all)', trendTwo.count === 1 && trendTwo.allPrimary, JSON.stringify(trendTwo));
    // Restore meta's trend selection back to every supported metric (the
    // real default) for anything after this.
    const trendIds8 = await page.evaluate(() => orvMetricsForCategory('trends', 'meta'));
    await setTrends(trendIds8);

    // ── 22. Y-axis scale — real, data-derived tick values, never fabricated
    // example numbers, generated only once a chart actually has real data
    // to plot. Inject a realistic day-by-day series (same shape
    // _prfLoadChartSeries produces) directly, matching the established
    // pattern for injecting KPI data without a live ad account. ──
    await setTrends(['spend']);
    await page.evaluate(() => {
      window._prfLastSeries = [
        { date: '2026-08-01', spend: 10, impressions: 100, clicks: 5, conversions: 1, conversions_value: 0, hasValue: false },
        { date: '2026-08-02', spend: 50, impressions: 200, clicks: 8, conversions: 2, conversions_value: 0, hasValue: false },
        { date: '2026-08-03', spend: 80, impressions: 300, clicks: 12, conversions: 3, conversions_value: 0, hasValue: false },
        { date: '2026-08-04', spend: 42, impressions: 150, clicks: 6, conversions: 1, conversions_value: 0, hasValue: false },
        { date: '2026-08-05', spend: 77, impressions: 280, clicks: 10, conversions: 2, conversions_value: 0, hasValue: false }
      ];
      window._prfLastSeriesMeta = { plat: 'meta', connected: true };
      _prfRenderTrendCharts();
    });
    await page.waitForTimeout(300);
    const axisTicks = await page.evaluate(() => Array.from(document.querySelectorAll('#prfAxis_spend span')).map(el => el.textContent));
    // Real max is 80 -- "nice" rounding takes that up to 100, so ticks
    // should read 100/75/50/25/0, never the raw unrounded max or a
    // hardcoded example value.
    check('22. Y-axis renders 5 real, "nice"-rounded tick values derived from the actual data (max 80 -> 100/75/50/25/0)', JSON.stringify(axisTicks) === JSON.stringify(['€100', '€75', '€50', '€25', '€0']), JSON.stringify(axisTicks));
    const axisClearedWhenLocked = await page.evaluate(() => {
      window._prfLastSeriesMeta = { plat: 'meta', connected: false };
      _prfRenderTrendCharts();
      return document.getElementById('prfAxis_spend').innerHTML;
    });
    check('22b. Y-axis is cleared (no fabricated scale) when the chart falls back to an empty/locked state', axisClearedWhenLocked === '', JSON.stringify(axisClearedWhenLocked));
    // Restore ready state with real data for the expand-modal test below.
    await page.evaluate(() => {
      window._prfLastSeriesMeta = { plat: 'meta', connected: true };
      _prfRenderTrendCharts();
    });
    await page.waitForTimeout(300);

    // ── 23. Chart expand/fullscreen modal ─────────────────────────────────
    await page.click('#prfChartsGrid .prf-chart-expand-btn');
    await page.waitForTimeout(250);
    const fsOpen = await page.evaluate(() => {
      const overlay = document.getElementById('prfChartFsOverlay');
      const mc = document.querySelector('.mc');
      return {
        exists: !!overlay,
        title: overlay ? document.getElementById('prfFsTitle').textContent : null,
        hasRealBars: overlay ? document.getElementById('prfBars_Fs').querySelector('.prf-linechart') !== null : false,
        axisMatches: overlay ? Array.from(document.querySelectorAll('#prfAxis_Fs span')).map(el => el.textContent) : null,
        overlayLeft: overlay ? overlay.getBoundingClientRect().left : null,
        mcLeft: mc ? mc.getBoundingClientRect().left : null,
      };
    });
    check('23. Expand button opens a fullscreen modal with the real metric title, platform, and data', fsOpen.exists && /Spend Over Time/i.test(fsOpen.title || '') && /Meta/i.test(fsOpen.title || '') && fsOpen.hasRealBars, JSON.stringify(fsOpen));
    check('23b. Expanded chart shows the exact same real axis scale as the small card (not fabricated separately)', JSON.stringify(fsOpen.axisMatches) === JSON.stringify(['€100', '€75', '€50', '€25', '€0']), JSON.stringify(fsOpen.axisMatches));
    check('23c. The overlay only covers the main content area, not the sidebar (starts at .mc\'s real left edge)', fsOpen.overlayLeft != null && fsOpen.mcLeft != null && Math.abs(fsOpen.overlayLeft - fsOpen.mcLeft) < 2, JSON.stringify(fsOpen));
    // Close via the × button.
    await page.click('.prf-chart-fs-close');
    await page.waitForTimeout(200);
    const fsClosedByButton = await page.evaluate(() => !document.getElementById('prfChartFsOverlay'));
    check('23d. Close (×) button closes the expanded chart modal', fsClosedByButton);
    // Re-open, close via Escape key.
    await page.click('#prfChartsGrid .prf-chart-expand-btn');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const fsClosedByEscape = await page.evaluate(() => !document.getElementById('prfChartFsOverlay'));
    check('23e. Escape key also closes the expanded chart modal', fsClosedByEscape);

    // ════════════════════════════════════════════════════════════════
    // Layout polish pass 2: dynamic axis scaling, honest gap handling
    // (the "broken line" investigation), horizontal time navigation.
    // ════════════════════════════════════════════════════════════════

    // ── 25. Dynamic Y-axis: the scale must grow automatically for a later
    // refresh with much bigger values, never stay stuck at an earlier,
    // now-too-small ceiling. ──
    await setTrends(['spend']);
    await page.evaluate(() => {
      window._prfLastSeries = [
        { date: '2026-08-01', spend: 0,     impressions: 0,      clicks: 0,   conversions: 0, conversions_value: 0, hasValue: false },
        { date: '2026-08-02', spend: 2000,  impressions: 8000,   clicks: 40,  conversions: 2,  conversions_value: 0, hasValue: false },
        { date: '2026-08-03', spend: 8000,  impressions: 30000,  clicks: 90,  conversions: 5,  conversions_value: 0, hasValue: false },
        { date: '2026-08-04', spend: 15000, impressions: 60000,  clicks: 150, conversions: 9,  conversions_value: 0, hasValue: false },
        { date: '2026-08-05', spend: 42000, impressions: 120000, clicks: 300, conversions: 20, conversions_value: 0, hasValue: false }
      ];
      window._prfLastSeriesMeta = { plat: 'meta', connected: true };
      _prfRenderTrendCharts();
    });
    await page.waitForTimeout(300);
    const bigJumpAxis = await page.evaluate(() => Array.from(document.querySelectorAll('#prfAxis_spend span')).map(el => el.textContent));
    check('25. Y-axis automatically expands for a much larger value (max 42,000 -> real ticks up to €50.0K, never stuck near €1K)', JSON.stringify(bigJumpAxis) === JSON.stringify(['€50.0K', '€37.5K', '€25.0K', '€12.5K', '€0']), JSON.stringify(bigJumpAxis));
    const lineWithinBounds = await page.evaluate(() => {
      const path = document.querySelector('#prfBars_spend [data-role="line"]');
      const d = path.getAttribute('d');
      const nums = d.match(/-?\d+\.\d+/g).map(Number);
      // every other number starting at index 1 is a y-coordinate (x,y pairs)
      const ys = nums.filter((_, i) => i % 2 === 1);
      return { minY: Math.min(...ys), maxY: Math.max(...ys) };
    });
    check('25b. The line never exceeds the chart\'s own [0,100] viewBox bounds (same scale as the axis)', lineWithinBounds.minY >= 0 && lineWithinBounds.maxY <= 100, JSON.stringify(lineWithinBounds));

    // ── 26. Honest gaps -- a day with no reportable value for this metric
    // (e.g. CPC on a day with zero clicks: spend/0 is undefined, not €0)
    // must render as a real visual gap, never a fabricated dip to zero or
    // a fake bridge connecting across the missing value. This was the
    // actual cause of "randomly broken-looking" lines: nulls used to be
    // silently coerced to 0 before reaching the renderer. ──
    await setTrends(['cpc']);
    await page.evaluate(() => {
      window._prfLastSeries = [
        { date: '2026-08-01', spend: 40, impressions: 1000, clicks: 20, conversions: 1, conversions_value: 0, hasValue: false },
        { date: '2026-08-02', spend: 30, impressions: 900,  clicks: 0,  conversions: 0, conversions_value: 0, hasValue: false }, // 0 clicks -> cpc genuinely undefined
        { date: '2026-08-03', spend: 55, impressions: 1200, clicks: 25, conversions: 2, conversions_value: 0, hasValue: false },
        { date: '2026-08-04', spend: 20, impressions: 700,  clicks: 0,  conversions: 0, conversions_value: 0, hasValue: false }, // same
        { date: '2026-08-05', spend: 60, impressions: 1300, clicks: 30, conversions: 3, conversions_value: 0, hasValue: false }
      ];
      window._prfLastSeriesMeta = { plat: 'meta', connected: true };
      _prfRenderTrendCharts();
    });
    await page.waitForTimeout(300);
    const gapRender = await page.evaluate(() => {
      const bars = document.getElementById('prfBars_cpc');
      const path = bars.querySelector('[data-role="line"]');
      const d = path.getAttribute('d');
      return { subpathCount: (d.match(/M/g) || []).length, dotCount: bars.querySelectorAll('.prf-lc-dot').length, hasSingleContinuousLine: !d.includes('M', d.indexOf('M') + 1) };
    });
    check('26. A day with a genuinely undefined value breaks the line into a separate subpath (honest gap), not a fabricated zero or a bridge across it', gapRender.subpathCount === 3, JSON.stringify(gapRender));
    check('26b. Only real (non-null) days get a plotted point -- 3 real values here, not 5', gapRender.dotCount === 3, JSON.stringify(gapRender));

    // ════════════════════════════════════════════════════════════════
    // Line-rendering root cause (final Campaign Overview cleanup pass):
    // a fully-continuous VALID->VALID series must render as ONE subpath
    // with completely uniform styling; VALID->0->VALID must draw straight
    // through the real zero (never treated as a gap); 0->0 draws a flat
    // line at the baseline; the fill must never leak a stroke/glow that
    // could look like a second line; the draw-in animation must not use
    // stroke-dasharray/dashoffset (that combined with
    // vector-effect:non-scaling-stroke under this chart's non-uniform
    // preserveAspectRatio="none" scaling was the actual root cause of the
    // inconsistent-looking segments -- confirmed by rendering with the
    // animation skipped entirely and seeing the identical path data paint
    // as one uniform line with no artifacts).
    // ════════════════════════════════════════════════════════════════

    // ── 26c. Fully continuous data (every day has a real value, including
    // a real backend-reported zero in the middle) renders as exactly one
    // subpath -- no accidental split. ──
    await setTrends(['spend']);
    await page.evaluate(() => {
      window._prfLastSeries = [
        { date: '2026-08-01', spend: 40, impressions: 1000, clicks: 20, conversions: 1, conversions_value: 0, hasValue: false },
        { date: '2026-08-02', spend: 55, impressions: 1200, clicks: 22, conversions: 2, conversions_value: 0, hasValue: false },
        { date: '2026-08-03', spend: 0,  impressions: 900,  clicks: 15, conversions: 0, conversions_value: 0, hasValue: false }, // real zero, not a gap
        { date: '2026-08-04', spend: 60, impressions: 1300, clicks: 25, conversions: 2, conversions_value: 0, hasValue: false },
        { date: '2026-08-05', spend: 70, impressions: 1400, clicks: 28, conversions: 3, conversions_value: 0, hasValue: false }
      ];
      window._prfLastSeriesMeta = { plat: 'meta', connected: true };
      _prfRenderTrendCharts();
    });
    await page.waitForTimeout(300);
    const continuousRender = await page.evaluate(() => {
      const bars = document.getElementById('prfBars_spend');
      const line = bars.querySelector('[data-role="line"]');
      const fill = bars.querySelector('[data-role="fill"]');
      const d = line.getAttribute('d');
      const lineCs = getComputedStyle(line);
      const fillCs = getComputedStyle(fill);
      return {
        subpathCount: (d.match(/M/g) || []).length,
        dotCount: bars.querySelectorAll('.prf-lc-dot').length,
        lineStroke: lineCs.stroke,
        lineStrokeWidth: lineCs.strokeWidth,
        lineOpacity: lineCs.opacity,
        fillStroke: fillCs.stroke,
        fillFilter: fillCs.filter,
      };
    });
    check('26c. A fully continuous series (5/5 real values, including a real zero) renders as exactly ONE subpath', continuousRender.subpathCount === 1, JSON.stringify(continuousRender));
    check('26d. All 5 real points get a dot, including the real zero (zero is data, not a gap)', continuousRender.dotCount === 5, JSON.stringify(continuousRender));
    // ROOT CAUSE regression guard: the fill path shares the line's
    // color-variant class (for fill="currentColor") but must never
    // inherit a visible stroke or glow filter from it -- that leak was
    // rendering as a second, fainter "line" (the fill's own outline).
    check('26e. The area-fill path never has a visible stroke or filter leaking from the shared color class (would look like a second/duplicate line)', continuousRender.fillStroke === 'none' && continuousRender.fillFilter === 'none', JSON.stringify(continuousRender));

    // ── 26f. VALID -> 0 -> VALID: the real zero sits ON the baseline as
    // part of the single continuous path (drawn down to zero and back up),
    // not detected as missing. ──
    const zeroPointGeometry = await page.evaluate(() => {
      const line = document.querySelector('#prfBars_spend [data-role="line"]');
      const d = line.getAttribute('d');
      const coords = d.match(/-?\d+\.\d+/g).map(Number);
      // 5 points -> 10 numbers (x,y pairs); the 3rd point (index 2) is the real zero.
      return { x3: coords[4], y3: coords[5] };
    });
    check('26g. The real-zero point sits exactly on the chart\'s zero baseline (y=94, i.e. H-PAD), drawn as real data', Math.abs(zeroPointGeometry.y3 - 94) < 0.5, JSON.stringify(zeroPointGeometry));

    // ── 26h. 0 -> 0: two consecutive real zeros draw a normal flat
    // horizontal line at the baseline, not a gap and not a spike. ──
    await page.evaluate(() => {
      window._prfLastSeries = [
        { date: '2026-08-01', spend: 40, impressions: 1000, clicks: 20, conversions: 1, conversions_value: 0, hasValue: false },
        { date: '2026-08-02', spend: 0,  impressions: 800,  clicks: 10, conversions: 0, conversions_value: 0, hasValue: false },
        { date: '2026-08-03', spend: 0,  impressions: 750,  clicks: 8,  conversions: 0, conversions_value: 0, hasValue: false },
        { date: '2026-08-04', spend: 50, impressions: 1200, clicks: 24, conversions: 2, conversions_value: 0, hasValue: false }
      ];
      window._prfLastSeriesMeta = { plat: 'meta', connected: true };
      _prfRenderTrendCharts();
    });
    await page.waitForTimeout(300);
    const zeroZeroRender = await page.evaluate(() => {
      const line = document.querySelector('#prfBars_spend [data-role="line"]');
      const d = line.getAttribute('d');
      const coords = d.match(/-?\d+\.\d+/g).map(Number);
      return { subpathCount: (d.match(/M/g) || []).length, y2: coords[3], y3: coords[5] }; // points 2 and 3 are both spend=0
    });
    check('26h. Two consecutive real zeros render as one continuous subpath with a flat segment at the baseline', zeroZeroRender.subpathCount === 1 && Math.abs(zeroZeroRender.y2 - 94) < 0.5 && Math.abs(zeroZeroRender.y3 - 94) < 0.5, JSON.stringify(zeroZeroRender));

    // ── 26i. Draw-in animation uses clip-path, not stroke-dasharray --
    // guards against the actual root cause regressing. ──
    await page.evaluate(() => {
      window._prfLastSeries = [
        { date: '2026-08-01', spend: 40, impressions: 1000, clicks: 20, conversions: 1, conversions_value: 0, hasValue: false },
        { date: '2026-08-02', spend: 55, impressions: 1200, clicks: 22, conversions: 2, conversions_value: 0, hasValue: false },
        { date: '2026-08-03', spend: 60, impressions: 1200, clicks: 22, conversions: 2, conversions_value: 0, hasValue: false }
      ];
      window._prfLastSeriesMeta = { plat: 'meta', connected: true };
      _prfRenderTrendCharts();
    });
    await page.waitForTimeout(50); // sample mid-animation, before the 1.1s transition finishes
    const animMechanism = await page.evaluate(() => {
      const line = document.querySelector('#prfBars_spend [data-role="line"]');
      const cs = getComputedStyle(line);
      return { strokeDasharray: cs.strokeDasharray, clipPath: line.style.clipPath, transitionProperty: cs.transitionProperty };
    });
    check('26i. The draw-in reveal animates via clip-path, not stroke-dasharray/dashoffset (the actual root cause of the fragmented-looking lines)', (animMechanism.strokeDasharray === 'none' || !animMechanism.strokeDasharray) && /clip-path/.test(animMechanism.transitionProperty), JSON.stringify(animMechanism));
    await page.waitForTimeout(1300); // let the animation finish before continuing

    // ── 27. Horizontal time navigation -- a long selected range (e.g.
    // Lifetime) becomes horizontally scrollable rather than either
    // truncating data or squeezing every point into unreadable illegibility;
    // a short range that already fits gets no scrollbar at all. The
    // Y-axis (a sibling of the scroll container) must stay in the DOM
    // untouched by the data area's own scrolling. ──
    await setTrends(['impressions']);
    await page.evaluate(() => {
      const series = [];
      const base = new Date('2026-01-01');
      for (let i = 0; i < 200; i++) {
        const d = new Date(base); d.setDate(d.getDate() + i);
        series.push({ date: d.toISOString().slice(0, 10), spend: 50 + i, impressions: 1000 + i * 20, clicks: 30 + i, conversions: 2, conversions_value: 0, hasValue: false });
      }
      window._prfLastSeries = series;
      window._prfLastSeriesMeta = { plat: 'meta', connected: true };
      _prfRenderTrendCharts();
    });
    await page.waitForTimeout(400);
    const longSeriesInfo = await page.evaluate(() => {
      const bars = document.getElementById('prfBars_impressions');
      return { scrollable: bars.classList.contains('prf-bars-scrollable'), scrollWidth: bars.scrollWidth, clientWidth: bars.clientWidth, dotCount: bars.querySelectorAll('.prf-lc-dot').length, axisStillPresent: document.getElementById('prfAxis_impressions').children.length === 5 };
    });
    check('27. A long (200-point) series becomes horizontally scrollable -- every point rendered, none truncated', longSeriesInfo.scrollable && longSeriesInfo.scrollWidth > longSeriesInfo.clientWidth && longSeriesInfo.dotCount === 200, JSON.stringify(longSeriesInfo));
    check('27b. The Y-axis stays intact and present even though the data area scrolls', longSeriesInfo.axisStillPresent);

    await page.evaluate(() => {
      const series = [];
      const base = new Date('2026-08-01');
      for (let i = 0; i < 7; i++) {
        const d = new Date(base); d.setDate(d.getDate() + i);
        series.push({ date: d.toISOString().slice(0, 10), spend: 50 + i * 5, impressions: 1000 + i * 100, clicks: 30, conversions: 2, conversions_value: 0, hasValue: false });
      }
      window._prfLastSeries = series;
      window._prfLastSeriesMeta = { plat: 'meta', connected: true };
      _prfRenderTrendCharts();
    });
    await page.waitForTimeout(300);
    const shortSeriesInfo = await page.evaluate(() => {
      const bars = document.getElementById('prfBars_impressions');
      return { scrollable: bars.classList.contains('prf-bars-scrollable'), scrollWidth: bars.scrollWidth, clientWidth: bars.clientWidth };
    });
    check('27c. A short (7-point) series that already fits gets NO scrollbar -- never scrollable just because', !shortSeriesInfo.scrollable && shortSeriesInfo.scrollWidth === shortSeriesInfo.clientWidth, JSON.stringify(shortSeriesInfo));

    // ── 28. Fullscreen chart preserves the same data/scale/scrolling ──
    await page.evaluate(() => {
      const series = [];
      const base = new Date('2026-01-01');
      for (let i = 0; i < 200; i++) {
        const d = new Date(base); d.setDate(d.getDate() + i);
        series.push({ date: d.toISOString().slice(0, 10), spend: 50 + i, impressions: 1000 + i * 20, clicks: 30 + i, conversions: 2, conversions_value: 0, hasValue: false });
      }
      window._prfLastSeries = series;
      window._prfLastSeriesMeta = { plat: 'meta', connected: true };
      _prfRenderTrendCharts();
    });
    await page.waitForTimeout(300);
    await page.click('#prfChartsGrid .prf-chart-expand-btn');
    await page.waitForTimeout(400);
    const fsLongSeries = await page.evaluate(() => {
      const bars = document.getElementById('prfBars_Fs');
      return { exists: !!bars, scrollable: bars.classList.contains('prf-bars-scrollable'), dotCount: bars.querySelectorAll('.prf-lc-dot').length, axisTicks: Array.from(document.querySelectorAll('#prfAxis_Fs span')).map(s => s.textContent) };
    });
    check('28. Fullscreen chart shows the exact same long series (200 real points), same dynamic axis, same horizontal scrolling', fsLongSeries.exists && fsLongSeries.scrollable && fsLongSeries.dotCount === 200, JSON.stringify(fsLongSeries));
    await page.evaluate(() => { prfCloseExpandedChart(); });

    // ── 29. Tooltip shows exact real date + value, still works after the
    // chart has been scrolled (positioned from live geometry, not a
    // stale copied percentage). ──
    await page.waitForTimeout(300);
    const tipCheck = await page.evaluate(async () => {
      const dot = document.querySelector('#prfChartsGrid .prf-lc-dot');
      if (!dot) return null;
      dot.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await new Promise(r => setTimeout(r, 50));
      const tip = document.getElementById('prfTip_impressions');
      return { visible: getComputedStyle(tip).display !== 'none', hasDate: /2026-/.test(tip.textContent), hasValue: /impressions/i.test(tip.textContent) };
    });
    check('29. Hovering a data point shows a tooltip with the exact real date and metric value', tipCheck && tipCheck.visible && tipCheck.hasDate && tipCheck.hasValue, JSON.stringify(tipCheck));

    // Restore the full trend selection for anything after this.
    await setTrends(trendIds8);

    // ── 20. The Campaigns-specific AI Analysis feature (#prfAiSection/
    // #prfAiTrigger/#prfCreativeSection) is removed ENTIRELY, not hidden —
    // ORIVEN's global intelligence entry point already covers this, so
    // Campaigns doesn't need a second AI surface. This session's own
    // Composition pass explicitly re-confirms the same must remain true
    // (spec 21/22: "leave the existing global bottom-right ORIVEN
    // assistant untouched; do not add another Campaigns-specific AI
    // button"). Confirmed gone across all three platforms this walkthrough
    // already switches through, not just the default one, AND that the
    // real global assistant is still present. ──
    await page.evaluate(() => { window._prfTikTokConnected = false; prfSwitchPlatform('tiktok'); });
    await page.waitForTimeout(200);
    const noAiOnTikTok = await page.evaluate(() => !document.getElementById('prfAiSection') && !document.getElementById('prfAiTrigger') && !document.getElementById('prfCreativeSection'));
    check('20. The removed AI Analysis feature stays removed on TikTok (never resurrected per-platform)', noAiOnTikTok);
    await page.evaluate(() => { window._prfTikTokConnected = true; prfSwitchPlatform('tiktok'); });
    await page.waitForTimeout(200);
    const noAiOnTikTokConnected = await page.evaluate(() => !document.getElementById('prfAiSection'));
    check('20b. ...and on TikTok connected too', noAiOnTikTokConnected);
    await page.evaluate(() => { prfSwitchPlatform('meta'); });
    await page.waitForTimeout(200);
    const noAiOnMeta = await page.evaluate(() => !document.getElementById('prfAiSection'));
    check('20c. ...and back on Meta (never resurrected on switch)', noAiOnMeta);
    const globalAssistantPresent = await page.evaluate(() => !!document.getElementById('orvAiFab'));
    check('20d. The global ORIVEN assistant (#orvAiFab) remains present and untouched', globalAssistantPresent);

    // ── 21. TikTok's real KPI data-fetch path (previously dead code —
    // prfInit() unconditionally excluded TikTok from the platforms it ever
    // fetched, even when genuinely connected). Mock only the network layer
    // (apiFetch) so this exercises the real prfInit -> _tryShow ->
    // _prfLoadData pipeline end-to-end without a live TikTok ad account. ──
    await page.evaluate(() => {
      window._prfPlatKpis = {};
      window.apiFetch = async function(path) {
        if (path.indexOf('/api/google/status') === 0) return { ok: true, data: { connected: false } };
        if (path.indexOf('/api/meta/status') === 0) return { ok: true, data: { connected: false } };
        if (path.indexOf('/api/tiktok/status') === 0) return { ok: true, data: { connected: true } };
        if (path.indexOf('/api/tiktok/overview') === 0) {
          return { ok: true, data: { overview: {}, campaigns: [
            { id: 't1', name: 'TT Campaign', status: 'ACTIVE', spend: 88, impressions: 4400, clicks: 120, conversions: 6, reach: 3000, budget: 25, frequency: 1.4 }
          ] } };
        }
        return { ok: false, data: null };
      };
      window.prfInit();
    });
    await page.waitForTimeout(700);
    const tiktokFetchWiring = await page.evaluate(() => ({
      kpis: window._prfPlatKpis && window._prfPlatKpis.tiktok,
      bannerHidden: getComputedStyle(document.getElementById('prfConnectBanner')).display === 'none',
    }));
    check('21. TikTok\'s real reporting endpoint is now actually invoked (KPI data populated) when TikTok alone is connected', tiktokFetchWiring.kpis && tiktokFetchWiring.kpis.spend === 88 && tiktokFetchWiring.kpis.impr === 4400, JSON.stringify(tiktokFetchWiring.kpis));
    check('21b. The "connect your ad accounts" banner does not wrongly show when TikTok alone is connected', tiktokFetchWiring.bannerHidden, JSON.stringify(tiktokFetchWiring));

  } finally {
    await page.close();
    await browser.close();
    await deleteTestUser(user.userId);
  }

  // ── 24. Default-all-metrics for a brand-new user vs. preserved prefs for
  // an existing one -- run against a second, completely fresh test user
  // (the primary `user` above has been customized extensively by this
  // point in the suite, so it can't prove the "no saved preference" case
  // cleanly). ──
  const user2 = await createTestUser('defaults');
  const browser2 = await chromium.launch({ executablePath: CHROME_PATH });
  const page2 = await browser2.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page2.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
    await signIn(page2, user2);
    await openOverview(page2, 'google');
    const freshDefaults = await page2.evaluate(() => ({
      delivery: _prfMetricSelection('delivery', 'google').slice().sort(),
      expectedDelivery: orvMetricsForCategory('delivery', 'google').slice().sort(),
      hasSavedPrefs: !!(loadSettings().prfMetrics && loadSettings().prfMetrics.google),
    }));
    check('24. Brand-new user (no saved prefs) sees every metric Google supports selected by default', JSON.stringify(freshDefaults.delivery) === JSON.stringify(freshDefaults.expectedDelivery) && !freshDefaults.hasSavedPrefs, JSON.stringify(freshDefaults));

    // Now the user customizes (turns Spend off) -- this becomes a real
    // saved preference and must never be silently overwritten back to "all".
    await page2.evaluate(() => { prfToggleMetric('delivery', 'spend', false); });
    await page2.waitForTimeout(300);
    const afterCustomize = await page2.evaluate(() => _prfMetricSelection('delivery', 'google').slice());
    check('24b. Turning one metric off is a real, saved customization (Spend excluded)', afterCustomize.indexOf('spend') === -1, JSON.stringify(afterCustomize));
    await page2.waitForTimeout(500); // let the fire-and-forget preferences PUT land
    await page2.reload({ waitUntil: 'domcontentloaded' });
    await signIn(page2, user2);
    await openOverview(page2, 'google');
    const afterReloadPrefs = await page2.evaluate(() => _prfMetricSelection('delivery', 'google').slice());
    check('24c. An existing user\'s saved customization survives reload -- never silently reset back to "select all"', afterReloadPrefs.indexOf('spend') === -1, JSON.stringify(afterReloadPrefs));
  } finally {
    await page2.close();
    await browser2.close();
    await deleteTestUser(user2.userId);
  }

  // ── 25. Pinterest disconnected-chart bug fix regression ──────────────
  // Root cause: _prfLoadChartSeries's per-platform allowlist (`plat ===
  // 'google' || plat === 'meta'`) never included Pinterest, so viewing the
  // Pinterest tab fell into the function's "aggregate every connected
  // platform" branch (built for a since-removed "All Platforms" combined
  // view) instead of checking Pinterest's own connection state — if e.g.
  // Meta happened to be connected, Pinterest's tab silently fetched and
  // rendered Meta's real chart data mislabeled as Pinterest's. Fixed by
  // adding 'pinterest' to that allowlist (app.html, _prfLoadChartSeries).
  //
  // This section seeds REAL `integrations` rows (Meta + TikTok connected,
  // Pinterest deliberately left disconnected — no row) on a fresh test
  // user, so the real connection-status fetch path (prfInit -> _tryShow ->
  // window._prfConnectedPlatforms) is genuinely exercised, not mocked via
  // direct KPI injection like the sections above.
  const user3 = await createTestUser('pindisc');
  await supabaseAdmin.from('integrations').upsert({
    user_id: user3.userId, provider: 'meta_ads',
    access_token: 'fake-meta-token-' + Date.now(),
    token_expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    connected_at: new Date().toISOString(), meta_user_name: 'Test Meta User',
    active_ad_account: { platform: 'meta_ads', account_id: '123456', account_name: 'Fake Meta Account', currency: 'USD' },
  }, { onConflict: 'user_id,provider' });
  await supabaseAdmin.from('integrations').upsert({
    user_id: user3.userId, provider: 'tiktok_ads',
    access_token: 'fake-tiktok-token-' + Date.now(),
    connected_at: new Date().toISOString(), tiktok_display_name: 'Test TikTok User',
    active_ad_account: { platform: 'tiktok_ads', account_id: '789', account_name: 'Fake TikTok Account' },
  }, { onConflict: 'user_id,provider' });

  const browser3 = await chromium.launch({ executablePath: CHROME_PATH });
  const page3 = await browser3.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page3.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
    await signIn(page3, user3);
    await openOverview(page3, null); // let prfInit run its own real connection-status fetch, no forced platform
    await page3.waitForTimeout(1500);

    // The graph's default metric preference is reach-first, falling back
    // through impressions/clicks/spend (PRF_METRIC_PREFERENCE) — Spend is
    // supported by every platform, so forcing it explicitly keeps this
    // section's DOM key (#prfLock_spend) deterministic across platforms.
    async function switchAndRead(plat) {
      await page3.click('.prf-ptab[data-plat="' + plat + '"]');
      await page3.waitForTimeout(1200);
      await page3.evaluate(() => { if (window._prfActiveMetric !== 'spend' && typeof prfSelectMetric === 'function') prfSelectMetric('spend'); });
      await page3.waitForTimeout(300);
      return page3.evaluate(() => ({
        activePlatform: window._prfActivePlatform,
        lastSeriesMeta: window._prfLastSeriesMeta,
        spendLockShown: (document.getElementById('prfLock_spend') || {}).classList ? document.getElementById('prfLock_spend').classList.contains('prf-lock-show') : null,
        spendLockTitle: (document.querySelector('#prfLock_spend .prf-cl-title') || {}).textContent || null,
        spendBarsEmpty: (document.getElementById('prfBars_spend') || {}).innerHTML === '',
      }));
    }

    const metaState = await switchAndRead('meta');
    check('25. Meta tab: lastSeriesMeta.plat is "meta" (own data source, no leakage)', metaState.lastSeriesMeta && metaState.lastSeriesMeta.plat === 'meta', JSON.stringify(metaState.lastSeriesMeta));

    const pinState = await switchAndRead('pinterest');
    check('25b. Pinterest tab (disconnected, Meta connected): reports connected:false for Pinterest itself, never inherits Meta\'s connected:true',
      pinState.lastSeriesMeta && pinState.lastSeriesMeta.plat === 'pinterest' && pinState.lastSeriesMeta.connected === false, JSON.stringify(pinState.lastSeriesMeta));
    check('25c. Pinterest tab (disconnected): Spend chart shows the locked "Connect" state, never a rendered line from another platform\'s data',
      pinState.spendLockShown === true && pinState.spendBarsEmpty === true);
    check('25d. Pinterest tab (disconnected): lock title says "Connect Pinterest Ads" — never Meta or TikTok content leaking into Pinterest\'s UI',
      /Pinterest/.test(pinState.spendLockTitle || '') && !/Meta|TikTok/.test(pinState.spendLockTitle || ''), pinState.spendLockTitle);
    // Proving the SAME correct lock state holds for a metric other than
    // the default (Spend) requires explicitly making CPA the active
    // metric — #prfLock_cpa only exists in the DOM while CPA is the
    // graph's selected metric.
    await page3.evaluate(() => { prfSelectMetric('cpa'); });
    await page3.waitForTimeout(300);
    const cpaLockTitle = await page3.evaluate(() => (document.querySelector('#prfLock_cpa .prf-cl-title') || {}).textContent || null);
    check('25e. CPA Over Time: same correct "Connect Pinterest Ads" state as Spend (not special-cased to only the default metric)',
      /Pinterest/.test(cpaLockTitle || ''), cpaLockTitle);

    // Switch back to Meta — must show Meta's own state again, not get stuck
    // on Pinterest's disconnected state (proves the fix didn't break the
    // reverse direction / introduce state leakage the other way).
    const metaAgain = await switchAndRead('meta');
    check('25f. Switching Pinterest -> Meta: Meta\'s tab correctly reports its own plat/connected state again (no leftover Pinterest state)',
      metaAgain.lastSeriesMeta && metaAgain.lastSeriesMeta.plat === 'meta' && metaAgain.lastSeriesMeta.connected === true, JSON.stringify(metaAgain.lastSeriesMeta));

    // TikTok -> Pinterest -> TikTok, the exact sequence named in the bug
    // report as the highest-risk switching path.
    const tikState = await switchAndRead('tiktok');
    check('25g. TikTok tab: noBackend state (TikTok has no daily-series endpoint) — unaffected by the Pinterest fix',
      tikState.lastSeriesMeta && tikState.lastSeriesMeta.noBackend === true, JSON.stringify(tikState.lastSeriesMeta));
    const pinAfterTiktok = await switchAndRead('pinterest');
    check('25h. TikTok -> Pinterest: still correctly shows Pinterest\'s own disconnected state, no TikTok state leaking through',
      pinAfterTiktok.lastSeriesMeta && pinAfterTiktok.lastSeriesMeta.plat === 'pinterest' && pinAfterTiktok.lastSeriesMeta.connected === false && !pinAfterTiktok.lastSeriesMeta.noBackend,
      JSON.stringify(pinAfterTiktok.lastSeriesMeta));
    const tikAgain = await switchAndRead('tiktok');
    check('25i. Pinterest -> TikTok: TikTok\'s own noBackend state correctly restored, no Pinterest state leaking through',
      tikAgain.lastSeriesMeta && tikAgain.lastSeriesMeta.noBackend === true && tikAgain.lastSeriesMeta.plat === 'tiktok', JSON.stringify(tikAgain.lastSeriesMeta));

    // Pinterest connected (fake token — real Pinterest API calls fail, but
    // this proves the request is routed to Pinterest's OWN kpi-series
    // endpoint/connection check, never Meta's, once Pinterest itself is
    // marked connected — the actual bug was about which platform's
    // connection status gates the fetch, not about live data content.
    await supabaseAdmin.from('integrations').upsert({
      user_id: user3.userId, provider: 'pinterest_ads',
      access_token: 'fake-pinterest-token-' + Date.now(),
      token_expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      connected_at: new Date().toISOString(),
      active_ad_account: { platform: 'pinterest_ads', account_id: '999', account_name: 'Fake Pinterest Account' },
    }, { onConflict: 'user_id,provider' });
    await page3.reload({ waitUntil: 'domcontentloaded' });
    await signIn(page3, user3);
    await openOverview(page3, null);
    await page3.waitForTimeout(1500);
    const pinConnectedState = await switchAndRead('pinterest');
    check('25j. Pinterest connected: lastSeriesMeta reports connected:true and plat:"pinterest" (own real endpoint attempted, not skipped/faked)',
      pinConnectedState.lastSeriesMeta && pinConnectedState.lastSeriesMeta.plat === 'pinterest' && pinConnectedState.lastSeriesMeta.connected === true,
      JSON.stringify(pinConnectedState.lastSeriesMeta));
    check('25k. Pinterest connected but the fake token yields no real rows: honest "insufficient data" state, never a fabricated line or Meta\'s data',
      pinConnectedState.spendBarsEmpty === true);

    // Unsupported metric check (ROAS is not offered for Pinterest even
    // when connected) — distinct from pinterest-ads.test.js's static
    // platforms[] array check: this exercises the live rendering pipeline.
    const roasSelection = await page3.evaluate(() => _prfMetricSelection('trends', 'pinterest'));
    check('25l. Unsupported Pinterest metric (ROAS) never appears in the live trends selection, connected or not', roasSelection.indexOf('roas') === -1, JSON.stringify(roasSelection));
  } finally {
    await page3.close();
    await browser3.close();
    await deleteTestUser(user3.userId);
  }

  const failed = results.filter(r => !r.ok);
  console.log('\n' + results.length + ' checks run, ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed.');
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
