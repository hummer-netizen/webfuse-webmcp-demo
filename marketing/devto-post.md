---
title: "WebMCP Asks Websites to Cooperate. Webfuse Doesn't Have to Ask."
published: true
description: "Chrome 146 ships with WebMCP — structured tools for AI agents. It's the right idea with three fatal assumptions. Here's what to build on instead."
tags: webdev, ai, automation, browser
canonical_url: https://webfuse.com/blog/webmcp-webfuse
cover_image:
---

Chrome 146 shipped today. With it comes WebMCP — a new standard that lets websites expose structured tools for AI agents. No more blind DOM clicking. Sites publish endpoints; agents call them like APIs.

It's elegant. It's the right direction. And it will take years to matter.

## The Three Fatal Assumptions

**1. Site owners will implement it.**

They won't — at least not fast. Why would Booking.com help your AI agent bypass their carefully designed conversion funnel? Every structured tool they expose is a user who *doesn't* see their upsells, their ads, their "recommended for you" carousel.

**2. One site is enough.**

Real journeys cross boundaries. A travel agent's AI doesn't just search hotels — it searches Booking.com, authenticates via SSO, signs a contract on DocuSign, processes payment through Stripe. If *any* step doesn't support WebMCP, the automation breaks. Legacy apps will never implement it.

**3. The site owner should define the tools.**

WebMCP puts responsibility on the *publisher*. But the party who actually wants AI automation is the *business building on top*. The travel agency layering expertise over Booking.com. The insurance broker comparing quotes across portals. These value-adders need to define their own tools, on sites they don't own.

## Augmentation From the Outside

[Webfuse](https://webfuse.com) takes a different approach. It's a proxy that sits between the user's browser and the web. The user browses normally — real session, real auth. Webfuse lets you inject an extension layer that exposes custom tools to AI agents on *any* site, without the site's permission.

The travel agency builds `search_hotels({destination, dates, guests})` as a tool that wraps Booking.com's complex form interactions. The AI calls one function. The extension handles the date picker, guest counter, autocomplete — all the UI complexity that breaks generic automation.

The site didn't implement anything. The AI builder added the intelligence from outside.

## Watch the Difference

**Without semantic tools** — agent tries to automate Booking.com:

```
snapshot() → 5,283 elements
click("#destination")
fill("#destination", "Amsterdam")
wait for autocomplete...
click(suggestion) → which one?
click(date field)
navigate calendar → click April 1 → click April 3
click(guest dropdown) → click + button → how many times?
click(search)

# 10+ turns. Fragile. Breaks when UI changes.
```

**With Webfuse semantic tools:**

```
search_hotels({
  destination: "Amsterdam",
  checkin: "2026-04-01",
  checkout: "2026-04-03",
  guests: 2
})

# 1 turn. Always works.
```

**[→ Try it live on Booking.com](https://webfu.se/+bookingcom-agent-demo)**

## Three Things WebMCP Will Never Solve

Even in a world where WebMCP is universal (optimistically 2028+):

**Cross-site journeys.** No standard covers Booking.com → DocuSign → Stripe → Gmail. WebMCP is per-site, per-page. Webfuse proxies the entire session end-to-end.

**Third-party value creation.** The most valuable AI apps combine web resources with domain expertise — a broker comparing five portals, a consultant automating across job boards. They don't own the sites. WebMCP gives them nothing.

**Legacy and uncooperative sites.** That ERP from 2014. The government portal last updated in 2019. The payment provider that will never prioritize WebMCP. These aren't going anywhere.

## The Bottom Line

WebMCP is the right idea. Structured tools for AI agents *are* the future. But waiting for every site to implement it is like waiting for every restaurant to join a single delivery platform.

**WebMCP asks websites to cooperate. Webfuse doesn't have to ask.**

**[→ Live Booking.com demo](https://webfu.se/+bookingcom-agent-demo)** | **[→ Source code](https://github.com/hummer-netizen/webfuse-webmcp-demo)** | **[→ webfuse.com](https://webfuse.com)**
