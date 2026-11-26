/* ════════════════════════════════════════════════════════════════
   Overview → Dashboard (#bizPanelOverview), 2026-11-26.

   One calm overview that answers, in this order:
     1. How are my ads performing?      Performance (campaign + metric selector, chart)
     2. Is anything going wrong?        Needs Attention (yellow) + platform status
     3. What deserves attention?        Top campaigns
     4. What are the opportunities?     Recommendations (plan tasks + calculated insights)
     5. Is Autopilot running?           Automations, compact

   Every number comes from the platforms' own reported figures (orvAnalytics,
   orvCampaignSources), the plan (/api/onboarding/progress) and Autopilot
   (/api/automations/overview). Nothing is estimated; nothing is AI here.
   The older Dashboard blocks stay in the page, hidden: they keep computing
   the workspace signals that Needs Attention reads (js/needsAttention.js).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var STR = {
    en: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', sub: 'Your advertising across every connected platform, at a glance.', perf: 'Performance', allCamps: 'All campaigns', metric: 'Metric', vsPrev: 'vs previous {n} days', noPrev: 'no earlier figures', prevPeriod: 'Previous period', thisPeriod: 'This period', attention: 'Needs attention', allClear: 'All clear — nothing needs you right now.', openAttention: 'Open Needs Attention', more: '+{n} more', platforms: 'Ad platforms', connected: 'Connected', notConnected: 'Not connected', expired: 'Reconnect', manage: 'Manage', topCamps: 'Top campaigns', byspend: 'by spend, {range}', noCamps: 'No campaign figures yet for this period.', openCamps: 'Open Campaigns', recs: 'Recommended next', fromPlan: 'From your plan', canDo: 'OrivenAI can do this', upToYou: 'Up to you', calc: 'Calculated from your figures', openTasks: 'Open tasks', noRecs: 'Nothing to recommend yet — once your plan and campaigns have data, the next steps appear here.', auto: 'Autopilot', active: 'Active', paused: 'Paused', approvals: 'Approvals', nextRun: 'Next run', none: 'None planned', openAuto: 'Open Autopilot', connectFirst: 'Connect an ad platform to see your performance here.', connect: 'Connect a platform', loading: 'Loading your figures…', range7: 'Last 7 days', range30: 'Last 30 days', range90: 'Last 90 days', cpaBest: '{p} has the lowest cost per conversion ({v}).', share: '{p} brings {c}% of conversions on {s}% of spend.', roasNote: 'ROAS from platforms that report conversion value.' },
    nl: { morning: 'Goedemorgen', afternoon: 'Goedemiddag', evening: 'Goedenavond', sub: 'Je advertenties op alle gekoppelde platforms, in één oogopslag.', perf: 'Prestaties', allCamps: 'Alle campagnes', metric: 'Statistiek', vsPrev: 't.o.v. vorige {n} dagen', noPrev: 'geen eerdere cijfers', prevPeriod: 'Vorige periode', thisPeriod: 'Deze periode', attention: 'Vraagt aandacht', allClear: 'Alles in orde — er is nu niets dat je aandacht nodig heeft.', openAttention: 'Open Vraagt aandacht', more: '+{n} meer', platforms: 'Advertentieplatforms', connected: 'Gekoppeld', notConnected: 'Niet gekoppeld', expired: 'Opnieuw koppelen', manage: 'Beheren', topCamps: 'Topcampagnes', byspend: 'op uitgaven, {range}', noCamps: 'Nog geen campagnecijfers voor deze periode.', openCamps: 'Campagnes openen', recs: 'Aanbevolen', fromPlan: 'Uit je plan', canDo: 'OrivenAI kan dit doen', upToYou: 'Aan jou', calc: 'Berekend uit je cijfers', openTasks: 'Taken openen', noRecs: 'Nog niets aan te bevelen — zodra je plan en campagnes gegevens hebben, verschijnen de volgende stappen hier.', auto: 'Autopilot', active: 'Actief', paused: 'Gepauzeerd', approvals: 'Akkoorden', nextRun: 'Volgende', none: 'Niets gepland', openAuto: 'Autopilot openen', connectFirst: 'Koppel een advertentieplatform om je prestaties hier te zien.', connect: 'Platform koppelen', loading: 'Je cijfers worden geladen…', range7: 'Laatste 7 dagen', range30: 'Laatste 30 dagen', range90: 'Laatste 90 dagen', cpaBest: '{p} heeft de laagste kosten per conversie ({v}).', share: '{p} levert {c}% van de conversies op {s}% van de uitgaven.', roasNote: 'ROAS van platforms die conversiewaarde rapporteren.' },
    de: { morning: 'Guten Morgen', afternoon: 'Guten Tag', evening: 'Guten Abend', sub: 'Deine Werbung auf allen verbundenen Plattformen auf einen Blick.', perf: 'Leistung', allCamps: 'Alle Kampagnen', metric: 'Kennzahl', vsPrev: 'ggü. vorherigen {n} Tagen', noPrev: 'keine früheren Zahlen', prevPeriod: 'Vorperiode', thisPeriod: 'Dieser Zeitraum', attention: 'Braucht Aufmerksamkeit', allClear: 'Alles in Ordnung — gerade braucht nichts deine Aufmerksamkeit.', openAttention: 'Öffnen', more: '+{n} weitere', platforms: 'Werbeplattformen', connected: 'Verbunden', notConnected: 'Nicht verbunden', expired: 'Neu verbinden', manage: 'Verwalten', topCamps: 'Top-Kampagnen', byspend: 'nach Ausgaben, {range}', noCamps: 'Noch keine Kampagnenzahlen für diesen Zeitraum.', openCamps: 'Kampagnen öffnen', recs: 'Empfohlen', fromPlan: 'Aus deinem Plan', canDo: 'OrivenAI kann das', upToYou: 'Bei dir', calc: 'Aus deinen Zahlen berechnet', openTasks: 'Aufgaben öffnen', noRecs: 'Noch keine Empfehlungen — sobald Plan und Kampagnen Daten haben, erscheinen die nächsten Schritte hier.', auto: 'Autopilot', active: 'Aktiv', paused: 'Pausiert', approvals: 'Freigaben', nextRun: 'Nächster Lauf', none: 'Nichts geplant', openAuto: 'Autopilot öffnen', connectFirst: 'Verbinde eine Werbeplattform, um hier deine Leistung zu sehen.', connect: 'Plattform verbinden', loading: 'Deine Zahlen werden geladen…', range7: 'Letzte 7 Tage', range30: 'Letzte 30 Tage', range90: 'Letzte 90 Tage', cpaBest: '{p} hat die niedrigsten Kosten pro Conversion ({v}).', share: '{p} bringt {c}% der Conversions bei {s}% der Ausgaben.', roasNote: 'ROAS von Plattformen, die Conversion-Werte melden.' },
    fr: { morning: 'Bonjour', afternoon: 'Bon après-midi', evening: 'Bonsoir', sub: 'Votre publicité sur toutes les plateformes connectées, en un coup d’œil.', perf: 'Performances', allCamps: 'Toutes les campagnes', metric: 'Indicateur', vsPrev: 'vs {n} jours précédents', noPrev: 'pas de chiffres antérieurs', prevPeriod: 'Période précédente', thisPeriod: 'Cette période', attention: 'À traiter', allClear: 'Tout va bien — rien ne demande votre attention pour l’instant.', openAttention: 'Ouvrir À traiter', more: '+{n} de plus', platforms: 'Plateformes publicitaires', connected: 'Connectée', notConnected: 'Non connectée', expired: 'Reconnecter', manage: 'Gérer', topCamps: 'Meilleures campagnes', byspend: 'par dépenses, {range}', noCamps: 'Pas encore de chiffres de campagne pour cette période.', openCamps: 'Ouvrir Campagnes', recs: 'Recommandé', fromPlan: 'De votre plan', canDo: 'OrivenAI peut le faire', upToYou: 'À vous', calc: 'Calculé à partir de vos chiffres', openTasks: 'Ouvrir les tâches', noRecs: 'Rien à recommander pour l’instant — dès que votre plan et vos campagnes ont des données, les prochaines étapes apparaissent ici.', auto: 'Autopilot', active: 'Actives', paused: 'En pause', approvals: 'Validations', nextRun: 'Prochaine', none: 'Rien de prévu', openAuto: 'Ouvrir Autopilot', connectFirst: 'Connectez une plateforme publicitaire pour voir vos performances ici.', connect: 'Connecter une plateforme', loading: 'Chargement de vos chiffres…', range7: '7 derniers jours', range30: '30 derniers jours', range90: '90 derniers jours', cpaBest: '{p} a le coût par conversion le plus bas ({v}).', share: '{p} apporte {c} % des conversions pour {s} % des dépenses.', roasNote: 'ROAS des plateformes qui déclarent la valeur de conversion.' },
    es: { morning: 'Buenos días', afternoon: 'Buenas tardes', evening: 'Buenas noches', sub: 'Tu publicidad en todas las plataformas conectadas, de un vistazo.', perf: 'Rendimiento', allCamps: 'Todas las campañas', metric: 'Métrica', vsPrev: 'vs {n} días anteriores', noPrev: 'sin cifras anteriores', prevPeriod: 'Periodo anterior', thisPeriod: 'Este periodo', attention: 'Requiere atención', allClear: 'Todo en orden — ahora mismo nada necesita tu atención.', openAttention: 'Abrir Requiere atención', more: '+{n} más', platforms: 'Plataformas publicitarias', connected: 'Conectada', notConnected: 'No conectada', expired: 'Reconectar', manage: 'Gestionar', topCamps: 'Campañas principales', byspend: 'por gasto, {range}', noCamps: 'Aún no hay cifras de campañas para este periodo.', openCamps: 'Abrir Campañas', recs: 'Recomendado', fromPlan: 'De tu plan', canDo: 'OrivenAI puede hacerlo', upToYou: 'Te toca', calc: 'Calculado con tus cifras', openTasks: 'Abrir tareas', noRecs: 'Nada que recomendar todavía — cuando tu plan y tus campañas tengan datos, los próximos pasos aparecerán aquí.', auto: 'Autopilot', active: 'Activas', paused: 'En pausa', approvals: 'Aprobaciones', nextRun: 'Próxima', none: 'Nada programado', openAuto: 'Abrir Autopilot', connectFirst: 'Conecta una plataforma publicitaria para ver tu rendimiento aquí.', connect: 'Conectar una plataforma', loading: 'Cargando tus cifras…', range7: 'Últimos 7 días', range30: 'Últimos 30 días', range90: 'Últimos 90 días', cpaBest: '{p} tiene el coste por conversión más bajo ({v}).', share: '{p} aporta el {c} % de las conversiones con el {s} % del gasto.', roasNote: 'ROAS de plataformas que informan el valor de conversión.' },
    pt: { morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite', sub: 'A sua publicidade em todas as plataformas ligadas, num relance.', perf: 'Desempenho', allCamps: 'Todas as campanhas', metric: 'Métrica', vsPrev: 'vs {n} dias anteriores', noPrev: 'sem números anteriores', prevPeriod: 'Período anterior', thisPeriod: 'Este período', attention: 'Precisa de atenção', allClear: 'Tudo em ordem — nada precisa da sua atenção agora.', openAttention: 'Abrir Precisa de atenção', more: '+{n} mais', platforms: 'Plataformas de anúncios', connected: 'Ligada', notConnected: 'Não ligada', expired: 'Voltar a ligar', manage: 'Gerir', topCamps: 'Principais campanhas', byspend: 'por gasto, {range}', noCamps: 'Ainda sem números de campanhas para este período.', openCamps: 'Abrir Campanhas', recs: 'Recomendado', fromPlan: 'Do seu plano', canDo: 'O OrivenAI pode fazer isto', upToYou: 'Consigo', calc: 'Calculado a partir dos seus números', openTasks: 'Abrir tarefas', noRecs: 'Ainda nada a recomendar — quando o plano e as campanhas tiverem dados, os próximos passos aparecem aqui.', auto: 'Autopilot', active: 'Ativas', paused: 'Em pausa', approvals: 'Aprovações', nextRun: 'Próxima', none: 'Nada agendado', openAuto: 'Abrir Autopilot', connectFirst: 'Ligue uma plataforma de anúncios para ver aqui o seu desempenho.', connect: 'Ligar uma plataforma', loading: 'A carregar os seus números…', range7: 'Últimos 7 dias', range30: 'Últimos 30 dias', range90: 'Últimos 90 dias', cpaBest: '{p} tem o custo por conversão mais baixo ({v}).', share: '{p} traz {c}% das conversões com {s}% do gasto.', roasNote: 'ROAS das plataformas que reportam valor de conversão.' },
  };
  function T(k, v) { var l = typeof CURRENT_LANG === 'string' && STR[CURRENT_LANG] ? CURRENT_LANG : 'en'; var s = STR[l][k] || STR.en[k] || k; return v ? s.replace(/\{(\w+)\}/g, function (m, x) { return v[x] != null ? v[x] : m; }) : s; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(path) { return typeof window.apiFetch === 'function' ? window.apiFetch(path).catch(function () { return { ok: false }; }) : Promise.resolve({ ok: false }); }
  function go(id) { if (window.orvAppNav) window.orvAppNav.go(id); }
  var METRICS = ['spend', 'conversions', 'cpa', 'roas', 'clicks', 'ctr', 'impressions', 'cpc'];
  var S = { range: 30, campaign: 'all', metric: 'conversions', conn: null, camps: null, data: null, gen: 0, autos: null, plan: null, loadedAt: 0 };

  // ── Data ───────────────────────────────────────────────────────
  function win() { var A = window.orvAnalytics; return { since: A.addDays(A.today(), -(S.range - 1)), until: A.today() }; }
  function rangeKey() { return S.range === 7 ? 'LAST_7_DAYS' : S.range === 90 ? 'LAST_90_DAYS' : 'LAST_30_DAYS'; }
  function connected() { var A = window.orvAnalytics; return A.PLATFORMS.filter(function (p) { return S.conn && S.conn[p] && S.conn[p].conn === 'connected'; }); }
  function currency() { var c = S.conn || {}, ps = connected(); return (ps.length && c[ps[0]].currency) || 'EUR'; }
  function load(force) {
    var A = window.orvAnalytics; if (!A) return;
    if (!force && S.data && Date.now() - S.loadedAt < 60000) { paint(); return; }
    var g = ++S.gen; S.loadedAt = Date.now(); S.data = null; paint();
    A.connections().then(function (conn) {
      if (g !== S.gen) return;
      S.conn = conn;
      var plats = connected(), C = window.orvCampaignSources;
      // campaigns (for the selector and Top campaigns)
      Promise.all(plats.map(function (p) { return C ? C.load(p, { key: rangeKey() }, (conn[p] || {}).currency).then(function (o) { return o.rows || []; }, function () { return []; }) : []; })).then(function (lists) {
        if (g !== S.gen) return; S.camps = [].concat.apply([], lists); paint();
      });
      loadSeries(g);
      paint();
    });
    api('/api/automations/overview').then(function (r) { S.autos = r && r.ok && r.data ? r.data : false; paint(); });
    api('/api/onboarding/progress').then(function (r) { S.plan = r && r.ok && r.data && r.data.status === 'ready' ? r.data : false; paint(); });
    if (window.orvAttention) window.orvAttention.collect(force).then(paint, paint);
  }
  function loadSeries(g) {
    var A = window.orvAnalytics, w = win();
    var targets;
    if (S.campaign === 'all') targets = connected().map(function (p) { return { p: p, opts: {} }; });
    else { var pc = S.campaign.split(':'); targets = [{ p: pc[0], opts: { campaignId: pc.slice(1).join(':') } }]; }
    Promise.all(targets.map(function (t) { return A.seriesWithPrevious(t.p, w, t.opts).then(function (d) { return { p: t.p, d: d }; }, function () { return null; }); })).then(function (list) {
      if (g !== S.gen) return;
      S.data = list.filter(Boolean); paint();
    });
  }
  // Days of a period, summed over the chosen platforms (value only from platforms that report it).
  function byDay(list, key) {
    var A = window.orvAnalytics, m = {};
    list.forEach(function (x) { (x.d[key] || []).forEach(function (r) { var k = r.date, t = m[k] || (m[k] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0, valueSpend: 0, date: k }); t.spend += +r.spend || 0; t.impressions += +r.impressions || 0; t.clicks += +r.clicks || 0; t.conversions += +r.conversions || 0; if (x.d.valueReported) { t.conversionValue += +r.conversionValue || 0; t.valueSpend += +r.spend || 0; } }); });
    return Object.keys(m).sort().map(function (k) { return m[k]; });
  }
  function totals(rows) {
    var t = { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0, valueSpend: 0 };
    rows.forEach(function (r) { ['spend', 'impressions', 'clicks', 'conversions', 'conversionValue', 'valueSpend'].forEach(function (k) { t[k] += r[k] || 0; }); });
    return t;
  }
  function val(t, k) {
    var A = window.orvAnalytics;
    if (k === 'roas') return t.valueSpend ? t.conversionValue / t.valueSpend : null;
    return A.value(t, k);
  }

  // ── Render ─────────────────────────────────────────────────────
  function root() { return document.getElementById('dshRoot'); }
  function mount() {
    var host = document.getElementById('bizPanelOverview'); if (!host) return null;
    var r = root();
    if (!r) {
      r = document.createElement('div'); r.id = 'dshRoot'; r.className = 'dsh';
      host.insertBefore(r, host.firstChild);
      host.classList.add('dsh-on');
      r.addEventListener('click', onClick); r.addEventListener('change', onChange);
    }
    return r;
  }
  function firstName() { var n = typeof window.orvAppNavFirstName === 'function' ? String(window.orvAppNavFirstName() || '').trim() : ''; return /^(oriven\s*ai|orivenai|oriven)$/i.test(n) ? '' : n; }
  document.addEventListener('orv:first-name', function () { var h = document.querySelector('#dshRoot [data-dsh-greeting]'); if (h) { var n = firstName(); h.textContent = greeting() + (n ? ', ' + n : '') + '.'; } });
  function greeting() { var h = new Date().getHours(); return T(h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'); }
  function paint() {
    var r = mount(); if (!r) return;
    var A = window.orvAnalytics; if (!A) return;
    // The signed-in person's first name (profiles.first_name, else the first name given at sign-up —
    // js/appNav.js orvAppNavFirstName). Never the workspace/business name, never the email.
    var name = firstName();
    // No period control on the Dashboard: it always shows the last 30 days (the cards say what they compare with).
    var head = '<header class="dsh-head"><div><h1 data-dsh-greeting>' + esc(greeting() + (name ? ', ' + name : '') + '.') + '</h1><p>' + esc(T('sub')) + '</p></div></header>';
    r.innerHTML = head + '<div class="dsh-row1">' + perfCard() + '<div class="dsh-side">' + attentionCard() + platformsCard() + '</div></div>' +
      '<div class="dsh-row2">' + campsCard() + recsCard() + autoCard() + '</div>';
    if (A.bindCharts) A.bindCharts(r);
  }
  function perfCard() {
    var A = window.orvAnalytics;
    if (S.conn && !connected().length) return '<section class="dsh-card dsh-perf"><div class="dsh-card__h"><h2>' + esc(T('perf')) + '</h2></div><div class="dsh-empty"><p>' + esc(T('connectFirst')) + '</p><button type="button" class="dsh-btn dsh-btn--primary" data-dsh="connect">' + esc(T('connect')) + '</button></div></section>';
    var camps = (S.camps || []).slice().sort(function (a, b) { return (b.spend || 0) - (a.spend || 0); });
    var opts = '<option value="all">' + esc(T('allCamps')) + '</option>' + connected().map(function (p) {
      var list = camps.filter(function (c) { return c.platform === p; }); if (!list.length) return '';
      return '<optgroup label="' + esc(A.NAME[p]) + '">' + list.map(function (c) { var k = p + ':' + c.id; return '<option value="' + esc(k) + '"' + (S.campaign === k ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</optgroup>';
    }).join('');
    var sel = '<div class="dsh-sel"><label><span>Campaign</span><select data-dsh="campaign">' + opts + '</select></label><label><span>' + esc(T('metric')) + '</span><select data-dsh="metric">' + METRICS.map(function (k) { return '<option value="' + k + '"' + (S.metric === k ? ' selected' : '') + '>' + esc(A.label(k)) + '</option>'; }).join('') + '</select></label></div>';
    if (!S.data) return '<section class="dsh-card dsh-perf og-hi"><div class="dsh-card__h"><h2>' + esc(T('perf')) + '</h2>' + sel + '</div><div class="dsh-loading">' + esc(T('loading')) + '</div></section>';
    var cur = byDay(S.data, 'cur'), prev = byDay(S.data, 'prev'), tc = totals(cur), tp = totals(prev), cur$ = currency();
    var hasPrev = S.data.every(function (x) { return x.d.prev; });
    var tile = function (k) {
      var m = A.meta(k), v = val(tc, k), pv = hasPrev ? val(tp, k) : null, ch = A.change(v, pv), fc = ch == null ? null : A.fmtChange(ch, m.better);
      return '<button type="button" class="dsh-kpi' + (S.metric === k ? ' is-on' : '') + '" data-dsh-metric="' + k + '"><span>' + esc(A.label(k)) + '</span><b>' + esc(v == null ? '—' : A.fmt(v, m.kind, cur$)) + '</b><small class="' + (fc ? fc.cls : 'is-flat') + '">' + esc(fc ? fc.short + ' ' + T('vsPrev', { n: S.range }) : T('noPrev')) + '</small></button>';
    };
    var k = S.metric, m = A.meta(k);
    var labels = cur.map(function (x) { return x.date; });
    var lines = [{ name: T('thisPeriod'), color: '#9FE06A', values: cur.map(function (x) { return val(x, k); }) }];
    if (hasPrev && prev.length) lines.push({ name: T('prevPeriod'), color: 'rgba(200, 215, 190, .55)', dashed: true, values: prev.slice(-cur.length).map(function (x) { return val(x, k); }) });
    var chart = A.lineChart(lines, labels, { kind: m.kind, currency: cur$, height: 200, label: A.label(k) });
    return '<section class="dsh-card dsh-perf og-hi"><div class="dsh-card__h"><h2>' + esc(T('perf')) + '</h2>' + sel + '</div>' +
      '<div class="dsh-kpis">' + ['spend', 'conversions', 'cpa', 'roas'].map(tile).join('') + '</div><div class="dsh-chart">' + chart + '</div>' +
      (k === 'roas' ? '<p class="dsh-fine">' + esc(T('roasNote')) + '</p>' : '') + '</section>';
  }
  function attentionCard() {
    var items = window.orvAttention ? window.orvAttention.items() : null;
    var bad = (items || []).filter(function (x) { return x.sev !== 'ready'; });
    var body = items === null ? '<p class="dsh-muted">…</p>' : !bad.length ? '<p class="dsh-ok"><i aria-hidden="true">✓</i>' + esc(T('allClear')) + '</p>'
      : '<ul class="dsh-att">' + bad.slice(0, 3).map(function (x) { return '<li class="is-' + x.sev + '"><i aria-hidden="true"></i><span>' + esc(x.title) + '</span></li>'; }).join('') + '</ul>' + (bad.length > 3 ? '<p class="dsh-muted">' + esc(T('more', { n: bad.length - 3 })) + '</p>' : '');
    return '<section class="dsh-card dsh-attn' + (bad.length ? ' og-tone-warn' : '') + '"><div class="dsh-card__h"><h2>' + esc(T('attention')) + '</h2><span class="dsh-count">' + (items === null ? '…' : bad.length) + '</span></div>' + body +
      '<button type="button" class="dsh-btn" data-dsh="attention">' + esc(T('openAttention')) + ' →</button></section>';
  }
  function platformsCard() {
    var A = window.orvAnalytics;
    var rows = A.PLATFORMS.map(function (p) {
      var c = S.conn && S.conn[p], st = !c ? 'unknown' : c.conn === 'connected' ? 'on' : c.conn === 'expired' ? 'warn' : 'off';
      return '<li class="is-' + st + '"><i aria-hidden="true"></i><span>' + esc(A.SHORT[p]) + '</span><small>' + esc(st === 'on' ? T('connected') : st === 'warn' ? T('expired') : st === 'off' ? T('notConnected') : '…') + '</small></li>';
    }).join('');
    return '<section class="dsh-card dsh-plats"><div class="dsh-card__h"><h2>' + esc(T('platforms')) + '</h2><button type="button" class="dsh-link" data-dsh="platforms">' + esc(T('manage')) + '</button></div><ul class="dsh-platlist">' + rows + '</ul></section>';
  }
  function campsCard() {
    var A = window.orvAnalytics, cur$ = currency();
    var list = (S.camps || []).filter(function (c) { return c.spend > 0; }).sort(function (a, b) { return b.spend - a.spend; }).slice(0, 5);
    var max = list.length ? list[0].spend : 1;
    var body = S.camps === null ? '<p class="dsh-muted">' + esc(T('loading')) + '</p>' : !list.length ? '<div class="dsh-empty dsh-empty--sm"><p>' + esc(T('noCamps')) + '</p></div>'
      : '<ul class="dsh-camps">' + list.map(function (c) {
          var cpa = c.conv ? c.spend / c.conv : null;
          return '<li><div class="dsh-camps__t"><i style="--c:' + A.COLOR[c.platform] + '" aria-hidden="true"></i><span title="' + esc(c.name) + '">' + esc(c.name) + '</span><b>' + esc(A.fmt(c.spend, 'm', cur$)) + '</b></div><div class="dsh-bar"><em style="width:' + Math.max(3, Math.round(c.spend / max * 100)) + '%"></em></div>' +
            '<small>' + esc(A.SHORT[c.platform] + (c.conv != null ? ' · ' + c.conv + ' ' + A.label('conversions').toLowerCase() : '') + (cpa ? ' · ' + A.label('cpa') + ' ' + A.fmt(cpa, 'm', cur$) : '')) + '</small></li>';
        }).join('') + '</ul>';
    return '<section class="dsh-card dsh-campcard"><div class="dsh-card__h"><h2>' + esc(T('topCamps')) + '</h2><small class="dsh-muted">' + esc(T('byspend', { range: T('range' + S.range).toLowerCase() })) + '</small></div>' + body +
      '<button type="button" class="dsh-btn" data-dsh="campaigns">' + esc(T('openCamps')) + ' →</button></section>';
  }
  function recsCard() {
    var A = window.orvAnalytics, recs = [];
    // From the plan: the next open tasks, with who can do them.
    var EXEC = { research: 1, 'competitor-analysis': 1, create: 1, 'creative-testing': 1, 'campaign-builder': 1, automations: 1, campaigns: 1, 'campaign-comparison': 1 };
    if (S.plan && S.plan.phases) {
      var open = []; S.plan.phases.forEach(function (p) { p.steps.forEach(function (x) { if (!x.done) open.push(x); }); });
      open.slice(0, 2).forEach(function (x) { var can = !!EXEC[x.page]; recs.push('<li class="dsh-rec"><span class="dsh-tag' + (can ? ' is-ai' : '') + '">' + esc(can ? T('canDo') : T('upToYou')) + '</span><b>' + esc(x.step) + '</b></li>'); });
    }
    // Calculated from the period's figures, per platform.
    if (S.data && S.campaign === 'all' && S.data.length > 1) {
      var per = S.data.map(function (x) { var t = A.sum(x.d.cur, x.d.valueReported); return { p: x.p, t: t }; }).filter(function (x) { return x.t.spend > 0; });
      var withConv = per.filter(function (x) { return x.t.conversions >= 3; });
      if (withConv.length > 1) { var best = withConv.slice().sort(function (a, b) { return A.value(a.t, 'cpa') - A.value(b.t, 'cpa'); })[0]; recs.push('<li class="dsh-rec"><span class="dsh-tag is-calc">' + esc(T('calc')) + '</span><b>' + esc(T('cpaBest', { p: A.NAME[best.p], v: A.fmt(A.value(best.t, 'cpa'), 'm', currency()) })) + '</b></li>'); }
      var sp = per.reduce(function (a, x) { return a + x.t.spend; }, 0), cv = per.reduce(function (a, x) { return a + x.t.conversions; }, 0);
      if (sp && cv) { var top = per.map(function (x) { return { p: x.p, s: x.t.spend / sp * 100, c: x.t.conversions / cv * 100 }; }).sort(function (a, b) { return (b.c - b.s) - (a.c - a.s); })[0]; if (top && top.c - top.s >= 5) recs.push('<li class="dsh-rec"><span class="dsh-tag is-calc">' + esc(T('calc')) + '</span><b>' + esc(T('share', { p: A.NAME[top.p], c: Math.round(top.c), s: Math.round(top.s) })) + '</b></li>'); }
    }
    var body = S.plan === null && !S.data ? '<p class="dsh-muted">' + esc(T('loading')) + '</p>' : recs.length ? '<ul class="dsh-recs">' + recs.slice(0, 4).join('') + '</ul>' : '<div class="dsh-empty dsh-empty--sm"><p>' + esc(T('noRecs')) + '</p></div>';
    return '<section class="dsh-card dsh-reccard"><div class="dsh-card__h"><h2>' + esc(T('recs')) + '</h2></div>' + body + '<button type="button" class="dsh-btn" data-dsh="tasks">' + esc(T('openTasks')) + ' →</button></section>';
  }
  function autoCard() {
    var a = S.autos, c = a && a.counts || {};
    var nx = a && a.nextRun;
    var num = function (n, l) { return '<div><b>' + (a ? n : '…') + '</b><span>' + esc(l) + '</span></div>'; };
    return '<section class="dsh-card dsh-auto og-tone-rich"><div class="dsh-card__h"><h2>' + esc(T('auto')) + '</h2></div><div class="dsh-autonums">' + num(c.active || 0, T('active')) + num(c.paused || 0, T('paused')) + num((c.pendingApprovals || 0) + (c.needsReview || 0), T('approvals')) + '</div>' +
      '<p class="dsh-next"><span>' + esc(T('nextRun')) + '</span>' + esc(nx ? (nx.campaign_name || '') + ' · ' + (window.orvAnalytics ? '' : '') + new Date(nx.run_at).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : T('none')) + '</p>' +
      '<button type="button" class="dsh-btn" data-dsh="auto">' + esc(T('openAuto')) + ' →</button></section>';
  }

  // ── Events ─────────────────────────────────────────────────────
  function onClick(e) {
    var b = e.target.closest('[data-dsh], [data-dsh-metric]'); if (!b) return;
    if (b.hasAttribute('data-dsh-metric')) { S.metric = b.getAttribute('data-dsh-metric'); paint(); return; }
    var a = b.getAttribute('data-dsh');
    if (a === 'attention') go('attention');
    else if (a === 'campaigns') go('adstudio');
    else if (a === 'tasks') go('progress');
    else if (a === 'auto') go('auto-overview');
    else if (a === 'platforms' || a === 'connect') { if (window.orvPages) window.orvPages.open('ad-platforms'); }
  }
  function onChange(e) {
    var el = e.target, a = el.getAttribute('data-dsh');
    if (a === 'range') { S.range = +el.value; S.campaign = 'all'; load(true); }
    else if (a === 'campaign') { S.campaign = el.value; var g = ++S.gen; S.data = null; paint(); loadSeries(g); }
    else if (a === 'metric') { S.metric = el.value; paint(); }
  }

  // Draw whenever the Dashboard is shown (data cached for a minute).
  function visible() { var pg = document.getElementById('page-business-brain'), host = document.getElementById('bizPanelOverview'); return !!(pg && pg.classList.contains('active') && host && host.offsetParent !== null); }
  var pending = 0;
  function check() { clearTimeout(pending); pending = setTimeout(function () { if (visible()) load(false); }, 60); }
  function init() {
    var pg = document.getElementById('page-business-brain'), host = document.getElementById('bizPanelOverview');
    if (!pg || !host) return;
    new MutationObserver(check).observe(pg, { attributes: true, attributeFilter: ['class', 'style'] });
    new MutationObserver(check).observe(host, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    check();
    if (typeof window.applyLanguage === 'function' && !window.applyLanguage._dsh) {
      var al = window.applyLanguage;
      window.applyLanguage = function () { var r = al.apply(this, arguments); try { if (root()) paint(); } catch (_) {} return r; };
      window.applyLanguage._dsh = true;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.orvDashboard = { load: load, paint: paint, _state: function () { return S; } };
})();
