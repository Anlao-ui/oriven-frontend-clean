// ════════════════════════════════════════════════════════════════
// Pricing page: "Create Your Own Plan" and the currency selector.
//
// Both read the ONE plan configuration in js/plans.js (ORIVEN_PERIOD_PLANS,
// ORIVEN_PRICING.featureCosts); nothing here defines a price, a credit
// allowance or a cost.
//
// Create Your Own Plan — a local estimate, no network:
//   credits a month = campaigns × campaign_generation
//                   + images    × image_generation
//                   + videos    × video_generation (5 s)
//   For each plan: the purchases needed to cover the chosen duration, and
//   whether its credits per month (per 14 days for Flex) cover the
//   estimate. The cheapest plan that covers it wins (ties: fewer purchases,
//   then the longer plan). If no plan includes that many credits per month,
//   a one-payment plan (Flex/Monthly) bought more often is suggested: each
//   purchase adds its credits right away. "Choose This Plan" is the same
//   link as the plan's own card (the server picks the price from the id).
//
// Currency selector — display only. Prices are converted from EUR with the
// ECB rates from GET /api/exchange-rates (cached by the server for 12 h and
// in this browser for 12 h; fetched only once a visitor picks a currency
// other than EUR). Checkout always charges the EUR price: only a plan id is
// ever sent, never an amount or a currency.
// ════════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  // ── Currencies (add one here: the ECB publishes rates for ~30) ──────
  // symbolAfter: written after the number ("336 kr"); space: between the
  // symbol and the number ("CHF 31").
  var ORV_CURRENCIES = [
    { code: 'EUR', name: 'Euro',              symbol: '€',   locale: 'en-IE' },
    { code: 'USD', name: 'US Dollar',         symbol: '$',   locale: 'en-US' },
    { code: 'GBP', name: 'British Pound',     symbol: '£',   locale: 'en-GB' },
    { code: 'CHF', name: 'Swiss Franc',       symbol: 'CHF', locale: 'de-CH', space: true },
    { code: 'CAD', name: 'Canadian Dollar',   symbol: 'C$',  locale: 'en-CA' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$',  locale: 'en-AU' },
    { code: 'INR', name: 'Indian Rupee',      symbol: '₹',   locale: 'en-IN' },
    { code: 'JPY', name: 'Japanese Yen',      symbol: '¥',   locale: 'ja-JP' },
    { code: 'SEK', name: 'Swedish Krona',     symbol: 'kr',  locale: 'sv-SE', symbolAfter: true },
    { code: 'NOK', name: 'Norwegian Krone',   symbol: 'kr',  locale: 'nb-NO', symbolAfter: true },
    { code: 'DKK', name: 'Danish Krone',      symbol: 'kr',  locale: 'da-DK', symbolAfter: true },
    { code: 'PLN', name: 'Polish Zloty',      symbol: 'zł',  locale: 'pl-PL', symbolAfter: true }
  ];
  var FX_CACHE_KEY = 'orv_fx_rates_v1';
  var FX_CHOICE_KEY = 'orv_display_currency';
  var FX_TTL_MS = 12 * 60 * 60 * 1000;

  function currency(code) {
    for (var i = 0; i < ORV_CURRENCIES.length; i++) if (ORV_CURRENCIES[i].code === code) return ORV_CURRENCIES[i];
    return null;
  }

  // The plan cards' own EUR format ("€29", "€23.83"): EUR is never converted.
  function formatEur(n) { return '€' + (Math.round(n) === n ? String(n) : n.toFixed(2)); }

  // An approximate amount in another currency, whole units, "≈ $33".
  function formatApprox(eur, code, rates) {
    var c = currency(code);
    if (!c || code === 'EUR' || !rates || !(rates[code] > 0)) return formatEur(eur);
    var amount = Math.round(eur * rates[code]);
    var num;
    try { num = new Intl.NumberFormat(c.locale, { maximumFractionDigits: 0 }).format(amount); }
    catch (_) { num = String(amount); }
    var s = c.symbolAfter ? num + ' ' + c.symbol : c.symbol + (c.space ? ' ' : '') + num;
    return '≈ ' + s;
  }

  // ── Recommendation (pure; also loaded by the tests in Node) ─────────
  var DAYS_PER_MONTH = 30;
  var ORV_PLANNER_SLIDERS = [
    { key: 'campaigns', label: 'Campaigns', question: 'How many campaigns do you plan to create?',
      values: [1, 2, 3, 5, 8, 12, 20], start: 2, min: 'Very few', max: 'Many campaigns',
      text: function (v) { return v + (v === 1 ? ' campaign' : ' campaigns') + ' a month'; } },
    { key: 'images', label: 'Image Generation', question: 'How often will you generate images?',
      values: [2, 5, 10, 15, 25, 40], start: 2, min: 'Occasionally', max: 'Very frequently',
      text: function (v) { return v + ' images a month'; } },
    { key: 'videos', label: 'Video Generation', question: 'How often will you generate videos?',
      values: [1, 2, 3, 5, 8, 12], start: 1, min: 'Occasionally', max: 'Very frequently',
      text: function (v) { return v + (v === 1 ? ' video' : ' videos') + ' a month'; } },
    // The first stop matches Flex (14 days), so every plan can be the answer.
    { key: 'days', label: 'Subscription Duration', question: 'How long do you plan to use OrivenAI?',
      values: [14, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360], start: 3, min: '2 weeks', max: '12 months',
      text: function (v) { return v === 14 ? '2 weeks' : (v === 30 ? '1 month' : (v / DAYS_PER_MONTH) + ' months'); } }
  ];

  function planDays(p) { return p.days || p.months * DAYS_PER_MONTH; }

  // sel: { campaigns, images, videos } a month, days: the duration.
  function recommendPlan(sel, plans, costs) {
    var monthly = sel.campaigns * costs.campaign_generation + sel.images * costs.image_generation + sel.videos * costs.video_generation;
    var needPerDay = monthly / DAYS_PER_MONTH;
    var days = sel.days;
    var options = plans.map(function (p) {
      var len = planDays(p);
      var perDay = (p.credits / p.instalments) / (len / p.instalments);   // credits arrive per instalment
      var purchases = Math.max(1, Math.ceil(days / len - 1e-9));
      return { plan: p, days: len, perDay: perDay, perMonth: Math.round(perDay * DAYS_PER_MONTH), purchases: purchases, cost: purchases * p.price, covers: needPerDay <= perDay + 1e-9 };
    });
    function cheapest(list) {
      return list.slice().sort(function (a, b) { return (a.cost - b.cost) || (a.purchases - b.purchases) || (b.days - a.days); })[0] || null;
    }
    var best = cheapest(options.filter(function (o) { return o.covers; }));
    var covered = true;
    if (!best) {
      // No plan includes this many credits per month. A one-payment plan can
      // be bought again early: each purchase adds its credits at once.
      covered = false;
      var total = needPerDay * days;
      best = cheapest(options.filter(function (o) { return o.plan.instalments === 1; }).map(function (o) {
        var n = Math.max(o.purchases, Math.ceil(total / o.plan.credits - 1e-9));
        return Object.assign({}, o, { purchases: n, cost: n * o.plan.price });
      }));
    }
    // A cheaper plan that was passed over because its credits fall short.
    var cheaperShort = covered ? cheapest(options.filter(function (o) { return !o.covers && o.cost < best.cost; })) : null;
    return { plan: best.plan, purchases: best.purchases, cost: best.cost, perMonth: best.perMonth, monthly: monthly, days: days, covered: covered, cheaperShort: cheaperShort };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { recommendPlan: recommendPlan, formatApprox: formatApprox, formatEur: formatEur, ORV_CURRENCIES: ORV_CURRENCIES, ORV_PLANNER_SLIDERS: ORV_PLANNER_SLIDERS, FX_TTL_MS: FX_TTL_MS };
    return;
  }
  if (!root.document) return;

  // ── Browser ─────────────────────────────────────────────────────────
  var doc = root.document;
  var state = { currency: 'EUR', rates: null, ratesDate: null };

  function store(key, val) { try { if (val == null) root.localStorage.removeItem(key); else root.localStorage.setItem(key, JSON.stringify(val)); } catch (_) {} }
  function load(key) { try { return JSON.parse(root.localStorage.getItem(key) || 'null'); } catch (_) { return null; } }
  function fmtCredits(n) { return typeof orvFormatCredits === 'function' ? orvFormatCredits(n) : String(n); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Rates: this browser's copy (12 h), else one request to the backend.
  var _ratesPromise = null;
  function getRates() {
    var cached = load(FX_CACHE_KEY);
    if (cached && cached.rates && Date.now() - (cached.at || 0) < FX_TTL_MS) return Promise.resolve(cached);
    if (_ratesPromise) return _ratesPromise;
    if (typeof API_BASE_URL === 'undefined' || typeof fetch !== 'function') return Promise.reject(new Error('no API'));
    _ratesPromise = fetch(API_BASE_URL + '/api/exchange-rates', { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || j.base !== 'EUR' || !j.rates) throw new Error('bad rates');
        var v = { at: Date.now(), date: j.date, rates: j.rates };
        store(FX_CACHE_KEY, v);
        return v;
      })
      .finally(function () { _ratesPromise = null; });
    return _ratesPromise;
  }

  // Rewrite every [data-eur] amount on the pricing page.
  function applyCurrency(scope) {
    var els = (scope || doc).querySelectorAll('[data-eur]');
    for (var i = 0; i < els.length; i++) {
      var eur = Number(els[i].getAttribute('data-eur'));
      if (!isFinite(eur)) continue;
      var text = state.currency === 'EUR' ? formatEur(eur) : formatApprox(eur, state.currency, state.rates);
      // Small inline amounts (a card's "per month" line) skip the "≈ " so the
      // line keeps its width; the price above and the note mark it as an estimate.
      if (els[i].closest && els[i].closest('.ov-pc-sub')) text = text.replace(/^≈ /, '');
      els[i].textContent = text;
    }
    var note = doc.getElementById('orvCurNote');
    if (note) {
      note.textContent = 'Prices in other currencies are estimates. All payments are processed in EUR.'
        + (state.currency !== 'EUR' && state.ratesDate ? ' Rates: European Central Bank, ' + state.ratesDate + '.' : '');
    }
  }

  function setCurrency(code, select) {
    var msg = doc.getElementById('orvCurMsg');
    if (msg) msg.textContent = '';
    if (code === 'EUR' || !currency(code)) {
      state.currency = 'EUR';
      store(FX_CHOICE_KEY, null);
      if (select) select.value = 'EUR';
      applyCurrency();
      return;
    }
    getRates().then(function (r) {
      if (!(r.rates[code] > 0)) throw new Error('no rate for ' + code);
      state.currency = code; state.rates = r.rates; state.ratesDate = r.date;
      store(FX_CHOICE_KEY, code);
      applyCurrency();
    }).catch(function () {
      // EUR always works: fall back to it and say why.
      state.currency = 'EUR';
      store(FX_CHOICE_KEY, null);
      if (select) select.value = 'EUR';
      if (msg) msg.textContent = 'Exchange rates are unavailable right now, so prices are shown in EUR.';
      applyCurrency();
    });
  }

  function mountCurrency() {
    var box = doc.getElementById('orvCurrency');
    if (!box) return;
    box.innerHTML =
      '<label class="orv-cur-label" for="orvCurSelect">Currency</label>' +
      '<span class="orv-cur-select-wrap"><select id="orvCurSelect" class="orv-cur-select">' +
      ORV_CURRENCIES.map(function (c) { return '<option value="' + c.code + '">' + c.code + ' – ' + esc(c.name) + ' (' + esc(c.symbol) + ')</option>'; }).join('') +
      '</select></span>' +
      '<p class="orv-cur-note" id="orvCurNote">Prices in other currencies are estimates. All payments are processed in EUR.</p>' +
      '<p class="orv-cur-msg" id="orvCurMsg" role="status" aria-live="polite"></p>';
    var select = doc.getElementById('orvCurSelect');
    select.addEventListener('change', function () { setCurrency(select.value, select); });
    var saved = load(FX_CHOICE_KEY);
    if (saved && saved !== 'EUR' && currency(saved)) { select.value = saved; setCurrency(saved, select); }
  }

  // ── Create Your Own Plan ────────────────────────────────────────────
  function sliderFill(input) {
    var pct = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
    input.style.setProperty('--orv-pp-fill', pct + '%');
  }

  function mountPlanner() {
    var box = doc.getElementById('orvPlanner');
    if (!box || typeof ORIVEN_PERIOD_PLANS === 'undefined' || typeof ORIVEN_PRICING === 'undefined') return;
    var sel = {};
    box.innerHTML =
      '<div class="orv-pp-sliders">' + ORV_PLANNER_SLIDERS.map(function (s) {
        var id = 'orvPp-' + s.key;
        return '<div class="orv-pp-field">' +
          '<div class="orv-pp-field-head"><label class="orv-pp-label" for="' + id + '">' + esc(s.label) + '<span class="orv-pp-question">' + esc(s.question) + '</span></label>' +
          '<output class="orv-pp-value" id="' + id + '-out" for="' + id + '"></output></div>' +
          '<input type="range" class="orv-pp-range" id="' + id + '" data-key="' + s.key + '" min="0" max="' + (s.values.length - 1) + '" step="1" value="' + s.start + '">' +
          '<div class="orv-pp-ends" aria-hidden="true"><span>' + esc(s.min) + '</span><span>' + esc(s.max) + '</span></div>' +
        '</div>';
      }).join('') + '</div>' +
      '<div class="orv-pp-result" id="orvPpResult" aria-live="polite"></div>';

    function update() {
      ORV_PLANNER_SLIDERS.forEach(function (s) {
        var input = doc.getElementById('orvPp-' + s.key);
        var v = s.values[Number(input.value)];
        sel[s.key] = v;
        var t = s.text(v);
        doc.getElementById('orvPp-' + s.key + '-out').textContent = t;
        input.setAttribute('aria-valuetext', t);
        sliderFill(input);
      });
      renderResult(recommendPlan(sel, ORIVEN_PERIOD_PLANS, ORIVEN_PRICING.featureCosts));
    }

    function renderResult(r) {
      var p = r.plan, fc = ORIVEN_PRICING.featureCosts;
      var period = p.periodLabel;
      var durationText = ORV_PLANNER_SLIDERS[3].text(r.days);
      var credits = fmtCredits(p.credits) + ' credits' + (p.instalments > 1 ? ' · ' + fmtCredits(p.creditsPerInstalment) + ' a month' : '');
      var why;
      if (!r.covered) {
        why = 'No single plan includes ' + fmtCredits(r.monthly) + ' credits a month. Buying ' + p.name + ' again before it runs out adds its ' + fmtCredits(p.credits) + ' credits right away and extends your access, so ' + r.purchases + ' purchases cover your ' + durationText + '.';
      } else if (r.purchases > 1) {
        why = p.name + ' bought ' + r.purchases + ' times covers your ' + durationText + ' with enough credits, at the lowest total cost.';
      } else if (p.days) {
        why = p.name + ' includes ' + fmtCredits(p.credits) + ' credits for ' + p.days + ' days, enough for your estimate (about ' + fmtCredits(Math.round(r.monthly * p.days / DAYS_PER_MONTH)) + '), at the lowest cost.';
      } else {
        why = p.name + ' adds ' + fmtCredits(r.perMonth) + ' credits a month, enough for your estimate, at the lowest cost for ' + durationText + '.';
      }
      if (r.cheaperShort) why += ' ' + r.cheaperShort.plan.name + ' would cost less, but its credits (about ' + fmtCredits(r.cheaperShort.perMonth) + ' a month) fall short.';
      var use = Math.min(100, Math.round(r.monthly / Math.max(1, r.perMonth) * 100));
      var breakdown = sel.campaigns + ' × ' + fc.campaign_generation + ' (campaign drafts) + ' + sel.images + ' × ' + fc.image_generation + ' (images) + ' + sel.videos + ' × ' + fc.video_generation + ' (5-second videos)';
      var box = doc.getElementById('orvPpResult');
      box.innerHTML =
        '<p class="orv-pp-eyebrow">Your recommended plan</p>' +
        '<h3 class="orv-pp-plan">' + esc(p.name) + '</h3>' +
        '<p class="orv-pp-price"><span data-eur="' + p.price + '">' + formatEur(p.price) + '</span><span class="orv-pp-per"> / ' + esc(period) + '</span></p>' +
        (r.purchases > 1 ? '<p class="orv-pp-times">' + r.purchases + ' purchases · <span data-eur="' + r.cost + '">' + formatEur(r.cost) + '</span> in total</p>' : '') +
        '<p class="orv-pp-credits">' + credits + '</p>' +
        '<div class="orv-pp-meter" role="img" aria-label="Estimated use: ' + fmtCredits(r.monthly) + ' credits a month">' +
          '<div class="orv-pp-meter-head"><span>Estimated use</span><span>' + fmtCredits(r.monthly) + ' credits a month</span></div>' +
          '<div class="orv-pp-meter-bar' + (r.covered ? '' : ' is-over') + '"><span style="width:' + use + '%"></span></div>' +
          '<p class="orv-pp-breakdown">' + esc(breakdown) + '</p>' +
        '</div>' +
        '<p class="orv-pp-why">' + esc(why) + '</p>' +
        '<a class="orv-pp-cta" href="/app?plan=' + p.id + '" data-plan="' + p.id + '">Choose This Plan</a>' +
        '<p class="orv-pp-fine">An estimate from OrivenAI\'s credit costs. Research, Oriven Chat and other AI features also use credits. Price includes VAT.</p>';
      box.querySelector('.orv-pp-cta').addEventListener('click', function (e) {
        // The same path as the plan's own card: remember the id, then sign up.
        if (typeof orvRememberPlanChoice === 'function') orvRememberPlanChoice(p.id);
        if (typeof lpGetStarted === 'function') lpGetStarted(e);
      });
      applyCurrency(box);
    }

    box.addEventListener('input', function (e) { if (e.target && e.target.classList.contains('orv-pp-range')) update(); });
    update();
  }

  function init() {
    mountCurrency();
    mountPlanner();
    // The plan cards are (re)drawn by renderLPPricingCards: keep their prices
    // in the chosen currency whenever that happens.
    var grid = doc.getElementById('lpPricingGrid');
    if (grid && typeof MutationObserver === 'function') new MutationObserver(function () { if (state.currency !== 'EUR') applyCurrency(grid); }).observe(grid, { childList: true });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();

  root.orvPricingPlanner = { setCurrency: setCurrency, recommendPlan: recommendPlan, state: state };
})(typeof window !== 'undefined' ? window : this);
