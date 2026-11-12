# OrivenAI keyword strategy (November 2026)

Research date: 12 November 2026. Implemented on branch `seo/keyword-strategy` (not deployed).

## How the research was done, and its limits

- **No verified metrics.** Google Keyword Planner, Semrush, Ahrefs and Google Search Console were not available in this session (no account access; the Ahrefs and Similarweb connectors were not authorized). No public source gave reliable volume, CPC or difficulty for these terms. **This document contains no search volumes, CPC values or difficulty scores, because none could be verified.**
- **Evidence used:** live search results pages (US results only), competitor websites (Madgicx, Smartly, Birch, Optmyzr, checked on their own sites), the existing OrivenAI site, and the product facts in `tools/seo/facts.js` and `tools/seo/product-depth.js`.
- **Labels used below:**
  - *SERP evidence* is what currently ranks.
  - *Assessment* is our own judgement of intent, competition and fit, not a measured score.

## What the SERPs showed

| Term | Who ranks today | Intent | Assessment |
|---|---|---|---|
| advertising management software | HubSpot, RedTrack, Pipedrive, Skai, AdRoll, Capterra/GetApp | "Best X" commercial investigation | High competition (domain authority), high commercial value |
| AI advertising software / tools | DesignRush, SourceForge, Madgicx blog, G2, GetApp | Listicles, commercial investigation | High competition |
| cross-platform ad management software | Birch, Optmyzr, vendor roundups (Cometly, Ryze, Hawky), G2 categories | Commercial; buyers split "acts on campaigns" from "reporting only" | Medium-high competition, very strong product fit |
| PPC management software | Vendor blogs, Capterra, G2, HubSpot | Commercial, Google-Ads-centric | High competition, partial fit (no bid management) |
| AI ad (creative) generator | HeyGen, AdCreative.ai, Madgicx, Creatopy, getimg | Commercial / transactional (wants a tool) | High competition, good fit |
| AI campaign generator | HubSpot Campaign Assistant, ClickUp, Plai | Mixed | Medium, partial fit |
| unified ads dashboard (Google, Meta, TikTok, Pinterest) | Vendor pages (RedTrack, Cometly, AdPulse, Kolect) | Commercial, reporting intent | Medium, good fit (OrivenAI also acts on campaigns) |
| Madgicx alternatives | Capterra/GetApp/Software Advice directories, vendor posts (Atria, Foreplay, AdStellar, Ryze) | Switching, high purchase intent | Vendor "alternatives" posts do rank; strong fit (Madgicx manages Meta only) |
| Smartly.io alternatives (small teams) | G2, Capterra, vendor posts (Cropink, AdStellar, AdManage) | Switching, high purchase intent | Strong fit (Smartly is demo-led enterprise; no self-serve) |
| Predis.ai alternatives | AlternativeTo, Software Advice, vendor posts | Organic social content tools | **Weak fit**: Predis is mainly an organic social content tool; already covered inside the AdCreative.ai comparison. No separate page. |
| "OrivenAI" (brand) | Not returned by the search tool used | Navigational | See Search Console section: brand indexing must be checked in GSC |

Netherlands: the site is English-only, and Dutch-language pages would mean a translation project. Recommendation: target English queries (US, UK, CA, AU first; English-language searches from the Netherlands come for free) and revisit Dutch once Search Console shows Dutch demand.

## Priorities

**Priority 1, highest commercial value (bottom of funnel):**
- cross-platform ad management software (plus advertising management software, ad management software for small business, multi-channel advertising software)
- AI advertising platform / AI advertising software for small businesses
- AI ad generator (plus AI ad creative generator)
- Madgicx alternatives
- Smartly.io alternatives (small teams)
- AdCreative.ai alternatives (existing page)

**Priority 2, strong supporting:**
- PPC automation software (plus PPC management software)
- unified ads dashboard
- AI competitor / market research for ads
- AI Google Ads campaign builder
- AI Facebook and Instagram ads creator
- TikTok ads tool
- Pinterest ads tool
- ad scheduling and automated campaign rules
- all-in-one advertising workflow

**Priority 3, long-tail and informational (existing Learn guides):**
- what is an AI advertising platform
- best AI advertising tools for small business
- how to manage multiple ad platforms
- what is PPC automation
- how to automate Google Ads safely
- Google Ads vs Meta Ads
- ad character limits
- how to research competitor ads
- how to test ad creatives
- TikTok / Pinterest ads for small business
- Meta Pixel vs Conversions API

## Keyword-to-page map (one primary intent per page)

| URL | Primary | Secondary | Intent |
|---|---|---|---|
| / | AI advertising platform (small business) | AI advertising software | Commercial |
| /cross-platform-ad-management/ | cross-platform ad management software | advertising management software; ad management software for small business; multi-channel advertising software; manage Google and Meta ads in one place | Commercial |
| /ppc-automation-software/ | PPC automation software | PPC management software; automated rules Google Ads / Meta Ads | Commercial |
| /create | AI ad generator | AI ad creative generator; AI ad copy generator | Commercial |
| /campaigns | unified ads dashboard | ad campaign dashboard; cross-platform ad reporting | Commercial |
| /research | AI competitor and market research for ads | competitor ad analysis | Commercial |
| /launch | launch ad campaigns with pre-launch checks | publish campaigns via API | Commercial |
| /autopilot | ad scheduling and automated campaign rules | schedule ads; campaign rules | Commercial (feature) |
| /business | marketing dashboard and ad plan | brand profile | Product |
| /product | Google, Meta, TikTok and Pinterest Ads integrations | ad platform integrations | Product |
| /product/google-ads, /meta-ads, /tiktok-ads, /pinterest-ads | AI campaign builder per platform (unchanged) | | Commercial |
| /pricing | OrivenAI pricing | AI ad software pricing; no auto-renewal | Transactional |
| /solutions | advertising solutions for small teams | | Hub |
| /solutions/connected-workflow | all-in-one advertising workflow | replace multiple ad tools | Commercial |
| /solutions/research-before-creation | market research for advertising | | Commercial / informational |
| /solutions/plan-to-content | advertising plan to ads | | Commercial / informational |
| /solutions/advertising-campaigns | create, launch and follow ad campaigns | | Commercial |
| /solutions/structured-automation | automate repetitive advertising tasks | approval-based automation | Commercial |
| /learn/adcreative-ai-alternatives/ | AdCreative.ai alternatives | | Comparison |
| /learn/madgicx-alternatives/ (new) | Madgicx alternatives | Meta ads management tools | Comparison |
| /learn/smartly-io-alternatives/ (new) | Smartly.io alternatives | Smartly alternatives for small teams | Comparison |
| /learn/* (other guides) | unchanged, one topic each | | Informational |

**Cannibalization rules:**
- The "ad management software" cluster lives only on `/cross-platform-ad-management/`.
- `/ppc-automation-software/` points PPC-management searchers there.
- `/autopilot` is the feature page; `/ppc-automation-software/` is the category page.
- "All-in-one" lives only on `/solutions/connected-workflow`.
- `/learn/what-is-an-ai-advertising-platform/` stays informational, while the homepage is commercial.

## Google Search Console: what needs doing by hand

1. **Verification.** Confirm that the `orivenai.com` Domain property is verified. A DNS TXT record is the most robust method.
2. **Sitemaps.** Check that `https://orivenai.com/sitemap.xml` is submitted and shows "Success" with 51 discovered URLs after deploy. `robots.txt` already lists it.
3. **Pages report.** Look for "Discovered/Crawled – currently not indexed" and "Duplicate without user-selected canonical", especially `/home.html`, which canonicalizes to `/`.
4. **URL Inspection.** After deploy, run URL Inspection and "Request indexing" for:
   - `/`
   - `/cross-platform-ad-management/`
   - `/learn/madgicx-alternatives/`
   - `/learn/smartly-io-alternatives/`
   - `/create`
   - `/campaigns`
   - `/pricing`
5. **Brand query.** Check Performance → Queries for "orivenai" and "oriven". If the homepage doesn't rank #1 for its own name, check the Pages report for the homepage first.
6. **After 4–8 weeks.** Use Performance → Queries (filter by page) to find queries with impressions but position 8–20. Those are the next optimizations. Keywords are never entered into Search Console.
