/* ════════════════════════════════════════════════════════════════
   Automations (formerly Autopilot) — #page-autopilot

   One page, four tabs: Overview · Scheduler · Rules · Activity.
   Everything shown comes from /api/automations/* (routes/automationRoutes.js
   in the backend): real automations, real scheduled runs, real approvals,
   real activity. Nothing here is AI. Launch stays the place to build and
   publish campaigns; Automations manages campaigns that already exist in
   the connected ad accounts.

   Kept for the rest of the app (Control Center, Chat context, bell):
   window._apRules / _apPendingApprovals / _apHistoryItems, in the shape
   they read; window.apInit (navigation hook).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Texts (six interface languages; English fallback) ─────────────
  var STR = {
    en: {
      title: 'Automations', subtitle: 'Schedule campaigns, watch their performance and let OrivenAI act within limits you set.',
      tabOverview: 'Overview', tabScheduler: 'Scheduler', tabRules: 'Rules', tabActivity: 'Activity',
      newRule: 'New rule', newSchedule: 'Schedule campaign', pauseAll: 'Pause all automations', resumeAll: 'Resume all automations', settings: 'Settings',
      stRunning: 'Running', stPausedAll: 'All automations paused', stKilled: 'Paused by OrivenAI', stNoJobs: 'Not running on this server', stChecks: 'rules checked every {h}',
      hours: '{n} h', minutes: '{n} min',
      tActive: 'Active', tScheduled: 'Scheduled runs', tApprovals: 'Awaiting approval', tDone: 'Done · 7 days', tFailed: 'Failed · 7 days',
      approvalsH: 'Needs your approval', approve: 'Approve', reject: 'Reject', expiresIn: 'expires {when}', whyLine: 'Why: {why}',
      nextRunH: 'Next scheduled action', nextRunNone: 'Nothing scheduled.', lastCheckH: 'Last check', lastCheckNever: 'No check has run yet.', managingH: 'Managing',
      managingN: '{n} selected campaign(s)', managingAll: 'all eligible campaigns on {platforms}', managingNone: 'No campaigns yet.',
      accountsH: 'Connected ad accounts', connected: 'Connected', notConnected: 'Not connected', connect: 'Connect in Control Center',
      recentH: 'Recent activity', viewAll: 'View all activity', noActivity: 'Nothing has happened yet.',
      launchNote: 'Automations manage campaigns that already run in your ad accounts. To build or publish a campaign, use Launch.', openLaunch: 'Open Launch',
      emptyH: 'Nothing is automated yet', emptyP: 'Choose what OrivenAI may do for your published campaigns:',
      emptyB1: 'Switch campaigns on and off at set times, for example during business hours.', emptyB2: 'Watch spend, cost per result or return on ad spend.', emptyB3: 'Get notified, approve each change, or let OrivenAI act within your limits.',
      rulesEmptyH: 'No rules yet', rulesEmptyP: 'A rule watches real campaign data and reacts when a condition is met.',
      schedEmptyH: 'No schedules yet', schedEmptyP: 'A schedule switches campaigns on or off at the times you choose, also when you’re offline.',
      upcomingH: 'Upcoming runs', upcomingNone: 'No upcoming runs.', cancelRun: 'Cancel this run',
      sActive: 'Active', sPaused: 'Paused', sNeedsReview: 'Needs review', sCompleted: 'Finished',
      mNotify: 'Notify only', mApproval: 'Asks first', mAutomatic: 'Automatic', mScheduled: 'Scheduled',
      edit: 'Edit', history: 'History', del: 'Delete', on: 'On', off: 'Off', turnOn: 'Turn on', turnOff: 'Turn off',
      lastChecked: 'Last checked {when}: {checked} campaign(s), {matched} matched.', notChecked: 'Not checked yet.', blockedLine: 'On hold: {why}', skippedLine: 'Not acted on: {list}',
      nextRun: 'Next: {when}',
      fAll: 'All', fCompleted: 'Completed', fFailed: 'Failed', fPartial: 'Partly done', fPending: 'Pending approval', fSkipped: 'Skipped', fCancelled: 'Cancelled',
      exCompleted: 'Completed', exFailed: 'Failed', exPartial: 'Partly done', exSkipped: 'Skipped', exPending: 'Pending approval', exRunning: 'Running', exCancelled: 'Cancelled', exScheduled: 'Scheduled',
      trigLine: 'Because {metric} was {observed} ({op} {threshold}, last {days} days)', schedLineAt: 'Scheduled for {when}',
      // Builder
      bRuleTitle: 'New rule', bScheduleTitle: 'Schedule campaign', bEditTitle: 'Edit automation',
      s1: 'Advertising platform', s2: 'Campaigns', s3: 'Condition', s4: 'What should happen', s5: 'Review', s3s: 'What and when',
      pickPlatform: 'Choose where your campaigns run.', notConnectedHint: 'Not connected yet — connect it in Control Center first.',
      scopeSel: 'Selected campaigns', scopeAll: 'All eligible campaigns in this account', scopeAllHint: 'Includes campaigns you add later. Paused, archived and campaigns the action doesn’t fit are skipped.',
      loadingCampaigns: 'Loading your campaigns…', noCampaigns: 'No published campaigns found in this account.', unpublishedHint: 'Campaigns you haven’t published yet don’t appear here — publish them in Launch first.',
      cStatus: { active: 'Running', paused: 'Paused', other: 'Other' },
      budgetLine: 'Daily budget {amount}', budgetAdsets: 'spread over {n} ad sets/groups', budgetShared: 'Shared budget — rules never change it', budgetLifetime: 'Lifetime budget — rules don’t change it', budgetNone: 'No daily budget',
      metricL: 'Measure', opL: 'Is', valueL: 'Value', windowL: 'Over', windowN: 'the last {n} day(s)', minDataL: 'Minimum data before acting (advanced)', minDataHint: 'OrivenAI never acts on too little data. Leave empty for the defaults.',
      op: { '>': 'more than', '>=': 'at least', '<': 'less than', '<=': 'at most', '==': 'exactly' }, opIs: 'is',
      actionL: 'Action', modeL: 'What may OrivenAI do?',
      aPause: 'Pause the campaign', aResume: 'Resume the campaign', aIncrease: 'Raise the daily budget', aDecrease: 'Lower the daily budget', aNotify: 'Only notify me',
      mdNotify: 'Notify only — no changes to your campaigns.', mdApproval: 'Ask me first — nothing changes until you approve.', mdAutomatic: 'Automatically — OrivenAI makes the change within your limits.',
      pctL: 'Change per step (%)', maxBudgetL: 'Maximum daily budget', maxBudgetHint: 'Required to raise budgets. OrivenAI never goes above it.', minBudgetL: 'Minimum daily budget (optional)',
      limitsL: 'Safety limits (advanced)', cumL: 'Maximum total increase (%)', cumDaysL: 'within (days)', perDayL: 'Maximum budget changes per day', gapL: 'Minimum hours between changes',
      consent: 'I allow OrivenAI to make this change automatically, within the limits above.',
      nameL: 'Name', namePh: 'e.g. Pause campaigns that overspend',
      cost: 'Cost: {n} credits', costNote: 'Charged once when you create it. Checks, notifications and campaign changes are free. Editing, pausing and resuming are free. Deleting doesn’t refund the credits.',
      editFree: 'Editing is free.', create: 'Create automation · {n} credits', save: 'Save changes', cancel: 'Cancel', creating: 'Creating…', saving: 'Saving…',
      actionRowL: 'Action', freqL: 'When', freqOnce: 'Once', freqWeekly: 'Every week', atL: 'Date and time', daysL: 'Days', timeL: 'Time', addRow: '+ Add action', removeRow: 'Remove',
      tplHours: 'Business hours (Mon–Fri, 09:00–18:00)', tplEnd: 'Stop on a date',
      saActivate: 'Switch on', saPause: 'Pause', saResume: 'Resume', saStop: 'Stop (end the campaign)',
      tzL: 'Time zone', untilL: 'Repeat until (optional)', dstNote: 'Times follow this time zone, including daylight saving time. Missed runs (for example during an outage) are skipped, never run late.',
      days: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'], daysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      // Summaries
      sumWhen: 'When {scope} {cond}, {then}.', sumScopeOne: '“{name}”', sumScopeMany: '{n} selected campaigns', sumScopeAll: 'any eligible {platform} campaign',
      sumCond: 'has {metric} {op} {value} over the last {days} day(s)', sumCondStatus: 'is {status}',
      sumThenNotify: 'OrivenAI will notify you', sumThenAsk: 'OrivenAI will ask you to approve: {action}', sumThenAuto: 'OrivenAI will automatically {action}',
      sumActPause: 'pause it', sumActResume: 'resume it', sumActInc: 'raise its daily budget by {pct}% (never above {max})', sumActDec: 'lower its daily budget by {pct}%',
      sumSchedule: 'For {scope}: {items}.', sumOnce: '{action} on {when}', sumWeekly: '{action} every {days} at {time}',
      // Settings
      setH: 'Automation settings', setInApp: 'Show automation updates in OrivenAI', setEmail: 'Email me automation updates', setEmailEvents: 'Email me about', setSaved: 'Settings saved.',
      ev: { executed: 'Actions taken', failed: 'Failures', partial: 'Partly completed actions', approval: 'Approvals needed', paused: 'Campaigns paused', resumed: 'Campaigns resumed', budget_changed: 'Budget changes', scheduled_completed: 'Scheduled actions', disconnected: 'Disconnected accounts', credentials_expired: 'Expired connections' },
      emailNote: 'Updates from one check are grouped into one email (at most 6 per hour).',
      // Confirms / toasts
      confDeleteH: 'Delete this automation?', confDeleteP: 'It stops right away and its upcoming runs are cancelled. Its history stays in Activity. The {n} credits aren’t refunded.',
      confPauseAllH: 'Pause all automations?', confPauseAllP: 'No rule or schedule will change any campaign until you resume. Nothing is deleted.',
      confApproveH: 'Approve this change?', confApproveP: 'OrivenAI checks the campaign again right now and applies the change only if it is still safe.',
      tCreated: 'Automation created.', tSaved: 'Changes saved.', tDeleted: 'Automation deleted.', tPausedAll: 'All automations paused.', tResumedAll: 'Automations resumed.', tApproved: 'Done: {what}', tRejected: 'Rejected. Nothing was changed.', tCancelledRun: 'That run is cancelled.',
      errLoad: 'Couldn’t load Automations. Please try again.', retry: 'Try again', errDb: 'Automations needs a server update before it can be used. Nothing was changed.', errGeneric: 'Something went wrong. Nothing was changed.',
      errCredits: 'Creating an automation costs {n} credits. You don’t have enough credits right now.', plansLink: 'View plans',
      dlgClose: 'Close',
      // Reasons (skips / failures / blocks) in plain words
      rs: {
        insufficient_data: 'not enough data yet', no_data: 'no data from the platform', undefined_ratio: 'not enough results to calculate it', unavailable: 'not reported for this platform',
        not_running: 'campaign isn’t running', not_paused: 'campaign isn’t paused', shared_budget: 'shared budget (affects other campaigns)', lifetime_budget: 'lifetime budget', no_budget: 'no daily budget', unknown_currency: 'currency unknown',
        budget_not_editable: 'budget can’t be changed', campaign_not_found: 'campaign not found in your account', activation_partial: 'campaign is on, but some ad sets or ads are still paused', activation_unverified: 'campaign is on, but delivery couldn’t be confirmed', no_publish_record: 'no record of the ad sets and ads OrivenAI created', wrong_account: 'campaign belongs to a different ad account', activation_incomplete: 'not everything could be switched on', activation_unconfirmed: 'the platform didn’t confirm in time', activation_in_progress: 'another activation of this campaign was running', campaign_archived: 'campaign archived', already_paused: 'already paused', already_active: 'already running', status_unknown: 'status can’t be changed now',
        campaign_not_active: 'campaign isn’t running', no_max_budget: 'no maximum budget set', max_budget_required: 'set a maximum budget', at_max_budget: 'already at the maximum budget', cumulative_limit: 'total increase limit reached', daily_action_limit: 'daily change limit reached', too_soon: 'too soon after the last change',
        at_min_budget: 'already at the minimum budget', change_too_small: 'change too small', conflict: 'another automation wanted the opposite change', superseded_by_pause: 'a pause took priority', duplicate_rule: 'another automation already did this',
        paused_all: 'all automations paused', kill_switch: 'paused by OrivenAI', automation_paused: 'automation turned off', automation_deleted: 'automation deleted', missed: 'missed — not run late', expired: 'approval expired', rejected: 'rejected', cancelled_by_user: 'cancelled by you',
        auth: 'connection expired — reconnect the account', not_connected: 'account not connected', rate_limited: 'platform busy, retried later', transient: 'platform didn’t respond', platform: 'the platform refused the change', permission: 'no permission for this account',
        legacy_action: 'this old action no longer exists — choose a new one', choose_platform: 'choose a platform', metric_unavailable: 'this measure isn’t reported for this platform', stopped: 'schedule ended', rescheduled: 'replaced by a new time', deleted: 'automation deleted', paused: 'automation turned off', not_eligible: 'not eligible',
      },
      plat: { google: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', pinterest: 'Pinterest Ads' },
      metric: {
        spend: ['Spend', 'Amount spent in the period.'], impressions: ['Impressions', 'How often your ads were shown.'], clicks: ['Clicks', 'How often people clicked your ads.'],
        conversions: ['Conversions', 'Purchases, leads or sign-ups the platform recorded.'], ctr: ['Click-through rate (CTR)', 'Share of people who clicked after seeing the ad, in %.'],
        cpc: ['Cost per click (CPC)', 'Average amount spent for one click.'], cpa: ['Cost per conversion (CPA)', 'Average amount spent to get one conversion.'],
        roas: ['Return on ad spend (ROAS)', 'Revenue generated for every unit spent (2 = twice the spend).'], status: ['Campaign status', 'Whether the campaign is running or paused.'],
      },
      act: { pause_campaign: 'Pause', resume_campaign: 'Resume', increase_budget: 'Raise budget', decrease_budget: 'Lower budget', notify: 'Notify', activate: 'Switch on', pause: 'Pause', resume: 'Resume', stop: 'Stop' },
      valuesChange: '{from} → {to}', statusWord: { active: 'running', paused: 'paused' },
      rel: { now: 'just now', min: '{n} min ago', h: '{n} h ago', d: '{n} d ago', inMin: 'in {n} min', inH: 'in {n} h', inD: 'in {n} d' },
    },
    nl: {
      title: 'Automatiseringen', subtitle: 'Plan campagnes, volg hun resultaten en laat OrivenAI handelen binnen grenzen die jij instelt.',
      tabOverview: 'Overzicht', tabScheduler: 'Planner', tabRules: 'Regels', tabActivity: 'Activiteit',
      newRule: 'Nieuwe regel', newSchedule: 'Campagne plannen', pauseAll: 'Alle automatiseringen pauzeren', resumeAll: 'Alle automatiseringen hervatten', settings: 'Instellingen',
      stRunning: 'Actief', stPausedAll: 'Alle automatiseringen gepauzeerd', stKilled: 'Gepauzeerd door OrivenAI', stNoJobs: 'Draait niet op deze server', stChecks: 'regels elke {h} gecontroleerd',
      hours: '{n} u', minutes: '{n} min',
      tActive: 'Actief', tScheduled: 'Geplande acties', tApprovals: 'Wacht op goedkeuring', tDone: 'Uitgevoerd · 7 dagen', tFailed: 'Mislukt · 7 dagen',
      approvalsH: 'Wacht op jouw goedkeuring', approve: 'Goedkeuren', reject: 'Afwijzen', expiresIn: 'verloopt {when}', whyLine: 'Waarom: {why}',
      nextRunH: 'Volgende geplande actie', nextRunNone: 'Niets gepland.', lastCheckH: 'Laatste controle', lastCheckNever: 'Er is nog geen controle uitgevoerd.', managingH: 'Beheert',
      managingN: '{n} geselecteerde campagne(s)', managingAll: 'alle geschikte campagnes op {platforms}', managingNone: 'Nog geen campagnes.',
      accountsH: 'Gekoppelde advertentieaccounts', connected: 'Gekoppeld', notConnected: 'Niet gekoppeld', connect: 'Koppelen in Control Center',
      recentH: 'Recente activiteit', viewAll: 'Alle activiteit bekijken', noActivity: 'Er is nog niets gebeurd.',
      launchNote: 'Automatiseringen beheren campagnes die al in je advertentieaccounts draaien. Een campagne bouwen of publiceren doe je in Launch.', openLaunch: 'Launch openen',
      emptyH: 'Er is nog niets geautomatiseerd', emptyP: 'Kies wat OrivenAI mag doen voor je gepubliceerde campagnes:',
      emptyB1: 'Campagnes op vaste tijden aan- en uitzetten, bijvoorbeeld tijdens kantooruren.', emptyB2: 'Uitgaven, kosten per resultaat of rendement op advertentie-uitgaven volgen.', emptyB3: 'Een melding krijgen, elke wijziging goedkeuren, of OrivenAI binnen jouw grenzen laten handelen.',
      rulesEmptyH: 'Nog geen regels', rulesEmptyP: 'Een regel volgt echte campagnegegevens en reageert als aan een voorwaarde is voldaan.',
      schedEmptyH: 'Nog geen planningen', schedEmptyP: 'Een planning zet campagnes aan of uit op de tijden die jij kiest, ook als je offline bent.',
      upcomingH: 'Komende acties', upcomingNone: 'Geen komende acties.', cancelRun: 'Deze actie annuleren',
      sActive: 'Actief', sPaused: 'Gepauzeerd', sNeedsReview: 'Controle nodig', sCompleted: 'Afgerond',
      mNotify: 'Alleen melden', mApproval: 'Vraagt eerst', mAutomatic: 'Automatisch', mScheduled: 'Gepland',
      edit: 'Bewerken', history: 'Geschiedenis', del: 'Verwijderen', on: 'Aan', off: 'Uit', turnOn: 'Aanzetten', turnOff: 'Uitzetten',
      lastChecked: 'Laatst gecontroleerd {when}: {checked} campagne(s), {matched} voldeed.', notChecked: 'Nog niet gecontroleerd.', blockedLine: 'In de wacht: {why}', skippedLine: 'Niet uitgevoerd: {list}',
      nextRun: 'Volgende: {when}',
      fAll: 'Alles', fCompleted: 'Uitgevoerd', fFailed: 'Mislukt', fPartial: 'Deels uitgevoerd', fPending: 'Wacht op goedkeuring', fSkipped: 'Overgeslagen', fCancelled: 'Geannuleerd',
      exCompleted: 'Uitgevoerd', exFailed: 'Mislukt', exPartial: 'Deels uitgevoerd', exSkipped: 'Overgeslagen', exPending: 'Wacht op goedkeuring', exRunning: 'Bezig', exCancelled: 'Geannuleerd', exScheduled: 'Gepland',
      trigLine: 'Omdat {metric} {observed} was ({op} {threshold}, laatste {days} dagen)', schedLineAt: 'Gepland voor {when}',
      bRuleTitle: 'Nieuwe regel', bScheduleTitle: 'Campagne plannen', bEditTitle: 'Automatisering bewerken',
      s1: 'Advertentieplatform', s2: 'Campagnes', s3: 'Voorwaarde', s4: 'Wat moet er gebeuren', s5: 'Controleren', s3s: 'Wat en wanneer',
      pickPlatform: 'Kies waar je campagnes draaien.', notConnectedHint: 'Nog niet gekoppeld — koppel het eerst in Control Center.',
      scopeSel: 'Geselecteerde campagnes', scopeAll: 'Alle geschikte campagnes in dit account', scopeAllHint: 'Inclusief campagnes die je later toevoegt. Gepauzeerde, gearchiveerde en niet-passende campagnes worden overgeslagen.',
      loadingCampaigns: 'Je campagnes worden geladen…', noCampaigns: 'Geen gepubliceerde campagnes gevonden in dit account.', unpublishedHint: 'Campagnes die je nog niet hebt gepubliceerd staan hier niet — publiceer ze eerst in Launch.',
      cStatus: { active: 'Actief', paused: 'Gepauzeerd', other: 'Anders' },
      budgetLine: 'Dagbudget {amount}', budgetAdsets: 'verdeeld over {n} advertentiesets/-groepen', budgetShared: 'Gedeeld budget — regels wijzigen het nooit', budgetLifetime: 'Looptijdbudget — regels wijzigen het niet', budgetNone: 'Geen dagbudget',
      metricL: 'Meet', opL: 'Is', valueL: 'Waarde', windowL: 'Over', windowN: 'de laatste {n} dag(en)', minDataL: 'Minimale gegevens voordat er iets gebeurt (geavanceerd)', minDataHint: 'OrivenAI handelt nooit op te weinig gegevens. Laat leeg voor de standaardwaarden.',
      op: { '>': 'meer dan', '>=': 'minstens', '<': 'minder dan', '<=': 'hoogstens', '==': 'precies' }, opIs: 'is',
      actionL: 'Actie', modeL: 'Wat mag OrivenAI doen?',
      aPause: 'De campagne pauzeren', aResume: 'De campagne hervatten', aIncrease: 'Het dagbudget verhogen', aDecrease: 'Het dagbudget verlagen', aNotify: 'Mij alleen een melding sturen',
      mdNotify: 'Alleen melden — geen wijzigingen aan je campagnes.', mdApproval: 'Eerst vragen — er verandert niets tot je goedkeurt.', mdAutomatic: 'Automatisch — OrivenAI voert de wijziging uit binnen jouw grenzen.',
      pctL: 'Wijziging per stap (%)', maxBudgetL: 'Maximaal dagbudget', maxBudgetHint: 'Nodig om budgetten te verhogen. OrivenAI gaat er nooit boven.', minBudgetL: 'Minimaal dagbudget (optioneel)',
      limitsL: 'Veiligheidsgrenzen (geavanceerd)', cumL: 'Maximale totale verhoging (%)', cumDaysL: 'binnen (dagen)', perDayL: 'Maximaal aantal budgetwijzigingen per dag', gapL: 'Minimaal aantal uren tussen wijzigingen',
      consent: 'Ik sta OrivenAI toe deze wijziging automatisch uit te voeren, binnen de grenzen hierboven.',
      nameL: 'Naam', namePh: 'bijv. Campagnes pauzeren die te veel uitgeven',
      cost: 'Kosten: {n} credits', costNote: 'Eenmalig bij het aanmaken. Controles, meldingen en campagnewijzigingen zijn gratis. Bewerken, pauzeren en hervatten zijn gratis. Bij verwijderen worden de credits niet terugbetaald.',
      editFree: 'Bewerken is gratis.', create: 'Automatisering aanmaken · {n} credits', save: 'Wijzigingen opslaan', cancel: 'Annuleren', creating: 'Aanmaken…', saving: 'Opslaan…',
      actionRowL: 'Actie', freqL: 'Wanneer', freqOnce: 'Eén keer', freqWeekly: 'Elke week', atL: 'Datum en tijd', daysL: 'Dagen', timeL: 'Tijd', addRow: '+ Actie toevoegen', removeRow: 'Verwijderen',
      tplHours: 'Kantooruren (ma–vr, 09:00–18:00)', tplEnd: 'Stoppen op een datum',
      saActivate: 'Aanzetten', saPause: 'Pauzeren', saResume: 'Hervatten', saStop: 'Stoppen (campagne beëindigen)',
      tzL: 'Tijdzone', untilL: 'Herhalen tot (optioneel)', dstNote: 'Tijden volgen deze tijdzone, inclusief zomer- en wintertijd. Gemiste acties (bijvoorbeeld tijdens een storing) worden overgeslagen, nooit te laat uitgevoerd.',
      days: ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'], daysLong: ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'],
      sumWhen: 'Als {scope} {cond}, {then}.', sumScopeOne: '“{name}”', sumScopeMany: '{n} geselecteerde campagnes', sumScopeAll: 'een geschikte {platform}-campagne',
      sumCond: '{metric} heeft van {op} {value} over de laatste {days} dag(en)', sumCondStatus: '{status} is',
      sumThenNotify: 'stuurt OrivenAI je een melding', sumThenAsk: 'vraagt OrivenAI je goedkeuring om: {action}', sumThenAuto: 'zal OrivenAI automatisch {action}',
      sumActPause: 'de campagne te pauzeren', sumActResume: 'de campagne te hervatten', sumActInc: 'het dagbudget met {pct}% te verhogen (nooit boven {max})', sumActDec: 'het dagbudget met {pct}% te verlagen',
      sumSchedule: 'Voor {scope}: {items}.', sumOnce: '{action} op {when}', sumWeekly: '{action} elke {days} om {time}',
      setH: 'Instellingen voor automatiseringen', setInApp: 'Updates van automatiseringen tonen in OrivenAI', setEmail: 'Updates van automatiseringen per e-mail', setEmailEvents: 'E-mail mij over', setSaved: 'Instellingen opgeslagen.',
      ev: { executed: 'Uitgevoerde acties', failed: 'Mislukte acties', partial: 'Deels uitgevoerde acties', approval: 'Goedkeuring nodig', paused: 'Gepauzeerde campagnes', resumed: 'Hervatte campagnes', budget_changed: 'Budgetwijzigingen', scheduled_completed: 'Geplande acties', disconnected: 'Ontkoppelde accounts', credentials_expired: 'Verlopen koppelingen' },
      emailNote: 'Updates van één controle komen samen in één e-mail (hoogstens 6 per uur).',
      confDeleteH: 'Deze automatisering verwijderen?', confDeleteP: 'Ze stopt direct en komende acties worden geannuleerd. De geschiedenis blijft in Activiteit. De {n} credits worden niet terugbetaald.',
      confPauseAllH: 'Alle automatiseringen pauzeren?', confPauseAllP: 'Geen regel of planning wijzigt een campagne tot je hervat. Er wordt niets verwijderd.',
      confApproveH: 'Deze wijziging goedkeuren?', confApproveP: 'OrivenAI controleert de campagne nu opnieuw en voert de wijziging alleen uit als die nog veilig is.',
      tCreated: 'Automatisering aangemaakt.', tSaved: 'Wijzigingen opgeslagen.', tDeleted: 'Automatisering verwijderd.', tPausedAll: 'Alle automatiseringen gepauzeerd.', tResumedAll: 'Automatiseringen hervat.', tApproved: 'Klaar: {what}', tRejected: 'Afgewezen. Er is niets gewijzigd.', tCancelledRun: 'Die actie is geannuleerd.',
      errLoad: 'Automatiseringen konden niet worden geladen. Probeer het opnieuw.', retry: 'Opnieuw proberen', errDb: 'Automatiseringen heeft eerst een serverupdate nodig. Er is niets gewijzigd.', errGeneric: 'Er ging iets mis. Er is niets gewijzigd.',
      errCredits: 'Een automatisering aanmaken kost {n} credits. Je hebt nu niet genoeg credits.', plansLink: 'Abonnementen bekijken',
      dlgClose: 'Sluiten',
      rs: {
        insufficient_data: 'nog niet genoeg gegevens', no_data: 'geen gegevens van het platform', undefined_ratio: 'te weinig resultaten om dit te berekenen', unavailable: 'niet gerapporteerd voor dit platform',
        not_running: 'campagne draait niet', not_paused: 'campagne is niet gepauzeerd', shared_budget: 'gedeeld budget (raakt andere campagnes)', lifetime_budget: 'looptijdbudget', no_budget: 'geen dagbudget', unknown_currency: 'valuta onbekend',
        budget_not_editable: 'budget kan niet worden gewijzigd', campaign_not_found: 'campagne niet gevonden in je account', activation_partial: 'campagne staat aan, maar sommige advertentiesets of advertenties zijn nog gepauzeerd', activation_unverified: 'campagne staat aan, maar levering kon niet worden bevestigd', no_publish_record: 'geen gegevens van de advertentiesets en advertenties die OrivenAI heeft gemaakt', wrong_account: 'campagne hoort bij een ander advertentieaccount', activation_incomplete: 'niet alles kon worden aangezet', activation_unconfirmed: 'het platform heeft niet op tijd bevestigd', activation_in_progress: 'er liep al een activering van deze campagne', campaign_archived: 'campagne gearchiveerd', already_paused: 'al gepauzeerd', already_active: 'draait al', status_unknown: 'status kan nu niet worden gewijzigd',
        campaign_not_active: 'campagne draait niet', no_max_budget: 'geen maximaal budget ingesteld', max_budget_required: 'stel een maximaal budget in', at_max_budget: 'al op het maximale budget', cumulative_limit: 'grens voor totale verhoging bereikt', daily_action_limit: 'dagelijkse grens voor wijzigingen bereikt', too_soon: 'te snel na de vorige wijziging',
        at_min_budget: 'al op het minimale budget', change_too_small: 'wijziging te klein', conflict: 'een andere automatisering wilde het omgekeerde', superseded_by_pause: 'een pauze had voorrang', duplicate_rule: 'een andere automatisering deed dit al',
        paused_all: 'alle automatiseringen gepauzeerd', kill_switch: 'gepauzeerd door OrivenAI', automation_paused: 'automatisering staat uit', automation_deleted: 'automatisering verwijderd', missed: 'gemist — niet te laat uitgevoerd', expired: 'goedkeuring verlopen', rejected: 'afgewezen', cancelled_by_user: 'door jou geannuleerd',
        auth: 'koppeling verlopen — koppel het account opnieuw', not_connected: 'account niet gekoppeld', rate_limited: 'platform druk, later opnieuw geprobeerd', transient: 'platform reageerde niet', platform: 'het platform weigerde de wijziging', permission: 'geen toegang tot dit account',
        legacy_action: 'deze oude actie bestaat niet meer — kies een nieuwe', choose_platform: 'kies een platform', metric_unavailable: 'deze meting wordt niet gerapporteerd voor dit platform', stopped: 'planning beëindigd', rescheduled: 'vervangen door een nieuw tijdstip', deleted: 'automatisering verwijderd', paused: 'automatisering staat uit', not_eligible: 'niet geschikt',
      },
      plat: { google: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', pinterest: 'Pinterest Ads' },
      metric: {
        spend: ['Uitgaven', 'Bedrag dat in de periode is uitgegeven.'], impressions: ['Vertoningen', 'Hoe vaak je advertenties zijn getoond.'], clicks: ['Klikken', 'Hoe vaak mensen op je advertenties klikten.'],
        conversions: ['Conversies', 'Aankopen, leads of aanmeldingen die het platform registreerde.'], ctr: ['Klikfrequentie (CTR)', 'Aandeel mensen dat klikte na het zien van de advertentie, in %.'],
        cpc: ['Kosten per klik (CPC)', 'Gemiddeld bedrag voor één klik.'], cpa: ['Kosten per conversie (CPA)', 'Gemiddeld bedrag om één conversie te krijgen.'],
        roas: ['Rendement op advertentie-uitgaven (ROAS)', 'Opbrengst per uitgegeven eenheid (2 = twee keer de uitgaven).'], status: ['Campagnestatus', 'Of de campagne draait of gepauzeerd is.'],
      },
      act: { pause_campaign: 'Pauzeren', resume_campaign: 'Hervatten', increase_budget: 'Budget verhogen', decrease_budget: 'Budget verlagen', notify: 'Melden', activate: 'Aanzetten', pause: 'Pauzeren', resume: 'Hervatten', stop: 'Stoppen' },
      valuesChange: '{from} → {to}', statusWord: { active: 'actief', paused: 'gepauzeerd' },
      rel: { now: 'zojuist', min: '{n} min geleden', h: '{n} u geleden', d: '{n} d geleden', inMin: 'over {n} min', inH: 'over {n} u', inD: 'over {n} d' },
    },
    de: {
      title: 'Automatisierungen', subtitle: 'Kampagnen planen, ihre Leistung beobachten und OrivenAI innerhalb deiner Grenzen handeln lassen.',
      tabOverview: 'Übersicht', tabScheduler: 'Planer', tabRules: 'Regeln', tabActivity: 'Aktivität',
      newRule: 'Neue Regel', newSchedule: 'Kampagne planen', pauseAll: 'Alle Automatisierungen pausieren', resumeAll: 'Alle Automatisierungen fortsetzen', settings: 'Einstellungen',
      stRunning: 'Aktiv', stPausedAll: 'Alle Automatisierungen pausiert', stKilled: 'Von OrivenAI pausiert', stNoJobs: 'Läuft auf diesem Server nicht', stChecks: 'Regeln alle {h} geprüft',
      hours: '{n} Std.', minutes: '{n} Min.',
      tActive: 'Aktiv', tScheduled: 'Geplante Aktionen', tApprovals: 'Warten auf Freigabe', tDone: 'Erledigt · 7 Tage', tFailed: 'Fehlgeschlagen · 7 Tage',
      approvalsH: 'Wartet auf deine Freigabe', approve: 'Freigeben', reject: 'Ablehnen', expiresIn: 'läuft ab {when}', whyLine: 'Grund: {why}',
      nextRunH: 'Nächste geplante Aktion', nextRunNone: 'Nichts geplant.', lastCheckH: 'Letzte Prüfung', lastCheckNever: 'Es wurde noch nicht geprüft.', managingH: 'Verwaltet',
      managingN: '{n} ausgewählte Kampagne(n)', managingAll: 'alle geeigneten Kampagnen auf {platforms}', managingNone: 'Noch keine Kampagnen.',
      accountsH: 'Verbundene Werbekonten', connected: 'Verbunden', notConnected: 'Nicht verbunden', connect: 'Im Control Center verbinden',
      recentH: 'Letzte Aktivität', viewAll: 'Alle Aktivitäten ansehen', noActivity: 'Es ist noch nichts passiert.',
      launchNote: 'Automatisierungen verwalten Kampagnen, die bereits in deinen Werbekonten laufen. Kampagnen erstellst und veröffentlichst du in Launch.', openLaunch: 'Launch öffnen',
      emptyH: 'Noch nichts automatisiert', emptyP: 'Wähle, was OrivenAI für deine veröffentlichten Kampagnen tun darf:',
      emptyB1: 'Kampagnen zu festen Zeiten ein- und ausschalten, zum Beispiel während der Geschäftszeiten.', emptyB2: 'Ausgaben, Kosten pro Ergebnis oder den Return on Ad Spend beobachten.', emptyB3: 'Benachrichtigt werden, jede Änderung freigeben oder OrivenAI innerhalb deiner Grenzen handeln lassen.',
      rulesEmptyH: 'Noch keine Regeln', rulesEmptyP: 'Eine Regel beobachtet echte Kampagnendaten und reagiert, wenn eine Bedingung erfüllt ist.',
      schedEmptyH: 'Noch keine Zeitpläne', schedEmptyP: 'Ein Zeitplan schaltet Kampagnen zu den gewählten Zeiten ein oder aus, auch wenn du offline bist.',
      upcomingH: 'Anstehende Aktionen', upcomingNone: 'Keine anstehenden Aktionen.', cancelRun: 'Diese Aktion abbrechen',
      sActive: 'Aktiv', sPaused: 'Pausiert', sNeedsReview: 'Prüfung nötig', sCompleted: 'Abgeschlossen',
      mNotify: 'Nur benachrichtigen', mApproval: 'Fragt zuerst', mAutomatic: 'Automatisch', mScheduled: 'Geplant',
      edit: 'Bearbeiten', history: 'Verlauf', del: 'Löschen', on: 'An', off: 'Aus', turnOn: 'Einschalten', turnOff: 'Ausschalten',
      lastChecked: 'Zuletzt geprüft {when}: {checked} Kampagne(n), {matched} zutreffend.', notChecked: 'Noch nicht geprüft.', blockedLine: 'Angehalten: {why}', skippedLine: 'Nicht ausgeführt: {list}',
      nextRun: 'Nächste: {when}',
      fAll: 'Alle', fCompleted: 'Erledigt', fFailed: 'Fehlgeschlagen', fPartial: 'Teilweise erledigt', fPending: 'Wartet auf Freigabe', fSkipped: 'Übersprungen', fCancelled: 'Abgebrochen',
      exCompleted: 'Erledigt', exFailed: 'Fehlgeschlagen', exPartial: 'Teilweise erledigt', exSkipped: 'Übersprungen', exPending: 'Wartet auf Freigabe', exRunning: 'Läuft', exCancelled: 'Abgebrochen', exScheduled: 'Geplant',
      trigLine: 'Weil {metric} bei {observed} lag ({op} {threshold}, letzte {days} Tage)', schedLineAt: 'Geplant für {when}',
      bRuleTitle: 'Neue Regel', bScheduleTitle: 'Kampagne planen', bEditTitle: 'Automatisierung bearbeiten',
      s1: 'Werbeplattform', s2: 'Kampagnen', s3: 'Bedingung', s4: 'Was soll passieren', s5: 'Überprüfen', s3s: 'Was und wann',
      pickPlatform: 'Wähle, wo deine Kampagnen laufen.', notConnectedHint: 'Noch nicht verbunden — verbinde es zuerst im Control Center.',
      scopeSel: 'Ausgewählte Kampagnen', scopeAll: 'Alle geeigneten Kampagnen in diesem Konto', scopeAllHint: 'Inklusive später hinzugefügter Kampagnen. Pausierte, archivierte und unpassende Kampagnen werden übersprungen.',
      loadingCampaigns: 'Deine Kampagnen werden geladen…', noCampaigns: 'Keine veröffentlichten Kampagnen in diesem Konto gefunden.', unpublishedHint: 'Noch nicht veröffentlichte Kampagnen erscheinen hier nicht — veröffentliche sie zuerst in Launch.',
      cStatus: { active: 'Läuft', paused: 'Pausiert', other: 'Sonstige' },
      budgetLine: 'Tagesbudget {amount}', budgetAdsets: 'verteilt auf {n} Anzeigengruppen', budgetShared: 'Gemeinsames Budget — Regeln ändern es nie', budgetLifetime: 'Laufzeitbudget — Regeln ändern es nicht', budgetNone: 'Kein Tagesbudget',
      metricL: 'Messen', opL: 'Ist', valueL: 'Wert', windowL: 'Über', windowN: 'die letzten {n} Tag(e)', minDataL: 'Mindestdaten vor einer Aktion (erweitert)', minDataHint: 'OrivenAI handelt nie auf zu wenig Daten. Leer lassen für die Standardwerte.',
      op: { '>': 'mehr als', '>=': 'mindestens', '<': 'weniger als', '<=': 'höchstens', '==': 'genau' }, opIs: 'ist',
      actionL: 'Aktion', modeL: 'Was darf OrivenAI tun?',
      aPause: 'Kampagne pausieren', aResume: 'Kampagne fortsetzen', aIncrease: 'Tagesbudget erhöhen', aDecrease: 'Tagesbudget senken', aNotify: 'Mich nur benachrichtigen',
      mdNotify: 'Nur benachrichtigen — keine Änderungen an deinen Kampagnen.', mdApproval: 'Zuerst fragen — nichts ändert sich ohne deine Freigabe.', mdAutomatic: 'Automatisch — OrivenAI ändert innerhalb deiner Grenzen.',
      pctL: 'Änderung pro Schritt (%)', maxBudgetL: 'Maximales Tagesbudget', maxBudgetHint: 'Nötig, um Budgets zu erhöhen. OrivenAI überschreitet es nie.', minBudgetL: 'Minimales Tagesbudget (optional)',
      limitsL: 'Sicherheitsgrenzen (erweitert)', cumL: 'Maximale Gesamterhöhung (%)', cumDaysL: 'innerhalb von (Tagen)', perDayL: 'Maximale Budgetänderungen pro Tag', gapL: 'Mindeststunden zwischen Änderungen',
      consent: 'Ich erlaube OrivenAI, diese Änderung automatisch innerhalb der obigen Grenzen vorzunehmen.',
      nameL: 'Name', namePh: 'z. B. Kampagnen mit zu hohen Ausgaben pausieren',
      cost: 'Kosten: {n} Credits', costNote: 'Einmalig beim Erstellen. Prüfungen, Benachrichtigungen und Kampagnenänderungen sind kostenlos. Bearbeiten, Pausieren und Fortsetzen sind kostenlos. Beim Löschen werden die Credits nicht erstattet.',
      editFree: 'Bearbeiten ist kostenlos.', create: 'Automatisierung erstellen · {n} Credits', save: 'Änderungen speichern', cancel: 'Abbrechen', creating: 'Wird erstellt…', saving: 'Wird gespeichert…',
      actionRowL: 'Aktion', freqL: 'Wann', freqOnce: 'Einmal', freqWeekly: 'Jede Woche', atL: 'Datum und Uhrzeit', daysL: 'Tage', timeL: 'Uhrzeit', addRow: '+ Aktion hinzufügen', removeRow: 'Entfernen',
      tplHours: 'Geschäftszeiten (Mo–Fr, 09:00–18:00)', tplEnd: 'An einem Datum beenden',
      saActivate: 'Einschalten', saPause: 'Pausieren', saResume: 'Fortsetzen', saStop: 'Beenden (Kampagne stoppen)',
      tzL: 'Zeitzone', untilL: 'Wiederholen bis (optional)', dstNote: 'Die Zeiten folgen dieser Zeitzone, auch bei Sommer- und Winterzeit. Verpasste Aktionen (z. B. bei einem Ausfall) werden übersprungen, nie verspätet ausgeführt.',
      days: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], daysLong: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
      sumWhen: 'Wenn {scope} {cond}, {then}.', sumScopeOne: '„{name}“', sumScopeMany: '{n} ausgewählte Kampagnen', sumScopeAll: 'eine geeignete {platform}-Kampagne',
      sumCond: 'in den letzten {days} Tag(en) {metric} von {op} {value} hat', sumCondStatus: '{status} ist',
      sumThenNotify: 'benachrichtigt dich OrivenAI', sumThenAsk: 'bittet OrivenAI dich um Freigabe: {action}', sumThenAuto: 'wird OrivenAI automatisch {action}',
      sumActPause: 'die Kampagne pausieren', sumActResume: 'die Kampagne fortsetzen', sumActInc: 'das Tagesbudget um {pct} % erhöhen (nie über {max})', sumActDec: 'das Tagesbudget um {pct} % senken',
      sumSchedule: 'Für {scope}: {items}.', sumOnce: '{action} am {when}', sumWeekly: '{action} jeden {days} um {time}',
      setH: 'Einstellungen für Automatisierungen', setInApp: 'Updates von Automatisierungen in OrivenAI anzeigen', setEmail: 'Updates von Automatisierungen per E-Mail', setEmailEvents: 'E-Mail bei', setSaved: 'Einstellungen gespeichert.',
      ev: { executed: 'Ausgeführten Aktionen', failed: 'Fehlern', partial: 'Teilweise erledigten Aktionen', approval: 'Nötigen Freigaben', paused: 'Pausierten Kampagnen', resumed: 'Fortgesetzten Kampagnen', budget_changed: 'Budgetänderungen', scheduled_completed: 'Geplanten Aktionen', disconnected: 'Getrennten Konten', credentials_expired: 'Abgelaufenen Verbindungen' },
      emailNote: 'Updates einer Prüfung kommen gesammelt in einer E-Mail (höchstens 6 pro Stunde).',
      confDeleteH: 'Diese Automatisierung löschen?', confDeleteP: 'Sie stoppt sofort und anstehende Aktionen werden abgebrochen. Der Verlauf bleibt in Aktivität. Die {n} Credits werden nicht erstattet.',
      confPauseAllH: 'Alle Automatisierungen pausieren?', confPauseAllP: 'Keine Regel und kein Zeitplan ändert eine Kampagne, bis du fortsetzt. Es wird nichts gelöscht.',
      confApproveH: 'Diese Änderung freigeben?', confApproveP: 'OrivenAI prüft die Kampagne jetzt erneut und führt die Änderung nur aus, wenn sie noch sicher ist.',
      tCreated: 'Automatisierung erstellt.', tSaved: 'Änderungen gespeichert.', tDeleted: 'Automatisierung gelöscht.', tPausedAll: 'Alle Automatisierungen pausiert.', tResumedAll: 'Automatisierungen fortgesetzt.', tApproved: 'Erledigt: {what}', tRejected: 'Abgelehnt. Es wurde nichts geändert.', tCancelledRun: 'Diese Aktion ist abgebrochen.',
      errLoad: 'Automatisierungen konnten nicht geladen werden. Bitte versuche es erneut.', retry: 'Erneut versuchen', errDb: 'Automatisierungen benötigt zuerst ein Server-Update. Es wurde nichts geändert.', errGeneric: 'Etwas ist schiefgelaufen. Es wurde nichts geändert.',
      errCredits: 'Eine Automatisierung zu erstellen kostet {n} Credits. Du hast gerade nicht genug Credits.', plansLink: 'Tarife ansehen',
      dlgClose: 'Schließen',
      rs: {
        insufficient_data: 'noch nicht genug Daten', no_data: 'keine Daten von der Plattform', undefined_ratio: 'zu wenige Ergebnisse für die Berechnung', unavailable: 'für diese Plattform nicht gemeldet',
        not_running: 'Kampagne läuft nicht', not_paused: 'Kampagne ist nicht pausiert', shared_budget: 'gemeinsames Budget (betrifft andere Kampagnen)', lifetime_budget: 'Laufzeitbudget', no_budget: 'kein Tagesbudget', unknown_currency: 'Währung unbekannt',
        budget_not_editable: 'Budget kann nicht geändert werden', campaign_not_found: 'Kampagne in deinem Konto nicht gefunden', activation_partial: 'Kampagne ist an, aber einige Anzeigengruppen oder Anzeigen sind noch pausiert', activation_unverified: 'Kampagne ist an, aber die Auslieferung konnte nicht bestätigt werden', no_publish_record: 'keine Aufzeichnung der Anzeigengruppen und Anzeigen, die OrivenAI erstellt hat', wrong_account: 'Kampagne gehört zu einem anderen Werbekonto', activation_incomplete: 'nicht alles konnte eingeschaltet werden', activation_unconfirmed: 'die Plattform hat nicht rechtzeitig bestätigt', activation_in_progress: 'eine andere Aktivierung dieser Kampagne lief bereits', campaign_archived: 'Kampagne archiviert', already_paused: 'bereits pausiert', already_active: 'läuft bereits', status_unknown: 'Status kann gerade nicht geändert werden',
        campaign_not_active: 'Kampagne läuft nicht', no_max_budget: 'kein maximales Budget festgelegt', max_budget_required: 'lege ein maximales Budget fest', at_max_budget: 'bereits beim maximalen Budget', cumulative_limit: 'Grenze für die Gesamterhöhung erreicht', daily_action_limit: 'tägliche Änderungsgrenze erreicht', too_soon: 'zu kurz nach der letzten Änderung',
        at_min_budget: 'bereits beim minimalen Budget', change_too_small: 'Änderung zu klein', conflict: 'eine andere Automatisierung wollte das Gegenteil', superseded_by_pause: 'eine Pause hatte Vorrang', duplicate_rule: 'eine andere Automatisierung hat das bereits erledigt',
        paused_all: 'alle Automatisierungen pausiert', kill_switch: 'von OrivenAI pausiert', automation_paused: 'Automatisierung ausgeschaltet', automation_deleted: 'Automatisierung gelöscht', missed: 'verpasst — nicht verspätet ausgeführt', expired: 'Freigabe abgelaufen', rejected: 'abgelehnt', cancelled_by_user: 'von dir abgebrochen',
        auth: 'Verbindung abgelaufen — Konto neu verbinden', not_connected: 'Konto nicht verbunden', rate_limited: 'Plattform ausgelastet, später erneut versucht', transient: 'Plattform hat nicht geantwortet', platform: 'die Plattform hat die Änderung abgelehnt', permission: 'keine Berechtigung für dieses Konto',
        legacy_action: 'diese alte Aktion gibt es nicht mehr — wähle eine neue', choose_platform: 'wähle eine Plattform', metric_unavailable: 'dieser Wert wird für diese Plattform nicht gemeldet', stopped: 'Zeitplan beendet', rescheduled: 'durch eine neue Zeit ersetzt', deleted: 'Automatisierung gelöscht', paused: 'Automatisierung ausgeschaltet', not_eligible: 'nicht geeignet',
      },
      plat: { google: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', pinterest: 'Pinterest Ads' },
      metric: {
        spend: ['Ausgaben', 'Im Zeitraum ausgegebener Betrag.'], impressions: ['Impressionen', 'Wie oft deine Anzeigen gezeigt wurden.'], clicks: ['Klicks', 'Wie oft Leute auf deine Anzeigen geklickt haben.'],
        conversions: ['Conversions', 'Käufe, Leads oder Anmeldungen, die die Plattform erfasst hat.'], ctr: ['Klickrate (CTR)', 'Anteil der Leute, die nach dem Sehen geklickt haben, in %.'],
        cpc: ['Kosten pro Klick (CPC)', 'Durchschnittlicher Betrag für einen Klick.'], cpa: ['Kosten pro Conversion (CPA)', 'Durchschnittlicher Betrag für eine Conversion.'],
        roas: ['Return on Ad Spend (ROAS)', 'Umsatz pro ausgegebener Einheit (2 = doppelte Ausgaben).'], status: ['Kampagnenstatus', 'Ob die Kampagne läuft oder pausiert ist.'],
      },
      act: { pause_campaign: 'Pausieren', resume_campaign: 'Fortsetzen', increase_budget: 'Budget erhöhen', decrease_budget: 'Budget senken', notify: 'Benachrichtigen', activate: 'Einschalten', pause: 'Pausieren', resume: 'Fortsetzen', stop: 'Beenden' },
      valuesChange: '{from} → {to}', statusWord: { active: 'aktiv', paused: 'pausiert' },
      rel: { now: 'gerade eben', min: 'vor {n} Min.', h: 'vor {n} Std.', d: 'vor {n} T.', inMin: 'in {n} Min.', inH: 'in {n} Std.', inD: 'in {n} T.' },
    },
    fr: {
      title: 'Automatisations', subtitle: 'Planifiez vos campagnes, suivez leurs performances et laissez OrivenAI agir dans les limites que vous fixez.',
      tabOverview: 'Aperçu', tabScheduler: 'Planificateur', tabRules: 'Règles', tabActivity: 'Activité',
      newRule: 'Nouvelle règle', newSchedule: 'Planifier une campagne', pauseAll: 'Mettre toutes les automatisations en pause', resumeAll: 'Reprendre toutes les automatisations', settings: 'Paramètres',
      stRunning: 'Actif', stPausedAll: 'Toutes les automatisations en pause', stKilled: 'Mis en pause par OrivenAI', stNoJobs: 'Ne tourne pas sur ce serveur', stChecks: 'règles vérifiées toutes les {h}',
      hours: '{n} h', minutes: '{n} min',
      tActive: 'Actives', tScheduled: 'Actions planifiées', tApprovals: 'En attente d’approbation', tDone: 'Effectuées · 7 jours', tFailed: 'Échouées · 7 jours',
      approvalsH: 'En attente de votre approbation', approve: 'Approuver', reject: 'Refuser', expiresIn: 'expire {when}', whyLine: 'Pourquoi : {why}',
      nextRunH: 'Prochaine action planifiée', nextRunNone: 'Rien de planifié.', lastCheckH: 'Dernière vérification', lastCheckNever: 'Aucune vérification n’a encore eu lieu.', managingH: 'Gère',
      managingN: '{n} campagne(s) sélectionnée(s)', managingAll: 'toutes les campagnes éligibles sur {platforms}', managingNone: 'Pas encore de campagnes.',
      accountsH: 'Comptes publicitaires connectés', connected: 'Connecté', notConnected: 'Non connecté', connect: 'Connecter dans le Control Center',
      recentH: 'Activité récente', viewAll: 'Voir toute l’activité', noActivity: 'Rien ne s’est encore passé.',
      launchNote: 'Les automatisations gèrent des campagnes déjà actives dans vos comptes publicitaires. Pour créer ou publier une campagne, utilisez Launch.', openLaunch: 'Ouvrir Launch',
      emptyH: 'Rien n’est encore automatisé', emptyP: 'Choisissez ce qu’OrivenAI peut faire pour vos campagnes publiées :',
      emptyB1: 'Activer et désactiver des campagnes à heures fixes, par exemple pendant les heures d’ouverture.', emptyB2: 'Suivre les dépenses, le coût par résultat ou le retour sur dépenses publicitaires.', emptyB3: 'Être notifié, approuver chaque changement ou laisser OrivenAI agir dans vos limites.',
      rulesEmptyH: 'Pas encore de règles', rulesEmptyP: 'Une règle suit les vraies données de campagne et réagit quand une condition est remplie.',
      schedEmptyH: 'Pas encore de planifications', schedEmptyP: 'Une planification active ou désactive des campagnes aux heures choisies, même quand vous êtes hors ligne.',
      upcomingH: 'Actions à venir', upcomingNone: 'Aucune action à venir.', cancelRun: 'Annuler cette action',
      sActive: 'Active', sPaused: 'En pause', sNeedsReview: 'À revoir', sCompleted: 'Terminée',
      mNotify: 'Notification seulement', mApproval: 'Demande d’abord', mAutomatic: 'Automatique', mScheduled: 'Planifiée',
      edit: 'Modifier', history: 'Historique', del: 'Supprimer', on: 'Activée', off: 'Désactivée', turnOn: 'Activer', turnOff: 'Désactiver',
      lastChecked: 'Vérifiée {when} : {checked} campagne(s), {matched} concernée(s).', notChecked: 'Pas encore vérifiée.', blockedLine: 'En attente : {why}', skippedLine: 'Non appliqué : {list}',
      nextRun: 'Prochaine : {when}',
      fAll: 'Tout', fCompleted: 'Effectuées', fFailed: 'Échouées', fPartial: 'Partiellement effectuées', fPending: 'En attente d’approbation', fSkipped: 'Ignorées', fCancelled: 'Annulées',
      exCompleted: 'Effectuée', exFailed: 'Échouée', exPartial: 'Partiellement effectuée', exSkipped: 'Ignorée', exPending: 'En attente d’approbation', exRunning: 'En cours', exCancelled: 'Annulée', exScheduled: 'Planifiée',
      trigLine: 'Car {metric} était de {observed} ({op} {threshold}, {days} derniers jours)', schedLineAt: 'Planifiée pour {when}',
      bRuleTitle: 'Nouvelle règle', bScheduleTitle: 'Planifier une campagne', bEditTitle: 'Modifier l’automatisation',
      s1: 'Plateforme publicitaire', s2: 'Campagnes', s3: 'Condition', s4: 'Que doit-il se passer', s5: 'Vérifier', s3s: 'Quoi et quand',
      pickPlatform: 'Choisissez où tournent vos campagnes.', notConnectedHint: 'Pas encore connecté — connectez-le d’abord dans le Control Center.',
      scopeSel: 'Campagnes sélectionnées', scopeAll: 'Toutes les campagnes éligibles de ce compte', scopeAllHint: 'Y compris les campagnes ajoutées plus tard. Les campagnes en pause, archivées ou non adaptées sont ignorées.',
      loadingCampaigns: 'Chargement de vos campagnes…', noCampaigns: 'Aucune campagne publiée trouvée dans ce compte.', unpublishedHint: 'Les campagnes pas encore publiées n’apparaissent pas ici — publiez-les d’abord dans Launch.',
      cStatus: { active: 'Active', paused: 'En pause', other: 'Autre' },
      budgetLine: 'Budget quotidien {amount}', budgetAdsets: 'réparti sur {n} ensembles/groupes', budgetShared: 'Budget partagé — jamais modifié par les règles', budgetLifetime: 'Budget global — non modifié par les règles', budgetNone: 'Pas de budget quotidien',
      metricL: 'Mesurer', opL: 'Est', valueL: 'Valeur', windowL: 'Sur', windowN: 'les {n} dernier(s) jour(s)', minDataL: 'Données minimales avant d’agir (avancé)', minDataHint: 'OrivenAI n’agit jamais sur trop peu de données. Laissez vide pour les valeurs par défaut.',
      op: { '>': 'plus de', '>=': 'au moins', '<': 'moins de', '<=': 'au plus', '==': 'exactement' }, opIs: 'est',
      actionL: 'Action', modeL: 'Que peut faire OrivenAI ?',
      aPause: 'Mettre la campagne en pause', aResume: 'Reprendre la campagne', aIncrease: 'Augmenter le budget quotidien', aDecrease: 'Baisser le budget quotidien', aNotify: 'Me notifier seulement',
      mdNotify: 'Notification seulement — aucun changement sur vos campagnes.', mdApproval: 'Me demander d’abord — rien ne change sans votre accord.', mdAutomatic: 'Automatiquement — OrivenAI applique le changement dans vos limites.',
      pctL: 'Changement par étape (%)', maxBudgetL: 'Budget quotidien maximal', maxBudgetHint: 'Obligatoire pour augmenter les budgets. OrivenAI ne le dépasse jamais.', minBudgetL: 'Budget quotidien minimal (facultatif)',
      limitsL: 'Limites de sécurité (avancé)', cumL: 'Augmentation totale maximale (%)', cumDaysL: 'sur (jours)', perDayL: 'Changements de budget maximum par jour', gapL: 'Heures minimum entre deux changements',
      consent: 'J’autorise OrivenAI à appliquer ce changement automatiquement, dans les limites ci-dessus.',
      nameL: 'Nom', namePh: 'ex. Mettre en pause les campagnes qui dépensent trop',
      cost: 'Coût : {n} crédits', costNote: 'Prélevé une seule fois à la création. Vérifications, notifications et changements de campagne sont gratuits. Modifier, mettre en pause et reprendre sont gratuits. La suppression ne rembourse pas les crédits.',
      editFree: 'La modification est gratuite.', create: 'Créer l’automatisation · {n} crédits', save: 'Enregistrer', cancel: 'Annuler', creating: 'Création…', saving: 'Enregistrement…',
      actionRowL: 'Action', freqL: 'Quand', freqOnce: 'Une fois', freqWeekly: 'Chaque semaine', atL: 'Date et heure', daysL: 'Jours', timeL: 'Heure', addRow: '+ Ajouter une action', removeRow: 'Retirer',
      tplHours: 'Heures d’ouverture (lun–ven, 09:00–18:00)', tplEnd: 'Arrêter à une date',
      saActivate: 'Activer', saPause: 'Mettre en pause', saResume: 'Reprendre', saStop: 'Arrêter (terminer la campagne)',
      tzL: 'Fuseau horaire', untilL: 'Répéter jusqu’au (facultatif)', dstNote: 'Les heures suivent ce fuseau, changements d’heure inclus. Les actions manquées (par exemple pendant une panne) sont ignorées, jamais exécutées en retard.',
      days: ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'], daysLong: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
      sumWhen: 'Quand {scope} {cond}, {then}.', sumScopeOne: '« {name} »', sumScopeMany: '{n} campagnes sélectionnées', sumScopeAll: 'une campagne {platform} éligible',
      sumCond: 'a {op} {value} de {metric} sur les {days} dernier(s) jour(s)', sumCondStatus: 'est {status}',
      sumThenNotify: 'OrivenAI vous envoie une notification', sumThenAsk: 'OrivenAI vous demande d’approuver : {action}', sumThenAuto: 'OrivenAI va automatiquement {action}',
      sumActPause: 'la mettre en pause', sumActResume: 'la reprendre', sumActInc: 'augmenter son budget quotidien de {pct} % (jamais au-delà de {max})', sumActDec: 'baisser son budget quotidien de {pct} %',
      sumSchedule: 'Pour {scope} : {items}.', sumOnce: '{action} le {when}', sumWeekly: '{action} chaque {days} à {time}',
      setH: 'Paramètres des automatisations', setInApp: 'Afficher les mises à jour dans OrivenAI', setEmail: 'Recevoir les mises à jour par e-mail', setEmailEvents: 'M’écrire pour', setSaved: 'Paramètres enregistrés.',
      ev: { executed: 'Actions effectuées', failed: 'Échecs', partial: 'Actions partiellement effectuées', approval: 'Approbations nécessaires', paused: 'Campagnes en pause', resumed: 'Campagnes reprises', budget_changed: 'Changements de budget', scheduled_completed: 'Actions planifiées', disconnected: 'Comptes déconnectés', credentials_expired: 'Connexions expirées' },
      emailNote: 'Les mises à jour d’une vérification sont regroupées dans un seul e-mail (6 par heure au maximum).',
      confDeleteH: 'Supprimer cette automatisation ?', confDeleteP: 'Elle s’arrête tout de suite et ses actions à venir sont annulées. Son historique reste dans Activité. Les {n} crédits ne sont pas remboursés.',
      confPauseAllH: 'Mettre toutes les automatisations en pause ?', confPauseAllP: 'Aucune règle ni planification ne modifiera une campagne avant la reprise. Rien n’est supprimé.',
      confApproveH: 'Approuver ce changement ?', confApproveP: 'OrivenAI revérifie la campagne maintenant et n’applique le changement que s’il est toujours sûr.',
      tCreated: 'Automatisation créée.', tSaved: 'Modifications enregistrées.', tDeleted: 'Automatisation supprimée.', tPausedAll: 'Toutes les automatisations sont en pause.', tResumedAll: 'Automatisations reprises.', tApproved: 'Fait : {what}', tRejected: 'Refusé. Rien n’a été modifié.', tCancelledRun: 'Cette action est annulée.',
      errLoad: 'Impossible de charger les automatisations. Veuillez réessayer.', retry: 'Réessayer', errDb: 'Les automatisations nécessitent d’abord une mise à jour du serveur. Rien n’a été modifié.', errGeneric: 'Une erreur s’est produite. Rien n’a été modifié.',
      errCredits: 'Créer une automatisation coûte {n} crédits. Vous n’avez pas assez de crédits pour le moment.', plansLink: 'Voir les offres',
      dlgClose: 'Fermer',
      rs: {
        insufficient_data: 'pas encore assez de données', no_data: 'aucune donnée de la plateforme', undefined_ratio: 'pas assez de résultats pour le calculer', unavailable: 'non fourni pour cette plateforme',
        not_running: 'la campagne ne tourne pas', not_paused: 'la campagne n’est pas en pause', shared_budget: 'budget partagé (touche d’autres campagnes)', lifetime_budget: 'budget global', no_budget: 'pas de budget quotidien', unknown_currency: 'devise inconnue',
        budget_not_editable: 'le budget ne peut pas être modifié', campaign_not_found: 'campagne introuvable dans votre compte', activation_partial: 'la campagne est active, mais certains ensembles de publicités ou publicités sont encore en pause', activation_unverified: 'la campagne est active, mais la diffusion n’a pas pu être confirmée', no_publish_record: 'aucune trace des ensembles de publicités et publicités créés par OrivenAI', wrong_account: 'la campagne appartient à un autre compte publicitaire', activation_incomplete: 'tout n’a pas pu être activé', activation_unconfirmed: 'la plateforme n’a pas confirmé à temps', activation_in_progress: 'une autre activation de cette campagne était en cours', campaign_archived: 'campagne archivée', already_paused: 'déjà en pause', already_active: 'déjà active', status_unknown: 'le statut ne peut pas être modifié maintenant',
        campaign_not_active: 'la campagne ne tourne pas', no_max_budget: 'aucun budget maximal défini', max_budget_required: 'définissez un budget maximal', at_max_budget: 'déjà au budget maximal', cumulative_limit: 'limite d’augmentation totale atteinte', daily_action_limit: 'limite quotidienne de changements atteinte', too_soon: 'trop tôt après le dernier changement',
        at_min_budget: 'déjà au budget minimal', change_too_small: 'changement trop faible', conflict: 'une autre automatisation voulait l’inverse', superseded_by_pause: 'une pause était prioritaire', duplicate_rule: 'une autre automatisation l’a déjà fait',
        paused_all: 'toutes les automatisations en pause', kill_switch: 'mis en pause par OrivenAI', automation_paused: 'automatisation désactivée', automation_deleted: 'automatisation supprimée', missed: 'manquée — pas exécutée en retard', expired: 'approbation expirée', rejected: 'refusée', cancelled_by_user: 'annulée par vous',
        auth: 'connexion expirée — reconnectez le compte', not_connected: 'compte non connecté', rate_limited: 'plateforme occupée, nouvel essai plus tard', transient: 'la plateforme n’a pas répondu', platform: 'la plateforme a refusé le changement', permission: 'pas d’autorisation pour ce compte',
        legacy_action: 'cette ancienne action n’existe plus — choisissez-en une nouvelle', choose_platform: 'choisissez une plateforme', metric_unavailable: 'cette mesure n’est pas fournie pour cette plateforme', stopped: 'planification terminée', rescheduled: 'remplacée par une nouvelle heure', deleted: 'automatisation supprimée', paused: 'automatisation désactivée', not_eligible: 'non éligible',
      },
      plat: { google: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', pinterest: 'Pinterest Ads' },
      metric: {
        spend: ['Dépenses', 'Montant dépensé sur la période.'], impressions: ['Impressions', 'Nombre d’affichages de vos annonces.'], clicks: ['Clics', 'Nombre de clics sur vos annonces.'],
        conversions: ['Conversions', 'Achats, prospects ou inscriptions enregistrés par la plateforme.'], ctr: ['Taux de clic (CTR)', 'Part des personnes qui ont cliqué après avoir vu l’annonce, en %.'],
        cpc: ['Coût par clic (CPC)', 'Montant moyen dépensé pour un clic.'], cpa: ['Coût par conversion (CPA)', 'Montant moyen dépensé pour obtenir une conversion.'],
        roas: ['Retour sur dépenses publicitaires (ROAS)', 'Revenu généré pour chaque unité dépensée (2 = deux fois la dépense).'], status: ['Statut de la campagne', 'Si la campagne tourne ou est en pause.'],
      },
      act: { pause_campaign: 'Mettre en pause', resume_campaign: 'Reprendre', increase_budget: 'Augmenter le budget', decrease_budget: 'Baisser le budget', notify: 'Notifier', activate: 'Activer', pause: 'Mettre en pause', resume: 'Reprendre', stop: 'Arrêter' },
      valuesChange: '{from} → {to}', statusWord: { active: 'active', paused: 'en pause' },
      rel: { now: 'à l’instant', min: 'il y a {n} min', h: 'il y a {n} h', d: 'il y a {n} j', inMin: 'dans {n} min', inH: 'dans {n} h', inD: 'dans {n} j' },
    },
    es: {
      title: 'Automatizaciones', subtitle: 'Programa campañas, sigue su rendimiento y deja que OrivenAI actúe dentro de los límites que tú fijes.',
      tabOverview: 'Resumen', tabScheduler: 'Programador', tabRules: 'Reglas', tabActivity: 'Actividad',
      newRule: 'Nueva regla', newSchedule: 'Programar campaña', pauseAll: 'Pausar todas las automatizaciones', resumeAll: 'Reanudar todas las automatizaciones', settings: 'Ajustes',
      stRunning: 'Activo', stPausedAll: 'Todas las automatizaciones en pausa', stKilled: 'Pausado por OrivenAI', stNoJobs: 'No se ejecuta en este servidor', stChecks: 'reglas revisadas cada {h}',
      hours: '{n} h', minutes: '{n} min',
      tActive: 'Activas', tScheduled: 'Acciones programadas', tApprovals: 'Pendientes de aprobación', tDone: 'Hechas · 7 días', tFailed: 'Fallidas · 7 días',
      approvalsH: 'Necesita tu aprobación', approve: 'Aprobar', reject: 'Rechazar', expiresIn: 'caduca {when}', whyLine: 'Motivo: {why}',
      nextRunH: 'Próxima acción programada', nextRunNone: 'Nada programado.', lastCheckH: 'Última revisión', lastCheckNever: 'Todavía no se ha revisado nada.', managingH: 'Gestiona',
      managingN: '{n} campaña(s) seleccionada(s)', managingAll: 'todas las campañas aptas en {platforms}', managingNone: 'Todavía no hay campañas.',
      accountsH: 'Cuentas publicitarias conectadas', connected: 'Conectada', notConnected: 'No conectada', connect: 'Conectar en el Control Center',
      recentH: 'Actividad reciente', viewAll: 'Ver toda la actividad', noActivity: 'Todavía no ha pasado nada.',
      launchNote: 'Las automatizaciones gestionan campañas que ya están activas en tus cuentas publicitarias. Para crear o publicar una campaña, usa Launch.', openLaunch: 'Abrir Launch',
      emptyH: 'Todavía no hay nada automatizado', emptyP: 'Elige qué puede hacer OrivenAI con tus campañas publicadas:',
      emptyB1: 'Activar y desactivar campañas a horas fijas, por ejemplo en horario comercial.', emptyB2: 'Vigilar el gasto, el coste por resultado o el retorno de la inversión publicitaria.', emptyB3: 'Recibir avisos, aprobar cada cambio o dejar que OrivenAI actúe dentro de tus límites.',
      rulesEmptyH: 'Todavía no hay reglas', rulesEmptyP: 'Una regla vigila datos reales de la campaña y reacciona cuando se cumple una condición.',
      schedEmptyH: 'Todavía no hay programaciones', schedEmptyP: 'Una programación activa o pausa campañas a las horas que elijas, también cuando no estás conectado.',
      upcomingH: 'Próximas acciones', upcomingNone: 'No hay próximas acciones.', cancelRun: 'Cancelar esta acción',
      sActive: 'Activa', sPaused: 'En pausa', sNeedsReview: 'Requiere revisión', sCompleted: 'Terminada',
      mNotify: 'Solo avisar', mApproval: 'Pregunta antes', mAutomatic: 'Automática', mScheduled: 'Programada',
      edit: 'Editar', history: 'Historial', del: 'Eliminar', on: 'Activada', off: 'Desactivada', turnOn: 'Activar', turnOff: 'Desactivar',
      lastChecked: 'Revisada {when}: {checked} campaña(s), {matched} coincidieron.', notChecked: 'Todavía no revisada.', blockedLine: 'En espera: {why}', skippedLine: 'No aplicada: {list}',
      nextRun: 'Próxima: {when}',
      fAll: 'Todo', fCompleted: 'Hechas', fFailed: 'Fallidas', fPartial: 'Hechas en parte', fPending: 'Pendientes de aprobación', fSkipped: 'Omitidas', fCancelled: 'Canceladas',
      exCompleted: 'Hecha', exFailed: 'Fallida', exPartial: 'Hecha en parte', exSkipped: 'Omitida', exPending: 'Pendiente de aprobación', exRunning: 'En curso', exCancelled: 'Cancelada', exScheduled: 'Programada',
      trigLine: 'Porque {metric} fue {observed} ({op} {threshold}, últimos {days} días)', schedLineAt: 'Programada para {when}',
      bRuleTitle: 'Nueva regla', bScheduleTitle: 'Programar campaña', bEditTitle: 'Editar automatización',
      s1: 'Plataforma publicitaria', s2: 'Campañas', s3: 'Condición', s4: 'Qué debe pasar', s5: 'Revisar', s3s: 'Qué y cuándo',
      pickPlatform: 'Elige dónde se publican tus campañas.', notConnectedHint: 'Aún no conectada — conéctala primero en el Control Center.',
      scopeSel: 'Campañas seleccionadas', scopeAll: 'Todas las campañas aptas de esta cuenta', scopeAllHint: 'Incluye las campañas que añadas más tarde. Se omiten las pausadas, archivadas y las que no encajan con la acción.',
      loadingCampaigns: 'Cargando tus campañas…', noCampaigns: 'No hay campañas publicadas en esta cuenta.', unpublishedHint: 'Las campañas que aún no has publicado no aparecen aquí — publícalas primero en Launch.',
      cStatus: { active: 'Activa', paused: 'En pausa', other: 'Otra' },
      budgetLine: 'Presupuesto diario {amount}', budgetAdsets: 'repartido en {n} conjuntos/grupos', budgetShared: 'Presupuesto compartido — las reglas nunca lo cambian', budgetLifetime: 'Presupuesto total — las reglas no lo cambian', budgetNone: 'Sin presupuesto diario',
      metricL: 'Medir', opL: 'Es', valueL: 'Valor', windowL: 'En', windowN: 'los últimos {n} día(s)', minDataL: 'Datos mínimos antes de actuar (avanzado)', minDataHint: 'OrivenAI nunca actúa con muy pocos datos. Déjalo vacío para usar los valores por defecto.',
      op: { '>': 'más de', '>=': 'al menos', '<': 'menos de', '<=': 'como mucho', '==': 'exactamente' }, opIs: 'es',
      actionL: 'Acción', modeL: '¿Qué puede hacer OrivenAI?',
      aPause: 'Pausar la campaña', aResume: 'Reanudar la campaña', aIncrease: 'Subir el presupuesto diario', aDecrease: 'Bajar el presupuesto diario', aNotify: 'Solo avisarme',
      mdNotify: 'Solo avisar — sin cambios en tus campañas.', mdApproval: 'Preguntarme antes — nada cambia hasta que apruebes.', mdAutomatic: 'Automáticamente — OrivenAI hace el cambio dentro de tus límites.',
      pctL: 'Cambio por paso (%)', maxBudgetL: 'Presupuesto diario máximo', maxBudgetHint: 'Necesario para subir presupuestos. OrivenAI nunca lo supera.', minBudgetL: 'Presupuesto diario mínimo (opcional)',
      limitsL: 'Límites de seguridad (avanzado)', cumL: 'Aumento total máximo (%)', cumDaysL: 'en (días)', perDayL: 'Cambios de presupuesto máximos por día', gapL: 'Horas mínimas entre cambios',
      consent: 'Permito que OrivenAI haga este cambio automáticamente, dentro de los límites anteriores.',
      nameL: 'Nombre', namePh: 'p. ej. Pausar campañas que gastan de más',
      cost: 'Coste: {n} créditos', costNote: 'Se cobra una sola vez al crearla. Las revisiones, avisos y cambios de campaña son gratis. Editar, pausar y reanudar es gratis. Al eliminarla no se devuelven los créditos.',
      editFree: 'Editar es gratis.', create: 'Crear automatización · {n} créditos', save: 'Guardar cambios', cancel: 'Cancelar', creating: 'Creando…', saving: 'Guardando…',
      actionRowL: 'Acción', freqL: 'Cuándo', freqOnce: 'Una vez', freqWeekly: 'Cada semana', atL: 'Fecha y hora', daysL: 'Días', timeL: 'Hora', addRow: '+ Añadir acción', removeRow: 'Quitar',
      tplHours: 'Horario comercial (lun–vie, 09:00–18:00)', tplEnd: 'Detener en una fecha',
      saActivate: 'Activar', saPause: 'Pausar', saResume: 'Reanudar', saStop: 'Detener (terminar la campaña)',
      tzL: 'Zona horaria', untilL: 'Repetir hasta (opcional)', dstNote: 'Las horas siguen esta zona horaria, incluido el cambio de hora. Las acciones perdidas (por ejemplo, durante una caída) se omiten, nunca se ejecutan tarde.',
      days: ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'], daysLong: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
      sumWhen: 'Cuando {scope} {cond}, {then}.', sumScopeOne: '«{name}»', sumScopeMany: '{n} campañas seleccionadas', sumScopeAll: 'una campaña apta de {platform}',
      sumCond: 'tenga {metric} de {op} {value} en los últimos {days} día(s)', sumCondStatus: 'esté {status}',
      sumThenNotify: 'OrivenAI te avisará', sumThenAsk: 'OrivenAI te pedirá aprobar: {action}', sumThenAuto: 'OrivenAI va a {action} automáticamente',
      sumActPause: 'pausarla', sumActResume: 'reanudarla', sumActInc: 'subir su presupuesto diario un {pct} % (nunca por encima de {max})', sumActDec: 'bajar su presupuesto diario un {pct} %',
      sumSchedule: 'Para {scope}: {items}.', sumOnce: '{action} el {when}', sumWeekly: '{action} cada {days} a las {time}',
      setH: 'Ajustes de automatizaciones', setInApp: 'Mostrar novedades de automatizaciones en OrivenAI', setEmail: 'Enviarme novedades por correo', setEmailEvents: 'Escribirme sobre', setSaved: 'Ajustes guardados.',
      ev: { executed: 'Acciones realizadas', failed: 'Fallos', partial: 'Acciones hechas en parte', approval: 'Aprobaciones necesarias', paused: 'Campañas pausadas', resumed: 'Campañas reanudadas', budget_changed: 'Cambios de presupuesto', scheduled_completed: 'Acciones programadas', disconnected: 'Cuentas desconectadas', credentials_expired: 'Conexiones caducadas' },
      emailNote: 'Las novedades de una revisión llegan juntas en un solo correo (6 por hora como máximo).',
      confDeleteH: '¿Eliminar esta automatización?', confDeleteP: 'Se detiene al momento y se cancelan sus próximas acciones. Su historial sigue en Actividad. Los {n} créditos no se devuelven.',
      confPauseAllH: '¿Pausar todas las automatizaciones?', confPauseAllP: 'Ninguna regla ni programación cambiará una campaña hasta que reanudes. No se elimina nada.',
      confApproveH: '¿Aprobar este cambio?', confApproveP: 'OrivenAI vuelve a revisar la campaña ahora y solo aplica el cambio si sigue siendo seguro.',
      tCreated: 'Automatización creada.', tSaved: 'Cambios guardados.', tDeleted: 'Automatización eliminada.', tPausedAll: 'Todas las automatizaciones en pausa.', tResumedAll: 'Automatizaciones reanudadas.', tApproved: 'Hecho: {what}', tRejected: 'Rechazado. No se cambió nada.', tCancelledRun: 'Esa acción está cancelada.',
      errLoad: 'No se pudieron cargar las automatizaciones. Inténtalo de nuevo.', retry: 'Reintentar', errDb: 'Las automatizaciones necesitan primero una actualización del servidor. No se cambió nada.', errGeneric: 'Algo salió mal. No se cambió nada.',
      errCredits: 'Crear una automatización cuesta {n} créditos. Ahora no tienes suficientes créditos.', plansLink: 'Ver planes',
      dlgClose: 'Cerrar',
      rs: {
        insufficient_data: 'todavía no hay suficientes datos', no_data: 'sin datos de la plataforma', undefined_ratio: 'pocos resultados para calcularlo', unavailable: 'no disponible en esta plataforma',
        not_running: 'la campaña no está activa', not_paused: 'la campaña no está pausada', shared_budget: 'presupuesto compartido (afecta a otras campañas)', lifetime_budget: 'presupuesto total', no_budget: 'sin presupuesto diario', unknown_currency: 'moneda desconocida',
        budget_not_editable: 'el presupuesto no se puede cambiar', campaign_not_found: 'campaña no encontrada en tu cuenta', activation_partial: 'la campaña está activa, pero algunos conjuntos de anuncios o anuncios siguen en pausa', activation_unverified: 'la campaña está activa, pero no se pudo confirmar la entrega', no_publish_record: 'no hay registro de los conjuntos de anuncios y anuncios que creó OrivenAI', wrong_account: 'la campaña pertenece a otra cuenta publicitaria', activation_incomplete: 'no se pudo activar todo', activation_unconfirmed: 'la plataforma no confirmó a tiempo', activation_in_progress: 'ya había otra activación de esta campaña en curso', campaign_archived: 'campaña archivada', already_paused: 'ya estaba pausada', already_active: 'ya estaba activa', status_unknown: 'el estado no se puede cambiar ahora',
        campaign_not_active: 'la campaña no está activa', no_max_budget: 'sin presupuesto máximo', max_budget_required: 'fija un presupuesto máximo', at_max_budget: 'ya está en el presupuesto máximo', cumulative_limit: 'límite de aumento total alcanzado', daily_action_limit: 'límite diario de cambios alcanzado', too_soon: 'demasiado pronto tras el último cambio',
        at_min_budget: 'ya está en el presupuesto mínimo', change_too_small: 'cambio demasiado pequeño', conflict: 'otra automatización quería lo contrario', superseded_by_pause: 'una pausa tuvo prioridad', duplicate_rule: 'otra automatización ya lo hizo',
        paused_all: 'todas las automatizaciones en pausa', kill_switch: 'pausado por OrivenAI', automation_paused: 'automatización desactivada', automation_deleted: 'automatización eliminada', missed: 'perdida — no se ejecutó tarde', expired: 'aprobación caducada', rejected: 'rechazada', cancelled_by_user: 'cancelada por ti',
        auth: 'conexión caducada — vuelve a conectar la cuenta', not_connected: 'cuenta no conectada', rate_limited: 'plataforma ocupada, se reintentó más tarde', transient: 'la plataforma no respondió', platform: 'la plataforma rechazó el cambio', permission: 'sin permiso para esta cuenta',
        legacy_action: 'esta acción antigua ya no existe — elige una nueva', choose_platform: 'elige una plataforma', metric_unavailable: 'esta medida no está disponible en esta plataforma', stopped: 'programación terminada', rescheduled: 'sustituida por una nueva hora', deleted: 'automatización eliminada', paused: 'automatización desactivada', not_eligible: 'no apta',
      },
      plat: { google: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', pinterest: 'Pinterest Ads' },
      metric: {
        spend: ['Gasto', 'Importe gastado en el periodo.'], impressions: ['Impresiones', 'Cuántas veces se mostraron tus anuncios.'], clicks: ['Clics', 'Cuántas veces hicieron clic en tus anuncios.'],
        conversions: ['Conversiones', 'Compras, contactos o registros que registró la plataforma.'], ctr: ['Porcentaje de clics (CTR)', 'Parte de las personas que hicieron clic tras ver el anuncio, en %.'],
        cpc: ['Coste por clic (CPC)', 'Importe medio gastado por un clic.'], cpa: ['Coste por conversión (CPA)', 'Importe medio gastado para conseguir una conversión.'],
        roas: ['Retorno de la inversión publicitaria (ROAS)', 'Ingresos generados por cada unidad gastada (2 = el doble del gasto).'], status: ['Estado de la campaña', 'Si la campaña está activa o en pausa.'],
      },
      act: { pause_campaign: 'Pausar', resume_campaign: 'Reanudar', increase_budget: 'Subir presupuesto', decrease_budget: 'Bajar presupuesto', notify: 'Avisar', activate: 'Activar', pause: 'Pausar', resume: 'Reanudar', stop: 'Detener' },
      valuesChange: '{from} → {to}', statusWord: { active: 'activa', paused: 'en pausa' },
      rel: { now: 'ahora mismo', min: 'hace {n} min', h: 'hace {n} h', d: 'hace {n} d', inMin: 'en {n} min', inH: 'en {n} h', inD: 'en {n} d' },
    },
    pt: {
      title: 'Automações', subtitle: 'Agende campanhas, acompanhe o desempenho e deixe a OrivenAI agir dentro dos limites que você definir.',
      tabOverview: 'Visão geral', tabScheduler: 'Agendador', tabRules: 'Regras', tabActivity: 'Atividade',
      newRule: 'Nova regra', newSchedule: 'Agendar campanha', pauseAll: 'Pausar todas as automações', resumeAll: 'Retomar todas as automações', settings: 'Configurações',
      stRunning: 'Ativo', stPausedAll: 'Todas as automações pausadas', stKilled: 'Pausado pela OrivenAI', stNoJobs: 'Não está rodando neste servidor', stChecks: 'regras verificadas a cada {h}',
      hours: '{n} h', minutes: '{n} min',
      tActive: 'Ativas', tScheduled: 'Ações agendadas', tApprovals: 'Aguardando aprovação', tDone: 'Concluídas · 7 dias', tFailed: 'Com falha · 7 dias',
      approvalsH: 'Precisa da sua aprovação', approve: 'Aprovar', reject: 'Recusar', expiresIn: 'expira {when}', whyLine: 'Motivo: {why}',
      nextRunH: 'Próxima ação agendada', nextRunNone: 'Nada agendado.', lastCheckH: 'Última verificação', lastCheckNever: 'Nenhuma verificação foi feita ainda.', managingH: 'Gerencia',
      managingN: '{n} campanha(s) selecionada(s)', managingAll: 'todas as campanhas elegíveis em {platforms}', managingNone: 'Ainda não há campanhas.',
      accountsH: 'Contas de anúncios conectadas', connected: 'Conectada', notConnected: 'Não conectada', connect: 'Conectar no Control Center',
      recentH: 'Atividade recente', viewAll: 'Ver toda a atividade', noActivity: 'Nada aconteceu ainda.',
      launchNote: 'As automações gerenciam campanhas que já rodam nas suas contas de anúncios. Para criar ou publicar uma campanha, use o Launch.', openLaunch: 'Abrir o Launch',
      emptyH: 'Nada está automatizado ainda', emptyP: 'Escolha o que a OrivenAI pode fazer pelas suas campanhas publicadas:',
      emptyB1: 'Ligar e desligar campanhas em horários definidos, por exemplo no horário comercial.', emptyB2: 'Acompanhar gasto, custo por resultado ou retorno sobre o investimento em anúncios.', emptyB3: 'Ser avisado, aprovar cada mudança ou deixar a OrivenAI agir dentro dos seus limites.',
      rulesEmptyH: 'Ainda não há regras', rulesEmptyP: 'Uma regra acompanha dados reais da campanha e reage quando uma condição é atendida.',
      schedEmptyH: 'Ainda não há agendamentos', schedEmptyP: 'Um agendamento liga ou pausa campanhas nos horários escolhidos, mesmo quando você está off-line.',
      upcomingH: 'Próximas ações', upcomingNone: 'Nenhuma ação futura.', cancelRun: 'Cancelar esta ação',
      sActive: 'Ativa', sPaused: 'Pausada', sNeedsReview: 'Precisa de revisão', sCompleted: 'Concluída',
      mNotify: 'Só avisar', mApproval: 'Pergunta antes', mAutomatic: 'Automática', mScheduled: 'Agendada',
      edit: 'Editar', history: 'Histórico', del: 'Excluir', on: 'Ligada', off: 'Desligada', turnOn: 'Ligar', turnOff: 'Desligar',
      lastChecked: 'Verificada {when}: {checked} campanha(s), {matched} atenderam.', notChecked: 'Ainda não verificada.', blockedLine: 'Em espera: {why}', skippedLine: 'Não aplicada: {list}',
      nextRun: 'Próxima: {when}',
      fAll: 'Tudo', fCompleted: 'Concluídas', fFailed: 'Com falha', fPartial: 'Concluídas em parte', fPending: 'Aguardando aprovação', fSkipped: 'Ignoradas', fCancelled: 'Canceladas',
      exCompleted: 'Concluída', exFailed: 'Com falha', exPartial: 'Concluída em parte', exSkipped: 'Ignorada', exPending: 'Aguardando aprovação', exRunning: 'Em andamento', exCancelled: 'Cancelada', exScheduled: 'Agendada',
      trigLine: 'Porque {metric} foi {observed} ({op} {threshold}, últimos {days} dias)', schedLineAt: 'Agendada para {when}',
      bRuleTitle: 'Nova regra', bScheduleTitle: 'Agendar campanha', bEditTitle: 'Editar automação',
      s1: 'Plataforma de anúncios', s2: 'Campanhas', s3: 'Condição', s4: 'O que deve acontecer', s5: 'Revisar', s3s: 'O quê e quando',
      pickPlatform: 'Escolha onde suas campanhas rodam.', notConnectedHint: 'Ainda não conectada — conecte primeiro no Control Center.',
      scopeSel: 'Campanhas selecionadas', scopeAll: 'Todas as campanhas elegíveis desta conta', scopeAllHint: 'Inclui campanhas adicionadas depois. Campanhas pausadas, arquivadas ou que não combinam com a ação são ignoradas.',
      loadingCampaigns: 'Carregando suas campanhas…', noCampaigns: 'Nenhuma campanha publicada nesta conta.', unpublishedHint: 'Campanhas ainda não publicadas não aparecem aqui — publique-as primeiro no Launch.',
      cStatus: { active: 'Rodando', paused: 'Pausada', other: 'Outra' },
      budgetLine: 'Orçamento diário {amount}', budgetAdsets: 'dividido em {n} conjuntos/grupos', budgetShared: 'Orçamento compartilhado — regras nunca o alteram', budgetLifetime: 'Orçamento total — regras não o alteram', budgetNone: 'Sem orçamento diário',
      metricL: 'Medir', opL: 'É', valueL: 'Valor', windowL: 'Em', windowN: 'nos últimos {n} dia(s)', minDataL: 'Dados mínimos antes de agir (avançado)', minDataHint: 'A OrivenAI nunca age com poucos dados. Deixe em branco para usar os padrões.',
      op: { '>': 'mais de', '>=': 'pelo menos', '<': 'menos de', '<=': 'no máximo', '==': 'exatamente' }, opIs: 'está',
      actionL: 'Ação', modeL: 'O que a OrivenAI pode fazer?',
      aPause: 'Pausar a campanha', aResume: 'Retomar a campanha', aIncrease: 'Aumentar o orçamento diário', aDecrease: 'Reduzir o orçamento diário', aNotify: 'Só me avisar',
      mdNotify: 'Só avisar — nenhuma mudança nas suas campanhas.', mdApproval: 'Perguntar antes — nada muda até você aprovar.', mdAutomatic: 'Automaticamente — a OrivenAI faz a mudança dentro dos seus limites.',
      pctL: 'Mudança por etapa (%)', maxBudgetL: 'Orçamento diário máximo', maxBudgetHint: 'Necessário para aumentar orçamentos. A OrivenAI nunca o ultrapassa.', minBudgetL: 'Orçamento diário mínimo (opcional)',
      limitsL: 'Limites de segurança (avançado)', cumL: 'Aumento total máximo (%)', cumDaysL: 'em (dias)', perDayL: 'Mudanças de orçamento máximas por dia', gapL: 'Horas mínimas entre mudanças',
      consent: 'Autorizo a OrivenAI a fazer esta mudança automaticamente, dentro dos limites acima.',
      nameL: 'Nome', namePh: 'ex. Pausar campanhas que gastam demais',
      cost: 'Custo: {n} créditos', costNote: 'Cobrado uma única vez ao criar. Verificações, avisos e mudanças de campanha são gratuitos. Editar, pausar e retomar são gratuitos. Excluir não devolve os créditos.',
      editFree: 'Editar é gratuito.', create: 'Criar automação · {n} créditos', save: 'Salvar alterações', cancel: 'Cancelar', creating: 'Criando…', saving: 'Salvando…',
      actionRowL: 'Ação', freqL: 'Quando', freqOnce: 'Uma vez', freqWeekly: 'Toda semana', atL: 'Data e hora', daysL: 'Dias', timeL: 'Hora', addRow: '+ Adicionar ação', removeRow: 'Remover',
      tplHours: 'Horário comercial (seg–sex, 09:00–18:00)', tplEnd: 'Parar em uma data',
      saActivate: 'Ligar', saPause: 'Pausar', saResume: 'Retomar', saStop: 'Parar (encerrar a campanha)',
      tzL: 'Fuso horário', untilL: 'Repetir até (opcional)', dstNote: 'Os horários seguem este fuso, incluindo o horário de verão. Ações perdidas (por exemplo, durante uma falha) são ignoradas, nunca executadas com atraso.',
      days: ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'], daysLong: ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'],
      sumWhen: 'Quando {scope} {cond}, {then}.', sumScopeOne: '“{name}”', sumScopeMany: '{n} campanhas selecionadas', sumScopeAll: 'uma campanha elegível do {platform}',
      sumCond: 'tiver {metric} de {op} {value} nos últimos {days} dia(s)', sumCondStatus: 'estiver {status}',
      sumThenNotify: 'a OrivenAI vai avisar você', sumThenAsk: 'a OrivenAI vai pedir sua aprovação para: {action}', sumThenAuto: 'a OrivenAI vai automaticamente {action}',
      sumActPause: 'pausá-la', sumActResume: 'retomá-la', sumActInc: 'aumentar o orçamento diário em {pct}% (nunca acima de {max})', sumActDec: 'reduzir o orçamento diário em {pct}%',
      sumSchedule: 'Para {scope}: {items}.', sumOnce: '{action} em {when}', sumWeekly: '{action} toda {days} às {time}',
      setH: 'Configurações de automações', setInApp: 'Mostrar novidades das automações na OrivenAI', setEmail: 'Receber novidades por e-mail', setEmailEvents: 'Me escrever sobre', setSaved: 'Configurações salvas.',
      ev: { executed: 'Ações realizadas', failed: 'Falhas', partial: 'Ações concluídas em parte', approval: 'Aprovações necessárias', paused: 'Campanhas pausadas', resumed: 'Campanhas retomadas', budget_changed: 'Mudanças de orçamento', scheduled_completed: 'Ações agendadas', disconnected: 'Contas desconectadas', credentials_expired: 'Conexões expiradas' },
      emailNote: 'As novidades de uma verificação chegam juntas em um só e-mail (no máximo 6 por hora).',
      confDeleteH: 'Excluir esta automação?', confDeleteP: 'Ela para na hora e as próximas ações são canceladas. O histórico continua em Atividade. Os {n} créditos não são devolvidos.',
      confPauseAllH: 'Pausar todas as automações?', confPauseAllP: 'Nenhuma regra ou agendamento vai mudar uma campanha até você retomar. Nada é excluído.',
      confApproveH: 'Aprovar esta mudança?', confApproveP: 'A OrivenAI verifica a campanha de novo agora e só aplica a mudança se ainda for segura.',
      tCreated: 'Automação criada.', tSaved: 'Alterações salvas.', tDeleted: 'Automação excluída.', tPausedAll: 'Todas as automações pausadas.', tResumedAll: 'Automações retomadas.', tApproved: 'Pronto: {what}', tRejected: 'Recusado. Nada foi alterado.', tCancelledRun: 'Essa ação foi cancelada.',
      errLoad: 'Não foi possível carregar as automações. Tente de novo.', retry: 'Tentar de novo', errDb: 'As automações precisam primeiro de uma atualização do servidor. Nada foi alterado.', errGeneric: 'Algo deu errado. Nada foi alterado.',
      errCredits: 'Criar uma automação custa {n} créditos. Você não tem créditos suficientes agora.', plansLink: 'Ver planos',
      dlgClose: 'Fechar',
      rs: {
        insufficient_data: 'ainda não há dados suficientes', no_data: 'sem dados da plataforma', undefined_ratio: 'poucos resultados para calcular', unavailable: 'não informado para esta plataforma',
        not_running: 'a campanha não está rodando', not_paused: 'a campanha não está pausada', shared_budget: 'orçamento compartilhado (afeta outras campanhas)', lifetime_budget: 'orçamento total', no_budget: 'sem orçamento diário', unknown_currency: 'moeda desconhecida',
        budget_not_editable: 'o orçamento não pode ser alterado', campaign_not_found: 'campanha não encontrada na sua conta', activation_partial: 'a campanha está ativa, mas alguns conjuntos de anúncios ou anúncios ainda estão pausados', activation_unverified: 'a campanha está ativa, mas a veiculação não pôde ser confirmada', no_publish_record: 'não há registro dos conjuntos de anúncios e anúncios que a OrivenAI criou', wrong_account: 'a campanha pertence a outra conta de anúncios', activation_incomplete: 'nem tudo pôde ser ativado', activation_unconfirmed: 'a plataforma não confirmou a tempo', activation_in_progress: 'outra ativação desta campanha já estava em andamento', campaign_archived: 'campanha arquivada', already_paused: 'já estava pausada', already_active: 'já estava rodando', status_unknown: 'o status não pode ser alterado agora',
        campaign_not_active: 'a campanha não está rodando', no_max_budget: 'nenhum orçamento máximo definido', max_budget_required: 'defina um orçamento máximo', at_max_budget: 'já está no orçamento máximo', cumulative_limit: 'limite de aumento total atingido', daily_action_limit: 'limite diário de mudanças atingido', too_soon: 'cedo demais após a última mudança',
        at_min_budget: 'já está no orçamento mínimo', change_too_small: 'mudança pequena demais', conflict: 'outra automação queria o contrário', superseded_by_pause: 'uma pausa teve prioridade', duplicate_rule: 'outra automação já fez isso',
        paused_all: 'todas as automações pausadas', kill_switch: 'pausado pela OrivenAI', automation_paused: 'automação desligada', automation_deleted: 'automação excluída', missed: 'perdida — não executada com atraso', expired: 'aprovação expirada', rejected: 'recusada', cancelled_by_user: 'cancelada por você',
        auth: 'conexão expirada — reconecte a conta', not_connected: 'conta não conectada', rate_limited: 'plataforma ocupada, tentou de novo depois', transient: 'a plataforma não respondeu', platform: 'a plataforma recusou a mudança', permission: 'sem permissão para esta conta',
        legacy_action: 'esta ação antiga não existe mais — escolha uma nova', choose_platform: 'escolha uma plataforma', metric_unavailable: 'esta medida não é informada para esta plataforma', stopped: 'agendamento encerrado', rescheduled: 'substituída por um novo horário', deleted: 'automação excluída', paused: 'automação desligada', not_eligible: 'não elegível',
      },
      plat: { google: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', pinterest: 'Pinterest Ads' },
      metric: {
        spend: ['Gasto', 'Valor gasto no período.'], impressions: ['Impressões', 'Quantas vezes seus anúncios apareceram.'], clicks: ['Cliques', 'Quantas vezes clicaram nos seus anúncios.'],
        conversions: ['Conversões', 'Compras, leads ou cadastros registrados pela plataforma.'], ctr: ['Taxa de cliques (CTR)', 'Parte das pessoas que clicaram após ver o anúncio, em %.'],
        cpc: ['Custo por clique (CPC)', 'Valor médio gasto por um clique.'], cpa: ['Custo por conversão (CPA)', 'Valor médio gasto para conseguir uma conversão.'],
        roas: ['Retorno sobre o investimento em anúncios (ROAS)', 'Receita gerada para cada unidade gasta (2 = o dobro do gasto).'], status: ['Status da campanha', 'Se a campanha está rodando ou pausada.'],
      },
      act: { pause_campaign: 'Pausar', resume_campaign: 'Retomar', increase_budget: 'Aumentar orçamento', decrease_budget: 'Reduzir orçamento', notify: 'Avisar', activate: 'Ligar', pause: 'Pausar', resume: 'Retomar', stop: 'Parar' },
      valuesChange: '{from} → {to}', statusWord: { active: 'ativa', paused: 'pausada' },
      rel: { now: 'agora mesmo', min: 'há {n} min', h: 'há {n} h', d: 'há {n} d', inMin: 'em {n} min', inH: 'em {n} h', inD: 'em {n} d' },
    },
  };

  // ── Helpers ───────────────────────────────────────────────────────
  var PLATS = ['google', 'meta', 'tiktok', 'pinterest'];
  function lang() { var l = (typeof CURRENT_LANG !== 'undefined' && CURRENT_LANG) || 'en'; return STR[l] ? l : 'en'; }
  function pick(path) {
    var get = function (o) { return path.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); };
    var v = get(STR[lang()]);
    return v == null ? get(STR.en) : v;
  }
  function T(k, vars) {
    var s = pick(k);
    if (s == null) s = k;
    if (typeof s !== 'string') return s;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); });
    return s;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function $(id) { return document.getElementById(id); }
  function reason(code) { if (!code) return ''; var s = pick('rs.' + code); return s || String(code).replace(/_/g, ' '); }
  function platName(p) { return T('plat.' + p); }
  function metricName(m) { var a = pick('metric.' + m); return a ? a[0] : m; }
  function metricDesc(m) { var a = pick('metric.' + m); return a ? a[1] : ''; }
  function money(v, cur) {
    if (v == null || v === '' || !isFinite(Number(v))) return '';
    try { return new Intl.NumberFormat(lang(), cur ? { style: 'currency', currency: cur } : { maximumFractionDigits: 2 }).format(Number(v)); }
    catch (_) { return Number(v).toFixed(2) + (cur ? ' ' + cur : ''); }
  }
  function fmtMetric(m, v, cur) {
    if (typeof v !== 'number') return esc(v);
    if (m === 'spend' || m === 'cpc' || m === 'cpa') return money(v, cur);
    if (m === 'ctr') return (Math.round(v * 100) / 100).toLocaleString(lang()) + '%';
    if (m === 'roas') return (Math.round(v * 100) / 100).toLocaleString(lang()) + '×';
    return Math.round(v).toLocaleString(lang());
  }
  function rel(iso) {
    if (!iso) return '';
    var d = (new Date(iso).getTime() - Date.now()) / 60000;
    var a = Math.abs(d);
    if (a < 1) return T('rel.now');
    if (a < 60) return T(d < 0 ? 'rel.min' : 'rel.inMin', { n: Math.round(a) });
    if (a < 48 * 60) return T(d < 0 ? 'rel.h' : 'rel.inH', { n: Math.round(a / 60) });
    return T(d < 0 ? 'rel.d' : 'rel.inD', { n: Math.round(a / 1440) });
  }
  function when(iso, tz) {
    try { return new Intl.DateTimeFormat(lang(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz || undefined }).format(new Date(iso)); }
    catch (_) { return new Date(iso).toLocaleString(); }
  }
  function localWhen(localKey, tz) { // 'YYYY-MM-DDTHH:MM' in tz → readable, plus the zone
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localKey || '');
    if (!m) return localKey || '';
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
    var day; try { day = new Intl.DateTimeFormat(lang(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d); } catch (_) { day = m[3] + '-' + m[2]; }
    return day + ' ' + m[4] + ':' + m[5] + (tz ? ' (' + tz + ')' : '');
  }
  function toast(msg, kind) { if (typeof window.orvToast === 'function') window.orvToast(msg, kind || 'ok'); }
  function api(path, opts) {
    if (typeof window.apiFetch !== 'function') return Promise.resolve({ ok: false, status: 0, data: null });
    return window.apiFetch(path, opts || {}).catch(function () { return { ok: false, status: 0, data: null }; });
  }
  function newKey() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('k' + Date.now() + Math.random().toString(36).slice(2)); }
  function confirmBox(title, body, okLabel) {
    var F = window.orvWorkspace && orvWorkspace.flow;
    if (F && typeof F.confirm === 'function') return F.confirm({ title: title, body: '<p>' + esc(body) + '</p>', confirmLabel: okLabel, cancelLabel: T('cancel') });
    return Promise.resolve(window.confirm(title + '\n\n' + body));
  }
  function errText(res) {
    var d = (res && res.data) || {};
    if (d.code === 'DB_UNAVAILABLE') return T('errDb');
    if (d.code === 'CREDITS_EXHAUSTED') return T('errCredits', { n: (A.caps && A.caps.cost) || 50 });
    if (d.errors && d.errors.length) return d.errors.map(function (e) { return e.message; }).join(' ');
    return d.error || T('errGeneric');
  }

  // ── State ─────────────────────────────────────────────────────────
  var A = { tab: 'overview', loading: false, error: null, overview: null, automations: [], approvals: [], jobs: [], activity: [], filter: 'all', caps: null, settings: null, detail: null };
  try { var savedTab = sessionStorage.getItem('orv_auto_tab'); if (savedTab) A.tab = savedTab; } catch (_) {}

  function load() {
    A.loading = true; render();
    var f = A.filter === 'all' ? '' : '?status=' + A.filter;
    return Promise.all([
      api('/api/automations/overview'), api('/api/automations'), api('/api/automations/approvals'), api('/api/automations/jobs'),
      api('/api/automations/activity' + f), A.caps ? Promise.resolve({ ok: true, data: A.caps }) : api('/api/automations/capabilities'), api('/api/automations/settings'),
    ]).then(function (r) {
      A.loading = false;
      A.locked = r[0].status === 403 && !!(r[0].data && r[0].data.code === 'AUTOPILOT_NOT_AVAILABLE'); // plan without Automations (the page's plan gate explains it)
      if (!r[0].ok) { A.error = A.locked ? null : errText(r[0]); render(); return; }
      A.error = null;
      A.overview = r[0].data;
      A.automations = (r[1].data && r[1].data.automations) || [];
      A.approvals = (r[2].data && r[2].data.approvals) || [];
      A.jobs = (r[3].data && r[3].data.jobs) || [];
      A.activity = (r[4].data && r[4].data.items) || [];
      if (r[5].ok) A.caps = r[5].data;
      A.settings = (r[6].data && r[6].data.settings) || null;
      publishCompat();
      render();
    });
  }
  // The shape other parts of the app read (Control Center, Chat context).
  function compatRules(list) {
    return (list || []).map(function (a) {
      return { id: a.id, name: a.name, enabled: a.enabled, platform: a.platform, kind: a.kind, action_type: a.action, trigger_metric: a.condition && a.condition.metric,
        campaign_ids: a.scope && a.scope.type === 'campaigns' ? (a.scope.campaign_ids || []) : null,
        action_params: { campaign_id: a.scope && a.scope.type === 'campaigns' ? (a.scope.campaign_ids || [])[0] : 'all', campaign_name: a.scope && a.scope.campaigns && a.scope.campaigns[0] ? a.scope.campaigns[0].name : null, mode: a.mode } };
    });
  }
  function compatApprovals(list) {
    return (list || []).map(function (p) { return { id: p.id, problem: T('act.' + p.action) + ' — ' + (p.campaign_name || p.campaign_id || ''), campaign_name: p.campaign_name, platform: p.platform, type: p.action, expires_at: p.expires_at }; });
  }
  function publishCompat() {
    window._apRules = compatRules(A.automations);
    window._apPendingApprovals = compatApprovals(A.approvals);
    window._apHistoryItems = A.activity.map(function (e) { return { kind: 'event', id: e.id, title: (e.automation_name ? 'Automation "' + e.automation_name + '": ' : '') + T('act.' + e.action) + ' — ' + (e.campaign_name || ''), status: e.status, created_at: e.created_at }; });
  }

  // ── Rendering ─────────────────────────────────────────────────────
  function statusPill() {
    var o = A.overview || {}, s = o.system || {};
    var cls = 'is-on', txt;
    if (s.executionEnabled === false) { cls = 'is-off'; txt = T('stKilled'); }
    else if (o.pausedAll) { cls = 'is-warn'; txt = T('stPausedAll'); }
    else if (s.backgroundJobs === false) { cls = 'is-off'; txt = T('stNoJobs'); }
    else { var h = s.rulesEveryMinutes ? (s.rulesEveryMinutes >= 60 ? T('hours', { n: s.rulesEveryMinutes / 60 }) : T('minutes', { n: s.rulesEveryMinutes })) : ''; txt = T('stRunning') + (h ? ' · ' + T('stChecks', { h: h }) : ''); }
    return '<span class="atm-pill ' + cls + '" role="status"><i aria-hidden="true"></i>' + esc(txt) + '</span>';
  }
  function header() {
    var paused = A.overview && A.overview.pausedAll;
    if (A.locked) return '<header class="atm-head"><div class="atm-head-text"><h1 class="atm-title">' + esc(T('title')) + '</h1><p class="atm-sub">' + esc(T('subtitle')) + '</p></div></header>';
    return '<header class="atm-head"><div class="atm-head-text"><h1 class="atm-title">' + esc(T('title')) + '</h1><p class="atm-sub">' + esc(T('subtitle')) + '</p>' + (A.overview ? statusPill() : '') + '</div>' +
      '<div class="atm-head-actions">' +
      '<button type="button" class="atm-btn atm-btn-ghost" data-au="pauseall" aria-pressed="' + !!paused + '">' + esc(paused ? T('resumeAll') : T('pauseAll')) + '</button>' +
      '<button type="button" class="atm-btn atm-btn-ghost atm-icon-btn" data-au="settings" aria-label="' + esc(T('setH')) + '" title="' + esc(T('setH')) + '"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></svg></button>' +
      '<button type="button" class="atm-btn atm-btn-ghost" data-au="new-schedule">' + esc(T('newSchedule')) + '</button>' +
      '<button type="button" class="atm-btn atm-btn-primary" data-au="new-rule">+ ' + esc(T('newRule')) + '</button>' +
      '</div></header>';
  }
  function tabs() {
    var c = (A.overview && A.overview.counts) || {};
    var list = [['overview', T('tabOverview'), c.pendingApprovals], ['scheduler', T('tabScheduler'), c.schedules], ['rules', T('tabRules'), c.rules], ['activity', T('tabActivity'), null]];
    return '<div class="atm-tabs" role="tablist" aria-label="' + esc(T('title')) + '">' + list.map(function (t) {
      var on = A.tab === t[0];
      return '<button type="button" role="tab" id="auTab-' + t[0] + '" aria-controls="auPanel" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" class="atm-tab' + (on ? ' is-on' : '') + '" data-tab="' + t[0] + '">' + esc(t[1]) + (t[2] ? '<span class="atm-count">' + t[2] + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function render() {
    var root = $('auRoot'); if (!root || render._busy) return;
    var body;
    if (A.locked) body = emptyIntro(true);
    else if (A.error) body = '<div class="atm-card atm-error" role="alert"><p>' + esc(A.error) + '</p><button type="button" class="atm-btn atm-btn-ghost" data-au="reload">' + esc(T('retry')) + '</button></div>';
    else if (!A.overview) body = '<div class="atm-card atm-loading" aria-busy="true"><span class="atm-spin" aria-hidden="true"></span></div>';
    else body = A.tab === 'scheduler' ? scheduler() : A.tab === 'rules' ? rules() : A.tab === 'activity' ? activity() : overview();
    render._busy = true;
    try { root.innerHTML = header() + (A.locked ? '' : tabs()) + '<section class="atm-panel" id="auPanel" role="tabpanel" aria-labelledby="auTab-' + A.tab + '">' + body + '</section>'; } finally { render._busy = false; }
  }

  function tile(label, value, tone) { return '<div class="atm-tile' + (tone ? ' is-' + tone : '') + '"><span class="atm-tile-v">' + esc(value) + '</span><span class="atm-tile-l">' + esc(label) + '</span></div>'; }
  function approvalCard(p) {
    var obs = p.observed || {};
    var why = obs.metric ? T('trigLine', { metric: metricName(obs.metric), observed: fmtMetric(obs.metric, obs.observed, null), op: T('op.' + obs.operator) || obs.operator, threshold: fmtMetric(obs.metric, obs.threshold, null), days: obs.window_days || 7 }) : '';
    var what = T('act.' + p.action) + (p.params && p.params.percent && /budget/.test(p.action) ? ' ' + p.params.percent + '%' : '');
    return '<div class="atm-appr" data-id="' + esc(p.id) + '"><div class="atm-appr-main"><b>' + esc(what) + ' · ' + esc(p.campaign_name || p.campaign_id) + '</b>' +
      '<span class="atm-muted">' + esc(platName(p.platform)) + ' · ' + esc(T('expiresIn', { when: rel(p.expires_at) })) + '</span>' + (why ? '<span class="atm-muted">' + esc(why) + '</span>' : '') + '</div>' +
      '<div class="atm-appr-act"><button type="button" class="atm-btn atm-btn-ghost" data-au="reject" data-id="' + esc(p.id) + '">' + esc(T('reject')) + '</button><button type="button" class="atm-btn atm-btn-primary" data-au="approve" data-id="' + esc(p.id) + '">' + esc(T('approve')) + '</button></div></div>';
  }
  function emptyIntro(locked) {
    return '<div class="atm-card atm-empty"><h2>' + esc(T('emptyH')) + '</h2><p>' + esc(T('emptyP')) + '</p><ul><li>' + esc(T('emptyB1')) + '</li><li>' + esc(T('emptyB2')) + '</li><li>' + esc(T('emptyB3')) + '</li></ul>' + (locked ? '</div>' :
      '<div class="atm-row"><button type="button" class="atm-btn atm-btn-primary" data-au="new-schedule">' + esc(T('newSchedule')) + '</button><button type="button" class="atm-btn atm-btn-ghost" data-au="new-rule">' + esc(T('newRule')) + '</button></div></div>');
  }
  function overview() {
    var o = A.overview, c = o.counts || {};
    var html = '';
    var main = '', rail = '';
    if (!A.automations.length) main += emptyIntro();
    html += '<div class="atm-tiles">' + tile(T('tActive'), c.active || 0, c.active ? 'live' : null) + tile(T('tScheduled'), c.scheduled || 0) + tile(T('tApprovals'), c.pendingApprovals || 0, c.pendingApprovals ? 'warn' : null) + tile(T('tDone'), c.completed7d || 0) + tile(T('tFailed'), c.failed7d || 0, c.failed7d ? 'bad' : null) + '</div>';
    if (A.approvals.length) main += '<div class="atm-card"><h2 class="atm-h2">' + esc(T('approvalsH')) + '</h2>' + A.approvals.map(approvalCard).join('') + '</div>';
    var nx = o.nextRun;
    var managing = c.managedCampaigns || c.accountWide && c.accountWide.length ? [c.managedCampaigns ? T('managingN', { n: c.managedCampaigns }) : '', c.accountWide && c.accountWide.length ? T('managingAll', { platforms: c.accountWide.map(platName).join(', ') }) : ''].filter(Boolean).join(' · ') : T('managingNone');
    rail += '<div class="atm-card"><dl class="atm-facts">' +
      '<div><dt>' + esc(T('nextRunH')) + '</dt><dd>' + (nx ? esc(T('act.' + nx.action)) + ' · ' + esc(nx.campaign_name || '') + '<br><span class="atm-muted">' + esc(localWhen(nx.local_time, nx.timezone)) + ' · ' + esc(rel(nx.run_at)) + '</span>' : esc(T('nextRunNone'))) + '</dd></div>' +
      '<div><dt>' + esc(T('lastCheckH')) + '</dt><dd>' + (o.lastCheckAt ? esc(rel(o.lastCheckAt)) : esc(T('lastCheckNever'))) + '</dd></div>' +
      '<div><dt>' + esc(T('managingH')) + '</dt><dd>' + esc(managing) + '</dd></div></dl></div>';
    rail += '<div class="atm-card"><h2 class="atm-h2">' + esc(T('accountsH')) + '</h2><ul class="atm-accts">' + (o.accounts || []).map(function (a) {
        return '<li><span class="atm-dot' + (a.connected ? ' is-on' : '') + '" aria-hidden="true"></span>' + esc(platName(a.platform)) + '<span class="atm-muted">' + esc(a.connected ? T('connected') : T('notConnected')) + '</span></li>';
      }).join('') + '</ul>' + ((o.accounts || []).some(function (a) { return !a.connected; }) ? '<button type="button" class="atm-link" data-au="connect">' + esc(T('connect')) + '</button>' : '') + '</div>';
    main += '<div class="atm-card"><div class="atm-card-head"><h2 class="atm-h2">' + esc(T('recentH')) + '</h2>' + (A.activity.length ? '<button type="button" class="atm-link" data-tab="activity">' + esc(T('viewAll')) + '</button>' : '') + '</div>' +
      (A.activity.length ? '<ul class="atm-acts">' + A.activity.slice(0, 5).map(actRow).join('') + '</ul>' : '<p class="atm-muted">' + esc(T('noActivity')) + '</p>') + '</div>';
    rail += '<p class="atm-note">' + esc(T('launchNote')) + ' <button type="button" class="atm-link" data-au="launch">' + esc(T('openLaunch')) + '</button></p>';
    return html + '<div class="atm-ovgrid"><div class="atm-ovmain">' + main + '</div><aside class="atm-ovrail" aria-label="' + esc(T('accountsH')) + '">' + rail + '</aside></div>';
  }

  function statusBadge(a) {
    var k = a.status === 'needs_review' ? ['sNeedsReview', 'warn'] : a.status === 'completed' ? ['sCompleted', 'muted'] : a.enabled ? ['sActive', 'live'] : ['sPaused', 'muted'];
    return '<span class="atm-badge is-' + k[1] + '">' + esc(T(k[0])) + '</span>';
  }
  function modeBadge(a) {
    var k = a.kind === 'schedule' ? 'mScheduled' : a.mode === 'notify' ? 'mNotify' : a.mode === 'approval' ? 'mApproval' : 'mAutomatic';
    return '<span class="atm-badge is-outline' + (a.mode === 'automatic' ? ' is-strong' : '') + '">' + esc(T(k)) + '</span>';
  }
  function autoCard(a) {
    var lr = a.lastResult;
    var lines = [];
    if (a.blocked) lines.push('<span class="atm-warn">' + esc(T('blockedLine', { why: reason(a.blocked) })) + '</span>');
    else if (a.kind === 'rule') {
      if (lr && lr.status === 'blocked') lines.push('<span class="atm-warn">' + esc(T('blockedLine', { why: reason(lr.reason) })) + '</span>');
      else if (lr && lr.at) {
        lines.push(esc(T('lastChecked', { when: rel(lr.at), checked: lr.checked || 0, matched: lr.matched || 0 })));
        var sk = Object.keys(lr.skipped || {}).sort(function (x, y) { return lr.skipped[y] - lr.skipped[x]; }).slice(0, 3).map(function (k) { return reason(k) + ' (' + lr.skipped[k] + ')'; });
        if (sk.length) lines.push('<span class="atm-muted">' + esc(T('skippedLine', { list: sk.join(', ') })) + '</span>');
      } else lines.push('<span class="atm-muted">' + esc(T('notChecked')) + '</span>');
    } else if (a.nextRun) lines.push(esc(T('nextRun', { when: T('act.' + a.nextRun.action) + (a.nextRun.campaignName ? ' · ' + a.nextRun.campaignName : '') + ' · ' + when(a.nextRun.runAt, a.schedule && a.schedule.timezone) })) + ' <span class="atm-muted">(' + esc(rel(a.nextRun.runAt)) + ')</span>');
    return '<article class="atm-auto' + (a.enabled ? '' : ' is-off') + '" data-id="' + esc(a.id) + '"><div class="atm-auto-top"><div class="atm-auto-badges">' + statusBadge(a) + modeBadge(a) + '<span class="atm-muted">' + esc(platName(a.platform)) + '</span></div>' +
      (a.status !== 'completed' ? '<label class="atm-switch"><input type="checkbox" data-au="toggle" data-id="' + esc(a.id) + '"' + (a.enabled ? ' checked' : '') + (a.blocked ? ' disabled' : '') + ' aria-label="' + esc((a.enabled ? T('turnOff') : T('turnOn')) + ': ' + a.name) + '"><span aria-hidden="true"></span></label>' : '') + '</div>' +
      '<h3 class="atm-auto-name">' + esc(a.name) + '</h3><p class="atm-auto-sum">' + esc(summaryOf(a)) + '</p>' + (lines.length ? '<p class="atm-auto-meta">' + lines.join('<br>') + '</p>' : '') +
      '<div class="atm-auto-actions"><button type="button" class="atm-link" data-au="edit" data-id="' + esc(a.id) + '">' + esc(T('edit')) + '</button><button type="button" class="atm-link" data-au="history" data-id="' + esc(a.id) + '">' + esc(T('history')) + '</button><button type="button" class="atm-link atm-danger" data-au="delete" data-id="' + esc(a.id) + '">' + esc(T('del')) + '</button></div></article>';
  }
  function rules() {
    var list = A.automations.filter(function (a) { return a.kind !== 'schedule'; });
    if (!list.length) return '<div class="atm-card atm-empty"><h2>' + esc(T('rulesEmptyH')) + '</h2><p>' + esc(T('rulesEmptyP')) + '</p><button type="button" class="atm-btn atm-btn-primary" data-au="new-rule">+ ' + esc(T('newRule')) + '</button></div>';
    return '<div class="atm-list">' + list.map(autoCard).join('') + '</div>';
  }
  function scheduler() {
    var list = A.automations.filter(function (a) { return a.kind === 'schedule'; });
    var html = list.length ? '<div class="atm-list">' + list.map(autoCard).join('') + '</div>'
      : '<div class="atm-card atm-empty"><h2>' + esc(T('schedEmptyH')) + '</h2><p>' + esc(T('schedEmptyP')) + '</p><button type="button" class="atm-btn atm-btn-primary" data-au="new-schedule">' + esc(T('newSchedule')) + '</button></div>';
    html += '<div class="atm-card"><h2 class="atm-h2">' + esc(T('upcomingH')) + '</h2>' + (A.jobs.length ? '<ul class="atm-jobs">' + A.jobs.slice(0, 50).map(function (j) {
      return '<li><span class="atm-job-when">' + esc(localWhen(j.local_time, j.timezone)) + '<span class="atm-muted"> · ' + esc(rel(j.run_at)) + '</span></span><span class="atm-job-what">' + esc(T('act.' + j.action)) + ' · ' + esc(j.campaign_name || j.campaign_id) + ' <span class="atm-muted">(' + esc(platName(j.platform)) + ')</span></span>' +
        '<button type="button" class="atm-link atm-danger" data-au="cancel-job" data-id="' + esc(j.id) + '">' + esc(T('cancelRun')) + '</button></li>';
    }).join('') + '</ul>' : '<p class="atm-muted">' + esc(T('upcomingNone')) + '</p>') + '</div>';
    return html;
  }
  var EX = { completed: 'exCompleted', failed: 'exFailed', partial: 'exPartial', skipped: 'exSkipped', pending_approval: 'exPending', running: 'exRunning', cancelled: 'exCancelled', scheduled: 'exScheduled' };
  function valueText(e) {
    var p = e.previous_value || {}, n = e.new_value || {};
    if (p.amount != null && n.amount != null) return T('valuesChange', { from: money(p.amount, p.currency), to: money(n.amount, n.currency) });
    if (p.status && n.status && p.status !== n.status) return T('valuesChange', { from: T('statusWord.' + p.status) || p.status, to: T('statusWord.' + n.status) || n.status });
    return '';
  }
  function actRow(e) {
    var t = e.trigger || {};
    var why = t.metric ? T('trigLine', { metric: metricName(t.metric), observed: fmtMetric(t.metric, t.observed, (e.previous_value && e.previous_value.currency) || null), op: T('op.' + t.operator) || t.operator, threshold: fmtMetric(t.metric, t.threshold, null), days: t.window_days || 7 })
      : t.scheduled_for ? T('schedLineAt', { when: localWhen(t.scheduled_for, t.timezone) }) : '';
    var v = valueText(e);
    var tone = e.status === 'completed' ? 'live' : e.status === 'failed' ? 'bad' : e.status === 'pending_approval' || e.status === 'partial' ? 'warn' : 'muted';
    return '<li class="atm-act"><span class="atm-badge is-' + tone + '">' + esc(T(EX[e.status] || 'exSkipped')) + '</span><div class="atm-act-main"><b>' + esc(T('act.' + e.action)) + ' · ' + esc(e.campaign_name || e.campaign_id || '') + '</b>' +
      '<span class="atm-muted">' + esc((e.automation_name || '') + ' · ' + platName(e.platform) + ' · ' + T(e.mode === 'notify' ? 'mNotify' : e.mode === 'approval' ? 'mApproval' : e.mode === 'scheduled' ? 'mScheduled' : 'mAutomatic')) + '</span>' +
      (v ? '<span>' + esc(v) + '</span>' : '') + (why ? '<span class="atm-muted">' + esc(why) + '</span>' : '') +
      (e.reason && e.status !== 'completed' ? '<span class="' + (e.status === 'failed' ? 'atm-warn' : 'atm-muted') + '">' + esc(reason(e.reason)) + (e.error && (e.status === 'failed' || e.status === 'partial') ? ' — ' + esc(String(e.error).slice(0, 160)) : '') + '</span>' : '') +
      '</div><time class="atm-muted" datetime="' + esc(e.created_at) + '">' + esc(rel(e.created_at)) + '</time></li>';
  }
  function activity() {
    var F = [['all', 'fAll'], ['completed', 'fCompleted'], ['failed', 'fFailed'], ['partial', 'fPartial'], ['pending_approval', 'fPending'], ['skipped', 'fSkipped'], ['cancelled', 'fCancelled']];
    return '<div class="atm-filters" role="group" aria-label="' + esc(T('tabActivity')) + '">' + F.map(function (f) { return '<button type="button" class="atm-chip' + (A.filter === f[0] ? ' is-on' : '') + '" aria-pressed="' + (A.filter === f[0]) + '" data-au="filter" data-filter="' + f[0] + '">' + esc(T(f[1])) + '</button>'; }).join('') + '</div>' +
      '<div class="atm-card">' + (A.activity.length ? '<ul class="atm-acts">' + A.activity.map(actRow).join('') + '</ul>' : '<p class="atm-muted">' + esc(T('noActivity')) + '</p>') + '</div>';
  }

  // ── Plain-language summary (also shown before saving) ─────────────
  function scopeText(a) {
    var s = a.scope || {};
    if (s.type === 'campaigns') { var cs = s.campaigns || []; return cs.length === 1 ? T('sumScopeOne', { name: cs[0].name || cs[0].id }) : T('sumScopeMany', { n: (s.campaign_ids || cs).length }); }
    return T('sumScopeAll', { platform: platName(a.platform) });
  }
  function summaryOf(a) {
    if (a.kind === 'schedule') {
      var sch = a.schedule || { items: [] };
      var items = (sch.items || []).map(function (it) {
        var act = T('act.' + it.action);
        if (it.type === 'once') return T('sumOnce', { action: act, when: localWhen(it.at, '') });
        var dl = pick('daysLong');
        return T('sumWeekly', { action: act, days: (it.days || []).map(function (d) { return dl[d - 1]; }).join(', '), time: it.time });
      }).join('; ');
      return T('sumSchedule', { scope: scopeText(a), items: items }) + (sch.timezone ? ' (' + sch.timezone + ')' : '');
    }
    var c = a.condition || {};
    var cond = c.metric === 'status' ? T('sumCondStatus', { status: T('statusWord.' + c.value) || c.value }) : T('sumCond', { metric: metricName(c.metric).toLowerCase(), op: T('op.' + c.operator) || c.operator, value: fmtMetric(c.metric, Number(c.value), a.currency), days: a.window || 7 });
    var act = a.action === 'pause_campaign' ? T('sumActPause') : a.action === 'resume_campaign' ? T('sumActResume') : a.action === 'increase_budget' ? T('sumActInc', { pct: a.percent, max: money(a.limits && a.limits.max_budget, a.currency) }) : a.action === 'decrease_budget' ? T('sumActDec', { pct: a.percent }) : '';
    var then = a.mode === 'notify' ? T('sumThenNotify') : a.mode === 'approval' ? T('sumThenAsk', { action: act }) : T('sumThenAuto', { action: act });
    return T('sumWhen', { scope: scopeText(a), cond: cond, then: then });
  }

  // ── Modal ─────────────────────────────────────────────────────────
  var lastFocus = null;
  function openModal(title, html, wide) {
    var m = $('auModal'); if (!m) return;
    lastFocus = document.activeElement;
    $('auModalTitle').textContent = title;
    $('auModalBody').innerHTML = html;
    m.querySelector('.atm-modal-panel').classList.toggle('is-wide', !!wide);
    $('auModalClose').setAttribute('aria-label', T('dlgClose'));
    m.style.display = 'flex';
    var f = m.querySelector('input, select, textarea, button:not(.intel-mon-close-btn)'); if (f) try { f.focus(); } catch (_) {}
  }
  function closeModal() { var m = $('auModal'); if (m) m.style.display = 'none'; B = null; if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (_) {} }

  // ── Builder (rules and schedules) ─────────────────────────────────
  var B = null; // builder state
  function browserTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (_) { return 'UTC'; } }
  function newBuilder(kind, from) {
    var b = { kind: kind, editId: null, key: newKey(), platform: null, campaigns: null, campErr: null, account: null, scopeType: kind === 'schedule' ? 'campaigns' : 'campaigns', selected: [],
      metric: 'spend', operator: '>', value: '', window: 7, minData: {}, action: 'pause_campaign', mode: 'approval', percent: 15,
      limits: { max_budget: '', min_budget: '', max_cumulative_pct: 50, cumulative_days: 7, max_actions_per_day: 2, min_hours_between: 24 }, consent: false,
      name: '', items: [], timezone: browserTz(), endsAt: '', busy: false, error: null };
    if (from) {
      b.editId = from.id; b.platform = from.platform; b.name = from.name;
      b.scopeType = from.scope && from.scope.type === 'account' ? 'account' : 'campaigns';
      b.selected = (from.scope && from.scope.campaign_ids) || [];
      if (from.kind === 'schedule' && from.schedule) { b.items = JSON.parse(JSON.stringify(from.schedule.items || [])); b.timezone = from.schedule.timezone || b.timezone; b.endsAt = from.schedule.ends_at || ''; }
      else {
        b.metric = (from.condition && from.condition.metric) || 'spend'; b.operator = (from.condition && from.condition.operator) || '>'; b.value = from.condition ? from.condition.value : '';
        b.window = from.window || 7; b.minData = from.minData || {}; b.action = from.action === 'notify' ? 'pause_campaign' : from.action; b.mode = from.mode || 'approval'; b.percent = from.percent || 15;
        if (from.limits) Object.keys(b.limits).forEach(function (k) { if (from.limits[k] != null) b.limits[k] = from.limits[k]; });
        b.consent = from.mode === 'automatic';
        if (from.blocked === 'legacy_action') b.action = 'pause_campaign';
      }
    }
    if (kind === 'schedule' && !b.items.length) b.items = [{ key: 'a1', action: 'pause', type: 'once', at: '' }];
    return b;
  }
  function openBuilder(kind, from) {
    B = newBuilder(kind, from);
    renderBuilder();
    if (B.platform) loadCampaigns();
  }
  function loadCampaigns() {
    var p = B.platform; B.campaigns = null; B.campErr = null; renderBuilder();
    api('/api/automations/campaigns?platform=' + p).then(function (r) {
      if (!B || B.platform !== p) return;
      if (r.ok) { B.campaigns = r.data.campaigns || []; B.account = r.data.account || null; }
      else { B.campaigns = []; B.campErr = errText(r); }
      renderBuilder();
    });
  }
  function platMetrics() { var c = A.caps && (A.caps.platforms || []).filter(function (x) { return x.platform === B.platform; })[0]; return c ? c.metrics : ['spend', 'impressions', 'clicks', 'conversions', 'ctr', 'cpc', 'cpa', 'status']; }
  function sec(n, title, body) { return '<fieldset class="atm-sec"><legend><span class="atm-step">' + n + '</span>' + esc(title) + '</legend>' + body + '</fieldset>'; }
  function radioCards(name, opts, cur) {
    return '<div class="atm-cards" role="radiogroup">' + opts.map(function (o) {
      return '<label class="atm-cardopt' + (cur === o.v ? ' is-on' : '') + (o.disabled ? ' is-disabled' : '') + '"><input type="radio" name="' + name + '" value="' + esc(o.v) + '"' + (cur === o.v ? ' checked' : '') + (o.disabled ? ' disabled' : '') + ' data-bf="' + name + '"><span class="atm-cardopt-t">' + esc(o.t) + '</span>' + (o.d ? '<span class="atm-cardopt-d">' + esc(o.d) + '</span>' : '') + '</label>';
    }).join('') + '</div>';
  }
  function budgetText(c) {
    var b = c.budget;
    if (!b) return '';
    if (b.scope === 'shared') return T('budgetShared');
    if (b.scope === 'lifetime') return T('budgetLifetime');
    if (!b.editable && b.scope === 'none') return T('budgetNone');
    return T('budgetLine', { amount: money(b.amount, b.currency) }) + (b.adsets > 1 ? ' · ' + T('budgetAdsets', { n: b.adsets }) : '');
  }
  function builderBody() {
    var b = B, html = '';
    var accounts = (A.overview && A.overview.accounts) || [];
    html += sec(1, T('s1'), '<p class="atm-hint">' + esc(T('pickPlatform')) + '</p>' + radioCards('platform', PLATS.map(function (p) {
      var acc = accounts.filter(function (a) { return a.platform === p; })[0];
      return { v: p, t: platName(p), d: acc && !acc.connected ? T('notConnectedHint') : '' };
    }), b.platform));
    if (!b.platform) return html;
    var camps = '';
    if (b.kind === 'rule') camps += radioCards('scopeType', [{ v: 'campaigns', t: T('scopeSel') }, { v: 'account', t: T('scopeAll'), d: T('scopeAllHint') }], b.scopeType);
    if (b.scopeType === 'campaigns') {
      if (b.campaigns === null) camps += '<p class="atm-muted" aria-busy="true">' + esc(T('loadingCampaigns')) + '</p>';
      else if (b.campErr) camps += '<p class="atm-warn" role="alert">' + esc(b.campErr) + '</p>';
      else if (!b.campaigns.length) camps += '<p class="atm-muted">' + esc(T('noCampaigns')) + '</p>';
      else camps += '<ul class="atm-camps">' + b.campaigns.map(function (c) {
        var on = b.selected.indexOf(c.id) !== -1;
        return '<li><label class="atm-camp' + (on ? ' is-on' : '') + '"><input type="checkbox" data-bf="camp" value="' + esc(c.id) + '"' + (on ? ' checked' : '') + '><span class="atm-camp-name">' + esc(c.name) + '</span><span class="atm-badge is-' + (c.status === 'active' ? 'live' : 'muted') + '">' + esc(T('cStatus.' + c.status) || c.status) + '</span><span class="atm-muted atm-camp-b">' + esc(budgetText(c)) + '</span></label></li>';
      }).join('') + '</ul>';
    }
    camps += '<p class="atm-hint">' + esc(T('unpublishedHint')) + '</p>';
    html += sec(2, T('s2'), camps);
    if (b.kind === 'rule') {
      var ms = platMetrics();
      if (ms.indexOf(b.metric) === -1) b.metric = ms[0];
      var isStatus = b.metric === 'status';
      var cur = b.account && b.account.currency;
      var cond = '<div class="atm-row atm-row-wrap"><label class="atm-field"><span>' + esc(T('metricL')) + '</span><select data-bf="metric">' + ms.map(function (m) { return '<option value="' + esc(m) + '"' + (b.metric === m ? ' selected' : '') + '>' + esc(metricName(m)) + '</option>'; }).join('') + '</select></label>';
      if (isStatus) cond += '<label class="atm-field"><span>' + esc(T('opL')) + '</span><select data-bf="statusValue"><option value="active"' + (b.value === 'active' ? ' selected' : '') + '>' + esc(T('cStatus.active')) + '</option><option value="paused"' + (b.value === 'paused' ? ' selected' : '') + '>' + esc(T('cStatus.paused')) + '</option></select></label>';
      else {
        cond += '<label class="atm-field"><span>' + esc(T('opL')) + '</span><select data-bf="operator">' + ['>', '>=', '<', '<='].map(function (o) { return '<option value="' + o + '"' + (b.operator === o ? ' selected' : '') + '>' + esc(T('op.' + o)) + '</option>'; }).join('') + '</select></label>' +
          '<label class="atm-field atm-field-sm"><span>' + esc(T('valueL')) + (cur && /spend|cpc|cpa/.test(b.metric) ? ' (' + esc(cur) + ')' : b.metric === 'ctr' ? ' (%)' : '') + '</span><input type="text" inputmode="decimal" data-bf="value" value="' + esc(b.value) + '" autocomplete="off"></label>' +
          '<label class="atm-field"><span>' + esc(T('windowL')) + '</span><select data-bf="window">' + [1, 3, 7, 14, 30].map(function (w) { return '<option value="' + w + '"' + (b.window === w ? ' selected' : '') + '>' + esc(T('windowN', { n: w })) + '</option>'; }).join('') + '</select></label>';
      }
      cond += '</div><p class="atm-hint">' + esc(metricDesc(b.metric)) + '</p>';
      if (!isStatus) cond += '<details class="atm-adv"' + (Object.keys(b.minData || {}).length ? ' open' : '') + '><summary>' + esc(T('minDataL')) + '</summary><p class="atm-hint">' + esc(T('minDataHint')) + '</p><div class="atm-row atm-row-wrap">' +
        ['impressions', 'clicks', 'conversions', 'spend'].map(function (k) { return '<label class="atm-field atm-field-sm"><span>' + esc(metricName(k)) + '</span><input type="text" inputmode="decimal" data-bf="min" data-k="' + k + '" value="' + esc(b.minData[k] != null ? b.minData[k] : '') + '" placeholder="' + esc(((A.caps && A.caps.defaultMinData && A.caps.defaultMinData[b.metric]) || {})[k] || '') + '"></label>'; }).join('') + '</div></details>';
      html += sec(3, T('s3'), cond);
      var budgetAct = b.action === 'increase_budget' || b.action === 'decrease_budget';
      var what = '<span class="atm-lbl">' + esc(T('modeL')) + '</span>' + radioCards('mode', [{ v: 'notify', t: T('mNotify'), d: T('mdNotify') }, { v: 'approval', t: T('mApproval'), d: T('mdApproval') }, { v: 'automatic', t: T('mAutomatic'), d: T('mdAutomatic') }], b.mode);
      if (b.mode !== 'notify') {
        what += '<span class="atm-lbl">' + esc(T('actionL')) + '</span>' + radioCards('action', [{ v: 'pause_campaign', t: T('aPause') }, { v: 'resume_campaign', t: T('aResume') }, { v: 'increase_budget', t: T('aIncrease') }, { v: 'decrease_budget', t: T('aDecrease') }], b.action);
        if (budgetAct) {
          var L = b.limits;
          what += '<div class="atm-row atm-row-wrap"><label class="atm-field atm-field-sm"><span>' + esc(T('pctL')) + '</span><input type="number" min="1" max="50" step="1" data-bf="percent" value="' + esc(b.percent) + '"></label>' +
            (b.action === 'increase_budget' ? '<label class="atm-field"><span>' + esc(T('maxBudgetL')) + (cur ? ' (' + esc(cur) + ')' : '') + '</span><input type="text" inputmode="decimal" data-bf="limit" data-k="max_budget" value="' + esc(L.max_budget) + '" aria-describedby="auMaxHint" required></label>'
              : '<label class="atm-field"><span>' + esc(T('minBudgetL')) + (cur ? ' (' + esc(cur) + ')' : '') + '</span><input type="text" inputmode="decimal" data-bf="limit" data-k="min_budget" value="' + esc(L.min_budget) + '"></label>') + '</div>' +
            (b.action === 'increase_budget' ? '<p class="atm-hint" id="auMaxHint">' + esc(T('maxBudgetHint')) + '</p>' : '') +
            '<details class="atm-adv"><summary>' + esc(T('limitsL')) + '</summary><div class="atm-row atm-row-wrap">' +
            (b.action === 'increase_budget' ? '<label class="atm-field atm-field-sm"><span>' + esc(T('cumL')) + '</span><input type="number" min="1" max="300" data-bf="limit" data-k="max_cumulative_pct" value="' + esc(L.max_cumulative_pct) + '"></label><label class="atm-field atm-field-sm"><span>' + esc(T('cumDaysL')) + '</span><input type="number" min="1" max="30" data-bf="limit" data-k="cumulative_days" value="' + esc(L.cumulative_days) + '"></label>' : '') +
            '<label class="atm-field atm-field-sm"><span>' + esc(T('perDayL')) + '</span><input type="number" min="1" max="5" data-bf="limit" data-k="max_actions_per_day" value="' + esc(L.max_actions_per_day) + '"></label><label class="atm-field atm-field-sm"><span>' + esc(T('gapL')) + '</span><input type="number" min="1" max="168" data-bf="limit" data-k="min_hours_between" value="' + esc(L.min_hours_between) + '"></label></div></details>';
        }
        if (b.mode === 'automatic') what += '<label class="atm-consent"><input type="checkbox" data-bf="consent"' + (b.consent ? ' checked' : '') + '> <span>' + esc(T('consent')) + '</span></label>';
      }
      html += sec(4, T('s4'), what);
    } else {
      var rows = b.items.map(function (it, i) {
        var dshort = pick('days');
        return '<div class="atm-srow" data-i="' + i + '"><label class="atm-field"><span>' + esc(T('actionRowL')) + '</span><select data-bf="it-action" data-i="' + i + '">' + ['activate', 'pause', 'resume', 'stop'].map(function (a) { return '<option value="' + a + '"' + (it.action === a ? ' selected' : '') + '>' + esc(T('sa' + a.charAt(0).toUpperCase() + a.slice(1))) + '</option>'; }).join('') + '</select></label>' +
          '<label class="atm-field"><span>' + esc(T('freqL')) + '</span><select data-bf="it-type" data-i="' + i + '"><option value="once"' + (it.type === 'once' ? ' selected' : '') + '>' + esc(T('freqOnce')) + '</option>' + (it.action !== 'stop' ? '<option value="weekly"' + (it.type === 'weekly' ? ' selected' : '') + '>' + esc(T('freqWeekly')) + '</option>' : '') + '</select></label>' +
          (it.type === 'once' ? '<label class="atm-field"><span>' + esc(T('atL')) + '</span><input type="datetime-local" data-bf="it-at" data-i="' + i + '" value="' + esc(it.at || '') + '"></label>'
            : '<div class="atm-field"><span>' + esc(T('daysL')) + '</span><div class="atm-days" role="group">' + dshort.map(function (dn, di) { var on = (it.days || []).indexOf(di + 1) !== -1; return '<button type="button" class="atm-day' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-bf="it-day" data-i="' + i + '" data-d="' + (di + 1) + '">' + esc(dn) + '</button>'; }).join('') + '</div></div><label class="atm-field atm-field-sm"><span>' + esc(T('timeL')) + '</span><input type="time" data-bf="it-time" data-i="' + i + '" value="' + esc(it.time || '09:00') + '"></label>') +
          (b.items.length > 1 ? '<button type="button" class="atm-link atm-danger" data-bf="it-remove" data-i="' + i + '">' + esc(T('removeRow')) + '</button>' : '') + '</div>';
      }).join('');
      var tzs = []; try { tzs = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : []; } catch (_) {}
      if (tzs.indexOf(b.timezone) === -1) tzs.unshift(b.timezone);
      var hasWeekly = b.items.some(function (i) { return i.type === 'weekly'; });
      html += sec(3, T('s3s'), '<div class="atm-row atm-row-wrap"><button type="button" class="atm-chip" data-bf="tpl-hours">' + esc(T('tplHours')) + '</button><button type="button" class="atm-chip" data-bf="tpl-end">' + esc(T('tplEnd')) + '</button></div>' + rows +
        '<button type="button" class="atm-link" data-bf="it-add">' + esc(T('addRow')) + '</button>' +
        '<div class="atm-row atm-row-wrap"><label class="atm-field"><span>' + esc(T('tzL')) + '</span><select data-bf="tz">' + tzs.map(function (z) { return '<option' + (z === b.timezone ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('') + '</select></label>' +
        (hasWeekly ? '<label class="atm-field"><span>' + esc(T('untilL')) + '</span><input type="datetime-local" data-bf="ends" value="' + esc(b.endsAt || '') + '"></label>' : '') + '</div><p class="atm-hint">' + esc(T('dstNote')) + '</p>');
    }
    var review = '<label class="atm-field atm-field-wide"><span>' + esc(T('nameL')) + '</span><input type="text" maxlength="120" data-bf="name" value="' + esc(b.name) + '" placeholder="' + esc(T('namePh')) + '"></label>' +
      '<p class="atm-summary" aria-live="polite">' + esc(summaryOf(draftView())) + '</p>' +
      (b.editId ? '<p class="atm-hint">' + esc(T('editFree')) + '</p>' : '<div class="atm-cost"><b>' + esc(T('cost', { n: (A.caps && A.caps.cost) || 50 })) + '</b><span>' + esc(T('costNote')) + '</span></div>') +
      (b.error ? '<p class="atm-warn" role="alert">' + esc(b.error) + '</p>' : '') +
      '<div class="atm-row atm-row-end"><button type="button" class="atm-btn atm-btn-ghost" data-bf="cancel">' + esc(T('cancel')) + '</button><button type="button" class="atm-btn atm-btn-primary" data-bf="submit"' + (b.busy ? ' disabled aria-busy="true"' : '') + '>' + esc(b.busy ? (b.editId ? T('saving') : T('creating')) : (b.editId ? T('save') : T('create', { n: (A.caps && A.caps.cost) || 50 }))) + '</button></div>';
    html += sec(b.kind === 'rule' ? 5 : 4, T('s5'), review);
    return html;
  }
  function draftView() {
    var b = B;
    var campaigns = (b.campaigns || []).filter(function (c) { return b.selected.indexOf(c.id) !== -1; }).map(function (c) { return { id: c.id, name: c.name }; });
    return { kind: b.kind, platform: b.platform, currency: b.account && b.account.currency, scope: b.scopeType === 'account' ? { type: 'account' } : { type: 'campaigns', campaign_ids: b.selected.slice(), campaigns: campaigns },
      condition: { metric: b.metric, operator: b.metric === 'status' ? '==' : b.operator, value: b.metric === 'status' ? (b.value === 'paused' ? 'paused' : 'active') : b.value }, window: b.window,
      action: b.mode === 'notify' ? 'notify' : b.action, mode: b.mode, percent: b.percent, limits: b.limits, schedule: { timezone: b.timezone, items: b.items, ends_at: b.endsAt || null } };
  }
  function payload() {
    var b = B, d = draftView();
    var num = function (v) { var s = String(v == null ? '' : v).replace(',', '.').trim(); return s === '' ? null : Number(s); };
    var body = { name: b.name.trim() || (b.kind === 'schedule' ? T('bScheduleTitle') : T('bRuleTitle')), kind: b.kind, platform: b.platform, scope: { type: d.scope.type, campaign_ids: d.scope.campaign_ids || [] } };
    if (b.kind === 'rule') {
      body.condition = { metric: b.metric, operator: d.condition.operator, value: b.metric === 'status' ? d.condition.value : num(b.value) };
      body.window = b.window; body.mode = b.mode; body.action = d.action;
      var md = {}; Object.keys(b.minData || {}).forEach(function (k) { var v = num(b.minData[k]); if (v != null) md[k] = v; });
      if (Object.keys(md).length) body.min_data = md;
      if (/budget/.test(d.action)) {
        body.percent = Number(b.percent);
        var L = {}; Object.keys(b.limits).forEach(function (k) { var v = num(b.limits[k]); if (v != null) L[k] = v; });
        body.limits = L;
      }
      body.confirm_automatic = b.mode === 'automatic' && b.consent;
    } else body.schedule = { timezone: b.timezone, items: b.items.map(function (it, i) { return { key: it.key || ('a' + (i + 1)), action: it.action, type: it.type, at: it.at, days: it.days, time: it.time }; }), ends_at: b.endsAt || null };
    return body;
  }
  function renderBuilder() {
    if (!B) return;
    var title = B.editId ? T('bEditTitle') : (B.kind === 'schedule' ? T('bScheduleTitle') : T('bRuleTitle'));
    var m = $('auModal');
    if (m && m.style.display === 'flex' && $('auModalTitle').textContent === title) {
      var y = $('auModalBody').scrollTop;
      var act = document.activeElement, actSel = act && act.getAttribute && act.getAttribute('data-bf') ? '[data-bf="' + act.getAttribute('data-bf') + '"]' + (act.getAttribute('data-i') ? '[data-i="' + act.getAttribute('data-i') + '"]' : '') + (act.getAttribute('data-k') ? '[data-k="' + act.getAttribute('data-k') + '"]' : '') : null;
      B._rendering = true;
      try { $('auModalBody').innerHTML = '<div class="atm-builder">' + builderBody() + '</div>'; } finally { if (B) B._rendering = false; }
      $('auModalBody').scrollTop = y;
      if (actSel) { var el = $('auModalBody').querySelector(actSel + (act.value && act.type === 'radio' ? '[value="' + act.value + '"]' : '')); if (el) try { el.focus(); } catch (_) {} }
    } else openModal(title, '<div class="atm-builder">' + builderBody() + '</div>', true);
  }
  function submitBuilder() {
    var b = B; if (!b || b.busy) return;
    b.busy = true; b.error = null; renderBuilder();
    var body = payload();
    var req = b.editId ? api('/api/automations/' + encodeURIComponent(b.editId), { method: 'PATCH', body: JSON.stringify(body) })
      : api('/api/automations', { method: 'POST', body: JSON.stringify(body), headers: { 'X-Idempotency-Key': b.key } });
    req.then(function (r) {
      if (!B) return;
      B.busy = false;
      if (r.ok) { var wasEdit = !!b.editId; closeModal(); toast(wasEdit ? T('tSaved') : T('tCreated')); if (typeof window._refreshUsageUI === 'function') try { window._refreshUsageUI(); } catch (_) {} load(); return; }
      if (r.status === 409 && r.data && r.data.code === 'DUPLICATE_ACTION') { closeModal(); load(); return; }
      B.key = newKey(); // a refused request was not charged; the next attempt is a new action
      B.error = errText(r);
      renderBuilder();
    });
  }
  function onBuilderEvent(ev) {
    if (!B || B._rendering) return;
    var t = ev.target, f = t.getAttribute && t.getAttribute('data-bf');
    if (!f) { var p = t.closest && t.closest('[data-bf]'); if (p) { t = p; f = p.getAttribute('data-bf'); } }
    if (!f) return;
    var i = Number(t.getAttribute('data-i'));
    var it = B.items[i];
    var rerender = true;
    switch (f) {
      case 'platform': if (B.platform !== t.value) { B.platform = t.value; B.selected = []; loadCampaigns(); return; } break;
      case 'scopeType': B.scopeType = t.value; break;
      case 'camp': var id = t.value; var k = B.selected.indexOf(id); if (t.checked && k === -1) B.selected.push(id); if (!t.checked && k !== -1) B.selected.splice(k, 1); break;
      case 'metric': B.metric = t.value; if (B.metric === 'status') B.value = 'paused'; else if (B.value === 'paused' || B.value === 'active') B.value = ''; break;
      case 'statusValue': B.value = t.value; break;
      case 'operator': B.operator = t.value; break;
      case 'value': B.value = t.value; rerender = ev.type !== 'input'; break;
      case 'window': B.window = Number(t.value); break;
      case 'min': B.minData[t.getAttribute('data-k')] = t.value; rerender = false; break;
      case 'mode': B.mode = t.value; if (B.mode !== 'automatic') B.consent = false; break;
      case 'action': B.action = t.value; break;
      case 'percent': B.percent = t.value; rerender = ev.type !== 'input'; break;
      case 'limit': B.limits[t.getAttribute('data-k')] = t.value; rerender = ev.type !== 'input'; break;
      case 'consent': B.consent = t.checked; break;
      case 'name': B.name = t.value; rerender = false; var s = $('auModalBody').querySelector('.atm-summary'); if (s) s.textContent = summaryOf(draftView()); break;
      case 'it-action': it.action = t.value; if (it.action === 'stop') it.type = 'once'; break;
      case 'it-type': it.type = t.value; if (it.type === 'weekly') { it.days = it.days || [1, 2, 3, 4, 5]; it.time = it.time || '09:00'; } break;
      case 'it-at': it.at = t.value; rerender = ev.type !== 'input'; break;
      case 'it-time': it.time = t.value; rerender = ev.type !== 'input'; break;
      case 'it-day': if (ev.type !== 'click') return; var dd = Number(t.getAttribute('data-d')); it.days = it.days || []; var di = it.days.indexOf(dd); if (di === -1) it.days.push(dd); else it.days.splice(di, 1); it.days.sort(); break;
      case 'it-add': if (ev.type !== 'click') return; B.items.push({ key: 'a' + (B.items.length + 1) + Date.now().toString(36).slice(-3), action: 'pause', type: 'once', at: '' }); break;
      case 'it-remove': if (ev.type !== 'click') return; B.items.splice(i, 1); break;
      case 'tpl-hours': if (ev.type !== 'click') return; B.items = [{ key: 'on', action: 'activate', type: 'weekly', days: [1, 2, 3, 4, 5], time: '09:00' }, { key: 'off', action: 'pause', type: 'weekly', days: [1, 2, 3, 4, 5], time: '18:00' }]; break;
      case 'tpl-end': if (ev.type !== 'click') return; B.items = [{ key: 'end', action: 'stop', type: 'once', at: '' }]; break;
      case 'tz': B.timezone = t.value; break;
      case 'ends': B.endsAt = t.value; rerender = ev.type !== 'input'; break;
      case 'cancel': if (ev.type !== 'click') return; closeModal(); return;
      case 'submit': if (ev.type !== 'click') return; submitBuilder(); return;
      default: return;
    }
    if (rerender) renderBuilder();
    else { var sm = $('auModalBody').querySelector('.atm-summary'); if (sm && f !== 'name') sm.textContent = summaryOf(draftView()); }
  }

  // ── Settings, history ─────────────────────────────────────────────
  function openSettings() {
    var s = A.settings || { notifyInApp: true, notifyEmail: true, emailEvents: [] };
    var evs = Object.keys(pick('ev') || {});
    openModal(T('setH'), '<div class="atm-settings"><label class="atm-consent"><input type="checkbox" data-sf="inapp"' + (s.notifyInApp ? ' checked' : '') + '> <span>' + esc(T('setInApp')) + '</span></label>' +
      '<label class="atm-consent"><input type="checkbox" data-sf="email"' + (s.notifyEmail ? ' checked' : '') + '> <span>' + esc(T('setEmail')) + '</span></label>' +
      '<fieldset class="atm-sec"' + (s.notifyEmail ? '' : ' disabled') + '><legend>' + esc(T('setEmailEvents')) + '</legend><div class="atm-evs">' + evs.map(function (e) { return '<label class="atm-consent"><input type="checkbox" data-sf="ev" value="' + e + '"' + ((s.emailEvents || []).indexOf(e) !== -1 ? ' checked' : '') + '> <span>' + esc(T('ev.' + e)) + '</span></label>'; }).join('') + '</div></fieldset>' +
      '<p class="atm-hint">' + esc(T('emailNote')) + '</p><div class="atm-row atm-row-end"><button type="button" class="atm-btn atm-btn-primary" data-sf="save">' + esc(T('save')) + '</button></div></div>');
  }
  function saveSettings() {
    var body = $('auModalBody');
    var data = { notifyInApp: body.querySelector('[data-sf="inapp"]').checked, notifyEmail: body.querySelector('[data-sf="email"]').checked, emailEvents: Array.prototype.slice.call(body.querySelectorAll('[data-sf="ev"]:checked')).map(function (x) { return x.value; }) };
    api('/api/automations/settings', { method: 'PUT', body: JSON.stringify(data) }).then(function (r) {
      if (r.ok) { A.settings = Object.assign({}, A.settings, data); closeModal(); toast(T('setSaved')); } else toast(errText(r), 'error');
    });
  }
  function openHistory(id) {
    var a = A.automations.filter(function (x) { return x.id === id; })[0]; if (!a) return;
    openModal(a.name, '<p class="atm-muted">' + esc(summaryOf(a)) + '</p><div class="atm-card atm-loading" aria-busy="true"><span class="atm-spin" aria-hidden="true"></span></div>', true);
    api('/api/automations/activity?automation_id=' + encodeURIComponent(id) + '&limit=50').then(function (r) {
      var items = (r.ok && r.data && r.data.items) || [];
      if ($('auModalTitle').textContent !== a.name) return;
      $('auModalBody').innerHTML = '<p class="atm-muted">' + esc(summaryOf(a)) + '</p>' + (items.length ? '<ul class="atm-acts">' + items.map(actRow).join('') + '</ul>' : '<p class="atm-muted">' + esc(T('noActivity')) + '</p>');
    });
  }

  // ── Page actions ──────────────────────────────────────────────────
  function act(name, el) {
    var id = el && el.getAttribute('data-id');
    if (name === 'reload') return load();
    if (name === 'new-rule') return openBuilder('rule');
    if (name === 'new-schedule') return openBuilder('schedule');
    if (name === 'settings') return openSettings();
    if (name === 'launch') { if (typeof window._orvNav === 'function') window._orvNav('launch', 'page-launch'); return; }
    if (name === 'connect') { if (typeof window.bizGoTo === 'function') window.bizGoTo('connections'); else if (typeof window._orvNav === 'function') window._orvNav('business-brain'); return; }
    if (name === 'filter') { A.filter = el.getAttribute('data-filter'); api('/api/automations/activity' + (A.filter === 'all' ? '' : '?status=' + A.filter)).then(function (r) { A.activity = (r.ok && r.data && r.data.items) || []; render(); }); return; }
    if (name === 'pauseall') {
      var on = !(A.overview && A.overview.pausedAll);
      var go = function () { api('/api/automations/' + (on ? 'pause-all' : 'resume-all'), { method: 'POST' }).then(function (r) { if (r.ok) { toast(on ? T('tPausedAll') : T('tResumedAll')); load(); } else toast(errText(r), 'error'); }); };
      if (on) confirmBox(T('confPauseAllH'), T('confPauseAllP'), T('pauseAll')).then(function (y) { if (y) go(); }); else go();
      return;
    }
    if (name === 'approve' || name === 'reject') {
      var p = A.approvals.filter(function (x) { return x.id === id; })[0];
      var run = function () {
        el.disabled = true;
        api('/api/automations/approvals/' + encodeURIComponent(id) + '/' + name, { method: 'POST' }).then(function (r) {
          if (r.ok) toast(name === 'approve' ? T('tApproved', { what: r.data.status === 'skipped' ? reason(r.data.reason) : T('act.' + (p && p.action)) + ' · ' + ((p && p.campaign_name) || '') }) : T('tRejected'));
          else toast(errText(r), 'error');
          load();
        });
      };
      if (name === 'approve') confirmBox(T('confApproveH'), T('confApproveP'), T('approve')).then(function (y) { if (y) run(); }); else run();
      return;
    }
    if (name === 'toggle') {
      api('/api/automations/' + encodeURIComponent(id) + '/' + (el.checked ? 'resume' : 'pause'), { method: 'POST' }).then(function (r) { if (!r.ok) { el.checked = !el.checked; toast(errText(r), 'error'); } load(); });
      return;
    }
    if (name === 'edit') { var a = A.automations.filter(function (x) { return x.id === id; })[0]; if (a) openBuilder(a.kind === 'schedule' ? 'schedule' : 'rule', a); return; }
    if (name === 'history') return openHistory(id);
    if (name === 'delete') {
      confirmBox(T('confDeleteH'), T('confDeleteP', { n: (A.caps && A.caps.cost) || 50 }), T('del')).then(function (y) {
        if (!y) return;
        api('/api/automations/' + encodeURIComponent(id), { method: 'DELETE' }).then(function (r) { if (r.ok) toast(T('tDeleted')); else toast(errText(r), 'error'); load(); });
      });
      return;
    }
    if (name === 'cancel-job') {
      el.disabled = true;
      api('/api/automations/jobs/' + encodeURIComponent(id) + '/cancel', { method: 'POST' }).then(function (r) { if (r.ok) toast(T('tCancelledRun')); else toast(errText(r), 'error'); load(); });
    }
  }

  var bound = false;
  function bind() {
    if (bound) return; bound = true;
    document.addEventListener('click', function (ev) {
      var root = $('auRoot');
      var t = ev.target.closest ? ev.target.closest('[data-au], [data-tab]') : null;
      if (t && root && root.contains(t)) {
        var tab = t.getAttribute('data-tab');
        if (tab && !t.getAttribute('data-au')) { A.tab = tab; try { sessionStorage.setItem('orv_auto_tab', tab); } catch (_) {} render(); var nt = $('auTab-' + tab); if (nt) nt.focus(); return; }
        if (t.getAttribute('data-au') === 'toggle') return; // handled on change
        act(t.getAttribute('data-au'), t);
        return;
      }
      var m = $('auModal');
      if (m && m.style.display === 'flex') {
        if (ev.target === m || (ev.target.closest && ev.target.closest('#auModalClose'))) { closeModal(); return; }
        var sf = ev.target.closest && ev.target.closest('[data-sf="save"]');
        if (sf) { saveSettings(); return; }
        if (B && m.contains(ev.target)) onBuilderEvent(ev);
      }
    });
    document.addEventListener('change', function (ev) {
      var root = $('auRoot');
      if (root && root.contains(ev.target) && ev.target.getAttribute('data-au') === 'toggle') { act('toggle', ev.target); return; }
      var m = $('auModal');
      if (m && m.contains(ev.target)) {
        if (ev.target.getAttribute('data-sf') === 'email') { var fs = m.querySelector('fieldset.atm-sec'); if (fs) fs.disabled = !ev.target.checked; }
        if (B) onBuilderEvent(ev);
      }
    });
    document.addEventListener('input', function (ev) { var m = $('auModal'); if (B && m && m.contains(ev.target)) onBuilderEvent(ev); });
    document.addEventListener('keydown', function (ev) {
      var m = $('auModal');
      if (ev.key === 'Escape' && m && m.style.display === 'flex') { closeModal(); return; }
      var tab = ev.target && ev.target.closest && ev.target.closest('.atm-tab');
      if (tab && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
        var tabs = Array.prototype.slice.call(document.querySelectorAll('#auRoot .atm-tab'));
        var i = tabs.indexOf(tab), j = (i + (ev.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[j].click();
      }
    });
  }

  function init() {
    if (!$('auRoot')) return;
    bind();
    var q = /[?&]tab=(overview|scheduler|rules|activity|settings)/.exec(location.search);
    if (q) { if (q[1] === 'settings') setTimeout(openSettings, 600); else A.tab = q[1]; }
    load();
  }
  window.orvAutomations = { init: init, reload: load, compatRules: compatRules, compatApprovals: compatApprovals, _T: T, _STR: STR, _state: function () { return A; }, _builder: function () { return B; } };
  window.apInit = init; // existing navigation hook (app.html _orvNav)

  if (typeof window.applyLanguage === 'function' && !window.applyLanguage._au) {
    var orig = window.applyLanguage;
    window.applyLanguage = function () { var r = orig.apply(this, arguments); try { if (A.overview) render(); if (B) renderBuilder(); } catch (_) {} return r; };
    window.applyLanguage._au = true;
  }
})();
