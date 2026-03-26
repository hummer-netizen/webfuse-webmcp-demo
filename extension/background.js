/**
 * background.js — Message hub + WebMCP Hub integration
 * Routes: sidepanel ↔ content script (tool calls)
 *         sidepanel → Anthropic API (Claude calls, streamed)
 *         content.js → WebMCP Hub API (config lookup on navigation)
 * Opens sidepanel automatically on session start.
 */
const PROXY_URL = 'https://webmcp-demo.webfuse.it';
const HUB_API = 'https://webmcp-demo.webfuse.it/hub/lookup';

// Cache hub configs per domain to avoid repeated lookups
const hubCache = {};

// Auto-open sidepanel
browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
browser.sidePanel.open();

// Track current domain to detect navigation across sites
let lastDomain = '';

// Poll for domain changes (Webfuse virtual tabs may not fire standard nav events)
setInterval(async () => {
  try {
    const tabs = await browser.webfuseSession.getTabs();
    const active = tabs.find(t => t.active) || tabs[0];
    if (active && active.url) {
      const domain = new URL(active.url).hostname;
      if (domain && domain !== lastDomain) {
        lastDomain = domain;
        console.log('[Hub] Domain changed to:', domain);
        lookupHub(domain).then(configs => {
          browser.runtime.sendMessage({ type: 'HUB_TOOLS_UPDATED', domain, configs });
        });
      }
    }
  } catch (_) {}
}, 2000);

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'CLAUDE_API') {
    const { reqId, payload } = message;
    payload.stream = true;
    streamClaude(reqId, payload, sender);

  } else if (message?.type === 'TOOL_EXEC') {
    const { reqId, name, input } = message;
    browser.tabs.sendMessage(null, { type: 'TOOL_EXEC', reqId, name, input });

  } else if (message?.type === 'TOOL_RESULT') {
    browser.runtime.sendMessage(message);

  } else if (message?.type === 'HUB_LOOKUP') {
    // Content script asks us to look up hub configs for a domain
    const { reqId, domain } = message;
    lookupHub(domain).then(configs => {
      browser.runtime.sendMessage({ type: 'HUB_RESULT', reqId, configs });
      // Also notify sidepanel
      browser.runtime.sendMessage({ type: 'HUB_TOOLS_UPDATED', domain, configs });
    });

  } else if (message?.type === 'GET_HUB_STATUS') {
    // Sidepanel asks for current hub state
    // Get the active tab domain and return cached or fresh hub configs
    (async () => {
      try {
        const tabs = await browser.webfuseSession.getTabs();
        const active = tabs.find(t => t.active) || tabs[0];
        if (active && active.url) {
          const domain = new URL(active.url).hostname;
          if (domain) {
            const configs = await lookupHub(domain);
            browser.runtime.sendMessage({ type: 'HUB_TOOLS_UPDATED', domain, configs });
          }
        }
      } catch (e) {
        // Session API might not be available, try using lastDomain
        if (lastDomain) {
          const configs = await lookupHub(lastDomain);
          browser.runtime.sendMessage({ type: 'HUB_TOOLS_UPDATED', domain: lastDomain, configs });
        }
      }
    })();

  } else if (message?.type === 'HUB_EXEC') {
    // Sidepanel asks content script to execute a hub tool
    const { reqId, name, input, execution } = message;
    browser.tabs.sendMessage(null, { type: 'HUB_EXEC', reqId, name, input, execution });
  }
});

async function lookupHub(domain) {
  if (hubCache[domain]) return hubCache[domain];
  try {
    const res = await fetch(`${HUB_API}?domain=${encodeURIComponent(domain)}`);
    if (!res.ok) return [];
    const data = await res.json();
    const configs = data.configs || [];
    hubCache[domain] = configs;
    console.log(`[Hub] ${domain}: ${configs.length} configs, ${configs.reduce((n, c) => n + (c.tools?.length || 0), 0)} tools`);
    return configs;
  } catch (e) {
    console.error('[Hub] Lookup failed:', e.message);
    return [];
  }
}

async function streamClaude(reqId, payload, sender, attempt = 0) {
  try {
    const res = await fetch(`${PROXY_URL}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
      return streamClaude(reqId, payload, sender, attempt + 1);
    }
    if (!res.ok) {
      browser.runtime.sendMessage({ type: 'CLAUDE_RESPONSE', reqId, error: `Proxy ${res.status}: ${(await res.text()).slice(0, 150)}` });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try { browser.runtime.sendMessage({ type: 'CLAUDE_STREAM', reqId, event: JSON.parse(data) }); } catch (_) {}
      }
    }
    browser.runtime.sendMessage({ type: 'CLAUDE_STREAM_END', reqId });
  } catch (e) {
    if (attempt < 2) { await new Promise(r => setTimeout(r, (attempt + 1) * 1500)); return streamClaude(reqId, payload, sender, attempt + 1); }
    browser.runtime.sendMessage({ type: 'CLAUDE_RESPONSE', reqId, error: e.message });
  }
}

console.log('[Webfuse WebMCP Demo] Background v3.0 — Hub integration + streaming');
