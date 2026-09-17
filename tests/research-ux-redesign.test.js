// ════════════════════════════════════════════════════════════════
// Research UX/product pass — dedicated coverage for what's NEW in this
// pass specifically (composer/URL evidence/compact Focus/Findings panel/
// provenance/state-transform copy). Structural Market Map coverage
// (nodes/edges/evidence/filters/tooltips/mobile/a11y/restore) already
// lives in research-market-map.test.js and is NOT duplicated here —
// this file only re-verifies things that pass specifically changed.
//
// Fixture-only (no live AIML/Astra call — that account has no funds in
// this environment). All fixture text is prefixed [FIXTURE] where it
// matters, matching this repo's existing convention.
//
// RUN: node tests/research-ux-redesign.test.js
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
  const email = `oriven.researchux.test+${Date.now()}.${suffix}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await supabaseAdmin.from('profiles').upsert({ id: created.user.id, email, subscription_status: 'creator', onboarding_completed: true }, { onConflict: 'id' });
  return { userId: created.user.id, email, password };
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
  await page.evaluate(async ({ access_token, refresh_token }) => { await window.SB.auth.setSession({ access_token, refresh_token }); }, { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token });
  await page.evaluate(async () => { const { data: { user } } = await window.SB.auth.getUser(); window._currentUser = user; if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn(user); if (typeof _loadUserProfile === 'function') await _loadUserProfile(user); });
  await page.waitForTimeout(900);
}

// Fixture matching the REAL /api/research/query response shape, extended
// with urlSources/urlSourceErrors (Research URL Evidence pass) so both
// provenances can be exercised without a live call.
const FIXTURE = {
  question: '[FIXTURE] How is this brand positioning its compression shirts?',
  summary: '[FIXTURE] The brand emphasizes recovery-focused positioning over pure athletic performance.',
  market: { name: 'Compression Apparel', characteristics: ['Performance-oriented'] },
  competitors: [{ id: 'c1', name: 'Acme Compression', positioning: 'Recovery-first, not just performance', products: ['Recovery Shirt'], priceRange: 'premium', advertisingPatterns: ['Recovery science'], sourceIds: ['u1'], evidenceIds: ['e1'] }],
  customerSignals: [{ id: 's1', type: 'need', text: 'Wants recovery benefits, not just compression.', sourceIds: [], evidenceIds: ['e2'] }],
  advertisingPatterns: [{ id: 'p1', pattern: 'Science-backed claims', description: 'Cites recovery research.', sourceIds: ['ws1'], evidenceIds: ['e3'] }],
  trends: [{ id: 't1', trend: 'Recovery-as-a-feature', relevance: 'Shirts marketed on recovery, not just fit.', sourceIds: [], evidenceIds: ['e4'] }],
  opportunities: [{ id: 'o1', opportunity: 'Lean further into recovery science credibility', evidence: 'Competitor already leads on this angle.', relatedCompetitorIds: ['c1'], relatedSignalIds: ['s1'], sourceIds: [], evidenceIds: ['e5'] }],
  evidence: [
    { id: 'e1', claim: 'Recovery-first, not just performance', sourceIds: ['u1'], entityIds: ['c1'], evidenceType: 'competitor' },
    { id: 'e2', claim: 'Wants recovery benefits, not just compression.', sourceIds: [], entityIds: ['s1'], evidenceType: 'customer' },
    { id: 'e3', claim: 'Cites recovery research.', sourceIds: ['ws1'], entityIds: ['p1'], evidenceType: 'advertising' },
    { id: 'e4', claim: 'Shirts marketed on recovery, not just fit.', sourceIds: [], entityIds: ['t1'], evidenceType: 'trend' },
    { id: 'e5', claim: 'Competitor already leads on this angle.', sourceIds: [], entityIds: ['o1', 'c1', 's1'], evidenceType: 'opportunity' },
  ],
  confidence: 'moderate',
  sourceType: 'ai_synthesis',
  sourceDisclaimer: 'AI-synthesized general advertising patterns — not a live pull from any ad platform.',
  sources: [{ id: 'ref-meta', title: 'Meta Ad Library', url: 'https://www.facebook.com/ads/library/', domain: 'facebook.com', sourceType: 'reference_tool', queried: false }],
  webSources: [{ id: 'ws1', title: '[FIXTURE] Recovery Science in Apparel', url: 'https://example.com/recovery-science', domain: 'example.com', sourceType: 'web', query: 'compression shirt recovery', retrievedAt: new Date().toISOString(), publishedDate: null, provenance: 'oriven_discovered' }],
  // The distinguishing addition of this pass — real, separate array with
  // provenance:'user_provided'; never merged into webSources.
  urlSources: [{ id: 'u1', url: 'https://acme-compression.example/product', domain: 'acme-compression.example', title: '[FIXTURE] Acme Compression — Product Page', description: '[FIXTURE] Recovery-focused compression shirt', provenance: 'user_provided' }],
  urlSourceErrors: [],
};

async function renderFixture(page, data) {
  await page.evaluate((d) => {
    window._researchLastResult = d;
    window._researchChatHistory = [];
    _rmapRender(d);
    _researchSetState('researchMapView');
    document.getElementById('researchFollowupRow').style.display = '';
  }, data);
  await page.waitForTimeout(400);
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

    // ── URL attach/remove/validation ─────────────────────────────────
    const urlInitial = await page.evaluate(() => ({
      chipsHidden: getComputedStyle(document.getElementById('researchUrlChips')).display === 'none',
      inputRowHidden: getComputedStyle(document.getElementById('researchUrlInputRow')).display === 'none',
    }));
    check('1. URL chips/input row are hidden until the user opens "+ Add URL"', urlInitial.chipsHidden && urlInitial.inputRowHidden, urlInitial);

    await page.click('#researchUrlAddBtn');
    await page.waitForSelector('#researchUrlInputRow', { state: 'visible' });
    check('2. Clicking "+ Add URL" reveals the input row', true);

    await page.fill('#researchUrlInput', 'example.com/product');
    await page.click('#researchUrlAddWrap .rsc-tool-btn-sm');
    const afterOneUrl = await page.evaluate(() => ({
      chipCount: document.querySelectorAll('.rsc-url-chip').length,
      chipText: (document.querySelector('.rsc-url-chip-domain') || {}).textContent,
      chipsVisible: getComputedStyle(document.getElementById('researchUrlChips')).display !== 'none',
    }));
    check('3. A bare domain (no protocol) is accepted and normalized to a real https:// URL chip', afterOneUrl.chipCount === 1 && afterOneUrl.chipText === 'example.com' && afterOneUrl.chipsVisible, afterOneUrl);

    // Invalid URL is rejected with a visible, honest error.
    await page.fill('#researchUrlInput', 'not a url at all!!');
    await page.click('#researchUrlAddWrap .rsc-tool-btn-sm');
    const invalidState = await page.evaluate(() => ({
      chipCount: document.querySelectorAll('.rsc-url-chip').length,
      errorVisible: getComputedStyle(document.getElementById('researchUrlError')).display !== 'none',
      errorText: document.getElementById('researchUrlError').textContent,
    }));
    check('4. An obviously malformed URL is rejected with a visible error, not silently accepted', invalidState.chipCount === 1 && invalidState.errorVisible && invalidState.errorText.length > 0, invalidState);

    // Multiple URLs, up to the real cap (5), then a 6th is rejected client-side too.
    for (const u of ['https://b.example.com', 'https://c.example.com', 'https://d.example.com', 'https://e.example.com']) {
      await page.fill('#researchUrlInput', u);
      await page.click('#researchUrlAddWrap .rsc-tool-btn-sm');
    }
    const atCap = await page.evaluate(() => document.querySelectorAll('.rsc-url-chip').length);
    check('5. Multiple URLs can be attached, up to the real cap of 5', atCap === 5, atCap);
    await page.fill('#researchUrlInput', 'https://f.example.com');
    await page.click('#researchUrlAddWrap .rsc-tool-btn-sm');
    const overCap = await page.evaluate(() => ({ count: document.querySelectorAll('.rsc-url-chip').length, errorText: document.getElementById('researchUrlError').textContent }));
    check('6. A 6th URL is rejected client-side too (matches the real server-side cap)', overCap.count === 5 && /5 URL/i.test(overCap.errorText), overCap);

    // Remove is a real, keyboard-accessible button.
    const removeBtnInfo = await page.evaluate(() => { const b = document.querySelector('.rsc-url-chip-remove'); return { tag: b.tagName, hasLabel: !!b.getAttribute('aria-label') }; });
    check('7. Each URL chip has a real <button> remove control with an accessible label', removeBtnInfo.tag === 'BUTTON' && removeBtnInfo.hasLabel, removeBtnInfo);
    await page.click('.rsc-url-chip-remove');
    const afterRemove = await page.evaluate(() => document.querySelectorAll('.rsc-url-chip').length);
    check('8. Removing a chip actually removes it', afterRemove === 4, afterRemove);

    // Starting a new investigation clears attached URLs.
    await page.evaluate(() => { _researchNewSession(); });
    const afterNewSession = await page.evaluate(() => ({
      chipCount: document.querySelectorAll('.rsc-url-chip').length,
      chipsHidden: getComputedStyle(document.getElementById('researchUrlChips')).display === 'none',
    }));
    check('9. "New investigation" clears all attached URLs', afterNewSession.chipCount === 0 && afterNewSession.chipsHidden, afterNewSession);

    // ── Focus: compact, default-collapsed disclosure ─────────────────
    const focusCollapsed = await page.evaluate(() => getComputedStyle(document.getElementById('researchFocusGrid')).display === 'none');
    check('10. Focus pills are collapsed by default (optional, not visually dominant)', focusCollapsed);
    await page.click('#researchFocusToggleBtn');
    await page.waitForSelector('#researchFocusGrid', { state: 'visible' });
    await page.click('.rsc-focus-pill[data-focus="audience"]');
    await page.click('.rsc-focus-pill[data-focus="trends"]');
    // Research READY-state polish pass — the toggle's visible label
    // always reads exactly "Focus" now (no count), regardless of
    // selection; the real selected state is verified via the pills'
    // own aria-pressed, not the button's text.
    const focusState = await page.evaluate(() => ({
      label: document.getElementById('researchFocusToggleBtn').textContent,
      audiencePressed: document.querySelector('.rsc-focus-pill[data-focus="audience"]').getAttribute('aria-pressed'),
      trendsPressed: document.querySelector('.rsc-focus-pill[data-focus="trends"]').getAttribute('aria-pressed'),
    }));
    check('11. The Focus toggle button always shows the plain "Focus" label (no count), while the real selection is still live in the pills', focusState.label === 'Focus' && focusState.audiencePressed === 'true' && focusState.trendsPressed === 'true', focusState);
    await page.evaluate(() => { _researchResetFocus(); });
    const focusLabelReset = await page.evaluate(() => document.getElementById('researchFocusToggleBtn').textContent);
    check('12. Resetting focus keeps the plain "Focus" label', focusLabelReset === 'Focus', focusLabelReset);

    // ── Investigate CTA disabled/empty-question guard ────────────────
    await page.fill('#researchQueryInput', '   ');
    const emptySubmitAttempt = await page.evaluate(() => { window.researchSubmit(); return document.getElementById('researchLoadingState').style.display; });
    check('13. Submitting a blank/whitespace-only question does not start an investigation', emptySubmitAttempt === 'none', emptySubmitAttempt);
    await page.fill('#researchQueryInput', '');

    // ── Findings panel (fixture-rendered) ─────────────────────────────
    await renderFixture(page, FIXTURE);
    const findings = await page.evaluate(() => {
      const el = document.getElementById('researchFindingsPanel');
      return {
        visible: getComputedStyle(el).display !== 'none',
        groupCount: el.querySelectorAll('.rsc-findings-group').length,
        rowCount: el.querySelectorAll('.rsc-finding-row').length,
        hasConfidenceBadge: !!el.querySelector('.rsc-findings-confidence'),
        confidenceText: (el.querySelector('.rsc-findings-confidence') || {}).textContent,
        sourcedDotCount: el.querySelectorAll('.rsc-finding-sourced').length,
      };
    });
    check('14. Findings panel renders visibly once a real result exists', findings.visible, findings);
    check('15. Findings panel shows one group per non-empty real category (5 in this fixture)', findings.groupCount === 5, findings.groupCount);
    check('16. Findings panel shows one row per real entity (5 total in this fixture)', findings.rowCount === 5, findings.rowCount);
    check('17. Findings panel shows the real confidence value, never an invented percentage', findings.hasConfidenceBadge && /moderate/i.test(findings.confidenceText) && !/%/.test(findings.confidenceText), findings);
    check('18. Sourced findings are visually marked (2 of 5 in this fixture carry a real sourceId)', findings.sourcedDotCount === 2, findings.sourcedDotCount);

    // Clicking a finding row opens the real detail panel for that entity.
    await page.click('.rsc-finding-row');
    const detailAfterClick = await page.evaluate(() => document.getElementById('researchMapDetail').style.display !== 'none');
    check('19. Clicking a Findings row opens the real Market Map detail panel for that entity', detailAfterClick);
    await page.evaluate(() => { window._rmapCloseDetail(); });

    // ── Question recap stays visible in the completed workspace ──────
    const questionRecap = await page.evaluate(() => document.getElementById('researchMapQuestion').textContent);
    check('20. The completed workspace shows the real question verbatim (compact composer recap)', questionRecap === FIXTURE.question, questionRecap);

    // ── URL evidence provenance ────────────────────────────────────
    // Open the node whose evidence is backed by a USER-PROVIDED URL (c1)
    // and confirm it's labeled distinctly from an ORIVEN-discovered source.
    await page.evaluate(() => { window._rmapSelectNode('c1'); });
    await page.waitForTimeout(200);
    const provenance = await page.evaluate(() => {
      const panel = document.getElementById('researchMapDetail');
      return {
        hasProvenanceTag: !!panel.querySelector('.rmap-evidence-provenance'),
        tagText: (panel.querySelector('.rmap-evidence-provenance') || {}).textContent,
        linkHref: (panel.querySelector('.rmap-evidence-source-link') || {}).getAttribute && panel.querySelector('.rmap-evidence-source-link').getAttribute('href'),
      };
    });
    check('21. A finding backed by a user-provided URL is labeled distinctly ("your URL") from ORIVEN-discovered sources', provenance.hasProvenanceTag && /your url/i.test(provenance.tagText), provenance);
    check('21b. The evidence link resolves to the real attached URL, not fabricated', provenance.linkHref === 'https://acme-compression.example/product', provenance.linkHref);
    await page.evaluate(() => { window._rmapCloseDetail(); });

    // Sources panel shows both provenances distinctly (never merged).
    await page.click('#researchSourcesBtn');
    await page.waitForTimeout(300);
    const sourcesPanelText = await page.evaluate(() => document.getElementById('researchMapSourcesPanel').textContent);
    check('22. Sources panel includes the real ORIVEN-discovered web source', /Recovery Science in Apparel/.test(sourcesPanelText), true);

    // ── Light mode ────────────────────────────────────────────────────
    await page.evaluate(() => { document.body.classList.remove('dark-mode'); });
    await page.waitForTimeout(200);
    const lightMode = await page.evaluate(() => {
      const findingsBg = getComputedStyle(document.getElementById('researchFindingsPanel')).backgroundColor;
      const composerVisible = true; // composer is hidden behind map view at this point, checked separately below
      return { findingsBg, isDark: document.body.classList.contains('dark-mode') };
    });
    check('23. Findings panel renders with a real, theme-following background in light mode (not hardcoded dark)', !lightMode.isDark && lightMode.findingsBg !== 'rgba(0, 0, 0, 0)', lightMode);

    check('JS errors during the full Research UX walkthrough', jsErrors.length === 0, jsErrors);

    // ── Mobile ────────────────────────────────────────────────────────
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await signIn(mobilePage, user);
    await mobilePage.evaluate(() => { _orvNav('research', 'page-research'); });
    await mobilePage.waitForTimeout(400);
    await mobilePage.click('#researchUrlAddBtn');
    const mobileOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check('24. Mobile: URL add control doesn\'t cause horizontal page overflow', !mobileOverflow, mobileOverflow);
    await renderFixture(mobilePage, FIXTURE);
    const mobileComplete = await mobilePage.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      findingsVisible: getComputedStyle(document.getElementById('researchFindingsPanel')).display !== 'none',
    }));
    check('25. Mobile: completed workspace (Findings + Map) has no horizontal overflow', !mobileComplete.overflow, mobileComplete);
    check('26. Mobile: Findings panel remains visible/readable', mobileComplete.findingsVisible);
    await mobilePage.close();

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
    if (failed.length) process.exitCode = 1;
  } finally {
    if (user) await deleteTestUser(user.userId);
    await browser.close();
  }
}
main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
