// ════════════════════════════════════════════════════════════════
// Luma AI — Agents API wrapper
//
// Confirmed working 2026-06-12 via diagnostic script.
// Base URL: https://agents.lumalabs.ai/v1  (NOT the legacy dream-machine URL)
// Create:   POST /v1/generations
// Poll:     GET  /v1/generations/{id}
// Auth:     Authorization: Bearer <LUMA_API_KEY>
//
// Response schema (confirmed live):
//   { id, type, state, model, created_at, output[], failure_reason, failure_code }
//   state values: "queued" | "dreaming" | "completed" | "failed"
//   output: array — when completed contains objects with a url field
//
// API key is ALWAYS read from process.env.LUMA_API_KEY — never hardcoded.
// ════════════════════════════════════════════════════════════════

const LUMA_BASE = 'https://agents.lumalabs.ai/v1';

// Luma Agents API accepts exactly two duration values: "5s" or "10s".
// Any other value causes a 422 validation error.
const VALID_DURATIONS = new Set(['5s', '10s']);

function _normaliseDuration(raw) {
  if (!raw) return '5s'; // safe default
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (digits === '5')  return '5s';
  if (digits === '10') return '10s';
  // Reject anything not in the approved set
  throw new Error(`Invalid duration "${raw}" — Luma only accepts 5s or 10s`);
}

// Validate the API key and trim any accidental whitespace.
function _sanitiseKey(apiKey) {
  if (!apiKey) throw new Error('LUMA_API_KEY is not set');
  const trimmed = String(apiKey).trim();
  if (!trimmed) throw new Error('LUMA_API_KEY is empty after trimming');
  if (trimmed !== apiKey) {
    console.warn('[Luma] ⚠️  LUMA_API_KEY had whitespace — trimmed before use');
  }
  console.log('[Luma] key prefix:', trimmed.slice(0, 15), '| length:', trimmed.length);
  return trimmed;
}

// Extract a usable video URL from the output array returned by the Agents API.
// Live schema: output is an array; each item may be { url } or a plain string.
function _extractVideoUrl(output) {
  if (!Array.isArray(output) || output.length === 0) return null;
  const first = output[0];
  if (typeof first === 'string') return first;
  if (first && first.url)       return first.url;
  return null;
}

// Parse a Luma error response body into a human-readable string.
// Luma 422 responses return detail as an array of validation objects:
//   [{ loc: [...], msg: "Input should be '5s' or '10s'", type: "..." }]
function _parseLumaError(data, httpStatus) {
  if (!data) return `Luma HTTP ${httpStatus}`;

  // 422 FastAPI validation errors — detail is an array of {loc, msg, type}
  if (Array.isArray(data.detail)) {
    const messages = data.detail.map(e => e.msg || JSON.stringify(e)).join('; ');
    return `Luma validation error (${httpStatus}): ${messages}`;
  }

  // Single string detail
  if (typeof data.detail === 'string') return `Luma ${httpStatus}: ${data.detail}`;

  // Other formats
  return `Luma ${httpStatus}: ${data.message || data.error || JSON.stringify(data)}`;
}

// ── generateVideo ─────────────────────────────────────────────
// Submit a video generation job. Returns the full generation object.
async function generateVideo(prompt, aspectRatio, apiKey, options) {
  const key = _sanitiseKey(apiKey);
  const { duration, model, keyframes } = options || {};

  const dur = _normaliseDuration(duration); // throws on invalid value

  // Agents API schema — confirmed working 2026-06-12
  // keyframes enables image-to-video: { frame0: { type: "image", url }, frame1: { ... } }
  const body = {
    model:        model || 'ray-3.2',
    type:         'video',
    prompt:       prompt || '',
    aspect_ratio: aspectRatio || '16:9',
    video: {
      resolution: '720p',
      ...(dur ? { duration: dur } : {}),
    },
    ...(keyframes ? { keyframes } : {}),
  };

  const endpoint = `${LUMA_BASE}/generations`;

  console.log(`[Luma] model=${body.model} duration=${dur} aspect=${body.aspect_ratio}`);
  console.log('[Luma] → POST', endpoint);
  console.log('[Luma] → body:', JSON.stringify(body));
  console.log('[Luma] → Authorization: Bearer', key.slice(0, 15) + '...');

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
    const text = await response.text().catch(() => '(empty)');
    throw new Error(`Luma non-JSON response (HTTP ${response.status}): ${text.slice(0, 400)}`);
  }

  console.log('[Luma] ← HTTP', response.status, JSON.stringify(data));

  if (!response.ok) {
    throw new Error(_parseLumaError(data, response.status));
  }

  return data; // { id, type, state, model, created_at, output[], failure_reason, failure_code }
}

// ── getVideoStatus ────────────────────────────────────────────
// Poll the status of an existing generation.
// Returns normalised: { status, videoUrl, thumbnailUrl, failureReason }
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
    const text = await response.text().catch(() => '(empty)');
    throw new Error(`Luma status non-JSON (HTTP ${response.status}): ${text.slice(0, 400)}`);
  }

  console.log('[Luma] ← HTTP', response.status, JSON.stringify(data));

  if (!response.ok) {
    throw new Error(_parseLumaError(data, response.status));
  }

  return data;
}

module.exports = { generateVideo, getVideoStatus, _extractVideoUrl };
