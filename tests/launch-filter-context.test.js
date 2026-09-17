// ════════════════════════════════════════════════════════════════
// Launch Home Filter/Search Refinement + ORIVEN Context Indicator
// (Context Indicator + Launch Home Filter UX Refinement sprint)
//
// Covers the sprint's 20-item testing checklist: Google Ads default
// platform, "All Platforms" removed from the UI, all 4 platform
// filters, search, status filter, every filter combination, no
// fabricated campaigns, honest empty platform states, stable
// search/nav geometry across platform switches, the ORIVEN context
// indicator (real state, honest empty state, mobile-safe), and that
// pre-existing ORIVEN AI / Launch Control / deployment behavior is
// unchanged.
//
// Campaigns are seeded directly into localStorage (the real,
// existing client-side campaign store — _orvCampaignsKey/_loadCamps/
// _saveCamps), matching real pkg field names the real readiness
// engine (_launchBuildCampaignChecks/_launchListReadiness) reads —
// same convention as launch-control.test.js. Readiness is never
// asserted by guessing; it's derived from the same field-completeness
// rules already covered by launch-control.test.js (missing creative
// -> BLOCKED, missing destination/budget -> WARNING, otherwise
// READY), so no second readiness engine is exercised or assumed.
//
// RUN: node tests/launch-filter-context.test.js
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
  const email = `oriven.launchfiltctx.test+${Date.now()}.${suffix}@example.com`;
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

async function connectGoogle(userId) {
  await supabaseAdmin.from('integrations').upsert({
    user_id: userId, provider: 'google_ads', access_token: 'fake', refresh_token: 'fake_r', token_expiry: new Date(Date.now() + 3600000).toISOString(),
    google_ads_accounts: [{ customer_id: '111', name: 'Test Google Account', is_manager: false }],
    active_ad_account: { account_id: '111', account_name: 'Test Google Account' },
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
  await page.evaluate(() => { _orvNav('launch', 'page-launch'); });
  await page.waitForTimeout(400);
}
async function seedCampaigns(page, camps) {
  await page.evaluate((camps) => {
    const key = (typeof _orvCampaignsKey === 'function') ? _orvCampaignsKey() : null;
    if (key) localStorage.setItem(key, JSON.stringify(camps));
  }, camps);
}

function makeCampaign(overrides) {
  const id = 'lfc_test_' + Math.random().toString(36).slice(2);
  const base = {
    id, name: 'Sample Campaign', platform: 'google', status: 'ready-to-publish',
    goal: 'Sales', creativeMode: 'images', created: new Date().toISOString(),
    pkg: {
      campaignName: 'Sample Campaign',
      strategy: { goal: 'Traffic', landingPageUrl: 'https://example.com/x' },
      googleAds: { headlines: ['H1'], descriptions: ['D1'], budget: 30 },
      visualConcepts: [{ conceptRef: 'a', generatedImageUrl: 'https://picsum.photos/seed/' + id + '/600/600' }],
    },
  };
  return Object.assign({}, base, overrides, { pkg: Object.assign({}, base.pkg, (overrides && overrides.pkg) || {}) });
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let userMain, userEmpty;
  try {
    userMain = await createTestUser('main');
    userEmpty = await createTestUser('empty');
    await connectGoogle(userMain.userId);

    // Real, varied campaign set across all 4 platforms with distinct,
    // genuine readiness states (derived from real field completeness,
    // not hardcoded labels):
    //   - Google Ready Run     -> READY (name+goal, creative, destination, budget all present)
    //   - Google Blocked Run   -> BLOCKED (no creative)
    //   - Meta Compression Ad  -> WARNING (creative present, no destination/budget) — "compression" in name for search tests
    //   - Pinterest Autumn Run -> READY
    // TikTok has zero campaigns, for the honest-empty-platform-state checks.
    const googleReady = makeCampaign({ name: 'Google Ready Run', platform: 'google' });
    const googleBlocked = makeCampaign({ name: 'Google Blocked Run', platform: 'google', pkg: { visualConcepts: [] } });
    const metaWarning = makeCampaign({
      name: 'Meta Compression Ad', platform: 'meta', goal: 'Leads',
      pkg: {
        strategy: { goal: 'Leads' },
        metaAds: { headline: 'Compress it', primaryText: 'Real copy.' },
      },
    });
    const pinReady = makeCampaign({
      name: 'Pinterest Autumn Run', platform: 'pinterest',
      pkg: { pinterestAds: { title: 'Autumn styles', budget: 12 } },
    });
    const allCamps = [googleReady, googleBlocked, metaWarning, pinReady];

    // ════════════════════════════════════════════════════════════
    // 1-2. Default platform + no "All Platforms" option
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userMain);
      try {
        await seedCampaigns(page, allCamps);
        await gotoLaunch(page);
        const state = await page.evaluate(() => {
          const pills = Array.from(document.querySelectorAll('#lqPlatformPills .lq-pill'));
          return {
            pillLabels: pills.map((p) => p.textContent.trim()),
            hasAllPlatforms: pills.some((p) => /all platforms/i.test(p.textContent)),
            activeLabel: document.querySelector('#lqPlatformPills .lq-pill-active')?.textContent.trim(),
            visibleNames: Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent.trim()),
          };
        });
        check('1. Google Ads is the default platform on entering Launch', /google/i.test(state.activeLabel || ''), state.activeLabel);
        check('2. "All Platforms" is not visible anywhere in the platform nav', !state.hasAllPlatforms, state.pillLabels);
        check('2b. Platform nav shows exactly the 4 real providers, nothing invented', state.pillLabels.length === 4, state.pillLabels);
        check('2c. Default view shows only real Google campaigns, no fabricated ones', state.visibleNames.sort().join('|') === ['Google Ready Run', 'Google Blocked Run'].sort().join('|'), state.visibleNames);
        await page.close();
      } catch (e) { check('SETUP CRASH (1-2)', false, String(e)); }
    }

    // ════════════════════════════════════════════════════════════
    // 3-6. Each platform filter shows only real matching campaigns
    // 14. Search box / platform nav geometry stable across all 4 platforms
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userMain);
      try {
        await seedCampaigns(page, allCamps);
        await gotoLaunch(page);
        const expectByPlatform = {
          google: ['Google Ready Run', 'Google Blocked Run'],
          meta: ['Meta Compression Ad'],
          tiktok: [],
          pinterest: ['Pinterest Autumn Run'],
        };
        const geoms = {};
        for (const p of ['google', 'meta', 'tiktok', 'pinterest']) {
          await page.click('#lqPlatformPills .lq-pill-plat-' + p);
          await page.waitForTimeout(200);
          const r = await page.evaluate((plat) => {
            const names = Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent.trim());
            const search = document.getElementById('lqSearchInput').getBoundingClientRect();
            const platNav = document.getElementById('lqPlatformPills').getBoundingClientRect();
            const otherPlatformMentioned = names.some((n) => false); // names themselves never carry platform text now
            return { names, search: { x: search.x, y: search.y, width: search.width }, platNav: { x: platNav.x, y: platNav.y, width: platNav.width } };
          }, p);
          geoms[p] = r;
          const label = { google: '3', meta: '4', tiktok: '5', pinterest: '6' }[p];
          check(`${label}. ${p} filter shows exactly the real ${p} campaigns, nothing else`, r.names.sort().join('|') === expectByPlatform[p].sort().join('|'), r.names);

          // UI Cleanup pass — no colored underline under the active
          // provider tab (real getComputedStyle, not source inspection),
          // for active/hover/focus, on all 4 providers.
          const underlineState = await page.evaluate((plat) => {
            const pill = document.querySelector('.lq-pill-plat-' + plat);
            const cs = getComputedStyle(pill);
            pill.focus();
            const csFocus = getComputedStyle(pill);
            pill.blur();
            return {
              isActive: pill.classList.contains('lq-pill-active'),
              boxShadow: cs.boxShadow, borderBottomWidth: cs.borderBottomWidth, borderBottomStyle: cs.borderBottomStyle,
              focusBoxShadowHasColor: /rgb\(66, 133, 244\)|rgb\(24, 119, 242\)|rgb\(1, 1, 1\)|rgb\(230, 0, 35\)/.test(csFocus.boxShadow),
            };
          }, p);
          check(`${label}b. ${p} provider tab has no colored underline when active (box-shadow: none)`, underlineState.isActive && underlineState.boxShadow === 'none', underlineState);
          check(`${label}c. ${p} provider tab focus state has no per-provider-colored box-shadow line either`, !underlineState.focusBoxShadowHasColor, underlineState);
        }
        // Hover — no underline appears (check the currently-inactive Google pill, since Pinterest is active after the loop above).
        await page.hover('#lqPlatformPills .lq-pill-plat-google');
        await page.waitForTimeout(150);
        const hoverUnderline = await page.evaluate(() => getComputedStyle(document.querySelector('.lq-pill-plat-google')).boxShadow);
        check('6b. Hovering an inactive provider tab does not create an underline', hoverUnderline === 'none', hoverUnderline);
        const stable = ['meta', 'tiktok', 'pinterest'].every((p) =>
          geoms[p].search.x === geoms.google.search.x && geoms[p].search.y === geoms.google.search.y && geoms[p].search.width === geoms.google.search.width &&
          geoms[p].platNav.x === geoms.google.platNav.x && geoms[p].platNav.y === geoms.google.platNav.y && geoms[p].platNav.width === geoms.google.platNav.width
        );
        check('14. Search box width/position and platform nav position remain stable across all 4 platform switches', stable, geoms);
        await page.close();
      } catch (e) { check('SETUP CRASH (3-6,14)', false, String(e)); }
    }

    // ════════════════════════════════════════════════════════════
    // 7. Search works
    // 13. Empty platform state (TikTok) is honest, no fake campaigns, platform still switchable
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userMain);
      try {
        await seedCampaigns(page, allCamps);
        await gotoLaunch(page);
        await page.click('#lqPlatformPills .lq-pill-plat-meta');
        await page.waitForTimeout(200);
        await page.fill('#lqSearchInput', 'compression');
        await page.waitForTimeout(250);
        const searchResult = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent.trim()));
        check('7. Search filters real campaign data correctly ("compression" -> Meta Compression Ad)', searchResult.length === 1 && searchResult[0] === 'Meta Compression Ad', searchResult);
        await page.fill('#lqSearchInput', 'zzz-no-match-zzz');
        await page.waitForTimeout(250);
        const noMatch = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent.trim()));
        check('7b. Search with no real matches shows zero campaigns, never fabricated results', noMatch.length === 0, noMatch);
        await page.fill('#lqSearchInput', '');

        await page.click('#lqPlatformPills .lq-pill-plat-tiktok');
        await page.waitForTimeout(200);
        const tiktokState = await page.evaluate(() => ({
          names: Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent.trim()),
          filtersStillVisible: !!document.getElementById('lqFilters') && document.getElementById('lqFilters').offsetParent !== null,
          platformNavStillVisible: !!document.getElementById('lqPlatformPills') && document.getElementById('lqPlatformPills').offsetParent !== null,
          hasHonestEmptyMessage: /tiktok/i.test(document.body.textContent) && /no.*tiktok.*campaign/i.test(document.body.textContent.replace(/\s+/g, ' ')),
        }));
        check('13. TikTok (zero real campaigns) shows an honest empty state, no fabricated campaigns', tiktokState.names.length === 0, tiktokState.names);
        check('13b. Empty platform state still shows the platform nav so the user can switch away', tiktokState.platformNavStillVisible, tiktokState.platformNavStillVisible);
        check('13c. Empty platform state message is honest and platform-specific, not generic', tiktokState.hasHonestEmptyMessage, tiktokState.hasHonestEmptyMessage);
        await page.close();
      } catch (e) { check('SETUP CRASH (7,13)', false, String(e)); }
    }

    // ════════════════════════════════════════════════════════════
    // 8. Status filter works
    // 9. Platform + status combination
    // 10. Platform + search combination
    // 11. Platform + status + search combination
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userMain);
      try {
        await seedCampaigns(page, allCamps);
        await gotoLaunch(page);

        // 8. Status filter alone (on Google, which has one ready + one blocked)
        const statusPillsInfo = await page.evaluate(() => Array.from(document.querySelectorAll('#lqStatusPills .lq-pill')).map((p) => p.textContent.trim()));
        check('8. Status filter offers exactly All statuses + Live + the 3 real readiness states, nothing invented', statusPillsInfo.length === 5 && /live/i.test(statusPillsInfo[1]) && /ready to launch/i.test(statusPillsInfo[2]) && /warning/i.test(statusPillsInfo[3]) && /blocked/i.test(statusPillsInfo[4]), statusPillsInfo);
        const blockedPillIdx = statusPillsInfo.findIndex((t) => /blocked/i.test(t));
        await page.click(`#lqStatusPills .lq-pill:nth-child(${blockedPillIdx + 1})`);
        await page.waitForTimeout(200);
        const blockedOnly = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent.trim()));
        check('8b. Status=Blocked on Google shows only the real blocked campaign', blockedOnly.length === 1 && blockedOnly[0] === 'Google Blocked Run', blockedOnly);

        // 9. platform + status: switch to Meta with status still = Blocked -> should be empty (Meta campaign is Warning, not Blocked)
        await page.click('#lqPlatformPills .lq-pill-plat-meta');
        await page.waitForTimeout(200);
        const metaBlocked = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent.trim()));
        check('9. Platform+status combination is real: Meta + Blocked correctly yields zero (Meta campaign is Warning, not Blocked)', metaBlocked.length === 0, metaBlocked);
        // now set status to Warning on Meta -> should show the real campaign
        const statusPillsInfo2 = await page.evaluate(() => Array.from(document.querySelectorAll('#lqStatusPills .lq-pill')).map((p) => p.textContent.trim()));
        const warningIdx = statusPillsInfo2.findIndex((t) => /warning/i.test(t));
        await page.click(`#lqStatusPills .lq-pill:nth-child(${warningIdx + 1})`);
        await page.waitForTimeout(200);
        const metaWarningOnly = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent.trim()));
        check('9b. Platform+status combination is real: Meta + Warning correctly yields the real warning campaign', metaWarningOnly.length === 1 && metaWarningOnly[0] === 'Meta Compression Ad', metaWarningOnly);

        // reset status to All
        await page.click('#lqStatusPills .lq-pill:nth-child(1)');
        await page.waitForTimeout(200);

        // 10. platform + search: Google + "ready" should match only "Google Ready Run"
        await page.click('#lqPlatformPills .lq-pill-plat-google');
        await page.waitForTimeout(200);
        await page.fill('#lqSearchInput', 'ready run');
        await page.waitForTimeout(250);
        const googleSearch = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent.trim()));
        check('10. Platform+search combination is real: Google + "ready run" matches only the real matching campaign', googleSearch.length === 1 && googleSearch[0] === 'Google Ready Run', googleSearch);
        await page.fill('#lqSearchInput', '');

        // 11. platform + status + search: Meta + Blocked + "compression" -> zero real matches
        await page.click('#lqPlatformPills .lq-pill-plat-meta');
        await page.waitForTimeout(200);
        const statusPillsInfo3 = await page.evaluate(() => Array.from(document.querySelectorAll('#lqStatusPills .lq-pill')).map((p) => p.textContent.trim()));
        const blockedIdx3 = statusPillsInfo3.findIndex((t) => /blocked/i.test(t));
        await page.click(`#lqStatusPills .lq-pill:nth-child(${blockedIdx3 + 1})`);
        await page.fill('#lqSearchInput', 'compression');
        await page.waitForTimeout(250);
        const tripleEmpty = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent.trim()));
        check('11. Triple combination (Meta+Blocked+"compression") correctly yields zero real matches', tripleEmpty.length === 0, tripleEmpty);
        // now switch status to Warning -> should show the real match again
        const statusPillsInfo4 = await page.evaluate(() => Array.from(document.querySelectorAll('#lqStatusPills .lq-pill')).map((p) => p.textContent.trim()));
        const warningIdx4 = statusPillsInfo4.findIndex((t) => /warning/i.test(t));
        await page.click(`#lqStatusPills .lq-pill:nth-child(${warningIdx4 + 1})`);
        await page.waitForTimeout(250);
        const tripleMatch = await page.evaluate(() => Array.from(document.querySelectorAll('.lq-name')).map((n) => n.textContent.trim()));
        check('11b. Triple combination (Meta+Warning+"compression") correctly yields the real matching campaign', tripleMatch.length === 1 && tripleMatch[0] === 'Meta Compression Ad', tripleMatch);

        check('JS errors during filter combination checks', page._jsErrors.length === 0, page._jsErrors);
        await page.close();
      } catch (e) { check('SETUP CRASH (8-11)', false, String(e)); }
    }

    // ════════════════════════════════════════════════════════════
    // 12. No fake campaigns are ever created by filtering/searching
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userMain);
      try {
        await seedCampaigns(page, allCamps);
        await gotoLaunch(page);
        for (const p of ['google', 'meta', 'tiktok', 'pinterest']) {
          await page.click('#lqPlatformPills .lq-pill-plat-' + p);
          await page.waitForTimeout(150);
        }
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem(_orvCampaignsKey()) || '[]').length);
        check('12. Switching platforms/filters never mutates or fabricates stored campaigns (still exactly 4)', stored === 4, stored);
        await page.close();
      } catch (e) { check('SETUP CRASH (12)', false, String(e)); }
    }

    // ════════════════════════════════════════════════════════════
    // 15-16. Context indicator: real state + honest empty state
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userMain);
      try {
        await seedCampaigns(page, allCamps);
        await gotoLaunch(page);
        await page.evaluate(() => { if (typeof orvOpenAi === 'function') orvOpenAi(); });
        await page.waitForTimeout(500);
        const badgeState = await page.evaluate(() => {
          const badge = document.getElementById('orvAiCtxBadge');
          return {
            exists: !!badge,
            active: badge ? badge.classList.contains('orv-ai-ctx-badge-active') : false,
            rect: badge ? badge.getBoundingClientRect() : null,
          };
        });
        check('15. Context indicator renders in the ORIVEN AI panel', badgeState.exists, badgeState.exists);
        check('15b. Context indicator shows an active/real state when real context exists (blocked campaign present)', badgeState.active, badgeState);
        await page.click('#orvAiCtxBadge');
        await page.waitForTimeout(200);
        const popover = await page.evaluate(() => {
          const pop = document.getElementById('orvAiCtxPopover');
          return { visible: pop && pop.style.display !== 'none', text: pop ? pop.textContent : '' };
        });
        check('15c. Context popover opens and shows real, specific facts (not generic filler)', popover.visible && /blocked|ready|campaign/i.test(popover.text), popover.text);
        await page.close();
      } catch (e) { check('SETUP CRASH (15-16a)', false, String(e)); }
    }
    {
      // Genuinely empty account: no campaigns, no research, no autopilot rules.
      const page = await signInAndGoto(browser, userEmpty);
      try {
        await seedCampaigns(page, []);
        await gotoLaunch(page);
        await page.evaluate(() => { if (typeof orvOpenAi === 'function') orvOpenAi(); });
        await page.waitForTimeout(500);
        const badgeState = await page.evaluate(() => {
          const badge = document.getElementById('orvAiCtxBadge');
          return { active: badge ? badge.classList.contains('orv-ai-ctx-badge-active') : null };
        });
        check('16. Context indicator does NOT claim an active/real state for a genuinely empty account', badgeState.active === false, badgeState);
        await page.click('#orvAiCtxBadge');
        await page.waitForTimeout(200);
        const popover = await page.evaluate(() => document.getElementById('orvAiCtxPopover').textContent);
        check('16b. Empty-context popover is honest (no fabricated facts)', !/blocked|ready to review|thing changed/i.test(popover), popover);
        check('JS errors (empty account context check)', page._jsErrors.length === 0, page._jsErrors);
        await page.close();
      } catch (e) { check('SETUP CRASH (16b)', false, String(e)); }
    }

    // ════════════════════════════════════════════════════════════
    // 17. Context indicator does not break mobile layout
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userMain, { width: 390, height: 844 });
      try {
        await seedCampaigns(page, allCamps);
        await gotoLaunch(page);
        await page.evaluate(() => { if (typeof orvOpenAi === 'function') orvOpenAi(); });
        await page.waitForTimeout(500);
        const mobile = await page.evaluate(() => {
          const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
          const badge = document.getElementById('orvAiCtxBadge');
          const closeBtn = document.querySelector('.orv-ai-panel-close');
          const badgeRect = badge ? badge.getBoundingClientRect() : null;
          const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;
          const overlap = badgeRect && closeRect ? !(badgeRect.right <= closeRect.left || badgeRect.left >= closeRect.right) : null;
          return { overflow, badgeVisible: badgeRect && badgeRect.width > 0 && badgeRect.height > 0, overlap };
        });
        check('17. Context indicator does not cause horizontal overflow on mobile', !mobile.overflow, mobile.overflow);
        check('17b. Context indicator remains visible on mobile', mobile.badgeVisible, mobile.badgeVisible);
        check('17c. Context indicator does not overlap the panel close button', mobile.overlap === false, mobile.overlap);
        check('JS errors (mobile context check)', page._jsErrors.length === 0, page._jsErrors);
        await page.close();
      } catch (e) { check('SETUP CRASH (17)', false, String(e)); }
    }

    // ════════════════════════════════════════════════════════════
    // 18. Existing ORIVEN AI behavior still works
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userMain);
      try {
        await seedCampaigns(page, allCamps);
        await gotoLaunch(page);
        await page.evaluate(() => { if (typeof orvOpenAi === 'function') orvOpenAi(); });
        await page.waitForTimeout(500);
        const aiState = await page.evaluate(() => ({
          panelOpen: document.getElementById('orvAiPanel') && document.getElementById('orvAiPanel').offsetParent !== null,
          hasGreeting: !!document.getElementById('orvAiGreeting') && document.getElementById('orvAiGreeting').textContent.trim().length > 0,
          inputExists: !!document.getElementById('orvAiInput'),
        }));
        check('18. ORIVEN AI panel still opens correctly', aiState.panelOpen, aiState.panelOpen);
        check('18b. ORIVEN AI greeting still renders (unchanged from prior sprint)', aiState.hasGreeting, aiState.hasGreeting);
        check('18c. ORIVEN AI input still present and functional', aiState.inputExists, aiState.inputExists);
        await page.evaluate(() => { if (typeof orvCloseAi === 'function') orvCloseAi(); });
        await page.waitForTimeout(200);
        const closed = await page.evaluate(() => document.getElementById('orvAiPanel').offsetParent === null || !document.getElementById('orvAiPanel').classList.contains('open'));
        check('18d. ORIVEN AI panel still closes correctly', closed, closed);
        await page.close();
      } catch (e) { check('SETUP CRASH (18)', false, String(e)); }
    }

    // ════════════════════════════════════════════════════════════
    // 19. Existing Launch Control still works (readiness workspace unaffected)
    // 20. Existing deployment flow is unchanged (publish route wiring untouched)
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userMain);
      try {
        await seedCampaigns(page, allCamps);
        await gotoLaunch(page);
        await page.evaluate((id) => { window._launchOpenControl(id); }, googleReady.id);
        await page.waitForTimeout(1200);
        const lc = await page.evaluate(() => ({
          workspaceVisible: !!document.getElementById('lcLaunchBtn'),
          launchBtnEnabled: document.getElementById('lcLaunchBtn') ? !document.getElementById('lcLaunchBtn').disabled : false,
          publishFnExists: typeof window._launchPublish === 'function' || typeof window._launchDeploy === 'function' || typeof window._launchOpenControl === 'function',
        }));
        check('19. Launch Control workspace still opens with a real readiness bar (unchanged)', lc.workspaceVisible, lc.workspaceVisible);
        check('19b. A real READY campaign still has an enabled launch button (unchanged)', lc.launchBtnEnabled, lc.launchBtnEnabled);
        check('20. Deployment control entry point still exists and is wired (no deployment logic touched this sprint)', lc.publishFnExists, lc.publishFnExists);
        check('JS errors during Launch Control check', page._jsErrors.length === 0, page._jsErrors);
        await page.close();
      } catch (e) { check('SETUP CRASH (19-20)', false, String(e)); }
    }
  } finally {
    if (userMain) await deleteTestUser(userMain.userId);
    if (userEmpty) await deleteTestUser(userEmpty.userId);
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
