// ════════════════════════════════════════════════════════════════
// Campaign Replay — chronological, evidence-only campaign journey
// (Campaign Replay sprint)
//
// Covers: real event derivation from the local campaign record and the
// real intelligence_events log (seeded here with genuine rows, read
// back through the real GET /api/intelligence/events route — not
// mocked), honest handling of missing history/performance, status
// precision (never claiming LIVE without a provider-confirmed status),
// the Drafts/Live-Campaigns entry points, Overview's Recent Activity,
// no fabricated data anywhere, mobile, and basic accessibility.
//
// Real HTTP is used throughout for intelligence_events (a genuine,
// disposable Supabase user + real seeded rows + the real read route) —
// only the live ad-platform response (/api/meta/campaigns, for the
// Current Performance section) is mocked via window.apiFetch, since no
// real connected ad account exists in this environment and one must
// never be used for testing (same established convention as the Launch
// Control sprint's tests).
//
// RUN: node tests/campaign-replay.test.js
// ════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

const BASE_URL = process.env.TEST_FRONTEND_URL || 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH
  || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond });
  console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail !== undefined ? ' (' + JSON.stringify(detail) + ')' : ''));
}

async function createTestUser(suffix) {
  const email = `oriven.replay.test+${Date.now()}.${suffix}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'creator', onboarding_completed: true }, { onConflict: 'id' });
  return { userId, email, password };
}
async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('intelligence_events').delete().eq('user_id', userId); } catch (_) {}
  try { await supabaseAdmin.from('profiles').delete().eq('id', userId); } catch (_) {}
  try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
}
async function seedEvent(userId, row) {
  const { error } = await supabaseAdmin.from('intelligence_events').insert(Object.assign({
    user_id: userId, type: 'campaign_action', severity: 'low', dismissed: false,
  }, row));
  if (error) throw error;
}

function makeCampaign(overrides) {
  const id = 'crp_' + Math.random().toString(36).slice(2);
  const base = {
    id, name: 'Replay Test Campaign', platform: 'meta', status: 'published',
    goal: 'Sales', creativeMode: 'images', created: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated: new Date().toISOString(),
    pkg: {
      campaignName: 'Replay Test Campaign',
      strategy: { goal: 'Sales', landingPageUrl: 'https://example.com/x' },
      metaAds: { headline: 'x', primaryText: 'y', budget: 25 },
      visualConcepts: [{ conceptRef: 'a', generatedImageUrl: 'https://picsum.photos/seed/crptest/600/600' }],
    },
  };
  return Object.assign({}, base, overrides);
}
async function seedCampaigns(page, camps) {
  await page.evaluate((camps) => {
    const key = (typeof _orvCampaignsKey === 'function') ? _orvCampaignsKey() : null;
    if (key) localStorage.setItem(key, JSON.stringify(camps));
  }, camps);
}
async function signIn(page, user) {
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  const authClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: signInData, error } = await authClient.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
  await page.evaluate(async () => {
    const { data: { user } } = await window.SB.auth.getUser();
    window._currentUser = user;
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user);
    if (typeof _loadUserProfile === 'function') await _loadUserProfile(user);
  });
  await page.waitForTimeout(800);
}
async function gotoOverview(page) {
  await page.evaluate(() => { _orvNav('performance', 'page-performance'); });
  await page.waitForTimeout(600);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let user;
  try {
    user = await createTestUser('a');

    // ════════════════════════════════════════════════════════════
    // 1. Rich campaign: real created + versionHistory + real seeded
    //    deployment/pause/resume events -> full honest timeline
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, user);
      const createdTs = new Date(Date.now() - 6 * 86400000).toISOString();
      const deployTs = new Date(Date.now() - 4 * 86400000).toISOString();
      const pauseTs = new Date(Date.now() - 2 * 86400000).toISOString();
      const resumeTs = new Date(Date.now() - 1 * 86400000).toISOString();
      const camp = makeCampaign({
        created: createdTs,
        versionHistory: [{ module: 'metaAds', timestamp: new Date(Date.now() - 5 * 86400000).toISOString(), data: { headline: 'old' } }],
      });
      await seedEvent(user.userId, { platform: 'meta', campaign_name: camp.name, title: `Published "${camp.name}" to Meta Ads`, detail: '1 ad set, 1 ad created, paused, ready for review.', created_at: deployTs });
      await seedEvent(user.userId, { platform: 'meta', campaign_name: camp.name, title: 'Campaign paused', detail: `Campaign 12345 was paused on Meta Ads.`, created_at: pauseTs });
      await seedEvent(user.userId, { platform: 'meta', campaign_name: camp.name, title: 'Campaign resumed', detail: `Campaign 12345 was resumed on Meta Ads.`, created_at: resumeTs });
      await seedCampaigns(page, [camp]);

      await page.evaluate((id) => { window._crpOpenFromLocal(id); }, camp.id);
      await page.waitForTimeout(1500);

      const st = await page.evaluate(() => ({
        active: document.getElementById('page-campaign-replay').classList.contains('active'),
        name: document.getElementById('crpCampName').textContent,
        tlCount: document.querySelectorAll('.crp-tl-item').length,
        titles: Array.from(document.querySelectorAll('.crp-tl-title')).map((e) => e.textContent),
        story: document.getElementById('crpStory').textContent,
      }));
      check('1. Opening Replay from a Drafts card navigates to the real page-campaign-replay', st.active, st.active);
      check('1b. Hero shows the real campaign name', st.name === 'Replay Test Campaign', st.name);
      check('2. Timeline shows exactly 4 real events (created, config change, deploy, pause+resume=2 more -> 5 total)', st.tlCount === 5, { count: st.tlCount, titles: st.titles });
      check('3. Timeline includes the real "Campaign created" event', st.titles.includes('Campaign created'), st.titles);
      check('4. Timeline includes the real seeded deployment event title verbatim', st.titles.some((t) => t === `Published "${camp.name}" to Meta Ads`), st.titles);
      check('5. Timeline includes real pause AND resume events (status.changed now logged for all platforms)', st.titles.includes('Campaign paused') && st.titles.includes('Campaign resumed'), st.titles);
      check('6. Events render in real chronological order (created first, most recent last)', st.titles[0] === 'Campaign created' && st.titles[st.titles.length - 1] === 'Campaign resumed', st.titles);
      check('7. Story summary is grounded in real dates, not invented', /created on/i.test(st.story) && /deployed to/i.test(st.story), st.story);

      // Click an event -> detail panel shows real source label
      await page.click('.crp-tl-item >> nth=1'); // the config-change event
      await page.waitForTimeout(300);
      const detail = await page.evaluate(() => ({
        title: document.querySelector('.crp-ed-title')?.textContent,
        source: document.querySelector('.crp-ed-source')?.textContent,
      }));
      check('8. Selecting a timeline event opens a real detail panel with a SOURCE label', /SOURCE:/.test(detail.source || ''), detail);
      check('8b. A local (versionHistory-derived) event is honestly labeled as a local record, not the activity log', /campaign record/i.test(detail.source || ''), detail.source);

      // No fabricated data check — scan the whole Replay view for forbidden terms
      const noFake = await page.evaluate(() => {
        const text = document.getElementById('page-campaign-replay').innerText;
        return !/ROAS|revenue|customers acquired|fabricat/i.test(text);
      });
      check('9. No fabricated metrics/language anywhere in the rendered Replay view', noFake, noFake);
      check('JS errors (rich campaign scenario)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 10. Sparse campaign: only real creation, nothing else -> honest
    //     minimal timeline, no fabricated history
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, user);
      const camp = makeCampaign({ name: 'Sparse Campaign', status: 'draft' });
      await seedCampaigns(page, [camp]);
      await page.evaluate((id) => { window._crpOpenFromLocal(id); }, camp.id);
      await page.waitForTimeout(1500);
      const st = await page.evaluate(() => ({
        tlCount: document.querySelectorAll('.crp-tl-item').length,
        titles: Array.from(document.querySelectorAll('.crp-tl-title')).map((e) => e.textContent),
        story: document.getElementById('crpStory').textContent,
        perfText: document.getElementById('crpPerformance').textContent,
      }));
      check('10. A campaign with no deployment/pause history shows only its real creation event (no fabricated steps)', st.tlCount === 1 && st.titles[0] === 'Campaign created', st);
      check('11. Story honestly states deployment history is not available, rather than inventing it', /not available/i.test(st.story), st.story);
      check('JS errors (sparse campaign scenario)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 12. Empty history (truly zero events) -> the explicit "NO REPLAY
    //     DATA YET" empty state (spec 34)
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, user);
      const camp = makeCampaign({ name: 'No History Campaign', status: 'draft', created: null });
      delete camp.created;
      await seedCampaigns(page, [camp]);
      await page.evaluate((id) => { window._crpOpenFromLocal(id); }, camp.id);
      await page.waitForTimeout(1200);
      const empty = await page.evaluate(() => ({
        hasEmptyState: !!document.querySelector('.crp-empty-title'),
        emptyTitle: document.querySelector('.crp-empty-title')?.textContent,
      }));
      check('12. A campaign with zero derivable events shows the honest "NO REPLAY DATA YET" empty state', empty.hasEmptyState && /NO REPLAY DATA YET/.test(empty.emptyTitle || ''), empty);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 13. Status precision: local-only "published" status must show as
    //     "not yet re-verified", never as LIVE/Active
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, user);
      const camp = makeCampaign({ name: 'Status Precision Campaign', status: 'published' });
      await seedCampaigns(page, [camp]);
      await page.evaluate((id) => { window._crpOpenFromLocal(id); }, camp.id);
      await page.waitForTimeout(1200);
      const badge = await page.evaluate(() => document.getElementById('crpStatusBadge').textContent);
      check('13. A locally-published (never re-verified) campaign is never shown as LIVE/Active — honest "not yet re-verified" label', /not (yet )?re-?verified/i.test(badge) && !/^Active$/i.test(badge.trim()), badge);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 14. Live-only campaign (no local match) — opened via
    //     _crpOpenFromLive with real-shaped provider data, provider
    //     status honored exactly, and an honest "created outside
    //     ORIVEN" note when no local record exists.
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, user);
      await seedCampaigns(page, []); // no local campaigns at all
      await page.evaluate(() => {
        window._crpOpenFromLive('meta', '999888777', 'Provider-Only Campaign', 'ACTIVE', new Date(Date.now() - 10 * 86400000).toISOString());
      });
      await page.waitForTimeout(1200);
      const st = await page.evaluate(() => ({
        badge: document.getElementById('crpStatusBadge').textContent,
        titles: Array.from(document.querySelectorAll('.crp-tl-title')).map((e) => e.textContent),
        details: Array.from(document.querySelectorAll('.crp-tl-item')).length,
      }));
      check('14. A live-only campaign (provider-confirmed ACTIVE, no local ORIVEN record) shows the REAL provider status', /^Active$/i.test(st.badge.trim()), st.badge);
      check('14b. Its creation event is honestly attributed to the platform, not fabricated as an ORIVEN creation', st.titles.includes('Campaign created'), st.titles);
      await page.click('.crp-tl-item >> nth=0');
      await page.waitForTimeout(300);
      const src = await page.evaluate(() => document.querySelector('.crp-ed-source')?.textContent);
      check('14c. That event is honestly sourced to the live platform response, not the (nonexistent) ORIVEN record', /platform response/i.test(src || ''), src);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 15. Missing performance data (non-Meta platform) -> honest
    //     empty state, never an empty fake chart
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, user);
      const camp = makeCampaign({ name: 'Google Perf Campaign', platform: 'google' });
      await seedCampaigns(page, [camp]);
      await page.evaluate((id) => { window._crpOpenFromLocal(id); }, camp.id);
      await page.waitForTimeout(1200);
      const perf = await page.evaluate(() => document.getElementById('crpPerformance').textContent);
      check('15. Google campaign (no per-campaign metrics route exists) shows the honest "not available" message, never a fake chart', /not available/i.test(perf), perf);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 16. Real performance data (Meta, mocked network layer only —
    //     no real ad account) -> genuinely rendered metrics
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, user);
      const camp = makeCampaign({ name: 'Meta Perf Campaign' });
      await seedCampaigns(page, [camp]);
      await page.evaluate((name) => {
        const real = window.apiFetch;
        window.apiFetch = async function (path, options) {
          if (path.indexOf('/api/meta/campaigns') === 0) {
            return { ok: true, status: 200, data: { campaigns: [{ campaign_name: name, spend: 42.5, impressions: 10234, clicks: 187, ctr: 0.0183, conversions: 6 }] } };
          }
          return real(path, options);
        };
      }, camp.name);
      await page.evaluate((id) => { window._crpOpenFromLocal(id); }, camp.id);
      await page.waitForTimeout(1200);
      const perf = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.crp-perf-row')).map((r) => r.textContent);
        return { rows, hasNote: /not a historical trend/i.test(document.getElementById('crpPerformance').textContent) };
      });
      check('16. Real (mocked-network) Meta performance renders genuine metric rows', perf.rows.some((r) => /Spend/.test(r) && /42\.50/.test(r)), perf.rows);
      check('16b. Performance is explicitly labeled a live snapshot, never implying a historical trend', perf.hasNote, perf.hasNote);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 17. Campaign Replay (in Campaigns' own right column) — real
    // events, links into the full Replay page.
    //
    // Not obsolete architecture: #prfReplaySection/#prfReplayList/
    // .prf-ra-item/.prf-ra-title ARE today's real Campaign Replay card
    // (Campaigns Composition pass, right column) -- this was previously
    // failing only because _prfLoadCampaignReplay() correctly, honestly
    // scopes events to the ACTIVE PROVIDER TAB (`e.platform === plat`,
    // app.html) and this test seeded a 'meta' event without ever
    // switching off the default 'google' tab (nothing is connected in
    // this environment, so Campaigns falls back to Google) -- the event
    // was being filtered out exactly as it honestly should be for a
    // platform mismatch. Fixed by switching to the Meta tab, matching the
    // seeded event's platform, before checking.
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, user);
      const camp = makeCampaign({ name: 'Overview Activity Campaign' });
      await seedEvent(user.userId, { platform: 'meta', campaign_name: camp.name, title: `Published "${camp.name}" to Meta Ads`, detail: 'x', created_at: new Date().toISOString() });
      await seedCampaigns(page, [camp]);
      await gotoOverview(page);
      await page.click('.prf-ptab-meta');
      await page.waitForTimeout(1000);
      const ra = await page.evaluate(() => ({
        visible: document.getElementById('prfReplaySection').style.display !== 'none',
        hasItem: !!document.querySelector('.prf-ra-item'),
        itemText: document.querySelector('.prf-ra-title')?.textContent,
      }));
      check('17. Campaign Replay shows a real activity item when real events exist for the active platform', ra.visible && ra.hasItem, ra);
      check('17b. The activity item shows the real event title, not fabricated', ra.itemText === `Published "${camp.name}" to Meta Ads`, ra.itemText);

      await page.click('.prf-ra-item-link');
      await page.waitForTimeout(1000);
      const opened = await page.evaluate(() => document.getElementById('page-campaign-replay').classList.contains('active'));
      check('18. Clicking a Campaign Replay item opens the full Replay page for the matching real campaign', opened, opened);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 19. Campaign Replay — honest empty state (no events)
    //
    // Current architecture (verified against app.html's
    // _prfLoadCampaignReplay): the card itself is never hidden once
    // populated -- it stays visible with an honest "No recorded
    // activity..." message inside it. Hiding the whole card would be
    // LESS honest, not more (spec, this session's Composition pass: "no
    // fake events... honest empty state"), so this assertion is updated
    // to check for that visible, honest empty message rather than the
    // section being hidden entirely.
    // ════════════════════════════════════════════════════════════
    {
      const email2 = `oriven.replay.test+${Date.now()}.empty@example.com`;
      const password2 = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
      const { data: created2 } = await supabaseAdmin.auth.admin.createUser({ email: email2, password: password2, email_confirm: true });
      const userId2 = created2.user.id;
      await supabaseAdmin.from('profiles').upsert({ id: userId2, email: email2, subscription_status: 'creator', onboarding_completed: true }, { onConflict: 'id' });
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        await signIn(page, { email: email2, password: password2 });
        await gotoOverview(page);
        await page.waitForTimeout(1000);
        const empty = await page.evaluate(() => ({
          visible: document.getElementById('prfReplaySection').style.display !== 'none',
          noFakeItems: !document.querySelector('.prf-ra-item'),
          emptyMsgVisible: getComputedStyle(document.getElementById('prfReplayEmpty')).display !== 'none',
          emptyMsgText: document.getElementById('prfReplayEmpty').textContent,
        }));
        check('19. A fresh account with zero real events shows the card with an honest empty-state message (never fabricated items, never a fully hidden card)', empty.visible && empty.noFakeItems && empty.emptyMsgVisible && /No recorded activity/i.test(empty.emptyMsgText), empty);
        await page.close();
      } finally {
        await deleteTestUser(userId2);
      }
    }

    // ════════════════════════════════════════════════════════════
    // 20. Mobile: no overflow, timeline usable, back button works
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, user);
      const camp = makeCampaign({ name: 'Mobile Replay Campaign' });
      await seedCampaigns(page, [camp]);
      await page.evaluate((id) => { window._crpOpenFromLocal(id); }, camp.id);
      await page.waitForTimeout(1200);
      const mobile = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        tlVisible: !!document.querySelector('.crp-tl-item'),
      }));
      check('20. [mobile 390px] No horizontal overflow on Campaign Replay', !mobile.overflow, mobile.overflow);
      check('20b. [mobile] Timeline renders and is visible', mobile.tlVisible, mobile.tlVisible);
      await page.click('#crpBackBtn');
      await page.waitForTimeout(600);
      const back = await page.evaluate(() => document.getElementById('page-campaigns').classList.contains('active'));
      check('21. Back button returns to the real originating page (Drafts)', back, back);
      check('JS errors (mobile scenario)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 22. Accessibility basics: keyboard-focusable timeline events,
    //     role="listitem", visible focus, real button semantics
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await signIn(page, user);
      const camp = makeCampaign({ name: 'A11y Campaign' });
      await seedCampaigns(page, [camp]);
      await page.evaluate((id) => { window._crpOpenFromLocal(id); }, camp.id);
      await page.waitForTimeout(1200);
      const a11y = await page.evaluate(() => {
        const item = document.querySelector('.crp-tl-item');
        return {
          hasRole: !!document.querySelector('.crp-timeline[role="list"]'),
          itemFocusable: item && item.getAttribute('tabindex') === '0',
          itemKeydown: item && !!item.getAttribute('onkeydown'),
          backIsButton: document.getElementById('crpBackBtn').tagName === 'BUTTON',
        };
      });
      check('23. Timeline exposes a real list semantic (role="list")', a11y.hasRole, a11y.hasRole);
      check('24. Timeline events are keyboard-focusable (tabindex=0) with a real key handler', a11y.itemFocusable && a11y.itemKeydown, a11y);
      check('25. Back control is a real <button>, not a styled div', a11y.backIsButton, a11y.backIsButton);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 26. Regression: Live Campaigns / Insights / nav still intact
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await signIn(page, user);
      await page.evaluate(() => { _orvNav('adsmanager', 'page-ads-manager'); });
      await page.waitForTimeout(600);
      const liveOk = await page.evaluate(() => document.getElementById('page-ads-manager').classList.contains('active'));
      check('26. Live Campaigns still reachable and functional (no regression)', liveOk, liveOk);

      await page.evaluate(() => { _orvNav('intelligence', 'page-intelligence'); });
      await page.waitForTimeout(600);
      const insOk = await page.evaluate(() => document.getElementById('page-intelligence').classList.contains('active'));
      check('27. Insights still reachable and functional (no regression)', insOk, insOk);

      await gotoOverview(page);
      // Campaigns Simplification & Consolidation sprint: Overview/Live
      // Campaigns/Insights are no longer separate destinations to choose
      // between, so the hub tab strip itself no longer renders any tabs
      // (superseded the earlier "exactly Overview/Live Campaigns/Insights"
      // expectation) — the important regression guard is that no NEW nav
      // items were added, which "0 tabs" still satisfies.
      const stripTabs = await page.evaluate(() => Array.from(document.querySelectorAll('#orvHubTabsCampaigns button')).map((b) => b.textContent.trim()));
      check('28. Campaigns hub tab strip no longer offers separate destinations, and no new nav items were added (0 tabs)', stripTabs.length === 0, stripTabs);
      check('JS errors (regression scenario)', jsErrors.length === 0, jsErrors);
      await page.close();
    }
  } finally {
    if (user) await deleteTestUser(user.userId);
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
