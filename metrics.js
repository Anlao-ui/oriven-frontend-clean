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
  currency: function(v) { return (v == null) ? '—' : '€' + (typeof _prfFmt === 'function' ? _prfFmt(v) : v.toFixed(2)); },
  percent:  function(v) { return (v == null) ? '—' : v.toFixed(1) + '%'; },
  decimal:  function(v) { return (v == null) ? '—' : v.toFixed(2); },
  multiple: function(v) { return (v == null || v < 0.005) ? '—' : v.toFixed(2) + 'x'; }
};

// Each metric: id, label, category, platforms[], format (key into
// ORIVEN_METRIC_FORMATS), trend (selectable as a Trends chart metric),
// tooltip (only set for genuinely non-obvious metrics, per product spec --
// self-explanatory ones like "Clicks" or "Impressions" stay null),
// get(kpis) -> raw number|null, reading the aggregated per-platform object.
var ORIVEN_METRICS = {

  // ── Delivery ──────────────────────────────────────────────────
  impressions: { id:'impressions', label:'Impressions', category:'delivery', platforms:['google','meta','tiktok'], format:'number', trend:true, tooltip:null,
    get:function(k){ return k.impr; }, seriesGet:function(d){ return d.impressions; } },
  reach: { id:'reach', label:'Reach', category:'delivery', platforms:['meta','tiktok'], format:'number', trend:false,
    tooltip:'The number of unique people who saw your ad at least once (impressions can be higher, since one person can see an ad more than once).',
    get:function(k){ return k.reach; } },
  frequency: { id:'frequency', label:'Frequency', category:'delivery', platforms:['meta','tiktok'], format:'decimal', trend:false,
    tooltip:'The average number of times each person saw your ad.',
    get:function(k){ return k.frequency; } },
  spend: { id:'spend', label:'Spend', category:'delivery', platforms:['google','meta','tiktok'], format:'currency', trend:true, tooltip:null,
    get:function(k){ return k.spend; }, seriesGet:function(d){ return d.spend; } },
  cpm: { id:'cpm', label:'CPM', category:'delivery', platforms:['google','meta','tiktok'], format:'currency', trend:false,
    tooltip:'Cost per 1,000 impressions.',
    get:function(k){ return k.cpm; } },
  deliveryStatus: { id:'deliveryStatus', label:'Delivery Status', category:'delivery', platforms:['google','meta','tiktok'], format:'text', trend:false,
    tooltip:'Whether the campaign is currently active, paused, or otherwise not delivering.',
    get:function(k){ return k.status || null; } },
  budget: { id:'budget', label:'Budget', category:'delivery', platforms:['meta','tiktok'], format:'currency', trend:false, tooltip:null,
    get:function(k){ return k.budget; } },
  searchImpressionShare: { id:'searchImpressionShare', label:'Search Impression Share', category:'delivery', platforms:['google'], format:'percent', trend:false,
    tooltip:'The percentage of eligible impressions your Search ads actually received. Only available for Search campaigns.',
    get:function(k){ return k.searchImpressionShare; } },

  // ── Traffic ───────────────────────────────────────────────────
  clicks: { id:'clicks', label:'Clicks', category:'traffic', platforms:['google','meta','tiktok'], format:'number', trend:true, tooltip:null,
    get:function(k){ return k.clicks; }, seriesGet:function(d){ return d.clicks; } },
  linkClicks: { id:'linkClicks', label:'Link Clicks', category:'traffic', platforms:['meta'], format:'number', trend:false,
    tooltip:'Clicks specifically on the link in your ad, distinct from all clicks (which also include likes, comments, and other interactions with the post).',
    get:function(k){ return k.linkClicks; } },
  ctr: { id:'ctr', label:'CTR', category:'traffic', platforms:['google','meta','tiktok'], format:'percent', trend:true,
    tooltip:'Click-through rate: clicks divided by impressions.',
    get:function(k){ return k.impr > 0 ? (k.clicks / k.impr) * 100 : (k.ctr != null ? k.ctr : null); },
    seriesGet:function(d){ return d.impressions > 0 ? (d.clicks / d.impressions) * 100 : null; } },
  cpc: { id:'cpc', label:'CPC', category:'traffic', platforms:['google','meta','tiktok'], format:'currency', trend:true,
    tooltip:'Average cost per click.',
    get:function(k){ return k.clicks > 0 ? k.spend / k.clicks : (k.cpc != null ? k.cpc : null); },
    seriesGet:function(d){ return d.clicks > 0 ? d.spend / d.clicks : null; } },

  // ── Conversion ────────────────────────────────────────────────
  conversions: { id:'conversions', label:'Conversions', category:'conversion', platforms:['google','meta','tiktok'], format:'number', trend:true, tooltip:null,
    get:function(k){ return k.conv; }, seriesGet:function(d){ return d.conversions; } },
  conversionRate: { id:'conversionRate', label:'Conversion Rate', category:'conversion', platforms:['google','meta','tiktok'], format:'percent', trend:false,
    tooltip:'Conversions divided by clicks.',
    get:function(k){ return k.clicks > 0 ? (k.conv / k.clicks) * 100 : null; } },
  cpa: { id:'cpa', label:'CPA', category:'conversion', platforms:['google','meta','tiktok'], format:'currency', trend:true,
    tooltip:'Cost per acquisition: average spend per conversion.',
    get:function(k){ return k.conv > 0 ? k.spend / k.conv : (k.cpa != null ? k.cpa : null); },
    seriesGet:function(d){ return d.conversions > 0 ? d.spend / d.conversions : null; } },
  conversionValue: { id:'conversionValue', label:'Conversion Value', category:'conversion', platforms:['google','meta'], format:'currency', trend:false,
    tooltip:'Total revenue attributed to conversions.',
    get:function(k){ return k.convVal; } },
  roas: { id:'roas', label:'ROAS', category:'conversion', platforms:['google','meta'], format:'multiple', trend:true,
    tooltip:'Return on ad spend: revenue generated for every $1 spent on advertising.',
    get:function(k){ return (k.spend > 0 && k.convVal > 0) ? k.convVal / k.spend : null; },
    // Meta's daily series doesn't carry conversion value (see _prfLoadChartSeries,
    // app.html) -- d.hasValue is only ever true when at least one platform's
    // daily row actually reported it, so ROAS honestly stays empty otherwise
    // rather than plotting a ratio against a value that was never fetched.
    seriesGet:function(d){ return (d.hasValue && d.spend > 0) ? d.conversions_value / d.spend : null; } },
  addToCart: { id:'addToCart', label:'Add to Cart', category:'conversion', platforms:['meta'], format:'number', trend:false, tooltip:null,
    get:function(k){ return k.addToCart; } },
  costPerAddToCart: { id:'costPerAddToCart', label:'Cost per Add to Cart', category:'conversion', platforms:['meta'], format:'currency', trend:false, tooltip:null,
    get:function(k){ return k.costPerAddToCart; } },
  checkoutInitiated: { id:'checkoutInitiated', label:'Checkout Initiated', category:'conversion', platforms:['meta'], format:'number', trend:false, tooltip:null,
    get:function(k){ return k.checkoutInitiated; } },
  costPerCheckout: { id:'costPerCheckout', label:'Cost per Checkout', category:'conversion', platforms:['meta'], format:'currency', trend:false, tooltip:null,
    get:function(k){ return k.costPerCheckout; } }
};

// Trend-eligible metrics, in a sensible display order for the chart-metric
// picker. Built from ORIVEN_METRICS rather than duplicated by hand, so a
// metric only needs `trend:true` set once.
var ORIVEN_TREND_METRICS = Object.keys(ORIVEN_METRICS).filter(function(id) { return ORIVEN_METRICS[id].trend; });

// Default selection (Section 7 of the spec) -- shown to a user who has
// never customized anything. Filtered per-platform at render time the same
// way a customized selection is (see prfMetricsForPlatform in app.html), so
// a Meta-only user simply never sees roas/conversionValue drop out with an
// error -- it's just absent, same as everywhere else in this feature.
var ORIVEN_DEFAULT_METRICS = {
  delivery:   ['impressions', 'reach', 'frequency', 'spend', 'cpm'],
  traffic:    ['clicks', 'ctr', 'cpc'],
  conversion: ['conversions', 'conversionRate', 'cpa', 'roas'],
  trends:     ['spend', 'conversions', 'roas', 'ctr']
};

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
