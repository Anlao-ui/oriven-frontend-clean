/* ════════════════════════════════════════════════════════════════
   Campaigns page (#page-launch) — the page's card structure (2026-11-25
   refinement). The launch queue itself (filters, campaign cards, Launch
   Control) is unchanged and still rendered by app.html
   (_launchRenderFilteredList, which calls paint() after each render); this only arranges it:

     [ All campaigns ][ Published ][ Ready to launch ][ Needs attention ]
     [ Your campaigns: filters + list      ][ Status            ]
     [                                      ][ Next step         ]
     [                                      ][ Results           ]

   Every number is counted from the same real list the queue shows
   (_lqAllPending + orvLaunch.cardState); with no campaigns the cards stay
   and say what will appear there and how to make the first one.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var STR = {
    en: { all: 'All campaigns', allS: 'on every platform', live: 'Published', liveS: 'created paused on the platform', ready: 'Ready to launch', readyS: 'checked, waiting for you', att: 'Needs attention', attS: 'blocked or failed', list: 'Your campaigns', listS: 'Every campaign you made in OrivenAI, per platform. Open one to run the pre-flight check and launch it.', status: 'Status', statusEmpty: 'Status counts appear here once you have campaigns.', next: 'Next step', results: 'Results', resultsS: 'Published campaigns start paused. Once they run, spend, clicks and conversions — as each platform reports them — appear in Performance Overview.', openPerf: 'Open Performance Overview', emptyT: 'No campaigns yet', emptyS: 'Campaigns you build in Create Ads appear here, grouped by platform, with a readiness check before anything goes live.', create: 'Create a campaign', sim: 'Plan the budget in Ad Simulator', nAtt: '{n} campaign(s) need attention before they can launch.', showThem: 'Show them', nReady: '{n} campaign(s) are ready to launch.', review: 'Review', allLive: 'Everything you made is published. Follow the results in Performance Overview.', firstOne: 'Start with one campaign: make it in Create Ads, then review and launch it here.', warn: 'Ready with warnings', blocked: 'Blocked', failed: 'Publishing failed', other: 'Other' },
    nl: { all: 'Alle campagnes', allS: 'op alle platforms', live: 'Gepubliceerd', liveS: 'gepauzeerd aangemaakt op het platform', ready: 'Klaar om te lanceren', readyS: 'gecontroleerd, wacht op jou', att: 'Vraagt aandacht', attS: 'geblokkeerd of mislukt', list: 'Je campagnes', listS: 'Elke campagne die je in OrivenAI maakte, per platform. Open er een om de controle te doen en te lanceren.', status: 'Status', statusEmpty: 'Hier zie je de status zodra je campagnes hebt.', next: 'Volgende stap', results: 'Resultaten', resultsS: 'Gepubliceerde campagnes starten gepauzeerd. Zodra ze lopen, verschijnen uitgaven, klikken en conversies — zoals elk platform ze rapporteert — in het Prestatieoverzicht.', openPerf: 'Prestatieoverzicht openen', emptyT: 'Nog geen campagnes', emptyS: 'Campagnes die je in Advertenties maken bouwt, verschijnen hier per platform, met een controle voordat er iets live gaat.', create: 'Campagne maken', sim: 'Budget plannen in de advertentiesimulator', nAtt: '{n} campagne(s) vragen aandacht voordat ze kunnen starten.', showThem: 'Tonen', nReady: '{n} campagne(s) zijn klaar om te lanceren.', review: 'Bekijken', allLive: 'Alles wat je maakte is gepubliceerd. Volg de resultaten in het Prestatieoverzicht.', firstOne: 'Begin met één campagne: maak hem in Advertenties maken, controleer en lanceer hem dan hier.', warn: 'Klaar met waarschuwingen', blocked: 'Geblokkeerd', failed: 'Publiceren mislukt', other: 'Overig' },
    de: { all: 'Alle Kampagnen', allS: 'auf allen Plattformen', live: 'Veröffentlicht', liveS: 'pausiert auf der Plattform angelegt', ready: 'Startbereit', readyS: 'geprüft, wartet auf dich', att: 'Braucht Aufmerksamkeit', attS: 'blockiert oder fehlgeschlagen', list: 'Deine Kampagnen', listS: 'Jede Kampagne, die du in OrivenAI erstellt hast, pro Plattform. Öffne eine, um sie zu prüfen und zu starten.', status: 'Status', statusEmpty: 'Hier erscheinen die Statuszahlen, sobald du Kampagnen hast.', next: 'Nächster Schritt', results: 'Ergebnisse', resultsS: 'Veröffentlichte Kampagnen starten pausiert. Sobald sie laufen, erscheinen Ausgaben, Klicks und Conversions — wie jede Plattform sie meldet — in der Leistungsübersicht.', openPerf: 'Leistungsübersicht öffnen', emptyT: 'Noch keine Kampagnen', emptyS: 'Kampagnen, die du unter Anzeigen erstellen baust, erscheinen hier pro Plattform, mit einer Prüfung, bevor etwas live geht.', create: 'Kampagne erstellen', sim: 'Budget im Anzeigensimulator planen', nAtt: '{n} Kampagne(n) brauchen Aufmerksamkeit, bevor sie starten können.', showThem: 'Anzeigen', nReady: '{n} Kampagne(n) sind startbereit.', review: 'Prüfen', allLive: 'Alles ist veröffentlicht. Verfolge die Ergebnisse in der Leistungsübersicht.', firstOne: 'Beginne mit einer Kampagne: erstelle sie unter Anzeigen erstellen, prüfe und starte sie dann hier.', warn: 'Bereit mit Warnungen', blocked: 'Blockiert', failed: 'Veröffentlichung fehlgeschlagen', other: 'Sonstige' },
    fr: { all: 'Toutes les campagnes', allS: 'sur toutes les plateformes', live: 'Publiées', liveS: 'créées en pause sur la plateforme', ready: 'Prêtes à lancer', readyS: 'vérifiées, en attente de vous', att: 'À traiter', attS: 'bloquées ou en échec', list: 'Vos campagnes', listS: 'Chaque campagne créée dans OrivenAI, par plateforme. Ouvrez-en une pour la vérifier et la lancer.', status: 'Statut', statusEmpty: 'Les statuts apparaîtront ici dès que vous aurez des campagnes.', next: 'Prochaine étape', results: 'Résultats', resultsS: 'Les campagnes publiées démarrent en pause. Dès qu’elles tournent, dépenses, clics et conversions — tels que chaque plateforme les déclare — apparaissent dans l’Aperçu des performances.', openPerf: 'Ouvrir l’Aperçu des performances', emptyT: 'Aucune campagne pour l’instant', emptyS: 'Les campagnes créées dans Créer des annonces apparaissent ici par plateforme, avec une vérification avant toute mise en ligne.', create: 'Créer une campagne', sim: 'Planifier le budget dans le simulateur', nAtt: '{n} campagne(s) à traiter avant le lancement.', showThem: 'Afficher', nReady: '{n} campagne(s) prête(s) à lancer.', review: 'Vérifier', allLive: 'Tout est publié. Suivez les résultats dans l’Aperçu des performances.', firstOne: 'Commencez par une campagne : créez-la dans Créer des annonces, puis vérifiez-la et lancez-la ici.', warn: 'Prêtes avec avertissements', blocked: 'Bloquées', failed: 'Publication échouée', other: 'Autres' },
    es: { all: 'Todas las campañas', allS: 'en todas las plataformas', live: 'Publicadas', liveS: 'creadas en pausa en la plataforma', ready: 'Listas para lanzar', readyS: 'revisadas, esperando por ti', att: 'Requieren atención', attS: 'bloqueadas o fallidas', list: 'Tus campañas', listS: 'Cada campaña que creaste en OrivenAI, por plataforma. Abre una para revisarla y lanzarla.', status: 'Estado', statusEmpty: 'Los estados aparecerán aquí cuando tengas campañas.', next: 'Siguiente paso', results: 'Resultados', resultsS: 'Las campañas publicadas empiezan en pausa. Cuando se ejecutan, el gasto, los clics y las conversiones — tal como los informa cada plataforma — aparecen en el Resumen de rendimiento.', openPerf: 'Abrir Resumen de rendimiento', emptyT: 'Aún no hay campañas', emptyS: 'Las campañas que creas en Crear anuncios aparecen aquí por plataforma, con una revisión antes de publicar nada.', create: 'Crear una campaña', sim: 'Planificar el presupuesto en el simulador', nAtt: '{n} campaña(s) requieren atención antes de lanzarse.', showThem: 'Mostrar', nReady: '{n} campaña(s) listas para lanzar.', review: 'Revisar', allLive: 'Todo está publicado. Sigue los resultados en el Resumen de rendimiento.', firstOne: 'Empieza con una campaña: créala en Crear anuncios y luego revísala y lánzala aquí.', warn: 'Listas con avisos', blocked: 'Bloqueadas', failed: 'Error al publicar', other: 'Otras' },
    pt: { all: 'Todas as campanhas', allS: 'em todas as plataformas', live: 'Publicadas', liveS: 'criadas em pausa na plataforma', ready: 'Prontas para lançar', readyS: 'verificadas, à sua espera', att: 'Precisam de atenção', attS: 'bloqueadas ou com falha', list: 'As suas campanhas', listS: 'Cada campanha criada no OrivenAI, por plataforma. Abra uma para a verificar e lançar.', status: 'Estado', statusEmpty: 'Os estados aparecem aqui assim que tiver campanhas.', next: 'Próximo passo', results: 'Resultados', resultsS: 'As campanhas publicadas começam em pausa. Quando estão ativas, gasto, cliques e conversões — tal como cada plataforma os reporta — aparecem na Visão geral de desempenho.', openPerf: 'Abrir Visão geral de desempenho', emptyT: 'Ainda não há campanhas', emptyS: 'As campanhas criadas em Criar anúncios aparecem aqui por plataforma, com uma verificação antes de ficarem ativas.', create: 'Criar uma campanha', sim: 'Planear o orçamento no simulador', nAtt: '{n} campanha(s) precisam de atenção antes de lançar.', showThem: 'Mostrar', nReady: '{n} campanha(s) prontas para lançar.', review: 'Rever', allLive: 'Está tudo publicado. Acompanhe os resultados na Visão geral de desempenho.', firstOne: 'Comece com uma campanha: crie-a em Criar anúncios e depois verifique-a e lance-a aqui.', warn: 'Prontas com avisos', blocked: 'Bloqueadas', failed: 'Falha ao publicar', other: 'Outras' },
  };
  function T(k, v) { var l = typeof CURRENT_LANG === 'string' && STR[CURRENT_LANG] ? CURRENT_LANG : 'en'; var s = STR[l][k] || STR.en[k] || k; return v ? s.replace(/\{(\w+)\}/g, function (m, x) { return v[x] != null ? v[x] : m; }) : s; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function state(c) { return window.orvLaunch && window.orvLaunch.cardState ? window.orvLaunch.cardState(c).state : 'unavailable'; }
  function counts() {
    var list = typeof window._lqPendingList === 'function' ? window._lqPendingList() : [];
    var by = {};
    list.forEach(function (c) { var st = state(c); by[st] = (by[st] || 0) + 1; });
    var att = (by.blocked || 0) + (by.failed || 0) + (by.unconfirmed || 0);
    return { total: list.length, live: by.live || 0, ready: (by.ready || 0) + (by.warning || 0), att: att, by: by };
  }

  function build() {
    var pg = document.getElementById('page-launch'); if (!pg) return null;
    var hub = pg.querySelector('#launchSelectView .lq-hub'); if (!hub) return null;
    if (hub.querySelector('.cmx-grid')) return hub;
    var hdr = hub.querySelector('.lq-hdr'), filters = document.getElementById('lqFilters'), row = document.getElementById('lqWorkspaceRow');
    if (!hdr || !filters || !row) return null;
    var sum = document.createElement('div'); sum.className = 'cmx-sum'; sum.id = 'cmxSum';
    var grid = document.createElement('div'); grid.className = 'cmx-grid';
    var listCard = document.createElement('section'); listCard.className = 'cmx-card cmx-list'; listCard.setAttribute('aria-labelledby', 'cmxListH');
    listCard.innerHTML = '<div class="cmx-card__h"><h2 id="cmxListH"></h2><p class="cmx-sub" id="cmxListS"></p></div>';
    listCard.appendChild(filters); listCard.appendChild(row);
    var side = document.createElement('aside'); side.className = 'cmx-side'; side.id = 'cmxSide';
    grid.appendChild(listCard); grid.appendChild(side);
    hdr.insertAdjacentElement('afterend', sum);
    sum.insertAdjacentElement('afterend', grid);
    hub.classList.add('cmx-on');
    return hub;
  }

  function paint() {
    var hub = build(); if (!hub) return;
    var c = counts();
    var tile = function (n, k, s, cls) { return '<div class="cmx-card cmx-tile' + (cls ? ' ' + cls : '') + '"><span class="cmx-tile__k">' + esc(T(k)) + '</span><b>' + n + '</b><span class="cmx-tile__s">' + esc(T(s)) + '</span></div>'; };
    document.getElementById('cmxSum').innerHTML = tile(c.total, 'all', 'allS') + tile(c.live, 'live', 'liveS') + tile(c.ready, 'ready', 'readyS', c.ready ? 'cmx-tile--hi' : '') + tile(c.att, 'att', 'attS', c.att ? 'cmx-tile--warn' : '');
    document.getElementById('cmxListH').textContent = T('list');
    document.getElementById('cmxListS').textContent = T('listS');
    // Status per readiness, across every platform
    var rows = [['live', 'live'], ['ready', 'ready'], ['warning', 'warn'], ['blocked', 'blocked'], ['failed', 'failed']];
    var max = Math.max(1, c.total);
    var status = c.total ? '<ul class="cmx-bars">' + rows.map(function (r) { var n = c.by[r[0]] || 0; return '<li class="cmx-bar cmx-bar--' + r[0] + '"><span>' + esc(r[0] === 'live' ? T('live') : r[0] === 'ready' ? T('ready') : T(r[1])) + '</span><i><em style="width:' + Math.round(n / max * 100) + '%"></em></i><b>' + n + '</b></li>'; }).join('') + '</ul>'
      : '<p class="cmx-empty-line">' + esc(T('statusEmpty')) + '</p>';
    var next = c.att ? '<p>' + esc(T('nAtt', { n: c.att })) + '</p><button type="button" class="cmx-btn" data-cmx="att">' + esc(T('showThem')) + '</button>'
      : c.ready ? '<p>' + esc(T('nReady', { n: c.ready })) + '</p><button type="button" class="cmx-btn cmx-btn--primary" data-cmx="ready">' + esc(T('review')) + '</button>'
      : c.total ? '<p>' + esc(T('allLive')) + '</p><button type="button" class="cmx-btn" data-cmx="perf">' + esc(T('openPerf')) + '</button>'
      : '<p>' + esc(T('firstOne')) + '</p><div class="cmx-acts"><button type="button" class="cmx-btn" data-cmx="sim">' + esc(T('sim')) + '</button></div>';
    document.getElementById('cmxSide').innerHTML =
      '<section class="cmx-card" aria-labelledby="cmxStatH"><h2 id="cmxStatH">' + esc(T('status')) + '</h2>' + status + '</section>' +
      '<section class="cmx-card cmx-next og-hi" aria-labelledby="cmxNextH"><h2 id="cmxNextH">' + esc(T('next')) + '</h2>' + next + '</section>' +
      '<section class="cmx-card cmx-results" aria-labelledby="cmxResH"><h2 id="cmxResH">' + esc(T('results')) + '</h2><p class="cmx-sub">' + esc(T('resultsS')) + '</p><div><button type="button" class="cmx-btn" data-cmx="perf">' + esc(T('openPerf')) + '</button></div></section>';
    // No campaigns anywhere: the list card keeps its place and explains it.
    var empty = document.getElementById('launchEmpty');
    if (!c.total && empty) {
      empty.innerHTML = '<div class="camp-hub-empty-ico"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h3l3-7 4 14 3-7h3"/></svg></div><h3 class="camp-hub-empty-title">' + esc(T('emptyT')) + '</h3><p class="camp-hub-empty-sub">' + esc(T('emptyS')) + '</p>' +
        '<div class="cmx-acts cmx-acts--c"><button type="button" class="cmx-btn cmx-btn--primary" data-cmx="create">' + esc(T('create')) + '</button><button type="button" class="cmx-btn" data-cmx="sim">' + esc(T('sim')) + '</button></div>';
    }
  }

  function onClick(e) {
    var b = e.target.closest('[data-cmx]'); if (!b) return;
    var a = b.getAttribute('data-cmx');
    if (a === 'create' && typeof window._orvNav === 'function') window._orvNav('create', 'page-create');
    if (a === 'sim' && window.orvAppNav) window.orvAppNav.go('simulator');
    if (a === 'perf' && window.orvAppNav) window.orvAppNav.go('overview');
    if (a === 'att' || a === 'ready') {
      // Show them in the list: the first platform that has one, filtered to that state.
      var want = a === 'att' ? ['blocked', 'failed', 'unconfirmed'] : ['ready', 'warning'];
      var hit = (typeof window._lqPendingList === 'function' ? window._lqPendingList() : []).filter(function (c) { return want.indexOf(state(c)) >= 0; })[0];
      if (hit && typeof window._launchSetPlatformFilter === 'function') {
        window._launchSetPlatformFilter(hit.platform || 'meta');
        var st = state(hit);
        if (typeof window._launchSetStatusFilter === 'function') window._launchSetStatusFilter(st === 'unconfirmed' ? 'all' : st);
        var l = document.querySelector('.cmx-list'); if (l) l.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    }
  }

  document.addEventListener('click', onClick);
  if (typeof window.applyLanguage === 'function' && !window.applyLanguage._cmx) {
    var al = window.applyLanguage;
    window.applyLanguage = function () { var r = al.apply(this, arguments); try { if (document.getElementById('cmxSum')) paint(); } catch (_) {} return r; };
    window.applyLanguage._cmx = true;
  }
  window.orvCampaignsShell = { paint: paint, _counts: counts };
})();
