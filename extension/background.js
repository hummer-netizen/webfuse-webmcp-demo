/**
 * background.js — Handles Claude API calls outside the proxy context
 */
const PROXY_URL = 'https://proxy.webfuse.it';

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'CLAUDE_API') {
    // Return a Promise — Webfuse extension messaging supports this
    return callClaude(message.payload);
  }
});

async function callClaude(payload) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${PROXY_URL}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 429 || res.status >= 500) {
        if (attempt < 2) { await new Promise(r => setTimeout(r, (attempt + 1) * 1500)); continue; }
      }
      if (!res.ok) throw new Error(`Proxy ${res.status}: ${(await res.text()).slice(0, 150)}`);
      return await res.json();
    } catch (e) {
      if (attempt < 2) { await new Promise(r => setTimeout(r, (attempt + 1) * 1500)); continue; }
      throw e;
    }
  }
}

console.log('[Webfuse WebMCP Demo] Background script active');
