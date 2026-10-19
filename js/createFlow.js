/* ════════════════════════════════════════════════════════════════
   Create 2.0 — guided ad creation (#page-create)

   Six short steps: 1 Product · 2 Platform · 3 Goal · 4 Format ·
   5 Customise (optional) · 6 Review & create.

   • What can be chosen comes from js/createCompat.js — the SAME schema the
     backend checks before charging (/api/ai/create-ad, /api/generate-image,
     /api/generate-ugc-video) and the Launch spec checks before publishing.
     Unsupported combinations are shown disabled with a reason, never
     generated.
   • The prompt is no longer the configuration: the answers are sent as a
     structured `brief` (plus `format` / `campaignType`), and the backend
     writes the AI instructions with a fixed priority (settings > notes) and
     strict "only real facts" rules.
   • The existing pipeline is reused unchanged: cgrGenerate() (copy), the
     image/video creative generation, saving, the review screen and Launch.
     The legacy globals the rest of the app reads (window._ov3Goal,
     _ov3ContentMode, _ov3GoogleCampaignType, _ov3PlatformObjective,
     _ov3Structure, .cr2-pp-on / .cr2-goal-card-on) are kept in sync.
   • Step 4 also holds the image source (AI or the user's own upload, stored
     through the existing /api/manual-campaigns/upload-creative route — no
     image generation, no image credits) and the number of ads (ad sets /
     ad groups × ads, only where publishing builds that structure).
   • The Creative Stage (#cr2Stage) is rendered from this state alone.
   • Budget, countries, ages, placements and publishing stay in Launch.

   Public API (window.orvCreate): mount, goTo, getState, setState,
   applyResearch, onBusiness, generate, restoreButton, isReady, relabel.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var CC = window.OrivenCreateCompat;
  if (!CC) { console.error('[create] createCompat.js not loaded'); return; }

  // ── Texts (six interface languages; English fallback) ─────────────
  var STR = {
    en: {
      title: 'Create an ad', subtitle: 'Answer a few simple questions. We’ll write the ad for you.',
      st1: 'Product', st2: 'Platform', st3: 'Goal', st4: 'Format', st5: 'Customise', st6: 'Review',
      stepOf: 'Step {n} of {t}', back: 'Back', next: 'Next', skip: 'Skip', optional: 'optional',
      s1h: 'What are you advertising?', s1sub: 'Tell us about your product or service. Plain words are perfect.',
      nameL: 'Product or service name', nameP: 'e.g. Handmade leather wallet',
      descL: 'Short description', descP: 'e.g. Handmade leather wallets from our Amsterdam workshop, with free name engraving. A great gift.', descHelp: 'What is it, and why would someone want it?',
      webL: 'Website or product page', webP: 'e.g. yourshop.com/wallets', webHelp: 'We read the page so the ad matches it, and Launch uses it as the landing page.', webRead: 'Read page', webReading: 'Reading…', webReadDone: 'Page read',
      offerL: 'Price or special offer', offerP: 'e.g. €45, or 10% off this week', offerHelp: 'Only add real prices or offers — the ad never invents one.',
      s2h: 'Where do you want to advertise?', s2sub: 'Choose one platform. You can make an ad for another platform afterwards.',
      s3h: 'What do you want to achieve?', s3sub: 'We set up the right campaign objective on {platform} for you.',
      s4h: 'Choose the ad format', s4sub: 'Only formats {platform} and OrivenAI can publish are offered.',
      onlyOne: '{platform} ads made in OrivenAI are {format} ads, so this is selected for you.',
      unavailable: 'Not available',
      advL: 'Advanced settings', advSub: 'Optional. The defaults work well for a first ad.',
      gtypeL: 'Google ad type', objL: 'Campaign objective', objStd: 'Standard objective for your goal',
      adsL: 'Number of ads', groupsL: 'Ad groups', perL: 'Ads in each group',
      adsHelp: 'More ads let the platform test different versions. Each extra image or video costs credits.', adsFixed: 'This ad type always publishes as one ad.',
      s5h: 'Customise your ad', s5sub: 'Everything here is optional. Skip it and we’ll use sensible defaults.',
      audL: 'Who is this ad for?', audP: 'e.g. Men aged 25–45 looking for a quality gift', audUse: 'Use: {name}',
      langL: 'Advertising language', langProfile: 'From your business profile.', langCountry: 'Suggested from your business country ({country}). Check it’s the language your customers read.', langDefault: 'Suggested. Choose the language your customers read.', langUser: 'Chosen by you.',
      toneL: 'Tone of voice', toneAuto: 'Let OrivenAI choose', tone_Friendly: 'Friendly', tone_Professional: 'Professional', tone_Premium: 'Premium', tone_Playful: 'Playful', tone_Bold: 'Bold',
      stylesL: 'Creative suggestions',
      style_new: 'New product', style_season: 'Seasonal promotion', style_premium: 'Premium look', style_minimal: 'Minimalist', style_bold: 'Bold and energetic', style_pro: 'Professional', style_friendly: 'Friendly',
      notesL: 'Anything else we should know?', notesP: 'e.g. Highlight the free engraving and use a premium, minimalist style.', notesHelp: 'Creative direction only. Your choices in the earlier steps always come first.',
      moreL: 'Photos, inspiration and brand', photosL: 'Product photos', useOwn: 'Use my own image', showProduct: 'Show my product', inspL: 'Inspired by an ad you like', brandL: 'Use my brand style',
      researchNote: '{n} finding(s) from your Research will guide this ad.',
      s6h: 'Review and create', s6sub: 'Check your ad before we create it.',
      rvWhat: 'Advertising', rvWhere: 'Platform', rvGoal: 'Goal', rvFormat: 'Format', rvType: 'Google ad type', rvLang: 'Language', rvAud: 'For', rvTone: 'Tone', rvStyle: 'Style', rvAds: 'Ads', rvOffer: 'Offer', rvWeb: 'Website', rvEdit: 'Edit',
      costL: 'Cost', credits: '{n} credits', costCopy: 'Ad text {n}', costImg: '{c} × image ({n} each)', costVid: '{c} × video ({n} each)', costLoading: 'Checking your credits…', costPending: 'Pick a platform and format to see the cost', stagePickPlat: 'Choose a platform',
      freeFirst: 'Your first ad is free.',
      launchHint: 'Budget, targeting and publishing settings are configured in Launch.',
      countryHint: 'Advertising in: {country} (from your business profile). You can change this in Launch.', countryNone: 'You choose the countries in Launch.',
      whatNext: 'Next: you review the ad, then set the budget and countries in Launch. Nothing goes live without your confirmation.',
      create: 'Create ad', createCost: 'Create ad · {n} credits', creating: 'Creating…',
      errName: 'Add the name of your product or service.', errDesc: 'Add a short description — one sentence is enough.', errPlatform: 'Choose where the ad should run.', errGoal: 'Choose what the ad should achieve.', errFormat: 'Choose a format.',
      nGoalReset: '“{goal}” isn’t available on {platform}, so please choose another goal.',
      nFormatAuto: 'The format is now {format}: {reason}', nTypeFormat: '{type} uses {format} ads, so the format changed to {format}.', nObjReset: 'The objective went back to the standard one: {reason}',
      platform_google_sub: 'Search, YouTube, Gmail and more', platform_meta_sub: 'Facebook and Instagram', platform_tiktok_sub: 'Short vertical videos', platform_pinterest_sub: 'Promoted Pins',
      platform_google_tag: 'Reach people searching for products like yours.', platform_meta_tag: 'Reach customers on Facebook and Instagram.', platform_tiktok_tag: 'Create engaging short-form video ads.', platform_pinterest_tag: 'Reach people discovering products and ideas.',
      goal_Sales: 'Get more sales', goal_Sales_d: 'Get people to buy from you.', goal_Traffic: 'Get more website visitors', goal_Traffic_d: 'Bring people to your website.', goal_Leads: 'Generate leads', goal_Leads_d: 'Get enquiries, quotes or sign-ups.', goal_Awareness: 'Increase brand awareness', goal_Awareness_d: 'Get your business noticed.',
      fmt_text: 'Text', fmt_text_d: 'Headlines and descriptions, no image.', fmt_image: 'Image', fmt_image_d: 'A ready-made image ad.', fmt_video: 'Video', fmt_video_d: 'A short vertical video ad.',
      gtype_SEARCH: 'Search', gtype_SEARCH_d: 'Text ads in Google search results.', gtype_PERFORMANCE_MAX: 'Performance Max', gtype_PERFORMANCE_MAX_d: 'Image ads across Search, YouTube, Display, Gmail and Maps.', gtype_DEMAND_GEN: 'Demand Gen', gtype_DEMAND_GEN_d: 'Image ads on YouTube, Discover and Gmail.',
      gnote: '{type} also uses your business name and logo from your business profile.',
      obj_vc: 'Video Completion', obj_vc_d: 'Optimise for people watching your video to the end.',
      r_tiktok_goal_Sales: 'TikTok sales campaigns need a TikTok Pixel purchase event, which OrivenAI can’t set up yet.', r_tiktok_goal_Sales_s: 'Choose “Get more website visitors” on TikTok, or run a sales campaign on Meta or Google.',
      r_tiktok_goal_Leads: 'TikTok lead campaigns use TikTok’s own forms, which OrivenAI doesn’t support yet.', r_tiktok_goal_Leads_s: 'Choose “Get more website visitors” on TikTok, or run a lead campaign on Meta or Google.',
      r_pmax_goal: 'Performance Max is for sales and leads.', r_pmax_goal_s: 'Use Demand Gen for image ads with this goal, or a Search text ad.',
      r_format_meta_video: 'OrivenAI can publish image ads to Meta, but not video ads yet.', r_format_meta_video_s: 'Use an image ad on Meta, or make a video ad for TikTok or Pinterest.',
      r_format_tiktok_image: 'TikTok ads are videos. Image-only ads don’t run in the TikTok feed.', r_format_tiktok_image_s: 'Use a video ad on TikTok, or an image ad on Meta or Pinterest.',
      r_format_google_video: 'OrivenAI doesn’t publish Google video (YouTube) campaigns yet.', r_format_google_video_s: 'Use a text ad (Search) or an image ad (Demand Gen / Performance Max).',
      r_format_google_text_only: 'Google Search ads are text only: they show headlines and descriptions, no image.', r_format_google_text_only_s: 'Choose Text, or pick an image ad type for Google.',
      r_format_google_image_only: 'This Google ad type needs images, not text only.', r_format_google_image_only_s: 'Choose Image, or switch to Search for a text ad.',
      r_objective_unsupported: 'This objective can’t be published by OrivenAI yet.', r_objective_unsupported_s: 'Keep the standard objective for your goal.',
      r_objective_video_completion: 'Video Completion needs a video ad and the “Increase brand awareness” goal.', r_objective_video_completion_s: 'Choose Video and “Increase brand awareness”, or keep the standard objective.',
      c_platform: 'Your note mentions another platform. The ad is made for {platform} — change that in step 2 if you meant another platform.', c_budget: 'Budgets aren’t set here. You choose and confirm the budget in Launch before anything goes live.', c_targeting: 'Countries and targeting are set in Launch. Here, describe who the ad is for and it will be written for them.', c_format: 'The ad format comes from step 4. Your note is used as creative direction only.',
      gen422: 'This ad can’t be created', genInvalid: 'This combination can’t be published:',
    },
    nl: {
      title: 'Maak een advertentie', subtitle: 'Beantwoord een paar eenvoudige vragen. Wij schrijven de advertentie voor je.',
      st1: 'Product', st2: 'Platform', st3: 'Doel', st4: 'Formaat', st5: 'Aanpassen', st6: 'Controleren',
      stepOf: 'Stap {n} van {t}', back: 'Terug', next: 'Volgende', skip: 'Overslaan', optional: 'optioneel',
      s1h: 'Wat wil je adverteren?', s1sub: 'Vertel ons over je product of dienst. Gewone woorden zijn prima.',
      nameL: 'Naam van product of dienst', nameP: 'bijv. Handgemaakte leren portemonnee',
      descL: 'Korte beschrijving', descP: 'bijv. Handgemaakte leren portemonnees uit ons Amsterdamse atelier, met gratis naamgravure. Een mooi cadeau.', descHelp: 'Wat is het, en waarom zou iemand het willen?',
      webL: 'Website of productpagina', webP: 'bijv. jouwshop.nl/portemonnees', webHelp: 'We lezen de pagina zodat de advertentie erbij past, en Launch gebruikt hem als landingspagina.', webRead: 'Pagina lezen', webReading: 'Bezig met lezen…', webReadDone: 'Pagina gelezen',
      offerL: 'Prijs of aanbieding', offerP: 'bijv. €45, of 10% korting deze week', offerHelp: 'Voeg alleen echte prijzen of aanbiedingen toe — de advertentie verzint er nooit een.',
      s2h: 'Waar wil je adverteren?', s2sub: 'Kies één platform. Je kunt daarna een advertentie voor een ander platform maken.',
      s3h: 'Wat wil je bereiken?', s3sub: 'Wij stellen het juiste campagnedoel op {platform} voor je in.',
      s4h: 'Kies het advertentieformaat', s4sub: 'Alleen formaten die {platform} en OrivenAI kunnen publiceren worden aangeboden.',
      onlyOne: 'Advertenties voor {platform} in OrivenAI zijn {format}-advertenties, dus dit is voor je gekozen.',
      unavailable: 'Niet beschikbaar',
      advL: 'Geavanceerde instellingen', advSub: 'Optioneel. De standaardinstellingen werken goed voor een eerste advertentie.',
      gtypeL: 'Type Google-advertentie', objL: 'Campagnedoelstelling', objStd: 'Standaarddoelstelling voor je doel',
      adsL: 'Aantal advertenties', groupsL: 'Advertentiegroepen', perL: 'Advertenties per groep',
      adsHelp: 'Met meer advertenties kan het platform verschillende versies testen. Elke extra afbeelding of video kost credits.', adsFixed: 'Dit advertentietype wordt altijd als één advertentie gepubliceerd.',
      s5h: 'Pas je advertentie aan', s5sub: 'Alles hier is optioneel. Sla het over en we gebruiken verstandige standaardwaarden.',
      audL: 'Voor wie is deze advertentie?', audP: 'bijv. Mannen van 25–45 op zoek naar een kwaliteitscadeau', audUse: 'Gebruik: {name}',
      langL: 'Advertentietaal', langProfile: 'Uit je bedrijfsprofiel.', langCountry: 'Voorgesteld op basis van het land van je bedrijf ({country}). Controleer of je klanten deze taal lezen.', langDefault: 'Voorstel. Kies de taal die je klanten lezen.', langUser: 'Door jou gekozen.',
      toneL: 'Toon', toneAuto: 'Laat OrivenAI kiezen', tone_Friendly: 'Vriendelijk', tone_Professional: 'Professioneel', tone_Premium: 'Premium', tone_Playful: 'Speels', tone_Bold: 'Krachtig',
      stylesL: 'Creatieve suggesties',
      style_new: 'Nieuw product', style_season: 'Seizoensactie', style_premium: 'Luxe uitstraling', style_minimal: 'Minimalistisch', style_bold: 'Krachtig en energiek', style_pro: 'Professioneel', style_friendly: 'Vriendelijk',
      notesL: 'Wil je nog iets kwijt?', notesP: 'bijv. Benadruk de gratis gravure en gebruik een luxe, minimalistische stijl.', notesHelp: 'Alleen creatieve richting. Je keuzes in de eerdere stappen gaan altijd voor.',
      moreL: 'Foto’s, inspiratie en merk', photosL: 'Productfoto’s', useOwn: 'Eigen afbeelding gebruiken', showProduct: 'Mijn product laten zien', inspL: 'Geïnspireerd door een advertentie die je mooi vindt', brandL: 'Mijn merkstijl gebruiken',
      researchNote: '{n} bevinding(en) uit je Research sturen deze advertentie.',
      s6h: 'Controleren en maken', s6sub: 'Bekijk je advertentie voordat we hem maken.',
      rvWhat: 'Advertentie voor', rvWhere: 'Platform', rvGoal: 'Doel', rvFormat: 'Formaat', rvType: 'Type Google-advertentie', rvLang: 'Taal', rvAud: 'Voor', rvTone: 'Toon', rvStyle: 'Stijl', rvAds: 'Advertenties', rvOffer: 'Aanbieding', rvWeb: 'Website', rvEdit: 'Wijzigen',
      costL: 'Kosten', credits: '{n} credits', costCopy: 'Advertentietekst {n}', costImg: '{c} × afbeelding ({n} per stuk)', costVid: '{c} × video ({n} per stuk)', costLoading: 'Je credits worden gecontroleerd…', costPending: 'Kies een platform en formaat om de kosten te zien', stagePickPlat: 'Kies een platform',
      freeFirst: 'Je eerste advertentie is gratis.',
      launchHint: 'Budget, targeting en publicatie-instellingen stel je in bij Launch.',
      countryHint: 'Adverteren in: {country} (uit je bedrijfsprofiel). Je kunt dit wijzigen in Launch.', countryNone: 'Je kiest de landen in Launch.',
      whatNext: 'Hierna bekijk je de advertentie en stel je in Launch het budget en de landen in. Niets gaat live zonder jouw bevestiging.',
      create: 'Advertentie maken', createCost: 'Advertentie maken · {n} credits', creating: 'Bezig met maken…',
      errName: 'Voeg de naam van je product of dienst toe.', errDesc: 'Voeg een korte beschrijving toe — één zin is genoeg.', errPlatform: 'Kies waar de advertentie moet draaien.', errGoal: 'Kies wat de advertentie moet bereiken.', errFormat: 'Kies een formaat.',
      nGoalReset: '“{goal}” is niet beschikbaar op {platform}, kies een ander doel.',
      nFormatAuto: 'Het formaat is nu {format}: {reason}', nTypeFormat: '{type} gebruikt {format}-advertenties, dus het formaat is gewijzigd naar {format}.', nObjReset: 'De doelstelling is teruggezet naar de standaard: {reason}',
      platform_google_sub: 'Zoeken, YouTube, Gmail en meer', platform_meta_sub: 'Facebook en Instagram', platform_tiktok_sub: 'Korte verticale video’s', platform_pinterest_sub: 'Gepromote pins',
      platform_google_tag: 'Bereik mensen die zoeken naar producten zoals de jouwe.', platform_meta_tag: 'Bereik klanten op Facebook en Instagram.', platform_tiktok_tag: 'Maak boeiende korte videoadvertenties.', platform_pinterest_tag: 'Bereik mensen die producten en ideeën ontdekken.',
      goal_Sales: 'Meer verkopen', goal_Sales_d: 'Zorg dat mensen bij je kopen.', goal_Traffic: 'Meer websitebezoekers', goal_Traffic_d: 'Breng mensen naar je website.', goal_Leads: 'Leads genereren', goal_Leads_d: 'Krijg aanvragen, offertes of aanmeldingen.', goal_Awareness: 'Meer naamsbekendheid', goal_Awareness_d: 'Laat je bedrijf opvallen.',
      fmt_text: 'Tekst', fmt_text_d: 'Koppen en beschrijvingen, geen afbeelding.', fmt_image: 'Afbeelding', fmt_image_d: 'Een kant-en-klare afbeeldingsadvertentie.', fmt_video: 'Video', fmt_video_d: 'Een korte verticale videoadvertentie.',
      gtype_SEARCH: 'Zoeken', gtype_SEARCH_d: 'Tekstadvertenties in de zoekresultaten van Google.', gtype_PERFORMANCE_MAX: 'Performance Max', gtype_PERFORMANCE_MAX_d: 'Afbeeldingsadvertenties op Zoeken, YouTube, Display, Gmail en Maps.', gtype_DEMAND_GEN: 'Demand Gen', gtype_DEMAND_GEN_d: 'Afbeeldingsadvertenties op YouTube, Discover en Gmail.',
      gnote: '{type} gebruikt ook je bedrijfsnaam en logo uit je bedrijfsprofiel.',
      obj_vc: 'Video Completion', obj_vc_d: 'Optimaliseer voor mensen die je video tot het einde bekijken.',
      r_tiktok_goal_Sales: 'Verkoopcampagnes op TikTok hebben een aankoopgebeurtenis van de TikTok-pixel nodig, die OrivenAI nog niet kan instellen.', r_tiktok_goal_Sales_s: 'Kies “Meer websitebezoekers” op TikTok, of voer een verkoopcampagne uit op Meta of Google.',
      r_tiktok_goal_Leads: 'Leadcampagnes op TikTok gebruiken TikToks eigen formulieren, die OrivenAI nog niet ondersteunt.', r_tiktok_goal_Leads_s: 'Kies “Meer websitebezoekers” op TikTok, of voer een leadcampagne uit op Meta of Google.',
      r_pmax_goal: 'Performance Max is bedoeld voor verkopen en leads.', r_pmax_goal_s: 'Gebruik Demand Gen voor afbeeldingsadvertenties met dit doel, of een tekstadvertentie in Zoeken.',
      r_format_meta_video: 'OrivenAI kan afbeeldingsadvertenties op Meta publiceren, maar nog geen videoadvertenties.', r_format_meta_video_s: 'Gebruik een afbeeldingsadvertentie op Meta, of maak een videoadvertentie voor TikTok of Pinterest.',
      r_format_tiktok_image: 'TikTok-advertenties zijn video’s. Advertenties met alleen een afbeelding draaien niet in de TikTok-feed.', r_format_tiktok_image_s: 'Gebruik een videoadvertentie op TikTok, of een afbeeldingsadvertentie op Meta of Pinterest.',
      r_format_google_video: 'OrivenAI publiceert nog geen videocampagnes (YouTube) op Google.', r_format_google_video_s: 'Gebruik een tekstadvertentie (Zoeken) of een afbeeldingsadvertentie (Demand Gen / Performance Max).',
      r_format_google_text_only: 'Advertenties in Google Zoeken zijn alleen tekst: koppen en beschrijvingen, geen afbeelding.', r_format_google_text_only_s: 'Kies Tekst, of kies een afbeeldingstype voor Google.',
      r_format_google_image_only: 'Dit type Google-advertentie heeft afbeeldingen nodig, niet alleen tekst.', r_format_google_image_only_s: 'Kies Afbeelding, of stap over op Zoeken voor een tekstadvertentie.',
      r_objective_unsupported: 'Deze doelstelling kan OrivenAI nog niet publiceren.', r_objective_unsupported_s: 'Houd de standaarddoelstelling voor je doel.',
      r_objective_video_completion: 'Video Completion vereist een videoadvertentie en het doel “Meer naamsbekendheid”.', r_objective_video_completion_s: 'Kies Video en “Meer naamsbekendheid”, of houd de standaarddoelstelling.',
      c_platform: 'Je notitie noemt een ander platform. De advertentie wordt gemaakt voor {platform} — wijzig dat in stap 2 als je een ander platform bedoelt.', c_budget: 'Budgetten stel je hier niet in. Je kiest en bevestigt het budget in Launch voordat er iets live gaat.', c_targeting: 'Landen en targeting stel je in bij Launch. Beschrijf hier voor wie de advertentie is, dan wordt hij voor hen geschreven.', c_format: 'Het advertentieformaat komt uit stap 4. Je notitie wordt alleen als creatieve richting gebruikt.',
      gen422: 'Deze advertentie kan niet worden gemaakt', genInvalid: 'Deze combinatie kan niet worden gepubliceerd:',
    },
    de: {
      title: 'Anzeige erstellen', subtitle: 'Beantworte ein paar einfache Fragen. Wir schreiben die Anzeige für dich.',
      st1: 'Produkt', st2: 'Plattform', st3: 'Ziel', st4: 'Format', st5: 'Anpassen', st6: 'Prüfen',
      stepOf: 'Schritt {n} von {t}', back: 'Zurück', next: 'Weiter', skip: 'Überspringen', optional: 'optional',
      s1h: 'Wofür möchtest du werben?', s1sub: 'Erzähl uns von deinem Produkt oder deiner Dienstleistung. Einfache Worte sind perfekt.',
      nameL: 'Name des Produkts oder der Dienstleistung', nameP: 'z. B. Handgefertigte Ledergeldbörse',
      descL: 'Kurze Beschreibung', descP: 'z. B. Handgefertigte Ledergeldbörsen aus unserer Amsterdamer Werkstatt, mit kostenloser Namensgravur. Ein schönes Geschenk.', descHelp: 'Was ist es, und warum sollte jemand es haben wollen?',
      webL: 'Website oder Produktseite', webP: 'z. B. deinshop.de/geldboersen', webHelp: 'Wir lesen die Seite, damit die Anzeige dazu passt, und Launch nutzt sie als Zielseite.', webRead: 'Seite lesen', webReading: 'Wird gelesen…', webReadDone: 'Seite gelesen',
      offerL: 'Preis oder Angebot', offerP: 'z. B. 45 €, oder 10 % Rabatt diese Woche', offerHelp: 'Nur echte Preise oder Angebote eintragen — die Anzeige erfindet nie eines.',
      s2h: 'Wo möchtest du werben?', s2sub: 'Wähle eine Plattform. Danach kannst du eine Anzeige für eine andere Plattform erstellen.',
      s3h: 'Was möchtest du erreichen?', s3sub: 'Wir richten das passende Kampagnenziel auf {platform} für dich ein.',
      s4h: 'Anzeigenformat wählen', s4sub: 'Es werden nur Formate angeboten, die {platform} und OrivenAI veröffentlichen können.',
      onlyOne: 'Anzeigen für {platform} in OrivenAI sind {format}-Anzeigen, daher wurde dies für dich ausgewählt.',
      unavailable: 'Nicht verfügbar',
      advL: 'Erweiterte Einstellungen', advSub: 'Optional. Die Standardwerte funktionieren gut für eine erste Anzeige.',
      gtypeL: 'Google-Anzeigentyp', objL: 'Kampagnenziel', objStd: 'Standardziel für dein Ziel',
      adsL: 'Anzahl der Anzeigen', groupsL: 'Anzeigengruppen', perL: 'Anzeigen pro Gruppe',
      adsHelp: 'Mit mehr Anzeigen kann die Plattform verschiedene Versionen testen. Jedes zusätzliche Bild oder Video kostet Credits.', adsFixed: 'Dieser Anzeigentyp wird immer als eine Anzeige veröffentlicht.',
      s5h: 'Anzeige anpassen', s5sub: 'Alles hier ist optional. Überspringe es, und wir verwenden sinnvolle Standardwerte.',
      audL: 'Für wen ist diese Anzeige?', audP: 'z. B. Männer von 25–45, die ein hochwertiges Geschenk suchen', audUse: 'Verwenden: {name}',
      langL: 'Anzeigensprache', langProfile: 'Aus deinem Unternehmensprofil.', langCountry: 'Vorschlag anhand des Landes deines Unternehmens ({country}). Prüfe, ob deine Kunden diese Sprache lesen.', langDefault: 'Vorschlag. Wähle die Sprache, die deine Kunden lesen.', langUser: 'Von dir gewählt.',
      toneL: 'Tonalität', toneAuto: 'OrivenAI wählen lassen', tone_Friendly: 'Freundlich', tone_Professional: 'Professionell', tone_Premium: 'Premium', tone_Playful: 'Verspielt', tone_Bold: 'Mutig',
      stylesL: 'Kreative Vorschläge',
      style_new: 'Neues Produkt', style_season: 'Saisonaktion', style_premium: 'Hochwertiger Look', style_minimal: 'Minimalistisch', style_bold: 'Mutig und energiegeladen', style_pro: 'Professionell', style_friendly: 'Freundlich',
      notesL: 'Sollen wir noch etwas wissen?', notesP: 'z. B. Hebe die kostenlose Gravur hervor und nutze einen hochwertigen, minimalistischen Stil.', notesHelp: 'Nur kreative Richtung. Deine Auswahl in den vorherigen Schritten hat immer Vorrang.',
      moreL: 'Fotos, Inspiration und Marke', photosL: 'Produktfotos', useOwn: 'Eigenes Bild verwenden', showProduct: 'Mein Produkt zeigen', inspL: 'Inspiriert von einer Anzeige, die dir gefällt', brandL: 'Meinen Markenstil verwenden',
      researchNote: '{n} Erkenntnis(se) aus deiner Recherche fließen in diese Anzeige ein.',
      s6h: 'Prüfen und erstellen', s6sub: 'Prüfe deine Anzeige, bevor wir sie erstellen.',
      rvWhat: 'Werbung für', rvWhere: 'Plattform', rvGoal: 'Ziel', rvFormat: 'Format', rvType: 'Google-Anzeigentyp', rvLang: 'Sprache', rvAud: 'Für', rvTone: 'Tonalität', rvStyle: 'Stil', rvAds: 'Anzeigen', rvOffer: 'Angebot', rvWeb: 'Website', rvEdit: 'Ändern',
      costL: 'Kosten', credits: '{n} Credits', costCopy: 'Anzeigentext {n}', costImg: '{c} × Bild (je {n})', costVid: '{c} × Video (je {n})', costLoading: 'Deine Credits werden geprüft…', costPending: 'Wähle Plattform und Format, um die Kosten zu sehen', stagePickPlat: 'Wähle eine Plattform',
      freeFirst: 'Deine erste Anzeige ist kostenlos.',
      launchHint: 'Budget, Targeting und Veröffentlichung legst du in Launch fest.',
      countryHint: 'Werbung in: {country} (aus deinem Unternehmensprofil). Du kannst das in Launch ändern.', countryNone: 'Die Länder wählst du in Launch.',
      whatNext: 'Als Nächstes prüfst du die Anzeige und legst in Launch Budget und Länder fest. Nichts geht ohne deine Bestätigung live.',
      create: 'Anzeige erstellen', createCost: 'Anzeige erstellen · {n} Credits', creating: 'Wird erstellt…',
      errName: 'Gib den Namen deines Produkts oder deiner Dienstleistung ein.', errDesc: 'Füge eine kurze Beschreibung hinzu — ein Satz reicht.', errPlatform: 'Wähle, wo die Anzeige laufen soll.', errGoal: 'Wähle, was die Anzeige erreichen soll.', errFormat: 'Wähle ein Format.',
      nGoalReset: '„{goal}“ ist auf {platform} nicht verfügbar, bitte wähle ein anderes Ziel.',
      nFormatAuto: 'Das Format ist jetzt {format}: {reason}', nTypeFormat: '{type} nutzt {format}-Anzeigen, daher wurde das Format auf {format} geändert.', nObjReset: 'Das Kampagnenziel wurde auf den Standard zurückgesetzt: {reason}',
      platform_google_sub: 'Suche, YouTube, Gmail und mehr', platform_meta_sub: 'Facebook und Instagram', platform_tiktok_sub: 'Kurze Hochformat-Videos', platform_pinterest_sub: 'Gesponserte Pins',
      platform_google_tag: 'Erreiche Menschen, die nach Produkten wie deinen suchen.', platform_meta_tag: 'Erreiche Kunden auf Facebook und Instagram.', platform_tiktok_tag: 'Erstelle packende Kurzvideo-Anzeigen.', platform_pinterest_tag: 'Erreiche Menschen, die Produkte und Ideen entdecken.',
      goal_Sales: 'Mehr Verkäufe', goal_Sales_d: 'Bring Menschen dazu, bei dir zu kaufen.', goal_Traffic: 'Mehr Website-Besucher', goal_Traffic_d: 'Bring Menschen auf deine Website.', goal_Leads: 'Leads gewinnen', goal_Leads_d: 'Erhalte Anfragen, Angebote oder Anmeldungen.', goal_Awareness: 'Bekanntheit steigern', goal_Awareness_d: 'Mach dein Unternehmen bekannt.',
      fmt_text: 'Text', fmt_text_d: 'Überschriften und Beschreibungen, kein Bild.', fmt_image: 'Bild', fmt_image_d: 'Eine fertige Bildanzeige.', fmt_video: 'Video', fmt_video_d: 'Eine kurze Video-Anzeige im Hochformat.',
      gtype_SEARCH: 'Suche', gtype_SEARCH_d: 'Textanzeigen in den Google-Suchergebnissen.', gtype_PERFORMANCE_MAX: 'Performance Max', gtype_PERFORMANCE_MAX_d: 'Bildanzeigen in Suche, YouTube, Display, Gmail und Maps.', gtype_DEMAND_GEN: 'Demand Gen', gtype_DEMAND_GEN_d: 'Bildanzeigen auf YouTube, Discover und Gmail.',
      gnote: '{type} verwendet außerdem deinen Unternehmensnamen und dein Logo aus dem Unternehmensprofil.',
      obj_vc: 'Video Completion', obj_vc_d: 'Optimiere darauf, dass Menschen dein Video bis zum Ende ansehen.',
      r_tiktok_goal_Sales: 'Verkaufskampagnen auf TikTok brauchen ein Kauf-Ereignis des TikTok-Pixels, das OrivenAI noch nicht einrichten kann.', r_tiktok_goal_Sales_s: 'Wähle auf TikTok „Mehr Website-Besucher“ oder schalte eine Verkaufskampagne auf Meta oder Google.',
      r_tiktok_goal_Leads: 'Lead-Kampagnen auf TikTok nutzen TikToks eigene Formulare, die OrivenAI noch nicht unterstützt.', r_tiktok_goal_Leads_s: 'Wähle auf TikTok „Mehr Website-Besucher“ oder schalte eine Lead-Kampagne auf Meta oder Google.',
      r_pmax_goal: 'Performance Max ist für Verkäufe und Leads gedacht.', r_pmax_goal_s: 'Nutze Demand Gen für Bildanzeigen mit diesem Ziel oder eine Textanzeige in der Suche.',
      r_format_meta_video: 'OrivenAI kann Bildanzeigen auf Meta veröffentlichen, aber noch keine Videoanzeigen.', r_format_meta_video_s: 'Nutze eine Bildanzeige auf Meta oder erstelle eine Videoanzeige für TikTok oder Pinterest.',
      r_format_tiktok_image: 'TikTok-Anzeigen sind Videos. Reine Bildanzeigen laufen nicht im TikTok-Feed.', r_format_tiktok_image_s: 'Nutze eine Videoanzeige auf TikTok oder eine Bildanzeige auf Meta oder Pinterest.',
      r_format_google_video: 'OrivenAI veröffentlicht noch keine Google-Videokampagnen (YouTube).', r_format_google_video_s: 'Nutze eine Textanzeige (Suche) oder eine Bildanzeige (Demand Gen / Performance Max).',
      r_format_google_text_only: 'Anzeigen in der Google-Suche sind reiner Text: Überschriften und Beschreibungen, kein Bild.', r_format_google_text_only_s: 'Wähle Text oder einen Bildanzeigentyp für Google.',
      r_format_google_image_only: 'Dieser Google-Anzeigentyp braucht Bilder, nicht nur Text.', r_format_google_image_only_s: 'Wähle Bild oder wechsle für eine Textanzeige zur Suche.',
      r_objective_unsupported: 'Dieses Kampagnenziel kann OrivenAI noch nicht veröffentlichen.', r_objective_unsupported_s: 'Behalte das Standardziel für dein Ziel.',
      r_objective_video_completion: 'Video Completion braucht eine Videoanzeige und das Ziel „Bekanntheit steigern“.', r_objective_video_completion_s: 'Wähle Video und „Bekanntheit steigern“ oder behalte das Standardziel.',
      c_platform: 'Deine Notiz nennt eine andere Plattform. Die Anzeige wird für {platform} erstellt — ändere das in Schritt 2, falls du eine andere Plattform meinst.', c_budget: 'Budgets werden hier nicht festgelegt. Du wählst und bestätigst das Budget in Launch, bevor etwas live geht.', c_targeting: 'Länder und Targeting legst du in Launch fest. Beschreibe hier, für wen die Anzeige ist, dann wird sie für diese Menschen geschrieben.', c_format: 'Das Anzeigenformat kommt aus Schritt 4. Deine Notiz dient nur als kreative Richtung.',
      gen422: 'Diese Anzeige kann nicht erstellt werden', genInvalid: 'Diese Kombination kann nicht veröffentlicht werden:',
    },
    fr: {
      title: 'Créer une annonce', subtitle: 'Répondez à quelques questions simples. Nous rédigeons l’annonce pour vous.',
      st1: 'Produit', st2: 'Plateforme', st3: 'Objectif', st4: 'Format', st5: 'Personnaliser', st6: 'Vérifier',
      stepOf: 'Étape {n} sur {t}', back: 'Retour', next: 'Suivant', skip: 'Passer', optional: 'facultatif',
      s1h: 'Que souhaitez-vous promouvoir ?', s1sub: 'Parlez-nous de votre produit ou service. Des mots simples, c’est parfait.',
      nameL: 'Nom du produit ou du service', nameP: 'ex. Portefeuille en cuir fait main',
      descL: 'Courte description', descP: 'ex. Portefeuilles en cuir faits main dans notre atelier d’Amsterdam, avec gravure du nom offerte. Un beau cadeau.', descHelp: 'Qu’est-ce que c’est, et pourquoi quelqu’un le voudrait-il ?',
      webL: 'Site web ou page produit', webP: 'ex. votreboutique.fr/portefeuilles', webHelp: 'Nous lisons la page pour que l’annonce lui corresponde, et Launch l’utilise comme page de destination.', webRead: 'Lire la page', webReading: 'Lecture…', webReadDone: 'Page lue',
      offerL: 'Prix ou offre spéciale', offerP: 'ex. 45 €, ou -10 % cette semaine', offerHelp: 'N’ajoutez que des prix ou offres réels — l’annonce n’en invente jamais.',
      s2h: 'Où voulez-vous faire de la publicité ?', s2sub: 'Choisissez une plateforme. Vous pourrez ensuite créer une annonce pour une autre plateforme.',
      s3h: 'Que voulez-vous obtenir ?', s3sub: 'Nous configurons le bon objectif de campagne sur {platform} pour vous.',
      s4h: 'Choisissez le format de l’annonce', s4sub: 'Seuls les formats que {platform} et OrivenAI peuvent publier sont proposés.',
      onlyOne: 'Les annonces {platform} créées dans OrivenAI sont des annonces {format}, ce format a donc été choisi pour vous.',
      unavailable: 'Indisponible',
      advL: 'Paramètres avancés', advSub: 'Facultatif. Les réglages par défaut conviennent bien à une première annonce.',
      gtypeL: 'Type d’annonce Google', objL: 'Objectif de campagne', objStd: 'Objectif standard pour votre but',
      adsL: 'Nombre d’annonces', groupsL: 'Groupes d’annonces', perL: 'Annonces par groupe',
      adsHelp: 'Plus d’annonces permettent à la plateforme de tester plusieurs versions. Chaque image ou vidéo supplémentaire coûte des crédits.', adsFixed: 'Ce type d’annonce est toujours publié comme une seule annonce.',
      s5h: 'Personnalisez votre annonce', s5sub: 'Tout est facultatif ici. Passez cette étape et nous utiliserons des valeurs par défaut adaptées.',
      audL: 'À qui s’adresse cette annonce ?', audP: 'ex. Hommes de 25 à 45 ans cherchant un cadeau de qualité', audUse: 'Utiliser : {name}',
      langL: 'Langue de l’annonce', langProfile: 'Depuis votre profil d’entreprise.', langCountry: 'Suggérée d’après le pays de votre entreprise ({country}). Vérifiez que vos clients lisent cette langue.', langDefault: 'Suggestion. Choisissez la langue que lisent vos clients.', langUser: 'Choisie par vous.',
      toneL: 'Ton', toneAuto: 'Laisser OrivenAI choisir', tone_Friendly: 'Chaleureux', tone_Professional: 'Professionnel', tone_Premium: 'Premium', tone_Playful: 'Ludique', tone_Bold: 'Audacieux',
      stylesL: 'Suggestions créatives',
      style_new: 'Nouveau produit', style_season: 'Promotion saisonnière', style_premium: 'Look haut de gamme', style_minimal: 'Minimaliste', style_bold: 'Audacieux et dynamique', style_pro: 'Professionnel', style_friendly: 'Chaleureux',
      notesL: 'Autre chose à savoir ?', notesP: 'ex. Mettez en avant la gravure offerte et utilisez un style haut de gamme et minimaliste.', notesHelp: 'Direction créative uniquement. Vos choix des étapes précédentes priment toujours.',
      moreL: 'Photos, inspiration et marque', photosL: 'Photos du produit', useOwn: 'Utiliser ma propre image', showProduct: 'Montrer mon produit', inspL: 'Inspiré d’une annonce que vous aimez', brandL: 'Utiliser le style de ma marque',
      researchNote: '{n} résultat(s) de votre recherche guideront cette annonce.',
      s6h: 'Vérifier et créer', s6sub: 'Vérifiez votre annonce avant que nous la créions.',
      rvWhat: 'Annonce pour', rvWhere: 'Plateforme', rvGoal: 'Objectif', rvFormat: 'Format', rvType: 'Type d’annonce Google', rvLang: 'Langue', rvAud: 'Pour', rvTone: 'Ton', rvStyle: 'Style', rvAds: 'Annonces', rvOffer: 'Offre', rvWeb: 'Site web', rvEdit: 'Modifier',
      costL: 'Coût', credits: '{n} crédits', costCopy: 'Texte de l’annonce {n}', costImg: '{c} × image ({n} chacune)', costVid: '{c} × vidéo ({n} chacune)', costLoading: 'Vérification de vos crédits…', costPending: 'Choisissez une plateforme et un format pour voir le coût', stagePickPlat: 'Choisissez une plateforme',
      freeFirst: 'Votre première annonce est gratuite.',
      launchHint: 'Le budget, le ciblage et la publication se règlent dans Launch.',
      countryHint: 'Publicité en : {country} (depuis votre profil d’entreprise). Vous pouvez le modifier dans Launch.', countryNone: 'Vous choisissez les pays dans Launch.',
      whatNext: 'Ensuite, vous vérifiez l’annonce, puis définissez le budget et les pays dans Launch. Rien n’est publié sans votre confirmation.',
      create: 'Créer l’annonce', createCost: 'Créer l’annonce · {n} crédits', creating: 'Création…',
      errName: 'Ajoutez le nom de votre produit ou service.', errDesc: 'Ajoutez une courte description — une phrase suffit.', errPlatform: 'Choisissez où diffuser l’annonce.', errGoal: 'Choisissez ce que l’annonce doit obtenir.', errFormat: 'Choisissez un format.',
      nGoalReset: '« {goal} » n’est pas disponible sur {platform}, choisissez un autre objectif.',
      nFormatAuto: 'Le format est maintenant {format} : {reason}', nTypeFormat: '{type} utilise des annonces {format}, le format est donc passé à {format}.', nObjReset: 'L’objectif est revenu au standard : {reason}',
      platform_google_sub: 'Recherche, YouTube, Gmail et plus', platform_meta_sub: 'Facebook et Instagram', platform_tiktok_sub: 'Courtes vidéos verticales', platform_pinterest_sub: 'Épingles sponsorisées',
      platform_google_tag: 'Touchez les personnes qui recherchent des produits comme les vôtres.', platform_meta_tag: 'Touchez vos clients sur Facebook et Instagram.', platform_tiktok_tag: 'Créez des annonces vidéo courtes et captivantes.', platform_pinterest_tag: 'Touchez les personnes qui découvrent des produits et des idées.',
      goal_Sales: 'Plus de ventes', goal_Sales_d: 'Faites acheter les gens chez vous.', goal_Traffic: 'Plus de visiteurs sur le site', goal_Traffic_d: 'Amenez du monde sur votre site.', goal_Leads: 'Générer des prospects', goal_Leads_d: 'Obtenez des demandes, devis ou inscriptions.', goal_Awareness: 'Gagner en notoriété', goal_Awareness_d: 'Faites connaître votre entreprise.',
      fmt_text: 'Texte', fmt_text_d: 'Titres et descriptions, sans image.', fmt_image: 'Image', fmt_image_d: 'Une annonce image prête à l’emploi.', fmt_video: 'Vidéo', fmt_video_d: 'Une courte annonce vidéo verticale.',
      gtype_SEARCH: 'Réseau de Recherche', gtype_SEARCH_d: 'Annonces textuelles dans les résultats de recherche Google.', gtype_PERFORMANCE_MAX: 'Performance Max', gtype_PERFORMANCE_MAX_d: 'Annonces image sur Recherche, YouTube, Display, Gmail et Maps.', gtype_DEMAND_GEN: 'Demand Gen', gtype_DEMAND_GEN_d: 'Annonces image sur YouTube, Discover et Gmail.',
      gnote: '{type} utilise aussi le nom et le logo de votre profil d’entreprise.',
      obj_vc: 'Video Completion', obj_vc_d: 'Optimiser pour que les gens regardent votre vidéo jusqu’au bout.',
      r_tiktok_goal_Sales: 'Les campagnes de ventes TikTok exigent un événement d’achat du Pixel TikTok, qu’OrivenAI ne sait pas encore configurer.', r_tiktok_goal_Sales_s: 'Choisissez « Plus de visiteurs sur le site » sur TikTok, ou lancez une campagne de ventes sur Meta ou Google.',
      r_tiktok_goal_Leads: 'Les campagnes de prospects TikTok utilisent les formulaires de TikTok, qu’OrivenAI ne prend pas encore en charge.', r_tiktok_goal_Leads_s: 'Choisissez « Plus de visiteurs sur le site » sur TikTok, ou lancez une campagne de prospects sur Meta ou Google.',
      r_pmax_goal: 'Performance Max est conçu pour les ventes et les prospects.', r_pmax_goal_s: 'Utilisez Demand Gen pour des annonces image avec cet objectif, ou une annonce textuelle sur le Réseau de Recherche.',
      r_format_meta_video: 'OrivenAI peut publier des annonces image sur Meta, mais pas encore des annonces vidéo.', r_format_meta_video_s: 'Utilisez une annonce image sur Meta, ou créez une annonce vidéo pour TikTok ou Pinterest.',
      r_format_tiktok_image: 'Les annonces TikTok sont des vidéos. Les annonces image seules ne sont pas diffusées dans le fil TikTok.', r_format_tiktok_image_s: 'Utilisez une annonce vidéo sur TikTok, ou une annonce image sur Meta ou Pinterest.',
      r_format_google_video: 'OrivenAI ne publie pas encore de campagnes vidéo Google (YouTube).', r_format_google_video_s: 'Utilisez une annonce textuelle (Recherche) ou une annonce image (Demand Gen / Performance Max).',
      r_format_google_text_only: 'Les annonces du Réseau de Recherche Google sont uniquement textuelles : titres et descriptions, sans image.', r_format_google_text_only_s: 'Choisissez Texte, ou un type d’annonce image pour Google.',
      r_format_google_image_only: 'Ce type d’annonce Google nécessite des images, pas seulement du texte.', r_format_google_image_only_s: 'Choisissez Image, ou passez au Réseau de Recherche pour une annonce textuelle.',
      r_objective_unsupported: 'OrivenAI ne peut pas encore publier cet objectif.', r_objective_unsupported_s: 'Gardez l’objectif standard pour votre but.',
      r_objective_video_completion: 'Video Completion nécessite une annonce vidéo et l’objectif « Gagner en notoriété ».', r_objective_video_completion_s: 'Choisissez Vidéo et « Gagner en notoriété », ou gardez l’objectif standard.',
      c_platform: 'Votre note mentionne une autre plateforme. L’annonce est créée pour {platform} — changez-le à l’étape 2 si vous pensiez à une autre plateforme.', c_budget: 'Le budget ne se règle pas ici. Vous le choisissez et le confirmez dans Launch avant toute mise en ligne.', c_targeting: 'Les pays et le ciblage se règlent dans Launch. Ici, décrivez à qui s’adresse l’annonce et elle sera rédigée pour eux.', c_format: 'Le format de l’annonce vient de l’étape 4. Votre note sert uniquement de direction créative.',
      gen422: 'Cette annonce ne peut pas être créée', genInvalid: 'Cette combinaison ne peut pas être publiée :',
    },
    es: {
      title: 'Crear un anuncio', subtitle: 'Responde unas preguntas sencillas. Nosotros escribimos el anuncio.',
      st1: 'Producto', st2: 'Plataforma', st3: 'Objetivo', st4: 'Formato', st5: 'Personalizar', st6: 'Revisar',
      stepOf: 'Paso {n} de {t}', back: 'Atrás', next: 'Siguiente', skip: 'Omitir', optional: 'opcional',
      s1h: '¿Qué quieres anunciar?', s1sub: 'Cuéntanos sobre tu producto o servicio. Con palabras sencillas es perfecto.',
      nameL: 'Nombre del producto o servicio', nameP: 'p. ej. Cartera de piel hecha a mano',
      descL: 'Descripción breve', descP: 'p. ej. Carteras de piel hechas a mano en nuestro taller de Ámsterdam, con grabado del nombre gratis. Un gran regalo.', descHelp: '¿Qué es y por qué alguien lo querría?',
      webL: 'Sitio web o página del producto', webP: 'p. ej. tutienda.es/carteras', webHelp: 'Leemos la página para que el anuncio encaje con ella, y Launch la usa como página de destino.', webRead: 'Leer página', webReading: 'Leyendo…', webReadDone: 'Página leída',
      offerL: 'Precio u oferta especial', offerP: 'p. ej. 45 €, o 10 % de descuento esta semana', offerHelp: 'Añade solo precios u ofertas reales: el anuncio nunca inventa ninguno.',
      s2h: '¿Dónde quieres anunciarte?', s2sub: 'Elige una plataforma. Después puedes crear un anuncio para otra plataforma.',
      s3h: '¿Qué quieres conseguir?', s3sub: 'Configuramos por ti el objetivo de campaña adecuado en {platform}.',
      s4h: 'Elige el formato del anuncio', s4sub: 'Solo se ofrecen formatos que {platform} y OrivenAI pueden publicar.',
      onlyOne: 'Los anuncios de {platform} en OrivenAI son anuncios de {format}, así que lo hemos seleccionado por ti.',
      unavailable: 'No disponible',
      advL: 'Ajustes avanzados', advSub: 'Opcional. Los valores predeterminados funcionan bien para un primer anuncio.',
      gtypeL: 'Tipo de anuncio de Google', objL: 'Objetivo de campaña', objStd: 'Objetivo estándar para tu meta',
      adsL: 'Número de anuncios', groupsL: 'Grupos de anuncios', perL: 'Anuncios por grupo',
      adsHelp: 'Más anuncios permiten a la plataforma probar distintas versiones. Cada imagen o vídeo adicional cuesta créditos.', adsFixed: 'Este tipo de anuncio siempre se publica como un solo anuncio.',
      s5h: 'Personaliza tu anuncio', s5sub: 'Todo aquí es opcional. Omítelo y usaremos valores razonables.',
      audL: '¿Para quién es este anuncio?', audP: 'p. ej. Hombres de 25 a 45 años que buscan un regalo de calidad', audUse: 'Usar: {name}',
      langL: 'Idioma del anuncio', langProfile: 'Desde tu perfil de empresa.', langCountry: 'Sugerido por el país de tu empresa ({country}). Comprueba que tus clientes leen este idioma.', langDefault: 'Sugerencia. Elige el idioma que leen tus clientes.', langUser: 'Elegido por ti.',
      toneL: 'Tono', toneAuto: 'Dejar que OrivenAI elija', tone_Friendly: 'Cercano', tone_Professional: 'Profesional', tone_Premium: 'Premium', tone_Playful: 'Divertido', tone_Bold: 'Atrevido',
      stylesL: 'Sugerencias creativas',
      style_new: 'Producto nuevo', style_season: 'Promoción de temporada', style_premium: 'Aspecto premium', style_minimal: 'Minimalista', style_bold: 'Atrevido y enérgico', style_pro: 'Profesional', style_friendly: 'Cercano',
      notesL: '¿Algo más que debamos saber?', notesP: 'p. ej. Destaca el grabado gratis y usa un estilo premium y minimalista.', notesHelp: 'Solo dirección creativa. Tus elecciones de los pasos anteriores siempre tienen prioridad.',
      moreL: 'Fotos, inspiración y marca', photosL: 'Fotos del producto', useOwn: 'Usar mi propia imagen', showProduct: 'Mostrar mi producto', inspL: 'Inspirado en un anuncio que te gusta', brandL: 'Usar el estilo de mi marca',
      researchNote: '{n} hallazgo(s) de tu Research guiarán este anuncio.',
      s6h: 'Revisar y crear', s6sub: 'Revisa tu anuncio antes de que lo creemos.',
      rvWhat: 'Anuncio de', rvWhere: 'Plataforma', rvGoal: 'Objetivo', rvFormat: 'Formato', rvType: 'Tipo de anuncio de Google', rvLang: 'Idioma', rvAud: 'Para', rvTone: 'Tono', rvStyle: 'Estilo', rvAds: 'Anuncios', rvOffer: 'Oferta', rvWeb: 'Sitio web', rvEdit: 'Editar',
      costL: 'Coste', credits: '{n} créditos', costCopy: 'Texto del anuncio {n}', costImg: '{c} × imagen ({n} cada una)', costVid: '{c} × vídeo ({n} cada uno)', costLoading: 'Comprobando tus créditos…', costPending: 'Elige una plataforma y un formato para ver el coste', stagePickPlat: 'Elige una plataforma',
      freeFirst: 'Tu primer anuncio es gratis.',
      launchHint: 'El presupuesto, la segmentación y la publicación se configuran en Launch.',
      countryHint: 'Anunciándote en: {country} (desde tu perfil de empresa). Puedes cambiarlo en Launch.', countryNone: 'Los países se eligen en Launch.',
      whatNext: 'A continuación revisas el anuncio y, en Launch, eliges el presupuesto y los países. Nada se publica sin tu confirmación.',
      create: 'Crear anuncio', createCost: 'Crear anuncio · {n} créditos', creating: 'Creando…',
      errName: 'Añade el nombre de tu producto o servicio.', errDesc: 'Añade una descripción breve: basta con una frase.', errPlatform: 'Elige dónde se publicará el anuncio.', errGoal: 'Elige qué debe conseguir el anuncio.', errFormat: 'Elige un formato.',
      nGoalReset: '«{goal}» no está disponible en {platform}; elige otro objetivo.',
      nFormatAuto: 'El formato ahora es {format}: {reason}', nTypeFormat: '{type} usa anuncios de {format}, así que el formato ha cambiado a {format}.', nObjReset: 'El objetivo ha vuelto al estándar: {reason}',
      platform_google_sub: 'Búsqueda, YouTube, Gmail y más', platform_meta_sub: 'Facebook e Instagram', platform_tiktok_sub: 'Vídeos verticales cortos', platform_pinterest_sub: 'Pines promocionados',
      platform_google_tag: 'Llega a quienes buscan productos como los tuyos.', platform_meta_tag: 'Llega a clientes en Facebook e Instagram.', platform_tiktok_tag: 'Crea anuncios de vídeo cortos y atractivos.', platform_pinterest_tag: 'Llega a quienes descubren productos e ideas.',
      goal_Sales: 'Más ventas', goal_Sales_d: 'Consigue que la gente te compre.', goal_Traffic: 'Más visitas a la web', goal_Traffic_d: 'Lleva gente a tu sitio web.', goal_Leads: 'Conseguir clientes potenciales', goal_Leads_d: 'Consigue consultas, presupuestos o registros.', goal_Awareness: 'Aumentar el reconocimiento', goal_Awareness_d: 'Haz que tu negocio se conozca.',
      fmt_text: 'Texto', fmt_text_d: 'Títulos y descripciones, sin imagen.', fmt_image: 'Imagen', fmt_image_d: 'Un anuncio de imagen listo para usar.', fmt_video: 'Vídeo', fmt_video_d: 'Un anuncio de vídeo vertical corto.',
      gtype_SEARCH: 'Búsqueda', gtype_SEARCH_d: 'Anuncios de texto en los resultados de búsqueda de Google.', gtype_PERFORMANCE_MAX: 'Performance Max', gtype_PERFORMANCE_MAX_d: 'Anuncios de imagen en Búsqueda, YouTube, Display, Gmail y Maps.', gtype_DEMAND_GEN: 'Demand Gen', gtype_DEMAND_GEN_d: 'Anuncios de imagen en YouTube, Discover y Gmail.',
      gnote: '{type} también usa el nombre y el logotipo de tu perfil de empresa.',
      obj_vc: 'Video Completion', obj_vc_d: 'Optimizar para que la gente vea tu vídeo hasta el final.',
      r_tiktok_goal_Sales: 'Las campañas de ventas de TikTok necesitan un evento de compra del Píxel de TikTok, que OrivenAI aún no puede configurar.', r_tiktok_goal_Sales_s: 'Elige «Más visitas a la web» en TikTok, o haz una campaña de ventas en Meta o Google.',
      r_tiktok_goal_Leads: 'Las campañas de clientes potenciales de TikTok usan los formularios de TikTok, que OrivenAI aún no admite.', r_tiktok_goal_Leads_s: 'Elige «Más visitas a la web» en TikTok, o haz una campaña de clientes potenciales en Meta o Google.',
      r_pmax_goal: 'Performance Max es para ventas y clientes potenciales.', r_pmax_goal_s: 'Usa Demand Gen para anuncios de imagen con este objetivo, o un anuncio de texto en Búsqueda.',
      r_format_meta_video: 'OrivenAI puede publicar anuncios de imagen en Meta, pero todavía no anuncios de vídeo.', r_format_meta_video_s: 'Usa un anuncio de imagen en Meta, o crea un anuncio de vídeo para TikTok o Pinterest.',
      r_format_tiktok_image: 'Los anuncios de TikTok son vídeos. Los anuncios solo de imagen no se muestran en el feed de TikTok.', r_format_tiktok_image_s: 'Usa un anuncio de vídeo en TikTok, o un anuncio de imagen en Meta o Pinterest.',
      r_format_google_video: 'OrivenAI aún no publica campañas de vídeo de Google (YouTube).', r_format_google_video_s: 'Usa un anuncio de texto (Búsqueda) o de imagen (Demand Gen / Performance Max).',
      r_format_google_text_only: 'Los anuncios de la Búsqueda de Google son solo texto: títulos y descripciones, sin imagen.', r_format_google_text_only_s: 'Elige Texto, o un tipo de anuncio de imagen para Google.',
      r_format_google_image_only: 'Este tipo de anuncio de Google necesita imágenes, no solo texto.', r_format_google_image_only_s: 'Elige Imagen, o cambia a Búsqueda para un anuncio de texto.',
      r_objective_unsupported: 'OrivenAI aún no puede publicar este objetivo.', r_objective_unsupported_s: 'Mantén el objetivo estándar para tu meta.',
      r_objective_video_completion: 'Video Completion necesita un anuncio de vídeo y el objetivo «Aumentar el reconocimiento».', r_objective_video_completion_s: 'Elige Vídeo y «Aumentar el reconocimiento», o mantén el objetivo estándar.',
      c_platform: 'Tu nota menciona otra plataforma. El anuncio se crea para {platform}; cámbialo en el paso 2 si te referías a otra.', c_budget: 'El presupuesto no se fija aquí. Lo eliges y confirmas en Launch antes de que nada se publique.', c_targeting: 'Los países y la segmentación se configuran en Launch. Aquí describe para quién es el anuncio y se escribirá para esas personas.', c_format: 'El formato del anuncio viene del paso 4. Tu nota solo se usa como dirección creativa.',
      gen422: 'Este anuncio no se puede crear', genInvalid: 'Esta combinación no se puede publicar:',
    },
    pt: {
      title: 'Criar um anúncio', subtitle: 'Responda a algumas perguntas simples. Nós escrevemos o anúncio para você.',
      st1: 'Produto', st2: 'Plataforma', st3: 'Objetivo', st4: 'Formato', st5: 'Personalizar', st6: 'Revisar',
      stepOf: 'Passo {n} de {t}', back: 'Voltar', next: 'Seguinte', skip: 'Pular', optional: 'opcional',
      s1h: 'O que você quer anunciar?', s1sub: 'Fale sobre seu produto ou serviço. Palavras simples são perfeitas.',
      nameL: 'Nome do produto ou serviço', nameP: 'ex. Carteira de couro feita à mão',
      descL: 'Descrição curta', descP: 'ex. Carteiras de couro feitas à mão no nosso ateliê em Amsterdã, com gravação do nome grátis. Um ótimo presente.', descHelp: 'O que é, e por que alguém iria querer?',
      webL: 'Site ou página do produto', webP: 'ex. sualoja.com.br/carteiras', webHelp: 'Lemos a página para que o anúncio combine com ela, e o Launch a usa como página de destino.', webRead: 'Ler página', webReading: 'Lendo…', webReadDone: 'Página lida',
      offerL: 'Preço ou oferta especial', offerP: 'ex. €45, ou 10% de desconto esta semana', offerHelp: 'Adicione só preços ou ofertas reais — o anúncio nunca inventa nenhum.',
      s2h: 'Onde você quer anunciar?', s2sub: 'Escolha uma plataforma. Depois você pode criar um anúncio para outra plataforma.',
      s3h: 'O que você quer alcançar?', s3sub: 'Configuramos o objetivo de campanha certo no {platform} para você.',
      s4h: 'Escolha o formato do anúncio', s4sub: 'Só oferecemos formatos que o {platform} e a OrivenAI conseguem publicar.',
      onlyOne: 'Anúncios do {platform} na OrivenAI são anúncios de {format}, então isso foi selecionado para você.',
      unavailable: 'Indisponível',
      advL: 'Configurações avançadas', advSub: 'Opcional. Os padrões funcionam bem para um primeiro anúncio.',
      gtypeL: 'Tipo de anúncio do Google', objL: 'Objetivo da campanha', objStd: 'Objetivo padrão para sua meta',
      adsL: 'Número de anúncios', groupsL: 'Grupos de anúncios', perL: 'Anúncios por grupo',
      adsHelp: 'Mais anúncios permitem que a plataforma teste versões diferentes. Cada imagem ou vídeo extra custa créditos.', adsFixed: 'Este tipo de anúncio é sempre publicado como um único anúncio.',
      s5h: 'Personalize seu anúncio', s5sub: 'Tudo aqui é opcional. Pule e usaremos padrões sensatos.',
      audL: 'Para quem é este anúncio?', audP: 'ex. Homens de 25 a 45 anos procurando um presente de qualidade', audUse: 'Usar: {name}',
      langL: 'Idioma do anúncio', langProfile: 'Do seu perfil da empresa.', langCountry: 'Sugerido pelo país da sua empresa ({country}). Confirme que seus clientes leem esse idioma.', langDefault: 'Sugestão. Escolha o idioma que seus clientes leem.', langUser: 'Escolhido por você.',
      toneL: 'Tom de voz', toneAuto: 'Deixar a OrivenAI escolher', tone_Friendly: 'Amigável', tone_Professional: 'Profissional', tone_Premium: 'Premium', tone_Playful: 'Divertido', tone_Bold: 'Ousado',
      stylesL: 'Sugestões criativas',
      style_new: 'Produto novo', style_season: 'Promoção sazonal', style_premium: 'Visual premium', style_minimal: 'Minimalista', style_bold: 'Ousado e enérgico', style_pro: 'Profissional', style_friendly: 'Amigável',
      notesL: 'Mais alguma coisa que devemos saber?', notesP: 'ex. Destaque a gravação grátis e use um estilo premium e minimalista.', notesHelp: 'Só direção criativa. Suas escolhas nos passos anteriores sempre vêm primeiro.',
      moreL: 'Fotos, inspiração e marca', photosL: 'Fotos do produto', useOwn: 'Usar minha própria imagem', showProduct: 'Mostrar meu produto', inspL: 'Inspirado em um anúncio de que você gosta', brandL: 'Usar o estilo da minha marca',
      researchNote: '{n} descoberta(s) da sua pesquisa vão orientar este anúncio.',
      s6h: 'Revisar e criar', s6sub: 'Confira seu anúncio antes de criá-lo.',
      rvWhat: 'Anúncio de', rvWhere: 'Plataforma', rvGoal: 'Objetivo', rvFormat: 'Formato', rvType: 'Tipo de anúncio do Google', rvLang: 'Idioma', rvAud: 'Para', rvTone: 'Tom', rvStyle: 'Estilo', rvAds: 'Anúncios', rvOffer: 'Oferta', rvWeb: 'Site', rvEdit: 'Editar',
      costL: 'Custo', credits: '{n} créditos', costCopy: 'Texto do anúncio {n}', costImg: '{c} × imagem ({n} cada)', costVid: '{c} × vídeo ({n} cada)', costLoading: 'Verificando seus créditos…', costPending: 'Escolha uma plataforma e um formato para ver o custo', stagePickPlat: 'Escolha uma plataforma',
      freeFirst: 'Seu primeiro anúncio é grátis.',
      launchHint: 'Orçamento, segmentação e publicação são configurados no Launch.',
      countryHint: 'Anunciando em: {country} (do seu perfil da empresa). Você pode alterar isso no Launch.', countryNone: 'Você escolhe os países no Launch.',
      whatNext: 'Em seguida, você revisa o anúncio e define o orçamento e os países no Launch. Nada é publicado sem sua confirmação.',
      create: 'Criar anúncio', createCost: 'Criar anúncio · {n} créditos', creating: 'Criando…',
      errName: 'Adicione o nome do seu produto ou serviço.', errDesc: 'Adicione uma descrição curta — uma frase basta.', errPlatform: 'Escolha onde o anúncio vai rodar.', errGoal: 'Escolha o que o anúncio deve alcançar.', errFormat: 'Escolha um formato.',
      nGoalReset: '“{goal}” não está disponível no {platform}; escolha outro objetivo.',
      nFormatAuto: 'O formato agora é {format}: {reason}', nTypeFormat: '{type} usa anúncios de {format}, então o formato mudou para {format}.', nObjReset: 'O objetivo voltou ao padrão: {reason}',
      platform_google_sub: 'Pesquisa, YouTube, Gmail e mais', platform_meta_sub: 'Facebook e Instagram', platform_tiktok_sub: 'Vídeos verticais curtos', platform_pinterest_sub: 'Pins promovidos',
      platform_google_tag: 'Alcance quem procura produtos como os seus.', platform_meta_tag: 'Alcance clientes no Facebook e no Instagram.', platform_tiktok_tag: 'Crie anúncios em vídeo curtos e envolventes.', platform_pinterest_tag: 'Alcance quem está descobrindo produtos e ideias.',
      goal_Sales: 'Mais vendas', goal_Sales_d: 'Faça as pessoas comprarem de você.', goal_Traffic: 'Mais visitantes no site', goal_Traffic_d: 'Leve pessoas ao seu site.', goal_Leads: 'Gerar leads', goal_Leads_d: 'Receba pedidos, orçamentos ou cadastros.', goal_Awareness: 'Aumentar o reconhecimento', goal_Awareness_d: 'Faça sua empresa ser notada.',
      fmt_text: 'Texto', fmt_text_d: 'Títulos e descrições, sem imagem.', fmt_image: 'Imagem', fmt_image_d: 'Um anúncio de imagem pronto.', fmt_video: 'Vídeo', fmt_video_d: 'Um anúncio curto em vídeo vertical.',
      gtype_SEARCH: 'Pesquisa', gtype_SEARCH_d: 'Anúncios de texto nos resultados de pesquisa do Google.', gtype_PERFORMANCE_MAX: 'Performance Max', gtype_PERFORMANCE_MAX_d: 'Anúncios de imagem na Pesquisa, YouTube, Display, Gmail e Maps.', gtype_DEMAND_GEN: 'Demand Gen', gtype_DEMAND_GEN_d: 'Anúncios de imagem no YouTube, Discover e Gmail.',
      gnote: '{type} também usa o nome e o logotipo do seu perfil da empresa.',
      obj_vc: 'Video Completion', obj_vc_d: 'Otimizar para pessoas assistirem ao seu vídeo até o fim.',
      r_tiktok_goal_Sales: 'Campanhas de vendas no TikTok precisam de um evento de compra do Pixel do TikTok, que a OrivenAI ainda não consegue configurar.', r_tiktok_goal_Sales_s: 'Escolha “Mais visitantes no site” no TikTok, ou faça uma campanha de vendas no Meta ou no Google.',
      r_tiktok_goal_Leads: 'Campanhas de leads no TikTok usam os formulários do próprio TikTok, que a OrivenAI ainda não suporta.', r_tiktok_goal_Leads_s: 'Escolha “Mais visitantes no site” no TikTok, ou faça uma campanha de leads no Meta ou no Google.',
      r_pmax_goal: 'Performance Max é para vendas e leads.', r_pmax_goal_s: 'Use Demand Gen para anúncios de imagem com este objetivo, ou um anúncio de texto na Pesquisa.',
      r_format_meta_video: 'A OrivenAI consegue publicar anúncios de imagem no Meta, mas ainda não anúncios em vídeo.', r_format_meta_video_s: 'Use um anúncio de imagem no Meta, ou crie um anúncio em vídeo para TikTok ou Pinterest.',
      r_format_tiktok_image: 'Anúncios do TikTok são vídeos. Anúncios só de imagem não aparecem no feed do TikTok.', r_format_tiktok_image_s: 'Use um anúncio em vídeo no TikTok, ou um anúncio de imagem no Meta ou Pinterest.',
      r_format_google_video: 'A OrivenAI ainda não publica campanhas de vídeo do Google (YouTube).', r_format_google_video_s: 'Use um anúncio de texto (Pesquisa) ou de imagem (Demand Gen / Performance Max).',
      r_format_google_text_only: 'Anúncios da Pesquisa do Google são só texto: títulos e descrições, sem imagem.', r_format_google_text_only_s: 'Escolha Texto, ou um tipo de anúncio de imagem para o Google.',
      r_format_google_image_only: 'Este tipo de anúncio do Google precisa de imagens, não só texto.', r_format_google_image_only_s: 'Escolha Imagem, ou mude para Pesquisa para um anúncio de texto.',
      r_objective_unsupported: 'A OrivenAI ainda não consegue publicar este objetivo.', r_objective_unsupported_s: 'Mantenha o objetivo padrão para sua meta.',
      r_objective_video_completion: 'Video Completion precisa de um anúncio em vídeo e do objetivo “Aumentar o reconhecimento”.', r_objective_video_completion_s: 'Escolha Vídeo e “Aumentar o reconhecimento”, ou mantenha o objetivo padrão.',
      c_platform: 'Sua nota menciona outra plataforma. O anúncio é criado para {platform} — mude isso no passo 2 se quis dizer outra plataforma.', c_budget: 'O orçamento não é definido aqui. Você escolhe e confirma o orçamento no Launch antes de qualquer publicação.', c_targeting: 'Países e segmentação são definidos no Launch. Aqui, descreva para quem é o anúncio e ele será escrito para essas pessoas.', c_format: 'O formato do anúncio vem do passo 4. Sua nota é usada só como direção criativa.',
      gen422: 'Este anúncio não pode ser criado', genInvalid: 'Esta combinação não pode ser publicada:',
    },
  };
  // Final polish pass — price, special offer, website messages, image
  // source, ad quantity and the live Stage (same six languages).
  var STR_MORE = {
    en: {
      priceL: 'Product price', priceHelp: 'Leave empty to keep the price out of the ad.', errPrice: 'Enter a price such as 29.99 — numbers only, no minus sign.', curSugg: 'Currency suggested from your business country — check it’s the one you sell in.', curLocale: 'Currency suggested from your browser — check it’s the one you sell in.',
      offerL: 'Special offer', offerP: 'e.g. Free shipping this weekend', offerHelp: 'Only real offers — the ad never invents a discount or promotion.',
      webOk: 'Page read: {title}', webOkPlain: 'Page read.', webOptional: 'The website is optional — you can continue without it.',
      webErrInvalid: 'This doesn’t look like a website address. Check it, for example yourshop.com.', webErrDns: 'We couldn’t open this website. Please check the address and try again.', webErrHttp: 'This page couldn’t be opened — it may not exist. Check the address.', webErrTimeout: 'The website didn’t respond. Try again in a moment.', webErrBlocked: 'We can’t read this address. Use the public address of your website.', webErrContent: 'We couldn’t read the content of this page.',
      imgSrcL: 'How would you like to create your ad image?', src_ai: 'Generate with AI', src_ai_d: 'Let OrivenAI create a new image for your advertisement.', src_own: 'Use my own image', src_own_d: 'Upload your own image and let OrivenAI create the ad copy.',
      upChoose: 'Choose image', upDrop: 'or drag it here', upReq: 'JPG or PNG · up to 8 MB · at least 600 × 314 pixels', upReplace: 'Replace', upRemove: 'Remove', upUploading: 'Uploading…', upAdd: 'Add another image',
      upPerAd: 'One image is enough: it’s used for all {n} ads. Add up to {max} to give the ads different images.', upPmax: 'Performance Max shows images as landscape (1.91:1), square (1:1) and portrait (4:5). Add one image, or one in each shape.', upExtra: 'Only the first {max} image(s) are used for this ad.',
      img_image_type: 'This file type isn’t supported. Use a JPG or PNG image.', img_image_size: 'This image is larger than 8 MB. Use a smaller file.', img_image_read: 'This image couldn’t be read. Try a different file.', img_image_small: 'This image is {w} × {h} pixels. {platform} needs at least 600 × 314 pixels — use a larger image.', img_auth: 'Sign in to upload your image.', img_upload: 'The upload didn’t work. Please try again.',
      img_crop_google: 'Google needs a {shapes} image for this ad type. When you publish, OrivenAI centre-crops your image to that shape — keep the important part in the middle.', shape_landscape: 'landscape (1.91:1)', shape_square: 'square (1:1)', shape_portrait: 'portrait (4:5)', and: 'and',
      img_meta_ratio: 'Meta shows feed images between 1.91:1 (wide) and 4:5 (tall), so Meta may crop this image in some placements.', img_pin_wide: 'Pins look best tall (2:3). A wide image shows smaller in the Pinterest feed.', img_pin_tall: 'Pinterest cuts off Pins taller than 1:2.1 in the feed. Use a less tall image if the bottom matters.',
      errOwnNeed: 'Upload your image, or choose “Generate with AI”.', errOwnBusy: 'Wait until your image has finished uploading.',
      qL: 'Number of ads', q_adSet_g: 'Ad sets', q_adSet_a: 'Ads per ad set', q_adGroup_g: 'Ad groups', q_adGroup_a: 'Ads per ad group', qTotal: 'Total: {n} ads', qTotal1: 'Total: 1 ad',
      qHelpImg: 'More ads let {platform} test different versions. Each ad gets its own AI image ({c} credits each).', qHelpOwn: 'Your own images are used for these ads, so extra ads cost no image credits.', qHelpText: 'Search ads are text only, so extra ads cost no extra credits.', qHelpVid: 'Each ad gets its own AI video ({c} credits each).', qHelpPinVid: 'All ads use the same video, so extra ads cost no extra credits.',
      qFixedPmax: 'Performance Max always publishes as one asset group: Google combines your images and text into ads automatically.', qFixedDg: 'Demand Gen publishes as one ad group with one image ad.',
      rvPrice: 'Price', rvOffer: 'Special offer', rvImg: 'Image', rvImgAi: 'Generated with AI', rvImgOwn: 'Your own image ({n})', rvAdsSet: '{g} ad sets × {a} ads = {n} ads', rvAdsGrp: '{g} ad groups × {a} ads = {n} ads',
      costOwn: '{c} × your own image (0 credits)',
      stEyebrow: 'Creative Stage', stReady: 'Ready to create', stNext: 'Next: {step}', stNoName: 'Your product', stAiImg: 'The AI image is created when you create the ad.', stOwnNone: 'Upload your image in step 4.', stVideo: 'The AI video is created when you create the ad.', stText: 'Preview from your answers. The final headlines and descriptions are written when you create the ad.', stPickFormat: 'Choose a format in step 4.', stAds: '{n} ads', stAd1: '1 ad', stGenerated: 'Generated', stSponsored: 'Sponsored', stNotes: 'Notes', stUploading: 'Uploading…',
    },
    nl: {
      priceL: 'Productprijs', priceHelp: 'Laat leeg om de prijs niet in de advertentie te noemen.', errPrice: 'Vul een prijs in zoals 29,99 — alleen cijfers, geen minteken.', curSugg: 'Valuta voorgesteld op basis van je bedrijfsland — controleer of je in deze valuta verkoopt.', curLocale: 'Valuta voorgesteld op basis van je browser — controleer of je in deze valuta verkoopt.',
      offerL: 'Speciale aanbieding', offerP: 'bijv. Gratis verzending dit weekend', offerHelp: 'Alleen echte aanbiedingen — de advertentie verzint nooit een korting of actie.',
      webOk: 'Pagina gelezen: {title}', webOkPlain: 'Pagina gelezen.', webOptional: 'De website is optioneel — je kunt ook zonder doorgaan.',
      webErrInvalid: 'Dit lijkt geen websiteadres. Controleer het, bijvoorbeeld jouwwinkel.nl.', webErrDns: 'We konden deze website niet openen. Controleer het adres en probeer het opnieuw.', webErrHttp: 'Deze pagina kon niet worden geopend — misschien bestaat ze niet. Controleer het adres.', webErrTimeout: 'De website reageerde niet. Probeer het zo opnieuw.', webErrBlocked: 'Dit adres kunnen we niet lezen. Gebruik het openbare adres van je website.', webErrContent: 'We konden de inhoud van deze pagina niet lezen.',
      imgSrcL: 'Hoe wil je de afbeelding voor je advertentie maken?', src_ai: 'Genereren met AI', src_ai_d: 'Laat OrivenAI een nieuwe afbeelding voor je advertentie maken.', src_own: 'Mijn eigen afbeelding gebruiken', src_own_d: 'Upload je eigen afbeelding en laat OrivenAI de advertentietekst schrijven.',
      upChoose: 'Afbeelding kiezen', upDrop: 'of sleep hem hierheen', upReq: 'JPG of PNG · max. 8 MB · minstens 600 × 314 pixels', upReplace: 'Vervangen', upRemove: 'Verwijderen', upUploading: 'Uploaden…', upAdd: 'Nog een afbeelding toevoegen',
      upPerAd: 'Eén afbeelding is genoeg: die wordt voor alle {n} advertenties gebruikt. Voeg er tot {max} toe om de advertenties verschillende afbeeldingen te geven.', upPmax: 'Performance Max toont afbeeldingen liggend (1,91:1), vierkant (1:1) en staand (4:5). Voeg één afbeelding toe, of één per vorm.', upExtra: 'Alleen de eerste {max} afbeelding(en) worden voor deze advertentie gebruikt.',
      img_image_type: 'Dit bestandstype wordt niet ondersteund. Gebruik een JPG- of PNG-afbeelding.', img_image_size: 'Deze afbeelding is groter dan 8 MB. Gebruik een kleiner bestand.', img_image_read: 'Deze afbeelding kon niet worden gelezen. Probeer een ander bestand.', img_image_small: 'Deze afbeelding is {w} × {h} pixels. {platform} heeft minstens 600 × 314 pixels nodig — gebruik een grotere afbeelding.', img_auth: 'Log in om je afbeelding te uploaden.', img_upload: 'Het uploaden is niet gelukt. Probeer het opnieuw.',
      img_crop_google: 'Google heeft voor dit advertentietype een {shapes} afbeelding nodig. Bij het publiceren snijdt OrivenAI je afbeelding vanuit het midden bij tot die vorm — houd het belangrijkste in het midden.', shape_landscape: 'liggende (1,91:1)', shape_square: 'vierkante (1:1)', shape_portrait: 'staande (4:5)', and: 'en',
      img_meta_ratio: 'Meta toont feedafbeeldingen tussen 1,91:1 (breed) en 4:5 (hoog), dus Meta kan deze afbeelding in sommige plaatsingen bijsnijden.', img_pin_wide: 'Pins zien er het best uit als ze staand zijn (2:3). Een brede afbeelding wordt kleiner getoond in de Pinterest-feed.', img_pin_tall: 'Pinterest snijdt Pins die hoger zijn dan 1:2,1 af in de feed. Gebruik een minder hoge afbeelding als de onderkant belangrijk is.',
      errOwnNeed: 'Upload je afbeelding, of kies “Genereren met AI”.', errOwnBusy: 'Wacht tot je afbeelding klaar is met uploaden.',
      qL: 'Aantal advertenties', q_adSet_g: 'Advertentiesets', q_adSet_a: 'Advertenties per set', q_adGroup_g: 'Advertentiegroepen', q_adGroup_a: 'Advertenties per groep', qTotal: 'Totaal: {n} advertenties', qTotal1: 'Totaal: 1 advertentie',
      qHelpImg: 'Met meer advertenties kan {platform} verschillende versies testen. Elke advertentie krijgt een eigen AI-afbeelding ({c} credits per stuk).', qHelpOwn: 'Je eigen afbeeldingen worden voor deze advertenties gebruikt, dus extra advertenties kosten geen afbeeldingscredits.', qHelpText: 'Zoekadvertenties zijn alleen tekst, dus extra advertenties kosten geen extra credits.', qHelpVid: 'Elke advertentie krijgt een eigen AI-video ({c} credits per stuk).', qHelpPinVid: 'Alle advertenties gebruiken dezelfde video, dus extra advertenties kosten geen extra credits.',
      qFixedPmax: 'Performance Max wordt altijd als één assetgroep gepubliceerd: Google combineert je afbeeldingen en teksten automatisch tot advertenties.', qFixedDg: 'Demand Gen wordt gepubliceerd als één advertentiegroep met één afbeeldingsadvertentie.',
      rvPrice: 'Prijs', rvOffer: 'Speciale aanbieding', rvImg: 'Afbeelding', rvImgAi: 'Gegenereerd met AI', rvImgOwn: 'Je eigen afbeelding ({n})', rvAdsSet: '{g} advertentiesets × {a} advertenties = {n} advertenties', rvAdsGrp: '{g} advertentiegroepen × {a} advertenties = {n} advertenties',
      costOwn: '{c} × je eigen afbeelding (0 credits)',
      stEyebrow: 'Creative Stage', stReady: 'Klaar om te maken', stNext: 'Volgende: {step}', stNoName: 'Je product', stAiImg: 'De AI-afbeelding wordt gemaakt wanneer je de advertentie maakt.', stOwnNone: 'Upload je afbeelding in stap 4.', stVideo: 'De AI-video wordt gemaakt wanneer je de advertentie maakt.', stText: 'Voorbeeld op basis van je antwoorden. De definitieve koppen en beschrijvingen worden geschreven wanneer je de advertentie maakt.', stPickFormat: 'Kies een formaat in stap 4.', stAds: '{n} advertenties', stAd1: '1 advertentie', stGenerated: 'Gegenereerd', stSponsored: 'Gesponsord', stNotes: 'Notities', stUploading: 'Uploaden…',
    },
    de: {
      priceL: 'Produktpreis', priceHelp: 'Leer lassen, damit der Preis nicht in der Anzeige steht.', errPrice: 'Gib einen Preis wie 29,99 ein — nur Ziffern, kein Minuszeichen.', curSugg: 'Währung anhand deines Unternehmenslandes vorgeschlagen — prüfe, ob du in dieser Währung verkaufst.', curLocale: 'Währung anhand deines Browsers vorgeschlagen — prüfe, ob du in dieser Währung verkaufst.',
      offerL: 'Sonderangebot', offerP: 'z. B. Kostenloser Versand an diesem Wochenende', offerHelp: 'Nur echte Angebote — die Anzeige erfindet nie einen Rabatt oder eine Aktion.',
      webOk: 'Seite gelesen: {title}', webOkPlain: 'Seite gelesen.', webOptional: 'Die Website ist optional — du kannst auch ohne sie weitermachen.',
      webErrInvalid: 'Das sieht nicht nach einer Website-Adresse aus. Prüfe sie, zum Beispiel deinshop.de.', webErrDns: 'Wir konnten diese Website nicht öffnen. Bitte prüfe die Adresse und versuche es erneut.', webErrHttp: 'Diese Seite konnte nicht geöffnet werden — vielleicht existiert sie nicht. Prüfe die Adresse.', webErrTimeout: 'Die Website hat nicht geantwortet. Versuche es gleich noch einmal.', webErrBlocked: 'Diese Adresse können wir nicht lesen. Verwende die öffentliche Adresse deiner Website.', webErrContent: 'Wir konnten den Inhalt dieser Seite nicht lesen.',
      imgSrcL: 'Wie möchtest du das Bild für deine Anzeige erstellen?', src_ai: 'Mit KI erstellen', src_ai_d: 'OrivenAI erstellt ein neues Bild für deine Anzeige.', src_own: 'Eigenes Bild verwenden', src_own_d: 'Lade dein eigenes Bild hoch und OrivenAI schreibt den Anzeigentext.',
      upChoose: 'Bild auswählen', upDrop: 'oder hierher ziehen', upReq: 'JPG oder PNG · bis 8 MB · mindestens 600 × 314 Pixel', upReplace: 'Ersetzen', upRemove: 'Entfernen', upUploading: 'Wird hochgeladen…', upAdd: 'Weiteres Bild hinzufügen',
      upPerAd: 'Ein Bild reicht: Es wird für alle {n} Anzeigen verwendet. Füge bis zu {max} hinzu, um den Anzeigen verschiedene Bilder zu geben.', upPmax: 'Performance Max zeigt Bilder im Querformat (1,91:1), quadratisch (1:1) und im Hochformat (4:5). Füge ein Bild hinzu oder eines pro Format.', upExtra: 'Nur die ersten {max} Bild(er) werden für diese Anzeige verwendet.',
      img_image_type: 'Dieser Dateityp wird nicht unterstützt. Verwende ein JPG- oder PNG-Bild.', img_image_size: 'Dieses Bild ist größer als 8 MB. Verwende eine kleinere Datei.', img_image_read: 'Dieses Bild konnte nicht gelesen werden. Versuche eine andere Datei.', img_image_small: 'Dieses Bild hat {w} × {h} Pixel. {platform} braucht mindestens 600 × 314 Pixel — verwende ein größeres Bild.', img_auth: 'Melde dich an, um dein Bild hochzuladen.', img_upload: 'Das Hochladen hat nicht geklappt. Bitte versuche es erneut.',
      img_crop_google: 'Google braucht für diesen Anzeigentyp ein Bild im Format {shapes}. Beim Veröffentlichen schneidet OrivenAI dein Bild von der Mitte aus auf dieses Format zu — halte das Wichtigste in der Mitte.', shape_landscape: 'Querformat (1,91:1)', shape_square: 'quadratisch (1:1)', shape_portrait: 'Hochformat (4:5)', and: 'und',
      img_meta_ratio: 'Meta zeigt Feed-Bilder zwischen 1,91:1 (breit) und 4:5 (hoch), daher kann Meta dieses Bild in manchen Platzierungen zuschneiden.', img_pin_wide: 'Pins wirken im Hochformat (2:3) am besten. Ein breites Bild wird im Pinterest-Feed kleiner angezeigt.', img_pin_tall: 'Pinterest schneidet Pins, die höher als 1:2,1 sind, im Feed ab. Verwende ein weniger hohes Bild, wenn der untere Teil wichtig ist.',
      errOwnNeed: 'Lade dein Bild hoch oder wähle „Mit KI erstellen“.', errOwnBusy: 'Warte, bis dein Bild fertig hochgeladen ist.',
      qL: 'Anzahl der Anzeigen', q_adSet_g: 'Anzeigengruppen (Ad Sets)', q_adSet_a: 'Anzeigen pro Ad Set', q_adGroup_g: 'Anzeigengruppen', q_adGroup_a: 'Anzeigen pro Gruppe', qTotal: 'Gesamt: {n} Anzeigen', qTotal1: 'Gesamt: 1 Anzeige',
      qHelpImg: 'Mit mehr Anzeigen kann {platform} verschiedene Versionen testen. Jede Anzeige bekommt ein eigenes KI-Bild ({c} Credits pro Bild).', qHelpOwn: 'Für diese Anzeigen werden deine eigenen Bilder verwendet, daher kosten zusätzliche Anzeigen keine Bild-Credits.', qHelpText: 'Suchanzeigen bestehen nur aus Text, daher kosten zusätzliche Anzeigen keine zusätzlichen Credits.', qHelpVid: 'Jede Anzeige bekommt ein eigenes KI-Video ({c} Credits pro Video).', qHelpPinVid: 'Alle Anzeigen verwenden dasselbe Video, daher kosten zusätzliche Anzeigen keine zusätzlichen Credits.',
      qFixedPmax: 'Performance Max wird immer als eine Asset-Gruppe veröffentlicht: Google kombiniert deine Bilder und Texte automatisch zu Anzeigen.', qFixedDg: 'Demand Gen wird als eine Anzeigengruppe mit einer Bildanzeige veröffentlicht.',
      rvPrice: 'Preis', rvOffer: 'Sonderangebot', rvImg: 'Bild', rvImgAi: 'Mit KI erstellt', rvImgOwn: 'Dein eigenes Bild ({n})', rvAdsSet: '{g} Ad Sets × {a} Anzeigen = {n} Anzeigen', rvAdsGrp: '{g} Anzeigengruppen × {a} Anzeigen = {n} Anzeigen',
      costOwn: '{c} × dein eigenes Bild (0 Credits)',
      stEyebrow: 'Creative Stage', stReady: 'Bereit zum Erstellen', stNext: 'Als Nächstes: {step}', stNoName: 'Dein Produkt', stAiImg: 'Das KI-Bild wird erstellt, wenn du die Anzeige erstellst.', stOwnNone: 'Lade dein Bild in Schritt 4 hoch.', stVideo: 'Das KI-Video wird erstellt, wenn du die Anzeige erstellst.', stText: 'Vorschau aus deinen Antworten. Die endgültigen Überschriften und Beschreibungen werden geschrieben, wenn du die Anzeige erstellst.', stPickFormat: 'Wähle in Schritt 4 ein Format.', stAds: '{n} Anzeigen', stAd1: '1 Anzeige', stGenerated: 'Erstellt', stSponsored: 'Gesponsert', stNotes: 'Notizen', stUploading: 'Wird hochgeladen…',
    },
    fr: {
      priceL: 'Prix du produit', priceHelp: 'Laissez vide pour ne pas mentionner le prix dans l’annonce.', errPrice: 'Saisissez un prix comme 29,99 — uniquement des chiffres, sans signe moins.', curSugg: 'Devise suggérée d’après le pays de votre entreprise — vérifiez que c’est celle dans laquelle vous vendez.', curLocale: 'Devise suggérée d’après votre navigateur — vérifiez que c’est celle dans laquelle vous vendez.',
      offerL: 'Offre spéciale', offerP: 'ex. Livraison gratuite ce week-end', offerHelp: 'Uniquement des offres réelles — l’annonce n’invente jamais de réduction ni de promotion.',
      webOk: 'Page lue : {title}', webOkPlain: 'Page lue.', webOptional: 'Le site web est facultatif — vous pouvez continuer sans.',
      webErrInvalid: 'Cela ne ressemble pas à une adresse de site web. Vérifiez-la, par exemple votreboutique.fr.', webErrDns: 'Nous n’avons pas pu ouvrir ce site web. Vérifiez l’adresse et réessayez.', webErrHttp: 'Cette page n’a pas pu être ouverte — elle n’existe peut-être pas. Vérifiez l’adresse.', webErrTimeout: 'Le site web n’a pas répondu. Réessayez dans un instant.', webErrBlocked: 'Nous ne pouvons pas lire cette adresse. Utilisez l’adresse publique de votre site.', webErrContent: 'Nous n’avons pas pu lire le contenu de cette page.',
      imgSrcL: 'Comment voulez-vous créer l’image de votre annonce ?', src_ai: 'Générer avec l’IA', src_ai_d: 'OrivenAI crée une nouvelle image pour votre annonce.', src_own: 'Utiliser ma propre image', src_own_d: 'Importez votre propre image et OrivenAI rédige le texte de l’annonce.',
      upChoose: 'Choisir une image', upDrop: 'ou glissez-la ici', upReq: 'JPG ou PNG · 8 Mo max. · au moins 600 × 314 pixels', upReplace: 'Remplacer', upRemove: 'Supprimer', upUploading: 'Importation…', upAdd: 'Ajouter une autre image',
      upPerAd: 'Une image suffit : elle est utilisée pour les {n} annonces. Ajoutez-en jusqu’à {max} pour donner des images différentes aux annonces.', upPmax: 'Performance Max affiche les images en paysage (1,91:1), carré (1:1) et portrait (4:5). Ajoutez une image, ou une par format.', upExtra: 'Seule(s) la/les {max} première(s) image(s) est/sont utilisée(s) pour cette annonce.',
      img_image_type: 'Ce type de fichier n’est pas pris en charge. Utilisez une image JPG ou PNG.', img_image_size: 'Cette image dépasse 8 Mo. Utilisez un fichier plus petit.', img_image_read: 'Cette image n’a pas pu être lue. Essayez un autre fichier.', img_image_small: 'Cette image fait {w} × {h} pixels. {platform} demande au moins 600 × 314 pixels — utilisez une image plus grande.', img_auth: 'Connectez-vous pour importer votre image.', img_upload: 'L’importation a échoué. Veuillez réessayer.',
      img_crop_google: 'Google a besoin d’une image au format {shapes} pour ce type d’annonce. À la publication, OrivenAI recadre votre image depuis le centre à ce format — gardez l’essentiel au milieu.', shape_landscape: 'paysage (1,91:1)', shape_square: 'carré (1:1)', shape_portrait: 'portrait (4:5)', and: 'et',
      img_meta_ratio: 'Meta affiche les images du fil entre 1,91:1 (large) et 4:5 (haut) ; Meta peut donc recadrer cette image dans certains emplacements.', img_pin_wide: 'Les épingles rendent mieux en portrait (2:3). Une image large s’affiche plus petite dans le fil Pinterest.', img_pin_tall: 'Pinterest coupe dans le fil les épingles plus hautes que 1:2,1. Utilisez une image moins haute si le bas compte.',
      errOwnNeed: 'Importez votre image, ou choisissez « Générer avec l’IA ».', errOwnBusy: 'Attendez la fin de l’importation de votre image.',
      qL: 'Nombre d’annonces', q_adSet_g: 'Ensembles de publicités', q_adSet_a: 'Annonces par ensemble', q_adGroup_g: 'Groupes d’annonces', q_adGroup_a: 'Annonces par groupe', qTotal: 'Total : {n} annonces', qTotal1: 'Total : 1 annonce',
      qHelpImg: 'Plus d’annonces permettent à {platform} de tester différentes versions. Chaque annonce reçoit sa propre image IA ({c} crédits chacune).', qHelpOwn: 'Vos propres images sont utilisées pour ces annonces : les annonces supplémentaires ne coûtent aucun crédit d’image.', qHelpText: 'Les annonces du Réseau de Recherche sont uniquement textuelles : les annonces supplémentaires ne coûtent aucun crédit de plus.', qHelpVid: 'Chaque annonce reçoit sa propre vidéo IA ({c} crédits chacune).', qHelpPinVid: 'Toutes les annonces utilisent la même vidéo : les annonces supplémentaires ne coûtent aucun crédit de plus.',
      qFixedPmax: 'Performance Max est toujours publié comme un seul groupe d’assets : Google combine automatiquement vos images et textes en annonces.', qFixedDg: 'Demand Gen est publié comme un groupe d’annonces avec une seule annonce illustrée.',
      rvPrice: 'Prix', rvOffer: 'Offre spéciale', rvImg: 'Image', rvImgAi: 'Générée par l’IA', rvImgOwn: 'Votre propre image ({n})', rvAdsSet: '{g} ensembles × {a} annonces = {n} annonces', rvAdsGrp: '{g} groupes × {a} annonces = {n} annonces',
      costOwn: '{c} × votre propre image (0 crédit)',
      stEyebrow: 'Creative Stage', stReady: 'Prêt à créer', stNext: 'Ensuite : {step}', stNoName: 'Votre produit', stAiImg: 'L’image IA est créée quand vous créez l’annonce.', stOwnNone: 'Importez votre image à l’étape 4.', stVideo: 'La vidéo IA est créée quand vous créez l’annonce.', stText: 'Aperçu d’après vos réponses. Les titres et descriptions définitifs sont rédigés quand vous créez l’annonce.', stPickFormat: 'Choisissez un format à l’étape 4.', stAds: '{n} annonces', stAd1: '1 annonce', stGenerated: 'Générée', stSponsored: 'Sponsorisé', stNotes: 'Notes', stUploading: 'Importation…',
    },
    es: {
      priceL: 'Precio del producto', priceHelp: 'Déjalo vacío para no incluir el precio en el anuncio.', errPrice: 'Introduce un precio como 29,99 — solo números, sin signo menos.', curSugg: 'Moneda sugerida según el país de tu empresa — comprueba que es la moneda en la que vendes.', curLocale: 'Moneda sugerida según tu navegador — comprueba que es la moneda en la que vendes.',
      offerL: 'Oferta especial', offerP: 'p. ej. Envío gratis este fin de semana', offerHelp: 'Solo ofertas reales — el anuncio nunca inventa un descuento ni una promoción.',
      webOk: 'Página leída: {title}', webOkPlain: 'Página leída.', webOptional: 'El sitio web es opcional — puedes continuar sin él.',
      webErrInvalid: 'Esto no parece una dirección web. Revísala, por ejemplo tutienda.es.', webErrDns: 'No pudimos abrir este sitio web. Revisa la dirección e inténtalo de nuevo.', webErrHttp: 'No se pudo abrir esta página — puede que no exista. Revisa la dirección.', webErrTimeout: 'El sitio web no respondió. Inténtalo de nuevo en un momento.', webErrBlocked: 'No podemos leer esta dirección. Usa la dirección pública de tu sitio web.', webErrContent: 'No pudimos leer el contenido de esta página.',
      imgSrcL: '¿Cómo quieres crear la imagen de tu anuncio?', src_ai: 'Generar con IA', src_ai_d: 'Deja que OrivenAI cree una imagen nueva para tu anuncio.', src_own: 'Usar mi propia imagen', src_own_d: 'Sube tu propia imagen y deja que OrivenAI escriba el texto del anuncio.',
      upChoose: 'Elegir imagen', upDrop: 'o arrástrala aquí', upReq: 'JPG o PNG · hasta 8 MB · al menos 600 × 314 píxeles', upReplace: 'Reemplazar', upRemove: 'Quitar', upUploading: 'Subiendo…', upAdd: 'Añadir otra imagen',
      upPerAd: 'Basta con una imagen: se usa para los {n} anuncios. Añade hasta {max} para dar imágenes distintas a los anuncios.', upPmax: 'Performance Max muestra imágenes en horizontal (1,91:1), cuadradas (1:1) y en vertical (4:5). Añade una imagen, o una de cada forma.', upExtra: 'Solo se usan las primeras {max} imágenes para este anuncio.',
      img_image_type: 'Este tipo de archivo no es compatible. Usa una imagen JPG o PNG.', img_image_size: 'Esta imagen supera los 8 MB. Usa un archivo más pequeño.', img_image_read: 'No se pudo leer esta imagen. Prueba con otro archivo.', img_image_small: 'Esta imagen mide {w} × {h} píxeles. {platform} necesita al menos 600 × 314 píxeles — usa una imagen más grande.', img_auth: 'Inicia sesión para subir tu imagen.', img_upload: 'La subida no funcionó. Inténtalo de nuevo.',
      img_crop_google: 'Google necesita una imagen {shapes} para este tipo de anuncio. Al publicar, OrivenAI recorta tu imagen desde el centro a esa forma — deja lo importante en el centro.', shape_landscape: 'horizontal (1,91:1)', shape_square: 'cuadrada (1:1)', shape_portrait: 'vertical (4:5)', and: 'y',
      img_meta_ratio: 'Meta muestra las imágenes del feed entre 1,91:1 (ancha) y 4:5 (alta), así que Meta puede recortar esta imagen en algunas ubicaciones.', img_pin_wide: 'Los Pines se ven mejor en vertical (2:3). Una imagen ancha se muestra más pequeña en el feed de Pinterest.', img_pin_tall: 'Pinterest corta en el feed los Pines más altos que 1:2,1. Usa una imagen menos alta si la parte inferior importa.',
      errOwnNeed: 'Sube tu imagen, o elige «Generar con IA».', errOwnBusy: 'Espera a que tu imagen termine de subirse.',
      qL: 'Número de anuncios', q_adSet_g: 'Conjuntos de anuncios', q_adSet_a: 'Anuncios por conjunto', q_adGroup_g: 'Grupos de anuncios', q_adGroup_a: 'Anuncios por grupo', qTotal: 'Total: {n} anuncios', qTotal1: 'Total: 1 anuncio',
      qHelpImg: 'Más anuncios permiten a {platform} probar distintas versiones. Cada anuncio tiene su propia imagen de IA ({c} créditos cada una).', qHelpOwn: 'Para estos anuncios se usan tus propias imágenes, así que los anuncios extra no cuestan créditos de imagen.', qHelpText: 'Los anuncios de búsqueda son solo texto, así que los anuncios extra no cuestan créditos adicionales.', qHelpVid: 'Cada anuncio tiene su propio vídeo de IA ({c} créditos cada uno).', qHelpPinVid: 'Todos los anuncios usan el mismo vídeo, así que los anuncios extra no cuestan créditos adicionales.',
      qFixedPmax: 'Performance Max siempre se publica como un único grupo de recursos: Google combina automáticamente tus imágenes y textos en anuncios.', qFixedDg: 'Demand Gen se publica como un grupo de anuncios con un anuncio de imagen.',
      rvPrice: 'Precio', rvOffer: 'Oferta especial', rvImg: 'Imagen', rvImgAi: 'Generada con IA', rvImgOwn: 'Tu propia imagen ({n})', rvAdsSet: '{g} conjuntos × {a} anuncios = {n} anuncios', rvAdsGrp: '{g} grupos × {a} anuncios = {n} anuncios',
      costOwn: '{c} × tu propia imagen (0 créditos)',
      stEyebrow: 'Creative Stage', stReady: 'Listo para crear', stNext: 'Siguiente: {step}', stNoName: 'Tu producto', stAiImg: 'La imagen de IA se crea cuando creas el anuncio.', stOwnNone: 'Sube tu imagen en el paso 4.', stVideo: 'El vídeo de IA se crea cuando creas el anuncio.', stText: 'Vista previa a partir de tus respuestas. Los títulos y descripciones finales se escriben cuando creas el anuncio.', stPickFormat: 'Elige un formato en el paso 4.', stAds: '{n} anuncios', stAd1: '1 anuncio', stGenerated: 'Generada', stSponsored: 'Patrocinado', stNotes: 'Notas', stUploading: 'Subiendo…',
    },
    pt: {
      priceL: 'Preço do produto', priceHelp: 'Deixe vazio para não incluir o preço no anúncio.', errPrice: 'Digite um preço como 29,99 — apenas números, sem sinal de menos.', curSugg: 'Moeda sugerida pelo país da sua empresa — confira se é a moeda em que você vende.', curLocale: 'Moeda sugerida pelo seu navegador — confira se é a moeda em que você vende.',
      offerL: 'Oferta especial', offerP: 'ex. Frete grátis neste fim de semana', offerHelp: 'Apenas ofertas reais — o anúncio nunca inventa um desconto ou promoção.',
      webOk: 'Página lida: {title}', webOkPlain: 'Página lida.', webOptional: 'O site é opcional — você pode continuar sem ele.',
      webErrInvalid: 'Isto não parece um endereço de site. Confira, por exemplo sualoja.com.br.', webErrDns: 'Não conseguimos abrir este site. Confira o endereço e tente novamente.', webErrHttp: 'Não foi possível abrir esta página — talvez ela não exista. Confira o endereço.', webErrTimeout: 'O site não respondeu. Tente novamente em instantes.', webErrBlocked: 'Não conseguimos ler este endereço. Use o endereço público do seu site.', webErrContent: 'Não conseguimos ler o conteúdo desta página.',
      imgSrcL: 'Como você quer criar a imagem do seu anúncio?', src_ai: 'Gerar com IA', src_ai_d: 'Deixe a OrivenAI criar uma nova imagem para o seu anúncio.', src_own: 'Usar minha própria imagem', src_own_d: 'Envie sua própria imagem e deixe a OrivenAI escrever o texto do anúncio.',
      upChoose: 'Escolher imagem', upDrop: 'ou arraste aqui', upReq: 'JPG ou PNG · até 8 MB · pelo menos 600 × 314 pixels', upReplace: 'Substituir', upRemove: 'Remover', upUploading: 'Enviando…', upAdd: 'Adicionar outra imagem',
      upPerAd: 'Uma imagem basta: ela é usada nos {n} anúncios. Adicione até {max} para dar imagens diferentes aos anúncios.', upPmax: 'O Performance Max mostra imagens na horizontal (1,91:1), quadradas (1:1) e na vertical (4:5). Adicione uma imagem, ou uma de cada formato.', upExtra: 'Apenas as primeiras {max} imagem(ns) são usadas neste anúncio.',
      img_image_type: 'Este tipo de arquivo não é compatível. Use uma imagem JPG ou PNG.', img_image_size: 'Esta imagem tem mais de 8 MB. Use um arquivo menor.', img_image_read: 'Não foi possível ler esta imagem. Tente outro arquivo.', img_image_small: 'Esta imagem tem {w} × {h} pixels. O {platform} precisa de pelo menos 600 × 314 pixels — use uma imagem maior.', img_auth: 'Entre na sua conta para enviar sua imagem.', img_upload: 'O envio não funcionou. Tente novamente.',
      img_crop_google: 'O Google precisa de uma imagem {shapes} para este tipo de anúncio. Ao publicar, a OrivenAI corta sua imagem a partir do centro nesse formato — mantenha o mais importante no meio.', shape_landscape: 'horizontal (1,91:1)', shape_square: 'quadrada (1:1)', shape_portrait: 'vertical (4:5)', and: 'e',
      img_meta_ratio: 'O Meta mostra imagens do feed entre 1,91:1 (larga) e 4:5 (alta), então o Meta pode cortar esta imagem em alguns posicionamentos.', img_pin_wide: 'Os Pins ficam melhores na vertical (2:3). Uma imagem larga aparece menor no feed do Pinterest.', img_pin_tall: 'O Pinterest corta no feed os Pins mais altos que 1:2,1. Use uma imagem menos alta se a parte de baixo for importante.',
      errOwnNeed: 'Envie sua imagem, ou escolha “Gerar com IA”.', errOwnBusy: 'Aguarde até sua imagem terminar de ser enviada.',
      qL: 'Número de anúncios', q_adSet_g: 'Conjuntos de anúncios', q_adSet_a: 'Anúncios por conjunto', q_adGroup_g: 'Grupos de anúncios', q_adGroup_a: 'Anúncios por grupo', qTotal: 'Total: {n} anúncios', qTotal1: 'Total: 1 anúncio',
      qHelpImg: 'Mais anúncios deixam o {platform} testar versões diferentes. Cada anúncio recebe sua própria imagem de IA ({c} créditos cada).', qHelpOwn: 'Suas próprias imagens são usadas nesses anúncios, então anúncios extras não custam créditos de imagem.', qHelpText: 'Anúncios da Pesquisa são só texto, então anúncios extras não custam créditos adicionais.', qHelpVid: 'Cada anúncio recebe seu próprio vídeo de IA ({c} créditos cada).', qHelpPinVid: 'Todos os anúncios usam o mesmo vídeo, então anúncios extras não custam créditos adicionais.',
      qFixedPmax: 'O Performance Max é sempre publicado como um único grupo de recursos: o Google combina automaticamente suas imagens e textos em anúncios.', qFixedDg: 'O Demand Gen é publicado como um grupo de anúncios com um anúncio de imagem.',
      rvPrice: 'Preço', rvOffer: 'Oferta especial', rvImg: 'Imagem', rvImgAi: 'Gerada com IA', rvImgOwn: 'Sua própria imagem ({n})', rvAdsSet: '{g} conjuntos × {a} anúncios = {n} anúncios', rvAdsGrp: '{g} grupos × {a} anúncios = {n} anúncios',
      costOwn: '{c} × sua própria imagem (0 créditos)',
      stEyebrow: 'Creative Stage', stReady: 'Pronto para criar', stNext: 'Próximo: {step}', stNoName: 'Seu produto', stAiImg: 'A imagem de IA é criada quando você cria o anúncio.', stOwnNone: 'Envie sua imagem no passo 4.', stVideo: 'O vídeo de IA é criado quando você cria o anúncio.', stText: 'Prévia com base nas suas respostas. Os títulos e descrições finais são escritos quando você cria o anúncio.', stPickFormat: 'Escolha um formato no passo 4.', stAds: '{n} anúncios', stAd1: '1 anúncio', stGenerated: 'Gerada', stSponsored: 'Patrocinado', stNotes: 'Notas', stUploading: 'Enviando…',
    },
  };
  Object.keys(STR_MORE).forEach(function (l) { if (STR[l]) Object.keys(STR_MORE[l]).forEach(function (k) { STR[l][k] = STR_MORE[l][k]; }); });
  var TONES = ['Friendly', 'Professional', 'Premium', 'Playful', 'Bold'];
  var STYLES = [['new', 'New product'], ['season', 'Seasonal promotion'], ['premium', 'Premium look'], ['minimal', 'Minimalist'], ['bold', 'Bold and energetic'], ['pro', 'Professional'], ['friendly', 'Friendly']];
  var PLATS = ['google', 'meta', 'tiktok', 'pinterest'];
  var ICONS = {
    google: '<svg viewBox="0 0 12 12" fill="none" width="18" height="18" aria-hidden="true"><path d="M10.9 6.1c0-.4 0-.8-.1-1.1H6v2.1h2.8a2.4 2.4 0 0 1-1 1.5v1.2h1.7c1-1 1.4-2.3 1.4-3.7z" fill="#4285F4"/><path d="M6 11c1.4 0 2.6-.5 3.5-1.3l-1.7-1.3a3.2 3.2 0 0 1-1.8.5 3.2 3.2 0 0 1-3-2.1H1.3v1.3A5.3 5.3 0 0 0 6 11z" fill="#34A853"/><path d="M3 6.8a3.1 3.1 0 0 1 0-1.6V3.9H1.3a5.3 5.3 0 0 0 0 4.2L3 6.8z" fill="#FBBC05"/><path d="M6 2.7c.8 0 1.5.3 2 .8L9.6 1.9A5.3 5.3 0 0 0 1.3 3.9L3 5.2a3.2 3.2 0 0 1 3-2.5z" fill="#EA4335"/></svg>',
    meta: '<svg viewBox="0 0 12 12" fill="none" width="18" height="18" aria-hidden="true"><rect width="12" height="12" rx="3" fill="#1877F2"/><path d="M8.1 6a2.1 2.1 0 1 0-4.2 0c0 1 .7 1.8 1.7 2V7H4.7V6h.9V5.3c0-.6.3-.9.9-.9h.5V5.2h-.4c-.2 0-.2.1-.2.3V6h.7L7 7H6.4v1c1-.2 1.7-1 1.7-2z" fill="white"/></svg>',
    tiktok: '<svg viewBox="0 0 12 12" fill="none" width="18" height="18" aria-hidden="true"><rect width="12" height="12" rx="3" fill="#010101"/><path d="M7.9 3.1h-.9v3.7a.75.75 0 1 1-1-.7V4.8a2.5 2.5 0 1 0 2.2 2.5V4.8c.3.2.7.3 1.1.3V4a1.1 1.1 0 0 1-1.4-.9z" fill="white"/></svg>',
    pinterest: '<svg viewBox="0 0 12 12" fill="none" width="18" height="18" aria-hidden="true"><circle cx="6" cy="6" r="6" fill="#E60023"/><path d="M6.05 2.6c-1.9 0-3.15 1.36-3.15 2.85 0 .87.47 1.53 1.2 1.8.09.03.16 0 .19-.1l.13-.5c.03-.1.02-.14-.05-.23a1.6 1.6 0 0 1-.32-1c0-.96.72-1.94 1.96-1.94 1.07 0 1.82.68 1.82 1.71 0 1.28-.55 2.28-1.36 2.28-.44 0-.78-.36-.67-.82.13-.55.38-1.15.38-1.55 0-.36-.19-.65-.6-.65-.47 0-.85.5-.85 1.15 0 .43.14.71.14.71l-.58 2.44c-.17.72-.03 1.6-.01 1.69.01.05.08.06.11.03.05-.06.63-.79.83-1.5.06-.2.32-1.28.32-1.28.16.31.63.58 1.12.58 1.48 0 2.55-1.36 2.55-3.05 0-1.62-1.32-2.62-2.86-2.62z" fill="#fff"/></svg>',
  };

  function lang() { var l = (typeof CURRENT_LANG !== 'undefined' && CURRENT_LANG) || 'en'; return STR[l] ? l : 'en'; }
  function T(k, vars) {
    var s = (STR[lang()] && STR[lang()][k]) || STR.en[k];
    if (s == null) s = k;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); });
    return s;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }
  var platName = function (p) { return (CC.PLATFORMS[p] || {}).label || p; };
  var goalName = function (g) { return T('goal_' + g); };
  var fmtName = function (f) { return T('fmt_' + f); };
  var reasonText = function (code) { return { msg: T('r_' + code), sug: T('r_' + code + '_s') }; };
  // compat REASONS keys for a message string (the compat module is English-only).
  function reasonKeyFor(message) { var R = CC.REASONS; for (var k in R) if (R[k].message === message) return k; return null; }
  function localReason(message) { var k = message && reasonKeyFor(message); return k ? reasonText(k) : { msg: message || '', sug: '' }; }

  // ── State ─────────────────────────────────────────────────────────
  var DRAFT_KEY = 'orv_create_draft_v2';
  var S = {
    step: 1, maxStep: 1,
    productName: '', description: '', website: '', websiteRead: '', offer: '',
    // price: exactly what the user typed ('' = no price, never 0).
    price: '', currency: null, currencySource: null,
    platform: null, goal: null, format: null, campaignType: null, objective: null,
    groups: 1, adsPerGroup: 1,
    // Image ads: 'ai' (generated) or 'own' (the user's uploads, stored by
    // /api/manual-campaigns/upload-creative: { url, name, width, height, bytes, type }).
    imageSource: 'ai', ownImages: [],
    audience: '', language: null, languageSource: null, tone: '', styles: [], notes: '',
  };
  var notice = '';
  var costs = null; // FEATURE_COSTS from /api/credits/status
  var imgError = '';  // last upload problem (shown under the upload area)
  var webStatus = null; // { kind: 'ok'|'err', text } for the website read
  // Persisted copy: an image still uploading (no url yet, only a local
  // preview) is never saved — after a reload it would point nowhere.
  function persistable() {
    var c = JSON.parse(JSON.stringify(S));
    c.ownImages = (S.ownImages || []).filter(function (i) { return i && i.url; }).map(function (i) { return { url: i.url, name: i.name, width: i.width, height: i.height, bytes: i.bytes, type: i.type }; });
    return c;
  }
  // Never before mount() has loaded the saved draft: an early render (the
  // interface-language pass in settings.js runs first on page load) would
  // otherwise overwrite the user's draft with the empty defaults.
  function save() { if (!mount._loaded) return; try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(persistable())); } catch (_) {} scheduleStage(); }
  function load() { try { var d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); if (d && typeof d === 'object') Object.keys(S).forEach(function (k) { if (d[k] !== undefined) S[k] = d[k]; }); } catch (_) {} }

  // ── Legacy globals the rest of the app reads ─────────────────────
  function syncLegacy() {
    document.querySelectorAll('.cr2-pp').forEach(function (b) { var on = b.getAttribute('data-plat') === S.platform; b.classList.toggle('cr2-pp-on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    document.querySelectorAll('.cr2-goal-card').forEach(function (b) { var on = b.getAttribute('data-goal') === S.goal; b.classList.toggle('cr2-goal-card-on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    window._ov3Goal = S.goal || null;
    var mode = S.format === 'video' ? 'videos' : 'images';
    window._ov3ContentMode = mode;
    // The creative pipeline reads the ad's own images from window._ov3Assets
    // (same array the legacy "Attach Image" used — mutated in place so every
    // reference sees it): the uploads with "Use my own image", none otherwise.
    var assets = window._ov3Assets;
    if (Array.isArray(assets)) {
      assets.length = 0;
      if (ownMode()) S.ownImages.forEach(function (i) { if (i && i.url) assets.push({ name: i.name || 'image', data: i.url }); });
    }
    window._ov3GoogleCampaignType = S.platform === 'google' ? (S.campaignType || 'SEARCH') : null;
    window._ov3PlatformObjective = S.objective || null;
    window._ov3Structure = { groups: S.groups, adsPerGroup: S.adsPerGroup };
    window._ov3MetaPlacement = 'both'; // placements are chosen in Launch now
    if (typeof window._cr2RenderStage === 'function') window._cr2RenderStage();
    else if (typeof _cr2RenderStage === 'function') _cr2RenderStage();
  }

  // ── Rules (all from the shared schema) ─────────────────────────────
  function typeFor() {
    if (S.platform !== 'google') return CC.PLATFORMS[S.platform] ? CC.PLATFORMS[S.platform].defaultType : null;
    return S.campaignType || (S.format === 'text' ? 'SEARCH' : null);
  }
  function checkNow() {
    if (!S.platform || !S.goal || !S.format) return null;
    return CC.check({ platform: S.platform, campaignType: S.platform === 'google' ? typeFor() : null, goal: S.goal, format: S.format, objective: S.objective });
  }
  function adCount() { return S.platform ? CC.adCountFor(S.platform, typeFor(), S.groups, S.adsPerGroup) : 1; }
  function ownMode() { return S.format === 'image' && S.imageSource === 'own'; }
  function ownMax() { return CC.ownImageMax(S.platform, typeFor(), adCount()); }
  function estimate() {
    if (!costs || !S.platform || !S.format) return null;
    return CC.estimateCredits(costs, CC.assetsFor(S.platform, typeFor(), S.format), adCount(), { imageSource: S.format === 'image' ? S.imageSource : null });
  }
  function priceParsed() { return CC.parsePrice(S.price, S.currency); }
  // "€ 29.99" in the interface language's number format.
  function fmtPrice(amount, cur) {
    if (amount == null || !cur) return '';
    try { return new Intl.NumberFormat(lang(), { style: 'currency', currency: cur, minimumFractionDigits: CC.currencyDecimals(cur), maximumFractionDigits: CC.currencyDecimals(cur) }).format(amount); }
    catch (_) { return amount.toFixed(CC.currencyDecimals(cur)) + ' ' + cur; }
  }
  function curSymbol(cur) {
    try { var p = new Intl.NumberFormat(lang(), { style: 'currency', currency: cur }).formatToParts(0).filter(function (x) { return x.type === 'currency'; })[0]; return p ? p.value : cur; }
    catch (_) { return cur; }
  }
  function domainOf(w) { var v = String(w || '').trim(); if (!v) return ''; try { return new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v).hostname.replace(/^www\./, ''); } catch (_) { return v; } }
  function unitOf() { var st = S.platform ? CC.structureFor(S.platform, typeFor()) : null; return st ? st.unit : 'adGroup'; }
  // Keep goal / format / type / objective valid after a change, and SAY so.
  function reconcile(changed) {
    var msgs = [];
    if (S.platform && S.goal) {
      var go = CC.goalOptions(S.platform).find(function (g) { return g.goal === S.goal; });
      if (go && !go.available) { msgs.push(T('nGoalReset', { goal: goalName(S.goal), platform: platName(S.platform) })); S.goal = null; }
    }
    if (S.platform) {
      var fo = CC.formatOptions(S.platform, S.goal).filter(function (o) { return !o.hidden; });
      var avail = fo.filter(function (o) { return o.available; });
      var cur = S.format && fo.find(function (o) { return o.format === S.format; });
      if (S.format && (!cur || !cur.available)) {
        var why = cur && cur.reason ? localReason(cur.reason).msg : '';
        S.format = avail.length === 1 ? avail[0].format : null;
        if (S.format) msgs.push(T('nFormatAuto', { format: fmtName(S.format), reason: why || T('onlyOne', { platform: platName(S.platform), format: fmtName(S.format) }) }));
      }
      if (!S.format && avail.length === 1) S.format = avail[0].format;
      if (S.platform === 'google') {
        if (S.format === 'text') S.campaignType = 'SEARCH';
        else if (S.format === 'image') { var types = CC.typesForFormat('google', 'image', S.goal); if (types.indexOf(S.campaignType) === -1) S.campaignType = types[0] || null; }
        else S.campaignType = null;
      } else S.campaignType = null;
      if (S.objective) {
        var oo = CC.objectiveOptions(S.platform, typeFor(), S.goal, S.format).find(function (o) { return o.objective === S.objective; });
        if (!oo || !oo.available) { msgs.push(T('nObjReset', { reason: T('r_objective_video_completion') })); S.objective = null; }
      }
      var ti = CC.typeInfo(S.platform, typeFor());
      if (ti && !ti.structure) { S.groups = 1; S.adsPerGroup = 1; }
    }
    if (msgs.length) notice = msgs.join(' ');
  }

  // ── Rendering ─────────────────────────────────────────────────────
  var STEPS = [1, 2, 3, 4, 5, 6];
  function renderSteps() {
    var ol = $('cfSteps'); if (!ol) return;
    ol.innerHTML = STEPS.map(function (n) {
      var cls = n === S.step ? ' is-current' : (n < S.step || n <= S.maxStep ? ' is-done' : '');
      var reachable = n <= S.maxStep;
      return '<li class="cf-stepdot' + cls + '"><button type="button" ' + (reachable ? '' : 'disabled ') + 'data-go="' + n + '"' + (n === S.step ? ' aria-current="step"' : '') + ' aria-label="' + esc(T('stepOf', { n: n, t: 6 }) + ': ' + T('st' + n)) + '"><span class="cf-stepnum">' + n + '</span><span class="cf-steplbl">' + esc(T('st' + n)) + '</span></button></li>';
    }).join('');
  }
  function renderPlatforms() {
    var box = $('cfPlatforms'); if (!box) return;
    box.innerHTML = PLATS.map(function (p) {
      var on = S.platform === p;
      return '<button type="button" class="cr2-pp cf-card cf-plat' + (on ? ' cr2-pp-on' : '') + '" role="radio" aria-checked="' + on + '" data-plat="' + p + '">' +
        '<span class="cf-card-ico">' + ICONS[p] + '</span><span class="cf-card-t">' + esc(platName(p)) + '</span><span class="cf-card-s">' + esc(T('platform_' + p + '_sub')) + '</span><span class="cf-card-d">' + esc(T('platform_' + p + '_tag')) + '</span></button>';
    }).join('');
  }
  function renderGoals() {
    var box = $('cr2GoalGrid'); if (!box) return;
    var sub = $('cfS3sub'); if (sub) sub.textContent = S.platform ? T('s3sub', { platform: platName(S.platform) }) : '';
    var opts = S.platform ? CC.goalOptions(S.platform) : CC.GOALS.map(function (g) { return { goal: g, available: true }; });
    box.innerHTML = opts.map(function (o) {
      var on = S.goal === o.goal;
      var r = o.available ? null : localReason(o.reason);
      return '<button type="button" class="cr2-goal-card cf-card' + (on ? ' cr2-goal-card-on' : '') + (o.available ? '' : ' cr2-goal-card-disabled') + '" role="radio" aria-checked="' + on + '" data-goal="' + o.goal + '"' + (o.available ? '' : ' aria-disabled="true"') + '>' +
        '<span class="cf-card-t">' + esc(goalName(o.goal)) + '</span><span class="cf-card-d">' + esc(T('goal_' + o.goal + '_d')) + '</span>' +
        (r ? '<span class="cf-card-why"><b>' + esc(T('unavailable')) + '.</b> ' + esc(r.msg) + ' ' + esc(r.sug) + '</span>' : '') + '</button>';
    }).join('');
  }
  function renderFormats() {
    var box = $('cfFormats'); if (!box) return;
    var sub = $('cfS4sub'); if (sub) sub.textContent = S.platform ? T('s4sub', { platform: platName(S.platform) }) : '';
    var opts = S.platform ? CC.formatOptions(S.platform, S.goal).filter(function (o) { return !o.hidden; }) : [];
    var avail = opts.filter(function (o) { return o.available; });
    box.innerHTML = opts.map(function (o) {
      var on = S.format === o.format;
      var r = o.available ? null : localReason(o.reason);
      // The Google ad type this format will use: the one chosen in Advanced settings when it fits, else the goal's default.
      var picked = S.platform === 'google' && on && S.campaignType ? CC.typeInfo('google', S.campaignType) : null;
      var gt = picked && picked.formats.indexOf(o.format) !== -1 ? S.campaignType : o.campaignType;
      var typeLbl = S.platform === 'google' && o.available && gt ? '<span class="cf-card-s">' + esc(T('gtype_' + gt)) + '</span>' : '';
      return '<button type="button" class="cf-card cf-fmt' + (on ? ' is-on' : '') + (o.available ? '' : ' is-disabled') + '" role="radio" aria-checked="' + on + '" data-format="' + o.format + '"' + (o.available ? '' : ' aria-disabled="true"') + '>' +
        '<span class="cf-card-t">' + esc(fmtName(o.format)) + '</span>' + typeLbl + '<span class="cf-card-d">' + esc(T('fmt_' + o.format + '_d')) + '</span>' +
        (r ? '<span class="cf-card-why"><b>' + esc(T('unavailable')) + '.</b> ' + esc(r.msg) + ' ' + esc(r.sug) + '</span>' : '') + '</button>';
    }).join('');
    var note = $('cfFormatNote');
    if (note) {
      var lines = [];
      if (avail.length === 1 && S.format === avail[0].format) lines.push(T('onlyOne', { platform: platName(S.platform), format: fmtName(S.format).toLowerCase() }));
      var ti = S.platform === 'google' && S.format === 'image' ? CC.typeInfo('google', typeFor()) : null;
      if (ti && ti.profileNeeds) lines.push(T('gnote', { type: T('gtype_' + typeFor()) }));
      note.textContent = lines.join(' ');
      note.hidden = !lines.length;
    }
    renderImageSource();
    renderQty();
    renderAdvanced();
  }
  // "How would you like to create your ad image?" — image ads only.
  function renderImageSource() {
    var box = $('cfImgSrc'); if (!box) return;
    if (S.format !== 'image' || !S.platform) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    var card = function (k) {
      var on = S.imageSource === k;
      return '<button type="button" class="cf-card cf-src' + (on ? ' is-on' : '') + '" role="radio" aria-checked="' + on + '" data-imgsrc="' + k + '"><span class="cf-card-t">' + esc(T('src_' + k)) + '</span><span class="cf-card-d">' + esc(T('src_' + k + '_d')) + '</span></button>';
    };
    var html = '<span class="cf-lbl" id="cfImgSrcL">' + esc(T('imgSrcL')) + '</span><div class="cf-cards cf-cards-src" role="radiogroup" aria-labelledby="cfImgSrcL">' + card('ai') + card('own') + '</div>';
    if (S.imageSource === 'own') {
      var max = ownMax(), n = adCount(), list = S.ownImages;
      html += '<div class="cf-own" id="cfOwn">';
      if (list.length) {
        html += '<ul class="cf-own-list">' + list.map(function (im, i) {
          var src = im.preview || im.url || '';
          var unused = i >= max;
          return '<li class="cf-own-item' + (im.uploading ? ' is-busy' : '') + (unused ? ' is-unused' : '') + '"><img src="' + esc(src) + '" alt="' + esc(im.name || '') + '">' +
            '<div class="cf-own-meta"><span class="cf-own-name">' + esc(im.name || '') + '</span><span class="cf-own-dim">' + (im.uploading ? esc(T('upUploading')) : esc(im.width + ' × ' + im.height + ' px')) + '</span></div>' +
            '<div class="cf-own-act"><button type="button" class="cf-link" data-own-rep="' + i + '"' + (im.uploading ? ' disabled' : '') + '>' + esc(T('upReplace')) + '</button><button type="button" class="cf-link cf-link-danger" data-own-rm="' + i + '"' + (im.uploading ? ' disabled' : '') + '>' + esc(T('upRemove')) + '</button></div></li>';
        }).join('') + '</ul>';
      }
      if (list.length < max) {
        html += '<div class="cf-drop" id="cfDrop" tabindex="-1"><button type="button" class="cf-btn-ghost" id="cfOwnPick">' + esc(T(list.length ? 'upAdd' : 'upChoose')) + '</button> <span class="cf-drop-or">' + esc(T('upDrop')) + '</span><p class="cf-help cf-drop-req">' + esc(T('upReq')) + '</p></div>';
      }
      var hints = [];
      var a = CC.assetsFor(S.platform, typeFor(), 'image');
      if (a.images === 'pmax') hints.push(T('upPmax'));
      else if (a.images === 'per-ad' && n > 1) hints.push(T('upPerAd', { n: n, max: max }));
      if (list.length > max) hints.push(T('upExtra', { max: max }));
      if (hints.length) html += '<p class="cf-help">' + esc(hints.join(' ')) + '</p>';
      CC.imageNotices(list, S.platform, typeFor()).forEach(function (nt) {
        var shapes = (nt.shapes || []).map(function (s) { return T('shape_' + s); }).join(' ' + T('and') + ' ');
        html += '<p class="cf-note cf-img-notice">' + esc(T('img_' + nt.code, { shapes: shapes })) + '</p>';
      });
      if (imgError) html += '<p class="cf-help cf-err-txt" role="alert">' + esc(imgError) + '</p>';
      html += '</div>';
    }
    box.innerHTML = html;
  }
  // "Number of ads" — visible in step 4; only the structure publishing builds.
  function renderQty() {
    var box = $('cfQty'); if (!box) return;
    var st = S.platform && S.format ? CC.structureFor(S.platform, typeFor()) : null;
    if (!st) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    var n = adCount();
    var html = '<span class="cf-lbl">' + esc(T('qL')) + '</span>';
    if (st.configurable) {
      var sel = function (id, v, max, lbl) { return '<label class="cf-mini">' + esc(lbl) + '<select class="cf-inp cf-sel" id="' + id + '">' + Array.apply(null, { length: max }).map(function (_, i) { var k = i + 1; return '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></label>'; };
      html += '<div class="cf-qty-row">' + sel('cfGroups', S.groups, st.maxGroups, T('q_' + st.unit + '_g')) + '<span class="cf-qty-x" aria-hidden="true">×</span>' + sel('cfPer', S.adsPerGroup, st.maxAdsPerGroup, T('q_' + st.unit + '_a')) +
        '<output class="cf-qty-total" id="cfQtyTotal" for="cfGroups cfPer" aria-live="polite">' + esc(n === 1 ? T('qTotal1') : T('qTotal', { n: n })) + '</output></div>';
      var c = costs || {};
      var help = S.format === 'text' ? T('qHelpText')
        : S.format === 'video' ? (CC.assetsFor(S.platform, typeFor(), 'video').video === 'single' ? T('qHelpPinVid') : T('qHelpVid', { c: c.video_generation || '' }))
        : ownMode() ? T('qHelpOwn') : T('qHelpImg', { platform: platName(S.platform), c: c.image_generation || '' });
      html += '<p class="cf-help">' + esc(help) + '</p>';
    } else {
      html += '<div class="cf-qty-row"><output class="cf-qty-total" id="cfQtyTotal">' + esc(T('qTotal1')) + '</output></div><p class="cf-help">' + esc(T(st.unit === 'assetGroup' ? 'qFixedPmax' : 'qFixedDg')) + '</p>';
    }
    box.innerHTML = html;
  }
  function renderAdvanced() {
    var body = $('cfAdvBody'), line = $('cfAdvLine'); if (!body) return;
    var html = '';
    if (S.platform === 'google' && S.goal) {
      var types = CC.typeKeys('google').filter(function (k) { return CC.typeInfo('google', k).goals.indexOf(S.goal) !== -1; });
      html += '<div class="cf-field"><span class="cf-lbl">' + esc(T('gtypeL')) + '</span><div class="cf-cards cf-cards-sm" role="radiogroup">' + types.map(function (k) {
        var on = typeFor() === k;
        return '<button type="button" class="cf-card cf-gtype' + (on ? ' is-on' : '') + '" role="radio" aria-checked="' + on + '" data-gtype="' + k + '"><span class="cf-card-t">' + esc(T('gtype_' + k)) + '</span><span class="cf-card-s">' + esc(fmtName(CC.typeInfo('google', k).formats[0])) + '</span><span class="cf-card-d">' + esc(T('gtype_' + k + '_d')) + '</span></button>';
      }).join('') + '</div></div>';
    }
    var objs = S.platform ? CC.objectiveOptions(S.platform, typeFor(), S.goal, S.format) : [];
    if (objs.length) {
      html += '<div class="cf-field"><span class="cf-lbl">' + esc(T('objL')) + '</span><div class="cf-cards cf-cards-sm" role="radiogroup">' +
        '<button type="button" class="cf-card cf-obj' + (!S.objective ? ' is-on' : '') + '" role="radio" aria-checked="' + !S.objective + '" data-obj=""><span class="cf-card-t">' + esc(T('objStd')) + '</span></button>' +
        objs.map(function (o) {
          var on = S.objective === o.objective;
          return '<button type="button" class="cf-card cf-obj' + (on ? ' is-on' : '') + (o.available ? '' : ' is-disabled') + '" role="radio" aria-checked="' + on + '" data-obj="' + esc(o.objective) + '"' + (o.available ? '' : ' aria-disabled="true"') + '><span class="cf-card-t">' + esc(T('obj_vc')) + '</span><span class="cf-card-d">' + esc(T('obj_vc_d')) + '</span>' + (o.available ? '' : '<span class="cf-card-why">' + esc(T('r_objective_video_completion')) + '</span>') + '</button>';
        }).join('') + '</div></div>';
    }
    // (The number of ads is no longer here — it's visible in step 4 itself, renderQty.)
    var adv = $('cfAdvanced');
    if (adv) adv.hidden = !html;
    body.innerHTML = html;
    if (line) {
      var parts = [];
      if (S.platform === 'google' && typeFor()) parts.push(T('gtype_' + typeFor()));
      if (S.objective) parts.push(T('obj_vc'));
      line.textContent = parts.length ? '· ' + parts.join(' · ') : '';
    }
  }
  function renderCustomise() {
    var sel = $('cfLanguage');
    if (sel) {
      var cur = S.language || 'en';
      sel.innerHTML = CC.LANGUAGES.map(function (l) { return '<option value="' + l.code + '"' + (l.code === cur ? ' selected' : '') + '>' + esc(l.native + (l.native !== l.name ? ' — ' + l.name : '')) + '</option>'; }).join('');
    }
    var src = $('cfLangSrc');
    if (src) {
      var biz = (window._orvLaunchBiz && window._orvLaunchBiz.profile) || {};
      var iso = CC.countryIso(biz.country);
      src.textContent = S.languageSource === 'profile' ? T('langProfile') : S.languageSource === 'country' ? T('langCountry', { country: iso || biz.country || '' }) : S.languageSource === 'user' ? T('langUser') : T('langDefault');
      src.classList.toggle('is-suggested', S.languageSource === 'country' || S.languageSource === 'default' || !S.languageSource);
    }
    var tone = $('cfTone');
    if (tone) tone.innerHTML = '<option value="">' + esc(T('toneAuto')) + '</option>' + TONES.map(function (k) { return '<option value="' + k + '"' + (S.tone === k ? ' selected' : '') + '>' + esc(T('tone_' + k)) + '</option>'; }).join('');
    var st = $('cfStyles');
    if (st) st.innerHTML = STYLES.map(function (s) { var on = S.styles.indexOf(s[1]) !== -1; return '<button type="button" class="cf-chip' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-style="' + esc(s[1]) + '">' + esc(T('style_' + s[0])) + '</button>'; }).join('');
    var sugg = $('cfAudSugg');
    if (sugg) {
      var auds = (window._orvLaunchBiz && window._orvLaunchBiz.audiences) || [];
      sugg.innerHTML = auds.slice(0, 3).filter(function (a) { return a && a.name; }).map(function (a) { return '<button type="button" class="cf-chip cf-chip-sm" data-aud="' + esc(a.name) + '">' + esc(T('audUse', { name: a.name })) + '</button>'; }).join('');
    }
    renderNoteConflicts();
    var rn = $('cfResearchNote');
    if (rn) {
      var h = window.orvWorkspace && orvWorkspace.research && orvWorkspace.research.handoff ? orvWorkspace.research.handoff() : null;
      var n = h && h.findings ? h.findings.length : 0;
      rn.hidden = !n; rn.textContent = n ? T('researchNote', { n: n }) : '';
      if (n) { var more = $('cfMore'); if (more) more.open = true; }
    }
  }
  function renderNoteConflicts() {
    var box = $('cfNoteConflicts'); if (!box) return;
    var cs = CC.noteConflicts(S.notes, { platform: S.platform });
    box.innerHTML = cs.map(function (c) { return '<p class="cf-conflict">' + esc(T('c_' + c.kind, { platform: platName(S.platform) })) + '</p>'; }).join('');
  }
  function renderReview() {
    var dl = $('cfReview'); if (!dl) return;
    var rows = [];
    var row = function (k, v, step) { if (!v) return; rows.push('<div class="cf-rv-row"><dt>' + esc(T(k)) + '</dt><dd>' + esc(v) + '</dd><dd class="cf-rv-edit"><button type="button" class="cf-link" data-go="' + step + '">' + esc(T('rvEdit')) + '</button></dd></div>'); };
    row('rvWhat', S.productName + (S.description ? ' — ' + (S.description.length > 110 ? S.description.slice(0, 110) + '…' : S.description) : ''), 1);
    var pp = priceParsed();
    row('rvPrice', pp.ok && pp.amount != null ? fmtPrice(pp.amount, S.currency) : '', 1);
    row('rvOffer', S.offer.trim(), 1);
    row('rvWeb', S.website, 1);
    row('rvWhere', S.platform ? platName(S.platform) : '', 2);
    row('rvGoal', S.goal ? goalName(S.goal) : '', 3);
    row('rvFormat', S.format ? fmtName(S.format) : '', 4);
    if (S.platform === 'google' && typeFor()) row('rvType', T('gtype_' + typeFor()), 4);
    if (S.objective) row('objL', T('obj_vc'), 4);
    if (S.format === 'image') row('rvImg', ownMode() ? T('rvImgOwn', { n: S.ownImages.filter(function (i) { return i.url; }).length }) : T('rvImgAi'), 4);
    var st = S.platform ? CC.structureFor(S.platform, typeFor()) : null;
    var n = adCount();
    row('rvAds', st && st.configurable && (S.groups > 1 || S.adsPerGroup > 1) ? T(st.unit === 'adSet' ? 'rvAdsSet' : 'rvAdsGrp', { g: S.groups, a: S.adsPerGroup, n: n }) : String(n), 4);
    row('rvLang', CC.languageName(S.language || 'en') + (S.languageSource === 'profile' || S.languageSource === 'user' ? '' : ' (' + T('langDefault').split('.')[0].toLowerCase() + ')'), 5);
    row('rvAud', S.audience, 5);
    row('rvTone', S.tone ? T('tone_' + S.tone) : '', 5);
    row('rvStyle', S.styles.map(function (s) { var f = STYLES.find(function (x) { return x[1] === s; }); return f ? T('style_' + f[0]) : s; }).join(', '), 5);
    dl.innerHTML = rows.join('');
    var cc = checkNow();
    var inv = $('cfInvalid');
    if (inv) {
      if (cc && !cc.ok) { var r = localReason(cc.issues[0].message); inv.innerHTML = '<b>' + esc(T('genInvalid')) + '</b> ' + esc(r.msg) + ' ' + esc(r.sug); inv.hidden = false; }
      else inv.hidden = true;
    }
    var biz = (window._orvLaunchBiz && window._orvLaunchBiz.profile) || {};
    var hint = $('cfWhatNext');
    if (hint) hint.textContent = (biz.country ? T('countryHint', { country: biz.country }) : T('countryNone')) + ' ' + T('whatNext');
    renderCost();
  }
  function renderCost() {
    var val = $('aicGenCost'), br = $('cfCostBreak'), btn = $('aicGenBtn');
    var e = estimate();
    var free = typeof window.orvFirstAdImageOnly === 'function' && window.orvFirstAdImageOnly();
    if (val) val.textContent = e ? T('credits', { n: e.total }) : T(costs ? 'costPending' : 'costLoading');
    if (br) {
      var parts = [];
      if (e) {
        parts.push(T('costCopy', { n: e.copy }));
        if (e.images) parts.push(T('costImg', { c: e.images, n: e.imageCost }));
        if (e.ownImageSlots) parts.push(T('costOwn', { c: e.ownImageSlots }));
        if (e.videos) parts.push(T('costVid', { c: e.videos, n: e.videoCost }));
      }
      br.textContent = parts.join(' + ') + (free ? ' · ' + T('freeFirst') : '');
    }
    if (btn && !btn.disabled) btn.innerHTML = esc(e ? T('createCost', { n: e.total }) : T('create')) + ' <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
  }
  function loadCosts() {
    // Start from the published per-action costs (js/plans.js mirrors the
    // server's FEATURE_COSTS; paid-actions.test.js pins those), then use
    // the server's own figures as soon as /api/credits/status answers.
    if (!costs && typeof CREDIT_COSTS !== 'undefined' && CREDIT_COSTS.campaign != null) {
      costs = { campaign_generation: CREDIT_COSTS.campaign, image_generation: CREDIT_COSTS.image, video_generation: CREDIT_COSTS.video };
    }
    if (typeof _getCreditStatus !== 'function') return;
    _getCreditStatus().then(function (st) { if (st && st.featureCosts) { costs = st.featureCosts; renderCost(); renderQty(); } }).catch(function () {});
  }
  function applyTexts() {
    var map = { cfTitle: 'title', cfSubtitle: 'subtitle', cfS1h: 's1h', cfS1sub: 's1sub', cfNameL: 'nameL', cfDescL: 'descL', cfDescHelp: 'descHelp', cfWebL: 'webL', cfWebHelp: 'webHelp', cfPriceL: 'priceL', cfPriceHelp: 'priceHelp', cfOfferL: 'offerL', cfOfferHelp: 'offerHelp', cfS2h: 's2h', cfS2sub: 's2sub', cfS3h: 's3h', cfS4h: 's4h', cfAdvL: 'advL', cfAdvSub: 'advSub', cfS5h: 's5h', cfS5sub: 's5sub', cfAudL: 'audL', cfLangL: 'langL', cfToneL: 'toneL', cfStylesL: 'stylesL', cfNotesL: 'notesL', cfNotesHelp: 'notesHelp', cfMoreL: 'moreL', cfPhotosL: 'photosL', cfUseOwn: 'useOwn', cfShowProduct: 'showProduct', cfInspL: 'inspL', cfBrandL: 'brandL', cfS6h: 's6h', cfS6sub: 's6sub', cfCostL: 'costL', cfLaunchHint: 'launchHint', cfBack: 'back' };
    Object.keys(map).forEach(function (id) { var el = $(id); if (el) el.textContent = T(map[id]); });
    var ph = { cfName: 'nameP', aicInput: 'descP', cfWebsite: 'webP', cfOffer: 'offerP', cfAudience: 'audP', cfNotes: 'notesP' };
    Object.keys(ph).forEach(function (id) { var el = $(id); if (el) el.placeholder = T(ph[id]); });
    document.querySelectorAll('[data-cf-opt]').forEach(function (el) { el.textContent = T('optional'); });
    var wr = $('cfWebRead'); if (wr && !wr.disabled) wr.textContent = S.website && S.websiteRead === S.website && webStatus && webStatus.kind === 'ok' ? T('webReadDone') : T('webRead');
    renderPrice();
    renderWebMsg();
  }
  // Step 1 — currency list (symbol + code), placeholder by decimals, and
  // where the suggested currency came from.
  function renderPrice() {
    var sel = $('cfCurrency');
    if (sel) {
      var cur = S.currency || 'USD';
      sel.innerHTML = CC.CURRENCIES.map(function (c) { var sym = curSymbol(c); return '<option value="' + c + '"' + (c === cur ? ' selected' : '') + '>' + esc(sym === c ? c : sym + ' ' + c) + '</option>'; }).join('');
    }
    var inp = $('cfPrice');
    if (inp) inp.placeholder = CC.currencyDecimals(S.currency) ? '0.00' : '0';
    var help = $('cfPriceHelp');
    if (help) help.textContent = T('priceHelp') + (S.currencySource === 'country' ? ' ' + T('curSugg') : (S.currencySource === 'locale' || S.currencySource === 'default') ? ' ' + T('curLocale') : '');
    var err = $('cfPriceErr');
    if (err) { var ok = priceParsed().ok; err.hidden = ok; err.textContent = ok ? '' : T('errPrice'); }
  }
  function renderWebMsg() {
    var m = $('cfWebMsg'); if (!m) return;
    if (!webStatus) { m.hidden = true; m.textContent = ''; return; }
    m.hidden = false;
    m.textContent = webStatus.text;
    m.classList.toggle('is-ok', webStatus.kind === 'ok');
    m.classList.toggle('is-err', webStatus.kind === 'err');
  }
  function render() {
    document.querySelectorAll('#page-create .cf-step').forEach(function (sec) { sec.hidden = Number(sec.getAttribute('data-step')) !== S.step; });
    renderSteps();
    // Platform and goal cards are always rendered (hidden when not on their
    // step): the Stage and other legacy code read .cr2-pp-on / .cr2-goal-card-on,
    // which must be right after a restore that jumps straight to a later step.
    renderPlatforms();
    renderGoals();
    if (S.step === 4) renderFormats();
    if (S.step === 5) renderCustomise();
    if (S.step === 6) renderReview();
    var back = $('cfBack'), next = $('cfNext'), gen = $('aicGenBtn');
    if (back) back.style.visibility = S.step === 1 ? 'hidden' : 'visible';
    if (next) { next.hidden = S.step === 6; next.textContent = S.step === 5 && isCustomiseEmpty() ? T('skip') : T('next'); }
    if (gen) gen.hidden = S.step !== 6;
    var msg = $('cfNavMsg'); if (msg) { msg.textContent = notice; msg.classList.toggle('is-info', !!notice); }
    syncLegacy();
    save();
  }
  function isCustomiseEmpty() { return !S.audience && !S.tone && !S.styles.length && !S.notes; }

  // ── Validation per step ───────────────────────────────────────────
  function stepError(n) {
    if (n === 1) {
      if (!S.productName.trim()) return { msg: T('errName'), focus: 'cfName' };
      if (S.description.trim().length < 3) return { msg: T('errDesc'), focus: 'aicInput' };
      if (!priceParsed().ok) return { msg: T('errPrice'), focus: 'cfPrice' };
    }
    if (n === 2 && !S.platform) return { msg: T('errPlatform') };
    if (n === 3 && !S.goal) return { msg: T('errGoal') };
    if (n === 4) {
      if (!S.format) return { msg: T('errFormat') };
      if (ownMode()) {
        if (S.ownImages.some(function (i) { return i.uploading; })) return { msg: T('errOwnBusy') };
        if (!S.ownImages.some(function (i) { return i.url; })) return { msg: T('errOwnNeed') };
      }
    }
    return null;
  }
  function goTo(n) {
    n = Math.max(1, Math.min(6, n));
    // Moving forward validates every step in between.
    for (var i = S.step; i < n; i++) {
      var e = stepError(i);
      if (e) { S.step = i; notice = ''; render(); showError(e); return false; }
      if (i === 1) readWebsite();
    }
    S.step = n; S.maxStep = Math.max(S.maxStep, n); notice = '';
    render();
    var h = document.querySelector('#page-create .cf-step[data-step="' + n + '"] .cf-step-h');
    if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (_) {} }
    return true;
  }
  function showError(e) {
    var msg = $('cfNavMsg'); if (msg) { msg.textContent = e.msg; msg.classList.remove('is-info'); }
    if (e.focus && $(e.focus)) { $(e.focus).focus(); $(e.focus).classList.add('cf-inp-err'); setTimeout(function () { var el = $(e.focus); if (el) el.classList.remove('cf-inp-err'); }, 1800); }
  }

  // ── Website → existing "Your Page" analysis (free) ────────────────
  // Calls the same free analyzer "Your Page" used (POST /api/create/analyze-url
  // — all safety checks stay server-side) and turns its error codes into
  // plain words. The website is optional: a failure never blocks the steps.
  var WEB_ERR = { invalid_url: 'webErrInvalid', invalid_protocol: 'webErrInvalid', dns_failure: 'webErrDns', http_error: 'webErrHttp', timeout: 'webErrTimeout', fetch_error: 'webErrTimeout', private_address: 'webErrBlocked', invalid_redirect: 'webErrBlocked', too_many_redirects: 'webErrBlocked', unsupported_content_type: 'webErrContent', too_large: 'webErrContent' };
  function webFail(key) { webStatus = { kind: 'err', text: T(key) + ' ' + T('webOptional') }; renderWebMsg(); }
  function readWebsite() {
    var w = S.website.trim();
    if (!w) { webStatus = null; renderWebMsg(); return; }
    if (S.websiteRead === w) return;
    var url = /^[a-z][a-z0-9+.-]*:\/\//i.test(w) ? w : 'https://' + w;
    try { var u = new URL(url); if (!/^https?:$/.test(u.protocol) || !/\./.test(u.hostname)) throw new Error('bad'); }
    catch (_) { S.websiteRead = w; webFail('webErrInvalid'); return; }
    if (typeof window.apiFetch !== 'function') return;
    S.websiteRead = w;
    var btn = $('cfWebRead'); if (btn) { btn.disabled = true; btn.textContent = T('webReading'); }
    webStatus = null; renderWebMsg();
    window.apiFetch('/api/create/analyze-url', { method: 'POST', body: JSON.stringify({ url: url, type: 'page' }) }).then(function (res) {
      if (S.website.trim() !== w) return; // the user typed something else meanwhile
      var b = (res && res.data) || {};
      if (res && res.ok && b.ok) {
        if (typeof window._ov3SetPageContext === 'function') window._ov3SetPageContext({ url: b.url, domain: b.domain, title: b.title, description: b.description, text: b.text });
        else window._ov3PageContext = { url: b.url, domain: b.domain, title: b.title, description: b.description, text: b.text };
        webStatus = { kind: 'ok', text: b.title ? T('webOk', { title: String(b.title).slice(0, 80) }) : T('webOkPlain') };
        renderWebMsg();
      } else webFail(WEB_ERR[b.code] || ((res && res.status >= 500) ? 'webErrTimeout' : 'webErrDns'));
    }).catch(function () { if (S.website.trim() === w) webFail('webErrTimeout'); })
      .then(function () { var b2 = $('cfWebRead'); if (b2) { b2.disabled = false; b2.textContent = webStatus && webStatus.kind === 'ok' ? T('webReadDone') : T('webRead'); } scheduleStage(); });
  }
  // A changed or cleared address must not keep the old page's content.
  function clearWebsiteContext() {
    if (typeof window._ov3RemoveUrlContext === 'function' && window._ov3PageContext) window._ov3RemoveUrlContext();
    S.websiteRead = ''; webStatus = null; renderWebMsg();
  }

  // ── Own images: validate → upload (existing creative upload route) ──
  var pendingReplace = null;
  function readDims(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { resolve({ w: img.naturalWidth, h: img.naturalHeight, url: url }); };
      img.onerror = function () { resolve({ w: 0, h: 0, url: url }); };
      img.src = url;
    });
  }
  function imgProblemText(code, d) {
    if (code === 'image_small') return T('img_image_small', { w: d.w, h: d.h, platform: platName(S.platform) });
    return T('img_' + code);
  }
  function addOwnFiles(files, replaceAt) {
    imgError = '';
    var list = Array.prototype.slice.call(files || []);
    if (replaceAt == null) list = list.slice(0, Math.max(0, ownMax() - S.ownImages.length));
    else list = list.slice(0, 1);
    list.forEach(function (file) { handleOwnFile(file, replaceAt); });
    if (!list.length) renderImageSource();
  }
  function handleOwnFile(file, replaceAt) {
    readDims(file).then(function (d) {
      var problems = CC.checkImageFile({ type: file.type, bytes: file.size, width: d.w, height: d.h });
      if (problems.length) { URL.revokeObjectURL(d.url); imgError = imgProblemText(problems[0].code, d); renderImageSource(); return; }
      var entry = { name: String(file.name || 'image').slice(0, 120), width: d.w, height: d.h, bytes: file.size, type: file.type, url: null, preview: d.url, uploading: true };
      var old = replaceAt != null ? S.ownImages[replaceAt] : null;
      if (old) S.ownImages.splice(replaceAt, 1, entry); else S.ownImages.push(entry);
      if (old && old.preview) URL.revokeObjectURL(old.preview);
      renderImageSource(); syncLegacy();
      var reader = new FileReader();
      reader.onerror = function () { dropEntry(entry, T('img_image_read')); };
      reader.onload = function () {
        if (typeof window.apiFetch !== 'function') { dropEntry(entry, T('img_upload')); return; }
        window.apiFetch('/api/manual-campaigns/upload-creative', { method: 'POST', body: JSON.stringify({ dataUrl: reader.result, purpose: 'ad_image' }) }).then(function (res) {
          var b = (res && res.data) || {};
          if (S.ownImages.indexOf(entry) === -1) return; // removed while uploading
          if (res && res.ok && b.url) {
            entry.url = b.url; entry.uploading = false;
            if (b.width) { entry.width = b.width; entry.height = b.height; }
            save(); renderImageSource(); renderCost(); syncLegacy();
          } else dropEntry(entry, res && res.status === 401 ? T('img_auth') : (b.code ? imgProblemText(b.code, d) : T('img_upload')));
        }).catch(function () { dropEntry(entry, T('img_upload')); });
      };
      reader.readAsDataURL(file);
    });
  }
  function dropEntry(entry, msg) {
    var i = S.ownImages.indexOf(entry);
    if (i !== -1) S.ownImages.splice(i, 1);
    if (entry.preview) URL.revokeObjectURL(entry.preview);
    imgError = msg || '';
    save(); renderImageSource(); renderCost(); syncLegacy();
  }
  function removeOwn(i) {
    var e = S.ownImages[i]; if (!e) return;
    S.ownImages.splice(i, 1);
    if (e.preview) URL.revokeObjectURL(e.preview);
    imgError = '';
    save(); renderImageSource(); renderCost(); syncLegacy();
  }

  // ── Creative Stage: a live summary of this ad (state S is the source) ──
  var stageTimer = null;
  function scheduleStage() { clearTimeout(stageTimer); stageTimer = setTimeout(function () { var el = $('cr2Stage'); if (el) renderStage(el); }, 120); }
  function generatedAsset() {
    var p = typeof window._cgrLastPkg === 'function' ? window._cgrLastPkg() : null;
    var b = p && p.inputs && p.inputs.brief;
    if (!b || p.platform !== S.platform || (p.creativeFormat || null) !== S.format || b.productName !== S.productName.trim()) return null;
    if (S.format === 'video') { var v = (p.videoAssets || []).filter(function (x) { return x && x.videoUrl; })[0]; return v ? { video: v.videoUrl } : null; }
    if (S.format === 'image' && !ownMode()) { var vc = (p.visualConcepts || []).filter(function (x) { return x && x.generatedImageUrl; })[0]; return vc ? { image: vc.generatedImageUrl } : null; }
    return null;
  }
  function firstOpenStep() { for (var i = 1; i <= 4; i++) if (stepError(i)) return i; return 0; }
  function renderStage(stage) {
    var frames = typeof window._cr2StageFrames === 'function' ? window._cr2StageFrames() : { search: '', video: '', empty: '' };
    var svgOnly = function (h) { var k = h.indexOf('<span class="cr2-stage-frame-label"'); return k === -1 ? h : h.slice(0, k); };
    var open = firstOpenStep();
    var html = '<div class="ow-stage-head"><span class="cr2-stage-eyebrow">' + esc(T('stEyebrow')) + '</span><span class="ow-stage-ready' + (open ? '' : ' is-ready') + '" id="owStageReady">' + esc(open ? T('stNext', { step: T('st' + open) }) : T('stReady')) + '</span></div>';
    var gen = $('aicGenBtn'); if (gen) gen.classList.toggle('ow-armed', !open);
    // What is being advertised — the user's own words, exactly.
    var name = S.productName.trim(), desc = S.description.trim();
    html += '<div class="cf-stage-what"><p class="cf-stage-name' + (name ? '' : ' is-empty') + '">' + esc(name || T('stNoName')) + '</p>' + (desc ? '<p class="ow-brief cf-stage-desc">' + esc(desc.length > 160 ? desc.slice(0, 160) + '…' : desc) + '</p>' : '') + '</div>';
    var pp = priceParsed(), chips = [];
    if (pp.ok && pp.amount != null) chips.push('<span class="cf-stage-chip" data-k="price">' + esc(fmtPrice(pp.amount, S.currency)) + '</span>');
    if (S.offer.trim()) chips.push('<span class="cf-stage-chip" data-k="offer">' + esc(S.offer.trim().slice(0, 60)) + '</span>');
    if (S.website.trim()) chips.push('<span class="cf-stage-chip cf-stage-chip-muted" data-k="web">' + esc(domainOf(S.website)) + '</span>');
    if (chips.length) html += '<div class="cf-stage-chips">' + chips.join('') + '</div>';
    if (window.orvWorkspace && orvWorkspace.create && orvWorkspace.create.contextSection) html += orvWorkspace.create.contextSection();

    // The preview frame — real material only: the user's image, the real
    // generated asset for this ad, or an honest placeholder.
    var fmt = S.format, gen2 = generatedAsset();
    var tag = !fmt ? '' : (S.platform === 'google' && typeFor() ? T('gtype_' + typeFor()) : fmtName(fmt));
    var frameCls = fmt === 'text' ? ' cr2-stage-frame-search' : fmt === 'video' ? ' cr2-stage-frame-video' : '';
    html += '<div class="cr2-stage-frame' + frameCls + '" data-format="' + esc(fmt || '') + '">' + (tag ? '<span class="cr2-stage-frame-tag" aria-hidden="true">' + esc(tag) + '</span>' : '');
    if (fmt === 'text') {
      html += '<div class="cf-serp"><span class="cf-serp-spons">' + esc(T('stSponsored')) + (S.website.trim() ? ' · ' + esc(domainOf(S.website)) : '') + '</span>' +
        '<span class="cf-serp-h">' + esc(name || T('stNoName')) + (pp.ok && pp.amount != null ? ' — ' + esc(fmtPrice(pp.amount, S.currency)) : '') + '</span>' +
        '<span class="cf-serp-d">' + esc(desc ? (desc.length > 120 ? desc.slice(0, 120) + '…' : desc) : '') + '</span></div>' +
        '<span class="cr2-stage-frame-label">' + esc(T('stText')) + '</span>';
    } else if (fmt === 'video') {
      html += gen2 && gen2.video ? '<video class="cr2-stage-img" src="' + esc(gen2.video) + '" muted playsinline controls></video>' : svgOnly(frames.video) + '<span class="cr2-stage-frame-label">' + esc(T('stVideo')) + '</span>';
    } else if (fmt === 'image' && ownMode()) {
      var first = S.ownImages[0];
      if (first) {
        html += '<img class="cr2-stage-img" id="cfStageOwnImg" src="' + esc(first.preview || first.url) + '" alt="' + esc(first.name || '') + '">';
        if (S.ownImages.length > 1) html += '<span class="cf-stage-count">+' + (S.ownImages.length - 1) + '</span>';
        if (first.uploading) html += '<span class="cf-stage-busy">' + esc(T('stUploading')) + '</span>';
      } else html += svgOnly(frames.empty) + '<span class="cr2-stage-frame-label">' + esc(T('stOwnNone')) + '</span>';
    } else if (fmt === 'image') {
      html += gen2 && gen2.image ? '<img class="cr2-stage-img" src="' + esc(gen2.image) + '" alt="' + esc(T('stGenerated')) + '"><span class="cf-stage-count">' + esc(T('stGenerated')) + '</span>' : svgOnly(frames.empty) + '<span class="cr2-stage-frame-label">' + esc(T('stAiImg')) + '</span>';
    } else {
      html += svgOnly(frames.empty) + '<span class="cr2-stage-frame-label">' + esc(T('stPickFormat')) + '</span>';
    }
    html += '</div>';

    // Platform, goal, format and how many ads.
    html += '<div class="cr2-stage-meta"><div class="cr2-stage-meta-campaign">';
    if (!S.platform) html += '<div class="cr2-stage-provider"><span>' + esc(T('stagePickPlat')) + '</span></div>';
    else html += '<div class="cr2-stage-provider cr2-stage-provider-' + S.platform + '">' + (typeof window._cr2StagePlatIcon === 'function' ? window._cr2StagePlatIcon(S.platform) : '') + '<span>' + esc(platName(S.platform)) + '</span></div>';
    var cfg = [];
    if (fmt) cfg.push(fmtName(fmt));
    if (S.goal) cfg.push(goalName(S.goal));
    if (S.platform && fmt) { var n = adCount(); cfg.push(n === 1 ? T('stAd1') : T('stAds', { n: n })); }
    if (cfg.length) html += '<div class="cr2-stage-struct">' + esc(cfg.join(' · ')) + '</div>';
    html += (typeof window._cr2StageExtrasHtml === 'function' ? window._cr2StageExtrasHtml() : '');
    html += '</div>';
    // Customise choices, only those actually set.
    var facts = [];
    var fact = function (k, v) { if (v) facts.push('<div class="cf-stage-fact"><dt>' + esc(T(k)) + '</dt><dd>' + esc(v) + '</dd></div>'); };
    if (fmt === 'image') fact('rvImg', ownMode() ? T('rvImgOwn', { n: S.ownImages.length }) : T('rvImgAi'));
    if (S.language) fact('rvLang', CC.languageName(S.language) + (S.languageSource === 'profile' || S.languageSource === 'user' ? '' : ' (' + T('langDefault').split('.')[0].toLowerCase() + ')'));
    fact('rvAud', S.audience.trim().slice(0, 80));
    fact('rvTone', S.tone ? T('tone_' + S.tone) : '');
    fact('rvStyle', S.styles.map(function (s) { var f = STYLES.find(function (x) { return x[1] === s; }); return f ? T('style_' + f[0]) : s; }).join(', '));
    fact('stNotes', S.notes.trim() ? (S.notes.trim().length > 90 ? S.notes.trim().slice(0, 90) + '…' : S.notes.trim()) : '');
    if (facts.length) html += '<dl class="cf-stage-facts">' + facts.join('') + '</dl>';
    html += '</div>';
    stage.innerHTML = html;
    if (window.orvWorkspace && orvWorkspace.create && orvWorkspace.create.afterRender) orvWorkspace.create.afterRender(stage);
  }

  // ── Events ────────────────────────────────────────────────────────
  var bound = false;
  function bind() {
    if (bound) return; bound = true;
    var root = $('page-create'); if (!root) return;
    root.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('button, [data-go]') : null;
      if (!t || !root.contains(t)) return;
      if (t.id === 'cfNext') { goTo(S.step + 1); return; }
      if (t.id === 'cfBack') { goTo(S.step - 1); return; }
      if (t.id === 'cfWebRead') { S.websiteRead = ''; readWebsite(); return; }
      if (t.id === 'aicGenBtn') { generate(); return; }
      var go = t.getAttribute('data-go');
      if (go) { var n = Number(go); if (n <= S.maxStep) { S.step = n; notice = ''; render(); } return; }
      var p = t.getAttribute('data-plat');
      if (p && t.closest('#cfPlatforms')) { S.platform = p; notice = ''; reconcile('platform'); render(); return; }
      var g = t.getAttribute('data-goal');
      if (g && t.closest('#cr2GoalGrid')) {
        if (t.getAttribute('aria-disabled') === 'true') { var o = CC.goalOptions(S.platform).find(function (x) { return x.goal === g; }); var r = localReason(o && o.reason); notice = r.msg + ' ' + r.sug; render(); return; }
        S.goal = g; notice = ''; reconcile('goal'); render(); return;
      }
      var f = t.getAttribute('data-format');
      if (f) {
        if (t.getAttribute('aria-disabled') === 'true') { var fo = CC.formatOptions(S.platform, S.goal).find(function (x) { return x.format === f; }); var r2 = localReason(fo && fo.reason); notice = r2.msg + ' ' + r2.sug; render(); return; }
        S.format = f; notice = ''; S.campaignType = null; reconcile('format'); render(); return;
      }
      var gt = t.getAttribute('data-gtype');
      if (gt) {
        var fmt = CC.typeInfo('google', gt).formats[0];
        if (fmt !== S.format) notice = T('nTypeFormat', { type: T('gtype_' + gt), format: fmtName(fmt).toLowerCase() });
        S.campaignType = gt; S.format = fmt; reconcile('type'); S.campaignType = gt; render(); return;
      }
      if (t.hasAttribute('data-obj')) { if (t.getAttribute('aria-disabled') === 'true') return; S.objective = t.getAttribute('data-obj') || null; render(); return; }
      var src = t.getAttribute('data-imgsrc');
      if (src) { S.imageSource = src === 'own' ? 'own' : 'ai'; imgError = ''; notice = ''; render(); return; }
      if (t.id === 'cfOwnPick') { pendingReplace = null; var fi = $('cfOwnInput'); if (fi) fi.click(); return; }
      if (t.hasAttribute('data-own-rep')) { pendingReplace = Number(t.getAttribute('data-own-rep')); var fi2 = $('cfOwnInput'); if (fi2) { fi2.multiple = false; fi2.click(); } return; }
      if (t.hasAttribute('data-own-rm')) { removeOwn(Number(t.getAttribute('data-own-rm'))); return; }
      var st = t.getAttribute('data-style');
      if (st) { var i = S.styles.indexOf(st); if (i === -1) S.styles.push(st); else S.styles.splice(i, 1); renderCustomise(); save(); return; }
      var aud = t.getAttribute('data-aud');
      if (aud) { S.audience = aud; var ai = $('cfAudience'); if (ai) ai.value = aud; save(); return; }
    });
    root.addEventListener('input', function (ev) {
      var id = ev.target && ev.target.id;
      if (id === 'cfName') S.productName = ev.target.value;
      else if (id === 'aicInput') S.description = ev.target.value;
      else if (id === 'cfWebsite') { S.website = ev.target.value; clearWebsiteContext(); var b = $('cfWebRead'); if (b && !b.disabled) b.textContent = T('webRead'); }
      else if (id === 'cfPrice') {
        // Digits and one decimal separator only, no more decimals than the
        // currency has; letters, minus signs and spaces never get in.
        var el = ev.target, v = el.value.replace(/[^0-9.,]/g, '');
        var sep = v.search(/[.,]/);
        if (sep !== -1) v = v.slice(0, sep + 1) + v.slice(sep + 1).replace(/[.,]/g, '');
        var dec = CC.currencyDecimals(S.currency);
        if (sep !== -1) v = dec ? v.slice(0, sep + 1 + dec) : v.slice(0, sep);
        if (v !== el.value) el.value = v;
        S.price = v; renderPrice();
      }
      else if (id === 'cfOffer') S.offer = ev.target.value;
      else if (id === 'cfAudience') S.audience = ev.target.value;
      else if (id === 'cfNotes') { S.notes = ev.target.value; renderNoteConflicts(); }
      else return;
      if (S.step === 5) { var n = $('cfNext'); if (n) n.textContent = isCustomiseEmpty() ? T('skip') : T('next'); }
      save();
      scheduleStage();
    });
    // A finished price reads as a price: "29.9" → "29.90".
    root.addEventListener('focusout', function (ev) {
      if (!ev.target || ev.target.id !== 'cfPrice') return;
      var pp = priceParsed();
      if (pp.ok && pp.amount != null) { S.price = pp.amount.toFixed(CC.currencyDecimals(S.currency)); ev.target.value = S.price; save(); scheduleStage(); }
    });
    // Drag an image onto the upload area.
    root.addEventListener('dragover', function (ev) { var d = ev.target.closest && ev.target.closest('#cfDrop'); if (d) { ev.preventDefault(); d.classList.add('is-over'); } });
    root.addEventListener('dragleave', function (ev) { var d = ev.target.closest && ev.target.closest('#cfDrop'); if (d) d.classList.remove('is-over'); });
    root.addEventListener('drop', function (ev) { var d = ev.target.closest && ev.target.closest('#cfDrop'); if (!d) return; ev.preventDefault(); d.classList.remove('is-over'); if (ev.dataTransfer && ev.dataTransfer.files) addOwnFiles(ev.dataTransfer.files, null); });
    root.addEventListener('change', function (ev) {
      var id = ev.target && ev.target.id;
      if (id === 'cfLanguage') { S.language = ev.target.value; S.languageSource = 'user'; renderCustomise(); save(); }
      else if (id === 'cfTone') { S.tone = ev.target.value; save(); }
      else if (id === 'cfGroups' || id === 'cfPer') { S[id === 'cfGroups' ? 'groups' : 'adsPerGroup'] = Math.max(1, Math.min(CC.MAX_GROUPS, parseInt(ev.target.value, 10) || 1)); renderQty(); renderImageSource(); renderCost(); syncLegacy(); save(); }
      else if (id === 'cfWebsite') readWebsite();
      else if (id === 'cfCurrency') { S.currency = CC.currencyCode(ev.target.value) || S.currency; S.currencySource = 'user'; var pi = $('cfPrice'); if (pi) { pi.dispatchEvent(new Event('input', { bubbles: true })); } renderPrice(); save(); scheduleStage(); }
      else if (id === 'cfOwnInput') { var at = pendingReplace; pendingReplace = null; addOwnFiles(ev.target.files, at); ev.target.value = ''; ev.target.multiple = true; }
    });
    root.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || ev.shiftKey) return;
      var id = ev.target && ev.target.id;
      if (id === 'cfName' || id === 'cfOffer' || id === 'cfPrice' || id === 'cfWebsite' || id === 'cfAudience') { ev.preventDefault(); goTo(S.step + 1); }
      if (id === 'aicInput' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); goTo(S.step + 1); }
    });
    // Arrow keys move between the options of a radio group.
    root.addEventListener('keydown', function (ev) {
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].indexOf(ev.key) === -1) return;
      var g = ev.target && ev.target.closest && ev.target.closest('[role="radiogroup"]');
      if (!g) return;
      var items = Array.prototype.slice.call(g.querySelectorAll('[role="radio"]'));
      var i = items.indexOf(ev.target); if (i === -1) return;
      ev.preventDefault();
      var j = (i + (ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[j].focus();
    });
  }
  function fillInputs() {
    var set = function (id, v) { var el = $(id); if (el && el.value !== v) el.value = v || ''; };
    set('cfName', S.productName); set('aicInput', S.description); set('cfWebsite', S.website); set('cfPrice', S.price); set('cfOffer', S.offer); set('cfAudience', S.audience); set('cfNotes', S.notes);
    renderPrice();
    var ta = $('aicInput'); if (ta && typeof window.aicAutoResize === 'function') window.aicAutoResize(ta);
  }

  // ── Business profile (language default) ───────────────────────────
  function onBusiness(biz) {
    if (S.currencySource !== 'user') {
      var cs = CC.suggestCurrency(biz && biz.profile, navigator.language);
      S.currency = cs.code; S.currencySource = cs.source;
      renderPrice();
    }
    if (S.languageSource === 'user') { save(); return; }
    var sug = CC.suggestLanguage(biz && biz.profile);
    S.language = sug.code; S.languageSource = sug.source;
    if (S.step === 5) renderCustomise();
    if (S.step === 6) renderReview();
    save();
  }

  // ── Generation (reuses the existing pipeline) ─────────────────────
  function brief() {
    var pp = priceParsed();
    return { productName: S.productName.trim(), description: S.description.trim(), website: S.website.trim(),
      price: pp.ok ? pp.amount : null, currency: pp.ok && pp.amount != null ? S.currency : null, offer: S.offer.trim(),
      imageSource: S.format === 'image' ? S.imageSource : null,
      audience: S.audience.trim(), language: S.language || 'en', languageSource: S.languageSource || 'default', tone: S.tone, styles: S.styles.slice(), notes: S.notes.trim() };
  }
  function generate() {
    var btn = $('aicGenBtn');
    if (!btn || btn.disabled) return;
    for (var i = 1; i <= 4; i++) { var e = stepError(i); if (e) { S.step = i; render(); showError(e); return; } }
    var cc = checkNow();
    if (!cc || !cc.ok) { renderReview(); return; } // the reason is shown in #cfInvalid; nothing is sent, nothing is charged
    if (typeof window.cgrGenerate !== 'function') { if (typeof orvToast === 'function') orvToast('Generation engine not loaded. Please refresh.', 'error'); return; }
    syncLegacy();
    if (typeof _aicSetGeneratingBtn === 'function') _aicSetGeneratingBtn(btn); else { btn.disabled = true; btn.textContent = T('creating'); }
    var est = estimate();
    var product = [S.productName.trim(), S.description.trim()].filter(Boolean).join(' — ');
    var opts = { brief: brief(), format: cc.format, campaignType: cc.campaignType };
    var fire = function () {
      try { window.cgrGenerate(product, cc.platform, cc.creativeMode, cc.goal, opts); }
      catch (err) { restoreButton(btn); if (typeof orvToast === 'function') orvToast('Campaign generation failed: ' + err.message, 'error'); }
    };
    var isFree = typeof _isFreeUser === 'function' && _isFreeUser();
    if (isFree || typeof checkUsageLimit !== 'function') { fire(); return; }
    // Pre-flight with the FULL cost (copy + every image/video) — the server
    // still checks each charge itself.
    checkUsageLimit(est ? est.total : (typeof CREDIT_COSTS !== 'undefined' ? CREDIT_COSTS.campaign : 1)).then(function (r) {
      if (r.allowed) { fire(); return; }
      restoreButton(btn);
      var F = window.orvWorkspace && orvWorkspace.flow;
      if (F && r.balance != null) {
        var m = F.error({ status: 402, body: { code: 'CREDITS_EXHAUSTED', balance: r.balance }, required: r.required, phase: 'generate' });
        F.confirm({ title: m.title, eyebrow: T('create'), body: '<p>' + F.esc(m.message) + '</p><dl class="ofb-credits"><div><dt>Needed</dt><dd>' + r.required + '</dd></div><div><dt>Your balance</dt><dd>' + r.balance + '</dd></div></dl>', confirmLabel: 'View plans', cancelLabel: 'Not now' })
          .then(function (yes) { if (yes) F.runAction('plans', { action: 'create', code: 'CREDITS_EXHAUSTED', balance: r.balance }); });
      } else {
        if (typeof orvToast === 'function') orvToast(r.message && r.message !== 'upgrade' ? r.message : 'Choose a plan to build campaigns.', 'warn');
        if (typeof openPaywall === 'function') setTimeout(openPaywall, 400);
      }
    }).catch(function () { fire(); }); // fail open on a check-side error — the server still enforces
  }
  function restoreButton(btn) {
    btn = btn || $('aicGenBtn'); if (!btn) return;
    btn.disabled = false;
    var page = $('page-create'); if (page) page.classList.remove('cr2-ambient-build');
    renderCost();
  }

  // ── Integrations ──────────────────────────────────────────────────
  function getState() { return persistable(); }
  function setState(st) {
    if (!st || typeof st !== 'object') return;
    Object.keys(S).forEach(function (k) { if (st[k] !== undefined) S[k] = st[k]; });
    if (!Array.isArray(S.ownImages)) S.ownImages = [];
    if (S.imageSource !== 'own') S.imageSource = 'ai';
    if (st.website !== undefined && st.website !== st.websiteRead) webStatus = null;
    reconcile('restore'); fillInputs(); render();
  }
  // Research → Create: only the insights the user selected in Research travel,
  // as structured researchContext (the Stage chips). Nothing is written into
  // the description or the notes automatically — those stay the user's own.
  function applyResearch() {
    var prefilled = false;
    fillInputs();
    S.step = S.productName.trim() ? Math.min(S.maxStep, 5) || 1 : 1;
    render();
    return prefilled;
  }
  function isReady() { return !!(S.productName.trim() && S.description.trim() && S.platform && S.goal && S.format); }
  function mount() {
    if (!$('cfSteps')) return;
    bind();
    if (!mount._loaded) {
      load(); mount._loaded = true;
      if (!S.language) { S.language = 'en'; S.languageSource = 'default'; }
      if (!S.currency) { var cs = CC.suggestCurrency(null, navigator.language); S.currency = cs.code; S.currencySource = cs.source; }
      if (!Array.isArray(S.ownImages)) S.ownImages = [];
    }
    applyTexts(); fillInputs(); reconcile('mount'); render(); loadCosts();
    if (window._orvLaunchBiz) onBusiness(window._orvLaunchBiz);
  }
  function relabel() { if (!mount._loaded) return; applyTexts(); render(); }

  window.orvCreate = { mount: mount, goTo: goTo, getState: getState, setState: setState, applyResearch: applyResearch, onBusiness: onBusiness, generate: generate, restoreButton: restoreButton, isReady: isReady, relabel: relabel, renderStage: renderStage, _T: T, _STR: STR };

  // Re-label when the interface language changes.
  if (typeof window.applyLanguage === 'function' && !window.applyLanguage._cf) {
    var orig = window.applyLanguage;
    window.applyLanguage = function () { var r = orig.apply(this, arguments); try { relabel(); } catch (_) {} return r; };
    window.applyLanguage._cf = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
