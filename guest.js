// ════════════════════════════════════════════════════════════
// GUEST FLOW — one-shot try-before-signup
// Journey: Land → single generation → gate modal → signup/login
// State: localStorage "guestGenerationUsed" = "true"
// ════════════════════════════════════════════════════════════

var _guestLastImageUrl = null;
var _guestGenerating   = false;

// ── Show landing (called by auth.js instead of showAuthPage) ──

function showGuestLanding(){
  var landing = document.getElementById("guestLanding");
  var app     = document.querySelector(".app");
  var authOvr = document.getElementById("authOverlay");
  if(landing) landing.style.display = "flex";
  if(app)     app.style.display     = "none";
  if(authOvr) authOvr.style.display = "none";

  if(localStorage.getItem("guestGenerationUsed") === "true"){
    _showGuestGate();
  }
}

function hideGuestLanding(){
  var el = document.getElementById("guestLanding");
  if(el) el.style.display = "none";
}

// ── "Try it now" ──────────────────────────────────────────────

async function _guestTry(){
  if(_guestGenerating) return;

  var inputEl = document.getElementById("guestPromptInput");
  var prompt  = inputEl ? inputEl.value.trim() : "";

  if(!prompt){
    if(inputEl){
      inputEl.focus();
      inputEl.style.transition = "border-color 0.15s";
      inputEl.style.borderColor = "var(--gm)";
    }
    return;
  }

  // Already used — go straight to gate
  if(localStorage.getItem("guestGenerationUsed") === "true"){
    _showGuestGate();
    return;
  }

  _guestGenerating = true;
  localStorage.setItem("guestGenerationUsed", "true");

  var labelEl = document.getElementById("guestTryLabel");
  var btn     = document.getElementById("guestTryBtn");
  if(btn)     btn.disabled    = true;
  if(labelEl) labelEl.textContent = "Generating…";
  if(inputEl) inputEl.disabled = true;

  // Show loading
  var resultArea = document.getElementById("guestResultArea");
  var resultImg  = document.getElementById("guestResultImg");
  if(resultArea) resultArea.style.display = "";
  if(resultImg){
    resultImg.innerHTML =
      '<div class="gl-generating">'
    + '<div class="gl-gen-dots"><span></span><span></span><span></span></div>'
    + '<span>Creating your visual…</span>'
    + '</div>';
  }
  setTimeout(function(){
    if(resultArea) resultArea.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 200);

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
          '<img src="' + data.imageUrl + '" alt="Your creation" style="width:100%;display:block">';
      }
      // Let user see the result for ~900ms, then show gate
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
  var labelEl    = document.getElementById("guestTryLabel");
  var btn        = document.getElementById("guestTryBtn");
  var inputEl    = document.getElementById("guestPromptInput");
  var resultArea = document.getElementById("guestResultArea");
  if(btn)        btn.disabled         = false;
  if(labelEl)    labelEl.textContent  = "Try it now";
  if(inputEl)    inputEl.disabled     = false;
  if(resultArea) resultArea.style.display = "none";
  if(typeof toast === "function") toast("Could not generate — please try again.");
}

// ── Gate modal ────────────────────────────────────────────────

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

  gate.style.display = "flex";
  gate.style.opacity = "0";
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
  // Clear errors on every view switch
  ["ggErr","ggLoginErr"].forEach(function(id){
    var el = document.getElementById(id);
    if(el){ el.textContent = ""; el.style.display = "none"; }
  });
}

function _guestSignupClick(){ _ggShow("signup"); }
function _guestLoginClick(){  _ggShow("login");  }

// ── Signup ────────────────────────────────────────────────────

async function _ggDoSignup(){
  var first = (document.getElementById("ggFirst").value  || "").trim();
  var last  = (document.getElementById("ggLast").value   || "").trim();
  var email = (document.getElementById("ggEmail").value  || "").trim();
  var pass  =  document.getElementById("ggPass").value   || "";
  var errEl = document.getElementById("ggErr");

  function showErr(msg){ if(errEl){ errEl.textContent = msg; errEl.style.display = ""; } }

  if(!first || !email || !pass){ showErr("First name, email and password are required."); return; }
  if(pass.length < 6)          { showErr("Password must be at least 6 characters."); return; }

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

    _guestOnSignedIn(result.data.user);
  } catch(err){
    showErr(err.message || "Something went wrong.");
    if(btn){ btn.disabled = false; btn.textContent = "Create free account"; }
  }
}

// ── Login ─────────────────────────────────────────────────────

async function _ggDoLogin(){
  var email = (document.getElementById("ggLoginEmail").value || "").trim();
  var pass  =  document.getElementById("ggLoginPass").value  || "";
  var errEl = document.getElementById("ggLoginErr");

  function showErr(msg){ if(errEl){ errEl.textContent = msg; errEl.style.display = ""; } }

  if(!email || !pass){ showErr("Enter your email and password."); return; }

  if(errEl) errEl.style.display = "none";
  var btn = document.getElementById("ggLoginBtn");
  if(btn){ btn.disabled = true; btn.textContent = "Signing in…"; }

  try {
    document.activeElement && document.activeElement.blur();
    var result = await SB.auth.signInWithPassword({ email: email, password: pass });
    if(result.error) throw result.error;

    _guestOnSignedIn(result.data.user);
  } catch(err){
    showErr(err.message || "Something went wrong.");
    if(btn){ btn.disabled = false; btn.textContent = "Sign in"; }
  }
}

// ── After guest signs in or signs up ─────────────────────────

function _guestOnSignedIn(user){
  hideGuestLanding();
  var gate = document.getElementById("guestGate");
  if(gate){ gate.style.opacity = "0"; setTimeout(function(){ gate.style.display = "none"; }, 300); }
  onUserSignedIn(user);
}
