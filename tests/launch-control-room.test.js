// ════════════════════════════════════════════════════════════════
// Launch — Launch Control Room pass
//
// Covers: the Launch home two-part workspace (CAMPAIGNS + LAUNCH
// CONTROL), real campaign selection driving a real-state readiness
// panel (reusing _launchBuildCampaignChecks/_launchBuildPlatformChecks/
// _launchAggregateReadiness — never a second readiness engine), honest
// empty/disconnected-provider states, provider switching without stale
// data, and that the existing #launchControlView detailed workspace and
// its real /api/publish contract remain completely untouched.
//
// All network calls are mocked (page.route) — this suite never performs
// a real provider mutation.
//
// RUN: node tests/launch-control-room.test.js
// ════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const BASE_URL = process.env.TEST_FRONTEND_URL || 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond });
  console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail !== undefined ? ' (' + JSON.stringify(detail) + ')' : ''));
}

async function createTestUser(suffix) {
  const email = `oriven.launchcr.test+${Date.now()}.${suffix}@example.com`;
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
  const { data: signInData, error } = await authClient.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
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
      metaAds: { primaryText: 'x', headline: 'x', cta: 'Shop Now', imageUrl: 'https://picsum.photos/seed/m1/400/300', budget: 30, finalUrl: 'https://example.com/shop' },
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
const SETUP_NOT_CONNECTED = { connected: false, ready: false, state: 'not_started' };

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let user;
  try {
    user = await createTestUser('a');

    // ── Main scenario: 3 Google campaigns (ready/warning/blocked) ──
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    let publishCalled = false;
    await page.route('**/api/publish/**', async (route) => { publishCalled = true; await route.abort(); });
    await mockSetupStatus(page, { google: SETUP_READY, meta: SETUP_READY, tiktok: SETUP_NOT_CONNECTED, pinterest: SETUP_READY });
    await signIn(page, user);

    const campReady = makeCampaign({ id: 'camp_ready', name: 'Summer Sale Ready', platform: 'google' });
    const campWarning = makeCampaign({ id: 'camp_warning', name: 'Spring Launch Warning', platform: 'google', pkg: { strategy: { goal: 'Sales', landingPageUrl: '', dailyBudget: null }, googleAds: { finalUrl: '', imageUrl: 'https://picsum.photos/seed/g2/400/300', budget: null } } });
    const campBlocked = makeCampaign({ id: 'camp_blocked', name: 'No Creative Blocked', platform: 'google', pkg: { googleAds: { imageUrl: null }, visualConcepts: [] } });
    await seedCampaigns(page, [campBlocked, campWarning, campReady]);
    await page.evaluate(() => { _orvNav('launch', 'page-launch'); });
    await page.waitForTimeout(700);

    // 13. No "All Platforms" tab
    const platPills = await page.evaluate(() => Array.from(document.querySelectorAll('#lqPlatformPills .lq-pill-plat')).map((b) => b.textContent.trim()));
    check('13. No "All Platforms" tab is introduced — exactly the 4 real providers, in order', JSON.stringify(platPills) === JSON.stringify(['Google Ads', 'Meta Ads', 'TikTok Ads', 'Pinterest Ads']), platPills);

    // 14. Removed provider underline does not return
    const underlineCheck = await page.evaluate(() => {
      const pill = document.querySelector('.lq-pill-plat-google');
      const cs = getComputedStyle(pill);
      return { boxShadow: cs.boxShadow, borderBottomWidth: cs.borderBottomWidth };
    });
    check('14. No provider-colored underline on the active platform pill', underlineCheck.boxShadow === 'none' || !/rgb/.test(underlineCheck.boxShadow), underlineCheck);

    // Launch Polish pass — real vertical whitespace above the workspace,
    // and the campaign column / Launch Control column staying perfectly
    // aligned once that spacing is added (a real, pre-existing CSS
    // parse-corruption bug was found and fixed here too — see the final
    // report for the root cause).
    const spacing = await page.evaluate(() => {
      const filters = document.getElementById('lqFilters');
      const row = document.getElementById('lqWorkspaceRow');
      const grid = document.getElementById('launchGrid');
      const control = document.getElementById('lqControlCol');
      const mc = document.querySelector('.mc');
      const filtersRect = filters.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      return {
        gap: rowRect.top - filtersRect.bottom,
        topDiff: Math.abs(grid.getBoundingClientRect().top - control.getBoundingClientRect().top),
        viewportHeight: window.innerHeight,
        mcClientHeight: mc.clientHeight,
        mcScrollHeight: mc.scrollHeight,
      };
    });
    check('1(spacing). There is clear, intentional whitespace between the top filter controls and the workspace (>= 24px, restrained not excessive)', spacing.gap >= 24 && spacing.gap <= 64, spacing);
    check('1(alignment). Campaign column and Launch Control remain vertically aligned after the spacing change', spacing.topDiff === 0, spacing);
    check('1(no-scroll). Normal 1440x900 Launch state still has no unnecessary page-level scroll after the spacing change', spacing.mcScrollHeight <= spacing.mcClientHeight + 1, spacing);

    // 2. Real campaign selection drives Launch Control (auto-selected first campaign)
    let controlState = await page.evaluate(() => ({
      name: document.querySelector('#lqControlCol .lqc-name') ? document.querySelector('#lqControlCol .lqc-name').textContent : null,
      hasChecks: document.querySelectorAll('#lqcChecks .lqc-check').length > 0,
    }));
    check('2. A real campaign is auto-selected on load and drives the Launch Control panel (read-only, no navigation)', !!controlState.name && controlState.hasChecks, controlState);

    // Select the blocked campaign explicitly
    await page.click('.lq-row[data-name="no creative blocked"]');
    await page.waitForTimeout(500);
    let state = await page.evaluate(() => ({
      stateClass: document.querySelector('#lqControlCol .lqc-state').className,
      stateLabel: document.querySelector('#lqControlCol .lqc-state-label').textContent,
      rowSelected: document.querySelector('.lq-row[data-name="no creative blocked"]').classList.contains('lq-row-selected'),
    }));
    // 4. Blocked state renders real blockers only
    check('4. Selecting a genuinely incomplete campaign (no creative) shows a real BLOCKED state', state.stateClass.indexOf('lqc-state-blocked') !== -1 && /BLOCKED/i.test(state.stateLabel), state);
    check('Selected campaign row gets a visible selected state', state.rowSelected, state.rowSelected);
    const blockedCheckReason = await page.evaluate(() => {
      const btn = document.querySelector('#lqcChecks .lqc-check-blocked');
      btn.click();
      return document.getElementById('lqcCheckDetail').textContent;
    });
    check('4b. The real blocker reason is shown (creative assets missing), not a generic message', /creative|image/i.test(blockedCheckReason), blockedCheckReason);

    // Select the warning campaign
    await page.click('.lq-row[data-name="spring launch warning"]');
    await page.waitForTimeout(500);
    state = await page.evaluate(() => ({
      stateClass: document.querySelector('#lqControlCol .lqc-state').className,
      sub: document.querySelector('#lqControlCol .lqc-state-sub').textContent,
    }));
    // 3. Warning state renders real warning information only
    check('3. A campaign with a real missing field shows a genuine WARNING state', state.stateClass.indexOf('lqc-state-warning') !== -1, state);
    check('3b. The warning summary states a real count ("checks need attention"), not a generic message only', /check.*attention/i.test(state.sub), state.sub);

    // Select the ready campaign
    await page.click('.lq-row[data-name="summer sale ready"]');
    await page.waitForTimeout(500);
    state = await page.evaluate(() => document.querySelector('#lqControlCol .lqc-state').className);
    // 5. Ready state only appears when actual readiness permits it
    check('5. A fully complete campaign with a real ready+connected platform shows READY TO LAUNCH', state.indexOf('lqc-state-ready') !== -1, state);

    // 8. No fake metrics anywhere in the control panel
    const controlPanelText = await page.evaluate(() => document.getElementById('lqControlCol').textContent);
    check('8. No fake CTR/ROAS/spend/performance metrics appear in Launch Control', !/CTR|ROAS|CPC|impressions|conversions:\s*\d/i.test(controlPanelText), true);

    // 9. Search still works
    await page.fill('#lqSearchInput', 'summer');
    await page.waitForTimeout(400);
    let visibleRows = await page.evaluate(() => document.querySelectorAll('.lq-row').length);
    check('9. Search still filters the real campaign list', visibleRows === 1, visibleRows);
    await page.fill('#lqSearchInput', '');
    await page.waitForTimeout(300);

    // 10. Status filtering still works
    await page.click('button.lq-pill-status:has-text("Blocked")');
    await page.waitForTimeout(400);
    visibleRows = await page.evaluate(() => document.querySelectorAll('.lq-row').length);
    check('10. Status filter still filters the real campaign list (Blocked)', visibleRows === 1, visibleRows);
    await page.click('button.lq-pill-status:has-text("All statuses")');
    await page.waitForTimeout(300);

    // 4/17. "Review →" is completely gone from campaign rows — the row's
    // ONLY interaction is now selection (Launch Polish pass).
    const noReview = await page.evaluate(() => ({
      anyReviewText: Array.from(document.querySelectorAll('.lq-row')).some((r) => /Review/i.test(r.textContent)),
      reviewElements: document.querySelectorAll('.lq-review').length,
    }));
    check('4(review-gone). No "Review" text/element appears anywhere in a campaign row', !noReview.anyReviewText && noReview.reviewElements === 0, noReview);

    // 5/6. Clicking a row selects it and updates Launch Control — it does
    // NOT auto-navigate into the old detailed workspace.
    await page.click('.lq-row[data-name="summer sale ready"]');
    await page.waitForTimeout(500);
    const afterRowClick = await page.evaluate(() => ({
      stillOnSelectView: document.getElementById('launchSelectView').style.display !== 'none',
      controlViewHidden: document.getElementById('launchControlView').style.display === 'none',
      controlName: document.querySelector('#lqControlCol .lqc-name') ? document.querySelector('#lqControlCol .lqc-name').textContent : null,
    }));
    check('5. Clicking a campaign row selects it and updates Launch Control', afterRowClick.controlName === 'Summer Sale Ready', afterRowClick);
    check('6. Clicking a campaign row does NOT automatically open the old detailed workspace', afterRowClick.stillOnSelectView && afterRowClick.controlViewHidden, afterRowClick);

    // 11/12/O. The old detailed workspace is NOT deleted — it remains
    // reachable via Launch Control's own real contextual action button
    // (never a generic "Review" label anymore either).
    const actionBtnText = await page.evaluate(() => document.querySelector('#lqcActionRow .lqc-action-btn').textContent);
    check('11(label). Launch Control\'s action button uses forward-looking language, not "Review campaign"', !/review campaign/i.test(actionBtnText), actionBtnText);
    await page.click('#lqcActionRow .lqc-action-btn');
    await page.waitForTimeout(700);
    const workspaceOpen = await page.evaluate(() => ({
      controlViewVisible: document.getElementById('launchControlView').style.display !== 'none',
      campName: document.getElementById('lcCampName').textContent,
      hasLaunchBtn: !!document.getElementById('lcLaunchBtn'),
      checksCount: document.querySelectorAll('#lcPreflightChecks .lw-check').length,
    }));
    check('11. Existing detailed campaign workspace (#launchControlView) still opens, via Launch Control\'s own real action', workspaceOpen.controlViewVisible && workspaceOpen.campName === 'Summer Sale Ready', workspaceOpen);
    check('12. Existing readiness/review behavior remains intact (real checks + Launch Campaign button present)', workspaceOpen.hasLaunchBtn && workspaceOpen.checksCount > 0, workspaceOpen);
    await page.click('.lw-back-btn');
    await page.waitForTimeout(500);

    // 19b. A blocked campaign with a real, specific fix routes DIRECTLY to
    // that real capability (Fix in Create) instead of the generic workspace.
    await page.click('.lq-row[data-name="no creative blocked"]');
    await page.waitForTimeout(500);
    const specificAction = await page.evaluate(() => {
      const btn = document.querySelector('#lqcActionRow .lqc-action-btn');
      return { label: btn.textContent, onclick: btn.getAttribute('onclick') };
    });
    check('19b. Specific issue resolution uses the real existing action (Fix in Create), not a generic review detour', specificAction.label.indexOf('Fix in Create') !== -1 && specificAction.onclick.indexOf('openCampaignWorkspace') !== -1, specificAction);

    // 16. No production mutation from read-only Launch-home interactions
    check('16. No /api/publish/* request was ever triggered by any Launch-home read-only interaction', !publishCalled, publishCalled);

    // ── Provider switching: no stale data (real bug found + fixed this pass) ──
    await page.evaluate(() => { window._launchSetPlatformFilter('meta'); });
    await page.waitForTimeout(500);
    let metaEmptyState = await page.evaluate(() => ({
      emptyVisible: getComputedStyle(document.getElementById('launchEmpty')).display !== 'none',
      gridVisible: getComputedStyle(document.getElementById('launchGrid')).display !== 'none',
      controlProvider: document.querySelector('#lqControlCol .lqc-provider-id span') ? document.querySelector('#lqControlCol .lqc-provider-id span').textContent : null,
    }));
    check('1. Provider switching updates the campaign list (Meta has no campaigns yet — honest empty state, not stale Google rows)', metaEmptyState.emptyVisible && !metaEmptyState.gridVisible, metaEmptyState);
    check('1b. Provider switching updates the Launch Control panel to the new real provider', metaEmptyState.controlProvider === 'Meta Ads', metaEmptyState);

    await seedCampaigns(page, [campBlocked, campWarning, campReady, makeCampaign({ id: 'camp_meta1', name: 'Meta Ready Campaign', platform: 'meta' })]);
    await page.evaluate(() => { renderLaunchPage(); });
    await page.waitForTimeout(600);
    const metaPopulated = await page.evaluate(() => ({
      emptyVisible: getComputedStyle(document.getElementById('launchEmpty')).display !== 'none',
      rowCount: document.querySelectorAll('.lq-row').length,
      rowText: document.querySelector('.lq-row') ? document.querySelector('.lq-row').textContent : null,
    }));
    // 15. No stale previous-provider campaign/control data remains after provider switch — the
    // exact real bug this pass found (body.dark-mode .camp-hub-empty's !important display rule
    // fighting the plain inline style toggle) and fixed via _lqSetDisplay's setProperty(...,'important').
    check('15. No stale empty-state message remains once a real campaign exists for the newly selected provider', !metaPopulated.emptyVisible && metaPopulated.rowCount === 1, metaPopulated);

    check('JS errors during the full Launch Control Room walkthrough', jsErrors.length === 0, jsErrors);
    await page.close();

    // ── 6/7: Empty provider state, no fabricated campaigns, real setup state used ──
    {
      const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const e = []; p.on('pageerror', (err) => e.push(err.message));
      await mockSetupStatus(p, { google: SETUP_READY });
      await signIn(p, user);
      await seedCampaigns(p, []);
      await p.evaluate(() => { _orvNav('launch', 'page-launch'); });
      await p.waitForTimeout(700);
      const emptyState = await p.evaluate(() => ({
        campaignRows: document.querySelectorAll('.lq-row').length,
        controlText: document.getElementById('lqControlCol').textContent,
      }));
      check('6. Empty provider state does not fabricate any campaign rows', emptyState.campaignRows === 0, emptyState.campaignRows);
      check('7. Empty state uses real provider/setup state (shows real connection+account info, not silence)', /Google Ads connection|Ad account/i.test(emptyState.controlText), true);
      check('JS errors (empty state)', e.length === 0, e);
      await p.close();
    }

    // ── J: disconnected provider — honest state, real "Connect" action, no fabricated readiness ──
    {
      const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const e = []; p.on('pageerror', (err) => e.push(err.message));
      await mockSetupStatus(p, { google: SETUP_NOT_CONNECTED });
      await signIn(p, user);
      await seedCampaigns(p, [makeCampaign({ id: 'camp_dc', name: 'Disconnected Provider Test', platform: 'google' })]);
      await p.evaluate(() => { _orvNav('launch', 'page-launch'); });
      await p.waitForTimeout(700);
      const dc = await p.evaluate(() => ({
        stateClass: document.querySelector('#lqControlCol .lqc-state').className,
        actionLabel: document.querySelector('#lqcActionRow .lqc-action-btn') ? document.querySelector('#lqcActionRow .lqc-action-btn').textContent : null,
      }));
      check('Disconnected provider produces a real BLOCKED Launch Control state', dc.stateClass.indexOf('lqc-state-blocked') !== -1, dc);
      check('Disconnected provider surfaces a real "Connect" action (bizGoTo(\'connections\'), not a fabricated fix)', /Connect/i.test(dc.actionLabel), dc.actionLabel);
      check('JS errors (disconnected)', e.length === 0, e);
      await p.close();
    }

    // ── Responsive: 1440 viewport measurement, 1280, 390 ──
    {
      const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const e = []; p.on('pageerror', (err) => e.push(err.message));
      await mockSetupStatus(p, { google: SETUP_READY });
      await signIn(p, user);
      await seedCampaigns(p, [makeCampaign({ id: 'camp_v1', name: 'Viewport Test A', platform: 'google' }), makeCampaign({ id: 'camp_v2', name: 'Viewport Test B', platform: 'google' })]);
      await p.evaluate(() => { _orvNav('launch', 'page-launch'); });
      await p.waitForTimeout(700);
      const measurements = await p.evaluate(() => {
        const mc = document.querySelector('.mc');
        return { viewportHeight: window.innerHeight, mcClientHeight: mc.clientHeight, mcScrollHeight: mc.scrollHeight };
      });
      // 17. Desktop page does not unnecessarily overflow the viewport in normal state
      check('17. Desktop (1440px, few campaigns): Launch home fits the viewport without unnecessary page-level scroll', measurements.mcScrollHeight <= measurements.mcClientHeight + 2, measurements);
      check('JS errors (1440 measurement)', e.length === 0, e);
      await p.close();
    }
    {
      const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const e = []; p.on('pageerror', (err) => e.push(err.message));
      await mockSetupStatus(p, { google: SETUP_READY });
      await signIn(p, user);
      await seedCampaigns(p, [makeCampaign({ id: 'camp_m1', name: 'Mobile Test', platform: 'google' })]);
      await p.evaluate(() => { _orvNav('launch', 'page-launch'); });
      await p.waitForTimeout(700);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      const reachable = await p.evaluate(() => {
        const row = document.querySelector('.lq-row');
        const control = document.getElementById('lqControlCol');
        return { rowVisible: row && row.offsetHeight > 0, controlHasContent: control && control.textContent.length > 0 };
      });
      // 18. Mobile remains fully reachable
      check('18. Mobile (390px): no horizontal overflow', !overflow, overflow);
      check('18b. Mobile (390px): campaign row and Launch Control both reachable/rendered', reachable.rowVisible && reachable.controlHasContent, reachable);
      check('JS errors (mobile)', e.length === 0, e);
      await p.close();
    }

    console.log(`\n${results.length} checks run, ${results.filter((r) => r.ok).length} passed, ${results.filter((r) => !r.ok).length} failed.`);
    if (results.some((r) => !r.ok)) process.exitCode = 1;
  } finally {
    if (user) await deleteTestUser(user.userId);
    await browser.close();
  }
}
main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
