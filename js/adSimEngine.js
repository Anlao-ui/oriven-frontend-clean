/* ════════════════════════════════════════════════════════════════
   Ad Simulator — the calculation engine (no AI, no network).

   A scenario is a set of assumptions the user controls:
     budget (total), days, objective, uncertainty, frequency, creatives,
     and per platform: share of budget, price (CPM or CPC), CTR,
     conversion rate and average conversion value.

   Two kinds of result, always labelled as such on the page:
     calculate(s)   deterministic arithmetic on the assumptions —
                    spend → impressions → clicks → conversions → revenue.
     simulate(s)    a Monte Carlo run: each rate is drawn around the
                    user's value (log-normal, median = the value, spread
                    from "how sure are you"), conversions are drawn as
                    counts (Poisson), and the outcomes are summarised as
                    the 10th / 50th / 90th percentile. Seeded, so the
                    same assumptions always give the same picture.
   What the model does NOT do: it doesn't know the platforms' auctions,
   it assumes the whole budget is delivered at the assumed prices (no
   diminishing returns), and it can only be as good as the assumptions.

   Browser: window.orvAdSimEngine · Node: module.exports (tests).
   ════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var PLATFORMS = ['google', 'meta', 'tiktok', 'pinterest', 'snapchat'];
  var OBJECTIVES = ['sales', 'leads', 'traffic', 'awareness'];
  // Spread (σ of the log-normal) per "how sure are you about these numbers".
  var SPREAD = { low: 0.12, medium: 0.25, high: 0.45 };
  var LIMITS = {
    budget: [1, 10000000], days: [1, 365], frequency: [1, 20], creatives: [1, 20],
    cpm: [0.01, 1000], cpc: [0.001, 500], ctr: [0, 100], cvr: [0, 100], value: [0, 1000000], share: [0, 100],
  };

  function num(v, lo, hi, dflt) { var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); if (!isFinite(n)) return dflt; return Math.min(hi, Math.max(lo, n)); }
  function clampKey(v, key, dflt) { return num(v, LIMITS[key][0], LIMITS[key][1], dflt); }

  // ── Normalising ────────────────────────────────────────────────
  function channel(c) {
    c = c || {};
    var platform = PLATFORMS.indexOf(c.platform) >= 0 ? c.platform : 'meta';
    return {
      platform: platform,
      share: clampKey(c.share, 'share', 100),
      basis: c.basis === 'cpc' ? 'cpc' : 'cpm',
      cpm: clampKey(c.cpm, 'cpm', 8),
      cpc: clampKey(c.cpc, 'cpc', 0.6),
      ctr: clampKey(c.ctr, 'ctr', 1.2),
      cvr: clampKey(c.cvr, 'cvr', 2),
      value: clampKey(c.value, 'value', 50),
      source: c.source && typeof c.source === 'object' ? { kind: c.source.kind === 'account' ? 'account' : 'manual', label: String(c.source.label || '').slice(0, 160), since: String(c.source.since || '').slice(0, 10), until: String(c.source.until || '').slice(0, 10) } : { kind: 'manual', label: '', since: '', until: '' },
    };
  }
  function scenario(s) {
    s = s || {};
    var chans = (Array.isArray(s.channels) ? s.channels : []).slice(0, PLATFORMS.length).map(channel);
    // one channel per platform
    var seen = {}; chans = chans.filter(function (c) { if (seen[c.platform]) return false; seen[c.platform] = 1; return true; });
    if (!chans.length) chans = [channel({ platform: 'meta' })];
    return {
      id: String(s.id || ('s' + Math.random().toString(36).slice(2, 9))).slice(0, 40),
      name: String(s.name || 'Scenario').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Scenario',
      objective: OBJECTIVES.indexOf(s.objective) >= 0 ? s.objective : 'sales',
      budget: clampKey(s.budget, 'budget', 1000),
      days: Math.round(clampKey(s.days, 'days', 30)),
      frequency: clampKey(s.frequency, 'frequency', 1.8),
      creatives: Math.round(clampKey(s.creatives, 'creatives', 1)),
      uncertainty: SPREAD[s.uncertainty] ? s.uncertainty : 'medium',
      channels: chans,
    };
  }

  // ── Deterministic calculation ──────────────────────────────────
  function shares(s) {
    var total = s.channels.reduce(function (a, c) { return a + c.share; }, 0);
    return s.channels.map(function (c) { return total > 0 ? c.share / total : 1 / s.channels.length; });
  }
  // One channel's funnel from its spend and (possibly drawn) rates.
  function funnel(spend, basis, price, ctr, cvr, value) {
    var impressions, clicks;
    if (basis === 'cpc') { clicks = price > 0 ? spend / price : 0; impressions = ctr > 0 ? clicks / (ctr / 100) : 0; }
    else { impressions = price > 0 ? (spend / price) * 1000 : 0; clicks = impressions * (ctr / 100); }
    var conversions = clicks * (cvr / 100);
    return { spend: spend, impressions: impressions, clicks: clicks, conversions: conversions, revenue: conversions * value };
  }
  function derive(t, frequency) {
    t.ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : null;
    t.cpc = t.clicks > 0 ? t.spend / t.clicks : null;
    t.cpm = t.impressions > 0 ? (t.spend / t.impressions) * 1000 : null;
    t.cvr = t.clicks > 0 ? (t.conversions / t.clicks) * 100 : null;
    t.cpa = t.conversions > 0 ? t.spend / t.conversions : null;
    t.roas = t.spend > 0 && t.conversions > 0 ? t.revenue / t.spend : null;
    t.reach = frequency >= 1 ? t.impressions / frequency : null;
    return t;
  }
  function calculate(raw) {
    var s = scenario(raw), sh = shares(s);
    var rows = s.channels.map(function (c, i) {
      var spend = s.budget * sh[i];
      var r = funnel(spend, c.basis, c.basis === 'cpc' ? c.cpc : c.cpm, c.ctr, c.cvr, c.value);
      r.platform = c.platform; r.share = sh[i];
      return derive(r, s.frequency);
    });
    var tot = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    rows.forEach(function (r) { tot.spend += r.spend; tot.impressions += r.impressions; tot.clicks += r.clicks; tot.conversions += r.conversions; tot.revenue += r.revenue; });
    derive(tot, s.frequency);
    tot.dailyBudget = s.budget / s.days;
    tot.perCreative = { spend: tot.spend / s.creatives, impressions: tot.impressions / s.creatives, clicks: tot.clicks / s.creatives };
    return { scenario: s, total: tot, channels: rows };
  }

  // ── Monte Carlo ────────────────────────────────────────────────
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function gauss(rnd) { var u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  // A count with mean λ: exact Poisson for small λ, normal approximation above.
  function poisson(lambda, rnd) {
    if (lambda <= 0) return 0;
    if (lambda < 60) { var L = Math.exp(-lambda), k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; }
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss(rnd)));
  }
  function pct(sorted, q) { if (!sorted.length) return null; var i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); }
  function keyOf(s) { return JSON.stringify([s.budget, s.days, s.frequency, s.uncertainty, s.channels.map(function (c) { return [c.platform, c.share, c.basis, c.cpm, c.cpc, c.ctr, c.cvr, c.value]; })]); }

  function simulate(raw, opts) {
    opts = opts || {};
    var s = scenario(raw), sh = shares(s);
    var n = Math.max(200, Math.min(20000, opts.runs || 2000));
    var sigma = SPREAD[s.uncertainty];
    var rnd = mulberry32(opts.seed != null ? opts.seed : hash(keyOf(s)));
    var out = { spend: [], impressions: [], clicks: [], conversions: [], revenue: [], roas: [], cpa: [] };
    var breakEven = 0, zeroConv = 0;
    for (var k = 0; k < n; k++) {
      var t = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
      for (var i = 0; i < s.channels.length; i++) {
        var c = s.channels[i], spend = s.budget * sh[i];
        var price = (c.basis === 'cpc' ? c.cpc : c.cpm) * Math.exp(sigma * gauss(rnd));
        var ctr = Math.min(100, c.ctr * Math.exp(sigma * gauss(rnd)));
        var cvr = Math.min(100, c.cvr * Math.exp(sigma * gauss(rnd)));
        var value = c.value * Math.exp(sigma * 0.5 * gauss(rnd));
        var f = funnel(spend, c.basis, price, ctr, cvr, 0);
        var conv = poisson(f.conversions, rnd);
        t.spend += spend; t.impressions += f.impressions; t.clicks += f.clicks; t.conversions += conv; t.revenue += conv * value;
      }
      out.spend.push(t.spend); out.impressions.push(t.impressions); out.clicks.push(t.clicks); out.conversions.push(t.conversions); out.revenue.push(t.revenue);
      out.roas.push(t.spend > 0 ? t.revenue / t.spend : 0);
      if (t.conversions > 0) out.cpa.push(t.spend / t.conversions); else zeroConv++;
      if (t.revenue >= t.spend) breakEven++;
    }
    var bands = {};
    Object.keys(out).forEach(function (key) {
      var arr = out[key].slice().sort(function (a, b) { return a - b; });
      bands[key] = arr.length ? { p10: pct(arr, 0.1), p50: pct(arr, 0.5), p90: pct(arr, 0.9), min: arr[0], max: arr[arr.length - 1] } : null;
    });
    // CPA from runs that had conversions only; a "worse" CPA is a higher one, so p10 = best case.
    return { scenario: s, runs: n, sigma: sigma, bands: bands, samples: { revenue: out.revenue, conversions: out.conversions, roas: out.roas }, breakEvenShare: breakEven / n, noConversionShare: zeroConv / n };
  }

  // Histogram of samples into `bins` equal-width buckets (for the outcome chart).
  function histogram(samples, bins) {
    bins = bins || 24;
    if (!samples || !samples.length) return [];
    var lo = Infinity, hi = -Infinity;
    samples.forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; });
    if (hi === lo) return [{ from: lo, to: hi, count: samples.length }];
    var w = (hi - lo) / bins, out = [];
    for (var i = 0; i < bins; i++) out.push({ from: lo + i * w, to: lo + (i + 1) * w, count: 0 });
    samples.forEach(function (v) { var i = Math.min(bins - 1, Math.floor((v - lo) / w)); out[i].count++; });
    return out;
  }

  // What-if: a scenario with multipliers applied (budget, price, ctr, cvr, value).
  function adjust(raw, m) {
    var s = scenario(raw); m = m || {};
    var f = function (k) { var v = parseFloat(m[k]); return isFinite(v) ? v : 1; };
    var copy = JSON.parse(JSON.stringify(s));
    copy.budget = clampKey(s.budget * f('budget'), 'budget', s.budget);
    copy.channels = s.channels.map(function (c) {
      var d = JSON.parse(JSON.stringify(c));
      d.cpm = clampKey(c.cpm * f('price'), 'cpm', c.cpm); d.cpc = clampKey(c.cpc * f('price'), 'cpc', c.cpc);
      d.ctr = clampKey(c.ctr * f('ctr'), 'ctr', c.ctr); d.cvr = clampKey(c.cvr * f('cvr'), 'cvr', c.cvr);
      d.value = clampKey(c.value * f('value'), 'value', c.value);
      return d;
    });
    return scenario(copy);
  }

  // A whole saved simulation (what the server stores).
  function simulation(raw) {
    raw = raw || {};
    var list = (Array.isArray(raw.scenarios) ? raw.scenarios : []).slice(0, 8).map(scenario);
    var ids = {}; list.forEach(function (s) { while (ids[s.id]) s.id += 'x'; ids[s.id] = 1; });
    if (!list.length) list = [scenario({ name: 'Scenario A' })];
    var active = list.some(function (s) { return s.id === raw.activeId; }) ? raw.activeId : list[0].id;
    return { name: String(raw.name || 'Untitled simulation').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Untitled simulation', scenarios: list, activeId: active, version: 1 };
  }

  var API = { PLATFORMS: PLATFORMS, OBJECTIVES: OBJECTIVES, SPREAD: SPREAD, LIMITS: LIMITS, scenario: scenario, channel: channel, calculate: calculate, simulate: simulate, histogram: histogram, adjust: adjust, simulation: simulation, _poisson: poisson, _pct: pct };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.orvAdSimEngine = API;
})(typeof window !== 'undefined' ? window : null);
