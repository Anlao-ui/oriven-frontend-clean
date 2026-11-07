// The six assistants are the same everywhere: the landing page (index.html
// #agents, colours in css/landing.css) is the source; the onboarding's copy
// (js/onboardingFlow.js) and the backend's definition
// (oriven-backend/server/services/agents.js, when checked out next to this
// repository) must match it word for word. No browser, no network.
// RUN: node tests/agents-consistency.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function check(name, ok, info) { if (ok) { pass++; console.log('PASS — ' + name); } else { fail++; console.log('FAIL — ' + name + (info === undefined ? '' : ' | ' + JSON.stringify(info).slice(0, 400))); } }

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/&amp;/g, '&').replace(/&rsquo;/g, '’');
const css = fs.readFileSync(path.join(ROOT, 'css', 'landing.css'), 'utf8').toUpperCase();
const ob = fs.readFileSync(path.join(ROOT, 'js', 'onboardingFlow.js'), 'utf8');
const lit = ob.slice(ob.indexOf('var ASSISTANTS = ['), ob.indexOf('];', ob.indexOf('var ASSISTANTS = [')) + 2);
const ctx = {}; vm.createContext(ctx); vm.runInContext(lit.replace('var ASSISTANTS', 'this.A'), ctx);
const A = ctx.A || [];
const ORDER = ['scout', 'vector', 'nova', 'momentum', 'metric', 'flux'];

check('onboarding lists the six in the landing page order', A.map((a) => a.id).join(',') === ORDER.join(','), A.map((a) => a.id));
const section = (id) => { const i = html.indexOf('id="agent-' + id + '"'); return html.slice(i, html.indexOf('</article>', i)); };
for (const a of A) {
  const s = section(a.id);
  check(a.name + ': onboarding name, specialisation, tone, backstory and strengths match the landing page',
    s.includes('>' + a.name + '</h3>') && s.includes('Specialisation: ' + a.role) && s.includes('<dd>' + a.tone + '</dd>') && s.includes(a.story) && a.strengths.every((x) => s.includes('<li>' + x + '</li>')),
    a.id);
  check(a.name + ': colour ' + a.color + ' is the landing page’s', css.includes(a.color.toUpperCase()) && a.rgb.join(',') === [1, 3, 5].map((k) => parseInt(a.color.slice(k, k + 2), 16)).join(','));
}

const be = path.join(ROOT, '..', 'oriven-backend', 'server', 'services', 'agents.js');
if (fs.existsSync(be)) {
  const B = require(be).AGENTS;
  check('backend (services/agents.js) has the same six', Object.keys(B).join(',') === ORDER.join(','));
  check('backend names, specialisations, colours, tone, backstory and strengths equal the onboarding copy', A.every((a) => { const b = B[a.id]; return b && b.name === a.name && b.role === a.role && b.color.toUpperCase() === a.color.toUpperCase() && b.tone === a.tone && b.story === a.story && JSON.stringify(b.strengths) === JSON.stringify(a.strengths); }), A.filter((a) => { const b = B[a.id]; return !(b && b.name === a.name && b.story === a.story); }).map((a) => a.id));
  check('backend "also helps with" equals the landing page chips', ORDER.every((id) => B[id].alsoHelps.every((x) => section(id).includes('>' + x + '</a>'))));
} else console.log('SKIP — backend not checked out next to this repository');

check('the app shows the same marks: js/landing-creatures.js has a glyph for each', (() => { const s = fs.readFileSync(path.join(ROOT, 'js', 'landing-creatures.js'), 'utf8'); return /kinds: \['scout', 'vector', 'nova', 'momentum', 'metric', 'flux'\]/.test(s) && /glyph: glyph/.test(s); })());

// Page keys: the server's (services/pageKeys.js — Marketing Plan tasks,
// Progress, the assistant's "open page") and the browser's map
// (js/pageRegistry.js) are the same list; every plan action has a page.
{
  const reg = fs.readFileSync(path.join(ROOT, 'js', 'pageRegistry.js'), 'utf8');
  const rctx = { window: {} }; vm.createContext(rctx); vm.runInContext(reg, rctx);
  const fe = rctx.window.orvPages.keys.slice().sort();
  const pk = path.join(ROOT, '..', 'oriven-backend', 'server', 'services', 'pageKeys.js');
  if (fs.existsSync(pk)) {
    const beKeys = Object.keys(require(pk).PAGES).sort();
    check('page keys: the browser opens exactly the pages the server can point to', JSON.stringify(fe) === JSON.stringify(beKeys), { fe, be: beKeys });
    const cat = require(path.join(ROOT, '..', 'oriven-backend', 'server', 'services', 'planCatalog.js')).ACTIONS;
    check('every Marketing Plan action opens a page the browser knows', Object.keys(cat).every((id) => fe.includes(cat[id].page)), Object.keys(cat).filter((id) => !fe.includes(cat[id].page)));
  } else console.log('SKIP — backend page keys not checked out next to this repository');
  check('the four new pages have a key: competitor-analysis, creative-testing, audience-builder, campaign-comparison', ['competitor-analysis', 'creative-testing', 'audience-builder', 'campaign-comparison'].every((k) => fe.includes(k)));
}

console.log(`\n${pass + fail} checks run, ${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
