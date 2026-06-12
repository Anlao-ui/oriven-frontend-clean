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
// ════════════════════════════════════════════════════════════════

const LUMA_BASE = 'https://api.lumalabs.ai/dream-machine/v1';

// Map user-facing length values to Luma-supported duration strings.
// Luma only accepts "5s" and "9s" — anything else is omitted so
// Luma uses its default rather than returning a validation error.
function _normaliseDuration(raw) {
  if (!raw) return undefined;
  const s = String(raw).replace(/[^0-9]/g, ''); // strip non-digits
  if (s === '5') return '5s';
  if (s === '9') return '9s';
  return undefined; // omit unknown values
}

// Submit a video generation job to Luma AI.
// Returns the full generation object: { id, state, created_at, assets, failure_reason }
async function generateVideo(prompt, aspectRatio, apiKey, options) {
  const { duration, model } = options || {};

  const body = {
    prompt:       prompt,
    model:        model || 'ray-2',          // required — default ray-2
    aspect_ratio: aspectRatio || '16:9',
    loop:         false,
  };

  const dur = _normaliseDuration(duration);
  if (dur) body.duration = dur;

  console.log('[Luma] POST /generations/video body:', JSON.stringify(body));

  const response = await fetch(`${LUMA_BASE}/generations/video`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept':        'application/json',
    },
    body: JSON.stringify(body),
  });

  let data;
  try {
    data = await response.json();
  } catch (_) {
    const text = await response.text().catch(() => '(empty)');
    throw new Error(`Luma returned non-JSON (HTTP ${response.status}): ${text.slice(0, 300)}`);
  }

  console.log('[Luma] POST /generations/video response HTTP', response.status, ':', JSON.stringify(data));

  if (!response.ok) {
    // Extract the most useful error message from Luma's response
    const errMsg =
      (data && (data.message || data.detail || data.error)) ||
      JSON.stringify(data) ||
      `HTTP ${response.status}`;
    throw new Error(errMsg);
  }

  return data;
}

// Poll the status of an existing generation.
// Returns: { id, state, assets: { video }, failure_reason }
async function getVideoStatus(generationId, apiKey) {
  const response = await fetch(
    `${LUMA_BASE}/generations/${encodeURIComponent(generationId)}`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept':        'application/json',
      },
    }
  );

  let data;
  try {
    data = await response.json();
  } catch (_) {
    const text = await response.text().catch(() => '(empty)');
    throw new Error(`Luma status returned non-JSON (HTTP ${response.status}): ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    const errMsg =
      (data && (data.message || data.detail || data.error)) ||
      JSON.stringify(data) ||
      `HTTP ${response.status}`;
    throw new Error(errMsg);
  }

  return data;
}

module.exports = { generateVideo, getVideoStatus };
