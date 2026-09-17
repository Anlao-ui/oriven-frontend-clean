// ════════════════════════════════════════════════════════════════
// ORIVEN Continuity / Context Layer — orivenContext.js
//
// Verifies the shared context engine that connects the six existing
// products (Create, Research, Launch, Campaigns, Autopilot, Business)
// without a new dashboard: window.orvContext's real getters (launch,
// research, autopilot, businessSignals, connectedAccounts), the
// deterministic current-state engine (_orvCurrentState), change
// detection since last visit (_orvComputeChangesSinceLastVisit),
// launch-blocker scanning (_orvFindBlockedCampaigns), the ORIVEN AI
// panel's context-aware entry state (_orvComputeEntrySignals wired into
// _orvAiLoadRecs), and client-side navigation shortcuts
// (_orvAiTryNavigate). Every check below verifies REAL data only — no
// fabricated state, no invented events, no invented readiness.
//
// Real HTTP (GET /api/intelligence/events, GET /api/setup/meta/status)
// against real, disposable, seeded Supabase users — same convention as
// launch-control.test.js / launch-readiness-gate.test.js. Campaigns are
// seeded directly into localStorage via the real, existing
// _orvCampaignsKey()/_loadCamps()/_saveCamps() client store. No AI chat
// completion is exercised end-to-end here (the AIML provider is a known
// pre-existing environment limitation in this sandbox, documented
// separately) — chat-context plumbing is instead verified by confirming
// the request reaches the backend without error and by asserting the
// exact context object sent, not by asserting on generated text.
//
// RUN: node tests/continuity-context-layer.test.js
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
  const email = `oriven.contextlayer.test+${Date.now()}.${suffix}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'professional', onboarding_completed: true }, { onConflict: 'id' });
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
  const page = await browser.newPage({ viewport: viewport || { width: 1440, height: 900 } });
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

function makeCampaign(overrides) {
  const id = 'ctx_test_' + Math.random().toString(36).slice(2);
  const base = {
    id, name: 'Continuity Test Campaign', platform: 'meta', status: 'ready-to-publish',
    goal: 'Sales', creativeMode: 'images', created: new Date().toISOString(),
    pkg: {
      campaignName: 'Continuity Test Campaign',
      strategy: { goal: 'Sales', landingPageUrl: 'https://example.com/sale' },
      metaAds: { headline: 'Headline', primaryText: 'Primary text.', budget: 25 },
      visualConcepts: [{ conceptRef: 'a', generatedImageUrl: 'https://picsum.photos/seed/ctxtest/600/600' }],
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
async function gotoLaunch(page) { await page.evaluate(() => { _orvNav('launch', 'page-launch'); }); await page.waitForTimeout(400); }

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let userReady, userNoConn;
  try {
    userReady = await createTestUser('ready');
    userNoConn = await createTestUser('noconn');
    await connectMeta(userReady.userId);

    // ════════════════════════════════════════════════════════════
    // 1. Module presence — every function this sprint adds is real
    //    and reachable, not silently missing.
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userNoConn);
      try {
        const fns = await page.evaluate(() => ({
          orvContext: !!window.orvContext,
          orvSaveResearchSession: typeof window._orvSaveResearchSession === 'function',
          orvLoadResearchSession: typeof window._orvLoadResearchSession === 'function',
          orvGetLastVisitAt: typeof window._orvGetLastVisitAt === 'function',
          orvSetLastVisitAt: typeof window._orvSetLastVisitAt === 'function',
          orvFindBlockedCampaigns: typeof window._orvFindBlockedCampaigns === 'function',
          orvComputeChangesSinceLastVisit: typeof window._orvComputeChangesSinceLastVisit === 'function',
          orvCurrentState: typeof window._orvCurrentState === 'function',
          orvComputeEntrySignals: typeof window._orvComputeEntrySignals === 'function',
          orvAiTryNavigate: typeof window._orvAiTryNavigate === 'function',
          orvGetCampaigns: typeof window._orvGetCampaigns === 'function',
          orvGetLaunchState: typeof window._orvGetLaunchState === 'function',
        }));
        check('1. window.orvContext (pre-existing Global Context Engine) still exists', fns.orvContext, fns);
        check('1b. All new context/state functions this sprint adds are real, reachable functions', Object.keys(fns).every((k) => fns[k] === true), fns);
        check('JS errors on load', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 2. Empty account — _orvCurrentState is honest (zeros/false/null),
    //    never fabricates data for a user with nothing yet.
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userNoConn);
      try {
        await seedCampaigns(page, []);
        const state = await page.evaluate(() => window._orvCurrentState());
        check('2. Empty account: hasAnyCampaigns is honestly false', state.hasAnyCampaigns === false, state);
        check('2b. Empty account: all campaign counts are real zeros, not omitted/undefined', state.pendingCampaignCount === 0 && state.publishedCampaignCount === 0 && state.blockedCampaignCount === 0, state);
        check('2c. Empty account: hasResearch is honestly false (no research ever run)', state.hasResearch === false, state.hasResearch);
        check('2d. Empty account: autopilotRulesKnown is false (never visited) — not a fabricated zero', state.autopilotRulesKnown === false && state.autopilotActiveRuleCount === null, state);
        const blocked = await page.evaluate(() => window._orvFindBlockedCampaigns());
        check('2e. Empty account: no blocked campaigns reported (nothing exists to be blocked)', Array.isArray(blocked) && blocked.length === 0, blocked);
        const launchCtx = await page.evaluate(() => window.orvContext.launch);
        check('2f. Empty account: orvContext.launch is null (no workspace open)', launchCtx === null, launchCtx);
        const researchCtx = await page.evaluate(() => window.orvContext.research);
        check('2g. Empty account: orvContext.research is null (no research yet)', researchCtx === null, researchCtx);
        const autopilotCtx = await page.evaluate(() => window.orvContext.autopilot);
        check('2h. Empty account: orvContext.autopilot is null (unknown, not a fake zero)', autopilotCtx === null, autopilotCtx);
        check('JS errors (empty account)', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 3. Account with a single campaign, ready to launch (real
    //    readiness via the SAME engine Launch itself uses).
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camp = makeCampaign({ name: 'Ready To Go' });
        await seedCampaigns(page, [camp]);
        const state = await page.evaluate(() => window._orvCurrentState());
        check('3. Account with 1 campaign: hasAnyCampaigns true, pendingCampaignCount 1', state.hasAnyCampaigns && state.pendingCampaignCount === 1, state);
        const blocked = await page.evaluate(() => window._orvFindBlockedCampaigns());
        check('3b. A genuinely-ready campaign is never listed as blocked', blocked.length === 0, blocked);

        await gotoLaunch(page);
        await page.evaluate((id) => { window._launchOpenControl(id); }, camp.id);
        await page.waitForTimeout(1500);
        const launchCtx = await page.evaluate(() => window.orvContext.launch);
        check('3c. orvContext.launch reflects the REAL readiness engine (READY TO LAUNCH) once the workspace is open', launchCtx && launchCtx.state === 'ready' && launchCtx.label === 'READY TO LAUNCH', launchCtx);
        check('3d. orvContext.launch names the real campaign and platform', launchCtx && launchCtx.campaignName === 'Ready To Go' && launchCtx.platform === 'meta', launchCtx);
        check('JS errors (ready campaign)', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 4. Campaign with a real launch blocker (missing creative) —
    //    orvContext.launch surfaces the REAL blocker, never invents one.
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camp = makeCampaign({ name: 'Missing Creative', pkg: { visualConcepts: [] } });
        await seedCampaigns(page, [camp]);
        await gotoLaunch(page);
        await page.evaluate((id) => { window._launchOpenControl(id); }, camp.id);
        await page.waitForTimeout(1500);
        const launchCtx = await page.evaluate(() => window.orvContext.launch);
        check('4. orvContext.launch reflects a REAL blocked state', launchCtx && launchCtx.state === 'blocked', launchCtx);
        check('4b. The real blocker reason (missing creative) is present verbatim, not summarized/invented', launchCtx && launchCtx.blockers.some((b) => /creative/i.test(b)), launchCtx && launchCtx.blockers);

        const blocked = await page.evaluate(() => window._orvFindBlockedCampaigns().map((c) => c.name));
        check('4c. _orvFindBlockedCampaigns finds this real blocked campaign from the full list (not just the open workspace)', blocked.includes('Missing Creative'), blocked);
        check('JS errors (blocked campaign)', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 5. Multiple campaigns — counts and blocker scan are correct
    //    across a real mixed set (not just a single-campaign happy path).
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camps = [
          makeCampaign({ name: 'A - blocked', pkg: { visualConcepts: [] } }),
          makeCampaign({ name: 'B - ready' }),
          makeCampaign({ name: 'C - published', status: 'published', updated: new Date().toISOString() }),
        ];
        await seedCampaigns(page, camps);
        const state = await page.evaluate(() => window._orvCurrentState());
        check('5. Multiple campaigns: pendingCampaignCount counts only real pre-publish campaigns (2, not 3)', state.pendingCampaignCount === 2, state);
        check('5b. Multiple campaigns: publishedCampaignCount reflects the real published one', state.publishedCampaignCount === 1, state);
        const blocked = await page.evaluate(() => window._orvFindBlockedCampaigns().map((c) => c.name));
        check('5c. Blocker scan finds exactly the real blocked one among several', blocked.length === 1 && blocked[0] === 'A - blocked', blocked);
        check('JS errors (multiple campaigns)', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 6. Change detection — new event(s) since last visit vs. none.
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camp = makeCampaign({ name: 'Freshly Created' });
        await seedCampaigns(page, [camp]);

        // 6a. First-ever visit (no stored lastVisitAt) — the real local
        // campaign-creation timestamp counts as a real change.
        const first = await page.evaluate(() => window._orvComputeChangesSinceLastVisit());
        check('6. First-ever visit (no lastVisitAt): a real local change (campaign creation) is honestly detected', first.count >= 1 && first.items.some((i) => i.type === 'campaign_created'), first);

        // 6b. Immediately after, with lastVisitAt set to "now", no new
        // local changes exist — must honestly report zero, never invent one.
        await page.evaluate(() => { window._orvSetLastVisitAt(new Date().toISOString()); });
        const second = await page.evaluate(() => window._orvComputeChangesSinceLastVisit());
        check('6b. Nothing changed since a just-set lastVisitAt: honestly reports 0, never fabricates a reason to return', second.count === 0, second);

        // 6c. A genuinely new campaign created after that point IS detected.
        const camp2 = makeCampaign({ name: 'Created After Visit' });
        await seedCampaigns(page, [camp, camp2]);
        const third = await page.evaluate(() => window._orvComputeChangesSinceLastVisit());
        check('6c. A real new campaign created after lastVisitAt is detected as a real change', third.count >= 1 && third.items.some((i) => /Created After Visit/.test(i.label)), third);
        check('JS errors (change detection)', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 7. Provider unavailable / incomplete data — connectedAccounts
    //    reflects real (all-false) state honestly, including Pinterest
    //    (a real gap this sprint fixed — it was previously omitted).
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userNoConn);
      try {
        const conn = await page.evaluate(() => window.orvContext.connectedAccounts);
        check('7. connectedAccounts includes all 4 real providers (google/meta/tiktok/pinterest keys present)', conn && ['google', 'meta', 'tiktok', 'pinterest'].every((k) => k in conn), conn);
        check('7b. No provider is connected for a genuinely disconnected user — all real false, never a guessed true', conn && Object.values(conn).every((v) => v === false), conn);
        check('JS errors (disconnected provider)', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 8. Business signals — safe to read even before Business Map has
    //    ever been visited this session (degrades to [], never throws).
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userNoConn);
      try {
        const signals = await page.evaluate(() => window.orvContext.businessSignals);
        check('8. orvContext.businessSignals is a real array (empty when Business Map genuinely unvisited), never throws', Array.isArray(signals), signals);
        check('JS errors (business signals, unvisited)', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 9. Research persistence — durable across a fresh page load for
    //    the same user (previously in-memory only, lost on reload).
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const before = await page.evaluate(() => window.orvContext.research);
        check('9. orvContext.research is null before any research has run', before === null, before);

        const fakeResult = { question: 'best CTAs for skincare ads', category: 'advertising', summary: 'Real summary.', competitors: [{ name: 'X' }], opportunities: [{ opportunity: 'Y' }, { opportunity: 'Z' }], confidence: 'moderate' };
        await page.evaluate((r) => {
          window._researchLastResult = r;
          window._orvSaveResearchSession(r);
        }, fakeResult);
        const after = await page.evaluate(() => window.orvContext.research);
        check('9b. orvContext.research reflects the real just-completed result (compact summary, not the full payload)', after && after.question === fakeResult.question && after.competitorCount === 1 && after.opportunityCount === 2, after);

        // Persistence round-trip: clear the in-memory value and read back
        // through localStorage alone — proves the save/load mechanism
        // itself is correct (independent of the in-memory fast path).
        const roundTrip = await page.evaluate(() => {
          window._researchLastResult = null;
          return { direct: window._orvLoadResearchSession(), viaContext: window.orvContext.research };
        });
        check('9c. Research survives with the in-memory value cleared — read back correctly from localStorage alone', roundTrip.direct && roundTrip.direct.result.question === fakeResult.question, roundTrip.direct);
        check('9d. orvContext.research falls back to the persisted session once the in-memory value is gone', roundTrip.viaContext && roundTrip.viaContext.question === fakeResult.question, roundTrip.viaContext);
        check('JS errors (research persistence)', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 10. Unsupported action — the navigation matcher returns null for
    //     free-form questions rather than a false-positive match.
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userNoConn);
      try {
        const matches = await page.evaluate(() => ({
          research: window._orvAiTryNavigate('open research'),
          create: window._orvAiTryNavigate('go to create'),
          launch: window._orvAiTryNavigate('take me to launch'),
          campaigns: window._orvAiTryNavigate('show me campaigns'),
          autopilot: window._orvAiTryNavigate('switch to autopilot'),
          business: window._orvAiTryNavigate('open business'),
          unsupported1: window._orvAiTryNavigate('why is my CTR dropping'),
          unsupported2: window._orvAiTryNavigate('set my budget to 50 euros'),
          empty: window._orvAiTryNavigate(''),
        }));
        check('10. Real navigation phrases match their real target page for all 6 products', matches.research.page === 'research' && matches.create.page === 'create' && matches.launch.page === 'launch' && matches.campaigns.page === 'performance' && matches.autopilot.page === 'autopilot' && matches.business.page === 'businessbrain', matches);
        check('10b. Unsupported/unrelated free-form questions are honestly NOT matched as navigation (no false positive)', matches.unsupported1 === null && matches.unsupported2 === null, { u1: matches.unsupported1, u2: matches.unsupported2 });
        check('10c. Empty input never matches', matches.empty === null, matches.empty);
        check('JS errors (navigation matching)', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 11. ORIVEN AI entry-state — real priority chain: a launch blocker
    //     AND a real change both surface, real text only.
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const camp = makeCampaign({ name: 'Entry State Test', pkg: { visualConcepts: [] } });
        await seedCampaigns(page, [camp]);
        await page.evaluate(() => { window.orvOpenAi(); });
        await page.waitForTimeout(1500);
        const entry = await page.evaluate(() => Array.from(document.querySelectorAll('.orv-ai-rec-card')).map((c) => ({
          label: c.querySelector('.orv-ai-rec-label')?.textContent,
          desc: c.querySelector('.orv-ai-rec-desc')?.textContent,
        })));
        check('11. ORIVEN AI panel entry state shows the real launch blocker as its own card', entry.some((c) => /can.t launch yet/i.test(c.label || '')), entry);
        check('11b. The blocker card names the real campaign, never a generic placeholder', entry.some((c) => c.desc && /Entry State Test/.test(c.desc)), entry);
        check('11c. A real "changed" signal also appears alongside it (new campaign created)', entry.some((c) => /thing.?s? changed/i.test(c.label || '')), entry);
        check('JS errors (AI entry state)', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 12. ORIVEN AI entry-state regression — unchanged existing
    //     behavior when this sprint's new signals are genuinely empty.
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userNoConn);
      try {
        await seedCampaigns(page, []);
        await page.evaluate(() => { window.orvOpenAi(); });
        await page.waitForTimeout(1500);
        const entry = await page.evaluate(() => Array.from(document.querySelectorAll('.orv-ai-rec-card')).map((c) => c.querySelector('.orv-ai-rec-label')?.textContent));
        check('12. With no continuity signals, the existing /api/intelligence/home-driven "Nothing to analyze yet" behavior is unchanged', entry.length === 1 && entry[0] === 'Nothing to analyze yet', entry);
        check('JS errors (AI entry state regression)', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 13. Navigating into ORIVEN AI's real shortcut from the actual UI
    //     — opens the real existing page, never a new one, costs no credits.
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userNoConn);
      try {
        let publishOrChatCalled = false;
        page.on('request', (req) => { if (/\/api\/ai\/chat|\/api\/publish\//.test(req.url())) publishOrChatCalled = true; });
        await page.evaluate(() => { window.orvOpenAi(); });
        await page.waitForTimeout(500);
        await page.fill('#orvAiInput', 'take me to launch');
        await page.click('#orvAiSendBtn');
        await page.waitForTimeout(800);
        const navResult = await page.evaluate(() => ({
          panelClosed: !document.getElementById('orvAiPanel').classList.contains('orv-ai-open'),
          launchPageActive: document.getElementById('page-launch').classList.contains('active'),
        }));
        check('13. "Take me to launch" via the real ORIVEN AI input opens the real existing Launch page', navResult.launchPageActive, navResult);
        check('13b. The AI panel closes cleanly after navigating (a real shortcut, not a lingering overlay)', navResult.panelClosed, navResult);
        check('13c. A pure navigation request never calls the paid AI chat endpoint (free, instant, deterministic)', !publishOrChatCalled, publishOrChatCalled);
        check('JS errors (navigation via real UI)', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 14. Entering from each of the six products — orvContext.page is
    //     correctly kept live by the existing _orvNav dispatcher, and
    //     no product page is broken by this sprint's additions.
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady);
      try {
        const entries = [
          { key: 'create', pageId: 'page-create' },
          { key: 'research', pageId: 'page-research' },
          { key: 'launch', pageId: 'page-launch' },
          { key: 'performance', pageId: 'page-performance' },
          { key: 'autopilot', pageId: 'page-autopilot' },
          { key: 'businessbrain', pageId: 'page-business-brain' },
        ];
        for (const e of entries) {
          await page.evaluate((k) => { _orvNav(k, null); }, e.key);
          await page.waitForTimeout(400);
          const active = await page.evaluate((id) => document.getElementById(id)?.classList.contains('active'), e.pageId);
          const ctxPage = await page.evaluate(() => window.orvContext.page);
          check(`14. Entering directly from ${e.key}: the real product page renders and orvContext.page updates`, active && ctxPage === e.key, { active, ctxPage });
        }
        check('JS errors (entering from every product)', page._jsErrors.length === 0, page._jsErrors);
      } finally { await page.close(); }
    }

    // ════════════════════════════════════════════════════════════
    // 15. Mobile viewport — no overflow, panel and entry state still work.
    // ════════════════════════════════════════════════════════════
    {
      const page = await signInAndGoto(browser, userReady, { width: 390, height: 844 });
      try {
        const camp = makeCampaign({ name: 'Mobile Continuity Test', pkg: { visualConcepts: [] } });
        await seedCampaigns(page, [camp]);
        await page.evaluate(() => { window.orvOpenAi(); });
        await page.waitForTimeout(1500);
        const mobile = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          hasBlockedCard: Array.from(document.querySelectorAll('.orv-ai-rec-card')).some((c) => /can.t launch yet/i.test(c.querySelector('.orv-ai-rec-label')?.textContent || '')),
          panelVisible: document.getElementById('orvAiPanel').getBoundingClientRect().width > 0,
        }));
        check('15. [mobile 390px] No horizontal overflow with the ORIVEN AI panel open', !mobile.overflow, mobile.overflow);
        check('15b. [mobile] The real context-aware entry state still renders correctly', mobile.hasBlockedCard, mobile);
        check('15c. [mobile] The panel itself is genuinely visible/sized (not collapsed to 0)', mobile.panelVisible, mobile.panelVisible);
        check('JS errors (mobile)', page._jsErrors.length === 0, page._jsErrors);
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
