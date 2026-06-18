// ════════════════════════════════════════════════════════════════
// AI CONVERSATION FLOW
// Replaces the form-based builder for Image, Text, and Campaign.
// Keys are aligned with S._builder / FLOWS in create.js so the
// existing runBuilder() engine is used unchanged for generation.
// ════════════════════════════════════════════════════════════════

var CF_FLOWS = {

  // ── Visuals ──────────────────────────────────────────────────
  // Brand Core supplies: name, audience, tone, colors, positioning, visual direction.
  // User provides: visual type, format, and optional extra instructions.
  image: [
    {
      key:  "imgVisualType",
      q:    "What type of visual do you need?",
      desc: "Your Brand Core colors, tone, and visual direction are applied automatically.",
      options: [
        { val: "social",        label: "Social Post" },
        { val: "advertisement", label: "Ad" },
        { val: "banner",        label: "Banner" },
        { val: "poster",        label: "Poster" },
        { val: "website",       label: "Website Graphic" },
        { val: "presentation",  label: "Presentation Graphic" },
        { val: "custom",        label: "Custom" }
      ]
    },
    {
      key:  "imgFormat",
      q:    "What format?",
      desc: "Sets the dimensions and aspect ratio of the output.",
      options: [
        { val: "1:1",  label: "Square 1:1" },
        { val: "4:5",  label: "Portrait 4:5" },
        { val: "9:16", label: "Story 9:16" },
        { val: "16:9", label: "Landscape 16:9" }
      ]
    },
    {
      key:         "_extraNotes",
      q:           "Any additional instructions?",
      desc:        "Describe the scene, subject, or anything specific. Leave blank to let Oriven decide.",
      type:        "textarea",
      placeholder: "e.g. Product on a dark premium background. Minimal composition. Focus on the logo.",
      optional:    true
    },
    { type: "prompt-preview", key: "_promptPreview", q: "Your AI brief is ready.", desc: "Generated with AI using your Brand Core. Review and edit before generating." }
  ],

  // ── Text & Copy ───────────────────────────────────────────────
  // Brand Core supplies: name, tone, audience, positioning, messaging.
  // User provides: content type, goal, optional extra context.
  text: [
    {
      key:  "txtType",
      q:    "What type of content are you creating?",
      desc: "Your Brand Core tone of voice and messaging are applied automatically.",
      options: [
        { val: "headline",     label: "Headline" },
        { val: "body_copy",    label: "Body Copy" },
        { val: "caption",      label: "Social Caption" },
        { val: "hook",         label: "Hook" },
        { val: "ad_copy",      label: "Ad Copy" },
        { val: "product_desc", label: "Product Description" }
      ]
    },
    {
      key:  "txtPurpose",
      q:    "What is the goal?",
      desc: "This shapes the angle and intensity of the copy.",
      options: [
        { val: "launch",      label: "Product Launch" },
        { val: "awareness",   label: "Build Awareness" },
        { val: "conversion",  label: "Drive Conversions" },
        { val: "engagement",  label: "Engage Audience" },
        { val: "brand_intro", label: "Brand Introduction" },
        { val: "promotion",   label: "Promotion" }
      ]
    },
    {
      key:         "_extraNotes",
      q:           "Any additional instructions?",
      desc:        "Optional context, specific messages, or creative direction.",
      type:        "textarea",
      placeholder: "e.g. Include a sense of urgency. Mention the free trial. Keep it punchy.",
      optional:    true
    },
    { type: "prompt-preview", key: "_promptPreview", q: "Your AI brief is ready.", desc: "Generated with AI using your Brand Core. Review and edit before generating." }
  ],

  // ── Campaign ──────────────────────────────────────────────────
  // Brand Core supplies: name, audience, tone, positioning, visual direction, colors.
  // User provides: goal, campaign type, optional extra instructions.
  campaign: [
    {
      key:  "campGoal",
      q:    "What is the goal of this campaign?",
      desc: "Every element — hook, copy, visuals, CTA — will be shaped around this goal.",
      options: [
        { val: "sales",     label: "Sales" },
        { val: "leads",     label: "Lead Generation" },
        { val: "awareness", label: "Brand Awareness" },
        { val: "launch",    label: "Product Launch" },
        { val: "traffic",   label: "Website Traffic" },
        { val: "community", label: "Community Growth" }
      ]
    },
    {
      key:  "campType",
      q:    "What type of campaign?",
      desc: "This defines the channel mix and content format.",
      options: [
        { val: "social",    label: "Social Media" },
        { val: "paid_ads",  label: "Paid Ads" },
        { val: "email",     label: "Email Campaign" },
        { val: "content",   label: "Content Marketing" },
        { val: "multichannel", label: "Multi-Channel" }
      ]
    },
    {
      key:         "_extraNotes",
      q:           "Any additional instructions?",
      desc:        "Specific offers, urgency signals, tone direction, or creative focus.",
      type:        "textarea",
      placeholder: "e.g. Focus on the limited-time offer. Emphasise premium quality. Include social proof.",
      optional:    true
    },
    { type: "prompt-preview", key: "_promptPreview", q: "Your AI brief is ready.", desc: "Generated with AI using your Brand Core. Review and edit before generating." }
  ],

  // ── UGC Creator ───────────────────────────────────────────────
  // Brand Core supplies: name, positioning, audience, tone.
  // User picks a creator, script mode, and optional product context.
  ugc: [
    {
      key:  "ucAvatar",
      type: "avatar-picker",
      q:    "Choose your creator.",
      desc: "Select the AI creator that will deliver your ad."
    },
    {
      key:  "ucScriptMode",
      q:    "How do you want the script?",
      desc: "ORIVEN AI can write a high-converting script, or bring your own.",
      options: [
        { val: "ai",     label: "Write with AI",     desc: "ORIVEN generates a script tailored to your Brand Core" },
        { val: "custom", label: "Use my own script", desc: "Paste a script you've already written" }
      ]
    },
    {
      key:            "ucContext",
      q:              "What product or service is this ad for? Any desired angle?",
      desc:           "Optional — your Brand Core is already applied. Add anything specific the script should mention.",
      type:           "textarea",
      placeholder:    "e.g. New protein powder launch. Angle: speed and recovery for serious athletes.",
      optional:       true,
      maxChars:       400,
      conditional:    "ucScriptMode",
      conditionalVal: "ai"
    },
    {
      key:            "ucCustomScript",
      q:              "Paste your script below.",
      desc:           "Spoken directly by the AI creator. Keep it conversational — aim for 30–60 seconds.",
      type:           "textarea",
      placeholder:    "Paste your UGC script here…",
      optional:       false,
      maxChars:       900,
      conditional:    "ucScriptMode",
      conditionalVal: "custom"
    },
    { type: "prompt-preview", key: "_promptPreview", q: "Your AI brief is ready.", desc: "Generated with AI using your Brand Core. Review and edit before generating." }
  ],

  // ── Web ───────────────────────────────────────────────────────
  // Brand Core supplies: name, audience, tone, positioning, colors, visual direction.
  // User provides: website type, goal, optional extra instructions.
  web: [
    {
      key:  "webType",
      q:    "What type of website do you need?",
      desc: "Your Brand Core identity and visual direction are applied automatically.",
      options: [
        { val: "landing",   label: "Landing Page",     desc: "Single goal — one offer, one CTA" },
        { val: "business",  label: "Business Website", desc: "Services, team, contact, and about" },
        { val: "portfolio", label: "Portfolio",         desc: "Showcase work or personal brand" },
        { val: "ecommerce", label: "E-commerce",        desc: "Products, cart, and checkout flow" },
        { val: "agency",    label: "Agency Website",   desc: "Services, case studies, and contact" },
        { val: "saas",      label: "SaaS Website",     desc: "Features, pricing, and signup" }
      ]
    },
    {
      key:  "webGoal",
      q:    "What is the primary goal?",
      desc: "Every headline, CTA, and layout section will orient toward this.",
      options: [
        { val: "sales",     label: "Generate Sales" },
        { val: "leads",     label: "Collect Leads" },
        { val: "book_call", label: "Book Calls" },
        { val: "showcase",  label: "Showcase Work" },
        { val: "trust",     label: "Build Trust" },
        { val: "launch",    label: "Launch Product" }
      ]
    },
    {
      key:         "_extraNotes",
      q:           "Any additional instructions?",
      desc:        "Specific sections, CTAs, trust signals, or design preferences.",
      type:        "textarea",
      placeholder: "e.g. Include testimonials and pricing. Mobile-first. Strong hero CTA.",
      optional:    true
    },
    { type: "prompt-preview", key: "_promptPreview", q: "Your AI brief is ready.", desc: "Generated with AI using your Brand Core. Review and edit before generating." }
  ],

  // ── Email ─────────────────────────────────────────────────────
  // Brand Core supplies: name, audience, tone, messaging, positioning.
  // User provides: email type, desired action, optional extra instructions.
  email: [
    {
      key:  "emailType",
      q:    "What is the email objective?",
      desc: "Your Brand Core tone and audience are applied automatically.",
      options: [
        { val: "newsletter",     label: "Newsletter" },
        { val: "product_launch", label: "Product Launch" },
        { val: "welcome",        label: "Welcome Email" },
        { val: "sales",          label: "Sales Email" },
        { val: "promotion",      label: "Promotion" },
        { val: "announcement",   label: "Announcement" }
      ]
    },
    {
      key:         "emailCta",
      q:           "What is the desired action?",
      desc:        "The single action you want readers to take — keep it clear and direct.",
      type:        "textarea",
      placeholder: "e.g. Shop Now. Claim Your Discount. Book a Call. Start Free Trial.",
      optional:    false
    },
    {
      key:         "_extraNotes",
      q:           "Any additional instructions?",
      desc:        "Specific offers, urgency signals, or tone direction.",
      type:        "textarea",
      placeholder: "e.g. Mention the 48-hour deadline. Keep it short and punchy. Include a P.S. line.",
      optional:    true
    },
    { type: "prompt-preview", key: "_promptPreview", q: "Your AI brief is ready.", desc: "Generated with AI using your Brand Core. Review and edit before generating." }
  ],

  // ── Presentation ──────────────────────────────────────────────
  // Brand Core supplies: name, audience, tone, positioning, colors, fonts.
  // User provides: topic, goal, slide count, optional extra instructions.
  deck: [
    {
      key:         "deckTopic",
      q:           "What is this presentation about?",
      desc:        "Your Brand Core identity and positioning are applied automatically.",
      type:        "textarea",
      placeholder: "e.g. AI branding platform for DTC brands. Q3 performance review. New product launch.",
      optional:    false
    },
    {
      key:         "deckGoal",
      q:           "What is the goal?",
      desc:        "What should the audience think, feel, or do by the end?",
      type:        "textarea",
      placeholder: "e.g. Secure Series A funding. Close the enterprise deal. Inform the leadership team.",
      optional:    false
    },
    {
      key:  "deckSlides",
      q:    "How many slides?",
      desc: "Choose a length that fits your context — less is often more.",
      options: [
        { val: "5",  label: "5 slides" },
        { val: "10", label: "10 slides" },
        { val: "15", label: "15 slides" },
        { val: "20", label: "20 slides" }
      ]
    },
    {
      key:         "_extraNotes",
      q:           "Any additional instructions?",
      desc:        "Specific slides, talking points, or tone direction.",
      type:        "textarea",
      placeholder: "e.g. Include a market size slide. Keep language non-technical. Emphasise the founder story.",
      optional:    true
    },
    { type: "prompt-preview", key: "_promptPreview", q: "Your AI brief is ready.", desc: "Generated with AI using your Brand Core. Review and edit before generating." }
  ],

  // ── Poster ───────────────────────────────────────────────────
  // Brand Core supplies: name, tone, colors, visual direction, positioning.
  // User provides: purpose, format, optional extra instructions.
  poster: [
    {
      key:  "posterType",
      q:    "What is the poster for?",
      desc: "Your Brand Core colors and visual direction are applied automatically.",
      options: [
        { val: "product",     label: "Product" },
        { val: "launch",      label: "Launch" },
        { val: "event",       label: "Event" },
        { val: "recruitment", label: "Recruitment" },
        { val: "promotion",   label: "Promotion" },
        { val: "custom",      label: "Custom" }
      ]
    },
    {
      key:  "posterFormat",
      q:    "What format?",
      desc: "Sets the dimensions and orientation of the poster.",
      options: [
        { val: "portrait",  label: "Portrait (A4/A3)" },
        { val: "square",    label: "Square" },
        { val: "landscape", label: "Landscape" },
        { val: "story",     label: "Story 9:16" },
        { val: "banner",    label: "Wide Banner" }
      ]
    },
    {
      key:         "_extraNotes",
      q:           "Any additional instructions?",
      desc:        "Headline, copy, call-to-action, scene, or any specific creative direction.",
      type:        "textarea",
      placeholder: "e.g. Headline: Launch Day Is Here. Include the URL oriven.ai. Dark premium aesthetic.",
      optional:    true
    },
    { type: "prompt-preview", key: "_promptPreview", q: "Your AI brief is ready.", desc: "Generated with AI using your Brand Core. Review and edit before generating." }
  ],

  // ── Infographic ───────────────────────────────────────────────
  // Brand Core supplies: name, audience, tone, colors, visual direction.
  // User provides: topic, data/content, optional extra instructions.
  infographic: [
    {
      key:         "infographicTopic",
      q:           "What is this infographic about?",
      desc:        "Your Brand Core visual style and audience are applied automatically.",
      type:        "textarea",
      placeholder: "e.g. How our onboarding works. The 5 stages of brand building. Q3 performance highlights.",
      optional:    false
    },
    {
      key:         "infographicData",
      q:           "What data or content should be included?",
      desc:        "Enter the facts, steps, stats, or key points to visualise.",
      type:        "textarea",
      placeholder: "e.g. Step 1: Sign up. Step 2: Build Brand Core. Step 3: Generate assets. Or: 83% of buyers trust visual content.",
      optional:    false
    },
    {
      key:         "_extraNotes",
      q:           "Any additional instructions?",
      desc:        "Layout preferences, data emphasis, call-to-action, or creative direction.",
      type:        "textarea",
      placeholder: "e.g. Lead with the biggest stat. Include icons for each step. CTA: Visit oriven.ai.",
      optional:    true
    },
    { type: "prompt-preview", key: "_promptPreview", q: "Your AI brief is ready.", desc: "Generated with AI using your Brand Core. Review and edit before generating." }
  ],

  // ── Product Shoots ────────────────────────────────────────────
  // Uses the same gpt-image-1 stack as Visuals, Logos, and Campaign Images.
  // User provides: product, style, goal, optional notes.
  productshoots: [
    {
      key:         "psProduct",
      q:           "What product are you shooting?",
      desc:        "Describe it clearly — name, material, colour, and size give better results.",
      type:        "textarea",
      placeholder: "e.g. Matte black ceramic mug, 30ml Vitamin C serum in amber glass bottle",
      optional:    false
    },
    {
      key:  "psStyle",
      q:    "Photography style?",
      desc: "Sets the lighting, mood, and visual language of the photograph.",
      options: [
        { val: "studio",      label: "Studio Clean",  desc: "Pure background, controlled lighting" },
        { val: "lifestyle",   label: "Lifestyle",     desc: "In-context, aspirational setting" },
        { val: "minimal",     label: "Minimal White", desc: "Bright, airy, ecommerce-ready" },
        { val: "dark_premium",label: "Dark Premium",  desc: "Moody deep tones, dramatic shadows" }
      ]
    },
    {
      key:  "psGoal",
      q:    "What is this image for?",
      desc: "The destination shapes composition, crop, and atmosphere.",
      options: [
        { val: "ecommerce",   label: "E-commerce",    desc: "Product listing, marketplace" },
        { val: "social",      label: "Social Media",  desc: "Thumb-stopping, shareable" },
        { val: "advertising", label: "Ad / Campaign", desc: "Brand-aligned, persuasive" },
        { val: "website",     label: "Website Hero",  desc: "Full-bleed, editorial" }
      ]
    },
    {
      key:         "_extraNotes",
      q:           "Any additional direction?",
      desc:        "Specific composition, angle, props, or creative detail.",
      type:        "textarea",
      placeholder: "e.g. Shot from above. Coffee beans scattered around the mug. Dark walnut surface.",
      optional:    true
    },
    { type: "prompt-preview", key: "_promptPreview", q: "Your AI brief is ready.", desc: "Generated with AI using your Brand Core. Review and edit before generating." }
  ],

  motiongraphics: [
    {
      key:  "mgStyle",
      q:    "What type of motion do you need?",
      desc: "Your Brand Core colors and visual identity are applied automatically.",
      options: [
        { val: "logo",       label: "Logo Animation",     desc: "Animated logo reveal or loop" },
        { val: "kinetic",    label: "Kinetic Typography", desc: "Text-driven motion graphic" },
        { val: "social",     label: "Social Motion Post", desc: "Animated social media asset" },
        { val: "intro",      label: "Intro / Outro",      desc: "Video intro or outro sequence" },
        { val: "transition", label: "Transition Pack",    desc: "Brand-aligned transition effects" },
        { val: "custom",     label: "Custom",             desc: "Describe what you need" }
      ]
    },
    {
      key:  "mgDuration",
      q:    "Duration?",
      desc: "Sets the length of the motion graphic.",
      options: [
        { val: "5",  label: "5 seconds",  desc: "Logo loops, social posts, transitions" },
        { val: "10", label: "10 seconds", desc: "Intros, outros, longer sequences" }
      ]
    },
    {
      key:         "mgNotes",
      q:           "Additional instructions?",
      desc:        "Specific animation style, text to include, or creative direction.",
      type:        "textarea",
      placeholder: "e.g. Smooth reveal with green accent. Text: 'Built for Brands'. Minimalist style.",
      optional:    true
    },
    { type: "prompt-preview", key: "_promptPreview", q: "Your AI brief is ready.", desc: "Generated with AI using your Brand Core. Review and edit before generating." }
  ]

};

// ── Prompt builder ────────────────────────────────────────────
// Constructs a human-readable AI brief from CF_FLOW answers + Brand Core.
// This is shown in the prompt-preview step and sent as customPrompt if edited.

function _cfBuildPrompt(type, answers, bc) {
  function v(key) {
    var a = answers[key];
    if (!a) return '';
    return (typeof a === 'string') ? a : (a.val || a.label || '');
  }
  var name  = (bc && bc.name) || '';
  var tone  = (bc && (bc.toneOfVoice || (Array.isArray(bc.tone) ? bc.tone[0] : ''))) || '';
  var aud   = (bc && (bc.audience || bc.aud)) || '';
  var msg   = (bc && bc.messaging)   || '';
  var pos   = (bc && bc.positioning) || '';
  var per   = (bc && bc.personality) || '';
  var clrs  = (bc && bc.colors)      || [];
  var col1  = clrs[0] ? (clrs[0].hex || clrs[0] || '') : ((bc && bc.primaryColor)   || '');
  var col2  = clrs[1] ? (clrs[1].hex || clrs[1] || '') : ((bc && bc.secondaryColor) || '');
  var notes = v('_extraNotes');

  var bcParts = [];
  if (name) bcParts.push('Brand: ' + name);
  if (tone) bcParts.push('Tone of voice: ' + tone);
  if (aud)  bcParts.push('Target audience: ' + aud);
  if (msg)  bcParts.push('Key message: ' + msg);
  if (pos)  bcParts.push('Positioning: ' + pos);
  if (per)  bcParts.push('Brand personality: ' + per);
  if (col1) bcParts.push('Primary color: ' + col1);
  if (col2) bcParts.push('Secondary color: ' + col2);
  var bc_ = bcParts.length ? '\n\nBrand identity applied:\n' + bcParts.join('\n') : '';

  var p = '';
  var bn = name || 'the brand';

  if (type === 'image') {
    p  = 'Create a brand-aligned ' + (v('imgVisualType') || 'visual') + ' for ' + bn + '.';
    if (notes) p += '\n\n' + notes;
    p += bc_;
    if (v('imgFormat')) p += '\nFormat: ' + v('imgFormat');

  } else if (type === 'text') {
    p  = 'Write ' + (v('txtType') || 'copy') + ' for ' + bn;
    if (v('txtPurpose')) p += '. Goal: ' + v('txtPurpose');
    p += '.';
    if (notes) p += '\n\n' + notes;
    p += bc_;

  } else if (type === 'campaign') {
    p  = 'Create a ' + (v('campType') || 'multi-channel') + ' campaign for ' + bn;
    if (v('campGoal')) p += '. Goal: ' + v('campGoal');
    p += '.';
    if (notes) p += '\n\n' + notes;
    p += bc_;

  } else if (type === 'web') {
    p  = 'Build a ' + (v('webType') || 'website') + ' for ' + bn;
    if (v('webGoal')) p += '. Primary goal: ' + v('webGoal');
    p += '.';
    if (notes) p += '\n\n' + notes;
    p += bc_;

  } else if (type === 'email') {
    p  = 'Write a ' + (v('emailType') || 'email') + ' for ' + bn + '.';
    if (v('emailCta')) p += '\nDesired action: ' + v('emailCta');
    if (notes) p += '\n\n' + notes;
    p += bc_;

  } else if (type === 'deck') {
    p  = 'Build a ' + (v('deckSlides') || '10') + '-slide presentation for ' + bn + '.';
    if (v('deckTopic')) p += '\nTopic: ' + v('deckTopic');
    if (v('deckGoal'))  p += '\nGoal: '  + v('deckGoal');
    if (notes) p += '\n\n' + notes;
    p += bc_;

  } else if (type === 'poster') {
    p  = 'Design a ' + (v('posterType') || 'product') + ' poster for ' + bn + '.';
    if (v('posterFormat')) p += ' Format: ' + v('posterFormat') + '.';
    if (notes) p += '\n\n' + notes;
    p += bc_;

  } else if (type === 'infographic') {
    p  = 'Create an infographic for ' + bn;
    if (v('infographicTopic')) p += ': ' + v('infographicTopic');
    p += '.';
    if (v('infographicData')) p += '\n\nContent: ' + v('infographicData');
    if (notes) p += '\n\n' + notes;
    p += bc_;

  } else if (type === 'productshoots') {
    p  = 'Generate a professional product photograph';
    if (v('psProduct')) p += ' of ' + v('psProduct');
    p += '.';
    if (v('psStyle'))  p += '\nStyle: ' + v('psStyle');
    if (v('psGoal'))   p += ' | Goal: ' + v('psGoal');
    if (notes)         p += '\n\n' + notes;
    p += bc_;

  } else if (type === 'motiongraphics') {
    var dur   = v('mgDuration') || '5';
    var style = v('mgStyle')    || 'social';
    var mgn   = v('mgNotes')    || '';
    p  = 'Create a ' + dur + '-second ' + style + ' motion graphic for ' + bn + '.';
    if (mgn) p += '\n\nCreative direction: ' + mgn;
    p += bc_;

  } else if (type === 'ugc') {
    var script = v('ucCustomScript');
    if (script) {
      p = script;
    } else {
      p = 'Write a UGC-style 30-second video script for ' + bn + '.';
      if (v('ucContext')) p += '\n\n' + v('ucContext');
      p += bc_;
    }

  } else {
    p = 'Generate content for ' + bn + '.' + bc_;
  }

  return p.trim();
}

// ── Brand Core check list (for prompt-preview panel) ──────────

function _cfBCChecks(bc) {
  if (!bc) return [];
  var logos = bc.logos || {};
  var hasLogo = !!(
    (logos.primary   && logos.primary.url   && logos.primary.source   !== 'placeholder') ||
    (logos.icon      && logos.icon.url      && logos.icon.source      !== 'placeholder')
  );
  return [
    { label: 'Logo',              ok: hasLogo },
    { label: 'Brand Colors',      ok: !!(bc.colors && bc.colors.length > 0 || bc.primaryColor) },
    { label: 'Tone of Voice',     ok: !!(bc.toneOfVoice || bc.tone) },
    { label: 'Audience',          ok: !!(bc.audience || bc.aud) },
    { label: 'Messaging',         ok: !!bc.messaging },
    { label: 'Brand Personality', ok: !!bc.personality },
  ];
}

// ── State ─────────────────────────────────────────────────────
var _cfType      = null;
var _cfStep      = 0;
var _cfAnswers   = {};
var _cfTypingId  = null;

// ── Type label + icon map ─────────────────────────────────────
var CF_META = {
  image: {
    label: "Image",
    icon: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="16" height="16" rx="3.5"/><circle cx="7" cy="7" r="1.5"/><path d="M2 14l4.5-4.5 3.5 3.5 2.5-2.5 4 4"/></svg>'
  },
  text: {
    label: "Text",
    icon: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 6h14M3 10h9M3 14h11"/></svg>'
  },
  campaign: {
    label: "Campaign",
    icon: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14L6 6l3.5 5.5L12 8l4.5 7"/><circle cx="6" cy="6" r="1"/></svg>'
  },
  web: {
    label: "Web",
    icon: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="2" width="18" height="13" rx="2.5"/><path d="M1 6h18"/><path d="M4 4h.01M6.5 4h.01M9 4h.01"/><path d="M6 18h8M10 15v3"/></svg>'
  },
  ugc: {
    label: "UGC Creator",
    icon: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="4" width="12" height="12" rx="2.5"/><path d="M13.5 8L18 6v9l-4.5-2"/></svg>'
  },
  email: {
    label: "Email",
    icon: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3.5" width="17" height="13" rx="2.5"/><path d="M1.5 7l8.5 6 8.5-6"/></svg>'
  },
  deck: {
    label: "Presentation",
    icon: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="2" width="18" height="11" rx="2.5"/><path d="M5 7h10M5 10h7"/><path d="M7.5 17.5h5M10 13v4.5"/></svg>'
  },
  poster: {
    label: "Poster",
    icon: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="1.5" width="15" height="17" rx="2.5"/><rect x="5" y="4" width="10" height="7" rx="1"/><path d="M5 14h10M5 17h7"/></svg>'
  },
  infographic: {
    label: "Infographic",
    icon: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="7" width="4" height="10" rx="1"/><rect x="8" y="4" width="4" height="13" rx="1"/><rect x="15" y="1" width="4" height="16" rx="1"/></svg>'
  },
  productshoots: {
    label: "Product Shoots",
    icon: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3l2-2.5h4L14 5h3a2 2 0 0 1 2 2z"/><circle cx="10" cy="11" r="3.5"/></svg>'
  },
  motiongraphics: {
    label: "Motion Graphics",
    icon: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polygon points="3.5 2 16.5 10 3.5 18 3.5 2"/><path d="M16.5 10h3M16.5 6.5V3.5M16.5 16.5V13.5"/></svg>'
  },
};

// ── Open ──────────────────────────────────────────────────────
function openAIFlow(type, preseeded){
  _cfType    = type;
  _cfStep    = 0;
  // Accept pre-seeded answers from inspiration cards so later steps auto-advance
  _cfAnswers = preseeded || {};

  var meta  = CF_META[type] || CF_META.image;
  var icon  = document.getElementById("cfTypeIcon");
  var label = document.getElementById("cfTypeLabel");
  if(icon)  icon.innerHTML = meta.icon;
  if(label) label.textContent = meta.label;

  var creditPill = document.getElementById("cfCreditPill");
  if(creditPill && typeof CREDIT_COSTS !== "undefined"){
    var cost = CREDIT_COSTS[type] || 1;
    creditPill.textContent = cost + " Credit" + (cost !== 1 ? "s" : "");
    creditPill.className = "cf-credit-pill cf-credit-pill--" + type;
  }

  // Populate Brand Core bar
  var bcBar    = document.getElementById("cfBrandBar");
  var bcName   = document.getElementById("cfBrandBarName");
  var bcDetail = document.getElementById("cfBrandBarDetail");
  if(bcBar){
    var bc = (typeof S !== "undefined") ? S.brandCore : null;
    if(bc){
      if(bcName) bcName.textContent = bc.name || "Your Brand";
      var details = [];
      var tone = bc.toneOfVoice || (Array.isArray(bc.tone) ? bc.tone[0] : "");
      var aud  = bc.audience || bc.aud || "";
      var clrs = bc.colors || [];
      var primaryHex = clrs[0] ? (clrs[0].hex || "") : "";
      if(tone)       details.push(tone);
      if(primaryHex) details.push(primaryHex);
      if(aud)        details.push(aud);
      if(bcDetail) bcDetail.textContent = details.join(" · ");
      bcBar.style.display = "";
    } else {
      bcBar.style.display = "none";
    }
  }

  // Clear state
  var hist  = document.getElementById("cfHistory");
  var opts  = document.getElementById("cfOptions");
  var free  = document.getElementById("cfFreeInput");
  var qTxt  = document.getElementById("cfQuestionText");
  var qDesc = document.getElementById("cfQuestionDesc");
  if(hist)  hist.innerHTML = "";
  if(opts)  opts.innerHTML = "";
  if(free)  free.style.display  = "none";
  if(qTxt)  qTxt.textContent    = "";
  if(qDesc) qDesc.textContent   = "";

  // Reset progress
  _cfUpdateProgress(0);

  // Reset question block position
  var block = document.getElementById("cfQuestionBlock");
  if(block){
    block.style.transition = "none";
    block.style.opacity    = "0";
    block.style.transform  = "translateY(20px)";
  }

  // Show overlay
  var overlay = document.getElementById("cfOverlay");
  if(!overlay) return;
  overlay.style.display = "flex";
  overlay.style.opacity = "0";
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      overlay.style.opacity = "1";
      setTimeout(function(){ _cfShowStep(); }, 180);
    });
  });
}

// ── Close ─────────────────────────────────────────────────────
function closeAIFlow(){
  _cfStopTyping();
  var overlay = document.getElementById("cfOverlay");
  if(!overlay) return;
  overlay.style.transition = "opacity 0.25s ease";
  overlay.style.opacity = "0";
  setTimeout(function(){ overlay.style.display = "none"; }, 260);
}

// ── Render current step ───────────────────────────────────────
function _cfShowStep(){
  var steps = CF_FLOWS[_cfType];
  if(!steps) return;
  var step = steps[_cfStep];
  if(!step) return;

  // Auto-advance steps that are already answered by inspiration pre-fill.
  // Avatar-picker and voice-picker always show — user must make these choices.
  if(step.type !== "avatar-picker" && step.type !== "voice-picker" && _cfAnswers[step.key]){
    var preAns = _cfAnswers[step.key];
    _cfAppendHistory(step.q, String(preAns.label || preAns.val || "Set"));
    _cfStep++;
    // Skip conditional steps whose condition is unmet
    while(steps && _cfStep < steps.length){
      var ns = steps[_cfStep];
      if(ns && ns.conditional){
        var ca = _cfAnswers[ns.conditional];
        if(!ca || ca.val !== ns.conditionalVal){ _cfStep++; continue; }
      }
      break;
    }
    if(_cfStep >= steps.length){ _cfLaunch(); } else { _cfShowStep(); }
    return;
  }

  _cfUpdateProgress(_cfStep);

  var qEl   = document.getElementById("cfQuestionText");
  var dEl   = document.getElementById("cfQuestionDesc");
  var opts  = document.getElementById("cfOptions");
  var free  = document.getElementById("cfFreeInput");
  var block = document.getElementById("cfQuestionBlock");

  // Reset children
  if(opts)  { opts.innerHTML = ""; opts.style.opacity = "1"; opts.style.transform = "none"; opts.style.transition = "none"; }
  if(free)  { free.style.display = "none"; free.style.opacity = "1"; free.style.transform = "none"; }
  if(qEl)   qEl.textContent = "";
  if(dEl)   { dEl.textContent = ""; dEl.style.opacity = "0"; }

  // Slide block in
  if(block){
    block.style.transition = "none";
    block.style.opacity    = "0";
    block.style.transform  = "translateY(18px)";
    requestAnimationFrame(function(){
      block.style.transition = "opacity 0.35s ease, transform 0.35s ease";
      block.style.opacity    = "1";
      block.style.transform  = "translateY(0)";
    });
  }

  // Type the question text, then reveal desc + options
  setTimeout(function(){
    _cfTypeText(step.q, function(){
      if(dEl){
        dEl.textContent = step.desc || "";
        dEl.style.transition = "opacity 0.4s ease";
        dEl.style.opacity = "1";
      }
      setTimeout(function(){ _cfRenderOptions(step); }, 120);
    });
  }, 100);
}

// ── Typing animation ──────────────────────────────────────────
function _cfTypeText(text, onDone){
  _cfStopTyping();
  var el = document.getElementById("cfQuestionText");
  if(!el){ if(onDone) onDone(); return; }

  var i     = 0;
  var len   = text.length;
  // Scale speed: 1000ms for short, 1600ms for very long — feels deliberate
  var total = Math.max(900, Math.min(1800, len * 22));
  var delay = Math.round(total / len);

  el.textContent = "";
  el.classList.add("cf-typing");

  _cfTypingId = setInterval(function(){
    el.textContent = text.slice(0, i + 1);
    i++;
    if(i >= len){
      clearInterval(_cfTypingId);
      _cfTypingId = null;
      el.classList.remove("cf-typing");
      if(onDone) onDone();
    }
  }, delay);
}

function _cfStopTyping(){
  if(_cfTypingId){ clearInterval(_cfTypingId); _cfTypingId = null; }
  var el = document.getElementById("cfQuestionText");
  if(el) el.classList.remove("cf-typing");
}

// ── Render options ────────────────────────────────────────────
function _cfRenderOptions(step){
  var opts = document.getElementById("cfOptions");
  var free = document.getElementById("cfFreeInput");
  if(!opts) return;

  // ── Prompt preview — final step before generation ────────────
  if(step.type === "prompt-preview"){
    opts.className = "cf-options cf-preview-panel";

    var bc       = (typeof S !== "undefined") ? S.brandCore : null;
    var prompt   = _cfBuildPrompt(_cfType, _cfAnswers, bc);
    var checks   = _cfBCChecks(bc);
    var hasBC    = !!bc;
    var missing  = hasBC ? checks.filter(function(c){ return !c.ok; }).length : 0;

    // Brand Core Applied panel
    var panelHtml;
    if(!hasBC){
      panelHtml = '<div class="cf-pv-bc-panel cf-pv-bc-none">'
        + '<div class="cf-pv-bc-hdr">'
        + '<svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 1L.5 13h13z"/><path d="M7 6v4M7 11v.5"/></svg>'
        + ' No Brand Core set</div>'
        + '<p class="cf-pv-bc-sub">Add your Brand Core in Settings to personalise every generation.</p>'
        + '</div>';
    } else if(missing === 0){
      panelHtml = '<div class="cf-pv-bc-panel cf-pv-bc-ok">'
        + '<div class="cf-pv-bc-hdr">Brand Core Applied</div>'
        + '<div class="cf-pv-bc-checks">' + checks.map(function(c){
            return '<span class="cf-pv-bc-ck cf-pv-bc-ck-ok">'
              + '<svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>'
              + ' ' + _cfEsc(c.label) + '</span>';
          }).join('') + '</div>'
        + '</div>';
    } else {
      panelHtml = '<div class="cf-pv-bc-panel cf-pv-bc-partial">'
        + '<div class="cf-pv-bc-hdr">'
        + '<svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 1L.5 13h13z"/><path d="M7 6v4M7 11v.5"/></svg>'
        + ' Missing Brand Core information</div>'
        + '<div class="cf-pv-bc-checks">' + checks.map(function(c){
            if(c.ok){
              return '<span class="cf-pv-bc-ck cf-pv-bc-ck-ok">'
                + '<svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>'
                + ' ' + _cfEsc(c.label) + '</span>';
            }
            return '<span class="cf-pv-bc-ck cf-pv-bc-ck-miss">'
              + '<svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7"/></svg>'
              + ' ' + _cfEsc(c.label) + '</span>';
          }).join('') + '</div>'
        + '</div>';
    }

    // Logo Source selector (motion graphics only)
    var logoHtml = '';
    if(_cfType === 'motiongraphics'){
      var logos   = bc && bc.logos ? bc.logos : {};
      var logoUrl = (logos.primary && logos.primary.url && logos.primary.source !== 'placeholder' && logos.primary.url)
                 || (logos.icon    && logos.icon.url    && logos.icon.source    !== 'placeholder' && logos.icon.url)
                 || '';
      logoHtml = '<div class="cf-pv-logo-section">'
        + '<div class="cf-pv-logo-label">Logo Source</div>'
        + '<div class="cf-pv-logo-opts">';
      if(logoUrl){
        logoHtml += '<label class="cf-pv-logo-opt">'
          + '<input type="radio" name="cfLogoSrc" value="brand-logo" data-url="' + _cfEsc(logoUrl) + '">'
          + '<span class="cf-pv-logo-dot"></span>'
          + '<img src="' + _cfEsc(logoUrl) + '" class="cf-pv-logo-thumb" alt="">'
          + 'Use Brand Core Logo'
          + '</label>';
      } else {
        logoHtml += '<label class="cf-pv-logo-opt cf-pv-logo-opt-dis">'
          + '<input type="radio" name="cfLogoSrc" value="brand-logo" disabled>'
          + '<span class="cf-pv-logo-dot"></span>'
          + 'Use Brand Core Logo <span class="cf-pv-logo-hint">(add logo in Brand Core)</span>'
          + '</label>';
      }
      logoHtml += '<label class="cf-pv-logo-opt">'
        + '<input type="radio" name="cfLogoSrc" value="none" checked>'
        + '<span class="cf-pv-logo-dot"></span>'
        + 'No Logo'
        + '</label>'
        + '</div></div>';
    }

    opts.innerHTML = panelHtml
      + logoHtml
      + '<div class="cf-pv-prompt-wrap">'
      + '<div class="cf-pv-prompt-lbl">AI Prompt Preview'
      + '<span class="cf-pv-prompt-hint">Editable — changes apply to this generation</span></div>'
      + '<textarea class="cf-pv-ta" id="cfPreviewTa" rows="6">' + _cfEsc(prompt) + '</textarea>'
      + '</div>'
      + '<button class="cf-pv-gen-btn" onclick="cfLaunchFromPreview()">'
      + 'Generate '
      + '<svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7h10M8 3l4 4-4 4"/></svg>'
      + '</button>';

    opts.style.opacity = "0";
    opts.style.transform = "translateY(10px)";
    opts.style.transition = "none";
    requestAnimationFrame(function(){
      opts.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      opts.style.opacity   = "1";
      opts.style.transform = "translateY(0)";
    });
    return;
  }

  // ── Avatar picker — format tabs + real HeyGen thumbnails + ratio detection ──
  if(step.type === "avatar-picker"){
    if(free) free.style.display = "none";
    opts.className = "cf-options cf-avatar-grid-wrap";
    opts.innerHTML = '<div class="cf-avatar-loading">'
      + '<div class="spin" style="width:18px;height:18px;border-width:2px;margin:0 auto 12px;display:block"></div>'
      + '<span>Loading creators…</span></div>';
    opts.style.opacity   = "1";
    opts.style.transform = "none";

    var capturedStep  = step;
    var _cfActiveFmt = "landscape";  // locked to landscape — portrait/square coming later

    // Format filter — kept for future multi-format support
    function _applyFmtFilter(grid){
      grid.querySelectorAll(".cf-avatar-card").forEach(function(card){
        var ratio = card.dataset.ratio || "all";
        card.style.display = (ratio === "all" || ratio === _cfActiveFmt) ? "" : "none";
      });
    }

    // Ratio detection — runs in background, prepares data for future filtering
    function _detectRatios(avatars, cardMap, grid){
      avatars.slice(0, 50).forEach(function(avatar){
        var card = cardMap[avatar.avatar_id];
        if(!card || !avatar.preview_video_url) return;
        var vid  = document.createElement("video");
        var done = false;
        var timer = setTimeout(function(){
          if(done) return; done = true; vid.src = "";
        }, 5000);
        vid.addEventListener("loadedmetadata", function(){
          if(done) return; done = true; clearTimeout(timer);
          var w = vid.videoWidth, h = vid.videoHeight; vid.src = "";
          if(!w || !h) return;
          var r = w / h;
          card.dataset.ratio = r < 0.75 ? "vertical" : r > 1.4 ? "landscape" : "square";
          _applyFmtFilter(grid);
        });
        vid.addEventListener("error", function(){
          if(done) return; done = true; clearTimeout(timer); vid.src = "";
        });
        vid.preload = "metadata";
        vid.src = avatar.preview_video_url;
      });
    }

    SB.auth.getSession().then(function(s){
      var token = s && s.data && s.data.session && s.data.session.access_token;
      if(!token){ opts.innerHTML = '<p class="cf-avatar-err">Please sign in to browse creators.</p>'; return null; }
      return Promise.all([
        apiFetch("/api/ugc-avatars", { headers: { "Authorization": "Bearer " + token } }),
        apiFetch("/api/ugc-voices",  { headers: { "Authorization": "Bearer " + token } })
      ]);
    }).then(function(results){
      if(!results) return;
      var avatars = (results[0].ok && results[0].data && results[0].data.avatars) || [];
      var voices  = (results[1].ok && results[1].data && results[1].data.voices)   || [];

      var femaleVoice  = voices.find(function(v){ return (v.gender||"").toLowerCase() === "female"; });
      var maleVoice    = voices.find(function(v){ return (v.gender||"").toLowerCase() === "male";   });
      var defaultVoice = femaleVoice || maleVoice || voices[0] || {};

      if(!avatars.length){
        opts.innerHTML = "<p class=\"cf-avatar-err\">No creators found. Check your HeyGen API key.</p>";
        return;
      }

      opts.innerHTML = "";
      opts.className = "cf-options cf-avatar-grid-wrap";
      console.log("[UGC] Fetched", avatars.length, "avatars from HeyGen");

      // ── Format indicator (locked to Landscape) ─────────────────
      // Vertical and Square support coming in a future release.
      var fmtBar = document.createElement("div");
      fmtBar.className = "cf-fmt-bar";
      fmtBar.innerHTML =
        '<span class="cf-fmt-bar-label">Format</span>'
        + '<span class="cf-fmt-bar-active">'
        + '<span class="cf-fmt-bar-ratio">16:9</span>'
        + 'Cinematic Landscape'
        + '</span>'
        + '<span class="cf-fmt-bar-note">Vertical &amp; Square coming soon</span>';
      opts.appendChild(fmtBar);

      // ── Avatar grid ────────────────────────────────────────────
      var grid    = document.createElement("div");
      grid.className = "cf-avatar-grid";
      opts.appendChild(grid);

      var cardMap = {};

      avatars.forEach(function(avatar){
        var gender    = (avatar.gender || "").toLowerCase();
        var voiceObj  = gender === "female" ? (femaleVoice || defaultVoice)
                      : gender === "male"   ? (maleVoice   || defaultVoice)
                      : defaultVoice;
        var voiceId   = voiceObj.voice_id || "";
        var name      = avatar.avatar_name || avatar.avatar_id;
        var thumb     = avatar.preview_image_url || "";
        var videoUrl  = avatar.preview_video_url  || "";

        var card = document.createElement("button");
        card.type         = "button";
        card.className    = "cf-avatar-card";
        card.dataset.ratio = "all";  // classified async; all tabs show it until detected

        var thumbHtml = thumb
          ? '<img src="' + _cfEsc(thumb) + '" class="cf-avatar-thumb" loading="lazy" />'
          : '<div class="cf-avatar-thumb cf-avatar-nothumb"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>';

        card.innerHTML = thumbHtml
          + (videoUrl ? '<div class="cf-avatar-play-hint"></div>' : '')
          + '<span class="cf-avatar-name">' + _cfEsc(name) + '</span>';

        // ── Video hover preview ───────────────────────────────
        if(videoUrl && thumb){
          card.addEventListener("mouseenter", function(){
            if(card.querySelector("video.cf-avatar-thumb")) return;
            var img = card.querySelector("img.cf-avatar-thumb");
            if(!img) return;
            var vid = document.createElement("video");
            vid.src = videoUrl; vid.className = "cf-avatar-thumb";
            vid.autoplay = true; vid.muted = true;
            vid.loop = true; vid.playsInline = true;
            card.replaceChild(vid, img);
            vid.play().catch(function(){});
          });
          card.addEventListener("mouseleave", function(){
            var vid = card.querySelector("video.cf-avatar-thumb");
            if(!vid) return;
            var img = document.createElement("img");
            img.src = thumb; img.className = "cf-avatar-thumb"; img.loading = "lazy";
            card.replaceChild(img, vid);
          });
        }

        card.onclick = function(){
          grid.querySelectorAll(".cf-avatar-card").forEach(function(c){
            c.classList.remove("cf-avatar-selected"); c.disabled = true;
          });
          card.classList.add("cf-avatar-selected"); card.disabled = false;
          _cfAnswers[capturedStep.key] = {
            val:     avatar.avatar_id,
            label:   name,
            voiceId: voiceId,
            gender:  gender,
            format:  _cfActiveFmt,
          };
          console.log("[UGC] Avatar selected:", avatar.avatar_id,
            "| format:", _cfActiveFmt, "| voice:", voiceId);
          setTimeout(function(){ _cfAdvance(capturedStep, name); }, 340);
        };

        cardMap[avatar.avatar_id] = card;
        grid.appendChild(card);
      });

      // ── "Create Your Creator" stub ────────────────────────────
      var createCard = document.createElement("button");
      createCard.type          = "button";
      createCard.className     = "cf-avatar-card cf-avatar-create";
      createCard.dataset.ratio = "all";
      createCard.innerHTML =
        '<div class="cf-avatar-thumb cf-avatar-create-thumb">'
        + '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>'
        + '</div>'
        + '<span class="cf-avatar-name">Create Creator</span>';
      createCard.onclick = function(){
        if(typeof toast === "function") toast("Custom creator upload — coming soon", "info");
      };
      grid.appendChild(createCard);

      // ── Async ratio detection — runs in background ────────────
      // Detects video native aspect ratio, updates data-ratio, re-filters
      _detectRatios(avatars, cardMap, grid);

    }).catch(function(err){
      opts.innerHTML = '<p class="cf-avatar-err">Could not load creators: ' + _cfEsc(err.message) + '</p>';
    });
    return;
  }

  if(step.type === "textarea"){
    opts.innerHTML = "";
    if(free){
      var ta      = document.getElementById("cfTextarea");
      var skip    = document.getElementById("cfSkipBtn");
      var counter = document.getElementById("cfCharCounter");

      // Remove stale counter from previous step
      if(counter) counter.parentNode.removeChild(counter);

      if(ta){ ta.value = ""; ta.setAttribute("placeholder", step.placeholder || "Type here…"); ta.oninput = null; }
      if(skip) skip.style.display = step.optional ? "" : "none";

      // Inject live counter for steps with a character cap
      if(step.maxChars && ta){
        var ctr = document.createElement("div");
        ctr.id        = "cfCharCounter";
        ctr.className = "cf-char-counter";
        ctr.innerHTML = "0 / " + step.maxChars + " chars";
        ta.parentNode.insertBefore(ctr, ta.nextSibling);

        ta.oninput = function(){
          var len  = ta.value.length;
          var sec  = Math.round(len / 12);
          ctr.innerHTML = len + " / " + step.maxChars + " chars · ~" + sec + "s";
          ctr.className = "cf-char-counter"
            + (len > step.maxChars ? " cf-char-over" : len > step.maxChars * 0.8 ? " cf-char-warn" : "");
        };
      }

      free.style.display   = "";
      free.style.opacity   = "0";
      free.style.transform = "translateY(10px)";
      free.style.transition = "none";
      requestAnimationFrame(function(){
        free.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        free.style.opacity   = "1";
        free.style.transform = "translateY(0)";
      });
      if(ta) setTimeout(function(){ ta.focus(); }, 320);
    }
    return;
  }

  var isCard = step.options && step.options[0] && step.options[0].desc;
  opts.className = "cf-options" + (isCard ? " cf-opts-cards" : "");

  var html = "";
  if(isCard){
    (step.options || []).forEach(function(opt, i){
      html += '<button class="cf-opt-card" onclick="cfSelectOpt(' + i + ')">'
            + '<span class="cf-opt-card-label">' + _cfEsc(opt.label) + '</span>'
            + '<span class="cf-opt-card-desc">'  + _cfEsc(opt.desc)  + '</span>'
            + '</button>';
    });
  } else {
    // Pill options — staggered fade-in
    (step.options || []).forEach(function(opt, i){
      html += '<button class="cf-opt" style="animation-delay:' + (i * 45) + 'ms" '
            + 'onclick="cfSelectOpt(' + i + ')">'
            + _cfEsc(opt.label)
            + '</button>';
    });
  }
  opts.innerHTML = html;
  opts.style.opacity   = "0";
  opts.style.transform = "translateY(10px)";
  opts.style.transition = "none";
  requestAnimationFrame(function(){
    opts.style.transition = "opacity 0.28s ease, transform 0.28s ease";
    opts.style.opacity   = "1";
    opts.style.transform = "translateY(0)";
  });
}

// ── Option selected ───────────────────────────────────────────
function cfSelectOpt(idx){
  var steps = CF_FLOWS[_cfType];
  if(!steps) return;
  var step = steps[_cfStep];
  if(!step || !step.options) return;
  var opt = step.options[idx];
  if(!opt) return;

  // Visual feedback (supports both pill and card layouts)
  var btns = document.querySelectorAll("#cfOptions .cf-opt, #cfOptions .cf-opt-card");
  btns.forEach(function(b, i){ b.classList.toggle("cf-opt-selected", i === idx); });
  btns.forEach(function(b, i){ if(i !== idx) b.disabled = true; });

  _cfAnswers[step.key] = { val: opt.val, label: opt.label };
  setTimeout(function(){ _cfAdvance(step, opt.label); }, 340);
}

// ── Text submitted ────────────────────────────────────────────
function cfSubmitText(){
  var ta    = document.getElementById("cfTextarea");
  var val   = ta ? ta.value.trim() : "";
  var steps = CF_FLOWS[_cfType];
  if(!steps) return;
  var step  = steps[_cfStep];
  if(!step) return;
  if(step.maxChars && val.length > step.maxChars){
    if(typeof toast === "function") toast("Script too long — keep it under " + step.maxChars + " characters (~60 seconds)", "warn");
    return;
  }
  _cfAnswers[step.key] = { val: val, label: val ? val.slice(0, 48) + (val.length > 48 ? "…" : "") : "Added details" };
  _cfAdvance(step, _cfAnswers[step.key].label);
}

function cfSkipStep(){
  var steps = CF_FLOWS[_cfType];
  if(!steps) return;
  var step  = steps[_cfStep];
  if(!step) return;
  _cfAnswers[step.key] = { val: "", label: "Skipped" };
  _cfAdvance(step, "Skipped");
}

// ── Launch from prompt preview ────────────────────────────────
function cfLaunchFromPreview(){
  var ta = document.getElementById("cfPreviewTa");
  if(ta && ta.value.trim()) _cfAnswers._aiPrompt = { val: ta.value.trim(), label: "Custom prompt" };

  // Logo source — only relevant for motiongraphics
  var logoRadio = document.querySelector('input[name="cfLogoSrc"]:checked');
  if(logoRadio){
    _cfAnswers._logoSource = { val: logoRadio.value, url: logoRadio.dataset.url || "" };
  }

  _cfLaunch();
}

// ── Advance: move Q to history, show next ─────────────────────
function _cfAdvance(step, answerLabel){
  _cfStopTyping();

  var block = document.getElementById("cfQuestionBlock");
  var opts  = document.getElementById("cfOptions");
  var free  = document.getElementById("cfFreeInput");

  // Fade out options
  if(opts){ opts.style.transition = "opacity 0.15s ease"; opts.style.opacity = "0"; }
  if(free){ free.style.transition = "opacity 0.15s ease"; free.style.opacity = "0"; }

  setTimeout(function(){
    // Push to history
    _cfAppendHistory(step.q, answerLabel);

    // Slide question up and out
    if(block){
      block.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      block.style.opacity    = "0";
      block.style.transform  = "translateY(-14px)";
    }

    setTimeout(function(){
      _cfStep++;
      var steps = CF_FLOWS[_cfType];

      // Skip conditional steps whose condition is not met
      while(steps && _cfStep < steps.length){
        var nextStep = steps[_cfStep];
        if(nextStep && nextStep.conditional){
          var condAnswer = _cfAnswers[nextStep.conditional];
          if(!condAnswer || condAnswer.val !== nextStep.conditionalVal){
            _cfStep++;
            continue;
          }
        }
        break;
      }

      if(!steps || _cfStep >= steps.length){
        _cfLaunch();
        return;
      }

      // Reset everything for next step
      if(opts){ opts.innerHTML = ""; opts.style.opacity = "1"; opts.style.transform = "none"; }
      if(free){ free.style.display = "none"; free.style.opacity = "1"; free.style.transform = "none"; }

      _cfShowStep();
    }, 220);
  }, 160);
}

// ── Append answered question to history ───────────────────────
function _cfAppendHistory(question, answer){
  var hist = document.getElementById("cfHistory");
  if(!hist) return;

  var item = document.createElement("div");
  item.className = "cf-hist-item";
  item.innerHTML =
    '<span class="cf-hist-q">' + _cfEsc(question) + '</span>'
  + '<span class="cf-hist-sep">&#8250;</span>'
  + '<span class="cf-hist-a">' + _cfEsc(answer) + '</span>';

  hist.appendChild(item);
  item.style.opacity   = "0";
  item.style.transform = "translateY(-5px)";
  item.style.transition = "none";
  requestAnimationFrame(function(){
    item.style.transition = "opacity 0.28s ease, transform 0.28s ease";
    item.style.opacity   = "1";
    item.style.transform = "translateY(0)";
  });
  hist.scrollTop = hist.scrollHeight;
}

// ── Update progress bar ───────────────────────────────────────
function _cfUpdateProgress(stepIndex){
  var steps = CF_FLOWS[_cfType];
  var total = steps ? steps.length : 1;
  var step  = steps ? steps[stepIndex] : null;
  // Prompt-preview is the final checkpoint — show 100%
  var pct = (step && step.type === "prompt-preview") ? 100 : Math.round((stepIndex / total) * 100);
  var fill = document.getElementById("cfProgressFill");
  if(fill) fill.style.width = pct + "%";
}

// ── Launch builder with conversation answers ──────────────────
function _cfLaunch(){
  // Show a brief "generating" state in the overlay before closing
  var block = document.getElementById("cfQuestionBlock");
  var opts  = document.getElementById("cfOptions");
  var free  = document.getElementById("cfFreeInput");
  var fill  = document.getElementById("cfProgressFill");

  if(opts)  { opts.style.opacity = "0"; }
  if(free)  { free.style.display = "none"; }
  if(fill)  fill.style.width = "100%";

  if(block){
    block.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    block.style.opacity    = "0";
    block.style.transform  = "translateY(-10px)";
  }

  setTimeout(function(){
    // Show generating message
    var qEl   = document.getElementById("cfQuestionText");
    var dEl   = document.getElementById("cfQuestionDesc");
    var _typeName = (CF_META[_cfType] && CF_META[_cfType].label) || _cfType;
    if(qEl)   qEl.textContent = _cfType === "ugc" ? "Generating your UGC video…" : "Building your " + _typeName + "…";
    if(dEl)   dEl.textContent = _cfType === "ugc" ? "Submitting your brief to HeyGen." : "Sending your brief to ORIVEN AI.";

    if(block){
      block.style.transition = "none";
      block.style.opacity    = "0";
      block.style.transform  = "translateY(12px)";
      requestAnimationFrame(function(){
        block.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        block.style.opacity    = "1";
        block.style.transform  = "translateY(0)";
      });
    }

    setTimeout(function(){
      closeAIFlow();
      if(_cfType === "ugc"){
        _cfDispatchUGC();
      } else if(_cfType === "productshoots"){
        _cfDispatchProductShoots();
      } else if(_cfType === "motiongraphics"){
        _cfDispatchMotionGraphics();
      } else {
        _cfDispatch();
      }
    }, 520);
  }, 200);
}

// ── Transfer answers to S._builder and run generation ─────────
function _cfDispatch(){
  S._builderType = _cfType;
  if(!S._builder) S._builder = {};

  // Write all conversation answers into S._builder
  Object.keys(_cfAnswers).forEach(function(key){
    S._builder[key] = _cfAnswers[key].val;
  });

  // Fill defaults for fields builder expects that the conversation skips
  if(_cfType === "image"){
    if(!S._builder.imgFormat) S._builder.imgFormat = "1:1";
  } else if(_cfType === "campaign"){
    if(!S._builder.campCount) S._builder.campCount = "3";
  } else if(_cfType === "web"){
    if(!S._builder.webStyle)      S._builder.webStyle      = "modern";
    if(!S._builder.webAnimations) S._builder.webAnimations = "subtle";
    // Map website type → default sections
    var _webTypeSections = {
      "one-page":  ["hero","features","about","contact"],
      "portfolio": ["hero","showcase","about","contact"],
      "saas":      ["hero","features","testimonials","pricing","cta"],
      "ecommerce": ["hero","showcase","features","cta"],
      "agency":    ["hero","features","showcase","testimonials","contact"],
      "landing":   ["hero","benefits","cta"]
    };
    var _wt = S._builder.webType || "saas";
    S._builder._webTypeDefaultSections = _webTypeSections[_wt] || ["hero","features","cta"];
  } else if(_cfType === "email"){
    if(!S._builder.emailType) S._builder.emailType = "newsletter";
  } else if(_cfType === "deck"){
    if(!S._builder.deckSlides) S._builder.deckSlides = "10";
  } else if(_cfType === "poster"){
    if(!S._builder.posterType) S._builder.posterType = "product";
  }

  // Set up builder page (matches openBuilder() setup)
  var pill     = document.getElementById("flowBrandPill");
  var pillName = document.getElementById("flowBrandName");
  if(pill){
    if(S.brandCore && S.brandCore.name){
      pill.style.display = "";
      if(pillName) pillName.textContent = S.brandCore.name;
    } else {
      pill.style.display = "none";
    }
  }

  var resultWrap = document.getElementById("builderResultWrap");
  if(resultWrap) resultWrap.style.display = "none";
  S._lastBuilderResult = null;

  // Initialize S._flow so _flowGenerate() doesn't crash on S._flow.answers
  S._flow = { type: _cfType, stepIndex: 0, answers: {}, activeSteps: [] };

  // Navigate then trigger generation (web shows brand confirm; others auto-generate)
  navigate("builder");
  if(_cfType === "web"){
    setTimeout(function(){ _showWebBrandConfirm(); }, 90);
  } else {
    setTimeout(function(){ _flowGenerate(); }, 90);
  }
}

// ── UGC flow dispatch — opens result overlay + triggers generation ──
function _cfDispatchUGC(){
  var a = _cfAnswers;

  _ucScriptMode  = (a.ucScriptMode && a.ucScriptMode.val) || "ai";
  _ucVideoFormat = (a.ucAvatar     && a.ucAvatar.format)   || "vertical";
  _ucAdFeeling   = (a.ucAdFeeling  && a.ucAdFeeling.val)  || "viral";

  // Avatar is now directly selected by the user from real HeyGen data
  var avatarAnswer = a.ucAvatar;
  if(avatarAnswer && avatarAnswer.val){
    _ucSelectedCreator = {
      id:       "custom",
      label:    avatarAnswer.label   || "Creator",
      avatarId: avatarAnswer.val,
      voiceId:  avatarAnswer.voiceId || "",
      background: null,
    };
  } else {
    _ucSelectedCreator = null;
  }
  // Use avatar's natural built-in scene — no separate background override
  _ucSelectedBg = null;

  // Reset video state
  _ucActiveId = null;
  if(typeof _ucPollTimer !== "undefined" && _ucPollTimer){
    clearInterval(_ucPollTimer); _ucPollTimer = null;
  }

  // Clear result UI
  var statusWrap = document.getElementById("ucStatusWrap");
  var videoWrap  = document.getElementById("ucVideoWrap");
  var retryRow   = document.getElementById("ucRetryRow");
  var newRow     = document.getElementById("ucNewRow");
  if(statusWrap) statusWrap.innerHTML = "";
  if(videoWrap)  videoWrap.style.display  = "none";
  if(retryRow)   retryRow.style.display   = "none";
  if(newRow)     newRow.style.display     = "none";

  // Open the result overlay
  var overlay = document.getElementById("ucOverlay");
  if(overlay){
    overlay.style.display    = "flex";
    overlay.style.opacity    = "0";
    overlay.style.transition = "none";
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        overlay.style.transition = "opacity 0.25s ease";
        overlay.style.opacity    = "1";
      });
    });
  }

  // Trigger generation after overlay is visible
  setTimeout(function(){
    if(typeof ucGenerateFromFlow === "function") ucGenerateFromFlow(a);
  }, 280);
}

// ── Product Shoots dispatch — opens result overlay + triggers generation ──
function _cfDispatchProductShoots(){
  var a = _cfAnswers;

  var statusWrap = document.getElementById("psStatusWrap");
  var resultWrap = document.getElementById("psResultWrap");
  var retryRow   = document.getElementById("psRetryRow");
  var newRow     = document.getElementById("psNewRow");
  if(statusWrap) statusWrap.innerHTML      = "";
  if(resultWrap) resultWrap.style.display  = "none";
  if(retryRow)   retryRow.style.display    = "none";
  if(newRow)     newRow.style.display      = "none";

  var overlay = document.getElementById("psOverlay");
  if(overlay){
    overlay.style.display    = "flex";
    overlay.style.opacity    = "0";
    overlay.style.transition = "none";
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        overlay.style.transition = "opacity 0.25s ease";
        overlay.style.opacity    = "1";
      });
    });
  }

  setTimeout(function(){
    if(typeof psGenerateFromFlow === "function") psGenerateFromFlow(a);
  }, 280);
}

// ── Motion Graphics dispatch — opens stub overlay + passes answers ──
function _cfDispatchMotionGraphics(){
  var a = _cfAnswers;

  var overlay = document.getElementById("mgOverlay");
  if(overlay){
    overlay.style.display    = "flex";
    overlay.style.opacity    = "0";
    overlay.style.transition = "none";
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        overlay.style.transition = "opacity 0.25s ease";
        overlay.style.opacity    = "1";
      });
    });
  }

  // Resolve logo URL from the prompt-preview selection
  var logoSrc = a._logoSource || {};
  var logoUrl = (logoSrc.val === 'brand-logo' && logoSrc.url) ? logoSrc.url : '';
  var customPrompt = (a._aiPrompt && a._aiPrompt.val) ? a._aiPrompt.val : '';

  setTimeout(function(){
    if(typeof mgGenerateFromFlow === "function") mgGenerateFromFlow(a, { logoUrl: logoUrl, customPrompt: customPrompt });
  }, 280);
}

// ── HTML escape ───────────────────────────────────────────────
function _cfEsc(s){
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
