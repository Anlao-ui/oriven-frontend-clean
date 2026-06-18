// ════════════════════════════════════════════════════════════════
// Product Shoots — AI product photography via gpt-image-1
// Uses the same AIML architecture as Visuals, Logos, and Campaign Images.
// API key and prompt engineering live exclusively on the server.
// ════════════════════════════════════════════════════════════════

// ── Overlay lifecycle ─────────────────────────────────────────────

function psClose() {
  var overlay = document.getElementById('psOverlay');
  if (!overlay) return;
  overlay.style.transition = 'opacity 0.25s ease';
  overlay.style.opacity    = '0';
  setTimeout(function() { overlay.style.display = 'none'; }, 260);
}

function psStartOver() {
  psClose();
  setTimeout(function() {
    if (typeof openAIFlow === 'function') openAIFlow('productshoots');
  }, 260);
}

// ── Called by _cfDispatchProductShoots() in create-flow.js ───────

async function psGenerateFromFlow(answers) {
  // Reset UI
  var statusWrap = document.getElementById('psStatusWrap');
  var resultWrap = document.getElementById('psResultWrap');
  var retryRow   = document.getElementById('psRetryRow');
  var newRow     = document.getElementById('psNewRow');
  if (statusWrap) statusWrap.innerHTML       = '';
  if (resultWrap) resultWrap.style.display   = 'none';
  if (retryRow)   retryRow.style.display     = 'none';
  if (newRow)     newRow.style.display       = 'none';

  // Extract answers from simplified 4-field flow
  var product      = _psVal(answers.psProduct);
  var style        = _psVal(answers.psStyle);
  var goal         = _psVal(answers.psGoal);
  var notes        = _psVal(answers._extraNotes);
  var customPrompt = (answers._aiPrompt && answers._aiPrompt.val) ? answers._aiPrompt.val : '';

  _psShowGenerating();

  var token = '';
  try {
    var s = await SB.auth.getSession();
    token = (s.data && s.data.session && s.data.session.access_token) || '';
  } catch(_){}

  if (!token) {
    _psShowError('Please sign in to generate product shots.');
    return;
  }

  var payload = {
    product,
    style,
    goal,
    notes:        notes        || undefined,
    customPrompt: customPrompt || undefined,
  };

  try {
    var result = await apiFetch('/api/product-shoots/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body:    JSON.stringify(payload),
    });

    if (!result.ok) {
      throw new Error((result.data && result.data.error) || 'Generation failed. Please try again.');
    }

    var data = result.data;
    if (!data || !data.images || !data.images.length) {
      throw new Error('No images returned. Please try again.');
    }

    _psShowResult(data.images, data.ratio || '1:1');

    // Deduct 2 credits per image
    var creditCost = data.images.length * 2;
    apiFetch('/api/increment-usage', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body:    JSON.stringify({ count: creditCost }),
    }).catch(function(){});

  } catch (err) {
    _psShowError(err.message || 'Generation failed. Please try again.');
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function _psVal(answer) {
  if (!answer) return '';
  if (typeof answer === 'string') return answer;
  return answer.val || answer.label || '';
}

function _psShowGenerating() {
  var wrap = document.getElementById('psStatusWrap');
  if (!wrap) return;
  wrap.innerHTML =
    '<div class="ps-spinner"><div class="spin"></div></div>'
    + '<div class="ps-status-title">Generating your product image…</div>'
    + '<div class="ps-status-sub">AI is crafting a professional photography prompt and rendering via gpt-image-1. This takes 15–45 seconds.</div>';
}

function _psShowResult(images, ratio) {
  var statusWrap = document.getElementById('psStatusWrap');
  var resultWrap = document.getElementById('psResultWrap');
  var grid       = document.getElementById('psImageGrid');
  var newRow     = document.getElementById('psNewRow');

  if (statusWrap) statusWrap.innerHTML = '';

  // Aspect ratio class for grid items
  var ratioClass = '';
  if (ratio === '16:9') ratioClass = 'ps-ratio-landscape';
  if (ratio === '4:5')  ratioClass = 'ps-ratio-portrait';

  if (grid) {
    grid.innerHTML = '';
    images.forEach(function(url, i) {
      var item = document.createElement('div');
      item.className = 'ps-image-item' + (ratioClass ? ' ' + ratioClass : '');

      var img = document.createElement('img');
      img.src    = url;
      img.alt    = 'Product shot ' + (i + 1);
      img.className = 'ps-image';
      img.loading   = 'lazy';

      var dlBtn = document.createElement('a');
      dlBtn.href     = url;
      dlBtn.download = 'product-shot-' + (i + 1) + '.png';
      dlBtn.target   = '_blank';
      dlBtn.rel      = 'noopener';
      dlBtn.className = 'ps-dl-btn';
      dlBtn.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M5 7l3 3 3-3"/><path d="M3 13h10"/></svg> Download';

      item.appendChild(img);
      item.appendChild(dlBtn);
      grid.appendChild(item);
    });
  }

  if (resultWrap) resultWrap.style.display = '';
  if (newRow)     newRow.style.display     = '';
}

function _psShowError(msg) {
  var statusWrap = document.getElementById('psStatusWrap');
  var retryRow   = document.getElementById('psRetryRow');
  var safe = String(msg || 'Something went wrong.').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (statusWrap) statusWrap.innerHTML =
    '<div class="ps-status-title ps-status-error">Generation Failed</div>'
    + '<div class="ps-status-sub">' + safe + '</div>';
  if (retryRow) retryRow.style.display = '';
}
