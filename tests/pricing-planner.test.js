/* ════════════════════════════════════════════════════════════════
   Pricing page: "Create Your Own Plan" and the currency selector
   (js/pricingPlanner.js).

   A. The recommendation and the currency formatting, in Node, against the
      real plan configuration in js/plans.js.
   B. The /pricing page in a browser: sliders, the recommendation, the CTA
      (same path as the plan cards), and the currency selector with stubbed
      exchange rates, including a failing rate service.

   SAFE: static server on :8899 only; the network fence (tests/_fence.js)
   aborts everything else. Exchange rates are answered in the test; no
   Supabase, no Stripe, no backend.
   RUN: node tests/pricing-planner.test.js  (static server on :8899)
   ════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), vm = require('vm');

const BASE_URL = 'http://localhost:8899';
const CHROME_PATH = process.env.TEST_CHROME_PATH || 'C:/Users/Aleck/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS — ' + name); }
  else { fail++; console.log('FAIL — ' + name + (detail !== undefined ? ' | ' + JSON.stringify(detail).slice(0, 400) : '')); }
}

// The real plan configuration, as the page loads it.
const sb = { window: {}, document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; } }, console };
sb.window = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'plans.js'), 'utf8') + '\n;this.__P = { ORIVEN_PERIOD_PLANS, ORIVEN_PRICING };', sb);
const PLANS = sb.__P.ORIVEN_PERIOD_PLANS, FC = sb.__P.ORIVEN_PRICING.featureCosts;
const PP = require('../js/pricingPlanner.js');
const rec = (campaigns, images, videos, days) => PP.recommendPlan({ campaigns, images, videos, days }, PLANS, FC);

const RATES = { EUR: 1, USD: 1.0812, GBP: 0.8412, CHF: 0.9381, CAD: 1.5034, AUD: 1.6521, INR: 90.115, JPY: 163.42, SEK: 11.452, NOK: 11.873, DKK: 7.4589, PLN: 4.2655 };

(async () => {
  console.log('\nA. Recommendation (local, from js/plans.js)');
  const usage = (c, i, v) => c * FC.campaign_generation + i * FC.image_generation + v * FC.video_generation;
  let r = rec(3, 10, 2, 90);
  check('the estimate uses the real credit costs (campaign draft 65, image 55, 5 s video 180)', r.monthly === usage(3, 10, 2) && r.monthly === 1105, r.monthly);
  check('default sliders (3 campaigns, 10 images, 2 videos, 3 months) → Quarterly, one purchase, €78', r.plan.id === 'quarterly' && r.purchases === 1 && r.cost === 78 && r.covered, r);
  r = rec(1, 2, 1, 14);
  check('light use for 2 weeks → Flex (€17)', r.plan.id === 'flex' && r.cost === 17, r);
  r = rec(3, 10, 2, 30);
  check('1 month → Monthly (€29)', r.plan.id === 'monthly' && r.cost === 29, r);
  r = rec(3, 10, 2, 180);
  check('6 months, ≤ 1.475 credits a month → Semi-Annual (€143), cheaper than 2× Quarterly or 6× Monthly', r.plan.id === 'semiannual' && r.cost === 143, r);
  r = rec(3, 10, 2, 360);
  check('12 months, ≤ 1.250 credits a month → Annual (€245)', r.plan.id === 'annual' && r.cost === 245 && r.purchases === 1, r);
  const reachable = new Set();
  const S = PP.ORV_PLANNER_SLIDERS;
  for (const c of S[0].values) for (const i of S[1].values) for (const v of S[2].values) for (const d of S[3].values) reachable.add(rec(c, i, v, d).plan.id);
  check('every one of the five plans is recommended for some slider position', ['flex', 'monthly', 'quarterly', 'semiannual', 'annual'].every((id) => reachable.has(id)), [...reachable]);

  r = rec(5, 15, 2, 360);   // 325 + 825 + 360 = 1510 a month: more than Annual (1.250) or Semi-Annual (1.475) add a month
  check('12 months but 1.510 credits a month: Annual is not recommended (its 1.250 a month fall short); Quarterly ×4 is', r.plan.id === 'quarterly' && r.purchases === 4 && r.cost === 312 && r.covered, r);
  check('…and the explanation names the cheaper plan that falls short', r.cheaperShort && r.cheaperShort.plan.id === 'annual', r.cheaperShort && r.cheaperShort.plan.id);
  r = rec(20, 40, 12, 90);  // 1300 + 2200 + 2160 = 5660 a month
  check('use beyond any plan: flagged as not covered, a one-payment plan bought often enough to cover the credits', !r.covered && r.plan.instalments === 1 && r.purchases * r.plan.credits >= r.monthly * 3, r);
  for (const d of S[3].values) for (const c of [1, 8, 20]) {
    const x = rec(c, 10, 2, d);
    const len = x.plan.days || x.plan.months * 30;
    if (x.covered && !(x.purchases * len >= d && x.monthly <= x.perMonth)) { check('every covered recommendation covers the duration and the monthly use', false, x); break; }
  }
  check('every covered recommendation covers both the duration and the monthly use (all durations checked)', true);
  check('deterministic: the same input gives the same answer', JSON.stringify(rec(8, 25, 5, 150)) === JSON.stringify(rec(8, 25, 5, 150)));
  check('prices and credits come from js/plans.js unchanged', PLANS.map((p) => p.id + ':' + p.price + ':' + p.credits).join(',') === 'flex:17:1050,monthly:29:1750,quarterly:78:4800,semiannual:143:8850,annual:245:15000');

  console.log('\nA2. Currency formatting (display only)');
  const f = (eur, c) => PP.formatApprox(eur, c, RATES);
  check('EUR is never converted: €29, €23.83', PP.formatEur(29) === '€29' && PP.formatEur(23.83) === '€23.83' && f(29, 'EUR') === '€29');
  check('USD: ≈ $31 for €29', f(29, 'USD') === '≈ $31', f(29, 'USD'));
  check('GBP: ≈ £24', f(29, 'GBP') === '≈ £24', f(29, 'GBP'));
  check('CHF: ≈ CHF 27 (code with a space)', f(29, 'CHF') === '≈ CHF 27', f(29, 'CHF'));
  check('CAD / AUD: C$ and A$', f(29, 'CAD') === '≈ C$44' && f(29, 'AUD') === '≈ A$48', [f(29, 'CAD'), f(29, 'AUD')]);
  check('INR: Indian digit grouping (≈ ₹22,078 for €245)', f(245, 'INR') === '≈ ₹22,078', f(245, 'INR'));
  check('JPY: no decimals, grouped (≈ ¥40,038 for €245)', f(245, 'JPY') === '≈ ¥40,038', f(245, 'JPY'));
  const sek = f(245, 'SEK'), pln = f(245, 'PLN');
  check("SEK / NOK / DKK / PLN: symbol after the number, each country's grouping (Polish leaves 4 digits ungrouped, Danish uses a dot)", /^≈ 2\s806 kr$/.test(sek) && pln === '≈ 1045 zł' && /^≈ 2\s909 kr$/.test(f(245, 'NOK')) && f(245, 'DKK') === '≈ 1.827 kr', [sek, pln, f(245, 'NOK'), f(245, 'DKK')]);
  check('all 12 required currencies are offered, EUR first', PP.ORV_CURRENCIES.map((c) => c.code).join(',') === 'EUR,USD,GBP,CHF,CAD,AUD,INR,JPY,SEK,NOK,DKK,PLN');
  check('a missing rate falls back to the EUR price, never a wrong number', PP.formatApprox(29, 'USD', { EUR: 1 }) === '€29' && PP.formatApprox(29, 'USD', null) === '€29');

  console.log('\nB. The /pricing page');
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (_) { console.log('SKIPPED B — playwright not installed'); return done(); }
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const fence = require('./_fence').fenceBrowser(browser, BASE_URL);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let rateCalls = 0, rateMode = 'ok';
  const apiCalls = [];
  page.on('request', (q) => { if (/localhost:5500|onrender\.com/.test(q.url())) apiCalls.push(q.url()); });
  await page.route(/\/api\/exchange-rates$/, (route) => {
    rateCalls++;
    if (rateMode === 'fail') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable', code: 'RATES_UNAVAILABLE', base: 'EUR' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ base: 'EUR', date: '2026-11-04', rates: RATES, stale: false }) });
  });
  await page.goto(BASE_URL + '/pricing.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const cards = () => page.$$eval('#lpPricingGrid .ov-pc', (els) => els.map((e) => ({ id: e.dataset.plan, price: e.querySelector('.ov-pc-price-num').textContent, credits: e.querySelector('.ov-pc-credits').textContent, dur: e.querySelector('.ov-pc-duration').textContent, href: e.querySelector('.ov-pc-btn').getAttribute('href') })));
  const before = await cards();
  check('the five plan cards are unchanged: EUR prices, credits, durations, links', JSON.stringify(before.map((c) => [c.id, c.price, c.credits, c.dur, c.href])) === JSON.stringify([
    ['flex', '€17', '1.050 credits', '14 days of access', '/app?plan=flex'], ['monthly', '€29', '1.750 credits', '1 month of access', '/app?plan=monthly'],
    ['quarterly', '€78', '4.800 credits · 1.600 a month', '3 months of access · €26 per month', '/app?plan=quarterly'],
    ['semiannual', '€143', '8.850 credits · 1.475 a month', '6 months of access · €23.83 per month', '/app?plan=semiannual'],
    ['annual', '€245', '15.000 credits · 1.250 a month', '12 months of access · €20.42 per month', '/app?plan=annual']]), before);

  const result = () => page.evaluate(() => {
    const b = document.getElementById('orvPpResult');
    return { plan: b.querySelector('.orv-pp-plan').textContent, price: b.querySelector('.orv-pp-price').textContent, credits: b.querySelector('.orv-pp-credits').textContent, href: b.querySelector('.orv-pp-cta').getAttribute('href'), cta: b.querySelector('.orv-pp-cta').textContent, why: b.querySelector('.orv-pp-why').textContent };
  });
  const setSlider = (key, idx) => page.evaluate(({ key, idx }) => { const el = document.getElementById('orvPp-' + key); el.value = String(idx); el.dispatchEvent(new Event('input', { bubbles: true })); return document.getElementById('orvPp-' + key + '-out').textContent; }, { key, idx });
  check('section heading and subtitle', await page.evaluate(() => document.getElementById('orv-pp-h').textContent === 'Create Your Own Plan' && /We'll find the perfect plan for you/.test(document.querySelector('.orv-pp-sub').textContent)));
  check('four sliders with their questions and end labels', await page.evaluate(() => document.querySelectorAll('#orvPlanner .orv-pp-range').length === 4 && /How long do you plan to use OrivenAI\?/.test(document.getElementById('orvPlanner').textContent) && /Very few/.test(document.getElementById('orvPlanner').textContent)));
  let r0 = await result();
  check('default recommendation: Quarterly, €78 / 3 months, 4.800 credits, "Choose This Plan"', r0.plan === 'Quarterly' && r0.price === '€78 / 3 months' && /4\.800 credits/.test(r0.credits) && r0.cta === 'Choose This Plan' && r0.href === '/app?plan=quarterly', r0);
  const callsBefore = apiCalls.length;
  check('slider value text updates immediately', (await setSlider('days', 12)) === '12 months' && (await setSlider('campaigns', 0)) === '1 campaign a month');
  r0 = await result();
  check('…and the recommendation follows: 12 months → Annual', r0.plan === 'Annual' && r0.href === '/app?plan=annual', r0);
  await setSlider('days', 0); await setSlider('images', 0); await setSlider('videos', 0);
  check('2 weeks, light use → Flex', (await result()).plan === 'Flex');
  await setSlider('days', 6); await setSlider('images', 2); await setSlider('videos', 1); await setSlider('campaigns', 2);
  check('6 months → Semi-Annual', (await result()).plan === 'Semi-Annual');
  await setSlider('days', 1);
  check('1 month → Monthly', (await result()).plan === 'Monthly');
  for (let i = 0; i < 20; i++) await setSlider('images', i % 6);
  check('moving sliders makes no network request at all', apiCalls.length === callsBefore && rateCalls === 0, apiCalls.slice(callsBefore));

  // CTA: the same path as the plan's own card.
  await setSlider('days', 3); await setSlider('images', 2); await setSlider('videos', 1); await setSlider('campaigns', 2);
  await page.click('#orvPpResult .orv-pp-cta');
  await page.waitForTimeout(500);
  const afterCta = await page.evaluate(() => ({ path: location.pathname, choice: JSON.parse(localStorage.getItem('oriven_selected_plan') || 'null') }));
  check('"Choose This Plan" remembers the plan id and goes to account creation, exactly like the plan cards', afterCta.choice && afterCta.choice.id === 'quarterly' && /\/signup|\/index\.html|\/$/.test(afterCta.path), afterCta);

  // Currency selector.
  await page.goto(BASE_URL + '/pricing.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  check('compact selector: "Currency" with all 12 currencies, EUR selected, the EUR note shown', await page.evaluate(() => {
    const s = document.getElementById('orvCurSelect');
    return s && s.options.length === 12 && s.value === 'EUR' && /Prices in other currencies are estimates\. All payments are processed in EUR\./.test(document.getElementById('orvCurNote').textContent);
  }));
  const pick = async (code) => { await page.selectOption('#orvCurSelect', code); await page.waitForTimeout(200); };
  await pick('USD');
  let c = await cards();
  check('USD: every card price converted approximately (≈ $18 … ≈ $265), the per-month line too (without "≈", to keep its width)', c.map((x) => x.price).join('|') === '≈ $18|≈ $31|≈ $84|≈ $155|≈ $265' && c[2].dur === '3 months of access · $28 per month', c.map((x) => [x.price, x.dur]));
  check('…credits and durations unchanged; card links still /app?plan=<id> (no amount, no currency)', c.map((x) => x.credits).join('|') === before.map((x) => x.credits).join('|') && c.every((x, i) => x.href === before[i].href));
  check('…the recommendation and the comparison table are converted as well', await page.evaluate(() => /^≈ \$84 \/ 3 months$/.test(document.querySelector('#orvPpResult .orv-pp-price').textContent) && Array.from(document.querySelectorAll('.ov-pd-table [data-eur]')).map((e) => e.textContent).join('|') === '≈ $18|≈ $31|≈ $84|≈ $155|≈ $265'));
  check('…with the source and date of the rates in the note', await page.evaluate(() => /European Central Bank, 2026-11-04/.test(document.getElementById('orvCurNote').textContent)));
  for (const code of ['GBP', 'CHF', 'CAD', 'AUD', 'INR', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN']) await pick(code);
  check('switching through all 12 currencies used one rate request (cached)', rateCalls === 1, rateCalls);
  check('PLN: ≈ 124 zł for Monthly', (await cards())[1].price === '≈ 124 zł', (await cards())[1].price);
  await setSlider('days', 6);
  check('the recommendation re-renders in the chosen currency', /zł/.test(await page.evaluate(() => document.querySelector('#orvPpResult .orv-pp-price').textContent)));
  await pick('EUR');
  c = await cards();
  check('back to EUR restores the original prices exactly', JSON.stringify(c) === JSON.stringify(before), c);
  check('…and the comparison table', await page.evaluate(() => Array.from(document.querySelectorAll('.ov-pd-table [data-eur]')).map((e) => e.textContent).join('|') === '€17|€29|€78|€143|€245'));

  await pick('GBP');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  check('the chosen currency is remembered on the next visit, without a new rate request (browser cache)', (await page.$eval('#orvCurSelect', (s) => s.value)) === 'GBP' && (await cards())[1].price === '≈ £24' && rateCalls === 1, rateCalls);

  // The rate service fails: EUR, with a clear message.
  await page.evaluate(() => { localStorage.removeItem('orv_fx_rates_v1'); localStorage.removeItem('orv_display_currency'); });
  await page.reload({ waitUntil: 'networkidle' });
  rateMode = 'fail';
  await pick('USD');
  await page.waitForTimeout(200);
  const failed = await page.evaluate(() => ({ sel: document.getElementById('orvCurSelect').value, msg: document.getElementById('orvCurMsg').textContent, price: document.querySelector('#lpPricingGrid .ov-pc-price-num').textContent }));
  check('exchange rates unavailable → stays in EUR, says why, prices untouched', failed.sel === 'EUR' && /unavailable right now, so prices are shown in EUR/.test(failed.msg) && failed.price === '€17', failed);
  check('no page errors', errors.length === 0, errors);
  // /api/t is the site's existing page-view beacon (js/site-analytics.js), blocked by the fence.
  check('nothing left the browser (the existing page-view beacon was blocked; rates were answered in the test)', fence.blocked.filter((u) => !/\/api\/t$/.test(u)).length === 0, fence.blocked);
  await browser.close();
  done();

  function done() { console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`); process.exit(fail ? 1 : 0); }
})().catch((e) => { console.error(e); process.exit(1); });
