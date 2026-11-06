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
const rec = (campaigns, automations, research, days) => PP.recommendPlan({ campaigns, automations, research, days }, PLANS, FC);
const S = PP.ORV_PLANNER_SLIDERS;
const at = (ci, ai, ri, di) => rec(S[0].values[ci], S[1].values[ai], S[2].values[ri], S[3].values[di]);
const LAST = S.map((s) => s.values.length - 1);
const label = (x) => x.plan.id + '×' + x.purchases + (x.extra ? '+' + x.extra.plan.id + '×' + x.extra.purchases : '') + ' €' + x.cost;

const RATES = { EUR: 1, USD: 1.0812, GBP: 0.8412, CHF: 0.9381, CAD: 1.5034, AUD: 1.6521, INR: 90.115, JPY: 163.42, SEK: 11.452, NOK: 11.873, DKK: 7.4589, PLN: 4.2655 };

(async () => {
  console.log('\nA. Recommendation (local, from js/plans.js)');
  check('exactly four sliders: campaigns, automation, research, duration', S.map((s) => s.key).join(',') === 'campaigns,automations,research,days');
  check('no image or video sliders any more', !S.some((s) => /image|video/i.test(s.key + s.label)));
  check('duration runs from 2 weeks to 12 months', S[3].values[0] === 14 && S[3].values[LAST[3]] === 360);
  const parts = PP.usageParts({ campaigns: 3, automations: 2, research: 4 }, FC);
  check('the estimate uses the real credit costs: campaign = ad text + image (65 + 55), research report 90, new automation 20',
    parts.campaigns === 3 * (FC.campaign_generation + FC.image_generation) && parts.campaigns === 360 && parts.research === 4 * FC.research_report && parts.research === 360 && parts.automations === 2 * FC.automation && parts.automations === 40, parts);
  let r = at(1, 1, 1, 3);
  check('default sliders (2 campaigns, regular automation and research, 3 months) → Quarterly €78', r.plan.id === 'quarterly' && r.purchases === 1 && r.cost === 78 && r.monthly === 460, label(r));
  r = at(0, 0, 0, 0);
  check('all sliders at minimum → Flex (€17)', r.plan.id === 'flex' && r.cost === 17 && r.purchases === 1 && r.covered, label(r));
  r = at(LAST[0], LAST[1], LAST[2], LAST[3]);
  check('all sliders at maximum (1.570 credits a month for 12 months) → not Annual: its 1.250 a month fall short; Quarterly ×4 (€312) adds 1.600 a month', r.plan.id === 'quarterly' && r.purchases === 4 && r.cost === 312 && r.monthly === 1570 && r.covered, label(r));
  check('…and the explanation names Annual as the cheaper plan that falls short', r.cheaperShort && r.cheaperShort.plan.id === 'annual', r.cheaperShort && r.cheaperShort.plan.id);
  r = at(0, 0, 0, LAST[3]);
  check('light use for 12 months → Annual (€245)', r.plan.id === 'annual' && r.cost === 245 && !r.extra, label(r));
  // Duration
  const durs = [[0, 'flex'], [1, 'monthly'], [3, 'quarterly'], [6, 'semiannual'], [12, 'annual']].map(([d, id]) => [id, at(0, 0, 0, d).plan.id]);
  check('increasing duration moves light use Flex → Monthly → Quarterly → Semi-Annual → Annual', durs.every(([want, got]) => want === got), durs);
  // Usage moves the answer once a plan's monthly credits run short.
  const c4 = rec(4, 8, 5, 360), c6 = rec(6, 8, 5, 360);
  check('increasing campaigns (4 → 6, 12 months) changes Annual → Semi-Annual ×2', c4.plan.id === 'annual' && c6.plan.id === 'semiannual' && c6.purchases === 2, [label(c4), label(c6)]);
  const a1 = rec(6, 1, 5, 360), a5 = rec(6, 5, 5, 360);
  check('increasing automation (1 → 5 new a month, 12 months) changes Annual → Semi-Annual ×2', a1.plan.id === 'annual' && a5.plan.id === 'semiannual', [label(a1), label(a5), a1.monthly, a5.monthly]);
  const r2 = rec(8, 1, 2, 360), r5 = rec(8, 1, 5, 360);
  check('increasing research (2 → 5 reports a month, 12 months) changes Annual → Semi-Annual ×2', r2.plan.id === 'annual' && r5.plan.id === 'semiannual', [label(r2), label(r5)]);
  const s6lo = at(0, 0, 0, 6), s6hi = at(LAST[0], LAST[1], LAST[2], 6);
  check('6 months: light use → Semi-Annual (€143); heavy use → Quarterly ×2 (€156), whose 1.600 a month cover it', s6lo.plan.id === 'semiannual' && s6lo.cost === 143 && s6hi.plan.id === 'quarterly' && s6hi.purchases === 2 && s6hi.cost === 156, [label(s6lo), label(s6hi)]);
  // Value for money: a main plan plus a shorter one for the remaining time.
  r = at(0, 0, 0, 7);
  check('7 months, light use → Semi-Annual + Monthly (€172), cheaper than Monthly ×7 (€203)', r.plan.id === 'semiannual' && r.extra && r.extra.plan.id === 'monthly' && r.extra.purchases === 1 && r.cost === 172, label(r));
  // Every slider combination.
  const reachable = new Set(); let worst = null, n = 0;
  for (let ci = 0; ci <= LAST[0]; ci++) for (let ai = 0; ai <= LAST[1]; ai++) for (let ri = 0; ri <= LAST[2]; ri++) for (let di = 0; di <= LAST[3]; di++) {
    const x = at(ci, ai, ri, di); n++;
    reachable.add(x.plan.id);
    const len = (p) => p.days || p.months * 30;
    const timeOk = x.purchases * len(x.plan) + (x.extra ? x.extra.purchases * len(x.extra.plan) : 0) >= x.days;
    const creditsOk = x.covered && x.monthly <= x.perMonth && (!x.extra || x.monthly <= x.extra.perMonth);
    const cheapest = PLANS.every((p) => { const k = Math.max(1, Math.ceil(x.days / len(p) - 1e-9)); const per = p.credits / len(p) * 30; return per < x.monthly || k * p.price >= x.cost; });
    if (!(timeOk && creditsOk && cheapest)) { worst = { at: [ci, ai, ri, di], rec: label(x), timeOk, creditsOk, cheapest }; break; }
  }
  check('every one of the five plans is recommended for some slider position', ['flex', 'monthly', 'quarterly', 'semiannual', 'annual'].every((id) => reachable.has(id)), [...reachable]);
  check('all ' + n + ' slider combinations: never above a plan\'s monthly credits, the whole duration covered, never dearer than buying one sufficient plan', !worst, worst);
  r = rec(30, 8, 5, 90);  // 3.600 + 160 + 450 a month: more than any plan adds
  check('use beyond any plan (direct call): flagged as not covered, a one-payment plan bought often enough', !r.covered && r.plan.instalments === 1 && r.purchases * r.plan.credits >= r.monthly * 3, label(r));
  check('deterministic: the same input gives the same answer', JSON.stringify(at(2, 2, 2, 8)) === JSON.stringify(at(2, 2, 2, 8)));
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
  check('section heading and subtitle', await page.evaluate(() => document.getElementById('orv-pp-h').textContent === 'Create Your Own Plan' && /costs the least while giving you enough credits/.test(document.querySelector('.orv-pp-sub').textContent)));
  const sliders = await page.evaluate(() => Array.from(document.querySelectorAll('#orvPlanner .orv-pp-label')).map((l) => l.firstChild.textContent.trim()));
  check('four sliders: Campaigns, Automation, Research, Duration — no image or video sliders', JSON.stringify(sliders) === JSON.stringify(['Campaigns', 'Automation', 'Research', 'Duration']), sliders);
  check('plain questions and end labels', await page.evaluate(() => { const t = document.getElementById('orvPlanner').textContent; return /How many ad campaigns will you create each month\?/.test(t) && /How long do you plan to use OrivenAI\?/.test(t) && /Occasionally/.test(t) && /Intensively/.test(t) && /2 weeks/.test(t) && /12 months/.test(t); }));
  let r0 = await result();
  check('default recommendation: Quarterly, €78 / 3 months, 4.800 credits, "Choose This Plan"', r0.plan === 'Quarterly' && r0.price === '€78 / 3 months' && /4\.800 credits/.test(r0.credits) && r0.cta === 'Choose This Plan' && r0.href === '/app?plan=quarterly', r0);
  check('level names shown with what they mean', (await setSlider('automations', 3)) === 'Intensive · 8 new automations a month' && (await setSlider('research', 0)) === 'Occasional · 1 report a month' && (await setSlider('automations', 1)) === 'Regular · 2 new automations a month' && (await setSlider('research', 1)) === 'Regular · 2 reports a month');
  const callsBefore = apiCalls.length;
  check('slider value text updates immediately', (await setSlider('days', 12)) === '12 months' && (await setSlider('campaigns', 0)) === '1 campaign a month');
  r0 = await result();
  check('…and the recommendation follows: 12 months, light use → Annual, with its price and the reason', r0.plan === 'Annual' && r0.href === '/app?plan=annual' && r0.price === '€245 / 12 months' && /lowest price for 12 months/.test(r0.why), r0);
  for (const k of ['campaigns', 'automations', 'research', 'days']) await setSlider(k, 0);
  check('all sliders at minimum → Flex (€17 / 14 days)', (await result()).plan === 'Flex' && /€17/.test((await result()).price));
  for (const [k, i] of [['campaigns', 4], ['automations', 3], ['research', 3], ['days', 12]]) await setSlider(k, i);
  r0 = await result();
  check('all sliders at maximum → Quarterly ×4 (€312 in total); the reason says Annual\'s credits fall short', r0.plan === 'Quarterly' && /4 purchases/.test(await page.textContent('#orvPpResult .orv-pp-times')) && /Annual would cost less, but its 1\.250 credits a month aren't enough/.test(r0.why), r0);
  check('…the usage breakdown uses the real costs (8 campaigns 960 · 8 new automations 160 · 5 research reports 450)', /8 campaigns 960 · 8 new automations 160 · 5 research reports 450/.test(await page.textContent('#orvPpResult .orv-pp-breakdown')));
  for (const [k, i] of [['campaigns', 0], ['automations', 0], ['research', 0], ['days', 7]]) await setSlider(k, i);
  r0 = await result();
  check('7 months → Semi-Annual first, then Monthly (€172 in total); the CTA buys Semi-Annual', r0.plan === 'Semi-Annual' && r0.href === '/app?plan=semiannual' && /\+ Monthly later · €172 in total/.test(await page.textContent('#orvPpResult .orv-pp-times')) && /Start with Semi-Annual, then add Monthly/.test(r0.why), r0);
  await setSlider('days', 6); await setSlider('campaigns', 2);
  check('6 months → Semi-Annual', (await result()).plan === 'Semi-Annual');
  await setSlider('days', 1);
  check('1 month → Monthly', (await result()).plan === 'Monthly');
  for (let i = 0; i < 20; i++) await setSlider(['campaigns', 'automations', 'research'][i % 3], i % 4);
  check('moving sliders makes no network request at all', apiCalls.length === callsBefore && rateCalls === 0, apiCalls.slice(callsBefore));

  // CTA: the same path as the plan's own card.
  await setSlider('days', 3); await setSlider('campaigns', 1); await setSlider('automations', 1); await setSlider('research', 1);
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
  check('nothing left the browser (the existing page-view beacon and the consent-gated HeyCatch import were blocked; rates were answered in the test)', fence.blocked.filter((u) => !/\/api\/t$|esm\.sh\/@heycatch\/sdk@/.test(u)).length === 0, fence.blocked);
  await browser.close();
  done();

  function done() { console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`); process.exit(fail ? 1 : 0); }
})().catch((e) => { console.error(e); process.exit(1); });
