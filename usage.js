// ════════════════════════════════════════════════════════════════
// USAGE TRACKING — plan limits, credit balance
// ════════════════════════════════════════════════════════════════
//
// The server (server/services/creditManager.js) is the real source of
// truth for credit balance/deduction — every generation route checks and
// deducts credits itself before running, so a request is correctly
// blocked even if this file were bypassed entirely (devtools, direct API
// calls, etc). What lives here is a soft, fast pre-flight check purely
// for UX: an accurate "you're out of credits" message before the network
// round-trip, and the sidebar/Settings display. Plan display data
// (names, feature lists) comes from ORIVEN_PLANS (plans.js).

// ── Plan cache — avoids hammering Supabase on every generation ─
var _cachedPlan   = null;
var _planCachedAt = 0;
var _PLAN_TTL     = 5 * 60 * 1000; // 5 minutes

async function _getCachedPlan(){
  var now = Date.now();
  if(_cachedPlan && (now - _planCachedAt) < _PLAN_TTL) return _cachedPlan;
  var plan = "free";
  try {
    if(typeof checkSubscriptionStatus === "function"){
      plan = (await checkSubscriptionStatus()) || "free";
    }
  } catch(_){}
  _cachedPlan   = plan;
  _planCachedAt = Date.now();
  return _cachedPlan;
}

function invalidatePlanCache(){
  _cachedPlan   = null;
  _planCachedAt = 0;
  _cachedCreditStatus = null;
  _creditStatusCachedAt = 0;
}

async function _getAccessToken(){
  try {
    var { data } = await SB.auth.getSession();
    return data && data.session ? data.session.access_token : null;
  } catch(_){ return null; }
}

// ── Credit status — real, backend-authoritative balance ───────
// Short TTL: long enough that a burst of gateUsage() calls in the same
// interaction doesn't hammer the endpoint, short enough that the badge
// and pre-flight checks stay close to real.
var _cachedCreditStatus   = null;
var _creditStatusCachedAt = 0;
var _CREDIT_STATUS_TTL    = 30 * 1000;

async function _getCreditStatus(forceRefresh){
  var now = Date.now();
  if(!forceRefresh && _cachedCreditStatus && (now - _creditStatusCachedAt) < _CREDIT_STATUS_TTL){
    return _cachedCreditStatus;
  }
  var token = await _getAccessToken();
  if(!token) return null;
  try {
    var resp = await fetch(API_BASE_URL + "/api/credits/status", {
      headers: { "Authorization": "Bearer " + token }
    });
    if(!resp.ok) return _cachedCreditStatus; // fall back to last-known on transient errors
    var data = await resp.json();
    _cachedCreditStatus   = data;
    _creditStatusCachedAt = now;
    return data;
  } catch(_){ return _cachedCreditStatus; }
}

// Optimistically reflects a spend in the cached copy so the UI updates
// instantly without waiting on a round trip — the server's own deduction
// (via reserveCredits in the route handler) is what's actually billed;
// this is purely a same-session display nicety, corrected on next fetch.
function _optimisticSpend(amount){
  if(!_cachedCreditStatus) return;
  _cachedCreditStatus.balance = Math.max(0, (_cachedCreditStatus.balance || 0) - amount);
}

// ── Check whether the user may generate (credit-aware) ───────
// creditCost: how many credits this generation consumes (default 1)
// Returns { allowed, message }
async function checkUsageLimit(creditCost){
  var cost   = creditCost || 1;
  var status = await _getCreditStatus();
  if(!status) return { allowed: false, message: "upgrade" };

  var remaining = Math.max(0, status.balance || 0);
  if(remaining >= cost) return { allowed: true, message: "" };

  var planName = (ORIVEN_PLANS[status.plan] && ORIVEN_PLANS[status.plan].name) || status.plan;
  var msg;
  if(remaining === 0){
    msg = "You've used all " + (status.monthlyAllowance || 0) + " credits on your " + planName + " plan this month. Upgrade to keep creating.";
  } else {
    msg = "This generation costs " + cost + " credit" + (cost !== 1 ? "s" : "") +
          ", but you only have " + remaining + " remaining. Upgrade to continue.";
  }
  return { allowed: false, message: msg };
}

// ── Reflect a spend client-side after a successful generation ─
// amount: credits deducted (default 1). The real deduction already
// happened server-side inside the route handler that ran the generation.
function consumeUsage(amount){
  var n = amount || 1;
  _optimisticSpend(n);
  _refreshUsageUI();
}

// ── True when the user is out of credits ───────────────────────
async function isLastFreeCreditUsed(){
  var status = await _getCreditStatus();
  if(!status || status.plan === "professional") return false;
  return (status.balance || 0) <= 0;
}

// ── Combined gate — check then consume ───────────────────────
// creditCost: credits required for this generation (default 1)
// Returns true if generation is allowed (credits deducted), false if blocked.
// This is a soft pre-flight check for UX only — the route handler the
// caller goes on to call performs the real, authoritative check server-side.
async function gateUsage(creditCost){
  if(typeof ORIVEN_DEV !== "undefined" && ORIVEN_DEV) return true;

  var cost = creditCost || 1;
  var plan = await _getCachedPlan();

  if(!ORIVEN_PLANS[plan]){
    var _fCampUsed = false;
    try { _fCampUsed = localStorage.getItem("oriven_free_campaign_used") === "1"; } catch(_){}
    if(_fCampUsed){
      if(typeof openPaywall === "function") openPaywall();
      return false;
    }
    // Allow the one free generation — mark campaign as used and refresh UI
    try { localStorage.setItem("oriven_free_campaign_used", "1"); } catch(_){}
    setTimeout(_refreshUsageUI, 0);
    return true;
  }

  var result = await checkUsageLimit(cost);
  if(!result.allowed){
    _showLimitMessage(result.message);
    setTimeout(function(){ if(typeof openPaywall === "function") openPaywall(); }, 500);
    return false;
  }
  consumeUsage(cost);

  isLastFreeCreditUsed().then(function(isLast){
    if(isLast && typeof showSoftPaywall === "function") setTimeout(showSoftPaywall, 450);
  });

  return true;
}

// ── In-feed limit message ─────────────────────────────────────
function _showLimitMessage(msg){
  var feed = document.getElementById("cwsFeed");
  if(!feed){ if(typeof toast === "function") toast("Credit limit reached — upgrade to continue", "warn"); return; }

  var prev = feed.querySelector(".usage-limit-msg");
  if(prev) prev.remove();

  var el = document.createElement("div");
  el.className = "usage-limit-msg";
  el.innerHTML =
    '<div class="usage-limit-inner">' +
      '<div class="usage-limit-icon">' +
        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8.5"/><path d="M10 6v5" stroke-linecap="round"/><circle cx="10" cy="14" r=".6" fill="currentColor"/></svg>' +
      '</div>' +
      '<div class="usage-limit-text">' +
        '<div class="usage-limit-title">Monthly credit limit reached</div>' +
        '<div class="usage-limit-sub">' + msg + '</div>' +
      '</div>' +
      '<button class="btn btn-p btn-sm usage-limit-cta" onclick="openPaywall()">Upgrade</button>' +
    '</div>';
  feed.appendChild(el);
  feed.scrollTop = feed.scrollHeight;
}

// ── Sidebar usage badge ───────────────────────────────────────
async function _refreshUsageUI(){
  var badge     = document.getElementById("usageBadge");
  var planLabel = document.getElementById("sbPlanLabel");
  if(!badge) return;

  var plan = await _getCachedPlan();
  var cfg  = ORIVEN_PLANS[plan];

  if(!cfg){
    var _freeUsed = false;
    try { _freeUsed = localStorage.getItem("oriven_free_campaign_used") === "1"; } catch(_){}
    var _freeCred = _freeUsed ? 0 : 1;
    badge.textContent = _freeCred + (_freeCred === 1 ? " campaign left" : " campaigns left");
    badge.className   = "usage-badge " + (_freeCred === 0 ? "usage-badge-empty" : "usage-badge-ok");
    if(planLabel){ planLabel.textContent = "Free"; planLabel.className = "sb-plan-label sb-plan-free"; }
    return;
  }

  var status = await _getCreditStatus();
  var total  = (status && status.monthlyAllowance) || cfg.credits || cfg.limit;
  var rem    = status ? Math.max(0, status.balance || 0) : total;
  var cls    = rem === 0 ? "usage-badge-empty" : rem <= Math.ceil(total * 0.1) ? "usage-badge-low" : "usage-badge-ok";

  badge.textContent = rem + " credits left";
  badge.className   = "usage-badge " + cls;
  if(planLabel){ planLabel.textContent = cfg.name; planLabel.className = "sb-plan-label sb-plan-" + plan; }
}

// ── Team nav — Professional only ──────────────────────────────
async function updateTeamNavVisibility(){
  // Every paid plan gets a team seat, not just Professional -- Starter and
  // Creator are capped at 1 (the owner, no invites possible), Professional
  // at 10 (team.js/_teamMax() and the server's own check in
  // /api/send-invite enforce the actual per-plan number).
  var plan    = await _getCachedPlan();
  var teamNav = document.getElementById("teamNavItem");
  if(teamNav) teamNav.style.display = (typeof ORIVEN_PLANS !== "undefined" && ORIVEN_PLANS[plan]) ? "" : "none";
}

// ── Priority Support nav/panel visibility — Professional only ─
async function updatePrioritySupportVisibility(){
  var plan = await _getCachedPlan();
  var el   = document.getElementById("prioritySupportPanel");
  if(el) el.style.display = plan === "professional" ? "" : "none";
}

// ── Browser timezone sync — feeds the once-per-local-day daily
// briefing (server falls back to this when profiles.timezone is unset).
// Fire-and-forget, only PATCHes when the detected zone actually changed.
async function _syncBrowserTimezone(){
  try {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if(!tz) return;
    var last = null;
    try { last = localStorage.getItem("oriven_tz_sent"); } catch(_){}
    if(last === tz) return;
    var token = await _getAccessToken();
    if(!token) return;
    await fetch(API_BASE_URL + "/api/profile/timezone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ timezone: tz })
    });
    try { localStorage.setItem("oriven_tz_sent", tz); } catch(_){}
  } catch(_){}
}

// ── Called from auth.js after sign-in ────────────────────────
function initUsageTracking(user){
  if(user && user.id){ if(!S.user) S.user = {}; S.user.id = user.id; }
  invalidatePlanCache();
  _getCreditStatus(true).then(function(){ _refreshUsageUI(); updateTeamNavVisibility(); updatePrioritySupportVisibility(); });
}

document.addEventListener("DOMContentLoaded", function(){ setTimeout(_refreshUsageUI, 1600); });
