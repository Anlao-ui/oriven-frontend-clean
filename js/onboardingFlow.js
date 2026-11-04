/* ════════════════════════════════════════════════════════════════
   OrivenAI guided onboarding: the first run of a new account.

     Welcome → 7 topics, one question per screen (Business, Audience, Offer,
     Goals, Current marketing, Budget & capacity, Assistant; two editorial
     quotes between them) → Analysis → Strategy ready (only once the server
     says so) → Plans (mandatory) → payment → Strategy unlocked → Control
     Center → Planning. The screen order is FLOW below; Back, Continue and
     the progress bar all follow it.

   The server decides everything that matters (services/onboardingFlow.js):
   who sees this (GET /api/onboarding/state → flow.enabled), what was saved
   (GET/PUT /api/onboarding/session, autosaved), the website reading (POST
   /api/onboarding/website), the one plan generation (POST /api/onboarding/
   plan) and whether the plan may be shown (GET /api/onboarding/plan, paid
   access checked on every request). Nothing in this file, the page or the
   browser's storage ever holds the plan before payment; the plan screen
   only renders what that endpoint returns.

   Payment is the existing checkout (auth.js selectPlan → Stripe); the plans
   are plans.js ORIVEN_PERIOD_PLANS. The assistants are the six from the
   public site, drawn by js/landing-creatures.js in the shared dot-field
   loop (js/dot-field.js): one creature canvas and one dot field at most.
   Opened by js/onboarding.js (orvOnboardingGate) for eligible accounts.
   ════════════════════════════════════════════════════════════════ */
(function () {
  if (window.orvOnboardingFlow) return;

  // ── Content ─────────────────────────────────────────────────────
  // The assistants exactly as introduced on the public site (index.html #agents).
  var ASSISTANTS = [
    { id: 'scout', name: 'Scout', role: 'Research & Insights', color: '#7CF0CC', rgb: [124, 240, 204], tone: 'Curious, thorough and evidence-first.',
      story: 'Scout spent years as a field researcher, interviewing shop owners and checking every claim against what customers actually did. The habit stayed. Scout asks what the evidence says before forming an opinion, keeps what is proven apart from what is a hunch, and tells you how sure it is.',
      strengths: ['Market, competitor, audience and opportunity research', 'Separating what is established from ideas to test', 'Turning findings into a clear next step'] },
    { id: 'vector', name: 'Vector', role: 'Strategy & Direction', color: '#A8C0FF', rgb: [168, 192, 255], tone: 'Calm, structured and decisive.',
      story: 'Vector once planned routes for a delivery fleet, where every wrong turn cost real money. Now it starts from your goal, lays out the options and ties every choice back to the result you want, so each budget decision is one you can defend.',
      strengths: ['Turning goals into clear priorities', 'Choosing channels and budgets you can defend', 'Keeping your brand and audience behind every decision'] },
    { id: 'nova', name: 'Nova', role: 'Creative & Content', color: '#FF6FA8', rgb: [255, 111, 168], tone: 'Imaginative, expressive and energetic.',
      story: 'Nova ran a small design studio and kept a wall of rejected sketches as proof that the third idea is often the best. It explores several directions quickly, then commits to one and polishes it in your brand voice.',
      strengths: ['Ad concepts, headlines and copy in your brand voice', 'Image and video ads from a short brief', 'Variations for each platform’s formats'] },
    { id: 'momentum', name: 'Momentum', role: 'Growth & Execution', color: '#FF8A3D', rgb: [255, 138, 61], tone: 'Practical, motivating and to the point.',
      story: 'Momentum used to run product launches where the deadline never moved. It keeps a short list of what comes next and what is blocking it, clears the small things first, and keeps your campaigns moving week after week.',
      strengths: ['Turning plans into the next concrete step', 'Checking launch readiness and clearing blockers', 'Keeping campaigns moving week to week'] },
    { id: 'metric', name: 'Metric', role: 'Performance & Optimisation', color: '#2FB0E8', rgb: [47, 176, 232], tone: 'Precise, direct and evidence-oriented.',
      story: 'Metric was the analyst who had read the spreadsheet before the meeting started. It looks at the numbers before the opinions, shows the data behind every conclusion and says plainly when there is not enough data yet.',
      strengths: ['Reading spend, clicks, CTR, CPA and ROAS', 'Comparing campaigns and platforms side by side', 'Spotting what needs your attention'] },
    { id: 'flux', name: 'Flux', role: 'Automation & Systems', color: '#8F5CFF', rgb: [143, 92, 255], tone: 'Systematic, efficient and calm under load.',
      story: 'Flux kept a production line running through night shifts by writing down every rule that worked. It likes repeatable work to run itself, with clear limits, a record of what happened and no surprises.',
      strengths: ['Schedules and rules for published campaigns', 'Rules that notify you, ask first or act within your limits', 'Spotting repetitive work worth automating'] },
  ];
  function assistant(id) { for (var i = 0; i < ASSISTANTS.length; i++) if (ASSISTANTS[i].id === id) return ASSISTANTS[i]; return null; }

  var INDUSTRIES = ['Agency & marketing services', 'Automotive', 'Beauty & personal care', 'Construction & trades', 'Consulting & professional services',
    'Education & coaching', 'Events & entertainment', 'Fashion & apparel', 'Finance & insurance', 'Fitness & wellness', 'Food & drink',
    'Healthcare', 'Home & garden', 'Hospitality & travel', 'Legal', 'Manufacturing', 'Non-profit', 'Pets', 'Real estate',
    'Restaurants & cafés', 'Retail & e-commerce', 'Software & SaaS', 'Technology & IT services', 'Other'];

  // Values match services/onboardingFlow.js CHOICES.
  var OPT = {
    audienceType: [['b2c', 'Consumers', 'B2C'], ['b2b', 'Businesses', 'B2B'], ['both', 'Both', 'B2C and B2B']],
    location: [['local', 'Local'], ['regional', 'Regional'], ['national', 'National'], ['international', 'International']],
    price: [['budget', 'Budget'], ['mid', 'Mid-range'], ['premium', 'Premium'], ['varies', 'Varies']],
    goal: [['leads', 'Generate more leads'], ['sales', 'Increase sales'], ['awareness', 'Increase brand awareness'], ['traffic', 'Drive more website traffic'],
      ['retention', 'Retain existing customers'], ['launch', 'Launch a new product or business'], ['presence', 'Build a stronger online presence']],
    channel: [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['linkedin', 'LinkedIn'], ['youtube', 'YouTube'], ['google_ads', 'Google Ads'],
      ['seo', 'SEO'], ['email', 'Email marketing'], ['content', 'Content marketing'], ['other', 'Other'], ['none', 'None yet']],
    challenge: [['leads', 'Not enough leads'], ['sales', 'Not enough sales'], ['visibility', 'Not enough visibility'], ['inconsistent', 'Inconsistent content'],
      ['what_to_post', 'Not knowing what to post'], ['ad_costs', 'Advertising costs too much'], ['time', 'Not enough time'], ['no_strategy', 'No clear marketing strategy'], ['other', 'Other']],
    paidAds: [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']],
    budget: [['none', 'No fixed budget yet'], ['lt250', 'Under €250'], ['250_500', '€250–€500'], ['500_1000', '€500–€1,000'], ['1000_2500', '€1,000–€2,500'], ['2500_5000', '€2,500–€5,000'], ['gt5000', 'More than €5,000']],
    time: [['lt2', 'Less than 2 hours'], ['2_5', '2–5 hours'], ['5_10', '5–10 hours'], ['gt10', 'More than 10 hours'], ['team', 'I have a team handling marketing']],
    team: [['me', 'Just me'], ['team', 'Small internal team'], ['agency', 'External agency'], ['freelancers', 'Freelancers'], ['combination', 'Combination']],
  };
  var SUCCESS_EXAMPLES = {
    leads: ['20 qualified leads a month', 'A full calendar of sales calls', 'A steady flow of enquiries'],
    sales: ['50 online orders a month', '20% more monthly revenue', 'More repeat purchases'],
    awareness: ['People in my area know my brand', '1,000 new followers', 'Being recognised in my niche'],
    traffic: ['Twice the website visitors', 'A steady flow of search traffic', 'More visits from social media'],
    retention: ['More customers who come back', 'A growing email list', 'Fewer customers who leave'],
    launch: ['A successful launch week', 'The first 100 customers', 'A waiting list before launch'],
    presence: ['Posting consistently every week', 'A profile that looks professional', 'A clear brand online'],
  };

  // Screens, in order. t: the topic (0–6) a question screen belongs to; the
  // progress bar shows the 7 topics and how far into the current one you are.
  // The first screen of each topic keeps the topic's id (older saved steps
  // resume there). Step ids are validated by the server
  // (services/onboardingFlow.js STEPS).
  var TOPICS = ['Your business', 'Your audience', 'Your offer', 'Your goals', 'Your marketing today', 'Budget & capacity', 'Your assistant'];
  var FLOW = [
    { id: 'welcome' },
    { id: 'business', t: 0 }, { id: 'business-industry', t: 0 }, { id: 'business-offer', t: 0 }, { id: 'business-area', t: 0 }, { id: 'business-online', t: 0 },
    { id: 'quote1' },
    { id: 'audience', t: 1 }, { id: 'audience-ideal', t: 1 }, { id: 'audience-problem', t: 1 },
    { id: 'offer', t: 2 }, { id: 'offer-different', t: 2 }, { id: 'offer-price', t: 2 },
    { id: 'goals', t: 3 }, { id: 'goals-success', t: 3 },
    { id: 'marketing', t: 4 }, { id: 'marketing-challenge', t: 4 }, { id: 'marketing-paid', t: 4 },
    { id: 'budget', t: 5 }, { id: 'budget-capacity', t: 5 },
    { id: 'quote2' },
    { id: 'assistant', t: 6 },
    { id: 'paywall' }, { id: 'done' },
  ];
  var STEPS = FLOW.map(function (f) { return f.id; });
  function flowAt(id) { for (var i = 0; i < FLOW.length; i++) if (FLOW[i].id === id) return i; return -1; }
  function prevOf(id) { var i = flowAt(id); return i > 0 ? FLOW[i - 1].id : null; }
  function nextOf(id) { var i = flowAt(id); return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1].id : null; }
  var FIELD_STEPS = { welcome: 1, assistant: 1 }; // the only screens with the dot field

  // ── State ───────────────────────────────────────────────────────
  var S = { open: false, step: 'welcome', session: null, answers: {}, assistant: null, preview: null, compare: false, suggested: [],
    saveTimer: 0, dirty: {}, pollTimer: 0, payPoll: 0, field: null, creature: null, el: null, returning: false };
  var returningFromCheckout = (function () { try { var q = new URLSearchParams(location.search); return q.get('success') === 'true' || !!q.get('session_id'); } catch (_) { return false; } })();
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || S.el).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || S.el).querySelectorAll(sel)); }
  function sec(name) { return S.answers[name] || (S.answers[name] = {}); }
  function track(name, props) { if (typeof trackEvent === 'function') trackEvent(name, null, props); }
  function api(path, method, body) {
    return apiFetch(path, method ? { method: method, body: body ? JSON.stringify(body) : undefined } : undefined)
      .then(function (r) { return r || { ok: false, status: 0, data: null }; })
      .catch(function () { return { ok: false, status: 0, data: { error: 'We couldn’t reach OrivenAI. Check your connection and try again.' } }; });
  }

  // ── Autosave ────────────────────────────────────────────────────
  // Changed sections are sent after a short pause and on every step change.
  function markDirty(section) { S.dirty[section] = true; clearTimeout(S.saveTimer); S.saveTimer = setTimeout(flush, 700); setSaveState('pending'); }
  function flush(extra) {
    clearTimeout(S.saveTimer);
    var body = extra || {};
    var keys = Object.keys(S.dirty);
    if (keys.length) {
      body.answers = {};
      keys.forEach(function (k) { body.answers[k] = S.answers[k]; });
      body.answers.suggested = S.suggested;
      S.dirty = {};
    }
    if (!Object.keys(body).length) return Promise.resolve(true);
    setSaveState('saving');
    return api('/api/onboarding/session', 'PUT', body).then(function (r) {
      if (r.ok && r.data && r.data.session) { S.session = r.data.session; setSaveState('saved'); return true; }
      if (body.answers) Object.keys(body.answers).forEach(function (k) { if (k !== 'suggested') S.dirty[k] = true; }); // retried with the next save
      setSaveState('error');
      return false;
    });
  }
  function setSaveState(st) {
    var n = S.el && $('.onx-save');
    if (!n) return;
    n.setAttribute('data-state', st);
    n.textContent = st === 'saving' ? 'Saving…' : st === 'saved' ? 'Saved' : st === 'error' ? 'Not saved yet — we’ll retry' : '';
  }

  // ── Shell ───────────────────────────────────────────────────────
  function mount() {
    if (S.el) return;
    var root = document.createElement('div');
    root.id = 'onx';
    root.className = 'onx';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'onxTitle');
    root.innerHTML =
      '<div class="onx-field" aria-hidden="true"><canvas class="onx-field__c"></canvas></div>' +
      '<header class="onx-top">' +
        '<span class="onx-brand"><img src="assets/orivenlogo-192.png" alt="" width="28" height="28"><span>OrivenAI</span></span>' +
        '<div class="onx-progress" aria-hidden="true"></div>' +
        '<span class="onx-save" aria-live="polite"></span>' +
      '</header>' +
      '<main class="onx-main" tabindex="-1"></main>';
    document.body.appendChild(root);
    document.documentElement.classList.add('onx-lock');
    S.el = root;
    root.addEventListener('keydown', onKey);
    startField();
  }

  // One dot field for the whole flow; shown only where it belongs. Hidden,
  // its canvas is off-screen to the shared loop and draws nothing.
  function startField() {
    var D = window.IkDotField, c = $('.onx-field__c');
    if (!D || !c || !c.getContext) return;
    S.field = D.add(new D.Field(c, { tint: D.VOLT, amp: 0.55, focus: function (fl) {
      var t = S.el && S.el.getAttribute('data-step') === 'assistant' ? 0.42 : 0.38;
      return { x: fl.w * 0.5, y: fl.h * t, r: Math.min(fl.w, 900) * 0.45 }; // centred, like the content
    } }));
  }

  function progress() {
    var bar = $('.onx-progress'), i = flowAt(S.step), f = FLOW[i] || {};
    if (!bar) return;
    // Quotes sit between topics: shown as the topic just finished.
    var t = f.t != null ? f.t : S.step === 'quote1' ? 0 : S.step === 'quote2' ? 5 : -1;
    if (t < 0) { bar.innerHTML = ''; return; }
    var inTopic = FLOW.filter(function (x) { return x.t === t; }), pos = f.t != null ? inTopic.indexOf(f) + 1 : inTopic.length;
    bar.innerHTML = TOPICS.map(function (_, k) {
      var fill = k < t ? 1 : k > t ? 0 : pos / inTopic.length;
      return '<i class="' + (k < t ? 'is-done' : k === t ? 'is-now' : '') + '" style="--f:' + fill.toFixed(3) + '"></i>';
    }).join('') + '<b>Step ' + (t + 1) + ' of ' + TOPICS.length + '<span> · ' + esc(TOPICS[t]) + '</span></b>';
  }

  function go(step, opts) {
    if (step === 'analyzing' || step === 'ready') step = 'paywall'; // older saved steps: no plan is written before payment
    if (STEPS.indexOf(step) < 0) step = 'welcome';
    // The plans come after every answer and the assistant; "done" only after
    // the server confirmed the payment (unlocked()).
    if (step === 'paywall' && !readyToBuy()) step = 'assistant';
    stopPolls();
    S.step = step;
    S.el.setAttribute('data-step', step);
    S.el.classList.toggle('has-field', !!FIELD_STEPS[step]);
    if (S.field) { S.field.layout(); window.IkDotField.tick(); }
    progress();
    var main = $('.onx-main');
    main.className = 'onx-main onx-s-' + step;
    main.innerHTML = (VIEWS[step] || VIEWS.welcome)();
    bind(step);
    if (!(opts && opts.noSave)) flush({ step: step });
    if (!reduce.matches) { main.classList.remove('is-in'); void main.offsetWidth; main.classList.add('is-in'); }
    var focusEl = $('[data-autofocus]', main) || $('h1', main);
    if (focusEl) { if (focusEl.tagName === 'H1') focusEl.setAttribute('tabindex', '-1'); setTimeout(function () { try { focusEl.focus({ preventScroll: true }); } catch (_) {} }, 30); }
    main.scrollTop = 0; S.el.scrollTop = 0;
  }

  function nav(back, next, opts) {
    var o = opts || {};
    return '<div class="onx-nav">' +
      (back ? '<button type="button" class="onx-btn onx-btn--ghost" data-go="' + back + '">Back</button>' : '<span></span>') +
      '<button type="button" class="onx-btn onx-btn--primary" data-next="' + next + '"' + (o.disabled ? ' disabled' : '') + '>' + esc(o.label || 'Continue') + '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>' +
    '</div>';
  }
  function head(kicker, title, lede) {
    return '<p class="onx-kicker">' + esc(kicker) + '</p><h1 id="onxTitle" class="onx-h1">' + esc(title) + '</h1>' + (lede ? '<p class="onx-lede">' + esc(lede) + '</p>' : '');
  }
  // One question screen: the topic, an optional topic intro (first screen of
  // a topic), the question as the heading, its controls, Back/Continue.
  function ask(o) {
    var f = FLOW[flowAt(S.step)] || {};
    return '<section class="onx-form onx-ask' + (o.wide ? ' onx-form--wide' : '') + '">' +
      '<p class="onx-kicker">' + esc(TOPICS[f.t] || '') + '</p>' +
      (o.intro ? '<p class="onx-intro">' + esc(o.intro) + '</p>' : '') +
      '<h1 id="onxTitle" class="onx-h1">' + esc(o.title) + '</h1>' +
      (o.lede ? '<p class="onx-lede">' + esc(o.lede) + '</p>' : '') +
      '<div class="onx-ask__body">' + o.body + '</div>' +
      nav(prevOf(S.step), nextOf(S.step), o.nav) + '</section>';
  }
  // A control whose label is the screen's heading (screen readers get the
  // question from aria-labelledby; no second visible label).
  function bare(id, inner, hint) {
    return '<div class="onx-q" data-q="' + id + '">' + inner + (hint ? '<p class="onx-hint" id="onx-' + id + '-hint">' + esc(hint) + '</p>' : '') +
      '<p class="onx-err" id="onx-' + id + '-err" role="alert"></p></div>';
  }
  function field(id, label, inner, hint, opt) {
    return '<div class="onx-q" data-q="' + id + '">' +
      '<label class="onx-label" for="onx-' + id + '">' + esc(label) + (opt ? ' <span class="onx-opt">Optional</span>' : '') + '</label>' +
      (hint ? '<p class="onx-hint" id="onx-' + id + '-hint">' + esc(hint) + '</p>' : '') + inner +
      '<p class="onx-err" id="onx-' + id + '-err" role="alert"></p></div>';
  }
  function text(id, section, key, ph, max, area, labelled) {
    var v = esc(sec(section)[key] || '');
    var a = ' id="onx-' + id + '" data-sec="' + section + '" data-key="' + key + '" maxlength="' + max + '" placeholder="' + esc(ph) + '" aria-describedby="onx-' + id + '-err"' + (labelled ? ' aria-labelledby="onxTitle"' : '');
    return area ? '<textarea class="onx-input onx-input--area" rows="3"' + a + '>' + v + '</textarea>' : '<input class="onx-input" type="text" autocomplete="off"' + a + ' value="' + v + '">';
  }
  // A single choice: buttons in a radiogroup (arrow keys move, Space/Enter choose).
  function choice(id, label, section, key, opts, variant, hint, optional) {
    var cur = sec(section)[key] || '';
    return '<fieldset class="onx-q" data-q="' + id + '"><legend class="onx-label" id="onx-' + id + '-l">' + esc(label) + (optional ? ' <span class="onx-opt">Optional</span>' : '') + '</legend>' +
      (hint ? '<p class="onx-hint">' + esc(hint) + '</p>' : '') +
      '<div class="onx-choices onx-choices--' + (variant || 'chips') + '" role="radiogroup" aria-labelledby="onx-' + id + '-l" aria-describedby="onx-' + id + '-err" data-sec="' + section + '" data-key="' + key + '"' + (optional ? ' data-optional="1"' : '') + '>' +
      opts.map(function (o, k) {
        var on = cur === o[0];
        return '<button type="button" role="radio" class="onx-choice" data-v="' + o[0] + '" aria-checked="' + on + '" tabindex="' + (on || (!cur && k === 0) ? 0 : -1) + '">' +
          '<span class="onx-choice__t">' + esc(o[1]) + '</span>' + (o[2] ? '<span class="onx-choice__s">' + esc(o[2]) + '</span>' : '') + '</button>';
      }).join('') + '</div><p class="onx-err" id="onx-' + id + '-err" role="alert"></p></fieldset>';
  }
  function multi(id, label, section, key, opts, hint, limitTo) {
    var cur = sec(section)[key] || [];
    var list = limitTo ? opts.filter(function (o) { return limitTo.indexOf(o[0]) >= 0; }) : opts;
    return '<fieldset class="onx-q" data-q="' + id + '"><legend class="onx-label">' + esc(label) + '</legend>' + (hint ? '<p class="onx-hint">' + esc(hint) + '</p>' : '') +
      '<div class="onx-choices onx-choices--chips" data-multi="1" data-sec="' + section + '" data-key="' + key + '" aria-describedby="onx-' + id + '-err">' +
      list.map(function (o) { return '<button type="button" class="onx-choice" aria-pressed="' + (cur.indexOf(o[0]) >= 0) + '" data-v="' + o[0] + '"><span class="onx-choice__t">' + esc(o[1]) + '</span></button>'; }).join('') +
      '</div><p class="onx-err" id="onx-' + id + '-err" role="alert"></p></fieldset>';
  }

  // Website suggestions: shown next to the question they fit, never filled in on their own.
  function suggestion(kind, section, key) {
    var w = S.session && S.session.website, sg = w && w.suggestions && w.suggestions[kind];
    if (!sg) return '';
    var path = section + '.' + key;
    var used = S.suggested.indexOf(path) >= 0 && sec(section)[key] === sg.value;
    return '<div class="onx-suggest" data-path="' + path + '">' +
      '<p class="onx-suggest__k">From your website <span>' + esc(w.domain || '') + '</span></p>' +
      '<p class="onx-suggest__v">' + esc(sg.value) + '</p>' +
      '<p class="onx-suggest__q">“' + esc(sg.quote) + '”</p>' +
      '<button type="button" class="onx-btn onx-btn--small" data-use="' + path + '" data-val="' + esc(sg.value) + '"' + (used ? ' disabled' : '') + '>' + (used ? 'Used — edit it above' : 'Use this') + '</button></div>';
  }

  // ── Screens ─────────────────────────────────────────────────────
  var VIEWS = {
    welcome: function () {
      return '<section class="onx-welcome">' +
        '<p class="onx-kicker">About 5 minutes · 7 topics, one question at a time</p>' +
        '<h1 id="onxTitle" class="onx-display">Welcome to OrivenAI.</h1>' +
        '<p class="onx-lede onx-lede--lg">Let’s build a marketing strategy around your business, your goals and the way you want to grow.</p>' +
        '<p class="onx-body">Answer a few questions and we’ll prepare a personalized marketing strategy for your business.</p>' +
        '<div class="onx-nav onx-nav--start"><button type="button" class="onx-btn onx-btn--primary onx-btn--lg" data-next="business" data-autofocus>Continue<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>' +
        '<span class="onx-note">Your answers are saved as you go.</span></div>' +
      '</section>';
    },

    business: function () {
      return ask({ intro: 'First, let’s get to know your business.', title: 'What’s your business called?',
        body: bare('name', text('name', 'business', 'name', 'e.g. Bloom & Wick', 120, false, true)) });
    },
    'business-industry': function () {
      var b = sec('business');
      return ask({ title: 'Which industry are you in?',
        body: bare('industry', '<input class="onx-input" type="text" id="onx-industry" list="onx-industries" data-sec="business" data-key="industry" maxlength="80" autocomplete="off" placeholder="Start typing to search" aria-labelledby="onxTitle" aria-describedby="onx-industry-hint onx-industry-err" value="' + esc(b.industry || '') + '">' +
          '<datalist id="onx-industries">' + INDUSTRIES.map(function (i) { return '<option value="' + esc(i) + '">'; }).join('') + '</datalist>', 'Pick from the list or type your own. Choose “Other” to describe it.') +
          '<div class="onx-other"' + (b.industry === 'Other' ? '' : ' hidden') + '>' + field('industryOther', 'Describe your industry', text('industryOther', 'business', 'industryOther', 'e.g. Candle studio', 80)) + '</div>' });
    },
    'business-offer': function () {
      return ask({ title: 'What do you offer?', lede: 'Your products or services, in a sentence or two.',
        body: bare('offer', text('offer', 'business', 'offer', 'e.g. Hand-poured soy candles and candle-making workshops', 400, true, true)) });
    },
    'business-area': function () {
      return ask({ title: 'Where are you active?', lede: 'A city, a region, a country, online — whatever describes where you sell.',
        body: bare('area', text('area', 'business', 'area', 'e.g. Utrecht and online across the Netherlands', 160, false, true)) });
    },
    'business-online': function () {
      var socials = (sec('business').socials || []).join('\n');
      return ask({ title: 'Where can people find you online?', lede: 'Optional. We can read your homepage and suggest answers for the next steps — you check each one, nothing is filled in without you.',
        body: field('website', 'Website', '<div class="onx-row">' + text('website', 'business', 'website', 'yourbusiness.com', 300) +
            '<button type="button" class="onx-btn onx-btn--ghost" data-read-site>Read my website</button></div><div class="onx-site" aria-live="polite">' + siteStatus() + '</div>', null, true) +
          field('socials', 'Social profiles', '<textarea class="onx-input onx-input--area" rows="2" id="onx-socials" data-sec="business" data-key="socials" data-list="1" placeholder="One link per line, e.g. instagram.com/yourbusiness" aria-describedby="onx-socials-err">' + esc(socials) + '</textarea>', null, true),
        nav: { label: sec('business').website || (sec('business').socials || []).length ? 'Continue' : 'Skip for now' } });
    },

    quote1: function () {
      return '<section class="onx-quote onx-quote--a" aria-labelledby="onxTitle">' +
        '<span class="onx-quote__mark" aria-hidden="true"></span>' +
        '<h1 id="onxTitle" class="onx-quote__t">Great marketing starts with understanding who you’re trying to reach.</h1>' +
        '<p class="onx-quote__n">Next: your audience</p>' + nav(prevOf('quote1'), 'audience') + '</section>';
    },

    audience: function () {
      return ask({ title: 'Who are you trying to reach?',
        body: choice('atype', 'Your customers are…', 'audience', 'type', OPT.audienceType, 'cards') +
          choice('loc', 'And where are they?', 'audience', 'location', OPT.location, 'seg') });
    },
    'audience-ideal': function () {
      return ask({ title: 'Describe your ideal customer.', lede: 'Who buys from you, and what do they care about?',
        body: bare('ideal', text('ideal', 'audience', 'ideal', 'e.g. Gift shoppers and interior lovers aged 25–45 who care about natural products', 500, true, true)) + suggestion('audience', 'audience', 'ideal') });
    },
    'audience-problem': function () {
      return ask({ title: 'What’s the biggest problem you solve for them?',
        body: bare('problem', text('problem', 'audience', 'problem', 'e.g. Finding a gift that feels personal and isn’t mass-produced', 500, true, true)) + suggestion('problem', 'audience', 'problem') });
    },
    offer: function () {
      return ask({ intro: 'What makes your business different?', title: 'What’s your main product or service?',
        body: bare('main', text('main', 'offer', 'main', 'e.g. Soy candles', 400, false, true)) + suggestion('offer', 'offer', 'main') });
    },
    'offer-different': function () {
      return ask({ title: 'What makes it different?', lede: 'What do you do that others in your market don’t?',
        body: bare('different', text('different', 'offer', 'different', 'e.g. Every candle is poured by hand in our own studio', 500, true, true)) + suggestion('differentiator', 'offer', 'different') });
    },
    'offer-price': function () {
      return ask({ title: 'How is it priced?',
        body: choice('price', 'Price positioning', 'offer', 'price', OPT.price, 'seg') +
          field('why', 'Why do customers choose you?', text('why', 'offer', 'why', 'e.g. Natural ingredients, a local studio and workshops', 500, true), null, true) +
          '<aside class="onx-vp" aria-live="polite">' + valueProp() + '</aside>' });
    },
    goals: function () {
      return ask({ title: 'What do you want to achieve?',
        body: choice('primary', 'Your main goal', 'goals', 'primary', OPT.goal, 'grid') + '<div class="onx-sec2">' + secondaryBlock() + '</div>' });
    },
    'goals-success': function () {
      return ask({ title: 'What would success look like over the next 3 months?',
        body: bare('success', text('success', 'goals', 'success', 'Write your own, or pick an example', 300, false, true)) +
          '<div class="onx-examples" role="group" aria-label="Examples">' + examplesBlock() + '</div>' });
    },
    marketing: function () {
      var m = sec('marketing');
      return ask({ intro: 'How are you currently marketing your business?', title: 'Which channels do you use today?',
        body: multi('channels', 'Channels you use', 'marketing', 'channels', OPT.channel, 'Choose all that apply.') +
          '<div class="onx-other"' + ((m.channels || []).indexOf('other') >= 0 ? '' : ' hidden') + ' data-for="channels">' + field('channelsOther', 'Which other channel?', text('channelsOther', 'marketing', 'channelsOther', 'e.g. Local markets, flyers', 120)) + '</div>' +
          '<div class="onx-working">' + workingBlock() + '</div>' });
    },
    'marketing-challenge': function () {
      var m = sec('marketing');
      return ask({ title: 'What’s your biggest marketing challenge?',
        body: choice('challenge', 'Your biggest challenge', 'marketing', 'challenge', OPT.challenge, 'chips') +
          '<div class="onx-other"' + (m.challenge === 'other' ? '' : ' hidden') + ' data-for="challenge">' + field('challengeOther', 'Describe it', text('challengeOther', 'marketing', 'challengeOther', 'Your biggest challenge', 200)) + '</div>' });
    },
    'marketing-paid': function () {
      return ask({ title: 'Have you run paid ads before?', lede: 'Google, Meta, TikTok or any other platform.',
        body: choice('paid', 'Paid advertising experience', 'marketing', 'paidAds', OPT.paidAds, 'seg') });
    },
    budget: function () {
      return ask({ intro: 'Let’s make your strategy realistic.', title: 'What’s your monthly advertising budget?', lede: 'Your strategy will only recommend what fits these limits.',
        body: choice('budget', 'Monthly advertising budget', 'budget', 'budget', OPT.budget, 'ladder') });
    },
    'budget-capacity': function () {
      return ask({ title: 'How much time can you give marketing each week?',
        body: choice('time', 'Time for marketing each week', 'budget', 'time', OPT.time, 'ladder') +
          choice('team', 'Who handles your marketing?', 'budget', 'team', OPT.team, 'chips') });
    },

    quote2: function () {
      return '<section class="onx-quote onx-quote--b" aria-labelledby="onxTitle">' +
        '<div class="onx-quote__rule" aria-hidden="true"><span></span></div>' +
        '<h1 id="onxTitle" class="onx-quote__t">Your strategy should fit your business — <em>not the other way around.</em></h1>' +
        '<p class="onx-quote__n">Last step: choose who works with you</p>' + nav(prevOf('quote2'), 'assistant') + '</section>';
    },

    assistant: function () {
      var cur = S.preview || S.assistant || 'vector', a = assistant(cur);
      return '<section class="onx-asst">' +
        '<div class="onx-asst__intro">' + head('Your assistant', 'Choose the assistant you’ll work with.', 'All six can do everything in OrivenAI. Your choice sets the voice of your strategy and of Oriven Chat. You can change it later in Settings.') + '</div>' +
        '<div class="onx-asst__grid">' +
          '<div class="onx-asst__list" role="radiogroup" aria-label="Assistants">' + ASSISTANTS.map(function (x) {
            var on = x.id === S.assistant;
            return '<button type="button" role="radio" class="onx-agent" data-agent="' + x.id + '" style="--ac:' + x.color + '" aria-checked="' + on + '" tabindex="' + (x.id === cur ? 0 : -1) + '">' +
              glyph(x.id) + '<span class="onx-agent__n">' + x.name + '</span><span class="onx-agent__r">' + esc(x.role) + '</span></button>';
          }).join('') + '</div>' +
          '<article class="onx-asst__card" style="--ac:' + a.color + '" aria-live="polite">' + previewCard(a) + '</article>' +
        '</div>' +
        '<div class="onx-compare"' + (S.compare ? '' : ' hidden') + '>' + compareTable() + '</div>' +
        '<div class="onx-nav"><button type="button" class="onx-btn onx-btn--ghost" data-go="quote2">Back</button>' +
          '<button type="button" class="onx-btn onx-btn--text" data-compare aria-expanded="' + S.compare + '">' + (S.compare ? 'Hide comparison' : 'Compare all six') + '</button>' +
          '<button type="button" class="onx-btn onx-btn--primary" data-confirm-agent>' + 'Continue with ' + esc(a.name) + '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button></div>' +
      '</section>';
    },

    paywall: function () {
      var plans = typeof ORIVEN_PERIOD_PLANS !== 'undefined' ? ORIVEN_PERIOD_PLANS : [];
      var chosen = typeof orvRememberedPlanChoice === 'function' ? orvRememberedPlanChoice() : null;
      var chosenName = chosen && typeof orvPeriodPlan === 'function' && orvPeriodPlan(chosen) ? orvPeriodPlan(chosen).name : '';
      return '<section class="onx-pay">' +
        '<div class="onx-pay__head">' + head('Choose your plan', 'Pick how long you want OrivenAI. Your marketing plan is written for exactly that period.', 'Every plan includes every feature. Right after payment we write your marketing plan from your answers — for 14 days, 1, 3, 6 or 12 months, matching the plan you choose. You pay once; nothing renews automatically.') + '</div>' +
        '<div class="onx-pay__confirm" role="status" aria-live="polite" hidden></div>' +
        (chosenName ? '<p class="onx-pay__chosen">You picked <b>' + esc(chosenName) + '</b> on our pricing page — it’s marked below. Confirm it, or choose another plan.</p>' : '') +
        '<div class="onx-plans">' + plans.map(function (p) {
          var f = typeof orvPlanCardFacts === 'function' ? orvPlanCardFacts(p) : { price: '€' + p.price, period: p.periodLabel, credits: p.credits + ' credits' };
          var badge = PLAN_BADGES[p.id] || '', featured = p.id === FEATURED_PLAN;
          // Every card has the same rows (badge, name, price, period, credits,
          // note, button), empty where a plan has nothing, so they line up.
          return '<div class="onx-plan' + (featured ? ' is-featured' : '') + (badge ? ' has-badge' : '') + (p.id === chosen ? ' is-chosen' : '') + '" data-plan="' + esc(p.id) + '"' + (p.id === chosen ? ' aria-label="' + esc(p.name + ' — your choice') + '"' : '') + '>' +
            '<span class="onx-plan__badge"' + (badge ? '' : ' aria-hidden="true"') + '>' + esc(badge) + '</span>' +
            '<h2 class="onx-plan__n">' + esc(p.name) + '</h2>' +
            '<p class="onx-plan__p">' + esc(f.price) + '</p>' +
            '<p class="onx-plan__d">' + esc(f.period) + '</p>' +
            '<p class="onx-plan__c">' + esc(f.credits) + '</p>' +
            '<p class="onx-plan__m">' + esc(f.instalmentNote || '') + '</p>' +
            '<button type="button" class="onx-btn ' + (featured ? 'onx-btn--primary' : 'onx-btn--outline') + '" data-buy="' + esc(p.id) + '">Choose ' + esc(p.name) + '</button></div>';
        }).join('') + '</div>' +
        '<p class="onx-pay__fine">' + esc(typeof ORIVEN_VAT_LINE !== 'undefined' ? ORIVEN_VAT_LINE : 'Price includes VAT.') + ' Secure payment by Stripe. ' +
          '<a href="/refund-policy" target="_blank" rel="noopener">Refund policy</a> · <a href="/terms" target="_blank" rel="noopener">Terms</a></p>' +
        '<p class="onx-pay__out"><button type="button" class="onx-btn onx-btn--text" data-go="assistant">Back</button><button type="button" class="onx-btn onx-btn--text" data-signout>Sign out</button></p>' +
      '</section>';
    },

    done: function () {
      var a = assistant(S.assistant);
      return '<section class="onx-ready onx-ready--done" style="--ac:' + (a ? a.color : '#EAFD13') + '">' +
        '<div class="onx-ready__mark" aria-hidden="true">' + (a ? glyph(a.id) : '') + '</div>' +
        '<p class="onx-kicker">Payment confirmed</p>' +
        '<h1 id="onxTitle" class="onx-display onx-display--md">You’re in.</h1>' +
        '<p class="onx-lede onx-lede--lg">We’re writing your marketing plan' + (S.horizon ? ' for the next ' + esc(S.horizon) : '') + ' from your answers now. You’ll find it in Control Center → Marketing Plan' + (a ? ', with ' + esc(a.name) + ' ready to help' : '') + '.</p>' +
        '<div class="onx-nav onx-nav--start"><button type="button" class="onx-btn onx-btn--primary onx-btn--lg" data-finish data-autofocus>Open Control Center<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button></div>' +
      '</section>';
    },
  };

  function workingBlock() {
    var used = (sec('marketing').channels || []).filter(function (c) { return c !== 'none'; });
    return used.length ? multi('working', 'Which of these bring results?', 'marketing', 'working', OPT.channel, 'Leave empty if you’re not sure yet.', used) : '';
  }
  function secondaryBlock() {
    var g = sec('goals');
    return choice('secondary', 'A second goal', 'goals', 'secondary', OPT.goal.filter(function (o) { return o[0] !== g.primary; }), 'chips', null, true);
  }
  function examplesBlock() {
    return (SUCCESS_EXAMPLES[sec('goals').primary] || SUCCESS_EXAMPLES.sales).map(function (e) { return '<button type="button" class="onx-chip" data-example="' + esc(e) + '">' + esc(e) + '</button>'; }).join('');
  }
  // Badges on the onboarding plan cards (labels only; prices, durations and
  // credits come from plans.js unchanged).
  var PLAN_BADGES = { monthly: 'Most Popular', annual: 'Lowest Monthly Price' };
  var FEATURED_PLAN = 'monthly';
  function label(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1]; return ''; }
  function statusWord(st) { return { invalid: 'address not usable', unreachable: 'not reachable', timeout: 'timed out', blocked: 'blocked automated reading', unreadable: 'not readable', incomplete: 'too little text', partial: 'nothing confirmed', ok: 'read' }[st] || 'not read'; }
  function siteStatus() {
    var w = S.session && S.session.website;
    if (!w) return '';
    var n = w.suggestions ? Object.keys(w.suggestions).length : 0;
    var good = w.status === 'ok' && n;
    return '<p class="onx-site__m' + (good ? ' is-ok' : '') + '">' + esc(w.message || '') + (good ? ' You’ll see ' + n + ' suggestion' + (n === 1 ? '' : 's') + ' in the next steps.' : '') + '</p>';
  }
  // A value proposition from the user's own answers (a template, not AI).
  function valueProp() {
    var o = sec('offer'), au = sec('audience'), b = sec('business');
    if (!o.main || !au.ideal) return '<p class="onx-vp__k">Your value proposition</p><p class="onx-vp__e">Fill in your product and what makes it different to see a first draft here.</p>';
    var s = esc(b.name || 'We') + ' helps ' + esc(lower(au.ideal)) + (au.problem ? ' with ' + esc(lower(au.problem)) : '') + ' through ' + esc(lower(o.main)) + (o.different ? ' — ' + esc(lower(o.different)) : '') + '.';
    return '<p class="onx-vp__k">A first draft of your value proposition</p><p class="onx-vp__t">' + s + '</p><p class="onx-vp__e">Built from your own answers. Your strategy will refine it.</p>';
  }
  function lower(s) { s = String(s || '').trim().replace(/[.\s]+$/, ''); return s && /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

  function glyph(id) {
    var dots = window.IkCreatures && window.IkCreatures.glyph ? window.IkCreatures.glyph(id) : [];
    return '<svg class="onx-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + dots.map(function (d) { return '<circle cx="' + d[0] + '" cy="' + d[1] + '" r="' + d[2] + '" fill-opacity="' + d[3] + '"/>'; }).join('') + '</svg>';
  }
  function previewCard(a) {
    return '<div class="onx-asst__stage"><canvas class="onx-creature" aria-hidden="true"></canvas>' + glyph(a.id) + '</div>' +
      '<div class="onx-asst__text"><p class="onx-asst__role">' + esc(a.role) + '</p><h2 class="onx-asst__name">' + esc(a.name) + '</h2>' +
      '<dl class="onx-asst__dl"><div><dt>Tone</dt><dd>' + esc(a.tone) + '</dd></div><div><dt>Character</dt><dd>An imagined backstory: ' + esc(a.story) + '</dd></div></dl>' +
      '<p class="onx-asst__k">Strongest at</p><ul class="onx-asst__s">' + a.strengths.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>';
  }
  function compareTable() {
    return '<div class="onx-compare__wrap"><table class="onx-table"><caption>The six assistants side by side</caption><thead><tr><th scope="col">Assistant</th><th scope="col">Focus</th><th scope="col">Tone</th><th scope="col">Strongest at</th></tr></thead><tbody>' +
      ASSISTANTS.map(function (a) { return '<tr style="--ac:' + a.color + '"><th scope="row">' + glyph(a.id) + a.name + '</th><td>' + esc(a.role) + '</td><td>' + esc(a.tone) + '</td><td>' + esc(a.strengths[0]) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }

  // One creature canvas: rebuilt for the assistant in preview.
  function showCreature(id) {
    var D = window.IkDotField, C = window.IkCreatures, cv = $('.onx-creature');
    if (S.creature && D) { var k = D.fields.indexOf(S.creature); if (k >= 0) D.fields.splice(k, 1); S.creature = null; }
    if (!D || !C || !cv || !cv.getContext) return;
    var a = assistant(id);
    var cr = new C.Creature(cv, id, { color: a.rgb, reduce: reduce });
    cr.visible = true; cr.assemble(0.35);
    S.creature = D.add(cr);
    if (window.ResizeObserver) new ResizeObserver(function () { cr.layout(); }).observe(cv);
    cv.parentNode.addEventListener('pointermove', function (e) { if (e.pointerType === 'touch' || reduce.matches) return; cr.pointer(e.clientX, e.clientY, true); D.tick(); }, { passive: true });
    cv.parentNode.addEventListener('pointerleave', function () { cr.pointer(0, 0, false); D.tick(); });
    cv.parentNode.classList.add('is-live');
  }
  function stopCreature() {
    var D = window.IkDotField;
    if (S.creature && D) { var k = D.fields.indexOf(S.creature); if (k >= 0) D.fields.splice(k, 1); }
    S.creature = null;
  }

  // ── Validation ──────────────────────────────────────────────────
  // Per screen: [element id, section, key, message].
  var REQUIRED = {
    business: [['name', 'business', 'name', 'Enter your business name.']],
    'business-industry': [['industry', 'business', 'industry', 'Choose or type your industry.']],
    'business-offer': [['offer', 'business', 'offer', 'Tell us what you offer.']],
    'business-area': [['area', 'business', 'area', 'Tell us where you’re active.']],
    audience: [['atype', 'audience', 'type', 'Choose who your customers are.'], ['loc', 'audience', 'location', 'Choose where your customers are.']],
    'audience-ideal': [['ideal', 'audience', 'ideal', 'Describe your ideal customer.']],
    'audience-problem': [['problem', 'audience', 'problem', 'Describe the problem you solve.']],
    offer: [['main', 'offer', 'main', 'Enter your main product or service.']],
    'offer-different': [['different', 'offer', 'different', 'Tell us what makes it different.']],
    'offer-price': [['price', 'offer', 'price', 'Choose a price positioning.']],
    goals: [['primary', 'goals', 'primary', 'Choose your main goal.']],
    'goals-success': [['success', 'goals', 'success', 'Describe what success would look like, or pick an example.']],
    marketing: [['channels', 'marketing', 'channels', 'Choose at least one option, or “None yet”.']],
    'marketing-challenge': [['challenge', 'marketing', 'challenge', 'Choose your biggest challenge.']],
    'marketing-paid': [['paid', 'marketing', 'paidAds', 'Choose an answer.']],
    budget: [['budget', 'budget', 'budget', 'Choose a budget range.']],
    'budget-capacity': [['time', 'budget', 'time', 'Choose how much time you have.'], ['team', 'budget', 'team', 'Choose who handles your marketing.']],
  };
  // Which screen asks for an answer ("audience.ideal" → 'audience-ideal').
  var FIELD_SCREEN = { 'business.industryOther': 'business-industry', 'marketing.challengeOther': 'marketing-challenge' };
  Object.keys(REQUIRED).forEach(function (scr) { REQUIRED[scr].forEach(function (r) { FIELD_SCREEN[r[1] + '.' + r[2]] = scr; }); });
  function filled(v) { return Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : v != null; }
  function validate(step) {
    var rules = (REQUIRED[step] || []).slice(), bad = [];
    if (step === 'business-industry' && sec('business').industry === 'Other') rules.push(['industryOther', 'business', 'industryOther', 'Describe your industry.']);
    if (step === 'marketing-challenge' && sec('marketing').challenge === 'other') rules.push(['challengeOther', 'marketing', 'challengeOther', 'Describe your challenge.']);
    $$('.onx-err').forEach(function (e) { e.textContent = ''; });
    $$('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
    rules.forEach(function (r) {
      if (filled(sec(r[1])[r[2]])) return;
      bad.push(r[0]);
      var err = $('#onx-' + r[0] + '-err'); if (err) err.textContent = r[3];
      var inp = $('#onx-' + r[0]) || $('[data-q="' + r[0] + '"] .onx-choices');
      if (inp) inp.setAttribute('aria-invalid', 'true');
    });
    if (bad.length) {
      var first = $('#onx-' + bad[0]) || $('[data-q="' + bad[0] + '"] .onx-choice[tabindex="0"]') || $('[data-q="' + bad[0] + '"] .onx-choice');
      if (first) { first.focus(); if (first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: reduce.matches ? 'auto' : 'smooth' }); }
    }
    return !bad.length;
  }

  // ── Events ──────────────────────────────────────────────────────
  function bind(step) {
    var main = $('.onx-main');
    main.oninput = function (e) {
      var t = e.target, s = t.getAttribute('data-sec'), k = t.getAttribute('data-key');
      if (!s || !k) return;
      sec(s)[k] = t.getAttribute('data-list') ? t.value.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 5) : t.value;
      // Edited by hand: no longer "from the website" unless it still matches.
      var path = s + '.' + k, i = S.suggested.indexOf(path);
      if (i >= 0) { var sg = $('[data-path="' + path + '"] [data-use]'); if (!sg || sg.getAttribute('data-val') !== t.value) S.suggested.splice(i, 1); }
      if (k === 'industry') { var o = $('.onx-other'); if (o) o.hidden = t.value !== 'Other'; }
      var vp = $('.onx-vp'); if (vp) vp.innerHTML = valueProp();
      var err = $('#' + t.id + '-err'); if (err && filled(t.value)) { err.textContent = ''; t.removeAttribute('aria-invalid'); }
      markDirty(s);
    };
    main.onkeydown = function (e) {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      var t = e.target;
      if (t.tagName !== 'INPUT' || t.getAttribute('list') || t.id === 'onx-website') return; // the industry list and the website field keep Enter for themselves
      var nb = $('.onx-nav [data-next]'); if (nb) { e.preventDefault(); nb.click(); }
    };
    main.onclick = function (e) {
      var b = e.target.closest('button, a');
      if (!b || !main.contains(b)) return;
      if (b.hasAttribute('data-go')) { flush(); go(b.getAttribute('data-go')); return; }
      if (b.hasAttribute('data-next')) { next(b.getAttribute('data-next')); return; }
      if (b.classList.contains('onx-choice')) { pick(b); return; }
      if (b.hasAttribute('data-example')) { var inp = $('#onx-success'); sec('goals').success = b.getAttribute('data-example'); if (inp) { inp.value = sec('goals').success; inp.focus(); } markDirty('goals'); var er = $('#onx-success-err'); if (er) er.textContent = ''; return; }
      if (b.hasAttribute('data-use')) { useSuggestion(b); return; }
      if (b.hasAttribute('data-read-site')) { readSite(b); return; }
      if (b.classList.contains('onx-agent')) { previewAgent(b.getAttribute('data-agent'), true); return; }
      if (b.hasAttribute('data-compare')) { S.compare = !S.compare; var c = $('.onx-compare'); c.hidden = !S.compare; b.setAttribute('aria-expanded', S.compare); b.textContent = S.compare ? 'Hide comparison' : 'Compare all six'; if (S.compare && c.scrollIntoView) c.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' }); return; }
      if (b.hasAttribute('data-confirm-agent')) { confirmAgent(b); return; }
      if (b.hasAttribute('data-buy')) { buy(b); return; }
      if (b.hasAttribute('data-signout')) { if (typeof authSignOut === 'function') authSignOut(); return; }
      if (b.hasAttribute('data-finish')) { finish(); return; }
    };
    if (step === 'assistant') { if (!S.assistant) S.assistant = null; showCreature(S.preview || S.assistant || 'vector'); }
    else stopCreature();
    if (step === 'paywall') { checkAccess(returningFromCheckout || S.pendingCheckout ? 'checkout' : S.resumedAtPaywall ? 'resume' : false); S.resumedAtPaywall = false; S.pendingCheckout = false; }
  }

  function pick(btn) {
    var group = btn.closest('.onx-choices'), s = group.getAttribute('data-sec'), k = group.getAttribute('data-key'), v = btn.getAttribute('data-v');
    if (group.getAttribute('data-multi')) {
      var cur = (sec(s)[k] || []).slice(), i = cur.indexOf(v);
      if (i >= 0) cur.splice(i, 1); else cur.push(v);
      if (v === 'none' && i < 0) cur = ['none']; else if (v !== 'none') cur = cur.filter(function (x) { return x !== 'none'; });
      sec(s)[k] = cur;
      if (k === 'channels') { // results can only come from channels in use
        sec(s).working = (sec(s).working || []).filter(function (c) { return cur.indexOf(c) >= 0; });
        $$('.onx-choice', group).forEach(function (x) { x.setAttribute('aria-pressed', cur.indexOf(x.getAttribute('data-v')) >= 0); });
        var wb = $('.onx-working'); if (wb) wb.innerHTML = workingBlock();
        var och0 = $('[data-for="channels"]'); if (och0) och0.hidden = cur.indexOf('other') < 0;
        var e0 = group.parentNode.querySelector('.onx-err'); if (e0) e0.textContent = '';
        group.removeAttribute('aria-invalid');
        markDirty(s);
        return;
      }
      $$('.onx-choice', group).forEach(function (x) { x.setAttribute('aria-pressed', (sec(s)[k] || []).indexOf(x.getAttribute('data-v')) >= 0); });
    } else {
      var optional = group.getAttribute('data-optional') && sec(s)[k] === v;
      sec(s)[k] = optional ? '' : v; // an optional choice can be cleared again
      $$('.onx-choice', group).forEach(function (x) { var on = x.getAttribute('data-v') === sec(s)[k]; x.setAttribute('aria-checked', on); x.tabIndex = on ? 0 : -1; });
      if (!sec(s)[k]) btn.tabIndex = 0;
      if (k === 'primary') { if (sec(s).secondary === v) sec(s).secondary = ''; var s2 = $('.onx-sec2'); if (s2) s2.innerHTML = secondaryBlock(); var exb = $('.onx-examples'); if (exb) exb.innerHTML = examplesBlock(); }
      if (k === 'challenge') { var oc = $('[data-for="challenge"]'); if (oc) oc.hidden = v !== 'other'; }
    }
    if (k === 'channels') { var och = $('[data-for="channels"]'); if (och) och.hidden = (sec(s)[k] || []).indexOf('other') < 0; }
    var err = group.parentNode.querySelector('.onx-err'); if (err) err.textContent = '';
    group.removeAttribute('aria-invalid');
    markDirty(s);
  }

  // Arrow keys inside a radiogroup, as in a native radio group.
  function onKey(e) {
    var g = e.target.closest && e.target.closest('[role="radiogroup"]');
    if (!g || ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].indexOf(e.key) < 0) return;
    var items = Array.prototype.slice.call(g.querySelectorAll('[role="radio"]')), i = items.indexOf(e.target);
    if (i < 0) return;
    e.preventDefault();
    var n = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach(function (x, k) { x.tabIndex = k === n ? 0 : -1; });
    items[n].focus();
    if (items[n].classList.contains('onx-agent')) previewAgent(items[n].getAttribute('data-agent'), true);
    else pick(items[n]);
  }

  function next(to) {
    var step = S.step;
    if (REQUIRED[step] && !validate(step)) return;
    flush().then(function () {});
    go(to);
  }

  function useSuggestion(b) {
    var path = b.getAttribute('data-use'), parts = path.split('.'), v = b.getAttribute('data-val');
    sec(parts[0])[parts[1]] = v;
    if (S.suggested.indexOf(path) < 0) S.suggested.push(path);
    var id = { 'audience.ideal': 'ideal', 'audience.problem': 'problem', 'offer.main': 'main', 'offer.different': 'different', 'business.offer': 'offer' }[path];
    var inp = id && $('#onx-' + id);
    if (inp) { inp.value = v; inp.focus(); var er = $('#onx-' + id + '-err'); if (er) er.textContent = ''; }
    b.disabled = true; b.textContent = 'Used — edit it above';
    var vp = $('.onx-vp'); if (vp) vp.innerHTML = valueProp();
    markDirty(parts[0]);
  }

  function readSite(btn) {
    var url = (sec('business').website || '').trim(), box = $('.onx-site');
    if (!url) { box.innerHTML = '<p class="onx-site__m">Enter your website address first.</p>'; $('#onx-website').focus(); return; }
    btn.disabled = true; btn.textContent = 'Reading…';
    box.innerHTML = '<p class="onx-site__m"><span class="onx-spin" aria-hidden="true"></span>Reading your homepage — this takes a few seconds.</p>';
    flush().then(function () { return api('/api/onboarding/website', 'POST', { url: url }); }).then(function (r) {
      btn.disabled = false; btn.textContent = 'Read my website';
      if (r.ok && r.data && r.data.session) { S.session = r.data.session; box.innerHTML = siteStatus(); track('next_step_clicked', { action: 'onboarding_website', kind: S.session.website ? S.session.website.status : 'none' }); return; }
      box.innerHTML = '<p class="onx-site__m">' + esc((r.data && r.data.error) || 'We couldn’t read your website right now. Continue with your own answers.') + '</p>';
    });
  }

  function previewAgent(id, fromUser) {
    S.preview = id;
    var a = assistant(id), card = $('.onx-asst__card');
    $$('.onx-agent').forEach(function (x) { var on = x.getAttribute('data-agent') === id; x.classList.toggle('is-preview', on); x.tabIndex = on ? 0 : -1; x.setAttribute('aria-checked', on); });
    S.assistant = id;
    card.style.setProperty('--ac', a.color);
    card.innerHTML = previewCard(a);
    showCreature(id);
    var c = $('[data-confirm-agent]'); if (c) c.innerHTML = 'Continue with ' + esc(a.name) + '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
    if (fromUser && window.innerWidth < 900 && card.scrollIntoView) card.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' });
  }

  function confirmAgent(btn) {
    var id = S.assistant || S.preview || 'vector';
    btn.disabled = true;
    api('/api/onboarding/session', 'PUT', { assistant: id, step: 'paywall' }).then(function (r) {
      btn.disabled = false;
      if (r.ok && r.data && r.data.session) {
        S.session = r.data.session; S.assistant = id;
        track('next_step_clicked', { action: 'onboarding_assistant', kind: id });
        if ((S.session.missing || []).length) { missingAnswers(S.session.missing); return; }
        go('paywall', { noSave: true }); return;
      }
      if (r.data && r.data.code === 'ANSWERS_LOCKED') { go('paywall', { noSave: true }); return; }
      if (typeof toast === 'function') toast((r.data && r.data.error) || 'Couldn’t save your choice. Please try again.', 'warn');
    });
  }

  // The plans need every answer and a chosen assistant (the server reports
  // missing answers on the session).
  function readyToBuy() { return !!(S.assistant && S.session && S.session.assistant && !(S.session.missing || []).length); }
  function stopPolls() { clearTimeout(S.pollTimer); clearTimeout(S.payPoll); S.pollTimer = 0; S.payPoll = 0; }
  // The server listed missing answers ("audience.ideal", …): open the first
  // screen that asks for one and show its message.
  function missingAnswers(list) {
    var stepFor = 'business';
    for (var i = FLOW.length - 1; i >= 0; i--) if (list.some(function (m) { return FIELD_SCREEN[m] === FLOW[i].id; })) stepFor = FLOW[i].id;
    go(stepFor);
    setTimeout(function () { validate(stepFor); }, 60);
  }

  // ── Paywall ─────────────────────────────────────────────────────
  function buy(btn) {
    var id = btn.getAttribute('data-buy');
    if (typeof selectPlan !== 'function') return;
    // Confirm the exact plan first (js/planConfirm.js); nothing changes on "Choose a different plan".
    if (typeof window.orvConfirmPlan === 'function' && !btn._confirmed) {
      window.orvConfirmPlan(id).then(function (ok) { if (ok && S.step === 'paywall') { btn._confirmed = true; buy(btn); } });
      return;
    }
    btn._confirmed = false;
    $$('[data-buy]').forEach(function (b) { b.disabled = true; });
    btn.textContent = 'Opening secure checkout…';
    track('plan_selected', { plan: id, source: 'onboarding_flow' });
    flush({ step: 'paywall' }).then(function () { return selectPlan(id, { confirmed: true }); }).then(function () {
      // Still here: checkout didn't open (selectPlan showed the reason).
      setTimeout(function () { if (S.step !== 'paywall') return; $$('[data-buy]').forEach(function (b) { b.disabled = false; b.textContent = 'Choose ' + (b.closest('.onx-plan').querySelector('.onx-plan__n') || {}).textContent; }); }, 1500);
    });
  }
  // The server decides: the plan endpoint answers with content only when
  // payment is confirmed. After Stripe, the webhook can take a few seconds.
  // confirming: 'checkout' (back from Stripe: up to ~30 s), 'resume' (the
  // plans were left for checkout earlier, e.g. the tab closed after paying:
  // a short check first, so a payment on its way isn't made twice), or false.
  function checkAccess(confirming) {
    var box = $('.onx-pay__confirm'), tries = 0, max = confirming === 'resume' ? 4 : 15;
    function once() {
      api('/api/onboarding/plan').then(function (r) {
        if (S.step !== 'paywall') return;
        if (r.ok && r.data && r.data.locked === false) { returningFromCheckout = false; S.horizon = r.data.horizon && r.data.horizon.label; unlocked(); return; }
        if (!confirming) return;
        if (++tries < max) { S.payPoll = setTimeout(once, 2000); return; }
        if (confirming === 'resume') { box.hidden = true; box.innerHTML = ''; return; } // no recent payment: just the plans
        returningFromCheckout = false;
        box.innerHTML = 'We haven’t received the payment confirmation yet. If you completed the payment, refresh this page in a minute — your account opens as soon as it arrives.';
      });
    }
    if (confirming && box) { box.hidden = false; box.innerHTML = '<span class="onx-spin" aria-hidden="true"></span> ' + (confirming === 'resume' ? 'Checking for a recent payment…' : 'Confirming your payment…'); }
    once();
  }
  function unlocked() {
    if (typeof orvForgetPlanChoice === 'function') orvForgetPlanChoice();
    var st = window._orvObState; if (st) { st.eligible = false; st.stage = 'done'; st.completed = true; st.flow = { enabled: false }; }
    track('next_step_clicked', { action: 'onboarding_unlocked' });
    go('done', { noSave: true });
    clearTimeout(S.finishTimer);
    S.finishTimer = setTimeout(finish, 2500);
  }

  function finish() {
    clearTimeout(S.finishTimer);
    if (S.finishing) return;
    S.finishing = true;
    try { sessionStorage.setItem('oriven_open_planning', '1'); } catch (_) {} // land on Marketing Plan
    close();
    window.location.replace('/app');
  }

  function close() {
    stopPolls(); stopCreature();
    var D = window.IkDotField;
    if (S.field && D) { var k = D.fields.indexOf(S.field); if (k >= 0) D.fields.splice(k, 1); S.field = null; }
    if (S.el) { S.el.remove(); S.el = null; }
    document.documentElement.classList.remove('onx-lock');
    S.open = false;
  }

  // ── Entry ───────────────────────────────────────────────────────
  // session: GET /api/onboarding/state → flow.session (null before the first save).
  function open(session) {
    if (S.open) return;
    S.open = true;
    S.session = session || null;
    S.answers = JSON.parse(JSON.stringify((session && session.answers) || {}));
    S.suggested = (S.answers.suggested || []).slice();
    delete S.answers.suggested;
    S.assistant = (session && session.assistant) || null;
    S.preview = S.assistant;
    mount();
    track('onboarding_shown', { source: 'guided_flow' });
    var step = (session && session.step) || 'welcome';
    // Back at the plans (or paid and the tab closed after payment): the plans
    // screen asks the server, which unlocks and finishes onboarding. go()
    // sends an unfinished questionnaire back to the assistant screen.
    if (step === 'analyzing' || step === 'ready' || step === 'paywall' || step === 'done') step = 'paywall';
    else if (STEPS.indexOf(step) < 0) step = 'welcome';
    S.resumedAtPaywall = step === 'paywall' && !returningFromCheckout;
    S.pendingCheckout = !!(session && session.checkoutPending);
    go(step, { noSave: true });
  }

  // Back from Stripe with the browser's Back button: the page comes from the
  // back-forward cache with "Opening secure checkout…" still on the buttons.
  // Make them usable again and ask the server about the payment.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted || !S.open || S.step !== 'paywall') return;
    $$('[data-buy]').forEach(function (b) { b.disabled = false; b.textContent = 'Choose ' + (b.closest('.onx-plan').querySelector('.onx-plan__n') || {}).textContent; });
    if (typeof _checkoutInFlight !== 'undefined') { try { _checkoutInFlight = false; } catch (_) {} }
    checkAccess('checkout');
  });

  window.orvOnboardingFlow = { open: open, close: close, isOpen: function () { return S.open; }, ASSISTANTS: ASSISTANTS };
})();
