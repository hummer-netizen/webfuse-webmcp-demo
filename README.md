# WebMCP Bridge Demo 🌐

> **WebMCP asks websites to cooperate. Webfuse doesn't have to ask.**

An AI agent that operates on any website through [Webfuse](https://webfuse.com) — real browser session, real auth, zero client install. Custom semantic tools on sites you don't own.

## Live Demo

**[→ Booking.com Agent Demo](https://webfu.se/+bookingcom-agent-demo)** — watch an AI agent search hotels with a single `search_hotels()` call instead of 10+ fragile click/fill steps.

## Architecture (v2.0)

```
┌─────────────────────────────────────────────┐
│  User's Browser (real session, real auth)    │
│                                             │
│  ┌──────────┐  ┌──────────────────────────┐ │
│  │ Any Site  │  │  Webfuse Extension       │ │
│  │(unchanged)│  │  ├─ sidepanel.js (chat)  │ │
│  │           │  │  ├─ content.js (tools)   │ │
│  │           │  │  └─ background.js (hub)  │ │
│  └─────┬─────┘  └────────────┬────────────┘ │
│        └──────┬───────────────┘             │
│        ┌──────┴──────┐                      │
│        │ Webfuse     │                      │
│        │ Proxy       │                      │
│        └──────┬──────┘                      │
└───────────────┼─────────────────────────────┘
                │
       ┌────────┴────────┐
       │  AI Agent       │
       │  (Claude Haiku) │
       └─────────────────┘
```

### Components

| File | Role |
|------|------|
| `extension/sidepanel.js` | Persistent chat UI — survives page navigation |
| `extension/content.js` | Page tools: snapshot, click, fill, scroll, navigate |
| `extension/background.js` | Message hub + Claude API streaming |
| `proxy/worker.js` | Cloudflare Worker — Anthropic API proxy with streaming |

### Key Design Decisions

- **Sidepanel over popup/FAB**: Persists across navigations. Chat history survives when agent clicks a link.
- **Background script for API calls**: Content scripts in Webfuse run inside the proxy — all `fetch()` is intercepted. Background service worker runs outside proxy context.
- **Two-way messaging**: `browser.runtime.onMessage` doesn't support async returns in Webfuse. Uses reqId-matched message pairs.
- **Streaming SSE**: Responses stream token-by-token. Total round-trip ~3s vs ~6.5s without streaming.

## Setup

### 1. Deploy the Anthropic proxy

```bash
cd proxy
npm install -g wrangler
wrangler login
wrangler secret put ANTHROPIC_API_KEY  # paste your key
wrangler deploy
```

### 2. Update the proxy URL

Edit `extension/background.js` — set `PROXY_URL` to your Worker URL.

### 3. Deploy to Webfuse

Upload `extension/` directory as a Webfuse Extension in your space settings, or use the GitHub import API:

```bash
curl -X POST https://api.webfu.se/api/spaces/YOUR_SPACE_ID/extensions/github/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"WebMCP Bridge Demo","repo_url":"https://github.com/YOU/REPO/extension","ref":"main","storage_app":YOUR_APP_ID}'
```

## Blog Post

Read the full analysis: **[WebMCP Asks Websites to Cooperate. Webfuse Doesn't Have to Ask.](blog/webmcp-bridge.md)**

## License

MIT
