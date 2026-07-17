// â•â•â• AUTH + DATABASE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Handles: sign up, sign in, sign out, session restore,
//          BrandCore save/load from Supabase.

var _currentUser          = null;
var _onboardingShown      = false;
var _postPayment          = false; // True when landing from Stripe ?success=true â€” suppresses subscription gate
var _dbPlanSet            = false; // True once _loadUserProfile() confirms a paid plan from Supabase
var _dbSubscriptionStatus = null;  // null = not yet loaded | "free"/"creator"/"professional"/"starter"/"agency" = from Supabase

// â”€â”€ Route helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _setAppRoute(route){
  try { history.replaceState(null, "", route); } catch(_){}
  // Fire a page_view so Google Ads URL-based conversions trigger on /app
  if(typeof gtag === "function"){
    gtag("event", "page_view", { page_path: route, page_title: document.title });
  }
}

// â”€â”€ UI helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function showApp(){
  var overlay = document.getElementById("authOverlay");
  var app     = document.querySelector(".app");
  if(overlay) overlay.style.display = "none";
  if(app)     app.style.display     = "";
  // Show Google OAuth result toast (set by _loadUserProfile on return from OAuth)
  var _oar = window._pendingOAuthResult;
  if(_oar){
    window._pendingOAuthResult = null;
    var _errMap = {
      access_denied: "Google sign-in was cancelled.",
      token_exchange: "Google connection failed â€” please try again.",
      invalid_state: "Session expired â€” please try again.",
      db: "Could not save connection â€” please try again.",
      network: "Network error â€” please try again.",
      missing_params: "OAuth error â€” please try again."
    };
    setTimeout(function(){
      if(_oar.connected){
        if(typeof toast === "function") toast("Google Ads connected successfully!");
        if(typeof navigate === "function") navigate('integrations');
      } else if(_oar.error){
        var msg = _errMap[_oar.error] || "Google connection failed.";
        if(typeof toast === "function") toast(msg, "err");
      }
    }, 600);
  }
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
    return "Too many attempts â€” please wait a moment and try again.";
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
  btn.textContent = loading ? "Please waitâ€¦" : btn.getAttribute("data-label");
}

// â”€â”€ Sign In â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  if(btn){ btn.disabled=true; btn.textContent="Signing inâ€¦"; }
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

// â”€â”€ Sign Up â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  if(btn){ btn.disabled=true; btn.textContent="Creating accountâ€¦"; }
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

// â”€â”€ Sign Out â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ After sign in: update UI, load BrandCore, show app â”€â”€â”€â”€â”€â”€â”€

async function syncSubscriptionFromDB(){
  if(typeof ORIVEN_DEV !== "undefined" && ORIVEN_DEV){
    // Dev mode: use actual _dbSubscriptionStatus set by _loadUserProfile() â€” never hardcode.
    // If _dbSubscriptionStatus is not yet loaded, fall back to "free" (not "professional").
    var _devSyncPlan = (_dbSubscriptionStatus && _dbSubscriptionStatus !== null)
      ? _dbSubscriptionStatus : "free";
    console.log("[PW-CHAIN] syncSubscriptionFromDB (dev) | _dbSubscriptionStatus:", _dbSubscriptionStatus, "â†’ using:", _devSyncPlan);
    if(typeof S !== "undefined" && S) S.currentPlan = _devSyncPlan;
    if(typeof _updateSidebarPlan === "function") _updateSidebarPlan(_devSyncPlan);
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
        console.log("[Subscription] Backend returned 'free' but DB already confirmed paid plan â€” skipping");
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
    console.log("[Auth] Session refresh â€” same user, status already loaded:", _dbSubscriptionStatus, "â€” skipping re-init");
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

// â”€â”€ Profile: single consolidated query â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function _loadUserProfile(user){
  // Detect Google OAuth return â€” store result, clean URL
  try {
    var _oqp = new URLSearchParams(window.location.search);
    var _ogc = _oqp.get("google_connected");
    var _oge = _oqp.get("google_error");
    if(_ogc === "1" || _oge){
      window.history.replaceState({}, "", window.location.pathname);
      window._pendingOAuthResult = { provider: 'google', connected: _ogc === "1", error: _oge || null };
      console.log("[Google OAuth] Return detected | connected:", _ogc === "1", "| error:", _oge || null);
      setTimeout(function(){ if(typeof navigate === "function") navigate("integrations"); }, 600);
    }
  } catch(_){}

  // Detect TikTok Ads OAuth return â€” store result, clean URL
  try {
    var _otqp = new URLSearchParams(window.location.search);
    var _otc  = _otqp.get("tiktok_connected");
    var _ote  = _otqp.get("tiktok_error");
    if(_otc === "1" || _ote){
      window.history.replaceState({}, "", window.location.pathname);
      window._pendingOAuthResult = { provider: 'tiktok', connected: _otc === "1", error: _ote || null };
      console.log("[TikTok OAuth] Return detected | connected:", _otc === "1", "| error:", _ote || null);
      setTimeout(function(){ if(typeof navigate === "function") navigate("integrations"); }, 600);
    }
  } catch(_){}

  // Detect Meta Ads OAuth return â€” store result, clean URL
  try {
    var _omqp = new URLSearchParams(window.location.search);
    var _omc  = _omqp.get("meta_connected");
    var _ome  = _omqp.get("meta_error");
    if(_omc === "1" || _ome){
      window.history.replaceState({}, "", window.location.pathname);
      window._pendingOAuthResult = { provider: 'meta', connected: _omc === "1", error: _ome || null };
      console.log("[Meta OAuth] Return detected | connected:", _omc === "1", "| error:", _ome || null);
      setTimeout(function(){ if(typeof navigate === "function") navigate("integrations"); }, 600);
    }
  } catch(_){}

  // â”€â”€ Diagnostic logging â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("[Profile] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•");
  console.log("[Profile] Auth user:", user.id, "| email:", user.email);
  console.log("[Profile] Querying table: profiles | column: id =", user.id);
  // Log current Supabase session so we can verify the JWT is present
  try {
    var _sesCheck = await SB.auth.getSession();
    var _sesData  = _sesCheck.data && _sesCheck.data.session;
    console.log("[Profile] SB session valid:", !!_sesData, "| access_token present:", !!(_sesData && _sesData.access_token));
  } catch(_se){ console.warn("[Profile] Could not read SB session:", _se.message); }
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      console.error("[Profile] Query ERROR â€” code:", result.error.code,
        "| message:", result.error.message,
        "| details:", result.error.details,
        "| hint:", result.error.hint);
      throw result.error;
    }

    var data = result.data;
    console.log("[Profile] Query SUCCESS | data:", JSON.stringify(data));
    if(data){ console.log("[Profile] subscription_status:", data.subscription_status); }
    else     { console.warn("[Profile] data is null â€” no profile row found for user.id:", user.id); }

    // Subscription gate â€” determines whether to reveal the app or enforce paywall
    if(typeof ORIVEN_DEV !== "undefined" && ORIVEN_DEV){
      // Dev mode: always read from DB â€” never hardcode a plan.
      // Falls back to "free" (not "professional") when the DB has no value.
      var _devRaw = (data && typeof data.subscription_status === "string") ? data.subscription_status.trim() : "";
      var _devStatus = _devRaw || "free";
      console.log("[PW-CHAIN] _loadUserProfile (dev) | DB subscription_status raw:", JSON.stringify(_devRaw), "â†’ _devStatus:", _devStatus, "| source:", _devRaw ? "Supabase profiles.subscription_status" : "fallback default (no DB value)");
      _dbSubscriptionStatus = _devStatus;
      S.currentPlan = _devStatus;
      if(typeof _updateSidebarPlan === "function") _updateSidebarPlan(_devStatus);
      if(typeof invalidatePlanCache === "function") invalidatePlanCache();
      if(typeof renderPlanPanel === "function") renderPlanPanel();
      showApp();
      // Check if onboarding is needed in dev mode too (new accounts should see the tour)
      var _devObCompleted = data ? data.onboarding_completed === true : false;
      var _devObNeeded = false;
      try { _devObNeeded = localStorage.getItem("oriven_needs_onboarding") === "1"; } catch(_){}
      if(!_devObCompleted || _devObNeeded){
        _obContext = "gate";
        navigate("overview");
        showOnboarding();
      } else {
        navigate("overview");
      }
    } else if(_postPayment){
      // Post-payment: DB may not reflect the new plan yet (webhook lag).
      // Read DB anyway â€” if paid already, set status. If still "free", leave null (= pending).
      var _ppRaw = (data && typeof data.subscription_status === "string") ? data.subscription_status.trim() : "";
      if(_ppRaw && _ppRaw !== "free"){
        _dbSubscriptionStatus = _ppRaw;
        S.currentPlan = _ppRaw;
        if(typeof _updateSidebarPlan === "function") _updateSidebarPlan(_ppRaw);
        console.log("[ACCESS] _postPayment | DB already shows paid plan:", _ppRaw);
      } else {
        _dbSubscriptionStatus = null; // webhook pending â€” gates will not block (null !== "free")
        console.log("[ACCESS] _postPayment | DB still shows free/null â€” webhook pending. Waiting for syncSubscriptionFromDB().");
      }
      showApp();
      navigate("overview");
    } else {
      var _dbPlan = (data && typeof data.subscription_status === "string") ? data.subscription_status.trim() : "";
      _dbSubscriptionStatus = _dbPlan || "free"; // authoritative value â€” ONLY set from Supabase
      var _isPaid = _dbSubscriptionStatus !== "free";
      var _statusSource = _dbPlan ? ("Supabase profiles.subscription_status = '" + _dbPlan + "'") : ("no DB value â€” defaulting to 'free'");
      console.log("[PW-CHAIN] _loadUserProfile | user:", user.id, "| _dbSubscriptionStatus:", _dbSubscriptionStatus, "| source:", _statusSource, "| isPaid:", _isPaid);
      console.log("[ACCESS] _loadUserProfile | User:", user.id, "| DB subscription_status:", JSON.stringify(data && data.subscription_status), "| normalized:", _dbSubscriptionStatus, "| isPaid:", _isPaid, "| Paywall Decision:", !_isPaid, "| Access Granted:", _isPaid);
      if(_isPaid){
        // Confirmed paid subscriber â€” reveal the full product
        _dbPlanSet = true;
        S.currentPlan = _dbSubscriptionStatus;
        saveSettings({ currentPlan: _dbSubscriptionStatus });
        if(typeof _updateSidebarPlan === "function") _updateSidebarPlan(S.currentPlan);
        if(typeof invalidatePlanCache === "function") invalidatePlanCache();
        if(typeof renderPlanPanel === "function") renderPlanPanel();
        showApp();
        navigate("overview");
      } else {
        // No valid paid subscription â€” decide: onboarding gate OR hard paywall
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
          navigate("overview");
          showOnboarding();
        } else {
          // Onboarding done, free user â€” check whether their free campaign has been used
          showApp();
          console.log("[PW-CHAIN] _loadUserProfile | onboarding done, sub=free | user:", user.id);
          console.log("[PW-CHAIN] DB profile data.free_campaign_used:", data && data.free_campaign_used);

          // Sync free_campaign_used from DB profile (survives logout / new devices)
          var _dbUsedFlag = data && data.free_campaign_used === true;
          var _scopedKey  = "oriven_fcused_" + user.id;
          var _legacyKey  = "oriven_free_campaign_used";
          if(_dbUsedFlag){
            try { localStorage.setItem(_scopedKey, "1"); } catch(_){}
            console.log("[PW-CHAIN] Synced free_campaign_used from DB â†’ localStorage key:", _scopedKey);
          }
          var _lsScopedFlag = false;
          var _lsLegacyFlag = false;
          try { _lsScopedFlag = localStorage.getItem(_scopedKey) === "1"; } catch(_){}
          try { _lsLegacyFlag = localStorage.getItem(_legacyKey) === "1"; } catch(_){}
          // Migrate legacy key if present
          if(!_lsScopedFlag && _lsLegacyFlag){
            try { localStorage.setItem(_scopedKey, "1"); _lsScopedFlag = true; } catch(_){}
            console.log("[PW-CHAIN] Migrated legacy localStorage key to scoped key for user:", user.id);
          }
          var _isUsed = _dbUsedFlag || _lsScopedFlag || _lsLegacyFlag;
          console.log("[PW-CHAIN] Page load check | _dbSubscriptionStatus:", _dbSubscriptionStatus, "| free_campaign_used:", _isUsed, "| db:", _dbUsedFlag, "| ls-scoped:", _lsScopedFlag, "| ls-legacy:", _lsLegacyFlag);

          if(_isUsed){
            console.log("[PW-CHAIN] LOCKING free user on page load â€” will show campaigns + hard paywall");
            window._paywallInitNav = true;
            navigate("overview");
            window._paywallInitNav = false;
            setTimeout(function(){
              console.log("[PW-CHAIN] Page-load paywall timeout fired | calling openFreePaywall");
              if(typeof openFreePaywall === "function") openFreePaywall();
              else console.error("[PW-CHAIN] openFreePaywall NOT FOUND at timeout");
            }, 200);
          } else {
            console.log("[PW-CHAIN] Free user, campaign NOT yet used â€” allowing normal access");
            navigate("overview");
          }
          return;
        }
      }
    }
  } catch(err){
    // Log everything available on the error so the root cause is visible in the console
    console.error("[Profile] âœ— PROFILE LOAD FAILED");
    console.error("[Profile]   err.message :", err.message);
    console.error("[Profile]   err.code    :", err.code);
    console.error("[Profile]   err.details :", err.details);
    console.error("[Profile]   err.hint    :", err.hint);
    console.error("[Profile]   err (full)  :", JSON.stringify(err));
    console.error("[Profile]   user.id     :", user && user.id);
    console.error("[Profile]   table       : profiles");
    console.error("[Profile] Check: RLS policy allows SELECT for authenticated users? Column names correct? Profile row exists?");

    // subscription_status is UNKNOWN â€” leave _dbSubscriptionStatus as null so
    // access gates pass through rather than wrongly blocking a paid user.
    _dbSubscriptionStatus = null;

    // Clear any stale plan label from localStorage / initSettings.
    // We must NOT display a cached plan name (e.g. "Professional") when
    // we don't actually know the plan â€” that hides the real bug.
    var _sbPlanEl = document.getElementById("sbPlanLabel");
    if(_sbPlanEl){ _sbPlanEl.textContent = "â€”"; _sbPlanEl.className = "sb-plan-label sb-plan-free"; }

    showApp();
    navigate("overview");
    if(typeof toast === "function") toast("Profile failed to load â€” please refresh the page.", "error");
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

// â”€â”€ Onboarding: spotlight product tour â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Steps 1-7: spotlight the nav item + tooltip to the right.
// Step 8: full-screen backdrop + centered CTA card.
// window._obActive: guards navigate() from firing during the tour.

var _obStep    = 1;
var _obContext = "tour"; // "gate" = pre-payment; "tour" = post-payment/dev

var _OB_STEPS = [
  { page:"campaigns", section:"Campaign Studio", title:"Where campaigns <em>come to life.</em>",         desc:"This is where you create new campaigns and marketing assets. Generate copy, visuals, and full campaign strategies â€” all tailored to your brand in seconds." },
  { page:"studio",    section:"Brand",           title:"Your brand <em>foundation.</em>",                desc:"This is your brand foundation. Everything Oriven generates uses this information â€” your tone, audience, positioning, and visual identity." },
  { page:"assets",    section:"Assets",          title:"Your <em>content library.</em>",                 desc:"This is where all generated content is stored and managed. Every campaign, asset, and output lives here â€” ready to use or remix." },
  { page:"aichat",    section:"Assistant",       title:"Your AI <em>brand strategist.</em>",             desc:"This AI assistant helps with campaigns, branding and marketing decisions. Ask anything â€” it knows your brand inside out." },
  { page:"campaigns", section:"Campaign Studio", title:"Letâ€™s create your <em>first campaign.</em>",     desc:"Youâ€™ve seen what Oriven can do. Now letâ€™s build something real for your brand." }
];

function showOnboarding(){
  _obStep = 1;
  window._obActive = true;

  // Keep Team nav hidden â€” it's no longer a tour step
  var teamNav = document.getElementById("teamNavItem");
  if(teamNav){ teamNav._obWasHidden = false; }

  // Block interactions with the main content area during the tour
  var mc = document.querySelector(".mc");
  if(mc) mc.style.pointerEvents = "none";

  _obRender(1);
  console.log("[Onboarding] Spotlight tour started â€” " + _OB_STEPS.length + " steps");
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

  // â”€â”€ Spotlight vs full-screen backdrop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // On mobile the sidebar is off-canvas so the spotlight ring would
  // target invisible elements â€” use backdrop + bottom-sheet for all steps.
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

  // â”€â”€ Tooltip content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    nextBtn.textContent = isLast ? "Start Creating â†’" : "Next â†’";
    nextBtn.className   = "ob-tt-next" + (isLast ? " ob-tt-cta" : "");
    nextBtn.onclick     = isLast ? function(){ obFinish(); } : function(){ obGoTo(_obStep + 1); };
  }

  tt.style.opacity = "0";
  tt.style.display = "block";

  requestAnimationFrame(function(){
    if(isMobile){
      // â”€â”€ Mobile: bottom-sheet card above thumb zone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      // â”€â”€ Desktop: spotlight tooltip beside nav item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

      // Clamp vertically â€” keep 24px from both edges
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
      // â”€â”€ Desktop: centered final step â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  console.log("[Onboarding] Step â†’", step, "of", _OB_STEPS.length);
}

function obFinish(){
  console.log("[Onboarding] Tour complete â€” context:", _obContext);
  markOnboardingComplete();
  try { localStorage.removeItem("oriven_needs_onboarding"); } catch(_){}
  _obContext = "tour";
  hideOnboarding();
  setTimeout(function(){
    navigate("create");
    setTimeout(function(){ if(typeof openNewCampaign === "function") openNewCampaign(); }, 400);
  }, 300);
}

// â”€â”€ Keyboard: onboarding navigation + hard paywall Escape block â”€
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

// â”€â”€ Email verification helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _showVerifyBanner(daysLeft){
  var banner = document.getElementById("verifyBanner");
  var text   = document.getElementById("verifyBannerText");
  if(!banner) return;
  if(text){
    var timeStr;
    if(daysLeft <= 0){
      timeStr = " â€” your account may be removed soon";
    } else if(daysLeft === 1){
      timeStr = " â€” only 1 day remaining";
    } else if(daysLeft <= 3){
      timeStr = " â€” only " + daysLeft + " days remaining";
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
  if(btn){ btn.disabled = true; btn.textContent = "Sendingâ€¦"; }
  try {
    var sessionResult = await SB.auth.getSession();
    var session = sessionResult.data && sessionResult.data.session;
    if(!session){ toast("Please sign in first"); return; }
    var result = await apiFetch("/api/resend-verification", {
      method:  "POST",
      headers: { "Authorization": "Bearer " + session.access_token }
    });
    if(!result.ok) throw new Error(result.data.error || "Failed to send");
    toast("Verification email sent â€” check your inbox");
  } catch(err){
    console.error("[EmailVerify] Resend error:", err.message);
    toast("Could not send â€” " + err.message, "warn");
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
      setTimeout(function(){ toast("Email verified â€” your account is confirmed!"); }, 600);
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
  // Hide plan/usage row â€” not relevant for guests
  var usageWrap = document.querySelector(".sb-usage-wrap");
  if(usageWrap) usageWrap.style.display = "none";
}

// â”€â”€ BrandCore: save to Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function saveBCToDB(){
  if(typeof SB === "undefined"){ console.warn("[DB] Supabase not initialized"); return; }
  var userResult = await SB.auth.getUser();
  var user = userResult.data && userResult.data.user;
  if(!user){ console.log("[DB] Not logged in â€” BrandCore not saved to cloud"); return; }
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

// â”€â”€ BrandCore: load from Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ BrandCore: delete from Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Paywall â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function checkSubscriptionStatus(){
  if(typeof ORIVEN_DEV !== "undefined" && ORIVEN_DEV){
    // Dev: use _dbSubscriptionStatus (set by _loadUserProfile from Supabase) â€” never hardcode.
    if(_dbSubscriptionStatus !== null){
      console.log("[PW-CHAIN] checkSubscriptionStatus (dev) | cached:", _dbSubscriptionStatus);
      return _dbSubscriptionStatus;
    }
    // Not yet loaded â€” fall back to "free", not "professional"
    console.log("[PW-CHAIN] checkSubscriptionStatus (dev) | _dbSubscriptionStatus null â†’ defaulting to free");
    return "free";
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
    console.error("[Paywall] SB client not initialized â€” cannot check subscription");
    return "free";
  }

  // Live query â€” only reached during post-payment webhook lag or very early in session
  var userResult = await SB.auth.getUser();
  var user = userResult.data && userResult.data.user;
  if(!user){
    console.log("[Paywall] No authenticated user â€” defaulting to free");
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
    console.log("[Paywall] Supabase response â€” data:", rawData, "| error:", rawError);

    if(resp.error){
      // Most common causes:
      //   42703 â€” column does not exist (ALTER TABLE not yet run)
      //   42501 â€” RLS blocking the SELECT
      console.error("[Paywall] Query failed:", resp.error.message);
      if(resp.error.code === "42703"){
        console.error("[Paywall] FIX: run this in Supabase SQL Editor:\n  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text default 'free';");
      }
      // Fall back to the in-memory plan set by _loadUserProfile() rather than
      // hardcoding "free" â€” a DB error must NOT override a confirmed paid plan.
      var _cachedPlan = (typeof S !== "undefined" && S && S.currentPlan) ? S.currentPlan : "free";
      console.warn("[Paywall] Using cached plan as fallback:", _cachedPlan);
      return _cachedPlan;
    }

    if(!resp.data){
      // Profile row does not exist â€” create it so future checks work
      console.warn("[Paywall] No profile row found for user:", user.id, "â€” upserting defaults");
      var upsert = await SB.from("profiles").upsert(
        { id: user.id, email: user.email, subscription_status: "free", onboarding_completed: false },
        { onConflict: "id" }
      );
      if(upsert.error) console.error("[Paywall] Could not upsert profile:", upsert.error.message);
      // Use cached plan in case the upsert path fires for a paid user mid-session
      var _cachedPlan2 = (typeof S !== "undefined" && S && S.currentPlan) ? S.currentPlan : "free";
      return _cachedPlan2;
    }

    // We have a real row â€” read the value directly, do NOT fall back silently
    var status = resp.data.subscription_status;
    if(!status){
      console.warn("[Paywall] subscription_status is null/empty in DB â€” checking cached plan");
      var _cachedPlan3 = (typeof S !== "undefined" && S && S.currentPlan) ? S.currentPlan : "free";
      return _cachedPlan3;
    }

    var isPaid = status !== "free";
    console.log("[Paywall] subscription_status:", status, "â†’", isPaid
      ? "âœ“ SUBSCRIBED â€” paywall will NOT show"
      : "âœ— FREE â€” paywall will show");
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
  console.log("[Paywall] maybeShowPaywall() called â€” S.currentPlan at call time:", (typeof S !== "undefined" && S) ? S.currentPlan : "S not defined");
  console.trace("[Paywall] call stack (shows which function triggered this):");
  var status = await checkSubscriptionStatus();
  if(status !== "free"){
    console.log("[Paywall] Subscribed user (" + status + ") â€” paywall suppressed");
    return;
  }
  console.log("[Paywall] Free user â€” opening paywall modal");
  if(typeof openPaywall === "function") openPaywall();
}

// Hard paywall â€” shown after onboarding, cannot be dismissed until payment
var _paywallHard = false;

function _showHardPaywall(){
  _paywallHard = true;
  var modal = document.getElementById("modal-paywall");
  if(modal) modal.classList.add("pw-hard");
  if(typeof openPaywall === "function") openPaywall();
  console.log("[Paywall] Hard paywall shown â€” awaiting plan selection");
}

// Free-campaign conversion paywall â€” shown after first campaign is generated
function openFreePaywall(){
  console.log("[PW-CHAIN] openFreePaywall() called | _paywallHard was:", _paywallHard);
  _paywallHard = true;
  var modal = document.getElementById("modal-paywall");
  console.log("[PW-CHAIN] modal-paywall element:", modal ? "FOUND" : "NOT FOUND IN DOM");
  if(modal){
    modal.classList.add("pw-hard");
    console.log("[PW-CHAIN] Added pw-hard class | classList:", modal.className);
  }

  var titleEl = document.querySelector("#modal-paywall .pw-title");
  var subEl   = document.querySelector("#modal-paywall .pw-sub");
  var eyeEl   = document.querySelector("#modal-paywall .pw-eyebrow span");
  console.log("[PW-CHAIN] Title element:", titleEl ? "found" : "NOT FOUND");
  console.log("[PW-CHAIN] Sub element:", subEl ? "found" : "NOT FOUND");
  if(titleEl)  titleEl.innerHTML = "ðŸŽ Your Free Campaign Is Ready";
  if(subEl)    subEl.textContent = "Youâ€™ve successfully generated your first campaign. To download, save, edit, manage or continue creating campaigns, choose a plan.";
  if(eyeEl)    eyeEl.textContent = "One Free Campaign Delivered";

  console.log("[PW-CHAIN] Calling openPaywall() | typeof openPaywall:", typeof openPaywall);
  if(typeof openPaywall === "function"){
    openPaywall();
  } else {
    console.error("[PW-CHAIN] openPaywall is NOT a function â€” paywall.js may not be loaded yet");
  }
  console.log("[PW-CHAIN] openFreePaywall() complete | modal classList:", modal ? modal.className : "N/A");
}
window.openFreePaywall = openFreePaywall;

function closePaywall(){
  console.log("[PW-CHAIN] closePaywall() called | _paywallHard:", _paywallHard);
  if(_paywallHard){
    console.log("[PW-CHAIN] closePaywall() BLOCKED â€” hard paywall active");
    return;
  }
  if(typeof closeModal === "function") closeModal("modal-paywall");
  console.log("[PW-CHAIN] closePaywall() completed â€” modal closed");
}

// After successful Stripe payment: navigate to the page the user came from
function _postPaymentNavigate(){
  var returnPage = null;
  try { returnPage = localStorage.getItem("oriven_post_payment_return"); } catch(_){}
  if(returnPage){
    try { localStorage.removeItem("oriven_post_payment_return"); } catch(_){}
    if(typeof navigate === "function") navigate(returnPage);
  } else {
    showOnboarding();
  }
}

async function selectPlan(plan){
  console.log("[Paywall] Plan selected:", plan);
  var btn = document.querySelector('[onclick="selectPlan(\'' + plan + '\')"]');
  if(btn){ btn.disabled = true; btn.textContent = "Redirectingâ€¦"; }

  // Save return destination â€” if free user is converting from campaign-workspace, send them back there
  try {
    var _cwrPg = document.getElementById("page-campaign-workspace");
    if(_cwrPg && _cwrPg.classList.contains("active")){
      localStorage.setItem("oriven_post_payment_return", "campaign-workspace");
    }
  } catch(_){}

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
    toast("Could not start checkout â€” please try again");
    if(btn){ btn.disabled = false; btn.textContent = btn.getAttribute("data-label") || "Get Started"; }
  }
}

// â”€â”€ Session restore on page load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

document.addEventListener("DOMContentLoaded", async function(){
  trackEvent("visited_site");
  console.log("[PW-CHAIN] â•â• DOMContentLoaded | localStorage snapshot:");
  try {
    var _lsSnap = {};
    for(var _k = 0; _k < localStorage.length; _k++){
      var _key = localStorage.key(_k);
      if(_key && (_key.indexOf('oriven_fc') !== -1 || _key.indexOf('oriven_free') !== -1))
        _lsSnap[_key] = localStorage.getItem(_key);
    }
    console.log("[PW-CHAIN] Paywall-related localStorage keys:", JSON.stringify(_lsSnap));
  } catch(_){}

  // Reset the authoritative subscription state â€” only _loadUserProfile() may set it.
  // _dbSubscriptionStatus = null means "not yet loaded from Supabase".
  // Access gates check this variable; null â†’ don't block (waiting for DB).
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
    toast("Checkout canceled â€” you can upgrade anytime.");
  } else if(_tourParam){
    history.replaceState(null, "", "/app");
    _loadPath = "/app";
  }

  // Hide app immediately â€” show only after auth confirmed
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
    // syncSubscriptionFromDB() (backend API) â€” Supabase is the single source of truth.
    if(_stripeOk){
      setTimeout(async function(){
        var status = await checkSubscriptionStatus();
        if(status && status !== "free"){
          _dbSubscriptionStatus = status;
          S.currentPlan = status;
          if(typeof _updateSidebarPlan === "function") _updateSidebarPlan(status);
          if(typeof invalidatePlanCache === "function") invalidatePlanCache();
          if(typeof renderPlanPanel === "function") renderPlanPanel();
          toast("Your subscription is now active â€” welcome to ORIVEN!");
          setTimeout(_postPaymentNavigate, 600);
        } else {
          // Webhook may not have arrived yet â€” retry once after a short delay
          toast("Payment received â€” activating your account...");
          setTimeout(async function(){
            status = await checkSubscriptionStatus();
            _dbSubscriptionStatus = status;
            if(status && status !== "free"){
              S.currentPlan = status;
              if(typeof _updateSidebarPlan === "function") _updateSidebarPlan(status);
              if(typeof invalidatePlanCache === "function") invalidatePlanCache();
              if(typeof renderPlanPanel === "function") renderPlanPanel();
              toast("Your subscription is now active â€” welcome to ORIVEN!");
              setTimeout(_postPaymentNavigate, 400);
            } else {
              toast("Subscription pending â€” please refresh in a moment.");
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
    console.log("[Auth] No session â€” showing guest landing");
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// BRAND ONBOARDING â€” multi-step questionnaire for new free users
// Replaces the spotlight nav tour when _obContext === "gate"
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

var _obBrandStep    = 1;
var _obBrandTotal   = 7;
var _obBrandAnswers = {};

var _OB_BRAND_STEPS = [
  null, // 1-indexed
  { q: "What's your business called?",                   type: "text",   id: "obBrandName",     placeholder: "e.g. Luna Coffee, Apex Media, Brightfield" },
  { q: "What industry are you in?",                      type: "chips",  group: "industry",     single: true,  opts: ["E-commerce","SaaS","Professional Services","Hospitality","Health & Wellness","Fashion","Food & Beverage","Real Estate","Education","Other"] },
  { q: "Who are your customers?",                        type: "text",   id: "obBrandAudience", placeholder: "e.g. Small business owners aged 25â€“45 who want to grow online" },
  { q: "What are you trying to achieve?",                type: "chips",  group: "goals",        single: false, opts: ["Build brand awareness","Generate leads","Drive sales","Grow social following","Launch a new product","Scale existing business"] },
  { q: "How would you describe your brand's personality?", type: "chips", group: "style",       single: true,  opts: ["Modern & Clean","Bold & Energetic","Luxury & Premium","Playful & Creative","Professional & Trusted","Minimalist"] },
  { q: "What do you sell or offer?",                     type: "text",   id: "obBrandOffer",    placeholder: "e.g. SEO services, handmade jewellery, SaaS analytics tool" },
  { q: "Which campaign types interest you?",             type: "chips",  group: "campaigns",    single: false, opts: ["Meta Ads","Google Ads","TikTok Ads","Email","Landing Pages","Social Content"] }
];

function showBrandOnboarding(){
  _obBrandStep    = 1;
  _obBrandAnswers = {};
  window._obActive = true;
  var overlay = document.getElementById("obBrandOverlay");
  if(overlay){ overlay.style.display = "flex"; }
  _obBrandRender();
}

function _obBrandRender(){
  var step = _obBrandStep;
  var def  = _OB_BRAND_STEPS[step];
  if(!def) return;

  // Update progress dots
  var prog = document.getElementById("obBrandProgress");
  if(prog){
    var dots = "";
    for(var i = 1; i <= _obBrandTotal; i++){
      dots += '<div class="obd-dot' + (i === step ? " obd-dot-active" : (i < step ? " obd-dot-done" : "")) + '"></div>';
    }
    prog.innerHTML = dots;
  }

  // Update step counter
  var ctr = document.getElementById("obBrandCounter");
  if(ctr) ctr.textContent = step + " / " + _obBrandTotal;

  // Render question
  var qEl = document.getElementById("obBrandQuestion");
  if(qEl) qEl.textContent = def.q;

  // Render input area
  var body = document.getElementById("obBrandBody");
  if(!body) return;
  if(def.type === "text"){
    var saved = _obBrandAnswers["txt_" + step] || "";
    body.innerHTML = '<input class="obd-input" id="' + def.id + '" type="text" placeholder="' + (def.placeholder||"") + '" value="' + _escObBrand(saved) + '" autocomplete="off">';
    var inp = document.getElementById(def.id);
    if(inp){ inp.focus(); inp.addEventListener("keydown", function(e){ if(e.key==="Enter") obBrandNext(); }); }
  } else if(def.type === "chips"){
    var saved2 = _obBrandAnswers["chips_" + step] || [];
    var html = '<div class="obd-chips">';
    def.opts.forEach(function(opt){
      var sel = saved2.indexOf(opt) !== -1 ? " obd-chip-sel" : "";
      html += '<button class="obd-chip' + sel + '" onclick="obBrandToggleChip(this,' + def.single + ')">' + opt + '</button>';
    });
    html += "</div>";
    body.innerHTML = html;
  }

  // Nav buttons
  var backBtn = document.getElementById("obBrandBack");
  var nextBtn = document.getElementById("obBrandNext");
  if(backBtn) backBtn.style.visibility = (step === 1) ? "hidden" : "visible";
  if(nextBtn) nextBtn.textContent = (step === _obBrandTotal) ? "Finish â†’" : "Next â†’";
}

function _escObBrand(s){ return String(s||"").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

window.obBrandToggleChip = function(el, single){
  if(single){
    el.closest(".obd-chips").querySelectorAll(".obd-chip").forEach(function(c){ c.classList.remove("obd-chip-sel"); });
    el.classList.add("obd-chip-sel");
  } else {
    el.classList.toggle("obd-chip-sel");
  }
};

function _obBrandCollect(){
  var step = _obBrandStep;
  var def  = _OB_BRAND_STEPS[step];
  if(!def) return;
  if(def.type === "text"){
    var inp = document.getElementById(def.id);
    if(inp) _obBrandAnswers["txt_" + step] = inp.value.trim();
  } else if(def.type === "chips"){
    var sel = [];
    document.querySelectorAll(".obd-chips .obd-chip-sel").forEach(function(c){ sel.push(c.textContent.trim()); });
    _obBrandAnswers["chips_" + step] = sel;
  }
}

window.obBrandNext = function(){
  _obBrandCollect();
  if(_obBrandStep < _obBrandTotal){
    _obBrandStep++;
    _obBrandRender();
  } else {
    _obBrandFinish();
  }
};

window.obBrandBack = function(){
  _obBrandCollect();
  if(_obBrandStep > 1){
    _obBrandStep--;
    _obBrandRender();
  }
};

window.obBrandSkip = function(){
  _obBrandFinish();
};

function _obBrandFinish(){
  // Save collected brand data as a starter BrandCore
  try {
    var bc = {};
    if(_obBrandAnswers["txt_1"]) bc.name     = _obBrandAnswers["txt_1"];
    var ind = _obBrandAnswers["chips_2"];
    if(ind && ind.length) bc.industry = ind[0];
    if(_obBrandAnswers["txt_3"]) bc.audience  = _obBrandAnswers["txt_3"];
    var goals = _obBrandAnswers["chips_4"];
    if(goals && goals.length) bc.positioning = "Goals: " + goals.join(", ");
    var style = _obBrandAnswers["chips_5"];
    if(style && style.length) bc.personality = style[0];
    if(_obBrandAnswers["txt_6"]) bc.messaging = _obBrandAnswers["txt_6"];
    if(bc.name){
      // Merge into existing BrandCore or create new
      var existing = {};
      try { existing = JSON.parse(localStorage.getItem("oriven_bc") || "{}"); } catch(_){}
      Object.assign(existing, bc);
      localStorage.setItem("oriven_bc", JSON.stringify(existing));
      if(typeof S !== "undefined" && S) S.brandCore = existing;
    }
  } catch(_){}

  // Mark onboarding complete in DB + clear localStorage flag
  markOnboardingComplete();
  try { localStorage.removeItem("oriven_needs_onboarding"); } catch(_){}

  // Close overlay
  var overlay = document.getElementById("obBrandOverlay");
  if(overlay) overlay.style.display = "none";
  window._obActive = false;
  _obContext = "tour";

  // Show product tour, then reward screen
  setTimeout(function(){ _showFreeProductTour(); }, 250);
}

function _showRewardScreen(){
  var overlay = document.getElementById("obRewardOverlay");
  if(overlay) overlay.style.display = "flex";
}

window.rewardStartCreating = function(){
  var overlay = document.getElementById("obRewardOverlay");
  if(overlay) overlay.style.display = "none";
  navigate("create");
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FREE PRODUCT TOUR â€” 4 slides shown after brand onboarding
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

var _obTourStep  = 1;
var _obTourTotal = 4;

var _obTourSlides = [
  {
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M12 8v8"/></svg>',
    iconCls: "ob-icon-create",
    section: "Campaign Studio",
    title: "Create campaigns that <em>move your brand forward.</em>",
    desc: "Generate full campaigns â€” copy, visuals, strategy â€” tailored to your brand in seconds. No templates, no guessing."
  },
  {
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
    iconCls: "ob-icon-studio",
    section: "Brand Profile",
    title: "Your brand identity, <em>all in one place.</em>",
    desc: "Tone of voice, visual identity, audience, and positioning â€” Oriven keeps your brand consistent across every campaign."
  },
  {
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
    iconCls: "ob-icon-inspiration",
    section: "Brand Assets",
    title: "All your creative assets, <em>organized for you.</em>",
    desc: "Access templates, inspiration, and every campaign you've generated â€” ready to remix and build on at any time."
  },
  {
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12h.01M12 12h.01M16 12h.01" stroke-width="2.5"/></svg>',
    iconCls: "ob-icon-dashboard",
    section: "AI Assistant",
    title: "Your personal brand strategist, <em>always on.</em>",
    desc: "Ask anything â€” campaign ideas, copy feedback, competitor questions, strategy. The Assistant knows your brand inside out."
  }
];

function _showFreeProductTour(){
  _obTourStep = 1;
  var overlay = document.getElementById("obTourOverlay");
  if(overlay){ overlay.style.display = "flex"; }
  _obTourRender();
}

function _obTourRender(){
  var slide = _obTourSlides[_obTourStep - 1];
  if(!slide) return;

  var iconEl    = document.getElementById("obTourIcon");
  var sectionEl = document.getElementById("obTourSection");
  var titleEl   = document.getElementById("obTourTitle");
  var descEl    = document.getElementById("obTourDesc");
  var dotsEl    = document.getElementById("obTourDots");
  var backBtn   = document.getElementById("obTourBack");
  var nextBtn   = document.getElementById("obTourNext");

  if(iconEl){ iconEl.className = "ob-tour-icon " + slide.iconCls; iconEl.innerHTML = slide.icon; }
  if(sectionEl) sectionEl.textContent = slide.section;
  if(titleEl)   titleEl.innerHTML     = slide.title;
  if(descEl)    descEl.textContent    = slide.desc;

  // Dots
  if(dotsEl){
    dotsEl.innerHTML = "";
    for(var i = 1; i <= _obTourTotal; i++){
      var d = document.createElement("div");
      d.className = "ob-dot" + (i === _obTourStep ? " ob-dot-active" : "");
      dotsEl.appendChild(d);
    }
  }

  // Back button visibility
  if(backBtn) backBtn.style.visibility = _obTourStep > 1 ? "visible" : "hidden";

  // Next button label
  if(nextBtn){
    if(_obTourStep === _obTourTotal){
      nextBtn.textContent = "Claim Your Free Campaign â†’";
      nextBtn.className   = "ob-next-btn ob-finish";
    } else {
      nextBtn.textContent = "Next";
      nextBtn.className   = "ob-next-btn";
    }
  }
}

window.obTourNext = function(){
  if(_obTourStep < _obTourTotal){
    _obTourStep++;
    _obTourRender();
  } else {
    obTourFinish();
  }
};

window.obTourBack = function(){
  if(_obTourStep > 1){ _obTourStep--; _obTourRender(); }
};

window.obTourFinish = function(){
  var overlay = document.getElementById("obTourOverlay");
  if(overlay) overlay.style.display = "none";
  setTimeout(function(){ _showRewardScreen(); }, 200);
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FREE TRIAL GUARD â€” gate export/download/copy for free users
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function _isFreeUser(){
  var sub = (typeof _dbSubscriptionStatus !== "undefined") ? _dbSubscriptionStatus : "UNDEFINED";
  var result = sub === "free";
  console.log("[PW-CHAIN] _isFreeUser() â†’", result, "| _dbSubscriptionStatus:", sub);
  return result;
}

function _freeCampaignUsed(){
  try {
    var _uid = (_currentUser && _currentUser.id) ? _currentUser.id : null;
    if(!_uid){
      console.log("[PW-CHAIN] _freeCampaignUsed() â†’ false (no uid, _currentUser:", _currentUser, ")");
      return false;
    }
    var scopedKey  = "oriven_fcused_" + _uid;
    var legacyKey  = "oriven_free_campaign_used";
    var scoped     = localStorage.getItem(scopedKey);
    var legacy     = localStorage.getItem(legacyKey);
    console.log("[PW-CHAIN] _freeCampaignUsed() | uid:", _uid, "| scoped (", scopedKey, "):", scoped, "| legacy:", legacy);
    // If only the legacy key exists, migrate it to the scoped key
    if(scoped !== "1" && legacy === "1"){
      console.log("[PW-CHAIN] Migrating legacy key â†’ scoped key for uid:", _uid);
      try { localStorage.setItem(scopedKey, "1"); } catch(_){}
      return true;
    }
    var result = scoped === "1";
    console.log("[PW-CHAIN] _freeCampaignUsed() â†’", result);
    return result;
  } catch(e){
    console.error("[PW-CHAIN] _freeCampaignUsed() ERROR:", e);
    return false;
  }
}

window._cwsFreeGuard = function(action){
  var free = _isFreeUser();
  var used = _freeCampaignUsed();
  console.log("[PW-CHAIN] _cwsFreeGuard('" + action + "') | free:", free, "| used:", used);
  if(!free) return true; // paid users: always allowed
  openFreePaywall();
  return false;
};

window._getCurrentUser = function(){ return _currentUser; };

// â”€â”€ Paywall diagnostic helper â€” call window._paywallDiag() in browser console â”€â”€
window._paywallDiag = function(){
  console.group("[PW-DIAG] â•â• Paywall State Report â•â•");
  var sub = typeof _dbSubscriptionStatus !== "undefined" ? _dbSubscriptionStatus : "UNDEFINED";
  var uid = _currentUser && _currentUser.id ? _currentUser.id : null;
  console.log("_dbSubscriptionStatus:", sub);
  console.log("_currentUser.id:", uid);
  if(uid){
    console.log("localStorage oriven_fcused_" + uid + ":", localStorage.getItem("oriven_fcused_" + uid));
    console.log("localStorage oriven_free_campaign_used (legacy):", localStorage.getItem("oriven_free_campaign_used"));
  }
  console.log("_isFreeUser():", typeof _isFreeUser === "function" ? _isFreeUser() : "FUNCTION NOT FOUND");
  console.log("_freeCampaignUsed():", typeof _freeCampaignUsed === "function" ? _freeCampaignUsed() : "FUNCTION NOT FOUND");
  console.log("_paywallHard:", typeof _paywallHard !== "undefined" ? _paywallHard : "UNDEFINED");
  console.log("openFreePaywall:", typeof openFreePaywall);
  console.log("openPaywall:", typeof openPaywall);
  console.log("openModal:", typeof openModal);
  var pwEl = document.getElementById("modal-paywall");
  if(pwEl){
    var cs = window.getComputedStyle(pwEl);
    console.group("modal-paywall DOM");
    console.log("className:", pwEl.className);
    console.log("style.display:", pwEl.style.display);
    console.log("computed display:", cs.display);
    console.log("computed opacity:", cs.opacity);
    console.log("computed z-index:", cs.zIndex);
    console.log("computed visibility:", cs.visibility);
    console.log("has .open:", pwEl.classList.contains("open"));
    console.log("has .pw-hard:", pwEl.classList.contains("pw-hard"));
    console.log("children count:", pwEl.children.length);
    console.groupEnd();
  } else {
    console.error("modal-paywall element NOT FOUND in DOM");
  }
  console.groupEnd();
};
