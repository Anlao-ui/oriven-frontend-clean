// ════════════════════════════════════════════════════════════════
// PAYWALL MODAL — plan detection + card rendering
// ════════════════════════════════════════════════════════════════

function openPaywall(actionCtx){
  console.log("[PW-CHAIN] openPaywall() called | typeof openModal:", typeof openModal);
  // A plain open (no action) ends any earlier action-specific state.
  if(!actionCtx) _pwEndAction();
  _renderPaywallCards();
  if(actionCtx) _pwRenderActionFit(actionCtx);
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
// ACTION PAYWALL — the same modal, opened from a blocked Create/Research
// action. The server already refused the action (402/403) before anything
// was spent; this explains why, in the user's terms, and shows per plan
// whether it covers the action. Everything is derived from plans.js
// (ORIVEN_PLANS / CREDIT_COSTS), never typed-in numbers.
//   ctx: { action: 'create'|'image'|'research', code, balance }
// ════════════════════════════════════════════════════════════════

var _pwAction = null;   // { ctx, title, sub, eyebrow, skip } while an action paywall is showing

function _pwCurrentPlan(){
  try { if(typeof _dbSubscriptionStatus !== "undefined" && _dbSubscriptionStatus) return _dbSubscriptionStatus; } catch(_){}
  return "free";
}

function _pwActionCopy(ctx){
  var C = CREDIT_COSTS;
  var bal = (ctx.balance != null && isFinite(Number(ctx.balance))) ? Number(ctx.balance) : null;
  var have = bal != null ? ", and you have " + orvFormatCredits(bal) : "";
  if(ctx.action === "research"){
    var p = ORIVEN_PLANS[_pwCurrentPlan()];
    var notIncluded = ctx.code === "PLAN_REQUIRED" || !(p && p.entitlements && p.entitlements.research);
    return {
      title: "You’re ready to research your market.",
      sub: notIncluded
        ? "Research is included from " + ORIVEN_PLANS.starter.name + ". Each investigation uses " + C.research + " credits. Your question is saved."
        : "Each investigation uses " + C.research + " credits" + have + ". Your question is saved."
    };
  }
  if(ctx.action === "image"){
    return { title: "You’re ready to create your ad.",
      sub: "Rendering an ad image uses " + C.imageAd + " credits" + have + ". Your campaign and brief are saved." };
  }
  if(ctx.code === "SUBSCRIPTION_REQUIRED"){
    return { title: "You’re ready to create your ad.",
      sub: "Free includes one campaign build a day, and today’s is used. Choose a plan to build this one now. Your brief is saved." };
  }
  return { title: "You’re ready to create your ad.",
    sub: "Building a campaign uses " + C.campaign + " credits" + have + ". Your brief is saved." };
}

// Whether a plan covers the action, with the honest reason.
function _pwPlanFit(plan, ctx){
  var C = CREDIT_COSTS;
  if(!plan) return null;
  var perCycle = plan.cycleLabel === "day" ? "day" : "month";
  if(ctx.action === "research"){
    if(!(plan.entitlements && plan.entitlements.research)) return { ok: false, text: "Research isn’t included" };
    return { ok: true, text: "Research included · up to " + orvFormatCredits(Math.floor(plan.credits / C.research)) + " investigations / " + perCycle };
  }
  if(plan.id === "free"){
    if(ctx.action === "image") return { ok: false, text: "Ad images need " + C.imageAd + " credits. Free has " + plan.credits + " a day" };
    return { ok: false, text: "One campaign build a day · no ad images" };
  }
  return { ok: true, text: "Up to " + orvFormatCredits(Math.floor(plan.credits / C.imageAdComplete)) + " complete image ads / " + perCycle };
}

function _pwRenderActionFit(ctx){
  var grid = document.getElementById("pwPlanGrid");
  if(!grid || typeof ORIVEN_PLANS === "undefined") return;
  var firstFit = null;
  (typeof ORIVEN_PLAN_LIST !== "undefined" ? ORIVEN_PLAN_LIST : []).forEach(function(p){
    var btn = document.getElementById("paywall-btn-" + p.id);
    var card = btn && btn.closest ? btn.closest(".pw-card") : null;
    if(!card) return;
    var fit = _pwPlanFit(p, ctx);
    if(!fit) return;
    if(fit.ok && !firstFit) firstFit = card;
    var el = document.createElement("div");
    el.className = "pw-fit " + (fit.ok ? "pw-fit-yes" : "pw-fit-no");
    el.innerHTML = '<span class="pw-fit-ic" aria-hidden="true">' + (fit.ok ? "✓" : "–") + '</span><span>' + fit.text + '</span>';
    var anchor = card.querySelector(".pw-credits-inline");
    if(anchor && anchor.nextSibling) card.insertBefore(el, anchor.nextSibling); else card.appendChild(el);
    if(p.id === "free" && btn && !btn.disabled){ btn.textContent = "Stay on Free"; btn.setAttribute("data-label", "Stay on Free"); }
  });
  if(firstFit){
    var line = firstFit.querySelector(".pw-fit-yes");
    if(line) line.insertAdjacentHTML("beforeend", '<span class="pw-fit-tag">Lowest plan for this</span>');
  }
}

function openActionPaywall(ctx){
  ctx = ctx || {};
  var modal = document.getElementById("modal-paywall");
  if(!modal) return;
  var titleEl = modal.querySelector(".pw-title");
  var subEl   = modal.querySelector(".pw-sub");
  var eyeEl   = modal.querySelector(".pw-eyebrow span");
  var skipEl  = modal.querySelector(".pw-skip-btn");
  if(!_pwAction){
    _pwAction = { title: titleEl && titleEl.innerHTML, sub: subEl && subEl.textContent, eyebrow: eyeEl && eyeEl.textContent, skip: skipEl && skipEl.textContent };
  }
  _pwAction.ctx = ctx;
  var copy = _pwActionCopy(ctx);
  if(titleEl) titleEl.textContent = copy.title;
  if(subEl)   subEl.textContent = copy.sub;
  if(eyeEl)   eyeEl.textContent = "Choose your plan";
  if(skipEl)  skipEl.textContent = "Back to my work";
  _pwAction.setTitle = titleEl && titleEl.innerHTML;
  openPaywall(ctx);
}
window.openActionPaywall = openActionPaywall;

// Restores the modal's own copy — unless another caller has already set
// its own title (openLimitReached / openFreePaywall set theirs first).
function _pwEndAction(){
  if(!_pwAction) return;
  var modal = document.getElementById("modal-paywall");
  if(modal){
    var titleEl = modal.querySelector(".pw-title");
    if(titleEl && titleEl.innerHTML === _pwAction.setTitle){
      titleEl.innerHTML = _pwAction.title;
      var subEl = modal.querySelector(".pw-sub"); if(subEl) subEl.textContent = _pwAction.sub;
      var eyeEl = modal.querySelector(".pw-eyebrow span"); if(eyeEl) eyeEl.textContent = _pwAction.eyebrow;
    }
    var skipEl = modal.querySelector(".pw-skip-btn"); if(skipEl) skipEl.textContent = _pwAction.skip;
  }
  _pwAction = null;
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
  // V10 entitlements (plans.js / server planEntitlements.js): Research and
  // Autopilot are included from Starter, Oriven Chat from Creator.
  autopilot: {
    title:   "Autopilot is available from Starter.",
    sub:     "Starter includes the complete OrivenAI workflow, from Control Center to Autopilot.",
    upgrade: "starter"
  },
  research: {
    title:   "Research is available from Starter.",
    sub:     "Starter includes the complete OrivenAI workflow, from Control Center to Autopilot.",
    upgrade: "starter"
  },
  chat: {
    title:   "Oriven Chat is available from Creator.",
    sub:     "Creator adds Oriven Chat to the complete advertising workflow.",
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
  }
  // 'team' upgrade message removed (Autopilot Redesign + Team Removal
  // sprint) — Team is no longer a product surface, so no upgrade path to
  // it exists anymore; openLimitReached('team') has no remaining callers.
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
