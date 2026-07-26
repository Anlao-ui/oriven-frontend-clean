// ════════════════════════════════════════════════════════════════
// Creative Workspace (V8 Phase 2) — three-column creative suite:
// Business Brain/Product/Platform/History (left), creative canvas +
// versions (center), Live Preview/Score/Director (right), persistent
// Ask Oriven dock (bottom). Consumes the Creative Engine routes built
// in V8 Phase 1/2 — no generation logic lives here, only presentation.
// ════════════════════════════════════════════════════════════════

var CRWS = {
  product: '',
  platform: 'google',
  device: 'desktop',
  currentAsset: null,
  historyItems: [],
  chatHistory: []
};

function _crwsEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Mirrors server.js's _extractTextFromContent closely enough for client-side
// "what text am I improving/previewing" purposes — not the scoring source of
// truth (that's computed server-side from the real stored content).
function _crwsExtractText(content) {
  var parts = [];
  (function walk(v) {
    if (v == null) return;
    if (typeof v === 'string') { if (v.length < 2000) parts.push(v); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') { Object.keys(v).forEach(function(k) { if (k !== 'url' && k !== 'html') walk(v[k]); }); }
  })(content);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// ── Init — wired via a navigate() wrapper, same layered-interception
// pattern every other feature file in this app already uses. ──────────
(function() {
  var _prevNav = window.navigate;
  window.navigate = function(page) {
    if (typeof _prevNav === 'function') _prevNav.apply(this, arguments);
    if (page === 'creative-workspace' && typeof crwsInit === 'function') setTimeout(crwsInit, 0);
  };
})();

window.crwsInit = function() {
  crwsLoadBrainSummary();
  crwsLoadProducts();
  crwsLoadHistory();
  if (!CRWS.chatHistory.length) {
    var feed = document.getElementById('crwsChatFeed');
    if (feed && !feed.children.length) {
      feed.innerHTML = '<div class="orv-ai-msg orv-ai-msg-ai"><div class="orv-ai-msg-bubble">Ask me to improve, compare, or explain anything in this workspace.</div></div>';
    }
  }
};

function crwsLoadBrainSummary() {
  var el = document.getElementById('crwsBrainSummary');
  if (!el || typeof apiFetch !== 'function') return;
  apiFetch('/api/business/health').then(function(res) {
    if (!res.ok || !res.data) { el.textContent = 'Could not load Business Brain.'; return; }
    var d = res.data;
    el.innerHTML = '<div class="ov3-health-badge" style="padding:8px 10px"><span class="ov3-health-num" style="font-size:20px">' + d.overall + '<span class="ov3-health-max">/100</span></span><span class="ov3-health-lbl">Knowledge Completeness</span></div>';
  }).catch(function() { el.textContent = 'Could not load Business Brain.'; });
}

function crwsLoadProducts() {
  var sel = document.getElementById('crwsProductSelect');
  if (!sel || typeof apiFetch !== 'function') return;
  apiFetch('/api/business/products').then(function(res) {
    var items = (res.ok && res.data && res.data.items) || [];
    var opts = '<option value="">All products</option>' + items.map(function(p) {
      return '<option value="' + _crwsEsc(p.name) + '">' + _crwsEsc(p.name) + '</option>';
    }).join('');
    sel.innerHTML = opts;
  }).catch(function() {});
}

window.crwsSetProduct = function(name) {
  CRWS.product = name || '';
  crwsLoadHistory();
};

window.crwsSetPlatform = function(platform) {
  CRWS.platform = platform;
  document.querySelectorAll('#crwsPlatformPills .crws-pill').forEach(function(b) {
    b.classList.toggle('crws-pill-active', b.dataset.platform === platform);
  });
  if (CRWS.currentAsset) _crwsRenderPreview();
};

window.crwsSetDevice = function(device) {
  CRWS.device = device;
  document.querySelectorAll('#crwsDeviceToggle .crws-pill').forEach(function(b) {
    b.classList.toggle('crws-pill-active', b.dataset.device === device);
  });
  if (CRWS.currentAsset) _crwsRenderPreview();
};

function crwsLoadHistory() {
  var list = document.getElementById('crwsHistoryList');
  if (!list || typeof apiFetch !== 'function') return;
  list.innerHTML = '<div class="ov3-brief-loading"><div class="orv-ai-thinking-dots"><span></span><span></span><span></span></div></div>';
  var q = CRWS.product ? ('?product_name=' + encodeURIComponent(CRWS.product)) : '';
  apiFetch('/api/creative/assets' + q).then(function(res) {
    var assets = (res.ok && res.data && res.data.assets) || [];
    CRWS.historyItems = assets;
    if (!assets.length) { list.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">Nothing generated yet.</span>'; return; }
    list.innerHTML = assets.map(function(a) {
      var date = new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      return '<div class="crws-hist-item" onclick="crwsSelectAsset(\'' + a.id + '\')">' +
        '<div class="crws-hist-kind">' + _crwsEsc(a.kind) + '</div>' +
        '<div class="crws-hist-title">' + _crwsEsc(a.title || a.kind) + '</div>' +
        '<div class="crws-hist-date">' + date + '</div>' +
        '</div>';
    }).join('');
  }).catch(function() { list.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">Could not load history.</span>'; });
}

window.crwsSelectAsset = function(id) {
  var asset = CRWS.historyItems.find(function(a) { return a.id === id; });
  if (!asset) return;
  CRWS.currentAsset = asset;
  _crwsRenderCanvas(asset);
  _crwsRenderVersionStrip(asset);
  _crwsRenderPreview();
  crwsLoadScore(asset);
};

function _crwsRenderCanvas(asset) {
  var canvas = document.getElementById('crwsCanvas');
  var actions = document.getElementById('crwsCanvasActions');
  if (!canvas) return;
  var content = asset.content || {};
  var html;
  if (content.url) {
    html = '<img src="' + _crwsEsc(content.url) + '" alt="" style="max-width:100%;max-height:420px;border-radius:10px;display:block;margin:0 auto">';
  } else if (content.html) {
    html = '<div class="crws-canvas-html-note ov3-insight" style="color:var(--muted)">HTML asset — preview on the right.</div>';
  } else {
    var text = _crwsExtractText(content) || JSON.stringify(content, null, 2);
    html = '<textarea class="crws-canvas-text" id="crwsCanvasTextarea">' + _crwsEsc(text) + '</textarea>';
  }
  canvas.innerHTML = html;
  if (actions) actions.style.display = '';
  var fav = document.getElementById('crwsFavBtn');
  if (fav) fav.textContent = (asset.favorite ? '★ Favorited' : '☆ Favorite');
  var statusSel = document.getElementById('crwsStatusSelect');
  if (statusSel) statusSel.value = asset.status || 'draft';
  var badge = document.getElementById('crwsStatusBadge');
  if (badge) { badge.textContent = (asset.status || 'draft').replace('_', ' '); badge.className = 'crws-status-badge clib-status-pill clib-status-' + (asset.status || 'draft'); }
}

function _crwsRenderVersionStrip(asset) {
  var strip = document.getElementById('crwsVersionStrip');
  if (!strip || typeof apiFetch !== 'function') return;
  var rootId = asset.parent_asset_id || asset.id;
  apiFetch('/api/creative/assets/' + asset.id + '/versions').then(function(res) {
    var versions = (res.ok && res.data && res.data.versions) || [];
    if (versions.length <= 1) { strip.style.display = 'none'; return; }
    strip.style.display = '';
    strip.innerHTML = versions.map(function(v) {
      var active = v.id === asset.id ? ' crws-version-active' : '';
      return '<button class="crws-version-chip' + active + '" onclick="crwsSelectVersion(\'' + v.id + '\')">' + _crwsEsc(v.version_label || 'Original') + (v.is_current ? ' •' : '') + '</button>';
    }).join('');
  }).catch(function() { strip.style.display = 'none'; });
}

window.crwsSelectVersion = function(id) {
  if (typeof apiFetch !== 'function') return;
  apiFetch('/api/creative/assets/' + id + '/versions').then(function(res) {
    var versions = (res.ok && res.data && res.data.versions) || [];
    var found = versions.find(function(v) { return v.id === id; });
    if (found) {
      CRWS.historyItems.push(found);
      window.crwsSelectAsset(id);
    }
  }).catch(function() {});
};

window.crwsRestoreVersion = function(id) {
  if (typeof apiFetch !== 'function') return;
  apiFetch('/api/creative/assets/' + id + '/restore', { method: 'POST' }).then(function() {
    window.crwsSelectVersion(id);
    crwsLoadHistory();
  }).catch(function() {});
};

// ── Live Preview (Epic 2) — real CSS-only mockup frames, scoped to what
// the backend actually produces content for. One function, platform+device
// as parameters, not separate implementations per platform. ──────────────
var CRWS_PREVIEW_PLATFORMS = { ad: ['google', 'meta', 'tiktok'], email: ['email'], landing_page: ['landing_page'] };

function _crwsPreviewPlatformsFor(asset) {
  return CRWS_PREVIEW_PLATFORMS[asset.kind] || ['social'];
}

function _crwsRenderPreview() {
  var asset = CRWS.currentAsset;
  var tabsEl = document.getElementById('crwsPreviewTabs');
  var frameEl = document.getElementById('crwsPreviewFrame');
  if (!asset || !tabsEl || !frameEl) return;
  var platforms = _crwsPreviewPlatformsFor(asset);
  var active = platforms.indexOf(CRWS.platform) !== -1 ? CRWS.platform : platforms[0];
  tabsEl.innerHTML = platforms.map(function(p) {
    return '<button class="crws-pill' + (p === active ? ' crws-pill-active' : '') + '" onclick="crwsSetPlatform(\'' + p + '\')">' + p.replace('_', ' ') + '</button>';
  }).join('');
  frameEl.className = 'crws-preview-frame crws-device-' + CRWS.device;
  frameEl.innerHTML = _crwsRenderPlatformFrame(asset, active);
}

function _crwsRenderPlatformFrame(asset, platform) {
  var c = asset.content || {};
  var headline = c.headline || (c.googleAds && c.googleAds.headlines && c.googleAds.headlines[0]) || asset.title || 'Headline';
  var body = c.primaryText || c.body || (c.metaAds && c.metaAds.primaryText) || _crwsExtractText(c).slice(0, 140) || '';
  var cta = c.cta || (c.metaAds && c.metaAds.cta) || 'Learn More';
  var img = c.url || c.imageUrl || '';

  if (platform === 'google') {
    return '<div class="crws-pv-google"><div class="crws-pv-g-ad">Ad</div><div class="crws-pv-g-headline">' + _crwsEsc(headline) + '</div><div class="crws-pv-g-url">www.yourbrand.com</div><div class="crws-pv-g-desc">' + _crwsEsc(body) + '</div></div>';
  }
  if (platform === 'meta' || platform === 'social') {
    return '<div class="crws-pv-meta">' + (img ? '<img src="' + _crwsEsc(img) + '">' : '<div class="crws-pv-img-ph"></div>') +
      '<div class="crws-pv-meta-body"><div class="crws-pv-meta-headline">' + _crwsEsc(headline) + '</div><div class="crws-pv-meta-text">' + _crwsEsc(body) + '</div><button class="crws-pv-meta-cta">' + _crwsEsc(cta) + '</button></div></div>';
  }
  if (platform === 'tiktok') {
    return '<div class="crws-pv-tiktok">' + (img ? '<img src="' + _crwsEsc(img) + '">' : '<div class="crws-pv-img-ph"></div>') +
      '<div class="crws-pv-tiktok-overlay"><div class="crws-pv-tiktok-hook">' + _crwsEsc((c.tiktokAds && c.tiktokAds.hook) || headline) + '</div><div class="crws-pv-tiktok-cta">' + _crwsEsc(cta) + '</div></div></div>';
  }
  if (platform === 'email') {
    return '<iframe class="crws-pv-email-frame" srcdoc="' + _crwsEsc(c.html || '<p>' + body + '</p>') + '"></iframe>';
  }
  if (platform === 'landing_page') {
    return '<iframe class="crws-pv-lp-frame" srcdoc="' + _crwsEsc(c.html || '<p>' + body + '</p>') + '"></iframe>';
  }
  return '<div class="ov3-insight" style="color:var(--muted)">No preview available for this creative type.</div>';
}

// ── Creative Score (Epic 3) + Creative Director (Epic 4) ───────────────
window.crwsLoadScore = function(asset) {
  var scoreBody = document.getElementById('crwsScoreBody');
  var directorBody = document.getElementById('crwsDirectorBody');
  if (!scoreBody || typeof apiFetch !== 'function') return;
  scoreBody.innerHTML = '<div class="ov3-brief-loading"><div class="orv-ai-thinking-dots"><span></span><span></span><span></span></div></div>';
  if (directorBody) directorBody.innerHTML = '';
  apiFetch('/api/creative/score', { method: 'POST', body: JSON.stringify({ assetId: asset.id }) }).then(function(res) {
    if (!res.ok || !res.data) { scoreBody.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">Could not score this creative.</span>'; return; }
    var scores = res.data.scores || {};
    var order = ['ctrPrediction', 'attention', 'brandFit', 'readability', 'emotion', 'platformFit', 'conversionPotential', 'consistency', 'confidence'];
    var labels = { ctrPrediction: 'CTR Prediction', attention: 'Attention', brandFit: 'Brand Fit', readability: 'Readability', emotion: 'Emotion', platformFit: 'Platform Fit', conversionPotential: 'Conversion Potential', consistency: 'Consistency', confidence: 'Confidence' };
    scoreBody.innerHTML = order.map(function(k) {
      var s = scores[k];
      if (!s || s.value == null) return '';
      var cls = s.value >= 70 ? 'oi-badge-conf' : s.value >= 40 ? 'oi-sev-med' : 'oi-sev-high';
      return '<div class="oi-card" style="gap:4px;padding:8px 10px"><div class="oi-card-top"><div class="oi-card-title" style="font-size:12px">' + labels[k] + '</div><span class="oi-badge ' + cls + '" title="' + _crwsEsc(s.why || '') + '">' + s.value + '</span></div></div>';
    }).join('') || '<span class="ov3-insight" style="color:var(--muted)">No score available.</span>';

    var notes = res.data.directorNotes || [];
    if (directorBody) {
      directorBody.innerHTML = notes.length
        ? notes.map(function(n) { return window._renderInsightCard(n); }).join('')
        : '<span class="ov3-insight" style="color:var(--muted)">Nothing to flag right now.</span>';
    }
  }).catch(function() { scoreBody.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">Could not score this creative.</span>'; });
};

// ── One-Click Improve, wired to versioning ──────────────────────────────
window.crwsImprove = function(action) {
  var asset = CRWS.currentAsset;
  if (!asset || typeof apiFetch !== 'function') return;
  var text = _crwsExtractText(asset.content);
  if (!text) return;
  apiFetch('/api/creative/improve', { method: 'POST', body: JSON.stringify({ text: text, action: action, assetId: asset.id }) }).then(function(res) {
    if (!res.ok || !res.data) return;
    crwsLoadHistory();
    if (res.data.versionId) {
      setTimeout(function() {
        apiFetch('/api/creative/assets/' + res.data.versionId + '/versions').then(function(vRes) {
          var versions = (vRes.ok && vRes.data && vRes.data.versions) || [];
          var found = versions.find(function(v) { return v.id === res.data.versionId; });
          if (found) { CRWS.historyItems.push(found); window.crwsSelectAsset(found.id); }
        });
      }, 300);
    }
  }).catch(function() {});
};

window.crwsDuplicate = function() {
  var asset = CRWS.currentAsset;
  if (!asset || typeof apiFetch !== 'function') return;
  apiFetch('/api/creative/assets/' + asset.id + '/duplicate', { method: 'POST' }).then(function() { crwsLoadHistory(); }).catch(function() {});
};

window.crwsToggleFavorite = function() {
  var asset = CRWS.currentAsset;
  if (!asset || typeof apiFetch !== 'function') return;
  apiFetch('/api/creative/assets/' + asset.id, { method: 'PATCH', body: JSON.stringify({ favorite: !asset.favorite }) }).then(function(res) {
    if (res.ok && res.data && res.data.asset) { CRWS.currentAsset = res.data.asset; _crwsRenderCanvas(res.data.asset); }
  }).catch(function() {});
};

window.crwsArchive = function() {
  var asset = CRWS.currentAsset;
  if (!asset || typeof apiFetch !== 'function') return;
  apiFetch('/api/creative/assets/' + asset.id, { method: 'PATCH', body: JSON.stringify({ archived: true }) }).then(function() {
    CRWS.currentAsset = null;
    document.getElementById('crwsCanvasActions').style.display = 'none';
    document.getElementById('crwsCanvas').innerHTML = '<div class="crws-empty ov3-insight" style="color:var(--muted)">Select a creative from History.</div>';
    crwsLoadHistory();
  }).catch(function() {});
};

window.crwsSetStatus = function(status) {
  var asset = CRWS.currentAsset;
  if (!asset || typeof apiFetch !== 'function') return;
  apiFetch('/api/creative/assets/' + asset.id, { method: 'PATCH', body: JSON.stringify({ status: status }) }).then(function(res) {
    if (res.ok && res.data && res.data.asset) { CRWS.currentAsset = res.data.asset; _crwsRenderCanvas(res.data.asset); }
  }).catch(function() {});
};

// ── Compare Mode (Epic 5) — reuses .cf-overlay/.cf-panel chrome ────────
window.crwsCompareOpen = function() {
  var overlay = document.getElementById('crwsCompareOverlay');
  var body = document.getElementById('crwsCompareBody');
  if (!overlay || !body) return;
  var current = CRWS.currentAsset;
  var others = CRWS.historyItems.filter(function(a) { return !current || a.id !== current.id; });
  body.innerHTML = '<div class="crws-sect-title">Compare against</div>' +
    '<select class="crws-select" id="crwsCompareSelect">' + others.map(function(a) { return '<option value="' + a.id + '">' + _crwsEsc(a.title || a.kind) + '</option>'; }).join('') + '</select>' +
    '<button class="ov3-sh-btn" style="margin-top:8px" onclick="crwsCompareRun()">Compare</button>' +
    '<div id="crwsCompareResult" style="margin-top:14px"></div>';
  overlay.style.display = '';
};

window.crwsCompareClose = function() {
  var overlay = document.getElementById('crwsCompareOverlay');
  if (overlay) overlay.style.display = 'none';
};

window.crwsCompareRun = function() {
  var current = CRWS.currentAsset;
  var sel = document.getElementById('crwsCompareSelect');
  var resultEl = document.getElementById('crwsCompareResult');
  if (!current || !sel || !resultEl || typeof apiFetch !== 'function') return;
  var other = CRWS.historyItems.find(function(a) { return a.id === sel.value; });
  if (!other) return;
  resultEl.innerHTML = '<div class="ov3-brief-loading"><div class="orv-ai-thinking-dots"><span></span><span></span><span></span></div></div>';
  Promise.all([
    apiFetch('/api/creative/score', { method: 'POST', body: JSON.stringify({ assetId: current.id }) }),
    apiFetch('/api/creative/score', { method: 'POST', body: JSON.stringify({ assetId: other.id }) })
  ]).then(function(results) {
    var sA = (results[0].ok && results[0].data && results[0].data.scores) || {};
    var sB = (results[1].ok && results[1].data && results[1].data.scores) || {};
    function total(s) {
      var keys = Object.keys(s);
      var vals = keys.map(function(k) { return s[k] && s[k].value; }).filter(function(v) { return v != null; });
      return vals.length ? Math.round(vals.reduce(function(a, b) { return a + b; }, 0) / vals.length) : null;
    }
    var totalA = total(sA), totalB = total(sB);
    var winner = (totalA != null && totalB != null) ? (totalA >= totalB ? current : other) : null;
    var textA = _crwsExtractText(current.content), textB = _crwsExtractText(other.content);
    resultEl.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="oi-card"><div class="oi-card-title">' + _crwsEsc(current.title || current.kind) + '</div><div class="oi-card-desc">' + _crwsEsc(textA) + '</div><div class="oi-card-impact">Avg score: ' + (totalA != null ? totalA : 'n/a') + '</div></div>' +
        '<div class="oi-card"><div class="oi-card-title">' + _crwsEsc(other.title || other.kind) + '</div><div class="oi-card-desc">' + _crwsEsc(textB) + '</div><div class="oi-card-impact">Avg score: ' + (totalB != null ? totalB : 'n/a') + '</div></div>' +
      '</div>' +
      (winner ? '<div class="ov3-insight" style="margin-top:10px">Stronger overall: <strong>' + _crwsEsc(winner.title || winner.kind) + '</strong>, based on the average of the same deterministic and predicted sub-scores shown above.</div>' : '');
  }).catch(function() { resultEl.innerHTML = '<span class="ov3-insight" style="color:var(--muted)">Could not compare right now.</span>'; });
};

// ── Global Creative Search (Epic 7) ─────────────────────────────────────
var _crwsSearchTimer = null;
window.crwsSearch = function(q) {
  var results = document.getElementById('crwsSearchResults');
  if (!results) return;
  clearTimeout(_crwsSearchTimer);
  if (!q || q.trim().length < 2) { results.style.display = 'none'; return; }
  _crwsSearchTimer = setTimeout(function() {
    if (typeof apiFetch !== 'function') return;
    apiFetch('/api/creative/search?q=' + encodeURIComponent(q)).then(function(res) {
      var items = (res.ok && res.data && res.data.results) || [];
      if (!items.length) { results.innerHTML = '<div class="crws-search-empty">No results.</div>'; results.style.display = ''; return; }
      results.innerHTML = items.map(function(r) {
        return '<div class="crws-search-item" onclick="crwsSearchPick(\'' + r.type + '\',\'' + r.id + '\')"><span class="crws-search-type">' + r.type + '</span>' + _crwsEsc(r.title) + '</div>';
      }).join('');
      results.style.display = '';
    }).catch(function() {});
  }, 250);
};

window.crwsSearchPick = function(type, id) {
  var results = document.getElementById('crwsSearchResults');
  if (results) results.style.display = 'none';
  if (type === 'creative') {
    var found = CRWS.historyItems.find(function(a) { return a.id === id; });
    if (found) { window.crwsSelectAsset(id); return; }
    if (typeof apiFetch === 'function') {
      apiFetch('/api/creative/assets').then(function(res) {
        var assets = (res.ok && res.data && res.data.assets) || [];
        CRWS.historyItems = assets;
        window.crwsSelectAsset(id);
      });
    }
  }
};

// ── Persistent Ask Oriven dock (bottom) — same message-bubble classes and
// /api/ai/chat call as the floating Oriven AI panel, just docked inline. ──
window.crwsChatSend = function() {
  var inp = document.getElementById('crwsChatInput');
  var feed = document.getElementById('crwsChatFeed');
  if (!inp || !feed) return;
  var msg = inp.value.trim();
  if (!msg || typeof apiFetch !== 'function') return;
  inp.value = '';

  var userDiv = document.createElement('div');
  userDiv.className = 'orv-ai-msg orv-ai-msg-user';
  userDiv.innerHTML = '<div class="orv-ai-msg-bubble">' + _crwsEsc(msg) + '</div>';
  feed.appendChild(userDiv);

  var typingDiv = document.createElement('div');
  typingDiv.className = 'orv-ai-msg orv-ai-msg-ai';
  typingDiv.innerHTML = '<div class="orv-ai-msg-bubble"><div class="orv-ai-thinking-dots"><span></span><span></span><span></span></div></div>';
  feed.appendChild(typingDiv);
  feed.scrollTop = feed.scrollHeight;

  var ctx = {
    page: 'creative-workspace',
    currentCampaign: CRWS.currentAsset ? { campaignId: CRWS.currentAsset.id, campaignName: CRWS.currentAsset.title, platform: CRWS.currentAsset.platform } : null
  };

  CRWS.chatHistory.push({ role: 'user', content: msg });
  apiFetch('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message: msg, context: ctx, history: CRWS.chatHistory.slice(-20) }) }).then(function(res) {
    typingDiv.remove();
    var text = (res.ok && res.data && (res.data.reply || res.data.message)) || "I couldn't process that. Please try again.";
    var aiDiv = document.createElement('div');
    aiDiv.className = 'orv-ai-msg orv-ai-msg-ai';
    aiDiv.innerHTML = '<div class="orv-ai-msg-bubble">' + _crwsEsc(text) + '</div>';
    feed.appendChild(aiDiv);
    feed.scrollTop = feed.scrollHeight;
    if (res.ok) CRWS.chatHistory.push({ role: 'assistant', content: text });
  }).catch(function() {
    typingDiv.remove();
    var errDiv = document.createElement('div');
    errDiv.className = 'orv-ai-msg orv-ai-msg-ai';
    errDiv.innerHTML = '<div class="orv-ai-msg-bubble" style="color:var(--muted)">Something went wrong.</div>';
    feed.appendChild(errDiv);
  });
};
