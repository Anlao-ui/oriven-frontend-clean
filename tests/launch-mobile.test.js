// ════════════════════════════════════════════════════════════════
// Launch page — mobile responsive bug-fix regression coverage
//
// This is NOT a Launch redesign. Desktop was already visually strong
// and stays untouched (verified explicitly below). The bug: on a real
// phone viewport, #page-create.active used `align-items:center` to
// vertically centre content that's shorter than the viewport on
// desktop — but on mobile the goal grid/structure cards stack into
// extra height and the composer genuinely exceeds the viewport, so
// Chromium's flexbox centering clipped the "before" side of the
// overflowing child. That clipped portion (hero + platform pills) was
// NOT reachable by scrolling at all — .cr2-wrap sat at a permanently
// negative top regardless of scrollTop. Separately, an unconditional
// `#page-create .cr2-wrap { padding-top: 0 }` (ID+class specificity)
// was silently beating the *already-existing* 64px mobile
// hamburger-clearance rules elsewhere in the file, so the platform
// pills sat directly underneath the fixed hamburger.
//
// Fix (styles.css, scoped to a max-width:768px media query only):
//   #page-create.active { align-items: flex-start; justify-content: flex-start; }
//   #page-create .cr2-wrap { padding-top: 64px; }
//
// #page-create has its own internal overflow-y:auto (not .mc) — that's
// the real scroll container for this page's content once it's genuinely
// taller than the viewport.
//
// Same plain-Node-script convention as this repo's other test files.
// RUN: node tests/launch-mobile.test.js
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
  const email = `oriven.launchmob.test+${Date.now()}.${suffix || 'a'}@example.com`;
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
  try { await supabaseAdmin.from('profiles').delete().eq('id', userId); } catch (_) {}
  try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (_) {}
}

async function signInAndOpenLaunch(page, user) {
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
  await page.waitForTimeout(900);
  await page.evaluate(() => { if (typeof navigate === 'function') navigate('create'); });
  await page.waitForTimeout(900);
}

async function main() {
  const results = [];
  function check(name, cond, detail) {
    results.push({ name, ok: !!cond, detail });
    console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail ? ' (' + detail + ')' : ''));
  }

  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  let user;
  try {
    user = await createTestUser('a');

    // ── Desktop sanity: prove nothing changed there (bug-fix, not a redesign) ──
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const jsErrors = [];
      page.on('pageerror', e => jsErrors.push(e.message));
      try {
        await signInAndOpenLaunch(page, user);
        const desktop = await page.evaluate(() => ({
          alignItems: getComputedStyle(document.getElementById('page-create')).alignItems,
          justifyContent: getComputedStyle(document.getElementById('page-create')).justifyContent,
          wrapPaddingTop: getComputedStyle(document.querySelector('#page-create .cr2-wrap')).paddingTop,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        }));
        check('Desktop: #page-create still centers content (align-items:center unchanged)', desktop.alignItems === 'center', 'alignItems=' + desktop.alignItems);
        check('Desktop: .cr2-wrap padding-top is still 0 (unchanged — the mobile fix is scoped, not global)', desktop.wrapPaddingTop === '0px', 'paddingTop=' + desktop.wrapPaddingTop);
        check('Desktop: no horizontal overflow', !desktop.overflow, 'overflow=' + desktop.overflow);

        const controls = await page.evaluate(() => ({
          googlePill: !!document.querySelector('.cr2-pp[data-plat="google"]'),
          metaPill: !!document.querySelector('.cr2-pp[data-plat="meta"]'),
          tiktokPill: !!document.querySelector('.cr2-pp[data-plat="tiktok"]'),
          goalCards: document.querySelectorAll('.cr2-goal-card').length,
          attachImageBtn: !!document.querySelector('.ov3-tool-btn'),
          buildBtn: !!document.querySelector('.cr2-gen-btn'),
        }));
        check('Desktop: Google/Meta/TikTok platform pills all present', controls.googlePill && controls.metaPill && controls.tiktokPill, JSON.stringify(controls));
        check('Desktop: Campaign Goal cards present', controls.goalCards >= 4, 'count=' + controls.goalCards);
        check('Desktop: Build Campaign button present', controls.buildBtn, String(controls.buildBtn));
        check('Desktop: no JS errors', jsErrors.length === 0, JSON.stringify(jsErrors));
      } finally {
        await page.close();
      }
    }

    // ── Mobile: the actual bug fix ──
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const jsErrors = [];
      page.on('pageerror', e => jsErrors.push(e.message));
      try {
        await signInAndOpenLaunch(page, user);

        const mobile = await page.evaluate(() => {
          const pc = document.getElementById('page-create');
          const wrap = document.querySelector('#page-create .cr2-wrap');
          const h1 = document.querySelector('.cr2-h1');
          const h1r = h1.getBoundingClientRect();
          const wrapR = wrap.getBoundingClientRect();
          return {
            alignItems: getComputedStyle(pc).alignItems,
            wrapPaddingTop: getComputedStyle(wrap).paddingTop,
            wrapTop: wrapR.top,
            h1Top: h1r.top,
            h1Bottom: h1r.bottom,
            h1OnScreen: h1r.top >= 0 && h1r.bottom > h1r.top,
            horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          };
        });
        check('1. Mobile layout: #page-create no longer centers (align-items:flex-start, was the bug)', mobile.alignItems === 'flex-start', 'alignItems=' + mobile.alignItems);
        check('1b. Mobile layout: .cr2-wrap gets real top padding again (was silently zeroed)', parseFloat(mobile.wrapPaddingTop) > 0, 'paddingTop=' + mobile.wrapPaddingTop);
        check('1c. Mobile layout: .cr2-wrap sits at a real, non-negative position (was permanently negative/clipped)', mobile.wrapTop >= 0, 'wrapTop=' + mobile.wrapTop);
        check('1d. Mobile layout: the "Launch your next campaign." heading is genuinely on-screen at load (was clipped off permanently)', mobile.h1OnScreen, JSON.stringify(mobile));
        check('4. No horizontal overflow on mobile', !mobile.horizontalOverflow, 'overflow=' + mobile.horizontalOverflow);

        // 2. Mobile navigation — hamburger positioned correctly, doesn't
        // overlap the campaign builder, has a real touch target, opens
        // the existing drawer.
        const hamburger = await page.$('.orv-mob-toggle');
        check('2. Mobile hamburger nav control exists', !!hamburger, String(!!hamburger));
        if (hamburger) {
          const hbox = await hamburger.boundingBox();
          check('2b. Hamburger has a real touch target (>=40x40)', hbox.width >= 40 && hbox.height >= 40, JSON.stringify(hbox));
          const googlePillBox = await page.locator('.cr2-pp[data-plat="google"]').boundingBox();
          const overlap = !(hbox.x + hbox.width < googlePillBox.x || hbox.x > googlePillBox.x + googlePillBox.width
            || hbox.y + hbox.height < googlePillBox.y || hbox.y > googlePillBox.y + googlePillBox.height);
          check('2c. Hamburger does not overlap the campaign builder content (was overlapping the Google Ads pill)', !overlap, JSON.stringify({ hbox, googlePillBox }));
          await hamburger.click();
          await page.waitForTimeout(400);
          const drawerOpen = await page.evaluate(() => !!document.getElementById('orvMobDrawer'));
          check('2d. Clicking the hamburger still opens the nav drawer (existing behavior intact)', drawerOpen, String(drawerOpen));
          // Close via the drawer's own close function (not a second click
          // on the hamburger — the open drawer overlay covers it, so a
          // second click on the same handle times out waiting for
          // visibility; _orvDrawerClose is the real close path anyway,
          // same one the drawer's own close button/backdrop use).
          await page.evaluate(() => { if (typeof _orvDrawerClose === 'function') _orvDrawerClose(); });
          await page.waitForTimeout(300);
        }

        // 3. Campaign builder responsiveness — 2-column desktop cards
        // collapse sensibly, nothing unreadably tiny.
        const builderLayout = await page.evaluate(() => {
          // .cr2-goal-card is reused by #cr2PlatObjGrid for the (legitimately
          // more compact, single-line) Campaign Type cards — scope this
          // check to the real Campaign Goal grid only, or a genuinely
          // compact reused card reads as a false "too tiny" positive.
          const goalCards = Array.from(document.querySelectorAll('#cr2GoalGrid .cr2-goal-card'));
          const pills = Array.from(document.querySelectorAll('.cr2-pp'));
          return {
            goalCardCount: goalCards.length,
            goalCardWidths: goalCards.map(c => Math.round(c.getBoundingClientRect().width)),
            goalCardTooTiny: goalCards.some(c => { const r = c.getBoundingClientRect(); return r.width < 100 || r.height < 40; }),
            pillWidths: pills.map(p => Math.round(p.getBoundingClientRect().width)),
          };
        });
        check('3. Campaign Goal cards render on mobile, none unreadably tiny', builderLayout.goalCardCount >= 4 && !builderLayout.goalCardTooTiny, JSON.stringify(builderLayout));

        // 5. All existing controls remain present (not removed) on mobile.
        const controlsMobile = await page.evaluate(() => ({
          googlePill: !!document.querySelector('.cr2-pp[data-plat="google"]'),
          metaPill: !!document.querySelector('.cr2-pp[data-plat="meta"]'),
          tiktokPill: !!document.querySelector('.cr2-pp[data-plat="tiktok"]'),
          imageVideoToggle: !!document.querySelector('.ov3-mode-seg'),
          attachButtons: document.querySelectorAll('.ov3-tool-btn').length,
          goalCards: document.querySelectorAll('.cr2-goal-card').length,
          buildBtn: !!document.querySelector('.cr2-gen-btn'),
          creditInfo: !!document.querySelector('#aicGenCost') || /credit/i.test(document.body.innerText),
        }));
        check('5. Google/Meta/TikTok platform pills all still present on mobile', controlsMobile.googlePill && controlsMobile.metaPill && controlsMobile.tiktokPill, JSON.stringify(controlsMobile));
        check('5b. Image/Video toggle still present on mobile', controlsMobile.imageVideoToggle, String(controlsMobile.imageVideoToggle));
        check('5c. Attach Image / Attach Product buttons still present on mobile', controlsMobile.attachButtons >= 2, 'count=' + controlsMobile.attachButtons);
        check('5d. Campaign Goal cards still present on mobile', controlsMobile.goalCards >= 4, 'count=' + controlsMobile.goalCards);
        check('5e. Credit info still present on mobile', controlsMobile.creditInfo, String(controlsMobile.creditInfo));

        // Select a goal to reveal Campaign Type + Campaign Structure
        // (the advanced group), then verify Build Campaign is reachable
        // via .mc's real scroll. UPDATED (Create Density Correction pass):
        // a later, already-completed fix (#page-create.active{height:auto;
        // overflow-y:visible} at <=768px, see styles.css) intentionally
        // made #page-create stop being its own scroll container so .mc
        // alone handles real overflow (the same fix create-stage.test.js's
        // own checks 16/16b already verify) — scrolling #page-create
        // directly, as this check previously did, is the exact stale
        // pre-fix mechanism and no longer moves anything.
        await page.click('.cr2-goal-card >> nth=0');
        await page.waitForTimeout(500);
        await page.evaluate(() => { document.querySelector('.mc').scrollTo(0, 999999); });
        await page.waitForTimeout(400);
        const afterScroll = await page.evaluate(() => {
          const btn = document.querySelector('.cr2-gen-btn');
          if (!btn) return null;
          const r = btn.getBoundingClientRect();
          return { visible: r.width > 0 && r.height > 0, fullyOnScreen: r.top >= 0 && r.bottom <= window.innerHeight, top: r.top, bottom: r.bottom };
        });
        check('6. Build Campaign button is reachable via scroll on mobile (.mc is the real scroll container)', afterScroll && afterScroll.visible && afterScroll.fullyOnScreen, JSON.stringify(afterScroll));

        const structLayout = await page.evaluate(() => {
          const structCards = Array.from(document.querySelectorAll('.cst2-struct-card'));
          const typeCards = document.querySelectorAll('#cr2PlatObjGrid .cr2-goal-card');
          return {
            structCardCount: structCards.length,
            structCardsStacked: structCards.length < 2 || structCards.every((c, i) => i === 0 || c.getBoundingClientRect().top > structCards[i - 1].getBoundingClientRect().bottom - 5),
            typeCardCount: typeCards.length,
          };
        });
        check('3b. Campaign Structure cards render and stack vertically on mobile (2-col desktop -> 1-col)', structLayout.structCardCount >= 1 && structLayout.structCardsStacked, JSON.stringify(structLayout));
        check('3c. Campaign Type cards render on mobile', structLayout.typeCardCount >= 1, 'count=' + structLayout.typeCardCount);

        check('JS errors during mobile Launch walkthrough', jsErrors.length === 0, JSON.stringify(jsErrors));
      } finally {
        await page.close();
      }
    }

    // ── Tablet ──
    {
      const page = await browser.newPage({ viewport: { width: 834, height: 1194 } });
      try {
        await signInAndOpenLaunch(page, user);
        const tablet = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          hamburgerVisible: !!document.querySelector('.orv-mob-toggle') && getComputedStyle(document.querySelector('.orv-mob-toggle')).display !== 'none',
        }));
        check('7. [tablet] No horizontal overflow', !tablet.overflow, 'overflow=' + tablet.overflow);
        check('7b. [tablet] Hamburger nav visible', tablet.hamburgerVisible, String(tablet.hamburgerVisible));
      } finally {
        await page.close();
      }
    }
  } finally {
    if (user) await deleteTestUser(user.userId);
    await browser.close();
  }

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch(err => { console.error('Test run crashed:', err); process.exit(1); });
