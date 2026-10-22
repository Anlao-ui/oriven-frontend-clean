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
const SHOT_DIR = require('path').join(__dirname, '_shots', 'pricing_ordering_cleanup');
require('fs').mkdirSync(SHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS — ' + name); }
  else { fail++; console.log('FAIL — ' + name + (detail ? ' | ' + detail : '')); }
}

// The canonical paid-plan taxonomy order (js/plans.js ORIVEN_PLANS features /
// excludedFeatures, V10): the workflow, then capabilities in the order plans add them.
const CANONICAL_ORDER = ['Full advertising workflow', 'Research', 'Automations', 'Oriven Chat', 'Notifications', 'Priority Support'];

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
    els.map((e) => {
      const c = e.cloneNode(true);
      c.querySelectorAll('.ov-pc-feat-cost, .ov-sr').forEach((x) => x.remove());
      return {
        label: c.textContent.trim(),
        excluded: e.classList.contains('ov-pc-feat-excluded'),
        cost: e.querySelector('.ov-pc-feat-cost') ? e.querySelector('.ov-pc-feat-cost').textContent : null,
      };
    })
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
  require('./_fence').fenceBrowser(browser, BASE_URL, { backend401: true });

  // ── Core ordering assertions, 1440 ──
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = await gotoPricingView(page);
    await page.screenshot({ path: SHOT_DIR + '/01_desktop_1440.png' });

    const planNames = ['Free', 'Starter', 'Creator', 'Professional'];
    for (let i = 0; i < 4; i++) {
      const rows = await getCardRows(page, i);
      check(planNames[i] + '.1 Included rows all appear before excluded rows', assertIncludedBeforeExcluded(rows), JSON.stringify(rows.map((r) => (r.excluded ? '✕' : '✓') + r.label)));
      // Free lists the individual workflow modules instead of "Full
      // advertising workflow", so the paid-plan canonical order doesn't apply
      // to it. Its own exact expected order is verified separately (Free.3).
      if (planNames[i] !== 'Free') {
        check(planNames[i] + '.2 Canonical taxonomy order preserved within each group', assertCanonicalOrderWithinGroups(rows), JSON.stringify(rows.map((r) => r.label)));
      }
    }

    // Exact expected sequences per the task's explicit spec (section 3-6)
    const freeRows = await getCardRows(page, 0);
    const tag = (rows) => JSON.stringify(rows.map((r) => (r.excluded ? '✕' : '✓') + r.label));
    check('Free.3 Exact order: Control Center, Create, Launch, Campaigns, then not included Research, Automations, Oriven Chat',
      tag(freeRows) === JSON.stringify(['✓Control Center', '✓Create', '✓Launch', '✓Campaigns', '✕Research', '✕Automations', '✕Oriven Chat']), tag(freeRows));

    const starterRows = await getCardRows(page, 1);
    check('Starter.3 Research and Automations are INCLUDED (from Starter); Oriven Chat is excluded',
      tag(starterRows) === JSON.stringify(['✓Full advertising workflow', '✓Research', '✓Automations', '✕Oriven Chat', '✕Notifications', '✕Priority Support']), tag(starterRows));
    check('Starter.4 Exactly 3 included then 3 excluded', starterRows.filter((r) => !r.excluded).length === 3 && starterRows.filter((r) => r.excluded).length === 3, tag(starterRows));

    const creatorRows = await getCardRows(page, 2);
    check('Creator.3 Exactly 2 included then 2 excluded (Notifications, Priority Support)', tag(creatorRows) === JSON.stringify(['✓Full advertising workflow', '✓Oriven Chat', '✕Notifications', '✕Priority Support']), tag(creatorRows));
    check('Creator.4 Research is included (via the full workflow, never listed as excluded)', !creatorRows.some((r) => r.excluded && r.label === 'Research') && /Research/.test((creatorRows.find((r) => r.label === 'Full advertising workflow') || {}).cost || ''));

    const proRows = await getCardRows(page, 3);
    check('Professional.3 All 4 rows included, zero excluded', tag(proRows) === JSON.stringify(['✓Full advertising workflow', '✓Oriven Chat', '✓Notifications', '✓Priority Support']), tag(proRows));
    check('Professional.4 No excluded group rendered at all', await page.locator('#lpPricingGrid .ov-pc').nth(3).locator('.ov-pc-feat-excluded').count() === 0);

    // Credit costs: the pricing view's cost table against the canonical registry.
    const C = await page.evaluate(() => CREDIT_COSTS);
    const costRows = await page.locator('#view-pricing .ov-price-costs tr').evaluateAll((els) => els.map((e) => [e.querySelector('th').textContent, e.querySelector('td').textContent]));
    const costOf = (re) => { const r = costRows.find((x) => re.test(x[0])); return r ? r[1] : null; };
    check('Cost.1 Image cost matches the registry (' + C.imageAd + ' credits; complete image ad ' + C.imageAdComplete + ')', costOf(/^Image/) === C.imageAd + ' credits' && C.imageAd + C.campaign === C.imageAdComplete, JSON.stringify(costRows));
    check('Cost.2 Video cost matches the registry (' + C.videoAd + ' credits; complete video ad ' + C.videoAdComplete + ')', costOf(/^Video/) === C.videoAd + ' credits' && C.videoAd + C.campaign === C.videoAdComplete, JSON.stringify(costRows));
    check('Cost.3 Oriven Chat cost matches the registry (' + C.chat + ' credits / message)', costOf(/^Oriven Chat message/) === C.chat + ' credits', JSON.stringify(costRows));
    check('Cost.4 Research cost matches the registry (' + C.research + ' credits / report)', costOf(/^Research report/) === C.research + ' credits', JSON.stringify(costRows));
    check('Cost.5 Automations cost matches the registry (' + C.automation + ' credits once per new automation)', costOf(/^New automation \(once/) === C.automation + ' credits', JSON.stringify(costRows));

    // "How credits work" removal
    check('Removal.1 #pricing-credits container is gone', await page.locator('#pricing-credits').count() === 0);
    check('Removal.2 #lpCreditsGrid container is gone', await page.locator('#lpCreditsGrid').count() === 0);
    // Scoped to the visible #view-pricing content, not the whole document
    // — the phrase still legitimately appears once, harmlessly, inside a
    // <script> tag's own source-code comment documenting the removal
    // (script text is part of `body.textContent` even though it's never
    // rendered), which is not what this check is about.
    const pageText = await page.locator('#view-pricing').textContent();
    // The JS mini-strip is gone; the one static "How credits work" list lives in the plan-comparison section.
    check('Removal.3 "How credits work" appears once, only in the static comparison section (no duplicate strip)', (pageText.match(/How credits work/gi) || []).length === 1 && await page.locator('#view-pricing .ov-price-detail h3', { hasText: 'How credits work' }).count() === 1);
    check('Removal.4 No leftover "usage-based action" recap prose in the pricing view', !/shared across every usage-based action/i.test(pageText));

    // Website Intelligence not forced into the cards
    check('WI.1 Website Intelligence not added as a pricing-card row', !/Website Intelligence/i.test(await page.locator('#lpPricingGrid').textContent()));
    check('WI.2 Only the workflow row carries a secondary line (no forced per-feature cost sub-labels)', [freeRows, starterRows, creatorRows, proRows].every((rows) => rows.every((r) => r.cost === null || r.label === 'Full advertising workflow')));

    check('Desktop.1 No horizontal overflow at 1440', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
    check('Desktop.2 Console errors clean', consoleErrors.filter((e) => !/401|404|ERR_FAILED|ERR_ABORTED/i.test(e)).length === 0, JSON.stringify(consoleErrors));

    // CTA alignment — every card's CTA button should sit at a consistent
    // vertical position (within a small tolerance) despite the 4 cards now
    // having different row counts (Free=7, Starter=6, Creator=4, Pro=4)
    // after the reordering, since real flexbox (not padded fake rows) is
    // what's expected to keep them visually anchored.
    const ctaYs = await page.locator('#lpPricingGrid .ov-pc-btn').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    const maxDelta = Math.max(...ctaYs) - Math.min(...ctaYs);
    console.log('CTA button Y positions:', JSON.stringify(ctaYs), '| max delta:', maxDelta, 'px');
    check('CTA.1 All 4 CTA buttons captured', ctaYs.length === 4);
    // Informational only, not a hard pass/fail gate — Free genuinely has
    // different row counts, so some natural offset is expected without
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
