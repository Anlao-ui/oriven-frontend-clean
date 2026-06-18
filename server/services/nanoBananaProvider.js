// ════════════════════════════════════════════════════════════════
// Nano Banana Pro — Direct API Provider
//
// Provider: nanobanana.aikit.club  (OpenAI-compatible API)
// NOT a third-party aggregator — this is the direct Nano Banana endpoint.
//
// Image generation (Motion Graphics):
//   POST https://nanobanana.aikit.club/v1/images/generations
//   Model: nano-banana
//   Auth:  Authorization: Bearer <NANO_BANANA_API_KEY>
//   Response: { data: [{ url, revised_prompt }] }
//
// Video generation:
//   Not supported by nanobanana.aikit.club (image-only).
//   Video Ads use Nano Banana Video (nanobananavideo.com) — see nanoBananaVideoProvider.js.
//
// Key is ALWAYS read from process.env — never hardcoded or sent to frontend.
// ════════════════════════════════════════════════════════════════

const NB_BASE = 'https://nanobanana.aikit.club';

function isConfigured() {
  const key = _readRaw();
  return !!(key && key !== 'your_api_key_here');
}

// Read the raw env value and strip surrounding whitespace including CR (Windows CRLF) and BOM.
function _readRaw() {
  const raw = process.env.NANO_BANANA_API_KEY || '';
  // Strip UTF-8 BOM, then trim all leading/trailing whitespace including \r\n
  return raw.replace(/^﻿/, '').replace(/^[\s\r\n]+|[\s\r\n]+$/g, '');
}

function _key() {
  const key = _readRaw();
  if (!key || key === 'your_api_key_here') throw new Error('NANO_BANANA_API_KEY is not configured');
  return key;
}

// Startup diagnostic — logs key presence and shape WITHOUT exposing the full value.
// Called once from server.js app.listen() callback.
function diagnose() {
  const envName = 'NANO_BANANA_API_KEY';
  const raw     = process.env[envName];          // read before any trimming
  const trimmed = _readRaw();

  console.log('');
  console.log('── NanoBanana Provider Diagnostics ──────────────────');
  console.log('[NanaBanana] env var name       :', envName);
  console.log('[NanaBanana] env var exists     :', raw !== undefined);
  console.log('[NanaBanana] raw length         :', raw ? raw.length : 0);
  console.log('[NanaBanana] trimmed length     :', trimmed.length);

  if (raw && raw.length !== trimmed.length) {
    console.warn('[NanaBanana] ⚠️  whitespace detected — raw vs trimmed lengths differ (' + raw.length + ' vs ' + trimmed.length + ')');
  }

  if (trimmed) {
    // Show first 5 chars and last 4 chars — enough to identify the key without exposing it
    const masked = trimmed.slice(0, 5) + '[...' + trimmed.slice(-4) + ']';
    console.log('[NanaBanana] key (masked)       :', masked);
    console.log('[NanaBanana] starts with "sk-"  :', trimmed.startsWith('sk-'));
    console.log('[NanaBanana] is placeholder     :', trimmed === 'your_api_key_here');
    console.log('[NanaBanana] auth header format : Authorization: Bearer ' + masked);
    console.log('[NanaBanana] configured         : true ✅');
  } else {
    console.error('[NanaBanana] ❌ key is empty — Motion Graphics will return 503');
    console.error('[NanaBanana]    Set NANO_BANANA_API_KEY=sk-... in .env.local (local) or Render dashboard (prod)');
  }
  console.log('─────────────────────────────────────────────────────');
  console.log('');
}

function _parseError(data, httpStatus) {
  if (!data) return `Nano Banana HTTP ${httpStatus}`;
  const msg = data?.error?.message || data?.message || data?.error || JSON.stringify(data);
  return `Nano Banana ${httpStatus}: ${msg}`;
}

// ── Image generation (Motion Graphics) ───────────────────────
// Generates branded still images via google/nano-banana-pro.
// options: { aspect_ratio, num_images }
async function generateImage(prompt, options = {}) {
  const key      = _key();
  const endpoint = `${NB_BASE}/v1/images/generations`;
  const body = {
    model:        'nano-banana',
    prompt,
    aspect_ratio: options.aspect_ratio || '16:9',
    n:            options.num_images   || 1,
  };

  const _masked = key.slice(0, 5) + '[...' + key.slice(-4) + ']';
  console.log('[NanaBanana/img] → POST', endpoint);
  console.log('[NanaBanana/img] → Authorization: Bearer', _masked, '| key length:', key.length);
  console.log('[NanaBanana/img] → model:', body.model, '| ratio:', body.aspect_ratio, '| n:', body.n);
  console.log('[NanaBanana/img] → prompt:', prompt.slice(0, 120));

  const response = await fetch(endpoint, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  let data;
  try {
    data = await response.json();
  } catch (_) {
    const text = await response.text().catch(() => '(empty)');
    throw new Error(`Nano Banana non-JSON (HTTP ${response.status}): ${text.slice(0, 400)}`);
  }

  console.log('[NanaBanana/img] ← HTTP', response.status, JSON.stringify(data).slice(0, 300));

  if (!response.ok) throw new Error(_parseError(data, response.status));

  // nanobanana.aikit.club returns OpenAI-compatible { data: [{ url, revised_prompt }] }
  const items = data?.data || [];
  return items.map(item => (typeof item === 'string' ? item : item.url)).filter(Boolean);
}

module.exports = { isConfigured, diagnose, generateImage };
