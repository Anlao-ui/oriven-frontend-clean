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
  // The five access periods, the same for everyone (plans.js). An account
  // that already has access can buy another period: its credits arrive now
  // and its time is added after the current access ends.
  var grid = document.getElementById("pwPlanGrid");
  if(grid && typeof renderPWPricingCards === "function") renderPWPricingCards(grid, ORIVEN_PERIOD_PLANS);
  _pwRenderAccessNote();
}

// One line under the title: when the current access ends (account with
// access), or the "explore first" way out (onboarding: no plan needed to
// look around). Rebuilt on every open.
function _pwRenderAccessNote(){
  var modal = document.getElementById("modal-paywall");
  var grid = document.getElementById("pwPlanGrid");
  if(!modal || !grid) return;
  var old = modal.querySelector(".pw-access-note"); if(old && old.parentNode) old.parentNode.removeChild(old);
  var acc = (typeof window.orvAccess === "function") ? window.orvAccess() : null;
  var onboarding = !!(_pwAction && _pwAction.ctx && _pwAction.ctx.onboarding);
  var html = "";
  if(acc && acc.active && acc.expiresAt){
    html = "Your access runs until " + _pwDate(acc.expiresAt) + ". A new plan adds its credits right away and its time after that date.";
  } else if(onboarding){
    html = 'Not ready to choose? <button type="button" class="pw-explore-btn" onclick="continueWithoutPlan()">Explore first</button> and pick a plan when you want to create, research or launch.';
  }
  if(!html) return;
  var p = document.createElement("p");
  p.className = "pw-access-note";
  p.innerHTML = html;
  grid.parentNode.insertBefore(p, grid);
}
function _pwDate(iso){
  try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }); } catch(_){ return String(iso).slice(0, 10); }
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
  var noAccess = ctx.code === "SUBSCRIPTION_REQUIRED" || ctx.code === "PLAN_REQUIRED" || _pwCurrentPlan() === "free";
  if(ctx.action === "research"){
    return {
      title: "You’re ready to research your market.",
      sub: noAccess
        ? "Research is part of every OrivenAI plan. Each investigation uses " + C.research + " credits. Your question is saved."
        : "Each investigation uses " + C.research + " credits" + have + ". Your question is saved."
    };
  }
  if(ctx.action === "image"){
    return { title: "You’re ready to create your ad.",
      sub: noAccess
        ? "Ad images are part of every OrivenAI plan; each uses " + C.imageAd + " credits. Your campaign and brief are saved."
        : "Rendering an ad image uses " + C.imageAd + " credits" + have + ". Your campaign and brief are saved." };
  }
  if(noAccess){
    return { title: "You’re ready to create your ad.",
      sub: "Creating ads is part of every OrivenAI plan. Choose how long you want access; nothing renews automatically. Your brief is saved." };
  }
  return { title: "You’re ready to create your ad.",
    sub: "Building a campaign uses " + C.campaign + " credits" + have + ". Your brief is saved." };
}

// What a plan's credits cover for the action (every plan includes every feature).
function _pwPlanFit(plan, ctx){
  var C = CREDIT_COSTS;
  if(!plan || !plan.credits) return null;
  if(ctx.action === "research") return { ok: true, text: "Up to " + orvFormatCredits(Math.floor(plan.credits / C.research)) + " investigations" };
  return { ok: true, text: "Up to " + orvFormatCredits(Math.floor(plan.credits / C.imageAdComplete)) + " complete image ads" };
}

function _pwRenderActionFit(ctx){
  var grid = document.getElementById("pwPlanGrid");
  if(!grid || typeof ORIVEN_PERIOD_PLANS === "undefined") return;
  ORIVEN_PERIOD_PLANS.forEach(function(p){
    var btn = document.getElementById("paywall-btn-" + p.id);
    var card = btn && btn.closest ? btn.closest(".pw-card") : null;
    if(!card) return;
    var fit = _pwPlanFit(p, ctx);
    if(!fit) return;
    var el = document.createElement("div");
    el.className = "pw-fit " + (fit.ok ? "pw-fit-yes" : "pw-fit-no");
    el.innerHTML = '<span class="pw-fit-ic" aria-hidden="true">' + (fit.ok ? "✓" : "–") + '</span><span>' + fit.text + '</span>';
    var anchor = card.querySelector(".pw-credits-inline");
    if(anchor && anchor.nextSibling) card.insertBefore(el, anchor.nextSibling); else card.appendChild(el);
  });
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

// ════════════════════════════════════════════════════════════════
// ONBOARDING PLAN STEP — the same modal, opened from the welcome tour
// (onboarding.js) when a new account without a plan picks what to do first.
// The five plans use the normal Stripe checkout (selectPlan); "Explore
// first" (continueWithoutPlan) finishes onboarding without a plan. For
// Create each card also says what its credits cover. "Back" returns to the
// welcome.
//   goal: 'create' | 'explore'. ('first_ad' belonged to the retired free
//   first ad; it is kept so an old saved stage still opens the plans.)
// ════════════════════════════════════════════════════════════════
var _PW_ONBOARDING_COPY = {
  create:   { eyebrow: "Your first ad",   title: "Choose how long you want OrivenAI.", sub: "Every plan includes the full product; plans differ only in period, price and credits. You pay once, and nothing renews automatically." },
  explore:  { eyebrow: "Your workspace",  title: "Choose how long you want OrivenAI.", sub: "Every plan includes the full product; plans differ only in period, price and credits. You pay once, and nothing renews automatically." },
  first_ad: { eyebrow: "Your first ad",   title: "Choose how long you want OrivenAI.", sub: "Every plan includes the full product; plans differ only in period, price and credits. You pay once, and nothing renews automatically." }
};

function openOnboardingPlans(goal){
  var modal = document.getElementById("modal-paywall");
  if(!modal || !_PW_ONBOARDING_COPY[goal]) return false;
  var titleEl = modal.querySelector(".pw-title");
  var subEl   = modal.querySelector(".pw-sub");
  var eyeEl   = modal.querySelector(".pw-eyebrow span");
  var skipEl  = modal.querySelector(".pw-skip-btn");
  if(!_pwAction){
    _pwAction = { title: titleEl && titleEl.innerHTML, sub: subEl && subEl.textContent, eyebrow: eyeEl && eyeEl.textContent, skip: skipEl && skipEl.textContent };
  }
  _pwAction.ctx = { onboarding: goal, action: goal === "explore" ? null : "create" };
  var copy = _PW_ONBOARDING_COPY[goal];
  if(titleEl) titleEl.textContent = copy.title;
  if(subEl)   subEl.textContent = copy.sub;
  if(eyeEl)   eyeEl.textContent = copy.eyebrow;
  if(skipEl)  skipEl.textContent = "Back";
  _pwAction.setTitle = titleEl && titleEl.innerHTML;
  modal.classList.add("pw-onboarding");
  _renderPaywallCards();
  if(_pwAction.ctx.action) _pwRenderActionFit(_pwAction.ctx);
  // No paywall_shown event here: lifecycle emails read it as a blocked
  // action. onboarding_goal_selected + plan_selected cover this step.
  if(typeof openModal === "function") openModal("modal-paywall");
  return true;
}
window.openOnboardingPlans = openOnboardingPlans;
window.endOnboardingPlans = function(){ _pwEndAction(); };

// ════════════════════════════════════════════════════════════════
// KEYBOARD — however the plan modal opens (openPaywall, action, onboarding,
// limit, free): focus moves to the first plan button, Tab stays inside the
// modal, Esc closes it (except the hard paywall, which closePaywall() and
// app.js already keep open), and focus returns to where it was.
// ════════════════════════════════════════════════════════════════
(function(){
  var _pwReturnFocus = null;
  function modal(){ return document.getElementById("modal-paywall"); }
  function isOpen(m){ return !!m && m.classList.contains("open"); }
  function focusables(m){
    return Array.prototype.slice.call(m.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])"))
      .filter(function(el){ return el.offsetParent !== null; });
  }
  function watch(){
    var m = modal();
    if(!m || typeof MutationObserver === "undefined") return;
    var wasOpen = isOpen(m);
    new MutationObserver(function(){
      var open = isOpen(m);
      if(open === wasOpen) return;
      wasOpen = open;
      if(open){
        var a = document.activeElement;
        _pwReturnFocus = (a && a !== document.body && !m.contains(a)) ? a : null;
        setTimeout(function(){
          if(!isOpen(m) || m.contains(document.activeElement)) return;
          var first = m.querySelector("#pwPlanGrid .pw-btn:not([disabled])") || m.querySelector(".pw-close-btn");
          if(first) first.focus();
        }, 80);
      } else {
        var r = _pwReturnFocus; _pwReturnFocus = null;
        // Only if nothing else (e.g. the welcome modal) has taken focus meanwhile.
        setTimeout(function(){
          if(r && r.isConnected && r.offsetParent !== null && (!document.activeElement || document.activeElement === document.body || m.contains(document.activeElement))){
            try { r.focus(); } catch(_){}
          }
        }, 120);
      }
    }).observe(m, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("keydown", function(e){
      if(!isOpen(m)) return;
      if(e.key === "Escape"){
        if(m.classList.contains("pw-hard") || m.classList.contains("pw-choose")) return;
        e.preventDefault();
        if(typeof closePaywall === "function") closePaywall(); else m.classList.remove("open");
        return;
      }
      if(e.key !== "Tab") return;
      var items = focusables(m);
      if(!items.length) return;
      var i = items.indexOf(document.activeElement);
      e.preventDefault();
      items[e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === -1 || i === items.length - 1 ? 0 : i + 1)].focus();
    }, true);
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();
})();

// Restores the modal's own copy — unless another caller has already set
// its own title (openLimitReached / openFreePaywall set theirs first).
function _pwEndAction(){
  if(!_pwAction) return;
  var modal = document.getElementById("modal-paywall");
  if(modal){
    modal.classList.remove("pw-onboarding", "pw-choose");
    var obNote = modal.querySelector(".pw-ob-note"); if(obNote && obNote.parentNode) obNote.parentNode.removeChild(obNote);
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

// One product: every plan includes every feature, so a limit message never
// names a "higher" plan. Running out of credits or access means buying
// another period (its credits arrive at once).
var _LIMIT_MSGS = {
  brand:      { title: "Brand limit reached.",      sub: "This is the most brands one workspace can manage right now." },
  competitor: { title: "Competitor limit reached.", sub: "Remove a competitor you no longer follow to add another." },
  website:    { title: "Website limit reached.",    sub: "Remove a website you no longer monitor to add another." },
  credits:    { title: "Your credits are used.",    sub: "Another plan adds its credits right away; its time starts when your current access ends." },
  access:     { title: "Your access has ended.",    sub: "Choose a plan to continue. Your work is still in your account." },
  autopilot:  { title: "Automations are part of every plan.", sub: "Choose how long you want access; nothing renews automatically." },
  research:   { title: "Research is part of every plan.",     sub: "Choose how long you want access; nothing renews automatically." },
  chat:       { title: "Oriven Chat is part of every plan.",  sub: "Choose how long you want access; nothing renews automatically." },
  autopilot_creator: { title: "Automation limit reached.", sub: "Pause or delete an automation you no longer need to add another." },
  intelligence: { title: "AI analysis is part of every plan.", sub: "Choose how long you want access; each analysis uses credits from your plan." }
};

function openLimitReached(type){
  // Without access every limit is really "choose a plan".
  try {
    if(typeof _dbSubscriptionStatus !== "undefined" && _dbSubscriptionStatus === "free" && ["credits", "intelligence"].indexOf(type) !== -1) type = "access";
  } catch(_){}
  var m = _LIMIT_MSGS[type] || { title: "Plan limit reached.", sub: "Choose a plan to continue." };
  var titleEl = document.querySelector("#modal-paywall .pw-title");
  var subEl   = document.querySelector("#modal-paywall .pw-sub");
  if(titleEl) titleEl.textContent = m.title;
  if(subEl)   subEl.textContent = m.sub;
  openPaywall();
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
