// ════════════════════════════════════════════════════════════════
// Campaigns Composition pass — cleanup note (2026-09-13)
//
// This file previously tested the "Complete UX/UI Simplification &
// Consolidation sprint" architecture: a flat metric-pill selector
// (#prfMetricSelector/.prf-msel-btn), Live Campaigns tables embedded
// directly in Campaigns below the chart (#admGLiveTableContainer/
// #admMLiveTableContainer/#prfAdSetsContainer/#prfAdsContainer), a
// per-row overflow menu opening a drill-down panel (#admCampPanel)
// whose own "Open Replay" button navigated to a separate full-page
// #page-campaign-replay, and a Campaigns-specific AI trigger/section
// (#prfAiTrigger/#prfAiSection).
//
// NONE of that exists anymore. Campaigns has been redesigned twice
// since: first into a two-graph Performance Workspace (provider tabs +
// hierarchy/object/date controls + two independent trend graphs +
// right-column Campaign Replay, no embedded campaign tables, no
// Campaigns-specific AI trigger), then into this session's single-graph
// Composition pass (one primary graph + a compact "METRICS" Metric
// Explorer replacing the two-graph system, same right-column Replay).
// Every DOM id/class the old assertions checked for is gone; several
// assertions (e.g. "the entity dropdown must NOT exist") now assert the
// literal opposite of current, intentional behavior (#prfCampSelect is
// the real object selector today). Rewriting them "as-is" would mean
// resurrecting removed product UI just to keep old assertions green,
// which the task explicitly forbids.
//
// This file is not referenced by any other script/runner/CI list
// (confirmed via repo-wide grep before editing) -- it only ever ran
// standalone via `node tests/campaigns-workspace.test.js`. Rather than
// leave it silently describing a product that no longer exists, its
// content is replaced with a small, honest smoke test against the
// CURRENT architecture, covering only what genuinely survived the two
// redesigns (page loads, the old Insights tab stays gone, no fabricated
// data, Campaign Replay is present and real, context integration intact,
// no JS errors). Deep behavioral coverage of the current single-graph +
// Metric Explorer architecture (metric selection, hierarchy/object
// switching, provider reconciliation, data honesty, accessibility,
// responsive) lives in the current, actively-maintained files:
// tests/campaigns-object-selector.test.js, tests/campaign-overview-
// metrics.test.js, tests/campaigns-performance-workspace.test.js.
//
// RUN: node tests/campaigns-workspace.test.js
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

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  const email = `oriven.campworkspace.smoke+${Date.now()}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'professional', onboarding_completed: true }, { onConflict: 'id' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    await page.route('**/api/*/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ connected: true, ready: true }) }));
    await page.route('**/api/meta/campaigns**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ campaigns: [
      { campaign_id: 'm1', campaign_name: 'Meta Prospecting - Q3', status: 'ACTIVE', spend: 118, impressions: 15100, clicks: 301, conversions: 8, reach: 9200, frequency: 1.64 },
    ] }) }));
    await page.route('**/api/ads/overview**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ overview: { spend: 284.5, impressions: 33200, clicks: 612 }, campaigns: [
      { id: 'g1', name: 'Google Search - Sale', status: 'ENABLED', spend: 284.5, impressions: 33200, clicks: 612 },
    ] }) }));
    await page.route('**/api/tiktok/overview**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ overview: { spend: 0 }, campaigns: [] }) }));
    await page.route('**/api/pinterest/overview**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ overview: { spend: 0 }, campaigns: [] }) }));
    await page.route('**/api/intelligence/events**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }) }));

    await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
    const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: signInData } = await authClient.auth.signInWithPassword({ email, password });
    await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
    await page.evaluate(async () => {
      const { data: { user } } = await window.SB.auth.getUser();
      window._currentUser = user;
      if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user);
      if (typeof _loadUserProfile === 'function') await _loadUserProfile(user);
    });
    await page.waitForTimeout(900);
    await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
    await page.waitForTimeout(700);

    const state = await page.evaluate(() => ({
      pageActive: document.getElementById('page-performance').classList.contains('active'),
      title: document.querySelector('.camp-shell-title') ? document.querySelector('.camp-shell-title').textContent : null,
      hasInsightsTab: !!document.querySelector('[data-hub-target="intelligence"]'),
      oldPillSelectorGone: !document.getElementById('prfMetricSelector'),
      oldEmbeddedLiveTablesGone: !document.getElementById('admGLiveTableContainer') && !document.getElementById('admMLiveTableContainer'),
      oldCampaignsAiTriggerGone: !document.getElementById('prfAiTrigger') && !document.getElementById('prfAiSection'),
      hasOneGraph: document.querySelectorAll('.prf-chart-card').length === 1,
      hasMetricExplorer: !!document.getElementById('prfMetricExplorer'),
      hasReplay: !!document.querySelector('.prf-replay-col'),
    }));
    check('Campaigns loads correctly (#page-performance active, real "Campaigns" title)', state.pageActive && state.title === 'Campaigns', state);
    check('The old Insights tab is still gone', !state.hasInsightsTab, state);
    check('The old flat metric-pill selector (#prfMetricSelector) is gone, not resurrected', state.oldPillSelectorGone, state);
    check('The old embedded Live Campaigns tables are gone, not resurrected', state.oldEmbeddedLiveTablesGone, state);
    check('The old Campaigns-specific AI trigger/section is gone, not resurrected', state.oldCampaignsAiTriggerGone, state);
    check('Current architecture present: exactly one primary graph', state.hasOneGraph, state);
    check('Current architecture present: Metric Explorer exists', state.hasMetricExplorer, state);
    check('Current architecture present: Campaign Replay column exists', state.hasReplay, state);

    await page.waitForTimeout(600);
    const ctx = await page.evaluate(() => ({
      hasAnalytics: !!window.orvContext && !!window.orvContext.analytics,
      spend: window.orvContext && window.orvContext.analytics && window.orvContext.analytics.spend,
    }));
    check('Context integration is not broken -- orvContext.analytics is still populated by real data', ctx.hasAnalytics && typeof ctx.spend === 'number', ctx);

    await page.click('.prf-ptab-meta');
    await page.waitForTimeout(1500);
    const metaSpend = await page.evaluate(() => (document.getElementById('prfExp_spend') || {}).textContent);
    check('Real per-platform data renders, not fabricated (Meta spend reflects the real €118 mock)', /118/.test(metaSpend || ''), metaSpend);

    check('No JS errors throughout', jsErrors.length === 0, jsErrors);
    await page.close();
  } finally {
    await browser.close();
    try { await supabaseAdmin.from('profiles').delete().eq('id', userId); } catch (_) {}
    try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
