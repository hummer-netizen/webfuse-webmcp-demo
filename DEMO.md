# Demo Script — Webfuse + WebMCP 🎬

A 5-minute walkthrough for developers, investors, or potential customers.

---

## Setup (30 seconds)

1. Open **[webfu.se/+bookingcom-agent-demo](https://webfu.se/+bookingcom-agent-demo)** in Chrome
2. The Webfuse Agent sidepanel opens automatically on the right
3. Booking.com loads on the left — fully functional, real site

---

## The One-Line Pitch

> "Chrome 146 ships WebMCP — structured tools for AI agents. But it only works if sites implement it. Webfuse lets YOU define the tools, on any site, today."

---

## Demo Flow 1 — The Wow Moment (90 seconds)

**What to say:**
> "This is the real Booking.com, loaded through Webfuse. On the right is an AI agent with custom semantic tools injected by a Webfuse extension. Watch."

**Type in the sidepanel:**
```
Search for hotels in Amsterdam, April 1-3, 2 guests
```

**What happens:**
- Agent calls `search_hotels({destination: "Amsterdam", checkin: "2026-04-01", checkout: "2026-04-03", guests: 2})`
- The extension fills the destination field, handles the date picker, sets guest count, and clicks search — all in one tool call
- Results appear on Booking.com

**What to say after:**
> "That was one tool call. Without Webfuse, an AI agent would need 10+ turns — click the date field, navigate the calendar, click April, click the 1st, click the 3rd, find the guest dropdown, click plus twice... and it breaks every time the UI changes."

---

## Demo Flow 2 — The Filter (60 seconds)

**Type:**
```
Filter by 4+ stars, under €150/night
```

**What happens:**
- Agent calls `apply_filters({rating_min: 4, price_max: 150})`
- Extension interacts with Booking.com's filter sidebar

**What to say:**
> "The AI builder defines these tools — not Booking.com. That's the key difference from WebMCP."

---

## Demo Flow 3 — The Cross-Site Story (no live demo, just narrative)

**What to say:**
> "Now imagine this journey continues: the user picks a hotel, authenticates with their company SSO, signs a travel policy form on DocuSign, and pays via corporate Stripe. WebMCP breaks the moment one of those sites doesn't implement it. Webfuse proxies the entire session — every site, every step."

---

## Key Talking Points

**If asked "How is this different from Playwright?"**
> "Playwright runs in a headless browser in the cloud. This runs in the user's real browser — their real session, real auth, real cookies. No credential sharing, no anti-bot detection."

**If asked "Why wouldn't sites just implement WebMCP?"**
> "Would Booking.com help AI agents skip their conversion funnel? The incentive isn't there. The parties who want automation are the AI builders, agencies, and enterprises — Webfuse gives them the power."

**If asked "What happens when WebMCP is widely adopted?"**
> "Webfuse still wins on three things WebMCP never covers: cross-site journeys, tools defined by third parties, and legacy apps that will never implement a new standard."

**If asked about scale/enterprise:**
> "Webfuse is SOC2 Type II, ISO 27001, 99.99% uptime. 12+ years of underlying proxy technology. This isn't a hack — it's production infrastructure."

---

## Closing

> "WebMCP asks websites to cooperate. Webfuse doesn't have to ask."

Links:
- Demo: webfu.se/+bookingcom-agent-demo
- Blog: [link to published post]
- Source: github.com/hummer-netizen/webfuse-webmcp-demo
- Webfuse: webfuse.com
