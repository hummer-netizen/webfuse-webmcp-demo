# Reddit Posts

---

## r/AI_Agents

### Title:
Chrome 146 ships WebMCP today. Here's why it won't help you for years — and what actually works right now.

### Body:
Chrome 146 just shipped with WebMCP — a standard that lets websites expose structured tools for AI agents. Sounds great in theory. Here's the problem.

**WebMCP only works if the site cooperates.** And most sites won't.

Think about it: why would Booking.com expose a `search_hotels()` tool that lets your AI agent skip their upsells, ads, and conversion funnel? They have zero incentive.

It gets worse. Real agent workflows don't live on one site. Your AI travel agent needs to search Booking.com → authenticate via SSO → sign on DocuSign → pay via Stripe. If ANY site in the chain doesn't support WebMCP, the workflow breaks.

And here's the fundamental issue: WebMCP puts responsibility on the site owner. But the party who wants automation is YOU — the AI builder. You need to define the tools, on sites you don't own.

**We've been building a different approach.** Webfuse is a proxy layer that lets you inject custom semantic tools on any website, through the user's live browser session. No extension install. No credential sharing. No cooperation needed from the site.

Instead of your agent spending 10+ turns trying to click through Booking.com's date picker, you define `search_hotels({destination, dates, guests})` once. The extension handles the UI complexity. The agent makes one call.

**Live demo on Booking.com:** [webfu.se/+bookingcom-agent-demo](https://webfu.se/+bookingcom-agent-demo)

Full blog post: [link to dev.to or webfuse.com post]

Source code: [github.com/hummer-netizen/webfuse-webmcp-demo](https://github.com/hummer-netizen/webfuse-webmcp-demo)

Curious what approaches others are using for web-interacting agents. Playwright scripts? Remote browsers? Something else?

### Flair: Tools / Discussion

---

## r/webdev

### Title:
WebMCP ships in Chrome 146 today. As someone building AI web automation, here are three things nobody's talking about.

### Body:
Chrome 146 is out with WebMCP — the new standard where sites expose MCP tool endpoints for AI agents. It's genuinely well-designed. But having built web automation for production AI agents, there are three things the hype is missing:

**1. The incentive problem.** WebMCP asks site owners to expose structured tools that make it easier for agents to bypass their UI. For content sites that depend on engagement, ad views, and conversion funnels — this is actively against their interests. Compare to AMP: Google had to basically force publishers. Who's forcing Booking.com to implement `search_hotels()`?

**2. The single-page problem.** Real automation spans multiple sites. A hotel booking workflow might touch a search engine, a booking site, an auth provider, a payment gateway, and an e-signature service. WebMCP is per-site. If one link in the chain doesn't implement it, you're back to fragile DOM automation for that step.

**3. The ownership problem.** WebMCP puts the site owner in charge of what tools are available. But the people who want AI automation are often third parties — agencies, consultancies, enterprise teams automating internal tools. They can't add WebMCP to sites they don't own.

We've been working on a proxy-based approach (Webfuse) where the AI builder defines semantic tools on any site. The user browses through the proxy with their real session, and injected extensions expose structured tools without the site having to change.

Demo on Booking.com where a single `search_hotels()` call replaces 10+ fragile click/fill steps: [webfu.se/+bookingcom-agent-demo](https://webfu.se/+bookingcom-agent-demo)

Not saying WebMCP is bad — it's the right direction for sites that choose to adopt it. But for anyone building AI agents that need to work on the real web today, waiting for universal adoption isn't a strategy.

What's your take? Will site owners actually implement WebMCP, or will it be like structured data / schema.org — technically available, practically ignored by most?

### Flair: Discussion

---

## r/LocalLLaMA or r/MachineLearning (optional, if you want technical reach)

### Title:
Built an AI agent that uses semantic tools on Booking.com — no site cooperation needed

### Body:
Quick demo of something we've been building. Instead of having an LLM agent try to click through complex web UIs (date pickers, nested dropdowns, autocomplete fields), we inject custom tools via a proxy layer.

**Before:** Agent snapshot → 5,283 DOM elements → 10+ turns of click/fill → breaks when UI updates

**After:** Agent calls `search_hotels({destination: "Amsterdam", checkin: "2026-04-01", checkout: "2026-04-03", guests: 2})` → 1 turn → always works

The extension handles all the UI complexity internally. The LLM just calls structured tools.

This is relevant now because Chrome 146 just shipped WebMCP (sites can natively expose tools for agents), but it requires site owner implementation. Our approach works on any site today.

Live demo: [webfu.se/+bookingcom-agent-demo](https://webfu.se/+bookingcom-agent-demo)
Source: [github.com/hummer-netizen/webfuse-webmcp-demo](https://github.com/hummer-netizen/webfuse-webmcp-demo)

Stack: Webfuse (proxy) + Claude Haiku 3 for agent reasoning + streaming SSE for responsive UX

Happy to answer technical questions about the architecture.
