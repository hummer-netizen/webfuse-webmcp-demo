/**
 * popup.js — Agent controller
 * Orchestrates: user input → Claude (via proxy) → page actions → repeat
 */

const PROXY_URL = 'https://strengths-township-incurred-boating.trycloudflare.com';
const MODEL = 'claude-sonnet-4-6';
const MAX_TURNS = 10;

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');

let conversationHistory = [];
let isRunning = false;

const TOOLS = [
  {
    name: 'snapshot',
    description: 'Get a structured snapshot of the current page: URL, title, headings, visible text, and interactive elements (buttons, links, inputs) with CSS selectors and ARIA labels.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'click',
    description: 'Click an element on the page by CSS selector.',
    input_schema: {
      type: 'object',
      properties: { selector: { type: 'string', description: 'CSS selector of the element to click' } },
      required: ['selector']
    }
  },
  {
    name: 'fill',
    description: 'Fill a form field (input, textarea, select) with a value. Works on React and vanilla apps.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the input field' },
        value: { type: 'string', description: 'Value to type into the field' }
      },
      required: ['selector', 'value']
    }
  },
  {
    name: 'navigate',
    description: 'Navigate to a URL.',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'Full URL to navigate to' } },
      required: ['url']
    }
  },
  {
    name: 'scroll',
    description: 'Scroll the page up or down.',
    input_schema: {
      type: 'object',
      properties: { direction: { type: 'string', enum: ['up', 'down'] } },
      required: ['direction']
    }
  }
  {
    name: 'done',
    description: 'Signal task is complete with a brief summary of what was accomplished.',
    input_schema: {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary']
    }
  }
];

const SYSTEM_PROMPT = `You are a web automation agent running inside a Webfuse-proxied browser session. You have structured access to any website — real auth, real cookies, real state — without requiring the site to implement WebMCP.

Tools: snapshot (see page), click, fill, navigate, scroll (up/down), done (signal completion).

Rules:
1. Always start with snapshot to understand the current page
2. Use the most stable selector available (id > data-testid > aria-label > name > positional)
3. After each action, take a new snapshot to confirm the result
4. If an action fails, try an alternative selector or approach  
5. Be concise — act, don't over-explain
6. When the task is complete, call done() with a one-sentence summary`;

async function callPageTool(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return resolve({ error: 'No active tab found' });
      chrome.tabs.sendMessage(tabs[0].id, { type, payload }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ error: chrome.runtime.lastError.message });
        } else {
          resolve(response?.result ?? response ?? { error: 'No response' });
        }
      });
    });
  });
}

async function callClaude(messages) {
  const res = await fetch(`${PROXY_URL}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM_PROMPT, tools: TOOLS, messages }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Proxy error ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

function addMessage(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function addAction(name, input) {
  const args = Object.values(input).map(v =>
    typeof v === 'string' ? `"${v.slice(0, 40)}"` : JSON.stringify(v)
  ).join(', ');
  const div = document.createElement('div');
  div.className = 'msg thinking';
  div.innerHTML = `<span class="action-pill">${name}(${args})</span>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function runAgent(userGoal) {
  isRunning = true;
  sendBtn.disabled = true;
  inputEl.disabled = true;
  conversationHistory = [{ role: 'user', content: userGoal }];

  addMessage('user', userGoal);

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const thinkingEl = addMessage('thinking', '⏳ Thinking…');

    let claudeRes;
    try {
      claudeRes = await callClaude(conversationHistory);
    } catch (e) {
      thinkingEl.remove();
      addMessage('system', `❌ ${e.message}`);
      break;
    }
    thinkingEl.remove();

    // Show any text blocks
    claudeRes.content.filter(b => b.type === 'text').forEach(b => {
      if (b.text.trim()) addMessage('agent', b.text.trim());
    });

    if (claudeRes.stop_reason === 'end_turn') break;

    const toolUses = claudeRes.content.filter(b => b.type === 'tool_use');
    if (!toolUses.length) break;

    conversationHistory.push({ role: 'assistant', content: claudeRes.content });
    const toolResults = [];
    let finished = false;

    for (const { id, name, input } of toolUses) {
      addAction(name, input);

      if (name === 'done') {
        addMessage('agent', `✅ ${input.summary}`);
        toolResults.push({ type: 'tool_result', tool_use_id: id, content: 'Done.' });
        finished = true;
        break;
      }

      let result;
      if (name === 'snapshot')   result = await callPageTool('SNAPSHOT');
      else if (name === 'click') result = await callPageTool('CLICK', input);
      else if (name === 'fill')  result = await callPageTool('FILL', input);
      else if (name === 'navigate') result = await callPageTool('NAVIGATE', input);
      else if (name === 'scroll')   result = await callPageTool('SCROLL', input);
      else result = { error: `Unknown tool: ${name}` };

      toolResults.push({
        type: 'tool_result',
        tool_use_id: id,
        content: JSON.stringify(result).slice(0, 3000),
      });
    }

    conversationHistory.push({ role: 'user', content: toolResults });
    if (finished) break;
  }

  isRunning = false;
  sendBtn.disabled = false;
  inputEl.disabled = false;
  inputEl.focus();
}

sendBtn.addEventListener('click', () => {
  const goal = inputEl.value.trim();
  if (!goal || isRunning) return;
  inputEl.value = '';
  runAgent(goal);
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
});

// Welcome hint
addMessage('system', 'Suggestions:\n• "Search for machine learning"\n• "Summarise this page"\n• "Click the first link in the article"\n• "Find the search box and look up AI agents"');
