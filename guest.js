// ════════════════════════════════════════════════════════════
// GUEST FLOW — in-app try-before-signup experience
// Journey: App loads → 2-step onboarding → Create 1 image → Gate → Signup
// State:   localStorage "guestGenerationUsed" = "true"
// ════════════════════════════════════════════════════════════

var _isGuestMode       = false;
var _guestLastImageUrl = null;
var _guestGenerating   = false;
var _originalNavigate  = null;

// ── Entry point (called from auth.js DOMContentLoaded + signout) ──

function showGuestLanding(){
  _isGuestMode       = true;
  _guestGenerating   = false;
  _guestLastImageUrl = null;

  // Show the real app UI — guests land directly inside
  showApp();

  // Hook navigate() to intercept locked tabs
  if(typeof navigate === "function" && !_originalNavigate){
    _originalNavigate = navigate;
    navigate = function(page){
      var locked = ["studio","inspiration","settings","usage","team"];
      if(_isGuestMode && locked.indexOf(page) !== -1){
        _showGuestLockScreen(page);
        return;
      }
      _originalNavigate(page);
    };
  }

  // Add capture-phase click interceptor on locked sidebar items
  _guestInstallTabGuard();

  // Land on dashboard
  if(typeof _originalNavigate === "function") _originalNavigate("dashboard");

  // Already generated on a prior visit → go straight to gate
  if(localStorage.getItem("guestGenerationUsed") === "true"){
    setTimeout(function(){ _showGuestGate(); }, 400);
    return;
  }

  // Start 2-step onboarding
  setTimeout(function(){ _guestOnboard(1); }, 500);
}

// Kept for backwards-compat
function hideGuestLanding(){}

// ── Tab guard — intercept locked sidebar items ────────────────

function _guestInstallTabGuard(){
  var locked = ["studio","inspiration","settings","usage","team"];
  document.querySelectorAll(".ni[data-page]").forEach(function(ni){
    if(locked.indexOf(ni.dataset.page) !== -1){
      ni.addEventListener("click", _guestTabGuardHandler, true);
    }
  });
}

function _guestTabGuardHandler(e){
  if(!_isGuestMode) return;
  e.stopPropagation();
  e.preventDefault();
  _showGuestLockScreen(this.dataset.page);
}

function _guestRemoveTabGuard(){
  var locked = ["studio","inspiration","settings","usage","team"];
  document.querySelectorAll(".ni[data-page]").forEach(function(ni){
    if(locked.indexOf(ni.dataset.page) !== -1){
      ni.removeEventListener("click", _guestTabGuardHandler, true);
    }
  });
}

// ── Guest Onboarding (2 steps before first generation) ────────

function _guestOnboard(step){
  var overlay = document.getElementById("guestOnboard");
  if(!overlay) return;

  // Step 1: dim full screen; step 2: spotlight handles darkness
  if(step === 1) overlay.classList.add("gob-dim");
  else           overlay.classList.remove("gob-dim");

  overlay.style.display   = "block";
  overlay.style.opacity   = "0";
  overlay.style.transition = "";
  requestAnimationFrame(function(){
    overlay.style.transition = "opacity 0.3s ease";
    overlay.style.opacity    = "1";
  });

  var s1 = document.getElementById("gobStep1");
  var s2 = document.getElementById("gobStep2");
  if(s1) s1.style.display = step === 1 ? "" : "none";
  if(s2) s2.style.display = step === 2 ? "" : "none";

  if(step === 2){
    _guestSpotlightCreate();
  } else {
    var spotlight = document.getElementById("gobSpotlight");
    if(spotlight) spotlight.style.display = "none";
  }
}

function _guestSpotlightCreate(){
  var createNi  = document.querySelector(".ni[data-page='create']");
  var spotlight = document.getElementById("gobSpotlight");
  var card      = document.getElementById("gobStep2");
  if(!spotlight || !createNi) return;

  var r  = createNi.getBoundingClientRect();
  var vw = window.innerWidth;

  if(r.width > 0 && r.height > 0){
    spotlight.style.top    = (r.top    - 6)  + "px";
    spotlight.style.left   = (r.left   - 6)  + "px";
    spotlight.style.width  = (r.width  + 12) + "px";
    spotlight.style.height = (r.height + 12) + "px";
    spotlight.style.display = "block";

    // On desktop: float card to the right of the sidebar
    if(card && vw > 600){
      var cardLeft = Math.min(r.right + 20, vw - 360);
      var cardTop  = Math.max(r.top   - 20, 20);
      card.style.left      = cardLeft + "px";
      card.style.top       = cardTop  + "px";
      card.style.bottom    = "";
      card.style.transform = "";
    }
  }
}

function _guestOnboardNext(){
  _guestOnboard(2);
}

function _guestOnboardCreate(){
  var overlay = document.getElementById("guestOnboard");
  if(overlay){
    overlay.style.opacity = "0";
    setTimeout(function(){ overlay.style.display = "none"; }, 280);
  }
  if(typeof _originalNavigate === "function") _originalNavigate("create");
  setTimeout(function(){ _guestShowCreateModal(); }, 250);
}

// ── Guest Create Modal ────────────────────────────────────────

function _guestShowCreateModal(){
  var modal = document.getElementById("guestCreateModal");
  if(!modal) return;
  modal.style.display   = "flex";
  modal.style.opacity   = "0";
  modal.style.transition = "";
  requestAnimationFrame(function(){
    modal.style.transition = "opacity 0.3s ease";
    modal.style.opacity    = "1";
  });
  var inp = document.getElementById("gcInput");
  if(inp) setTimeout(function(){ inp.focus(); }, 350);
}

function _guestCreateBack(){
  var modal = document.getElementById("guestCreateModal");
  if(modal){
    modal.style.opacity = "0";
    setTimeout(function(){ modal.style.display = "none"; }, 280);
  }
  if(typeof _originalNavigate === "function") _originalNavigate("dashboard");
}

async function _guestGenerate(){
  if(_guestGenerating) return;

  var inputEl = document.getElementById("gcInput");
  var prompt  = inputEl ? inputEl.value.trim() : "";

  if(!prompt){
    if(inputEl){
      inputEl.style.transition  = "border-color 0.15s";
      inputEl.style.borderColor = "var(--gm)";
      setTimeout(function(){ inputEl.style.borderColor = ""; }, 1200);
    }
    return;
  }

  if(localStorage.getItem("guestGenerationUsed") === "true"){
    _showGuestGate(); return;
  }

  _guestGenerating = true;
  localStorage.setItem("guestGenerationUsed", "true");

  var btn        = document.getElementById("gcGenBtn");
  var labelEl    = document.getElementById("gcGenLabel");
  var resultArea = document.getElementById("gcResultArea");
  var resultImg  = document.getElementById("gcResultImg");

  if(btn)        btn.disabled        = true;
  if(labelEl)    labelEl.textContent = "Generating…";
  if(inputEl)    inputEl.disabled    = true;
  if(resultArea) resultArea.style.display = "";
  if(resultImg){
    resultImg.innerHTML =
      '<div class="gl-generating">'
      + '<div class="gl-gen-dots"><span></span><span></span><span></span></div>'
      + '<span>Creating your visual…</span>'
      + '</div>';
  }

  try {
    var res  = await fetch(API_BASE_URL + "/api/generate-image", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt:      prompt + ". Professional, high-quality, clean visual. No watermarks.",
        size:        "1024x1024",
        type:        "image",
        imageFormat: "1:1"
      })
    });
    var data = await res.json();

    if(data && data.imageUrl){
      _guestLastImageUrl = data.imageUrl;
      if(resultImg){
        resultImg.innerHTML =
          '<img src="' + data.imageUrl + '" alt="Your creation" style="width:100%;display:block;border-radius:12px">';
      }
      setTimeout(function(){ _showGuestGate(data.imageUrl); }, 900);
    } else {
      _guestResetAfterError();
    }
  } catch(err){
    console.error("[Guest] Generation error:", err);
    _guestResetAfterError();
  }
}

function _guestResetAfterError(){
  localStorage.removeItem("guestGenerationUsed");
  _guestGenerating = false;
  var btn        = document.getElementById("gcGenBtn");
  var labelEl    = document.getElementById("gcGenLabel");
  var inputEl    = document.getElementById("gcInput");
  var resultArea = document.getElementById("gcResultArea");
  if(btn)        btn.disabled        = false;
  if(labelEl)    labelEl.textContent = "Generate image";
  if(inputEl)    inputEl.disabled    = false;
  if(resultArea) resultArea.style.display = "none";
  if(typeof toast === "function") toast("Could not generate — please try again.");
}

// ── Locked Tab Screen ─────────────────────────────────────────

function _showGuestLockScreen(page){
  var titles = {
    studio:      "Brand Studio",
    inspiration: "Ideas",
    settings:    "Settings",
    usage:       "Usage",
    team:        "Team"
  };
  var descs = {
    studio:      "Save and manage everything you create. Your brand assets, campaigns, and creative history — all in one place.",
    inspiration: "Get ready-to-use concepts and creative ideas tailored to your brand style.",
    settings:    "Customize your brand identity, workspace, and preferences.",
    usage:       "Track your generation usage and plan limits.",
    team:        "Invite your team and collaborate on brand creation together."
  };

  var titleEl = document.getElementById("glsTitle");
  var descEl  = document.getElementById("glsDesc");
  if(titleEl) titleEl.textContent = titles[page] || page;
  if(descEl)  descEl.textContent  = descs[page]  || "";

  var screen = document.getElementById("guestLockScreen");
  if(!screen) return;
  screen.style.display   = "flex";
  screen.style.opacity   = "0";
  screen.style.transition = "";
  requestAnimationFrame(function(){
    screen.style.transition = "opacity 0.25s ease";
    screen.style.opacity    = "1";
  });
}

function _hideGuestLockScreen(){
  var screen = document.getElementById("guestLockScreen");
  if(!screen) return;
  screen.style.opacity = "0";
  setTimeout(function(){
    screen.style.display = "none";
    if(typeof _originalNavigate === "function") _originalNavigate("dashboard");
  }, 250);
}

// ── Gate Modal (post-generation, no dismiss) ───────────────────

function _showGuestGate(imageUrl){
  var gate = document.getElementById("guestGate");
  if(!gate) return;

  var url = imageUrl || _guestLastImageUrl;
  if(url){
    var preview    = document.getElementById("ggPreview");
    var previewImg = document.getElementById("ggPreviewImg");
    if(preview && previewImg){
      previewImg.src        = url;
      preview.style.display = "";
    }
  }

  _ggShow("main");
  gate.style.display   = "flex";
  gate.style.opacity   = "0";
  gate.style.transition = "";
  requestAnimationFrame(function(){
    gate.style.transition = "opacity 0.3s ease";
    gate.style.opacity    = "1";
  });
  console.log("[Guest] Gate shown");
}

function _ggShow(view){
  ["main","signup","login"].forEach(function(v){
    var el = document.getElementById("gg" + v.charAt(0).toUpperCase() + v.slice(1));
    if(el) el.style.display = v === view ? "" : "none";
  });
  ["ggErr","ggLoginErr"].forEach(function(id){
    var el = document.getElementById(id);
    if(el){ el.textContent = ""; el.style.display = "none"; }
  });
  // Clear all input error states on view switch
  _ggClearErr(["ggFirst","ggLast","ggEmail","ggPass","ggLoginEmail","ggLoginPass"]);
}

function _guestSignupClick(){ _ggShow("signup"); }
function _guestLoginClick(){  _ggShow("login");  }

// ── Auth error helpers ────────────────────────────────────────

function _ggMapError(err){
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
  if(/too many requests|rate.?limit/i.test(msg))
    return "Too many attempts — please wait a moment and try again.";
  if(/network|failed to fetch/i.test(msg))
    return "Connection error. Please check your internet and try again.";
  return msg || "Something went wrong. Please try again.";
}

function _ggMarkErr(ids){
  ids.forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.classList.add("gg-input-err");
  });
}

function _ggClearErr(ids){
  ids.forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.classList.remove("gg-input-err");
  });
}

// ── Signup ────────────────────────────────────────────────────

async function _ggDoSignup(){
  var first = (document.getElementById("ggFirst").value  || "").trim();
  var last  = (document.getElementById("ggLast").value   || "").trim();
  var email = (document.getElementById("ggEmail").value  || "").trim();
  var pass  =  document.getElementById("ggPass").value   || "";
  var errEl = document.getElementById("ggErr");

  function showErr(msg){ if(errEl){ errEl.textContent = msg; errEl.style.display = ""; } }
  _ggClearErr(["ggFirst","ggEmail","ggPass"]);

  if(!first || !email || !pass){
    showErr("First name, email and password are required.");
    _ggMarkErr([!first?"ggFirst":null, !email?"ggEmail":null, !pass?"ggPass":null].filter(Boolean));
    return;
  }
  if(pass.length < 6){
    showErr("Password must be at least 6 characters.");
    _ggMarkErr(["ggPass"]); return;
  }

  if(errEl) errEl.style.display = "none";
  var btn = document.getElementById("ggSignupBtn");
  if(btn){ btn.disabled = true; btn.textContent = "Creating account…"; }

  try {
    document.activeElement && document.activeElement.blur();
    var reg = await apiFetch("/api/signup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: first, lastName: last, email: email, password: pass })
    });
    if(!reg.ok) throw new Error(reg.data.error || "Signup failed");

    var result = await SB.auth.signInWithPassword({ email: email, password: pass });
    if(result.error) throw result.error;

    _ggClearErr(["ggFirst","ggEmail","ggPass"]);
    _guestOnSignedIn(result.data.user);
  } catch(err){
    showErr(_ggMapError(err));
    _ggMarkErr(["ggEmail","ggPass"]);
    if(btn){ btn.disabled = false; btn.textContent = "Create free account"; }
  }
}

// ── Login ─────────────────────────────────────────────────────

async function _ggDoLogin(){
  var email = (document.getElementById("ggLoginEmail").value || "").trim();
  var pass  =  document.getElementById("ggLoginPass").value  || "";
  var errEl = document.getElementById("ggLoginErr");

  function showErr(msg){ if(errEl){ errEl.textContent = msg; errEl.style.display = ""; } }
  _ggClearErr(["ggLoginEmail","ggLoginPass"]);

  if(!email || !pass){
    showErr("Enter your email and password.");
    _ggMarkErr([!email?"ggLoginEmail":null, !pass?"ggLoginPass":null].filter(Boolean));
    return;
  }

  if(errEl) errEl.style.display = "none";
  var btn = document.getElementById("ggLoginBtn");
  if(btn){ btn.disabled = true; btn.textContent = "Signing in…"; }

  try {
    document.activeElement && document.activeElement.blur();
    var result = await SB.auth.signInWithPassword({ email: email, password: pass });
    if(result.error) throw result.error;

    _ggClearErr(["ggLoginEmail","ggLoginPass"]);
    _guestOnSignedIn(result.data.user);
  } catch(err){
    showErr(_ggMapError(err));
    _ggMarkErr(["ggLoginEmail","ggLoginPass"]);
    if(btn){ btn.disabled = false; btn.textContent = "Sign in"; }
  }
}

// ── After guest signs in or signs up ─────────────────────────

function _guestOnSignedIn(user){
  _isGuestMode = false;

  // Restore original navigate
  if(_originalNavigate){
    navigate = _originalNavigate;
    _originalNavigate = null;
  }

  // Remove tab guards
  _guestRemoveTabGuard();

  // Close all guest overlays
  ["guestGate","guestCreateModal","guestOnboard","guestLockScreen"].forEach(function(id){
    var el = document.getElementById(id);
    if(el){
      el.style.opacity = "0";
      setTimeout(function(){ el.style.display = "none"; }, 300);
    }
  });

  // Hand off to normal auth flow — triggers onboarding check
  onUserSignedIn(user);
}
