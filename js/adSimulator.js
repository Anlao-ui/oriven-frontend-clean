/* ════════════════════════════════════════════════════════════════
   Campaign Management → Ad Simulator (#page-ad-simulator)

   Try advertising strategies before spending real money. A simulation
   holds up to eight scenarios; each scenario is a set of assumptions the
   user controls (budget, days, platforms, prices, rates, values).

     Scenario Lab     the scenarios side by side: set up one, see what the
                      assumptions add up to, what-if sliders, compare all.
     My Simulations   saved simulations (GET/POST/PUT/DELETE
                      /api/simulations — creative_assets kind 'simulation').

   Every number on the page comes from js/adSimEngine.js in the browser:
   arithmetic ("Calculated from your assumptions") and a seeded Monte Carlo
   run ("Simulated range"). No AI call, no credits, no loading screens. The
   only AI is optional ("Ask the assistant to explain"), through the app's
   own assistant, which charges like every assistant message.

   Starting values are examples, never benchmarks. "Use my account's
   figures" fills one platform's assumptions from its own reported last 30
   days (js/orvAnalytics.js, the same data as Cross-platform Comparison)
   and says so next to the numbers. "Prepare in Create" hands the platform
   and goal to Create; nothing is ever published from here.
   window.orvAdSimulator.open()
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var K = window.orvGrowthKit, E = window.orvAdSimEngine; if (!K || !E) return;
  var esc = K.esc, api = K.api;
  var PAGE = 'page-ad-simulator', ROOT = 'asimRoot';
  var NAME = { google: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads', pinterest: 'Pinterest Ads', snapchat: 'Snapchat Ads' };
  var OBJ = { sales: 'Sales', leads: 'Leads', traffic: 'Traffic', awareness: 'Awareness' };
  var SURE = { low: ['Fairly sure', 'Narrow range (±12%)'], medium: ['Somewhat sure', 'Moderate range (±25%)'], high: ['Rough guess', 'Wide range (±45%)'] };
  var EXAMPLE = { basis: 'cpm', cpm: 8, cpc: 0.6, ctr: 1, cvr: 2, value: 50 };
  var LETTERS = 'ABCDEFGH';
  var RUNS = 2000;

  var S = fresh(null);
  function fresh(uid) { return { uid: uid, view: 'lab', sim: null, id: null, dirty: false, saving: false, msg: null, list: null, listErr: '', whatIf: noWhatIf(), conn: null, filling: {}, fillMsg: {}, confirmDel: null, cmpMetric: 'revenue', quick: { platforms: ['meta'], budget: 1000, days: 30, objective: 'sales' } }; }
  function noWhatIf() { return { budget: 1, price: 1, ctr: 1, cvr: 1, value: 1 }; }

  // ── Formatting ─────────────────────────────────────────────────
  function money(v, dp) {
    if (v == null || !isFinite(v)) return '—';
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', minimumFractionDigits: dp != null ? dp : (Math.abs(v) < 10 ? 2 : 0), maximumFractionDigits: dp != null ? dp : (Math.abs(v) < 10 ? 2 : 0) }).format(v); } catch (_) { return '€' + v.toFixed(2); }
  }
  function count(v) {
    if (v == null || !isFinite(v)) return '—';
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M';
    if (Math.abs(v) >= 1e4) return (v / 1e3).toFixed(v >= 1e5 ? 0 : 1) + 'K';
    return Math.round(v).toLocaleString();
  }
  function pctf(v) { return v == null || !isFinite(v) ? '—' : (v < 10 ? v.toFixed(2) : v.toFixed(1)) + '%'; }
  function times(v) { return v == null || !isFinite(v) ? '—' : v.toFixed(2) + '×'; }
  var FMT = { spend: money, impressions: count, reach: count, clicks: count, conversions: function (v) { return v == null ? '—' : v < 100 ? (Math.round(v * 10) / 10).toLocaleString() : count(v); }, revenue: money, cpc: money, cpm: money, cpa: money, ctr: pctf, cvr: pctf, roas: times };

  // ── Model helpers ──────────────────────────────────────────────
  function uidS() { return 's' + Math.random().toString(36).slice(2, 8); }
  function newScenario(name, base) {
    var b = base || {};
    return E.scenario({ id: uidS(), name: name, objective: b.objective || 'sales', budget: b.budget || 1000, days: b.days || 30, uncertainty: 'medium', frequency: 1.8, creatives: 1,
      channels: (b.platforms || ['meta']).map(function (p, i, all) { return Object.assign({ platform: p, share: Math.round(100 / all.length) }, EXAMPLE); }) });
  }
  function active() { if (!S.sim) return null; for (var i = 0; i < S.sim.scenarios.length; i++) if (S.sim.scenarios[i].id === S.sim.activeId) return S.sim.scenarios[i]; return S.sim.scenarios[0]; }
  function nextLetterName() { var used = {}; S.sim.scenarios.forEach(function (s) { used[s.name] = 1; }); for (var i = 0; i < LETTERS.length; i++) if (!used['Scenario ' + LETTERS[i]]) return 'Scenario ' + LETTERS[i]; return 'Scenario ' + (S.sim.scenarios.length + 1); }
  function touch() { S.dirty = true; S.msg = null; }
  var cache = {};
  function results(s) {
    var key = JSON.stringify(s);
    if (!cache[key]) { cache[key] = { calc: E.calculate(s), sim: E.simulate(s, { runs: RUNS }) }; var ks = Object.keys(cache); if (ks.length > 40) delete cache[ks[0]]; }
    return cache[key];
  }
  function convPossible(s) { return s.channels.some(function (c) { return c.cvr > 0; }); }

  // ── Page ───────────────────────────────────────────────────────
  function open() {
    var root = K.mount(PAGE, ROOT, onClick); if (!root) return;
    var pg = document.getElementById(PAGE);
    if (pg && !pg._asimBound) { pg._asimBound = true; pg.addEventListener('input', onInput); pg.addEventListener('change', onChange); }
    if (K.uid() !== S.uid) S = fresh(K.uid());
    K.show('simulator', PAGE);
    render();
    loadConnections();
  }
  function loadConnections() {
    var A = window.orvAnalytics; if (!A || !A.connections) { S.conn = {}; return; }
    A.connections().then(function (c) { S.conn = c || {}; if (S.sim) render(); }, function () { S.conn = {}; });
  }
  function connected(p) { var c = S.conn && S.conn[p]; return !!(c && c.conn === 'connected'); }

  function render() {
    if (soon) { clearTimeout(soon); soon = 0; }
    var root = document.getElementById(ROOT); if (!root) return;
    var tabs = '<div class="asim-views" role="tablist" aria-label="Ad Simulator views">' +
      '<button type="button" role="tab" class="asim-view' + (S.view === 'lab' ? ' is-on' : '') + '" aria-selected="' + (S.view === 'lab') + '" data-asim-view="lab">Scenario Lab</button>' +
      '<button type="button" role="tab" class="asim-view' + (S.view === 'list' ? ' is-on' : '') + '" aria-selected="' + (S.view === 'list') + '" data-asim-view="list">My Simulations</button>' +
      '</div>';
    var head = K.head('Campaign Management', 'Ad Simulator', 'Try budgets, platforms and assumptions before you spend real money. Every result here is worked out from your assumptions — a simulation, not a forecast of what the platforms will deliver.',
      '<div class="asim-headact"><button type="button" class="rx-btn rx-btn-ghost" data-asim-new>New simulation</button></div>');
    root.innerHTML = '<div class="asim">' + head + tabs + (S.view === 'list' ? listHtml() : S.sim ? labHtml() : startHtml()) + '</div>';
    if (S.view === 'list' && S.list === null) loadList();
  }

  // ── New simulation (beginner setup) ────────────────────────────
  function startHtml() {
    var q = S.quick;
    return '<section class="rx-card asim-start" aria-labelledby="asimStartH">' +
      '<div class="asim-start__intro"><h2 id="asimStartH">New simulation</h2>' +
      '<p>Start with a few basics. You can change every assumption afterwards, add more scenarios and compare them side by side.</p>' +
      '<ul class="asim-facts"><li><b>Calculated instantly in your browser.</b> Moving a slider never costs credits.</li><li><b>Your numbers, not ours.</b> The starting values are examples — replace them with your own or with your account’s figures.</li><li><b>Nothing is published.</b> When you like a scenario, you can prepare it in Create and review it there.</li></ul></div>' +
      '<div class="asim-start__form">' +
        field('Platforms', '<div class="asim-chips" role="group" aria-label="Platforms">' + E.PLATFORMS.map(function (p) { var on = q.platforms.indexOf(p) >= 0; return '<button type="button" class="asim-chip' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-asim-qp="' + p + '">' + esc(NAME[p]) + '</button>'; }).join('') + '</div>') +
        '<div class="asim-row2">' + field('Total budget (€)', '<input class="asim-in" type="number" min="1" step="10" inputmode="decimal" data-asim-q="budget" value="' + esc(q.budget) + '">') +
        field('Duration (days)', '<input class="asim-in" type="number" min="1" max="365" step="1" inputmode="numeric" data-asim-q="days" value="' + esc(q.days) + '">') + '</div>' +
        field('Campaign objective', select('data-asim-q="objective"', OBJ, q.objective)) +
        '<button type="button" class="rx-btn rx-btn-primary asim-start__go" data-asim-start' + (q.platforms.length ? '' : ' disabled') + '>Build scenario</button>' +
        (q.platforms.length ? '' : '<p class="asim-note">Choose at least one platform.</p>') +
      '</div></section>';
  }
  function field(label, control, hint) { return '<label class="asim-field"><span class="asim-lbl">' + esc(label) + '</span>' + control + (hint ? '<span class="asim-hint">' + hint + '</span>' : '') + '</label>'; }
  function select(attr, opts, val) { return '<select class="asim-in" ' + attr + '>' + Object.keys(opts).map(function (k) { return '<option value="' + esc(k) + '"' + (k === val ? ' selected' : '') + '>' + esc(opts[k]) + '</option>'; }).join('') + '</select>'; }

  // ── Scenario Lab ───────────────────────────────────────────────
  function labHtml() {
    var s = active();
    return '<div class="asim-bar">' +
        '<label class="asim-name"><span class="sr-only">Simulation name</span><input class="asim-in asim-name__in" maxlength="100" data-asim-simname value="' + esc(S.sim.name) + '"></label>' +
        '<span class="asim-save-state" id="asimSaveState">' + saveState() + '</span>' +
        '<button type="button" class="rx-btn rx-btn-primary" data-asim-save' + (S.saving ? ' disabled' : '') + '>' + (S.saving ? 'Saving…' : S.id ? 'Save changes' : 'Save simulation') + '</button>' +
      '</div>' +
      (S.msg ? '<p class="asim-msg asim-msg--' + esc(S.msg.kind) + '" role="status">' + esc(S.msg.text) + '</p>' : '') +
      '<div class="asim-scenarios" id="asimScenarios">' + scenarioCards() + '</div>' +
      '<div class="asim-grid">' +
        '<section class="rx-card asim-setup" aria-labelledby="asimSetupH">' + setupHtml(s) + '</section>' +
        '<div class="asim-out">' +
          '<section class="rx-card asim-results" id="asimResults" aria-live="polite">' + resultsHtml(s) + '</section>' +
          '<section class="rx-card asim-whatif" aria-labelledby="asimWiH">' + whatIfHtml(s) + '</section>' +
        '</div>' +
      '</div>' +
      '<section class="rx-card asim-compare" id="asimCompare" aria-labelledby="asimCmpH">' + compareHtml() + '</section>' +
      '<div class="asim-foot">' +
        '<section class="rx-card asim-handoff" aria-labelledby="asimHoH">' + handoffHtml(s) + '</section>' +
        '<section class="rx-card asim-method" aria-labelledby="asimMethodH">' + methodHtml() + '</section>' +
      '</div>';
  }
  function saveState() { return S.saving ? '' : S.dirty ? '<i class="asim-dot asim-dot--warn" aria-hidden="true"></i>Unsaved changes' : S.id ? '<i class="asim-dot asim-dot--ok" aria-hidden="true"></i>Saved' : 'Not saved yet'; }

  function scenarioCards() {
    var list = S.sim.scenarios.map(function (s) {
      var r = results(s), on = s.id === S.sim.activeId;
      var line = convPossible(s) ? 'ROAS ' + times(r.calc.total.roas) + ' · ' + FMT.conversions(r.calc.total.conversions) + ' conversions' : count(r.calc.total.clicks) + ' clicks';
      return '<div class="asim-sc' + (on ? ' is-on' : '') + '">' +
        '<button type="button" class="asim-sc__main" data-asim-pick="' + esc(s.id) + '" aria-pressed="' + on + '">' +
          '<b>' + esc(s.name) + '</b><span>' + esc(money(s.budget, 0) + ' · ' + s.days + ' days · ' + s.channels.map(function (c) { return NAME[c.platform].replace(' Ads', ''); }).join(' + ')) + '</span><span class="asim-sc__k">' + esc(line) + '</span>' +
        '</button>' +
        '<div class="asim-sc__acts">' +
          '<button type="button" class="asim-icon" data-asim-dup="' + esc(s.id) + '" title="Duplicate" aria-label="Duplicate ' + esc(s.name) + '"' + (S.sim.scenarios.length >= 8 ? ' disabled' : '') + '>' + ICON.dup + '</button>' +
          (S.sim.scenarios.length > 1 ? '<button type="button" class="asim-icon" data-asim-del="' + esc(s.id) + '" title="Remove" aria-label="Remove ' + esc(s.name) + '">' + ICON.del + '</button>' : '') +
        '</div></div>';
    }).join('');
    return list + (S.sim.scenarios.length < 8 ? '<button type="button" class="asim-sc asim-sc--add" data-asim-add><span aria-hidden="true">+</span> Add scenario</button>' : '');
  }
  var ICON = {
    dup: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/></svg>',
    del: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
  };

  function setupHtml(s) {
    var totalShare = s.channels.reduce(function (a, c) { return a + c.share; }, 0);
    var chans = s.channels.map(function (c, i) { return channelHtml(s, c, i, totalShare); }).join('');
    var addable = E.PLATFORMS.filter(function (p) { return !s.channels.some(function (c) { return c.platform === p; }); });
    return '<h2 id="asimSetupH" class="asim-h">Assumptions</h2>' +
      '<div class="asim-row2">' + field('Scenario name', '<input class="asim-in" maxlength="80" data-asim-s="name" value="' + esc(s.name) + '">') +
      field('Objective', select('data-asim-s="objective"', OBJ, s.objective)) + '</div>' +
      '<div class="asim-row3">' +
        field('Total budget (€)', '<input class="asim-in" type="number" min="1" step="10" inputmode="decimal" data-asim-s="budget" value="' + esc(round2(s.budget)) + '">') +
        field('Daily budget (€)', '<input class="asim-in" type="number" min="0.01" step="1" inputmode="decimal" data-asim-s="daily" value="' + esc(round2(s.budget / s.days)) + '">') +
        field('Duration (days)', '<input class="asim-in" type="number" min="1" max="365" step="1" inputmode="numeric" data-asim-s="days" value="' + esc(s.days) + '">') +
      '</div>' +
      '<h3 class="asim-h3">Platforms and their numbers</h3>' +
      '<div class="asim-chans">' + chans + '</div>' +
      (addable.length ? '<div class="asim-addp"><span class="asim-lbl">Add a platform</span><div class="asim-chips">' + addable.map(function (p) { return '<button type="button" class="asim-chip" data-asim-addp="' + p + '">+ ' + esc(NAME[p]) + '</button>'; }).join('') + '</div></div>' : '') +
      '<details class="asim-adv"><summary>Advanced assumptions</summary>' +
        '<fieldset class="asim-sure"><legend class="asim-lbl">How sure are you about these numbers?</legend>' + Object.keys(SURE).map(function (k) { return '<label class="asim-radio"><input type="radio" name="asimSure" value="' + k + '" data-asim-s="uncertainty"' + (s.uncertainty === k ? ' checked' : '') + '><span><b>' + esc(SURE[k][0]) + '</b> ' + esc(SURE[k][1]) + '</span></label>'; }).join('') + '</fieldset>' +
        '<div class="asim-row2">' +
          field('Average frequency', '<input class="asim-in" type="number" min="1" max="20" step="0.1" inputmode="decimal" data-asim-s="frequency" value="' + esc(s.frequency) + '">', 'How often one person sees your ads. Used only to estimate reach.') +
          field('Creatives tested', '<input class="asim-in" type="number" min="1" max="20" step="1" inputmode="numeric" data-asim-s="creatives" value="' + esc(s.creatives) + '">', 'Splits the budget, so you see what each creative gets.') +
        '</div>' +
      '</details>';
  }
  function round2(v) { return Math.round(v * 100) / 100; }
  function channelHtml(s, c, i, totalShare) {
    var p = c.platform, src = c.source || { kind: 'manual' };
    var shareNow = totalShare > 0 ? Math.round(c.share / totalShare * 100) : 0;
    var srcHtml = src.kind === 'account'
      ? '<span class="asim-src asim-src--acct" title="Filled from your connected account">From your account · ' + esc(src.label || NAME[p]) + (src.since ? ' · ' + esc(src.since) + ' – ' + esc(src.until) : '') + '</span>'
      : '<span class="asim-src">Your assumptions' + (isExample(c) ? ' · example starting values, not a benchmark' : '') + '</span>';
    var fill = connected(p)
      ? '<button type="button" class="asim-link" data-asim-fill="' + p + '"' + (S.filling[p] ? ' disabled' : '') + '>' + (S.filling[p] ? 'Reading your figures…' : 'Use my account’s figures') + '</button>'
      : '';
    var fm = S.fillMsg[p] ? '<p class="asim-note" role="status">' + esc(S.fillMsg[p]) + '</p>' : '';
    return '<div class="asim-chan" data-plat="' + p + '">' +
      '<div class="asim-chan__top"><b class="asim-chan__name"><i class="asim-pdot asim-pdot--' + p + '" aria-hidden="true"></i>' + esc(NAME[p]) + '</b>' + srcHtml +
        (s.channels.length > 1 ? '<button type="button" class="asim-icon" data-asim-rmp="' + p + '" title="Remove ' + esc(NAME[p]) + '" aria-label="Remove ' + esc(NAME[p]) + '">' + ICON.del + '</button>' : '') + '</div>' +
      (s.channels.length > 1 ? '<label class="asim-share"><span class="asim-lbl">Share of budget <output data-asim-shareout="' + p + '">' + shareNow + '% · ' + esc(money(s.budget * shareNow / 100, 0)) + '</output></span><input type="range" min="0" max="100" step="1" value="' + esc(c.share) + '" data-asim-c="share" data-p="' + p + '" aria-label="' + esc(NAME[p]) + ' share of budget"></label>' : '') +
      '<div class="asim-row4">' +
        '<label class="asim-field"><span class="asim-lbl">Price</span><span class="asim-pair">' + select('data-asim-c="basis" data-p="' + p + '" aria-label="' + esc(NAME[p]) + ' pricing"', { cpm: 'CPM €', cpc: 'CPC €' }, c.basis) +
          '<input class="asim-in" type="number" min="0.001" step="0.01" inputmode="decimal" data-asim-c="' + (c.basis === 'cpc' ? 'cpc' : 'cpm') + '" data-p="' + p + '" value="' + esc(c.basis === 'cpc' ? c.cpc : c.cpm) + '" aria-label="' + esc(NAME[p]) + ' ' + (c.basis === 'cpc' ? 'cost per click' : 'cost per 1,000 impressions') + '"></span></label>' +
        field('CTR (%)', '<input class="asim-in" type="number" min="0" max="100" step="0.1" inputmode="decimal" data-asim-c="ctr" data-p="' + p + '" value="' + esc(c.ctr) + '">') +
        field('Conversion rate (%)', '<input class="asim-in" type="number" min="0" max="100" step="0.1" inputmode="decimal" data-asim-c="cvr" data-p="' + p + '" value="' + esc(c.cvr) + '">') +
        field('Conversion value (€)', '<input class="asim-in" type="number" min="0" step="1" inputmode="decimal" data-asim-c="value" data-p="' + p + '" value="' + esc(c.value) + '">') +
      '</div>' + fill + fm + '</div>';
  }
  function isExample(c) { return c.cpm === EXAMPLE.cpm && c.ctr === EXAMPLE.ctr && c.cvr === EXAMPLE.cvr && c.value === EXAMPLE.value && (c.basis === 'cpm' || c.cpc === EXAMPLE.cpc); }

  // ── Results ────────────────────────────────────────────────────
  function resultsHtml(s) {
    var r = results(s), t = r.calc.total, b = r.sim.bands, conv = convPossible(s);
    var tiles = [['spend', 'Spend', t.spend], ['impressions', 'Impressions', t.impressions], ['reach', 'Estimated reach', t.reach], ['clicks', 'Clicks', t.clicks], ['ctr', 'CTR', t.ctr], ['cpc', 'CPC', t.cpc], ['cpm', 'CPM', t.cpm]]
      .concat(conv ? [['conversions', 'Conversions', t.conversions], ['cpa', 'CPA', t.cpa], ['revenue', 'Revenue', t.revenue], ['roas', 'ROAS', t.roas]] : []);
    var grid = '<div class="asim-tiles">' + tiles.map(function (x) { return '<div class="asim-tile' + (x[0] === 'roas' || x[0] === 'revenue' ? ' asim-tile--key' : '') + '"><span>' + esc(x[1]) + '</span><b>' + esc(FMT[x[0]](x[2])) + '</b></div>'; }).join('') + '</div>';
    var rows = conv ? [['conversions', 'Conversions'], ['revenue', 'Revenue'], ['roas', 'ROAS'], ['cpa', 'CPA']] : [['impressions', 'Impressions'], ['clicks', 'Clicks']];
    var band = '<table class="asim-band"><thead><tr><th scope="col">Metric</th><th scope="col">Conservative<small>10th pct.</small></th><th scope="col">Median</th><th scope="col">Optimistic<small>90th pct.</small></th></tr></thead><tbody>' +
      rows.map(function (x) {
        var v = b[x[0]]; if (!v) return '<tr><th scope="row">' + esc(x[1]) + '</th><td colspan="3" class="asim-muted">Not calculated — no simulated run had a conversion</td></tr>';
        // a higher CPA is worse: its conservative case is the 90th percentile
        var lo = x[0] === 'cpa' ? v.p90 : v.p10, hi = x[0] === 'cpa' ? v.p10 : v.p90;
        return '<tr><th scope="row">' + esc(x[1]) + '</th><td>' + esc(FMT[x[0]](lo)) + '</td><td><b>' + esc(FMT[x[0]](v.p50)) + '</b></td><td>' + esc(FMT[x[0]](hi)) + '</td></tr>';
      }).join('') + '</tbody></table>';
    var be = conv ? '<p class="asim-be"><b>' + Math.round(r.sim.breakEvenShare * 100) + '%</b> of the simulated runs earned back the ad spend (revenue ≥ spend).' + (r.sim.noConversionShare > 0.05 ? ' In ' + Math.round(r.sim.noConversionShare * 100) + '% of runs there was no conversion at all.' : '') + '</p>' : '';
    var chans = s.channels.length > 1 ? '<h3 class="asim-h3">Per platform</h3><div class="asim-tablewrap"><table class="asim-ptable"><thead><tr><th scope="col">Platform</th><th scope="col">Spend</th><th scope="col">Impressions</th><th scope="col">Clicks</th>' + (conv ? '<th scope="col">Conversions</th><th scope="col">Revenue</th><th scope="col">ROAS</th>' : '') + '</tr></thead><tbody>' +
      r.calc.channels.map(function (c) { return '<tr><th scope="row"><i class="asim-pdot asim-pdot--' + c.platform + '" aria-hidden="true"></i>' + esc(NAME[c.platform]) + '</th><td>' + esc(money(c.spend)) + '</td><td>' + esc(count(c.impressions)) + '</td><td>' + esc(count(c.clicks)) + '</td>' + (conv ? '<td>' + esc(FMT.conversions(c.conversions)) + '</td><td>' + esc(money(c.revenue)) + '</td><td>' + esc(times(c.roas)) + '</td>' : '') + '</tr>'; }).join('') + '</tbody></table></div>' : '';
    var per = s.creatives > 1 ? '<p class="asim-note">With ' + s.creatives + ' creatives, each gets about ' + esc(money(t.perCreative.spend, 0)) + ' and ' + esc(count(t.perCreative.impressions)) + ' impressions.' + (t.perCreative.clicks < 100 ? ' That’s under 100 clicks per creative — too few to tell creatives apart with confidence.' : '') + '</p>' : '';
    return '<div class="asim-resh"><h2 class="asim-h">' + esc(s.name) + '</h2><span class="asim-pill">' + esc(OBJ[s.objective]) + ' · ' + esc(money(t.dailyBudget)) + ' a day</span></div>' +
      '<h3 class="asim-h3">Calculated from your assumptions</h3>' + grid + per +
      '<h3 class="asim-h3">Simulated range <small>' + RUNS.toLocaleString() + ' runs · ' + esc(SURE[s.uncertainty][0].toLowerCase()) + '</small></h3>' +
      (conv ? histogramSvg(r, t.spend) : '') + band + be + chans;
  }

  // Outcome chart: how often each revenue came out in the runs.
  function histogramSvg(r, spend) {
    var h = E.histogram(r.sim.samples.revenue, 28); if (!h.length) return '';
    var W = 560, H = 166, pad = { l: 8, r: 8, t: 32, b: 24 }, max = Math.max.apply(null, h.map(function (x) { return x.count; }));
    var lo = h[0].from, hi = h[h.length - 1].to, span = hi - lo || 1;
    var x = function (v) { return pad.l + (v - lo) / span * (W - pad.l - pad.r); };
    var bw = (W - pad.l - pad.r) / h.length;
    var bars = h.map(function (b, i) {
      var bh = max ? (b.count / max) * (H - pad.t - pad.b) : 0, y = H - pad.b - bh;
      var share = Math.round(b.count / r.sim.runs * 1000) / 10;
      return '<rect class="asim-hb' + (b.to <= spend ? ' is-below' : '') + '" x="' + (pad.l + i * bw + 1).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + Math.max(0, bh).toFixed(1) + '" rx="2"><title>' + esc(money(b.from, 0) + ' – ' + money(b.to, 0) + ': ' + share + '% of runs') + '</title></rect>';
    }).join('');
    var b = r.sim.bands.revenue;
    // Markers left to right; a label too close to the previous one moves up a row.
    var marks = [[spend, 'Spend', 'is-spend'], [b.p10, 'P10', 'is-p'], [b.p50, 'Median', 'is-med'], [b.p90, 'P90', 'is-p']].filter(function (m) { return m[0] >= lo && m[0] <= hi; }).sort(function (m1, m2) { return m1[0] - m2[0]; });
    var lastX = -1e9, row = 0, mk = '';
    marks.forEach(function (m) { var xx = x(m[0]); row = xx - lastX < 52 ? (row ? 0 : 1) : 0; lastX = xx; var ty = pad.t - 6 - row * 12; mk += '<line class="asim-hm ' + m[2] + '" x1="' + xx.toFixed(1) + '" x2="' + xx.toFixed(1) + '" y1="' + (ty + 2) + '" y2="' + (H - pad.b) + '"/><text class="asim-hl ' + m[2] + '" x="' + xx.toFixed(1) + '" y="' + ty + '" text-anchor="middle">' + esc(m[1]) + '</text>'; });
    return '<figure class="asim-hist"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc('Simulated revenue: median ' + money(b.p50, 0) + ', 80% of runs between ' + money(b.p10, 0) + ' and ' + money(b.p90, 0) + '; spend ' + money(spend, 0)) + '">' +
      bars + mk +
      '<text class="asim-ax" x="' + pad.l + '" y="' + (H - 6) + '">' + esc(money(lo, 0)) + '</text><text class="asim-ax" x="' + (W - pad.r) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(money(hi, 0)) + '</text>' +
      '</svg><figcaption>Revenue across the simulated runs. Darker bars: runs that didn’t earn back the spend.</figcaption></figure>';
  }

  // ── What if ────────────────────────────────────────────────────
  var WI = [['budget', 'Budget', 0.5, 3, 0.05], ['price', 'Cost (CPM / CPC)', 0.5, 2, 0.05], ['ctr', 'Click-through rate', 0.5, 2, 0.05], ['cvr', 'Conversion rate', 0.5, 2, 0.05], ['value', 'Value per conversion', 0.5, 2, 0.05]];
  function whatIfHtml(s) {
    return '<div class="asim-wih"><h2 id="asimWiH" class="asim-h">What if…</h2><button type="button" class="asim-link" data-asim-wireset>Reset</button></div>' +
      '<p class="asim-sub">Change one thing at a time and see what it does to “' + esc(s.name) + '”. The scenario itself stays as it is until you apply the change.</p>' +
      '<div class="asim-sliders">' + WI.map(function (w) {
        var v = S.whatIf[w[0]];
        return '<label class="asim-slider"><span class="asim-lbl">' + esc(w[1]) + ' <output data-asim-wiout="' + w[0] + '">' + wiLabel(w[0], v, s) + '</output></span>' +
          '<input type="range" min="' + w[2] + '" max="' + w[3] + '" step="' + w[4] + '" value="' + v + '" data-asim-wi="' + w[0] + '" aria-label="' + esc(w[1]) + ' change"></label>';
      }).join('') + '</div>' +
      '<div id="asimWiOut">' + whatIfOut(s) + '</div>';
  }
  function wiLabel(k, v, s) { var d = Math.round((v - 1) * 100); var t = (d > 0 ? '+' : '') + d + '%'; return k === 'budget' ? esc(t + ' · ' + money(s.budget * v, 0)) : esc(t); }
  function changed() { var w = S.whatIf; return Object.keys(w).some(function (k) { return Math.abs(w[k] - 1) > 1e-9; }); }
  function whatIfOut(s) {
    if (!changed()) return '<p class="asim-note">Move a slider to see the effect.</p>';
    var a = results(s), b = results(E.adjust(s, S.whatIf)), conv = convPossible(s);
    var rows = (conv ? [['conversions', 'Conversions'], ['revenue', 'Revenue'], ['roas', 'ROAS'], ['cpa', 'CPA']] : [['impressions', 'Impressions'], ['clicks', 'Clicks'], ['cpc', 'CPC']]);
    var better = { cpa: 'lo', cpc: 'lo' };
    var tr = rows.map(function (x) {
      var k = x[0], v0 = a.calc.total[k], v1 = b.calc.total[k];
      var d = v0 && v1 != null && isFinite(v0) && isFinite(v1) ? (v1 - v0) / Math.abs(v0) * 100 : null;
      var good = d == null || Math.abs(d) < 0.5 ? '' : ((better[k] === 'lo') === (d < 0) ? ' is-up' : ' is-down');
      return '<tr><th scope="row">' + esc(x[1]) + '</th><td>' + esc(FMT[k](v0)) + '</td><td><b>' + esc(FMT[k](v1)) + '</b></td><td class="asim-d' + good + '">' + (d == null ? '—' : Math.abs(d) < 0.05 ? '0%' : (d > 0 ? '+' : '') + d.toFixed(Math.abs(d) < 10 ? 1 : 0) + '%') + '</td></tr>';
    }).join('');
    var rng = conv && b.sim.bands.revenue ? '<p class="asim-note">Simulated revenue with the change: ' + esc(money(b.sim.bands.revenue.p10, 0)) + ' – ' + esc(money(b.sim.bands.revenue.p90, 0)) + ' (median ' + esc(money(b.sim.bands.revenue.p50, 0)) + ').</p>' : '';
    var lin = S.whatIf.budget > 1.0001 ? '<p class="asim-warn">The model keeps your prices and rates when the budget grows. In real auctions, more budget usually costs more per result — treat a bigger budget’s result as an upper bound.</p>' : '';
    return '<table class="asim-wi"><thead><tr><th scope="col"></th><th scope="col">Now</th><th scope="col">With the change</th><th scope="col">Change</th></tr></thead><tbody>' + tr + '</tbody></table>' + rng + lin +
      '<div class="asim-acts"><button type="button" class="rx-btn rx-btn-ghost" data-asim-wiapply>Apply to this scenario</button><button type="button" class="rx-btn rx-btn-ghost" data-asim-wifork' + (S.sim.scenarios.length >= 8 ? ' disabled' : '') + '>Save as new scenario</button></div>';
  }

  // ── Compare ────────────────────────────────────────────────────
  var CMP = [['spend', 'Spend', null], ['impressions', 'Impressions', 'hi'], ['clicks', 'Clicks', 'hi'], ['cpc', 'CPC', 'lo'], ['conversions', 'Conversions', 'hi'], ['cpa', 'CPA', 'lo'], ['revenue', 'Revenue', 'hi'], ['roas', 'ROAS', 'hi']];
  function compareHtml() {
    var list = S.sim.scenarios;
    if (list.length < 2) return '<h2 id="asimCmpH" class="asim-h">Compare scenarios</h2><p class="asim-sub">Add a second scenario — or duplicate this one and change a few numbers — to compare them side by side.</p><button type="button" class="rx-btn rx-btn-ghost" data-asim-dup="' + esc(S.sim.activeId) + '">Duplicate this scenario</button>';
    var R = list.map(results);
    var conv = list.some(convPossible);
    var rows = CMP.filter(function (m) { return conv || ['conversions', 'cpa', 'revenue', 'roas'].indexOf(m[0]) < 0; });
    var head = '<tr><th scope="col">Metric</th>' + list.map(function (s) { return '<th scope="col">' + esc(s.name) + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (m) {
      var vals = R.map(function (r) { return r.calc.total[m[0]]; });
      var ok = vals.filter(function (v) { return v != null && isFinite(v); });
      var best = m[2] && ok.length > 1 ? (m[2] === 'hi' ? Math.max.apply(null, ok) : Math.min.apply(null, ok)) : null;
      // no "best" when every scenario has the same value
      if (best != null && ok.every(function (v) { return Math.abs(v - ok[0]) <= Math.abs(ok[0]) * 1e-9; })) best = null;
      return '<tr><th scope="row">' + esc(m[1]) + '</th>' + vals.map(function (v, i) {
        var bnd = R[i].sim.bands[m[0]];
        var range = bnd && m[0] !== 'spend' ? '<small>' + esc(FMT[m[0]](m[0] === 'cpa' ? bnd.p10 : bnd.p10)) + ' – ' + esc(FMT[m[0]](bnd.p90)) + '</small>' : '';
        return '<td' + (best != null && v === best ? ' class="is-best"' : '') + '>' + esc(FMT[m[0]](v)) + range + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var metricOpts = {}; (conv ? [['revenue', 'Revenue'], ['conversions', 'Conversions'], ['roas', 'ROAS'], ['cpa', 'CPA'], ['clicks', 'Clicks']] : [['clicks', 'Clicks'], ['impressions', 'Impressions']]).forEach(function (x) { metricOpts[x[0]] = x[1]; });
    if (!metricOpts[S.cmpMetric]) S.cmpMetric = Object.keys(metricOpts)[0];
    return '<div class="asim-cmph"><h2 id="asimCmpH" class="asim-h">Compare scenarios</h2>' +
      '<label class="asim-inline"><span class="asim-lbl">Chart</span>' + select('data-asim-cmpm', metricOpts, S.cmpMetric) + '</label></div>' +
      rangeChart(list, R, S.cmpMetric) +
      '<div class="asim-tablewrap"><table class="asim-ctable"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<p class="asim-note">Values are calculated from each scenario’s own assumptions; the small line under each is the simulated 10th – 90th percentile. <b class="asim-best-key">Highlighted</b>: the best value per metric. A difference between scenarios is only as real as the assumptions behind it.</p>';
  }
  function rangeChart(list, R, k) {
    var bands = R.map(function (r) { return r.sim.bands[k]; });
    if (bands.some(function (b) { return !b; })) return '';
    var lo = Math.min.apply(null, bands.map(function (b) { return b.p10; })), hi = Math.max.apply(null, bands.map(function (b) { return b.p90; }));
    if (!(hi > lo)) { hi = lo + 1; }
    var W = 640, rowH = 34, padL = 150, padR = 70, H = list.length * rowH + 26;
    var x = function (v) { return padL + (v - lo) / (hi - lo) * (W - padL - padR); };
    var f = FMT[k];
    var rows = list.map(function (s, i) {
      var b = bands[i], y = 14 + i * rowH + rowH / 2, on = s.id === S.sim.activeId;
      return '<g class="asim-rr' + (on ? ' is-on' : '') + '"><title>' + esc(s.name + ': ' + f(b.p10) + ' – ' + f(b.p90) + ', median ' + f(b.p50)) + '</title>' +
        '<text class="asim-rn" x="' + (padL - 12) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(s.name.length > 20 ? s.name.slice(0, 19) + '…' : s.name) + '</text>' +
        '<line class="asim-rl" x1="' + x(b.p10).toFixed(1) + '" x2="' + x(b.p90).toFixed(1) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<circle class="asim-rd" cx="' + x(b.p50).toFixed(1) + '" cy="' + y + '" r="6"/>' +
        '<text class="asim-rv" x="' + (x(b.p90) + 10).toFixed(1) + '" y="' + (y + 4) + '">' + esc(f(b.p50)) + '</text></g>';
    }).join('');
    return '<figure class="asim-range"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc('Simulated ' + k + ' per scenario, 10th to 90th percentile with the median') + '">' +
      '<line class="asim-rax" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (H - 12) + '" y2="' + (H - 12) + '"/>' +
      '<text class="asim-ax" x="' + padL + '" y="' + (H - 1) + '">' + esc(f(lo)) + '</text><text class="asim-ax" x="' + (W - padR) + '" y="' + (H - 1) + '" text-anchor="end">' + esc(f(hi)) + '</text>' +
      rows + '</svg><figcaption>Line: the middle 80% of simulated runs. Dot: the median.</figcaption></figure>';
  }

  // ── Hand-off and method ────────────────────────────────────────
  function handoffHtml(s) {
    var plats = s.channels.map(function (c) { return c.platform; });
    return '<h2 id="asimHoH" class="asim-h">Turn a scenario into a campaign</h2>' +
      '<p class="asim-sub">Create makes one campaign per platform. Choose a platform; OrivenAI opens Create with that platform and the objective “' + esc(OBJ[s.objective]) + '” filled in. Nothing is published — you review everything before it goes live.</p>' +
      '<ul class="asim-xfer"><li><b>Transferred:</b> platform, objective, and a note with the planned budget (' + esc(money(s.budget / s.days)) + ' a day for ' + s.days + ' days)</li>' +
      '<li><b>Not transferred:</b> the simulated prices and rates (they’re assumptions, not settings) — you set the daily budget yourself when you review the campaign</li></ul>' +
      '<div class="asim-chips">' + plats.map(function (p) { return '<button type="button" class="rx-btn rx-btn-ghost" data-asim-create="' + p + '">Prepare for ' + esc(NAME[p]) + '</button>'; }).join('') + '</div>';
  }
  function methodHtml() {
    var ai = typeof window.orvAiSend === 'function';
    return '<h2 id="asimMethodH" class="asim-h">How these numbers are made</h2>' +
      '<dl class="asim-dl">' +
        '<dt>Calculated</dt><dd>Plain arithmetic: spend ÷ CPM × 1,000 = impressions (or spend ÷ CPC = clicks), × CTR = clicks, × conversion rate = conversions, × value = revenue.</dd>' +
        '<dt>Simulated</dt><dd>' + RUNS.toLocaleString() + ' runs in which each rate varies around your value by how sure you are, and conversions come out as whole numbers by chance. Conservative and optimistic are the 10th and 90th percentile of those runs.</dd>' +
        '<dt>From your account</dt><dd>Only where you choose “Use my account’s figures”: that platform’s own reported last 30 days, labelled with the dates.</dd>' +
        '<dt>Not modelled</dt><dd>The platforms’ auctions, learning phases, audience saturation and seasonality. The model assumes your whole budget is delivered at the prices you entered.</dd>' +
      '</dl>' +
      (ai ? '<div class="asim-ai"><button type="button" class="rx-btn rx-btn-ghost" data-asim-ai>Ask the assistant to explain</button><span class="asim-note">Optional. Sends this scenario’s assumptions and results to your assistant; assistant messages use credits like elsewhere in OrivenAI.</span></div>' : '');
  }

  // ── My Simulations ─────────────────────────────────────────────
  function loadList() {
    api('/api/simulations').then(function (r) {
      if (r.ok && r.data) { S.list = r.data.simulations || []; S.listErr = ''; }
      else { S.list = []; S.listErr = K.refused(r); }
      if (S.view === 'list') render();
    });
  }
  function listHtml() {
    if (S.list === null) return '<section class="rx-card"><p class="asim-note">Loading your simulations…</p></section>';
    if (S.listErr) return '<section class="rx-card"><p class="asim-msg asim-msg--warn" role="alert">' + esc(S.listErr) + '</p><button type="button" class="rx-btn rx-btn-ghost" data-asim-retry>Try again</button></section>';
    if (!S.list.length) return '<section class="rx-card asim-empty"><h2 class="asim-h">No saved simulations yet</h2><p class="asim-sub">Build a simulation in the Scenario Lab and save it — it appears here so you can come back to it, change it and compare again.</p><button type="button" class="rx-btn rx-btn-primary" data-asim-view="lab">Open the Scenario Lab</button></section>';
    return '<ul class="asim-list">' + S.list.map(function (x) {
      var del = S.confirmDel === x.id
        ? '<span class="asim-confirm">Delete “' + esc(x.name) + '”? <button type="button" class="rx-btn rx-btn-danger" data-asim-delsim="' + esc(x.id) + '">Delete</button><button type="button" class="rx-btn rx-btn-ghost" data-asim-delno>Keep</button></span>'
        : '<button type="button" class="rx-btn rx-btn-ghost" data-asim-askdel="' + esc(x.id) + '">Delete</button>';
      return '<li class="rx-card asim-li' + (S.id === x.id ? ' is-on' : '') + '"><div><b>' + esc(x.name) + '</b><span>' + x.scenarios + ' scenario' + (x.scenarios === 1 ? '' : 's') + ' · saved ' + esc(K.day(x.savedAt)) + '</span></div>' +
        '<div class="asim-acts"><button type="button" class="rx-btn rx-btn-primary" data-asim-open="' + esc(x.id) + '">Open</button>' + del + '</div></li>';
    }).join('') + '</ul>';
  }
  function openSaved(id) {
    if (S.dirty && !window.confirm('Your current simulation has unsaved changes. Open another one anyway?')) return;
    api('/api/simulations/' + encodeURIComponent(id)).then(function (r) {
      if (!r.ok || !r.data || !r.data.simulation) { S.listErr = K.refused(r); render(); return; }
      S.sim = E.simulation(r.data.simulation); S.id = r.data.simulation.id; S.dirty = false; S.msg = null; S.whatIf = noWhatIf(); S.fillMsg = {}; S.view = 'lab'; render();
    });
  }
  function save() {
    if (!S.sim || S.saving) return;
    S.saving = true; render();
    var body = { simulation: S.sim };
    var req = S.id ? api('/api/simulations/' + encodeURIComponent(S.id), 'PUT', body) : api('/api/simulations', 'POST', body);
    req.then(function (r) {
      S.saving = false;
      if (r.ok && r.data && r.data.simulation) { S.id = r.data.simulation.id; S.dirty = false; S.msg = { kind: 'ok', text: 'Saved. You’ll find it under My Simulations.' }; S.list = null; }
      else S.msg = { kind: 'warn', text: K.refused(r) };
      render();
    });
  }
  function delSaved(id) {
    api('/api/simulations/' + encodeURIComponent(id), 'DELETE').then(function (r) {
      S.confirmDel = null;
      if (r.ok) { if (S.id === id) { S.id = null; S.dirty = !!S.sim; } S.list = (S.list || []).filter(function (x) { return x.id !== id; }); }
      else S.listErr = K.refused(r);
      render();
    });
  }

  // ── Account figures ────────────────────────────────────────────
  function fill(p) {
    var A = window.orvAnalytics, s = active(); if (!A || !s) return;
    S.filling[p] = true; S.fillMsg[p] = ''; render();
    var w = A.windowFor('LAST_30_DAYS');
    A.series(p, w).then(function (d) {
      S.filling[p] = false;
      var vr = d.conversionValue === 'reported', t = A.sum(d.series, vr);
      if (!t.impressions || !t.spend) { S.fillMsg[p] = NAME[p] + ' reported no delivery in the last 30 days, so there’s nothing to use. Your assumptions stay as they are.'; render(); return; }
      var c = s.channels.filter(function (x) { return x.platform === p; })[0]; if (!c) return;
      c.basis = 'cpm'; c.cpm = round2(A.value(t, 'cpm')); c.ctr = round2(A.value(t, 'ctr'));
      var notes = [];
      if (t.clicks > 0 && t.conversions > 0) c.cvr = round2(A.value(t, 'conversionRate')); else notes.push('no conversions were reported, so the conversion rate is still yours');
      if (vr && t.conversions > 0 && t.conversionValue > 0) c.value = round2(t.conversionValue / t.conversions); else notes.push(vr ? 'no conversion value was reported' : NAME[p] + ' doesn’t report a conversion value, so the value per conversion is still yours');
      c.source = { kind: 'account', label: NAME[p] + ', last 30 days', since: w.since, until: w.until };
      S.fillMsg[p] = 'Filled from ' + money(t.spend, 0) + ' of spend, ' + count(t.impressions) + ' impressions and ' + count(t.clicks) + ' clicks.' + (notes.length ? ' Note: ' + notes.join('; ') + '.' : '') + ' Past results don’t guarantee future ones.';
      touch(); render();
    }, function (e) {
      S.filling[p] = false;
      S.fillMsg[p] = e && e.kind === 'not_connected' ? NAME[p] + ' isn’t connected, so OrivenAI can’t read its figures.' : 'Your ' + NAME[p] + ' figures couldn’t be read right now. Your assumptions stay as they are.';
      render();
    });
  }

  // ── Events ─────────────────────────────────────────────────────
  function num(v) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; }
  // Typing: update the model and the results only, so the field keeps focus.
  function onInput(e) {
    var el = e.target; if (!el || !el.getAttribute) return;
    if (el.hasAttribute('data-asim-q')) { var qk = el.getAttribute('data-asim-q'); S.quick[qk] = qk === 'objective' ? el.value : num(el.value); return; }
    if (el.hasAttribute('data-asim-simname')) { S.sim.name = el.value.slice(0, 100); touch(); paintSave(); return; }
    var s = active(); if (!s) return;
    if (el.hasAttribute('data-asim-s')) {
      var k = el.getAttribute('data-asim-s'), v = num(el.value);
      if (k === 'name') { s.name = el.value.slice(0, 80) || 'Scenario'; }
      else if (k === 'objective' || k === 'uncertainty') return; // handled on change
      else if (v == null) return;
      else if (k === 'daily') { s.budget = clampBudget(v * s.days); syncField('budget', round2(s.budget)); }
      else if (k === 'days') { s.days = Math.max(1, Math.min(365, Math.round(v))); syncField('daily', round2(s.budget / s.days)); }
      else if (k === 'budget') { s.budget = clampBudget(v); syncField('daily', round2(s.budget / s.days)); }
      else s[k] = v;
      normalise(s); touch(); paintLive(); return;
    }
    if (el.hasAttribute('data-asim-c')) {
      var ck = el.getAttribute('data-asim-c'), p = el.getAttribute('data-p'), c = s.channels.filter(function (x) { return x.platform === p; })[0]; if (!c) return;
      if (ck === 'basis') return;
      var cv = num(el.value); if (cv == null) return;
      c[ck] = cv;
      if (ck !== 'share') c.source = { kind: 'manual', label: '', since: '', until: '' };
      normalise(s); touch(); paintLive();
      if (ck === 'share') paintShares(s); else paintSource(p, s);
      return;
    }
    if (el.hasAttribute('data-asim-wi')) { S.whatIf[el.getAttribute('data-asim-wi')] = num(el.value) || 1; paintWhatIf(); return; }
  }
  function onChange(e) {
    var el = e.target; if (!el || !el.getAttribute) return;
    var s = active();
    if (el.hasAttribute('data-asim-cmpm')) { S.cmpMetric = el.value; var cmp = document.getElementById('asimCompare'); if (cmp) cmp.innerHTML = compareHtml(); return; }
    if (!s) return;
    if (el.hasAttribute('data-asim-s')) {
      var k = el.getAttribute('data-asim-s');
      if (k === 'objective') { s.objective = el.value; touch(); render(); }
      else if (k === 'uncertainty') { s.uncertainty = el.value; touch(); paintLive(); }
      else { normalise(s); renderSoon(); } // a committed number: redraw with the clamped value (after the click that blurred it)
      return;
    }
    if (el.hasAttribute('data-asim-c') && el.getAttribute('data-asim-c') === 'basis') {
      var c = s.channels.filter(function (x) { return x.platform === el.getAttribute('data-p'); })[0]; if (!c) return;
      c.basis = el.value === 'cpc' ? 'cpc' : 'cpm'; touch(); render(); return;
    }
    if (el.hasAttribute('data-asim-c')) { normalise(s); renderSoon(); }
  }
  var soon = 0;
  function renderSoon() { if (soon) return; soon = setTimeout(function () { soon = 0; render(); }, 0); }
  function clampBudget(v) { return Math.min(E.LIMITS.budget[1], Math.max(E.LIMITS.budget[0], v)); }
  // Keep the stored scenario within the engine's limits (same object, same id).
  function normalise(s) {
    var n = E.scenario(s);
    ['budget', 'days', 'frequency', 'creatives'].forEach(function (k) { s[k] = n[k]; });
    s.channels.forEach(function (c, i) { var m = n.channels[i]; if (m) ['share', 'cpm', 'cpc', 'ctr', 'cvr', 'value'].forEach(function (k) { c[k] = m[k]; }); });
  }
  function syncField(k, v) { var el = document.querySelector('#' + PAGE + ' [data-asim-s="' + k + '"]'); if (el && document.activeElement !== el) el.value = v; }
  function paintSave() { var el = document.getElementById('asimSaveState'); if (el) el.innerHTML = saveState(); }
  function paintLive() {
    var s = active(); if (!s) return;
    var a = document.getElementById('asimResults'); if (a) a.innerHTML = resultsHtml(s);
    var sc = document.getElementById('asimScenarios'); if (sc) sc.innerHTML = scenarioCards();
    var cm = document.getElementById('asimCompare'); if (cm) cm.innerHTML = compareHtml();
    paintWhatIf(); paintSave();
  }
  function paintWhatIf() {
    var s = active(); if (!s) return;
    WI.forEach(function (w) { var o = document.querySelector('#' + PAGE + ' [data-asim-wiout="' + w[0] + '"]'); if (o) o.innerHTML = wiLabel(w[0], S.whatIf[w[0]], s); });
    var out = document.getElementById('asimWiOut'); if (out) out.innerHTML = whatIfOut(s);
  }
  function paintShares(s) {
    var tot = s.channels.reduce(function (a, c) { return a + c.share; }, 0);
    s.channels.forEach(function (c) { var o = document.querySelector('#' + PAGE + ' [data-asim-shareout="' + c.platform + '"]'); if (o) { var pc = tot > 0 ? Math.round(c.share / tot * 100) : 0; o.textContent = pc + '% · ' + money(s.budget * pc / 100, 0); } });
  }
  function paintSource(p, s) {
    var box = document.querySelector('#' + PAGE + ' .asim-chan[data-plat="' + p + '"] .asim-src'); if (!box) return;
    var c = s.channels.filter(function (x) { return x.platform === p; })[0];
    box.className = 'asim-src'; box.textContent = 'Your assumptions' + (c && isExample(c) ? ' · example starting values, not a benchmark' : '');
  }

  function onClick(e) {
    var b = e.target.closest('button, [data-asim-view]'); if (!b || b.disabled) return;
    var a = function (n) { return b.getAttribute(n); };
    if (b.hasAttribute('data-asim-view')) { S.view = a('data-asim-view'); if (S.view === 'list') S.list = null; render(); return; }
    if (b.hasAttribute('data-asim-new')) {
      if (S.dirty && !window.confirm('Your current simulation has unsaved changes. Start a new one anyway?')) return;
      S.sim = null; S.id = null; S.dirty = false; S.msg = null; S.whatIf = noWhatIf(); S.fillMsg = {}; S.view = 'lab'; render(); return;
    }
    if (b.hasAttribute('data-asim-qp')) { var qp = a('data-asim-qp'), i = S.quick.platforms.indexOf(qp); if (i >= 0) S.quick.platforms.splice(i, 1); else S.quick.platforms.push(qp); render(); return; }
    if (b.hasAttribute('data-asim-start')) {
      var q = S.quick; if (!q.platforms.length) return;
      var first = newScenario('Scenario A', { objective: q.objective, budget: clampBudget(q.budget || 1000), days: Math.max(1, Math.min(365, Math.round(q.days || 30))), platforms: E.PLATFORMS.filter(function (p) { return q.platforms.indexOf(p) >= 0; }) });
      S.sim = E.simulation({ name: 'Untitled simulation', scenarios: [first], activeId: first.id }); S.id = null; S.dirty = true; S.msg = null; render(); return;
    }
    if (b.hasAttribute('data-asim-retry')) { S.list = null; S.listErr = ''; render(); return; }
    if (b.hasAttribute('data-asim-open')) { openSaved(a('data-asim-open')); return; }
    if (b.hasAttribute('data-asim-askdel')) { S.confirmDel = a('data-asim-askdel'); render(); return; }
    if (b.hasAttribute('data-asim-delno')) { S.confirmDel = null; render(); return; }
    if (b.hasAttribute('data-asim-delsim')) { delSaved(a('data-asim-delsim')); return; }
    if (!S.sim) return;
    if (b.hasAttribute('data-asim-save')) { save(); return; }
    if (b.hasAttribute('data-asim-pick')) { S.sim.activeId = a('data-asim-pick'); S.whatIf = noWhatIf(); render(); return; }
    if (b.hasAttribute('data-asim-add')) { var s0 = active(); var ns = newScenario(nextLetterName(), { objective: s0.objective, budget: s0.budget, days: s0.days, platforms: s0.channels.map(function (c) { return c.platform; }) }); S.sim.scenarios.push(ns); S.sim.activeId = ns.id; touch(); render(); return; }
    if (b.hasAttribute('data-asim-dup')) { dup(a('data-asim-dup')); return; }
    if (b.hasAttribute('data-asim-del')) {
      var id = a('data-asim-del'), sc = S.sim.scenarios.filter(function (x) { return x.id === id; })[0];
      if (!sc || S.sim.scenarios.length < 2 || !window.confirm('Remove “' + sc.name + '” from this simulation?')) return;
      S.sim.scenarios = S.sim.scenarios.filter(function (x) { return x.id !== id; }); if (S.sim.activeId === id) S.sim.activeId = S.sim.scenarios[0].id; touch(); render(); return;
    }
    var s = active();
    if (b.hasAttribute('data-asim-addp')) { var p = a('data-asim-addp'); if (s.channels.length < 5 && !s.channels.some(function (c) { return c.platform === p; })) { var share = Math.round(100 / (s.channels.length + 1)); s.channels.forEach(function (c) { c.share = Math.max(1, Math.round(c.share * (100 - share) / 100)); }); s.channels.push(E.channel(Object.assign({ platform: p, share: share }, EXAMPLE))); touch(); render(); } return; }
    if (b.hasAttribute('data-asim-rmp')) { var rp = a('data-asim-rmp'); if (s.channels.length > 1) { s.channels = s.channels.filter(function (c) { return c.platform !== rp; }); touch(); render(); } return; }
    if (b.hasAttribute('data-asim-fill')) { fill(a('data-asim-fill')); return; }
    if (b.hasAttribute('data-asim-wireset')) { S.whatIf = noWhatIf(); render(); return; }
    if (b.hasAttribute('data-asim-wiapply')) { var adj = E.adjust(s, S.whatIf); copyInto(s, adj); s.channels.forEach(function (c) { c.source = { kind: 'manual', label: '', since: '', until: '' }; }); S.whatIf = noWhatIf(); touch(); render(); return; }
    if (b.hasAttribute('data-asim-wifork')) { if (S.sim.scenarios.length >= 8) return; var f = E.adjust(s, S.whatIf); f.id = uidS(); f.name = (s.name + ' (what-if)').slice(0, 80); f.channels.forEach(function (c) { c.source = { kind: 'manual', label: '', since: '', until: '' }; }); S.sim.scenarios.push(f); S.sim.activeId = f.id; S.whatIf = noWhatIf(); touch(); render(); return; }
    if (b.hasAttribute('data-asim-create')) { prepareInCreate(s, a('data-asim-create')); return; }
    if (b.hasAttribute('data-asim-ai')) { askAssistant(s); return; }
  }
  function copyInto(target, src) { ['budget', 'days', 'frequency', 'creatives', 'uncertainty', 'objective'].forEach(function (k) { target[k] = src[k]; }); target.channels = src.channels; }
  function dup(id) {
    if (S.sim.scenarios.length >= 8) return;
    var src = S.sim.scenarios.filter(function (x) { return x.id === id; })[0]; if (!src) return;
    var c = JSON.parse(JSON.stringify(src)); c.id = uidS(); c.name = (src.name + ' (copy)').slice(0, 80);
    var at = S.sim.scenarios.indexOf(src); S.sim.scenarios.splice(at + 1, 0, c); S.sim.activeId = c.id; touch(); render();
  }

  // Create: platform + goal set, the planned budget as a visible note. The
  // user reviews and publishes from Campaigns as always.
  function prepareInCreate(s, p) {
    var C = window.orvCreate;
    var goal = { sales: 'Sales', leads: 'Leads', traffic: 'Traffic', awareness: 'Awareness' }[s.objective];
    var note = 'From Ad Simulator (“' + s.name + '”): planned budget ' + money(s.budget / s.days) + ' a day for ' + s.days + ' days on ' + NAME[p] + '.';
    if (window.orvPages) window.orvPages.open('create');
    setTimeout(function () {
      if (C && typeof C.getState === 'function' && typeof C.setState === 'function') {
        var st = C.getState() || {};
        var notes = String(st.notes || '');
        if (notes.indexOf(note) < 0) notes = (notes ? notes.replace(/\s+$/, '') + '\n' : '') + note;
        C.setState({ platform: p, goal: goal, notes: notes });
        if (typeof window.orvToast === 'function') window.orvToast(NAME[p] + ' and “' + goal + '” are set in Create. The planned budget is in your notes.', 'ok');
      }
    }, 120);
  }
  function askAssistant(s) {
    if (typeof window.orvAiSend !== 'function') return;
    var r = results(s), t = r.calc.total, b = r.sim.bands;
    var lines = ['Explain this Ad Simulator scenario and what I could test. These are my assumptions, not real results.',
      'Scenario "' + s.name + '": objective ' + OBJ[s.objective] + ', budget ' + money(s.budget, 0) + ' over ' + s.days + ' days.'];
    s.channels.forEach(function (c) { lines.push('- ' + NAME[c.platform] + ': share ' + c.share + ', ' + (c.basis === 'cpc' ? 'CPC ' + money(c.cpc) : 'CPM ' + money(c.cpm)) + ', CTR ' + c.ctr + '%, conversion rate ' + c.cvr + '%, value ' + money(c.value)); });
    lines.push('Calculated: ' + count(t.clicks) + ' clicks, ' + FMT.conversions(t.conversions) + ' conversions, revenue ' + money(t.revenue, 0) + ', ROAS ' + times(t.roas) + '.');
    if (b.revenue) lines.push('Simulated revenue (10th–90th percentile): ' + money(b.revenue.p10, 0) + ' – ' + money(b.revenue.p90, 0) + '.');
    if (window.orvAiDock && window.orvAiDock.isTucked()) window.orvAiDock.show();
    if (typeof window.orvOpenAi === 'function') window.orvOpenAi();
    window.orvAiSend(lines.join('\n'));
  }

  window.orvAdSimulator = { open: open, _state: function () { return S; } };
})();
