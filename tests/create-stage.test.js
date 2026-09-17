// ════════════════════════════════════════════════════════════════
// Create — Creative Stage (Creative Stage pass)
//
// Covers: the Creative Stage exists before any input, contains no
// fabricated ad/creative content, and genuinely responds to real
// selections (platform, Image/Video mode, Campaign Goal, Google
// Campaign Type, Campaign Structure, a real attached image/product,
// and real Brand Identity context) — while the existing composer,
// its validation, and Build Campaign behavior stay unchanged.
//
// RUN: node tests/create-stage.test.js
// ════════════════════════════════════════════════════════════════

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
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

async function createTestUser(suffix, opts) {
  opts = opts || {};
  const email = `oriven.createstage.test+${Date.now()}.${suffix}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({ id: userId, email, subscription_status: 'creator', onboarding_completed: true }, { onConflict: 'id' });
  if (opts.withBrand) {
    try { await supabaseAdmin.from('business_profile').upsert({ user_id: userId, company_name: 'Acme Rockets', logo_url: '' }, { onConflict: 'user_id' }); } catch (_) {}
    try {
      await supabaseAdmin.from('brand_cores').upsert({
        user_id: userId,
        brand_data: { name: 'Acme Rockets', colors: [{ hex: '#B7FF2A', name: 'Primary', role: 'Primary' }, { hex: '#0A0A0A', name: 'Secondary', role: 'Secondary' }, { hex: '#FF6B35', name: 'Accent', role: 'Accent' }, { hex: '#FFFFFF', name: 'Text', role: 'Text' }] },
      }, { onConflict: 'user_id' });
    } catch (_) {}
  }
  if (opts.withMismatchedBrand) {
    // Reproduces the exact real "Bloom" bug: business_profile.company_name
    // (the "Currently working with" source) says one real thing, a SEPARATE
    // stale/older brand_cores row says another -- two genuinely real data
    // sources that legitimately disagree, not fabricated data.
    try { await supabaseAdmin.from('business_profile').upsert({ user_id: userId, company_name: 'OrivenAI', logo_url: '' }, { onConflict: 'user_id' }); } catch (_) {}
    try {
      await supabaseAdmin.from('brand_cores').upsert({
        user_id: userId,
        brand_data: { name: 'Bloom', colors: [{ hex: '#FF00FF', name: 'Primary', role: 'Primary' }] },
      }, { onConflict: 'user_id' });
    } catch (_) {}
  }
  return { userId, email, password };
}
async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('brand_cores').delete().eq('user_id', userId); } catch (_) {}
  try { await supabaseAdmin.from('business_profile').delete().eq('user_id', userId); } catch (_) {}
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
    if (typeof loadBrandCoreFromDB === 'function') await loadBrandCoreFromDB(user);
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { _orvNav('create', 'page-create'); });
  await page.waitForTimeout(600);
}

// A tiny real 2x2 PNG data URI — used to exercise the real Attach Image/
// Attach Product file pipelines without needing an actual file on disk.
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mNk+M9QDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let user, brandUser;
  try {
    user = await createTestUser('a');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    await signIn(page, user);

    // 1. Existing composer fully preserved (real functionality, unchanged ids/handlers)
    const preserved = await page.evaluate(() => ({
      h1: document.querySelector('.cr2-h1').textContent.trim(),
      hasTextarea: document.getElementById('aicInput').tagName === 'TEXTAREA',
      platformCount: document.querySelectorAll('.cr2-pp').length,
      goalCount: document.querySelectorAll('#cr2GoalGrid .cr2-goal-card').length,
      hasGenBtn: !!document.getElementById('aicGenBtn'),
      composerInWorkspaceRow: !!document.querySelector('.cr2-workspace-row > #aicInputWrap'),
    }));
    check('1. Existing composer fully preserved (headline, textarea, 4 platforms, 4 goals, generate button) inside the new workspace row', preserved.h1 === 'Create your next campaign.' && preserved.hasTextarea && preserved.platformCount === 4 && preserved.goalCount === 4 && preserved.hasGenBtn && preserved.composerInWorkspaceRow, preserved);

    // 2. Creative Stage exists BEFORE any user input, with no fake ad content
    const emptyStage = await page.evaluate(() => {
      const stage = document.getElementById('cr2Stage');
      const text = stage.textContent;
      return {
        exists: !!stage,
        visible: stage.offsetHeight > 0,
        hasFrame: !!stage.querySelector('.cr2-stage-frame'),
        hasProviderRow: !!stage.querySelector('.cr2-stage-provider'),
        hasBriefTags: stage.querySelectorAll('.cr2-stage-tag').length > 0,
        // Honesty check: no plausible fake headline/body copy, no fake
        // price, no "Shop now"-style fabricated CTA text anywhere in the
        // stage before the user has typed or attached anything real.
        looksLikeFakeAd: /shop now|buy now|limited time|% off|\$\d|€\d/i.test(text),
        hasRealImg: !!stage.querySelector('.cr2-stage-img'),
      };
    });
    check('2. Creative Stage exists and is visible before any user input', emptyStage.exists && emptyStage.visible && emptyStage.hasFrame && emptyStage.hasProviderRow && emptyStage.hasBriefTags, emptyStage);
    check('2b. No fabricated ad copy/CTA/price exists in the empty-state stage', !emptyStage.looksLikeFakeAd, emptyStage.looksLikeFakeAd);
    check('2c. No fake creative image exists before a real one is attached', !emptyStage.hasRealImg, emptyStage.hasRealImg);

    // Default is Google + Search — must show the text-structure mock, NOT an image frame.
    const defaultState = await page.evaluate(() => ({
      isSearchFrame: !!document.querySelector('.cr2-stage-frame-search'),
      providerText: document.querySelector('.cr2-stage-provider span').textContent,
      tags: Array.from(document.querySelectorAll('.cr2-stage-tag')).map((t) => t.textContent),
    }));
    check('3. Default (Google + Search) shows the honest text-structure frame, not an image-ad preview that would misrepresent Search', defaultState.isSearchFrame && defaultState.providerText === 'Google Ads' && defaultState.tags.includes('SEARCH'), defaultState);

    // 4. Platform selection updates the stage with REAL identity (icon/name/tags)
    await page.click('.cr2-pp[data-plat="meta"]');
    await page.waitForTimeout(200);
    const afterMeta = await page.evaluate(() => ({
      providerText: document.querySelector('.cr2-stage-provider span').textContent,
      tags: Array.from(document.querySelectorAll('.cr2-stage-tag')).map((t) => t.textContent),
      hasMetaClass: document.querySelector('.cr2-stage-provider').classList.contains('cr2-stage-provider-meta'),
      isSearchFrame: !!document.querySelector('.cr2-stage-frame-search'),
    }));
    check('4. Selecting Meta updates the stage\'s real provider identity (icon class + name) and tags', afterMeta.providerText === 'Meta Ads' && afterMeta.hasMetaClass && afterMeta.tags.includes('META ADS'), afterMeta);
    check('4b. Switching away from Search (Meta has no Search concept) drops the text-mock frame for the honest image-format frame', !afterMeta.isSearchFrame, afterMeta.isSearchFrame);

    // 5. Image/Video selection updates the stage's structural frame
    await page.click('.ov3-mode-btn:has-text("Video")');
    await page.waitForTimeout(200);
    const afterVideo = await page.evaluate(() => ({
      tags: Array.from(document.querySelectorAll('.cr2-stage-tag')).map((t) => t.textContent),
      hasPlayIcon: !!document.querySelector('.cr2-stage-frame-ring'),
    }));
    check('5. Selecting Video updates the real mode tag and the stage\'s structural frame (a distinct play-icon glyph, no fake video content)', afterVideo.tags.includes('VIDEO') && afterVideo.hasPlayIcon, afterVideo);
    await page.click('.ov3-mode-btn:has-text("Image")');
    await page.waitForTimeout(200);

    // 6. Campaign Goal selection updates the active brief
    await page.click('.cr2-goal-card[data-goal="Leads"]');
    await page.waitForTimeout(200);
    const afterGoal = await page.evaluate(() => Array.from(document.querySelectorAll('.cr2-stage-tag')).map((t) => t.textContent));
    check('6. Selecting a Campaign Goal (Leads) appears as a real tag in the active brief', afterGoal.includes('LEADS'), afterGoal);

    // 7. Google Campaign Type updates the stage appropriately (switch back to Google first)
    await page.click('.cr2-pp[data-plat="google"]');
    await page.waitForTimeout(200);
    await page.click('#cr2PlatObjGrid .cr2-goal-card:has-text("Performance Max")');
    await page.waitForTimeout(200);
    const afterPMax = await page.evaluate(() => ({
      tags: Array.from(document.querySelectorAll('.cr2-stage-tag')).map((t) => t.textContent),
      isSearchFrame: !!document.querySelector('.cr2-stage-frame-search'),
    }));
    check('7. Selecting Performance Max updates the real campaign-type tag and correctly leaves the text-only Search frame (PMax supports real image assets)', afterPMax.tags.includes('PERFORMANCE MAX') && !afterPMax.isSearchFrame, afterPMax);
    // Back to Search explicitly to verify the frame honestly reverts too.
    await page.click('#cr2PlatObjGrid .cr2-goal-card:has-text("Search")');
    await page.waitForTimeout(200);
    const backToSearch = await page.evaluate(() => !!document.querySelector('.cr2-stage-frame-search'));
    check('7b. Switching back to Search restores the honest text-structure frame (never stuck showing the wrong format)', backToSearch, backToSearch);

    // 8. Campaign Structure updates the stage's real readout
    await page.click('#cst2Card_groups .cst2-struct-head');
    await page.waitForTimeout(150);
    await page.click('#cst2Card_groups .cst2-pip:has-text("3")');
    await page.waitForTimeout(200);
    const afterStruct = await page.evaluate(() => document.querySelector('.cr2-stage-struct').textContent);
    check('8. Changing Campaign Structure (Ad Groups) updates the stage\'s real structure readout, never a fake per-ad breakdown', /3 Ad Groups/.test(afterStruct), afterStruct);

    // 8b. Honesty check first — attach a real image WHILE Search is still
    // selected (from 7b). Search has no real image slot, so even a
    // genuinely attached image must not appear as a false "image ad" —
    // the text-structure frame must keep winning.
    const fileInput = await page.$('#ov3AssetInput');
    await fileInput.setInputFiles({ name: 'test-creative.png', mimeType: 'image/png', buffer: Buffer.from(TINY_PNG_BASE64, 'base64') });
    await page.waitForTimeout(400);
    const whileSearch = await page.evaluate(() => ({ isSearchFrame: !!document.querySelector('.cr2-stage-frame-search'), hasImg: !!document.querySelector('.cr2-stage-img') }));
    check('8b. An attached image never overrides the honest Search text-frame (Search genuinely has no image slot to show it in)', whileSearch.isSearchFrame && !whileSearch.hasImg, whileSearch);

    // 9. Switch to an image-eligible selection (Meta) — the SAME already-
    // attached real image must now appear directly in the stage, unmodified.
    await page.click('.cr2-pp[data-plat="meta"]');
    await page.waitForTimeout(250);
    const afterAttach = await page.evaluate(() => {
      const img = document.querySelector('.cr2-stage-img');
      return { hasImg: !!img, srcIsDataUri: !!img && img.src.startsWith('data:image/png'), srcMatchesRealAsset: !!img && window._ov3Assets[0] && img.src === window._ov3Assets[0].data };
    });
    check('9. A genuinely attached image appears directly in the Creative Stage once an image-eligible platform is selected, using the exact real data URI (never modified/regenerated/replaced)', afterAttach.hasImg && afterAttach.srcIsDataUri && afterAttach.srcMatchesRealAsset, afterAttach);
    await page.click('.ov3-asset-rm');
    await page.waitForTimeout(300);
    const afterRemove = await page.evaluate(() => !!document.querySelector('.cr2-stage-img'));
    check('9b. Removing the attached image returns the stage to its honest empty frame (no stale image left behind)', !afterRemove, afterRemove);

    // 10. Attach a REAL product reference — shown as context only, never as the creative itself.
    const prodInput = await page.$('#ov3ProductAssetInput');
    await prodInput.setInputFiles({ name: 'my-product.png', mimeType: 'image/png', buffer: Buffer.from(TINY_PNG_BASE64, 'base64') });
    await page.waitForTimeout(400);
    const afterProduct = await page.evaluate(() => {
      const el = document.querySelector('.cr2-stage-product');
      return { exists: !!el, hasName: el && el.textContent.includes('my-product.png'), notInMainFrame: !document.querySelector('.cr2-stage-frame .cr2-stage-product') };
    });
    check('10. A real attached product reference appears in the stage as context only (real filename shown), never substituted as the creative itself', afterProduct.exists && afterProduct.hasName && afterProduct.notInMainFrame, afterProduct);

    // 11. Brand Identity — ON but no real brand data configured for this
    // fresh account -> an honest "not configured" note, never fabricated.
    const biSection = await page.evaluate(() => document.getElementById('cr2BrandIdentitySection').style.display !== 'none');
    if (biSection) {
      const honestBrand = await page.evaluate(() => {
        const el = document.querySelector('.cr2-stage-brand-empty');
        return { hasHonestNote: !!el, hasFakeLogo: !!document.querySelector('.cr2-stage-brand-logo'), hasFakeSwatches: !!document.querySelector('.cr2-stage-swatch') };
      });
      check('11. Brand Identity ON with no real brand configured shows an honest "not configured" note, never a fabricated logo/colors', honestBrand.hasHonestNote && !honestBrand.hasFakeLogo && !honestBrand.hasFakeSwatches, honestBrand);
    } else {
      check('11. Brand Identity section not present for this fresh account — honestly skipped, not a failure', true, 'no brand identity section');
    }

    check('JS errors during the full Creative Stage walkthrough', jsErrors.length === 0, jsErrors);

    // 12. Zero-data user: confirm no recent-creative shelf appears (no fabricated content)
    const noShelf = await page.evaluate(() => !document.querySelector('.cr2-stage-shelf'));
    check('12. A zero-data user never sees a fabricated "recent creative" shelf (real array stays empty)', noShelf, noShelf);

    // 13. Build Campaign behavior unchanged — same validation path still works
    await page.evaluate(() => { document.getElementById('aicInput').value = ''; });
    await page.click('#aicGenBtn');
    await page.waitForTimeout(300);
    const validationStillWorks = await page.evaluate(() => document.activeElement.id === 'aicInput');
    check('13. Build Campaign validation is unchanged (empty prompt still focuses the textarea, exactly as before)', validationStillWorks, validationStillWorks);

    // 13d. Small Final Create Fix pass — desktop composer/Stage outer-panel
    // height equality (flex stretch, not a hardcoded pixel height). Checked
    // across three real states since either panel can legitimately be the
    // taller one depending on configuration.
    await page.click('.cr2-pp[data-plat="meta"]');
    await page.click('.cr2-goal-card[data-goal="Sales"]');
    await page.waitForTimeout(250);
    const heights1 = await page.evaluate(() => {
      const b = document.querySelector('.cr2-box').getBoundingClientRect();
      const s = document.querySelector('.cr2-stage').getBoundingClientRect();
      return { boxTop: b.top, boxBottom: b.bottom, stageTop: s.top, stageBottom: s.bottom };
    });
    check('13d. Desktop (1440px): composer and Creative Stage outer panels share the same top edge', heights1.boxTop === heights1.stageTop, heights1);
    check('13e. Desktop (1440px): composer and Creative Stage outer panels share the same bottom edge (equal height)', heights1.boxBottom === heights1.stageBottom, heights1);

    // 13e2. Create Density Correction pass — normal desktop Create must fit
    // the viewport without unnecessary page-level scroll. Root cause of the
    // prior overflow: the ambient glow layer's deliberately oversized
    // inset:-10% pseudo-element was inflating .mc's scrollable area by
    // exactly that 10% even though no real content ever reached there —
    // fixed via overflow:hidden on #page-create.active (clips only the
    // invisible decorative bleed, never real content).
    const scrollCheck = await page.evaluate(() => {
      const mc = document.querySelector('.mc');
      return { mcClientHeight: mc.clientHeight, mcScrollHeight: mc.scrollHeight };
    });
    check('13e2. Desktop (1440px): normal Create state does not unnecessarily page-scroll (mc.scrollHeight <= mc.clientHeight)', scrollCheck.mcScrollHeight <= scrollCheck.mcClientHeight + 1, scrollCheck);

    // 13f/13g. Video Stage state structurally differs from Image, and
    // contains zero fabricated duration/progress/media (spec: a timeline
    // TRACK may be structural UI only).
    await page.click('.ov3-mode-btn:has-text("Video")');
    await page.waitForTimeout(200);
    const videoState = await page.evaluate(() => {
      const stage = document.getElementById('cr2Stage');
      const frame = stage.querySelector('.cr2-stage-frame');
      const playhead = stage.querySelector('.cr2-stage-frame-playhead');
      return {
        hasVideoFrameClass: frame.classList.contains('cr2-stage-frame-video'),
        hasTrack: !!stage.querySelector('.cr2-stage-frame-track'),
        hasPlayhead: !!playhead,
        playheadCx: playhead ? playhead.getAttribute('cx') : null,
        // Honesty check: no fabricated duration/timestamp/percentage text
        // (e.g. "0:32", "45%") anywhere in the video-state Stage.
        looksLikeFabricatedProgress: /\d+:\d\d|\d+%|\d+\s*(sec|min)/i.test(stage.textContent),
      };
    });
    await page.click('.ov3-mode-btn:has-text("Image")');
    await page.waitForTimeout(200);
    const imageState = await page.evaluate(() => {
      const frame = document.querySelector('.cr2-stage-frame');
      return { hasVideoFrameClass: frame.classList.contains('cr2-stage-frame-video'), hasTrack: !!document.querySelector('.cr2-stage-frame-track') };
    });
    check('13f. Video Stage state is structurally different from Image (distinct frame class + a real timeline track, not just a swapped icon)', videoState.hasVideoFrameClass && videoState.hasTrack && !imageState.hasVideoFrameClass && !imageState.hasTrack, { videoState, imageState });
    check('13g. Video Stage state contains no fabricated duration/progress/percentage, and the playhead always sits at the track\'s own start (never implies real playback progress)', videoState.hasPlayhead && !videoState.looksLikeFabricatedProgress && videoState.playheadCx === '40', videoState);
    await page.close();

    // 13h/13i. THE "Bloom" BUG — a mismatched-but-real scenario: business_
    // profile.company_name says "OrivenAI" (the "Currently working with"
    // source), a separate stale brand_cores row says "Bloom". The Stage
    // must resolve to the SAME authoritative name as "Currently working
    // with" (never the stale BrandCore's name), and must never attach that
    // stale BrandCore's colors to a name that isn't genuinely its own.
    const mismatchUser = await createTestUser('m', { withMismatchedBrand: true });
    try {
      const mpage2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const mErrors2 = []; mpage2.on('pageerror', (e) => mErrors2.push(e.message));
      await signIn(mpage2, mismatchUser);
      await mpage2.waitForTimeout(600);
      const bloomCheck = await mpage2.evaluate(() => {
        const bizRow = document.getElementById('orvLaunchBizRow');
        const nameEl = document.querySelector('.cr2-stage-brand-name');
        const stage = document.getElementById('cr2Stage');
        return {
          bizRowText: bizRow ? bizRow.textContent : null,
          stageBrandName: nameEl ? nameEl.textContent : null,
          stageContainsBloom: stage ? stage.innerHTML.includes('Bloom') : null,
          stageHasSwatches: !!document.querySelector('.cr2-stage-brand-swatches'),
        };
      });
      check('13h. Stage brand name comes from the SAME real authoritative source as "Currently working with" (never the stale/mismatched BrandCore name)', bloomCheck.stageBrandName === 'OrivenAI' && bloomCheck.bizRowText && bloomCheck.bizRowText.includes('OrivenAI'), bloomCheck);
      check('13i. "Bloom" never appears anywhere in the Stage, and its mismatched colors are never attached to the resolved name', bloomCheck.stageContainsBloom === false && !bloomCheck.stageHasSwatches, bloomCheck);
      check('JS errors (mismatched brand user)', mErrors2.length === 0, mErrors2);
      await mpage2.close();
    } finally {
      await deleteTestUser(mismatchUser.userId);
    }

    // 13j. Static source check — no hardcoded "Bloom" or "OrivenAI" brand
    // name/fallback was ever introduced into the Stage's own resolver
    // logic (the ONLY legitimate "Bloom" text anywhere in this codebase is
    // an unrelated <input placeholder> example string in a different
    // feature, the Brand Core Wizard — explicitly excluded below).
    const appHtmlSrc = fs.readFileSync(path.resolve(__dirname, '../app.html'), 'utf8');
    const resolverMatch = appHtmlSrc.match(/function _cr2ResolveBrandIdentity\(\)[\s\S]*?\n}/);
    const renderMatch = appHtmlSrc.match(/function _cr2RenderStage\(\)[\s\S]*?\n}\n\nwindow\.cr2Init/);
    const resolverSrc = resolverMatch ? resolverMatch[0] : '';
    const renderSrc = renderMatch ? renderMatch[0] : '';
    check('13j. _cr2ResolveBrandIdentity/_cr2RenderStage source contains no hardcoded "Bloom" or "OrivenAI" fallback string', resolverSrc.length > 0 && renderSrc.length > 0 && !/Bloom/.test(resolverSrc + renderSrc) && !/OrivenAI/.test(resolverSrc + renderSrc), { resolverFound: resolverSrc.length > 0, renderFound: renderSrc.length > 0 });

    // 14. RETURNING USER with real configured Brand Identity — the stage
    // must show the REAL name/colors, never invented ones.
    brandUser = await createTestUser('b', { withBrand: true });
    const bpage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const bErrors = []; bpage.on('pageerror', (e) => bErrors.push(e.message));
    await signIn(bpage, brandUser);
    await bpage.waitForTimeout(800); // real business-profile/brand-core fetches
    const brandState = await bpage.evaluate(() => {
      const nameEl = document.querySelector('.cr2-stage-brand-name');
      const swatches = document.querySelectorAll('.cr2-stage-swatch');
      return { name: nameEl && nameEl.textContent, swatchCount: swatches.length, swatchColors: Array.from(swatches).map((s) => s.style.background) };
    });
    check('14. A returning user with real configured Brand Identity sees their real brand name and real colors in the Stage (not fabricated)', brandState.name === 'Acme Rockets' && brandState.swatchCount > 0, brandState);
    check('JS errors (brand identity user)', bErrors.length === 0, bErrors);
    await bpage.close();

    // 15. Reduced motion — stage still renders correctly, real state still works
    const rmPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const rmErrors = []; rmPage.on('pageerror', (e) => rmErrors.push(e.message));
    await signIn(rmPage, user);
    const rmStage = await rmPage.evaluate(() => !!document.getElementById('cr2Stage') && document.getElementById('cr2Stage').offsetHeight > 0);
    check('15. Reduced motion: Creative Stage still renders correctly', rmStage, rmStage);
    await rmPage.click('.cr2-pp[data-plat="pinterest"]');
    await rmPage.waitForTimeout(150);
    const rmUpdates = await rmPage.evaluate(() => document.querySelector('.cr2-stage-provider span').textContent);
    check('15b. Reduced motion: real selection state still updates the stage correctly', rmUpdates === 'Pinterest Ads', rmUpdates);
    check('JS errors (reduced motion)', rmErrors.length === 0, rmErrors);
    await rmPage.close();

    // 16. Mobile — no overflow, stage stacks below composer, remains usable
    const mpage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mErrors = []; mpage.on('pageerror', (e) => mErrors.push(e.message));
    await signIn(mpage, user);
    const mobileState = await mpage.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      stageVisible: document.getElementById('cr2Stage').offsetHeight > 0,
      genBtnVisible: document.getElementById('aicGenBtn').offsetHeight > 0,
    }));
    check('16. Mobile (390px): no horizontal overflow, Creative Stage visible, Build Campaign reachable', !mobileState.overflow && mobileState.stageVisible && mobileState.genBtnVisible, mobileState);
    check('JS errors (mobile)', mErrors.length === 0, mErrors);

    // 16b/16c. Final Visual Polish pass — regression checks for two real
    // mobile bugs found and fixed while re-verifying reachability with a
    // TALLER real configuration (Meta + a Goal selected, which reveals the
    // Meta Objective section): (1) #page-create's own unconditional
    // height:100% (an unrelated legacy rule) combined with .page's mobile
    // overflow-x:hidden silently turned #page-create into its own capped,
    // internally-scrolling box instead of overflowing into .mc's real
    // scrollbar — Build Campaign became unreachable by ANY scroll once
    // real content exceeded that cap; (2) .cst2-struct-card's "flex: 1 1
    // 220px" (a WIDTH basis for the desktop row layout) was silently
    // reinterpreted as a HEIGHT basis once its row stacks to
    // flex-direction:column on mobile, holding each collapsed Campaign
    // Structure card open at a fixed 220px with a large empty gap below
    // its real ~86px of content. Both are plain CSS layout bugs, not
    // caught by a simple scrollWidth/offsetHeight check.
    await mpage.setViewportSize({ width: 390, height: 844 });
    await mpage.click('.cr2-pp[data-plat="meta"]');
    await mpage.click('.cr2-goal-card[data-goal="Sales"]');
    await mpage.waitForTimeout(300);
    await mpage.evaluate(() => { document.querySelector('.mc').scrollTop = 999999; });
    await mpage.waitForTimeout(150);
    const tallMobile = await mpage.evaluate(() => {
      const r = document.getElementById('aicGenBtn').getBoundingClientRect();
      return { genBtnTop: r.top, genBtnBottom: r.bottom, viewportH: window.innerHeight };
    });
    check('16b. Mobile (390px), Meta + Sales (taller real config): Build Campaign is reachable by scrolling — not clipped by an internal scroll cap', tallMobile.genBtnBottom <= tallMobile.viewportH + 1 && tallMobile.genBtnTop >= 0, tallMobile);
    const structCardHeight = await mpage.evaluate(() => {
      const card = document.querySelector('.cst2-struct-card');
      return card ? card.getBoundingClientRect().height : null;
    });
    check('16c. Mobile (390px): a collapsed Campaign Structure card has no oversized empty gap (natural content height, not a stale flex-basis)', structCardHeight !== null && structCardHeight < 150, structCardHeight);
    await mpage.close();

    // 17. 1280px — two states
    const page1280 = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const e1280 = []; page1280.on('pageerror', (e) => e1280.push(e.message));
    await signIn(page1280, user);
    const state1280 = await page1280.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      stageVisible: document.getElementById('cr2Stage').offsetHeight > 0,
    }));
    check('17. 1280px: no horizontal overflow, Creative Stage visible', !state1280.overflow && state1280.stageVisible, state1280);
    // 17b. Regression check for a REAL bug found and fixed during this
    // pass: the composer+Stage stacking into one column at <=1280px makes
    // real content taller than the viewport, and #page-create.active's
    // flex centering silently clips/hides the "before" side of an
    // overflowing centered child at a negative viewport Y — reachable by
    // NO amount of scrolling, not caught by a simple scrollWidth check.
    // Verified directly: every real interactive control must render at a
    // non-negative Y position that a real user could actually reach.
    const noClipping = await page1280.evaluate(() => {
      const pill = document.querySelector('.cr2-pp[data-plat="meta"]').getBoundingClientRect();
      const genBtn = document.getElementById('aicGenBtn').getBoundingClientRect();
      return { pillTop: pill.top, genBtnTop: genBtn.top };
    });
    check('17b. 1280px: real controls never render at a negative/unreachable viewport position (the exact centering-clips-content bug this pass found and fixed)', noClipping.pillTop >= 0 && noClipping.genBtnTop >= 0, noClipping);
    await page1280.click('.cr2-pp[data-plat="meta"]'); // a real click must actually succeed, not time out
    const platClicked = await page1280.evaluate(() => document.querySelector('.cr2-pp[data-plat="meta"]').classList.contains('cr2-pp-on'));
    check('17c. 1280px: a real platform-pill click succeeds (proves the control is genuinely reachable, not just numerically non-negative)', platClicked, platClicked);
    check('JS errors (1280px)', e1280.length === 0, e1280);
    await page1280.close();

    console.log(`\n${results.length} checks run, ${results.filter((r) => r.ok).length} passed, ${results.filter((r) => !r.ok).length} failed.`);
    if (results.some((r) => !r.ok)) process.exitCode = 1;
  } finally {
    if (user) await deleteTestUser(user.userId);
    if (brandUser) await deleteTestUser(brandUser.userId);
    await browser.close();
  }
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
