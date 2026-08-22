// ════════════════════════════════════════════════════════════════
// Autopilot — Experience Redesign. The automation engine itself is
// unchanged (still POST/PATCH/DELETE /api/autopilot/rules, the real
// server-side evaluator, the real test endpoint) — this sprint only
// changes how a person builds and reads a rule: a guided, one-question-
// at-a-time conversation with selectable cards and a live plain-English
// summary, instead of a wall of dropdowns. "Teaching a teammate", not
// filling out a form.
// ════════════════════════════════════════════════════════════════

function _apOpEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

(function() {
  var _prevNav = window.navigate;
  window.navigate = function(page) {
    if (typeof _prevNav === 'function') _prevNav.apply(this, arguments);
    if (page === 'autopilot' && typeof apInit === 'function') setTimeout(apInit, 0);
  };
})();

// ── Reference data — only what the backend genuinely supports
// (AUTOPILOT_RULE_METRICS/ACTION_TYPES/PLATFORMS in server.js). ───────
var AP_PLATFORM_DEFS = [
  { v: 'google', label: 'Google Ads', desc: 'Search & Shopping campaigns', icon: '<svg viewBox="0 0 12 12" fill="none" width="20" height="20"><path d="M10.9 6.1c0-.4 0-.8-.1-1.1H6v2.1h2.8a2.4 2.4 0 0 1-1 1.5v1.2h1.7c1-1 1.4-2.3 1.4-3.7z" fill="#4285F4"/><path d="M6 11c1.4 0 2.6-.5 3.5-1.3l-1.7-1.3a3.2 3.2 0 0 1-1.8.5 3.2 3.2 0 0 1-3-2.1H1.3v1.3A5.3 5.3 0 0 0 6 11z" fill="#34A853"/><path d="M3 6.8a3.1 3.1 0 0 1 0-1.6V3.9H1.3a5.3 5.3 0 0 0 0 4.2L3 6.8z" fill="#FBBC05"/><path d="M6 2.7c.8 0 1.5.3 2 .8L9.6 1.9A5.3 5.3 0 0 0 1.3 3.9L3 5.2a3.2 3.2 0 0 1 3-2.5z" fill="#EA4335"/></svg>' },
  { v: 'meta', label: 'Meta Ads', desc: 'Facebook & Instagram campaigns', icon: '<svg viewBox="0 0 12 12" fill="none" width="20" height="20"><rect width="12" height="12" rx="3" fill="#1877F2"/><path d="M8.1 6a2.1 2.1 0 1 0-4.2 0c0 1 .7 1.8 1.7 2V7H4.7V6h.9V5.3c0-.6.3-.9.9-.9h.5V5.2h-.4c-.2 0-.2.1-.2.3V6h.7L7 7H6.4v1c1-.2 1.7-1 1.7-2z" fill="white"/></svg>' },
  { v: 'tiktok', label: 'TikTok Ads', desc: 'Short-form video campaigns', icon: '<svg viewBox="0 0 12 12" fill="none" width="20" height="20"><rect width="12" height="12" rx="3" fill="#010101"/><path d="M7.9 3.1h-.9v3.7a.75.75 0 1 1-1-.7V4.8a2.5 2.5 0 1 0 2.2 2.5V4.8c.3.2.7.3 1.1.3V4a1.1 1.1 0 0 1-1.4-.9z" fill="white"/></svg>' }
];
var AP_METRICS = [
  { v: 'roas', l: 'ROAS' }, { v: 'ctr', l: 'CTR' }, { v: 'cpc', l: 'CPC' }, { v: 'cpa', l: 'CPA' },
  { v: 'conversions', l: 'Conversions' }, { v: 'spend', l: 'Spend' }, { v: 'clicks', l: 'Clicks' },
  { v: 'impressions', l: 'Impressions' }, { v: 'budget', l: 'Budget' }, { v: 'status', l: 'Campaign Status' }
];
var AP_METRIC_DESC = {
  roas: 'Return on ad spend', ctr: 'Click-through rate', cpc: 'Cost per click', cpa: 'Cost per acquisition',
  conversions: 'Total conversions', spend: 'Amount spent', clicks: 'Total clicks', impressions: 'Times shown',
  budget: 'Daily budget', status: 'Active or paused'
};
// TikTok has no performance-metrics endpoint today (no CTR/CPA/ROAS/spend
// fetched anywhere for it) — only campaign metadata (status, budget). A
// TikTok rule built on any other metric could never evaluate to anything
// real, so it's excluded here rather than silently never firing.
var AP_METRICS_TIKTOK = ['status', 'budget'];
var AP_OPERATORS = [
  { v: '>', l: 'is greater than' }, { v: '<', l: 'is less than' }, { v: '==', l: 'equals' },
  { v: '>=', l: 'is at least' }, { v: '<=', l: 'is at most' }
];
var AP_ACTIONS = [
  { v: 'increase_budget', l: 'Increase Budget', percent: true, budgetOnly: true },
  { v: 'decrease_budget', l: 'Decrease Budget', percent: true, budgetOnly: true },
  { v: 'pause_campaign', l: 'Pause Campaign' },
  { v: 'resume_campaign', l: 'Resume Campaign' },
  { v: 'generate_creative', l: 'Generate New Creative' },
  { v: 'generate_recommendations', l: 'Generate AI Recommendations' },
  { v: 'notify', l: 'Notify Me' },
  { v: 'request_approval', l: 'Request Approval' },
  { v: 'create_report', l: 'Generate Report' },
  { v: 'create_briefing', l: 'Create Briefing' },
  { v: 'run_optimisation', l: 'Run AI Optimisation' }
];
var AP_ACTION_DESC = {
  increase_budget: 'Scale spend automatically', decrease_budget: 'Reduce spend automatically',
  pause_campaign: 'Stop it from spending', resume_campaign: 'Turn it back on',
  generate_creative: 'Fresh headlines & copy', generate_recommendations: 'AI-written suggestions',
  notify: 'Just tell me', request_approval: 'Ask before acting',
  create_report: 'A snapshot of performance', create_briefing: 'A written summary', run_optimisation: 'Full AI review'
};
// No PATCH /api/tiktok/campaign/:id (budget) endpoint exists — real gap,
// enforced here and again server-side so a TikTok rule can never be saved
// with an action that would silently never execute.
var AP_BUDGET_UNSUPPORTED_PLATFORMS = ['tiktok'];
var AP_PLAT_LABELS = { google: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads' };
var AP_METRIC_LABELS = {}; AP_METRICS.forEach(function(m) { AP_METRIC_LABELS[m.v] = m.l; });
var AP_ACTION_LABELS = {}; AP_ACTIONS.forEach(function(a) { AP_ACTION_LABELS[a.v] = a.l; });
var AP_MODE_DEFS = [
  { v: 'require_approval', label: 'Ask me first', desc: 'You approve every time' },
  { v: 'suggest_only', label: 'Just suggest it', desc: 'No action taken automatically' },
  { v: 'fully_automatic', label: 'Handle it automatically', desc: 'No approval needed' }
];
var AP_MODE_LABELS = {}; AP_MODE_DEFS.forEach(function(m) { AP_MODE_LABELS[m.v] = m.label; });

// i18n — labels above are English defaults (used before settings.js has loaded
// preferences, and as a fallback). Everything actually rendered on-screen goes
// through these maps + _apT() so it re-resolves against the live language
// instead of being baked in once at script-parse time.
var AP_METRIC_KEYS = { roas:'apMetricRoas', ctr:'apMetricCtr', cpc:'apMetricCpc', cpa:'apMetricCpa', conversions:'apMetricConversions', spend:'apMetricSpend', clicks:'apMetricClicks', impressions:'apMetricImpressions', budget:'apMetricBudget', status:'apMetricStatus' };
var AP_ACTION_KEYS = { increase_budget:'apActionIncreaseBudget', decrease_budget:'apActionDecreaseBudget', pause_campaign:'apActionPause', resume_campaign:'apActionResume', generate_creative:'apActionGenCreative', generate_recommendations:'apActionGenRecs', notify:'apActionNotify', request_approval:'apActionRequestApproval', create_report:'apActionCreateReport', create_briefing:'apActionCreateBriefing', run_optimisation:'apActionRunOptimisation' };
var AP_OPERATOR_KEYS = { '>':'apOpGreaterThan', '<':'apOpLessThan', '==':'apOpEquals', '>=':'apOpAtLeast', '<=':'apOpAtMost' };
var AP_MODE_KEYS = { require_approval:'apModeAskFirst', suggest_only:'apModeSuggestIt', fully_automatic:'apModeHandleAuto' };
var AP_MODE_DESC_KEYS = { require_approval:'apModeAskFirstDesc', suggest_only:'apModeSuggestItDesc', fully_automatic:'apModeHandleAutoDesc' };
function _apT(key, fallback){ return (key && typeof t === 'function') ? t(key) : fallback; }
function _apMetricLabel(v){ return _apT(AP_METRIC_KEYS[v], AP_METRIC_LABELS[v] || v); }
function _apActionLabel(v){ return _apT(AP_ACTION_KEYS[v], AP_ACTION_LABELS[v] || v); }
function _apOperatorLabel(v){ return _apT(AP_OPERATOR_KEYS[v], v); }
function _apModeLabel(v){ return _apT(AP_MODE_KEYS[v], AP_MODE_LABELS[v] || v); }
function _apModeDesc(v){ var d = { require_approval:'You approve every time', suggest_only:'No action taken automatically', fully_automatic:'No approval needed' }; return _apT(AP_MODE_DESC_KEYS[v], d[v] || ''); }
// Descriptions (secondary card text) aren't in LANG_STRINGS yet — English only for now.
function _apMetricDesc(v){ return AP_METRIC_DESC[v] || ''; }
function _apActionDesc(v){ return AP_ACTION_DESC[v] || ''; }

var AP = { step: 1, platform: null, campaigns: [], campaignId: null, campaignName: null, metric: null, operator: null, value: null, action: null, percent: 15, mode: 'require_approval', editingRuleId: null, historyItems: [] };

window.apInit = function() {
  _apPlayShellAnim(); // header + engine become visible immediately, independent of how long the data below takes to load
  apWizStart();
  apActiveLoad();
  apHistLoad();
  apSettingsLoad();
  apLoadMonitoringSources();
  _apRenderCreditFact();
};

// Credit/execution-cost fact in the hero status row — Creator shows its
// real "N / 10 executions used" plus the per-execution credit cost,
// Professional shows "Unlimited executions" (still noting the credit cost,
// since executions consume the shared credit pool even though the
// separate execution-count cap doesn't apply). Reads live values from
// /api/credits/status (creditManager's FEATURE_COSTS/autopilotUsage) —
// never hardcoded, same pattern as _prfRenderAiCost/_vaRenderCost.
function _apRenderCreditFact(){
  var el = document.getElementById('apHeroCreditFact');
  if(!el || typeof _getCreditStatus !== 'function') return;
  _getCreditStatus().then(function(status){
    if(!status || !status.featureCosts) return;
    var cost = status.featureCosts.autopilot;
    var au = status.autopilotUsage || {};
    var text;
    if(au.limit == null){
      text = 'Unlimited executions · ' + cost + ' credits / execution';
    } else {
      text = (au.used || 0) + ' / ' + au.limit + ' executions used · ' + cost + ' credits / execution';
    }
    el.textContent = text;
    el.style.display = '';
  }).catch(function(){});
}

// ══ Create Automation / Settings modals — the existing #apBuilderSection
// and #apSettingsSection are moved into their modal bodies via a real DOM
// appendChild (not copied/rebuilt) the first time each is opened, so every
// existing id/handler in the wizard and settings rows keeps working
// completely unchanged. ══════════════════════════════════════════════
window.apOpenBuilder = function() {
  var section = document.getElementById('apBuilderSection');
  var body = document.getElementById('apBuilderModalBody');
  if (section && body && section.parentElement !== body) {
    section.classList.remove('ov3-section');
    body.appendChild(section);
  }
  if (section) section.style.display = '';
  var overlay = document.getElementById('apBuilderOverlay');
  if (overlay) overlay.style.display = 'flex';
};
window.apCloseBuilder = function() {
  var overlay = document.getElementById('apBuilderOverlay');
  if (overlay) overlay.style.display = 'none';
};
window.apOpenSettings = function() {
  var section = document.getElementById('apSettingsSection');
  var body = document.getElementById('apSettingsModalBody');
  if (section && body && section.parentElement !== body) {
    section.classList.remove('ov3-section', 'ov3-section-last');
    body.appendChild(section);
  }
  if (section) section.style.display = '';
  apSettingsLoad(); // re-sync from storage every time it opens — cheap, always correct
  var overlay = document.getElementById('apSettingsOverlay');
  if (overlay) overlay.style.display = 'flex';
};
window.apCloseSettings = function() {
  var overlay = document.getElementById('apSettingsOverlay');
  if (overlay) overlay.style.display = 'none';
};

// ══ Monitoring Sources — real connection status + real campaign counts,
// the exact same /api/{platform}/status + /api/{platform}/campaigns
// endpoints and platform icons (_PRF_PLAT_ICONS) Campaigns/Intelligence
// already use elsewhere in this app — no second connection model, no new
// endpoints. ══════════════════════════════════════════════════════════
var AP_MON_PLATFORMS = [
  { key: 'google', label: 'Google Ads' },
  { key: 'meta',   label: 'Meta Ads' },
  { key: 'tiktok', label: 'TikTok Ads' }
];
function _apFetchPlatformStatus(p) {
  return apiFetch('/api/' + p.key + '/status').then(function(r) {
    if (!r.ok) return { platform: p.key, label: p.label, connected: false, campaignCount: 0, statusError: true };
    var connected = !!(r.data && r.data.connected);
    if (!connected) return { platform: p.key, label: p.label, connected: false, campaignCount: 0 };
    return apiFetch('/api/' + p.key + '/campaigns').then(function(cr) {
      if (!cr.ok) return { platform: p.key, label: p.label, connected: true, campaignCount: 0, loadError: true };
      var count = (cr.data && cr.data.campaigns) ? cr.data.campaigns.length : 0;
      return { platform: p.key, label: p.label, connected: true, campaignCount: count };
    }).catch(function() { return { platform: p.key, label: p.label, connected: true, campaignCount: 0, loadError: true }; });
  }).catch(function() { return { platform: p.key, label: p.label, connected: false, campaignCount: 0, statusError: true }; });
}
function apLoadMonitoringSources() {
  var el = document.getElementById('apSourcesList');
  if (!el || typeof apiFetch !== 'function') return;
  Promise.all(AP_MON_PLATFORMS.map(_apFetchPlatformStatus)).then(function(results) {
    window._apSourcesSnapshot = results;
    var anyConnected = results.some(function(r) { return r.connected; });
    el.innerHTML = anyConnected ? results.map(_apSourceCard).join('') : _apSourcesEmptyState();
    _apUpdateHeroFacts(results);
  }).catch(function() {
    el.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">Could not load connection status.</span>';
  });
}
function _apSourceCard(p) {
  var statusHtml = p.statusError
    ? '<span class="intel-mon-status intel-mon-status-off"><span class="intel-mon-dot"></span>Status unavailable</span>'
    : p.connected
      ? '<span class="intel-mon-status intel-mon-status-on"><span class="intel-mon-dot"></span>Connected</span>'
      : '<span class="intel-mon-status intel-mon-status-off"><span class="intel-mon-dot"></span>Not connected</span>';
  var body;
  if (p.statusError) body = '<div class="ap-source-body ap-source-body-muted">Unable to check connection</div>';
  else if (!p.connected) body = '<div class="ap-source-body ap-source-body-muted">Not connected</div>';
  else if (p.loadError) body = '<div class="ap-source-body ap-source-body-muted">Unable to load campaigns</div>';
  else if (!p.campaignCount) body = '<div class="ap-source-body ap-source-body-muted">No campaigns available</div>';
  else body = '<div class="ap-source-body">' + p.campaignCount + ' campaign' + (p.campaignCount === 1 ? '' : 's') + ' available</div>';
  var action = p.connected ? "_orvNav('adsmanager','page-ads-manager')" : "if(typeof bizGoTo==='function')bizGoTo('connections')";
  return '<button type="button" class="ap-source-card" onclick="' + action + '">' +
    '<div class="ap-source-top"><span class="intel-mon-plat-icon">' + (typeof _PRF_PLAT_ICONS !== 'undefined' ? (_PRF_PLAT_ICONS[p.platform] || '') : '') + '</span><span class="ap-source-name">' + _apOpEsc(p.label) + '</span></div>' +
    statusHtml + body +
  '</button>';
}
function _apSourcesEmptyState() {
  return '<div class="ap-sources-empty">' +
    '<div class="ap-sources-empty-title">AUTOPILOT READY</div>' +
    '<div class="ap-sources-empty-sub">No campaigns are running yet.</div>' +
    '<div class="ap-sources-empty-sub2">Connect an advertising account and Oriven will automatically monitor eligible campaigns.</div>' +
    '<button type="button" class="camp-new-btn camp-new-btn-lg" onclick="if(typeof bizGoTo===\'function\')bizGoTo(\'connections\')">Connect account →</button>' +
  '</div>';
}
function _apUpdateHeroFacts(results) {
  var byPlat = {}; results.forEach(function(r) { byPlat[r.platform] = r; });
  var gEl = document.getElementById('apHeroGoogleFact');
  var mEl = document.getElementById('apHeroMetaFact');
  if (gEl) { var g = byPlat.google; if (g && g.connected) { gEl.textContent = 'Google Ads connected'; gEl.style.display = ''; } else gEl.style.display = 'none'; }
  if (mEl) { var m = byPlat.meta; if (m && m.connected) { mEl.textContent = 'Meta Ads connected'; mEl.style.display = ''; } else mEl.style.display = 'none'; }
}

// ══ Entrance animation — header/engine become visible immediately
// (independent of data loading, same lesson learned building Intelligence:
// gating a hero behind a data-driven render left it invisible for the
// entire fetch), card lists stagger in separately once each has real
// content. Reuses the @keyframes intelFadeUp already defined for
// Intelligence (styles.css) rather than a second, near-identical one. ════
function _apPlayShellAnim() {
  var wrap = document.getElementById('apPageWrap');
  if (!wrap) return;
  wrap.classList.remove('ap-anim-play');
  void wrap.offsetWidth;
  wrap.classList.add('ap-anim-play');
}
function _apPlayCardStagger(containerId) {
  var wrap = document.getElementById('apPageWrap');
  var container = document.getElementById(containerId);
  if (!wrap || !container) return;
  var cls = 'ap-anim-cards-' + containerId;
  wrap.classList.remove(cls);
  void wrap.offsetWidth;
  Array.prototype.forEach.call(container.children, function(card, i) {
    card.style.animationDelay = (i * 60) + 'ms';
  });
  wrap.classList.add(cls);
}

// ══ Automation Builder — guided wizard ═══════════════════════════════

window.apWizStart = function() {
  AP.step = 1; AP.platform = null; AP.campaignId = null; AP.campaignName = null;
  AP.metric = null; AP.operator = null; AP.value = null; AP.action = null; AP.percent = 15;
  AP.editingRuleId = null;
  AP.mode = _apSettingsRead().defaultMode;
  for (var n = 1; n <= 4; n++) { var r = document.getElementById('apWizRecap' + n); if (r) r.style.display = 'none'; }
  for (var m = 2; m <= 5; m++) { var s = document.getElementById('apWizStep' + m); if (s) s.style.display = 'none'; }
  var step1 = document.getElementById('apWizStep1'); if (step1) step1.style.display = '';
  var condDetail = document.getElementById('apWizConditionDetail'); if (condDetail) condDetail.style.display = 'none';
  var actDetail = document.getElementById('apWizActionDetail'); if (actDetail) actDetail.style.display = 'none';
  var nameEl = document.getElementById('apBName'); if (nameEl) nameEl.value = '';
  var testResult = document.getElementById('apBTestResult'); if (testResult) testResult.style.display = 'none';
  var errEl = document.getElementById('apBError'); if (errEl) errEl.style.display = 'none';
  var saveBtn = document.getElementById('apBSaveBtn'); if (saveBtn) saveBtn.textContent = _apT('apCreateAutomationBtn', 'Create Automation');
  apWizRenderPlatformCards();
};
window.apWizRestart = window.apWizStart;

function _apWizCollapseAndAdvance(stepNum, recapVal, nextStepNum) {
  var stepEl = document.getElementById('apWizStep' + stepNum);
  var recapEl = document.getElementById('apWizRecap' + stepNum);
  if (stepEl) {
    stepEl.classList.add('ap-wiz-step-leaving');
    setTimeout(function() { stepEl.style.display = 'none'; stepEl.classList.remove('ap-wiz-step-leaving'); }, 240);
  }
  if (recapEl) {
    var valEl = recapEl.querySelector('.ap-wiz-recap-val');
    if (valEl) valEl.textContent = recapVal;
    recapEl.style.display = 'flex';
    recapEl.classList.add('ap-wiz-recap-enter');
    requestAnimationFrame(function() { requestAnimationFrame(function() { recapEl.classList.remove('ap-wiz-recap-enter'); }); });
  }
  if (nextStepNum) {
    setTimeout(function() {
      var nextEl = document.getElementById('apWizStep' + nextStepNum);
      if (!nextEl) return;
      nextEl.style.display = '';
      nextEl.classList.add('ap-wiz-step-entering');
      requestAnimationFrame(function() { requestAnimationFrame(function() { nextEl.classList.remove('ap-wiz-step-entering'); }); });
      AP.step = nextStepNum;
    }, 180);
  }
}

window.apWizEdit = function(stepNum) {
  for (var n = stepNum; n <= 4; n++) {
    var recap = document.getElementById('apWizRecap' + n); if (recap) recap.style.display = 'none';
    var step = document.getElementById('apWizStep' + n); if (step) step.style.display = (n === stepNum) ? '' : 'none';
  }
  var step5 = document.getElementById('apWizStep5'); if (step5) step5.style.display = 'none';
  AP.step = stepNum;
  if (stepNum === 1) apWizRenderPlatformCards();
  if (stepNum === 2) apWizRenderCampaignCards();
  if (stepNum === 3) apWizRenderMetricCards();
  if (stepNum === 4) apWizRenderActionCards();
};

function apWizShowStepError(containerId, msg) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var errEl = container.querySelector('.ap-wiz-inline-err');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.className = 'ap-wiz-inline-err';
    errEl.style.cssText = 'width:100%;font-size:12px;color:#ef4444;margin-top:6px';
    container.appendChild(errEl);
  }
  errEl.textContent = msg;
}

// ── Step 1 — Platform ──────────────────────────────────────────────
function apWizRenderPlatformCards() {
  var el = document.getElementById('apWizPlatformCards');
  if (!el) return;
  el.innerHTML = AP_PLATFORM_DEFS.map(function(p) {
    return '<button type="button" class="ap-wiz-card' + (AP.platform === p.v ? ' ap-wiz-card-selected' : '') + '" data-plat="' + p.v + '" onclick="apWizSelectPlatform(\'' + p.v + '\')">' +
      '<span class="ap-wiz-card-icon">' + p.icon + '</span>' +
      '<span class="ap-wiz-card-title">' + p.label + '</span>' +
      '<span class="ap-wiz-card-desc">' + p.desc + '</span>' +
    '</button>';
  }).join('');
}
window.apWizSelectPlatform = function(platform) {
  AP.platform = platform;
  document.querySelectorAll('#apWizPlatformCards .ap-wiz-card').forEach(function(c) {
    c.classList.toggle('ap-wiz-card-selected', c.getAttribute('data-plat') === platform);
  });
  var label = AP_PLAT_LABELS[platform] || platform;
  setTimeout(function() {
    _apWizCollapseAndAdvance(1, label, 2);
    apWizLoadCampaigns();
  }, 200);
};

// ── Step 2 — Campaign ──────────────────────────────────────────────
function apWizLoadCampaigns() {
  var el = document.getElementById('apWizCampaignCards');
  if (!el || typeof apiFetch !== 'function') return;
  el.innerHTML = '<div class="ov3-brief-loading"><div class="orv-ai-thinking-dots"><span></span><span></span><span></span></div></div>';
  var path = AP.platform === 'google' ? '/api/google-ads/campaigns' : AP.platform === 'meta' ? '/api/meta/campaigns' : '/api/tiktok/campaigns';
  apiFetch(path).then(function(res) {
    var items = (res.ok && res.data && res.data.campaigns) || [];
    // Only ever this platform's campaigns — never mixed with another's.
    AP.campaigns = items.map(function(c) { return { id: String(c.campaign_id != null ? c.campaign_id : c.id), name: c.campaign_name || c.name || 'Unnamed' }; });
    apWizRenderCampaignCards();
  }).catch(function() { AP.campaigns = []; apWizRenderCampaignCards(); });
}
function apWizRenderCampaignCards() {
  var el = document.getElementById('apWizCampaignCards');
  if (!el) return;
  var cards = [{ id: 'all', name: _apT('apAllCampaigns', 'All Campaigns'), desc: _apT('apAllCampaignsDesc', 'Every campaign on this platform') }].concat(
    AP.campaigns.map(function(c) { return { id: c.id, name: c.name, desc: _apT('apJustThisCampaignDesc', 'Just this campaign') }; })
  );
  el.innerHTML = cards.map(function(c) {
    return '<button type="button" class="ap-wiz-card' + (AP.campaignId === c.id ? ' ap-wiz-card-selected' : '') + '" data-camp="' + _apOpEsc(c.id) + '" onclick="apWizSelectCampaign(\'' + _apOpEsc(c.id) + '\')">' +
      '<span class="ap-wiz-card-title">' + _apOpEsc(c.name) + '</span>' +
      '<span class="ap-wiz-card-desc">' + c.desc + '</span>' +
    '</button>';
  }).join('');
}
window.apWizSelectCampaign = function(id) {
  AP.campaignId = id;
  AP.campaignName = id === 'all' ? _apT('apAllCampaigns', 'All Campaigns') : ((AP.campaigns.filter(function(c) { return c.id === id; })[0] || {}).name || id);
  document.querySelectorAll('#apWizCampaignCards .ap-wiz-card').forEach(function(c) {
    c.classList.toggle('ap-wiz-card-selected', c.getAttribute('data-camp') === id);
  });
  setTimeout(function() {
    _apWizCollapseAndAdvance(2, AP.campaignName, 3);
    apWizRenderMetricCards();
  }, 200);
};

// ── Step 3 — Condition ─────────────────────────────────────────────
function apWizRenderMetricCards() {
  var el = document.getElementById('apWizMetricCards');
  if (!el) return;
  var allowed = AP.platform === 'tiktok' ? AP_METRICS.filter(function(m) { return AP_METRICS_TIKTOK.indexOf(m.v) !== -1; }) : AP_METRICS;
  el.innerHTML = allowed.map(function(m) {
    return '<button type="button" class="ap-wiz-card' + (AP.metric === m.v ? ' ap-wiz-card-selected' : '') + '" data-metric="' + m.v + '" onclick="apWizSelectMetric(\'' + m.v + '\')">' +
      '<span class="ap-wiz-card-title">' + _apMetricLabel(m.v) + '</span>' +
      '<span class="ap-wiz-card-desc">' + _apMetricDesc(m.v) + '</span>' +
    '</button>';
  }).join('');
  var detail = document.getElementById('apWizConditionDetail'); if (detail && !AP.metric) detail.style.display = 'none';
}
window.apWizSelectMetric = function(metric) {
  AP.metric = metric; AP.operator = null; AP.value = null;
  document.querySelectorAll('#apWizMetricCards .ap-wiz-card').forEach(function(c) {
    c.classList.toggle('ap-wiz-card-selected', c.getAttribute('data-metric') === metric);
  });
  var isStatus = metric === 'status';
  var ops = isStatus ? AP_OPERATORS.filter(function(o) { return o.v === '=='; }) : AP_OPERATORS;
  var opPillsEl = document.getElementById('apWizOpPills');
  if (opPillsEl) {
    opPillsEl.innerHTML = ops.map(function(o, i) {
      return '<button type="button" class="ap-wiz-op-pill' + (i === 0 ? ' ap-wiz-op-pill-active' : '') + '" data-op="' + o.v + '" onclick="apWizSelectOperator(\'' + o.v + '\')">' + _apOperatorLabel(o.v) + '</button>';
    }).join('');
  }
  AP.operator = ops[0].v;
  var valInp = document.getElementById('apWizValue');
  var valSel = document.getElementById('apWizValueStatus');
  if (valInp) { valInp.style.display = isStatus ? 'none' : ''; valInp.value = ''; }
  if (valSel) valSel.style.display = isStatus ? '' : 'none';
  var detail = document.getElementById('apWizConditionDetail');
  if (detail) {
    var oldErr = detail.querySelector('.ap-wiz-inline-err'); if (oldErr) oldErr.remove();
    detail.style.display = 'flex';
    detail.classList.add('ap-wiz-step-entering');
    requestAnimationFrame(function() { requestAnimationFrame(function() { detail.classList.remove('ap-wiz-step-entering'); }); });
  }
};
window.apWizSelectOperator = function(op) {
  AP.operator = op;
  document.querySelectorAll('#apWizOpPills .ap-wiz-op-pill').forEach(function(p) {
    p.classList.toggle('ap-wiz-op-pill-active', p.getAttribute('data-op') === op);
  });
};
window.apWizUpdateConditionPreview = function() {
  var detail = document.getElementById('apWizConditionDetail');
  var errEl = detail && detail.querySelector('.ap-wiz-inline-err');
  if (errEl) errEl.remove();
};
window.apWizConfirmCondition = function() {
  var isStatus = AP.metric === 'status';
  var value = isStatus ? (document.getElementById('apWizValueStatus') || {}).value : parseFloat((document.getElementById('apWizValue') || {}).value);
  if (!isStatus && isNaN(value)) { apWizShowStepError('apWizConditionDetail', _apT('apErrNumeric', 'Enter a numeric value (e.g. 4.0), not text.')); return; }
  AP.value = value;
  var metricLabel = _apMetricLabel(AP.metric);
  var opLabel = _apOperatorLabel(AP.operator);
  var recap = metricLabel + ' ' + opLabel + ' ' + value;
  setTimeout(function() {
    _apWizCollapseAndAdvance(3, recap, 4);
    apWizRenderActionCards();
  }, 100);
};

// ── Step 4 — Action ────────────────────────────────────────────────
function apWizRenderActionCards() {
  var el = document.getElementById('apWizActionCards');
  if (!el) return;
  var allowed = AP_ACTIONS.filter(function(a) { return !(a.budgetOnly && AP_BUDGET_UNSUPPORTED_PLATFORMS.indexOf(AP.platform) !== -1); });
  var disabled = AP_ACTIONS.filter(function(a) { return a.budgetOnly && AP_BUDGET_UNSUPPORTED_PLATFORMS.indexOf(AP.platform) !== -1; });
  el.innerHTML = allowed.map(function(a) {
    return '<button type="button" class="ap-wiz-card' + (AP.action === a.v ? ' ap-wiz-card-selected' : '') + '" data-action="' + a.v + '" onclick="apWizSelectAction(\'' + a.v + '\')">' +
      '<span class="ap-wiz-card-title">' + _apActionLabel(a.v) + '</span>' +
      '<span class="ap-wiz-card-desc">' + _apActionDesc(a.v) + '</span>' +
    '</button>';
  }).join('') + disabled.map(function(a) {
    return '<div class="ap-wiz-card ap-wiz-card-disabled" title="Not available on ' + AP_PLAT_LABELS[AP.platform] + ' yet">' +
      '<span class="ap-wiz-card-title">' + _apActionLabel(a.v) + '</span>' +
      '<span class="ap-wiz-card-desc">Not available on ' + AP_PLAT_LABELS[AP.platform] + '</span>' +
    '</div>';
  }).join('');
  var detail = document.getElementById('apWizActionDetail'); if (detail && !AP.action) detail.style.display = 'none';
}
window.apWizSelectAction = function(action) {
  AP.action = action;
  document.querySelectorAll('#apWizActionCards .ap-wiz-card:not(.ap-wiz-card-disabled)').forEach(function(c) {
    c.classList.toggle('ap-wiz-card-selected', c.getAttribute('data-action') === action);
  });
  var needsPercent = action === 'increase_budget' || action === 'decrease_budget';
  var detail = document.getElementById('apWizActionDetail');
  if (needsPercent) {
    if (detail) {
      detail.style.display = 'flex';
      detail.classList.add('ap-wiz-step-entering');
      requestAnimationFrame(function() { requestAnimationFrame(function() { detail.classList.remove('ap-wiz-step-entering'); }); });
    }
    var pctEl = document.getElementById('apWizPercent'); if (pctEl) pctEl.value = AP.percent || 15;
  } else {
    if (detail) detail.style.display = 'none';
    AP.percent = null;
    var actionLabel = _apActionLabel(action);
    setTimeout(function() { _apWizCollapseAndAdvance(4, actionLabel, 5); apWizRenderReview(); }, 200);
  }
};
window.apWizConfirmAction = function() {
  var pct = parseFloat((document.getElementById('apWizPercent') || {}).value);
  if (isNaN(pct) || pct <= 0 || pct > 100) { apWizShowStepError('apWizActionDetail', _apT('apErrPercent', 'Enter a percentage between 1 and 100.')); return; }
  AP.percent = pct;
  var actionLabel = _apActionLabel(AP.action) + ' ' + _apT('apByLabel','by') + ' ' + pct + '%';
  setTimeout(function() { _apWizCollapseAndAdvance(4, actionLabel, 5); apWizRenderReview(); }, 100);
};

// ── Step 5 — Review ────────────────────────────────────────────────
function _apRuleSentenceParts() {
  var campaignPhrase = AP.campaignId === 'all' ? _apT('apReviewAllCampaignsOf','all your') + ' ' + (AP_PLAT_LABELS[AP.platform] || '') + ' ' + _apT('apReviewCampaignsPlural','campaigns') : '"' + AP.campaignName + '"';
  var metricLabel = _apMetricLabel(AP.metric);
  var opPhrase = AP.metric === 'status' ? _apT('apReviewIs','is') : _apOperatorLabel(AP.operator);
  var actionLabel = _apActionLabel(AP.action).toLowerCase();
  var actionPhrase = (AP.action === 'increase_budget' || AP.action === 'decrease_budget') ? actionLabel + ' ' + _apT('apByLabel','by') + ' <strong>' + AP.percent + '%</strong>' : '<strong>' + actionLabel + '</strong>';
  return { campaignPhrase: campaignPhrase, metricLabel: metricLabel, opPhrase: opPhrase, actionPhrase: actionPhrase };
}
function apWizRenderReview() {
  var textEl = document.getElementById('apWizReviewText');
  if (!textEl) return;
  var p = _apRuleSentenceParts();
  var modeNote = AP.mode === 'fully_automatic' ? _apT('apReviewModeFullyAuto', " I'll do this automatically — you'll be notified after.") :
                 AP.mode === 'suggest_only' ? _apT('apReviewModeSuggest', " I'll just flag it as a suggestion, no action taken.") :
                 _apT('apReviewModeApproval', " I'll ask for your approval first.");
  textEl.innerHTML = _apT('apReviewIllMonitor', "I'll monitor") + ' ' + _apOpEsc(p.campaignPhrase) + '. ' + _apT('apReviewWhenever','Whenever') + ' <strong>' + _apOpEsc(p.metricLabel) + '</strong> ' + _apOpEsc(p.opPhrase) + ' <strong>' + _apOpEsc(String(AP.value)) + '</strong>' + _apT('apReviewIllComma',", I'll") + ' ' + p.actionPhrase + '.' + _apOpEsc(modeNote);
  apWizRenderModeCards();
}
function apWizRenderModeCards() {
  var el = document.getElementById('apWizModeCards');
  if (!el) return;
  el.innerHTML = AP_MODE_DEFS.map(function(m) {
    return '<button type="button" class="ap-wiz-mode-card' + (AP.mode === m.v ? ' ap-wiz-mode-card-selected' : '') + '" data-mode="' + m.v + '" onclick="apWizSelectMode(\'' + m.v + '\')">' + _apModeLabel(m.v) + '</button>';
  }).join('');
}
window.apWizSelectMode = function(mode) {
  AP.mode = mode;
  document.querySelectorAll('#apWizModeCards .ap-wiz-mode-card').forEach(function(c) {
    c.classList.toggle('ap-wiz-mode-card-selected', c.getAttribute('data-mode') === mode);
  });
  apWizRenderReview();
};

// ── Save / Test — reuse the exact same backend calls as before ───────
function _apBReadForm() {
  return { metric: AP.metric, isStatus: AP.metric === 'status', operator: AP.operator, value: AP.value, action: AP.action, percent: AP.percent, campaignId: AP.campaignId, mode: AP.mode, name: ((document.getElementById('apBName') || {}).value || '').trim() };
}
function _apBValidate(f) {
  if (!f.metric || !f.operator || !f.action) return _apT('apErrIncomplete', 'Finish choosing a condition and an action first.');
  if (f.isStatus) { if (!f.value) return _apT('apErrChooseStatus', 'Choose Active or Paused.'); }
  else if (isNaN(f.value)) return _apT('apErrNumeric', 'Enter a numeric value for the condition (e.g. 4.0), not text.');
  if ((f.action === 'increase_budget' || f.action === 'decrease_budget')) {
    if (AP_BUDGET_UNSUPPORTED_PLATFORMS.indexOf(AP.platform) !== -1) return _apT('apErrBudgetUnsupported', 'Budget changes aren\'t available on') + ' ' + AP_PLAT_LABELS[AP.platform] + ' ' + _apT('apYetSuffix','yet') + '.';
    if (isNaN(f.percent) || f.percent <= 0 || f.percent > 100) return _apT('apErrPercent', 'Enter a budget change between 1% and 100%.');
  }
  return null;
}

window.apBTest = function() {
  if (!AP.editingRuleId) { var errEl0 = document.getElementById('apBError'); if (errEl0) { errEl0.textContent = _apT('apErrSaveFirst', 'Save the automation first, then Test it.'); errEl0.style.display = ''; } return; }
  var resEl = document.getElementById('apBTestResult');
  if (resEl) { resEl.style.display = ''; resEl.innerHTML = _apT('apTestingAgainstData', 'Testing against your real campaign data…'); }
  apiFetch('/api/autopilot/rules/' + AP.editingRuleId + '/test', { method: 'POST' }).then(function(res) {
    if (!res.ok || !res.data) { if (resEl) resEl.innerHTML = '<span style="color:#ef4444">' + _apOpEsc((res.data && res.data.error) || _apT('apErrTestFailed', 'Could not test this rule right now.')) + '</span>'; return; }
    var d = res.data;
    if (!resEl) return;
    resEl.innerHTML = d.wouldTrigger
      ? '<span style="color:var(--green-text)">' + _apT('apWouldTriggerNow', 'Would trigger right now') + '</span> — ' + d.matchingCampaigns.map(function(c) { return _apOpEsc(c.name) + ' (' + c.actual + ')'; }).join(', ') + '.'
      : _apT('apCheckedCampaignsPrefix', 'Checked') + ' ' + d.checkedCampaigns + ' ' + (d.checkedCampaigns === 1 ? _apT('apCampaignSingular','campaign') : _apT('apCampaignPlural','campaigns')) + ' — ' + _apT('apNoneMatchCondition', 'none currently meet this condition.');
  }).catch(function() { if (resEl) resEl.innerHTML = '<span style="color:#ef4444">' + _apT('apErrTestFailed', 'Could not test this rule right now.') + '</span>'; });
};

window.apBSave = function() {
  var f = _apBReadForm();
  var errEl = document.getElementById('apBError');
  var err = _apBValidate(f);
  if (err) { if (errEl) { errEl.textContent = err; errEl.style.display = ''; } return; }
  if (errEl) errEl.style.display = 'none';

  var actionParams = { campaign_id: f.campaignId, campaign_name: AP.campaignName, mode: f.mode };
  if (f.action === 'increase_budget' || f.action === 'decrease_budget') actionParams.percent = f.percent;

  var body = {
    name: f.name || (_apMetricLabel(f.metric) + ' ' + f.operator + ' ' + f.value + ' → ' + _apActionLabel(f.action)),
    trigger_metric: f.metric, trigger_operator: f.operator, trigger_value: f.isStatus ? f.value : Number(f.value),
    platform: AP.platform, action_type: f.action, action_params: actionParams
  };

  var saveBtn = document.getElementById('apBSaveBtn');
  if (saveBtn) saveBtn.disabled = true;
  var req = AP.editingRuleId
    ? apiFetch('/api/autopilot/rules/' + AP.editingRuleId, { method: 'PATCH', body: JSON.stringify(body) })
    : apiFetch('/api/autopilot/rules', { method: 'POST', body: JSON.stringify(body) });
  req.then(function(res) {
    if (!res.ok) { if (errEl) { errEl.textContent = (res.data && res.data.error) || _apT('apErrSaveFailed', 'Could not save that automation.'); errEl.style.display = ''; } return; }
    apWizStart();
    apActiveLoad();
    apCloseBuilder();
  }).catch(function() {
    if (errEl) { errEl.textContent = _apT('apErrSaveFailed', 'Could not save that automation.'); errEl.style.display = ''; }
  }).finally(function() { if (saveBtn) saveBtn.disabled = false; });
};

// ══ 2. Active Automations — narrative cards, not database records ════

var AP_EXAMPLE_AUTOMATIONS = [
  { labelKey: 'apExampleBudgetRoas', label: 'Increase budget when ROAS exceeds 4', platform: 'google', metric: 'roas', operator: '>', value: 4, action: 'increase_budget', percent: 15 },
  { labelKey: 'apExamplePauseNoConv', label: 'Pause campaigns with no conversions', platform: 'google', metric: 'conversions', operator: '==', value: 0, action: 'pause_campaign' },
  { labelKey: 'apExampleDailyBriefing', label: 'Generate a daily briefing', platform: 'google', metric: 'spend', operator: '>', value: 0, action: 'create_briefing' },
  { labelKey: 'apExampleNotifyCtr', label: 'Notify me when CTR drops', platform: 'meta', metric: 'ctr', operator: '<', value: 1, action: 'notify' }
];

function apActiveLoad() {
  var el = document.getElementById('apActiveList');
  if (!el || typeof apiFetch !== 'function') return;
  el.innerHTML = '<div class="ov3-brief-loading"><div class="orv-ai-thinking-dots"><span></span><span></span><span></span></div></div>';
  apiFetch('/api/autopilot/rules').then(function(res) {
    var items = (res.ok && res.data && res.data.rules) || [];
    window._apRules = items;
    el.innerHTML = items.length ? items.map(_apActiveCard).join('') : _apEmptyActiveState();
    var activeCount = items.filter(function(r) { return r.enabled; }).length;
    var countEl = document.getElementById('apActiveCount');
    if (countEl) countEl.textContent = items.length ? (activeCount + ' ACTIVE') : '';
    var heroFact = document.getElementById('apHeroActiveFact');
    if (heroFact) {
      if (activeCount) { heroFact.textContent = activeCount + ' automation' + (activeCount === 1 ? '' : 's') + ' active'; heroFact.style.display = ''; }
      else heroFact.style.display = 'none';
    }
    _apPlayCardStagger('apActiveList');
  }).catch(function() { el.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">' + _apT('apErrLoadActiveFailed', 'Could not load your automations.') + '</span>'; });
}

function _apEmptyActiveState() {
  var cards = AP_EXAMPLE_AUTOMATIONS.map(function(ex, i) {
    return '<button type="button" class="ap-wiz-card" onclick="apPrefillExample(' + i + ')" style="max-width:none;flex:1 1 220px">' +
      '<span class="ap-wiz-card-title">' + _apOpEsc(_apT(ex.labelKey, ex.label)) + '</span>' +
    '</button>';
  }).join('');
  return '<div class="ap-empty-text">' + _apT('apEmptyActiveText', "You haven't created any automations yet. Let's automate the repetitive work together.") + '</div>' +
    '<div class="ap-wiz-cards" style="margin-top:14px">' + cards + '</div>';
}

window.apPrefillExample = function(i) {
  var ex = AP_EXAMPLE_AUTOMATIONS[i];
  if (!ex) return;
  apOpenBuilder(); // the wizard now lives in a modal — open it first, then prefill exactly as before
  apWizStart();
  setTimeout(function() { apWizSelectPlatform(ex.platform); }, 60);
  setTimeout(function() { apWizSelectCampaign('all'); }, 320);
  setTimeout(function() {
    apWizSelectMetric(ex.metric);
    setTimeout(function() {
      apWizSelectOperator(ex.operator);
      var valInp = document.getElementById('apWizValue'); if (valInp) valInp.value = ex.value;
      var valSel = document.getElementById('apWizValueStatus'); if (valSel && ex.metric === 'status') valSel.value = ex.value;
      apWizConfirmCondition();
    }, 60);
  }, 650);
  setTimeout(function() {
    apWizSelectAction(ex.action);
    if (ex.percent) {
      setTimeout(function() {
        var pctEl = document.getElementById('apWizPercent'); if (pctEl) pctEl.value = ex.percent;
        apWizConfirmAction();
      }, 60);
    }
  }, 1050);
};

function _apRelativeDate(iso) {
  var d = new Date(iso), now = new Date();
  var diffDays = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (diffDays === 0) return _apT('dateToday', 'Today');
  if (diffDays === 1) return _apT('dateYesterday', 'Yesterday');
  if (diffDays < 7) return diffDays + ' ' + _apT('dateDaysAgoSuffix', 'days ago');
  var _locale = { en:'en-GB', fr:'fr-FR', nl:'nl-NL', es:'es-ES', pt:'pt-PT', de:'de-DE' }[(typeof CURRENT_LANG!=='undefined'&&CURRENT_LANG)||'en'] || 'en-GB';
  return d.toLocaleDateString(_locale, { day: 'numeric', month: 'short' });
}

function _apRuleSentence(rule) {
  var ap = rule.action_params || {};
  var campaignPhrase = (!ap.campaign_id || ap.campaign_id === 'all') ? _apT('apReviewAllCampaignsOf','all your') + ' ' + (AP_PLAT_LABELS[rule.platform] || '') + ' ' + _apT('apReviewCampaignsPlural','campaigns') : '"' + (ap.campaign_name || '') + '"';
  var metricLabel = _apMetricLabel(rule.trigger_metric);
  var opPhrase = rule.trigger_metric === 'status' ? _apT('apReviewIs','is') : _apOperatorLabel(rule.trigger_operator);
  var actionLabel = _apActionLabel(rule.action_type).toLowerCase();
  var actionPhrase = (rule.action_type === 'increase_budget' || rule.action_type === 'decrease_budget') ? actionLabel + ' ' + _apT('apByLabel','by') + ' ' + (ap.percent || 15) + '%' : actionLabel;
  return _apT('apRuleSentenceWhen','When') + ' ' + metricLabel + ' (' + campaignPhrase + ') ' + opPhrase + ' ' + rule.trigger_value + _apT('apRuleSentenceOrivenWill',', Oriven will') + ' ' + actionPhrase + '.';
}

/* Status is derived entirely from real fields — r.enabled (real column) and
   a cross-reference against real, already-fetched Autopilot Activity items
   for a "...failed to execute" title matching this rule's name (the exact
   string _execRuleAction (server.js) writes on a genuine execution
   failure). Never invented: a rule with no matching failure event in real
   history is simply "active", never guessed at "needs approval" unless its
   own action_params.mode says so. */
function _apRuleStatusInfo(r) {
  if (!r.enabled) return { key: 'paused', label: 'PAUSED', cls: 'ap-status-paused' };
  var failed = (AP.historyItems || []).some(function(i) { return i.title && r.name && i.title.indexOf(r.name) !== -1 && /failed/i.test(i.title); });
  if (failed) return { key: 'failed', label: 'ACTION FAILED', cls: 'ap-status-failed' };
  var mode = (r.action_params || {}).mode;
  if (mode === 'require_approval') return { key: 'approval', label: 'NEEDS APPROVAL', cls: 'ap-status-approval' };
  return { key: 'active', label: 'ACTIVE', cls: 'ap-status-active' };
}
function _apActiveCard(r) {
  var lastRun = r.last_triggered_at ? _apRelativeDate(r.last_triggered_at) : _apT('apNeverRun', 'Never');
  var ap = r.action_params || {};
  var status = _apRuleStatusInfo(r);
  var metricLabel = _apMetricLabel(r.trigger_metric);
  var triggerText = r.trigger_metric === 'status' ? (metricLabel + ' is ' + r.trigger_value) : (metricLabel + ' ' + _apOperatorLabel(r.trigger_operator) + ' ' + r.trigger_value);
  var actionLabel = _apActionLabel(r.action_type);
  var actionText = (r.action_type === 'increase_budget' || r.action_type === 'decrease_budget') ? actionLabel + ' ' + (ap.percent || 15) + '%' : actionLabel;
  return '<div class="ap-auto-card">' +
    '<div class="ap-auto-top">' +
      '<span class="ap-auto-icon">⚡</span>' +
      '<span class="ap-auto-title">' + _apOpEsc(r.name) + '</span>' +
    '</div>' +
    '<div class="ap-auto-meta">' + _apOpEsc(AP_PLAT_LABELS[r.platform] || '') + ' · ' + _apOpEsc(ap.campaign_name || _apT('apAllCampaigns', 'All Campaigns')) + '</div>' +
    '<div class="ap-auto-flow">' +
      '<span class="ap-auto-flow-trigger">' + _apOpEsc(triggerText) + '</span>' +
      '<span class="ap-auto-flow-arrow">→</span>' +
      '<span class="ap-auto-flow-action">' + _apOpEsc(actionText) + '</span>' +
    '</div>' +
    '<div class="ap-auto-foot">' +
      '<span class="ap-auto-status ' + status.cls + '"><span class="ap-auto-status-dot"></span>' + status.label + '</span>' +
      '<span class="ap-auto-lastrun">' + _apT('apLastExecutedPrefix', 'Last executed:') + ' ' + _apOpEsc(lastRun) + '</span>' +
      '<label class="ap-auto-toggle" title="' + (r.enabled ? _apT('apDisableBtn', 'Disable') : _apT('apEnableBtn', 'Enable')) + '">' +
        '<input type="checkbox"' + (r.enabled ? ' checked' : '') + ' onchange="apActiveToggle(\'' + r.id + '\', this.checked)">' +
        '<span class="ap-auto-toggle-track"><span class="ap-auto-toggle-thumb"></span></span>' +
      '</label>' +
      '<button class="oi-why-toggle" onclick="apActiveEdit(\'' + r.id + '\')">' + _apT('edit', 'Edit') + '</button>' +
      '<button class="oi-why-toggle" onclick="apActiveDelete(\'' + r.id + '\')">' + _apT('apDeleteBtn', 'Delete') + '</button>' +
    '</div>' +
  '</div>';
}

window.apActiveToggle = function(id, enabled) {
  if (typeof apiFetch !== 'function') return;
  apiFetch('/api/autopilot/rules/' + id, { method: 'PATCH', body: JSON.stringify({ enabled: enabled }) }).then(function() { apActiveLoad(); }).catch(function() {});
};
window.apActiveDelete = function(id) {
  if (typeof apiFetch !== 'function') return;
  apiFetch('/api/autopilot/rules/' + id, { method: 'DELETE' }).then(function() { apActiveLoad(); if (AP.editingRuleId === id) apWizStart(); }).catch(function() {});
};
window.apActiveEdit = function(id) {
  if (typeof apiFetch !== 'function') return;
  apOpenBuilder(); // the wizard now lives in a modal — open it immediately, content fills in once the fetch below resolves
  apiFetch('/api/autopilot/rules').then(function(res) {
    var rule = ((res.ok && res.data && res.data.rules) || []).filter(function(r) { return r.id === id; })[0];
    if (!rule) return;
    var ap = rule.action_params || {};
    AP.editingRuleId = id;
    AP.platform = rule.platform || 'google';
    AP.metric = rule.trigger_metric;
    AP.operator = rule.trigger_operator;
    AP.value = rule.trigger_metric === 'status' ? rule.trigger_value : Number(rule.trigger_value);
    AP.action = rule.action_type;
    AP.percent = ap.percent || 15;
    AP.mode = ap.mode || 'require_approval';
    AP.campaignId = ap.campaign_id || 'all';
    AP.campaignName = ap.campaign_name || _apT('apAllCampaigns','All Campaigns');

    var path = AP.platform === 'google' ? '/api/google-ads/campaigns' : AP.platform === 'meta' ? '/api/meta/campaigns' : '/api/tiktok/campaigns';
    apiFetch(path).then(function(cRes) {
      var items = (cRes.ok && cRes.data && cRes.data.campaigns) || [];
      AP.campaigns = items.map(function(c) { return { id: String(c.campaign_id != null ? c.campaign_id : c.id), name: c.campaign_name || c.name || 'Unnamed' }; });

      _apWizSetRecap(1, AP_PLAT_LABELS[AP.platform]);
      _apWizSetRecap(2, AP.campaignName);
      var metricLabel = AP_METRIC_LABELS[AP.metric] || AP.metric;
      var opLabel = (AP_OPERATORS.filter(function(o) { return o.v === AP.operator; })[0] || {}).l || AP.operator;
      _apWizSetRecap(3, metricLabel + ' ' + opLabel + ' ' + AP.value);
      var actionLabel = AP_ACTION_LABELS[AP.action] || AP.action;
      _apWizSetRecap(4, actionLabel + (AP.percent && (AP.action === 'increase_budget' || AP.action === 'decrease_budget') ? ' by ' + AP.percent + '%' : ''));

      for (var n = 1; n <= 4; n++) { var s = document.getElementById('apWizStep' + n); if (s) s.style.display = 'none'; }
      var step5 = document.getElementById('apWizStep5'); if (step5) step5.style.display = '';
      AP.step = 5;
      apWizRenderReview();

      var saveBtn = document.getElementById('apBSaveBtn'); if (saveBtn) saveBtn.textContent = 'Save Changes';
      var nameEl = document.getElementById('apBName'); if (nameEl) nameEl.value = rule.name || '';
      var testResult = document.getElementById('apBTestResult'); if (testResult) testResult.style.display = 'none';
    });
  }).catch(function() {});
};
function _apWizSetRecap(n, val) {
  var recap = document.getElementById('apWizRecap' + n);
  if (!recap) return;
  var valEl = recap.querySelector('.ap-wiz-recap-val');
  if (valEl) valEl.textContent = val;
  recap.style.display = 'flex';
}

// ══ 3. Automation History — grouped by day, icon-led, plus pending
// approvals (still part of an automation's real lifecycle) ══════════

var _apHistTimer = null;
window.apHistSearch = function(q) {
  clearTimeout(_apHistTimer);
  _apHistTimer = setTimeout(function() { apHistLoad(q); }, 250);
};

window._apActivityCat = window._apActivityCat || 'all';

// Client-side keyword pass over the already-fetched real items — same
// pattern _apDetectSuggestions already uses elsewhere in this file. Not a
// new endpoint; just narrows what's already on screen.
function _apActivityMatchesCat(title, cat) {
  if (cat === 'all') return true;
  var t = (title || '').toLowerCase();
  if (cat === 'budget') return /budget/.test(t);
  if (cat === 'campaigns') return /campaign|pause|resum/.test(t);
  if (cat === 'alerts') return /notify|alert|failed|ctr|threshold/.test(t);
  return true;
}
function _apRenderHistoryList() {
  var el = document.getElementById('apHistoryList');
  if (!el) return;
  var pending = window._apPendingApprovals || [];
  var items = (AP.historyItems || []).filter(function(i) { return _apActivityMatchesCat(i.title, window._apActivityCat); });
  var html = '';
  if (pending.length) html += '<div class="ap-hist-daygroup"><div class="ap-hist-daylbl">' + _apT('apAwaitingYourApproval', 'Awaiting your approval') + '</div>' + pending.map(_apHistPendingCard).join('') + '</div>';
  if (items.length) html += _apHistGrouped(items);
  el.innerHTML = html || '<span class="ov3-insight" style="color:var(--muted)">' + (window._apActivityCat !== 'all' ? 'No activity in this category.' : _apT('apEmptyHistoryText', 'No automation activity yet.')) + '</span>';
  _apPlayCardStagger('apHistoryList');
}
window.apFilterActivity = function(cat, btn) {
  window._apActivityCat = cat;
  document.querySelectorAll('#apActivityFilters .ap-af-pill').forEach(function(p) { p.classList.remove('ap-af-pill-active'); });
  var target = btn || document.querySelector('#apActivityFilters .ap-af-pill[data-cat="' + cat + '"]');
  if (target) target.classList.add('ap-af-pill-active');
  _apRenderHistoryList();
};

function apHistLoad(q) {
  var el = document.getElementById('apHistoryList');
  if (!el || typeof apiFetch !== 'function') return;
  el.innerHTML = '<div class="ov3-brief-loading"><div class="orv-ai-thinking-dots"><span></span><span></span><span></span></div></div>';
  var query = q ? ('?q=' + encodeURIComponent(q)) : '';
  Promise.all([
    apiFetch('/api/autopilot/recommendations?status=suggested'),
    apiFetch('/api/autopilot/history' + query)
  ]).then(function(results) {
    window._apPendingApprovals = (results[0].ok && results[0].data && results[0].data.recommendations) || [];
    var items = (results[1].ok && results[1].data && results[1].data.items) || [];
    AP.historyItems = items;
    _apRenderHistoryList();
    apSuggestionsRender(items);
    // Active Automations' "ACTION FAILED" status cross-references real
    // history for this rule's name — apActiveLoad() and apHistLoad() run
    // concurrently from apInit, so history can resolve after the active
    // cards already rendered with stale (pre-history) status. Re-render
    // from the already-cached rule list (no new fetch) once history is in.
    if (window._apRules && window._apRules.length) {
      var activeEl = document.getElementById('apActiveList');
      if (activeEl) { activeEl.innerHTML = window._apRules.map(_apActiveCard).join(''); _apPlayCardStagger('apActiveList'); }
    }
  }).catch(function() { el.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">' + _apT('apErrLoadHistoryFailed','Could not load history.') + '</span>'; });
}

function _apHistGrouped(items) {
  var groups = {}, order = [];
  items.slice(0, 40).forEach(function(i) {
    var label = i.created_at ? _apRelativeDate(i.created_at) : _apT('apDateEarlier','Earlier');
    if (!groups[label]) { groups[label] = []; order.push(label); }
    groups[label].push(i);
  });
  return order.map(function(label) {
    return '<div class="ap-hist-daygroup"><div class="ap-hist-daylbl"><span class="ap-hist-daydot"></span>' + _apOpEsc(label.toUpperCase()) + '</div>' + groups[label].map(_apHistCard).join('') + '</div>';
  }).join('');
}
function _apHistStatusCls(status, title) {
  if (status === 'failed' || status === 'rejected' || /failed/i.test(title || '')) return 'ap-hist-dot-failed';
  if (status === 'executed' || status === 'done' || status === 'completed' || status === 'approved') return 'ap-hist-dot-done';
  return 'ap-hist-dot-neutral';
}
function _apHistCard(i) {
  var time = i.created_at ? new Date(i.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
  return '<div class="ap-hist-row">' +
    '<span class="ap-hist-dot ' + _apHistStatusCls(i.status, i.title) + '"></span>' +
    '<span class="ap-hist-title">' + _apOpEsc(i.title) + '</span>' +
    '<span class="ap-hist-time">' + _apOpEsc(time) + '</span>' +
  '</div>';
}
function _apHistPendingCard(r) {
  return '<div class="oi-card">' +
    '<div class="oi-card-top"><div class="oi-card-title">' + _apOpEsc(r.problem) + '</div>' +
      '<span class="clib-status-pill clib-status-awaiting-approval">' + _apT('apAwaitingApproval','Awaiting approval') + '</span></div>' +
    (r.suggested_action ? '<div class="oi-card-impact">' + _apOpEsc(r.suggested_action) + '</div>' : '') +
    '<div class="oi-card-actions">' +
      '<button class="oi-card-btn oi-card-btn-primary" onclick="apHistApprove(\'' + r.id + '\')">' + _apT('apApproveBtn','Approve') + '</button>' +
      '<button class="oi-why-toggle" onclick="apHistReject(\'' + r.id + '\')">' + _apT('apRejectBtn','Reject') + '</button>' +
    '</div>' +
  '</div>';
}
window.apHistApprove = function(id) {
  if (typeof apiFetch !== 'function') return;
  apiFetch('/api/autopilot/recommendations/' + id + '/approve', { method: 'POST', body: JSON.stringify({ remember: false }) }).then(function() { apHistLoad(); apActiveLoad(); }).catch(function() {});
};
window.apHistReject = function(id) {
  if (typeof apiFetch !== 'function') return;
  apiFetch('/api/autopilot/recommendations/' + id + '/reject', { method: 'POST' }).then(function() { apHistLoad(); }).catch(function() {});
};

// ══ Suggested Automations — real pattern detection over the history
// already fetched above (never a new endpoint), never auto-creates
// anything, only pre-fills the builder on click. ════════════════════

function apSuggestionsRender(items) {
  var el = document.getElementById('apSuggestionsList');
  var section = document.getElementById('apSuggestionsSection');
  if (!el || !section) return;
  var suggestions = _apDetectSuggestions(items || []);
  if (!suggestions.length) { section.style.display = 'none'; return; }
  window._apSuggestions = suggestions;
  section.style.display = '';
  el.innerHTML = suggestions.map(function(s, i) {
    return '<div class="ap-suggestion-card">' +
      '<span class="ap-suggestion-emoji">🤖</span>' +
      '<div class="ap-suggestion-text">' + _apOpEsc(s.text) + '</div>' +
      '<button class="oi-card-btn oi-card-btn-primary" onclick="apPrefillSuggestion(' + i + ')">' + _apT('apSuggestSetupBtn','Set it up') + '</button>' +
    '</div>';
  }).join('');
}
function _apDetectSuggestions(items) {
  var out = [];
  var budgetChanges = items.filter(function(i) { return /budget/i.test(i.title || '') && (i.status === 'executed' || i.status === 'approved'); });
  if (budgetChanges.length >= 3) out.push({ text: "I noticed you've manually adjusted budgets " + budgetChanges.length + ' times recently. Want me to automate that when ROAS crosses a threshold?', example: { platform: 'google', metric: 'roas', operator: '>', value: 4, action: 'increase_budget', percent: 15 } });
  var briefings = items.filter(function(i) { return /briefing|report/i.test(i.title || ''); });
  if (briefings.length >= 3) out.push({ text: 'I noticed you generate reports or briefings often. Want me to schedule this automatically?', example: { platform: 'google', metric: 'spend', operator: '>', value: 0, action: 'create_briefing' } });
  var pauses = items.filter(function(i) { return /pause/i.test(i.title || ''); });
  if (pauses.length >= 3) out.push({ text: 'I noticed you often pause underperforming campaigns. Should I handle that automatically when conversions stay at zero?', example: { platform: 'google', metric: 'conversions', operator: '==', value: 0, action: 'pause_campaign' } });
  return out.slice(0, 3);
}
window.apPrefillSuggestion = function(i) {
  var s = (window._apSuggestions || [])[i];
  if (!s || !s.example) return;
  var idx = AP_EXAMPLE_AUTOMATIONS.length;
  AP_EXAMPLE_AUTOMATIONS[idx] = s.example;
  apPrefillExample(idx);
};

// ══ 4. Automation Settings — real per-browser preference (no backend
// settings table exists; a new one would need a DB migration, out of
// reach here). Each rule's own execution mode, chosen in the builder and
// stored in action_params.mode, is what the evaluator actually enforces —
// arguably finer-grained than one global switch anyway. ═════════════

var AP_SETTINGS_KEY = '_orv_autopilot_settings';
function _apSettingsRead() {
  var s = { defaultMode: 'require_approval', notify: 'on', briefTime: '08:00' };
  try { var raw = localStorage.getItem(AP_SETTINGS_KEY); if (raw) s = Object.assign(s, JSON.parse(raw)); } catch (_) {}
  return s;
}
function apSettingsLoad() {
  var s = _apSettingsRead();
  var modeEl = document.getElementById('apSetDefaultMode'); if (modeEl) modeEl.value = s.defaultMode;
  var notifyEl = document.getElementById('apSetNotify'); if (notifyEl) notifyEl.value = s.notify;
  var briefEl = document.getElementById('apSetBriefTime'); if (briefEl) briefEl.value = s.briefTime;
  var tzEl = document.getElementById('apSetTz');
  if (tzEl) { try { tzEl.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { tzEl.textContent = ''; } }
}
window.apSettingsSave = function() {
  var s = {
    defaultMode: (document.getElementById('apSetDefaultMode') || {}).value || 'require_approval',
    notify: (document.getElementById('apSetNotify') || {}).value || 'on',
    briefTime: (document.getElementById('apSetBriefTime') || {}).value || '08:00'
  };
  try { localStorage.setItem(AP_SETTINGS_KEY, JSON.stringify(s)); } catch (_) {}
};
