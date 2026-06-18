// ════════════════════════════════════════════════════════════════
// Motion Graphics — AI video generation via AIML API
// Opened by _cfDispatchMotionGraphics() after the CF_FLOW questions.
// Provider: kling-video/v1/standard/text-to-video via AIML API (server-side only).
// Flow: POST /generate → generationId → poll /status/:id → video URL
// ════════════════════════════════════════════════════════════════

var _mgGenerationId = null;
var _mgPollTimer    = null;

function mgClose() {
  if (_mgPollTimer) { clearInterval(_mgPollTimer); _mgPollTimer = null; }
  var overlay = document.getElementById('mgOverlay');
  if (!overlay) return;
  overlay.style.transition = 'opacity 0.25s ease';
  overlay.style.opacity    = '0';
  setTimeout(function() { overlay.style.display = 'none'; }, 260);
}

function mgStartOver() {
  mgClose();
  setTimeout(function() {
    if (typeof openAIFlow === 'function') openAIFlow('motiongraphics');
  }, 260);
}

// ── Called by _cfDispatchMotionGraphics() with the CF_FLOW answers ──
// opts: { logoUrl, customPrompt } from the prompt-preview step

async function mgGenerateFromFlow(answers, opts) {
  // Reset UI
  if (_mgPollTimer) { clearInterval(_mgPollTimer); _mgPollTimer = null; }
  _mgGenerationId = null;

  var statusWrap = document.getElementById('mgStatusWrap');
  var videoWrap  = document.getElementById('mgVideoWrap');
  var videoEl    = document.getElementById('mgVideoEl');
  var dlBtn      = document.getElementById('mgDlBtn');
  var retryRow   = document.getElementById('mgRetryRow');
  var newRow     = document.getElementById('mgNewRow');
  if (statusWrap) statusWrap.innerHTML      = '';
  if (videoWrap)  videoWrap.style.display   = 'none';
  if (videoEl)    videoEl.src               = '';
  if (dlBtn)      dlBtn.href                = '#';
  if (retryRow)   retryRow.style.display    = 'none';
  if (newRow)     newRow.style.display      = 'none';

  var style        = _mgVal(answers.mgStyle);
  var duration     = _mgVal(answers.mgDuration);
  var notes        = _mgVal(answers.mgNotes);
  var logoUrl      = (opts && opts.logoUrl)      || '';
  var customPrompt = (opts && opts.customPrompt) || '';

  _mgShowGenerating(style);

  var token = '';
  try {
    var s = await SB.auth.getSession();
    token = (s.data && s.data.session && s.data.session.access_token) || '';
  } catch(_){}

  if (!token) {
    _mgShowError('Please sign in to generate motion graphics.');
    return;
  }

  var bc = (typeof S !== 'undefined' && S) ? S.brandCore : null;

  try {
    var result = await apiFetch('/api/motion-graphics/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body:    JSON.stringify({
        style,
        duration,
        notes,
        logoUrl:      logoUrl      || undefined,
        customPrompt: customPrompt || undefined,
        brandCore: bc ? {
          name:        bc.name         || '',
          toneOfVoice: bc.toneOfVoice  || (Array.isArray(bc.tone) ? bc.tone[0] : '') || '',
          audience:    bc.audience     || bc.aud || '',
          colors:      bc.colors       || [],
          personality: bc.personality  || '',
        } : null,
      }),
    });

    if (!result.ok) {
      throw new Error((result.data && result.data.error) || 'Generation failed. Please try again.');
    }

    var data = result.data;
    if (!data || !data.generationId) {
      throw new Error((data && data.error) || 'No generation ID returned.');
    }

    _mgGenerationId = data.generationId;
    _mgPollStatus(token);

  } catch (err) {
    _mgShowError(err.message || 'Generation failed. Please try again.');
  }
}

// ── Polling ───────────────────────────────────────────────────────

function _mgPollStatus(token) {
  if (!_mgGenerationId) return;
  _mgPollTimer = setInterval(async function() {
    try {
      var result = await apiFetch(
        '/api/motion-graphics/status/' + encodeURIComponent(_mgGenerationId),
        { headers: { 'Authorization': 'Bearer ' + token } }
      );
      if (!result.ok) return; // transient error — keep polling

      var d = result.data;
      if (d.status === 'completed' && d.videoUrl) {
        clearInterval(_mgPollTimer); _mgPollTimer = null;
        _mgShowVideo(d.videoUrl);

        // Deduct 3 credits per generation
        apiFetch('/api/increment-usage', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body:    JSON.stringify({ count: 3 }),
        }).catch(function(){});
      } else if (d.status === 'failed') {
        clearInterval(_mgPollTimer); _mgPollTimer = null;
        _mgShowError(d.failureReason || 'Video generation failed. Please try again.');
      }
      // queued | processing → keep polling
    } catch(_) { /* keep polling on transient error */ }
  }, 8000);
}

// ── Helpers ───────────────────────────────────────────────────────

function _mgVal(answer) {
  if (!answer) return '';
  if (typeof answer === 'string') return answer;
  return answer.val || answer.label || '';
}

function _mgShowGenerating(styleVal) {
  var wrap = document.getElementById('mgStatusWrap');
  if (!wrap) return;
  var styleLabels = {
    logo:       'your logo reveal',
    kinetic:    'your kinetic typography video',
    social:     'your social motion video',
    intro:      'your brand intro sequence',
    transition: 'your transition video',
    custom:     'your motion graphic',
  };
  var noun = styleLabels[styleVal] || 'your motion graphic';
  wrap.innerHTML =
    '<div class="ps-spinner"><div class="spin"></div></div>'
    + '<div class="ps-status-title">Generating ' + noun + '…</div>'
    + '<div class="ps-status-sub">Oriven AI is writing a cinematic prompt and rendering your video. This usually takes 2–5 minutes.</div>';
}

function _mgShowVideo(videoUrl) {
  var statusWrap = document.getElementById('mgStatusWrap');
  var videoWrap  = document.getElementById('mgVideoWrap');
  var videoEl    = document.getElementById('mgVideoEl');
  var dlBtn      = document.getElementById('mgDlBtn');
  var newRow     = document.getElementById('mgNewRow');

  if (statusWrap) statusWrap.innerHTML    = '';
  if (videoEl)    videoEl.src             = videoUrl;
  if (dlBtn)      dlBtn.href              = videoUrl;
  if (videoWrap)  videoWrap.style.display = '';
  if (newRow)     newRow.style.display    = '';
}

function _mgShowError(msg) {
  var statusWrap = document.getElementById('mgStatusWrap');
  var retryRow   = document.getElementById('mgRetryRow');
  var safe = String(msg || 'Something went wrong.').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (statusWrap) statusWrap.innerHTML =
    '<div class="ps-status-title ps-status-error">Generation Failed</div>'
    + '<div class="ps-status-sub">' + safe + '</div>';
  if (retryRow) retryRow.style.display = '';
}
