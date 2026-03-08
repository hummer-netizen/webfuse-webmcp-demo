# WebMCP Bridge Demo 🌐

> **WebMCP is coming. Webfuse is already here.**

A working AI agent that sees and controls any website through [Webfuse](https://webfuse.com) — giving you WebMCP-grade browser automation on every site, today, without waiting for sites to implement the spec.

## What This Is

A Webfuse Extension (popup + content script) that embeds a Claude-powered agent into any website proxied through a Webfuse Space. The agent can:

- 📸 **Snapshot** — Read the current page state as structured JSON (URL, visible text, interactive elements + selectors)
- 🖱️ **Click** — Click any element by CSS selector
- ✏️ **Fill** — Fill form fields
- 🧭 **Navigate** — Go to any URL
- ✅ **Done** — Signal task completion with a summary

## Live Demo

Try it at: **[webfu.se/+hummerbot/](https://webfu.se/+hummerbot/)**

The space proxies any URL you navigate to, with the agent widget available in the top-right corner.

## How It Works

```
User types goal
    ↓
Claude receives goal + page snapshot
    ↓
Claude decides: click / fill / navigate / snapshot
    ↓
Webfuse content script executes action on live page
    ↓
Repeat until done
```

The key insight: Webfuse runs in the **user's real browser session** — real cookies, real auth, real state. No isolated headless browser. No auth re-setup. No fragile Playwright scripts.

## Setup (Self-Hosted)

### 1. Create a Webfuse Space

Sign up at [webfuse.com](https://webfuse.com) and create a Space. Note your Space ID and REST key.

### 2. Deploy This Extension

Via the Webfuse API:

```bash
curl -X POST https://api.webfu.se/api/spaces/{SPACE_ID}/extensions/github/ \
  -H "Authorization: Token YOUR_REST_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "WebMCP Bridge Demo",
    "repo_url": "https://github.com/hummer-netizen/webfuse-webmcp-demo/extension",
    "ref": "main",
    "storage_app": YOUR_STORAGE_APP_ID
  }'
```

### 3. Set Your Anthropic API Key

Edit `extension/manifest.json` and replace `REPLACE_WITH_YOUR_KEY` with your Anthropic API key.

### 4. Open Your Space

Navigate to your Webfuse Space URL. Click the extension popup. Give the agent a task.

## File Structure

```
extension/
├── manifest.json   # Extension metadata + env vars (API key)
├── content.js      # Page snapshot + action execution (injected into site)
├── popup.html      # Agent chat UI
└── popup.js        # Claude orchestration + tool calling loop

blog/
└── webmcp-bridge.md  # Accompanying blog post
```

## The Bigger Picture

[WebMCP](https://github.com/w3c-webmcp) (shipping in Chrome 146) lets AI agents interact with websites as structured tool endpoints — but requires site owners to implement it. That's going to take years.

Webfuse bridges the gap: proxy-layer augmentation that gives agents structured, programmatic access to **any** site, **today**.

Read the full writeup: [blog/webmcp-bridge.md](blog/webmcp-bridge.md)

---

Built with ❤️ by [Hummer](https://github.com/hummer-netizen) · Powered by [Webfuse](https://webfuse.com)
