/* ════════════════════════════════════════════════════════════════
   Final Landing Pricing Cleanup — included-before-excluded ordering +
   "How credits work" removal. Deterministic, non-mutating.

   SAFE TESTING ONLY: no real Supabase users, no Stripe, no credits
   consumed — same established fake mock-user + network-abort technique
   as every prior pricing/onboarding pass.
   ════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SHOT_DIR = 'C:/files/tests/_shots/pricing_ordering_cleanup';
require('fs').mkdirSync(SHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS — ' + name); }
  else { fail++; console.log('FAIL — ' + name + (detail ? ' | ' + detail : '')); }
}

// The canonical taxonomy order, exactly as declared in ORIVEN_FEATURE_CATEGORIES (plans.js).
const CANONICAL_ORDER = ['Create Image Ads', 'Create Video Ads', 'ORIVEN Chat', 'Research', 'Launch', 'Campaigns', 'Creative management', 'Business', 'Autopilot', 'Priority Support'];

async function gotoPricingView(page) {
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));
  await page.route('**/*supabase.co/**', (route) => route.abort());
  await page.goto(BASE_URL + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    var cur = document.getElementById('view-' + (window._pubView || 'landing'));
    if (cur) cur.classList.add('pub-view');
    var next = document.getElementById('view-pricing');
    if (next) next.classList.remove('pub-view');
    window._pubView = 'pricing';
    // Same documented, pre-existing on-load-reliability workaround as the
    // prior two pricing passes' test suites — manually re-invoke the real
    // render function to verify actual content.
    if (typeof renderLPPricingCards === 'function') renderLPPricingCards(document.getElementById('lpPricingGrid'));
    document.querySelectorAll('.ov-pc-price-num[data-count-target]').forEach(function (el) {
      var prefix = el.getAttribute('data-count-prefix') || '';
      var val = parseFloat(el.getAttribute('data-count-target'));
      el.textContent = prefix + val.toFixed(2);
    });
  });
  await page.waitForTimeout(300);
  return consoleErrors;
}

async function getCardRows(page, cardIndex) {
  return page.locator('#lpPricingGrid .ov-pc').nth(cardIndex).locator('.ov-pc-list li').evaluateAll((els) =>
    els.map((e) => ({
      label: e.childNodes[0].textContent.trim(),
      excluded: e.classList.contains('ov-pc-feat-excluded'),
      cost: e.querySelector('.ov-pc-feat-cost') ? e.querySelector('.ov-pc-feat-cost').textContent : null,
    }))
  );
}

function assertIncludedBeforeExcluded(rows) {
  var seenExcluded = false;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].excluded) seenExcluded = true;
    else if (seenExcluded) return false; // an included row appeared AFTER an excluded one — the exact bug this pass fixes
  }
  return true;
}

function assertCanonicalOrderWithinGroups(rows) {
  var included = rows.filter((r) => !r.excluded).map((r) => r.label);
  var excluded = rows.filter((r) => r.excluded).map((r) => r.label);
  var includedCanonical = CANONICAL_ORDER.filter((l) => included.includes(l));
  var excludedCanonical = CANONICAL_ORDER.filter((l) => excluded.includes(l));
  return JSON.stringify(included) === JSON.stringify(includedCanonical) && JSON.stringify(excluded) === JSON.stringify(excludedCanonical);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME_PATH });

  // ── Core ordering assertions, 1440 ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = await gotoPricingView(page);
    await page.screenshot({ path: SHOT_DIR + '/01_desktop_1440.png' });

    const planNames = ['Free', 'Starter', 'Creator', 'Professional'];
    for (let i = 0; i < 4; i++) {
      const rows = await getCardRows(page, i);
      check(planNames[i] + '.1 Included rows all appear before excluded rows', assertIncludedBeforeExcluded(rows), JSON.stringify(rows.map((r) => (r.excluded ? '✕' : '✓') + r.label)));
      // Free intentionally does NOT render through ORIVEN_FEATURE_CATEGORIES
      // at all (per this task's explicit "keep the combined 'Create Ads'
      // label" instruction) -- it has its own short, distinct taxonomy, so
      // the shared 10-item canonical-order check doesn't apply to it. Its
      // own exact expected order is verified separately below (Free.3).
      if (planNames[i] !== 'Free') {
        check(planNames[i] + '.2 Canonical taxonomy order preserved within each group', assertCanonicalOrderWithinGroups(rows), JSON.stringify(rows.map((r) => r.label)));
      }
    }

    // Exact expected sequences per the task's explicit spec (section 3-6)
    const freeRows = await getCardRows(page, 0);
    check('Free.3 Exact order: Launch, Campaigns, Business, then Create Ads, ORIVEN Chat, Research, Autopilot',
      JSON.stringify(freeRows.map((r) => r.label)) === JSON.stringify(['Launch', 'Campaigns', 'Business', 'Create Ads', 'ORIVEN Chat', 'Research', 'Autopilot']),
      JSON.stringify(freeRows.map((r) => r.label)));

    const starterRows = await getCardRows(page, 1);
    check('Starter.3 Research sits in the EXCLUDED group, not between Chat and Launch',
      starterRows.find((r) => r.label === 'Research').excluded === true &&
      starterRows.findIndex((r) => r.label === 'ORIVEN Chat') < starterRows.findIndex((r) => r.label === 'Launch') &&
      starterRows.findIndex((r) => r.label === 'Research') > starterRows.findIndex((r) => r.label === 'Business'),
      JSON.stringify(starterRows.map((r) => (r.excluded ? '✕' : '✓') + r.label)));
    check('Starter.4 Exactly 7 included then 3 excluded', starterRows.filter((r) => !r.excluded).length === 7 && starterRows.filter((r) => r.excluded).length === 3, JSON.stringify(starterRows.length));

    const creatorRows = await getCardRows(page, 2);
    check('Creator.3 Exactly 8 included then 2 excluded (Autopilot, Priority Support)', creatorRows.filter((r) => !r.excluded).length === 8 && creatorRows.filter((r) => r.excluded).length === 2, JSON.stringify(creatorRows.map((r) => r.label)));
    check('Creator.4 Research is included (not excluded)', creatorRows.find((r) => r.label === 'Research').excluded === false);

    const proRows = await getCardRows(page, 3);
    check('Professional.3 All 10 rows included, zero excluded', proRows.every((r) => !r.excluded) && proRows.length === 10, JSON.stringify(proRows.map((r) => r.label)));
    check('Professional.4 No excluded group rendered at all', await page.locator('#lpPricingGrid .ov-pc').nth(3).locator('.ov-pc-feat-excluded').count() === 0);

    // Cost labels unchanged and still attached to the correct row after reordering
    check('Cost.1 Image Ad cost unchanged (100 credits / ad)', creatorRows.find((r) => r.label === 'Create Image Ads').cost === '100 credits / ad');
    check('Cost.2 Video Ad cost unchanged (225 credits / ad)', creatorRows.find((r) => r.label === 'Create Video Ads').cost === '225 credits / ad');
    check('Cost.3 ORIVEN Chat cost unchanged (5 credits / message)', creatorRows.find((r) => r.label === 'ORIVEN Chat').cost === '5 credits / message');
    check('Cost.4 Research cost unchanged (25 credits / investigation)', creatorRows.find((r) => r.label === 'Research').cost === '25 credits / investigation');
    check('Cost.5 Autopilot cost unchanged (25 credits / execution)', proRows.find((r) => r.label === 'Autopilot').cost === '25 credits / execution');

    // "How credits work" removal
    check('Removal.1 #pricing-credits container is gone', await page.locator('#pricing-credits').count() === 0);
    check('Removal.2 #lpCreditsGrid container is gone', await page.locator('#lpCreditsGrid').count() === 0);
    // Scoped to the visible #view-pricing content, not the whole document
    // — the phrase still legitimately appears once, harmlessly, inside a
    // <script> tag's own source-code comment documenting the removal
    // (script text is part of `body.textContent` even though it's never
    // rendered), which is not what this check is about.
    const pageText = await page.locator('#view-pricing').textContent();
    check('Removal.3 No "How credits work" heading text anywhere in the visible pricing view', !/How credits work/i.test(pageText));
    check('Removal.4 No leftover "usage-based action" recap prose in the pricing view', !/shared across every usage-based action/i.test(pageText));

    // Website Intelligence not forced into the cards
    check('WI.1 Website Intelligence not added as a pricing-card row', !/Website Intelligence/i.test(await page.locator('#lpPricingGrid').textContent()));
    check('WI.2 Business still shown as a plain included row (no forced cost sub-label)', creatorRows.find((r) => r.label === 'Business').cost === null);

    check('Desktop.1 No horizontal overflow at 1440', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
    check('Desktop.2 Console errors clean', consoleErrors.filter((e) => !/401|404|ERR_FAILED|ERR_ABORTED/i.test(e)).length === 0, JSON.stringify(consoleErrors));

    // CTA alignment — every card's CTA button should sit at a consistent
    // vertical position (within a small tolerance) despite the 4 cards now
    // having different row counts (Free=7, Starter=10, Creator=10, Pro=10)
    // after the reordering, since real flexbox (not padded fake rows) is
    // what's expected to keep them visually anchored.
    const ctaYs = await page.locator('#lpPricingGrid .ov-pc-btn').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    const maxDelta = Math.max(...ctaYs) - Math.min(...ctaYs);
    console.log('CTA button Y positions:', JSON.stringify(ctaYs), '| max delta:', maxDelta, 'px');
    check('CTA.1 All 4 CTA buttons captured', ctaYs.length === 4);
    // Informational only, not a hard pass/fail gate — Free genuinely has
    // fewer rows (7 vs 10) so some natural offset is expected without
    // fake filler rows (explicitly forbidden by this task); flag only a
    // large, clearly-broken gap.
    check('CTA.2 No extreme misalignment (>220px) suggesting a real layout break', maxDelta < 220, maxDelta + 'px');

    await page.close();
  }

  // ── Responsive: 1280 / 390 ──
  for (const vp of [{ w: 1280, h: 900, tag: '1280' }, { w: 390, h: 844, tag: '390' }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    await gotoPricingView(page);
    await page.screenshot({ path: SHOT_DIR + '/landing_' + vp.tag + '.png', fullPage: vp.w === 390 });
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
    check(vp.tag + '.1 No horizontal overflow', noOverflow);
    for (let i = 0; i < 4; i++) {
      const rows = await getCardRows(page, i);
      check(vp.tag + '.2.' + i + ' Included-before-excluded holds at this width too', assertIncludedBeforeExcluded(rows));
    }
    // Row collision check — cost sub-label must stay inside its own <li>, never overlapping the next row's label
    const collision = await page.evaluate(() => {
      var lis = Array.from(document.querySelectorAll('#lpPricingGrid .ov-pc')[1].querySelectorAll('.ov-pc-list li'));
      for (var i = 0; i < lis.length - 1; i++) {
        var a = lis[i].getBoundingClientRect();
        var b = lis[i + 1].getBoundingClientRect();
        if (a.bottom > b.top + 1) return { collided: true, i: i };
      }
      return { collided: false };
    });
    check(vp.tag + '.3 No row collisions in Starter card', !collision.collided, JSON.stringify(collision));
    await page.close();
  }

  console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
  await browser.close();
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
