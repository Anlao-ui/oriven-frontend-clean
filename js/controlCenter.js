/* ════════════════════════════════════════════════════════════════
   Control Center (#bizPanelOverview) — texts in six languages, the setup
   checklist and the merged "Needs you" card.

   The blocks themselves are still painted by their existing owners:
     header status + workspace attention ... js/orivenWorkspace.js (H.render)
     performance, ad signals, campaigns, automations ... js/orivenOpsPages.js
     advertising plan ............................. js/orivenPlan.js
     business context rows ........................ app.html (_bicRender)
   They read their words from orvCC.T(). This file adds no data of its own:
   the checklist uses the business model (_bicModel), the connection status
   and OrivenAI's campaign records that the page already loads.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var STR = {
    en: {
      eyebrow: 'Control Center', morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening',
      createCampaign: 'Create campaign', yourBusiness: 'Your business',
      stRunning1: '1 campaign running on your ad platforms', stRunningN: '{n} campaigns running on your ad platforms',
      stDrafts1: '1 draft in OrivenAI', stDraftsN: '{n} drafts in OrivenAI',
      stAtt1: '1 thing needs your attention', stAttN: '{n} things need your attention',
      stNothing: 'Nothing is running yet — build your first campaign when you’re ready.', stLoading: 'Checking your advertising…',
      icon: { add: 'Add logo', upload: 'Upload logo', generate: 'Generate with AI', remove: 'Remove', replace: 'Replace', alt: 'Business logo', aria: 'Add or change your business logo' },
      // Needs you
      needsTitle: 'Needs you', calm: 'You’re all caught up. Nothing needs your attention.', checking: 'Checking what needs you…',
      viewAll: 'View all {n}', showLess: 'Show less', count1: '1 item', countN: '{n} items',
      sev: { risk: 'Problem', attention: 'Needs attention', ready: 'Ready' },
      sigView: 'View', sigWhy: 'why {c} was flagged', sigAccount: '{p} account', sigAll: 'All platforms', sigSource: 'Ad performance',
      sigNoConv: 'Spent {cur}, no conversions', sigNoSpend: 'Active, no spend', sigLimited: 'Using its full daily budget', sigTracking: 'Spend reported, no conversions', sigChange: '{label} {change} vs the previous period',
      att: {
        failTitle: 'Publishing “{name}” failed', unconfTitle: 'Publishing “{name}” wasn’t confirmed', unconfWhy: 'OrivenAI didn’t get an answer. Check the status before publishing again.', failWhy: 'The platform rejected the last publish attempt.', perfAlert: 'Performance alert',
        aprec1: 'An automation change is waiting for your approval', aprecN: '{n} automation changes are waiting for your approval', aprecWhy: 'Nothing happens until you approve or reject.',
        tracking: 'Conversion tracking isn’t verified for {list}', trackingWhy: 'OrivenAI can’t confirm pixel or conversion-event setup, so results that rely on conversions may be incomplete.',
        blocked1: '“{name}” can’t launch yet', blockedN: '{n} drafts can’t launch yet', blockedWhy: 'Launch found a required item missing.',
        ready1: '“{name}” is ready to launch', readyN: '{n} campaigns are ready to launch', readyWhy: 'Every required launch check passes. Review and publish when you’re ready.',
        untitled: 'Untitled', aDraft: 'A draft', aCampaign: 'A campaign', and: 'and',
      },
      src: { launch: 'Launch', campaigns: 'Campaigns', automations: 'Automations', bizAdv: 'Business context · Advertising', biz: 'Business context' },
      act: { review: 'Review', checkStatus: 'Check status', open: 'Open', checkSetup: 'Check setup', fixLaunch: 'Fix in Launch' },
      // Performance
      perfTitle: 'Performance', viewCampaigns: 'View campaigns', perfMeta: 'Last 7 days vs the 7 days before · platform-reported',
      perfMixed: 'Your accounts use different currencies, so spend is shown per platform below.',
      fig: { spend: 'Spend', conversions: 'Conversions', cpa: 'CPA', roas: 'ROAS' }, partialValue: 'Not every platform reports conversion value',
      perfNone: 'No ad platform connected', perfNoneText: 'Performance is read directly from your ad accounts. Nothing is shown until one is connected.', connect: 'Connect a platform',
      perfErr: 'Your advertising data couldn’t be loaded.', retry: 'Try again', perfUnavailable: '{list} couldn’t be read right now — not included below.',
      perfQuiet: 'Connected · no spend reported in the last 7 days.', perfStatusErr: 'Your platform connections couldn’t be checked right now.', splitAria: 'Spend by platform', conv: '{n} conv.',
      noFigures: 'No figures reported for this period.',
      // Campaigns
      campsTitle: 'Campaigns', running: 'Running', runningSrc: 'on your ad platforms', drafts: 'Drafts', draftsSrc: 'in OrivenAI', needAtt: 'Need attention', needAttSrc: 'failed or blocked',
      unavailable: 'Unavailable', notConnected: 'Not connected', campsNone: 'No campaigns yet.', createOne: 'Create a campaign', more: '+{n} more',
      stage: { draft: 'Draft', unconfirmed: 'Not confirmed', ready: 'Ready', warning: 'Check warnings', blocked: 'Blocked', failed: 'Failed', publishing: 'Publishing', live: 'Live', paused: 'Paused', deployed: 'Published' },
      // Automations
      autoTitle: 'Automations', viewAutomations: 'View automations', autoFree: 'Not included on Free', autoFreeSub: 'Automations are available from Starter.', autoErr: 'Automations couldn’t be loaded right now.',
      autoPaused: 'All automations paused', autoActive1: '1 automation active', autoActiveN: '{n} automations active', autoNone: 'No automations yet',
      autoManaging: 'Managing campaigns on {list}', autoConnected: '{list} connected', autoNoAccounts: 'Automations work with your connected ad accounts.',
      autoNext: 'Next run {when}', autoWaiting1: '1 waiting for approval', autoWaitingN: '{n} waiting for approval', autoLast: 'Last: {what} · {when}',
      autoAct: { pause_campaign: 'Paused', resume_campaign: 'Resumed', increase_budget: 'Budget raised', decrease_budget: 'Budget lowered', notify: 'Notified', activate: 'Switched on', pause: 'Paused', resume: 'Resumed', stop: 'Stopped' },
      // Setup
      setupTitle: 'Get set up', setupProgress: '{n} of {m} done', setupProfile: 'Add your business profile', setupConnect: 'Connect an ad platform', setupCampaign: 'Create your first campaign',
      done: 'Done', checkingShort: 'Checking…',
      // Plan
      planTitle: 'Advertising plan', planOpen: 'Open planning', planStart: 'Plan advertising', planEmpty: 'Plan what you’ll advertise next: when, where and with what budget.', noDate: 'No date',
      // Business context
      ctxTitle: 'Business context', ctxSub: 'What OrivenAI uses for every plan and ad.',
      mod: { business: 'Business', brand: 'Brand', audience: 'Audience', competition: 'Competition', advertising: 'Advertising', knowledge: 'Knowledge' },
      ms: { added: 'Added', incomplete: 'Incomplete', mapped: 'Mapped', notSet: 'Not set', none: 'None yet', aud1: '1 audience', audN: '{n} audiences', comp1: '1 competitor', compN: '{n} competitors',
        conn: '{n}/4 connected', connNone: 'Not connected', checking: 'Checking…', items1: '1 item', itemsN: '{n} items', nothing: 'Nothing yet', issues1: '1 issue', issuesN: '{n} issues' },
      ml: { bizIncomplete: 'Business context is incomplete.', brandNone: 'Brand identity not mapped.', audNone: 'No audience context yet.', compNone: 'Not mapped yet.', advChecking: 'Checking platform connections…', advNone: 'No ad platforms connected.',
        knowNone: 'Nothing learned yet.', colors1: '1 color defined', colorsN: '{n} colors defined', remembered1: '1 thing remembered', rememberedN: '{n} things remembered', patterns1: '1 pattern identified', patternsN: '{n} patterns identified',
        audMapped1: '1 audience mapped', audMappedN: '{n} audiences mapped', compMapped1: '1 competitor mapped', compMappedN: '{n} competitors mapped', platsConn: '{n} / 4 platforms connected', morePlats: '+{n} more' },
      plat: { connected: 'connected', notConnected: 'not connected', unknown: 'status unavailable' },
    },
    nl: {
      eyebrow: 'Control Center', morning: 'Goedemorgen', afternoon: 'Goedemiddag', evening: 'Goedenavond',
      createCampaign: 'Campagne maken', yourBusiness: 'Je bedrijf',
      stRunning1: '1 campagne actief op je advertentieplatforms', stRunningN: '{n} campagnes actief op je advertentieplatforms',
      stDrafts1: '1 concept in OrivenAI', stDraftsN: '{n} concepten in OrivenAI',
      stAtt1: '1 punt vraagt je aandacht', stAttN: '{n} punten vragen je aandacht',
      stNothing: 'Er draait nog niets — bouw je eerste campagne wanneer je er klaar voor bent.', stLoading: 'Je advertenties worden gecontroleerd…',
      icon: { add: 'Logo toevoegen', upload: 'Logo uploaden', generate: 'Genereren met AI', remove: 'Verwijderen', replace: 'Vervangen', alt: 'Bedrijfslogo', aria: 'Bedrijfslogo toevoegen of wijzigen' },
      needsTitle: 'Voor jou', calm: 'Je bent helemaal bij. Er vraagt niets je aandacht.', checking: 'Controleren wat je aandacht nodig heeft…',
      viewAll: 'Alle {n} bekijken', showLess: 'Minder tonen', count1: '1 punt', countN: '{n} punten',
      sev: { risk: 'Probleem', attention: 'Aandacht nodig', ready: 'Klaar' },
      sigView: 'Bekijken', sigWhy: 'waarom {c} is gemarkeerd', sigAccount: '{p}-account', sigAll: 'Alle platforms', sigSource: 'Advertentieprestaties',
      sigNoConv: '{cur} uitgegeven, geen conversies', sigNoSpend: 'Actief, geen uitgaven', sigLimited: 'Gebruikt het volledige dagbudget', sigTracking: 'Uitgaven gemeld, geen conversies', sigChange: '{label} {change} t.o.v. de vorige periode',
      att: {
        failTitle: 'Publiceren van “{name}” is mislukt', unconfTitle: 'Publiceren van “{name}” is niet bevestigd', unconfWhy: 'OrivenAI kreeg geen antwoord. Controleer de status voordat je opnieuw publiceert.', failWhy: 'Het platform weigerde de laatste publicatiepoging.', perfAlert: 'Prestatiemelding',
        aprec1: 'Een automatiseringswijziging wacht op je goedkeuring', aprecN: '{n} automatiseringswijzigingen wachten op je goedkeuring', aprecWhy: 'Er gebeurt niets tot je goedkeurt of afwijst.',
        tracking: 'Conversietracking is niet geverifieerd voor {list}', trackingWhy: 'OrivenAI kan de pixel- of conversie-instelling niet bevestigen, dus resultaten die op conversies steunen kunnen onvolledig zijn.',
        blocked1: '“{name}” kan nog niet live', blockedN: '{n} concepten kunnen nog niet live', blockedWhy: 'Launch mist een verplicht onderdeel.',
        ready1: '“{name}” is klaar om te lanceren', readyN: '{n} campagnes zijn klaar om te lanceren', readyWhy: 'Alle verplichte controles zijn in orde. Bekijk en publiceer wanneer je wilt.',
        untitled: 'Naamloos', aDraft: 'Een concept', aCampaign: 'Een campagne', and: 'en',
      },
      src: { launch: 'Launch', campaigns: 'Campagnes', automations: 'Automatiseringen', bizAdv: 'Bedrijfscontext · Adverteren', biz: 'Bedrijfscontext' },
      act: { review: 'Bekijken', checkStatus: 'Status controleren', open: 'Openen', checkSetup: 'Instelling controleren', fixLaunch: 'Oplossen in Launch' },
      perfTitle: 'Prestaties', viewCampaigns: 'Campagnes bekijken', perfMeta: 'Laatste 7 dagen vs de 7 dagen ervoor · gemeld door de platforms',
      perfMixed: 'Je accounts gebruiken verschillende valuta, dus uitgaven staan hieronder per platform.',
      fig: { spend: 'Uitgaven', conversions: 'Conversies', cpa: 'CPA', roas: 'ROAS' }, partialValue: 'Niet elk platform meldt conversiewaarde',
      perfNone: 'Geen advertentieplatform gekoppeld', perfNoneText: 'Prestaties komen rechtstreeks uit je advertentieaccounts. Er wordt niets getoond tot er een gekoppeld is.', connect: 'Platform koppelen',
      perfErr: 'Je advertentiegegevens konden niet worden geladen.', retry: 'Opnieuw proberen', perfUnavailable: '{list} kon nu niet worden gelezen — hieronder niet meegeteld.',
      perfQuiet: 'Gekoppeld · geen uitgaven gemeld in de laatste 7 dagen.', perfStatusErr: 'Je platformkoppelingen konden nu niet worden gecontroleerd.', splitAria: 'Uitgaven per platform', conv: '{n} conv.',
      noFigures: 'Geen cijfers gemeld voor deze periode.',
      campsTitle: 'Campagnes', running: 'Actief', runningSrc: 'op je advertentieplatforms', drafts: 'Concepten', draftsSrc: 'in OrivenAI', needAtt: 'Aandacht nodig', needAttSrc: 'mislukt of geblokkeerd',
      unavailable: 'Niet beschikbaar', notConnected: 'Niet gekoppeld', campsNone: 'Nog geen campagnes.', createOne: 'Campagne maken', more: '+{n} meer',
      stage: { draft: 'Concept', unconfirmed: 'Niet bevestigd', ready: 'Klaar', warning: 'Waarschuwingen bekijken', blocked: 'Geblokkeerd', failed: 'Mislukt', publishing: 'Publiceren', live: 'Live', paused: 'Gepauzeerd', deployed: 'Gepubliceerd' },
      autoTitle: 'Automatiseringen', viewAutomations: 'Automatiseringen bekijken', autoFree: 'Niet inbegrepen in Free', autoFreeSub: 'Automatiseringen zijn beschikbaar vanaf Starter.', autoErr: 'Automatiseringen konden nu niet worden geladen.',
      autoPaused: 'Alle automatiseringen gepauzeerd', autoActive1: '1 automatisering actief', autoActiveN: '{n} automatiseringen actief', autoNone: 'Nog geen automatiseringen',
      autoManaging: 'Beheert campagnes op {list}', autoConnected: '{list} gekoppeld', autoNoAccounts: 'Automatiseringen werken met je gekoppelde advertentieaccounts.',
      autoNext: 'Volgende actie {when}', autoWaiting1: '1 wacht op goedkeuring', autoWaitingN: '{n} wachten op goedkeuring', autoLast: 'Laatst: {what} · {when}',
      autoAct: { pause_campaign: 'Gepauzeerd', resume_campaign: 'Hervat', increase_budget: 'Budget verhoogd', decrease_budget: 'Budget verlaagd', notify: 'Gemeld', activate: 'Aangezet', pause: 'Gepauzeerd', resume: 'Hervat', stop: 'Gestopt' },
      setupTitle: 'Aan de slag', setupProgress: '{n} van {m} klaar', setupProfile: 'Voeg je bedrijfsprofiel toe', setupConnect: 'Koppel een advertentieplatform', setupCampaign: 'Maak je eerste campagne',
      done: 'Klaar', checkingShort: 'Controleren…',
      planTitle: 'Advertentieplan', planOpen: 'Planning openen', planStart: 'Advertenties plannen', planEmpty: 'Plan wat je hierna adverteert: wanneer, waar en met welk budget.', noDate: 'Geen datum',
      ctxTitle: 'Bedrijfscontext', ctxSub: 'Wat OrivenAI voor elk plan en elke advertentie gebruikt.',
      mod: { business: 'Bedrijf', brand: 'Merk', audience: 'Doelgroep', competition: 'Concurrentie', advertising: 'Adverteren', knowledge: 'Kennis' },
      ms: { added: 'Toegevoegd', incomplete: 'Onvolledig', mapped: 'Vastgelegd', notSet: 'Niet ingesteld', none: 'Nog niets', aud1: '1 doelgroep', audN: '{n} doelgroepen', comp1: '1 concurrent', compN: '{n} concurrenten',
        conn: '{n}/4 gekoppeld', connNone: 'Niet gekoppeld', checking: 'Controleren…', items1: '1 item', itemsN: '{n} items', nothing: 'Nog niets', issues1: '1 probleem', issuesN: '{n} problemen' },
      ml: { bizIncomplete: 'Bedrijfscontext is onvolledig.', brandNone: 'Merkidentiteit niet vastgelegd.', audNone: 'Nog geen doelgroepcontext.', compNone: 'Nog niet vastgelegd.', advChecking: 'Platformkoppelingen controleren…', advNone: 'Geen advertentieplatforms gekoppeld.',
        knowNone: 'Nog niets geleerd.', colors1: '1 kleur vastgelegd', colorsN: '{n} kleuren vastgelegd', remembered1: '1 ding onthouden', rememberedN: '{n} dingen onthouden', patterns1: '1 patroon herkend', patternsN: '{n} patronen herkend',
        audMapped1: '1 doelgroep vastgelegd', audMappedN: '{n} doelgroepen vastgelegd', compMapped1: '1 concurrent vastgelegd', compMappedN: '{n} concurrenten vastgelegd', platsConn: '{n} / 4 platforms gekoppeld', morePlats: '+{n} meer' },
      plat: { connected: 'gekoppeld', notConnected: 'niet gekoppeld', unknown: 'status onbekend' },
    },
    de: {
      eyebrow: 'Control Center', morning: 'Guten Morgen', afternoon: 'Guten Tag', evening: 'Guten Abend',
      createCampaign: 'Kampagne erstellen', yourBusiness: 'Dein Unternehmen',
      stRunning1: '1 Kampagne läuft auf deinen Werbeplattformen', stRunningN: '{n} Kampagnen laufen auf deinen Werbeplattformen',
      stDrafts1: '1 Entwurf in OrivenAI', stDraftsN: '{n} Entwürfe in OrivenAI',
      stAtt1: '1 Punkt braucht deine Aufmerksamkeit', stAttN: '{n} Punkte brauchen deine Aufmerksamkeit',
      stNothing: 'Noch läuft nichts — erstelle deine erste Kampagne, wenn du bereit bist.', stLoading: 'Deine Werbung wird geprüft…',
      icon: { add: 'Logo hinzufügen', upload: 'Logo hochladen', generate: 'Mit KI erstellen', remove: 'Entfernen', replace: 'Ersetzen', alt: 'Unternehmenslogo', aria: 'Unternehmenslogo hinzufügen oder ändern' },
      needsTitle: 'Für dich', calm: 'Alles erledigt. Nichts braucht deine Aufmerksamkeit.', checking: 'Prüfe, was deine Aufmerksamkeit braucht…',
      viewAll: 'Alle {n} ansehen', showLess: 'Weniger anzeigen', count1: '1 Punkt', countN: '{n} Punkte',
      sev: { risk: 'Problem', attention: 'Aufmerksamkeit nötig', ready: 'Bereit' },
      sigView: 'Ansehen', sigWhy: 'warum {c} markiert wurde', sigAccount: '{p}-Konto', sigAll: 'Alle Plattformen', sigSource: 'Anzeigenleistung',
      sigNoConv: '{cur} ausgegeben, keine Conversions', sigNoSpend: 'Aktiv, keine Ausgaben', sigLimited: 'Nutzt das volle Tagesbudget', sigTracking: 'Ausgaben gemeldet, keine Conversions', sigChange: '{label} {change} ggü. dem Vorzeitraum',
      att: {
        failTitle: 'Veröffentlichung von „{name}“ fehlgeschlagen', unconfTitle: 'Veröffentlichung von „{name}“ nicht bestätigt', unconfWhy: 'OrivenAI hat keine Antwort erhalten. Prüfe den Status, bevor du erneut veröffentlichst.', failWhy: 'Die Plattform hat den letzten Veröffentlichungsversuch abgelehnt.', perfAlert: 'Leistungshinweis',
        aprec1: 'Eine Automatisierungsänderung wartet auf deine Freigabe', aprecN: '{n} Automatisierungsänderungen warten auf deine Freigabe', aprecWhy: 'Nichts passiert, bevor du freigibst oder ablehnst.',
        tracking: 'Conversion-Tracking ist für {list} nicht bestätigt', trackingWhy: 'OrivenAI kann Pixel oder Conversion-Ereignisse nicht bestätigen, daher können conversionbasierte Ergebnisse unvollständig sein.',
        blocked1: '„{name}“ kann noch nicht starten', blockedN: '{n} Entwürfe können noch nicht starten', blockedWhy: 'Launch hat ein fehlendes Pflichtfeld gefunden.',
        ready1: '„{name}“ ist startbereit', readyN: '{n} Kampagnen sind startbereit', readyWhy: 'Alle Pflichtprüfungen bestanden. Prüfe und veröffentliche, wenn du bereit bist.',
        untitled: 'Ohne Titel', aDraft: 'Ein Entwurf', aCampaign: 'Eine Kampagne', and: 'und',
      },
      src: { launch: 'Launch', campaigns: 'Kampagnen', automations: 'Automatisierungen', bizAdv: 'Unternehmenskontext · Werbung', biz: 'Unternehmenskontext' },
      act: { review: 'Prüfen', checkStatus: 'Status prüfen', open: 'Öffnen', checkSetup: 'Einrichtung prüfen', fixLaunch: 'In Launch beheben' },
      perfTitle: 'Leistung', viewCampaigns: 'Kampagnen ansehen', perfMeta: 'Letzte 7 Tage vs. die 7 Tage davor · von den Plattformen gemeldet',
      perfMixed: 'Deine Konten nutzen verschiedene Währungen, daher stehen die Ausgaben unten pro Plattform.',
      fig: { spend: 'Ausgaben', conversions: 'Conversions', cpa: 'CPA', roas: 'ROAS' }, partialValue: 'Nicht jede Plattform meldet einen Conversion-Wert',
      perfNone: 'Keine Werbeplattform verbunden', perfNoneText: 'Die Leistung kommt direkt aus deinen Werbekonten. Es wird nichts angezeigt, bis eines verbunden ist.', connect: 'Plattform verbinden',
      perfErr: 'Deine Werbedaten konnten nicht geladen werden.', retry: 'Erneut versuchen', perfUnavailable: '{list} konnte gerade nicht gelesen werden — unten nicht enthalten.',
      perfQuiet: 'Verbunden · in den letzten 7 Tagen keine Ausgaben gemeldet.', perfStatusErr: 'Deine Plattformverbindungen konnten gerade nicht geprüft werden.', splitAria: 'Ausgaben pro Plattform', conv: '{n} Conv.',
      noFigures: 'Für diesen Zeitraum wurden keine Zahlen gemeldet.',
      campsTitle: 'Kampagnen', running: 'Laufend', runningSrc: 'auf deinen Werbeplattformen', drafts: 'Entwürfe', draftsSrc: 'in OrivenAI', needAtt: 'Aufmerksamkeit nötig', needAttSrc: 'fehlgeschlagen oder blockiert',
      unavailable: 'Nicht verfügbar', notConnected: 'Nicht verbunden', campsNone: 'Noch keine Kampagnen.', createOne: 'Kampagne erstellen', more: '+{n} weitere',
      stage: { draft: 'Entwurf', unconfirmed: 'Nicht bestätigt', ready: 'Bereit', warning: 'Warnungen prüfen', blocked: 'Blockiert', failed: 'Fehlgeschlagen', publishing: 'Wird veröffentlicht', live: 'Live', paused: 'Pausiert', deployed: 'Veröffentlicht' },
      autoTitle: 'Automatisierungen', viewAutomations: 'Automatisierungen ansehen', autoFree: 'Nicht in Free enthalten', autoFreeSub: 'Automatisierungen gibt es ab Starter.', autoErr: 'Automatisierungen konnten gerade nicht geladen werden.',
      autoPaused: 'Alle Automatisierungen pausiert', autoActive1: '1 Automatisierung aktiv', autoActiveN: '{n} Automatisierungen aktiv', autoNone: 'Noch keine Automatisierungen',
      autoManaging: 'Verwaltet Kampagnen auf {list}', autoConnected: '{list} verbunden', autoNoAccounts: 'Automatisierungen arbeiten mit deinen verbundenen Werbekonten.',
      autoNext: 'Nächste Aktion {when}', autoWaiting1: '1 wartet auf Freigabe', autoWaitingN: '{n} warten auf Freigabe', autoLast: 'Zuletzt: {what} · {when}',
      autoAct: { pause_campaign: 'Pausiert', resume_campaign: 'Fortgesetzt', increase_budget: 'Budget erhöht', decrease_budget: 'Budget gesenkt', notify: 'Benachrichtigt', activate: 'Eingeschaltet', pause: 'Pausiert', resume: 'Fortgesetzt', stop: 'Beendet' },
      setupTitle: 'Einrichtung', setupProgress: '{n} von {m} erledigt', setupProfile: 'Unternehmensprofil hinzufügen', setupConnect: 'Werbeplattform verbinden', setupCampaign: 'Erste Kampagne erstellen',
      done: 'Erledigt', checkingShort: 'Wird geprüft…',
      planTitle: 'Werbeplan', planOpen: 'Planung öffnen', planStart: 'Werbung planen', planEmpty: 'Plane, was du als Nächstes bewirbst: wann, wo und mit welchem Budget.', noDate: 'Kein Datum',
      ctxTitle: 'Unternehmenskontext', ctxSub: 'Was OrivenAI für jeden Plan und jede Anzeige nutzt.',
      mod: { business: 'Unternehmen', brand: 'Marke', audience: 'Zielgruppe', competition: 'Wettbewerb', advertising: 'Werbung', knowledge: 'Wissen' },
      ms: { added: 'Hinzugefügt', incomplete: 'Unvollständig', mapped: 'Erfasst', notSet: 'Nicht festgelegt', none: 'Noch keine', aud1: '1 Zielgruppe', audN: '{n} Zielgruppen', comp1: '1 Wettbewerber', compN: '{n} Wettbewerber',
        conn: '{n}/4 verbunden', connNone: 'Nicht verbunden', checking: 'Wird geprüft…', items1: '1 Eintrag', itemsN: '{n} Einträge', nothing: 'Noch nichts', issues1: '1 Problem', issuesN: '{n} Probleme' },
      ml: { bizIncomplete: 'Unternehmenskontext ist unvollständig.', brandNone: 'Markenidentität nicht erfasst.', audNone: 'Noch kein Zielgruppenkontext.', compNone: 'Noch nicht erfasst.', advChecking: 'Plattformverbindungen werden geprüft…', advNone: 'Keine Werbeplattformen verbunden.',
        knowNone: 'Noch nichts gelernt.', colors1: '1 Farbe festgelegt', colorsN: '{n} Farben festgelegt', remembered1: '1 Sache gemerkt', rememberedN: '{n} Dinge gemerkt', patterns1: '1 Muster erkannt', patternsN: '{n} Muster erkannt',
        audMapped1: '1 Zielgruppe erfasst', audMappedN: '{n} Zielgruppen erfasst', compMapped1: '1 Wettbewerber erfasst', compMappedN: '{n} Wettbewerber erfasst', platsConn: '{n} / 4 Plattformen verbunden', morePlats: '+{n} weitere' },
      plat: { connected: 'verbunden', notConnected: 'nicht verbunden', unknown: 'Status unbekannt' },
    },
    fr: {
      eyebrow: 'Control Center', morning: 'Bonjour', afternoon: 'Bon après-midi', evening: 'Bonsoir',
      createCampaign: 'Créer une campagne', yourBusiness: 'Votre entreprise',
      stRunning1: '1 campagne active sur vos plateformes publicitaires', stRunningN: '{n} campagnes actives sur vos plateformes publicitaires',
      stDrafts1: '1 brouillon dans OrivenAI', stDraftsN: '{n} brouillons dans OrivenAI',
      stAtt1: '1 point demande votre attention', stAttN: '{n} points demandent votre attention',
      stNothing: 'Rien ne tourne encore — créez votre première campagne quand vous êtes prêt.', stLoading: 'Vérification de vos publicités…',
      icon: { add: 'Ajouter un logo', upload: 'Importer un logo', generate: 'Générer avec l’IA', remove: 'Retirer', replace: 'Remplacer', alt: 'Logo de l’entreprise', aria: 'Ajouter ou modifier le logo de votre entreprise' },
      needsTitle: 'Pour vous', calm: 'Tout est à jour. Rien ne demande votre attention.', checking: 'Vérification de ce qui demande votre attention…',
      viewAll: 'Voir les {n}', showLess: 'Voir moins', count1: '1 point', countN: '{n} points',
      sev: { risk: 'Problème', attention: 'À traiter', ready: 'Prêt' },
      sigView: 'Voir', sigWhy: 'pourquoi {c} a été signalé', sigAccount: 'compte {p}', sigAll: 'Toutes les plateformes', sigSource: 'Performance publicitaire',
      sigNoConv: '{cur} dépensés, aucune conversion', sigNoSpend: 'Active, aucune dépense', sigLimited: 'Utilise tout son budget quotidien', sigTracking: 'Dépenses déclarées, aucune conversion', sigChange: '{label} {change} vs la période précédente',
      att: {
        failTitle: 'La publication de « {name} » a échoué', unconfTitle: 'La publication de « {name} » n’est pas confirmée', unconfWhy: 'OrivenAI n’a pas reçu de réponse. Vérifiez le statut avant de republier.', failWhy: 'La plateforme a refusé la dernière tentative de publication.', perfAlert: 'Alerte de performance',
        aprec1: 'Une modification d’automatisation attend votre approbation', aprecN: '{n} modifications d’automatisation attendent votre approbation', aprecWhy: 'Rien ne se passe tant que vous n’approuvez ou ne refusez pas.',
        tracking: 'Le suivi des conversions n’est pas vérifié pour {list}', trackingWhy: 'OrivenAI ne peut pas confirmer la configuration du pixel ou des conversions ; les résultats basés sur les conversions peuvent être incomplets.',
        blocked1: '« {name} » ne peut pas encore être lancée', blockedN: '{n} brouillons ne peuvent pas encore être lancés', blockedWhy: 'Launch a trouvé un élément obligatoire manquant.',
        ready1: '« {name} » est prête à être lancée', readyN: '{n} campagnes sont prêtes à être lancées', readyWhy: 'Toutes les vérifications obligatoires sont validées. Vérifiez et publiez quand vous voulez.',
        untitled: 'Sans titre', aDraft: 'Un brouillon', aCampaign: 'Une campagne', and: 'et',
      },
      src: { launch: 'Launch', campaigns: 'Campagnes', automations: 'Automatisations', bizAdv: 'Contexte · Publicité', biz: 'Contexte de l’entreprise' },
      act: { review: 'Vérifier', checkStatus: 'Vérifier le statut', open: 'Ouvrir', checkSetup: 'Vérifier la configuration', fixLaunch: 'Corriger dans Launch' },
      perfTitle: 'Performance', viewCampaigns: 'Voir les campagnes', perfMeta: '7 derniers jours vs les 7 jours précédents · données des plateformes',
      perfMixed: 'Vos comptes utilisent des devises différentes : les dépenses sont affichées par plateforme ci-dessous.',
      fig: { spend: 'Dépenses', conversions: 'Conversions', cpa: 'CPA', roas: 'ROAS' }, partialValue: 'Toutes les plateformes ne déclarent pas la valeur des conversions',
      perfNone: 'Aucune plateforme publicitaire connectée', perfNoneText: 'La performance vient directement de vos comptes publicitaires. Rien n’est affiché tant qu’aucun n’est connecté.', connect: 'Connecter une plateforme',
      perfErr: 'Vos données publicitaires n’ont pas pu être chargées.', retry: 'Réessayer', perfUnavailable: '{list} n’a pas pu être lu pour le moment — non inclus ci-dessous.',
      perfQuiet: 'Connecté · aucune dépense déclarée sur les 7 derniers jours.', perfStatusErr: 'Vos connexions aux plateformes n’ont pas pu être vérifiées.', splitAria: 'Dépenses par plateforme', conv: '{n} conv.',
      noFigures: 'Aucun chiffre déclaré pour cette période.',
      campsTitle: 'Campagnes', running: 'Actives', runningSrc: 'sur vos plateformes', drafts: 'Brouillons', draftsSrc: 'dans OrivenAI', needAtt: 'À traiter', needAttSrc: 'échouées ou bloquées',
      unavailable: 'Indisponible', notConnected: 'Non connecté', campsNone: 'Pas encore de campagnes.', createOne: 'Créer une campagne', more: '+{n} de plus',
      stage: { draft: 'Brouillon', unconfirmed: 'Non confirmée', ready: 'Prête', warning: 'Avertissements à vérifier', blocked: 'Bloquée', failed: 'Échouée', publishing: 'Publication', live: 'En ligne', paused: 'En pause', deployed: 'Publiée' },
      autoTitle: 'Automatisations', viewAutomations: 'Voir les automatisations', autoFree: 'Non inclus dans Free', autoFreeSub: 'Les automatisations sont disponibles à partir de Starter.', autoErr: 'Les automatisations n’ont pas pu être chargées.',
      autoPaused: 'Toutes les automatisations en pause', autoActive1: '1 automatisation active', autoActiveN: '{n} automatisations actives', autoNone: 'Pas encore d’automatisations',
      autoManaging: 'Gère les campagnes sur {list}', autoConnected: '{list} connecté', autoNoAccounts: 'Les automatisations fonctionnent avec vos comptes publicitaires connectés.',
      autoNext: 'Prochaine action {when}', autoWaiting1: '1 en attente d’approbation', autoWaitingN: '{n} en attente d’approbation', autoLast: 'Dernière : {what} · {when}',
      autoAct: { pause_campaign: 'Mise en pause', resume_campaign: 'Reprise', increase_budget: 'Budget augmenté', decrease_budget: 'Budget baissé', notify: 'Notifié', activate: 'Activée', pause: 'Mise en pause', resume: 'Reprise', stop: 'Arrêtée' },
      setupTitle: 'Bien démarrer', setupProgress: '{n} sur {m} fait', setupProfile: 'Ajouter votre profil d’entreprise', setupConnect: 'Connecter une plateforme publicitaire', setupCampaign: 'Créer votre première campagne',
      done: 'Fait', checkingShort: 'Vérification…',
      planTitle: 'Plan publicitaire', planOpen: 'Ouvrir le planning', planStart: 'Planifier', planEmpty: 'Planifiez ce que vous promouvrez ensuite : quand, où et avec quel budget.', noDate: 'Sans date',
      ctxTitle: 'Contexte de l’entreprise', ctxSub: 'Ce qu’OrivenAI utilise pour chaque plan et chaque publicité.',
      mod: { business: 'Entreprise', brand: 'Marque', audience: 'Audience', competition: 'Concurrence', advertising: 'Publicité', knowledge: 'Connaissances' },
      ms: { added: 'Ajouté', incomplete: 'Incomplet', mapped: 'Défini', notSet: 'Non défini', none: 'Aucune', aud1: '1 audience', audN: '{n} audiences', comp1: '1 concurrent', compN: '{n} concurrents',
        conn: '{n}/4 connectées', connNone: 'Non connecté', checking: 'Vérification…', items1: '1 élément', itemsN: '{n} éléments', nothing: 'Rien pour l’instant', issues1: '1 problème', issuesN: '{n} problèmes' },
      ml: { bizIncomplete: 'Le contexte de l’entreprise est incomplet.', brandNone: 'Identité de marque non définie.', audNone: 'Pas encore de contexte d’audience.', compNone: 'Pas encore défini.', advChecking: 'Vérification des connexions…', advNone: 'Aucune plateforme publicitaire connectée.',
        knowNone: 'Rien appris pour l’instant.', colors1: '1 couleur définie', colorsN: '{n} couleurs définies', remembered1: '1 élément mémorisé', rememberedN: '{n} éléments mémorisés', patterns1: '1 tendance identifiée', patternsN: '{n} tendances identifiées',
        audMapped1: '1 audience définie', audMappedN: '{n} audiences définies', compMapped1: '1 concurrent défini', compMappedN: '{n} concurrents définis', platsConn: '{n} / 4 plateformes connectées', morePlats: '+{n} de plus' },
      plat: { connected: 'connecté', notConnected: 'non connecté', unknown: 'statut indisponible' },
    },
    es: {
      eyebrow: 'Control Center', morning: 'Buenos días', afternoon: 'Buenas tardes', evening: 'Buenas noches',
      createCampaign: 'Crear campaña', yourBusiness: 'Tu negocio',
      stRunning1: '1 campaña activa en tus plataformas publicitarias', stRunningN: '{n} campañas activas en tus plataformas publicitarias',
      stDrafts1: '1 borrador en OrivenAI', stDraftsN: '{n} borradores en OrivenAI',
      stAtt1: '1 cosa necesita tu atención', stAttN: '{n} cosas necesitan tu atención',
      stNothing: 'Todavía no hay nada activo — crea tu primera campaña cuando quieras.', stLoading: 'Revisando tu publicidad…',
      icon: { add: 'Añadir logo', upload: 'Subir logo', generate: 'Generar con IA', remove: 'Quitar', replace: 'Reemplazar', alt: 'Logo del negocio', aria: 'Añadir o cambiar el logo de tu negocio' },
      needsTitle: 'Para ti', calm: 'Todo al día. Nada necesita tu atención.', checking: 'Revisando qué necesita tu atención…',
      viewAll: 'Ver los {n}', showLess: 'Ver menos', count1: '1 punto', countN: '{n} puntos',
      sev: { risk: 'Problema', attention: 'Requiere atención', ready: 'Listo' },
      sigView: 'Ver', sigWhy: 'por qué se marcó {c}', sigAccount: 'cuenta de {p}', sigAll: 'Todas las plataformas', sigSource: 'Rendimiento publicitario',
      sigNoConv: '{cur} gastados, sin conversiones', sigNoSpend: 'Activa, sin gasto', sigLimited: 'Usa todo su presupuesto diario', sigTracking: 'Gasto registrado, sin conversiones', sigChange: '{label} {change} vs el periodo anterior',
      att: {
        failTitle: 'No se pudo publicar «{name}»', unconfTitle: 'La publicación de «{name}» no se confirmó', unconfWhy: 'OrivenAI no recibió respuesta. Comprueba el estado antes de volver a publicar.', failWhy: 'La plataforma rechazó el último intento de publicación.', perfAlert: 'Alerta de rendimiento',
        aprec1: 'Un cambio de automatización espera tu aprobación', aprecN: '{n} cambios de automatización esperan tu aprobación', aprecWhy: 'No pasa nada hasta que apruebes o rechaces.',
        tracking: 'El seguimiento de conversiones no está verificado para {list}', trackingWhy: 'OrivenAI no puede confirmar la configuración del píxel o de las conversiones, así que los resultados basados en conversiones pueden estar incompletos.',
        blocked1: '«{name}» aún no puede lanzarse', blockedN: '{n} borradores aún no pueden lanzarse', blockedWhy: 'Launch encontró un elemento obligatorio que falta.',
        ready1: '«{name}» está lista para lanzarse', readyN: '{n} campañas están listas para lanzarse', readyWhy: 'Todas las comprobaciones obligatorias están bien. Revisa y publica cuando quieras.',
        untitled: 'Sin título', aDraft: 'Un borrador', aCampaign: 'Una campaña', and: 'y',
      },
      src: { launch: 'Launch', campaigns: 'Campañas', automations: 'Automatizaciones', bizAdv: 'Contexto · Publicidad', biz: 'Contexto del negocio' },
      act: { checkStatus: 'Comprobar estado', review: 'Revisar', open: 'Abrir', checkSetup: 'Revisar configuración', fixLaunch: 'Corregir en Launch' },
      perfTitle: 'Rendimiento', viewCampaigns: 'Ver campañas', perfMeta: 'Últimos 7 días vs los 7 días anteriores · datos de las plataformas',
      perfMixed: 'Tus cuentas usan monedas distintas, así que el gasto se muestra por plataforma abajo.',
      fig: { spend: 'Gasto', conversions: 'Conversiones', cpa: 'CPA', roas: 'ROAS' }, partialValue: 'No todas las plataformas informan del valor de conversión',
      perfNone: 'Ninguna plataforma publicitaria conectada', perfNoneText: 'El rendimiento se lee directamente de tus cuentas publicitarias. No se muestra nada hasta que conectes una.', connect: 'Conectar una plataforma',
      perfErr: 'No se pudieron cargar tus datos publicitarios.', retry: 'Reintentar', perfUnavailable: 'No se pudo leer {list} ahora — no se incluye abajo.',
      perfQuiet: 'Conectada · sin gasto registrado en los últimos 7 días.', perfStatusErr: 'No se pudieron comprobar tus conexiones ahora.', splitAria: 'Gasto por plataforma', conv: '{n} conv.',
      noFigures: 'No hay cifras para este periodo.',
      campsTitle: 'Campañas', running: 'Activas', runningSrc: 'en tus plataformas', drafts: 'Borradores', draftsSrc: 'en OrivenAI', needAtt: 'Requieren atención', needAttSrc: 'fallidas o bloqueadas',
      unavailable: 'No disponible', notConnected: 'Sin conectar', campsNone: 'Todavía no hay campañas.', createOne: 'Crear una campaña', more: '+{n} más',
      stage: { draft: 'Borrador', unconfirmed: 'Sin confirmar', ready: 'Lista', warning: 'Revisar avisos', blocked: 'Bloqueada', failed: 'Fallida', publishing: 'Publicando', live: 'Activa', paused: 'En pausa', deployed: 'Publicada' },
      autoTitle: 'Automatizaciones', viewAutomations: 'Ver automatizaciones', autoFree: 'No incluido en Free', autoFreeSub: 'Las automatizaciones están disponibles desde Starter.', autoErr: 'No se pudieron cargar las automatizaciones.',
      autoPaused: 'Todas las automatizaciones en pausa', autoActive1: '1 automatización activa', autoActiveN: '{n} automatizaciones activas', autoNone: 'Todavía no hay automatizaciones',
      autoManaging: 'Gestiona campañas en {list}', autoConnected: '{list} conectado', autoNoAccounts: 'Las automatizaciones funcionan con tus cuentas publicitarias conectadas.',
      autoNext: 'Próxima acción {when}', autoWaiting1: '1 espera aprobación', autoWaitingN: '{n} esperan aprobación', autoLast: 'Última: {what} · {when}',
      autoAct: { pause_campaign: 'Pausada', resume_campaign: 'Reanudada', increase_budget: 'Presupuesto subido', decrease_budget: 'Presupuesto bajado', notify: 'Avisado', activate: 'Activada', pause: 'Pausada', resume: 'Reanudada', stop: 'Detenida' },
      setupTitle: 'Primeros pasos', setupProgress: '{n} de {m} hechos', setupProfile: 'Añade el perfil de tu negocio', setupConnect: 'Conecta una plataforma publicitaria', setupCampaign: 'Crea tu primera campaña',
      done: 'Hecho', checkingShort: 'Comprobando…',
      planTitle: 'Plan publicitario', planOpen: 'Abrir planificación', planStart: 'Planificar', planEmpty: 'Planifica lo próximo que anunciarás: cuándo, dónde y con qué presupuesto.', noDate: 'Sin fecha',
      ctxTitle: 'Contexto del negocio', ctxSub: 'Lo que OrivenAI usa para cada plan y anuncio.',
      mod: { business: 'Negocio', brand: 'Marca', audience: 'Audiencia', competition: 'Competencia', advertising: 'Publicidad', knowledge: 'Conocimiento' },
      ms: { added: 'Añadido', incomplete: 'Incompleto', mapped: 'Definida', notSet: 'Sin definir', none: 'Ninguna aún', aud1: '1 audiencia', audN: '{n} audiencias', comp1: '1 competidor', compN: '{n} competidores',
        conn: '{n}/4 conectadas', connNone: 'Sin conectar', checking: 'Comprobando…', items1: '1 elemento', itemsN: '{n} elementos', nothing: 'Nada aún', issues1: '1 problema', issuesN: '{n} problemas' },
      ml: { bizIncomplete: 'El contexto del negocio está incompleto.', brandNone: 'Identidad de marca sin definir.', audNone: 'Todavía no hay contexto de audiencia.', compNone: 'Todavía sin definir.', advChecking: 'Comprobando conexiones…', advNone: 'Ninguna plataforma publicitaria conectada.',
        knowNone: 'Todavía no se ha aprendido nada.', colors1: '1 color definido', colorsN: '{n} colores definidos', remembered1: '1 cosa recordada', rememberedN: '{n} cosas recordadas', patterns1: '1 patrón identificado', patternsN: '{n} patrones identificados',
        audMapped1: '1 audiencia definida', audMappedN: '{n} audiencias definidas', compMapped1: '1 competidor definido', compMappedN: '{n} competidores definidos', platsConn: '{n} / 4 plataformas conectadas', morePlats: '+{n} más' },
      plat: { connected: 'conectada', notConnected: 'sin conectar', unknown: 'estado no disponible' },
    },
    pt: {
      eyebrow: 'Control Center', morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite',
      createCampaign: 'Criar campanha', yourBusiness: 'Seu negócio',
      stRunning1: '1 campanha ativa nas suas plataformas de anúncios', stRunningN: '{n} campanhas ativas nas suas plataformas de anúncios',
      stDrafts1: '1 rascunho na OrivenAI', stDraftsN: '{n} rascunhos na OrivenAI',
      stAtt1: '1 item precisa da sua atenção', stAttN: '{n} itens precisam da sua atenção',
      stNothing: 'Nada está rodando ainda — crie sua primeira campanha quando quiser.', stLoading: 'Verificando seus anúncios…',
      icon: { add: 'Adicionar logo', upload: 'Enviar logo', generate: 'Gerar com IA', remove: 'Remover', replace: 'Substituir', alt: 'Logo do negócio', aria: 'Adicionar ou alterar o logo do seu negócio' },
      needsTitle: 'Para você', calm: 'Tudo em dia. Nada precisa da sua atenção.', checking: 'Verificando o que precisa da sua atenção…',
      viewAll: 'Ver todos os {n}', showLess: 'Ver menos', count1: '1 item', countN: '{n} itens',
      sev: { risk: 'Problema', attention: 'Precisa de atenção', ready: 'Pronto' },
      sigView: 'Ver', sigWhy: 'por que {c} foi sinalizado', sigAccount: 'conta {p}', sigAll: 'Todas as plataformas', sigSource: 'Desempenho dos anúncios',
      sigNoConv: '{cur} gastos, sem conversões', sigNoSpend: 'Ativa, sem gasto', sigLimited: 'Usando todo o orçamento diário', sigTracking: 'Gasto informado, sem conversões', sigChange: '{label} {change} vs o período anterior',
      att: {
        failTitle: 'A publicação de “{name}” falhou', unconfTitle: 'A publicação de “{name}” não foi confirmada', unconfWhy: 'A OrivenAI não recebeu resposta. Verifique o status antes de publicar de novo.', failWhy: 'A plataforma recusou a última tentativa de publicação.', perfAlert: 'Alerta de desempenho',
        aprec1: 'Uma mudança de automação aguarda sua aprovação', aprecN: '{n} mudanças de automação aguardam sua aprovação', aprecWhy: 'Nada acontece até você aprovar ou recusar.',
        tracking: 'O rastreamento de conversões não está verificado para {list}', trackingWhy: 'A OrivenAI não consegue confirmar o pixel ou os eventos de conversão, então resultados baseados em conversões podem estar incompletos.',
        blocked1: '“{name}” ainda não pode ser lançada', blockedN: '{n} rascunhos ainda não podem ser lançados', blockedWhy: 'O Launch encontrou um item obrigatório faltando.',
        ready1: '“{name}” está pronta para lançar', readyN: '{n} campanhas estão prontas para lançar', readyWhy: 'Todas as verificações obrigatórias passaram. Revise e publique quando quiser.',
        untitled: 'Sem título', aDraft: 'Um rascunho', aCampaign: 'Uma campanha', and: 'e',
      },
      src: { launch: 'Launch', campaigns: 'Campanhas', automations: 'Automações', bizAdv: 'Contexto · Publicidade', biz: 'Contexto do negócio' },
      act: { checkStatus: 'Verificar status', review: 'Revisar', open: 'Abrir', checkSetup: 'Verificar configuração', fixLaunch: 'Corrigir no Launch' },
      perfTitle: 'Desempenho', viewCampaigns: 'Ver campanhas', perfMeta: 'Últimos 7 dias vs os 7 dias anteriores · dados das plataformas',
      perfMixed: 'Suas contas usam moedas diferentes, então o gasto aparece por plataforma abaixo.',
      fig: { spend: 'Gasto', conversions: 'Conversões', cpa: 'CPA', roas: 'ROAS' }, partialValue: 'Nem toda plataforma informa o valor das conversões',
      perfNone: 'Nenhuma plataforma de anúncios conectada', perfNoneText: 'O desempenho vem direto das suas contas de anúncios. Nada aparece até você conectar uma.', connect: 'Conectar uma plataforma',
      perfErr: 'Não foi possível carregar seus dados de anúncios.', retry: 'Tentar de novo', perfUnavailable: 'Não foi possível ler {list} agora — não incluído abaixo.',
      perfQuiet: 'Conectada · nenhum gasto informado nos últimos 7 dias.', perfStatusErr: 'Não foi possível verificar suas conexões agora.', splitAria: 'Gasto por plataforma', conv: '{n} conv.',
      noFigures: 'Nenhum número informado para este período.',
      campsTitle: 'Campanhas', running: 'Ativas', runningSrc: 'nas suas plataformas', drafts: 'Rascunhos', draftsSrc: 'na OrivenAI', needAtt: 'Precisam de atenção', needAttSrc: 'com falha ou bloqueadas',
      unavailable: 'Indisponível', notConnected: 'Não conectado', campsNone: 'Ainda não há campanhas.', createOne: 'Criar uma campanha', more: '+{n} mais',
      stage: { draft: 'Rascunho', unconfirmed: 'Não confirmada', ready: 'Pronta', warning: 'Verificar avisos', blocked: 'Bloqueada', failed: 'Com falha', publishing: 'Publicando', live: 'No ar', paused: 'Pausada', deployed: 'Publicada' },
      autoTitle: 'Automações', viewAutomations: 'Ver automações', autoFree: 'Não incluído no Free', autoFreeSub: 'As automações estão disponíveis a partir do Starter.', autoErr: 'Não foi possível carregar as automações agora.',
      autoPaused: 'Todas as automações pausadas', autoActive1: '1 automação ativa', autoActiveN: '{n} automações ativas', autoNone: 'Ainda não há automações',
      autoManaging: 'Gerencia campanhas em {list}', autoConnected: '{list} conectado', autoNoAccounts: 'As automações funcionam com suas contas de anúncios conectadas.',
      autoNext: 'Próxima ação {when}', autoWaiting1: '1 aguardando aprovação', autoWaitingN: '{n} aguardando aprovação', autoLast: 'Última: {what} · {when}',
      autoAct: { pause_campaign: 'Pausada', resume_campaign: 'Retomada', increase_budget: 'Orçamento aumentado', decrease_budget: 'Orçamento reduzido', notify: 'Avisado', activate: 'Ligada', pause: 'Pausada', resume: 'Retomada', stop: 'Parada' },
      setupTitle: 'Primeiros passos', setupProgress: '{n} de {m} concluídos', setupProfile: 'Adicione o perfil do seu negócio', setupConnect: 'Conecte uma plataforma de anúncios', setupCampaign: 'Crie sua primeira campanha',
      done: 'Concluído', checkingShort: 'Verificando…',
      planTitle: 'Plano de anúncios', planOpen: 'Abrir planejamento', planStart: 'Planejar anúncios', planEmpty: 'Planeje o que você vai anunciar: quando, onde e com qual orçamento.', noDate: 'Sem data',
      ctxTitle: 'Contexto do negócio', ctxSub: 'O que a OrivenAI usa em cada plano e anúncio.',
      mod: { business: 'Negócio', brand: 'Marca', audience: 'Público', competition: 'Concorrência', advertising: 'Publicidade', knowledge: 'Conhecimento' },
      ms: { added: 'Adicionado', incomplete: 'Incompleto', mapped: 'Definida', notSet: 'Não definida', none: 'Nenhum ainda', aud1: '1 público', audN: '{n} públicos', comp1: '1 concorrente', compN: '{n} concorrentes',
        conn: '{n}/4 conectadas', connNone: 'Não conectado', checking: 'Verificando…', items1: '1 item', itemsN: '{n} itens', nothing: 'Nada ainda', issues1: '1 problema', issuesN: '{n} problemas' },
      ml: { bizIncomplete: 'O contexto do negócio está incompleto.', brandNone: 'Identidade da marca não definida.', audNone: 'Ainda não há contexto de público.', compNone: 'Ainda não definido.', advChecking: 'Verificando conexões…', advNone: 'Nenhuma plataforma de anúncios conectada.',
        knowNone: 'Nada aprendido ainda.', colors1: '1 cor definida', colorsN: '{n} cores definidas', remembered1: '1 coisa lembrada', rememberedN: '{n} coisas lembradas', patterns1: '1 padrão identificado', patternsN: '{n} padrões identificados',
        audMapped1: '1 público definido', audMappedN: '{n} públicos definidos', compMapped1: '1 concorrente definido', compMappedN: '{n} concorrentes definidos', platsConn: '{n} / 4 plataformas conectadas', morePlats: '+{n} mais' },
      plat: { connected: 'conectada', notConnected: 'não conectada', unknown: 'status indisponível' },
    },
  };

  function lang() { var l = (typeof CURRENT_LANG !== 'undefined' && CURRENT_LANG) || 'en'; return STR[l] ? l : 'en'; }
  function pick(p) { var g = function (o) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }; var v = g(STR[lang()]); return v == null ? g(STR.en) : v; }
  function T(k, vars) { var s = pick(k); if (s == null) s = k; if (typeof s !== 'string') return s; if (vars) Object.keys(vars).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); }); return s; }
  // Count wording: key1 for one, keyN for more (n is inserted as {n}).
  function N(k, n, vars) { return T(k + (n === 1 ? '1' : 'N'), Object.assign({ n: n }, vars || {})); }
  function list(arr) { if (arr.length < 2) return arr.join(''); return arr.slice(0, -1).join(', ') + ' ' + T('att.and') + ' ' + arr[arr.length - 1]; }
  function rel(iso) {
    if (!iso) return '';
    var d = (new Date(iso).getTime() - Date.now()) / 1000, a = Math.abs(d);
    var u = a < 60 ? ['second', d] : a < 3600 ? ['minute', d / 60] : a < 86400 ? ['hour', d / 3600] : ['day', d / 86400];
    try { return new Intl.RelativeTimeFormat(lang(), { numeric: 'auto' }).format(Math.round(u[1]), u[0]); } catch (_) { return ''; }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function greetingKey() { var h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; }

  // ── Setup checklist (existing data only) ──────────────────────────
  // Each step is: true (done, from real data), false (not done) or null
  // (not known yet — never shown as done).
  function setupState() {
    var m = window._bicModel || null;
    var OW = window.orvWorkspace;
    // Before the profile request has answered, the model is empty — unknown, not "not done".
    var business = m && m.business && window._bizProfileLoaded === true ? !!m.business.hasData : null;
    var conn = null;
    if (m && m.advertising) {
      var plats = m.advertising.platforms || [];
      if (plats.some(function (p) { return p.connected === true; })) conn = true;
      else if (plats.length && plats.every(function (p) { return p.connected === false; })) conn = false;
    }
    var campaign = null;
    if (OW && OW.campaigns && OW.campaigns.settled) {
      var n = OW.campaigns.counts();
      campaign = (n.total || 0) + (n.live || 0) > 0;
    }
    return [
      { key: 'profile', done: business, label: T('setupProfile'), go: "bizGoTo('business')" },
      { key: 'connect', done: conn, label: T('setupConnect'), go: "bizGoTo('connections')" },
      { key: 'campaign', done: campaign, label: T('setupCampaign'), go: "_orvNav('create','page-create')" },
    ];
  }
  function renderSetup() {
    var el = document.getElementById('ccxSetup'); if (!el) return;
    var steps = setupState();
    var known = steps.every(function (s) { return s.done !== null; });
    var doneN = steps.filter(function (s) { return s.done === true; }).length;
    if (known && doneN === steps.length) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = '<div class="ccx-card-hd"><h2 class="ccx-h">' + esc(T('setupTitle')) + '</h2>' + (known ? '<span class="ccx-meta">' + esc(T('setupProgress', { n: doneN, m: steps.length })) + '</span>' : '') + '</div>' +
      '<div class="ccx-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + steps.length + '" aria-valuenow="' + doneN + '" aria-label="' + esc(T('setupTitle')) + '"><i style="width:' + Math.round(doneN / steps.length * 100) + '%"></i></div>' +
      '<ol class="ccx-steps">' + steps.map(function (s) {
        var st = s.done === true ? 'is-done' : s.done === false ? 'is-todo' : 'is-unknown';
        var tail = s.done === true ? '<span class="ccx-step-st">' + esc(T('done')) + '</span>' : s.done === null ? '<span class="ccx-step-st ccx-muted">' + esc(T('checkingShort')) + '</span>' : '<span class="ccx-go" aria-hidden="true">→</span>';
        var inner = '<span class="ccx-step-mark" aria-hidden="true">' + (s.done === true ? '✓' : '') + '</span><span class="ccx-step-l">' + esc(s.label) + '</span>' + tail;
        return '<li class="ccx-step ' + st + '">' + (s.done === false ? '<button type="button" class="ccx-step-btn" onclick="' + s.go + '">' + inner + '</button>' : '<div class="ccx-step-btn" aria-disabled="true">' + inner + '</div>') + '</li>';
      }).join('') + '</ol>';
  }

  // ── Needs you: one list from two sources ─────────────────────────
  // Ad signals (#ovAtt, orivenOpsPages.js) and workspace items
  // (#owNeedsList, orivenWorkspace.js) render rows with data-rank
  // (0 = problem, 1 = needs attention, 2 = ready). This orders them as one
  // list (CSS order), shows the first three, and sets the card's state.
  var expanded = false, MAX = 3;
  function needsSync() {
    var card = document.getElementById('owNeeds'); if (!card) return;
    var rows = Array.prototype.slice.call(card.querySelectorAll('[data-rank]'));
    var sigReady = card.getAttribute('data-sig-ready') === '1', wsReady = card.getAttribute('data-ws-ready') === '1';
    rows.sort(function (a, b) { return (+a.getAttribute('data-rank') - +b.getAttribute('data-rank')) || (+a.getAttribute('data-i') - +b.getAttribute('data-i')); });
    rows.forEach(function (r, i) { r.style.order = String(i); r.hidden = !expanded && i >= MAX; });
    var top = rows.length ? +rows[0].getAttribute('data-rank') : null;
    card.classList.toggle('is-calm', !rows.length);
    card.classList.toggle('is-risk', top === 0);
    card.classList.toggle('is-warn', top === 1);
    card.classList.toggle('is-ready', top === 2);
    var cnt = document.getElementById('ovAttCount');
    if (cnt) cnt.textContent = rows.length ? N('count', rows.length) : '';
    var calm = document.getElementById('ccxNeedsCalm');
    if (calm) { calm.hidden = !!rows.length; calm.textContent = sigReady && wsReady ? T('calm') : T('checking'); calm.classList.toggle('is-loading', !(sigReady && wsReady)); }
    var more = document.getElementById('ccxNeedsMore');
    if (more) { more.hidden = rows.length <= MAX; more.textContent = expanded ? T('showLess') : T('viewAll', { n: rows.length }); more.setAttribute('aria-expanded', expanded ? 'true' : 'false'); }
  }
  function needsToggle() { expanded = !expanded; needsSync(); }
  function needsReset() { expanded = false; }

  // ── Header status (honest about sources) ─────────────────────────
  // runningOnPlatforms: number from the live platform read (orivenOpsPages)
  // or null when it isn't known — then no "running" claim is made.
  var running = null;
  function setRunning(n) { running = (typeof n === 'number') ? n : null; if (window.orvWorkspace && orvWorkspace.home && orvWorkspace.home.render) orvWorkspace.home.render(); }
  function statusLine(drafts, attention) {
    var parts = [];
    if (running) parts.push(N('stRunning', running));
    if (drafts) parts.push(N('stDrafts', drafts));
    if (attention) parts.push(N('stAtt', attention));
    return parts.length ? parts.join(' · ') + '.' : T('stNothing');
  }

  // ── Language change: repaint every block from what is already loaded ──
  function relabel() {
    var g = document.getElementById('ccxCreateBtn'); if (g) g.textContent = T('createCampaign');
    document.querySelectorAll('[data-cc]').forEach(function (el) { el.textContent = T(el.getAttribute('data-cc')); });
    try { if (window.orvWorkspace && orvWorkspace.home && orvWorkspace.home.render) orvWorkspace.home.render(); } catch (_) {}
    try { if (window.orvWorkspace && orvWorkspace.ops && orvWorkspace.ops.repaintOverview) orvWorkspace.ops.repaintOverview(); } catch (_) {}
    try { if (typeof window._bicRender === 'function') window._bicRender(); } catch (_) {}
    try { if (typeof window._bizRenderCentralIcon === 'function') window._bizRenderCentralIcon(); } catch (_) {}
    try { if (window.orvWorkspace && orvWorkspace.ops && orvWorkspace.ops.planning && orvWorkspace.ops.planning.paintStrip) orvWorkspace.ops.planning.paintStrip(); } catch (_) {}
    renderSetup(); needsSync();
  }

  window.orvCC = { T: T, N: N, list: list, rel: rel, esc: esc, greetingKey: greetingKey, renderSetup: renderSetup, setupState: setupState,
    needsSync: needsSync, needsToggle: needsToggle, needsReset: needsReset, setRunning: setRunning, statusLine: statusLine, relabel: relabel,
    reset: function () { running = null; expanded = false; }, _STR: STR };

  if (typeof window.applyLanguage === 'function' && !window.applyLanguage._cc) {
    var orig = window.applyLanguage;
    window.applyLanguage = function () { var r = orig.apply(this, arguments); try { relabel(); } catch (_) {} return r; };
    window.applyLanguage._cc = true;
  }
})();
