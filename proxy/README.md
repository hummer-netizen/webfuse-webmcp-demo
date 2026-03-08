# Proxy (Cloudflare Worker)

Holds the Anthropic API key server-side. The browser extension calls this proxy — the key is never exposed to the client.

## Deploy your own

```bash
cd proxy
npm install -g wrangler
wrangler login
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy
```

Then update `PROXY_URL` in `extension/popup.js` with your `*.workers.dev` URL.
