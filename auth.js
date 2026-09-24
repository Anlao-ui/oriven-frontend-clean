// â•â•â• AUTH + DATABASE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Handles: sign up, sign in, sign out, session restore,
//          BrandCore save/load from Supabase.

var _currentUser          = null;
var _onboardingShown      = false;
var _postPayment          = false; // True when landing from Stripe ?success=true — suppresses subscription gate
var _dbPlanSet            = false; // True once _loadUserProfile() confirms a paid plan from Supabase
var _dbSubscriptionStatus = null;  // null = not yet loaded | "free"/"creator"/"professional"/"starter"/"agency" = from Supabase
var _dbPrimaryGoal        = null;  // null = not yet loaded/not yet chosen | one of onboarding.js's OB2_GOALS ids, from Supabase profiles.primary_goal

// â”€â”€ Route helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _setAppRoute(route){
  try { history.replaceState(null, "", route); } catch(_){}
  // Fire a page_view so Google Ads URL-based conversions trigger on /app
  if(typeof gtag === "function"){
    gtag("event", "page_view", { page_path: route, page_title: document.title });
  }
}

// â”€â”€ UI helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// UX + Reliability Overhaul — root-cause fix. showApp() runs earlier
// than anything else in the real sign-in flow (it's what reveals the
// app UI at all), so its own copy of "show the pending OAuth toast"
// ALWAYS won the race against the two other, more complete copies that
// used to live in app.html's window.initIntegrations and settings.js —
// and this one was hardcoded Google-only from before TikTok/Meta/
// Pinterest existed. Caught live: a Pinterest access_denied return
// showed "Google sign-in was cancelled." Fixed by making this the one
// authoritative, provider-aware place the toast is shown (it always
// runs first regardless of which page the user lands on), reusing the
// same per-provider names/messages every other Connections surface
// uses — no more drifted duplicate copies.
var _OAUTH_RETURN_PLATFORM_NAMES = { google: "Google Ads", meta: "Meta Ads", tiktok: "TikTok Ads", pinterest: "Pinterest Ads" };
var _OAUTH_RETURN_ERROR_MAP = {
  access_denied:  "sign-in was cancelled.",
  token_exchange: "connection failed — please try again.",
  invalid_state:  "session expired — please try again.",
  db:             "could not save the connection — please try again.",
  network:        "network error — please try again.",
  not_configured: "isn't yet configured on the server.",
  missing_token:  "authentication error — please try again.",
  invalid_token:  "authentication error — please sign in and try again.",
  auth_error:     "authentication error — please try again.",
  missing_params: "OAuth error — please try again."
};
function showApp(){
  var overlay = document.getElementById("authOverlay");
  var app     = document.querySelector(".app");
  if(overlay) overlay.style.display = "none";
  if(app)     app.style.display     = "";
  // Show the pending OAuth-return toast (set by _detectPendingOAuthReturn on return from OAuth)
  var _oar = window._pendingOAuthResult;
  if(_oar){
    window._pendingOAuthResult = null;
    var platformName = _OAUTH_RETURN_PLATFORM_NAMES[_oar.provider] || "Your platform";
    setTimeout(function(){
      if(_oar.connected){
        if(typeof toast === "function") toast(platformName + " connected successfully!");
        if(typeof navigate === "function") navigate('integrations');
      } else if(_oar.error){
        var suffix = _OAUTH_RETURN_ERROR_MAP[_oar.error] || "connection failed.";
        if(typeof toast === "function") toast(platformName + " " + suffix, "err");
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
    return "Too many attempts — please wait a moment and try again.";
  if(/network|failed to fetch/i.test(msg))
    return "Connection error. Please check your internet and try again.";
  // No known pattern matched — never surface the raw provider/exception
  // string here; always fall back to friendly copy.
  return "Something went wrong. Please try again.";
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
  if(typeof S !== "undefined" && S){ S.currentPlan = "free"; S.campaigns = []; S.assets = []; }
  // _campaigns/_loadCamps (app.html) is per-user-keyed via _orvCampaignsKey(),
  // but reset the in-memory copy too so nothing stale renders before the
  // next sign-in's own _loadCamps() call.
  if(typeof window._campaigns !== "undefined") window._campaigns = [];
  try { if(typeof saveSettings === "function") saveSettings({ currentPlan: "free" }); } catch(_){}
  // Clear guest generation flag so user gets a fresh try after logout
  localStorage.removeItem("guestGenerationUsed");
  showGuestLanding();
  toast("Signed out");
}

// â”€â”€ After sign in: update UI, load BrandCore, show app â”€â”€â”€â”€â”€â”€â”€

async function syncSubscriptionFromDB(){
  if(typeof ORIVEN_DEV !== "undefined" && ORIVEN_DEV){
    // Dev mode: use actual _dbSubscriptionStatus set by _loadUserProfile() — never hardcode.
    // If _dbSubscriptionStatus is not yet loaded, fall back to "free" (not "professional").
    var _devSyncPlan = (_dbSubscriptionStatus && _dbSubscriptionStatus !== null)
      ? _dbSubscriptionStatus : "free";
    console.log("[PW-CHAIN] syncSubscriptionFromDB (dev) | _dbSubscriptionStatus:", _dbSubscriptionStatus, "←’ using:", _devSyncPlan);
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
  // Must run BEFORE _setAppRoute() strips the query string — see
  // _detectPendingOAuthReturn()'s own header comment for why.
  _detectPendingOAuthReturn();
  _setAppRoute("/app");
  // Fire non-blocking background work immediately
  loadBrandCoreFromDB(user);
  if(typeof window._orvMigrateLocalCampaigns === "function") window._orvMigrateLocalCampaigns();
  // NOTE: syncSubscriptionFromDB() intentionally NOT called here.
  // _loadUserProfile() below queries Supabase directly and is the single
  // source of truth for plan state. Calling a second async backend source
  // created race conditions that overwrote the correct plan with stale data.
  if(typeof initUsageTracking === "function") initUsageTracking(user);
  if(typeof _syncBrowserTimezone === "function") _syncBrowserTimezone();
  // Subscription check determines whether to show app, onboarding, or redirect.
  // showApp() and navigate() are called inside _loadUserProfile() to prevent
  // the app from briefly flashing for unpaid users.
  await _loadUserProfile(user);
}

// â”€â”€ Profile: single consolidated query â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// UX + Reliability Overhaul — root-cause fix. This detection used to
// live inside _loadUserProfile(), which onUserSignedIn() only calls
// AFTER _setAppRoute("/app") has already run history.replaceState(null,
// "", "/app") — unconditionally discarding the ENTIRE query string,
// google_error/meta_error/tiktok_error/pinterest_error included, before
// any of these blocks got a chance to read them. Confirmed for real via
// a live browser check (window.location.search was already empty by
// the time _loadUserProfile ran). This affected all four platforms
// identically, not just the Pinterest gap found earlier in this pass —
// an OAuth failure returning to an already-signed-in session (the
// common case, since a user must already be signed into ORIVEN to
// start a platform-connect flow) silently lost its result. Fixed by
// extracting this into its own function and calling it BEFORE
// _setAppRoute() runs (see onUserSignedIn below), while the real query
// string still exists.
function _detectPendingOAuthReturn(){
  var _platformParams = [
    ["google", "google_connected", "google_error"],
    ["tiktok", "tiktok_connected", "tiktok_error"],
    ["meta", "meta_connected", "meta_error"],
    ["pinterest", "pinterest_connected", "pinterest_error"]
  ];
  for(var i = 0; i < _platformParams.length; i++){
    var provider = _platformParams[i][0], connectedKey = _platformParams[i][1], errorKey = _platformParams[i][2];
    try {
      var qp = new URLSearchParams(window.location.search);
      var connected = qp.get(connectedKey);
      var error = qp.get(errorKey);
      if(connected === "1" || error){
        window._pendingOAuthResult = { provider: provider, connected: connected === "1", error: error || null };
        console.log("[" + provider + " OAuth] Return detected | connected:", connected === "1", "| error:", error || null);
        setTimeout(function(){
          if(typeof _orvNav === "function") _orvNav("connect", "page-integrations");
          else if(typeof navigate === "function") navigate("integrations");
        }, 800);
        break; // exactly one platform's params can be present on a given return
      }
    } catch(_){}
  }
}

async function _loadUserProfile(user){

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

    // Auth is the source of truth for the authenticated email — if a user
    // changed their email via Settings (SB.auth.updateUser), profiles.email
    // goes stale until this reconciles it. Fire-and-forget, self-limiting
    // (server no-ops once already in sync): server derives the email from
    // the verified JWT itself, never from anything this client sends, so
    // this can only ever correct profiles.email to the caller's own real
    // authenticated address.
    if(data && data.email !== user.email && typeof apiFetch === "function"){
      apiFetch("/api/profile/sync-email", { method: "POST" }).catch(function(){});
    }

    // Subscription gate — determines whether to reveal the app or enforce paywall
    if(typeof ORIVEN_DEV !== "undefined" && ORIVEN_DEV){
      // Dev mode: always read from DB — never hardcode a plan.
      // Falls back to "free" (not "professional") when the DB has no value.
      var _devRaw = (data && typeof data.subscription_status === "string") ? data.subscription_status.trim() : "";
      var _devStatus = _devRaw || "free";
      console.log("[PW-CHAIN] _loadUserProfile (dev) | DB subscription_status raw:", JSON.stringify(_devRaw), "←’ _devStatus:", _devStatus, "| source:", _devRaw ? "Supabase profiles.subscription_status" : "fallback default (no DB value)");
      _dbSubscriptionStatus = _devStatus;
      S.currentPlan = _devStatus;
      if(typeof _updateSidebarPlan === "function") _updateSidebarPlan(_devStatus);
      if(typeof invalidatePlanCache === "function") invalidatePlanCache();
      if(typeof renderPlanPanel === "function") renderPlanPanel();
      showApp();
      // Check if onboarding is needed in dev mode too (new accounts should see the tour)
      _dbPrimaryGoal = data ? (data.primary_goal || null) : null;
      var _devObCompleted = data ? data.onboarding_completed === true : false;
      var _devObNeeded = false;
      try { _devObNeeded = localStorage.getItem("oriven_needs_onboarding") === "1"; } catch(_){}
      if(!_devObCompleted || _devObNeeded){
        navigate("create");
        startOnboarding(_dbPrimaryGoal);
      } else {
        navigate("create");
      }
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
      navigate("create");
    } else {
      _dbPrimaryGoal = data ? (data.primary_goal || null) : null;
      var _dbPlan = (data && typeof data.subscription_status === "string") ? data.subscription_status.trim() : "";
      _dbSubscriptionStatus = _dbPlan || "free"; // authoritative value — ONLY set from Supabase
      var _isPaid = _dbSubscriptionStatus !== "free";
      var _statusSource = _dbPlan ? ("Supabase profiles.subscription_status = '" + _dbPlan + "'") : ("no DB value — defaulting to 'free'");
      console.log("[PW-CHAIN] _loadUserProfile | user:", user.id, "| _dbSubscriptionStatus:", _dbSubscriptionStatus, "| source:", _statusSource, "| isPaid:", _isPaid);
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
        navigate("create");
        // Even a paid subscriber gets the tour once, e.g. if they subscribed
        // before ever opening the app. Same DB-first check as the free branch.
        var _paidDbCompleted = data ? data.onboarding_completed === true : false;
        var _paidLsNeedsOb   = false;
        try { _paidLsNeedsOb = localStorage.getItem("oriven_needs_onboarding") === "1"; } catch(_){}
        if(!_paidDbCompleted || _paidLsNeedsOb){
          startOnboarding(_dbPrimaryGoal);
        }
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
          showApp();
          navigate("create");
          startOnboarding(_dbPrimaryGoal);
        } else {
          // Onboarding done, free user — check whether their free campaign has been used
          showApp();
          console.log("[PW-CHAIN] _loadUserProfile | onboarding done, sub=free | user:", user.id);
          console.log("[PW-CHAIN] DB profile data.free_campaign_used:", data && data.free_campaign_used);

          // Sync free_campaign_used from DB profile (survives logout / new devices)
          var _dbUsedFlag = data && data.free_campaign_used === true;
          var _scopedKey  = "oriven_fcused_" + user.id;
          var _legacyKey  = "oriven_free_campaign_used";
          if(_dbUsedFlag){
            try { localStorage.setItem(_scopedKey, "1"); } catch(_){}
            console.log("[PW-CHAIN] Synced free_campaign_used from DB ←’ localStorage key:", _scopedKey);
          }
          // Sync the rolling-24h timestamp too -- this, not the lifetime
          // boolean above, is what _freeCampaignUsed() now actually checks
          // (mirrors requireSubOrOnboardingGen's server-side daily window,
          // server.js). The server remains authoritative regardless of what
          // this local copy says -- this is purely so the client's own UI
          // (Start Generation button, sidebar nav gate) doesn't show a stale
          // "blocked" state a day after the server would already allow a
          // fresh generation.
          if(data && data.free_campaign_used_at){
            try { localStorage.setItem("oriven_fcused_at_" + user.id, data.free_campaign_used_at); } catch(_){}
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

          // Free is now a real, persistent plan (10 credits/day, 1
          // Intelligence use/month) -- a returning Free user just lands on
          // the app normally, same as any other plan, instead of the
          // paywall re-opening on every single page load. The one-time,
          // in-session openFreePaywall() call right after their first
          // generation completes (_orvEndOnboardingIntoPaywall, wired
          // elsewhere) already covers the "here's what's next" moment;
          // this used-to-fire-every-load re-announcement was what made
          // Free feel like an error state rather than a legitimate plan.
          console.log("[PW-CHAIN] Free user — allowing normal access | campaign previously used:", _isUsed);
          navigate("create");
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

    // subscription_status is UNKNOWN — leave _dbSubscriptionStatus as null so
    // access gates pass through rather than wrongly blocking a paid user.
    _dbSubscriptionStatus = null;

    // Clear any stale plan label from localStorage / initSettings.
    // We must NOT display a cached plan name (e.g. "Professional") when
    // we don't actually know the plan — that hides the real bug.
    var _sbPlanEl = document.getElementById("sbPlanLabel");
    if(_sbPlanEl){ _sbPlanEl.textContent = "—"; _sbPlanEl.className = "sb-plan-label sb-plan-free"; }

    showApp();
    navigate("create");
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

// â”€â”€ Onboarding: spotlight product tour (Oriven 1.0) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Every frame spotlights a real element on the real, live app — never
// a full-screen slideshow. Frames are grouped under 10 "major steps"
// (the number shown to the user); several major steps (Campaigns hub
// tabs, Business's 6 tabs) fan out into multiple frames so each tab
// gets its own explanation, without inflating the visible step count.
// The last two frames (Generate, Publish) are "interactive-wait": no
// Next button, the tour waits for a real click on the real button.
// window._obActive: guards the sidebar-lock + keyboard handlers.

var _obStep    = 1;   // 1-based index into _OB_FRAMES
var _obContext = "tour"; // "gate" = pre-payment; "tour" = post-payment/dev

function _obT(key, fallback){ return (typeof t === "function") ? t(key) : fallback; }

function _obNav(page, pageId){ if(typeof _orvNav === "function") _orvNav(page, pageId); }
function _obBizNav(tab){
  _obNav("businessbrain", "page-business-brain");
  if(typeof bizSwitchTab === "function") bizSwitchTab(tab);
}

var _OB_FRAMES = [
  { majorStep:1, centered:true, titleKey:"obWelcomeTitle", descKey:"obWelcomeDesc" },
  { majorStep:2, selector:'.orv-ni[data-orv-page="create"]', sectionKey:"obLaunchSection", titleKey:"obLaunchTitle", descKey:"obLaunchDesc",
    onEnter:function(){ _obNav("create","page-create"); } },
  { majorStep:3, selector:'.orv-ni[data-orv-page="performance"]', sectionKey:"obCampaignsSection", titleKey:"obCampaignsTitle", descKey:"obCampaignsDesc",
    onEnter:function(){ _obNav("performance","page-performance"); } },
  { majorStep:4, selector:'.orv-hub-tab[data-hub-target="performance"]', sectionKey:"obCampaignsSection", titleKey:"obOverviewTitle", descKey:"obOverviewDesc",
    onEnter:function(){ _obNav("performance","page-performance"); } },
  { majorStep:4, selector:'.orv-hub-tab[data-hub-target="adsmanager"]', sectionKey:"obCampaignsSection", titleKey:"obLiveCampaignsTitle", descKey:"obLiveCampaignsDesc",
    onEnter:function(){ _obNav("adsmanager","page-ads-manager"); } },
  { majorStep:4, selector:'.orv-hub-tab[data-hub-target="campaigns"]', sectionKey:"obCampaignsSection", titleKey:"obDraftsTitle", descKey:"obDraftsDesc",
    onEnter:function(){ _obNav("campaigns","page-campaigns"); } },
  { majorStep:5, selector:'.orv-ni[data-orv-page="intelligence"]', sectionKey:"obIntelligenceSection", titleKey:"obIntelligenceTitle", descKey:"obIntelligenceDesc",
    onEnter:function(){ _obNav("intelligence","page-intelligence"); } },
  { majorStep:6, selector:'.orv-ni[data-orv-page="autopilot"]', sectionKey:"obAutopilotSection", titleKey:"obAutopilotTitle", descKey:"obAutopilotDesc",
    onEnter:function(){ _obNav("autopilot","page-autopilot"); } },
  { majorStep:7, selector:'.orv-ni[data-orv-page="businessbrain"]', sectionKey:"obBusinessSection", titleKey:"obBusinessTitle", descKey:"obBusinessDesc",
    onEnter:function(){ _obNav("businessbrain","page-business-brain"); } },
  { majorStep:7, selector:'#bizCanvas', sectionKey:"obBusinessSection", titleKey:"bizTabOverview", descKey:"obBizTabOverviewDesc",
    onEnter:function(){ _obBizNav("overview"); } },
  { majorStep:7, selector:'.bic-card-business', sectionKey:"obBusinessSection", titleKey:"bizTabBusiness", descKey:"obBizTabBusinessDesc",
    onEnter:function(){ _obBizNav("overview"); } },
  { majorStep:7, selector:'.bic-card-audience', sectionKey:"obBusinessSection", titleKey:"bizTabMarket", descKey:"obBizTabMarketDesc",
    onEnter:function(){ _obBizNav("overview"); } },
  { majorStep:7, selector:'.bic-card-brand', sectionKey:"obBusinessSection", titleKey:"bizTabBrand", descKey:"obBizTabBrandDesc",
    onEnter:function(){ _obBizNav("overview"); } },
  { majorStep:7, selector:'.bic-card-advertising', sectionKey:"obBusinessSection", titleKey:"bizTabConnections", descKey:"obBizTabConnectionsDesc",
    onEnter:function(){ _obBizNav("overview"); } },
  { majorStep:7, selector:'.bic-card-knowledge', sectionKey:"obBusinessSection", titleKey:"bizTabMemory", descKey:"obBizTabMemoryDesc",
    onEnter:function(){ _obBizNav("overview"); } },
  { majorStep:8, selector:'#orvNavSettingsBtn', sectionKey:"obSettingsSection", titleKey:"obSettingsTitle", descKey:"obSettingsDesc" },
  // Your Turn (majorStep 9) — the actual first-campaign creation step,
  // critical-fix: spotlightSelector points the ring/backdrop at the WHOLE
  // campaign builder card (#aicInputWrap, which contains the prompt
  // textarea, platform pills, attach buttons, goal grid and the Generate
  // button as one continuous block) instead of each frame's own tiny
  // `selector` target. Previously each of these 4 frames spotlighted only
  // its own small element (just the textarea, just the platform pills,
  // etc.) with 8px of padding -- everything else in the builder, including
  // parts the user still needed to see/use, sat outside the ring in the
  // box-shadow's dark 9999px spread, making the real product UI look
  // inactive/broken right when the user is told to use it. `selector`
  // itself is untouched and still drives the tooltip's own position/arrow
  // (so the card still points precisely at whichever control that frame
  // is describing) -- only which element sizes the spotlight changed.
  // Every other onboarding step (majorStep 1-8, and Publish below) has no
  // spotlightSelector and keeps its exact prior tight-ring behavior.
  { majorStep:9, selector:'#aicInput', spotlightSelector:'#aicInputWrap', sectionKey:"obYourTurnSection", titleKey:"obPromptTitle", descKey:"obPromptDesc",
    onEnter:function(){ _obNav("create","page-create"); }, sidebarUnlocked:true },
  { majorStep:9, selector:'.cr2-foot-group[aria-label="Platform"]', spotlightSelector:'#aicInputWrap', sectionKey:"obYourTurnSection", titleKey:"obPlatformTitle", descKey:"obPlatformDesc", sidebarUnlocked:true },
  { majorStep:9, selector:'#ov3RefImgBtn', spotlightSelector:'#aicInputWrap', sectionKey:"obYourTurnSection", titleKey:"obUploadTitle", descKey:"obUploadDesc", sidebarUnlocked:true },
  { majorStep:9, selector:'#aicGenBtn', spotlightSelector:'#aicInputWrap', sectionKey:"obYourTurnSection", titleKey:"obGenerateTitle", descKey:"obGenerateDesc",
    sidebarUnlocked:true, waiting:"generate", waitingKey:"obWaitingGenerate" },
  { majorStep:10, selector:'#cgrPublishBtns', sectionKey:"obYourTurnSection", titleKey:"obPublishTitle", descKey:"obPublishDesc",
    sidebarUnlocked:true, waiting:"publish", waitingKey:"obWaitingPublish" }
];
var _OB_MAJOR_TOTAL = 10;

function _obLockSidebar(locked){
  var sb = document.querySelector(".orv-sb");
  if(sb) sb.style.pointerEvents = locked ? "none" : "";
}

function showOnboarding(){
  _obStep = 1;
  window._obActive = true;
  _obLockSidebar(true);
  _obAttachInteractiveListeners();
  _obRender(1);
  console.log("[Onboarding] Spotlight tour started — " + _OB_FRAMES.length + " frames / " + _OB_MAJOR_TOTAL + " steps");
}

function hideOnboarding(instant){
  window._obActive = false;
  _obLockSidebar(false);

  var ms = instant ? 0 : 280;
  ["ob-ring","ob-backdrop","ob-tooltip"].forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    el.style.opacity = "0";
    if(instant){ el.style.display = "none"; el.style.opacity = ""; }
    else setTimeout(function(){ el.style.display = "none"; el.style.opacity = ""; }, ms);
  });
}

// One-shot listeners, attached once per tour session (not per-render) so
// Back/Forward through these frames never double-attaches a handler.
var _obListenersAttached = false;
function _obAttachInteractiveListeners(){
  if(_obListenersAttached) return;
  _obListenersAttached = true;

  var genBtn = document.getElementById("aicGenBtn");
  if(genBtn){
    genBtn.addEventListener("click", function(){
      if(!window._obActive) return;
      var cur = _OB_FRAMES[_obStep - 1];
      if(cur && cur.waiting === "generate") obGoTo(_obStep + 1);
    });
  }

  // Delegated — #cgrPublishBtns is repopulated by _buildPublishSection each
  // time a package renders, so a direct listener on the button wouldn't
  // survive; delegate from the stable parent instead.
  var pubWrap = document.getElementById("cgrPublishBtns");
  if(pubWrap){
    pubWrap.addEventListener("click", function(e){
      if(!window._obActive) return;
      var btn = e.target.closest(".cgr2-pub-btn, .cgr2-pub-connect");
      if(!btn) return;
      var cur = _OB_FRAMES[_obStep - 1];
      if(cur && cur.waiting === "publish"){
        markOnboardingComplete();
        try { localStorage.removeItem("oriven_needs_onboarding"); } catch(_){}
        hideOnboarding(true); // instant — a real modal (paywall or success) may open right behind this click
      }
    });
  }
}

// Step 10's target (#cgrPublishBtns) only gets real content once async
// generation finishes and _buildPublishSection runs inside the cgr IIFE.
// Poll briefly rather than requiring a dispatched event or an edit inside
// that IIFE — bounded, cheap, and self-contained to the tour.
function _obWaitForPublishTarget(cb){
  var el = document.getElementById("cgrPublishBtns");
  if(el && el.children.length) { if(window._obActive) cb(el); return; }
  var tries = 0;
  var iv = setInterval(function(){
    if(!window._obActive){ clearInterval(iv); return; } // tour torn down mid-poll — don't resurrect it
    tries++;
    var target = document.getElementById("cgrPublishBtns");
    if(target && target.children.length){
      clearInterval(iv);
      cb(target);
    } else if(tries > 100){ // ~20s safety timeout
      clearInterval(iv);
    }
  }, 200);
}

function _obRender(step){
  // obGoTo schedules this 180ms out; if hideOnboarding() runs in that window
  // (e.g. a 403-triggered paywall takeover) this stale call must no-op
  // instead of re-showing torn-down tour chrome.
  if(!window._obActive) return;
  var f = _OB_FRAMES[step - 1];
  if(!f) return;

  if(f.onEnter) f.onEnter();
  _obLockSidebar(!f.sidebarUnlocked);

  var ring  = document.getElementById("ob-ring");
  var bd    = document.getElementById("ob-backdrop");
  var tt    = document.getElementById("ob-tooltip");

  var renderAgainst = function(targetEl, spotlightEl){
    // spotlightEl (f.spotlightSelector, e.g. the whole campaign-builder
    // card during Your Turn) sizes the ring/backdrop; targetEl (f.selector,
    // unchanged) still positions the tooltip and its arrow. Defaults to
    // targetEl when a frame has no spotlightSelector, which is every step
    // except Your Turn -- byte-identical ring behavior there.
    spotlightEl = spotlightEl || targetEl;

    // â”€â”€ Spotlight ring (real element) vs full-screen backdrop (centered) â”€â”€
    // Decided off actual on-screen visibility, not a hardcoded viewport
    // width — the sidebar collapses to an icon rail on narrow screens but
    // stays on-screen, so a real ring works at every width.
    var r = spotlightEl ? spotlightEl.getBoundingClientRect() : null;
    var visible = r && r.width > 0 && r.height > 0;

    if(visible && !f.centered){
      if(bd){ bd.style.opacity = "0"; setTimeout(function(){ bd.style.display = "none"; }, 250); }
      if(ring){
        var pad = 8;
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
    _obPositionTooltip(tt, visible ? targetEl : null);
  };

  // â”€â”€ Tooltip text content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if(!tt) return;

  var secEl   = document.getElementById("ob-tt-section");
  var titEl   = document.getElementById("ob-tt-title");
  var descEl  = document.getElementById("ob-tt-desc");
  var dotsEl  = document.getElementById("ob-tt-dots");
  var stepEl  = document.getElementById("ob-tt-step");
  var backBtn = document.getElementById("ob-tt-back");
  var nextBtn = document.getElementById("ob-tt-next");
  var skipBtn = document.getElementById("ob-tt-skip");

  if(secEl)  secEl.textContent  = f.sectionKey ? _obT(f.sectionKey, "") : "";
  if(titEl)  titEl.innerHTML    = _obT(f.titleKey, "");
  if(descEl) descEl.textContent = _obT(f.descKey, "");
  if(stepEl){
    var lbl = _obT("obStepOfLabel", "Step {n} of {total}").replace("{n}", f.majorStep).replace("{total}", _OB_MAJOR_TOTAL);
    stepEl.textContent = lbl;
  }

  if(dotsEl){
    dotsEl.innerHTML = "";
    for(var i = 1; i <= _OB_MAJOR_TOTAL; i++){
      var d = document.createElement("span");
      d.className = "ob-tt-dot" + (i === f.majorStep ? " ob-tt-dot-active" : "");
      dotsEl.appendChild(d);
    }
  }

  if(backBtn){
    backBtn.style.visibility = step > 1 ? "visible" : "hidden";
    backBtn.textContent = _obT("obBackBtn", "← Back");
    backBtn.onclick = function(){ obGoTo(_obStep - 1); };
  }
  if(skipBtn){
    skipBtn.textContent = _obT("obSkipBtn", "Skip Tour");
    skipBtn.onclick = function(){ _obSkip(); };
  }
  if(nextBtn){
    if(f.waiting){
      nextBtn.textContent = _obT(f.waitingKey, "Waiting for youâ€¦");
      nextBtn.className   = "ob-tt-next ob-tt-waiting";
      nextBtn.onclick     = null;
      nextBtn.disabled    = true;
    } else {
      nextBtn.disabled    = false;
      nextBtn.textContent = _obT("obNextBtn", "Next ←’");
      nextBtn.className   = "ob-tt-next";
      nextBtn.onclick      = function(){ obGoTo(_obStep + 1); };
    }
  }

  tt.style.opacity = "0";
  tt.style.display = "block";

  if(f.centered){
    renderAgainst(null);
    return;
  }
  if(f.selector === '#cgrPublishBtns'){
    // Step 10's content only exists once generation finishes rendering it.
    _obWaitForPublishTarget(function(target){ renderAgainst(target); });
    return;
  }
  var spotlightTarget = f.spotlightSelector ? document.querySelector(f.spotlightSelector) : null;
  renderAgainst(document.querySelector(f.selector), spotlightTarget);
}

function _obPositionTooltip(tt, targetEl){
  if(!tt) return;
  var isMobile = window.innerWidth <= 768;

  requestAnimationFrame(function(){
    if(!targetEl){
      // â”€â”€ Centered (Welcome, or any target that genuinely isn't visible) â”€â”€
      tt.style.bottom    = "";
      tt.style.right     = "";
      tt.style.width     = "";
      tt.style.maxWidth  = "";
      tt.style.left      = "50%";
      tt.style.top       = "50%";
      tt.style.transform = "translate(-50%,-50%)";
      tt.classList.add("ob-tt-center");
      tt.classList.remove("ob-tt-arrow");
    } else if(isMobile){
      // â”€â”€ Mobile: bottom-sheet card above thumb zone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Confirmed by direct testing: for the interactive-wait frames
      // (Generate, Publish) the real target sits low enough on Launch's
      // page that the default bottom-anchored card fully covers it,
      // silently blocking the exact tap the user is told to make. Flip to
      // anchoring near the top instead whenever the card would overlap the
      // real target's own position.
      var tgtR      = targetEl.getBoundingClientRect();
      var approxTtH = tt.offsetHeight || 260;
      var wouldCover = tgtR.bottom > (window.innerHeight - 80 - approxTtH);
      if(wouldCover){
        tt.style.top = "12px";
        // styles.css has a !important safe-area rule pinning #ob-tooltip's
        // bottom (bottom:calc(env(safe-area-inset-bottom) + 80px)
        // !important) for the normal bottom-sheet case -- a plain inline
        // "auto" loses to that. setProperty(...,'important') is needed to
        // actually win here (confirmed necessary by direct testing: without
        // it the box stretched between top:12 and the still-pinned bottom).
        tt.style.setProperty("bottom", "auto", "important");
      } else {
        tt.style.top    = "auto";
        tt.style.bottom = "80px"; // baseline fallback; the !important safe-area rule (styles.css) supersedes this in browsers that support env()
      }
      tt.style.left      = "12px";
      tt.style.right     = "12px";
      tt.style.width     = "auto";
      tt.style.maxWidth  = "none";
      tt.style.transform = "none";
      tt.classList.remove("ob-tt-center");
      tt.classList.remove("ob-tt-arrow");
    } else {
      // â”€â”€ Desktop: spotlight tooltip beside the target â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      tt.style.bottom   = "";
      tt.style.right    = "";
      tt.style.width    = "";
      tt.style.maxWidth = "";

      var r      = targetEl.getBoundingClientRect();
      var margin = 24;
      var ttH    = tt.offsetHeight;
      var ttW    = tt.offsetWidth || 290;

      var top  = r.top;
      var left = r.right + 18;

      if(left + ttW + margin > window.innerWidth){
        left = Math.max(margin, r.left - ttW - 18);
      }

      var maxTop = window.innerHeight - ttH - margin;
      var minTop = margin;
      top = Math.min(maxTop, Math.max(minTop, top));

      var targetCenter = r.top + r.height / 2;
      var arrowTop = targetCenter - top - 8;
      arrowTop = Math.max(8, Math.min(arrowTop, ttH - 24));
      tt.style.setProperty("--ob-arrow-top", arrowTop + "px");

      tt.style.top       = top + "px";
      tt.style.left      = left + "px";
      tt.style.transform = "";
      tt.classList.add("ob-tt-arrow");
      tt.classList.remove("ob-tt-center");
    }
    requestAnimationFrame(function(){ tt.style.opacity = "1"; });
  });
}

function obGoTo(step){
  if(step < 1 || step > _OB_FRAMES.length) return;
  var tt   = document.getElementById("ob-tooltip");
  var ring = document.getElementById("ob-ring");
  if(tt)   tt.style.opacity   = "0";
  if(ring) ring.style.opacity = "0";
  _obStep = step;
  setTimeout(function(){ _obRender(step); }, 180);
  console.log("[Onboarding] Frame ←’", step, "of", _OB_FRAMES.length);
}

function _obSkip(){
  console.log("[Onboarding] Skipped — context:", _obContext);
  // Critical launch-blocker fix — "Close" after the free generation has
  // already run must hit the same paywall every other post-generation
  // escape route hits, not just quietly end the tour.
  if(_isFreeUser() && _freeCampaignUsed()){
    _orvEndOnboardingIntoPaywall();
    return;
  }
  markOnboardingComplete();
  try { localStorage.removeItem("oriven_needs_onboarding"); } catch(_){}
  _obContext = "tour";
  hideOnboarding();
}
window.restartOnboarding = async function(){
  var user = _currentUser;
  if(!user) return;
  try {
    await SB.from("profiles").update({ onboarding_completed: false }).eq("id", user.id);
  } catch(err){ console.error("[Onboarding] Restart error:", err.message); }
  if(typeof closeModal === "function") closeModal("modal-settings");
  setTimeout(function(){ if(typeof startOnboarding === "function") startOnboarding(_dbPrimaryGoal); }, 200);
};

// â”€â”€ Keyboard: onboarding navigation (Escape=skip, arrows/Enter=nav) +
// hard paywall Escape block â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener("keydown", function(e){
  if(e.key === "Escape"){
    if(_paywallHard){
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if(window._obActive){ e.preventDefault(); _obSkip(); return; }
  }
  if(window._obActive){
    var cur = _OB_FRAMES[_obStep - 1];
    var canAdvance = !(cur && cur.waiting);
    if(e.key === "ArrowRight" || e.key === "ArrowDown"){ if(canAdvance) obGoTo(_obStep + 1); }
    else if(e.key === "ArrowLeft" || e.key === "ArrowUp") obGoTo(_obStep - 1);
    else if(e.key === "Enter"){ if(canAdvance) obGoTo(_obStep + 1); }
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
  // Real bug fix (Settings audit pass) — this used to unconditionally
  // overwrite #sidebarUserName with the auth-derived first_name/email,
  // racing against settings.js's own _updateSidebarName(cfg.wsName) call
  // (whichever ran last silently won, since sign-in is async). Workspace
  // Name is the deliberate, user-saved identity for the sidebar once set
  // — only fall back to the auth-derived name when no real workspace
  // name has ever been saved (still the default), so the outcome is
  // deterministic regardless of call order.
  var savedWsName = (typeof loadSettings === "function") ? loadSettings().wsName : null;
  var hasRealWsName = savedWsName && savedWsName.trim() && savedWsName.trim() !== SETTINGS_DEFAULTS.wsName;
  var firstName = hasRealWsName ? savedWsName.trim() : (meta.first_name || user.email.split("@")[0]);
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

// â”€â”€ BrandCore: save to Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    toast("Brand Identity saved to cloud");
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
    // Final Create Fix pass -- Create's Creative Stage reads S.brandCore
    // (via the shared _cr2ResolveBrandIdentity resolver) but wasn't
    // previously re-rendered when this real fetch resolves, so if the
    // user was already on Create the Stage could sit on its honest
    // neutral state longer than necessary instead of picking up real
    // Brand Identity data as soon as it genuinely arrives.
    if(typeof _cr2RenderStage === "function") _cr2RenderStage();
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
    // Dev: use _dbSubscriptionStatus (set by _loadUserProfile from Supabase) — never hardcode.
    if(_dbSubscriptionStatus !== null){
      console.log("[PW-CHAIN] checkSubscriptionStatus (dev) | cached:", _dbSubscriptionStatus);
      return _dbSubscriptionStatus;
    }
    // Not yet loaded — fall back to "free", not "professional"
    console.log("[PW-CHAIN] checkSubscriptionStatus (dev) | _dbSubscriptionStatus null ←’ defaulting to free");
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
    console.log("[Paywall] subscription_status:", status, "←’", isPaid
      ? "âœ“ SUBSCRIBED — paywall will NOT show"
      : "âœ— FREE — paywall will show");
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

// Free-campaign conversion paywall — shown after first campaign is generated.
// Soft/dismissable: Free is now a real, persistent plan (10 credits/day,
// 1 Intelligence use/month, no Autopilot), so this is an informative "here
// are your options" moment, not a payment gate -- closing it is equivalent
// to implicitly continuing on Free, which is already the account's actual
// subscription_status by default.
function openFreePaywall(){
  console.log("[PW-CHAIN] openFreePaywall() called");
  var modal = document.getElementById("modal-paywall");
  console.log("[PW-CHAIN] modal-paywall element:", modal ? "FOUND" : "NOT FOUND IN DOM");

  var titleEl = document.querySelector("#modal-paywall .pw-title");
  var subEl   = document.querySelector("#modal-paywall .pw-sub");
  var eyeEl   = document.querySelector("#modal-paywall .pw-eyebrow span");
  console.log("[PW-CHAIN] Title element:", titleEl ? "found" : "NOT FOUND");
  console.log("[PW-CHAIN] Sub element:", subEl ? "found" : "NOT FOUND");
  if(titleEl)  titleEl.innerHTML = _obT("obPaywallTitle", "Start free. Upgrade when you need more.");
  if(subEl)    subEl.textContent = _obT("obPaywallSub", "You've built your first campaign with Oriven. Stay on the Free plan and come back daily, or upgrade now for more credits, Autopilot, and higher limits.");
  if(eyeEl)    eyeEl.textContent = _obT("obPaywallEyebrow", "Your First Campaign Is Ready");

  console.log("[PW-CHAIN] Calling openPaywall() | typeof openPaywall:", typeof openPaywall);
  if(typeof openPaywall === "function"){
    openPaywall();
  } else {
    console.error("[PW-CHAIN] openPaywall is NOT a function — paywall.js may not be loaded yet");
  }
  console.log("[PW-CHAIN] openFreePaywall() complete | modal classList:", modal ? modal.className : "N/A");
}
window.openFreePaywall = openFreePaywall;

// Critical launch-blocker fix — the single choke point every "this action
// must show the paywall, not silently succeed" call site funnels through.
// Opens the SAME paywall openFreePaywall() already shows (no new UI), and
// permanently ends onboarding so it can never be resumed afterward: once
// the paywall has appeared, the free generation is spent and there is
// nothing left for the tour to walk the user through.
function _orvEndOnboardingIntoPaywall(){
  if(window._obActive && typeof hideOnboarding === "function") hideOnboarding(true);
  window._obActive = false;
  if(typeof markOnboardingComplete === "function") markOnboardingComplete();
  try { localStorage.removeItem("oriven_needs_onboarding"); } catch(_){}
  openFreePaywall();
}
window._orvEndOnboardingIntoPaywall = _orvEndOnboardingIntoPaywall;

// Browser back/forward safety net -- _setAppRoute uses replaceState (no
// real in-app history entries get pushed), so this mainly guards against
// a user navigating back to a real prior URL in this tab; still, if it
// fires while the free generation is locked, show the paywall rather
// than letting the app end up in an unguarded state.
// Free is a real, persistent plan now, not a lifetime-once trial -- browser
// back/forward navigation is no longer blocked just because today's free
// generation has already been used (that's gated at the specific
// generation actions themselves, not general navigation). No listener
// needed here anymore.

function closePaywall(){
  console.log("[PW-CHAIN] closePaywall() called | _paywallHard:", _paywallHard);
  if(_paywallHard){
    console.log("[PW-CHAIN] closePaywall() BLOCKED — hard paywall active");
    return;
  }
  if(typeof closeModal === "function") closeModal("modal-paywall");
  console.log("[PW-CHAIN] closePaywall() completed — modal closed");
}

// After successful Stripe payment: navigate to the page the user came from
function _postPaymentNavigate(){
  // Onboarding's Plan step: _obContext (in-memory) does not survive the
  // real page navigation to/from Stripe -- selectPlan() persisted this
  // flag right before redirecting away specifically so this moment (a real,
  // confirmed paid plan just re-read from the DB, right below in the
  // caller) can be recognized as genuine onboarding completion.
  var wasOnboarding = false;
  try { wasOnboarding = localStorage.getItem("oriven_post_payment_onboarding") === "1"; } catch(_){}
  if(wasOnboarding){
    try { localStorage.removeItem("oriven_post_payment_onboarding"); } catch(_){}
    if(typeof _ob2Finish === "function"){ _ob2Finish(); return; }
  }
  var returnPage = null;
  try { returnPage = localStorage.getItem("oriven_post_payment_return"); } catch(_){}
  if(returnPage){
    try { localStorage.removeItem("oriven_post_payment_return"); } catch(_){}
    if(typeof navigate === "function") navigate(returnPage);
  }
  // else: no return page and not onboarding -- _loadUserProfile() already
  // navigated to "create" as part of the normal sign-in flow above; if
  // onboarding is genuinely still incomplete for this (already-paid)
  // account, that same _loadUserProfile() call already triggered
  // startOnboarding() itself, so there is nothing further to do here.
}

async function selectPlan(plan){
  console.log("[Paywall] Plan selected:", plan);

  // Free never goes through Stripe -- separate, non-payment path.
  if(plan === "free") return continueOnFreePlan();

  var btn = document.querySelector('[onclick="selectPlan(\'' + plan + '\')"]');
  if(btn){ btn.disabled = true; btn.textContent = "Redirectingâ€¦"; }

  // Save return destination — if free user is converting from campaign-workspace, send them back there
  try {
    var _cwrPg = document.getElementById("page-campaign-workspace");
    if(_cwrPg && _cwrPg.classList.contains("active")){
      localStorage.setItem("oriven_post_payment_return", "campaign-workspace");
    }
  } catch(_){}

  // Onboarding's Plan step redirects to Stripe (a real page navigation) —
  // in-memory _obContext does not survive that round trip, so persist the
  // "this checkout is part of onboarding" fact the same way
  // oriven_post_payment_return already persists the campaign-workspace
  // return destination. _postPaymentNavigate() reads this back on return.
  try {
    if(typeof _obContext !== "undefined" && _obContext === "onboarding") localStorage.setItem("oriven_post_payment_onboarding", "1");
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
    toast("Could not start checkout — please try again");
    if(btn){ btn.disabled = false; btn.textContent = btn.getAttribute("data-label") || "Get Started"; }
  }
}

// Free plan's equivalent of the Stripe-checkout branch above -- confirms
// (or sets) subscription_status:'free' server-side, ensures a fresh daily
// credit cycle, then just closes the paywall. No redirect, no payment
// details required.
async function continueOnFreePlan(){
  var btn = document.getElementById("paywall-btn-free");
  if(btn){ btn.disabled = true; btn.textContent = "Continuingâ€¦"; }
  try {
    var result = await apiFetch("/api/select-free-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if(!result.ok) throw new Error((result.data && result.data.error) || "Could not continue on the Free plan");

    _dbSubscriptionStatus = "free";
    if(typeof S !== "undefined" && S) S.currentPlan = "free";

    // Close regardless of any hard-paywall flag -- choosing Free is always
    // a legitimate way to leave the paywall, not something that should be
    // blocked by whatever triggered the modal in the first place.
    if(typeof closeModal === "function") closeModal("modal-paywall");
    if(typeof _refreshUsageUI === "function") _refreshUsageUI();

    // Onboarding's Plan step: a real, valid Free selection just persisted
    // server-side -- this IS the "valid onboarding path completed" moment
    // for the no-payment path, so finish onboarding and route to the
    // chosen goal instead of the generic toast + staying put.
    if(typeof _obContext !== "undefined" && _obContext === "onboarding" && typeof _ob2Finish === "function"){
      _ob2Finish();
      return;
    }
    toast("You're on the Free plan — 10 credits refresh every day.");
  } catch(err){
    console.error("[Paywall] continueOnFreePlan error:", err);
    var code = err && err.message;
    toast((code && code.indexOf("already have an active") !== -1) ? code : "Could not continue — please try again");
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = btn.getAttribute("data-label") || "Continue Free"; }
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

  // Reset the authoritative subscription state — only _loadUserProfile() may set it.
  // _dbSubscriptionStatus = null means "not yet loaded from Supabase".
  // Access gates check this variable; null ←’ don't block (waiting for DB).
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
    // A password-reset email link lands here (redirectTo points at /app) and
    // Supabase silently signs the user in via the one-time recovery token --
    // without this check they'd land straight in the dashboard with their
    // OLD password never actually changed. Block the normal sign-in flow
    // until they've actually set a new password.
    if(window._orvPasswordRecovery){
      console.log("[Auth] Password recovery link detected — showing set-new-password screen");
      _orvShowPasswordRecoveryScreen();
      return;
    }

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
          if(typeof window.notifAllowed !== "function" || window.notifAllowed("notifBilling")) toast("Your subscription is now active — welcome to ORIVEN!");
          setTimeout(_postPaymentNavigate, 600);
        } else {
          // Webhook may not have arrived yet — retry once after a short delay
          if(typeof window.notifAllowed !== "function" || window.notifAllowed("notifBilling")) toast("Payment received — activating your account...");
          setTimeout(async function(){
            status = await checkSubscriptionStatus();
            _dbSubscriptionStatus = status;
            if(status && status !== "free"){
              S.currentPlan = status;
              if(typeof _updateSidebarPlan === "function") _updateSidebarPlan(status);
              if(typeof invalidatePlanCache === "function") invalidatePlanCache();
              if(typeof renderPlanPanel === "function") renderPlanPanel();
              if(typeof window.notifAllowed !== "function" || window.notifAllowed("notifBilling")) toast("Your subscription is now active — welcome to ORIVEN!");
              setTimeout(_postPaymentNavigate, 400);
            } else {
              if(typeof window.notifAllowed !== "function" || window.notifAllowed("notifBilling")) toast("Subscription pending — please refresh in a moment.");
            }
          }, 3000);
        }
      }, 800);
    } else if(_tourParam){
      // Dev-only re-trigger of onboarding for an already-paid subscriber
      // (?tour=1) -- retired spotlight tour replaced with the real
      // onboarding flow; primary_goal (if any) is already loaded by
      // onUserSignedIn() -> _loadUserProfile() above.
      setTimeout(async function(){
        var status = await checkSubscriptionStatus();
        if(status && status !== "free" && typeof startOnboarding === "function") startOnboarding(_dbPrimaryGoal);
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
      if(typeof S !== "undefined" && S){ S.currentPlan = "free"; S.campaigns = []; S.assets = []; }
      if(typeof window._campaigns !== "undefined") window._campaigns = [];
      try { if(typeof saveSettings === "function") saveSettings({ currentPlan: "free" }); } catch(_){}
      S.brandCore = null;
      showGuestLanding();
    }
  });
});

// ── Password recovery (Forgot Password email link → /app) ─────────────
// Real Supabase Auth end to end: the email is sent via
// SB.auth.resetPasswordForEmail (index.html, auForgotPassword), and the
// new password is written via SB.auth.updateUser -- never a custom table,
// never logged, never written to localStorage/sessionStorage.

function _orvShowPasswordRecoveryScreen(){
  var app = document.querySelector(".app");
  if(app) app.style.display = "none";
  var overlay = document.getElementById("orvPwRecoveryOverlay");
  if(!overlay) return;
  overlay.style.display = "flex";
  var newInp = document.getElementById("orvPwRecNew");
  var confInp = document.getElementById("orvPwRecConfirm");
  var errEl = document.getElementById("orvPwRecErr");
  if(newInp) newInp.value = "";
  if(confInp) confInp.value = "";
  if(errEl) errEl.style.display = "none";
  if(newInp) newInp.focus();
}

async function _orvCompletePasswordRecovery(){
  var newInp  = document.getElementById("orvPwRecNew");
  var confInp = document.getElementById("orvPwRecConfirm");
  var errEl   = document.getElementById("orvPwRecErr");
  var btn     = document.getElementById("orvPwRecBtn");
  if(!newInp || !confInp) return;

  var showErr = function(msg){ if(errEl){ errEl.textContent = msg; errEl.style.display = ""; } };

  var next    = newInp.value || "";
  var confirm = confInp.value || "";
  if(!next || next.length < 8){ showErr("New password must be at least 8 characters."); return; }
  if(next !== confirm){ showErr("Passwords don't match."); return; }
  if(errEl) errEl.style.display = "none";

  if(btn){ btn.disabled = true; btn.textContent = "Updating…"; }
  try {
    var upd = await SB.auth.updateUser({ password: next });
    if(upd && upd.error){
      if(btn){ btn.disabled = false; btn.textContent = "Update Password"; }
      showErr(upd.error.message || "Could not update password. The reset link may have expired — request a new one.");
      return;
    }
    window._orvPasswordRecovery = false;
    if(btn){ btn.textContent = "Password updated ✓"; }
    // Full reload rather than resuming this init function in place: it
    // cleanly strips the recovery token from the URL and re-runs the normal
    // session-restore flow (getSession now finds a plain authenticated
    // session, no different from any other returning-user page load).
    setTimeout(function(){ window.location.href = "/app"; }, 900);
  } catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Update Password"; }
    showErr("Could not update password — please try again.");
  }
}
window._orvCompletePasswordRecovery = _orvCompletePasswordRecovery;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FREE TRIAL GUARD — gate export/download/copy for free users
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function _isFreeUser(){
  var sub = (typeof _dbSubscriptionStatus !== "undefined") ? _dbSubscriptionStatus : "UNDEFINED";
  var result = sub === "free";
  console.log("[PW-CHAIN] _isFreeUser() ←’", result, "| _dbSubscriptionStatus:", sub);
  return result;
}

// Rolling-24h check, mirroring requireSubOrOnboardingGen's server-side
// window exactly (server.js) -- Free is now a persistent plan with one
// free generation per day, not a lifetime-once trial, so "used" means
// "used within the last 24h", not "ever used". The server remains the
// real gate regardless (this only decides local UI state: whether the
// Start Generation button and sidebar nav show the paywall prompt) --
// even if this local copy is stale, a genuinely-eligible user who gets
// shown the prompt anyway can still reach generation via the paywall's
// "Continue Free" path, and a genuinely-ineligible user is still rejected
// server-side if this local check is ever wrong in the permissive
// direction.
function _freeCampaignUsed(){
  try {
    var _uid = (_currentUser && _currentUser.id) ? _currentUser.id : null;
    if(!_uid){
      console.log("[PW-CHAIN] _freeCampaignUsed() ←’ false (no uid, _currentUser:", _currentUser, ")");
      return false;
    }
    var tsKey = "oriven_fcused_at_" + _uid;
    var ts    = null;
    try { ts = localStorage.getItem(tsKey); } catch(_){}
    if(!ts){
      console.log("[PW-CHAIN] _freeCampaignUsed() ←’ false (no timestamp for uid:", _uid, ")");
      return false;
    }
    var elapsedMs = Date.now() - new Date(ts).getTime();
    var result = elapsedMs >= 0 && elapsedMs < (24 * 60 * 60 * 1000);
    console.log("[PW-CHAIN] _freeCampaignUsed() | uid:", _uid, "| last used:", ts, "| elapsed ms:", elapsedMs, "←’", result);
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
  // Bug fix: `used` was computed but never actually checked below, so this
  // blocked EVERY Free user on delete/save/download/copy/regenerate
  // regardless of whether they'd used today's free generation yet -- the
  // gate must only fire once today's generation is actually spent, same as
  // every other free-generation gate (startCampaignGeneration,
  // openNewCampaign).
  if(!free || !used) return true;
  openFreePaywall();
  return false;
};

window._getCurrentUser = function(){ return _currentUser; };

// â”€â”€ Paywall diagnostic helper — call window._paywallDiag() in browser console â”€â”€
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
