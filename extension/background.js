/**
 * background.js — Webfuse Extension service worker
 * Handles Claude API calls outside the proxy context (avoids CORS issues).
 */

const PROXY_URL = 'https://proxy.webfuse.it';

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'CLAUDE_API') {
    callClaude(message.payload)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // async response
  }
});

async function callClaude(payload, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${PROXY_URL}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) { await sleep((attempt + 1) * 1500); continue; }
      }
      if (!res.ok) throw new Error(`Proxy ${res.status}: ${(await res.text()).slice(0, 150)}`);
      return await res.json();
    } catch (e) {
      if (attempt < retries && e.name !== 'SyntaxError') { await sleep((attempt + 1) * 1500); continue; }
      throw e;
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

console.log('[Webfuse WebMCP Demo] Background script active');
