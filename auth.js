// ═══ AUTH + DATABASE ══════════════════════════════════════════
// Handles: sign up, sign in, sign out, session restore,
//          BrandCore save/load from Supabase.

var _currentUser          = null;
var _onboardingShown      = false;
var _postPayment          = false; // True when landing from Stripe ?success=true — suppresses subscription gate
var _dbPlanSet            = false; // True once _loadUserProfile() confirms a paid plan from Supabase
var _dbSubscriptionStatus = null;  // null = not yet loaded | "free"/"creator"/"professional"/"starter"/"agency" = from Supabase

// ── Route helpers ─────────────────────────────────────────────

function _setAppRoute(route){
  try { history.replaceState(null, "", route); } catch(_){}
  // Fire a page_view so Google Ads URL-based conversions trigger on /app
  if(typeof gtag === "function"){
    gtag("event", "page_view", { page_path: route, page_title: document.title });
  }
}

// ── UI helpers ────────────────────────────────────────────────

function showApp(){
  var overlay = document.getElementById("authOverlay");
  var app     = document.querySelector(".app");
  if(overlay) overlay.style.display = "none";
  if(app)     app.style.display     = "";
}

function showAuthPage(){
  var overlay = document.getElementById("authOverlay");
  var app     = document.querySelector(".app");
  if(overlay) overlay.style.display = "flex";
  if(app)     app.style.display     = "none";
}

function switchAuthTab(tab){
  var siForm = document.getElementById("authSigninForm");
  var suForm = document.getElementById("authSignupForm");
  var siTab  = document.getElementById("authTabSignin");
  var suTab  = document.getElementById("authTabSignup");
  var errSi  = document.getElementById("authErrorSi");
  var errSu  = document.getElementById("authErrorSu");
  if(errSi){ errSi.textContent=""; errSi.style.display="none"; }
  if(errSu){ errSu.textContent=""; errSu.style.display="none"; }
  var activeStyle   = "color:var(--gm);border-bottom:2px solid var(--gm);margin-bottom:-1px";
  var inactiveStyle = "color:var(--muted)";
  if(tab === "signin"){
    siForm.style.display = "";
    suForm.style.display = "none";
    if(siTab) siTab.setAttribute("style", siTab.getAttribute("style").replace(/color:[^;]+;border-bottom:[^;]+;margin-bottom:[^;]+|color:[^;]+/,"") + activeStyle);
    if(suTab) suTab.setAttribute("style", suTab.getAttribute("style").replace(/color:[^;]+;border-bottom:[^;]+;margin-bottom:[^;]+|color:[^;]+/,"") + inactiveStyle);
  } else {
    siForm.style.display = "none";
    suForm.style.display = "";
    if(siTab) siTab.setAttribute("style", siTab.getAttribute("style").replace(/color:[^;]+;border-bottom:[^;]+;margin-bottom:[^;]+|color:[^;]+/,"") + inactiveStyle);
    if(suTab) suTab.setAttribute("style", suTab.getAttribute("style").replace(/color:[^;]+;border-bottom:[^;]+;margin-bottom:[^;]+|color:[^;]+/,"") + activeStyle);
  }
}

function showAuthError(formType, msg){
  var id = formType === "signin" ? "authErrorSi" : "authErrorSu";
  var el = document.getElementById(id);
  if(el){ el.textContent = msg; el.style.display = "block"; }
}

function _authMapError(err){
  var msg = (err && err.message) ? err.message : String(err || "");
  if(/invalid login credentials|invalid_credentials/i.test(msg))
    return "Incorrect email or password. Please try again.";
  if(/email not confirmed/i.test(msg))
    return "Please verify your email address before signing in.";
  if(/user already registered|already registered|already in use/i.test(msg))
    return "An account with this email already exists. Try signing in instead.";
  if(/unable to validate email|invalid.*email/i.test(msg))
    return "Please enter a valid email address.";
  if(/password.*at least/i.test(msg))
    return "Password must be at least 6 characters.";
  if(/signup.*disabled|signups.*not allowed/i.test(msg))
    return "Account creation is currently unavailable.";
  if(/too many requests|rate.?limit/i.test(msg))
    return "Too many attempts — please wait a moment and try again.";
  if(/network|failed to fetch/i.test(msg))
    return "Connection error. Please check your internet and try again.";
  return msg || "Something went wrong. Please try again.";
}

function _authClearInputErr(ids){
  ids.forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.classList.remove("inp-err");
  });
}

function _authMarkInputErr(ids){
  ids.forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.classList.add("inp-err");
  });
}

function setAuthBtnLoading(btnId, loading){
  var btn = document.getElementById(btnId);
  if(!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? "Please wait…" : btn.getAttribute("data-label");
}

// ── Sign In ───────────────────────────────────────────────────

async function handleSignIn(){
  var email = (document.getElementById("siEmail").value||"").trim();
  var pass  = document.getElementById("siPass").value||"";
  _authClearInputErr(["siEmail","siPass"]);
  if(!email || !pass){
    showAuthError("signin","Enter your email and password.");
    _authMarkInputErr(!email ? ["siEmail"] : ["siPass"]);
    return;
  }
  var errEl = document.getElementById("authErrorSi");
  if(errEl){ errEl.style.display="none"; }
  var btn = document.getElementById("authSigninBtn");
  if(btn){ btn.disabled=true; btn.textContent="Signing in…"; }
  console.log("[Auth] Signing in:", email);
  try {
    document.activeElement && document.activeElement.blur();
    var result = await SB.auth.signInWithPassword({ email:email, password:pass });
    if(result.error) throw result.error;
    _authClearInputErr(["siEmail","siPass"]);
    console.log("[Auth] Sign in successful:", result.data.user.id);
    await onUserSignedIn(result.data.user);
  } catch(err){
    console.error("[Auth] Sign in error:", err.message);
    showAuthError("signin", _authMapError(err));
    _authMarkInputErr(["siEmail","siPass"]);
    if(btn){ btn.disabled=false; btn.textContent="Sign In"; }
  }
}

// ── Sign Up ───────────────────────────────────────────────────

async function handleSignUp(){
  var firstName = (document.getElementById("suFirst").value||"").trim();
  var lastName  = (document.getElementById("suLast").value||"").trim();
  var email     = (document.getElementById("suEmail").value||"").trim();
  var pass      = document.getElementById("suPass").value||"";
  var phone     = (document.getElementById("suPhone").value||"").trim();
  _authClearInputErr(["suFirst","suEmail","suPass"]);
  if(!firstName || !email || !pass){
    showAuthError("signup","First name, email and password are required.");
    _authMarkInputErr([!firstName?"suFirst":null, !email?"suEmail":null, !pass?"suPass":null].filter(Boolean));
    return;
  }
  if(pass.length < 6){
    showAuthError("signup","Password must be at least 6 characters.");
    _authMarkInputErr(["suPass"]);
    return;
  }
  var errEl = document.getElementById("authErrorSu");
  if(errEl){ errEl.style.display="none"; }
  var btn = document.getElementById("authSignupBtn");
  if(btn){ btn.disabled=true; btn.textContent="Creating account…"; }
  console.log("[Auth] Signing up:", email);
  try {
    var signupResult = await apiFetch("/api/signup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ firstName, lastName, email, password: pass, phone: phone||null })
    });
    if(!signupResult.ok) throw new Error(signupResult.data.error || "Signup failed");

    document.activeElement && document.activeElement.blur();
    var result = await SB.auth.signInWithPassword({ email, password: pass });
    if(result.error) throw result.error;

    _authClearInputErr(["suFirst","suEmail","suPass"]);
    console.log("[Auth] Account created and signed in:", result.data.user.id);
    try { localStorage.setItem("oriven_needs_onboarding", "1"); } catch(_){}
    await onUserSignedIn(result.data.user);
    trackEvent("created_account", result.data.user);
  } catch(err){
    console.error("[Auth] Sign up error:", err.message);
    showAuthError("signup", _authMapError(err));
    _authMarkInputErr(["suEmail","suPass"]);
    if(btn){ btn.disabled=false; btn.textContent="Create Account"; }
  }
}

// ── Sign Out ──────────────────────────────────────────────────

async function authSignOut(){
  console.log("[Auth] Signing out");
  _currentUser          = null;
  _onboardingShown      = false;
  _dbSubscriptionStatus = null;
  _dbPlanSet            = false;
  await SB.auth.signOut();
  S.brandCore = null;
  if(typeof S !== "undefined" && S){ S.currentPlan = "free"; }
  try { if(typeof saveSettings === "function") saveSettings({ currentPlan: "free" }); } catch(_){}
  // Clear guest generation flag so user gets a fresh try after logout
  localStorage.removeItem("guestGenerationUsed");
  showGuestLanding();
  toast("Signed out");
}

// ── After sign in: update UI, load BrandCore, show app ───────

async function syncSubscriptionFromDB(){
  if(typeof ORIVEN_DEV !== "undefined" && ORIVEN_DEV){
    if(typeof S !== "undefined" && S) S.currentPlan = "professional";
    if(typeof _updateSidebarPlan === "function") _updateSidebarPlan("professional");
    if(typeof invalidatePlanCache === "function") invalidatePlanCache();
    if(typeof renderPlanPanel === "function") renderPlanPanel();
    return;
  }
  try {
    var sessionResult = await SB.auth.getSession();
    var session = sessionResult.data && sessionResult.data.session;
    if(!session) return;
    var result = await apiFetch("/api/get-subscription", {
      headers: { "Authorization": "Bearer " + session.access_token }
    });
    if(!result.ok){ console.warn("[Subscription] GET /api/get-subscription failed:", result.status); return; }
    var data = result.data;
    console.log("[Subscription] Synced from server:", JSON.stringify(data));
    var patch = {};
    if(data.subscription_status){
      var _syncStatus = data.subscription_status;
      // Never downgrade a Supabase-confirmed paid plan based on a potentially stale backend response
      if(_dbPlanSet && _syncStatus === "free"){
        console.log("[Subscription] Backend returned 'free' but DB already confirmed paid plan — skipping");
      } else {
        S.currentPlan = _syncStatus;
        patch.currentPlan = _syncStatus;
        if(_syncStatus !== "free") _dbPlanSet = true;
      }
    }
    var serverPending     = data.pending_plan      || null;
    var serverPendingDate = data.pending_plan_date || null;
    S.pendingPlan     = serverPending;
    S.pendingPlanDate = serverPendingDate;
    patch.pendingPlan     = serverPending;
    patch.pendingPlanDate = serverPendingDate;
    saveSettings(patch);
    if(typeof _updateSidebarPlan === "function") _updateSidebarPlan(S.currentPlan);
    if(typeof invalidatePlanCache === "function") invalidatePlanCache();
    if(typeof renderPlanPanel === "function") renderPlanPanel();
  } catch(err){
    console.warn("[Subscription] Sync error (non-fatal):", err.message);
  }
}

async function onUserSignedIn(user){
  // Guard: if the same user is already initialised with a known plan, skip re-init.
  // Prevents a second SIGNED_IN event (e.g. from a token refresh) from re-running
  // the entire auth flow and potentially overwriting a correct plan with a stale value.
  if(_currentUser && _currentUser.id === user.id && _dbSubscriptionStatus !== null){
    console.log("[Auth] Session refresh — same user, status already loaded:", _dbSubscriptionStatus, "— skipping re-init");
    return;
  }
  _currentUser = user;
  linkSessionToUser(user.id);
  console.log("[Auth] User signed in:", user.id);
  updateSidebarUser(user);
  _setAppRoute("/app");
  // Fire non-blocking background work immediately
  loadBrandCoreFromDB(user);
  // NOTE: syncSubscriptionFromDB() intentionally NOT called here.
  // _loadUserProfile() below queries Supabase directly and is the single
  // source of truth for plan state. Calling a second async backend source
  // created race conditions that overwrote the correct plan with stale data.
  if(typeof initUsageTracking === "function") initUsageTracking(user);
  // Subscription check determines whether to show app, onboarding, or redirect.
  // showApp() and navigate() are called inside _loadUserProfile() to prevent
  // the app from briefly flashing for unpaid users.
  await _loadUserProfile(user);
}

// ── Profile: single consolidated query ───────────────────────

async function _loadUserProfile(user){
  // ── Diagnostic logging ─────────────────────────────────────────
  console.log("[Profile] ══════════════════════════════════════");
  console.log("[Profile] Auth user:", user.id, "| email:", user.email);
  console.log("[Profile] Querying table: profiles | column: id =", user.id);
  // Log current Supabase session so we can verify the JWT is present
  try {
    var _sesCheck = await SB.auth.getSession();
    var _sesData  = _sesCheck.data && _sesCheck.data.session;
    console.log("[Profile] SB session valid:", !!_sesData, "| access_token present:", !!(_sesData && _sesData.access_token));
  } catch(_se){ console.warn("[Profile] Could not read SB session:", _se.message); }
  // ──────────────────────────────────────────────────────────────

  try {
    var result = await SB.from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    // Log the raw result unconditionally so we can see the full picture in the console
    console.log("[Profile] Raw query result:", JSON.stringify({
      data:   result.data,
      error:  result.error ? {
        message: result.error.message,
        code:    result.error.code,
        details: result.error.details,
        hint:    result.error.hint
      } : null,
      status: result.status,
      statusText: result.statusText
    }));

    if(result.error){
      console.error("[Profile] Query ERROR — code:", result.error.code,
        "| message:", result.error.message,
        "| details:", result.error.details,
        "| hint:", result.error.hint);
      throw result.error;
    }

    var data = result.data;
    console.log("[Profile] Query SUCCESS | data:", JSON.stringify(data));
    if(data){ console.log("[Profile] subscription_status:", data.subscription_status); }
    else     { console.warn("[Profile] data is null — no profile row found for user.id:", user.id); }

    // Subscription gate — determines whether to reveal the app or enforce paywall
    if(typeof ORIVEN_DEV !== "undefined" && ORIVEN_DEV){
      // Dev mode: use actual DB subscription_status so the navbar reflects the real plan.
      // Falls back to "professional" only when the DB has no value (new/test accounts).
      var _devStatus = (data && typeof data.subscription_status === "string" && data.subscription_status.trim())
        ? data.subscription_status.trim() : "professional";
      _dbSubscriptionStatus = _devStatus;
      S.currentPlan = _devStatus;
      if(typeof _updateSidebarPlan === "function") _updateSidebarPlan(_devStatus);
      if(typeof invalidatePlanCache === "function") invalidatePlanCache();
      if(typeof renderPlanPanel === "function") renderPlanPanel();
      showApp();
      navigate("dashboard");
    } else if(_postPayment){
      // Post-payment: DB may not reflect the new plan yet (webhook lag).
      // Read DB anyway — if paid already, set status. If still "free", leave null (= pending).
      var _ppRaw = (data && typeof data.subscription_status === "string") ? data.subscription_status.trim() : "";
      if(_ppRaw && _ppRaw !== "free"){
        _dbSubscriptionStatus = _ppRaw;
        S.currentPlan = _ppRaw;
        if(typeof _updateSidebarPlan === "function") _updateSidebarPlan(_ppRaw);
        console.log("[ACCESS] _postPayment | DB already shows paid plan:", _ppRaw);
      } else {
        _dbSubscriptionStatus = null; // webhook pending — gates will not block (null !== "free")
        console.log("[ACCESS] _postPayment | DB still shows free/null — webhook pending. Waiting for syncSubscriptionFromDB().");
      }
      showApp();
      navigate("dashboard");
    } else {
      var _dbPlan = (data && typeof data.subscription_status === "string") ? data.subscription_status.trim() : "";
      _dbSubscriptionStatus = _dbPlan || "free"; // authoritative value — ONLY set from Supabase
      var _isPaid = _dbSubscriptionStatus !== "free";
      console.log("[ACCESS] _loadUserProfile | User:", user.id, "| DB subscription_status:", JSON.stringify(data && data.subscription_status), "| normalized:", _dbSubscriptionStatus, "| isPaid:", _isPaid, "| Paywall Decision:", !_isPaid, "| Access Granted:", _isPaid);
      if(_isPaid){
        // Confirmed paid subscriber — reveal the full product
        _dbPlanSet = true;
        S.currentPlan = _dbSubscriptionStatus;
        saveSettings({ currentPlan: _dbSubscriptionStatus });
        if(typeof _updateSidebarPlan === "function") _updateSidebarPlan(S.currentPlan);
        if(typeof invalidatePlanCache === "function") invalidatePlanCache();
        if(typeof renderPlanPanel === "function") renderPlanPanel();
        showApp();
        navigate("dashboard");
      } else {
        // No valid paid subscription — decide: onboarding gate OR hard paywall
        //
        // Primary signal: DB onboarding_completed field (reliable across devices,
        // private browsing, and tab restores). Secondary: localStorage flag set
        // immediately after account creation as a same-session fast-path.
        var _dbCompleted = data ? data.onboarding_completed === true : false;
        var _lsNeedsOb   = false;
        try { _lsNeedsOb = localStorage.getItem("oriven_needs_onboarding") === "1"; } catch(_){}
        var _needsOnboarding = !_dbCompleted || _lsNeedsOb;

        console.log("[Onboarding] dbCompleted:", _dbCompleted, "| lsFlag:", _lsNeedsOb, "| willShow:", _needsOnboarding);

        if(_needsOnboarding){
          _obContext = "gate";
          showApp();
          showOnboarding();
        } else {
          // Onboarding done but not paid — hard paywall
          showApp();
          _showHardPaywall();
          return;
        }
      }
    }
  } catch(err){
    // Log everything available on the error so the root cause is visible in the console
    console.error("[Profile] ✗ PROFILE LOAD FAILED");
    console.error("[Profile]   err.message :", err.message);
    console.error("[Profile]   err.code    :", err.code);
    console.error("[Profile]   err.details :", err.details);
    console.error("[Profile]   err.hint    :", err.hint);
    console.error("[Profile]   err (full)  :", JSON.stringify(err));
    console.error("[Profile]   user.id     :", user && user.id);
    console.error("[Profile]   table       : profiles");
    console.error("[Profile] Check: RLS policy allows SELECT for authenticated users? Column names correct? Profile row exists?");

    // subscription_status is UNKNOWN — leave _dbSubscriptionStatus as null so
    // access gates pass through rather than wrongly blocking a paid user.
    _dbSubscriptionStatus = null;

    // Clear any stale plan label from localStorage / initSettings.
    // We must NOT display a cached plan name (e.g. "Professional") when
    // we don't actually know the plan — that hides the real bug.
    var _sbPlanEl = document.getElementById("sbPlanLabel");
    if(_sbPlanEl){ _sbPlanEl.textContent = "—"; _sbPlanEl.className = "sb-plan-label sb-plan-free"; }

    showApp();
    navigate("dashboard");
    if(typeof toast === "function") toast("Profile failed to load — please refresh the page.", "error");
  }
}

async function markOnboardingComplete(){
  var user = _currentUser;
  if(!user) return;
  console.log("[Onboarding] Marking complete for user:", user.id);
  try {
    var result = await SB.from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);
    if(result.error) throw result.error;
    console.log("[Onboarding] Marked as complete in database");
  } catch(err){
    console.error("[Onboarding] Mark complete error:", err.message);
  }
}

// ── Onboarding: spotlight product tour ───────────────────────
// Steps 1-7: spotlight the nav item + tooltip to the right.
// Step 8: full-screen backdrop + centered CTA card.
// window._obActive: guards navigate() from firing during the tour.

var _obStep    = 1;
var _obContext = "tour"; // "gate" = pre-payment; "tour" = post-payment/dev

var _OB_STEPS = [
  { page:"dashboard",   section:"Dashboard",       title:"Your brand, <em>at a glance.</em>",                      desc:"Oriven is your AI Brand Operating System. The Dashboard shows your brand intelligence level, recent activity, and workspace — everything you need to run a complete brand in one place." },
  { page:"create",      section:"Create",           title:"Every content type. <em>One platform.</em>",              desc:"Campaigns, visuals, video ads, product shoots, motion graphics, landing pages, and brand copy — all generated from your BrandCore in seconds. No re-briefing. No starting from scratch." },
  { page:"studio",      section:"BrandCore",        title:"Strategy, positioning <em>and identity — built in.</em>",  desc:"BrandCore is the intelligence layer every Oriven output draws from. Your audience, tone, messaging, visual identity, and positioning — structured and always on. Build it once. Use it everywhere." },
  { page:"inspiration", section:"Inspiration",      title:"Research and ideas, <em>always ready.</em>",              desc:"Explore AI-curated creative concepts across campaigns, visuals, web, and copy. Pick a direction and activate it with one click — your BrandCore ensures every idea stays aligned." },
  { page:"assistant",   section:"Brand Assistant",  title:"Your AI brand strategist. <em>Always on.</em>",           desc:"The Brand Assistant thinks like a senior strategist trained on your brand. Ask it anything — positioning, strategy, campaign direction, copy feedback. It always responds in your brand voice." },
  { page:"team",        section:"Team",             title:"One brand. <em>Built to scale.</em>",                     desc:"Invite your team, share your BrandCore, and build brand intelligence together. Multi-user collaboration, shared workspaces, and aligned outputs — available on Professional plans." },
  { page:"settings",    section:"Settings",         title:"Your workspace, <em>your way.</em>",                      desc:"Manage your account, subscription, language, appearance, and AI preferences. Everything that shapes how Oriven works for you — all in one place, always available." },
  { page:null,          section:"You’re ready", title:"Your brand operating system <em>is ready.</em>",          desc:"You’ve seen how Oriven helps create, manage and scale a complete brand. Unlock full access to start building." }
];

function showOnboarding(){
  _obStep = 1;
  window._obActive = true;

  // Temporarily show the Team nav item (normally hidden) so step 6 can spotlight it
  var teamNav = document.getElementById("teamNavItem");
  if(teamNav){ teamNav._obWasHidden = (teamNav.style.display === "none"); teamNav.style.display = ""; }

  // Block interactions with the main content area during the tour
  var mc = document.querySelector(".mc");
  if(mc) mc.style.pointerEvents = "none";

  _obRender(1);
  console.log("[Onboarding] Spotlight tour started — " + _OB_STEPS.length + " steps");
}

function hideOnboarding(){
  window._obActive = false;

  // Restore main content interactions
  var mc = document.querySelector(".mc");
  if(mc) mc.style.pointerEvents = "";

  // Restore Team nav visibility
  var teamNav = document.getElementById("teamNavItem");
  if(teamNav && teamNav._obWasHidden){ teamNav.style.display = "none"; teamNav._obWasHidden = false; }

  ["ob-ring","ob-backdrop","ob-tooltip"].forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    el.style.opacity = "0";
    setTimeout(function(){ el.style.display = "none"; el.style.opacity = ""; }, 280);
  });
}

function _obRender(step){
  var s        = _OB_STEPS[step - 1];
  if(!s) return;
  var total    = _OB_STEPS.length;
  var isLast   = (step === total);
  var isMobile = window.innerWidth <= 768;

  var ring  = document.getElementById("ob-ring");
  var bd    = document.getElementById("ob-backdrop");
  var tt    = document.getElementById("ob-tooltip");
  var navEl = s.page ? document.querySelector('.ni[data-page="' + s.page + '"]') : null;

  // ── Spotlight vs full-screen backdrop ─────────────────────────
  // On mobile the sidebar is off-canvas so the spotlight ring would
  // target invisible elements — use backdrop + bottom-sheet for all steps.
  if(navEl && !isLast && !isMobile){
    if(bd){ bd.style.opacity = "0"; setTimeout(function(){ bd.style.display = "none"; }, 250); }
    if(ring){
      var pad = 8;
      var r   = navEl.getBoundingClientRect();
      ring.style.top    = (r.top    - pad) + "px";
      ring.style.left   = (r.left   - pad) + "px";
      ring.style.width  = (r.width  + pad * 2) + "px";
      ring.style.height = (r.height + pad * 2) + "px";
      ring.style.display = "block";
      requestAnimationFrame(function(){ ring.style.opacity = "1"; });
    }
  } else {
    if(ring){ ring.style.opacity = "0"; setTimeout(function(){ ring.style.display = "none"; }, 250); }
    if(bd){ bd.style.display = "block"; requestAnimationFrame(function(){ bd.style.opacity = "1"; }); }
  }

  // ── Tooltip content ────────────────────────────────────────────
  if(!tt) return;

  var secEl  = document.getElementById("ob-tt-section");
  var titEl  = document.getElementById("ob-tt-title");
  var descEl = document.getElementById("ob-tt-desc");
  var dotsEl = document.getElementById("ob-tt-dots");
  var backBtn = document.getElementById("ob-tt-back");
  var nextBtn = document.getElementById("ob-tt-next");

  if(secEl)  secEl.textContent = s.section;
  if(titEl)  titEl.innerHTML   = s.title;
  if(descEl) descEl.textContent = s.desc;

  if(dotsEl){
    dotsEl.innerHTML = "";
    for(var i = 1; i <= total; i++){
      var d = document.createElement("span");
      d.className = "ob-tt-dot" + (i === step ? " ob-tt-dot-active" : "");
      dotsEl.appendChild(d);
    }
  }

  if(backBtn){
    backBtn.style.visibility = step > 1 ? "visible" : "hidden";
    backBtn.onclick = function(){ obGoTo(_obStep - 1); };
  }
  if(nextBtn){
    nextBtn.textContent = isLast ? "Choose Your Plan →" : "Next →";
    nextBtn.className   = "ob-tt-next" + (isLast ? " ob-tt-cta" : "");
    nextBtn.onclick     = isLast ? function(){ obFinish(); } : function(){ obGoTo(_obStep + 1); };
  }

  tt.style.opacity = "0";
  tt.style.display = "block";

  requestAnimationFrame(function(){
    if(isMobile){
      // ── Mobile: bottom-sheet card above thumb zone ─────────────
      tt.style.top      = "auto";
      tt.style.bottom   = "80px";
      tt.style.left     = "12px";
      tt.style.right    = "12px";
      tt.style.width    = "auto";
      tt.style.maxWidth = "none";
      tt.style.transform = "none";
      tt.classList.remove("ob-tt-center");
      tt.classList.remove("ob-tt-arrow");
    } else if(navEl && !isLast){
      // ── Desktop: spotlight tooltip beside nav item ─────────────
      tt.style.bottom   = "";
      tt.style.right    = "";
      tt.style.width    = "";
      tt.style.maxWidth = "";

      var r       = navEl.getBoundingClientRect();
      var margin  = 24;
      var ttH     = tt.offsetHeight;
      var ttW     = tt.offsetWidth || 290;

      // Preferred: align tooltip top with nav item top
      var top  = r.top;
      var left = r.right + 18;

      // Flip left if it clips the right edge
      if(left + ttW + margin > window.innerWidth){
        left = Math.max(margin, r.left - ttW - 18);
      }

      // Clamp vertically — keep 24px from both edges
      var maxTop = window.innerHeight - ttH - margin;
      var minTop = margin;
      top = Math.min(maxTop, Math.max(minTop, top));

      // Recompute arrow position so it always points at the nav item's
      // center even when the tooltip card has been shifted up or down
      var navCenter = r.top + r.height / 2;
      var arrowTop  = navCenter - top - 8; // 8px = half arrow height
      arrowTop = Math.max(8, Math.min(arrowTop, ttH - 24));
      tt.style.setProperty("--ob-arrow-top", arrowTop + "px");

      tt.style.top       = top + "px";
      tt.style.left      = left + "px";
      tt.style.transform = "";
      tt.classList.add("ob-tt-arrow");
      tt.classList.remove("ob-tt-center");
    } else {
      // ── Desktop: centered final step ──────────────────────────
      tt.style.bottom   = "";
      tt.style.right    = "";
      tt.style.width    = "";
      tt.style.maxWidth = "";
      tt.style.left      = "50%";
      tt.style.top       = "50%";
      tt.style.transform = "translate(-50%,-50%)";
      tt.classList.add("ob-tt-center");
      tt.classList.remove("ob-tt-arrow");
    }
    requestAnimationFrame(function(){ tt.style.opacity = "1"; });
  });
}

function obGoTo(step){
  if(step < 1 || step > _OB_STEPS.length) return;
  var tt   = document.getElementById("ob-tooltip");
  var ring = document.getElementById("ob-ring");
  if(tt)   tt.style.opacity   = "0";
  if(ring) ring.style.opacity = "0";
  _obStep = step;
  setTimeout(function(){ _obRender(step); }, 180);
  console.log("[Onboarding] Step →", step, "of", _OB_STEPS.length);
}

function obFinish(){
  console.log("[Onboarding] Tour complete — context:", _obContext);
  markOnboardingComplete();

  if(_obContext === "gate"){
    try { localStorage.removeItem("oriven_needs_onboarding"); } catch(_){}
    _obContext = "tour";
    hideOnboarding();
    setTimeout(function(){ _showHardPaywall(); }, 300);
  } else {
    hideOnboarding();
    setTimeout(function(){ navigate("dashboard"); }, 300);
  }
}

// ── Keyboard: onboarding navigation + hard paywall Escape block ─
document.addEventListener("keydown", function(e){
  if(e.key === "Escape"){
    if(_paywallHard){
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if(window._obActive) return; // Escape does nothing during tour
  }
  if(window._obActive){
    if(e.key === "ArrowRight" || e.key === "ArrowDown")      obGoTo(_obStep + 1);
    else if(e.key === "ArrowLeft" || e.key === "ArrowUp")    obGoTo(_obStep - 1);
  }
});

// ── Email verification helpers ────────────────────────────────

function _showVerifyBanner(daysLeft){
  var banner = document.getElementById("verifyBanner");
  var text   = document.getElementById("verifyBannerText");
  if(!banner) return;
  if(text){
    var timeStr;
    if(daysLeft <= 0){
      timeStr = " — your account may be removed soon";
    } else if(daysLeft === 1){
      timeStr = " — only 1 day remaining";
    } else if(daysLeft <= 3){
      timeStr = " — only " + daysLeft + " days remaining";
    } else {
      timeStr = " (" + daysLeft + " days remaining)";
    }
    text.textContent = "Please verify your email to keep your account active" + timeStr + ".";
  }
  banner.style.display = "flex";
}

function _hideVerifyBanner(){
  var banner = document.getElementById("verifyBanner");
  if(banner) banner.style.display = "none";
}

async function resendVerificationEmail(){
  var btn = document.getElementById("verifyBannerResend");
  if(btn){ btn.disabled = true; btn.textContent = "Sending…"; }
  try {
    var sessionResult = await SB.auth.getSession();
    var session = sessionResult.data && sessionResult.data.session;
    if(!session){ toast("Please sign in first"); return; }
    var result = await apiFetch("/api/resend-verification", {
      method:  "POST",
      headers: { "Authorization": "Bearer " + session.access_token }
    });
    if(!result.ok) throw new Error(result.data.error || "Failed to send");
    toast("Verification email sent — check your inbox");
  } catch(err){
    console.error("[EmailVerify] Resend error:", err.message);
    toast("Could not send — " + err.message, "warn");
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = "Resend Email"; }
  }
}

async function _handleVerifyToken(){
  var params = new URLSearchParams(window.location.search);
  var token  = params.get("verify_token");
  if(!token) return;
  history.replaceState(null, "", window.location.pathname);
  try {
    var result = await apiFetch("/api/verify-email", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token })
    });
    if(result.ok && result.data.ok){
      _hideVerifyBanner();
      setTimeout(function(){ toast("Email verified — your account is confirmed!"); }, 600);
    } else {
      setTimeout(function(){ toast("Verification link is invalid or already used. Request a new one.", "warn"); }, 600);
    }
  } catch(err){
    console.error("[EmailVerify] Token error:", err.message);
  }
}

function updateSidebarUser(user){
  var meta      = user.user_metadata || {};
  var firstName = meta.first_name || user.email.split("@")[0];
  var initial   = firstName.charAt(0).toUpperCase();
  var nameEl    = document.getElementById("sidebarUserName");
  var dotEl     = document.getElementById("sidebarUserDot");
  if(nameEl) nameEl.textContent = firstName;
  if(dotEl)  dotEl.textContent  = initial;
  // Switch sidebar to authenticated state
  var authEl  = document.getElementById("sbIdentityAuth");
  var guestEl = document.getElementById("sbIdentityGuest");
  if(authEl)  authEl.style.display  = "";
  if(guestEl) guestEl.style.display = "none";
  // Show plan/usage row
  var usageWrap = document.querySelector(".sb-usage-wrap");
  if(usageWrap) usageWrap.style.display = "";
  console.log("[Auth] Sidebar updated for:", firstName);
}

function updateSidebarGuest(){
  var authEl  = document.getElementById("sbIdentityAuth");
  var guestEl = document.getElementById("sbIdentityGuest");
  if(authEl)  authEl.style.display  = "none";
  if(guestEl) guestEl.style.display = "";
  // Hide plan/usage row — not relevant for guests
  var usageWrap = document.querySelector(".sb-usage-wrap");
  if(usageWrap) usageWrap.style.display = "none";
}

// ── BrandCore: save to Supabase ───────────────────────────────

async function saveBCToDB(){
  if(typeof SB === "undefined"){ console.warn("[DB] Supabase not initialized"); return; }
  var userResult = await SB.auth.getUser();
  var user = userResult.data && userResult.data.user;
  if(!user){ console.log("[DB] Not logged in — BrandCore not saved to cloud"); return; }
  if(!S.brandCore){ console.log("[DB] No BrandCore to save"); return; }
  console.log("[DB] Saving BrandCore to Supabase for user:", user.id, "brand:", S.brandCore.name);
  try {
    var result = await SB.from("brand_cores").upsert(
      { user_id: user.id, brand_data: S.brandCore },
      { onConflict: "user_id" }
    );
    if(result.error) throw result.error;
    console.log("[DB] BrandCore saved successfully");
    toast("Brand Core saved to cloud");
  } catch(err){
    console.error("[DB] Save BrandCore error:", err.message);
  }
}

// ── BrandCore: load from Supabase ────────────────────────────

async function loadBrandCoreFromDB(user){
  if(typeof SB === "undefined"){ return; }
  if(!user) user = _currentUser;
  if(!user){
    var userResult = await SB.auth.getUser();
    user = userResult.data && userResult.data.user;
  }
  if(!user) return;
  console.log("[DB] Loading BrandCore from Supabase for user:", user.id);
  try {
    var result = await SB.from("brand_cores")
      .select("brand_data")
      .eq("user_id", user.id)
      .maybeSingle();
    if(result.error) throw result.error;
    if(!result.data){ console.log("[DB] No BrandCore found for user"); return; }
    S.brandCore = result.data.brand_data;
    console.log("[DB] BrandCore loaded:", S.brandCore.name);
    if(typeof refreshBC === "function") refreshBC();
  } catch(err){
    console.error("[DB] Load BrandCore error:", err.message);
  }
}

// ── BrandCore: delete from Supabase ──────────────────────────

async function deleteBCFromDB(){
  if(typeof SB === "undefined"){ return; }
  var userResult = await SB.auth.getUser();
  var user = userResult.data && userResult.data.user;
  if(!user) return;
  console.log("[DB] Deleting BrandCore from Supabase for user:", user.id);
  try {
    var result = await SB.from("brand_cores").delete().eq("user_id", user.id);
    if(result.error) throw result.error;
    console.log("[DB] BrandCore deleted from cloud");
  } catch(err){
    console.error("[DB] Delete BrandCore error:", err.message);
  }
}

// ── Paywall ───────────────────────────────────────────────────

async function checkSubscriptionStatus(){
  if(typeof ORIVEN_DEV !== "undefined" && ORIVEN_DEV){
    // On dev, return the actual DB value if _loadUserProfile() already set it.
    // Never override a Supabase-confirmed plan with a hardcoded string.
    if(_dbSubscriptionStatus !== null) return _dbSubscriptionStatus;
    // Only fall back to "professional" for brand-new dev sessions before DB loads.
    if(typeof S !== "undefined" && S && S.currentPlan && S.currentPlan !== "free") return S.currentPlan;
    return "professional";
  }

  // Return the session-authoritative value when already loaded by _loadUserProfile().
  // This value came directly from Supabase at sign-in and is the source of truth.
  // Only do a live DB query when _dbSubscriptionStatus is null (post-payment webhook lag).
  if(_dbSubscriptionStatus !== null){
    var _isPaidCheck = _dbSubscriptionStatus !== "free";
    console.log("[Paywall] checkSubscriptionStatus | cached from session:", _dbSubscriptionStatus, "| Paywall Decision:", !_isPaidCheck, "| Access Granted:", _isPaidCheck);
    return _dbSubscriptionStatus;
  }

  if(typeof SB === "undefined"){
    console.error("[Paywall] SB client not initialized — cannot check subscription");
    return "free";
  }

  // Live query — only reached during post-payment webhook lag or very early in session
  var userResult = await SB.auth.getUser();
  var user = userResult.data && userResult.data.user;
  if(!user){
    console.log("[Paywall] No authenticated user — defaulting to free");
    return "free";
  }

  console.log("[Paywall] Fetching LIVE subscription status from Supabase for user:", user.id);

  try {
    var resp = await SB.from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    // Always log the raw response so the cause is visible in the console
    var rawData  = resp.data  ? JSON.stringify(resp.data) : "null (no row)";
    var rawError = resp.error ? resp.error.message + " [code: " + resp.error.code + "]" : "none";
    console.log("[Paywall] Supabase response — data:", rawData, "| error:", rawError);

    if(resp.error){
      // Most common causes:
      //   42703 — column does not exist (ALTER TABLE not yet run)
      //   42501 — RLS blocking the SELECT
      console.error("[Paywall] Query failed:", resp.error.message);
      if(resp.error.code === "42703"){
        console.error("[Paywall] FIX: run this in Supabase SQL Editor:\n  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text default 'free';");
      }
      // Fall back to the in-memory plan set by _loadUserProfile() rather than
      // hardcoding "free" — a DB error must NOT override a confirmed paid plan.
      var _cachedPlan = (typeof S !== "undefined" && S && S.currentPlan) ? S.currentPlan : "free";
      console.warn("[Paywall] Using cached plan as fallback:", _cachedPlan);
      return _cachedPlan;
    }

    if(!resp.data){
      // Profile row does not exist — create it so future checks work
      console.warn("[Paywall] No profile row found for user:", user.id, "— upserting defaults");
      var upsert = await SB.from("profiles").upsert(
        { id: user.id, email: user.email, subscription_status: "free", onboarding_completed: false },
        { onConflict: "id" }
      );
      if(upsert.error) console.error("[Paywall] Could not upsert profile:", upsert.error.message);
      // Use cached plan in case the upsert path fires for a paid user mid-session
      var _cachedPlan2 = (typeof S !== "undefined" && S && S.currentPlan) ? S.currentPlan : "free";
      return _cachedPlan2;
    }

    // We have a real row — read the value directly, do NOT fall back silently
    var status = resp.data.subscription_status;
    if(!status){
      console.warn("[Paywall] subscription_status is null/empty in DB — checking cached plan");
      var _cachedPlan3 = (typeof S !== "undefined" && S && S.currentPlan) ? S.currentPlan : "free";
      return _cachedPlan3;
    }

    var isPaid = status !== "free";
    console.log("[Paywall] subscription_status:", status, "→", isPaid
      ? "✓ SUBSCRIBED — paywall will NOT show"
      : "✗ FREE — paywall will show");
    // Cache the live result so subsequent calls use it without another DB query
    _dbSubscriptionStatus = status;
    if(typeof S !== "undefined" && S && isPaid){ S.currentPlan = status; }
    return status;

  } catch(err){
    console.error("[Paywall] Unexpected JS error:", err.message);
    var _cachedPlan4 = (typeof S !== "undefined" && S && S.currentPlan) ? S.currentPlan : "free";
    console.warn("[Paywall] Using cached plan as fallback:", _cachedPlan4);
    return _cachedPlan4;
  }
}

async function maybeShowPaywall(){
  console.log("[Paywall] maybeShowPaywall() called — S.currentPlan at call time:", (typeof S !== "undefined" && S) ? S.currentPlan : "S not defined");
  console.trace("[Paywall] call stack (shows which function triggered this):");
  var status = await checkSubscriptionStatus();
  if(status !== "free"){
    console.log("[Paywall] Subscribed user (" + status + ") — paywall suppressed");
    return;
  }
  console.log("[Paywall] Free user — opening paywall modal");
  if(typeof openPaywall === "function") openPaywall();
}

// Hard paywall — shown after onboarding, cannot be dismissed until payment
var _paywallHard = false;

function _showHardPaywall(){
  _paywallHard = true;
  var modal = document.getElementById("modal-paywall");
  if(modal) modal.classList.add("pw-hard");
  if(typeof openPaywall === "function") openPaywall();
  console.log("[Paywall] Hard paywall shown — awaiting plan selection");
}

function closePaywall(){
  if(_paywallHard){
    console.log("[Paywall] Hard paywall — dismiss blocked");
    return;
  }
  if(typeof closeModal === "function") closeModal("modal-paywall");
  console.log("[Paywall] Dismissed by user");
}

async function selectPlan(plan){
  console.log("[Paywall] Plan selected:", plan);
  var btn = document.querySelector('[onclick="selectPlan(\'' + plan + '\')"]');
  if(btn){ btn.disabled = true; btn.textContent = "Redirecting…"; }

  try {
    var u = S.user || (await SB.auth.getUser()).data.user;
    var result = await apiFetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, userId: u.id, userEmail: u.email, source: 'app' })
    });
    if(!result.ok || !result.data.url) throw new Error(result.data.error || "No checkout URL returned");
    window.location.href = result.data.url;
  } catch(err) {
    console.error("[Paywall] Checkout error:", err);
    toast("Could not start checkout — please try again");
    if(btn){ btn.disabled = false; btn.textContent = btn.getAttribute("data-label") || "Get Started"; }
  }
}

// ── Session restore on page load ─────────────────────────────

document.addEventListener("DOMContentLoaded", async function(){
  trackEvent("visited_site");

  // Reset the authoritative subscription state — only _loadUserProfile() may set it.
  // _dbSubscriptionStatus = null means "not yet loaded from Supabase".
  // Access gates check this variable; null → don't block (waiting for DB).
  _dbSubscriptionStatus = null;
  _dbPlanSet = false;
  // Keep S.currentPlan reset for UI display consistency (navbar shows blank until DB loads)
  if(typeof S !== "undefined" && S){ S.currentPlan = "free"; }
  try { if(typeof saveSettings === "function") saveSettings({ currentPlan: "free" }); } catch(_){}

  // Capture path before any redirects fire
  var _loadPath = window.location.pathname;

  // Handle email verification token from verify link in email
  await _handleVerifyToken();

  // Handle Stripe return URLs
  var params      = new URLSearchParams(window.location.search);
  var _stripeOk   = params.get("success")  === "true";
  var _stripeBail = params.get("canceled") === "true";
  var _tourParam  = params.get("tour")     === "1";

  if(_stripeOk){
    _postPayment = true;
    history.replaceState(null, "", "/app");
    _loadPath = "/app";
  } else if(_stripeBail){
    history.replaceState(null, "", "/app");
    toast("Checkout canceled — you can upgrade anytime.");
  } else if(_tourParam){
    history.replaceState(null, "", "/app");
    _loadPath = "/app";
  }

  // Hide app immediately — show only after auth confirmed
  var app = document.querySelector(".app");
  if(app) app.style.display = "none";

  console.log("[Auth] Checking existing session... (path:", _loadPath, ")");
  var sessionResult = await SB.auth.getSession();
  var session = sessionResult.data && sessionResult.data.session;

  if(session && session.user){
    console.log("[Auth] Session restored for:", session.user.id);
    await onUserSignedIn(session.user);

    // Fire onboarding tour after payment or dev ?tour=1
    // Use checkSubscriptionStatus() (direct Supabase query) rather than
    // syncSubscriptionFromDB() (backend API) — Supabase is the single source of truth.
    if(_stripeOk){
      setTimeout(async function(){
        var status = await checkSubscriptionStatus();
        if(status && status !== "free"){
          _dbSubscriptionStatus = status;
          S.currentPlan = status;
          if(typeof _updateSidebarPlan === "function") _updateSidebarPlan(status);
          if(typeof invalidatePlanCache === "function") invalidatePlanCache();
          if(typeof renderPlanPanel === "function") renderPlanPanel();
          toast("Your subscription is now active — welcome to ORIVEN!");
          setTimeout(function(){ showOnboarding(); }, 600);
        } else {
          // Webhook may not have arrived yet — retry once after a short delay
          toast("Payment received — activating your account...");
          setTimeout(async function(){
            status = await checkSubscriptionStatus();
            _dbSubscriptionStatus = status;
            if(status && status !== "free"){
              S.currentPlan = status;
              if(typeof _updateSidebarPlan === "function") _updateSidebarPlan(status);
              if(typeof invalidatePlanCache === "function") invalidatePlanCache();
              if(typeof renderPlanPanel === "function") renderPlanPanel();
              toast("Your subscription is now active — welcome to ORIVEN!");
              setTimeout(function(){ showOnboarding(); }, 400);
            } else {
              toast("Subscription pending — please refresh in a moment.");
            }
          }, 3000);
        }
      }, 800);
    } else if(_tourParam){
      // Only show tour for users with an active paid subscription
      setTimeout(async function(){
        var status = await checkSubscriptionStatus();
        if(status && status !== "free") showOnboarding();
      }, 500);
    }
  } else {
    console.log("[Auth] No session — showing guest landing");
    showGuestLanding();
  }

  // React to future auth changes (e.g. session expiry)
  SB.auth.onAuthStateChange(function(event, _session){
    console.log("[Auth] Auth state change:", event);
    if(event === "SIGNED_OUT"){
      _dbSubscriptionStatus = null;
      _dbPlanSet = false;
      if(typeof S !== "undefined" && S){ S.currentPlan = "free"; }
      try { if(typeof saveSettings === "function") saveSettings({ currentPlan: "free" }); } catch(_){}
      S.brandCore = null;
      showGuestLanding();
    }
  });
});
