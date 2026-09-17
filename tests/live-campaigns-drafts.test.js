// ════════════════════════════════════════════════════════════════
// Live Campaigns & Drafts — workspace polish pass regression tests
//
// Verifies: Live Campaigns defaults to Google Ads (never "All Platforms"),
// campaigns are grouped into a primary "Active" section and a visually
// secondary, collapsible "Archived" section (never one continuous mixed
// table), existing per-row actions still render correctly per status, and
// Drafts no longer shows the redundant "Continue working" pinned strip
// while still defaulting to Google Ads.
//
// COST/DATA NOTE: no live Google/Meta/TikTok ad account is connected in
// this environment. Tests mock only the network layer (window.apiFetch)
// so the real init -> fetch -> render pipeline runs end-to-end against a
// controlled, realistic payload -- same approach already established in
// campaign-overview-metrics.test.js for the TikTok fetch-wiring checks.
//
// RUN: npm run test:workspace-polish
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
  const email = `oriven.workspacepolish.test+${Date.now()}.${suffix || 'a'}@example.com`;
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

async function main() {
  const results = [];
  function check(name, cond, detail) {
    results.push({ name, ok: !!cond, detail });
    console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail ? ' (' + detail + ')' : ''));
  }

  const user = await createTestUser('flow');
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

  try {
    await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
    await signIn(page, user);

    // ════════════════════════════════════════════════════════════
    // LIVE CAMPAIGNS
    // ════════════════════════════════════════════════════════════

    // Mock the network layer: Google connected with a realistic mix of
    // active + archived campaigns; Meta/TikTok not connected.
    await page.evaluate(() => {
      window.apiFetch = async function(path, options) {
        if (path.indexOf('/api/google/status') === 0) return { ok: true, data: { connected: true, active_ad_account: { account_name: 'Test Google Account' } } };
        if (path.indexOf('/api/meta/status') === 0) return { ok: true, data: { connected: false } };
        if (path.indexOf('/api/tiktok/status') === 0) return { ok: true, data: { connected: false } };
        if (path.indexOf('/api/google/campaigns') === 0) {
          return { ok: true, data: { currency: 'EUR', campaigns: [
            { campaign_id: '1', campaign_name: 'Active Campaign A', status: 'ENABLED', channel_type: 'SEARCH', budget_micros: 5000000, start_date: '2026-01-01' },
            { campaign_id: '2', campaign_name: 'Active Campaign B', status: 'ENABLED', channel_type: 'SEARCH', budget_micros: 5000000, start_date: '2026-01-02' },
            { campaign_id: '3', campaign_name: 'Paused Campaign', status: 'PAUSED', channel_type: 'SEARCH', budget_micros: 3000000, start_date: '2025-11-01' },
            { campaign_id: '4', campaign_name: 'Removed Campaign', status: 'REMOVED', channel_type: 'SEARCH', budget_micros: 3000000, start_date: '2025-10-01' }
          ] } };
        }
        return { ok: false, data: null };
      };
    });

    // ── 1. Google Ads is the default platform — Live Campaigns' real list
    // was relocated into the merged Campaigns workspace (#page-performance,
    // "Your Campaigns" section) by the Campaigns Simplification &
    // Consolidation sprint; it is no longer visible on the standalone
    // #page-ads-manager route (kept only for compatibility — see
    // _prfSyncCampaignsSection's comment in app.html). ─────────────────────
    await page.evaluate(() => { if (typeof _orvNav === 'function') _orvNav('performance', 'page-performance'); });
    await page.waitForTimeout(900);
    const defaultTab = await page.evaluate(() => ({
      googleActive: document.querySelector('.prf-ptab-google').classList.contains('active'),
      googleWrapVisible: getComputedStyle(document.getElementById('admGLiveWrap')).display !== 'none',
      metaWrapHidden: getComputedStyle(document.getElementById('admMLiveWrap')).display === 'none',
    }));
    check('1. Live Campaigns (now inside Campaigns/Overview) opens on Google Ads by default (not "All Platforms")', defaultTab.googleActive && defaultTab.googleWrapVisible && defaultTab.metaWrapHidden, JSON.stringify(defaultTab));

    // ── 2. Active vs Archived grouping — never one continuous mixed table ─
    const grouping = await page.evaluate(() => {
      const container = document.getElementById('admGLiveTableContainer');
      const activeGroup = container.querySelector('.adm-lc-group:not(.adm-lc-archived)');
      const archivedGroup = container.querySelector('.adm-lc-group.adm-lc-archived');
      const activeNames = activeGroup ? Array.from(activeGroup.querySelectorAll('.adm-camp-name')).map(el => el.textContent) : [];
      const archivedBody = archivedGroup ? archivedGroup.querySelector('.adm-lc-archived-body') : null;
      const archivedNames = archivedGroup ? Array.from(archivedGroup.querySelectorAll('.adm-camp-name')).map(el => el.textContent) : [];
      return {
        singleTable: !!container.querySelector(':scope > table'), // would indicate the OLD one-table-for-everything layout
        activeNames, archivedNames,
        archivedCollapsedByDefault: archivedBody ? getComputedStyle(archivedBody).display === 'none' : null,
        activeCount: activeGroup ? activeGroup.querySelector('.adm-lc-group-count').textContent : null,
        archivedCount: archivedGroup ? archivedGroup.querySelector('.adm-lc-group-count').textContent : null,
      };
    });
    check('2. Active and Archived render as two separate groups, not one continuous table', !grouping.singleTable && grouping.activeNames.length === 2 && grouping.archivedNames.length === 2, JSON.stringify(grouping));
    check('2b. Active group contains only genuinely active campaigns, listed first', grouping.activeNames.indexOf('Active Campaign A') !== -1 && grouping.activeNames.indexOf('Active Campaign B') !== -1 && grouping.activeNames.indexOf('Paused Campaign') === -1, JSON.stringify(grouping.activeNames));
    check('2c. Archived group contains the paused/removed campaigns, not the active ones', grouping.archivedNames.indexOf('Paused Campaign') !== -1 && grouping.archivedNames.indexOf('Removed Campaign') !== -1 && grouping.archivedNames.indexOf('Active Campaign A') === -1, JSON.stringify(grouping.archivedNames));
    check('2d. Archived group is collapsed by default (visually secondary, not competing with Active)', grouping.archivedCollapsedByDefault === true, JSON.stringify(grouping));
    check('2e. Group headers show the real counts (2 active, 2 archived)', grouping.activeCount === '2' && grouping.archivedCount === '2', JSON.stringify(grouping));

    // ── 3. Archived section expands on click ──────────────────────────────
    await page.click('#admGLiveTableContainer .adm-lc-archived-hd');
    await page.waitForTimeout(200);
    const archivedExpanded = await page.evaluate(() => {
      const body = document.querySelector('#admGLiveTableContainer .adm-lc-archived-body');
      return getComputedStyle(body).display !== 'none';
    });
    check('3. Clicking the Archived header expands it', archivedExpanded);

    // ── 4. Existing per-row actions still render correctly per status ────
    const actions = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#admGLiveTableContainer tr[id^="admGLiveRow_"]'));
      const byName = {};
      rows.forEach(r => {
        const name = r.querySelector('.adm-camp-name').textContent;
        byName[name] = Array.from(r.querySelectorAll('.adm-act-btn')).map(b => b.className);
      });
      return byName;
    });
    const activeHasPause = (actions['Active Campaign A'] || []).some(c => c.indexOf('adm-act-pause') !== -1);
    const pausedHasResume = (actions['Paused Campaign'] || []).some(c => c.indexOf('adm-act-resume') !== -1);
    check('4. An active campaign still shows a Pause action (now inside the row\'s compact overflow menu)', activeHasPause, JSON.stringify(actions['Active Campaign A']));
    check('4b. A paused (archived) campaign still shows a Resume action -- functionality preserved, not removed', pausedHasResume, JSON.stringify(actions['Paused Campaign']));

    // ── 4c. Campaigns Simplification sprint: row action clutter reduced to
    // one obvious primary action ("Open ->") + a compact "..." overflow ──
    const rowHierarchy = await page.evaluate(() => {
      const row = document.getElementById('admGLiveRow_1');
      return {
        hasPrimaryOpen: !!row.querySelector('.adm-act-open') && /Open/.test(row.querySelector('.adm-act-open').textContent),
        hasOverflowTrigger: !!row.querySelector('.adm-act-more'),
        overflowClosedByDefault: !row.querySelector('.adm-act-overflow')?.classList.contains('adm-act-menu-open'),
      };
    });
    check('4c. Each row has one obvious primary "Open ->" action', rowHierarchy.hasPrimaryOpen, JSON.stringify(rowHierarchy));
    check('4d. Secondary actions live behind a compact overflow ("...") trigger, closed by default', rowHierarchy.hasOverflowTrigger && rowHierarchy.overflowClosedByDefault, JSON.stringify(rowHierarchy));

    // ── 5. Zero archived campaigns -> no Archived section rendered at all ─
    await page.evaluate(() => {
      window.apiFetch = async function(path) {
        if (path.indexOf('/api/google/status') === 0) return { ok: true, data: { connected: true } };
        if (path.indexOf('/api/meta/status') === 0) return { ok: true, data: { connected: false } };
        if (path.indexOf('/api/tiktok/status') === 0) return { ok: true, data: { connected: false } };
        if (path.indexOf('/api/google/campaigns') === 0) {
          return { ok: true, data: { currency: 'EUR', campaigns: [
            { campaign_id: '9', campaign_name: 'Only Active', status: 'ENABLED', channel_type: 'SEARCH', budget_micros: 1000000, start_date: '2026-01-01' }
          ] } };
        }
        return { ok: false, data: null };
      };
      _admLoadGoogleLive();
    });
    await page.waitForTimeout(900);
    const noArchivedSection = await page.evaluate(() => !document.querySelector('#admGLiveTableContainer .adm-lc-archived'));
    check('5. No Archived section renders at all when there are zero archived campaigns', noArchivedSection);

    // ════════════════════════════════════════════════════════════
    // DRAFTS
    // ════════════════════════════════════════════════════════════

    await page.evaluate(() => { if (typeof _orvNav === 'function') _orvNav('campaigns', 'page-campaigns'); });
    await page.waitForTimeout(500);

    // ── 6. Google Ads remains the default platform on Drafts, unchanged ──
    const draftsDefault = await page.evaluate(() => ({
      googleTabActive: document.querySelector('.clib-tab[data-filter="google"]').classList.contains('clib-tab-on'),
      metaTabNotActive: !document.querySelector('.clib-tab[data-filter="meta"]').classList.contains('clib-tab-on'),
    }));
    check('6. Drafts still defaults to Google Ads, exactly as before', draftsDefault.googleTabActive && draftsDefault.metaTabNotActive, JSON.stringify(draftsDefault));

    // ── 7. The redundant "Continue working" cross-platform status strip is gone ──
    await page.evaluate(() => {
      const key = (typeof _orvCampaignsKey === 'function') ? _orvCampaignsKey() : null;
      const now = Date.now();
      const camps = [
        { id: 'g1', platform: 'google', name: 'Google Draft One', goal: 'Sales', status: 'draft', modules: ['a', 'b'], generated: {}, created: now - 1000 },
        { id: 'g2', platform: 'google', name: 'Google Draft Two', goal: 'Leads', status: 'generated', modules: ['a', 'b'], generated: {}, created: now - 2000 }
      ];
      if (key) localStorage.setItem(key, JSON.stringify(camps));
      if (typeof renderCampaignHub === 'function') renderCampaignHub();
    });
    await page.waitForTimeout(500);
    const noContinueWorking = await page.evaluate(() => ({
      noPinnedEl: !document.getElementById('campHubPinned'),
      noHeaderText: !Array.from(document.querySelectorAll('body *')).some(el => el.children.length === 0 && /continue working/i.test(el.textContent || '')),
      gridStillShowsCards: document.querySelectorAll('#campCardGrid .camp-card').length === 2,
    }));
    check('7. The "Continue working" pinned/duplicate strip no longer exists', noContinueWorking.noPinnedEl && noContinueWorking.noHeaderText, JSON.stringify(noContinueWorking));
    check('7b. Drafts still shows the real campaign grid underneath (draft functionality unchanged)', noContinueWorking.gridStillShowsCards, JSON.stringify(noContinueWorking));

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
