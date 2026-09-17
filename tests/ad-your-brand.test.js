/* ════════════════════════════════════════════════════════════════
   Ad → Your Brand — deterministic, non-mutating test suite.

   HARD CONSTRAINT: no real Supabase users are created here. Uses the
   same DOM-state entry point onboarding-rebuild.test.js established
   (_guestOnSignedIn, guest.js — confirmed there to never call any
   Supabase API) with a fake, non-authenticated mock user object, plus a
   blanket network-level abort of any request that would reach Supabase.
   Every /api/create/analyze-reference call in this suite is intercepted
   via page.route() and answered locally with a canned response — nothing
   here ever reaches the real backend, the real AI provider, or spends a
   real credit. Credit-spending/generation routes are wired to fail
   loudly (500) if anything in this workflow ever reaches them, so a
   real regression shows up as a network-contract failure, not a silent
   "worked" pass.

   What this CANNOT verify (disclosed, not silently skipped — see the
   final report): the real AI analysis call actually producing a good
   JSON breakdown, the real vision call genuinely understanding an
   uploaded ad image, and the real SSRF protection as exercised through
   this specific route's HTTP layer (that protection was instead verified
   directly against services/urlContextFetcher.js — the same module this
   route calls — via a standalone Node script hitting real blocked/
   allowed addresses; see the final report).
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const SHOT_DIR = 'C:/files/tests/_shots/ad_your_brand';
require('fs').mkdirSync(SHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS — ' + name); }
  else { fail++; console.log('FAIL — ' + name + (detail !== undefined ? ' | ' + JSON.stringify(detail) : '')); }
}

const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mNk+M9QDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const SAMPLE_ANALYSIS = {
  hook: 'Immediate problem-first opening',
  angle: 'Speed and simplicity',
  structure: 'Problem to transformation to proof to CTA',
  creativeDirection: 'Minimal product-focused composition',
  ctaApproach: 'Low-friction action',
  tone: 'Direct, confident',
  audienceAddressed: 'Busy professionals',
  offerStructure: 'Free trial, no card required',
  persuasionMechanism: 'Social proof',
  socialProofStrategy: 'Customer count mentioned briefly',
  urgencyStrategy: null,
  format: 'Single image ad',
  distinctiveness: 'Contrast-heavy typography',
  sourceSpecificElements: ['Exact slogan wording', 'Distinctive logo mark'],
};

async function armPage(page, opts) {
  opts = opts || {};
  await page.route('**/*supabase.co/**', (route) => route.abort());
  await page.route('**/api/create/analyze-reference', (route) => {
    (opts.analyzeCalls || (opts.analyzeCalls = [])).push(JSON.parse(route.request().postData() || '{}'));
    if (opts.analyzeFails) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: opts.analyzeFails, code: opts.analyzeFailCode || 'insufficient_content' }) });
    }
    if (opts.analyzeNetworkError) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Could not analyze that reference right now.' }) });
    }
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, source: opts.source || { type: 'url', url: 'https://example.com/ad', domain: 'example.com', title: 'Example Ad' }, analysis: SAMPLE_ANALYSIS }),
    });
  });
  const forbidden = ['**/api/generate-image', '**/api/generate-campaign', '**/api/ai/create-ad', '**/api/research/query', '**/api/publish/*', '**/api/generate-ad', '**/api/generate-ugc-video'];
  for (const pat of forbidden) {
    await page.route(pat, (route) => { (opts.forbiddenCalls || (opts.forbiddenCalls = [])).push(route.request().url()); route.fulfill({ status: 500, body: '{}' }); });
  }
}

async function loadAndEnterCreate(page) {
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error' && !/favicon/i.test(msg.text())) consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));
  await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelector('.app') && (document.querySelector('.app').style.display = '');
    if (typeof _guestOnSignedIn === 'function') _guestOnSignedIn({ id: 'mock-ayb-test', email: 'mock@example.invalid' });
    if (typeof _orvNav === 'function') _orvNav('create', 'page-create');
  });
  await page.waitForTimeout(600);
  return consoleErrors;
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });

  // ── 1-20: Core URL-method flow, 1440 ─────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const opts = {};
    await armPage(page, opts);
    const consoleErrors = await loadAndEnterCreate(page);

    check('1. Ad → Your Brand button present', await page.locator('#ov3AybBtn').count() === 1);
    check('2. Panel hidden initially', await page.locator('#ov3AybPanel').evaluate(el => el.style.display === 'none'));
    check('3. Existing Attach Image control still present (composer not broken)', await page.locator('#ov3RefImgBtn').count() === 1);
    check('4. Existing Attach Product control still present', await page.locator('#ov3ProductBtn').count() === 1);
    check('5. Existing Your Page control still present', await page.locator('#ov3PageUrlBtn').count() === 1);
    check('6. Campaign Goal section still present (composer not broken)', await page.locator('.cr2-goal-section').count() >= 1);

    await page.click('#ov3AybBtn');
    await page.waitForTimeout(150);
    check('7. Panel opens on click', await page.locator('#ov3AybPanel').evaluate(el => el.style.display !== 'none'));
    check('8. aria-expanded true on open', await page.locator('#ov3AybBtn').getAttribute('aria-expanded') === 'true');
    check('9. Intro description is compact (not a giant panel)', (await page.locator('.cr2-ayb-desc').innerText()).length < 260);
    check('10. URL method active by default', await page.locator('#ov3AybMethodUrlBtn').evaluate(el => el.classList.contains('active')));
    await page.screenshot({ path: SHOT_DIR + '/01_panel_open_1440.png' });

    await page.fill('#ov3AybUrlInput', 'example.com/ad');
    await page.click('#ov3AybAnalyzeBtn');
    await page.waitForTimeout(400);
    check('11. Real request sent to analyze-reference with normalized URL', opts.analyzeCalls && opts.analyzeCalls[0] && opts.analyzeCalls[0].url === 'https://example.com/ad', opts.analyzeCalls);
    check('12. Result panel visible after mocked success', await page.locator('#ov3AybResult').evaluate(el => el.style.display !== 'none'));
    check('13. Intro hidden after successful analysis', await page.locator('#ov3AybIntro').evaluate(el => el.style.display === 'none'));

    const principleRows = await page.locator('.cr2-ayb-principle-row').count();
    check('14. Five principle rows rendered', principleRows === 5, principleRows);
    const hookText = await page.locator('.cr2-ayb-principle-row[data-key="hook"] .cr2-ayb-principle-val').innerText();
    check('15. Hook value matches real analysis (not fabricated)', hookText === SAMPLE_ANALYSIS.hook, hookText);

    const adaptRows = await page.locator('.cr2-ayb-adapt-row').count();
    check('16. Adapt-for-your-brand grid has 5 rows (Brand/Audience/Offer/Goal/Tone)', adaptRows === 5, adaptRows);
    const adaptText = await page.locator('#ov3AybAdaptGrid').innerText();
    check('17. Adapt grid shows honest "Not specified" for unknown fields (no fabricated brand)', /Not specified/.test(adaptText), adaptText);

    check('18. Stage indicator shows Reference/Analyze/Your Brand', await page.locator('.cr2-ayb-stages .cr2-ayb-stage').count() === 3);
    check('19. Adaptation notes field present with correct placeholder', (await page.locator('#ov3AybNotes').getAttribute('placeholder') || '').indexOf('free trial') !== -1);
    check('20. Create for My Brand button present', await page.locator('#ov3AybConfirmBtn').innerText() === 'Create for My Brand');

    await page.screenshot({ path: SHOT_DIR + '/02_analysis_result_1440.png' });
    await page.close();
  }

  // ── 21-32: Principle deselection + adaptation notes + confirm ────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const opts = {};
    await armPage(page, opts);
    await loadAndEnterCreate(page);
    await page.click('#ov3AybBtn');
    await page.fill('#ov3AybUrlInput', 'https://example.com/ad');
    await page.click('#ov3AybAnalyzeBtn');
    await page.waitForTimeout(400);

    // Deselect "Creative direction" and "CTA approach"
    await page.click('.cr2-ayb-principle-row[data-key="creativeDirection"] input[type="checkbox"]');
    await page.click('.cr2-ayb-principle-row[data-key="ctaApproach"] input[type="checkbox"]');
    check('21. Deselected row gets dimmed class', await page.locator('.cr2-ayb-principle-row[data-key="creativeDirection"]').evaluate(el => el.classList.contains('cr2-ayb-principle-off')));
    check('22. Checkbox reflects unchecked state', !(await page.locator('.cr2-ayb-principle-row[data-key="creativeDirection"] input').isChecked()));

    await page.fill('#ov3AybNotes', 'Keep the direct hook, make it more premium.');
    await page.click('#ov3AybConfirmBtn');
    await page.waitForTimeout(150);

    const refCtx = await page.evaluate(() => window._ov3ReferenceAdContext);
    check('23. window._ov3ReferenceAdContext populated on confirm', !!refCtx);
    check('24. Confirmed context keeps selected principles (hook)', refCtx && refCtx.analysis && refCtx.analysis.hook === SAMPLE_ANALYSIS.hook);
    check('25. Confirmed context OMITS deselected principle (creativeDirection)', refCtx && refCtx.analysis && !('creativeDirection' in refCtx.analysis), refCtx && refCtx.analysis);
    check('26. Confirmed context OMITS deselected principle (ctaApproach)', refCtx && refCtx.analysis && !('ctaApproach' in refCtx.analysis));
    check('27. sourceSpecificElements carried through untouched (never stripped from the avoid-list)', refCtx && refCtx.analysis && Array.isArray(refCtx.analysis.sourceSpecificElements) && refCtx.analysis.sourceSpecificElements.length === 2);
    check('28. Adaptation notes carried through exactly as typed', refCtx && refCtx.adaptationNotes === 'Keep the direct hook, make it more premium.', refCtx && refCtx.adaptationNotes);
    check('29. Source echoed back honestly (domain)', refCtx && refCtx.source && refCtx.source.domain === 'example.com');

    check('30. Result panel hides after confirm, confirmed chip shows', await page.locator('#ov3AybResult').evaluate(el => el.style.display === 'none') && await page.locator('#ov3AybConfirmed').evaluate(el => el.style.display !== 'none'));
    const confirmedText = await page.locator('#ov3AybConfirmed').innerText();
    check('31. Confirmed chip shows real principle count and source (3, not the original 5, since 2 were deselected)', /3 principles/.test(confirmedText) && /example\.com/.test(confirmedText), confirmedText);
    check('32. No credit-spending route was ever called', !opts.forbiddenCalls, opts.forbiddenCalls);

    await page.screenshot({ path: SHOT_DIR + '/03_confirmed_1440.png' });
    await page.close();
  }

  // ── 33-40: Creative Stage integration ─────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const opts = {};
    await armPage(page, opts);
    await loadAndEnterCreate(page);
    check('33. Creative Stage has no reference indicator before any reference is confirmed', await page.locator('.cr2-stage-meta-ref').count() === 0);

    await page.click('#ov3AybBtn');
    await page.fill('#ov3AybUrlInput', 'https://example.com/ad');
    await page.click('#ov3AybAnalyzeBtn');
    await page.waitForTimeout(400);
    await page.click('#ov3AybConfirmBtn');
    await page.waitForTimeout(200);

    check('34. Creative Stage shows reference indicator after confirm', await page.locator('.cr2-stage-meta-ref').count() === 1);
    const stageText = await page.locator('.cr2-stage-meta-ref').innerText();
    check('35. Stage indicator names the real source domain', /example\.com/.test(stageText), stageText);
    check('36. Stage shows the three named stages', await page.locator('.cr2-stage-meta-ref .cr2-ayb-stage').count() === 3);

    // Start over — everything reverts honestly. The panel is already open
    // at this point (confirming does not close it, only swaps its inner
    // state to the confirmed chip), so the remove control is already
    // visible — no need to (and must not) click the toggle button again,
    // which would just close the still-open panel.
    const hasDiscard = await page.locator('#ov3AybConfirmed .cr2-url-chip-remove').count();
    if (hasDiscard) await page.click('#ov3AybConfirmed .cr2-url-chip-remove');
    await page.waitForTimeout(150);
    const refCtxAfterReset = await page.evaluate(() => window._ov3ReferenceAdContext);
    check('37. window._ov3ReferenceAdContext cleared after Start Over', refCtxAfterReset === null, refCtxAfterReset);
    check('38. Creative Stage reference indicator removed after Start Over', await page.locator('.cr2-stage-meta-ref').count() === 0);
    check('39. Panel returns to intro state after reset', await page.locator('#ov3AybIntro').evaluate(el => el.style.display !== 'none'));
    check('40. Toggle button loses active state after reset', !(await page.locator('#ov3AybBtn').evaluate(el => el.classList.contains('ov3-tool-btn-active'))));

    await page.close();
  }

  // ── 41-48: Error states — honest failure, input preserved ─────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const opts = { analyzeFails: "We couldn't identify enough advertising content in this reference.", analyzeFailCode: 'insufficient_content' };
    await armPage(page, opts);
    await loadAndEnterCreate(page);
    await page.click('#ov3AybBtn');
    await page.fill('#ov3AybUrlInput', 'https://example.com/not-an-ad');
    await page.click('#ov3AybAnalyzeBtn');
    await page.waitForTimeout(400);

    check('41. Error message shown honestly (no fake success)', await page.locator('#ov3AybError').isVisible());
    const errText = await page.locator('#ov3AybError').innerText();
    check('42. Error text matches the real server reason, not a generic fallback', errText === opts.analyzeFails, errText);
    check('43. No fabricated analysis result shown after failure', await page.locator('#ov3AybResult').evaluate(el => el.style.display === 'none'));
    check('44. User input preserved after failure (URL still in the field)', await page.locator('#ov3AybUrlInput').inputValue() === 'https://example.com/not-an-ad');
    check('45. Error has role=alert for screen readers', await page.locator('#ov3AybError').getAttribute('role') === 'alert');

    // Invalid URL client-side check (no network call at all)
    await page.fill('#ov3AybUrlInput', 'not a url at all');
    const callsBefore = (opts.analyzeCalls || []).length;
    await page.click('#ov3AybAnalyzeBtn');
    await page.waitForTimeout(150);
    check('46. Malformed URL rejected client-side without a network call', (opts.analyzeCalls || []).length === callsBefore);
    check('47. Malformed URL shows honest validation message', /valid URL/i.test(await page.locator('#ov3AybError').innerText()));

    // Empty image method
    await page.click('#ov3AybMethodImageBtn');
    await page.waitForTimeout(100);
    check('48. Analyze (image) button disabled with no file chosen', await page.locator('#ov3AybAnalyzeImgBtn').isDisabled());

    await page.screenshot({ path: SHOT_DIR + '/04_error_state_1440.png' });
    await page.close();
  }

  // ── 49-54: Image upload method ─────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const opts = { source: { type: 'image' } };
    await armPage(page, opts);
    await loadAndEnterCreate(page);
    await page.click('#ov3AybBtn');
    await page.click('#ov3AybMethodImageBtn');
    await page.waitForTimeout(100);
    check('49. URL row hidden, image row shown after method switch', await page.locator('#ov3AybUrlRow').evaluate(el => el.style.display === 'none') && await page.locator('#ov3AybImageRow').evaluate(el => el.style.display !== 'none'));

    await page.setInputFiles('#ov3AybFileInput', {
      name: 'reference-ad.png', mimeType: 'image/png', buffer: Buffer.from(TINY_PNG_BASE64, 'base64'),
    });
    await page.waitForTimeout(200);
    check('50. Analyze (image) button enabled once a valid file is chosen', !(await page.locator('#ov3AybAnalyzeImgBtn').isDisabled()));
    check('51. Filename shown to the user', (await page.locator('#ov3AybFileName').innerText()) === 'reference-ad.png');

    await page.click('#ov3AybAnalyzeImgBtn');
    await page.waitForTimeout(400);
    check('52. Real request sent with base64 image payload, not a URL', opts.analyzeCalls && opts.analyzeCalls[0] && typeof opts.analyzeCalls[0].image === 'string' && !opts.analyzeCalls[0].url, opts.analyzeCalls);
    check('53. Analysis result renders for the image path same as URL path', await page.locator('#ov3AybResult').evaluate(el => el.style.display !== 'none'));

    await page.click('#ov3AybConfirmBtn');
    await page.waitForTimeout(150);
    const refCtx = await page.evaluate(() => window._ov3ReferenceAdContext);
    check('54. Confirmed source correctly labeled as an uploaded image, not a domain', refCtx && refCtx.source && refCtx.source.type === 'image');

    await page.close();
  }

  // ── 55-58: Your Page workflow unaffected by the refactor ───────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const opts = {};
    await armPage(page, opts);
    await page.route('**/api/create/analyze-url', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, type: 'page', url: 'https://mybrand.com/', domain: 'mybrand.com', title: 'My Brand', description: 'A real product page', text: 'Real page content.' }) });
    });
    await loadAndEnterCreate(page);
    await page.click('#ov3PageUrlBtn');
    await page.fill('#ov3PageUrlInput', 'mybrand.com');
    await page.click('#ov3PageUrlAddBtn');
    await page.waitForTimeout(400);
    check('55. Your Page workflow still functions after the Reference Ad refactor', await page.locator('#ov3PageUrlChip .cr2-url-chip').count() === 1);
    const pageCtx = await page.evaluate(() => window._ov3PageContext);
    check('56. window._ov3PageContext still populates correctly', pageCtx && pageCtx.domain === 'mybrand.com');
    const refCtxUntouched = await page.evaluate(() => window._ov3ReferenceAdContext);
    check('57. Your Page add does not touch window._ov3ReferenceAdContext', refCtxUntouched === null);
    check('58. Ad → Your Brand panel independently still closed', await page.locator('#ov3AybPanel').evaluate(el => el.style.display === 'none'));
    await page.close();
  }

  // ── 59-63: Copy All (direct function test) ──────────────────────────
  // _renderCgrWorkspace (where the Copy All button's markup lives) is only
  // reachable through the real app's _activeCampaign flow, which is a
  // closure-private variable set via localStorage-backed campaign records
  // and window.openCampaignWorkspace(id) -- pre-existing plumbing entirely
  // unrelated to this change, not something a mock page.evaluate() call
  // can seed directly (confirmed by direct tracing: window._activeCampaign
  // and the closure-private _activeCampaign the app itself reads are two
  // different bindings). Rather than build a parallel campaign-library
  // fixture just to reach one button, this tests the actual new logic
  // directly and honestly: window.cgrDetCopyAll() reads window.
  // _cgrDetCurrentPkg/_cgrDetCurrentPlatform (both real, global, set by
  // the same code that builds the Copy tab, verified by reading the
  // source) and builds clean text from real pkg fields. The button's own
  // markup presence was verified by direct code reading (unconditionally
  // concatenated into the Copy tab's returned HTML string, every
  // platform) rather than by DOM render, and is disclosed as such in the
  // final report, not silently skipped.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await armPage(page, {});
    await loadAndEnterCreate(page);
    await page.evaluate(async () => {
      window._testCopiedText = null;
      navigator.clipboard.writeText = (t) => { window._testCopiedText = t; return Promise.resolve(); };
    });
    check('59. cgrDetCopyAll is a real global function', await page.evaluate(() => typeof window.cgrDetCopyAll === 'function'));
    const servedHtml = await page.content();
    check('60. Copy All button markup present in served app.html source (static check — see report for why full DOM-render could not be exercised)', servedHtml.indexOf('cgrDetCopyAllBtn') !== -1);

    await page.evaluate(() => {
      window._cgrDetCurrentPkg = { metaAds: { headline: 'Real Headline', primaryText: 'Real primary text.', description: 'Real description.', cta: 'Shop Now', headlineVariations: ['Alt 1', 'Alt 2'] } };
      window._cgrDetCurrentPlatform = 'meta';
    });
    await page.evaluate(() => window.cgrDetCopyAll());
    await page.waitForTimeout(100);
    const copied = await page.evaluate(() => window._testCopiedText);
    check('61. Copy All produces clean text with real fields, no UI-label scraping', typeof copied === 'string' && copied.indexOf('Real Headline') !== -1 && copied.indexOf('cgr-det') === -1, copied);
    check('62. Copy All includes the CTA field', typeof copied === 'string' && copied.indexOf('Shop Now') !== -1, copied);

    // Empty package — honest "nothing to copy" rather than an empty clipboard write
    await page.evaluate(() => { window._cgrDetCurrentPkg = { metaAds: {} }; window._testCopiedText = null; });
    await page.evaluate(() => window.cgrDetCopyAll());
    const emptyCopied = await page.evaluate(() => window._testCopiedText);
    check('63. Copy All does not write an empty clipboard for a package with no copy fields', emptyCopied === null, emptyCopied);
    await page.close();
  }

  // ── 63-68: Mobile (390px) ──────────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const opts = {};
    await armPage(page, opts);
    await loadAndEnterCreate(page);
    await page.click('#ov3AybBtn');
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    check('64. No horizontal overflow with panel open on mobile', !overflow);
    await page.fill('#ov3AybUrlInput', 'https://example.com/ad');
    await page.click('#ov3AybAnalyzeBtn');
    await page.waitForTimeout(400);
    check('65. Analysis result visible and usable on mobile', await page.locator('#ov3AybResult').isVisible());
    const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    check('66. No horizontal overflow after analysis renders on mobile', !overflow2);
    check('67. Confirm button remains reachable/visible on mobile', await page.locator('#ov3AybConfirmBtn').isVisible());
    check('68. Adaptation notes field remains accessible on mobile', await page.locator('#ov3AybNotes').isVisible());
    const copyBtnBox = await page.locator('.cr2-ayb-principle-row').first().boundingBox();
    check('69. Principle rows render at a usable width on mobile (not clipped)', copyBtnBox && copyBtnBox.width > 200, copyBtnBox);
    await page.screenshot({ path: SHOT_DIR + '/05_mobile_390.png', fullPage: true });
    await page.close();
  }

  // ── 69-72: Accessibility + reduced motion ──────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const opts = {};
    await armPage(page, opts);
    await loadAndEnterCreate(page);
    check('70. Toggle button has descriptive title/label', (await page.locator('#ov3AybBtn').getAttribute('title') || '').length > 10);
    await page.click('#ov3AybBtn');
    check('71. File input has an accessible name', (await page.locator('#ov3AybFileInput').getAttribute('aria-label') || '').length > 0);
    check('72. URL input has an accessible name', (await page.locator('#ov3AybUrlInput').getAttribute('aria-label') || '').length > 0);
    await page.fill('#ov3AybUrlInput', 'https://example.com/ad');
    await page.click('#ov3AybAnalyzeBtn');
    await page.waitForTimeout(400);
    const checkboxAria = await page.locator('.cr2-ayb-principle-row input[type="checkbox"]').first().evaluate(el => el.hasAttribute('checked') || el.checked);
    check('73. Principle checkboxes are real semantic checkboxes (not color-only)', checkboxAria === true);
    await page.close();
  }

  console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
  await browser.close();
  process.exit(fail ? 1 : 0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
