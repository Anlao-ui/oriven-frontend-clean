// ════════════════════════════════════════════════════════════════
// Landing page — "ORIVEN is built for the way you advertise" — the
// six real finished product films, integrated into the EXISTING
// workspace section (no redesign, no duplicate section).
//
// Real browser + real running static server (no Supabase user needed —
// this is the public landing page). Verifies the real video files
// actually load and play (not just that <video> elements exist),
// correct product->film mapping (including the intentional
// Create/Launch swap), muted/playsinline/16:9 invariants, offscreen
// pause via the section's own IntersectionObserver, and
// prefers-reduced-motion honesty.
//
// RUN: node tests/landing-product-films.test.js
// ════════════════════════════════════════════════════════════════

const { chromium } = require('playwright');

const BASE_URL = process.env.TEST_FRONTEND_URL || 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH
  || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';

const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond });
  console.log((cond ? '  PASS — ' : '  FAIL — ') + name + (detail !== undefined ? ' (' + JSON.stringify(detail) + ')' : ''));
}

function scrollToPillars() {
  var lv = document.getElementById('view-landing');
  var el = document.getElementById('ov-pillars');
  lv.scrollTop = el.offsetTop - 100;
}

const EXPECTED = {
  research: 'ORIVEN Research Film.mp4',
  create: 'ORIVEN Launch Film.mp4', // intentional — verified against real files on disk
  launch: 'ORIVEN Launch Control Film.mp4',
  campaigns: 'ORIVEN Campaigns Film.mp4',
  autopilot: 'ORIVEN Autopilot Film.mp4',
  business: 'ORIVEN Business Film.mp4',
};

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });
  try {
    // ════════════════════════════════════════════════════════════
    // 1-8. Section exists, exactly six correct product->film mappings
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      const failedVideoReqs = [];
      page.on('response', (r) => { if (/\.mp4/i.test(r.url()) && r.status() >= 400) failedVideoReqs.push(r.status() + ' ' + r.url()); });
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });

      const sectionExists = await page.evaluate(() => {
        const h = document.querySelector('#ov-pillars .ov-section-h');
        return !!document.getElementById('ov-pillars') && h && /built for the way you advertise/i.test(h.textContent);
      });
      check('1. Existing six-product landing section still exists ("ORIVEN is built for the way you advertise")', sectionExists, sectionExists);

      const tabCount = await page.evaluate(() => document.querySelectorAll('.ov-ws-tab').length);
      const contentCount = await page.evaluate(() => document.querySelectorAll('.ov-ws-content').length);
      check('2. Exactly six product tabs and six content blocks (no duplicate section)', tabCount === 6 && contentCount === 6, { tabCount, contentCount });

      await page.evaluate(scrollToPillars);
      await page.waitForTimeout(1200);

      const caps = ['research', 'create', 'launch', 'campaigns', 'autopilot', 'business'];
      for (const cap of caps) {
        if (cap !== 'research') { await page.click('.ov-ws-tab[data-cap="' + cap + '"]'); await page.waitForTimeout(700); }
        const info = await page.evaluate((c) => {
          const v = document.querySelector('.ov-ws-content[data-cap="' + c + '"] .ov-ws-video');
          return { src: v.currentSrc, muted: v.muted, playsInline: v.playsInline, loop: v.loop, paused: v.paused, width: v.videoWidth, height: v.videoHeight };
        }, cap);
        const label = { research: '3', create: '4', launch: '5', campaigns: '6', autopilot: '7', business: '8' }[cap];
        const expectedFile = EXPECTED[cap];
        check(`${label}. ${cap} uses the real ${expectedFile}, actually loaded (video dimensions present)`, info.src.indexOf(encodeURIComponent(expectedFile).replace(/%2F/g, '/')) !== -1 || decodeURIComponent(info.src).indexOf(expectedFile) !== -1, info);
        check(`${cap} video actually has real dimensions (loaded, not broken)`, info.width > 0 && info.height > 0, { width: info.width, height: info.height });
        check(`${cap} 16:9 aspect ratio preserved in the source file itself`, Math.abs(info.width / info.height - 16 / 9) < 0.02, { width: info.width, height: info.height, ratio: info.width / info.height });
      }

      check('9. All videos are muted', await page.evaluate(() => Array.from(document.querySelectorAll('.ov-ws-video')).every((v) => v.muted)), true);
      check('10. All videos use playsinline', await page.evaluate(() => Array.from(document.querySelectorAll('.ov-ws-video')).every((v) => v.playsInline)), true);
      check('11. .ov-ws-media box itself is 16:9 at desktop', await page.evaluate(() => {
        const r = document.querySelector('.ov-ws-content-active .ov-ws-media').getBoundingClientRect();
        return Math.abs(r.width / r.height - 16 / 9) < 0.05;
      }), true);
      check('12. No native browser video controls shown by default (no giant permanent play icon once video is confirmed real+playing)', await page.evaluate(() => {
        const active = document.querySelector('.ov-ws-content-active');
        const v = active.querySelector('.ov-ws-video');
        const playBtn = active.querySelector('.ov-ws-play');
        return !v.controls && getComputedStyle(playBtn).display === 'none'; // playing -> button hidden per .ov-ws-playing CSS
      }), true);

      check('No failed/404 video asset requests', failedVideoReqs.length === 0, failedVideoReqs);
      check('JS errors during full film walkthrough', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 13. Offscreen videos pause (section-level IntersectionObserver)
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(scrollToPillars);
      await page.waitForTimeout(1200);
      const playingBeforeScroll = await page.evaluate(() => !document.querySelector('.ov-ws-content-active .ov-ws-video').paused);
      check('Active film is genuinely playing while the section is visible', playingBeforeScroll, playingBeforeScroll);
      await page.evaluate(() => { document.getElementById('view-landing').scrollTop = 0; });
      await page.waitForTimeout(1000);
      const pausedOffscreen = await page.evaluate(() => document.querySelector('.ov-ws-content-active .ov-ws-video').paused);
      check('13. The active film pauses once the section scrolls out of view', pausedOffscreen, pausedOffscreen);
      await page.evaluate(scrollToPillars);
      await page.waitForTimeout(1200);
      const resumedOnReturn = await page.evaluate(() => !document.querySelector('.ov-ws-content-active .ov-ws-video').paused);
      check('The active film resumes once the section scrolls back into view', resumedOnReturn, resumedOnReturn);
      check('JS errors (offscreen pause walkthrough)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // Only one film plays at a time — switching tabs pauses the previous.
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(scrollToPillars);
      await page.waitForTimeout(1200);
      await page.click('.ov-ws-tab[data-cap="business"]');
      await page.waitForTimeout(700);
      const playingCount = await page.evaluate(() => Array.from(document.querySelectorAll('.ov-ws-video')).filter((v) => !v.paused).length);
      check('Never more than one film plays simultaneously (no chaotic six-video playback)', playingCount === 1, playingCount);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 14. Reduced motion — no automatic motion; manual fallback works, never unmutes.
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(scrollToPillars);
      await page.waitForTimeout(1200);
      const noAutoplay = await page.evaluate(() => document.querySelector('.ov-ws-content-active .ov-ws-video').paused);
      check('14. Reduced motion: the film does not automatically start playing', noAutoplay, noAutoplay);
      const stableStateVisible = await page.evaluate(() => {
        const active = document.querySelector('.ov-ws-content-active');
        const playBtn = active.querySelector('.ov-ws-play');
        return getComputedStyle(playBtn).display !== 'none'; // a real, usable fallback affordance
      });
      check('Reduced motion: a stable visual state (real play affordance) is shown instead', stableStateVisible, stableStateVisible);
      await page.click('.ov-ws-content-active .ov-ws-play');
      await page.waitForTimeout(500);
      const afterManualPlay = await page.evaluate(() => {
        const v = document.querySelector('.ov-ws-content-active .ov-ws-video');
        return { paused: v.paused, muted: v.muted, controls: v.controls };
      });
      check('Reduced motion: manual play still works and never produces audio', !afterManualPlay.paused && afterManualPlay.muted && !afterManualPlay.controls, afterManualPlay);
      check('JS errors (reduced motion walkthrough)', jsErrors.length === 0, jsErrors);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 15. Product copy remains accessible without playback.
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      const copy = await page.evaluate(() => {
        const out = {};
        document.querySelectorAll('.ov-ws-content').forEach((c) => {
          out[c.dataset.cap] = {
            title: c.querySelector('.ov-ws-panel-title').textContent.trim(),
            desc: c.querySelector('.ov-ws-panel-desc').textContent.trim().length > 0,
          };
        });
        return out;
      });
      const allReadable = Object.values(copy).every((c) => c.title.length > 0 && c.desc);
      check('15. Every product name and description remains readable without any playback happening', allReadable, copy);
      const headingUnchanged = await page.evaluate(() => document.querySelector('#ov-pillars .ov-section-h').textContent.trim());
      check('Section heading copy is unchanged ("Oriven is built for the way you advertise.")', /built for the way you advertise/i.test(headingUnchanged), headingUnchanged);
      await page.close();
    }

    // ════════════════════════════════════════════════════════════
    // 16. Mobile — no horizontal overflow, correct ratio, no audio.
    // ════════════════════════════════════════════════════════════
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const jsErrors = []; page.on('pageerror', (e) => jsErrors.push(e.message));
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(scrollToPillars);
      await page.waitForTimeout(1200);
      const mobileState = await page.evaluate(() => {
        const media = document.querySelector('.ov-ws-content-active .ov-ws-media');
        const v = media.querySelector('.ov-ws-video');
        const r = media.getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, ratio: r.width / r.height, muted: v.muted, playsInline: v.playsInline };
      });
      check('16. No horizontal overflow on mobile', !mobileState.overflow, mobileState.overflow);
      check('Mobile: 16:9 ratio preserved (not the old cropped 4:3/16:10 override)', Math.abs(mobileState.ratio - 16 / 9) < 0.05, mobileState.ratio);
      check('Mobile: muted + playsinline intact', mobileState.muted && mobileState.playsInline, mobileState);
      check('JS errors (mobile walkthrough)', jsErrors.length === 0, jsErrors);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length} checks run, ${results.length - failed.length} passed, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });
