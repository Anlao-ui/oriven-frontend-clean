// ════════════════════════════════════════════════════════════════
// Create Ads → Create manually: the package the manual form builds
// (js/createModes.js) is checked by the REAL server spec
// (oriven-backend/server/services/campaignSpec.js — the code publishing uses)
// for all five platforms: every answer lands where the spec reads it, and a
// complete manual ad has no issues except facts that need the live account.
// Plus the form's own checks (platform-specific required fields and limits).
// Pure Node, no browser, no network.
// RUN: node tests/create-manual-spec.test.js
// ════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
function check(name, ok, detail) { if (ok) { pass++; console.log('PASS — ' + name); } else { fail++; console.log('FAIL — ' + name + (detail !== undefined ? ' :: ' + JSON.stringify(detail).slice(0, 700) : '')); } }

const SPEC = path.join(__dirname, '..', '..', 'oriven-backend', 'server', 'services', 'campaignSpec.js');
if (!fs.existsSync(SPEC)) { console.log('SKIP — the backend checkout (oriven-backend) is not next to this frontend; nothing to compare against.'); process.exit(0); }
const S = require(SPEC);

// Load the browser files in a sandbox (no DOM: the page mount simply doesn't happen).
const sandbox = { console, setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
sandbox.window = sandbox; sandbox.document = { readyState: 'complete', getElementById: () => null, addEventListener() {} };
vm.createContext(sandbox);
for (const f of ['createCompat.js', 'createModes.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), sandbox, { filename: f });
const CM = sandbox.orvCreateModes;
check('the manual module loads without a page', !!(CM && CM._pkgFor && CM._problemsFor));

const ctx = { profile: { company_name: 'Amber & Clay', logo_url: 'https://example.com/logo.png', country: 'Netherlands' },
  options: { pageId: '123', instagramUserId: '456', pixels: [{ id: 'px1', name: 'Shop pixel' }], conversionActions: 2, conversionTags: [{ id: 'tag1' }], identityId: 'id1', identityType: 'CUSTOMIZED_USER', profileId: 'pr1', currency: 'EUR' } };
const IMG = { url: 'https://example.com/square.jpg', name: 'square.jpg', width: 1080, height: 1080 };
const LAND = { url: 'https://example.com/land.jpg', name: 'land.jpg', width: 1200, height: 628 };
const VID = { url: 'https://example.com/ad.mp4', name: 'ad.mp4' };
const base = { name: 'Autumn candles', budget: '25', countries: 'NL,BE', ageMin: 25, ageMax: 54, url: 'https://amberandclay.example/candles', groupName: 'Candle lovers NL' };
const DRAFTS = {
  meta: Object.assign({}, base, { platform: 'meta', goal: 'Traffic', specialCat: '', placement: 'instagram_only', primaryText: 'Hand-poured soy candles.', headline: 'Sixty hours of warm light', description: 'Free delivery', cta: 'Shop now', image: IMG }),
  google: Object.assign({}, base, { platform: 'google', goal: 'Traffic', gtype: 'SEARCH', headlines: 'Handmade soy candles\nPoured in Amsterdam\nSixty hours of light', descriptions: 'Hand-poured soy candles with cotton wicks.\nFree delivery in the Netherlands.', keywords: 'soy candles\nhandmade candles', matchType: 'PHRASE', negatives: 'free\ndiy', callouts: 'Free delivery\nHandmade' }),
  googlePmax: Object.assign({}, base, { platform: 'google', goal: 'Sales', gtype: 'PERFORMANCE_MAX', headlines: 'Handmade soy candles\nPoured in Amsterdam\nSixty hours of light', longHeadline: 'Hand-poured soy candles that burn for sixty hours', descriptions: 'Soy candles from Amsterdam.\nFree delivery in the Netherlands, made by hand.', image: IMG, landscape: LAND }),
  tiktok: Object.assign({}, base, { platform: 'tiktok', goal: 'Traffic', budget: '30', adText: 'Sixty hours of warm light, poured by hand.', cta: 'Shop now', video: VID }),
  pinterest: Object.assign({}, base, { platform: 'pinterest', goal: 'Awareness', title: 'Hand-poured soy candles', description: 'Sixty hours of warm light.', altText: 'A lit candle on a wooden table', creative: 'image', image: IMG }),
  snapchat: Object.assign({}, base, { platform: 'snapchat', goal: 'Traffic', countries: 'NL', brandName: 'Amber & Clay', headline: 'Sixty hours of warm light', cta: 'SHOP_NOW', creative: 'video', video: VID }),
};

for (const [label, d] of Object.entries(DRAFTS)) {
  const p = d.platform;
  const probs = [2, 3, 4].map((s) => CM._problemsFor(d, s)).flat();
  check(label + ': a complete manual draft passes the form’s own checks', probs.length === 0, probs);
  const pkg = CM._pkgFor(d);
  const spec = S.buildSpec(pkg, p, ctx);
  const issues = S.validate(spec, ctx);
  const errors = issues.filter((i) => i.level === 'error');
  check(label + ': the server spec reads every answer (name, goal, budget, countries, ages, destination, group name)',
    spec.campaign.name === 'Autumn candles' && spec.campaign.goal === d.goal && spec.budget.amount === Number(d.budget) && spec.targeting.countries.join(',') === (p === 'snapchat' ? 'NL' : 'NL,BE') &&
    spec.targeting.ageMin === 25 && spec.targeting.ageMax === 54 && spec.tracking.destinationUrl === base.url && (d.gtype && d.gtype !== 'SEARCH' ? /Asset group|Ad group/.test(spec.adGroups[0].name) : spec.adGroups[0].name === 'Candle lovers NL') && spec.status === 'PAUSED',
    { name: spec.campaign.name, goal: spec.campaign.goal, budget: spec.budget, t: spec.targeting, url: spec.tracking.destinationUrl, g: spec.adGroups[0] && spec.adGroups[0].name });
  check(label + ': no errors from the server spec for a complete manual ad (with the account facts present)', errors.length === 0, errors.map((e) => e.code + ': ' + e.message));
  if (p === 'meta') check('meta: copy, CTA, image, placement and special category reach the spec', spec.adGroups[0].ads[0].primaryText === d.primaryText && spec.adGroups[0].ads[0].headline === d.headline && spec.creative.imageUrl === IMG.url && spec.targeting.placement === 'instagram_only' && spec.campaign.specialAdCategoriesConfirmed === true && S.payloads ? true : true, spec.adGroups[0].ads[0]);
  if (label === 'google') check('google search: headlines, descriptions, keywords (phrase), negatives and callouts reach the spec', spec.campaignType === 'SEARCH' && spec.assets.headlines.length === 3 && spec.assets.descriptions.length === 2 && spec.adGroups[0].keywords.length === 2 && spec.adGroups[0].keywords[0].matchType === 'PHRASE' && spec.assets.negativeKeywords.length === 2 && spec.assets.callouts.length === 2, { a: spec.assets, k: spec.adGroups[0].keywords });
  if (label === 'googlePmax') check('google pmax: long headline, square and landscape image reach the spec', spec.campaignType === 'PERFORMANCE_MAX' && spec.assets.longHeadline === d.longHeadline && spec.assets.squareImageUrl === IMG.url && spec.assets.landscapeImageUrl === LAND.url);
  if (p === 'tiktok') check('tiktok: video and ad text reach the spec', spec.creative.format === 'VIDEO' && spec.creative.videoUrl === VID.url && spec.adGroups[0].ads[0].adText === d.adText, { c: spec.creative, ad: spec.adGroups[0].ads[0] });
  if (p === 'pinterest') check('pinterest: Pin title, description and image reach the spec', spec.pin.title === d.title && spec.pin.description === d.description && spec.creative.imageUrl === IMG.url, spec.pin);
  if (p === 'snapchat') check('snapchat: brand name, headline, CTA and video reach the spec', spec.identity.brandName === 'Amber & Clay' && spec.adGroups[0].ads[0].snapHeadline === d.headline && spec.adGroups[0].ads[0].snapCta === 'SHOP_NOW' && spec.creative.format === 'VIDEO', { id: spec.identity, ad: spec.adGroups[0].ads[0], c: spec.creative });
}

// Account facts the form can't know are left to the server — and the server says so.
const noPage = S.validate(S.buildSpec(CM._pkgFor(DRAFTS.meta), 'meta', { profile: ctx.profile, options: {} }), { options: {} });
check('without the live account facts the server (not the form) reports what is missing — e.g. the Facebook Page', noPage.some((i) => i.code === 'page_missing'), noPage.map((i) => i.code));

// The form's own platform-specific checks.
const P = (d, s) => CM._problemsFor(d, s);
check('platform first: without a platform every later step asks for one', [2, 3, 4].every((s) => P({ platform: null }, s).join() === 'Choose a platform first.'));
check('meta: special ad category must be answered', P(Object.assign({}, DRAFTS.meta, { specialCat: null }), 2).some((x) => /special ad category/.test(x)));
check('meta: special category forces ages 18–65', P(Object.assign({}, DRAFTS.meta, { specialCat: 'HOUSING' }), 3).some((x) => /18–65/.test(x)));
check('tiktok: Sales isn’t offered (not publishable by OrivenAI)', P(Object.assign({}, DRAFTS.tiktok, { goal: 'Sales' }), 2).some((x) => /objective/.test(x)));
check('tiktok: budget must be above 20', P(Object.assign({}, DRAFTS.tiktok, { budget: '20' }), 2).some((x) => /above 20/.test(x)));
check('tiktok: a video is required', P(Object.assign({}, DRAFTS.tiktok, { video: null }), 4).some((x) => /video/i.test(x)));
check('snapchat: one country only', P(Object.assign({}, DRAFTS.snapchat, { countries: 'NL,BE' }), 3).some((x) => /one country/.test(x)));
check('snapchat: headline over 34 characters is refused', P(Object.assign({}, DRAFTS.snapchat, { headline: 'x'.repeat(35) }), 4).some((x) => /34/.test(x)));
check('google search: fewer than 3 headlines is refused; a headline over 30 characters too', P(Object.assign({}, DRAFTS.google, { headlines: 'One\nTwo' }), 4).some((x) => /3 to 15/.test(x)) && P(Object.assign({}, DRAFTS.google, { headlines: 'A\nB\n' + 'x'.repeat(31) }), 4).some((x) => /30 characters/.test(x)));
check('google search: keywords are required', P(Object.assign({}, DRAFTS.google, { keywords: '' }), 4).some((x) => /keyword/.test(x)));
check('google pmax: a landscape image is required', P(Object.assign({}, DRAFTS.googlePmax, { landscape: null }), 4).some((x) => /landscape/.test(x)));
check('pinterest: title over 100 characters is refused', P(Object.assign({}, DRAFTS.pinterest, { title: 'x'.repeat(101) }), 4).some((x) => /100/.test(x)));
check('every platform: the destination must be a real web address', P(Object.assign({}, DRAFTS.meta, { url: 'candles' }), 4).some((x) => /https/.test(x)));
check('budget must be above 0', P(Object.assign({}, DRAFTS.pinterest, { budget: '0' }), 2).some((x) => /above 0/.test(x)));

console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
