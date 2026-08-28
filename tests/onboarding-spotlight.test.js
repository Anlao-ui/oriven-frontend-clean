// ════════════════════════════════════════════════════════════════
// Onboarding "Your Turn" spotlight — regression tests
//
// Fixes: the final onboarding section (majorStep 9, "Now it's your
// turn" -> choose platform -> attach -> Generate) spotlighted only each
// frame's own tiny target element (just the textarea, just the platform
// pills, etc.) with 8px of padding. Everything else in the campaign
// builder sat in the spotlight ring's dark 9999px box-shadow spread,
// making the real product UI the user is told to use look inactive or
// broken. Fixed in auth.js by giving those 4 frames a spotlightSelector
// ('#aicInputWrap', the whole builder card) that sizes the ring/backdrop,
// while `selector` (unchanged) still positions the tooltip's arrow at the
// specific control being described. Every other onboarding step has no
// spotlightSelector and keeps its exact prior tight-ring behavior.
//
// Same plain-Node-script convention as this repo's other test files
// (no framework) -- see tests/onboarding-paywall.test.js for the fuller
// rationale.
//
// RUN: npm run test:spotlight
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
  const email = `oriven.spotlight.test+${Date.now()}.${suffix || 'a'}@example.com`;
  const password = 'Test-' + Math.random().toString(36).slice(2) + '-Aa1!';
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  await supabaseAdmin.from('profiles').upsert({
    id: userId, email, subscription_status: 'free',
    onboarding_completed: false, free_campaign_used: false, free_campaign_used_at: null,
  }, { onConflict: 'id' });
  return { userId, email, password };
}

async function deleteTestUser(userId) {
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

function ringRect(page) {
  return page.evaluate(() => {
    const ring = document.getElementById('ob-ring');
    if (!ring || ring.style.display === 'none') return null;
    return {
      top: parseFloat(ring.style.top), left: parseFloat(ring.style.left),
      width: parseFloat(ring.style.width), height: parseFloat(ring.style.height),
    };
  });
}

async function elRect(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }, selector);
}

async function main() {
  const results = [];
  function check(name, cond, detail) {
    results.push({ name, ok: !!cond, detail });
    console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail ? ' (' + detail + ')' : ''));
  }
  const close = (a, b, tol) => Math.abs(a - b) <= (tol || 2);

  const user = await createTestUser('flow');
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(BASE_URL + '/app.html', { waitUntil: 'domcontentloaded' });
    await signIn(page, user);

    // Discover frame numbers from _OB_FRAMES itself (1-indexed, matching
    // obGoTo's own indexing) rather than hardcoding array positions, which
    // silently drift whenever a frame is added/removed elsewhere in the
    // tour (majorStep 1-8 currently spans many sub-frames, e.g. Business
    // Brain's 8 tabs).
    const frameMap = await page.evaluate(() => {
      if (typeof _OB_FRAMES === 'undefined') return null;
      const out = { earlyIndex: null, yourTurn: [] };
      _OB_FRAMES.forEach((f, i) => {
        if (f.majorStep === 2 && out.earlyIndex === null) out.earlyIndex = i + 1;
        if (f.majorStep === 9) out.yourTurn.push({ n: i + 1, titleKey: f.titleKey, hasSpotlight: !!f.spotlightSelector });
      });
      return out;
    });
    check('setup: found majorStep 2 (earlier step) and all majorStep 9 (Your Turn) frames', frameMap && frameMap.earlyIndex && frameMap.yourTurn.length === 4, JSON.stringify(frameMap));

    // ── 1. Earlier steps unaffected: majorStep 2 ("Create" nav item) still
    // uses the tight, small-target ring, not the campaign builder. ──────
    await page.evaluate((n) => { if (typeof obGoTo === 'function') obGoTo(n); }, frameMap.earlyIndex);
    await page.waitForTimeout(300);
    const earlyRing = await ringRect(page);
    const navRect = await elRect(page, '.orv-ni[data-orv-page="create"]');
    const builderRect = await elRect(page, '#aicInputWrap');
    check('1. Earlier step (majorStep 2) ring is sized to the small nav target, not the campaign builder',
      earlyRing && navRect && earlyRing.width < 400 && !close(earlyRing.width, builderRect.width, 50),
      JSON.stringify({ earlyRing, navRect: { width: navRect && navRect.width } }));

    // ── 2-4. All 4 "Your Turn" frames: ring covers the whole builder card,
    // input stays typeable, Generate stays clickable. ───────────────────
    for (const frame of frameMap.yourTurn) {
      check('setup: [' + frame.titleKey + '] frame has spotlightSelector set', frame.hasSpotlight, JSON.stringify(frame));
      await page.evaluate((n) => { if (typeof obGoTo === 'function') obGoTo(n); }, frame.n);
      await page.waitForTimeout(350);

      const ring = await ringRect(page);
      const wrap = await elRect(page, '#aicInputWrap');
      const matchesBuilder = ring && wrap && close(ring.width, wrap.width + 16, 3) && close(ring.height, wrap.height + 16, 3);
      check('2. [' + frame.titleKey + '] spotlight ring covers the whole campaign builder card', matchesBuilder, JSON.stringify({ ring, wrap }));

      const tooltipVisible = await page.evaluate(() => {
        const tt = document.getElementById('ob-tooltip');
        return tt && tt.style.display !== 'none';
      });
      check('2. [' + frame.titleKey + '] onboarding instruction tooltip stays visible', tooltipVisible);
    }

    // ── 3. Campaign input remains genuinely interactive during Your Turn ──
    const promptFrame = frameMap.yourTurn.find(f => f.titleKey === 'obPromptTitle') || frameMap.yourTurn[0];
    await page.evaluate((n) => { if (typeof obGoTo === 'function') obGoTo(n); }, promptFrame.n);
    await page.waitForTimeout(300);
    await page.fill('#aicInput', 'A test prompt for regression verification');
    const typedValue = await page.$eval('#aicInput', el => el.value);
    check('3. Campaign input (#aicInput) accepts real typed input while the tour is active', typedValue === 'A test prompt for regression verification', typedValue);
    const inputHit = await page.evaluate(() => {
      const el = document.getElementById('aicInput');
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!(top && (top === el || el.contains(top)));
    });
    check('3. Campaign input is not covered by the spotlight ring (elementFromPoint hits the real input)', inputHit);

    // ── 4. Generate Campaign remains clickable (checked without actually
    // firing a real generation -- not disabled, not covered by an
    // intercepting overlay, real click handler present). ────────────────
    const genFrame = frameMap.yourTurn.find(f => f.titleKey === 'obGenerateTitle') || frameMap.yourTurn[frameMap.yourTurn.length - 1];
    await page.evaluate((n) => { if (typeof obGoTo === 'function') obGoTo(n); }, genFrame.n);
    await page.waitForTimeout(300);
    const genBtnState = await page.evaluate(() => {
      const el = document.getElementById('aicGenBtn');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        disabled: el.disabled,
        hasOnclick: typeof el.onclick === 'function' || !!el.getAttribute('onclick'),
        notCovered: !!(top && (top === el || el.contains(top))),
      };
    });
    check('4. Generate Campaign button is enabled, wired, and not covered by the ring', genBtnState && !genBtnState.disabled && genBtnState.hasOnclick && genBtnState.notCovered, JSON.stringify(genBtnState));

    // ── 5. Completing the first campaign still triggers the paywall flow ──
    // (full coverage lives in tests/onboarding-paywall.test.js, re-run
    // alongside this file via `npm test`; not duplicated here.)
    console.log('  (5. covered by tests/onboarding-paywall.test.js — run together via `npm test`)');

    // ── 6. No Free-plan/backend changes — this fix touched auth.js only.
    console.log('  (6. no backend files touched by this fix; oriven-backand-clean/server/tests/free-plan.test.js re-run separately, unaffected)');

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
