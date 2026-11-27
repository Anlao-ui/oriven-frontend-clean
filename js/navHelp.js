/* ════════════════════════════════════════════════════════════════
   Navigation help (2026-11-26): what each sidebar destination does.

   js/appNav.js puts a small "?" button next to each navigation item
   (a sibling, never inside the item's own button). It is shown when the
   row is hovered or focused, and always (faintly) on touch screens.
   Hover, keyboard focus or a tap on the "?" shows one short tooltip,
   placed beside the sidebar (or under the row in the phone menu) and kept
   inside the window. Escape, leaving or tapping elsewhere closes it.
   The texts describe what the page really does today.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.orvNavHelp) return;

  var HELP = {
    en: {
      dashboard: 'Your advertising at a glance: key results, what needs attention and what to do next.',
      plan: 'Your AI marketing plan and the tasks that carry it out: what OrivenAI does and what is up to you.',
      attention: 'Problems and warnings across your ad accounts, tracking, campaigns and automations, most urgent first.',
      adstudio: 'Manage your campaigns across connected platforms: check them, fix issues and launch them.',
      simulator: 'Try budgets, platforms and assumptions to see possible results before you spend. A simulation, not a forecast.',
      create: 'Create ads step by step: images, video and copy for the platforms you choose.',
      content: 'Everything you have made: images, videos, ad creatives and copy, ready to reuse.',
      testing: 'Write several versions of an ad, compare them side by side and keep the strongest.',
      overview: 'One platform’s results in detail: spend, reach, clicks, conversions and how they change over time.',
      compare: 'All your ad platforms side by side: where your budget goes and what it brings back.',
      adsvsads: 'Two individual ads head to head, with the figures each platform reports.',
      research: 'Find out who buys from you and why: audiences, needs, products and trends.',
      competitive: 'See how competitors position, price and advertise, and where you can stand apart.',
      insights: 'All findings from your research in one place, each linked to the report it came from.',
      'auto-overview': 'What runs on its own: active automations, upcoming runs and anything waiting for your approval.',
      'auto-rules': 'Rules that watch your campaigns and notify you, ask first, or act within limits you set.',
      'auto-activity': 'Everything your automations did, with the reason and the result.',
      settings: 'Your account, plan, notifications and security, plus tracking settings for each ad platform.',
      platforms: 'Connect your ad accounts and choose which account OrivenAI works with.',
      _about: 'About {x}'
    },
    nl: {
      dashboard: 'Je advertenties in één oogopslag: de belangrijkste resultaten, wat aandacht vraagt en wat je nu kunt doen.',
      plan: 'Je AI-marketingplan en de taken die het uitvoeren: wat OrivenAI doet en wat aan jou is.',
      attention: 'Problemen en waarschuwingen in je advertentieaccounts, tracking, campagnes en automatiseringen, de urgentste eerst.',
      adstudio: 'Beheer je campagnes op gekoppelde platforms: controleren, problemen oplossen en lanceren.',
      simulator: 'Probeer budgetten, platforms en aannames om mogelijke resultaten te zien voordat je uitgeeft. Een simulatie, geen voorspelling.',
      create: 'Maak stap voor stap advertenties: beelden, video en tekst voor de platforms die je kiest.',
      content: 'Alles wat je hebt gemaakt: beelden, video’s, advertenties en teksten, klaar om te hergebruiken.',
      testing: 'Schrijf meerdere versies van een advertentie, vergelijk ze naast elkaar en houd de sterkste.',
      overview: 'De resultaten van één platform in detail: uitgaven, bereik, klikken, conversies en het verloop in de tijd.',
      compare: 'Al je advertentieplatforms naast elkaar: waar je budget heen gaat en wat het oplevert.',
      adsvsads: 'Twee losse advertenties tegenover elkaar, met de cijfers die elk platform rapporteert.',
      research: 'Ontdek wie bij je koopt en waarom: doelgroepen, behoeften, producten en trends.',
      competitive: 'Zie hoe concurrenten zich positioneren, prijzen en adverteren, en waar jij je kunt onderscheiden.',
      insights: 'Alle bevindingen uit je onderzoek op één plek, elk gekoppeld aan het rapport waar het vandaan komt.',
      'auto-overview': 'Wat vanzelf loopt: actieve automatiseringen, komende runs en wat op je goedkeuring wacht.',
      'auto-rules': 'Regels die je campagnes bewaken en je waarschuwen, eerst vragen of handelen binnen grenzen die jij stelt.',
      'auto-activity': 'Alles wat je automatiseringen deden, met de reden en het resultaat.',
      settings: 'Je account, abonnement, meldingen en beveiliging, plus de trackinginstellingen per advertentieplatform.',
      platforms: 'Koppel je advertentieaccounts en kies met welk account OrivenAI werkt.',
      _about: 'Over {x}'
    },
    de: {
      dashboard: 'Deine Werbung auf einen Blick: wichtigste Ergebnisse, was Aufmerksamkeit braucht und was als Nächstes zu tun ist.',
      plan: 'Dein KI-Marketingplan und die Aufgaben, die ihn umsetzen: was OrivenAI erledigt und was bei dir liegt.',
      attention: 'Probleme und Warnungen in Werbekonten, Tracking, Kampagnen und Automatisierungen, das Dringendste zuerst.',
      adstudio: 'Verwalte deine Kampagnen auf verbundenen Plattformen: prüfen, Probleme beheben und starten.',
      simulator: 'Teste Budgets, Plattformen und Annahmen, um mögliche Ergebnisse zu sehen, bevor du Geld ausgibst. Eine Simulation, keine Prognose.',
      create: 'Erstelle Anzeigen Schritt für Schritt: Bilder, Video und Texte für die Plattformen deiner Wahl.',
      content: 'Alles, was du erstellt hast: Bilder, Videos, Anzeigen und Texte, bereit zur Wiederverwendung.',
      testing: 'Schreibe mehrere Versionen einer Anzeige, vergleiche sie nebeneinander und behalte die stärkste.',
      overview: 'Die Ergebnisse einer Plattform im Detail: Ausgaben, Reichweite, Klicks, Conversions und ihr Verlauf.',
      compare: 'Alle Werbeplattformen nebeneinander: wohin dein Budget geht und was es bringt.',
      adsvsads: 'Zwei einzelne Anzeigen im direkten Vergleich, mit den Zahlen, die jede Plattform meldet.',
      research: 'Finde heraus, wer bei dir kauft und warum: Zielgruppen, Bedürfnisse, Produkte und Trends.',
      competitive: 'Sieh, wie sich Wettbewerber positionieren, Preise setzen und werben, und wo du dich abheben kannst.',
      insights: 'Alle Erkenntnisse aus deiner Recherche an einem Ort, jeweils mit dem Bericht, aus dem sie stammen.',
      'auto-overview': 'Was von selbst läuft: aktive Automatisierungen, anstehende Läufe und was auf deine Freigabe wartet.',
      'auto-rules': 'Regeln, die deine Kampagnen beobachten und dich benachrichtigen, erst fragen oder innerhalb deiner Grenzen handeln.',
      'auto-activity': 'Alles, was deine Automatisierungen getan haben, mit Grund und Ergebnis.',
      settings: 'Dein Konto, Tarif, Benachrichtigungen und Sicherheit sowie die Tracking-Einstellungen je Werbeplattform.',
      platforms: 'Verbinde deine Werbekonten und wähle, mit welchem Konto OrivenAI arbeitet.',
      _about: 'Über {x}'
    },
    fr: {
      dashboard: 'Votre publicité en un coup d’œil : résultats clés, ce qui demande votre attention et quoi faire ensuite.',
      plan: 'Votre plan marketing IA et les tâches qui le réalisent : ce que fait OrivenAI et ce qui vous revient.',
      attention: 'Problèmes et alertes sur vos comptes publicitaires, le suivi, les campagnes et les automatisations, les plus urgents d’abord.',
      adstudio: 'Gérez vos campagnes sur les plateformes connectées : vérifiez-les, corrigez les problèmes et lancez-les.',
      simulator: 'Testez budgets, plateformes et hypothèses pour voir des résultats possibles avant de dépenser. Une simulation, pas une prévision.',
      create: 'Créez des annonces pas à pas : images, vidéo et textes pour les plateformes de votre choix.',
      content: 'Tout ce que vous avez créé : images, vidéos, annonces et textes, prêts à être réutilisés.',
      testing: 'Rédigez plusieurs versions d’une annonce, comparez-les côte à côte et gardez la meilleure.',
      overview: 'Les résultats d’une plateforme en détail : dépenses, portée, clics, conversions et leur évolution.',
      compare: 'Toutes vos plateformes publicitaires côte à côte : où va votre budget et ce qu’il rapporte.',
      adsvsads: 'Deux annonces face à face, avec les chiffres que chaque plateforme communique.',
      research: 'Découvrez qui achète chez vous et pourquoi : audiences, besoins, produits et tendances.',
      competitive: 'Voyez comment vos concurrents se positionnent, fixent leurs prix et font de la publicité, et où vous démarquer.',
      insights: 'Tous les enseignements de vos recherches au même endroit, chacun relié à son rapport d’origine.',
      'auto-overview': 'Ce qui tourne tout seul : automatisations actives, prochaines exécutions et ce qui attend votre accord.',
      'auto-rules': 'Des règles qui surveillent vos campagnes et vous préviennent, demandent d’abord ou agissent dans vos limites.',
      'auto-activity': 'Tout ce que vos automatisations ont fait, avec la raison et le résultat.',
      settings: 'Votre compte, offre, notifications et sécurité, ainsi que les réglages de suivi pour chaque plateforme.',
      platforms: 'Connectez vos comptes publicitaires et choisissez celui avec lequel OrivenAI travaille.',
      _about: 'À propos de {x}'
    },
    es: {
      dashboard: 'Tu publicidad de un vistazo: resultados clave, lo que requiere atención y qué hacer a continuación.',
      plan: 'Tu plan de marketing con IA y las tareas que lo llevan a cabo: lo que hace OrivenAI y lo que te toca a ti.',
      attention: 'Problemas y avisos en tus cuentas publicitarias, seguimiento, campañas y automatizaciones, lo más urgente primero.',
      adstudio: 'Gestiona tus campañas en las plataformas conectadas: revísalas, corrige problemas y lánzalas.',
      simulator: 'Prueba presupuestos, plataformas y supuestos para ver posibles resultados antes de gastar. Una simulación, no una previsión.',
      create: 'Crea anuncios paso a paso: imágenes, vídeo y textos para las plataformas que elijas.',
      content: 'Todo lo que has creado: imágenes, vídeos, anuncios y textos, listos para reutilizar.',
      testing: 'Escribe varias versiones de un anuncio, compáralas lado a lado y quédate con la mejor.',
      overview: 'Los resultados de una plataforma en detalle: gasto, alcance, clics, conversiones y su evolución.',
      compare: 'Todas tus plataformas publicitarias lado a lado: adónde va tu presupuesto y qué te devuelve.',
      adsvsads: 'Dos anuncios cara a cara, con las cifras que informa cada plataforma.',
      research: 'Descubre quién te compra y por qué: audiencias, necesidades, productos y tendencias.',
      competitive: 'Mira cómo se posicionan, fijan precios y se anuncian tus competidores, y dónde puedes diferenciarte.',
      insights: 'Todos los hallazgos de tus investigaciones en un solo lugar, cada uno vinculado a su informe.',
      'auto-overview': 'Lo que funciona solo: automatizaciones activas, próximas ejecuciones y lo que espera tu aprobación.',
      'auto-rules': 'Reglas que vigilan tus campañas y te avisan, preguntan antes o actúan dentro de los límites que fijes.',
      'auto-activity': 'Todo lo que hicieron tus automatizaciones, con el motivo y el resultado.',
      settings: 'Tu cuenta, plan, notificaciones y seguridad, más los ajustes de seguimiento de cada plataforma publicitaria.',
      platforms: 'Conecta tus cuentas publicitarias y elige con qué cuenta trabaja OrivenAI.',
      _about: 'Acerca de {x}'
    },
    pt: {
      dashboard: 'A sua publicidade num relance: resultados principais, o que precisa de atenção e o que fazer a seguir.',
      plan: 'O seu plano de marketing com IA e as tarefas que o executam: o que a OrivenAI faz e o que fica consigo.',
      attention: 'Problemas e avisos nas suas contas de anúncios, acompanhamento, campanhas e automações, os mais urgentes primeiro.',
      adstudio: 'Gira as suas campanhas nas plataformas ligadas: verifique-as, resolva problemas e lance-as.',
      simulator: 'Experimente orçamentos, plataformas e pressupostos para ver resultados possíveis antes de gastar. Uma simulação, não uma previsão.',
      create: 'Crie anúncios passo a passo: imagens, vídeo e textos para as plataformas que escolher.',
      content: 'Tudo o que criou: imagens, vídeos, anúncios e textos, prontos a reutilizar.',
      testing: 'Escreva várias versões de um anúncio, compare-as lado a lado e fique com a mais forte.',
      overview: 'Os resultados de uma plataforma em detalhe: gasto, alcance, cliques, conversões e a sua evolução.',
      compare: 'Todas as suas plataformas de anúncios lado a lado: para onde vai o orçamento e o que traz de volta.',
      adsvsads: 'Dois anúncios frente a frente, com os números que cada plataforma comunica.',
      research: 'Descubra quem compra consigo e porquê: públicos, necessidades, produtos e tendências.',
      competitive: 'Veja como os concorrentes se posicionam, definem preços e anunciam, e onde se pode destacar.',
      insights: 'Todas as descobertas da sua pesquisa num só lugar, cada uma ligada ao relatório de origem.',
      'auto-overview': 'O que funciona sozinho: automações ativas, próximas execuções e o que aguarda a sua aprovação.',
      'auto-rules': 'Regras que vigiam as suas campanhas e o avisam, perguntam primeiro ou agem dentro dos limites que definir.',
      'auto-activity': 'Tudo o que as suas automações fizeram, com o motivo e o resultado.',
      settings: 'A sua conta, plano, notificações e segurança, mais as definições de acompanhamento de cada plataforma.',
      platforms: 'Ligue as suas contas de anúncios e escolha com que conta a OrivenAI trabalha.',
      _about: 'Sobre {x}'
    }
  };

  function lang() { var l = (typeof CURRENT_LANG !== 'undefined' && CURRENT_LANG) || 'en'; return HELP[l] ? l : 'en'; }
  function text(id) { var l = lang(); return (HELP[l] && HELP[l][id]) || HELP.en[id] || ''; }
  function labelOf(btn) {
    var row = btn.closest('li, .onv-fwrap'), l = row && row.querySelector('.onv-lbl');
    return l ? l.textContent.trim() : '';
  }
  function relabel() {
    document.querySelectorAll('.onv-help[data-onv-help]').forEach(function (b) {
      var t = (HELP[lang()]._about || HELP.en._about).replace('{x}', labelOf(b));
      b.setAttribute('aria-label', t);
      if (!text(b.getAttribute('data-onv-help'))) b.hidden = true;
    });
  }

  var tip = null, cur = null, hideT = 0, shownAt = 0;
  function el() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.id = 'onvTip'; tip.className = 'onv-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
    document.body.appendChild(tip);
    tip.addEventListener('mouseenter', function () { clearTimeout(hideT); });
    tip.addEventListener('mouseleave', function () { hide(); });
    return tip;
  }
  function place(btn) {
    var t = el(), r = btn.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, pad = 12;
    var bar = btn.closest('.orv-sb, .orv-mob-drawer'), br = bar ? bar.getBoundingClientRect() : r;
    t.style.left = '0px'; t.style.top = '0px'; t.classList.remove('is-below');
    var w = t.offsetWidth, h = t.offsetHeight, x, y;
    if (br.right + 10 + w <= vw - pad) { x = br.right + 10; y = r.top + r.height / 2 - h / 2; }
    else { x = Math.min(Math.max(pad, r.right - w), vw - w - pad); y = r.bottom + 8; t.classList.add('is-below'); if (y + h > vh - pad) y = r.top - h - 8; }
    y = Math.min(Math.max(pad, y), vh - h - pad);
    t.style.left = Math.round(x) + 'px'; t.style.top = Math.round(y) + 'px';
  }
  function show(btn) {
    var id = btn.getAttribute('data-onv-help'), txt = text(id); if (!txt) return;
    clearTimeout(hideT);
    var t = el();
    if (cur && cur !== btn) { cur.setAttribute('aria-expanded', 'false'); cur.removeAttribute('aria-describedby'); }
    if (cur !== btn || !tip || tip.hidden) shownAt = Date.now();
    cur = btn;
    t.innerHTML = '<b></b><span></span>';
    t.firstChild.textContent = labelOf(btn); t.lastChild.textContent = txt;
    t.hidden = false; place(btn); t.classList.add('is-on');
    btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-describedby', 'onvTip');
  }
  function hide(now) {
    clearTimeout(hideT);
    var go = function () { if (!tip) return; tip.classList.remove('is-on'); tip.hidden = true; if (cur) { cur.setAttribute('aria-expanded', 'false'); cur.removeAttribute('aria-describedby'); } cur = null; };
    if (now) go(); else hideT = setTimeout(go, 120);
  }

  function help(e) { return e.target && e.target.closest ? e.target.closest('.onv-help[data-onv-help]') : null; }
  document.addEventListener('mouseover', function (e) { var b = help(e); if (b && matchMedia('(hover: hover)').matches) show(b); });
  document.addEventListener('mouseout', function (e) { var b = help(e); if (b && cur === b && !(e.relatedTarget && tip && tip.contains(e.relatedTarget))) hide(); });
  document.addEventListener('focusin', function (e) { var b = help(e); if (b) show(b); else if (cur && !(tip && tip.contains(e.target))) hide(true); });
  document.addEventListener('focusout', function (e) { var b = help(e); if (b && cur === b) hide(); });
  // A tap or click toggles it (touch screens have no hover); it never opens the page.
  document.addEventListener('click', function (e) {
    var b = help(e);
    if (b) { e.preventDefault(); e.stopPropagation(); // A tap first focuses the "?" (which already shows it): only a second tap closes it.
      if (cur === b && tip && !tip.hidden && !matchMedia('(hover: hover)').matches && Date.now() - shownAt > 400) hide(true); else show(b); return; }
    if (cur && !(tip && tip.contains(e.target))) hide(true);
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur) { var b = cur; hide(true); try { b.focus(); } catch (_) {} } });
  window.addEventListener('scroll', function () { if (cur) hide(true); }, true);
  window.addEventListener('resize', function () { if (cur) hide(true); });

  // Language switch: new labels for the "?" buttons.
  function hookLang() {
    if (typeof window.applyLanguage !== 'function' || window.applyLanguage._onvHelp) return;
    var orig = window.applyLanguage;
    window.applyLanguage = function () { var r = orig.apply(this, arguments); try { relabel(); hide(true); } catch (_) {} return r; };
    window.applyLanguage._onvHelp = true;
  }
  function init() { relabel(); hookLang(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  setTimeout(init, 1500);

  window.orvNavHelp = { text: text, ids: function () { return Object.keys(HELP.en).filter(function (k) { return k.charAt(0) !== '_'; }); }, relabel: relabel, show: show, hide: hide };
})();
