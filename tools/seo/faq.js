// ════════════════════════════════════════════════════════════════
// OrivenAI FAQ: ONE source for the homepage FAQ and the /faq page.
//
//   core      shown on the homepage (#faq) AND on /faq, in this order
//   pageOnly  added below the core questions on /faq only
//
// Answers are HTML (links allowed) and must describe the product as it is
// today: the six sections (Control Center, Research, Create, Launch,
// Campaigns, Automations), plans from js/plans.js / tools/seo/facts.js,
// and the assistant choice as "being introduced in stages".
// After editing: node tools/seo/faq-sync.js, then the prerender
// (node tools/seo/prerender.js). `node tools/seo/faq-sync.js --check`
// exits 1 when index.html is out of sync with this file.
// ════════════════════════════════════════════════════════════════
const F = require('./facts');
const plan = (id) => F.plans.find((p) => p.id === id);
const M = plan('monthly'), FLEX = plan('flex'), C = F.costs;
const n = (x) => x.toLocaleString('en-US');
const core = [
  ['What is OrivenAI?', 'OrivenAI is one connected workspace for your marketing, in six sections: Control Center for your dashboard, marketing plan and business context; Research to investigate a market; Create to build platform-ready ads; Launch to review and publish them; Campaigns to follow performance; and Automations for schedules and rules that act within your limits.'],
  ['What is an OrivenAI assistant?', 'An assistant is the AI personality you work with in OrivenAI. There are six, each with its own specialisation, tone and character. Whichever one you choose can help you across the whole platform, not just in its specialist area. Choosing your assistant is being introduced in stages.'],
  ['Do I use all six assistants at once?', 'No. You choose one assistant, and it stays with you as you move between research, planning, creating, launching and following results. The other five are simply different styles you could pick instead.'],
  ['Can I switch assistants?', 'Choosing an assistant is being introduced in stages, so there is nothing to switch yet. Until then, <a href="/#agents">meet all six</a> to see which style fits you best: each one can help with the whole platform, and they differ in where they are strongest and how they talk to you.'],
  ['Do I need marketing experience?', 'No. You start from your business profile in Control Center, and each section takes you through its step: research, create, launch and follow the results. Experienced advertisers keep full manual control over every campaign.'],
  ['Which advertising platforms are supported?', 'Google Ads, Meta Ads (Facebook and Instagram), TikTok Ads and Pinterest Ads. Every integration uses OAuth: you never share your passwords with OrivenAI, and we never store your credentials.'],
  ['Can OrivenAI launch campaigns automatically?', 'Only the way you set it up. Campaigns you publish from Launch are created paused, so you decide when they start. Automations act only on schedules and rules you explicitly switch on, and each rule either notifies you, asks for your approval or acts within the limits you set.'],
  ['Is there a free plan?', `No. OrivenAI is paid-only, so there is no free plan and no free credits. You can explore every public page, the product pages and the pricing without an account. The shortest plan, Flex, gives you ${FLEX.period} of full access with ${FLEX.credits} for ${F.euro(FLEX.price)}, paid once. Nothing renews automatically. <a href="/pricing">See the plans</a>.`],
  ['What are credits?', `Credits are the usage balance that comes with your plan. A complete image ad uses ${C.imageAd} credits (draft plus image), a video ad ${C.videoAd}, a Research report ${C.researchRun} and an Oriven Chat message ${C.chatMessage}. They’re spent from one pool across every usage-based feature, and unused credits expire when your access ends.`],
  ['How does OrivenAI handle my business data?', 'Your business profile, research and campaigns are stored in your account and used to fit your ads and recommendations to your business. Ad platforms connect over OAuth, so OrivenAI never sees your passwords. Advertising cookies load only with your consent. Read the <a href="/privacy">Privacy Policy</a> for details.'],
];

const pageOnly = [
  ['What’s the difference between the plans?', `Only how long your access runs, what it costs and how many credits it includes. Every plan includes every feature: Research, Create, Launch, Campaigns, Automations, Oriven Chat, in-app notifications and Priority Support. Flex runs ${FLEX.period}, Monthly one month, Quarterly three, Semi-Annual six and Annual twelve; the longer the plan, the lower the price per month. <a href="/pricing">Compare the plans</a>.`],
  ['Does my plan renew automatically?', 'No. You pay once for the period you choose, and nothing is charged when it ends: buy a new period whenever you want to continue, and your work stays in your account. If you buy again before your access ends, the new period starts when the current one ends. Plans of three months or longer add their credits in equal monthly parts.'],
  ['How many ads can I create?', `It depends on your plan and how you split your credits. Monthly’s ${M.credits} are enough for roughly ${Math.floor(M.creditCount / C.imageAd)} image ads or ${Math.floor(M.creditCount / C.videoAd)} video ads if used entirely on one type, fewer if you also use Research or Oriven Chat. There’s no separate ad limit beyond your credit balance.`],
  ['What is Control Center?', 'Control Center is the first of the six sections and where you start. Its Dashboard shows what is happening in your advertising, what needs you and what is next, its Marketing Plan turns your strategy into phases and tasks, and Progress shows which tasks are done. Your business profile and Brand Identity live here too, so every campaign, ad and piece of copy starts from the same context.'],
  ['How does Research work?', 'Research helps you understand your market, competitors and customers before you advertise: market, competitor, audience or opportunity research, each with its own report. It reads real pages and shows which findings were checked against a source, so you know what’s established and what’s an idea to test. Reports are saved to your library. Included in every plan.'],
  ['What are Automations?', 'Automations let you schedule your published campaigns, like switching them on during business hours, and set rules like “if CPA is above €25 over 7 days, lower the budget by 15%”. Each rule either notifies you, asks for your approval or acts within the limits you set, and Activity shows what each one did. Nothing acts without a schedule or rule you switched on. Included in every plan.'],
  ['Can I connect my existing ad accounts?', 'Yes. Connect your existing Google Ads, Meta Ads, TikTok Ads or Pinterest Ads accounts and see the campaigns already running on them in Campaigns. You don’t need to start from scratch.'],
  ['What does connecting an ad account do?', 'Connecting an account (over OAuth, so OrivenAI never sees your password) lets OrivenAI read campaign, spend and performance data from that platform and publish the campaigns you create back to it, from one workspace instead of switching between platforms.'],
  ['Is OrivenAI replacing Google, Meta, TikTok or Pinterest?', 'No. Your campaigns still run on each platform’s own ad system. OrivenAI connects to your existing accounts and brings research, creative, launch, campaign follow-up and automation into one workspace on top of them.'],
  ['What happens if something needs manual setup on the platform’s side?', 'Some platform-side steps, like a platform’s own account verification or ad-account creation, happen on that platform. OrivenAI shows you what’s needed rather than claiming to do it for you.'],
];

module.exports = { core, pageOnly, all: core.concat(pageOnly) };
