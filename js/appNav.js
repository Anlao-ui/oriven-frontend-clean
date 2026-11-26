/* ════════════════════════════════════════════════════════════════
   OrivenAI app navigation — six sections, fifteen pages.

     CONTROL CENTER  Dashboard · Marketing Plan · Progress
     RESEARCH        Research · Insights
     CREATE          Create · My Content
     LAUNCH          Ad Studio
     CAMPAIGNS       Campaign Overview · Campaign Builder
     AUTOMATIONS     Overview · Scheduler · Rules · Activity

   The section names are headings, not links; the pages under them are the
   destinations. Every page opens through the app's one navigation entry
   point (window._orvNav) and, where a page is a tab or view of an existing
   page, through that page's own switch (bizGoTo, the Automations tabs, the
   Research library view, openCampaignWorkspace). No page is duplicated.
   Progress and My Content are not built yet: they open an honest
   "in development" page with no data on it.

   The active page is derived from what is actually on screen (the active
   .page, the Control Center tab, the Automations tab, the Research view),
   so every way of navigating — these links, buttons inside pages, the
   assistant, deep links — keeps the highlight right.

   Rendered twice from one model: the desktop sidebar (.orv-sb-nav) and
   the mobile drawer (.orv-mob-drawer-nav). Styles: css/app-nav.css.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.orvAppNav) return;

  // ── Icons: one family (24 grid, 1.6 stroke), parts animated by CSS ──
  var IC = {
    dashboard: '<rect class="i-a" x="4" y="4" width="7" height="7" rx="2"/><rect class="i-b" x="13" y="4" width="7" height="7" rx="2"/><rect class="i-c" x="4" y="13" width="7" height="7" rx="2"/><rect class="i-d" x="13" y="13" width="7" height="7" rx="2"/>',
    plan: '<path class="i-draw" pathLength="1" d="M5 18c3.5 0 3.5-6 7-6s3.5-6 7-6"/><circle class="i-dot i-a" cx="5" cy="18" r="1.8"/><circle class="i-dot i-b" cx="12" cy="12" r="1.8"/><circle class="i-dot i-c" cx="19" cy="6" r="1.8"/>',
    progress: '<circle cx="12" cy="12" r="8" opacity=".35"/><path class="i-sweep" pathLength="1" d="M12 4a8 8 0 1 1-7.6 5.5"/><path class="i-tick" pathLength="1" d="M9 12.2l2 2 4-4.2"/>',
    research: '<g class="i-lens"><circle cx="10.5" cy="10.5" r="5.5"/><path class="i-glint" d="M8 9a3 3 0 0 1 2.5-2"/></g><path d="M14.7 14.7L19.5 19.5"/>',
    insights: '<path d="M9 17h6M10 20h4"/><path d="M12 4a5 5 0 0 0-3 9c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a5 5 0 0 0-3-9z"/><path class="i-ray i-a" d="M12 1.5v1.2"/><path class="i-ray i-b" d="M4.6 4.6l.9.9"/><path class="i-ray i-c" d="M19.4 4.6l-.9.9"/>',
    create: '<path d="M5 19L15 9"/><path d="M13.5 7.5l3 3"/><path class="i-spark i-a" d="M18 3.5v3M16.5 5h3"/><path class="i-spark i-b" d="M20 10.5v2M19 11.5h2"/><path class="i-spark i-c" d="M9 3.5v2M8 4.5h2"/>',
    content: '<rect class="i-c" x="5" y="8" width="14" height="11" rx="2"/><path class="i-b" d="M7 5.5h10"/><path class="i-a" d="M9 3h6"/>',
    studio: '<g class="i-lift"><path d="M12 3c3 2.2 4.5 5.4 4.5 9.2V16h-9v-3.8C7.5 8.4 9 5.2 12 3z"/><circle cx="12" cy="10" r="1.6"/><path d="M7.5 13.5L5 16v2h2.5M16.5 13.5L19 16v2h-2.5"/></g><path class="i-flame" d="M10.5 18.5c.3 1.2.8 2 1.5 2.5.7-.5 1.2-1.3 1.5-2.5"/>',
    overview: '<circle class="i-ring i-c" cx="12" cy="12" r="8"/><circle class="i-ring i-b" cx="12" cy="12" r="4.8"/><circle class="i-ring i-a" cx="12" cy="12" r="1.6"/>',
    builder: '<rect x="4" y="14" width="7" height="6" rx="1.4"/><rect x="13" y="14" width="7" height="6" rx="1.4"/><rect class="i-drop" x="8.5" y="5" width="7" height="6" rx="1.4"/>',
    nodes: '<circle cx="6" cy="7" r="2.2"/><circle cx="18" cy="7" r="2.2"/><circle cx="12" cy="17.5" r="2.2"/><path class="i-draw" pathLength="1" d="M8.2 7h7.6M17 9l-3.8 6.6M7 9l3.8 6.6"/>',
    scheduler: '<circle cx="12" cy="12" r="8"/><path class="i-hand" d="M12 12V7.5"/><path d="M12 12l3 2"/>',
    rules: '<circle cx="5.5" cy="12" r="2"/><circle cx="18.5" cy="6" r="2"/><circle cx="18.5" cy="18" r="2"/><path class="i-draw" pathLength="1" d="M7.5 12h3.5c2 0 2.5-6 5.5-6M11 12c2 0 2.5 6 5.5 6"/>',
    activity: '<path class="i-draw" pathLength="1" d="M3 12h4l2.2-5 4.4 10L15.8 12H21"/>',
  };
  // The four working pages added inside the existing sections.
  IC.competitors = '<circle cx="8" cy="9" r="3"/><path d="M3 19c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5"/><circle class="i-a" cx="17" cy="8" r="2.4"/><path class="i-b" d="M14.5 13.6c.8-.4 1.6-.6 2.5-.6 2.2 0 3.8 1.3 4.4 3.8"/>';
  IC.testing = '<rect x="3.5" y="5" width="7" height="14" rx="1.6"/><rect class="i-lift" x="13.5" y="5" width="7" height="14" rx="1.6"/><path class="i-tick" pathLength="1" d="M15.4 12.2l1.4 1.4 2.4-2.6"/>';
  IC.audience = '<circle class="i-ring i-c" cx="12" cy="12" r="8.5"/><circle cx="12" cy="10" r="2.6"/><path d="M7.6 17.4c.9-2 2.5-3 4.4-3s3.5 1 4.4 3"/>';
  IC.compare = '<path d="M4 20h16"/><rect class="i-a" x="5.5" y="11" width="3.5" height="9" rx="1"/><rect class="i-b" x="10.25" y="6" width="3.5" height="14" rx="1"/><rect class="i-c" x="15" y="9" width="3.5" height="11" rx="1"/>';
  IC.platforms = '<path class="i-a" d="M9 3.5v4"/><path class="i-b" d="M15 3.5v4"/><path d="M6.5 7.5h11v3.5a5.5 5.5 0 0 1-11 0z"/><path class="i-draw" pathLength="1" d="M12 16.5v2.5a2.5 2.5 0 0 0 2.5 2.5H18"/>';
  IC.gear = '<g class="i-gear"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></g>';
  IC.simulator = '<path d="M4 19h16"/><path class="i-draw" pathLength="1" d="M5 15.5l4-4 3 2.5 6.5-7"/><path d="M5 15.5l4-1.5 3 1 6.5-3" opacity=".45" stroke-dasharray="1.6 2.2"/><circle class="i-dot i-c" cx="18.5" cy="7" r="1.6"/>';
  IC.attention = '<path d="M12 4.5 3.5 19h17z"/><path class="i-a" d="M12 10v4"/><circle class="i-dot" cx="12" cy="16.6" r=".9"/>';
  IC.adsvsads = '<rect x="3.5" y="5" width="7" height="14" rx="1.6"/><rect class="i-b" x="13.5" y="5" width="7" height="14" rx="1.6"/><path d="M7 15h0M17 11h0" stroke-width="2.4"/>';
  IC.sliders = '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle class="i-a" cx="15" cy="7" r="2"/><circle class="i-b" cx="9" cy="17" r="2"/>';
  function svg(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + IC[name] + '</svg>'; }

  // ── The model ────────────────────────────────────────────────────
  function biz(tab) { return function () { if (typeof window.bizGoTo === 'function') window.bizGoTo(tab); }; }
  function page(key, id, then) { return function () { if (typeof window._orvNav === 'function') window._orvNav(key, id); if (then) setTimeout(then, 0); }; }
  // Marketing Plan and Progress: their own pages (js/planPages.js).
  function planPage(id) { return function () { if (window.orvPlanPages) window.orvPlanPages.open(id); }; }
  // Automations: one page per link (js/automations.js orvAutomations.show).
  function autoTab(tab) {
    return page('autopilot', 'page-autopilot', function () {
      var tries = 0;
      (function showIt() { var A = window.orvAutomations; if (A && A.show && document.getElementById('auRoot')) { A.show(tab); sync(); return; } if (++tries < 40) setTimeout(showIt, 75); })();
    });
  }

  // Ad Simulator: its own page (js/adSimulator.js).
  function simPage() { return function () { if (window.orvAdSimulator) window.orvAdSimulator.open(); }; }

  // One workspace, six groups. Every page keeps the id it always had
  // (/app?view=, the assistant and in-page links use them); only the
  // grouping and the names changed (2026-11 workspace redesign).
  // Research areas (js/research.js): Audience Research and Competitive Research are the
  // same research engine, each opened on its own area.
  function researchArea(area) { return page('research', 'page-research', function () { if (window.orvResearch && window.orvResearch.openArea) window.orvResearch.openArea(area); }); }

  // One workspace, six groups (2026-11-26 product structure). Every page keeps the id it
  // always had (/app?view=, the assistant and in-page links use them).
  var SECTIONS = [
    { id: 'ov', name: 'Overview', items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', go: biz('overview') },
      // AI Plans & Tasks: one destination with two tabs; Tasks keeps its own page id.
      { id: 'plan', label: 'AI Plans & Tasks', icon: 'plan', go: planPage('plan') },
      { id: 'progress', label: 'Tasks', icon: 'progress', hidden: true, parent: 'plan', go: planPage('progress') },
      { id: 'attention', label: 'Needs Attention', icon: 'attention', go: function () { if (window.orvNeedsAttention) window.orvNeedsAttention.open(); } },
    ] },
    { id: 'cm', name: 'Campaigns', items: [
      { id: 'adstudio', label: 'Campaigns', icon: 'studio', go: page('launch', 'page-launch') },
      // Not in the sidebar: the campaign editor's way in, opened from Campaigns, Audiences and the assistant.
      { id: 'builder', label: 'Campaign Builder', icon: 'builder', hidden: true, parent: 'adstudio', go: function () { openPanel('builder'); } },
      { id: 'simulator', label: 'Ad Simulator', icon: 'simulator', go: simPage() },
    ] },
    { id: 'cs', name: 'Creative Studio', items: [
      { id: 'create', label: 'Create Ads', icon: 'create', go: page('create', 'page-create') },
      { id: 'content', label: 'My Creatives', icon: 'content', go: function () { if (window.orvMyContent) window.orvMyContent.open(); } },
      { id: 'testing', label: 'Creative Testing', icon: 'testing', go: function () { if (window.orvCreativeTesting) window.orvCreativeTesting.open(); } },
    ] },
    { id: 'an', name: 'Analytics', items: [
      { id: 'overview', label: 'Performance Overview', icon: 'overview', go: page('performance', 'page-performance') },
      { id: 'compare', label: 'Cross-platform Comparison', icon: 'compare', go: function () { if (window.orvCampaignComparison) window.orvCampaignComparison.open(); } },
      { id: 'adsvsads', label: 'Ads vs Ads', icon: 'adsvsads', go: function () { if (window.orvAdsVsAds) window.orvAdsVsAds.open(); } },
    ] },
    { id: 'rs', name: 'Research', items: [
      { id: 'research', label: 'Audience Research', icon: 'audience', go: researchArea('audience') },
      { id: 'competitive', label: 'Competitive Research', icon: 'competitors', go: researchArea('competitive') },
      { id: 'insights', label: 'Saved Research', icon: 'insights', go: function () { if (window.orvInsights) window.orvInsights.open(); } },
      // Tools inside the two research pages (not sidebar items; ids, links and the assistant unchanged).
      { id: 'audiences', label: 'Audiences', icon: 'audience', hidden: true, parent: 'research', go: function () { if (window.orvAudienceBuilder) window.orvAudienceBuilder.open(); } },
      { id: 'competitors', label: 'Competitor Analysis', icon: 'competitors', hidden: true, parent: 'competitive', go: function () { if (window.orvCompetitors) window.orvCompetitors.open(); } },
    ] },
    { id: 'ap', name: 'Autopilot', items: [
      { id: 'auto-overview', label: 'Automation Overview', icon: 'nodes', go: autoTab('overview') },
      { id: 'auto-rules', label: 'My Automations', icon: 'rules', go: autoTab('rules') },
      // Scheduled pauses/resumes: part of My Automations, opened from it and from Automation Overview.
      { id: 'auto-scheduler', label: 'Scheduler', icon: 'scheduler', hidden: true, parent: 'auto-rules', go: autoTab('scheduler') },
      { id: 'auto-activity', label: 'Automation History', icon: 'activity', go: autoTab('activity') },
    ] },
  ];
  var ITEMS = {}, SECTION_OF = {};
  // Every page keeps its id (orvPages, /app?view=, the assistant open them);
  // hidden ones aren't drawn, and their parent item is marked while they're open.
  SECTIONS.forEach(function (s) { var v = 0; s.shown = s.items.filter(function (it) { return !it.hidden; }); s.items.forEach(function (it) { ITEMS[it.id] = it; SECTION_OF[it.id] = s; it.index = it.hidden ? -1 : v++; }); });
  function navTarget(id) { var it = id && ITEMS[id]; return it && it.hidden && it.parent ? it.parent : id; }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ── Labels in the app language ───────────────────────────────────
  // Product names (Control Center, Dashboard, Launch, Ad Studio) stay as they
  // are everywhere in the app; the rest follows Settings → Language, with the
  // same words the pages themselves use (Automations' page names, Campaigns).
  var L10N = {
    nl: { 'Research': 'Onderzoek', 'Create': 'Maken', 'Campaigns': 'Campagnes', 'Automations': 'Automatiseringen', 'Marketing Plan': 'Marketingplan', 'Progress': 'Voortgang', 'Insights': 'Inzichten', 'My Content': 'Mijn content', 'Campaign Overview': 'Campagne-overzicht', 'Campaign Builder': 'Campagnebouwer', 'Overview': 'Overzicht', 'Scheduler': 'Planner', 'Rules': 'Regels', 'Activity': 'Activiteit', 'Ad Platforms': 'Advertentieplatforms', 'Account': 'Account', 'Settings': 'Instellingen', 'Your AI assistant': 'Je AI-assistent', 'Choose your assistant': 'Kies je assistent', 'Assistant': 'Assistent' },
    de: { 'Research': 'Recherche', 'Create': 'Erstellen', 'Campaigns': 'Kampagnen', 'Automations': 'Automatisierungen', 'Marketing Plan': 'Marketingplan', 'Progress': 'Fortschritt', 'Insights': 'Erkenntnisse', 'My Content': 'Meine Inhalte', 'Campaign Overview': 'Kampagnenübersicht', 'Campaign Builder': 'Kampagnen-Builder', 'Overview': 'Übersicht', 'Scheduler': 'Planer', 'Rules': 'Regeln', 'Activity': 'Aktivität', 'Ad Platforms': 'Werbeplattformen', 'Account': 'Konto', 'Settings': 'Einstellungen', 'Your AI assistant': 'Dein KI-Assistent', 'Choose your assistant': 'Wähle deinen Assistenten', 'Assistant': 'Assistent' },
    fr: { 'Research': 'Recherche', 'Create': 'Créer', 'Campaigns': 'Campagnes', 'Automations': 'Automatisations', 'Marketing Plan': 'Plan marketing', 'Progress': 'Progression', 'Insights': 'Enseignements', 'My Content': 'Mes contenus', 'Campaign Overview': 'Aperçu des campagnes', 'Campaign Builder': 'Création de campagne', 'Overview': 'Aperçu', 'Scheduler': 'Planificateur', 'Rules': 'Règles', 'Activity': 'Activité', 'Ad Platforms': 'Plateformes publicitaires', 'Account': 'Compte', 'Settings': 'Paramètres', 'Your AI assistant': 'Votre assistant IA', 'Choose your assistant': 'Choisissez votre assistant', 'Assistant': 'Assistant' },
    es: { 'Research': 'Investigación', 'Create': 'Crear', 'Campaigns': 'Campañas', 'Automations': 'Automatizaciones', 'Marketing Plan': 'Plan de marketing', 'Progress': 'Progreso', 'Insights': 'Hallazgos', 'My Content': 'Mi contenido', 'Campaign Overview': 'Resumen de campañas', 'Campaign Builder': 'Creador de campañas', 'Overview': 'Resumen', 'Scheduler': 'Programador', 'Rules': 'Reglas', 'Activity': 'Actividad', 'Ad Platforms': 'Plataformas de anuncios', 'Account': 'Cuenta', 'Settings': 'Ajustes', 'Your AI assistant': 'Tu asistente de IA', 'Choose your assistant': 'Elige tu asistente', 'Assistant': 'Asistente' },
    pt: { 'Research': 'Pesquisa', 'Create': 'Criar', 'Campaigns': 'Campanhas', 'Automations': 'Automações', 'Marketing Plan': 'Plano de marketing', 'Progress': 'Progresso', 'Insights': 'Descobertas', 'My Content': 'Meu conteúdo', 'Campaign Overview': 'Visão geral das campanhas', 'Campaign Builder': 'Criador de campanhas', 'Overview': 'Visão geral', 'Scheduler': 'Agendador', 'Rules': 'Regras', 'Activity': 'Atividade', 'Ad Platforms': 'Plataformas de anúncios', 'Account': 'Conta', 'Settings': 'Configurações', 'Your AI assistant': 'O seu assistente de IA', 'Choose your assistant': 'Escolha o seu assistente', 'Assistant': 'Assistente' },
  };
  // The workspace redesign's group and page names.
  var L10N2 = {
    nl: { 'AI Plans & Tasks': 'AI-plannen & taken', 'Needs Attention': 'Vraagt aandacht', 'Ads vs Ads': 'Advertenties vergelijken', 'Audience Research': 'Doelgroeponderzoek', 'Competitive Research': 'Concurrentieonderzoek', 'Overview': 'Overzicht', 'AI Plans': 'AI-plannen', 'Tasks': 'Taken', 'Campaign Management': 'Campagnebeheer', 'Campaigns': 'Campagnes', 'Audiences': 'Doelgroepen', 'Ad Simulator': 'Advertentiesimulator', 'Creative Studio': 'Creative Studio', 'Create Ads': 'Advertenties maken', 'My Creatives': 'Mijn creatives', 'Analytics': 'Analyse', 'Performance Overview': 'Prestatieoverzicht', 'Cross-platform Comparison': 'Platformvergelijking', 'Competitor Analysis': 'Concurrentieanalyse', 'Saved Research': 'Opgeslagen onderzoek', 'Autopilot': 'Autopilot', 'Automation Overview': 'Automatiseringsoverzicht', 'My Automations': 'Mijn automatiseringen', 'Automation History': 'Automatiseringsgeschiedenis', 'Advertising Settings': 'Advertentie-instellingen', 'General settings': 'Algemene instellingen', 'Advertising settings': 'Advertentie-instellingen', 'Your account, plan and preferences': 'Je account, abonnement en voorkeuren', 'Tracking and conversions for each platform': 'Tracking en conversies per platform', 'Connect accounts in Ad Platforms': 'Accounts koppelen in Advertentieplatforms', 'Tracking and conversions': 'Tracking en conversies', 'Open Advertising settings': 'Advertentie-instellingen openen' },
    de: { 'AI Plans & Tasks': 'KI-Pläne & Aufgaben', 'Needs Attention': 'Braucht Aufmerksamkeit', 'Ads vs Ads': 'Anzeigen im Vergleich', 'Audience Research': 'Zielgruppenrecherche', 'Competitive Research': 'Wettbewerbsrecherche', 'Overview': 'Übersicht', 'AI Plans': 'KI-Pläne', 'Tasks': 'Aufgaben', 'Campaign Management': 'Kampagnenverwaltung', 'Campaigns': 'Kampagnen', 'Audiences': 'Zielgruppen', 'Ad Simulator': 'Anzeigensimulator', 'Create Ads': 'Anzeigen erstellen', 'My Creatives': 'Meine Creatives', 'Analytics': 'Analysen', 'Performance Overview': 'Leistungsübersicht', 'Cross-platform Comparison': 'Plattformvergleich', 'Competitor Analysis': 'Wettbewerbsanalyse', 'Saved Research': 'Gespeicherte Recherchen', 'Automation Overview': 'Automatisierungsübersicht', 'My Automations': 'Meine Automatisierungen', 'Automation History': 'Automatisierungsverlauf', 'Advertising Settings': 'Werbeeinstellungen', 'General settings': 'Allgemeine Einstellungen', 'Advertising settings': 'Werbeeinstellungen', 'Your account, plan and preferences': 'Dein Konto, Tarif und deine Einstellungen', 'Tracking and conversions for each platform': 'Tracking und Conversions je Plattform', 'Connect accounts in Ad Platforms': 'Konten unter Werbeplattformen verbinden', 'Tracking and conversions': 'Tracking und Conversions', 'Open Advertising settings': 'Werbeeinstellungen öffnen' },
    fr: { 'AI Plans & Tasks': 'Plans IA & tâches', 'Needs Attention': 'À traiter', 'Ads vs Ads': 'Annonces face à face', 'Audience Research': 'Recherche d’audience', 'Competitive Research': 'Recherche concurrentielle', 'Overview': 'Aperçu', 'AI Plans': 'Plans IA', 'Tasks': 'Tâches', 'Campaign Management': 'Gestion des campagnes', 'Campaigns': 'Campagnes', 'Audiences': 'Audiences', 'Ad Simulator': 'Simulateur publicitaire', 'Create Ads': 'Créer des annonces', 'My Creatives': 'Mes créations', 'Analytics': 'Analyses', 'Performance Overview': 'Aperçu des performances', 'Cross-platform Comparison': 'Comparaison des plateformes', 'Competitor Analysis': 'Analyse concurrentielle', 'Saved Research': 'Recherches enregistrées', 'Automation Overview': 'Aperçu des automatisations', 'My Automations': 'Mes automatisations', 'Automation History': 'Historique des automatisations', 'Advertising Settings': 'Paramètres publicitaires', 'General settings': 'Paramètres généraux', 'Advertising settings': 'Paramètres publicitaires', 'Your account, plan and preferences': 'Votre compte, votre offre et vos préférences', 'Tracking and conversions for each platform': 'Suivi et conversions par plateforme', 'Connect accounts in Ad Platforms': 'Connecter des comptes dans Plateformes publicitaires', 'Tracking and conversions': 'Suivi et conversions', 'Open Advertising settings': 'Ouvrir les paramètres publicitaires' },
    es: { 'AI Plans & Tasks': 'Planes de IA y tareas', 'Needs Attention': 'Requiere atención', 'Ads vs Ads': 'Anuncio contra anuncio', 'Audience Research': 'Investigación de audiencias', 'Competitive Research': 'Investigación competitiva', 'Overview': 'Resumen', 'AI Plans': 'Planes de IA', 'Tasks': 'Tareas', 'Campaign Management': 'Gestión de campañas', 'Campaigns': 'Campañas', 'Audiences': 'Audiencias', 'Ad Simulator': 'Simulador de anuncios', 'Create Ads': 'Crear anuncios', 'My Creatives': 'Mis creatividades', 'Analytics': 'Analítica', 'Performance Overview': 'Resumen de rendimiento', 'Cross-platform Comparison': 'Comparación de plataformas', 'Competitor Analysis': 'Análisis de competidores', 'Saved Research': 'Investigación guardada', 'Automation Overview': 'Resumen de automatizaciones', 'My Automations': 'Mis automatizaciones', 'Automation History': 'Historial de automatizaciones', 'Advertising Settings': 'Ajustes de publicidad', 'General settings': 'Ajustes generales', 'Advertising settings': 'Ajustes de publicidad', 'Your account, plan and preferences': 'Tu cuenta, tu plan y tus preferencias', 'Tracking and conversions for each platform': 'Seguimiento y conversiones por plataforma', 'Connect accounts in Ad Platforms': 'Conecta cuentas en Plataformas de anuncios', 'Tracking and conversions': 'Seguimiento y conversiones', 'Open Advertising settings': 'Abrir ajustes de publicidad' },
    pt: { 'AI Plans & Tasks': 'Planos de IA e tarefas', 'Needs Attention': 'Precisa de atenção', 'Ads vs Ads': 'Anúncio contra anúncio', 'Audience Research': 'Pesquisa de público', 'Competitive Research': 'Pesquisa competitiva', 'Overview': 'Visão geral', 'AI Plans': 'Planos de IA', 'Tasks': 'Tarefas', 'Campaign Management': 'Gestão de campanhas', 'Campaigns': 'Campanhas', 'Audiences': 'Públicos', 'Ad Simulator': 'Simulador de anúncios', 'Create Ads': 'Criar anúncios', 'My Creatives': 'Meus criativos', 'Analytics': 'Análises', 'Performance Overview': 'Visão geral de desempenho', 'Cross-platform Comparison': 'Comparação de plataformas', 'Competitor Analysis': 'Análise de concorrentes', 'Saved Research': 'Pesquisas salvas', 'Automation Overview': 'Visão geral das automações', 'My Automations': 'Minhas automações', 'Automation History': 'Histórico de automações', 'Advertising Settings': 'Configurações de publicidade', 'General settings': 'Configurações gerais', 'Advertising settings': 'Configurações de publicidade', 'Your account, plan and preferences': 'A sua conta, plano e preferências', 'Tracking and conversions for each platform': 'Acompanhamento e conversões por plataforma', 'Connect accounts in Ad Platforms': 'Ligar contas em Plataformas de anúncios', 'Tracking and conversions': 'Acompanhamento e conversões', 'Open Advertising settings': 'Abrir configurações de publicidade' },
  };
  Object.keys(L10N2).forEach(function (l) { Object.keys(L10N2[l]).forEach(function (k) { L10N[l][k] = L10N2[l][k]; }); });
  function tr(en) { var l = (typeof CURRENT_LANG !== 'undefined' && CURRENT_LANG) || 'en'; return (L10N[l] && L10N[l][en]) || en; }
  // Labels carry their English key (data-onv-t / data-onv-ta) so a language change relabels in place.
  function relabel() {
    document.querySelectorAll('[data-onv-t]').forEach(function (el) {
      el.textContent = tr(el.getAttribute('data-onv-t'));
      var b = el.closest('button'); if (b && b.hasAttribute('title')) b.setAttribute('title', el.textContent);
    });
    document.querySelectorAll('[data-onv-ta]').forEach(function (b) {
      var t = tr(b.getAttribute('data-onv-ta')); b.setAttribute('aria-label', t); if (b.hasAttribute('title')) b.setAttribute('title', t);
    });
  }

  // ── Rendering ────────────────────────────────────────────────────
  // The "?" next to an item (js/navHelp.js shows what the page does). A sibling
  // of the item's button, so it never opens the page itself.
  function helpBtn(id, label) { return '<button type="button" class="onv-help" data-onv-help="' + id + '" aria-expanded="false" aria-label="' + esc('About ' + tr(label)) + '"><span aria-hidden="true">?</span></button>'; }
  function navHtml(where) {
    return SECTIONS.map(function (s) {
      return '<section class="onv-sec" data-sec="' + s.id + '" aria-labelledby="onvH-' + where + '-' + s.id + '">' +
        // A heading, not a control: no link, no button, no hover.
        '<h2 class="onv-sec__h" id="onvH-' + where + '-' + s.id + '"><span class="onv-sec__t" data-onv-t="' + esc(s.name) + '">' + esc(tr(s.name)) + '</span></h2>' +
        '<div class="onv-route" aria-hidden="true"><i></i></div>' +
        '<ul class="onv-list">' + s.shown.map(function (it) {
          return '<li><button type="button" class="onv-item' + (it.dev ? ' is-dev' : '') + '" data-onv="' + it.id + '" title="' + esc(tr(it.label)) + '">' +
            '<span class="onv-ic">' + svg(it.icon) + '</span><span class="onv-lbl" data-onv-t="' + esc(it.label) + '">' + esc(tr(it.label)) + '</span>' +
            (it.dev ? '<span class="onv-dev" aria-label="in development">Soon</span>' : '') + '</button>' + helpBtn(it.id, it.label) + '</li>';
        }).join('') + '</ul></section>';
    }).join('');
  }

  var S = { current: null, panel: null, roots: [], justTimer: 0 };

  function mount() {
    var targets = [['desktop', document.querySelector('.orv-sb .orv-sb-nav')], ['mobile', document.querySelector('.orv-mob-drawer .orv-mob-drawer-nav')]];
    targets.forEach(function (t) {
      var host = t[1]; if (!host) return;
      host.innerHTML = '';
      var root = document.createElement('div');
      root.className = 'onv'; root.setAttribute('data-onv-root', t[0]);
      root.innerHTML = navHtml(t[0]);
      host.appendChild(root);
      S.roots.push(root);
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-onv]');
        if (b) { go(b.getAttribute('data-onv')); if (t[0] === 'mobile' && typeof window._orvDrawerClose === 'function') window._orvDrawerClose(); }
      });
    });
    // The sidebar is always expanded (no collapsed rail).
    var sbEl = document.querySelector('.orv-sb'); if (sbEl) sbEl.classList.add('onv-mounted');
    mountFooter();
    try { localStorage.removeItem('orv_nav_collapsed'); } catch (_) {} // the old collapse setting
    mountPanel();
  }

  // ── Footer: the workspace control area ─────────────────────────────────
  // Settings · Ad Platforms · the assistant · the account (2026-11-26):
  //   Settings      the one Settings surface (the existing modal), with General
  //                 settings and the per-platform Advertising Settings inside it.
  //   Ad Platforms  connecting accounts and choosing the ad account (unchanged).
  //   Assistant     the user's own assistant (js/orivenAgent.js — the persona
  //                 chosen at onboarding, from GET /api/agent), opened as a full
  //                 chat workspace. It replaces the floating launcher.
  //   Account       full-width row; opens Settings at Account.
  // Ids other code relies on are kept: #orvNavSettingsBtn (tour step),
  // #orvLauncherBtn, #orvSbWorkspace / #orvSbAvatar (written by settings.js).
  function footHtml(where) {
    var d = where === 'desktop';
    return '<div class="onv onv-foot" data-onv-root="foot-' + where + '">' +
      '<div class="onv-fwrap"><button type="button" class="onv-item" data-onv-foot="settings"' + (d ? ' id="orvNavSettingsBtn"' : '') + ' title="' + esc(tr('Settings')) + '"><span class="onv-ic">' + svg('gear') + '</span><span class="onv-lbl" data-onv-t="Settings">' + esc(tr('Settings')) + '</span></button>' + helpBtn('settings', 'Settings') + '</div>' +
      '<div class="onv-fwrap"><button type="button" class="onv-item" data-onv-foot="platforms"' + (d ? ' id="orvLauncherBtn"' : '') + ' title="' + esc(tr('Ad Platforms')) + '"><span class="onv-ic">' + svg('platforms') + '</span><span class="onv-lbl" data-onv-t="Ad Platforms">' + esc(tr('Ad Platforms')) + '</span></button>' + helpBtn('platforms', 'Ad Platforms') + '</div>' +
      '<button type="button" class="onv-item onv-mom" data-onv-foot="assistant" aria-label="' + esc(tr('Your AI assistant')) + '">' +
        '<span class="onv-ic onv-mom__ic" data-onv-mom-ic aria-hidden="true"><span class="onv-mom__core"></span></span>' +
        '<span class="onv-mom__t"><b data-onv-mom-name>' + esc(tr('Assistant')) + '</b><small data-onv-t="Your AI assistant">' + esc(tr('Your AI assistant')) + '</small></span>' +
        '<span class="onv-mom__live" aria-hidden="true"></span></button>' +
      '<button type="button" class="onv-acct" data-onv-foot="account" data-onv-ta="Account" aria-label="' + esc(tr('Account')) + '"><span class="onv-acct__av" aria-hidden="true" data-onv-av>·</span>' +
        '<span class="onv-acct__t"><b data-onv-name></b><span data-onv-plan></span></span>' +
        '<svg class="onv-acct__chev" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      (d ? '<button type="button" id="orvSbWorkspace" hidden tabindex="-1"></button><span id="orvSbAvatar" hidden></span>' : '') +
    '</div>';
  }
  function mountFooter() {
    [['desktop', document.querySelector('.orv-sb .orv-sb-bottom')], ['mobile', document.querySelector('.orv-mob-drawer .orv-mob-drawer-bottom')]].forEach(function (t) {
      var host = t[1]; if (!host || host.querySelector('.onv-foot')) return;
      host.innerHTML = footHtml(t[0]);
      host.classList.add('onv-foot-host');
      host.addEventListener('click', function (e) {
        var b = e.target.closest('[data-onv-foot]'); if (!b) return;
        var k = b.getAttribute('data-onv-foot');
        if (t[0] === 'mobile' && typeof window._orvDrawerClose === 'function') window._orvDrawerClose();
        if (k === 'assistant') { openAssistant(); return; }
        if (typeof window.orvCloseAi === 'function' && document.body.classList.contains('orv-ai-ws')) window.orvCloseAi();
        if (k === 'platforms') { H.ready = H.ready || !!(typeof _currentUser !== 'undefined' && _currentUser); if (typeof window._orvOpenPlatforms === 'function') window._orvOpenPlatforms(); setTimeout(sync, 0); return; }
        openSettings(k === 'account' ? 'account' : null);
      });
    });
    paintAccount();
    paintAssistant();
    // The legacy identity block (hidden) is what auth.js / settings.js keep
    // current: follow it.
    ['sbPlanLabel'].forEach(function (id) { var el = document.getElementById(id); if (el) new MutationObserver(paintAccount).observe(el, { childList: true, characterData: true, subtree: true }); });
    // The assistant's identity is written by js/orivenAgent.js onto the
    // (now hidden) launcher #orvAiFab: follow it, so the sidebar always shows
    // the same name, mark and colour as the chat.
    var fab = document.getElementById('orvAiFab');
    if (fab) new MutationObserver(paintAssistant).observe(fab, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'data-agent'] });
    var panel = document.getElementById('orvAiPanel');
    if (panel) new MutationObserver(paintAssistant).observe(panel, { attributes: true, attributeFilter: ['class'] });
    var tries = 0; (function again() { paintAccount(); if (++tries < 12) setTimeout(again, 700); })();
  }
  // The assistant opens as the full chat workspace (body.orv-ai-ws, styled in
  // css/orv-design.css) — the same conversation, endpoint, credit check and
  // confirmations as before (app.html orvOpenAi / orvAiSend). Clicking it while
  // it is open keeps it open and puts the cursor in the message box.
  function openAssistant() {
    document.body.classList.add('orv-ai-ws');
    var open = document.getElementById('orvAiPanel');
    if (open && open.classList.contains('orv-ai-open')) { var inp = document.getElementById('orvAiInput'); if (inp) inp.focus(); paintAssistant(); return; }
    if (typeof window.orvOpenAi === 'function') window.orvOpenAi();
    if (!(open && open.classList.contains('orv-ai-open'))) document.body.classList.remove('orv-ai-ws'); // not opened (plan without chat)
    paintAssistant();
  }
  function paintAssistant() {
    // Mirrors the launcher js/orivenAgent.js keeps current (#orvAiFab, hidden
    // since the sidebar took over): the chosen assistant's name and mark,
    // "Choose your assistant" before a choice, "Assistant" when signed out.
    var fab = document.getElementById('orvAiFab');
    var lbl = fab ? fab.querySelector('.orv-ai-fab-label') : null;
    var raw = lbl ? String(lbl.textContent || '').trim() : '';
    var chosen = !!(fab && fab.getAttribute('data-agent'));
    var name = chosen && raw ? raw : raw === 'Choose your assistant' ? tr('Choose your assistant') : tr('Assistant');
    var key = chosen ? fab.getAttribute('data-agent') : '';
    var g = chosen ? fab.querySelector('svg.orv-agent-fab-glyph') : null;
    var glyphSvg = g ? g.outerHTML.replace('orv-agent-fab-glyph', 'onv-mom__glyph') : '';
    var rgbv = fab ? fab.style.getPropertyValue('--orv-agent-rgb') : '';
    var hex = fab ? fab.style.getPropertyValue('--orv-agent') : '';
    var panel = document.getElementById('orvAiPanel');
    var isOpen = !!(panel && panel.classList.contains('orv-ai-open'));
    document.querySelectorAll('.onv-foot [data-onv-foot="assistant"]').forEach(function (b) {
      var n = b.querySelector('[data-onv-mom-name]'); if (n && n.textContent !== name) n.textContent = name;
      var ic = b.querySelector('[data-onv-mom-ic]');
      if (ic && ic.getAttribute('data-k') !== key) { ic.setAttribute('data-k', key); ic.innerHTML = glyphSvg + '<span class="onv-mom__core"></span>'; }
      if (rgbv) b.style.setProperty('--onv-mom-rgb', rgbv); else b.style.removeProperty('--onv-mom-rgb');
      if (hex) b.style.setProperty('--onv-mom', hex); else b.style.removeProperty('--onv-mom');
      if (key) b.setAttribute('data-agent', key); else b.removeAttribute('data-agent');
      var label = name + ' — ' + tr('Your AI assistant');
      b.setAttribute('aria-label', label); b.title = label;
      b.classList.toggle('is-on', isOpen);
      b.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    if (!isOpen) document.body.classList.remove('orv-ai-ws');
  }
  window.orvAppNavAssistant = { open: openAssistant, paint: paintAssistant };
  // Settings → Advertising settings → a platform: the Advertising Settings
  // page on that platform. Settings → "Connect accounts": Ad Platforms.
  function leaveSettings() {
    if (typeof window.closeModal === 'function') window.closeModal('modal-settings');
    if (document.body.classList.contains('orv-ai-ws') && typeof window.orvCloseAi === 'function') window.orvCloseAi();
    H.ready = H.ready || !!(typeof _currentUser !== 'undefined' && _currentUser);
  }
  // Settings → Advertising settings → a platform: that platform's settings in
  // Settings' own content area (no page change). Opens Settings when it is closed.
  window.orvSettingsAds = function (p) {
    var modal = document.getElementById('modal-settings'), panel = document.getElementById('smdp-ads');
    if (!modal || !panel || !window.orvAdSettings || !window.orvAdSettings.openIn) { if (window.orvAdSettings) window.orvAdSettings.openPage(p); return; }
    if (!modal.classList.contains('open')) {
      if (document.body.classList.contains('orv-ai-ws') && typeof window.orvCloseAi === 'function') window.orvCloseAi();
      if (typeof window.openSettingsModal === 'function') window.openSettingsModal(); else if (typeof window.openModal === 'function') window.openModal('modal-settings');
    }
    var plat = p || (window.orvAdSettings.current ? window.orvAdSettings.current() : 'meta');
    document.querySelectorAll('#modal-settings .smd-ni').forEach(function (b) { b.classList.remove('active'); b.removeAttribute('aria-current'); });
    document.querySelectorAll('#modal-settings .smd-ai').forEach(function (b) { var on = b.getAttribute('data-smd-ads') === plat; b.classList.toggle('active', on); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    document.querySelectorAll('#modal-settings .smd-panel').forEach(function (x) { x.classList.toggle('active', x === panel); });
    window.orvAdSettings.openIn(panel, plat);
    var content = panel.closest('.smd-content'); if (content) content.scrollTop = 0;
    var sel = document.querySelector('#modal-settings .smd-ai.active'); if (sel && sel.scrollIntoView && window.innerWidth <= 600) { try { sel.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (_) {} }
  };
  // Kept for older callers: same as above.
  window.orvOpenAdSettings = function (p) { window.orvSettingsAds(p); };
  // A General settings item clears the platform selection.
  (function wrapSmdNav() {
    if (typeof window.smdNav !== 'function' || window.smdNav._ads) { if (typeof window.smdNav !== 'function') document.addEventListener('DOMContentLoaded', wrapSmdNav); return; }
    var orig = window.smdNav;
    window.smdNav = function () { document.querySelectorAll('#modal-settings .smd-ai').forEach(function (b) { b.classList.remove('active'); b.removeAttribute('aria-current'); }); return orig.apply(this, arguments); };
    window.smdNav._ads = true;
  })();
  window.orvOpenAdPlatformsFromSettings = function () { leaveSettings(); if (typeof window._orvOpenPlatforms === 'function') window._orvOpenPlatforms(); setTimeout(sync, 0); };
  function openSettings(section) {
    if (typeof window.openSettingsModal !== 'function') return;
    window.openSettingsModal();
    if (section) { var b = document.querySelector('.smd-ni[data-smd="' + section + '"]'); if (b && typeof window.smdNav === 'function') window.smdNav(b); }
  }
  // Workspace names that say nothing about the account (the defaults).
  var GENERIC = /^(|account|oriven|orivenai|oriven ai|my workspace|workspace|—|-)$/i;
  // The plan, from the account's access (auth.js orvAccess): the period plan
  // and until when, a legacy plan's name, or that there's no active plan.
  // Never the product name (the generic 'paid' plan is called OrivenAI).
  function planLine(label) {
    var acc = typeof window.orvAccess === 'function' ? window.orvAccess() : null;
    if (acc) {
      if (!acc.active) return 'No active plan';
      var p = acc.plan && typeof window.orvPeriodPlan === 'function' ? window.orvPeriodPlan(acc.plan) : null;
      var legacy = typeof ORIVEN_PLANS !== 'undefined' && ORIVEN_PLANS[acc.status] && acc.status !== 'paid' ? ORIVEN_PLANS[acc.status].name : null;
      var nm = (p && p.name) || legacy || 'Active plan';
      var until = acc.expiresAt ? new Date(acc.expiresAt) : null;
      return nm + (until && !isNaN(until) ? ' · until ' + until.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');
    }
    if (!label || label === '—' || GENERIC.test(label)) return '';
    return /^no (plan|subscription)$/i.test(label) ? 'No active plan' : label;
  }
  // The person's first name: profiles.first_name (entered at sign-up,
  // editable in Settings → Account; read once per account), else the first
  // name in the sign-up details. First word only — never a surname, the
  // email or the workspace name.
  var NAME = { uid: null, first: null, loading: false };
  function firstName(u) {
    if (!u || !u.id) return '';
    if (NAME.uid !== u.id) { NAME.uid = u.id; NAME.first = null; NAME.loading = false; }
    if (NAME.first === null && !NAME.loading && typeof SB !== 'undefined' && SB && typeof SB.from === 'function') {
      NAME.loading = true;
      var uid = u.id;
      Promise.resolve(SB.from('profiles').select('first_name').eq('id', uid).maybeSingle()).then(function (res) {
        if (NAME.uid !== uid) return;
        NAME.loading = false; NAME.first = (res && res.data && res.data.first_name) || ''; paintAccount();
      }, function () { if (NAME.uid !== uid) return; NAME.loading = false; NAME.first = ''; paintAccount(); });
    }
    var meta = (u.user_metadata && (u.user_metadata.first_name || u.user_metadata.firstName)) || '';
    return String(NAME.first || meta || '').trim().split(/\s+/)[0] || '';
  }
  // Settings → Account saved a new name.
  window.orvAppNavSetFirstName = function (n) { NAME.first = String(n || ''); paintAccount(); };
  // The signed-in person's first name, or '' when unknown (never the
  // "Your account" placeholder): the assistant's greeting uses it.
  window.orvAppNavFirstName = function () { var u = typeof window._getCurrentUser === 'function' ? window._getCurrentUser() : null; return firstName(u); };
  function paintAccount() {
    var planEl = document.getElementById('sbPlanLabel');
    var u = typeof window._getCurrentUser === 'function' ? window._getCurrentUser() : null;
    var name = firstName(u) || 'Your account';
    var plan = planLine(planEl ? String(planEl.textContent || '').trim() : '');
    document.querySelectorAll('.onv-foot').forEach(function (f) {
      var n = f.querySelector('[data-onv-name]'), p = f.querySelector('[data-onv-plan]'), av = f.querySelector('[data-onv-av]'), main = f.querySelector('.onv-acct__main');
      if (n && n.textContent !== name) n.textContent = name;
      if (p && p.textContent !== plan) { p.textContent = plan; p.hidden = !plan; }
      if (av) av.textContent = (name.replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || '·').toUpperCase();
      if (main) { main.setAttribute('aria-label', 'Account: ' + name + (plan ? ', ' + plan : '')); main.title = name; }
    });
  }
  window.orvAppNavAccount = paintAccount;

  // ── Panel page: in-development pages and the Campaign Builder chooser ──
  function mountPanel() {
    var mc = document.querySelector('.mc'); if (!mc || document.getElementById('page-orv-panel')) return;
    var pg = document.createElement('div');
    pg.className = 'page'; pg.id = 'page-orv-panel';
    pg.innerHTML = '<div class="onv-panel" id="onvPanel"></div>';
    mc.appendChild(pg);
    pg.addEventListener('click', function (e) {
      var g = e.target.closest('[data-onv-go]'); if (g) { go(g.getAttribute('data-onv-go')); return; }
      var o = e.target.closest('[data-onv-open]'); if (o && typeof window.openCampaignWorkspace === 'function') window.openCampaignWorkspace(o.getAttribute('data-onv-open'));
      var a = e.target.closest('[data-onv-aud]'); if (a) { applyAudience(a.getAttribute('data-onv-aud')); return; }
      if (e.target.closest('[data-onv-aud-clear]')) { try { sessionStorage.removeItem('orv_pending_audience'); } catch (_) {} openPanel('builder'); }
    });
  }
  // An audience chosen in Audience Builder (js/audienceBuilder.js "Use in
  // Campaign Builder"), waiting to be applied to a campaign.
  function pendingAudience() { try { var v = JSON.parse(sessionStorage.getItem('orv_pending_audience') || 'null'); return v && v.text ? v : null; } catch (_) { return null; } }
  // A published campaign's audience lives in the ad platform now; changing
  // OrivenAI's copy wouldn't change it there, so it isn't offered.
  function isPublished(c) { var s = String((c && c.status) || '').toLowerCase(); return !!(c && (c.publishedAt || c.platformCampaignId)) || s === 'published' || s === 'active' || s === 'live'; }
  function applyAudience(campId) {
    var aud = pendingAudience(); if (!aud) return;
    var C = window.orvWorkspace && window.orvWorkspace.campaigns;
    var c = C && C.local ? C.local().filter(function (x) { return x && x.id === campId; })[0] : null;
    if (!c || !c.pkg || isPublished(c) || typeof window._orvUpdateCampPkg !== 'function') return;
    // The same fields the campaign editor's audience change writes.
    var pkg = JSON.parse(JSON.stringify(c.pkg));
    pkg.strategy = pkg.strategy || {}; pkg.strategy.targetAudience = aud.text;
    if (pkg.metaAds) pkg.metaAds.targetAudience = aud.text;
    if (pkg.tiktokAds) pkg.tiktokAds.targetAudience = aud.text;
    var ok = window._orvUpdateCampPkg(campId, pkg);
    if (ok !== false) { try { sessionStorage.removeItem('orv_pending_audience'); } catch (_) {} }
    if (typeof window.orvToast === 'function') window.orvToast(ok !== false ? '“' + aud.name + '” is now the audience of ' + (c.name || 'this campaign') : 'The audience couldn’t be saved. Please try again.', ok !== false ? 'ok' : 'warn');
    openPanel('builder');
  }
  function showPanelPage() {
    document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
    var pg = document.getElementById('page-orv-panel'); if (pg) pg.classList.add('active');
    // the hub tab strips (Campaigns…) belong to their own pages, not this one
    document.querySelectorAll('.orv-hub-tabs').forEach(function (t) { t.style.display = 'none'; });
    var mc = document.querySelector('.mc'); if (mc) mc.scrollTop = 0;
  }
  function openPanel(id) {
    S.panel = id;
    var host = document.getElementById('onvPanel');
    if (host) host.innerHTML = builderHtml();
    showPanelPage();
    sync();
  }
  // Campaign Builder: the existing campaign editor works on one campaign;
  // this is the way in. Real campaigns only (the same list the app keeps).
  function builderHtml() {
    var list = [];
    // The app's shared campaign list (the same one Planning and Ad Studio read).
    try { var C = window.orvWorkspace && window.orvWorkspace.campaigns; list = C && C.local ? C.local().filter(function (c) { return c && c.status !== 'archived'; }) : []; } catch (_) {}
    list.sort(function (a, b) { return String(b.created || b.publishedAt || '').localeCompare(String(a.created || a.publishedAt || '')); });
    var stage = function (c) { try { return window.orvWorkspace && window.orvWorkspace.campaigns && window.orvWorkspace.campaigns.stage ? window.orvWorkspace.campaigns.stage(c).label : ''; } catch (_) { return ''; } };
    var curId = window._cgrCurrentCampId || null;
    var cur = curId && list.filter(function (c) { return c.id === curId; })[0];
    var aud = pendingAudience();
    var rows = list.slice(0, 50).map(function (c) {
      var plat = c.platform ? String(c.platform).charAt(0).toUpperCase() + String(c.platform).slice(1) : '';
      var meta = [plat, stage(c)].filter(Boolean).join(' · ');
      var useAud = aud ? (isPublished(c) ? '<span class="onv-cb__note">Published — change its audience in the ad platform</span>' : !c.pkg ? '<span class="onv-cb__note">No ads yet — open it in the builder first</span>' : '<button type="button" class="onv-btn onv-btn--primary" data-onv-aud="' + esc(c.id) + '">Use this audience</button>') : '';
      return '<li><div class="onv-cb__c"><b>' + esc(c.name || 'Untitled campaign') + '</b>' + (meta ? '<span>' + esc(meta) + '</span>' : '') + '</div>' + useAud +
        '<button type="button" class="onv-btn" data-onv-open="' + esc(c.id) + '">Open in builder</button></li>';
    }).join('');
    var audBanner = aud ? '<div class="onv-cb__aud" role="status"><span>Audience ready to use: <b>' + esc(aud.name) + '</b> — choose a campaign that isn’t published yet.</span><button type="button" class="onv-btn" data-onv-aud-clear>Cancel</button></div>' : '';
    return '<section class="onv-cb" aria-labelledby="onvCbH">' +
      '<header class="onv-cb__head"><h1 id="onvCbH">Campaign Builder</h1><p>Choose a campaign to edit its ads, audiences and settings. Campaigns come from Create; when one is ready, publish it from Ad Studio.</p></header>' +
      audBanner +
      (cur ? '<button type="button" class="onv-cb__resume" data-onv-open="' + esc(cur.id) + '"><span>Continue where you left off</span><b>' + esc(cur.name || 'Untitled campaign') + '</b></button>' : '') +
      (list.length ? '<ul class="onv-cb__list">' + rows + '</ul>'
        : '<div class="onv-cb__empty"><p>You don’t have any campaigns yet. Create your first ads and the campaign opens here.</p><button type="button" class="onv-btn onv-btn--primary" data-onv-go="create">Go to Create</button></div>') +
      '</section>';
  }

  // ── Navigation ───────────────────────────────────────────────────
  function go(id) {
    var it = ITEMS[id]; if (!it) return;
    if (!H.pop) { H.target = id; H.targetAt = Date.now(); }
    if (!H.pop && H.initial === null) H.ready = H.ready || !!window._currentUser || (typeof _currentUser !== 'undefined' && !!_currentUser);
    S.justId = id;
    // Opening a page leaves the assistant workspace (the conversation is kept).
    if (document.body.classList.contains('orv-ai-ws') && typeof window.orvCloseAi === 'function') window.orvCloseAi();
    it.go();
    setTimeout(sync, 0);
  }

  // What is on screen now → which page of the navigation that is.
  function detect() {
    var pg = document.querySelector('.page.active');
    var pid = pg && pg.id;
    if (!pid) return null;
    if (pid === 'page-orv-panel') return S.panel;
    if (pid === 'page-marketing-plan') return 'plan';
    if (pid === 'page-progress') return 'progress';
    if (pid === 'page-business-brain') {
      // The older Planning tab (advertising plans, budget, briefs) is still
      // reachable from the Dashboard; it belongs to Control Center, not to
      // the Marketing Plan page.
      var tab = typeof window._bizActiveTab === 'string' ? window._bizActiveTab : (typeof _bizActiveTab !== 'undefined' ? _bizActiveTab : 'overview');
      return tab === 'connections' ? null : 'dashboard';
    }
    if (pid === 'page-dashboard' || pid === 'page-overview') return 'dashboard';
    if (pid === 'page-insights') return 'insights';
    if (pid === 'page-my-content') return 'content';
    if (pid === 'page-competitor-analysis') return 'competitors';
    if (pid === 'page-ad-simulator') return 'simulator';
    if (pid === 'page-creative-testing') return 'testing';
    if (pid === 'page-audience-builder') return 'audiences';
    if (pid === 'page-campaign-comparison') return 'compare';
    if (pid === 'page-research') {
      if (window.orvResearch && window.orvResearch.mode && window.orvResearch.mode() === 'insights') return 'insights'; // a report opened from Insights
      return window.orvResearch && window.orvResearch.area && window.orvResearch.area() === 'competitive' ? 'competitive' : 'research';
    }
    if (pid === 'page-needs-attention') return 'attention';
    if (pid === 'page-ads-vs-ads') return 'adsvsads';
    if (pid === 'page-create' || pid === 'page-create-workspace' || pid === 'page-creative-workspace') return 'create';
    if (pid === 'page-launch') return 'adstudio';
    if (pid === 'page-performance' || pid === 'page-campaigns' || pid === 'page-ads-manager') return 'overview';
    if (pid === 'page-campaign-results' || pid === 'page-campaign-workspace' || pid === 'page-ad-workspace') return 'builder'; // the campaign editor(s)
    if (pid === 'page-autopilot') {
      var t = window.orvAutomations && window.orvAutomations.tab ? window.orvAutomations.tab() : null;
      return ITEMS['auto-' + t] ? 'auto-' + t : 'auto-overview';
    }
    return null;
  }

  // ── Addresses: /app?view=<page> ────────────────────────────────────
  // Read before sign-in rewrites the address to /app. After sign-in the
  // start page routing (js/auth.js _orvGoStartPage) opens that page instead
  // of the Dashboard; from then on each page opened gets a history entry, so
  // Back/Forward move between pages and a refresh stays on the page.
  // Payment returns (?success=, ?session_id=) and onboarding deep links keep
  // their own handling: a view is only used on a plain /app?view= address.
  var VIEWS = Object.keys(ITEMS).concat(['platforms', 'adsettings']);
  var H = { ready: false, pop: null, initial: null, target: null, targetAt: 0 };
  (function () {
    try {
      var q = new URLSearchParams(location.search);
      var v = q.get('view');
      if (v && VIEWS.indexOf(v) >= 0 && !q.get('success') && !q.get('session_id') && !q.get('canceled')) H.initial = v;
    } catch (_) {}
  })();
  function viewId(id) {
    if (id) return id;
    var pg = document.querySelector('.page.active');
    if (pg && pg.id === 'page-ad-settings') return 'adsettings';
    var tab = typeof window._bizActiveTab === 'string' ? window._bizActiveTab : (typeof _bizActiveTab !== 'undefined' ? _bizActiveTab : '');
    return pg && pg.id === 'page-business-brain' && tab === 'connections' ? 'platforms' : null;
  }
  function openView(v) {
    if (v === 'platforms') { if (typeof window._orvOpenPlatforms === 'function') window._orvOpenPlatforms(); setTimeout(sync, 0); return; }
    if (v === 'adsettings') { if (window.orvAdSettings) window.orvAdSettings.open(); setTimeout(sync, 0); return; }
    go(v);
  }
  function record(v) {
    if (!H.ready || !v || document.body.classList.contains('guest-mode') || document.getElementById('onx')) return;
    var cur = null; try { cur = new URLSearchParams(location.search).get('view'); } catch (_) {}
    if (H.pop === v) { H.pop = null; if (cur !== v) try { history.replaceState({ onv: v }, '', '/app?view=' + v); } catch (_) {} return; }
    if (H.target && Date.now() - H.targetAt < 2500) { if (v !== H.target) return; H.target = null; }
    if (cur === v) return;
    try { history.pushState({ onv: v }, '', '/app?view=' + v); } catch (_) {}
  }
  function signedIn() { return !!((typeof _currentUser !== 'undefined' && _currentUser) || window._currentUser) && !document.body.classList.contains('guest-mode'); }
  // After sign-in the start page routing normally hands over (hookStartPage);
  // if it doesn't run (an error path), apply the requested page — or start
  // recording from the current one — once the signed-in app has settled.
  function settleAfterSignIn() {
    var seen = 0, tries = 0;
    (function tick() {
      if (H.ready && H.initial === null) return;
      if (signedIn()) {
        if (!seen) seen = Date.now();
        if (Date.now() - seen >= 1200 && !document.getElementById('onx')) {
          var v = H.initial; H.initial = null;
          if (v && !window._orvNavSinceSignIn) openView(v);
          setTimeout(function () { H.ready = true; var c = viewId(detect()); if (c) try { history.replaceState({ onv: c }, '', '/app?view=' + c); } catch (_) {} }, v ? 600 : 0);
          return;
        }
      } else seen = 0;
      if (++tries < 600) setTimeout(tick, 250);
    })();
  }
  function hookStartPage() {
    var orig = window._orvGoStartPage;
    if (typeof orig !== 'function' || orig._onv) return;
    var wrapped = function () {
      var v = H.initial; H.initial = null;
      if (v && !window._orvNavSinceSignIn) {
        openView(v);
        setTimeout(function () { H.ready = true; try { history.replaceState({ onv: v }, '', '/app?view=' + v); } catch (_) {} }, 0);
        return;
      }
      var r = orig.apply(this, arguments);
      setTimeout(function () { H.ready = true; var c = viewId(detect()); if (c) try { history.replaceState({ onv: c }, '', '/app?view=' + c); } catch (_) {} }, 0);
      return r;
    };
    wrapped._onv = true;
    window._orvGoStartPage = wrapped;
  }
  window.addEventListener('popstate', function (e) {
    var v = e.state && e.state.onv;
    if (!v) { try { v = new URLSearchParams(location.search).get('view'); } catch (_) {} }
    if (!v || VIEWS.indexOf(v) < 0 || document.body.classList.contains('guest-mode')) return;
    H.pop = v; H.ready = true;
    openView(v);
  });

  function sync() {
    var id = detect();
    var changed = id !== S.current;
    S.current = id;
    var sec = id ? SECTION_OF[id] : null;
    var pgAct = document.querySelector('.page.active');
    var onPlatforms = !!(pgAct && pgAct.id === 'page-business-brain' && (typeof window._bizActiveTab === 'string' ? window._bizActiveTab : (typeof _bizActiveTab !== 'undefined' ? _bizActiveTab : '')) === 'connections');
    var onAdSettings = !!(pgAct && pgAct.id === 'page-ad-settings');
    // Advertising Settings lives inside Settings: on its page, Settings is the lit item.
    document.querySelectorAll('.onv-foot [data-onv-foot="settings"]').forEach(function (b) { b.classList.toggle('is-on', onAdSettings); if (onAdSettings) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.querySelectorAll('.onv-foot [data-onv-foot="platforms"]').forEach(function (b) { b.classList.toggle('is-on', onPlatforms); if (onPlatforms) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    S.roots.forEach(function (root) {
      var shownId = navTarget(id);
      root.querySelectorAll('.onv-item').forEach(function (b) {
        var on = b.getAttribute('data-onv') === shownId;
        b.classList.toggle('is-on', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      root.querySelectorAll('.onv-sec').forEach(function (s) {
        var active = !!sec && s.getAttribute('data-sec') === sec.id;
        s.classList.toggle('is-active', active);
        // the route line fills down to the open page
        var fill = active ? (ITEMS[navTarget(id)].index + 0.5) / sec.shown.length : 0;
        var bar = s.querySelector('.onv-route i'); if (bar) bar.style.setProperty('--fill', fill.toFixed(3));
      });
    });
    if (changed || (H.ready && !id)) record(viewId(id));
    if (changed) {
      // keep the open page visible in a long sidebar
      S.roots.forEach(function (root) { var b = root.querySelector('.onv-item.is-on'); if (b && b.scrollIntoView && root.closest('.orv-sb')) { try { b.scrollIntoView({ block: 'nearest' }); } catch (_) {} } });
      if (id) {
        // one-shot icon motion on the newly opened page (the page itself enters with the app's own orvPageIn)
        S.roots.forEach(function (root) { var b = root.querySelector('.onv-item[data-onv="' + navTarget(id) + '"]'); if (b) { b.classList.remove('is-just'); void b.offsetWidth; b.classList.add('is-just'); } });
        clearTimeout(S.justTimer);
        S.justTimer = setTimeout(function () { document.querySelectorAll('.onv-item.is-just').forEach(function (b) { b.classList.remove('is-just'); }); }, 900);
      }
    }
  }
  var raf = 0;
  function schedule() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; sync(); }); }

  function watch() {
    // Page switches (any path), Control Center tabs, Automations tabs.
    var mo = new MutationObserver(schedule);
    document.querySelectorAll('.mc .page, .page').forEach(function (p) { mo.observe(p, { attributes: true, attributeFilter: ['class'] }); });
    var mc = document.querySelector('.mc');
    if (mc) new MutationObserver(function (list) {
      list.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1 && n.classList && n.classList.contains('page')) mo.observe(n, { attributes: true, attributeFilter: ['class'] }); }); });
    }).observe(mc, { childList: true });
    if (typeof window.bizSwitchTab === 'function' && !window.bizSwitchTab._onv) {
      var orig = window.bizSwitchTab;
      window.bizSwitchTab = function () { var r = orig.apply(this, arguments); schedule(); return r; };
      window.bizSwitchTab._onv = true;
    }
  }

  function init() {
    if (!document.querySelector('.orv-sb .orv-sb-nav')) return;
    hookStartPage();
    settleAfterSignIn();
    // Follow Settings → Language like the pages do.
    if (typeof window.applyLanguage === 'function' && !window.applyLanguage._onv) {
      var origLang = window.applyLanguage;
      window.applyLanguage = function () { var r = origLang.apply(this, arguments); try { relabel(); paintAssistant(); } catch (_) {} return r; };
      window.applyLanguage._onv = true;
    }
    relabel();
    mount();
    watch();
    sync();
  }
  // The page open now, as a sidebar id ('plan', 'audiences', … or 'platforms'),
  // and its label: the assistant sends the id as context.view (the server
  // checks it against its own list) and shows the label.
  function view() {
    var id = detect(); if (id) return id;
    var pg = document.querySelector('.page.active');
    var tab = typeof window._bizActiveTab === 'string' ? window._bizActiveTab : (typeof _bizActiveTab !== 'undefined' ? _bizActiveTab : '');
    return pg && pg.id === 'page-business-brain' && tab === 'connections' ? 'platforms' : null;
  }
  function viewLabel(id) { return id === 'adsettings' ? tr('Advertising Settings') : id === 'platforms' ? tr('Ad Platforms') : (ITEMS[id] ? tr(ITEMS[id].label) : ''); }
  window.orvAppNav = { go: go, sync: sync, sections: SECTIONS, view: view, viewLabel: viewLabel, _detect: detect, _history: H };
  window.orvAppNavSync = schedule;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
