/* ════════════════════════════════════════════════════════════════
   Research 2.0 — #page-research

   Three states in one page: Home (question, research type, business
   context, cost, library) → Progress (the job's real stages) → Report
   (type-specific sections, evidence, sources & limitations).

   Backend: POST /api/research/query starts a job (202 + reportId);
   GET /api/research/reports[/:id] is the library and the job status;
   PATCH renames, DELETE removes. The server is the source of truth —
   localStorage only remembers the last opened report id and the insights
   picked for Create on this device.

   Evidence labels come from the server's check (services/researchReport.js):
   source_checked = a quoted passage was found in a page OrivenAI read;
   source_cited = a source was cited but the claim wasn't checked;
   analysis = reasoning; idea = an idea to test.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MAX_PICKS = 8, Q_MAX = 500, URL_MAX = 5;
  var TYPES = ['market', 'competitor', 'audience', 'opportunity'];

  // ── Texts ─────────────────────────────────────────────────────────
  var STR = {
    en: {
      title: 'Research', subtitle: 'Understand your market, competitors and customers with research-backed advertising insights.',
      qLabel: 'What do you want to research?', qPh: 'e.g. How do premium running-shoe brands advertise in the Netherlands?', qCount: '{n}/{max}',
      typeLabel: 'Research type',
      types: {
        market: ['Market research', 'Trends, developments, the competitive landscape and demand.', 'Market overview · trends · landscape · opportunities'],
        competitor: ['Competitor research', 'How competitors position, price, message and advertise.', 'Competitor cards · comparison · ad patterns · gaps'],
        audience: ['Audience research', 'Needs, pain points, motivations and objections.', 'Segments · needs & pains · motivations · messaging'],
        opportunity: ['Opportunity research', 'Gaps and angles worth testing, with the reasons why.', 'Opportunities · evidence · angles · tests · risks'],
      },
      youGet: 'You get: {list}',
      ctxLabel: 'Business context', ctxUsed: 'Research uses your business profile:', ctxNone: 'No business profile yet — research works without one, but is more specific with it.', ctxSetup: 'Set up your business', ctxEdit: 'Edit',
      ctxWebsite: 'Read my website ({site}) as a source', ctxCountry: 'Market: {c}', ctxNoCountry: 'No country set — findings stay market-neutral',
      sitesLabel: 'Extra websites to read (optional)', sitesAdd: '+ Add a website', sitesPh: 'https://example.com/page', sitesAddBtn: 'Add', sitesRemove: 'Remove {u}', sitesMax: 'Up to {n} websites.', sitesBad: 'Enter a full web address, like https://example.com.',
      cost: '{n} credits', costWhat: 'Covers up to 3 web searches, reading up to 5 sources and the analysis. Usually about a minute. Not charged if it fails.',
      start: 'Start Research', starting: 'Starting…',
      vEmpty: 'Describe what you want to research.', vShort: 'Describe it in a few more words.', vLong: 'Keep it under {n} characters.',
      runningBanner: 'Research in progress: “{t}”', viewProgress: 'View progress',
      libTitle: 'Your research', libEmpty: 'Your saved research appears here. Every completed report is saved to your account.', libErr: 'Couldn’t load your research.', retry: 'Try again',
      cont: 'Continue: {t}', open: 'Open', rename: 'Rename', del: 'Delete', save: 'Save', cancel: 'Cancel', renamePh: 'Report name',
      stReady: 'Ready', stRunning: 'In progress', stFailed: 'Failed — not charged', sources: '{n} sources read', sourcesShort: '{n} sources',
      confDelH: 'Delete this research?', confDelP: 'It disappears from your library. The credits aren’t refunded.', tDeleted: 'Research deleted.', tRenamed: 'Renamed.', tStillRunning: 'This research is still running.',
      // Progress
      progTitle: 'Researching', progLeave: 'You can leave this page — the research continues and is saved to your library.',
      stages: { preparing: 'Preparing research', searching: 'Searching the web', reading: 'Reading sources', analysing: 'Analysing findings', saving: 'Saving the report' },
      pSearches: '{n} targeted searches', pResults: '{n} results found', pReading: 'reading {n} pages', pRead: '{n} pages read',
      elapsed: '{s} s', failedH: 'Research didn’t finish', tryAgain: 'Try again', backHome: 'Back to Research',
      eCredits: 'Research costs {n} credits — you don’t have enough credits right now.', ePlans: 'View plans', eRunning: 'A research is already running.', eGeneric: 'Research could not be started. Nothing was charged — please try again.', eNetwork: 'No connection. Nothing was charged — check your connection and try again.', ref: 'Reference: {id}',
      // Report
      back: 'Research', newResearch: 'New research', created: 'Created {d}', readN: '{n} of {m} sources read', searchesN: '{n} searches',
      partial: 'The analysis was cut short, so some sections may be incomplete.', legacy: 'Created with an earlier version of Research. Its evidence was not checked against source text, so “cited” means a source was listed, not checked.',
      onThisPage: 'On this page', sec: {
        summary: 'Executive summary', overview: 'Market overview', trends: 'Market trends', demand: 'Customer demand signals', landscape: 'Competitive landscape', mOpps: 'Market opportunities', implications: 'Advertising implications',
        compOverview: 'Competitor overview', comparison: 'Competitor comparison', positioning: 'Positioning & messaging', adPatterns: 'Public advertising patterns', diff: 'Differentiation opportunities',
        segments: 'Audience segments', needs: 'Customer needs & pain points', motives: 'Motivations & objections', messaging: 'Messaging opportunities',
        keyOpps: 'Key opportunities', support: 'Supporting evidence', angles: 'Advertising angles', tests: 'Suggested tests', risks: 'Risks', sources: 'Sources & limitations',
        competitors: 'Competitors', signals: 'Customer signals', opportunities: 'Opportunities', concepts: 'Creative concepts', nextSteps: 'Next steps',
      },
      keyConclusions: 'Key conclusions', why: 'Why it matters', ideasNote: 'Ideas to test — reasoned suggestions, not measured results.', hypoNote: 'Hypotheses about who to reach — check them against your own data.',
      f: { website: 'Website', offering: 'Offering', positioning: 'Positioning', value: 'Value proposition', pricing: 'Public pricing', messaging: 'Messaging', ads: 'Observed advertising', diff: 'Where you could stand apart', audience: 'Audience', angle: 'Angle', test: 'Test', limitation: 'Limitation', needs: 'Needs', related: 'Related', language: 'In their words', measure: 'Compare', mitigation: 'How to handle it', hook: 'Hook', format: 'Format' },
      sig: { need: 'Needs', painPoint: 'Pain points', motivation: 'Motivations', objection: 'Objections', consideration: 'Buying considerations' },
      vs: 'vs', notFound: 'Not found in sources',
      ev: { source_checked: 'Source-checked', source_cited: 'Cited, not checked', analysis: 'Analysis', idea: 'Idea to test' },
      evTip: { source_checked: 'The quoted passage was found in a page OrivenAI read for this research.', source_cited: 'A source was cited, but the claim was not checked against the page text.', analysis: 'Reasoning based on the available information — no source.', idea: 'A suggestion to test — not a measured result.' },
      showQuote: 'Show source passage', supportedBy: 'Supported by',
      addCreate: 'Add to Create', added: 'Added', addFull: 'Up to {n} insights',
      tray: 'Selected insights {n}/{max}', trayUse: 'Use {n} insights in Create', trayUse1: 'Use 1 insight in Create', trayClear: 'Clear', trayRemove: 'Remove {t}', trayHint: 'They’ll appear in Create as research context. You can remove them there too.',
      tCreate: '{n} research insight(s) added to Create — review before building.',
      srcIntro: 'OrivenAI ran {s} searches, found {r} results and read {f} pages. Only passages from pages it read can be source-checked.',
      srcRead: 'Read', srcNotRead: 'Not read', srcResult: 'Search result', srcOwn: 'Your website', srcAttached: 'Added by you', srcUsedIn: 'Used in: {list}', srcNone: 'No web sources could be retrieved for this research — everything in it is analysis.',
      limits: 'Limitations', assumptions: 'Assumptions', refTools: 'See live ads yourself', refNote: 'Official ad libraries — OrivenAI doesn’t query these; open them to check current ads.', urlErr: 'Couldn’t read {u}: {r}', siteErr: 'Your website couldn’t be read: {r}',
      noPerf: 'No competitor ad-performance data is available — nothing here says an ad is profitable or performs well.',
      confidence: { low: 'Low confidence', moderate: 'Moderate confidence' },
      rel: { now: 'just now', min: '{n} min ago', h: '{n} h ago', d: '{n} d ago' },
      loading: 'Loading…', errOpen: 'Couldn’t open this research.',
    },
    nl: {
      title: 'Onderzoek', subtitle: 'Begrijp je markt, concurrenten en klanten met onderbouwde advertentie-inzichten.',
      qLabel: 'Wat wil je onderzoeken?', qPh: 'bijv. Hoe adverteren premium hardloopschoenmerken in Nederland?', qCount: '{n}/{max}',
      typeLabel: 'Soort onderzoek',
      types: {
        market: ['Marktonderzoek', 'Trends, ontwikkelingen, het concurrentieveld en de vraag.', 'Marktoverzicht · trends · concurrentieveld · kansen'],
        competitor: ['Concurrentieonderzoek', 'Hoe concurrenten zich positioneren, prijzen, communiceren en adverteren.', 'Concurrentkaarten · vergelijking · advertentiepatronen · gaten'],
        audience: ['Doelgroeponderzoek', 'Behoeften, pijnpunten, motivaties en bezwaren.', 'Segmenten · behoeften & pijnpunten · motivaties · boodschappen'],
        opportunity: ['Kansenonderzoek', 'Gaten en invalshoeken om te testen, met de redenen waarom.', 'Kansen · onderbouwing · invalshoeken · tests · risico’s'],
      },
      youGet: 'Je krijgt: {list}',
      ctxLabel: 'Bedrijfscontext', ctxUsed: 'Onderzoek gebruikt je bedrijfsprofiel:', ctxNone: 'Nog geen bedrijfsprofiel — onderzoek werkt ook zonder, maar wordt specifieker mét.', ctxSetup: 'Bedrijf instellen', ctxEdit: 'Bewerken',
      ctxWebsite: 'Mijn website ({site}) lezen als bron', ctxCountry: 'Markt: {c}', ctxNoCountry: 'Geen land ingesteld — bevindingen blijven marktneutraal',
      sitesLabel: 'Extra websites om te lezen (optioneel)', sitesAdd: '+ Website toevoegen', sitesPh: 'https://voorbeeld.nl/pagina', sitesAddBtn: 'Toevoegen', sitesRemove: '{u} verwijderen', sitesMax: 'Maximaal {n} websites.', sitesBad: 'Vul een volledig webadres in, zoals https://voorbeeld.nl.',
      cost: '{n} credits', costWhat: 'Voor maximaal 3 webzoekopdrachten, het lezen van maximaal 5 bronnen en de analyse. Meestal ongeveer een minuut. Niet in rekening gebracht als het mislukt.',
      start: 'Onderzoek starten', starting: 'Starten…',
      vEmpty: 'Beschrijf wat je wilt onderzoeken.', vShort: 'Beschrijf het in iets meer woorden.', vLong: 'Houd het onder de {n} tekens.',
      runningBanner: 'Onderzoek bezig: “{t}”', viewProgress: 'Voortgang bekijken',
      libTitle: 'Je onderzoeken', libEmpty: 'Je opgeslagen onderzoeken verschijnen hier. Elk afgerond rapport wordt in je account bewaard.', libErr: 'Je onderzoeken konden niet worden geladen.', retry: 'Opnieuw proberen',
      cont: 'Verder met: {t}', open: 'Openen', rename: 'Hernoemen', del: 'Verwijderen', save: 'Opslaan', cancel: 'Annuleren', renamePh: 'Naam van het rapport',
      stReady: 'Klaar', stRunning: 'Bezig', stFailed: 'Mislukt — niet in rekening gebracht', sources: '{n} bronnen gelezen', sourcesShort: '{n} bronnen',
      confDelH: 'Dit onderzoek verwijderen?', confDelP: 'Het verdwijnt uit je overzicht. De credits worden niet terugbetaald.', tDeleted: 'Onderzoek verwijderd.', tRenamed: 'Hernoemd.', tStillRunning: 'Dit onderzoek is nog bezig.',
      progTitle: 'Bezig met onderzoek', progLeave: 'Je kunt deze pagina verlaten — het onderzoek gaat door en wordt in je overzicht opgeslagen.',
      stages: { preparing: 'Onderzoek voorbereiden', searching: 'Het web doorzoeken', reading: 'Bronnen lezen', analysing: 'Bevindingen analyseren', saving: 'Rapport opslaan' },
      pSearches: '{n} gerichte zoekopdrachten', pResults: '{n} resultaten gevonden', pReading: '{n} pagina’s worden gelezen', pRead: '{n} pagina’s gelezen',
      elapsed: '{s} s', failedH: 'Onderzoek niet afgerond', tryAgain: 'Opnieuw proberen', backHome: 'Terug naar Onderzoek',
      eCredits: 'Onderzoek kost {n} credits — je hebt nu niet genoeg credits.', ePlans: 'Abonnementen bekijken', eRunning: 'Er loopt al een onderzoek.', eGeneric: 'Het onderzoek kon niet starten. Er is niets in rekening gebracht — probeer het opnieuw.', eNetwork: 'Geen verbinding. Er is niets in rekening gebracht — controleer je verbinding en probeer het opnieuw.', ref: 'Referentie: {id}',
      back: 'Onderzoek', newResearch: 'Nieuw onderzoek', created: 'Gemaakt {d}', readN: '{n} van {m} bronnen gelezen', searchesN: '{n} zoekopdrachten',
      partial: 'De analyse is afgekapt, dus sommige onderdelen kunnen onvolledig zijn.', legacy: 'Gemaakt met een eerdere versie van Onderzoek. De onderbouwing is niet gecontroleerd tegen de brontekst, dus “geciteerd” betekent dat er een bron is genoemd, niet dat die is gecontroleerd.',
      onThisPage: 'Op deze pagina', sec: {
        summary: 'Samenvatting', overview: 'Marktoverzicht', trends: 'Markttrends', demand: 'Signalen van klantvraag', landscape: 'Concurrentieveld', mOpps: 'Marktkansen', implications: 'Wat dit betekent voor adverteren',
        compOverview: 'Overzicht concurrenten', comparison: 'Vergelijking concurrenten', positioning: 'Positionering & boodschap', adPatterns: 'Zichtbare advertentiepatronen', diff: 'Kansen om je te onderscheiden',
        segments: 'Doelgroepsegmenten', needs: 'Klantbehoeften & pijnpunten', motives: 'Motivaties & bezwaren', messaging: 'Kansen voor je boodschap',
        keyOpps: 'Belangrijkste kansen', support: 'Onderbouwing', angles: 'Advertentie-invalshoeken', tests: 'Voorgestelde tests', risks: 'Risico’s', sources: 'Bronnen & beperkingen',
        competitors: 'Concurrenten', signals: 'Klantsignalen', opportunities: 'Kansen', concepts: 'Creatieve concepten', nextSteps: 'Volgende stappen',
      },
      keyConclusions: 'Belangrijkste conclusies', why: 'Waarom het ertoe doet', ideasNote: 'Ideeën om te testen — beredeneerde suggesties, geen gemeten resultaten.', hypoNote: 'Hypotheses over wie je wilt bereiken — toets ze aan je eigen gegevens.',
      f: { website: 'Website', offering: 'Aanbod', positioning: 'Positionering', value: 'Waardepropositie', pricing: 'Openbare prijzen', messaging: 'Boodschap', ads: 'Waargenomen advertenties', diff: 'Waar jij je kunt onderscheiden', audience: 'Doelgroep', angle: 'Invalshoek', test: 'Test', limitation: 'Beperking', needs: 'Behoeften', related: 'Gerelateerd', language: 'In hun woorden', measure: 'Vergelijk', mitigation: 'Hoe ermee om te gaan', hook: 'Haak', format: 'Formaat' },
      sig: { need: 'Behoeften', painPoint: 'Pijnpunten', motivation: 'Motivaties', objection: 'Bezwaren', consideration: 'Aankoopoverwegingen' },
      vs: 'vs', notFound: 'Niet gevonden in bronnen',
      ev: { source_checked: 'Bron gecontroleerd', source_cited: 'Geciteerd, niet gecontroleerd', analysis: 'Analyse', idea: 'Idee om te testen' },
      evTip: { source_checked: 'De geciteerde passage is gevonden op een pagina die OrivenAI voor dit onderzoek las.', source_cited: 'Er is een bron genoemd, maar de bewering is niet gecontroleerd tegen de paginatekst.', analysis: 'Redenering op basis van de beschikbare informatie — geen bron.', idea: 'Een suggestie om te testen — geen gemeten resultaat.' },
      showQuote: 'Bronpassage tonen', supportedBy: 'Onderbouwd door',
      addCreate: 'Toevoegen aan Create', added: 'Toegevoegd', addFull: 'Maximaal {n} inzichten',
      tray: 'Geselecteerde inzichten {n}/{max}', trayUse: '{n} inzichten gebruiken in Create', trayUse1: '1 inzicht gebruiken in Create', trayClear: 'Wissen', trayRemove: '{t} verwijderen', trayHint: 'Ze verschijnen in Create als onderzoekscontext. Je kunt ze daar ook verwijderen.',
      tCreate: '{n} onderzoeksinzicht(en) toegevoegd aan Create — controleer ze voor je bouwt.',
      srcIntro: 'OrivenAI deed {s} zoekopdrachten, vond {r} resultaten en las {f} pagina’s. Alleen passages van gelezen pagina’s kunnen gecontroleerd worden.',
      srcRead: 'Gelezen', srcNotRead: 'Niet gelezen', srcResult: 'Zoekresultaat', srcOwn: 'Je website', srcAttached: 'Door jou toegevoegd', srcUsedIn: 'Gebruikt in: {list}', srcNone: 'Er konden geen webbronnen worden opgehaald — alles in dit rapport is analyse.',
      limits: 'Beperkingen', assumptions: 'Aannames', refTools: 'Bekijk live advertenties zelf', refNote: 'Officiële advertentiebibliotheken — OrivenAI raadpleegt ze niet; open ze om actuele advertenties te bekijken.', urlErr: '{u} kon niet worden gelezen: {r}', siteErr: 'Je website kon niet worden gelezen: {r}',
      noPerf: 'Er zijn geen prestatiegegevens van advertenties van concurrenten — niets hier zegt dat een advertentie winstgevend is of goed presteert.',
      confidence: { low: 'Lage zekerheid', moderate: 'Gemiddelde zekerheid' },
      rel: { now: 'zojuist', min: '{n} min geleden', h: '{n} u geleden', d: '{n} d geleden' },
      loading: 'Laden…', errOpen: 'Dit onderzoek kon niet worden geopend.',
    },
    de: {
      title: 'Recherche', subtitle: 'Verstehe Markt, Wettbewerber und Kunden mit fundierten Werbe-Insights.',
      qLabel: 'Was möchtest du recherchieren?', qPh: 'z. B. Wie werben Premium-Laufschuhmarken in den Niederlanden?', qCount: '{n}/{max}',
      typeLabel: 'Art der Recherche',
      types: {
        market: ['Marktrecherche', 'Trends, Entwicklungen, Wettbewerbsumfeld und Nachfrage.', 'Marktüberblick · Trends · Wettbewerbsumfeld · Chancen'],
        competitor: ['Wettbewerbsrecherche', 'Wie Wettbewerber sich positionieren, Preise setzen, kommunizieren und werben.', 'Wettbewerberkarten · Vergleich · Werbemuster · Lücken'],
        audience: ['Zielgruppenrecherche', 'Bedürfnisse, Probleme, Motive und Einwände.', 'Segmente · Bedürfnisse & Probleme · Motive · Botschaften'],
        opportunity: ['Chancenrecherche', 'Lücken und Ansätze zum Testen, mit Begründung.', 'Chancen · Belege · Ansätze · Tests · Risiken'],
      },
      youGet: 'Du erhältst: {list}',
      ctxLabel: 'Unternehmenskontext', ctxUsed: 'Die Recherche nutzt dein Unternehmensprofil:', ctxNone: 'Noch kein Unternehmensprofil — die Recherche funktioniert auch ohne, wird damit aber genauer.', ctxSetup: 'Unternehmen einrichten', ctxEdit: 'Bearbeiten',
      ctxWebsite: 'Meine Website ({site}) als Quelle lesen', ctxCountry: 'Markt: {c}', ctxNoCountry: 'Kein Land festgelegt — Ergebnisse bleiben marktneutral',
      sitesLabel: 'Weitere Websites zum Lesen (optional)', sitesAdd: '+ Website hinzufügen', sitesPh: 'https://beispiel.de/seite', sitesAddBtn: 'Hinzufügen', sitesRemove: '{u} entfernen', sitesMax: 'Bis zu {n} Websites.', sitesBad: 'Gib eine vollständige Webadresse ein, z. B. https://beispiel.de.',
      cost: '{n} Credits', costWhat: 'Für bis zu 3 Websuchen, das Lesen von bis zu 5 Quellen und die Analyse. Dauert meist etwa eine Minute. Keine Kosten, wenn es fehlschlägt.',
      start: 'Recherche starten', starting: 'Wird gestartet…',
      vEmpty: 'Beschreibe, was du recherchieren möchtest.', vShort: 'Beschreibe es mit ein paar Worten mehr.', vLong: 'Bleib unter {n} Zeichen.',
      runningBanner: 'Recherche läuft: „{t}“', viewProgress: 'Fortschritt ansehen',
      libTitle: 'Deine Recherchen', libEmpty: 'Deine gespeicherten Recherchen erscheinen hier. Jeder fertige Bericht wird in deinem Konto gespeichert.', libErr: 'Deine Recherchen konnten nicht geladen werden.', retry: 'Erneut versuchen',
      cont: 'Weiter mit: {t}', open: 'Öffnen', rename: 'Umbenennen', del: 'Löschen', save: 'Speichern', cancel: 'Abbrechen', renamePh: 'Name des Berichts',
      stReady: 'Fertig', stRunning: 'Läuft', stFailed: 'Fehlgeschlagen — nicht berechnet', sources: '{n} Quellen gelesen', sourcesShort: '{n} Quellen',
      confDelH: 'Diese Recherche löschen?', confDelP: 'Sie verschwindet aus deiner Übersicht. Die Credits werden nicht erstattet.', tDeleted: 'Recherche gelöscht.', tRenamed: 'Umbenannt.', tStillRunning: 'Diese Recherche läuft noch.',
      progTitle: 'Recherche läuft', progLeave: 'Du kannst diese Seite verlassen — die Recherche läuft weiter und wird in deiner Übersicht gespeichert.',
      stages: { preparing: 'Recherche vorbereiten', searching: 'Das Web durchsuchen', reading: 'Quellen lesen', analysing: 'Ergebnisse analysieren', saving: 'Bericht speichern' },
      pSearches: '{n} gezielte Suchen', pResults: '{n} Ergebnisse gefunden', pReading: '{n} Seiten werden gelesen', pRead: '{n} Seiten gelesen',
      elapsed: '{s} s', failedH: 'Recherche nicht abgeschlossen', tryAgain: 'Erneut versuchen', backHome: 'Zurück zur Recherche',
      eCredits: 'Eine Recherche kostet {n} Credits — du hast gerade nicht genug Credits.', ePlans: 'Tarife ansehen', eRunning: 'Es läuft bereits eine Recherche.', eGeneric: 'Die Recherche konnte nicht starten. Es wurde nichts berechnet — bitte versuche es erneut.', eNetwork: 'Keine Verbindung. Es wurde nichts berechnet — prüfe deine Verbindung und versuche es erneut.', ref: 'Referenz: {id}',
      back: 'Recherche', newResearch: 'Neue Recherche', created: 'Erstellt {d}', readN: '{n} von {m} Quellen gelesen', searchesN: '{n} Suchen',
      partial: 'Die Analyse wurde abgeschnitten, einige Abschnitte können unvollständig sein.', legacy: 'Mit einer früheren Version der Recherche erstellt. Die Belege wurden nicht am Quelltext geprüft — „zitiert“ heißt, dass eine Quelle genannt, nicht geprüft wurde.',
      onThisPage: 'Auf dieser Seite', sec: {
        summary: 'Zusammenfassung', overview: 'Marktüberblick', trends: 'Markttrends', demand: 'Signale der Kundennachfrage', landscape: 'Wettbewerbsumfeld', mOpps: 'Marktchancen', implications: 'Was das für Werbung bedeutet',
        compOverview: 'Überblick Wettbewerber', comparison: 'Wettbewerbervergleich', positioning: 'Positionierung & Botschaft', adPatterns: 'Sichtbare Werbemuster', diff: 'Chancen zur Differenzierung',
        segments: 'Zielgruppensegmente', needs: 'Bedürfnisse & Probleme', motives: 'Motive & Einwände', messaging: 'Chancen für deine Botschaft',
        keyOpps: 'Wichtigste Chancen', support: 'Belege', angles: 'Werbeansätze', tests: 'Vorgeschlagene Tests', risks: 'Risiken', sources: 'Quellen & Grenzen',
        competitors: 'Wettbewerber', signals: 'Kundensignale', opportunities: 'Chancen', concepts: 'Kreativkonzepte', nextSteps: 'Nächste Schritte',
      },
      keyConclusions: 'Wichtigste Erkenntnisse', why: 'Warum es wichtig ist', ideasNote: 'Ideen zum Testen — begründete Vorschläge, keine gemessenen Ergebnisse.', hypoNote: 'Hypothesen, wen du erreichen willst — prüfe sie mit deinen eigenen Daten.',
      f: { website: 'Website', offering: 'Angebot', positioning: 'Positionierung', value: 'Nutzenversprechen', pricing: 'Öffentliche Preise', messaging: 'Botschaft', ads: 'Beobachtete Werbung', diff: 'Wo du dich abheben kannst', audience: 'Zielgruppe', angle: 'Ansatz', test: 'Test', limitation: 'Einschränkung', needs: 'Bedürfnisse', related: 'Bezug', language: 'In ihren Worten', measure: 'Vergleichen', mitigation: 'Umgang damit', hook: 'Hook', format: 'Format' },
      sig: { need: 'Bedürfnisse', painPoint: 'Probleme', motivation: 'Motive', objection: 'Einwände', consideration: 'Kaufkriterien' },
      vs: 'vs.', notFound: 'In den Quellen nicht gefunden',
      ev: { source_checked: 'Quelle geprüft', source_cited: 'Zitiert, nicht geprüft', analysis: 'Analyse', idea: 'Idee zum Testen' },
      evTip: { source_checked: 'Die zitierte Passage wurde auf einer Seite gefunden, die OrivenAI für diese Recherche gelesen hat.', source_cited: 'Eine Quelle wurde genannt, die Aussage aber nicht am Seitentext geprüft.', analysis: 'Schlussfolgerung aus den verfügbaren Informationen — ohne Quelle.', idea: 'Ein Vorschlag zum Testen — kein gemessenes Ergebnis.' },
      showQuote: 'Quellpassage anzeigen', supportedBy: 'Belegt durch',
      addCreate: 'Zu Create hinzufügen', added: 'Hinzugefügt', addFull: 'Bis zu {n} Insights',
      tray: 'Ausgewählte Insights {n}/{max}', trayUse: '{n} Insights in Create nutzen', trayUse1: '1 Insight in Create nutzen', trayClear: 'Leeren', trayRemove: '{t} entfernen', trayHint: 'Sie erscheinen in Create als Recherche-Kontext. Dort kannst du sie auch entfernen.',
      tCreate: '{n} Recherche-Insight(s) zu Create hinzugefügt — prüfe sie vor dem Erstellen.',
      srcIntro: 'OrivenAI hat {s} Suchen durchgeführt, {r} Ergebnisse gefunden und {f} Seiten gelesen. Nur Passagen gelesener Seiten können geprüft werden.',
      srcRead: 'Gelesen', srcNotRead: 'Nicht gelesen', srcResult: 'Suchergebnis', srcOwn: 'Deine Website', srcAttached: 'Von dir hinzugefügt', srcUsedIn: 'Verwendet in: {list}', srcNone: 'Für diese Recherche konnten keine Webquellen abgerufen werden — alles darin ist Analyse.',
      limits: 'Grenzen', assumptions: 'Annahmen', refTools: 'Live-Anzeigen selbst ansehen', refNote: 'Offizielle Werbebibliotheken — OrivenAI fragt sie nicht ab; öffne sie, um aktuelle Anzeigen zu sehen.', urlErr: '{u} konnte nicht gelesen werden: {r}', siteErr: 'Deine Website konnte nicht gelesen werden: {r}',
      noPerf: 'Es gibt keine Leistungsdaten zu Anzeigen von Wettbewerbern — nichts hier besagt, dass eine Anzeige profitabel ist oder gut funktioniert.',
      confidence: { low: 'Geringe Sicherheit', moderate: 'Mittlere Sicherheit' },
      rel: { now: 'gerade eben', min: 'vor {n} Min.', h: 'vor {n} Std.', d: 'vor {n} T.' },
      loading: 'Wird geladen…', errOpen: 'Diese Recherche konnte nicht geöffnet werden.',
    },
    fr: {
      title: 'Recherche', subtitle: 'Comprenez votre marché, vos concurrents et vos clients grâce à des insights publicitaires étayés.',
      qLabel: 'Que voulez-vous étudier ?', qPh: 'ex. Comment les marques de chaussures de course premium font-elles leur publicité aux Pays-Bas ?', qCount: '{n}/{max}',
      typeLabel: 'Type de recherche',
      types: {
        market: ['Étude de marché', 'Tendances, évolutions, paysage concurrentiel et demande.', 'Vue du marché · tendances · paysage · opportunités'],
        competitor: ['Étude des concurrents', 'Comment les concurrents se positionnent, fixent leurs prix, communiquent et font de la publicité.', 'Fiches concurrents · comparaison · publicités · lacunes'],
        audience: ['Étude d’audience', 'Besoins, points de douleur, motivations et objections.', 'Segments · besoins & douleurs · motivations · messages'],
        opportunity: ['Étude d’opportunités', 'Lacunes et angles à tester, avec leurs raisons.', 'Opportunités · preuves · angles · tests · risques'],
      },
      youGet: 'Vous obtenez : {list}',
      ctxLabel: 'Contexte de l’entreprise', ctxUsed: 'La recherche utilise votre profil d’entreprise :', ctxNone: 'Pas encore de profil d’entreprise — la recherche fonctionne sans, mais est plus précise avec.', ctxSetup: 'Configurer votre entreprise', ctxEdit: 'Modifier',
      ctxWebsite: 'Lire mon site ({site}) comme source', ctxCountry: 'Marché : {c}', ctxNoCountry: 'Aucun pays défini — les résultats restent neutres',
      sitesLabel: 'Sites supplémentaires à lire (facultatif)', sitesAdd: '+ Ajouter un site', sitesPh: 'https://exemple.fr/page', sitesAddBtn: 'Ajouter', sitesRemove: 'Retirer {u}', sitesMax: 'Jusqu’à {n} sites.', sitesBad: 'Saisissez une adresse complète, comme https://exemple.fr.',
      cost: '{n} crédits', costWhat: 'Comprend jusqu’à 3 recherches web, la lecture de 5 sources maximum et l’analyse. Environ une minute en général. Non facturé en cas d’échec.',
      start: 'Lancer la recherche', starting: 'Démarrage…',
      vEmpty: 'Décrivez ce que vous voulez étudier.', vShort: 'Décrivez-le en quelques mots de plus.', vLong: 'Restez sous {n} caractères.',
      runningBanner: 'Recherche en cours : « {t} »', viewProgress: 'Voir l’avancement',
      libTitle: 'Vos recherches', libEmpty: 'Vos recherches enregistrées apparaissent ici. Chaque rapport terminé est enregistré dans votre compte.', libErr: 'Impossible de charger vos recherches.', retry: 'Réessayer',
      cont: 'Reprendre : {t}', open: 'Ouvrir', rename: 'Renommer', del: 'Supprimer', save: 'Enregistrer', cancel: 'Annuler', renamePh: 'Nom du rapport',
      stReady: 'Prêt', stRunning: 'En cours', stFailed: 'Échec — non facturé', sources: '{n} sources lues', sourcesShort: '{n} sources',
      confDelH: 'Supprimer cette recherche ?', confDelP: 'Elle disparaît de votre bibliothèque. Les crédits ne sont pas remboursés.', tDeleted: 'Recherche supprimée.', tRenamed: 'Renommée.', tStillRunning: 'Cette recherche est encore en cours.',
      progTitle: 'Recherche en cours', progLeave: 'Vous pouvez quitter cette page — la recherche continue et sera enregistrée dans votre bibliothèque.',
      stages: { preparing: 'Préparation de la recherche', searching: 'Recherche sur le web', reading: 'Lecture des sources', analysing: 'Analyse des résultats', saving: 'Enregistrement du rapport' },
      pSearches: '{n} recherches ciblées', pResults: '{n} résultats trouvés', pReading: 'lecture de {n} pages', pRead: '{n} pages lues',
      elapsed: '{s} s', failedH: 'La recherche n’a pas abouti', tryAgain: 'Réessayer', backHome: 'Retour à Recherche',
      eCredits: 'Une recherche coûte {n} crédits — vous n’avez pas assez de crédits pour le moment.', ePlans: 'Voir les offres', eRunning: 'Une recherche est déjà en cours.', eGeneric: 'La recherche n’a pas pu démarrer. Rien n’a été facturé — veuillez réessayer.', eNetwork: 'Pas de connexion. Rien n’a été facturé — vérifiez votre connexion et réessayez.', ref: 'Référence : {id}',
      back: 'Recherche', newResearch: 'Nouvelle recherche', created: 'Créée {d}', readN: '{n} sources lues sur {m}', searchesN: '{n} recherches',
      partial: 'L’analyse a été interrompue, certaines sections peuvent être incomplètes.', legacy: 'Créée avec une version précédente de Recherche. Ses preuves n’ont pas été vérifiées dans le texte des sources : « citée » signifie qu’une source a été listée, pas vérifiée.',
      onThisPage: 'Sur cette page', sec: {
        summary: 'Synthèse', overview: 'Vue du marché', trends: 'Tendances du marché', demand: 'Signaux de demande', landscape: 'Paysage concurrentiel', mOpps: 'Opportunités du marché', implications: 'Conséquences pour la publicité',
        compOverview: 'Aperçu des concurrents', comparison: 'Comparaison des concurrents', positioning: 'Positionnement & message', adPatterns: 'Publicités visibles', diff: 'Opportunités de différenciation',
        segments: 'Segments d’audience', needs: 'Besoins & points de douleur', motives: 'Motivations & objections', messaging: 'Opportunités de message',
        keyOpps: 'Opportunités clés', support: 'Éléments de preuve', angles: 'Angles publicitaires', tests: 'Tests suggérés', risks: 'Risques', sources: 'Sources & limites',
        competitors: 'Concurrents', signals: 'Signaux clients', opportunities: 'Opportunités', concepts: 'Concepts créatifs', nextSteps: 'Prochaines étapes',
      },
      keyConclusions: 'Conclusions clés', why: 'Pourquoi c’est important', ideasNote: 'Idées à tester — suggestions argumentées, pas des résultats mesurés.', hypoNote: 'Hypothèses sur qui toucher — vérifiez-les avec vos propres données.',
      f: { website: 'Site web', offering: 'Offre', positioning: 'Positionnement', value: 'Proposition de valeur', pricing: 'Prix publics', messaging: 'Message', ads: 'Publicités observées', diff: 'Où vous démarquer', audience: 'Audience', angle: 'Angle', test: 'Test', limitation: 'Limite', needs: 'Besoins', related: 'Lié à', language: 'Dans leurs mots', measure: 'Comparer', mitigation: 'Comment le gérer', hook: 'Accroche', format: 'Format' },
      sig: { need: 'Besoins', painPoint: 'Points de douleur', motivation: 'Motivations', objection: 'Objections', consideration: 'Critères d’achat' },
      vs: 'vs', notFound: 'Non trouvé dans les sources',
      ev: { source_checked: 'Source vérifiée', source_cited: 'Citée, non vérifiée', analysis: 'Analyse', idea: 'Idée à tester' },
      evTip: { source_checked: 'Le passage cité a été trouvé sur une page que OrivenAI a lue pour cette recherche.', source_cited: 'Une source a été citée, mais l’affirmation n’a pas été vérifiée dans le texte de la page.', analysis: 'Raisonnement fondé sur les informations disponibles — sans source.', idea: 'Une suggestion à tester — pas un résultat mesuré.' },
      showQuote: 'Afficher le passage source', supportedBy: 'Étayé par',
      addCreate: 'Ajouter à Create', added: 'Ajouté', addFull: 'Jusqu’à {n} insights',
      tray: 'Insights sélectionnés {n}/{max}', trayUse: 'Utiliser {n} insights dans Create', trayUse1: 'Utiliser 1 insight dans Create', trayClear: 'Effacer', trayRemove: 'Retirer {t}', trayHint: 'Ils apparaîtront dans Create comme contexte de recherche. Vous pourrez aussi les retirer là-bas.',
      tCreate: '{n} insight(s) de recherche ajouté(s) à Create — vérifiez avant de générer.',
      srcIntro: 'OrivenAI a effectué {s} recherches, trouvé {r} résultats et lu {f} pages. Seuls les passages des pages lues peuvent être vérifiés.',
      srcRead: 'Lue', srcNotRead: 'Non lue', srcResult: 'Résultat de recherche', srcOwn: 'Votre site', srcAttached: 'Ajoutée par vous', srcUsedIn: 'Utilisée dans : {list}', srcNone: 'Aucune source web n’a pu être récupérée — tout ce rapport est de l’analyse.',
      limits: 'Limites', assumptions: 'Hypothèses', refTools: 'Voir les publicités en direct', refNote: 'Bibliothèques publicitaires officielles — OrivenAI ne les interroge pas ; ouvrez-les pour voir les publicités actuelles.', urlErr: 'Impossible de lire {u} : {r}', siteErr: 'Votre site n’a pas pu être lu : {r}',
      noPerf: 'Aucune donnée de performance des publicités concurrentes n’est disponible — rien ici ne dit qu’une publicité est rentable ou performante.',
      confidence: { low: 'Confiance faible', moderate: 'Confiance modérée' },
      rel: { now: 'à l’instant', min: 'il y a {n} min', h: 'il y a {n} h', d: 'il y a {n} j' },
      loading: 'Chargement…', errOpen: 'Impossible d’ouvrir cette recherche.',
    },
    es: {
      title: 'Investigación', subtitle: 'Entiende tu mercado, tu competencia y tus clientes con insights publicitarios respaldados.',
      qLabel: '¿Qué quieres investigar?', qPh: 'p. ej. ¿Cómo se anuncian las marcas premium de zapatillas de running en los Países Bajos?', qCount: '{n}/{max}',
      typeLabel: 'Tipo de investigación',
      types: {
        market: ['Investigación de mercado', 'Tendencias, novedades, panorama competitivo y demanda.', 'Panorama del mercado · tendencias · competencia · oportunidades'],
        competitor: ['Investigación de competidores', 'Cómo se posicionan, fijan precios, comunican y se anuncian.', 'Fichas de competidores · comparación · anuncios · huecos'],
        audience: ['Investigación de audiencia', 'Necesidades, problemas, motivaciones y objeciones.', 'Segmentos · necesidades y problemas · motivaciones · mensajes'],
        opportunity: ['Investigación de oportunidades', 'Huecos y enfoques que probar, con sus motivos.', 'Oportunidades · evidencias · enfoques · pruebas · riesgos'],
      },
      youGet: 'Obtienes: {list}',
      ctxLabel: 'Contexto del negocio', ctxUsed: 'La investigación usa tu perfil de negocio:', ctxNone: 'Aún no hay perfil de negocio — la investigación funciona sin él, pero es más precisa con él.', ctxSetup: 'Configurar tu negocio', ctxEdit: 'Editar',
      ctxWebsite: 'Leer mi web ({site}) como fuente', ctxCountry: 'Mercado: {c}', ctxNoCountry: 'Sin país definido — los resultados son neutrales',
      sitesLabel: 'Webs adicionales para leer (opcional)', sitesAdd: '+ Añadir una web', sitesPh: 'https://ejemplo.es/pagina', sitesAddBtn: 'Añadir', sitesRemove: 'Quitar {u}', sitesMax: 'Hasta {n} webs.', sitesBad: 'Escribe una dirección completa, como https://ejemplo.es.',
      cost: '{n} créditos', costWhat: 'Incluye hasta 3 búsquedas web, la lectura de hasta 5 fuentes y el análisis. Suele tardar un minuto. No se cobra si falla.',
      start: 'Iniciar investigación', starting: 'Iniciando…',
      vEmpty: 'Describe qué quieres investigar.', vShort: 'Descríbelo con algunas palabras más.', vLong: 'No superes los {n} caracteres.',
      runningBanner: 'Investigación en curso: «{t}»', viewProgress: 'Ver progreso',
      libTitle: 'Tus investigaciones', libEmpty: 'Tus investigaciones guardadas aparecen aquí. Cada informe terminado se guarda en tu cuenta.', libErr: 'No se pudieron cargar tus investigaciones.', retry: 'Reintentar',
      cont: 'Continuar: {t}', open: 'Abrir', rename: 'Renombrar', del: 'Eliminar', save: 'Guardar', cancel: 'Cancelar', renamePh: 'Nombre del informe',
      stReady: 'Listo', stRunning: 'En curso', stFailed: 'Fallida — no se cobró', sources: '{n} fuentes leídas', sourcesShort: '{n} fuentes',
      confDelH: '¿Eliminar esta investigación?', confDelP: 'Desaparecerá de tu biblioteca. Los créditos no se devuelven.', tDeleted: 'Investigación eliminada.', tRenamed: 'Renombrada.', tStillRunning: 'Esta investigación sigue en curso.',
      progTitle: 'Investigando', progLeave: 'Puedes salir de esta página: la investigación continúa y se guardará en tu biblioteca.',
      stages: { preparing: 'Preparando la investigación', searching: 'Buscando en la web', reading: 'Leyendo fuentes', analysing: 'Analizando hallazgos', saving: 'Guardando el informe' },
      pSearches: '{n} búsquedas específicas', pResults: '{n} resultados encontrados', pReading: 'leyendo {n} páginas', pRead: '{n} páginas leídas',
      elapsed: '{s} s', failedH: 'La investigación no terminó', tryAgain: 'Reintentar', backHome: 'Volver a Investigación',
      eCredits: 'La investigación cuesta {n} créditos — ahora no tienes suficientes.', ePlans: 'Ver planes', eRunning: 'Ya hay una investigación en curso.', eGeneric: 'No se pudo iniciar la investigación. No se cobró nada — inténtalo de nuevo.', eNetwork: 'Sin conexión. No se cobró nada — revisa tu conexión e inténtalo de nuevo.', ref: 'Referencia: {id}',
      back: 'Investigación', newResearch: 'Nueva investigación', created: 'Creada {d}', readN: '{n} de {m} fuentes leídas', searchesN: '{n} búsquedas',
      partial: 'El análisis se cortó, así que algunas secciones pueden estar incompletas.', legacy: 'Creada con una versión anterior de Investigación. Sus evidencias no se comprobaron con el texto de las fuentes: «citada» significa que se listó una fuente, no que se comprobara.',
      onThisPage: 'En esta página', sec: {
        summary: 'Resumen ejecutivo', overview: 'Panorama del mercado', trends: 'Tendencias del mercado', demand: 'Señales de demanda', landscape: 'Panorama competitivo', mOpps: 'Oportunidades del mercado', implications: 'Implicaciones publicitarias',
        compOverview: 'Resumen de competidores', comparison: 'Comparación de competidores', positioning: 'Posicionamiento y mensajes', adPatterns: 'Patrones publicitarios visibles', diff: 'Oportunidades para diferenciarte',
        segments: 'Segmentos de audiencia', needs: 'Necesidades y problemas', motives: 'Motivaciones y objeciones', messaging: 'Oportunidades de mensaje',
        keyOpps: 'Oportunidades clave', support: 'Evidencias', angles: 'Enfoques publicitarios', tests: 'Pruebas sugeridas', risks: 'Riesgos', sources: 'Fuentes y limitaciones',
        competitors: 'Competidores', signals: 'Señales de clientes', opportunities: 'Oportunidades', concepts: 'Conceptos creativos', nextSteps: 'Próximos pasos',
      },
      keyConclusions: 'Conclusiones clave', why: 'Por qué importa', ideasNote: 'Ideas para probar — sugerencias razonadas, no resultados medidos.', hypoNote: 'Hipótesis sobre a quién llegar — compruébalas con tus propios datos.',
      f: { website: 'Web', offering: 'Oferta', positioning: 'Posicionamiento', value: 'Propuesta de valor', pricing: 'Precios públicos', messaging: 'Mensaje', ads: 'Publicidad observada', diff: 'Dónde puedes diferenciarte', audience: 'Audiencia', angle: 'Enfoque', test: 'Prueba', limitation: 'Limitación', needs: 'Necesidades', related: 'Relacionado', language: 'En sus palabras', measure: 'Comparar', mitigation: 'Cómo gestionarlo', hook: 'Gancho', format: 'Formato' },
      sig: { need: 'Necesidades', painPoint: 'Problemas', motivation: 'Motivaciones', objection: 'Objeciones', consideration: 'Criterios de compra' },
      vs: 'vs', notFound: 'No encontrado en las fuentes',
      ev: { source_checked: 'Fuente comprobada', source_cited: 'Citada, no comprobada', analysis: 'Análisis', idea: 'Idea para probar' },
      evTip: { source_checked: 'El pasaje citado se encontró en una página que OrivenAI leyó para esta investigación.', source_cited: 'Se citó una fuente, pero la afirmación no se comprobó con el texto de la página.', analysis: 'Razonamiento basado en la información disponible — sin fuente.', idea: 'Una sugerencia para probar — no un resultado medido.' },
      showQuote: 'Mostrar el pasaje de la fuente', supportedBy: 'Respaldado por',
      addCreate: 'Añadir a Create', added: 'Añadido', addFull: 'Hasta {n} insights',
      tray: 'Insights seleccionados {n}/{max}', trayUse: 'Usar {n} insights en Create', trayUse1: 'Usar 1 insight en Create', trayClear: 'Borrar', trayRemove: 'Quitar {t}', trayHint: 'Aparecerán en Create como contexto de investigación. También puedes quitarlos allí.',
      tCreate: '{n} insight(s) de investigación añadido(s) a Create — revísalos antes de crear.',
      srcIntro: 'OrivenAI hizo {s} búsquedas, encontró {r} resultados y leyó {f} páginas. Solo los pasajes de páginas leídas pueden comprobarse.',
      srcRead: 'Leída', srcNotRead: 'No leída', srcResult: 'Resultado de búsqueda', srcOwn: 'Tu web', srcAttached: 'Añadida por ti', srcUsedIn: 'Usada en: {list}', srcNone: 'No se pudieron obtener fuentes web — todo este informe es análisis.',
      limits: 'Limitaciones', assumptions: 'Supuestos', refTools: 'Ver anuncios en vivo tú mismo', refNote: 'Bibliotecas de anuncios oficiales — OrivenAI no las consulta; ábrelas para ver los anuncios actuales.', urlErr: 'No se pudo leer {u}: {r}', siteErr: 'No se pudo leer tu web: {r}',
      noPerf: 'No hay datos de rendimiento de los anuncios de la competencia — nada aquí dice que un anuncio sea rentable o funcione bien.',
      confidence: { low: 'Confianza baja', moderate: 'Confianza moderada' },
      rel: { now: 'ahora mismo', min: 'hace {n} min', h: 'hace {n} h', d: 'hace {n} d' },
      loading: 'Cargando…', errOpen: 'No se pudo abrir esta investigación.',
    },
    pt: {
      title: 'Pesquisa', subtitle: 'Entenda seu mercado, concorrentes e clientes com insights de publicidade fundamentados.',
      qLabel: 'O que você quer pesquisar?', qPh: 'ex. Como as marcas premium de tênis de corrida anunciam na Holanda?', qCount: '{n}/{max}',
      typeLabel: 'Tipo de pesquisa',
      types: {
        market: ['Pesquisa de mercado', 'Tendências, novidades, cenário competitivo e demanda.', 'Visão do mercado · tendências · cenário · oportunidades'],
        competitor: ['Pesquisa de concorrentes', 'Como os concorrentes se posicionam, cobram, comunicam e anunciam.', 'Fichas de concorrentes · comparação · anúncios · lacunas'],
        audience: ['Pesquisa de público', 'Necessidades, dores, motivações e objeções.', 'Segmentos · necessidades e dores · motivações · mensagens'],
        opportunity: ['Pesquisa de oportunidades', 'Lacunas e ângulos para testar, com os motivos.', 'Oportunidades · evidências · ângulos · testes · riscos'],
      },
      youGet: 'Você recebe: {list}',
      ctxLabel: 'Contexto do negócio', ctxUsed: 'A pesquisa usa o perfil do seu negócio:', ctxNone: 'Ainda não há perfil do negócio — a pesquisa funciona sem ele, mas fica mais específica com ele.', ctxSetup: 'Configurar seu negócio', ctxEdit: 'Editar',
      ctxWebsite: 'Ler meu site ({site}) como fonte', ctxCountry: 'Mercado: {c}', ctxNoCountry: 'Nenhum país definido — os resultados ficam neutros',
      sitesLabel: 'Sites extras para ler (opcional)', sitesAdd: '+ Adicionar um site', sitesPh: 'https://exemplo.com.br/pagina', sitesAddBtn: 'Adicionar', sitesRemove: 'Remover {u}', sitesMax: 'Até {n} sites.', sitesBad: 'Digite um endereço completo, como https://exemplo.com.br.',
      cost: '{n} créditos', costWhat: 'Inclui até 3 buscas na web, a leitura de até 5 fontes e a análise. Leva cerca de um minuto. Não é cobrado se falhar.',
      start: 'Iniciar pesquisa', starting: 'Iniciando…',
      vEmpty: 'Descreva o que você quer pesquisar.', vShort: 'Descreva com mais algumas palavras.', vLong: 'Use menos de {n} caracteres.',
      runningBanner: 'Pesquisa em andamento: “{t}”', viewProgress: 'Ver progresso',
      libTitle: 'Suas pesquisas', libEmpty: 'Suas pesquisas salvas aparecem aqui. Cada relatório concluído fica salvo na sua conta.', libErr: 'Não foi possível carregar suas pesquisas.', retry: 'Tentar de novo',
      cont: 'Continuar: {t}', open: 'Abrir', rename: 'Renomear', del: 'Excluir', save: 'Salvar', cancel: 'Cancelar', renamePh: 'Nome do relatório',
      stReady: 'Pronto', stRunning: 'Em andamento', stFailed: 'Falhou — não cobrado', sources: '{n} fontes lidas', sourcesShort: '{n} fontes',
      confDelH: 'Excluir esta pesquisa?', confDelP: 'Ela some da sua biblioteca. Os créditos não são devolvidos.', tDeleted: 'Pesquisa excluída.', tRenamed: 'Renomeada.', tStillRunning: 'Esta pesquisa ainda está em andamento.',
      progTitle: 'Pesquisando', progLeave: 'Você pode sair desta página — a pesquisa continua e será salva na sua biblioteca.',
      stages: { preparing: 'Preparando a pesquisa', searching: 'Buscando na web', reading: 'Lendo fontes', analysing: 'Analisando resultados', saving: 'Salvando o relatório' },
      pSearches: '{n} buscas direcionadas', pResults: '{n} resultados encontrados', pReading: 'lendo {n} páginas', pRead: '{n} páginas lidas',
      elapsed: '{s} s', failedH: 'A pesquisa não terminou', tryAgain: 'Tentar de novo', backHome: 'Voltar para Pesquisa',
      eCredits: 'A pesquisa custa {n} créditos — você não tem créditos suficientes agora.', ePlans: 'Ver planos', eRunning: 'Já há uma pesquisa em andamento.', eGeneric: 'Não foi possível iniciar a pesquisa. Nada foi cobrado — tente de novo.', eNetwork: 'Sem conexão. Nada foi cobrado — verifique sua conexão e tente de novo.', ref: 'Referência: {id}',
      back: 'Pesquisa', newResearch: 'Nova pesquisa', created: 'Criada {d}', readN: '{n} de {m} fontes lidas', searchesN: '{n} buscas',
      partial: 'A análise foi interrompida, então algumas seções podem estar incompletas.', legacy: 'Criada com uma versão anterior da Pesquisa. As evidências não foram conferidas no texto das fontes: “citada” significa que uma fonte foi listada, não conferida.',
      onThisPage: 'Nesta página', sec: {
        summary: 'Resumo executivo', overview: 'Visão do mercado', trends: 'Tendências do mercado', demand: 'Sinais de demanda', landscape: 'Cenário competitivo', mOpps: 'Oportunidades de mercado', implications: 'Implicações para a publicidade',
        compOverview: 'Visão dos concorrentes', comparison: 'Comparação de concorrentes', positioning: 'Posicionamento e mensagens', adPatterns: 'Padrões de anúncios visíveis', diff: 'Oportunidades de diferenciação',
        segments: 'Segmentos de público', needs: 'Necessidades e dores', motives: 'Motivações e objeções', messaging: 'Oportunidades de mensagem',
        keyOpps: 'Principais oportunidades', support: 'Evidências', angles: 'Ângulos de anúncio', tests: 'Testes sugeridos', risks: 'Riscos', sources: 'Fontes e limitações',
        competitors: 'Concorrentes', signals: 'Sinais de clientes', opportunities: 'Oportunidades', concepts: 'Conceitos criativos', nextSteps: 'Próximos passos',
      },
      keyConclusions: 'Principais conclusões', why: 'Por que importa', ideasNote: 'Ideias para testar — sugestões fundamentadas, não resultados medidos.', hypoNote: 'Hipóteses sobre quem alcançar — confira com seus próprios dados.',
      f: { website: 'Site', offering: 'Oferta', positioning: 'Posicionamento', value: 'Proposta de valor', pricing: 'Preços públicos', messaging: 'Mensagem', ads: 'Anúncios observados', diff: 'Onde você pode se destacar', audience: 'Público', angle: 'Ângulo', test: 'Teste', limitation: 'Limitação', needs: 'Necessidades', related: 'Relacionado', language: 'Nas palavras deles', measure: 'Comparar', mitigation: 'Como lidar', hook: 'Gancho', format: 'Formato' },
      sig: { need: 'Necessidades', painPoint: 'Dores', motivation: 'Motivações', objection: 'Objeções', consideration: 'Critérios de compra' },
      vs: 'vs', notFound: 'Não encontrado nas fontes',
      ev: { source_checked: 'Fonte conferida', source_cited: 'Citada, não conferida', analysis: 'Análise', idea: 'Ideia para testar' },
      evTip: { source_checked: 'O trecho citado foi encontrado em uma página que a OrivenAI leu para esta pesquisa.', source_cited: 'Uma fonte foi citada, mas a afirmação não foi conferida no texto da página.', analysis: 'Raciocínio com base nas informações disponíveis — sem fonte.', idea: 'Uma sugestão para testar — não um resultado medido.' },
      showQuote: 'Mostrar trecho da fonte', supportedBy: 'Apoiado por',
      addCreate: 'Adicionar ao Create', added: 'Adicionado', addFull: 'Até {n} insights',
      tray: 'Insights selecionados {n}/{max}', trayUse: 'Usar {n} insights no Create', trayUse1: 'Usar 1 insight no Create', trayClear: 'Limpar', trayRemove: 'Remover {t}', trayHint: 'Eles aparecem no Create como contexto de pesquisa. Você também pode removê-los lá.',
      tCreate: '{n} insight(s) de pesquisa adicionado(s) ao Create — revise antes de criar.',
      srcIntro: 'A OrivenAI fez {s} buscas, encontrou {r} resultados e leu {f} páginas. Só trechos de páginas lidas podem ser conferidos.',
      srcRead: 'Lida', srcNotRead: 'Não lida', srcResult: 'Resultado de busca', srcOwn: 'Seu site', srcAttached: 'Adicionada por você', srcUsedIn: 'Usada em: {list}', srcNone: 'Não foi possível obter fontes da web — tudo neste relatório é análise.',
      limits: 'Limitações', assumptions: 'Suposições', refTools: 'Veja anúncios ao vivo', refNote: 'Bibliotecas oficiais de anúncios — a OrivenAI não as consulta; abra-as para ver os anúncios atuais.', urlErr: 'Não foi possível ler {u}: {r}', siteErr: 'Não foi possível ler seu site: {r}',
      noPerf: 'Não há dados de desempenho dos anúncios da concorrência — nada aqui diz que um anúncio é lucrativo ou tem bom desempenho.',
      confidence: { low: 'Confiança baixa', moderate: 'Confiança moderada' },
      rel: { now: 'agora mesmo', min: 'há {n} min', h: 'há {n} h', d: 'há {n} d' },
      loading: 'Carregando…', errOpen: 'Não foi possível abrir esta pesquisa.',
    },
  };

  // ── Helpers ───────────────────────────────────────────────────────
  function lang() { var l = (typeof CURRENT_LANG !== 'undefined' && CURRENT_LANG) || 'en'; return STR[l] ? l : 'en'; }
  function pick(p) { var g = function (o) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }; var v = g(STR[lang()]); return v == null ? g(STR.en) : v; }
  function T(k, vars) { var s = pick(k); if (s == null) s = k; if (typeof s !== 'string') return s; if (vars) Object.keys(vars).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); }); return s; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function $(id) { return document.getElementById(id); }
  function api(path, opts) { return typeof window.apiFetch === 'function' ? window.apiFetch(path, opts || {}).catch(function () { return { ok: false, status: 0, data: null }; }) : Promise.resolve({ ok: false, status: 0, data: null }); }
  function toast(m, k) { if (typeof window.orvToast === 'function') window.orvToast(m, k || 'ok'); }
  function rel(iso) {
    if (!iso) return ''; var d = (Date.now() - new Date(iso).getTime()) / 60000;
    if (d < 1) return T('rel.now'); if (d < 60) return T('rel.min', { n: Math.round(d) }); if (d < 2880) return T('rel.h', { n: Math.round(d / 60) });
    try { return new Intl.DateTimeFormat(lang(), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)); } catch (_) { return T('rel.d', { n: Math.round(d / 1440) }); }
  }
  function dateLong(iso) { try { return new Intl.DateTimeFormat(lang(), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch (_) { return iso || ''; } }
  function user() { var u = (typeof window._getCurrentUser === 'function') ? window._getCurrentUser() : null; return u && u.id ? u : null; }
  function lsKey(k) { var u = user(); return u ? 'orv_research_' + k + '_' + u.id : null; }
  function lsGet(k, fb) { var key = lsKey(k); if (!key) return fb; try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch (_) { return fb; } }
  function lsSet(k, v) { var key = lsKey(k); if (!key) return; try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch (_) {} }
  // Links only ever point to http(s) pages (source URLs come from the web).
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : null; }
  function link(u, label, cls) { var h = safeUrl(u); return h ? '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(h) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>' : '<span' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(label) + '</span>'; }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return String(u || ''); } }
  function newKey() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('k' + Date.now() + Math.random().toString(36).slice(2)); }
  function cost() { return (typeof CREDIT_COSTS !== 'undefined' && CREDIT_COSTS.research) || 25; }

  // ── State ─────────────────────────────────────────────────────────
  var S = {
    view: 'home', reports: null, listErr: false, biz: undefined, question: '', type: 'market', urls: [], urlOpen: false, urlErr: null,
    includeWebsite: true, starting: false, formErr: null, job: null, report: null, reportErr: null, renaming: null, picks: {},
  };
  var pollTimer = null;

  // ── Library + business context ────────────────────────────────────
  function loadLibrary() {
    return api('/api/research/reports').then(function (r) {
      if (r.ok) { S.reports = (r.data && r.data.reports) || []; S.listErr = false; } else { S.listErr = true; if (!S.reports) S.reports = []; }
      if (S.view === 'home') render();
    });
  }
  function loadBiz() {
    if (S.biz !== undefined) return Promise.resolve();
    return api('/api/business/profile').then(function (r) {
      var p = r.ok && r.data ? r.data.profile : null;
      S.biz = p && (p.company_name || p.industry || p.website) ? { name: p.company_name || '', industry: p.industry || '', country: p.country || '', website: p.website || '' } : null;
      if (S.view === 'home') render();
    });
  }

  // ── Rendering ─────────────────────────────────────────────────────
  function render() {
    var root = $('rsRoot'); if (!root) return;
    var y = (document.scrollingElement || document.documentElement).scrollTop;
    var focusId = document.activeElement && document.activeElement.id;
    root.setAttribute('data-view', S.view);
    root.innerHTML = S.view === 'progress' ? progressView() : S.view === 'report' ? reportView() : homeView();
    if (focusId && $(focusId) && S.view === 'home') { var el = $(focusId); try { el.focus(); if (el.setSelectionRange && el.value != null) el.setSelectionRange(el.value.length, el.value.length); } catch (_) {} }
    if (S.view === 'home') (document.scrollingElement || document.documentElement).scrollTop = y;
  }

  function typeCards() {
    return '<div class="rx-types" role="radiogroup" aria-label="' + esc(T('typeLabel')) + '">' + TYPES.map(function (t) {
      var d = pick('types.' + t), on = S.type === t;
      return '<label class="rx-type' + (on ? ' is-on' : '') + '"><input type="radio" name="rxType" value="' + t + '"' + (on ? ' checked' : '') + ' data-rx="type">' +
        '<span class="rx-type-t">' + esc(d[0]) + '</span><span class="rx-type-d">' + esc(d[1]) + '</span></label>';
    }).join('') + '</div><p class="rx-hint rx-youget">' + esc(T('youGet', { list: pick('types.' + S.type)[2] })) + '</p>';
  }
  function bizBlock() {
    var b = S.biz;
    if (b === undefined) return '<p class="rx-muted">' + esc(T('loading')) + '</p>';
    if (!b) return '<p class="rx-muted">' + esc(T('ctxNone')) + '</p><button type="button" class="rx-link" data-rx="biz-setup">' + esc(T('ctxSetup')) + '</button>';
    var chips = [b.name, b.industry].filter(Boolean).map(function (x) { return '<span class="rx-chip">' + esc(x) + '</span>'; }).join('');
    return '<p class="rx-ctx-line">' + esc(T('ctxUsed')) + ' ' + chips + ' <button type="button" class="rx-link" data-rx="biz-edit">' + esc(T('ctxEdit')) + '</button></p>' +
      '<p class="rx-hint">' + esc(b.country ? T('ctxCountry', { c: b.country }) : T('ctxNoCountry')) + '</p>' +
      (b.website ? '<label class="rx-check"><input type="checkbox" data-rx="include-website"' + (S.includeWebsite ? ' checked' : '') + '> <span>' + esc(T('ctxWebsite', { site: host(/^https?:/i.test(b.website) ? b.website : 'https://' + b.website) })) + '</span></label>' : '');
  }
  function sitesBlock() {
    var chips = S.urls.map(function (u, i) { return '<span class="rx-chip rx-chip-x">' + esc(host(u)) + '<button type="button" data-rx="url-remove" data-i="' + i + '" aria-label="' + esc(T('sitesRemove', { u: host(u) })) + '">×</button></span>'; }).join('');
    var add = S.urls.length >= URL_MAX ? '<p class="rx-hint">' + esc(T('sitesMax', { n: URL_MAX })) + '</p>'
      : S.urlOpen ? '<div class="rx-url-row"><input type="url" id="rxUrlInput" class="rx-input" placeholder="' + esc(T('sitesPh')) + '" maxlength="2000" aria-label="' + esc(T('sitesLabel')) + '"><button type="button" class="rx-btn rx-btn-ghost" data-rx="url-add">' + esc(T('sitesAddBtn')) + '</button></div>'
        : '<button type="button" class="rx-link" data-rx="url-open">' + esc(T('sitesAdd')) + '</button>';
    return '<div class="rx-sites"><span class="rx-lbl">' + esc(T('sitesLabel')) + '</span>' + (chips ? '<div class="rx-chips">' + chips + '</div>' : '') + add + (S.urlErr ? '<p class="rx-err" role="alert">' + esc(S.urlErr) + '</p>' : '') + '</div>';
  }
  function libraryBlock() {
    var list = S.reports;
    var html = '<section class="rx-lib" aria-labelledby="rxLibH"><h2 class="rx-h2" id="rxLibH">' + esc(T('libTitle')) + '</h2>';
    if (list === null) return html + '<p class="rx-muted">' + esc(T('loading')) + '</p></section>';
    if (S.listErr && !list.length) return html + '<p class="rx-muted">' + esc(T('libErr')) + ' <button type="button" class="rx-link" data-rx="lib-retry">' + esc(T('retry')) + '</button></p></section>';
    if (!list.length) return html + '<p class="rx-muted">' + esc(T('libEmpty')) + '</p></section>';
    var lastId = lsGet('last', null), last = list.filter(function (r) { return r.id === lastId && r.status === 'ready'; })[0];
    if (last) html += '<button type="button" class="rx-continue" data-rx="open" data-id="' + esc(last.id) + '">' + esc(T('cont', { t: last.title })) + ' →</button>';
    html += '<ul class="rx-lib-list">' + list.map(function (r) {
      var tl = r.type && pick('types.' + r.type) ? pick('types.' + r.type)[0] : null;
      var st = r.status === 'running' ? '<span class="rx-st is-run">' + esc(T('stRunning')) + '</span>' : r.status === 'failed' ? '<span class="rx-st is-fail">' + esc(T('stFailed')) + '</span>' : '';
      var meta = [tl, rel(r.createdAt), r.status === 'ready' && r.sourceCount ? T('sourcesShort', { n: r.sourceCount }) : null].filter(Boolean).join(' · ');
      if (S.renaming === r.id) return '<li class="rx-lib-item is-edit"><input type="text" id="rxRename" class="rx-input" maxlength="120" value="' + esc(r.title) + '" aria-label="' + esc(T('renamePh')) + '"><div class="rx-row"><button type="button" class="rx-btn rx-btn-primary" data-rx="rename-save" data-id="' + esc(r.id) + '">' + esc(T('save')) + '</button><button type="button" class="rx-btn rx-btn-ghost" data-rx="rename-cancel">' + esc(T('cancel')) + '</button></div></li>';
      return '<li class="rx-lib-item"><button type="button" class="rx-lib-main" data-rx="' + (r.status === 'running' ? 'progress' : r.status === 'ready' ? 'open' : 'noop') + '" data-id="' + esc(r.id) + '"' + (r.status === 'failed' ? ' disabled' : '') + '><span class="rx-lib-t">' + esc(r.title) + '</span><span class="rx-lib-m">' + esc(meta) + (st ? ' ' : '') + '</span>' + st + (r.status === 'failed' && r.error ? '<span class="rx-lib-e">' + esc(r.error) + '</span>' : '') + '</button>' +
        (r.status === 'running' ? '' : '<span class="rx-lib-acts">' + (r.status === 'failed' ? '' : '<button type="button" class="rx-link" data-rx="rename" data-id="' + esc(r.id) + '">' + esc(T('rename')) + '</button>') + '<button type="button" class="rx-link rx-danger" data-rx="delete" data-id="' + esc(r.id) + '">' + esc(T('del')) + '</button></span>') + '</li>';
    }).join('') + '</ul></section>';
    return html;
  }
  function homeView() {
    var running = (S.reports || []).filter(function (r) { return r.status === 'running'; })[0];
    var n = S.question.length;
    return '<header class="rx-head"><h1 class="rx-title">' + esc(T('title')) + '</h1><p class="rx-sub">' + esc(T('subtitle')) + '</p></header>' +
      (running ? '<div class="rx-banner" role="status"><span class="rx-pulse" aria-hidden="true"></span><span>' + esc(T('runningBanner', { t: running.title })) + '</span><button type="button" class="rx-btn rx-btn-ghost" data-rx="progress" data-id="' + esc(running.id) + '">' + esc(T('viewProgress')) + '</button></div>' : '') +
      '<div class="rx-home"><form class="rx-card rx-form" data-rx-form="1" novalidate>' +
        '<label class="rx-lbl" for="researchQueryInput">' + esc(T('qLabel')) + '</label>' +
        '<textarea id="researchQueryInput" class="rx-input rx-q" rows="3" maxlength="' + Q_MAX + '" placeholder="' + esc(T('qPh')) + '" aria-describedby="rxQCount' + (S.formErr ? ' rxFormErr' : '') + '">' + esc(S.question) + '</textarea>' +
        '<div class="rx-row rx-row-between"><span class="rx-hint" id="rxQCount" aria-live="polite">' + esc(T('qCount', { n: n, max: Q_MAX })) + '</span></div>' +
        '<fieldset class="rx-fs"><legend class="rx-lbl">' + esc(T('typeLabel')) + '</legend>' + typeCards() + '</fieldset>' +
        '<div class="rx-ctx"><span class="rx-lbl">' + esc(T('ctxLabel')) + '</span>' + bizBlock() + sitesBlock() + '</div>' +
        (S.formErr ? '<p class="rx-err" id="rxFormErr" role="alert">' + S.formErr + '</p>' : '') +
        '<div class="rx-start"><div class="rx-cost"><b>' + esc(T('cost', { n: cost() })) + '</b><span>' + esc(T('costWhat')) + '</span></div>' +
          '<button type="submit" class="rx-btn rx-btn-primary rx-btn-lg" id="researchSubmitBtn"' + (S.starting || running ? ' disabled' : '') + '>' + esc(S.starting ? T('starting') : T('start')) + '</button></div>' +
      '</form>' + libraryBlock() + '</div>';
  }

  function progressView() {
    var j = S.job || {}, st = j.status === 'failed' ? 'failed' : j.stage || 'preparing';
    var order = ['preparing', 'searching', 'reading', 'analysing', 'saving'];
    var idx = order.indexOf(st), p = j.progress || {};
    var tl = j.type && pick('types.' + j.type) ? pick('types.' + j.type)[0] : '';
    if (j.status === 'failed') {
      return '<div class="rx-card rx-progress" role="alert"><h1 class="rx-title rx-title-sm">' + esc(T('failedH')) + '</h1>' +
        (j.title ? '<p class="rx-muted">“' + esc(j.title) + '”</p>' : '') + '<p>' + esc(j.error || T('eGeneric')) + '</p>' +
        '<div class="rx-row"><button type="button" class="rx-btn rx-btn-primary" data-rx="retry-job">' + esc(T('tryAgain')) + '</button><button type="button" class="rx-btn rx-btn-ghost" data-rx="home">' + esc(T('backHome')) + '</button></div></div>';
    }
    var detail = function (k) {
      if (k === 'searching' && p.searches) return T('pSearches', { n: p.searches });
      if (k === 'reading' && p.results != null) return T('pResults', { n: p.results }) + (p.reading ? ' · ' + T('pReading', { n: p.reading }) : '');
      if (k === 'analysing' && p.read != null) return T('pRead', { n: p.read });
      return '';
    };
    var secs = j.startedAt ? Math.max(0, Math.round((Date.now() - new Date(j.startedAt).getTime()) / 1000)) : null;
    return '<div class="rx-card rx-progress" aria-busy="true"><p class="rx-eyebrow">' + esc(tl) + '</p><h1 class="rx-title rx-title-sm">' + esc(T('progTitle')) + '</h1>' +
      (j.title ? '<p class="rx-q-recap">“' + esc(j.title) + '”</p>' : '') +
      '<ol class="rx-steps">' + order.map(function (k, i) {
        var cls = i < idx ? 'is-done' : i === idx ? 'is-on' : '';
        var d = i <= idx ? detail(k) : '';
        return '<li class="rx-step ' + cls + '"' + (i === idx ? ' aria-current="step"' : '') + '><span class="rx-step-dot" aria-hidden="true"></span><span class="rx-step-t">' + esc(T('stages.' + k)) + '</span>' + (d ? '<span class="rx-step-d">' + esc(d) + '</span>' : '') + '</li>';
      }).join('') + '</ol>' +
      '<p class="rx-hint">' + esc(T('progLeave')) + (secs != null ? ' <span class="rx-elapsed">' + esc(T('elapsed', { s: secs })) + '</span>' : '') + '</p>' +
      '<div class="rx-row"><button type="button" class="rx-btn rx-btn-ghost" data-rx="home">' + esc(T('backHome')) + '</button></div></div>';
  }

  // ── Report ────────────────────────────────────────────────────────
  var srcById = {}, pickables = {};
  function evLine(it) {
    if (!it || !it.basis) return '';
    var b = it.basis, ids = it.sourceIds || [], q = (it.quotes || [])[0];
    var domains = ids.map(function (id) { var s = srcById[id]; return s ? link(s.url, s.domain || host(s.url)) : ''; }).filter(Boolean).slice(0, 3).join(', ');
    var lbl = '<span class="rx-ev rx-ev-' + b + '" title="' + esc(T('evTip.' + b)) + '">' + (b === 'source_checked' ? '<i aria-hidden="true">✓</i>' : '') + esc(T('ev.' + b)) + '</span>';
    var quote = b === 'source_checked' && q ? '<details class="rx-quote"><summary>' + esc(T('showQuote')) + '</summary><blockquote>“' + esc(q.quote) + '”' + (srcById[q.sourceId] ? '<cite>' + link(srcById[q.sourceId].url, srcById[q.sourceId].title || srcById[q.sourceId].domain) + '</cite>' : '') + '</blockquote></details>' : '';
    return '<div class="rx-evline">' + lbl + (domains ? '<span class="rx-ev-src">' + domains + '</span>' : '') + quote + '</div>';
  }
  function addBtn(id, group, text, item) {
    if (!S.report) return '';
    var fid = group + ':' + id;
    pickables[fid] = { id: fid, group: group, text: String(text || '').slice(0, 280), basis: item && item.basis || null,
      sources: ((item && item.sourceIds) || []).map(function (s) { var x = srcById[s]; return x ? { title: x.title || null, url: x.url, domain: x.domain || host(x.url) } : null; }).filter(Boolean).slice(0, 3) };
    var on = !!S.picks[fid], full = !on && Object.keys(S.picks).length >= MAX_PICKS;
    return '<button type="button" class="rx-add' + (on ? ' is-on' : '') + '" data-rx="pick" data-fid="' + esc(fid) + '" aria-pressed="' + on + '"' + (full ? ' disabled title="' + esc(T('addFull', { n: MAX_PICKS })) + '"' : '') + '>' + esc(on ? T('added') : T('addCreate')) + '</button>';
  }
  function field(label, v) { return v ? '<div class="rx-f"><dt>' + esc(label) + '</dt><dd>' + esc(v) + '</dd></div>' : ''; }
  function card(inner, cls) { return '<article class="rx-icard' + (cls ? ' ' + cls : '') + '">' + inner + '</article>'; }
  function sec(key, title, body, note) { return body ? '<section class="rx-sec" id="rxs-' + key + '" aria-labelledby="rxsh-' + key + '"><h2 class="rx-h2" id="rxsh-' + key + '">' + esc(title) + '</h2>' + (note ? '<p class="rx-note">' + esc(note) + '</p>' : '') + body + '</section>' : ''; }
  var nameOf = function (list, id) { var x = (list || []).filter(function (c) { return c.id === id; })[0]; return x ? (x.name || x.text) : null; };

  function competitorCard(c, full) {
    var head = '<div class="rx-icard-h"><h3>' + esc(c.name) + '</h3>' + (c.website ? link(c.website, host(c.website), 'rx-site') : '') + '</div>';
    var dl = full ? '<dl class="rx-dl">' + field(T('f.offering'), c.offering) + field(T('f.positioning'), c.positioning) + field(T('f.value'), c.valueProposition) + field(T('f.pricing'), c.pricing) + field(T('f.messaging'), c.messaging) +
      (c.adPatterns && c.adPatterns.length ? field(T('f.ads'), c.adPatterns.join(' · ')) : '') + field(T('f.diff'), c.differentiation) + '</dl>'
      : '<p>' + esc(c.positioning || c.offering || '') + '</p>';
    return card(head + dl + '<div class="rx-icard-f">' + evLine(c) + addBtn(c.id, 'Competitor', c.name + (c.positioning ? ' — ' + c.positioning : '') + (c.differentiation ? ' (gap: ' + c.differentiation + ')' : ''), c) + '</div>');
  }
  function comparisonTable(list) {
    if (!list || list.length < 2) return '';
    var rows = list.map(function (c) { var cell = function (v) { return '<td>' + (v ? esc(v) : '<span class="rx-muted">—</span>') + '</td>'; }; return '<tr><th scope="row">' + esc(c.name) + '</th>' + cell(c.positioning) + cell(c.valueProposition) + cell(c.pricing) + cell(c.messaging) + '</tr>'; }).join('');
    return '<div class="rx-table-wrap" tabindex="0"><table class="rx-table"><thead><tr><th scope="col"><span class="rx-sr">' + esc(T('sec.competitors')) + '</span></th><th scope="col">' + esc(T('f.positioning')) + '</th><th scope="col">' + esc(T('f.value')) + '</th><th scope="col">' + esc(T('f.pricing')) + '</th><th scope="col">' + esc(T('f.messaging')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function oppCard(o, r) {
    var related = (o.relatedCompetitorIds || []).map(function (id) { return nameOf(r.competitors, id); }).concat((o.relatedSignalIds || []).map(function (id) { return nameOf(r.signals, id); })).filter(Boolean);
    var support = o.supportBasis && o.supportBasis !== 'analysis' ? '<div class="rx-support"><span class="rx-lbl-sm">' + esc(T('supportedBy')) + '</span>' + evLine({ basis: o.supportBasis, sourceIds: o.sourceIds, quotes: o.quotes }) + '</div>' : '';
    return card('<div class="rx-icard-h"><h3>' + esc(o.title) + '</h3></div>' + (o.why ? '<p>' + esc(o.why) + '</p>' : '') +
      '<dl class="rx-dl">' + field(T('f.audience'), o.audience) + field(T('f.angle'), o.angle) + field(T('f.test'), o.test) + field(T('f.limitation'), o.limitation) + (related.length ? field(T('f.related'), related.join(' · ')) : '') + '</dl>' + support +
      '<div class="rx-icard-f">' + addBtn(o.id, 'Opportunity', o.title + (o.why ? ' — ' + o.why : '') + (o.angle ? ' Angle: ' + o.angle : ''), o) + '</div>', 'rx-icard-opp');
  }
  function listItems(items, textFn, group, pickTextFn) {
    if (!items || !items.length) return '';
    return '<ul class="rx-items">' + items.map(function (x) { return '<li class="rx-item"><div class="rx-item-b">' + textFn(x) + evLine(x) + '</div>' + (group ? addBtn(x.id, group, pickTextFn ? pickTextFn(x) : (x.text || x.trend || x.pattern || ''), x) : '') + '</li>'; }).join('') + '</ul>';
  }
  function signalsBy(list, types) {
    var groups = types.map(function (t) { var it = (list || []).filter(function (s) { return s.type === t; }); return it.length ? '<h3 class="rx-h3">' + esc(T('sig.' + t)) + '</h3>' + listItems(it, function (s) { return '<p>' + esc(s.text) + '</p>' + (s.language ? '<p class="rx-muted">' + esc(T('f.language')) + ': “' + esc(s.language) + '”</p>' : ''); }, 'Customer signal', function (s) { return T('sig.' + s.type) + ': ' + s.text; }) : ''; }).join('');
    return groups;
  }
  function segmentCards(list) { return list && list.length ? '<div class="rx-grid">' + list.map(function (a) { return card('<div class="rx-icard-h"><h3>' + esc(a.name) + '</h3></div>' + (a.description ? '<p>' + esc(a.description) + '</p>' : '') + '<dl class="rx-dl">' + field(T('f.needs'), a.needs) + field(T('why'), a.why) + '</dl><div class="rx-icard-f">' + addBtn(a.id, 'Audience', a.name + (a.why ? ' — ' + a.why : ''), a) + '</div>'); }).join('') + '</div>' : ''; }
  function angleCards(list) { return list && list.length ? '<div class="rx-grid">' + list.map(function (g) { return card('<div class="rx-icard-h"><h3>' + esc(g.angle) + '</h3></div>' + (g.message ? '<p class="rx-msg">“' + esc(g.message) + '”</p>' : '') + (g.why ? '<p class="rx-muted">' + esc(g.why) + '</p>' : '') + '<div class="rx-icard-f">' + addBtn(g.id, 'Angle', g.angle + (g.message ? ' — ' + g.message : ''), g) + '</div>'); }).join('') + '</div>' : ''; }
  function testCards(list) { return list && list.length ? '<div class="rx-grid">' + list.map(function (x) { return card('<div class="rx-icard-h"><h3>' + esc(x.hypothesis) + '</h3></div>' + (x.variantA || x.variantB ? '<p class="rx-ab"><span>A · ' + esc(x.variantA || '—') + '</span><span class="rx-vs">' + esc(T('vs')) + '</span><span>B · ' + esc(x.variantB || '—') + '</span></p>' : '') + (x.measure ? '<p class="rx-muted">' + esc(T('f.measure')) + ': ' + esc(x.measure) + '</p>' : '') + '<div class="rx-icard-f">' + addBtn(x.id, 'Test', x.hypothesis + (x.variantA ? ' — A: ' + x.variantA + ' vs B: ' + (x.variantB || '') : ''), x) + '</div>'); }).join('') + '</div>' : ''; }
  function riskList(list) { return listItems(list, function (x) { return '<p><b>' + esc(x.risk) + '</b></p>' + (x.mitigation ? '<p class="rx-muted">' + esc(T('f.mitigation')) + ': ' + esc(x.mitigation) + '</p>' : ''); }, null); }

  function summarySection(r) {
    var kc = r.keyConclusions || [];
    var body = (r.summary ? '<p class="rx-lead">' + esc(r.summary) + '</p>' : '') + (kc.length ? '<h3 class="rx-h3">' + esc(T('keyConclusions')) + '</h3><ol class="rx-kc">' + kc.map(function (k, i) {
      return '<li class="rx-kc-i"><div class="rx-kc-b"><p class="rx-kc-t">' + esc(k.text) + '</p>' + (k.why ? '<p class="rx-muted">' + esc(k.why) + '</p>' : '') + evLine(k) + '</div>' + addBtn('k' + i, 'Key conclusion', k.text + (k.why ? ' — ' + k.why : ''), k) + '</li>';
    }).join('') + '</ol>' : '');
    return sec('summary', T('sec.summary'), body);
  }
  function sourcesSection(r) {
    var rt = r.retrieval || {}, srcs = r.sources || [];
    var used = function (s) { var labels = (s.citedBy || []).map(function (k) { return k === 'keyConclusions' ? T('keyConclusions') : (pick('sec.' + k) || k); }); return labels.length ? '<span class="rx-muted">' + esc(T('srcUsedIn', { list: labels.join(', ') })) + '</span>' : ''; };
    var prov = function (s) { return s.provenance === 'own_website' ? T('srcOwn') : s.provenance === 'user_provided' ? T('srcAttached') : T('srcResult'); };
    var list = srcs.length ? '<ul class="rx-src">' + srcs.map(function (s) {
      return '<li class="rx-src-i"><div>' + link(s.url, s.title || s.domain, 'rx-src-t') + '<span class="rx-muted"> · ' + esc(s.domain || host(s.url)) + (s.publishedDate ? ' · ' + esc(s.publishedDate) : '') + ' · ' + esc(prov(s)) + '</span></div>' +
        '<div class="rx-src-m"><span class="rx-tag ' + (s.fetched ? 'is-read' : '') + '">' + esc(s.fetched ? T('srcRead') : T('srcNotRead')) + '</span>' + (s.fetchError && !s.fetched ? '<span class="rx-muted">' + esc(s.fetchError) + '</span>' : '') + used(s) + '</div></li>';
    }).join('') + '</ul>' : '<p class="rx-muted">' + esc(T('srcNone')) + '</p>';
    var notes = [];
    (r.urlSourceErrors || []).forEach(function (e) { notes.push(T('urlErr', { u: host(e.url), r: e.reason })); });
    if (r.ownWebsite && r.ownWebsite.ok === false) notes.push(T('siteErr', { r: r.ownWebsite.reason || '' }));
    var lim = (r.limitations || []).concat(notes);
    var body = (rt.searches != null ? '<p>' + esc(T('srcIntro', { s: rt.searches, r: rt.results || 0, f: rt.read || 0 })) + '</p>' : '') + list +
      (lim.length ? '<h3 class="rx-h3">' + esc(T('limits')) + '</h3><ul class="rx-bul">' + lim.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      ((r.assumptions || []).length ? '<h3 class="rx-h3">' + esc(T('assumptions')) + '</h3><ul class="rx-bul">' + r.assumptions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      '<p class="rx-note">' + esc(T('noPerf')) + '</p>' +
      ((r.referenceTools || []).length ? '<h3 class="rx-h3">' + esc(T('refTools')) + '</h3><p class="rx-muted">' + esc(T('refNote')) + '</p><p class="rx-refs">' + r.referenceTools.map(function (t) { return link(t.url, t.title); }).join('') + '</p>' : '');
    return sec('sources', T('sec.sources'), body);
  }
  function sectionsFor(r) {
    var t = r.type, out = [];
    var compBrief = function () { return r.competitors && r.competitors.length ? '<div class="rx-grid">' + r.competitors.map(function (c) { return competitorCard(c, false); }).join('') + '</div>' : ''; };
    var opps = function () { return r.opportunities && r.opportunities.length ? '<div class="rx-grid">' + r.opportunities.map(function (o) { return oppCard(o, r); }).join('') + '</div>' : ''; };
    if (t === 'market') {
      var mo = r.marketOverview;
      var ov = mo ? ((mo.name ? '<h3 class="rx-h3">' + esc(mo.name) + '</h3>' : '') + (mo.description ? '<p>' + esc(mo.description) + '</p>' : '') + listItems(mo.characteristics, function (c) { return '<p>' + esc(c.text) + '</p>'; }, null)) : '';
      ov += (r.challenges && r.challenges.length ? listItems(r.challenges, function (c) { return '<p>' + esc(c.text) + '</p>'; }, 'Market challenge') : '');
      out.push(['overview', T('sec.overview'), ov]);
      out.push(['trends', T('sec.trends'), listItems(r.trends, function (x) { return '<p><b>' + esc(x.trend) + '</b></p>' + (x.why ? '<p class="rx-muted">' + esc(x.why) + '</p>' : ''); }, 'Trend', function (x) { return x.trend + (x.why ? ' — ' + x.why : ''); })]);
      out.push(['demand', T('sec.demand'), listItems(r.signals, function (s) { return '<p>' + esc(s.text) + '</p>'; }, 'Customer signal', function (s) { return s.text; })]);
      out.push(['landscape', T('sec.landscape'), compBrief()]);
      out.push(['mOpps', T('sec.mOpps'), opps(), T('ideasNote')]);
      out.push(['implications', T('sec.implications'), listItems(r.implications, function (x) { return '<p>' + esc(x.text) + '</p>'; }, 'Implication', function (x) { return x.text; })]);
    } else if (t === 'competitor') {
      out.push(['compOverview', T('sec.compOverview'), r.competitors && r.competitors.length ? '<div class="rx-grid">' + r.competitors.map(function (c) { return competitorCard(c, true); }).join('') + '</div>' : '']);
      out.push(['comparison', T('sec.comparison'), comparisonTable(r.competitors)]);
      out.push(['adPatterns', T('sec.adPatterns'), listItems(r.adPatterns, function (p) { return '<p><b>' + esc(p.pattern) + '</b></p>' + (p.description ? '<p class="rx-muted">' + esc(p.description) + '</p>' : ''); }, 'Ad pattern', function (p) { return p.pattern + (p.description ? ' — ' + p.description : ''); })]);
      out.push(['diff', T('sec.diff'), opps() + angleCards(r.angles), T('ideasNote')]);
    } else if (t === 'audience') {
      out.push(['segments', T('sec.segments'), segmentCards(r.segments), T('hypoNote')]);
      out.push(['needs', T('sec.needs'), signalsBy(r.signals, ['need', 'painPoint'])]);
      out.push(['motives', T('sec.motives'), signalsBy(r.signals, ['motivation', 'objection', 'consideration'])]);
      out.push(['messaging', T('sec.messaging'), angleCards(r.angles), T('ideasNote')]);
    } else if (t === 'opportunity') {
      out.push(['keyOpps', T('sec.keyOpps'), opps(), T('ideasNote')]);
      out.push(['support', T('sec.support'), listItems(r.signals, function (s) { return '<p>' + esc(s.text) + '</p>'; }, 'Customer signal', function (s) { return s.text; }) + (r.competitors && r.competitors.length ? '<h3 class="rx-h3">' + esc(T('sec.competitors')) + '</h3>' + compBrief() : '')]);
      out.push(['angles', T('sec.angles'), angleCards(r.angles), T('ideasNote')]);
      out.push(['tests', T('sec.tests'), testCards(r.tests), T('ideasNote')]);
      out.push(['risks', T('sec.risks'), riskList(r.risks)]);
    } else { // older reports (version 1)
      var m1 = r.marketOverview;
      out.push(['overview', T('sec.overview'), m1 ? '<h3 class="rx-h3">' + esc(m1.name || '') + '</h3>' + listItems(m1.characteristics, function (c) { return '<p>' + esc(c.text) + '</p>'; }, null) : '']);
      out.push(['competitors', T('sec.competitors'), r.competitors && r.competitors.length ? '<div class="rx-grid">' + r.competitors.map(function (c) { return competitorCard(c, true); }).join('') + '</div>' : '']);
      out.push(['signals', T('sec.signals'), listItems(r.signals, function (s) { return '<p>' + esc(s.text) + '</p>'; }, 'Customer signal', function (s) { return s.text; })]);
      out.push(['trends', T('sec.trends'), listItems(r.trends, function (x) { return '<p><b>' + esc(x.trend) + '</b></p>' + (x.why ? '<p class="rx-muted">' + esc(x.why) + '</p>' : ''); }, 'Trend', function (x) { return x.trend; })]);
      out.push(['adPatterns', T('sec.adPatterns'), listItems(r.adPatterns, function (p) { return '<p><b>' + esc(p.pattern) + '</b></p>' + (p.description ? '<p class="rx-muted">' + esc(p.description) + '</p>' : ''); }, 'Ad pattern', function (p) { return p.pattern; })]);
      out.push(['opportunities', T('sec.opportunities'), opps(), T('ideasNote')]);
      out.push(['segments', T('sec.segments'), segmentCards(r.segments), T('hypoNote')]);
      out.push(['angles', T('sec.angles'), angleCards(r.angles), T('ideasNote')]);
      out.push(['concepts', T('sec.concepts'), r.concepts && r.concepts.length ? listItems(r.concepts, function (k) { return '<p><b>' + esc(k.concept) + '</b>' + (k.format ? ' · ' + esc(k.format) : '') + '</p>' + (k.hook ? '<p class="rx-muted">' + esc(T('f.hook')) + ': ' + esc(k.hook) + '</p>' : ''); }, 'Creative concept', function (k) { return k.concept + (k.hook ? ' — ' + k.hook : ''); }) : '', T('ideasNote')]);
      out.push(['risks', T('sec.risks'), riskList(r.risks)]);
      out.push(['nextSteps', T('sec.nextSteps'), r.nextSteps && r.nextSteps.length ? '<ul class="rx-bul">' + r.nextSteps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '']);
    }
    return out.filter(function (s) { return s[2]; });
  }
  // Older (version 1) reports → the shape the report view reads. Their
  // "verified" only meant "a source id was cited", so it maps to source_cited.
  function adaptLegacy(r) {
    if (r.reportVersion === 2) return r;
    var B = { verified: 'source_cited', inference: 'analysis', recommendation: 'idea' };
    var fix = function (x) { return Object.assign({}, x, { basis: B[x.basis] || (x.sourceIds && x.sourceIds.length ? 'source_cited' : 'analysis'), quotes: [] }); };
    var srcs = (r.webSources || []).map(function (s) { return { id: s.id, title: s.title, url: s.url, domain: s.domain, publishedDate: s.publishedDate || null, provenance: 'search', fetched: false, citedBy: [] }; })
      .concat((r.urlSources || []).map(function (s) { return { id: s.id, title: s.title, url: s.url, domain: s.domain, provenance: s.provenance, fetched: true, citedBy: [] }; }));
    return {
      reportVersion: 1, legacy: true, type: null, question: r.question, title: r.title || r.question, summary: r.summary, keyConclusions: [],
      marketOverview: r.market ? { name: r.market.name, characteristics: (r.market.characteristics || []).map(function (c) { return { text: c, basis: B[r.market.basis] || 'analysis', sourceIds: r.market.sourceIds || [], quotes: [] }; }) } : null,
      competitors: (r.competitors || []).map(function (c) { return fix(Object.assign({}, c, { offering: c.offers || (c.products || []).join(', '), pricing: c.priceRange, adPatterns: c.advertisingPatterns || [] })); }),
      signals: (r.customerSignals || []).map(fix), trends: (r.trends || []).map(function (t) { return fix(Object.assign({}, t, { why: t.relevance })); }),
      adPatterns: (r.advertisingPatterns || []).map(fix), opportunities: (r.opportunities || []).map(function (o) { return Object.assign(fix(o), { title: o.opportunity, why: o.evidence, basis: 'idea' }); }),
      segments: (r.audiences || []).map(function (a) { return Object.assign(fix(a), { name: a.segment, basis: 'idea' }); }), angles: (r.angles || []).map(function (g) { return Object.assign(fix(g), { basis: 'idea' }); }),
      concepts: (r.creativeConcepts || []).map(function (k) { return Object.assign(fix(k), { basis: 'idea' }); }), risks: (r.risks || []).map(function (x) { return Object.assign(fix(x), { basis: 'idea' }); }),
      nextSteps: r.nextSteps || [], limitations: (r.dataGaps || []), assumptions: r.assumptions || [], sources: srcs, referenceTools: r.sources || [],
      retrieval: null, partial: !!r.partial, reportId: r.reportId, savedAt: r.savedAt, createdAt: r.createdAt, ownWebsite: r.ownWebsite || null, urlSourceErrors: r.urlSourceErrors || [],
    };
  }
  function reportView() {
    if (!S.report) return '<div class="rx-card">' + (S.reportErr ? '<p role="alert">' + esc(S.reportErr) + '</p><button type="button" class="rx-btn rx-btn-ghost" data-rx="home">' + esc(T('backHome')) + '</button>' : '<p class="rx-muted" aria-busy="true">' + esc(T('loading')) + '</p>') + '</div>';
    var r = S.report; srcById = {}; pickables = {};
    (r.sources || []).forEach(function (s) { srcById[s.id] = s; });
    var tl = r.type && pick('types.' + r.type) ? pick('types.' + r.type)[0] : null;
    var rt = r.retrieval || {}, read = (r.sources || []).filter(function (s) { return s.fetched; }).length;
    var sections = [['summary', T('sec.summary'), summarySection(r)]].concat(sectionsFor(r).map(function (s) { return [s[0], s[1], sec(s[0], s[1], s[2], s[3])]; })).concat([['sources', T('sec.sources'), sourcesSection(r)]]).filter(function (s) { return s[2]; });
    var meta = [T('created', { d: dateLong(r.savedAt || r.completedAt || r.createdAt) }), (r.sources || []).length ? T('readN', { n: read, m: (r.sources || []).length }) : null, rt.searches ? T('searchesN', { n: rt.searches }) : null, r.confidence ? T('confidence.' + r.confidence) : null].filter(Boolean).join(' · ');
    var bar = '<div class="rx-topbar"><button type="button" class="rx-back" data-rx="home">← ' + esc(T('back')) + '</button><div class="rx-row"><button type="button" class="rx-link" data-rx="rename-report">' + esc(T('rename')) + '</button><button type="button" class="rx-link rx-danger" data-rx="delete" data-id="' + esc(r.reportId) + '">' + esc(T('del')) + '</button><button type="button" class="rx-btn rx-btn-ghost" data-rx="home-new">' + esc(T('newResearch')) + '</button></div></div>';
    var titleBlock = S.renaming === 'report' ? '<div class="rx-row rx-rename"><input type="text" id="rxRename" class="rx-input" maxlength="120" value="' + esc(r.title || '') + '" aria-label="' + esc(T('renamePh')) + '"><button type="button" class="rx-btn rx-btn-primary" data-rx="rename-save" data-id="' + esc(r.reportId) + '">' + esc(T('save')) + '</button><button type="button" class="rx-btn rx-btn-ghost" data-rx="rename-cancel">' + esc(T('cancel')) + '</button></div>'
      : '<h1 class="rx-title">' + esc(r.title || r.question) + '</h1>';
    var head = '<header class="rx-rhead">' + (tl ? '<p class="rx-eyebrow">' + esc(tl) + '</p>' : '') + titleBlock + (r.title && r.question && r.title !== r.question ? '<p class="rx-q-recap">“' + esc(r.question) + '”</p>' : '') + '<p class="rx-meta">' + esc(meta) + '</p>' +
      (r.partial ? '<p class="rx-warn" role="note">' + esc(T('partial')) + '</p>' : '') + (r.legacy ? '<p class="rx-warn" role="note">' + esc(T('legacy')) + '</p>' : '') + '</header>';
    var nav = sections.length > 2 ? '<nav class="rx-toc" aria-label="' + esc(T('onThisPage')) + '"><span class="rx-lbl-sm">' + esc(T('onThisPage')) + '</span>' + sections.map(function (s) { return '<a href="#rxs-' + s[0] + '" data-rx="toc" data-k="' + s[0] + '">' + esc(s[1]) + '</a>'; }).join('') + '</nav>' : '';
    return bar + head + '<div class="rx-report">' + nav + '<div class="rx-body">' + sections.map(function (s) { return s[2]; }).join('') + '</div></div>' + trayView();
  }
  function trayView() {
    var ids = Object.keys(S.picks); if (!ids.length) return '';
    var n = ids.length;
    return '<div class="rx-tray" role="region" aria-label="' + esc(T('tray', { n: n, max: MAX_PICKS })) + '"><div class="rx-tray-in"><div class="rx-tray-top"><b>' + esc(T('tray', { n: n, max: MAX_PICKS })) + '</b><button type="button" class="rx-link" data-rx="tray-clear">' + esc(T('trayClear')) + '</button></div>' +
      '<div class="rx-chips">' + ids.map(function (id) { var p = S.picks[id]; return '<span class="rx-chip rx-chip-x" title="' + esc(p.text) + '"><span class="rx-chip-g">' + esc(p.group) + '</span>' + esc(p.text.slice(0, 48)) + (p.text.length > 48 ? '…' : '') + '<button type="button" data-rx="pick-remove" data-fid="' + esc(id) + '" aria-label="' + esc(T('trayRemove', { t: p.text.slice(0, 40) })) + '">×</button></span>'; }).join('') + '</div>' +
      '<div class="rx-tray-bottom"><span class="rx-hint">' + esc(T('trayHint')) + '</span><button type="button" class="rx-btn rx-btn-primary" data-rx="use-create">' + esc(n === 1 ? T('trayUse1') : T('trayUse', { n: n })) + '</button></div></div></div>';
  }

  // ── Actions ───────────────────────────────────────────────────────
  function validate(q) {
    var s = String(q || '').trim();
    if (!s) return T('vEmpty'); if (s.length < 8) return T('vShort'); if (s.length > Q_MAX) return T('vLong', { n: Q_MAX }); return null;
  }
  function start() {
    var q = S.question.trim(), v = validate(q);
    if (v) { S.formErr = esc(v); render(); var i = $('researchQueryInput'); if (i) i.focus(); return; }
    if (S.starting) return;
    S.starting = true; S.formErr = null; render();
    if (window.orvActionEvent) window.orvActionEvent('start', 'research');
    var body = { question: q, type: S.type, includeWebsite: S.includeWebsite };
    if (S.urls.length) body.urls = S.urls.slice();
    api('/api/research/query', { method: 'POST', body: JSON.stringify(body), idempotencyKey: newKey(), headers: { 'X-Idempotency-Key': newKey() } }).then(function (r) {
      S.starting = false;
      if (r.status === 202 && r.data && r.data.reportId) {
        S.job = { reportId: r.data.reportId, stage: 'preparing', status: 'running', type: S.type, title: q.length > 110 ? q.slice(0, 107) + '…' : q, startedAt: new Date().toISOString(), progress: {}, request: body };
        S.view = 'progress'; render(); poll(); loadLibrary(); return;
      }
      var d = r.data || {};
      if (r.status === 409 && d.code === 'RESEARCH_RUNNING' && d.reportId) { toast(T('eRunning'), 'warn'); openProgress(d.reportId); return; }
      if (r.status === 402) { S.formErr = esc(T('eCredits', { n: cost() })) + ' <button type="button" class="rx-link" data-rx="plans">' + esc(T('ePlans')) + '</button>'; if (window.orvActionEvent) window.orvActionEvent('blocked', 'research', { status: 402, code: d.code, balance: d.balance }); }
      else if (r.status === 403) { S.formErr = esc(d.error || T('eGeneric')); if (window.orvActionEvent) window.orvActionEvent('blocked', 'research', { status: 403, code: d.code }); }
      else if (r.status === 0) S.formErr = esc(T('eNetwork'));
      else S.formErr = esc(d.error || T('eGeneric')) + (d.requestId ? ' <span class="rx-ref">' + esc(T('ref', { id: String(d.requestId).slice(0, 8) })) + '</span>' : '');
      render();
    });
  }
  function openProgress(id) {
    var r = (S.reports || []).filter(function (x) { return x.id === id; })[0];
    S.job = { reportId: id, stage: r && r.stage || 'preparing', status: 'running', type: r && r.type, title: r && r.title, startedAt: r && r.progress && r.progress.startedAt || r && r.createdAt, progress: r && r.progress || {} };
    S.view = 'progress'; render(); poll();
  }
  function poll() {
    clearTimeout(pollTimer);
    if (S.view !== 'progress' || !S.job || S.job.status !== 'running') return;
    var id = S.job.reportId;
    pollTimer = setTimeout(function () {
      api('/api/research/reports/' + encodeURIComponent(id)).then(function (r) {
        // Only the progress view follows the job; never pull the user out of
        // Home/another report when it finishes (the library shows it).
        if (!S.job || S.job.reportId !== id || S.view !== 'progress') return;
        if (r.status === 404) { S.job.status = 'failed'; S.job.error = T('errOpen'); render(); return; }
        if (r.ok && r.data) {
          var s = r.data.summary || {};
          if (s.status === 'ready' && r.data.report) { S.job = null; showReport(r.data.report); loadLibrary(); if (window.orvActionEvent) window.orvActionEvent('success', 'research'); return; }
          if (s.status === 'failed') { S.job.status = 'failed'; S.job.error = s.error; render(); loadLibrary(); return; }
          S.job.stage = s.stage || S.job.stage; S.job.progress = s.progress || S.job.progress; if (s.title) S.job.title = s.title;
          if (S.view === 'progress') render();
        }
        poll();
      });
    }, 1800);
  }
  function showReport(rep) {
    S.report = adaptLegacy(rep); S.reportErr = null; S.view = 'report'; S.renaming = null;
    S.picks = lsGet('picks_' + rep.reportId, {}) || {};
    lsSet('last', rep.reportId);
    window._researchLastResult = rep; // Oriven Chat context + Control Center lineage (read-only)
    if (typeof window._orvSaveResearchSession === 'function') window._orvSaveResearchSession(rep);
    render(); window.scrollTo(0, 0);
    var h = document.querySelector('#rsRoot .rx-title'); if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (_) {} }
  }
  function openReport(id) {
    S.view = 'report'; S.report = null; S.reportErr = null; render();
    api('/api/research/reports/' + encodeURIComponent(id)).then(function (r) {
      if (r.ok && r.data && r.data.report) return showReport(r.data.report);
      if (r.ok && r.data && r.data.summary && r.data.summary.status === 'running') return openProgress(id);
      S.reportErr = T('errOpen'); render();
    });
  }
  function savePicks() { if (S.report) lsSet('picks_' + S.report.reportId, S.picks); }
  function togglePick(fid) {
    if (S.picks[fid]) delete S.picks[fid];
    else { if (Object.keys(S.picks).length >= MAX_PICKS) { toast(T('addFull', { n: MAX_PICKS }), 'warn'); return; } if (pickables[fid]) S.picks[fid] = pickables[fid]; }
    savePicks(); render();
  }
  function useInCreate() {
    var r = S.report; var ids = Object.keys(S.picks); if (!r || !ids.length) return;
    var h = { question: r.question || '', summary: r.summary || '', title: r.title || '', researchType: r.type || null, reportId: r.reportId || null, savedAt: new Date().toISOString(),
      findings: ids.slice(0, MAX_PICKS).map(function (id) { return S.picks[id]; }) };
    if (window.orvWorkspace && orvWorkspace.research && orvWorkspace.research.setHandoff) orvWorkspace.research.setHandoff(h);
    if (typeof window._orvNav === 'function') window._orvNav('create', 'page-create');
    setTimeout(function () {
      if (window.orvCreate && typeof window.orvCreate.applyResearch === 'function') window.orvCreate.applyResearch(r);
      if (typeof window._cr2RenderStage === 'function') window._cr2RenderStage();
      toast(T('tCreate', { n: h.findings.length }));
    }, 80);
  }
  function rename(id, title) {
    title = String(title || '').trim(); if (!title) return;
    api('/api/research/reports/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ title: title }) }).then(function (r) {
      if (r.ok) {
        (S.reports || []).forEach(function (x) { if (x.id === id) x.title = r.data.title; });
        if (S.report && S.report.reportId === id) S.report.title = r.data.title;
        S.renaming = null; render(); toast(T('tRenamed'));
      } else toast((r.data && r.data.error) || T('eGeneric'), 'error');
    });
  }
  function del(id) {
    var F = window.orvWorkspace && orvWorkspace.flow;
    var ask = F && F.confirm ? F.confirm({ title: T('confDelH'), body: '<p>' + esc(T('confDelP')) + '</p>', confirmLabel: T('del'), cancelLabel: T('cancel'), danger: true }) : Promise.resolve(window.confirm(T('confDelH')));
    ask.then(function (y) {
      if (!y) return;
      api('/api/research/reports/' + encodeURIComponent(id), { method: 'DELETE' }).then(function (r) {
        if (r.ok) {
          S.reports = (S.reports || []).filter(function (x) { return x.id !== id; });
          lsSet('picks_' + id, null); if (lsGet('last', null) === id) lsSet('last', null);
          if (S.report && S.report.reportId === id) { S.report = null; S.view = 'home'; }
          render(); toast(T('tDeleted'));
        } else toast(r.status === 409 ? T('tStillRunning') : ((r.data && r.data.error) || T('eGeneric')), 'error');
      });
    });
  }
  function goHome(clear) {
    clearTimeout(pollTimer);
    S.view = 'home'; S.renaming = null;
    if (clear) { S.question = ''; S.urls = []; S.formErr = null; S.type = 'market'; }
    render(); loadLibrary(); window.scrollTo(0, 0);
    if (clear) { var i = $('researchQueryInput'); if (i) i.focus(); }
  }
  function addUrl() {
    var i = $('rxUrlInput'); var raw = i ? i.value.trim() : '';
    if (!raw) return;
    var u = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    var ok = false; try { var x = new URL(u); ok = /^https?:$/.test(x.protocol) && /\.[a-z]{2,}$/i.test(x.hostname); } catch (_) {}
    if (!ok) { S.urlErr = T('sitesBad'); render(); var j = $('rxUrlInput'); if (j) { j.value = raw; j.focus(); } return; }
    if (S.urls.indexOf(u) === -1 && S.urls.length < URL_MAX) S.urls.push(u);
    S.urlErr = null; S.urlOpen = S.urls.length < URL_MAX; render(); var k = $('rxUrlInput'); if (k) k.focus();
  }

  function onClick(ev) {
    var root = $('rsRoot'); if (!root || !root.contains(ev.target)) return;
    var t = ev.target.closest('[data-rx]'); if (!t) return;
    var a = t.getAttribute('data-rx'), id = t.getAttribute('data-id');
    if (a === 'toc') { ev.preventDefault(); var target = $('rxs-' + t.getAttribute('data-k')); if (target) { target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); var hh = target.querySelector('h2'); if (hh) { hh.setAttribute('tabindex', '-1'); try { hh.focus({ preventScroll: true }); } catch (_) {} } } return; }
    if (a === 'type') return; // change handler
    if (a === 'open') return openReport(id);
    if (a === 'progress') return openProgress(id);
    if (a === 'home') return goHome(false);
    if (a === 'home-new') return goHome(true);
    if (a === 'lib-retry') return loadLibrary();
    if (a === 'retry-job') { var req = S.job && S.job.request; if (req) { S.question = req.question; S.type = req.type; S.urls = req.urls || []; } goHome(false); return; }
    if (a === 'rename') { S.renaming = id; render(); var rn = $('rxRename'); if (rn) { rn.focus(); rn.select(); } return; }
    if (a === 'rename-report') { S.renaming = 'report'; render(); var rr = $('rxRename'); if (rr) { rr.focus(); rr.select(); } return; }
    if (a === 'rename-cancel') { S.renaming = null; render(); return; }
    if (a === 'rename-save') { var inp = $('rxRename'); return rename(id, inp && inp.value); }
    if (a === 'delete') return del(id);
    if (a === 'pick') return togglePick(t.getAttribute('data-fid'));
    if (a === 'pick-remove') { delete S.picks[t.getAttribute('data-fid')]; savePicks(); render(); return; }
    if (a === 'tray-clear') { S.picks = {}; savePicks(); render(); return; }
    if (a === 'use-create') return useInCreate();
    if (a === 'url-open') { S.urlOpen = true; render(); var ui = $('rxUrlInput'); if (ui) ui.focus(); return; }
    if (a === 'url-add') return addUrl();
    if (a === 'url-remove') { S.urls.splice(+t.getAttribute('data-i'), 1); S.urlOpen = false; render(); return; }
    if (a === 'biz-setup') { if (typeof window.bizGoTo === 'function') window.bizGoTo('business'); return; }
    if (a === 'biz-edit') { if (typeof window.bizGoTo === 'function') window.bizGoTo('overview'); return; }
    if (a === 'plans') { if (typeof window.orvActionEvent === 'function') window.orvActionEvent('blocked', 'research', { status: 402 }); else if (typeof window.openUpgradeModal === 'function') window.openUpgradeModal(); return; }
  }
  var bound = false;
  function bind() {
    if (bound) return; bound = true;
    document.addEventListener('click', onClick);
    document.addEventListener('submit', function (ev) { if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-rx-form')) { ev.preventDefault(); start(); } });
    document.addEventListener('input', function (ev) {
      var root = $('rsRoot'); if (!root || !root.contains(ev.target)) return;
      if (ev.target.id === 'researchQueryInput') { S.question = ev.target.value; var c = $('rxQCount'); if (c) c.textContent = T('qCount', { n: S.question.length, max: Q_MAX }); if (S.formErr) { S.formErr = null; var e = $('rxFormErr'); if (e) e.remove(); } }
    });
    document.addEventListener('change', function (ev) {
      var root = $('rsRoot'); if (!root || !root.contains(ev.target)) return;
      var a = ev.target.getAttribute('data-rx');
      if (a === 'type') { S.type = ev.target.value; render(); var r = document.querySelector('#rsRoot input[name="rxType"][value="' + S.type + '"]'); if (r) r.focus(); }
      if (a === 'include-website') S.includeWebsite = ev.target.checked;
    });
    document.addEventListener('keydown', function (ev) {
      var root = $('rsRoot'); if (!root || !root.contains(ev.target)) return;
      if (ev.key === 'Enter' && ev.target.id === 'rxUrlInput') { ev.preventDefault(); addUrl(); }
      if (ev.key === 'Enter' && ev.target.id === 'rxRename') { ev.preventDefault(); var b = root.querySelector('[data-rx="rename-save"]'); if (b) b.click(); }
      if (ev.key === 'Escape' && ev.target.id === 'rxRename') { S.renaming = null; render(); }
      if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey) && ev.target.id === 'researchQueryInput') { ev.preventDefault(); start(); }
    });
  }

  // Called by _orvNav when Research opens: always Research Home. A research
  // still running shows there as a banner ("View progress"); saved reports
  // open only when chosen.
  function enter() {
    if (!$('rsRoot')) return;
    bind();
    clearTimeout(pollTimer);
    S.view = 'home'; S.renaming = null;
    render(); loadLibrary(); loadBiz();
  }
  function reset() { clearTimeout(pollTimer); S.view = 'home'; S.report = null; S.job = null; S.reports = null; S.biz = undefined; S.picks = {}; S.question = ''; S.urls = []; window._researchLastResult = null; render(); }

  window.orvResearch = {
    enter: enter, reset: reset, open: openReport,
    getDraft: function () { return { question: S.question, type: S.type, urls: S.urls.slice() }; },
    setDraft: function (d) { if (!d) return; if (typeof d.question === 'string') S.question = d.question.slice(0, Q_MAX); if (TYPES.indexOf(d.type) !== -1) S.type = d.type; if (Array.isArray(d.urls)) S.urls = d.urls.slice(0, URL_MAX); render(); },
    _state: function () { return S; }, _T: T, _STR: STR, _adaptLegacy: adaptLegacy,
  };
  window._researchNewSession = reset; // account switch (orivenWorkspace.js)

  if (typeof window.applyLanguage === 'function' && !window.applyLanguage._rx) {
    var orig = window.applyLanguage;
    window.applyLanguage = function () { var r = orig.apply(this, arguments); try { if ($('rsRoot') && $('rsRoot').innerHTML) render(); } catch (_) {} return r; };
    window.applyLanguage._rx = true;
  }
})();
