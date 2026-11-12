# OrivenAI as an ad workspace — design research and restructuring proposal

Date: 2026-11-10. Worktree: `C:\files\oriven-frontend-ws` (branch `workspace/ad-workspace`, based on GitHub `main` ec72620). Nothing committed.

## 1. Tools available and used

| Tool | Status | Used for |
|---|---|---|
| Design plugin (Anthropic `design` 1.2.0): design-system, design-critique, ux-copy, accessibility-review, design-handoff, research-synthesis, user-research | Installed, works without connectors | Token/component audit (§3), critique passes on screenshots, UX copy, accessibility checks |
| `frontend-design` skill (official marketplace) | Installed | Design method: plan → critique → build → critique; restraint, one signature element, copy rules |
| Marketing plugin (content-creation, brand-review, competitive-brief) | Installed | Positioning copy, brand-voice review |
| Figma, Canva, Intercom connectors (design / marketing plugins) | Need sign-in (not available in this session) | — |
| Playwright MCP server | Failed to connect this session | Replaced by the Playwright library already in the repo (screenshots, recordings) |
| Web fetch | Partly worked | Google Ads "About recommendations", Linear pricing, Stripe pricing read; Google Ads navigation/Overview help pages and Meta Ads Manager help pages returned 404 or unrelated pages |

Honesty note: patterns below marked **[source]** come from pages read in this session; **[product knowledge]** are well-known traits of Google Ads / Meta Ads Manager not re-verified here.

## 2. Patterns found

1. **Recommendations as their own place, with a reason and an honest empty state** [source: Google Ads Help, "About recommendations"] — each suggestion explains why; the empty state says why none appear ("…if your ads recently started running").
2. **Overview first, detail one click away** [product knowledge] — Google Ads opens on an Overview of cards (performance, recommendations); Meta Ads Manager lists campaigns → ad sets → ads with the status in the first column.
3. **Status in form, not only colour** [product knowledge] — Active/Paused/In review shown as a labelled pill.
4. **Billing period beside the price** [source: Linear pricing] — "Billed yearly" under the number, no hidden toggle; cumulative tiers list only what is added.
5. **Usage-based items footnoted** [source: Linear — "Require AI credits"] — maps to OrivenAI credits.
6. **Plain statements of what is and isn't charged** [source: Stripe pricing] — "no setup or monthly fees"; maps to "one payment, no automatic renewal".
7. **Navigation by task, not object** [source: Google Help taxonomy; Stripe product groups] — matches OrivenAI's six sections (Control Center, Research, Create, Launch, Campaigns, Automations).
8. **Details on demand** (drawer or modal) [product knowledge: Meta "View details"/side panels] — key facts visible in the first screen, depth in a side drawer instead of a long scroll.

## 3. Design-system audit (design-system skill)

Measured in `css/*.css` (29 files, ~56,500 lines):

| Category | Finding |
|---|---|
| Colors | Brand tokens exist (`--green #B7FF2A`, dark surfaces `#0A0A0A/#18181A`); 2,826 hard-coded hex values |
| Radius | 29 distinct values (10, 8, 12, 20, 14, 6, 7, 16, 9 px most used); tokens `--r 10 / --rl 14 / --rx 18` exist but are rarely used |
| Typography | 49 distinct font sizes (13, 12, 11, 14, 12.5, 10 px most used) |
| Cards | 20+ card families (`rx-card`, `oi-card`, `ins-card`, `bsp-card`, `atm-card`, …) |
| Overrides | 4,367 `!important` |

**Decision:** keep the palette. Add one shared layer, `css/ow-system.css` — spacing scale, type scale, three radii, elevation, status pills, cards, equal-height grids, section heads, drawer/modal, video player — and use it on every surface touched now (landing, pricing, agents, Marketing Plan, videos). Rewriting all 49k lines of `styles.css` in one pass would put the working product at risk; existing pages migrate when next touched.

## 4. Positioning

- **Promise:** Your new ad workspace — plan, create, launch and improve your advertising from one place.
- **Not:** a collection of AI assistants. The assistant is a helper inside the workspace.
- **Honesty layer, shown everywhere a capability is described:**
  - **In OrivenAI** — research, plans, ad copy/images/video, comparisons, rules are made here.
  - **Prepared for you** — audiences and campaign structures are prepared in OrivenAI.
  - **Through your ad account** — publishing (created paused), reading performance, rule actions run through Google Ads, Meta, TikTok or Pinterest once connected (OAuth).
  - **Not yet** — anything not supported is named, never implied.

## 5. Landing page — new order

| # | Section | Change |
|---|---|---|
| 1 | Hero | New thesis: "Your new ad workspace." + one-sentence promise; CTAs: Get started / See the workspace |
| 2 | Problem ("Your research lives in one tab…") | Kept: it states the problem the workspace solves |
| 3 | **NEW — The workspace** | One composition: the seven connected steps (business → strategy → research → content → campaigns → results → optimise), each with the real pages and an honesty tag (In OrivenAI / Prepared / Through your ad account) |
| 4 | One loop, six sections | Kept (internal links to every section page) |
| 5 | Inside OrivenAI (product films) | The six new section videos replace the old films (one tab per section) |
| 6 | Marketing plan | "A plan built around your business." — roadmap with phases and actionable tasks |
| 7 | Assistant | Moved down, reframed ("An assistant inside your workspace"), details visible in the first screen + "View profile" drawer |
| 8 | Integrations, Trust, FAQ | Kept |
| 9 | Final CTA | "Start your ad workspace."; six agent chips removed; section height reduced |

## 6. Application — central workspace

Six sections stay the top level (no new categories). Within them: the Marketing Plan becomes the roadmap that links every step to its tool, with expected result and the kind of action (In OrivenAI / Prepared / Through your ad account) on every task; the assistant panel gains an "About your assistant" drawer; each section's first page gets a "Watch overview" action that opens its video.

## 7. Components to standardise (`ow-` prefix)

`ow-section-head`, `ow-card` (+ `--interactive`, `--feature`), `ow-grid` (`--2/3/4`, equal heights by default, `--masonry` opt-out for content-driven layouts), `ow-tag` (status/honesty pills: `--done`, `--prepared`, `--platform`, `--soon`), `ow-drawer` (side panel, focus-trapped, Esc/overlay close, full-screen on phones), `ow-video` (poster + play → modal player, captions track, no autoplay).

## 8. The six videos (one per main section)

| Video | Main section | Pages included (verified in `js/appNav.js`) | Workflow shown |
|---|---|---|---|
| 1 | Control Center | Dashboard, Marketing Plan, Progress (+ Ad Platforms) | See what needs attention → open the plan → follow a task → progress |
| 2 | Research | Research, Insights, Competitor Analysis | Start research → read findings with sources → insights → competitors |
| 3 | Create | Create, Creative Testing, My Content | Brief → generated ad → variations → saved content |
| 4 | Launch | Ad Studio, Audience Builder | Audience → draft readiness per platform → publish (created paused) |
| 5 | Campaigns | Campaign Overview, Campaign Comparison, Campaign Builder | Performance by platform → compare → open a campaign to edit |
| 6 | Automations | Overview, Scheduler, Rules, Activity | Rule with limits → schedule → approval → activity log |

Recorded from the real app (current code) with a labelled sample workspace and a local mock API — nothing published, charged or written; captions instead of narration (no speech tool installed).
