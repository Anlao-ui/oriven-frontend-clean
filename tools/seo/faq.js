// ════════════════════════════════════════════════════════════════
// OrivenAI FAQ: ONE source for the homepage FAQ and the /faq page.
//
//   core      shown on the homepage (#faq) AND on /faq, in this order
//   pageOnly  added below the core questions on /faq only
//
// Answers are HTML (links allowed) and must describe the product as it is
// today: the six sections (Overview, Campaigns, Creative Studio, Analytics,
// Research, Autopilot — the app's sidebar, js/appNav.js), plans from js/plans.js / tools/seo/facts.js,
// and the assistant choice as "being introduced in stages".
// After editing: node tools/seo/faq-sync.js, then the prerender
// (node tools/seo/prerender.js). `node tools/seo/faq-sync.js --check`
// exits 1 when index.html is out of sync with this file.
// ════════════════════════════════════════════════════════════════
const F = require('./facts');
const plan = (id) => F.plans.find((p) => p.id === id);
const M = plan('monthly'), FLEX = plan('flex'), C = F.costs;
const n = (x) => x.toLocaleString('en-US');
// The €1 first Flex purchase (js/plans.js ORIVEN_INTRO_OFFER): named only while it is switched on.
const INTRO = require('../../js/plans.js').orvIntroOffer();
const core = [
  ['What is OrivenAI?', 'OrivenAI is one connected workspace for your advertising, in six sections: Overview for your dashboard, AI plans and tasks, and what needs your attention; Campaigns to check and launch campaigns and try budgets first; Creative Studio to make and test ads; Analytics to follow results across your platforms; Research for audience and competitive research; and Autopilot for schedules and rules that act within your limits.'],
  ['What is an OrivenAI assistant?', 'An assistant is the AI personality you work with in OrivenAI. There are six, each with its own specialisation, tone and character. Whichever one you choose can help you across the whole platform, not just in its specialist area. Choosing your assistant is being introduced in stages.'],
  ['Do I use all six assistants at once?', 'No. You choose one assistant, and it stays with you as you move between research, planning, creating, launching and following results. The other five are simply different styles you could pick instead.'],
  ['Can I switch assistants?', 'Choosing an assistant is being introduced in stages, so there is nothing to switch yet. Until then, <a href="/#agents">meet all six</a> to see which style fits you best: each one can help with the whole platform, and they differ in where they are strongest and how they talk to you.'],
  ['Do I need marketing experience?', 'No. You start from your business profile, and each section guides you through its part: researching your market, making ads, launching campaigns and following the results. Experienced advertisers keep full manual control over every campaign.'],
  ['Which advertising platforms are supported?', 'Google Ads, Meta Ads (Facebook and Instagram), TikTok Ads, Pinterest Ads and Snapchat Ads. Every integration uses OAuth: you never share your passwords with OrivenAI, and we never store your credentials.'],
  ['Can OrivenAI launch campaigns automatically?', 'Only the way you set it up. Campaigns you publish from Campaign Studio are created paused, so you decide when they start. Autopilot acts only on schedules and rules you explicitly switch on, and each rule either notifies you, asks for your approval or acts within the limits you set.'],
  ['Is there a free plan?', `No. OrivenAI is paid-only, so there is no free plan and no free credits. You can look around the whole product first in the <a href="/demo">live demo</a>, with sample data and without an account. ${INTRO ? `New customers can try OrivenAI for 2 weeks for ${INTRO.priceLabel}: their first Flex purchase, paid once` : `The shortest plan, Flex, gives you ${FLEX.period} of full access with ${FLEX.credits} for ${F.euro(FLEX.price)}, paid once`}; nothing renews automatically. <a href="/pricing">See the plans</a>.`],
  ['What if OrivenAI isn’t right for me?', `14-day money-back guarantee on regular plans. That means Monthly, Quarterly, Semi-Annual and Annual: if OrivenAI isn’t right for you, email <a href="mailto:contact@orivenai.com">contact@orivenai.com</a> within 14 days of your first purchase of that plan and you get the full amount back, provided no more than 20% of the plan’s credits have been used.${INTRO ? ` The ${INTRO.priceLabel} Flex trial isn’t eligible for a refund.` : ''} Nothing renews automatically, so there is nothing to cancel either. The details are in the <a href="/refund-policy">Refund Policy</a>.`],
  ['What are credits?', `Credits are the usage balance that comes with your plan. A complete image ad uses ${C.imageAd} credits (draft plus image), a video ad ${C.videoAd}, a Research report ${C.researchRun} and an Oriven Chat message ${C.chatMessage}. They’re spent from one pool across every usage-based feature, and unused credits expire when your access ends.`],
  ['How does OrivenAI handle my business data?', 'Your business profile, research and campaigns are stored in your account and used to fit your ads and recommendations to your business. Ad platforms connect over OAuth, so OrivenAI never sees your passwords. Advertising cookies load only with your consent. Read the <a href="/privacy">Privacy Policy</a> for details.'],
];

const pageOnly = [
  ['What’s the difference between the plans?', `Only how long your access runs, what it costs and how many credits it includes. Every plan includes every feature: all six sections (Overview, Campaigns, Creative Studio, Analytics, Research and Autopilot), Oriven Chat, in-app notifications and Priority Support. Flex runs ${FLEX.period}, Monthly one month, Quarterly three, Semi-Annual six and Annual twelve; the longer the plan, the lower the price per month. <a href="/pricing">Compare the plans</a>.`],
  ['Does my plan renew automatically?', 'No. You pay once for the period you choose, and nothing is charged when it ends: buy a new period whenever you want to continue, and your work stays in your account. If you buy again before your access ends, the new period starts when the current one ends. Plans of three months or longer add their credits in equal monthly parts.'],
  ['How many ads can I create?', `It depends on your plan and how you split your credits. Monthly’s ${M.credits} are enough for roughly ${Math.floor(M.creditCount / C.imageAd)} image ads or ${Math.floor(M.creditCount / C.videoAd)} video ads if used entirely on one type, fewer if you also use Research or Oriven Chat. There’s no separate ad limit beyond your credit balance.`],
  ['What is the Overview section?', 'Overview is where you start. Its Dashboard shows what is happening in your advertising and what is next, AI Plans & Tasks turns a plan built around your business into phases and tasks, and Needs Attention lists what needs you, from ad accounts and tracking to campaigns and automations.'],
  ['How does Research work?', 'Research helps you understand your market, competitors and customers before you advertise: market, competitor, audience or opportunity research, each with its own report. It reads real pages and shows which findings were checked against a source, so you know what’s established and what’s an idea to test. Reports are saved to your library. Included in every plan.'],
  ['What is Autopilot?', 'Autopilot lets you schedule your published campaigns, like switching them on during business hours, and set rules like “if CPA is above €25 over 7 days, lower the budget by 15%”. Each rule either notifies you, asks for your approval or acts within the limits you set, and Automation History shows what each one did. Nothing acts without a schedule or rule you switched on. Included in every plan.'],
  ['Can I connect my existing ad accounts?', 'Yes. Connect your existing Google Ads, Meta Ads, TikTok Ads, Pinterest Ads or Snapchat Ads accounts and see the campaigns already running on them in Analytics. You don’t need to start from scratch.'],
  ['What does connecting an ad account do?', 'Connecting an account (over OAuth, so OrivenAI never sees your password) lets OrivenAI read campaign, spend and performance data from that platform and publish the campaigns you create back to it, from one workspace instead of switching between platforms.'],
  ['Is OrivenAI replacing Google, Meta, TikTok, Pinterest or Snapchat?', 'No. Your campaigns still run on each platform’s own ad system. OrivenAI connects to your existing accounts and brings research, creative, launch, campaign follow-up and automation into one workspace on top of them.'],
  ['What happens if something needs manual setup on the platform’s side?', 'Some platform-side steps, like a platform’s own account verification or ad-account creation, happen on that platform. OrivenAI shows you what’s needed rather than claiming to do it for you.'],
];

module.exports = { core, pageOnly, all: core.concat(pageOnly) };
