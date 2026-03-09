# WebMCP Asks Websites to Cooperate. Webfuse Doesn't Have to Ask.

Chrome 146 shipped today. With it comes WebMCP — a new standard that lets websites expose structured tools for AI agents. No more blind DOM clicking. Sites publish endpoints; agents call them like APIs.

It's elegant. It's the right direction. And it will take years to matter.

Here's why — and what you should build on instead.

---

## The WebMCP Promise (and Its Three Fatal Assumptions)

WebMCP assumes three things:

1. **That site owners will implement it.** They won't — at least not fast. Why would Booking.com help your AI agent bypass their carefully designed conversion funnel? Every structured tool they expose is a user who *doesn't* see their upsells, their ads, their "recommended for you" carousel. The incentive isn't there.

2. **That one site is enough.** Real journeys cross boundaries. A travel agent's AI doesn't just search hotels — it searches Booking.com, authenticates via SSO, signs a contract on DocuSign, processes payment through Stripe, and sends a confirmation email. If *any* step in that chain doesn't support WebMCP, the whole automation breaks. Legacy apps will never implement it. Payment providers won't prioritize it. That one uncooperative site in the chain becomes your bottleneck.

3. **That the site owner is the right party to define the tools.** This is the deepest problem. WebMCP puts responsibility on the *publisher*. But the party who actually wants AI automation isn't the site owner — it's the *business building on top*. The travel agency layering expertise over Booking.com. The insurance broker comparing quotes across five portals. The HR consultancy automating applications across job boards. These value-adders need to define their own tools, on sites they don't own.

WebMCP is cooperation from the inside. What the market needs is **augmentation from the outside**.

---

## What Augmentation From the Outside Looks Like

Webfuse is a proxy that sits between the user's browser and the web. The user browses normally — their real session, real cookies, real auth. Webfuse intercepts the page and lets you inject an extension layer that gives AI agents:

- **Structured snapshots** of any page — headings, interactive elements, form fields, stable selectors
- **Actions** — click, fill, navigate, scroll — on the user's live session
- **Custom semantic tools** — you define them, on any site, without the site's permission

This means the travel agency can build `search_hotels({destination, dates, guests})` as a tool that wraps Booking.com's complex form interactions internally. The AI agent calls one function. The extension handles the date picker, the guest counter, the autocomplete dropdown — all the UI complexity that breaks generic automation.

The site didn't implement anything. Webfuse added the intelligence from outside.

---

## Watch the Difference

Here's an AI agent booking a hotel on Booking.com. First, the hard way:

```
Agent → snapshot()              # 5,283 elements on the page
Agent → click("#destination")   # focus the search field
Agent → fill("#destination", "Amsterdam")
Agent → wait for autocomplete...
Agent → click(autocomplete suggestion)  # which one? hope for the best
Agent → click(date field)
Agent → navigate calendar to April...
Agent → click(April 1)
Agent → click(April 3)
Agent → click(guest dropdown)
Agent → click(+ button for adults)  # twice? three times?
Agent → click(search button)

# 10+ turns. Fragile selectors. Calendar navigation breaks constantly.
# The guest counter has nested +/- buttons that change IDs on every render.
```

Now with Webfuse semantic tools:

```
Agent → search_hotels({
  destination: "Amsterdam",
  checkin: "2026-04-01",
  checkout: "2026-04-03",
  guests: 2
})

# 1 turn. Always works. The extension handles the UI complexity internally.
```

**[→ Try it live: webfu.se/+bookingcom-agent-demo](https://webfu.se/+bookingcom-agent-demo)**

---

## Why This Can't Wait for WebMCP

Even in a world where WebMCP is universally adopted (optimistically: 2028+), Webfuse solves three things WebMCP never will:

### 1. Cross-Site Journeys

No standard covers a journey that spans Booking.com → DocuSign → Stripe → Gmail. WebMCP is per-site, per-page. Webfuse proxies the *entire session* — one proxy, full journey control, regardless of how many sites or third-party apps are involved.

### 2. Third-Party Value Creation

The most valuable AI applications are built by businesses who *combine* web resources with domain expertise. A travel advisor who searches five booking sites and recommends the best option. An insurance broker who compares quotes across carriers. A recruiting firm that automates applications across job boards.

None of these businesses own the sites they automate. WebMCP gives them nothing. Webfuse gives them everything.

### 3. Legacy and Uncooperative Sites

That internal ERP from 2014. The government portal that hasn't been updated since 2019. The payment provider that will never prioritize WebMCP. These sites aren't going anywhere, and neither is the need to automate them. Webfuse doesn't need their cooperation.

---

## The Architecture

```
┌──────────────────────────────────────────────┐
│  User's Browser (real session, real auth)     │
│  ┌────────────┐  ┌────────────────────────┐  │
│  │ Any Website │  │ Webfuse Extension Layer │  │
│  │ (unchanged) │  │ • Semantic tools        │  │
│  │             │  │ • Page snapshots        │  │
│  │             │  │ • AI agent sidebar      │  │
│  └──────┬──────┘  └────────────┬───────────┘  │
│         │                      │              │
│         └──────┬───────────────┘              │
│                │                              │
│         ┌──────┴──────┐                       │
│         │ Webfuse     │                       │
│         │ Proxy Layer │                       │
│         └──────┬──────┘                       │
│                │                              │
└────────────────┼──────────────────────────────┘
                 │
        ┌────────┴────────┐
        │ Your AI Agent   │
        │ (Claude, GPT,   │
        │  Vapi, custom)  │
        └─────────────────┘
```

No extension install for the end user. No credential hand-off. No headless browser in the cloud. The user browses their real site, through Webfuse, and your agent operates in their live session.

---

## Webfuse vs. Everything Else

|  | Webfuse | WebMCP (native) | Claude in Chrome | Remote Browsers | Playwright |
|--|---------|----------------|-----------------|-----------------|------------|
| Works on any site today | ✅ | ❌ (site must implement) | ✅ | ✅ | ✅ |
| Real user session | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cross-site journeys | ✅ | ❌ | ❌ | ⚠️ | ⚠️ |
| Custom tools (your definition) | ✅ | ❌ (site defines) | ❌ | ❌ | ✅ (fragile) |
| No client install | ✅ | ✅ | ❌ | ✅ | ✅ |
| Legacy app support | ✅ | ❌ | ✅ | ⚠️ | ⚠️ |
| Productizable (embed in your app) | ✅ | N/A | ❌ | ⚠️ | ✅ |
| Enterprise-grade (SOC2, ISO27001) | ✅ | N/A | ❌ | Varies | ❌ |

---

## Who This Is For

**Voice AI builders** (Vapi, ElevenLabs, Deepgram): Your agent has a brain. Webfuse gives it hands. Book hotels, fill forms, navigate portals — in the user's live session, by voice.

**Automation builders** (LangChain, CrewAI, OpenAI Agents SDK): Stop maintaining Playwright scripts. Define semantic tools once, let the proxy handle the UI complexity.

**Enterprise teams**: Automate internal portals, legacy apps, and third-party tools without waiting for vendors to ship APIs or WebMCP support. SOC2 Type II. ISO 27001. 99.99% uptime.

**AI consultancies and agencies**: Build productized AI journeys on your clients' web apps. Your expertise + Webfuse tools = repeatable value.

---

## The Bottom Line

WebMCP is the right idea. Structured tools for AI agents are the future. But waiting for every site to implement it is like waiting for every restaurant to join a single delivery platform.

Webfuse doesn't wait. It gives *you* — the AI builder, the automation team, the domain expert — the power to define tools on any site, control entire journeys, and ship today.

**WebMCP asks websites to cooperate. Webfuse doesn't have to ask.**

**[→ See the Booking.com demo](https://webfu.se/+bookingcom-agent-demo)**
**[→ View the source](https://github.com/hummer-netizen/webfuse-webmcp-demo)**
**[→ Get started with Webfuse](https://webfuse.com)**
**[→ Talk to the team](https://webfuse.com/contact)**

---

*Built with Webfuse. Questions: [hummer@nichol.as](mailto:hummer@nichol.as)*
