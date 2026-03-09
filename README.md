# WebMCP Bridge Demo 🌐

> **AI agents shouldn't need to wait for websites to implement WebMCP. This demo proves they don't.**

A Claude-powered agent that sees and controls any website through [Webfuse](https://webfuse.com) — real browser session, real auth, zero client install. Built as a Webfuse Extension (content script + popup UI).

**[→ Try it live at webfu.se/+hummerbot/](https://webfu.se/+hummerbot/)**

---

## What the Agent Can Do

| Tool | What it does |
|------|-------------|
| `snapshot` | Reads the full page state — URL, headings, visible text, all interactive elements with stable selectors |
| `click` | Clicks any element (buttons, links, menu items) |
| `fill` | Fills form fields — works on React apps too |
| `navigate` | Goes to any URL |
| `scroll` | Scrolls up or down for long pages |
| `done` | Signals task complete with a summary |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                        │
│                                                          │
│  ┌──────────────────────────────────────┐               │
│  │     Webfuse Proxied Session           │               │
│  │   (any website, real auth/cookies)   │               │
│  │                                      │               │
│  │  ┌─────────────┐  ┌──────────────┐  │               │
│  │  │  content.js  │  │  popup.html  │  │               │
│  │  │  (injected)  │◄─│  (agent UI)  │  │               │
│  │  │              │  │              │  │               │
│  │  │ • snapshot() │  │ User types   │  │               │
│  │  │ • click()    │  │ goal →       │  │               │
│  │  │ • fill()     │  │ Claude loop  │  │               │
│  │  │ • scroll()   │  │             │  │               │
│  │  └─────────────┘  └──────┬───────┘  │               │
│  └─────────────────────────┼───────────┘               │
└────────────────────────────┼────────────────────────────┘
                             │ HTTPS (no API key in browser)
                    ┌────────▼────────┐
                    │  Proxy Server   │
                    │ (holds API key) │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Anthropic API  │
                    │  Claude Sonnet  │
                    └─────────────────┘
```

**Key principle:** The Anthropic API key never touches the browser. The popup calls a proxy server which holds the key server-side.

---

## How a Task Runs

```
You:   "Search for 'AI agents' and open the first result"

Agent → snapshot()
      ← { url, title, interactive: [{ selector: "#searchInput", type: "input" }, ...] }

Agent → fill("#searchInput", "AI agents")
      ← { ok: true }

Agent → click("button[type=submit]")
      ← { ok: true }

Agent → snapshot()
      ← { interactive: [{ type: "a", text: "AI Agents - Wikipedia", href: "/wiki/..." }, ...] }

Agent → click("a[text='AI Agents - Wikipedia']")
      ← { ok: true }

Agent → done("Searched for 'AI agents' and opened the Wikipedia article")
```

---

## Run Your Own

### Prerequisites
- A [Webfuse](https://webfuse.com) account with a Space
- An [Anthropic](https://console.anthropic.com) API key

### 1 — Deploy the Proxy

The proxy holds your Anthropic API key server-side. Choose one:

**Option A: Cloudflare Worker (recommended)**
```bash
cd proxy
npm install -g wrangler
wrangler login
wrangler secret put ANTHROPIC_API_KEY   # paste your key when prompted
wrangler deploy                          # get a *.workers.dev URL
```

**Option B: Run locally + tunnel**
```bash
ANTHROPIC_API_KEY=sk-ant-... node proxy/server.js &
cloudflared tunnel --url http://127.0.0.1:3001
# Note the *.trycloudflare.com URL
```

### 2 — Update the Extension

In `extension/popup.js`, set `PROXY_URL` to your proxy URL:
```js
const PROXY_URL = 'https://your-proxy.workers.dev';
```

### 3 — Deploy the Extension to Your Space

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

> Get your `SPACE_ID`, `REST_KEY`, and `STORAGE_APP_ID` from your Webfuse dashboard.

### 4 — Open Your Space

Go to your Space URL. The agent widget appears as a popup button. Click it, type a goal, watch it work.

---

## File Structure

```
webfuse-webmcp-demo/
├── extension/
│   ├── manifest.json   Webfuse Extension manifest
│   ├── content.js      Page snapshot + actions (injected into proxied site)
│   ├── popup.html      Agent chat UI
│   └── popup.js        Claude tool-calling loop (calls proxy, not Anthropic directly)
├── proxy/
│   ├── worker.js       Cloudflare Worker — production proxy
│   ├── wrangler.toml   Worker config
│   ├── server.js       Node.js alternative proxy
│   └── README.md       Proxy setup guide
└── blog/
    └── webmcp-bridge.md  "Your AI Agent Has a Brain. Give It Hands."
```

---

## Why This Approach

| | Webfuse | Claude in Chrome | OpenAI Operator | Playwright |
|--|---------|-----------------|-----------------|------------|
| Real user session | ✅ | ✅ | ❌ | ❌ |
| No client install | ✅ | ❌ | ✅ | ✅ |
| Embed in your product | ✅ | ❌ | ⚠️ | ✅ |
| IT-friendly | ✅ | ❌ | ✅ | ✅ |
| WebMCP-ready | ✅ | ❌ | ❌ | ❌ |

Read the full writeup: **[blog/webmcp-bridge.md](blog/webmcp-bridge.md)**

---

Built by [Hummer](https://github.com/hummer-netizen) · Powered by [Webfuse](https://webfuse.com) + [Claude](https://anthropic.com)
