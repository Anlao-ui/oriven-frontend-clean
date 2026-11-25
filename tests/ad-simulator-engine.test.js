// ════════════════════════════════════════════════════════════════
// Ad Simulator engine (js/adSimEngine.js): pure maths, no network.
// RUN: node tests/ad-simulator-engine.test.js
// ════════════════════════════════════════════════════════════════
const E = require('../js/adSimEngine.js');
let pass = 0, fail = 0;
const check = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + n + (ok || info === undefined ? '' : ' :: ' + JSON.stringify(info))); };
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9) * Math.max(1, Math.abs(b));

// 1. CPM basis: €1,000 at €10 CPM → 100,000 impressions; 1% CTR → 1,000 clicks; 2% CVR → 20 conversions; €50 → €1,000
const a = E.calculate({ budget: 1000, days: 10, channels: [{ platform: 'meta', share: 100, basis: 'cpm', cpm: 10, ctr: 1, cvr: 2, value: 50 }] });
check('CPM funnel: impressions, clicks, conversions, revenue', near(a.total.impressions, 100000) && near(a.total.clicks, 1000) && near(a.total.conversions, 20) && near(a.total.revenue, 1000), a.total);
check('derived: CPC €1, CPA €50, ROAS 1.0, daily budget €100', near(a.total.cpc, 1) && near(a.total.cpa, 50) && near(a.total.roas, 1) && near(a.total.dailyBudget, 100), a.total);
check('reach = impressions / frequency (default 1.8)', near(a.total.reach, 100000 / 1.8), a.total.reach);

// 2. CPC basis: €500 at €0.50 CPC → 1,000 clicks; 2% CTR → 50,000 impressions; CPM €10
const b = E.calculate({ budget: 500, channels: [{ platform: 'google', share: 100, basis: 'cpc', cpc: 0.5, ctr: 2, cvr: 5, value: 20 }] });
check('CPC funnel: clicks from price, impressions from CTR, CPM derived', near(b.total.clicks, 1000) && near(b.total.impressions, 50000) && near(b.total.cpm, 10) && near(b.total.conversions, 50), b.total);

// 3. Split: shares normalised (60/40 and 3/2 give the same)
const split = (s1, s2) => E.calculate({ budget: 1000, channels: [{ platform: 'meta', share: s1, cpm: 10, ctr: 1, cvr: 2, value: 50 }, { platform: 'google', share: s2, basis: 'cpc', cpc: 1, ctr: 3, cvr: 4, value: 50 }] });
const s1 = split(60, 40), s2 = split(3, 2);
check('budget split is normalised and spend adds up to the budget', near(s1.channels[0].spend, 600) && near(s1.channels[1].spend, 400) && near(s2.total.revenue, s1.total.revenue) && near(s1.total.spend, 1000), s1.channels.map((c) => c.spend));
check('totals are the sum of the platforms', near(s1.total.conversions, s1.channels[0].conversions + s1.channels[1].conversions));

// 4. No conversions → CPA and ROAS are not calculated (null), never 0
const aw = E.calculate({ objective: 'awareness', budget: 300, channels: [{ platform: 'tiktok', cpm: 5, ctr: 0.8, cvr: 0, value: 0 }] });
check('awareness with 0% CVR: CPA and ROAS are null, not 0', aw.total.cpa === null && aw.total.roas === null && aw.total.impressions > 0, aw.total);

// 5. Bounds / sanitising
const z = E.scenario({ budget: -5, days: 9999, channels: [{ platform: 'x', ctr: 500 }, { platform: 'x' }] });
check('inputs are clamped and duplicate platforms dropped', z.budget === 1 && z.days === 365 && z.channels.length === 1 && z.channels[0].ctr === 100, z);
check('unknown objective/uncertainty fall back', E.scenario({ objective: 'win', uncertainty: 'wild' }).objective === 'sales' && E.scenario({ uncertainty: 'wild' }).uncertainty === 'medium');

// 6. Monte Carlo: deterministic (seeded), median near the calculation, ordered bands
const base = { budget: 2000, uncertainty: 'medium', channels: [{ platform: 'meta', cpm: 8, ctr: 1.2, cvr: 2.5, value: 60 }] };
const m1 = E.simulate(base, { runs: 4000 }), m2 = E.simulate(base, { runs: 4000 });
check('same assumptions → identical simulation (seeded)', m1.bands.revenue.p50 === m2.bands.revenue.p50 && m1.breakEvenShare === m2.breakEvenShare);
const calc = E.calculate(base);
check('simulated median conversions within 10% of the calculation', Math.abs(m1.bands.conversions.p50 - calc.total.conversions) / calc.total.conversions < 0.1, { sim: m1.bands.conversions.p50, calc: calc.total.conversions });
check('bands are ordered p10 ≤ p50 ≤ p90', ['revenue', 'conversions', 'roas', 'clicks'].every((k) => m1.bands[k].p10 <= m1.bands[k].p50 && m1.bands[k].p50 <= m1.bands[k].p90));
check('spend is fixed in every run (= budget)', near(m1.bands.spend.p10, 2000, 1e-6) && near(m1.bands.spend.p90, 2000, 1e-6));
const lo = E.simulate(Object.assign({}, base, { uncertainty: 'low' })), hi = E.simulate(Object.assign({}, base, { uncertainty: 'high' }));
const width = (r) => r.bands.revenue.p90 - r.bands.revenue.p10;
check('more uncertainty → wider range', width(hi) > width(r = E.simulate(base)) && width(r) > width(lo), { lo: width(lo), med: width(r), hi: width(hi) });
check('break-even share is a probability', m1.breakEvenShare >= 0 && m1.breakEvenShare <= 1);
var r;

// 7. Poisson sampler sanity (mean)
let tot = 0; const rnd = (() => { let s = 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
for (let i = 0; i < 20000; i++) tot += E._poisson(3.5, rnd);
check('Poisson sampler mean ≈ λ', Math.abs(tot / 20000 - 3.5) < 0.1, tot / 20000);

// 8. What-if adjust: budget ×2 doubles everything (linear model), price ×1.15 lowers clicks by 1/1.15
const w = E.calculate(E.adjust(base, { budget: 2 })), wp = E.calculate(E.adjust(base, { price: 1.15 }));
check('what-if budget ×2 doubles conversions (no diminishing returns in the model)', near(w.total.conversions, calc.total.conversions * 2, 1e-9));
check('what-if price +15% → clicks ÷ 1.15', near(wp.total.clicks, calc.total.clicks / 1.15, 1e-9));
check('adjust does not mutate the original', base.budget === 2000 && base.channels[0].cpm === 8);

// 9. Simulation wrapper: max 8 scenarios, unique ids, active id kept
const sim = E.simulation({ name: 'Q4', scenarios: Array.from({ length: 12 }, (_, i) => ({ id: 'dup', name: 'S' + i })), activeId: 'nope' });
check('simulation: ≤ 8 scenarios, unique ids, valid active id', sim.scenarios.length === 8 && new Set(sim.scenarios.map((s) => s.id)).size === 8 && sim.activeId === sim.scenarios[0].id);
const h = E.histogram([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
check('histogram counts every sample', h.length === 5 && h.reduce((a, b) => a + b.count, 0) === 10);

console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
process.exitCode = fail ? 1 : 0;
