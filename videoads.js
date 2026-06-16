// ════════════════════════════════════════════════════════════════
// Video Ads — self-contained multi-phase creator
// Three modes: AI Script | Your Script | Image to Video
// API key never touches the frontend — all Luma calls go via server.
// ════════════════════════════════════════════════════════════════

var _vaGenerationId = null;
var _vaPollTimer    = null;
var _vaMode         = null;   // 'ai' | 'script' | 'image'
var _vaPhase        = 'mode'; // 'mode' | 'form' | 'result'

// ── Overlay lifecycle ─────────────────────────────────────────────

function vaOpen() {
  _vaReset();
  var overlay = document.getElementById('vaOverlay');
  if (!overlay) return;
  overlay.style.display  = 'flex';
  overlay.style.opacity  = '0';
  overlay.style.transition = 'opacity 0.22s ease';
  requestAnimationFrame(function() { overlay.style.opacity = '1'; });
}

function vaClose() {
  if (_vaPollTimer) { clearInterval(_vaPollTimer); _vaPollTimer = null; }
  var overlay = document.getElementById('vaOverlay');
  if (!overlay) return;
  overlay.style.transition = 'opacity 0.22s ease';
  overlay.style.opacity    = '0';
  setTimeout(function() { overlay.style.display = 'none'; }, 240);
}

function vaStartOver() {
  vaClose();
  setTimeout(vaOpen, 300);
}

// ── Phase navigation ──────────────────────────────────────────────

function _vaShowPhase(phase) {
  _vaPhase = phase;
  var phases = ['vaPhaseMode','vaPhaseAI','vaPhaseScript','vaPhaseImage','vaPhaseResult'];
  phases.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  var target = document.getElementById(phase);
  if (target) target.style.display = 'flex';

  // Show back button on form phases; hide on mode and result
  var backBtn = document.getElementById('vaBackBtn');
  if (backBtn) backBtn.style.display = (phase !== 'vaPhaseMode' && phase !== 'vaPhaseResult') ? 'flex' : 'none';
}

function vaBack() {
  if (_vaPhase === 'vaPhaseAI' || _vaPhase === 'vaPhaseScript' || _vaPhase === 'vaPhaseImage') {
    _vaShowPhase('vaPhaseMode');
    _vaMode = null;
  } else if (_vaPhase === 'vaPhaseResult') {
    // Go back to the form for this mode
    if (_vaMode === 'ai')     _vaShowPhase('vaPhaseAI');
    else if (_vaMode === 'script') _vaShowPhase('vaPhaseScript');
    else if (_vaMode === 'image')  _vaShowPhase('vaPhaseImage');
    else _vaShowPhase('vaPhaseMode');
  }
}

function vaSelectMode(mode) {
  _vaMode = mode;
  if (mode === 'ai')     _vaShowPhase('vaPhaseAI');
  else if (mode === 'script') _vaShowPhase('vaPhaseScript');
  else if (mode === 'image')  _vaShowPhase('vaPhaseImage');
}

function _vaReset() {
  if (_vaPollTimer) { clearInterval(_vaPollTimer); _vaPollTimer = null; }
  _vaGenerationId = null;
  _vaMode         = null;
  _vaPhase        = 'mode';

  // Reset result phase
  var statusWrap = document.getElementById('vaStatusWrap');
  var videoWrap  = document.getElementById('vaVideoWrap');
  var retryRow   = document.getElementById('vaRetryRow');
  var newRow     = document.getElementById('vaNewRow');
  var videoEl    = document.getElementById('vaVideoEl');
  if (statusWrap) statusWrap.innerHTML = '';
  if (videoWrap)  videoWrap.style.display  = 'none';
  if (retryRow)   retryRow.style.display   = 'none';
  if (newRow)     newRow.style.display     = 'none';
  if (videoEl)    videoEl.src             = '';

  // Show mode selection phase
  _vaShowPhase('vaPhaseMode');
}

// ── Pill selector helpers ─────────────────────────────────────────

function _vaPillVal(groupId) {
  var group = document.getElementById(groupId);
  if (!group) return '';
  var active = group.querySelector('.va-pill-opt.active');
  return active ? (active.getAttribute('data-val') || '') : '';
}

function _vaPillActivate(groupId, val) {
  var group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.va-pill-opt').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-val') === val);
  });
}

// Wire pill-select click handlers once DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.va-pill-select').forEach(function(group) {
    group.addEventListener('click', function(e) {
      var btn = e.target.closest('.va-pill-opt');
      if (!btn) return;
      group.querySelectorAll('.va-pill-opt').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // Preset buttons — apply style + goal pills, highlight pressed preset
  var presetsRow = document.getElementById('vaAiPresets');
  if (presetsRow) {
    presetsRow.addEventListener('click', function(e) {
      var btn = e.target.closest('.va-preset-btn');
      if (!btn) return;
      presetsRow.querySelectorAll('.va-preset-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var style = btn.getAttribute('data-style');
      var goal  = btn.getAttribute('data-goal');
      if (style) _vaPillActivate('vaAiStylePills', style);
      if (goal)  _vaPillActivate('vaAiGoalPills',  goal);
    });
  }
});

// ── Mode: AI Creates Everything ───────────────────────────────────

async function vaGenerateAI() {
  var product  = (document.getElementById('vaAiProduct')  || {}).value || '';
  var brand    = (document.getElementById('vaAiBrand')    || {}).value || '';
  var audience = (document.getElementById('vaAiAudience') || {}).value || '';
  var goal     = _vaPillVal('vaAiGoalPills');
  var style    = _vaPillVal('vaAiStylePills');
  var duration = _vaPillVal('vaAiDurPills') || '5';

  if (!product.trim()) {
    _vaInputError('vaAiProduct', 'Please describe what you\'re promoting.');
    return;
  }

  await _vaSubmit({
    mode:     'ai',
    brand:    brand.trim(),
    product:  product.trim(),
    audience: audience.trim(),
    goal:     goal,
    style:    style,
    length:   duration,
  });
}

// ── Mode: Create From Script ──────────────────────────────────────

async function vaGenerateScript() {
  var script   = (document.getElementById('vaScriptText') || {}).value || '';
  var style    = _vaPillVal('vaScriptStylePills');
  var duration = _vaPillVal('vaScriptDurPills') || '5';

  if (!script.trim() || script.trim().length < 20) {
    _vaInputError('vaScriptText', 'Please write at least a brief description of your video.');
    return;
  }

  await _vaSubmit({
    mode:   'script',
    script: script.trim(),
    style:  style,
    length: duration,
  });
}

// ── Mode: Image to Video ──────────────────────────────────────────

async function vaGenerateImage() {
  var imgUrl1  = (document.getElementById('vaImgUrl1')   || {}).value || '';
  var imgUrl2  = (document.getElementById('vaImgUrl2')   || {}).value || '';
  var prompt   = (document.getElementById('vaImgPrompt') || {}).value || '';
  var duration = _vaPillVal('vaImgDurPills') || '5';

  if (!imgUrl1.trim()) {
    _vaInputError('vaImgUrl1', 'Please provide an image URL to animate.');
    return;
  }
  if (!imgUrl1.trim().startsWith('http')) {
    _vaInputError('vaImgUrl1', 'Please enter a valid https:// image URL.');
    return;
  }

  await _vaSubmit({
    mode:      'image',
    imageUrl:  imgUrl1.trim(),
    imageUrl2: imgUrl2.trim() || undefined,
    prompt:    prompt.trim()  || undefined,
    length:    duration,
  });
}

// ── Shared submission ─────────────────────────────────────────────

async function _vaSubmit(payload) {
  // Transition to result phase
  _vaShowPhase('vaPhaseResult');
  var backBtn = document.getElementById('vaBackBtn');
  if (backBtn) backBtn.style.display = 'none'; // hide during generation

  _vaShowGenerating(payload.mode);

  var token = '';
  try {
    var s = await SB.auth.getSession();
    token = (s.data && s.data.session && s.data.session.access_token) || '';
  } catch(_){}

  if (!token) {
    _vaShowError('Please sign in to generate video ads.');
    return;
  }

  try {
    var result = await apiFetch('/api/video-ads/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body:    JSON.stringify(payload),
    });

    if (!result.ok) {
      throw new Error((result.data && result.data.error) || 'Generation failed. Please try again.');
    }

    var data = result.data;
    if (!data || !data.generationId) {
      throw new Error((data && data.error) || 'No generation ID returned.');
    }

    _vaGenerationId = data.generationId;
    _vaPollStatus(token);

  } catch (err) {
    _vaShowError(err.message || 'Generation failed. Please try again.');
  }
}

// ── Polling ───────────────────────────────────────────────────────

function _vaPollStatus(token) {
  if (!_vaGenerationId) return;
  _vaPollTimer = setInterval(async function() {
    try {
      var result = await apiFetch(
        '/api/video-ads/status/' + encodeURIComponent(_vaGenerationId),
        { headers: { 'Authorization': 'Bearer ' + token } }
      );
      if (!result.ok) return; // keep polling on transient error

      var d = result.data;
      if (d.status === 'completed' && d.videoUrl) {
        clearInterval(_vaPollTimer); _vaPollTimer = null;
        _vaShowVideo(d.videoUrl);
      } else if (d.status === 'failed') {
        clearInterval(_vaPollTimer); _vaPollTimer = null;
        _vaShowError(d.failureReason || 'Video generation failed. Please try again.');
      }
      // queued | dreaming → keep polling
    } catch(_) { /* keep polling on transient error */ }
  }, 8000);
}

// ── UI state helpers ──────────────────────────────────────────────

function _vaShowGenerating(mode) {
  var statusWrap = document.getElementById('vaStatusWrap');
  if (!statusWrap) return;

  var msgs = {
    ai:     ['Generating your video ad…', 'Oriven AI is writing your script, then Luma is rendering your video. This usually takes 1–3 minutes.'],
    script: ['Rendering your video…',     'Luma AI is generating from your script. This usually takes 1–3 minutes.'],
    image:  ['Animating your image…',     'Luma AI is bringing your image to life. This usually takes 1–3 minutes.'],
  };
  var m = msgs[mode] || msgs.ai;

  statusWrap.innerHTML =
    '<div class="va-spinner"><div class="spin"></div></div>'
    + '<div class="va-status-title">' + m[0] + '</div>'
    + '<div class="va-status-sub">' + m[1] + '</div>'
    + '<div class="va-audio-note">Generated videos do not include audio — this is a current Luma API limitation.</div>';
}

function _vaShowVideo(videoUrl) {
  var statusWrap = document.getElementById('vaStatusWrap');
  var videoWrap  = document.getElementById('vaVideoWrap');
  var videoEl    = document.getElementById('vaVideoEl');
  var newRow     = document.getElementById('vaNewRow');
  var backBtn    = document.getElementById('vaBackBtn');

  if (statusWrap) statusWrap.innerHTML = '';
  if (videoEl)    videoEl.src              = videoUrl;
  if (videoWrap)  videoWrap.style.display  = '';
  if (newRow)     newRow.style.display     = '';
  if (backBtn)    backBtn.style.display    = 'none';
}

function _vaShowError(msg) {
  var statusWrap = document.getElementById('vaStatusWrap');
  var retryRow   = document.getElementById('vaRetryRow');
  var backBtn    = document.getElementById('vaBackBtn');
  var safe = String(msg || 'Something went wrong.').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  if (statusWrap) statusWrap.innerHTML =
    '<div class="va-status-title va-status-error">Generation Failed</div>'
    + '<div class="va-status-sub">' + safe + '</div>';

  if (retryRow) retryRow.style.display = '';
  if (backBtn)  backBtn.style.display  = 'flex';
}

function _vaInputError(fieldId, msg) {
  var field = document.getElementById(fieldId);
  if (field) {
    field.style.borderColor = '#f87171';
    field.focus();
    field.addEventListener('input', function fix() {
      field.style.borderColor = '';
      field.removeEventListener('input', fix);
    });
  }
  // Show a brief inline message
  var existing = document.getElementById('vaInlineErr');
  if (existing) existing.remove();
  if (field) {
    var err = document.createElement('p');
    err.id = 'vaInlineErr';
    err.style.cssText = 'font-size:12px;color:#f87171;margin:4px 0 0;';
    err.textContent = msg;
    field.parentNode.insertBefore(err, field.nextSibling);
    setTimeout(function() { if (err.parentNode) err.remove(); }, 4000);
  }
}
