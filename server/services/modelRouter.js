// ════════════════════════════════════════════════════════════════
// Oriven Model Router
//
// Single source of truth for every AI provider and model used in
// the platform. To swap a model or move a task to a different
// provider: edit one entry below. Routes never hard-code providers.
//
// Usage:  const route = routeTask('ads-copy');
// Returns: { provider, model, type, label [, endpoint] }
// ════════════════════════════════════════════════════════════════

// ── Provider catalogue ────────────────────────────────────────
// Add or change models here — routes update automatically.

const MODELS = {

  // ── Anthropic (text, reasoning, vision) ──────────────────────
  // Used for: all copy, web, email, campaigns, brand strategy,
  //           posters, infographics, presentations, UGC scripts,
  //           logo prompts, product shoot prompts, vision analysis.
  // Best available model: claude-opus-4-8
  anthropic: {
    quality:   'claude-opus-4-8',  // copy, campaigns, brand strategy
    creative:  'claude-opus-4-8',  // ad copy, UGC scripts, email text
    reasoning: 'claude-opus-4-8',  // brand core, positioning, web
    code:      'claude-opus-4-8',  // structured HTML output (posters, infographics)
    vision:    'claude-opus-4-8',  // image analysis + style extraction
    fast:      'claude-haiku-4-5-20251001',  // lightweight / future low-cost tasks
  },

  // ── OpenAI (image generation) ─────────────────────────────────
  // Used for: visuals, logos, product shoots, campaign images,
  //           poster visuals, infographic visuals.
  openai: {
    image: 'gpt-image-1',   // highest-quality image generation
  },

  // ── AIML API (image + video) ──────────────────────────────────
  // Routes: product-shoots (image), video-ads, motion-graphics, UGC video.
  aiml: {
    image: 'gpt-image-1',                           // product shoots via AIML proxy
    video: 'kling-video/v1/standard/text-to-video', // video ads + motion graphics + UGC
    // Future video upgrades (uncomment to activate):
    // video: 'kling-video/v2/standard/text-to-video',
    // ugc:   'kling-video/v2/pro/text-to-video',
  },

};

// ── Task routing table ────────────────────────────────────────
// Each entry maps an Oriven task type to a provider + model.
// "endpoint" is only needed for AIML tasks (AIML requires explicit
//  endpoint routing; Anthropic + OpenAI use their SDK defaults).

const TASKS = {

  // ── Anthropic — Text & Copy ───────────────────────────────────
  'text-copy': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.creative,
    label:    'Text & Copy',
  },
  'ads-copy': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.creative,
    label:    'Ad Copy',
  },

  // ── Anthropic — Web ──────────────────────────────────────────
  'web': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.code,
    label:    'Web',
  },

  // ── Anthropic — Email ─────────────────────────────────────────
  'email': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.creative,
    label:    'Email',
  },

  // ── Anthropic — Campaigns ─────────────────────────────────────
  'campaigns-copy': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.quality,
    label:    'Campaign Copy',
  },

  // ── Anthropic — Presentations ─────────────────────────────────
  'presentations': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.quality,
    label:    'Presentations',
  },

  // ── Anthropic — Posters ───────────────────────────────────────
  'poster': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.code,
    label:    'Poster',
  },

  // ── Anthropic — Infographics ──────────────────────────────────
  'infographic': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.code,
    label:    'Infographic',
  },

  // ── Anthropic — Brand Core & Strategy ────────────────────────
  'brand-core': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.reasoning,
    label:    'Brand Core',
  },

  // ── Anthropic — Visual Prompt Building ───────────────────────
  // Used to craft image prompts before handing off to OpenAI.
  'visuals-copy': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.quality,
    label:    'Visual Prompt',
  },
  'logo-copy': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.quality,
    label:    'Logo Prompt',
  },
  'product-shoots-copy': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.quality,
    label:    'Product Shoot Prompt',
  },
  'motion-graphics-copy': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.quality,
    label:    'Motion Graphics Prompt',
  },
  'video-ads-copy': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.creative,
    label:    'Video Ad Prompt',
  },

  // ── Anthropic — UGC ──────────────────────────────────────────
  'ugc-script': {
    provider: 'anthropic',
    type:     'text',
    model:    MODELS.anthropic.creative,
    label:    'UGC Script',
  },

  // ── Anthropic — Vision Analysis ───────────────────────────────
  'vision': {
    provider: 'anthropic',
    type:     'vision',
    model:    MODELS.anthropic.vision,
    label:    'Vision Analysis',
  },

  // ── OpenAI — Image Generation ────────────────────────────────
  'visuals': {
    provider: 'openai',
    type:     'image',
    model:    MODELS.openai.image,
    label:    'Visuals',
  },
  'logo': {
    provider: 'openai',
    type:     'image',
    model:    MODELS.openai.image,
    label:    'Logo',
  },
  'product-shoots': {
    provider: 'aiml',
    type:     'image',
    model:    MODELS.aiml.image,
    endpoint: '/v1/images/generations',
    label:    'Product Shoot',
  },
  'campaigns-image': {
    provider: 'openai',
    type:     'image',
    model:    MODELS.openai.image,
    label:    'Campaign Visual',
  },
  'posters-image': {
    provider: 'openai',
    type:     'image',
    model:    MODELS.openai.image,
    label:    'Poster Visual',
  },

  // ── AIML — Motion Graphics (video) ───────────────────────────
  'motion-graphics': {
    provider: 'aiml',
    type:     'video',
    model:    MODELS.aiml.video,
    endpoint: '/v2/video/generations',
    label:    'Motion Graphics',
  },

  // ── AIML — Video Generation (unchanged) ──────────────────────
  'video-ads': {
    provider: 'aiml',
    type:     'video',
    model:    MODELS.aiml.video,
    endpoint: '/v2/video/generations',
    label:    'Video Ads',
  },
  'ugc-video': {
    provider: 'aiml',
    type:     'video',
    model:    MODELS.aiml.video,
    endpoint: '/v2/video/generations',
    label:    'UGC Video',
  },

};

// ── routeTask() ───────────────────────────────────────────────
// Returns full routing config for a task type.
// Throws immediately on unknown type so bugs surface at call-time.

function routeTask(type) {
  const task = TASKS[type];
  if (!task) {
    throw new Error(
      `[ModelRouter] Unknown task type: "${type}". ` +
      `Valid types: ${Object.keys(TASKS).join(', ')}`
    );
  }
  return {
    provider: task.provider,
    model:    task.model,
    endpoint: task.endpoint || null,
    type:     task.type,
    label:    task.label,
  };
}

// ── logSummary() ──────────────────────────────────────────────
// Prints active provider + model config at startup.

function logSummary() {
  console.log('');
  console.log('── Model Router ──────────────────────────────────────');
  console.log('[Router] Anthropic quality   :', MODELS.anthropic.quality);
  console.log('[Router] Anthropic creative  :', MODELS.anthropic.creative);
  console.log('[Router] Anthropic reasoning :', MODELS.anthropic.reasoning);
  console.log('[Router] Anthropic vision    :', MODELS.anthropic.vision);
  console.log('[Router] OpenAI image        :', MODELS.openai.image);
  console.log('[Router] AIML image          :', MODELS.aiml.image);
  console.log('[Router] AIML video          :', MODELS.aiml.video);
  console.log('[Router] Task count          :', Object.keys(TASKS).length, 'task types registered');
  console.log('──────────────────────────────────────────────────────');
  console.log('');
}

module.exports = { MODELS, TASKS, routeTask, logSummary };
