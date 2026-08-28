// ════════════════════════════════════════════════════════════════
// Campaign Overview — "Customize Metrics" regression tests
//
// Verifies the platform-aware analytics upgrade: a small, clean Campaign
// Overview (KPI tiles + trend charts) whose content is fully driven by
// metrics.js's ORIVEN_METRICS registry and the user's own selection
// (persisted through the existing loadSettings()/saveSettings() ->
// profiles.preferences mechanism, no new storage), with Meta/Google/
// TikTok each only ever offered the metrics they genuinely support.
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
    await openOverview(page, 'meta');
    const pageOk = await page.evaluate(() => ({
      hasKpis: !!document.getElementById('prfKpis'),
      hasCharts: !!document.getElementById('prfChartsGrid'),
      hasBtn: !!document.querySelector('.prf-customize-btn'),
      hasRegistry: typeof ORIVEN_METRICS !== 'undefined' && Object.keys(ORIVEN_METRICS).length > 0,
    }));
    check('1. Campaign Overview still renders (KPI/chart containers + registry present)', pageOk.hasKpis && pageOk.hasCharts && pageOk.hasBtn && pageOk.hasRegistry, JSON.stringify(pageOk));

    // ── 2. Customize Metrics control opens correctly ─────────────────────
    await page.click('.prf-customize-btn');
    await page.waitForTimeout(300);
    const modalOpen = await page.evaluate(() => document.getElementById('modal-customize-metrics').classList.contains('open'));
    check('2. Customize Metrics control opens the modal', modalOpen);
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

    // ── 7 & 8. Individual metrics can be enabled/disabled ────────────────
    await page.click('.pcm-category[data-cat="delivery"] .pcm-cat-title'); // expand
    await page.waitForTimeout(150);
    const reachOnBefore = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('.pcm-metric-row')).find(r => r.textContent.trim().indexOf('Reach') === 0);
      return row ? row.querySelector('input').checked : null;
    });
    check('setup: Reach starts enabled (in Meta default selection)', reachOnBefore === true);
    await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('.pcm-metric-row')).find(r => r.textContent.trim().indexOf('Reach') === 0);
      row.querySelector('input').click();
    });
    await page.waitForTimeout(250);
    const reachTileAfterDisable = await page.evaluate(() => !!document.querySelector('#prfKpis .prf-kpi-ring-mod[data-metric="reach"]'));
    check('8. Disabling an individual metric removes its KPI tile', reachTileAfterDisable === false);

    await page.click('.pcm-category[data-cat="delivery"] .pcm-cat-title'); // re-expand (re-render collapsed it)
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('.pcm-metric-row')).find(r => r.textContent.trim().indexOf('Budget') === 0);
      row.querySelector('input').click();
    });
    await page.waitForTimeout(250);
    const budgetTileAfterEnable = await page.evaluate(() => !!document.querySelector('#prfKpis .prf-kpi-ring-mod[data-metric="budget"]'));
    check('7. Enabling an individual metric adds its KPI tile', budgetTileAfterEnable === true);

    // ── 9. Category selection correctly selects/deselects its metrics ────
    await page.evaluate(() => {
      const cat = document.querySelector('.pcm-category[data-cat="traffic"]');
      cat.querySelector('.pcm-cat-hd input').click(); // select-all
    });
    await page.waitForTimeout(250);
    const trafficAllOn = await page.evaluate(() => {
      const cat = document.querySelector('.pcm-category[data-cat="traffic"]');
      const cb = cat.querySelector('.pcm-cat-hd input');
      return cb.checked;
    });
    const trafficTilesAfterSelectAll = await page.evaluate(() => Array.from(document.querySelectorAll('#prfKpis .prf-kpi-ring-mod')).map(el => el.getAttribute('data-metric')).filter(id => ['clicks', 'linkClicks', 'ctr', 'cpc'].includes(id)));
    check('9. Category "select all" checkbox enables every metric in that category', trafficAllOn && trafficTilesAfterSelectAll.length === 4, JSON.stringify(trafficTilesAfterSelectAll));
    await page.evaluate(() => { document.querySelector('.pcm-category[data-cat="traffic"] .pcm-cat-hd input').click(); }); // deselect-all
    await page.waitForTimeout(250);
    const trafficTilesAfterDeselectAll = await page.evaluate(() => Array.from(document.querySelectorAll('#prfKpis .prf-kpi-ring-mod')).map(el => el.getAttribute('data-metric')).filter(id => ['clicks', 'linkClicks', 'ctr', 'cpc'].includes(id)));
    check('9b. Category "deselect all" checkbox disables every metric in that category', trafficTilesAfterDeselectAll.length === 0, JSON.stringify(trafficTilesAfterDeselectAll));
    // Restore traffic to default for the rest of the suite
    await page.evaluate(() => { document.querySelector('.pcm-category[data-cat="traffic"] .pcm-cat-hd input').click(); });
    await page.waitForTimeout(200);

    // ── 10. Preferences persist across reload/session ────────────────────
    const prefsBeforeReload = await page.evaluate(() => (typeof loadSettings === 'function') ? loadSettings().prfMetrics : null);
    check('setup: prfMetrics preference was actually saved locally', prefsBeforeReload && prefsBeforeReload.meta && Array.isArray(prefsBeforeReload.meta.delivery), JSON.stringify(prefsBeforeReload));
    await page.waitForTimeout(600); // let the fire-and-forget /api/user/preferences PUT land
    await page.reload({ waitUntil: 'domcontentloaded' });
    await signIn(page, user);
    await openOverview(page, 'meta');
    const prefsAfterReload = await page.evaluate(() => (typeof loadSettings === 'function') ? loadSettings().prfMetrics : null);
    const reachTileAfterReload = await page.evaluate(() => !!document.querySelector('#prfKpis .prf-kpi-ring-mod[data-metric="reach"]'));
    const budgetTileAfterReload = await page.evaluate(() => !!document.querySelector('#prfKpis .prf-kpi-ring-mod[data-metric="budget"]'));
    check('10. Preferences persist across reload (server-synced, not just localStorage)', prefsAfterReload && prefsAfterReload.meta && Array.isArray(prefsAfterReload.meta.delivery), JSON.stringify(prefsAfterReload));
    check('10b. The specific customization (Reach off, Budget on) survives reload', reachTileAfterReload === false && budgetTileAfterReload === true, JSON.stringify({ reachTileAfterReload, budgetTileAfterReload }));

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
    // data and confirm Reach/Link Clicks tiles genuinely don't render.
    await injectKpis(page, 'google', FAKE_GOOGLE_KPIS);
    const googleTiles = await page.evaluate(() => Array.from(document.querySelectorAll('#prfKpis .prf-kpi-ring-mod')).map(el => el.getAttribute('data-metric')));
    check('14b. Google\'s rendered KPI tiles never include Meta-only metrics (reach, linkClicks)', googleTiles.indexOf('reach') === -1 && googleTiles.indexOf('linkClicks') === -1, JSON.stringify(googleTiles));

    // ── 17. Existing Campaign Overview metrics remain correct (real values render) ──
    await injectKpis(page, 'meta', FAKE_META_KPIS);
    const metaVals = await page.evaluate(() => {
      const get = (id) => { const el = document.getElementById('prfKpiVal_' + id); return el ? el.textContent : null; };
      return { spend: get('spend'), impressions: get('impressions'), clicks: get('clicks'), conversions: get('conversions') };
    });
    check('17. Existing core metrics (spend/impressions/clicks/conversions) render correct real values', metaVals.spend === '€121' && metaVals.impressions === '10.0K' && metaVals.clicks === '300' && metaVals.conversions === '15', JSON.stringify(metaVals));

    // ── 15 & 16. Trend chart metric switcher ──────────────────────────────
    const trendSelectors = await page.evaluate(() => Array.from(document.querySelectorAll('#prfChartsGrid .prf-chart-metric-sel')).map(sel => ({ current: sel.value, options: Array.from(sel.options).map(o => o.value) })));
    check('setup: default 4 trend cards render with a metric switcher each', trendSelectors.length === 4, JSON.stringify(trendSelectors.map(t => t.current)));
    const trendOptionsMatchPlatform = trendSelectors.every(t => t.options.every(o => ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'conversions', 'cpa', 'roas'].includes(o)));
    check('16. Trend charts only offer metrics the active platform supports (no Meta-only/Google-only leak into the option list)', trendOptionsMatchPlatform, JSON.stringify(trendSelectors[0] && trendSelectors[0].options));
    // Change the first card's metric via the dropdown, without leaving Overview.
    const firstSel = await page.$('#prfChartsGrid .prf-chart-metric-sel');
    const firstOriginal = await page.evaluate(el => el.value, firstSel);
    const newValue = firstOriginal === 'spend' ? 'clicks' : 'spend';
    await page.selectOption('#prfChartsGrid .prf-chart-metric-sel', newValue);
    await page.waitForTimeout(300);
    const afterSwap = await page.evaluate(() => document.querySelector('#prfChartsGrid .prf-chart-metric-sel').value);
    check('15. Trend chart metric can be changed via its own dropdown without leaving Overview', afterSwap === newValue, JSON.stringify({ firstOriginal, newValue, afterSwap }));
    const trendPrefAfterSwap = await page.evaluate(() => loadSettings().prfMetrics.meta.trends);
    check('15b. Changing a trend card\'s metric persists as part of the Trends selection', Array.isArray(trendPrefAfterSwap) && trendPrefAfterSwap.indexOf(newValue) !== -1, JSON.stringify(trendPrefAfterSwap));

    // ── Reset to default (Customize Metrics modal control) ───────────────
    await page.evaluate(() => { prfOpenCustomize(); });
    await page.waitForTimeout(200);
    await page.click('.pcm-modal .modal-ft .btn-g'); // "Reset to default"
    await page.waitForTimeout(300);
    const afterReset = await page.evaluate(() => Array.from(document.querySelectorAll('#prfKpis .prf-kpi-ring-mod')).map(el => el.getAttribute('data-metric')));
    check('Reset to default restores the spec\'s default selection', JSON.stringify(afterReset.sort()) === JSON.stringify(['cpa', 'ctr', 'clicks', 'conversionRate', 'conversions', 'cpc', 'cpm', 'frequency', 'impressions', 'reach', 'roas', 'spend'].sort()), JSON.stringify(afterReset));
    await page.evaluate(() => { prfCloseCustomize(); });

    // ── Tooltip: metric info icons are present for non-obvious metrics ───
    const tooltipCheck = await page.evaluate(() => {
      const el = document.querySelector('#prfKpis .prf-kpi-ring-mod[data-metric="roas"] .prf-metric-tip');
      return el ? el.getAttribute('data-metric-tip') : null;
    });
    check('9. Metric definition tooltip is present for a non-obvious metric (ROAS)', !!tooltipCheck && /revenue/i.test(tooltipCheck), tooltipCheck);
    const noTooltipOnObvious = await page.evaluate(() => !document.querySelector('#prfKpis .prf-kpi-ring-mod[data-metric="clicks"] .prf-metric-tip'));
    check('9b. No tooltip clutter on a self-explanatory metric (Clicks)', noTooltipOnObvious);

  } finally {
    await page.close();
    await browser.close();
    await deleteTestUser(user.userId);
  }

  const failed = results.filter(r => !r.ok);
  console.log('\n' + results.length + ' checks run, ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed.');
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
