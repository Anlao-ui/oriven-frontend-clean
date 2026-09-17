/* ════════════════════════════════════════════════════════════════
   ORIVEN Onboarding (rebuild)

   ACCOUNT CREATED → WELCOME → GOAL → WORKSPACE → PLAN → WORKSPACE

   Replaces the old spotlight product tour (auth.js — _OB_FRAMES /
   showOnboarding, retired: no longer called from _loadUserProfile /
   restartOnboarding) and the old, entirely unreachable "Brand
   Onboarding" 7-question questionnaire (removed — see removal note in
   auth.js). This file owns exactly the first three screens; the fourth
   (Plan / Payment) deliberately does NOT reinvent plan cards or Stripe —
   it hands off to the SAME modal-paywall / selectPlan() / continueOnFreePlan()
   architecture Settings → Subscription already uses (paywall.js, plans.js),
   via the existing (previously unused) _showHardPaywall().

   Server-trusted completion: onboarding_completed is only ever flipped by
   POST /api/onboarding/complete (server.js), called from here only after a
   genuinely completed path (real Free selection persisted, or a real paid
   plan re-read from the DB after Stripe). Never set on Welcome, never set
   on choosing a goal, never set merely because Checkout opened.

   window._obActive (auth.js) is intentionally NOT touched by this file —
   that flag belongs to the retired spotlight tour's own keydown handler.
   This overlay uses its own window._ob2Active so the two can never collide.
   ════════════════════════════════════════════════════════════════ */

// Stable IDs, same values as the sidebar's data-orv-page + the new
// profiles.primary_goal column (server.js ONBOARDING_GOALS) — and the same
// order as the real sidebar nav (Create → Research → Launch → Campaigns →
// Autopilot → Business), not the landing page ring's different ordering.
var OB2_GOALS = [
  { id: "create", name: "Create", desc: "Create advertising creative and campaign assets.",
    icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M13 8l-3-3M13 8l-3 3"/></svg>' },
  { id: "research", name: "Research", desc: "Understand markets, competitors, audiences and opportunities.",
    icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.3 10.3L14 14"/></svg>' },
  { id: "launch", name: "Launch", desc: "Prepare and launch advertising campaigns.",
    icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13.5V3M8 3L4.2 6.8M8 3l3.8 3.8"/><path d="M3 13.5h10"/></svg>' },
  { id: "campaigns", name: "Campaigns", desc: "Understand campaign performance and what changed.",
    icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.5" width="10" height="11" rx="1.5"/><path d="M6 7h4M6 9.5h4M6 12h2.5"/></svg>' },
  { id: "autopilot", name: "Autopilot", desc: "Automate the advertising rules you define.",
    icon: '<svg viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M8.8 1L3.6 9.2h3.5L6.2 15l6.2-8.7H9.1L8.8 1z"/></svg>' },
  { id: "business", name: "Business", desc: "Build ORIVEN's understanding of your business.",
    icon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2C5.5 2 3.5 4 3.5 6.3c0 1.4.7 2.6 1.7 3.4v1.8h5.6v-1.8c1-.8 1.7-2 1.7-3.4C12.5 4 10.5 2 8 2z"/><path d="M6.5 14h3"/></svg>' }
];

// goal id → [page, pageId] — the SAME nav target the sidebar's own buttons
// use (_orvNav), never a duplicated routing table.
var OB2_DEST = {
  create:    ["create", "page-create"],
  research:  ["research", "page-research"],
  launch:    ["launch", "page-launch"],
  campaigns: ["performance", "page-performance"],
  autopilot: ["autopilot", "page-autopilot"],
  business:  ["businessbrain", "page-business-brain"]
};

var _ob2Goal = null;     // in-memory selection, mirrors the persisted value once saved
var _ob2SaveErr = false;

function _ob2El(id){ return document.getElementById(id); }

// ── Entry point ──────────────────────────────────────────────────
// resumeGoal: pass the already-persisted primary_goal (from _loadUserProfile's
// own profile read) when resuming an incomplete account on reload/login/
// checkout-cancel — per spec, a saved goal is never asked for twice; resume
// goes straight to the one remaining required step (Plan).
function startOnboarding(resumeGoal){
  var overlay = _ob2El("ob2Overlay");
  if(!overlay) return;
  _obContext = "onboarding"; // existing var (auth.js) — lets selectPlan()/continueOnFreePlan()/the Stripe-return handler recognize onboarding mode without a second flag
  window._ob2Active = true;
  overlay.style.display = "flex";
  requestAnimationFrame(function(){ overlay.classList.add("ob2-visible"); });

  if(resumeGoal && OB2_DEST[resumeGoal]){
    _ob2Goal = resumeGoal;
    _ob2HideOverlay(true); // the overlay's own 3 screens aren't needed — go straight to Plan
    _ob2ShowPlanStep();
    return;
  }
  _ob2Goal = null;
  _ob2GoTo("welcome");
}
window.startOnboarding = startOnboarding;

function _ob2HideOverlay(instant){
  var overlay = _ob2El("ob2Overlay");
  if(!overlay) return;
  window._ob2Active = false;
  overlay.classList.remove("ob2-visible");
  if(instant){ overlay.style.display = "none"; return; }
  setTimeout(function(){ overlay.style.display = "none"; }, 220);
}

// ── Step navigation (Welcome → Goal → Workspace) ────────────────
function _ob2GoTo(step){
  ["welcome","goal","workspace"].forEach(function(s){
    var el = _ob2El("ob2Step" + _ob2Cap(s));
    if(el) el.hidden = (s !== step);
  });
  _ob2RenderProgress(step);
  if(step === "goal") _ob2RenderGoalStep();
  if(step === "workspace") _ob2RenderWorkspaceStep();
  var heading = document.querySelector('#ob2Step' + _ob2Cap(step) + ' [data-ob2-heading]');
  if(heading){ heading.setAttribute("tabindex","-1"); heading.focus(); }
}
function _ob2Cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function _ob2RenderProgress(step){
  var order = ["welcome","goal","workspace","plan"];
  var idx = order.indexOf(step) + 1;
  var wrap = _ob2El("ob2Progress");
  if(!wrap) return;
  wrap.innerHTML = order.map(function(_, i){
    return '<span class="ob2-dot' + (i + 1 === idx ? ' ob2-dot-active' : (i + 1 < idx ? ' ob2-dot-done' : '')) + '"></span>';
  }).join("");
  wrap.setAttribute("aria-label", "Step " + idx + " of 4");
}

window.ob2Next = function(from){
  if(from === "welcome") return _ob2GoTo("goal");
  if(from === "goal") return _ob2ConfirmGoal();
  if(from === "workspace") return _ob2ShowPlanStep();
};
window.ob2Back = function(from){
  if(from === "goal") return _ob2GoTo("welcome");
  if(from === "workspace") return _ob2GoTo("goal");
};

// ── Step 2: Goal selection ──────────────────────────────────────
function _ob2RenderGoalStep(){
  var grid = _ob2El("ob2GoalGrid");
  if(!grid) return;
  grid.innerHTML = OB2_GOALS.map(function(g){
    var sel = g.id === _ob2Goal;
    return '<button type="button" class="ob2-goal-card' + (sel ? " ob2-goal-card-sel" : "") + '" ' +
      'role="radio" aria-checked="' + (sel ? "true" : "false") + '" data-ob2-goal="' + g.id + '" onclick="_ob2SelectGoal(\'' + g.id + '\')">' +
      '<span class="ob2-goal-ic">' + g.icon + '</span>' +
      '<span class="ob2-goal-name">' + g.name + '</span>' +
      '<span class="ob2-goal-desc">' + g.desc + '</span>' +
    '</button>';
  }).join("");
  var cont = _ob2El("ob2GoalContinue");
  if(cont) cont.disabled = !_ob2Goal;
  var err = _ob2El("ob2GoalErr");
  if(err){ err.style.display = "none"; err.textContent = ""; }
}

window._ob2SelectGoal = function(id){
  _ob2Goal = id;
  document.querySelectorAll(".ob2-goal-card").forEach(function(c){
    var isSel = c.getAttribute("data-ob2-goal") === id;
    c.classList.toggle("ob2-goal-card-sel", isSel);
    c.setAttribute("aria-checked", isSel ? "true" : "false");
  });
  var cont = _ob2El("ob2GoalContinue");
  if(cont) cont.disabled = false;
};

async function _ob2ConfirmGoal(){
  if(!_ob2Goal) return;
  var btn = _ob2El("ob2GoalContinue");
  var err = _ob2El("ob2GoalErr");
  if(btn){ btn.disabled = true; btn.textContent = "Saving…"; }
  if(err) err.style.display = "none";
  try {
    var res = await apiFetch("/api/onboarding/goal", {
      method: "PUT",
      body: JSON.stringify({ goal: _ob2Goal })
    });
    if(!res.ok) throw new Error((res.data && res.data.error) || "Could not save your goal");
    _dbPrimaryGoal = _ob2Goal;
    _ob2GoTo("workspace");
  } catch(e){
    if(err){ err.textContent = "Couldn't save that — please try again."; err.style.display = "block"; }
    console.error("[Onboarding] goal save failed:", e.message);
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = "Continue"; }
  }
}

// ── Step 3: Workspace overview ──────────────────────────────────
function _ob2RenderWorkspaceStep(){
  var grid = _ob2El("ob2WsGrid");
  if(!grid) return;
  grid.innerHTML = OB2_GOALS.map(function(g){
    var isStart = g.id === _ob2Goal;
    return '<div class="ob2-ws-card' + (isStart ? " ob2-ws-card-start" : "") + '">' +
      (isStart ? '<span class="ob2-ws-tag">Your starting point</span>' : "") +
      '<span class="ob2-ws-ic">' + g.icon + '</span>' +
      '<span class="ob2-ws-name">' + g.name + '</span>' +
    '</div>';
  }).join("");
  var sub = _ob2El("ob2WsSub");
  var goalName = (OB2_GOALS.filter(function(g){ return g.id === _ob2Goal; })[0] || {}).name || "your goal";
  if(sub) sub.textContent = "You chose " + goalName + ". Here's the system around it — every product stays available whenever you need it.";
}

// ── Step 4: Plan / Payment — hands off to the real, existing paywall ──
function _ob2ShowPlanStep(){
  _ob2HideOverlay(true);
  _ob2RenderProgress("plan");

  var titleEl = document.querySelector("#modal-paywall .pw-title");
  var subEl   = document.querySelector("#modal-paywall .pw-sub");
  var eyeEl   = document.querySelector("#modal-paywall .pw-eyebrow span");
  if(eyeEl) eyeEl.textContent = "Choose Your Plan";
  if(titleEl) titleEl.innerHTML = "Choose your plan.";

  // Factual entitlement note only — never a fabricated recommendation. Only
  // shown when the chosen goal genuinely requires a plan above the account's
  // current one (checked against the same plan.featureFlags/autopilotLimit
  // data the real paywall cards themselves render from, plans.js).
  var note = _ob2EntitlementNote(_ob2Goal);
  if(subEl) subEl.textContent = note || "Pick the plan that fits. You can change this anytime in Settings.";

  if(typeof _showHardPaywall === "function") _showHardPaywall();
}

// Real entitlement fact, not a personalized pitch — e.g. "Autopilot is
// available with Professional." Returns null when the chosen goal has no
// plan restriction (Create/Launch/Campaigns/Business are available on
// every plan including Free) so the generic sub-copy is used instead.
function _ob2EntitlementNote(goalId){
  try {
    if(goalId === "research"){
      return "Research is available with Creator and Professional.";
    }
    if(goalId === "autopilot"){
      return "Autopilot is available with Professional.";
    }
  } catch(_){}
  return null;
}

// Called once onboarding's plan step has genuinely concluded (real Free
// selection persisted, or a real paid plan confirmed from the DB after
// Stripe) — never on Checkout merely opening. Marks completion server-side,
// then routes to the chosen goal's real destination via the SAME _orvNav
// the sidebar itself uses, letting the existing, real entitlement gates
// (e.g. Autopilot's Professional-only nav gate, app.html) explain access
// truthfully if the chosen plan doesn't actually include the chosen goal —
// this file never fabricates access and never hides the rest of ORIVEN.
async function _ob2Finish(){
  _paywallHard = false;
  var pw = document.getElementById("modal-paywall");
  if(pw) pw.classList.remove("pw-hard");
  _obContext = "tour";

  try {
    var res = await apiFetch("/api/onboarding/complete", { method: "POST" });
    if(res.ok && res.data){
      if(typeof res.data.primary_goal === "string") _dbPrimaryGoal = res.data.primary_goal;
    }
  } catch(e){
    console.error("[Onboarding] complete call failed (non-fatal, plan is already real):", e.message);
  }
  try { localStorage.removeItem("oriven_needs_onboarding"); } catch(_){}

  // _ob2Goal is in-memory only and does not survive the real page
  // navigation to/from Stripe (the paid path) -- _dbPrimaryGoal was just
  // freshly re-read from Supabase by this same page load's _loadUserProfile()
  // call, so it's the reliable fallback across that boundary.
  var goalId = _ob2Goal || (typeof _dbPrimaryGoal !== "undefined" ? _dbPrimaryGoal : null);
  var dest = OB2_DEST[goalId] || OB2_DEST.create;
  if(typeof _orvNav === "function") _orvNav(dest[0], dest[1]);
}
window._ob2Finish = _ob2Finish;
