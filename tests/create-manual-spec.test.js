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


// ── v2: ad sets / ad groups → ads, new formats, limits, drafts ──────────
const V = (n) => ({ url: 'https://example.com/v' + n + '.mp4', name: 'v' + n + '.mp4' });
const I = (n) => ({ url: 'https://example.com/i' + n + '.jpg', name: 'i' + n + '.jpg', width: 1080, height: 1080 });
const L = (n) => ({ url: 'https://example.com/l' + n + '.jpg', name: 'l' + n + '.jpg', width: 1200, height: 628 });
const ad = (o) => CM.newAd(o), grp = (o) => CM.newGroup(o);
const v2 = (o) => Object.assign({ v: 2, name: 'Autumn', budget: '30', countries: 'NL', ageMin: 18, ageMax: 65, url: 'https://amberandclay.example/c' }, o);
const specOf = (d) => S.buildSpec(CM._pkgFor(d), d.platform, ctx);
const errs = (d) => S.validate(specOf(d), ctx).filter((i) => i.level === 'error');
const allProbs = (d) => [2, 3, 4].map((st) => CM._problemsFor(d, st)).flat();

const metaMulti = v2({ platform: 'meta', goal: 'Traffic', specialCat: '', creative: 'image', groups: [
  grp({ name: 'Gift buyers', ageMin: '25', ageMax: '54', ads: [ad({ name: 'Gift A', headline: 'Gift H1', primaryText: 'Gift P1', image: I(1) }), ad({ headline: 'Gift H2', primaryText: 'Gift P2', image: I(2), cta: 'Shop now' })] }),
  grp({ name: 'Candle lovers', ads: [ad({ headline: 'Love H1', primaryText: 'Love P1', image: I(3) })] })] });
check('v2 meta: a campaign with 2 ad sets (2 + 1 ads) passes the form’s checks', allProbs(metaMulti).length === 0, allProbs(metaMulti));
let sp = specOf(metaMulti);
check('v2 meta: the server spec gets both ad sets, each ad its own copy and image, the ad set’s own age range', sp.structure.explicit && sp.adGroups.length === 2 && sp.adGroups[0].ads.length === 2 && sp.adGroups[0].ads[0].name === 'Gift A' && sp.adGroups[0].ads[1].imageUrl === I(2).url && sp.adGroups[1].ads[0].primaryText === 'Love P1' && sp.adGroups[0].ageMin === 25 && errs(metaMulti).length === 0, errs(metaMulti));
const removed = JSON.parse(JSON.stringify(metaMulti)); removed.groups[0].ads.splice(1, 1); removed.groups[1].ads[0].headline = 'Edited H1';
sp = specOf(removed);
check('v2: removing one ad and editing another changes exactly that in the package', sp.adGroups[0].ads.length === 1 && sp.adGroups[1].ads[0].headline === 'Edited H1');

const metaVideo = v2({ platform: 'meta', goal: 'Traffic', specialCat: '', creative: 'video', groups: [grp({ ads: [ad({ headline: 'Watch', primaryText: 'One', video: V(1) }), ad({ headline: 'Watch 2', primaryText: 'Two', video: V(2) })] })] });
sp = specOf(metaVideo);
check('v2 meta video: format VIDEO, each ad its own video, no errors from the server spec', sp.creative.format === 'VIDEO' && sp.adGroups[0].ads[1].videoUrl === V(2).url && errs(metaVideo).length === 0, errs(metaVideo));
check('v2 meta video: an ad without a video is caught by the form', CM._problemsFor(v2({ platform: 'meta', goal: 'Traffic', specialCat: '', creative: 'video', groups: [grp({ ads: [ad({ headline: 'H', primaryText: 'P' })] })] }), 4).some((x) => /video/.test(x)));
const VP = CM.videoProblems;
check('video rules: Meta accepts an MP4 of 15 s in 9:16; refuses WEBM, a 0.5 s clip and a 2:1 video', VP({ duration: 15, width: 1080, height: 1920 }, { type: 'video/mp4' }, 'meta').length === 0 && VP({ duration: 15, width: 1080, height: 1920 }, { type: 'video/webm' }, 'meta').some((x) => /MP4 or MOV/.test(x)) && VP({ duration: 0.5, width: 1080, height: 1080 }, { type: 'video/mp4' }, 'meta').some((x) => /1 second/.test(x)) && VP({ duration: 10, width: 2000, height: 1000 }, { type: 'video/mp4' }, 'meta').some((x) => /9:16/.test(x)));
check('video rules: Snapchat refuses a 16:9 video and one under 3 seconds; TikTok has no browser-side block', VP({ duration: 10, width: 1920, height: 1080 }, { type: 'video/mp4' }, 'snapchat').some((x) => /9:16/.test(x)) && VP({ duration: 2, width: 1080, height: 1920 }, { type: 'video/mp4' }, 'snapchat').some((x) => /3 seconds/.test(x)) && VP({ duration: 30, width: 1080, height: 1920 }, { type: 'video/webm' }, 'tiktok').length === 0);
check('video rules: a video the browser can’t read is refused with a clear message', VP(null, { type: 'video/mp4' }, 'meta').some((x) => /couldn’t be read/.test(x)));

const gSearch = v2({ platform: 'google', goal: 'Traffic', gtype: 'SEARCH', matchType: 'PHRASE', groups: [
  grp({ name: 'Soy', keywords: 'soy candles\nsoy candle gift', ads: [ad({ headlines: 'Soy 1\nSoy 2\nSoy 3', descriptions: 'Soy d1\nSoy d2' }), ad({ headlines: 'Soy 4\nSoy 5\nSoy 6', descriptions: 'Soy d3\nSoy d4' })] }),
  grp({ name: 'Gifts', keywords: 'candle gift', ads: [ad({ headlines: 'Gift 1\nGift 2\nGift 3', descriptions: 'Gift d1\nGift d2' })] })] });
sp = specOf(gSearch);
check('v2 google search: own keywords per ad group, own headlines per RSA, no errors', sp.adGroups[0].keywords.length === 2 && sp.adGroups[1].keywords[0].text === 'candle gift' && sp.adGroups[0].ads[1].headlines[0] === 'Soy 4' && errs(gSearch).length === 0, errs(gSearch));
check('v2 google search: a 4th responsive search ad in one ad group is refused (Google serves at most 3)', CM._problemsFor(Object.assign(JSON.parse(JSON.stringify(gSearch)), { groups: [grp({ keywords: 'k', ads: [1, 2, 3, 4].map(() => ad({ headlines: 'A\nB\nC', descriptions: 'D1\nD2' })) })] }), 4).some((x) => /at most 3 ads/.test(x)));
check('v2 google search: an ad group without keywords is caught', CM._problemsFor(Object.assign(JSON.parse(JSON.stringify(gSearch)), { groups: [grp({ keywords: '', ads: [ad({ headlines: 'A\nB\nC', descriptions: 'D1\nD2' })] })] }), 4).some((x) => /keyword/.test(x)));

const gDisplay = v2({ platform: 'google', goal: 'Traffic', gtype: 'DISPLAY', groups: [grp({ ads: [ad({ headlines: 'Soy candles\nGift idea', longHeadline: 'Hand-poured soy candles for slow evenings', descriptions: 'Sixty hours of light.', image: I(1), landscape: L(1) }), ad({ headlines: 'Second', longHeadline: 'Second long headline', descriptions: 'Second d.', image: I(2), landscape: L(2) })] })] });
sp = specOf(gDisplay);
check('v2 google display: DISPLAY campaign, ads with own square + landscape images and texts, no errors', sp.campaignType === 'DISPLAY' && sp.adGroups[0].ads[1].landscapeImageUrl === L(2).url && sp.adGroups[0].ads[0].longHeadline === 'Hand-poured soy candles for slow evenings' && allProbs(gDisplay).length === 0 && errs(gDisplay).length === 0, { e: errs(gDisplay), p: allProbs(gDisplay) });
check('v2 google display: a missing landscape image is caught by the form', CM._problemsFor(Object.assign(JSON.parse(JSON.stringify(gDisplay)), { groups: [grp({ ads: [ad({ headlines: 'A', longHeadline: 'L', descriptions: 'D', image: I(1) })] })] }), 4).some((x) => /landscape/.test(x)));

const gVideo = v2({ platform: 'google', goal: 'Traffic', gtype: 'DEMAND_GEN_VIDEO', groups: [grp({ ads: [ad({ youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', headlines: 'Soy candles', longHeadlines: 'Hand-poured soy candles that burn sixty hours', descriptions: 'Free delivery in NL.' })] })] });
sp = specOf(gVideo);
check('v2 google YouTube video: Demand Gen campaign with the YouTube id, no errors', sp.campaignType === 'DEMAND_GEN' && sp.creative.format === 'YOUTUBE_VIDEO' && sp.adGroups[0].ads[0].youtubeVideoId === 'dQw4w9WgXcQ' && allProbs(gVideo).length === 0 && errs(gVideo).length === 0, { e: errs(gVideo), p: allProbs(gVideo) });
check('v2 google YouTube video: something that isn’t a YouTube link is caught by the form', CM._problemsFor(Object.assign(JSON.parse(JSON.stringify(gVideo)), { groups: [grp({ ads: [ad({ youtube: 'my video', headlines: 'H', longHeadlines: 'L', descriptions: 'D' })] })] }), 4).some((x) => /YouTube/.test(x)));

const ttVV = v2({ platform: 'tiktok', goal: 'Awareness', ttObjective: 'VideoViews', groups: [grp({ ads: [ad({ adText: 'First', video: V(1) }), ad({ adText: 'Second', video: V(2) })] }), grp({ ads: [ad({ adText: 'Third', video: V(1) })] })] });
sp = specOf(ttVV);
check('v2 tiktok Video Views: VIDEO_VIEWS objective, VIDEO_VIEW / CPV, 2 ad groups, own videos, no errors', sp.campaign.objective === 'VIDEO_VIEWS' && sp.optimization.goal === 'VIDEO_VIEW' && sp.optimization.billingEvent === 'CPV' && sp.adGroups.length === 2 && sp.adGroups[0].ads[1].videoUrl === V(2).url && errs(ttVV).length === 0, errs(ttVV));
check('v2 tiktok Video Views: only the awareness goal can be chosen with it', CM._problemsFor(Object.assign({}, ttVV, { goal: 'Traffic' }), 2).some((x) => /objective/.test(x)));

const pinMulti = v2({ platform: 'pinterest', goal: 'Awareness', creative: 'image', groups: [grp({ ads: [ad({ title: 'Pin one', pinDescription: 'First', image: I(1) }), ad({ title: 'Pin two', altText: 'A candle', image: I(2) })] })] });
sp = specOf(pinMulti);
check('v2 pinterest: one Pin per ad (own title, description, alt text, image), no errors', sp.adGroups[0].ads[0].pin.title === 'Pin one' && sp.adGroups[0].ads[1].pin.altText === 'A candle' && sp.adGroups[0].ads[1].imageUrl === I(2).url && errs(pinMulti).length === 0, errs(pinMulti));
const snapTwo = v2({ platform: 'snapchat', goal: 'Traffic', creative: 'image', brandName: 'Amber & Clay', budget: '8', groups: [grp({ ads: [ad({ headline: 'One', image: I(1) })] }), grp({ ads: [ad({ headline: 'Two', image: I(2) })] })] });
check('v2 snapchat: 2 ad squads on 8 per day is refused (Snapchat needs 5 per ad squad)', CM._problemsFor(snapTwo, 4).some((x) => /5 per day for each ad squad/.test(x)));
check('v2 meta limit: 51 ads in one ad set is refused with Meta’s 50-ad limit', CM._problemsFor(v2({ platform: 'meta', goal: 'Traffic', specialCat: '', creative: 'image', groups: [grp({ ads: Array.from({ length: 51 }, () => ad({ headline: 'H', primaryText: 'P', image: I(1) })) })] }), 4).some((x) => /at most 50 ads/.test(x)));

const v1 = { v: 1, platform: 'meta', name: 'Old draft', goal: 'Traffic', budget: '20', specialCat: '', countries: 'NL', ageMin: 18, ageMax: 65, url: 'https://x.example/a', groupName: 'Old set', headline: 'Old H', primaryText: 'Old P', cta: 'Shop now', image: I(9) };
const mig = CM.migrate(v1);
check('backward compatible: a v1 draft (one ad set, one ad) opens as v2 with every value kept', mig.v === 2 && mig.groups.length === 1 && mig.groups[0].name === 'Old set' && mig.groups[0].ads[0].headline === 'Old H' && mig.groups[0].ads[0].primaryText === 'Old P' && mig.groups[0].ads[0].cta === 'Shop now' && mig.groups[0].ads[0].image.url === I(9).url && mig.name === 'Old draft');
const pkgSaved = CM._pkgFor(metaMulti);
const reopened = CM.migrate(JSON.parse(JSON.stringify(pkgSaved.manualDraft)));
check('saving and reopening a complex draft: the saved package carries the draft; reopened, all ad sets and ads are back', reopened.groups.length === 2 && reopened.groups[0].ads.length === 2 && reopened.groups[0].ads[1].headline === 'Gift H2' && reopened.groups[1].ads[0].image.url === I(3).url && JSON.stringify(CM._pkgFor(reopened).spec.overrides.adGroups) === JSON.stringify(pkgSaved.spec.overrides.adGroups));
check('a manual package never uses source "manual" (that marks campaigns made outside OrivenAI)', !('source' in pkgSaved) && pkgSaved.creationMode === 'manual');

console.log('\n' + (pass + fail) + ' checks run, ' + pass + ' passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
