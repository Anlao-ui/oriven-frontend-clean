/* ════════════════════════════════════════════════════════════════
   OrivenAI Priority Support inbox (/admin/support/). Signed-in session from
   Supabase (js/supabase.js); the server decides who is an admin
   (ADMIN_USER_IDS) and is the only security boundary — this page renders.
   Replies are stored in the customer's thread and the customer is emailed
   that a reply is waiting (server: _notifySupportReply).
   ════════════════════════════════════════════════════════════════ */
(function () {
  var root = document.getElementById('spRoot');
  var tip = document.getElementById('spTip');
  var state = { tok: null, threads: [], current: null, thread: null, sending: false };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function when(iso) { return iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; }
  function say(t) { tip.textContent = t; tip.style.display = 'block'; tip.style.position = 'fixed'; tip.style.left = '16px'; tip.style.bottom = '16px'; clearTimeout(say._t); say._t = setTimeout(function () { tip.style.display = 'none'; }, 4000); }
  function gate(title, text, link) {
    root.innerHTML = '<div class="ad-gate"><h1>' + esc(title) + '</h1><p>' + esc(text) + '</p>' + (link ? '<a class="ad-btn" href="' + link.href + '">' + esc(link.label) + '</a>' : '') + '</div>';
  }
  async function token() {
    try {
      var r = await Promise.race([SB.auth.getSession(), new Promise(function (res) { setTimeout(function () { res('timeout'); }, 5000); })]);
      if (r === 'timeout') return (typeof _apiToken === 'string' && _apiToken) || null;
      return r && r.data && r.data.session ? r.data.session.access_token : null;
    } catch (_) { return null; }
  }
  async function api(path, opts) {
    opts = opts || {};
    var r = await fetch(API_BASE_URL + path, { method: opts.method || 'GET', cache: 'no-store',
      headers: Object.assign({ Authorization: 'Bearer ' + state.tok }, opts.body ? { 'Content-Type': 'application/json' } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined });
    var body = null; try { body = await r.json(); } catch (_) {}
    return { status: r.status, body: body };
  }

  var EMAIL_STATUS = { sent: 'Reply sent. The customer was emailed that a reply is waiting.', email_off: 'Reply saved. Email sending is off (EMAIL_MODE), so no email went out.',
    not_deliverable: 'Reply saved. This address can’t receive email in the current EMAIL_MODE.', suppressed: 'Reply saved. The address is on the suppression list, so no email went out.',
    no_address: 'Reply saved. The account has no email address.', already_sent: 'Reply saved.', skipped: 'Reply saved. The email was skipped.', error: 'Reply saved, but the email could not be sent.' };

  function render() {
    var list = state.threads.length ? state.threads.map(function (t) {
      return '<button type="button" class="sp-item" data-uid="' + esc(t.userId) + '" aria-current="' + (state.current === t.userId) + '">' +
        '<b>' + esc(t.email || t.userId) + (t.awaitingReply ? '<span class="sp-badge">Awaiting reply</span>' : '') + '</b>' +
        '<span>' + esc((t.plan || 'unknown plan') + ' · ' + when(t.lastAt)) + '</span><span>' + esc(t.preview) + '</span></button>';
    }).join('') : '<p class="sp-note">No support messages yet.</p>';
    var view = '<p class="sp-note">Select a conversation.</p>';
    if (state.thread) {
      var th = state.thread;
      view = '<h2 style="margin:0;font-size:18px">' + esc(th.email || th.userId) + '</h2><p class="sp-note" style="margin:4px 0 0">Plan: ' + esc(th.plan || 'unknown') +
        (th.plan !== 'professional' ? ' — this account is no longer on Professional; it can’t read new replies in the app.' : '') + '</p>' +
        '<div class="sp-thread" id="spThread">' + th.messages.map(function (m) {
          return '<div class="sp-msg ' + (m.sender === 'admin' ? 'admin' : '') + '">' + esc(m.body) + '<small>' + (m.sender === 'admin' ? 'OrivenAI team' : 'Customer') + ' · ' + esc(when(m.created_at)) + '</small></div>';
        }).join('') + '</div>' +
        '<form class="sp-reply" id="spForm"><label for="spBody" class="sp-note">Reply (the customer reads it in Settings → Subscription → Priority Support)</label>' +
        '<textarea id="spBody" maxlength="4000" required></textarea><button type="submit"' + (state.sending ? ' disabled' : '') + '>' + (state.sending ? 'Sending…' : 'Send reply') + '</button></form>';
    }
    root.innerHTML = '<div class="ad-top"><a class="ad-brand" href="/admin/"><img src="/assets/orivenlogo.png" alt="">OrivenAI <small>Priority Support</small></a>' +
      '<a class="ad-btn" href="/admin/">Analytics</a></div>' +
      '<div class="sp-grid"><div class="sp-list" aria-label="Conversations">' + list + '</div><div class="ad-card">' + view + '</div></div>';
    root.querySelectorAll('.sp-item').forEach(function (b) { b.addEventListener('click', function () { open(b.getAttribute('data-uid')); }); });
    var f = document.getElementById('spForm');
    if (f) f.addEventListener('submit', function (e) { e.preventDefault(); reply(); });
    var t = document.getElementById('spThread'); if (t) t.scrollTop = t.scrollHeight;
  }

  async function loadThreads() {
    var r = await api('/api/support/admin/threads');
    if (r.status === 401) return gate('Sign in first', 'Sign in with the owner account, then come back to this page.', { href: '/login', label: 'Sign in' }), false;
    if (r.status === 403) return gate('Not authorized', 'This page is only for the OrivenAI team.', { href: '/app', label: 'Back to OrivenAI' }), false;
    if (r.status !== 200 || !r.body) return gate('Could not load conversations', (r.body && r.body.error) || 'Try again.'), false;
    state.threads = r.body.threads || [];
    return true;
  }
  async function open(uid) {
    state.current = uid;
    var r = await api('/api/support/admin/threads/' + encodeURIComponent(uid));
    if (r.status !== 200 || !r.body) { say((r.body && r.body.error) || 'Could not load this conversation.'); return; }
    state.thread = r.body;
    render();
  }
  async function reply() {
    var ta = document.getElementById('spBody');
    var body = ta ? ta.value.trim() : '';
    if (!body || state.sending || !state.thread) return;
    state.sending = true; render();
    try {
      var r = await api('/api/support/admin-reply', { method: 'POST', body: { userId: state.thread.userId, body: body } });
      if (r.status !== 200 || !r.body || !r.body.ok) { say((r.body && r.body.error) || 'Could not send the reply.'); state.sending = false; render(); var ta2 = document.getElementById('spBody'); if (ta2) ta2.value = body; return; }
      say(EMAIL_STATUS[r.body.email] || 'Reply saved.');
      state.sending = false;
      await loadThreads();
      await open(state.thread.userId);
    } catch (_) { state.sending = false; render(); say('Could not reach the server. Try again.'); }
  }

  (async function start() {
    state.tok = await token();
    if (!state.tok) return gate('Sign in first', 'Sign in with the owner account, then come back to this page.', { href: '/login', label: 'Sign in' });
    if (await loadThreads()) render();
  })();
})();
