// ════════════════════════════════════════════════════════════════
// Launch Control — campaign pre-flight + deployment workspace
// (Launch Control sprint)
//
// Covers the sprint's testing checklist: empty state, campaign
// selection (real fields only), readiness computed across
// PASS/WARNING/BLOCKED/NOT_CHECKED, platform-aware checks (missing
// connection, missing creative, missing destination/budget), the
// backend launch gate (frontend never bypasses it), double-submission
// protection, successful deployment, honest failure (retry-safe vs
// lock-conflict), no fabricated data, responsive/mobile, and basic
// accessibility (status conveyed by text, not color alone).
//
// Real HTTP is used for platform readiness (GET /api/setup/meta/status
// against real, disposable, seeded Supabase integrations rows — same
// convention as launch-readiness-gate.test.js/platform-setup-engine.
// test.js). Deployment success/failure/lock-conflict are exercised via
// a window.apiFetch override for ONLY /api/publish/* (same established
// mocking convention as live-campaigns-drafts.test.js/campaign-
// overview-metrics.test.js) — never a real ad platform call, never
// real spend. Campaigns themselves are seeded directly into
// localStorage (the real, existing client-side campaign store —
// _orvCampaignsKey/_loadCamps/_saveCamps), matching real pkg field
// names the real /api/publish/{platform} routes and Launch Control's
// own _launchExtractFields both read.
//
// RUN: node tests/launch-control.test.js
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
  const email = `oriven.launchctrl.test+${Date.now()}.${suffix}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'creator', onboarding_completed: true }, { onConflict: 'id' });
  return { userId, email, password };
}
async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('integrations').delete().eq('user_id', userId); } catch (_) {}
  try { await supabaseAdmin.from('profiles').delete().eq('id', userId); } catch (_) {}
  try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
}
async function connectMeta(userId) {
  await supabaseAdmin.from('integrations').upsert({
    user_id: userId, provider: 'meta_ads', access_token: 'fake', token_expiry: new Date(Date.now() + 3600000).toISOString(),
    meta_ads_accounts: [{ account_id: 'act_1', account_name: 'Test Ad Account' }],
    active_ad_account: { account_id: 'act_1', account_name: 'Test Ad Account' },
    meta_pages: [{ page_id: 'p1', page_name: 'Test Page' }],
    active_page: { page_id: 'p1', page_name: 'Test Page' },
    connected_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' });
}

async function signInAndGoto(browser, user, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 1440, height: 1000 } });
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
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
  page._jsErrors = jsErrors;
  return page;
}

async function gotoLaunch(page) {
  // Trigger the exact same handler the real nav button's onclick calls
  // (_orvNav('launch','page-launch')) — robust across viewports, since on
  // mobile the desktop nav bar is hidden behind the hamburger drawer and
  // real nav still needs to work identically either way.
  await page.evaluate(() => { _orvNav('launch', 'page-launch'); });
  await page.waitForTimeout(400);
}

// Real pkg shape — same fields server.js's own /api/publish/meta route
// and _launchExtractFields both read (strategy.landingPageUrl,
// metaAds.budget, visualConcepts[].generatedImageUrl).
function makeCampaign(overrides) {
  const id = 'lc_test_' + Math.random().toString(36).slice(2);
  const base = {
    id, name: 'Summer Sale Campaign', platform: 'meta', status: 'ready-to-publish',
    goal: 'Sales', creativeMode: 'images', created: new Date().toISOString(),
    pkg: {
      campaignName: 'Summer Sale Campaign',
      strategy: { goal: 'Sales', landingPageUrl: 'https://example.com/summer-sale' },
      metaAds: { headline: 'Big Summer Sale', primaryText: 'Save big this summer.', budget: 25 },
      visualConcepts: [{ conceptRef: 'a', generatedImageUrl: 'https://picsum.photos/seed/lcsummer/600/600' }],
    },
  };
  return Object.assign({}, base, overrides, { pkg: Object.assign({}, base.pkg, (overrides && overrides.pkg) || {}) });
}

async function seedCampaigns(page, camps) {
  await page.evaluate((camps) => {
    const key = (typeof _orvCampaignsKey === 'function') ? _orvCampaignsKey() : null;
    if (key) localStorage.setItem(key, JSON.stringify(camps));
  }, camps);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let userReady, userNoConn;
  try {
    userReady = await createTestUser('ready');
    userNoConn = await createTestUser('noconn');
    await connectMeta(userReady.userId);

    // ════════════════════════════════════════════════════════════
    // 1. EMPTY STATE
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userNoConn);
      try {
        await seedCampaigns(page, []);
        await gotoLaunch(page);
        const empty = await page.evaluate(() => ({
          emptyVisible: document.getElementById('launchEmpty').style.display !== 'none',
          gridHidden: document.getElementById('launchGrid').style.display === 'none',
          title: document.querySelector('#launchEmpty .camp-hub-empty-title')?.textContent,
          sub: document.querySelector('#launchEmpty .camp-hub-empty-sub')?.textContent,
          hasCTA: !!document.querySelector('#launchEmpty .camp-new-btn'),
        }));
        check('1. Empty state shows when no campaigns exist', empty.emptyVisible && empty.gridHidden, empty);
        check('1b. Empty state headline is "Ready to launch?" (real copy, not fabricated marketing)', empty.title === 'Ready to launch?', empty.title);
        check('1c. Empty state has a real "Go to Create" CTA', empty.hasCTA, empty.hasCTA);
        check('JS errors during empty state', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 2. CAMPAIGN SELECTION — real fields only
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camps = [
          makeCampaign({ name: 'Selection Test A', status: 'draft', platform: 'google', pkg: { googleAds: { headlines: ['H1'], budget: 20 } } }),
          makeCampaign({ name: 'Selection Test B', status: 'generated', platform: 'google' }),
        ];
        await seedCampaigns(page, camps);
        await gotoLaunch(page);
        // Launch UX Structure pass: "New Campaign" / "Create campaign" is
        // removed from Launch entirely, not merely demoted — campaign
        // creation is Create's job, and the existing sidebar Create nav
        // item is the only way back there (no competing CTA of any kind
        // inside Launch's own header).
        const noCreateCta = await page.evaluate(() => ({
          hasCreateLink: !!document.querySelector('.lq-create-link'),
          hasNewCampaignBtn: !!document.querySelector('#launchSelectView .camp-new-btn'),
          headerText: document.querySelector('.lq-hdr')?.textContent.trim(),
        }));
        check('1d. No "New Campaign"/"Create campaign" CTA of any kind exists inside Launch\'s header — campaign creation is reached only via the existing Create nav item', !noCreateCta.hasCreateLink && !noCreateCta.hasNewCampaignBtn && noCreateCta.headerText === 'Launch', noCreateCta);
        // Launch Workspace redesign: a compact launch QUEUE row (.lq-row),
        // not a large asset-gallery card (spec 3) — the whole row is one
        // real <button>, and there is no separate edit/Ads-Manager/delete
        // action row at all (those are Create/Campaigns responsibilities,
        // not Launch's). Launch Polish pass: the row's own "Review →"
        // shortcut is gone entirely — selection is the row's only job now.
        const sel = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll('#launchGrid .lq-row'));
          return {
            count: rows.length,
            names: rows.map((r) => r.querySelector('.lq-name')?.textContent),
            allAreButtons: rows.every((r) => r.tagName === 'BUTTON'),
            noReviewLabel: rows.every((r) => !/Review/.test(r.textContent) && !r.querySelector('.lq-review')),
            hasNestedButtons: rows.some((r) => r.querySelector('button')),
            hasAdsManagerText: rows.some((r) => /Ads Manager|Continue Editing|Delete/.test(r.textContent)),
            hasReadinessPill: rows.every((r) => !!r.querySelector('.lq-readiness')),
            hasThumb: rows.every((r) => !!r.querySelector('.lq-thumb, .lq-thumb-empty')),
          };
        });
        check('2. Both seeded campaigns render as real compact rows', sel.count === 2, sel.count);
        check('2b. Row names are the real campaign names (no fabrication)', sel.names.includes('Selection Test A') && sel.names.includes('Selection Test B'), sel.names);
        check('2c. Rows are compact — one real button, no "Review →" shortcut, a real readiness pill, no nested edit/Ads-Manager/delete controls (those are Create/Campaigns responsibilities)', sel.allAreButtons && sel.noReviewLabel && !sel.hasNestedButtons && !sel.hasAdsManagerText && sel.hasReadinessPill && sel.hasThumb, sel);

        // Launch Home Filter/Search Refinement pass: campaigns are no
        // longer grouped by provider (spec: "All Platforms" removed,
        // exactly one platform is always selected via persistent nav) —
        // the platform nav itself establishes context, so cards must not
        // render a per-provider group header, nor redundantly repeat the
        // already-selected platform's name (spec: "DO NOT REPEAT PROVIDER
        // INFORMATION UNNECESSARILY").
        const noRedundantProvider = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll('#launchGrid .lq-row'));
          return {
            noGroupHeaders: document.querySelectorAll('.lq-group').length === 0,
            noRepeatedProviderText: rows.every((r) => !/Google Ads|Meta Ads|TikTok Ads|Pinterest Ads/.test(r.textContent)),
          };
        });
        check('2e. Campaigns are no longer grouped by provider — the platform nav is the persistent context, not per-card grouping', noRedundantProvider.noGroupHeaders, noRedundantProvider);
        check('2f. Individual campaign rows do not redundantly repeat the already-selected platform\'s name', noRedundantProvider.noRepeatedProviderText, noRedundantProvider);

        // Launch Control Room pass — clicking a row now SELECTS it (drives
        // the real Launch Control readiness panel alongside the list,
        // spec: "the user should immediately understand THIS is the
        // campaign currently being inspected for launch") instead of
        // jumping straight into the full workspace. Launch Polish pass:
        // the row no longer has a "Review →" shortcut at all — selection
        // is its ONLY interaction. The full workspace is reached only via
        // Launch Control's own real contextual action button.
        await page.click('#launchGrid .lq-row >> nth=0');
        await page.waitForTimeout(500);
        const selected = await page.evaluate(() => ({
          stillOnSelectView: document.getElementById('launchSelectView').style.display !== 'none',
          rowSelected: document.querySelector('#launchGrid .lq-row').classList.contains('lq-row-selected'),
          controlHasCampaign: !!document.querySelector('#lqControlCol .lqc-name'),
        }));
        check('2d. Clicking a row SELECTS it in place (real, restrained selected state) and drives Launch Control — it does not navigate away', selected.stillOnSelectView && selected.rowSelected && selected.controlHasCampaign, selected);

        // Launch Polish pass: for a BLOCKED campaign (Google isn't
        // connected for this test user), the action button routes
        // DIRECTLY to the real fix (Connect Google Ads) rather than a
        // generic review detour — proving "prefer direct contextual
        // actions" holds even from this exact click path.
        const blockedActionBtn = await page.evaluate(() => document.querySelector('#lqcActionRow .lqc-action-btn').textContent);
        check('2d2. A BLOCKED selection\'s action button is a specific, real fix (not "Review campaign")', /Connect/.test(blockedActionBtn) && !/review campaign/i.test(blockedActionBtn), blockedActionBtn);

        // Now prove the full Launch Workspace is still reachable — via
        // Launch Control's own action button — once a campaign is
        // genuinely READY (real Meta connection already seeded above).
        await page.click('#lqPlatformPills .lq-pill-plat-meta');
        await page.waitForTimeout(400);
        const readyMetaCamp = makeCampaign({ name: 'Ready Meta Campaign' });
        await seedCampaigns(page, camps.concat([readyMetaCamp]));
        await gotoLaunch(page);
        await page.click('#lqPlatformPills .lq-pill-plat-meta');
        await page.waitForTimeout(400);
        await page.click('.lq-row[data-name="ready meta campaign"]');
        await page.waitForTimeout(500);
        const readyActionBtn = await page.evaluate(() => document.querySelector('#lqcActionRow .lqc-action-btn').textContent);
        check('2d3. A genuinely READY campaign\'s action button reads forward ("Continue to Launch"), not "Review campaign"', /Continue to Launch/.test(readyActionBtn), readyActionBtn);
        await page.click('#lqcActionRow .lqc-action-btn');
        await page.waitForTimeout(1200);
        const opened = await page.evaluate(() => ({
          selectHidden: document.getElementById('launchSelectView').style.display === 'none',
          controlVisible: document.getElementById('launchControlView').style.display !== 'none',
          campName: document.getElementById('lcCampName').textContent,
        }));
        check('2d4. Launch Control\'s own real action button opens the full Launch Workspace for a genuinely ready campaign', opened.selectHidden && opened.controlVisible && opened.campName === 'Ready Meta Campaign', opened);
        check('JS errors during selection', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 2h. HOME — title hierarchy (matches Create/Research exactly) +
    //     no subtitle/eyebrow + all 4 real platforms reachable via the
    //     persistent platform nav (Google Ads default, no "All Platforms")
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camps = [
          makeCampaign({ name: 'Search Campaign', platform: 'google', pkg: { googleAds: { headline: 'G', budget: 20 } } }),
          makeCampaign({ name: 'Feed Campaign', platform: 'meta' }),
          makeCampaign({ name: 'Clip Campaign', platform: 'tiktok', pkg: { tiktokAds: { budget: 15 } } }),
          makeCampaign({ name: 'Pin Campaign', platform: 'pinterest', pkg: { pinterestAds: { budget: 10 } } }),
        ];
        await seedCampaigns(page, camps);
        await gotoLaunch(page);

        const home = await page.evaluate(() => {
          const title = document.querySelector('.lq-hdr-title');
          const tr = title.getBoundingClientRect();
          const hub = document.querySelector('.lq-hub').getBoundingClientRect();
          return {
            titleText: title.textContent,
            titleCentered: Math.abs((tr.left + tr.width / 2) - (hub.left + hub.width / 2)) < 3,
            titleFontSize: getComputedStyle(title).fontSize,
            titleFontWeight: getComputedStyle(title).fontWeight,
            hasSubtitle: !!document.querySelector('.lq-hdr-sub') || /Which campaign do you want to deploy/i.test(document.getElementById('launchSelectView').textContent),
            hasDeployEyebrow: Array.from(document.querySelectorAll('#launchSelectView *')).some((el) => el.children.length === 0 && el.textContent.trim() === 'Deploy'),
          };
        });
        check('16. Launch title is visibly centered on the page\'s central axis (genuine text-align:center, not just a centered column)', home.titleCentered, home);
        check('17. Launch title matches Create/Research\'s exact hierarchy (28px / 800 weight, same as .cr2-h1/.rsc-page-h1)', home.titleFontSize === '28px' && home.titleFontWeight === '800', home);
        check('18. "Which campaign do you want to deploy?" subtitle is gone — the title alone is the page context', !home.hasSubtitle, home.hasSubtitle);
        check('19. No "Deploy" eyebrow/label sits above or beside "Launch" — Launch itself is the page identity', !home.hasDeployEyebrow, home.hasDeployEyebrow);

        // Each real platform is reachable via the persistent nav (no "All
        // Platforms") and shows exactly its own real campaign.
        const expect = { google: 'Search Campaign', meta: 'Feed Campaign', tiktok: 'Clip Campaign', pinterest: 'Pin Campaign' };
        const perPlatform = {};
        for (const p of ['google', 'meta', 'tiktok', 'pinterest']) {
          await page.click('#lqPlatformPills .lq-pill-plat-' + p);
          await page.waitForTimeout(150);
          perPlatform[p] = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent.trim()));
        }
        check('20. All four real platforms (Google/Meta/TikTok/Pinterest) are reachable via the platform nav, each showing exactly its real campaign', Object.keys(expect).every((p) => perPlatform[p].length === 1 && perPlatform[p][0] === expect[p]), perPlatform);

        // The list-level readiness pill must use the exact same vocabulary
        // as the workspace's own _launchAggregateReadiness (BLOCKED, not a
        // second divergent term) — one real readiness vocabulary (spec 24).
        const blockedCamp = makeCampaign({ name: 'No Creative For List', platform: 'google', pkg: { visualConcepts: [] } });
        await seedCampaigns(page, camps.concat([blockedCamp]));
        await gotoLaunch(page);
        await page.click('#lqPlatformPills .lq-pill-plat-google');
        await page.waitForTimeout(150);
        const blockedPill = await page.evaluate(() => {
          const row = Array.from(document.querySelectorAll('.lq-row')).find((r) => r.querySelector('.lq-name')?.textContent === 'No Creative For List');
          return row ? row.querySelector('.lq-readiness')?.textContent : null;
        });
        check('21. A campaign missing its creative reads BLOCKED at the list level too — same vocabulary as the workspace, never the old divergent "NEEDS ATTENTION" term', blockedPill === 'BLOCKED', blockedPill);
        check('JS errors on Launch home', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 2i. HOME — Ad Library: search + platform nav + status filter
    //     (real, client-side, over the real pending-campaign list).
    //     Platform is now persistent single-select nav (no "All
    //     Platforms", Google Ads default) — only search/status are
    //     clearable "filters" (Launch Home Filter/Search Refinement).
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camps = [
          makeCampaign({ name: 'Bloom Search Test', platform: 'google', pkg: { googleAds: { headline: 'G', budget: 20 } } }),
          makeCampaign({ name: 'Ready Meta Campaign', platform: 'meta' }),
          makeCampaign({ name: 'Warning Meta Campaign', platform: 'meta', pkg: { strategy: { goal: 'Traffic', landingPageUrl: '' }, metaAds: { budget: null } } }),
        ];
        await seedCampaigns(page, camps);
        await gotoLaunch(page);

        const controlsExist = await page.evaluate(() => ({
          hasSearch: !!document.getElementById('lqSearchInput'),
          hasPlatformPills: document.querySelectorAll('#lqPlatformPills .lq-pill').length,
          hasAllPlatformsOption: Array.from(document.querySelectorAll('#lqPlatformPills .lq-pill')).some((p) => /all platforms/i.test(p.textContent)),
          hasStatusPills: document.querySelectorAll('#lqStatusPills .lq-pill').length,
          defaultPlatform: document.querySelector('#lqPlatformPills .lq-pill-active')?.textContent.trim(),
        }));
        check('22. A real search field exists on the Launch home', controlsExist.hasSearch, controlsExist);
        check('23. A real platform nav exists with exactly the 4 real providers — "All Platforms" removed, Google Ads the default', controlsExist.hasPlatformPills === 4 && !controlsExist.hasAllPlatformsOption && /google/i.test(controlsExist.defaultPlatform || ''), controlsExist);
        check('24. A real status filter (All + Live + real readiness states) exists, using the exact same vocabulary as the card pills — never a fabricated Active/Paused concept', controlsExist.hasStatusPills === 5, controlsExist);

        // Default (Google) already shows only the real Google campaign.
        let visible = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent));
        check('25. The default Google Ads view shows only real Google campaigns', visible.length === 1 && visible[0] === 'Bloom Search Test', visible);

        // Switch to Meta Ads -> only real Meta campaigns.
        await page.click('#lqPlatformPills .lq-pill-plat-meta');
        await page.waitForTimeout(150);
        visible = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent));
        check('25b. Selecting the Meta Ads platform shows only real Meta campaigns', visible.sort().join('|') === ['Ready Meta Campaign', 'Warning Meta Campaign'].sort().join('|'), visible);

        // Status filter: Ready with Warnings only (still on Meta).
        await page.click('#lqStatusPills .lq-pill:nth-child(4)'); // "Ready with Warnings" (All, Live, Ready to Launch, Ready with Warnings, Blocked)
        await page.waitForTimeout(150);
        visible = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent));
        check('26. Selecting the "Ready with Warnings" status filter shows only the real campaign in that real readiness state', visible.length === 1 && visible[0] === 'Warning Meta Campaign', visible);

        // Combine: Meta platform (still selected) + search "Ready".
        await page.click('#lqStatusPills .lq-pill:nth-child(1)'); // back to "All statuses"
        await page.waitForTimeout(150);
        await page.fill('#lqSearchInput', 'Ready');
        await page.waitForTimeout(150);
        visible = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent));
        check('27. Platform + search combine correctly — only the real campaign matching BOTH survives', visible.length === 1 && visible[0] === 'Ready Meta Campaign', visible);

        const clearVisible = await page.evaluate(() => document.getElementById('lqClearFilters').style.visibility !== 'hidden');
        check('28. "Clear filters" becomes visible whenever a real filter (search/status) is active', clearVisible, clearVisible);
        await page.click('#lqClearFilters');
        await page.waitForTimeout(150);
        const afterClear = await page.evaluate(() => ({
          count: document.querySelectorAll('.lq-row').length,
          searchVal: document.getElementById('lqSearchInput').value,
          clearHidden: document.getElementById('lqClearFilters').style.visibility === 'hidden',
          stillOnMeta: document.querySelector('#lqPlatformPills .lq-pill-active')?.textContent.trim(),
        }));
        check('29. "Clear filters" restores the full real campaign list for the current platform and resets search/status — the platform selection itself is untouched (persistent nav, not a clearable filter)', afterClear.count === 2 && afterClear.searchVal === '' && afterClear.clearHidden && /meta/i.test(afterClear.stillOnMeta || ''), afterClear);

        // Honest empty state for a search that matches nothing real — the
        // platform nav must stay visible so the user can switch platforms.
        await page.fill('#lqSearchInput', 'zzz-no-such-campaign-zzz');
        await page.waitForTimeout(150);
        const emptySearch = await page.evaluate(() => ({
          emptyVisible: document.getElementById('launchEmpty').style.display !== 'none',
          filtersStillVisible: document.getElementById('lqFilters').style.display !== 'none',
          title: document.querySelector('#launchEmpty .camp-hub-empty-title')?.textContent,
          hasFakeResults: document.querySelectorAll('.lq-row').length > 0,
        }));
        check('30. A search/filter combination matching nothing shows an honest "No campaigns found" state (platform nav still visible so the user can switch), never fabricated results', emptySearch.emptyVisible && emptySearch.filtersStillVisible && emptySearch.title === 'No campaigns found' && !emptySearch.hasFakeResults, emptySearch);
        check('JS errors during Ad Library filtering', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 3. READY state — complete campaign + connected platform
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camp = makeCampaign({ name: 'Ready Campaign' });
        await seedCampaigns(page, [camp]);
        await gotoLaunch(page);
        await page.evaluate((id) => { window._launchOpenControl(id); }, camp.id);
        await page.waitForTimeout(1500);
        // Launch Workspace redesign: readiness lives in the compact right-
        // column list (.lw-check rows) + the launch bar's state label
        // (#lcLaunchState), not the old giant top badge / 8-card grid.
        const st = await page.evaluate(() => ({
          state: document.querySelector('#lcLaunchState .lw-launch-state-label')?.textContent,
          stateClass: document.querySelector('#lcLaunchState .lw-launch-state-label')?.className,
          checks: Array.from(document.querySelectorAll('.lw-check')).map((c) => ({
            label: c.querySelector('.lw-check-label')?.textContent?.trim(),
            statusText: c.querySelector('.lw-check-status')?.textContent,
            cls: c.className,
          })),
          launchBtnDisabled: document.getElementById('lcLaunchBtn').disabled,
          launchBtnText: document.getElementById('lcLaunchBtn').textContent,
        }));
        check('3. Complete campaign + connected platform reads READY TO LAUNCH', st.state === 'READY TO LAUNCH' && /lw-launch-state-ready/.test(st.stateClass), st.state);
        const tracking = st.checks.find((c) => /Tracking/i.test(c.label || ''));
        check('3b. Tracking check is honestly NOT VERIFIED, never claims PASS/READY (spec: never fake a green tracking check)', tracking && tracking.statusText === 'NOT VERIFIED', tracking);
        check('3c. Launch button is enabled and says "Launch Campaign" when ready', !st.launchBtnDisabled && st.launchBtnText === 'Launch Campaign', { disabled: st.launchBtnDisabled, text: st.launchBtnText });
        const allButTracking = st.checks.filter((c) => !/Tracking/i.test(c.label || ''));
        check('3d. Every other check is a real PASS/READY status (real complete data, not fabricated)', allButTracking.every((c) => c.statusText === 'READY'), allButTracking);

        // Click-to-expand: selecting a check row reveals its detail inline,
        // the ONLY place that explanation lives (spec 14) — no separate
        // "Needs attention" section duplicating it.
        const trackingRow = st.checks.findIndex((c) => /Tracking/i.test(c.label || ''));
        await page.click('.lw-check >> nth=' + trackingRow);
        await page.waitForTimeout(200);
        const detail = await page.evaluate(() => ({
          visible: document.getElementById('lcCheckDetail').style.display !== 'none',
          title: document.querySelector('.lw-check-detail-title')?.textContent,
          reason: document.querySelector('.lw-check-detail-reason')?.textContent,
          noDuplicateIssuesSection: !document.getElementById('lcIssuesSection'),
        }));
        check('3e. Clicking a readiness row reveals its real explanation inline (click-to-expand detail)', detail.visible && /Tracking/i.test(detail.title || '') && detail.reason.length > 0, detail);
        check('3f. The old duplicate "Needs attention" section is gone — one explanation lives in one place', detail.noDuplicateIssuesSection, detail.noDuplicateIssuesSection);
        check('JS errors in READY scenario', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 3g. WORKSPACE — three-zone structure (Ad Library / Full Ad Editor
    //     pass): LEFT = ORIVEN, CENTER = real ad preview, RIGHT = real
    //     readiness/settings/launch. Real image + real copy fields only.
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camp = makeCampaign({
          name: 'Three Zone Campaign',
          pkg: { metaAds: { headline: 'Real Headline', primaryText: 'Real primary text.', cta: 'Shop Now', budget: 25 } },
        });
        await seedCampaigns(page, [camp]);
        await gotoLaunch(page);
        await page.evaluate((id) => { window._launchOpenControl(id); }, camp.id);
        await page.waitForTimeout(1500);

        const zones = await page.evaluate(() => {
            const orivenCol = document.querySelector('.lw-oriven-col');
            const previewCol = document.querySelector('.lw-preview-col');
            const rightCol = document.querySelector('.lw-right');
            const grid = document.querySelector('.lw-grid-3');
            if (!grid) return { noGrid: true };
            const kids = Array.from(grid.children);
            const orivenRect = orivenCol.getBoundingClientRect();
            const previewRect = previewCol.getBoundingClientRect();
            const rightRect = rightCol.getBoundingClientRect();
            return {
              hasThreeZones: kids.length === 3,
              orivenIsLeft: orivenRect.left < previewRect.left,
              previewIsCenter: previewRect.left < rightRect.left && previewRect.right > orivenRect.right,
              rightIsRight: rightRect.left > previewRect.left,
              orivenHasInput: !!orivenCol.querySelector('#lcOrivenInput'),
              previewHasAdCard: !!previewCol.querySelector('.lw-adp-card'),
              rightHasReadiness: !!rightCol.querySelector('#lcPreflightChecks'),
              rightHasLaunchBtn: !!rightCol.querySelector('#lcLaunchBtn'),
              identityIsAboveGrid: document.querySelector('.lw-identity').compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING,
            };
        });
        check('31. Workspace renders exactly three zones', zones.hasThreeZones, zones);
        check('32. LEFT zone is ORIVEN — sits left of the ad preview and contains the real input', zones.orivenIsLeft && zones.orivenHasInput, zones);
        check('33. CENTER zone is the ad preview — sits between ORIVEN and the settings panel and renders a real ad card', zones.previewIsCenter && zones.previewHasAdCard, zones);
        check('34. RIGHT zone contains the real readiness panel and the real launch action — the single source of deployment-relevant settings', zones.rightIsRight && zones.rightHasReadiness && zones.rightHasLaunchBtn, zones);
        check('35. Campaign identity sits as a compact header above the three zones, not a second competing giant title', !!zones.identityIsAboveGrid, zones);

        // Ad preview uses the REAL image and REAL copy fields — never a
        // small thumbnail-only row, never invented text.
        const preview = await page.evaluate(() => {
          const card = document.querySelector('.lw-adp-card.lw-adp-meta');
          return {
            hasRealImg: !!card?.querySelector('.lw-adp-img img'),
            headline: card?.querySelector('.lw-adp-m-hl2')?.textContent,
            body: card?.querySelector('.lw-adp-m-body')?.textContent,
            cta: card?.querySelector('.lw-adp-m-cta')?.textContent,
          };
        });
        check('36. Ad preview shows the actual creative image (not a small thumbnail placeholder)', preview.hasRealImg, preview);
        check('37. Ad preview shows the real headline/primary text/CTA fields from the actual campaign package', preview.headline === 'Real Headline' && /Real primary text/.test(preview.body || '') && preview.cta === 'Shop Now', preview);

        // ORIVEN operator actions this sprint adds: a real destination
        // SET (mirrors the existing budget-set write mechanism) and an
        // honest settings summary — never a fabricated action.
        async function ask(q) {
          await page.fill('#lcOrivenInput', q);
          await page.click('#lcOrivenAskBtn');
          await page.waitForTimeout(400);
          return page.evaluate(() => {
            const msgs = Array.from(document.querySelectorAll('#lcOrivenThread .lw-oriven-msg-oriven'));
            return msgs.length ? msgs[msgs.length - 1].textContent : null;
          });
        }
        const destSetAnswer = await ask('Change the destination to https://example.com/summer-sale');
        check('38. "Change the destination to X" is a real, genuinely-supported write — ORIVEN confirms honestly', /Done.*destination.*example\.com/i.test(destSetAnswer || ''), destSetAnswer);
        const persistedDest = await page.evaluate((id) => {
          const key = _orvCampaignsKey();
          const found = JSON.parse(localStorage.getItem(key) || '[]').find((c) => c.id === id);
          return found && found.pkg && found.pkg.strategy && found.pkg.strategy.landingPageUrl;
        }, camp.id);
        check('39. The destination-set request genuinely mutates the real campaign store (the same field _launchExtractFields reads), not a fake UI-only change', persistedDest === 'https://example.com/summer-sale', persistedDest);

        const settingsAnswer = await ask('Show me the settings');
        check('40. "Show me the settings" gives an honest, real summary of the actual current configuration — never a fabricated "opened settings" claim', /Destination:.*example\.com/i.test(settingsAnswer || '') && /Budget:/i.test(settingsAnswer || ''), settingsAnswer);

        check('JS errors in three-zone workspace scenario', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 3h. WORKSPACE — multiple real creative variants render as real,
    //     distinct preview tiles (never fabricated from one image)
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camp = makeCampaign({
          name: 'Multi Creative Campaign',
          pkg: {
            concepts: [
              { angle: 'a', adCopy: { headline: 'Angle A Headline', primaryText: 'Angle A copy.' }, cta: 'Shop Now' },
              { angle: 'b', adCopy: { headline: 'Angle B Headline', primaryText: 'Angle B copy.' }, cta: 'Learn More' },
            ],
            visualConcepts: [
              { conceptRef: 'a', generatedImageUrl: 'https://picsum.photos/seed/multia/600/600' },
              { conceptRef: 'b', generatedImageUrl: 'https://picsum.photos/seed/multib/600/600' },
            ],
          },
        });
        await seedCampaigns(page, [camp]);
        await gotoLaunch(page);
        await page.evaluate((id) => { window._launchOpenControl(id); }, camp.id);
        await page.waitForTimeout(1500);
        const multi = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('.lw-adp-grid .lw-adp-card'));
          return {
            tileCount: cards.length,
            headlines: cards.map((c) => c.querySelector('.lw-adp-m-hl2')?.textContent),
          };
        });
        check('41. Multiple real generated creative variants render as real, distinct preview tiles (not fabricated from a single image)', multi.tileCount === 2, multi);
        check('41b. Each real tile shows its own real per-concept copy, correctly matched by conceptRef', multi.headlines.includes('Angle A Headline') && multi.headlines.includes('Angle B Headline'), multi.headlines);
        check('JS errors in multi-creative scenario', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 4. WARNING state — missing destination + budget
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camp = makeCampaign({
          name: 'Warning Campaign',
          pkg: { strategy: { goal: 'Sales' }, metaAds: { headline: 'x', primaryText: 'y' } },
        });
        await seedCampaigns(page, [camp]);
        await gotoLaunch(page);
        await page.click('#lqPlatformPills .lq-pill-plat-meta'); // this campaign is on Meta, not the Google default
        await page.waitForTimeout(150);
        // The launch-queue list's readiness pill is a real, synchronous
        // (no network call) estimate from the same campaign-completeness
        // checks — verified honest here before even opening the workspace.
        const listPill = await page.evaluate(() => document.querySelector('#launchGrid .lq-row .lq-readiness')?.textContent);
        check('4a. Launch queue list shows an honest "READY WITH WARNINGS" pill for this incomplete campaign, computed without a network call', listPill === 'READY WITH WARNINGS', listPill);

        await page.evaluate((id) => { window._launchOpenControl(id); }, camp.id);
        await page.waitForTimeout(1500);
        const st = await page.evaluate(() => ({
          state: document.querySelector('#lcLaunchState .lw-launch-state-label')?.textContent,
          stateClass: document.querySelector('#lcLaunchState .lw-launch-state-label')?.className,
          stateSub: document.querySelector('#lcLaunchState .lw-launch-state-sub')?.textContent,
          launchBtnDisabled: document.getElementById('lcLaunchBtn').disabled,
        }));
        check('4. Missing destination/budget (but has creative + connection) reads READY WITH WARNINGS, not blocked', st.state === 'READY WITH WARNINGS' && /lw-launch-state-warning/.test(st.stateClass), st.state);
        check('4b. The launch bar shows a real issue COUNT, not a second full listing of every warning (spec: never duplicate the readiness list)', /\d+ items? worth reviewing/.test(st.stateSub || ''), st.stateSub);
        check('4d. A warning-only campaign can still be launched (button not disabled)', !st.launchBtnDisabled, st.launchBtnDisabled);

        // The warnings' real reasons live in the readiness list's
        // click-to-expand detail — verify at least one is genuinely there.
        const destIdx = await page.evaluate(() => Array.from(document.querySelectorAll('.lw-check')).findIndex((c) => /Destination/i.test(c.querySelector('.lw-check-label')?.textContent || '')));
        await page.click('.lw-check >> nth=' + destIdx);
        await page.waitForTimeout(200);
        const destDetail = await page.evaluate(() => document.querySelector('.lw-check-detail-reason')?.textContent);
        check('4c. The Destination warning\'s real reason is available one click away, in the readiness list itself', /destination/i.test(destDetail || ''), destDetail);
        check('JS errors in WARNING scenario', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 5. BLOCKED state — missing creative
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camp = makeCampaign({ name: 'No Creative Campaign', pkg: { visualConcepts: [] } });
        await seedCampaigns(page, [camp]);
        await gotoLaunch(page);
        await page.evaluate((id) => { window._launchOpenControl(id); }, camp.id);
        await page.waitForTimeout(1500);
        const st = await page.evaluate(() => ({
          state: document.querySelector('#lcLaunchState .lw-launch-state-label')?.textContent,
          stateClass: document.querySelector('#lcLaunchState .lw-launch-state-label')?.className,
          launchBtnDisabled: document.getElementById('lcLaunchBtn').disabled,
          launchBtnText: document.getElementById('lcLaunchBtn').textContent,
          creativeMissing: document.querySelector('.lc-creative-missing')?.textContent,
          hasFixInCreateLink: !!document.querySelector('.lc-creative-missing .lc-inline-link'),
        }));
        check('5. Missing creative asset reads BLOCKED', st.state === 'BLOCKED' && /lw-launch-state-blocked/.test(st.stateClass), st.state);
        check('5b. Launch button is disabled and explains why', st.launchBtnDisabled && st.launchBtnText === 'Resolve issues to launch', st);
        check('5c. Creative preview honestly shows "No creative image found" (never a placeholder image)', /No creative image found/.test(st.creativeMissing || ''), st.creativeMissing);
        check('5d. Missing-creative issue deep-links to Create rather than building a duplicate editor', st.hasFixInCreateLink, st.hasFixInCreateLink);

        // Defense-in-depth: even a direct call to the deploy function must
        // not bypass a BLOCKED state — no real publish request may fire.
        const publishCalls = [];
        page.on('request', (req) => { if (req.url().includes('/api/publish/')) publishCalls.push(req.url()); });
        await page.evaluate(() => { window._launchDeploy(); });
        await page.waitForTimeout(800);
        check('6. Backend gate: calling _launchDeploy() directly while BLOCKED never fires a real publish request (frontend cannot bypass the gate)', publishCalls.length === 0, publishCalls);
        check('JS errors in BLOCKED (creative) scenario', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 6. BLOCKED state — platform not connected
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userNoConn);
      try {
        const camp = makeCampaign({ name: 'Not Connected Campaign' });
        await seedCampaigns(page, [camp]);
        await gotoLaunch(page);
        await page.evaluate((id) => { window._launchOpenControl(id); }, camp.id);
        await page.waitForTimeout(1500);
        const st = await page.evaluate(() => ({
          state: document.querySelector('#lcLaunchState .lw-launch-state-label')?.textContent,
          platformCard: document.getElementById('lcPlatformCard').textContent,
          hasConnectBtn: !!document.querySelector('.lc-platform-connect-btn'),
          connectBtnOnclick: document.querySelector('.lc-platform-connect-btn')?.getAttribute('onclick'),
        }));
        check('7. Unconnected platform reads BLOCKED', st.state === 'BLOCKED', st.state);
        check('7b. Platform card shows a specific, actionable "Not connected" state naming the platform', /Not connected/i.test(st.platformCard) && /Meta/i.test(st.platformCard), st.platformCard);
        check('7c. A real "Connect" action reuses the existing Connections flow (bizGoTo), not a second connection system', st.hasConnectBtn && /bizGoTo\('connections'\)/.test(st.connectBtnOnclick || ''), st.connectBtnOnclick);
        check('JS errors in BLOCKED (connection) scenario', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 7. Successful deployment (mocked network layer — no real spend)
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camp = makeCampaign({ name: 'Deploy Success Campaign' });
        await seedCampaigns(page, [camp]);
        await gotoLaunch(page);
        await page.evaluate((id) => { window._launchOpenControl(id); }, camp.id);
        await page.waitForTimeout(1500);

        await page.evaluate(() => {
          const real = window.apiFetch;
          window.apiFetch = async function (path, options) {
            if (path.indexOf('/api/publish/') === 0) {
              return { ok: true, status: 200, data: { ok: true, campaignId: '120210000000001', platform: 'meta', status: 'paused' } };
            }
            return real(path, options);
          };
        });
        await page.click('#lcLaunchBtn');
        await page.waitForTimeout(900);
        const success = await page.evaluate(() => ({
          overlayVisible: document.getElementById('lcDeployOverlay').style.display !== 'none',
          title: document.querySelector('.lc-result-title')?.textContent,
          fieldsText: document.querySelector('.lc-result-fields')?.textContent,
          hasFakeMetric: /ROAS|impressions|reach|clicks|revenue/i.test(document.querySelector('.lc-result')?.textContent || ''),
        }));
        check('8. Successful deployment shows accurate status language — "Campaign Deployed" (not a fabricated "Live") since the mocked provider status is "paused"', success.overlayVisible && success.title === 'Campaign Deployed', success.title);
        check('8b. Success fields show only real returned data (deployment ID, paused status) — no fabricated metrics', /120210000000001/.test(success.fieldsText) && /paused/.test(success.fieldsText) && !success.hasFakeMetric, success.fieldsText);

        const campStatus = await page.evaluate((id) => {
          const key = _orvCampaignsKey();
          const camps = JSON.parse(localStorage.getItem(key) || '[]');
          return (camps.find((c) => c.id === id) || {}).status;
        }, camp.id);
        check('8c. Campaign status updates to published in the real client-side store after a genuine success', campStatus === 'published', campStatus);
        check('JS errors in success scenario', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 8. Honest failure — retry-safe vs lock-conflict
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camp = makeCampaign({ name: 'Deploy Failure Campaign' });
        await seedCampaigns(page, [camp]);
        await gotoLaunch(page);
        await page.evaluate((id) => { window._launchOpenControl(id); }, camp.id);
        await page.waitForTimeout(1500);

        await page.evaluate(() => {
          const real = window.apiFetch;
          window.apiFetch = async function (path, options) {
            if (path.indexOf('/api/publish/') === 0) {
              return { ok: false, status: 400, data: { ok: false, error: 'Please connect a Facebook Page before publishing to Meta Ads.' } };
            }
            return real(path, options);
          };
        });
        await page.click('#lcLaunchBtn');
        await page.waitForTimeout(900);
        const fail = await page.evaluate(() => ({
          title: document.querySelector('.lc-result-title')?.textContent,
          message: document.querySelector('.lc-result-message')?.textContent,
          hasRetry: Array.from(document.querySelectorAll('.lc-result-btn')).some((b) => b.textContent === 'Retry'),
        }));
        check('9. Genuine deployment failure shows the real provider error honestly, never a fabricated success', fail.title === 'Launch Interrupted' && /Facebook Page/.test(fail.message), fail);
        check('9b. A genuine (non-lock) failure offers a Retry action', fail.hasRetry, fail.hasRetry);

        // Lock-conflict variant: never offers Retry (retrying a request
        // that's already in flight server-side would just double it).
        await page.evaluate(() => { document.getElementById('lcDeployOverlay').style.display = 'none'; });
        await page.evaluate(() => {
          const real = window.apiFetch;
          window.apiFetch = async function (path, options) {
            if (path.indexOf('/api/publish/') === 0) {
              return { ok: false, status: 409, data: { ok: false, error: 'This campaign is already being published — please wait for it to finish.', code: 'PUBLISH_IN_PROGRESS' } };
            }
            return real(path, options);
          };
        });
        await page.click('#lcLaunchBtn');
        await page.waitForTimeout(900);
        const lockFail = await page.evaluate(() => ({
          message: document.querySelector('.lc-result-message')?.textContent,
          hasRetry: Array.from(document.querySelectorAll('.lc-result-btn')).some((b) => b.textContent === 'Retry'),
        }));
        check('10. A lock-conflict (409 PUBLISH_IN_PROGRESS) is shown honestly and does NOT offer an unsafe Retry', /already being published/.test(lockFail.message) && !lockFail.hasRetry, lockFail);
        check('JS errors in failure scenarios', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 9. Client-side double-submission guard
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camp = makeCampaign({ name: 'Double Submit Campaign' });
        await seedCampaigns(page, [camp]);
        await gotoLaunch(page);
        await page.evaluate((id) => { window._launchOpenControl(id); }, camp.id);
        await page.waitForTimeout(1500);

        const callCount = await page.evaluate(async () => {
          let calls = 0;
          const real = window.apiFetch;
          window.apiFetch = async function (path, options) {
            if (path.indexOf('/api/publish/') === 0) {
              calls++;
              await new Promise((r) => setTimeout(r, 500));
              return { ok: true, status: 200, data: { ok: true, campaignId: 'x', platform: 'meta', status: 'paused' } };
            }
            return real(path, options);
          };
          window._launchDeploy();
          window._launchDeploy();
          window._launchDeploy();
          await new Promise((r) => setTimeout(r, 900));
          return calls;
        });
        check('11. Calling launch multiple times in quick succession fires exactly one real publish request (client-side re-entrancy guard)', callCount === 1, callCount);
        check('JS errors in double-submit scenario', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 10. ORIVEN interaction — real, honest operator interface
    //     (no fake AI: every response is derived from real, already-
    //     known readiness/campaign data — see _launchOrivenAsk)
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camp = makeCampaign({
          name: 'Oriven Interaction Campaign',
          pkg: { strategy: { goal: 'Sales', landingPageUrl: '' }, metaAds: { headline: 'H', primaryText: 'T', budget: null } },
        });
        await seedCampaigns(page, [camp]);
        await gotoLaunch(page);
        await page.evaluate((id) => { window._launchOpenControl(id); }, camp.id);
        await page.waitForTimeout(1500);

        async function ask(q) {
          await page.fill('#lcOrivenInput', q);
          await page.click('#lcOrivenAskBtn');
          await page.waitForTimeout(400);
          return page.evaluate(() => {
            const msgs = Array.from(document.querySelectorAll('#lcOrivenThread .lw-oriven-msg-oriven'));
            return msgs.length ? msgs[msgs.length - 1].textContent : null;
          });
        }

        const whyAnswer = await ask("Why can't I launch this?");
        check('14. Asking "Why can\'t I launch this?" surfaces the real, current blockers/warnings — not a canned generic answer', /Destination|Budget|budget|destination/i.test(whyAnswer || ''), whyAnswer);

        const readyAnswer = await ask('Is everything ready?');
        check('14b. Asking "Is everything ready?" reflects the real aggregated readiness state', /READY WITH WARNINGS|BLOCKED|READY TO LAUNCH/i.test(readyAnswer || ''), readyAnswer);

        const destAnswer = await ask('Check the destination');
        check('14c. Asking about the destination reflects the real (missing) destination honestly', /No destination URL/i.test(destAnswer || ''), destAnswer);

        const budgetAnswer = await ask('Set the budget to €40/day');
        check('14d. A real, supported budget-set request gets a real confirmation', /Done.*40/i.test(budgetAnswer || ''), budgetAnswer);

        const persistedBudget = await page.evaluate((id) => {
          const key = _orvCampaignsKey();
          const camps = JSON.parse(localStorage.getItem(key) || '[]');
          const found = camps.find((c) => c.id === id);
          return found && found.pkg && found.pkg.metaAds && found.pkg.metaAds.budget;
        }, camp.id);
        check('14e. The budget-set request genuinely mutates the real campaign store (not a fake UI-only change)', persistedBudget === 40, persistedBudget);

        const readinessAfter = await page.evaluate(() => document.querySelector('#lcLaunchState .lw-launch-state-sub')?.textContent);
        check('14f. Readiness panel actually re-renders after a real supported change (budget warning should have cleared)', !/worth reviewing/.test(readinessAfter || '') || /1 item/.test(readinessAfter || ''), readinessAfter);

        const fallbackAnswer = await ask('Launch this to Instagram Reels only with a 50% higher bid');
        check('14g. An unsupported request gets an honest fallback, never a fabricated action', /isn'?t available from Launch yet/i.test(fallbackAnswer || ''), fallbackAnswer);

        check('JS errors during ORIVEN interaction', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 11. Provider awareness — Meta-only fields never leak to other platforms
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camp = makeCampaign({
          name: 'Google Search Campaign', platform: 'google',
          pkg: { googleAds: { headline: 'G', budget: 20 } },
        });
        await seedCampaigns(page, [camp]);
        await gotoLaunch(page);
        await page.evaluate((id) => { window._launchOpenControl(id); }, camp.id);
        await page.waitForTimeout(1500);
        const text = await page.evaluate(() => (document.getElementById('lcPreflightChecks')?.textContent || '') + ' ' + (document.getElementById('lcPlatformCard')?.textContent || ''));
        check('15. A non-Meta platform (Google) never shows the Meta-only "Facebook Page" check', !/Facebook Page/i.test(text), text);
        check('JS errors during provider-awareness check', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 12. Mobile responsive + accessibility basics
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady, { width: 390, height: 844 });
      try {
        const camp = makeCampaign({ name: 'Mobile Campaign' });
        await seedCampaigns(page, [camp]);
        await gotoLaunch(page);
        await page.evaluate((id) => { window._launchOpenControl(id); }, camp.id);
        await page.waitForTimeout(1500);
        const mobile = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          launchBtnVisible: (() => { const r = document.getElementById('lcLaunchBtn').getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
          checksHaveTextLabels: Array.from(document.querySelectorAll('.lw-check-status')).every((el) => el.textContent.trim().length > 0),
          checksHaveListItemRole: document.querySelectorAll('.lw-check[role="listitem"]').length > 0,
        }));
        check('12. [mobile 390px] No horizontal overflow on Launch Control', !mobile.overflow, mobile.overflow);
        check('12b. [mobile] Launch button remains reachable/visible', mobile.launchBtnVisible, mobile.launchBtnVisible);
        check('13. Accessibility: every check status is conveyed by real text, never color alone', mobile.checksHaveTextLabels, mobile.checksHaveTextLabels);
        check('13b. Accessibility: preflight checks expose a real list semantic (role="listitem")', mobile.checksHaveListItemRole, mobile.checksHaveListItemRole);
        check('JS errors on mobile', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }
  } finally {
    if (userReady) await deleteTestUser(userReady.userId);
    if (userNoConn) await deleteTestUser(userNoConn.userId);
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
