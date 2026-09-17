// ════════════════════════════════════════════════════════════════
// Launch — Live filter (Campaigns/Launch Final Living Product pass)
//
// Verifies the one small Launch change this pass made: a real LIVE
// status filter between "All statuses" and "Ready to Launch", based
// purely on real, provider-confirmed deployment state
// (LAUNCH_LIVE_STATUSES: published/paused/archived — all only ever
// reachable via a genuine POST /api/publish/{platform} success). No
// performance analytics were added to Launch; no production provider
// mutation is ever triggered by browsing/filtering/selecting.
//
// RUN: node tests/launch-live-filter.test.js
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
  const email = `oriven.launchlive.test+${Date.now()}.${suffix}@example.com`;
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
function makeCampaign(overrides) {
  const base = {
    id: 'cgr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    name: 'Test Campaign', goal: 'Sales', platform: 'google', creativeMode: 'images', status: 'generated', created: new Date().toISOString(),
    pkg: {
      strategy: { goal: 'Sales', landingPageUrl: 'https://example.com/shop', dailyBudget: 30 },
      googleAds: { headlines: ['Great Deals'], descriptions: ['desc'], finalUrl: 'https://example.com/shop', imageUrl: 'https://picsum.photos/seed/g1/400/300', budget: 30 },
      visualConcepts: [{ generatedImageUrl: 'https://picsum.photos/seed/v1/400/300' }], websiteUrl: 'https://example.com',
    },
  };
  return Object.assign({}, base, overrides, { pkg: Object.assign({}, base.pkg, (overrides && overrides.pkg) || {}) });
}
async function seedCampaigns(page, campaigns) {
  await page.evaluate((camps) => { localStorage.setItem(_orvCampaignsKey(), JSON.stringify(camps)); }, campaigns);
}
async function mockSetupStatus(page, byPlatform) {
  await page.route('**/api/setup/*/status', async (route) => {
    const m = route.request().url().match(/\/api\/setup\/(\w+)\/status/);
    const platform = m ? m[1] : null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(byPlatform[platform] || { connected: false, ready: false, state: 'not_started' }) });
  });
}
const SETUP_READY = { connected: true, ready: true, state: 'ready', steps: { account: { status: 'complete', accountName: 'Test Ad Account' } } };

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let user;
  try {
    user = await createTestUser('a');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
    const publishCalls = [];
    page.on('request', (r) => { if (/\/api\/publish\/|\/api\/(google|meta|tiktok|pinterest)\/(pause|resume|delete)/.test(r.url())) publishCalls.push(r.url()); });
    await mockSetupStatus(page, { google: SETUP_READY });
    await signIn(page, user);

    const campaigns = [
      makeCampaign({ id: 'c_draft', name: 'Draft Campaign', status: 'draft', platform: 'google' }),
      makeCampaign({ id: 'c_ready', name: 'Ready Campaign', status: 'generated', platform: 'google' }),
      makeCampaign({ id: 'c_blocked', name: 'Blocked Campaign', status: 'generated', platform: 'google', pkg: { googleAds: { imageUrl: null }, visualConcepts: [] } }),
      makeCampaign({ id: 'c_live', name: 'Live Deployed Campaign', status: 'published', platform: 'google', publishedAt: new Date(Date.now() - 3 * 86400000).toISOString(), platformCampaignId: '9988776655', destinationAccountName: 'Test Ad Account' }),
      makeCampaign({ id: 'c_paused', name: 'Paused Live Campaign', status: 'paused', platform: 'google', publishedAt: new Date(Date.now() - 10 * 86400000).toISOString(), platformCampaignId: '1122334455' }),
      makeCampaign({ id: 'c_archived', name: 'Archived Live Campaign', status: 'archived', platform: 'google', publishedAt: new Date(Date.now() - 30 * 86400000).toISOString(), platformCampaignId: '5544332211' }),
    ];
    await seedCampaigns(page, campaigns);
    await page.evaluate(() => { _orvNav('launch', 'page-launch'); });
    await page.waitForTimeout(900);

    // 1. Live appears between All statuses and Ready to Launch.
    const filterOrder = await page.evaluate(() => Array.from(document.querySelectorAll('#lqStatusPills .lq-pill-status')).map((b) => b.textContent));
    check('1. Filter order is exactly: All statuses, Live, Ready to Launch, Ready with Warnings, Blocked', JSON.stringify(filterOrder) === JSON.stringify(['All statuses', 'Live', 'Ready to Launch', 'Ready with Warnings', 'Blocked']), filterOrder);

    // 2/3. Live only includes genuinely deployed campaigns — local drafts
    // (even a "Ready Campaign" with complete config) never appear as Live.
    await page.click('#lqStatusPills .lq-pill-status >> nth=1');
    await page.waitForTimeout(500);
    const liveState = await page.evaluate(() => ({
      rowNames: Array.from(document.querySelectorAll('.lq-row .lq-name')).map((el) => el.textContent),
      readinessLabels: Array.from(document.querySelectorAll('.lq-readiness')).map((el) => el.textContent),
    }));
    check('2. Live filter includes exactly the 3 genuinely-deployed campaigns (published/paused/archived), nothing else', JSON.stringify(liveState.rowNames.slice().sort()) === JSON.stringify(['Archived Live Campaign', 'Live Deployed Campaign', 'Paused Live Campaign'].sort()), liveState.rowNames);
    check('3. Local drafts/ready/blocked campaigns never appear under Live merely because they exist', !liveState.rowNames.includes('Draft Campaign') && !liveState.rowNames.includes('Ready Campaign') && !liveState.rowNames.includes('Blocked Campaign'), liveState.rowNames);
    check('2b. Every row under the Live filter is labeled LIVE (real, distinct vocabulary)', liveState.readinessLabels.every((l) => l === 'LIVE'), liveState.readinessLabels);

    // 4. Ready-to-launch does not equal Live.
    await page.click('#lqStatusPills .lq-pill-status >> nth=2');
    await page.waitForTimeout(500);
    const readyState = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-row .lq-name')).map((el) => el.textContent));
    check('4. "Ready to Launch" filter never includes a Live (deployed) campaign', !readyState.some((n) => /Live/.test(n)), readyState);

    // 5. Blocked does not equal Live.
    await page.click('#lqStatusPills .lq-pill-status >> nth=4');
    await page.waitForTimeout(500);
    const blockedState = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-row .lq-name')).map((el) => el.textContent));
    check('5. "Blocked" filter never includes a Live (deployed) campaign', !blockedState.some((n) => /Live/.test(n)), blockedState);

    // All statuses includes everything real.
    await page.click('#lqStatusPills .lq-pill-status >> nth=0');
    await page.waitForTimeout(500);
    const allState = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-row .lq-name')).map((el) => el.textContent));
    check('setup: "All statuses" includes every real campaign, live and pending alike', allState.length === 6, allState);

    // 9. Selecting a Live campaign still drives Launch Control.
    await page.click('#lqStatusPills .lq-pill-status >> nth=1');
    await page.waitForTimeout(400);
    await page.click('.lq-row[data-name="live deployed campaign"]');
    await page.waitForTimeout(600);
    const liveControl = await page.evaluate(() => ({
      stateLabel: (document.querySelector('#lqControlCol .lqc-state-label') || {}).textContent,
      stateSub: (document.querySelector('#lqControlCol .lqc-state-sub') || {}).textContent,
      hasChecksList: !!document.getElementById('lqcChecks') && document.getElementById('lqcChecks').children.length > 0,
      controlText: document.getElementById('lqControlCol').textContent,
    }));
    check('9. Selecting a Live campaign drives Launch Control (real state shown, not a blank/broken panel)', liveControl.stateLabel === 'LIVE' && !!liveControl.stateSub, liveControl);

    // 10. No performance analytics were added to Launch (no ROAS/CTR/CPC/spend/graph language anywhere on this panel).
    check('10. No performance analytics language appears in Launch Control for a Live campaign (no ROAS/CTR/CPC/spend graph)', !/ROAS|CTR|CPC|spend graph|impressions/i.test(liveControl.controlText), liveControl.controlText);
    check('10b. Live selection renders no pre-flight readiness checklist (that concept doesn\'t apply to an already-deployed campaign)', !liveControl.hasChecksList, liveControl);

    // 6/8. Provider status is represented honestly — never claims a
    // verified "ACTIVE" state (that would require a real, current
    // provider re-check this pass deliberately does not add), and a
    // paused/archived local record is disclosed as ORIVEN's own record,
    // not an independently re-verified live read.
    check('6/8. The Live state never fabricates a verified "ACTIVE" provider status — honestly discloses "not yet re-verified"', /not yet re-verified/i.test(liveControl.stateSub), liveControl.stateSub);

    await page.click('.lq-row[data-name="paused live campaign"]');
    await page.waitForTimeout(600);
    const pausedControl = await page.evaluate(() => (document.querySelector('#lqControlCol .lqc-state-sub') || {}).textContent);
    check('7. Paused local state is disclosed honestly (ORIVEN record, not independently re-verified) — never shown as a fabricated real-time "Paused" from the provider', /Paused.*not independently re-verified/i.test(pausedControl || ''), pausedControl);

    await page.click('.lq-row[data-name="archived live campaign"]');
    await page.waitForTimeout(600);
    const archivedControl = await page.evaluate(() => (document.querySelector('#lqControlCol .lqc-state-sub') || {}).textContent);
    check('7b. Archived local state is also disclosed honestly the same way, never fabricated as verified', /Archived.*not independently re-verified/i.test(archivedControl || ''), archivedControl);

    // 11. No production provider mutation occurs from Live filtering/selection.
    check('11. No publish/pause/resume/delete request was ever triggered by browsing/filtering/selecting Live campaigns', publishCalls.length === 0, publishCalls);
    check('JS errors during the full Live filter walkthrough', jsErrors.length === 0, jsErrors);

    // Regression: spacing/alignment from the completed Launch pass remains intact.
    const spacing = await page.evaluate(() => {
      const filters = document.getElementById('lqFilters');
      const row = document.getElementById('lqWorkspaceRow');
      const grid = document.getElementById('launchGrid');
      const control = document.getElementById('lqControlCol');
      const mc = document.querySelector('.mc');
      return {
        gap: row.getBoundingClientRect().top - filters.getBoundingClientRect().bottom,
        topDiff: Math.abs(grid.getBoundingClientRect().top - control.getBoundingClientRect().top),
        mcClientHeight: mc.clientHeight, mcScrollHeight: mc.scrollHeight,
      };
    });
    check('regression: whitespace/alignment from the completed Launch pass is unaffected by the Live filter addition', spacing.gap >= 24 && spacing.gap <= 64 && spacing.topDiff === 0 && spacing.mcScrollHeight <= spacing.mcClientHeight + 1, spacing);
    check('regression: no "Review" text anywhere on a Launch row', !await page.evaluate(() => Array.from(document.querySelectorAll('.lq-row')).some((r) => /Review/i.test(r.textContent))));

    await page.close();

    // Mobile sanity.
    const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mockSetupStatus(page2, { google: SETUP_READY });
    await signIn(page2, user);
    await seedCampaigns(page2, campaigns);
    await page2.evaluate(() => { _orvNav('launch', 'page-launch'); });
    await page2.waitForTimeout(900);
    await page2.click('#lqStatusPills .lq-pill-status >> nth=1');
    await page2.waitForTimeout(500);
    const mobileOverflow = await page2.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    check('mobile: no horizontal overflow with the Live filter active at 390px', !mobileOverflow);
    await page2.close();
  } finally {
    await browser.close();
    if (user) await deleteTestUser(user.userId);
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + results.length + ' checks run, ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed.');
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
