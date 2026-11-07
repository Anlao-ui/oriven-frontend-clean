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

  var SECTIONS = [
    { id: 'cc', n: '01', name: 'Control Center', items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', go: biz('overview') },
      { id: 'plan', label: 'Marketing Plan', icon: 'plan', go: planPage('plan') },
      { id: 'progress', label: 'Progress', icon: 'progress', go: planPage('progress') },
    ] },
    { id: 'rs', n: '02', name: 'Research', items: [
      { id: 'research', label: 'Research', icon: 'research', go: page('research', 'page-research') },
      { id: 'insights', label: 'Insights', icon: 'insights', go: function () { if (window.orvInsights) window.orvInsights.open(); } },
      { id: 'competitors', label: 'Competitor Analysis', icon: 'competitors', go: function () { if (window.orvCompetitors) window.orvCompetitors.open(); } },
    ] },
    { id: 'cr', n: '03', name: 'Create', items: [
      { id: 'create', label: 'Create', icon: 'create', go: page('create', 'page-create') },
      { id: 'content', label: 'My Content', icon: 'content', go: function () { if (window.orvMyContent) window.orvMyContent.open(); } },
      { id: 'testing', label: 'Creative Testing', icon: 'testing', go: function () { if (window.orvCreativeTesting) window.orvCreativeTesting.open(); } },
    ] },
    { id: 'la', n: '04', name: 'Launch', items: [
      { id: 'adstudio', label: 'Ad Studio', icon: 'studio', go: page('launch', 'page-launch') },
      { id: 'audiences', label: 'Audience Builder', icon: 'audience', go: function () { if (window.orvAudienceBuilder) window.orvAudienceBuilder.open(); } },
    ] },
    { id: 'ca', n: '05', name: 'Campaigns', items: [
      { id: 'overview', label: 'Campaign Overview', icon: 'overview', go: page('performance', 'page-performance') },
      { id: 'builder', label: 'Campaign Builder', icon: 'builder', go: function () { openPanel('builder'); } },
      { id: 'compare', label: 'Campaign Comparison', icon: 'compare', go: function () { if (window.orvCampaignComparison) window.orvCampaignComparison.open(); } },
    ] },
    { id: 'au', n: '06', name: 'Automations', items: [
      { id: 'auto-overview', label: 'Overview', icon: 'nodes', go: autoTab('overview') },
      { id: 'auto-scheduler', label: 'Scheduler', icon: 'scheduler', go: autoTab('scheduler') },
      { id: 'auto-rules', label: 'Rules', icon: 'rules', go: autoTab('rules') },
      { id: 'auto-activity', label: 'Activity', icon: 'activity', go: autoTab('activity') },
    ] },
  ];
  var ITEMS = {}, SECTION_OF = {};
  SECTIONS.forEach(function (s) { s.items.forEach(function (it, i) { ITEMS[it.id] = it; SECTION_OF[it.id] = s; it.index = i; }); });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ── Labels in the app language ───────────────────────────────────
  // Product names (Control Center, Dashboard, Launch, Ad Studio) stay as they
  // are everywhere in the app; the rest follows Settings → Language, with the
  // same words the pages themselves use (Automations' page names, Campaigns).
  var L10N = {
    nl: { 'Research': 'Onderzoek', 'Create': 'Maken', 'Campaigns': 'Campagnes', 'Automations': 'Automatiseringen', 'Marketing Plan': 'Marketingplan', 'Progress': 'Voortgang', 'Insights': 'Inzichten', 'My Content': 'Mijn content', 'Campaign Overview': 'Campagne-overzicht', 'Campaign Builder': 'Campagnebouwer', 'Overview': 'Overzicht', 'Scheduler': 'Planner', 'Rules': 'Regels', 'Activity': 'Activiteit', 'Ad Platforms': 'Advertentieplatforms', 'Account': 'Account', 'Settings': 'Instellingen' },
    de: { 'Research': 'Recherche', 'Create': 'Erstellen', 'Campaigns': 'Kampagnen', 'Automations': 'Automatisierungen', 'Marketing Plan': 'Marketingplan', 'Progress': 'Fortschritt', 'Insights': 'Erkenntnisse', 'My Content': 'Meine Inhalte', 'Campaign Overview': 'Kampagnenübersicht', 'Campaign Builder': 'Kampagnen-Builder', 'Overview': 'Übersicht', 'Scheduler': 'Planer', 'Rules': 'Regeln', 'Activity': 'Aktivität', 'Ad Platforms': 'Werbeplattformen', 'Account': 'Konto', 'Settings': 'Einstellungen' },
    fr: { 'Research': 'Recherche', 'Create': 'Créer', 'Campaigns': 'Campagnes', 'Automations': 'Automatisations', 'Marketing Plan': 'Plan marketing', 'Progress': 'Progression', 'Insights': 'Enseignements', 'My Content': 'Mes contenus', 'Campaign Overview': 'Aperçu des campagnes', 'Campaign Builder': 'Création de campagne', 'Overview': 'Aperçu', 'Scheduler': 'Planificateur', 'Rules': 'Règles', 'Activity': 'Activité', 'Ad Platforms': 'Plateformes publicitaires', 'Account': 'Compte', 'Settings': 'Paramètres' },
    es: { 'Research': 'Investigación', 'Create': 'Crear', 'Campaigns': 'Campañas', 'Automations': 'Automatizaciones', 'Marketing Plan': 'Plan de marketing', 'Progress': 'Progreso', 'Insights': 'Hallazgos', 'My Content': 'Mi contenido', 'Campaign Overview': 'Resumen de campañas', 'Campaign Builder': 'Creador de campañas', 'Overview': 'Resumen', 'Scheduler': 'Programador', 'Rules': 'Reglas', 'Activity': 'Actividad', 'Ad Platforms': 'Plataformas de anuncios', 'Account': 'Cuenta', 'Settings': 'Ajustes' },
    pt: { 'Research': 'Pesquisa', 'Create': 'Criar', 'Campaigns': 'Campanhas', 'Automations': 'Automações', 'Marketing Plan': 'Plano de marketing', 'Progress': 'Progresso', 'Insights': 'Descobertas', 'My Content': 'Meu conteúdo', 'Campaign Overview': 'Visão geral das campanhas', 'Campaign Builder': 'Criador de campanhas', 'Overview': 'Visão geral', 'Scheduler': 'Agendador', 'Rules': 'Regras', 'Activity': 'Atividade', 'Ad Platforms': 'Plataformas de anúncios', 'Account': 'Conta', 'Settings': 'Configurações' },
  };
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
  function navHtml(where) {
    return SECTIONS.map(function (s) {
      return '<section class="onv-sec" data-sec="' + s.id + '" aria-labelledby="onvH-' + where + '-' + s.id + '">' +
        // A heading, not a control: no link, no button, no hover.
        '<h2 class="onv-sec__h" id="onvH-' + where + '-' + s.id + '"><span class="onv-sec__n" aria-hidden="true">' + s.n + '</span><span class="onv-sec__t" data-onv-t="' + esc(s.name) + '">' + esc(tr(s.name)) + '</span></h2>' +
        '<div class="onv-route" aria-hidden="true"><i></i></div>' +
        '<ul class="onv-list">' + s.items.map(function (it) {
          return '<li><button type="button" class="onv-item' + (it.dev ? ' is-dev' : '') + '" data-onv="' + it.id + '" title="' + esc(tr(it.label)) + '">' +
            '<span class="onv-ic">' + svg(it.icon) + '</span><span class="onv-lbl" data-onv-t="' + esc(it.label) + '">' + esc(tr(it.label)) + '</span>' +
            (it.dev ? '<span class="onv-dev" aria-label="in development">Soon</span>' : '') + '</button></li>';
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

  // ── Footer: Ad Platforms, then one account row with Settings ───────────
  // Ad Platforms is a page like the others (same item, hover, active state
  // and icon motion). The account row shows who is signed in and the plan;
  // it opens the existing Settings modal at Account, the gear at General —
  // the one Settings surface the app has. Ids other code relies on are kept:
  // #orvNavSettingsBtn (tour step), #orvSbWorkspace / #orvSbAvatar (written
  // by settings.js and the old rail tooltip; hidden here).
  function footHtml(where) {
    var d = where === 'desktop';
    return '<div class="onv onv-foot" data-onv-root="foot-' + where + '">' +
      '<button type="button" class="onv-item" data-onv-foot="platforms"' + (d ? ' id="orvLauncherBtn"' : '') + ' title="' + esc(tr('Ad Platforms')) + '"><span class="onv-ic">' + svg('platforms') + '</span><span class="onv-lbl" data-onv-t="Ad Platforms">' + esc(tr('Ad Platforms')) + '</span></button>' +
      '<div class="onv-acct">' +
        '<button type="button" class="onv-acct__main" data-onv-foot="account" data-onv-ta="Account" aria-label="' + esc(tr('Account')) + '"><span class="onv-acct__av" aria-hidden="true" data-onv-av>·</span>' +
          '<span class="onv-acct__t"><b data-onv-name></b><span data-onv-plan></span></span></button>' +
        '<button type="button" class="onv-acct__gear onv-item" data-onv-foot="settings"' + (d ? ' id="orvNavSettingsBtn"' : '') + ' data-onv-ta="Settings" aria-label="' + esc(tr('Settings')) + '" title="' + esc(tr('Settings')) + '"><span class="onv-ic">' + svg('gear') + '</span></button>' +
      '</div>' +
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
        if (k === 'platforms') { H.ready = H.ready || !!(typeof _currentUser !== 'undefined' && _currentUser); if (typeof window._orvOpenPlatforms === 'function') window._orvOpenPlatforms(); setTimeout(sync, 0); return; }
        openSettings(k === 'account' ? 'account' : null);
      });
    });
    paintAccount();
    // The legacy identity block (hidden) is what auth.js / settings.js keep
    // current: follow it.
    ['sbPlanLabel'].forEach(function (id) { var el = document.getElementById(id); if (el) new MutationObserver(paintAccount).observe(el, { childList: true, characterData: true, subtree: true }); });
    var tries = 0; (function again() { paintAccount(); if (++tries < 12) setTimeout(again, 700); })();
  }
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
    if (pid === 'page-creative-testing') return 'testing';
    if (pid === 'page-audience-builder') return 'audiences';
    if (pid === 'page-campaign-comparison') return 'compare';
    if (pid === 'page-research') return window.orvResearch && window.orvResearch.mode && window.orvResearch.mode() === 'insights' ? 'insights' : 'research'; // a report opened from Insights
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
  var VIEWS = Object.keys(ITEMS).concat(['platforms']);
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
    var tab = typeof window._bizActiveTab === 'string' ? window._bizActiveTab : (typeof _bizActiveTab !== 'undefined' ? _bizActiveTab : '');
    return pg && pg.id === 'page-business-brain' && tab === 'connections' ? 'platforms' : null;
  }
  function openView(v) {
    if (v === 'platforms') { if (typeof window._orvOpenPlatforms === 'function') window._orvOpenPlatforms(); setTimeout(sync, 0); return; }
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
    document.querySelectorAll('.onv-foot [data-onv-foot="platforms"]').forEach(function (b) { b.classList.toggle('is-on', onPlatforms); if (onPlatforms) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    S.roots.forEach(function (root) {
      root.querySelectorAll('.onv-item').forEach(function (b) {
        var on = b.getAttribute('data-onv') === id;
        b.classList.toggle('is-on', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      root.querySelectorAll('.onv-sec').forEach(function (s) {
        var active = !!sec && s.getAttribute('data-sec') === sec.id;
        s.classList.toggle('is-active', active);
        // the route line fills down to the open page
        var fill = active ? (ITEMS[id].index + 0.5) / sec.items.length : 0;
        var bar = s.querySelector('.onv-route i'); if (bar) bar.style.setProperty('--fill', fill.toFixed(3));
      });
    });
    if (changed || (H.ready && !id)) record(viewId(id));
    if (changed) {
      // keep the open page visible in a long sidebar
      S.roots.forEach(function (root) { var b = root.querySelector('.onv-item.is-on'); if (b && b.scrollIntoView && root.closest('.orv-sb')) { try { b.scrollIntoView({ block: 'nearest' }); } catch (_) {} } });
      if (id) {
        // one-shot icon motion on the newly opened page (the page itself enters with the app's own orvPageIn)
        S.roots.forEach(function (root) { var b = root.querySelector('.onv-item[data-onv="' + id + '"]'); if (b) { b.classList.remove('is-just'); void b.offsetWidth; b.classList.add('is-just'); } });
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
      window.applyLanguage = function () { var r = origLang.apply(this, arguments); try { relabel(); } catch (_) {} return r; };
      window.applyLanguage._onv = true;
    }
    relabel();
    mount();
    watch();
    sync();
  }
  window.orvAppNav = { go: go, sync: sync, sections: SECTIONS, _detect: detect, _history: H };
  window.orvAppNavSync = schedule;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
