# Demo Script — WebMCP Bridge Demo 🎬

A 5-minute walkthrough for showing this to developers, investors, or potential customers.

---

## Setup (30 seconds before you start)

1. Open **[webfu.se/+hummerbot/](https://webfu.se/+hummerbot/)** in Chrome
2. The page loads Wikipedia's AI article — that's the start page
3. Look for the Webfuse extension popup button (appears in the session UI)
4. Have the GitHub repo open in another tab: **[github.com/hummer-netizen/webfuse-webmcp-demo](https://github.com/hummer-netizen/webfuse-webmcp-demo)**

---

## The One-Line Pitch

> "GPT-5.4 just launched computer-use that works from screenshots. This demo does the same thing from structured DOM access — faster, more reliable, and in the user's real browser session."

---

## Demo Flow 1 — The Quick Wow (60 seconds)

**What to say:**
> "This is a live website — Wikipedia — loaded through Webfuse. Watch what happens when I give the agent a task."

**Type in the popup:**
```
Search for "WebMCP" using the search bar, then summarise what comes up
```

**What the agent does:**
- Calls `snapshot()` → reads the page
- Calls `fill()` on the search input
- Calls `click()` on the search button
- Navigates to results
- Calls `snapshot()` again
- Returns a summary

**Talking point while it runs:**
> "Notice it's not taking screenshots and guessing where to click. It's reading a structured representation of the page — headings, interactive elements, ARIA labels. That's why it's fast and doesn't break when the layout changes."

---

## Demo Flow 2 — The Architecture Point (90 seconds)

**What to say:**
> "Let me show you what's actually happening under the hood."

Open the GitHub repo. Point to the file structure:

```
extension/content.js   ← runs inside the proxied page
extension/popup.js     ← the UI, calls our proxy
proxy/worker.js        ← holds the API key server-side
```

**Key talking point:**
> "The API key never touches the browser. The popup calls our proxy, which calls Anthropic. Compare that to Claude in Chrome — which requires a browser extension install per user. This runs at the proxy layer. Zero client install."

**Then show the manifest.json:**
> "This is a Webfuse Extension. Structurally identical to a browser extension — manifest, content script, popup — but deployed at the proxy layer. It's live on every session without users installing anything."

---

## Demo Flow 3 — The Real-World Relevance (2 minutes)

**What to say:**
> "Let's talk about why this matters right now."

Navigate to `https://en.wikipedia.org/wiki/Artificial_intelligence` within the space, then:

**Type in the popup:**
```
Find the table of contents and click on the "Applications" section
```

**While it runs, talk through the landscape:**

> "This week: Google shipped WebMCP in Chrome 146. OpenAI shipped GPT-5.4 with computer-use. Anthropic shipped Claude in Chrome. Everyone's racing to give AI agents web access.
>
> Here's the problem they haven't solved: **your user's web**. Not a sandboxed browser. The actual live app your user is logged into.
>
> WebMCP requires site owners to implement it — that won't happen for years. GPT-5.4 computer-use works from screenshots, which is slow and breaks on every UI update. Claude in Chrome needs a browser extension install, which IT blocks at enterprise.
>
> Webfuse is the bridge. Proxy layer. Real session. No install. Any site. Today."

---

## If Something Goes Wrong

**Agent says 'element not found':**
> "This happens occasionally with dynamic sites — the selector missed. The agent retries automatically. In production you'd tune the snapshot strategy for your specific app."

**Agent loops / takes too many steps:**
> "It's being thorough. Max 10 turns. You can cut it off and try a simpler goal."

**Proxy times out:**
> The Cloudflare tunnel occasionally resets. If the proxy URL is dead, run: `~/webfuse-proxy/start.sh` and update `PROXY_URL` in popup.js.

---

## The Leave-Behind

Send people to:
- **Demo:** [webfu.se/+hummerbot/](https://webfu.se/+hummerbot/)
- **Code:** [github.com/hummer-netizen/webfuse-webmcp-demo](https://github.com/hummer-netizen/webfuse-webmcp-demo)
- **Blog post:** [github.com/hummer-netizen/webfuse-webmcp-demo/blob/main/blog/webmcp-bridge.md](https://github.com/hummer-netizen/webfuse-webmcp-demo/blob/main/blog/webmcp-bridge.md)
- **Webfuse:** [webfuse.com](https://webfuse.com)

---

## One More Angle (for technical audiences)

> "The interesting thing is this demo uses Claude Sonnet, but it's model-agnostic. You could swap in GPT-5.4, Gemini, or any model with tool calling. Webfuse is the infrastructure layer — it doesn't care which brain is driving."

