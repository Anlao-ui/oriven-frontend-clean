// ════════════════════════════════════════════════════════════════
// Luma AI Dream Machine service
//
// API key is ALWAYS read from process.env.LUMA_API_KEY — never
// hardcoded here. The calling route passes the key in so this
// module stays testable and key-free.
//
// Luma API docs: https://docs.lumalabs.ai/docs/video-generation
// Base:   https://api.lumalabs.ai/dream-machine/v1
// Create: POST /generations/video
// Poll:   GET  /generations/{id}
// Auth:   Authorization: Bearer <key>
// ════════════════════════════════════════════════════════════════

const LUMA_BASE = 'https://api.lumalabs.ai/dream-machine/v1';

// Map user-facing length values to Luma-supported duration strings.
// Luma only accepts "5s" and "9s" — anything else is omitted so
// Luma uses its default rather than returning a validation error.
function _normaliseDuration(raw) {
  if (!raw) return undefined;
  const s = String(raw).replace(/[^0-9]/g, '');
  if (s === '5') return '5s';
  if (s === '9') return '9s';
  return undefined;
}

// Validate and sanitise the API key.
// Returns the trimmed key, or throws with a clear message.
function _sanitiseKey(apiKey) {
  if (!apiKey) throw new Error('LUMA_API_KEY is not set');
  const trimmed = String(apiKey).trim();
  if (!trimmed) throw new Error('LUMA_API_KEY is empty after trimming whitespace');

  // Log key diagnostics without exposing the full value
  const prefix = trimmed.slice(0, 12);
  console.log('[Luma] Key diagnostics:',
    'prefix=' + prefix + '...',
    'length=' + trimmed.length,
    'starts-with-luma-api=' + trimmed.startsWith('luma-api-'),
    'has-whitespace=' + (apiKey !== trimmed)
  );

  return trimmed;
}

// Submit a video generation job to Luma AI.
// Returns the full generation object: { id, state, created_at, assets, failure_reason }
async function generateVideo(prompt, aspectRatio, apiKey, options) {
  const key = _sanitiseKey(apiKey);
  const { duration, model } = options || {};

  const body = {
    prompt:       prompt,
    model:        model || 'ray-2',
    aspect_ratio: aspectRatio || '16:9',
    loop:         false,
  };

  const dur = _normaliseDuration(duration);
  if (dur) body.duration = dur;

  const endpoint = `${LUMA_BASE}/generations/video`;

  // Log the full request for debugging (key is masked)
  console.log('[Luma] →', 'POST', endpoint);
  console.log('[Luma] → body:', JSON.stringify(body));
  console.log('[Luma] → Authorization: Bearer', key.slice(0, 12) + '...' + key.slice(-4));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
      'Accept':        'application/json',
    },
    body: JSON.stringify(body),
  });

  let data;
  try {
    data = await response.json();
  } catch (_) {
    const text = await response.text().catch(() => '(empty body)');
    const err  = `Luma returned non-JSON (HTTP ${response.status}): ${text.slice(0, 400)}`;
    console.error('[Luma] ←', err);
    throw new Error(err);
  }

  console.log('[Luma] ← HTTP', response.status, JSON.stringify(data));

  if (!response.ok) {
    const errMsg =
      (data && (data.detail || data.message || data.error)) ||
      JSON.stringify(data) ||
      `HTTP ${response.status}`;
    throw new Error(`Luma ${response.status}: ${errMsg}`);
  }

  return data;
}

// Poll the status of an existing generation.
// Returns: { id, state, assets: { video }, failure_reason }
async function getVideoStatus(generationId, apiKey) {
  const key      = _sanitiseKey(apiKey);
  const endpoint = `${LUMA_BASE}/generations/${encodeURIComponent(generationId)}`;

  console.log('[Luma] → GET', endpoint);

  const response = await fetch(endpoint, {
    headers: {
      'Authorization': `Bearer ${key}`,
      'Accept':        'application/json',
    },
  });

  let data;
  try {
    data = await response.json();
  } catch (_) {
    const text = await response.text().catch(() => '(empty body)');
    const err  = `Luma status returned non-JSON (HTTP ${response.status}): ${text.slice(0, 400)}`;
    console.error('[Luma] ←', err);
    throw new Error(err);
  }

  console.log('[Luma] ← HTTP', response.status, JSON.stringify(data));

  if (!response.ok) {
    const errMsg =
      (data && (data.detail || data.message || data.error)) ||
      JSON.stringify(data) ||
      `HTTP ${response.status}`;
    throw new Error(`Luma ${response.status}: ${errMsg}`);
  }

  return data;
}

module.exports = { generateVideo, getVideoStatus };
