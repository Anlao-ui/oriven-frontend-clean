// ═══════════════════════════════════════════════════════════════
// ORIVEN ADS DASHBOARD
// Platform-agnostic advertising performance hub.
// Currently: Google Ads. Future: Meta, TikTok, LinkedIn.
//
// Public API:
//   window.initAdsDashboard()          — called by navigate() hook
//   window.setAdsDateRange(range)      — date pill handler
//   window.openAdsCampaign(id)         — campaign row click
//   window.backToAdsCampaigns()        — back button
//   window.analyzeAds()                — AI analysis button
//   window.generateAdsRecommendations() — AI recommendations button
// ═══════════════════════════════════════════════════════════════

(function(){
  'use strict';

  var CIRCUMFERENCE = 2 * Math.PI * 50; // SVG r=50

  // ── State ───────────────────────────────────────────────────
  var _s = {
    dateRange:        'LAST_30_DAYS',
    overview:         null,
    overviewDateRange: null,
    campaigns:        null,
    account:          null,
    loading:          false,
    platform:         'google',
    currentCampInfo:  null,
    currentKeywords:  []
  };

  // ── DOM helpers ─────────────────────────────────────────────
  function $(id)       { return document.getElementById(id); }
  function show(id)    { var e=$(id); if(e) e.style.display=''; }
  function hide(id)    { var e=$(id); if(e) e.style.display='none'; }

  // ── Format helpers ──────────────────────────────────────────
  function fmtMoney(n) {
    if(!n) return '€0';
    if(n >= 100000) return '€' + (n/1000).toFixed(0) + 'k';
    if(n >= 1000)   return '€' + (n/1000).toFixed(1) + 'k';
    if(n >= 10)     return '€' + n.toFixed(0);
    return '€' + n.toFixed(2);
  }
  function fmtNum(n) {
    if(!n) return '0';
    if(n >= 1000000) return (n/1000000).toFixed(1) + 'M';
    if(n >= 1000)    return (n/1000).toFixed(1) + 'k';
    return Math.round(n).toLocaleString();
  }
  function fmtPct(n)  { return (n||0).toFixed(2) + '%'; }
  function fmtX(n)    { if(!n) return '—'; return (n||0).toFixed(2) + 'x'; }
  function fmtCPA(n)  { if(!n) return '—'; return fmtMoney(n); }
  function h(s) {
    return String(s||'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  // ── Status badge ────────────────────────────────────────────
  function statusBadge(status) {
    var cls = status === 'ENABLED'  ? 'bg-green'
            : status === 'PAUSED'   ? 'bg-warm'
            :                         'bg-grey';
    var lbl = status === 'ENABLED'  ? 'Active'
            : status === 'PAUSED'   ? 'Paused'
            : (status || 'Unknown');
    return '<span class="badge ' + cls + '">' + lbl + '</span>';
  }

  // ── Finding icon by type ────────────────────────────────────
  var _findingIcons = {
    wasted_spend:        { bg:'rgba(239,68,68,.12)',   c:'#ef4444',  p:'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' },
    low_ctr:             { bg:'rgba(245,158,11,.12)',  c:'#f59e0b',  p:'M3 17l6-6 4 4 8-10' },
    conversion_issue:    { bg:'rgba(239,68,68,.12)',   c:'#ef4444',  p:'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3' },
    scaling_opportunity: { bg:'rgba(183,255,42,.12)',  c:'#a8e032',  p:'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6' },
    keyword_opportunity: { bg:'rgba(96,165,250,.12)',  c:'#60a5fa',  p:'M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z' },
    budget:              { bg:'rgba(167,139,250,.12)', c:'#a78bfa',  p:'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
    landing_page:        { bg:'rgba(52,211,153,.12)',  c:'#34d399',  p:'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3' }
  };
  function findingIcon(type) {
    var ic = _findingIcons[type] || _findingIcons['budget'];
    return '<div class="ads-finding-ico" style="background:' + ic.bg + ';color:' + ic.c + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="' + ic.p + '"/></svg>'
      + '</div>';
  }

  // ── Platform helpers ─────────────────────────────────────────
  var _PLATFORM_META = [
    { id: 'google', label: 'Google Ads', color: '#4285F4' },
    { id: 'meta',   label: 'Meta Ads',   color: '#0866FF' },
    { id: 'tiktok', label: 'TikTok Ads', color: '#FF004F' }
  ];

  function _getActivePlatforms() {
    var active = [];
    if(window._activeAdAccount   && window._activeAdAccount.account_id)   active.push('google');
    if(window._activeMetaAccount && window._activeMetaAccount.account_id) active.push('meta');
    if(window._activeTadsAccount && window._activeTadsAccount.account_id) active.push('tiktok');
    return active;
  }

  function _renderPlatformTabs(activePlatforms) {
    var wrap = $('ads-platform-tabs');
    if(!wrap) return;
    if(activePlatforms.length <= 1) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    var container = wrap.querySelector('.ads-ptabs');
    if(!container) return;
    container.innerHTML = _PLATFORM_META
      .filter(function(p) { return activePlatforms.indexOf(p.id) !== -1; })
      .map(function(p) {
        var isActive = p.id === _s.platform;
        return '<button class="ads-ptab' + (isActive ? ' active' : '') + '" id="ptab-' + p.id + '" onclick="switchAdsPlatform(\'' + p.id + '\')">'
          + '<span class="ads-ptab-dot" style="background:' + p.color + '"></span>'
          + p.label + '</button>';
      }).join('');
  }

  function _setAccountBarWith(account) {
    var bar = $('ads-account-bar');
    if(!bar || !account) { if(bar) bar.innerHTML = ''; return; }
    bar.innerHTML = '<span class="int-status-dot" style="margin-right:6px"></span>'
      + '<span class="ads-account-name">' + h(account.account_name || account.account_id) + '</span>'
      + '<span style="color:var(--muted);margin:0 6px">·</span>'
      + '<span class="ads-account-id">ID: ' + h(account.account_id) + '</span>';
  }

  function _showPanel(platform) {
    var panels = { google: 'ads-google-panel', meta: 'ads-meta-panel', tiktok: 'ads-tiktok-panel' };
    Object.keys(panels).forEach(function(key) {
      var el = $(panels[key]);
      if(el) el.style.display = (key === platform) ? '' : 'none';
    });
  }

  // ── Entry point ─────────────────────────────────────────────
  window.initAdsDashboard = function() {
    _syncDatePills();

    var activePlatforms = _getActivePlatforms();

    if(activePlatforms.length === 0) {
      _showEmpty();
      return;
    }

    // Default to first available platform; keep current selection if still valid
    if(activePlatforms.indexOf(_s.platform) === -1) {
      _s.platform = activePlatforms[0];
    }

    hide('ads-empty');
    show('ads-dash');
    _renderPlatformTabs(activePlatforms);
    _showPanel(_s.platform);

    if(_s.platform === 'google') {
      _s.account = window._activeAdAccount;
      _updateAccountBar();
      _loadOverview();
    } else if(_s.platform === 'meta') {
      _s.account = null;
      _setAccountBarWith(window._activeMetaAccount);
      _initMetaExplorer();
    } else if(_s.platform === 'tiktok') {
      _s.account = null;
      _setAccountBarWith(window._activeTadsAccount);
    }
  };

  window.switchAdsPlatform = function(platform) {
    if(platform === _s.platform) return;
    _s.platform = platform;
    document.querySelectorAll('.ads-ptab').forEach(function(btn) {
      btn.classList.toggle('active', btn.id === 'ptab-' + platform);
    });
    _showPanel(platform);
    if(platform === 'google') {
      _s.account = window._activeAdAccount;
      _setAccountBarWith(window._activeAdAccount);
      if(!_s.overview || _s.overviewDateRange !== _s.dateRange) _loadOverview();
    } else if(platform === 'meta') {
      _s.account = null;
      _setAccountBarWith(window._activeMetaAccount);
      _initMetaExplorer();
    } else if(platform === 'tiktok') {
      _s.account = null;
      _setAccountBarWith(window._activeTadsAccount);
    }
  };

  // ── Date range ───────────────────────────────────────────────
  window.setAdsDateRange = function(range) {
    var valid = ['LAST_7_DAYS', 'LAST_14_DAYS', 'LAST_30_DAYS', 'LAST_90_DAYS'];
    if(valid.indexOf(range) === -1) return;
    if(range === _s.dateRange && _s.overview) return; // already loaded
    _s.dateRange = range;
    _syncDatePills();
    _resetAIPanels();
    if(_s.account) _loadOverview();
  };

  function _syncDatePills() {
    document.querySelectorAll('.ads-date-pill').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-range') === _s.dateRange);
    });
  }

  // ── Views ────────────────────────────────────────────────────
  function _showEmpty() {
    show('ads-empty');
    hide('ads-dash');
  }

  function _updateAccountBar() {
    _setAccountBarWith(_s.account);
  }

  // ── Load overview ────────────────────────────────────────────
  async function _loadOverview() {
    if(_s.loading) return;
    _s.loading = true;

    var errEl = $('ads-main-error');
    if(errEl) errEl.style.display = 'none';
    hide('ads-campaigns-view');
    hide('ads-campaign-view');
    show('ads-loading');

    try {
      var res = await apiFetch('/api/ads/overview?date_range=' + _s.dateRange);
      hide('ads-loading');

      if(!res.ok) {
        var msg = (res.data && res.data.error) ? res.data.error : 'Could not load account data (HTTP ' + res.status + ')';
        if(errEl) { errEl.textContent = msg; errEl.style.display = ''; }
        return;
      }

      _s.overview        = res.data.overview;
      _s.overviewDateRange = _s.dateRange;
      _s.campaigns       = res.data.campaigns;
      if(res.data.account) _s.account = Object.assign({}, _s.account, res.data.account);

      _renderKPIs(_s.overview);
      _renderCampaignsTable(_s.campaigns);
      _renderOrivenScore(_s.overview, _s.campaigns);
      show('ads-campaigns-view');

    } catch(err) {
      hide('ads-loading');
      if(errEl) { errEl.textContent = err.message || 'Network error — try again'; errEl.style.display = ''; }
    } finally {
      _s.loading = false;
    }
  }

  // ── KPI cards ────────────────────────────────────────────────
  function _renderKPIs(ov) {
    var el = $('ads-kpis');
    if(!el) return;
    var kpis = [
      { lbl:'Spend',       val:fmtMoney(ov.spend),             accent:false },
      { lbl:'Impressions', val:fmtNum(ov.impressions),         accent:false },
      { lbl:'Clicks',      val:fmtNum(ov.clicks),              accent:false },
      { lbl:'CTR',         val:fmtPct(ov.ctr),                 accent:false },
      { lbl:'Conversions', val:fmtNum(ov.conversions),         accent:true  },
      { lbl:'CPA',         val:fmtCPA(ov.cpa),                 accent:false },
      { lbl:'ROAS',        val:fmtX(ov.roas),                  accent:ov.roas >= 3 }
    ];
    el.innerHTML = kpis.map(function(k) {
      return '<div class="ads-kpi' + (k.accent ? ' ads-kpi-accent' : '') + '">'
        + '<div class="ads-kpi-val">' + k.val + '</div>'
        + '<div class="ads-kpi-lbl">' + k.lbl + '</div>'
        + '</div>';
    }).join('');
  }

  // ── Campaigns table ──────────────────────────────────────────
  function _renderCampaignsTable(campaigns) {
    var tbody = $('ads-campaigns-tbody');
    var empty = $('ads-campaigns-empty');
    if(!tbody) return;

    if(!campaigns || campaigns.length === 0) {
      tbody.innerHTML = '';
      if(empty) empty.style.display = '';
      return;
    }
    if(empty) empty.style.display = 'none';

    tbody.innerHTML = campaigns.map(function(c) {
      return '<tr onclick="openAdsCampaign(\'' + h(String(c.id)) + '\')">'
        + '<td class="ads-name" title="' + h(c.name) + '">' + h(c.name) + '</td>'
        + '<td>' + statusBadge(c.status) + '</td>'
        + '<td class="ads-num">' + fmtMoney(c.spend) + '</td>'
        + '<td class="ads-num">' + fmtNum(c.impressions) + '</td>'
        + '<td class="ads-num">' + fmtNum(c.clicks) + '</td>'
        + '<td class="ads-num">' + fmtPct(c.ctr) + '</td>'
        + '<td class="ads-num">' + fmtNum(c.conversions) + '</td>'
        + '<td class="ads-num">' + fmtCPA(c.cpa) + '</td>'
        + '<td class="ads-num">' + fmtX(c.roas) + '</td>'
        + '</tr>';
    }).join('');
  }

  // ── Oriven Score ─────────────────────────────────────────────
  function _renderOrivenScore(ov, camps) {
    if(!ov) return;

    var ctrBench  = 3.0;
    var ctrScore  = Math.min(100, (ov.ctr / ctrBench) * 80 + (ov.ctr > 0 ? 20 : 0));

    var convRate  = ov.clicks > 0 ? (ov.conversions / ov.clicks) * 100 : 0;
    var convScore = Math.min(100, (convRate / 3) * 80 + (convRate > 0 ? 20 : 0));

    var roasScore = ov.roas > 0 ? Math.min(100, (ov.roas / 4) * 80 + 20) : 0;

    var wastedSpend = 0;
    if(camps) {
      camps.forEach(function(c) {
        if(c.clicks > 30 && c.conversions === 0) wastedSpend += c.spend;
      });
    }
    var wastedRatio = ov.spend > 0 ? wastedSpend / ov.spend : 0;
    var spendScore  = Math.max(0, 100 - wastedRatio * 140);

    var score = Math.max(0, Math.min(100, Math.round(
      ctrScore  * 0.25 +
      convScore * 0.35 +
      roasScore * 0.25 +
      spendScore * 0.15
    )));

    var arc = $('ads-score-arc');
    var num = $('ads-score-num');
    if(arc) {
      arc.style.strokeDasharray  = CIRCUMFERENCE;
      arc.style.strokeDashoffset = CIRCUMFERENCE * (1 - score / 100);
      arc.style.stroke = score >= 70 ? '#B7FF2A' : score >= 45 ? '#f59e0b' : '#ef4444';
    }
    if(num) num.textContent = score;

    var brk = $('ads-score-breakdown');
    if(brk) {
      var metrics = [
        { lbl:'CTR Quality',     val:Math.round(ctrScore)   },
        { lbl:'Conversions',     val:Math.round(convScore)  },
        { lbl:'ROAS',            val:Math.round(roasScore)  },
        { lbl:'Spend Efficiency',val:Math.round(spendScore) }
      ];
      brk.innerHTML = metrics.map(function(m) {
        var c = m.val >= 70 ? '#B7FF2A' : m.val >= 45 ? '#f59e0b' : '#ef4444';
        return '<div style="margin-bottom:9px">'
          + '<div style="display:flex;justify-content:space-between;margin-bottom:3px">'
          + '<span style="font-size:11px;color:var(--muted)">' + m.lbl + '</span>'
          + '<span style="font-size:11px;font-weight:700;color:var(--charcoal)">' + m.val + '</span>'
          + '</div>'
          + '<div style="height:4px;background:var(--border);border-radius:4px;overflow:hidden">'
          + '<div style="height:100%;width:' + m.val + '%;background:' + c + ';border-radius:4px;transition:width .6s ease"></div>'
          + '</div></div>';
      }).join('');
    }

    var card = $('ads-score-card');
    if(card) card.style.display = '';
  }

  // ── Campaign detail ──────────────────────────────────────────
  window.openAdsCampaign = function(campaignId) {
    if(!campaignId || !_s.campaigns) return;
    var camp = null;
    for(var i = 0; i < _s.campaigns.length; i++) {
      if(String(_s.campaigns[i].id) === String(campaignId)) { camp = _s.campaigns[i]; break; }
    }
    if(!camp) return;

    // Reset inspector state for the new campaign
    _s.currentCampInfo = null;
    _s.currentKeywords = [];
    closeAdInspector(true); // close without animation reset of rows

    hide('ads-campaigns-view');
    show('ads-campaign-view');

    var detail = $('ads-campaign-detail');
    if(!detail) return;
    detail.innerHTML = _buildCampaignShell(camp);
    _loadCampaignDetail(campaignId);
  };

  window.backToAdsCampaigns = function() {
    closeAdInspector(true);
    hide('ads-campaign-view');
    show('ads-campaigns-view');
  };

  function _buildCampaignShell(camp) {
    var kpis = [
      { lbl:'Spend',       val:fmtMoney(camp.spend) },
      { lbl:'Impressions', val:fmtNum(camp.impressions) },
      { lbl:'Clicks',      val:fmtNum(camp.clicks) },
      { lbl:'CTR',         val:fmtPct(camp.ctr) },
      { lbl:'Conversions', val:fmtNum(camp.conversions) },
      { lbl:'CPA',         val:fmtCPA(camp.cpa) },
      { lbl:'ROAS',        val:fmtX(camp.roas) }
    ];
    return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">'
      + '<h2 class="ads-detail-title" style="margin:0">' + h(camp.name) + '</h2>'
      + statusBadge(camp.status)
      + '</div>'
      + '<div class="ads-kpis" style="margin-bottom:28px">'
      + kpis.map(function(k) {
          return '<div class="ads-kpi"><div class="ads-kpi-val">' + k.val + '</div><div class="ads-kpi-lbl">' + k.lbl + '</div></div>';
        }).join('')
      + '</div>'
      + '<div id="ads-detail-camp-info"></div>'
      + '<div id="ads-detail-ads-wrap"><div class="ads-loading-wrap"><div class="ads-spinner"></div>Loading ads…</div></div>'
      + '<div id="ads-detail-kw-wrap" style="margin-top:20px"></div>'
      + '<div id="ads-detail-st-wrap" style="margin-top:20px"></div>';
  }

  async function _loadCampaignDetail(campaignId) {
    try {
      var res = await apiFetch('/api/ads/campaign/' + campaignId + '?date_range=' + _s.dateRange);
      if(!res.ok) {
        var err = (res.data && res.data.error) || ('HTTP ' + res.status);
        var w = $('ads-detail-ads-wrap');
        if(w) w.innerHTML = '<p style="color:#ef4444;font-size:13px">' + h(err) + '</p>';
        return;
      }
      var d = res.data;

      // Cache for the inspector drawer
      _s.currentCampInfo = d.campaign_info || null;
      _s.currentKeywords = d.keywords || [];

      _renderCampaignInfoBar(d.campaign_info);
      _renderDetailAds(d.ads || []);
      _renderDetailKeywords(d.keywords || []);
      _renderDetailSearchTerms(d.search_terms || []);
    } catch(err) {
      var w = $('ads-detail-ads-wrap');
      if(w) w.innerHTML = '<p style="color:#ef4444;font-size:13px">' + h(err.message || 'Network error') + '</p>';
    }
  }

  function _renderCampaignInfoBar(info) {
    var el = $('ads-detail-camp-info');
    if(!el || !info) return;
    var chips = [];
    if(info.type)    chips.push(h(info.type.replace('_',' ')));
    if(info.bidding) chips.push(h(info.bidding.replace(/_/g,' ')));
    if(info.budget && info.budget.daily_euros > 0) {
      chips.push(fmtMoney(info.budget.daily_euros) + '/day');
    }
    if(!chips.length) { el.style.display = 'none'; return; }
    el.innerHTML = '<div class="ads-camp-info-bar">'
      + chips.map(function(c){ return '<span class="ads-camp-chip">' + c + '</span>'; }).join('')
      + '</div>';
  }

  // Index of ad data by id — populated when ads are rendered
  var _adIndex = {};

  function _renderDetailAds(ads) {
    var el = $('ads-detail-ads-wrap');
    if(!el) return;

    if(!ads || ads.length === 0) {
      el.innerHTML = '<div class="ads-section-hd"><div class="ads-section-title">Ads</div></div>'
        + '<p style="font-size:13px;color:var(--muted)">No ads found for this date range.</p>';
      return;
    }

    _adIndex = {};
    ads.forEach(function(a){ if(a.id) _adIndex[String(a.id)] = a; });

    el.innerHTML = '<div class="ads-section-hd">'
      + '<div class="ads-section-title">Ads (' + ads.length + ')</div>'
      + '<div style="font-size:11px;color:var(--muted)">Click a row to inspect</div>'
      + '</div>'
      + '<div class="ads-table-wrap">'
      + '<table class="ads-table">'
      + '<thead><tr>'
      + '<th>Headline</th><th>Ad Group</th><th>Type</th><th>Status</th>'
      + '<th class="ads-num">Impr.</th><th class="ads-num">Clicks</th>'
      + '<th class="ads-num">CTR</th><th class="ads-num">Conv.</th>'
      + '</tr></thead><tbody>'
      + ads.map(function(a) {
          var typeLabel = _adTypeLabel(a.type);
          return '<tr class="ads-ad-row" id="ads-ad-row-' + h(a.id) + '" onclick="window._openInspector(\'' + h(a.id) + '\')">'
            + '<td class="ads-name" style="max-width:220px" title="' + h(a.headline) + '">' + h(a.headline || '—') + '</td>'
            + '<td style="font-size:12px;color:var(--muted)">' + h(a.ad_group) + '</td>'
            + '<td><span class="ads-camp-chip" style="font-size:10px">' + typeLabel + '</span></td>'
            + '<td>' + statusBadge(a.status) + '</td>'
            + '<td class="ads-num">' + fmtNum(a.impressions) + '</td>'
            + '<td class="ads-num">' + fmtNum(a.clicks) + '</td>'
            + '<td class="ads-num">' + fmtPct(a.ctr) + '</td>'
            + '<td class="ads-num">' + fmtNum(a.conversions) + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  function _adTypeLabel(type) {
    var map = {
      'RESPONSIVE_SEARCH_AD':      'RSA',
      'EXPANDED_TEXT_AD':          'ETA',
      'RESPONSIVE_DISPLAY_AD':     'Display',
      'IMAGE_AD':                  'Image',
      'VIDEO_AD':                  'Video',
      'CALL_ONLY_AD':              'Call',
      'SHOPPING_PRODUCT_AD':       'Shopping',
      'PERFORMANCE_MAX_AD':        'PMax',
      'DEMAND_GEN_MULTI_ASSET_AD': 'DemandGen'
    };
    return map[type] || (type ? type.replace(/_AD$/, '').replace(/_/g,' ') : '?');
  }

  // ── Ad Inspector Drawer ──────────────────────────────────────

  // Open inspector for a given ad ID (called by row click)
  window._openInspector = function(adId) {
    var ad = _adIndex[String(adId)];
    if(!ad) return;

    // Highlight selected row
    document.querySelectorAll('.ads-ad-row').forEach(function(r){ r.classList.remove('ads-ad-row-active'); });
    var row = $('ads-ad-row-' + adId);
    if(row) row.classList.add('ads-ad-row-active');

    var overlay   = $('ads-inspector-overlay');
    var inspector = $('ads-inspector');
    var meta      = $('ads-insp-meta');
    var body      = $('ads-insp-body');
    if(!inspector || !body) return;

    // Header meta row: type badge + status + ad group
    if(meta) {
      meta.innerHTML = '<span class="ads-ad-type-badge">' + _adTypeLabel(ad.type) + '</span>'
        + statusBadge(ad.status)
        + (ad.ad_group ? '<span style="font-size:11px;color:var(--muted)">' + h(ad.ad_group) + '</span>' : '');
    }

    body.innerHTML = _buildInspectorHTML(ad);

    if(overlay)   overlay.classList.add('open');
    inspector.classList.add('open');

    // Scroll the inspector body to the top
    body.scrollTop = 0;

    // Close on Escape
    document._adsInspEsc = function(e) {
      if(e.key === 'Escape') closeAdInspector();
    };
    document.addEventListener('keydown', document._adsInspEsc);
  };

  // Keep old name as alias
  window._previewAd = window._openInspector;

  function closeAdInspector(silent) {
    var overlay   = $('ads-inspector-overlay');
    var inspector = $('ads-inspector');
    if(overlay)   overlay.classList.remove('open');
    if(inspector) inspector.classList.remove('open');
    if(!silent) {
      document.querySelectorAll('.ads-ad-row').forEach(function(r){ r.classList.remove('ads-ad-row-active'); });
    }
    if(document._adsInspEsc) {
      document.removeEventListener('keydown', document._adsInspEsc);
      delete document._adsInspEsc;
    }
  }

  window.closeAdInspector  = closeAdInspector;
  window.closeAdPreview    = closeAdInspector; // backward compat

  // ── Inspector content builder ────────────────────────────────

  function _trimDomain(url) {
    try {
      var u = new URL(url);
      return { domain: u.hostname.replace(/^www\./, ''), path: u.pathname === '/' ? '' : u.pathname };
    } catch(_) { return { domain: url, path: '' }; }
  }

  function _adInsight(ad) {
    if(ad.impressions > 1000 && ad.ctr < 1) return '⚠ Low CTR (' + fmtPct(ad.ctr) + ') with ' + fmtNum(ad.impressions) + ' impressions — consider testing new headlines.';
    if(ad.impressions > 500 && ad.ctr > 5)  return '✓ Strong CTR (' + fmtPct(ad.ctr) + ') — this ad is performing well.';
    if(ad.clicks > 50 && ad.conversions === 0) return '⚠ ' + fmtNum(ad.clicks) + ' clicks with 0 conversions — check the landing page experience.';
    if(ad.conversions > 5 && ad.ctr > 3)    return '✓ Winning ad — strong CTR and conversion performance.';
    return '';
  }

  function _buildInspectorHTML(ad) {
    var html       = '';
    var campInfo   = _s.currentCampInfo || {};
    var allKw      = _s.currentKeywords || [];
    var headlines  = ad.headlines_all    || (ad.headline ? [ad.headline] : []);
    var descs      = ad.descriptions_all || [];
    var final_url  = ad.final_url        || '';
    var disp_url   = ad.display_url      || '';
    var isRSA      = ad.type === 'RESPONSIVE_SEARCH_AD';
    var isDisplay  = ad.type === 'RESPONSIVE_DISPLAY_AD' || ad.type === 'IMAGE_AD';
    var hasText    = headlines.length > 0;

    // Keywords for this ad's ad group
    var adGroupKw = allKw.filter(function(k){ return k.ad_group === ad.ad_group; });

    // ── SECTION 1: Ad Preview ──────────────────────────────────
    html += '<div class="ads-insp-sec">';
    html += '<div class="ads-insp-sec-label">Ad Preview</div>';

    if(hasText) {
      var h1 = headlines[0] || '';
      var h2 = headlines[1] || '';
      var h3 = headlines[2] || '';
      var previewHead = [h1, h2, h3].filter(Boolean).join(' | ');
      var previewDesc  = descs[0] || '';
      var previewDesc2 = descs[1] || '';

      // Parse domain/path for the simulation
      var parsed = _trimDomain(final_url || disp_url || '');
      var simDomain = disp_url || parsed.domain;
      var simPath   = parsed.path;

      html += '<div class="ads-gsim">';
      html += '<div class="ads-gsim-sponsored"><div class="ads-gsim-sponsored-dot"></div>Sponsored</div>';
      html += '<div class="ads-gsim-url">' + h(simDomain) + '</div>';
      if(simPath) html += '<div class="ads-gsim-breadcrumb">' + h(parsed.domain + simPath) + '</div>';
      html += '<div class="ads-gsim-headline">' + h(previewHead) + '</div>';
      if(previewDesc || previewDesc2) {
        html += '<div class="ads-gsim-desc">' + h(previewDesc) + (previewDesc2 ? ' ' + h(previewDesc2) : '') + '</div>';
      }
      html += '</div>'; // .ads-gsim

      // All headlines
      if(headlines.length > 0) {
        html += '<div class="ads-insp-asset-hd">Headlines (' + headlines.length + ')';
        if(isRSA) html += '<span class="ads-insp-asset-note"> — up to 3 shown per impression</span>';
        html += '</div>';
        html += '<div class="ads-insp-asset-list">';
        html += headlines.map(function(hl, i) {
          return '<div class="ads-insp-asset-row"><span class="ads-insp-asset-num">' + (i+1) + '</span>' + h(hl) + '</div>';
        }).join('');
        html += '</div>';
      }

      // All descriptions
      if(descs.length > 0) {
        html += '<div class="ads-insp-asset-hd">Descriptions (' + descs.length + ')';
        if(isRSA) html += '<span class="ads-insp-asset-note"> — up to 2 shown per impression</span>';
        html += '</div>';
        html += '<div class="ads-insp-asset-list">';
        html += descs.map(function(d, i) {
          return '<div class="ads-insp-asset-row"><span class="ads-insp-asset-num">' + (i+1) + '</span>' + h(d) + '</div>';
        }).join('');
        html += '</div>';
      }

      // Final URL
      if(final_url) {
        html += '<div class="ads-insp-url-chip">'
          + '<span class="ads-insp-url-label">Final URL</span>'
          + '<a href="' + h(final_url) + '" target="_blank" rel="noopener" class="ads-insp-url-val">' + h(final_url) + '</a>'
          + '</div>';
      }

    } else if(isDisplay) {
      html += '<div style="font-size:13px;color:var(--muted);font-style:italic">Display Ad — visual preview unavailable in Oriven.</div>';
      if(ad.business_name) html += '<div style="margin-top:10px;font-size:13px"><span style="color:var(--muted)">Business:</span> <strong>' + h(ad.business_name) + '</strong></div>';
      if(ad.long_headline) html += '<div style="margin-top:6px;font-size:13px"><span style="color:var(--muted)">Long Headline:</span> ' + h(ad.long_headline) + '</div>';
      if(ad.marketing_images && ad.marketing_images.length > 0) {
        html += '<div style="margin-top:8px;font-size:12px;color:var(--muted)">' + ad.marketing_images.length + ' image asset(s) attached — open Google Ads to preview visual creatives.</div>';
      }
    } else {
      html += '<div style="font-size:13px;color:var(--muted);font-style:italic">No preview available for this ad type.</div>';
    }

    html += '</div>'; // Section 1

    // ── SECTION 2: Ad Information ──────────────────────────────
    html += '<div class="ads-insp-sec">';
    html += '<div class="ads-insp-sec-label">Ad Information</div>';
    html += '<div class="ads-insp-info-grid">';

    var infoRows = [
      { lbl:'Campaign',      val: h(campInfo.name   || '—') },
      { lbl:'Campaign Type', val: h((campInfo.type   || '—').replace(/_/g,' ')) },
      { lbl:'Ad Group',      val: h(ad.ad_group      || '—') },
      { lbl:'Ad Type',       val: h(_adTypeLabel(ad.type)) },
      { lbl:'Status',        val: statusBadge(ad.status) }
    ];
    if(campInfo.bidding) {
      infoRows.push({ lbl:'Bidding', val: h(campInfo.bidding.replace(/_/g,' ')) });
    }
    if(campInfo.budget && campInfo.budget.daily_euros > 0) {
      infoRows.push({ lbl:'Daily Budget', val: h(fmtMoney(campInfo.budget.daily_euros)) });
    }

    html += infoRows.map(function(r) {
      return '<div class="ads-insp-info-cell">'
        + '<div class="ads-insp-info-lbl">' + r.lbl + '</div>'
        + '<div class="ads-insp-info-val">' + r.val + '</div>'
        + '</div>';
    }).join('');

    html += '</div>'; // info grid
    html += '</div>'; // Section 2

    // ── SECTION 3: Performance ─────────────────────────────────
    var clicks      = ad.clicks      || 0;
    var impressions = ad.impressions || 0;
    var spend       = ad.spend       || 0;
    var conversions = ad.conversions || 0;
    var ctr         = ad.ctr         || 0;
    var cpc         = clicks > 0      ? spend / clicks       : 0;
    var cpa         = conversions > 0  ? spend / conversions : 0;

    html += '<div class="ads-insp-sec">';
    html += '<div class="ads-insp-sec-label">Performance — ' + (_s.dateRange || 'LAST_30_DAYS').replace(/_/g,' ').toLowerCase() + '</div>';
    html += '<div class="ads-insp-perf-grid">';
    html += [
      { lbl:'Clicks',      val:fmtNum(clicks),      accent:false },
      { lbl:'Impressions', val:fmtNum(impressions),  accent:false },
      { lbl:'CTR',         val:fmtPct(ctr),          accent:false },
      { lbl:'CPC',         val:fmtMoney(cpc),        accent:false },
      { lbl:'Spend',       val:fmtMoney(spend),       accent:false },
      { lbl:'Conversions', val:fmtNum(conversions),  accent:true  },
      { lbl:'Cost / Conv', val:fmtCPA(cpa),          accent:false }
    ].map(function(k) {
      return '<div class="ads-insp-stat' + (k.accent ? ' accent' : '') + '">'
        + '<div class="ads-insp-stat-val">' + k.val + '</div>'
        + '<div class="ads-insp-stat-lbl">' + k.lbl + '</div>'
        + '</div>';
    }).join('');
    html += '</div>'; // perf grid

    var insight = _adInsight(ad);
    if(insight) html += '<div class="ads-insp-insight">' + h(insight) + '</div>';

    html += '</div>'; // Section 3

    // ── SECTION 4: Keywords ────────────────────────────────────
    html += '<div class="ads-insp-sec">';

    if(adGroupKw.length > 0) {
      html += '<div class="ads-insp-sec-label">Keywords (' + adGroupKw.length + ') — ' + h(ad.ad_group || '') + '</div>';
      html += '<div class="ads-insp-kw-wrap">';
      html += '<table class="ads-insp-kw-table">';
      html += '<thead><tr>'
        + '<th>Keyword</th><th>Match</th><th>Status</th>'
        + '<th class="r">Clicks</th><th class="r">CTR</th>'
        + '</tr></thead><tbody>';
      html += adGroupKw.map(function(k) {
        var mt  = k.match_type || '';
        var cls = mt === 'BROAD' ? 'ads-rec-broad' : mt === 'PHRASE' ? 'ads-rec-phrase' : 'ads-rec-exact';
        var lbl = mt === 'BROAD' ? 'Broad' : mt === 'PHRASE' ? 'Phrase' : 'Exact';
        return '<tr>'
          + '<td class="ads-insp-kw-name" title="' + h(k.text) + '">' + h(k.text) + '</td>'
          + '<td><span class="ads-rec-badge ' + cls + '">' + lbl + '</span></td>'
          + '<td>' + statusBadge(k.status) + '</td>'
          + '<td class="r">' + fmtNum(k.clicks) + '</td>'
          + '<td class="r">' + fmtPct(k.ctr) + '</td>'
          + '</tr>';
      }).join('');
      html += '</tbody></table>';
      html += '</div>'; // kw-wrap
    } else {
      html += '<div class="ads-insp-sec-label">Keywords</div>';
      html += '<div style="font-size:13px;color:var(--muted);font-style:italic">'
        + (ad.ad_group
            ? 'No keywords in "' + h(ad.ad_group) + '" for this date range.'
            : 'No ad group data available.')
        + '</div>';
    }

    html += '</div>'; // Section 4

    return html;
  }

  function _renderDetailKeywords(keywords) {
    var el = $('ads-detail-kw-wrap');
    if(!el || !keywords || keywords.length === 0) return;

    el.innerHTML = '<div class="ads-section-hd" style="margin-top:4px"><div class="ads-section-title">Keywords (' + keywords.length + ')</div></div>'
      + '<div class="ads-table-wrap">'
      + '<table class="ads-table">'
      + '<thead><tr>'
      + '<th>Keyword</th><th>Match</th><th>Ad Group</th><th>Status</th>'
      + '<th class="ads-num">Spend</th><th class="ads-num">Clicks</th>'
      + '<th class="ads-num">CTR</th><th class="ads-num">Conv.</th>'
      + '</tr></thead><tbody>'
      + keywords.map(function(k) {
          var mt  = k.match_type || '';
          var cls = mt === 'BROAD' ? 'ads-rec-broad' : mt === 'PHRASE' ? 'ads-rec-phrase' : 'ads-rec-exact';
          var lbl = mt === 'BROAD' ? 'Broad' : mt === 'PHRASE' ? 'Phrase' : 'Exact';
          return '<tr>'
            + '<td class="ads-name">' + h(k.text) + '</td>'
            + '<td><span class="ads-rec-badge ' + cls + '">' + lbl + '</span></td>'
            + '<td style="font-size:12px;color:var(--muted)">' + h(k.ad_group || '—') + '</td>'
            + '<td>' + statusBadge(k.status) + '</td>'
            + '<td class="ads-num">' + fmtMoney(k.spend) + '</td>'
            + '<td class="ads-num">' + fmtNum(k.clicks) + '</td>'
            + '<td class="ads-num">' + fmtPct(k.ctr) + '</td>'
            + '<td class="ads-num">' + fmtNum(k.conversions) + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  function _renderDetailSearchTerms(searchTerms) {
    var el = $('ads-detail-st-wrap');
    if(!el || !searchTerms || searchTerms.length === 0) return;

    var wasted = searchTerms.filter(function(s){ return s.spend > 0.1 && s.conversions === 0; });
    el.innerHTML = '<div class="ads-section-hd" style="margin-top:4px">'
      + '<div class="ads-section-title">Search Terms (' + searchTerms.length + ')'
      + (wasted.length > 0 ? ' <span style="font-size:11px;color:#f59e0b;font-weight:500;margin-left:6px">⚠ ' + wasted.length + ' with spend, 0 conv</span>' : '')
      + '</div></div>'
      + '<div class="ads-table-wrap"><table class="ads-table"><thead><tr>'
      + '<th>Search Term</th><th>Ad Group</th><th>Status</th>'
      + '<th class="ads-num">Spend</th><th class="ads-num">Clicks</th>'
      + '<th class="ads-num">CTR</th><th class="ads-num">Conv.</th>'
      + '</tr></thead><tbody>'
      + searchTerms.map(function(s) {
          var isWasted = s.spend > 0.1 && s.conversions === 0;
          return '<tr' + (isWasted ? ' style="background:rgba(245,158,11,.04)"' : '') + '>'
            + '<td class="ads-name" style="max-width:240px" title="' + h(s.term) + '">'
            + (isWasted ? '<span title="Spend with no conversions" style="color:#f59e0b;margin-right:4px">⚠</span>' : '')
            + h(s.term) + '</td>'
            + '<td style="font-size:12px;color:var(--muted)">' + h(s.ad_group || '—') + '</td>'
            + '<td><span class="badge ' + (s.status === 'ADDED' ? 'bg-green' : s.status === 'EXCLUDED' ? 'bg-warm' : 'bg-grey') + '">'
            + (s.status === 'ADDED' ? 'Added' : s.status === 'EXCLUDED' ? 'Excluded' : (s.status || 'Unknown')) + '</span></td>'
            + '<td class="ads-num">' + fmtMoney(s.spend) + '</td>'
            + '<td class="ads-num">' + fmtNum(s.clicks) + '</td>'
            + '<td class="ads-num">' + fmtPct(s.ctr) + '</td>'
            + '<td class="ads-num">' + fmtNum(s.conversions) + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  // ── AI Analysis ──────────────────────────────────────────────
  window.analyzeAds = async function() {
    var btn    = $('ads-analyze-btn');
    var result = $('ads-analysis-result');
    var errEl  = $('ads-analysis-error');

    if(btn)   { btn.disabled = true; btn.textContent = 'Analyzing…'; }
    if(errEl)   errEl.style.display = 'none';
    if(result)  result.style.display = 'none';

    try {
      var res = await apiFetch('/api/ads/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ date_range: _s.dateRange })
      });

      if(!res.ok) throw new Error((res.data && res.data.error) || 'Analysis failed (HTTP ' + res.status + ')');

      var data = res.data;

      if(typeof data.score === 'number') {
        var s   = Math.max(0, Math.min(100, data.score));
        var arc = $('ads-score-arc');
        var num = $('ads-score-num');
        if(arc) {
          arc.style.strokeDasharray  = CIRCUMFERENCE;
          arc.style.strokeDashoffset = CIRCUMFERENCE * (1 - s / 100);
          arc.style.stroke = s >= 70 ? '#B7FF2A' : s >= 45 ? '#f59e0b' : '#ef4444';
        }
        if(num) num.textContent = s;
      }

      var card = $('ads-score-card');
      if(card && (data.strengths || data.weaknesses || data.opportunities)) {
        var oldSw = card.querySelector('[data-sw]');
        if(oldSw) oldSw.remove();
        var sw = document.createElement('div');
        sw.setAttribute('data-sw', '1');
        sw.style.marginTop = '14px';
        var swHtml = '';
        if(data.strengths && data.strengths.length) {
          swHtml += '<div style="margin-bottom:8px">'
            + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gm);margin-bottom:4px">Strengths</div>'
            + data.strengths.map(function(t){ return '<div style="font-size:12px;color:var(--muted);padding:2px 0">✓ ' + h(t) + '</div>'; }).join('')
            + '</div>';
        }
        if(data.weaknesses && data.weaknesses.length) {
          swHtml += '<div style="margin-bottom:8px">'
            + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#ef4444;margin-bottom:4px">Weaknesses</div>'
            + data.weaknesses.map(function(t){ return '<div style="font-size:12px;color:var(--muted);padding:2px 0">✗ ' + h(t) + '</div>'; }).join('')
            + '</div>';
        }
        if(data.opportunities && data.opportunities.length) {
          swHtml += '<div>'
            + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#60a5fa;margin-bottom:4px">Opportunities</div>'
            + data.opportunities.map(function(t){ return '<div style="font-size:12px;color:var(--muted);padding:2px 0">→ ' + h(t) + '</div>'; }).join('')
            + '</div>';
        }
        sw.innerHTML = swHtml;
        var scoreWrap = card.querySelector('.ads-score-wrap');
        if(scoreWrap) scoreWrap.appendChild(sw);
      }

      var findings = data.findings || [];
      var html = '';

      if(findings.length) {
        html += '<div class="ads-findings">'
          + findings.map(function(f) {
              var sevColor = f.severity === 'high' ? '#ef4444' : f.severity === 'medium' ? '#f59e0b' : '#60a5fa';
              return '<div class="ads-finding">'
                + '<div class="ads-finding-hd">'
                + findingIcon(f.type)
                + '<div>'
                + '<div class="ads-finding-title">' + h(f.title) + '</div>'
                + '<div class="ads-finding-sev" style="color:' + sevColor + '">' + h((f.severity || 'info').toUpperCase()) + '</div>'
                + '</div></div>'
                + '<div class="ads-finding-detail">' + h(f.detail) + '</div>'
                + (f.action ? '<div class="ads-finding-action">→ ' + h(f.action) + '</div>' : '')
                + '</div>';
            }).join('')
          + '</div>';
      }

      var recs = data.recommendations || [];
      if(recs.length) {
        var recTypeIcon = { budget:'💰', keyword:'🔑', negative:'🚫', bid:'📈', copy:'✏️', structure:'🏗' };
        var recPriColor = { high:'#ef4444', medium:'#f59e0b', low:'#60a5fa' };
        html += '<div class="ads-section-hd" style="margin-top:20px"><div class="ads-section-title">Recommendations</div></div>'
          + '<div class="ads-findings">'
          + recs.map(function(r) {
              var ico   = recTypeIcon[r.type] || '→';
              var color = recPriColor[r.priority] || '#60a5fa';
              return '<div class="ads-finding">'
                + '<div class="ads-finding-hd">'
                + '<div class="ads-finding-ico" style="background:rgba(96,165,250,.1);font-size:14px;display:flex;align-items:center;justify-content:center">' + ico + '</div>'
                + '<div>'
                + '<div class="ads-finding-title">' + h(r.title || r.type) + '</div>'
                + '<div class="ads-finding-sev" style="color:' + color + '">' + h((r.priority || 'medium').toUpperCase()) + ' · ' + h(r.campaign || '') + '</div>'
                + '</div></div>'
                + '<div class="ads-finding-detail">' + h(r.detail) + '</div>'
                + '</div>';
            }).join('')
          + '</div>';
      }

      if(result) {
        if(html) { result.innerHTML = html; result.style.display = ''; }
      }

    } catch(err) {
      if(errEl) { errEl.textContent = err.message || 'Analysis failed — try again'; errEl.style.display = ''; }
    } finally {
      if(btn) { btn.disabled = false; btn.textContent = 'Re-analyze'; }
    }
  };

  // ── AI Recommendations ───────────────────────────────────────
  window.generateAdsRecommendations = async function() {
    var btn    = $('ads-recommend-btn');
    var result = $('ads-recommend-result');
    var errEl  = $('ads-recommend-error');

    if(btn)   { btn.disabled = true; btn.textContent = 'Generating…'; }
    if(errEl)   errEl.style.display = 'none';
    if(result)  result.style.display = 'none';

    try {
      var res = await apiFetch('/api/ads/recommend', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ date_range: _s.dateRange })
      });

      if(!res.ok) throw new Error((res.data && res.data.error) || 'Recommendations failed (HTTP ' + res.status + ')');

      var data = res.data;

      if(result) {
        var html = '<div class="ads-recs-grid">';

        if(data.headlines && data.headlines.length) {
          html += '<div class="ads-rec-section">'
            + '<div class="ads-rec-title">Headlines (' + data.headlines.length + ')</div>'
            + '<ul class="ads-rec-list">'
            + data.headlines.map(function(t){ return '<li class="ads-rec-item">' + h(t) + '</li>'; }).join('')
            + '</ul></div>';
        }

        if(data.descriptions && data.descriptions.length) {
          html += '<div class="ads-rec-section">'
            + '<div class="ads-rec-title">Descriptions (' + data.descriptions.length + ')</div>'
            + '<ul class="ads-rec-list">'
            + data.descriptions.map(function(t){ return '<li class="ads-rec-item">' + h(t) + '</li>'; }).join('')
            + '</ul></div>';
        }

        if(data.keywords && data.keywords.length) {
          html += '<div class="ads-rec-section">'
            + '<div class="ads-rec-title">Keywords to Add (' + data.keywords.length + ')</div>'
            + '<ul class="ads-rec-list">'
            + data.keywords.map(function(k) {
                var mt  = (k.match_type || 'BROAD').toUpperCase();
                var cls = mt === 'BROAD' ? 'ads-rec-broad' : mt === 'PHRASE' ? 'ads-rec-phrase' : 'ads-rec-exact';
                return '<li class="ads-rec-item">'
                  + '<span class="ads-rec-badge ' + cls + '">' + mt + '</span>'
                  + h(k.keyword)
                  + (k.rationale ? '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + h(k.rationale) + '</div>' : '')
                  + '</li>';
              }).join('')
            + '</ul></div>';
        }

        if(data.negative_keywords && data.negative_keywords.length) {
          html += '<div class="ads-rec-section">'
            + '<div class="ads-rec-title">Negative Keywords (' + data.negative_keywords.length + ')</div>'
            + '<ul class="ads-rec-list">'
            + data.negative_keywords.map(function(k) {
                return '<li class="ads-rec-item">'
                  + '<span class="ads-rec-badge ads-rec-neg">NEGATIVE</span>'
                  + h(k.keyword)
                  + (k.rationale ? '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + h(k.rationale) + '</div>' : '')
                  + '</li>';
              }).join('')
            + '</ul></div>';
        }

        if(data.budget_recommendations && data.budget_recommendations.length) {
          html += '<div class="ads-rec-section" style="grid-column:1/-1">'
            + '<div class="ads-rec-title">Budget Recommendations</div>'
            + '<ul class="ads-rec-list">'
            + data.budget_recommendations.map(function(b) {
                var action = (b.action || '').toLowerCase();
                var ac = action === 'increase' ? 'var(--gm)' : action === 'decrease' ? '#f59e0b' : '#ef4444';
                var al = action === 'increase' ? '↑ Increase' : action === 'decrease' ? '↓ Decrease' : '⏸ Pause';
                return '<li class="ads-rec-item">'
                  + '<span style="font-size:11px;font-weight:700;color:' + ac + '">' + al + '</span>'
                  + ' <strong>' + h(b.campaign || '') + '</strong>'
                  + (b.rationale ? ' — <span style="color:var(--muted)">' + h(b.rationale) + '</span>' : '')
                  + '</li>';
              }).join('')
            + '</ul></div>';
        }

        html += '</div>';
        result.innerHTML = html;
        result.style.display = '';
      }

    } catch(err) {
      if(errEl) { errEl.textContent = err.message || 'Recommendations failed — try again'; errEl.style.display = ''; }
    } finally {
      if(btn) { btn.disabled = false; btn.textContent = 'Re-generate'; }
    }
  };

  // ── Reset AI panels ──────────────────────────────────────────
  function _resetAIPanels() {
    ['ads-analysis-result', 'ads-recommend-result', 'ads-analysis-error', 'ads-recommend-error'].forEach(hide);
    var ab = $('ads-analyze-btn');
    var rb = $('ads-recommend-btn');
    if(ab) { ab.disabled = false; ab.textContent = 'Analyze with AI'; }
    if(rb) { rb.disabled = false; rb.textContent = 'Generate Recommendations'; }
  }

  // ═══════════════════════════════════════════════════════════════
  // META ADS EXPLORER
  // ═══════════════════════════════════════════════════════════════

  // Cache: loaded once per date range, reused when drilling down
  var _ms = { campaigns: null, adsets: null, ads: null, loading: false, dateRange: null };

  function _metaStatusBadge(status) {
    var cls = (status === 'ACTIVE')   ? 'bg-green'
            : (status === 'PAUSED')   ? 'bg-warm'
            : (status === 'ARCHIVED') ? 'bg-grey'
            :                           'bg-grey';
    var lbl = (status === 'ACTIVE')   ? 'Active'
            : (status === 'PAUSED')   ? 'Paused'
            : (status === 'ARCHIVED') ? 'Archived'
            : (status || 'Unknown');
    return '<span class="badge ' + cls + '">' + lbl + '</span>';
  }

  function _fmtObjective(obj) {
    if(!obj) return '—';
    return obj.replace(/_/g, ' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
  }

  async function _initMetaExplorer() {
    // Use cached data if the date range hasn't changed
    if(_ms.campaigns && _ms.dateRange === _s.dateRange) {
      hide('meta-campaign-view');
      _renderMetaCampaigns(_ms.campaigns);
      return;
    }
    if(_ms.loading) return;
    _ms.loading = true;

    hide('meta-campaigns-view');
    hide('meta-campaign-view');
    hide('meta-main-error');
    show('meta-loading');

    try {
      var range = _s.dateRange;
      var qs = '?date_range=' + range;
      var [cRes, aRes, adRes] = await Promise.all([
        apiFetch('/api/meta/campaigns' + qs),
        apiFetch('/api/meta/adsets'    + qs),
        apiFetch('/api/meta/ads'       + qs)
      ]);

      hide('meta-loading');

      if(!cRes.ok) {
        var errEl = $('meta-main-error');
        var msg = (cRes.data && cRes.data.error) || 'Could not load Meta data (HTTP ' + cRes.status + ')';
        if(errEl) { errEl.textContent = msg; errEl.style.display = ''; }
        return;
      }

      _ms.campaigns  = cRes.data.campaigns  || [];
      _ms.adsets     = aRes.ok ? (aRes.data.adsets || [])  : [];
      _ms.ads        = adRes.ok ? (adRes.data.ads  || [])  : [];
      _ms.dateRange  = range;

      _renderMetaCampaigns(_ms.campaigns);

    } catch(err) {
      hide('meta-loading');
      var errEl = $('meta-main-error');
      if(errEl) { errEl.textContent = err.message || 'Network error — try again'; errEl.style.display = ''; }
    } finally {
      _ms.loading = false;
    }
  }

  function _renderMetaKPIs(campaigns) {
    var el = $('meta-kpis');
    if(!el) return;
    var totSpend = 0, totImpr = 0, totClicks = 0, totConv = 0;
    campaigns.forEach(function(c) {
      totSpend  += c.spend        || 0;
      totImpr   += c.impressions  || 0;
      totClicks += c.clicks       || 0;
      totConv   += c.conversions  || 0;
    });
    var ctr = totImpr > 0 ? (totClicks / totImpr) * 100 : 0;
    var kpis = [
      { lbl: 'Spend',       val: fmtMoney(totSpend)    },
      { lbl: 'Impressions', val: fmtNum(totImpr)        },
      { lbl: 'Clicks',      val: fmtNum(totClicks)      },
      { lbl: 'CTR',         val: fmtPct(ctr)            },
      { lbl: 'Conversions', val: fmtNum(totConv),  accent: true }
    ];
    el.innerHTML = kpis.map(function(k) {
      return '<div class="ads-kpi' + (k.accent ? ' ads-kpi-accent' : '') + '">'
        + '<div class="ads-kpi-val">' + k.val + '</div>'
        + '<div class="ads-kpi-lbl">' + k.lbl + '</div>'
        + '</div>';
    }).join('');
  }

  function _renderMetaCampaigns(campaigns) {
    _renderMetaKPIs(campaigns);

    var tbody = $('meta-campaigns-tbody');
    var empty = $('meta-campaigns-empty');
    if(!tbody) return;

    if(!campaigns || campaigns.length === 0) {
      tbody.innerHTML = '';
      if(empty) empty.style.display = '';
      show('meta-campaigns-view');
      return;
    }
    if(empty) empty.style.display = 'none';

    tbody.innerHTML = campaigns.map(function(c) {
      return '<tr onclick="openMetaCampaign(\'' + h(String(c.campaign_id)) + '\')" style="cursor:pointer">'
        + '<td class="ads-name" title="' + h(c.campaign_name) + '">' + h(c.campaign_name) + '</td>'
        + '<td>' + _metaStatusBadge(c.status) + '</td>'
        + '<td style="font-size:12px;color:var(--muted)">' + _fmtObjective(c.objective) + '</td>'
        + '<td class="ads-num">' + fmtMoney(c.spend) + '</td>'
        + '<td class="ads-num">' + fmtNum(c.impressions) + '</td>'
        + '<td class="ads-num">' + fmtNum(c.clicks) + '</td>'
        + '<td class="ads-num">' + fmtPct(c.ctr) + '</td>'
        + '<td class="ads-num">' + fmtNum(c.conversions) + '</td>'
        + '</tr>';
    }).join('');

    show('meta-campaigns-view');
  }

  window.openMetaCampaign = function(campaignId) {
    var camp = null;
    for(var i = 0; i < (_ms.campaigns || []).length; i++) {
      if(String(_ms.campaigns[i].campaign_id) === String(campaignId)) { camp = _ms.campaigns[i]; break; }
    }
    if(!camp) return;

    var adsets = (_ms.adsets || []).filter(function(a) { return String(a.campaign_id) === String(campaignId); });
    var ads    = (_ms.ads    || []).filter(function(a) { return String(a.campaign_id) === String(campaignId); });

    hide('meta-campaigns-view');
    show('meta-campaign-view');

    var detail = $('meta-campaign-detail');
    if(!detail) return;
    detail.innerHTML = _buildMetaCampaignDetail(camp, adsets, ads);
  };

  window.backToMetaCampaigns = function() {
    hide('meta-campaign-view');
    show('meta-campaigns-view');
  };

  function _buildMetaCampaignDetail(camp, adsets, ads) {
    var kpis = [
      { lbl: 'Spend',       val: fmtMoney(camp.spend)       },
      { lbl: 'Impressions', val: fmtNum(camp.impressions)    },
      { lbl: 'Clicks',      val: fmtNum(camp.clicks)         },
      { lbl: 'CTR',         val: fmtPct(camp.ctr)      },
      { lbl: 'Conversions', val: fmtNum(camp.conversions)    }
    ];

    var html = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">'
      + '<h2 class="ads-detail-title" style="margin:0">' + h(camp.campaign_name) + '</h2>'
      + _metaStatusBadge(camp.status)
      + (camp.objective ? '<span class="badge bg-grey" style="font-size:10px">' + _fmtObjective(camp.objective) + '</span>' : '')
      + '</div>'
      + '<div class="ads-kpis" style="margin-bottom:28px">'
      + kpis.map(function(k) {
          return '<div class="ads-kpi"><div class="ads-kpi-val">' + k.val + '</div><div class="ads-kpi-lbl">' + k.lbl + '</div></div>';
        }).join('')
      + '</div>';

    // Ad Sets section
    html += '<div class="ads-section">'
      + '<div class="ads-section-hd"><div class="ads-section-title">Ad Sets (' + adsets.length + ')</div></div>';

    if(adsets.length === 0) {
      html += '<p style="font-size:13px;color:var(--muted)">No ad sets found.</p>';
    } else {
      html += '<div class="ads-table-wrap"><table class="ads-table"><thead><tr>'
        + '<th>Ad Set</th><th>Status</th><th>Goal</th>'
        + '<th class="ads-num">Spend</th><th class="ads-num">Impr.</th><th class="ads-num">Clicks</th><th class="ads-num">Conv.</th>'
        + '</tr></thead><tbody>'
        + adsets.map(function(s) {
            var goal = (s.optimization_goal || '').replace(/_/g,' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
            return '<tr onclick="openMetaAdset(\'' + h(String(s.adset_id)) + '\')" style="cursor:pointer">'
              + '<td class="ads-name">' + h(s.adset_name) + '</td>'
              + '<td>' + _metaStatusBadge(s.status) + '</td>'
              + '<td style="font-size:12px;color:var(--muted)">' + h(goal || '—') + '</td>'
              + '<td class="ads-num">' + fmtMoney(s.spend) + '</td>'
              + '<td class="ads-num">' + fmtNum(s.impressions) + '</td>'
              + '<td class="ads-num">' + fmtNum(s.clicks) + '</td>'
              + '<td class="ads-num">' + fmtNum(s.conversions) + '</td>'
              + '</tr>';
          }).join('')
        + '</tbody></table></div>';
    }
    html += '</div>';

    // Ads section (all ads for this campaign)
    html += '<div id="meta-ads-section" class="ads-section" style="margin-top:8px">'
      + '<div class="ads-section-hd"><div class="ads-section-title">Ads (' + ads.length + ')</div></div>';

    if(ads.length === 0) {
      html += '<p style="font-size:13px;color:var(--muted)">No ads found.</p>';
    } else {
      html += '<div class="ads-table-wrap"><table class="ads-table"><thead><tr>'
        + '<th>Ad</th><th>Status</th>'
        + '<th class="ads-num">Spend</th><th class="ads-num">Impr.</th><th class="ads-num">Clicks</th><th class="ads-num">CTR</th><th class="ads-num">Conv.</th>'
        + '</tr></thead><tbody>'
        + ads.map(function(a) {
            return '<tr onclick="openMetaAd(\'' + h(String(a.ad_id)) + '\')" style="cursor:pointer">'
              + '<td class="ads-name">' + h(a.ad_name) + '</td>'
              + '<td>' + _metaStatusBadge(a.status) + '</td>'
              + '<td class="ads-num">' + fmtMoney(a.spend) + '</td>'
              + '<td class="ads-num">' + fmtNum(a.impressions) + '</td>'
              + '<td class="ads-num">' + fmtNum(a.clicks) + '</td>'
              + '<td class="ads-num">' + fmtPct(a.ctr) + '</td>'
              + '<td class="ads-num">' + fmtNum(a.conversions) + '</td>'
              + '</tr>';
          }).join('')
        + '</tbody></table></div>';
    }
    html += '</div>';

    return html;
  }

  // Filter ad sets view by adset_id — highlights the row and scrolls ads into view
  window.openMetaAdset = function(adsetId) {
    var rows = document.querySelectorAll('#meta-campaign-detail .ads-table tbody tr');
    rows.forEach(function(r) {
      r.style.background = '';
    });
    // Find the adset row and highlight it
    var adsetRows = document.querySelectorAll('#meta-campaign-detail .ads-table');
    if(adsetRows[0]) {
      var trs = adsetRows[0].querySelectorAll('tbody tr');
      var adsets = (_ms.adsets || []);
      for(var i = 0; i < adsets.length; i++) {
        if(String(adsets[i].adset_id) === String(adsetId) && trs[i]) {
          trs[i].style.background = 'rgba(183,255,42,.07)';
          trs[i].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
    // Filter ads section to show only this adset's ads
    var adsForSet = (_ms.ads || []).filter(function(a) { return String(a.adset_id) === String(adsetId); });
    var section = $('meta-ads-section');
    if(!section) return;
    var title = section.querySelector('.ads-section-title');
    var adset = (_ms.adsets || []).filter(function(s) { return String(s.adset_id) === String(adsetId); })[0];
    var adsetName = adset ? adset.adset_name : 'Ad Set';
    if(title) title.textContent = 'Ads in "' + adsetName + '" (' + adsForSet.length + ')';

    var wrap = section.querySelector('.ads-table-wrap');
    if(adsForSet.length === 0) {
      if(wrap) wrap.innerHTML = '<p style="font-size:13px;color:var(--muted);padding:12px 0">No ads in this ad set for the selected date range.</p>';
    } else {
      if(wrap) {
        wrap.innerHTML = '<table class="ads-table"><thead><tr>'
          + '<th>Ad</th><th>Status</th>'
          + '<th class="ads-num">Spend</th><th class="ads-num">Impr.</th><th class="ads-num">Clicks</th><th class="ads-num">CTR</th><th class="ads-num">Conv.</th>'
          + '</tr></thead><tbody>'
          + adsForSet.map(function(a) {
              return '<tr onclick="openMetaAd(\'' + h(String(a.ad_id)) + '\')" style="cursor:pointer">'
                + '<td class="ads-name">' + h(a.ad_name) + '</td>'
                + '<td>' + _metaStatusBadge(a.status) + '</td>'
                + '<td class="ads-num">' + fmtMoney(a.spend) + '</td>'
                + '<td class="ads-num">' + fmtNum(a.impressions) + '</td>'
                + '<td class="ads-num">' + fmtNum(a.clicks) + '</td>'
                + '<td class="ads-num">' + fmtPct(a.ctr) + '</td>'
                + '<td class="ads-num">' + fmtNum(a.conversions) + '</td>'
                + '</tr>';
            }).join('')
          + '</tbody></table>';
      }
    }
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Open Meta ad in the inspector drawer (reuses the existing drawer)
  window.openMetaAd = function(adId) {
    var ad = null;
    for(var i = 0; i < (_ms.ads || []).length; i++) {
      if(String(_ms.ads[i].ad_id) === String(adId)) { ad = _ms.ads[i]; break; }
    }
    if(!ad) return;

    var insp    = $('ads-inspector');
    var overlay = $('ads-inspector-overlay');
    var meta    = $('ads-insp-meta');
    var body    = $('ads-insp-body');
    if(!insp || !body) return;

    if(meta) meta.innerHTML = _metaStatusBadge(ad.status);
    body.innerHTML = _buildMetaAdInspector(ad);

    if(overlay) overlay.classList.add('open');
    insp.classList.add('open');
  };

  function _buildMetaAdInspector(ad) {
    var html = '';

    // Creative preview
    if(ad.image_url || ad.video_thumbnail) {
      var src = ad.image_url || ad.video_thumbnail;
      html += '<div class="meta-ad-preview">'
        + '<img class="meta-ad-preview-img" src="' + h(src) + '" alt="" onerror="this.style.display=\'none\'">'
        + '<div class="meta-ad-preview-body">'
        + (ad.headline    ? '<div class="meta-ad-preview-headline">' + h(ad.headline) + '</div>' : '')
        + (ad.primary_text ? '<div class="meta-ad-preview-text">' + h(ad.primary_text) + '</div>' : '')
        + (ad.call_to_action ? '<span class="meta-ad-preview-cta">' + h(ad.call_to_action.replace(/_/g,' ')) + '</span>' : '')
        + '</div></div>';
    } else if(ad.headline || ad.primary_text) {
      html += '<div class="ads-insp-sec">'
        + '<div class="ads-insp-sec-label">Ad Copy</div>'
        + (ad.headline    ? '<div style="font-size:14px;font-weight:700;color:var(--charcoal);margin-bottom:6px">' + h(ad.headline) + '</div>' : '')
        + (ad.primary_text ? '<div style="font-size:13px;color:var(--muted);line-height:1.55">' + h(ad.primary_text) + '</div>' : '')
        + (ad.call_to_action ? '<div style="margin-top:8px"><span class="meta-ad-preview-cta">' + h(ad.call_to_action.replace(/_/g,' ')) + '</span></div>' : '')
        + '</div>';
    }

    // Performance
    html += '<div class="ads-insp-sec">'
      + '<div class="ads-insp-sec-label">Performance</div>'
      + '<div class="ads-insp-perf-grid">'
      + [
          { lbl: 'Spend',       val: fmtMoney(ad.spend),       accent: false },
          { lbl: 'Impressions', val: fmtNum(ad.impressions),   accent: false },
          { lbl: 'Clicks',      val: fmtNum(ad.clicks),        accent: false },
          { lbl: 'CTR',         val: fmtPct(ad.ctr),           accent: false },
          { lbl: 'Conversions', val: fmtNum(ad.conversions),   accent: true  }
        ].map(function(s) {
          return '<div class="ads-insp-stat' + (s.accent ? ' accent' : '') + '">'
            + '<div class="ads-insp-stat-val">' + s.val + '</div>'
            + '<div class="ads-insp-stat-lbl">' + s.lbl + '</div>'
            + '</div>';
        }).join('')
      + '</div></div>';

    // Ad info
    html += '<div class="ads-insp-sec">'
      + '<div class="ads-insp-sec-label">Ad Information</div>'
      + '<div class="ads-insp-info-grid">'
      + (ad.ad_name ? '<div class="ads-insp-info-cell full"><div class="ads-insp-info-lbl">Ad Name</div><div class="ads-insp-info-val">' + h(ad.ad_name) + '</div></div>' : '')
      + (ad.ad_id   ? '<div class="ads-insp-info-cell"><div class="ads-insp-info-lbl">Ad ID</div><div class="ads-insp-info-val">' + h(ad.ad_id) + '</div></div>' : '')
      + (ad.adset_id ? '<div class="ads-insp-info-cell"><div class="ads-insp-info-lbl">Ad Set ID</div><div class="ads-insp-info-val">' + h(ad.adset_id) + '</div></div>' : '')
      + '</div></div>';

    if(ad.destination_url) {
      html += '<div class="ads-insp-url-chip">'
        + '<span class="ads-insp-url-label">URL</span>'
        + '<a class="ads-insp-url-val" href="' + h(ad.destination_url) + '" target="_blank" rel="noopener noreferrer">' + h(ad.destination_url) + '</a>'
        + '</div>';
    }

    return html;
  }

  // Invalidate Meta cache when date range changes (reuse _s.dateRange)
  var _origSetDateRange = window.setAdsDateRange;
  window.setAdsDateRange = function(range) {
    _origSetDateRange(range);
    // If currently on Meta tab and range changed, reload
    if(_s.platform === 'meta' && _ms.dateRange !== _s.dateRange) {
      _ms.campaigns = null; // invalidate cache
      _initMetaExplorer();
    }
  };

})();
