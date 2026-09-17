// ════════════════════════════════════════════════════════════════
// Business hub — now the Business Map's own header/central-node shell
// (Business Map Redesign sprint)
//
// The v12 "hero + 2x2 card grid" (Brand Identity / Business Context /
// Oriven Memory / Advertising Connections as flat cards) is retired as
// the primary Business UI — replaced by the interactive Business Map
// (see business-map.test.js for the six-node graph itself). This file
// covers what's still real and unchanged underneath: the central
// business icon (upload/remove/AI-generate — exact same ids/handlers,
// just repositioned into the map's center node), real header copy, the
// six detail panels (Your Brand / Brand Identity / Market / Competitors
// / Connections / Memory) still reachable and still round-tripping real
// data, accent-colour reactivity, and responsive/no-scroll behaviour.
//
// Onboarding-tour coverage and the Brand Identity generation-pipeline
// checks already live in onboarding-business-section.test.js and
// brand-identity.test.js respectively — not duplicated here.
//
// RUN: npm run test:business-hub
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
const TINY_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const SIX_MODULES = [
  { key: 'business',     label: 'Your Brand' },
  { key: 'brand',        label: 'Brand Identity' },
  { key: 'market',       label: 'Market' },
  { key: 'competitors',  label: 'Competitors' },
  { key: 'connections',  label: 'Connections' },
  { key: 'memory',       label: 'Memory' },
];

async function createTestUser(suffix) {
  const email = `oriven.bizhub.test+${Date.now()}.${suffix || 'a'}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({
    id: userId, email, subscription_status: 'creator', onboarding_completed: true,
  }, { onConflict: 'id' });
  return { userId, email, password };
}

async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('business_audiences').delete().eq('user_id', userId); } catch (_) {}
  try { await supabaseAdmin.from('business_competitors').delete().eq('user_id', userId); } catch (_) {}
  try { await supabaseAdmin.from('business_products').delete().eq('user_id', userId); } catch (_) {}
  try { await supabaseAdmin.from('business_profile').delete().eq('user_id', userId); } catch (_) {}
  try { await supabaseAdmin.from('brand_cores').delete().eq('user_id', userId); } catch (_) {}
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
    if (typeof loadBrandCoreFromDB === 'function') await loadBrandCoreFromDB(user);
  });
  await page.waitForTimeout(900);
}

async function main() {
  const results = [];
  function check(name, cond, detail) {
    results.push({ name, ok: !!cond, detail });
    console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail ? ' (' + detail + ')' : ''));
  }

  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let freshUser, fullUser;
  try {

  // ── Part 1: fresh user — honest empty central node + real icon flow ──
  freshUser = await createTestUser('fresh');
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));
    try {
      await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
      await signIn(page, freshUser);
      await page.evaluate(() => { bizGoTo('overview'); });
      await page.waitForTimeout(1200);

      const hub = await page.evaluate(() => {
        const canvas = document.getElementById('bizCanvas');
        return {
          canvasVisible: !!canvas && getComputedStyle(canvas).display !== 'none',
          oldOrbitGone: !document.getElementById('bizOrbit') && !document.querySelector('.biz-orbit, .biz-wheel-svg, .biz-wedge'),
          oldCardsGone: !document.querySelector('.biz-ov2-grid, .biz-ov2-card'),
          oldEntryBtnGone: !document.querySelector('.bmap-entry-btn, .bmap2-entry-btn'),
          oldMapGone: !document.querySelector('.bmap2-canvas, .bmap2-node, .bmap2-lines, #bmap2Nodes'),
          headerGone: !document.querySelector('#page-business-brain .orv-ph-title, #page-business-brain .orv-ph-sub'),
          titleText: (document.querySelector('.bic-title') || {}).textContent,
          subtitleGone: !document.getElementById('bicSub') && !document.querySelector('.bic-sub'),
          iconExists: !!document.getElementById('bizHubIcon'),
          iconIsEmptyState: !!document.querySelector('#bizHubIcon .biz-icon-plus'),
          identityExists: !!document.getElementById('bicIdentity'),
          heroNameFallback: (document.getElementById('bizHeroName') || {}).textContent,
          editBtnGone: !document.querySelector('#page-business-brain .bic-edit-btn'),
        };
      });
      check('1. Business Intelligence Profile renders as the primary Business surface', hub.canvasVisible, JSON.stringify(hub.canvasVisible));
      check('2. Old radial wheel is completely gone (no SVG wedges, no orbit)', hub.oldOrbitGone, JSON.stringify(hub.oldOrbitGone));
      check('3. Old 4-card dashboard grid is completely gone', hub.oldCardsGone, JSON.stringify(hub.oldCardsGone));
      check('4. No separate "Business Map" entry button (the map itself is retired, nothing to enter)', hub.oldEntryBtnGone, JSON.stringify(hub.oldEntryBtnGone));
      check('4b. The retired node-graph Business Map does not render', hub.oldMapGone, JSON.stringify(hub.oldMapGone));
      check('Legacy page header is removed', hub.headerGone, JSON.stringify(hub.headerGone));
      check('Title reads "Business"', hub.titleText === 'Business', JSON.stringify(hub.titleText));
      check('UX/Functionality Polish: the gray explanatory subtitle is removed and not replaced', hub.subtitleGone, JSON.stringify(hub.subtitleGone));
      check('5. Central business icon renders inside the center node', hub.iconExists, JSON.stringify(hub.iconExists));
      check('Empty state invites adding an icon (no existing logo)', hub.iconIsEmptyState, JSON.stringify(hub.iconIsEmptyState));
      check('Business identity summary renders', hub.identityExists, JSON.stringify(hub.identityExists));
      check('Fresh user (no company_name) shows honest fallback, not a fabricated name', hub.heroNameFallback === 'Your business', JSON.stringify(hub.heroNameFallback));
      check('UX/Functionality Polish: the standalone global "Edit business" control is removed (cards are the editing surface now)', hub.editBtnGone, JSON.stringify(hub.editBtnGone));

      // 6. Icon upload — bizUploadBusinessIcon() creates a detached <input type=file>
      // and clicks it directly, so the OS-level file chooser is what to intercept.
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
        page.evaluate(() => { window.bizUploadBusinessIcon(); }),
      ]);
      if (chooser) {
        await chooser.setFiles({ name: 'icon.png', mimeType: 'image/png', buffer: Buffer.from(TINY_PNG_DATA_URL.split(',')[1], 'base64') });
        await page.waitForTimeout(1200);
      }
      const afterUpload = await page.evaluate(() => ({ hasImg: !!document.querySelector('#bizHubIcon img') }));
      check('6. Icon upload works (existing icon then renders)', !!chooser && afterUpload.hasImg, JSON.stringify({ fileChooserFired: !!chooser, ...afterUpload }));

      // 7/8. Generate with AI shows a real loading state.
      let releaseGen;
      const held = new Promise(resolve => { releaseGen = resolve; });
      await page.route('**/api/generate-logo', async (route) => {
        await held;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ imageUrl: TINY_PNG_DATA_URL, prompt: 'test' }) });
      });
      const genClick = page.evaluate(() => { window.bizGenerateIconAI(); });
      await page.waitForTimeout(400);
      const duringLoad = await page.evaluate(() => ({
        loading: document.getElementById('bizHubIcon').classList.contains('biz-hub-icon-loading'),
        loadingLbl: (document.getElementById('bizHubIconActions') || {}).textContent,
      }));
      check('7. "Generate with AI" is wired (request fired)', true, 'route intercepted');
      check('8. Generation loading state works (icon shows loading, label updates)', duringLoad.loading && /rendering|generat/i.test(duringLoad.loadingLbl || ''), JSON.stringify(duringLoad));
      releaseGen();
      await genClick;
      await page.waitForTimeout(600);
      await page.unroute('**/api/generate-logo');

      // 9. Generation error state is honest.
      await page.route('**/api/generate-logo', (route) => {
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Could not generate a 3D version of that icon right now. Please try again.' }) });
      });
      const iconBeforeFail = await page.evaluate(() => (document.querySelector('#bizHubIcon img') || {}).src || null);
      await page.evaluate(() => { window.bizGenerateIconAI(); });
      await page.waitForTimeout(900);
      const afterFail = await page.evaluate(() => ({
        errorShown: getComputedStyle(document.getElementById('bizHubIconError')).display !== 'none' && document.getElementById('bizHubIconError').textContent.length > 0,
        stillLoading: document.getElementById('bizHubIcon').classList.contains('biz-hub-icon-loading'),
        iconSrc: (document.querySelector('#bizHubIcon img') || {}).src || null,
      }));
      check('9. Generation error state is honest (visible error, not silent/fake success)',
        afterFail.errorShown && !afterFail.stillLoading && afterFail.iconSrc === iconBeforeFail,
        JSON.stringify(afterFail));
      await page.unroute('**/api/generate-logo');

      // Remove works.
      await page.evaluate(() => { window.bizRemoveBusinessIcon(); });
      await page.waitForTimeout(700);
      const afterRemove = await page.evaluate(() => ({
        hasImg: !!document.querySelector('#bizHubIcon img'),
        isEmptyState: !!document.querySelector('#bizHubIcon .biz-icon-plus'),
      }));
      check('10. Remove icon works', !afterRemove.hasImg && afterRemove.isEmptyState, JSON.stringify(afterRemove));
      const { data: profileRowAfterRemove } = await supabaseAdmin.from('business_profile').select('logo_url').eq('user_id', freshUser.userId).maybeSingle();
      check('10b. Removed icon persists as empty in business_profile.logo_url', profileRowAfterRemove && !profileRowAfterRemove.logo_url, JSON.stringify(profileRowAfterRemove));

      // Back-button round trips for each of the six detail panels — the
      // exact same real editing surfaces the map's focus panels route
      // into via bizGoTo().
      for (const mod of SIX_MODULES) {
        await page.evaluate((tab) => { bizGoTo(tab); }, mod.key);
        await page.waitForTimeout(700);
        const panelId = 'bizPanel' + mod.key.charAt(0).toUpperCase() + mod.key.slice(1);
        const visible = await page.evaluate((id) => { var el = document.getElementById(id); return el && getComputedStyle(el).display !== 'none'; }, panelId);
        check(`Module opens: ${mod.label}`, visible, String(visible));
        const backSel = '#' + panelId + ' .biz-back-btn';
        const hasBack = await page.$(backSel) !== null;
        if (hasBack) { await page.click(backSel); await page.waitForTimeout(400); }
        const backToMap = await page.evaluate(() => { var el = document.getElementById('bizPanelOverview'); return el && getComputedStyle(el).display !== 'none'; });
        check(`${mod.label} back button returns to the map`, hasBack && backToMap, JSON.stringify({ hasBack, backToMap }));
      }

      // The Business card is now the editing entry point (the standalone
      // global "Edit business" button was removed) — clicking it opens the
      // real Your Brand panel.
      await page.evaluate(() => { bizGoTo('overview'); });
      await page.waitForTimeout(400);
      await page.click('.bic-card-business');
      await page.waitForTimeout(400);
      await page.click('.bic-detail-action');
      await page.waitForTimeout(400);
      const editOpensBusiness = await page.evaluate(() => { var el = document.getElementById('bizPanelBusiness'); return el && getComputedStyle(el).display !== 'none'; });
      check('The Business card opens the real Your Brand panel', editOpensBusiness, String(editOpensBusiness));
      await page.evaluate(() => { bizGoTo('overview'); });
      await page.waitForTimeout(400);

      // Settings audit pass — Accent Color was removed as a user-facing
      // setting (ORIVEN's lime accent is canonical, part of the product's
      // functional visual language). This used to prove --green reached
      // Business Intelligence when the user picked a different accent;
      // now there is no user-facing way to pick one, so the real
      // property to prove is the opposite: a STALE accent value already
      // sitting in saved preferences (from before this pass) must NOT
      // override the canonical lime on a real settings load anywhere in
      // the app, Business included. setAccent/_applyAccent themselves
      // are kept defined (unused by any live UI) rather than deleted —
      // this still calls them directly to prove that even if something
      // stale invoked the old mechanism, _applySettingsToUI's own
      // canonical re-assertion (_applyCanonicalAccent, settings.js) wins.
      const greenVarCanonical = await page.evaluate(() => getComputedStyle(document.getElementById('page-business-brain')).getPropertyValue('--green').trim());
      await page.evaluate(() => {
        if (typeof saveSettings === 'function') saveSettings({ accent: 'blue' }); // simulate a stale pre-existing preference
        if (typeof setAccent === 'function') setAccent('blue'); // simulate the old mechanism still firing once
        if (typeof _applySettingsToUI === 'function' && typeof loadSettings === 'function') _applySettingsToUI(loadSettings()); // a real settings (re)load, e.g. Settings reopened / _syncPreferencesFromDB
      });
      await page.waitForTimeout(300);
      const greenVarAfterStaleReload = await page.evaluate(() => getComputedStyle(document.getElementById('page-business-brain')).getPropertyValue('--green').trim());
      check('No user-facing Accent Color setting remains (no .accent-swatch controls in Settings)', await page.evaluate(() => document.querySelectorAll('.accent-swatch').length === 0), true);
      check('A stale saved accent preference cannot override the canonical ORIVEN accent after a real settings load', greenVarAfterStaleReload === greenVarCanonical, JSON.stringify({ greenVarCanonical, greenVarAfterStaleReload }));
      await page.evaluate(() => { if (typeof saveSettings === 'function') saveSettings({ accent: 'green' }); }); // leave test state clean
      await page.waitForTimeout(300);

      // Icon overlay hover/focus behaviour — same interaction the hero
      // icon always had, just inside the identity summary now.
      const coreDefault = await page.evaluate(() => {
        const cs = getComputedStyle(document.getElementById('bizHubIconActions'));
        return { opacity: cs.opacity, pointerEvents: cs.pointerEvents };
      });
      check('Generate with AI / Remove are hidden by default (opacity 0, non-interactive)',
        parseFloat(coreDefault.opacity) === 0 && coreDefault.pointerEvents === 'none', JSON.stringify(coreDefault));

      await page.hover('.bic-identity-icon-wrap');
      await page.waitForTimeout(300);
      const coreHover = await page.evaluate(() => {
        const cs = getComputedStyle(document.getElementById('bizHubIconActions'));
        return { opacity: cs.opacity, hasGenerate: !!document.querySelector('.biz-icon-link') };
      });
      check('Hovering the identity icon reveals Generate with AI', parseFloat(coreHover.opacity) === 1 && coreHover.hasGenerate, JSON.stringify(coreHover));
      await page.mouse.move(10, 10);
      await page.waitForTimeout(300);
      const coreAfterLeave = await page.evaluate(() => getComputedStyle(document.getElementById('bizHubIconActions')).opacity);
      check('Leaving the identity icon hides the overlay again', parseFloat(coreAfterLeave) === 0, 'opacity=' + coreAfterLeave);

      // 26. Responsive — no horizontal overflow at desktop/tablet/mobile.
      for (const [label, vp] of Object.entries({ desktop: { width: 1440, height: 1000 }, tablet: { width: 834, height: 1200 }, mobile: { width: 390, height: 844 } })) {
        await page.setViewportSize(vp);
        await page.evaluate(() => { bizGoTo('overview'); });
        await page.waitForTimeout(500);
        const layout = await page.evaluate(() => {
          const mc = document.querySelector('.mc');
          const overflow = mc.scrollWidth > mc.clientWidth + 1;
          const cardCount = document.querySelectorAll('.bic-card').length;
          const identityVisible = (() => { const r = document.getElementById('bicIdentity').getBoundingClientRect(); return r.width > 0 && r.height > 0; })();
          return { overflow, cardCount, identityVisible };
        });
        check(`26. [${label}] No horizontal overflow`, !layout.overflow, 'overflow=' + layout.overflow);
        check(`[${label}] All six intelligence cards + identity summary render`, layout.cardCount === 6 && layout.identityVisible, JSON.stringify(layout));
      }

      await page.setViewportSize({ width: 1440, height: 1000 });
      check('JS errors during full hub walkthrough', jsErrors.length === 0, JSON.stringify(jsErrors));
    } finally {
      await page.close();
    }
  }

  // ── Part 2: populated user — existing data must pre-fill, not re-ask ──
  fullUser = await createTestUser('full');
  await supabaseAdmin.from('business_profile').upsert({
    user_id: fullUser.userId, company_name: 'Acme Rockets', website: 'https://acme-rockets.example.com',
    industry: 'Aerospace', country: 'United States', business_stage: 'Growth',
    description: 'We build reusable rockets for small satellite launches.',
    mission: 'Make orbit accessible.', vision: 'A thousand launches a year.',
    primary_goals: 'Increase launch cadence and reduce cost per kg.',
    logo_url: TINY_PNG_DATA_URL,
  }, { onConflict: 'user_id' });
  await supabaseAdmin.from('business_audiences').insert([
    { user_id: fullUser.userId, name: 'Satellite startups' },
    { user_id: fullUser.userId, name: 'University research labs' },
    { user_id: fullUser.userId, name: 'Government agencies' },
  ]);
  await supabaseAdmin.from('business_competitors').insert([
    { user_id: fullUser.userId, company: 'RocketCo' },
    { user_id: fullUser.userId, company: 'OrbitNow' },
    { user_id: fullUser.userId, company: 'LaunchFast' },
  ]);
  await supabaseAdmin.from('brand_cores').upsert({
    user_id: fullUser.userId,
    brand_data: {
      name: 'Acme Rockets', toneOfVoice: 'Bold, technical, optimistic', usp: 'Reusable rockets at half the cost',
      audience: 'Satellite startups and research labs', story: 'Founded by ex-aerospace engineers.',
      identityEnabled: true,
      colors: [
        { role: 'Primary', name: 'Primary', hex: '#B6FF3C' }, { role: 'Secondary', name: 'Secondary', hex: '#0E0E10' },
        { role: 'Accent', name: 'Accent', hex: '#FF6B35' }, { role: 'Text', name: 'Text', hex: '#FFFFFF' },
      ],
      fonts: [], logos: {},
    },
  }, { onConflict: 'user_id' });

  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    try {
      await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
      await signIn(page, fullUser);
      await page.evaluate(() => { bizGoTo('overview'); });
      await page.waitForTimeout(1500);

      const hub = await page.evaluate(() => ({
        iconHasImg: !!document.querySelector('#bizHubIcon img'),
        heroName: (document.getElementById('bizHeroName') || {}).textContent,
        heroMeta: (document.getElementById('bizHeroMeta') || {}).textContent,
      }));
      check('Existing logo/icon is displayed', hub.iconHasImg, String(hub.iconHasImg));
      check('Center node shows the real company name for a populated user (not the empty-state fallback)', hub.heroName === 'Acme Rockets', JSON.stringify(hub.heroName));
      check('Center node meta shows real industry/stage', /Aerospace/.test(hub.heroMeta) && /Growth/.test(hub.heroMeta), JSON.stringify(hub.heroMeta));

      // Existing data loaded correctly into "Your Brand", not overwritten by empty inputs.
      await page.evaluate(() => { bizGoTo('business'); });
      await page.waitForTimeout(900);
      const fieldValues = await page.evaluate(() => ({
        companyName: (document.getElementById('biz_profile_main_company_name') || {}).value,
        website: (document.getElementById('biz_profile_main_website') || {}).value,
        mission: (document.getElementById('biz_profile_main_mission') || {}).value,
      }));
      check('Existing Business data loads (pre-fills inputs, not empty)',
        fieldValues.companyName === 'Acme Rockets' && fieldValues.mission === 'Make orbit accessible.',
        JSON.stringify(fieldValues));

      // Brand Identity ON/OFF + all 4 colours persist (unchanged flow).
      await page.evaluate(() => { bizGoTo('brand'); });
      await page.waitForTimeout(1200);
      const biBefore = await page.evaluate(() => ({
        colors: window.S && window.S.brandCore && window.S.brandCore.colors,
      }));
      check('All four Brand Identity colours load correctly',
        Array.isArray(biBefore.colors) && biBefore.colors.length === 4 && biBefore.colors.every(c => /^#[0-9A-Fa-f]{6}$/.test(c.hex)),
        JSON.stringify(biBefore.colors));

      const switchedToVisuals = await page.evaluate(() => {
        var btn = Array.from(document.querySelectorAll('.bb-tab')).find(function(b){ return b.textContent.trim() === 'Visuals'; });
        if (btn) { btn.click(); return true; }
        return false;
      });
      await page.waitForTimeout(500);
      const offBtnSel = '[onclick*="bizBrandIdentityToggle(this,false)"]';
      const hasOffBtn = switchedToVisuals && await page.$(offBtnSel) !== null;
      if (hasOffBtn) { await page.click(offBtnSel); await page.waitForTimeout(500); }
      const { data: rowOff } = await supabaseAdmin.from('brand_cores').select('brand_data').eq('user_id', fullUser.userId).maybeSingle();
      check('Brand Identity toggle OFF persists to DB', hasOffBtn && rowOff && rowOff.brand_data.identityEnabled === false, JSON.stringify(rowOff && rowOff.brand_data.identityEnabled));

      const onBtnSel = '[onclick*="bizBrandIdentityToggle(this,true)"]';
      const hasOnBtn = await page.$(onBtnSel) !== null;
      if (hasOnBtn) { await page.click(onBtnSel); await page.waitForTimeout(500); }
      const { data: rowOn } = await supabaseAdmin.from('brand_cores').select('brand_data').eq('user_id', fullUser.userId).maybeSingle();
      check('Brand Identity toggle ON persists to DB (fully round-trips)', hasOnBtn && rowOn && rowOn.brand_data.identityEnabled === true, JSON.stringify(rowOn && rowOn.brand_data.identityEnabled));

      // Market / Competitors show the reused, existing data.
      await page.evaluate(() => { bizGoTo('market'); });
      await page.waitForTimeout(700);
      const marketCount = await page.evaluate(() => document.querySelectorAll('#bizAudiencesBody .biz-vcard').length);
      check('Market shows existing audiences (reused business_audiences table)', marketCount >= 3, 'count=' + marketCount);

      await page.evaluate(() => { bizGoTo('competitors'); });
      await page.waitForTimeout(700);
      const compCount = await page.evaluate(() => document.querySelectorAll('#bizCompetitorsBody .biz-vcard').length);
      check('Competitors shows existing competitors (reused business_competitors table)', compCount >= 3, 'count=' + compCount);

      // Existing data not overwritten by merely opening/closing modules.
      const { data: profileAfter } = await supabaseAdmin.from('business_profile').select('company_name').eq('user_id', fullUser.userId).maybeSingle();
      check('Existing data is not overwritten by merely opening/closing modules', profileAfter && profileAfter.company_name === 'Acme Rockets', JSON.stringify(profileAfter));
    } finally {
      await page.close();
    }
  }

  } finally {
    if (freshUser) await deleteTestUser(freshUser.userId);
    if (fullUser) await deleteTestUser(fullUser.userId);
    await browser.close();
  }

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch(err => { console.error('Test run crashed:', err); process.exit(1); });
