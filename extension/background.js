/**
 * background.js — Handles Claude API calls with streaming support.
 * Streams SSE chunks back to content.js via tabs.sendMessage.
 */
const PROXY_URL = 'https://proxy.webfuse.it';

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'CLAUDE_API') {
    const { reqId, payload } = message;
    const tabId = sender.tab?.id ?? null;
    // Enable streaming
    payload.stream = true;
    streamClaude(reqId, tabId, payload);
  }
});

async function streamClaude(reqId, tabId, payload, attempt = 0) {
  try {
    const res = await fetch(`${PROXY_URL}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
      return streamClaude(reqId, tabId, payload, attempt + 1);
    }
    if (!res.ok) {
      const errText = (await res.text()).slice(0, 150);
      browser.tabs.sendMessage(tabId, { type: 'CLAUDE_RESPONSE', reqId, error: `Proxy ${res.status}: ${errText}` });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const event = JSON.parse(data);
          browser.tabs.sendMessage(tabId, { type: 'CLAUDE_STREAM', reqId, event });
        } catch (_) {}
      }
    }

    // Signal stream complete
    browser.tabs.sendMessage(tabId, { type: 'CLAUDE_STREAM_END', reqId });
  } catch (e) {
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
      return streamClaude(reqId, tabId, payload, attempt + 1);
    }
    browser.tabs.sendMessage(tabId, { type: 'CLAUDE_RESPONSE', reqId, error: e.message });
  }
}

console.log('[Webfuse WebMCP Demo] Background script active (streaming)');
