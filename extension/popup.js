/**
 * popup.js — Agent controller
 * Orchestrates: user input → Claude → page actions → repeat
 */

const API_KEY = typeof ANTHROPIC_API_KEY !== 'undefined' ? ANTHROPIC_API_KEY : '';
const MODEL = 'claude-sonnet-4-6';
const MAX_TURNS = 8;

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');

let conversationHistory = [];
let isRunning = false;

// Tool definitions sent to Claude
const TOOLS = [
  {
    name: 'snapshot',
    description: 'Get a structured snapshot of the current page state: URL, title, visible text, and interactive elements (buttons, links, inputs) with their CSS selectors.',
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
    description: 'Fill a form field (input, textarea) with a value.',
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
      properties: { url: { type: 'string', description: 'URL to navigate to' } },
      required: ['url']
    }
  },
  {
    name: 'done',
    description: 'Signal that the task is complete. Include a summary of what was accomplished.',
    input_schema: {
      type: 'object',
      properties: { summary: { type: 'string', description: 'What was accomplished' } },
      required: ['summary']
    }
  }
];

const SYSTEM_PROMPT = `You are a web automation agent operating on a live website through Webfuse — a reverse proxy that gives you structured access to any website without requiring the site to implement WebMCP.

You have tools to:
- snapshot: see the current page state (URL, text, interactive elements)
- click: click elements by CSS selector
- fill: fill form fields
- navigate: go to a URL
- done: signal task completion

Strategy:
1. Always start with a snapshot to understand the current page state
2. Plan a sequence of actions to accomplish the user's goal
3. After each action, take a new snapshot to confirm the result
4. Keep going until the task is done, then call done()
5. If something fails (element not found etc.), try an alternative approach

Be concise in your thinking. Prefer reliable selectors (id > name > data-testid > positional).`;

// Send a message to the content script and await response
function callPageTool(type, payload = {}) {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const handler = (event) => {
      if (event.data?.type === `${type}_RESULT` && event.data?.id === id) {
        window.removeEventListener('message', handler);
        resolve(event.data.result);
      }
    };
    window.addEventListener('message', handler);

    // Relay to content script via the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type, payload, id }, (response) => {
        if (chrome.runtime.lastError) {
          window.removeEventListener('message', handler);
          resolve({ error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    });
  });
}

async function callClaude(messages) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    })
  });
  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
  return response.json();
}

function addMessage(role, text, className = '') {
  const div = document.createElement('div');
  div.className = `msg ${role} ${className}`.trim();
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function addAction(text) {
  const div = document.createElement('div');
  div.className = 'msg thinking';
  div.innerHTML = `<span class="action-pill">${text}</span>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function runAgent(userGoal) {
  isRunning = true;
  sendBtn.disabled = true;
  inputEl.disabled = true;

  addMessage('user', userGoal);
  conversationHistory.push({ role: 'user', content: userGoal });

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const thinkingEl = addMessage('thinking', '⏳ Thinking…');

    let claudeResponse;
    try {
      claudeResponse = await callClaude(conversationHistory);
    } catch (e) {
      thinkingEl.remove();
      addMessage('agent', `Error: ${e.message}`);
      break;
    }

    thinkingEl.remove();

    // Collect text blocks to display
    const textBlocks = claudeResponse.content.filter(b => b.type === 'text');
    if (textBlocks.length > 0) {
      addMessage('agent', textBlocks.map(b => b.text).join('\n'));
    }

    // Handle stop conditions
    if (claudeResponse.stop_reason === 'end_turn') break;

    // Process tool calls
    const toolUses = claudeResponse.content.filter(b => b.type === 'tool_use');
    if (toolUses.length === 0) break;

    // Add assistant turn to history
    conversationHistory.push({ role: 'assistant', content: claudeResponse.content });

    const toolResults = [];

    for (const toolUse of toolUses) {
      const { id, name, input } = toolUse;
      addAction(`${name}(${Object.values(input).map(v => JSON.stringify(v)).join(', ')})`);

      if (name === 'done') {
        addMessage('agent', `✅ ${input.summary}`);
        toolResults.push({ type: 'tool_result', tool_use_id: id, content: 'Done.' });
        isRunning = false;
        break;
      }

      let result;
      if (name === 'snapshot') result = await callPageTool('SNAPSHOT');
      else if (name === 'click') result = await callPageTool('CLICK', input);
      else if (name === 'fill') result = await callPageTool('FILL', input);
      else if (name === 'navigate') result = await callPageTool('NAVIGATE', input);
      else result = { error: `Unknown tool: ${name}` };

      toolResults.push({
        type: 'tool_result',
        tool_use_id: id,
        content: JSON.stringify(result).slice(0, 2000)
      });
    }

    if (!isRunning) break;

    conversationHistory.push({ role: 'user', content: toolResults });
  }

  sendBtn.disabled = false;
  inputEl.disabled = false;
  inputEl.focus();
  isRunning = false;
}

sendBtn.addEventListener('click', () => {
  const goal = inputEl.value.trim();
  if (!goal || isRunning) return;
  inputEl.value = '';
  runAgent(goal);
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

// Check API key on load
if (!API_KEY) {
  addMessage('system', '⚠️ No ANTHROPIC_API_KEY set in manifest.json env.');
}
