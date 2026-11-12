/* ════════════════════════════════════════════════════════════════
   "Learn OrivenAI" on the Dashboard (Control Center): six tutorials, one
   per main section, each covering every page of that section. Recorded in
   the real app with a labelled sample business (assets/films/tutorials).
   Cards open the shared player (js/ow-ui.js: captions on, no autoplay on
   load, focus trap, Esc closes). One list here, also used by
   js/section-films.js for the "Watch tutorial" button on each section.
   ════════════════════════════════════════════════════════════════ */
(function () {
  if (window.orvTutorials) return;
  var BASE = '/assets/films/tutorials/';
  // seconds: the real length of each file (ffprobe), shown on the card.
  var LIST = [
    { key: 'control-center', n: '01', name: 'Control Center', seconds: 77,
      learn: 'Read your Dashboard, follow your Marketing Plan and see what is done in Progress.',
      pages: ['Dashboard', 'Marketing Plan', 'Progress'] },
    { key: 'research', n: '02', name: 'Research', seconds: 81,
      learn: 'Ask a market question, read a sourced report, use Insights and analyse competitors.',
      pages: ['Research', 'Insights', 'Competitor Analysis'] },
    { key: 'create', n: '03', name: 'Create', seconds: 89,
      learn: 'Make an ad in six steps, compare versions in Creative Testing and reuse your content.',
      pages: ['Create', 'Creative Testing', 'My Content'] },
    { key: 'launch', n: '04', name: 'Launch', seconds: 50,
      learn: 'Prepare audiences, check each draft’s readiness and publish when you choose.',
      pages: ['Audience Builder', 'Ad Studio'] },
    { key: 'campaigns', n: '05', name: 'Campaigns', seconds: 66,
      learn: 'Follow results per platform, compare campaigns and adjust one in Campaign Builder.',
      pages: ['Campaign Overview', 'Campaign Comparison', 'Campaign Builder'] },
    { key: 'automations', n: '06', name: 'Automations', seconds: 80,
      learn: 'Schedule campaigns, write rules within your limits and check what ran in Activity.',
      pages: ['Overview', 'Scheduler', 'Rules', 'Activity'] },
  ];
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var dur = function (s) { return s ? Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0') : ''; };
  var spoken = function (s) { if (!s) return ''; var m = Math.floor(s / 60), r = Math.round(s % 60); return (m ? m + ' min ' : '') + (r ? r + ' s' : ''); };
  function attrs(t) {
    return 'data-ow-video="' + BASE + t.key + '.mp4" data-ow-poster="' + BASE + t.key + '.jpg" data-ow-captions="' + BASE + t.key + '.vtt" data-ow-title="' + esc(t.name + ' tutorial') + '"';
  }
  function card(t) {
    return '<li class="ccx-tut__item"><button type="button" class="ccx-tut" ' + attrs(t) + ' aria-label="' + esc('Play the ' + t.name + ' tutorial' + (t.seconds ? ', ' + spoken(t.seconds) : '') + ': ' + t.pages.join(', ')) + '">' +
      '<span class="ccx-tut__media"><img src="' + BASE + t.key + '-thumb.webp" alt="" width="640" height="360" loading="lazy" decoding="async" onerror="this.hidden=true">' +
      '<span class="ccx-tut__play" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M5 3.2v9.6L12.6 8z"/></svg></span>' +
      (t.seconds ? '<span class="ccx-tut__dur" aria-hidden="true">' + dur(t.seconds) + '</span>' : '') + '</span>' +
      '<span class="ccx-tut__body"><span class="ccx-tut__n" aria-hidden="true">' + t.n + '</span><span class="ccx-tut__t">' + esc(t.name) + '</span>' +
      '<span class="ccx-tut__learn">' + esc(t.learn) + '</span>' +
      '<span class="ccx-tut__pages" aria-hidden="true">' + t.pages.map(esc).join(' · ') + '</span></span></button></li>';
  }
  function render() {
    var el = document.getElementById('ccxTutorials'); if (!el || el.getAttribute('data-ready')) return;
    el.innerHTML = '<div class="ccx-card-hd"><h2 class="ccx-h" id="ccxTutH">Learn OrivenAI</h2><span class="ccx-meta">6 tutorials · recorded in the real app</span></div>' +
      '<p class="ccx-sub">One short tutorial per section, covering every page in it. Captions are on; nothing plays until you choose.</p>' +
      '<ul class="ccx-tut__grid" role="list">' + LIST.map(card).join('') + '</ul>';
    el.setAttribute('data-ready', '1');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  window.orvTutorials = { list: LIST, attrs: attrs, base: BASE, render: render, byKey: function (k) { return LIST.filter(function (t) { return t.key === k; })[0] || null; } };
})();
