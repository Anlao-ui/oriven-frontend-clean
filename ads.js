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
    dateRange:  'LAST_30_DAYS',
    overview:   null,
    campaigns:  null,
    account:    null,
    loading:    false
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

  // ── Entry point ─────────────────────────────────────────────
  window.initAdsDashboard = function() {
    var account = window._activeAdAccount;

    // Sync date pills to current state
    _syncDatePills();

    if(!account || !account.account_id) {
      _showEmpty();
      return;
    }

    _s.account = account;
    hide('ads-empty');
    show('ads-dash');
    _updateAccountBar();
    _loadOverview();
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
    var bar = $('ads-account-bar');
    if(!bar || !_s.account) return;
    bar.innerHTML = '<span class="int-status-dot" style="margin-right:6px"></span>'
      + '<span class="ads-account-name">' + h(_s.account.account_name || _s.account.account_id) + '</span>'
      + '<span style="color:var(--muted);margin:0 6px">·</span>'
      + '<span class="ads-account-id">ID: ' + h(_s.account.account_id) + '</span>';
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

      _s.overview  = res.data.overview;
      _s.campaigns = res.data.campaigns;
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

    var ctrBench  = 3.0; // % industry benchmark for search
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

    // Update ring
    var arc = $('ads-score-arc');
    var num = $('ads-score-num');
    if(arc) {
      arc.style.strokeDasharray  = CIRCUMFERENCE;
      arc.style.strokeDashoffset = CIRCUMFERENCE * (1 - score / 100);
      arc.style.stroke = score >= 70 ? '#B7FF2A' : score >= 45 ? '#f59e0b' : '#ef4444';
    }
    if(num) num.textContent = score;

    // Score breakdown bars
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

    hide('ads-campaigns-view');
    show('ads-campaign-view');

    var detail = $('ads-campaign-detail');
    if(!detail) return;
    detail.innerHTML = _buildCampaignShell(camp);
    _loadCampaignDetail(campaignId);
  };

  window.backToAdsCampaigns = function() {
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
      + '<div id="ads-detail-ads-wrap"><div class="ads-loading-wrap"><div class="ads-spinner"></div>Loading ads…</div></div>'
      + '<div id="ads-detail-kw-wrap" style="margin-top:20px"></div>';
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
      _renderDetailAds(res.data.ads || []);
      _renderDetailKeywords(res.data.keywords || []);
    } catch(err) {
      var w = $('ads-detail-ads-wrap');
      if(w) w.innerHTML = '<p style="color:#ef4444;font-size:13px">' + h(err.message || 'Network error') + '</p>';
    }
  }

  function _renderDetailAds(ads) {
    var el = $('ads-detail-ads-wrap');
    if(!el) return;

    if(!ads || ads.length === 0) {
      el.innerHTML = '<div class="ads-section-hd"><div class="ads-section-title">Ads</div></div>'
        + '<p style="font-size:13px;color:var(--muted)">No ads found for this date range.</p>';
      return;
    }

    el.innerHTML = '<div class="ads-section-hd"><div class="ads-section-title">Ads (' + ads.length + ')</div></div>'
      + '<div class="ads-table-wrap">'
      + '<table class="ads-table">'
      + '<thead><tr>'
      + '<th>Headline</th><th>Ad Group</th><th>Status</th>'
      + '<th class="ads-num">Impr.</th><th class="ads-num">Clicks</th>'
      + '<th class="ads-num">CTR</th><th class="ads-num">Conv.</th>'
      + '</tr></thead><tbody>'
      + ads.map(function(a) {
          return '<tr>'
            + '<td class="ads-name" style="max-width:260px" title="' + h(a.headline) + '">' + h(a.headline || '—') + '</td>'
            + '<td style="font-size:12px;color:var(--muted)">' + h(a.ad_group) + '</td>'
            + '<td>' + statusBadge(a.status) + '</td>'
            + '<td class="ads-num">' + fmtNum(a.impressions) + '</td>'
            + '<td class="ads-num">' + fmtNum(a.clicks) + '</td>'
            + '<td class="ads-num">' + fmtPct(a.ctr) + '</td>'
            + '<td class="ads-num">' + fmtNum(a.conversions) + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  function _renderDetailKeywords(keywords) {
    var el = $('ads-detail-kw-wrap');
    if(!el || !keywords || keywords.length === 0) return;

    el.innerHTML = '<div class="ads-section-hd" style="margin-top:4px"><div class="ads-section-title">Keywords (' + keywords.length + ')</div></div>'
      + '<div class="ads-table-wrap">'
      + '<table class="ads-table">'
      + '<thead><tr>'
      + '<th>Keyword</th><th>Match</th><th>Status</th>'
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
            + '<td>' + statusBadge(k.status) + '</td>'
            + '<td class="ads-num">' + fmtMoney(k.spend) + '</td>'
            + '<td class="ads-num">' + fmtNum(k.clicks) + '</td>'
            + '<td class="ads-num">' + fmtPct(k.ctr) + '</td>'
            + '<td class="ads-num">' + fmtNum(k.conversions) + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  // ── AI Analysis ──────────────────────────────────────────────
  window.analyzeAds = async function() {
    if(!_s.overview || !_s.campaigns) {
      if(typeof toast === 'function') toast('Load account data first.', 'err');
      return;
    }

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
        body:    JSON.stringify({
          overview:   _s.overview,
          campaigns:  _s.campaigns,
          account:    _s.account,
          date_range: _s.dateRange
        })
      });

      if(!res.ok) throw new Error((res.data && res.data.error) || 'Analysis failed (HTTP ' + res.status + ')');

      var data = res.data;

      // Render findings
      if(result && data.findings && data.findings.length) {
        result.innerHTML = '<div class="ads-findings">'
          + data.findings.map(function(f) {
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
        result.style.display = '';
      }

      // Update Oriven Score from AI if provided
      if(data.score && typeof data.score.overall === 'number') {
        var s   = Math.max(0, Math.min(100, data.score.overall));
        var arc = $('ads-score-arc');
        var num = $('ads-score-num');
        if(arc) {
          arc.style.strokeDasharray  = CIRCUMFERENCE;
          arc.style.strokeDashoffset = CIRCUMFERENCE * (1 - s / 100);
          arc.style.stroke = s >= 70 ? '#B7FF2A' : s >= 45 ? '#f59e0b' : '#ef4444';
        }
        if(num) num.textContent = s;

        // Strengths / weaknesses / opportunities
        var card = $('ads-score-card');
        if(card && (data.score.strengths || data.score.weaknesses || data.score.opportunities)) {
          var sw = document.createElement('div');
          sw.style.marginTop = '14px';
          var swHtml = '';
          if(data.score.strengths && data.score.strengths.length) {
            swHtml += '<div style="margin-bottom:8px">'
              + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gm);margin-bottom:4px">Strengths</div>'
              + data.score.strengths.map(function(t){ return '<div style="font-size:12px;color:var(--muted);padding:2px 0">✓ ' + h(t) + '</div>'; }).join('')
              + '</div>';
          }
          if(data.score.weaknesses && data.score.weaknesses.length) {
            swHtml += '<div style="margin-bottom:8px">'
              + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#ef4444;margin-bottom:4px">Weaknesses</div>'
              + data.score.weaknesses.map(function(t){ return '<div style="font-size:12px;color:var(--muted);padding:2px 0">✗ ' + h(t) + '</div>'; }).join('')
              + '</div>';
          }
          if(data.score.opportunities && data.score.opportunities.length) {
            swHtml += '<div>'
              + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#60a5fa;margin-bottom:4px">Opportunities</div>'
              + data.score.opportunities.map(function(t){ return '<div style="font-size:12px;color:var(--muted);padding:2px 0">→ ' + h(t) + '</div>'; }).join('')
              + '</div>';
          }
          sw.innerHTML = swHtml;
          // Remove old SW block if exists, then append
          var oldSw = card.querySelector('[data-sw]');
          if(oldSw) oldSw.remove();
          sw.setAttribute('data-sw', '1');
          card.querySelector('.ads-score-wrap').appendChild(sw);
        }
      }

    } catch(err) {
      if(errEl) { errEl.textContent = err.message || 'Analysis failed — try again'; errEl.style.display = ''; }
    } finally {
      if(btn) { btn.disabled = false; btn.textContent = 'Re-analyze'; }
    }
  };

  // ── AI Recommendations ───────────────────────────────────────
  window.generateAdsRecommendations = async function() {
    if(!_s.overview || !_s.campaigns) {
      if(typeof toast === 'function') toast('Load account data first.', 'err');
      return;
    }

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
        body:    JSON.stringify({
          overview:   _s.overview,
          campaigns:  _s.campaigns,
          account:    _s.account,
          date_range: _s.dateRange
        })
      });

      if(!res.ok) throw new Error((res.data && res.data.error) || 'Recommendations failed (HTTP ' + res.status + ')');

      var data = res.data;

      if(result) {
        var html = '<div class="ads-recs-grid">';

        // Headlines
        if(data.headlines && data.headlines.length) {
          html += '<div class="ads-rec-section">'
            + '<div class="ads-rec-title">Headlines (' + data.headlines.length + ')</div>'
            + '<ul class="ads-rec-list">'
            + data.headlines.map(function(t){ return '<li class="ads-rec-item">' + h(t) + '</li>'; }).join('')
            + '</ul></div>';
        }

        // Descriptions
        if(data.descriptions && data.descriptions.length) {
          html += '<div class="ads-rec-section">'
            + '<div class="ads-rec-title">Descriptions (' + data.descriptions.length + ')</div>'
            + '<ul class="ads-rec-list">'
            + data.descriptions.map(function(t){ return '<li class="ads-rec-item">' + h(t) + '</li>'; }).join('')
            + '</ul></div>';
        }

        // Keywords
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

        // Negative keywords
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

        // Budget recommendations — full width
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

})();
