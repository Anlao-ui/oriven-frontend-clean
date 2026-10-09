/* ════════════════════════════════════════════════════════════════
   OrivenAI owner analytics (/admin/). Signed-in session from Supabase
   (js/supabase.js); the server decides who is an admin and returns only
   aggregates. Nothing here is a security boundary — it only renders.

   Labels distinguish: 0 (measured zero), — (no data), "Not tracked yet"
   (data source started after the range began) and "Estimate".
   ════════════════════════════════════════════════════════════════ */
(function () {
  var root = document.getElementById('adRoot');
  var tip = document.getElementById('adTip');
  var state = { days: '30', from: null, to: null, data: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('en-US'); }
  function pct(n) { return n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%'; }
  function day(iso) { return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
  var CH = { google_organic: 'Google search', google_ads: 'Google Ads', linkedin: 'LinkedIn', linkedin_ads: 'LinkedIn Ads', meta_ads: 'Meta Ads', other_paid: 'Other paid', social: 'Social', ai_assistant: 'AI assistants', other_search: 'Other search', email: 'Email', campaign: 'Tagged campaign', referral: 'Referral', direct: 'Direct', unknown: 'Unknown (statistics off)', not_tracked: 'Not tracked (before attribution)' };
  var chName = function (k) { return CH[k] || k; };

  function gate(title, text, link) {
    root.innerHTML = '<div class="ad-gate"><h1>' + esc(title) + '</h1><p>' + esc(text) + '</p>' + (link ? '<a class="ad-btn" href="' + link.href + '">' + esc(link.label) + '</a>' : '') + '</div>';
  }
  async function token() {
    try { var r = await SB.auth.getSession(); return r && r.data && r.data.session ? r.data.session.access_token : null; } catch (_) { return null; }
  }
  async function api(path, tok) {
    var r = await fetch(API_BASE_URL + path, { headers: { Authorization: 'Bearer ' + tok }, cache: 'no-store' });
    var body = null; try { body = await r.json(); } catch (_) {}
    return { status: r.status, body: body };
  }

  // Tracking starts after the range begins → "Not tracked yet" for missing history.
  function coverage(sinceIso) {
    if (!sinceIso) return '<span class="ad-pill warn">Not tracked yet</span>';
    var from = state.data && Date.parse(state.data.range.from);
    if (from && Date.parse(sinceIso) > from) return '<span class="ad-pill warn">Tracked since ' + esc(day(sinceIso)) + '</span>';
    return '';
  }
  function card(title, value, note, extra) {
    return '<div class="ad-card"><h3>' + esc(title) + '</h3><div class="ad-val">' + value + '</div>' + (note ? '<div class="ad-note">' + note + '</div>' : '') + (extra || '') + '</div>';
  }
  function bars(rows, key, valKey) {
    if (!rows || !rows.length) return '<div class="ad-missing">No data in this range</div>';
    var max = Math.max.apply(null, rows.map(function (r) { return r[valKey] || 0; })) || 1;
    return '<div class="ad-bars">' + rows.map(function (r) {
      return '<div class="ad-bar"><span>' + esc(key(r)) + '</span><div class="ad-bar-track" role="img" aria-label="' + esc(key(r) + ': ' + r[valKey]) + '"><div class="ad-bar-fill" style="width:' + Math.max(2, Math.round((r[valKey] || 0) / max * 100)) + '%"></div></div><span class="ad-bar-n">' + fmt(r[valKey]) + '</span></div>';
    }).join('') + '</div>';
  }
  function table(rows, cols) {
    if (!rows || !rows.length) return '<div class="ad-missing">No data in this range</div>';
    return '<table class="ad-table"><thead><tr>' + cols.map(function (c) { return '<th' + (c.n ? ' style="text-align:right"' : '') + '>' + esc(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td' + (c.n ? ' class="n"' : '') + '>' + (c.n ? fmt(r[c.key]) : esc(c.fmt ? c.fmt(r[c.key]) : r[c.key] || '—')) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  // Single-series area/line chart (one axis; no dual-axis charts).
  function chart(points, key, label, color) {
    if (!points || !points.length) return '<div class="ad-missing">No data in this range</div>';
    var W = 600, H = 180, P = { l: 34, r: 8, t: 10, b: 22 };
    var max = Math.max(1, Math.max.apply(null, points.map(function (p) { return p[key] || 0; })));
    var step = (W - P.l - P.r) / Math.max(1, points.length - 1);
    var x = function (i) { return P.l + i * step; }, y = function (v) { return P.t + (H - P.t - P.b) * (1 - v / max); };
    var line = points.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[key] || 0).toFixed(1); }).join(' ');
    var area = line + ' L' + x(points.length - 1).toFixed(1) + ' ' + (H - P.b) + ' L' + x(0).toFixed(1) + ' ' + (H - P.b) + ' Z';
    var ticks = [0, Math.round(max / 2), max];
    var labels = points.length > 1 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0];
    var id = 'g' + Math.random().toString(36).slice(2);
    return '<svg class="ad-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(label) + ' per day" data-key="' + key + '" data-label="' + esc(label) + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".22"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<g class="grid">' + ticks.map(function (t) { return '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text x="' + (P.l - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + fmt(t) + '</text>'; }).join('') + '</g>' +
      '<path d="' + area + '" fill="url(#' + id + ')"/><path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      labels.map(function (i) { return '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle') + '">' + esc(points[i].day.slice(5)) + '</text>'; }).join('') +
      '<rect x="' + P.l + '" y="' + P.t + '" width="' + (W - P.l - P.r) + '" height="' + (H - P.t - P.b) + '" fill="transparent" data-hover="1"/>' +
      '</svg>';
  }

  function render() {
    var d = state.data, w = d.website || {}, reg = d.registrations, act = d.activation, sub = d.subscriptions, fun = d.funnel, tr = d.tracking || {}, sys = d.system || {};
    var siteOk = w.status === 'ok';
    var top = '<div class="ad-top"><div><a class="ad-brand" href="/"><img src="/assets/orivenlogo.png" alt=""><span>OrivenAI</span><small>Owner analytics</small></a>' +
      '<p class="ad-sub">' + esc(day(d.range.from)) + ' – ' + esc(day(d.range.to)) + ' · generated ' + esc(new Date(d.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })) + '</p></div>' +
      '<div class="ad-filters"><div class="ad-seg" role="group" aria-label="Date range">' + ['7', '30', '90'].map(function (n) { return '<button type="button" data-days="' + n + '" aria-pressed="' + (state.days === n) + '">Last ' + n + ' days</button>'; }).join('') + '</div>' +
      '<form class="ad-custom" id="adCustom"><label>From <input type="date" name="from" value="' + esc(state.from || d.range.from.slice(0, 10)) + '" required></label><label>To <input type="date" name="to" value="' + esc(state.to || d.range.to.slice(0, 10)) + '" required></label><button type="submit">Apply</button></form></div></div>';

    var site = '<div class="ad-section"><h2>Website ' + (siteOk ? coverage(tr.pageviewsSince) : '<span class="ad-pill warn">' + (w.status === 'not_tracked' ? 'Not tracked yet (run the analytics migration)' : 'Unavailable') + '</span>') + '</h2>' +
      (siteOk ? '<div class="ad-grid">' +
        card('Visitors', fmt(w.visitors), '<span class="ad-pill est">Estimate</span> daily unique visitors, summed') +
        card('Page views', fmt(w.pageviews)) +
        card('Visits from Google search', fmt(((w.channels || []).find(function (c) { return c.channel === 'google_organic'; }) || { entries: 0 }).entries), 'Entries from google.*') +
        card('Visits from LinkedIn', fmt(((w.channels || []).filter(function (c) { return /^linkedin/.test(c.channel); }).reduce(function (n, c) { return n + c.entries; }, 0))), 'Organic and ads') +
        '</div><div class="ad-grid-2" style="margin-top:12px">' +
        '<div class="ad-card"><h3>Visitors per day</h3>' + chart(w.daily, 'visitors', 'Visitors', '#B7FF2A') + '</div>' +
        '<div class="ad-card"><h3>Traffic sources (entries)</h3>' + bars(w.channels, function (r) { return chName(r.channel); }, 'entries') + '</div>' +
        '<div class="ad-card"><h3>Top landing pages</h3>' + table(w.landingPages, [{ key: 'path', label: 'Page' }, { key: 'entries', label: 'Entries', n: 1 }]) + '</div>' +
        '<div class="ad-card"><h3>Referring sites</h3>' + table(w.referrers, [{ key: 'host', label: 'Site' }, { key: 'entries', label: 'Entries', n: 1 }]) + '</div>' +
        '</div>' : '') + '</div>';

    var regs = '<div class="ad-section"><h2>Registrations ' + coverage(tr.attributionSince) + '</h2><div class="ad-grid">' +
      card('New signups', fmt(reg.signups)) +
      card('Email verification rate', pct(reg.verificationRate), fmt(reg.verified) + ' of ' + fmt(reg.verifiable) + ' accounts created with verification') +
      card('Onboarding completion', pct(reg.onboardingRate), fmt(reg.onboarded) + ' of ' + fmt(reg.signups)) +
      card('Signup starts (site)', siteOk ? fmt(w.signupStarts) : '<span class="ad-missing">—</span>', siteOk ? 'Signup form submissions on the website' : 'Not tracked yet') +
      '</div><div class="ad-grid-2" style="margin-top:12px"><div class="ad-card"><h3>Signups by marketing source</h3>' +
      bars(Object.keys(reg.byChannel).map(function (k) { return { k: k, n: reg.byChannel[k] }; }).sort(function (a, b) { return b.n - a.n; }), function (r) { return chName(r.k); }, 'n') +
      '</div><div class="ad-card"><h3>Signups per day</h3>' + chart(reg.daily, 'signups', 'Signups', '#7DB8FF') + '</div></div></div>';

    var fa = act.freeFirstAd || {};
    var acti = '<div class="ad-section"><h2>Product activation ' + coverage(tr.eventsSince) + '</h2><div class="ad-grid">' +
      card('First ads started', fmt(act.firstAdsStarted), 'Accounts that started their first campaign build') +
      card('First ads completed', fmt(act.firstAdsCompleted)) +
      card('First ad success rate', pct(act.firstAdSuccessRate), 'Completed ÷ started (same accounts)') +
      card('Free first ad', fa.available ? fmt(fa.used) + '<small>used</small>' : '<span class="ad-missing">—</span>', fa.available ? fmt(fa.accounts) + ' claimed, ' + fmt(fa.failedAttempts) + ' failed attempts' : 'Not available', sys.freeFirstAd ? '<div class="ad-note">' + (sys.freeFirstAd.enabled && sys.freeFirstAd.cutoffSet ? '<span class="ad-pill ok">On since ' + esc(day(sys.freeFirstAd.cutoff)) + '</span>' : sys.freeFirstAd.enabled ? '<span class="ad-pill bad">On, but FREE_FIRST_AD_SINCE missing (nobody qualifies)</span>' : '<span class="ad-pill warn">Off (FREE_FIRST_AD_ENABLED)</span>') + '</div>' : '') +
      '</div></div>';

    var s = sub.stripe || {}, c = sub.checkout || {}, ev = sub.events || {};
    var subs = '<div class="ad-section"><h2>Subscriptions</h2><div class="ad-grid">' +
      card('Active paid subscribers', fmt(sub.activePaid), fmt(sub.stripeBilled) + ' billed by Stripe' + (sub.manuallyGranted ? ', ' + fmt(sub.manuallyGranted) + ' granted manually' : '') + ' · current') +
      card('New paid subscriptions', s.available ? fmt(s.newInRange) : '<span class="ad-missing">—</span>', s.available ? 'From Stripe, in this range' : 'Stripe unavailable') +
      card('Cancellations', s.available ? fmt(s.canceledInRange) : '<span class="ad-missing">—</span>', s.available ? 'From Stripe, in this range' : 'Stripe unavailable') +
      card('Checkout conversion', c.available ? pct(sub.checkoutConversionRate) : '<span class="ad-missing">—</span>', c.available ? fmt(c.uniquePayingUsers) + ' of ' + fmt(c.uniqueUsers) + ' people who opened checkout paid' : 'Stripe unavailable') +
      '</div><div class="ad-grid-2" style="margin-top:12px"><div class="ad-card"><h3>Subscribers by plan (current)</h3>' +
      bars(['starter', 'creator', 'professional'].map(function (p) { return { p: p, n: (sub.byPlan || {})[p] || 0 }; }), function (r) { return r.p.charAt(0).toUpperCase() + r.p.slice(1); }, 'n') +
      '</div><div class="ad-card"><h3>Checkout (Stripe sessions in range)</h3>' + (c.available ? table([
        { k: 'Checkout sessions opened', v: c.sessions }, { k: 'People who opened checkout', v: c.uniqueUsers }, { k: 'Paid sessions', v: c.completedPaid },
        { k: 'Expired without payment', v: c.expired }, { k: 'Server events: checkout started / completed', v: (ev.checkoutStarted || 0) + ' / ' + (ev.checkoutCompleted || 0) },
        { k: 'Plan changes / scheduled cancellations / failed payments', v: (ev.changed || 0) + ' / ' + (ev.cancelScheduled || 0) + ' / ' + (ev.paymentFailed || 0) },
      ], [{ key: 'k', label: 'Metric' }, { key: 'v', label: 'Count' }]) : '<div class="ad-missing">Stripe unavailable</div>') +
      '<div class="ad-note">Sessions are not people: one person can open checkout several times.</div></div></div></div>';

    var steps = fun.steps, first = steps[0].value || 0;
    var funnel = '<div class="ad-section"><h2>Conversion funnel <span class="ad-pill">Cohort: signups in this range</span></h2><div class="ad-card"><div class="ad-funnel">' +
      (fun.visitors != null ? '<div class="ad-fstep"><div class="lbl">Visitors<small>Website, same range (separate population)</small></div><div class="ad-fbar"><div style="width:100%;background:#2a2a2a"></div></div><div class="ad-fval"><b>' + fmt(fun.visitors) + '</b><small>' + (fun.visitorsToSignups != null ? pct(fun.visitorsToSignups) + ' signed up (ratio, estimate)' : '') + '</small></div></div>' : '') +
      steps.map(function (st, i) {
        var base = i === 0 ? null : (st.base != null ? st.base : steps[i - 1].value);
        var r = i === 0 ? null : (base ? Math.round(st.value / base * 1000) / 10 : null);
        return '<div class="ad-fstep"><div class="lbl">' + esc(st.label) + (st.note ? '<small>' + esc(st.note) + '</small>' : '') + '</div><div class="ad-fbar"><div style="width:' + (first ? Math.max(1, Math.round(st.value / first * 100)) : 0) + '%"></div></div><div class="ad-fval"><b>' + fmt(st.value) + '</b><small>' + (i === 0 ? 'accounts' : (r == null ? '—' : pct(r)) + ' of previous step') + '</small></div></div>';
      }).join('') +
      '</div><div class="ad-note">Every step follows the same accounts (created in the range), so percentages compare like with like. Paid = currently on a paid plan or billed by Stripe.</div></div></div>';

    var system = '<div class="ad-section"><h2>Data sources</h2><div class="ad-sys">' +
      card('Website statistics', tr.pageviewsSince ? '<span class="ad-pill ok">Collecting</span>' : '<span class="ad-pill warn">No data yet</span>', tr.pageviewsSince ? 'Since ' + esc(day(tr.pageviewsSince)) : 'Page views appear after the first visit is recorded') +
      card('Stripe webhook', sys.stripeWebhook && sys.stripeWebhook.lastEventAt ? '<span class="ad-pill ok">Receiving</span>' : '<span class="ad-pill bad">No events received</span>', sys.stripeWebhook && sys.stripeWebhook.lastEventAt ? 'Last event ' + esc(day(sys.stripeWebhook.lastEventAt)) + ' (' + esc(sys.stripeWebhook.lastStatus) + ')' : 'Check the endpoint URL and events in Stripe → Developers → Webhooks') +
      card('Signup attribution', tr.attributionSince ? '<span class="ad-pill ok">Recording</span>' : '<span class="ad-pill warn">No attributed signups yet</span>', fmt(tr.cohortWithAttribution) + ' of ' + fmt(reg.signups) + ' signups in range have a source') +
      '</div></div>';

    root.innerHTML = top + funnel + site + regs + acti + subs + system;
  }

  async function load() {
    var tok = await token();
    if (!tok) return gate('Sign in first', 'Owner analytics is only available to the OrivenAI owner. Sign in with the owner account, then come back to this page.', { href: '/login', label: 'Sign in' });
    var me = await api('/api/admin/me', tok);
    if (me.status !== 200 || !me.body || me.body.admin !== true) return gate('Not authorized', 'This page is only for the OrivenAI owner.', { href: '/app', label: 'Back to OrivenAI' });
    var q = state.from && state.to ? '?from=' + encodeURIComponent(state.from) + '&to=' + encodeURIComponent(state.to) : '?days=' + state.days;
    if (!state.data) root.innerHTML = '<div class="ad-gate"><h1>Loading analytics…</h1></div>';
    var r = await api('/api/admin/analytics' + q, tok);
    if (r.status !== 200) {
      var msg = (r.body && r.body.error) || 'Could not load analytics.';
      if (state.data) { render(); root.insertAdjacentHTML('beforeend', '<div class="ad-err" role="alert">' + esc(msg) + '</div>'); return; }
      return gate('Could not load analytics', msg);
    }
    state.data = r.body;
    render();
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-days]'); if (!b) return;
    state.days = b.getAttribute('data-days'); state.from = state.to = null; load();
  });
  root.addEventListener('submit', function (e) {
    if (e.target.id !== 'adCustom') return;
    e.preventDefault();
    var f = new FormData(e.target); state.from = f.get('from'); state.to = f.get('to'); state.days = null; load();
  });
  // Hover read-out for the daily charts (value for the nearest day).
  root.addEventListener('mousemove', function (e) {
    var rect = e.target.getAttribute && e.target.getAttribute('data-hover') && e.target;
    if (!rect) { tip.style.display = 'none'; return; }
    var svg = rect.ownerSVGElement, key = svg.getAttribute('data-key'), label = svg.getAttribute('data-label');
    var src = key === 'visitors' ? state.data.website.daily : state.data.registrations.daily;
    var bb = rect.getBoundingClientRect(), i = Math.round((e.clientX - bb.left) / bb.width * (src.length - 1));
    var p = src[Math.max(0, Math.min(src.length - 1, i))]; if (!p) return;
    tip.textContent = p.day + ' · ' + label + ': ' + fmt(p[key]);
    tip.style.display = 'block'; tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY + 12) + 'px';
  });
  root.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  load();
})();
