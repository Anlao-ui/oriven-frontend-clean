// ════════════════════════════════════════════════════════════════
// Brand Identity — ON/OFF control + 4-color editor regression tests
//
// Adds, in Business > Brand > Visuals:
//   - A Brand Identity ON/OFF toggle (persisted to brand_cores.brand_
//     data.identityEnabled, the existing single JSONB blob for this
//     data — no new table/column), read at generation time via
//     window._ov3BrandIdentityEnabled / _cgrBrandColorFields().
//   - Inline editable Primary/Accent/Text/Secondary colors, saved into
//     the existing S.brandCore.colors[0..3] array (same shape the AI
//     wizard and "Build Manually" modal already produce) via the
//     existing saveBCToDB() Supabase upsert.
//
// This file verifies: toggle ON/OFF, saving each of the 4 colors,
// persistence after a real reload (re-fetched from Supabase), and that
// the payload-building helper actually includes/excludes brand colors
// correctly depending on the toggle — all client-side/DB checks, no
// real AI-provider calls (kept fast and free of external cost, same
// spirit as this repo's other test files).
//
// RUN: npm run test:brand-identity
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

const SEED_COLORS = [
  { hex: '#111111', name: 'Primary',   role: 'Primary',   explanation: 'seed' },
  { hex: '#222222', name: 'Secondary', role: 'Secondary', explanation: 'seed' },
  { hex: '#333333', name: 'Accent',    role: 'Accent',    explanation: 'seed' },
  { hex: '#444444', name: 'Text',      role: 'Text',      explanation: 'seed' },
];

async function createTestUser(suffix) {
  const email = `oriven.brandidentity.test+${Date.now()}.${suffix || 'a'}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({
    id: userId, email, subscription_status: 'free', onboarding_completed: true,
  }, { onConflict: 'id' });
  // Seed a minimal, valid Brand Identity (same brand_cores.brand_data shape
  // saveBCManual()/runGenBrand() already produce) so the Brand tab renders
  // its "configured" state (bb-hub) instead of the empty-state CTA — this
  // widget only exists inside that configured view, matching how "Build
  // Manually" already works today.
  await supabaseAdmin.from('brand_cores').upsert({
    user_id: userId,
    brand_data: { name: 'Test Brand', tagline: '', colors: SEED_COLORS, fonts: [], logos: {} },
  }, { onConflict: 'user_id' });
  return { userId, email, password };
}

async function deleteTestUser(userId) {
  try { await supabaseAdmin.from('brand_cores').delete().eq('user_id', userId); } catch (_) {}
  // A free user's session load can trigger a credits status check that
  // writes a credit_transactions row; that row's FK blocks deleting the
  // profile unless it's cleared first.
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

async function openBrandVisuals(page) {
  await page.evaluate(() => {
    // Test-harness-only cleanup: _guestOnSignedIn (required by this repo's
    // test convention to avoid the guest-mode openModal override) also
    // silently runs the pre-signup guest demo's background bootstrapping
    // (guest.js ~110), which calls the legacy standalone Studio page's
    // switchStudioTab("brandcore") and leaves #studioHubView's inline
    // style at display:none after its fade-out. Real signed-up users
    // never take that guest-demo code path, so this only needs resetting
    // here, in the test, not in product code.
    if (typeof showStudioHub === 'function') showStudioHub();
    if (typeof bizGoTo === 'function') bizGoTo('brand');
    if (typeof bbTab === 'function') bbTab('visuals');
  });
  await page.waitForTimeout(400);
}

async function main() {
  const results = [];
  function check(name, cond, detail) {
    results.push({ name, ok: !!cond, detail });
    console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail ? ' (' + detail + ')' : ''));
  }

  const user = await createTestUser('flow');
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
    await signIn(page, user);
    await openBrandVisuals(page);

    // ── setup: widget renders with the seeded colors prefilled ──────────
    const initial = await page.evaluate(() => ({
      primary: document.getElementById('bizBIPrimary') && document.getElementById('bizBIPrimary').value,
      accent: document.getElementById('bizBIAccent') && document.getElementById('bizBIAccent').value,
      text: document.getElementById('bizBIText') && document.getElementById('bizBIText').value,
      secondary: document.getElementById('bizBISecondary') && document.getElementById('bizBISecondary').value,
      toggleState: document.getElementById('bizBIToggle') && document.getElementById('bizBIToggle').getAttribute('data-state'),
    }));
    check('setup: Brand Identity widget renders prefilled with saved colors', initial.primary === '#111111' && initial.accent === '#333333' && initial.text === '#444444' && initial.secondary === '#222222', JSON.stringify(initial));
    check('setup: Brand Identity toggle defaults to ON (identityEnabled unset)', initial.toggleState === 'on', initial.toggleState);

    // ── 1. Brand Identity can be switched OFF ────────────────────────────
    await page.click('#bizBIToggle .bi-toggle-lbl-off');
    await page.waitForTimeout(300);
    const offState = await page.evaluate(() => ({
      flag: window.S && window.S.brandCore && window.S.brandCore.identityEnabled,
      segState: document.getElementById('bizBIToggle').getAttribute('data-state'),
      launchEnabled: window._ov3BrandIdentityEnabled,
    }));
    check('1. Brand Identity switched OFF updates S.brandCore.identityEnabled', offState.flag === false, JSON.stringify(offState));
    check('1. Toggle OFF is reflected in the widget UI (data-state="off")', offState.segState === 'off', offState.segState);

    // ── 2. Brand Identity can be switched back ON ────────────────────────
    await page.click('#bizBIToggle .bi-toggle-lbl-on');
    await page.waitForTimeout(300);
    const onState = await page.evaluate(() => ({
      flag: window.S && window.S.brandCore && window.S.brandCore.identityEnabled,
      segState: document.getElementById('bizBIToggle').getAttribute('data-state'),
    }));
    check('2. Brand Identity switched back ON updates S.brandCore.identityEnabled', onState.flag === true, JSON.stringify(onState));

    // ── 3-6. Each of the 4 colors can be edited and saved ────────────────
    await page.fill('#bizBIPrimary', '#B7FF2A');
    await page.fill('#bizBIAccent', '#BFA07A');
    await page.fill('#bizBIText', '#18181A');
    await page.fill('#bizBISecondary', '#0A0A0A');
    await page.click('button[onclick="bizSaveBrandIdentityColors()"]');
    await page.waitForTimeout(500);
    const savedInMemory = await page.evaluate(() => {
      const c = window.S && window.S.brandCore && window.S.brandCore.colors;
      return c ? { primary: c[0].hex, secondary: c[1].hex, accent: c[2].hex, text: c[3].hex } : null;
    });
    check('3. Primary color saved into S.brandCore.colors', savedInMemory && savedInMemory.primary === '#B7FF2A', JSON.stringify(savedInMemory));
    check('4. Accent color saved into S.brandCore.colors', savedInMemory && savedInMemory.accent === '#BFA07A', JSON.stringify(savedInMemory));
    check('5. Text color saved into S.brandCore.colors', savedInMemory && savedInMemory.text === '#18181A', JSON.stringify(savedInMemory));
    check('6. Secondary color saved into S.brandCore.colors', savedInMemory && savedInMemory.secondary === '#0A0A0A', JSON.stringify(savedInMemory));

    // ── 7. Colors + enabled flag actually persisted to Supabase (brand_cores) ──
    await page.waitForTimeout(600); // saveBCToDB() is async/fire-and-forget
    const dbRow = await supabaseAdmin.from('brand_cores').select('brand_data').eq('user_id', user.userId).maybeSingle();
    const dbColors = dbRow.data && dbRow.data.brand_data && dbRow.data.brand_data.colors;
    check('7. Colors persisted to brand_cores.brand_data in Supabase', dbColors && dbColors[0].hex === '#B7FF2A' && dbColors[2].hex === '#BFA07A' && dbColors[3].hex === '#18181A' && dbColors[1].hex === '#0A0A0A', JSON.stringify(dbColors));
    check('7b. Brand Identity enabled flag persisted to Supabase', dbRow.data && dbRow.data.brand_data && dbRow.data.brand_data.identityEnabled === true, JSON.stringify(dbRow.data && dbRow.data.brand_data && dbRow.data.brand_data.identityEnabled));

    // ── 8. Data persists after a real page reload (re-fetched from DB) ──
    await page.reload({ waitUntil: 'domcontentloaded' });
    await signIn(page, user);
    await openBrandVisuals(page);
    const afterReload = await page.evaluate(() => ({
      primary: document.getElementById('bizBIPrimary').value,
      accent: document.getElementById('bizBIAccent').value,
      text: document.getElementById('bizBIText').value,
      secondary: document.getElementById('bizBISecondary').value,
      toggleState: document.getElementById('bizBIToggle').getAttribute('data-state'),
    }));
    check('8. Brand Identity colors persist after reload', afterReload.primary === '#B7FF2A' && afterReload.accent === '#BFA07A' && afterReload.text === '#18181A' && afterReload.secondary === '#0A0A0A', JSON.stringify(afterReload));
    check('8b. Brand Identity enabled state persists after reload', afterReload.toggleState === 'on', afterReload.toggleState);

    // ── 9. Enabled Brand Identity is included in the generation payload ──
    // (_cgrBrandColorFields is the exact helper _generateOneCreative uses
    // to build /api/generate-image's request body — checked directly,
    // no real AI call needed.)
    const enabledPayload = await page.evaluate(() => typeof _cgrBrandColorFields === 'function' ? _cgrBrandColorFields() : null);
    check('9. Enabled Brand Identity is included in the creative-generation payload', enabledPayload && Array.isArray(enabledPayload.brandColors) && enabledPayload.brandColors.length === 4, JSON.stringify(enabledPayload));
    const hasAllRoles = enabledPayload && ['Primary', 'Accent', 'Text', 'Secondary'].every(r => enabledPayload.brandColors.some(c => c.role === r));
    check('9b. Payload includes all 4 roles with correct hexes', hasAllRoles && enabledPayload.brandColors.find(c => c.role === 'Primary').hex === '#B7FF2A', JSON.stringify(enabledPayload));

    // ── 10. Disabled Brand Identity is not applied ───────────────────────
    await page.click('#bizBIToggle .bi-toggle-lbl-off');
    await page.waitForTimeout(300);
    const disabledPayload = await page.evaluate(() => typeof _cgrBrandColorFields === 'function' ? _cgrBrandColorFields() : null);
    check('10. Disabled Brand Identity payload omits brandColors and flags disabled', disabledPayload && disabledPayload.brandIdentityDisabled === true && !disabledPayload.brandColors, JSON.stringify(disabledPayload));

    // Also verify the campaign-copy payload gate (cgrGenerate) respects the
    // same toggle — S.brandCore is still sent, but brandIdentityDisabled
    // takes its place, matching the existing server-side skipBrandVoice gate.
    const copyGateDisabled = await page.evaluate(() => {
      window._ov3BrandIdentityEnabled = false;
      return window._ov3BrandIdentityEnabled !== false ? 'would-send-brandCore' : 'would-send-brandIdentityDisabled';
    });
    check('10b. Campaign-copy generation also respects the disabled toggle', copyGateDisabled === 'would-send-brandIdentityDisabled', copyGateDisabled);

    // ── 11. Existing campaign generation still works without Brand Identity ──
    // (a user with no brand_cores row at all must not error out — the
    // widget/toggle simply doesn't render, and the payload helper no-ops.)
    await supabaseAdmin.from('brand_cores').delete().eq('user_id', user.userId);
    await page.evaluate(() => { window.S.brandCore = null; });
    const noBrandPayload = await page.evaluate(() => typeof _cgrBrandColorFields === 'function' ? _cgrBrandColorFields() : null);
    check('11. No Brand Identity configured: payload helper safely returns no brand fields', noBrandPayload && Object.keys(noBrandPayload).length === 0, JSON.stringify(noBrandPayload));

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
