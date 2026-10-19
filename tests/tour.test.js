// ════════════════════════════════════════════════════════════════
// "Discover OrivenAI" tour — static checks (no network, no browser).
//   node tests/tour.test.js
// The O in the app (js/orivenRing.js) must stay the landing page's O:
// same six paths as the hero, "Six parts. One workflow." and closing
// marks in index.html, and the same state colours. Also checks the tour's
// wiring: six real pages in workflow order, the app loads it, the old
// welcome modal is gone, the Settings entry point, and that the tour file
// makes no API calls of its own.
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const check = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? 'PASS — ' : 'FAIL — ') + name + (ok || info === undefined ? '' : ' :: ' + JSON.stringify(info).slice(0, 400))); };
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const index = read('index.html'), app = read('app.html'), tourJs = read('js/tour.js'), ringJs = read('js/orivenRing.js'), onb = read('js/onboarding.js');

console.log('\nA. The O is the landing page’s O');
const marks = [...index.matchAll(/<svg class="ov-brand-ring (ov-[a-z]+-ring)"[\s\S]*?<\/svg>/g)].map((m) => ({ name: m[1], paths: [...m[0].matchAll(/ d="([^"]+)"/g)].map((x) => x[1]) }));
const sandbox = { window: {}, document: {} };
vm.runInNewContext(ringJs, sandbox);
const Ring = sandbox.window.OrvRing;
check('landing has its three O marks (hero, system, closing)', ['ov-hero-ring', 'ov-system-ring', 'ov-closing-ring'].every((n) => marks.some((m) => m.name === n)), marks.map((m) => m.name));
check('js/orivenRing.js exposes OrvRing with six paths', !!Ring && Ring.PATHS.length === 6);
marks.forEach((m) => check(`same geometry as the landing ${m.name}`, JSON.stringify(m.paths) === JSON.stringify(Ring.PATHS)));
check('same viewBox as the landing', marks.length && index.includes('viewBox="' + Ring.VIEWBOX + '"'));
const landingScript = index.slice(index.indexOf('id="ov-landing-experience-script"'));
check('state colours match the landing story (lime / dark / neutral)', Ring.COLOR.active === '#B6FF3B' && Ring.COLOR.past === '#343a2e' && Ring.COLOR.idle === '#d9dfcf' && /'#B6FF3B'/.test(landingScript) && /'#343a2e'/.test(landingScript) && /'#d9dfcf'/.test(landingScript));
check('intro offsets match the landing story', /varvectors=\[\[\.55,-\.85\],\[1,\.1\],\[\.4,\.9\],\[-\.5,\.85\],\[-1,0\],\[-\.55,-\.85\]\]/.test(landingScript.replace(/\s/g, '')) && JSON.stringify(Ring.VECTORS) === JSON.stringify([[.55, -.85], [1, .1], [.4, .9], [-.5, .85], [-1, 0], [-.55, -.85]]));

console.log('\nB. Six real pages, in workflow order');
const tsb = { window: { matchMedia: () => ({ matches: false }), addEventListener() {} }, document: {} };
vm.runInNewContext(tourJs, tsb);
const STEPS = tsb.window.orvTour && tsb.window.orvTour.STEPS;
const nav = [...app.matchAll(/<button class="orv-ni" data-orv-page="([a-z]+)" data-wf="(\d)"[^>]*onclick="_orvNav\('([a-z]+)','([a-z-]+)',this\)"/g)].slice(0, 6).map((m) => [m[3], m[4]]);
check('tour has six steps', STEPS && STEPS.length === 6);
check('each step opens the same page as the sidebar item 01–06', JSON.stringify(STEPS.map((s) => s.nav)) === JSON.stringify(nav), { tour: STEPS.map((s) => s.nav), sidebar: nav });
check('step names: Control Center, Research, Create, Launch, Campaigns, Automations', STEPS.map((s) => s.name).join() === 'Control Center,Research,Create,Launch,Campaigns,Automations');
STEPS.forEach((s) => check(`${s.name}: page exists in app.html (#${s.nav[1]})`, app.includes('id="' + s.nav[1] + '"')));

console.log('\nC. Wiring and safety');
check('app.html loads css/tour.css, js/orivenRing.js and js/tour.js before onboarding.js', /href="css\/tour\.css"/.test(app) && app.indexOf('<script src="js/orivenRing.js">') > 0 && app.indexOf('<script src="js/orivenRing.js">') < app.indexOf('<script src="js/tour.js">') && app.indexOf('<script src="js/tour.js">') < app.indexOf('<script src="js/onboarding.js">'));
check('old welcome modal markup removed', !app.includes('id="ob2Overlay"') && !app.includes('class="ob3-choice"'));
check('startOnboarding opens the tour', /function startOnboarding\(opts\)\{[\s\S]*?window\.orvTour\.open\(opts \|\| \{\}\)/.test(onb));
check('finish → plan step via the existing Explore path; skip → saved as skipped', /orvOnboardingTourDone = function\(\)\{ window\.ob3Choose\("explore"\); \}/.test(onb) && /orvOnboardingTourSkipped[\s\S]*?_ob3Persist\(null\)/.test(onb));
check('the tour file makes no requests of its own', !/fetch\(|apiFetch|XMLHttpRequest|sendBeacon/.test(tourJs));
check('the tour never calls generation, launch or Autopilot functions', !/startCampaignGeneration|aicGenerate|cgrGenerate|_apSave|publish|launchCampaign|Autopilot\w*\(/.test(tourJs.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')));
check('Settings: "Take a product tour" starts it', /data-i18n="smdRestartObBtn">Take a product tour</.test(app) && /onclick="restartOnboarding\(\)"/.test(app));
check('reduced motion handled in the tour CSS', /prefers-reduced-motion:reduce/.test(read('css/tour.css')));

console.log('\nD. Research / Autopilot preview during the tour (rendering only)');
const ops = read('css/orivenOps.css');
check('plan card hides the page only when the tour preview is off', /body:not\(\.orv-tour-preview\) \.page\.orv-gated > :not\(\.orv-gate\) \{ display: none !important; \}/.test(ops));
check('during the preview the plan card is hidden and the page shown', /body\.orv-tour-preview \.page\.orv-gated > \.orv-gate \{ display: none !important; \}/.test(ops) && /body\.orv-tour-preview \.page\.orv-gated\.active \{ display: block; \}/.test(ops));
check('the tour turns the preview on with the app inert, and off again when it closes', /classList\.toggle\('orv-tour-preview', !!on\)/.test(tourJs) && /app\.setAttribute\('inert', ''\)/.test(tourJs) && /app\.removeAttribute\('inert'\)/.test(tourJs) && /preview\(true\)/.test(tourJs) && /preview\(false\)/.test(tourJs) && /document\.body\.classList\.remove\('orv-tour-preview'\)/.test(tourJs));
check('orivenOps.js still decides who is gated (plan entitlements untouched)', /page\.classList\.toggle\('orv-gated', locked\)/.test(read('js/orivenOps.js')));
check('Automations: only the server’s plan answer (403 AUTOPILOT_NOT_AVAILABLE) renders as the intro; other failures still say so', /A\.locked = r\[0\]\.status === 403 && !!\(r\[0\]\.data && r\[0\]\.data\.code === 'AUTOPILOT_NOT_AVAILABLE'\)/.test(read('js/automations.js')) && /A\.error = A\.locked \? null : errText\(r\[0\]\)/.test(read('js/automations.js')));

console.log('\nE. Create fits the screen');
const fit = read('css/create-fit.css');
check('app.html loads css/create-fit.css after the other app stylesheets', app.indexOf('href="css/create-fit.css"') > app.indexOf('href="css/orivenOps.css"'));
check('height-aware tiers (≤860px, ≤700px tall) scoped to #page-create', /max-height: 860px/.test(fit) && /max-height: 700px/.test(fit) && fit.split('{').slice(1).every((blk, i, arr) => true) && !/transform:\s*scale/.test(fit) && !/display:\s*none/.test(fit));
check('every rule in create-fit.css is scoped to #page-create', (fit.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{[^{}]*\}/g) || []).filter((r) => !/^\s*@/.test(r)).every((r) => /#page-create/.test(r.split('{')[0])));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
