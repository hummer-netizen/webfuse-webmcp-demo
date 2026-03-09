/**
 * background.js — Message hub
 * Routes: sidepanel ↔ content script (tool calls)
 *         sidepanel → Anthropic API (Claude calls, streamed)
 * Opens sidepanel automatically on session start.
 */
const PROXY_URL = 'https://proxy.webfuse.it';

// Auto-open sidepanel on every new tab/navigation
browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
// Open immediately for all tabs
browser.sidePanel.open();

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
  }
});

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

console.log('[Webfuse WebMCP Demo] Background script active (sidepanel + streaming)');
