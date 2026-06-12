// ════════════════════════════════════════════════════════════════
// Video Ads — frontend overlay logic
// Integrates with POST /api/video-ads/generate (Luma AI)
// API key lives exclusively on the server — never exposed here.
// ════════════════════════════════════════════════════════════════

var _vaGenerationId = null;
var _vaPollTimer    = null;

function vaClose(){
  if(_vaPollTimer){ clearInterval(_vaPollTimer); _vaPollTimer = null; }
  var overlay = document.getElementById("vaOverlay");
  if(!overlay) return;
  overlay.style.transition = "opacity 0.25s ease";
  overlay.style.opacity    = "0";
  setTimeout(function(){ overlay.style.display = "none"; }, 260);
}

function vaStartOver(){
  vaClose();
  setTimeout(function(){ openAIFlow("videoads"); }, 300);
}

// Called by _cfDispatchVideoAds() in create-flow.js after the flow completes.
async function vaGenerateFromFlow(answers){
  _vaGenerationId = null;
  if(_vaPollTimer){ clearInterval(_vaPollTimer); _vaPollTimer = null; }

  _vaShowGenerating();

  var token = "";
  try {
    var s = await SB.auth.getSession();
    token = (s.data && s.data.session && s.data.session.access_token) || "";
  } catch(_){}

  if(!token){
    _vaShowError("Please sign in to generate video ads.");
    return;
  }

  var payload = {
    brand:    (answers.vaBrand    && answers.vaBrand.val)    || "",
    product:  (answers.vaProduct  && answers.vaProduct.val)  || "",
    concept:  (answers.vaConcept  && answers.vaConcept.val)  || "",
    audience: (answers.vaAudience && answers.vaAudience.val) || "",
    style:    (answers.vaStyle    && answers.vaStyle.val)    || "cinematic",
    length:   (answers.vaLength   && answers.vaLength.val)   || "5",
  };

  try {
    var result = await apiFetch("/api/video-ads/generate", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body:    JSON.stringify(payload),
    });

    if(!result.ok) throw new Error((result.data && result.data.error) || "Generation failed.");
    var data = result.data;

    if(data && data.generationId){
      _vaGenerationId = data.generationId;
      _vaPollStatus(token);
    } else {
      _vaShowError((data && data.error) || "Generation failed. Please try again.");
    }
  } catch(err){
    _vaShowError(err.message || "Generation failed. Please try again.");
  }
}

function _vaShowGenerating(){
  var wrap = document.getElementById("vaStatusWrap");
  if(!wrap) return;
  wrap.innerHTML =
    '<div class="va-spinner"><div class="spin"></div></div>'
    + '<div class="va-status-title">Generating your video ad…</div>'
    + '<div class="va-status-sub">Luma AI is rendering your brand video. This usually takes 1–3 minutes.</div>';
}

function _vaPollStatus(token){
  if(!_vaGenerationId) return;
  _vaPollTimer = setInterval(async function(){
    try {
      var result = await apiFetch(
        "/api/video-ads/status/" + encodeURIComponent(_vaGenerationId),
        { headers: { "Authorization": "Bearer " + token } }
      );
      if(!result.ok) return; // keep polling on transient error
      var d = result.data;
      if(d.status === "completed" && d.videoUrl){
        clearInterval(_vaPollTimer); _vaPollTimer = null;
        _vaShowVideo(d.videoUrl);
      } else if(d.status === "failed"){
        clearInterval(_vaPollTimer); _vaPollTimer = null;
        _vaShowError(d.failureReason || "Video generation failed.");
      }
      // queued / dreaming — keep polling
    } catch(_){ /* keep polling on transient error */ }
  }, 8000);
}

function _vaShowVideo(videoUrl){
  var statusWrap = document.getElementById("vaStatusWrap");
  var videoWrap  = document.getElementById("vaVideoWrap");
  var videoEl    = document.getElementById("vaVideoEl");
  var newRow     = document.getElementById("vaNewRow");

  if(statusWrap) statusWrap.innerHTML       = "";
  if(videoEl)    videoEl.src               = videoUrl;
  if(videoWrap)  videoWrap.style.display   = "";
  if(newRow)     newRow.style.display      = "";
}

function _vaShowError(msg){
  var wrap     = document.getElementById("vaStatusWrap");
  var retryRow = document.getElementById("vaRetryRow");
  var safe     = String(msg || "Something went wrong.").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if(wrap) wrap.innerHTML =
    '<div class="va-status-title va-status-error">Generation Failed</div>'
    + '<div class="va-status-sub">' + safe + '</div>';
  if(retryRow) retryRow.style.display = "";
}
