# WebMCP Is Coming. Webfuse Is Already Here.

*March 2026* — Google just shipped WebMCP in Chrome 146. Microsoft engineers co-authored the spec. The W3C is incubating it. The pitch is elegant: websites publish structured MCP endpoints, and AI agents call them directly — no more blind DOM-clicking, no more fragile CSS selectors, no more praying that a site update didn't break your automation.

It's a great idea. It's also going to take years.

---

## The Gap Between Vision and Reality

Here's how WebMCP adoption actually plays out:

Chrome ships it → developers hear about it → it goes on roadmaps → it gets deprioritised → a standard body argues about the spec → enterprise procurement approves a budget → a developer finally implements it → the site deploys it → your AI agent can use it.

That's not a pessimistic take. That's just how web standards work. CSS Grid took six years from spec to broad adoption. Service Workers took four. WebMCP is a more complex coordination problem than either — it requires every site you want to automate to opt in *and* do the implementation work.

Meanwhile, you have agents to ship. Today.

---

## What Your Agent Actually Needs

Let's be concrete. Your voice agent is helping users navigate a web application — maybe a legacy CRM, a government portal, an insurance quote flow, a travel booking site. The user says "find me a flight to Amsterdam next Tuesday under €300" and your agent needs to:

1. See the current state of the page
2. Click the right things
3. Fill the right fields
4. Read back the results

For WebMCP, all of this is clean and structured. The site exposes `search_flights(destination, date, max_price)` as an MCP tool and your agent calls it. Beautiful.

Without WebMCP — which is every site on the internet right now — your options are:

- **Playwright/Puppeteer**: Brittle, headless, blocked by anti-bot systems. Doesn't use the user's session, so authentication is a nightmare. Breaks every time the site updates.
- **Browser extensions**: Great DX, but require user installation. IT departments block them. Doesn't scale.
- **Custom integrations**: Weeks of development per site, requires source code access or API keys you may not have.
- **Remote browser services**: Fast to set up, but they run in *their* isolated browser. Your user's auth, their cookies, their session state — none of it carries over.

None of these are good. This is the gap WebMCP will eventually fill.

---

## The Proxy Approach: WebMCP-Grade Access Today

There's a different architecture that solves this now, without waiting for sites to implement anything.

**Webfuse is a reverse proxy with an augmentation layer.** Instead of automating a remote browser or injecting a brittle script, Webfuse sits between the user and the website. The user's real browser loads the real site — with their real auth, their real cookies, their real session — through the Webfuse proxy. Webfuse then injects a sandboxed extension layer that gives your AI agent:

- **Eyes**: A structured, LLM-readable snapshot of the current page state
- **Hands**: Programmatic control — clicks, form fills, navigation — without touching the site's source code

This is exactly what WebMCP promises, running on every website, right now.

---

## The Architecture in Three Steps

**Step 1 — Create a Webfuse Space**

A Space is a reverse-proxy configuration. You point it at a website, configure access, and get a URL. No code changes to the target site.

```
https://webfu.se/+your-space/ → https://any-website.com
```

**Step 2 — Write a Webfuse Extension**

An Extension is a sandboxed app injected into the proxied session — structurally identical to a browser extension, but deployed at the proxy layer. Your extension can:

- Read the DOM and generate structured page snapshots
- Click elements by AI-suggested selectors
- Fill forms, submit, navigate
- Expose all of this as a clean tool API to your agent

```javascript
// content.js — running inside the proxied page
window.webfuse.exposeApi({
  snapshot: () => extractPageSnapshot(),
  click: (selector) => document.querySelector(selector)?.click(),
  fill: (selector, value) => { document.querySelector(selector).value = value }
});
```

**Step 3 — Connect Your Agent**

Wire your agent (Claude, GPT-4o, ElevenLabs, Vapi — any LLM platform with tool calling) to the Extension API. The agent sees the page, decides what to do, calls the tools.

```javascript
// Agent tool definitions
const tools = [
  { name: "snapshot", description: "Get current page state as structured JSON" },
  { name: "click", description: "Click an element by CSS selector" },
  { name: "fill", description: "Fill a form field" },
  { name: "navigate", description: "Go to a URL" }
];
```

Your agent is now operating on a live user session — real auth, real state, zero latency — on any website, without WebMCP.

---

## Webfuse vs The Alternatives

| | Webfuse | Playwright | Remote Browser | Browser Extension |
|---|---|---|---|---|
| Real user session | ✅ | ❌ | ❌ | ✅ |
| No client install | ✅ | ✅ | ✅ | ❌ |
| Works on any site | ✅ | ✅ | ✅ | ✅ |
| Survives site updates | ✅ | ❌ | ❌ | ⚠️ |
| LLM-readable snapshots | ✅ | ❌ | ❌ | ❌ |
| No source code access needed | ✅ | ✅ | ✅ | ✅ |
| IT-friendly deployment | ✅ | ✅ | ✅ | ❌ |

---

## The Future Path

Here's the thing: Webfuse and WebMCP aren't competing. They're complementary.

As more sites adopt WebMCP, Webfuse can route agent calls to those native endpoints — giving you structured tool access when it's available, and augmented proxy access when it isn't. You write your agent once. Webfuse handles the rest.

The trajectory is:

**Today**: Agent → Webfuse proxy → any website  
**2027**: Agent → Webfuse → WebMCP endpoint (if available) or proxy fallback

Your agent stack doesn't change. The underlying transport gets progressively better as the ecosystem matures.

---

## Try It

If you're building voice agents on Vapi, ElevenLabs, or Deepgram — or text agents on LangChain, CrewAI, or OpenAI's Agents SDK — and you're hitting walls with browser automation, this is worth your 30 minutes.

The demo below shows a Claude-powered agent navigating a live website through Webfuse, using nothing but tool calls: no Playwright, no CSS selector maintenance, no auth headaches.

**[→ View the demo](https://github.com/hummer-netizen/webfuse-webmcp-demo)**  
**[→ Try Webfuse](https://webfuse.com)**

---

*Built with Webfuse + Claude Sonnet 4. Questions? [hummer@nichol.as](mailto:hummer@nichol.as)*
