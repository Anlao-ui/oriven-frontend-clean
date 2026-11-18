/* ════════════════════════════════════════════════════════════════
   The assistant launcher (#orvAiFab) can be tucked away.

   One panel (#orvAiDock) in the bottom-right corner: the arrow (#orvAiTuck)
   attached to its left side, the launcher next to it. Collapsed, the whole
   panel, arrow included, slides right until only the arrow shows against
   the screen edge; clicking it slides everything back. The choice is remembered in this browser, so
   it survives page changes and reloads. Opening the assistant from
   anywhere else (a link, a shortcut) brings the launcher back too.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var KEY = 'orv_ai_tucked', root = document.documentElement;
  function read() { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } }
  function write(v) { try { if (v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (_) {} }
  function names() {
    var label = document.querySelector('#orvAiFab .orv-ai-fab-label, #orvAiFab .orv-agent-fab-name');
    return (label && label.textContent.trim()) || 'your assistant';
  }
  function apply(tucked) {
    root.classList.toggle('orv-ai-tucked', tucked);
    var btn = document.getElementById('orvAiTuck'), fab = document.getElementById('orvAiFab');
    if (btn) {
      var n = names(), label = tucked ? 'Show ' + n : 'Hide ' + n;
      btn.setAttribute('aria-expanded', tucked ? 'false' : 'true');
      btn.setAttribute('aria-label', label); btn.title = label;
    }
    if (fab) { fab.tabIndex = tucked ? -1 : 0; fab.setAttribute('aria-hidden', tucked ? 'true' : 'false'); }
  }
  function set(tucked) { write(tucked); apply(tucked); }
  // The panel (#orvAiDock) draws the border in the chosen assistant's colour, which
  // js/orivenAgent.js sets on the launcher: copy it over, and keep it in sync.
  function syncColour() {
    var fab = document.getElementById('orvAiFab'), dock = document.getElementById('orvAiDock'); if (!fab || !dock) return;
    var rgb = fab.style.getPropertyValue('--orv-agent-rgb');
    if (rgb) dock.style.setProperty('--orv-agent-rgb', rgb); else dock.style.removeProperty('--orv-agent-rgb');
  }
  function watchColour() {
    var fab = document.getElementById('orvAiFab'); if (!fab || fab._dockWatch) return;
    fab._dockWatch = true; syncColour();
    new MutationObserver(syncColour).observe(fab, { attributes: true, attributeFilter: ['style'] });
  }
  apply(read());
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#orvAiTuck')) { e.preventDefault(); set(!root.classList.contains('orv-ai-tucked')); }
  });
  // Opening the assistant some other way shows the launcher again.
  var wrapOpen = function () {
    var f = window.orvToggleAi; if (typeof f !== 'function' || f._dock) return;
    var w = function () { if (root.classList.contains('orv-ai-tucked')) set(false); return f.apply(this, arguments); };
    w._dock = true; window.orvToggleAi = w;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { apply(read()); wrapOpen(); watchColour(); }); else { wrapOpen(); watchColour(); }
  window.addEventListener('load', function () { apply(read()); wrapOpen(); watchColour(); });
  window.orvAiDock = { tuck: function () { set(true); }, show: function () { set(false); }, isTucked: function () { return root.classList.contains('orv-ai-tucked'); } };
})();
