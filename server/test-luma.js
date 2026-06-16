// ════════════════════════════════════════════════════════════════
// Luma API diagnostic script — run from c:\files\server\
//
//   node test-luma.js
//
// Tests BOTH the legacy Dream Machine API and the new Agents API,
// showing exactly which base URL and endpoint combination works.
// ════════════════════════════════════════════════════════════════

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const rawKey = process.env.LUMA_API_KEY || '';
const key    = rawKey.trim();

console.log('\n══════════════ LUMA API DIAGNOSTIC ══════════════');
console.log('Key loaded    :', !!key);
console.log('Key length    :', key.length);
console.log('Key prefix    :', key.slice(0, 20));
console.log('Has whitespace:', rawKey !== key);
console.log('Looks valid   :', key.startsWith('luma-api-'));
console.log('');

if (!key) {
  console.error('FATAL: LUMA_API_KEY is empty — check ../.env');
  process.exit(1);
}

// ── Request helper ────────────────────────────────────────────
async function hit(label, url, method, body) {
  const headers = {
    'Authorization': `Bearer ${key}`,
    'Accept'       : 'application/json',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  };

  console.log(`── ${label}`);
  console.log(`   ${method} ${url}`);
  console.log(`   Authorization: Bearer ${key.slice(0, 15)}...`);
  if (body) console.log(`   Body: ${JSON.stringify(body)}`);

  let status, parsed;
  try {
    const r = await fetch(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    status = r.status;
    const text = await r.text();
    try { parsed = JSON.parse(text); } catch (_) { parsed = text; }
  } catch (err) {
    console.log(`   NETWORK ERROR: ${err.message}\n`);
    return { label, status: 'network-error', ok: false };
  }

  console.log(`   Status : ${status}`);
  console.log(`   Body   : ${JSON.stringify(parsed).slice(0, 600)}`);
  console.log('');

  return { label, status, ok: status >= 200 && status < 300, body: parsed };
}

// ── Test suite ────────────────────────────────────────────────
async function main() {
  const results = [];

  // ── Section 1: Agents API (new) ───────────────────────────
  console.log('══ Section 1: Agents API — agents.lumalabs.ai/v1 ══\n');
  const AGENTS = 'https://agents.lumalabs.ai/v1';

  results.push(await hit(
    '[Agents] GET /generations?limit=1',
    `${AGENTS}/generations?limit=1`,
    'GET'
  ));

  results.push(await hit(
    '[Agents] POST /generations — video body (ray-3.2)',
    `${AGENTS}/generations`,
    'POST',
    {
      model:        'ray-3.2',
      type:         'video',
      prompt:       'A test video of a calm ocean at sunrise',
      aspect_ratio: '16:9',
      video: {
        resolution: '720p',
        duration:   '5s',
      },
    }
  ));

  // ── Section 2: Legacy Dream Machine API (old) ─────────────
  console.log('══ Section 2: Legacy Dream Machine API — api.lumalabs.ai/dream-machine/v1 ══\n');
  const LEGACY = 'https://api.lumalabs.ai/dream-machine/v1';

  results.push(await hit(
    '[Legacy] GET /generations?limit=1',
    `${LEGACY}/generations?limit=1`,
    'GET'
  ));

  results.push(await hit(
    '[Legacy] POST /generations/video',
    `${LEGACY}/generations/video`,
    'POST',
    { prompt: 'A test', model: 'ray-2', aspect_ratio: '16:9' }
  ));

  // ── Conclusion ────────────────────────────────────────────
  console.log('══════════════ CONCLUSION ══════════════');

  const agentsOk  = results.filter(r => r.label.startsWith('[Agents]') && r.ok);
  const legacyOk  = results.filter(r => r.label.startsWith('[Legacy]') && r.ok);
  const allFailed = results.every(r => !r.ok);

  if (agentsOk.length) {
    console.log('✅ Agents API works. Use base URL: https://agents.lumalabs.ai/v1');
    agentsOk.forEach(r => console.log(`   ✅ ${r.label} → ${r.status}`));
  } else {
    console.log('❌ Agents API failed on all endpoints.');
    results.filter(r => r.label.startsWith('[Agents]'))
      .forEach(r => console.log(`   ❌ ${r.label} → ${r.status}`));
  }

  if (legacyOk.length) {
    console.log('✅ Legacy Dream Machine API works (endpoint may still be valid).');
    legacyOk.forEach(r => console.log(`   ✅ ${r.label} → ${r.status}`));
  } else {
    console.log('❌ Legacy Dream Machine API also failed.');
    results.filter(r => r.label.startsWith('[Legacy]'))
      .forEach(r => console.log(`   ❌ ${r.label} → ${r.status}`));
  }

  if (allFailed) {
    const statuses = [...new Set(results.map(r => r.status))];
    if (statuses.every(s => s === 403 || s === 401)) {
      console.log('\n⚠️  All requests 401/403 — key is not authenticated on any API.');
      console.log('   Check: https://lumalabs.ai/dream-machine/api/keys');
      console.log('   Ensure your account has API access (paid plan required).');
    }
  }

  // Show the generation ID if a POST succeeded (so we can check status)
  const successPost = results.find(r => r.ok && r.label.includes('POST'));
  if (successPost && successPost.body && successPost.body.id) {
    const genId = successPost.body.id;
    console.log(`\n✅ Generation started — ID: ${genId}`);
    console.log('   Polling status in 5 seconds…\n');
    await new Promise(res => setTimeout(res, 5000));

    const base = successPost.label.startsWith('[Agents]') ? AGENTS : LEGACY;
    await hit(
      'POLL — generation status',
      `${base}/generations/${encodeURIComponent(genId)}`,
      'GET'
    );
  }

  console.log('════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Script error:', err.message);
  process.exit(1);
});
