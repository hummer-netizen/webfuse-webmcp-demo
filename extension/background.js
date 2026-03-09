/**
 * background.js — Handles Claude API calls outside the proxy context.
 * Uses two-way messaging: content → background (request), background → content (response).
 */
const PROXY_URL = 'https://proxy.webfuse.it';

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'CLAUDE_API') {
    const reqId = message.reqId;
    const tabId = sender.tab?.id ?? null;
    // Fire-and-forget — result sent back via tabs.sendMessage
    callClaude(message.payload).then(data => {
      browser.tabs.sendMessage(tabId, { type: 'CLAUDE_RESPONSE', reqId, data });
    }).catch(err => {
      browser.tabs.sendMessage(tabId, { type: 'CLAUDE_RESPONSE', reqId, error: err.message });
    });
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
