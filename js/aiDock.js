/* ════════════════════════════════════════════════════════════════
   The assistant launcher (#orvAiFab) can be tucked away.

   Expanded: the launcher in the bottom-right corner with a small chevron
   (#orvAiTuck) beside it. Collapsed: the launcher slides out to the right
   and only the chevron stays in the corner (never off-screen); clicking it
   brings the launcher back. The choice is remembered in this browser, so
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { apply(read()); wrapOpen(); }); else wrapOpen();
  window.addEventListener('load', function () { apply(read()); wrapOpen(); });
  window.orvAiDock = { tuck: function () { set(true); }, show: function () { set(false); }, isTucked: function () { return root.classList.contains('orv-ai-tucked'); } };
})();
