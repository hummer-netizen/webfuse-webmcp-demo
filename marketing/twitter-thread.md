# Twitter/X Thread

## Tweet 1 (hook):
Chrome 146 ships today with WebMCP — structured tools for AI agents, built right into the browser.

It's the right idea. And it has three fatal assumptions.

🧵

## Tweet 2:
Fatal assumption #1: Site owners will implement it.

Why would Booking.com expose a search_hotels() tool that helps AI agents bypass their upsells, ads, and conversion funnel?

They won't. The incentive isn't there.

## Tweet 3:
Fatal assumption #2: One site is enough.

Real AI workflows cross boundaries:
- Search on Booking.com
- Authenticate via SSO
- Sign on DocuSign
- Pay via Stripe

WebMCP is per-page. If ANY step doesn't support it, the whole automation breaks.

## Tweet 4:
Fatal assumption #3: The site owner should define the tools.

But the party who WANTS AI automation isn't the publisher — it's the business building on top.

The travel agency. The insurance broker. The HR consultancy. They need tools on sites they don't own.

## Tweet 5:
WebMCP is cooperation from the inside.

What the market needs is augmentation from the outside.

That's what we built with @webfuse.

## Tweet 6:
Instead of asking websites to expose tools, Webfuse lets the AI BUILDER define them.

It's a proxy. User browses with their real session. You inject semantic tools on any page.

Before: 10+ fragile click/fill turns on Booking.com
After: search_hotels({destination, dates, guests}) → 1 call

## Tweet 7:
Live demo — an AI agent booking on Booking.com with semantic tools, no site cooperation needed:

🔗 webfu.se/+bookingcom-agent-demo

Source: github.com/hummer-netizen/webfuse-webmcp-demo

## Tweet 8 (closing):
WebMCP asks websites to cooperate.
Webfuse doesn't have to ask.

Full write-up: [link to blog post]

---

## Standalone tweet (alternative to thread):
Chrome 146 ships WebMCP today — sites can expose tools for AI agents.

Great idea. Three problems:
1. Sites won't implement it (wrong incentives)
2. Real workflows span multiple sites
3. AI builders, not site owners, should define the tools

We built the alternative → webfu.se/+bookingcom-agent-demo
