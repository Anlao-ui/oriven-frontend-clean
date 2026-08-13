// ════════════════════════════════════════════════════════════════
// ORIVEN — Settings
//
// Persistence: localStorage key "oriven_settings" (JSON object).
// initSettings() is called on DOMContentLoaded to apply saved state.
// Each handler saves its slice via saveSettings(patch).
// ════════════════════════════════════════════════════════════════

// ── Persistence ────────────────────────────────────────────────

var SETTINGS_KEY = "oriven_settings";

var SETTINGS_DEFAULTS = {
  wsName:            "My Workspace",
  theme:             "light",
  accent:            "green",
  language:          "en",
  notifBrandCheck:   true,
  notifGenComplete:  true,
  notifUpdates:      true,
  notifAutopilot:    true,
  autoSave:          true,
  aiLearning:        true,
  brandConsistency:  true,
  generationHistory: true,
  generatorView:     "grid",
  // "free" is the only safe default — paid plans must be explicitly granted.
  // In production this value is overwritten on sign-in from the backend/Stripe.
  currentPlan:      "free",
  planRenewalDate:  null,
  pendingPlan:      null,
  pendingPlanDate:  null
};

// Plan data lives in plans.js (ORIVEN_PLANS / ORIVEN_PLAN_LIST / ORIVEN_PAID_PLANS).
// settings.js reads from those globals — do not duplicate plan definitions here.

function loadSettings(){
  try {
    var raw = localStorage.getItem(SETTINGS_KEY);
    if(raw) return Object.assign({}, SETTINGS_DEFAULTS, JSON.parse(raw));
  } catch(_){}
  return Object.assign({}, SETTINGS_DEFAULTS);
}

function saveSettings(patch){
  var current = loadSettings();
  var updated = Object.assign(current, patch);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated)); } catch(_){}
  // Settings Completion — every save also persists to the account (not just
  // this browser), so preferences survive logout/login and follow the user
  // to another device. Fire-and-forget: localStorage already made this feel
  // instant, the DB write is a background sync, never blocks the UI.
  _pushPreferencesToDB(patch);
  return updated;
}

function _pushPreferencesToDB(patch){
  if(typeof apiFetch !== "function") return;
  apiFetch("/api/user/preferences", { method: "PUT", body: JSON.stringify(patch) }).catch(function(){});
}

// Pulls the account's saved preferences and reconciles them into the local
// cache + UI. Safe to call before a session exists (apiFetch/401 just no-ops)
// — called once at boot and again whenever Settings is opened, so a change
// made on another device shows up here too.
async function _syncPreferencesFromDB(){
  if(typeof apiFetch !== "function") return;
  try {
    var res = await apiFetch("/api/user/preferences");
    if(!res || !res.ok || !res.data || !res.data.preferences) return;
    var dbPrefs = res.data.preferences;
    var merged = Object.assign({}, loadSettings(), dbPrefs);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged)); } catch(_){}
    _applySettingsToUI(merged);
  } catch(_){}
}

// ── Apply all saved settings to the UI on page load ────────────

function initSettings(){
  var cfg = loadSettings();
  _applySettingsToUI(cfg);

  // Profile email
  _loadProfileEmail();

  // Plan section
  initPlan();

  // Reconcile with the account's saved preferences (covers logout/login on
  // this device and changes made on another device) — non-blocking.
  _syncPreferencesFromDB();
}

// Shared by initSettings() (local, instant, no flash) and
// _syncPreferencesFromDB() (once the account's real preferences are known).
function _applySettingsToUI(cfg){
  // Theme first (sets dark-mode class), then accent on top of it
  _applyTheme(cfg.theme);
  _applyAccent(cfg.accent || "green");

  // Workspace name
  var wsInp = document.getElementById("wsNameInp");
  if(wsInp) wsInp.value = cfg.wsName || "";
  _updateSidebarName(cfg.wsName);

  // Language — set dropdown + apply strings
  CURRENT_LANG = cfg.language || "en";
  var langSel = document.getElementById("langSelect");
  if(langSel) langSel.value = CURRENT_LANG;
  applyLanguage();

  // Notification toggles
  var ng = document.getElementById("tglNotifGenComplete");
  var nu = document.getElementById("tglNotifUpdates");
  var np = document.getElementById("tglNotifPublish");
  var nb = document.getElementById("tglNotifBilling");
  var na = document.getElementById("tglNotifAutopilot");
  if(ng) ng.classList.toggle("on", cfg.notifGenComplete !== false);
  if(nu) nu.classList.toggle("on", cfg.notifUpdates !== false);
  if(np) np.classList.toggle("on", cfg.notifPublish !== false);
  if(nb) nb.classList.toggle("on", cfg.notifBilling !== false);
  if(na) na.classList.toggle("on", cfg.notifAutopilot !== false);
}


// ════════════════════════════════════════════════════════════════
// WORKSPACE / PROFILE
// ════════════════════════════════════════════════════════════════

function saveWsName(){
  var inp = document.getElementById("wsNameInp");
  if(!inp) return;
  var name = inp.value.trim();
  if(!name){ toast("Enter a workspace name", "warn"); return; }
  saveSettings({ wsName: name });
  _updateSidebarName(name);
  toast("Workspace updated");
}

function _updateSidebarName(name){
  if(!name) return;
  var el1 = document.getElementById("sidebarUserName");
  var el2 = document.getElementById("orvSbName");
  var initial = name.trim().charAt(0).toUpperCase() || "A";
  if(el1) el1.textContent = name;
  if(el2) el2.textContent = name;
  var sbAvatar = document.getElementById("orvSbAvatar");
  if(sbAvatar) sbAvatar.textContent = initial;
  var apAvatar = document.getElementById("apNavAvatar");
  if(apAvatar) apAvatar.textContent = initial;
}

async function _loadProfileEmail(){
  try {
    var res = await SB.auth.getSession();
    var session = res && res.data && res.data.session;
    if(session && session.user){
      var emailInp = document.getElementById("acctEmailInp");
      if(emailInp) emailInp.value = session.user.email || "";
      var provider = (session.user.app_metadata && session.user.app_metadata.provider) || "email";
      var authEl = document.getElementById("profileAuthVal");
      if(authEl) authEl.textContent = provider === "google" ? "Google" : "Email & Password";
      /* OAuth accounts have no ORIVEN-managed password/email to change — Google owns that. */
      var isOAuth = provider !== "email";
      var emailSaveBtn = document.getElementById("acctEmailSaveBtn");
      var pwSection = document.getElementById("acctPasswordSection");
      if(emailInp) emailInp.disabled = isOAuth;
      if(emailSaveBtn) emailSaveBtn.disabled = isOAuth;
      if(pwSection) pwSection.style.display = isOAuth ? "none" : "";
      var emailHint = document.getElementById("acctEmailHint");
      if(emailHint){
        if(isOAuth){
          emailHint.textContent = "Managed by your Google account — sign in with Google to change it.";
          emailHint.style.display = "";
          emailHint.style.color = "";
        } else {
          emailHint.style.display = "none";
        }
      }
    }
  } catch(_){}
}

async function sendPasswordReset(){
  try {
    var res = await SB.auth.getSession();
    var session = res && res.data && res.data.session;
    if(!session || !session.user){ toast("Not signed in", "warn"); return; }
    await SB.auth.resetPasswordForEmail(session.user.email, { redirectTo: window.location.origin + '/app' });
    toast("Password reset email sent");
  } catch(err){
    toast("Could not send reset email — try again", "err");
  }
}

function _emailLooksValid(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function saveAccountEmail(){
  var inp = document.getElementById("acctEmailInp");
  var btn = document.getElementById("acctEmailSaveBtn");
  var hint = document.getElementById("acctEmailHint");
  if(!inp) return;
  var newEmail = inp.value.trim();

  var showHint = function(msg, isErr){
    if(!hint) return;
    hint.textContent = msg;
    hint.style.display = "";
    hint.style.color = isErr ? "#ef4444" : "";
  };

  if(!newEmail || !_emailLooksValid(newEmail)){
    showHint("Enter a valid email address.", true);
    return;
  }

  try {
    var res = await SB.auth.getSession();
    var session = res && res.data && res.data.session;
    if(!session || !session.user){ toast("Not signed in", "warn"); return; }
    if(newEmail === session.user.email){
      showHint("That's already your current email.", false);
      return;
    }

    if(btn){ btn.disabled = true; btn.textContent = "Saving…"; }
    var upd = await SB.auth.updateUser({ email: newEmail }, { emailRedirectTo: window.location.origin + '/app' });
    if(btn){ btn.disabled = false; btn.textContent = "Save"; }

    if(upd && upd.error){
      var msg = upd.error.message || "Could not update email.";
      if(/already|registered|exists|taken/i.test(msg)) msg = "That email is already in use by another account.";
      showHint(msg, true);
      toast("Email update failed", "err");
      return;
    }

    showHint("Check " + newEmail + " to confirm the change — your current email stays active until then.", false);
    toast("Confirmation email sent");
  } catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Save"; }
    showHint("Could not update email — try again.", true);
    toast("Email update failed", "err");
  }
}

async function saveAccountPassword(){
  var curInp = document.getElementById("acctPwCurrentInp");
  var newInp = document.getElementById("acctPwNewInp");
  var confInp = document.getElementById("acctPwConfirmInp");
  var btn = document.getElementById("acctPwSaveBtn");
  var hint = document.getElementById("acctPwHint");
  if(!curInp || !newInp || !confInp) return;

  var showHint = function(msg, isErr){
    if(!hint) return;
    hint.textContent = msg;
    hint.style.display = "";
    hint.style.color = isErr ? "#ef4444" : "";
  };

  var current = curInp.value;
  var next = newInp.value;
  var confirm = confInp.value;

  if(!current){ showHint("Enter your current password.", true); return; }
  if(!next || next.length < 8){ showHint("New password must be at least 8 characters.", true); return; }
  if(next !== confirm){ showHint("New passwords don't match.", true); return; }
  if(next === current){ showHint("New password must be different from your current password.", true); return; }

  try {
    var res = await SB.auth.getSession();
    var session = res && res.data && res.data.session;
    if(!session || !session.user){ toast("Not signed in", "warn"); return; }

    if(btn){ btn.disabled = true; btn.textContent = "Updating…"; }

    /* Verify the current password before allowing the change. */
    var verify = await SB.auth.signInWithPassword({ email: session.user.email, password: current });
    if(verify && verify.error){
      if(btn){ btn.disabled = false; btn.textContent = "Update Password"; }
      showHint("Current password is incorrect.", true);
      return;
    }

    var upd = await SB.auth.updateUser({ password: next });
    if(btn){ btn.disabled = false; btn.textContent = "Update Password"; }

    if(upd && upd.error){
      showHint(upd.error.message || "Could not update password.", true);
      toast("Password update failed", "err");
      return;
    }

    curInp.value = ""; newInp.value = ""; confInp.value = "";
    showHint("Password updated.", false);
    toast("Password updated successfully");
  } catch(err){
    if(btn){ btn.disabled = false; btn.textContent = "Update Password"; }
    showHint("Could not update password — try again.", true);
    toast("Password update failed", "err");
  }
}

function _updateHint(id, isOn, onText, offText){
  var el = document.getElementById(id);
  if(!el) return;
  el.textContent = isOn ? onText : offText;
  el.classList.toggle("se-tgl-hint--off", !isOn);
}


// ════════════════════════════════════════════════════════════════
// APPEARANCE — THEME
// ════════════════════════════════════════════════════════════════

function setTheme(mode){
  _applyTheme(mode);
  // Re-apply accent because dark-mode CSS vars override :root values
  _applyAccent(loadSettings().accent || "green");
  saveSettings({ theme: mode });
  toast(mode === "dark" ? "Dark mode" : mode === "system" ? "Using system theme" : "Light mode");
}

function _applyTheme(mode){
  if(mode === "system"){
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.toggle("dark-mode", prefersDark);
  } else {
    document.body.classList.toggle("dark-mode", mode === "dark");
  }
  var tl = document.getElementById("themeLight");
  var td = document.getElementById("themeDark");
  var ts = document.getElementById("themeSystem");
  if(tl) tl.classList.toggle("active", mode === "light" || !mode);
  if(td) td.classList.toggle("active", mode === "dark");
  if(ts) ts.classList.toggle("active", mode === "system");
}


// ════════════════════════════════════════════════════════════════
// APPEARANCE — ACCENT COLOR
// ════════════════════════════════════════════════════════════════

// Each palette has light/dark variants for:
//   --green  (darkest — primary buttons, strong UI)
//   --gm     (medium — active states, focus rings, hover fills)
//   --glt    (light  — subtle backgrounds, selected pill fills)
//   --gpale  (pale   — hover backgrounds, very light tints)

var ACCENT_PALETTES = {
  green: {
    light: { green:"#B7FF2A", gm:"#9FE81F", glt:"rgba(183,255,42,0.07)", gpale:"rgba(183,255,42,0.04)", deep:"#0A0A0A" },
    dark:  { green:"#B7FF2A", gm:"#9FE81F", glt:"rgba(183,255,42,0.08)", gpale:"rgba(183,255,42,0.05)", deep:"#000000" }
  },
  blue: {
    light: { green:"#1e3a5f", gm:"#1971C2", glt:"#DBEAFE", gpale:"#EFF6FF", deep:"#0D1F3C" },
    dark:  { green:"#1c4ed8", gm:"#3b82f6", glt:"#172554", gpale:"#1e3058", deep:"#0A1628" }
  },
  purple: {
    light: { green:"#3b0764", gm:"#7C3AED", glt:"#EDE9FE", gpale:"#F5F3FF", deep:"#1E0336" },
    dark:  { green:"#5b21b6", gm:"#8B5CF6", glt:"#2e1065", gpale:"#1e1b4b", deep:"#120022" }
  },
  red: {
    light: { green:"#7f1d1d", gm:"#DC2626", glt:"#FEE2E2", gpale:"#FEF2F2", deep:"#450A0A" },
    dark:  { green:"#991b1b", gm:"#EF4444", glt:"#450a0a", gpale:"#3b0808", deep:"#2C0000" }
  },
  orange: {
    light: { green:"#7c2d12", gm:"#EA580C", glt:"#FFEDD5", gpale:"#FFF7ED", deep:"#431407" },
    dark:  { green:"#9a3412", gm:"#F97316", glt:"#431407", gpale:"#2c1000", deep:"#2C0E00" }
  },
  pink: {
    light: { green:"#831843", gm:"#DB2777", glt:"#FCE7F3", gpale:"#FDF2F8", deep:"#4A0E2A" },
    dark:  { green:"#9d174d", gm:"#EC4899", glt:"#4a0e28", gpale:"#2d0019", deep:"#200010" }
  }
};

function setAccent(name){
  _applyAccent(name);
  saveSettings({ accent: name });
  toast("Accent color updated");
}

// Sets accent CSS custom properties directly on body as inline styles,
// which takes precedence over both :root and body.dark-mode stylesheet rules.
function _applyAccent(name){
  var isDark   = document.body.classList.contains("dark-mode");
  var palette  = ACCENT_PALETTES[name] || ACCENT_PALETTES.green;
  var vars     = isDark ? palette.dark : palette.light;

  document.body.style.setProperty("--green",      vars.green);
  document.body.style.setProperty("--gm",         vars.gm);
  document.body.style.setProperty("--glt",        vars.glt);
  document.body.style.setProperty("--gpale",      vars.gpale);
  document.body.style.setProperty("--green-deep", vars.deep);

  // Update picker active state
  document.querySelectorAll(".accent-swatch").forEach(function(el){
    el.classList.toggle("active", el.dataset.accent === name);
  });
}


// ════════════════════════════════════════════════════════════════
// LANGUAGE
// ════════════════════════════════════════════════════════════════

var CURRENT_LANG = "en";

var LANG_STRINGS = {
  en:{
    // Navigation
    dashboard:"Dashboard", create:"Create", studio:"BrandCore",
    inspiration:"Inspiration", settings:"Settings",
    // Greetings
    goodMorning:"Good morning", goodAfternoon:"Good afternoon",
    goodEvening:"Good evening", goodNight:"Good night",
    // Dashboard / FAB
    brandAssistant:"Oriven", openAIChat:"Start Creating",
    // Studio
    savedAssets:"Saved Assets", brandCore:"Brand Core",
    brandCheck:"Brand Check", campaigns:"Campaigns",
    // Settings nav
    workspace:"Workspace", plan:"Your Plan", appearance:"Appearance", language:"Language",
    notifications:"Notifications", exportPref:"Export", brandReset:"Brand Reset",
    // Appearance labels
    themeLabel:"Theme", lightMode:"Light Mode", darkMode:"Dark Mode",
    accentLabel:"Accent Color",
    accentHelp:"Choose the highlight color used across buttons, active states, and UI elements.",
    // Empty states
    noItems:"No saved assets yet",
    createContent:"Generate content in AI Chat and save it here.",
    // Welcome
    welcomeMsg:"How can I support your brand today?",
    // Create page
    createSub:"Choose a creation type to get started. Your Brand Core shapes every output.",
    imageTitle:"Visuals",     imageDesc:"Generate on-brand visuals, ads, and social media designs.",
    textTitle:"Text",        textDesc:"Generate captions, headlines, and brand copy.",
    campaignTitle:"Campaign",campaignDesc:"Build full campaigns with visuals and copy.",
    videoTitle:"Video",      videoDesc:"Create video ideas, scripts, and concepts.",
    webTitle:"Web",          webDesc:"Build brand-aligned landing pages and web assets.",
    assistantDesc:"Ask your brand AI for guidance, ideas, and creative direction.",
    comingSoon:"Coming soon",
    // Sidebar identity
    brandWorkspace:"Brand Workspace", signOut:"Sign out",
    // Dashboard headline & tagline
    dashHeadlinePrefix:"Your brand is", dashHeadlineHighlight:"ready.",
    dashTagline:"Let's turn it into content, ads, and growth.",
    // Dashboard action cards
    dashCreateLabel:"Create Content",   dashCreateDesc:"Images, copy, video scripts, and more.",
    dashIdeasLabel:"Explore Ideas",     dashIdeasDesc:"Content ideas, ad angles, and campaign concepts.",
    dashCampaignLabel:"Build Campaign", dashCampaignDesc:"Full multi-channel campaigns end to end.",
    dashBrandLabel:"Edit Brand Core",   dashBrandDesc:"Colors, fonts, tone of voice, and identity.",
    // Dashboard snapshot
    edit:"Edit", setUp:"Set up", notConfigured:"Not configured",
    buildBrandIdentity:"Build your brand identity to get started.",
    setUpBrandCore:"Set up your Brand Core →",
    // Create page
    createH1Line1:"What would you like to", createH1Line2:"create today?",
    // Studio hub
    brandStudioTitle:"Brand Studio", brandStudioSub:"Everything that defines and drives your brand.",
    studioSavedLabel:"Saved",    studioSavedDesc:"All your generated content and assets.",
    studioBCDesc:"Colors, fonts, tone of voice, and identity.",
    studioCheckLabel:"Brand Check", studioCheckDesc:"Analyze content for brand consistency.",
    studioCampDesc:"Manage and launch your active campaigns.",
    studioBackBtn:"Back",
    // Studio: empty states + actions
    noBCConfigured:"No Brand Core configured yet",
    noBCConfiguredSub:"Set up your brand identity to unlock AI generation.",
    aiGenerateBtn:"AI Generate", manualSetupBtn:"Manual Setup",
    savedAssetsHeader:"Saved Assets",
    openAIChatBtn:"Open AI Chat",
    noCampaignsTitle:"No campaigns yet",
    noCampaignsSub:"Bundle saved assets into visual campaign concepts for social media and ads.",
    newCampaignBtn:"+ New Campaign",
    // Brand Check
    dropImageTitle:"Drop your image here",
    dropImageSub:"PNG, JPG, or WEBP — drag and drop or click to browse",
    checkBrandNoImgBtn:"Check Brand Without Image",
    readyForCheck:"Ready for brand check",
    runBrandCheckBtn:"Run Brand Check", resetBtn:"Reset", removeBtn:"Remove",
    analyzingBrand:"Analyzing brand consistency...",
    checkingDetails:"Checking colors, typography, and visual style",
    // Ideas hub
    ideasTitle:"Ideas", ideasSub:"Proven frameworks to spark your next piece of content.",
    contentIdeasLabel:"Content Ideas",      contentIdeasDesc:"Posts, stories, and formats that build audiences.",
    adAnglesLabel:"Ad Angles",             adAnglesDesc:"Messaging frameworks that turn attention into action.",
    visualStylesLabel:"Visual Styles",     visualStylesDesc:"Aesthetic directions for your brand's visual identity.",
    campaignConceptsLabel:"Campaign Concepts", campaignConceptsDesc:"End-to-end structures that drive real results.",
    // Ideas panel titles
    idContentTitle:"Content Ideas", idAnglesTitle:"Ad Angles",
    idVisualTitle:"Visual Styles",  idCampaignTitle:"Campaign Concepts",
    // Ideas button labels per category
    idContentUseLabel:"Use this idea",       idContentGenLabel:"Generate post",
    idAnglesUseLabel:"Try this angle",       idAnglesGenLabel:"Generate ad",
    idVisualUseLabel:"Use this style",       idVisualGenLabel:"Generate visual",
    idCampaignUseLabel:"Build this campaign",idCampaignGenLabel:"Generate assets",
    // Ideas: content idea labels
    idCont0Label:"Educational Posts",   idCont1Label:"Product Spotlight",
    idCont2Label:"Founder Story",       idCont3Label:"Transformation Story",
    idCont4Label:"Customer Result",     idCont5Label:"Comparison Post",
    idCont6Label:"Myth vs. Truth",      idCont7Label:"Before / After",
    idCont8Label:"Routine / Workflow",  idCont9Label:"Authority Builder",
    // Ideas: ad angle labels
    idAng0Label:"Problem → Solution",   idAng1Label:"Aspiration",
    idAng2Label:"Transformation",       idAng3Label:"Urgency",
    idAng4Label:"Scarcity",             idAng5Label:"Pain Point Agitation",
    idAng6Label:"Social Proof",         idAng7Label:"Premium Positioning",
    idAng8Label:"Benefit-First",        idAng9Label:"Emotional Hook",
    // Ideas: visual style labels
    idVis0Label:"Luxury Minimal",       idVis1Label:"Bold Modern",
    idVis2Label:"Dark Premium",         idVis3Label:"Soft Lifestyle",
    idVis4Label:"Editorial Clean",      idVis5Label:"High Contrast",
    idVis6Label:"Futuristic Sleek",     idVis7Label:"Organic Natural",
    idVis8Label:"Sporty Performance",   idVis9Label:"Elegant Feminine",
    // Ideas: campaign concept labels
    idCamp0Label:"Product Launch",      idCamp1Label:"Brand Awareness",
    idCamp2Label:"Seasonal Drop",       idCamp3Label:"Conversion Push",
    idCamp4Label:"Educational Funnel",  idCamp5Label:"Retargeting Sequence",
    idCamp6Label:"Limited Offer Sprint",idCamp7Label:"Founder-Led Campaign",
    idCamp8Label:"Testimonial-Driven",  idCamp9Label:"Community Campaign",
    // Team
    teamTitle:"Team", teamSub:"Manage your Business workspace team.",
    // Settings structural
    settingsTitle:"Settings", settingsSub:"Manage your workspace and preferences.",
    spWorkspaceSub:"Manage your brand workspace details and preferences.",
    wsNameLabel:"Workspace Name",
    wsNameHelp:"This is the name of your workspace inside ORIVEN. It appears in your sidebar and throughout the app.",
    saveBtn:"Save",
    brandLockLabel:"Brand Lock", lockBCLabel:"Lock BrandCore",
    lockBCSub:"When enabled, your BrandCore stays fixed and is applied consistently across all generated content. Disable to make changes to your brand setup.",
    spAppearanceSub:"Choose how ORIVEN looks and feels. Your preference is saved and persists across sessions.",
    spLanguageSub:"Set the display and content generation language for your workspace. Your selection is saved and applied on every session.",
    langDisplayLabel:"Display & Generation Language",
    langDisplayHelp:"ORIVEN will use this language for interface labels and when generating content with your BrandCore.",
    spNotificationsSub:"Control in-app notifications. Changes are saved immediately.",
    notifBrandCheckLabel:"Brand Check alerts",
    notifBrandCheckSub:"Show a notification when your Brand Check score drops below 70%.",
    notifGenCompleteLabel:"Generation complete",
    notifGenCompleteSub:"Notify you when AI finishes generating content.",
    notifUpdatesLabel:"Product updates",
    notifUpdatesSub:"Receive in-app announcements about new ORIVEN features and improvements.",
    spExportTitle:"Export Preferences", spExportSub:"Control how your generated content is prepared for export and download.",
    expFormatLabel:"Default Export Format",
    expFormatHelp:"Choose the default file format when downloading generated assets. You can always change the format at the point of export.",
    autoSaveLabel:"Auto-save generated content",
    autoSaveSub:"Automatically save your workspace changes and generated content to Studio. When enabled, every generation is stored without requiring a manual save.",
    spDangerSub:"Permanent actions — these cannot be undone.",
    resetBCTitle:"Reset Brand Core",
    resetBCDesc:"This resets your entire brand setup — colors, tone of voice, positioning, and identity data. Your generated assets saved in Studio will not be affected, but all future generations will lose brand context until you create a new BrandCore. This action is permanent and cannot be reversed.",
    resetBCBtn:"Reset Brand Core",
    // Banner
    // Builder
    // Settings Completion — current live sidebar/workspace titles (Oriven 1.0)
    navLaunch:"Launch", navCampaigns:"Campaigns", navIntelligence:"Intelligence", navAutopilot:"Autopilot", navBusiness:"Business", navSettings:"Settings",
    wsTitleIntelligence:"Intelligence", wsSubIntelligence:"What deserves your attention today.",
    wsTitleBusiness:"Business", wsSubBusiness:"Teach Oriven your business once — every campaign, conversation, and recommendation uses it automatically from then on.",
    wsTitleAutopilot:"Autopilot", wsSubAutopilot:"Automates repetitive advertising work. Nothing more.",
    wsTitlePerformance:"Performance", wsSubPerformance:"How are your campaigns performing?",
    wsTitleCampaigns:"Campaigns", wsSubCampaigns:"Manage your campaigns — drafts, active, and archived.",
    hubTabOverview:"Overview", hubTabLiveCampaigns:"Live Campaigns", hubTabDrafts:"Drafts",
    // Final i18n pass — toasts, validation, confirms (app.html + auth.js)
    toastTypographyComingSoon:"Typography editor coming soon", toastToneComingSoon:"Tone editor coming soon",
    toastPositioningComingSoon:"Positioning editor coming soon", toastSavedDraft:"Saved as draft",
    toastEnterCampaignName:"Enter a campaign name", toastEnterCampaignGoal:"Enter your campaign goal",
    toastDescribeBusiness:"Describe your business or product", toastSelectCreativeFormat:"Select at least one creative format",
    toastCopied:"Copied!", toastChangesApplied:"Changes applied", toastCopiedClipboard:"Copied to clipboard",
    toastAddModuleComingSoon:"Add Module — coming soon", toastRegenerating:"Regenerating…", toastRegenerated:"Regenerated",
    toastRegenerationFailed:"Regeneration failed — try again", toastCampaignExported:"Campaign exported",
    toastCampaignDuplicated:"Campaign duplicated", toastCampaignQueued:"Campaign queued for publishing",
    toastCampaignNotFound:"Campaign data not found", toastNoPlatformSet:"No platform set for this campaign",
    toastCampaignPublishedTo:"Campaign published to", toastPublishFailedPrefix:"Publish failed:",
    toastCampaignPaused:"Campaign paused", toastCampaignResumed:"Campaign resumed",
    toastCampaignArchived:"Campaign archived", toastCampaignDeleted:"Campaign deleted",
    toastDescribeAdvertise:"Describe what you'd like to advertise", toastDescribeSelling:"Describe what you're selling",
    toastChooseGoal:"Choose a goal", toastSelectPlatform:"Select at least one platform",
    toastComingSoon:"coming soon", toastActiveAccountUpdated:"Active account updated",
    toastFailedSetAccount:"Failed to set account — please try again", toastNetworkError:"Network error — please try again",
    toastConnectionFailed:"Connection failed — please try again.", toastConnectionFailedShort:"Connection failed.",
    toastDisconnectFailed:"Disconnect failed — please try again.", toastEnterWebsiteUrl:"Enter a website URL first.",
    toastWebsiteAnalysed:"Website analysed. Business Knowledge updated.",
    toastWebsiteAnalyseFailed:"Could not analyse that website. Check the URL and try again.",
    toastSelectDestinationAccount:"Please select a destination account first",
    toastReportNeedsAccount:"Report generation requires a connected ad account.",
    toastNoReportsYet:"No reports to export yet. Generate a report first.", toastCampaignGenerated:"Campaign generated",
    toastPublishingToEllipsis:"Publishing to", toastPublishErrorPrefix:"Publish error:",
    toastImagePromptCopied:"Image prompt copied", toastNoPackageYet:"No package generated yet",
    toastPackageCopied:"Campaign package copied to clipboard", toastEnterCampaignDesc:"Please enter a campaign description.",
    toastEngineNotLoaded:"Generation engine not loaded. Please refresh.", toastGenerationFailedPrefix:"Campaign generation failed:",
    toastConnectedSuffix:"connected!", toastDisconnectedSuffix:"disconnected.",
    toastConnectingEllipsis:"Connecting…", btnConnectPlatformSuffix:"Ads →", btnConnectingPlatform:"Connecting…",
    confirmDisconnectPlatform:"Disconnect {platform}? Live analytics will stop but your campaign data will be kept.",
    toastSavedBizKnowledge:"Saved successfully. Business Knowledge updated.", toastCouldNotSave:"Could not save. Please try again.",
    toastSignedOut:"Signed out", toastProfileLoadFailed:"Profile failed to load — please refresh the page.",
    toastPleaseSignIn:"Please sign in first", toastVerificationSent:"Verification email sent — check your inbox",
    toastCouldNotSendPrefix:"Could not send —", toastEmailVerified:"Email verified — your account is confirmed!",
    toastVerificationInvalid:"Verification link is invalid or already used. Request a new one.",
    toastBrandCoreSavedCloud:"Brand Core saved to cloud", toastCheckoutFailed:"Could not start checkout — please try again",
    toastCheckoutCanceled:"Checkout canceled — you can upgrade anytime.",
    toastSubscriptionActive:"Your subscription is now active — welcome to ORIVEN!",
    toastPaymentReceived:"Payment received — activating your account...",
    toastSubscriptionPending:"Subscription pending — please refresh in a moment.",
    toastPlatformConnectedSuccess:"connected successfully!",
    // Launch page
    launchH1:"Launch your next campaign.", genModeImage:"Image", genModeVideo:"Video",
    attachImageBtn:"Attach Image", launchPromptPlaceholder:"What would you like to advertise today? e.g. A gym clothing brand targeting young men in Amsterdam. Budget €30/day.",
    currentlyWorkingWith:"Currently working with", setUpBusinessCta:"Set up your business to personalise every campaign →",
    addMoreImages:"Add more", generatingEllipsis:"Generating…",
    // Intelligence page
    intelMonitorBtn:"Monitored campaigns", intelBriefingHeading:"Executive Briefing", intelPriorityHeading:"Highest Priority",
    intelWatchlistHeading:"Watchlist", intelMonitorPanelTitle:"Monitored Campaigns",
    intelMonitorPanelDesc:"Intelligence only analyses campaigns you choose to monitor here — never everything in your account automatically.",
    intelMonitorNoCampaigns:"Connect Google or Meta Ads to see your campaigns here.",
    intelBriefLoadingText:"Reviewing your monitored campaigns…", intelLoadErrorText:"Could not load Intelligence right now.",
    intelConnectPromptPrefix:"Connect a Google or Meta account to unlock this —", intelConnectPromptLink:"go to Integrations",
    intelWatchlistEmpty:"No unusual changes detected.", intelNoMonitoredPrefix:"No monitored campaigns yet.",
    intelNoMonitoredLink:"Select one or more campaigns", intelNoMonitoredSuffix:"to receive daily AI briefings.",
    intelBriefEmpty:"No significant changes detected today. Everything is performing within expected ranges.",
    intelCardLabelReason:"Reason", intelCardLabelWhy:"Why", intelCardLabelExpectedImpact:"Expected impact",
    intelCardLabelExpectedOutcome:"Expected outcome", intelCardLabelRecommendedAction:"Recommended action",
    intelCardTitleFallback:"Observation", intelConfidenceSuffix:"confidence",
    notifCatAutomation:"Automation", notifCatOpportunity:"Opportunity", notifCatCompleted:"Completed",
    notifCatLearning:"Learning", notifCatCritical:"Critical", notifCatWarning:"Warning",
    notifEmptyText:"No urgent notifications.", notifCatApproval:"Approval", notifDismissBtn:"Dismiss",
    // Autopilot page
    apSectionBuilder:"Automation Builder", apSectionActive:"Active Automations", apSectionSuggested:"Suggested by Oriven",
    apSectionHistory:"Automation History", apSectionSettings:"Automation Settings",
    apStepQPlatform:"What should I monitor?", apRecapLblPlatform:"Monitoring",
    apStepQCampaign:"Which campaign?", apRecapLblCampaign:"Campaign",
    apStepQCondition:"When should I react?", apRecapLblCondition:"Condition",
    apStepQAction:"What should happen?", apRecapLblAction:"Action",
    apStepReview:"Review", apModeQuestion:"How should I handle it?", apRecapEdit:"Change",
    statusActive:"Active", statusPaused:"Paused", apNamePlaceholder:"Name this automation (optional)",
    apHistorySearchPlaceholder:"Search history…", apContinueBtn:"Continue", apTestBtn:"Test",
    apCreateAutomationBtn:"Create Automation", apSaveChangesBtn:"Save Changes", apStartOverBtn:"Start over", apByLabel:"by",
    apSetDefaultModeLabel:"Default mode for new rules", apModeRequireApproval:"Require approval",
    apModeSuggestOnly:"Suggest only", apModeFullyAutomatic:"Fully automatic",
    apNotifyEnabled:"Enabled", apNotifyDisabled:"Disabled", apBriefTimeLabel:"Daily briefing time",
    apMetricRoas:"ROAS", apMetricCtr:"CTR", apMetricCpc:"CPC", apMetricCpa:"CPA", apMetricConversions:"Conversions",
    apMetricSpend:"Spend", apMetricClicks:"Clicks", apMetricImpressions:"Impressions", apMetricBudget:"Budget", apMetricStatus:"Campaign Status",
    apOpGreaterThan:"is greater than", apOpLessThan:"is less than", apOpEquals:"equals", apOpAtLeast:"is at least", apOpAtMost:"is at most",
    apActionIncreaseBudget:"Increase Budget", apActionDecreaseBudget:"Decrease Budget", apActionPause:"Pause Campaign",
    apActionResume:"Resume Campaign", apActionGenCreative:"Generate New Creative", apActionGenRecs:"Generate AI Recommendations",
    apActionNotify:"Notify Me", apActionRequestApproval:"Request Approval", apActionCreateReport:"Generate Report",
    apActionCreateBriefing:"Create Briefing", apActionRunOptimisation:"Run AI Optimisation",
    apModeAskFirst:"Ask me first", apModeAskFirstDesc:"You approve every time",
    apModeSuggestIt:"Just suggest it", apModeSuggestItDesc:"No action taken automatically",
    apModeHandleAuto:"Handle it automatically", apModeHandleAutoDesc:"No approval needed",
    apAllCampaigns:"All Campaigns", apAllCampaignsDesc:"Every campaign on this platform", apJustThisCampaignDesc:"Just this campaign", apUnnamedCampaign:"Unnamed",
    apErrNumeric:"Enter a numeric value (e.g. 4.0), not text.", apErrPercent:"Enter a percentage between 1 and 100.",
    apErrIncomplete:"Finish choosing a condition and an action first.", apErrChooseStatus:"Choose Active or Paused.",
    apErrSaveFirst:"Save the automation first, then Test it.", apErrTestFailed:"Could not test this rule right now.",
    apErrSaveFailed:"Could not save that automation.", apErrLoadActiveFailed:"Could not load your automations.",
    apErrLoadHistoryFailed:"Could not load history.",
    apEmptyActiveText:"You haven't created any automations yet. Let's automate the repetitive work together.",
    apEmptyHistoryText:"No automation activity yet.",
    apExampleBudgetRoas:"Increase budget when ROAS exceeds 4", apExamplePauseNoConv:"Pause campaigns with no conversions",
    apExampleDailyBriefing:"Generate a daily briefing", apExampleNotifyCtr:"Notify me when CTR drops",
    apNeverRun:"Never", apStatusRunning:"Running", apLastExecutedPrefix:"Last executed:",
    apDisableBtn:"Disable", apEnableBtn:"Enable", apDeleteBtn:"Delete",
    apAwaitingYourApproval:"Awaiting your approval", dateToday:"Today", dateYesterday:"Yesterday", dateDaysAgoSuffix:"days ago", apDateEarlier:"Earlier",
    apAwaitingApproval:"Awaiting approval", apApproveBtn:"Approve", apRejectBtn:"Reject",
    apSuggestSetupBtn:"Set it up",
    apReviewIllMonitor:"I'll monitor", apReviewAllCampaignsOf:"all your", apReviewCampaignsPlural:"campaigns",
    apReviewWhenever:"Whenever", apReviewIs:"is", apReviewIllComma:", I'll",
    apReviewModeFullyAuto:" I'll do this automatically — you'll be notified after.",
    apReviewModeSuggest:" I'll just flag it as a suggestion, no action taken.",
    apReviewModeApproval:" I'll ask for your approval first.",
    apErrBudgetUnsupported:"Budget changes aren't available on", apYetSuffix:"yet",
    apTestingAgainstData:"Testing against your real campaign data…", apWouldTriggerNow:"Would trigger right now",
    apCheckedCampaignsPrefix:"Checked", apCampaignSingular:"campaign", apCampaignPlural:"campaigns",
    apNoneMatchCondition:"none currently meet this condition.",
    apRuleSentenceWhen:"When", apRuleSentenceOrivenWill:", Oriven will",
    // Business page
    bizTabOverview:"Overview", bizTabBusiness:"Business", bizTabProducts:"Products", bizTabMarket:"Market",
    bizTabBrand:"Brand", bizTabConnections:"Connections", bizTabMemory:"Memory",
    bizLearningLabel:"Learning", bizGetReflectionBtn:"Get a reflection", bizInsightsLabel:"Business Insights",
    bizKnowledgeCheckLabel:"Knowledge check", bizRunCheckBtn:"Run a knowledge check",
    bizProductsHeading:"Products", bizAddProductBtn:"+ Add a product",
    bizAudienceHeading:"Audience", bizAddAudienceBtn:"+ Add an audience",
    bizCompetitorsHeading:"Competitors", bizAddCompetitorBtn:"+ Add a competitor",
    bizProfileCardTitle:"Business Profile", bizProfileCardSub:"The basics — who you are, what you do, and where you're headed.",
    bizWebsiteCardTitle:"Website", bizWebsiteCardSub:"What Oriven has learned by reading your site.",
    bizFieldWebsiteUrl:"Website URL", bizAnalyseWebsiteBtn:"Analyse my website", bizRefreshAnalysisBtn:"Refresh analysis",
    bizVoiceCardTitle:"Brand Voice", bizVoiceCardSub:"Pick the traits that describe how your brand sounds. Oriven uses these in every headline and script it writes.",
    bizConnectionsIntro:"Your advertising platforms. Connect an account and Oriven can read and manage campaigns on it directly.",
    bizMemoryIntro:"Everything Oriven has learned along the way — from conversations, and from what's worked. This is Oriven's long-term memory of your business.",
    bizEmptyMemory:"Nothing remembered yet — it builds up as you use Oriven.", bizMemoryDeleteBtn:"Delete",
    bizVcardEditBtn:"Edit", bizVcardDeleteBtn:"Delete", bizVcardSaveBtn:"Save", bizVcardCloseBtn:"Close",
    bizVcardEmptyDetails:"No details yet — click Edit to fill this in.",
    conNotConnected:"Not connected", conStatusConnected:"Connected", conCheckingStatus:"Checking…",
    conDisconnectBtn:"Disconnect", conAdAccountsHeader:"Ad Accounts", conActiveBadge:"Active", conSetActiveBtn:"Set Active",
    conConnectGoogleBtn:"Connect Google Ads →", conConnectMetaBtn:"Connect Meta Ads →", conConnectTiktokBtn:"Connect TikTok Ads →",
    conDetailConnectedAccounts:"Connected Accounts", conDetailConnectedBusinesses:"Connected Businesses",
    bizReadingWebsiteBtn:"Reading your website…",
    // Campaigns — Overview
    rangeToday:"Today", rangeYesterday:"Yesterday", rangeLast7Days:"Last 7 Days", rangeLast30Days:"Last 30 Days",
    rangeLast90Days:"Last 90 Days", rangeThisMonth:"This Month", rangeLastMonth:"Last Month",
    rangeLast12Months:"Last 12 Months", rangeLifetime:"Lifetime", rangeCustom:"Custom Range…",
    tiktokAnalyticsTitle:"TikTok Analytics", tiktokAnalyticsComingSub:"Analytics will become available once your TikTok Ads account has been connected.",
    connectBannerTitle:"Connect your ad accounts to unlock live analytics",
    connectBannerSub:"Link Google Ads, Meta Ads, or TikTok Ads to start tracking spend, ROAS, and conversions in real time.",
    connectAccountsBtn:"Connect Accounts →",
    kpiTotalSpend:"Total Spend", kpiImpressions:"Impressions", kpiClicks:"Clicks", kpiConversions:"Conversions", kpiRoas:"ROAS",
    kpiChgPlaceholder:"— vs last period",
    chartSpendOverTime:"Spend Over Time", chartLockConnectLive:"Connect an account to see live data", chartLockConnectUnlock:"Connect to unlock",
    chartRoasOverTime:"ROAS Over Time", chartCtrOverTime:"CTR Over Time",
    orivenScoreTitle:"Oriven Score", orivenScoreSub:"AI-powered account health · 0–100",
    aiAnalysisTitle:"AI Analysis", aiAnalysisDefaultSummary:"Analyse this account for wasted spend, low CTR, conversion issues, and scaling opportunities.",
    analyzeWithAiBtn:"Analyze with AI", aiSectionStrengths:"Strengths", aiSectionWeaknesses:"Weaknesses",
    aiSectionRecommendations:"Recommendations", aiSectionExpectedImpact:"Expected Impact", generateAdCopyBtn:"Generate ad copy →",
    analyzingEllipsis:"Analyzing…", analysisFailed:"Analysis failed", analysisFailedRetry:"Analysis failed — try again", reanalyzeBtn:"Re-analyze",
    searchCampaignsPlaceholder:"Search campaigns…", newCampaignBtnPlain:"New Campaign", noCampaignsYetDot:"No campaigns yet.",
    noCampaignsYetSub:"Generate your first campaign from Create. Describe your product and Oriven will build a complete campaign instantly.",
    createCampaignArrowBtn:"Create Campaign →", noCampaignsMatchSearch:"No campaigns match your search.",
    continueWorkingHeader:"Continue working",
    tiktokComingSoonSub:"TikTok integration is coming soon. Once your TikTok app is approved and connected, your campaigns will appear here.",
    // Settings modal — full audit pass
    smdHdTitle:"Settings", smdNavGeneral:"General", smdNavSubscription:"Subscription", smdNavNotifications:"Notifications",
    smdNavAccount:"Account", smdNavSecurity:"Security",
    smdWsNameLabel:"Workspace Name", smdWsNameHelp:"Appears in the sidebar and throughout the app.",
    smdThemeLabel:"Theme", smdThemeLight:"Light", smdThemeDark:"Dark", smdThemeSystem:"System", smdAccentLabel:"Accent Color",
    smdLangLabel:"Display & Generation Language", smdLangHelp:"Applied to interface labels and AI-generated content.",
    smdLoadingEllipsis:"Loading…",
    smdNotifGenTitle:"Generation Complete", smdNotifGenSub:"Notify when AI finishes generating content.",
    smdNotifPubTitle:"Publishing Complete", smdNotifPubSub:"Notify when content has been published.",
    smdNotifBillTitle:"Billing Updates", smdNotifBillSub:"Alerts for renewals and payment activity.",
    smdNotifUpdTitle:"Product Updates", smdNotifUpdSub:"In-app announcements about new features.",
    smdNotifApTitle:"Autopilot Approvals", smdNotifApSub:"Notify when a recommendation or automation rule needs your approval.",
    smdSignedInWith:"Signed in with", smdEmailLabel:"Email Address", smdEmailHelp:"Used to sign in and receive account notifications.",
    smdChangePwTitle:"Change Password", smdChangePwHelp:"Enter your current password, then choose a new one.",
    smdCurrentPwPlaceholder:"Current password", smdNewPwPlaceholder:"New password (min. 8 characters)", smdConfirmPwPlaceholder:"Confirm new password",
    smdUpdatePwBtn:"Update Password", smdForgotPwTitle:"Forgot your password?",
    smdForgotPwHelp:"Send a reset link to change your password by email instead.", smdSendResetBtn:"Send Password Reset Email",
    smdDangerZoneTitle:"Danger Zone", smdSignOutTitle:"Sign Out", smdSignOutSub:"Sign out of ORIVEN on this device.", smdSignOutBtn:"Sign Out",
    smdDeleteAcctTitle:"Delete Account", smdDeleteAcctSub:"Permanently remove your account and all data. This cannot be undone.", smdDeleteAcctBtn:"Delete Account",
    smdHelpGeneralHelp:"Your workspace name, theme (light/dark/system), accent color, and interface language. Accent color applies across the whole app — hover states, active tabs, buttons, and focus rings. Changes save automatically and apply immediately.",
    smdHelpSubHelp:"Your current plan, usage, and billing management. Upgrade, downgrade, or manage payment details from here.",
    smdHelpNotifHelp:"Control which events generate an alert — generation completion, publishing, billing, product updates, and Autopilot approvals. Turning a category off stops those notifications from being created, not just hidden.",
    smdHelpAcctHelp:"Your sign-in method and email address. Email changes require confirming the new address before they take effect.",
    smdHelpSecHelp:"Change your password directly (current password required), or send yourself a password-reset link by email.",
    smdHelpBizHelp:"Manage your business details, brand voice, audiences, and connected ad accounts from the Business workspace — separate from personal Settings, since it can be shared across teammates.",
    smdHelpApHelp:"Automation rules that act on your campaigns without manual intervention. Recommendations that need your sign-off appear as Autopilot Approvals notifications, controlled in the Notifications tab.",
    helpTitle:"Help", helpSub:"What each Settings section does.",
    builderResultLabel:"Result", regenerateBtn:"Regenerate", saveToStudioBtn:"Save to Studio",
    // Onboarding tour
    obWelcomeTitle:"Welcome to Oriven.",
    obWelcomeDesc:"Oriven helps you create, optimise and automate advertising campaigns with AI.",
    obStartTourBtn:"Start Tour",
    obLaunchSection:"Launch", obLaunchTitle:"Where every campaign begins.",
    obLaunchDesc:"Describe your business goal, choose a platform, and generate an AI campaign.",
    obCampaignsSection:"Campaigns", obCampaignsTitle:"Manage everything you've created.",
    obCampaignsDesc:"Monitor performance, review AI analysis, and improve your campaigns.",
    obOverviewTitle:"Performance at a glance.",
    obOverviewDesc:"Overview gives you performance metrics and AI recommendations.",
    obLiveCampaignsTitle:"Everything that's running.",
    obLiveCampaignsDesc:"Live Campaigns shows every active campaign connected to your advertising accounts.",
    obDraftsTitle:"Ready when you are.",
    obDraftsDesc:"Drafts contains campaigns that haven't been published yet.",
    obIntelligenceSection:"Intelligence", obIntelligenceTitle:"Your daily AI briefing.",
    obIntelligenceDesc:"Intelligence provides daily AI briefings. It tells you what deserves your attention today.",
    obAutopilotSection:"Autopilot", obAutopilotTitle:"Oriven, working for you.",
    obAutopilotDesc:"Autopilot lets Oriven perform repetitive advertising tasks automatically. You stay in control.",
    obBusinessSection:"Business", obBusinessTitle:"Teach Oriven your business.",
    obBusinessDesc:"Business teaches Oriven everything about your company. Better business knowledge produces better campaigns.",
    obBizTabOverviewDesc:"A complete picture of what Oriven knows about your business.",
    obBizTabBusinessDesc:"Your company profile and website understanding.",
    obBizTabProductsDesc:"What you sell — so campaigns describe it accurately.",
    obBizTabMarketDesc:"Your audience and competitors.",
    obBizTabBrandDesc:"Your voice, identity, and visual direction.",
    obBizTabConnectionsDesc:"Your connected advertising accounts.",
    obBizTabMemoryDesc:"Everything Oriven has learned about your business over time.",
    obSettingsSection:"Settings", obSettingsTitle:"Make it yours.",
    obSettingsDesc:"Personalise your workspace — language, theme, accent colour, notifications, and account.",
    obYourTurnSection:"Your turn",
    obPromptTitle:"Now it's your turn.",
    obPromptDesc:"Let's create your first campaign. Describe what you'd like to advertise here.",
    obPlatformTitle:"Choose a platform.", obPlatformDesc:"Pick where this campaign should run.",
    obUploadTitle:"Add a reference image (optional).", obUploadDesc:"Attach an image to guide the AI's visuals.",
    obGenerateTitle:"Ready when you are.", obGenerateDesc:"Click Generate Campaign to build your first AI campaign.",
    obWaitingGenerate:"Waiting for you to click Generate…",
    obPublishTitle:"One click to go live.",
    obPublishDesc:"Publishing sends your campaign to your connected advertising platform.",
    obWaitingPublish:"Waiting for you to click Publish…",
    obNextBtn:"Next →", obBackBtn:"← Back", obSkipBtn:"Skip Tour", obStepOfLabel:"Step {n} of {total}",
    obPaywallTitle:"Ready to Publish",
    obPaywallSub:"You've built your first campaign with Oriven. Choose a plan to publish it to your connected ad account.",
    obPaywallEyebrow:"Your First Campaign Is Ready",
    smdRestartObTitle:"Restart Onboarding",
    smdRestartObHelp:"Replay the guided product tour from the beginning. Useful for demos or a refresher.",
    smdRestartObBtn:"Restart Onboarding"
  },

  fr:{
    // Navigation
    dashboard:"Tableau de bord", create:"Créer", studio:"BrandCore",
    inspiration:"Inspiration", settings:"Paramètres",
    // Greetings
    goodMorning:"Bonjour", goodAfternoon:"Bon après-midi",
    goodEvening:"Bonsoir", goodNight:"Bonne nuit",
    // Dashboard / FAB
    brandAssistant:"Oriven", openAIChat:"Commencer à créer",
    // Studio
    savedAssets:"Éléments enregistrés", brandCore:"Brand Core",
    brandCheck:"Vérification de marque", campaigns:"Campagnes",
    // Settings nav
    workspace:"Espace de travail", plan:"Votre offre", appearance:"Apparence", language:"Langue",
    notifications:"Notifications", exportPref:"Exportation", brandReset:"Réinitialiser la marque",
    // Appearance labels
    themeLabel:"Thème", lightMode:"Mode clair", darkMode:"Mode sombre",
    accentLabel:"Couleur d'accent",
    accentHelp:"Choisissez la couleur de mise en valeur utilisée pour les boutons, les états actifs et les éléments d'interface.",
    // Empty states
    noItems:"Aucun élément enregistré pour l'instant",
    createContent:"Générez du contenu dans AI Chat et enregistrez-le ici.",
    // Welcome
    welcomeMsg:"Comment puis-je accompagner votre marque aujourd'hui ?",
    // Create page
    createSub:"Choisissez un type de création pour commencer. Votre Brand Core façonne chaque résultat.",
    imageTitle:"Visuels",     imageDesc:"Générez des visuels, publicités et designs pour réseaux sociaux à l'image de votre marque.",
    textTitle:"Texte",        textDesc:"Générez des légendes, titres et textes de marque.",
    campaignTitle:"Campagne",campaignDesc:"Créez des campagnes complètes avec visuels et textes.",
    videoTitle:"Vidéo",      videoDesc:"Créez des idées vidéo, scripts et concepts.",
    webTitle:"Web",          webDesc:"Créez des pages web et éléments alignés avec votre marque.",
    assistantDesc:"Demandez à votre IA de marque des conseils, idées et orientations créatives.",
    comingSoon:"Bientôt disponible",
    // Sidebar identity
    brandWorkspace:"Espace de marque", signOut:"Se déconnecter",
    // Dashboard headline & tagline
    dashHeadlinePrefix:"Votre marque est", dashHeadlineHighlight:"prête.",
    dashTagline:"Transformons-la en contenu, publicités et croissance.",
    // Dashboard action cards
    dashCreateLabel:"Créer du contenu",   dashCreateDesc:"Images, textes, scripts vidéo, et plus encore.",
    dashIdeasLabel:"Explorer des idées",     dashIdeasDesc:"Idées de contenu, angles publicitaires et concepts de campagne.",
    dashCampaignLabel:"Créer une campagne", dashCampaignDesc:"Campagnes multicanales complètes de bout en bout.",
    dashBrandLabel:"Modifier le Brand Core",   dashBrandDesc:"Couleurs, polices, ton de voix et identité.",
    // Dashboard snapshot
    edit:"Modifier", setUp:"Configurer", notConfigured:"Non configuré",
    buildBrandIdentity:"Construisez l'identité de votre marque pour commencer.",
    setUpBrandCore:"Configurer votre Brand Core →",
    // Create page
    createH1Line1:"Que souhaitez-vous", createH1Line2:"créer aujourd'hui ?",
    // Studio hub
    brandStudioTitle:"Brand Studio", brandStudioSub:"Tout ce qui définit et fait avancer votre marque.",
    studioSavedLabel:"Enregistrés",    studioSavedDesc:"Tout votre contenu et vos éléments générés.",
    studioBCDesc:"Couleurs, polices, ton de voix et identité.",
    studioCheckLabel:"Vérification de marque", studioCheckDesc:"Analysez le contenu pour vérifier la cohérence de marque.",
    studioCampDesc:"Gérez et lancez vos campagnes actives.",
    studioBackBtn:"Retour",
    // Studio: empty states + actions
    noBCConfigured:"Aucun Brand Core configuré pour l'instant",
    noBCConfiguredSub:"Configurez l'identité de votre marque pour débloquer la génération IA.",
    aiGenerateBtn:"Générer avec l'IA", manualSetupBtn:"Configuration manuelle",
    savedAssetsHeader:"Éléments enregistrés",
    openAIChatBtn:"Ouvrir AI Chat",
    noCampaignsTitle:"Aucune campagne pour l'instant",
    noCampaignsSub:"Regroupez vos éléments enregistrés en concepts de campagne visuels pour les réseaux sociaux et les publicités.",
    newCampaignBtn:"+ Nouvelle campagne",
    // Brand Check
    dropImageTitle:"Déposez votre image ici",
    dropImageSub:"PNG, JPG ou WEBP — glissez-déposez ou cliquez pour parcourir",
    checkBrandNoImgBtn:"Vérifier la marque sans image",
    readyForCheck:"Prêt pour la vérification de marque",
    runBrandCheckBtn:"Lancer la vérification", resetBtn:"Réinitialiser", removeBtn:"Supprimer",
    analyzingBrand:"Analyse de la cohérence de marque en cours...",
    checkingDetails:"Vérification des couleurs, de la typographie et du style visuel",
    // Ideas hub
    ideasTitle:"Idées", ideasSub:"Des méthodes éprouvées pour inspirer votre prochain contenu.",
    contentIdeasLabel:"Idées de contenu",      contentIdeasDesc:"Publications, stories et formats qui fidélisent votre audience.",
    adAnglesLabel:"Angles publicitaires",             adAnglesDesc:"Des cadres de messages qui transforment l'attention en action.",
    visualStylesLabel:"Styles visuels",     visualStylesDesc:"Des orientations esthétiques pour l'identité visuelle de votre marque.",
    campaignConceptsLabel:"Concepts de campagne", campaignConceptsDesc:"Des structures de bout en bout qui génèrent de vrais résultats.",
    // Ideas panel titles
    idContentTitle:"Idées de contenu", idAnglesTitle:"Angles publicitaires",
    idVisualTitle:"Styles visuels",  idCampaignTitle:"Concepts de campagne",
    // Ideas button labels per category
    idContentUseLabel:"Utiliser cette idée",       idContentGenLabel:"Générer une publication",
    idAnglesUseLabel:"Essayer cet angle",       idAnglesGenLabel:"Générer une publicité",
    idVisualUseLabel:"Utiliser ce style",       idVisualGenLabel:"Générer un visuel",
    idCampaignUseLabel:"Créer cette campagne",idCampaignGenLabel:"Générer les éléments",
    // Ideas: content idea labels
    idCont0Label:"Publications éducatives",   idCont1Label:"Mise en avant produit",
    idCont2Label:"Histoire du fondateur",       idCont3Label:"Histoire de transformation",
    idCont4Label:"Résultat client",     idCont5Label:"Publication comparative",
    idCont6Label:"Mythe vs réalité",      idCont7Label:"Avant / Après",
    idCont8Label:"Routine / Processus",  idCont9Label:"Créateur d'autorité",
    // Ideas: ad angle labels
    idAng0Label:"Problème → Solution",   idAng1Label:"Aspiration",
    idAng2Label:"Transformation",       idAng3Label:"Urgence",
    idAng4Label:"Rareté",             idAng5Label:"Agitation du point de douleur",
    idAng6Label:"Preuve sociale",         idAng7Label:"Positionnement premium",
    idAng8Label:"Bénéfice en premier",        idAng9Label:"Accroche émotionnelle",
    // Ideas: visual style labels
    idVis0Label:"Minimal luxueux",       idVis1Label:"Moderne audacieux",
    idVis2Label:"Sombre premium",         idVis3Label:"Lifestyle doux",
    idVis4Label:"Éditorial épuré",      idVis5Label:"Contraste élevé",
    idVis6Label:"Futuriste élégant",     idVis7Label:"Naturel organique",
    idVis8Label:"Performance sportive",   idVis9Label:"Élégant féminin",
    // Ideas: campaign concept labels
    idCamp0Label:"Lancement de produit",      idCamp1Label:"Notoriété de marque",
    idCamp2Label:"Collection saisonnière",      idCamp3Label:"Boost de conversion",
    idCamp4Label:"Tunnel éducatif",  idCamp5Label:"Séquence de reciblage",
    idCamp6Label:"Sprint offre limitée",idCamp7Label:"Campagne portée par le fondateur",
    idCamp8Label:"Basé sur des témoignages",  idCamp9Label:"Campagne communautaire",
    // Team
    teamTitle:"Équipe", teamSub:"Gérez l'équipe de votre espace Business.",
    // Settings structural
    settingsTitle:"Paramètres", settingsSub:"Gérez votre espace de travail et vos préférences.",
    spWorkspaceSub:"Gérez les détails et préférences de votre espace de marque.",
    wsNameLabel:"Nom de l'espace de travail",
    wsNameHelp:"C'est le nom de votre espace de travail dans ORIVEN. Il apparaît dans votre barre latérale et dans toute l'application.",
    saveBtn:"Enregistrer",
    brandLockLabel:"Verrouillage de marque", lockBCLabel:"Verrouiller le BrandCore",
    lockBCSub:"Lorsqu'il est activé, votre BrandCore reste fixe et est appliqué de façon cohérente à tout le contenu généré. Désactivez-le pour modifier la configuration de votre marque.",
    spAppearanceSub:"Choisissez l'apparence d'ORIVEN. Votre préférence est enregistrée et conservée d'une session à l'autre.",
    spLanguageSub:"Définissez la langue d'affichage et de génération de contenu pour votre espace de travail. Votre choix est enregistré et appliqué à chaque session.",
    langDisplayLabel:"Langue d'affichage et de génération",
    langDisplayHelp:"ORIVEN utilisera cette langue pour les libellés d'interface et lors de la génération de contenu avec votre BrandCore.",
    spNotificationsSub:"Gérez les notifications in-app. Les modifications sont enregistrées immédiatement.",
    notifBrandCheckLabel:"Alertes de vérification de marque",
    notifBrandCheckSub:"Afficher une notification lorsque votre score de vérification de marque passe sous 70 %.",
    notifGenCompleteLabel:"Génération terminée",
    notifGenCompleteSub:"Vous avertir lorsque l'IA termine de générer du contenu.",
    notifUpdatesLabel:"Mises à jour produit",
    notifUpdatesSub:"Recevez des annonces in-app sur les nouvelles fonctionnalités et améliorations d'ORIVEN.",
    spExportTitle:"Préférences d'exportation", spExportSub:"Contrôlez la préparation de votre contenu généré pour l'exportation et le téléchargement.",
    expFormatLabel:"Format d'exportation par défaut",
    expFormatHelp:"Choisissez le format de fichier par défaut lors du téléchargement des éléments générés. Vous pouvez toujours changer le format au moment de l'exportation.",
    autoSaveLabel:"Enregistrement automatique du contenu généré",
    autoSaveSub:"Enregistrez automatiquement les modifications de votre espace de travail et le contenu généré dans Studio. Une fois activé, chaque génération est stockée sans enregistrement manuel.",
    spDangerSub:"Actions permanentes — elles ne peuvent pas être annulées.",
    resetBCTitle:"Réinitialiser le Brand Core",
    resetBCDesc:"Cette action réinitialise toute la configuration de votre marque — couleurs, ton de voix, positionnement et données d'identité. Vos éléments générés enregistrés dans Studio ne seront pas affectés, mais toutes les générations futures perdront le contexte de marque jusqu'à ce que vous créiez un nouveau BrandCore. Cette action est permanente et irréversible.",
    resetBCBtn:"Réinitialiser le Brand Core",
    // Banner
    // Builder
    // Settings Completion — current live sidebar/workspace titles (Oriven 1.0)
    navLaunch:"Lancer", navCampaigns:"Campagnes", navIntelligence:"Intelligence", navAutopilot:"Autopilot", navBusiness:"Business", navSettings:"Paramètres",
    wsTitleIntelligence:"Intelligence", wsSubIntelligence:"Ce qui mérite votre attention aujourd'hui.",
    wsTitleBusiness:"Business", wsSubBusiness:"Enseignez votre activité à Oriven une seule fois — chaque campagne, conversation et recommandation s'en sert automatiquement par la suite.",
    wsTitleAutopilot:"Autopilot", wsSubAutopilot:"Automatise les tâches publicitaires répétitives. Rien de plus.",
    wsTitlePerformance:"Performance", wsSubPerformance:"Comment vos campagnes performent-elles ?",
    wsTitleCampaigns:"Campagnes", wsSubCampaigns:"Gérez vos campagnes — brouillons, actives et archivées.",
    hubTabOverview:"Aperçu", hubTabLiveCampaigns:"Campagnes en cours", hubTabDrafts:"Brouillons",
    toastTypographyComingSoon:"Éditeur de typographie bientôt disponible", toastToneComingSoon:"Éditeur de ton bientôt disponible",
    toastPositioningComingSoon:"Éditeur de positionnement bientôt disponible", toastSavedDraft:"Enregistré comme brouillon",
    toastEnterCampaignName:"Entrez un nom de campagne", toastEnterCampaignGoal:"Entrez l'objectif de votre campagne",
    toastDescribeBusiness:"Décrivez votre entreprise ou produit", toastSelectCreativeFormat:"Sélectionnez au moins un format créatif",
    toastCopied:"Copié !", toastChangesApplied:"Modifications appliquées", toastCopiedClipboard:"Copié dans le presse-papiers",
    toastAddModuleComingSoon:"Ajouter un module — bientôt disponible", toastRegenerating:"Régénération…", toastRegenerated:"Régénéré",
    toastRegenerationFailed:"Échec de la régénération — réessayez", toastCampaignExported:"Campagne exportée",
    toastCampaignDuplicated:"Campagne dupliquée", toastCampaignQueued:"Campagne en attente de publication",
    toastCampaignNotFound:"Données de campagne introuvables", toastNoPlatformSet:"Aucune plateforme définie pour cette campagne",
    toastCampaignPublishedTo:"Campagne publiée sur", toastPublishFailedPrefix:"Échec de la publication :",
    toastCampaignPaused:"Campagne mise en pause", toastCampaignResumed:"Campagne reprise",
    toastCampaignArchived:"Campagne archivée", toastCampaignDeleted:"Campagne supprimée",
    toastDescribeAdvertise:"Décrivez ce que vous souhaitez promouvoir", toastDescribeSelling:"Décrivez ce que vous vendez",
    toastChooseGoal:"Choisissez un objectif", toastSelectPlatform:"Sélectionnez au moins une plateforme",
    toastComingSoon:"bientôt disponible", toastActiveAccountUpdated:"Compte actif mis à jour",
    toastFailedSetAccount:"Échec de la définition du compte — réessayez", toastNetworkError:"Erreur réseau — réessayez",
    toastConnectionFailed:"Échec de la connexion — réessayez.", toastConnectionFailedShort:"Échec de la connexion.",
    toastDisconnectFailed:"Échec de la déconnexion — réessayez.", toastEnterWebsiteUrl:"Entrez d'abord une URL de site web.",
    toastWebsiteAnalysed:"Site analysé. Connaissance Business mise à jour.",
    toastWebsiteAnalyseFailed:"Impossible d'analyser ce site. Vérifiez l'URL et réessayez.",
    toastSelectDestinationAccount:"Veuillez d'abord sélectionner un compte de destination",
    toastReportNeedsAccount:"La génération de rapport nécessite un compte publicitaire connecté.",
    toastNoReportsYet:"Aucun rapport à exporter pour l'instant. Générez d'abord un rapport.", toastCampaignGenerated:"Campagne générée",
    toastPublishingToEllipsis:"Publication sur", toastPublishErrorPrefix:"Erreur de publication :",
    toastImagePromptCopied:"Prompt d'image copié", toastNoPackageYet:"Aucun package généré pour l'instant",
    toastPackageCopied:"Package de campagne copié dans le presse-papiers", toastEnterCampaignDesc:"Veuillez entrer une description de campagne.",
    toastEngineNotLoaded:"Moteur de génération non chargé. Veuillez actualiser.", toastGenerationFailedPrefix:"Échec de la génération de la campagne :",
    toastConnectedSuffix:"connecté !", toastDisconnectedSuffix:"déconnecté.",
    toastConnectingEllipsis:"Connexion…", btnConnectPlatformSuffix:"Ads →", btnConnectingPlatform:"Connexion…",
    confirmDisconnectPlatform:"Déconnecter {platform} ? Les analyses en direct s'arrêteront mais vos données de campagne seront conservées.",
    toastSavedBizKnowledge:"Enregistré avec succès. Connaissance Business mise à jour.", toastCouldNotSave:"Impossible d'enregistrer. Veuillez réessayer.",
    toastSignedOut:"Déconnecté", toastProfileLoadFailed:"Échec du chargement du profil — veuillez actualiser la page.",
    toastPleaseSignIn:"Veuillez d'abord vous connecter", toastVerificationSent:"E-mail de vérification envoyé — vérifiez votre boîte de réception",
    toastCouldNotSendPrefix:"Envoi impossible —", toastEmailVerified:"E-mail vérifié — votre compte est confirmé !",
    toastVerificationInvalid:"Le lien de vérification est invalide ou déjà utilisé. Demandez-en un nouveau.",
    toastBrandCoreSavedCloud:"Brand Core enregistré dans le cloud", toastCheckoutFailed:"Impossible de démarrer le paiement — veuillez réessayer",
    toastCheckoutCanceled:"Paiement annulé — vous pouvez passer à niveau supérieur à tout moment.",
    toastSubscriptionActive:"Votre abonnement est maintenant actif — bienvenue chez ORIVEN !",
    toastPaymentReceived:"Paiement reçu — activation de votre compte...",
    toastSubscriptionPending:"Abonnement en attente — veuillez actualiser dans un instant.",
    toastPlatformConnectedSuccess:"connecté avec succès !",
    launchH1:"Lancez votre prochaine campagne.", genModeImage:"Image", genModeVideo:"Vidéo",
    attachImageBtn:"Joindre une image", launchPromptPlaceholder:"Que souhaitez-vous promouvoir aujourd'hui ? ex. Une marque de vêtements de sport ciblant les jeunes hommes à Amsterdam. Budget 30€/jour.",
    currentlyWorkingWith:"Travail en cours avec", setUpBusinessCta:"Configurez votre entreprise pour personnaliser chaque campagne →",
    addMoreImages:"Ajouter plus", generatingEllipsis:"Génération…",
    intelMonitorBtn:"Campagnes surveillées", intelBriefingHeading:"Rapport exécutif", intelPriorityHeading:"Priorité la plus élevée",
    intelWatchlistHeading:"Liste de surveillance", intelMonitorPanelTitle:"Campagnes surveillées",
    intelMonitorPanelDesc:"Intelligence n'analyse que les campagnes que vous choisissez de surveiller ici — jamais tout votre compte automatiquement.",
    intelMonitorNoCampaigns:"Connectez Google ou Meta Ads pour voir vos campagnes ici.",
    intelBriefLoadingText:"Examen de vos campagnes surveillées…", intelLoadErrorText:"Impossible de charger Intelligence pour le moment.",
    intelConnectPromptPrefix:"Connectez un compte Google ou Meta pour débloquer ceci —", intelConnectPromptLink:"aller aux Intégrations",
    intelWatchlistEmpty:"Aucun changement inhabituel détecté.", intelNoMonitoredPrefix:"Aucune campagne surveillée pour l'instant.",
    intelNoMonitoredLink:"Sélectionnez une ou plusieurs campagnes", intelNoMonitoredSuffix:"pour recevoir des rapports IA quotidiens.",
    intelBriefEmpty:"Aucun changement significatif détecté aujourd'hui. Tout fonctionne dans les plages attendues.",
    intelCardLabelReason:"Raison", intelCardLabelWhy:"Pourquoi", intelCardLabelExpectedImpact:"Impact attendu",
    intelCardLabelExpectedOutcome:"Résultat attendu", intelCardLabelRecommendedAction:"Action recommandée",
    intelCardTitleFallback:"Observation", intelConfidenceSuffix:"confiance",
    notifCatAutomation:"Automatisation", notifCatOpportunity:"Opportunité", notifCatCompleted:"Terminé",
    notifCatLearning:"Apprentissage", notifCatCritical:"Critique", notifCatWarning:"Avertissement",
    notifEmptyText:"Aucune notification urgente.", notifCatApproval:"Approbation", notifDismissBtn:"Ignorer",
    apSectionBuilder:"Générateur d'automatisation", apSectionActive:"Automatisations actives", apSectionSuggested:"Suggéré par Oriven",
    apSectionHistory:"Historique des automatisations", apSectionSettings:"Paramètres d'automatisation",
    apStepQPlatform:"Que dois-je surveiller ?", apRecapLblPlatform:"Surveillance",
    apStepQCampaign:"Quelle campagne ?", apRecapLblCampaign:"Campagne",
    apStepQCondition:"Quand dois-je réagir ?", apRecapLblCondition:"Condition",
    apStepQAction:"Que doit-il se passer ?", apRecapLblAction:"Action",
    apStepReview:"Vérification", apModeQuestion:"Comment dois-je gérer cela ?", apRecapEdit:"Modifier",
    statusActive:"Actif", statusPaused:"En pause", apNamePlaceholder:"Nommer cette automatisation (facultatif)",
    apHistorySearchPlaceholder:"Rechercher dans l'historique…", apContinueBtn:"Continuer", apTestBtn:"Tester",
    apCreateAutomationBtn:"Créer l'automatisation", apSaveChangesBtn:"Enregistrer les modifications", apStartOverBtn:"Recommencer", apByLabel:"de",
    apSetDefaultModeLabel:"Mode par défaut pour les nouvelles règles", apModeRequireApproval:"Demander une approbation",
    apModeSuggestOnly:"Suggérer uniquement", apModeFullyAutomatic:"Entièrement automatique",
    apNotifyEnabled:"Activé", apNotifyDisabled:"Désactivé", apBriefTimeLabel:"Heure du rapport quotidien",
    apMetricRoas:"ROAS", apMetricCtr:"CTR", apMetricCpc:"CPC", apMetricCpa:"CPA", apMetricConversions:"Conversions",
    apMetricSpend:"Dépenses", apMetricClicks:"Clics", apMetricImpressions:"Impressions", apMetricBudget:"Budget", apMetricStatus:"Statut de la campagne",
    apOpGreaterThan:"est supérieur à", apOpLessThan:"est inférieur à", apOpEquals:"est égal à", apOpAtLeast:"est au moins", apOpAtMost:"est au plus",
    apActionIncreaseBudget:"Augmenter le budget", apActionDecreaseBudget:"Réduire le budget", apActionPause:"Mettre en pause la campagne",
    apActionResume:"Reprendre la campagne", apActionGenCreative:"Générer une nouvelle création", apActionGenRecs:"Générer des recommandations IA",
    apActionNotify:"Me notifier", apActionRequestApproval:"Demander une approbation", apActionCreateReport:"Générer un rapport",
    apActionCreateBriefing:"Créer un rapport", apActionRunOptimisation:"Lancer l'optimisation IA",
    apModeAskFirst:"Me demander d'abord", apModeAskFirstDesc:"Vous approuvez à chaque fois",
    apModeSuggestIt:"Suggérer seulement", apModeSuggestItDesc:"Aucune action prise automatiquement",
    apModeHandleAuto:"Gérer automatiquement", apModeHandleAutoDesc:"Aucune approbation nécessaire",
    apAllCampaigns:"Toutes les campagnes", apAllCampaignsDesc:"Chaque campagne sur cette plateforme", apJustThisCampaignDesc:"Uniquement cette campagne", apUnnamedCampaign:"Sans nom",
    apErrNumeric:"Entrez une valeur numérique (ex. 4.0), pas du texte.", apErrPercent:"Entrez un pourcentage entre 1 et 100.",
    apErrIncomplete:"Terminez d'abord de choisir une condition et une action.", apErrChooseStatus:"Choisissez Actif ou En pause.",
    apErrSaveFirst:"Enregistrez d'abord l'automatisation, puis testez-la.", apErrTestFailed:"Impossible de tester cette règle pour le moment.",
    apErrSaveFailed:"Impossible d'enregistrer cette automatisation.", apErrLoadActiveFailed:"Impossible de charger vos automatisations.",
    apErrLoadHistoryFailed:"Impossible de charger l'historique.",
    apEmptyActiveText:"Vous n'avez pas encore créé d'automatisation. Automatisons ensemble le travail répétitif.",
    apEmptyHistoryText:"Aucune activité d'automatisation pour l'instant.",
    apExampleBudgetRoas:"Augmenter le budget quand le ROAS dépasse 4", apExamplePauseNoConv:"Mettre en pause les campagnes sans conversions",
    apExampleDailyBriefing:"Générer un rapport quotidien", apExampleNotifyCtr:"Me notifier quand le CTR baisse",
    apNeverRun:"Jamais", apStatusRunning:"En cours", apLastExecutedPrefix:"Dernière exécution :",
    apDisableBtn:"Désactiver", apEnableBtn:"Activer", apDeleteBtn:"Supprimer",
    apAwaitingYourApproval:"En attente de votre approbation", dateToday:"Aujourd'hui", dateYesterday:"Hier", dateDaysAgoSuffix:"jours", apDateEarlier:"Plus tôt",
    apAwaitingApproval:"En attente d'approbation", apApproveBtn:"Approuver", apRejectBtn:"Rejeter",
    apSuggestSetupBtn:"Mettre en place",
    apReviewIllMonitor:"Je vais surveiller", apReviewAllCampaignsOf:"toutes vos", apReviewCampaignsPlural:"campagnes",
    apReviewWhenever:"Dès que", apReviewIs:"est", apReviewIllComma:", je vais",
    apReviewModeFullyAuto:" Je ferai cela automatiquement — vous serez notifié après.",
    apReviewModeSuggest:" Je le signalerai simplement comme suggestion, sans action.",
    apReviewModeApproval:" Je vous demanderai d'abord votre approbation.",
    apErrBudgetUnsupported:"Les modifications de budget ne sont pas disponibles sur", apYetSuffix:"pour le moment",
    apTestingAgainstData:"Test avec vos données de campagne réelles…", apWouldTriggerNow:"Se déclencherait maintenant",
    apCheckedCampaignsPrefix:"Vérifié", apCampaignSingular:"campagne", apCampaignPlural:"campagnes",
    apNoneMatchCondition:"aucune ne correspond actuellement à cette condition.",
    apRuleSentenceWhen:"Quand", apRuleSentenceOrivenWill:", Oriven va",
    bizTabOverview:"Aperçu", bizTabBusiness:"Entreprise", bizTabProducts:"Produits", bizTabMarket:"Marché",
    bizTabBrand:"Marque", bizTabConnections:"Connexions", bizTabMemory:"Mémoire",
    bizLearningLabel:"Apprentissage", bizGetReflectionBtn:"Obtenir une analyse", bizInsightsLabel:"Insights métier",
    bizKnowledgeCheckLabel:"Vérification des connaissances", bizRunCheckBtn:"Lancer une vérification",
    bizProductsHeading:"Produits", bizAddProductBtn:"+ Ajouter un produit",
    bizAudienceHeading:"Audience", bizAddAudienceBtn:"+ Ajouter une audience",
    bizCompetitorsHeading:"Concurrents", bizAddCompetitorBtn:"+ Ajouter un concurrent",
    bizProfileCardTitle:"Profil de l'entreprise", bizProfileCardSub:"L'essentiel — qui vous êtes, ce que vous faites et où vous allez.",
    bizWebsiteCardTitle:"Site web", bizWebsiteCardSub:"Ce qu'Oriven a appris en lisant votre site.",
    bizFieldWebsiteUrl:"URL du site web", bizAnalyseWebsiteBtn:"Analyser mon site", bizRefreshAnalysisBtn:"Actualiser l'analyse",
    bizVoiceCardTitle:"Voix de marque", bizVoiceCardSub:"Choisissez les traits qui décrivent le ton de votre marque. Oriven les utilise dans chaque titre et script qu'il rédige.",
    bizConnectionsIntro:"Vos plateformes publicitaires. Connectez un compte et Oriven pourra lire et gérer directement les campagnes qui s'y trouvent.",
    bizMemoryIntro:"Tout ce qu'Oriven a appris en chemin — à partir des conversations et de ce qui a fonctionné. C'est la mémoire à long terme d'Oriven sur votre entreprise.",
    bizEmptyMemory:"Rien de mémorisé pour l'instant — cela se construit au fur et à mesure que vous utilisez Oriven.", bizMemoryDeleteBtn:"Supprimer",
    bizVcardEditBtn:"Modifier", bizVcardDeleteBtn:"Supprimer", bizVcardSaveBtn:"Enregistrer", bizVcardCloseBtn:"Fermer",
    bizVcardEmptyDetails:"Aucun détail pour l'instant — cliquez sur Modifier pour le renseigner.",
    conNotConnected:"Non connecté", conStatusConnected:"Connecté", conCheckingStatus:"Vérification…",
    conDisconnectBtn:"Déconnecter", conAdAccountsHeader:"Comptes publicitaires", conActiveBadge:"Actif", conSetActiveBtn:"Définir comme actif",
    conConnectGoogleBtn:"Connecter Google Ads →", conConnectMetaBtn:"Connecter Meta Ads →", conConnectTiktokBtn:"Connecter TikTok Ads →",
    conDetailConnectedAccounts:"Comptes connectés", conDetailConnectedBusinesses:"Entreprises connectées",
    bizReadingWebsiteBtn:"Lecture de votre site en cours…",
    rangeToday:"Aujourd'hui", rangeYesterday:"Hier", rangeLast7Days:"7 derniers jours", rangeLast30Days:"30 derniers jours",
    rangeLast90Days:"90 derniers jours", rangeThisMonth:"Ce mois-ci", rangeLastMonth:"Le mois dernier",
    rangeLast12Months:"12 derniers mois", rangeLifetime:"Depuis toujours", rangeCustom:"Période personnalisée…",
    tiktokAnalyticsTitle:"Analyses TikTok", tiktokAnalyticsComingSub:"Les analyses seront disponibles une fois votre compte TikTok Ads connecté.",
    connectBannerTitle:"Connectez vos comptes publicitaires pour débloquer les analyses en direct",
    connectBannerSub:"Reliez Google Ads, Meta Ads ou TikTok Ads pour suivre les dépenses, le ROAS et les conversions en temps réel.",
    connectAccountsBtn:"Connecter des comptes →",
    kpiTotalSpend:"Dépenses totales", kpiImpressions:"Impressions", kpiClicks:"Clics", kpiConversions:"Conversions", kpiRoas:"ROAS",
    kpiChgPlaceholder:"— vs période précédente",
    chartSpendOverTime:"Dépenses dans le temps", chartLockConnectLive:"Connectez un compte pour voir les données en direct", chartLockConnectUnlock:"Connectez pour débloquer",
    chartRoasOverTime:"ROAS dans le temps", chartCtrOverTime:"CTR dans le temps",
    orivenScoreTitle:"Score Oriven", orivenScoreSub:"Santé du compte alimentée par IA · 0–100",
    aiAnalysisTitle:"Analyse IA", aiAnalysisDefaultSummary:"Analysez ce compte pour détecter les dépenses gaspillées, un CTR faible, des problèmes de conversion et des opportunités de croissance.",
    analyzeWithAiBtn:"Analyser avec l'IA", aiSectionStrengths:"Points forts", aiSectionWeaknesses:"Points faibles",
    aiSectionRecommendations:"Recommandations", aiSectionExpectedImpact:"Impact attendu", generateAdCopyBtn:"Générer le texte publicitaire →",
    analyzingEllipsis:"Analyse en cours…", analysisFailed:"Échec de l'analyse", analysisFailedRetry:"Échec de l'analyse — réessayez", reanalyzeBtn:"Réanalyser",
    searchCampaignsPlaceholder:"Rechercher des campagnes…", newCampaignBtnPlain:"Nouvelle campagne", noCampaignsYetDot:"Aucune campagne pour l'instant.",
    noCampaignsYetSub:"Générez votre première campagne depuis Créer. Décrivez votre produit et Oriven créera instantanément une campagne complète.",
    createCampaignArrowBtn:"Créer une campagne →", noCampaignsMatchSearch:"Aucune campagne ne correspond à votre recherche.",
    continueWorkingHeader:"Poursuivre le travail",
    tiktokComingSoonSub:"L'intégration TikTok arrive bientôt. Une fois votre application TikTok approuvée et connectée, vos campagnes apparaîtront ici.",
    smdHdTitle:"Paramètres", smdNavGeneral:"Général", smdNavSubscription:"Abonnement", smdNavNotifications:"Notifications",
    smdNavAccount:"Compte", smdNavSecurity:"Sécurité",
    smdWsNameLabel:"Nom de l'espace de travail", smdWsNameHelp:"Apparaît dans la barre latérale et dans toute l'application.",
    smdThemeLabel:"Thème", smdThemeLight:"Clair", smdThemeDark:"Sombre", smdThemeSystem:"Système", smdAccentLabel:"Couleur d'accent",
    smdLangLabel:"Langue d'affichage et de génération", smdLangHelp:"Appliquée aux libellés de l'interface et au contenu généré par l'IA.",
    smdLoadingEllipsis:"Chargement…",
    smdNotifGenTitle:"Génération terminée", smdNotifGenSub:"Vous avertir lorsque l'IA termine de générer du contenu.",
    smdNotifPubTitle:"Publication terminée", smdNotifPubSub:"Vous avertir lorsque le contenu a été publié.",
    smdNotifBillTitle:"Mises à jour de facturation", smdNotifBillSub:"Alertes pour les renouvellements et l'activité de paiement.",
    smdNotifUpdTitle:"Mises à jour produit", smdNotifUpdSub:"Annonces in-app sur les nouvelles fonctionnalités.",
    smdNotifApTitle:"Approbations Autopilot", smdNotifApSub:"Vous avertir lorsqu'une recommandation ou une règle d'automatisation nécessite votre approbation.",
    smdSignedInWith:"Connecté avec", smdEmailLabel:"Adresse e-mail", smdEmailHelp:"Utilisée pour vous connecter et recevoir les notifications de compte.",
    smdChangePwTitle:"Changer le mot de passe", smdChangePwHelp:"Entrez votre mot de passe actuel, puis choisissez-en un nouveau.",
    smdCurrentPwPlaceholder:"Mot de passe actuel", smdNewPwPlaceholder:"Nouveau mot de passe (min. 8 caractères)", smdConfirmPwPlaceholder:"Confirmer le nouveau mot de passe",
    smdUpdatePwBtn:"Mettre à jour le mot de passe", smdForgotPwTitle:"Mot de passe oublié ?",
    smdForgotPwHelp:"Envoyez-vous plutôt un lien de réinitialisation par e-mail.", smdSendResetBtn:"Envoyer l'e-mail de réinitialisation",
    smdDangerZoneTitle:"Zone de danger", smdSignOutTitle:"Se déconnecter", smdSignOutSub:"Se déconnecter d'ORIVEN sur cet appareil.", smdSignOutBtn:"Se déconnecter",
    smdDeleteAcctTitle:"Supprimer le compte", smdDeleteAcctSub:"Supprime définitivement votre compte et toutes vos données. Cette action est irréversible.", smdDeleteAcctBtn:"Supprimer le compte",
    smdHelpGeneralHelp:"Le nom de votre espace de travail, le thème (clair/sombre/système), la couleur d'accent et la langue de l'interface. La couleur d'accent s'applique à toute l'application — survols, onglets actifs, boutons et anneaux de focus. Les modifications sont enregistrées automatiquement et appliquées immédiatement.",
    smdHelpSubHelp:"Votre offre actuelle, votre utilisation et la gestion de la facturation. Passez à niveau supérieur, inférieur ou gérez vos informations de paiement ici.",
    smdHelpNotifHelp:"Contrôlez quels événements génèrent une alerte — génération terminée, publication, facturation, mises à jour produit et approbations Autopilot. Désactiver une catégorie empêche ces notifications d'être créées, pas seulement masquées.",
    smdHelpAcctHelp:"Votre méthode de connexion et votre adresse e-mail. Les changements d'e-mail nécessitent de confirmer la nouvelle adresse avant qu'ils ne prennent effet.",
    smdHelpSecHelp:"Changez votre mot de passe directement (mot de passe actuel requis), ou envoyez-vous un lien de réinitialisation par e-mail.",
    smdHelpBizHelp:"Gérez les détails de votre entreprise, la voix de marque, les audiences et les comptes publicitaires connectés depuis l'espace Business — distinct des Paramètres personnels, car il peut être partagé entre coéquipiers.",
    smdHelpApHelp:"Règles d'automatisation qui agissent sur vos campagnes sans intervention manuelle. Les recommandations nécessitant votre validation apparaissent comme des notifications d'approbation Autopilot, contrôlées dans l'onglet Notifications.",
    smdRestartObTitle:"Relancer la visite guidée",
    smdRestartObHelp:"Revoir la visite guidée depuis le début. Utile pour une démonstration ou une piqûre de rappel.",
    smdRestartObBtn:"Relancer la visite guidée",
    helpTitle:"Aide", helpSub:"Ce que fait chaque section des Paramètres.",
    builderResultLabel:"Résultat", regenerateBtn:"Régénérer", saveToStudioBtn:"Enregistrer dans Studio"
  },

  nl:{
    dashboard:"Dashboard", create:"Maken", studio:"BrandCore",
    inspiration:"Inspiratie", settings:"Instellingen",
    goodMorning:"Goedemorgen", goodAfternoon:"Goedemiddag",
    goodEvening:"Goedenavond", goodNight:"Goedenacht",
    brandAssistant:"Merkassistent", openAIChat:"Begin met Maken",
    savedAssets:"Opgeslagen Bestanden", brandCore:"Merkkern",
    brandCheck:"Merkcontrole", campaigns:"Campagnes",
    workspace:"Werkruimte", plan:"Uw abonnement", appearance:"Weergave", language:"Taal",
    notifications:"Meldingen", exportPref:"Exporteren", brandReset:"Merk Reset",
    themeLabel:"Thema", lightMode:"Lichte modus", darkMode:"Donkere modus",
    accentLabel:"Accentkleur",
    accentHelp:"Kies de markeringskleur voor knoppen, actieve staten en UI-elementen.",
    noItems:"Nog geen opgeslagen bestanden",
    createContent:"Maak inhoud in AI Chat en sla het hier op.",
    welcomeMsg:"Hoe kan ik uw merk vandaag ondersteunen?",
    createSub:"Kies een type en begin. Uw BrandCore vormt elke uitvoer.",
    imageTitle:"Afbeelding",  imageDesc:"Maak visuals, posters en social media ontwerpen.",
    textTitle:"Tekst",        textDesc:"Genereer onderschriften, koppen en merkteksten.",
    campaignTitle:"Campagne", campaignDesc:"Bouw complete campagnes met visuals en teksten.",
    videoTitle:"Video",       videoDesc:"Maak video-ideeën, scripts en concepten.",
    webTitle:"Web",           webDesc:"Bouw merkgerichte landingspagina's en webmaterialen.",
    assistantDesc:"Vraag je merk-AI om begeleiding, ideeën en creatieve richting.",
    comingSoon:"Binnenkort",
    brandWorkspace:"Merkwerkruimte", signOut:"Uitloggen",
    dashHeadlinePrefix:"Jouw merk is", dashHeadlineHighlight:"klaar.",
    dashTagline:"Laten we het omzetten in content, advertenties en groei.",
    dashCreateLabel:"Inhoud maken",     dashCreateDesc:"Afbeeldingen, tekst, videoscripts en meer.",
    dashIdeasLabel:"Ideeën verkennen",  dashIdeasDesc:"Contentideeën, advertentiehoeken en campagneconcepten.",
    dashCampaignLabel:"Campagne maken", dashCampaignDesc:"Volledige multi-channel campagnes van begin tot eind.",
    dashBrandLabel:"Brand Core bewerken", dashBrandDesc:"Kleuren, lettertypen, toon en identiteit.",
    edit:"Bewerken", setUp:"Instellen", notConfigured:"Niet geconfigureerd",
    buildBrandIdentity:"Bouw je merkidentiteit om te beginnen.",
    setUpBrandCore:"Stel je Brand Core in →",
    createH1Line1:"Wat wil je vandaag", createH1Line2:"creëren?",
    brandStudioTitle:"Brand Studio", brandStudioSub:"Alles wat jouw merk definieert en aandrijft.",
    studioSavedLabel:"Opgeslagen", studioSavedDesc:"Al jouw gegenereerde content en bestanden.",
    studioBCDesc:"Kleuren, lettertypen, toon en identiteit.",
    studioCheckLabel:"Merkcontrole",  studioCheckDesc:"Analyseer content op merkconsistentie.",
    studioCampDesc:"Beheer en lanceer jouw actieve campagnes.",
    studioBackBtn:"Terug",
    noBCConfigured:"Nog geen Brand Core geconfigureerd",
    noBCConfiguredSub:"Stel jouw merkidentiteit in om AI-generatie te ontgrendelen.",
    aiGenerateBtn:"AI Genereren", manualSetupBtn:"Handmatig instellen",
    savedAssetsHeader:"Opgeslagen bestanden",
    openAIChatBtn:"Open AI Chat",
    noCampaignsTitle:"Nog geen campagnes",
    noCampaignsSub:"Bundel opgeslagen bestanden in visuele campagneconcepten voor social media en advertenties.",
    newCampaignBtn:"+ Nieuwe campagne",
    dropImageTitle:"Sleep jouw afbeelding hier",
    dropImageSub:"PNG, JPG of WEBP — sleep of klik om te bladeren",
    checkBrandNoImgBtn:"Merk controleren zonder afbeelding",
    readyForCheck:"Klaar voor merkcontrole",
    runBrandCheckBtn:"Merkcontrole uitvoeren", resetBtn:"Reset", removeBtn:"Verwijderen",
    analyzingBrand:"Merkconsistentie analyseren...",
    checkingDetails:"Kleuren, typografie en visuele stijl controleren",
    ideasTitle:"Ideeën", ideasSub:"Bewezen raamwerken om jouw volgende content te inspireren.",
    contentIdeasLabel:"Contentideeën",      contentIdeasDesc:"Posts, verhalen en formats die publiek opbouwen.",
    adAnglesLabel:"Advertentiehoeken",      adAnglesDesc:"Berichtgeving die aandacht omzet in actie.",
    visualStylesLabel:"Visuele Stijlen",    visualStylesDesc:"Esthetische richtingen voor jouw merkidentiteit.",
    campaignConceptsLabel:"Campagneconcepten", campaignConceptsDesc:"Complete structuren die echte resultaten opleveren.",
    idContentTitle:"Contentideeën", idAnglesTitle:"Advertentiehoeken",
    idVisualTitle:"Visuele Stijlen", idCampaignTitle:"Campagneconcepten",
    idContentUseLabel:"Gebruik dit idee",        idContentGenLabel:"Genereer bericht",
    idAnglesUseLabel:"Probeer deze hoek",         idAnglesGenLabel:"Genereer advertentie",
    idVisualUseLabel:"Gebruik deze stijl",        idVisualGenLabel:"Genereer visual",
    idCampaignUseLabel:"Bouw deze campagne",      idCampaignGenLabel:"Genereer bestanden",
    idCont0Label:"Educatieve Posts",     idCont1Label:"Product Spotlight",
    idCont2Label:"Oprichtersverhaal",    idCont3Label:"Transformatieverhaal",
    idCont4Label:"Klantresultaat",       idCont5Label:"Vergelijkingspost",
    idCont6Label:"Mythe vs. Waarheid",   idCont7Label:"Voor / Na",
    idCont8Label:"Routine / Werkwijze",  idCont9Label:"Autoriteitsopbouwer",
    idCont0Desc:"Leer je publiek één ding dat ze nog niet weten. Deel een contra-intuïtief inzicht uit jouw branche. Positioneer jouw merk als de expert voordat je ooit een product pitcht.",
    idCont1Desc:"Zet één product, functie of detail onder de aandacht. Focus op wat het anders maakt. Geen opsomming van functies — één hoek, goed uitgelegd. Maak het gewone opmerkelijk.",
    idCont2Desc:"Waarom ben je hiermee begonnen? Wat heb je geriskeert, mislukt of ontdekt? Mensen kopen niet van merken — ze kopen van mensen. Vertel het verhaal achter het merk.",
    idCont3Desc:"Toon de voor en na — niet alleen visueel, maar emotioneel. Wat veranderde er? Laat de lezer zichzelf in de transformatie zien.",
    idCont4Desc:"Één echte klant. Één echt resultaat. Wees specifiek — cijfers, tijdlijnen, context. Vage getuigenissen doen niets. Precieze verhalen converteren.",
    idCont5Desc:"Oude manier vs. jouw manier. Generiek vs. specifiek. Formuleer de vergelijking zodat jouw merk wint zonder iemand direct aan te vallen. Laat het contrast het werk doen.",
    idCont6Desc:"Ontkracht een veelvoorkomende overtuiging die mensen tegenhoudt. Vervang het door wat écht werkt. Dit formaat bouwt snel vertrouwen op en maakt jouw merk tot de autoriteit.",
    idCont7Desc:"Toon het contrast. Het rommelige bureau en het georganiseerde. Het omslachtige proces en het gestroomlijnde. Visueel of in tekst — voor/na is een van de meest overtuigende structuren.",
    idCont8Desc:"Toon hoe jij, jouw team of jouw klant jouw product gebruikt in een echte workflow. Procesinhoud bouwt diepte en vertrouwen.",
    idCont9Desc:"Deel een sterke mening over iets in jouw branche. Neem een duidelijk standpunt in. Merken met een standpunt trekken loyale doelgroepen aan. Neutrale merken trekken niemand aan.",
    idAng0Label:"Probleem → Oplossing",  idAng1Label:"Aspiratie",
    idAng2Label:"Transformatie",         idAng3Label:"Urgentie",
    idAng4Label:"Schaarste",             idAng5Label:"Pijnagitering",
    idAng6Label:"Sociaal Bewijs",        idAng7Label:"Premium Positionering",
    idAng8Label:"Voordeel Eerst",        idAng9Label:"Emotionele Haak",
    idAng0Desc:"Benoem de exacte pijn die jouw doelgroep nu voelt. Maak het specifiek genoeg dat ze zich gezien voelen. Toon dan de oplossing. Maak duidelijk dat jouw product de logische brug is.",
    idAng1Desc:"Toon het leven dat ze willen. Niet wat jouw product doet — hoe hun leven eruitziet nadat ze het gebruiken. Positioneer jouw merk als de brug. Verkoop de bestemming, niet het voertuig.",
    idAng2Desc:"Open waar ze zijn. Sluit waar ze kunnen zijn. De transformatie is het product. Maak het gat levendig — hoe groter het gat aanvoelt, hoe waardevoller de brug wordt.",
    idAng3Desc:"Beperkte tijd, beperkte voorraad of beperkte toegang — maak de schaarste reëel. Neppe urgentie werkt averechts. Echte beperkingen converteren. Geef hen één reden om nú te handelen.",
    idAng4Desc:"Niet iedereen kan dit hebben — en dat is het punt. Exclusieve toegang, wachtlijsten, beperkte batches. Schaarste signaleert waarde. Als iedereen het heeft, wil niemand het.",
    idAng5Desc:"Benoem het probleem niet alleen — druk erop. Laat hen de frustratie, de verspilde tijd, de kosten van inactie voelen. Agiteer voordat je oplost. Urgentie leeft in de pijn, niet in de oplossing.",
    idAng6Desc:"Niet alleen '5 sterren' — geef bewijs met context. Wie behaalde het resultaat? Hoe lang duurde het? Specifiek bewijs van een herkenbaar persoon converteert ver beter dan generieke lof.",
    idAng7Desc:"Concurreer niet op prijs — concurreer op categorie. Als je de beste bent, gedraag je daarnaar. Hogere prijs = hogere gepercipieerde waarde wanneer de positionering klopt.",
    idAng8Desc:"Begin met de uitkomst, niet de functie. Niet '16 uur batterij' — 'Kom de hele dag door zonder eens aan je telefoon te denken.' Vertaal elke functie in het gevoel dat het creëert.",
    idAng9Desc:"Sla de logica volledig over. Open met een gevoel — opluchting, trots, opwinding, verbondenheid. Mensen nemen beslissingen emotioneel en rechtvaardigen met logica.",
    idVis0Label:"Luxe Minimaal",       idVis1Label:"Gedurfd Modern",
    idVis2Label:"Donker Premium",      idVis3Label:"Zachte Levensstijl",
    idVis4Label:"Redactioneel Strak",  idVis5Label:"Hoog Contrast",
    idVis6Label:"Futuristisch Slank",  idVis7Label:"Organisch Natuurlijk",
    idVis8Label:"Sportief Prestatie",  idVis9Label:"Elegant Vrouwelijk",
    idVis0Desc:"Schone vlakken, royale witruimte, premium typografie, ingetogen palet. Niets decoratiefs. Elk element heeft zijn reden. Stilte op de pagina communiceert kwaliteit.",
    idVis1Desc:"Sterke geometrie, hoog contrast, zelfverzekerde typografie zonder decoratie. Geen zachte gradients, geen onnodige schaduwen. Het grid is het ontwerp.",
    idVis2Desc:"Diepe bijna-zwarte tonen, neon of goud accenten, redactionele framing, cinematische sfeer. Sterk voor tech, streetwear en beauty.",
    idVis3Desc:"Echte mensen, natuurlijk licht, warme spontane momenten, onvolmaakte texturen. Authentiek verslaat gepolijst bij het opbouwen van emotionele connectie.",
    idVis4Desc:"Magazine-kwaliteit compositie. Sterke typografie die de layout leidt. Product als kunst. Elk visueel voelt intentioneel. Gebruikt door fashion, beauty en media merken.",
    idVis5Desc:"Puur zwart tegen puur wit. Of een enkele vette kleur naar maximale verzadiging. Geen middentonen, geen gradients. Maximale impact met minimale complexiteit.",
    idVis6Desc:"Metalen oppervlakken, koele tonen, strakke lijnen, subtiele gloed-effecten. Voelt voor zijn tijd uit. Werkt voor AI, hardware en tech-voorwaartse merken.",
    idVis7Desc:"Aardse tonen, ruwe texturen, botanische elementen, handgetekende details. Voelt eerlijk en gegrond. Ideaal voor wellness, voeding, huidverzorging en duurzaamheidsmerken.",
    idVis8Desc:"Dynamische hoeken, bewegingsvervaging, vette typografie, hoge verzadiging. Ontworpen om als beweging te voelen. Sterk voor fitness, sport en energiemerken.",
    idVis9Desc:"Zachte paletten, delicate typografie, verfijnde negatieve ruimte. Warmte en verfijning in gelijke mate. Sterk voor beauty, fashion, home en lifestyle merken.",
    idCamp0Label:"Productlancering",        idCamp1Label:"Merkbekendheid",
    idCamp2Label:"Seizoenslancering",       idCamp3Label:"Conversiepush",
    idCamp4Label:"Educatieve Funnel",       idCamp5Label:"Retargetingreeks",
    idCamp6Label:"Beperkt Aanbod Sprint",   idCamp7Label:"Oprichtercampagne",
    idCamp8Label:"Getuigeniscampagne",      idCamp9Label:"Gemeenschapscampagne",
    idCamp0Desc:"Bouw anticipatie → onthul → educeer → converteer. Reeks over één tot twee weken. Teaser voor je toont. Toon voor je verkoopt. Educeer voor je vraagt.",
    idCamp1Desc:"Vertel jouw verhaal voor je verkoopt. Herhaalde lage-druk blootstelling via platforms. Geen CTA op elke post. Verschijn eerst met consistente waarde. Verkoop later.",
    idCamp2Desc:"Verankerd aan een moment — feestdag, seizoen, culturele gebeurtenis. Bouw anticipatie van tevoren, lanceer hard, sluit af met een laatste 48-uurs push.",
    idCamp3Desc:"Full-funnel campagne geoptimaliseerd voor één actie: kopen, aanmelden of boeken. Bewustzijnsadvertenties → retargeting → winkelwagen verlaten → last-chance e-mail.",
    idCamp4Desc:"Leer jouw doelgroep voordat je aan hen verkoopt. Content → vertrouwen → product. Een serie, een gratis gids of een korte cursus. Tegen de tijd dat ze het aanbod zien, geloven ze je al.",
    idCamp5Desc:"Heractiveer mensen die je al kennen maar niet hebben geconverteerd. Ander bericht voor verschillende stadia — bezocht de site, begon checkout, bekeek video.",
    idCamp6Desc:"Korte, intensieve campagne rond een echte beperking: 72 uur, 50 eenheden, één cohort. Smal venster = echte urgentie. Sluit hard af bij de deadline.",
    idCamp7Desc:"Zet de oprichter centraal. Hun gezicht, hun stem, hun verhaal. Mensen vertrouwen mensen meer dan merken. Een direct persoonlijk bericht van de oprichter kan elke advertentie overtreffen.",
    idCamp8Desc:"Laat jouw klanten het woord doen. Echte woorden, echte gezichten, echte resultaten. Verzamel sterke getuigenissen en bouw de campagne rond hun taal — niet de jouwe.",
    idCamp9Desc:"Bouw rondom jouw doelgroep, niet op hen gericht. Door gebruikers gegenereerde content, uitdagingen, gedeelde tags. Verandert klanten in pleitbezorgers.",
    teamTitle:"Team", teamSub:"Beheer jouw Business workspace team.",
    settingsTitle:"Instellingen", settingsSub:"Beheer jouw werkruimte en voorkeuren.",
    spWorkspaceSub:"Beheer jouw merkwerkruimte en voorkeuren.",
    wsNameLabel:"Naam werkruimte",
    wsNameHelp:"Dit is de naam van jouw werkruimte in ORIVEN. Het verschijnt in de zijbalk en door de hele app.",
    saveBtn:"Opslaan",
    brandLockLabel:"Merkvergrendeling", lockBCLabel:"Vergrendel BrandCore",
    lockBCSub:"Wanneer ingeschakeld, blijft jouw BrandCore vast en wordt het consistent toegepast op alle gegenereerde content.",
    spAppearanceSub:"Kies hoe ORIVEN eruitziet en aanvoelt. Jouw voorkeur wordt opgeslagen.",
    spLanguageSub:"Stel de weergave- en contentgeneratietaal in voor jouw werkruimte.",
    langDisplayLabel:"Weergave- en Generatietaal",
    langDisplayHelp:"ORIVEN gebruikt deze taal voor interface-labels en bij het genereren van content met jouw BrandCore.",
    spNotificationsSub:"Beheer meldingen in de app. Wijzigingen worden direct opgeslagen.",
    notifBrandCheckLabel:"Merkcontrolemeldingen",
    notifBrandCheckSub:"Toon een melding wanneer jouw merkscore onder de 70% daalt.",
    notifGenCompleteLabel:"Generatie voltooid",
    notifGenCompleteSub:"Ontvang een melding wanneer de AI klaar is met het genereren van content.",
    notifUpdatesLabel:"Productupdates",
    notifUpdatesSub:"Ontvang in-app aankondigingen over nieuwe ORIVEN-functies en verbeteringen.",
    spExportTitle:"Exportvoorkeuren", spExportSub:"Bepaal hoe jouw gegenereerde content wordt voorbereid voor export.",
    expFormatLabel:"Standaard exportformaat",
    expFormatHelp:"Kies het standaard bestandsformaat bij het downloaden van gegenereerde bestanden.",
    autoSaveLabel:"Gegenereerde content automatisch opslaan",
    autoSaveSub:"Sla jouw wijzigingen en gegenereerde content automatisch op in Studio.",
    spDangerSub:"Permanente acties — deze kunnen niet ongedaan worden gemaakt.",
    resetBCTitle:"Brand Core resetten",
    resetBCDesc:"Dit reset jouw volledige merkinstelling — kleuren, toon, positionering en identiteitsdata. Jouw opgeslagen bestanden in Studio worden niet beïnvloed, maar toekomstige generaties verliezen merkcontext. Deze actie is permanent en kan niet worden teruggedraaid.",
    resetBCBtn:"Brand Core resetten",
    navLaunch:"Launch", navCampaigns:"Campagnes", navIntelligence:"Intelligentie", navAutopilot:"Autopilot", navBusiness:"Bedrijf", navSettings:"Instellingen",
    wsTitleIntelligence:"Intelligentie", wsSubIntelligence:"Wat vandaag jouw aandacht verdient.",
    wsTitleBusiness:"Bedrijf", wsSubBusiness:"Leer Oriven eenmalig over je bedrijf — elke campagne, elk gesprek en elke aanbeveling gebruikt dit vanaf dan automatisch.",
    wsTitleAutopilot:"Autopilot", wsSubAutopilot:"Automatiseert repetitief advertentiewerk. Niets meer.",
    wsTitlePerformance:"Prestaties", wsSubPerformance:"Hoe presteren jouw campagnes?",
    wsTitleCampaigns:"Campagnes", wsSubCampaigns:"Beheer jouw campagnes — concepten, actief en gearchiveerd.",
    hubTabOverview:"Overzicht", hubTabLiveCampaigns:"Actieve campagnes", hubTabDrafts:"Concepten",
    toastTypographyComingSoon:"Typografie-editor binnenkort beschikbaar", toastToneComingSoon:"Toon-editor binnenkort beschikbaar",
    toastPositioningComingSoon:"Positionering-editor binnenkort beschikbaar", toastSavedDraft:"Opgeslagen als concept",
    toastEnterCampaignName:"Voer een campagnenaam in", toastEnterCampaignGoal:"Voer je campagnedoel in",
    toastDescribeBusiness:"Beschrijf je bedrijf of product", toastSelectCreativeFormat:"Selecteer minstens één creatief formaat",
    toastCopied:"Gekopieerd!", toastChangesApplied:"Wijzigingen toegepast", toastCopiedClipboard:"Gekopieerd naar klembord",
    toastAddModuleComingSoon:"Module toevoegen — binnenkort beschikbaar", toastRegenerating:"Opnieuw genereren…", toastRegenerated:"Opnieuw gegenereerd",
    toastRegenerationFailed:"Opnieuw genereren mislukt — probeer het nogmaals", toastCampaignExported:"Campagne geëxporteerd",
    toastCampaignDuplicated:"Campagne gedupliceerd", toastCampaignQueued:"Campagne in wachtrij voor publicatie",
    toastCampaignNotFound:"Campagnegegevens niet gevonden", toastNoPlatformSet:"Geen platform ingesteld voor deze campagne",
    toastCampaignPublishedTo:"Campagne gepubliceerd op", toastPublishFailedPrefix:"Publiceren mislukt:",
    toastCampaignPaused:"Campagne gepauzeerd", toastCampaignResumed:"Campagne hervat",
    toastCampaignArchived:"Campagne gearchiveerd", toastCampaignDeleted:"Campagne verwijderd",
    toastDescribeAdvertise:"Beschrijf wat je wilt adverteren", toastDescribeSelling:"Beschrijf wat je verkoopt",
    toastChooseGoal:"Kies een doel", toastSelectPlatform:"Selecteer minstens één platform",
    toastComingSoon:"binnenkort beschikbaar", toastActiveAccountUpdated:"Actief account bijgewerkt",
    toastFailedSetAccount:"Account instellen mislukt — probeer het nogmaals", toastNetworkError:"Netwerkfout — probeer het nogmaals",
    toastConnectionFailed:"Verbinding mislukt — probeer het nogmaals.", toastConnectionFailedShort:"Verbinding mislukt.",
    toastDisconnectFailed:"Verbinding verbreken mislukt — probeer het nogmaals.", toastEnterWebsiteUrl:"Voer eerst een website-URL in.",
    toastWebsiteAnalysed:"Website geanalyseerd. Business-kennis bijgewerkt.",
    toastWebsiteAnalyseFailed:"Kon deze website niet analyseren. Controleer de URL en probeer het opnieuw.",
    toastSelectDestinationAccount:"Selecteer eerst een doelaccount",
    toastReportNeedsAccount:"Rapportgeneratie vereist een gekoppeld advertentieaccount.",
    toastNoReportsYet:"Nog geen rapporten om te exporteren. Genereer eerst een rapport.", toastCampaignGenerated:"Campagne gegenereerd",
    toastPublishingToEllipsis:"Publiceren op", toastPublishErrorPrefix:"Publicatiefout:",
    toastImagePromptCopied:"Afbeeldingsprompt gekopieerd", toastNoPackageYet:"Nog geen pakket gegenereerd",
    toastPackageCopied:"Campagnepakket gekopieerd naar klembord", toastEnterCampaignDesc:"Voer een campagnebeschrijving in.",
    toastEngineNotLoaded:"Generatie-engine niet geladen. Vernieuw de pagina.", toastGenerationFailedPrefix:"Campagne genereren mislukt:",
    toastConnectedSuffix:"verbonden!", toastDisconnectedSuffix:"verbinding verbroken.",
    toastConnectingEllipsis:"Verbinden…", btnConnectPlatformSuffix:"Ads →", btnConnectingPlatform:"Verbinden…",
    confirmDisconnectPlatform:"{platform} loskoppelen? Live-analyses stoppen, maar je campagnegegevens blijven bewaard.",
    toastSavedBizKnowledge:"Succesvol opgeslagen. Business-kennis bijgewerkt.", toastCouldNotSave:"Opslaan mislukt. Probeer het opnieuw.",
    toastSignedOut:"Uitgelogd", toastProfileLoadFailed:"Profiel laden mislukt — vernieuw de pagina.",
    toastPleaseSignIn:"Log eerst in", toastVerificationSent:"Verificatie-e-mail verzonden — controleer je inbox",
    toastCouldNotSendPrefix:"Verzenden mislukt —", toastEmailVerified:"E-mail geverifieerd — je account is bevestigd!",
    toastVerificationInvalid:"Verificatielink is ongeldig of al gebruikt. Vraag een nieuwe aan.",
    toastBrandCoreSavedCloud:"Brand Core opgeslagen in de cloud", toastCheckoutFailed:"Kon afrekenen niet starten — probeer het opnieuw",
    toastCheckoutCanceled:"Afrekenen geannuleerd — je kunt op elk moment upgraden.",
    toastSubscriptionActive:"Je abonnement is nu actief — welkom bij ORIVEN!",
    toastPaymentReceived:"Betaling ontvangen — je account wordt geactiveerd...",
    toastSubscriptionPending:"Abonnement in behandeling — vernieuw over een moment.",
    toastPlatformConnectedSuccess:"succesvol verbonden!",
    launchH1:"Lanceer je volgende campagne.", genModeImage:"Afbeelding", genModeVideo:"Video",
    attachImageBtn:"Afbeelding bijvoegen", launchPromptPlaceholder:"Wat wil je vandaag adverteren? bijv. Een sportkledingmerk gericht op jonge mannen in Amsterdam. Budget €30/dag.",
    currentlyWorkingWith:"Momenteel bezig met", setUpBusinessCta:"Stel je bedrijf in om elke campagne te personaliseren →",
    addMoreImages:"Meer toevoegen", generatingEllipsis:"Genereren…",
    intelMonitorBtn:"Gevolgde campagnes", intelBriefingHeading:"Directiebriefing", intelPriorityHeading:"Hoogste prioriteit",
    intelWatchlistHeading:"Volglijst", intelMonitorPanelTitle:"Gevolgde campagnes",
    intelMonitorPanelDesc:"Intelligence analyseert alleen campagnes die je hier kiest te volgen — nooit automatisch je hele account.",
    intelMonitorNoCampaigns:"Verbind Google of Meta Ads om je campagnes hier te zien.",
    intelBriefLoadingText:"Je gevolgde campagnes worden bekeken…", intelLoadErrorText:"Kon Intelligence nu niet laden.",
    intelConnectPromptPrefix:"Verbind een Google- of Meta-account om dit te ontgrendelen —", intelConnectPromptLink:"ga naar Integraties",
    intelWatchlistEmpty:"Geen ongebruikelijke wijzigingen gedetecteerd.", intelNoMonitoredPrefix:"Nog geen gevolgde campagnes.",
    intelNoMonitoredLink:"Selecteer een of meer campagnes", intelNoMonitoredSuffix:"om dagelijkse AI-briefings te ontvangen.",
    intelBriefEmpty:"Geen significante wijzigingen vandaag gedetecteerd. Alles presteert binnen de verwachte bandbreedte.",
    intelCardLabelReason:"Reden", intelCardLabelWhy:"Waarom", intelCardLabelExpectedImpact:"Verwachte impact",
    intelCardLabelExpectedOutcome:"Verwacht resultaat", intelCardLabelRecommendedAction:"Aanbevolen actie",
    intelCardTitleFallback:"Observatie", intelConfidenceSuffix:"zekerheid",
    notifCatAutomation:"Automatisering", notifCatOpportunity:"Kans", notifCatCompleted:"Voltooid",
    notifCatLearning:"Leren", notifCatCritical:"Kritiek", notifCatWarning:"Waarschuwing",
    notifEmptyText:"Geen urgente meldingen.", notifCatApproval:"Goedkeuring", notifDismissBtn:"Negeren",
    apSectionBuilder:"Automatiseringsbouwer", apSectionActive:"Actieve automatiseringen", apSectionSuggested:"Voorgesteld door Oriven",
    apSectionHistory:"Automatiseringsgeschiedenis", apSectionSettings:"Automatiseringsinstellingen",
    apStepQPlatform:"Wat moet ik in de gaten houden?", apRecapLblPlatform:"Bewaking",
    apStepQCampaign:"Welke campagne?", apRecapLblCampaign:"Campagne",
    apStepQCondition:"Wanneer moet ik reageren?", apRecapLblCondition:"Voorwaarde",
    apStepQAction:"Wat moet er gebeuren?", apRecapLblAction:"Actie",
    apStepReview:"Controleren", apModeQuestion:"Hoe moet ik dit afhandelen?", apRecapEdit:"Wijzigen",
    statusActive:"Actief", statusPaused:"Gepauzeerd", apNamePlaceholder:"Naam voor deze automatisering (optioneel)",
    apHistorySearchPlaceholder:"Geschiedenis zoeken…", apContinueBtn:"Doorgaan", apTestBtn:"Testen",
    apCreateAutomationBtn:"Automatisering aanmaken", apSaveChangesBtn:"Wijzigingen opslaan", apStartOverBtn:"Opnieuw beginnen", apByLabel:"met",
    apSetDefaultModeLabel:"Standaardmodus voor nieuwe regels", apModeRequireApproval:"Goedkeuring vereist",
    apModeSuggestOnly:"Alleen suggereren", apModeFullyAutomatic:"Volledig automatisch",
    apNotifyEnabled:"Ingeschakeld", apNotifyDisabled:"Uitgeschakeld", apBriefTimeLabel:"Tijdstip dagelijkse briefing",
    apMetricRoas:"ROAS", apMetricCtr:"CTR", apMetricCpc:"CPC", apMetricCpa:"CPA", apMetricConversions:"Conversies",
    apMetricSpend:"Uitgaven", apMetricClicks:"Klikken", apMetricImpressions:"Vertoningen", apMetricBudget:"Budget", apMetricStatus:"Campagnestatus",
    apOpGreaterThan:"is groter dan", apOpLessThan:"is kleiner dan", apOpEquals:"is gelijk aan", apOpAtLeast:"is ten minste", apOpAtMost:"is ten hoogste",
    apActionIncreaseBudget:"Budget verhogen", apActionDecreaseBudget:"Budget verlagen", apActionPause:"Campagne pauzeren",
    apActionResume:"Campagne hervatten", apActionGenCreative:"Nieuwe creative genereren", apActionGenRecs:"AI-aanbevelingen genereren",
    apActionNotify:"Mij melden", apActionRequestApproval:"Goedkeuring vragen", apActionCreateReport:"Rapport genereren",
    apActionCreateBriefing:"Briefing maken", apActionRunOptimisation:"AI-optimalisatie uitvoeren",
    apModeAskFirst:"Vraag mij eerst", apModeAskFirstDesc:"Jij keurt elke keer goed",
    apModeSuggestIt:"Stel het alleen voor", apModeSuggestItDesc:"Geen automatische actie",
    apModeHandleAuto:"Automatisch afhandelen", apModeHandleAutoDesc:"Geen goedkeuring nodig",
    apAllCampaigns:"Alle campagnes", apAllCampaignsDesc:"Elke campagne op dit platform", apJustThisCampaignDesc:"Alleen deze campagne", apUnnamedCampaign:"Naamloos",
    apErrNumeric:"Voer een numerieke waarde in (bijv. 4.0), geen tekst.", apErrPercent:"Voer een percentage tussen 1 en 100 in.",
    apErrIncomplete:"Kies eerst een voorwaarde en een actie.", apErrChooseStatus:"Kies Actief of Gepauzeerd.",
    apErrSaveFirst:"Sla de automatisering eerst op en test deze daarna.", apErrTestFailed:"Kon deze regel nu niet testen.",
    apErrSaveFailed:"Kon die automatisering niet opslaan.", apErrLoadActiveFailed:"Kon je automatiseringen niet laden.",
    apErrLoadHistoryFailed:"Kon de geschiedenis niet laden.",
    apEmptyActiveText:"Je hebt nog geen automatiseringen aangemaakt. Laten we samen het repetitieve werk automatiseren.",
    apEmptyHistoryText:"Nog geen automatiseringsactiviteit.",
    apExampleBudgetRoas:"Budget verhogen wanneer ROAS boven 4 komt", apExamplePauseNoConv:"Campagnes zonder conversies pauzeren",
    apExampleDailyBriefing:"Een dagelijkse briefing genereren", apExampleNotifyCtr:"Mij melden wanneer CTR daalt",
    apNeverRun:"Nooit", apStatusRunning:"Actief", apLastExecutedPrefix:"Laatst uitgevoerd:",
    apDisableBtn:"Uitschakelen", apEnableBtn:"Inschakelen", apDeleteBtn:"Verwijderen",
    apAwaitingYourApproval:"Wacht op jouw goedkeuring", dateToday:"Vandaag", dateYesterday:"Gisteren", dateDaysAgoSuffix:"dagen geleden", apDateEarlier:"Eerder",
    apAwaitingApproval:"Wacht op goedkeuring", apApproveBtn:"Goedkeuren", apRejectBtn:"Afwijzen",
    apSuggestSetupBtn:"Instellen",
    apReviewIllMonitor:"Ik houd", apReviewAllCampaignsOf:"al je", apReviewCampaignsPlural:"campagnes in de gaten",
    apReviewWhenever:"Zodra", apReviewIs:"is", apReviewIllComma:", zal ik",
    apReviewModeFullyAuto:" Ik doe dit automatisch — je krijgt daarna een melding.",
    apReviewModeSuggest:" Ik markeer het alleen als suggestie, zonder actie.",
    apReviewModeApproval:" Ik vraag eerst jouw goedkeuring.",
    apErrBudgetUnsupported:"Budgetwijzigingen zijn nog niet beschikbaar op", apYetSuffix:"",
    apTestingAgainstData:"Testen met je echte campagnegegevens…", apWouldTriggerNow:"Zou nu worden geactiveerd",
    apCheckedCampaignsPrefix:"Gecontroleerd", apCampaignSingular:"campagne", apCampaignPlural:"campagnes",
    apNoneMatchCondition:"geen enkele voldoet momenteel aan deze voorwaarde.",
    apRuleSentenceWhen:"Wanneer", apRuleSentenceOrivenWill:", zal Oriven",
    bizTabOverview:"Overzicht", bizTabBusiness:"Bedrijf", bizTabProducts:"Producten", bizTabMarket:"Markt",
    bizTabBrand:"Merk", bizTabConnections:"Verbindingen", bizTabMemory:"Geheugen",
    bizLearningLabel:"Leren", bizGetReflectionBtn:"Reflectie ophalen", bizInsightsLabel:"Bedrijfsinzichten",
    bizKnowledgeCheckLabel:"Kenniscontrole", bizRunCheckBtn:"Kenniscontrole uitvoeren",
    bizProductsHeading:"Producten", bizAddProductBtn:"+ Product toevoegen",
    bizAudienceHeading:"Doelgroep", bizAddAudienceBtn:"+ Doelgroep toevoegen",
    bizCompetitorsHeading:"Concurrenten", bizAddCompetitorBtn:"+ Concurrent toevoegen",
    bizProfileCardTitle:"Bedrijfsprofiel", bizProfileCardSub:"De basis — wie je bent, wat je doet en waar je naartoe werkt.",
    bizWebsiteCardTitle:"Website", bizWebsiteCardSub:"Wat Oriven heeft geleerd door je site te lezen.",
    bizFieldWebsiteUrl:"Website-URL", bizAnalyseWebsiteBtn:"Mijn website analyseren", bizRefreshAnalysisBtn:"Analyse vernieuwen",
    bizVoiceCardTitle:"Merkstem", bizVoiceCardSub:"Kies de eigenschappen die beschrijven hoe je merk klinkt. Oriven gebruikt deze in elke titel en elk script dat het schrijft.",
    bizConnectionsIntro:"Je advertentieplatforms. Verbind een account en Oriven kan er direct campagnes op lezen en beheren.",
    bizMemoryIntro:"Alles wat Oriven onderweg heeft geleerd — uit gesprekken en wat heeft gewerkt. Dit is Orivens langetermijngeheugen van je bedrijf.",
    bizEmptyMemory:"Nog niets onthouden — dit bouwt zich op naarmate je Oriven gebruikt.", bizMemoryDeleteBtn:"Verwijderen",
    bizVcardEditBtn:"Bewerken", bizVcardDeleteBtn:"Verwijderen", bizVcardSaveBtn:"Opslaan", bizVcardCloseBtn:"Sluiten",
    bizVcardEmptyDetails:"Nog geen details — klik op Bewerken om dit in te vullen.",
    conNotConnected:"Niet verbonden", conStatusConnected:"Verbonden", conCheckingStatus:"Controleren…",
    conDisconnectBtn:"Loskoppelen", conAdAccountsHeader:"Advertentieaccounts", conActiveBadge:"Actief", conSetActiveBtn:"Actief instellen",
    conConnectGoogleBtn:"Google Ads verbinden →", conConnectMetaBtn:"Meta Ads verbinden →", conConnectTiktokBtn:"TikTok Ads verbinden →",
    conDetailConnectedAccounts:"Verbonden accounts", conDetailConnectedBusinesses:"Verbonden bedrijven",
    bizReadingWebsiteBtn:"Je website wordt gelezen…",
    rangeToday:"Vandaag", rangeYesterday:"Gisteren", rangeLast7Days:"Laatste 7 dagen", rangeLast30Days:"Laatste 30 dagen",
    rangeLast90Days:"Laatste 90 dagen", rangeThisMonth:"Deze maand", rangeLastMonth:"Vorige maand",
    rangeLast12Months:"Laatste 12 maanden", rangeLifetime:"Gehele periode", rangeCustom:"Aangepaste periode…",
    tiktokAnalyticsTitle:"TikTok-analyses", tiktokAnalyticsComingSub:"Analyses worden beschikbaar zodra je TikTok Ads-account is verbonden.",
    connectBannerTitle:"Verbind je advertentieaccounts om live analyses te ontgrendelen",
    connectBannerSub:"Koppel Google Ads, Meta Ads of TikTok Ads om uitgaven, ROAS en conversies in realtime te volgen.",
    connectAccountsBtn:"Accounts verbinden →",
    kpiTotalSpend:"Totale uitgaven", kpiImpressions:"Vertoningen", kpiClicks:"Klikken", kpiConversions:"Conversies", kpiRoas:"ROAS",
    kpiChgPlaceholder:"— t.o.v. vorige periode",
    chartSpendOverTime:"Uitgaven in de tijd", chartLockConnectLive:"Verbind een account om live gegevens te zien", chartLockConnectUnlock:"Verbind om te ontgrendelen",
    chartRoasOverTime:"ROAS in de tijd", chartCtrOverTime:"CTR in de tijd",
    orivenScoreTitle:"Oriven-score", orivenScoreSub:"AI-gestuurde accountgezondheid · 0–100",
    aiAnalysisTitle:"AI-analyse", aiAnalysisDefaultSummary:"Analyseer dit account op verspilde uitgaven, lage CTR, conversieproblemen en schaalkansen.",
    analyzeWithAiBtn:"Analyseren met AI", aiSectionStrengths:"Sterke punten", aiSectionWeaknesses:"Zwakke punten",
    aiSectionRecommendations:"Aanbevelingen", aiSectionExpectedImpact:"Verwachte impact", generateAdCopyBtn:"Advertentietekst genereren →",
    analyzingEllipsis:"Analyseren…", analysisFailed:"Analyse mislukt", analysisFailedRetry:"Analyse mislukt — probeer het opnieuw", reanalyzeBtn:"Opnieuw analyseren",
    searchCampaignsPlaceholder:"Campagnes zoeken…", newCampaignBtnPlain:"Nieuwe campagne", noCampaignsYetDot:"Nog geen campagnes.",
    noCampaignsYetSub:"Genereer je eerste campagne vanuit Creëren. Beschrijf je product en Oriven bouwt direct een complete campagne.",
    createCampaignArrowBtn:"Campagne aanmaken →", noCampaignsMatchSearch:"Geen campagnes komen overeen met je zoekopdracht.",
    continueWorkingHeader:"Verder werken",
    tiktokComingSoonSub:"TikTok-integratie komt binnenkort. Zodra je TikTok-app is goedgekeurd en verbonden, verschijnen je campagnes hier.",
    smdHdTitle:"Instellingen", smdNavGeneral:"Algemeen", smdNavSubscription:"Abonnement", smdNavNotifications:"Notificaties",
    smdNavAccount:"Account", smdNavSecurity:"Beveiliging",
    smdWsNameLabel:"Werkruimtenaam", smdWsNameHelp:"Verschijnt in de zijbalk en in de hele app.",
    smdThemeLabel:"Thema", smdThemeLight:"Licht", smdThemeDark:"Donker", smdThemeSystem:"Systeem", smdAccentLabel:"Accentkleur",
    smdLangLabel:"Weergave- en generatietaal", smdLangHelp:"Toegepast op interfacelabels en door AI gegenereerde inhoud.",
    smdLoadingEllipsis:"Laden…",
    smdNotifGenTitle:"Generatie voltooid", smdNotifGenSub:"Waarschuw me wanneer AI klaar is met content genereren.",
    smdNotifPubTitle:"Publicatie voltooid", smdNotifPubSub:"Waarschuw me wanneer content is gepubliceerd.",
    smdNotifBillTitle:"Facturatie-updates", smdNotifBillSub:"Meldingen voor verlengingen en betalingsactiviteit.",
    smdNotifUpdTitle:"Productupdates", smdNotifUpdSub:"In-app aankondigingen over nieuwe functies.",
    smdNotifApTitle:"Autopilot-goedkeuringen", smdNotifApSub:"Waarschuw me wanneer een aanbeveling of automatiseringsregel jouw goedkeuring nodig heeft.",
    smdSignedInWith:"Ingelogd met", smdEmailLabel:"E-mailadres", smdEmailHelp:"Gebruikt om in te loggen en accountmeldingen te ontvangen.",
    smdChangePwTitle:"Wachtwoord wijzigen", smdChangePwHelp:"Voer je huidige wachtwoord in en kies dan een nieuw wachtwoord.",
    smdCurrentPwPlaceholder:"Huidig wachtwoord", smdNewPwPlaceholder:"Nieuw wachtwoord (min. 8 tekens)", smdConfirmPwPlaceholder:"Bevestig nieuw wachtwoord",
    smdUpdatePwBtn:"Wachtwoord bijwerken", smdForgotPwTitle:"Wachtwoord vergeten?",
    smdForgotPwHelp:"Stuur jezelf in plaats daarvan een reset-link per e-mail.", smdSendResetBtn:"Reset-e-mail verzenden",
    smdDangerZoneTitle:"Gevarenzone", smdSignOutTitle:"Uitloggen", smdSignOutSub:"Log uit van ORIVEN op dit apparaat.", smdSignOutBtn:"Uitloggen",
    smdDeleteAcctTitle:"Account verwijderen", smdDeleteAcctSub:"Verwijder je account en alle gegevens permanent. Dit kan niet ongedaan worden gemaakt.", smdDeleteAcctBtn:"Account verwijderen",
    smdHelpGeneralHelp:"Je werkruimtenaam, thema (licht/donker/systeem), accentkleur en interfacetaal. Accentkleur geldt in de hele app — hoverstatus, actieve tabbladen, knoppen en focusringen. Wijzigingen worden automatisch opgeslagen en direct toegepast.",
    smdHelpSubHelp:"Je huidige abonnement, gebruik en facturatiebeheer. Upgrade, downgrade of beheer betaalgegevens vanaf hier.",
    smdHelpNotifHelp:"Bepaal welke gebeurtenissen een melding genereren — generatie voltooid, publicatie, facturatie, productupdates en Autopilot-goedkeuringen. Een categorie uitschakelen voorkomt dat die meldingen worden aangemaakt, niet alleen verborgen.",
    smdHelpAcctHelp:"Je inlogmethode en e-mailadres. E-mailwijzigingen vereisen bevestiging van het nieuwe adres voordat ze van kracht worden.",
    smdHelpSecHelp:"Wijzig je wachtwoord direct (huidig wachtwoord vereist), of stuur jezelf een reset-link per e-mail.",
    smdHelpBizHelp:"Beheer je bedrijfsgegevens, merkstem, doelgroepen en verbonden advertentieaccounts vanuit de Business-werkruimte — los van persoonlijke Instellingen, omdat deze met teamgenoten kan worden gedeeld.",
    smdHelpApHelp:"Automatiseringsregels die zonder handmatige tussenkomst op je campagnes inwerken. Aanbevelingen die jouw goedkeuring nodig hebben, verschijnen als Autopilot-goedkeuringsmeldingen, beheerd in het tabblad Notificaties.",
    smdRestartObTitle:"Rondleiding opnieuw starten",
    smdRestartObHelp:"Speel de rondleiding opnieuw af vanaf het begin. Handig voor demo's of een opfrisser.",
    smdRestartObBtn:"Rondleiding opnieuw starten",
    helpTitle:"Help", helpSub:"Wat elk instellingenonderdeel doet.",
    builderResultLabel:"Resultaat", regenerateBtn:"Opnieuw genereren", saveToStudioBtn:"Opslaan in Studio"
  },

  es:{
    dashboard:"Inicio", create:"Crear", studio:"Estudio",
    inspiration:"Inspiración", settings:"Ajustes",
    goodMorning:"Buenos días", goodAfternoon:"Buenas tardes",
    goodEvening:"Buenas noches", goodNight:"Buenas noches",
    brandAssistant:"Asistente de Marca", openAIChat:"Empezar a Crear",
    savedAssets:"Archivos Guardados", brandCore:"Núcleo de Marca",
    brandCheck:"Verificación", campaigns:"Campañas",
    workspace:"Espacio de trabajo", plan:"Su plan", appearance:"Apariencia", language:"Idioma",
    notifications:"Notificaciones", exportPref:"Exportar", brandReset:"Restablecer Marca",
    themeLabel:"Tema", lightMode:"Modo claro", darkMode:"Modo oscuro",
    accentLabel:"Color de acento",
    accentHelp:"Elige el color de resaltado para botones, estados activos y elementos de interfaz.",
    noItems:"Sin archivos guardados aún",
    createContent:"Genera contenido en AI Chat y guárdalo aquí.",
    welcomeMsg:"¿Cómo puedo apoyar tu marca hoy?",
    createSub:"Elige un tipo de creación para empezar. Tu Brand Core da forma a cada resultado.",
    imageTitle:"Imagen",      imageDesc:"Crea visuales, carteles y diseños para redes sociales.",
    textTitle:"Texto",        textDesc:"Genera leyendas, titulares y textos de marca.",
    campaignTitle:"Campaña",  campaignDesc:"Crea campañas completas con visuales y textos.",
    videoTitle:"Video",       videoDesc:"Crea ideas de vídeo, guiones y conceptos.",
    webTitle:"Web",           webDesc:"Crea páginas de destino y activos web alineados con tu marca.",
    assistantDesc:"Pide a tu IA de marca orientación, ideas y dirección creativa.",
    comingSoon:"Próximamente",
    brandWorkspace:"Espacio de Marca", signOut:"Cerrar sesión",
    dashHeadlinePrefix:"Tu marca está", dashHeadlineHighlight:"lista.",
    dashTagline:"Convirtámosla en contenido, anuncios y crecimiento.",
    dashCreateLabel:"Crear contenido",   dashCreateDesc:"Imágenes, textos, guiones de video y más.",
    dashIdeasLabel:"Explorar ideas",     dashIdeasDesc:"Ideas de contenido, ángulos de anuncios y conceptos.",
    dashCampaignLabel:"Crear campaña",   dashCampaignDesc:"Campañas multicanal completas de principio a fin.",
    dashBrandLabel:"Editar Brand Core",  dashBrandDesc:"Colores, fuentes, tono de voz e identidad.",
    edit:"Editar", setUp:"Configurar", notConfigured:"No configurado",
    buildBrandIdentity:"Construye tu identidad de marca para empezar.",
    setUpBrandCore:"Configura tu Brand Core →",
    createH1Line1:"¿Qué te gustaría", createH1Line2:"crear hoy?",
    brandStudioTitle:"Brand Studio", brandStudioSub:"Todo lo que define y mueve tu marca.",
    studioSavedLabel:"Guardado",    studioSavedDesc:"Todo tu contenido y archivos generados.",
    studioBCDesc:"Colores, fuentes, tono de voz e identidad.",
    studioCheckLabel:"Verificación", studioCheckDesc:"Analiza contenido para consistencia de marca.",
    studioCampDesc:"Gestiona y lanza tus campañas activas.",
    studioBackBtn:"Atrás",
    noBCConfigured:"Sin Brand Core configurado aún",
    noBCConfiguredSub:"Configura tu identidad de marca para desbloquear la generación de IA.",
    aiGenerateBtn:"Generar con IA", manualSetupBtn:"Configuración manual",
    savedAssetsHeader:"Archivos guardados", openAIChatBtn:"Abrir AI Chat",
    noCampaignsTitle:"Sin campañas aún",
    noCampaignsSub:"Agrupa archivos guardados en conceptos de campaña visual.",
    newCampaignBtn:"+ Nueva campaña",
    dropImageTitle:"Suelta tu imagen aquí", dropImageSub:"PNG, JPG o WEBP — arrastra o haz clic para explorar",
    checkBrandNoImgBtn:"Verificar marca sin imagen", readyForCheck:"Listo para verificación de marca",
    runBrandCheckBtn:"Ejecutar verificación", resetBtn:"Resetear", removeBtn:"Eliminar",
    analyzingBrand:"Analizando consistencia de marca...", checkingDetails:"Verificando colores, tipografía y estilo visual",
    ideasTitle:"Ideas", ideasSub:"Marcos probados para inspirar tu próximo contenido.",
    contentIdeasLabel:"Ideas de Contenido",   contentIdeasDesc:"Posts, historias y formatos que construyen audiencias.",
    adAnglesLabel:"Ángulos de Anuncios",      adAnglesDesc:"Marcos de mensajería que convierten atención en acción.",
    visualStylesLabel:"Estilos Visuales",     visualStylesDesc:"Direcciones estéticas para la identidad visual de tu marca.",
    campaignConceptsLabel:"Conceptos de Campaña", campaignConceptsDesc:"Estructuras completas que generan resultados reales.",
    idContentTitle:"Ideas de Contenido", idAnglesTitle:"Ángulos de Anuncios",
    idVisualTitle:"Estilos Visuales",    idCampaignTitle:"Conceptos de Campaña",
    idContentUseLabel:"Usar esta idea",       idContentGenLabel:"Generar publicación",
    idAnglesUseLabel:"Probar este ángulo",    idAnglesGenLabel:"Generar anuncio",
    idVisualUseLabel:"Usar este estilo",      idVisualGenLabel:"Generar visual",
    idCampaignUseLabel:"Construir esta campaña", idCampaignGenLabel:"Generar recursos",
    idCont0Label:"Posts Educativos",     idCont1Label:"Spotlight del Producto",
    idCont2Label:"Historia del Fundador",idCont3Label:"Historia de Transformación",
    idCont4Label:"Resultado de Cliente", idCont5Label:"Post de Comparación",
    idCont6Label:"Mito vs. Realidad",   idCont7Label:"Antes / Después",
    idCont8Label:"Rutina / Flujo de Trabajo", idCont9Label:"Constructor de Autoridad",
    idAng0Label:"Problema → Solución",  idAng1Label:"Aspiración",
    idAng2Label:"Transformación",        idAng3Label:"Urgencia",
    idAng4Label:"Escasez",               idAng5Label:"Agitación del Punto de Dolor",
    idAng6Label:"Prueba Social",         idAng7Label:"Posicionamiento Premium",
    idAng8Label:"Beneficio Primero",     idAng9Label:"Gancho Emocional",
    idVis0Label:"Lujo Minimal",          idVis1Label:"Moderno Audaz",
    idVis2Label:"Premium Oscuro",        idVis3Label:"Estilo de Vida Suave",
    idVis4Label:"Editorial Limpio",      idVis5Label:"Alto Contraste",
    idVis6Label:"Futurista Elegante",    idVis7Label:"Orgánico Natural",
    idVis8Label:"Deportivo de Rendimiento", idVis9Label:"Elegante Femenino",
    idCamp0Label:"Lanzamiento de Producto", idCamp1Label:"Reconocimiento de Marca",
    idCamp2Label:"Lanzamiento Estacional",  idCamp3Label:"Impulso de Conversión",
    idCamp4Label:"Embudo Educativo",        idCamp5Label:"Secuencia de Retargeting",
    idCamp6Label:"Sprint de Oferta Limitada", idCamp7Label:"Campaña del Fundador",
    idCamp8Label:"Impulsada por Testimonios", idCamp9Label:"Campaña Comunitaria",
    teamTitle:"Equipo", teamSub:"Gestiona el equipo de tu espacio de trabajo Business.",
    settingsTitle:"Ajustes", settingsSub:"Gestiona tu espacio de trabajo y preferencias.",
    spWorkspaceSub:"Gestiona los detalles y preferencias de tu espacio de trabajo de marca.",
    wsNameLabel:"Nombre del espacio de trabajo",
    wsNameHelp:"Este es el nombre de tu espacio de trabajo en ORIVEN. Aparece en tu barra lateral y en toda la app.",
    saveBtn:"Guardar",
    brandLockLabel:"Bloqueo de Marca", lockBCLabel:"Bloquear BrandCore",
    lockBCSub:"Cuando está activado, tu BrandCore permanece fijo y se aplica de forma consistente.",
    spAppearanceSub:"Elige cómo se ve y siente ORIVEN. Tu preferencia se guarda entre sesiones.",
    spLanguageSub:"Establece el idioma de visualización y generación de contenido para tu espacio de trabajo.",
    langDisplayLabel:"Idioma de visualización y generación",
    langDisplayHelp:"ORIVEN usará este idioma para etiquetas de interfaz y al generar contenido con tu BrandCore.",
    spNotificationsSub:"Controla las notificaciones en la app. Los cambios se guardan inmediatamente.",
    notifBrandCheckLabel:"Alertas de verificación de marca",
    notifBrandCheckSub:"Muestra una notificación cuando tu puntuación de marca baje del 70%.",
    notifGenCompleteLabel:"Generación completa",
    notifGenCompleteSub:"Notifícate cuando la IA termine de generar contenido.",
    notifUpdatesLabel:"Actualizaciones del producto",
    notifUpdatesSub:"Recibe anuncios en la app sobre nuevas funciones y mejoras de ORIVEN.",
    spExportTitle:"Preferencias de exportación", spExportSub:"Controla cómo se prepara tu contenido generado para exportar.",
    expFormatLabel:"Formato de exportación predeterminado",
    expFormatHelp:"Elige el formato de archivo predeterminado al descargar recursos generados.",
    autoSaveLabel:"Guardar automáticamente el contenido generado",
    autoSaveSub:"Guarda automáticamente los cambios y el contenido generado en Studio.",
    spDangerSub:"Acciones permanentes — no se pueden deshacer.",
    resetBCTitle:"Resetear Brand Core",
    resetBCDesc:"Esto reinicia toda tu configuración de marca — colores, tono de voz, posicionamiento y datos de identidad. Tus recursos generados guardados en Studio no se verán afectados, pero todas las generaciones futuras perderán el contexto de marca hasta que crees un nuevo BrandCore. Esta acción es permanente y no se puede revertir.",
    resetBCBtn:"Resetear Brand Core",
    navLaunch:"Lanzar", navCampaigns:"Campañas", navIntelligence:"Inteligencia", navAutopilot:"Autopiloto", navBusiness:"Negocio", navSettings:"Ajustes",
    wsTitleIntelligence:"Inteligencia", wsSubIntelligence:"Qué merece tu atención hoy.",
    wsTitleBusiness:"Negocio", wsSubBusiness:"Enseña a Oriven tu negocio una vez — cada campaña, conversación y recomendación lo usará automáticamente a partir de entonces.",
    wsTitleAutopilot:"Autopiloto", wsSubAutopilot:"Automatiza el trabajo publicitario repetitivo. Nada más.",
    wsTitlePerformance:"Rendimiento", wsSubPerformance:"¿Cómo están funcionando tus campañas?",
    wsTitleCampaigns:"Campañas", wsSubCampaigns:"Gestiona tus campañas — borradores, activas y archivadas.",
    hubTabOverview:"Resumen", hubTabLiveCampaigns:"Campañas activas", hubTabDrafts:"Borradores",
    toastTypographyComingSoon:"Editor de tipografía próximamente", toastToneComingSoon:"Editor de tono próximamente",
    toastPositioningComingSoon:"Editor de posicionamiento próximamente", toastSavedDraft:"Guardado como borrador",
    toastEnterCampaignName:"Introduce un nombre de campaña", toastEnterCampaignGoal:"Introduce el objetivo de tu campaña",
    toastDescribeBusiness:"Describe tu negocio o producto", toastSelectCreativeFormat:"Selecciona al menos un formato creativo",
    toastCopied:"¡Copiado!", toastChangesApplied:"Cambios aplicados", toastCopiedClipboard:"Copiado al portapapeles",
    toastAddModuleComingSoon:"Añadir módulo — próximamente", toastRegenerating:"Regenerando…", toastRegenerated:"Regenerado",
    toastRegenerationFailed:"Error al regenerar — inténtalo de nuevo", toastCampaignExported:"Campaña exportada",
    toastCampaignDuplicated:"Campaña duplicada", toastCampaignQueued:"Campaña en cola para publicación",
    toastCampaignNotFound:"Datos de campaña no encontrados", toastNoPlatformSet:"No hay plataforma definida para esta campaña",
    toastCampaignPublishedTo:"Campaña publicada en", toastPublishFailedPrefix:"Error al publicar:",
    toastCampaignPaused:"Campaña pausada", toastCampaignResumed:"Campaña reanudada",
    toastCampaignArchived:"Campaña archivada", toastCampaignDeleted:"Campaña eliminada",
    toastDescribeAdvertise:"Describe lo que te gustaría anunciar", toastDescribeSelling:"Describe lo que vendes",
    toastChooseGoal:"Elige un objetivo", toastSelectPlatform:"Selecciona al menos una plataforma",
    toastComingSoon:"próximamente", toastActiveAccountUpdated:"Cuenta activa actualizada",
    toastFailedSetAccount:"Error al establecer la cuenta — inténtalo de nuevo", toastNetworkError:"Error de red — inténtalo de nuevo",
    toastConnectionFailed:"Error de conexión — inténtalo de nuevo.", toastConnectionFailedShort:"Error de conexión.",
    toastDisconnectFailed:"Error al desconectar — inténtalo de nuevo.", toastEnterWebsiteUrl:"Introduce primero una URL de sitio web.",
    toastWebsiteAnalysed:"Sitio web analizado. Conocimiento del negocio actualizado.",
    toastWebsiteAnalyseFailed:"No se pudo analizar ese sitio web. Verifica la URL e inténtalo de nuevo.",
    toastSelectDestinationAccount:"Selecciona primero una cuenta de destino",
    toastReportNeedsAccount:"La generación de informes requiere una cuenta publicitaria conectada.",
    toastNoReportsYet:"Aún no hay informes para exportar. Genera primero un informe.", toastCampaignGenerated:"Campaña generada",
    toastPublishingToEllipsis:"Publicando en", toastPublishErrorPrefix:"Error de publicación:",
    toastImagePromptCopied:"Prompt de imagen copiado", toastNoPackageYet:"Aún no se ha generado ningún paquete",
    toastPackageCopied:"Paquete de campaña copiado al portapapeles", toastEnterCampaignDesc:"Introduce una descripción de campaña.",
    toastEngineNotLoaded:"Motor de generación no cargado. Actualiza la página.", toastGenerationFailedPrefix:"Error al generar la campaña:",
    toastConnectedSuffix:"¡conectado!", toastDisconnectedSuffix:"desconectado.",
    toastConnectingEllipsis:"Conectando…", btnConnectPlatformSuffix:"Ads →", btnConnectingPlatform:"Conectando…",
    confirmDisconnectPlatform:"¿Desconectar {platform}? Las analíticas en vivo se detendrán, pero tus datos de campaña se conservarán.",
    toastSavedBizKnowledge:"Guardado correctamente. Conocimiento del negocio actualizado.", toastCouldNotSave:"No se pudo guardar. Inténtalo de nuevo.",
    toastSignedOut:"Sesión cerrada", toastProfileLoadFailed:"Error al cargar el perfil — actualiza la página.",
    toastPleaseSignIn:"Inicia sesión primero", toastVerificationSent:"Correo de verificación enviado — revisa tu bandeja de entrada",
    toastCouldNotSendPrefix:"No se pudo enviar —", toastEmailVerified:"Correo verificado — tu cuenta está confirmada!",
    toastVerificationInvalid:"El enlace de verificación no es válido o ya se usó. Solicita uno nuevo.",
    toastBrandCoreSavedCloud:"Brand Core guardado en la nube", toastCheckoutFailed:"No se pudo iniciar el pago — inténtalo de nuevo",
    toastCheckoutCanceled:"Pago cancelado — puedes mejorar tu plan cuando quieras.",
    toastSubscriptionActive:"Tu suscripción ya está activa — ¡bienvenido a ORIVEN!",
    toastPaymentReceived:"Pago recibido — activando tu cuenta...",
    toastSubscriptionPending:"Suscripción pendiente — actualiza en un momento.",
    toastPlatformConnectedSuccess:"¡conectado correctamente!",
    launchH1:"Lanza tu próxima campaña.", genModeImage:"Imagen", genModeVideo:"Video",
    attachImageBtn:"Adjuntar imagen", launchPromptPlaceholder:"¿Qué te gustaría anunciar hoy? p. ej. Una marca de ropa deportiva dirigida a hombres jóvenes en Ámsterdam. Presupuesto de 30€/día.",
    currentlyWorkingWith:"Trabajando actualmente con", setUpBusinessCta:"Configura tu negocio para personalizar cada campaña →",
    addMoreImages:"Añadir más", generatingEllipsis:"Generando…",
    intelMonitorBtn:"Campañas monitoreadas", intelBriefingHeading:"Informe ejecutivo", intelPriorityHeading:"Máxima prioridad",
    intelWatchlistHeading:"Lista de seguimiento", intelMonitorPanelTitle:"Campañas monitoreadas",
    intelMonitorPanelDesc:"Intelligence solo analiza las campañas que elijas monitorear aquí — nunca toda tu cuenta automáticamente.",
    intelMonitorNoCampaigns:"Conecta Google o Meta Ads para ver tus campañas aquí.",
    intelBriefLoadingText:"Revisando tus campañas monitoreadas…", intelLoadErrorText:"No se pudo cargar Intelligence en este momento.",
    intelConnectPromptPrefix:"Conecta una cuenta de Google o Meta para desbloquear esto —", intelConnectPromptLink:"ir a Integraciones",
    intelWatchlistEmpty:"No se detectaron cambios inusuales.", intelNoMonitoredPrefix:"Aún no hay campañas monitoreadas.",
    intelNoMonitoredLink:"Selecciona una o más campañas", intelNoMonitoredSuffix:"para recibir informes diarios de IA.",
    intelBriefEmpty:"No se detectaron cambios significativos hoy. Todo funciona dentro de los rangos esperados.",
    intelCardLabelReason:"Motivo", intelCardLabelWhy:"Por qué", intelCardLabelExpectedImpact:"Impacto esperado",
    intelCardLabelExpectedOutcome:"Resultado esperado", intelCardLabelRecommendedAction:"Acción recomendada",
    intelCardTitleFallback:"Observación", intelConfidenceSuffix:"confianza",
    notifCatAutomation:"Automatización", notifCatOpportunity:"Oportunidad", notifCatCompleted:"Completado",
    notifCatLearning:"Aprendizaje", notifCatCritical:"Crítico", notifCatWarning:"Advertencia",
    notifEmptyText:"No hay notificaciones urgentes.", notifCatApproval:"Aprobación", notifDismissBtn:"Descartar",
    apSectionBuilder:"Creador de automatizaciones", apSectionActive:"Automatizaciones activas", apSectionSuggested:"Sugerido por Oriven",
    apSectionHistory:"Historial de automatizaciones", apSectionSettings:"Configuración de automatización",
    apStepQPlatform:"¿Qué debo monitorear?", apRecapLblPlatform:"Monitoreo",
    apStepQCampaign:"¿Qué campaña?", apRecapLblCampaign:"Campaña",
    apStepQCondition:"¿Cuándo debo reaccionar?", apRecapLblCondition:"Condición",
    apStepQAction:"¿Qué debe ocurrir?", apRecapLblAction:"Acción",
    apStepReview:"Revisar", apModeQuestion:"¿Cómo debo gestionarlo?", apRecapEdit:"Cambiar",
    statusActive:"Activo", statusPaused:"Pausado", apNamePlaceholder:"Nombra esta automatización (opcional)",
    apHistorySearchPlaceholder:"Buscar en el historial…", apContinueBtn:"Continuar", apTestBtn:"Probar",
    apCreateAutomationBtn:"Crear automatización", apSaveChangesBtn:"Guardar cambios", apStartOverBtn:"Empezar de nuevo", apByLabel:"en",
    apSetDefaultModeLabel:"Modo predeterminado para reglas nuevas", apModeRequireApproval:"Requerir aprobación",
    apModeSuggestOnly:"Solo sugerir", apModeFullyAutomatic:"Totalmente automático",
    apNotifyEnabled:"Activado", apNotifyDisabled:"Desactivado", apBriefTimeLabel:"Hora del informe diario",
    apMetricRoas:"ROAS", apMetricCtr:"CTR", apMetricCpc:"CPC", apMetricCpa:"CPA", apMetricConversions:"Conversiones",
    apMetricSpend:"Gasto", apMetricClicks:"Clics", apMetricImpressions:"Impresiones", apMetricBudget:"Presupuesto", apMetricStatus:"Estado de la campaña",
    apOpGreaterThan:"es mayor que", apOpLessThan:"es menor que", apOpEquals:"es igual a", apOpAtLeast:"es al menos", apOpAtMost:"es como máximo",
    apActionIncreaseBudget:"Aumentar presupuesto", apActionDecreaseBudget:"Reducir presupuesto", apActionPause:"Pausar campaña",
    apActionResume:"Reanudar campaña", apActionGenCreative:"Generar nuevo creativo", apActionGenRecs:"Generar recomendaciones de IA",
    apActionNotify:"Notificarme", apActionRequestApproval:"Solicitar aprobación", apActionCreateReport:"Generar informe",
    apActionCreateBriefing:"Crear informe", apActionRunOptimisation:"Ejecutar optimización de IA",
    apModeAskFirst:"Preguntarme primero", apModeAskFirstDesc:"Apruebas cada vez",
    apModeSuggestIt:"Solo sugerirlo", apModeSuggestItDesc:"No se toma ninguna acción automáticamente",
    apModeHandleAuto:"Gestionarlo automáticamente", apModeHandleAutoDesc:"No requiere aprobación",
    apAllCampaigns:"Todas las campañas", apAllCampaignsDesc:"Cada campaña en esta plataforma", apJustThisCampaignDesc:"Solo esta campaña", apUnnamedCampaign:"Sin nombre",
    apErrNumeric:"Introduce un valor numérico (p. ej. 4.0), no texto.", apErrPercent:"Introduce un porcentaje entre 1 y 100.",
    apErrIncomplete:"Termina de elegir una condición y una acción primero.", apErrChooseStatus:"Elige Activo o Pausado.",
    apErrSaveFirst:"Guarda la automatización primero y luego pruébala.", apErrTestFailed:"No se pudo probar esta regla en este momento.",
    apErrSaveFailed:"No se pudo guardar esa automatización.", apErrLoadActiveFailed:"No se pudieron cargar tus automatizaciones.",
    apErrLoadHistoryFailed:"No se pudo cargar el historial.",
    apEmptyActiveText:"Aún no has creado ninguna automatización. Automaticemos juntos el trabajo repetitivo.",
    apEmptyHistoryText:"Aún no hay actividad de automatización.",
    apExampleBudgetRoas:"Aumentar presupuesto cuando el ROAS supere 4", apExamplePauseNoConv:"Pausar campañas sin conversiones",
    apExampleDailyBriefing:"Generar un informe diario", apExampleNotifyCtr:"Notificarme cuando baje el CTR",
    apNeverRun:"Nunca", apStatusRunning:"En ejecución", apLastExecutedPrefix:"Última ejecución:",
    apDisableBtn:"Desactivar", apEnableBtn:"Activar", apDeleteBtn:"Eliminar",
    apAwaitingYourApproval:"Esperando tu aprobación", dateToday:"Hoy", dateYesterday:"Ayer", dateDaysAgoSuffix:"días", apDateEarlier:"Antes",
    apAwaitingApproval:"Esperando aprobación", apApproveBtn:"Aprobar", apRejectBtn:"Rechazar",
    apSuggestSetupBtn:"Configurar",
    apReviewIllMonitor:"Monitorearé", apReviewAllCampaignsOf:"todas tus", apReviewCampaignsPlural:"campañas",
    apReviewWhenever:"Cuando", apReviewIs:"esté", apReviewIllComma:", yo",
    apReviewModeFullyAuto:" Haré esto automáticamente — se te notificará después.",
    apReviewModeSuggest:" Solo lo marcaré como sugerencia, sin tomar ninguna acción.",
    apReviewModeApproval:" Primero te pediré tu aprobación.",
    apErrBudgetUnsupported:"Los cambios de presupuesto no están disponibles en", apYetSuffix:"todavía",
    apTestingAgainstData:"Probando con los datos reales de tu campaña…", apWouldTriggerNow:"Se activaría ahora mismo",
    apCheckedCampaignsPrefix:"Se revisaron", apCampaignSingular:"campaña", apCampaignPlural:"campañas",
    apNoneMatchCondition:"ninguna cumple actualmente esta condición.",
    apRuleSentenceWhen:"Cuando", apRuleSentenceOrivenWill:", Oriven va a",
    bizTabOverview:"Resumen", bizTabBusiness:"Negocio", bizTabProducts:"Productos", bizTabMarket:"Mercado",
    bizTabBrand:"Marca", bizTabConnections:"Conexiones", bizTabMemory:"Memoria",
    bizLearningLabel:"Aprendizaje", bizGetReflectionBtn:"Obtener un análisis", bizInsightsLabel:"Información del negocio",
    bizKnowledgeCheckLabel:"Verificación de conocimiento", bizRunCheckBtn:"Ejecutar verificación",
    bizProductsHeading:"Productos", bizAddProductBtn:"+ Añadir un producto",
    bizAudienceHeading:"Audiencia", bizAddAudienceBtn:"+ Añadir una audiencia",
    bizCompetitorsHeading:"Competidores", bizAddCompetitorBtn:"+ Añadir un competidor",
    bizProfileCardTitle:"Perfil del negocio", bizProfileCardSub:"Lo básico — quién eres, qué haces y hacia dónde te diriges.",
    bizWebsiteCardTitle:"Sitio web", bizWebsiteCardSub:"Lo que Oriven ha aprendido al leer tu sitio.",
    bizFieldWebsiteUrl:"URL del sitio web", bizAnalyseWebsiteBtn:"Analizar mi sitio web", bizRefreshAnalysisBtn:"Actualizar análisis",
    bizVoiceCardTitle:"Voz de marca", bizVoiceCardSub:"Elige los rasgos que describen cómo suena tu marca. Oriven los usa en cada titular y guion que escribe.",
    bizConnectionsIntro:"Tus plataformas publicitarias. Conecta una cuenta y Oriven podrá leer y gestionar campañas en ella directamente.",
    bizMemoryIntro:"Todo lo que Oriven ha aprendido en el camino — de conversaciones y de lo que ha funcionado. Esta es la memoria a largo plazo de Oriven sobre tu negocio.",
    bizEmptyMemory:"Nada recordado todavía — se va acumulando a medida que usas Oriven.", bizMemoryDeleteBtn:"Eliminar",
    bizVcardEditBtn:"Editar", bizVcardDeleteBtn:"Eliminar", bizVcardSaveBtn:"Guardar", bizVcardCloseBtn:"Cerrar",
    bizVcardEmptyDetails:"Aún no hay detalles — haz clic en Editar para completarlo.",
    conNotConnected:"No conectado", conStatusConnected:"Conectado", conCheckingStatus:"Comprobando…",
    conDisconnectBtn:"Desconectar", conAdAccountsHeader:"Cuentas publicitarias", conActiveBadge:"Activa", conSetActiveBtn:"Establecer como activa",
    conConnectGoogleBtn:"Conectar Google Ads →", conConnectMetaBtn:"Conectar Meta Ads →", conConnectTiktokBtn:"Conectar TikTok Ads →",
    conDetailConnectedAccounts:"Cuentas conectadas", conDetailConnectedBusinesses:"Empresas conectadas",
    bizReadingWebsiteBtn:"Leyendo tu sitio web…",
    rangeToday:"Hoy", rangeYesterday:"Ayer", rangeLast7Days:"Últimos 7 días", rangeLast30Days:"Últimos 30 días",
    rangeLast90Days:"Últimos 90 días", rangeThisMonth:"Este mes", rangeLastMonth:"El mes pasado",
    rangeLast12Months:"Últimos 12 meses", rangeLifetime:"Todo el periodo", rangeCustom:"Rango personalizado…",
    tiktokAnalyticsTitle:"Analíticas de TikTok", tiktokAnalyticsComingSub:"Las analíticas estarán disponibles una vez que conectes tu cuenta de TikTok Ads.",
    connectBannerTitle:"Conecta tus cuentas publicitarias para desbloquear analíticas en vivo",
    connectBannerSub:"Vincula Google Ads, Meta Ads o TikTok Ads para rastrear el gasto, el ROAS y las conversiones en tiempo real.",
    connectAccountsBtn:"Conectar cuentas →",
    kpiTotalSpend:"Gasto total", kpiImpressions:"Impresiones", kpiClicks:"Clics", kpiConversions:"Conversiones", kpiRoas:"ROAS",
    kpiChgPlaceholder:"— vs. periodo anterior",
    chartSpendOverTime:"Gasto en el tiempo", chartLockConnectLive:"Conecta una cuenta para ver datos en vivo", chartLockConnectUnlock:"Conecta para desbloquear",
    chartRoasOverTime:"ROAS en el tiempo", chartCtrOverTime:"CTR en el tiempo",
    orivenScoreTitle:"Puntuación Oriven", orivenScoreSub:"Salud de la cuenta impulsada por IA · 0–100",
    aiAnalysisTitle:"Análisis de IA", aiAnalysisDefaultSummary:"Analiza esta cuenta en busca de gasto desperdiciado, CTR bajo, problemas de conversión y oportunidades de escalado.",
    analyzeWithAiBtn:"Analizar con IA", aiSectionStrengths:"Fortalezas", aiSectionWeaknesses:"Debilidades",
    aiSectionRecommendations:"Recomendaciones", aiSectionExpectedImpact:"Impacto esperado", generateAdCopyBtn:"Generar texto publicitario →",
    analyzingEllipsis:"Analizando…", analysisFailed:"Error en el análisis", analysisFailedRetry:"Error en el análisis — inténtalo de nuevo", reanalyzeBtn:"Volver a analizar",
    searchCampaignsPlaceholder:"Buscar campañas…", newCampaignBtnPlain:"Nueva campaña", noCampaignsYetDot:"Aún no hay campañas.",
    noCampaignsYetSub:"Genera tu primera campaña desde Crear. Describe tu producto y Oriven creará una campaña completa al instante.",
    createCampaignArrowBtn:"Crear campaña →", noCampaignsMatchSearch:"Ninguna campaña coincide con tu búsqueda.",
    continueWorkingHeader:"Continuar trabajando",
    tiktokComingSoonSub:"La integración con TikTok llegará pronto. Una vez que tu app de TikTok esté aprobada y conectada, tus campañas aparecerán aquí.",
    smdHdTitle:"Ajustes", smdNavGeneral:"General", smdNavSubscription:"Suscripción", smdNavNotifications:"Notificaciones",
    smdNavAccount:"Cuenta", smdNavSecurity:"Seguridad",
    smdWsNameLabel:"Nombre del espacio de trabajo", smdWsNameHelp:"Aparece en la barra lateral y en toda la aplicación.",
    smdThemeLabel:"Tema", smdThemeLight:"Claro", smdThemeDark:"Oscuro", smdThemeSystem:"Sistema", smdAccentLabel:"Color de acento",
    smdLangLabel:"Idioma de visualización y generación", smdLangHelp:"Se aplica a las etiquetas de la interfaz y al contenido generado por IA.",
    smdLoadingEllipsis:"Cargando…",
    smdNotifGenTitle:"Generación completa", smdNotifGenSub:"Avisarme cuando la IA termine de generar contenido.",
    smdNotifPubTitle:"Publicación completa", smdNotifPubSub:"Avisarme cuando el contenido haya sido publicado.",
    smdNotifBillTitle:"Actualizaciones de facturación", smdNotifBillSub:"Alertas de renovaciones y actividad de pago.",
    smdNotifUpdTitle:"Actualizaciones de producto", smdNotifUpdSub:"Anuncios in-app sobre nuevas funciones.",
    smdNotifApTitle:"Aprobaciones de Autopilot", smdNotifApSub:"Avisarme cuando una recomendación o regla de automatización necesite tu aprobación.",
    smdSignedInWith:"Conectado con", smdEmailLabel:"Dirección de correo electrónico", smdEmailHelp:"Se usa para iniciar sesión y recibir notificaciones de cuenta.",
    smdChangePwTitle:"Cambiar contraseña", smdChangePwHelp:"Introduce tu contraseña actual y luego elige una nueva.",
    smdCurrentPwPlaceholder:"Contraseña actual", smdNewPwPlaceholder:"Nueva contraseña (mín. 8 caracteres)", smdConfirmPwPlaceholder:"Confirmar nueva contraseña",
    smdUpdatePwBtn:"Actualizar contraseña", smdForgotPwTitle:"¿Olvidaste tu contraseña?",
    smdForgotPwHelp:"Envíate un enlace de restablecimiento por correo en su lugar.", smdSendResetBtn:"Enviar correo de restablecimiento",
    smdDangerZoneTitle:"Zona de peligro", smdSignOutTitle:"Cerrar sesión", smdSignOutSub:"Cerrar sesión de ORIVEN en este dispositivo.", smdSignOutBtn:"Cerrar sesión",
    smdDeleteAcctTitle:"Eliminar cuenta", smdDeleteAcctSub:"Elimina permanentemente tu cuenta y todos tus datos. Esta acción no se puede deshacer.", smdDeleteAcctBtn:"Eliminar cuenta",
    smdHelpGeneralHelp:"El nombre de tu espacio de trabajo, tema (claro/oscuro/sistema), color de acento e idioma de la interfaz. El color de acento se aplica en toda la aplicación — estados hover, pestañas activas, botones y anillos de foco. Los cambios se guardan automáticamente y se aplican de inmediato.",
    smdHelpSubHelp:"Tu plan actual, uso y gestión de facturación. Mejora, reduce o gestiona los datos de pago desde aquí.",
    smdHelpNotifHelp:"Controla qué eventos generan una alerta — generación completa, publicación, facturación, actualizaciones de producto y aprobaciones de Autopilot. Desactivar una categoría impide que se creen esas notificaciones, no solo las oculta.",
    smdHelpAcctHelp:"Tu método de inicio de sesión y dirección de correo. Los cambios de correo requieren confirmar la nueva dirección antes de que surtan efecto.",
    smdHelpSecHelp:"Cambia tu contraseña directamente (se requiere la contraseña actual), o envíate un enlace de restablecimiento por correo.",
    smdHelpBizHelp:"Gestiona los datos de tu negocio, voz de marca, audiencias y cuentas publicitarias conectadas desde el espacio Business — independiente de los Ajustes personales, ya que puede compartirse con compañeros de equipo.",
    smdHelpApHelp:"Reglas de automatización que actúan sobre tus campañas sin intervención manual. Las recomendaciones que necesitan tu aprobación aparecen como notificaciones de aprobación de Autopilot, controladas en la pestaña Notificaciones.",
    smdRestartObTitle:"Reiniciar la incorporación",
    smdRestartObHelp:"Vuelve a ver la visita guiada desde el principio. Útil para demostraciones o como recordatorio.",
    smdRestartObBtn:"Reiniciar la incorporación",
    helpTitle:"Ayuda", helpSub:"Qué hace cada sección de Ajustes.",
    builderResultLabel:"Resultado", regenerateBtn:"Regenerar", saveToStudioBtn:"Guardar en Studio"
  },

  pt:{
    dashboard:"Painel", create:"Criar", studio:"Estúdio",
    inspiration:"Inspiração", settings:"Configurações",
    goodMorning:"Bom dia", goodAfternoon:"Boa tarde",
    goodEvening:"Boa noite", goodNight:"Boa noite",
    brandAssistant:"Assistente de Marca", openAIChat:"Começar a Criar",
    savedAssets:"Arquivos Salvos", brandCore:"Núcleo da Marca",
    brandCheck:"Verificação", campaigns:"Campanhas",
    workspace:"Espaço de trabalho", plan:"Seu plano", appearance:"Aparência", language:"Idioma",
    notifications:"Notificações", exportPref:"Exportar", brandReset:"Redefinir Marca",
    themeLabel:"Tema", lightMode:"Modo claro", darkMode:"Modo escuro",
    accentLabel:"Cor de destaque",
    accentHelp:"Escolha a cor de realce usada em botões, estados ativos e elementos de interface.",
    noItems:"Nenhum arquivo salvo ainda",
    createContent:"Gere conteúdo no AI Chat e salve aqui.",
    welcomeMsg:"Como posso apoiar sua marca hoje?",
    createSub:"Escolha um tipo de criação para começar. Seu Brand Core molda cada resultado.",
    imageTitle:"Imagem",      imageDesc:"Crie visuais, pôsteres e designs para redes sociais.",
    textTitle:"Texto",        textDesc:"Gere legendas, manchetes e textos de marca.",
    campaignTitle:"Campanha", campaignDesc:"Crie campanhas completas com visuais e textos.",
    videoTitle:"Vídeo",       videoDesc:"Crie ideias de vídeo, roteiros e conceitos.",
    webTitle:"Web",           webDesc:"Crie landing pages e ativos web alinhados à marca.",
    assistantDesc:"Peça à sua IA de marca orientação, ideias e direção criativa.",
    comingSoon:"Em breve",
    brandWorkspace:"Espaço de Marca", signOut:"Sair",
    dashHeadlinePrefix:"Sua marca está", dashHeadlineHighlight:"pronta.",
    dashTagline:"Vamos transformá-la em conteúdo, anúncios e crescimento.",
    dashCreateLabel:"Criar conteúdo",   dashCreateDesc:"Imagens, textos, roteiros de vídeo e mais.",
    dashIdeasLabel:"Explorar ideias",   dashIdeasDesc:"Ideias de conteúdo, ângulos de anúncios e conceitos.",
    dashCampaignLabel:"Criar campanha", dashCampaignDesc:"Campanhas multicanal completas do início ao fim.",
    dashBrandLabel:"Editar Brand Core", dashBrandDesc:"Cores, fontes, tom de voz e identidade.",
    edit:"Editar", setUp:"Configurar", notConfigured:"Não configurado",
    buildBrandIdentity:"Construa sua identidade de marca para começar.",
    setUpBrandCore:"Configure seu Brand Core →",
    createH1Line1:"O que você gostaria de", createH1Line2:"criar hoje?",
    brandStudioTitle:"Brand Studio", brandStudioSub:"Tudo que define e impulsiona sua marca.",
    studioSavedLabel:"Salvo",       studioSavedDesc:"Todo seu conteúdo e arquivos gerados.",
    studioBCDesc:"Cores, fontes, tom de voz e identidade.",
    studioCheckLabel:"Verificação", studioCheckDesc:"Analise conteúdo para consistência de marca.",
    studioCampDesc:"Gerencie e lance suas campanhas ativas.",
    studioBackBtn:"Voltar",
    noBCConfigured:"Sem Brand Core configurado ainda",
    noBCConfiguredSub:"Configure sua identidade de marca para desbloquear a geração de IA.",
    aiGenerateBtn:"Gerar com IA", manualSetupBtn:"Configuração manual",
    savedAssetsHeader:"Arquivos salvos", openAIChatBtn:"Abrir AI Chat",
    noCampaignsTitle:"Sem campanhas ainda",
    noCampaignsSub:"Agrupe arquivos salvos em conceitos de campanha visual.",
    newCampaignBtn:"+ Nova campanha",
    dropImageTitle:"Solte sua imagem aqui", dropImageSub:"PNG, JPG ou WEBP — arraste ou clique para navegar",
    checkBrandNoImgBtn:"Verificar marca sem imagem", readyForCheck:"Pronto para verificação de marca",
    runBrandCheckBtn:"Executar verificação", resetBtn:"Resetar", removeBtn:"Remover",
    analyzingBrand:"Analisando consistência de marca...", checkingDetails:"Verificando cores, tipografia e estilo visual",
    ideasTitle:"Ideias", ideasSub:"Estruturas comprovadas para inspirar seu próximo conteúdo.",
    contentIdeasLabel:"Ideias de Conteúdo",    contentIdeasDesc:"Posts, histórias e formatos que constroem audiências.",
    adAnglesLabel:"Ângulos de Anúncios",       adAnglesDesc:"Estruturas de mensagem que convertem atenção em ação.",
    visualStylesLabel:"Estilos Visuais",       visualStylesDesc:"Direções estéticas para a identidade visual da sua marca.",
    campaignConceptsLabel:"Conceitos de Campanha", campaignConceptsDesc:"Estruturas completas que geram resultados reais.",
    idContentTitle:"Ideias de Conteúdo", idAnglesTitle:"Ângulos de Anúncios",
    idVisualTitle:"Estilos Visuais",     idCampaignTitle:"Conceitos de Campanha",
    idContentUseLabel:"Usar esta ideia",       idContentGenLabel:"Gerar publicação",
    idAnglesUseLabel:"Testar este ângulo",     idAnglesGenLabel:"Gerar anúncio",
    idVisualUseLabel:"Usar este estilo",       idVisualGenLabel:"Gerar visual",
    idCampaignUseLabel:"Construir esta campanha", idCampaignGenLabel:"Gerar recursos",
    idCont0Label:"Posts Educativos",     idCont1Label:"Destaque do Produto",
    idCont2Label:"História do Fundador", idCont3Label:"História de Transformação",
    idCont4Label:"Resultado do Cliente", idCont5Label:"Post de Comparação",
    idCont6Label:"Mito vs. Verdade",     idCont7Label:"Antes / Depois",
    idCont8Label:"Rotina / Fluxo de Trabalho", idCont9Label:"Construtor de Autoridade",
    idAng0Label:"Problema → Solução",   idAng1Label:"Aspiração",
    idAng2Label:"Transformação",         idAng3Label:"Urgência",
    idAng4Label:"Escassez",              idAng5Label:"Agitação do Ponto de Dor",
    idAng6Label:"Prova Social",          idAng7Label:"Posicionamento Premium",
    idAng8Label:"Benefício Primeiro",    idAng9Label:"Gancho Emocional",
    idVis0Label:"Luxo Minimal",          idVis1Label:"Moderno Audacioso",
    idVis2Label:"Premium Escuro",        idVis3Label:"Estilo de Vida Suave",
    idVis4Label:"Editorial Limpo",       idVis5Label:"Alto Contraste",
    idVis6Label:"Futurista Elegante",    idVis7Label:"Orgânico Natural",
    idVis8Label:"Esportivo de Desempenho", idVis9Label:"Elegante Feminino",
    idCamp0Label:"Lançamento de Produto", idCamp1Label:"Reconhecimento de Marca",
    idCamp2Label:"Lançamento Sazonal",    idCamp3Label:"Impulso de Conversão",
    idCamp4Label:"Funil Educativo",       idCamp5Label:"Sequência de Retargeting",
    idCamp6Label:"Sprint de Oferta Limitada", idCamp7Label:"Campanha do Fundador",
    idCamp8Label:"Impulsada por Depoimentos", idCamp9Label:"Campanha Comunitária",
    teamTitle:"Equipe", teamSub:"Gerencie a equipe do seu espaço de trabalho Business.",
    settingsTitle:"Configurações", settingsSub:"Gerencie seu espaço de trabalho e preferências.",
    spWorkspaceSub:"Gerencie os detalhes e preferências do seu espaço de trabalho de marca.",
    wsNameLabel:"Nome do espaço de trabalho",
    wsNameHelp:"Este é o nome do seu espaço de trabalho no ORIVEN. Aparece na barra lateral e em toda a app.",
    saveBtn:"Salvar",
    brandLockLabel:"Bloqueio de Marca", lockBCLabel:"Bloquear BrandCore",
    lockBCSub:"Quando ativado, seu BrandCore permanece fixo e é aplicado de forma consistente.",
    spAppearanceSub:"Escolha como o ORIVEN parece e se sente. Sua preferência é salva entre sessões.",
    spLanguageSub:"Defina o idioma de exibição e geração de conteúdo para seu espaço de trabalho.",
    langDisplayLabel:"Idioma de exibição e geração",
    langDisplayHelp:"O ORIVEN usará este idioma para rótulos de interface e ao gerar conteúdo com seu BrandCore.",
    spNotificationsSub:"Controle notificações no app. As alterações são salvas imediatamente.",
    notifBrandCheckLabel:"Alertas de verificação de marca",
    notifBrandCheckSub:"Mostra uma notificação quando sua pontuação de marca cair abaixo de 70%.",
    notifGenCompleteLabel:"Geração completa",
    notifGenCompleteSub:"Notifique-se quando a IA terminar de gerar conteúdo.",
    notifUpdatesLabel:"Atualizações do produto",
    notifUpdatesSub:"Receba anúncios no app sobre novos recursos e melhorias do ORIVEN.",
    spExportTitle:"Preferências de exportação", spExportSub:"Controle como seu conteúdo gerado é preparado para exportação.",
    expFormatLabel:"Formato de exportação padrão",
    expFormatHelp:"Escolha o formato de arquivo padrão ao baixar recursos gerados.",
    autoSaveLabel:"Salvar automaticamente o conteúdo gerado",
    autoSaveSub:"Salve automaticamente as alterações e o conteúdo gerado no Studio.",
    spDangerSub:"Ações permanentes — não podem ser desfeitas.",
    resetBCTitle:"Redefinir Brand Core",
    resetBCDesc:"Isso redefine toda a configuração da sua marca — cores, tom de voz, posicionamento e dados de identidade. Os recursos gerados salvos no Studio não serão afetados, mas todas as gerações futuras perderão o contexto de marca até você criar um novo BrandCore. Essa ação é permanente e não pode ser desfeita.",
    resetBCBtn:"Redefinir Brand Core",
    navLaunch:"Lançar", navCampaigns:"Campanhas", navIntelligence:"Inteligência", navAutopilot:"Piloto Automático", navBusiness:"Negócio", navSettings:"Configurações",
    wsTitleIntelligence:"Inteligência", wsSubIntelligence:"O que merece sua atenção hoje.",
    wsTitleBusiness:"Negócio", wsSubBusiness:"Ensine ao Oriven sobre o seu negócio uma vez — cada campanha, conversa e recomendação o usará automaticamente a partir de então.",
    wsTitleAutopilot:"Piloto Automático", wsSubAutopilot:"Automatiza o trabalho publicitário repetitivo. Nada mais.",
    wsTitlePerformance:"Desempenho", wsSubPerformance:"Como estão suas campanhas?",
    wsTitleCampaigns:"Campanhas", wsSubCampaigns:"Gerencie suas campanhas — rascunhos, ativas e arquivadas.",
    hubTabOverview:"Visão geral", hubTabLiveCampaigns:"Campanhas ativas", hubTabDrafts:"Rascunhos",
    toastTypographyComingSoon:"Editor de tipografia em breve", toastToneComingSoon:"Editor de tom em breve",
    toastPositioningComingSoon:"Editor de posicionamento em breve", toastSavedDraft:"Salvo como rascunho",
    toastEnterCampaignName:"Insira um nome de campanha", toastEnterCampaignGoal:"Insira o objetivo da sua campanha",
    toastDescribeBusiness:"Descreva seu negócio ou produto", toastSelectCreativeFormat:"Selecione pelo menos um formato criativo",
    toastCopied:"Copiado!", toastChangesApplied:"Alterações aplicadas", toastCopiedClipboard:"Copiado para a área de transferência",
    toastAddModuleComingSoon:"Adicionar módulo — em breve", toastRegenerating:"Regenerando…", toastRegenerated:"Regenerado",
    toastRegenerationFailed:"Falha ao regenerar — tente novamente", toastCampaignExported:"Campanha exportada",
    toastCampaignDuplicated:"Campanha duplicada", toastCampaignQueued:"Campanha na fila para publicação",
    toastCampaignNotFound:"Dados da campanha não encontrados", toastNoPlatformSet:"Nenhuma plataforma definida para esta campanha",
    toastCampaignPublishedTo:"Campanha publicada em", toastPublishFailedPrefix:"Falha ao publicar:",
    toastCampaignPaused:"Campanha pausada", toastCampaignResumed:"Campanha retomada",
    toastCampaignArchived:"Campanha arquivada", toastCampaignDeleted:"Campanha excluída",
    toastDescribeAdvertise:"Descreva o que você gostaria de anunciar", toastDescribeSelling:"Descreva o que você está vendendo",
    toastChooseGoal:"Escolha um objetivo", toastSelectPlatform:"Selecione pelo menos uma plataforma",
    toastComingSoon:"em breve", toastActiveAccountUpdated:"Conta ativa atualizada",
    toastFailedSetAccount:"Falha ao definir a conta — tente novamente", toastNetworkError:"Erro de rede — tente novamente",
    toastConnectionFailed:"Falha na conexão — tente novamente.", toastConnectionFailedShort:"Falha na conexão.",
    toastDisconnectFailed:"Falha ao desconectar — tente novamente.", toastEnterWebsiteUrl:"Insira primeiro uma URL de site.",
    toastWebsiteAnalysed:"Site analisado. Conhecimento do negócio atualizado.",
    toastWebsiteAnalyseFailed:"Não foi possível analisar esse site. Verifique a URL e tente novamente.",
    toastSelectDestinationAccount:"Selecione primeiro uma conta de destino",
    toastReportNeedsAccount:"A geração de relatórios requer uma conta de anúncios conectada.",
    toastNoReportsYet:"Ainda não há relatórios para exportar. Gere um relatório primeiro.", toastCampaignGenerated:"Campanha gerada",
    toastPublishingToEllipsis:"Publicando em", toastPublishErrorPrefix:"Erro de publicação:",
    toastImagePromptCopied:"Prompt de imagem copiado", toastNoPackageYet:"Ainda nenhum pacote gerado",
    toastPackageCopied:"Pacote de campanha copiado para a área de transferência", toastEnterCampaignDesc:"Insira uma descrição de campanha.",
    toastEngineNotLoaded:"Motor de geração não carregado. Atualize a página.", toastGenerationFailedPrefix:"Falha ao gerar a campanha:",
    toastConnectedSuffix:"conectado!", toastDisconnectedSuffix:"desconectado.",
    toastConnectingEllipsis:"Conectando…", btnConnectPlatformSuffix:"Ads →", btnConnectingPlatform:"Conectando…",
    confirmDisconnectPlatform:"Desconectar {platform}? As análises em tempo real serão interrompidas, mas os dados da campanha serão mantidos.",
    toastSavedBizKnowledge:"Salvo com sucesso. Conhecimento do negócio atualizado.", toastCouldNotSave:"Não foi possível salvar. Tente novamente.",
    toastSignedOut:"Sessão encerrada", toastProfileLoadFailed:"Falha ao carregar o perfil — atualize a página.",
    toastPleaseSignIn:"Faça login primeiro", toastVerificationSent:"E-mail de verificação enviado — verifique sua caixa de entrada",
    toastCouldNotSendPrefix:"Não foi possível enviar —", toastEmailVerified:"E-mail verificado — sua conta está confirmada!",
    toastVerificationInvalid:"O link de verificação é inválido ou já foi usado. Solicite um novo.",
    toastBrandCoreSavedCloud:"Brand Core salvo na nuvem", toastCheckoutFailed:"Não foi possível iniciar o checkout — tente novamente",
    toastCheckoutCanceled:"Checkout cancelado — você pode fazer upgrade quando quiser.",
    toastSubscriptionActive:"Sua assinatura está ativa agora — bem-vindo à ORIVEN!",
    toastPaymentReceived:"Pagamento recebido — ativando sua conta...",
    toastSubscriptionPending:"Assinatura pendente — atualize em instantes.",
    toastPlatformConnectedSuccess:"conectado com sucesso!",
    launchH1:"Lance sua próxima campanha.", genModeImage:"Imagem", genModeVideo:"Vídeo",
    attachImageBtn:"Anexar imagem", launchPromptPlaceholder:"O que você gostaria de anunciar hoje? ex. Uma marca de roupas esportivas voltada para jovens em Amsterdã. Orçamento de €30/dia.",
    currentlyWorkingWith:"Trabalhando atualmente com", setUpBusinessCta:"Configure seu negócio para personalizar cada campanha →",
    addMoreImages:"Adicionar mais", generatingEllipsis:"Gerando…",
    intelMonitorBtn:"Campanhas monitoradas", intelBriefingHeading:"Relatório executivo", intelPriorityHeading:"Maior prioridade",
    intelWatchlistHeading:"Lista de observação", intelMonitorPanelTitle:"Campanhas monitoradas",
    intelMonitorPanelDesc:"A Intelligence analisa apenas as campanhas que você escolher monitorar aqui — nunca toda a sua conta automaticamente.",
    intelMonitorNoCampaigns:"Conecte o Google ou Meta Ads para ver suas campanhas aqui.",
    intelBriefLoadingText:"Analisando suas campanhas monitoradas…", intelLoadErrorText:"Não foi possível carregar a Intelligence agora.",
    intelConnectPromptPrefix:"Conecte uma conta do Google ou Meta para desbloquear isso —", intelConnectPromptLink:"ir para Integrações",
    intelWatchlistEmpty:"Nenhuma alteração incomum detectada.", intelNoMonitoredPrefix:"Ainda não há campanhas monitoradas.",
    intelNoMonitoredLink:"Selecione uma ou mais campanhas", intelNoMonitoredSuffix:"para receber relatórios diários de IA.",
    intelBriefEmpty:"Nenhuma alteração significativa detectada hoje. Tudo está dentro do esperado.",
    intelCardLabelReason:"Motivo", intelCardLabelWhy:"Por quê", intelCardLabelExpectedImpact:"Impacto esperado",
    intelCardLabelExpectedOutcome:"Resultado esperado", intelCardLabelRecommendedAction:"Ação recomendada",
    intelCardTitleFallback:"Observação", intelConfidenceSuffix:"confiança",
    notifCatAutomation:"Automação", notifCatOpportunity:"Oportunidade", notifCatCompleted:"Concluído",
    notifCatLearning:"Aprendizado", notifCatCritical:"Crítico", notifCatWarning:"Aviso",
    notifEmptyText:"Nenhuma notificação urgente.", notifCatApproval:"Aprovação", notifDismissBtn:"Dispensar",
    apSectionBuilder:"Criador de automações", apSectionActive:"Automações ativas", apSectionSuggested:"Sugerido pela Oriven",
    apSectionHistory:"Histórico de automações", apSectionSettings:"Configurações de automação",
    apStepQPlatform:"O que devo monitorar?", apRecapLblPlatform:"Monitoramento",
    apStepQCampaign:"Qual campanha?", apRecapLblCampaign:"Campanha",
    apStepQCondition:"Quando devo reagir?", apRecapLblCondition:"Condição",
    apStepQAction:"O que deve acontecer?", apRecapLblAction:"Ação",
    apStepReview:"Revisar", apModeQuestion:"Como devo lidar com isso?", apRecapEdit:"Alterar",
    statusActive:"Ativo", statusPaused:"Pausado", apNamePlaceholder:"Nomeie esta automação (opcional)",
    apHistorySearchPlaceholder:"Pesquisar histórico…", apContinueBtn:"Continuar", apTestBtn:"Testar",
    apCreateAutomationBtn:"Criar automação", apSaveChangesBtn:"Salvar alterações", apStartOverBtn:"Recomeçar", apByLabel:"em",
    apSetDefaultModeLabel:"Modo padrão para novas regras", apModeRequireApproval:"Exigir aprovação",
    apModeSuggestOnly:"Apenas sugerir", apModeFullyAutomatic:"Totalmente automático",
    apNotifyEnabled:"Ativado", apNotifyDisabled:"Desativado", apBriefTimeLabel:"Horário do relatório diário",
    apMetricRoas:"ROAS", apMetricCtr:"CTR", apMetricCpc:"CPC", apMetricCpa:"CPA", apMetricConversions:"Conversões",
    apMetricSpend:"Gasto", apMetricClicks:"Cliques", apMetricImpressions:"Impressões", apMetricBudget:"Orçamento", apMetricStatus:"Status da campanha",
    apOpGreaterThan:"é maior que", apOpLessThan:"é menor que", apOpEquals:"é igual a", apOpAtLeast:"é no mínimo", apOpAtMost:"é no máximo",
    apActionIncreaseBudget:"Aumentar orçamento", apActionDecreaseBudget:"Reduzir orçamento", apActionPause:"Pausar campanha",
    apActionResume:"Retomar campanha", apActionGenCreative:"Gerar novo criativo", apActionGenRecs:"Gerar recomendações de IA",
    apActionNotify:"Notificar-me", apActionRequestApproval:"Solicitar aprovação", apActionCreateReport:"Gerar relatório",
    apActionCreateBriefing:"Criar relatório", apActionRunOptimisation:"Executar otimização de IA",
    apModeAskFirst:"Perguntar-me primeiro", apModeAskFirstDesc:"Você aprova sempre",
    apModeSuggestIt:"Apenas sugerir", apModeSuggestItDesc:"Nenhuma ação tomada automaticamente",
    apModeHandleAuto:"Lidar automaticamente", apModeHandleAutoDesc:"Sem necessidade de aprovação",
    apAllCampaigns:"Todas as campanhas", apAllCampaignsDesc:"Cada campanha nesta plataforma", apJustThisCampaignDesc:"Apenas esta campanha", apUnnamedCampaign:"Sem nome",
    apErrNumeric:"Insira um valor numérico (ex. 4.0), não texto.", apErrPercent:"Insira uma porcentagem entre 1 e 100.",
    apErrIncomplete:"Termine de escolher uma condição e uma ação primeiro.", apErrChooseStatus:"Escolha Ativo ou Pausado.",
    apErrSaveFirst:"Salve a automação primeiro e depois teste.", apErrTestFailed:"Não foi possível testar esta regra agora.",
    apErrSaveFailed:"Não foi possível salvar essa automação.", apErrLoadActiveFailed:"Não foi possível carregar suas automações.",
    apErrLoadHistoryFailed:"Não foi possível carregar o histórico.",
    apEmptyActiveText:"Você ainda não criou nenhuma automação. Vamos automatizar o trabalho repetitivo juntos.",
    apEmptyHistoryText:"Ainda não há atividade de automação.",
    apExampleBudgetRoas:"Aumentar orçamento quando o ROAS exceder 4", apExamplePauseNoConv:"Pausar campanhas sem conversões",
    apExampleDailyBriefing:"Gerar um relatório diário", apExampleNotifyCtr:"Notificar-me quando o CTR cair",
    apNeverRun:"Nunca", apStatusRunning:"Em execução", apLastExecutedPrefix:"Última execução:",
    apDisableBtn:"Desativar", apEnableBtn:"Ativar", apDeleteBtn:"Excluir",
    apAwaitingYourApproval:"Aguardando sua aprovação", dateToday:"Hoje", dateYesterday:"Ontem", dateDaysAgoSuffix:"dias atrás", apDateEarlier:"Antes",
    apAwaitingApproval:"Aguardando aprovação", apApproveBtn:"Aprovar", apRejectBtn:"Rejeitar",
    apSuggestSetupBtn:"Configurar",
    apReviewIllMonitor:"Vou monitorar", apReviewAllCampaignsOf:"todas as suas", apReviewCampaignsPlural:"campanhas",
    apReviewWhenever:"Sempre que", apReviewIs:"estiver", apReviewIllComma:", eu",
    apReviewModeFullyAuto:" Farei isso automaticamente — você será notificado depois.",
    apReviewModeSuggest:" Vou apenas sinalizar como sugestão, sem tomar nenhuma ação.",
    apReviewModeApproval:" Vou pedir sua aprovação primeiro.",
    apErrBudgetUnsupported:"Alterações de orçamento não estão disponíveis em", apYetSuffix:"ainda",
    apTestingAgainstData:"Testando com os dados reais da sua campanha…", apWouldTriggerNow:"Seria acionado agora",
    apCheckedCampaignsPrefix:"Verificadas", apCampaignSingular:"campanha", apCampaignPlural:"campanhas",
    apNoneMatchCondition:"nenhuma atende a essa condição no momento.",
    apRuleSentenceWhen:"Quando", apRuleSentenceOrivenWill:", a Oriven vai",
    bizTabOverview:"Visão geral", bizTabBusiness:"Negócio", bizTabProducts:"Produtos", bizTabMarket:"Mercado",
    bizTabBrand:"Marca", bizTabConnections:"Conexões", bizTabMemory:"Memória",
    bizLearningLabel:"Aprendizado", bizGetReflectionBtn:"Obter uma análise", bizInsightsLabel:"Insights do negócio",
    bizKnowledgeCheckLabel:"Verificação de conhecimento", bizRunCheckBtn:"Executar verificação",
    bizProductsHeading:"Produtos", bizAddProductBtn:"+ Adicionar um produto",
    bizAudienceHeading:"Público", bizAddAudienceBtn:"+ Adicionar um público",
    bizCompetitorsHeading:"Concorrentes", bizAddCompetitorBtn:"+ Adicionar um concorrente",
    bizProfileCardTitle:"Perfil da empresa", bizProfileCardSub:"O básico — quem você é, o que faz e para onde está indo.",
    bizWebsiteCardTitle:"Site", bizWebsiteCardSub:"O que a Oriven aprendeu ao ler seu site.",
    bizFieldWebsiteUrl:"URL do site", bizAnalyseWebsiteBtn:"Analisar meu site", bizRefreshAnalysisBtn:"Atualizar análise",
    bizVoiceCardTitle:"Voz da marca", bizVoiceCardSub:"Escolha os traços que descrevem como sua marca soa. A Oriven os usa em cada título e roteiro que escreve.",
    bizConnectionsIntro:"Suas plataformas de anúncios. Conecte uma conta e a Oriven poderá ler e gerenciar campanhas nela diretamente.",
    bizMemoryIntro:"Tudo o que a Oriven aprendeu pelo caminho — de conversas e do que funcionou. Esta é a memória de longo prazo da Oriven sobre o seu negócio.",
    bizEmptyMemory:"Nada memorizado ainda — isso se acumula conforme você usa a Oriven.", bizMemoryDeleteBtn:"Excluir",
    bizVcardEditBtn:"Editar", bizVcardDeleteBtn:"Excluir", bizVcardSaveBtn:"Salvar", bizVcardCloseBtn:"Fechar",
    bizVcardEmptyDetails:"Ainda sem detalhes — clique em Editar para preencher.",
    conNotConnected:"Não conectado", conStatusConnected:"Conectado", conCheckingStatus:"Verificando…",
    conDisconnectBtn:"Desconectar", conAdAccountsHeader:"Contas de anúncios", conActiveBadge:"Ativa", conSetActiveBtn:"Definir como ativa",
    conConnectGoogleBtn:"Conectar Google Ads →", conConnectMetaBtn:"Conectar Meta Ads →", conConnectTiktokBtn:"Conectar TikTok Ads →",
    conDetailConnectedAccounts:"Contas conectadas", conDetailConnectedBusinesses:"Empresas conectadas",
    bizReadingWebsiteBtn:"Lendo seu site…",
    rangeToday:"Hoje", rangeYesterday:"Ontem", rangeLast7Days:"Últimos 7 dias", rangeLast30Days:"Últimos 30 dias",
    rangeLast90Days:"Últimos 90 dias", rangeThisMonth:"Este mês", rangeLastMonth:"Mês passado",
    rangeLast12Months:"Últimos 12 meses", rangeLifetime:"Todo o período", rangeCustom:"Intervalo personalizado…",
    tiktokAnalyticsTitle:"Análises do TikTok", tiktokAnalyticsComingSub:"As análises ficarão disponíveis assim que sua conta do TikTok Ads for conectada.",
    connectBannerTitle:"Conecte suas contas de anúncios para desbloquear análises ao vivo",
    connectBannerSub:"Vincule Google Ads, Meta Ads ou TikTok Ads para acompanhar gastos, ROAS e conversões em tempo real.",
    connectAccountsBtn:"Conectar contas →",
    kpiTotalSpend:"Gasto total", kpiImpressions:"Impressões", kpiClicks:"Cliques", kpiConversions:"Conversões", kpiRoas:"ROAS",
    kpiChgPlaceholder:"— vs. período anterior",
    chartSpendOverTime:"Gasto ao longo do tempo", chartLockConnectLive:"Conecte uma conta para ver dados em tempo real", chartLockConnectUnlock:"Conecte para desbloquear",
    chartRoasOverTime:"ROAS ao longo do tempo", chartCtrOverTime:"CTR ao longo do tempo",
    orivenScoreTitle:"Pontuação Oriven", orivenScoreSub:"Saúde da conta com tecnologia de IA · 0–100",
    aiAnalysisTitle:"Análise de IA", aiAnalysisDefaultSummary:"Analise esta conta em busca de gastos desperdiçados, CTR baixo, problemas de conversão e oportunidades de expansão.",
    analyzeWithAiBtn:"Analisar com IA", aiSectionStrengths:"Pontos fortes", aiSectionWeaknesses:"Pontos fracos",
    aiSectionRecommendations:"Recomendações", aiSectionExpectedImpact:"Impacto esperado", generateAdCopyBtn:"Gerar texto do anúncio →",
    analyzingEllipsis:"Analisando…", analysisFailed:"Falha na análise", analysisFailedRetry:"Falha na análise — tente novamente", reanalyzeBtn:"Reanalisar",
    searchCampaignsPlaceholder:"Pesquisar campanhas…", newCampaignBtnPlain:"Nova campanha", noCampaignsYetDot:"Ainda não há campanhas.",
    noCampaignsYetSub:"Gere sua primeira campanha a partir de Criar. Descreva seu produto e a Oriven criará uma campanha completa instantaneamente.",
    createCampaignArrowBtn:"Criar campanha →", noCampaignsMatchSearch:"Nenhuma campanha corresponde à sua busca.",
    continueWorkingHeader:"Continuar trabalhando",
    tiktokComingSoonSub:"A integração com o TikTok chegará em breve. Assim que seu app do TikTok for aprovado e conectado, suas campanhas aparecerão aqui.",
    smdHdTitle:"Configurações", smdNavGeneral:"Geral", smdNavSubscription:"Assinatura", smdNavNotifications:"Notificações",
    smdNavAccount:"Conta", smdNavSecurity:"Segurança",
    smdWsNameLabel:"Nome do espaço de trabalho", smdWsNameHelp:"Aparece na barra lateral e em todo o aplicativo.",
    smdThemeLabel:"Tema", smdThemeLight:"Claro", smdThemeDark:"Escuro", smdThemeSystem:"Sistema", smdAccentLabel:"Cor de destaque",
    smdLangLabel:"Idioma de exibição e geração", smdLangHelp:"Aplicado aos rótulos da interface e ao conteúdo gerado por IA.",
    smdLoadingEllipsis:"Carregando…",
    smdNotifGenTitle:"Geração concluída", smdNotifGenSub:"Avisar quando a IA terminar de gerar conteúdo.",
    smdNotifPubTitle:"Publicação concluída", smdNotifPubSub:"Avisar quando o conteúdo tiver sido publicado.",
    smdNotifBillTitle:"Atualizações de cobrança", smdNotifBillSub:"Alertas de renovações e atividade de pagamento.",
    smdNotifUpdTitle:"Atualizações do produto", smdNotifUpdSub:"Anúncios no app sobre novos recursos.",
    smdNotifApTitle:"Aprovações do Autopilot", smdNotifApSub:"Avisar quando uma recomendação ou regra de automação precisar da sua aprovação.",
    smdSignedInWith:"Conectado com", smdEmailLabel:"Endereço de e-mail", smdEmailHelp:"Usado para entrar e receber notificações da conta.",
    smdChangePwTitle:"Alterar senha", smdChangePwHelp:"Digite sua senha atual e escolha uma nova.",
    smdCurrentPwPlaceholder:"Senha atual", smdNewPwPlaceholder:"Nova senha (mín. 8 caracteres)", smdConfirmPwPlaceholder:"Confirmar nova senha",
    smdUpdatePwBtn:"Atualizar senha", smdForgotPwTitle:"Esqueceu sua senha?",
    smdForgotPwHelp:"Envie um link de redefinição por e-mail em vez disso.", smdSendResetBtn:"Enviar e-mail de redefinição",
    smdDangerZoneTitle:"Zona de risco", smdSignOutTitle:"Sair", smdSignOutSub:"Sair da ORIVEN neste dispositivo.", smdSignOutBtn:"Sair",
    smdDeleteAcctTitle:"Excluir conta", smdDeleteAcctSub:"Remove permanentemente sua conta e todos os dados. Isso não pode ser desfeito.", smdDeleteAcctBtn:"Excluir conta",
    smdHelpGeneralHelp:"O nome do seu espaço de trabalho, tema (claro/escuro/sistema), cor de destaque e idioma da interface. A cor de destaque se aplica a todo o app — estados de hover, abas ativas, botões e anéis de foco. As alterações são salvas automaticamente e aplicadas imediatamente.",
    smdHelpSubHelp:"Seu plano atual, uso e gerenciamento de cobrança. Faça upgrade, downgrade ou gerencie os dados de pagamento por aqui.",
    smdHelpNotifHelp:"Controle quais eventos geram um alerta — geração concluída, publicação, cobrança, atualizações de produto e aprovações do Autopilot. Desativar uma categoria impede que essas notificações sejam criadas, não apenas as oculta.",
    smdHelpAcctHelp:"Seu método de login e endereço de e-mail. Alterações de e-mail exigem confirmação do novo endereço antes de entrarem em vigor.",
    smdHelpSecHelp:"Altere sua senha diretamente (senha atual necessária) ou envie um link de redefinição por e-mail.",
    smdHelpBizHelp:"Gerencie os detalhes do seu negócio, voz da marca, públicos e contas de anúncios conectadas a partir do espaço Business — separado das Configurações pessoais, já que pode ser compartilhado entre a equipe.",
    smdHelpApHelp:"Regras de automação que agem em suas campanhas sem intervenção manual. Recomendações que precisam da sua aprovação aparecem como notificações de aprovação do Autopilot, controladas na aba Notificações.",
    smdRestartObTitle:"Reiniciar integração",
    smdRestartObHelp:"Reveja o tour guiado desde o início. Útil para demonstrações ou uma revisão rápida.",
    smdRestartObBtn:"Reiniciar integração",
    helpTitle:"Ajuda", helpSub:"O que cada seção de Configurações faz.",
    builderResultLabel:"Resultado", regenerateBtn:"Regenerar", saveToStudioBtn:"Salvar no Studio"
  },

  de:{
    dashboard:"Dashboard", create:"Erstellen", studio:"BrandCore",
    inspiration:"Inspiration", settings:"Einstellungen",
    goodMorning:"Guten Morgen", goodAfternoon:"Guten Nachmittag",
    goodEvening:"Guten Abend", goodNight:"Gute Nacht",
    brandAssistant:"Marken-Assistent", openAIChat:"Erstellen beginnen",
    savedAssets:"Gespeicherte Dateien", brandCore:"Markenkern",
    brandCheck:"Markenprüfung", campaigns:"Kampagnen",
    workspace:"Arbeitsbereich", plan:"Ihr Plan", appearance:"Erscheinungsbild", language:"Sprache",
    notifications:"Benachrichtigungen", exportPref:"Exportieren", brandReset:"Marke zurücksetzen",
    themeLabel:"Thema", lightMode:"Heller Modus", darkMode:"Dunkler Modus",
    accentLabel:"Akzentfarbe",
    accentHelp:"Wähle die Hervorhebungsfarbe für Schaltflächen, aktive Zustände und UI-Elemente.",
    noItems:"Noch keine gespeicherten Dateien",
    createContent:"Erstelle Inhalte im AI Chat und speichere sie hier.",
    welcomeMsg:"Wie kann ich Ihre Marke heute unterstützen?",
    createSub:"Wähle einen Erstellungstyp. Dein Brand Core beeinflusst jeden Output.",
    imageTitle:"Bild",          imageDesc:"Erstelle Visuals, Poster und Social-Media-Designs.",
    textTitle:"Text",           textDesc:"Erstelle Bildunterschriften, Überschriften und Markentexte.",
    campaignTitle:"Kampagne",   campaignDesc:"Erstelle vollständige Kampagnen mit Visuals und Texten.",
    videoTitle:"Video",         videoDesc:"Erstelle Videoideen, Skripte und Konzepte.",
    webTitle:"Web",             webDesc:"Erstelle markengerechte Landing Pages und Web-Assets.",
    assistantDesc:"Frag deine Marken-KI um Anleitung, Ideen und kreative Richtung.",
    comingSoon:"Demnächst",
    brandWorkspace:"Marken-Arbeitsbereich", signOut:"Abmelden",
    dashHeadlinePrefix:"Deine Marke ist", dashHeadlineHighlight:"bereit.",
    dashTagline:"Verwandeln wir sie in Content, Anzeigen und Wachstum.",
    dashCreateLabel:"Inhalt erstellen",  dashCreateDesc:"Bilder, Texte, Videoskripte und mehr.",
    dashIdeasLabel:"Ideen erkunden",     dashIdeasDesc:"Content-Ideen, Anzeigenwinkel und Kampagnenkonzepte.",
    dashCampaignLabel:"Kampagne erstellen", dashCampaignDesc:"Vollständige Multi-Channel-Kampagnen von Anfang bis Ende.",
    dashBrandLabel:"Brand Core bearbeiten", dashBrandDesc:"Farben, Schriften, Tonalität und Identität.",
    edit:"Bearbeiten", setUp:"Einrichten", notConfigured:"Nicht konfiguriert",
    buildBrandIdentity:"Baue deine Markenidentität auf, um zu beginnen.",
    setUpBrandCore:"Brand Core einrichten →",
    createH1Line1:"Was möchtest du heute", createH1Line2:"erstellen?",
    brandStudioTitle:"Brand Studio", brandStudioSub:"Alles, was deine Marke definiert und antreibt.",
    studioSavedLabel:"Gespeichert", studioSavedDesc:"All deine generierten Inhalte und Dateien.",
    studioBCDesc:"Farben, Schriften, Tonalität und Identität.",
    studioCheckLabel:"Markenprüfung", studioCheckDesc:"Analysiere Inhalte auf Markenkonsistenz.",
    studioCampDesc:"Verwalte und starte deine aktiven Kampagnen.",
    studioBackBtn:"Zurück",
    noBCConfigured:"Noch kein Brand Core konfiguriert",
    noBCConfiguredSub:"Richte deine Markenidentität ein, um KI-Generierung freizuschalten.",
    aiGenerateBtn:"KI generieren", manualSetupBtn:"Manuelle Einrichtung",
    savedAssetsHeader:"Gespeicherte Dateien", openAIChatBtn:"AI Chat öffnen",
    noCampaignsTitle:"Noch keine Kampagnen",
    noCampaignsSub:"Bündele gespeicherte Dateien in visuellen Kampagnenkonzepten.",
    newCampaignBtn:"+ Neue Kampagne",
    dropImageTitle:"Bild hier ablegen", dropImageSub:"PNG, JPG oder WEBP — ziehen oder klicken zum Durchsuchen",
    checkBrandNoImgBtn:"Marke ohne Bild prüfen", readyForCheck:"Bereit für Markenprüfung",
    runBrandCheckBtn:"Markenprüfung starten", resetBtn:"Zurücksetzen", removeBtn:"Entfernen",
    analyzingBrand:"Markenkonsistenz analysieren...", checkingDetails:"Farben, Typografie und visuellen Stil prüfen",
    ideasTitle:"Ideen", ideasSub:"Bewährte Frameworks für deinen nächsten Inhalt.",
    contentIdeasLabel:"Content-Ideen",     contentIdeasDesc:"Posts, Storys und Formate, die Zielgruppen aufbauen.",
    adAnglesLabel:"Anzeigenwinkel",        adAnglesDesc:"Botschafts-Frameworks, die Aufmerksamkeit in Aktion umwandeln.",
    visualStylesLabel:"Visuelle Stile",    visualStylesDesc:"Ästhetische Richtungen für deine Markenidentität.",
    campaignConceptsLabel:"Kampagnenkonzepte", campaignConceptsDesc:"End-to-End-Strukturen, die echte Ergebnisse liefern.",
    idContentTitle:"Content-Ideen",    idAnglesTitle:"Anzeigenwinkel",
    idVisualTitle:"Visuelle Stile",    idCampaignTitle:"Kampagnenkonzepte",
    idContentUseLabel:"Diese Idee nutzen",      idContentGenLabel:"Beitrag erstellen",
    idAnglesUseLabel:"Diesen Winkel ausprobieren", idAnglesGenLabel:"Anzeige erstellen",
    idVisualUseLabel:"Diesen Stil nutzen",      idVisualGenLabel:"Visual erstellen",
    idCampaignUseLabel:"Diese Kampagne aufbauen", idCampaignGenLabel:"Assets erstellen",
    idCont0Label:"Bildungsinhalt",       idCont1Label:"Produkt-Spotlight",
    idCont2Label:"Gründergeschichte",    idCont3Label:"Transformationsgeschichte",
    idCont4Label:"Kundenergebnis",       idCont5Label:"Vergleichspost",
    idCont6Label:"Mythos vs. Wahrheit",  idCont7Label:"Vorher / Nachher",
    idCont8Label:"Routine / Arbeitsablauf", idCont9Label:"Autorität aufbauen",
    idAng0Label:"Problem → Lösung",     idAng1Label:"Aspiration",
    idAng2Label:"Transformation",        idAng3Label:"Dringlichkeit",
    idAng4Label:"Knappheit",             idAng5Label:"Schmerzpunkt-Agitation",
    idAng6Label:"Sozialer Beweis",       idAng7Label:"Premium-Positionierung",
    idAng8Label:"Nutzen zuerst",         idAng9Label:"Emotionaler Aufhänger",
    idVis0Label:"Luxus Minimal",         idVis1Label:"Modern und Kühn",
    idVis2Label:"Dunkel Premium",        idVis3Label:"Sanfter Lifestyle",
    idVis4Label:"Editorial Clean",       idVis5Label:"Hoher Kontrast",
    idVis6Label:"Futuristisch-Schlank",  idVis7Label:"Organisch-Natürlich",
    idVis8Label:"Sportliche Performance",idVis9Label:"Elegant-Feminin",
    idCamp0Label:"Produkteinführung",    idCamp1Label:"Markenbekanntheit",
    idCamp2Label:"Saisonaler Drop",      idCamp3Label:"Konversions-Push",
    idCamp4Label:"Bildungs-Funnel",      idCamp5Label:"Retargeting-Sequenz",
    idCamp6Label:"Limitiertes Angebot",  idCamp7Label:"Gründer-Kampagne",
    idCamp8Label:"Testimonial-getrieben",idCamp9Label:"Community-Kampagne",
    teamTitle:"Team", teamSub:"Verwalte dein Business-Workspace-Team.",
    settingsTitle:"Einstellungen", settingsSub:"Verwalte deinen Arbeitsbereich und deine Einstellungen.",
    spWorkspaceSub:"Verwalte die Details und Einstellungen deines Marken-Arbeitsbereichs.",
    wsNameLabel:"Name des Arbeitsbereichs",
    wsNameHelp:"Dies ist der Name deines Arbeitsbereichs in ORIVEN. Er erscheint in deiner Seitenleiste und in der gesamten App.",
    saveBtn:"Speichern",
    brandLockLabel:"Marken-Sperre", lockBCLabel:"BrandCore sperren",
    lockBCSub:"Wenn aktiviert, bleibt dein BrandCore fest und wird konsistent auf alle generierten Inhalte angewendet.",
    spAppearanceSub:"Wähle, wie ORIVEN aussieht und sich anfühlt. Deine Einstellung wird gespeichert.",
    spLanguageSub:"Lege die Anzeige- und Inhaltssprache für deinen Arbeitsbereich fest.",
    langDisplayLabel:"Anzeige- und Generierungssprache",
    langDisplayHelp:"ORIVEN verwendet diese Sprache für Interface-Labels und bei der Inhaltsgenerierung mit deinem BrandCore.",
    spNotificationsSub:"Steuere In-App-Benachrichtigungen. Änderungen werden sofort gespeichert.",
    notifBrandCheckLabel:"Markenprüfungs-Benachrichtigungen",
    notifBrandCheckSub:"Zeige eine Benachrichtigung, wenn dein Markenscore unter 70% fällt.",
    notifGenCompleteLabel:"Generierung abgeschlossen",
    notifGenCompleteSub:"Benachrichtige dich, wenn die KI die Inhaltsgenerierung abgeschlossen hat.",
    notifUpdatesLabel:"Produktaktualisierungen",
    notifUpdatesSub:"Erhalte In-App-Ankündigungen zu neuen ORIVEN-Funktionen und Verbesserungen.",
    spExportTitle:"Exporteinstellungen", spExportSub:"Steuere, wie dein generierter Inhalt für den Export vorbereitet wird.",
    expFormatLabel:"Standard-Exportformat",
    expFormatHelp:"Wähle das Standard-Dateiformat beim Herunterladen generierter Assets.",
    autoSaveLabel:"Generierten Inhalt automatisch speichern",
    autoSaveSub:"Speichere Workspace-Änderungen und generierten Inhalt automatisch im Studio.",
    spDangerSub:"Dauerhafte Aktionen — diese können nicht rückgängig gemacht werden.",
    resetBCTitle:"Brand Core zurücksetzen",
    resetBCDesc:"Dadurch wird Ihr gesamtes Markensetup zurückgesetzt — Farben, Tonfall, Positionierung und Identitätsdaten. Ihre in Studio gespeicherten generierten Inhalte sind davon nicht betroffen, aber alle zukünftigen Generierungen verlieren den Markenkontext, bis Sie ein neues BrandCore erstellen. Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden.",
    resetBCBtn:"Brand Core zurücksetzen",
    navLaunch:"Starten", navCampaigns:"Kampagnen", navIntelligence:"Intelligenz", navAutopilot:"Autopilot", navBusiness:"Unternehmen", navSettings:"Einstellungen",
    wsTitleIntelligence:"Intelligenz", wsSubIntelligence:"Was heute Ihre Aufmerksamkeit verdient.",
    wsTitleBusiness:"Unternehmen", wsSubBusiness:"Bringen Sie Oriven einmal Ihr Unternehmen bei — jede Kampagne, jedes Gespräch und jede Empfehlung nutzt dies ab sofort automatisch.",
    wsTitleAutopilot:"Autopilot", wsSubAutopilot:"Automatisiert sich wiederholende Werbearbeit. Nicht mehr.",
    wsTitlePerformance:"Leistung", wsSubPerformance:"Wie schneiden Ihre Kampagnen ab?",
    wsTitleCampaigns:"Kampagnen", wsSubCampaigns:"Verwalten Sie Ihre Kampagnen — Entwürfe, aktiv und archiviert.",
    hubTabOverview:"Übersicht", hubTabLiveCampaigns:"Aktive Kampagnen", hubTabDrafts:"Entwürfe",
    toastTypographyComingSoon:"Typografie-Editor demnächst verfügbar", toastToneComingSoon:"Ton-Editor demnächst verfügbar",
    toastPositioningComingSoon:"Positionierungs-Editor demnächst verfügbar", toastSavedDraft:"Als Entwurf gespeichert",
    toastEnterCampaignName:"Gib einen Kampagnennamen ein", toastEnterCampaignGoal:"Gib dein Kampagnenziel ein",
    toastDescribeBusiness:"Beschreibe dein Unternehmen oder Produkt", toastSelectCreativeFormat:"Wähle mindestens ein Creative-Format",
    toastCopied:"Kopiert!", toastChangesApplied:"Änderungen übernommen", toastCopiedClipboard:"In die Zwischenablage kopiert",
    toastAddModuleComingSoon:"Modul hinzufügen — demnächst verfügbar", toastRegenerating:"Wird neu generiert…", toastRegenerated:"Neu generiert",
    toastRegenerationFailed:"Neu generieren fehlgeschlagen — bitte erneut versuchen", toastCampaignExported:"Kampagne exportiert",
    toastCampaignDuplicated:"Kampagne dupliziert", toastCampaignQueued:"Kampagne zur Veröffentlichung eingereiht",
    toastCampaignNotFound:"Kampagnendaten nicht gefunden", toastNoPlatformSet:"Keine Plattform für diese Kampagne festgelegt",
    toastCampaignPublishedTo:"Kampagne veröffentlicht auf", toastPublishFailedPrefix:"Veröffentlichung fehlgeschlagen:",
    toastCampaignPaused:"Kampagne pausiert", toastCampaignResumed:"Kampagne fortgesetzt",
    toastCampaignArchived:"Kampagne archiviert", toastCampaignDeleted:"Kampagne gelöscht",
    toastDescribeAdvertise:"Beschreibe, wofür du werben möchtest", toastDescribeSelling:"Beschreibe, was du verkaufst",
    toastChooseGoal:"Wähle ein Ziel", toastSelectPlatform:"Wähle mindestens eine Plattform",
    toastComingSoon:"demnächst verfügbar", toastActiveAccountUpdated:"Aktives Konto aktualisiert",
    toastFailedSetAccount:"Konto konnte nicht festgelegt werden — bitte erneut versuchen", toastNetworkError:"Netzwerkfehler — bitte erneut versuchen",
    toastConnectionFailed:"Verbindung fehlgeschlagen — bitte erneut versuchen.", toastConnectionFailedShort:"Verbindung fehlgeschlagen.",
    toastDisconnectFailed:"Trennen fehlgeschlagen — bitte erneut versuchen.", toastEnterWebsiteUrl:"Gib zuerst eine Website-URL ein.",
    toastWebsiteAnalysed:"Website analysiert. Business-Wissen aktualisiert.",
    toastWebsiteAnalyseFailed:"Diese Website konnte nicht analysiert werden. Überprüfe die URL und versuche es erneut.",
    toastSelectDestinationAccount:"Wähle zuerst ein Zielkonto",
    toastReportNeedsAccount:"Für die Berichtserstellung ist ein verbundenes Werbekonto erforderlich.",
    toastNoReportsYet:"Noch keine Berichte zum Exportieren. Erstelle zuerst einen Bericht.", toastCampaignGenerated:"Kampagne generiert",
    toastPublishingToEllipsis:"Veröffentlichung auf", toastPublishErrorPrefix:"Veröffentlichungsfehler:",
    toastImagePromptCopied:"Bild-Prompt kopiert", toastNoPackageYet:"Noch kein Paket generiert",
    toastPackageCopied:"Kampagnenpaket in die Zwischenablage kopiert", toastEnterCampaignDesc:"Bitte gib eine Kampagnenbeschreibung ein.",
    toastEngineNotLoaded:"Generierungs-Engine nicht geladen. Bitte aktualisieren.", toastGenerationFailedPrefix:"Kampagnengenerierung fehlgeschlagen:",
    toastConnectedSuffix:"verbunden!", toastDisconnectedSuffix:"getrennt.",
    toastConnectingEllipsis:"Verbindung wird hergestellt…", btnConnectPlatformSuffix:"Ads →", btnConnectingPlatform:"Verbindung wird hergestellt…",
    confirmDisconnectPlatform:"{platform} trennen? Live-Analysen werden gestoppt, aber deine Kampagnendaten bleiben erhalten.",
    toastSavedBizKnowledge:"Erfolgreich gespeichert. Business-Wissen aktualisiert.", toastCouldNotSave:"Speichern nicht möglich. Bitte erneut versuchen.",
    toastSignedOut:"Abgemeldet", toastProfileLoadFailed:"Profil konnte nicht geladen werden — bitte Seite aktualisieren.",
    toastPleaseSignIn:"Bitte zuerst anmelden", toastVerificationSent:"Bestätigungs-E-Mail gesendet — bitte Posteingang prüfen",
    toastCouldNotSendPrefix:"Senden nicht möglich —", toastEmailVerified:"E-Mail bestätigt — dein Konto ist verifiziert!",
    toastVerificationInvalid:"Der Bestätigungslink ist ungültig oder bereits verwendet. Fordere einen neuen an.",
    toastBrandCoreSavedCloud:"Brand Core in der Cloud gespeichert", toastCheckoutFailed:"Checkout konnte nicht gestartet werden — bitte erneut versuchen",
    toastCheckoutCanceled:"Checkout abgebrochen — du kannst jederzeit upgraden.",
    toastSubscriptionActive:"Dein Abo ist jetzt aktiv — willkommen bei ORIVEN!",
    toastPaymentReceived:"Zahlung erhalten — dein Konto wird aktiviert...",
    toastSubscriptionPending:"Abo ausstehend — bitte in einem Moment aktualisieren.",
    toastPlatformConnectedSuccess:"erfolgreich verbunden!",
    launchH1:"Starte deine nächste Kampagne.", genModeImage:"Bild", genModeVideo:"Video",
    attachImageBtn:"Bild anhängen", launchPromptPlaceholder:"Wofür möchtest du heute werben? z. B. Eine Sportbekleidungsmarke für junge Männer in Amsterdam. Budget 30 €/Tag.",
    currentlyWorkingWith:"Momentan in Arbeit mit", setUpBusinessCta:"Richte dein Unternehmen ein, um jede Kampagne zu personalisieren →",
    addMoreImages:"Weitere hinzufügen", generatingEllipsis:"Wird generiert…",
    intelMonitorBtn:"Überwachte Kampagnen", intelBriefingHeading:"Management-Bericht", intelPriorityHeading:"Höchste Priorität",
    intelWatchlistHeading:"Beobachtungsliste", intelMonitorPanelTitle:"Überwachte Kampagnen",
    intelMonitorPanelDesc:"Intelligence analysiert nur Kampagnen, die du hier zur Überwachung auswählst — niemals automatisch dein gesamtes Konto.",
    intelMonitorNoCampaigns:"Verbinde Google oder Meta Ads, um deine Kampagnen hier zu sehen.",
    intelBriefLoadingText:"Deine überwachten Kampagnen werden geprüft…", intelLoadErrorText:"Intelligence konnte gerade nicht geladen werden.",
    intelConnectPromptPrefix:"Verbinde ein Google- oder Meta-Konto, um dies freizuschalten —", intelConnectPromptLink:"zu Integrationen",
    intelWatchlistEmpty:"Keine ungewöhnlichen Änderungen erkannt.", intelNoMonitoredPrefix:"Noch keine überwachten Kampagnen.",
    intelNoMonitoredLink:"Wähle eine oder mehrere Kampagnen aus", intelNoMonitoredSuffix:"um tägliche KI-Berichte zu erhalten.",
    intelBriefEmpty:"Heute keine wesentlichen Änderungen erkannt. Alles läuft im erwarteten Bereich.",
    intelCardLabelReason:"Grund", intelCardLabelWhy:"Warum", intelCardLabelExpectedImpact:"Erwartete Auswirkung",
    intelCardLabelExpectedOutcome:"Erwartetes Ergebnis", intelCardLabelRecommendedAction:"Empfohlene Aktion",
    intelCardTitleFallback:"Beobachtung", intelConfidenceSuffix:"Konfidenz",
    notifCatAutomation:"Automatisierung", notifCatOpportunity:"Chance", notifCatCompleted:"Abgeschlossen",
    notifCatLearning:"Lernen", notifCatCritical:"Kritisch", notifCatWarning:"Warnung",
    notifEmptyText:"Keine dringenden Benachrichtigungen.", notifCatApproval:"Genehmigung", notifDismissBtn:"Verwerfen",
    apSectionBuilder:"Automatisierungs-Builder", apSectionActive:"Aktive Automatisierungen", apSectionSuggested:"Von Oriven vorgeschlagen",
    apSectionHistory:"Automatisierungsverlauf", apSectionSettings:"Automatisierungseinstellungen",
    apStepQPlatform:"Was soll ich überwachen?", apRecapLblPlatform:"Überwachung",
    apStepQCampaign:"Welche Kampagne?", apRecapLblCampaign:"Kampagne",
    apStepQCondition:"Wann soll ich reagieren?", apRecapLblCondition:"Bedingung",
    apStepQAction:"Was soll passieren?", apRecapLblAction:"Aktion",
    apStepReview:"Überprüfen", apModeQuestion:"Wie soll ich damit umgehen?", apRecapEdit:"Ändern",
    statusActive:"Aktiv", statusPaused:"Pausiert", apNamePlaceholder:"Diese Automatisierung benennen (optional)",
    apHistorySearchPlaceholder:"Verlauf durchsuchen…", apContinueBtn:"Weiter", apTestBtn:"Testen",
    apCreateAutomationBtn:"Automatisierung erstellen", apSaveChangesBtn:"Änderungen speichern", apStartOverBtn:"Von vorn beginnen", apByLabel:"um",
    apSetDefaultModeLabel:"Standardmodus für neue Regeln", apModeRequireApproval:"Genehmigung erforderlich",
    apModeSuggestOnly:"Nur vorschlagen", apModeFullyAutomatic:"Vollautomatisch",
    apNotifyEnabled:"Aktiviert", apNotifyDisabled:"Deaktiviert", apBriefTimeLabel:"Uhrzeit für tägliches Briefing",
    apMetricRoas:"ROAS", apMetricCtr:"CTR", apMetricCpc:"CPC", apMetricCpa:"CPA", apMetricConversions:"Conversions",
    apMetricSpend:"Ausgaben", apMetricClicks:"Klicks", apMetricImpressions:"Impressionen", apMetricBudget:"Budget", apMetricStatus:"Kampagnenstatus",
    apOpGreaterThan:"ist größer als", apOpLessThan:"ist kleiner als", apOpEquals:"ist gleich", apOpAtLeast:"ist mindestens", apOpAtMost:"ist höchstens",
    apActionIncreaseBudget:"Budget erhöhen", apActionDecreaseBudget:"Budget senken", apActionPause:"Kampagne pausieren",
    apActionResume:"Kampagne fortsetzen", apActionGenCreative:"Neues Creative generieren", apActionGenRecs:"KI-Empfehlungen generieren",
    apActionNotify:"Mich benachrichtigen", apActionRequestApproval:"Genehmigung anfordern", apActionCreateReport:"Bericht erstellen",
    apActionCreateBriefing:"Briefing erstellen", apActionRunOptimisation:"KI-Optimierung ausführen",
    apModeAskFirst:"Mich zuerst fragen", apModeAskFirstDesc:"Du genehmigst jedes Mal",
    apModeSuggestIt:"Nur vorschlagen", apModeSuggestItDesc:"Keine automatische Aktion",
    apModeHandleAuto:"Automatisch erledigen", apModeHandleAutoDesc:"Keine Genehmigung nötig",
    apAllCampaigns:"Alle Kampagnen", apAllCampaignsDesc:"Jede Kampagne auf dieser Plattform", apJustThisCampaignDesc:"Nur diese Kampagne", apUnnamedCampaign:"Unbenannt",
    apErrNumeric:"Gib einen numerischen Wert ein (z. B. 4.0), keinen Text.", apErrPercent:"Gib einen Prozentsatz zwischen 1 und 100 ein.",
    apErrIncomplete:"Wähle zuerst eine Bedingung und eine Aktion aus.", apErrChooseStatus:"Wähle Aktiv oder Pausiert.",
    apErrSaveFirst:"Speichere die Automatisierung zuerst und teste sie dann.", apErrTestFailed:"Diese Regel konnte gerade nicht getestet werden.",
    apErrSaveFailed:"Diese Automatisierung konnte nicht gespeichert werden.", apErrLoadActiveFailed:"Deine Automatisierungen konnten nicht geladen werden.",
    apErrLoadHistoryFailed:"Der Verlauf konnte nicht geladen werden.",
    apEmptyActiveText:"Du hast noch keine Automatisierungen erstellt. Lass uns die Routinearbeit gemeinsam automatisieren.",
    apEmptyHistoryText:"Noch keine Automatisierungsaktivität.",
    apExampleBudgetRoas:"Budget erhöhen, wenn ROAS über 4 liegt", apExamplePauseNoConv:"Kampagnen ohne Conversions pausieren",
    apExampleDailyBriefing:"Ein tägliches Briefing erstellen", apExampleNotifyCtr:"Mich benachrichtigen, wenn CTR sinkt",
    apNeverRun:"Nie", apStatusRunning:"Aktiv", apLastExecutedPrefix:"Zuletzt ausgeführt:",
    apDisableBtn:"Deaktivieren", apEnableBtn:"Aktivieren", apDeleteBtn:"Löschen",
    apAwaitingYourApproval:"Wartet auf deine Genehmigung", dateToday:"Heute", dateYesterday:"Gestern", dateDaysAgoSuffix:"Tage her", apDateEarlier:"Früher",
    apAwaitingApproval:"Wartet auf Genehmigung", apApproveBtn:"Genehmigen", apRejectBtn:"Ablehnen",
    apSuggestSetupBtn:"Einrichten",
    apReviewIllMonitor:"Ich überwache", apReviewAllCampaignsOf:"alle deine", apReviewCampaignsPlural:"Kampagnen",
    apReviewWhenever:"Sobald", apReviewIs:"ist", apReviewIllComma:", werde ich",
    apReviewModeFullyAuto:" Ich erledige das automatisch — du wirst danach benachrichtigt.",
    apReviewModeSuggest:" Ich markiere es nur als Vorschlag, ohne Aktion.",
    apReviewModeApproval:" Ich hole zuerst deine Genehmigung ein.",
    apErrBudgetUnsupported:"Budgetänderungen sind auf", apYetSuffix:"noch nicht verfügbar",
    apTestingAgainstData:"Wird mit deinen echten Kampagnendaten getestet…", apWouldTriggerNow:"Würde jetzt ausgelöst werden",
    apCheckedCampaignsPrefix:"Geprüft:", apCampaignSingular:"Kampagne", apCampaignPlural:"Kampagnen",
    apNoneMatchCondition:"keine erfüllt derzeit diese Bedingung.",
    apRuleSentenceWhen:"Wenn", apRuleSentenceOrivenWill:", wird Oriven",
    bizTabOverview:"Übersicht", bizTabBusiness:"Unternehmen", bizTabProducts:"Produkte", bizTabMarket:"Markt",
    bizTabBrand:"Marke", bizTabConnections:"Verbindungen", bizTabMemory:"Gedächtnis",
    bizLearningLabel:"Lernen", bizGetReflectionBtn:"Analyse abrufen", bizInsightsLabel:"Unternehmenseinblicke",
    bizKnowledgeCheckLabel:"Wissensprüfung", bizRunCheckBtn:"Wissensprüfung durchführen",
    bizProductsHeading:"Produkte", bizAddProductBtn:"+ Produkt hinzufügen",
    bizAudienceHeading:"Zielgruppe", bizAddAudienceBtn:"+ Zielgruppe hinzufügen",
    bizCompetitorsHeading:"Wettbewerber", bizAddCompetitorBtn:"+ Wettbewerber hinzufügen",
    bizProfileCardTitle:"Unternehmensprofil", bizProfileCardSub:"Die Grundlagen — wer du bist, was du tust und wohin du dich entwickelst.",
    bizWebsiteCardTitle:"Website", bizWebsiteCardSub:"Was Oriven durch das Lesen deiner Website gelernt hat.",
    bizFieldWebsiteUrl:"Website-URL", bizAnalyseWebsiteBtn:"Meine Website analysieren", bizRefreshAnalysisBtn:"Analyse aktualisieren",
    bizVoiceCardTitle:"Markenstimme", bizVoiceCardSub:"Wähle die Eigenschaften, die beschreiben, wie deine Marke klingt. Oriven verwendet diese in jeder Überschrift und jedem Skript, das es schreibt.",
    bizConnectionsIntro:"Deine Werbeplattformen. Verbinde ein Konto, und Oriven kann Kampagnen darauf direkt lesen und verwalten.",
    bizMemoryIntro:"Alles, was Oriven unterwegs gelernt hat — aus Gesprächen und aus dem, was funktioniert hat. Dies ist Orivens Langzeitgedächtnis über dein Unternehmen.",
    bizEmptyMemory:"Noch nichts gespeichert — das baut sich auf, während du Oriven nutzt.", bizMemoryDeleteBtn:"Löschen",
    bizVcardEditBtn:"Bearbeiten", bizVcardDeleteBtn:"Löschen", bizVcardSaveBtn:"Speichern", bizVcardCloseBtn:"Schließen",
    bizVcardEmptyDetails:"Noch keine Details — klicke auf Bearbeiten, um sie auszufüllen.",
    conNotConnected:"Nicht verbunden", conStatusConnected:"Verbunden", conCheckingStatus:"Wird geprüft…",
    conDisconnectBtn:"Trennen", conAdAccountsHeader:"Werbekonten", conActiveBadge:"Aktiv", conSetActiveBtn:"Als aktiv festlegen",
    conConnectGoogleBtn:"Google Ads verbinden →", conConnectMetaBtn:"Meta Ads verbinden →", conConnectTiktokBtn:"TikTok Ads verbinden →",
    conDetailConnectedAccounts:"Verbundene Konten", conDetailConnectedBusinesses:"Verbundene Unternehmen",
    bizReadingWebsiteBtn:"Deine Website wird gelesen…",
    rangeToday:"Heute", rangeYesterday:"Gestern", rangeLast7Days:"Letzte 7 Tage", rangeLast30Days:"Letzte 30 Tage",
    rangeLast90Days:"Letzte 90 Tage", rangeThisMonth:"Diesen Monat", rangeLastMonth:"Letzten Monat",
    rangeLast12Months:"Letzte 12 Monate", rangeLifetime:"Gesamter Zeitraum", rangeCustom:"Benutzerdefinierter Zeitraum…",
    tiktokAnalyticsTitle:"TikTok-Analysen", tiktokAnalyticsComingSub:"Analysen werden verfügbar, sobald dein TikTok Ads-Konto verbunden ist.",
    connectBannerTitle:"Verbinde deine Werbekonten, um Live-Analysen freizuschalten",
    connectBannerSub:"Verknüpfe Google Ads, Meta Ads oder TikTok Ads, um Ausgaben, ROAS und Conversions in Echtzeit zu verfolgen.",
    connectAccountsBtn:"Konten verbinden →",
    kpiTotalSpend:"Gesamtausgaben", kpiImpressions:"Impressionen", kpiClicks:"Klicks", kpiConversions:"Conversions", kpiRoas:"ROAS",
    kpiChgPlaceholder:"— ggü. letztem Zeitraum",
    chartSpendOverTime:"Ausgaben im Zeitverlauf", chartLockConnectLive:"Verbinde ein Konto, um Live-Daten zu sehen", chartLockConnectUnlock:"Zum Freischalten verbinden",
    chartRoasOverTime:"ROAS im Zeitverlauf", chartCtrOverTime:"CTR im Zeitverlauf",
    orivenScoreTitle:"Oriven-Score", orivenScoreSub:"KI-gestützte Kontogesundheit · 0–100",
    aiAnalysisTitle:"KI-Analyse", aiAnalysisDefaultSummary:"Analysiere dieses Konto auf verschwendete Ausgaben, niedrige CTR, Conversion-Probleme und Skalierungsmöglichkeiten.",
    analyzeWithAiBtn:"Mit KI analysieren", aiSectionStrengths:"Stärken", aiSectionWeaknesses:"Schwächen",
    aiSectionRecommendations:"Empfehlungen", aiSectionExpectedImpact:"Erwartete Auswirkung", generateAdCopyBtn:"Anzeigentext generieren →",
    analyzingEllipsis:"Wird analysiert…", analysisFailed:"Analyse fehlgeschlagen", analysisFailedRetry:"Analyse fehlgeschlagen — bitte erneut versuchen", reanalyzeBtn:"Erneut analysieren",
    searchCampaignsPlaceholder:"Kampagnen suchen…", newCampaignBtnPlain:"Neue Kampagne", noCampaignsYetDot:"Noch keine Kampagnen.",
    noCampaignsYetSub:"Erstelle deine erste Kampagne über Erstellen. Beschreibe dein Produkt, und Oriven baut sofort eine vollständige Kampagne.",
    createCampaignArrowBtn:"Kampagne erstellen →", noCampaignsMatchSearch:"Keine Kampagnen entsprechen deiner Suche.",
    continueWorkingHeader:"Weiterarbeiten",
    tiktokComingSoonSub:"Die TikTok-Integration kommt bald. Sobald deine TikTok-App genehmigt und verbunden ist, erscheinen deine Kampagnen hier.",
    smdHdTitle:"Einstellungen", smdNavGeneral:"Allgemein", smdNavSubscription:"Abo", smdNavNotifications:"Benachrichtigungen",
    smdNavAccount:"Konto", smdNavSecurity:"Sicherheit",
    smdWsNameLabel:"Arbeitsbereichsname", smdWsNameHelp:"Erscheint in der Seitenleiste und in der gesamten App.",
    smdThemeLabel:"Design", smdThemeLight:"Hell", smdThemeDark:"Dunkel", smdThemeSystem:"System", smdAccentLabel:"Akzentfarbe",
    smdLangLabel:"Anzeige- und Generierungssprache", smdLangHelp:"Gilt für Oberflächenbezeichnungen und KI-generierte Inhalte.",
    smdLoadingEllipsis:"Wird geladen…",
    smdNotifGenTitle:"Generierung abgeschlossen", smdNotifGenSub:"Benachrichtige mich, wenn die KI die Inhaltserstellung abgeschlossen hat.",
    smdNotifPubTitle:"Veröffentlichung abgeschlossen", smdNotifPubSub:"Benachrichtige mich, wenn Inhalte veröffentlicht wurden.",
    smdNotifBillTitle:"Abrechnungsaktualisierungen", smdNotifBillSub:"Hinweise zu Verlängerungen und Zahlungsaktivitäten.",
    smdNotifUpdTitle:"Produktaktualisierungen", smdNotifUpdSub:"In-App-Ankündigungen zu neuen Funktionen.",
    smdNotifApTitle:"Autopilot-Genehmigungen", smdNotifApSub:"Benachrichtige mich, wenn eine Empfehlung oder Automatisierungsregel deine Genehmigung benötigt.",
    smdSignedInWith:"Angemeldet mit", smdEmailLabel:"E-Mail-Adresse", smdEmailHelp:"Wird zum Anmelden und für Kontobenachrichtigungen verwendet.",
    smdChangePwTitle:"Passwort ändern", smdChangePwHelp:"Gib dein aktuelles Passwort ein und wähle dann ein neues.",
    smdCurrentPwPlaceholder:"Aktuelles Passwort", smdNewPwPlaceholder:"Neues Passwort (mind. 8 Zeichen)", smdConfirmPwPlaceholder:"Neues Passwort bestätigen",
    smdUpdatePwBtn:"Passwort aktualisieren", smdForgotPwTitle:"Passwort vergessen?",
    smdForgotPwHelp:"Sende dir stattdessen einen Zurücksetzungslink per E-Mail.", smdSendResetBtn:"Zurücksetzungs-E-Mail senden",
    smdDangerZoneTitle:"Gefahrenzone", smdSignOutTitle:"Abmelden", smdSignOutSub:"Auf diesem Gerät von ORIVEN abmelden.", smdSignOutBtn:"Abmelden",
    smdDeleteAcctTitle:"Konto löschen", smdDeleteAcctSub:"Entfernt dein Konto und alle Daten dauerhaft. Dies kann nicht rückgängig gemacht werden.", smdDeleteAcctBtn:"Konto löschen",
    smdHelpGeneralHelp:"Dein Arbeitsbereichsname, Design (hell/dunkel/System), Akzentfarbe und Oberflächensprache. Die Akzentfarbe gilt in der gesamten App — Hover-Zustände, aktive Tabs, Schaltflächen und Fokusringe. Änderungen werden automatisch gespeichert und sofort angewendet.",
    smdHelpSubHelp:"Dein aktueller Plan, deine Nutzung und Abrechnungsverwaltung. Upgrade, Downgrade oder Zahlungsdaten von hier aus verwalten.",
    smdHelpNotifHelp:"Steuere, welche Ereignisse eine Benachrichtigung auslösen — Generierung abgeschlossen, Veröffentlichung, Abrechnung, Produktaktualisierungen und Autopilot-Genehmigungen. Das Deaktivieren einer Kategorie verhindert, dass diese Benachrichtigungen überhaupt erstellt werden, nicht nur ausgeblendet.",
    smdHelpAcctHelp:"Deine Anmeldemethode und E-Mail-Adresse. Bei E-Mail-Änderungen muss die neue Adresse bestätigt werden, bevor sie wirksam wird.",
    smdHelpSecHelp:"Ändere dein Passwort direkt (aktuelles Passwort erforderlich) oder sende dir einen Zurücksetzungslink per E-Mail.",
    smdHelpBizHelp:"Verwalte deine Unternehmensdetails, Markenstimme, Zielgruppen und verbundenen Werbekonten über den Business-Arbeitsbereich — getrennt von den persönlichen Einstellungen, da er mit Teammitgliedern geteilt werden kann.",
    smdHelpApHelp:"Automatisierungsregeln, die ohne manuelles Eingreifen auf deine Kampagnen wirken. Empfehlungen, die deine Freigabe benötigen, erscheinen als Autopilot-Genehmigungsbenachrichtigungen, gesteuert im Tab Benachrichtigungen.",
    smdRestartObTitle:"Einführung neu starten",
    smdRestartObHelp:"Die geführte Produkttour von vorne abspielen. Nützlich für Demos oder eine Auffrischung.",
    smdRestartObBtn:"Einführung neu starten",
    helpTitle:"Hilfe", helpSub:"Was jeder Einstellungsbereich bewirkt.",
    builderResultLabel:"Ergebnis", regenerateBtn:"Neu generieren", saveToStudioBtn:"In Studio speichern"
  },

  zh:{
    dashboard:"主页", create:"创建", studio:"工作室",
    inspiration:"灵感", settings:"设置",
    goodMorning:"早上好", goodAfternoon:"下午好",
    goodEvening:"晚上好", goodNight:"晚安",
    brandAssistant:"品牌助手", openAIChat:"开始创建",
    savedAssets:"已保存文件", brandCore:"品牌核心",
    brandCheck:"品牌检查", campaigns:"活动",
    workspace:"工作区", plan:"您的方案", appearance:"外观", language:"语言",
    notifications:"通知", exportPref:"导出", brandReset:"重置品牌",
    themeLabel:"主题", lightMode:"浅色模式", darkMode:"深色模式",
    accentLabel:"强调色",
    accentHelp:"选择按钮、活动状态和界面元素使用的高亮颜色。",
    noItems:"暂无已保存文件",
    createContent:"在AI Chat中生成内容并保存到此处。",
    welcomeMsg:"今天我能如何支持您的品牌？",
    createSub:"选择创建类型开始。您的品牌核心塑造每个输出。",
    imageTitle:"图片",    imageDesc:"创建视觉内容、海报和社交媒体设计。",
    textTitle:"文本",     textDesc:"生成标题、说明文字和品牌文案。",
    campaignTitle:"活动", campaignDesc:"构建包含视觉和文案的完整活动。",
    videoTitle:"视频",    videoDesc:"创建视频创意、脚本和概念。",
    webTitle:"网页",      webDesc:"构建品牌一致的落地页和网页资产。",
    assistantDesc:"向您的品牌AI寻求指导、创意和方向。",
    comingSoon:"即将推出",
    brandWorkspace:"品牌工作区", signOut:"退出登录",
    dashHeadlinePrefix:"您的品牌已", dashHeadlineHighlight:"就绪。",
    dashTagline:"让我们将其转化为内容、广告和增长。",
    dashCreateLabel:"创建内容",   dashCreateDesc:"图片、文案、视频脚本等。",
    dashIdeasLabel:"探索创意",    dashIdeasDesc:"内容创意、广告角度和活动概念。",
    dashCampaignLabel:"构建活动", dashCampaignDesc:"从头到尾的完整多渠道活动。",
    dashBrandLabel:"编辑品牌核心", dashBrandDesc:"颜色、字体、语调和品牌标识。",
    edit:"编辑", setUp:"设置", notConfigured:"未配置",
    buildBrandIdentity:"构建您的品牌标识以开始使用。",
    setUpBrandCore:"设置您的品牌核心 →",
    createH1Line1:"您今天想", createH1Line2:"创建什么？",
    brandStudioTitle:"品牌工作室", brandStudioSub:"定义和驱动您品牌的一切。",
    studioSavedLabel:"已保存", studioSavedDesc:"您所有生成的内容和文件。",
    studioBCDesc:"颜色、字体、语调和品牌标识。",
    studioCheckLabel:"品牌检查", studioCheckDesc:"分析内容的品牌一致性。",
    studioCampDesc:"管理和启动您的活跃活动。",
    studioBackBtn:"返回",
    noBCConfigured:"尚未配置品牌核心",
    noBCConfiguredSub:"设置您的品牌标识以解锁AI生成功能。",
    aiGenerateBtn:"AI生成", manualSetupBtn:"手动设置",
    savedAssetsHeader:"已保存文件", openAIChatBtn:"打开AI聊天",
    noCampaignsTitle:"尚无活动",
    noCampaignsSub:"将保存的文件捆绑到视觉活动概念中。",
    newCampaignBtn:"+ 新活动",
    dropImageTitle:"将图片拖放至此", dropImageSub:"PNG、JPG或WEBP — 拖放或点击浏览",
    checkBrandNoImgBtn:"无图片品牌检查", readyForCheck:"准备好进行品牌检查",
    runBrandCheckBtn:"运行品牌检查", resetBtn:"重置", removeBtn:"删除",
    analyzingBrand:"分析品牌一致性...", checkingDetails:"检查颜色、排版和视觉风格",
    ideasTitle:"创意", ideasSub:"经过验证的框架，激发您的下一个内容。",
    contentIdeasLabel:"内容创意",    contentIdeasDesc:"构建受众的帖子、故事和格式。",
    adAnglesLabel:"广告角度",        adAnglesDesc:"将注意力转化为行动的消息框架。",
    visualStylesLabel:"视觉风格",    visualStylesDesc:"品牌视觉标识的美学方向。",
    campaignConceptsLabel:"活动概念",campaignConceptsDesc:"产生真实结果的端到端结构。",
    idContentTitle:"内容创意",    idAnglesTitle:"广告角度",
    idVisualTitle:"视觉风格",     idCampaignTitle:"活动概念",
    idContentUseLabel:"使用此创意",       idContentGenLabel:"生成帖子",
    idAnglesUseLabel:"尝试此角度",        idAnglesGenLabel:"生成广告",
    idVisualUseLabel:"使用此风格",        idVisualGenLabel:"生成视觉",
    idCampaignUseLabel:"构建此活动",      idCampaignGenLabel:"生成素材",
    idCont0Label:"教育帖子",     idCont1Label:"产品聚焦",
    idCont2Label:"创始人故事",   idCont3Label:"转型故事",
    idCont4Label:"客户结果",     idCont5Label:"对比帖子",
    idCont6Label:"神话与真相",   idCont7Label:"前后对比",
    idCont8Label:"日常/工作流",  idCont9Label:"权威建设",
    idAng0Label:"问题→解决方案", idAng1Label:"愿景",
    idAng2Label:"转型",          idAng3Label:"紧迫性",
    idAng4Label:"稀缺性",        idAng5Label:"痛点激化",
    idAng6Label:"社会证明",      idAng7Label:"高端定位",
    idAng8Label:"利益优先",      idAng9Label:"情感钩子",
    idVis0Label:"奢华极简",      idVis1Label:"大胆现代",
    idVis2Label:"暗色高端",      idVis3Label:"柔和生活方式",
    idVis4Label:"编辑清洁",      idVis5Label:"高对比度",
    idVis6Label:"未来简约",      idVis7Label:"有机自然",
    idVis8Label:"运动表现",      idVis9Label:"优雅女性",
    idCamp0Label:"产品发布",     idCamp1Label:"品牌知名度",
    idCamp2Label:"季节性活动",   idCamp3Label:"转化推广",
    idCamp4Label:"教育漏斗",     idCamp5Label:"再营销序列",
    idCamp6Label:"限时冲刺",     idCamp7Label:"创始人主导活动",
    idCamp8Label:"证言驱动",     idCamp9Label:"社区活动",
    teamTitle:"团队", teamSub:"管理您的Business工作区团队。",
    settingsTitle:"设置", settingsSub:"管理您的工作区和偏好。",
    spWorkspaceSub:"管理您的品牌工作区详细信息和偏好。",
    wsNameLabel:"工作区名称",
    wsNameHelp:"这是您在ORIVEN中的工作区名称。它出现在您的侧边栏和整个应用程序中。",
    saveBtn:"保存",
    brandLockLabel:"品牌锁定", lockBCLabel:"锁定BrandCore",
    lockBCSub:"启用后，您的BrandCore保持固定并一致应用于所有生成的内容。",
    spAppearanceSub:"选择ORIVEN的外观和感觉。您的偏好会在会话间保存。",
    spLanguageSub:"为您的工作区设置显示和内容生成语言。",
    langDisplayLabel:"显示和生成语言",
    langDisplayHelp:"ORIVEN将使用此语言显示界面标签并使用您的BrandCore生成内容。",
    spNotificationsSub:"控制应用内通知。更改立即保存。",
    notifBrandCheckLabel:"品牌检查提醒",
    notifBrandCheckSub:"当您的品牌得分低于70%时显示通知。",
    notifGenCompleteLabel:"生成完成",
    notifGenCompleteSub:"当AI完成内容生成时通知您。",
    notifUpdatesLabel:"产品更新",
    notifUpdatesSub:"在应用内接收关于新ORIVEN功能和改进的公告。",
    spExportTitle:"导出偏好", spExportSub:"控制如何为导出准备您的生成内容。",
    expFormatLabel:"默认导出格式",
    expFormatHelp:"选择下载生成素材时的默认文件格式。",
    autoSaveLabel:"自动保存生成的内容",
    autoSaveSub:"自动将您的工作区更改和生成内容保存到Studio。",
    spDangerSub:"永久操作 — 无法撤销。",
    resetBCTitle:"重置品牌核心",
    resetBCDesc:"这将重置你的整个品牌设置——颜色、语调、定位和身份数据。已保存在 Studio 中的生成资源不会受到影响，但在你创建新的 BrandCore 之前，未来的所有生成内容都将失去品牌背景信息。此操作是永久性的，无法撤销。",
    resetBCBtn:"重置品牌核心",
    navLaunch:"启动", navCampaigns:"广告系列", navIntelligence:"智能", navAutopilot:"自动驾驶", navBusiness:"业务", navSettings:"设置",
    wsTitleIntelligence:"智能", wsSubIntelligence:"今天值得关注的内容。",
    wsTitleBusiness:"业务", wsSubBusiness:"教会Oriven了解您的业务一次——之后每次营销活动、对话和建议都会自动使用它。",
    wsTitleAutopilot:"自动驾驶", wsSubAutopilot:"自动化重复的广告工作，仅此而已。",
    wsTitlePerformance:"表现", wsSubPerformance:"您的广告系列表现如何？",
    wsTitleCampaigns:"广告系列", wsSubCampaigns:"管理您的广告系列——草稿、进行中和已归档。",
    helpTitle:"帮助", helpSub:"每个设置部分的作用。",
    builderResultLabel:"结果", regenerateBtn:"重新生成", saveToStudioBtn:"保存到Studio"
  }
};

function t(key){
  var lang = LANG_STRINGS[CURRENT_LANG] || LANG_STRINGS.en;
  return lang[key] || LANG_STRINGS.en[key] || key;
}

function setLanguage(lang){
  CURRENT_LANG = lang;
  saveSettings({ language: lang });
  applyLanguage();
  var langSel = document.getElementById("langSelect");
  var label   = langSel ? langSel.options[langSel.selectedIndex].text : lang;
  toast("Language saved — " + label);
}

// Central translation applier — processes every [data-i18n] element in the DOM
// plus special cases that can't use data-i18n (sidebar nav, studio tabs, etc.)
function applyLanguage(){
  // ── [data-i18n] elements — covers Create, Settings, and any future elements ──
  document.querySelectorAll("[data-i18n]").forEach(function(el){
    var key = el.getAttribute("data-i18n");
    var str = t(key);
    if(str && str !== key) el.textContent = str;
  });

  // ── [data-i18n-placeholder] — same mechanism, targets the placeholder
  // attribute instead of textContent, for inputs/textareas/search fields.
  // One centralized convention so future pages get placeholder translation
  // for free instead of each page wiring its own JS. ──────────────────────
  document.querySelectorAll("[data-i18n-placeholder]").forEach(function(el){
    var key = el.getAttribute("data-i18n-placeholder");
    var str = t(key);
    if(str && str !== key) el.placeholder = str;
  });

  // ── [data-i18n-title] — same mechanism, targets the title attribute
  // (tooltips) instead of textContent. ─────────────────────────────────────
  document.querySelectorAll("[data-i18n-title]").forEach(function(el){
    var key = el.getAttribute("data-i18n-title");
    var str = t(key);
    if(str && str !== key) el.title = str;
  });

  // ── Sidebar nav labels (legacy .ni — retired but still present in DOM) ──────
  document.querySelectorAll(".ni span").forEach(function(el){
    var ni   = el.closest(".ni");
    var page = ni ? ni.getAttribute("data-page") : null;
    if(page && t(page) !== page) el.textContent = t(page);
  });

  // ── Sidebar nav labels (Oriven 1.0 — current live sidebar) ──────────────────
  var orvNavMap = { create:"navLaunch", performance:"navCampaigns", intelligence:"navIntelligence", autopilot:"navAutopilot", businessbrain:"navBusiness" };
  document.querySelectorAll(".orv-ni[data-orv-page]").forEach(function(btn){
    var key = orvNavMap[btn.getAttribute("data-orv-page")];
    var label = btn.querySelector(".orv-ni-label");
    if(key && label && t(key) !== key) label.textContent = t(key);
  });
  var settingsLabel = document.querySelector('.orv-sb-bottom .orv-ni .orv-ni-label');
  if(settingsLabel && t("navSettings") !== "navSettings") settingsLabel.textContent = t("navSettings");

  // ── Workspace titles (Oriven 1.0 — current live pages) ───────────────────────
  // Business's own subtitle is intentionally NOT in this table anymore — it
  // now carries data-i18n="bizPageSub" like the rest of the Business page's
  // copy, and this selector-based table was silently overwriting that new
  // text back to the old wsSubBusiness string on every applyLanguage() call
  // (found via a live repro: text was correct straight out of the HTML
  // response, then flipped to the old sentence the instant DOMContentLoaded
  // fired _applySettingsToUI -> applyLanguage()). wsTitleBusiness is left in
  // place since the "Business" title text itself is unchanged.
  [
    ["#page-intelligence .orv-ph-title", "wsTitleIntelligence"], ["#page-intelligence .orv-ph-sub", "wsSubIntelligence"],
    ["#page-business-brain .orv-ph-title", "wsTitleBusiness"],
    ["#page-autopilot .asl-title", "wsTitleAutopilot"], ["#page-autopilot .asl-sub", "wsSubAutopilot"],
    ["#page-performance .prf-title", "wsTitlePerformance"], ["#page-performance .prf-sub", "wsSubPerformance"],
    ["#page-campaigns .camp-hub-title", "wsTitleCampaigns"], ["#page-campaigns .camp-hub-sub", "wsSubCampaigns"]
  ].forEach(function(pair){
    var el = document.querySelector(pair[0]);
    var str = t(pair[1]);
    if(el && str !== pair[1]) el.textContent = str;
  });

  // ── Settings nav items ──────────────────────────────────────────────────────
  document.querySelectorAll(".snav-item").forEach(function(el){
    var sp = el.getAttribute("data-sp");
    if(sp && t(sp) !== sp) el.textContent = t(sp);
  });

  // ── Studio tabs ─────────────────────────────────────────────────────────────
  var tabMap = { saved:"savedAssets", brandcore:"brandCore", check:"brandCheck", campaigns:"campaigns" };
  document.querySelectorAll(".stab").forEach(function(el){
    var tab = el.getAttribute("data-tab");
    if(tab && tabMap[tab] && t(tabMap[tab]) !== tabMap[tab]) el.textContent = t(tabMap[tab]);
  });

  // ── Dashboard headline (mixed content — rebuilt via JS) ────────────────────
  var hEl = document.getElementById("dashHeadline");
  if(hEl) hEl.innerHTML = t("dashHeadlinePrefix") + ' <span class="dash-hl-grad" id="dashHeadlineWord">' + t("dashHeadlineHighlight") + '</span>';

  // ── Dashboard (snapshot, FAB) ───────────────────────────────────────────────
  if(typeof refreshDash === "function") refreshDash();
  var fabTag = document.getElementById("fabBCTag");
  if(fabTag && S.brandCore) fabTag.textContent = S.brandCore.name + " " + t("brandCore");

  // ── Idea panel — re-render if one is currently open ────────────────────────
  if(typeof idShowPanel === "function" && typeof S !== "undefined" && S._currentIdPanel){
    idShowPanel(S._currentIdPanel);
  }

  // ── Studio empty state ──────────────────────────────────────────────────────
  var emptyTtl = document.querySelector("#assetEmpty .empty-ttl");
  if(emptyTtl) emptyTtl.textContent = t("noItems");
  var emptySub = document.querySelector("#assetEmpty .empty-sub");
  if(emptySub) emptySub.textContent = t("createContent");
}


// ════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════

function toggleNotif(el, key){
  el.classList.toggle("on");
  var patch = {};
  patch[key] = el.classList.contains("on");
  saveSettings(patch);
  toast("Notifications updated");
}

// Gate for whether a given notification category (notifGenComplete, notifPublish,
// notifBilling, notifUpdates, notifAutopilot) is enabled. Defaults to true when
// settings aren't loaded yet or the key hasn't been set, so nothing regresses
// for users who haven't touched the toggle.
window.notifAllowed = function(key){
  try{
    if(typeof loadSettings !== "function") return true;
    return loadSettings()[key] !== false;
  }catch(e){ return true; }
};


// ════════════════════════════════════════════════════════════════
// INTELLIGENCE
// ════════════════════════════════════════════════════════════════

function toggleAILearning(el){
  el.classList.toggle("on");
  var on = el.classList.contains("on");
  saveSettings({ aiLearning: on });
  _updateHint("hintAILearning", on, "Future personalization active", "No history used for recommendations");
  toast(on ? "AI Learning enabled" : "AI Learning disabled");
}

function toggleBrandConsistency(el){
  el.classList.toggle("on");
  var on = el.classList.contains("on");
  saveSettings({ brandConsistency: on });
  _updateHint("hintBrandConsistency", on, "Maximum brand consistency", "Creative freedom enabled");
  toast(on ? "Brand Consistency Mode on" : "Creative freedom mode on");
}

function getBrandConsistency(){
  return loadSettings().brandConsistency !== false;
}


// ════════════════════════════════════════════════════════════════
// WORKSPACE SETTINGS
// ════════════════════════════════════════════════════════════════

function toggleGenHistory(el){
  el.classList.toggle("on");
  var on = el.classList.contains("on");
  saveSettings({ generationHistory: on });
  _updateHint("hintGenHistory", on, "History is being saved", "Generations are not stored");
  toast(on ? "Generation history enabled" : "Generation history disabled");
}

function toggleAutoSave(el){
  el.classList.toggle("on");
  var on = el.classList.contains("on");
  saveSettings({ autoSave: on });
  _updateHint("hintAutoSave", on, "BrandCore changes are saved automatically", "Save manually required");
  toast(on ? "Auto-save enabled" : "Auto-save disabled — save manually");
}

function setGeneratorView(view){
  saveSettings({ generatorView: view });
  _applyGeneratorView(view);
  toast(view === "compact" ? "Compact view enabled" : "Grid view enabled");
}

function _applyGeneratorView(view){
  var grid = document.querySelector(".cr-grid");
  if(grid) grid.classList.toggle("cr-compact", view === "compact");
  document.querySelectorAll(".view-opt").forEach(function(el){
    el.classList.toggle("active", el.dataset.view === view);
  });
}


// ════════════════════════════════════════════════════════════════
// PLAN MANAGEMENT
// ════════════════════════════════════════════════════════════════

function initPlan(){
  var cfg = loadSettings();
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // First run: seed the renewal date (30 days from today)
  if(!cfg.planRenewalDate){
    var first = new Date(today);
    first.setMonth(first.getMonth() + 1);
    saveSettings({ planRenewalDate: first.toISOString() });
    cfg = loadSettings();
  }

  // Check if a scheduled plan change is due
  var renewal = new Date(cfg.planRenewalDate);
  renewal.setHours(0, 0, 0, 0);
  if(cfg.pendingPlan && today >= renewal){
    var next = new Date(renewal);
    next.setMonth(next.getMonth() + 1);
    saveSettings({
      currentPlan:     cfg.pendingPlan,
      planRenewalDate: next.toISOString(),
      pendingPlan:     null,
      pendingPlanDate: null
    });
    cfg = loadSettings();
  }

  // Sync sidebar — ONLY use Supabase-authoritative value (_dbSubscriptionStatus).
  // Do NOT fall back to localStorage: a stale cached plan hides profile load errors.
  // auth.js will call _updateSidebarPlan() with the real value once the DB responds.
  if(typeof _dbSubscriptionStatus !== "undefined" && _dbSubscriptionStatus !== null){
    _updateSidebarPlan(_dbSubscriptionStatus);
  }
  renderPlanPanel();
}

async function switchPlan(planId){
  var cfg = loadSettings();
  // Bug fix: this used to compare against cfg.currentPlan (the localStorage
  // cache) only. renderPlanPanel()/initPlan() already established the real
  // rule elsewhere in this file — _dbSubscriptionStatus (Supabase-authoritative,
  // set in auth.js) must win when available, because the cache can be stale
  // relative to the DB (e.g. a plan changed directly in Supabase, as with a
  // manually-upgraded test account) even though auth.js normally re-syncs it
  // on profile load. Using the stale cache here made the free/paid branch
  // below (and the schedule-plan-change call) decide against the wrong
  // "current" plan.
  var actualPlan = (typeof _dbSubscriptionStatus !== "undefined" && _dbSubscriptionStatus !== null)
    ? _dbSubscriptionStatus
    : (typeof S !== "undefined" && S && S.currentPlan) ? S.currentPlan : cfg.currentPlan;
  if(planId === actualPlan){
    toast("You're already on this plan", "warn");
    return;
  }
  if(cfg.pendingPlan === planId){
    toast("This change is already scheduled", "warn");
    return;
  }

  var planData = ORIVEN_PLAN_LIST.find(function(p){ return p.id === planId; });
  var name = planData ? planData.name : planId;

  // Disable buttons during async call
  var btns = document.querySelectorAll('[onclick*="switchPlan"]');
  btns.forEach(function(b){ b.disabled = true; });

  try {
    var sessionResult = await SB.auth.getSession();
    var session = sessionResult.data && sessionResult.data.session;

    if(!session){
      // Not authenticated — fall back to localStorage-only scheduling
      saveSettings({ pendingPlan: planId, pendingPlanDate: cfg.planRenewalDate });
      renderPlanPanel();
      toast("Scheduled: " + name + " starts " + _formatPlanDate(cfg.planRenewalDate));
      return;
    }

    // Unsubscribed → paid: use Stripe checkout instead of schedule-plan-change.
    // Same actualPlan fix as above — this decides which flow to use at all,
    // so it's the more critical of the two call sites.
    if(!ORIVEN_PLANS[actualPlan] && ORIVEN_PLANS[planId]){
      if(typeof selectPlan === "function") selectPlan(planId);
      return;
    }

    var planResult = await apiFetch("/api/schedule-plan-change", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + session.access_token
      },
      body: JSON.stringify({ plan: planId })
    });
    var data = planResult.data;

    if(!planResult.ok) throw new Error(data.error || "Server error");

    if(data.requiresCheckout){
      if(typeof selectPlan === "function") selectPlan(planId);
      return;
    }

    // Apply server response to local state
    if(data.subscription_status){
      // Plan was applied immediately (no active Stripe sub or fallback path)
      if(typeof S !== "undefined" && S) S.currentPlan = data.subscription_status;
      saveSettings({
        currentPlan:     data.subscription_status,
        pendingPlan:     null,
        pendingPlanDate: null
      });
      if(typeof invalidatePlanCache === "function") invalidatePlanCache();
      renderPlanPanel();
      if(typeof _renderPaywallCards === "function") _renderPaywallCards();
      toast(name + " plan is now active");
    } else {
      saveSettings({
        pendingPlan:     data.pending_plan     || planId,
        pendingPlanDate: data.pending_plan_date || cfg.planRenewalDate
      });
      renderPlanPanel();
      toast("Scheduled: " + name + " starts " + _formatPlanDate(data.pending_plan_date || cfg.planRenewalDate));
    }

  } catch(err){
    console.error("[Plan] switchPlan error:", err.message);
    // Surface the real backend reason (e.g. "Active subscription required",
    // "Price not configured for plan: X") instead of a generic message that
    // hides which of several real failure modes actually happened.
    toast(err.message ? "Could not schedule plan change: " + err.message : "Could not schedule plan change — please try again", "err");
  } finally {
    btns.forEach(function(b){ b.disabled = false; });
  }
}

async function cancelPlanChange(){
  saveSettings({ pendingPlan: null, pendingPlanDate: null });
  renderPlanPanel();
  toast("Scheduled change cancelled");

  // Best-effort backend sync
  try {
    var sessionResult = await SB.auth.getSession();
    var session = sessionResult.data && sessionResult.data.session;
    if(!session) return;
    await fetch(API_BASE_URL+"/api/cancel-plan-change", {
      method: "POST",
      headers: { "Authorization": "Bearer " + session.access_token }
    });
  } catch(err){
    console.warn("[Plan] cancelPlanChange backend sync failed:", err.message);
  }
}

async function renderPlanPanel(){
  var container = document.getElementById("planPanelContent");
  if(!container) return;

  var cfg = loadSettings();
  var currentId;
  if(typeof _dbSubscriptionStatus !== "undefined" && _dbSubscriptionStatus !== null){
    currentId = _dbSubscriptionStatus;
  } else if(typeof S !== "undefined" && S && S.currentPlan){
    currentId = S.currentPlan;
  } else {
    currentId = null;
  }
  var pendingId   = (typeof S !== "undefined" && S && S.pendingPlan !== undefined) ? S.pendingPlan : (cfg.pendingPlan || null);
  var currentData = ORIVEN_PLAN_LIST.find(function(p){ return p.id === currentId; });
  var currentRank = currentData ? ORIVEN_PLAN_LIST.indexOf(currentData) : -1;

  _updateSidebarPlan(currentId);

  // Real, backend-authoritative credit status — the single source of
  // truth for everything below (credits_balance / credits_cycle_end on
  // profiles), not the old client-simulated renewal date / usage counters.
  var creditStatus = (typeof _getCreditStatus === "function") ? await _getCreditStatus(true) : null;
  var renewalStr   = creditStatus && creditStatus.resetDate ? _formatPlanDate(creditStatus.resetDate) : _formatPlanDate(cfg.planRenewalDate);

  // Usage stats — Connected Platforms reads the same window._gadsConnected/
  // _metaConnected/_tiktokConnected flags the navbar, Business Connections
  // tab, Campaigns page, and Autopilot monitoring all read (single source
  // of truth, populated by _conFetchStatus() from the real /api/{platform}/
  // status endpoints). Campaigns Generated / Saved Assets come from the
  // server-authoritative creditStatus payload below (profiles.campaigns_
  // generated / creative_assets count) -- NOT from S.campaigns/S.assets,
  // which are ephemeral in-memory arrays that reset on every login and
  // don't reflect real persisted data.
  var connCount = (window._gadsConnected ? 1 : 0) + (window._metaConnected ? 1 : 0) + (window._tiktokConnected ? 1 : 0);

  function _uRow(label, val, sub){
    return '<div class="sub-usage-row">'
      + '<div class="sub-usage-lbl">' + label + '</div>'
      + '<div class="sub-usage-right">'
      + '<div class="sub-usage-val">' + val + '</div>'
      + (sub ? '<div class="sub-usage-sub">' + sub + '</div>' : '')
      + '</div>'
      + '</div>';
  }

  var html = '';

  // ── Pending plan change / cancellation banner (only when relevant) ──
  if(pendingId && currentData){
    var pData = ORIVEN_PLAN_LIST.find(function(p){ return p.id === pendingId; });
    var pName = pData ? pData.name : pendingId;
    var pDate = _formatPlanDate(cfg.pendingPlanDate || cfg.planRenewalDate);
    var isCancel = pendingId === "free";
    html += '<div class="sub-pending-notice" style="margin-bottom:14px">';
    if(isCancel){
      html += 'Cancellation scheduled — access active until <strong>' + pDate + '</strong>';
      html += ' <button class="sub-undo-btn" onclick="cancelPlanChange()">Undo</button>';
    } else {
      html += 'Changing to <strong>' + pName + '</strong> on ' + pDate;
      html += ' <button class="sub-undo-btn" onclick="cancelPlanChange()">Cancel</button>';
    }
    html += '</div>';
  }

  // ── Section 1: the three real plans, side by side, current plan state
  //    baked into each card (isCurrent/isUp below) — this IS the plan
  //    display now, not a secondary "browse other plans" list underneath
  //    a separate current-plan card. ─────────────────────────────────
  html += '<div class="sub-plans-grid">';

  ORIVEN_PLAN_LIST.forEach(function(plan, rank){
    var isCurrent = plan.id === currentId;
    var isPending = plan.id === pendingId;
    var isUp      = rank > currentRank;

    html += '<div class="sub-pcard' + (isCurrent ? ' sub-pcard-active' : '') + '">';

    if(isCurrent){
      html += '<div class="sub-pcard-badge sub-pcard-badge-cur">Current Plan</div>';
    } else if(plan.popular){
      html += '<div class="sub-pcard-badge sub-pcard-badge-pop">Most Popular</div>';
    } else {
      html += '<div class="sub-pcard-badge-gap"></div>';
    }

    html += '<div class="sub-pcard-name">' + plan.name + '</div>';
    html += '<div class="sub-pcard-price">€' + plan.price + '<span class="sub-pcard-per">/mo</span></div>';
    if(isCurrent && renewalStr) html += '<div class="sub-renewal" style="margin:-4px 0 0">Renews ' + renewalStr + '</div>';

    // The three real economic differentiators between plans — everything
    // else (campaign/image/video generation, platform connections,
    // Business Brain, Brand Memory) is part of the product on every plan
    // and governed by the credit economy, not plan-gated, so it's
    // intentionally not listed here. No .toLocaleString() on plan.credits/
    // autopilotLimit -- these are the plan's own fixed numbers (500, 3000,
    // 12000, 10). Formatted via the one shared orvFormatCredits() (Dutch-
    // style dot separator, e.g. "12.000") rather than each call site
    // choosing its own format. Autopilot is measured in "executions", not
    // "users" -- and Starter (autopilotLimit: null) shows no Autopilot
    // line at all rather than advertising a feature it doesn't include.
    html += '<ul class="sub-pcard-feats">';
    html += '<li><strong>' + orvFormatCredits(plan.credits) + '</strong> AI Credits / month</li>';
    html += '<li>Intelligence: ' + plan.intelligence + '<span class="sub-feat-note"> · uses AI credits</span></li>';
    if(plan.autopilotLimit === Infinity){
      html += '<li>Autopilot: Unlimited</li>';
    } else if(typeof plan.autopilotLimit === 'number'){
      html += '<li>Autopilot: ' + orvFormatCredits(plan.autopilotLimit) + ' executions / month</li>';
    }
    // Starter (autopilotLimit === null): intentionally no Autopilot line.
    html += '</ul>';
    if(plan.id === 'professional'){
      html += '<ul class="sub-pcard-feats" style="margin-top:4px;opacity:.7">';
      html += '<li>Team — invite members &amp; collaborate</li>';
      html += '<li>Priority Support</li>';
      html += '<li>Up to ' + plan.teamMembers + ' Team Members</li>';
      html += '</ul>';
    }

    if(isCurrent){
      html += '<button class="sub-pcard-btn sub-pcard-btn-cur" disabled>Current Plan</button>';
    } else if(isPending){
      html += '<button class="sub-pcard-btn sub-pcard-btn-outline" disabled>Scheduled</button>';
    } else if(isUp || !currentData){
      html += '<button class="sub-pcard-btn sub-pcard-btn-up" onclick="switchPlan(\'' + plan.id + '\')">Upgrade</button>';
    } else {
      html += '<button class="sub-pcard-btn sub-pcard-btn-outline" onclick="switchPlan(\'' + plan.id + '\')">Downgrade</button>';
    }

    html += '</div>';
  });

  html += '</div>'; // end sub-plans-grid

  if(currentData && pendingId !== "free"){
    html += '<div style="margin-top:10px"><button class="sub-cancel-link" onclick="_showCancelConfirm()">Cancel plan</button></div>';
  }

  // ── Section 2: USAGE — real backend-authoritative data only. No
  //    fabricated numbers: if the status call failed, say so instead of
  //    rendering zeros (Part 11). ──────────────────────────────────────
  html += '<div class="sub-plans-sep"></div>';
  html += '<div class="sub-usage-card">';
  html += '<div class="sub-card-eyebrow">Usage</div>';

  if(creditStatus && typeof creditStatus.balance === 'number'){
    var used = Math.max(0, creditStatus.usedThisMonth || 0);
    var allowance = Math.max(1, creditStatus.monthlyAllowance || 1);
    var pct = Math.min(100, Math.round((used / allowance) * 100));
    html += '<div class="sub-credit-hd-row"><div class="sub-credit-hd-lbl">AI Credits</div><div class="sub-credit-hd-val">' + orvFormatCredits(used) + ' / ' + orvFormatCredits(creditStatus.monthlyAllowance || 0) + ' used</div></div>';
    html += '<div class="sub-credit-bar-track"><div class="sub-credit-bar-fill" style="width:' + pct + '%"></div></div>';
    html += '<div class="sub-credit-hd-sub">' + orvFormatCredits(Math.max(0, creditStatus.balance)) + ' remaining · resets ' + (renewalStr || '—') + '</div>';

    html += '<div class="sub-usage-list" style="margin-top:16px">';
    html += _uRow('Lifetime', (creditStatus.lifetimeUsed == null ? '—' : orvFormatCredits(creditStatus.lifetimeUsed)), 'AI credits consumed, all time');
    // Autopilot usage — only shown when the current plan has a real,
    // server-enforced cap (Creator). Starter never reaches this (no
    // Autopilot at all); Professional has no separate cap to show a
    // fraction against.
    if(creditStatus.autopilotUsage && typeof creditStatus.autopilotUsage.limit === 'number'){
      var apUsed = creditStatus.autopilotUsage.used || 0;
      var apLimit = creditStatus.autopilotUsage.limit;
      html += _uRow('Autopilot', orvFormatCredits(apUsed) + ' / ' + orvFormatCredits(apLimit), 'executions this month');
    }
    html += _uRow('Campaigns Generated', (typeof creditStatus.campaignsGenerated === 'number' ? orvFormatCredits(creditStatus.campaignsGenerated) : '—'), 'total in workspace');
    html += _uRow('Saved Assets', (typeof creditStatus.savedAssets === 'number' ? orvFormatCredits(creditStatus.savedAssets) : '—'), 'in your library');
    html += _uRow('Connected Platforms', connCount + ' / 3', connCount === 0 ? 'none connected' : connCount + ' platform' + (connCount === 1 ? '' : 's') + ' active');
    html += '</div>';
  } else {
    html += '<div class="sub-usage-unavailable">Couldn\'t load your usage right now. <button class="sub-cancel-link" style="text-decoration:underline" onclick="renderPlanPanel()">Try again</button></div>';
  }

  html += '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">';
  html += '<button class="btn btn-g btn-sm" onclick="navigate(\'integrations\')">Manage Integrations</button>';
  html += '<button class="btn btn-g btn-sm" disabled style="opacity:.5;cursor:not-allowed" title="Coming soon">Purchase Extra Credits — Coming Soon</button>';
  html += '</div>';
  html += '</div>';

  // ── AI usage is powered by credits — a compact, canonical reference so
  //    the cost of an action is understandable without listing generation
  //    types as plan features. Values come straight from
  //    creditStatus.featureCosts (creditManager.FEATURE_COSTS via
  //    /api/credits/status) — never duplicated as hardcoded numbers here. ──
  if(creditStatus && creditStatus.featureCosts){
    var fc = creditStatus.featureCosts;
    var costRows = [
      ['Campaign generation', fc.campaign_generation],
      ['Image generation', fc.image_generation],
      ['Video generation', fc.video_generation],
      ['Intelligence analysis', fc.ai_analysis],
      ['AI chat', fc.ai_chat],
    ].filter(function(r){ return typeof r[1] === 'number'; });
    html += '<div class="sub-usage-card" style="margin-top:16px">';
    html += '<div class="sub-card-eyebrow">AI Credit Usage</div>';
    html += '<div class="sub-usage-sub" style="margin:2px 0 12px">AI usage is powered by credits. Different AI actions consume different amounts of credits.</div>';
    html += '<div class="sub-usage-list">';
    costRows.forEach(function(r){ html += _uRow(r[0], r[1] + (r[1] === 1 ? ' credit' : ' credits'), ''); });
    html += '</div>';
    html += '</div>';
  }

  // ── Team — Professional only, real existing Team page/invite system
  //    (page-team, openInviteModal(), /api/send-invite -- not fabricated).
  //    Starter/Creator keep their own 1-seat workspace (unchanged, already
  //    server-enforced via _teamMax()); only Professional gets the
  //    dedicated invite-and-collaborate section surfaced here. ──
  if(currentId === 'professional'){
    html += '<div class="sub-usage-card" style="margin-top:16px">';
    html += '<div class="sub-card-eyebrow">Team</div>';
    html += '<div class="sub-usage-sub" style="margin:2px 0 12px">Invite team members and collaborate inside Oriven.</div>';
    html += '<button class="btn btn-p btn-sm" onclick="_orvNav(\'team\')">Manage Team</button>';
    html += '</div>';
  }

  // Priority Support — Professional plan only
  html += '<div id="prioritySupportPanel" class="sub-usage-card" style="margin-top:16px;display:' + (currentId === 'professional' ? '' : 'none') + '">';
  html += '<div class="sub-card-eyebrow">Priority Support</div>';
  html += '<div id="supportThread" style="max-height:260px;overflow-y:auto;margin:12px 0;display:flex;flex-direction:column;gap:8px"></div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<textarea id="supportMsgInput" rows="2" placeholder="Message the Oriven team..." style="flex:1;resize:vertical;border-radius:8px;padding:8px 10px;font-family:inherit"></textarea>';
  html += '<button class="btn btn-p btn-sm" onclick="sendSupportMessage()">Send</button>';
  html += '</div>';
  html += '</div>';
  if(currentId === 'professional' && typeof loadSupportThread === 'function') setTimeout(loadSupportThread, 0);

  // Cancel confirm dialog
  if(currentData && pendingId !== "free"){
    html += '<div class="plan-cancel-confirm" id="planCancelConfirm" style="display:none">';
    html += '<div class="plan-cancel-confirm-text">Cancel your <strong>' + currentData.name + '</strong> plan? You\'ll keep full access until <strong>' + renewalStr + '</strong>.</div>';
    html += '<div class="plan-cancel-confirm-btns">';
    html += '<button class="btn btn-danger btn-sm" onclick="switchPlan(\'free\')">Yes, Cancel Plan</button>';
    html += '<button class="btn btn-g btn-sm" onclick="_hideCancelConfirm()">Keep Plan</button>';
    html += '</div>';
    html += '</div>';
  }

  container.innerHTML = html;
}

function _showCancelConfirm(){
  var el = document.getElementById("planCancelConfirm");
  if(el) el.style.display = "";
}

// ── Priority Support chat (Professional plan only) ─────────────
function _supportBubbleHtml(msg){
  var mine = msg.sender === 'user';
  return '<div style="align-self:' + (mine ? 'flex-end' : 'flex-start') + ';max-width:80%;padding:8px 12px;border-radius:10px;background:' + (mine ? 'var(--accent,#B7FF2A)' : 'rgba(127,127,127,.15)') + ';color:' + (mine ? '#0A0A0A' : 'inherit') + ';font-size:13px;white-space:pre-wrap">' + String(msg.body || '').replace(/</g,'&lt;') + '</div>';
}

async function loadSupportThread(){
  var thread = document.getElementById('supportThread');
  if(!thread) return;
  try {
    var token = await _getAccessToken();
    if(!token) return;
    var resp = await fetch(API_BASE_URL + '/api/support/messages', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if(!resp.ok) return;
    var data = await resp.json();
    var msgs = (data && data.messages) || [];
    thread.innerHTML = msgs.length
      ? msgs.map(_supportBubbleHtml).join('')
      : '<div style="opacity:.6;font-size:13px">No messages yet — send one and the Oriven team will reply here.</div>';
    thread.scrollTop = thread.scrollHeight;
  } catch(_){}
}

async function sendSupportMessage(){
  var input = document.getElementById('supportMsgInput');
  if(!input) return;
  var body = input.value.trim();
  if(!body) return;
  input.disabled = true;
  try {
    var token = await _getAccessToken();
    if(!token) return;
    var resp = await fetch(API_BASE_URL + '/api/support/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ body: body })
    });
    if(resp.ok){
      input.value = '';
      await loadSupportThread();
    } else if(typeof toast === 'function') {
      toast('Could not send your message — please try again', 'warn');
    }
  } catch(_){
    if(typeof toast === 'function') toast('Could not send your message — please try again', 'warn');
  } finally {
    input.disabled = false;
  }
}

function _hideCancelConfirm(){
  var el = document.getElementById("planCancelConfirm");
  if(el) el.style.display = "none";
}

function _updateSidebarPlan(planId){
  var el = document.getElementById("sbPlanLabel");
  if(!el) return;
  var plan = ORIVEN_PLANS[planId];
  // If planId is a valid string but not in ORIVEN_PLANS (e.g. "agency"), capitalise it.
  // This way any plan stored in Supabase displays correctly without hardcoding.
  var name = plan ? plan.name
    : (planId && planId !== "free" ? planId.charAt(0).toUpperCase() + planId.slice(1) : "Free");
  el.textContent = name;
  el.className = "sb-plan-label sb-plan-" + (planId || "free");
  if(typeof window._orvUpdateTeamNavVisibility === "function") window._orvUpdateTeamNavVisibility();
}

function _formatPlanDate(iso){
  if(!iso) return "—";
  var d = new Date(iso);
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
}


// ════════════════════════════════════════════════════════════════
// SETTINGS NAV
// ════════════════════════════════════════════════════════════════

function _initSettingsNav(){
  var sNav = document.getElementById("sNav");
  if(!sNav) return;
  sNav.addEventListener("click", function(e){
    var item = e.target.closest(".snav-item");
    if(!item) return;
    document.querySelectorAll(".snav-item").forEach(function(x){ x.classList.remove("active"); });
    document.querySelectorAll(".spanel").forEach(function(x){ x.classList.remove("active"); });
    item.classList.add("active");
    var panel = document.getElementById("sp-" + item.getAttribute("data-sp"));
    if(panel) panel.classList.add("active");
    if(item.getAttribute("data-sp") === "integrations") initIntegrations();
  });
}


// ════════════════════════════════════════════════════════════════
// INTEGRATIONS
// ════════════════════════════════════════════════════════════════

// Global active ad account — set on login or when user selects an account.
// Shape: { platform: 'google_ads', account_id: '...', account_name: '...' } | null
window._activeAdAccount = window._activeAdAccount || null;

function initIntegrations(){
  // Show pending OAuth result (from Google or TikTok OAuth return redirect)
  var _oar = window._pendingOAuthResult;
  if(_oar){
    window._pendingOAuthResult = null;
    var _googleErrMap = {
      access_denied:  "Google sign-in was cancelled.",
      token_exchange: "Google connection failed — please try again.",
      invalid_state:  "Session expired — please try again.",
      db:             "Could not save connection — please try again.",
      network:        "Network error — please try again."
    };
    var _tiktokErrMap = {
      access_denied:  "TikTok sign-in was cancelled.",
      token_exchange: "TikTok connection failed — please try again.",
      invalid_state:  "Session expired — please try again.",
      db:             "Could not save connection — please try again.",
      network:        "Network error — please try again."
    };
    var _metaErrMap = {
      access_denied:    "Meta sign-in was cancelled.",
      token_exchange:   "Meta connection failed — please try again.",
      invalid_state:    "Session expired — please try again.",
      db:               "Could not save connection — please try again.",
      network:          "Network error — please try again.",
      not_configured:   "Meta Ads is not yet configured on the server.",
      missing_token:    "Authentication error — please try again.",
      invalid_token:    "Authentication error — please sign in and try again.",
      auth_error:       "Authentication error — please try again.",
      missing_params:   "OAuth error — please try again."
    };
    setTimeout(function(){
      if(_oar.provider === 'tiktok'){
        if(_oar.connected){
          toast("TikTok Ads connected successfully!");
        } else if(_oar.error){
          toast(_tiktokErrMap[_oar.error] || "TikTok connection failed.", "err");
        }
      } else if(_oar.provider === 'meta'){
        if(_oar.connected){
          toast("Meta Ads connected successfully!");
        } else if(_oar.error){
          toast(_metaErrMap[_oar.error] || "Meta connection failed.", "err");
        }
      } else {
        if(_oar.connected){
          toast("Google Ads connected successfully!");
        } else if(_oar.error){
          toast(_googleErrMap[_oar.error] || "Google connection failed.", "err");
        }
      }
    }, 100);
  }
  _loadGadsStatus();
  _loadTadsStatus();
  _loadMetaStatus();
}

async function _loadGadsStatus(){
  var connectBtn     = document.getElementById("gads-connect-btn");
  var connectedEl    = document.getElementById("gads-connected-info");
  var connectedBadge = document.getElementById("gads-connected-badge");
  var connectedHdr   = document.getElementById("intg-section-hdr-connected");
  if(connectBtn){ connectBtn.disabled = true; connectBtn.textContent = "Loading…"; }

  try {
    var result = await apiFetch("/api/google/status");
    if(!result.ok){
      if(connectBtn){ connectBtn.disabled = false; connectBtn.textContent = "Connect"; }
      var _statusErr = (result.data && result.data.error) || ("HTTP " + result.status);
      console.error("[Google Ads] /api/google/status failed:", _statusErr);
      if(typeof toast === "function"){
        toast("Could not load connection status (" + _statusErr + ") — please refresh or reconnect.", "err");
      }
      return;
    }
    var data = result.data;
    if(data.connected){
      if(connectBtn)     connectBtn.style.display     = "none";
      if(connectedBadge) connectedBadge.style.display = "";
      if(connectedEl)    connectedEl.style.display    = "";
      if(connectedHdr)   connectedHdr.style.display   = "";

      var emailEl  = document.getElementById("gads-email-val");
      var dateEl   = document.getElementById("gads-date-val");
      var statusEl = document.getElementById("gads-status-text");

      if(emailEl)  emailEl.textContent = data.google_email || "—";
      if(dateEl && data.connected_at){
        var d = new Date(data.connected_at);
        dateEl.textContent = d.toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
      }
      if(statusEl){
        var isExpired = data.status === "expired";
        statusEl.innerHTML = '<span class="int-status-dot' + (isExpired ? " int-status-warn" : "") + '"></span>'
          + (isExpired ? "Token expired — reconnect" : "Active");
      }

      // Persist active account from DB into local state
      if(data.active_ad_account && data.active_ad_account.account_id){
        window._activeAdAccount = data.active_ad_account;
      }

      var storedAccounts = data.google_ads_accounts || [];
      var activeId = window._activeAdAccount && window._activeAdAccount.account_id;
      if(storedAccounts.length > 0){
        _renderGadsAccounts(storedAccounts, activeId);
      } else {
        refreshGadsAccounts();
      }
    } else {
      if(connectBtn)     { connectBtn.disabled = false; connectBtn.textContent = "Connect"; connectBtn.style.display = ""; }
      if(connectedBadge) connectedBadge.style.display = "none";
      if(connectedEl)    connectedEl.style.display    = "none";
      if(connectedHdr)   connectedHdr.style.display   = "none";
    }
  } catch(err){
    if(connectBtn){ connectBtn.disabled = false; connectBtn.textContent = "Connect"; }
    console.error("[Google Ads] Status load failed:", err.message);
  }
}

function _renderGadsAccounts(accounts, activeAccountId){
  var wrap    = document.getElementById("gads-accounts-wrap");
  var listEl  = document.getElementById("gads-accounts-list");
  var errEl   = document.getElementById("gads-accounts-error");
  var loadEl  = document.getElementById("gads-accounts-loading");
  if(!wrap || !listEl) return;
  if(loadEl) loadEl.style.display = "none";
  if(errEl)  errEl.style.display  = "none";

  if(!accounts || accounts.length === 0){
    wrap.style.display = "none";
    if(errEl){ errEl.textContent = "No Google Ads accounts found. Make sure your Google account has access to a Google Ads account, then click Refresh accounts."; errEl.style.display = ""; }
    return;
  }
  if(errEl) errEl.style.display = "none";

  function h(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  var activeId = activeAccountId || (window._activeAdAccount && window._activeAdAccount.account_id) || null;

  // Auto-select the only eligible client account when nothing is active yet
  var clientAccounts = accounts.filter(function(a){ return !a.is_manager; });
  if(clientAccounts.length === 1 && !activeId){
    var solo = clientAccounts[0];
    activeId = String(solo.customer_id);
    selectGadsAccount(solo.customer_id, solo.name || solo.customer_id, false, solo.parent_manager_id || null, solo.status || null);
  }

  listEl.innerHTML = accounts.map(function(a){
    var isSelected = activeId && String(a.customer_id) === String(activeId);
    var isMcc      = !!a.is_manager;
    var meta = [];
    if(a.currency) meta.push(a.currency);
    if(a.timezone) meta.push(a.timezone);
    var safeId        = h(a.customer_id);
    var safeName      = h(a.name);
    var safeParentId  = h(a.parent_manager_id || '');
    var safeStatus    = h(a.status || '');

    var typeBadge = isMcc
      ? '<span class="int-account-type-badge int-account-type-mcc">Manager Account</span>'
      : '<span class="int-account-type-badge int-account-type-client">Client Account</span>';

    var onclick = isMcc
      ? 'if(typeof toast==="function")toast("Manager Accounts cannot run campaigns — select a Client Account instead.","err");'
      : 'selectGadsAccount(\'' + safeId + '\',\'' + safeName.replace(/'/g,'&apos;') + '\',' + isMcc + ',\'' + safeParentId + '\',\'' + safeStatus + '\')';

    return '<div class="int-account-row' + (isSelected ? ' int-account-selected' : '') + (isMcc ? ' int-account-row-mcc' : '') + '" onclick="' + onclick + '">'
      + '<div class="int-account-row-inner">'
      + '<div class="int-account-check">' + (isSelected ? '✓' : '') + '</div>'
      + '<div>'
      + '<div class="int-account-name">' + safeName + ' ' + typeBadge
      + (isSelected ? ' <span class="int-account-active-badge">Active</span>' : '') + '</div>'
      + '<div class="int-account-id">ID: ' + safeId + '</div>'
      + (meta.length ? '<div class="int-account-meta">' + h(meta.join(' \xb7 ')) + '</div>' : '')
      + (isMcc ? '<div class="int-account-mcc-warn">Manager Account — select a Client Account below to run ads</div>' : '')
      + '</div>'
      + '</div>'
      + '</div>';
  }).join('');

  wrap.style.display = "";
}

async function refreshGadsAccounts(){
  var btn    = document.getElementById("gads-refresh-btn");
  var loadEl = document.getElementById("gads-accounts-loading");
  var errEl  = document.getElementById("gads-accounts-error");
  var wrap   = document.getElementById("gads-accounts-wrap");
  if(btn)    { btn.disabled = true; btn.textContent = "Refreshing…"; }
  if(loadEl) { loadEl.style.display = ""; }
  if(errEl)  { errEl.style.display  = "none"; }
  if(wrap)   { wrap.style.display   = "none"; }

  try {
    var result = await apiFetch("/api/google/accounts");
    if(loadEl) loadEl.style.display = "none";
    if(!result.ok){
      var msg = (result.data && result.data.error) ? result.data.error : "Could not fetch accounts (HTTP " + result.status + ")";
      if(errEl){ errEl.textContent = msg; errEl.style.display = ""; }
    } else {
      try {
        var activeId = window._activeAdAccount && window._activeAdAccount.account_id;
        _renderGadsAccounts(result.data.accounts || [], activeId);
        var statusEl = document.getElementById("gads-status-text");
        if(statusEl) statusEl.innerHTML = '<span class="int-status-dot"></span>Active';
      } catch(renderErr){
        console.error("[Google Ads] Render error:", renderErr);
        if(errEl){ errEl.textContent = "Display error: " + renderErr.message; errEl.style.display = ""; }
      }
    }
  } catch(err){
    if(loadEl) loadEl.style.display = "none";
    var msg = err.message || "Network error — try again";
    if(errEl){ errEl.textContent = msg; errEl.style.display = ""; }
    console.error("[Google Ads] Account refresh failed:", err.message);
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = "Refresh accounts"; }
  }
}

async function connectGoogleAds(){
  var btn = document.getElementById("gads-connect-btn");
  if(btn){ btn.disabled = true; btn.textContent = "Connecting…"; }
  try {
    var result = await apiFetch("/api/google/auth-url");
    if(!result.ok){
      toast("Could not initiate Google connection — please try again.", "err");
      if(btn){ btn.disabled = false; btn.textContent = "Connect Google Ads"; }
      return;
    }
    window.location.href = result.data.url;
  } catch(err){
    toast("Connection error — please try again.", "err");
    if(btn){ btn.disabled = false; btn.textContent = "Connect Google Ads"; }
  }
}

async function disconnectGoogleAds(){
  var btn = document.getElementById("gads-disconnect-btn");
  if(btn){ btn.disabled = true; btn.textContent = "Disconnecting…"; }
  try {
    var result = await apiFetch("/api/google/disconnect", { method: "POST" });
    if(result.ok){
      toast("Google Ads disconnected.");
      window._activeAdAccount = null;

      var connectBtn     = document.getElementById("gads-connect-btn");
      var connectedEl    = document.getElementById("gads-connected-info");
      var connectedBadge = document.getElementById("gads-connected-badge");
      var connectedHdr   = document.getElementById("intg-section-hdr-connected");
      if(connectBtn)     { connectBtn.style.display = ""; connectBtn.disabled = false; connectBtn.textContent = "Connect"; }
      if(connectedEl)    connectedEl.style.display    = "none";
      if(connectedBadge) connectedBadge.style.display = "none";
      if(connectedHdr)   connectedHdr.style.display   = "none";
    } else {
      toast("Could not disconnect — please try again.", "err");
      if(btn){ btn.disabled = false; btn.textContent = "Disconnect"; }
    }
  } catch(err){
    toast("Disconnect failed — please try again.", "err");
    if(btn){ btn.disabled = false; btn.textContent = "Disconnect"; }
  }
}

async function selectGadsAccount(accountId, accountName, isManager, parentManagerId, status){
  if(isManager){
    if(typeof toast === 'function') toast('Manager Accounts cannot run campaigns — select a Client Account instead.', 'err');
    return;
  }

  // Optimistic UI: mark selected immediately before API round-trip
  window._activeAdAccount = {
    platform:          'google_ads',
    account_id:        String(accountId),
    account_name:      String(accountName || ''),
    is_manager:        false,
    parent_manager_id: parentManagerId || null,
    status:            status || null
  };
  document.querySelectorAll('.int-account-row').forEach(function(row){
    row.classList.remove('int-account-selected');
    var check = row.querySelector('.int-account-check');
    if(check) check.textContent = '';
    var badge = row.querySelector('.int-account-active-badge');
    if(badge) badge.remove();
    var nameEl = row.querySelector('.int-account-name');
    if(nameEl) nameEl.classList.remove('_has-active-badge');
  });
  // Find the clicked row by account ID text and highlight it
  document.querySelectorAll('.int-account-row').forEach(function(row){
    var idEl = row.querySelector('.int-account-id');
    if(idEl && idEl.textContent.indexOf(String(accountId)) !== -1){
      row.classList.add('int-account-selected');
      var check = row.querySelector('.int-account-check');
      if(check) check.textContent = '✓';
      var nameEl = row.querySelector('.int-account-name');
      if(nameEl && !nameEl.querySelector('.int-account-active-badge')){
        var badge = document.createElement('span');
        badge.className = 'int-account-active-badge';
        badge.textContent = 'Active';
        nameEl.appendChild(badge);
      }
    }
  });

  try {
    var result = await apiFetch('/api/google/active-account', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        account_id:        accountId,
        account_name:      accountName || '',
        is_manager:        false,
        parent_manager_id: parentManagerId || null,
        status:            status || null
      })
    });
    if(!result.ok){
      toast('Could not set active account — please try again.', 'err');
    }
  } catch(err){
    console.error('[Google Ads] selectGadsAccount error:', err.message);
    toast('Could not set active account — please try again.', 'err');
  }
}


// ════════════════════════════════════════════════════════════════
// TIKTOK ADS INTEGRATION
// ════════════════════════════════════════════════════════════════

async function _loadTadsStatus(){
  var connectBtn     = document.getElementById("tads-connect-btn");
  var connectedEl    = document.getElementById("tads-connected-info");
  var connectedBadge = document.getElementById("tads-connected-badge");
  if(connectBtn){ connectBtn.disabled = true; connectBtn.textContent = "Loading…"; }

  try {
    var result = await apiFetch("/api/tiktok/status");
    if(!result.ok){
      if(connectBtn){ connectBtn.disabled = false; connectBtn.textContent = "Connect"; }
      var _statusErr = (result.data && result.data.error) || ("HTTP " + result.status);
      console.error("[TikTok Ads] /api/tiktok/status failed:", _statusErr);
      return;
    }
    var data = result.data;
    if(data.connected){
      if(connectBtn)     connectBtn.style.display     = "none";
      if(connectedBadge) connectedBadge.style.display = "";
      if(connectedEl)    connectedEl.style.display    = "";

      var userEl   = document.getElementById("tads-user-val");
      var dateEl   = document.getElementById("tads-date-val");
      var statusEl = document.getElementById("tads-status-text");

      if(userEl)   userEl.textContent  = data.tiktok_display_name || "—";
      if(dateEl)   dateEl.textContent  = data.connected_at
        ? new Date(data.connected_at).toLocaleDateString()
        : "—";
      if(statusEl) statusEl.innerHTML  = '<span class="int-status-dot"></span>Active';

      // Render cached accounts from status response
      var storedAccounts = data.tiktok_ads_accounts || [];
      if(storedAccounts.length){
        _renderTadsAccounts(storedAccounts, data.active_ad_account && data.active_ad_account.account_id);
      } else {
        // No cached accounts — kick off a fresh fetch
        refreshTadsAccounts();
      }
    } else {
      if(connectBtn){ connectBtn.style.display = ""; connectBtn.disabled = false; connectBtn.textContent = "Connect"; }
      if(connectedBadge) connectedBadge.style.display = "none";
      if(connectedEl)    connectedEl.style.display    = "none";
    }
  } catch(err){
    if(connectBtn){ connectBtn.disabled = false; connectBtn.textContent = "Connect"; }
    console.error("[TikTok Ads] Status load failed:", err.message);
  }
}

function _renderTadsAccounts(accounts, activeAccountId){
  var wrap   = document.getElementById("tads-accounts-wrap");
  var listEl = document.getElementById("tads-accounts-list");
  var errEl  = document.getElementById("tads-accounts-error");
  var loadEl = document.getElementById("tads-accounts-loading");
  if(!wrap || !listEl) return;
  if(loadEl) loadEl.style.display = "none";
  if(errEl)  errEl.style.display  = "none";

  if(!accounts || accounts.length === 0){
    wrap.style.display = "none";
    if(errEl){ errEl.textContent = "No TikTok Ads accounts found. Make sure your account has access to a TikTok Ads Manager, then click Refresh accounts."; errEl.style.display = ""; }
    return;
  }

  function h(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var activeId = activeAccountId || (window._activeTadsAccount && window._activeTadsAccount.account_id) || null;

  // Auto-select sole account when nothing is active
  if(accounts.length === 1 && !activeId){
    var solo = accounts[0];
    activeId = String(solo.advertiser_id);
    selectTadsAccount(solo.advertiser_id, solo.advertiser_name || solo.advertiser_id, solo.currency || null);
  }

  listEl.innerHTML = accounts.map(function(a){
    var isSelected = activeId && String(a.advertiser_id) === String(activeId);
    var safeId   = h(a.advertiser_id);
    var safeName = h(a.advertiser_name || a.advertiser_id);
    var meta = [];
    if(a.currency) meta.push(a.currency);
    if(a.timezone) meta.push(a.timezone);
    return '<div class="int-account-row' + (isSelected ? ' int-account-selected' : '') + '" '
      + 'onclick="selectTadsAccount(\'' + safeId + '\',\'' + safeName.replace(/'/g,'&apos;') + '\',\'' + h(a.currency||'') + '\')">'
      + '<div class="int-account-row-inner">'
      + '<div class="int-account-check">' + (isSelected ? '✓' : '') + '</div>'
      + '<div>'
      + '<div class="int-account-name">' + safeName
      + (isSelected ? ' <span class="int-account-active-badge">Active</span>' : '') + '</div>'
      + '<div class="int-account-id">ID: ' + safeId + '</div>'
      + (meta.length ? '<div class="int-account-meta">' + h(meta.join(' · ')) + '</div>' : '')
      + '</div>'
      + '</div>'
      + '</div>';
  }).join('');

  wrap.style.display = "";
}

async function refreshTadsAccounts(){
  var btn    = document.getElementById("tads-refresh-btn");
  var loadEl = document.getElementById("tads-accounts-loading");
  var errEl  = document.getElementById("tads-accounts-error");
  var wrap   = document.getElementById("tads-accounts-wrap");
  if(btn)    { btn.disabled = true; btn.textContent = "Refreshing…"; }
  if(loadEl) { loadEl.style.display = ""; }
  if(errEl)  { errEl.style.display  = "none"; }
  if(wrap)   { wrap.style.display   = "none"; }

  try {
    var result = await apiFetch("/api/tiktok/accounts");
    if(loadEl) loadEl.style.display = "none";
    if(!result.ok){
      var msg = (result.data && result.data.error) ? result.data.error : "Could not fetch accounts (HTTP " + result.status + ")";
      if(errEl){ errEl.textContent = msg; errEl.style.display = ""; }
    } else {
      try {
        var activeId = window._activeTadsAccount && window._activeTadsAccount.account_id;
        _renderTadsAccounts(result.data.accounts || [], activeId);
      } catch(renderErr){
        console.error("[TikTok Ads] Render error:", renderErr);
        if(errEl){ errEl.textContent = "Display error: " + renderErr.message; errEl.style.display = ""; }
      }
    }
  } catch(err){
    if(loadEl) loadEl.style.display = "none";
    var msg = err.message || "Network error — try again";
    if(errEl){ errEl.textContent = msg; errEl.style.display = ""; }
    console.error("[TikTok Ads] Account refresh failed:", err.message);
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = "Refresh accounts"; }
  }
}

async function connectTikTokAds(){
  var btn = document.getElementById("tads-connect-btn");
  if(btn){ btn.disabled = true; btn.textContent = "Connecting…"; }
  try {
    var result = await apiFetch("/api/tiktok/auth-url");
    if(!result.ok){
      toast("Could not initiate TikTok connection — please try again.", "err");
      if(btn){ btn.disabled = false; btn.textContent = "Connect"; }
      return;
    }
    window.location.href = result.data.url;
  } catch(err){
    toast("Connection error — please try again.", "err");
    if(btn){ btn.disabled = false; btn.textContent = "Connect"; }
  }
}

async function disconnectTikTokAds(){
  var btn = document.getElementById("tads-disconnect-btn");
  if(btn){ btn.disabled = true; btn.textContent = "Disconnecting…"; }
  try {
    var result = await apiFetch("/api/tiktok/disconnect", { method: "POST" });
    if(result.ok){
      toast("TikTok Ads disconnected.");
      window._activeTadsAccount = null;

      var connectBtn     = document.getElementById("tads-connect-btn");
      var connectedEl    = document.getElementById("tads-connected-info");
      var connectedBadge = document.getElementById("tads-connected-badge");
      if(connectBtn)     { connectBtn.style.display = ""; connectBtn.disabled = false; connectBtn.textContent = "Connect"; }
      if(connectedEl)    connectedEl.style.display    = "none";
      if(connectedBadge) connectedBadge.style.display = "none";
    } else {
      toast("Could not disconnect — please try again.", "err");
      if(btn){ btn.disabled = false; btn.textContent = "Disconnect"; }
    }
  } catch(err){
    toast("Could not disconnect — please try again.", "err");
    if(btn){ btn.disabled = false; btn.textContent = "Disconnect"; }
    console.error("[TikTok Ads] Disconnect error:", err.message);
  }
}

async function selectTadsAccount(advertiserId, advertiserName, currency){
  window._activeTadsAccount = {
    platform:        'tiktok_ads',
    account_id:      String(advertiserId),
    account_name:    String(advertiserName || ''),
    currency:        currency || null
  };

  // Optimistic UI highlight
  document.querySelectorAll('#tads-accounts-list .int-account-row').forEach(function(row){
    row.classList.remove('int-account-selected');
    var check = row.querySelector('.int-account-check');
    if(check) check.textContent = '';
    var badge = row.querySelector('.int-account-active-badge');
    if(badge) badge.remove();
  });
  document.querySelectorAll('#tads-accounts-list .int-account-row').forEach(function(row){
    var idEl = row.querySelector('.int-account-id');
    if(idEl && idEl.textContent.indexOf(String(advertiserId)) !== -1){
      row.classList.add('int-account-selected');
      var check = row.querySelector('.int-account-check');
      if(check) check.textContent = '✓';
      var nameEl = row.querySelector('.int-account-name');
      if(nameEl && !nameEl.querySelector('.int-account-active-badge')){
        var badge = document.createElement('span');
        badge.className = 'int-account-active-badge';
        badge.textContent = 'Active';
        nameEl.appendChild(badge);
      }
    }
  });

  try {
    var result = await apiFetch('/api/tiktok/active-account', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ advertiser_id: advertiserId, advertiser_name: advertiserName || '', currency: currency || null })
    });
    if(!result.ok){
      toast('Could not set active account — please try again.', 'err');
    }
  } catch(err){
    console.error('[TikTok Ads] selectTadsAccount error:', err.message);
    toast('Could not set active account — please try again.', 'err');
  }
}

// ════════════════════════════════════════════════════════════════
// META ADS INTEGRATION
// ════════════════════════════════════════════════════════════════

window._activeMetaAccount = window._activeMetaAccount || null;

async function _loadMetaStatus(){
  var connectBtn     = document.getElementById("meta-connect-btn");
  var connectedEl    = document.getElementById("meta-connected-info");
  var connectedBadge = document.getElementById("meta-connected-badge");
  if(connectBtn){ connectBtn.disabled = true; connectBtn.textContent = "Loading…"; }

  try {
    var result = await apiFetch("/api/meta/status");
    if(!result.ok){
      if(connectBtn){ connectBtn.disabled = false; connectBtn.textContent = "Connect"; }
      var _statusErr = (result.data && result.data.error) || ("HTTP " + result.status);
      console.error("[Meta Ads] /api/meta/status failed:", _statusErr);
      return;
    }
    var data = result.data;
    if(data.connected){
      if(connectBtn)     connectBtn.style.display     = "none";
      if(connectedBadge) connectedBadge.style.display = "";
      if(connectedEl)    connectedEl.style.display    = "";

      var userEl   = document.getElementById("meta-user-val");
      var dateEl   = document.getElementById("meta-date-val");
      var statusEl = document.getElementById("meta-status-text");

      if(userEl)   userEl.textContent  = data.meta_user_name || "—";
      if(dateEl)   dateEl.textContent  = data.connected_at
        ? new Date(data.connected_at).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })
        : "—";
      if(statusEl){
        var isExpired = data.status === "expired";
        statusEl.innerHTML = '<span class="int-status-dot' + (isExpired ? " int-status-warn" : "") + '"></span>'
          + (isExpired ? "Token expired — reconnect" : "Active");
      }

      // Restore active account from DB
      if(data.active_ad_account && data.active_ad_account.account_id){
        window._activeMetaAccount = data.active_ad_account;
      }

      var storedAccounts = data.meta_ads_accounts || [];
      if(storedAccounts.length){
        _renderMetaAccounts(storedAccounts, data.active_ad_account && data.active_ad_account.account_id);
      } else {
        refreshMetaAccounts();
      }
    } else {
      if(connectBtn){ connectBtn.style.display = ""; connectBtn.disabled = false; connectBtn.textContent = "Connect"; }
      if(connectedBadge) connectedBadge.style.display = "none";
      if(connectedEl)    connectedEl.style.display    = "none";
    }
  } catch(err){
    if(connectBtn){ connectBtn.disabled = false; connectBtn.textContent = "Connect"; }
    console.error("[Meta Ads] Status load failed:", err.message);
  }
}

function _metaAccountStatusLabel(status){
  var map = { 1:"Active", 2:"Disabled", 3:"Unsettled", 9:"In Grace Period", 100:"Pending Closure", 101:"Closed" };
  return map[status] || ("Status " + status);
}

function _renderMetaAccounts(accounts, activeAccountId){
  var wrap   = document.getElementById("meta-accounts-wrap");
  var listEl = document.getElementById("meta-accounts-list");
  var errEl  = document.getElementById("meta-accounts-error");
  var loadEl = document.getElementById("meta-accounts-loading");
  if(!wrap || !listEl) return;
  if(loadEl) loadEl.style.display = "none";
  if(errEl)  errEl.style.display  = "none";

  if(!accounts || accounts.length === 0){
    wrap.style.display = "none";
    if(errEl){ errEl.textContent = "No Meta Ads accounts found. Make sure your Facebook account has access to a Meta Ads Manager, then click Refresh accounts."; errEl.style.display = ""; }
    return;
  }

  function h(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var activeId = activeAccountId || (window._activeMetaAccount && window._activeMetaAccount.account_id) || null;

  // Auto-select the only account when nothing active
  if(accounts.length === 1 && !activeId){
    var solo = accounts[0];
    activeId = String(solo.account_id);
    selectMetaAccount(solo.account_id, solo.account_name || solo.account_id, solo.currency || null);
  }

  listEl.innerHTML = accounts.map(function(a){
    var isSelected = activeId && String(a.account_id) === String(activeId);
    var safeId   = h(a.account_id);
    var safeName = h(a.account_name || a.account_id);
    var meta = [];
    if(a.currency) meta.push(a.currency);
    if(a.timezone) meta.push(a.timezone);
    var statusLabel = _metaAccountStatusLabel(a.status);
    var isActive = a.status === 1;
    return '<div class="int-account-row' + (isSelected ? ' int-account-selected' : '') + '" '
      + 'onclick="selectMetaAccount(\'' + safeId.replace(/'/g,'&apos;') + '\',\'' + safeName.replace(/'/g,'&apos;') + '\',\'' + h(a.currency||'') + '\')">'
      + '<div class="int-account-row-inner">'
      + '<div class="int-account-check">' + (isSelected ? '✓' : '') + '</div>'
      + '<div>'
      + '<div class="int-account-name">' + safeName
      + (isSelected ? ' <span class="int-account-active-badge">Active</span>' : '') + '</div>'
      + '<div class="int-account-id">ID: ' + safeId + '</div>'
      + (meta.length ? '<div class="int-account-meta">' + h(meta.join(' · ')) + '</div>' : '')
      + (!isActive ? '<div class="int-account-mcc-warn">' + statusLabel + '</div>' : '')
      + '</div>'
      + '</div>'
      + '</div>';
  }).join('');

  wrap.style.display = "";
}

async function refreshMetaAccounts(){
  var btn    = document.getElementById("meta-refresh-btn");
  var loadEl = document.getElementById("meta-accounts-loading");
  var errEl  = document.getElementById("meta-accounts-error");
  var wrap   = document.getElementById("meta-accounts-wrap");
  if(btn)    { btn.disabled = true; btn.textContent = "Refreshing…"; }
  if(loadEl) { loadEl.style.display = ""; }
  if(errEl)  { errEl.style.display  = "none"; }
  if(wrap)   { wrap.style.display   = "none"; }

  try {
    var result = await apiFetch("/api/meta/accounts");
    if(loadEl) loadEl.style.display = "none";
    if(!result.ok){
      var msg = (result.data && result.data.error) ? result.data.error : "Could not fetch accounts (HTTP " + result.status + ")";
      if(errEl){ errEl.textContent = msg; errEl.style.display = ""; }
    } else {
      try {
        var activeId = window._activeMetaAccount && window._activeMetaAccount.account_id;
        _renderMetaAccounts(result.data.accounts || [], activeId);
        var statusEl = document.getElementById("meta-status-text");
        if(statusEl) statusEl.innerHTML = '<span class="int-status-dot"></span>Active';
      } catch(renderErr){
        console.error("[Meta Ads] Render error:", renderErr);
        if(errEl){ errEl.textContent = "Display error: " + renderErr.message; errEl.style.display = ""; }
      }
    }
  } catch(err){
    if(loadEl) loadEl.style.display = "none";
    var msg = err.message || "Network error — try again";
    if(errEl){ errEl.textContent = msg; errEl.style.display = ""; }
    console.error("[Meta Ads] Account refresh failed:", err.message);
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = "Refresh accounts"; }
  }
}

async function connectMetaAds(){
  var btn = document.getElementById("meta-connect-btn");
  if(btn){ btn.disabled = true; btn.textContent = "Connecting…"; }
  try {
    var sessionResult = await SB.auth.getSession();
    var session = sessionResult.data && sessionResult.data.session;
    if(!session || !session.access_token){
      toast("Please sign in before connecting Meta Ads.", "err");
      if(btn){ btn.disabled = false; btn.textContent = "Connect"; }
      return;
    }
    window.location.href = API_BASE_URL + '/auth/meta?token=' + session.access_token;
  } catch(err){
    toast("Connection error — please try again.", "err");
    if(btn){ btn.disabled = false; btn.textContent = "Connect"; }
  }
}

async function disconnectMetaAds(){
  var btn = document.getElementById("meta-disconnect-btn");
  if(btn){ btn.disabled = true; btn.textContent = "Disconnecting…"; }
  try {
    var result = await apiFetch("/api/meta/disconnect", { method: "POST" });
    if(result.ok){
      toast("Meta Ads disconnected.");
      window._activeMetaAccount = null;

      var connectBtn     = document.getElementById("meta-connect-btn");
      var connectedEl    = document.getElementById("meta-connected-info");
      var connectedBadge = document.getElementById("meta-connected-badge");
      if(connectBtn)     { connectBtn.style.display = ""; connectBtn.disabled = false; connectBtn.textContent = "Connect"; }
      if(connectedEl)    connectedEl.style.display    = "none";
      if(connectedBadge) connectedBadge.style.display = "none";
    } else {
      toast("Could not disconnect — please try again.", "err");
      if(btn){ btn.disabled = false; btn.textContent = "Disconnect"; }
    }
  } catch(err){
    toast("Could not disconnect — please try again.", "err");
    if(btn){ btn.disabled = false; btn.textContent = "Disconnect"; }
    console.error("[Meta Ads] Disconnect error:", err.message);
  }
}

async function selectMetaAccount(accountId, accountName, currency){
  window._activeMetaAccount = {
    platform:     'meta_ads',
    account_id:   String(accountId),
    account_name: String(accountName || ''),
    currency:     currency || null
  };

  // Optimistic UI highlight
  document.querySelectorAll('#meta-accounts-list .int-account-row').forEach(function(row){
    row.classList.remove('int-account-selected');
    var check = row.querySelector('.int-account-check');
    if(check) check.textContent = '';
    var badge = row.querySelector('.int-account-active-badge');
    if(badge) badge.remove();
  });
  document.querySelectorAll('#meta-accounts-list .int-account-row').forEach(function(row){
    var idEl = row.querySelector('.int-account-id');
    if(idEl && idEl.textContent.indexOf(String(accountId)) !== -1){
      row.classList.add('int-account-selected');
      var check = row.querySelector('.int-account-check');
      if(check) check.textContent = '✓';
      var nameEl = row.querySelector('.int-account-name');
      if(nameEl && !nameEl.querySelector('.int-account-active-badge')){
        var badge = document.createElement('span');
        badge.className = 'int-account-active-badge';
        badge.textContent = 'Active';
        nameEl.appendChild(badge);
      }
    }
  });

  try {
    var result = await apiFetch('/api/meta/active-account', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ account_id: accountId, account_name: accountName || '', currency: currency || null })
    });
    if(!result.ok){
      toast('Could not set active account — please try again.', 'err');
    }
  } catch(err){
    console.error('[Meta Ads] selectMetaAccount error:', err.message);
    toast('Could not set active account — please try again.', 'err');
  }
}


// ════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", function(){
  initSettings();
  _initSettingsNav();
  refreshDash();
  renderInspiration();
  renderAssets();
});


// ════════════════════════════════════════════════════════════════
// SETTINGS MODAL
// ════════════════════════════════════════════════════════════════

function openSettingsModal(){
  if(typeof openModal === "function") openModal("modal-settings");
  // Reset nav to first tab
  var firstNi = document.querySelector(".smd-ni");
  if(firstNi) smdNav(firstNi);
  // Populate fields
  initSettings();
}

function smdNav(btn){
  var key = btn.dataset.smd;
  document.querySelectorAll(".smd-ni").forEach(function(b){ b.classList.remove("active"); });
  btn.classList.add("active");
  document.querySelectorAll(".smd-panel").forEach(function(p){ p.classList.remove("active"); });
  var panel = document.getElementById("smdp-" + key);
  if(panel) panel.classList.add("active");
}

async function confirmDeleteAccount(btn){
  if(!confirm("Permanently delete your ORIVEN account and all data? This cannot be undone.")) return;
  if(!confirm("Final confirmation: your campaigns, saved assets, and account will be permanently deleted. Continue?")) return;

  var originalText = btn ? btn.textContent : "Delete Account";
  if(btn){ btn.disabled = true; btn.textContent = "Deleting…"; }

  try {
    var res = await apiFetch("/api/account/delete", { method: "POST" });
    if(!res || !res.ok){
      toast((res && res.data && res.data.error) || "Could not delete your account right now.", "err");
      if(btn){ btn.disabled = false; btn.textContent = originalText; }
      return;
    }
    toast("Account deleted.");
    try { await SB.auth.signOut(); } catch(_){}
    window.location.href = "/";
  } catch(err){
    toast("Could not delete your account — try again.", "err");
    if(btn){ btn.disabled = false; btn.textContent = originalText; }
  }
}
