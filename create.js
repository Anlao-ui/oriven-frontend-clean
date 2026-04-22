// ═══ CREATE PAGE ══════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// IMAGE — type / format definitions (used by prompt builders)
// ════════════════════════════════════════════════════════════════

var IMG_TYPES = {
  visual: {
    label: "Visuals",
    formats: [
      { id:"square",   label:"Square",     ratio:"1:1",  hint:"1024×1024" },
      { id:"wide",     label:"Widescreen", ratio:"16:9", hint:"1792×1024" },
      { id:"portrait", label:"Portrait",   ratio:"3:4",  hint:"1024×1792" }
    ],
    rules: "Create a premium, editorial brand visual. Composition must be deliberate and strong — clear focal point, intentional use of negative space. Colour palette must reflect the brand identity provided. No text overlays unless explicitly requested. Lighting must be purposeful. The output must look like a professional brand shoot or high-end design asset."
  },
  poster: {
    label: "Posters",
    formats: [
      { id:"a4",     label:"A4 Poster",     ratio:"1:1.41", hint:"Portrait" },
      { id:"a3",     label:"A3 Poster",     ratio:"1:1.41", hint:"Portrait" },
      { id:"square", label:"Square Poster", ratio:"1:1",    hint:"1024×1024" }
    ],
    rules: "Create a bold, typographically strong poster with a clear, dominant visual hierarchy. High-contrast, intentional colour blocking. Structured, impactful layout that feels like professional print design."
  },
  social: {
    label: "Social Media",
    formats: [
      { id:"ig_post",  label:"Instagram Post",    ratio:"1:1",  hint:"1024×1024"  },
      { id:"ig_story", label:"Instagram Story",   ratio:"9:16", hint:"1024×1792"  },
      { id:"tiktok",   label:"TikTok / Reel",     ratio:"9:16", hint:"1024×1792"  },
      { id:"yt_thumb", label:"YouTube Thumbnail", ratio:"16:9", hint:"1792×1024"  },
      { id:"ad_45",    label:"Ad Creative",       ratio:"4:5",  hint:"1024×1024"  }
    ],
    rules: "Create a scroll-stopping social media design that commands attention immediately. Bold colour, strong contrast, single dominant visual element. Clean and intentional — never two competing focal points."
  }
};

// ════════════════════════════════════════════════════════════════
// SIZE RESOLUTION
// DALL-E 3 ONLY supports: 1024x1024 | 1024x1792 | 1792x1024
// ════════════════════════════════════════════════════════════════

function _ratioToDallESize(ratio){
  if(ratio === "16:9")   return "1792x1024";
  if(ratio === "9:16")   return "1024x1792";
  if(ratio === "3:4")    return "1024x1792";
  if(ratio === "1:1.41") return "1024x1792";
  return "1024x1024";
}

// ── Color formatter — handles {name,hex} objects or plain strings ──
function _formatBrandColors(colors){
  if(!colors || !colors.length) return null;
  return colors.map(function(c){
    if(c && typeof c === "object"){
      var str = (c.name || "").trim();
      if(c.hex) str += (str ? " " : "") + c.hex;
      return str || null;
    }
    return String(c) || null;
  }).filter(Boolean).join(", ");
}


// ════════════════════════════════════════════════════════════════
// ADS — format definitions
// ════════════════════════════════════════════════════════════════

var ADS_FORMATS = {
  meta_feed: { label:"Meta Feed Ad",       ratio:"4:5",  hint:"4:5",          platform:"Meta — Facebook / Instagram Feed",   rules:"High-converting Meta feed ad. Focal point in the top two-thirds. Strong contrast, single clear headline, urgent CTA." },
  square:    { label:"Square Ad",          ratio:"1:1",  hint:"1:1",          platform:"Meta — Facebook / Instagram Square", rules:"Compact, balanced square ad. Readable and impactful at a glance. Versatile and clean." },
  story:     { label:"Story / Reel Ad",    ratio:"9:16", hint:"9:16 vertical", platform:"Instagram / Facebook Story & Reel",  rules:"Full-screen vertical story ad. Impact in the first 2 seconds. Bold visual or headline at top. Brand and CTA prominent." },
  tiktok:    { label:"TikTok Ad",          ratio:"9:16", hint:"9:16 vertical", platform:"TikTok",                             rules:"Vertical TikTok ad — native, authentic, energetic. Not polished-corporate. Hook leads. Brand integrated, not plastered." },
  youtube:   { label:"YouTube Ad",         ratio:"16:9", hint:"16:9 widescreen",platform:"YouTube",                           rules:"Cinematic widescreen YouTube ad. Opening frame justifies staying past skip. Strong horizontal composition, premium feel." }
};

function adsSelectFormat(fmtId){
  S._adsFormat = fmtId;
  document.querySelectorAll("#adsFormatPills .img-pill").forEach(function(btn){
    btn.classList.toggle("active", btn.dataset.afmt === fmtId);
  });
}


// ════════════════════════════════════════════════════════════════
// CAMPAIGN — pack definitions
// ════════════════════════════════════════════════════════════════

var CAMPAIGN_PACKS = {
  meta:     { label:"Meta Campaign Pack",      hint:"Feed · Story · Square", assets:[{label:"Feed Asset",ratio:"4:5",purpose:"awareness",platform:"Meta Feed"},{label:"Story Asset",ratio:"9:16",purpose:"engagement",platform:"Instagram Story"},{label:"Square Retargeting",ratio:"1:1",purpose:"retargeting",platform:"Meta Square"}], rules:"Cohesive Meta pack. 4:5 bold scroll-stopper. 9:16 full-screen native. 1:1 conversion-focused. Unified visual language." },
  social:   { label:"Social Launch Pack",      hint:"Story · Post · Thumb",  assets:[{label:"Story/Reel",ratio:"9:16",purpose:"awareness",platform:"Instagram Story/Reel"},{label:"Feed Post",ratio:"1:1",purpose:"engagement",platform:"Instagram Feed"},{label:"YouTube Thumbnail",ratio:"16:9",purpose:"conversion",platform:"YouTube"}], rules:"Social launch pack. 9:16 leads with maximum energy. 1:1 deepens with brand storytelling. 16:9 click-worthy thumbnail." },
  vertical: { label:"Vertical Content Pack",   hint:"Reel · TikTok",         assets:[{label:"Instagram Reel",ratio:"9:16",purpose:"engagement",platform:"Instagram Reel"},{label:"TikTok Content",ratio:"9:16",purpose:"awareness",platform:"TikTok"}], rules:"Vertical content pack. Instagram Reel: polished, brand-aligned. TikTok: native, organic, energetic." },
  full:     { label:"Full Campaign Pack",       hint:"4 formats",             assets:[{label:"Feed Asset",ratio:"4:5",purpose:"awareness",platform:"Meta Feed"},{label:"Story/Reel Asset",ratio:"9:16",purpose:"engagement",platform:"Story/Reel"},{label:"Square Asset",ratio:"1:1",purpose:"retargeting",platform:"Meta/Instagram"},{label:"YouTube/Widescreen",ratio:"16:9",purpose:"conversion",platform:"YouTube"}], rules:"Full funnel pack. 4:5 awareness. 9:16 engagement. 1:1 retargeting. 16:9 conversion. Rigid consistency across all four." }
};

function campaignSelectPack(packId){
  S._campPack = packId;
  document.querySelectorAll("#campPackPills .img-pill").forEach(function(btn){
    btn.classList.toggle("active", btn.dataset.cpack === packId);
  });
}


// ════════════════════════════════════════════════════════════════
// VIDEO — format definitions and prompt builder (chat-based)
// ════════════════════════════════════════════════════════════════

var VIDEO_FORMATS = {
  short_vertical: { label:"Short Vertical Video", ratio:"9:16", duration:"15–30 seconds", hint:"9:16 · 15–30s", rules:"Hook in first 2 seconds. Structure: Hook → Tension → Solution → Brand → CTA. Works with sound off." },
  standard_ad:    { label:"Standard Video Ad",     ratio:"16:9", duration:"15–30 seconds", hint:"16:9 · 15–30s", rules:"First 5 seconds must justify continued viewing. Structure: Hook → Build → Solution → CTA. Cinematic and brand-aligned." },
  square_promo:   { label:"Square Promo Video",    ratio:"1:1",  duration:"15–30 seconds", hint:"1:1 · 15–30s",  rules:"Designed for 1:1 — all key elements centred. Structure: Reveal → Key Benefit → Brand → CTA. Feed-optimised." },
  hook_bumper:    { label:"Hook / Bumper Video",   ratio:"Any",  duration:"~6 seconds",    hint:"Any format · 6s", rules:"Full message in the first frame. Single visual → Brand → CTA. No build-up. No wasted frames." },
  tiktok_reel:    { label:"TikTok / Reel Video",   ratio:"9:16", duration:"15–60 seconds", hint:"9:16 · 15–60s",  rules:"Hook is the most interesting moment — lead with it. Native tone: direct, energetic, real. Brand integrated organically." }
};

function videoSelectFormat(fmtId){
  S._vidFormat = fmtId;
  document.querySelectorAll("#vidFormatPills .img-pill").forEach(function(btn){
    btn.classList.toggle("active", btn.dataset.vfmt === fmtId);
  });
  var inp = document.getElementById("cwsInput");
  if(inp){
    var fmt = VIDEO_FORMATS[fmtId];
    if(fmt) inp.placeholder = "Describe the video — e.g. 'A " + fmt.duration + " " + fmt.label.toLowerCase() + " for our product launch'";
  }
}

function buildVideoPrompt(userDesc){
  var fmtId = S._vidFormat || "short_vertical";
  var fmt   = VIDEO_FORMATS[fmtId] || VIDEO_FORMATS.short_vertical;
  var bc    = S.brandCore;
  var parts = [];
  parts.push("VIDEO FORMAT: " + fmt.label + " — Aspect ratio: " + fmt.ratio + " — Duration: " + fmt.duration + ".");
  parts.push("VIDEO RULES (non-negotiable): " + fmt.rules);
  parts.push("VIDEO BRIEF: " + userDesc);
  if(bc && bc.name){
    var bLines = ["BRAND IDENTITY:"];
    bLines.push("Brand: " + bc.name);
    var cs = _formatBrandColors(bc.colors);
    if(cs) bLines.push("Colours: " + cs);
    if(bc.tone)     bLines.push("Tone: " + (Array.isArray(bc.tone) ? bc.tone.join(", ") : bc.tone));
    if(bc.audience) bLines.push("Audience: " + bc.audience);
    if(bc.style)    bLines.push("Style: " + bc.style);
    if(bc.promise)  bLines.push("Brand promise: " + bc.promise);
    parts.push(bLines.join("\n"));
  }
  parts.push("OUTPUT STRUCTURE: Generate a complete production-ready brief:\nTITLE:\nCONCEPT:\nTARGET AUDIENCE:\nHOOK:\nSCENES: (numbered)\nVOICEOVER / SCRIPT:\nVISUAL STYLE:\nEDITING STYLE:\nCTA:\n\nMake every section specific, actionable, and production-ready.");
  return parts.join("\n\n");
}


// ════════════════════════════════════════════════════════════════
// TEXT — type definitions (used by builder)
// ════════════════════════════════════════════════════════════════

var TEXT_TYPES = {
  headlines:    { label:"Headlines",            placeholder:"What is the headline for?",                    rules:"Generate 5 distinct headline options. Sharp, specific, benefit-forward. No 'Introducing' or 'Welcome to'. Vary angle: benefit, emotion, urgency, curiosity, authority." },
  body_copy:    { label:"Body Copy",            placeholder:"What is the copy for?",                        rules:"Professional brand body copy. Open with the most compelling idea. Short paragraphs. No filler, no clichés, no 'passionate' or 'dedicated'. End with a strong directional statement." },
  captions:     { label:"Captions",             placeholder:"Describe the post and context",                rules:"3 distinct captions at different tonal registers. Strong first line (hooks before 'more' cutoff). Natural, direct language. Clear CTA or invitation. 3–5 hashtags at end of each." },
  hooks:        { label:"Hooks",                placeholder:"What context are these hooks for?",            rules:"6 distinct hooks. Each must land in 2–3 seconds. Formats: bold claim, provocative question, surprising stat, direct address, pattern interrupt, story opener. Every word counts." },
  product_desc: { label:"Product Description",  placeholder:"Describe the product",                         rules:"Lead with primary benefit, not the product name. Specific, sensory language. Structure: benefit opening → 2–3 features as prose → brand promise. No 'high quality' or generic claims." },
  ad_copy:      { label:"Ad Copy",              placeholder:"Describe the ad campaign and offer",           rules:"3 variants with different angles. Each: Headline (max 8 words), Primary Text (2–3 sentences), CTA (max 4 words). Angle 1: benefit-led. Angle 2: urgency/scarcity. Angle 3: social proof/authority." }
};

function textSelectType(ttype){
  S._txtType = ttype;
  document.querySelectorAll("#txtTypePills .img-pill").forEach(function(btn){
    btn.classList.toggle("active", btn.dataset.ttype === ttype);
  });
  var def = TEXT_TYPES[ttype];
  if(!def) return;
  var inp = document.getElementById("cwsInput");
  if(inp) inp.placeholder = def.placeholder;
}


// ════════════════════════════════════════════════════════════════
// BRAND ASSISTANT — prompt builder + personalized starters
// (chat-based, unchanged)
// ════════════════════════════════════════════════════════════════

function buildAssistantPrompt(userMsg){
  var bc = S.brandCore;
  var parts = [];
  if(bc && bc.name){
    var ctx = "BRAND CONTEXT:\n";
    ctx += "Brand name: " + bc.name + "\n";
    if(bc.promise)  ctx += "Brand promise: " + bc.promise + "\n";
    if(bc.mission)  ctx += "Mission: " + bc.mission + "\n";
    if(bc.vision)   ctx += "Vision: " + bc.vision + "\n";
    if(bc.tone)     ctx += "Tone of voice: " + (Array.isArray(bc.tone) ? bc.tone.join(", ") : bc.tone) + "\n";
    if(bc.audience) ctx += "Target audience: " + bc.audience + "\n";
    if(bc.style)    ctx += "Visual style: " + bc.style + "\n";
    if(bc.diff)     ctx += "Positioning: " + bc.diff + "\n";
    var cs = _formatBrandColors(bc.colors);
    if(cs)          ctx += "Brand colors: " + cs + "\n";
    if(bc.wordsUse   && bc.wordsUse.length)   ctx += "Words to use: "   + bc.wordsUse.join(", ")   + "\n";
    if(bc.wordsAvoid && bc.wordsAvoid.length) ctx += "Words to avoid: " + bc.wordsAvoid.join(", ") + "\n";
    parts.push(ctx.trim());
  }
  parts.push("USER MESSAGE: " + userMsg);
  return parts.join("\n\n");
}

function _buildAssistantStarters(bc){
  if(!bc || !bc.name){
    return [
      "How can I make my brand look more premium and trustworthy to my audience?",
      "What would make my brand's tone of voice feel more distinct and memorable?",
      "How can I improve my brand's visual consistency across platforms?"
    ];
  }
  var name     = bc.name;
  var tone     = bc.tone     ? bc.tone     : "professional";
  var audience = bc.audience ? bc.audience : "my target audience";
  var style    = bc.style    ? bc.style    : "my current visual direction";
  return [
    "How can I make " + name + " look more premium and distinctive to " + audience + "? What specific changes would have the biggest impact?",
    "My brand tone is " + tone + " — how can I push this further to make " + name + " more memorable and consistent?",
    "Looking at " + style + " as my visual direction, what would make " + name + " stand out more clearly in my market?"
  ];
}

function assistantFill(text){
  var inp = document.getElementById("cwsInput");
  if(!inp) return;
  inp.value = text;
  inp.dispatchEvent(new Event("input"));
  inp.focus();
  inp.setSelectionRange(inp.value.length, inp.value.length);
}


// ════════════════════════════════════════════════════════════════
// CREATE TYPES
// ════════════════════════════════════════════════════════════════

var CREATE_TYPES = {
  image:     { label:"Image",           outType:"poster",   placeholder:"Describe the visual",                                                                    icon:"<path d='M3 3h10v10H3zM13 8l4-3v8l-4-3'/><circle cx='6.5' cy='6.5' r='1.5'/>" },
  text:      { label:"Text",            outType:"copy",     placeholder:"Describe the copy",                                                                      icon:"<path d='M3 5h10M3 9h7M3 13h9'/>" },
  video:     { label:"Video",           outType:"copy",     placeholder:"Describe the video — e.g. 'A 15-second product launch video for Instagram Reels'",       icon:"<rect x='2' y='4' width='10' height='10' rx='2'/><path d='M12 7l4-2v8l-4-2'/>" },
  ads:       { label:"Ads",             outType:"ad_copy",  placeholder:"Describe the ad",                                                                        icon:"<path d='M2 5h12v8H2z'/><path d='M14 7l2-1v6l-2-1'/>" },
  campaign:  { label:"Campaign",        outType:"campaign", placeholder:"Describe the campaign",                                                                  icon:"<path d='M2 13L5 5l4 5 3-4 4 7'/><circle cx='5' cy='5' r='1'/>" },
  ideas:     { label:"Ideas",           outType:"headline", placeholder:"Describe what you need ideas for — e.g. 'Content ideas for a sustainable fashion brand'", icon:"<circle cx='8' cy='7' r='4'/><path d='M8 11v3M6 14h4'/>" },
  assistant: { label:"Brand Assistant", outType:"copy",     placeholder:"Ask your Brand Assistant anything…",                                                     icon:"<path d='M8 1L10 6H15L11 9L12.5 14L8 11L3.5 14L5 9L1 6H6Z'/>" }
};

var CWS_CFG_MAP = {
  video: "vidCfg"
};

var CWS_ALL_CFGS = ["imgCfg", "adsCfg", "campCfg", "vidCfg", "txtCfg"];


// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
//  STRUCTURED BUILDER SYSTEM
//  Used by: Image, Text, Ads, Campaign
//  Brand Assistant, Video, Ideas remain chat-based
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════

// ── Pill selector helpers ─────────────────────────────────────

function _bSection(label, stateKey, options, defaultVal){
  return '<div class="builder-section">'
    + '<div class="builder-lbl">' + label + '</div>'
    + _bPills(stateKey, options, defaultVal)
    + '</div>';
}

function _bPills(stateKey, options, defaultVal){
  var current = (S._builder && S._builder[stateKey] != null)
    ? S._builder[stateKey]
    : defaultVal;
  return '<div class="b-pills">'
    + options.map(function(opt){
        return '<button class="b-pill' + (opt.val === current ? " active" : "") + '"'
          + ' data-val="' + opt.val + '"'
          + ' onclick="bPick(\'' + stateKey + '\',\'' + opt.val + '\',this)">'
          + opt.label
          + '</button>';
      }).join("")
    + '</div>';
}

function bPick(stateKey, val, btn){
  if(!S._builder) S._builder = {};
  S._builder[stateKey] = val;
  if(btn && btn.parentNode){
    btn.parentNode.querySelectorAll(".b-pill").forEach(function(p){
      p.classList.toggle("active", p === btn);
    });
  }
}

// ── Subject pill picker — shows/hides model description row ───
function bPickSubject(val, btn){
  bPick("imgSubject", val, btn);
  var row = document.getElementById("imgModelDescRow");
  if(row) row.style.display = (val === "person") ? "" : "none";
}

// ── Reference image helpers ────────────────────────────────────
function _imgRefAreaHtml(){
  var hasRef = S._builder && S._builder.imgRefData;
  if(hasRef){
    return '<div class="img-ref-preview-wrap">'
      + '<img src="' + S._builder.imgRefData + '" class="img-ref-thumb" alt="Reference">'
      + '<div class="img-ref-info">'
      + '<span class="img-ref-label">Reference uploaded</span>'
      + '<button class="btn btn-g btn-sm" onclick="_imgRefRemove()">Remove</button>'
      + '</div></div>';
  }
  return '<div class="img-ref-upload" onclick="_imgRefUpload()" role="button" tabindex="0">'
    + '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18">'
    + '<path d="M10 13V3M6 7l4-4 4 4" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M3 14v1a2 2 0 002 2h10a2 2 0 002-2v-1" opacity=".45" stroke-linecap="round"/>'
    + '</svg>'
    + '<span>Upload reference image</span>'
    + '<span class="img-ref-hint">Style, mood, product, or inspiration</span>'
    + '</div>';
}

function _imgRefUpload(){
  var input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,image/gif";
  input.onchange = function(e){
    var file = e.target.files[0];
    if(!file) return;
    if(file.size > 8 * 1024 * 1024){ toast("Reference image must be under 8 MB","warn"); return; }
    var reader = new FileReader();
    reader.onload = function(ev){
      if(!S._builder) S._builder = {};
      S._builder.imgRefData = ev.target.result;
      var area = document.getElementById("imgRefArea");
      if(area) area.innerHTML = _imgRefAreaHtml();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function _imgRefRemove(){
  if(!S._builder) return;
  S._builder.imgRefData = null;
  var area = document.getElementById("imgRefArea");
  if(area) area.innerHTML = _imgRefAreaHtml();
}


// ── Render controls for each builder type ────────────────────

function _renderBuilderControls(type){
  if(type === "image"){
    return _bSection("Purpose", "imgPurpose", [
      {val:"opening_post", label:"Opening Post"},
      {val:"announcement", label:"Announcement"},
      {val:"promotion",    label:"Promotion"},
      {val:"brand_intro",  label:"Brand Introduction"},
      {val:"ad_creative",  label:"Ad Creative"},
      {val:"custom",       label:"Custom"}
    ], "opening_post")

    + '<div class="builder-section">'
      + '<div class="builder-lbl">Headline <span class="builder-req">required</span></div>'
      + '<input class="inp" id="imgHeadline" placeholder="e.g. Clarity starts here." autocomplete="off">'
      + '</div>'

    + '<div class="builder-section">'
      + '<div class="builder-lbl">Subtext <span class="builder-opt">optional</span></div>'
      + '<input class="inp" id="imgSubtext" placeholder="Supporting line or description" autocomplete="off">'
      + '</div>'

    + '<div class="builder-section">'
      + '<div class="builder-lbl">CTA <span class="builder-opt">optional</span></div>'
      + '<input class="inp" id="imgCta" placeholder="e.g. Get started \u2192" autocomplete="off">'
      + '</div>'

    + _bSection("Text Style", "imgTextStyle", [
      {val:"bold",      label:"Bold"},
      {val:"minimal",   label:"Minimal"},
      {val:"editorial", label:"Editorial"},
      {val:"clean",     label:"Clean"},
      {val:"premium",   label:"Premium"}
    ], "clean")

    + _bSection("Visual Style", "imgVisualStyle", [
      {val:"abstract",  label:"Abstract"},
      {val:"product",   label:"Product"},
      {val:"lifestyle", label:"Lifestyle"},
      {val:"minimal",   label:"Minimal"},
      {val:"editorial", label:"Editorial"}
    ], "abstract")

    + _bSection("Format", "imgFormat", [
      {val:"1:1",  label:"1:1 Square"},
      {val:"4:5",  label:"4:5 Portrait"},
      {val:"9:16", label:"9:16 Vertical"},
      {val:"16:9", label:"16:9 Wide"}
    ], "1:1");
  }

  if(type === "text"){
    return _bSection("Content Type", "txtType", [
      {val:"headlines",    label:"Headline"},
      {val:"body_copy",    label:"Body Copy"},
      {val:"captions",     label:"Caption"},
      {val:"hooks",        label:"Hook"},
      {val:"product_desc", label:"Product Desc"},
      {val:"ad_copy",      label:"Ad Copy"}
    ], "headlines")
    + _bSection("Tone", "txtTone", [
      {val:"brandcore",      label:"BrandCore Default"},
      {val:"professional",   label:"Professional"},
      {val:"conversational", label:"Conversational"},
      {val:"bold",           label:"Bold"},
      {val:"playful",        label:"Playful"},
      {val:"authoritative",  label:"Authoritative"}
    ], "brandcore")
    + _bSection("Length", "txtLen", [
      {val:"short",  label:"Short"},
      {val:"medium", label:"Medium"},
      {val:"long",   label:"Long"}
    ], "medium");
  }

  if(type === "ads"){
    return _bSection("Platform", "adsPlatform", [
      {val:"meta",      label:"Meta"},
      {val:"instagram", label:"Instagram"},
      {val:"tiktok",    label:"TikTok"},
      {val:"youtube",   label:"YouTube"}
    ], "meta")
    + _bSection("Format", "adsFormat", [
      {val:"feed",   label:"Feed"},
      {val:"story",  label:"Story"},
      {val:"reel",   label:"Reel"},
      {val:"square", label:"Square"}
    ], "feed")
    + _bSection("Goal", "adsGoal", [
      {val:"awareness",  label:"Awareness"},
      {val:"engagement", label:"Engagement"},
      {val:"conversion", label:"Conversion"}
    ], "awareness")
    + _bSection("Creative Angle", "adsAngle", [
      {val:"problem",         label:"Problem / Solution"},
      {val:"aspiration",      label:"Aspiration"},
      {val:"urgency",         label:"Urgency"},
      {val:"transformation",  label:"Transformation"},
      {val:"social_proof",    label:"Social Proof"}
    ], "problem");
  }

  if(type === "campaign"){
    return _bSection("Campaign Type", "campType", [
      {val:"launch",      label:"Launch"},
      {val:"awareness",   label:"Awareness"},
      {val:"conversion",  label:"Conversion"},
      {val:"retargeting", label:"Retargeting"}
    ], "launch")
    + _bSection("Channel", "campChannel", [
      {val:"meta",      label:"Meta"},
      {val:"instagram", label:"Instagram"},
      {val:"tiktok",    label:"TikTok"},
      {val:"youtube",   label:"YouTube"}
    ], "meta")
    + _bSection("Asset Pack", "campAssets", [
      {val:"feed",  label:"Feed"},
      {val:"story", label:"Story"},
      {val:"square",label:"Square"},
      {val:"video", label:"Video Concept"}
    ], "feed")
    + _bSection("Goal", "campGoal", [
      {val:"reach",  label:"Reach"},
      {val:"clicks", label:"Clicks"},
      {val:"sales",  label:"Sales"}
    ], "reach");
  }

  return "";
}


// ── Prompt builders — called by runBuilder() ──────────────────

// Maximum characters sent to the API. Server appends up to ~700 chars of vision
// analysis, so keep the client-built prompt well under 3000.
var _IMG_PROMPT_MAX = 2800;

function _buildImageBuilderPrompt(custom){
  var b  = S._builder || {};
  var bc = S.brandCore;
  var fmt = b.imgFormat || "1:1";

  var designTypes = {
    product:      "Product image — deliberate staging, product as undisputed hero.",
    social:       "Social post — scroll-stopping, brand-aligned, feed-optimised.",
    poster:       "Poster background — bold, structured, strong compositional presence.",
    ad_creative:  "Ad creative background — high-converting, arresting, commercial quality.",
    brand_intro:  "Brand introduction — aspirational first impression, premium presence.",
    promo:        "Promotional image — desire-forward, strong contrast, communicates value.",
    announcement: "Announcement visual — authoritative, commanding, signals importance.",
    other:        "Brand visual — premium, deliberate, grounded in the brand identity."
  };

  var purposes = {
    launch:       "Launch — maximum energy, sense of arrival.",
    promotion:    "Promotion — value-forward, desire-generating.",
    introduction: "Introduction — clear, confident, brand-establishing.",
    awareness:    "Awareness — memorable, distinctive, brand-first.",
    sales:        "Sales — benefit-led, removes hesitation.",
    engagement:   "Engagement — inviting, compelling, prompts response.",
    other:        "General brand use."
  };

  // ── Priority 1: Core constraints (always included, never trimmed) ──────────
  var coreParts = [];

  // Text-in-image: drive the first constraint based on user choice
  var includeText = b.imgIncludeText || "none";
  if(includeText !== "none"){
    var textMap = {
      title:  "Include a short, clean title text in the image.",
      slogan: "Include a slogan or tagline in the image.",
      custom: 'Include this exact text in the image: "' + (b.imgTextContent || "").slice(0, 200) + '".'
    };
    coreParts.push(
      (textMap[includeText] || "Include text in the image.")
      + " Typography must be clean, professionally set, and naturally integrated into the composition — "
      + "not a sticker, not a watermark, not floating over the image. "
      + "Font style must complement the brand tone. Text must be fully legible and unobstructed."
    );
  } else {
    coreParts.push(
      "NO TEXT IN IMAGE. Pure visual background — text overlaid in post-production. No logos, UI, or typographic elements."
    );
  }

  coreParts.push(
    "Photorealistic commercial photography. Real motivated lighting (key light, fill, natural shadows). "
    + "No plastic faces, no AI skin smoothing, no uncanny valley. "
    + "No AI aesthetic: no dreamlike blur, painterly glow, or surreal gradients. "
    + "Looks like a high-budget commercial shoot."
  );

  coreParts.push(
    "Canvas: " + fmt + " — fill edge to edge. Text safe zone: " + _imgTextZone(fmt) + " — keep open and uncluttered."
  );

  var dtype = designTypes[b.imgDesignType || "other"] || designTypes.other;
  var purp  = purposes[b.imgPurpose || "awareness"] || purposes.awareness;
  coreParts.push("Type: " + dtype + " Purpose: " + purp);

  // Subject
  if(b.imgSubject === "person"){
    var modelDesc = (b.imgModelDesc || "").trim();
    coreParts.push(
      "Include a person: authentically human, real skin, genuine expression, aspirational."
      + (modelDesc ? " Details: " + modelDesc + ". CRITICAL: Reproduce exactly — do not change gender, age, appearance, or expression." : "")
      + " Brand-aligned wardrobe and environment."
    );
  } else {
    coreParts.push(
      "No person. Brand-based visual — deliberate, premium, grounded in brand identity. Not abstract, not generic."
    );
  }

  // Creative brief (custom notes) — placed immediately after subject so DALL-E
  // cannot drift from user-specified constraints even if the brand block is long.
  if(custom){
    var hasPersonKeyword = /\b(woman|man|girl|boy|person|model|human|child|people|female|male|she|he|they)\b/i.test(custom);
    var hasPlaceKeyword  = /\b(beach|forest|office|city|studio|outdoor|indoor|kitchen|street|park|mountain|desert|room|store)\b/i.test(custom);
    var enforcement = "CREATIVE BRIEF — REPRODUCE EXACTLY:\n" + custom.slice(0, 500);
    enforcement += "\n\nCRITICAL ENFORCEMENT:";
    if(hasPersonKeyword) enforcement += " Do not alter the described person's gender, age, demographic, or appearance.";
    if(hasPlaceKeyword)  enforcement += " Do not alter the described location or setting.";
    enforcement += " Do not introduce unrelated elements. Follow the brief literally and completely.";
    coreParts.push(enforcement);
  }

  // Upload context
  var uploadType = b.imgUploadType;
  if(uploadType === "product"){
    coreParts.push(
      "PRODUCT: Reproduce the uploaded product faithfully as the hero subject — exact shape, colour, material, proportions. Stage in brand-aligned environment."
    );
  } else if(uploadType === "reference"){
    coreParts.push(
      "STYLE REF: Apply the uploaded reference image's aesthetic (composition, lighting, colour temperature, mood) — elevate it, do not copy it literally."
    );
  } else if(uploadType === "logo"){
    coreParts.push(
      "LOGO REF: Do not include the logo. Use its visual language — shapes, forms, palette — to subtly inform composition."
    );
  }

  // ── Priority 2: BrandCore (included, trimmed if needed) ───────────────────
  var brandPart = "";
  if(bc && bc.name){
    var bl = ["BRAND: " + bc.name + "."];
    var cs = _formatBrandColors(bc.colors);
    if(cs) bl.push("Colours: " + cs + " — apply to environment, props, surfaces, wardrobe. Not to skin or sky.");
    var vstyle = bc.styleDirection || bc.style;
    if(vstyle) bl.push("Style: " + vstyle + ".");
    if(bc.tone) bl.push("Tone: " + (Array.isArray(bc.tone) ? bc.tone.join(", ") : bc.tone) + ".");
    if(bc.audience) bl.push("Audience: " + bc.audience + ".");
    if(bc.promise) bl.push("Promise: " + bc.promise + ".");
    brandPart = bl.join(" ");
  } else {
    brandPart = "BRAND: None set. Refined minimal palette — clean neutrals with one intentional accent. Modern, premium.";
  }

  // ── Priority 3: Custom notes (lowest — trimmed most aggressively) ──────────
  var customPart = custom ? ("Notes: " + custom.slice(0, 300)) : "";

  // ── Assemble with budget tracking ─────────────────────────────────────────
  var coreText  = coreParts.join("\n");
  var raw       = [coreText, brandPart, customPart].filter(Boolean).join("\n\n");
  var rawLen    = raw.length;

  console.log("[ImagePrompt] Raw length before trim: " + rawLen);

  var result = raw;

  // If over budget, drop custom notes first
  if(result.length > _IMG_PROMPT_MAX && customPart){
    result = [coreText, brandPart].filter(Boolean).join("\n\n");
    console.log("[ImagePrompt] Dropped custom notes. Length: " + result.length);
  }

  // If still over budget, shorten the brand block (keep name + colours only)
  if(result.length > _IMG_PROMPT_MAX && bc && bc.name){
    var bl2 = ["BRAND: " + bc.name + "."];
    var cs2 = _formatBrandColors(bc.colors);
    if(cs2) bl2.push("Colours: " + cs2 + ".");
    var trimmedBrand = bl2.join(" ");
    result = [coreText, trimmedBrand].filter(Boolean).join("\n\n");
    console.log("[ImagePrompt] Trimmed brand to name+colours. Length: " + result.length);
  }

  // Hard clamp — should never be needed, but is the final safety net
  if(result.length > _IMG_PROMPT_MAX){
    result = result.slice(0, _IMG_PROMPT_MAX);
    console.log("[ImagePrompt] Hard-clamped to " + _IMG_PROMPT_MAX + " chars.");
  }

  console.log("[ImagePrompt] Final client prompt length: " + result.length);
  return result;
}

// Returns the safe zone description for a given format — tells DALL-E where to keep it open
function _imgTextZone(fmt){
  if(fmt === "9:16")  return "lower 40% of the frame — keep the upper 60% as the primary compositional visual";
  if(fmt === "16:9")  return "lower 30% of the frame — keep the upper 70% as the primary compositional visual";
  if(fmt === "4:5")   return "lower 35% of the frame — keep the upper 65% as the primary compositional visual";
  return "lower 35% of the frame — keep the upper 65% as the primary compositional visual"; // 1:1
}

function _buildTextBuilderPrompt(custom){
  var b  = S._builder || {};
  var bc = S.brandCore;

  var typeRules = {
    headline:     "Generate ONE strong, punchy headline. Max 10 words. Specific, benefit-forward, brand-voice specific. No \u2018Introducing\u2019 or \u2018Welcome to\u2019. Output only the headline — no label, no explanation.",
    headlines:    "Generate ONE strong, punchy headline. Max 10 words. Specific, benefit-forward, brand-voice specific. No \u2018Introducing\u2019 or \u2018Welcome to\u2019. Output only the headline \u2014 no label, no explanation.",
    body_copy:    "Generate ONE polished body copy paragraph. 2\u20133 sentences. Open with the most compelling idea. No filler, no clich\u00e9s. End with a strong directional statement. Output only the copy.",
    caption:      "Generate ONE strong caption. Strong first line that hooks before the \u2018more\u2019 cutoff. Natural, direct language. Clear CTA or invitation. 3\u20135 relevant hashtags at the end. Output only the caption.",
    hook:         "Generate ONE powerful hook. Lands in 2\u20133 seconds. Bold claim, provocative question, or pattern interrupt. Every word earns its place. Output only the hook.",
    product_desc: "Generate ONE product description. Lead with the primary benefit, not the product name. Specific, sensory language. Structure: benefit opening \u2192 2\u20133 features \u2192 brand promise. Output only the description.",
    ad_copy:      "Generate ONE complete ad copy set: Headline (max 8 words), Primary Text (2\u20133 sentences), CTA (max 4 words). Benefit-led, brand-voice specific. Format clearly: HEADLINE: / TEXT: / CTA:",
    other:        "Generate ONE strong, polished piece of brand copy. Use the brief and brand context to determine the best format. Output only the final copy."
  };

  var purposeContext = {
    launch:      "CONTEXT: This is for a launch. Create urgency, excitement, and a clear sense of arrival.",
    promotion:   "CONTEXT: This is for a promotion. Value-forward, clear benefit, compelling reason to act now.",
    brand_intro: "CONTEXT: This is a brand introduction. Confident, clear, establishes the brand identity in the opening line.",
    awareness:   "CONTEXT: This is for awareness. Memorable, distinctive, brand-first. Not a hard sell.",
    conversion:  "CONTEXT: This is for conversion. Every word drives action. Remove hesitation. Create clarity.",
    engagement:  "CONTEXT: This is for engagement. Conversational, inviting, prompts a response.",
    other:       ""
  };

  var parts = [];

  parts.push(
    "OUTPUT RULE: Generate exactly ONE final, polished result. "
    + "Do NOT output multiple versions, variants, or options. "
    + "One result, ready to use. No preamble. No meta-commentary. No labels unless the format requires them."
  );

  var typeKey = b.txtType || "headline";
  parts.push("COPY TYPE: " + (typeRules[typeKey] || typeRules.other));

  var ctx = purposeContext[b.txtPurpose || "awareness"];
  if(ctx) parts.push(ctx);

  if(custom){
    parts.push(
      "BRIEF — FOLLOW EXACTLY:\n" + custom
      + "\n\nCRITICAL: Write specifically and precisely for this brief. Do not generalize, reinterpret, or substitute. "
      + "Every word must serve the stated purpose and audience."
    );
  }

  // BrandCore provides tone, audience, and voice — no manual tone selection needed
  if(bc && bc.name){
    var bLines = ["BRAND IDENTITY \u2014 write exclusively for this brand, not generically:"];
    bLines.push("Brand: " + bc.name);
    if(bc.tone) bLines.push("Tone of voice (use throughout): " + (Array.isArray(bc.tone) ? bc.tone.join(", ") : bc.tone));
    if(bc.audience) bLines.push("Audience: " + bc.audience);
    if(bc.promise)  bLines.push("Brand promise: " + bc.promise);
    if(bc.style)    bLines.push("Brand style: " + bc.style);
    if(bc.wordsUse   && bc.wordsUse.length)   bLines.push("Words to use: "   + bc.wordsUse.join(", "));
    if(bc.wordsAvoid && bc.wordsAvoid.length) bLines.push("Words to avoid: " + bc.wordsAvoid.join(", "));
    parts.push(bLines.join("\n"));
  }

  parts.push(
    "QUALITY RULE: Senior brand copywriter standard. Specific, intentional, and on-brand. "
    + "Never generic. This must feel written for this brand alone."
  );

  return parts.join("\n\n");
}

function _buildAdsBuilderPrompt(custom){
  var b  = S._builder || {};
  var bc = S.brandCore;

  var platforms = {
    meta:    "Meta (Facebook / Instagram)",
    tiktok:  "TikTok",
    youtube: "YouTube",
    other:   "Digital advertising"
  };

  var formats = {
    square:   "Square 1:1 — compact, versatile, feed-optimised",
    portrait: "Portrait 4:5 — scroll context, 1\u20133 second attention window",
    story:    "Story/Reel 9:16 — full-screen vertical, immersive, native content",
    wide:     "Wide 16:9 — cinematic, widescreen, YouTube/desktop optimised",
    // legacy keys kept for safety
    feed:     "Feed 4:5 — scroll context, 1\u20133 second attention window",
    reel:     "Reel 9:16 — full-screen vertical, native content feel"
  };

  var goals = {
    awareness:  "Goal: Awareness \u2014 memorable first impression, brand-first, no hard sell.",
    engagement: "Goal: Engagement \u2014 drive reactions, comments, saves. Emotional resonance.",
    conversion: "Goal: Conversion \u2014 drive direct action. Value proposition unmissable.",
    sales:      "Goal: Sales \u2014 direct purchase intent, clear offer, strong CTA.",
    launch:     "Goal: Launch \u2014 maximum energy, announce arrival, first impression."
  };

  var subjects = {
    product: "What is advertised: A product.",
    service: "What is advertised: A service.",
    brand:   "What is advertised: The brand itself.",
    offer:   "What is advertised: A specific offer or deal.",
    other:   "What is advertised: See brief."
  };

  var parts = [];

  parts.push(
    "AD PLATFORM: " + (platforms[b.adsPlatform || "meta"] || platforms.meta) + "\n"
    + "AD FORMAT: " + (formats[b.adsFormat || "square"] || formats.square)
  );
  parts.push(goals[b.adsGoal || "awareness"] || goals.awareness);
  parts.push(subjects[b.adsSubject || "product"] || subjects.product);

  if(custom) parts.push("AD BRIEF / SPECIFIC DETAILS: " + custom);

  // BrandCore handles style, tone, and visual direction automatically
  if(bc && bc.name){
    var bLines = ["BRAND IDENTITY \u2014 apply to all copy and visual direction:"];
    bLines.push("Brand: " + bc.name);
    var cs = _formatBrandColors(bc.colors);
    if(cs) bLines.push("Brand colours: " + cs);
    if(bc.tone) bLines.push("Tone: " + (Array.isArray(bc.tone) ? bc.tone.join(", ") : bc.tone));
    if(bc.audience) bLines.push("Audience: " + bc.audience);
    if(bc.promise)  bLines.push("Brand promise: " + bc.promise);
    if(bc.diff || bc.positioning) bLines.push("Positioning: " + (bc.diff || bc.positioning));
    parts.push(bLines.join("\n"));
  }

  parts.push(
    "OUTPUT: Generate ONE complete ad concept. Reply with valid JSON only (no markdown, no extra text):\n"
    + '{"title":"...","headline":"...","body":"...","cta":"..."}\n'
    + "\u2014 title: ad name/concept title (max 6 words, brand-specific)\n"
    + "\u2014 headline: punchy, platform-optimised (max 10 words), brand-voice specific\n"
    + "\u2014 body: benefit-led copy in brand voice (2\u20133 sentences, no generic filler)\n"
    + "\u2014 cta: direct action CTA (max 4 words)"
  );

  return parts.join("\n\n");
}

function _buildCampaignBuilderPrompt(custom){
  var b  = S._builder || {};
  var bc = S.brandCore;
  var n  = parseInt(b.campVariations || "5", 10);

  var campTypes = {
    launch:      "Campaign type: Launch \u2014 maximum energy, first impression, announces arrival.",
    awareness:   "Campaign type: Awareness \u2014 build familiarity, consistency of message, no hard sell.",
    conversion:  "Campaign type: Conversion \u2014 drive action, clear value proposition, remove friction.",
    promotion:   "Campaign type: Promotion \u2014 specific offer, value-forward, compelling reason to act now.",
    retargeting: "Campaign type: Retargeting \u2014 warm audience, new angle or social proof, address objection.",
    other:       "Campaign type: General brand campaign."
  };

  var channels = {
    meta:    "Channel: Meta (Facebook + Instagram ecosystem)",
    tiktok:  "Channel: TikTok (native content + paid)",
    youtube: "Channel: YouTube (pre-roll + bumper ads)",
    multi:   "Channel: Multi-platform \u2014 output must work across Meta, TikTok, and YouTube"
  };

  var formats = {
    square:     "Format: Square 1:1 \u2014 versatile, feed-optimised",
    portrait:   "Format: Portrait 4:5 \u2014 scroll-stopping feed asset",
    story_reel: "Format: Story/Reel 9:16 \u2014 full-screen vertical native content",
    mixed:      "Format: Mixed \u2014 vary format across variations"
  };

  var subjects = {
    product: "Campaign subject: A product.",
    service: "Campaign subject: A service.",
    brand:   "Campaign subject: The brand itself.",
    offer:   "Campaign subject: A specific offer or deal.",
    other:   "Campaign subject: See brief."
  };

  var parts = [];

  parts.push(campTypes[b.campType || "awareness"] || campTypes.awareness);
  parts.push(channels[b.campChannel || "meta"]    || channels.meta);
  parts.push(formats[b.campFormat || "square"]    || formats.square);
  parts.push(subjects[b.campSubject || "brand"]   || subjects.brand);

  if(custom){
    parts.push(
      "CAMPAIGN BRIEF — FOLLOW EXACTLY:\n" + custom
      + "\n\nCRITICAL: Build every variation specifically for this brief. Do not generalize the offer, audience, or product. "
      + "The brief overrides any generic defaults — treat it as the primary creative directive."
    );
  }

  // BrandCore is the primary intelligence — applied across all variations
  if(bc && bc.name){
    var bLines = ["BRAND IDENTITY \u2014 must be consistent and unmistakable across all variations:"];
    bLines.push("Brand: " + bc.name);
    var cs = _formatBrandColors(bc.colors);
    if(cs) bLines.push("Brand colours: " + cs + " \u2014 apply to every variation.");
    if(bc.tone) bLines.push("Tone: " + (Array.isArray(bc.tone) ? bc.tone.join(", ") : bc.tone));
    if(bc.audience) bLines.push("Audience: " + bc.audience);
    if(bc.promise)  bLines.push("Brand promise: " + bc.promise);
    if(bc.diff || bc.positioning) bLines.push("Positioning: " + (bc.diff || bc.positioning));
    parts.push(bLines.join("\n"));
  }

  parts.push(
    "OUTPUT: Generate exactly " + n + " campaign variation objects as a valid JSON array.\n"
    + "Each variation is one adset-style creative concept. Use genuinely different angles \u2014 not repetitions.\n"
    + "Reply with ONLY the JSON array. No markdown fences. No extra text.\n"
    + '[{"title":"...","headline":"...","body":"...","cta":"...","imagePrompt":"..."},...]\n'
    + "\u2014 title: variation name (max 5 words, unique per variation)\n"
    + "\u2014 headline: platform-optimised headline (max 10 words, brand-voice specific)\n"
    + "\u2014 body: benefit-led copy (2\u20133 sentences, brand voice, no filler)\n"
    + "\u2014 cta: direct action CTA (max 4 words)\n"
    + "\u2014 imagePrompt: a 100\u2013180 char DALL-E 3 prompt for this variation\u2019s visual. "
    + "CRITICAL: 100% text-free visual description. Must use brand colours. No text/letters/logos in image. "
    + "Describe the visual composition, subject, mood, and colour palette specifically."
  );

  return parts.join("\n\n");
}

function _buildBuilderPrompt(type){
  var custom = "";
  // 1. Flow wizard answers (original builder)
  if(S._flow && S._flow.answers && S._flow.answers._extraNotes){
    custom = (S._flow.answers._extraNotes || "").trim();
  }
  // 2. AI conversation flow writes directly into S._builder
  if(!custom && S._builder && S._builder._extraNotes){
    custom = (S._builder._extraNotes || "").trim();
  }
  // 3. Legacy custom input field (create-workspace page)
  if(!custom){
    custom = ((document.getElementById("builderCustomInp") || {}).value || "").trim();
  }
  if(type === "image")    return _buildImageBuilderPrompt(custom);
  if(type === "text")     return _buildTextBuilderPrompt(custom);
  if(type === "ads")      return _buildAdsBuilderPrompt(custom);
  if(type === "campaign") return _buildCampaignBuilderPrompt(custom);
  return custom;
}


// ── DALL-E size resolution for builder ───────────────────────

function _builderImgSize(){
  var fmt = (S._builder || {}).imgFormat || "1:1";
  if(fmt === "9:16") return "1024x1792";
  if(fmt === "16:9") return "1792x1024";
  return "1024x1024";
}

function _builderAdsSize(){
  var fmt = (S._builder || {}).adsFormat || "square";
  if(fmt === "story" || fmt === "reel" || fmt === "story_reel") return "1024x1792";
  if(fmt === "wide") return "1792x1024";
  return "1024x1024";
}

function _builderCampSize(){
  var fmt = (S._builder || {}).campFormat || "square";
  if(fmt === "story_reel") return "1024x1792";
  if(fmt === "wide")       return "1792x1024";
  return "1024x1024";
}


// ════════════════════════════════════════════════════════════════
// GUIDED FLOW DEFINITIONS
// Each flow is an ordered array of step objects.
// step.when(answers) — optional predicate; if false, step is skipped.
// step.type — "pills" (auto-advance) | "text" | "textarea" (need Continue)
// ════════════════════════════════════════════════════════════════

var FLOWS = {

  // ── IMAGE ─────────────────────────────────────────────────────
  // Only practical content questions. BrandCore supplies style,
  // colours, tone, and visual direction automatically.
  image: [
    {
      key: "imgDesignType",
      ai:  "What kind of image do you need?",
      type:"pills",
      options:[
        {val:"product",      label:"Product Image"},
        {val:"social",       label:"Social Post"},
        {val:"poster",       label:"Poster"},
        {val:"ad_creative",  label:"Ad Creative"},
        {val:"brand_intro",  label:"Brand Introduction"},
        {val:"promo",        label:"Promo Image"},
        {val:"announcement", label:"Announcement Visual"},
        {val:"other",        label:"Other"}
      ]
    },
    {
      key: "imgPurpose",
      ai:  "What is the purpose of this image?",
      type:"pills",
      options:[
        {val:"launch",       label:"Launch"},
        {val:"promotion",    label:"Promotion"},
        {val:"introduction", label:"Introduction"},
        {val:"awareness",    label:"Awareness"},
        {val:"sales",        label:"Sales"},
        {val:"engagement",   label:"Engagement"},
        {val:"other",        label:"Other"}
      ]
    },
    {
      key: "_brandcoreReview",
      ai:  "Here\u2019s your brand style \u2014 this shapes every element of your image automatically.",
      type:"brandcore"
    },
    {
      key: "_imgUploads",
      ai:  "Do you want to include any visual references?",
      type:"upload"
    },
    {
      key: "imgSubject",
      ai:  "Do you want a person or model in the image?",
      type:"pills",
      options:[
        {val:"person", label:"Yes \u2014 include a person"},
        {val:"no",     label:"No \u2014 brand visual only"}
      ]
    },
    {
      key: "imgModelDesc",
      ai:  "Describe the person or model briefly.",
      type:"text",
      placeholder:"e.g. confident woman in her 30s, professional setting",
      optional:true,
      when:function(a){ return a.imgSubject === "person"; }
    },
    {
      key: "imgFormat",
      ai:  "What format do you need?",
      type:"pills",
      grid:true,
      options:[
        {val:"1:1",  label:"1:1 \u2014 Square"},
        {val:"4:5",  label:"4:5 \u2014 Portrait"},
        {val:"9:16", label:"9:16 \u2014 Story"},
        {val:"16:9", label:"16:9 \u2014 Wide"}
      ]
    },
    {
      key: "_hasText",
      ai:  "Do you want text overlaid on the image?",
      type:"pills",
      options:[
        {val:"yes", label:"Yes \u2014 add text"},
        {val:"no",  label:"No \u2014 image only"}
      ]
    },
    {
      key: "imgHeadline",
      ai:  "What is the headline?",
      type:"text",
      placeholder:"e.g. Clarity starts here.",
      when:function(a){ return a._hasText === "yes"; }
    },
    {
      key: "imgSubtext",
      ai:  "Any supporting text?",
      type:"text",
      placeholder:"Supporting line or description",
      optional:true,
      when:function(a){ return a._hasText === "yes"; }
    },
    {
      key: "imgCta",
      ai:  "What is the CTA?",
      type:"text",
      placeholder:"e.g. Get started \u2192",
      optional:true,
      when:function(a){ return a._hasText === "yes"; }
    },
    {
      key: "_extraNotes",
      ai:  "Any extra details or direction?",
      type:"textarea",
      placeholder:"e.g. show the product on a clean white surface, warm lighting, outdoor feel",
      optional:true
    }
  ],

  // ── TEXT ──────────────────────────────────────────────────────
  // BrandCore provides tone automatically. No tone/length questions.
  // Generates ONE polished result.
  text: [
    {
      key: "txtType",
      ai:  "What type of text do you need?",
      type:"pills",
      options:[
        {val:"headline",     label:"Headline"},
        {val:"body_copy",    label:"Body Copy"},
        {val:"caption",      label:"Caption"},
        {val:"hook",         label:"Hook"},
        {val:"product_desc", label:"Product Description"},
        {val:"ad_copy",      label:"Ad Copy"},
        {val:"other",        label:"Other"}
      ]
    },
    {
      key: "txtPurpose",
      ai:  "What is the purpose of this text?",
      type:"pills",
      options:[
        {val:"launch",      label:"Launch"},
        {val:"promotion",   label:"Promotion"},
        {val:"brand_intro", label:"Brand Introduction"},
        {val:"awareness",   label:"Awareness"},
        {val:"conversion",  label:"Conversion"},
        {val:"engagement",  label:"Engagement"},
        {val:"other",       label:"Other"}
      ]
    },
    {
      key: "_extraNotes",
      ai:  "Describe what this text is for.",
      type:"textarea",
      placeholder:"e.g. Homepage headline for our new SaaS product targeting marketing teams",
      optional:true
    }
  ],

  // ── ADS ───────────────────────────────────────────────────────
  // Always outputs: 1 image + 1 headline + 1 description + 1 title.
  // BrandCore handles style, tone, and visual direction.
  ads: [
    {
      key: "adsPlatform",
      ai:  "Which platform is this ad for?",
      type:"pills",
      options:[
        {val:"meta",    label:"Meta / Facebook / Instagram"},
        {val:"tiktok",  label:"TikTok"},
        {val:"youtube", label:"YouTube"},
        {val:"other",   label:"Other"}
      ]
    },
    {
      key: "adsFormat",
      ai:  "What format do you need?",
      type:"pills",
      grid:true,
      options:[
        {val:"square",   label:"Square 1:1"},
        {val:"portrait", label:"Portrait 4:5"},
        {val:"story",    label:"Story / Reel"},
        {val:"wide",     label:"Wide 16:9"}
      ]
    },
    {
      key: "adsGoal",
      ai:  "What is the goal of this ad?",
      type:"pills",
      options:[
        {val:"awareness",  label:"Awareness"},
        {val:"engagement", label:"Engagement"},
        {val:"conversion", label:"Conversion"},
        {val:"sales",      label:"Sales"},
        {val:"launch",     label:"Launch"}
      ]
    },
    {
      key: "adsSubject",
      ai:  "What is being advertised?",
      type:"pills",
      options:[
        {val:"product", label:"Product"},
        {val:"service", label:"Service"},
        {val:"brand",   label:"Brand"},
        {val:"offer",   label:"Offer"},
        {val:"other",   label:"Other"}
      ]
    },
    {
      key: "_extraNotes",
      ai:  "Any specific details about the ad?",
      type:"textarea",
      placeholder:"e.g. 20% off summer sale for skincare products, targeting 25\u201340 year olds",
      optional:true
    }
  ],

  // ── CAMPAIGN ──────────────────────────────────────────────────
  // Generates N adset-style variations, each with image + headline
  // + description + title. BrandCore applied across all.
  campaign: [
    {
      key: "campType",
      ai:  "What type of campaign is this?",
      type:"pills",
      options:[
        {val:"launch",      label:"Launch"},
        {val:"awareness",   label:"Awareness"},
        {val:"conversion",  label:"Conversion"},
        {val:"promotion",   label:"Promotion"},
        {val:"retargeting", label:"Retargeting"},
        {val:"other",       label:"Other"}
      ]
    },
    {
      key: "campChannel",
      ai:  "Which platform is this campaign on?",
      type:"pills",
      options:[
        {val:"meta",    label:"Meta / Facebook / Instagram"},
        {val:"tiktok",  label:"TikTok"},
        {val:"youtube", label:"YouTube"},
        {val:"multi",   label:"Multi-platform"}
      ]
    },
    {
      key: "campFormat",
      ai:  "What format do you need?",
      type:"pills",
      grid:true,
      options:[
        {val:"square",     label:"Square 1:1"},
        {val:"portrait",   label:"Portrait 4:5"},
        {val:"story_reel", label:"Story / Reel"},
        {val:"mixed",      label:"Mixed formats"}
      ]
    },
    {
      key: "campVariations",
      ai:  "How many ads do you want in this campaign?",
      type:"pills",
      grid:true,
      options:[
        {val:"1", label:"1 ad"},
        {val:"2", label:"2 ads"},
        {val:"3", label:"3 ads"},
        {val:"4", label:"4 ads"},
        {val:"5", label:"5 ads"}
      ]
    },
    {
      key: "campSubject",
      ai:  "What is this campaign about?",
      type:"pills",
      options:[
        {val:"product", label:"Product"},
        {val:"service", label:"Service"},
        {val:"brand",   label:"Brand"},
        {val:"offer",   label:"Offer"},
        {val:"other",   label:"Other"}
      ]
    },
    {
      key: "_extraNotes",
      ai:  "Any specific details about the campaign?",
      type:"textarea",
      placeholder:"e.g. Summer collection launch, 20% off, targeting 25\u201340 year olds",
      optional:true
    }
  ]
};


// ════════════════════════════════════════════════════════════════
// FLOW ENGINE
// S._flow = { type, stepIndex, answers, activeSteps }
// ════════════════════════════════════════════════════════════════

function _flowStart(type){
  if(!S._builder) S._builder = {};
  // Pre-seed answers from anything already in _builder (e.g. idea prefill)
  var seedAnswers = {};
  if(S._builder._extraNotes) seedAnswers._extraNotes = S._builder._extraNotes;
  S._flow = { type:type, stepIndex:0, answers:seedAnswers, activeSteps:[] };
  _flowUpdateActiveSteps();
  _flowRender();
}

function _flowUpdateActiveSteps(){
  if(!S._flow) return;
  var all = FLOWS[S._flow.type] || [];
  var a   = S._flow.answers;
  S._flow.activeSteps = all.filter(function(s){ return !s.when || s.when(a); });
}

function _flowCurrentStep(){
  if(!S._flow) return null;
  return S._flow.activeSteps[S._flow.stepIndex] || null;
}

// Called when a pill option is clicked
function _flowPickOption(val){
  var step = _flowCurrentStep();
  if(!step) return;
  S._flow.answers[step.key] = val;
  if(!S._builder) S._builder = {};
  S._builder[step.key] = val;
  _flowUpdateActiveSteps();
  // Highlight immediately
  document.querySelectorAll(".flow-option").forEach(function(el){
    var isActive = el.dataset.val === String(val);
    el.classList.toggle("active", isActive);
    var chk = el.querySelector(".flow-option-check");
    if(chk){
      chk.innerHTML = isActive
        ? '<svg viewBox="0 0 10 8" width="10" height="8" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4l3 3 5-6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : "";
    }
  });
  // Auto-advance after brief pause for visual feedback
  setTimeout(function(){ _flowAdvance(); }, 340);
}

// Called by Continue button (text / textarea / brandcore steps)
function flowContinue(){
  var step = _flowCurrentStep();
  if(!step) return;
  if(step.type === "brandcore"){
    _flowAdvance();
    return;
  }
  if(step.type === "upload"){
    // Store whatever the user selected (type is stored live by _flowUploadSelectType)
    // If nothing picked yet, default to "none"
    if(!S._flow.answers[step.key]) S._flow.answers[step.key] = "none";
    if(!S._builder) S._builder = {};
    S._builder[step.key] = S._flow.answers[step.key];
    _flowAdvance();
    return;
  }
  var val = "";
  if(step.type === "text"){
    var inp = document.getElementById("flowTextInp");
    val = inp ? inp.value.trim() : "";
    if(!val && !step.optional){
      if(inp){ inp.focus(); inp.style.borderColor = "#DC2626"; }
      return;
    }
  } else if(step.type === "textarea"){
    var ta = document.getElementById("flowTextareaInp");
    val = ta ? ta.value.trim() : "";
    if(!val && !step.optional){
      if(ta){ ta.focus(); ta.style.borderColor = "#DC2626"; }
      return;
    }
  }
  if(!S._builder) S._builder = {};
  S._flow.answers[step.key] = val;
  S._builder[step.key] = val;
  _flowUpdateActiveSteps();
  _flowAdvance();
}

// Called by Back button
function flowBack(){
  if(!S._flow) return;
  if(S._flow.stepIndex > 0){
    S._flow.stepIndex--;
    _flowRender();
  } else {
    navigate("create");
  }
}

// Jump back to a previous step (via history tap)
function flowJumpTo(idx){
  if(!S._flow || idx < 0 || idx >= S._flow.stepIndex) return;
  // Clear answers from the jumped-to step forward
  S._flow.activeSteps.slice(idx).forEach(function(s){ delete S._flow.answers[s.key]; });
  S._flow.stepIndex = idx;
  _flowUpdateActiveSteps();
  _flowRender();
}

function _flowAdvance(){
  _flowUpdateActiveSteps();
  if(S._flow.stepIndex < S._flow.activeSteps.length - 1){
    S._flow.stepIndex++;
    _flowRender();
  } else {
    _flowGenerate();
  }
}

// ── Render the current step ───────────────────────────────────

function _flowRender(){
  var step  = _flowCurrentStep();
  if(!step) return;
  var idx   = S._flow.stepIndex;
  var total = S._flow.activeSteps.length;

  // Update AI message with fade
  var msgEl = document.getElementById("flowGuideMessage");
  if(msgEl){
    msgEl.style.opacity = "0";
    setTimeout(function(){
      msgEl.textContent = step.ai;
      msgEl.style.opacity = "1";
    }, 130);
  }

  // Progress dots
  var progEl = document.getElementById("flowProgress");
  if(progEl){
    progEl.innerHTML = S._flow.activeSteps.map(function(_, i){
      var cls = i < idx ? "flow-dot done" : (i === idx ? "flow-dot active" : "flow-dot");
      return '<div class="' + cls + '"></div>';
    }).join("");
  }

  // History strip (previous Q&A, tappable to go back)
  var histEl = document.getElementById("flowHistory");
  if(histEl){
    var hhtml = "";
    for(var i = 0; i < idx; i++){
      var s   = S._flow.activeSteps[i];
      var ans = S._flow.answers[s.key];
      if(ans == null || ans === "") continue;
      var disp = String(ans);
      if(s.type === "pills" && s.options){
        var found = s.options.filter(function(o){ return o.val === ans; })[0];
        if(found) disp = found.label;
      }
      hhtml += '<div class="flow-hist-item" onclick="flowJumpTo(' + i + ')">'
        + '<span class="flow-hist-q">' + _escHtml(s.ai) + '</span>'
        + '<span class="flow-hist-a">' + _escHtml(disp.slice(0, 38)) + '</span>'
        + '</div>';
    }
    histEl.innerHTML = hhtml;
  }

  // Step content (re-animate)
  var stepEl = document.getElementById("flowStep");
  if(stepEl){
    stepEl.style.animation = "none";
    stepEl.offsetHeight; // force reflow
    stepEl.style.animation = "";
    stepEl.innerHTML = _flowStepHtml(step);
    // Auto-focus text inputs
    if(step.type === "text"){
      var inp2 = document.getElementById("flowTextInp");
      if(inp2) setTimeout(function(){ inp2.focus(); }, 80);
    } else if(step.type === "textarea"){
      var ta2 = document.getElementById("flowTextareaInp");
      if(ta2) setTimeout(function(){ ta2.focus(); }, 80);
    }
  }

  // Nav bar
  var navEl   = document.getElementById("flowNav");
  var backBtn = document.getElementById("flowNavBack");
  var contBtn = document.getElementById("flowNavContinue");
  var isTextStep   = (step.type === "text" || step.type === "textarea" || step.type === "brandcore" || step.type === "upload");
  var isBrandcore  = (step.type === "brandcore");
  var isUpload     = (step.type === "upload");
  var isLast       = (idx === total - 1);

  if(navEl)   navEl.style.display   = (isTextStep || idx > 0) ? "" : "none";
  if(backBtn) backBtn.style.visibility = idx > 0 ? "visible" : "hidden";
  if(contBtn){
    contBtn.style.display = isTextStep ? "" : "none";
    if(isTextStep){
      if(isBrandcore){
        contBtn.textContent = "Looks good \u2014 continue";
      } else if(isUpload){
        var uploadAns = S._flow && S._flow.answers && S._flow.answers[step.key];
        contBtn.textContent = (uploadAns && uploadAns !== "none") ? "Continue" : "Skip";
      } else {
        contBtn.textContent = isLast ? "Generate" : (step.optional ? "Skip" : "Continue");
      }
    }
  }

  // Hide result area when browsing steps
  var resWrap = document.getElementById("builderResultWrap");
  if(resWrap) resWrap.style.display = "none";
}

function _flowStepHtml(step){
  var cur = S._flow.answers[step.key];

  if(step.type === "pills"){
    var cls = step.grid ? "flow-options-grid" : "flow-options";
    return '<div class="' + cls + '">'
      + step.options.map(function(opt){
          var isActive = (cur === opt.val);
          var chkHtml  = isActive
            ? '<svg viewBox="0 0 10 8" width="10" height="8" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4l3 3 5-6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            : "";
          return '<button class="flow-option' + (isActive ? " active" : "") + '"'
            + ' data-val="' + _escHtml(opt.val) + '"'
            + ' onclick="_flowPickOption(\'' + opt.val.replace(/\\/g,"\\\\").replace(/'/g,"\\'") + '\')">'
            + '<div class="flow-option-check">' + chkHtml + '</div>'
            + '<span class="flow-option-label">' + _escHtml(opt.label) + '</span>'
            + '</button>';
        }).join("")
      + '</div>';
  }

  if(step.type === "text"){
    return '<div class="flow-input-wrap">'
      + '<input type="text" class="flow-inp" id="flowTextInp"'
      + ' placeholder="' + _escHtml(step.placeholder || "") + '"'
      + ' value="' + _escHtml(cur || "") + '"'
      + ' onkeydown="if(event.key===\'Enter\'){event.preventDefault();flowContinue();}"'
      + ' autocomplete="off">'
      + '</div>';
  }

  if(step.type === "textarea"){
    var helperHtml = "";
    if(step.key === "_extraNotes"){
      helperHtml = '<div class="flow-helper-text">The more specific your direction, the more intentional the result.</div>';
    }
    return '<div class="flow-input-wrap">'
      + helperHtml
      + '<textarea class="flow-inp" id="flowTextareaInp"'
      + ' placeholder="' + _escHtml(step.placeholder || "") + '">'
      + _escHtml(cur || "")
      + '</textarea>'
      + '</div>';
  }

  if(step.type === "upload"){
    var uploadType = (S._flow && S._flow.answers && S._flow.answers[step.key]) || "";
    var uploadData = (S._builder && S._builder.imgUploadData) || "";
    var types = [
      { val:"product",   label:"Product image",   hint:"I want the product to appear in the image" },
      { val:"reference", label:"Style reference",  hint:"Use this image for mood & visual style" },
      { val:"logo",      label:"Brand logo",        hint:"Use my logo to guide the visual identity" }
    ];
    var html = '<div class="flow-upload-step">';
    html += '<div class="flow-upload-types">';
    types.forEach(function(t){
      var isActive = uploadType === t.val;
      html += '<button class="flow-upload-type-btn' + (isActive ? " active" : "") + '"'
        + ' onclick="_flowUploadSelectType(\'' + t.val + '\')">'
        + '<div class="fut-label">' + _escHtml(t.label) + '</div>'
        + '<div class="fut-hint">' + _escHtml(t.hint) + '</div>'
        + '</button>';
    });
    html += '</div>';
    if(uploadType && uploadType !== "none"){
      if(uploadData){
        html += '<div class="flow-upload-done">'
          + '<div class="fud-check">'
          + '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M2.5 8l4 4 7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          + '</div>'
          + '<div class="fud-info">Image uploaded</div>'
          + '<button class="fud-remove" onclick="_flowUploadRemove()">Remove</button>'
          + '</div>';
      } else {
        html += '<div class="flow-upload-area" onclick="_flowUploadFile()">'
          + '<div class="fua-label">Tap to upload</div>'
          + '<div class="fua-hint">JPG, PNG, WEBP \u00b7 Max 10MB</div>'
          + '</div>';
      }
    }
    html += '</div>';
    return html;
  }

  if(step.type === "brandcore"){
    var bc = S.brandCore;
    if(!bc || !bc.name){
      return '<div class="flow-brandcore-panel flow-brandcore-empty">'
        + '<div class="fbp-empty-icon">'
        + '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><circle cx="8" cy="8" r="6.5"/><path d="M8 5v4M8 11v.5" stroke-linecap="round"/></svg>'
        + '</div>'
        + '<div class="fbp-empty-title">No BrandCore found</div>'
        + '<div class="fbp-empty-sub">Your image will be generated with a clean, professional default style. Set up your BrandCore to unlock brand-specific generation.</div>'
        + '</div>';
    }

    var bhtml = '<div class="flow-brandcore-panel">';

    // Header: icon + brand name + sub-label
    bhtml += '<div class="fbp-header">'
      + '<div class="fbp-icon">'
      + '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14">'
      + '<path d="M8 2L10 7H15L11 10L12.5 14L8 11.5L3.5 14L5 10L1 7H6Z" stroke-linecap="round" stroke-linejoin="round"/>'
      + '</svg>'
      + '</div>'
      + '<div>'
      + '<div class="fbp-brand-name">' + _escHtml(bc.name) + '</div>'
      + '<div class="fbp-sub">Applied automatically to every element of this image</div>'
      + '</div>'
      + '</div>';

    bhtml += '<div class="fbp-rows">';

    // Brand colours with swatches
    var bcColors = bc.colors;
    if(bcColors && bcColors.length){
      bhtml += '<div class="fbp-row">'
        + '<div class="fbp-row-label">Colours</div>'
        + '<div class="fbp-colors">';
      bcColors.slice(0, 6).forEach(function(c){
        var hex  = (c && typeof c === "object") ? c.hex  : c;
        var name = (c && typeof c === "object") ? c.name : "";
        if(hex){
          bhtml += '<div class="fbp-swatch" style="background:' + _escHtml(hex) + '"'
            + (name ? ' title="' + _escHtml(name + " " + hex) + '"' : ' title="' + _escHtml(hex) + '"')
            + '></div>';
        }
      });
      bhtml += '</div></div>';
    }

    // Visual style
    var vstyle = bc.styleDirection || bc.style;
    if(vstyle){
      bhtml += '<div class="fbp-row">'
        + '<div class="fbp-row-label">Visual style</div>'
        + '<div class="fbp-row-value">' + _escHtml(vstyle) + '</div>'
        + '</div>';
    }

    // Tone of voice
    var tone = bc.tone;
    if(tone){
      var toneStr = Array.isArray(tone) ? tone.join(", ") : String(tone);
      bhtml += '<div class="fbp-row">'
        + '<div class="fbp-row-label">Tone</div>'
        + '<div class="fbp-row-value">' + _escHtml(toneStr) + '</div>'
        + '</div>';
    }

    // Target audience
    if(bc.audience){
      bhtml += '<div class="fbp-row">'
        + '<div class="fbp-row-label">Audience</div>'
        + '<div class="fbp-row-value">' + _escHtml(bc.audience) + '</div>'
        + '</div>';
    }

    bhtml += '</div>'; // fbp-rows

    bhtml += '<div class="fbp-note">These brand elements will be applied to your image automatically. No manual input needed.</div>';

    bhtml += '</div>'; // flow-brandcore-panel
    return bhtml;
  }

  return "";
}

// ── Upload step helpers ───────────────────────────────────────

function _flowUploadSelectType(type){
  var step = _flowCurrentStep();
  if(!step || step.type !== "upload") return;
  if(!S._flow.answers) S._flow.answers = {};
  S._flow.answers[step.key] = type;
  if(!S._builder) S._builder = {};
  S._builder.imgUploadType = type;
  // Clear any previously uploaded data when switching type
  delete S._builder.imgUploadData;
  _flowRender();
}

function _flowUploadFile(){
  var inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/jpeg,image/png,image/webp";
  inp.onchange = function(){
    var file = inp.files && inp.files[0];
    if(!file) return;
    if(file.size > 10 * 1024 * 1024){
      alert("Please choose an image under 10MB.");
      return;
    }
    var reader = new FileReader();
    reader.onload = function(e){
      if(!S._builder) S._builder = {};
      S._builder.imgUploadData = e.target.result; // base64 data URL
      _flowRender();
    };
    reader.readAsDataURL(file);
  };
  inp.click();
}

function _flowUploadRemove(){
  if(S._builder) delete S._builder.imgUploadData;
  _flowRender();
}

// ── Trigger generation after flow completes ───────────────────

function _flowGenerate(){
  if(!S._builder) S._builder = {};
  // Copy all flow answers into S._builder
  var a = S._flow.answers;
  Object.keys(a).forEach(function(k){ S._builder[k] = a[k]; });

  // Set defaults for any skipped optional fields
  if(!S._builder.imgFormat)    S._builder.imgFormat    = "1:1";
  if(!S._builder.imgTextStyle) S._builder.imgTextStyle = "clean";
  if(!S._builder.imgSubject)   S._builder.imgSubject   = "abstract";
  if(!S._builder.imgComposition) S._builder.imgComposition = "minimal";
  if(!S._builder.imgMood)      S._builder.imgMood      = "professional";
  if(!S._builder.txtTone)      S._builder.txtTone      = "brandcore";
  if(!S._builder.txtLen)       S._builder.txtLen       = "medium";

  // Update AI guide message
  var msgEl = document.getElementById("flowGuideMessage");
  if(msgEl) msgEl.textContent = "We\u2019re all set. Creating your " + S._builderType + " now\u2026";

  // Hide nav and progress
  var navEl  = document.getElementById("flowNav");
  var progEl = document.getElementById("flowProgress");
  var histEl = document.getElementById("flowHistory");
  if(navEl)  navEl.style.display  = "none";
  if(progEl) progEl.innerHTML     = "";
  if(histEl) histEl.innerHTML     = "";

  // Show pulsing generating state in step area
  var stepEl = document.getElementById("flowStep");
  if(stepEl){
    stepEl.style.animation = "none";
    stepEl.offsetHeight;
    stepEl.style.animation = "";
    stepEl.innerHTML = '<div class="flow-generating">'
      + '<div class="flow-generating-icon">'
      + '<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20">'
      + '<path d="M14 3L17 10H24L19 14L21 21L14 17L7 21L9 14L4 10H11Z" stroke-linecap="round" stroke-linejoin="round"/>'
      + '</svg></div>'
      + '<div class="flow-generating-text">Generating your ' + S._builderType + '\u2026</div>'
      + '<div class="flow-generating-sub">This takes a few seconds.</div>'
      + '</div>';
  }

  runBuilder();
}


// ── openBuilder — entry point for the guided flow system ─────

function openBuilder(type){
  S._builderType = type;
  S._builder     = {};

  // Inject any idea prefill into _extraNotes before the flow starts
  if(S._ideaPrefill){
    S._builder._extraNotes = S._ideaPrefill;
    S._ideaPrefill = null;
  }

  // Brand pill
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

  // Reset result area
  var resultWrap = document.getElementById("builderResultWrap");
  if(resultWrap) resultWrap.style.display = "none";
  S._lastBuilderResult = null;

  navigate("builder");
  _flowStart(type);
}


// ── runBuilder — execute generation ──────────────────────────

async function runBuilder(){
  var type = S._builderType;
  if(!type) return;

  // Usage gate
  if(typeof gateUsage === "function"){
    var allowed = await gateUsage();
    if(!allowed) return;
  }

  var resultWrap = document.getElementById("builderResultWrap");
  var resultBody = document.getElementById("builderResultBody");
  var saveBtn    = document.getElementById("builderSaveBtn");

  // Loading state
  if(resultWrap) resultWrap.style.display = "";
  if(resultBody) resultBody.innerHTML = '<div class="builder-loading">'
    + '<div class="builder-loading-dots"><span></span><span></span><span></span></div>'
    + '<span>Building your ' + type + '\u2026</span>'
    + '</div>';
  if(saveBtn){ saveBtn.disabled = true; saveBtn.textContent = "Save to Studio"; }

  var prompt = _buildBuilderPrompt(type);

  var endpoint, requestBody;

  if(type === "image"){
    endpoint = API_BASE_URL+"/api/generate-image";
    var _b   = S._builder || {};
    requestBody = {
      prompt:       prompt,
      size:         _builderImgSize(),
      type:         "image",
      imageFormat:  _b.imgFormat    || "1:1",
      textStyle:    _b.imgTextStyle || "clean",
      headline:     (_b.imgHeadline  || "").trim(),
      subtext:      (_b.imgSubtext   || "").trim(),
      cta:          (_b.imgCta       || "").trim(),
      refImageData: _b.imgUploadData || _b.imgRefData || null,
      uploadType:   _b.imgUploadType || null
    };
  } else if(type === "ads"){
    endpoint    = API_BASE_URL+"/api/generate-ad";
    requestBody = {
      prompt:    prompt,
      size:      _builderAdsSize(),
      type:      "ads",
      adFormat:  (S._builder || {}).adsFormat || "feed"
    };
  } else if(type === "campaign"){
    endpoint    = API_BASE_URL+"/api/generate-campaign";
    requestBody = {
      prompt: prompt,
      size:   _builderCampSize(),
      type:   "campaign"
    };
  } else if(type === "text"){
    endpoint    = API_BASE_URL+"/api/generate-text";
    requestBody = { prompt: prompt, type: "text" };
  }

  console.log("[Builder/" + type + "] → " + endpoint);

  try {
    var res  = await fetch(endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(requestBody)
    });
    var data = await res.json();
    // For image type, attach the client-side text overlay data to the result
    // (server only returns imageUrl — text overlay is purely client-side)
    if(type === "image"){
      data.headline    = requestBody.headline    || "";
      data.subtext     = requestBody.subtext     || "";
      data.cta         = requestBody.cta         || "";
      data.textStyle   = requestBody.textStyle   || "clean";
      data.imageFormat = requestBody.imageFormat || "1:1";
    }
    S._lastBuilderResult = { type: type, data: data };
    _showBuilderResult(type, data);
    if(saveBtn){ saveBtn.disabled = false; }

    // Clear the generating spinner left in #flowStep by _flowGenerate()
    var stepEl = document.getElementById("flowStep");
    if(stepEl && stepEl.querySelector(".flow-generating")) stepEl.innerHTML = "";

    var msgEl = document.getElementById("flowGuideMessage");
    if(msgEl) msgEl.textContent = "Here’s your " + type + ". You can regenerate or save it to Studio.";
  } catch(e){
    console.error("[Builder/" + type + "] error:", e);
    if(resultBody) resultBody.innerHTML =
      '<div class="builder-error">Could not connect to ORIVEN services. Please try again.</div>';

    // Clear spinner on error too
    var stepEl2 = document.getElementById("flowStep");
    if(stepEl2 && stepEl2.querySelector(".flow-generating")) stepEl2.innerHTML = "";

    var msgEl2 = document.getElementById("flowGuideMessage");
    if(msgEl2) msgEl2.textContent = "Something went wrong. Please try again.";
  }
}


// ── _showBuilderResult — render result into result area ───────

function _showBuilderResult(type, data){
  var body = document.getElementById("builderResultBody");
  if(!body) return;

  if(data.error){
    body.innerHTML = '<div class="builder-error">' + _escHtml(data.error) + '</div>';
    return;
  }

  if(type === "image"){
    if(!data.imageUrl){
      body.innerHTML = '<div class="builder-error">No image was returned.</div>';
      return;
    }

    // Build composite: image background + text overlay layer
    var fmt       = (data.imageFormat || "1:1").replace(":","x");
    var txtStyle  = data.textStyle   || "clean";
    var headline  = data.headline    || "";
    var subtext   = data.subtext     || "";
    var cta       = data.cta         || "";
    var hasText   = headline || subtext || cta;

    var html = '<div class="img-composite">';

    // Frame with correct aspect ratio
    html += '<div class="img-frame img-frame-' + fmt + '">';
    html += '<img src="' + data.imageUrl + '" class="img-bg-layer" alt="Generated visual">';

    if(hasText){
      html += '<div class="img-text-layer img-txt-' + txtStyle + ' img-txt-light" id="imgTextLayer">';
      html += '<div class="img-text-inner">';
      if(headline) html += '<div class="itl-headline">' + _escHtml(headline) + '</div>';
      if(subtext)  html += '<div class="itl-subtext">'  + _escHtml(subtext)  + '</div>';
      if(cta)      html += '<div class="itl-cta">'      + _escHtml(cta)      + '</div>';
      html += '</div></div>';
    }

    html += '</div>'; // img-frame

    // Controls bar — only shown when there is text to overlay
    if(hasText){
      html += '<div class="img-composite-bar">';
      html += '<label class="img-toggle-label">'
        + '<input type="checkbox" id="imgTextToggle" checked onchange="_toggleImgText(this.checked)">'
        + '<span>Text overlay</span></label>';
      html += '<div class="img-color-row">';
      html += '<span class="img-bar-lbl">Text:</span>';
      html += '<button class="icb icb-light active" id="icbLight" onclick="_setImgTextColor(\'light\')">Light</button>';
      html += '<button class="icb icb-dark" id="icbDark" onclick="_setImgTextColor(\'dark\')">Dark</button>';
      html += '</div>';
      html += '</div>'; // composite-bar
    }

    html += '</div>'; // img-composite

    body.innerHTML = html;
    return;
  }

  if(type === "text"){
    if(!data.result){
      body.innerHTML = '<div class="builder-error">No content was returned.</div>';
      return;
    }
    body.innerHTML = '<div class="builder-result-text">' + _formatBrief(data.result) + '</div>';
    return;
  }

  if(type === "ads"){
    if(!data.headline && !data.body){
      body.innerHTML = '<div class="builder-error">No ad content returned.</div>';
      return;
    }
    var ahtml = '<div class="builder-ad-result">';
    if(data.title)    ahtml += '<div class="bar-title">'    + _escHtml(data.title)    + '</div>';
    if(data.headline) ahtml += '<div class="bar-headline">' + _escHtml(data.headline) + '</div>';
    if(data.body)     ahtml += '<div class="bar-body">'     + _escHtml(data.body)     + '</div>';
    if(data.cta)      ahtml += '<div class="bar-cta-row"><span class="bar-cta">' + _escHtml(data.cta) + '</span></div>';
    if(data.imageUrl) ahtml += '<img src="' + data.imageUrl + '" alt="Ad visual" class="builder-result-img" style="margin-top:18px">';
    ahtml += '</div>';
    body.innerHTML = ahtml;
    return;
  }

  if(type === "campaign"){
    var vars = (data.variations && data.variations.length) ? data.variations : null;
    if(!vars){
      body.innerHTML = '<div class="builder-error">No campaign variations were returned.</div>';
      return;
    }
    var chtml = '<div class="camp-variations">';
    vars.forEach(function(v, i){
      chtml += '<div class="camp-var-card">';
      if(v.imageUrl){
        chtml += '<div class="cvcard-img-wrap"><img src="' + v.imageUrl + '" class="cvcard-img" alt="Variation ' + (i + 1) + '"></div>';
      }
      chtml += '<div class="cvcard-body">';
      chtml += '<div class="cvcard-num">Variation ' + (i + 1) + '</div>';
      if(v.title)    chtml += '<div class="cvcard-title">'    + _escHtml(v.title)    + '</div>';
      if(v.headline) chtml += '<div class="cvcard-headline">' + _escHtml(v.headline) + '</div>';
      if(v.body)     chtml += '<div class="cvcard-text">'     + _escHtml(v.body)     + '</div>';
      if(v.cta)      chtml += '<div class="cvcard-cta-row"><span class="cvcard-cta">' + _escHtml(v.cta) + '</span></div>';
      chtml += '</div></div>';
    });
    chtml += '</div>';
    body.innerHTML = chtml;
    return;
  }

  body.innerHTML = '<div class="builder-result-text">' + _formatBrief(data.result || "") + '</div>';
}


// ── Image overlay helpers ─────────────────────────────────────

function _toggleImgText(visible){
  var layer = document.getElementById("imgTextLayer");
  if(layer) layer.style.opacity = visible ? "" : "0";
  var toggle = document.getElementById("imgTextToggle");
  if(toggle) toggle.checked = !!visible;
}

function _setImgTextColor(mode){
  var layer = document.getElementById("imgTextLayer");
  if(!layer) return;
  layer.classList.remove("img-txt-light","img-txt-dark");
  layer.classList.add("img-txt-" + mode);
  document.querySelectorAll(".icb").forEach(function(b){ b.classList.remove("active"); });
  var btn = document.getElementById(mode === "light" ? "icbLight" : "icbDark");
  if(btn) btn.classList.add("active");
}


// ── builderSave — save last result to Studio ─────────────────

function builderSave(){
  if(!S._lastBuilderResult) return;

  var type = S._lastBuilderResult.type;
  var data = S._lastBuilderResult.data;
  var bc   = S.brandCore;

  var labelMap = { image:"Image", text:"Copy", ads:"Ad Creative", campaign:"Campaign" };
  var category = labelMap[type] || "Content";

  var name = "";
  if(type === "campaign" && data.variations && data.variations.length){
    name = (data.variations[0].title || "") || (category + " \u2014 " + new Date().toLocaleDateString());
  } else {
    name = data.title || data.headline || (category + " \u2014 " + new Date().toLocaleDateString());
  }

  // Build preview text for the Studio card
  var previewText = "";
  if(type === "image"){
    var iParts = [];
    if(data.headline) iParts.push(data.headline);
    if(data.subtext)  iParts.push(data.subtext);
    if(data.cta)      iParts.push(data.cta);
    previewText = iParts.join(" \u00b7 ");
  } else if(type === "campaign" && data.variations && data.variations.length){
    previewText = data.variations.map(function(v){ return v.headline || ""; }).filter(Boolean).join(" \u00b7 ");
  } else {
    previewText = data.result || data.message || data.body || "";
  }

  var asset = {
    id:        Date.now(),
    type:      type,
    category:  category,
    name:      name,
    thumb:     data.imageUrl || null,
    preview:   previewText,
    payload:   data,
    createdAt: new Date().toISOString()
  };

  if(!S.assets) S.assets = [];
  S.assets.unshift(asset);

  if(type === "campaign"){
    if(!S.campaigns) S.campaigns = [];
    S.campaigns.unshift({ id:asset.id, name:name, assets:[asset.id], createdAt:asset.createdAt });
    if(typeof renderCampaigns === "function") renderCampaigns();
  }

  if(typeof renderAssets === "function") renderAssets();

  var saveBtn = document.getElementById("builderSaveBtn");
  if(saveBtn){ saveBtn.disabled = true; saveBtn.textContent = "Saved ✓"; }

  if(typeof toast === "function") toast("Saved to Studio");
}


// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
//  CHAT-BASED CREATE WORKSPACE
//  Used by: Brand Assistant, Video, Ideas
//  Image, Text, Ads, Campaign are now handled by the structured
//  builder above (openBuilder / runBuilder).
// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════

function openCreateWorkspace(type, outType){
  // ── Structured types → builder ─────────────────────────────
  if(type === "image" || type === "text" || type === "ads" || type === "campaign"){
    openBuilder(type);
    return;
  }

  // ── Chat-based: assistant, video, ideas ────────────────────
  var ct = CREATE_TYPES[type] || CREATE_TYPES.assistant;
  S._cwsType    = type;
  S._cwsHistory = [];

  var lbl = document.getElementById("cwsTypeLabel");
  var ico = document.getElementById("cwsTypeIcon");
  var ctx = document.getElementById("cwsContext");
  if(lbl) lbl.textContent = ct.label;
  if(ico) ico.innerHTML   = ct.icon;
  if(ctx && S.brandCore)  ctx.textContent = "Brand: " + S.brandCore.name;
  else if(ctx)            ctx.textContent = "";

  var sel = document.getElementById("cwsOutType");
  if(sel) sel.value = outType || ct.outType;

  // Show video configurator if needed, hide others
  CWS_ALL_CFGS.forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    var activeCfgId = CWS_CFG_MAP[type] || null;
    el.style.display = (id === activeCfgId) ? "" : "none";
  });

  var cwsCtrls = document.getElementById("cwsControls");
  var activeCfgId = CWS_CFG_MAP[type] || null;
  if(activeCfgId){
    if(cwsCtrls) cwsCtrls.style.display = "none";
  } else {
    if(cwsCtrls) cwsCtrls.style.display = "";
  }

  if(type === "video"){
    S._vidFormat = "short_vertical";
    videoSelectFormat("short_vertical");
  }

  var inp = document.getElementById("cwsInput");
  if(inp && !activeCfgId) inp.placeholder = ct.placeholder;

  // Welcome screen
  var feed = document.getElementById("cwsFeed");
  if(feed){
    var bc          = S.brandCore;
    var bcHint      = bc ? ' using your <strong>' + bc.name + '</strong> Brand Core' : "";
    var isAssistant = type === "assistant";

    var assistantBlock = "";
    if(isAssistant){
      var starters    = _buildAssistantStarters(bc);
      var starterHtml = starters.map(function(s){
        return '<div class="chat-sug" onclick="assistantFill(' + JSON.stringify(s) + ')">' + _escHtml(s) + '</div>';
      }).join("");
      var subline = bc
        ? 'Personalized for <strong>' + _escHtml(bc.name) + '</strong>. Select a prompt to get started, or ask anything.'
        : 'Select a prompt to get started, or ask anything about your brand.';
      assistantBlock =
        '<p class="chat-welcome-sub">' + subline + '</p>'
        + '<div class="chat-suggestions ast-starters">' + starterHtml + '</div>';
    }

    feed.innerHTML =
      '<div class="chat-welcome">'
      + '<div class="chat-welcome-icon"><svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.4" width="28" height="28"><path d="M14 3L17 10H24L19 14L21 21L14 17L7 21L9 14L4 10H11Z"/></svg></div>'
      + '<h2>' + (isAssistant ? "Brand Assistant" : "Create " + ct.label) + '</h2>'
      + '<p>' + (isAssistant ? t("welcomeMsg") : "Describe what you want to create" + bcHint + ". I will generate it for you.") + '</p>'
      + assistantBlock
      + '</div>';
  }

  navigate("create-workspace");
}


// ════════════════════════════════════════════════════════════════
// renderBubble — format AI responses for chat-based tools
// ════════════════════════════════════════════════════════════════

function _escHtml(s){
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function _formatBrief(raw){
  var s = _escHtml(raw);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|\n)([A-Z][A-Z /]+:)/g, "$1<strong>$2</strong>");
  s = s.replace(/(^|\n)(\d+\.\s)/g, "$1<br>$2");
  s = s.replace(/\n\n/g, "<br><br>");
  s = s.replace(/\n/g, "<br>");
  return s;
}

function renderBubble(type, data){
  if(data.error) return _escHtml(data.error);
  if(type === "video"){
    if(!data.result) return "No video brief received.";
    return _formatBrief(data.result);
  }
  if(!data.result) return "No response received.";
  return _formatBrief(data.result);
}


// ════════════════════════════════════════════════════════════════
// cwsSaveToStudio — used by chat-based tool save buttons
// ════════════════════════════════════════════════════════════════

function cwsSaveToStudio(btn){
  if(!btn) return;
  var type    = btn.getAttribute("data-type") || "content";
  var payload = {};
  try { payload = JSON.parse(btn.getAttribute("data-payload") || "{}"); } catch(_){}

  var labelMap = { video:"Video Brief", assistant:"Brand Note", ideas:"Idea" };
  var category = labelMap[type] || "Content";
  var name     = payload.title || (category + " " + new Date().toLocaleDateString());
  var preview  = payload.result || payload.message || payload.body || "";

  var asset = {
    id:        Date.now(),
    type:      type,
    category:  category,
    name:      name,
    thumb:     null,
    preview:   preview,
    payload:   payload,
    createdAt: new Date().toISOString()
  };

  if(!S.assets) S.assets = [];
  S.assets.unshift(asset);
  if(typeof renderAssets === "function") renderAssets();

  btn.disabled    = true;
  btn.textContent = "Saved";
  btn.classList.add("cws-save-btn-done");
  if(typeof toast === "function") toast("Saved to Studio");
}


// ════════════════════════════════════════════════════════════════
// sendCWS — chat generation (assistant, video, ideas only)
// ════════════════════════════════════════════════════════════════

async function sendCWS(){
  var input = document.getElementById("cwsInput");
  if(!input) return;
  var prompt = input.value.trim();
  if(!prompt) return;

  if(typeof gateUsage === "function"){
    var allowed = await gateUsage();
    if(!allowed) return;
  }

  input.value = "";
  input.style.height = "auto";

  if(!S._cwsHistory) S._cwsHistory = [];
  S._cwsHistory.push({ role:"user", text:prompt });

  var feed = document.getElementById("cwsFeed");
  if(!feed) return;

  var welcome = feed.querySelector(".chat-welcome");
  if(welcome) welcome.remove();

  var ud = document.createElement("div");
  ud.className = "chat-msg user";
  ud.innerHTML = '<div class="chat-bubble user-bubble">' + _escHtml(prompt) + "</div>";
  feed.appendChild(ud);
  feed.scrollTop = feed.scrollHeight;

  var tid  = "cws-typing-" + Date.now();
  var tdiv = document.createElement("div");
  tdiv.id        = tid;
  tdiv.className = "chat-msg ai";
  tdiv.innerHTML = '<div class="chat-ai-avatar"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 2L12.5 7.5H18L13.5 11L15 16.5L10 13.5L5 16.5L6.5 11L2 7.5H7.5Z"/></svg></div>'
    + '<div class="chat-bubble ai-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>';
  feed.appendChild(tdiv);
  feed.scrollTop = feed.scrollHeight;

  var cwsType = S._cwsType || "assistant";

  var finalPrompt;
  if     (cwsType === "video")     finalPrompt = buildVideoPrompt(prompt);
  else if(cwsType === "assistant") finalPrompt = buildAssistantPrompt(prompt);
  else                             finalPrompt = prompt;

  var endpoint = API_BASE_URL+"/api/generate-text";

  fetch(endpoint, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ prompt: finalPrompt, type: cwsType })
  })
  .then(function(res){ return res.json(); })
  .then(function(data){
    var tel = document.getElementById(tid);
    if(tel) tel.remove();

    var ad = document.createElement("div");
    ad.className = "chat-msg ai";
    var bubbleContent = renderBubble(cwsType, data);
    var saveRow = !data.error
      ? '<div class="cws-save-row"><button class="cws-save-btn" onclick="cwsSaveToStudio(this)" data-type="' + cwsType + '" data-payload=\'' + JSON.stringify(data).replace(/'/g, "&#39;") + '\'>Save to Studio</button></div>'
      : "";
    ad.innerHTML =
      '<div class="chat-ai-avatar"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 2L12.5 7.5H18L13.5 11L15 16.5L10 13.5L5 16.5L6.5 11L2 7.5H7.5Z"/></svg></div>'
      + '<div class="chat-bubble ai-bubble">' + bubbleContent + saveRow + "</div>";
    feed.appendChild(ad);
    feed.scrollTop = feed.scrollHeight;
    S._cwsHistory.push({ role:"ai", text:"[" + cwsType + " response]" });
  })
  .catch(function(err){
    console.error("[CWS/" + cwsType + "] error:", err);
    var tel = document.getElementById(tid);
    if(tel) tel.remove();

    var ad = document.createElement("div");
    ad.className = "chat-msg ai";
    ad.innerHTML =
      '<div class="chat-ai-avatar"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M10 2L12.5 7.5H18L13.5 11L15 16.5L10 13.5L5 16.5L6.5 11L2 7.5H7.5Z"/></svg></div>'
      + '<div class="chat-bubble ai-bubble">Could not connect to ORIVEN services. Please try again.</div>';
    feed.appendChild(ad);
    feed.scrollTop = feed.scrollHeight;
  });
}


// ════════════════════════════════════════════════════════════════
// Input wiring
// ════════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", function(){
  var ci = document.getElementById("cwsInput");
  if(ci){
    ci.addEventListener("keydown", function(e){
      if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); sendCWS(); }
    });
    ci.addEventListener("input", function(){
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });
  }
});
