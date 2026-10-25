/* ════════════════════════════════════════════════════════════════
   OrivenAI email campaigns (/admin/campaigns/). Preview, audience counts,
   test send, results and the gated real send. The server is the only
   security boundary (ADMIN_USER_IDS, EMAIL_MODE, MARKETING_CAMPAIGN_APPROVED);
   this page renders and asks for explicit confirmation.
   ════════════════════════════════════════════════════════════════ */
(function () {
  var root = document.getElementById('cpRoot');
  var st = { tok: null, info: null, id: null, preview: null, audience: null, results: null, out: '', busy: false };
  var REASONS = { not_free: 'Not on Free', invalid_email: 'No valid email address', unverified_email: 'Email not verified', no_consent: 'No marketing consent recorded', consent_not_covering: 'Consent wording doesn’t cover offers (signup or before 10 Oct)', opted_out: 'Unsubscribed / opted out', suppressed: 'Bounced or complained', already_sent: 'Already received this campaign', recent_marketing: 'Other marketing email in the last 3 days' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function gate(title, text, link) { root.innerHTML = '<div class="ad-gate"><h1>' + esc(title) + '</h1><p>' + esc(text) + '</p>' + (link ? '<a class="ad-btn" href="' + link.href + '">' + esc(link.label) + '</a>' : '') + '</div>'; }
  async function token() {
    try {
      var r = await Promise.race([SB.auth.getSession(), new Promise(function (res) { setTimeout(function () { res('timeout'); }, 5000); })]);
      if (r === 'timeout') return (typeof _apiToken === 'string' && _apiToken) || null;
      return r && r.data && r.data.session ? r.data.session.access_token : null;
    } catch (_) { return null; }
  }
  async function api(path, body) {
    var r = await fetch(API_BASE_URL + path, { method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: Object.assign({ Authorization: 'Bearer ' + st.tok }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    var j = null; try { j = await r.json(); } catch (_) {}
    return { status: r.status, body: j };
  }
  function rows(obj) { return Object.keys(obj || {}).map(function (k) { return '<div class="cp-row"><span>' + esc(REASONS[k] || k) + '</span><b>' + esc(obj[k]) + '</b></div>'; }).join(''); }

  function render() {
    var c = (st.info.campaigns || []).filter(function (x) { return x.id === st.id; })[0];
    var a = st.audience, r = st.results, mode = st.info.mode;
    var canSend = !!(a && c && (mode === 'test' || (mode === 'live' && c.approved)));
    root.innerHTML =
      '<div class="ad-top"><a class="ad-brand" href="/admin/"><img src="/assets/orivenlogo.png" alt="">OrivenAI <small>Email campaigns</small></a>' +
      '<span class="cp-badge' + (mode === 'live' ? ' live' : '') + '">EMAIL_MODE: ' + esc(mode) + '</span></div>' +
      '<div class="cp-grid"><div class="cp-col">' +
        '<div class="ad-card"><h3>Campaign</h3><p style="margin:0 0 4px;font-weight:600">' + esc(c ? c.name : st.id) + '</p><p class="cp-note">' + esc(st.id) + ' · real send ' + (c && c.approved ? 'approved on the server' : 'not approved on the server (MARKETING_CAMPAIGN_APPROVED)') + '</p></div>' +
        '<div class="ad-card"><h3>Audience (counts only)</h3>' + (a ? '<div class="cp-row"><span>Free accounts</span><b>' + esc(a.freeAccounts) + '</b></div><div class="cp-row"><span><strong>Eligible</strong></span><b>' + esc(a.eligible) + '</b></div>' + rows(a.excluded) +
          (Object.keys(a.consentSources || {}).length ? '<p class="cp-note">Consent given at: ' + esc(Object.keys(a.consentSources).map(function (k) { return k + ' ' + a.consentSources[k]; }).join(' · ')) + '</p>' : '') + (a.note ? '<p class="cp-note">' + esc(a.note) + '</p>' : '') : '<p class="cp-note">Loading…</p>') +
          '<div class="cp-actions" style="margin-top:10px"><button class="cp-btn" id="cpRefresh">Refresh counts</button></div></div>' +
        '<div class="ad-card"><h3>Test send</h3><p class="cp-note">Goes only to the ' + esc(st.info.testRecipients) + ' address(es) in EMAIL_TEST_ALLOWLIST. Never to customers.</p><div class="cp-actions" style="margin-top:10px"><button class="cp-btn" id="cpTest"' + (st.busy || mode === 'off' ? ' disabled' : '') + '>Send test email</button></div></div>' +
        '<div class="ad-card"><h3>Results</h3>' + (r ? '<div class="cp-row"><span>Recorded (' + esc(r.scope) + ')</span><b>' + esc(r.total) + '</b></div>' + rows(r.byStatus) : '') + '</div>' +
        '<div class="ad-card"><h3>' + (mode === 'test' ? 'Rehearsal send (allowlisted accounts only)' : 'Real send') + '</h3>' +
          '<p class="cp-note">Type <b>' + esc(c ? c.confirm : '') + '</b> to confirm. Sends up to the batch size, to the ' + esc(a ? a.eligible : '—') + ' eligible accounts counted above; run again to continue.</p>' +
          '<input class="cp-input" id="cpConfirm" autocomplete="off" placeholder="Confirmation phrase" style="margin-top:8px">' +
          '<label class="cp-note" style="display:block;margin-top:8px">Batch size <input class="cp-input" id="cpLimit" type="number" min="1" max="200" value="50" style="width:90px;display:inline-block"></label>' +
          '<div class="cp-actions" style="margin-top:10px"><button class="cp-btn primary" id="cpSend"' + (canSend && !st.busy ? '' : ' disabled') + '>Send</button></div></div>' +
        (st.out ? '<div class="ad-card"><h3>Last response</h3><pre class="cp-out">' + esc(st.out) + '</pre></div>' : '') +
      '</div><div class="cp-col"><div class="ad-card"><h3>Preview' + (st.preview ? ' · ' + esc(st.preview.subject) : '') + '</h3><iframe class="cp-frame" id="cpFrame" title="Email preview" sandbox=""></iframe>' +
        (st.preview ? '<p class="cp-note">Button links to ' + esc(st.preview.ctaUrl) + '</p>' : '') + '</div></div></div>';
    var f = document.getElementById('cpFrame'); if (f && st.preview) f.srcdoc = st.preview.html;
    document.getElementById('cpRefresh').onclick = function () { load(); };
    document.getElementById('cpTest').onclick = test;
    document.getElementById('cpSend').onclick = send;
  }

  async function load() {
    var p = await api('/api/admin/campaigns/' + encodeURIComponent(st.id) + '/preview');
    var a = await api('/api/admin/campaigns/' + encodeURIComponent(st.id) + '/audience');
    var r = await api('/api/admin/campaigns/' + encodeURIComponent(st.id) + '/results');
    st.preview = p.status === 200 ? p.body : null; st.audience = a.status === 200 ? a.body : null; st.results = r.status === 200 ? r.body : null;
    if (a.status !== 200) st.out = 'Audience: ' + ((a.body && a.body.error) || a.status);
    render();
  }
  async function test() {
    st.busy = true; render();
    var r = await api('/api/admin/campaigns/' + encodeURIComponent(st.id) + '/test', {});
    st.busy = false; st.out = JSON.stringify(r.body, null, 2); render();
  }
  async function send() {
    var phrase = (document.getElementById('cpConfirm').value || '').trim();
    var limit = Number(document.getElementById('cpLimit').value) || 50;
    if (!st.audience) return;
    if (!window.confirm('Send "' + st.id + '" to up to ' + Math.min(limit, st.audience.eligible) + ' of ' + st.audience.eligible + ' eligible accounts (EMAIL_MODE ' + st.info.mode + ')?')) return;
    st.busy = true; render();
    var r = await api('/api/admin/campaigns/' + encodeURIComponent(st.id) + '/send', { confirm: phrase, expectedEligible: st.audience.eligible, limit: limit });
    st.busy = false; st.out = JSON.stringify(r.body, null, 2);
    await load();
  }

  (async function start() {
    st.tok = await token();
    if (!st.tok) return gate('Sign in first', 'Sign in with the owner account, then come back to this page.', { href: '/login', label: 'Sign in' });
    var i = await api('/api/admin/campaigns');
    if (i.status === 401) return gate('Sign in first', 'Sign in with the owner account, then come back to this page.', { href: '/login', label: 'Sign in' });
    if (i.status === 403) return gate('Not authorized', 'This page is only for the OrivenAI team.', { href: '/app', label: 'Back to OrivenAI' });
    if (i.status !== 200 || !i.body || !(i.body.campaigns || []).length) return gate('Could not load campaigns', (i.body && i.body.error) || 'Try again.');
    st.info = i.body; st.id = i.body.campaigns[0].id;
    root.innerHTML = '<div class="ad-gate"><h1>Loading campaign…</h1></div>';
    await load();
  })();
})();
