// ════════════════════════════════════════════════════════════════
// Autopilot Center (V9) — the operational center: health, pending
// approvals, tasks, automation rules, workflows, recent monitoring
// events, and history. Composed entirely from data already produced by
// the existing monitoring cron / Learning Engine / Recommendation Engine
// (server.js) — this file only renders it and wires the approve/reject/
// advance actions.
// ════════════════════════════════════════════════════════════════

function _apOpEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

(function() {
  var _prevNav = window.navigate;
  window.navigate = function(page) {
    if (typeof _prevNav === 'function') _prevNav.apply(this, arguments);
    if (page === 'autopilot' && typeof apOpInit === 'function') setTimeout(apOpInit, 0);
  };
})();

window.apOpInit = function() {
  apOpLoadHealth();
  apOpLoadApprovals();
  apOpLoadTasks();
  apOpLoadRules();
  apOpLoadWorkflows();
  apOpLoadEvents();
  apOpLoadHistory();
};

// ── Epic 1 — Health row (Marketing/Business/Creative/Campaign) ─────────
function apOpLoadHealth() {
  var el = document.getElementById('apOpHealthRow');
  if (!el || typeof apiFetch !== 'function') return;
  Promise.all([
    apiFetch('/api/business/health'),
    apiFetch('/api/intelligence/home'),
    apiFetch('/api/creative/assets?archived=all'),
    apiFetch('/api/autopilot/recommendations?status=suggested')
  ]).then(function(results) {
    var biz = (results[0].ok && results[0].data) ? results[0].data.overall : null;
    var mkt = (results[1].ok && results[1].data) ? results[1].data.healthScore : null;
    var assets = (results[2].ok && results[2].data) ? results[2].data.assets : [];
    var recs = (results[3].ok && results[3].data) ? results[3].data.recommendations : [];

    var approvedCount = assets.filter(function(a) { return a.status === 'approved' || a.status === 'published'; }).length;
    var creative = assets.length ? Math.round((approvedCount / assets.length) * 100) : null;
    var riskyOpen = recs.filter(function(r) { return r.risk === 'high' || r.risk === 'medium'; }).length;
    var campaign = Math.max(0, 100 - riskyOpen * 10);

    var cards = [['Marketing Health', mkt], ['Business Health', biz], ['Creative Health', creative], ['Campaign Health', campaign]];
    el.innerHTML = cards.map(function(c) {
      var val = c[1] == null ? 'n/a' : c[1];
      return '<div class="ov3-health-badge"><span class="ov3-health-num">' + val + (c[1] != null ? '<span class="ov3-health-max">/100</span>' : '') + '</span><span class="ov3-health-lbl">' + c[0] + '</span></div>';
    }).join('');
  }).catch(function() {});
}

// ── Epic 4/7 — Pending Approvals ────────────────────────────────────────
function apOpLoadApprovals() {
  var el = document.getElementById('apOpApprovals');
  if (!el || typeof apiFetch !== 'function') return;
  el.innerHTML = '<div class="ov3-brief-loading"><div class="orv-ai-thinking-dots"><span></span><span></span><span></span></div></div>';
  apiFetch('/api/autopilot/recommendations?status=suggested').then(function(res) {
    var items = (res.ok && res.data && res.data.recommendations) || [];
    if (!items.length) { el.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">Nothing needs your approval right now.</span>'; return; }
    el.innerHTML = items.map(_apOpRecCard).join('');
  }).catch(function() { el.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">Could not load approvals.</span>'; });
}

function _apOpRecCard(r) {
  var riskCls = r.risk === 'high' ? 'oi-sev-high' : r.risk === 'medium' ? 'oi-sev-med' : 'oi-sev-low';
  return '<div class="oi-card" style="gap:6px">' +
    '<div class="oi-card-top"><div class="oi-card-title" style="font-size:12.5px">' + _apOpEsc(r.problem) + '</div>' +
    '<span class="oi-badge ' + riskCls + '">' + _apOpEsc(r.risk) + ' risk</span></div>' +
    (r.business_reason ? '<div class="oi-card-desc">' + _apOpEsc(r.business_reason) + '</div>' : '') +
    '<div class="oi-card-badges"><span class="oi-badge oi-badge-conf">' + r.confidence + '% confidence</span></div>' +
    (r.suggested_action ? '<div class="oi-card-impact">' + _apOpEsc(r.suggested_action) + '</div>' : '') +
    '<div class="oi-card-actions">' +
      '<button class="oi-card-btn oi-card-btn-primary" onclick="apOpApprove(\'' + r.id + '\',false)">Approve</button>' +
      '<button class="oi-card-btn" onclick="apOpApprove(\'' + r.id + '\',true)">Approve &amp; Remember</button>' +
      '<button class="oi-why-toggle" onclick="apOpReject(\'' + r.id + '\')">Reject</button>' +
    '</div>' +
  '</div>';
}

window.apOpApprove = function(id, remember) {
  if (typeof apiFetch !== 'function') return;
  apiFetch('/api/autopilot/recommendations/' + id + '/approve', { method: 'POST', body: JSON.stringify({ remember: !!remember }) }).then(function() {
    apOpLoadApprovals(); apOpLoadHealth(); apOpLoadWorkflows();
  }).catch(function() {});
};

window.apOpReject = function(id) {
  if (typeof apiFetch !== 'function') return;
  apiFetch('/api/autopilot/recommendations/' + id + '/reject', { method: 'POST' }).then(function() { apOpLoadApprovals(); }).catch(function() {});
};

// ── Epic 8 — Tasks ───────────────────────────────────────────────────────
function apOpLoadTasks() {
  var el = document.getElementById('apOpTasks');
  if (!el || typeof apiFetch !== 'function') return;
  apiFetch('/api/autopilot/tasks').then(function(res) {
    var items = (res.ok && res.data && res.data.tasks) || [];
    if (!items.length) { el.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">No open tasks.</span>'; return; }
    el.innerHTML = items.map(function(t) {
      var deadline = t.deadline ? new Date(t.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
      var prCls = t.priority === 'high' ? 'oi-sev-high' : t.priority === 'medium' ? 'oi-sev-med' : 'oi-sev-low';
      return '<div class="oi-card" style="gap:4px">' +
        '<div class="oi-card-top"><div class="oi-card-title" style="font-size:12.5px">' + _apOpEsc(t.title) + '</div>' +
        '<span class="oi-badge ' + prCls + '">' + t.priority + '</span></div>' +
        '<div class="oi-card-desc">' + (deadline ? 'Due ' + deadline + ' · ' : '') + (t.estimated_minutes ? t.estimated_minutes + ' min' : '') + '</div>' +
        '<div class="oi-card-actions"><button class="oi-card-btn oi-card-btn-primary" onclick="apOpTaskDone(\'' + t.id + '\')">Mark done</button></div>' +
      '</div>';
    }).join('');
  }).catch(function() {});
}

window.apOpTaskDone = function(id) {
  if (typeof apiFetch !== 'function') return;
  apiFetch('/api/autopilot/tasks/' + id, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) }).then(function() { apOpLoadTasks(); }).catch(function() {});
};

// ── Epic 6 — Automation Rules ────────────────────────────────────────────
function apOpLoadRules() {
  var el = document.getElementById('apOpRules');
  if (!el || typeof apiFetch !== 'function') return;
  apiFetch('/api/autopilot/rules').then(function(res) {
    var items = (res.ok && res.data && res.data.rules) || [];
    if (!items.length) { el.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">No automation rules yet.</span>'; return; }
    el.innerHTML = items.map(function(r) {
      return '<div class="oi-card" style="gap:4px">' +
        '<div class="oi-card-top"><div class="oi-card-title" style="font-size:12.5px">' + _apOpEsc(r.name) + '</div>' +
        '<span class="clib-status-pill ' + (r.enabled ? 'clib-status-active' : 'clib-status-archived') + '">' + (r.enabled ? 'Enabled' : 'Disabled') + '</span></div>' +
        '<div class="oi-card-desc">IF ' + _apOpEsc(r.trigger_metric) + ' ' + _apOpEsc(r.trigger_operator) + ' ' + r.trigger_value + ' → ' + _apOpEsc(String(r.action_type).replace(/_/g, ' ')) + '</div>' +
        '<div class="oi-card-actions">' +
          '<button class="oi-why-toggle" onclick="apOpToggleRule(\'' + r.id + '\',' + (!r.enabled) + ')">' + (r.enabled ? 'Disable' : 'Enable') + '</button>' +
          '<button class="oi-why-toggle" onclick="apOpDeleteRule(\'' + r.id + '\')">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }).catch(function() {});
}

window.apOpToggleRule = function(id, enabled) {
  if (typeof apiFetch !== 'function') return;
  apiFetch('/api/autopilot/rules/' + id, { method: 'PATCH', body: JSON.stringify({ enabled: enabled }) }).then(function() { apOpLoadRules(); }).catch(function() {});
};

window.apOpDeleteRule = function(id) {
  if (typeof apiFetch !== 'function') return;
  apiFetch('/api/autopilot/rules/' + id, { method: 'DELETE' }).then(function() { apOpLoadRules(); }).catch(function() {});
};

window.apOpNewRule = function() {
  var overlay = document.getElementById('apOpRuleOverlay');
  if (overlay) overlay.style.display = '';
};

window.apOpCloseRule = function() {
  var overlay = document.getElementById('apOpRuleOverlay');
  if (overlay) overlay.style.display = 'none';
};

window.apOpSaveRule = function() {
  var name = (document.getElementById('apOpRuleName') || {}).value;
  var metric = (document.getElementById('apOpRuleMetric') || {}).value;
  var operator = (document.getElementById('apOpRuleOperator') || {}).value;
  var value = parseFloat((document.getElementById('apOpRuleValue') || {}).value);
  var action = (document.getElementById('apOpRuleAction') || {}).value;
  if (!name || !name.trim() || isNaN(value) || typeof apiFetch !== 'function') return;
  apiFetch('/api/autopilot/rules', {
    method: 'POST',
    body: JSON.stringify({ name: name.trim(), trigger_metric: metric, trigger_operator: operator, trigger_value: value, action_type: action })
  }).then(function() {
    window.apOpCloseRule();
    apOpLoadRules();
  }).catch(function() {});
};

// ── Epic 9 — Workflows ───────────────────────────────────────────────────
function apOpLoadWorkflows() {
  var el = document.getElementById('apOpWorkflows');
  if (!el || typeof apiFetch !== 'function') return;
  apiFetch('/api/autopilot/workflows').then(function(res) {
    var items = (res.ok && res.data && res.data.workflows) || [];
    if (!items.length) { el.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">No workflows running.</span>'; return; }
    el.innerHTML = items.map(function(w) {
      var pct = w.steps && w.steps.length ? Math.round((w.current_step / w.steps.length) * 100) : 0;
      var statusCls = 'clib-status-' + String(w.status).replace(/_/g, '-');
      return '<div class="oi-card" style="gap:4px">' +
        '<div class="oi-card-top"><div class="oi-card-title" style="font-size:12.5px">' + _apOpEsc(w.name) + '</div>' +
        '<span class="clib-status-pill ' + statusCls + '">' + _apOpEsc(String(w.status).replace(/_/g, ' ')) + '</span></div>' +
        '<div class="oi-card-desc">Step ' + w.current_step + ' of ' + (w.steps ? w.steps.length : 0) + ' (' + pct + '%)</div>' +
        (w.status === 'running' ? '<div class="oi-card-actions"><button class="oi-card-btn oi-card-btn-primary" onclick="apOpAdvanceWorkflow(\'' + w.id + '\')">Advance</button></div>' : '') +
      '</div>';
    }).join('');
  }).catch(function() {});
}

window.apOpAdvanceWorkflow = function(id) {
  if (typeof apiFetch !== 'function') return;
  apiFetch('/api/autopilot/workflows/' + id + '/advance', { method: 'POST' }).then(function() {
    apOpLoadWorkflows(); apOpLoadApprovals();
  }).catch(function() {});
};

window.apOpStartWorkflow = function(name) {
  if (typeof apiFetch !== 'function' || !name) return;
  apiFetch('/api/autopilot/workflows', { method: 'POST', body: JSON.stringify({ name: name, template: 'winning_campaign_refresh' }) }).then(function() {
    apOpLoadWorkflows();
  }).catch(function() {});
};

// ── Epic 2/3 — Recent Monitoring Events ─────────────────────────────────
function apOpLoadEvents() {
  var el = document.getElementById('apOpEvents');
  if (!el || typeof apiFetch !== 'function') return;
  apiFetch('/api/intelligence/events?days=3').then(function(res) {
    var items = (res.ok && res.data && res.data.events) || [];
    if (!items.length) { el.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">No recent monitoring events.</span>'; return; }
    el.innerHTML = items.slice(0, 10).map(function(e) {
      return '<div class="oi-card" style="gap:2px;padding:8px 10px"><div class="oi-card-title" style="font-size:12px">' + _apOpEsc(e.title) + '</div>' +
        (e.detail ? '<div class="oi-card-desc" style="font-size:11px">' + _apOpEsc(e.detail) + '</div>' : '') + '</div>';
    }).join('');
  }).catch(function() {});
}

// ── Epic 12 — History ────────────────────────────────────────────────────
var _apOpHistTimer = null;
window.apOpSearchHistory = function(q) {
  clearTimeout(_apOpHistTimer);
  _apOpHistTimer = setTimeout(function() { apOpLoadHistory(q); }, 250);
};

function apOpLoadHistory(q) {
  var el = document.getElementById('apOpHistory');
  if (!el || typeof apiFetch !== 'function') return;
  var query = q ? ('?q=' + encodeURIComponent(q)) : '';
  apiFetch('/api/autopilot/history' + query).then(function(res) {
    var items = (res.ok && res.data && res.data.items) || [];
    if (!items.length) { el.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">No history yet.</span>'; return; }
    el.innerHTML = items.slice(0, 20).map(function(i) {
      return '<div class="oi-card" style="gap:2px;padding:8px 10px"><div class="oi-card-top"><div class="oi-card-title" style="font-size:12px">' + _apOpEsc(i.title) + '</div>' +
        '<span class="clib-status-pill clib-status-' + String(i.status).replace(/_/g, '-') + '">' + _apOpEsc(i.status) + '</span></div></div>';
    }).join('');
  }).catch(function() {});
}
