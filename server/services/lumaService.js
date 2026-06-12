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

  // Luma docs are inconsistent — reference page shows /generations/video,
  // the guide and curl examples show /generations. Try /generations/video
  // first; if that returns 403 or 404, retry with /generations.
  const endpoints = [
    `${LUMA_BASE}/generations/video`,
    `${LUMA_BASE}/generations`,
  ];

  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${key}`,
    'Accept':        'application/json',
  };

  console.log('[Luma] → POST body:', JSON.stringify(body));
  console.log('[Luma] → Authorization: Bearer', key.slice(0, 12) + '...' + key.slice(-4));

  let response, endpoint;
  for (const ep of endpoints) {
    endpoint = ep;
    console.log('[Luma] → trying POST', endpoint);
    response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    console.log('[Luma] ← HTTP', response.status, 'from', endpoint);
    // Only retry on auth/not-found — any other status (200, 201, 4xx validation) stops here
    if (response.status !== 403 && response.status !== 404 && response.status !== 405) break;
    if (ep === endpoints[endpoints.length - 1]) break; // last endpoint, stop
    console.log('[Luma] → retrying with next endpoint…');
  }

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
