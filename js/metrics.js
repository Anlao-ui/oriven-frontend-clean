// ════════════════════════════════════════════════════════════════
// ORIVEN — Campaign Overview metric definitions ("Customize Metrics")
//
// SINGLE SOURCE OF TRUTH for every metric Campaign Overview can show,
// mirroring plans.js's role for plan data. Load this before app.html's
// inline Performance-page scripts.
//
// Every metric here maps to a field genuinely requested from the real
// Meta/Google/TikTok APIs (see server.js: /api/meta/campaigns,
// /api/ads/overview, /api/tiktok/overview) -- nothing invented. `platforms`
// lists exactly which of those integrations actually provide it; a metric
// simply isn't offered for a platform it isn't in. `get(kpis)` reads the
// already-aggregated per-platform KPI object app.html builds in
// _prfLoadData/_prfApplyView (window._prfPlatKpis[platform] / the merged
// "all" aggregate) -- this file has no fetch logic of its own, it only
// defines what to show and how to format it.
// ════════════════════════════════════════════════════════════════

var ORIVEN_METRIC_CATEGORIES = [
  { id: 'delivery',   label: 'Delivery' },
  { id: 'traffic',    label: 'Traffic' },
  { id: 'conversion', label: 'Conversion' },
  { id: 'trends',     label: 'Trends' }
];

// ── Formatters — shared by KPI tiles, the Customize Metrics modal, and
// trend chart tooltips, so a given metric always reads the same way
// everywhere it appears. ─────────────────────────────────────────
var ORIVEN_METRIC_FORMATS = {
  number:   function(v) { return (v == null) ? '—' : (typeof _prfFmt === 'function' ? _prfFmt(v) : String(Math.round(v))); },
  // Campaigns Composition polish pass — real cost metrics like CPC/CPA/
  // Cost per Add to Cart are frequently sub-1 (e.g. a real €0.38 CPC), and
  // routing them through the same whole-number rounding every OTHER
  // currency figure uses (_prfFmt, Math.round()) silently displayed them
  // as "€0" -- identical to the honest "missing" case one line up, which
  // is exactly the confusion "missing vs. real zero" (spec) must avoid.
  // Below €1000, show real cents when the value isn't a whole euro amount
  // (€0.38, €12.50) and stay clean when it is (€8, €28, €210) -- at/above
  // €1000, unchanged K/M notation via _prfFmt (fine at that scale, cents
  // were never legible there anyway).
  currency: function(v) {
    if (v == null) return '—';
    if (Math.abs(v) >= 1000) return '€' + (typeof _prfFmt === 'function' ? _prfFmt(v) : Math.round(v).toLocaleString());
    var rounded = Math.round(v * 100) / 100;
    return '€' + (Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toFixed(2));
  },
  percent:  function(v) { return (v == null) ? '—' : v.toFixed(1) + '%'; },
  decimal:  function(v) { return (v == null) ? '—' : v.toFixed(2); },
  multiple: function(v) { return (v == null || v < 0.005) ? '—' : v.toFixed(2) + 'x'; }
};

// Each metric: id, label, category, platforms[], format (key into
// ORIVEN_METRIC_FORMATS), trend (selectable as a Trends chart metric),
// tooltip (a concise, accurate description -- EVERY metric has one, no
// exceptions, so the info icon beside a KPI tile is always consistent
// rather than appearing on some metrics and not others),
// get(kpis) -> raw number|null, reading the aggregated per-platform object.
var ORIVEN_METRICS = {

  // ── Delivery ──────────────────────────────────────────────────
  // Pinterest additions verified against its real sync-reporting columns
  // (ReportingColumnSync in Pinterest's own published OpenAPI v5 spec) —
  // impressions/reach/frequency/spend/cpm/deliveryStatus are all backed
  // by real fields (TOTAL_IMPRESSION, TOTAL_IMPRESSION_USER,
  // TOTAL_IMPRESSION_FREQUENCY, SPEND_IN_DOLLAR, CPM_IN_DOLLAR,
  // summary_status). Pinterest is deliberately NOT added to `budget`:
  // its real daily_spend_cap/lifetime_spend_cap fields exist, but their
  // unit (micro-currency vs. another convention) could not be confirmed
  // without a live account to cross-check against, so display as
  // currency was intentionally left out rather than risk showing a
  // wrong number confidently — see server.js PINTEREST ADS OAUTH
  // section and the integration's final report for detail.
  impressions: { id:'impressions', label:'Impressions', category:'delivery', platforms:['google','meta','tiktok','pinterest'], format:'number', trend:true,
    tooltip:'The total number of times your ads were shown.',
    get:function(k){ return k.impr; }, seriesGet:function(d){ return d.impressions; } },
  // reach/frequency seriesGet (Performance Workspace Refinement): Meta and
  // Pinterest's daily-series fetchers now request a real per-day reach
  // field (server.js's _metaFetchDailySeries/_pinterestFetchDailySeries) —
  // d.hasReach mirrors ROAS's d.hasValue convention, true only on a day at
  // least one platform actually reported it, so a day Google contributed to
  // (no reach field at all) is never silently read as a real reach of 0.
  // Frequency = Impressions / Reach, computed per day from those same two
  // real fields — never a separate fabricated series.
  reach: { id:'reach', label:'Reach', category:'delivery', platforms:['meta','tiktok','pinterest'], format:'number', trend:true,
    tooltip:'The number of unique people who saw your ad at least once (impressions can be higher, since one person can see an ad more than once).',
    get:function(k){ return k.reach; }, seriesGet:function(d){ return d.hasReach ? d.reach : null; } },
  frequency: { id:'frequency', label:'Frequency', category:'delivery', platforms:['meta','tiktok','pinterest'], format:'decimal', trend:true,
    tooltip:'The average number of times each person saw your ad.',
    get:function(k){ return k.frequency; },
    seriesGet:function(d){ return (d.hasReach && d.reach > 0) ? d.impressions / d.reach : null; } },
  spend: { id:'spend', label:'Spend', category:'delivery', platforms:['google','meta','tiktok','pinterest'], format:'currency', trend:true,
    tooltip:'The total amount spent on advertising during the selected period.',
    get:function(k){ return k.spend; }, seriesGet:function(d){ return d.spend; } },
  // CPM = Spend / Impressions x 1000 -- both real fields already present in
  // every platform's daily series, so this is a pure derived ratio of
  // already-real numbers (same convention as CTR/CPC below), not a new
  // fetch.
  cpm: { id:'cpm', label:'CPM', category:'delivery', platforms:['google','meta','tiktok','pinterest'], format:'currency', trend:true,
    tooltip:'Cost per 1,000 impressions.',
    get:function(k){ return k.cpm; },
    seriesGet:function(d){ return d.impressions > 0 ? (d.spend / d.impressions) * 1000 : null; } },
  deliveryStatus: { id:'deliveryStatus', label:'Delivery Status', category:'delivery', platforms:['google','meta','tiktok','pinterest'], format:'text', trend:false,
    tooltip:'Whether the campaign is currently active, paused, or otherwise not delivering.',
    get:function(k){ return k.status || null; } },
  budget: { id:'budget', label:'Budget', category:'delivery', platforms:['meta','tiktok'], format:'currency', trend:false,
    tooltip:'The daily or lifetime amount allocated to spend on this campaign.',
    get:function(k){ return k.budget; } },
  searchImpressionShare: { id:'searchImpressionShare', label:'Search Impression Share', category:'delivery', platforms:['google'], format:'percent', trend:false,
    tooltip:'The percentage of eligible impressions your Search ads actually received. Only available for Search campaigns.',
    get:function(k){ return k.searchImpressionShare; } },

  // ── Traffic ───────────────────────────────────────────────────
  // linkClicks deliberately excludes Pinterest: its sync-reporting columns
  // have no clean aggregate equivalent to Meta's "link clicks vs. all
  // clicks" distinction (only attribution-window-scoped variants like
  // OUTBOUND_CLICK_1 exist, not a TOTAL_OUTBOUND_CLICK) — TOTAL_CLICKTHROUGH
  // (Pinterest's real "clicks" metric) already covers what Pinterest can
  // honestly report here.
  clicks: { id:'clicks', label:'Clicks', category:'traffic', platforms:['google','meta','tiktok','pinterest'], format:'number', trend:true,
    tooltip:'The total number of clicks your ads received.',
    get:function(k){ return k.clicks; }, seriesGet:function(d){ return d.clicks; } },
  linkClicks: { id:'linkClicks', label:'Link Clicks', category:'traffic', platforms:['meta'], format:'number', trend:false,
    tooltip:'Clicks specifically on the link in your ad, distinct from all clicks (which also include likes, comments, and other interactions with the post).',
    get:function(k){ return k.linkClicks; } },
  ctr: { id:'ctr', label:'CTR', category:'traffic', platforms:['google','meta','tiktok','pinterest'], format:'percent', trend:true,
    tooltip:'Click-through rate: clicks divided by impressions.',
    get:function(k){ return k.impr > 0 ? (k.clicks / k.impr) * 100 : (k.ctr != null ? k.ctr : null); },
    seriesGet:function(d){ return d.impressions > 0 ? (d.clicks / d.impressions) * 100 : null; } },
  cpc: { id:'cpc', label:'CPC', category:'traffic', platforms:['google','meta','tiktok','pinterest'], format:'currency', trend:true,
    tooltip:'Average cost per click.',
    get:function(k){ return k.clicks > 0 ? k.spend / k.clicks : (k.cpc != null ? k.cpc : null); },
    seriesGet:function(d){ return d.clicks > 0 ? d.spend / d.clicks : null; } },

  // ── Conversion ────────────────────────────────────────────────
  // conversions is real (Pinterest's TOTAL_CONVERSIONS). conversionRate
  // and cpa are pure derived ratios of already-real numbers (conv/clicks,
  // spend/conv) computed the exact same client-side way Google's own
  // entries already do — not a new kind of estimate. conversionValue and
  // roas are deliberately NOT added for Pinterest: its conversion-value
  // reporting is fragmented per specific event type (TOTAL_CHECKOUT_VALUE,
  // TOTAL_SIGNUP_VALUE, etc., each with its own ROAS variant like
  // CHECKOUT_ROAS) with no single unified "conversion value"/"ROAS" field
  // the way Google/Meta have — exposing one here would silently pick one
  // event type and call it "conversion value" for every campaign
  // regardless of what it's actually optimizing for, which is exactly
  // the kind of misleading equivalent this registry is meant to avoid.
  conversions: { id:'conversions', label:'Conversions', category:'conversion', platforms:['google','meta','tiktok','pinterest'], format:'number', trend:true,
    tooltip:'The number of tracked actions completed after interacting with your ads.',
    get:function(k){ return k.conv; }, seriesGet:function(d){ return d.conversions; } },
  conversionRate: { id:'conversionRate', label:'Conversion Rate', category:'conversion', platforms:['google','meta','tiktok','pinterest'], format:'percent', trend:true,
    tooltip:'Conversions divided by clicks.',
    get:function(k){ return k.clicks > 0 ? (k.conv / k.clicks) * 100 : null; },
    seriesGet:function(d){ return d.clicks > 0 ? (d.conversions / d.clicks) * 100 : null; } },
  cpa: { id:'cpa', label:'CPA', category:'conversion', platforms:['google','meta','tiktok','pinterest'], format:'currency', trend:true,
    tooltip:'Cost per acquisition: average spend per conversion.',
    get:function(k){ return k.conv > 0 ? k.spend / k.conv : (k.cpa != null ? k.cpa : null); },
    seriesGet:function(d){ return d.conversions > 0 ? d.spend / d.conversions : null; } },
  conversionValue: { id:'conversionValue', label:'Conversion Value', category:'conversion', platforms:['google','meta'], format:'currency', trend:true,
    tooltip:'Total revenue attributed to conversions.',
    get:function(k){ return k.convVal; },
    // Google's daily series reports real conversion value; Meta's does not
    // (see _metaFetchDailySeries) -- d.hasValue (same flag ROAS already
    // relies on) keeps this honest on Meta-only days rather than plotting
    // a value that was never fetched.
    seriesGet:function(d){ return d.hasValue ? d.conversions_value : null; } },
  roas: { id:'roas', label:'ROAS', category:'conversion', platforms:['google','meta'], format:'multiple', trend:true,
    tooltip:'Return on ad spend: revenue generated for every $1 spent on advertising.',
    get:function(k){ return (k.spend > 0 && k.convVal > 0) ? k.convVal / k.spend : null; },
    // Meta's daily series doesn't carry conversion value (see _prfLoadChartSeries,
    // app.html) -- d.hasValue is only ever true when at least one platform's
    // daily row actually reported it, so ROAS honestly stays empty otherwise
    // rather than plotting a ratio against a value that was never fetched.
    seriesGet:function(d){ return (d.hasValue && d.spend > 0) ? d.conversions_value / d.spend : null; } },
  addToCart: { id:'addToCart', label:'Add to Cart', category:'conversion', platforms:['meta'], format:'number', trend:false,
    tooltip:'The number of tracked events where someone added a product to their cart.',
    get:function(k){ return k.addToCart; } },
  costPerAddToCart: { id:'costPerAddToCart', label:'Cost per Add to Cart', category:'conversion', platforms:['meta'], format:'currency', trend:false,
    tooltip:'Average advertising cost for each tracked add-to-cart event.',
    get:function(k){ return k.costPerAddToCart; } },
  checkoutInitiated: { id:'checkoutInitiated', label:'Checkout Initiated', category:'conversion', platforms:['meta'], format:'number', trend:false,
    tooltip:'The number of tracked checkout-start events attributed to your ads.',
    get:function(k){ return k.checkoutInitiated; } },
  costPerCheckout: { id:'costPerCheckout', label:'Cost per Checkout', category:'conversion', platforms:['meta'], format:'currency', trend:false,
    tooltip:'Average advertising cost for each tracked checkout-start event.',
    get:function(k){ return k.costPerCheckout; } }
};

// Trend-eligible metrics, in a sensible display order for the chart-metric
// picker. Built from ORIVEN_METRICS rather than duplicated by hand, so a
// metric only needs `trend:true` set once.
var ORIVEN_TREND_METRICS = Object.keys(ORIVEN_METRICS).filter(function(id) { return ORIVEN_METRICS[id].trend; });

// ── Which platforms actually support a given metric id ──────────
function orvMetricSupportsPlatform(metricId, platform) {
  var m = ORIVEN_METRICS[metricId];
  return !!(m && m.platforms.indexOf(platform) !== -1);
}

// All metric ids in one category that a given platform actually supports,
// in registry order -- what the Customize Metrics modal renders per section
// and what a platform's default/selected set gets filtered against.
// 'trends' is special: it isn't a metric's own `category` (a trend metric's
// category is still 'delivery'/'traffic'/'conversion', wherever it lives as
// a KPI tile) -- it's ORIVEN_TREND_METRICS, the same underlying metrics
// re-offered as "over time" chart options, so a metric only needs `trend:
// true` set once rather than being duplicated under a second category.
function orvMetricsForCategory(categoryId, platform) {
  var pool = categoryId === 'trends' ? ORIVEN_TREND_METRICS : Object.keys(ORIVEN_METRICS);
  return pool.filter(function(id) {
    var m = ORIVEN_METRICS[id];
    if (categoryId !== 'trends' && m.category !== categoryId) return false;
    return !platform || platform === 'all' || m.platforms.indexOf(platform) !== -1;
  });
}

function orvFormatMetric(metricId, rawVal) {
  var m = ORIVEN_METRICS[metricId];
  if (!m) return '—';
  if (m.format === 'text') return rawVal || '—';
  var fmt = ORIVEN_METRIC_FORMATS[m.format] || ORIVEN_METRIC_FORMATS.number;
  return fmt(rawVal);
}
