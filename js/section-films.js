/* ════════════════════════════════════════════════════════════════
   "Watch overview" on the first page of each of the six sections, opening
   that section's short film (assets/films/sections/<key>.mp4, recorded in
   the real app with a sample business) in the shared player (js/ow-ui.js).
   A small button under the page title: never autoplays, never in the way.
   The pages render their own headers, so the button is (re)attached when a
   page becomes active.
   ════════════════════════════════════════════════════════════════ */
(function () {
  if (window.orvSectionFilms) return;
  var FILMS = {
    dashboard:       ['control-center', 'Control Center'],
    research:        ['research', 'Research'],
    create:          ['create', 'Create'],
    adstudio:        ['launch', 'Launch'],
    overview:        ['campaigns', 'Campaigns'],
    'auto-overview': ['automations', 'Automations'],
  };
  function attach() {
    var v = window.orvAppNav && typeof window.orvAppNav.view === 'function' ? window.orvAppNav.view() : null;
    var f = v && FILMS[v]; if (!f) return;
    // Campaigns' title is in the shared Campaigns header, outside the page.
    var page = v === 'overview' ? document.getElementById('orvHubTabsCampaigns') : document.querySelector('.page.active'); if (!page) return;
    var h1 = Array.prototype.filter.call(page.querySelectorAll('h1'), function (h) { return h.offsetParent !== null; })[0];
    if (!h1 || page.querySelector('[data-orv-film="' + f[0] + '"]')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ow-watch orv-film-btn';
    b.setAttribute('data-orv-film', f[0]);
    b.setAttribute('data-ow-video', 'assets/films/sections/' + f[0] + '.mp4');
    b.setAttribute('data-ow-poster', 'assets/films/sections/' + f[0] + '.jpg');
    b.setAttribute('data-ow-captions', 'assets/films/sections/' + f[0] + '.vtt');
    b.setAttribute('data-ow-title', f[1] + ': a short tour');
    b.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 3v10l8-5z"/></svg>Watch overview';
    h1.insertAdjacentElement('afterend', b);
  }
  var raf = 0;
  function schedule() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; attach(); }); }
  function start() {
    // The whole document: some sections render outside the main column. One check per frame at most.
    new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.orvSectionFilms = { attach: attach, films: FILMS };
})();
