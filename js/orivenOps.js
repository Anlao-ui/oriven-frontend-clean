/* ════════════════════════════════════════════════════════════════
   OrivenAI Ops — shared advertising data layer behind Home's summary
   blocks in Control Center and Control Center → Planning. The six pages
   (Control Center, Research, Create, Launch, Campaigns, Autopilot) keep
   their own navigation.

     1. Navigation — maps summary links to those mature pages, and keeps
                     old area-experiment keys routing somewhere real.
     2. Capability — what OrivenAI can actually do on each ad platform,
                     derived from the real backend routes. The UI asks
                     this before showing any control.
     3. Data       — one cached reader over the EXISTING platform routes
                     (/api/meta/campaigns, /api/ads/overview,
                     /api/tiktok/overview, /api/pinterest/overview, the
                     status routes). Current and previous period. Nothing
                     is fabricated: a platform that doesn't report a metric
                     shows "—", a platform that isn't connected shows an
                     empty state.
     4. Signals    — transparent, configurable rules that turn real data
                     into "Needs attention" items and recommendations,
                     each with the evidence and the rule that fired.
     5. Store      — the user's own settings/plans (profiles.preferences
                     via /api/user/preferences, cached locally).
     6. Actions    — pause / resume / budget changes through the existing
                     routes, always confirmed, with a change history.
     7. AI         — contextual "Ask OrivenAI": opens the existing chat
                     with the question prefilled and the on-screen data
                     attached; the user sends it (chat credits apply).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var OW = window.orvWorkspace = window.orvWorkspace || {};
  var OPS = OW.ops = OW.ops || {};

  // ── Helpers ─────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // A JS string literal safe inside a double-quoted HTML onclick attribute.
  function jsq(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/\n/g, ' '); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function user() { return (typeof window._getCurrentUser === 'function') ? window._getCurrentUser() : null; }
  function uid() { var u = user(); return u && u.id ? u.id : null; }
  function toast(m, k) { if (typeof window.orvToast === 'function') window.orvToast(m, k || 'info'); }
  function api(path, opts) { return (typeof window.apiFetch === 'function') ? window.apiFetch(path, opts) : Promise.reject(new Error('api unavailable')); }
  OPS.esc = esc; OPS.jsq = jsq; OPS.isNum = isNum;

  var NUMF = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  var NUMF1 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  var moneyFmts = {};
  function money(v, cur, dec) {
    if (!isNum(v)) return '—';
    var big = Math.abs(v) >= 1000;
    var k = (cur || '') + '|' + (dec == null ? (big ? 'b' : 's') : dec);
    if (!moneyFmts[k]) {
      try {
        moneyFmts[k] = cur ? new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: dec == null ? (big ? 0 : 2) : dec, minimumFractionDigits: 0 })
                           : new Intl.NumberFormat(undefined, { maximumFractionDigits: dec == null ? 2 : dec });
      } catch (_) { moneyFmts[k] = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }); }
    }
    return moneyFmts[k].format(v);
  }
  function num(v) { return isNum(v) ? (Math.abs(v) >= 10000 ? NUMF1.format(v / 1000) + 'K' : NUMF.format(v)) : '—'; }
  function pct(v, d) { return isNum(v) ? (v.toFixed(d == null ? 2 : d) + '%') : '—'; }
  function ratio(v) { return isNum(v) ? v.toFixed(2) + '×' : '—'; }
  function change(cur, prev) { return (isNum(cur) && isNum(prev) && prev !== 0) ? (cur - prev) / Math.abs(prev) * 100 : null; }
  function changeTxt(c) { if (!isNum(c)) return '—'; var r = Math.round(c); return (r > 0 ? '+' : '') + (r === 0 ? '0' : r) + '%'; }
  OPS.fmt = { money: money, num: num, pct: pct, ratio: ratio, change: change, changeTxt: changeTxt };

  // ════════════════════════════════════════════════════════════════
  // 1. NAVIGATION — the mature pages own navigation
  // ════════════════════════════════════════════════════════════════
  // The sidebar, hub tabs and page titles are the app's own (app.html
  // _orvNav + _ORV_HUB_MEMBERS). This file only maps its summary links to
  // those pages, and keeps a few keys from the abandoned area experiment
  // routing somewhere real (saved links, "Continue" entries).
  function nav(page, pageId) { if (typeof window._orvNav === 'function') window._orvNav(page, pageId); }
  var DEST = {
    home:      function () { DEST.business(); },
    create:    function () { nav('create', 'page-create'); },
    research:  function () { nav('research', 'page-research'); },
    launch:    function () { nav('launch', 'page-launch'); },
    campaigns: function () { nav('performance', 'page-performance'); },
    autopilot: function () { nav('autopilot', 'page-autopilot'); },
    business:  function () { if (typeof window.bizGoTo === 'function') window.bizGoTo('overview'); else nav('businessbrain', 'page-business-brain'); },
    planning:  function () { if (typeof window.bizGoTo === 'function') window.bizGoTo('planning'); else nav('businessbrain', 'page-business-brain'); },
    connections: function () { if (typeof window.bizGoTo === 'function') window.bizGoTo('connections'); }
  };
  // Older names for the same destinations. Home and Business were merged
  // into Control Center (#page-business-brain, key 'businessbrain').
  var SAME = { overview: 'home', dashboard: 'home', control: 'home', analytics: 'campaigns', optimize: 'autopilot', brand: 'business' };
  OPS.go = function (where) {
    var d = DEST[SAME[where] || where];
    if (d) d();
  };
  // Keys that only existed during the area experiment → their mature page.
  var OLD_KEYS = {
    dashboard: 'home', home: 'home', control: 'home', overview: 'home', camps: 'campaigns', analysis: 'campaigns',
    optimize: 'autopilot', planning: 'planning', creative: 'create', platforms: 'connections'
  };
  // Kept as no-ops: the mature pages carry their own headers.
  OPS.paintBar = function () {};
  OPS.retitle = function () {};

  // ════════════════════════════════════════════════════════════════
  // 2. PLATFORM CAPABILITY MODEL
  // ════════════════════════════════════════════════════════════════
  // Derived from the routes server.js actually exposes (audit, this pass).
  // A control is only offered when its flag is true.
  var CAP = OPS.CAP = {
    meta: {
      name: 'Meta Ads', provider: 'Meta', short: 'Meta',
      campaignMetrics: true, accountMetrics: true, conversions: true, conversionValue: true, reach: true, frequency: true,
      structure: ['Campaign', 'Ad set', 'Ad'], readStructure: true, adMetrics: true, series: true,
      pause: true, resume: true, budgetEdit: true, budgetNote: 'Only campaigns with a campaign-level daily budget can be changed here; ad-set budgets are managed in Meta.',
      rename: true, providerDelete: true, create: true, targeting: false, schedule: false,
      native: 'https://adsmanager.facebook.com/'
    },
    google: {
      name: 'Google Ads', provider: 'Google', short: 'Google',
      campaignMetrics: true, accountMetrics: true, conversions: true, conversionValue: true, reach: false, frequency: false,
      structure: ['Campaign', 'Ad group', 'Ad'], readStructure: false, adMetrics: false, series: true,
      pause: true, resume: true, budgetEdit: true, budgetNote: 'Changes the campaign’s own daily budget. Shared budgets are managed in Google Ads.',
      rename: true, providerDelete: true, create: true, targeting: false, schedule: false,
      native: 'https://ads.google.com/'
    },
    tiktok: {
      name: 'TikTok Ads', provider: 'TikTok', short: 'TikTok',
      campaignMetrics: true, accountMetrics: true, conversions: true, conversionValue: false, reach: true, frequency: true,
      structure: ['Campaign', 'Ad group', 'Ad'], readStructure: false, adMetrics: false, series: false,
      pause: true, resume: true, budgetEdit: false, budgetNote: 'OrivenAI can’t change TikTok budgets yet — change them in TikTok Ads Manager.',
      rename: false, providerDelete: true, create: true, targeting: false, schedule: false,
      native: 'https://ads.tiktok.com/'
    },
    pinterest: {
      name: 'Pinterest Ads', provider: 'Pinterest', short: 'Pinterest',
      campaignMetrics: false, accountMetrics: true, conversions: true, conversionValue: false, reach: true, frequency: true,
      structure: ['Campaign', 'Ad group', 'Pin'], readStructure: true, adMetrics: false, series: true,
      pause: true, resume: true, budgetEdit: false, budgetNote: 'OrivenAI can’t change Pinterest budgets yet — change them in Pinterest Ads.',
      rename: false, providerDelete: false, create: true, targeting: false, schedule: false,
      native: 'https://ads.pinterest.com/'
    }
  };
  OPS.PLATFORMS = ['meta', 'google', 'tiktok', 'pinterest'];

  // ════════════════════════════════════════════════════════════════
  // 3. DATA
  // ════════════════════════════════════════════════════════════════
  var D = OPS.data = {};
  var RANGES = D.RANGES = [
    ['TODAY', 'Today'], ['YESTERDAY', 'Yesterday'], ['LAST_7_DAYS', 'Last 7 days'], ['LAST_14_DAYS', 'Last 14 days'],
    ['LAST_30_DAYS', 'Last 30 days'], ['THIS_MONTH', 'This month'], ['LAST_MONTH', 'Last month'], ['CUSTOM', 'Custom']
  ];
  var BACKEND_PRESETS = { TODAY: 1, YESTERDAY: 1, LAST_7_DAYS: 1, LAST_30_DAYS: 1, THIS_MONTH: 1, LAST_MONTH: 1 };
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function parseYmd(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  // A range spec: { key, since?, until? } → resolved window with dates.
  D.resolve = function (spec) {
    spec = spec || { key: 'LAST_7_DAYS' };
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var key = spec.key || 'LAST_7_DAYS', since, until;
    if (key === 'TODAY') { since = today; until = today; }
    else if (key === 'YESTERDAY') { since = addDays(today, -1); until = since; }
    else if (key === 'LAST_7_DAYS') { since = addDays(today, -6); until = today; }
    else if (key === 'LAST_14_DAYS') { since = addDays(today, -13); until = today; }
    else if (key === 'LAST_30_DAYS') { since = addDays(today, -29); until = today; }
    else if (key === 'THIS_MONTH') { since = new Date(today.getFullYear(), today.getMonth(), 1); until = today; }
    else if (key === 'LAST_MONTH') { since = new Date(today.getFullYear(), today.getMonth() - 1, 1); until = new Date(today.getFullYear(), today.getMonth(), 0); }
    else { since = spec.since ? parseYmd(spec.since) : addDays(today, -6); until = spec.until ? parseYmd(spec.until) : today; key = 'CUSTOM'; }
    if (until < since) { var t = since; since = until; until = t; }
    var days = Math.round((until - since) / 86400000) + 1;
    var label = (RANGES.filter(function (r) { return r[0] === key; })[0] || [0, 'Custom'])[1];
    if (key === 'CUSTOM') label = ymd(since) + ' – ' + ymd(until);
    return { key: key, since: ymd(since), until: ymd(until), days: days, label: label };
  };
  // The window of equal length immediately before.
  D.previous = function (r) {
    var s = parseYmd(r.since);
    return { key: 'CUSTOM', since: ymd(addDays(s, -r.days)), until: ymd(addDays(s, -1)), days: r.days, label: 'Previous ' + r.days + ' days' };
  };
  D.qs = function (r) {
    if (BACKEND_PRESETS[r.key]) return 'date_range=' + r.key;
    return 'date_range=CUSTOM&date_since=' + r.since + '&date_until=' + r.until;
  };

  var STATUS_MAP = {
    ACTIVE: 'active', ENABLED: 'active', ENABLE: 'active', RUNNING: 'active', CAMPAIGN_STATUS_ENABLE: 'active',
    PAUSED: 'paused', DISABLE: 'paused', CAMPAIGN_STATUS_DISABLE: 'paused',
    ARCHIVED: 'ended', COMPLETED: 'ended', REMOVED: 'ended', DELETED: 'ended', CAMPAIGN_STATUS_DELETE: 'ended',
    NOT_STARTED: 'scheduled', PENDING: 'scheduled'
  };
  function normStatus(s) { return STATUS_MAP[String(s || '').toUpperCase()] || (s ? 'other' : 'unknown'); }
  function finish(c) {
    // Ratios are always derived from base metrics so they mean the same
    // thing on every platform (platform-reported CTR units differ).
    c.ctr = (isNum(c.clicks) && isNum(c.impressions) && c.impressions > 0) ? c.clicks / c.impressions * 100 : null;
    c.cpc = (isNum(c.spend) && isNum(c.clicks) && c.clicks > 0) ? c.spend / c.clicks : null;
    c.cpm = (isNum(c.spend) && isNum(c.impressions) && c.impressions > 0) ? c.spend / c.impressions * 1000 : null;
    c.cpa = (isNum(c.spend) && isNum(c.conversions) && c.conversions > 0) ? c.spend / c.conversions : null;
    c.roas = (isNum(c.convValue) && isNum(c.spend) && c.spend > 0) ? c.convValue / c.spend : null;
    c.cvr = (isNum(c.conversions) && isNum(c.clicks) && c.clicks > 0) ? c.conversions / c.clicks * 100 : null;
    return c;
  }
  function n(v) { if (v == null || v === '') return null; var x = Number(v); return isFinite(x) ? x : null; }
  function emptyTotals() { return { spend: null, impressions: null, clicks: null, conversions: null, convValue: null, reach: null }; }
  function sumInto(t, c) {
    ['spend', 'impressions', 'clicks', 'conversions', 'convValue', 'reach'].forEach(function (k) {
      if (isNum(c[k])) t[k] = (t[k] || 0) + c[k];
    });
  }
  OPS.finish = finish;

  function errorFor(p, res, err) {
    var st = res && res.status;
    var name = CAP[p].provider;
    if (st === 401 || st === 403 || /token|expired|reconnect|oauth/i.test(String((res && res.data && res.data.error) || (err && err.message) || ''))) {
      return name + ' needs to be reconnected — the connection expired or lost permission.';
    }
    if (err) return 'Couldn’t reach OrivenAI to load ' + name + ' data.';
    return name + ' didn’t return performance data right now.';
  }

  // Status of every platform (connected + active account) — reuses the
  // deduplicated /api/{p}/status reads.
  D.status = function () {
    return Promise.all(OPS.PLATFORMS.map(function (p) {
      return api('/api/' + p + '/status').then(function (r) {
        var d = r && r.ok ? r.data || {} : {};
        var a = d.active_ad_account || null;
        return { p: p, connected: !!d.connected, account: a ? { id: a.account_id || a.id || '', name: a.account_name || a.name || '', currency: a.currency || '' } : null };
      }).catch(function () { return { p: p, connected: false, account: null, error: true }; });
    })).then(function (rows) { var o = {}; rows.forEach(function (r) { o[r.p] = r; }); return o; });
  };

  var loaders = {
    meta: function (r) {
      return api('/api/meta/campaigns?' + D.qs(r)).then(function (res) {
        if (!res.ok || !res.data || !Array.isArray(res.data.campaigns)) return { error: errorFor('meta', res) };
        return { campaigns: res.data.campaigns.map(function (c) {
          var daily = n(c.daily_budget), life = n(c.lifetime_budget);
          return finish({
            platform: 'meta', id: String(c.campaign_id), name: c.campaign_name || 'Unnamed', statusRaw: c.status, status: normStatus(c.status),
            objective: c.objective || '', budget: daily != null ? daily / 100 : (life != null ? life / 100 : null),
            budgetType: daily != null ? 'daily' : (life != null ? 'lifetime' : 'adset'),
            spend: n(c.spend), impressions: n(c.impressions), clicks: n(c.clicks), conversions: n(c.conversions),
            convValue: n(c.conversionValue), reach: n(c.reach), frequency: n(c.frequency), created: c.created_time || null
          });
        }) };
      });
    },
    google: function (r) {
      return Promise.all([
        api('/api/ads/overview?' + D.qs(r)),
        api('/api/google/campaigns').catch(function () { return null; })
      ]).then(function (res) {
        var ov = res[0], gc = res[1];
        if (!ov.ok || !ov.data || !Array.isArray(ov.data.campaigns)) return { error: errorFor('google', ov) };
        var budgets = {}, types = {}, currency = null;
        if (gc && gc.ok && gc.data && Array.isArray(gc.data.campaigns)) {
          currency = gc.data.currency || null;
          gc.data.campaigns.forEach(function (c) { var bm = n(c.budget_micros); budgets[String(c.campaign_id || c.id)] = bm ? bm / 1e6 : null; types[String(c.campaign_id || c.id)] = c.channel_type || ''; });
        }
        return { currency: currency, campaigns: ov.data.campaigns.map(function (c) {
          var id = String(c.id);
          return finish({
            platform: 'google', id: id, name: c.name || 'Unnamed', statusRaw: c.status, status: normStatus(c.status),
            objective: types[id] || c.channelType || '', budget: budgets[id] != null ? budgets[id] : null, budgetType: budgets[id] != null ? 'daily' : null,
            spend: n(c.spend), impressions: n(c.impressions), clicks: n(c.clicks), conversions: n(c.conversions), convValue: n(c.conversions_value)
          });
        }) };
      });
    },
    tiktok: function (r) {
      return api('/api/tiktok/overview?' + D.qs(r)).then(function (res) {
        if (!res.ok || !res.data || !Array.isArray(res.data.campaigns)) return { error: errorFor('tiktok', res) };
        var hasMetrics = !!res.data.overview;
        return { campaigns: res.data.campaigns.map(function (c) {
          var budget = n(c.budget);
          return finish({
            platform: 'tiktok', id: String(c.id || c.campaign_id), name: c.name || c.campaign_name || 'Unnamed', statusRaw: c.status, status: normStatus(c.status),
            objective: c.objective || '', budget: budget, budgetType: c.budget_mode === 'BUDGET_MODE_DAY' ? 'daily' : (c.budget_mode === 'BUDGET_MODE_TOTAL' ? 'lifetime' : (budget ? 'daily' : null)),
            spend: hasMetrics ? n(c.spend) : null, impressions: hasMetrics ? n(c.impressions) : null, clicks: hasMetrics ? n(c.clicks) : null,
            conversions: hasMetrics ? n(c.conversions) : null, convValue: null, reach: hasMetrics ? n(c.reach) : null, frequency: hasMetrics ? n(c.frequency) : null
          });
        }), metricsMissing: !hasMetrics };
      });
    },
    pinterest: function (r) {
      return api('/api/pinterest/overview?' + D.qs(r)).then(function (res) {
        if (!res.ok || !res.data || !Array.isArray(res.data.campaigns)) return { error: errorFor('pinterest', res) };
        var o = res.data.overview;
        return {
          currency: (res.data.account && res.data.account.currency) || null,
          // Pinterest reports performance for the whole ad account here, not
          // per campaign — kept as account totals, never spread over campaigns.
          accountTotals: o ? { spend: n(o.spend), impressions: n(o.impressions), clicks: n(o.clicks), conversions: n(o.conversions), convValue: null, reach: n(o.reach) } : null,
          campaigns: res.data.campaigns.map(function (c) {
            return finish({ platform: 'pinterest', id: String(c.campaign_id || c.id), name: c.campaign_name || c.name || 'Unnamed', statusRaw: c.summary_status || c.status,
              status: normStatus(c.summary_status || c.status), objective: c.objective_type || '', budget: null, budgetType: null,
              spend: null, impressions: null, clicks: null, conversions: null, convValue: null });
          })
        };
      });
    }
  };

  // Snapshot cache: one entry per range window, 2 minutes. Concurrent
  // callers share the in-flight promise; nothing refetches on every paint.
  var cache = {};
  var TTL = 120000;
  D.load = function (spec, opts) {
    opts = opts || {};
    var r = spec && spec.since && spec.until && spec.days ? spec : D.resolve(spec);
    var key = r.since + '|' + r.until;
    var hit = cache[key];
    if (hit && !opts.force && Date.now() - hit.at < TTL) return hit.p;
    var p = D.status().then(function (st) {
      var conn = OPS.PLATFORMS.filter(function (pl) { return st[pl].connected; });
      return Promise.all(conn.map(function (pl) {
        return loaders[pl](r).then(function (x) { x.p = pl; return x; }, function (e) { return { p: pl, error: errorFor(pl, null, e) }; });
      })).then(function (rows) {
        var snap = { range: r, at: Date.now(), platforms: {}, campaigns: [], connected: conn };
        OPS.PLATFORMS.forEach(function (pl) {
          snap.platforms[pl] = { connected: st[pl].connected, account: st[pl].account, currency: st[pl].account && st[pl].account.currency || null, totals: null, campaigns: [], error: null };
        });
        rows.forEach(function (x) {
          var P = snap.platforms[x.p];
          if (x.error) { P.error = x.error; return; }
          if (x.currency && !P.currency) P.currency = x.currency;
          P.campaigns = x.campaigns || [];
          P.metricsMissing = !!x.metricsMissing;
          if (x.accountTotals) P.totals = finish(Object.assign({}, x.accountTotals));
          else if (CAP[x.p].campaignMetrics && !x.metricsMissing) {
            var t = emptyTotals(); P.campaigns.forEach(function (c) { sumInto(t, c); });
            if (!CAP[x.p].conversionValue) t.convValue = null;
            P.totals = finish(t);
          }
          P.campaigns.forEach(function (c) { c.currency = P.currency; snap.campaigns.push(c); });
        });
        snap.totals = D.combine(snap, OPS.PLATFORMS);
        return snap;
      });
    });
    cache[key] = { at: Date.now(), p: p };
    p.catch(function () { delete cache[key]; });
    return p;
  };
  D.invalidate = function () { cache = {}; };
  // Cross-platform totals. Money is only summed when every included
  // platform reports in the same currency; otherwise it stays per platform.
  D.combine = function (snap, platforms) {
    var t = emptyTotals(), curs = {}, any = false, convValueAll = true;
    platforms.forEach(function (pl) {
      var P = snap.platforms[pl];
      if (!P || !P.totals) return;
      any = true;
      if (P.currency) curs[P.currency] = 1;
      sumInto(t, P.totals);
      if (!isNum(P.totals.convValue) && isNum(P.totals.spend) && P.totals.spend > 0) convValueAll = false;
    });
    var currencies = Object.keys(curs);
    var out = finish(t);
    out.currency = currencies.length === 1 ? currencies[0] : null;
    out.mixedCurrency = currencies.length > 1;
    out.partialValue = !convValueAll; // some spend has no reported conversion value
    if (out.partialValue) out.roas = null;
    out.empty = !any;
    if (out.mixedCurrency) { out.spend = null; out.convValue = null; out.cpa = null; out.roas = null; out.cpc = null; out.cpm = null; }
    out.active = snap.campaigns.filter(function (c) { return platforms.indexOf(c.platform) !== -1 && c.status === 'active'; }).length;
    return out;
  };
  // Current + previous window, joined per campaign.
  D.compare = function (spec, opts) {
    var r = D.resolve(spec);
    var pr = D.previous(r);
    return Promise.all([D.load(r, opts), D.load(pr, opts)]).then(function (x) {
      var cur = x[0], prev = x[1];
      var prevIdx = {};
      prev.campaigns.forEach(function (c) { prevIdx[c.platform + ':' + c.id] = c; });
      cur.campaigns.forEach(function (c) { c.prev = prevIdx[c.platform + ':' + c.id] || null; });
      OPS.PLATFORMS.forEach(function (pl) { if (cur.platforms[pl]) cur.platforms[pl].prevTotals = prev.platforms[pl] ? prev.platforms[pl].totals : null; });
      cur.prevTotals = prev.totals;
      cur.prevRange = pr;
      return cur;
    });
  };

  // Meta ad-level (creative) metrics: last 7 days, and the 7 days before
  // that derived as (last 14 − last 7) for additive metrics — the Meta ads
  // route only supports presets. Frequency/reach when the backend returns them.
  D.metaAds = function (opts) {
    var key = 'metaAds';
    var hit = cache[key];
    if (hit && !(opts && opts.force) && Date.now() - hit.at < TTL) return hit.p;
    var p = Promise.all([api('/api/meta/ads?date_range=LAST_7_DAYS'), api('/api/meta/ads?date_range=LAST_14_DAYS')]).then(function (x) {
      var a7 = x[0], a14 = x[1];
      if (!a7.ok || !a7.data || !Array.isArray(a7.data.ads)) return { error: errorFor('meta', a7), ads: [] };
      var idx14 = {};
      if (a14.ok && a14.data && Array.isArray(a14.data.ads)) a14.data.ads.forEach(function (a) { idx14[a.ad_id] = a; });
      return { ads: a7.data.ads.map(function (a) {
        var b = idx14[a.ad_id];
        var cur = finish({ spend: n(a.spend), impressions: n(a.impressions), clicks: n(a.clicks), conversions: n(a.conversions), convValue: null, frequency: n(a.frequency), reach: n(a.reach) });
        var prev = b ? finish({ spend: n(b.spend) - (n(a.spend) || 0), impressions: n(b.impressions) - (n(a.impressions) || 0), clicks: n(b.clicks) - (n(a.clicks) || 0), conversions: n(b.conversions) - (n(a.conversions) || 0), convValue: null }) : null;
        return { platform: 'meta', id: String(a.ad_id), name: a.ad_name, status: normStatus(a.status), adsetId: a.adset_id, campaignId: a.campaign_id,
          headline: a.headline, text: a.primary_text, image: a.image_url || a.video_thumbnail || '', url: a.destination_url, cta: a.call_to_action, cur: cur, prev: prev };
      }) };
    }).catch(function (e) { return { error: errorFor('meta', null, e), ads: [] }; });
    cache[key] = { at: Date.now(), p: p };
    return p;
  };

  // ════════════════════════════════════════════════════════════════
  // 5. STORE — the user's own Ops/Planning data
  // ════════════════════════════════════════════════════════════════
  // Persisted in profiles.preferences (existing /api/user/preferences,
  // shallow-merged per top-level key) and mirrored to localStorage so the
  // UI is instant and keeps working if the column is missing.
  var S = OPS.store = {};
  var state = { ops: null, planning: null };
  var DEFAULTS = {
    ops: { thresholds: { cpaIncreasePct: 25, ctrDropPct: 30, costSpikePct: 40, convChangePct: 40, minSpend: 20, minConversions: 3, minImpressions: 1000, fatigueCtrDropPct: 25, fatigueFrequency: 3.5, pacingTolerancePct: 15, budgetLimitedPct: 95 },
      dismissed: {}, saved: {}, changeLog: [] },
    planning: { budget: null, plans: [], briefs: [], naming: null, utm: null }
  };
  function lsKey(k) { var u = uid(); return u ? 'oriven_' + k + '_' + u : null; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  S.get = function (k) {
    if (!state[k]) {
      var raw = null; try { var lk = lsKey(k); raw = lk ? JSON.parse(localStorage.getItem(lk) || 'null') : null; } catch (_) {}
      state[k] = Object.assign(clone(DEFAULTS[k]), raw || {});
      if (k === 'ops') state.ops.thresholds = Object.assign(clone(DEFAULTS.ops.thresholds), state.ops.thresholds || {});
    }
    return state[k];
  };
  var timers = {}, listeners = [];
  S.onChange = function (fn) { listeners.push(fn); };
  S.save = function (k) {
    var v = S.get(k);
    try { var lk = lsKey(k); if (lk) localStorage.setItem(lk, JSON.stringify(v)); } catch (_) {}
    clearTimeout(timers[k]);
    timers[k] = setTimeout(function () {
      var body = {}; body[k] = v;
      api('/api/user/preferences', { method: 'PUT', body: JSON.stringify(body) }).then(function (r) {
        if (!r.ok) toast('Saved on this device, but couldn’t sync to your account. It will retry on your next change.', 'warn');
        else if (r.data && r.data.columnMissing && !S._warnedColumn) { S._warnedColumn = true; toast('Saved on this device only — account sync for plans and settings isn’t enabled yet.', 'warn'); }
      }).catch(function () { toast('Saved on this device, but couldn’t reach OrivenAI to sync it.', 'warn'); });
    }, 600);
    listeners.forEach(function (fn) { try { fn(k); } catch (_) {} });
  };
  // Pull the account copy once per session (newer devices win per key).
  S.hydrate = function () {
    return api('/api/user/preferences').then(function (r) {
      var pref = r && r.ok && r.data ? r.data.preferences : null;
      if (!pref) return;
      ['ops', 'planning'].forEach(function (k) {
        if (pref[k] && typeof pref[k] === 'object') {
          state[k] = Object.assign(clone(DEFAULTS[k]), pref[k]);
          if (k === 'ops') state.ops.thresholds = Object.assign(clone(DEFAULTS.ops.thresholds), state.ops.thresholds || {});
          try { var lk = lsKey(k); if (lk) localStorage.setItem(lk, JSON.stringify(state[k])); } catch (_) {}
        }
      });
      listeners.forEach(function (fn) { try { fn('hydrate'); } catch (_) {} });
    }).catch(function () {});
  };
  S.reset = function () { state = { ops: null, planning: null }; };

  // ════════════════════════════════════════════════════════════════
  // 4. SIGNALS
  // ════════════════════════════════════════════════════════════════
  // Every signal states the rule that fired (with the user's threshold),
  // the data that triggered it, and what can be done. Nothing fires on
  // too little data (minimum spend / conversions / impressions).
  var SIG = OPS.signals = {};
  var SEV_RANK = { high: 0, medium: 1, low: 2, info: 3 };
  function ev(label, cur, prev, kind, currency) {
    var f = function (v) { return kind === 'money' ? money(v, currency) : kind === 'pct' ? pct(v) : kind === 'ratio' ? ratio(v) : kind === 'freq' ? (isNum(v) ? v.toFixed(2) : '—') : num(v); };
    return { label: label, cur: f(cur), prev: prev === undefined ? null : f(prev), change: prev === undefined ? null : changeTxt(change(cur, prev)) };
  }
  SIG.compute = function (snap, opts) {
    opts = opts || {};
    var th = Object.assign({}, S.get('ops').thresholds, opts.thresholds || {});
    var out = [];
    var platforms = opts.platform && opts.platform !== 'all' ? [opts.platform] : OPS.PLATFORMS;
    var rangeTxt = snap.range ? snap.range.label.toLowerCase() : 'this period';
    var prevTxt = 'the previous ' + (snap.range ? snap.range.days : '') + ' days';

    // Tracking: a platform reporting spend but zero conversions across every
    // campaign in both periods is far more likely a tracking gap than
    // ten separate campaign problems — one signal, not ten.
    var trackingGap = {};
    platforms.forEach(function (pl) {
      var P = snap.platforms[pl]; if (!P || !P.totals || !CAP[pl].conversions) return;
      var t = P.totals, pt = P.prevTotals;
      if (isNum(t.spend) && t.spend >= th.minSpend * 3 && t.conversions === 0 && (!pt || pt.conversions === 0)) {
        trackingGap[pl] = true;
        out.push({ id: 'tracking:' + pl, type: 'tracking', severity: 'high', category: 'tracking', platform: pl, campaign: null,
          title: CAP[pl].name + ' reports spend but no conversions',
          why: 'Without conversion data, CPA and ROAS can’t be measured and the platform can’t optimise for results.',
          evidence: [ev('Spend', t.spend, pt ? pt.spend : undefined, 'money', P.currency), ev('Conversions', t.conversions, pt ? pt.conversions : undefined)],
          rule: 'Spend of at least ' + money(th.minSpend * 3, P.currency) + ' with zero conversions in ' + rangeTxt + ' and ' + prevTxt + '.',
          recommendation: 'Check that the ' + CAP[pl].provider + ' pixel/conversion tracking is installed and firing before judging campaign performance.',
          actions: [{ type: 'native', label: 'Open ' + CAP[pl].provider }, { type: 'setup', label: 'Check tracking setup' }] });
      }
    });

    snap.campaigns.forEach(function (c) {
      if (platforms.indexOf(c.platform) === -1) return;
      var p = c.prev, cur = c.currency, base = { platform: c.platform, campaign: { id: c.id, name: c.name } };
      var hasP = !!p;
      // CPA increase
      if (hasP && isNum(c.cpa) && isNum(p.cpa) && c.conversions >= th.minConversions && p.conversions >= th.minConversions && c.spend >= th.minSpend) {
        var cc = change(c.cpa, p.cpa);
        if (cc >= th.cpaIncreasePct) {
          out.push(Object.assign({ id: 'cpa_up:' + c.platform + ':' + c.id, type: 'cpa_up', severity: cc >= th.cpaIncreasePct * 2 ? 'high' : 'medium', category: 'campaign',
            title: 'CPA up ' + changeTxt(cc) + ' on ' + c.name,
            why: 'Each conversion now costs materially more than in ' + prevTxt + '.',
            evidence: [ev('CPA', c.cpa, p.cpa, 'money', cur), ev('Spend', c.spend, p.spend, 'money', cur), ev('Conversions', c.conversions, p.conversions), ev('CTR', c.ctr, p.ctr, 'pct')],
            rule: 'CPA rose by ' + th.cpaIncreasePct + '% or more (your threshold), with at least ' + th.minConversions + ' conversions in both periods and ' + money(th.minSpend, cur) + '+ spend.',
            recommendation: 'Look at what changed (creative, audience, landing page). If CPA stays high, reduce the daily budget about 15% until it recovers.',
            actions: actionsFor(c, ['budgetDown', 'open', 'creative']) }, base));
        }
      }
      // Spending without conversions (skip when it's a platform-wide tracking gap)
      if (!trackingGap[c.platform] && CAP[c.platform].conversions && c.status === 'active' && isNum(c.spend) && c.conversions === 0) {
        var need = Math.max(th.minSpend * 2, isNum(p && p.cpa) ? p.cpa * 2 : 0);
        if (c.spend >= need) {
          out.push(Object.assign({ id: 'no_conv:' + c.platform + ':' + c.id, type: 'no_conv', severity: 'high', category: 'budget',
            title: c.name + ' spent ' + money(c.spend, cur) + ' with no conversions',
            why: 'Budget is being used without a measurable result in ' + rangeTxt + '.',
            evidence: [ev('Spend', c.spend, hasP ? p.spend : undefined, 'money', cur), ev('Conversions', 0, hasP ? p.conversions : undefined), ev('Clicks', c.clicks, hasP ? p.clicks : undefined)],
            rule: 'Active campaign with at least ' + money(need, cur) + ' spend (2× your minimum spend' + (isNum(p && p.cpa) ? ' or 2× its previous CPA' : '') + ') and zero conversions.',
            recommendation: 'Pause it or cut its budget while you check the offer, landing page and conversion tracking.',
            actions: actionsFor(c, ['pause', 'budgetDown', 'open']) }, base));
        }
      }
      // CTR decline
      if (hasP && isNum(c.ctr) && isNum(p.ctr) && c.impressions >= th.minImpressions && p.impressions >= th.minImpressions) {
        var ct = change(c.ctr, p.ctr);
        if (ct <= -th.ctrDropPct) {
          out.push(Object.assign({ id: 'ctr_down:' + c.platform + ':' + c.id, type: 'ctr_down', severity: 'medium', category: 'creative',
            title: 'CTR down ' + changeTxt(ct) + ' on ' + c.name,
            why: 'Fewer people click the ads — often an early sign of creative fatigue or a less relevant audience.',
            evidence: [ev('CTR', c.ctr, p.ctr, 'pct'), ev('Impressions', c.impressions, p.impressions), ev('Frequency', c.frequency, p.frequency, 'freq')],
            rule: 'CTR fell by ' + th.ctrDropPct + '% or more (your threshold), with ' + num(th.minImpressions) + '+ impressions in both periods.',
            recommendation: 'Refresh the creative: test a new hook or visual for this campaign in Create.',
            actions: actionsFor(c, ['creative', 'open']) }, base));
        }
      }
      // Cost spike (CPM)
      if (hasP && isNum(c.cpm) && isNum(p.cpm) && c.impressions >= th.minImpressions && p.impressions >= th.minImpressions) {
        var cm = change(c.cpm, p.cpm);
        if (cm >= th.costSpikePct) {
          out.push(Object.assign({ id: 'cpm_up:' + c.platform + ':' + c.id, type: 'cpm_up', severity: 'low', category: 'delivery',
            title: 'CPM up ' + changeTxt(cm) + ' on ' + c.name,
            why: 'Reaching people got more expensive, which pushes up every downstream cost.',
            evidence: [ev('CPM', c.cpm, p.cpm, 'money', cur), ev('CPC', c.cpc, p.cpc, 'money', cur), ev('Impressions', c.impressions, p.impressions)],
            rule: 'CPM rose by ' + th.costSpikePct + '% or more (your threshold), with ' + num(th.minImpressions) + '+ impressions in both periods.',
            recommendation: 'Check for auction pressure (season, competitors) and audience size; broaden targeting if it has narrowed.',
            actions: actionsFor(c, ['open']) }, base));
        }
      }
      // Conversion volume change
      if (hasP && isNum(c.conversions) && isNum(p.conversions) && p.conversions > 0 && Math.max(c.conversions, p.conversions) >= Math.max(10, th.minConversions)) {
        var cv = change(c.conversions, p.conversions);
        if (Math.abs(cv) >= th.convChangePct) {
          var up = cv > 0;
          out.push(Object.assign({ id: 'conv_' + (up ? 'up' : 'down') + ':' + c.platform + ':' + c.id, type: up ? 'conv_up' : 'conv_down', severity: up ? 'info' : 'medium', category: 'campaign',
            title: 'Conversions ' + (up ? 'up ' : 'down ') + changeTxt(cv) + ' on ' + c.name,
            why: up ? 'This campaign is delivering materially more results.' : 'This campaign is delivering materially fewer results.',
            evidence: [ev('Conversions', c.conversions, p.conversions), ev('Spend', c.spend, p.spend, 'money', cur), ev('CPA', c.cpa, p.cpa, 'money', cur)],
            rule: 'Conversions changed by ' + th.convChangePct + '% or more (your threshold), with at least 10 conversions in one of the periods.',
            recommendation: up ? 'If CPA held steady, this campaign may be worth more budget.' : 'Compare spend, CTR and CPA to see whether delivery or efficiency dropped.',
            actions: actionsFor(c, up ? ['budgetUp', 'open'] : ['open']) }, base));
        }
      }
      // Active but not spending (not meaningful for "today")
      if (c.status === 'active' && c.spend === 0 && snap.range && snap.range.key !== 'TODAY' && isNum(c.impressions)) {
        out.push(Object.assign({ id: 'no_spend:' + c.platform + ':' + c.id, type: 'no_spend', severity: 'medium', category: 'delivery',
          title: c.name + ' is active but didn’t spend',
          why: 'An active campaign that doesn’t deliver usually has an approval, budget, payment or targeting issue.',
          evidence: [ev('Spend', 0, undefined, 'money', cur), ev('Impressions', c.impressions)],
          rule: 'Status is active, with zero spend in ' + rangeTxt + '.',
          recommendation: 'Check ad approval, budget, schedule, payment method and audience size in ' + CAP[c.platform].provider + '.',
          actions: actionsFor(c, ['native', 'open']) }, base));
      }
      // Spending its full daily budget
      if (c.status === 'active' && c.budgetType === 'daily' && isNum(c.budget) && c.budget > 0 && isNum(c.spend) && snap.range && snap.range.days >= 3) {
        var perDay = c.spend / snap.range.days;
        if (perDay >= c.budget * th.budgetLimitedPct / 100) {
          var good = isNum(c.cpa) && snap.platforms[c.platform].totals && isNum(snap.platforms[c.platform].totals.cpa) && c.cpa <= snap.platforms[c.platform].totals.cpa;
          out.push(Object.assign({ id: 'limited:' + c.platform + ':' + c.id, type: 'limited', severity: good ? 'low' : 'info', category: 'budget',
            title: c.name + ' is spending its full daily budget',
            why: good ? 'It converts at or below the platform average and may be held back by its budget.' : 'Delivery is capped by the budget.',
            evidence: [ev('Avg. spend / day', perDay, undefined, 'money', cur), ev('Daily budget', c.budget, undefined, 'money', cur), ev('CPA', c.cpa, undefined, 'money', cur)],
            rule: 'Average daily spend reached ' + th.budgetLimitedPct + '% or more of the daily budget over ' + rangeTxt + '.',
            recommendation: good ? 'Consider raising the budget 15–20% and watch whether CPA holds.' : 'No action needed unless you want more volume from this campaign.',
            actions: actionsFor(c, good ? ['budgetUp', 'open'] : ['open']) }, base));
        }
      }
    });

    // Cross-platform CPA spread (with attribution caveat)
    var withCpa = platforms.filter(function (pl) { var t = snap.platforms[pl] && snap.platforms[pl].totals; return t && isNum(t.cpa) && t.conversions >= th.minConversions * 3; });
    if (withCpa.length >= 2) {
      withCpa.sort(function (a, b) { return snap.platforms[a].totals.cpa - snap.platforms[b].totals.cpa; });
      var lo = withCpa[0], hi = withCpa[withCpa.length - 1], loT = snap.platforms[lo].totals, hiT = snap.platforms[hi].totals;
      var sameCur = snap.platforms[lo].currency === snap.platforms[hi].currency;
      if (sameCur && hiT.cpa / loT.cpa >= 1.5) {
        out.push({ id: 'xplat_cpa', type: 'xplat_cpa', severity: 'info', category: 'platform', platform: null, campaign: null,
          title: CAP[lo].short + ' converts at a lower CPA than ' + CAP[hi].short,
          why: 'Budget may produce more results where conversions are cheaper — but each platform counts conversions with its own attribution.',
          evidence: [ev(CAP[lo].short + ' CPA', loT.cpa, undefined, 'money', snap.platforms[lo].currency), ev(CAP[hi].short + ' CPA', hiT.cpa, undefined, 'money', snap.platforms[hi].currency)],
          rule: 'Platform-reported CPA differs by 1.5× or more, each with at least ' + th.minConversions * 3 + ' conversions.',
          recommendation: 'Review the budget allocation in Autopilot before moving spend; confirm with your own sales data where possible.',
          actions: [{ type: 'optimizeBudget', label: 'Review budget allocation' }] });
      }
    }

    // Budget pacing against the plan (when a monthly plan exists)
    var plan = S.get('planning').budget;
    if (plan && opts.monthSnap) {
      var m = opts.monthSnap, now = new Date();
      var dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      var frac = now.getDate() / dim;
      platforms.forEach(function (pl) {
        var planned = plan.alloc && isNum(+plan.alloc[pl]) ? +plan.alloc[pl] : null;
        var P = m.platforms[pl]; if (!planned || !P || !P.totals || !isNum(P.totals.spend)) return;
        if (plan.currency && P.currency && plan.currency !== P.currency) return;
        var expected = planned * frac, spent = P.totals.spend, dev = change(spent, expected);
        if (isNum(dev) && Math.abs(dev) >= th.pacingTolerancePct) {
          var ahead = dev > 0;
          out.push({ id: 'pacing:' + pl, type: ahead ? 'pacing_ahead' : 'pacing_behind', severity: ahead && spent > planned ? 'high' : 'medium', category: 'budget', platform: pl, campaign: null,
            title: CAP[pl].short + ' is pacing ' + (ahead ? 'ahead of' : 'behind') + ' plan (' + changeTxt(dev) + ')',
            why: ahead ? 'At this rate the month’s planned budget runs out early.' : 'Less of the planned budget is being used than expected by today.',
            evidence: [ev('Spent this month', spent, undefined, 'money', P.currency), ev('Expected by today', expected, undefined, 'money', P.currency), ev('Planned for month', planned, undefined, 'money', P.currency)],
            rule: 'Month-to-date spend differs from straight-line pacing by ' + th.pacingTolerancePct + '% or more (your tolerance).',
            recommendation: ahead ? 'Lower daily budgets on ' + CAP[pl].short + ' or raise the plan.' : 'Raise budgets on ' + CAP[pl].short + ' campaigns that convert well, or lower the plan.',
            actions: [{ type: 'optimizeBudget', label: 'Open budget plan' }] });
        }
      });
    }

    var dismissed = S.get('ops').dismissed || {};
    var now2 = Date.now();
    out = out.filter(function (s) { var d = dismissed[s.id]; return !(d && d > now2); });
    out.sort(function (a, b) { return SEV_RANK[a.severity] - SEV_RANK[b.severity]; });
    return out;
  };
  // Creative fatigue from Meta ad-level data (CTR trend + frequency +
  // sibling comparison). Returns signals with creative context.
  SIG.fatigue = function (ads) {
    var th = S.get('ops').thresholds, out = [];
    var byAdset = {};
    ads.forEach(function (a) { (byAdset[a.adsetId] = byAdset[a.adsetId] || []).push(a); });
    ads.forEach(function (a) {
      var c = a.cur, p = a.prev;
      if (!p || !isNum(c.ctr) || !isNum(p.ctr) || c.impressions < th.minImpressions * 2 || p.impressions < th.minImpressions) return;
      var drop = change(c.ctr, p.ctr);
      var reasons = [];
      if (drop <= -th.fatigueCtrDropPct) reasons.push('CTR fell ' + changeTxt(drop) + ' week over week');
      if (isNum(c.frequency) && c.frequency >= th.fatigueFrequency) reasons.push('frequency is ' + c.frequency.toFixed(1) + ' (people see it often)');
      var sibs = (byAdset[a.adsetId] || []).filter(function (s) { return s !== a && isNum(s.cur.ctr) && s.cur.impressions >= th.minImpressions; });
      var sibAvg = sibs.length ? sibs.reduce(function (t, s) { return t + s.cur.ctr; }, 0) / sibs.length : null;
      if (isNum(sibAvg) && c.ctr < sibAvg * 0.7) reasons.push('CTR is ' + Math.round((1 - c.ctr / sibAvg) * 100) + '% below other ads in its ad set');
      if (drop <= -th.fatigueCtrDropPct && reasons.length >= 1) {
        out.push({ id: 'fatigue:' + a.id, type: 'fatigue', severity: reasons.length >= 2 ? 'medium' : 'low', category: 'creative', platform: 'meta',
          campaign: { id: a.campaignId, name: null }, ad: a,
          title: '“' + (a.headline || a.name) + '” shows signs of creative fatigue',
          why: 'Performance of this creative is declining: ' + reasons.join('; ') + '.',
          evidence: [ev('CTR (last 7 days)', c.ctr, p.ctr, 'pct'), ev('Impressions', c.impressions, p.impressions), ev('Frequency', c.frequency, undefined, 'freq'), ev('Spend', c.spend, p.spend, 'money')],
          rule: 'CTR fell ' + th.fatigueCtrDropPct + '% or more versus the 7 days before, with enough impressions in both weeks' + (isNum(c.frequency) ? '' : ' (frequency not available for this ad)') + '.',
          recommendation: 'Create a variation with a new hook or visual and test it alongside this ad.',
          actions: [{ type: 'creativeFrom', label: 'Create variation', ad: a.id }, { type: 'native', label: 'Open in Meta' }] });
      }
    });
    return out;
  };
  function actionsFor(c, kinds) {
    var cap = CAP[c.platform], a = [];
    kinds.forEach(function (k) {
      if (k === 'pause' && cap.pause && c.status === 'active') a.push({ type: 'pause', label: 'Pause campaign' });
      else if (k === 'budgetDown' && cap.budgetEdit && c.budgetType === 'daily' && isNum(c.budget)) a.push({ type: 'budget', label: 'Lower budget 15%', factor: 0.85 });
      else if (k === 'budgetUp' && cap.budgetEdit && c.budgetType === 'daily' && isNum(c.budget)) a.push({ type: 'budget', label: 'Raise budget 15%', factor: 1.15 });
      else if (k === 'creative') a.push({ type: 'creative', label: 'Try new copy & angles' });
      else if (k === 'open') a.push({ type: 'open', label: 'Open campaign' });
      else if (k === 'native') a.push({ type: 'native', label: 'Open ' + cap.provider });
    });
    return a;
  }
  // A short, factual "what changed" built from observed numbers only.
  SIG.summary = function (snap, signals) {
    var t = snap.totals, p = snap.prevTotals, lines = [];
    if (!t || t.empty) return { observed: [], calculated: [] };
    var cur = t.currency;
    if (t.mixedCurrency) lines.push('Spend is reported in more than one currency, so it’s shown per platform.');
    else if (isNum(t.spend)) lines.push('Spend ' + money(t.spend, cur) + (p && isNum(p.spend) ? ' (' + changeTxt(change(t.spend, p.spend)) + ' vs. previous period)' : '') + '.');
    if (isNum(t.conversions)) lines.push(num(t.conversions) + ' platform-reported conversions' + (p && isNum(p.conversions) ? ' (' + changeTxt(change(t.conversions, p.conversions)) + ')' : '') + '.');
    if (isNum(t.cpa)) lines.push('Blended CPA ' + money(t.cpa, cur) + (p && isNum(p.cpa) ? ' (' + changeTxt(change(t.cpa, p.cpa)) + ')' : '') + '.');
    var calc = signals.filter(function (s) { return s.severity !== 'info'; }).slice(0, 3).map(function (s) { return s.title; });
    return { observed: lines, calculated: calc };
  };

  // ════════════════════════════════════════════════════════════════
  // 6. ACTIONS — external changes, always confirmed, always logged
  // ════════════════════════════════════════════════════════════════
  var ACT = OPS.actions = {};
  function flow() { return window.orvWorkspace && orvWorkspace.flow; }
  function logChange(entry) {
    var o = S.get('ops');
    o.changeLog = [Object.assign({ at: new Date().toISOString() }, entry)].concat(o.changeLog || []).slice(0, 200);
    S.save('ops');
  }
  ACT.log = logChange;
  ACT.history = function (filter) {
    var log = S.get('ops').changeLog || [];
    return filter ? log.filter(filter) : log;
  };
  ACT.toggle = function (c, action, source) {
    var F = flow(); if (!F || !CAP[c.platform][action]) return Promise.resolve(false);
    return F.confirmProviderToggle({ platform: c.platform, action: action, name: c.name, run: function () {
      return api('/api/' + c.platform + '/campaign/' + encodeURIComponent(c.id) + '/' + action, { method: 'POST', body: JSON.stringify({ campaignName: c.name }) }).then(function (r) {
        if (!r.ok) {
          var m = F.error({ status: r.status, body: r.data, phase: 'publish' });
          return { ok: false, title: 'Couldn’t ' + action + ' the campaign', message: m.message };
        }
        logChange({ kind: action, platform: c.platform, campaignId: c.id, campaignName: c.name, from: c.status, to: action === 'pause' ? 'paused' : 'active', source: source || 'Campaigns', by: 'You' });
        c.status = action === 'pause' ? 'paused' : 'active';
        // Keep OrivenAI's own record of a campaign it launched in step (Home,
        // Continue and Replay read it) — the same update the Launch live card made.
        var rec = OW.campaigns && OW.campaigns.findByExternal ? OW.campaigns.findByExternal(c.platform, c.id, null) : null;
        if (rec) { rec.status = action === 'pause' ? 'paused' : 'published'; rec.providerStatus = action === 'pause' ? 'paused' : 'active'; rec.updated = new Date().toISOString(); if (typeof window._saveCamps === 'function') window._saveCamps(); }
        D.invalidate();
        toast('Campaign ' + (action === 'pause' ? 'paused' : 'resumed') + ' on ' + CAP[c.platform].name + '.', 'ok');
        return { ok: true };
      });
    } });
  };
  // Budget change with explicit current → proposed preview.
  ACT.budget = function (c, proposed, reason, source) {
    var F = flow(); if (!F) return Promise.resolve(false);
    var cap = CAP[c.platform];
    if (!cap.budgetEdit || c.budgetType !== 'daily' || !isNum(c.budget)) {
      F.confirm({ title: 'Budget can’t be changed here', body: '<p>' + esc(cap.budgetNote) + '</p>', confirmLabel: 'Open ' + cap.provider }).then(function (y) { if (y) window.open(cap.native, '_blank', 'noopener'); });
      return Promise.resolve(false);
    }
    return new Promise(function (resolve) {
      var val = isNum(proposed) ? Math.round(proposed * 100) / 100 : c.budget;
      var d = F.dialog({ title: 'Change daily budget', eyebrow: cap.name + ' · ' + c.name, onClose: function (r) { resolve(!!r); },
        body: '<form class="ofd-form" novalidate>' +
          '<div class="op-budget-compare"><div><span>Current</span><b>' + esc(money(c.budget, c.currency)) + ' / day</b></div><div aria-hidden="true">→</div><div><span>Proposed</span><b id="opBudPrev">' + esc(money(val, c.currency)) + ' / day</b></div></div>' +
          '<label class="ofd-lbl" for="opBud">New daily budget' + (c.currency ? ' (' + esc(c.currency) + ')' : '') + '</label>' +
          '<input id="opBud" class="ofd-input" type="number" inputmode="decimal" min="1" step="0.01" value="' + esc(val) + '" aria-describedby="opBudErr opBudWhy" data-autofocus>' +
          (reason ? '<p class="ofd-hint" id="opBudWhy">' + esc(reason) + '</p>' : '<p class="ofd-hint" id="opBudWhy">Takes effect on ' + esc(cap.provider) + ' immediately.</p>') +
          '<p class="ofd-err" id="opBudErr" role="alert" hidden></p></form>',
        actions: [{ label: 'Cancel', kind: 'ghost', onClick: function (a) { a.close(false); } }, { label: 'Apply change', kind: 'primary', onClick: apply }] });
      var inp = d.el.querySelector('#opBud'), err = d.el.querySelector('#opBudErr'), prev = d.el.querySelector('#opBudPrev');
      inp.addEventListener('input', function () { var v = parseFloat(inp.value); prev.textContent = isNum(v) ? money(v, c.currency) + ' / day' : '—'; });
      d.el.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); apply(d); });
      function apply(api2) {
        var v = parseFloat(String(inp.value).replace(',', '.'));
        if (!isNum(v) || v < 1) { err.textContent = 'Enter a daily budget of at least 1.'; err.hidden = false; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
        v = Math.round(v * 100) / 100;
        api2.busy(true, 'Applying…');
        var body = c.platform === 'meta' ? { daily_budget: Math.round(v * 100) } : { daily_budget: v };
        api('/api/' + c.platform + '/campaign/' + encodeURIComponent(c.id), { method: 'PATCH', body: JSON.stringify(body) }).then(function (r) {
          api2.busy(false);
          if (!r.ok) {
            var m = F.error({ status: r.status, body: r.data, phase: 'publish' });
            err.textContent = 'The budget wasn’t changed. ' + m.message; err.hidden = false; return;
          }
          logChange({ kind: 'budget', platform: c.platform, campaignId: c.id, campaignName: c.name, from: c.budget, to: v, currency: c.currency, reason: reason || '', source: source || 'Campaigns', by: 'You' });
          c.budget = v; D.invalidate();
          api2.close(true);
          toast('Daily budget changed to ' + money(v, c.currency) + ' on ' + cap.name + '.', 'ok');
        }).catch(function () { api2.busy(false); err.textContent = 'Couldn’t reach OrivenAI — the budget wasn’t changed.'; err.hidden = false; });
      }
    });
  };
  ACT.native = function (p) { var cap = CAP[p]; if (cap) window.open(cap.native, '_blank', 'noopener'); };

  // ════════════════════════════════════════════════════════════════
  // 7. AI — contextual "Ask OrivenAI"
  // ════════════════════════════════════════════════════════════════
  // The chat is opened with the question prefilled and the on-screen data
  // attached as context. Nothing is sent (and no credits are used) until
  // the user presses Send.
  var AI = OPS.ai = {};
  AI.context = null;
  AI.setContext = function (ctx) { AI.context = ctx; if (window.orvContext) window.orvContext.ops = ctx; };
  // The key numbers are written into the question itself (visible and
  // editable before sending), so they reach the assistant even where the
  // structured context field isn't supported by the deployed backend yet.
  AI.ask = function (question, ctx, facts) {
    if (ctx) AI.setContext(ctx);
    if (facts) question = question + '\n\nOn my screen: ' + facts;
    if (typeof window.orvOpenAi === 'function') window.orvOpenAi();
    setTimeout(function () {
      var inp = document.getElementById('orvAiInput');
      if (inp) { inp.value = question || ''; inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (_) {} if (typeof window.aicAutoResize === 'function') window.aicAutoResize(inp); }
    }, 120);
  };
  // One plain-language line of the numbers on screen (for the question text).
  AI.factsLine = function (snap, signals) {
    if (!snap || !snap.totals || snap.totals.empty) return '';
    var t = snap.totals, p = snap.prevTotals || {}, cur = t.currency, parts = [];
    var ch = function (k) { var c = change(t[k], p[k]); return isNum(c) ? ' (' + changeTxt(c) + ' vs previous period)' : ''; };
    if (isNum(t.spend)) parts.push('spend ' + money(t.spend, cur) + ch('spend'));
    if (isNum(t.conversions)) parts.push(num(t.conversions) + ' platform-reported conversions' + ch('conversions'));
    if (isNum(t.cpa)) parts.push('CPA ' + money(t.cpa, cur) + ch('cpa'));
    if (isNum(t.roas)) parts.push('ROAS ' + ratio(t.roas));
    var sg = (signals || []).filter(function (x) { return x.severity !== 'info'; }).slice(0, 3).map(function (x) { return x.title; });
    return (snap.range ? snap.range.label + ': ' : '') + parts.join(', ') + '.' + (sg.length ? ' Flagged: ' + sg.join('; ') + '.' : '');
  };
  // Compact, capped facts for the chat (observed + calculated).
  AI.factsFor = function (area, snap, signals, extra) {
    if (!snap) return { area: area };
    var plats = OPS.PLATFORMS.filter(function (p) { return snap.platforms[p] && snap.platforms[p].totals; }).map(function (p) {
      var t = snap.platforms[p].totals, cur = snap.platforms[p].currency;
      return { name: CAP[p].name, summary: 'spend ' + money(t.spend, cur) + ', ' + num(t.impressions) + ' impressions, ' + num(t.clicks) + ' clicks, CTR ' + pct(t.ctr) + ', ' + num(t.conversions) + ' conversions, CPA ' + money(t.cpa, cur) + (isNum(t.roas) ? ', ROAS ' + ratio(t.roas) : '') + (snap.platforms[p].prevTotals && isNum(snap.platforms[p].prevTotals.spend) ? ' (previous period spend ' + money(snap.platforms[p].prevTotals.spend, cur) + ', conversions ' + num(snap.platforms[p].prevTotals.conversions) + ')' : '') };
    });
    return Object.assign({ area: area, range: snap.range ? snap.range.label + ' (' + snap.range.since + ' to ' + snap.range.until + ')' : '', platforms: plats,
      signals: (signals || []).slice(0, 8).map(function (s) { return s.title + ' — ' + s.rule; }) }, extra || {});
  };

  // ════════════════════════════════════════════════════════════════
  // Shared UI bits
  // ════════════════════════════════════════════════════════════════
  var UI = OPS.ui = {};
  UI.platBadge = function (p) { return '<span class="op-plat op-plat-' + esc(p) + '"><i aria-hidden="true"></i>' + esc(CAP[p] ? CAP[p].short : p) + '</span>'; };
  UI.status = function (s) {
    var L = { active: 'Active', paused: 'Paused', ended: 'Ended', scheduled: 'Scheduled', draft: 'Draft', issue: 'Issue', other: 'Other', unknown: 'Unknown' };
    return '<span class="op-status op-status-' + esc(s) + '">' + esc(L[s] || s) + '</span>';
  };
  UI.rangeSelect = function (id, cur, onchange) {
    return '<label class="op-sr" for="' + id + '">Date range</label><select id="' + id + '" class="op-select" onchange="' + onchange + '">' +
      RANGES.filter(function (r) { return r[0] !== 'CUSTOM'; }).map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === cur ? ' selected' : '') + '>' + esc(r[1]) + '</option>'; }).join('') + '</select>';
  };
  UI.platformFilter = function (name, cur, onclick, snap) {
    var opts = ['all'].concat(OPS.PLATFORMS);
    return '<div class="op-seg" role="radiogroup" aria-label="Platform">' + opts.map(function (p) {
      var on = p === cur, conn = p === 'all' || !snap || (snap.platforms[p] && snap.platforms[p].connected);
      return '<button type="button" role="radio" aria-checked="' + on + '" class="op-seg-btn' + (on ? ' is-on' : '') + (conn ? '' : ' is-off') + '" onclick="' + onclick.replace('%P%', p) + '">' + (p === 'all' ? 'All platforms' : esc(CAP[p].short)) + '</button>';
    }).join('') + '</div>';
  };
  UI.empty = function (title, body, actions) {
    return '<div class="op-empty"><h3>' + esc(title) + '</h3><p>' + esc(body) + '</p>' + (actions ? '<div class="op-empty-actions">' + actions + '</div>' : '') + '</div>';
  };
  UI.connectButtons = function () {
    return OPS.PLATFORMS.map(function (p) { return '<button type="button" class="op-btn op-btn-ghost" onclick="bizGoTo(\'connections\')">Connect ' + esc(CAP[p].short) + '</button>'; }).join('');
  };
  UI.loading = function (label) { return '<div class="op-loading" role="status"><span class="op-loading-bar" aria-hidden="true"></span>' + esc(label || 'Loading your advertising data…') + '</div>'; };
  UI.signalCard = function (s, opts) {
    opts = opts || {};
    var id = 'opsig_' + s.id.replace(/[^a-z0-9]/gi, '_');
    var acts = (s.actions || []).map(function (a, i) {
      return '<button type="button" class="op-btn ' + (i === 0 ? 'op-btn-primary' : 'op-btn-ghost') + '" onclick="orvWorkspace.ops.runSignalAction(\'' + jsq(s.id) + '\',' + i + ')">' + esc(a.label) + '</button>';
    }).join('');
    return '<article class="op-sig op-sig-' + esc(s.severity) + '" data-sig="' + esc(s.id) + '">' +
      '<div class="op-sig-head"><span class="op-sev op-sev-' + esc(s.severity) + '">' + esc({ high: 'High', medium: 'Medium', low: 'Low', info: 'Info' }[s.severity]) + '</span>' +
      (s.platform ? UI.platBadge(s.platform) : '') + '<span class="op-sig-cat">' + esc(s.category) + '</span></div>' +
      '<h4 class="op-sig-title">' + esc(s.title) + '</h4>' +
      '<p class="op-sig-why">' + esc(s.why) + '</p>' +
      '<details class="op-sig-more"' + (opts.open ? ' open' : '') + '><summary>Why was this flagged?</summary>' +
        '<table class="op-ev"><thead><tr><th scope="col">Data</th><th scope="col">Now</th><th scope="col">Before</th><th scope="col">Change</th></tr></thead><tbody>' +
        s.evidence.map(function (e) { return '<tr><th scope="row">' + esc(e.label) + '</th><td>' + esc(e.cur) + '</td><td>' + esc(e.prev == null ? '—' : e.prev) + '</td><td>' + esc(e.change == null ? '—' : e.change) + '</td></tr>'; }).join('') +
        '</tbody></table><p class="op-sig-rule"><b>Rule:</b> ' + esc(s.rule) + '</p></details>' +
      '<p class="op-sig-rec"><b>OrivenAI suggests:</b> ' + esc(s.recommendation) + '</p>' +
      '<div class="op-sig-actions">' + acts +
        (opts.manage ? '<button type="button" class="op-btn op-btn-text" onclick="orvWorkspace.ops.saveSignal(\'' + jsq(s.id) + '\')">' + (S.get('ops').saved[s.id] ? 'Saved' : 'Save') + '</button><button type="button" class="op-btn op-btn-text" onclick="orvWorkspace.ops.dismissSignal(\'' + jsq(s.id) + '\')">Dismiss for 7 days</button>' : '') +
      '</div></article>';
  };

  // Signal registry so cards can act on the right object.
  var sigIndex = {};
  OPS.registerSignals = function (list, snap) { list.forEach(function (s) { sigIndex[s.id] = { s: s, snap: snap }; }); };
  OPS._sig = function (id) { return sigIndex[id]; };
  OPS.findCampaign = function (snap, platform, id) {
    if (!snap) return null;
    for (var i = 0; i < snap.campaigns.length; i++) if (snap.campaigns[i].platform === platform && snap.campaigns[i].id === String(id)) return snap.campaigns[i];
    return null;
  };
  OPS.runSignalAction = function (sigId, i) {
    var e = sigIndex[sigId]; if (!e) return;
    var s = e.s, a = s.actions[i]; if (!a) return;
    var c = s.campaign && s.platform ? OPS.findCampaign(e.snap, s.platform, s.campaign.id) : null;
    var after = function (ok) { if (ok && OPS.onExternalChange) OPS.onExternalChange(); };
    if (a.type === 'pause' && c) ACT.toggle(c, 'pause', 'Recommendation').then(after);
    else if (a.type === 'budget' && c) ACT.budget(c, c.budget * a.factor, s.title + '. ' + s.recommendation, 'Recommendation').then(after);
    else if (a.type === 'open' && c) { if (OW.go) OW.go({ page: 'campaigns', platform: c.platform, campaignName: c.name }); else OPS.go('campaigns'); }
    // New copy & angles: prefill Create's prompt; nothing is generated (or
    // charged) until the user presses Build there.
    else if (a.type === 'creative' || a.type === 'creativeFrom') { if (OPS.toCreate) OPS.toCreate(creativePrompt(s, c)); else OPS.go('create'); }
    else if (a.type === 'native') ACT.native(s.platform || 'meta');
    else if (a.type === 'setup') { if (typeof window.bizGoTo === 'function') window.bizGoTo('connections'); }
    else if (a.type === 'optimizeBudget') OPS.go(a.label === 'Open budget plan' ? 'planning' : 'autopilot');
  };
  function creativePrompt(s, c) {
    var name = (c && c.name) || (s.campaign && s.campaign.name) || '';
    return 'New ad copy and creative angles' + (name ? ' for the campaign "' + name + '"' : '') + (s.platform && CAP[s.platform] ? ' on ' + CAP[s.platform].name : '') + '. Why: ' + s.title + '. Keep what works, try fresh hooks.';
  }
  OPS.dismissSignal = function (id) {
    var o = S.get('ops'); o.dismissed[id] = Date.now() + 7 * 86400000; S.save('ops');
    var el = document.querySelector('[data-sig="' + id.replace(/"/g, '') + '"]'); if (el) el.remove();
    toast('Dismissed for 7 days. It returns if the data still matches.', 'ok');
  };
  OPS.saveSignal = function (id) {
    var o = S.get('ops'); if (o.saved[id]) delete o.saved[id]; else o.saved[id] = Date.now(); S.save('ops');
    var el = document.querySelector('[data-sig="' + id.replace(/"/g, '') + '"] .op-sig-actions .op-btn-text');
    if (el) el.textContent = o.saved[id] ? 'Saved' : 'Save';
  };

  // ── Page plumbing ──────────────────────────────────────────────────
  OPS.page = function (id, cls) {
    var el = document.getElementById(id);
    if (el) return el;
    var mc = document.querySelector('.mc'); if (!mc) return null;
    el = document.createElement('div');
    el.className = 'page ' + (cls || ''); el.id = id;
    mc.appendChild(el);
    return el;
  };
  var renderers = {};
  OPS.onEnter = function (key, fn) { renderers[key] = fn; };
  var hydrated = false;
  OPS.enter = function (key) {
    // On-screen data attached for the assistant belongs to the screen it
    // came from; a new screen starts without it.
    if (window.orvContext) window.orvContext.ops = null;
    AI.context = null;
    if (!hydrated && uid()) { hydrated = true; S.hydrate(); }
    OPS.paintBar(key);
    OPS.retitle();
    if (renderers[key]) { try { renderers[key](); } catch (e) { console.error('[ops] render failed', key, e); } }
  };
  var resetHooks = [];
  OPS.onReset = function (fn) { resetHooks.push(fn); };
  OPS.reset = function () { D.invalidate(); S.reset(); hydrated = false; resetHooks.forEach(function (fn) { try { fn(); } catch (_) {} }); };
  // Sign-out / account switch: no data or plans from the previous account
  // may survive in memory or on screen.
  (function () {
    var orig = OW.reset;
    OW.reset = function () {
      OPS.reset();
      ['bizPlanningBody', 'bicPlanStrip'].forEach(function (id) { var p = document.getElementById(id); if (p) p.innerHTML = ''; });
      if (window.orvContext) window.orvContext.ops = null;
      return typeof orig === 'function' ? orig.apply(this, arguments) : undefined;
    };
  })();

  // Hook _orvNav once it exists: keys from the area experiment land on
  // their mature page, and pages with a summary renderer (Home) render.
  OPS.aliases = {};
  Object.keys(OLD_KEYS).forEach(function (k) { OPS.aliases[k] = function () { OPS.go(OLD_KEYS[k]); return true; }; });
  function hookNav() {
    var orig = window._orvNav;
    if (typeof orig !== 'function' || orig._ops) return false;
    var wrapped = function (page) {
      var alias = OPS.aliases[page];
      if (alias) { try { if (alias.apply(this, arguments) === true) return; } catch (e) { console.error('[ops] alias', page, e); } }
      var r = orig.apply(this, arguments);
      try { OPS.enter(page); } catch (e) { console.error('[ops] enter', e); }
      try { applyEntitlements(); } catch (e) { console.error('[ops] entitlements', e); }
      return r;
    };
    wrapped._ops = true;
    window._orvNav = wrapped;
    return true;
  }
  // ════════════════════════════════════════════════════════════════
  // Sidebar workflow progress (V9) — the 01–06 path shows where you are:
  // every step before the current one is "done" (lime dot and number) and
  // every connecting segment up to the current step is lime; later steps
  // stay neutral. Purely visual: nothing is locked or gated, every page
  // stays open in any order. On a page outside the workflow (Ad Platforms,
  // Settings) no step is current and the path is neutral.
  // Driven by the nav buttons' own orv-active class (set by the app's
  // several navigation paths), so it can never disagree with the highlight.
  function wfSync() {
    document.querySelectorAll('.orv-sb-nav, .orv-mob-drawer-nav').forEach(function (root) {
      var items = root.querySelectorAll(':scope .orv-ni[data-wf]');
      if (!items.length) return;
      var cur = 0;
      items.forEach(function (b) { if (b.classList.contains('orv-active')) cur = +b.getAttribute('data-wf') || 0; });
      items.forEach(function (b) {
        var n = +b.getAttribute('data-wf') || 0;
        var done = cur > 0 && n < cur, isCur = cur > 0 && n === cur;
        if (b.classList.contains('orv-wf-done') !== done) b.classList.toggle('orv-wf-done', done);
        if (b.classList.contains('orv-wf-cur') !== isCur) b.classList.toggle('orv-wf-cur', isCur);
        // the segment below this step (n → n+1) is travelled when n+1 ≤ current
        var seg = cur > 0 && n < cur;
        if (b.classList.contains('orv-wf-seg') !== seg) b.classList.toggle('orv-wf-seg', seg);
        var desc = 'Step ' + n + ' of 6' + (done ? ', done' : (isCur ? ', current' : ''));
        if (b.getAttribute('aria-description') !== desc) b.setAttribute('aria-description', desc);
        if (isCur) { if (b.getAttribute('aria-current') !== 'page') b.setAttribute('aria-current', 'page'); }
        else if (b.getAttribute('aria-current') === 'page') b.removeAttribute('aria-current');
      });
    });
  }
  OPS.wfSync = wfSync;
  function wfWatch() {
    var mo = new MutationObserver(function () { wfSync(); });
    document.querySelectorAll('.orv-sb-nav, .orv-mob-drawer-nav').forEach(function (root) {
      mo.observe(root, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    wfSync();
  }
  // ════════════════════════════════════════════════════════════════
  // Plan entitlements (V10) — what the signed-in plan can use, from the one
  // table in plans.js (ORIVEN_PLANS[*].entitlements). The server enforces the
  // same table (server/services/planEntitlements.js); this layer only makes
  // the product show it honestly:
  //   • Research / Autopilot (Starter+): the sidebar keeps both steps with a
  //     lock on Free, and the pages show an upgrade state instead of tools.
  //   • Oriven Chat (Creator+): launcher hidden otherwise.
  //   • Notifications (Professional): bell hidden otherwise.
  // Plan state lives in _dbSubscriptionStatus (auth.js, from Supabase); while
  // it is still unknown nothing is locked and no premium surface is shown.
  // ════════════════════════════════════════════════════════════════
  var GATES = {
    research: { key: 'research', pageId: 'page-research', step: '02', title: 'Research', lead: 'Understand the market before you create.' },
    autopilot: { key: 'autopilot', pageId: 'page-autopilot', step: '06', title: 'Autopilot', lead: 'Monitor your advertising and act on supported changes with rules you set.' }
  };
  function planId() {
    var st = (typeof window._dbSubscriptionStatus !== 'undefined') ? window._dbSubscriptionStatus : null;
    if (typeof st === 'string' && st) return st;
    if (window._isGuestMode === true || (typeof _isGuestMode !== 'undefined' && _isGuestMode === true)) return 'free';
    return null;
  }
  // true / false, or null while the plan is not known yet
  window.orvEntitled = function (key) {
    var p = planId();
    if (!p) return null;
    return typeof window.orvPlanHas === 'function' ? window.orvPlanHas(p, key) : null;
  };
  window.orvOpenPlans = function () {
    if (typeof window.openSettingsModal !== 'function') return;
    window.openSettingsModal();
    var ni = document.querySelector('.smd-ni[data-smd="subscription"]');
    if (ni && typeof window.smdNav === 'function') window.smdNav(ni);
  };
  var LOCK_SVG = '<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/></svg>';
  function gateHtml(g) {
    var min = typeof window.orvMinPlanFor === 'function' ? window.orvMinPlanFor(g.key) : null;
    var name = min ? min.name : 'Starter';
    var price = min ? ('€' + min.price.toFixed(2) + ' / month · ' + (typeof window.orvFormatCredits === 'function' ? window.orvFormatCredits(min.credits) : min.credits) + ' credits / month') : '';
    return '<section class="orv-gate" aria-labelledby="orvGateT_' + g.key + '">' +
      '<div class="orv-gate-card">' +
        '<div class="orv-gate-eyebrow"><span class="orv-gate-step">' + g.step + '</span><span class="orv-gate-lock">' + LOCK_SVG + ' ' + name + '</span></div>' +
        '<h1 class="orv-gate-title" id="orvGateT_' + g.key + '">' + g.title + '</h1>' +
        '<p class="orv-gate-lead">' + g.lead + '</p>' +
        '<p class="orv-gate-text">' + g.title + ' is part of the complete OrivenAI workflow, available from ' + name + '.</p>' +
        '<div class="orv-gate-actions"><button type="button" class="orv-gate-btn" onclick="orvOpenPlans()">View plans</button>' +
        (price ? '<span class="orv-gate-price">' + name + ': ' + price + '</span>' : '') + '</div>' +
      '</div></section>';
  }
  var lastApplied = '';
  function applyEntitlements() {
    var p = planId();
    var sig = String(p);
    var has = function (k) { return p ? (typeof window.orvPlanHas === 'function' && window.orvPlanHas(p, k)) : null; };
    var body = document.body;
    if (!body) return;
    // premium surfaces: hidden unless the plan is known AND includes them
    body.classList.toggle('orv-no-chat', has('orivenChat') !== true);
    body.classList.toggle('orv-no-notif', has('notifications') !== true);
    if (has('orivenChat') !== true) {
      var panel = document.getElementById('orvAiPanel');
      if (panel && panel.classList.contains('orv-ai-open') && typeof window.orvCloseAi === 'function') window.orvCloseAi();
    }
    if (has('notifications') !== true) {
      var np = document.getElementById('orvNotifPanel'); if (np) np.style.display = 'none';
    }
    // workflow steps: locked only when the plan is known and excludes them
    Object.keys(GATES).forEach(function (k) {
      var g = GATES[k], locked = has(g.key) === false;
      document.querySelectorAll('.orv-ni[data-orv-page="' + k + '"]').forEach(function (b) {
        b.classList.toggle('orv-locked', locked);
        var mark = b.querySelector('.orv-lock');
        if (locked && !mark) { mark = document.createElement('span'); mark.className = 'orv-lock'; mark.innerHTML = LOCK_SVG; b.appendChild(mark); }
        if (!locked && mark) mark.remove();
        var base = g.title;
        if (locked) { b.setAttribute('aria-label', base + ' — available from Starter'); if (b.hasAttribute('data-tip')) b.setAttribute('data-tip', base + ' · Starter'); }
        else { b.removeAttribute('aria-label'); if (b.hasAttribute('data-tip')) b.setAttribute('data-tip', base); }
      });
      var page = document.getElementById(g.pageId);
      if (!page) return;
      var gate = page.querySelector(':scope > .orv-gate');
      if (locked && !gate) page.insertAdjacentHTML('afterbegin', gateHtml(g));
      if (!locked && gate) gate.remove();
      page.classList.toggle('orv-gated', locked);
    });
    if (sig !== lastApplied) { lastApplied = sig; body.setAttribute('data-orv-plan', p || 'unknown'); }
  }
  OPS.applyEntitlements = applyEntitlements;
  // Plan state is set in several places in auth.js; re-apply whenever it changes.
  function watchPlan() {
    var seen;
    applyEntitlements();
    setInterval(function () {
      var now = String(planId());
      if (now !== seen) { seen = now; applyEntitlements(); }
    }, 400);
  }

  OPS.boot = function () {
    hookNav();
    wfWatch();
    watchPlan();
    if (uid()) { hydrated = true; S.hydrate(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', OPS.boot);
  else OPS.boot();
})();
