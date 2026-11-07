/* ════════════════════════════════════════════════════════════════
   OrivenAI — one map from page keys to the app's navigation.

   The server names pages by neutral keys (oriven-backend
   services/pageKeys.js): the Marketing Plan's task buttons, Progress and the
   personal assistant's "open page" cards all use them. Here each key opens
   its page through the sidebar's own navigation (js/appNav.js), so the
   sidebar marks the right item too. Keep both lists in step
   (tests/agents-consistency.test.js).

   window.orvPages.open(key) → true when opened · .label(key) · .has(key)
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  function nav(id) { return function () { if (window.orvAppNav && window.orvAppNav.go) { window.orvAppNav.go(id); return true; } return false; }; }
  var PAGES = {
    'control-center':      { label: 'Control Center', open: nav('dashboard') },
    'marketing-plan':      { label: 'Marketing Plan', open: nav('plan') },
    progress:              { label: 'Progress', open: nav('progress') },
    research:              { label: 'Research', open: nav('research') },
    'competitor-analysis': { label: 'Competitor Analysis', open: nav('competitors') },
    insights:              { label: 'Insights', open: nav('insights') },
    create:                { label: 'Create', open: nav('create') },
    'creative-testing':    { label: 'Creative Testing', open: nav('testing') },
    'my-content':          { label: 'My Content', open: nav('content') },
    launch:                { label: 'Ad Studio', open: nav('adstudio') },
    'audience-builder':    { label: 'Audience Builder', open: nav('audiences') },
    campaigns:             { label: 'Campaign Overview', open: nav('overview') },
    'campaign-builder':    { label: 'Campaign Builder', open: nav('builder') },
    'campaign-comparison': { label: 'Campaign Comparison', open: nav('compare') },
    automations:           { label: 'Automations', open: nav('auto-overview') },
    settings:              { label: 'Settings', open: function () { if (typeof window.openSettingsModal === 'function') { window.openSettingsModal(); return true; } return false; } },
    'ad-platforms':        { label: 'Ad Platforms', open: function () {
      if (typeof window.bizGoTo !== 'function') return false;
      if (typeof window._orvNav === 'function') window._orvNav('businessbrain', 'page-business-brain');
      window.bizGoTo('connections'); return true;
    } },
  };
  function has(key) { return Object.prototype.hasOwnProperty.call(PAGES, key); }
  window.orvPages = {
    keys: Object.keys(PAGES),
    has: has,
    label: function (key) { return has(key) ? PAGES[key].label : ''; },
    open: function (key) { if (!has(key)) return false; try { return PAGES[key].open() !== false; } catch (_) { return false; } },
  };
})();
