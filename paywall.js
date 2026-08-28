// ════════════════════════════════════════════════════════════════
// PAYWALL MODAL — plan detection + card rendering
// ════════════════════════════════════════════════════════════════

function openPaywall(){
  console.log("[PW-CHAIN] openPaywall() called | typeof openModal:", typeof openModal);
  _renderPaywallCards();
  var pwEl = document.getElementById("modal-paywall");
  if(!pwEl){
    console.error("[PW-CHAIN] openPaywall() — modal-paywall element NOT FOUND in DOM");
    return;
  }
  console.log("[PW-CHAIN] openPaywall() — modal-paywall before open | className:", pwEl.className, "| style.display:", pwEl.style.display);
  if(typeof openModal === "function"){
    openModal("modal-paywall");
    var cs = window.getComputedStyle(pwEl);
    console.log("[PW-CHAIN] openPaywall() — modal-paywall after open | className:", pwEl.className, "| computed opacity:", cs.opacity, "| computed display:", cs.display, "| computed z-index:", cs.zIndex);
  } else {
    console.error("[PW-CHAIN] openModal is NOT a function — app.js may not be loaded");
  }
}

function _renderPaywallCards(){
  // _dbSubscriptionStatus is the Supabase-authoritative value (set by _loadUserProfile).
  // Only fall back to S.currentPlan or localStorage when DB hasn't loaded yet.
  var plan = "free";
  try {
    if(typeof _dbSubscriptionStatus !== "undefined" && _dbSubscriptionStatus !== null){
      plan = _dbSubscriptionStatus;
    } else if(typeof S !== "undefined" && S && S.currentPlan){
      plan = S.currentPlan;
    } else if(typeof loadSettings === "function"){
      var cfg = loadSettings();
      if(cfg && cfg.currentPlan) plan = cfg.currentPlan;
    }
  } catch(_){}

  // Free is never a selectable option here -- it only ever appears as the
  // user's own current-state card, shown alongside Starter/Creator/
  // Professional as the primary upgrade choices, and only when the
  // signed-in user's actual plan genuinely IS free. A paid user (starter/
  // creator/professional) sees only the 3 paid plans, exactly like Settings
  // → Subscription (settings.js renderPlanPanel uses the same rule).
  var plansForCards = (plan === "free") ? ORIVEN_PLAN_LIST : ORIVEN_PAID_PLANS;

  // Render all cards fresh from the central plan config
  var grid = document.getElementById("pwPlanGrid");
  if(grid && typeof renderPWPricingCards === "function") renderPWPricingCards(grid, plansForCards);

  // Mark the user's current plan button as inactive/labeled "Current Plan"
  // (Free included when it's genuinely current) rather than presenting it
  // as another selectable tier.
  plansForCards.forEach(function(p){
    if(plan !== p.id) return;
    var btn = document.getElementById("paywall-btn-" + p.id);
    if(!btn) return;
    btn.textContent = "Current Plan";
    btn.disabled    = true;
    btn.className   = "pw-btn";
  });
}

// ════════════════════════════════════════════════════════════════
// CONTEXTUAL UPGRADE PROMPTS — shown when a specific limit is hit
// ════════════════════════════════════════════════════════════════

var _LIMIT_MSGS = {
  brand: {
    title:   "Brand limit reached.",
    sub:     "Upgrade to manage more brands from one Brand Identity system.",
    upgrade: "creator"
  },
  competitor: {
    title:   "Competitor limit reached.",
    sub:     "Upgrade to track more competitors and stay ahead of the market.",
    upgrade: "creator"
  },
  website: {
    title:   "Website limit reached.",
    sub:     "Upgrade to monitor multiple websites and catch brand drift everywhere.",
    upgrade: "creator"
  },
  credits: {
    title:   "Create credits used.",
    sub:     "Upgrade for more credits and keep generating on-brand content.",
    upgrade: "creator"
  },
  credits_free: {
    title:   "Today's free credits used.",
    sub:     "Your 10 free credits refresh in 24 hours — or upgrade now for more credits and higher limits today.",
    upgrade: "creator"
  },
  brief: {
    title:   "Daily Brief requires Creator.",
    sub:     "Upgrade to receive your Brand Brief every morning instead of weekly.",
    upgrade: "creator"
  },
  history: {
    title:   "Extended history requires Professional.",
    sub:     "Upgrade to access up to 365 days of brand intelligence history.",
    upgrade: "professional"
  },
  autopilot: {
    title:   "Autopilot requires Creator or higher.",
    sub:     "Upgrade to automate campaign decisions with AI-driven rules.",
    upgrade: "creator"
  },
  autopilot_creator: {
    title:   "Autopilot execution limit reached.",
    sub:     "Upgrade to Professional for unlimited Autopilot executions.",
    upgrade: "professional"
  },
  intelligence: {
    title:   "Intelligence limit reached.",
    sub:     "Upgrade to run more AI analyses on your ad accounts.",
    upgrade: "creator"
  },
  intelligence_free: {
    title:   "This month's Intelligence use is used.",
    sub:     "Your free Intelligence analysis resets next month — or upgrade now for more analyses today.",
    upgrade: "creator"
  },
  intelligence_creator: {
    title:   "Intelligence limit reached.",
    sub:     "Upgrade to Professional for unlimited Intelligence analyses.",
    upgrade: "professional"
  },
  team: {
    title:   "Team requires Professional.",
    sub:     "Upgrade to invite teammates and collaborate inside Oriven.",
    upgrade: "professional"
  }
};

function openLimitReached(type){
  // Free's daily reset means "you've used it up" reads very differently
  // than a paid plan's monthly cap ("come back tomorrow" vs "upgrade") --
  // swap in the free-specific copy for the two limit types Free actually
  // has (credits, intelligence) without requiring every call site to know
  // the current plan itself.
  try {
    if((type === "credits" || type === "intelligence") && typeof _dbSubscriptionStatus !== "undefined" && _dbSubscriptionStatus === "free" && _LIMIT_MSGS[type + "_free"]){
      type = type + "_free";
    }
  } catch(_){}

  var m = _LIMIT_MSGS[type] || {
    title:   "Plan limit reached.",
    sub:     "Upgrade to get more intelligence, monitoring and scale.",
    upgrade: "creator"
  };

  var titleEl = document.querySelector("#modal-paywall .pw-title");
  var subEl   = document.querySelector("#modal-paywall .pw-sub");
  if(titleEl) titleEl.innerHTML = m.title + ' <em>Upgrade to ' + (_upLabel(m.upgrade)) + '.</em>';
  if(subEl)   subEl.textContent = m.sub;

  openPaywall();
}

function _upLabel(planId){
  var p = typeof ORIVEN_PLANS !== "undefined" && ORIVEN_PLANS[planId];
  return p ? p.name : (planId ? planId.charAt(0).toUpperCase() + planId.slice(1) : "a higher plan");
}

// ════════════════════════════════════════════════════════════════
// SOFT PAYWALL — upgrade prompt shown after last free generation
// ════════════════════════════════════════════════════════════════

var _softPaywallShown = false;

function showSoftPaywall(){
  if(_softPaywallShown) return;
  _softPaywallShown = true;

  _spBuildProgress();

  var modal = document.getElementById("softPaywallModal");
  if(!modal) return;

  modal.style.display = "flex";
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      modal.classList.add("sp-visible");
    });
  });
}

function closeSoftPaywall(){
  var modal = document.getElementById("softPaywallModal");
  if(!modal) return;
  modal.classList.remove("sp-visible");
  setTimeout(function(){
    modal.style.display = "none";
    _showUpgradeBar();
  }, 270);
}

function closeSoftPaywallNoBar(){
  var modal = document.getElementById("softPaywallModal");
  if(!modal) return;
  modal.classList.remove("sp-visible");
  setTimeout(function(){ modal.style.display = "none"; }, 270);
}

function _showUpgradeBar(){
  var bar = document.getElementById("upgradeBar");
  if(!bar) return;
  bar.style.display = "flex";
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      bar.classList.add("upgrade-bar-visible");
    });
  });
}

function hideUpgradeBar(){
  var bar = document.getElementById("upgradeBar");
  if(!bar) return;
  bar.classList.remove("upgrade-bar-visible");
  setTimeout(function(){ bar.style.display = "none"; }, 270);
}

function _spBuildProgress(){
  var items = [
    { label: "Brand identity configured", done: true  },
    { label: "Brand Identity established", done: true  },
    { label: "Content generation",        done: false },
    { label: "Full brand operating system", done: false }
  ];

  var done = items.filter(function(i){ return i.done; }).length;
  var pct  = 60; // fixed "you're partway there" feel

  var pctEl  = document.getElementById("spProgressPct");
  var fillEl = document.getElementById("spProgressFill");
  var listEl = document.getElementById("spProgressList");

  if(pctEl)  pctEl.textContent = pct + "%";
  if(fillEl) setTimeout(function(){ fillEl.style.width = pct + "%"; }, 80);
  if(listEl){
    listEl.innerHTML = items.map(function(item){
      var ico = item.done
        ? '<svg viewBox="0 0 16 16" fill="none" stroke="#B7FF2A" stroke-width="2.2"><polyline points="2,8.5 6,12.5 14,4"/></svg>'
        : '<svg viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"><rect x="4.5" y="7" width="7" height="6.5" rx="1.2"/><path d="M6 7V5.5a2 2 0 0 1 4 0V7" stroke-linecap="round"/></svg>';
      return '<div class="sp-progress-item ' + (item.done ? 'sp-done' : 'sp-locked') + '">'
        + '<span class="sp-item-icon">' + ico + '</span>'
        + '<span class="sp-item-label">' + item.label + '</span>'
        + '</div>';
    }).join("");
  }
}
