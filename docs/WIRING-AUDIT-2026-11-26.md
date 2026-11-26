# OrivenAI — functionality & wiring audit (26 November 2026)

Branch `release/design-evolution` (frontend), backend `main` plus local changes (see the end).
How this was checked:
- **Code**: each page's handler, the endpoint it calls and the server route behind it.
- **Automated suites**: fenced browser suites against a mock server, and backend mock suites. None of them touches production or a real ad account.
- **Click-through of the demo workspace**: every visible control on 19 pages (214 controls), with the effect and page errors recorded. Writes are refused by the demo, so nothing left the browser.

**No real advertising account was used in this audit.**

## Legend

| Status | Meaning |
|---|---|
| **Functional** | Frontend and backend wired as intended; covered by automated tests (mocked platforms). |
| **FE only** | Interface exists; backend missing or incomplete. |
| **BE only** | Backend operation exists; frontend integration incomplete. |
| **External** | Needs a connected ad account, API permission or third-party service to do anything. |
| **Real-account verified** | Successfully exercised with a real account. The evidence is named. |
| **Not verified** | Could not be tested under the available conditions (no real account / no live API). |

A feature can carry more than one label, for example "Functional · External · Not verified".

## Overview

| Feature | Status | Notes |
|---|---|---|
| Dashboard: greeting | Functional | First name from `profiles.first_name` (Supabase, the signed-in user only), falling back to the sign-up first name. Never the workspace name or email. Updates when the name loads or is changed in Settings → Account. |
| Dashboard: performance card, KPIs, chart | Functional · External | `/api/analytics/series` per connected platform, fixed to the last 30 days, compared with the previous 30. The period selector is removed. |
| Dashboard: needs attention, platforms, top campaigns, recommendations, Autopilot | Functional | Read from Needs Attention collectors, connections, the campaign store, `/api/onboarding/progress` and `/api/automations/overview`. |
| AI Plans & Tasks: plan, tasks, "Mark as done" | Functional | `POST /api/onboarding/progress`. Optimistic, rolled back with a message if the server refuses. In the demo it is refused (correct). |
| AI Plans & Tasks: "Let OrivenAI do it" | Functional | Inline confirmation (Start/Cancel), then the assistant receives the task. It never marks a task done itself. |
| Needs Attention | Functional · External | Connection status, automation approvals and failures, week-over-week performance rules. Each item opens the relevant page. |

## Campaigns

| Feature | Status | Notes |
|---|---|---|
| Campaign Studio (renamed heading): list, filters, readiness, review | Functional | Campaign store (local and durable `/api/campaigns`), spec review via `POST /api/campaigns/spec`. |
| Publish to Meta / Google / TikTok / Pinterest / Snapchat | Functional (mocked) · External · **Not verified** | `/api/publish/<platform>`: confirmation first, everything created PAUSED, idempotency lock, ledger. The server lists the payloads not yet sent to a live account (`LIVE_UNVERIFIED`). |
| Ad Simulator | Functional | Calculated in the browser (pure engine, 21 tests). Saving uses `/api/simulations` (creative_assets kind `simulation`). Demo refuses saving. |

## Creative Studio

| Feature | Status | Notes |
|---|---|---|
| Create Ads: mode choice (AI / manual) | Functional | New. The choice and the manual draft are kept per account on this device. Switching never discards; "Discard draft" asks first. |
| Create with AI | Functional · External (AI provider) | Existing 6-step flow, unchanged. `/api/ai/create-ad`, image and video generation, credit checks. |
| Create manually (all 5 platforms) | Functional (spec-checked) · **Not verified** | Platform first, then that platform's campaign, ad set/group/squad and ad fields. The package is validated by the real server spec: 40 checks against `services/campaignSpec.js` pass with no errors for complete drafts on all platforms, including Google Search and Performance Max. Saved as a draft. Publishing goes through Campaign Studio with the existing publish routes. Uploads use `/api/manual-campaigns/upload-creative` (images ≤ 8 MB, video ≤ 12 MB). |
| My Creatives | Functional | `creative_assets` list, filters, search, preview dialog, copy, favourite and duplicate. New: "Made with AI" / "Uploaded by you" from the stored route or kind (unknown origin is left blank, not guessed). |
| Creative Testing | Functional · External (AI provider) | Variation generation (credits), side-by-side compare, pick. No per-version results until a platform reports them. |

## Analytics

| Feature | Status | Notes |
|---|---|---|
| Performance Overview: core metrics, charts, period compare | Functional · External | `/api/analytics/series`. Spend, impressions, clicks, conversions and value per day; CTR, CPC, CPM, CPA, conversion rate and ROAS derived. Missing value means ROAS is not computed (never 0). |
| Performance Overview: platform metrics (new) | Functional (mocked) · External · **Not verified** | `/api/analytics/extras`: period totals per platform (see the next section). A refused field shows "couldn't be loaded"; core figures are unaffected. 18 mock checks. |
| Cross-platform Comparison | Functional · External | Same series for all connected platforms. Conversions as each platform defines them; Snapchat value not reported. |
| Ads vs Ads | Functional · External | Per-ad daily series exists for Google and Meta only (the server answers 422 for the others, and the page says so). |

## Research

| Feature | Status | Notes |
|---|---|---|
| Audience Research / Competitive Research | Functional · External (AI provider, web) | Async research jobs (90 credits), quote-checked sources, library. |
| Saved Research | Functional | `/api/research/insights`, save and "Create ads from this". |

## Autopilot

| Feature | Status | Notes |
|---|---|---|
| Automation Overview, My Automations, History, Scheduler | Functional · External · **Not verified** | `/api/automations/*`: rules, approvals, jobs, activity. Actions on live campaigns need confirmation or limits. Execution against real ad accounts has not been verified. |

## Settings and accounts

| Feature | Status | Notes |
|---|---|---|
| General, Account, Notifications, Security, Subscription, Help | Functional | Existing Settings modal. Subscription uses Stripe via the backend. |
| Advertising settings (Meta, Google, TikTok, Pinterest, Snapchat) | Functional (mocked) · External · **Not verified** | Shown inside Settings. `/api/setup/*` actions are marked "Not yet verified with a real ad account" (`REAL_ACCOUNT_VERIFIED` all false). Snapchat is guided only. |
| Ad Platforms (connect, account choice) | Functional · External | OAuth per platform. **Real-account verified**: Snapchat OAuth connection (Snapchat Ads round, 2026-11-14). Other connections have been used before, but not re-verified in this audit. |
| Checkout (Flex €1) | **Real-account verified** (live, 2026-11-16, €1.21 incl. VAT) | Not re-run here. |

## AI assistant

| Feature | Status | Notes |
|---|---|---|
| Persona (chosen once at onboarding) | Functional | `GET/PUT /api/agent`, server-side. The choice is permanent (the server refuses switches). Persona colour on assistant elements only. |
| Opening introduction | Functional | "Hey, I am {persona}. {its own line}" as an assistant message. Not stored, not sent. Earlier conversations appear under it. |
| Chat, context, tool cards, confirmations | Functional · External (AI provider) | `/api/ai/chat` with page, campaign, analytics and account context. Tool results become cards. Live-campaign changes wait for confirmation. |
| Credits | Functional | Pre-flight `gateUsage`; failed answers are refunded by the server. Cost shown under the composer (30 per message, up to 90 with steps). |

## Platform metrics now available (Performance Overview → Platform metrics)

These are period totals for the page's period and campaign. Sources: official platform reporting documentation and reference material; none of these has been read from a live account by OrivenAI yet.

| Platform | Metrics |
|---|---|
| Meta | Reach, frequency, link clicks, landing page views, 3-second video plays, ThruPlays, video watched to 100%, post engagements, purchases, purchase value |
| Google Ads | Interactions, engagements, view-through conversions |
| TikTok | Reach, frequency, video plays, 2-second views, video watched to 100%, likes, comments, shares, follows, profile visits |
| Pinterest | Reach (total impression users), engagements, 3-second video views, video watched to 100%, checkouts, checkout value |
| Snapchat | Video views, watched 25/50/75%, watched to the end, swipe-ups |

**Normalised across platforms**, in the metric cards and Cross-platform Comparison: spend, impressions, clicks, CTR, CPC, CPM, conversions, conversion rate, CPA, conversion value, ROAS. ROAS is only shown where the platform reports value. Currency is per account and never converted or added across platforms.

**Not combined across platforms**: reach, frequency, video, engagement and purchase metrics. Their definitions differ (for example, a video view is 3 s on Meta and Pinterest and 2 s or a swipe on Snapchat), so they are shown per platform with each platform's definition.

**Not available yet** (through OrivenAI's backend):
- Google video views. The GAQL field naming is changing between API versions and was left out rather than risk breaking the request.
- Search impression share per day (not additive).
- TikTok and Snapchat conversion value.
- Meta per-placement breakdowns.
- Attribution-window settings. Each platform's own account setting applies.

## Remaining limitations found

- No real-account verification for publishing, platform metrics, Advertising settings actions or automations.
- Manual creation: one ad set/group and one ad per campaign. Google Display or video campaigns and Meta video ads are not publishable by OrivenAI, so they are not offered.
- Manual creation texts and assistant texts are English only. Navigation labels, help tooltips and the Dashboard are translated.
- The Pinterest overview route (pre-existing) adds reach across campaigns. Reach is de-duplicated per campaign, so that total overstates it. The new platform-metrics route does not add it up.
