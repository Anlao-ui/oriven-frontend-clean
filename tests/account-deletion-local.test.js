// After account deletion the browser keeps nothing of the account
// (js/settings.js _orvClearLocalAccountData). Runs the real function against
// fake localStorage/sessionStorage. No browser, no network.
// Run: node tests/account-deletion-local.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
function check(name, ok, info) { if (ok) { passed++; console.log('  PASS', name); } else { failed++; console.log('  FAIL', name, info === undefined ? '' : JSON.stringify(info)); } }

function fakeStore(init) {
  const m = new Map(Object.entries(init));
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] || null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _keys: () => [...m.keys()].sort() };
}

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'settings.js'), 'utf8');
const start = src.indexOf('var ORV_KEEP_AFTER_DELETE');
const end = src.indexOf('async function confirmDeleteAccount(');
check('helper found before confirmDeleteAccount', start > 0 && end > start);
const local = fakeStore({
  oriven_settings: '{"lang":"nl"}', oriven_brief: 'x', oriven_selected_plan: '{"id":"monthly"}', orv_create_draft_v2: 'draft', _orv_autopilot_settings: '{}', _prfPlatform: 'meta',
  'sb-abc-auth-token': 'session', orv_consent_v1: '{"ads":false}', orv_display_currency: 'USD', orv_fx_rates_v1: '{}', unrelated_site_key: 'keep',
});
const session = fakeStore({ orv_first_touch_v1: '{}', oriven_post_payment_return: '1', other: 'keep' });
const ctx = { window: { localStorage: local, sessionStorage: session } };
vm.createContext(ctx);
vm.runInContext(src.slice(start, end) + '\n_orvClearLocalAccountData();', ctx);

check('account data removed from localStorage', JSON.stringify(local._keys()) === JSON.stringify(['orv_consent_v1', 'orv_display_currency', 'orv_fx_rates_v1', 'unrelated_site_key']), local._keys());
check('session data removed from sessionStorage', JSON.stringify(session._keys()) === JSON.stringify(['other']), session._keys());
check('called after a successful delete, before leaving the page', /signOut\(\); \} catch\(_\)\{\}\s*\n\s*_orvClearLocalAccountData\(\);\s*\n\s*window\.location\.href = "\/";/.test(src));
check('not called when the delete fails', src.slice(src.indexOf('async function confirmDeleteAccount('), src.indexOf('toast("Account deleted.")')).indexOf('_orvClearLocalAccountData') === -1);

console.log(`\n${passed + failed} checks run: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
