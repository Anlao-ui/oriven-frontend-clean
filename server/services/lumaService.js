// ════════════════════════════════════════════════════════════════
// Luma AI Dream Machine service
//
// API key is ALWAYS read from process.env.LUMA_API_KEY — never
// hardcoded here. The calling route passes the key in so this
// module stays testable and key-free.
// ════════════════════════════════════════════════════════════════

const LUMA_BASE = 'https://api.lumalabs.ai/dream-machine/v1';

// Submit a video generation job to Luma AI.
// Returns the full generation object: { id, state, created_at, assets, failure_reason }
async function generateVideo(prompt, aspectRatio, apiKey) {
  const response = await fetch(`${LUMA_BASE}/generations`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept':        'application/json',
    },
    body: JSON.stringify({
      prompt:       prompt,
      aspect_ratio: aspectRatio || '16:9',
      loop:         false,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errMsg = (data && (data.message || data.detail || JSON.stringify(data))) || 'Luma API error';
    throw new Error(errMsg);
  }

  return data;
}

// Poll the status of an existing generation.
// Returns: { id, state, assets: { video, image }, failure_reason }
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

  const data = await response.json();

  if (!response.ok) {
    const errMsg = (data && (data.message || data.detail || JSON.stringify(data))) || 'Luma API error';
    throw new Error(errMsg);
  }

  return data;
}

module.exports = { generateVideo, getVideoStatus };
