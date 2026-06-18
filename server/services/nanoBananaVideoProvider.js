// ════════════════════════════════════════════════════════════════
// Nano Banana Video — nanobananavideo.com
//
// This is a SEPARATE service from nanobanana.aikit.club (image).
// It uses a different key format (nb_ prefix) and a different subscription.
//
// Env var:  NANO_BANANA_VIDEO_KEY  (format: nb_...)
// Endpoints:
//   POST https://nanobananavideo.com/api/v1/text-to-video.php
//   POST https://nanobananavideo.com/api/v1/image-to-video.php
//   GET  https://nanobananavideo.com/api/v1/video-status.php?video_id=<id>
// Auth: Authorization: Bearer nb_YOUR_KEY
//
// Key is ALWAYS read from process.env — never hardcoded or sent to frontend.
// ════════════════════════════════════════════════════════════════

const NBV_BASE = 'https://nanobananavideo.com';

function _readRaw() {
  const raw = process.env.NANO_BANANA_VIDEO_KEY || '';
  return raw.replace(/^﻿/, '').replace(/^[\s\r\n]+|[\s\r\n]+$/g, '');
}

function _key() {
  const key = _readRaw();
  if (!key) throw new Error('NANO_BANANA_VIDEO_KEY is not configured — set it in .env.local (format: nb_...)');
  return key;
}

function isConfigured() {
  const key = _readRaw();
  return !!(key && key.length > 4);
}

function diagnose() {
  const envName = 'NANO_BANANA_VIDEO_KEY';
  const raw     = process.env[envName];
  const trimmed = _readRaw();

  console.log('');
  console.log('── NanoBanana Video Provider Diagnostics ────────────');
  console.log('[NBVideo] env var name       :', envName);
  console.log('[NBVideo] env var exists     :', raw !== undefined);
  console.log('[NBVideo] raw length         :', raw ? raw.length : 0);
  console.log('[NBVideo] trimmed length     :', trimmed.length);

  if (raw && raw.length !== trimmed.length) {
    console.warn('[NBVideo] ⚠️  whitespace detected — lengths differ (' + raw.length + ' vs ' + trimmed.length + ')');
  }

  if (trimmed) {
    const masked = trimmed.slice(0, 5) + '[...' + trimmed.slice(-4) + ']';
    console.log('[NBVideo] key (masked)       :', masked);
    console.log('[NBVideo] starts with "nb_"  :', trimmed.startsWith('nb_'));
    console.log('[NBVideo] auth header        : Authorization: Bearer ' + masked);
    console.log('[NBVideo] configured         : true ✅');
  } else {
    console.error('[NBVideo] ❌ key missing — Video Ads will return 503');
    console.error('[NBVideo]    Obtain nb_ key from nanobananavideo.com dashboard → API');
    console.error('[NBVideo]    Add NANO_BANANA_VIDEO_KEY=nb_... to .env.local');
  }
  console.log('─────────────────────────────────────────────────────');
  console.log('');
}

function _parseError(data, httpStatus) {
  if (!data) return `Nano Banana Video HTTP ${httpStatus}`;
  const msg = data?.error?.message || data?.message || data?.error || JSON.stringify(data);
  return `Nano Banana Video ${httpStatus}: ${msg}`;
}

// ── Text-to-video ─────────────────────────────────────────────
// options: { duration (seconds), resolution, video_model, aspect_ratio }
// Returns { generationId: string }
async function generateVideo(prompt, options = {}) {
  const key      = _key();
  const endpoint = `${NBV_BASE}/api/v1/text-to-video.php`;
  const body = {
    prompt,
    resolution:   options.resolution   || '1080p',
    duration:     Number(options.duration || 5),
    aspect_ratio: options.aspect_ratio  || '16:9',
    video_model:  options.video_model   || 'seedance2',
  };

  const masked = key.slice(0, 5) + '[...' + key.slice(-4) + ']';
  console.log('[NBVideo/txt2vid] → POST', endpoint);
  console.log('[NBVideo/txt2vid] → Authorization: Bearer', masked, '| model:', body.video_model, '| duration:', body.duration, 's');
  console.log('[NBVideo/txt2vid] → prompt:', prompt.slice(0, 120));

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
    throw new Error(`Nano Banana Video non-JSON (HTTP ${response.status}): ${text.slice(0, 400)}`);
  }

  console.log('[NBVideo/txt2vid] ← HTTP', response.status, JSON.stringify(data).slice(0, 300));
  if (!response.ok) throw new Error(_parseError(data, response.status));

  const id = data?.video_id || data?.id;
  if (!id) throw new Error('Nano Banana Video returned no video_id: ' + JSON.stringify(data).slice(0, 200));
  return { generationId: String(id) };
}

// ── Image-to-video ────────────────────────────────────────────
// options: { imageUrl2, duration, resolution, video_model, aspect_ratio }
// Returns { generationId: string }
async function generateVideoFromImage(imageUrl, prompt, options = {}) {
  const key      = _key();
  const endpoint = `${NBV_BASE}/api/v1/image-to-video.php`;
  const body = {
    image_url:    imageUrl,
    prompt:       prompt || '',
    resolution:   options.resolution  || '1080p',
    duration:     Number(options.duration || 5),
    aspect_ratio: options.aspect_ratio || '16:9',
    video_model:  options.video_model  || 'seedance2',
  };
  if (options.imageUrl2) body.image_url_end = options.imageUrl2;

  const masked = key.slice(0, 5) + '[...' + key.slice(-4) + ']';
  console.log('[NBVideo/img2vid] → POST', endpoint);
  console.log('[NBVideo/img2vid] → Authorization: Bearer', masked, '| model:', body.video_model);
  console.log('[NBVideo/img2vid] → image_url:', imageUrl.slice(0, 80), '| prompt:', (prompt || '').slice(0, 80));

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
    throw new Error(`Nano Banana Video non-JSON (HTTP ${response.status}): ${text.slice(0, 400)}`);
  }

  console.log('[NBVideo/img2vid] ← HTTP', response.status, JSON.stringify(data).slice(0, 300));
  if (!response.ok) throw new Error(_parseError(data, response.status));

  const id = data?.video_id || data?.id;
  if (!id) throw new Error('Nano Banana Video returned no video_id: ' + JSON.stringify(data).slice(0, 200));
  return { generationId: String(id) };
}

// ── Poll status ───────────────────────────────────────────────
// Returns { status: 'queued'|'processing'|'completed'|'failed', videoUrl, failureReason }
async function getVideoStatus(generationId) {
  const key      = _key();
  const endpoint = `${NBV_BASE}/api/v1/video-status.php?video_id=${encodeURIComponent(generationId)}`;

  const response = await fetch(endpoint, {
    headers: { 'Authorization': `Bearer ${key}` },
  });

  let data;
  try {
    data = await response.json();
  } catch (_) {
    const text = await response.text().catch(() => '(empty)');
    throw new Error(`Nano Banana Video status non-JSON (HTTP ${response.status}): ${text.slice(0, 400)}`);
  }

  console.log('[NBVideo/status] ←', generationId, 'HTTP', response.status, JSON.stringify(data).slice(0, 200));
  if (!response.ok) throw new Error(_parseError(data, response.status));

  // Normalise status to the set videoads.js expects: queued | processing | completed | failed
  const raw    = (data?.status || '').toLowerCase();
  const status = raw === 'done' || raw === 'succeeded' ? 'completed'
               : raw === 'error' || raw === 'errored'  ? 'failed'
               : raw === 'running' || raw === 'pending' ? 'processing'
               : raw || 'queued';

  return {
    status,
    videoUrl:      data?.video_url  || null,
    failureReason: data?.error      || data?.message || null,
  };
}

module.exports = { isConfigured, diagnose, generateVideo, generateVideoFromImage, getVideoStatus };
