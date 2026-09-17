// ════════════════════════════════════════════════════════════════
// Research — Interactive Market Map (Research Production Sprint)
//
// Dedicated coverage for the Market Map beyond nav-redesign.test.js's
// high-level page checks: rendering from a real structured fixture
// (never a live Astra/AIML call — that account has no funds in this
// environment and no live/billing testing is in scope for this suite),
// node/edge/evidence wiring, focus mode, opportunity filtering, source
// panel honesty, follow-up grounding, mobile, and accessibility basics.
//
// Same disposable-Supabase-user + Playwright convention as this repo's
// other UI test files.
// RUN: node tests/research-market-map.test.js
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
  const email = `oriven.marketmap.test+${Date.now()}.${suffix}@example.com`;
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

// Real, structured fixture matching the server's actual response shape
// (server.js POST /api/research/query) — used to test rendering/
// interaction without a live Astra/AIML call (out of scope: no live or
// billing testing performed by this suite).
const FIXTURE = {
  question: 'Research premium compression shirts for fitness brands',
  summary: '[FIXTURE] The premium compression apparel market emphasizes performance credibility and athlete association.',
  market: { name: 'Premium Compression Apparel', characteristics: ['Performance-oriented', 'Premium pricing'] },
  competitors: [
    { id: 'c1', name: 'Nike', positioning: 'Elite athletic performance', products: ['Pro Compression Tights'], priceRange: 'premium', advertisingPatterns: ['Athlete testimonials'], evidenceIds: ['e1'] },
    { id: 'c2', name: 'Under Armour', positioning: 'Technical performance', products: ['HeatGear'], priceRange: 'premium', advertisingPatterns: ['Data-driven claims'], evidenceIds: ['e2'] },
  ],
  customerSignals: [
    { id: 's1', type: 'painPoint', text: 'Existing products feel too competition-oriented for recreational use.', evidenceIds: ['e3'] },
  ],
  advertisingPatterns: [
    { id: 'p1', pattern: 'Problem → Solution', description: 'Shows a common discomfort, then the product resolving it.', evidenceIds: ['e4'] },
  ],
  trends: [
    { id: 't1', trend: 'Recreational athleisure crossover', relevance: 'Compression wear increasingly worn outside training.' },
  ],
  opportunities: [
    { id: 'o1', opportunity: 'Performance-focused compression wear for recreational athletes', evidence: 'Major brands emphasize elite athletes; little recreational-lifestyle positioning found.', relatedCompetitorIds: ['c1', 'c2'], relatedSignalIds: ['s1'], evidenceIds: ['e5'] },
  ],
  // e1 carries a REAL sourceId (ws1, present in webSources below) to
  // exercise the Real Retrieval traceability chain: NODE -> EVIDENCE ->
  // real SOURCE -> URL (spec 14). Every other evidence object stays
  // honestly unsourced, matching what a partial real-retrieval result
  // actually looks like (not every claim gets backed).
  evidence: [
    { id: 'e1', claim: 'Elite athletic performance', sourceIds: ['ws1'], entityIds: ['c1'], evidenceType: 'competitor' },
    { id: 'e2', claim: 'Technical performance', sourceIds: [], entityIds: ['c2'], evidenceType: 'competitor' },
    { id: 'e3', claim: 'Existing products feel too competition-oriented for recreational use.', sourceIds: [], entityIds: ['s1'], evidenceType: 'customer' },
    { id: 'e4', claim: 'Shows a common discomfort, then the product resolving it.', sourceIds: [], entityIds: ['p1'], evidenceType: 'advertising' },
    { id: 'e5', claim: 'Major brands emphasize elite athletes; little recreational-lifestyle positioning found.', sourceIds: [], entityIds: ['o1', 'c1', 'c2', 's1'], evidenceType: 'opportunity' },
  ],
  confidence: 'moderate',
  sourceType: 'ai_synthesis',
  sourceDisclaimer: 'AI-synthesized general advertising patterns — not a live pull from any ad platform.',
  sources: [
    { id: 'ref-meta', title: 'Meta Ad Library', url: 'https://www.facebook.com/ads/library/', domain: 'facebook.com', sourceType: 'reference_tool', queried: false },
    { id: 'ref-google', title: 'Google Ads Transparency Center', url: 'https://adstransparency.google.com/', domain: 'adstransparency.google.com', sourceType: 'reference_tool', queried: false },
  ],
  // Real Retrieval fixture — simulates a successful live-search response
  // shape (Research Production Sprint). Never exercised via a live call
  // in this suite (no live/paid testing) — purely a rendering fixture.
  webSources: [
    { id: 'ws1', title: 'Nike Compression Apparel', url: 'https://nike.com/compression', domain: 'nike.com', sourceType: 'web', query: 'premium compression shirts', retrievedAt: new Date().toISOString(), publishedDate: '2025-01-01' },
  ],
  retrieval: { performed: true, ok: true, provider: 'aimlapi', model: 'perplexity/sonar', query: 'premium compression shirts', sourceCount: 1, reason: null },
};

async function renderFixture(page) {
  await page.evaluate((data) => {
    window._researchLastResult = data;
    window._researchChatHistory = [];
    _rmapRender(data);
    _researchSetState('researchMapView');
    document.getElementById('researchFollowupRow').style.display = '';
  }, FIXTURE);
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let user;
  try {
    user = await createTestUser('a');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    await signIn(page, user);
    await page.evaluate(() => { _orvNav('research', 'page-research'); });
    await page.waitForTimeout(400);

    // 1. Empty state (Research Final Polish sprint: example prompt chips were
    // deliberately removed — spec section 8, "the user should simply ask
    // what they want to investigate," not be nudged toward invented
    // "recommended questions"). Research Launchpad pass: the old single
    // ".rsc-hero-sub" capability sentence ("Investigate competitors,
    // advertising, audiences, trends, or opportunities.") was removed —
    // the 4 real investigation starters now communicate that capability
    // more concretely, and a new short outcome line (.rsc-outcome-line,
    // "ORIVEN researches the web, connects evidence, and builds your
    // Market Map.") replaced it as the one honest helper line.
    const empty = await page.evaluate(() => ({
      emptyVisible: document.getElementById('researchEmptyState').style.display !== 'none',
      mapHidden: document.getElementById('researchMapView').style.display === 'none',
      hasHeroInput: document.getElementById('researchQueryInput').tagName === 'TEXTAREA',
      exampleCount: document.querySelectorAll('.rsc-example-chip').length,
      hasHelperLine: !!document.querySelector('.rsc-outcome-line') && document.querySelector('.rsc-outcome-line').textContent.trim().length > 0,
    }));
    check('1. Empty state: hero prompt visible, map hidden, no fabricated example prompts, single honest outcome line', empty.emptyVisible && empty.mapHidden && empty.hasHeroInput && empty.exampleCount === 0 && empty.hasHelperLine, empty);

    // 1b. Background/theme consistency (Research Final Polish sprint) — the
    // page used to be forced dark unconditionally, a jarring mismatch
    // against the app's real (light, by default) theme. It must now match
    // the same .mc background every other product page uses, and follow
    // body.dark-mode like everything else, while the Market Map canvas
    // itself is allowed to stay deliberately dark (its own Investigation
    // Canvas identity, same precedent as .biz-canvas).
    const themeCheck = await page.evaluate(() => {
      const mcBg = getComputedStyle(document.querySelector('.mc')).backgroundColor;
      const pageBg = getComputedStyle(document.getElementById('page-research')).backgroundColor;
      return { mcBg, pageBg, isDarkMode: document.body.classList.contains('dark-mode') };
    });
    check('1c. Research page background matches the shared .mc app background (light theme by default), not a forced-dark override', !themeCheck.isDarkMode && (themeCheck.pageBg === 'rgba(0, 0, 0, 0)' || themeCheck.pageBg === themeCheck.mcBg), themeCheck);

    // 1d-1j. Research Visual Polish sprint (header) + Investigation Workspace
    // pass (composer). NOTE on 1h/1i: the first Living Surface pass measured
    // the composer as a large, vertically-centered hero element filling the
    // page — deliberately replaced by this pass with a compact, top-anchored
    // CONTROL BAR (direct critique: the centered giant textarea "was" the
    // workspace instead of being its entry point). 1h now checks "still
    // substantial, not a tiny box" against the new compact scale rather than
    // the old hero scale; 1i now checks the control bar spans the
    // instrument (a control-bar composition) instead of asserting the old
    // hero centering, which no longer describes the intended layout.
    const visualPolish = await page.evaluate(() => {
      const title = document.querySelector('.rsc-page-h1');
      const titleCs = title ? getComputedStyle(title) : null;
      // Create's own real .cr2-h1 rule, read directly rather than hardcoded,
      // so this check tracks the real reference value if it ever changes.
      const cr2H1Rule = Array.from(document.styleSheets).flatMap((ss) => {
        try { return Array.from(ss.cssRules); } catch (e) { return []; }
      }).find((r) => r.selectorText === '.cr2-h1');
      const textarea = document.getElementById('researchQueryInput');
      const taRect = textarea.getBoundingClientRect();
      const controlBar = document.querySelector('#researchInstrument .rsc-control-bar');
      const canvas = document.getElementById('researchCanvas');
      const cbRect = controlBar ? controlBar.getBoundingClientRect() : null;
      const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
      return {
        titleText: title ? title.textContent.trim() : null,
        titleFontSize: titleCs ? titleCs.fontSize : null,
        titleFontWeight: titleCs ? titleCs.fontWeight : null,
        cr2H1FontSize: cr2H1Rule ? cr2H1Rule.style.fontSize : null,
        cr2H1FontWeight: cr2H1Rule ? cr2H1Rule.style.fontWeight : null,
        hasEyebrow: !!document.querySelector('#page-research .rsc-hero-eyebrow'),
        // .intel-hdr2-sub is a shared class other pages (Autopilot, Business
        // Map) still legitimately use — scoped to #page-research only, since
        // every page's markup lives in the DOM at once in this SPA.
        hasOldSubtitle: !!document.querySelector('#page-research .intel-hdr2-sub'),
        headerHasBorder: (() => { const h = document.querySelector('#page-research .rsc-page-hdr'); return h ? getComputedStyle(h).borderBottomWidth !== '0px' : false; })(),
        textareaWidth: taRect.width,
        textareaHeight: taRect.height,
        // The control bar spans nearly the full canvas width (a real
        // "control bar of the instrument," not a narrow floating box).
        controlBarSpansCanvas: !!cbRect && !!canvasRect && (cbRect.width / canvasRect.width) > 0.85,
      };
    });
    check('1d. Research title uses the same font-size/weight as Create\'s own page title (.cr2-h1)', visualPolish.titleText === 'Research' && visualPolish.titleFontSize === visualPolish.cr2H1FontSize && visualPolish.titleFontWeight === visualPolish.cr2H1FontWeight, visualPolish);
    check('1e. Green INVESTIGATE eyebrow is removed', !visualPolish.hasEyebrow, visualPolish.hasEyebrow);
    check('1f. Old "Find what works before you spend." subtitle is removed', !visualPolish.hasOldSubtitle, visualPolish.hasOldSubtitle);
    check('1g. Header has no divider/border beneath it', !visualPolish.headerHasBorder, visualPolish.headerHasBorder);
    check('1h. Composer textarea is a real, usable control-bar input (real width, real height — not a token-sized box)', visualPolish.textareaWidth > 600 && visualPolish.textareaHeight > 55, { w: visualPolish.textareaWidth, h: visualPolish.textareaHeight });
    check('1i. The composer reads as the control bar of the instrument (spans the canvas width) rather than a narrow floating box', visualPolish.controlBarSpansCanvas, visualPolish.controlBarSpansCanvas);
    // Structural check, not a text-content regex — the helper line
    // legitimately says "competitors" as a real category description
    // (not a fabricated competitor), so this checks for the absence of
    // actual node/card/history elements instead of scanning prose.
    check('1j. No fabricated content (fake competitor cards, fake map nodes, fake recent-investigation cards) exists in the initial empty state', await page.evaluate(() => {
      const empty = document.getElementById('researchEmptyState');
      return !empty.querySelector('.rmap-node, .rsc-example-chip, [class*="recent-invest"], [class*="rsc-history"]');
    }), true);

    // ════════════════════════════════════════════════════════════════
    // Research Workspace (Living Surface pass) — the workspace canvas
    // must already exist as a real, structured object before the user
    // types anything, must not fabricate progress/data, and must stay
    // the SAME persistent shell across state transitions (never a fake
    // browser, never a fake percentage, never a fake timer).
    // ════════════════════════════════════════════════════════════════
    const workspaceReady = await page.evaluate(() => {
      const canvas = document.getElementById('researchCanvas');
      const cs = canvas ? getComputedStyle(canvas) : null;
      const rect = canvas ? canvas.getBoundingClientRect() : null;
      return {
        canvasExists: !!canvas,
        canvasVisible: !!canvas && cs.display !== 'none',
        canvasHasRealSize: !!rect && rect.width > 600 && rect.height > 300,
        chromeLabel: (document.getElementById('researchCanvasLabel') || {}).textContent,
        noPercentText: !/%\s*(complete|done)|progress:\s*\d/i.test(canvas ? canvas.textContent : ''),
        noFakeTimer: !document.querySelector('#researchCanvas [class*="timer"], #researchCanvas [class*="countdown"]'),
        envIsAriaHidden: (() => { const env = document.querySelector('.rsc-canvas-env'); return !env || env.getAttribute('aria-hidden') === 'true'; })(),
      };
    });
    check('W1. The workspace canvas exists, is visible, and is a genuinely large object BEFORE any query is submitted (not a tiny centered form)', workspaceReady.canvasExists && workspaceReady.canvasVisible && workspaceReady.canvasHasRealSize, workspaceReady);
    // W2 — Research UX/product pass: the READY state no longer announces
    // "Ready to investigate" as a loud status label (RESEARCH_CANVAS_CHROME.
    // researchEmptyState is now '' and the chrome row hides itself
    // entirely) — the composer itself already communicates readiness.
    // Superseded assertion updated to match the new intended behavior
    // rather than the old copy.
    check('W2. The canvas status chrome is honestly empty/hidden in the READY state (no loud "Ready to investigate" label)', workspaceReady.chromeLabel === '', workspaceReady.chromeLabel);
    check('W3. No fake percentage or countdown timer exists anywhere in the workspace', workspaceReady.noPercentText && workspaceReady.noFakeTimer, workspaceReady);
    check('W4. The decorative environmental structure is marked aria-hidden (never presented as data)', workspaceReady.envIsAriaHidden, workspaceReady.envIsAriaHidden);

    // ════════════════════════════════════════════════════════════════
    // Investigation Rail — REMOVED in the Research UX/product pass. The
    // prior 3-column rail (Sources/Findings/Market Map) rendered as
    // permanently-visible placeholder containers ("No sources yet" /
    // "Findings appear as evidence is analyzed" / "Built from your
    // investigation") at every pre-result state including READY —
    // exactly the "expose the result architecture before any result
    // exists" anti-pattern that pass exists to fix. These checks now
    // assert the REPLACEMENT: the rail markup genuinely doesn't exist,
    // none of its old placeholder copy appears anywhere on the page, and
    // the new compact composer tools (Add URL / Focus) are what occupies
    // the composer instead. Findings/Sources now have real, dedicated
    // surfaces INSIDE the completed workspace instead (see
    // research-ux-redesign.test.js for that coverage).
    // ════════════════════════════════════════════════════════════════
    const railGone = await page.evaluate(() => {
      const bodyText = document.getElementById('page-research').textContent;
      return {
        railExists: !!document.getElementById('researchRail'),
        oldPlaceholderTextGone: !/No sources yet|Findings appear as evidence is analyzed|Built from your investigation/.test(bodyText),
        hasAddUrlTool: !!document.getElementById('researchUrlAddBtn'),
        hasFocusToggle: !!document.getElementById('researchFocusToggleBtn'),
      };
    });
    check('W14. The old Investigation Rail no longer exists in the READY state', !railGone.railExists, railGone);
    check('W15. None of the rail\'s old empty-container placeholder copy appears anywhere on the page', railGone.oldPlaceholderTextGone, railGone);
    check('W16. The compact "+ Add URL" and "Focus" composer tools exist in its place', railGone.hasAddUrlTool && railGone.hasFocusToggle, railGone);

    // W5-W7. Investigating: the SAME canvas persists (not replaced by a
    // different container), and its status line tracks the real active
    // stage — the exact same data _researchSetActivityStage renders into
    // the activity feed, never a second, independently-invented source.
    // Driven directly through the real state functions (exactly what
    // researchSubmit itself calls) rather than a network-timed route, so
    // this is deterministic rather than racing a real/intercepted fetch.
    await page.evaluate(() => {
      _researchSetState('researchLoadingState');
      _researchSetActivityStage('analyzing');
    });
    const investigatingState = await page.evaluate(() => ({
      canvasStillPresent: !!document.getElementById('researchCanvas') && getComputedStyle(document.getElementById('researchCanvas')).display !== 'none',
      mapHidden: document.getElementById('researchMapView').style.display === 'none',
      chromeLabel: document.getElementById('researchCanvasLabel').textContent,
      dotActive: document.getElementById('researchCanvasDot').classList.contains('rsc-canvas-dot-active'),
      activityLabelMatchesChrome: (() => {
        const activeRow = document.querySelector('.rsc-activity-row-active .rsc-activity-label');
        return activeRow ? activeRow.textContent === document.getElementById('researchCanvasLabel').textContent : false;
      })(),
    }));
    check('W5. The same workspace canvas stays visible while investigating (state transition, not a page swap)', investigatingState.canvasStillPresent && investigatingState.mapHidden, investigatingState);
    check('W6. The canvas status line shows the real active stage, in sync with the real activity feed (same data, not a second invented label)', investigatingState.activityLabelMatchesChrome, investigatingState);
    check('W7. The canvas status dot reflects real in-progress state', investigatingState.dotActive, investigatingState.dotActive);

    // W17/W18 — Research UX/product pass: the rail (and railFindingsBody/
    // railSourcesBody) no longer exists (see W14 above), so "analyzing"
    // progress is now communicated ONLY through the real activity feed
    // (already verified honest/in-sync in W6/W7). These checks now
    // confirm the rail's removal holds during the investigating state
    // too (not just READY) and that starting a new investigation leaves
    // no orphaned rail DOM behind.
    const noRailWhileAnalyzing = await page.evaluate(() => !document.getElementById('researchRail') && !document.getElementById('railFindingsBody') && !document.getElementById('railSourcesBody'));
    check('W17. The removed rail stays removed during the investigating state too (no orphaned DOM)', noRailWhileAnalyzing, noRailWhileAnalyzing);

    await page.evaluate(() => { _researchNewSession(); });
    const noRailAfterNewSession = await page.evaluate(() => !document.getElementById('researchRail'));
    check('W18. Starting a new investigation leaves no rail DOM behind either', noRailAfterNewSession, noRailAfterNewSession);

    // W8. No-usable-data / error states: the same canvas hosts them too,
    // with an honest, real status label — never left showing "Ready to
    // investigate" while an error/no-result message is on screen.
    await page.evaluate(() => { _researchSetState('researchNoResultsState'); });
    const noResultsChrome = await page.evaluate(() => document.getElementById('researchCanvasLabel').textContent);
    check('W8. No-results state updates the canvas status line honestly (not left on "Ready")', noResultsChrome === 'No reliable results found', noResultsChrome);

    await page.evaluate(() => { _researchShowError('Research provider unavailable. Try again shortly.'); });
    const errorChrome = await page.evaluate(() => ({
      label: document.getElementById('researchCanvasLabel').textContent,
      dotError: document.getElementById('researchCanvasDot').classList.contains('rsc-canvas-dot-error'),
    }));
    check('W9. Error state updates the canvas status line and dot honestly', errorChrome.label === 'Investigation failed' && errorChrome.dotError, errorChrome);
    await page.evaluate(() => { _researchSetState('researchEmptyState'); });

    // W10. Reduced motion: the workspace and its status line remain fully
    // visible and correct — motion is disabled, not the content itself.
    const rmWsPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await signIn(rmWsPage, user);
    await rmWsPage.evaluate(() => { _orvNav('research', 'page-research'); });
    await rmWsPage.waitForTimeout(300);
    const rmWorkspace = await rmWsPage.evaluate(() => {
      const canvas = document.getElementById('researchCanvas');
      const cs = getComputedStyle(canvas);
      return { visible: cs.display !== 'none', opacity: parseFloat(cs.opacity), label: document.getElementById('researchCanvasLabel').textContent };
    });
    check('W10. Reduced motion: workspace canvas is immediately fully visible (opacity 1), not stuck invisible waiting on an animation', rmWorkspace.visible && rmWorkspace.opacity === 1 && rmWorkspace.label === '', rmWorkspace);
    await rmWsPage.close();

    check('JS errors during the Research Workspace walkthrough', jsErrors.length === 0, jsErrors);

    // 1k. Research UX Polish sprint — the title must sit VISIBLY centered on
    // the page's central axis (an earlier pass mistakenly argued "aligned
    // with the page wrapper" was enough; it left the title flush-left).
    // Checked geometrically against the real rendered position, not just a
    // text-align CSS property, and directly compared to Create's own H1
    // center, which must land on the same horizontal axis.
    const titleCenter = await page.evaluate(() => {
      const t = document.querySelector('.rsc-page-h1').getBoundingClientRect();
      const wrap = document.getElementById('researchPageWrap').getBoundingClientRect();
      return { titleCenterX: t.left + t.width / 2, wrapCenterX: wrap.left + wrap.width / 2 };
    });
    check('1k. Research title is genuinely, visibly horizontally centered on the page (not merely inside a consistently-aligned wrapper)', Math.abs(titleCenter.titleCenterX - titleCenter.wrapCenterX) < 2, titleCenter);

    // 1l-1q. Research Focus controls — real, optional scope pills matching
    // the actual structured categories the backend returns
    // (market/competitors/customerSignals/advertisingPatterns/trends/
    // opportunities — RMAP_CLUSTER_DEFS, app.html), never invented ones,
    // and never example prompts (they never touch the textarea).
    const focusInfo = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('.rsc-focus-pill'));
      return {
        count: pills.length,
        keys: pills.map((p) => p.dataset.focus).sort(),
        allAreButtons: pills.every((p) => p.tagName === 'BUTTON'),
        allHaveAriaPressed: pills.every((p) => p.getAttribute('aria-pressed') === 'false'),
        touchesTextarea: false, // verified behaviorally below, not structurally
      };
    });
    check('1l. Research Focus contains exactly the 6 real supported categories, no invented ones', focusInfo.count === 6 && JSON.stringify(focusInfo.keys) === JSON.stringify(['advertising', 'audience', 'competitors', 'market', 'opportunities', 'trends']), focusInfo.keys);
    check('1m. Focus controls are real, semantic buttons with aria-pressed (accessible toggle state), all unselected by default', focusInfo.allAreButtons && focusInfo.allHaveAriaPressed, focusInfo);

    // Research UX/product pass — Focus is now a compact disclosure
    // (default collapsed, see _researchFocusToggleOpen) rather than 6
    // permanently-visible pills, so the grid must be opened before any
    // pill can be interacted with. Covered in more detail (default
    // collapsed state, count-label update) in research-ux-redesign.test.js.
    await page.click('#researchFocusToggleBtn');
    await page.waitForSelector('.rsc-focus-pill[data-focus="advertising"]', { state: 'visible' });

    await page.click('.rsc-focus-pill[data-focus="advertising"]');
    const oneSelected = await page.evaluate(() => document.querySelector('.rsc-focus-pill[data-focus="advertising"]').getAttribute('aria-pressed'));
    check('1n. Clicking a focus pill selects it (aria-pressed=true) with a real accessible state change', oneSelected === 'true', oneSelected);

    await page.click('.rsc-focus-pill[data-focus="competitors"]');
    await page.click('.rsc-focus-pill[data-focus="trends"]');
    const multiSelected = await page.evaluate(() => Array.from(document.querySelectorAll('.rsc-focus-pill[aria-pressed="true"]')).map((p) => p.dataset.focus).sort());
    check('1o. Multiple focus areas can be selected simultaneously (not forced single-select)', JSON.stringify(multiSelected) === JSON.stringify(['advertising', 'competitors', 'trends']), multiSelected);

    // Deselect one, confirm real toggle-off
    await page.click('.rsc-focus-pill[data-focus="competitors"]');
    const afterDeselect = await page.evaluate(() => document.querySelector('.rsc-focus-pill[data-focus="competitors"]').getAttribute('aria-pressed'));
    check('1o2. Clicking a selected pill again deselects it', afterDeselect === 'false', afterDeselect);

    // 1p/1q. The selection never touches the textarea (not an example
    // prompt) and, when present, composes an honest addition onto the REAL
    // question sent to the real endpoint — verified by intercepting the
    // actual outgoing request body, not by reading client state alone.
    const beforeSubmitValue = await page.evaluate(() => document.getElementById('researchQueryInput').value);
    check('1p. Selecting focus areas never writes into the textarea (these are scope controls, not example prompts)', beforeSubmitValue === '', beforeSubmitValue);

    let capturedReq = null;
    await page.route('**/api/research/query', (route) => {
      capturedReq = route.request().postDataJSON();
      route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'test intercept — no real call made' }) });
    });
    await page.fill('#researchQueryInput', 'Research premium compression shirt advertising in Europe.');
    await page.click('#researchSubmitBtn');
    await page.waitForTimeout(400);
    check('1q. Selected focus areas are honestly composed into the real request sent to /api/research/query (advertising + trends, competitors was deselected above)', /Focus the investigation on: advertising and trends\.$/.test((capturedReq && capturedReq.question) || ''), capturedReq);
    await page.unroute('**/api/research/query');

    // Reset for the rest of the suite (new session clears both the
    // question and any focus selection — verified for real, not assumed).
    await page.evaluate(() => { _researchNewSession(); });
    const resetState = await page.evaluate(() => ({
      allDeselected: Array.from(document.querySelectorAll('.rsc-focus-pill')).every((p) => p.getAttribute('aria-pressed') === 'false'),
      textareaEmpty: document.getElementById('researchQueryInput').value === '',
    }));
    check('1q2. Starting a new investigation resets both the question and the focus selection', resetState.allDeselected && resetState.textareaEmpty, resetState);

    // 1r. With no focus selected (the default), the real request must be
    // byte-identical to what the user typed — focus is a pure opt-in
    // enhancement, never a required step.
    let capturedReqNoFocus = null;
    await page.route('**/api/research/query', (route) => {
      capturedReqNoFocus = route.request().postDataJSON();
      route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'test intercept — no real call made' }) });
    });
    await page.fill('#researchQueryInput', 'Research premium compression shirt advertising in Europe.');
    await page.click('#researchSubmitBtn');
    await page.waitForTimeout(400);
    check('1r. No focus selection sends the question completely unchanged (focus is optional, not a required form step)', capturedReqNoFocus && capturedReqNoFocus.question === 'Research premium compression shirt advertising in Europe.', capturedReqNoFocus);
    await page.unroute('**/api/research/query');
    await page.evaluate(() => { _researchNewSession(); });

    // 2. Prompt submission triggers a real request, never auto-fires
    const apiCalls = [];
    page.on('request', (req) => { if (req.url().includes('/api/research/query')) apiCalls.push(req.url()); });
    await page.fill('#researchQueryInput', 'Research premium compression shirts');
    check('2. No request fired before Start Research is clicked', apiCalls.length === 0, apiCalls.length);
    await page.click('#researchSubmitBtn');
    await page.waitForTimeout(300);
    check('2b. Clicking Start Research fires exactly one request (no accidental double-submit)', apiCalls.length === 1, apiCalls.length);

    // 6. Activity stages (real, sequential, no fake browsing labels)
    const activityHtml = await page.evaluate(() => document.getElementById('researchActivityFeed').innerHTML);
    check('6. Activity shows real stage labels, never fake browsing/searching claims', /Understanding research objective|Analyzing research|Structuring market map/.test(activityHtml) && !/Opening source|Reading page|Searching Google/i.test(activityHtml), activityHtml.replace(/\s+/g, ' ').slice(0, 200));

    await page.waitForTimeout(3500); // let the real (billing-blocked) request resolve to its honest error
    const afterSubmit = await page.evaluate(() => ({
      loadingHidden: document.getElementById('researchLoadingState').style.display === 'none',
      errorVisible: document.getElementById('researchErrorState').style.display !== 'none',
      errorText: document.getElementById('researchErrorState').textContent,
    }));
    check('3/4/5. Request validation + real error handling: honest end state reached, no raw stack trace exposed', afterSubmit.loadingHidden && afterSubmit.errorVisible && !/at\s+\S+\s+\(/.test(afterSubmit.errorText), afterSubmit);

    // 7-13, 20, 21: render from fixture and exercise the map
    await renderFixture(page);
    const mapState = await page.evaluate(() => ({
      mapVisible: document.getElementById('researchMapView').style.display !== 'none',
      nodeCount: document.querySelectorAll('.rmap-node').length,
      edgeCount: document.querySelectorAll('.rmap-edge').length,
      filterCount: document.querySelectorAll('.rmap-filter-chip').length,
      srSummary: document.getElementById('researchMapSrSummary').textContent,
    }));
    check('7. Market map renders real nodes/edges from structured data', mapState.mapVisible && mapState.nodeCount > 8 && mapState.edgeCount > 8, mapState);
    check('7b. Accessible text-alternative summary populated (info not visual-only)', mapState.srSummary.length > 20, mapState.srSummary.slice(0, 60));

    // W11. The pre-result workspace canvas is hidden once the Market Map
    // (which supplies its own already-dark .rsc-map-stage) is the active
    // state — the two must never visually double up.
    const canvasHiddenForMap = await page.evaluate(() => getComputedStyle(document.getElementById('researchCanvas')).display === 'none');
    check('W11. The pre-result workspace canvas is hidden while the Market Map is showing (no doubled-up canvas chrome)', canvasHiddenForMap, canvasHiddenForMap);

    // W19. Restrained real-evidence legend around the completed Map — real
    // counts read directly off the fixture's own array lengths (2
    // competitors, 1 each of signal/pattern/trend/opportunity, 1 real web
    // source), never invented, never duplicating every result.
    const legend = await page.evaluate(() => document.getElementById('researchMapLegend').textContent);
    check('W19. Map legend shows the real source count and real per-category finding counts from the actual response', /1 source/.test(legend) && /2 Competitors/.test(legend) && /1 Signal/.test(legend) && /1 Pattern/.test(legend) && /1 Trend/.test(legend) && /1 Opportunity/.test(legend), legend);

    // W20. Category color reuse — the Map's own node coloring now reuses
    // the SAME real domain palette Business Intelligence's cards use for
    // these exact concepts, purely additive (no change to node
    // count/position/interaction — already exercised by checks 7-21 above).
    const nodeColors = await page.evaluate(() => {
      const cs = (sel) => { const el = document.querySelector(sel + ' circle'); return el ? getComputedStyle(el).stroke : null; };
      return {
        competitor: cs('.rmap-node-competitor'),
        signal: cs('.rmap-node-signal'),
        pattern: cs('.rmap-node-pattern'),
        trend: cs('.rmap-node-trend'),
      };
    });
    check('W20. Map nodes carry real per-category color (Competitors/Signals/Patterns/Trends each visually distinct, reusing the established ORIVEN domain palette)', nodeColors.competitor === 'rgb(96, 165, 250)' && nodeColors.signal === 'rgb(250, 204, 21)' && nodeColors.pattern === 'rgb(52, 211, 153)' && nodeColors.trend === 'rgb(249, 115, 22)', nodeColors);

    // 8. Node selection + evidence panel + honest unsourced label
    await page.evaluate(() => document.querySelector('.rmap-node[data-id="o1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForTimeout(300);
    const detail = await page.evaluate(() => document.getElementById('researchMapDetail').textContent);
    check('8. Node selection opens detail panel with real evidence claim text', detail.includes('Major brands emphasize elite athletes'), detail.slice(0, 120));
    check('13. Evidence panel honestly labels unsourced claims (no fabricated citation)', detail.includes('General AI synthesis') || detail.includes('no live source'), detail.includes('General AI synthesis'));

    // 10. Connected relationships (chain chips)
    const chainCount = await page.evaluate(() => document.querySelectorAll('.rmap-chain-chip').length);
    check('10. Connected relationships shown as a real, clickable chain', chainCount >= 3, chainCount);
    await page.click('.rmap-detail-close');

    // Real Retrieval traceability chain (spec 14): NODE -> EVIDENCE -> real SOURCE -> URL
    await page.evaluate(() => document.querySelector('.rmap-node[data-id="c1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForTimeout(300);
    const sourcedDetail = await page.evaluate(() => {
      const panel = document.getElementById('researchMapDetail');
      const link = panel.querySelector('.rmap-evidence-source-link');
      return { hasSourcedLabel: panel.textContent.includes('Sourced from'), linkHref: link ? link.getAttribute('href') : null, linkText: link ? link.textContent : null };
    });
    check('Real Retrieval: a node with a genuine sourceId shows a clickable "Sourced from" link with the real URL (traceability: node -> evidence -> source -> URL)', sourcedDetail.hasSourcedLabel && sourcedDetail.linkHref === 'https://nike.com/compression' && sourcedDetail.linkText === 'Nike Compression Apparel', sourcedDetail);
    await page.click('.rmap-detail-close');

    // 9. Focus mode (re-select a node since the panel was just closed above)
    await page.evaluate(() => document.querySelector('.rmap-node[data-id="o1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForTimeout(300);
    await page.click('.rmap-focus-btn');
    await page.waitForTimeout(300);
    const focused = await page.evaluate(() => ({
      hasFocusedClass: document.getElementById('researchMapCanvasWrap').classList.contains('rmap-focused'),
      btnLabel: document.querySelector('.rmap-focus-btn').textContent,
    }));
    check('9. Focus mode toggles on and reframes the view to the selected neighborhood', focused.hasFocusedClass && /show full map/i.test(focused.btnLabel), focused);
    await page.click('.rmap-focus-btn');
    await page.waitForTimeout(200);
    const unfocused = await page.evaluate(() => document.getElementById('researchMapCanvasWrap').classList.contains('rmap-focused'));
    check('9b. Focus mode toggles back off', !unfocused, unfocused);

    await page.click('.rmap-detail-close');
    await page.waitForTimeout(200);

    // 11/12. Filters + Opportunity mode
    await page.click('.rmap-filter-chip[data-filter="opportunity"]');
    await page.waitForTimeout(300);
    const oppFilter = await page.evaluate(() => ({
      opportunityVisible: !document.querySelector('.rmap-node-opportunity').classList.contains('rmap-node-filtered-out'),
      competitorHidden: document.querySelector('.rmap-node-competitor').classList.contains('rmap-node-filtered-out'),
      marketVisible: !document.querySelector('.rmap-node-market').classList.contains('rmap-node-filtered-out'),
    }));
    check('11/12. Opportunity Mode: filtering to Opportunities isolates them on the map (market stays visible as anchor)', oppFilter.opportunityVisible && oppFilter.competitorHidden && oppFilter.marketVisible, oppFilter);
    await page.click('.rmap-filter-chip[data-filter="all"]');
    await page.waitForTimeout(300);

    // 14. Sources panel — distinguishes real retrieved Sources from static Reference Tools
    await page.click('#researchSourcesBtn');
    await page.waitForTimeout(300);
    const sourcesHtml = await page.evaluate(() => document.getElementById('researchMapSourcesPanel').innerHTML);
    check('14. Sources panel labels reference tools distinctly, never as verified citations', /Reference tool/i.test(sourcesHtml) && sourcesHtml.includes('facebook.com'), sourcesHtml.includes('Reference tool'));
    check('14b. Real Retrieval: Sources panel shows a separate real "Sources" section (webSources) distinct from Reference Tools, with the real domain/title/url', /"rmap-sources-hd">Sources</.test(sourcesHtml) && sourcesHtml.includes('nike.com') && sourcesHtml.includes('Nike Compression Apparel'), sourcesHtml.includes('nike.com'));
    await page.click('#researchSourcesBtn');

    // 15. Follow-up question (grounded, real endpoint call)
    await page.fill('#researchFollowupInput', 'Show me only opportunities');
    await page.click('.rsc-send-btn:near(#researchFollowupInput)').catch(() => {});
    await page.evaluate(() => researchFollowup());
    await page.waitForTimeout(300);
    const filterActiveAfterFollowup = await page.evaluate(() => document.querySelector('.rmap-filter-chip[data-filter="opportunity"]').classList.contains('rmap-filter-chip-active'));
    check('15. "Show me only opportunities" follow-up applies a real client-side filter (no wasted AI call for something the map already answers)', filterActiveAfterFollowup, filterActiveAfterFollowup);
    await page.click('.rmap-filter-chip[data-filter="all"]');

    // 16. No-live-web-per-followup fallback — honest static message, no invented evidence
    await page.fill('#researchFollowupInput', 'Find more evidence for this online');
    await page.evaluate(() => researchFollowup());
    await page.waitForTimeout(300);
    const noWebMsg = await page.evaluate(() => document.getElementById('researchFollowupAnswer').textContent);
    check('16. A follow-up requiring a NEW live web search gets an honest message (doesn\'t run automatically per follow-up), not invented evidence', /new live web search|start a new research/i.test(noWebMsg), noWebMsg);

    // 20/21. No dangling ids / no fabricated source references (structural check on the fixture as rendered)
    const integrity = await page.evaluate(() => {
      const ids = Object.keys(window._rmapById || {});
      const edges = (window._rmapGraph && window._rmapGraph.edges) || [];
      const danglingEdges = edges.filter((e) => !window._rmapById[e.from] || !window._rmapById[e.to]);
      const evidence = Object.values(window._rmapEvidenceById || {});
      const fabricatedSources = evidence.filter((e) => (e.sourceIds || []).some((sid) => !window._rmapSourceById[sid]));
      return { danglingEdgeCount: danglingEdges.length, fabricatedSourceCount: fabricatedSources.length, nodeIdCount: ids.length };
    });
    check('20. No dangling edge references in the rendered graph', integrity.danglingEdgeCount === 0, integrity);
    check('21. No evidence references a source id that does not exist (no fabricated source references)', integrity.fabricatedSourceCount === 0, integrity);

    // ════════════════════════════════════════════════════════════════
    // Market Map Analysis pass — hover tooltip, focus/dim, escape/empty-
    // space reset, filter+selection interaction, opportunity emphasis,
    // relationship honesty. Reset to a known state first (filter "all",
    // nothing selected) since these checks must not depend on whatever
    // state earlier checks left behind.
    // ════════════════════════════════════════════════════════════════
    await page.evaluate(() => { window._rmapCloseDetail(); window._rmapSetFilter('all', document.querySelector('.rmap-filter-chip[data-filter="all"]')); });
    await page.waitForTimeout(300);

    // J. No fabricated relationships — only the two edge kinds the real
    // backend genuinely supports exist: structural (cluster hierarchy)
    // and evidence (opportunity -> its own real relatedCompetitorIds/
    // relatedSignalIds). No competitor->pattern, competitor->signal,
    // trend->opportunity, or pattern->opportunity edge exists, because
    // the real /api/research/query response has no ID-level field
    // connecting those — inventing one would violate spec 6/15.
    const edgeKinds = await page.evaluate(() => {
      const edges = window._rmapGraph.edges;
      const byId = window._rmapById;
      const kinds = [...new Set(edges.map((e) => e.kind))];
      const evidenceEdges = edges.filter((e) => e.kind === 'evidence').map((e) => [byId[e.from].type, byId[e.to].type].sort().join('-'));
      return { kinds, evidenceEdgeTypePairs: [...new Set(evidenceEdges)] };
    });
    check('J. Only real, backend-supported edge kinds exist (structure + evidence), no invented relationship types', JSON.stringify(edgeKinds.kinds.sort()) === JSON.stringify(['evidence', 'structure']), edgeKinds);
    check('J2. Evidence edges only ever connect opportunity<->competitor or opportunity<->signal (the only two real ID-validated relationships this backend provides)', edgeKinds.evidenceEdgeTypePairs.every((p) => p === 'competitor-opportunity' || p === 'opportunity-signal'), edgeKinds);

    // L. A node with no evidence-relationship (the trend node, t1) still
    // opens a valid, real detail panel — its only real connection is
    // structural (its own cluster), never a fabricated one.
    await page.evaluate(() => document.querySelector('.rmap-node[data-id="t1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForTimeout(250);
    const trendDetail = await page.evaluate(() => ({
      title: document.querySelector('.rmap-detail-title').textContent,
      hasRelevance: document.getElementById('researchMapDetail').textContent.includes('Compression wear increasingly worn outside training'),
      connectedChipLabels: Array.from(document.querySelectorAll('.rmap-chain-chip')).map((c) => c.textContent),
    }));
    check('L. A node without any evidence-relationship still opens a valid real detail panel (no crash, no fabricated relationship)', trendDetail.title === 'Recreational athleisure crossover' && trendDetail.hasRelevance && JSON.stringify(trendDetail.connectedChipLabels) === JSON.stringify(['Trends']), trendDetail);

    // A/B/C. Hover quick-context uses the SAME real data the detail panel
    // uses — never a second, independently-invented source.
    await page.evaluate(() => window._rmapCloseDetail());
    await page.hover('.rmap-node[data-id="c1"]');
    await page.waitForTimeout(150);
    const tooltip = await page.evaluate(() => ({
      visible: getComputedStyle(document.getElementById('researchMapTooltip')).display !== 'none',
      name: document.querySelector('.rmap-tooltip-name').textContent,
      cat: document.querySelector('.rmap-tooltip-cat').textContent,
      sum: document.querySelector('.rmap-tooltip-sum').textContent,
      isDetailPanelOpen: document.getElementById('researchMapDetail').style.display !== 'none',
    }));
    check('A/C. Hovering a node reveals a real tooltip (name/category/real short summary matching the node\'s own detail-panel data)', tooltip.visible && tooltip.name === 'Nike' && tooltip.cat === 'Competitor' && tooltip.sum === 'Elite athletic performance', tooltip);
    check('Hover tooltip never opens/duplicates the full detail panel (lightweight, hover only)', !tooltip.isDetailPanelOpen, tooltip.isDetailPanelOpen);
    await page.mouse.move(20, 20);
    await page.waitForTimeout(150);
    const tooltipHidden = await page.evaluate(() => getComputedStyle(document.getElementById('researchMapTooltip')).display === 'none');
    check('Tooltip hides on mouseleave (lightweight, not a lingering overlay)', tooltipHidden, tooltipHidden);

    // D/E. Focus mode: selecting a node clearly marks it, keeps directly
    // connected nodes visible, and dims (not hides) unrelated ones.
    await page.evaluate(() => document.querySelector('.rmap-node[data-id="o1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForTimeout(250);
    const focusState = await page.evaluate(() => ({
      oActive: document.querySelector('.rmap-node[data-id="o1"]').classList.contains('rmap-node-active'),
      c1Dimmed: document.querySelector('.rmap-node[data-id="c1"]').classList.contains('rmap-node-dimmed'),
      c1Hidden: getComputedStyle(document.querySelector('.rmap-node[data-id="c1"]')).display === 'none',
      trendDimmed: document.querySelector('.rmap-node[data-id="t1"]').classList.contains('rmap-node-dimmed'),
      trendHidden: getComputedStyle(document.querySelector('.rmap-node[data-id="t1"]')).display === 'none',
      trendDimOpacity: getComputedStyle(document.querySelector('.rmap-node[data-id="t1"]')).opacity,
    }));
    check('D. Selecting a node clearly marks it as selected (rmap-node-active)', focusState.oActive, focusState.oActive);
    check('D2. Directly connected nodes remain fully visible, not dimmed (real relationship: o1 -> c1)', !focusState.c1Dimmed && !focusState.c1Hidden, focusState);
    check('E. Unrelated nodes dim significantly but remain contextually visible (not hidden entirely)', focusState.trendDimmed && !focusState.trendHidden && parseFloat(focusState.trendDimOpacity) < 0.5 && parseFloat(focusState.trendDimOpacity) > 0, focusState);

    // G/H/I. Filter + selection interaction — selecting Opportunity, then
    // switching to a filter the Opportunity itself survives, must KEEP
    // the selection and recompute connections against the new visible
    // set (no ghost chips for now-hidden connections); switching to a
    // filter that hides the Opportunity itself must cleanly clear it.
    await page.click('.rmap-filter-chip[data-filter="opportunity"]');
    await page.waitForTimeout(300);
    const afterOppFilter = await page.evaluate(() => ({
      stillSelected: document.querySelector('.rmap-node[data-id="o1"]').classList.contains('rmap-node-active'),
      panelOpen: document.getElementById('researchMapDetail').style.display !== 'none',
      // o1's real connections are its own cluster header (still visible —
      // clusters carry the SAME filterKey as their category, so
      // cluster-opportunity legitimately survives the "opportunity"
      // filter) plus c1/c2/s1 (now hidden). Only the still-visible
      // cluster chip should remain; c1/c2/s1 must NOT appear as chips.
      chainChipLabels: Array.from(document.querySelectorAll('.rmap-chain-chip')).map((c) => c.textContent),
      c1FilteredOut: document.querySelector('.rmap-node[data-id="c1"]').classList.contains('rmap-node-filtered-out'),
    }));
    check('G. Filtering to a category the selected node still belongs to KEEPS the selection (real requirement: "select an Opportunity, then change filters — stay selected")', afterOppFilter.stillSelected && afterOppFilter.panelOpen, afterOppFilter);
    check('H/I. Connections hidden by the filter are removed from the detail panel too (no ghost chip for Nike/Under Armour/the signal, which the filter just hid)', !afterOppFilter.chainChipLabels.includes('Nike') && !afterOppFilter.chainChipLabels.includes('Under Armour') && afterOppFilter.c1FilteredOut, afterOppFilter);

    await page.click('.rmap-filter-chip[data-filter="competitor"]');
    await page.waitForTimeout(300);
    const afterCompFilter = await page.evaluate(() => ({
      panelOpen: document.getElementById('researchMapDetail').style.display !== 'none',
      anyNodeStillActive: !!document.querySelector('.rmap-node-active'),
      ghostEdges: Array.from(document.querySelectorAll('.rmap-edge:not(.rmap-edge-filtered-out)')).some((el) => {
        const f = document.querySelector('.rmap-node[data-id="' + el.getAttribute('data-from') + '"]');
        const t = document.querySelector('.rmap-node[data-id="' + el.getAttribute('data-to') + '"]');
        return (f && f.classList.contains('rmap-node-filtered-out')) || (t && t.classList.contains('rmap-node-filtered-out'));
      }),
    }));
    check('G2. Filtering the SELECTED node itself out cleanly clears the selection (nothing stays selected that is invisible)', !afterCompFilter.panelOpen && !afterCompFilter.anyNodeStillActive, afterCompFilter);
    check('I. No ghost edges remain visible after filtering (every visible edge has two visible endpoints)', !afterCompFilter.ghostEdges, afterCompFilter.ghostEdges);
    await page.click('.rmap-filter-chip[data-filter="all"]');
    await page.waitForTimeout(300);

    // F. Reset restores the full map — via Escape and via empty-space click.
    await page.evaluate(() => document.querySelector('.rmap-node[data-id="o1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForTimeout(250);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const afterEscape = await page.evaluate(() => ({
      panelOpen: document.getElementById('researchMapDetail').style.display !== 'none',
      anyActive: !!document.querySelector('.rmap-node-active'),
      anyDimmed: !!document.querySelector('.rmap-node-dimmed'),
    }));
    check('F/9. Escape resets the selection — closes the panel and restores normal map opacity/edge styling', !afterEscape.panelOpen && !afterEscape.anyActive && !afterEscape.anyDimmed, afterEscape);

    await page.evaluate(() => document.querySelector('.rmap-node[data-id="c1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await page.waitForTimeout(250);
    const wrapBox = await page.locator('#researchMapCanvasWrap').boundingBox();
    await page.mouse.click(wrapBox.x + 15, wrapBox.y + 15); // real click inside the canvas wrap's own empty corner, not a node
    await page.waitForTimeout(250);
    const afterEmptyClick = await page.evaluate(() => ({
      panelOpen: document.getElementById('researchMapDetail').style.display !== 'none',
      anyActive: !!document.querySelector('.rmap-node-active'),
    }));
    check('F2/9b. Clicking empty map space also resets the selection', !afterEmptyClick.panelOpen && !afterEmptyClick.anyActive, afterEmptyClick);

    // M. Opportunity styling — a real, consistently-stronger visual
    // hierarchy (thicker stroke baseline + brighter/bolder label), not a
    // new invented score/confidence/rank.
    const oppStyle = await page.evaluate(() => {
      const oCircle = document.querySelector('.rmap-node-opportunity circle');
      const oLabel = document.querySelector('.rmap-node-opportunity .rmap-node-label');
      const genericCircle = document.querySelector('.rmap-node-trend circle');
      return {
        oStrokeWidth: getComputedStyle(oCircle).strokeWidth,
        genericStrokeWidth: getComputedStyle(genericCircle).strokeWidth,
        oLabelWeight: getComputedStyle(oLabel).fontWeight,
        noScoreText: !/\bscore\b|\bconfidence\b|\brank(ed|ing)?\b|%/i.test(document.querySelector('.rmap-node-opportunity').closest('svg').outerHTML.includes('rmap-node-opportunity') ? (document.getElementById('researchMapDetail').textContent || '') : ''),
      };
    });
    check('M. Opportunity nodes carry a real, consistently stronger visual hierarchy than a generic node (thicker border, bolder label) — no invented score/confidence/rank', parseFloat(oppStyle.oStrokeWidth) > parseFloat(oppStyle.genericStrokeWidth) && parseInt(oppStyle.oLabelWeight, 10) >= 700 && oppStyle.noScoreText, oppStyle);

    // Q. No console errors from any of the above.
    check('No JS errors during the full Market Map interaction walkthrough', jsErrors.length === 0, jsErrors);

    // 18. Reduced motion — page must remain understandable, nothing stuck
    const rmPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await signIn(rmPage, user);
    await rmPage.evaluate(() => { _orvNav('research', 'page-research'); });
    await renderFixture(rmPage);
    const rmState = await rmPage.evaluate(() => ({
      mapVisible: document.getElementById('researchMapView').style.display !== 'none',
      nodeCount: document.querySelectorAll('.rmap-node').length,
    }));
    check('18. Reduced motion: map still renders fully and is fully understandable (no stuck/hidden state)', rmState.mapVisible && rmState.nodeCount > 8, rmState);

    // P. Reduced motion: selection/dim/focus is a state (class toggle),
    // not an animation, so it must work identically under reduced motion.
    await rmPage.evaluate(() => document.querySelector('.rmap-node[data-id="o1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await rmPage.waitForTimeout(150);
    const rmSelection = await rmPage.evaluate(() => ({
      oActive: document.querySelector('.rmap-node[data-id="o1"]').classList.contains('rmap-node-active'),
      c1Dimmed: document.querySelector('.rmap-node[data-id="t1"]').classList.contains('rmap-node-dimmed'),
      panelOpen: document.getElementById('researchMapDetail').style.display !== 'none',
    }));
    check('P. Reduced motion: selection/focus/dim state changes still work immediately and correctly (state, not motion)', rmSelection.oActive && rmSelection.c1Dimmed && rmSelection.panelOpen, rmSelection);
    await rmPage.close();

    // K. Sparse map — a low-data investigation (2 competitors + 1 trend
    // only, no signals/patterns/opportunities) must still render cleanly,
    // with no fabricated cross-links appearing just to fill the map out.
    const sparsePage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sparseErrors = []; sparsePage.on('pageerror', (e) => sparseErrors.push(e.message));
    await signIn(sparsePage, user);
    await sparsePage.evaluate(() => { _orvNav('research', 'page-research'); });
    const SPARSE_FIXTURE = {
      question: 'Sparse test', summary: 'Limited data available for this question.',
      market: { name: 'Niche Market', characteristics: [] },
      competitors: [{ id: 'sc1', name: 'Acme Co', positioning: 'Budget option', products: [], priceRange: 'low', advertisingPatterns: [], evidenceIds: [] }],
      customerSignals: [], advertisingPatterns: [],
      trends: [{ id: 'st1', trend: 'Niche growth', relevance: 'Small but growing segment.', evidenceIds: [] }],
      opportunities: [], evidence: [], sources: [], webSources: [],
      confidence: 'low', retrieval: { performed: false, ok: false, sourceCount: 0 },
    };
    await sparsePage.evaluate((data) => {
      window._researchLastResult = data; window._researchChatHistory = [];
      _rmapRender(data); _researchSetState('researchMapView');
    }, SPARSE_FIXTURE);
    await sparsePage.waitForTimeout(400);
    const sparseState = await sparsePage.evaluate(() => ({
      nodeCount: document.querySelectorAll('.rmap-node').length,
      edgeCount: document.querySelectorAll('.rmap-edge').length,
      evidenceEdgeCount: document.querySelectorAll('.rmap-edge-evidence').length,
      mapVisible: document.getElementById('researchMapView').style.display !== 'none',
    }));
    // Nodes: market + cluster-competitor + sc1 + cluster-trend + st1 = 5
    check('K. Sparse investigation (1 competitor + 1 trend, nothing else) still renders a clean, valid map', sparseState.mapVisible && sparseState.nodeCount === 5 && sparseState.edgeCount === 4, sparseState);
    check('K2. Sparse map has zero evidence edges (no opportunities exist to relate anything to — never fabricated to fill space)', sparseState.evidenceEdgeCount === 0, sparseState);
    await sparsePage.evaluate(() => document.querySelector('.rmap-node[data-id="sc1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await sparsePage.waitForTimeout(250);
    const sparseSelect = await sparsePage.evaluate(() => document.getElementById('researchMapDetail').style.display !== 'none');
    check('K3. A node in a sparse map is still fully selectable with a real, working detail panel', sparseSelect, sparseSelect);
    check('JS errors during sparse-map walkthrough', sparseErrors.length === 0, sparseErrors);
    await sparsePage.close();

    // 19/17. Mobile layout + follow-up input
    const mpage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await signIn(mpage, user);
    await mpage.evaluate(() => { _orvNav('research', 'page-research'); });
    await renderFixture(mpage);
    const mobileState = await mpage.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      mapVisible: document.getElementById('researchMapView').style.display !== 'none',
      followupVisible: document.getElementById('researchFollowupRow').offsetHeight > 0,
    }));
    check('17/19. Mobile: no horizontal overflow, map + follow-up input both usable', !mobileState.overflow && mobileState.mapVisible && mobileState.followupVisible, mobileState);
    await mpage.click('.rmap-node[data-id="c1"]');
    await mpage.waitForTimeout(300);
    const mobileDetail = await mpage.evaluate(() => {
      const panel = document.getElementById('researchMapDetail');
      const cs = getComputedStyle(panel);
      return { visible: panel.style.display !== 'none', isBottomSheet: cs.position === 'fixed' };
    });
    check('19b. Mobile: node detail becomes a bottom sheet (position:fixed), not an off-screen floating panel', mobileDetail.visible && mobileDetail.isBottomSheet, mobileDetail);

    // O. Mobile: real detail content is correct (tap gives the same real
    // data desktop click does), close works, and category is never
    // communicated by color alone (a real text label is always present).
    const mobileContent = await mpage.evaluate(() => ({
      title: document.querySelector('.rmap-detail-title').textContent,
      eyebrowText: document.querySelector('.rmap-detail-eyebrow').textContent,
    }));
    check('O. Mobile tap opens the same real node data as desktop click (title + real category text label, not color-only)', mobileContent.title === 'Nike' && mobileContent.eyebrowText === 'Competitor', mobileContent);
    await mpage.click('.rmap-detail-close');
    await mpage.waitForTimeout(250);
    const mobileClosed = await mpage.evaluate(() => document.getElementById('researchMapDetail').style.display === 'none');
    check('O2. Mobile: the close control works and is obvious (real close button, not hover-dependent)', mobileClosed, mobileClosed);
    await mpage.close();

    // 22. Accessibility basics
    const a11y = await page.evaluate(() => {
      const nodeEl = document.querySelector('.rmap-node');
      const svg = document.getElementById('researchMapSvg');
      const canvasWrap = document.getElementById('researchMapCanvasWrap');
      return {
        nodeHasAriaLabel: !!(nodeEl && nodeEl.getAttribute('aria-label')),
        nodeIsFocusable: !!(nodeEl && nodeEl.getAttribute('tabindex') === '0'),
        svgHasRole: svg.getAttribute('role') === 'img' && !!svg.getAttribute('aria-label'),
        canvasWrapFocusable: canvasWrap.getAttribute('tabindex') === '0',
        sourceLinksHaveText: Array.from(document.querySelectorAll('.rmap-source-link')).every((a) => a.textContent.trim().length > 0),
      };
    });
    check('22. Accessibility: nodes are keyboard-focusable with real aria-labels, canvas is focusable, SVG has an accessible label', a11y.nodeHasAriaLabel && a11y.nodeIsFocusable && a11y.svgHasRole && a11y.canvasWrapFocusable, a11y);

    // W12. Restored session (Living Surface pass) — a returning user with
    // a real persisted result must land directly in the Market Map state,
    // inside the workspace, WITHOUT the pre-result canvas/activity stages
    // ever appearing first (no fake "preparing/analyzing/mapping" replay
    // for research that already genuinely completed).
    const restorePage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const restoreErrors = []; restorePage.on('pageerror', (e) => restoreErrors.push(e.message));
    await signIn(restorePage, user);
    await restorePage.evaluate((data) => {
      if (typeof window._orvSaveResearchSession === 'function') window._orvSaveResearchSession(data);
    }, FIXTURE);
    await restorePage.reload({ waitUntil: 'domcontentloaded' });
    await restorePage.evaluate(async () => {
      const { data: { user } } = await window.SB.auth.getUser();
      window._currentUser = user;
      if (typeof _loadUserProfile === 'function') await _loadUserProfile(user);
    });
    await restorePage.waitForTimeout(700);
    await restorePage.evaluate(() => { _orvNav('research', 'page-research'); });
    // Deliberately a very short wait — restore fires via the same
    // setTimeout(fn,0) pattern every other page's post-nav init uses, so
    // this checks the state reached almost immediately, not after giving
    // any fake stage time to run.
    await restorePage.waitForTimeout(150);
    const restored = await restorePage.evaluate(() => ({
      mapVisible: document.getElementById('researchMapView').style.display !== 'none',
      canvasHidden: getComputedStyle(document.getElementById('researchCanvas')).display === 'none',
      nodeCount: document.querySelectorAll('.rmap-node').length,
      activityFeedEmpty: (document.getElementById('researchActivityFeed').textContent || '').trim() === '' ||
        !/Understanding research objective|Analyzing research|Structuring market map/.test(document.getElementById('researchActivityFeed').textContent),
    }));
    check('W12. Restored session lands directly in the Market Map (workspace canvas hidden, no empty-state detour needed to be waited out)', restored.mapVisible && restored.canvasHidden && restored.nodeCount > 8, restored);
    check('W13. Restore never replays the fake preparing/analyzing/mapping activity stages for already-completed research', restored.activityFeedEmpty, restored.activityFeedEmpty);

    // N. New node interactions (selection, focus/dim, filter continuity)
    // work correctly on a RESTORED map, not only on a freshly-rendered
    // one — and the detail panel legitimately starts closed (no invented
    // persisted-selection state; this product does not store one).
    const restoredDetailStartsClosed = await restorePage.evaluate(() => document.getElementById('researchMapDetail').style.display === 'none');
    check('N. Restored session: detail panel starts closed (no fabricated persisted-selection state)', restoredDetailStartsClosed, restoredDetailStartsClosed);
    await restorePage.evaluate(() => document.querySelector('.rmap-node[data-id="o1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await restorePage.waitForTimeout(250);
    const restoredSelect = await restorePage.evaluate(() => ({
      panelOpen: document.getElementById('researchMapDetail').style.display !== 'none',
      title: document.querySelector('.rmap-detail-title').textContent,
      c1Visible: !document.querySelector('.rmap-node[data-id="c1"]').classList.contains('rmap-node-dimmed'),
    }));
    check('N2. Node selection on a restored map works correctly with real data (same as a freshly-rendered map)', restoredSelect.panelOpen && restoredSelect.title.includes('Performance-focused') && restoredSelect.c1Visible, restoredSelect);
    await restorePage.click('.rmap-legend-item-btn');
    await restorePage.waitForTimeout(300);
    const restoredLegendFilter = await restorePage.evaluate(() => document.querySelector('.rmap-filter-chip-active').getAttribute('data-filter'));
    check('Finding -> Map continuity: clicking a real legend item on a restored map applies the matching real category filter', !!restoredLegendFilter && restoredLegendFilter !== 'all', restoredLegendFilter);
    check('JS errors during restore walkthrough', restoreErrors.length === 0, restoreErrors);
    await restorePage.close();

    console.log(`\n${results.length} checks run, ${results.filter((r) => r.ok).length} passed, ${results.filter((r) => !r.ok).length} failed.`);
    if (results.some((r) => !r.ok)) process.exitCode = 1;
  } finally {
    if (user) await deleteTestUser(user.userId);
    await browser.close();
  }
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
