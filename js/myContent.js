/* ════════════════════════════════════════════════════════════════
   OrivenAI — Create → My Content (#page-my-content)

   The account's own library of what Create made. Reads the existing asset
   library: every generator route records its result in creative_assets
   (server.js _recordCreativeAsset — images are copied into OrivenAI's own
   storage, videos once they finish), served per account by
   GET /api/creative/assets (owner only, saved research excluded).

   Actions are the ones that route supports: open, download (stored files),
   copy text, favourite (PATCH) and delete (DELETE, own records only).
   A video recorded while still rendering gets its link from the existing
   status route the first time My Content sees it.
   Prefix: mcl-.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(path, opts) {
    if (typeof window.apiFetch !== 'function') return Promise.resolve({ ok: false, status: 0, data: null });
    return window.apiFetch(path, opts || {}).then(function (r) { return r || { ok: false, status: 0, data: null }; }, function () { return { ok: false, status: 0, data: null }; });
  }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : null; }
  function day(iso) { var d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function toast(m, k) { if (typeof window.orvToast === 'function') window.orvToast(m, k || 'ok'); }
  // Text of a generated page; block ends become spaces so words don't run together.
  function strip(html) { var d = document.createElement('div'); d.innerHTML = String(html || '').replace(/<(br|\/p|\/h[1-6]|\/li|\/div|\/td)\b[^>]*>/gi, function (m) { return m + ' '; }); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }

  // ── What a record is (from what the generator stored) ─────────────
  var TYPES = [['image', 'Images'], ['video', 'Videos'], ['ad', 'Ad creatives'], ['copy', 'Copy'], ['page', 'Pages & documents']];
  var LABEL = { image: 'Image', video: 'Video', ad: 'Ad creative', copy: 'Copy', page: 'Page', other: 'Content' };
  var IMAGE_ROUTES = ['/api/generate-image', '/api/product-shoots/generate', '/api/generate-logo'];
  function typeOf(a) {
    var c = a.content || {}, k = a.kind || '', src = a.source_route || '';
    if (k === 'video' || k === 'manual_video') return 'video';
    if (k === 'ad') return 'ad';
    if (k === 'manual_image' || k === 'logo' || IMAGE_ROUTES.indexOf(src) >= 0) return c.url ? 'image' : 'other';
    if (['landing_page', 'deck', 'poster', 'infographic'].indexOf(k) >= 0) return 'page';
    if (k === 'email' || c.text || c.result || c.variations) return 'copy';
    return 'other';
  }
  function mediaUrl(a) { var c = a.content || {}; return safeUrl(c.url) || safeUrl(c.imageUrl) || null; }
  // The copy a record carries, for previews, search and "Copy text".
  function adParts(c) {
    var m = c.metaAds || {}, g = c.googleAds || {}, t = c.tiktokAds || {}, p = c.pinterestAds || {};
    var v = (Array.isArray(c.variants) && c.variants[0]) || (Array.isArray(c.variations) && c.variations[0]) || {};
    var vc = v.adCopy || {};
    var heads = [].concat(c.headline || [], m.headline || [], g.headlines || [], p.title || [], t.hook || [], vc.headline || [], v.headline || []).filter(Boolean);
    var bodies = [].concat(c.body || [], m.primaryText || [], g.descriptions || [], p.description || [], t.script || [], vc.primaryText || [], v.body || []).filter(Boolean);
    return { head: heads, body: bodies, cta: c.cta || m.cta || p.cta || vc.cta || v.cta || '', image: safeUrl(c.imageUrl) || safeUrl(v.imageUrl) || null };
  }
  function textOf(a) {
    var c = a.content || {}, t = typeOf(a);
    if (t === 'ad') { var p = adParts(c); return p.head.concat(p.body).concat(p.cta ? [p.cta] : []).join('\n'); }
    if (c.text) return String(c.text);
    if (c.result) return typeof c.result === 'string' ? c.result : JSON.stringify(c.result);
    if (Array.isArray(c.variations)) return c.variations.map(function (x) { return typeof x === 'string' ? x : (x && (x.text || x.headline || x.body)) || ''; }).filter(Boolean).join('\n\n');
    if (c.html) return strip(c.html);
    if (Array.isArray(c.slides)) return c.slides.map(function (s) { return [s.title, s.body || s.content].filter(Boolean).join(' — '); }).join('\n');
    if (c.script) return String(c.script);
    if (c.prompt) return String(c.prompt);
    return '';
  }

  var S = { items: null, err: false, q: '', type: 'all', fav: false, sort: 'new', open: null, tok: 0, uid: null, resolving: {} };

  function mount() {
    var mc = document.querySelector('.mc');
    if (!mc || document.getElementById('page-my-content')) return;
    var pg = document.createElement('div');
    pg.className = 'page'; pg.id = 'page-my-content';
    pg.innerHTML = '<div class="onv-panel mcl-page"><div class="mcl" id="mclRoot" aria-live="polite"></div><div class="mcl-modal" id="mclModal" hidden></div></div>';
    mc.appendChild(pg);
    pg.addEventListener('click', onClick);
    pg.addEventListener('input', function (e) { if (e.target.id === 'mclSearch') { S.q = e.target.value; paintGrid(); } });
    pg.addEventListener('change', function (e) { if (e.target.id === 'mclSort') { S.sort = e.target.value; paintGrid(); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.open) closeDetail(); });
  }
  function open() {
    mount();
    var uid = typeof _currentUser !== 'undefined' && _currentUser ? _currentUser.id : null;
    if (uid !== S.uid) { S.uid = uid; S.items = null; S.q = ''; S.type = 'all'; S.fav = false; S.resolving = {}; }
    closeDetail();
    if (typeof window._orvNav === 'function') window._orvNav('mycontent', 'page-my-content');
    else { document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); }); document.getElementById('page-my-content').classList.add('active'); }
    render(); load();
    if (window.orvAppNavSync) window.orvAppNavSync();
  }
  function load() {
    var t = ++S.tok;
    api('/api/creative/assets').then(function (r) {
      if (t !== S.tok) return;
      if (r.ok && r.data) { S.items = (r.data.assets || []).filter(function (a) { return a && a.kind !== 'research'; }); S.err = false; resolveVideos(); }
      else S.err = true;
      render();
    });
  }
  // Videos recorded while rendering: ask the existing status route once
  // (it stores the finished file and writes the link onto the record).
  function resolveVideos() {
    (S.items || []).filter(function (a) { return typeOf(a) === 'video' && !mediaUrl(a) && a.content && a.content.generationId && !S.resolving[a.id]; }).slice(0, 4).forEach(function (a) {
      S.resolving[a.id] = true;
      var base = a.source_route === '/api/motion-graphics/generate' ? '/api/motion-graphics/status/' : '/api/video-ads/status/';
      api(base + encodeURIComponent(a.content.generationId)).then(function (r) {
        var d = r.ok && r.data;
        if (!d) return;
        a._state = d.status === 'failed' ? 'failed' : d.status === 'completed' ? 'ready' : 'processing';
        if (d.status === 'completed' && safeUrl(d.videoUrl)) a.content = Object.assign({}, a.content, { url: d.videoUrl });
        paintGrid(); if (S.open && S.open.id === a.id) paintDetail();
      });
    });
  }

  // ── Rendering ───────────────────────────────────────────────────
  function render() {
    var root = document.getElementById('mclRoot'); if (!root) return;
    var head = '<header class="mcl-head"><div><h1>My Content</h1><p>Everything you’ve made in Create — images, videos, ad creatives and copy — saved to your account.</p></div>' +
      '<button type="button" class="onv-btn onv-btn--primary" data-mcl="create">Create something</button></header>';
    if (S.items === null && !S.err) { root.innerHTML = head + '<p class="mcl-muted">Loading your content…</p>'; return; }
    if (S.err && !S.items) { root.innerHTML = head + '<div class="mcl-empty" data-state="error"><p>Your content couldn’t load.</p><button type="button" class="onv-btn" data-mcl="retry">Try again</button></div>'; return; }
    if (!S.items.length) {
      root.innerHTML = head + '<section class="mcl-empty" data-state="empty"><div class="mcl-empty__mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M3.5 15l4.5-4 4 3.5 3-2.5 5.5 4.5"/><circle cx="15.5" cy="9.5" r="1.5"/></svg></div>' +
        '<h2>Nothing here yet</h2><p>Images, videos, ad creatives and copy you make in Create are saved here automatically, so you can find, download and reuse them later.</p>' +
        '<button type="button" class="onv-btn onv-btn--primary" data-mcl="create">Go to Create</button></section>';
      return;
    }
    var present = TYPES.filter(function (t) { return S.items.some(function (a) { return typeOf(a) === t[0]; }); });
    var favs = S.items.some(function (a) { return a.favorite; });
    root.innerHTML = head +
      '<div class="mcl-bar">' +
        '<div class="mcl-chips" role="group" aria-label="Filter by type"><button type="button" class="mcl-chip' + (S.type === 'all' ? ' is-on' : '') + '" aria-pressed="' + (S.type === 'all') + '" data-mcl="type" data-type="all">All<span>' + S.items.length + '</span></button>' +
          present.map(function (t) { var n = S.items.filter(function (a) { return typeOf(a) === t[0]; }).length; return '<button type="button" class="mcl-chip' + (S.type === t[0] ? ' is-on' : '') + '" aria-pressed="' + (S.type === t[0]) + '" data-mcl="type" data-type="' + t[0] + '">' + esc(t[1]) + '<span>' + n + '</span></button>'; }).join('') +
          (favs ? '<button type="button" class="mcl-chip' + (S.fav ? ' is-on' : '') + '" aria-pressed="' + S.fav + '" data-mcl="fav">Favourites</button>' : '') + '</div>' +
        '<div class="mcl-tools"><label class="mcl-sr" for="mclSearch">Search your content</label><input id="mclSearch" class="mcl-search" type="search" placeholder="Search titles, products and text" value="' + esc(S.q) + '">' +
          '<label class="mcl-sr" for="mclSort">Sort</label><select id="mclSort" class="mcl-sort"><option value="new"' + (S.sort === 'new' ? ' selected' : '') + '>Newest first</option><option value="old"' + (S.sort === 'old' ? ' selected' : '') + '>Oldest first</option></select></div>' +
      '</div><div id="mclGrid"></div>';
    paintGrid();
  }
  function filtered() {
    var q = S.q.trim().toLowerCase();
    var list = S.items.filter(function (a) {
      if (S.type !== 'all' && typeOf(a) !== S.type) return false;
      if (S.fav && !a.favorite) return false;
      if (!q) return true;
      return [a.title, a.product_name, a.campaign_name, a.platform, textOf(a)].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    list.sort(function (x, y) { var d = String(x.created_at || '').localeCompare(String(y.created_at || '')); return S.sort === 'old' ? d : -d; });
    return list;
  }
  function stateOf(a) {
    var t = typeOf(a);
    if (t === 'video' && !mediaUrl(a)) return a._state === 'failed' ? ['failed', 'Video failed — not charged'] : ['processing', 'Still processing'];
    if (a.status && a.status !== 'draft') return [a.status, a.status.replace(/_/g, ' ')];
    return null;
  }
  function thumb(a) {
    var t = typeOf(a), u = mediaUrl(a);
    if (t === 'image' && u) return '<img src="' + esc(u) + '" alt="" loading="lazy" decoding="async">';
    if (t === 'video' && u) return '<video src="' + esc(u) + '#t=0.5" muted playsinline preload="metadata" aria-hidden="true"></video><span class="mcl-play" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M5 3.5v9l7.5-4.5z" fill="currentColor"/></svg></span>';
    if (t === 'video') return '<span class="mcl-ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg></span>';
    if (t === 'ad') {
      var p = adParts(a.content || {});
      return (p.image ? '<img src="' + esc(p.image) + '" alt="" loading="lazy" decoding="async">' : '') + '<span class="mcl-adtext' + (p.image ? ' has-img' : '') + '"><b>' + esc(p.head[0] || a.title || 'Ad creative') + '</b>' + (p.body[0] ? '<span>' + esc(p.body[0]) + '</span>' : '') + '</span>';
    }
    var tx = textOf(a);
    return '<span class="mcl-textthumb">' + esc(tx.slice(0, 220) || a.title || '') + '</span>';
  }
  function paintGrid() {
    var el = document.getElementById('mclGrid'); if (!el || !S.items) return;
    var list = filtered();
    if (!list.length) { el.innerHTML = '<p class="mcl-muted mcl-none">Nothing matches — try another filter or search.</p>'; return; }
    el.innerHTML = '<ul class="mcl-grid">' + list.map(function (a) {
      var t = typeOf(a), st = stateOf(a);
      var meta = [LABEL[t], a.platform ? a.platform.charAt(0).toUpperCase() + a.platform.slice(1) : null, day(a.created_at)].filter(Boolean).join(' · ');
      return '<li class="mcl-item" data-type="' + t + '"><button type="button" class="mcl-card" data-mcl="open" data-id="' + esc(a.id) + '" aria-label="Open ' + esc(a.title || LABEL[t]) + '">' +
        '<span class="mcl-thumb mcl-thumb--' + t + '">' + thumb(a) + '</span>' +
        '<span class="mcl-info"><b>' + esc(a.title || a.product_name || LABEL[t]) + '</b><span>' + esc(meta) + '</span>' + (st ? '<span class="mcl-st mcl-st--' + esc(st[0]) + '">' + esc(st[1]) + '</span>' : '') + '</span>' +
        (a.favorite ? '<span class="mcl-favmark" aria-label="Favourite">★</span>' : '') + '</button></li>';
    }).join('') + '</ul>';
  }

  // ── Detail ──────────────────────────────────────────────────────
  function openDetail(id) {
    var a = (S.items || []).filter(function (x) { return x.id === id; })[0]; if (!a) return;
    S.open = a; S.returnId = a.id;
    paintDetail();
    var m = document.getElementById('mclModal'); m.hidden = false;
    var c = m.querySelector('.mcl-close'); if (c) c.focus();
  }
  function closeDetail() {
    var m = document.getElementById('mclModal'); if (!m || m.hidden) { S.open = null; return; }
    m.hidden = true; m.innerHTML = ''; S.open = null;
    // Back to the item it was opened from (the grid may have been redrawn).
    var card = S.returnId && document.querySelector('#mclRoot .mcl-card[data-id="' + (window.CSS && CSS.escape ? CSS.escape(S.returnId) : S.returnId) + '"]');
    if (card) try { card.focus(); } catch (_) {}
    S.returnId = null;
  }
  function paintDetail() {
    var a = S.open, m = document.getElementById('mclModal'); if (!a || !m) return;
    var t = typeOf(a), u = mediaUrl(a), c = a.content || {}, tx = textOf(a), st = stateOf(a);
    var preview = '';
    if (t === 'image' && u) preview = '<img src="' + esc(u) + '" alt="' + esc(a.title || 'Generated image') + '">';
    else if (t === 'video' && u) preview = '<video src="' + esc(u) + '" controls playsinline preload="metadata"></video>';
    else if (t === 'video') preview = '<p class="mcl-muted">' + (a._state === 'failed' ? 'This video didn’t finish. Video credits are refunded when a render fails.' : 'This video is still processing. It appears here when it’s ready.') + '</p>';
    else if (t === 'ad') {
      var p = adParts(c);
      preview = (p.image ? '<img src="' + esc(p.image) + '" alt="">' : '') + '<div class="mcl-adfull">' +
        (p.head.length ? '<h3>Headlines</h3><ul>' + p.head.slice(0, 15).map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>' : '') +
        (p.body.length ? '<h3>Text</h3>' + p.body.slice(0, 6).map(function (b) { return '<p>' + esc(b) + '</p>'; }).join('') : '') +
        (p.cta ? '<p><b>Call to action:</b> ' + esc(p.cta) + '</p>' : '') + '</div>';
    } else if (c.html) preview = '<iframe class="mcl-frame" sandbox="" title="' + esc(a.title || 'Preview') + '" srcdoc="' + esc(c.html) + '"></iframe>';
    else preview = '<pre class="mcl-text">' + esc(tx) + '</pre>';
    var details = [['Type', LABEL[t]], ['Created', day(a.created_at)], ['Platform', a.platform], ['Product', a.product_name], ['Campaign', a.campaign_name]].filter(function (x) { return x[1]; });
    var canDownload = (t === 'image' || t === 'video') && u;
    m.innerHTML = '<div class="mcl-modal__scrim" data-mcl="close"></div><div class="mcl-dialog" role="dialog" aria-modal="true" aria-labelledby="mclDH">' +
      '<header class="mcl-dialog__h"><div><p class="mcl-eyebrow">' + esc(LABEL[t]) + (st ? ' · ' + esc(st[1]) : '') + '</p><h2 id="mclDH">' + esc(a.title || a.product_name || LABEL[t]) + '</h2></div>' +
        '<button type="button" class="mcl-close" data-mcl="close" aria-label="Close"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></header>' +
      '<div class="mcl-dialog__b"><div class="mcl-preview mcl-preview--' + t + '">' + preview + '</div>' +
        '<dl class="mcl-dl">' + details.map(function (d) { return '<div><dt>' + esc(d[0]) + '</dt><dd>' + esc(d[1]) + '</dd></div>'; }).join('') + '</dl></div>' +
      '<footer class="mcl-dialog__f">' +
        (canDownload ? '<button type="button" class="onv-btn onv-btn--primary" data-mcl="download">Download</button>' : '') +
        (tx && t !== 'image' && t !== 'video' ? '<button type="button" class="onv-btn" data-mcl="copy">Copy text</button>' : '') +
        '<button type="button" class="onv-btn" data-mcl="favorite" aria-pressed="' + !!a.favorite + '">' + (a.favorite ? '★ Favourite' : '☆ Add to favourites') + '</button>' +
        '<button type="button" class="onv-btn mcl-danger" data-mcl="delete">Delete</button></footer></div>';
  }

  // ── Actions (existing routes only) ──────────────────────────────
  function download(a) {
    var u = mediaUrl(a); if (!u) return;
    var ext = (u.split('?')[0].match(/\.(png|jpe?g|webp|gif|mp4|mov|webm)$/i) || [])[1] || (typeOf(a) === 'video' ? 'mp4' : 'png');
    var name = String(a.title || 'orivenai-' + typeOf(a)).replace(/[^\w\- ]+/g, '').trim().slice(0, 60).replace(/\s+/g, '-') || 'orivenai';
    fetch(u, { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.blob(); }).then(function (b) {
      var href = URL.createObjectURL(b), link = document.createElement('a');
      link.href = href; link.download = name + '.' + ext; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(href); }, 4000);
    }).catch(function () { window.open(u, '_blank', 'noopener'); }); // the file's host doesn't allow a direct download: open it
  }
  function toggleFav(a, btn) {
    btn.disabled = true;
    api('/api/creative/assets/' + encodeURIComponent(a.id), { method: 'PATCH', body: JSON.stringify({ favorite: !a.favorite }) }).then(function (r) {
      btn.disabled = false;
      if (!r.ok) { toast((r.data && r.data.error) || 'Couldn’t update that. Please try again.', 'warn'); return; }
      a.favorite = !a.favorite; paintDetail(); render();
    });
  }
  function remove(a) {
    var F = window.orvWorkspace && window.orvWorkspace.flow;
    var body = '<p>It’s removed from My Content. Campaigns that already use it keep their own copy.</p>';
    var ask = F && F.confirm ? F.confirm({ title: 'Delete this ' + LABEL[typeOf(a)].toLowerCase() + '?', body: body, confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true }) : Promise.resolve(window.confirm('Delete this item?'));
    ask.then(function (yes) {
      if (!yes) return;
      api('/api/creative/assets/' + encodeURIComponent(a.id), { method: 'DELETE' }).then(function (r) {
        if (!r.ok) { toast((r.data && r.data.error) || 'Couldn’t delete that. Please try again.', 'warn'); return; }
        S.items = S.items.filter(function (x) { return x.id !== a.id; });
        S.returnId = null; closeDetail(); render(); toast('Deleted.');
      });
    });
  }
  function onClick(e) {
    var b = e.target.closest('[data-mcl]'); if (!b) return;
    var k = b.getAttribute('data-mcl');
    if (k === 'open') return openDetail(b.getAttribute('data-id'));
    if (k === 'close') return closeDetail();
    if (k === 'type') { S.type = b.getAttribute('data-type'); render(); return; }
    if (k === 'fav') { S.fav = !S.fav; render(); return; }
    if (k === 'retry') { S.err = false; render(); load(); return; }
    if (k === 'create') { if (window.orvAppNav) window.orvAppNav.go('create'); return; }
    var a = S.open; if (!a) return;
    if (k === 'download') return download(a);
    if (k === 'copy') { var tx = textOf(a); if (navigator.clipboard) navigator.clipboard.writeText(tx).then(function () { toast('Copied.'); }, function () { toast('Couldn’t copy — select the text instead.', 'warn'); }); return; }
    if (k === 'favorite') return toggleFav(a, b);
    if (k === 'delete') return remove(a);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.orvMyContent = { open: open, reload: function () { S.items = null; load(); }, _typeOf: typeOf };
})();
