/* ════════════════════════════════════════════════════════════════
   ORIVEN Onboarding — "start from the outcome"

   One welcome modal for new accounts, over the real dashboard:
     Welcome to OrivenAI → What would you like to do first?
       Create Your First Ad → Create → build → the ad, with its image free
                              (one-time welcome benefit) → plan step
       Explore OrivenAI     → plan step → the dashboard
   Research isn't offered: it (like Autopilot) is a Starter+ feature, and a
   Free account's first experience shouldn't lead into a locked page.

   The plan step is the shared plan modal (paywall.js openOnboardingPlans):
   Free is always selectable, paid plans go through the normal Stripe
   checkout. Before anything is made, "Back" returns to the welcome; after
   the first ad there is no Back — the user picks a plan, Free included.
   Accounts already on a paid plan skip it. No forced payment, and nothing
   here ever starts a paid action.

   The first-ad path needs the free image (services/firstAd.js, server-side,
   FREE_FIRST_AD_ENABLED). Without it, "Create Your First Ad" goes through
   the plan step first, as before.

   Who sees it, and where an account is in the flow, is decided by the
   server (GET /api/onboarding/state → stage, services/onboarding.js):
   'welcome', 'first_ad' (chose the first ad, free image still available),
   'choose_plan' (free image used) or 'done'. Existing accounts never see it.
   "Create Your First Ad" saves the goal with PUT /api/onboarding/goal without
   completing onboarding, so a refresh, another sign-in or another device
   returns to the same step; the free image can't be reset from the browser. Choosing or
   skipping is saved with POST /api/onboarding/complete once the plan step is
   resolved (Free chosen, or right before the Stripe redirect); if that
   request fails, the choice is kept on this device and retried on the next
   load (the modal is not shown again meanwhile). Interrupted before a plan
   was chosen (refresh, closed tab), the welcome simply shows again. Back
   from Stripe (paid or canceled), the user lands on the goal they chose.

   Also owned here, because they belong to a new user's first result:
   - the action paywall bridge: when the server refuses a Create/Research
     action (402/403, nothing spent), the work is saved as a draft and the
     plan modal explains why (paywall.js openActionPaywall);
   - drafts: Create/Research inputs survive the Stripe round trip and come
     back after a successful upgrade or a canceled checkout. Nothing is
     generated automatically — the user confirms the paid action again;
   - one subtle next-step suggestion after a new account's first result;
   - activation events (tracking.js → POST /api/events).
   ════════════════════════════════════════════════════════════════ */

var OB3_DEST = {
  create:   ["create", "page-create"],
  research: ["research", "page-research"],
  explore:  ["dashboard", "page-dashboard"]
};
var OB3_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

window._orvObState = null;   // last GET /api/onboarding/state result
var _ob3Busy = false;
var _ob3PlanGoal = null;     // goal while the plan step is open ('first_ad' after the first ad)
var _ob3BuildActive = false; // a Create build is running (its image may land before it's shown)
var _ob3LastGoal = null;     // for focus when coming back from the plan step

function _ob3El(id){ return document.getElementById(id); }
function _ob3Uid(){ try { return (typeof _currentUser !== "undefined" && _currentUser && _currentUser.id) || null; } catch(_){ return null; } }
function _ob3Key(name){ var u = _ob3Uid(); return u ? "oriven_" + name + "_" + u : null; }
function _ob3Get(name){ var k = _ob3Key(name); if(!k) return null; try { return localStorage.getItem(k); } catch(_){ return null; } }
function _ob3Set(name, v){ var k = _ob3Key(name); if(!k) return; try { if(v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch(_){} }
function _ob3Track(name, props){ if(typeof trackEvent === "function") trackEvent(name, null, props); }
function _ob3Plan(){ try { return (typeof _dbSubscriptionStatus !== "undefined" && _dbSubscriptionStatus) || "free"; } catch(_){ return "free"; } }
function _ob3Esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]; }); }

// Links from lifecycle emails: /app?start=create|research or /app?plans=1.
// Read now — sign-in later rewrites the URL to /app.
var _ob3DeepLink = (function(){
  try {
    var q = new URLSearchParams(window.location.search);
    var start = q.get("start");
    return { start: (start === "create" || start === "research") ? start : null, plans: q.get("plans") === "1" };
  } catch(_){ return { start: null, plans: false }; }
})();
function _ob3ApplyDeepLink(){
  var d = _ob3DeepLink; _ob3DeepLink = { start: null, plans: false }; // once
  if(d.start && typeof _orvNav === "function") _orvNav(d.start, OB3_DEST[d.start][1]);
  if(d.plans && typeof openPaywall === "function") setTimeout(function(){ openPaywall(); }, 300);
}

// ── Gate: called by auth.js once the app is visible ───────────────
window.orvOnboardingGate = async function(){
  var res;
  try { res = await apiFetch("/api/onboarding/state"); } catch(_){ _ob3ApplyDeepLink(); return; } // offline: show nothing, try next load
  if(!res || !res.ok || !res.data){ _ob3ApplyDeepLink(); return; }
  var st = res.data;
  window._orvObState = st;
  var pending = _ob3Get("ob_pending");
  // Back from Stripe after the onboarding plan step: open the chosen goal.
  var intent = _ob3Get("ob_intent");
  if(intent){
    _ob3Set("ob_intent", null);
    if(intent === "first_ad") setTimeout(function(){ if(!_ob3OpenFirstAdCampaign()) _ob3Go("create", 0); }, 300);
    else if(OB3_DEST[intent]) _ob3Go(intent, 300);
  }
  if(!st.eligible){ if(pending) _ob3Set("ob_pending", null); _ob3ApplyDeepLink(); return; }
  if(!pending && st.stage === "first_ad"){ _ob3EnterFirstAd({ resume: true }); return; }
  if(!pending && st.stage === "choose_plan"){ _ob3FirstAdReady({ resume: true }); return; }
  // Chosen here before; the save didn't land yet. ("skip" comes from before
  // the skip link was removed and is still saved as skipped.)
  if(pending){ _ob3Persist(pending === "skip" ? null : pending); _ob3ApplyDeepLink(); return; }
  startOnboarding();
};

// ── Welcome screen ───────────────────────────────────────────────
// opts.force: show regardless of eligibility (Settings → Restart, ?tour=1).
// opts.back: returning from the plan step (no new "shown" event).
function startOnboarding(opts){
  var overlay = _ob3El("ob2Overlay");
  if(!overlay) return;
  _ob3Busy = false;
  _ob3PlanGoal = null;
  if(!(opts && opts.back)) _ob3Set("ob_intent", null); // stale Stripe intent from an earlier attempt
  overlay.querySelectorAll(".ob3-choice").forEach(function(b){ b.disabled = false; });
  var err = _ob3El("ob3Err"); if(err){ err.hidden = true; err.textContent = ""; }
  window._ob2Active = true;
  overlay.style.display = "flex";
  requestAnimationFrame(function(){ overlay.classList.add("ob2-visible"); });
  document.addEventListener("keydown", _ob3Keys, true);
  var back = opts && opts.back && _ob3LastGoal && overlay.querySelector('.ob3-choice[data-ob3-goal="' + _ob3LastGoal + '"]');
  var h = back || _ob3El("ob3Title");
  setTimeout(function(){ if(h) h.focus(); }, 60);
  if(!(opts && opts.back)) _ob3Track("onboarding_shown", { source: opts && opts.force ? "restart" : "signup" });
}
window.startOnboarding = startOnboarding;

function _ob3Hide(){
  var overlay = _ob3El("ob2Overlay");
  window._ob2Active = false;
  document.removeEventListener("keydown", _ob3Keys, true);
  if(!overlay) return;
  overlay.classList.remove("ob2-visible");
  setTimeout(function(){ overlay.style.display = "none"; }, 200);
}

// Focus stays inside the dialog; arrow keys move between the choices.
function _ob3Keys(e){
  var overlay = _ob3El("ob2Overlay");
  if(!overlay || overlay.style.display === "none") return;
  var items = Array.prototype.slice.call(overlay.querySelectorAll("button:not([disabled])"));
  if(!items.length) return;
  var i = items.indexOf(document.activeElement);
  if(e.key === "Tab"){
    e.preventDefault();
    var n = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === -1 || i === items.length - 1 ? 0 : i + 1);
    items[n].focus();
  } else if(e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowLeft"){
    var choices = Array.prototype.slice.call(overlay.querySelectorAll(".ob3-choice:not([disabled])"));
    if(!choices.length) return;
    var c = choices.indexOf(document.activeElement);
    var fwd = e.key === "ArrowDown" || e.key === "ArrowRight";
    var next = c === -1 ? 0 : (c + (fwd ? 1 : -1) + choices.length) % choices.length;
    e.preventDefault();
    choices[next].focus();
  }
}

// goal: 'create' | 'research' | 'explore'. A Free account chooses a plan
// first (the shared plan modal); an account already on a paid plan goes
// straight to its goal. Nothing is saved until the plan step is resolved.
window.ob3Choose = function(goal){
  if(_ob3Busy || _ob3PlanGoal || !OB3_DEST[goal]) return;
  _ob3Track("onboarding_goal_selected", { goal: goal });
  _ob3LastGoal = goal;
  if(_ob3Plan() !== "free" || typeof openOnboardingPlans !== "function"){ _ob3Finish(goal); return; }
  if(goal === "create" && _ob3FreeAdAvailable()){ _ob3StartFirstAd(); return; }
  _ob3PlanGoal = goal;
  _ob3Hide();
  setTimeout(function(){
    if(_ob3PlanGoal === goal && !openOnboardingPlans(goal)){ _ob3PlanGoal = null; _ob3Finish(goal); }
  }, 120);
};

// Navigates at once; the save runs in the background so a slow or failed
// request never blocks the user.
// opts.stay: keep the current screen (the first ad's result).
function _ob3Finish(goal, opts){
  _ob3Busy = true;
  _ob3Set("ob_pending", goal);
  var st = window._orvObState;
  if(st){ st.eligible = false; st.stage = "done"; st.goal = goal === "explore" ? "business" : goal; }
  _ob3Hide();
  _ob3RemoveFirstAdNote();
  if(!(opts && opts.stay)) _ob3Go(goal, 0);
  _ob3Persist(goal);
}

function _ob3Go(goal, delay){
  setTimeout(function(){
    if(typeof _orvNav === "function") _orvNav(OB3_DEST[goal][0], OB3_DEST[goal][1]);
    if(goal === "create" || goal === "research") setTimeout(function(){ _ob3ShowIntro(goal, "choice"); }, 120);
  }, delay || 0);
}

// Called by auth.js when a plan is chosen in the plan modal: 'free' once the
// Free plan is confirmed, a paid plan id right before the Stripe redirect.
// Does nothing outside the onboarding plan step.
window.orvOnboardingPlanChosen = function(plan){
  var goal = _ob3PlanGoal;
  if(!goal) return false;
  _ob3PlanGoal = null;
  if(typeof endOnboardingPlans === "function") endOnboardingPlans();
  if(goal === "first_ad"){
    // After the first ad: stay on it. Free → done; paid → Stripe, and back
    // from Stripe the ad opens again (ob_intent "first_ad").
    if(plan === "free"){ _ob3Finish("create", { stay: true }); return true; }
    _ob3Busy = true;
    _ob3Set("ob_intent", "first_ad");
    _ob3Set("ob_pending", "create");
    var s1 = window._orvObState; if(s1){ s1.eligible = false; s1.stage = "done"; s1.goal = "create"; }
    _ob3Persist("create");
    return true;
  }
  if(plan === "free"){ _ob3Finish(goal); return true; }
  // Paid: Stripe takes over this tab. Onboarding is complete either way
  // (paying is optional); on return the user lands on their goal.
  _ob3Busy = true;
  _ob3Set("ob_intent", goal);
  _ob3Set("ob_pending", goal);
  if(window._orvObState){ window._orvObState.eligible = false; window._orvObState.goal = goal === "explore" ? "business" : goal; }
  _ob3Persist(goal);
  return true;
};

// The plan modal closed without a choice (Back, close button, Esc,
// backdrop): back to the welcome, with the same option focused.
function _ob3WatchPlanModal(){
  var m = _ob3El("modal-paywall");
  if(!m || typeof MutationObserver === "undefined") return;
  new MutationObserver(function(){
    if(!_ob3PlanGoal || m.classList.contains("open")) return;
    if(_ob3PlanGoal === "first_ad"){ setTimeout(function(){ if(_ob3PlanGoal === "first_ad") _ob3OpenFirstAdPlans(); }, 50); return; } // a choice is needed here
    _ob3PlanGoal = null;
    if(typeof endOnboardingPlans === "function") endOnboardingPlans();
    startOnboarding({ back: true });
  }).observe(m, { attributes: true, attributeFilter: ["class"] });
}

function _ob3Persist(goal){
  var body = goal ? { goal: goal } : { skipped: true };
  apiFetch("/api/onboarding/complete", { method: "POST", body: JSON.stringify(body) }).then(function(r){
    if(r && r.ok){
      _ob3Set("ob_pending", null);
      if(r.data && typeof r.data.primary_goal === "string"){ try { _dbPrimaryGoal = r.data.primary_goal; } catch(_){} }
    }
  }).catch(function(){ /* kept in ob_pending; retried on the next load */ });
}

// ── Intro panels on Create / Research ────────────────────────────
// "choice": after picking that goal — what it produces, a few static
// examples, and what the account's plan covers. "hint": one line for
// Explore users the first time they open the page. Both close for good.

var OB3_INTRO = {
  create: {
    page: "page-create", after: ".cr2-hero",
    eyebrow: "Your first ad",
    title: "Turn your idea into a professional advertisement.",
    text: "Describe what you sell and who it’s for. OrivenAI writes the campaign for the platform you choose: headlines, ad copy, targeting and visual concepts.",
    hint: "Create advertisements tailored to your brand.",
    cta: "Start creating", focus: "aicInput"
  },
  research: {
    page: "page-research", after: ".rsc-page-hdr",
    eyebrow: "Market research",
    title: "Understand your market and discover new opportunities.",
    text: "Ask a question about your market. Research searches live sources and maps what it finds into audiences, competitors, opportunities and recommendations.",
    hint: "Understand your market and discover new opportunities.",
    cta: "Write my question", focus: "researchQueryInput"
  }
};

function _ob3PlanNote(kind){
  var C = typeof CREDIT_COSTS !== "undefined" ? CREDIT_COSTS : null;
  var P = typeof ORIVEN_PLANS !== "undefined" ? ORIVEN_PLANS : null;
  if(!C || !P) return "";
  var planId = _ob3Plan(), plan = P[planId] || P.free;
  if(kind === "create"){
    var st = window._orvObState;
    if(planId === "free" && st && st.freeFirstAd && st.freeFirstAd.available){
      return "Your first complete ad is free: the campaign plus its ad image. After that, Free includes one campaign build a day; ad images use " + C.imageAd + " credits each, included from " + P.starter.name + ".";
    }
    if(planId === "free") return "On Free you can build one complete campaign a day: copy, targeting and visual concepts. Rendering ad images uses " + C.imageAd + " credits each, included from " + P.starter.name + ".";
    return "A complete image ad uses " + C.imageAdComplete + " credits (" + C.campaign + " for the campaign, " + C.imageAd + " for the image). " + plan.name + " includes " + orvFormatCredits(plan.credits) + " credits a month.";
  }
  if(!(plan.entitlements && plan.entitlements.research)){
    return "Research is included from " + P.starter.name + " (€" + P.starter.price + "/month); each investigation uses " + C.research + " credits.";
  }
  return "Each investigation uses " + C.research + " credits. " + plan.name + " includes " + orvFormatCredits(plan.credits) + " credits a month.";
}

function _ob3Examples(kind){
  if(kind === "create"){
    return '<figure class="obi-examples">' +
      '<div class="obi-ex-row">' +
        '<img src="/assets/ads/MA2.png" alt="Example social ad" loading="lazy">' +
        '<img src="/assets/ads/GA3.png" alt="Example display ad" loading="lazy">' +
        '<img src="/assets/ads/PA1.png" alt="Example pin ad" loading="lazy">' +
      '</div>' +
      '<figcaption>Example ads</figcaption></figure>';
  }
  var rows = [
    ["Audience", "Busy parents comparing meal-kit prices on mobile"],
    ["Competitors", "Three subscription brands lead with weekly discounts"],
    ["Opportunity", "Few competitors advertise same-day delivery"],
    ["Recommendation", "Lead with convenience in short video ads"]
  ];
  return '<figure class="obi-examples obi-examples-research">' +
    '<dl class="obi-findings">' + rows.map(function(r){ return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join("") + '</dl>' +
    '<figcaption>Example findings · your results come from live sources</figcaption></figure>';
}

function _ob3ShowIntro(kind, mode){
  var cfg = OB3_INTRO[kind];
  if(!cfg || _ob3Get("ob_intro_" + kind)) return;
  var page = _ob3El(cfg.page);
  if(!page || page.querySelector(".obi")) return;
  // Plan without this step (orivenOps.js gate, e.g. Research on Free): the
  // page shows its plan gate instead of the form. The example sits inside
  // the gate as a static preview, and the button opens the plans for it.
  var gate = page.classList.contains("orv-gated") ? page.querySelector(":scope > .orv-gate") : null;
  if(gate && mode === "hint") return;
  var anchor = gate ? gate.querySelector(".orv-gate-card") : page.querySelector(cfg.after);
  var el = document.createElement("section");
  el.className = "obi" + (mode === "hint" ? " obi-hint" : "") + (gate ? " obi-in-gate" : "");
  el.setAttribute("data-obi", kind);
  el.setAttribute("aria-label", mode === "hint" ? cfg.hint : cfg.eyebrow);
  if(mode === "hint"){
    el.innerHTML = '<p class="obi-hint-text">' + _ob3Esc(cfg.hint) + '</p>' +
      '<button type="button" class="obi-link" onclick="obIntroClose(\'' + kind + '\')">Got it</button>';
  } else {
    el.innerHTML =
      '<div class="obi-body">' +
        '<div class="obi-eyebrow">' + _ob3Esc(cfg.eyebrow) + '</div>' +
        '<h2 class="obi-title">' + _ob3Esc(cfg.title) + '</h2>' +
        '<p class="obi-text">' + _ob3Esc(cfg.text) + '</p>' +
        '<p class="obi-plan">' + _ob3Esc(_ob3PlanNote(kind)) + '</p>' +
        '<div class="obi-actions">' +
          (gate
            ? '<button type="button" class="obi-btn" onclick="orvOpenActionPaywall(\'' + kind + '\',{code:\'PLAN_REQUIRED\'})">See plans</button>'
            : '<button type="button" class="obi-btn" onclick="obIntroStart(\'' + kind + '\')">' + _ob3Esc(cfg.cta) + '</button>') +
          '<button type="button" class="obi-link" onclick="obIntroClose(\'' + kind + '\')">Skip the example</button>' +
        '</div>' +
      '</div>' + _ob3Examples(kind) +
      '<button type="button" class="obi-x" aria-label="Close" onclick="obIntroClose(\'' + kind + '\')">&times;</button>';
  }
  if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(el, anchor.nextSibling);
  else page.insertBefore(el, page.firstChild);
}

window.obIntroClose = function(kind){
  _ob3Set("ob_intro_" + kind, "1");
  var el = document.querySelector('.obi[data-obi="' + kind + '"]');
  if(el && el.parentNode) el.parentNode.removeChild(el);
};
window.obIntroStart = function(kind){
  window.obIntroClose(kind);
  var f = OB3_INTRO[kind] && _ob3El(OB3_INTRO[kind].focus);
  if(f){ try { f.focus({ preventScroll: false }); } catch(_){ f.focus(); } }
};

// Explore users: a one-line hint the first time Create/Research opens.
function _ob3WatchPages(){
  if(typeof MutationObserver === "undefined") return;
  ["create", "research"].forEach(function(kind){
    var page = _ob3El(OB3_INTRO[kind].page);
    if(!page) return;
    new MutationObserver(function(){
      if(!page.classList.contains("active")) return;
      var st = window._orvObState;
      if(st && st.newAccount && st.goal === "business" && !st.firstValueAt) _ob3ShowIntro(kind, "hint");
    }).observe(page, { attributes: true, attributeFilter: ["class"] });
  });
}

// ── Action events from Create / Research (app.html) ───────────────
// type: 'start' | 'success' | 'blocked'; detail.kind: 'create'|'research'
// (blocked may also carry kind 'image'), plus status/code/balance.
window.orvActionEvent = function(type, kind, detail){
  try { document.dispatchEvent(new CustomEvent("orv:action-" + type, { detail: Object.assign({ kind: kind }, detail || {}) })); } catch(_){}
};

document.addEventListener("orv:action-start", function(e){
  var k = e.detail && e.detail.kind;
  if(k === "create" || k === "research") _ob3Track(k + "_started");
});

document.addEventListener("orv:action-blocked", function(e){
  var d = e.detail || {};
  orvOpenActionPaywall(d.kind, d);
});

document.addEventListener("orv:action-success", function(e){
  var k = e.detail && e.detail.kind;
  var draft = _ob3ReadDraft();
  if(draft && draft.kind === k) _ob3Set("draft", null);
  var st = window._orvObState;
  if(!st || !st.newAccount || st.firstValueAt) return;
  st.firstValueAt = new Date().toISOString(); st.firstValueKind = k; // the server records the real one
  if(k === "create" && _ob3Plan() === "free") return; // its next step (Research) is a Starter+ feature
  setTimeout(function(){ _ob3NextStep(k); }, k === "create" ? 2500 : 600);
});

// ── Create Your First Ad ─────────────────────────────────────────
// The real Create page and the real build. The server grants the free image
// (services/firstAd.js: one per eligible new Free account, claimed
// atomically, released if the image fails, at most two attempts); the build
// renders one image while it is available (orvFirstAdImageOnly). When the
// image is on screen the plan step opens ("Your first ad is ready!").

function _ob3FreeAdAvailable(){
  var st = window._orvObState;
  return !!(st && st.freeFirstAd && st.freeFirstAd.available) && _ob3Plan() === "free";
}
// Read by app.html's image generation: render a single image while the
// account's free first image is still available.
window.orvFirstAdImageOnly = function(){ return _ob3FreeAdAvailable(); };
function _ob3InFirstAd(){ var st = window._orvObState; return !!(st && st.eligible && st.stage === "first_ad"); }

function _ob3StartFirstAd(){
  _ob3Busy = true;
  var st = window._orvObState; if(st){ st.goal = "create"; st.stage = "first_ad"; }
  // Goal only — onboarding completes at the plan step.
  apiFetch("/api/onboarding/goal", { method: "PUT", body: JSON.stringify({ goal: "create" }) }).catch(function(){});
  _ob3Hide();
  _ob3EnterFirstAd({ resume: false });
}

function _ob3EnterFirstAd(opts){
  _ob3Busy = true;
  // Back after a build whose image failed: reopen that campaign (its image
  // can be tried again there) instead of building a second campaign.
  if(opts && opts.resume && _ob3OpenFirstAdCampaign()){ _ob3ShowFirstAdNote(); return; }
  if(typeof _orvNav === "function") _orvNav("create", "page-create");
  setTimeout(function(){
    // Image ads (the free welcome ad is an image ad).
    if(window._ov3ContentMode === "videos" && typeof ov3SetMode === "function"){
      ov3SetMode("images", document.querySelector('.ov3-mode-btn[onclick*="\'images\'"]'));
    }
    _ob3ShowFirstAdNote();
  }, 120);
}

function _ob3ShowFirstAdNote(){
  var page = _ob3El("page-create");
  if(!page || page.querySelector(".obf")) return;
  var anchor = page.querySelector(".cr2-hero");
  var el = document.createElement("div");
  el.className = "obf"; el.setAttribute("role", "note");
  el.innerHTML = '<span class="obf-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8"/><path d="M2 7h20v5H2z"/><path d="M12 21V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg></span>' +
    '<span class="obf-txt"><strong>Your first image ad is on us.</strong> <span>A one-time welcome gift: build your campaign and its ad image is free. Video ads and extra images use credits.</span></span>';
  if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(el, anchor.nextSibling);
  else page.insertBefore(el, page.firstChild);
}
function _ob3RemoveFirstAdNote(){
  var el = document.querySelector("#page-create .obf");
  if(el && el.parentNode) el.parentNode.removeChild(el);
}

// The first ad's campaign (saved by Create on this device) back on screen.
function _ob3OpenFirstAdCampaign(){
  var id = _ob3Get("first_ad_camp");
  if(!id || typeof window._orvGetCampaigns !== "function" || typeof window._awOpenWorkspace !== "function") return false;
  var c = (window._orvGetCampaigns() || []).filter(function(x){ return x && x.id === id; })[0];
  if(!c || !c.pkg) return false;
  window._cgrCurrentCampId = c.id;
  window._awOpenWorkspace(c.pkg, c.prompt || "", c.id, c.platform || c.pkg.platform);
  return true;
}

// The free image is on screen (or both free attempts are used up): the
// plan step. resume: after a refresh / sign-in — reopen the ad first.
function _ob3FirstAdReady(opts){
  var st = window._orvObState;
  if(st){ st.stage = "choose_plan"; if(st.freeFirstAd) st.freeFirstAd.available = false; }
  _ob3Busy = true;
  _ob3RemoveFirstAdNote();
  if(opts && opts.resume) _ob3OpenFirstAdCampaign();
  // A few seconds to see the finished ad (and the "Campaign generated" toast to clear) first.
  setTimeout(_ob3OpenFirstAdPlans, opts && opts.resume ? 700 : 3200);
}
function _ob3OpenFirstAdPlans(){
  if(typeof openOnboardingPlans !== "function") return;
  _ob3PlanGoal = "first_ad";
  if(!openOnboardingPlans("first_ad")) _ob3PlanGoal = null;
}

document.addEventListener("orv:action-start", function(e){
  if(e.detail && e.detail.kind === "create") _ob3BuildActive = true;
});
document.addEventListener("orv:action-blocked", function(e){
  if(e.detail && e.detail.kind === "create") _ob3BuildActive = false;
});
document.addEventListener("orv:build-revealed", function(e){
  _ob3BuildActive = false;
  if(!_ob3InFirstAd()) return;
  var d = e.detail || {};
  if(d.campId) _ob3Set("first_ad_camp", d.campId);
  if(d.mode === "videos") return; // video isn't the free ad; normal credit rules apply
  if(d.creativeReady){ _ob3FirstAdReady(); return; }
  _ob3AfterImageFailure();
});
// The server released the free image (unless both attempts are used) — ask
// it which step comes next.
function _ob3AfterImageFailure(){
  apiFetch("/api/onboarding/state").then(function(r){
    var s = r && r.ok && r.data;
    if(s){ window._orvObState = s; }
    if(s && s.stage === "choose_plan"){ _ob3FirstAdReady(); return; }
    _ob3ShowImageRetry();
  }).catch(function(){});
}
// The free image failed: one quiet line on the result with a retry (the
// server allows a second free attempt; the build itself isn't repeated).
function _ob3ShowImageRetry(){
  var host = document.querySelector('#page-ad-workspace.active') || document.querySelector('#page-campaign-results.active') || _ob3El('page-create');
  if(!host || host.querySelector('.obn-retry')) return;
  var el = document.createElement('div');
  el.className = 'obn obn-retry'; el.setAttribute('role', 'status');
  el.innerHTML = '<span class="obn-text">Your campaign is saved, but its image couldn’t be created. Your free first ad hasn’t been used.</span>' +
    (typeof window.cgrRegenCreative === 'function' ? '<button type="button" class="obn-link">Try the image again &rarr;</button>' : '');
  var btn = el.querySelector('.obn-link');
  if(btn) btn.addEventListener('click', function(){
    if(el.parentNode) el.parentNode.removeChild(el);
    window.cgrRegenCreative(0);
  });
  host.insertBefore(el, host.firstChild);
}

// A retried image failed (outside a build): the server knows whether a free
// attempt is left.
document.addEventListener("orv:image-failed", function(){
  if(_ob3BuildActive || !_ob3InFirstAd()) return;
  _ob3AfterImageFailure();
});

// An image that lands outside a build (trying a failed image again).
document.addEventListener("orv:image-ready", function(e){
  if(_ob3BuildActive || !_ob3InFirstAd()) return;
  var d = e.detail || {};
  if(d.campId) _ob3Set("first_ad_camp", d.campId);
  _ob3FirstAdReady();
});

// ── Action paywall bridge ────────────────────────────────────────
// action: 'create' | 'image' | 'research'. Saves the work first.
window.orvOpenActionPaywall = function(action, info){
  info = info || {};
  if(action !== "create" && action !== "image" && action !== "research") action = "create";
  _ob3SaveDraft(action === "research" ? "research" : "create");
  _ob3Track("paywall_shown", { action: action, reason: info.code ? String(info.code).toLowerCase() : (info.status === 402 ? "credits" : "plan"), plan: _ob3Plan() });
  if(typeof openActionPaywall === "function") openActionPaywall({ action: action, code: info.code || null, balance: info.balance });
  else if(typeof openPaywall === "function") openPaywall();
};

// ── Drafts (this device only; prompts never leave the browser) ─────
function _ob3ReadDraft(){
  var raw = _ob3Get("draft");
  if(!raw) return null;
  try {
    var d = JSON.parse(raw);
    if(!d || !d.kind || !d.at || Date.now() - d.at > OB3_DRAFT_TTL_MS){ _ob3Set("draft", null); return null; }
    return d;
  } catch(_){ _ob3Set("draft", null); return null; }
}

function _ob3SaveDraft(kind){
  var data = null;
  if(kind === "create"){
    var ta = _ob3El("aicInput");
    var goal = document.querySelector(".cr2-goal-card.cr2-goal-card-on");
    var plat = document.querySelector(".cr2-pp.cr2-pp-on");
    data = {
      prompt: ta ? String(ta.value || "").slice(0, 4000) : "",
      goal: goal ? goal.getAttribute("data-goal") : null,
      platform: plat ? plat.getAttribute("data-plat") : null,
      mode: window._ov3ContentMode || "images"
    };
    if(!data.prompt) return;
  } else {
    var q = _ob3El("researchQueryInput");
    data = {
      question: q ? String(q.value || "").slice(0, 500) : "",
      focus: (typeof _researchSelectedFocus !== "undefined" && Array.isArray(_researchSelectedFocus)) ? _researchSelectedFocus.slice(0, 6) : [],
      urls: (typeof _researchUrls !== "undefined" && Array.isArray(_researchUrls)) ? _researchUrls.slice(0, 5) : []
    };
    if(!data.question) return;
  }
  _ob3Set("draft", JSON.stringify({ kind: kind, at: Date.now(), data: data }));
}

// Called after Stripe returns (reason: 'payment' | 'canceled'). Puts the
// saved work back on its page. Returns true when a draft was restored.
window.orvResumeDraft = function(reason){
  var d = _ob3ReadDraft();
  if(!d) return false;
  if(d.kind === "create") _ob3RestoreCreate(d.data || {});
  else if(d.kind === "research") _ob3RestoreResearch(d.data || {});
  else return false;
  _ob3Track("draft_restored", { kind: d.kind, reason: reason || "return" });
  if(typeof orvToast === "function"){
    orvToast(d.kind === "research"
      ? "Your question is back. Review it and run the research when you’re ready."
      : "Your brief is back. Review it and generate when you’re ready.", "info");
  }
  return true;
};

function _ob3RestoreCreate(v){
  if(typeof _orvNav === "function") _orvNav("create", "page-create");
  setTimeout(function(){
    var ta = _ob3El("aicInput");
    if(ta && v.prompt){
      ta.value = v.prompt;
      try { ta.dispatchEvent(new Event("input", { bubbles: true })); } catch(_){}
    }
    if(v.platform){
      var pill = document.querySelector('.cr2-pp[data-plat="' + v.platform + '"]');
      if(pill && !pill.classList.contains("cr2-pp-on")) pill.click();
    }
    if(v.goal){
      var g = document.querySelector('.cr2-goal-card[data-goal="' + v.goal + '"]');
      if(g && !g.classList.contains("cr2-goal-card-on")) g.click();
    }
    if(v.mode && v.mode !== window._ov3ContentMode && typeof ov3SetMode === "function"){
      var mb = document.querySelector('.ov3-mode-btn[onclick*="\'' + v.mode + '\'"]');
      ov3SetMode(v.mode, mb);
    }
    if(ta) ta.focus();
  }, 150);
}

function _ob3RestoreResearch(v){
  if(typeof _orvNav === "function") _orvNav("research", "page-research");
  setTimeout(function(){
    var q = _ob3El("researchQueryInput");
    if(q && v.question){
      q.value = v.question;
      try { q.dispatchEvent(new Event("input", { bubbles: true })); } catch(_){}
    }
    (v.focus || []).forEach(function(key){
      var b = document.querySelector('.rsc-focus-pill[data-focus="' + key + '"]');
      if(b && b.getAttribute("aria-pressed") !== "true") b.click();
    });
    if(Array.isArray(v.urls) && v.urls.length && typeof _researchUrls !== "undefined"){
      _researchUrls = v.urls.slice(0, 5);
      if(typeof _researchRenderUrlChips === "function") _researchRenderUrlChips();
    }
    if(q) q.focus();
  }, 150);
}

// ── One subtle next step after a new account's first result ───────
// The Create result is shown in the Ad Editing Workspace when it opens
// (below its chat), otherwise on the results page. Waits for the result to
// be revealed (the build animation finishes first), up to ~20s.
function _ob3NextStep(kind, tries){
  tries = tries || 0;
  var cfg = kind === "create"
    ? { text: "Want to understand your audience better?", link: "Explore Research", go: ["research", "page-research"], target: "research" }
    : { host: "researchMapView", text: "Turn these insights into your next advertisement.", link: "Open Create", go: ["create", "page-create"], target: "create" };
  if(kind === "create"){
    var ws = _ob3El("page-ad-workspace"), res = _ob3El("page-campaign-results");
    if(ws && ws.classList.contains("active")){ cfg.host = "page-ad-workspace"; cfg.after = "awChatFeed"; }
    else if(res && res.classList.contains("active") && !document.querySelector(".ofb[data-state='building']")){ cfg.host = "page-campaign-results"; cfg.after = "cgrBackBar"; }
    else { if(tries < 40) setTimeout(function(){ _ob3NextStep(kind, tries + 1); }, 500); return; }
  }
  var host = _ob3El(cfg.host);
  if(!host || host.querySelector(".obn")) return;
  var el = document.createElement("div");
  el.className = "obn";
  el.setAttribute("role", "note");
  el.innerHTML = '<span class="obn-text">' + _ob3Esc(cfg.text) + '</span>' +
    '<button type="button" class="obn-link">' + _ob3Esc(cfg.link) + ' &rarr;</button>' +
    '<button type="button" class="obn-x" aria-label="Dismiss">&times;</button>';
  el.querySelector(".obn-link").addEventListener("click", function(){
    _ob3Track("next_step_clicked", { target: cfg.target });
    if(el.parentNode) el.parentNode.removeChild(el);
    if(typeof _orvNav === "function") _orvNav(cfg.go[0], cfg.go[1]);
  });
  el.querySelector(".obn-x").addEventListener("click", function(){ if(el.parentNode) el.parentNode.removeChild(el); });
  var after = cfg.after && _ob3El(cfg.after);
  if(after && after.parentNode) after.parentNode.insertBefore(el, after.nextSibling);
  else host.insertBefore(el, host.firstChild);
}

function _ob3Watch(){ _ob3WatchPages(); _ob3WatchPlanModal(); }
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", _ob3Watch);
else _ob3Watch();
