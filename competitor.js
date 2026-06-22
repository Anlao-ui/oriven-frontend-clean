// ═══════════════════════════════════════════════════════════════════
// COMPETITOR INTELLIGENCE v2
// Single-URL brand intelligence dashboard.
// 7 sections: Snapshot · Visual Identity · Positioning · Tone ·
//             Differentiation · Strategic Insight · Final Verdict
// ═══════════════════════════════════════════════════════════════════

var _ciRunning  = false;
var _ciStepTimer = null;
var _ciLastUrl  = "";

// ── Lifecycle ──────────────────────────────────────────────────────

function ciInit(){
  if(_ciRunning) return;
  var results = document.getElementById("ciResults");
  if(results && !results.classList.contains("hidden")) return;
  _ciShowIdle();
}

function ciReset(){
  _ciRunning = false;
  if(_ciStepTimer){ clearInterval(_ciStepTimer); _ciStepTimer = null; }
  _ciShowIdle();
  var el = document.getElementById("ciUrl");
  if(el){ el.value = ""; el.focus(); }
}

function _ciShowIdle(){
  var idle      = document.getElementById("ciIdle");
  var analyzing = document.getElementById("ciAnalyzing");
  var results   = document.getElementById("ciResults");
  if(idle)      idle.style.display = "";
  if(analyzing) analyzing.classList.add("hidden");
  if(results)   results.classList.add("hidden");
}

// ── Analysis ───────────────────────────────────────────────────────

function startCompetitorAnalysis(){
  if(_ciRunning) return;

  var el  = document.getElementById("ciUrl");
  var url = el ? el.value.trim() : "";
  if(!url){
    if(typeof toast === "function") toast("Enter a competitor URL", "warn");
    return;
  }
  if(!/^https?:\/\//i.test(url)) url = "https://" + url;
  _ciLastUrl = url;

  _ciRunning = true;

  var idle      = document.getElementById("ciIdle");
  var analyzing = document.getElementById("ciAnalyzing");
  var stepsEl   = document.getElementById("ciSteps");
  var subEl     = document.getElementById("ciAnalyzeSub");

  if(idle)      idle.style.display = "none";
  if(stepsEl)   stepsEl.innerHTML = "";
  if(subEl)     subEl.textContent = "Reading brand signals…";
  if(analyzing) analyzing.classList.remove("hidden");

  _ciAnimateSteps(stepsEl, subEl);

  var bc = (typeof S !== "undefined" && S && S.brandCore) ? S.brandCore : null;
  var apiBase = (typeof API_BASE_URL !== "undefined") ? API_BASE_URL : "";

  fetch(apiBase + "/api/competitor-intelligence", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ competitor: url, brandCore: bc })
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    _ciRunning = false;
    if(_ciStepTimer){ clearInterval(_ciStepTimer); _ciStepTimer = null; }
    if(data && data.error){
      if(typeof toast === "function") toast("Analysis failed: " + data.error, "error");
      _ciShowIdle();
      return;
    }
    _ciShowResults(data, bc);
  })
  .catch(function(){
    _ciRunning = false;
    if(_ciStepTimer){ clearInterval(_ciStepTimer); _ciStepTimer = null; }
    if(typeof toast === "function") toast("Could not reach analysis service", "error");
    _ciShowIdle();
  });
}

function _ciAnimateSteps(stepsEl, subEl){
  var steps = [
    "Reading brand signals…",
    "Analyzing visual identity…",
    "Mapping positioning territory…",
    "Evaluating tone of voice…",
    "Comparing against your Brand Core…",
    "Identifying differentiation opportunities…",
    "Generating strategic recommendation…"
  ];
  var i = 0;
  _ciStepTimer = setInterval(function(){
    if(!_ciRunning){ clearInterval(_ciStepTimer); _ciStepTimer = null; return; }
    if(i >= steps.length){ clearInterval(_ciStepTimer); _ciStepTimer = null; return; }
    if(subEl) subEl.textContent = steps[i];
    if(stepsEl){
      var prev = stepsEl.querySelector(".bc-step-active");
      if(prev){ prev.classList.remove("bc-step-active"); prev.classList.add("bc-step-done"); }
      var el = document.createElement("div");
      el.className = "bc-step bc-step-active";
      el.innerHTML = '<div class="bc-step-icon"><div class="bc-step-spinner"></div></div><span class="bc-step-lbl">' + steps[i] + '</span>';
      stepsEl.appendChild(el);
    }
    i++;
  }, 1600);
}

// ── Display results ────────────────────────────────────────────────

function _ciShowResults(data, bc){
  var analyzing  = document.getElementById("ciAnalyzing");
  var results    = document.getElementById("ciResults");
  var body       = document.getElementById("ciResultsBody");
  var brandEl    = document.getElementById("ciResultsBrand");
  var urlEl      = document.getElementById("ciResultsUrl");

  if(analyzing) analyzing.classList.add("hidden");
  if(!results || !body) return;

  var comp = data.competitor || {};
  if(brandEl) brandEl.textContent = comp.name || _ciLastUrl;
  if(urlEl)   urlEl.textContent   = _ciLastUrl;

  body.innerHTML = _ciRenderHTML(data, bc);
  results.classList.remove("hidden");
}

// ── Helpers ────────────────────────────────────────────────────────

function _ciEsc(str){
  if(!str) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function _ciParseColors(val){
  if(!val) return [];
  var list = Array.isArray(val) ? val : String(val).split(/[,;\s]+/);
  return list.map(function(c){ return (c||"").trim(); }).filter(function(c){ return /^#[0-9a-fA-F]{3,6}$/.test(c); });
}

function _ciSwatchRow(colors){
  if(!colors || !colors.length) return "";
  return '<div class="ci-swatches">' +
    colors.map(function(hex){
      return '<div class="ci-swatch" style="background:' + _ciEsc(hex) + '" title="' + _ciEsc(hex) + '"></div>';
    }).join("") + '</div>';
}

function _ciBadges(words, cls){
  if(!words || !words.length) return "";
  return words.map(function(w){ return '<span class="ci-badge ' + (cls||"") + '">' + _ciEsc(w) + '</span>'; }).join("");
}

function _ciSection(label, inner){
  return '<div class="ci-s"><div class="ci-s-lbl">' + label + '</div>' + inner + '</div>';
}

// ── Main renderer ──────────────────────────────────────────────────

function _ciRenderHTML(data, bc){
  var comp = data.competitor    || {};
  var ub   = data.userBrand     || {};
  var pos  = data.positioning   || {};
  var diff = data.differentiation || {};
  var verd = data.verdict       || {};
  var html = "";

  // ── 1. Competitor Snapshot ─────────────────────────────────────
  var snapItems = [
    { l:"Positioning", v: comp.positioning },
    { l:"Tone",        v: comp.tone        },
    { l:"Audience",    v: comp.audience    },
    { l:"Style",       v: comp.visualStyle }
  ].filter(function(x){ return !!x.v; });

  var snapInner = '<div class="ci-snap">'
    + '<div class="ci-snap-name">' + _ciEsc(comp.name || _ciLastUrl) + '</div>'
    + (comp.industry ? '<span class="ci-snap-industry">' + _ciEsc(comp.industry) + '</span>' : '')
    + '<div class="ci-snap-grid">'
    + snapItems.map(function(x){
        return '<div class="ci-snap-item"><div class="ci-snap-il">' + x.l + '</div><div class="ci-snap-iv">' + _ciEsc(x.v) + '</div></div>';
      }).join("")
    + '</div></div>';
  html += _ciSection("Competitor Snapshot", snapInner);

  // ── 2. Visual Identity ─────────────────────────────────────────
  var compColors  = _ciParseColors(comp.colors);
  var userColors  = _ciParseColors(bc && bc.colors);
  var compTypo    = comp.typography || "";
  var userTypo    = bc ? (Array.isArray(bc.fonts) ? bc.fonts.filter(Boolean).join(" / ") : (bc.fonts || "")) : "";
  var compStyle   = comp.designAdjectives || [];
  var userStyle   = ub.designAdjectives || [];

  var viInner = '<div class="ci-vs">';

  viInner += '<div class="ci-vs-col">'
    + '<div class="ci-vs-side ci-vs-comp">Competitor</div>'
    + (compColors.length ? _ciSwatchRow(compColors) : "")
    + (compTypo ? '<div class="ci-vis-typo">' + _ciEsc(compTypo) + '</div>' : "")
    + (compStyle.length ? '<div class="ci-vis-badges">' + _ciBadges(compStyle, "ci-badge-comp") + '</div>' : "")
    + '</div>';

  viInner += '<div class="ci-vs-col">'
    + '<div class="ci-vs-side ci-vs-user">Your Brand</div>'
    + (userColors.length ? _ciSwatchRow(userColors) : '<div class="ci-vis-empty">No colors in Brand Core</div>')
    + (userTypo ? '<div class="ci-vis-typo">' + _ciEsc(userTypo) + '</div>' : "")
    + (userStyle.length ? '<div class="ci-vis-badges">' + _ciBadges(userStyle, "ci-badge-user") + '</div>' : "")
    + '</div>';

  viInner += '</div>';
  html += _ciSection("Visual Identity", viInner);

  // ── 3. Positioning ─────────────────────────────────────────────
  var posInner = '<div class="ci-pos-vs">'
    + '<div class="ci-pos-card ci-pos-comp">'
    + '<div class="ci-pos-lbl">Competitor Owns</div>'
    + '<div class="ci-pos-val">' + _ciEsc(pos.competitorOwns || "—") + '</div>'
    + '</div>'
    + '<div class="ci-pos-card ci-pos-user">'
    + '<div class="ci-pos-lbl">Your Brand Owns</div>'
    + '<div class="ci-pos-val">' + _ciEsc(pos.userOwns || "—") + '</div>'
    + '</div>'
    + '</div>';

  if(pos.overlap && pos.overlap.length){
    posInner += '<div class="ci-overlap">'
      + '<span class="ci-overlap-lbl">Overlap</span>'
      + _ciBadges(pos.overlap, "ci-badge-overlap")
      + '</div>';
  }
  html += _ciSection("Positioning", posInner);

  // ── 4. Tone of Voice ───────────────────────────────────────────
  var compTone = comp.toneWords || [];
  var userTone = ub.toneWords   || [];
  if(compTone.length || userTone.length){
    var toneInner = '<div class="ci-tone-vs">'
      + '<div class="ci-tone-col">'
      + '<div class="ci-tone-side ci-tone-comp">Competitor</div>'
      + '<div class="ci-tone-badges">' + _ciBadges(compTone, "ci-badge-tone-comp") + '</div>'
      + '</div>'
      + '<div class="ci-tone-col">'
      + '<div class="ci-tone-side ci-tone-user">Your Brand</div>'
      + '<div class="ci-tone-badges">' + _ciBadges(userTone, "ci-badge-tone-user") + '</div>'
      + '</div></div>';
    html += _ciSection("Tone of Voice", toneInner);
  }

  // ── 5. Brand Differentiation ───────────────────────────────────
  var diffCards = [
    { l:"What They Own",   v: diff.theyOwn,    c:"ci-diff-they" },
    { l:"What You Own",    v: diff.youOwn,     c:"ci-diff-you"  },
    { l:"Opportunity",     v: diff.opportunity, c:"ci-diff-opp"  },
    { l:"Risk",            v: diff.risk,        c:"ci-diff-risk" }
  ].filter(function(x){ return !!x.v; });

  var diffInner = '<div class="ci-diff-grid">'
    + diffCards.map(function(card){
        return '<div class="ci-diff-card ' + card.c + '">'
          + '<div class="ci-diff-lbl">' + card.l + '</div>'
          + '<div class="ci-diff-val">' + _ciEsc(card.v) + '</div>'
          + '</div>';
      }).join("")
    + '</div>';
  html += _ciSection("Brand Differentiation", diffInner);

  // ── 6. Strategic Insight ───────────────────────────────────────
  if(data.insight){
    var insightInner = '<div class="ci-insight">'
      + '<div class="ci-insight-ico">'
      + '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><path d="M10 2l2.09 4.26L17 7.27l-3.5 3.41.83 4.82L10 13.25l-4.33 2.25.83-4.82L3 7.27l4.91-.71L10 2z"/></svg>'
      + '</div>'
      + '<div class="ci-insight-text">' + _ciEsc(data.insight) + '</div>'
      + '</div>';
    html += _ciSection("AI Strategic Insight", insightInner);
  }

  // ── 7. Final Verdict ───────────────────────────────────────────
  var verdictItems = [
    { ico:"↑", l:"Biggest Strength",      v: verd.strength  },
    { ico:"↓", l:"Biggest Weakness",      v: verd.weakness  },
    { ico:"★", l:"Your Advantage",        v: verd.advantage },
    { ico:"→", l:"Recommended Position",  v: verd.position  }
  ].filter(function(x){ return !!x.v; });

  var verdictInner = '<div class="ci-verdict">'
    + verdictItems.map(function(item){
        return '<div class="ci-verdict-item">'
          + '<div class="ci-verdict-ico">' + item.ico + '</div>'
          + '<div class="ci-verdict-lbl">' + item.l + '</div>'
          + '<div class="ci-verdict-val">' + _ciEsc(item.v) + '</div>'
          + '</div>';
      }).join("")
    + '</div>';
  html += _ciSection("Final Verdict", verdictInner);

  return html;
}
